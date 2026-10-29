import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRun, compareRuns } from '../scripts/lib/assisted-combat-sims.mjs';
import { renderSimulationPanel, renderSimulationOverview } from '../src/lib/assisted-combat-render.js';

const expected = { simcCommit:'1234567890123456789012345678901234567890', build:'12.1.5.70575', targets:1,
  settings:{iterations:10000,threads:4,max_time:300,fixed_time:1,fight_style:'Patchwerk',seed:42} };
function report(mean=1000) {
  return { git_revision:'1234567',timestamp:'2026-10-29', sim:{options:{iterations:10003,threads:4,max_time:300,fixed_time:true,
    fight_style:'Patchwerk',seed:42,desired_targets:1,dbc:{version_used:'Live',Live:{wow_version:expected.build}}},
    players:[{gear:{head:{id:1}},talents:'abc',race:'dwarf',level:90,role:'attack',specialization:'test',
      collected_data:{dps:{mean,count:9999,mean_std_dev:1},fight_length:{min:300,max:300},deaths:{count:0}}}] } };
}
test('simulation validation rejects smoke runs, wrong builds, targets, fight styles and player deaths', () => {
  assert.equal(validateRun(report(),expected).dps.mean,1000);
  for (const mutate of [r=>r.sim.options.iterations=13,r=>r.git_revision='7654321',r=>r.sim.options.desired_targets=5,
    r=>r.sim.options.fight_style='HecticAddCleave',r=>r.sim.options.dbc.version_used='PTR',
    r=>r.sim.players[0].collected_data.deaths.count=1]) {
    const r=report();mutate(r);assert.throws(()=>validateRun(r,expected));
  }
});
test('paired results reject gear and talent differences and preserve gains as well as losses', () => {
  const baseline=validateRun(report(),expected), lower=validateRun(report(900),expected), higher=validateRun(report(1100),expected);
  assert.ok(Math.abs(compareRuns(baseline,lower).changePct+10)<1e-10);
  assert.ok(Math.abs(compareRuns(baseline,higher).changePct-10)<1e-10);
  assert.ok(compareRuns(baseline,lower).uncertaintyPp>0);
  lower.player.talents='different';assert.throws(()=>compareRuns(baseline,lower),/talents/);
  lower.player.talents='abc';lower.player.gear={};assert.throws(()=>compareRuns(baseline,lower),/gear/);
});
test('simulation tables show both DPS values and signed changes without inferring unavailable results', () => {
  const result={targets:1,...compareRuns(validateRun(report(),expected),validateRun(report(900),expected))};
  const data={simcCommit:expected.simcCommit,hotfix:{wow_version:expected.build,hotfix_date:'2026-10-28'},warnings:['<unsafe>'],
    rows:[{specId:1,spec:'Example',gameClass:'Test',profile:'MID2_Test_Example.simc',unmodeledRuleFields:2,results:[result]}]};
  const html=renderSimulationPanel({specId:1},data);
  assert.match(html,/-10\.00%/);assert.match(html,/1,000/);assert.match(html,/900/);
  assert.match(html,/scope="col"/);assert.match(html,/percentage points/);
  assert.match(html,/2 undocumented DB2 field values/);
  assert.match(renderSimulationPanel({specId:2},data),/No paired simulation/);
  const overview=renderSimulationOverview(data);
  assert.match(overview,/&lt;unsafe&gt;/);assert.doesNotMatch(overview,/<unsafe>/);
});
