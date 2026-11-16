---
name: Orboro.net
description: JD's gaming tools, evidence-backed analysis and developer resources, styled as a game launcher at night.
colors:
  bg: "#070914"
  bg-deep: "#05070f"
  surface: "#0f1326"
  surface-2: "#151b33"
  line: "#1d2442"
  line-strong: "#3a4a78"
  text: "#e9eef9"
  text-soft: "#c3cbe0"
  muted: "#a3aec9"
  accent: "#70d0ff"
  accent-hover: "#a4e1ff"
  accent-ink: "#06101c"
  game-wow: "#f5c46b"
  game-poe: "#ff8a73"
  accent-2: "#ff3fb8"
  accent-3: "#a8ff60"
  danger: "#ff3d4d"
  warning: "#ffc107"
typography:
  display:
    fontFamily: "Unbounded Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 2.2vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Unbounded Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Unbounded Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 600
    lineHeight: 1.3
  subhead:
    fontFamily: "Hanken Grotesk Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Hanken Grotesk Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  reading:
    fontFamily: "Hanken Grotesk Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Hanken Grotesk Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 700
    lineHeight: 1.4
  code:
    fontFamily: "Consolas, monospace"
    fontSize: "0.875rem"
    lineHeight: 1.65
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  pill: "999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "6": "1.5rem"
  "8": "2rem"
  "10": "2.5rem"
  "16": "4rem"
  "24": "6rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.accent-ink}"
  button-primary-lg:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    padding: "0 1.6rem"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.accent}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1rem"
  button-ghost:
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1rem"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1rem"
  nav-support:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    padding: "0 1.25rem"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "1rem"
  topic-chip:
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.75rem"
  tool-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "1.25rem 1.25rem 1.35rem"
---

# Design System: Orboro.net

## Overview

**Creative North Star: "The Night Launcher"**

Orboro.net looks like a game launcher at night. Full-bleed game artwork sits behind the header and fades into a deep indigo ground, and one orb-blue accent, sampled from the logo, picks out every action. The artwork carries the drama. Everything built on top of it is flat, framed and quiet: 1px hairline frames, tonal indigo surfaces, and hover feedback that only changes a color or a border.

The mood is calm and nocturnal, never neon. Density is moderate: content sits directly on the page ground inside a wide 1440px frame rather than in a boxed panel, and running text is held to a comfortable reading measure. A wide display face (Unbounded) gives titles their launcher character; a warm grotesk (Hanken Grotesk) does all the reading, navigation and widget work.

The system was arrived at by removing things: neon glows, hover lift, entrance animations on every section, uppercase eyebrows, middle-dot meta strings and decorative radial color blobs were all tried and taken out. New work keeps them out.

**Key Characteristics:**
- Artwork-led heroes with scrims that guarantee legible copy
- One accent (Orb Blue) for actions, links, focus and the current state
- Game colors only for game identity, never for chrome
- Flat, framed surfaces; depth from tone, not shadow
- Wide display face for titles only; grotesk for everything else
- Hover is a color or border change; artwork may scale slightly inside a fixed frame

## Colors

A deep indigo night palette, lit by a single cool orb blue, with two warm game-identity hues held in reserve.

### Primary
- **Orb Blue** (`accent`): links, primary buttons, the Support pill, focus rings, list markers, the current-nav underline and tool-tile calls to action. Sampled from `public/images/logo.png`. Tints are derived from the token (`rgb(from var(--accent) r g b / <alpha>)`), never hard-coded.
- **Pale Orb Blue** (`accent-hover`): hover fill for accent-filled controls; defined as `color-mix(in srgb, var(--accent), white 36%)`.
- **Orb Ink** (`accent-ink`): text on any Orb Blue fill.

### Secondary
- **Azeroth Amber** (`game-wow`): World of Warcraft identity in topic chips, tool tiles, story-card kickers and topic banners.
- **Wraeclast Ember** (`game-poe`): Path of Exile 2 identity in the same places.

### Tertiary
- **Signal Pink** (`accent-2`) and **Signal Lime** (`accent-3`): status pills and data encodings only (match vs. coverage, queued presses, rating severity).
- **Alarm Red** (`danger`) and **Caution Amber** (`warning`): destructive actions, errors and warnings.

