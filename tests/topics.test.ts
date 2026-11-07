import test from 'node:test';
import assert from 'node:assert/strict';
import { assignCovers, gameHubsForCategories, homepageTopics, topicTone } from '../src/lib/topics.ts';

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

test('exhausted artwork leaves categories without a cover', () => {
  const covers = assignCovers(['gaming', 'wow'], [
    { categoryId: 'gaming', imageUrl: '/a.png' },
    { categoryId: 'wow', imageUrl: '/a.png' },
  ]);
  assert.equal(covers.has('wow'), false);
  assert.deepEqual([...covers.values()], ['/a.png']);
});

test('game hubs follow the post\'s game categories in toolkit order', () => {
  assert.deepEqual(gameHubsForCategories(['development']), []);
  assert.deepEqual(gameHubsForCategories(['gaming', 'world-of-warcraft']).map((h) => h.group), ['wow']);
  assert.deepEqual(gameHubsForCategories(['path-of-exile-ii', 'wow']).map((h) => h.href), ['/pages/world-of-warcraft', '/pages/path-of-exile-ii']);
});


test('covers exclude lead and latest artwork and never repeat an image URL', () => {
  const taken = new Set(['/lead.png', '/latest.png']);
  const covers = assignCovers(['wow', 'poe', 'dev'], [
    { categoryId: 'wow', imageUrl: '/lead.png' },
    { categoryId: 'poe', imageUrl: '/latest.png' },
    { categoryId: 'wow', imageUrl: '/older.png' },
    { categoryId: 'poe', imageUrl: '/older.png' },
    { categoryId: 'poe', imageUrl: '/oldest.png' },
    { categoryId: 'dev', imageUrl: '/latest.png' },
  ], taken);
  assert.deepEqual([...covers], [['wow', '/older.png'], ['poe', '/oldest.png']]);
  assert.equal(new Set(covers.values()).size, covers.size);
  assert.deepEqual([...taken], ['/lead.png', '/latest.png']);
});

test('homepage topics omit Gaming while preserving the order and original categories', () => {
  const categories = [
    { slug: 'development', postCount: 8 },
    { slug: 'gaming', postCount: 6 },
    { slug: 'world-of-warcraft', postCount: 4 },
    { slug: 'path-of-exile-ii', postCount: 4 },
  ];
  assert.deepEqual(homepageTopics(categories), [categories[0], categories[2], categories[3]]);
  assert.equal(categories.length, 4);
  assert.equal(categories[1].slug, 'gaming');
});
