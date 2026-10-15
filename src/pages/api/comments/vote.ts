import type { APIRoute } from "astro";
import { CommentError, getCommentTarget, voteOnComment } from "../../../lib/comments";
import { parseRecordId } from "../../../lib/content-writes";
import { requireMember } from "../../../lib/http";
import { chargeBudgets, memberDb, readMemberFields } from "../../../lib/member-actions";
import { BODY_LIMITS } from "../../../lib/request-limits";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Up/down votes. The vote buttons are plain forms, so voting works without
// JavaScript (redirecting back to the comment); the comment script posts the
// same form with `Accept: application/json` and updates the count in place.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context);
  if (member instanceof Response) return member;
  const wantsJson = (context.request.headers.get("accept") ?? "").includes("application/json");

  const fields = await readMemberFields(context.request, BODY_LIMITS.small, ["commentId", "direction"]);
  const commentId = parseRecordId(fields?.commentId);
  const direction = fields?.direction === "up" ? 1 : fields?.direction === "down" ? -1 : null;
  const db = memberDb();
  const target = commentId ? await getCommentTarget(db, commentId) : null;
  if (!commentId || !direction || !target) return wantsJson ? json({ error: "invalid" }, 400) : context.redirect("/");
  context.locals.auditTarget = commentId;
  const fail = (code: string, status: number) =>
    wantsJson ? json({ error: code }, status) : context.redirect(`${target.path}?comment_error=${code}#comment-${commentId}`);

  const limited = await chargeBudgets(db, [["vote", member.id]], context.request, member.id);
  if (limited) return fail(limited, limited === "rate-limited" ? 429 : 503);
  try {
    const result = await voteOnComment(db, { commentId, memberId: member.id, direction });
    return wantsJson ? json(result) : context.redirect(`${target.path}#comment-${commentId}`);
  } catch (error) {
    if (error instanceof CommentError) return fail(error.code, 409);
    throw error;
  }
};
