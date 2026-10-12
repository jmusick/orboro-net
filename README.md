# Orboro.net

Orboro.net is JD's personal site and Markdown CMS, built with Astro 7 and deployed as the Cloudflare Worker `orboro-net`. Content and account records live in D1; uploaded images live in R2. See `package.json` for the current version.

JD is the only user, with an admin account. The schema and route guards also support `editor` and `author`, but there is no public registration or user-management UI, and author ownership restrictions are not implemented: review those permissions before adding non-admin users.

Conventions, architecture notes and known gotchas for working on the code are in [AGENTS.md](AGENTS.md).

Track outstanding work in [GitHub Issues](https://github.com/jmusick/orboro-net/issues). Each issue has a `category:security`, `category:accessibility` or `category:seo` label when applicable, and a priority: `priority:p1` means address next, `priority:p2` means normal planned work, and `priority:p3` means an optional improvement or future prerequisite. The [October 10 audit issues](https://github.com/jmusick/orboro-net/issues?q=is%3Aissue%20label%3Aaudit%3A2026-10-10) reconcile the earlier reviews against v1.45.1; historical checklists are evidence, not the current backlog.

## Workspace boundaries

The local checkout is `C:\Users\JD\source\orboro-net`; the project library is `C:\Users\JD\Projects\orboro-net`. Use kebab-case for project-library folders and authored asset names; retain framework conventions, generated filenames and original archive contents.

This repository owns website code, deployed assets, content seeds, migrations, data generators, tests, development configuration and technical documentation. The project library owns research inputs and workbook utilities, editable artwork, creative prompts, article drafts, and historical review or build snapshots. Its `README.md` indexes those materials. Keep current build output, dependencies and Cloudflare local state in the checkout; keep historical copies in the project library. Historical SQL and review utilities are records, not setup steps.

[Operations and decision history](docs/operations.md) records implementation rationale and dated deployment configuration checks.

## Requirements

- Node.js `>=22.12.0` and npm
- A Cloudflare account and Wrangler access for D1 and R2 operations

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
- `npm run test:markdown`, `test:dates`, `test:feed`, `test:json`, `test:consent`, `test:csp`, `test:sessions` run the unit tests: Markdown highlighting/escaping/sanitizing, page update dates, feed and sitemap output, inline-JSON safety, analytics consent behavior, CSP nonce preservation across navigation, and session tokens, revocation and cookie flags
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
- `SidebarLayout.astro` owns the shared content/sidebar columns and mobile breakpoint. Set `sidebar={false}` for full-width widgets. `PostCard.astro` supplies detailed and compact cards; `PostListItem.astro` supplies homepage feed rows.
- Visit `/admin/design-system` while signed in as an admin for component examples, field feedback and a live widget. The page is excluded from analytics and requires the admin role.
- Run `npm run check:styles` before shipping style changes. It checks fixed accent tints, off-scale radii, hover lift, empty or broad transitions, unimported monospace fonts, and duplicate token definitions. `npm run check` and `npm run build` verify types and compilation; use a browser for layout and interaction checks.
