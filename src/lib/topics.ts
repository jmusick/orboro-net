// Dependency-free so tests can import it without the Workers runtime.

/** Game identity colors map to `--game-*` tokens; anything else uses the accent. */
export type TopicTone = "wow" | "poe" | "default";

const TONES: Record<string, TopicTone> = {
  "world-of-warcraft": "wow",
  wow: "wow",
  "path-of-exile-ii": "poe",
  "path-of-exile-2": "poe",
  poe2: "poe",
};

/** Tone for a category slug or a homepage tool group key. */
export function topicTone(key: string | null | undefined): TopicTone {
  return (key && TONES[key]) || "default";
}

export interface GameHub {
  tone: Exclude<TopicTone, "default">;
  /** `homepage_group` of the game's featured tool pages. */
  group: string;
  title: string;
  href: string;
}

// Same order as the homepage toolkit: WoW, then PoE 2.
export const GAME_HUBS: readonly GameHub[] = [
  { tone: "wow", group: "wow", title: "World of Warcraft", href: "/pages/world-of-warcraft" },
  { tone: "poe", group: "poe2", title: "Path of Exile 2", href: "/pages/path-of-exile-ii" },
];

/** Hubs for every game tone among a post's category slugs. */
export function gameHubsForCategories(slugs: string[]): GameHub[] {
  const tones = new Set(slugs.map(topicTone));
  return GAME_HUBS.filter((hub) => tones.has(hub.tone));
}

export interface CoverCandidate {
  categoryId: string;
  imageUrl: string;
}

/**
 * Give each category the newest post artwork that no earlier category has
 * already taken, so overlapping categories (Gaming and World of Warcraft) don't
 * show the same banner. `candidates` must be newest first; `categoryIds` is the
 * order categories claim art in. Falls back to a shared image rather than none.
 */
export function assignCovers(categoryIds: string[], candidates: CoverCandidate[]): Map<string, string> {
  const covers = new Map<string, string>();
  const taken = new Set<string>();
  for (const id of categoryIds) {
    const own = candidates.filter((c) => c.categoryId === id);
    const pick = own.find((c) => !taken.has(c.imageUrl)) ?? own[0];
    if (!pick) continue;
    covers.set(id, pick.imageUrl);
    taken.add(pick.imageUrl);
  }
  return covers;
}
