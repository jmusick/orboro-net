import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const component = readFileSync(new URL('../src/components/ConsentBanner.astro', import.meta.url), 'utf8');
const script = component.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

function browserHarness(stored = null, storageUnavailable = false, href = 'https://www.orboro.net/', referrer = '') {
  const parsed = new URL(href);
  const listeners = new Map();
  const scripts = [];
  const cookies = [];
  let reloads = 0;
  let hasBanner = true;
  class Element {
    constructor(kind) { this.kind = kind; this.hidden = true; this.isConnected = true; }
    closest(selector) {
      return selector === `[data-analytics-${this.kind === 'preferences' ? 'preferences' : 'consent'}]` ? this : null;
    }
    getAttribute() { return this.kind; }
    focus() {}
  }
  const preferences = new Element('preferences');
  const banner = { hidden: true, contains: () => true, querySelector: () => new Element('denied') };
  const controller = { nonce: 'first-page-nonce' };
  const document = {
    title: 'Home',
    referrer,
    getElementById: id => id === 'analytics-controller' ? controller : hasBanner ? banner : null,
    querySelector: () => preferences,
    querySelectorAll: () => [preferences],
    createElement: () => ({}),
    head: { appendChild: element => scripts.push(element) },
    addEventListener: (name, listener) => {
      const handlers = listeners.get(name) || [];
      handlers.push(listener);
      listeners.set(name, handlers);
    },
    get cookie() { return '_ga=old; _ga_BLR72SL0L6=old; orboro_session=keep'; },
    set cookie(value) { cookies.push(value); }
  };
  const window = { addEventListener: document.addEventListener };
  const context = {
    Element, document, window, URL,
    location: { href: parsed.href, pathname: parsed.pathname, search: parsed.search, hash: parsed.hash, origin: parsed.origin, hostname: parsed.hostname, reload: () => reloads++ },
    localStorage: {
      getItem: () => { if (storageUnavailable) throw new Error('blocked'); return stored; },
      setItem: (_, value) => { if (storageUnavailable) throw new Error('blocked'); stored = value; }
    }
  };
  const emit = (name, event = {}) => (listeners.get(name) || []).forEach(listener => listener(event));
  runInNewContext(script, context);
  return {
    scripts, cookies, banner, controller, window, context,
    emit, click: choice => emit('click', { target: new Element(choice) }),
    swap: () => { controller.nonce = 'next-page-nonce'; emit('astro:page-load'); },
    admin: () => { hasBanner = false; emit('astro:page-load'); },
    rerun: () => runInNewContext(script, context),
    get stored() { return stored; },
    get reloads() { return reloads; },
    get pageViews() { return (window.dataLayer || []).filter(event => event[0] === 'event' && event[1] === 'page_view'); }
  };
}

test('unanswered and declined consent never load analytics, including navigation', () => {
  for (const stored of [null, 'denied', 'invalid']) {
    const browser = browserHarness(stored);
    browser.swap();
    assert.equal(browser.scripts.length, 0);
    assert.equal(browser.pageViews.length, 0);
    assert.equal(browser.banner.hidden, stored === 'denied');
    browser.click('denied');
    browser.swap();
    assert.equal(browser.stored, 'denied');
    assert.equal(browser.scripts.length, 0);
  }
});

test('acceptance after navigation uses the current nonce and tracks each page once', () => {
  const browser = browserHarness();
  browser.swap();
  browser.click('granted');
  assert.equal(browser.scripts.length, 1);
  assert.equal(browser.scripts[0].nonce, 'next-page-nonce');
  assert.equal(browser.pageViews.length, 1);
  browser.rerun();
  browser.swap();
  assert.equal(browser.pageViews.length, 2);
  assert.equal(browser.scripts.length, 1);
  browser.click('preferences');
  assert.equal(browser.banner.hidden, false);
  browser.click('granted');
  assert.equal(browser.pageViews.length, 2);
  browser.admin();
  assert.equal(browser.pageViews.length, 2);
});

