import test from 'node:test';
import assert from 'node:assert/strict';
import { responsiveImage } from '../src/lib/images.ts';
const source = 'https://media.orboro.net/images/header.webp?v=1.32.1&x=two';
const prefix = 'https://orboro.net/cdn-cgi/image/';

test('media artwork gets sorted width candidates, query strings and fallback', () => {
  const image = responsiveImage(source, [800, 480, 800], '50vw');
  assert.equal(image.src, `${prefix}width=800,quality=80,format=auto/${source}`);
  assert.equal(image.srcset, `${prefix}width=480,quality=80,format=auto/${source} 480w, ${prefix}width=800,quality=80,format=auto/${source} 800w`);
  assert.equal(image.sizes, '50vw');
});

test('site images can use root-relative or canonical absolute URLs', () => {
  for (const url of ['/images/header.webp?v=1', 'https://orboro.net/images/header.webp?v=1']) {
    assert.equal(responsiveImage(url, [480], '100vw').src, `${prefix}width=480,quality=80,format=auto/https://orboro.net/images/header.webp?v=1`);
  }
});

test('foreign, local, malformed and unsupported URLs are left alone', () => {
  for (const url of ['https://other.test/a.webp', '/media/a.webp', 'images/header.webp', '../images/header.webp', '//other.test/images/a.webp', 'https://media.orboro.net.evil.test/a.webp', 'http://media.orboro.net/a.webp', 'data:image/png;base64,AA', 'https://[broken', 'https://user:pass@media.orboro.net/a.webp']) {
    assert.deepEqual(responsiveImage(url, [480], '100vw'), { src: url });
  }
});

test('local and preview requests keep originals, including remote media', () => {
  for (const origin of ['http://127.0.0.1:8787', 'http://localhost:4321', 'http://[::1]:8787', 'https://preview.workers.dev']) {
    for (const url of [source, '/images/header.webp', '/media/header.webp']) {
      assert.deepEqual(responsiveImage(url, [480], '100vw', new URL(origin)), {src: url});
    }
  }
  assert.ok(responsiveImage(source, [480], '100vw', new URL('https://orboro.net/blog')).srcset);
});

test('source commas are escaped without corrupting transformation options', () => {
  const image = responsiveImage('https://media.orboro.net/images/a,b.webp?v=x,y', [480], '100vw');
  assert.equal(image.srcset, `${prefix}width=480,quality=80,format=auto/https://media.orboro.net/images/a%2Cb.webp?v=x%2Cy 480w`);
});

test('invalid width candidates are ignored', () => {
  assert.deepEqual(responsiveImage(source, [0, -1, NaN, 2.5], '100vw'), {src: source});
});
