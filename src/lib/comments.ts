// Threaded comments with reddit-style voting on pages and posts. Every rule a
// member could try to cross is enforced here, in the SQL, not in the routes:
// only the author may edit or delete a comment (`AND member_id = ?`), votes and
// reports are keyed by (comment, member), and nothing can be written to
// unpublished content or content whose comments are locked or hidden. Kept free
// of Worker-only imports so tests drive it with a node:sqlite stand-in.

import type { MemberDB } from "./members.ts";

export const MAX_COMMENT_LENGTH = 10_000;
/** Replies nest up to this depth (0 = top level); deeper threads continue flat. */
export const MAX_COMMENT_DEPTH = 8;
/** Upper bound on comments loaded for one page. */
export const MAX_COMMENTS_PER_CONTENT = 2000;

export const COMMENT_SORTS = ["best", "top", "new", "old"] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number];
export const REPORT_REASONS = ["spam", "harassment", "off-topic", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const COMMENTS_MODES = ["open", "locked", "hidden"] as const;
export type CommentsMode = (typeof COMMENTS_MODES)[number];

export type CommentErrorCode =
  | "body"
  | "closed"
  | "parent"
  | "depth"
  | "not-found"
  | "own-comment";

export class CommentError extends Error {
  code: CommentErrorCode;
  constructor(code: CommentErrorCode) {
    super(code);
    this.code = code;
  }
}

const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;

/** Normalized comment text, or null when it breaks a rule. */
export function normalizeCommentBody(value: unknown): string | null {
  if (typeof value !== "string" || !value.isWellFormed()) return null;
  const body = value.replace(/\r\n?/g, "\n").trim();
  if (!body || body.length > MAX_COMMENT_LENGTH || CONTROL.test(body)) return null;
  return body;
}

export function contentPath(pageType: string, slug: string): string {
  return pageType === "post" ? `/blog/${slug}` : `/pages/${slug}`;
}

// ── Rendering ───────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCTUATION = /[.,!?:;)\]}]+$/;

function linkify(line: string): string {
  let out = "";
  let last = 0;
  for (const match of line.matchAll(URL_PATTERN)) {
    let url = match[0];
    const trailing = url.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    if (trailing) url = url.slice(0, -trailing.length);
    out += escapeHtml(line.slice(last, match.index));
    let valid = false;
    try {
      const parsed = new URL(url);
      valid = (parsed.protocol === "https:" || parsed.protocol === "http:") && !parsed.username && !parsed.password;
    } catch {
      valid = false;
    }
    out += valid ? `<a href="${escapeHtml(url)}" rel="ugc nofollow noopener">${escapeHtml(url)}</a>` : escapeHtml(url);
    out += escapeHtml(trailing);
    last = match.index! + match[0].length;
  }
  return out + escapeHtml(line.slice(last));
}

/**
 * Comment text to HTML. Comments are plain text, never Markdown or HTML: every
 * character is escaped, blank lines separate paragraphs, lines starting with
 * `>` form a quote, and bare http(s) URLs become `rel="ugc nofollow"` links.
 */
export function renderCommentBody(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((line) => line.startsWith(">"))) {
        return `<blockquote><p>${lines.map((line) => linkify(line.replace(/^>\s?/, ""))).join("<br>")}</p></blockquote>`;
      }
      return `<p>${lines.map(linkify).join("<br>")}</p>`;
    })
    .join("");
}

// ── Reading ─────────────────────────────────────────────────────────────────

export interface CommentAuthor {
  id: string;
  username: string;
  displayName: string;
}

export interface CommentNode {
  id: string;
  parentId: string | null;
  depth: number;
  /** Empty for deleted and removed comments. */
  body: string;
  status: "visible" | "deleted" | "removed";
  createdAt: number;
  editedAt: number | null;
  /** Null when the comment is deleted or removed, or its author deleted their account. */
  author: CommentAuthor | null;
  ups: number;
  downs: number;
  score: number;
  /** The viewer's vote: 1, -1 or 0. */
  myVote: number;
  /** True when the viewer wrote it. */
  mine: boolean;
  children: CommentNode[];
}

interface CommentRow {
  id: string;
  parent_id: string | null;
  depth: number;
  body: string;
  status: CommentNode["status"];
  created_at: number;
  edited_at: number | null;
  member_id: string | null;
  username: string | null;
  display_name: string | null;
  ups: number;
  downs: number;
  my_vote: number;
}

