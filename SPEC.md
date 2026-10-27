# Stake repo specification (v0.1)

A stake repo is plain files in git. Everything `verify` needs is in the repo.

| Path | Format | Who writes it |
|---|---|---|
| `STAKE.md` | The project's policy, from `templates/stake-repo/STAKE.md` | Maintainers, by 30-day PR |
| `stake.toml` | Payout parameters (below) | Maintainers, by 30-day PR |
| `vouch.txt` | `handle YYYY-MM-DD` per line; `#` comments | Maintainers, by PR |
| `events/YYYY/MM.jsonl` | One event per line, append-only | Maintainers, after a merge |
| `payees/<handle>.toml` | `opt_out = true`, nothing personal | The contributor |
| `distributions/YYYY-Qn.json` | Output of `compute` | `compute`, then committed and tagged |
| `tools/steak.ts` | Vendored copy of `src/steak.ts` | `steak init` / `steak vendor` |

## `stake.toml`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `reserve` | fraction | `0.1` | Kept for running costs |
| `upstream` | fraction | `0.05` | Paid to the projects under "Built on" in the code repo's `PROVENANCE.md` |
| `balanced` | fraction | `0.5` | Share of the pool paid as back pay |
| `threshold` | USD | `25` | Smaller payouts are held for the next quarter |
| `recent_quarters` | int | `2` | Window for the recent-work half |
| `backpay_years` | int | `3` | Only Steak and payments in this window count |
| `vest_days` | int | `30` | Steak counts this long after its event |
| `allow_self_sizing` | bool | `false` | `true` turns off the `sized_by ≠ who` check |
| `[[before]]` | tables | none | Earlier values: `until = "YYYY-MM-DD"` (the day a change merged) and the keys it changed |

An event follows the values in force on its `at`, so a change to `recent_quarters`,
`backpay_years`, `vest_days` or `allow_self_sizing` reaches only Steak earned after it.
Each quarter's money follows the values in force at its end. A person's payments count
back as far as their oldest Steak still counted.

## Event

```json
{"id":"2027-03-0007","at":"2027-03-04T18:22:10Z","who":"bob","kind":"change","ref":"org/repo#142","commit":"3f9c2e1a","steak":8,"sized_by":"carol","note":"short description"}
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique across the repo |
| `at` | yes | ISO 8601 UTC, when the work merged |
| `who` | yes | The contributor's handle. Its Steak counts from its `vouch.txt` date |
| `kind` | yes | `change`, `review`, `report`, `docs`, `support` or `revert` |
| `steak` | yes | Size; negative for a revert |
| `sized_by` | yes | The maintainer who sized it, never `who`; or a rule: `rule:review` (a quarter of the change, written by `record`) or `rule:revert` |
| `of` | revert only | The event id it cancels. The revert vests with that event |
| `ref`, `commit`, `note` | no | Where the work is |

## What `record` writes for a merged PR

| Case | Events |
|---|---|
| Labeled `steak:N` by someone other than the author | `change` (N, `sized_by` = the labeler), then `review` for up to two vouched approvers sharing ⌈N/4⌉ |
| Body says `Reverts owner/repo#M` | `revert` (negative, `of` = each unvested event of #M); vested events keep their Steak |
| Author not on `vouch.txt` | The events go in as usual, and a vouch line dated the merge day goes to a maintainer as a pull request. They count once it merges |
| No label, self-label, size off the scale, already recorded | Nothing; a note on the PR |

Ids are `YYYY-MM-NNNN`, the next free number in the merge month.

## What `verify` checks

- Every event: unique `id`, `sized_by ≠ who`. An event whose `who` isn't on `vouch.txt`,
  or is from before its vouch date, is listed but doesn't count.
- Every `distributions/*.json` recomputes to the same bytes from the events (`events`
  lists the ids it counted), opt-outs and policy it records. Later events, vouches,
  opt-outs and policy changes leave a past payout as it was; editing or deleting an
  event it counted is drift and fails CI.

## Versioning

Steak follows semver. A change to the formula, an event field or a `stake.toml`
key is a major version. Each stake repo pins the version in its vendored
`tools/steak.ts` header and moves with `steak vendor`.