test('saved acceptance has no automatic page view before astro:page-load', () => {
  const browser = browserHarness('granted');
  assert.equal(browser.scripts.length, 1);
  assert.equal(browser.pageViews.length, 0);
  const config = browser.window.dataLayer.find(event => event[0] === 'config');
  assert.equal(config[2].send_page_view, false);
  browser.swap();
  assert.equal(browser.pageViews.length, 1);
});

test('withdrawal disables analytics, clears parent-domain cookies, and preserves the session', () => {
  const browser = browserHarness('granted');
  browser.click('denied');
  assert.equal(browser.stored, 'denied');
  assert.equal(browser.window['ga-disable-G-BLR72SL0L6'], true);
  assert.equal(browser.reloads, 1);
  assert.ok(browser.cookies.some(value => value.includes('domain=orboro.net')));
  assert.ok(browser.cookies.every(value => !value.startsWith('orboro_session')));
  const last = browser.window.dataLayer.at(-1);
  assert.equal(last[2].analytics_storage, 'denied');
});

test('storage restrictions preserve choices during client navigation', () => {
  const browser = browserHarness(null, true);
  browser.click('granted');
  browser.swap();
  assert.equal(browser.scripts.length, 1);
  assert.equal(browser.banner.hidden, true);
  browser.click('denied');
  assert.equal(browser.reloads, 1);
});

test('withdrawal in another tab stops this tab too', () => {
  const browser = browserHarness('granted');
  browser.emit('storage', { key: 'orboro-analytics-consent', newValue: 'denied' });
  assert.equal(browser.reloads, 1);
  assert.equal(browser.window['ga-disable-G-BLR72SL0L6'], true);
});

const SECRET_URL = 'https://www.orboro.net/blog/post?token=SECRET&email=a@b.c#access_token=SECRET';

test('page views send only origin and pathname, never query or fragment', () => {
  const browser = browserHarness('granted', false, SECRET_URL, 'https://www.orboro.net/search?q=SECRET#frag=SECRET');
  browser.swap();
  const [, , params] = browser.pageViews[0];
  assert.equal(params.page_location, 'https://www.orboro.net/blog/post');
  assert.equal(params.page_referrer, 'https://www.orboro.net/search');
  assert.equal(params.page_path, '/blog/post');
  const config = browser.window.dataLayer.find(event => event[0] === 'config');
  assert.equal(config[2].page_location, 'https://www.orboro.net/blog/post');
  assert.equal(config[2].page_referrer, 'https://www.orboro.net/search');
  assert.ok(!JSON.stringify([...browser.window.dataLayer].map(e => [...e])).includes('SECRET'));
  assert.ok(browser.scripts.every(script => !script.src.includes('SECRET')));
});

test('client navigation uses the previous minimized page as referrer', () => {
  const browser = browserHarness('granted', false, SECRET_URL);
  browser.swap();
  browser.context.location.href = 'https://www.orboro.net/about?x=SECRET';
  browser.context.location.pathname = '/about';
  browser.swap();
  const params = browser.pageViews[1][2];
  assert.equal(params.page_location, 'https://www.orboro.net/about');
  assert.equal(params.page_referrer, 'https://www.orboro.net/blog/post');
});

test('admin, login and auth routes never load or send analytics', () => {
  for (const path of ['/admin', '/admin/', '/admin/content/1?token=SECRET', '/api/auth/login']) {
    const browser = browserHarness('granted', false, `https://www.orboro.net${path}`);
    browser.swap();
    assert.equal(browser.scripts.length, 0, path);
    assert.equal(browser.pageViews.length, 0, path);
    assert.equal(browser.banner.hidden, true, path);
    browser.click('granted');
    assert.equal(browser.pageViews.length, 0, path);
  }
  const lookalike = browserHarness('granted', false, 'https://www.orboro.net/administration');
  lookalike.swap();
  assert.equal(lookalike.pageViews.length, 1);
});

test('login page is rendered without the consent banner', () => {
  const login = readFileSync(new URL('../src/pages/admin/index.astro', import.meta.url), 'utf8');
  assert.match(login, /<BaseLayout[^>]*analytics=\{false\}/);
  const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
  assert.match(layout, /analytics && <ConsentBanner \/>/);
});
