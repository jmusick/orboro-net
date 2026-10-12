import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BODY_LIMITS, MULTIPART, URLENCODED, bodyRejection, formText, readBoundedBytes, readBoundedForm,
} from '../src/lib/request-limits.ts';
import { MAX_MEDIA_BYTES, MAX_UPLOAD_BODY_BYTES } from '../src/lib/media-upload.ts';

const URL_ = 'https://orboro.net/api/test';
const encoder = new TextEncoder();

// A body stream that records how many chunks were pulled and whether it was
// cancelled. Requests built from a stream carry no Content-Length.
function trackedStream(chunks: Uint8Array[]) {
  const state = { pulled: 0, cancelled: false };
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) return controller.close();
      state.pulled += 1;
      controller.enqueue(chunks[index++]);
    },
    cancel() {
      state.cancelled = true;
    },
  }, { highWaterMark: 0 }); // pull only on demand, so `pulled` counts real reads
  return { stream, state };
}

function streamRequest(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  const { stream, state } = trackedStream(chunks);
  const request = new Request(URL_, { method: 'POST', body: stream, headers, duplex: 'half' } as RequestInit);
  return { request, state };
}

function multipartBody(boundary: string, parts: { name: string; value: string | Uint8Array; filename?: string }[]): Uint8Array {
  const pieces: Uint8Array[] = [];
  for (const part of parts) {
    const disposition = `form-data; name="${part.name}"${part.filename ? `; filename="${part.filename}"` : ''}`;
    const type = part.filename ? '\r\nContent-Type: application/octet-stream' : '';
    pieces.push(encoder.encode(`--${boundary}\r\nContent-Disposition: ${disposition}${type}\r\n\r\n`));
    pieces.push(typeof part.value === 'string' ? encoder.encode(part.value) : part.value);
    pieces.push(encoder.encode('\r\n'));
  }
  pieces.push(encoder.encode(`--${boundary}--\r\n`));
  const total = pieces.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of pieces) { out.set(p, offset); offset += p.byteLength; }
  return out;
}

const split = (bytes: Uint8Array, size: number) => {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.byteLength; i += size) chunks.push(bytes.subarray(i, i + size));
  return chunks;
};

test('a streamed body within budget is read in full without Content-Length', async () => {
  const { request } = streamRequest([encoder.encode('a=1&'), encoder.encode('b=2')]);
  assert.equal(request.headers.get('content-length'), null);
  const result = await readBoundedBytes(request, 64);
  assert.ok(result.ok);
  assert.equal(new TextDecoder().decode(result.bytes), 'a=1&b=2');
});

test('a streamed body over budget is cut off and cancelled without Content-Length', async () => {
  const chunks = Array.from({ length: 100 }, () => new Uint8Array(1024));
  const { request, state } = streamRequest(chunks);
  const result = await readBoundedBytes(request, 4096);
  assert.deepEqual(result, { ok: false, status: 413, reason: 'too-large' });
  assert.ok(state.pulled <= 6, `read ${state.pulled} chunks; it should stop just past the budget`);
  assert.ok(state.cancelled);
});

test('a declared Content-Length over budget is refused before the body is read', async () => {
  const { request, state } = streamRequest([new Uint8Array(10)], { 'content-length': '999999' });
  const result = await readBoundedBytes(request, 4096);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.status, 413);
  assert.equal(state.pulled, 0);
});

test('an understated Content-Length does not let extra bytes through', async () => {
  const { request } = streamRequest(split(new Uint8Array(10_000), 1000), { 'content-length': '10' });
  const result = await readBoundedBytes(request, 4096);
  assert.equal(!result.ok && result.status, 413);
});

test('a non-numeric Content-Length is malformed', async () => {
  const { request } = streamRequest([encoder.encode('a=1')], { 'content-length': '12abc' });
  assert.deepEqual(await readBoundedBytes(request, 4096), { ok: false, status: 400, reason: 'malformed' });
});

test('URL-encoded forms parse from the bounded bytes', async () => {
  const request = new Request(URL_, { method: 'POST', body: 'id=abc&title=Hello+world', headers: { 'content-type': URLENCODED } });
  const result = await readBoundedForm(request, { maxBytes: BODY_LIMITS.small });
  assert.ok(result.ok);
  assert.equal(formText(result.form, 'id'), 'abc');
  assert.equal(formText(result.form, 'title'), 'Hello world');
  assert.equal(formText(result.form, 'missing'), '');
});

test('an oversized URL-encoded form is refused before parsing', async () => {
  const big = 'markdown=' + 'x'.repeat(BODY_LIMITS.small);
  const { request } = streamRequest(split(encoder.encode(big), 512), { 'content-type': URLENCODED });
  const result = await readBoundedForm(request, { maxBytes: BODY_LIMITS.small });
  assert.equal(!result.ok && result.status, 413);
});

