# Maintaining orboro.net

This file covers how JD runs the live site at `https://orboro.net`: the local workspace, issue tracking, the production deployment and the policies applied to it. To run your own copy, use [README.md](../README.md). [AGENTS.md](../AGENTS.md) holds the code conventions, and [operations.md](operations.md) holds dated configuration checks and decision history.

## Users

JD is the only admin user. The CMS is admin-only by design (decision on [#16](https://github.com/jmusick/orboro-net/issues/16)); public commenters are separate **member** accounts that can't reach the admin area. Adding non-admin CMS users still needs an ownership and permissions design first. Moderate comments at `/admin/comments` and manage members at `/admin/members`.

## Workspace boundaries

The local checkout is `C:\Users\JD\source\orboro-net`, and the project library is `C:\Users\JD\Projects\orboro-net`. Use kebab-case for project-library folders and authored asset names. Keep framework conventions, generated filenames and original archive contents as they are.

This repository owns website code, deployed assets, content seeds, migrations, data generators, tests, development configuration and technical documentation. The project library owns research inputs and workbook utilities, editable artwork, creative prompts, article drafts, and historical review or build snapshots. Its `README.md` indexes those materials. Keep current build output, dependencies and Cloudflare local state in the checkout, and keep historical copies in the project library. Historical SQL and review utilities are records, not setup steps.

## Issue tracking

Outstanding work is tracked in [GitHub Issues](https://github.com/jmusick/orboro-net/issues). Each issue has a `category:security`, `category:accessibility` or `category:seo` label when one applies, plus a priority:

- `priority:p1`: address next
- `priority:p2`: normal planned work
- `priority:p3`: optional improvement or future prerequisite

The [October 10 audit issues](https://github.com/jmusick/orboro-net/issues?q=is%3Aissue%20label%3Aaudit%3A2026-10-10) reconcile the earlier reviews against v1.45.1. Historical checklists are evidence, not the current backlog.

## Production deployment

- The Worker `orboro-net` builds through Cloudflare Workers Builds, which is connected to GitHub [jmusick/orboro-net](https://github.com/jmusick/orboro-net). A push to `main` runs `npm run build`, then `npx wrangler deploy`. Workers Builds reads `.nvmrc` for its Node version.
- GitHub Actions CI runs on the same commit independently. It has no deploy role or credentials, so Workers Builds deploys whatever the CI result is, and usually before CI finishes. The `main` ruleset (see Branch rules below) stops failing pull requests from merging, but no GitHub rule stops a commit that reaches `main` from deploying. Check the CI result on a release commit before relying on the deploy.
- Workers Builds deploys with the `orboro-net build token` selected in the Worker's Builds settings. Its scope was reviewed on October 13, 2026 ([operations.md](operations.md)); narrowing it is [issue #43](https://github.com/jmusick/orboro-net/issues/43).
- `wrangler.toml` points at the production D1 database `orboro-db` and the R2 bucket `orboro-net-media`. Uploaded media is served from the custom domain `https://media.orboro.net`, and the bucket's `r2.dev` development URL stays disabled.
- Custom domains, production secrets and edge security rules are configured in the Cloudflare dashboard. Workers logs and sampled traces are on; check retention and dashboard rules in the Cloudflare account. [operations.md](operations.md) records the last dated check of these settings.
- Apply new schema migrations locally, verify them, then apply them remotely **before** deploying code that needs them. SQL content seeds are a separate step: pushing code doesn't copy local content into production.

### Local clones after the default-branch rename

On each other machine, first make sure the checkout is clean and switch to its former default branch. Then rename that local branch and refresh its upstream:

```sh
git branch -m main
git fetch origin --prune
git branch --set-upstream-to=origin/main main
git remote set-head origin -a
```

If a local `main` branch already exists, inspect it before renaming anything. Existing feature branches can stay as they are; target new pull requests at `main`.

### Production content steps

- **Homepage tools.** After migration `0012_homepage_features.sql`, `scripts/content/homepage-featured-tools.sql` selected the initial four tools (two per game). Running it again with `--remote` restores that selection and those descriptions.
- **R2 media records.** `scripts/content/backfill-r2-media-library.sql` registers the 13 content images checked on October 6, 2026. It can be rerun without duplicating records or overwriting existing metadata.
- **Content images.** Run `npm run media:migrate -- --remote` only after reviewing its dry-run manifest, then `--remote --apply` to copy objects and update production D1.
- **Content seeds.** The other files in `scripts/content/` are re-runnable seeds and one-off repairs for orboro.net's own pages and posts. [AGENTS.md](../AGENTS.md) describes the seed pattern.
- **Assisted Combat 12.1.5.** `scripts/content/assisted-combat-analysis-12-1-5.sql` updates the existing page intro and homepage description for the Blizzard/SimC comparison. Apply it locally for preview and remotely with the code release; code deployment alone leaves the older D1 copy in place.

### Research data

`npm run data:assisted-combat` reads the pinned Blizzard DB2 exports and SimulationCraft source kept in the project library. The current snapshot is `games/world-of-warcraft/assisted-combat/source-snapshot/2026-10-29/`. Set `ASSISTED_COMBAT_RESEARCH_ROOT` to use another location; the generator documents its manifest, baseline files and expected CSV filenames. It needs no guide notes or network access. Current comparisons use MID2 profiles only; missing profiles receive no score. `tests/assisted-combat.test.mjs` checks parsing, decoder boundaries, score arithmetic and shared rendering.

The paired benchmark uses the official Windows nightly from `simulationcraft/simc-publish` Actions run `40814481564`, artifact `simc-nightly-win64-midnight`, at the same pinned `710c240` revision. Its live DBC is `12.1.5.70575`, with October 28 hotfix data. `SIMC_EXE` can point at another copy of that executable. Run `npm run sim:assisted-combat -- --smoke` before the full command; `--spec=254` limits either mode to a single primary profile. The runner writes to `sim-smoke/` or `sim-results/` under the snapshot and resumes completed reports. It uses two processes of four threads each.

`npm run data:assisted-combat-sims` requires the complete result set and validates the engine/build, fight settings, sample counts, full fight duration, absence of deaths and matching gear/talents/consumables within each pair. It emits `src/lib/assisted-combat-sims.json`, plus `comparison.csv` and report checksums in the external results folder. Settings: primary MID2 profile per supported spec, fixed five-minute Patchwerk, 10,000 requested iterations, full raid buffs, 1/2/3/5 targets, manual cooldown support on and Single-Button Assistant penalty off. The generated Blizzard APLs preserve SimC’s importer comments, including class-specific corrections; the two undocumented Unholy rule fields remain outside SimC’s model. Raw reports retain engine model warnings. The uncertainty interval measures Monte Carlo sampling only, not model error. These runs compare damage, including for tanks; they do not rank survivability or optimize talents/gear separately for AoE.

## Dependency policy

- **Release age.** Don't adopt a dependency release younger than about a week. Dependabot enforces this with a cooldown (7 days, 14 for major versions). For manual updates, use `npm install <pkg>@latest --min-release-age=7` (a recent npm 11 option; it limits which versions npm may resolve and doesn't affect `npm ci`).
- **Urgent exception.** For an actively exploited or high-severity advisory, skip the wait: update the one package (`npm install <pkg>@<fixed version>`), confirm the lockfile diff touches only that package and its dependencies, run `npm run verify` and `npm audit`, then ship the change through a pull request or a normal release commit. Say in the commit message that it is a release-age exception and why. Dependabot security updates ignore the cooldown by design.
- **`sharp` override.** The override in `package.json` pins the patched 0.35.5 release while Miniflare still declares 0.35.4. Dependabot doesn't manage overrides, so remove it by hand once upstream uses a patched release, after checking `npm audit` and rebuilding.
- **Miniflare's `undici` override.** The scoped `miniflare` override pins Undici 7.30.1 while Miniflare declares the vulnerable 7.29.1. It leaves Unifont's separate Undici 8 dependency on its own major version. Remove the scoped override once Miniflare declares a patched Undici release (7.30.1 or later in the 7.x line, or a patched newer major), then check `npm audit` and rebuild. Dependabot doesn't manage overrides.
- **Dependabot.** `.github/dependabot.yml` opens one grouped weekly pull request for npm (Astro, the Cloudflare adapter and Wrangler together; everything else minor and patch), separate major-version PRs, and one for GitHub Actions. Dependabot security updates are a repository setting, not a file, and must be enabled in the GitHub settings; [operations.md](operations.md) records their dated state.
- **Branch rules.** The `CI gate` job passes only if every other CI job succeeded, so it is the one check to require. The ruleset `main: require CI gate` requires it (from the GitHub Actions app) on `main` and blocks force pushes and deletion. The Repository admin role can bypass it, which is how `/patch` and `/minor` push release commits directly; everything else, Dependabot included, merges through a pull request once the gate passes. [operations.md](operations.md) records its setup and the failing-PR test.
- **SBOM.** No SBOM tooling is wired into CI. `package-lock.json` already records every dependency with version, source and integrity hash, and `npm audit` and GitHub's dependency graph both read it. If an SBOM is ever requested, `npm sbom --sbom-format cyclonedx` produces CycloneDX from the same lockfile. Nothing here claims statutory compliance.

## Repository security scanning

- **CodeQL** uses GitHub's default setup for JavaScript/TypeScript and GitHub Actions, with the default query suite, remote threat model and standard GitHub-hosted runners. GitHub manages the scans and weekly schedule outside the checked-in CI workflow. CodeQL is not currently a required merge check; the existing `CI gate` remains required. Review results in the repository's Security tab. `.astro` templates are not listed among CodeQL's supported source extensions, so keep the security tests and review template boundaries separately.
- **Secret scanning and push protection** are enabled for the public repository. GitHub's generic-pattern scanning and partner validity checks remain disabled; their documented eligibility requires an organization-owned repository with GitHub Secret Protection. The shared baseline's gitleaks job scans the full Git history and remains part of the `CI gate`; the local scanner (`npm run scan:secrets`) adds a working-tree scan and a positive-control self-test that CI also runs. Rotate an exposed credential rather than suppressing it.
- **Alert dispositions** need evidence from current inputs and output boundaries. Record that evidence on each CodeQL alert when dismissing a test-only finding or false positive; do not exclude an entire file or rule to clear the queue. The initial CodeQL review is [issue #52](https://github.com/jmusick/orboro-net/issues/52).

## Privacy claims

The live site loads Google Analytics through the consent banner. Analytics retention, Google data-sharing settings, Cloudflare log retention and live edge rules can't be established from this repository: check those dashboards before changing claims in `/privacy-policy`.

Live settings the policy relies on, last checked October 13, 2026 (recheck after any plan, property or tag change):

- **GA4 property** (stream "Orboro", `G-BLR72SL0L6`): event data retention 2 months, user data 14 months with reset on new activity. Google signals off; user-provided data collection off; granular location and device collection on. Only product link is Search Console (Domain property). Redact data: email on, URL query parameters off (the tag already sends origin and path only).
- **GA4 Enhanced measurement**: all seven events on, including page changes from browser history events and site search (`q,s,search,query,keyword`). Both read the minimized `page_location`, so neither sends query values; a live ClientRouter navigation produced one path-only `page_view` and no `view_search_results`.
- **GA4 account data sharing**: "Google products & services" off; modeling and business insights, technical support and business recommendations on. Data Processing Terms accepted May 4, 2025.
- **Google tag trust**: `gtag.js` loads from `www.googletagmanager.com` without SRI because Google updates the file. CSP `script-src` restricts the host; `img-src https:` means CSP does not restrict where the tag can beacon, so the policy doesn't claim it does.
- **Cloudflare**: Workers Paid (Workers Logs kept 7 days), zone on the Free plan, no account or zone Logpush jobs. Worker logs sample 100% and traces 10% (`wrangler.toml`).
