export const meta = {
  name: 'skill-forge-mine',
  description:
    'Mine Claude Code transcripts for a tag: one extractor per capture, one sweeper per project, SkillLens-style consolidation, then a draft of acceptance criteria — data only, no files written',
  whenToUse:
    'Invoked by /skill-forge:mine. Requires args {tag, skillName, captures[], transcriptDirs[]}. Returns {evidence, seeds, acceptance}; the calling session writes evidence.md, evals.json, acceptance.md. Bare invocation returns started:false.',
  phases: [
    { title: 'Extract', detail: 'one agent per capture: locate the session, pull failure mechanisms and success patterns with turn citations' },
    { title: 'Sweep', detail: 'one agent per transcript directory: the same pattern in sessions nobody captured' },
    { title: 'Consolidate', detail: 'dedupe, generalize, keep success/failure separate, drop vague' },
    { title: 'Acceptance', detail: 'draft assertions with citations, token budget, kind' },
  ],
}

const A = typeof args === 'string' ? (() => { try { return JSON.parse(args) } catch (e) { return null } })() : args
if (!A || typeof A !== 'object' || !A.tag || !Array.isArray(A.captures) || !A.captures.length) {
  log('mine.js started without its required args (tag, captures[]) — nothing to mine')
  return { started: false, reason: 'no-args', next: 'Run /skill-forge:mine <tag> from the claude-utils checkout.' }
}

const dirs = Array.isArray(A.transcriptDirs) ? A.transcriptDirs.filter(Boolean) : []

const PATTERN_QUALITY = `What counts as a pattern (SkillLens per-trajectory prompt): a behavior that is (1) transferable across a broad class of tasks, (2) actionable enough to follow, (3) non-obvious — beyond common sense, (4) self-contained — understandable without the original trajectory. Priority: domain-specific failure mechanisms with executable remedies over general advice. For a failure, name the concrete condition, the causal chain to failure, what the agent actually did, the remedy that worked or would have, and the pattern that looked right but failed (blacklist), if any. Do not record task-specific file names, identifiers, or error strings unless the string IS the mechanism.`

const PATTERNS = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    sessions: { type: 'array', items: { type: 'string' } },
    failure_mechanisms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }, condition: { type: 'string' }, mechanism: { type: 'string' }, observed: { type: 'string' },
          remedy: { type: 'string' }, blacklist: { type: 'string' }, evidence: { type: 'string' },
        },
        required: ['name', 'condition', 'mechanism', 'observed', 'remedy', 'evidence'],
      },
    },
    success_patterns: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, what_worked: { type: 'string' }, evidence: { type: 'string' } }, required: ['name', 'what_worked', 'evidence'] },
    },
    phrasings: { type: 'array', items: { type: 'object', properties: { prompt: { type: 'string' }, project: { type: 'string' } }, required: ['prompt', 'project'] } },
    excluded: { type: 'array', items: { type: 'object', properties: { session: { type: 'string' }, why: { type: 'string' } }, required: ['session', 'why'] } },
  },
  required: ['found', 'sessions', 'failure_mechanisms', 'success_patterns', 'phrasings', 'excluded'],
}

// Same derivation as scripts/common.sh:transcript_dir_for; the command passes
// transcriptHome as an absolute path so the subagent never has to expand '~'.
function transcriptDirFor(project) {
  return `${A.transcriptHome || '~/.claude/projects'}/${String(project).replace(/\//g, '-')}`
}

function extractPrompt(c) {
  return [
    `Mine one capture for the tag "${A.tag}" (skill "${A.skillName || A.tag}").`,
    'Capture record:',
    JSON.stringify(c, null, 2),
    '',
    `Transcripts for this project live in ${transcriptDirFor(c.project)}/ as *.jsonl, one file per session (the directory may not exist — then set found:false). Locate the session this capture came from: first by files modified within a few hours of captured_at (ls -lt), then by grepping for a distinctive phrase from the capture's prompt or note. Read the relevant turns — the user's request, what Claude did, any correction the user made, and how it was resolved. Read enough context to name the mechanism, not just the symptom.`,
    '',
    PATTERN_QUALITY,
    '',
    'Also record, verbatim, the user prompt(s) that led to the problem — these seed the eval set, so keep the user\'s actual phrasing including typos and casual wording. Cite evidence as "<session file> turns <a>–<b>". If the session cannot be found, say so in excluded and return what the capture record alone supports (mark evidence as "capture record only").',
  ].join('\n')
}

