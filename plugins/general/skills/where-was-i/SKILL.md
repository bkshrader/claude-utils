---
name: where-was-i
description: This skill should be used when the user asks "where was I", "what was I working on", "catch me up", "remind me what I was doing", or otherwise wants to reorient after returning to a project following days or weeks away. Gathers recent conversation history, uncommitted work, and recent commits into a brief status summary with suggested next steps.
version: 0.1.0
---

# Where Was I

Reorient the user to a project they are returning to after time away. Gather evidence from
three required sources plus any optional ones, then give a brief summary and likely next steps.
Work from the current working directory as the project root.

## Required sources

### 1. Recent conversations

Claude Code stores session transcripts under
`~/.claude/projects/<encoded-cwd>/*.jsonl`, where `<encoded-cwd>` is the current working
directory's absolute path with every `/` (including the leading one) replaced by `-`. For
example `/home/user/Projects/foo` becomes `-home-user-Projects-foo`.

Locate that directory, sort transcripts by modification time, and read the 3 most recent
(excluding the current, still-open session). Skim each for what was being worked on, what
was decided, and any open threads or TODOs left at the end. If the directory does not exist
or has fewer than 3 other transcripts, use whatever is available and say so — do not treat
this as an error.

### 2. Uncommitted work

Check for a VCS in the project root:

- **Git** (most common — assume this unless evidence says otherwise): `git status` and
  `git diff` (plus `git diff --staged`) to see what's changed but not committed, and
  `git stash list` for stashed work.
- **Other VCS** (e.g. `.hg`, `.svn`, jj's `.jj`): use that tool's equivalent status/diff
  commands.
- **No VCS**: note that there's no version control and skip this source rather than
  guessing at file changes.

### 3. Recent commits by the user

Get the user's git identity with `git config user.email` (or `user.name` as fallback), then
run `git log --author=<identity> -n 5` to get the user's 5 most recent commits in this repo
(not just the 5 most recent commits overall). If the project uses a different VCS, use its
equivalent (e.g. `hg log -u <user> -l 5`). If there's no VCS or no commits by this user yet,
say so and skip this source.

## Optional sources

Beyond the three required sources, use judgment to check anything else likely to clarify
current status — for example a `TODO.md` or `CHANGELOG.md`, open issues/PRs if a GitHub or
similar remote is configured and tooling for it is available, CI status, or project-specific
memory/notes files. Do not treat any of these as required; skip what isn't available or
relevant rather than searching exhaustively.

## Output

Produce a brief, plain-language summary covering:

- What the user appears to have been working on recently (drawing on conversations + commits)
- The current state of any uncommitted or in-progress work
- 2-4 concrete, likely next steps, phrased as suggestions rather than instructions

Keep it tight — this is a reorientation aid, not a full report. Favor a few sentences and a
short bullet list of next steps over an exhaustive writeup. Flag clearly if any required
source was unavailable rather than silently omitting it.
