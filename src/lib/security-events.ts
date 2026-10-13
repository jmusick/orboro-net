/**
 * Allowlisted security events (issue #13). Each event is one structured log
 * line that Workers Logs indexes by field, so failed sign-ins, denials and
 * admin changes can be queried and alerted on.
 *
 * Only the fields named in FIELD_RULES are emitted, and only when the value
 * matches its rule; anything else is dropped and counted in `dropped`. Never
 * pass emails, passwords, cookies or session tokens, request bodies, query
 * strings or IP addresses: none of them has a rule, so they cannot reach the
 * log even by mistake. Run `npm run test:security-events` after changing this.
 */

export const SECURITY_EVENTS = [
  "auth.login.succeeded",
  "auth.login.failed",
  "auth.login.throttled",
  "auth.login.unavailable",
  "auth.session.rejected",
  "auth.session.lookup-failed",
  "authz.denied",
  "admin.action",
] as const;

export type SecurityEventName = (typeof SECURITY_EVENTS)[number];

export interface SecurityEventFields {
  /** Internal user ID (never an email). */
  user?: string;
  /** Admin action derived from the API path, e.g. `content.save`. */
  action?: string;
  /** Record ID the action touched. */
  target?: string;
  outcome?: "ok" | "rejected" | "error";
  /** Short machine code: `credentials`, `forbidden`, `slug`, `too-large`… */
  reason?: string;
  /** Whether a failed sign-in named an existing account. */
  account?: "known" | "unknown";
  status?: number;
  retry_after_s?: number;
}

type Rule = (value: unknown) => boolean;

const pattern = (re: RegExp, max: number): Rule => (v) => typeof v === "string" && v.length <= max && re.test(v);
const oneOf = (...values: string[]): Rule => (v) => typeof v === "string" && values.includes(v);
const integer = (min: number, max: number): Rule => (v) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;

const RECORD_ID = pattern(/^[A-Za-z0-9_-]+$/, 64);
const CODE = pattern(/^[a-z][a-z0-9-]*$/, 32);

const FIELD_RULES: Record<keyof SecurityEventFields, Rule> = {
  user: RECORD_ID,
  action: pattern(/^[a-z][a-z-]*(\.[a-z][a-z-]*){1,2}$/, 48),
  target: RECORD_ID,
  outcome: oneOf("ok", "rejected", "error"),
  reason: CODE,
  account: oneOf("known", "unknown"),
  status: integer(100, 599),
  retry_after_s: integer(0, 86_400),
};

const WARN_EVENTS = new Set<SecurityEventName>([
  "auth.login.failed",
  "auth.login.throttled",
  "auth.login.unavailable",
  "auth.session.rejected",
  "auth.session.lookup-failed",
  "authz.denied",
]);

export type SecurityLogRecord = Record<string, string | number>;
export type SecurityEventSink = (level: "info" | "warn", record: SecurityLogRecord) => void;

// An object (not a string) so Workers Logs indexes each field.
const consoleSink: SecurityEventSink = (level, record) => {
  if (level === "warn") console.warn(record);
  else console.log(record);
};

/** Request context taken from Cloudflare-set values only; nothing a client writes in a body or query string. */
function requestContext(request: Request | undefined): SecurityLogRecord {
  if (!request) return {};
  const out: SecurityLogRecord = {};
  out.method = /^[A-Z]{3,7}$/.test(request.method) ? request.method : "OTHER";
  let path = "";
  try {
    path = new URL(request.url).pathname;
  } catch {
    // Left as "other" below.
  }
  out.path = path.length <= 120 && /^\/[A-Za-z0-9/_.-]*$/.test(path) ? path : "other";
  const ray = request.headers.get("cf-ray");
  if (ray && /^[0-9a-f]{16}(-[A-Z]{3})?$/.test(ray)) out.ray = ray;
  const cf = (request as Request & { cf?: { country?: unknown; asn?: unknown } }).cf;
  if (typeof cf?.country === "string" && /^[A-Z][A-Z0-9]$/.test(cf.country)) out.country = cf.country;
  if (integer(0, 4_294_967_295)(cf?.asn)) out.asn = cf!.asn as number;
  return out;
}

/** Builds the allowlisted record. Exported for tests. */
export function buildSecurityRecord(
  name: SecurityEventName,
  fields: SecurityEventFields,
  request?: Request,
): SecurityLogRecord {
  const record: SecurityLogRecord = {
    security_event: (SECURITY_EVENTS as readonly string[]).includes(name) ? name : "invalid",
    ...requestContext(request),
  };
  let dropped = 0;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const rule = FIELD_RULES[key as keyof SecurityEventFields];
    if (rule?.(value)) record[key] = value as string | number;
    else dropped += 1;
  }
  if (dropped) record.dropped = dropped;
  return record;
}

/** Emits one security event. Logging never throws into the request. */
export function logSecurityEvent(
  name: SecurityEventName,
  fields: SecurityEventFields = {},
  request?: Request,
  sink: SecurityEventSink = consoleSink,
): void {
  try {
    sink(WARN_EVENTS.has(name) ? "warn" : "info", buildSecurityRecord(name, fields, request));
  } catch {
    // Observability must not break sign-in or saves.
  }
}

/**
 * The `admin.action` event for a finished POST under /api/, derived from the
 * response so every mutation route is covered without per-route code. Login
 * logs its own events, and requests the access guards refused are already
 * logged as `authz.denied`, so both return null here.
 */
export function adminActionEvent(
  method: string,
  pathname: string,
  user: UserRecord | null,
  response: Response | null,
  target?: string,
): SecurityEventFields | null {
  if (method !== "POST" || !pathname.startsWith("/api/") || pathname.startsWith("/api/auth/login")) return null;
  if (!user) return null;
  const selfService = pathname === "/api/auth/logout" || pathname === "/api/auth/revoke-all";
  if (user.role !== "admin" && !selfService) return null;

  const action = pathname.slice("/api/".length).replace(/\/+$/, "").split("/").join(".");
  if (!response) return { action, user: user.id, target, outcome: "error", status: 500 };

  const status = response.status;
  let outcome: SecurityEventFields["outcome"] = status >= 500 ? "error" : status >= 400 ? "rejected" : "ok";
  let reason: string | undefined;
  const location = response.headers.get("Location");
  if (status >= 300 && status < 400 && location) {
    const error = new URL(location, "https://redirect.invalid").searchParams.get("error");
    if (error) {
      outcome = "rejected";
      reason = error;
    }
  }
  return { action, user: user.id, target, outcome, reason, status };
}
