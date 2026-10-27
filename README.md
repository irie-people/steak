# Steak

**Get the value you'd pay for, free, today.** Steak is a way to run an open-source
project so that if it ever makes money (donations, sponsorships, grants), all of it
goes back to the people who build it, after running costs, by the value of what
they contributed. The founder starts with zero Steak and earns it like everyone else.

Steak is a play on *stake*. It is a public record of work, not money, shares,
equity, a token or a debt.

| Read | For |
|---|---|
| [MODEL.md](MODEL.md) | The model: who gets paid, how much, and why it's shaped this way |
| [SPEC.md](SPEC.md) | The stake repo's files and formats, and what `verify` checks |
| [templates/](templates/) | What `steak init` writes into a new stake repo |

## Use it

Every project keeps its own public **stake repo** (by convention `<org>/stake`) next
to its code repo.

```sh
# from a checkout of this repo
bun src/steak.ts init ../myproject-stake --name myproject --org myproject-hq --founder <handle> \
  --code ../myproject        # README "Free, and paid back" section + .github/workflows/steak.yml
```

`init` never overwrites a file. Each stake repo carries its own copy of the tool at
`tools/steak.ts`, so anyone can recompute a payout without this repo.

Options for `init`: `--reserve 10 --upstream 5 --threshold 25 --backpay-years 3 --vest-days 30`.

## Automation (no LLM tokens)

Everything runs in GitHub Actions as plain code. The one judgment call, how big a
change is, stays with a maintainer's `steak:N` label; Steak only suggests.

| When | What runs | Where |
|---|---|---|
| A PR opens or updates | `steak suggest` comments a size from the diff. Deterministic by default; set the repo variable `STEAK_MODEL` to an Ollama model and a small model runs on the runner instead | code repo `steak.yml` |
| A PR merges, or gets its `steak:N` label after merging | `steak record` writes the change, review Steak (a quarter of the size, up to two approvers) and reverts, and pushes them to the stake repo. A first-time contributor's events count once a maintainer merges the vouch PR it opens there | code repo `steak.yml` |
| Any push to the stake repo | `steak verify` recomputes every payout | stake repo `verify.yml` |
| 2nd of Jan, Apr, Jul, Oct | `steak revenue` reads the quarter's net from Open Collective, then `compute`, timestamp, tag `payout-YYYY-Qn`, and a payout issue | stake repo `quarterly.yml` |

Setup, once per project:

| Setting | Where | Value |
|---|---|---|
| `STAKE_TOKEN` secret | code repo | Fine-grained token: contents and pull requests write on the stake repo |
| `steak:N` labels | code repo | Run the `steak` workflow by hand once (its `labels` job) |
| `OPENCOLLECTIVE_SLUG` variable | stake repo | The collective's slug; without it, run `quarterly payout` by hand with a net amount |
| `STEAK_MODEL` variable (optional) | code repo | A 1–3B instruct model; empty means the heuristic |

Left to people:

| What | How |
|---|---|
| Sizing | A maintainer other than the author adds `steak:N`. A solo founder's own work waits for a second maintainer |
| Vouching | Merge the vouch PR the bot opens |
| Support and triage hours | `steak add` once a month, about 1 Steak per two hours |
| Opting out of payouts | `payees/<handle>.toml` with `opt_out = true`, before the quarter |
| Paying | Each payee invoices the fiscal host for the amount in the payout issue |

## Commands

| Do | Command (inside the stake repo) |
|---|---|
| Steak per handle, and rule violations | `bun tools/steak.ts steak . [YYYY-Qn]` |
| One hand-made event | `bun tools/steak.ts add . --who <h> --kind support --steak 2 --sized-by <maintainer>` |
| Record a merged PR by hand | `bun tools/steak.ts record . --github <owner/repo> --pr <n> [--dry-run]` |
| Suggest a size offline, with a local model | `git diff main... \| bun tools/steak.ts suggest --diff - --model <ollama model>` |
| Quarterly payout by hand | `bun tools/steak.ts compute . <YYYY-Qn> <net-usd>` → `distributions/<q>.json` |
| Recompute every payout | `bun tools/steak.ts verify .` |
| Move to a newer Steak | `bun <steak checkout>/src/steak.ts vendor .` |

Money is paid through a fiscal host (such as Open Collective or a 501(c)(3) sponsor),
never through a personal account. Payouts are discretionary pay for completed work.
Nothing here is legal or tax advice.

## Free, and paid back

Steak runs on Steak: contributions to this repo are recorded in
[steak-hq/stake](https://github.com/steak-hq/stake).

## License

MIT. See [LICENSE](LICENSE).
