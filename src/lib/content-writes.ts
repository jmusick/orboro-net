// Validation and atomic replacement writes for navigation, content/category
// assignments, categories and media records. Every field is checked before any
// write. Everything that replaces existing rows goes through db.batch(), which
// D1 runs as one transaction: a failing statement rolls the whole batch back,
// so rejected or failed input never erases what was already saved.

export const MAX_NAV_ITEMS = 500;
export const MAX_NAV_LABEL_LENGTH = 200;
export const MAX_CLIENT_ID_LENGTH = 100;
export const MAX_ID_LENGTH = 100;
export const MAX_CATEGORIES_PER_CONTENT = 100;
export const MAX_TITLE_LENGTH = 200;
export const MAX_SLUG_LENGTH = 200;
export const MAX_MARKDOWN_LENGTH = 200_000;
export const MAX_IMAGE_URL_LENGTH = 2048;
export const MAX_HOMEPAGE_DESCRIPTION_LENGTH = 240;
export const MAX_HOMEPAGE_ORDER = 9999;
export const MAX_CATEGORY_NAME_LENGTH = 100;
export const MAX_ALT_TEXT_LENGTH = 500;
export const MAX_CAPTION_LENGTH = 1000;

export const PAGE_TYPES = ["post", "page"] as const;
export const CONTENT_STATUSES = ["draft", "published"] as const;
export const HOMEPAGE_GROUPS = ["wow", "poe2", "other"] as const;
/** Mirrors COMMENTS_MODES in comments.ts and the column's CHECK constraint. */
export const COMMENTS_MODES = ["open", "locked", "hidden"] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_OR_SPACE = /[\s\u0000-\u001f\u007f-\u009f]/;

// `code` selects the editor's error message (`?error=<code>`).
export type WriteErrorCode = "invalid" | "homepage" | "image";

export class WriteValidationError extends Error {
  code: WriteErrorCode;
  constructor(message: string, code: WriteErrorCode = "invalid") {
    super(message);
    this.code = code;
  }
}

/** A row ID from a form: trimmed, 1-100 characters, no spaces or control characters. */
export function parseRecordId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ID_LENGTH || CONTROL_OR_SPACE.test(trimmed)) return null;
  return trimmed;
}

/**
 * Image URLs authors may store: absolute https:// URLs, or root-relative site
 * paths such as /media/... and /images/.... Rejects javascript:, data:, http:,
 * protocol-relative //host, backslashes, whitespace and credentials.
 */
export function isAllowedImageUrl(value: string): boolean {
  if (typeof value !== "string" || !value || value.length > MAX_IMAGE_URL_LENGTH) return false;
  if (CONTROL_OR_SPACE.test(value) || value.includes("\\")) return false;
  if (value.startsWith("/")) {
    if (value.startsWith("//")) return false;
    try {
      return new URL(value, "https://root.invalid").origin === "https://root.invalid";
    } catch {
      return false;
    }
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "" && !url.username && !url.password;
  } catch {
    return false;
  }
}

const within = (value: unknown, max: number, allowEmpty = false): value is string =>
  typeof value === "string" && value.length <= max && (allowEmpty || value.trim().length > 0);

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
  commentsMode?: string;
  categoryIds: string[];
}

// Field-level checks that need no database. Throws WriteValidationError whose
// code names the editor message to show.
export function validateContentInput(input: ContentWriteInput): void {
  if (input.id !== undefined && parseRecordId(input.id) !== input.id) throw new WriteValidationError("Invalid content id.");
  if (!within(input.title, MAX_TITLE_LENGTH)) throw new WriteValidationError("Invalid title.");
  if (typeof input.slug !== "string" || input.slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(input.slug)) {
    throw new WriteValidationError("Invalid slug.");
  }
  if (!within(input.markdown, MAX_MARKDOWN_LENGTH)) throw new WriteValidationError("Invalid Markdown.");
  if (!(PAGE_TYPES as readonly string[]).includes(input.pageType)) throw new WriteValidationError("Invalid page type.");
  if (!(CONTENT_STATUSES as readonly string[]).includes(input.status)) throw new WriteValidationError("Invalid status.");
  if (!parseRecordId(input.authorId)) throw new WriteValidationError("Invalid author.");
  if (!Array.isArray(input.categoryIds) || input.categoryIds.length > MAX_CATEGORIES_PER_CONTENT
      || input.categoryIds.some((id) => parseRecordId(id) !== id)) {
    throw new WriteValidationError("Invalid category selection.");
  }
  if (input.featuredImageUrl !== undefined && input.featuredImageUrl !== null && !isAllowedImageUrl(input.featuredImageUrl)) {
    throw new WriteValidationError("Featured image must be an https:// URL or a site path.", "image");
  }
  const group = input.homepageGroup ?? "other";
  const order = input.homepageOrder ?? 0;
  if (!(HOMEPAGE_GROUPS as readonly string[]).includes(group)
      || typeof order !== "number" || !Number.isSafeInteger(order) || order < 0 || order > MAX_HOMEPAGE_ORDER
      || !within(input.homepageDescription ?? "", MAX_HOMEPAGE_DESCRIPTION_LENGTH, true)) {
    throw new WriteValidationError("Invalid homepage settings.", "homepage");
  }
  if (!(COMMENTS_MODES as readonly string[]).includes(input.commentsMode ?? "open")) throw new WriteValidationError("Invalid comments setting.");
}

