import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPrivatePath, privateCacheControl } from '../src/lib/cache-policy.ts';

test('admin, auth and mutation routes are private; public API and pages are not', () => {
  for (const p of ['/admin', '/admin/content/1', '/api/auth/login', '/api/auth/logout', '/api/content/save', '/api/media/upload']) {
    assert.equal(isPrivatePath(p), true, p);
  }
  for (const p of ['/', '/blog/x', '/api/posts/by-category/wow', '/administrator', '/media/a.png', '/rss.xml']) {
    assert.equal(isPrivatePath(p), false, p);
  }
});

test('private paths are forced to no-store whatever the status or type', () => {
  assert.equal(privateCacheControl('/admin', false, 'text/html', 'public, max-age=60'), 'no-store');
  assert.equal(privateCacheControl('/api/auth/login', false, null, null), 'no-store');
});

test('signed-in HTML is no-store, but public assets and API keep their policy', () => {
  assert.equal(privateCacheControl('/blog/x', true, 'text/html; charset=utf-8', null), 'private, no-store');
  assert.equal(privateCacheControl('/blog/x', true, 'text/html', 'private, max-age=0'), null);
  assert.equal(privateCacheControl('/media/a.png', true, 'image/png', 'public, max-age=31536000, immutable'), null);
  assert.equal(privateCacheControl('/api/posts/by-category/wow', true, 'application/json', 'public, max-age=600'), null);
  assert.equal(privateCacheControl('/blog/x', false, 'text/html', null), null);
});
