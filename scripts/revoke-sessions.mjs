/**
 * Signs one account (or every account) out of all sessions in D1.
 *
 *   npm run sessions:revoke -- --email you@example.com            # local D1
 *   npm run sessions:revoke -- --email you@example.com --remote   # production
 *   npm run sessions:revoke -- --all [--remote]
 *
 * Local D1 is the default; production needs an explicit --remote. Every
 * browser holding a revoked session must sign in again.
 */
import { argValue, executeD1 } from "./lib/d1.mjs";
import { buildRevokeSql } from "./lib/session-sql.mjs";

const argv = process.argv.slice(2);
const target = argv.includes("--remote") ? "--remote" : "--local";
const all = argv.includes("--all");
const email = (argValue(argv, "email") ?? "").trim().toLowerCase();

if (all === Boolean(email) || (email && !email.includes("@"))) {
  console.error("Usage: npm run sessions:revoke -- --email <email> | --all [--remote]");
  process.exit(1);
}

const where = target === "--remote" ? "REMOTE (production)" : "local";
console.log(`Revoking all sessions for ${all ? "every account" : email} in ${where} D1.`);
const status = executeD1(target, buildRevokeSql({ email, all }), "revoke-sessions");
if (status !== 0) process.exit(status);
console.log(
  all
    ? "Done. sessions_remaining should be 0."
    : "Done. matching_users 0 means no account has that email; sessions_remaining should be 0.",
);