/**
 * Lower bound of the Wilson score interval for the share of upvotes (80%
 * confidence), the ordering reddit calls "best": a comment with 30 up / 2 down
 * beats one with 2 up / 0 down.
 */
export function wilsonLowerBound(ups: number, downs: number): number {
  const n = ups + downs;
  if (n === 0) return 0;
  const z = 1.281551565545;
  const p = ups / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / (1 + (z * z) / n);
}

const COMPARATORS: Record<CommentSort, (a: CommentNode, b: CommentNode) => number> = {
  best: (a, b) => wilsonLowerBound(b.ups, b.downs) - wilsonLowerBound(a.ups, a.downs) || b.score - a.score || a.createdAt - b.createdAt,
  top: (a, b) => b.score - a.score || a.createdAt - b.createdAt,
  new: (a, b) => b.createdAt - a.createdAt,
  old: (a, b) => a.createdAt - b.createdAt,
};

export function parseCommentSort(value: string | null | undefined): CommentSort {
  return (COMMENT_SORTS as readonly string[]).includes(value ?? "") ? (value as CommentSort) : "best";
}

/**
 * Builds the thread for one page. Deleted and removed comments keep their
 * place only while a visible reply hangs under them, and then show no text or
 * author. Returns the roots and the number of visible comments.
 */
export function buildCommentTree(rows: CommentRow[], viewerId: string | null, sort: CommentSort): { roots: CommentNode[]; count: number } {
  const nodes = new Map<string, CommentNode>();
  for (const row of rows) {
    const live = row.status === "visible";
    nodes.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      depth: row.depth,
      body: live ? row.body : "",
      status: row.status,
      createdAt: row.created_at,
      editedAt: live ? row.edited_at : null,
      author: live && row.member_id && row.username
        ? { id: row.member_id, username: row.username, displayName: row.display_name ?? "" }
        : null,
      ups: row.ups,
      downs: row.downs,
      score: row.ups - row.downs,
      myVote: row.my_vote,
      mine: live && viewerId !== null && row.member_id === viewerId,
      children: [],
    });
  }
  const roots: CommentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else if (!node.parentId) roots.push(node);
  }
  let count = 0;
  const prune = (list: CommentNode[]): CommentNode[] => {
    const kept: CommentNode[] = [];
    for (const node of list) {
      node.children = prune(node.children);
      if (node.status === "visible") count += 1;
      if (node.status === "visible" || node.children.length > 0) kept.push(node);
    }
    return kept.sort(COMPARATORS[sort]);
  };
  return { roots: prune(roots), count };
}

export async function listCommentTree(
  db: MemberDB,
  contentId: string,
  viewerId: string | null,
  sort: CommentSort = "best",
): Promise<{ roots: CommentNode[]; count: number }> {
  const result = await db
    .prepare(
      `SELECT c.id, c.parent_id, c.depth, c.body, c.status, c.created_at, c.edited_at, c.member_id,
         m.username, m.display_name,
         COALESCE(SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END), 0) AS ups,
         COALESCE(SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END), 0) AS downs,
         COALESCE(MAX(CASE WHEN v.member_id = ? THEN v.value END), 0) AS my_vote
       FROM comments c
       LEFT JOIN members m ON m.id = c.member_id
       LEFT JOIN comment_votes v ON v.comment_id = c.id
       WHERE c.content_id = ?
       GROUP BY c.id
       ORDER BY c.created_at ASC
       LIMIT ${MAX_COMMENTS_PER_CONTENT}`,
    )
    .bind(viewerId ?? "", contentId)
    .all<CommentRow>();
  return buildCommentTree(result.results ?? [], viewerId, sort);
}

export interface CommentTarget {
  contentId: string;
  path: string;
  memberId: string | null;
}

/** Where a comment lives, for redirects back to it. Null for unknown IDs. */
export async function getCommentTarget(db: MemberDB, commentId: string): Promise<CommentTarget | null> {
  const row = await db
    .prepare(
      `SELECT c.content_id, c.member_id, ct.page_type, ct.slug FROM comments c
       JOIN content ct ON ct.id = c.content_id WHERE c.id = ? LIMIT 1`,
    )
    .bind(commentId)
    .first<{ content_id: string; member_id: string | null; page_type: string; slug: string }>();
  return row ? { contentId: row.content_id, path: contentPath(row.page_type, row.slug), memberId: row.member_id } : null;
}

