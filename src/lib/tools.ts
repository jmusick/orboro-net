// The /tools index and the homepage toolkit share these groups and tile fields.
// Dependency-free so tests can import it without the Workers runtime.

import { toolDescription } from "./excerpt.ts";
import { topicTone, type TopicTone } from "./topics.ts";

export interface ToolGroup {
  /** `content.homepage_group` value. */
  key: "wow" | "poe2" | "other";
  /** Game chip on each tile. */
  title: string;
  /** Section heading on the /tools index. */
  heading: string;
  /** Wordmark shown on a tile without artwork. */
  mark: string;
}

// Display order: WoW, PoE 2, then everything else.
export const TOOL_GROUPS: readonly ToolGroup[] = [
  { key: "wow", title: "World of Warcraft", heading: "World of Warcraft", mark: "WoW" },
  { key: "poe2", title: "Path of Exile 2", heading: "Path of Exile 2", mark: "PoE 2" },
  { key: "other", title: "Tools & resources", heading: "Other", mark: "Tools" },
];

/**
 * Game and topic hub pages embed shortcodes (featured-tool lists, link hubs)
 * but are navigation into the tools, not tools themselves, so the /tools
 * index leaves them out. Add a slug here when a new hub page is created.
 */
export const TOOL_INDEX_EXCLUDED_SLUGS: ReadonlySet<string> = new Set([
  "world-of-warcraft",
  "path-of-exile-ii",
  "gaming",
  "grim-dawn",
  "development",
]);

export interface ToolPage {
  slug: string;
  title: string;
  homepageGroup: string;
  homepageDescription: string;
  summary: string;
  /** Opening Markdown, enough for `toolDescription`. */
  markdown: string;
  featuredImageUrl: string | null;
  /** Last save, in epoch milliseconds; tiles show it as "Updated <month year>". */
  updatedAt?: number;
}

export interface ToolTileData {
  slug: string;
  title: string;
  description: string;
  featuredImageUrl: string | null;
  group: ToolGroup;
  tone: TopicTone;
  updatedAt: number | null;
}

function groupFor(key: string): ToolGroup {
  return TOOL_GROUPS.find((group) => group.key === key) ?? TOOL_GROUPS[TOOL_GROUPS.length - 1];
}

export function toToolTile(page: ToolPage): ToolTileData {
  const group = groupFor(page.homepageGroup);
  return {
    slug: page.slug,
    title: page.title,
    description: toolDescription(page),
    featuredImageUrl: page.featuredImageUrl,
    group,
    tone: topicTone(group.key),
    updatedAt: page.updatedAt ?? null,
  };
}

/**
 * Tiles in group order, preserving the caller's order within each group
 * (the queries sort by `homepage_order`, then title). Groups with no pages
 * are dropped. An unknown group key falls into "other".
 */
export function groupToolPages(pages: ToolPage[]): Array<{ group: ToolGroup; tiles: ToolTileData[] }> {
  return TOOL_GROUPS
    .map((group) => ({
      group,
      tiles: pages.filter((page) => groupFor(page.homepageGroup) === group).map(toToolTile),
    }))
    .filter((entry) => entry.tiles.length > 0);
}

