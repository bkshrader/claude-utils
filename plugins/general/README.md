# general

A grab-bag of small, generic skills that don't warrant their own plugin — the kind of thing
worth reusing across unrelated projects.

## Skills

- **where-was-i** — reorient after returning to a project following days or weeks away.
  Reads the 3 most recent Claude Code conversations for the current project, checks for
  uncommitted work, and pulls the user's 5 most recent commits, then gives a brief summary
  and likely next steps. Assumes git but degrades gracefully to another VCS or none.

## Install

```
/plugin marketplace add https://github.com/bkshrader/claude-utils
/plugin install general@claude-utils
```
