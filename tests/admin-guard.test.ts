import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { isAdmin, requireAdmin, requireMember, requireUser } from '../src/lib/http.ts';

// The app is admin-only by design (issue #16). editor/author exist in the
// schema but grant nothing, so every admin page and mutation endpoint must
// call requireAdmin before doing any work.

const ROUTE_ROOTS = ['src/pages/api', 'src/pages/admin'];

// Public member routes (accounts and comments). They are not admin routes:
// each one either guards with requireMember or is listed in MEMBER_EXCEPTIONS.
const MEMBER_PREFIXES = ['src/pages/api/members/', 'src/pages/api/comments/'];

const MEMBER_EXCEPTIONS: Record<string, string> = {
  'src/pages/api/members/register.ts': 'registration is for signed-out visitors',
  'src/pages/api/members/login.ts': 'sign-in must be reachable while signed out',
  'src/pages/api/members/logout.ts': 'any member session may end itself',
  'src/pages/api/members/verify.ts': 'authorized by the single-use emailed token',
  'src/pages/api/members/forgot.ts': 'password reset is for signed-out visitors',
  'src/pages/api/members/reset.ts': 'authorized by the single-use emailed token',
};

const isMemberRoute = (route: string) => MEMBER_PREFIXES.some((prefix) => route.startsWith(prefix));

// Routes that deliberately do not call requireAdmin, with the reason.
const EXCEPTIONS: Record<string, string> = {
  'src/pages/api/auth/login.ts': 'login must be reachable while signed out',
  'src/pages/api/auth/logout.ts': 'any session may end itself',
  'src/pages/api/auth/revoke-all.ts': "only revokes the caller's own sessions (requireUser)",
  'src/pages/api/posts/by-category/[slug].ts': 'public read-only JSON of published posts',
  'src/pages/admin/index.astro': 'login page plus dashboard; renders the dashboard only when isAdmin(user)',
};

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return /\.(ts|astro)$/.test(entry.name) ? [path] : [];
  });
}

const routes = ROUTE_ROOTS.flatMap(routeFiles).map((file) => relative('.', file).split(sep).join('/')).sort();

function source(route: string): string {
  return readFileSync(route, 'utf8').replace(/\r\n/g, '\n');
}

test('route enumeration finds the API and admin routes', () => {
  assert.ok(routes.length >= 20, `only found ${routes.length} routes`);
  assert.ok(routes.includes('src/pages/api/content/save.ts'));
  assert.ok(routes.includes('src/pages/admin/content/[id].astro'));
});

test('every exception names an existing route', () => {
  for (const route of [...Object.keys(EXCEPTIONS), ...Object.keys(MEMBER_EXCEPTIONS)]) {
    assert.ok(routes.includes(route), `${route} is listed as an exception but does not exist`);
  }
});