test('wrong or missing content types are refused with 415', async () => {
  for (const type of ['application/json', 'text/plain', MULTIPART + '; boundary=x', '']) {
    const headers: Record<string, string> = type ? { 'content-type': type } : {};
    const request = new Request(URL_, { method: 'POST', body: 'id=1', headers });
    if (!type) request.headers.delete('content-type');
    const result = await readBoundedForm(request, { maxBytes: 1024 });
    assert.deepEqual(result, { ok: false, status: 415, reason: 'unsupported-type' }, `type ${JSON.stringify(type)}`);
  }
  const json = new Request(URL_, { method: 'POST', body: 'id=1', headers: { 'content-type': URLENCODED } });
  assert.equal((await readBoundedForm(json, { maxBytes: 1024, types: [MULTIPART] })).ok, false);
});

test('too many fields are refused', async () => {
  const body = Array.from({ length: 20 }, (_, i) => `f${i}=1`).join('&');
  const request = new Request(URL_, { method: 'POST', body, headers: { 'content-type': URLENCODED } });
  const result = await readBoundedForm(request, { maxBytes: 4096, maxFields: 10 });
  assert.equal(!result.ok && result.status, 413);
});

test('multipart without Content-Length parses a file within the upload budget', async () => {
  const boundary = 'testboundary123';
  const file = new Uint8Array(200_000).fill(7);
  const body = multipartBody(boundary, [
    { name: 'altText', value: 'An image' },
    { name: 'file', value: file, filename: 'a.png' },
  ]);
  const { request } = streamRequest(split(body, 16_384), { 'content-type': `${MULTIPART}; boundary=${boundary}` });
  assert.equal(request.headers.get('content-length'), null);
  const result = await readBoundedForm(request, { maxBytes: MAX_UPLOAD_BODY_BYTES, types: [MULTIPART] });
  assert.ok(result.ok);
  const parsed = result.form.get('file');
  assert.ok(parsed instanceof File);
  assert.equal(parsed.size, file.byteLength);
  assert.equal(formText(result.form, 'altText'), 'An image');
  // A file part never passes as text.
  assert.equal(formText(result.form, 'file'), null);
});

test('multipart without Content-Length over the upload budget is refused mid-stream', async () => {
  const boundary = 'b';
  const body = multipartBody(boundary, [{ name: 'file', value: new Uint8Array(MAX_MEDIA_BYTES + 100_000), filename: 'big.png' }]);
  const { request, state } = streamRequest(split(body, 64 * 1024), { 'content-type': `${MULTIPART}; boundary=${boundary}` });
  const result = await readBoundedForm(request, { maxBytes: MAX_UPLOAD_BODY_BYTES, types: [MULTIPART] });
  assert.equal(!result.ok && result.status, 413);
  assert.ok(state.cancelled);
});

test('oversized multipart metadata is refused even when the file is small', async () => {
  const boundary = 'meta';
  const body = multipartBody(boundary, [
    { name: 'altText', value: 'a'.repeat(5000) },
    { name: 'file', value: new Uint8Array(10), filename: 'a.png' },
  ]);
  const { request } = streamRequest([body], { 'content-type': `${MULTIPART}; boundary=${boundary}` });
  const result = await readBoundedForm(request, { maxBytes: 4096, types: [MULTIPART] });
  assert.equal(!result.ok && result.status, 413);
});

test('a malformed multipart body is a 400, not a throw', async () => {
  const request = new Request(URL_, { method: 'POST', body: 'not multipart', headers: { 'content-type': `${MULTIPART}; boundary=zzz` } });
  const result = await readBoundedForm(request, { maxBytes: 4096, types: [MULTIPART] });
  assert.deepEqual(result, { ok: false, status: 400, reason: 'malformed' });
});

test('repeated single-value fields are rejected as text', async () => {
  const request = new Request(URL_, { method: 'POST', body: 'id=a&id=b', headers: { 'content-type': URLENCODED } });
  const result = await readBoundedForm(request, { maxBytes: 1024 });
  assert.ok(result.ok);
  assert.equal(formText(result.form, 'id'), null);
});

test('rejections are uncacheable plain text with the failure status', async () => {
  const response = bodyRejection({ ok: false, status: 413, reason: 'too-large' });
  assert.equal(response.status, 413);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(await response.text(), /too large/i);
});

// The login page renders in BaseLayout, whose ClientRouter resubmits forms with
// fetch as multipart/form-data. Rejecting multipart there locked browsers out of
// sign-in while curl (URL-encoded) still worked.
test('login accepts the multipart body ClientRouter submits', async () => {
  const fd = new FormData();
  fd.set('email', 'admin@example.test');
  fd.set('password', 'correct horse battery');
  const request = new Request(URL_, { method: 'POST', body: fd });
  const parsed = await readBoundedForm(request, { maxBytes: 4096, types: [URLENCODED, MULTIPART], maxFields: 8 });
  assert.ok(parsed.ok);
  assert.equal(formText(parsed.form, 'email'), 'admin@example.test');
  assert.equal(formText(parsed.form, 'password'), 'correct horse battery');

  const { readFile } = await import('node:fs/promises');
  const login = await readFile(new URL('../src/pages/api/auth/login.ts', import.meta.url), 'utf8');
  assert.match(login, /types:\s*\[URLENCODED,\s*MULTIPART\]/);
});
