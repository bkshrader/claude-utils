---
description: Propose bounded skill edits from eval failures and accept only what beats the incumbent on held-out
argument-hint: <name> [--candidates N] [--rounds R] [--budget L]
---

Run SkillOpt's propose-and-gate loop on skill `$1` at small scale. Failure
and success analysts read the last iteration's transcripts and propose
bounded add/insert/replace/delete edits; each candidate is applied to a copy,
scored on the train split, and the best one replaces the incumbent only if
it *strictly* beats it on the held-out split. Ties and losses go into a
rejected-edit buffer that the next round's analysts see, so the loop stops
re-proposing what already failed.

Checkout root (this command refuses to run elsewhere):

!`bash -c '. ${CLAUDE_PLUGIN_ROOT}/scripts/common.sh && require_claude_utils'`

State:

!`bash -c 'S=plugins/$1/skills/$1/SKILL.md; if [ -f "$S" ]; then echo "skill hash=$(bash ${CLAUDE_PLUGIN_ROOT}/scripts/skill-hash.sh $S) tokens≈$(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/token-count.py $S)"; else echo "missing: $S"; fi; grep -cE "^- \[x\]" evals/$1/acceptance.md 2>/dev/null | sed "s/^/checked assertions: /"; grep -E "^\`___\`" evals/$1/acceptance.md >/dev/null 2>&1 && echo "target: UNSET"; python3 -c "import json;e=json.load(open(\"evals/$1/evals.json\"))[\"evals\"];print(f\"train={sum(1 for x in e if x.get(\"split\",\"train\")==\"train\")} heldout={sum(1 for x in e if x.get(\"split\")==\"heldout\")}\")" 2>/dev/null; ls -d evals/$1/workspace/iteration-* 2>/dev/null | sort -V | tail -1; [ -f evals/$1/rejected.json ] && python3 -c "import json;print(f\"rejected buffer: {len(json.load(open(\"evals/$1/rejected.json\")))} entries\")"; true'`

## Preconditions — all required

- `Kind` is `checkable` and at least one assertion is checked. With no
  mechanical gate this loop is automated drift; refuse.
- Target is set.
- At least 2 evals with `split: heldout`. The gate needs a split the
  analysts never see; without one, accepting an edit because it fixed the
  failures it was written from is circular.
- A prior iteration exists with transcripts on disk (the analysts read them).

Defaults: `--candidates 3`, `--rounds 1`, `--budget 4` (SkillOpt's default
edit budget; its headline gains came from 1–4 accepted edits total).

## Run

Read the incumbent `SKILL.md` and `evals/$1/rejected.json` (if any).

**Preferred — Workflow orchestration.** If the Workflow tool is available
(this invocation authorizes it):

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/optimize.js",
  args: {
    skillName: "$1",
    skillPath: "<absolute SKILL.md>",
    skillContent: "<file contents>",
    skillHash: "<hash>",
    evalScript: "${CLAUDE_PLUGIN_ROOT}/workflows/eval.js",
    evalsRoot: "<absolute evals/$1>",
    evals: <evals array>,
    runs: <K from the last iteration's results.json>,
    candidates: N, rounds: R, budget: L,
    lastIteration: "<absolute workspace/iteration-N>",
    workspace: "<absolute evals/$1/workspace/optimize-<N+1>>",
    rejected: <rejected.json contents or []>,
    tokenBudget: <from acceptance.md>,
    userClaudeMd: "<absolute ~/.claude/CLAUDE.md or null>"
  }
})
```

Per round it scores the incumbent on held-out (once), runs failure and
success analysts over the last iteration's transcripts with SkillOpt's
prompt contracts, merges failure-first, ranks and clips to the budget to
form N candidates with different emphases, applies each in code, has one
agent write the candidate files, scores each candidate on held-out via the
eval workflow, and accepts the best only if strictly greater. It returns the
accepted content (or null) and the rejected edits with their score deltas.

**Fallback** (no Workflow tool): don't. This loop is the part of skill-forge
that only makes sense automated; by hand it is `/skill-forge:eval` plus your
own judgment, which is fine — say so and stop.

## Apply

- Accepted: write the returned content to `SKILL.md` with Edit (never a
  full-file Write — show the diff), append the round's rejects to
  `evals/$1/rejected.json`, and report the held-out delta and the edits that
  landed, quoting each. If the body now exceeds the token budget, say so
  loudly; the gate doesn't check size.
- Rejected: append to `rejected.json`, report each candidate's delta, and
  say plainly that the incumbent stands. Three consecutive rejected rounds
  means the assertions or the evidence need attention, not more rounds.

Never run `--rounds` above 3 in one invocation without the user asking; the
cost is candidates × held-out evals × runs agent calls per round.
