import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toolDescription } from '../src/lib/excerpt.ts';

test('tool tiles use the homepage description when one is set', () => {
  assert.equal(toolDescription({ homepageDescription: 'Hand-written line.', markdown: 'Opening prose.' }), 'Hand-written line.');
});

test('the fallback strips shortcodes and HTML tags from the opening prose', () => {
  const markdown = '<p><img src="/a.png" alt="" width="10" height="10"></p>\n\nPlan your **queue** here.\n\n{{spell-queue-lab spec="fire"}}\n\nMore <em>text</em>.';
  assert.equal(toolDescription({ homepageDescription: '', markdown }), 'Plan your queue here. More text.');
});

test('a token or tag cut open by a bounded prefix is dropped', () => {
  assert.equal(toolDescription({ homepageDescription: '', markdown: 'Intro line.\n\n{{atlas-farming attr="unfinis' }), 'Intro line.');
  assert.equal(toolDescription({ homepageDescription: '', markdown: 'Intro line. <img src="/cut' }), 'Intro line.');
});
