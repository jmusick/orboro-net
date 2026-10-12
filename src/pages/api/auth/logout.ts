import type { APIRoute } from "astro";
import { env as workerEnv } from "cloudflare:workers";
import { clearSessionCookies, invalidateSession, readSessionCookie } from "../../../lib/auth";

export const POST: APIRoute = async ({ cookies, locals, redirect, url }) => {
  const token = readSessionCookie(cookies, url);
  if (token && ((workerEnv as unknown) as { DB?: unknown }).DB) {
    await invalidateSession(locals, token);
  }

  clearSessionCookies(cookies, url);
  return redirect("/admin");
};
