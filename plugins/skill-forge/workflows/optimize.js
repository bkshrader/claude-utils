export const meta = {
  name: 'skill-forge-optimize',
  description:
    'SkillOpt-style propose-and-gate: failure/success analysts → bounded edits → N candidates scored on held-out → accept only a strict improvement; rejects feed the next round',
  whenToUse:
    'Invoked by /skill-forge:optimize. Requires args {skillContent, skillPath, evalScript, evals, lastIteration, workspace, ...}. Returns accepted content or null plus the rejected-edit buffer; the calling session applies the edit to SKILL.md. Needs evals with split=heldout. Bare invocation returns started:false.',
  phases: [
    { title: 'Score incumbent', detail: 'held-out score of the current skill (cached across rounds when nothing changed)' },
    { title: 'Reflect', detail: 'failure analysts (one per candidate, different lens) + one success analyst over last iteration transcripts' },
    { title: 'Merge', detail: 'failure-first merge, rank, clip to the edit budget — one candidate each' },
    { title: 'Write candidates', detail: 'edits applied in code; one agent writes the files' },
    { title: 'Score candidates', detail: 'eval.js on held-out per candidate' },
  ],
}

const A = typeof args === 'string' ? (() => { try { return JSON.parse(args) } catch (e) { return null } })() : args
if (!A || typeof A !== 'object' || !A.skillContent || !A.evalScript || !Array.isArray(A.evals) || !A.lastIteration || !A.workspace) {
  log('optimize.js started without its required args — nothing to do')
  return { started: false, reason: 'no-args', next: 'Run /skill-forge:optimize <name> from the claude-utils checkout.' }
}

const N = Math.max(1, Number(A.candidates) || 3)
const R = Math.max(1, Number(A.rounds) || 1)
const L = Math.max(1, Number(A.budget) || 4)
const runs = Math.max(1, Number(A.runs) || 3)
const heldout = A.evals.filter(e => e.split === 'heldout')
const train = A.evals.filter(e => e.split !== 'heldout')
if (heldout.length < 2) {
  log(`only ${heldout.length} held-out evals; the gate needs a split the analysts never see`)
  return { started: false, reason: 'no-heldout', next: 'Mark at least 2 evals split: "heldout" in evals.json.' }
}

const rejected = Array.isArray(A.rejected) ? A.rejected.slice() : []
const tokens = s => Math.round(s.length / 4)

// ---- SkillOpt prompt contracts (arXiv:2605.23904, Appendix C.2), adapted ----

const RUBRIC = `Quality bar (SkillLens validated rubric): every edit must encode a specific failure mechanism with its causal chain, give a step-level procedure naming real objects/tools/commands, or blacklist a specific pattern that looks correct and reliably fails — with the reason. Generic process advice ("verify results", "be systematic") is inert; do not propose it.`

const EDIT_SCHEMA = {
  type: 'object',
  properties: {
    reasoning: { type: 'string' },
    edits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['append', 'insert_after', 'replace', 'delete'] },
          target: { type: 'string' },
          content: { type: 'string' },
          support_count: { type: 'integer' },
          source_type: { type: 'string', enum: ['failure', 'success'] },
        },
        required: ['op'],
      },
    },
  },
  required: ['reasoning', 'edits'],
}

const FAILURE_SCHEMA = {
  type: 'object',
  properties: {
    failure_summary: { type: 'array', items: { type: 'object', properties: { failure_type: { type: 'string' }, count: { type: 'integer' }, description: { type: 'string' } }, required: ['failure_type', 'count', 'description'] } },
    patch: EDIT_SCHEMA,
  },
  required: ['failure_summary', 'patch'],
}

const LENSES = [
  'Prioritize the single most prevalent failure pattern; propose the fewest edits that address it.',
  'Prioritize failures where the skill already has a rule that was not followed — strengthen or relocate that rule rather than adding new ones.',
  'Prioritize blacklist edits: patterns the agent used that looked correct and failed, forbidden with the concrete reason.',
  'Prioritize edits that replace vague guidance already in the skill with a concrete procedure.',
  'Prioritize edits that add missing verification steps the agent skipped before declaring success.',
]

