// Deliberate cache policy for private responses. The Worker renders every page
// and API route, so the policy is applied in middleware rather than relying on
// edge rules, which this repo cannot see.

// Public JSON that is intentionally edge-cached by its own handler.
const PUBLIC_API_PREFIXES = ["/api/posts/"];

export function isPrivatePath(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  // Member sign-in, registration, email links and account settings.
  if (pathname === "/account" || pathname.startsWith("/account/")) return true;
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return !PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  }
  return false;
}

// Returns the Cache-Control value to force, or null to leave the response's own
// policy alone. Admin/auth/mutation responses (including redirects and errors)
// are always no-store; HTML served to a signed-in visitor may differ per user,
// so it is no-store too unless the handler already chose a private policy.
export function privateCacheControl(
  pathname: string,
  hasSession: boolean,
  contentType: string | null,
  existing: string | null,
): string | null {
  if (isPrivatePath(pathname)) return "no-store";
  if (hasSession && (contentType ?? "").toLowerCase().startsWith("text/html")) {
    if (existing && /\bno-store\b|\bprivate\b/i.test(existing)) return null;
    return "private, no-store";
  }
  return null;
}
