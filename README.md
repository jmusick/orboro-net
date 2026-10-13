# Orboro.net

Orboro.net is a personal site and Markdown CMS built with Astro 7 and deployed as a Cloudflare Worker. Content and accounts live in Cloudflare D1, and uploaded images live in Cloudflare R2. It runs the live site at [orboro.net](https://orboro.net), and you can run your own copy with the steps below. See `package.json` for the current version.

The CMS is built for a single admin. The `users.role` column also accepts `editor` and `author`, but those roles grant no access: every admin page and mutation endpoint requires `admin`, and a signed-in non-admin sees only an access-denied page with a sign-out button. There is no public registration or user-management UI.

## Features

- Astro SSR on Cloudflare (`@astrojs/cloudflare`), with D1 migrations for users, sessions, content, media, categories and nav items
- Custom email/password auth (PBKDF2 hashes, D1-backed sessions; no JWT or third-party service)
- CMS editor for Markdown posts and pages with live preview (EasyMDE and its fonts are bundled npm dependencies)
- Shortcodes for rich, self-contained widgets embedded in Markdown, such as the bookmarks list and featured-link cards (`src/lib/shortcodes.ts`)
- Blog (`/blog`, `/blog/[slug]`, `/blog/category/[slug]`) with a homepage feed and featured images on post cards
- Generic pages (`/pages/[slug]`), a code-backed `/privacy-policy`, category tagging (`/category/[slug]`) and a nested navigation builder
- Media library with direct image uploads to R2
- `sitemap.xml` from published content, SEO meta tags, a static `robots.txt`, RSS at `/rss.xml` with WebSub, and IndexNow notifications
- A public, cached JSON endpoint of post summaries at `/api/posts/by-category/[slug]`
- Server-side code highlighting, Markdown sanitizing and HTML-safe inline JSON
- Accessible filters and form feedback: errors focus a summary that links to the relevant fields, including EasyMDE
- Opt-in Google Analytics through a consent banner, and security response headers set in `src/middleware.ts`

## Requirements

- Node.js `>=22.12.0` and npm `>=10.9.0`. `.nvmrc` selects Node 22, and `engine-strict` in `.npmrc` makes `npm ci` refuse an older toolchain.
- A Cloudflare account with Wrangler access, for deploying and for remote D1 and R2 operations. Local development needs no account.

Install with `npm ci`, not `npm install`. `package-lock.json` records exactly what was reviewed, and `npm ci` installs it unchanged. Use `npm install <pkg>` only when deliberately changing a dependency, and commit the lockfile change with the `package.json` change that caused it.

Only the dependencies listed in `allowScripts` in `package.json` (`esbuild`, `sharp`, `workerd`) may run install scripts. npm 11.17+ warns about anything unlisted; npm 10 ignores the field, so `npm run check:lockfile` enforces the same rule on any npm version. `npm ci` works on Windows, macOS and Linux without a compiler: `sharp` ships prebuilt binaries, and `esbuild` and `workerd` only run small postinstall checks.

## Quick start

These steps run the site locally with simulated D1 and R2. Nothing touches a Cloudflare account.

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Apply migrations to the local D1 database:

   ```bash
   npm run d1:migrate:local
   ```

3. Create the first admin. There is no setup page; the script inserts a user only while the users table is empty:

   ```bash
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at least 10 characters' npm run admin:create -- --local
   ```

4. Start local dev with the full Cloudflare runtime, then open `http://127.0.0.1:8787/admin`:

   ```bash
   npm run dev
   ```

`npm run dev` builds first and doesn't hot-reload. For faster work that doesn't depend on Cloudflare runtime behavior, Astro's dev server runs at `http://127.0.0.1:4321`:

```bash
npm run dev:astro
```

Use `127.0.0.1` rather than `localhost`; some integrations need an exact origin match.

## Making it your own

The repository is the source of the live orboro.net site, so several values are specific to it. Before deploying your own copy, change these:

| What | Where |
| --- | --- |
| Worker name, D1 database and R2 bucket | `wrangler.toml` (`name`, `database_name`, `database_id`, `bucket_name`) |
| Canonical site URL | `site` in `astro.config.mjs`; `public/robots.txt`; the `https://orboro.net` fallbacks in `src/layouts/` and `src/pages/` |
| Public media domain | `MEDIA_ORIGIN` in `src/lib/media-upload.ts` and the mention in `src/pages/privacy-policy.astro` |
| Google Analytics | `MEASUREMENT_ID` in `src/components/ConsentBanner.astro` |
| IndexNow and WebSub | `src/lib/indexnow.ts` (host and key), the key file in `public/`, and the production hostname check in `src/pages/api/content/save.ts` |
| Site owner and profiles | the `WebSite` and `Person` JSON-LD in `src/pages/index.astro`, and `src/lib/profiles.ts` (footer profiles and Patreon link) |
| Privacy policy | `src/pages/privacy-policy.astro` and `PRIVACY_UPDATED_AT` in `src/lib/privacy.ts` |
| Logo and artwork | `public/images/`, then `node scripts/build-brand-images.mjs` to rebuild the social and header images |

Generate a new IndexNow key rather than reusing the published one. The SQL files in `scripts/content/` seed orboro.net's own articles and tool pages; they are examples of the seed pattern, not setup steps.

## Deploying

1. Create a D1 database and copy its ID into `database_id` in `wrangler.toml`:

   ```bash
   npx wrangler d1 create <your-db-name>
   ```

2. Create an R2 bucket for the `MEDIA` binding, connect a public custom domain to it, and set `MEDIA_ORIGIN` to that domain:

   ```bash
   npx wrangler r2 bucket create <your-bucket-name>
   ```

3. Apply migrations to the remote database and create the first admin there:

   ```bash
   npm run d1:migrate:remote
   ```

   ```bash
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at least 10 characters' npm run admin:create -- --remote
   ```

4. Deploy:

   ```bash
   npm run deploy
   ```

`astro build` writes the real deploy config to `dist/server/wrangler.json`, which `wrangler deploy` and `wrangler dev` pick up. To deploy on every push instead, connect the repository to [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) with build command `npm run build` and deploy command `npx wrangler deploy`; it reads `.nvmrc` for the Node version.

- Bindings are `DB` (D1), `MEDIA` (R2) and `ASSETS` (static assets). Custom domains, production secrets and edge security rules are configured in Cloudflare, outside the repository. Wrangler enables Workers logs and sampled traces.
- Apply new schema migrations locally, verify them, then apply them remotely **before** deploying code that needs them. Content you create in local D1 stays local; deploying code doesn't copy it to production.
- The app needs no runtime secrets. If you add one, put it in `.dev.vars` for local dev (gitignored) and set it in production with `wrangler secret put <NAME>`.

## Scripts

- `npm run dev` builds, then serves through `wrangler dev` (D1, Cache API and secret bindings)
- `npm run dev:astro` runs Astro's hot-reloading dev server (doesn't fully mirror the Cloudflare runtime)
- `npm run build` is the production build; `npm run preview` previews it
- `npm run deploy` builds and runs `wrangler deploy`
- `npm run check` type-checks `.astro` and TypeScript files
- `npm test` runs every `tests/*.test.*` file; each `test:<name>` script runs one file
- `npm run verify` runs the tests, `check:styles`, `check:lockfile`, `check`, `build` and `check:inline-scripts` in one go
- `npm run audit:deps` runs the advisory audit; `npm run scan:secrets` runs the secret scan (see [Release gates](#release-gates))
- `npm run admin:create -- --local|--remote` creates the first admin
- `npm run admin:reset-password -- --local|--remote` sets a new password for an existing account and revokes its sessions; `npm run sessions:revoke -- --email <email>|--all [--remote]` revokes sessions only (see [Credential recovery](#credential-recovery))
- `npm run d1:migrate:local` / `d1:migrate:remote` apply migrations
- `npm run cf:types` regenerates the Cloudflare worker types
- `npm run media:migrate` previews moving content images from `public/images` to R2 (see [Media](#media))
- `npm run data:midnight-s2-interrupts` rebuilds the interrupt reference data from its public Google Sheets source
- `npm run data:spec-icons` downloads vendored WoW spec icons; `-- --resolve` refreshes the ID map and `-- --force` refreshes images
- `npm run data:assisted-combat` rebuilds the assisted-combat data from research inputs that aren't in this repository (set `ASSISTED_COMBAT_RESEARCH_ROOT` and `ASSISTED_COMBAT_NOTES_ROOT`)
- `npm run astro` is the Astro CLI passthrough

## Release gates

`.github/workflows/ci.yml` runs on every pull request and every push to `master`. It has read-only repository access and no deploy credentials, so it reports problems but can't deploy or block a deploy by itself.

| Job | What it checks |
| --- | --- |
| `Test, check and build` | `npm ci`, `npm test`, `npm run check:styles`, `npm run check`, `npm run build`, `npm run check:inline-scripts` (no processed script inlined without a nonce) |
| `Dependency and lockfile checks` | `npm run check:lockfile` (registry-only sources, sha512 hashes, tarball names, install-script allow-list), `npm audit --audit-level=high`, `npm audit signatures` |
| `Secret scan` | a synthetic-leak self-test, then gitleaks over all git history and the working tree |
| `Release gate` | passes only if the three jobs above all succeeded |

Third-party actions are pinned to full commit SHAs. To run the same checks locally, use `npm run verify`, `npm run audit:deps` and `npm run scan:secrets`.

New tests go in `tests/` as `<name>.test.ts` or `<name>.test.mjs`; `npm test` and CI pick them up automatically.

### Secret scan

```bash
npm run scan:secrets              # git history and working tree
npm run scan:secrets -- --tree    # files on disk only, including uncommitted work
npm run scan:secrets -- --history # commits only
npm run scan:secrets -- --dir path/to/folder
npm run scan:secrets:self-test    # proves a synthetic leak is caught and a clean directory passes
```

`scripts/scan-secrets.mjs` works on Windows, macOS and Linux with only Node installed. It downloads one pinned gitleaks release into `.tmp/gitleaks/` (gitignored), refuses to run it unless the archive's SHA-256 matches the value in the script, and exits non-zero on any finding, scanner error, bad config, failed download or checksum mismatch. To upgrade, change `VERSION` and the checksum table from the new release's `checksums.txt`, then run `npm run scan:secrets:self-test`.

`.gitleaks.toml` extends gitleaks' default rules. Its only suppressions are values that are public by design, each pinned to a rule, a file and the exact value. If the scan flags anything else, treat it as a real credential: rotate it at the provider first, then remove it from the code. Never add an allowlist entry for a credential.

## Database

Numbered migrations in `migrations/` apply in order. Tables: `users`, `sessions`, `content`, `media`, `categories`, `content_categories`, `nav_items`, `login_attempts`.

Page and post Markdown is stored in `content.markdown`. Local D1 (`.wrangler/state/v3/d1`) is separate from production: content edited locally, through the admin UI or `wrangler d1 execute DB --local`, doesn't appear on the live site until it is reproduced against remote D1. Re-runnable seed scripts for individual pages and posts follow the pattern described in [AGENTS.md](AGENTS.md).

The homepage combines a latest-article hero, featured tool pages grouped by game, and four recent articles. In the content editor, use **Feature on homepage**, choose a group and set the display order (lower first within each group). Only published pages are eligible. Card descriptions can be supplied explicitly or fall back to introductory Markdown.

### Disaster recovery

If D1 is ever emptied or restored without a user, no one can sign in. Create a new admin with `npm run admin:create -- --remote` using the same `ADMIN_EMAIL` and `ADMIN_PASSWORD` variables. It does nothing while any user exists.

### Credential recovery

If the password or a signed-in device may be compromised, reset the password and revoke every session in one step:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at least 10 characters' npm run admin:reset-password -- --remote
```

It reports `matching_users` (0 means no account has that email) and `sessions_remaining`, which should be 0. To sign an account out everywhere without changing the password, use `npm run sessions:revoke -- --email you@example.com --remote` (or `--all` for every account), or **Sign out all sessions** on the admin dashboard. Without `--remote`, `sessions:revoke` runs against local D1.

## Content rendering

- Pages and posts render fenced code through `src/lib/markdown.ts` with server-side Highlight.js and a bundled GitHub Dark theme. Add a language after the opening fence (`js`, `ts`, `bash`, `json`, `html`, `css`, `sql`, `python`, `lua`, `yaml` or `markdown`). Unlabeled and unsupported languages stay escaped plain text.
- The rendered HTML is sanitized against an allowlist before shortcodes expand: scripts, event handlers, `style` attributes and unsafe URL schemes are removed.
- RSS keeps plain Markdown rendering, converts relative links and images to absolute URLs, and omits scripts and styles. Posts that contain shortcodes use an excerpt and link to the full article.
- Sitemap modification dates come from published content changes, and the privacy page and sitemap share one policy date.
- To support more content types, add values to `content.page_type` and matching routes.

## Media

- The media library accepts direct uploads (PNG, JPEG, GIF, WebP or AVIF, up to 10 MiB, checked by file signature) into R2 through the `MEDIA` binding. Bytes are stored as supplied, without decoding, resizing or metadata stripping. New uploads are recorded in D1 with URLs under `MEDIA_ORIGIN`.
- `wrangler dev` uses a separate local R2 store. Local uploads get `/media/...` URLs and are read back through `/media/[...key]`; they never write to production.
- Existing image URLs can be added to the media library. Deleting a media record removes its D1 metadata only: it doesn't delete the R2 object or update pages that reference the URL. The library lists D1 `media` records, not every object in R2.
- `npm run media:migrate -- --local` previews moving content-referenced files from `public/images` into local R2, and `--apply` copies them and rewrites local D1 URLs. Use `--remote` only after reviewing its dry-run manifest. Repeat runs skip URLs that were already migrated.
- `node scripts/build-brand-images.mjs` rebuilds `public/images/social-default.png` (the default 1200x630 `og:image`) and `logo-480.png` (the header logo at 2x) from `logo.png` and `gaming-header.png`.

## Public API

`GET /api/posts/by-category/[slug]` returns published post summaries for a category (title, slug, absolute URL, featured image URL and a plain-text excerpt) with a ten-minute edge cache. An unknown slug returns a `404` JSON body. It serves plain excerpts rather than rendered bodies because shortcodes only resolve inside this site's render pipeline.

## Security and privacy

- Admin login is password-only, with in-Worker throttling and no MFA or self-service password recovery. Sessions last an absolute 14 days from sign-in, with no idle timeout. D1 stores only a SHA-256 digest of each session token, and over HTTPS the cookie is `__Host-orboro_session`.
- Author Markdown is sanitized, inline JSON is encoded for HTML, and a nonce-based CSP is enforced. Inline style attributes are blocked. Publishing is a trusted-admin capability; these controls don't make it safe to publish untrusted content.
- Google Analytics loads only after acceptance in `ConsentBanner.astro`, and never in the authenticated admin layout. Without acceptance or JavaScript the Google tag is never fetched. The choice is stored in localStorage as `orboro-analytics-consent`, and footer **Cookie preferences** reopens the banner. Withdrawing consent disables analytics, clears GA cookies and reloads.
- Consent grants analytics storage only and keeps advertising storage, advertising user data and ad personalization denied.
- The bookmarks shortcode fetches its data server-side, but browsers load the bookmark favicons and a credit icon directly from their hosts (with `referrerpolicy="no-referrer"`).
- `/privacy-policy` describes what tracking is active. Update it, and `PRIVACY_UPDATED_AT` in `src/lib/privacy.ts`, whenever you add, remove or change a tracking script. Retention and data-sharing settings live in your analytics and Cloudflare dashboards, not in this repository.

## Troubleshooting

- If content or admin changes don't show up in local dev, apply local migrations: `npm run d1:migrate:local`.
- `npm run dev` uses the configured Cloudflare bindings and local D1; `npm run dev:astro` runs Astro directly and may differ (for example `caches.default` and `.dev.vars` secrets).
- Cached shortcode responses persist in `.wrangler/state/v3/cache` across restarts. Stop the server and delete `.wrangler/state/v3/cache/miniflare-CacheObject` to clear them.
- Apply schema updates with `npm run d1:migrate:remote` before testing against remote data.
- To check the consent banner, change a saved choice through footer **Cookie preferences**, then confirm in developer tools that no `gtag.js` request happens before acceptance or after declining. `npm run test:consent` covers controller behavior, not visual layout.

## Design system

- `src/styles/tokens.css` is the shared palette, typography, spacing, radius and interaction source for both layouts. `src/styles/primitives.css` supplies opt-in `ui-control`, `ui-action`, `ui-panel` and `ui-callout` classes, `src/styles/forms.css` owns form fields, and `src/styles/editor.css` owns the EasyMDE theme.
- `SidebarLayout.astro` owns the content and sidebar columns. `PageHeader.astro` titles every inner page over `HeroArt.astro`; `StoryCard.astro`, `TopicChip.astro` and `FeaturedTools.astro` supply post cards, category chips and homepage tool tiles.
- Visit `/admin/design-system` while signed in for component examples, field feedback and a live widget.
- Run `npm run check:styles` before shipping style changes. It checks fixed accent tints, off-scale radii, hover lift, broad transitions, unimported monospace fonts and duplicate token definitions.

## Further reading

- [AGENTS.md](AGENTS.md): code conventions, architecture notes and known gotchas
- [docs/maintainer.md](docs/maintainer.md): how the live orboro.net site is run and maintained
- [docs/operations.md](docs/operations.md): dated configuration checks and decision history
