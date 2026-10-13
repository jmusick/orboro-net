/**
 * Creates the first admin user in D1, only when the users table is empty.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run admin:create -- --local
 *
 * Pass --local for the local D1 simulation or --remote for production. The
 * password is read from the environment so it stays out of shell history and
 * the process list. It must meet the rules in src/lib/passwords.js and is
 * screened against known breaches (scripts/lib/pwned-passwords.mjs) unless
 * --skip-breach-check is given.
 */
import { randomUUID } from "node:crypto";
import { MAX_PASSWORD_CODE_POINTS, MIN_PASSWORD_CODE_POINTS, hashPassword } from "../src/lib/passwords.js";
import { executeD1, quote } from "./lib/d1.mjs";
import { SKIP_BREACH_CHECK, newPasswordProblem } from "./lib/new-password.mjs";

const target = process.argv.includes("--remote") ? "--remote" : process.argv.includes("--local") ? "--local" : null;
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!target || !email.includes("@")) {
  console.error(
    `Usage: ADMIN_EMAIL=<email> ADMIN_PASSWORD=<${MIN_PASSWORD_CODE_POINTS}-${MAX_PASSWORD_CODE_POINTS} characters> npm run admin:create -- --local|--remote [${SKIP_BREACH_CHECK}]`,
  );
  process.exit(1);
}

const problem = await newPasswordProblem({ email, password });
if (problem) {
  console.error(problem);
  process.exit(1);
}

// A single conditional INSERT is atomic, so this never adds a second admin.
const sql = `INSERT INTO users (id, email, password_hash, role, created_at)
SELECT ${quote(randomUUID())}, ${quote(email)}, ${quote(await hashPassword(password))}, 'admin', ${Date.now()}
WHERE NOT EXISTS (SELECT 1 FROM users);
SELECT COUNT(1) AS users FROM users;
`;

const status = executeD1(target, sql, "create-admin");
if (status !== 0) process.exit(status);
console.log("Done. A users count of 1 means an admin exists; if one already existed, nothing was inserted.");
