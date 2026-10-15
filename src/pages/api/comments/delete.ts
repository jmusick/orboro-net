import type { APIRoute } from "astro";
import { CommentError, deleteOwnComment, getCommentTarget } from "../../../lib/comments";
import { parseRecordId } from "../../../lib/content-writes";
import { requireMember } from "../../../lib/http";
import { chargeBudgets, memberDb, readMemberFields } from "../../../lib/member-actions";
import { BODY_LIMITS } from "../../../lib/request-limits";

// Deletes the member's own comment (a placeholder stays if it has replies).
// Allowed on locked pages too, so a member can always take back what they wrote.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context);
  if (member instanceof Response) return member;

  const fields = await readMemberFields(context.request, BODY_LIMITS.member, ["commentId"]);
  const commentId = parseRecordId(fields?.commentId);
  const db = memberDb();
  const target = commentId ? await getCommentTarget(db, commentId) : null;
  if (!commentId || !target) return context.redirect("/");
  context.locals.auditTarget = commentId;

  const limited = await chargeBudgets(db, [["commentChange", member.id]], context.request, member.id);
  if (limited) return context.redirect(`${target.path}?comment_error=${limited}#comment-${commentId}`);
  try {
    await deleteOwnComment(db, { commentId, memberId: member.id });
  } catch (error) {
    if (error instanceof CommentError) return context.redirect(`${target.path}?comment_error=${error.code}#comments`);
    throw error;
  }
  return context.redirect(`${target.path}#comments`);
};