### Neutral
- **Midnight Indigo** (`bg`): the page ground, also the color every hero scrim fades to.
- **Deepest Night** (`bg-deep`): the footer.
- **Deep Slate Indigo** (`surface`): panels, cards, tiles, inputs and widget shells.
- **Raised Slate Indigo** (`surface-2`): a second tonal step for plain tile art, inline code and secondary buttons.
- **Indigo Hairline** (`line`): the default 1px frame on cards, tables and dividers.
- **Indigo Rule** (`line-strong`): control borders and the hover border on frames.
- **Starlight** (`text`): headings and body text.
- **Soft Starlight** (`text-soft`): secondary copy on artwork and resting nav links.
- **Dusk Blue-Gray** (`muted`): metadata, excerpts, placeholders and descriptions.

### Named Rules
**The One Accent Rule.** Orb Blue is the only color that means "act here". Navigation chrome, backgrounds and gradients never use Signal Pink, Signal Lime or a game color.

**The Tone Token Rule.** Game color reaches a component only through `topicTone()` and a `data-tone` attribute that sets `--tone`. Never hard-code Azeroth Amber or Wraeclast Ember on an element.

**The Derived Tint Rule.** Every accent tint is computed from the token with relative color syntax. Fixed accent RGB values fail `npm run check:styles`.

## Typography

**Display Font:** Unbounded Variable (with Segoe UI, system-ui, sans-serif)
**Body Font:** Hanken Grotesk Variable (with Segoe UI, system-ui, sans-serif)
**Code Font:** Consolas (with monospace)

**Character:** Unbounded is wide, geometric and a little game-like; it names things. Hanken Grotesk is warm, compact and highly legible; it explains things. Both are self-hosted variable fonts.

### Hierarchy
- **Display** (Unbounded 700, `clamp(2rem, 1.4rem + 2.2vw, 3.25rem)`, line-height 1.08, -0.02em): page and post titles (`h1`) in the page header band and the homepage lead.
- **Headline** (Unbounded 600, 1.6rem, line-height 1.2, -0.01em; 1.35rem at 1024px and below): section headings and direct-child article `h2`s.
- **Title** (Unbounded 600, 1.05–1.2rem, line-height 1.3): story-card, tool-tile and widget titles and headline numbers.
- **Subhead** (Hanken Grotesk 700, 1.25rem, line-height 1.3): `h3` and lower headings.
- **Body** (Hanken Grotesk 400, 1.0625rem / 17px, line-height 1.55): UI text, navigation, widgets.
- **Reading** (Hanken Grotesk 400, 1.1875rem, line-height 1.7): direct-child paragraphs, lists and quotes in articles, capped at a 42rem measure.
- **Label** (Hanken Grotesk 700, about 0.8–0.85rem, sentence case): chips, kickers, field labels and block titles. Never uppercase, never letter-spaced.

### Named Rules
**The Display Face Names, Never Explains Rule.** Unbounded appears only on `h1`, `h2`, direct-child `.prose > h2`, and card, tile and widget titles. Widget headings nested in prose reset to the UI face, and widgets set `--font-display` explicitly where they want it.

**The Wide Face Step-Down Rule.** Unbounded runs wide, so size display text one step below what a narrow face would use, and check long titles at phone width. Headings use `text-wrap: balance`.

**The Seven-Tenths Floor Rule.** No text anywhere, widgets included, is smaller than 0.7rem.

## Layout

The page is a wide frame on an open ground. The site header is full width and transparent over hero artwork; `.site-main` and every section share a 1440px maximum width (`--page-max`) and a fluid gutter of `clamp(1rem, 4vw, 3.5rem)`. Content sits on the page ground, not inside a container panel.

