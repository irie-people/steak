# Changelog

## 0.2.0

- Conventional Commits and release-please for every project: `steak init --code` also writes the
  `commits` workflow (pull request titles and commits), `.github/conventional-commit.sh` (the same
  check as a commit-msg hook) and release-please's workflow, config and manifest.
- Steak releases with release-please, which keeps `VERSION` in `src/steak.ts`, `package.json` and
  this file in step.

## 0.1.0

- Automation with no LLM calls: `record` (merged PR to change, review, revert and vouch), `suggest`
  (heuristic size, or a local Ollama model with `--model`), `revenue` (Open Collective), `report`,
  `quarter`, `add`.
- Workflows: code repo `steak.yml`; stake repo `verify.yml` and `quarterly.yml`.
- `steak init`, `vendor`, `steak`, `compute`, `verify`, `selftest`, `version`.
- Policy changes reach only Steak earned after them (`[[before]]` in `stake.toml`), and `verify`
  recomputes each payout from the events, opt-outs and policy it recorded.
- Stake repo templates, MODEL.md, SPEC.md.
