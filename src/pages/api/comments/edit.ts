import type { APIRoute } from "astro";
import { CommentError, editComment, getCommentTarget } from "../../../lib/comments";
import { parseRecordId } from "../../../lib/content-writes";
import { requireMember } from "../../../lib/http";
import { chargeBudgets, memberDb, readMemberFields } from "../../../lib/member-actions";
import { BODY_LIMITS } from "../../../lib/request-limits";

// Edits the member's own comment. Ownership is enforced in the SQL
// (`AND member_id = ?`), so another member's ID in the form changes nothing.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context);
  if (member instanceof Response) return member;

  const fields = await readMemberFields(context.request, BODY_LIMITS.comment, ["commentId", "body"]);
  const commentId = parseRecordId(fields?.commentId);
  const db = memberDb();
  const target = commentId ? await getCommentTarget(db, commentId) : null;
  if (!fields || !commentId || !target) return context.redirect("/");
  context.locals.auditTarget = commentId;
  const back = (code: string) => context.redirect(`${target.path}?comment_error=${code}#comment-${commentId}`);

  const limited = await chargeBudgets(db, [["commentChange", member.id]], context.request, member.id);
  if (limited) return back(limited);
  try {
    await editComment(db, { commentId, memberId: member.id, body: fields.body });
  } catch (error) {
    if (error instanceof CommentError) return back(error.code);
    throw error;
  }
  return context.redirect(`${target.path}#comment-${commentId}`);
};