export interface CommentableContent {
  id: string;
  path: string;
  status: string;
  commentsMode: CommentsMode;
}

export async function getCommentableContent(db: MemberDB, contentId: string): Promise<CommentableContent | null> {
  const row = await db
    .prepare("SELECT id, page_type, slug, status, comments_mode FROM content WHERE id = ? LIMIT 1")
    .bind(contentId)
    .first<{ id: string; page_type: string; slug: string; status: string; comments_mode: CommentsMode }>();
  return row ? { id: row.id, path: contentPath(row.page_type, row.slug), status: row.status, commentsMode: row.comments_mode } : null;
}

// ── Writing ─────────────────────────────────────────────────────────────────

/** Comments, votes and edits need published content with comments open. */
const OPEN_CONTENT = "SELECT 1 FROM content WHERE id = ? AND status = 'published' AND comments_mode = 'open'";

async function requireOpenContent(db: MemberDB, contentId: string): Promise<void> {
  if (!(await db.prepare(OPEN_CONTENT).bind(contentId).first())) throw new CommentError("closed");
}

/**
 * Posts a comment or reply. The author's own upvote is recorded with it, as on
 * reddit, so a new comment starts at 1.
 */
export async function createComment(
  db: MemberDB,
  input: { contentId: string; memberId: string; parentId: string | null; body: unknown },
  now: number = Date.now(),
  newId: () => string = () => crypto.randomUUID(),
): Promise<string> {
  const body = normalizeCommentBody(input.body);
  if (!body) throw new CommentError("body");
  await requireOpenContent(db, input.contentId);

  let depth = 0;
  if (input.parentId) {
    const parent = await db
      .prepare("SELECT depth FROM comments WHERE id = ? AND content_id = ? AND status = 'visible'")
      .bind(input.parentId, input.contentId)
      .first<{ depth: number }>();
    if (!parent) throw new CommentError("parent");
    if (parent.depth >= MAX_COMMENT_DEPTH) throw new CommentError("depth");
    depth = parent.depth + 1;
  }

  const id = newId();
  await db.batch([
    db
      .prepare("INSERT INTO comments (id, content_id, member_id, parent_id, depth, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'visible', ?)")
      .bind(id, input.contentId, input.memberId, input.parentId, depth, body, now),
    db.prepare("INSERT INTO comment_votes (comment_id, member_id, value, created_at) VALUES (?, ?, 1, ?)").bind(id, input.memberId, now),
  ]);
  return id;
}

async function ownVisibleComment(db: MemberDB, commentId: string, memberId: string): Promise<{ content_id: string }> {
  const row = await db
    .prepare("SELECT content_id FROM comments WHERE id = ? AND member_id = ? AND status = 'visible'")
    .bind(commentId, memberId)
    .first<{ content_id: string }>();
  if (!row) throw new CommentError("not-found");
  return row;
}

/** Edits the member's own visible comment while its page is open for comments. */
export async function editComment(
  db: MemberDB,
  input: { commentId: string; memberId: string; body: unknown },
  now: number = Date.now(),
): Promise<void> {
  const body = normalizeCommentBody(input.body);
  if (!body) throw new CommentError("body");
  const comment = await ownVisibleComment(db, input.commentId, input.memberId);
  await requireOpenContent(db, comment.content_id);
  await db
    .prepare("UPDATE comments SET body = ?, edited_at = ? WHERE id = ? AND member_id = ? AND status = 'visible'")
    .bind(body, now, input.commentId, input.memberId)
    .run();
}

/**
 * Deletes the member's own comment. One with replies stays as an empty
 * [deleted] placeholder so the thread keeps its shape; one without is gone.
 */
export async function deleteOwnComment(db: MemberDB, input: { commentId: string; memberId: string }): Promise<void> {
  await ownVisibleComment(db, input.commentId, input.memberId);
  const reply = await db.prepare("SELECT 1 FROM comments WHERE parent_id = ? LIMIT 1").bind(input.commentId).first();
  if (reply) {
    await db
      .prepare("UPDATE comments SET status = 'deleted', body = '', edited_at = NULL WHERE id = ? AND member_id = ?")
      .bind(input.commentId, input.memberId)
      .run();
  } else {
    await db.prepare("DELETE FROM comments WHERE id = ? AND member_id = ?").bind(input.commentId, input.memberId).run();
  }
}

