import type { APIContext } from "astro";
import { logSecurityEvent } from "./security-events.ts";

type GuardContext = Pick<APIContext, "locals" | "redirect"> & Partial<Pick<APIContext, "request">>;

export function requireUser(context: GuardContext): UserRecord | Response {
  const user = context.locals.user;
  if (!user) {
    logSecurityEvent("authz.denied", { reason: "signed-out" }, context.request);
    return context.redirect("/admin");
  }
  return user;
}

export function isAdmin(user: UserRecord | null | undefined): user is UserRecord {
  return user?.role === "admin";
}

/**
 * The guard for every admin page and mutation endpoint. The app is admin-only
 * by design (issue #16): `editor` and `author` exist in the schema but grant
 * no access. Signed-out requests go to the login page; signed-in non-admins
 * go to /admin?error=forbidden, which explains and offers sign out.
 */
export function requireAdmin(context: GuardContext): UserRecord | Response {
  const user = requireUser(context);
  if (user instanceof Response) return user;
  const userId = user.id;
  if (!isAdmin(user)) {
    logSecurityEvent("authz.denied", { reason: "forbidden", user: userId }, context.request);
    return context.redirect("/admin?error=forbidden");
  }
  return user;
}

export function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, "-")
    .replace(/\-+/g, "-")
    .replace(/^\-+|\-+$/g, "");
}
