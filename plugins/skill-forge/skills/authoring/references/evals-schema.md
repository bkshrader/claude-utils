# evals.json and workspace layout

`skill-forge` reuses `skill-creator`'s schema so its grader, aggregator, and
viewer work unchanged, and adds three fields.

## `evals/<name>/evals.json`

```json
{
  "skill_name": "<name>",
  "evals": [
    {
      "id": 1,
      "name": "descriptive-kebab-name",
      "prompt": "the user's task, in their own phrasing",
      "expected_output": "what a correct result looks like",
      "files": ["fixtures/case-1/input.csv"],
      "assertions": [
        "Objectively checkable statement, readable in the viewer",
        "Another"
      ],
      "split": "train",
      "repo": null,
      "ref": null
    }
  ]
}
```

Added fields:

- `split` — `train` or `heldout`. Iterate against `train`; look at `heldout`
  only when you think you're done. Omit on a tiny set; `eval` treats missing
  as `train`.
- `repo` + `ref` — for cases that only reproduce in a real project. The run
  agent works in a git worktree of `repo` at `ref`. Machine-specific; mark
  the case as such in `name`.
- `files` are relative to `evals/<name>/`; fixture repos are directories
  under `fixtures/`.

## Workspace

```
evals/<name>/workspace/
└── iteration-<N>/
    ├── results.json                  written by /skill-forge:eval from the workflow's return
    ├── summary.md
    └── <eval-name>/
        ├── with_skill/run-<k>/outputs/
        ├── with_skill/run-<k>/grading.json
        ├── baseline/run-<k>/outputs/
        └── baseline/run-<k>/grading.json
```

`grading.json` uses skill-creator's exact field names — `expectations[]` with
`text`, `passed`, `evidence` — so `aggregate_benchmark.py` and the viewer can
read it. `run-<k>` directories are the layout that script's variance
statistics expect.

## Iteration numbering

`/skill-forge:eval` picks N = (highest existing iteration) + 1 and records
the skill's content hash in `results.json`. Two iterations with the same hash
are repeated measurements of the same skill, not progress.