/**
 * Reddit-style voting: clicking the arrow you already chose clears your vote,
 * the other arrow switches it. Returns the viewer's new vote and the score.
 */
export async function voteOnComment(
  db: MemberDB,
  input: { commentId: string; memberId: string; direction: 1 | -1 },
  now: number = Date.now(),
): Promise<{ vote: number; score: number }> {
  const comment = await db
    .prepare("SELECT content_id FROM comments WHERE id = ? AND status = 'visible'")
    .bind(input.commentId)
    .first<{ content_id: string }>();
  if (!comment) throw new CommentError("not-found");
  await requireOpenContent(db, comment.content_id);

  const existing = await db
    .prepare("SELECT value FROM comment_votes WHERE comment_id = ? AND member_id = ?")
    .bind(input.commentId, input.memberId)
    .first<{ value: number }>();
  let vote: number = input.direction;
  if (existing?.value === input.direction) {
    vote = 0;
    await db.prepare("DELETE FROM comment_votes WHERE comment_id = ? AND member_id = ?").bind(input.commentId, input.memberId).run();
  } else {
    await db
      .prepare(
        `INSERT INTO comment_votes (comment_id, member_id, value, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(comment_id, member_id) DO UPDATE SET value = excluded.value, created_at = excluded.created_at`,
      )
      .bind(input.commentId, input.memberId, input.direction, now)
      .run();
  }
  const total = await db
    .prepare("SELECT COALESCE(SUM(value), 0) AS score FROM comment_votes WHERE comment_id = ?")
    .bind(input.commentId)
    .first<{ score: number }>();
  return { vote, score: total?.score ?? 0 };
}

/** Flags a visible comment for the moderation queue. A member reports a comment once and never their own. */
export async function reportComment(
  db: MemberDB,
  input: { commentId: string; memberId: string; reason: string },
  now: number = Date.now(),
): Promise<void> {
  if (!(REPORT_REASONS as readonly string[]).includes(input.reason)) throw new CommentError("body");
  const comment = await db
    .prepare("SELECT member_id FROM comments WHERE id = ? AND status = 'visible'")
    .bind(input.commentId)
    .first<{ member_id: string | null }>();
  if (!comment) throw new CommentError("not-found");
  if (comment.member_id === input.memberId) throw new CommentError("own-comment");
  await db
    .prepare("INSERT OR IGNORE INTO comment_reports (comment_id, member_id, reason, created_at) VALUES (?, ?, ?, ?)")
    .bind(input.commentId, input.memberId, input.reason, now)
    .run();
}

// ── Profiles and moderation ─────────────────────────────────────────────────

export interface MemberCommentSummary {
  id: string;
  body: string;
  createdAt: number;
  score: number;
  contentTitle: string;
  path: string;
}

/** A member's recent visible comments on published pages, for their profile. */
export async function listMemberComments(db: MemberDB, memberId: string, limit = 20): Promise<MemberCommentSummary[]> {
  const result = await db
    .prepare(
      `SELECT c.id, c.body, c.created_at, ct.title, ct.page_type, ct.slug,
         (SELECT COALESCE(SUM(value), 0) FROM comment_votes v WHERE v.comment_id = c.id) AS score
       FROM comments c JOIN content ct ON ct.id = c.content_id
       WHERE c.member_id = ? AND c.status = 'visible' AND ct.status = 'published' AND ct.comments_mode <> 'hidden'
       ORDER BY c.created_at DESC LIMIT ?`,
    )
    .bind(memberId, limit)
    .all<{ id: string; body: string; created_at: number; title: string; page_type: string; slug: string; score: number }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    score: row.score,
    contentTitle: row.title,
    path: contentPath(row.page_type, row.slug),
  }));
}

export interface ModerationItem {
  id: string;
  body: string;
  status: CommentNode["status"];
  createdAt: number;
  score: number;
  author: { id: string; username: string; status: string } | null;
  contentTitle: string;
  path: string;
  openReports: number;
  reasons: string[];
}

