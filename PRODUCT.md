# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Orboro.net serves JD's broad audience across gaming and development topics. No single game's players lead. Visitors include:

- players of the games JD is currently playing (today World of Warcraft and Path of Exile 2, with Grim Dawn and Enshrouded content), who come for a tool, a cheat sheet or a guide for the current season or patch;
- readers of JD's analysis and opinion posts on games, gaming culture and tech;
- people looking for the curated link hubs and the Development section's software tools and links.

Many arrive from search. Registered **members** can comment and vote on pages and posts. JD is the sole author and the only CMS admin, and is also a user of the admin, moderation and editor screens.

## Product Purpose

A personal site where JD publishes things worth keeping around: interactive game tools and cheat sheets, evidence-backed game analysis, guides, opinion pieces and curated links, plus software and web-development resources.

The stated goal, from the About page: be useful without being annoying. The site should be fast, efficient and straightforward, without clutter, popups or autoplay, and should respect visitors' time and privacy.

Success over the next year means:

- **Search reach:** guides, tools and analysis get found for their topics.
- **Patreon support:** visitors who value the work support it through the Patreon link, the site's only monetization.

## Positioning

**Evidence over opinion.** Published figures come from pinned, reproducible sources rather than assertion: Blizzard DB2 exports and SimulationCraft runs for the Assisted Combat analysis, generators that rebuild every number from their inputs, and tallies of what creators predicted against what happened. Uncertainty and model limits are stated, missing data gets no score, and a previous season's numbers are never carried forward. The opinion writing holds itself to the same standard: an accusation needs evidence, a preference is stated as a preference.

## Operating Context

- Content is written and published by JD through the site's own Markdown CMS; pages, posts, categories and nav live in Cloudflare D1. Interactive tools are shortcode widgets embedded in page Markdown.
- Tools and cheat sheets are tied to game seasons and patches (for example Midnight Season 2 Mythic+, Assisted Combat 12.1.5), so they are refreshed or retired as seasons change. The homepage "Your toolkit" selection is curated per season.
- Research inputs, artwork originals, drafts and historical reviews live in an external project library, not in this repository.
- Visitors use the site on desktop and phones; game players may have it open beside the game.
- Comments are moderated by JD in the admin area.

## Capabilities and Constraints

- Public: homepage, blog with search, sort and pagination, category pages, generic pages, a `/tools` index, link hubs, RSS, sitemap, a code-backed privacy policy, public member profiles and threaded comments with votes.
- Members: registration with email confirmation, sign-in, password reset, profile, account deletion. Members can never reach the CMS.
- Admin (JD only): content editor with live preview, media library, categories, nav builder, homepage tool selection, comment and member moderation.
- Interactive tools must render server-side so crawlers and no-JS visitors get their content, and must survive in-site navigation.
- The site runs under a strict, nonce-based Content Security Policy; fonts and scripts are self-hosted.
- Analytics load only after consent; no advertising consent, no ad trackers, no data sold. Privacy claims must stay matched to what is actually collected.
- Terminology: "tools" are shortcode-backed pages; "hubs" are topic pages (Gaming, World of Warcraft, Path of Exile II, Grim Dawn, Development); "members" are public accounts, distinct from the admin "user".

## Brand Commitments

- Name: **Orboro.net**. Author: **JD**, a lifelong gamer of 40+ years and a software engineer. Online handle XingYuen on Steam, Reddit, YouTube and Twitch, listed in the footer.
- Logo: the orb in `public/images/logo.png`. Author avatar: `public/images/jd-avatar-*.webp`.
- Voice: first person, plain and direct, measured. Claims are qualified to what the evidence supports. No hype, no gimmicks, no noise.
- Commitments to visitors: no popups, no autoplay, no ad trackers, consent before analytics.
- The current visual system (the "Launcher" design, October 2026) is documented in `AGENTS.md` under "Design system".

## Evidence on Hand

- Assisted Combat analysis data and paired SimC benchmark results (`src/lib/assisted-combat-data.json`, `src/lib/assisted-combat-sims.json`), with generators in `scripts/`.
- Midnight Season 2 interrupt and utility data (`npm run data:midnight-s2-interrupts`).
- Published posts and pages seeded in `scripts/content/`, including the creator-prediction analyses and the About page.
- Vendored WoW spec icons (`public/images/wow-spec-icons/`), header and social artwork (`public/images/`), plus per-article artwork in R2 at `media.orboro.net`.

Not on hand, and not to be fabricated: testimonials, reader quotes, traffic or audience numbers, Patreon supporter counts, press mentions, endorsements, or performance figures not produced by the site's own generators.

## Product Principles

1. **Show the evidence.** Every figure traces to a pinned source; state uncertainty and what the model doesn't cover.
2. **Useful without being annoying.** Nothing stands between a visitor and the answer: no popups, autoplay or clutter.
3. **Respect privacy by default.** Collect only what consent allows, and say exactly what that is.
4. **Findable and durable.** Content renders on the server, works without JavaScript where it matters, and stays current with the season or is retired.
5. **One honest voice.** JD writes in first person and distinguishes preference from claim.

## Accessibility & Inclusion

No formal conformance level (such as WCAG 2.2 AA) has been set. Accessibility work is tracked as `category:accessibility` GitHub issues, and existing commitments include focused, linked form-error summaries, 44px touch targets in widgets, state that is never shown by color alone, and polite status updates for filters and simulators.