- **Reading measure:** running text is capped at 42rem (`--measure`) everywhere, sidebar layouts included. The measure and reading size apply only to direct children of `.prose`, so widgets keep full width and the UI face.
- **Heroes:** a page puts artwork behind the header through BaseLayout's `hero` slot. `side` fades art in from the right behind left-aligned copy, `bottom` darkens from below, and `stack` shows an unscrimmed band above the copy on phones. Inner pages use a title band (breadcrumbs, display title, lede, meta) that is 16–22rem tall for pages and 22–34rem for articles.
- **Articles:** a centered reading column (about 74rem with its aside) with a sticky "On this page" aside; below 1080px the aside becomes an inline disclosure.
- **Pages:** prose-only pages get a 280px sidebar; pages with interactive widgets run full width.
- **Grids:** tool tiles use an auto-fill grid with a 16.5rem minimum column and a 1.25rem gap. Below 600px each tile becomes a compact row with an 88px square thumbnail.
- **Spacing rhythm:** a 4px-based scale (0.25rem to 6rem); main content is padded 2.5rem on top and 6rem at the bottom.
- **Breakpoints:** navigation collapses to a solid panel at 1024px and below (the horizontal bar needs about 975px); articles restack at 1080px; heroes and most components restack at 760–768px; phone layouts begin below 600px.

## Elevation & Depth

The system is flat by default. Depth comes from three things: tonal steps between Midnight Indigo, Deep Slate Indigo and Raised Slate Indigo; 1px hairline frames; and the scrims that layer copy over artwork. The only cast shadow belongs to the floating navigation menus, which must separate from busy hero art.

### Shadow Vocabulary
- **Menu float** (`box-shadow: 0 8px 24px rgb(0 0 0 / 45%)`): desktop nav dropdowns and flyouts only. Removed in the collapsed mobile nav.

### Named Rules
**The Flat Frame Rule.** Surfaces never lift. No hover shadows, no glows, no `translateY`. A frame acknowledges hover by changing its border color, from Indigo Hairline to Indigo Rule.

**The Scrim Is Not Decoration Rule.** Hero scrims exist to keep text over artwork at AA contrast. Never thin them; check copy over the subject at 900px and phone width.

## Shapes

Soft, symmetric corners in exactly three tiers plus a pill: small (6px) for chips, code and small buttons; medium (10px) for cards, panels, inputs and buttons; large (16px) for shells, heroes, tool tiles and story-card art. Pills (999px) are for topic chips, status pills, the Support link and the game label on tool tiles. Every frame is a uniform 1px border on all four sides with a symmetric radius; color lives in the border tint, icon, title or hover state, never in a heavier edge.

**The Three Tier Rule.** There is no fourth radius. `0`, `50%` and hairlines may stay bare; everything else uses `--r-sm`, `--r-md`, `--r-lg` or `--r-pill`.

## Components

### Buttons
Quiet, confident and flat.
- **Shape:** gently rounded (10px), small buttons 6px.
- **Primary:** Orb Blue fill with Orb Ink text, weight 700. Medium is `0.6rem 1rem`; large is a 52px-tall, `0 1.6rem` call to action used in heroes.
- **Hover / Focus:** the fill lightens to Pale Orb Blue over 0.2s; focus is a 2px Orb Blue outline offset 2px. Disabled drops to 50% opacity.
- **Secondary:** Raised Slate Indigo with Orb Blue text and a 1px Orb Blue border; hover adds a 10% accent wash.
- **Tertiary:** transparent with Orb Blue text; hover reveals an Orb Blue border.
- **Ghost:** a 45% Midnight Indigo glaze with a 22% white border, used beside a primary action over artwork; hover brightens the border to 45% white.
- **Danger:** Deep Slate Indigo with Alarm Red text and border; hover adds a 12% red wash.

### Chips
- **Topic chip:** a pill with a 14% tone fill, a 35% tone border and tone-colored label text (0.8rem, 700). Tone is Orb Blue by default, Azeroth Amber or Wraeclast Ember for a game. Hover strengthens the border to the full tone.
- **Status pill:** the same construction at 15%/50% with Signal Lime (success), Caution Amber (warning), Alarm Red (danger) or Signal Pink (info).