interface ModerationRow {
  id: string;
  body: string;
  status: CommentNode["status"];
  created_at: number;
  member_id: string | null;
  username: string | null;
  member_status: string | null;
  title: string;
  page_type: string;
  slug: string;
  score: number;
  open_reports: number;
  reasons: string | null;
}

const MODERATION_SELECT = `SELECT c.id, c.body, c.status, c.created_at, c.member_id, m.username, m.status AS member_status,
    ct.title, ct.page_type, ct.slug,
    (SELECT COALESCE(SUM(value), 0) FROM comment_votes v WHERE v.comment_id = c.id) AS score,
    (SELECT COUNT(*) FROM comment_reports r WHERE r.comment_id = c.id AND r.resolved_at IS NULL) AS open_reports,
    (SELECT group_concat(DISTINCT r.reason) FROM comment_reports r WHERE r.comment_id = c.id AND r.resolved_at IS NULL) AS reasons
  FROM comments c
  JOIN content ct ON ct.id = c.content_id
  LEFT JOIN members m ON m.id = c.member_id`;

function mapModeration(row: ModerationRow): ModerationItem {
  return {
    id: row.id,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    score: row.score,
    author: row.member_id && row.username ? { id: row.member_id, username: row.username, status: row.member_status ?? "active" } : null,
    contentTitle: row.title,
    path: contentPath(row.page_type, row.slug),
    openReports: row.open_reports,
    reasons: row.reasons ? row.reasons.split(",") : [],
  };
}

/** Comments with unresolved reports, most reported first. */
export async function listReportedComments(db: MemberDB, limit = 100): Promise<ModerationItem[]> {
  const result = await db
    .prepare(`${MODERATION_SELECT} WHERE EXISTS (SELECT 1 FROM comment_reports r WHERE r.comment_id = c.id AND r.resolved_at IS NULL)
      ORDER BY open_reports DESC, c.created_at DESC LIMIT ?`)
    .bind(limit)
    .all<ModerationRow>();
  return (result.results ?? []).map(mapModeration);
}

/** Newest comments site-wide, removed ones included, for the moderation page. */
export async function listRecentComments(db: MemberDB, limit = 50, memberId?: string): Promise<ModerationItem[]> {
  const where = memberId ? "WHERE c.member_id = ? AND c.status <> 'deleted'" : "WHERE c.status <> 'deleted'";
  const statement = db.prepare(`${MODERATION_SELECT} ${where} ORDER BY c.created_at DESC LIMIT ?`);
  const result = await (memberId ? statement.bind(memberId, limit) : statement.bind(limit)).all<ModerationRow>();
  return (result.results ?? []).map(mapModeration);
}

export const MODERATION_ACTIONS = ["remove", "restore", "dismiss"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

/**
 * Admin moderation. Remove hides a visible comment (its text is kept so it can
 * be restored); restore undoes that; both, and dismiss, resolve open reports.
 */
export async function moderateComment(db: MemberDB, commentId: string, action: ModerationAction, now: number = Date.now()): Promise<boolean> {
  const exists = await db.prepare("SELECT status FROM comments WHERE id = ?").bind(commentId).first<{ status: string }>();
  if (!exists) return false;
  const statements = [];
  if (action === "remove") statements.push(db.prepare("UPDATE comments SET status = 'removed' WHERE id = ? AND status = 'visible'").bind(commentId));
  if (action === "restore") statements.push(db.prepare("UPDATE comments SET status = 'visible' WHERE id = ? AND status = 'removed'").bind(commentId));
  statements.push(db.prepare("UPDATE comment_reports SET resolved_at = ? WHERE comment_id = ? AND resolved_at IS NULL").bind(now, commentId));
  await db.batch(statements);
  return true;
}

/** Counts for the admin dashboard. */
export async function moderationCounts(db: MemberDB): Promise<{ openReports: number; members: number }> {
  const row = await db
    .prepare(
      `SELECT (SELECT COUNT(DISTINCT comment_id) FROM comment_reports WHERE resolved_at IS NULL) AS open_reports,
              (SELECT COUNT(*) FROM members) AS members`,
    )
    .first<{ open_reports: number; members: number }>();
  return { openReports: row?.open_reports ?? 0, members: row?.members ?? 0 };
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 hours ago", for comment timestamps (the exact time goes in the title). */
export function relativeTime(then: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  const format = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (seconds >= size) return format.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
}
