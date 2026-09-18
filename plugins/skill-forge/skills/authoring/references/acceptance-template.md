# Acceptance criteria — `<name>`

<!-- Drafted by /skill-forge:mine. Every line is a proposal until you check it.
     /skill-forge:new refuses to proceed to eval with unchecked assertions or
     an unset target. -->

## Kind

`checkable` | `subjective`

Rationale: <what fraction of captures were wrong outputs vs. style complaints>

## Assertions (approve each)

Each assertion cites the capture file or transcript it was derived from.
Uncited assertions are marked and should be dropped unless you can name the
failure they would have caught.

- [ ] <objectively checkable statement>    ← `inbox/<file>.json` | `<project> session <id>`
- [ ] <objectively checkable statement>    ← sweep: <n> sessions in <project>
- [ ] (uncited) <statement>                ← generic; keep or drop?

## Token budget

Body ≤ **<n>** tokens.

Rationale: ~<k> triggers/week observed across <projects>; at that rate every
100 tokens of body costs ~<m>k tokens of context per year. False triggers pay
the same tax.

## Pass-rate target on held-out

`___` — **unset**. Run `/skill-forge:eval <name>` once (baseline arm only is
fine) and set this before iterating. Not pre-registering it lets you tune
until the number looks good; setting it blind makes it arbitrary.

Baseline (fill after first run): with_skill `__` / baseline `__` / n = `__`

## Weaker-target check

Model: `<cheapest model you'd realistically use this skill with>`
Rule: must not regress its own baseline. SkillLens found negative transfer
concentrates on weaker consumers.

## Stop rule

Held-out target met **and** body within budget **and** weaker-target check
passes. Otherwise iterate; if three iterations fail to move held-out, stop
and reconsider whether the assertions measure what you want.
