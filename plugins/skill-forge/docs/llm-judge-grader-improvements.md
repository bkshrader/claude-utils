# Faster judges for skill-forge: a first look at System One models

*September 18, 2026 · exploratory notes, nothing implemented*

**A new kind of model built to give quick, structured answers could make
skill-forge's LLM-as-judge steps cheaper and more consistent. It also suggests
a new step: optimizing the grader before optimizing the skill. It's worth
watching, but not something to build on yet.**

---

## What arrived

TypeSafe AI [announced Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev),
the first of what it calls "System One models." Jev doesn't generate text. You
send it some content (the "state") and a set of typed questions, and it returns
structured answers with probabilities attached. The docs describe
[three question types](https://docs.typesafe.ai/primitives.md):

- **Noul:** a yes/no question. Returns the probability that the answer is yes.
- **Choice:** pick one option from a set. Returns a probability for each option.
- **Score:** rate content against 2–10 ordered levels that you describe. Returns
  a `score` that can fall between two levels (for example `1.3`), a probability
  for each level, and a separate `confidence` value.

TypeSafe's own claims: answers in 70–500 ms, about $0.042 per million input
tokens with free output, and a model that "can't hallucinate." That last claim
means the answer always matches the requested type. It doesn't mean the answer
is correct. TypeSafe measures accuracy by how closely Jev
agrees with frontier models (GPT-6 Astra, Fable 5.1), not against known right
answers. So at best, Jev is a faster, cheaper stand-in for a frontier judge, not
a better one.

Jev has no tools. It can't read files, run commands, or work in steps. The
docs say to ask it for
["a judgment a knowledgeable person makes in a second"](https://docs.typesafe.ai/primitives.md)
and to leave control flow in ordinary code.

## Where it fits in skill-forge

**The eval grader is the main target.** Today `eval.js` starts a new agent to
grade every run cell. The agent reads the outputs and transcript, runs `grep`
or `diff` where it can, and writes pass/fail for each assertion. The optimizer
calls `eval.js` for every candidate in every round, so it does the most
grading and has the most to gain.

Jev can't replace that agent directly, because it has no tools. It could fit
into a **grader script written once per skill**:

- **Deterministic checks first.** Anything a command can check (a file exists,
  a string matches, a test passes) stays in code.
- **An LLM judge only for what's left.** Assertions that need judgment become
  narrow Jev questions: a Noul for true-or-false checks, and a Score where a
  finer grade helps. A Score separates an output that barely passed from one
  that exceeded expectations. Probability alone can't do that: the
  [Noul docs](https://docs.typesafe.ai/primitives/noul.md) warn that "a value
  of 0.5 does not mean medium skill."
- **Split big judgments into small ones.** Their
  [composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md)
  pattern asks about each dimension separately and combines the answers with
  weights set in code. That matches how skill-forge assertions are already
  written.
- **Use confidence to escalate.** Low-[confidence](https://docs.typesafe.ai/confidence.md)
  answers go to an agent grader or to a person, so the judge doesn't have to
  force a confident answer on an unclear case.

A grader script like this is useful whichever model does the judging. A new
agent grading each cell can grade the same output differently each time, and
that noise ends up in the results. A mostly deterministic script removes most
of it. The cheaper and faster the judge, the easier it is to justify a script
where the judge handles everything code can't check.

**The mining sweep is a minor candidate.** `mine.js`'s Sweep phase checks
transcripts against failure patterns it already knows about, which is
technically a yes/no question for each pattern. But mining is meant to work
for any kind of skill, so writing a rubric for the sweep would almost
certainly cost more effort than it saves.

**Out of scope:** `/skill-forge:describe` has to measure whether *Claude*
triggers the skill, so no other model can stand in for it. `triage` is already
a plain script.

## A new step: optimize the grader first

If the grader is a script plus judge prompts, it can be optimized the same way
skill-forge optimizes a skill, on a smaller scale, **before** the skill
optimizer runs:

1. **Collect or generate labeled examples.** Real run outputs come first. When
   real data is thin, the agent generates synthetic outputs to make up the
   volume. This matters most for individuals and small teams, who may only
   have one or two people producing transcripts. SkillOpt's authors had
   thousands.
2. **Refine the grader together.** The agent and the user adjust the
   deterministic checks and judge questions until the user is happy with how
   the grader classifies the examples.
3. **Check on examples it wasn't tuned on.** A grader tuned until it agrees
   with your labels can no longer use those labels to measure its accuracy.
   Keep some labeled examples out of tuning, and use real outputs there when
   any exist, even just a few. Synthetic data made by the same agent tends to
   miss the unusual failures that real runs produce.
4. **Record the grader version.** Save a hash of the grader script and judge
   prompts next to the skill hash in each result. Otherwise a change to the
   grader could look like an improvement in the skill.

This step also answers the main objection to an LLM-written grader. The skill
optimizer exploits any flaw in whatever it scores against, so a grader nobody
checked is a real risk. A grader that has been reviewed and tested against
held-out labels before any skill iteration isn't.

The same step is the natural place to benchmark any judge model, Jev or
otherwise, **on your own data**. Past `grading.json` files already give a
reference set: replay them through the new grader and measure how often it
agrees.

### Open questions: the 32k input limit

[Jev accepts](https://docs.typesafe.ai/models.md) up to 32k tokens for the
state plus the longest question (64k per request in total). Agent transcripts
can go well past that. Questions to settle before building:

- How does the grader script decide which parts of a transcript matter for a
  given assertion?
- Can a long transcript be judged in chunks and the results combined
  deterministically, for example "passes if any chunk shows X" or "fails if
  any chunk shows Y"?
- If long transcripts must be summarized first, how much does the summary
  lower grading accuracy? Summarizing also brings back an unchecked LLM step
  before the judge.

## What it would actually save

Grading is a small part of an eval's cost. The run agents cost the most, and
there's no way around running them. A judge that's 40–200× faster wouldn't
make one `/skill-forge:eval` much cheaper. The saving adds up in the optimizer,
which grades many times per round. The bigger benefits are consistency (a
script grades the same output the same way every time) and a finer grade from
Score. A local open-weights judge would make the cost case stronger by
removing per-call pricing entirely.

## Watch this space

Nothing here is ready to build:

- **Access.** Jev is in early access, and I don't have it. The docs warn that
  [rate limits](https://docs.typesafe.ai/models.md) "can change without notice"
  while TypeSafe scales up.
- **Independent results.** Every accuracy figure so far comes from TypeSafe,
  measured by agreement with frontier models. Look for third-party benchmarks
  once early access ends.
- **Competitors.** If the approach works, other labs will likely copy it,
  maybe better or cheaper. An **open-weights** model with the same design
  would allow a fully local grader and remove the vendor dependency.
- **Design for swapping.** Whatever gets built, put the judge behind a small
  interface with a Claude fallback, so the choice of backend stays open.

---

**Sources:** [Introducing System One models and Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) ·
[TypeSafe documentation index](https://docs.typesafe.ai/llms.txt) ·
SkillOpt and SkillLens papers: see [README.md](README.md) in this directory.
