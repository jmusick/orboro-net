import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { EMBEDS_SHORTCODE_SQL, hasCompleteShortcode, hasShortcode, stripShortcodePrefix, stripShortcodes } from '../src/lib/shortcode-tokens.ts';

test('tokens with attributes are detected and stripped', () => {
  const markdown = 'Plan here.\n\n{{spell-queue-lab spec="fire"}}\n\nMore.';
  assert.equal(hasShortcode(markdown), true);
  assert.equal(stripShortcodes(markdown), 'Plan here.\n\n\n\nMore.');
  assert.equal(stripShortcodes('a{{bookmarks}}b', ' '), 'a b');
});

test('tokens with &quot;-encoded attributes are detected and stripped', () => {
  const markdown = 'Intro {{tool attr=&quot;x&quot; other=&quot;y&quot;}} outro';
  assert.equal(hasShortcode(markdown), true);
  assert.equal(stripShortcodes(markdown), 'Intro  outro');
});

test('an unclosed token at the end of a length-limited prefix is detected and dropped', () => {
  const prefix = 'Intro line.\n\n{{atlas-farming attr="unfinis';
  assert.equal(hasShortcode(prefix), true);
  assert.equal(hasCompleteShortcode(prefix), false);
  // A complete-token strip leaves it alone; the prefix strip removes it.
  assert.equal(stripShortcodes(prefix), prefix);
  assert.equal(stripShortcodePrefix(prefix), 'Intro line.\n\n');
  assert.equal(stripShortcodePrefix('Intro {{'), 'Intro ');
  assert.equal(stripShortcodePrefix('Intro {{ x'), 'Intro ');
  assert.equal(stripShortcodePrefix('{{done}} and more'), ' and more');
  assert.equal(stripShortcodePrefix('a {{ note }} b {{tool x="}"}} c'), 'a  b  c');
});

test('{{ followed by a non-word character is not a shortcode', () => {
  for (const markdown of ['{{ spaced }}', '{{-dash}}', '{{"quoted"}}', 'just {{']) {
    assert.equal(hasShortcode(markdown), false, markdown);
    assert.equal(stripShortcodes(markdown), markdown, markdown);
    assert.equal(hasCompleteShortcode(markdown), false, markdown);
  }
});

test('hasShortcode and EMBEDS_SHORTCODE_SQL agree', () => {
  const sqlite = new DatabaseSync(':memory:');
  const query = sqlite.prepare(`SELECT (${EMBEDS_SHORTCODE_SQL}) AS hit FROM (SELECT ? AS markdown)`);
  const inputs = [
    '', 'plain prose', '{{bookmarks}}', 'text {{tool attr=&quot;x&quot;}}', '{{spell-queue-lab spec="fire"}}',
    'cut {{atlas', '{{_under}}', '{{9lives}}', '{{Upper}}', '{{ spaced }}', '{{-dash}}', 'just {{', '{ {x}}', 'a {{\nname}}',
  ];
  for (const markdown of inputs) {
    const row = query.get(markdown) as { hit: number };
    assert.equal(row.hit === 1, hasShortcode(markdown), JSON.stringify(markdown));
  }
});
