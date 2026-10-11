// Validation and atomic replacement writes for navigation and content/category
// assignments. Everything that replaces existing rows goes through db.batch(),
// which D1 runs as one transaction: a failing statement rolls the whole batch
// back, so rejected or failed input never erases what was already saved.

export const MAX_NAV_ITEMS = 500;
export const MAX_NAV_LABEL_LENGTH = 200;
export const MAX_CLIENT_ID_LENGTH = 100;
export const MAX_ID_LENGTH = 100;
export const MAX_CATEGORIES_PER_CONTENT = 100;

export class WriteValidationError extends Error {}

export interface NavItemInput {
  clientId: string;
  contentId: string;
  label: string;
  sortOrder: number;
  parentClientId: string | null;
}

// The slice of D1Database this module uses, so tests can supply a stand-in.
export interface WriteStatement {
  bind(...values: unknown[]): WriteStatement;
  all<T>(): Promise<{ results?: T[] }>;
}
export interface WriteDB {
  prepare(sql: string): WriteStatement;
  batch(statements: WriteStatement[]): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, max: number): string | null {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

// Parses the raw `navItems` form value. An empty array is a deliberate "clear
// the navigation"; anything malformed throws rather than becoming an empty list.
export function parseNavItems(raw: string): NavItemInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new WriteValidationError("Navigation JSON is not valid.");
  }
  if (!Array.isArray(parsed)) throw new WriteValidationError("Navigation must be a list.");
  if (parsed.length > MAX_NAV_ITEMS) throw new WriteValidationError("Too many navigation items.");

  const items: NavItemInput[] = parsed.map((entry, index) => {
    if (!isRecord(entry)) throw new WriteValidationError(`Item ${index} is not an object.`);
    const clientId = requiredString(entry.clientId, MAX_CLIENT_ID_LENGTH);
    const contentId = requiredString(entry.contentId, MAX_ID_LENGTH);
    const label = requiredString(entry.label, MAX_NAV_LABEL_LENGTH);
    if (!clientId || !contentId || !label) {
      throw new WriteValidationError(`Item ${index} needs an id, a page and a label.`);
    }
    const sortOrder = entry.sortOrder;
    if (typeof sortOrder !== "number" || !Number.isSafeInteger(sortOrder)) {
      throw new WriteValidationError(`Item ${index} has an invalid sort order.`);
    }
    let parentClientId: string | null = null;
    if (entry.parentId !== undefined && entry.parentId !== null && entry.parentId !== "") {
      parentClientId = requiredString(entry.parentId, MAX_CLIENT_ID_LENGTH);
      if (!parentClientId) throw new WriteValidationError(`Item ${index} has an invalid parent.`);
    }
    return { clientId, contentId, label, sortOrder, parentClientId };
  });

  return orderParentsFirst(items);
}

// Checks IDs and references, rejects cycles, and returns the items with every
// parent ahead of its children so inserts satisfy the self-referencing key.
export function orderParentsFirst(items: NavItemInput[]): NavItemInput[] {
  const byId = new Map<string, NavItemInput>();
  for (const item of items) {
    if (byId.has(item.clientId)) throw new WriteValidationError(`Duplicate item id ${item.clientId}.`);
    byId.set(item.clientId, item);
  }
  for (const item of items) {
    if (item.parentClientId === null) continue;
    if (item.parentClientId === item.clientId) throw new WriteValidationError("An item cannot be its own parent.");
    if (!byId.has(item.parentClientId)) throw new WriteValidationError(`Unknown parent ${item.parentClientId}.`);
  }

  const ordered: NavItemInput[] = [];
  const state = new Map<string, 1 | 2>(); // 1 = on the current path, 2 = done
  for (const start of items) {
    const path: NavItemInput[] = [];
    let current: NavItemInput | undefined = start;
    while (current && !state.has(current.clientId)) {
      state.set(current.clientId, 1);
      path.push(current);
      current = current.parentClientId === null ? undefined : byId.get(current.parentClientId);
    }
    if (current && state.get(current.clientId) === 1) {
      throw new WriteValidationError("Navigation items form a cycle.");
    }
    for (let i = path.length - 1; i >= 0; i -= 1) {
      state.set(path[i].clientId, 2);
      ordered.push(path[i]);
    }
  }
  return ordered;
}

