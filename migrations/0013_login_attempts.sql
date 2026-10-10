-- Fixed-window login attempt counters. Keys are SHA-256 digests (account email
-- or client IP), so neither is stored in readable form; rows are short-lived.
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS login_attempts_window_idx ON login_attempts(window_start);
