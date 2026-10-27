# The Steak model

Read before changing the rubric, the formula, a default, or a policy rule, or when
someone proposes an algorithm, bounty, peer vote or tradable reward instead.

## The deal

| | |
|---|---|
| Users | Get the product free, today |
| Money in | Donations, sponsorships and grants, received by the project's fiscal host |
| Money out | Each quarter with revenue: reserve, then upstream projects, then everything else to contributors |
| Contributors | Paid by the value of merged work, sized in Steak by a maintainer |
| Founder | Starts at zero Steak, earns it under one disclosed account, sized by someone else |
| Nobody | Owns the project, votes over its money, or holds a claim that can be sold |

## Formula (`src/steak.ts`, tested by `steak selftest`)

```
pool     = net − reserve − upstream + held from last quarter
balanced = 50% × pool          (all of it if nobody has recent Steak)
recent   = pool − balanced
L_i = vested Steak in the last backpay_years   P_i = $ paid or opted out in that window
R_i = Steak vested in the last recent_quarters
pay_i = balanced × gap_i/Σgap + recent × R_i/ΣR,  gap_i = max(0, (ΣP+balanced)·L_i/ΣL − P_i)
pay_i < threshold → held; opted-out share → reserve, counted as paid
nobody with vested Steak → the whole pool is held
```

The balanced half is SourceCred's BALANCED policy (read from its code): late money pays
early work first, and over time each person's share of the money converges to their
share of the Steak. Back pay is capped in years, so Steak never becomes a permanent
claim on revenue.

## Sizing

| Steak | Size | Looks like |
|---|---|---|
| 1 | Trivial | A typo, a broken link, a one-line default |
| 2 | Small | A small fix with a test; a docs section |
| 3 | Modest | A bug that took real investigation |
| 5 | Solid | A feature slice; one capability for one integration |
| 8 | Substantial | A new integration; a sizeable feature with tests |
| 13 | Major | A whole milestone, or a cross-cutting change |
| 21 | Foundational | Architecture-level work; needs two maintainers |

Review earns a quarter of the change's Steak, rounded up, split between at most two
reviewers. Reports earn 1–2 (bugs) or 3, 8 or 13 (privately disclosed security
issues). Docs, design, demos and translations are sized like code. Support and triage
are logged monthly at about 1 Steak per two hours.

## Why each rule

| Rule | Why (evidence) |
|---|---|
| Coarse Fibonacci size by a maintainer, not lines or a graph | typescript-eslint's 1/2/3/5+ tiers still run (2023–). SourceCred's graph was farmed via Discord reactions and wound down 2022-03-28 (grain re-pegged $1 → $0.37). git-blame/Shapley reward volume and score review at zero; no deployed Shapley payout exists |
| Vouch gate before Steak | Ghostty moved from AI disclosure (2025-08) to Vouch (2026-02); Ladybird and tldraw closed external PRs (2026). The only defence that held against agent drive-bys |
| Agree first for size ≥5 | Ghostty: AI PRs only for accepted issues |
| Review earns 25% | When agents write code, review is the scarce work |
| No self-sizing; founder starts at 0 | Self-pricing is the obvious conflict; a zero founder stake only means something if someone else sizes the founder's work |
| No open bounties | Bountysource went bankrupt in 2023 with ≥$21.7k unpaid; Polar issue funding is in maintenance; Algora is AI-saturated; Zig: "Bounties damage open source" |
| No per-activity tradable rewards | tea.xyz: up to 207,101 illegitimate npm packages, 150k+ flagged by Amazon Inspector (2025-11-13); its reward fell 86% within a week of launch |
| Money attracts slop | curl ended its bug bounty 2026-01-31 after valid reports fell below 5%; the slop vanished with the money. Hacktoberfest stopped counting PRs in 2026 |
| No peer-vote or jury pay while small | Coordinape hibernated 2025–26; Praise's TEC dissolved 2025; Deep Funding jurors disagreed 40% of the time and one answer moved ~25% of funds; Optimism Retro Funding paused 2026-01-08 (median voter spent 16 h in RetroPGF 3) |
| Later, for a core team | Protocol Guild: `√(months × 1.0\|0.5)`, curated list, 4-year vesting; $183M in, $12.4M paid in 2025. Zig pays $60/h to invited contributors (92% of spend); ESLint $80/$50 per hour plus a 10% contributor pool |
| Leavers keep their Steak | Slicing Pie takes non-cash slices from bad leavers. Here Steak stays, because it records work; fraud or duplicate accounts forfeit |
| Publish the criteria before any money | Babel's 2021 salary dispute |

## Defaults (`stake.toml`)

reserve 10% · upstream 5% (the "Built on" projects in the code repo's `PROVENANCE.md`) ·
balanced 0.5 · threshold $25 · recent 2 quarters · back pay 3 years · vest 30 days · no
self-sizing. A project changing any of these does it as a 30-day policy pull request that
applies only to Steak earned after it merges: the old values stay in `stake.toml` under a
`[[before]]` table dated the day it merges. Reserve, upstream, balanced and threshold split
money rather than Steak, so a change to them applies from the next payout.