async function existingIds(db: WriteDB, table: "content" | "categories", ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const result = await db.prepare(`SELECT id FROM ${table}`).all<{ id: string }>();
  return new Set((result.results ?? []).map((row) => row.id));
}

// Replaces the whole navigation tree in one transaction. Pass items from
// parseNavItems (or orderParentsFirst); referenced pages must exist.
export async function replaceNavItems(
  db: WriteDB,
  items: NavItemInput[],
  now: number,
  newId: () => string = () => crypto.randomUUID(),
): Promise<void> {
  const ordered = orderParentsFirst(items);
  const known = await existingIds(db, "content", ordered.map((i) => i.contentId));
  for (const item of ordered) {
    if (!known.has(item.contentId)) throw new WriteValidationError(`Unknown page ${item.contentId}.`);
  }

  const realIds = new Map<string, string>();
  for (const item of ordered) realIds.set(item.clientId, newId());

  const statements = [db.prepare("DELETE FROM nav_items")];
  for (const item of ordered) {
    statements.push(
      db
        .prepare(
          `INSERT INTO nav_items (id, label, content_id, parent_item_id, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          realIds.get(item.clientId),
          item.label,
          item.contentId,
          item.parentClientId === null ? null : realIds.get(item.parentClientId),
          item.sortOrder,
          now,
        ),
    );
  }
  await db.batch(statements);
}

export interface ContentWriteInput {
  id?: string;
  slug: string;
  title: string;
  markdown: string;
  pageType: string;
  status: "draft" | "published";
  authorId: string;
  featuredImageUrl?: string | null;
  homepageFeatured?: boolean;
  homepageGroup?: string;
  homepageOrder?: number;
  homepageDescription?: string;
  categoryIds: string[];
}

// Saves a content row and replaces its category assignments in one
// transaction. Unknown categories are rejected before anything is written.
export async function saveContentWithCategories(
  db: WriteDB,
  input: ContentWriteInput,
  now: number,
  newId: () => string = () => crypto.randomUUID(),
): Promise<string> {
  const categoryIds = [...new Set(input.categoryIds)];
  if (categoryIds.length > MAX_CATEGORIES_PER_CONTENT || categoryIds.some((id) => !id || id.length > MAX_ID_LENGTH)) {
    throw new WriteValidationError("Invalid category selection.");
  }
  const known = await existingIds(db, "categories", categoryIds);
  if (categoryIds.some((id) => !known.has(id))) throw new WriteValidationError("Unknown category.");

  const featuredImageUrl = input.featuredImageUrl || null;
  const homepageValues = [
    input.homepageFeatured ? 1 : 0,
    input.homepageGroup ?? "other",
    input.homepageOrder ?? 0,
    input.homepageDescription ?? "",
  ];

  const id = input.id ?? newId();
  const statements: WriteStatement[] = [];
  if (input.id) {
    statements.push(
      db
        .prepare(
          `UPDATE content
           SET slug = ?, title = ?, markdown = ?, page_type = ?, status = ?,
               published_at = CASE WHEN status = 'draft' AND ? = 'published' THEN ? ELSE published_at END,
               updated_at = ?, featured_image_url = ?,
               homepage_featured = ?, homepage_group = ?, homepage_order = ?, homepage_description = ?
           WHERE id = ?`,
        )
        .bind(input.slug, input.title, input.markdown, input.pageType, input.status, input.status, now, now, featuredImageUrl, ...homepageValues, id),
    );
  } else {
    statements.push(
      db
        .prepare(
          `INSERT INTO content
           (id, slug, title, markdown, page_type, status, author_id, published_at, created_at, updated_at, featured_image_url,
            homepage_featured, homepage_group, homepage_order, homepage_description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, input.slug, input.title, input.markdown, input.pageType, input.status, input.authorId, input.status === "published" ? now : null, now, now, featuredImageUrl, ...homepageValues),
    );
  }
  statements.push(db.prepare("DELETE FROM content_categories WHERE content_id = ?").bind(id));
  for (const categoryId of categoryIds) {
    statements.push(db.prepare("INSERT INTO content_categories (content_id, category_id) VALUES (?, ?)").bind(id, categoryId));
  }
  await db.batch(statements);
  return id;
}
