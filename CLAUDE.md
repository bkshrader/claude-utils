# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

`claude-utils` is a **Claude Code plugin marketplace** — a personal collection of Claude Code
patterns (commands, agents, skills, hooks, MCP servers) that get reused across unrelated
projects. Anything worth copy-pasting into a second project belongs here as a plugin instead.

The repo is greenfield: most of the structure below is convention to follow when adding
content, not code that already exists.

## Layout

```
.claude-plugin/marketplace.json   # marketplace manifest — the registry of plugins
plugins/<plugin-name>/            # each plugin lives in its own directory
  .claude-plugin/plugin.json      # plugin manifest (name required; version/description/author)
  commands/                       # slash commands (*.md)
  agents/                         # subagents (*.md)
  skills/<skill-name>/SKILL.md    # skills
  hooks/hooks.json                # hook definitions
  .mcp.json                       # MCP servers
```

`commands/`, `agents/`, `skills/`, `hooks/hooks.json`, and `.mcp.json` are auto-discovered at
those paths — they only need to be declared in `plugin.json` when placed somewhere else.

## Conventions

- Every plugin added under `plugins/` must also be registered in the `plugins` array of
  `.claude-plugin/marketplace.json`. A plugin that exists on disk but not in the manifest is
  invisible to `/plugin`. For plugins living in this repo, use
  `"source": "./plugins/<name>"`; external ones use a `git`/`git-subdir` source object.
- Inside plugin files, reference bundled assets via `${CLAUDE_PLUGIN_ROOT}` (absolute path to
  the plugin directory) rather than relative paths — the cwd at runtime is the *user's*
  project, not the plugin.
- Plugin names are the user-facing namespace (`/plugin-name:command-name`), so keep them
  short and kebab-case.

## Working on this repo

The `plugin-dev` plugin is installed and is the right tool for most work here — prefer its
skills (`plugin-dev:plugin-structure`, `command-development`, `agent-development`,
`hook-development`, `mcp-integration`, `skill-development`) and the
`plugin-dev:plugin-validator` agent over hand-writing manifests from memory.

To test changes locally without publishing, add this checkout as a marketplace:
`/plugin marketplace add /home/bkshrader/Projects/claude-utils`, then install from it.
Run `/reload-plugins` after editing plugin files to pick up changes.

There is no build, lint, or test tooling — plugins are declarative markdown and JSON.
Validation is `plugin-dev:plugin-validator` plus actually loading the plugin.
