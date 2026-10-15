import type { APIRoute } from "astro";
import { memberDb, readMemberFields, signInMember } from "../../../lib/member-actions";
import { applyEmailChange, consumeMemberToken, markEmailVerified } from "../../../lib/members";
import { BODY_LIMITS } from "../../../lib/request-limits";

// Spends an emailed confirmation link: `verify` confirms the sign-up address,
// `email` applies a requested address change. The link opens a page with a
// button that posts here, so mail scanners that fetch links can't spend it.
// Confirming proves control of the address, so it also signs the member in.
export const POST: APIRoute = async (context) => {
  const { request, cookies, url, redirect } = context;
  const fields = await readMemberFields(request, BODY_LIMITS.member, ["token", "purpose"]);
  if (!fields) return redirect("/account/verify?error=invalid");
  const purpose = fields.purpose === "email" ? "email" : "verify";

  const db = memberDb();
  const spent = await consumeMemberToken(db, fields.token, purpose);
  if (!spent) return redirect("/account/verify?error=invalid");
  context.locals.auditTarget = spent.memberId;

  const ok = purpose === "email"
    ? await applyEmailChange(db, spent.memberId, spent.email)
    : await markEmailVerified(db, spent.memberId, spent.email);
  if (!ok) return redirect(`/account/verify?error=${purpose === "email" ? "email-taken" : "invalid"}`);

  if (context.locals.member?.id !== spent.memberId) await signInMember(db, cookies, url, spent.memberId);
  return redirect(`/account?verified=${purpose}`);
};
