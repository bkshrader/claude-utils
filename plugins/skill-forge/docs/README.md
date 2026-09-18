# Vendored papers

The two papers `skill-forge` is built on. Both are Microsoft Research work on
treating a skill document as a measurable, optimizable artifact rather than
hand-written prose.

| File | Paper | License | Committed |
| --- | --- | --- | --- |
| `2605.23899-skilllens.pdf` | *From Raw Experience to Skill Consumption: A Systematic Study of Model-Generated Agent Skills* (SkillLens) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | yes |
| `2605.23904-skillopt.pdf` | *SkillOpt: Executive Strategy for Self-Evolving Agent Skills* | [arXiv non-exclusive-distrib 1.0](https://arxiv.org/licenses/nonexclusive-distrib/1.0/) | **no** — gitignored |

The arXiv non-exclusive license grants arXiv the right to distribute; it does
not grant anyone else redistribution rights. The SkillOpt PDF is therefore kept
locally but not committed, the same way the ASD-STE100-derived files under
`evals/ste/` are handled. Re-fetch either paper with:

```bash
plugins/skill-forge/docs/fetch-papers.sh
```

## What skill-forge takes from each

**SkillLens** supplies the authoring standard and the warnings. Its three
validated quality dimensions — failure-mechanism encoding, actionable
specificity, and a high-risk action blacklist — are the rubric the authoring
skill applies. Its negative findings shape the harness: an LLM judge picks the
better-performing of two skills only 46.4% of the time (below chance), surface
format has no measurable effect (paired test, p > 0.34), 25% of skill/target
pairs suffer negative transfer, and utility is strongly target-dependent. The
rubric itself ships in the SkillLens repo as
`data/meta_skills/quality_rubric_3dim.md` (MIT) and is vendored verbatim at
`skills/authoring/references/skilllens-rubric.md`. The optimizer prompt
contracts in `workflows/optimize.js` are adapted from SkillOpt's Appendix C.2.

**SkillOpt** supplies the optimization discipline: a held-out validation gate
that accepts a candidate only when it strictly improves, a bounded edit budget
(the "textual learning rate"), and a rejected-edit buffer so the optimizer
stops re-proposing directions that failed. `skill-forge`'s `eval` and
`optimize` workflows apply those controls by hand at small scale; a skill with a
fully mechanical scorer can graduate to SkillOpt proper.

## Project pages

- SkillLens: <https://microsoft.github.io/SkillLens/> · <https://github.com/microsoft/SkillLens>
- SkillOpt: <https://microsoft.github.io/SkillOpt/> · <https://github.com/microsoft/SkillOpt>

## Citations

```bibtex
@article{huang2026skilllens,
  title   = {From Raw Experience to Skill Consumption: A Systematic Study of Model-Generated Agent Skills},
  author  = {Zisu Huang and Jingwen Xu and Yifan Yang and Ziyang Gong and Qihao Yang and Muzhao Tian and Xiaohua Wang and Changze Lv and Xuemei Gao and Qi Dai and Bei Liu and Kai Qiu and Xue Yang and Dongdong Chen and Xiaoqing Zheng and Chong Luo},
  journal = {arXiv preprint arXiv:2605.23899},
  year    = {2026},
  url     = {https://arxiv.org/abs/2605.23899}
}

@article{yang2026skillopt,
  title   = {SkillOpt: Executive Strategy for Self-Evolving Agent Skills},
  author  = {Yang, Yifan and Gong, Ziyang and Huang, Weiquan and Yang, Qihao and Zhou, Ziwei and Huang, Zisu and Li, Yan and Gao, Xuemei and Dai, Qi and Liu, Bei and others},
  journal = {arXiv preprint arXiv:2605.23904},
  year    = {2026},
  url     = {https://arxiv.org/abs/2605.23904}
}
```
