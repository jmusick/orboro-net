// Dependency-free so tests and the listing query can use it without the Workers runtime.
export function excerptFromMarkdown(markdown: string, maxLen = 155): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, "")
    // An unclosed fence means the source was cut inside a code block; drop the rest.
    .replace(/```[\s\S]*$/, "")
    .replace(/#{1,6}\s+[^\n]*/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.+?)\]\(.*?\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/^\s*[-*+>|]\s*/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return truncatePlainText(plain, maxLen);
}

function truncatePlainText(plain: string, maxLen: number): string {
  if (plain.length <= maxLen) return plain;
  // Cut at the last word boundary so an excerpt never ends mid-word, unless
  // that would throw away most of the allowance (one very long token).
  const cut = plain.slice(0, maxLen + 1);
  const boundary = cut.search(/\s\S*$/);
  const end = boundary >= maxLen * 0.6 ? boundary : maxLen;
  return plain.slice(0, end).replace(/[\s,;:.–—-]+$/, "") + "…";
}

/** Prefer the author's plain-text summary, bounded for the destination. The
 * optional fallback preserves surfaces with their own Markdown cleanup rules.
 * Summaries are literal text, never parsed as Markdown or HTML.
 */
export function summaryOrExcerpt(
  record: { summary?: string; markdown: string },
  maxLen = 155,
  fallback: (markdown: string, maxLen: number) => string = excerptFromMarkdown,
): string {
  const summary = record.summary?.trim();
  return summary ? truncatePlainText(summary, maxLen) : fallback(record.markdown, maxLen);
}

/**
 * Tool tile copy: the editor's homepage description, else the page's summary,
 * else opening prose with shortcode tokens and HTML tags removed. A token or
 * tag left open by a bounded Markdown prefix is dropped too.
 */
export function toolDescription(page: { homepageDescription: string; summary?: string; markdown: string }, maxLen = 140): string {
  if (page.homepageDescription) return page.homepageDescription;
  let prose = page.markdown
    .replace(/\{\{[\s\S]*?\}\}/g, "")
    .replace(/\{\{[\s\S]*$/, "");
  // Repeat until stable so removing one tag can't leave another behind ("<<a>script>").
  let previous;
  do {
    previous = prose;
    prose = prose.replace(/<[^>]*(?:>|$)/g, "");
  } while (prose !== previous);
  return summaryOrExcerpt({ ...page, markdown: prose }, maxLen);
}

export function descriptionFromMarkdown(md: string, maxLen = 155): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, '')
    // Shortcode tokens are widget placeholders, not prose. Without this a
    // shortcode-only page ends up with "{{atlasfarmingstrategies}}" as its
    // meta description (the underscores get eaten by the emphasis strip).
    .replace(/\{\{\w+[^}]*\}\}/g, '')
    // Markdown may contain raw HTML (the About page opens with an <img>), and
    // an unstripped tag ends up escaped into the meta description verbatim.
    .replace(/<[^>]+>/g, ' ')
    .replace(/#{1,6}\s+[^\n]*/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .replace(/^\s*[-*+>|]\s*/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + '…' : plain;
}
