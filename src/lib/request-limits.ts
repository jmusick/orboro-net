// Bounded request-body reading for mutation routes. The body is read as a
// stream and abandoned as soon as it passes the route's byte budget, whatever
// Content-Length says (or whether it is sent at all), and only then parsed from
// the buffered bytes. Uses only Request/Response/ReadableStream, so it runs the
// same in workerd and in node --test.

export const URLENCODED = "application/x-www-form-urlencoded";
export const MULTIPART = "multipart/form-data";

/** Per-route byte budgets. */
export const BODY_LIMITS = {
  /** Single-ID forms: deletes. */
  small: 4 * 1024,
  /** Member account forms: sign-in, registration, profile, password. */
  member: 8 * 1024,
  /** A comment or edit (10,000 characters, URL-encoded or multipart). */
  comment: 128 * 1024,
  /** Category and media-URL forms. */
  record: 16 * 1024,
  /** Navigation tree JSON (up to 500 items, URL-encoded). */
  nav: 1024 * 1024,
  /** Content editor: Markdown plus metadata, URL-encoded. */
  content: 2 * 1024 * 1024,
} as const;

/** Default cap on the number of fields a form may carry. */
export const MAX_FORM_FIELDS = 256;

export type BodyFailureReason = "too-large" | "unsupported-type" | "malformed";

export interface BodyFailure {
  ok: false;
  status: 400 | 413 | 415;
  reason: BodyFailureReason;
}

const fail = (status: BodyFailure["status"], reason: BodyFailureReason): BodyFailure => ({ ok: false, status, reason });

export function mediaType(request: Request): string {
  return (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
}

/**
 * Reads at most `maxBytes` of the request body. A declared Content-Length over
 * the budget is refused without reading; otherwise the stream is counted chunk
 * by chunk and cancelled the moment it passes the budget.
 */
export async function readBoundedBytes(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array<ArrayBuffer> } | BodyFailure> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared.trim())) return fail(400, "malformed");
    if (Number(declared) > maxBytes) return fail(413, "too-large");
  }
  if (request.bodyUsed) return fail(400, "malformed");
  if (!request.body) return { ok: true, bytes: new Uint8Array(0) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return fail(413, "too-large");
      }
      chunks.push(chunk);
    }
  } catch {
    return fail(400, "malformed");
  } finally {
    reader.releaseLock?.();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

export interface BoundedFormOptions {
  maxBytes: number;
  /** Accepted media types; defaults to URL-encoded forms only. */
  types?: readonly string[];
  maxFields?: number;
}

/**
 * Checks the content type, reads the body within its budget, then parses the
 * buffered bytes as a form. Nothing is parsed until the whole body is known to
 * fit.
 */
export async function readBoundedForm(
  request: Request,
  { maxBytes, types = [URLENCODED], maxFields = MAX_FORM_FIELDS }: BoundedFormOptions,
): Promise<{ ok: true; form: FormData } | BodyFailure> {
  const type = mediaType(request);
  if (!types.includes(type)) return fail(415, "unsupported-type");

  const body = await readBoundedBytes(request, maxBytes);
  if (!body.ok) return body;

  let form: FormData;
  try {
    const contentType = request.headers.get("content-type") ?? type;
    form = await new Response(body.bytes, { headers: { "content-type": contentType } }).formData();
  } catch {
    return fail(400, "malformed");
  }
  let fields = 0;
  for (const _ of form.keys()) {
    fields += 1;
    if (fields > maxFields) return fail(413, "too-large");
  }
  return { ok: true, form };
}

/** Plain-text refusal for clients that bypassed the browser form. */
export function bodyRejection(failure: BodyFailure): Response {
  const message = {
    "too-large": "Request too large.",
    "unsupported-type": "Unsupported content type.",
    malformed: "Malformed request body.",
  }[failure.reason];
  return new Response(message, {
    status: failure.status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * A text field's value: "" when absent, null when the field is a file (or is
 * repeated where one value is expected), so a file part can never pass as text.
 */
export function formText(form: FormData, name: string): string | null {
  const values = form.getAll(name);
  if (values.length === 0) return "";
  if (values.length > 1 || typeof values[0] !== "string") return null;
  return values[0];
}
