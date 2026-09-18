export const meta = {
  name: 'skill-forge-eval',
  description:
    'Paired with-skill / baseline runs with K repeats, schema-graded assertions, a code-computed noise gate, then held-out and weaker-target cells',
  whenToUse:
    'Invoked by /skill-forge:eval, and as a child by optimize.js. Requires args {skillName, skillPath, skillHash, evals, runs, workspace, evalsRoot}. Returns per-arm statistics and a verdict; it writes nothing itself — run agents write outputs/ and grading.json under workspace in skill-creator layout. Bare invocation without args returns started:false.',
  phases: [
    { title: 'Run', detail: 'one subagent per (eval × arm × repeat); with_skill reads SKILL.md, baseline reads the user CLAUDE.md and no skill' },
    { title: 'Grade', detail: 'one grader per run; assertions → grading.json with skill-creator field names' },
    { title: 'Held-out', detail: 'only if the train arms separated; evals with split=heldout' },
    { title: 'Weaker target', detail: 'with_skill and baseline on the cheapest model; must not regress' },
  ],
}

// args may arrive as a JSON string depending on the invoking runtime.
const A = typeof args === 'string' ? (() => { try { return JSON.parse(args) } catch (e) { return null } })() : args
if (!A || typeof A !== 'object' || !A.skillPath || !Array.isArray(A.evals) || !A.workspace) {
  log('eval.js started without its required args (skillPath, evals, workspace) — nothing to run')
  return { started: false, reason: 'no-args', next: 'Run /skill-forge:eval <name> from the claude-utils checkout; it assembles the args.' }
}

const runs = Math.max(1, Number(A.runs) || 3)
const splits = Array.isArray(A.splits) && A.splits.length ? A.splits : ['train'].concat(A.includeHeldout ? ['heldout'] : [])
const arms = ['with_skill', 'baseline']
const evalsRoot = A.evalsRoot || ''
const target = typeof A.target === 'number' ? A.target : null

const splitOf = e => (e.split === 'heldout' ? 'heldout' : 'train')
const evalName = e => e.name || `eval-${e.id}`
const runDir = (e, arm, k, sub) => `${A.workspace}/${sub ? sub + '/' : ''}${evalName(e)}/${arm}/run-${k}`

function cellsFor(evalList, k, sub, model) {
  return evalList.flatMap(e => arms.flatMap(arm =>
    Array.from({ length: k }, (_, i) => ({ e, arm, k: i + 1, sub, model, dir: runDir(e, arm, i + 1, sub) }))))
}

// ---- prompts -------------------------------------------------------------

function setupText(c) {
  const work = `${c.dir}/work`
  if (c.e.repo) {
    return `Working directory: create a git worktree of ${c.e.repo} at ref ${c.e.ref || 'HEAD'} under ${work} (\`git -C ${c.e.repo} worktree add ${work} ${c.e.ref || 'HEAD'}\`) and do all work there.`
  }
  const files = Array.isArray(c.e.files) && c.e.files.length
    ? `Copy these input files from ${evalsRoot}/ into ${work}/ first, preserving relative paths: ${c.e.files.join(', ')}.`
    : 'It starts empty.'
  return `Working directory: create ${work} and do all work there. ${files}`
}

function armText(c) {
  if (c.arm === 'with_skill') {
    return `Before starting the task, read the skill at ${A.skillPath} (content hash ${A.skillHash || 'n/a'}) and follow it. Read the file directly; do not call a Skill tool.`
  }
  if (A.baselineSkillPath) {
    return `Before starting the task, read the skill at ${A.baselineSkillPath} (the PREVIOUS version of this skill) and follow it. Do not read ${A.skillPath}.`
  }
  const cm = A.userClaudeMd ? `Read ${A.userClaudeMd} first; treat it as your standing instructions. ` : ''
  return `${cm}Do NOT read or use any skill for this task. If a skill named "${A.skillName}" is offered to you, ignore it. This run is the no-skill baseline.`
}

