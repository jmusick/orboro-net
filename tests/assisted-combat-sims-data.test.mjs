import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => JSON.parse(fs.readFileSync(new URL('../src/lib/'+file,import.meta.url)));
const research = read('assisted-combat-data.json');
const benchmark = read('assisted-combat-sims.json');

test('published benchmark covers every comparable spec and target count with current full-run provenance', () => {
  const specs = research.specs.filter((spec) => spec.simcComparable);
  assert.equal(benchmark.build,research.currentBuild);
  assert.equal(benchmark.simcCommit,research.simcCommit);
  assert.equal(benchmark.settings.iterations,10000);
  assert.equal(benchmark.cooldownSupport,true);
  assert.equal(benchmark.oneButtonPenalty,false);
  assert.equal(benchmark.runCount,specs.length*4*2);
  assert.deepEqual(benchmark.rows.map((row) => row.specId),specs.map((spec) => spec.specId));
  for (const row of benchmark.rows) {
    const spec = specs.find((spec) => spec.specId === row.specId);
    assert.ok(spec.simcProfiles.includes(row.profile));
    assert.deepEqual(row.results.map((result) => result.targets),[1,2,3,5]);
    assert.equal(row.unmodeledRuleFields,spec.steps.reduce((sum,step) => sum+step.rules.filter((rule) => rule[5] !== 0).length,0));
    for (const result of row.results) {
      assert.ok(result.simcDps>0 && result.blizzardDps>0);
      assert.equal(result.simcSamples,benchmark.settings.iterations-1);
      assert.equal(result.blizzardSamples,benchmark.settings.iterations-1);
      assert.ok(Number.isFinite(result.changePct) && result.uncertaintyPp>=0);
    }
  }
});