function rejectedText() {
  if (!rejected.length) return ''
  const lines = rejected.slice(-12).map(r => `- round ${r.round} cand ${r.candidate} (Δ held-out ${r.delta}): ${(r.edits || []).map(e => `${e.op}${e.target ? ' @"' + String(e.target).slice(0, 40) + '"' : ''}`).join('; ')}`)
  return `\nREJECTED-EDIT BUFFER — these edits were tried and did not improve the held-out score. Do not re-propose them or near-variants; propose something the buffer does not cover:\n${lines.join('\n')}\n`
}

function failurePrompt(material, i) {
  return [
    'You are an expert failure-analysis agent for AI agent tasks.',
    `You will be given failed trajectories from an evaluation of the skill "${A.skillName}" and the current skill document. Identify the most important COMMON failure patterns across the batch and propose a concise set of skill edits.`,
    '',
    `Current skill: ${A.skillPath}`,
    `Failed runs (read each transcript.md and grading.json): ${material.failed.map(m => m.dir).join('\n  ') || '(none listed — read the with_skill run directories under ' + material.root + ' whose grading.json has any passed:false)'}`,
    '',
    '## Analysis process',
    '1. Read ALL transcripts in the batch.',
    '2. Identify the most prevalent, systematic failure patterns across them — not one-off mistakes.',
    '3. For each pattern, classify its failure type.',
    '4. Propose skill edits that address the COMMON patterns, not individual edge cases.',
    '5. Edits must be generalizable; do not hardcode task-specific values, file names, or error strings unless the string IS the mechanism.',
    '6. Only patch gaps in the skill; do not duplicate existing content.',
    '',
    `Lens for this proposal: ${LENSES[i % LENSES.length]}`,
    RUBRIC,
    rejectedText(),
    `Produce AT MOST ${L} edits, highest-impact first. Fewer is fine. Edit ops: append (content), insert_after (target = exact existing line or heading, content), replace (target = exact existing text, content), delete (target = exact existing text). Targets must be verbatim substrings of the current skill.`,
  ].join('\n')
}

function successPrompt(material) {
  return [
    'You are an expert success-pattern analyst for AI agents.',
    `You will be given successful trajectories from an evaluation of the skill "${A.skillName}" and the current skill document. Identify generalizable behavior patterns COMMON across the batch that are worth encoding — and, more importantly, existing rules that the successes relied on, so a later edit does not remove them.`,
    '',
    `Current skill: ${A.skillPath}`,
    `Successful runs: ${material.passed.map(m => m.dir).join('\n  ') || '(read the with_skill run directories under ' + material.root + ' whose grading.json is all passed:true)'}`,
    '',
    '## Rules',
    '- Only propose edits for patterns NOT already covered in the skill.',
    '- Focus on patterns that appear across MULTIPLE trajectories.',
    '- Prefer reinforcing existing sections over adding new top-level sections.',
    '- Be conservative: success-driven edits reinforce; they rarely add.',
    RUBRIC,
    `Produce AT MOST ${L} edits; an empty list is a normal answer. Same edit ops and verbatim-target rule as above. Also list, in reasoning, the existing rules the successes depended on.`,
  ].join('\n')
}

function mergePrompt(failurePatch, successPatch) {
  return [
    'You are a skill-edit coordinator performing the FINAL merge and ranking. You receive two patch groups:',
    '1. Failure-driven (corrective, high priority):',
    JSON.stringify(failurePatch, null, 2),
    '2. Success-driven (reinforcement, lower priority):',
    JSON.stringify(successPatch, null, 2),
    '',
    `Current skill: ${A.skillPath} — read it; every target must be a verbatim substring.`,
    '',
    'Merge guidelines:',
    '1. FAILURE PATCHES TAKE PRIORITY unless they directly conflict with a well-supported success pattern.',
    '2. Deduplicate: if a failure edit and a success edit cover the same point, keep the failure version.',
    '3. Preserve unique success insights not addressed by failure edits.',
    '4. Independence: no two edits may target the same text region.',
    '5. Drop any edit whose target is not a verbatim substring of the current skill (append needs no target).',
    '6. Never delete or replace a rule the success analyst said the successes depended on.',
    '',
    'Then RANK by: systematic impact (fixes many failures > one edge case) > complementarity (fills a gap, no duplication) > generality (principle > entity-specific) > actionability (concrete > vague).',
    `Return the top ${L} at most, in priority order, each with support_count and source_type. Keep the resulting skill body under ${A.tokenBudget || 'the existing'} tokens — prefer replace over append when the skill is near budget.`,
  ].join('\n')
}

