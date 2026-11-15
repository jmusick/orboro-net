import assert from "node:assert/strict";
import { test } from "node:test";
import { initBlogControls, type BlogControlsState, type ControlsDocument } from "../src/scripts/blog-controls.ts";

function page() {
  const listeners = new Map<string, () => void>();
  const classes = new Set<string>();
  let submits = 0;
  let focused = 0;
  const sort = {
    addEventListener(name: string, fn: () => void) { listeners.set(name, fn); },
    focus() { focused++; },
  };
  const form = {
    dataset: {} as Record<string, string>,
    classList: { add: (c: string) => classes.add(c) },
    querySelector: (sel: string) => (sel === "#blog-sort" ? sort : null),
    requestSubmit() { submits++; },
  };
  const doc = { querySelector: (sel: string) => (sel === "form.blog-controls" ? form : null) };
  return {
    doc, form, classes,
    change: () => listeners.get("change")?.(),
    get submits() { return submits; },
    get focused() { return focused; },
  };
}

test("enhances the form once and hides Apply via a class", () => {
  const p = page();
  const state: BlogControlsState = { refocusSort: false };
  assert.equal(initBlogControls(p.doc, state), true);
  assert.equal(initBlogControls(p.doc, state), false);
  assert.ok(p.classes.has("is-enhanced"));
  assert.equal(p.form.dataset.blogControlsInit, "1");
  assert.equal(p.focused, 0);
});

test("changing the sort submits and refocuses the sort on the next page", () => {
  const state: BlogControlsState = { refocusSort: false };
  const first = page();
  initBlogControls(first.doc, state);
  first.change();
  assert.equal(first.submits, 1);
  assert.equal(state.refocusSort, true);

  const next = page();
  initBlogControls(next.doc, state);
  assert.equal(next.focused, 1);
  assert.equal(state.refocusSort, false);
});

test("a pending refocus is dropped on pages without blog controls", () => {
  const state: BlogControlsState = { refocusSort: true };
  const empty: ControlsDocument = { querySelector: () => null };
  assert.equal(initBlogControls(empty, state), false);
  assert.equal(state.refocusSort, false);
});
