# Operations and decision history

Use [README.md](../README.md) for setup and deployment, [maintainer.md](maintainer.md) for how the live site is run, [AGENTS.md](../AGENTS.md) for code conventions, and git commits and tags for the detailed change record.

## Deployment configuration check — October 10, 2026

Checked GitHub with its API and Cloudflare through the authenticated Worker dashboard. These are dated observations, not a claim that account settings cannot change.

- GitHub repository: [jmusick/orboro-net](https://github.com/jmusick/orboro-net), repository ID `1231197478`, public, default branch `master`, homepage `https://orboro.net`.
- Local `origin`: `https://github.com/jmusick/orboro-net.git`. `git ls-remote` resolves `master` to `13beff8d2b70940841d5644132dd5ef057089b46`, matching the checkout and the latest deployed build.
- Cloudflare Worker: `orboro-net`. Its production Builds settings link to `jmusick/orboro-net`, use branch `master` and root `/`, and have builds enabled. Build command: `npm run build`; deploy command: `npx wrangler deploy`; include watch path: `*`.
- The build token is selected as `orboro-net build token`. No build variables or secrets are configured. An older external note claimed `NODE_VERSION=22`; the dashboard did not support that claim. The repository's Node requirement remains in `package.json`.
- GitHub's `Workers Builds: orboro-net` check succeeded for the current commit. Cloudflare shows production version `d822d5e2` ready and serving 100% of traffic. No post-rename push or new deployment was performed during this check.
- Production bindings match `wrangler.toml`: D1 `DB` → `orboro-db` (`7fe68e1c-ce42-40a6-ae78-3bb674d6ad0f`), R2 `MEDIA` → `orboro-net-media`, and static `ASSETS`. Compatibility date: `2026-04-05`; flag: `nodejs_compat`. No runtime variables or secrets are configured.
- Worker custom domain: `orboro.net`; workers.dev hostname: `orboro-net.jd-fda.workers.dev`. The R2 custom domain and its development URL were not rechecked in this review.
- Older deployment records retain `jmusick/orboro` links. The active repository connection uses the renamed repository; historical labels alone do not indicate a broken connection.

Cloudflare account settings remain outside the repository. Analytics retention, Google data sharing, live edge rules and log retention were not checked. Consult the account dashboards before making claims about them.

Reference: [Cloudflare GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/) and [GitHub repository renames](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository).

## Security configuration observation — October 10, 2026

The authenticated zone dashboard showed an active per-IP rule for exactly `/api/auth/login`: more than two requests in ten seconds is blocked for ten seconds. The `workers.dev` login is also reachable; account limits and alternate-host coverage remain in [issue #4](https://github.com/jmusick/orboro-net/issues/4). Minimum TLS was shown as TLS 1.0 default, with TLS 1.3 enabled; review effective hostname settings and raise the floor under [issue #15](https://github.com/jmusick/orboro-net/issues/15). No settings were changed during this inspection.

GitHub secret scanning and push protection are enabled. The API showed no Actions workflows, master branch protection or rulesets, and Dependabot security updates disabled. Reproducible release checks are tracked in [issue #14](https://github.com/jmusick/orboro-net/issues/14). The [dated audit issues](https://github.com/jmusick/orboro-net/issues?q=is%3Aissue%20label%3Aaudit%3A2026-10-10) are the current backlog.

## PBKDF2 iteration limit — October 13, 2026

For [issue #6](https://github.com/jmusick/orboro-net/issues/6), a throwaway Worker (`orboro-pbkdf2-bench`, no bindings, deleted afterwards) was deployed to the account's workers.dev subdomain on Workers Paid with compatibility date `2026-04-05` and Wrangler 4.148.0. It ran one `deriveBits` PBKDF2-HMAC-SHA256 call per request:

- 100,000 iterations succeeded; `wrangler tail` reported 25, 25 and 33 ms CPU across three requests.
- 100,001, 200,000, 600,000 and 1,000,000 iterations each failed immediately with `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported`.

The OWASP figure of 600,000 is therefore not deployable. [cloudflare/workerd#7550](https://github.com/cloudflare/workerd/pull/7550), which would raise the default cap to 1,000,000, was still open. The site keeps 100,000 and is ready to migrate: raise the bounds in `src/lib/passwords.js` after re-measuring, and each account is rehashed on its next sign-in.

## Security events and recovery drill — October 13, 2026

For [issue #13](https://github.com/jmusick/orboro-net/issues/13).

**Events.** The allowlisted security events described in the README were exercised against an isolated `wrangler dev` (its own local D1 and a generated test admin): unknown-account and wrong-password sign-ins, a successful sign-in, a valid and an invalid admin save, an anonymous delete, a forged session cookie and sign-out each produced the expected record. Canary values sent in the email, password, cookie, query string, `cf-connecting-ip` and user agent appeared nowhere in the server log.

**Log access and retention.** Workers Logs on the Workers Paid plan keeps 7 days; no Logpush jobs exist (see [maintainer.md](maintainer.md)). Reading them requires a Cloudflare login on this account with Workers access (Workers & Pages → orboro-net → Observability); account membership was not reviewed here. Cloudflare's announced unified observability pricing (effective December 1, 2026) lists longer paid retention as "coming soon"; recheck then.

**Alerts: not configured.** After v1.51.0 deployed, a production smoke test produced an `auth.login.failed` event that the Workers Logs view showed with every field. Cloudflare's Custom Alerts (beta, Alerts → Create an alert → Custom alert) query the SQL dataset `logs.workersLogs`, which exposes only fixed columns (`level`, `message`, `scriptName`, `url`, `httpStatus`, `logType`…) and no custom fields such as `security_event`. For orboro-net it held a few `log`/`info` rows per hour and no `warn` rows, so neither `level = 'warn'` nor a `message` match found the event. No alert was created. The likely fix is writing each security event to a Workers Analytics Engine dataset, which Custom Alerts can query; an alert on login `429`/`503` statuses alone would miss wrong-password failures.

**Session revocation and password rotation**, rehearsed on the same isolated copy: a signed-in cookie got `200` on `/admin/content`; after `sessions:revoke` it got `302` to sign-in; after `admin:reset-password` the earlier cookie was refused, the old password failed and the new one worked.

**D1 recovery.** Production `orboro-db` was exported (124 KB) and restored into a throwaway database in the same account, which was then deleted. Findings:

- The first import failed its foreign key check: production pages `about` and `path-of-exile-ii` named an author ID that matched no user (an older local-database ID). Production therefore could not be rebuilt from its own export. `scripts/content/repair-orphaned-authors.sql` was run against production (2 rows written) and `PRAGMA foreign_key_check` there now returns nothing.
- With that repaired, importing the whole export in one `wrangler d1 execute --remote --file` call still failed with `{"D1_RESET_DO":true}` (Wrangler 4.148.0) on two fresh databases, while each table imported cleanly on its own. `scripts/split-d1-export.mjs` produces those per-table files.
- The per-table restore matched production exactly: users 1, sessions 4, content 23, media 18, categories 5, content_categories 33, nav_items 15, login_attempts 2, migrations 13, 87,287 Markdown characters, and an identical SHA-256 over every content ID, length and update time and every media URL. No foreign key violations.
- D1 Time Travel was available (30 days on Workers Paid) and reported a current bookmark. An in-place Time Travel restore of production was not rehearsed because it is destructive.

**R2 recovery.** `orboro-net-media` held 19 objects (5.98 MB). Production D1 references 18 of them; those were downloaded with Wrangler (3.6 MB, 41 s), uploaded to a throwaway bucket with their content type and cache headers, read back, and matched by SHA-256 (79 s round trip). The throwaway bucket was emptied and deleted. The 19th object is referenced by nothing, and Wrangler cannot list buckets, so this method does not cover it. The drill's export and media copies were deleted afterwards; no standing backup was created.

## Release gate enforcement — October 13, 2026

For [issue #14](https://github.com/jmusick/orboro-net/issues/14). This supersedes the GitHub part of the October 10 observation above.

**Repository settings** (confirmed with the GitHub API): Dependabot alerts and Dependabot security updates enabled; secret scanning and push protection still enabled. No Dependabot alerts were open.

**Ruleset** `master: require Release gate` (ID `25040552`, active, targets the default branch): requires the `Release gate` check from the GitHub Actions app (integration `15368`, so a same-named check from another app doesn't count), blocks force pushes and blocks deletion. The Repository admin role may bypass it at any time, so direct release pushes (`/patch`, `/minor`) still land; GitHub records them as bypasses. Pull requests, Dependabot's included, can't merge until the gate passes. "Require branches to be up to date" is off.

**Proof.** Draft PR [#42](https://github.com/jmusick/orboro-net/pull/42) added a deliberately failing test. [CI run 38492351512](https://github.com/jmusick/orboro-net/actions/runs/38492351512) failed `Test, check and build` (159 passed, 1 failed) and therefore `Release gate`; GitHub reported the PR `BLOCKED` both as a draft and when ready, and `gh pr merge` without `--admin` was refused ("the base branch policy prohibits the merge"). The PR was closed unmerged and its branch deleted.

**Limit: the ruleset doesn't gate deploys.** Workers Builds deploys every commit that reaches `master`, independently of GitHub checks, and starts before CI finishes. An admin push that bypasses the rule, or a merged commit whose CI later fails, still goes live. Example: after Dependabot PR [#41](https://github.com/jmusick/orboro-net/pull/41) merged, the first CI run on `2df10fa` failed `npm audit signatures` with an "invalid attestation" for `@astrojs/check@0.9.10` (a dev dependency the PR didn't touch; tarball integrity still matched the lockfile and the registry, and the check passed locally) while Workers Builds had already deployed. A rerun passed. Check CI on every release commit.

**Workers Builds token.** The build uses `orboro-net build token`, a user API token (not an account token) covering 1 account and all zones, with no expiry or IP restriction. Its 25 permissions include Workers Scripts, D1, R2, KV, Secrets Store, Containers, Queues, AI and other account products, User Memberships and Details, and zone-level Workers Routes, SSL and Certificates and Email Routing Rules; the token list doesn't show read or edit levels. That is far wider than a deploy binding only D1 and R2 needs. Narrowing it is tracked in [issue #43](https://github.com/jmusick/orboro-net/issues/43). No Cloudflare settings were changed during this review.

## Decision history

These rationales were consolidated from earlier project notes; they are historical, not new deployment changes.

- **v1.33.0:** moved from Cloudflare Pages to the `orboro-net` Worker.
- **v1.34.0:** removed hCaptcha and its runtime secret from admin login; login became email and password only.
- **v1.37.0:** took the palette from the logo and header art instead of the previous neon colors. Fonts became self-hosted because the prior stylesheet named an unloaded face and visitors saw Segoe UI. The homepage began leading with the newest post, and text-only pages gained the blog sidebar.
- **October 4, 2026:** removed `/admin/setup`, which was unnecessary for a one-user site and had a race on empty databases. `admin:create` handles fresh and restored databases.

## Research data

The assisted-combat generator reads external inputs through `ASSISTED_COMBAT_RESEARCH_ROOT` and `ASSISTED_COMBAT_NOTES_ROOT`. The input filenames and error handling are documented in [the generator](../scripts/generate-assisted-combat-data.mjs). Set the variables when using another workspace; do not copy personal research locations into runtime code.
