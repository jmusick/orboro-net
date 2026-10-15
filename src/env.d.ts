/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

type UserRole = "admin" | "editor" | "author";

interface UserRecord {
  id: string;
  email: string;
  role: UserRole;
}

/** A signed-in public member (see src/lib/members.ts). Never an admin. */
interface MemberRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
}

interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: number;
}

declare namespace App {
  interface Locals {
    user: UserRecord | null;
    session: SessionRecord | null;
    /** The public member session, resolved separately from the admin one. */
    member: MemberRecord | null;
    /** Per-request CSP nonce, set in middleware. See AGENTS.md#security-response-headers. */
    nonce: string;
    /** Record ID a mutation route touched, for its admin.action security event. */
    auditTarget?: string;
  }
}
