import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descriptionFromMarkdown, excerptFromMarkdown, summaryOrExcerpt, toolDescription } from '../src/lib/excerpt.ts';

test('summaries are literal text and respect each destination length', () => {
  const record = { summary: '  A & B: **literal** <text> and under_scores.  ', markdown: 'Different body.' };
  assert.equal(summaryOrExcerpt(record), record.summary.trim());
  assert.equal(summaryOrExcerpt({ summary: 'One two three four five six seven eight.', markdown: 'Body' }, 20), 'One two three four…');
  for (const maxLen of [140, 155, 180]) {
    const text = 'A useful summary for readers. '.repeat(7).trim();
    const result = summaryOrExcerpt({ summary: text, markdown: 'Body' }, maxLen);
    assert.ok(result.length <= maxLen);
    assert.ok(result.endsWith('readers.'));
    assert.ok(text.startsWith(result));
  }
});

test('excerpts end on a whole sentence when one fills most of the allowance', () => {
  const summary = 'Kairos reads the cast bar and the queue window. The goal is to run it in raids without extra setup or tuning.';
  assert.equal(summaryOrExcerpt({ summary, markdown: '' }, 80), 'Kairos reads the cast bar and the queue window.');
  // A version number or decimal is not a sentence end.
  assert.equal(
    summaryOrExcerpt({ summary: 'Patch 12.1.5 changed the rotation for every spec that uses it in Mythic+ dungeons', markdown: '' }, 40),
    'Patch 12.1.5 changed the rotation for…',
  );
  // A sentence that ends too early still falls back to a word cut.
  assert.equal(
    summaryOrExcerpt({ summary: 'Short. Then a much longer second sentence that runs past the limit', markdown: '' }, 40),
    'Short. Then a much longer second…',
  );
});

test('empty summaries preserve the existing post and page fallbacks', () => {
  const markdown = '# Heading\n\n<p>Opening **prose**.</p>\n\n{{widget}}';
  for (const summary of [undefined, '', '   ']) {
    assert.equal(summaryOrExcerpt({ summary, markdown }), excerptFromMarkdown(markdown));
    assert.equal(summaryOrExcerpt({ summary, markdown }, 155, descriptionFromMarkdown), 'Opening prose.');
  }
  assert.equal(summaryOrExcerpt({ markdown: '{{widget}}' }, 155, descriptionFromMarkdown), '');
});

test('tool descriptions prefer homepage overrides, then summary, then cleaned prose', () => {
  const page = { homepageDescription: 'Homepage override.', summary: 'Summary with **literal** text.', markdown: 'Body.' };
  assert.equal(toolDescription(page), 'Homepage override.');
  assert.equal(toolDescription({ ...page, homepageDescription: '' }), page.summary);
  assert.equal(toolDescription({ ...page, homepageDescription: '', summary: '' }), 'Body.');
});

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

test('stripping tags never leaves an opening bracket that could start a new one', () => {
  const out = toolDescription({ homepageDescription: '', markdown: 'Safe <<b>script>alert(1) <<i>text.' });
  assert.ok(!out.includes('<'), out);
});
