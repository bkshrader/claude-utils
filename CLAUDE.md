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
global/                           # NOT a plugin — see below
```

### `global/`

Files meant to be downloaded and placed by hand rather than installed through the plugin
system — most notably the user-scope `~/.claude/CLAUDE.md`. Nothing here is loaded by the
marketplace, so it is exempt from the plugin conventions below. Keep it that way: if
something *can* be a plugin, it belongs in `plugins/`.

### Plugin components

All of these are auto-discovered at the paths shown; they only need declaring in
`plugin.json` when placed elsewhere. Everything except `plugin.json` lives at the plugin
root — **not** inside `.claude-plugin/`.

| Component | Path | Notes |
| --- | --- | --- |
| Manifest | `.claude-plugin/plugin.json` | Optional. `name` required |
| Skills | `skills/<name>/SKILL.md` | Preferred way to ship instructions |
| Commands | `commands/*.md` | Flat-file skills; legacy — prefer `skills/` |
| Agents | `agents/*.md` | `hooks`, `mcpServers`, `permissionMode` frontmatter is blocked |
| Hooks | `hooks/hooks.json` | |
| MCP servers | `.mcp.json` | |
| LSP servers | `.lsp.json` | |
| Workflows | `workflows/` | |
| Output styles | `output-styles/` | |
| Themes | `themes/` | Experimental — declare under `experimental.themes` |
| Monitors | `monitors/monitors.json` | Experimental — declare under `experimental.monitors` |
| Executables | `bin/` | Added to the Bash tool's `PATH` while enabled |
| Settings | `settings.json` | Claude Code defaults; only `agent` + `subagentStatusLine` honored |

Manifest-only, no directory: `userConfig` (values prompted at enable time — the plugin's own
config, as opposed to `settings.json` which configures Claude Code), `channels`, and
`dependencies`.

There is no plugin-supplied `CLAUDE.md` at any scope — a `CLAUDE.md` at the plugin root is
ignored. To ship instructions, use a skill (loaded on demand) or a `SessionStart` hook
returning `hookSpecificOutput.additionalContext` (always on, costs context every session).

## Conventions

- Every plugin added under `plugins/` must also be registered in the `plugins` array of
  `.claude-plugin/marketplace.json`. A plugin that exists on disk but not in the manifest is
  invisible to `/plugin`. For plugins living in this repo, use
  `"source": "./plugins/<name>"`; external ones use a `git`/`git-subdir` source object.
- Inside plugin files, reference bundled assets via `${CLAUDE_PLUGIN_ROOT}` (absolute path to
  the plugin directory) rather than relative paths — the cwd at runtime is the *user's*
  project, not the plugin.
- The component path fields in `plugin.json` **replace** the default scan (`agents`,
  `commands`, `workflows`, `outputStyles`, `experimental.themes`) rather than adding to it.
  `skills` is the one exception — it adds to the default `skills/` scan.
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
