# Maintaining orboro.net

This file covers how JD runs the live site at `https://orboro.net`: the local workspace, issue tracking, the production deployment and the policies applied to it. To run your own copy, use [README.md](../README.md). [AGENTS.md](../AGENTS.md) holds the code conventions, and [operations.md](operations.md) holds dated configuration checks and decision history.

## Users

JD is the only user, with the `admin` role. The app is admin-only by design (decision on [#16](https://github.com/jmusick/orboro-net/issues/16)). Adding non-admin users needs an ownership and permissions design first.

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

- The Worker `orboro-net` builds through Cloudflare Workers Builds, which is connected to GitHub [jmusick/orboro-net](https://github.com/jmusick/orboro-net). A push to `master` runs `npm run build`, then `npx wrangler deploy`. Workers Builds reads `.nvmrc` for its Node version.
- GitHub Actions CI runs on the same commit independently. It has no deploy role or credentials, so Workers Builds deploys whatever the CI result is unless the Cloudflare side is configured otherwise. Check the CI result on a release commit before relying on the deploy.
- `wrangler.toml` points at the production D1 database `orboro-db` and the R2 bucket `orboro-net-media`. Uploaded media is served from the custom domain `https://media.orboro.net`, and the bucket's `r2.dev` development URL stays disabled.
- Custom domains, production secrets and edge security rules are configured in the Cloudflare dashboard. Workers logs and sampled traces are on; check retention and dashboard rules in the Cloudflare account. [operations.md](operations.md) records the last dated check of these settings.
- Apply new schema migrations locally, verify them, then apply them remotely **before** deploying code that needs them. SQL content seeds are a separate step: pushing code doesn't copy local content into production.

### Production content steps

- **Homepage tools.** After migration `0012_homepage_features.sql`, `scripts/content/homepage-featured-tools.sql` selected the initial four tools (two per game). Running it again with `--remote` restores that selection and those descriptions.
- **R2 media records.** `scripts/content/backfill-r2-media-library.sql` registers the 13 content images checked on October 6, 2026. It can be rerun without duplicating records or overwriting existing metadata.
- **Content images.** Run `npm run media:migrate -- --remote` only after reviewing its dry-run manifest, then `--remote --apply` to copy objects and update production D1.
- **Content seeds.** The other files in `scripts/content/` are re-runnable seeds and one-off repairs for orboro.net's own pages and posts. [AGENTS.md](../AGENTS.md) describes the seed pattern.

### Research data

`npm run data:assisted-combat` reads research inputs kept in the project library. Set `ASSISTED_COMBAT_RESEARCH_ROOT` and `ASSISTED_COMBAT_NOTES_ROOT` to their locations; the generator documents the expected files.

## Dependency policy

- **Release age.** Don't adopt a dependency release younger than about a week. Dependabot enforces this with a cooldown (7 days, 14 for major versions). For manual updates, use `npm install <pkg>@latest --min-release-age=7` (a recent npm 11 option; it limits which versions npm may resolve and doesn't affect `npm ci`).
- **Urgent exception.** For an actively exploited or high-severity advisory, skip the wait: update the one package (`npm install <pkg>@<fixed version>`), confirm the lockfile diff touches only that package and its dependencies, run `npm run verify` and `npm audit`, then ship the change through a pull request or a normal release commit. Say in the commit message that it is a release-age exception and why. Dependabot security updates ignore the cooldown by design.
- **`sharp` override.** The override in `package.json` pins the patched 0.35.5 release while Miniflare still declares 0.35.4. Dependabot doesn't manage overrides, so remove it by hand once upstream uses a patched release, after checking `npm audit` and rebuilding.
- **Dependabot.** `.github/dependabot.yml` opens one grouped weekly pull request for npm (Astro, the Cloudflare adapter and Wrangler together; everything else minor and patch), separate major-version PRs, and one for GitHub Actions. Dependabot security updates are a repository setting, not a file, and must be enabled in the GitHub settings; [operations.md](operations.md) records their dated state.
- **Branch rules.** The `Release gate` CI job passes only if every other job succeeded, so it is the one check to require.
- **SBOM.** No SBOM tooling is wired into CI. `package-lock.json` already records every dependency with version, source and integrity hash, and `npm audit` and GitHub's dependency graph both read it. If an SBOM is ever requested, `npm sbom --sbom-format cyclonedx` produces CycloneDX from the same lockfile. Nothing here claims statutory compliance.

## Privacy claims

The live site loads Google Analytics through the consent banner. Analytics retention, Google data-sharing settings, Cloudflare log retention and live edge rules can't be established from this repository: check those dashboards before changing claims in `/privacy-policy`.
