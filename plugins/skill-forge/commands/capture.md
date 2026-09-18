---
description: Record a recurring problem for later skill authoring
argument-hint: <tag> [note]
allowed-tools: Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/capture.sh:*), Read, Edit
---

Record that the problem tagged `$1` just happened here, so `claude-utils` can
decide later whether it recurs often enough to deserve a skill. Keep this to
under a minute of the user's time: no interview, no questions unless the tag
is missing.

Capture file created:

!`bash ${CLAUDE_PLUGIN_ROOT}/scripts/capture.sh $ARGUMENTS`

Now fill in the three empty fields of that JSON file from the conversation
you are in — that context is the reason this is a command and not a hook:

- `prompt`: the user's request, verbatim, that led to the problem. If several
  turns were involved, the one that started it.
- `what_went_wrong`: what Claude actually did, concretely — the mechanism, not
  "it was wrong." Two or three sentences. Quote the failing output or command
  if it's short.
- `what_fixed_it`: the correction that worked, if one has happened yet.
  Otherwise leave empty; `/skill-forge:mine` will look for it in the
  transcript.

Use Edit on the file. Then tell the user in one line: the tag, the file
path, and that `/skill-forge:triage` in `claude-utils` will show how many
captures this tag has. Nothing else — they are in the middle of other work.

If `$1` is empty, ask for a kebab-case tag and stop.