test('every other admin page and API route guards with requireAdmin before any work', () => {
  for (const route of routes) {
    if (route in EXCEPTIONS || isMemberRoute(route)) continue;
    const text = source(route);
    const guard = text.match(/(\w+) = requireAdmin\((context|Astro)\);\n\s*if \(\1 instanceof Response\) return \1;/);
    assert.ok(guard, `${route} must call requireAdmin and return its Response`);
    const before = text.slice(0, guard.index);
    assert.ok(!/\bawait\b|readBoundedForm\(|\.formData\(|\.json\(\)/.test(before), `${route} does work before its admin guard`);
  }
});

test('every member route guards with requireMember before any work, or is a listed exception', () => {
  const memberRoutes = routes.filter(isMemberRoute);
  assert.ok(memberRoutes.length >= 15, `only found ${memberRoutes.length} member routes`);
  for (const route of memberRoutes) {
    const text = source(route);
    assert.doesNotMatch(text, /requireAdmin|requireUser|locals\.user\b/, `${route} must not touch admin sessions`);
    if (route in MEMBER_EXCEPTIONS) continue;
    const guard = text.match(/(\w+) = requireMember\(context(, \{ verified: false \})?\);\n\s*if \(\1 instanceof Response\) return \1;/);
    assert.ok(guard, `${route} must call requireMember and return its Response`);
    const before = text.slice(0, guard.index);
    assert.ok(!/\bawait\b|readBoundedForm\(|readMemberFields\(|\.formData\(|\.json\(\)/.test(before), `${route} does work before its member guard`);
  }
});

test('comment routes need a verified member; account routes allow unverified ones', () => {
  for (const route of routes.filter((r) => r.startsWith('src/pages/api/comments/'))) {
    assert.match(source(route), /= requireMember\(context\);/, `${route} must require a verified email`);
  }
});

test('no route uses a role list or inline role check', () => {
  for (const route of routes) {
    const text = source(route);
    assert.ok(!/ensureRole|hasRole|\.role\b/.test(text), `${route} must not do its own role checks`);
  }
});

test('exceptions keep the guards they rely on', () => {
  assert.match(source('src/pages/api/auth/revoke-all.ts'), /requireUser\(context\)/);
  assert.match(source('src/pages/admin/index.astro'), /const loggedIn = isAdmin\(user\)/);
  assert.doesNotMatch(source('src/pages/admin/index.astro'), /Boolean\(Astro\.locals\.user\)/);
  // Only login, logout and revoke-all may exist under api/auth without requireAdmin.
  assert.deepEqual(
    routes.filter((r) => r.startsWith('src/pages/api/auth/')),
    ['src/pages/api/auth/login.ts', 'src/pages/api/auth/logout.ts', 'src/pages/api/auth/revoke-all.ts'],
  );
  // The member account page is guarded too, though it is not under /admin.
  assert.match(source('src/pages/account/index.astro'), /= requireMember\(Astro, \{ verified: false \}\);\n\s*if \(signedIn instanceof Response\) return signedIn;/);
});

function context(user: UserRecord | null) {
  return {
    locals: { user } as App.Locals,
    redirect: (path: string, status = 302) => new Response(null, { status, headers: { Location: path } }),
  };
}

const user = (role: UserRole): UserRecord => ({ id: `u-${role}`, email: `${role}@example.com`, role });

test('requireAdmin returns the user for an admin', () => {
  const admin = user('admin');
  assert.equal(requireAdmin(context(admin)), admin);
  assert.equal(isAdmin(admin), true);
});

test('requireAdmin sends an anonymous request to the login page', () => {
  const result = requireAdmin(context(null));
  assert.ok(result instanceof Response);
  assert.equal(result.status, 302);
  assert.equal(result.headers.get('Location'), '/admin');
  assert.equal(isAdmin(null), false);
});

for (const role of ['editor', 'author'] as const) {
  test(`requireAdmin refuses the ${role} role`, () => {
    const result = requireAdmin(context(user(role)));
    assert.ok(result instanceof Response);
    assert.equal(result.status, 302);
    assert.equal(result.headers.get('Location'), '/admin?error=forbidden');
    assert.equal(isAdmin(user(role)), false);
  });
}

test('requireUser still admits any signed-in role (revoke-all)', () => {
  for (const role of ['admin', 'editor', 'author'] as const) {
    const signedIn = user(role);
    assert.equal(requireUser(context(signedIn)), signedIn);
  }
  const anonymous = requireUser(context(null));
  assert.ok(anonymous instanceof Response);
  assert.equal(anonymous.headers.get('Location'), '/admin');
});

const member = (verified: boolean): MemberRecord => ({ id: 'm1', username: 'reader', displayName: '', email: 'reader@example.com', emailVerified: verified });

test('a member session never satisfies the admin guards, and an admin session never satisfies requireMember', () => {
  const asMember = { locals: { user: null, member: member(true) } as unknown as App.Locals, redirect: context(null).redirect };
  const adminOnly = requireAdmin(asMember);
  assert.ok(adminOnly instanceof Response);
  assert.equal(adminOnly.headers.get('Location'), '/admin');
  assert.ok(requireUser(asMember) instanceof Response);

  const asAdmin = { locals: { user: user('admin'), member: null } as unknown as App.Locals, redirect: context(null).redirect };
  const memberOnly = requireMember(asAdmin);
  assert.ok(memberOnly instanceof Response);
  assert.equal(memberOnly.headers.get('Location'), '/account/login');
});

test('requireMember refuses unverified members unless the route allows them', () => {
  const ctx = (m: MemberRecord) => ({ locals: { user: null, member: m } as unknown as App.Locals, redirect: context(null).redirect });
  const refused = requireMember(ctx(member(false)));
  assert.ok(refused instanceof Response);
  assert.equal(refused.headers.get('Location'), '/account?error=unverified');
  assert.equal((requireMember(ctx(member(false)), { verified: false }) as MemberRecord).id, 'm1');
  assert.equal((requireMember(ctx(member(true))) as MemberRecord).id, 'm1');
});
