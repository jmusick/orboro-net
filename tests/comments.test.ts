import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CommentError, MAX_COMMENT_DEPTH, MAX_COMMENT_LENGTH,
  createComment, deleteOwnComment, editComment, getCommentTarget, listCommentTree, listMemberComments,
  listRecentComments, listReportedComments, moderateComment, normalizeCommentBody, relativeTime, renderCommentBody,
  reportComment, voteOnComment, wilsonLowerBound,
} from '../src/lib/comments.ts';
import { createMember, markEmailVerified } from '../src/lib/members.ts';
import { makeMigratedDb, seedContent } from './helpers/d1.ts';

const T0 = 1_800_000_000_000;

async function setup() {
  const harness = makeMigratedDb();
  seedContent(harness.sqlite);
  for (const [id, username] of [['ma', 'alice'], ['mb', 'bob'], ['mc', 'carol']]) {
    await createMember(harness.db, { username, email: `${username}@example.com`, passwordHash: 'h' }, T0, () => id);
    await markEmailVerified(harness.db, id, `${username}@example.com`, T0);
  }
  let n = 0;
  const post = (memberId: string, body: string, parentId: string | null = null, contentId = 'post1') =>
    createComment(harness.db, { contentId, memberId, parentId, body }, T0 + ++n * 1000, () => `c${n}`);
  return { ...harness, post };
}

const code = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    if (error instanceof CommentError) return error.code;
    throw error;
  }
};

test('comment text is trimmed, CRLF-normalized and bounded', () => {
  assert.equal(normalizeCommentBody('  hi\r\nthere  '), 'hi\nthere');
  assert.equal(normalizeCommentBody('   '), null);
  assert.equal(normalizeCommentBody('x'.repeat(MAX_COMMENT_LENGTH + 1)), null);
  assert.equal(normalizeCommentBody('nul\u0000'), null);
  assert.equal(normalizeCommentBody('rtl\u202eoverride'), null);
  assert.equal(normalizeCommentBody('tabs\tare fine'), 'tabs\tare fine');
  assert.equal(normalizeCommentBody(42), null);
});

test('comment rendering escapes everything and only links http(s) URLs', () => {
  const html = renderCommentBody('<script>alert(1)</script> & "quotes"\n\nsee https://example.com/a?b=1&c=2, ok\n> quoted <b>');
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;quotes&quot;/);
  assert.match(html, /<a href="https:\/\/example\.com\/a\?b=1&amp;c=2" rel="ugc nofollow noopener">https:\/\/example\.com\/a\?b=1&amp;c=2<\/a>, ok/);
  assert.match(html, /<p>see .*<br>&gt; quoted &lt;b&gt;<\/p>/, 'a quote line inside a paragraph stays text');
  assert.equal(renderCommentBody('> one\n> two'), '<blockquote><p>one<br>two</p></blockquote>');
  assert.ok(!renderCommentBody('javascript:alert(1)').includes('<a'));
  assert.ok(!renderCommentBody('https://user:pw@example.com').includes('<a'), 'credentials in URLs are not linked');
  assert.ok(!renderCommentBody('https://example.com/"onmouseover="x').includes('onmouseover="'));
});

test('posting adds the author\'s upvote and builds a nested, pruned tree', async () => {
  const { db, post } = await setup();
  const top = await post('ma', 'top');
  const reply = await post('mb', 'reply', top);
  await post('mc', 'second top');
  const tree = await listCommentTree(db, 'post1', 'mb', 'old');
  assert.equal(tree.count, 3);
  assert.deepEqual(tree.roots.map((n) => n.id), [top, 'c3']);
  assert.equal(tree.roots[0].score, 1, 'new comments start at 1');
  assert.equal(tree.roots[0].children[0].id, reply);
  assert.equal(tree.roots[0].children[0].depth, 1);
  assert.equal(tree.roots[0].children[0].mine, true);
  assert.equal(tree.roots[0].children[0].myVote, 1);
  assert.equal(tree.roots[0].mine, false);
  assert.equal(tree.roots[0].author?.username, 'alice');
});

test('comments need published content with comments open, and replies a live parent on the same page', async () => {
  const { db, sqlite, post } = await setup();
  assert.equal(await code(post('ma', 'x', null, 'draft1')), 'closed');
  assert.equal(await code(post('ma', 'x', null, 'missing')), 'closed');
  sqlite.exec("UPDATE content SET comments_mode = 'locked' WHERE id = 'page1'");
  assert.equal(await code(post('ma', 'x', null, 'page1')), 'closed');
  sqlite.exec("UPDATE content SET comments_mode = 'hidden' WHERE id = 'page1'");
  assert.equal(await code(post('ma', 'x', null, 'page1')), 'closed');

  const top = await post('ma', 'top');
  sqlite.exec("UPDATE content SET comments_mode = 'open' WHERE id = 'page1'");
  assert.equal(await code(post('mb', 'cross-page reply', top, 'page1')), 'parent', 'a reply must stay on its parent\'s page');
  assert.equal(await code(post('mb', '   ')), 'body');
  await moderateComment(db, top, 'remove');
  assert.equal(await code(post('mb', 'reply to removed', top)), 'parent');
});

