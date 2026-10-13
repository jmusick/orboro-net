/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

type UserRole = "admin" | "editor" | "author";

interface UserRecord {
  id: string;
  email: string;
  role: UserRole;
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
    /** Per-request CSP nonce, set in middleware. See AGENTS.md#security-response-headers. */
    nonce: string;
    /** Record ID a mutation route touched, for its admin.action security event. */
    auditTarget?: string;
  }
}
