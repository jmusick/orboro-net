// Transactional email for member accounts, sent through Cloudflare Email
// Service (the `EMAIL` send_email binding in wrangler.toml). Every message is
// plain text plus a minimal HTML twin, carries only a link and a short
// explanation, and is sent from the one sender the binding allows.

export const MEMBER_EMAIL_FROM = { name: "Orboro.net", email: "no-reply@orboro.net" } as const;

export type MemberEmailKind = "verify" | "email-change" | "reset" | "already-registered";

export interface MemberEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function compose(subject: string, intro: string, action: { label: string; url: string } | null, outro: string): MemberEmail {
  const text = [intro, action ? `${action.label}:\n${action.url}` : "", outro, "— Orboro.net"].filter(Boolean).join("\n\n");
  const button = action
    ? `<p><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 20px;background:#70d0ff;color:#06101c;font-weight:700;text-decoration:none">${escapeHtml(action.label)}</a></p>
<p style="color:#555;font-size:13px">Or paste this link into your browser:<br>${escapeHtml(action.url)}</p>`
    : "";
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
<p>${escapeHtml(intro)}</p>
${button}
<p>${escapeHtml(outro)}</p>
<p>— Orboro.net</p>
</body></html>`;
  return { subject, text, html };
}

/** Builds a message. `link` is an absolute URL on this site carrying a single-use token. */
export function buildMemberEmail(kind: MemberEmailKind, { username, link }: { username: string; link?: string }): MemberEmail {
  switch (kind) {
    case "verify":
      return compose(
        "Confirm your Orboro.net email",
        `Hi ${username}, confirm this address to finish setting up your Orboro.net account. Until you do, you can sign in but can't comment or vote.`,
        { label: "Confirm email", url: link! },
        "The link works once and expires in 48 hours. If you didn't create this account, ignore this email.",
      );
    case "email-change":
      return compose(
        "Confirm your new Orboro.net email",
        `Hi ${username}, confirm this address to make it the email for your Orboro.net account.`,
        { label: "Confirm new email", url: link! },
        "The link works once and expires in 24 hours. If you didn't ask for this change, ignore this email; your account keeps its current address.",
      );
    case "reset":
      return compose(
        "Reset your Orboro.net password",
        `Hi ${username}, someone asked to reset the password for your Orboro.net account.`,
        { label: "Choose a new password", url: link! },
        "The link works once and expires in 1 hour. Resetting signs you out everywhere. If you didn't ask, ignore this email; your password is unchanged.",
      );
    case "already-registered":
      return compose(
        "Someone tried to register with your email",
        `Hi ${username}, someone tried to create a new Orboro.net account with this email address, which already belongs to your account. No new account was created.`,
        link ? { label: "Reset your password", url: link } : null,
        "If that was you, sign in with your existing account instead. Otherwise you can ignore this email.",
      );
  }
}

/** Sends one message. Returns false (never throws) so callers can answer the visitor the same way either way. */
export async function sendMemberEmail(binding: SendEmail | undefined, to: string, message: MemberEmail): Promise<boolean> {
  if (!binding) return false;
  try {
    await binding.send({ from: MEMBER_EMAIL_FROM, to, subject: message.subject, text: message.text, html: message.html });
    return true;
  } catch {
    return false;
  }
}
