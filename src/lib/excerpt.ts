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
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + "…" : plain;
}
