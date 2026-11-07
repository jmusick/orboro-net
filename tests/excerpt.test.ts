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
    assert.ok(result.length <= maxLen + 1);
    assert.ok(result.endsWith('…'));
    assert.match(text.slice(result.length - 1), /^[\s,;:.–—-]/);
  }
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
