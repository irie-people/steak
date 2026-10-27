# Stake

{{NAME}} is free to use. If it ever makes money (donations, sponsorships,
grants), the money goes back to the people who build it, in proportion to the
value of their work. This repository is the public record of that work.

Contributions are measured in **Steak**, a play on *stake*.

**Steak is a record, not a promise.** {{NAME}} has no revenue today and may
never have any. Steak is not money, shares, equity, a token or a debt. It
can't be sold or transferred, it gives no ownership of {{NAME}} and no vote over
its money, and it carries no right to any future token or asset.

## The founder

The founder starts with zero Steak, like everyone else. The founder works under
the account `{{FOUNDER_HANDLE}}` and earns Steak only for work that another
maintainer sizes, by the same rules as everyone.

## Earning Steak

Steak starts once a maintainer vouches for you (`vouch.txt`), usually after
your first merged change. A maintainer sizes each merged change with a
`steak:N` label. The size reflects how much the change matters to users and
how hard it was, not how many lines it has. Nobody sizes their own work.

| Steak | Size | Looks like |
|---|---|---|
| 1 | Trivial | A typo, a broken link, a one-line default |
| 2 | Small | A small fix with a test; a docs section |
| 3 | Modest | A bug that took real investigation |
| 5 | Solid | A feature slice; one capability for one integration |
| 8 | Substantial | A new integration; a sizeable feature with tests |
| 13 | Major | A whole milestone, or a cross-cutting change |
| 21 | Foundational | Architecture-level work; needs two maintainers |

The same scale covers:

- **Review**: a substantive review earns a quarter of the change's Steak,
  rounded up, shared by at most two reviewers.
- **Reports**: 1–2 for a reproducible bug report; 3, 8 or 13 for a security
  report, by severity, if it was disclosed privately first.
- **Docs, design, demos and translations**, sized like code.
- **Support, triage and stewardship**, logged by a maintainer each month at
  about 1 Steak per two hours.

Steak vests {{VEST_DAYS}} days after it is recorded. A change reverted in that
time loses its Steak.

## Payouts

In any quarter with revenue, after host and processor fees:

- **{{RESERVE}}%** stays in reserve for running costs.
- **{{UPSTREAM}}%** goes to the open-source projects {{NAME}} is built on, listed
  under "Built on" in its `PROVENANCE.md`.
- **The rest** goes to contributors, in two halves:
  - **Back pay.** This half moves each person toward the same share of all
    money paid as their share of all Steak, so work done before any money
    existed still gets paid.
  - **Recent work**: Steak vested in the last two quarters.

Only Steak from the last {{BACKPAY_YEARS}} years counts. Each payout is a
discretionary payment for completed work, made from money actually received;
nothing is owed until a payout is approved. Payouts under ${{THRESHOLD}} are held
for the next quarter. Each distribution is published in `distributions/`, and
anyone can recompute it with `bun tools/steak.ts verify .`.

## Getting paid

Payments go through {{NAME}}'s fiscal host, which handles identity and tax forms
and keeps them private. Payees must pass the host's sanctions checks. You can opt
out before a quarter starts (`payees/<handle>.toml`, `opt_out = true`); your
share then goes to the reserve and counts as paid. Payouts are pay for work done
and may be taxable where you live. If your job or visa limits outside income
(H-1B and F-1 holders, for example), opt out; that is always fine.

Contributors are paid as independent contractors. Maintainers set this policy
after public comment.

## Fair play

- Only merged work earns Steak. For anything that would size at 5 or more,
  agree it in an issue before you start.
- Say when an agent wrote part of a change. You answer for every line you
  submit. Unreviewed generated changes are closed without Steak.
- One person, one account, one payee. Duplicate accounts lose their Steak.
- To dispute a size, open an issue here within 30 days.
- Changes to this policy stay open as a pull request for 30 days. A change to
  which Steak counts applies only to Steak earned after it merges; a change to
  how money is split applies from the next payout.
