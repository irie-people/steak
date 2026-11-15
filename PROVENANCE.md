# Provenance

steak is written from public documentation and public open-source projects. Every source that shaped the code is listed here: what it is, when it was read, and what it was used for.

## Sources

| Date | Source | Used for |
|---|---|---|
| 2026-10-26 | SourceCred source code, BALANCED grain policy (github.com/sourcecred/sourcecred) | The back-pay half of the payout formula |
| 2026-10-26 | Public project docs and announcements cited in MODEL.md (typescript-eslint, Ghostty, curl, Protocol Guild, Zig, ESLint, Bountysource, tea.xyz, Optimism, Coordinape, Slicing Pie) | The sizing rubric and the rules' rationale |
| 2026-10-26 | Developer Certificate of Origin (developercertificate.org) | Sign-off rule in CONTRIBUTING.md |
| 2026-10-27 | Conventional Commits 1.0.0 (conventionalcommits.org/en/v1.0.0), CC BY 3.0 | The subject rule in AGENTS.md and CONTRIBUTING.md, and what `.github/conventional-commit.sh` accepts |
| 2026-10-27 | release-please docs and source (github.com/googleapis/release-please: docs/manifest-releaser.md, docs/customizing.md, schemas/config.json, src/manifest.ts, src/commit.ts) and the release-please-action README (github.com/googleapis/release-please-action) | `release-please.yml`, the config and manifest, the `x-release-please-version` annotation, types in lower case (release-please doesn't fold case), and tagging a project's current version before its first run |
| 2026-10-27 | Git's githooks documentation (git-scm.com/docs/githooks) | `git merge` runs the commit-msg hook too, so the check lets a merge through |
| 2026-10-27 | commitlint's default ignores (github.com/conventional-changelog/commitlint, @commitlint/is-ignored) | Which generated subjects pass: git's reverts and reapplies, and fixup!, squash! and amend! commits |
| 2026-10-31 | https://github.com/irie-people/irie (`site/style.css`, `site/index.html`, `.github/workflows/pages.yml`; Apache-2.0, the same project family) ; https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages | `site/`: the layout, type scale and footer shared by the irie-people sites, and `pages.yml`, which publishes `site/` with GitHub's own Pages actions |
| 2026-11-01 | https://github.com/irie-people/irie/blob/main/CODE_OF_CONDUCT.md (Irie's adapted Contributor Covenant 3.0, https://www.contributor-covenant.org/version/3/0/, stewarded by the Organization for Ethical Source; CC BY-SA 4.0) | The text of `CODE_OF_CONDUCT.md`: Irie's copy, with the project's name changed |
| 2026-11-01 | https://docs.oscollective.org/interested-in-joining-osc/acceptance-criteria ; https://docs.oscollective.org/for-hosted-member-projects/governance-and-mediation | What a fiscal host looks for in a project's governance: a clear way to make decisions that survives a change of leadership, two or more admins, contributing guidelines and a code of conduct. The topics of `GOVERNANCE.md`, written to match Irie's |
| 2026-11-15 | https://cli.github.com/manual/gh_pr_diff | `steak.yml`: `--allow-escape-sequences`, so the size bot reads a diff that holds terminal escape codes |
| 2026-11-15 | https://github.com/irie-people/irie/blob/main/GOVERNANCE.md (its Bans section; Apache-2.0, the same project family) ; https://docs.github.com/en/communities/maintaining-your-safety-on-github/blocking-a-user-from-your-organization ; https://www.contributor-covenant.org/faq/ ; https://www.anthropic.com/legal/aup | GOVERNANCE.md's Bans section, the rule Irie has: what a ban covers, who decides, and where misuse is reported |

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
| release-please-action (github.com/googleapis/release-please-action) | Apache-2.0 | Opens release pull requests, then tags and publishes releases, in `release-please.yml` |

Licenses read from each project's repository on 2026-10-26, and release-please-action's on 2026-10-27.

## Third-party code

| Module | Version | License | Why |
|---|---|---|---|

## Third-party text

One file holds text written elsewhere. It keeps its own license and says so at its end.

| File | Source | Version | License |
|---|---|---|---|
| `CODE_OF_CONDUCT.md` | Contributor Covenant, stewarded by the Organization for Ethical Source, https://www.contributor-covenant.org/version/3/0/ | 3.0, adapted | CC BY-SA 4.0 |
