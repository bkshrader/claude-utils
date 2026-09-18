---
description: Scaffold a new skill plugin in claude-utils and draft it from evidence
argument-hint: <name>
---

Create the plugin for skill `$1` in this checkout, draft its `SKILL.md` from
the mined evidence, and register it. This is the one step where the skill's
content is written; `eval`, `optimize`, and `describe` only measure and edit
it afterward.

Checkout root (this command refuses to run elsewhere):

!`bash -c '. ${CLAUDE_PLUGIN_ROOT}/scripts/common.sh && require_claude_utils'`

Existing state for this name:

!`bash -c 'for p in plugins/$1 evals/$1/evidence.md evals/$1/acceptance.md evals/$1/evals.json; do [ -e "$p" ] && echo "exists: $p" || echo "missing: $p"; done'`

## Step 1 — Preconditions

- If `plugins/$1` exists, stop: this is a new-skill command. Point at
  `/skill-forge:eval` or `/skill-forge:optimize` for existing skills.
- If `evals/$1/evidence.md` is missing, say so and offer two paths: run
  `/skill-forge:mine <tag>` first (recommended — a skill drafted without
  evidence is the generic-advice failure mode), or continue with the
  `skill-creator` interview alone and no acceptance draft. Proceed only if
  the user picks one.

## Step 2 — Interview

Load the `skill-forge:authoring` skill and the `skill-creator:skill-creator`
skill. Run skill-creator's **Capture Intent** interview, seeded: read
`evidence.md` and `acceptance.md` first so the questions are "is FM2 really
the main failure?" rather than "what should this skill do?". The
"objectively verifiable?" question is already answered by `acceptance.md`'s
`Kind` line; confirm it rather than re-asking.

## Step 3 — Scaffold

```
plugins/$1/.claude-plugin/plugin.json      { "name": "$1", "version": "0.1.0", "description": "<one line>" }
plugins/$1/skills/$1/SKILL.md
```

Register in `.claude-plugin/marketplace.json`: append to `plugins` with
`"source": "./plugins/$1"`, the same description, `"version": "0.1.0"`, and
sensible `category`/`keywords`, matching the existing entries' shape. Edit
the JSON with a script, not by hand, so the array stays valid. Make sure
`evals/$1/workspace/` is gitignored.

## Step 4 — Draft

Write `SKILL.md` per the authoring skill: every rule traces to a mechanism or
success pattern in `evidence.md`; frontmatter description is pushy and names
the trigger situations; body within the token budget from `acceptance.md`.
Then read it once more with the rubric's three dimensions as the checklist
and cut anything that is process advice rather than a mechanism.

## Step 5 — Approval gate

Show the user `acceptance.md`. They must check the assertions they agree with
(or edit them) — do not check any yourself, and do not run `/skill-forge:eval`
on their behalf. When the boxes are checked, copy the checked assertions into
the matching evals in `evals.json` (match by the phrasing each assertion's
evidence came from; put unmatched ones on the eval whose prompt is closest),
and tell the user the next step is `/skill-forge:eval $1` to get the baseline
number that sets the target.

Run the `plugin-dev:plugin-validator` agent on `plugins/$1` before finishing.
