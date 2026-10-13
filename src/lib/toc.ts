// Dependency-free so tests can import it without the Workers runtime.

export interface TocHeading {
  id: string;
  text: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const point = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "") || "section";
}

/**
 * Give each `<h2>` in rendered author Markdown a stable id and list them for a
 * table of contents. Run it on `renderMarkdown()` output *before* shortcodes
 * expand, so widget headings are never listed or rewritten. Labels are plain
 * text (tags stripped, entities decoded); render them escaped.
 */
export function addHeadingIds(html: string): { html: string; headings: TocHeading[] } {
  const headings: TocHeading[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (match, attrs: string | undefined, inner: string) => {
    const text = decodeEntities(inner.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
    if (!text) return match;
    const existing = attrs?.match(/\sid\s*=\s*"([^"]+)"/i)?.[1];
    let id = existing ?? slugify(text);
    if (!existing) {
      const base = id;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    }
    used.add(id);
    headings.push({ id, text });
    return existing ? match : `<h2 id="${id}"${attrs ?? ""}>${inner}</h2>`;
  });
  return { html: out, headings };
}
