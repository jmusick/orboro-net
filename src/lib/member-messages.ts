// Visitor-facing text for the `?error=` / `?comment_error=` codes the member
// and comment routes redirect with. Unknown codes fall back to a generic line,
// so a hand-edited URL can never put its own text on the page.

import { MAX_COMMENT_DEPTH, MAX_COMMENT_LENGTH } from "./comments";
import { MAX_BIO_LENGTH, MAX_DISPLAY_NAME_LENGTH, MAX_USERNAME_LENGTH, MIN_USERNAME_LENGTH } from "./members";
import { MAX_PASSWORD_CODE_POINTS, MIN_PASSWORD_CODE_POINTS } from "./passwords.js";

export const PASSWORD_HINT = `${MIN_PASSWORD_CODE_POINTS}–${MAX_PASSWORD_CODE_POINTS} characters. A few unrelated words make a good one. It can't contain the site name, your username or the name part of your email, and it can't be a password known from data breaches.`;
export const USERNAME_HINT = `${MIN_USERNAME_LENGTH}–${MAX_USERNAME_LENGTH} letters, numbers, hyphens or underscores. Shown on your comments and profile; it can't be changed later.`;

const MESSAGES: Record<string, string> = {
  invalid: "That request couldn't be processed. Check the form and try again.",
  "rate-limited": "Too many attempts in a short time. Wait a few minutes and try again.",
  unavailable: "This is temporarily unavailable. Try again shortly.",
  challenge: "The security check didn't pass. Complete it again and resubmit.",
  username: `Choose a username of ${MIN_USERNAME_LENGTH}–${MAX_USERNAME_LENGTH} letters, numbers, hyphens or underscores.`,
  "username-reserved": "That username is reserved. Choose another.",
  "username-taken": "That username is taken. Choose another.",
  email: "Enter a valid email address.",
  password: `That password doesn't meet the rules: ${PASSWORD_HINT}`,
  breached: "That password appears in known data breaches. Choose a different one.",
  "current-password": "Your current password was incorrect.",
  "display-name": `Display names are a single line of at most ${MAX_DISPLAY_NAME_LENGTH} characters.`,
  bio: `Bios are plain text of at most ${MAX_BIO_LENGTH} characters.`,
  unverified: "Confirm your email address before commenting or voting.",
  "email-failed": "The email couldn't be sent. Try again later.",
  suspended: "This account is suspended.",
  expired: "That link has expired or was already used. Request a new one.",
  "email-taken": "That email address now belongs to another account.",
  body: `Comments must have text and be at most ${MAX_COMMENT_LENGTH.toLocaleString("en-US")} characters.`,
  closed: "Comments on this page are closed.",
  parent: "The comment you replied to is no longer available.",
  depth: `Replies nest at most ${MAX_COMMENT_DEPTH} levels deep. Reply to an earlier comment in the thread instead.`,
  "not-found": "That comment is no longer available.",
  "own-comment": "You can't report your own comment.",
};

export function memberMessage(code: string | null): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? MESSAGES.invalid;
}
