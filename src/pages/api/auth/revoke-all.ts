import type { APIRoute } from "astro";
import { clearSessionCookies, invalidateUserSessions } from "../../../lib/auth";
import { requireUser } from "../../../lib/http";

// Signs the current user out of every session, including this one. Any
// signed-in role may do this, for their own account only.
export const POST: APIRoute = async (context) => {
  const user = requireUser(context);
  if (user instanceof Response) return user;

  try {
    await invalidateUserSessions(context.locals, user.id);
  } catch {
    return context.redirect("/admin?error=sessions");
  }

  clearSessionCookies(context.cookies, context.url);
  return context.redirect("/admin?signedout=all");
};
