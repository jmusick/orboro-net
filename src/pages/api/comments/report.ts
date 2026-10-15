import type { APIRoute } from "astro";
import { CommentError, getCommentTarget, reportComment } from "../../../lib/comments";
import { parseRecordId } from "../../../lib/content-writes";
import { requireMember } from "../../../lib/http";
import { chargeBudgets, memberDb, readMemberFields } from "../../../lib/member-actions";
import { BODY_LIMITS } from "../../../lib/request-limits";

// Flags a comment for the admin moderation queue.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context);
  if (member instanceof Response) return member;

  const fields = await readMemberFields(context.request, BODY_LIMITS.small, ["commentId", "reason"]);
  const commentId = parseRecordId(fields?.commentId);
  const db = memberDb();
  const target = commentId ? await getCommentTarget(db, commentId) : null;
  if (!fields || !commentId || !target) return context.redirect("/");
  context.locals.auditTarget = commentId;
  const back = (code: string) => context.redirect(`${target.path}?comment_error=${code}#comment-${commentId}`);

  const limited = await chargeBudgets(db, [["report", member.id]], context.request, member.id);
  if (limited) return back(limited);
  try {
    await reportComment(db, { commentId, memberId: member.id, reason: fields.reason });
  } catch (error) {
    if (error instanceof CommentError) return back(error.code);
    throw error;
  }
  return context.redirect(`${target.path}?reported=1#comment-${commentId}`);
};
