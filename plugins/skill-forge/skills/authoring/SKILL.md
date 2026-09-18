---
name: authoring
description: How to write a SKILL.md body that measurably helps, and where it lives in the claude-utils marketplace. Use this whenever drafting, writing, revising, rewriting, or reviewing a skill or SKILL.md for claude-utils, whenever /skill-forge:new or /skill-forge:optimize is running, and whenever the user says "write a skill", "author a skill", "improve this skill", "make this skill better", or "turn this into a skill" — even if they don't say "SKILL.md".
---

# Authoring skills for claude-utils

Two measured facts govern everything below. An LLM judge asked which of two
skills performs better picks correctly 46.4% of the time — below chance — and
gets *worse* as the real gap grows (SkillLens §5.2). Rewriting the same skill
into a different format has no measurable effect on outcomes (p > 0.34). So a
skill that reads well is no evidence, and restructuring is not improvement.
What predicts utility is concrete failure mechanisms with executable fixes.

## What the body must contain

Apply `references/skilllens-rubric.md` — three validated dimensions, each
independently predictive of downstream gain:

1. **Failure mechanism encoding.** Name the specific condition and the causal
   chain to failure. *"The API caps pages at 100 and the agent assumes page 1 is
   everything, silently dropping rows"* — not *"handle pagination carefully."*
2. **Actionable specificity.** Step-level procedures naming real objects,
   tools, files, and commands, executable without further interpretation.
3. **High-risk action blacklist.** Forbid the specific patterns that look
   correct and reliably fail, with the reason. Not "be careful with X."

The rubric's closing line is the bar: *a rough, narrow skill encoding one
domain-specific failure mechanism with an executable fix beats an elegant one
full of best practices.* When an iteration doesn't move the score, add a
mechanism; don't reorganize the headings.

What the trained artifacts in SkillOpt look like (§4.4) is the target shape:
300–2,000 tokens, procedural rather than instance-specific, every rule
naming a behavior the model doesn't apply on its own. Generic process advice
("verify results", "be systematic") is inert — cut it.

Explain the *why* behind a rule rather than shouting MUST; the model has
theory of mind and a reason generalizes where a bare prohibition doesn't.
The blacklist dimension is not in tension with this: it forbids a concrete
pattern *with its concrete failure*, which is a reason.

## Where evidence comes from

Write from `evals/<name>/evidence.md` when it exists (produced by
`/skill-forge:mine`), which lists failure mechanisms mined from real
transcripts with citations. Every rule in the body should trace to an
observed failure or an observed success. A rule with no evidence behind it is
a guess, and SkillLens found that all-failure evidence pools produce the
worst skills — include what *worked*, not only what broke.

## Where it lives

```
plugins/<name>/
├── .claude-plugin/plugin.json          name, description, version
└── skills/<name>/
    ├── SKILL.md                        ≤ ~500 lines; longer → references/
    └── references/                     loaded on demand
evals/<name>/
├── evidence.md                         mined failure mechanisms + citations
├── acceptance.md                       criteria; you approve each line
├── evals.json                          prompts + assertions (committed)
├── fixtures/                           inputs or minimal fixture repos
└── workspace/                          run artifacts (gitignored)
```

Register the plugin in `.claude-plugin/marketplace.json` (`"source":
"./plugins/<name>"`) or `/plugin` never sees it. Reference bundled assets by
`${CLAUDE_PLUGIN_ROOT}`; the runtime cwd is the user's project, not the
plugin. Plugin names are the user-facing namespace — short, kebab-case.

## Frontmatter

`name` and `description` are the only fields that matter for triggering, and
the description is the *entire* trigger mechanism — the body is invisible
until it fires. Claude under-triggers skills, so describe both what the skill
does and the concrete situations that should invoke it, including phrasings
that don't name the skill. All "when to use" text belongs here, none in the
body. `/skill-forge:describe` optimizes this field against held-out trigger
queries afterward; write a pushy first draft so it has something to work
with.

## Acceptance criteria

`evals/<name>/acceptance.md` follows `references/acceptance-template.md`.
Mine drafts it; the human approves it line by line. Assertions cite the
capture or transcript they came from — an uncited assertion is a plausible
invention, and everything downstream optimizes against assertions, so a wrong
one is gamed at machine speed. The pass-rate target is set *after* the first
baseline run and *before* iteration; pre-registration means not moving
goalposts mid-loop, not guessing blind.

## What not to do

- Don't judge a draft by reading it. Run `/skill-forge:eval`.
- Don't whole-document rewrite between iterations. Change a few things
  (SkillOpt's edit budget is 4 per step, and 1–4 accepted edits total
  produced its headline gains) so a regression is attributable.
- Don't accept an iteration that scores the same. SkillOpt's gate is
  strictly-greater; ties are rejects.
- Don't let the body drift past its token budget in `acceptance.md`. The body
  is a context tax on every trigger, including false ones.
