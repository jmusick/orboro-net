// Reads and writes the session cookie: `__Host-orboro_session` over HTTPS and
// `orboro_session` on local HTTP (see src/lib/sessions.ts).
import type { AstroCookies } from "astro";
import { sessionCookieName, sessionCookieOptions, staleSessionCookieNames } from "./sessions.ts";

function isSecure(url: URL): boolean {
  return url.protocol === "https:";
}

export function readSessionCookie(cookies: AstroCookies, url: URL): string | undefined {
  return cookies.get(sessionCookieName(isSecure(url)))?.value || undefined;
}

/** True when any current or stale session cookie was sent. */
export function hasSessionCookie(cookies: AstroCookies, url: URL): boolean {
  const secure = isSecure(url);
  return [sessionCookieName(secure), ...staleSessionCookieNames(secure)].some((name) => cookies.has(name));
}

export function setSessionCookie(cookies: AstroCookies, url: URL, token: string, expiresAt: number): void {
  const secure = isSecure(url);
  clearStaleSessionCookies(cookies, url);
  cookies.set(sessionCookieName(secure), token, sessionCookieOptions(secure, expiresAt));
}

export function clearSessionCookies(cookies: AstroCookies, url: URL): void {
  const secure = isSecure(url);
  const name = sessionCookieName(secure);
  if (cookies.has(name)) cookies.delete(name, sessionCookieOptions(secure));
  clearStaleSessionCookies(cookies, url);
}

export function clearStaleSessionCookies(cookies: AstroCookies, url: URL): void {
  const secure = isSecure(url);
  for (const name of staleSessionCookieNames(secure)) {
    if (cookies.has(name)) cookies.delete(name, sessionCookieOptions(secure));
  }
}