function sweepPrompt(dir, known) {
  return [
    `Sweep one transcript directory for the pattern tagged "${A.tag}" in sessions nobody captured.`,
    `Directory: ${dir}/ (*.jsonl, one per session). Skip these already-mined sessions: ${known.sessions.join(', ') || '(none)'}.`,
    '',
    'Search three ways, because one angle misses things:',
    `1. By keyword — terms from the tag and these known phrasings: ${known.phrasings.slice(0, 6).map(p => JSON.stringify(p)).join(', ') || '(none yet)'}.`,
    '2. By user correction — turns where the user pushes back ("no,", "that\'s wrong", "actually", "don\'t", "stop", "why did you") near those keywords.',
    '3. By repeated tool errors — the same command or edit failing more than once in a session.',
    `Known mechanisms so far (report additional occurrences of these AND new ones): ${known.mechanisms.join('; ') || '(none yet)'}.`,
    '',
    PATTERN_QUALITY,
    '',
    'Be strict about relevance: a session that merely mentions the keywords is not evidence; put it in excluded with the reason. Limit yourself to the 8 most relevant sessions. Cite as "<session file> turns <a>–<b>".',
  ].join('\n')
}

const EVIDENCE = {
  type: 'object',
  properties: {
    failure_mechanisms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }, condition: { type: 'string' }, mechanism: { type: 'string' }, observed: { type: 'string' },
          remedy: { type: 'string' }, blacklist: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } },
          recurrence: { type: 'string' },
        },
        required: ['name', 'condition', 'mechanism', 'observed', 'remedy', 'evidence', 'recurrence'],
      },
    },
    success_patterns: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, what_worked: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } } }, required: ['name', 'what_worked', 'evidence'] } },
    phrasings: { type: 'array', items: { type: 'object', properties: { prompt: { type: 'string' }, project: { type: 'string' } }, required: ['prompt', 'project'] } },
    not_evidence: { type: 'array', items: { type: 'object', properties: { session: { type: 'string' }, why: { type: 'string' } }, required: ['session', 'why'] } },
    summary: { type: 'string' },
  },
  required: ['failure_mechanisms', 'success_patterns', 'phrasings', 'not_evidence', 'summary'],
}

function consolidatePrompt(sets) {
  return [
    `You receive several pattern sets, each extracted from different sessions, for the tag "${A.tag}". Merge them into a single consolidated evidence set.`,
    A.existingEvidence ? `An earlier evidence file exists at ${A.existingEvidence}; read it and EXTEND it — keep its mechanism names stable where the same mechanism recurs.` : '',
    '',
    'Guidelines (SkillLens hierarchical consolidation):',
    '1. Deduplicate: if multiple patterns describe the same or overlapping behavior, combine into ONE stronger pattern with the best description and the union of citations.',
    '2. Generalize: raise the abstraction level to cover more scenarios; one well-generalized pattern beats several narrow ones.',
    '3. Preserve type: keep success and failure patterns separate; never convert between them.',
    '4. Preserve quality: drop vague or low-value patterns; keep concrete, actionable ones.',
    '5. Prioritize: when there are many, retain the most important and broadly applicable.',
    '6. Recurrence: for each mechanism, state how many captures and how many swept sessions show it (e.g. "3 of 4 captures; 2 further sessions in hds-svelte").',
    '',
    'Pattern sets:',
    JSON.stringify(sets, null, 2),
  ].filter(Boolean).join('\n')
}

