# evidence.md format

Written by `/skill-forge:mine`; read by the authoring skill when drafting.
Modeled on SkillLens's contrastive analysis (Table 14): the higher-utility
skill named *domain-specific failure mechanisms* with *executable remedies*;
the lower one offered process-level directives. Record the former.

```markdown
# Evidence — <tag>

Sources: <n> captures across <projects>; sweep of <m> sessions in <dirs>.

## Failure mechanisms

### FM1 — <short name>
- **Condition:** <when this happens — the concrete trigger>
- **Mechanism:** <why it fails — the causal chain, not "it was wrong">
- **Observed:** <what the agent actually did, quoted or paraphrased from the transcript>
- **Remedy:** <the step-level fix that worked, or would have>
- **Blacklist:** <the pattern that looks right and reliably fails, if there is one>
- **Evidence:** `inbox/<file>.json`; `<project>` session `<uuid>` (turns <a>–<b>)
- **Recurrence:** <k> of <n> captures; <j> additional sessions in sweep

## Success patterns

### SP1 — <short name>
- **What worked:** <the strategy that led to success, transferable across tasks>
- **Evidence:** <as above>

## Real phrasings

Verbatim user prompts that led to the tagged problem, for eval seeding:

- "<prompt as typed>" — `<project>`
- "<prompt as typed>" — `<project>`

## Not evidence

Things that looked like the pattern but weren't, so nobody re-mines them:

- <session> — <why it was excluded>
```

Quality bar for each entry, from the SkillLens per-trajectory prompt: a
pattern is (1) transferable across a broad class of tasks, (2) actionable
enough to follow, (3) non-obvious — beyond common sense, (4) self-contained —
understandable without the original trajectory. Drop entries that name a
specific file, identifier, or error string unless that string *is* the
mechanism.
