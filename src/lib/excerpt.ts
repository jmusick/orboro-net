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
  if (plain.length <= maxLen) return plain;
  // Cut at the last word boundary so an excerpt never ends mid-word, unless
  // that would throw away most of the allowance (one very long token).
  const cut = plain.slice(0, maxLen + 1);
  const boundary = cut.search(/\s\S*$/);
  const end = boundary >= maxLen * 0.6 ? boundary : maxLen;
  return plain.slice(0, end).replace(/[\s,;:.–—-]+$/, "") + "…";
}

/**
 * Tool tile copy: the editor's homepage description, else the page's opening
 * prose with shortcode tokens and HTML tags removed. A token or tag left open
 * by a bounded Markdown prefix is dropped too.
 */
export function toolDescription(page: { homepageDescription: string; markdown: string }, maxLen = 140): string {
  if (page.homepageDescription) return page.homepageDescription;
  const prose = page.markdown
    .replace(/\{\{[\s\S]*?\}\}/g, "")
    .replace(/\{\{[\s\S]*$/, "")
    .replace(/<[^>]*>/g, "")
    .replace(/<[^>]*$/, "")
    // Stray brackets could rejoin into a tag ("<<a>script"); drop them all.
    .replace(/[<>]/g, "");
  return excerptFromMarkdown(prose, maxLen);
}
