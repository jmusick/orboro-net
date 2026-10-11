// Runtime validation and bounds for the third-party bookmark API response.
// Pure and dependency-free so it can be tested without the Workers runtime.

export const MAX_RESPONSE_BYTES = 512 * 1024;
export const MAX_BOOKMARKS = 500;
export const MAX_TAGS_PER_BOOKMARK = 20;
export const MAX_TITLE_LENGTH = 300;
export const MAX_DESCRIPTION_LENGTH = 600;
export const MAX_TAG_LENGTH = 60;
export const MAX_URL_LENGTH = 2048;
export const FETCH_TIMEOUT_MS = 5000;
export const MAX_REDIRECTS = 3;

export interface Bookmark {
  title: string;
  url: string;
  description: string | null;
  faviconUrl: string | null;
  tags: string[];
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

// Returns the normalized absolute URL when it uses an allowed scheme.
function safeUrl(value: unknown, protocols: string[]): string | null {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(value.trim());
    return protocols.includes(url.protocol) && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

// Throws when the payload is not the expected shape; drops individual bad items.
export function normalizeBookmarks(data: unknown): Bookmark[] {
  const list = (data as { bookmarks?: unknown } | null)?.bookmarks;
  if (!Array.isArray(list)) throw new Error("Bookmark response has no bookmarks array.");

  const result: Bookmark[] = [];
  for (const entry of list.slice(0, MAX_BOOKMARKS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const raw = entry as Record<string, unknown>;
    const url = safeUrl(raw.url, ["https:", "http:"]);
    const title = text(raw.title, MAX_TITLE_LENGTH);
    if (!url || !title) continue;

    const tags: string[] = [];
    if (Array.isArray(raw.tags)) {
      for (const tag of raw.tags.slice(0, MAX_TAGS_PER_BOOKMARK)) {
        const name = text((tag as { name?: unknown } | null)?.name, MAX_TAG_LENGTH);
        if (name && !tags.includes(name)) tags.push(name);
      }
    }
    result.push({
      title,
      url,
      description: text(raw.description, MAX_DESCRIPTION_LENGTH),
      faviconUrl: safeUrl(raw.favicon_url, ["https:"]),
      tags,
    });
  }
  return result;
}

// Reads a response body, refusing anything larger than maxBytes.
export async function readLimitedText(res: Response, maxBytes = MAX_RESPONSE_BYTES): Promise<string> {
  const declared = Number(res.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Bookmark response too large.");
  if (!res.body) return "";

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Bookmark response too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

// Follows a bounded number of redirects, and only to HTTPS on the same host.
export async function fetchBounded(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const origin = new URL(url);
  let current = url;
  for (let hops = 0; hops <= MAX_REDIRECTS; hops += 1) {
    const res = await fetchImpl(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get("Location");
    if (!location) throw new Error("Redirect without a location.");
    const next = new URL(location, current);
    if (next.protocol !== "https:" || next.hostname !== origin.hostname) {
      throw new Error("Redirect left the allowed host.");
    }
    current = next.href;
  }
  throw new Error("Too many redirects.");
}
