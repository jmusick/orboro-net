import test from 'node:test';
import assert from 'node:assert/strict';
import { addHeadingIds } from '../src/lib/toc.ts';

test('h2 headings get slug ids and become TOC entries', () => {
  const { html, headings } = addHeadingIds('<p>Intro</p><h2>Build the fight model first</h2><p>x</p><h2>Could this replace <em>WoWAnalyzer</em>?</h2>');
  assert.deepEqual(headings, [
    { id: 'build-the-fight-model-first', text: 'Build the fight model first' },
    { id: 'could-this-replace-wowanalyzer', text: 'Could this replace WoWAnalyzer?' },
  ]);
  assert.match(html, /<h2 id="build-the-fight-model-first">Build the fight model first<\/h2>/);
  assert.match(html, /<h2 id="could-this-replace-wowanalyzer">Could this replace <em>WoWAnalyzer<\/em>\?<\/h2>/);
});

test('duplicate headings get unique ids and entities decode in labels', () => {
  const { headings } = addHeadingIds('<h2>Q&amp;A</h2><h2>Q&amp;A</h2><h2>Caf&#xe9; &lt;3</h2>');
  assert.deepEqual(headings.map((h) => h.id), ['q-a', 'q-a-2', 'cafe-3']);
  assert.equal(headings[0].text, 'Q&A');
  assert.equal(headings[2].text, 'Café <3');
});

test('existing ids are kept and empty headings are skipped', () => {
  const { html, headings } = addHeadingIds('<h2 id="custom" class="x">Named</h2><h2> </h2><h3>Not listed</h3>');
  assert.deepEqual(headings, [{ id: 'custom', text: 'Named' }]);
  assert.equal(html, '<h2 id="custom" class="x">Named</h2><h2> </h2><h3>Not listed</h3>');
});
