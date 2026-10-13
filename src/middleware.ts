import { defineMiddleware } from "astro:middleware";
import { env as workerEnv } from "cloudflare:workers";
import {
  clearSessionCookies,
  clearStaleSessionCookies,
  getSessionAndUserByToken,
  hasSessionCookie,
  readSessionCookie,
} from "./lib/auth";
import { isPrivatePath, privateCacheControl } from "./lib/cache-policy";
import { adminActionEvent, logSecurityEvent } from "./lib/security-events";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'none'",
    // Published Markdown, Atlas artwork and bookmark favicons may use HTTPS
    // image hosts. Images cannot authorize executable script or stylesheet loads.
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;
  context.locals.nonce = generateNonce();

  const hasSession = hasSessionCookie(context.cookies, context.url);
  const token = readSessionCookie(context.cookies, context.url);
  if (hasSession && ((workerEnv as unknown) as { DB?: unknown }).DB) {
    try {
      const { session, user } = token ? await getSessionAndUserByToken(context.locals, token) : { session: null, user: null };
      context.locals.session = session;
      context.locals.user = user;
      // Expired, revoked and pre-digest cookies are cleared, as is the
      // unprefixed legacy name over HTTPS.
      if (session) clearStaleSessionCookies(context.cookies, context.url);
      else {
        // Expired, revoked or forged; only the fact is logged, never the cookie.
        logSecurityEvent("auth.session.rejected", {}, context.request);
        clearSessionCookies(context.cookies, context.url);
      }
    } catch {
      logSecurityEvent("auth.session.lookup-failed", {}, context.request);
      clearSessionCookies(context.cookies, context.url);
    }
  }

  // Every admin POST gets one admin.action event with its outcome, so a new
  // mutation route is covered without its own logging code.
  const pathname = new URL(context.request.url).pathname;
  const audit = (response: Response | null) => {
    const fields = adminActionEvent(context.request.method, pathname, context.locals.user, response, context.locals.auditTarget);
    if (fields) logSecurityEvent("admin.action", fields, context.request);
  };
  let response: Response;
  try {
    response = await next();
  } catch (error) {
    audit(null);
    throw error;
  }
  audit(response);

  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  response.headers.set(
    "Content-Security-Policy",
    buildCsp(context.locals.nonce),
  );

  const cacheControl = privateCacheControl(
    new URL(context.request.url).pathname,
    hasSession,
    response.headers.get("Content-Type"),
    response.headers.get("Cache-Control"),
  );
  if (cacheControl) response.headers.set("Cache-Control", cacheControl);

  // Index hygiene only; the auth guards are what protect these routes. The
  // exact /admin login stays crawlable in robots.txt so crawlers can see this.
  if (isPrivatePath(new URL(context.request.url).pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
});
