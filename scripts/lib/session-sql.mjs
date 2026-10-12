// SQL for the credential-recovery scripts, kept separate so tests can run it.
import { quote } from "./d1.mjs";

const userSessions = (email) => `user_id IN (SELECT id FROM users WHERE email = ${quote(email)})`;

/** Deletes every session for one account (`email`) or for all accounts (`all`). */
export function buildRevokeSql({ email, all }) {
  if (all) {
    return `SELECT COUNT(1) AS sessions_before FROM sessions;
DELETE FROM sessions;
SELECT COUNT(1) AS sessions_remaining FROM sessions;
`;
  }
  return `SELECT COUNT(1) AS matching_users FROM users WHERE email = ${quote(email)};
SELECT COUNT(1) AS sessions_before FROM sessions WHERE ${userSessions(email)};
DELETE FROM sessions WHERE ${userSessions(email)};
SELECT COUNT(1) AS sessions_remaining FROM sessions WHERE ${userSessions(email)};
`;
}

/** Replaces an existing account's password hash and revokes its sessions in one file. */
export function buildResetPasswordSql({ email, passwordHash }) {
  return `SELECT COUNT(1) AS matching_users FROM users WHERE email = ${quote(email)};
UPDATE users SET password_hash = ${quote(passwordHash)} WHERE email = ${quote(email)};
DELETE FROM sessions WHERE ${userSessions(email)};
SELECT COUNT(1) AS sessions_remaining FROM sessions WHERE ${userSessions(email)};
`;
}
