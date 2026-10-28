# Orboro.net

Orboro.net is a personal site and Markdown CMS built with Astro 7 and deployed as a Cloudflare Worker. Content and accounts live in Cloudflare D1, and uploaded images live in Cloudflare R2. It runs the live site at [orboro.net](https://orboro.net), and you can run your own copy with the steps below. See `package.json` for the current version.

The CMS is built for a single admin. The `users.role` column also accepts `editor` and `author`, but those roles grant no access: every admin page and mutation endpoint requires `admin`, and a signed-in non-admin sees only an access-denied page with a sign-out button. Public visitors can register a separate **member** account (its own table, sessions and cookie) to comment and vote; members can never reach the admin area.

## Features

- Astro SSR on Cloudflare (`@astrojs/cloudflare`), with D1 migrations for users, sessions, content, media, categories, nav items, and member accounts, comments, votes and reports
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
- Member accounts (`/account`): registration with email confirmation, sign-in by username or email, password reset, email change, profile, sign out everywhere and account deletion, plus public profiles at `/u/[username]`
- Threaded comments on pages and posts with reddit-style up/down votes, Best/Top/New/Old sorting, nested replies, edits, deletes and reports; each page's comments can be open, locked or hidden
- Admin moderation: a reported-comments queue and recent comments (`/admin/comments`), and member management (`/admin/members`: search, suspend, reinstate, confirm email, sign out, delete)

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

2. Copy the local settings. `.dev.vars.example` holds Cloudflare's public Turnstile test keys, which always pass:

   ```bash
   cp .dev.vars.example .dev.vars
   ```

3. Apply migrations to the local D1 database:

   ```bash
   npm run d1:migrate:local
   ```

4. Create the first admin. There is no setup page; the script inserts a user only while the users table is empty. The password must be 15 to 128 characters (counted as Unicode code points, never trimmed or truncated) and must not contain the site name or the email's name. It is also screened against known breaches through the [Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords) range API, which receives only the first five characters of the password's SHA-1. If that service can't be reached the script refuses; `--skip-breach-check` proceeds without screening:

   ```bash
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='15 to 128 characters' npm run admin:create -- --local
   ```

5. Start local dev with the full Cloudflare runtime, then open `http://127.0.0.1:8787/admin`:

   ```bash
   npm run dev
   ```

`npm run dev` builds first and doesn't hot-reload. For faster work that doesn't depend on Cloudflare runtime behavior, Astro's dev server runs at `http://127.0.0.1:4321`:

```bash
npm run dev:astro
```

Use `127.0.0.1` rather than `localhost`; some integrations need an exact origin match.

Member email is simulated locally: `wrangler dev` doesn't send it, and instead prints `send_email binding called` with the paths of the text and HTML files it wrote under `.wrangler/tmp/email/`. Open the text file to follow a confirmation or reset link.

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
| Member email sender | `MEMBER_EMAIL_FROM` in `src/lib/member-email.ts` and `allowed_sender_addresses` in `wrangler.toml` |
| Turnstile | `TURNSTILE_SITE_KEY` in `wrangler.toml` and the `TURNSTILE_SECRET_KEY` secret |
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
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='15 to 128 characters' npm run admin:create -- --remote
   ```

4. Set up member accounts:
   - Create a Turnstile widget (Cloudflare dashboard, Turnstile) for your hostname, put its site key in `TURNSTILE_SITE_KEY` in `wrangler.toml`, and store its secret key:

     ```bash
     npx wrangler secret put TURNSTILE_SECRET_KEY
     ```

   - Onboard your sending domain in Cloudflare Email Service (Email Sending) so the `EMAIL` binding can send from the address in `allowed_sender_addresses`. Until it is set up, registration still succeeds but confirmation and reset emails fail (logged as `member.email.failed`).

5. Deploy:

   ```bash
   npm run deploy
   ```

`astro build` writes the real deploy config to `dist/server/wrangler.json`, which `wrangler deploy` and `wrangler dev` pick up. To deploy on every push instead, connect the repository to [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) with build command `npm run build` and deploy command `npx wrangler deploy`; it reads `.nvmrc` for the Node version.

- Bindings are `DB` (D1), `MEDIA` (R2), `ASSETS` (static assets) and `EMAIL` (Cloudflare Email Service, member account email). Custom domains, production secrets and edge security rules are configured in Cloudflare, outside the repository. Wrangler enables Workers logs and sampled traces.
- Apply new schema migrations locally, verify them, then apply them remotely **before** deploying code that needs them. Content you create in local D1 stays local; deploying code doesn't copy it to production.
- The one runtime secret is `TURNSTILE_SECRET_KEY`. Local dev reads it from `.dev.vars` (gitignored; copy `.dev.vars.example`), production from `wrangler secret put`. Without it, registration and password reset refuse with "temporarily unavailable" rather than skipping the check.

## Scripts

- `npm run dev` builds, then serves through `wrangler dev` (D1, Cache API and secret bindings)
- `npm run dev:astro` runs Astro's hot-reloading dev server (doesn't fully mirror the Cloudflare runtime)
- `npm run build` is the production build; `npm run preview` previews it
- `npm run deploy` builds and runs `wrangler deploy`
- `npm run check` type-checks `.astro` and TypeScript files
- `npm test` runs every `tests/*.test.*` file; each `test:<name>` script runs one file
- `npm run verify` runs the tests, `check:styles`, `check:lockfile`, `check`, `build` and `check:inline-scripts` in one go
- `npm run audit:deps` runs the advisory audit; `npm run scan:secrets` runs the secret scan (see [CI](#ci))
- `npm run admin:create -- --local|--remote` creates the first admin
- `npm run admin:reset-password -- --local|--remote` sets a new password for an existing account and revokes its sessions; `npm run sessions:revoke -- --email <email>|--all [--remote]` revokes sessions only (see [Credential recovery](#credential-recovery))
- `npm run d1:migrate:local` / `d1:migrate:remote` apply migrations
- `npm run cf:types` regenerates the Cloudflare worker types
- `npm run media:migrate` previews moving content images from `public/images` to R2 (see [Media](#media))
- `npm run data:midnight-s2-interrupts` rebuilds the interrupt reference data from its public Google Sheets source
- `npm run data:spec-icons` downloads vendored WoW spec icons; `-- --resolve` refreshes the ID map and `-- --force` refreshes images
- `npm run data:assisted-combat` rebuilds the assisted-combat data from research inputs that aren't in this repository (set `ASSISTED_COMBAT_RESEARCH_ROOT` and `ASSISTED_COMBAT_NOTES_ROOT`)
- `npm run astro` is the Astro CLI passthrough

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`. It calls two shared workflows from [jmusick/ci](https://github.com/jmusick/ci), pinned by commit SHA with the release tag as a comment (Dependabot proposes newer releases). It has read-only repository access and no deploy credentials, so it reports problems but can't deploy or block a deploy by itself.

| Job | What it checks |
| --- | --- |
| `Baseline` | gitleaks over all git history (reads `.gitleaks.toml`), the npm version floor, the shared lockfile integrity check, `npm ci --ignore-scripts`, `npm audit --audit-level=high`, `npm audit signatures`, and dependency review on pull requests |
| `Web app` | `npm ci`, `npm run check:styles`, `npm run check`, `npm test`, `npm run scan:secrets:self-test`, `npm run build`, `npm run check:inline-scripts` (no processed script inlined without a nonce) |
| `CI gate` | passes only if the two jobs above succeeded |

To run the same checks locally, use `npm run verify`, `npm run audit:deps` and `npm run scan:secrets`. The local secret scan also covers the working tree, which the shared baseline doesn't.

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

Pick the path by what was lost. All three were rehearsed against throwaway copies on October 13, 2026 ([docs/operations.md](docs/operations.md)).

**A bad write or deletion in D1 within the last 30 days (Workers Paid; 7 on Free).** Use D1 Time Travel, which restores the database in place to a minute or a bookmark. Note the current bookmark first so the restore itself can be undone:

```bash
npx wrangler d1 time-travel info orboro-db
npx wrangler d1 time-travel restore orboro-db --timestamp=2026-10-13T20:00:00Z
```

**A lost database, or recovery older than Time Travel.** Restore from an export taken earlier with `npx wrangler d1 export orboro-db --remote --output=<file>.sql`. The export holds password hashes and session digests, so keep it out of the repository and treat it as a credential. Rehearse into a new database first, never straight into production:

```bash
npx wrangler d1 create orboro-db-restore
node scripts/split-d1-export.mjs backup.sql restore-parts
npx wrangler d1 execute orboro-db-restore --remote --file=restore-parts/01-d1_migrations.sql
```

Import every part in name order. The splitter exists because importing the whole export in one `--file` call failed with `{"D1_RESET_DO":true}` while each table imported cleanly. Check row counts and `PRAGMA foreign_key_check` against what you expect, then point `database_id` in `wrangler.toml` at the restored database and deploy. A restore fails if any row references a missing parent (for example content whose author was deleted outside the app); `scripts/content/repair-orphaned-authors.sql` fixes the known case.

**Lost or damaged R2 media.** R2 has no versioning or point-in-time restore here, so recovery needs a copy made beforehand. Every object the site uses is referenced from D1 (`media.url`, `content.featured_image_url` and URLs in Markdown under `MEDIA_ORIGIN`). Fetch each one with `npx wrangler r2 object get orboro-net-media/<key> --remote --file=<path>`, and restore with `wrangler r2 object put … --content-type <type> --cache-control "public, max-age=31536000, immutable"`. Wrangler cannot list a bucket, so objects nothing references are not covered by this method.

**No user after a restore.** If D1 is ever emptied or restored without a user, no one can sign in. Create a new admin with `npm run admin:create -- --remote` using the same `ADMIN_EMAIL` and `ADMIN_PASSWORD` variables. It does nothing while any user exists.

### Credential recovery

If the password or a signed-in device may be compromised, reset the password and revoke every session in one step:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='15 to 128 characters' npm run admin:reset-password -- --remote
```

It reports `matching_users` (0 means no account has that email) and `sessions_remaining`, which should be 0. To sign an account out everywhere without changing the password, use `npm run sessions:revoke -- --email you@example.com --remote` (or `--all` for every account), or **Sign out all sessions** on the admin dashboard. Without `--remote`, `sessions:revoke` runs against local D1.

The app's only runtime secret is the Turnstile secret key (rotate it in the Turnstile dashboard, then `npx wrangler secret put TURNSTILE_SECRET_KEY`), so credential rotation is the admin password (above), that key, plus the Cloudflare side: the Workers Builds API token (Worker → Settings → Builds) and any Wrangler login on a machine that may be compromised (`npx wrangler logout`, then revoke the session under the Cloudflare profile's API tokens).

### Security events

The Worker writes one structured log line per security event (`src/lib/security-events.ts`), queryable in Workers Logs by the `security_event` field:

| Event | When |
| --- | --- |
| `auth.login.succeeded` / `auth.login.failed` | Sign-in outcome; failures carry `reason` (`credentials`, `malformed`, `too-large`…) and `account` (`known`/`unknown`) |
| `auth.login.throttled` / `auth.login.unavailable` | The in-Worker limiter refused (`429`) or failed closed (`503`) |
| `auth.session.rejected` / `auth.session.lookup-failed` | An admin or member session cookie matched no live session, or the lookup errored (`reason: member` for member cookies) |
| `authz.denied` | An admin page or endpoint was refused (`signed-out` or `forbidden`), or a member action was (`member-signed-out` or `unverified`) |
| `admin.action` | Every signed-in admin POST under `/api/` (content, categories, media, nav, moderation, logout, sign out everywhere) with `action`, `target`, `outcome` and `status` |
| `member.registered` / `member.login.succeeded` / `member.login.failed` | Member sign-up and sign-in outcomes, by member ID; failures carry `reason` (`credentials`, `suspended`, `malformed`) |
| `member.limited` / `member.unavailable` | A member budget refused a request, or the limiter or breach check failed |
| `member.turnstile.failed` / `member.email.failed` | Turnstile refused or couldn't be reached, or an account email couldn't be sent |
| `member.action` | Every signed-in member POST under `/api/members/` and `/api/comments/`, with `member` instead of `user` |

Each line also has the method, path (never the query string), Cloudflare ray ID, country and ASN. Events never contain emails, passwords, cookies, tokens, request bodies or IP addresses: fields outside a fixed allowlist, or values that don't match their pattern, are dropped and counted in `dropped`.

## Content rendering

- Pages and posts render fenced code through `src/lib/markdown.ts` with server-side Highlight.js and a bundled GitHub Dark theme. Add a language after the opening fence (`js`, `ts`, `bash`, `json`, `html`, `css`, `sql`, `python`, `lua`, `yaml` or `markdown`). Unlabeled and unsupported languages stay escaped plain text.
- The rendered HTML is sanitized against an allowlist before shortcodes expand: scripts, event handlers, `style` attributes and unsafe URL schemes are removed.
- RSS keeps plain Markdown rendering, converts relative links and images to absolute URLs, and omits scripts and styles. Posts that contain shortcodes use an excerpt and link to the full article.
- Sitemap modification dates come from published content changes, and the privacy page and sitemap share one policy date.
- To support more content types, add values to `content.page_type` and matching routes.

## Media

Artwork in heroes, cards, tool tiles, topic banners and adjacent-post links uses Cloudflare Image Transformations through `src/lib/images.ts`, serving width variants with `srcset` and slot-specific `sizes` (quality 80, automatic format). Enable Transformations for your production zone with source access restricted to that zone and its subdomains. The helper targets `https://orboro.net`; forks must update that origin and `MEDIA_ORIGIN`. Foreign images and all local/preview requests retain their original URLs, so Wrangler needs no transformation service. Original R2 objects and social-preview image URLs stay unchanged.

- The media library accepts direct uploads (PNG, JPEG, GIF, WebP or AVIF, up to 10 MiB, checked by file signature) into R2 through the `MEDIA` binding. Bytes are stored as supplied, without decoding, resizing or metadata stripping. New uploads are recorded in D1 with URLs under `MEDIA_ORIGIN`.
- `wrangler dev` uses a separate local R2 store. Local uploads get `/media/...` URLs and are read back through `/media/[...key]`; they never write to production.
- Existing image URLs can be added to the media library. Deleting a media record removes its D1 metadata only: it doesn't delete the R2 object or update pages that reference the URL. The library lists D1 `media` records, not every object in R2.
- `npm run media:migrate -- --local` previews moving content-referenced files from `public/images` into local R2, and `--apply` copies them and rewrites local D1 URLs. Use `--remote` only after reviewing its dry-run manifest. Repeat runs skip URLs that were already migrated.
- `node scripts/build-brand-images.mjs` rebuilds `public/images/social-default.png` (the default 1200x630 `og:image`) and `logo-480.png` (the header logo at 2x) from `logo.png` and `gaming-header.png`.

## Public API

`GET /api/posts/by-category/[slug]` returns published post summaries for a category (title, slug, absolute URL, featured image URL and a plain-text excerpt) with a ten-minute edge cache. An unknown slug returns a `404` JSON body. It serves plain excerpts rather than rendered bodies because shortcodes only resolve inside this site's render pipeline.

## Security and privacy

- Member accounts are separate from admin accounts: `members`, `member_sessions` and the `__Host-orboro_member` cookie never satisfy `requireAdmin`, and an admin session never satisfies `requireMember`. Members use the same password rules and hasher as the admin, plus breach screening that fails open (an outage at Pwned Passwords doesn't block sign-ups). Registration and password reset are protected by Turnstile and in-Worker budgets, and neither reveals whether an email has an account. Comments are plain text, escaped on output, with `rel="ugc nofollow"` links.
- Admin login is password-only, with in-Worker throttling and no MFA or self-service password recovery. Passwords are stored as PBKDF2-HMAC-SHA256 at 100,000 iterations, the most Cloudflare's deployed runtime accepts; a later increase rehashes each account on its next sign-in. Sessions last an absolute 14 days from sign-in, with no idle timeout. D1 stores only a SHA-256 digest of each session token, and over HTTPS the cookie is `__Host-orboro_session`.
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
