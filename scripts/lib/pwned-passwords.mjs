// Breach screening for the operator scripts. The implementation is shared
// with the Worker in src/lib/pwned-passwords.js.
import { pwnedCount as sharedPwnedCount } from "../../src/lib/pwned-passwords.js";

/**
 * How many times the password appears in known breaches (0 when absent).
 * Throws when the service can't be reached, so the caller can refuse rather
 * than skip the check silently.
 */
export function pwnedCount(password, options = {}) {
  return sharedPwnedCount(password, { userAgent: "orboro-net-operator-scripts", ...options });
}
