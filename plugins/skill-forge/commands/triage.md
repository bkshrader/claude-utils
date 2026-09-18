---
description: Cluster the skill-forge inbox by tag and say what is worth mining
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/triage.py:*), Read
---

Show what has accumulated in the skill-forge inbox and which tags are worth a
mining run. This is deliberately shallow — the inbox has tags, project paths,
and one-line notes, not enough to draft anything. Its one job is answering
"is this recurring enough to spend `/skill-forge:mine` on."

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/triage.py`

Present the table as-is, then a recommendation per tag using this rule of
thumb, and say which rule fired:

- **mine** — 3+ captures, or 2+ distinct projects. Recurrence across
  projects is the bar `claude-utils` sets for a skill.
- **wait** — 1–2 captures in one project. Might be a project-local fix or a
  `CLAUDE.md` line, not a skill.
- **check the tag** — tags that look like spelling variants of each other
  (`svelte-store` / `svelte-stores`). Offer to merge by renaming the files.

If the user picks a tag, tell them to run `/skill-forge:mine <tag>` from the
`claude-utils` checkout. Don't run it for them from here — mine writes into
that repo.
