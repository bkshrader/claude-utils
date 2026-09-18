#!/usr/bin/env bash
# Shared helpers for skill-forge command scripts. Source, don't execute.

SKILL_FORGE_HOME="${SKILL_FORGE_HOME:-$HOME/.claude/skill-forge}"
SKILL_FORGE_INBOX="$SKILL_FORGE_HOME/inbox"

# Print the claude-utils checkout root if cwd IS that root, else exit 2 with a
# message. Authoring commands use cwd-relative paths (plugins/<name>, evals/<name>)
# and edit the marketplace manifest, so being merely *inside* the checkout is
# not enough — from a subdirectory every path would silently resolve wrong.
require_claude_utils() {
  if [ -f "$PWD/.claude-plugin/marketplace.json" ] &&
     grep -q '"name": *"claude-utils"' "$PWD/.claude-plugin/marketplace.json"; then
    printf '%s\n' "$PWD"
    return 0
  fi
  local dir="$PWD" hint=""
  while [ "$dir" != "/" ]; do
    dir="$(dirname "$dir")"
    if [ -f "$dir/.claude-plugin/marketplace.json" ] &&
       grep -q '"name": *"claude-utils"' "$dir/.claude-plugin/marketplace.json"; then
      hint=" (you are in a subdirectory of it: cd $dir)"
      break
    fi
  done
  echo "skill-forge: this command only runs from the root of the claude-utils checkout — it uses paths relative to it and edits the marketplace manifest$hint." >&2
  exit 2
}

# Claude Code stores transcripts under ~/.claude/projects/<encoded cwd>/, where
# the encoding replaces every '/' with '-'. Given a project path, print its
# transcript directory (whether or not it exists).
transcript_dir_for() {
  local encoded
  encoded="$(printf '%s' "$1" | sed 's#/#-#g')"
  printf '%s\n' "$HOME/.claude/projects/$encoded"
}
