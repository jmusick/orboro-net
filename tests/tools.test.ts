import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupToolPages, TOOL_GROUPS, TOOL_INDEX_EXCLUDED_SLUGS, type ToolPage } from '../src/lib/tools.ts';

const page = (slug: string, homepageGroup: string, extra: Partial<ToolPage> = {}): ToolPage => ({
  slug, title: slug, homepageGroup, homepageDescription: '', summary: '', markdown: '', featuredImageUrl: null, ...extra,
});

test('tools group in WoW, PoE 2, other order and keep the caller order within a group', () => {
  const groups = groupToolPages([
    page('other-a', 'other'), page('poe-a', 'poe2'), page('wow-b', 'wow'), page('wow-a', 'wow'),
  ]);
  assert.deepEqual(groups.map(g => g.group.key), ['wow', 'poe2', 'other']);
  assert.deepEqual(groups[0].tiles.map(t => t.slug), ['wow-b', 'wow-a']);
  assert.deepEqual(groups.map(g => g.tiles[0].tone), ['wow', 'poe', 'default']);
  assert.equal(groups[2].group.heading, 'Other');
});

test('empty groups are dropped and unknown group keys fall into other', () => {
  const groups = groupToolPages([page('mystery', 'grim-dawn')]);
  assert.deepEqual(groups.map(g => g.group.key), ['other']);
  assert.equal(groups[0].tiles[0].group, TOOL_GROUPS.at(-1));
  assert.deepEqual(groupToolPages([]), []);
});

test('tile descriptions prefer the homepage description, then summary, then prose without tokens', () => {
  const [{ tiles: [withDescription] }] = groupToolPages([page('a', 'wow', { homepageDescription: 'Hand-written.', summary: 'Summary.' })]);
  assert.equal(withDescription.description, 'Hand-written.');
  const [{ tiles: [fromProse] }] = groupToolPages([page('b', 'wow', { markdown: 'Plan your keys. {{midnight_tier_list}}' })]);
  assert.equal(fromProse.description, 'Plan your keys.');
});

test('the hub pages are excluded from the tools index', () => {
  for (const slug of ['world-of-warcraft', 'path-of-exile-ii', 'gaming', 'grim-dawn', 'development']) {
    assert.ok(TOOL_INDEX_EXCLUDED_SLUGS.has(slug), slug);
  }
});
