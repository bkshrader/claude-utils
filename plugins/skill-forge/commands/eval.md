---
description: Run the skill-forge eval harness on a skill (with/without, repeated runs, gated stats)
argument-hint: <name> [--runs K] [--heldout] [--cheap-model <id>] [--baseline old]
---

Measure skill `$1` against its own evals: paired with-skill and baseline
arms, K repeated runs per cell, statistical separation before anything else,
then held-out and weaker-target checks. The gate is arithmetic in the
workflow, not a model's opinion of which output reads better — that opinion
is right 46.4% of the time.

Checkout root (this command refuses to run elsewhere):

!`bash -c '. ${CLAUDE_PLUGIN_ROOT}/scripts/common.sh && require_claude_utils'`

Skill state:

!`bash -c 'S=plugins/$1/skills/$1/SKILL.md; [ -f "$S" ] && echo "skill: $S  hash=$(bash ${CLAUDE_PLUGIN_ROOT}/scripts/skill-hash.sh $S)  tokens≈$(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/token-count.py $S)" || echo "missing: $S"; [ -f evals/$1/evals.json ] && python3 -c "import json;d=json.load(open(\"evals/$1/evals.json\"));e=d[\"evals\"];print(f\"evals: {len(e)} total, {sum(1 for x in e if x.get(\"split\")==\"heldout\")} heldout, {sum(1 for x in e if x.get(\"assertions\"))} with assertions\")" || echo "missing: evals/$1/evals.json"; ls -d evals/$1/workspace/iteration-* 2>/dev/null | sort -V | tail -1 || echo "no prior iterations"'`

Acceptance:

!`bash -c 'grep -E "^## Kind|^\`(checkable|subjective)\`|^- \[[ x]\]|^Body ≤|^\`___\`|Baseline \(fill" evals/$1/acceptance.md 2>/dev/null || echo "missing: evals/$1/acceptance.md"'`

## Step 1 — Preconditions

- Missing skill or `evals.json` → stop and say which.
- No eval has assertions → stop; `/skill-forge:new` copies checked
  assertions in. Nothing to grade otherwise.
- Kind is `subjective` → run the arms and produce outputs for the user to
  read, but skip the gate; say so up front.
- Target is `___` and this is not the first iteration → stop: the target
  must be set after the baseline run, before iterating. Show the baseline
  numbers from `iteration-1/results.json` and ask for the target.
- Target is `___` and this *is* the first iteration → proceed; this run
  exists to produce the baseline.

Defaults: `--runs 3`; `--heldout` off unless the user thinks they're done;
`--cheap-model` from `acceptance.md`'s weaker-target line; `--baseline old`
means the baseline arm is the previous iteration's skill snapshot (for
re-evals after shipping — the installed copy can otherwise leak into the
baseline, so also disable the `$1` plugin in `/plugin` for the round).

## Step 2 — Run

Iteration N = highest existing + 1. Snapshot the skill to
`evals/$1/workspace/iteration-N/skill-snapshot/SKILL.md`.

**Preferred — Workflow orchestration.** If the Workflow tool is available
(this invocation authorizes it):

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/eval.js",
  args: {
    skillName: "$1",
    skillPath: "<absolute path to SKILL.md>",
    skillHash: "<hash>",
    baselineSkillPath: null | "<previous snapshot>",
    evalsRoot: "<absolute evals/$1>",
    evals: <the evals array from evals.json>,
    runs: K,
    includeHeldout: false | true,
    cheapModel: null | "<id>",
    workspace: "<absolute evals/$1/workspace/iteration-N>",
    iteration: N,
    target: <pass-rate target from acceptance.md, or null while unset>,
    userClaudeMd: "<absolute ~/.claude/CLAUDE.md, or null if absent>"
  }
})
```

It fans out one run agent per (eval × arm × k) — the with-skill arm is told
to read `SKILL.md` before starting, the baseline arm is told to read the
user CLAUDE.md and *not* any skill — then one grader per run with a
schema-validated `grading.json`, computes per-arm mean/stddev in code,
returns `verdict: noise` if the arms don't separate (do not rewrite on
noise), and only then runs held-out and weaker-target cells.

**Fallback** (no Workflow tool): spawn the run subagents yourself in one
turn — with-skill and baseline together, never sequentially — K per cell,
then grade with skill-creator's `agents/grader.md`, then compute the same
statistics with a script. It is slower and easier to get wrong; say so.

## Step 3 — Record

Write the workflow's return to `workspace/iteration-N/results.json` and a
`summary.md`: per-eval pass rates per arm with ± stddev, the verdict, and the
skill hash. Each run's `grading.json` is already on disk in skill-creator's
layout, so `aggregate_benchmark.py` and the eval viewer work if the user
wants them — offer, don't launch.

If this was the first iteration, fill the `Baseline` line in `acceptance.md`
and ask the user to set the target now.

## Step 4 — Say what it means

Three sentences, no more: whether the arms separated, whether the held-out
and weaker-target checks passed (if run), and the single most-failed
assertion, which is where the next edit goes. If the verdict is `noise`, the
next step is more runs or more evals, not a rewrite.
