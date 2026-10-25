import test from 'node:test';
import assert from 'node:assert/strict';
import { assignCovers, gameHubsForCategories, topicTone } from '../src/lib/topics.ts';

test('topic tones map game categories and tool groups', () => {
  assert.equal(topicTone('world-of-warcraft'), 'wow');
  assert.equal(topicTone('wow'), 'wow');
  assert.equal(topicTone('path-of-exile-ii'), 'poe');
  assert.equal(topicTone('poe2'), 'poe');
  assert.equal(topicTone('development'), 'default');
  assert.equal(topicTone(undefined), 'default');
});

test('covers prefer art no earlier category has claimed', () => {
  const covers = assignCovers(['gaming', 'wow', 'dev'], [
    { categoryId: 'gaming', imageUrl: '/a.png' },
    { categoryId: 'wow', imageUrl: '/a.png' },
    { categoryId: 'gaming', imageUrl: '/b.png' },
    { categoryId: 'wow', imageUrl: '/c.png' },
  ]);
  assert.equal(covers.get('gaming'), '/a.png');
  assert.equal(covers.get('wow'), '/c.png');
  assert.equal(covers.has('dev'), false);
});

test('a category whose only art is taken still gets it', () => {
  const covers = assignCovers(['gaming', 'wow'], [
    { categoryId: 'gaming', imageUrl: '/a.png' },
    { categoryId: 'wow', imageUrl: '/a.png' },
  ]);
  assert.equal(covers.get('wow'), '/a.png');
});

test('game hubs follow the post\'s game categories in toolkit order', () => {
  assert.deepEqual(gameHubsForCategories(['development']), []);
  assert.deepEqual(gameHubsForCategories(['gaming', 'world-of-warcraft']).map((h) => h.group), ['wow']);
  assert.deepEqual(gameHubsForCategories(['path-of-exile-ii', 'wow']).map((h) => h.href), ['/pages/world-of-warcraft', '/pages/path-of-exile-ii']);
});
