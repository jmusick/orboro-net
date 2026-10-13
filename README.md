# Orboro.net

Orboro.net is JD's personal site and Markdown CMS, built with Astro 7 and deployed as the Cloudflare Worker `orboro-net`. Content and account records live in D1; uploaded images live in R2. See `package.json` for the current version.

JD is the only user, with an admin account, and the app is admin-only by design. The `editor` and `author` values exist in the `users.role` schema but grant no access: every admin page and mutation endpoint requires the `admin` role, and a signed-in non-admin only sees an access-denied page with a sign-out button. There is no public registration or user-management UI. Adding non-admin users needs an ownership and permissions design first (see [#16](https://github.com/jmusick/orboro-net/issues/16)).

Conventions, architecture notes and known gotchas for working on the code are in [AGENTS.md](AGENTS.md).

Track outstanding work in [GitHub Issues](https://github.com/jmusick/orboro-net/issues). Each issue has a `category:security`, `category:accessibility` or `category:seo` label when applicable, and a priority: `priority:p1` means address next, `priority:p2` means normal planned work, and `priority:p3` means an optional improvement or future prerequisite. The [October 10 audit issues](https://github.com/jmusick/orboro-net/issues?q=is%3Aissue%20label%3Aaudit%3A2026-10-10) reconcile the earlier reviews against v1.45.1; historical checklists are evidence, not the current backlog.

## Workspace boundaries

The local checkout is `C:\Users\JD\source\orboro-net`; the project library is `C:\Users\JD\Projects\orboro-net`. Use kebab-case for project-library folders and authored asset names; retain framework conventions, generated filenames and original archive contents.

This repository owns website code, deployed assets, content seeds, migrations, data generators, tests, development configuration and technical documentation. The project library owns research inputs and workbook utilities, editable artwork, creative prompts, article drafts, and historical review or build snapshots. Its `README.md` indexes those materials. Keep current build output, dependencies and Cloudflare local state in the checkout; keep historical copies in the project library. Historical SQL and review utilities are records, not setup steps.

[Operations and decision history](docs/operations.md) records implementation rationale and dated deployment configuration checks.

## Requirements

- Node.js `>=22.12.0` and npm `>=10.9.0` (`.nvmrc` selects Node 22, the major CI and Workers Builds use; `engine-strict` in `.npmrc` makes `npm ci` refuse an older toolchain)
- A Cloudflare account and Wrangler access for D1 and R2 operations

### Install policy

- **Install with `npm ci`, never `npm install`.** `package-lock.json` is the record of exactly what was reviewed: `npm ci` installs it unchanged and fails if `package.json` disagrees. Commit lockfile changes together with the `package.json` change that caused them, and use `npm install <pkg>` only when deliberately changing a dependency.
- **Native install scripts are allow-listed.** `allowScripts` in `package.json` names the dependency versions (`esbuild`, `sharp`, `workerd`) permitted to run lifecycle scripts on npm 11.17+, which warns about anything unlisted (add `--strict-allow-scripts` to make that an error). npm 10, which Node 22 bundles, ignores the field and runs install scripts, so `npm run check:lockfile` enforces the same rule on every npm: a non-optional dependency with an install script that is not listed fails the gate. A new entry is a review item, not a formality. `npm ci` was verified to work cleanly on Windows 11 (Node 24 / npm 11.17) and on Linux CI (Node 22): `sharp` ships prebuilt platform binaries, and `esbuild` and `workerd` run their small postinstall checks without a compiler.
- **Release-age policy.** Do not adopt a dependency release younger than about a week. Dependabot enforces this with a cooldown (7 days, 14 for major versions), and for manual updates use `npm install <pkg>@latest --min-release-age=7` (a recent npm 11 option; it limits which versions npm may resolve and does not affect `npm ci`).
- **Urgent exception.** For an actively exploited or high-severity advisory, skip the wait: update the one package (`npm install <pkg>@<fixed version>`), confirm the lockfile diff touches only that package and its dependencies, run `npm run verify` and `npm audit`, then ship the change through a pull request or a normal release commit. Say in the commit message that it is a release-age exception and why. Dependabot security updates ignore the cooldown by design.
- The `sharp` override in `package.json` pins the patched release while Miniflare still declares an older one; Dependabot does not manage overrides, so remove it by hand once upstream catches up.

## Release gates

`.github/workflows/ci.yml` runs on every pull request and every push to `master` and has no deploy credentials or write permissions (`contents: read` only). Deployment is still Cloudflare Workers Builds, which runs on a push to `master` independently of this workflow, so a red check reports a problem but does not by itself stop a deploy; see below.

| Job | What it checks |
| --- | --- |
| `Test, check and build` | `npm ci`, `npm test` (every `tests/*.test.*` file), `npm run check:styles`, `npm run check` (Astro type check), `npm run build`, `npm run check:inline-scripts` (no processed script inlined without a nonce) |
| `Dependency and lockfile checks` | `npm run check:lockfile` (registry-only sources, sha512 hashes, tarball names, install-script allow-list), `npm audit --audit-level=high`, `npm audit signatures` |
| `Secret scan` | a synthetic-leak self-test, then gitleaks over all git history and the working tree |
| `Release gate` | passes only if the three jobs above all succeeded; this is the one check to require |

Third-party actions are pinned to full commit SHAs and updated by Dependabot. To run the same checks locally: `npm run verify` runs the tests, style, lockfile and type checks, a build and the inlined-script check; `npm run audit:deps` runs the advisory audit; `npm run scan:secrets` runs the secret scan.

New tests: put them in `tests/` as `<name>.test.ts` or `<name>.test.mjs`. `npm test` and CI pick them up automatically; a per-file `test:<name>` script is optional convenience for running one file.

### Secret scan

GitHub secret scanning and push protection stay enabled; they cover GitHub's partner token formats. This scan adds gitleaks' generic rules (high-entropy `api_key`-style assignments, private keys and many more), including the history of the repository.

```bash
npm run scan:secrets              # git history and working tree
npm run scan:secrets -- --tree    # files on disk only, including uncommitted work
npm run scan:secrets -- --history # commits only
npm run scan:secrets -- --dir path/to/folder
npm run scan:secrets:self-test    # proves a synthetic leak is caught and a clean directory passes
```

`scripts/scan-secrets.mjs` works the same on Windows, macOS and Linux with only Node installed. It downloads one pinned gitleaks release into `.tmp/gitleaks/` (gitignored), refuses to run it unless the archive's SHA-256 matches the value recorded in the script, and exits non-zero on any finding, scanner error, bad config, failed download or checksum mismatch. To upgrade, change `VERSION` and the checksum table from the new release's `checksums.txt`, run `npm run scan:secrets:self-test`, and review the release notes.

`.gitleaks.toml` extends gitleaks' default rules and contains the only suppressions: values that are public by design, each pinned to a rule, a file and the exact value, with the reason written next to it (the IndexNow ownership key that `public/<key>.txt` already publishes, and a historical hCaptcha site key). If the scan flags something else, treat it as a real credential: rotate it at the provider first, then remove it from the code (and from history if appropriate). Do not add an allowlist entry for a credential; an entry belongs here only for an identifier that is already public and needs no rotation.

### Dependency updates

`.github/dependabot.yml` opens one grouped weekly pull request for npm (Astro, the Cloudflare adapter and Wrangler together; everything else minor and patch) plus separate major-version PRs, and one for GitHub Actions. Each runs the gates above before merge. Dependabot security updates (which open PRs for known-vulnerable packages outside the weekly schedule) are a repository setting, not a file, and must be enabled in the GitHub settings; [docs/operations.md](docs/operations.md) records the dated state of repository settings.

### SBOM

No SBOM tooling is wired into CI. `package-lock.json` already records every dependency with version, source and integrity hash, `npm audit` consumes it, and GitHub's dependency graph reads it for Dependabot alerts. A generated SBOM would add maintenance without changing any decision this site makes. If one is ever requested by a customer or a regulator, `npm sbom --sbom-format cyclonedx` produces CycloneDX from the same lockfile in one command; nothing here claims statutory compliance.

## Features

- Astro SSR on Cloudflare (`@astrojs/cloudflare`), with D1 migrations for users, sessions, content, media, categories and nav items
- Custom email/password auth (PBKDF2 hashes, D1-backed sessions; no JWT or third-party service)
- CMS editor for Markdown posts and pages with live preview (EasyMDE and its fonts are bundled npm dependencies)
- Shortcodes for rich, self-contained widgets embedded in Markdown, such as the bookmarks list and featured-link cards (`src/lib/shortcodes.ts`)
- Blog (`/blog`, `/blog/[slug]`, `/blog/category/[slug]`) with a homepage feed; cards show each post's featured image, and posts are attributed to JD in the byline and JSON-LD
- Generic pages (`/pages/[slug]`), a code-backed `/privacy-policy`, category tagging (`/category/[slug]`) and a nested navigation builder
- Media library with direct image uploads to R2
- `sitemap.xml` from published content, SEO meta tags, a static `robots.txt`, RSS at `/rss.xml` with WebSub, and IndexNow notifications
- A public, cached JSON endpoint of post summaries at `/api/posts/by-category/[slug]`
- Server-side code highlighting, Markdown sanitizing and HTML-safe inline JSON
- Accessible filters and form feedback: errors focus a summary that links to the relevant fields, including EasyMDE
- Opt-in Google Analytics through a consent banner, and security response headers set in `src/middleware.ts`

## Quick start

1. Install dependencies:

```bash
npm ci
```

2. Create the D1 database (one time):

```bash
npx wrangler d1 create orboro-db
```

3. Update `database_id` in `wrangler.toml`. For a separate deployment, also provision an R2 bucket for `MEDIA` and configure its public custom domain; local development simulates the binding. Production image URLs use `https://media.orboro.net` in `src/lib/media-upload.ts`.

4. Apply migrations locally:

```bash
npm run d1:migrate:local
```

5. Create the first admin in local D1. There is no setup page; the script inserts a user only while the users table is empty:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at least 10 characters' npm run admin:create -- --local
```

6. Start local dev with the full Cloudflare runtime, then open `http://127.0.0.1:8787/admin`:

```bash
npm run dev
```

`npm run dev` builds first and does not hot-reload. For faster work that doesn't depend on Cloudflare runtime behavior, Astro's dev server runs at `http://127.0.0.1:4321`:

```bash
npm run dev:astro
```

## Scripts

- `npm run dev` builds, then serves through `wrangler dev` (D1, Cache API and secret bindings)
- `npm run dev:astro` runs Astro's hot-reloading dev server (doesn't fully mirror the Cloudflare runtime)
- `npm run check` type-checks `.astro` and TypeScript files
- `npm test` runs every `tests/*.test.*` file; individual `npm run test:markdown`, `test:editor-preview`, `test:dates`, `test:feed`, `test:json`, `test:consent`, `test:csp`, `test:sessions`, `test:admin-guard` run one file each (the other `test:*` scripts likewise): Markdown highlighting/escaping/sanitizing, editor preview parity with publishing, page update dates, feed and sitemap output, inline-JSON safety, analytics consent behavior, CSP nonce preservation across navigation, and session tokens, revocation and cookie flags, and the admin-role guard on every admin and mutation route
- `npm run verify` runs the tests, `check:styles`, `check:lockfile`, `check`, `build` and `check:inline-scripts` in one go; `npm run audit:deps` runs the advisory audit; `npm run scan:secrets` runs the secret scan (see [Release gates](#release-gates))
- `npm run build` is the production build; `npm run preview` previews it
- `npm run deploy` builds and runs `wrangler deploy` (manual; normally a push to `master` deploys)
- `npm run admin:create -- --local|--remote` creates the first admin (see Quick start and Disaster recovery below)
- `npm run admin:reset-password -- --local|--remote` sets a new password for an existing account and revokes its sessions; `npm run sessions:revoke -- --email <email>|--all [--remote]` revokes sessions only, against local D1 unless `--remote` is given (see Credential recovery below)
- `npm run d1:migrate:local` / `d1:migrate:remote` apply migrations
- `npm run cf:types` regenerates the Cloudflare worker types
- `npm run media:migrate` previews moving content images to R2 (see Media)
- `npm run data:assisted-combat` rebuilds the assisted-combat data from research inputs outside the repo; set `ASSISTED_COMBAT_RESEARCH_ROOT` and `ASSISTED_COMBAT_NOTES_ROOT`
- `npm run data:midnight-s2-interrupts` rebuilds the interrupt reference data from its public Google Sheets source
- `npm run data:spec-icons` downloads vendored WoW spec icons; `-- --resolve` refreshes the ID map and `-- --force` refreshes images
- `npm run astro` is the Astro CLI passthrough

## Deployment

- The Worker `orboro-net` builds through Workers Builds, git-integrated with GitHub [jmusick/orboro-net](https://github.com/jmusick/orboro-net): a push to `master` runs `npm run build`, then `npx wrangler deploy`. `astro build` writes the real deploy config to `dist/server/wrangler.json`, which `wrangler deploy` and `wrangler dev` pick up.
- Workers Builds reads `.nvmrc` for its Node version. GitHub Actions CI (`.github/workflows/ci.yml`) runs independently on the same commit and has no deploy role or credentials: it reports, and Workers Builds deploys regardless of its result unless the Cloudflare side is configured otherwise. Check the CI result on a release commit before relying on the deploy.
- Repository bindings are `DB` (D1), `MEDIA` (R2) and `ASSETS` (static assets). Custom domains, production secrets and edge security rules are configured in Cloudflare, outside the repo. Wrangler enables Workers logs and sampled traces; check retention and dashboard rules in the Cloudflare account.
- Apply new schema migrations locally, verify them, then apply them remotely **before** deploying code that needs them. SQL content seeds are a separate step: pushing code does not copy local content into production.
- The app needs no runtime secrets. If one is added, put it in `.dev.vars` for local dev (gitignored) and set it in production with `wrangler secret put <NAME>`.

## Database

Numbered migrations in `migrations/` apply in order. Tables: `users`, `sessions`, `content`, `media`, `categories`, `content_categories`, `nav_items`.

The homepage combines a compact latest-article hero, featured tool pages grouped by game, and four recent articles. In the content editor, use **Feature on homepage**, choose a group, and set the display order (lower first within each group). Only published pages are eligible; draft pages and posts are excluded. Card descriptions can be supplied explicitly or fall back to introductory Markdown. Migration `0012_homepage_features.sql` adds these settings. After applying it, `npx wrangler d1 execute DB --local --file=./scripts/content/homepage-featured-tools.sql` selects the initial four existing tools (two per game). Run the same seed with `--remote` for production before deploying; re-running it restores the initial selection and descriptions for those tools.

Page and post Markdown is stored in `content.markdown`. Re-runnable seed scripts for individual pages and posts (content row, categories, nav) live in `scripts/content/*.sql`; [AGENTS.md](AGENTS.md) describes the pattern. Local D1 (`.wrangler/state/v3/d1`) is separate from production: content edited locally, through the admin UI or `wrangler d1 execute DB --local`, does not appear on the live site until reproduced against remote D1.

### Disaster recovery

If D1 is ever emptied or restored without a user, no one can sign in. Create a new admin with `npm run admin:create -- --remote` using the same `ADMIN_EMAIL` and `ADMIN_PASSWORD` variables. It is a no-op while any user exists. Note that `/admin/setup` no longer exists.

### Credential recovery

If the password or a signed-in device may be compromised, reset the password and revoke every session in one step:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at least 10 characters' npm run admin:reset-password -- --remote
```

It reports `matching_users` (0 means no account has that email) and `sessions_remaining`, which should be 0. To sign an account out everywhere without changing the password, use `npm run sessions:revoke -- --email you@example.com --remote` (or `--all` for every account), or **Sign out all sessions** on the admin dashboard. Without `--remote`, `sessions:revoke` runs against local D1.

## Content rendering

- Pages and posts render fenced code through `src/lib/markdown.ts` with server-side Highlight.js and a bundled GitHub Dark theme. Add a language after the opening fence (`js`, `ts`, `bash`, `json`, `html`, `css`, `sql`, `python`, `lua`, `yaml` or `markdown`). Unlabeled and unsupported languages stay escaped plain text; inline code is unchanged.
- The rendered HTML is sanitized against an allowlist before shortcodes expand: scripts, event handlers, `style` attributes and unsafe URL schemes are removed.
- RSS keeps plain Markdown rendering, converts relative links and images to absolute URLs, and omits scripts and styles. Posts that contain shortcodes use an excerpt and link to the full article instead of expanding widgets into the feed.
- Sitemap modification dates come from published content changes, and the privacy page and sitemap share one policy date. Article sidebars and adjacent-post links query lightweight summaries instead of full Markdown bodies.
- Accordions use native `details`/`summary` so open content can reflow. Layouts respect reduced motion, and shortcode filters have explicit keyboard focus outlines.
- To support more content types, add values to `content.page_type` and matching routes.

## Media

- The media library accepts direct uploads (PNG, JPEG, GIF, WebP or AVIF, up to 10 MiB, checked by file signature) into the `orboro-net-media` R2 bucket through the `MEDIA` binding. Bytes are stored as supplied, without decoding, resizing or metadata stripping. New uploads are recorded in D1 with `https://media.orboro.net/...` URLs; that custom domain is connected to the bucket and the `r2.dev` development URL stays disabled.
- `wrangler dev` uses a separate local R2 store. Local uploads get `/media/...` URLs and are read back through `/media/[...key]`; they never write to production. Use `npm run dev` for real bindings.
- Existing image URLs can be added to the media library. Deleting a media record removes its D1 metadata only: it doesn't delete the R2 object or update pages that reference the URL.
- The library lists D1 `media` records, not every object in R2. The content-image migration rewrites existing media records but does not create missing ones. `scripts/content/backfill-r2-media-library.sql` registers the 13 content images checked on October 6, 2026; it can be rerun without duplicating records or overwriting existing metadata.
- `npm run media:migrate -- --local` previews migrating content-referenced files from `public/images` into local R2; `--apply` copies the files and rewrites local D1 URLs. Use `--remote` only after reviewing its dry-run manifest, and `--remote --apply` to copy objects and update production D1. Migrated images live in R2 and are no longer bundled in `public/images`; repeat runs skip their URLs. Code deployment does not migrate content or objects.
- `node scripts/build-brand-images.mjs` rebuilds `public/images/social-default.png` (the 1200x630 default `og:image`, used for pages without featured artwork) and `logo-480.png` (the header logo at 2x its 240px width) from `logo.png` and `gaming-header.png`. D1 does not store image dimensions, so `og:image:width/height` are emitted only for the default image.

## Public API

`GET /api/posts/by-category/[slug]` returns published post summaries for a category (title, slug, absolute URL and featured image URL, plain-text excerpt) with a ten-minute edge cache. An unknown slug returns a `404` JSON body. It serves plain excerpts rather than rendered bodies because shortcodes only resolve inside this site's render pipeline.

## Security and privacy

- Admin login is password-only, with in-Worker throttling and no MFA or self-service password recovery. Sessions last an absolute 14 days from sign-in, with no idle timeout. D1 stores only a SHA-256 digest of each session token, and the cookie is `__Host-orboro_session` over HTTPS. Logout revokes the current session; **Sign out all sessions** and the operator scripts under Credential recovery revoke all of an account's sessions.
- Author Markdown is sanitized and inline JSON is encoded for HTML, and the nonce-based CSP is enforced (without a report endpoint). Inline style attributes are blocked; widgets use classes or direct style-property updates. HTTPS images are permitted for article artwork and bookmark favicons. Publishing is a trusted-admin capability, and these controls don't establish safe untrusted publishing.
- Google Analytics loads only after acceptance in `ConsentBanner.astro`, on `BaseLayout` pages (including the login page) but never in the authenticated admin layout. Without acceptance or JavaScript the Google tag is never fetched. Accepted page views send the full URL, including query strings.
- The choice is stored in the browser's localStorage as `orboro-analytics-consent` until changed or cleared. Footer **Cookie preferences** reopens the banner. Withdrawing consent disables analytics, clears GA cookies on the current host and parent domains, and reloads; other open tabs follow through storage events. If localStorage is unavailable the choice lasts only until a full reload.
- Consent grants analytics storage only and keeps advertising storage, advertising user data and ad personalization denied. It doesn't gate necessary admin session cookies, Cloudflare hosting requests, or external images and favicons.
- Bookmark data is fetched server-side with a ten-minute cache, but browsers load favicon URLs supplied by Tagstash and a Google-hosted credit icon directly. Those images use `referrerpolicy="no-referrer"` and still contact their hosts.
- Analytics retention, Google data-sharing settings, Cloudflare log retention and live edge rules can't be established from this repo; check those dashboards before making claims in the privacy policy.
- `/privacy-policy` (`src/pages/privacy-policy.astro`) describes what tracking is active. Update it, and `PRIVACY_UPDATED_AT` in `src/lib/privacy.ts`, whenever you add, remove or change a tracking script.

## Troubleshooting

- If content or admin changes don't show up in local dev, apply local migrations: `npm run d1:migrate:local`.
- `npm run dev` uses configured Cloudflare bindings and local D1; `npm run dev:astro` runs Astro directly and may differ (for example `caches.default` and `.dev.vars` secrets).
- Dependency security: the lockfile updates Astro, its Cloudflare adapter, Wrangler, cache semantics and source-map-js; a `sharp` override pins the patched 0.35.5 release while Miniflare still declares 0.35.4. Remove that override once upstream uses a patched release, after checking `npm audit` and rebuilding.
- Apply schema updates with `npm run d1:migrate:remote` before testing against remote data.
- To verify the consent banner, change a saved choice through footer **Cookie preferences**. In developer tools, confirm no `gtag.js` request before acceptance or after declining, then check acceptance, reloads, in-site navigation and withdrawal at desktop and phone widths. `npm run test:consent` verifies controller behavior, not visual layout.

## Design system

- `src/styles/tokens.css` is the shared palette, typography, spacing, radius and interaction source for both layouts. Use token-relative accent tints (`rgb(from var(--accent) r g b / …)`) instead of fixed RGB values.
- `src/styles/primitives.css` supplies opt-in `ui-control`, `ui-action`, `ui-panel` and `ui-callout` classes for components and trusted shortcode HTML. Widget-specific CSS owns layout, density and semantic states; include the same classes in server and client render templates. These styles are loaded by both layouts, outside nonce-sensitive cached shortcode output.
- `src/styles/editor.css` owns the EasyMDE theme, loaded after the vendor CSS. The editor script no longer injects a duplicate theme at runtime.
- `src/styles/forms.css` owns `.form-group` labels and fields, including focus and disabled states. Keep route-specific CSS for form grids, spacing and actions. Preserve hint IDs and the existing `FormMessage` behavior.
- `SidebarLayout.astro` owns the shared content/sidebar columns and mobile breakpoint. Set `sidebar={false}` for full-width widgets. `PageHeader.astro` (in BaseLayout's `hero` slot, over `HeroArt.astro`) titles every inner page; `StoryCard.astro` supplies post cards, `TopicChip.astro` category chips and `FeaturedTools.astro` the homepage tool tiles.
- Visit `/admin/design-system` while signed in as an admin for component examples, field feedback and a live widget. The page is excluded from analytics and requires the admin role.
- Run `npm run check:styles` before shipping style changes. It checks fixed accent tints, off-scale radii, hover lift, empty or broad transitions, unimported monospace fonts, and duplicate token definitions. `npm run check` and `npm run build` verify types and compilation; use a browser for layout and interaction checks.