// ---- apply edits in code ------------------------------------------------

function applyEdits(content, edits) {
  let out = content
  const applied = [], skipped = []
  for (const e of edits || []) {
    const t = e.target == null ? '' : String(e.target)
    const c = e.content == null ? '' : String(e.content)
    if (e.op === 'append') { out = out.replace(/\s*$/, '') + '\n\n' + c.trim() + '\n'; applied.push(e); continue }
    if (!t || out.indexOf(t) < 0) { skipped.push({ ...e, why: 'target not found verbatim' }); continue }
    const idx = out.indexOf(t)
    if (e.op === 'replace') out = out.slice(0, idx) + c + out.slice(idx + t.length)
    else if (e.op === 'delete') out = out.slice(0, idx) + out.slice(idx + t.length)
    else if (e.op === 'insert_after') {
      const lineEnd = out.indexOf('\n', idx + t.length)
      const at = lineEnd < 0 ? out.length : lineEnd
      out = out.slice(0, at) + '\n' + c + out.slice(at)
    } else { skipped.push({ ...e, why: 'unknown op' }); continue }
    applied.push(e)
  }
  return { content: out.replace(/\n{3,}/g, '\n\n'), applied, skipped }
}

const WRITE_SCHEMA = { type: 'object', properties: { written: { type: 'array', items: { type: 'string' } } }, required: ['written'] }

function evalArgs(skillPath, skillHash, workspace, splits) {
  return {
    skillName: A.skillName, skillPath, skillHash, evalsRoot: A.evalsRoot, evals: A.evals, runs, splits,
    workspace, userClaudeMd: A.userClaudeMd || null, target: null,
  }
}

function materialFrom(evalResult, root) {
  const cells = (evalResult && evalResult.cells) || []
  const w = cells.filter(c => c.arm === 'with_skill' && c.split === 'train')
  return { root, failed: w.filter(c => c.passRate != null && c.passRate < 1), passed: w.filter(c => c.passRate === 1) }
}

// ---- rounds -------------------------------------------------------------

let incumbent = { content: A.skillContent, path: A.skillPath, hash: A.skillHash || 'incumbent', heldout: null }
let material = { root: A.lastIteration, failed: [], passed: [] } // round 1 reads the last iteration from disk
let needIncumbentScore = true
const rounds = []
let accepted = null