test(`replies nest at most ${MAX_COMMENT_DEPTH} levels`, async () => {
  const { post } = await setup();
  let parent = await post('ma', 'level 0');
  for (let depth = 1; depth <= MAX_COMMENT_DEPTH; depth++) parent = await post('mb', `level ${depth}`, parent);
  assert.equal(await code(post('mc', 'too deep', parent)), 'depth');
});

test('only the author can edit or delete a comment', async () => {
  const { db, post, one } = await setup();
  const id = await post('ma', 'original');
  assert.equal(await code(editComment(db, { commentId: id, memberId: 'mb', body: 'hijacked' }, T0)), 'not-found');
  assert.equal(await code(deleteOwnComment(db, { commentId: id, memberId: 'mb' })), 'not-found');
  assert.equal(one('SELECT body FROM comments WHERE id = ?', id)?.body, 'original');

  await editComment(db, { commentId: id, memberId: 'ma', body: 'edited' }, T0 + 5);
  assert.deepEqual({ ...one('SELECT body, edited_at FROM comments WHERE id = ?', id) }, { body: 'edited', edited_at: T0 + 5 });
  assert.equal(await code(editComment(db, { commentId: id, memberId: 'ma', body: '' }, T0)), 'body');
});

test('editing is closed on locked pages; deleting is not', async () => {
  const { db, sqlite, post, one } = await setup();
  const id = await post('ma', 'text');
  sqlite.exec("UPDATE content SET comments_mode = 'locked' WHERE id = 'post1'");
  assert.equal(await code(editComment(db, { commentId: id, memberId: 'ma', body: 'new' }, T0)), 'closed');
  await deleteOwnComment(db, { commentId: id, memberId: 'ma' });
  assert.equal(one('SELECT COUNT(*) AS n FROM comments WHERE id = ?', id)?.n, 0);
});

test('a deleted comment with replies stays as an empty placeholder; a leaf is removed outright', async () => {
  const { db, post, one } = await setup();
  const top = await post('ma', 'parent text');
  const reply = await post('mb', 'reply', top);
  await deleteOwnComment(db, { commentId: top, memberId: 'ma' });
  assert.deepEqual({ ...one('SELECT status, body FROM comments WHERE id = ?', top) }, { status: 'deleted', body: '' });
  let tree = await listCommentTree(db, 'post1', null);
  assert.equal(tree.count, 1);
  assert.equal(tree.roots[0].status, 'deleted');
  assert.equal(tree.roots[0].author, null);
  assert.equal(tree.roots[0].body, '');

  await deleteOwnComment(db, { commentId: reply, memberId: 'mb' });
  tree = await listCommentTree(db, 'post1', null);
  assert.deepEqual(tree.roots, [], 'a placeholder with no live replies disappears');
});

test('voting toggles like reddit and one member has one vote', async () => {
  const { db, post } = await setup();
  const id = await post('ma', 'vote on me');
  assert.deepEqual(await voteOnComment(db, { commentId: id, memberId: 'mb', direction: 1 }, T0), { vote: 1, score: 2 });
  assert.deepEqual(await voteOnComment(db, { commentId: id, memberId: 'mb', direction: 1 }, T0), { vote: 0, score: 1 }, 'same arrow clears');
  assert.deepEqual(await voteOnComment(db, { commentId: id, memberId: 'mb', direction: -1 }, T0), { vote: -1, score: 0 });
  assert.deepEqual(await voteOnComment(db, { commentId: id, memberId: 'mb', direction: 1 }, T0), { vote: 1, score: 2 }, 'other arrow switches');
  assert.deepEqual(await voteOnComment(db, { commentId: id, memberId: 'ma', direction: 1 }, T0), { vote: 0, score: 1 }, 'authors may withdraw their own upvote');
  const tree = await listCommentTree(db, 'post1', 'mc');
  assert.deepEqual([tree.roots[0].ups, tree.roots[0].downs, tree.roots[0].myVote], [1, 0, 0]);
});

test('votes need a visible comment on an open page', async () => {
  const { db, sqlite, post } = await setup();
  const id = await post('ma', 'text');
  sqlite.exec("UPDATE content SET comments_mode = 'locked' WHERE id = 'post1'");
  assert.equal(await code(voteOnComment(db, { commentId: id, memberId: 'mb', direction: 1 }, T0)), 'closed');
  sqlite.exec("UPDATE content SET comments_mode = 'open' WHERE id = 'post1'");
  await moderateComment(db, id, 'remove');
  assert.equal(await code(voteOnComment(db, { commentId: id, memberId: 'mb', direction: 1 }, T0)), 'not-found');
});