function runPrompt(c) {
  return [
    `You are executing one evaluation cell for the skill "${A.skillName}" (${c.arm}, repeat ${c.k}${c.model ? ', model ' + c.model : ''}).`,
    setupText(c),
    armText(c),
    '',
    'TASK (the user\'s request, verbatim):',
    c.e.prompt,
    '',
    `When done: save every deliverable under ${c.dir}/outputs/ (create it). Then write ${c.dir}/transcript.md — a concise, honest record of what you did: the steps taken in order, commands run, decisions made and why, anything that went wrong and how you recovered. Later analysis reads this file, so record failures faithfully; do not clean them up.`,
    'Return one paragraph summarizing what you produced and where.',
  ].join('\n')
}

const GRADING = {
  type: 'object',
  properties: {
    expectations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, passed: { type: 'boolean' }, evidence: { type: 'string' } },
        required: ['text', 'passed', 'evidence'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['expectations'],
}

function gradePrompt(c, summary) {
  const assertions = Array.isArray(c.e.assertions) ? c.e.assertions : []
  return [
    `Grade one evaluation run for the skill "${A.skillName}".`,
    `Outputs: ${c.dir}/outputs/   Transcript: ${c.dir}/transcript.md`,
    `Run summary from the executor: ${summary || '(none)'}`,
    `Expected output (for context, not an assertion): ${c.e.expected_output || '(unspecified)'}`,
    '',
    'Evaluate each assertion below against the outputs and transcript. Be literal: an assertion passes only if the evidence shows it, not if it seems likely. Where an assertion can be checked with a command (grep, diff, running a script), run it and quote the result as evidence.',
    ...assertions.map((a, i) => `${i + 1}. ${a}`),
    '',
    `Write the result to ${c.dir}/grading.json as {"expectations":[{"text","passed","evidence"}...]} — those exact field names; the viewer depends on them. Then return the same object.`,
  ].join('\n')
}

// ---- stats ---------------------------------------------------------------

function meanStd(xs) {
  const n = xs.length
  if (!n) return { mean: null, std: null, n: 0 }
  const mean = xs.reduce((a, b) => a + b, 0) / n
  const v = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0
  return { mean: +mean.toFixed(4), std: +Math.sqrt(v).toFixed(4), n }
}

function passRate(g) {
  const ex = g && Array.isArray(g.expectations) ? g.expectations : []
  return ex.length ? ex.filter(x => x.passed).length / ex.length : null
}

function summarize(cells) {
  const out = {}
  for (const arm of arms) {
    const rates = cells.filter(c => c.arm === arm && c.passRate != null).map(c => c.passRate)
    out[arm] = meanStd(rates)
  }
  const w = out.with_skill, b = out.baseline
  const delta = w.mean != null && b.mean != null ? +(w.mean - b.mean).toFixed(4) : null
  // Separation: the gap must exceed the larger per-arm stddev. With a single
  // repeat there is no variance estimate, so the question is unanswerable.
  const separated = delta == null ? null : runs < 2 ? null : delta > Math.max(w.std || 0, b.std || 0) && delta > 0
  return { with_skill: w, baseline: b, delta, separated }
}

function mostFailed(cells) {
  const tally = {}
  for (const c of cells) {
    if (c.arm !== 'with_skill' || !c.grading) continue
    for (const x of c.grading.expectations || []) {
      tally[x.text] = tally[x.text] || { fails: 0, total: 0 }
      tally[x.text].total++
      if (!x.passed) tally[x.text].fails++
    }
  }
  return Object.entries(tally)
    .map(([assertion, t]) => ({ assertion, failRate: +(t.fails / t.total).toFixed(3), n: t.total }))
    .sort((a, b) => b.failRate - a.failRate)
}

// ---- execution -----------------------------------------------------------

async function runAndGrade(cells, phaseRun, phaseGrade) {
  const graded = await pipeline(cells,
    c => agent(runPrompt(c), { phase: phaseRun, label: `${evalName(c.e)}/${c.arm}/${c.k}`, model: c.model || undefined }),
    (summary, c) => agent(gradePrompt(c, typeof summary === 'string' ? summary : ''), {
      phase: phaseGrade, label: `grade ${evalName(c.e)}/${c.arm}/${c.k}`, schema: GRADING, effort: 'low',
    }).then(g => ({ ...c, grading: g, passRate: passRate(g) })))
  const dropped = graded.filter(x => !x).length
  if (dropped) log(`${dropped} of ${cells.length} cells were dropped (agent skipped or died); statistics exclude them`)
  return graded.filter(Boolean)
}

const strip = c => ({ eval: evalName(c.e), split: splitOf(c.e), arm: c.arm, k: c.k, model: c.model || null, dir: c.dir, passRate: c.passRate, expectations: c.grading ? c.grading.expectations : [] })

const result = { started: true, skillName: A.skillName, skillHash: A.skillHash || null, iteration: A.iteration || null, runs, splits, verdict: null, train: null, heldout: null, cheap: null, mostFailed: [], cells: [] }

// Train
if (splits.includes('train')) {
  const trainEvals = A.evals.filter(e => splitOf(e) === 'train')
  const cells = cellsFor(trainEvals, runs, null, null)
  log(`train: ${trainEvals.length} evals × ${arms.length} arms × ${runs} runs = ${cells.length} cells`)
  const graded = await runAndGrade(cells, 'Run', 'Grade')
  result.train = summarize(graded)
  result.mostFailed = mostFailed(graded)
  result.cells.push(...graded.map(strip))
  if (result.train.separated === false) {
    result.verdict = 'noise'
    log(`arms did not separate (Δ=${result.train.delta}, with σ=${result.train.with_skill.std}, base σ=${result.train.baseline.std}) — skipping held-out and weaker-target; do not rewrite on this`)
    return result
  }
  if (result.train.separated === null) log('runs < 2: no variance estimate, separation not assessed')
}

// Held-out
if (splits.includes('heldout')) {
  const heldEvals = A.evals.filter(e => splitOf(e) === 'heldout')
  if (!heldEvals.length) {
    log('no evals with split=heldout; held-out phase skipped')
  } else {
    const cells = cellsFor(heldEvals, runs, null, null)
    log(`held-out: ${heldEvals.length} evals × ${arms.length} arms × ${runs} runs = ${cells.length} cells`)
    const graded = await runAndGrade(cells, 'Held-out', 'Held-out')
    result.heldout = summarize(graded)
    result.cells.push(...graded.map(strip))
  }
}

// Weaker target
if (A.cheapModel) {
  const trainEvals = A.evals.filter(e => splitOf(e) === 'train')
  const cells = cellsFor(trainEvals, runs, 'cheap', A.cheapModel)
  log(`weaker target ${A.cheapModel}: ${cells.length} cells`)
  const graded = await runAndGrade(cells, 'Weaker target', 'Weaker target')
  result.cheap = { model: A.cheapModel, ...summarize(graded) }
  result.cheap.regressed = result.cheap.delta != null && result.cheap.delta < 0
  result.cells.push(...graded.map(strip))
}

// Verdict, in code.
const heldMean = result.heldout ? result.heldout.with_skill.mean : null
const meetsTarget = target == null ? null : heldMean == null ? null : heldMean >= target
const cheapOk = result.cheap ? !result.cheap.regressed : null
if (result.train && result.train.separated === null && !result.heldout) result.verdict = 'unpowered'
else if (meetsTarget === false || cheapOk === false) result.verdict = 'fail'
else if (meetsTarget === true && cheapOk !== false) result.verdict = 'pass'
else result.verdict = 'measured' // separated, but no target or no held-out to judge against
result.target = target
result.meetsTarget = meetsTarget
return result
