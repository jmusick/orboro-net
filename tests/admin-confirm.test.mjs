import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const layout = readFileSync(new URL('../src/layouts/AdminLayout.astro', import.meta.url), 'utf8');
const controller = layout.match(/<script([^>]*id="admin-confirm-controller"[^>]*)>([\s\S]*?)<\/script>/);

function harness(withRouter = false) {
  const listeners = new Map();
  const prompts = [];
  class HTMLFormElement {
    constructor(message) { this.dataset = message === undefined ? {} : { confirm: message }; }
  }
  let navigations = 0;
  const document = { addEventListener(name, listener, options = {}) {
    const handlers = listeners.get(name) || [];
    handlers.push({ listener, capture: options === true || options.capture === true });
    listeners.set(name, handlers);
  } };
  const window = { confirm(message) { prompts.push(message); return window.approved; }, approved: false };
  const context = { document, window, HTMLFormElement };
  const run = () => runInNewContext(controller[2], context);
  const emit = (name, event = {}) => {
    const handlers = listeners.get(name) || [];
    for (const capture of [true, false]) {
      handlers.filter(handler => handler.capture === capture).forEach(({ listener }) => listener(event));
    }
  };
  // Public ClientRouter may already be installed before navigating into admin.
  if (withRouter) document.addEventListener('submit', event => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    navigations++;
  });
  run();
  return { window, prompts, listeners, run, emit, get navigations() { return navigations; }, submit(message, defaultPrevented = false) {
    const event = { target: new HTMLFormElement(message), defaultPrevented, preventDefault() { this.defaultPrevented = true; } };
    emit('submit', event);
    return event;
  } };
}

test('admin confirmation controller is explicitly nonce-authorized', () => {
  assert.match(controller[1], /is:inline/);
  assert.match(controller[1], /nonce=\{Astro.locals.nonce\}/);
});

test('cancel blocks submission while approval preserves the native submit', () => {
  const browser = harness();
  assert.equal(browser.submit('Delete this item?').defaultPrevented, true);
  browser.window.approved = true;
  assert.equal(browser.submit('Delete this item?').defaultPrevented, false);
  assert.deepEqual(browser.prompts, ['Delete this item?', 'Delete this item?']);
  browser.submit();
  browser.submit('Already canceled', true);
  browser.emit('submit', { target: {}, defaultPrevented: false });
  assert.equal(browser.prompts.length, 2);
});

test('navigation and repeated controller execution prompt once for new forms', () => {
  const browser = harness();
  browser.emit('astro:page-load');
  browser.run();
  browser.emit('astro:page-load');
  assert.equal(browser.listeners.get('submit').length, 1);
  assert.equal(browser.submit('New page delete').defaultPrevented, true);
  assert.deepEqual(browser.prompts, ['New page delete']);
});

test('all three delete forms declare confirmation without inline handlers', () => {
  for (const [path, action] of [
    ['categories/[id].astro', 'categories'],
    ['media/index.astro', 'media'],
    ['content/[id].astro', 'content']
  ]) {
    const source = readFileSync(new URL(`../src/pages/admin/${path}`, import.meta.url), 'utf8');
    const form = source.match(new RegExp(`<form[^>]*action="/api/${action}/delete"[^>]*>`))[0];
    assert.match(form, /data-confirm="[^"]+"/);
    assert.doesNotMatch(form, /onsubmit=/);
    assert.match(form, /method="post"/);
  }
});


test('confirmation precedes a persistent ClientRouter bubble listener', () => {
  const browser = harness(true);
  browser.submit('Delete this item?');
  assert.equal(browser.navigations, 0);
  assert.deepEqual(browser.prompts, ['Delete this item?']);
  browser.window.approved = true;
  browser.submit('Delete this item?');
  assert.equal(browser.navigations, 1);
  assert.equal(browser.prompts.length, 2);
  browser.submit();
  assert.equal(browser.navigations, 2);
});
