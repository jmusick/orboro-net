import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const layout = readFileSync(new URL('../src/layouts/AdminLayout.astro', import.meta.url), 'utf8');
const controller = layout.match(/<script([^>]*id="admin-confirm-controller"[^>]*)>([\s\S]*?)<\/script>/);

function harness() {
  const listeners = new Map();
  const prompts = [];
  class HTMLFormElement {
    constructor(message) { this.dataset = message === undefined ? {} : { confirm: message }; }
  }
  const document = { addEventListener(name, listener) {
    const handlers = listeners.get(name) || [];
    handlers.push(listener);
    listeners.set(name, handlers);
  } };
  const window = { confirm(message) { prompts.push(message); return window.approved; }, approved: false };
  const context = { document, window, HTMLFormElement };
  const run = () => runInNewContext(controller[2], context);
  const emit = (name, event = {}) => (listeners.get(name) || []).forEach(fn => fn(event));
  run();
  return { window, prompts, listeners, run, emit, submit(message, defaultPrevented = false) {
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
