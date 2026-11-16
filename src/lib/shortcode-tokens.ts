// Shortcode tokens (`{{name attr="..."}}`) in raw Markdown: detecting and
// stripping them before Markdown is turned into text (excerpts, meta
// descriptions, feeds, word counts). Dependency-free so `excerpt.ts` and
// `feed.ts` stay light; `shortcodes.ts` imports every widget module.
//
// Expanding tokens is not done here: `SHORTCODE_RE` in `shortcodes.ts` works
// on the HTML after `renderMarkdown`.

/**
 * One detect rule everywhere: `{{` followed by a letter, digit or underscore.
 * An unclosed `{{name` counts, so a page whose token is still being typed is
 * already classed as a tool page. `EMBEDS_SHORTCODE_SQL` is the same test.
 */
const DETECT = /\{\{\w/;

/** A complete token, the same shape `SHORTCODE_RE` expands. */
const TOKEN = /\{\{\w+[^}]*\}\}/g;
const ONE_TOKEN = /\{\{\w+[^}]*\}\}/;

/** Any `{{…}}` run, word start or not, for bounded prefixes. */
const BRACE_RUN = /\{\{[\s\S]*?\}\}/g;

/** Everything from an unclosed `{{` to the end of a length-limited prefix. */
const CUT_OFF_RUN = /\{\{[\s\S]*$/;

/**
 * SQL condition for "this Markdown embeds a `{{shortcode}}`", matching
 * `hasShortcode`. Shared by `listToolPages` and the sitemap.
 */
export const EMBEDS_SHORTCODE_SQL = "markdown GLOB '*{{[A-Za-z0-9_]*'";

export function hasShortcode(markdown: string): boolean {
  return DETECT.test(markdown);
}

/**
 * Stricter than `hasShortcode`: needs a complete, closed token. The feed uses
 * it so a literal unclosed `{{word` in prose doesn't cost a post its full body.
 */
export function hasCompleteShortcode(markdown: string): boolean {
  return ONE_TOKEN.test(markdown);
}

/** Replace every complete shortcode token with `replacement`. */
export function stripShortcodes(markdown: string, replacement = ""): string {
  return markdown.replace(TOKEN, replacement);
}

/**
 * For a length-limited Markdown prefix (tool tiles): drop every `{{…}}` run,
 * shortcode or not, then anything from an unclosed `{{` to the end, so
 * `{{atlas-farming attr="unfinis` doesn't leak into a tile description.
 */
export function stripShortcodePrefix(markdown: string): string {
  return markdown.replace(BRACE_RUN, "").replace(CUT_OFF_RUN, "");
}