### Cards / Containers
- **Corner Style:** medium (10px) for panels and callouts; large (16px) for tool tiles and story art.
- **Background:** Deep Slate Indigo on the Midnight Indigo ground.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Indigo Hairline, or a token tint at about 18–22% for semantic callouts and blockquotes.
- **Internal Padding:** 1rem for callouts; 1.25rem for tile bodies.

### Inputs / Fields
- **Style:** Deep Slate Indigo fill, 1px Indigo Rule border, 10px radius, `0.75rem 1rem` padding, 0.95rem UI text, Dusk Blue-Gray placeholder. Labels sit above in 600 weight.
- **Focus:** the border turns Orb Blue and a 2px Orb Blue outline appears 2px outside.
- **Error / Disabled:** errors are reported in a focused summary that links to each field; disabled fields drop to 50% opacity. Checkboxes, radios and ranges take Orb Blue as their accent color.

### Navigation
- **Style:** plain-text top-level links in Hanken Grotesk 600 at 0.95rem, Soft Starlight at rest, with 44px minimum targets.
- **Hover / Active:** hover turns the link white. The current section is white with a 2px Orb Blue underline offset 0.5rem, so state never rests on color alone.
- **Support:** the one accent pill in the bar: Orb Blue fill, Orb Ink text, weight 700.
- **Menus:** dropdowns and nested flyouts float on Deep Slate Indigo with the menu shadow; a rotated-square chevron caret flips direction with `aria-expanded`.
- **Mobile:** at 1024px and below the nav collapses behind a toggle into a solid stacked panel with no shadows.

### Tool Tile (signature)
The launcher's game cartridge. A 16px-radius Deep Slate Indigo frame holding 16:10 artwork, with a pill game label (Azeroth Amber or Wraeclast Ember on a 78% Midnight Indigo glaze) floating over the art's top-left corner. Below it: an Unbounded title, a Dusk Blue-Gray description and an Orb Blue "Open tool" call to action. Without artwork, the tile shows a large faint wordmark in the game color on Raised Slate Indigo. On hover the art scales to 1.04 inside its frame and the border steps up to Indigo Rule. On phones it becomes a compact row with an 88px thumbnail and a single-line description.

### Story Card
A frameless editorial card: 16:9 artwork in a 16px frame, a muted meta row with a game-colored kicker, an Unbounded title that turns Orb Blue on hover, and a Dusk Blue-Gray excerpt clamped at four lines.

### Hero Art
Full-bleed artwork behind the masthead, masked and scrimmed toward Midnight Indigo so copy always sits on near-solid color. A top scrim keeps the header legible, and a bottom fade melts the hero into the page.

## Do's and Don'ts

### Do:
- **Do** use `var(--accent)` or `rgb(from var(--accent) r g b / <alpha>)` for every accent color and tint.
- **Do** route game color through `topicTone()` and `data-tone`, and keep it to chips, tiles, kickers and topic banners.
- **Do** frame cards, callouts and blockquotes with a uniform 1px border and a symmetric radius from the three tiers.
- **Do** give hover a color or border-color change only, and list the exact properties in `transition`.
- **Do** let artwork scale to 1.04 inside a fixed frame on hover; the frame itself never moves.
- **Do** keep running text at the 42rem measure and use underlined links in prose so links never rely on color alone.
- **Do** give interactive targets at least 44px and keep all text at 0.7rem or larger.
- **Do** put text on any Orb Blue fill in Orb Ink.

### Don't:
- **Don't** add neon glow `box-shadow`s, `translateY` hover lift, or fade-and-slide keyframes on every section.
- **Don't** bring back the cyan, pink and lime radial background blobs.
- **Don't** use Signal Pink or Signal Lime in chrome, backgrounds or gradients; they encode status and data only.
- **Don't** use `border-left: 3px solid var(--accent)` with an asymmetric radius and a gradient wash, or a top-left corner tick.
- **Don't** add a fourth radius tier.
- **Don't** use `transition: all`.
- **Don't** use uppercase or letter-spaced eyebrows, middle-dot meta strings or monospace profile handles.
- **Don't** thin hero scrims, or put copy over artwork without checking contrast at 900px and phone width.
- **Don't** load fonts from a CDN or name a face in CSS that isn't imported.
