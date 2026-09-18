---
description: Optimize a skill's frontmatter description against held-out trigger queries
argument-hint: <name>
---

Optimize the `description` field of skill `$1` — the only text Claude sees
when deciding whether to load the skill at all. The eval harness measures Δ
*given the skill was loaded*; real value is P(trigger) × Δ, so this is a
multiplier on everything `eval` measured, not a polish step.

This wraps `skill-creator`'s `run_loop.py`, which already does the right
thing: 60/40 train/held-out split of the queries, 3 runs per query through
`claude -p`, Claude proposes new descriptions from what failed, best picked
by **held-out** score.

Checkout root (this command refuses to run elsewhere):

!`bash -c '. ${CLAUDE_PLUGIN_ROOT}/scripts/common.sh && require_claude_utils'`

skill-creator location:

!`bash -c 'ls -d ~/.claude/plugins/cache/claude-plugins-official/skill-creator/*/skills/skill-creator 2>/dev/null | head -1 || echo "skill-creator not installed"'`

## Step 1 — Trigger queries

If `evals/$1/trigger-evals.json` exists, read it and ask whether to reuse or
extend. Otherwise write ~20 queries there, following skill-creator's
guidance exactly: realistic and specific (paths, names, casual phrasing,
typos), 8–10 should-trigger with different phrasings including ones that
never name the skill, 8–10 should-not-trigger that are **near misses**
sharing keywords but needing something else. Obviously irrelevant negatives
test nothing. Seed the positives from the `Real phrasings` section of
`evals/$1/evidence.md` — those are how the user actually asks.

Show the list and let the user edit before running. Bad queries produce bad
descriptions.

## Step 2 — Run

From the skill-creator directory above, in the background:

```bash
python -m scripts.run_loop \
  --eval-set <absolute evals/$1/trigger-evals.json> \
  --skill-path <absolute plugins/$1/skills/$1> \
  --model <the model id powering this session> \
  --max-iterations 5 --verbose
```

Tail it periodically and report which iteration it's on and the train /
held-out trigger rates.

## Step 3 — Apply

Take `best_description` from the JSON output. Show before/after and both
scores. Replace the `description` line in `SKILL.md` with Edit. If the
held-out trigger rate is below ~0.8, say so — a skill that fires 60% of the
time delivers 60% of its measured Δ — and suggest which negatives or
positives to add before another round.