async function idsWhere(db: WriteDB, sql: string, value: string): Promise<string[]> {
  const result = await db.prepare(sql).bind(value).all<{ id: string }>();
  return (result.results ?? []).map((row) => row.id);
}

// Saves a content row and replaces its category assignments in one
// transaction. Fields, the edited row, slug uniqueness and categories are all
// checked before anything is written.
export async function saveContentWithCategories(
  db: WriteDB,
  input: ContentWriteInput,
  now: number,
  newId: () => string = () => crypto.randomUUID(),
): Promise<string> {
  validateContentInput(input);
  const categoryIds = [...new Set(input.categoryIds)];
  if (input.id && !(await idsWhere(db, "SELECT id FROM content WHERE id = ?", input.id)).length) {
    throw new WriteValidationError("Unknown content.");
  }
  if ((await idsWhere(db, "SELECT id FROM content WHERE slug = ?", input.slug)).some((id) => id !== input.id)) {
    throw new WriteValidationError("Slug is already in use.");
  }
  const known = await existingIds(db, "categories", categoryIds);
  if (categoryIds.some((id) => !known.has(id))) throw new WriteValidationError("Unknown category.");

  const featuredImageUrl = input.featuredImageUrl || null;
  const homepageValues = [
    input.homepageFeatured ? 1 : 0,
    input.homepageGroup ?? "other",
    input.homepageOrder ?? 0,
    input.homepageDescription ?? "",
    input.commentsMode ?? "open",
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
               homepage_featured = ?, homepage_group = ?, homepage_order = ?, homepage_description = ?,
               comments_mode = ?
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
            homepage_featured, homepage_group, homepage_order, homepage_description, comments_mode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export interface CategoryWriteInput {
  id?: string;
  name: string;
  slug: string;
}

export function validateCategoryInput(input: CategoryWriteInput): void {
  if (input.id !== undefined && parseRecordId(input.id) !== input.id) throw new WriteValidationError("Invalid category id.");
  if (!within(input.name, MAX_CATEGORY_NAME_LENGTH)) throw new WriteValidationError("Invalid category name.");
  if (typeof input.slug !== "string" || input.slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(input.slug)) {
    throw new WriteValidationError("Invalid category slug.");
  }
}

// Creates or updates a category after checking its fields, that an edited
// category exists, and that no other category has the slug.
export async function saveCategoryRecord(
  db: WriteDB,
  input: CategoryWriteInput,
  now: number,
  newId: () => string = () => crypto.randomUUID(),
): Promise<string> {
  validateCategoryInput(input);
  if (input.id && !(await idsWhere(db, "SELECT id FROM categories WHERE id = ?", input.id)).length) {
    throw new WriteValidationError("Unknown category.");
  }
  if ((await idsWhere(db, "SELECT id FROM categories WHERE slug = ?", input.slug)).some((id) => id !== input.id)) {
    throw new WriteValidationError("Category slug is already in use.");
  }
  if (input.id) {
    await db.batch([db.prepare("UPDATE categories SET name = ?, slug = ? WHERE id = ?").bind(input.name, input.slug, input.id)]);
    return input.id;
  }
  const id = newId();
  await db.batch([
    db.prepare("INSERT INTO categories (id, name, slug, created_at) VALUES (?, ?, ?, ?)").bind(id, input.name, input.slug, now),
  ]);
  return id;
}

export interface MediaWriteInput {
  url: string;
  altText: string;
  caption: string;
}

// Media records need an allowed image URL, alt text and an optional caption,
// each within its limit.
export function validateMediaInput(input: MediaWriteInput): void {
  if (!isAllowedImageUrl(input.url)) throw new WriteValidationError("Image URL must be https:// or a site path.");
  if (!within(input.altText, MAX_ALT_TEXT_LENGTH)) throw new WriteValidationError("Invalid alt text.");
  if (!within(input.caption, MAX_CAPTION_LENGTH, true)) throw new WriteValidationError("Invalid caption.");
}