for (let r = 1; r <= R; r++) {
  const ws = `${A.workspace}/round-${r}`
  phase('Score incumbent')
  if (needIncumbentScore) {
    const splits = r === 1 ? ['heldout'] : ['train', 'heldout']
    const res = await workflow({ scriptPath: A.evalScript }, evalArgs(incumbent.path, incumbent.hash, `${ws}/incumbent`, splits))
    incumbent.heldout = res && res.heldout ? res.heldout.with_skill.mean : null
    if (r > 1) material = materialFrom(res, `${ws}/incumbent`)
    needIncumbentScore = false
  }
  if (incumbent.heldout == null) { log('incumbent held-out score unavailable; cannot gate'); break }
  log(`round ${r}: incumbent held-out = ${incumbent.heldout}`)

  // Reflect: N failure analysts with distinct lenses, one success analyst, all concurrent.
  const [successPatch, ...failurePatches] = await parallel([
    () => agent(successPrompt(material), { phase: 'Reflect', label: 'success analyst', schema: EDIT_SCHEMA }),
    ...Array.from({ length: N }, (_, i) => () => agent(failurePrompt(material, i), { phase: 'Reflect', label: `failure analyst ${i + 1}`, schema: FAILURE_SCHEMA })),
  ])

  // Merge per candidate (pipeline: each candidate proceeds independently).
  const candidates = await pipeline(failurePatches.map((fp, i) => ({ fp, i })),
    ({ fp, i }) => fp ? agent(mergePrompt(fp.patch, successPatch || { reasoning: '', edits: [] }), { phase: 'Merge', label: `merge cand ${i + 1}`, schema: EDIT_SCHEMA }) : null,
    (merged, { i }) => {
      if (!merged) return null
      const edits = (merged.edits || []).slice(0, L)
      const ap = applyEdits(incumbent.content, edits)
      if (ap.skipped.length) log(`cand ${i + 1}: ${ap.skipped.length} edit(s) skipped — ${ap.skipped.map(s => s.why).join('; ')}`)
      if (!ap.applied.length || ap.content === incumbent.content) { log(`cand ${i + 1}: no effective change; dropped`); return null }
      return { i: i + 1, edits: ap.applied, content: ap.content, tokens: tokens(ap.content), path: `${ws}/cand-${i + 1}/SKILL.md` }
    })
  const live = candidates.filter(Boolean)
  // Dedupe identical candidates.
  const seen = new Set()
  const unique = live.filter(c => { if (seen.has(c.content)) return false; seen.add(c.content); return true })
  if (!unique.length) { rounds.push({ round: r, candidates: [], note: 'no viable candidates' }); log(`round ${r}: no viable candidates`); continue }

  phase('Write candidates')
  await agent([
    'Write the following files exactly as given (create directories as needed). Return the list of paths written.',
    ...unique.map(c => `\n=== ${c.path} ===\n${c.content}\n=== END ===`),
  ].join('\n'), { phase: 'Write candidates', label: `write ${unique.length} candidates`, schema: WRITE_SCHEMA, effort: 'low' })

  // Score candidates on held-out (each is a child eval workflow).
  const scored = await parallel(unique.map(c => () =>
    workflow({ scriptPath: A.evalScript }, evalArgs(c.path, `${incumbent.hash}+cand${c.i}r${r}`, `${ws}/cand-${c.i}`, ['heldout']))
      .then(res => ({ ...c, heldout: res && res.heldout ? res.heldout.with_skill.mean : null }))))
  const results = scored.filter(Boolean).map(c => ({ ...c, delta: c.heldout == null || incumbent.heldout == null ? null : +(c.heldout - incumbent.heldout).toFixed(4) }))

  // Gate: strictly greater, or reject. Ties are rejects (SkillOpt §4.2).
  const best = results.filter(c => c.delta != null).sort((a, b) => b.delta - a.delta)[0] || null
  const roundRec = { round: r, incumbentHeldout: incumbent.heldout, candidates: results.map(c => ({ i: c.i, path: c.path, tokens: c.tokens, heldout: c.heldout, delta: c.delta, edits: c.edits })) }
  if (best && best.delta > 0) {
    roundRec.accepted = best.i
    accepted = { round: r, content: best.content, edits: best.edits, heldout: best.heldout, delta: best.delta, tokens: best.tokens, overBudget: A.tokenBudget ? best.tokens > A.tokenBudget : null, path: best.path }
    for (const c of results) if (c.i !== best.i) rejected.push({ round: r, candidate: c.i, delta: c.delta, edits: c.edits })
    incumbent = { content: best.content, path: best.path, hash: `${incumbent.hash}+cand${best.i}r${r}`, heldout: best.heldout }
    needIncumbentScore = true // next round needs fresh train material for the new incumbent
    log(`round ${r}: accepted candidate ${best.i} (Δ held-out +${best.delta})`)
  } else {
    for (const c of results) rejected.push({ round: r, candidate: c.i, delta: c.delta, edits: c.edits })
    log(`round ${r}: no candidate strictly beat the incumbent (best Δ ${best ? best.delta : 'n/a'}); incumbent stands`)
  }
  rounds.push(roundRec)
}

return { started: true, skillName: A.skillName, accepted, rounds, rejected }
