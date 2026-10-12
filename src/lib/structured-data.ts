// Builders for page JSON-LD and breadcrumb trails. Pure functions so they can be
// tested without Astro; every result must still be serialized with jsonForHtml.

export interface Crumb {
  name: string;
  /** Site-relative path. */
  path: string;
}

export interface NavNodeLike {
  id: string;
  label: string;
  contentId: string | null;
  url: string;
  parentItemId: string | null;
}

/** Prose pages shorter than this are not treated as articles. */
export const ARTICLE_MIN_WORDS = 300;

export type PageSchemaType = "Article" | "WebPage";

export function countProseWords(markdown: string): number {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\{\{\w+[^}]*\}\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[(.+?)\]\(.*?\)/g, "$1")
    .replace(/[#*_~`>|]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Pages that embed a shortcode are tools, calculators or link hubs, never
 * articles. Prose-only pages are Articles once they carry enough text.
 */
export function classifyPage(markdown: string): PageSchemaType {
  if (/\{\{\w+/.test(markdown)) return "WebPage";
  return countProseWords(markdown) >= ARTICLE_MIN_WORDS ? "Article" : "WebPage";
}

/** Content timestamps are milliseconds; reject bad units and implausible values. */
export function isoOrUndefined(timestamp: number | null | undefined, now = Date.now()): string | undefined {
  if (typeof timestamp !== "number" || !Number.isSafeInteger(timestamp)) return undefined;
  if (timestamp < Date.UTC(2000, 0, 1) || timestamp > now + 86_400_000) return undefined;
  return new Date(timestamp).toISOString();
}

/**
 * Ancestors of a page's nav item, root first, then the page itself. Ancestors
 * with no linkable content (label-only menu parents) are skipped, because a
 * breadcrumb that cannot be followed is not a useful or valid trail entry.
 * Returns [] when the page has no linkable ancestor: "Home > Page" adds nothing.
 */
export function pageTrail(navItems: NavNodeLike[], contentId: string, pageTitle: string, pagePath: string): Crumb[] {
  const byId = new Map(navItems.map((n) => [n.id, n]));
  const own = navItems.find((n) => n.contentId === contentId);
  if (!own) return [];
  const ancestors: Crumb[] = [];
  const seen = new Set<string>([own.id]);
  let cursor = own.parentItemId ? byId.get(own.parentItemId) : undefined;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    if (cursor.contentId && cursor.url.startsWith("/") && cursor.url !== "/pages/") {
      ancestors.unshift({ name: cursor.label, path: cursor.url });
    }
    cursor = cursor.parentItemId ? byId.get(cursor.parentItemId) : undefined;
  }
  if (ancestors.length === 0) return [];
  return [...ancestors, { name: pageTitle, path: pagePath }];
}

/** Home is prepended by both the visible trail and the JSON-LD. */
export function withHome(trail: Crumb[]): Crumb[] {
  return trail.length === 0 ? [] : [{ name: "Home", path: "/" }, ...trail];
}

export function breadcrumbList(trail: Crumb[], origin: string): Record<string, unknown> | undefined {
  if (trail.length < 2) return undefined;
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: new URL(crumb.path, origin).href,
    })),
  };
}

export interface PageSchemaInput {
  type: PageSchemaType;
  origin: string;
  path: string;
  title: string;
  description: string;
  imageUrl?: string;
  publishedAt?: number | null;
  updatedAt?: number | null;
  now?: number;
}

export function pageNode(input: PageSchemaInput): Record<string, unknown> {
  const url = new URL(input.path, input.origin).href;
  const published = isoOrUndefined(input.publishedAt, input.now);
  const modified = isoOrUndefined(input.updatedAt, input.now);
  const image = input.imageUrl ? [input.imageUrl] : undefined;
  if (input.type === "Article") {
    return {
      "@type": "Article",
      headline: input.title,
      description: input.description,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      ...(published ? { datePublished: published } : {}),
      ...(modified ? { dateModified: modified } : {}),
      ...(image ? { image } : {}),
      author: { "@type": "Person", name: "JD", url: new URL("/pages/about", input.origin).href },
      publisher: {
        "@type": "Organization",
        name: "Orboro.net",
        logo: { "@type": "ImageObject", url: `${input.origin}/images/logo.png` },
      },
    };
  }
  return {
    "@type": "WebPage",
    "@id": url,
    url,
    name: input.title,
    description: input.description,
    isPartOf: { "@id": `${input.origin}/#website` },
    ...(modified ? { dateModified: modified } : {}),
    ...(image ? { primaryImageOfPage: { "@type": "ImageObject", url: input.imageUrl } } : {}),
  };
}

/** One document: a @graph of the supplied nodes (undefined entries dropped). */
export function graphOf(...nodes: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}
