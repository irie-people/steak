# Changelog

## 0.1.0

- Automation with no LLM calls: `record` (merged PR to change, review, revert and vouch), `suggest`
  (heuristic size, or a local Ollama model with `--model`), `revenue` (Open Collective), `report`,
  `quarter`, `add`.
- Workflows: code repo `steak.yml`; stake repo `verify.yml` and `quarterly.yml`.
- `steak init`, `vendor`, `steak`, `compute`, `verify`, `selftest`, `version`.
- Policy changes reach only Steak earned after them (`[[before]]` in `stake.toml`), and `verify`
  recomputes each payout from the events, opt-outs and policy it recorded.
- Stake repo templates, MODEL.md, SPEC.md.