const ACCEPTANCE = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['checkable', 'subjective'] },
    kind_rationale: { type: 'string' },
    assertions: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, citation: { type: 'string' }, uncited: { type: 'boolean' } }, required: ['text', 'uncited'] } },
    token_budget: { type: 'object', properties: { tokens: { type: 'integer' }, rationale: { type: 'string' } }, required: ['tokens', 'rationale'] },
    weaker_target_hint: { type: 'string' },
  },
  required: ['kind', 'kind_rationale', 'assertions', 'token_budget'],
}

function acceptancePrompt(evidence) {
  const dates = A.captures.map(c => c.captured_at).filter(Boolean).sort()
  const projects = Array.from(new Set(A.captures.map(c => c.project)))
  return [
    `Draft acceptance criteria for a skill named "${A.skillName || A.tag}" from this consolidated evidence. You are drafting; a human approves each line.`,
    JSON.stringify(evidence, null, 2),
    '',
    `Capture statistics: ${A.captures.length} captures across ${projects.length} project(s) (${projects.join(', ')}), first ${dates[0] || '?'}, last ${dates[dates.length - 1] || '?'}.`,
    '',
    'Rules:',
    '- kind: "checkable" if the failures were wrong outputs that a script or a literal reading could verify; "subjective" if they were style or judgment complaints. Explain.',
    '- assertions: one objectively checkable statement per failure mechanism, phrased so it reads clearly in a results viewer ("Derived store is unsubscribed on destroy", not "handles cleanup"). Each cites the mechanism\'s evidence. If you feel an assertion is needed that no evidence supports, include it with uncited:true — do not invent a citation.',
    '- token_budget: from the observed trigger rate. Estimate triggers/week from the capture dates and count, note that false triggers pay the same tax, and pick a body ceiling: roughly 600 tokens for daily-plus, 900 for weekly, 1500 for monthly. State the arithmetic.',
    '- weaker_target_hint: if the evidence shows which model was in use, say so; otherwise leave empty.',
    'Do NOT propose a pass-rate target; that is set after the baseline run.',
  ].join('\n')
}

// ---- execution -----------------------------------------------------------

phase('Extract')
const extracted = (await pipeline(A.captures,
  c => agent(extractPrompt(c), { phase: 'Extract', label: `capture ${String(c.file || c.captured_at || '').split('/').pop()}`, schema: PATTERNS }))).filter(Boolean)
const known = {
  sessions: extracted.flatMap(x => x.sessions || []),
  phrasings: extracted.flatMap(x => (x.phrasings || []).map(p => p.prompt)),
  mechanisms: extracted.flatMap(x => (x.failure_mechanisms || []).map(m => m.name)),
}
log(`extracted ${known.mechanisms.length} mechanism(s) from ${extracted.length}/${A.captures.length} captures`)

phase('Sweep')
const swept = dirs.length
  ? (await parallel(dirs.map(d => () => agent(sweepPrompt(d, known), { phase: 'Sweep', label: `sweep ${d.split('/').pop()}`, schema: PATTERNS })))).filter(Boolean)
  : []
if (!dirs.length) log('no transcript directories exist for these projects; sweep skipped')

phase('Consolidate')
const evidence = await agent(consolidatePrompt({ captures: extracted, sweep: swept }), { phase: 'Consolidate', label: 'consolidate', schema: EVIDENCE })
if (!evidence) return { started: true, tag: A.tag, evidence: null, reason: 'consolidation failed', extracted, swept }

phase('Acceptance')
const acceptance = await agent(acceptancePrompt(evidence), { phase: 'Acceptance', label: 'draft acceptance', schema: ACCEPTANCE })

const seeds = (evidence.phrasings || []).map((p, i) => ({ id: i + 1, prompt: p.prompt, project: p.project }))
return {
  started: true,
  tag: A.tag,
  skillName: A.skillName || A.tag,
  stats: { captures: A.captures.length, capturesFound: extracted.filter(x => x.found).length, sweptDirs: dirs.length, mechanisms: (evidence.failure_mechanisms || []).length, successPatterns: (evidence.success_patterns || []).length, phrasings: seeds.length },
  evidence,
  seeds,
  acceptance,
}
