---
description: Mine transcripts for a tag's failure mechanisms; draft evidence, seed evals, and acceptance criteria
argument-hint: <tag> [--name <skill-name>]
---

Turn the captures tagged `$1` into the three files a new skill is authored
from: `evals/<name>/evidence.md`, a seed `evals.json`, and a draft
`acceptance.md`. Everything in them cites the capture or transcript it came
from — SkillLens found that what predicts a skill's utility is concrete
failure mechanisms with executable remedies, and the only place those exist
is in the sessions where the failure happened.

Checkout root (this command refuses to run elsewhere):

!`bash -c '. ${CLAUDE_PLUGIN_ROOT}/scripts/common.sh && require_claude_utils'`

Inbox state:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/triage.py --json`

## Step 1 — Scope

From the JSON above, take the cluster whose `tag` is `$1`. If there is none,
say so and stop. The skill name is `$1` unless `--name` was given. Read each
capture file listed under `files`. For each distinct `project`, compute the
transcript directory with `transcript_dir_for` from
`${CLAUDE_PLUGIN_ROOT}/scripts/common.sh` (it is
`~/.claude/projects/<project path with / replaced by ->/`); note which exist.

If `evals/<name>/evidence.md` already exists, this is a re-mine: read it
first and tell the workflow to extend rather than restart.

## Step 2 — Mine

**Preferred — Workflow orchestration.** If the Workflow tool is available
(this invocation authorizes it):

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/mine.js",
  args: {
    tag: "$1",
    skillName: "<name>",
    captures: [ { file, project, captured_at, note, prompt, what_went_wrong, what_fixed_it }, ... ],
    transcriptHome: "<absolute path of ~/.claude/projects>",
    transcriptDirs: [ "<existing transcript dir>", ... ],
    existingEvidence: "<path or null>"
  }
})
```

It runs one extractor per capture (locates the matching session by
`captured_at` and the prompt text, extracts failure mechanisms and success
patterns with turn citations), one sweeper per transcript directory (looks
for the same pattern in sessions nobody captured — by keyword, by
user-correction phrases like "no, actually", "that's wrong", and by repeated
tool errors), then consolidates with SkillLens's merge rules (dedupe,
generalize, keep success and failure separate, drop vague) and drafts
acceptance criteria. It returns structured data; it writes nothing.

**Fallback** (no Workflow tool): do the same by hand with subagents — one
Explore agent per capture and per transcript directory, then consolidate
yourself using `${CLAUDE_PLUGIN_ROOT}/skills/authoring/references/evidence-format.md`
as the target shape.

## Step 3 — Write the three files

Load the `skill-forge:authoring` skill. Create `evals/<name>/` and write:

1. `evidence.md` — from the workflow's `evidence`, in the format of
   `references/evidence-format.md`. Include the `Not evidence` section; it
   stops the next mine from re-reading excluded sessions.
2. `evals.json` — from `seeds`: one eval per real phrasing, `assertions`
   empty, `split` unset. Schema in `references/evals-schema.md`. These are
   drawn from how the user actually asked, not invented.
3. `acceptance.md` — from `acceptance`, following
   `references/acceptance-template.md`. Every assertion carries its
   citation; the ones the workflow flagged `uncited` are marked so. The
   pass-rate target stays `___`.

Add `evals/<name>/workspace/` to `.gitignore` if not already covered.

## Step 4 — Report

Show the user: how many mechanisms with how much recurrence, how many
phrasings seeded, and the acceptance draft. Tell them the next step is
`/skill-forge:new <name>`, which will not proceed to eval until they have
checked the assertions they agree with. Don't check any yourself.
