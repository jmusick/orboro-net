/** Validate the complete external benchmark set before emitting website data.
 * Run scripts/run-assisted-combat-sims.mjs first. Partial/smoke results fail.
 * Raw profiles and reports remain in the project library. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateRun, compareRuns } from './lib/assisted-combat-sims.mjs';

const root = process.env.ASSISTED_COMBAT_RESEARCH_ROOT ?? 'C:/Users/JD/Projects/orboro-net/games/world-of-warcraft/assisted-combat/source-snapshot/2026-10-29';
const directory = path.join(root,'sim-results');
const methodology = JSON.parse(await fs.readFile(path.join(directory,'methodology.json'),'utf8'));
const data = JSON.parse(await fs.readFile(new URL('../src/lib/assisted-combat-data.json',import.meta.url),'utf8'));
if (methodology.simcCommit !== data.simcCommit || methodology.build !== data.currentBuild || methodology.settings.iterations !== 10000) throw new Error('Benchmark/research provenance mismatch');
const rows = [], hashes = {}, warnings = new Set();
let hotfix, latestTimestamp = 0;
for (const spec of data.specs.filter((spec) => spec.simcComparable)) {
  const results = [];
  for (const targets of [1,2,3,5]) {
    const runs = {};
    for (const apl of ['simc','blizzard']) {
      const name = `${spec.specId}-${targets}t-${apl}`;
      const raw = await fs.readFile(path.join(directory,name+'.json'));
      hashes[name+'.json'] = crypto.createHash('sha256').update(raw).digest('hex');
      const actions = await fs.readFile(path.join(directory,name+'-actions.simc'),'utf8');
      if (/^actions\.assisted_combat[+=]/m.test(actions) !== (apl === 'blizzard')) throw new Error(`Wrong exported APL for ${name}`);
      for (const suffix of ['.simc','-actions.simc']) {
        const bytes = await fs.readFile(path.join(directory,name+suffix));
        hashes[name+suffix] = crypto.createHash('sha256').update(bytes).digest('hex');
      }
      const run = validateRun(JSON.parse(raw.toString()),{...methodology,targets,specialization:`${spec.spec} ${spec.gameClass}`});
      for (const warning of run.warnings) warnings.add(`${warning.level}: ${warning.message}`);
      latestTimestamp = Math.max(latestTimestamp,run.timestamp);
      if (hotfix && JSON.stringify(hotfix) !== JSON.stringify(run.hotfix)) throw new Error('Mixed hotfix snapshots in benchmark set');
      hotfix = run.hotfix;
      runs[apl] = run;
    }
    results.push({ targets,...compareRuns(runs.simc,runs.blizzard) });
  }
  const profile = `MID2_${spec.gameClass.replaceAll(' ','_')}_${spec.spec.replaceAll(' ','_')}.simc`;
  if (!spec.simcProfiles.includes(profile)) throw new Error(`Missing primary profile ${profile}`);
  const unmodeledRuleFields = spec.steps.reduce((sum,step) => sum + step.rules.filter((rule) => rule[5] !== 0).length,0);
  rows.push({specId:spec.specId,gameClass:spec.gameClass,spec:spec.spec,role:spec.role,profile,unmodeledRuleFields,results});
}
const payload = {...methodology,hotfix,completedAt:new Date(latestTimestamp*1000).toISOString(),
  runCount:rows.reduce((sum,row) => sum+row.results.length*2,0),warnings:[...warnings].sort(),rows};
await fs.writeFile(new URL('../src/lib/assisted-combat-sims.json',import.meta.url),JSON.stringify(payload,null,2)+'\n');
await fs.writeFile(path.join(directory,'report-sha256.json'),JSON.stringify(hashes,null,2)+'\n');
const csv = ['Class,Spec,Profile,Targets,SimC DPS,Blizzard DPS,Change percent,Approximate 95% uncertainty pp'];
for(const row of rows) for(const r of row.results) csv.push([row.gameClass,row.spec,row.profile,r.targets,r.simcDps,r.blizzardDps,r.changePct,r.uncertaintyPp].join(','));
await fs.writeFile(path.join(directory,'comparison.csv'),csv.join('\n')+'\n');
console.log(`Validated ${payload.runCount} runs for ${rows.length} specs.`);
