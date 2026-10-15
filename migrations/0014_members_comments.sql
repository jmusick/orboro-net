-- Public member accounts, comments and votes. Members are deliberately a
-- separate table from `users` (the admin accounts), with their own sessions
-- and cookie, so no member session can ever satisfy requireAdmin.

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  -- As typed for display; `username_key` (lowercase) enforces case-insensitive uniqueness.
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  email_verified_at INTEGER,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Same token scheme as `sessions`: the cookie holds a random token and only
-- its SHA-256 digest is stored here.
CREATE TABLE IF NOT EXISTS member_sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS member_sessions_member_idx ON member_sessions(member_id);
CREATE INDEX IF NOT EXISTS member_sessions_expires_idx ON member_sessions(expires_at);

-- Single-use emailed tokens (digest only). `email` is the address the token
-- proves: the account's address for verify, the requested one for an email change.
CREATE TABLE IF NOT EXISTS member_tokens (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify', 'reset', 'email')),
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS member_tokens_member_idx ON member_tokens(member_id, purpose);
CREATE INDEX IF NOT EXISTS member_tokens_expires_idx ON member_tokens(expires_at);

-- Threaded comments on pages and posts. A comment's author may delete it and
-- an admin may remove it; either way a comment with live replies keeps its row
-- (shown as [deleted]/[removed]) so the thread stays intact.
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'deleted', 'removed')),
  created_at INTEGER NOT NULL,
  edited_at INTEGER
);

CREATE INDEX IF NOT EXISTS comments_content_idx ON comments(content_id, created_at);
CREATE INDEX IF NOT EXISTS comments_member_idx ON comments(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments(parent_id);

-- One vote per member per comment. Scores are summed on read, never stored,
-- so deleting a vote or an account can't leave a stale total.
CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (comment_id, member_id)
);

CREATE INDEX IF NOT EXISTS comment_votes_member_idx ON comment_votes(member_id);

CREATE TABLE IF NOT EXISTS comment_reports (
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'off-topic', 'other')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  PRIMARY KEY (comment_id, member_id)
);

CREATE INDEX IF NOT EXISTS comment_reports_open_idx ON comment_reports(resolved_at, created_at);

-- Fixed-window budgets for registration, member sign-in, emails, comments and
-- votes. Keys are SHA-256 digests of scope + value; rows expire with their window.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limits_expires_idx ON rate_limits(expires_at);

-- Per-page comment setting: open, locked (shown read-only) or hidden.
ALTER TABLE content ADD COLUMN comments_mode TEXT NOT NULL DEFAULT 'open' CHECK (comments_mode IN ('open', 'locked', 'hidden'));
