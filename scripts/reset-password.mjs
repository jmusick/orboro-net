/**
 * Sets a new password for an existing account and signs it out of every
 * session, in one atomic D1 file.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run admin:reset-password -- --local|--remote
 *
 * The password is read from the environment so it stays out of shell history
 * and the process list. It must meet the rules in src/lib/passwords.js and is
 * screened against known breaches (scripts/lib/pwned-passwords.mjs) unless
 * --skip-breach-check is given.
 */
import { MAX_PASSWORD_CODE_POINTS, MIN_PASSWORD_CODE_POINTS, hashPassword } from "../src/lib/passwords.js";
import { executeD1 } from "./lib/d1.mjs";
import { SKIP_BREACH_CHECK, newPasswordProblem } from "./lib/new-password.mjs";
import { buildResetPasswordSql } from "./lib/session-sql.mjs";

const target = process.argv.includes("--remote") ? "--remote" : process.argv.includes("--local") ? "--local" : null;
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!target || !email.includes("@")) {
  console.error(
    `Usage: ADMIN_EMAIL=<email> ADMIN_PASSWORD=<${MIN_PASSWORD_CODE_POINTS}-${MAX_PASSWORD_CODE_POINTS} characters> npm run admin:reset-password -- --local|--remote [${SKIP_BREACH_CHECK}]`,
  );
  process.exit(1);
}

const problem = await newPasswordProblem({ email, password });
if (problem) {
  console.error(problem);
  process.exit(1);
}

const status = executeD1(target, buildResetPasswordSql({ email, passwordHash: await hashPassword(password) }), "reset-password");
if (status !== 0) process.exit(status);
console.log("Done. matching_users 1 means the password changed and every session for it was revoked; 0 means no account has that email.");
