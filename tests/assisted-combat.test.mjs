import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCsv, decodeRule, parseProfile, compareSteps } from '../scripts/lib/assisted-combat.mjs';
import { DETAIL_TABS, defaultState, renderDetail, searchHaystack } from '../src/lib/assisted-combat-render.js';

const data = JSON.parse(fs.readFileSync(new URL('../src/lib/assisted-combat-data.json', import.meta.url)));

test('CSV retains commas, escaped quotes and multiline cells, including BOM and final row', () => {
  assert.deepEqual(parseCsv('\uFEFFID,Name\r\n1,"a, b"\r\n2,"a ""quote""\nnext"'), [
    { ID: '1', Name: 'a, b' }, { ID: '2', Name: 'a "quote"\nnext' },
  ]);
  assert.throws(() => parseCsv('ID,Name\n1,"broken'), /Unterminated/);
  assert.throws(() => parseCsv('ID,Name\n1,2,3'), /column count/);
});

test('rule decoder preserves aura alternatives and resource units from SimC', () => {
  const rule = (type,a,b=0,c=0) => ({ ConditionType:type, ConditionValue1:a, ConditionValue2:b, ConditionValue3:c });
  const name = (id) => `Spell ${id}`;
  assert.match(decodeRule(rule(9,100,200,100), name), /Spell 100 \[100\] or Spell 200 \[200\]$/);
  assert.match(decodeRule(rule(43,4500), name), /Insanity ≥ 45$/);
  assert.match(decodeRule(rule(31,800), name), /Runic power ≥ 80$/);
  assert.match(decodeRule(rule(18,100,5000), name), /≤ 5s remaining/);
  assert.match(decodeRule(rule(70,0), name), /automation-only/);
  assert.throws(() => decodeRule(rule(71,0), name), /Unknown/);
});

test('SimC parser excludes control commands and racials but retains conditional actions', () => {
  const parsed = parseProfile(`actions=call_action_list,name=aoe
actions.aoe+=/variable,name=test,value=active_enemies
actions.aoe+=/multi_shot,if=talent.test&buff.test.up
actions.aoe+=/multi_shot,target_if=min:dot.test.remains
actions.aoe+=/pool_resource
actions.racials+=/blood_fury
# actions+=/fake_action
actions+=/potion`, 'Hunter');
  assert.deepEqual(parsed.actions, ['multi_shot']);
  assert.equal(parsed.entries, 2);
  assert.ok(parsed.logic.includes('Target selection or target cycling'));
  assert.ok(parsed.logic.includes('Computed variables'));
  assert.ok(parsed.logic.includes('Explicit resource pooling'));
});

test('patch comparison ignores readable labels and detects raw rule and order changes', () => {
  const step = { stepId:1, spellId:2, action:'Test', orderIndex:0, rules:[[0,9,100,0,0,0]] };
  assert.equal(compareSteps([step], [{...step, condition:'new label'}]).changed, false);
  assert.equal(compareSteps([step], [{...step, rules:[[0,9,200,0,0,0]]}]).changed, true);
  assert.equal(compareSteps([step], [{...step, orderIndex:1}]).changed, true);
  assert.deepEqual(compareSteps([step], []).removed, ['Test']);
});

test('generated scores, totals and missing actions agree with the published action sets', () => {
  let steps = 0, rules = 0;
  for (const spec of data.specs) {
    steps += spec.steps.length;
    rules += spec.steps.reduce((sum, step) => sum + step.rules.length, 0);
    if (!spec.simcComparable) {
      assert.equal(spec.overlap, null);
      assert.equal(spec.simcCoverage, null);
      continue;
    }
    const shared = spec.blizzardActions.filter((a) => spec.simcActions.includes(a));
    assert.equal(spec.overlap, Math.round(100 * shared.length / spec.blizzardActions.length));
    assert.equal(spec.simcCoverage, Math.round(100 * shared.length / spec.simcActions.length));
    assert.deepEqual(spec.missingActions, spec.simcActions.filter((a) => !spec.blizzardActions.includes(a)));
    assert.ok(spec.simcProfiles.every((file) => file.startsWith('MID2_')));
    assert.equal(spec.simcProfiles.length, spec.simcActionLines.length);
  }
  assert.equal(steps, data.summary.currentSteps);
  assert.equal(rules, data.summary.currentRules);
  assert.equal(data.summary.comparableSpecs, data.specs.filter((s) => s.simcComparable).length);
  assert.equal(new Set(data.specs.map((s) => s.specId)).size, data.specs.length);
});

test('shared server/client renderer has only Blizzard and SimC sections and pinned profile links', () => {
  assert.deepEqual(DETAIL_TABS.map(([id]) => id), ['missing', 'apl', 'sims']);
  const spec = data.specs.find((s) => s.simcComparable);
  const html = renderDetail(spec, data, defaultState(data));
  assert.doesNotMatch(html + JSON.stringify(data), /Icy Veins|icyRating|icySummary|icyUrl/i);
  assert.match(html, new RegExp(data.simcCommit));
  assert.match(html, /data-panel="apl"/);
  assert.ok(searchHaystack(spec).includes(spec.spec.toLowerCase()));
  const unsafe = {...spec, spec:'<script>alert(1)</script>', missingActions:['<img onerror=oops>']};
  assert.doesNotMatch(renderDetail(unsafe, data, defaultState(data)), /<script>|<img onerror/);
});
