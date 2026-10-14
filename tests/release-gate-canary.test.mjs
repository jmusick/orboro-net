// Deliberately failing test for issue #14: proves the master ruleset blocks a PR whose Release gate fails.
// Throwaway; this branch is never merged.
import { test } from "node:test";
import assert from "node:assert/strict";

test("release gate canary fails on purpose", () => {
  assert.equal(1, 2);
});
