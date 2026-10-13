// Checks a new admin password for the provisioning scripts: the shared rules
// in src/lib/passwords.js, then breach screening. Returns a message to print,
// or null when the password may be used.
import { passwordProblem } from "../../src/lib/passwords.js";
import { pwnedCount } from "./pwned-passwords.mjs";

export const SKIP_BREACH_CHECK = "--skip-breach-check";

export async function newPasswordProblem({ email, password, argv = process.argv, lookup = pwnedCount }) {
  const problem = passwordProblem(password, { email });
  if (problem) return problem;
  if (argv.includes(SKIP_BREACH_CHECK)) {
    console.warn(`Warning: ${SKIP_BREACH_CHECK} given; the password was not screened against known breaches.`);
    return null;
  }
  let count;
  try {
    count = await lookup(password);
  } catch (err) {
    return `Couldn't screen the password against known breaches (${err.message}). Retry, or pass ${SKIP_BREACH_CHECK} to proceed without screening.`;
  }
  return count > 0 ? `That password appears in ${count.toLocaleString("en-US")} known breaches. Choose another.` : null;
}