test('sorts: best uses the Wilson bound, top the score, new and old the time', async () => {
  const { db, sqlite, post } = await setup();
  const steady = await post('ma', 'steady');
  const lucky = await post('mb', 'lucky');
  const disliked = await post('mc', 'disliked');
  // steady: 4 up (with author) 1 down; lucky: 1 up; disliked: 1 up 2 down.
  for (let i = 0; i < 3; i++) sqlite.exec(`INSERT INTO members (id, username, username_key, email, password_hash, created_at, updated_at) VALUES ('v${i}', 'v${i}', 'v${i}', 'v${i}@e.co', 'h', 0, 0)`);
  sqlite.exec(`INSERT INTO comment_votes VALUES ('${steady}', 'v0', 1, 0), ('${steady}', 'v1', 1, 0), ('${steady}', 'v2', 1, 0), ('${steady}', 'mb', -1, 0),
    ('${disliked}', 'v0', -1, 0), ('${disliked}', 'v1', -1, 0)`);
  const order = async (sort: 'best' | 'top' | 'new' | 'old') => (await listCommentTree(db, 'post1', null, sort)).roots.map((n) => n.id);
  assert.deepEqual(await order('best'), [steady, lucky, disliked]);
  assert.deepEqual(await order('top'), [steady, lucky, disliked]);
  assert.deepEqual(await order('new'), [disliked, lucky, steady]);
  assert.deepEqual(await order('old'), [steady, lucky, disliked]);
  assert.ok(wilsonLowerBound(30, 2) > wilsonLowerBound(2, 0));
  assert.equal(wilsonLowerBound(0, 0), 0);
});

test('reports: once per member, never your own, resolved by moderation', async () => {
  const { db, post } = await setup();
  const id = await post('ma', 'spam?');
  assert.equal(await code(reportComment(db, { commentId: id, memberId: 'ma', reason: 'spam' }, T0)), 'own-comment');
  assert.equal(await code(reportComment(db, { commentId: id, memberId: 'mb', reason: 'nonsense' }, T0)), 'body');
  await reportComment(db, { commentId: id, memberId: 'mb', reason: 'spam' }, T0);
  await reportComment(db, { commentId: id, memberId: 'mb', reason: 'other' }, T0);
  await reportComment(db, { commentId: id, memberId: 'mc', reason: 'harassment' }, T0);
  let queue = await listReportedComments(db);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].openReports, 2);
  assert.deepEqual(queue[0].reasons.sort(), ['harassment', 'spam']);

  await moderateComment(db, id, 'dismiss', T0);
  assert.deepEqual(await listReportedComments(db), []);
  assert.equal((await listCommentTree(db, 'post1', null)).count, 1, 'dismissing leaves the comment up');
});

test('removing hides a comment publicly but keeps its text for restoring', async () => {
  const { db, post } = await setup();
  const id = await post('ma', 'rule breaking');
  await post('mb', 'a reply', id);
  assert.equal(await moderateComment(db, id, 'remove', T0), true);
  let tree = await listCommentTree(db, 'post1', 'ma');
  assert.equal(tree.roots[0].status, 'removed');
  assert.equal(tree.roots[0].body, '');
  assert.equal(tree.roots[0].author, null);
  assert.equal(tree.roots[0].mine, false, 'the author can no longer act on a removed comment');
  assert.equal((await listRecentComments(db))[1].body, 'rule breaking', 'admins still see the text');
  assert.equal(await code(editComment(db, { commentId: id, memberId: 'ma', body: 'sneaky' }, T0)), 'not-found');

  await moderateComment(db, id, 'restore', T0);
  tree = await listCommentTree(db, 'post1', null);
  assert.equal(tree.roots[0].body, 'rule breaking');
  assert.equal(await moderateComment(db, 'missing', 'remove', T0), false);
});

test('profiles list only visible comments on published, non-hidden pages; targets resolve paths', async () => {
  const { db, sqlite, post } = await setup();
  const onPost = await post('ma', 'on the post');
  await post('ma', 'on the page', null, 'page1');
  sqlite.exec("UPDATE content SET comments_mode = 'hidden' WHERE id = 'page1'");
  const mine = await listMemberComments(db, 'ma');
  assert.deepEqual(mine.map((c) => c.id), [onPost]);
  assert.equal(mine[0].path, '/blog/hello');
  assert.deepEqual(await getCommentTarget(db, onPost), { contentId: 'post1', path: '/blog/hello', memberId: 'ma' });
  assert.equal((await getCommentTarget(db, 'c2'))?.path, '/pages/tools');
  assert.equal(await getCommentTarget(db, 'nope'), null);
});

test('relative times read naturally', () => {
  assert.equal(relativeTime(T0, T0 + 10_000), 'just now');
  assert.equal(relativeTime(T0, T0 + 3 * 3600_000), '3 hours ago');
  assert.equal(relativeTime(T0, T0 + 24 * 3600_000), 'yesterday');
});
