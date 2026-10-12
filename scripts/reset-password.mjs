/**
 * Sets a new password for an existing account and signs it out of every
 * session, in one atomic D1 file.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run admin:reset-password -- --local|--remote
 *
 * The password is read from the environment so it stays out of shell history
 * and the process list. The hash matches `hashPassword` in src/lib/auth.ts.
 */
import { MIN_PASSWORD_LENGTH, executeD1, hashPassword } from "./lib/d1.mjs";
import { buildResetPasswordSql } from "./lib/session-sql.mjs";

const target = process.argv.includes("--remote") ? "--remote" : process.argv.includes("--local") ? "--local" : null;
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!target || !email.includes("@") || password.length < MIN_PASSWORD_LENGTH) {
  console.error(
    `Usage: ADMIN_EMAIL=<email> ADMIN_PASSWORD=<at least ${MIN_PASSWORD_LENGTH} characters> npm run admin:reset-password -- --local|--remote`,
  );
  process.exit(1);
}

const status = executeD1(target, buildResetPasswordSql({ email, passwordHash: hashPassword(password) }), "reset-password");
if (status !== 0) process.exit(status);
console.log("Done. matching_users 1 means the password changed and every session for it was revoked; 0 means no account has that email.");
