# Provenance

steak is written from public documentation and public open-source projects. Every source that shaped the code is listed here: what it is, when it was read, and what it was used for.

## Sources

| Date | Source | Used for |
|---|---|---|
| 2026-10-26 | SourceCred source code, BALANCED grain policy (github.com/sourcecred/sourcecred) | The back-pay half of the payout formula |
| 2026-10-26 | Public project docs and announcements cited in MODEL.md (typescript-eslint, Ghostty, curl, Protocol Guild, Zig, ESLint, Bountysource, tea.xyz, Optimism, Coordinape, Slicing Pie) | The sizing rubric and the rules' rationale |
| 2026-10-26 | Developer Certificate of Origin (developercertificate.org) | Sign-off rule in CONTRIBUTING.md |

## Built on

What steak runs on. The upstream share of every payout (`upstream` in `stake.toml`) goes to these projects.

| Project | License | Used for |
|---|---|---|
| Bun (github.com/oven-sh/bun) | MIT (Bun itself) | Runtime, TOML parser and test runner |
| GitHub CLI (github.com/cli/cli) | MIT | `record` reads merged pull requests; the workflows comment, label and open issues |
| actions/checkout (github.com/actions/checkout) | MIT | Checks out repos in the workflows |
| oven-sh/setup-bun (github.com/oven-sh/setup-bun) | MIT | Installs Bun in the workflows |
| OpenTimestamps client (github.com/opentimestamps/opentimestamps-client) | LGPL-3.0-or-later | Timestamps each distribution in `quarterly.yml` |
| Ollama (github.com/ollama/ollama) | MIT | Runs the optional local model for `suggest` |

Licenses read from each project's repository on 2026-10-26.

## Third-party code

| Module | Version | License | Why |
|---|---|---|---|
