// Screens a new password against Have I Been Pwned's Pwned Passwords corpus
// with the k-anonymity range API: only the first five hex characters of the
// password's SHA-1 leave the process, and padded responses hide which range
// was asked for. https://haveibeenpwned.com/API/v3#PwnedPasswords
//
// Plain JavaScript on Web Crypto so the Worker (member passwords) and the
// operator scripts (scripts/lib/pwned-passwords.mjs) share one implementation.

const RANGE_URL = "https://api.pwnedpasswords.com/range/";

async function sha1Hex(text) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text)));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * How many times the password appears in known breaches (0 when absent).
 * Throws when the service can't be reached or answers unexpectedly, so the
 * caller decides whether to refuse or proceed.
 * @param {string} password
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, userAgent?: string }} [options]
 * @returns {Promise<number>}
 */
export async function pwnedCount(password, { fetchImpl = fetch, timeoutMs = 10_000, userAgent = "orboro-net" } = {}) {
  const digest = await sha1Hex(password);
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  const res = await fetchImpl(RANGE_URL + prefix, {
    headers: { "Add-Padding": "true", "User-Agent": userAgent },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Pwned Passwords answered HTTP ${res.status}.`);
  const body = await res.text();
  let lines = 0;
  for (const line of body.split(/\r?\n/)) {
    const [hashSuffix, count] = line.trim().split(":");
    if (!hashSuffix) continue;
    if (!/^[0-9A-F]{35}$/.test(hashSuffix) || !/^[0-9]+$/.test(count ?? "")) {
      throw new Error("Pwned Passwords returned an unexpected response.");
    }
    lines += 1;
    if (hashSuffix === suffix) return Number(count);
  }
  if (lines === 0) throw new Error("Pwned Passwords returned an empty range.");
  return 0;
}
