// The member session cookie: `__Host-orboro_member` over HTTPS and
// `orboro_member` on local HTTP. Separate from the admin cookie
// (session-cookie.ts) so the two kinds of session never mix.
import type { AstroCookies } from "astro";
import { sessionCookieOptions } from "./sessions.ts";

export const SECURE_MEMBER_COOKIE = "__Host-orboro_member";
export const LOCAL_MEMBER_COOKIE = "orboro_member";

function isSecure(url: URL): boolean {
  return url.protocol === "https:";
}

export function memberCookieName(secure: boolean): string {
  return secure ? SECURE_MEMBER_COOKIE : LOCAL_MEMBER_COOKIE;
}

export function readMemberCookie(cookies: AstroCookies, url: URL): string | undefined {
  return cookies.get(memberCookieName(isSecure(url)))?.value || undefined;
}

export function hasMemberCookie(cookies: AstroCookies, url: URL): boolean {
  return cookies.has(memberCookieName(isSecure(url)));
}

export function setMemberCookie(cookies: AstroCookies, url: URL, token: string, expiresAt: number): void {
  const secure = isSecure(url);
  cookies.set(memberCookieName(secure), token, sessionCookieOptions(secure, expiresAt));
}

export function clearMemberCookie(cookies: AstroCookies, url: URL): void {
  const secure = isSecure(url);
  const name = memberCookieName(secure);
  if (cookies.has(name)) cookies.delete(name, sessionCookieOptions(secure));
}
