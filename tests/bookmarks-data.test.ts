import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_BOOKMARKS, MAX_REDIRECTS, MAX_TAGS_PER_BOOKMARK,
  fetchBounded, normalizeBookmarks, readLimitedText,
} from '../src/lib/bookmarks-data.ts';

const good = { id: 1, title: 'Site', url: 'https://example.com/a', description: 'd', favicon_url: 'https://example.com/f.png', tags: [{ id: 1, name: 'wow' }] };

test('valid bookmarks are normalized', () => {
  assert.deepEqual(normalizeBookmarks({ bookmarks: [good] }), [
    { title: 'Site', url: 'https://example.com/a', description: 'd', faviconUrl: 'https://example.com/f.png', tags: ['wow'] },
  ]);
});

test('non-object, missing or non-array payloads throw', () => {
  for (const bad of [null, 'x', 5, [], {}, { bookmarks: 'no' }, { bookmarks: { a: 1 } }]) {
    assert.throws(() => normalizeBookmarks(bad));
  }
});

test('malformed items are dropped without throwing', () => {
  const out = normalizeBookmarks({ bookmarks: [null, 5, 'x', {}, { ...good, title: null }, { ...good, title: '  ' }, { ...good, url: null }, { ...good, tags: 'x' }, { ...good, tags: [null, { name: 4 }, { name: 'ok' }] }] });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].tags, []);
  assert.deepEqual(out[1].tags, ['ok']);
});

test('unsafe link and favicon schemes are rejected', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.test/', '//x.test', 'not a url', 'vbscript:x']) {
    assert.equal(normalizeBookmarks({ bookmarks: [{ ...good, url }] }).length, 0, url);
  }
  const out = normalizeBookmarks({ bookmarks: [{ ...good, favicon_url: 'http://example.com/f.png' }, { ...good, favicon_url: 'javascript:1' }] });
  assert.deepEqual(out.map((b) => b.faviconUrl), [null, null]);
});

test('array, tag and string sizes are bounded', () => {
  const many = Array.from({ length: MAX_BOOKMARKS + 50 }, (_, i) => ({ ...good, title: `t${i}` }));
  assert.equal(normalizeBookmarks({ bookmarks: many }).length, MAX_BOOKMARKS);
  const tags = Array.from({ length: 100 }, (_, i) => ({ name: `tag${i}` }));
  assert.equal(normalizeBookmarks({ bookmarks: [{ ...good, tags }] })[0].tags.length, MAX_TAGS_PER_BOOKMARK);
  assert.equal(normalizeBookmarks({ bookmarks: [{ ...good, title: 'x'.repeat(5000) }] })[0].title.length, 300);
});

test('oversized bodies are refused by header and by streamed bytes', async () => {
  await assert.rejects(readLimitedText(new Response('x', { headers: { 'Content-Length': '999999' } }), 100));
  await assert.rejects(readLimitedText(new Response('x'.repeat(500)), 100));
  assert.equal(await readLimitedText(new Response('hello'), 100), 'hello');
});

test('redirects are bounded and stay on the same HTTPS host', async () => {
  const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to } });
  const ok = async () => new Response('{}');
  let calls = 0;
  const follow = async () => (calls++ === 0 ? redirect('https://tagsta.sh/other') : new Response('{}'));
  assert.equal((await fetchBounded('https://tagsta.sh/a', follow as any)).status, 200);
  await assert.rejects(fetchBounded('https://tagsta.sh/a', (async () => redirect('https://evil.test/')) as any));
  await assert.rejects(fetchBounded('https://tagsta.sh/a', (async () => redirect('http://tagsta.sh/')) as any));
  await assert.rejects(fetchBounded('https://tagsta.sh/a', (async () => redirect('/loop')) as any), /redirects/);
  assert.equal((await fetchBounded('https://tagsta.sh/a', ok as any)).status, 200);
  assert.ok(MAX_REDIRECTS > 0);
});

test('a hung upstream is aborted by the timeout', async () => {
  const hang = (_url: string, init: RequestInit) =>
    new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))));
  // AbortSignal.timeout() timers are unref'd. Older Node 22 releases let the test process exit
  // before the abort fires and cancel this test, so hold the event loop open until it settles.
  const keepAlive = setTimeout(() => {}, 5_000);
  try {
    await assert.rejects(fetchBounded('https://tagsta.sh/a', hang as any, 20), /aborted/);
  } finally {
    clearTimeout(keepAlive);
  }
});
