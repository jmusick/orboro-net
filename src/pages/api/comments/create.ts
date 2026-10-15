import type { APIRoute } from "astro";
import { CommentError, createComment, getCommentableContent } from "../../../lib/comments";
import { parseRecordId } from "../../../lib/content-writes";
import { requireMember } from "../../../lib/http";
import { chargeBudgets, clientIp, memberDb, readMemberFields } from "../../../lib/member-actions";
import { BODY_LIMITS } from "../../../lib/request-limits";

// Posts a top-level comment or a reply. The author is the session's member;
// createComment checks the page is published and open and the parent belongs
// to the same page.
export const POST: APIRoute = async (context) => {
  const member = requireMember(context);
  if (member instanceof Response) return member;

  const fields = await readMemberFields(context.request, BODY_LIMITS.comment, ["contentId", "parentId", "body"]);
  const contentId = parseRecordId(fields?.contentId);
  const db = memberDb();
  const content = contentId ? await getCommentableContent(db, contentId) : null;
  if (!fields || !content || content.status !== "published") return context.redirect("/");
  const parentId = fields.parentId ? parseRecordId(fields.parentId) : null;
  const anchor = parentId ? `#comment-${parentId}` : "#comments";
  const back = (code: string) => context.redirect(`${content.path}?comment_error=${code}${anchor}`);
  if (fields.parentId && !parentId) return back("parent");

  const limited = await chargeBudgets(db, [["commentMember", member.id], ["commentIp", clientIp(context.request)]], context.request, member.id);
  if (limited) return back(limited);

  try {
    const id = await createComment(db, { contentId: content.id, memberId: member.id, parentId, body: fields.body });
    context.locals.auditTarget = id;
    return context.redirect(`${content.path}#comment-${id}`);
  } catch (error) {
    if (error instanceof CommentError) return back(error.code);
    throw error;
  }
};
