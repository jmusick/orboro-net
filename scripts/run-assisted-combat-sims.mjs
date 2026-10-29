/** Paired APL benchmark. Writes profiles, logs and json2 reports to the external
 * project library. Use --smoke before a full run; --spec=254 selects one spec.
 * SIMC_EXE and ASSISTED_COMBAT_RESEARCH_ROOT override local paths.
 * No website data is published until the complete result set is validated. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const selectedId = args.find((arg) => arg.startsWith('--spec='))?.split('=')[1];
if (args.some((arg) => arg !== '--smoke' && !/^--spec=\d+$/.test(arg))) throw new Error('Unknown argument');
const root = process.env.ASSISTED_COMBAT_RESEARCH_ROOT ?? 'C:/Users/JD/Projects/orboro-net/games/world-of-warcraft/assisted-combat/source-snapshot/2026-10-29';
const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
const data = JSON.parse(await fs.readFile(new URL('../src/lib/assisted-combat-data.json', import.meta.url), 'utf8'));
const exe = process.env.SIMC_EXE ?? path.join(root, 'nightly-windows/extracted/simc-1210.01.710c240-win64/simc.exe');
const source = path.join(root, manifest.simcDirectory);
const out = path.join(root, smoke ? 'sim-smoke' : 'sim-results');
await fs.mkdir(out, {recursive:true});
const settings = { iterations:smoke ? 10 : 10000, max_time:300, fixed_time:1,
  vary_combat_length:0, fight_style:'Patchwerk', target_error:0, threads:4,
  seed:20261029, statistics_level:1, optimal_raid:1 };
const specs = data.specs.filter((spec) => spec.simcComparable && (!selectedId || spec.specId === Number(selectedId)));
if (!specs.length) throw new Error('No matching comparable specs');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const provenance = { simcCommit:manifest.simcCommit, build:manifest.currentBuild,
  binarySha256:hash(await fs.readFile(exe)), settings, targets:[1,2,3,5],
  cooldownSupport:true, oneButtonPenalty:false, formula:'100 * (blizzardDps / simcDps - 1)' };
const provenancePath = path.join(out,'methodology.json');
try {
  if (JSON.stringify(JSON.parse(await fs.readFile(provenancePath,'utf8'))) !== JSON.stringify(provenance)) throw new Error('Existing results have different settings; use a new snapshot');
} catch(error) { if (error.code !== 'ENOENT') throw error; }
await fs.writeFile(provenancePath, JSON.stringify(provenance,null,2)+'\n');
const jobs = [];
for (const spec of specs) {
  const primary = spec.simcProfiles.find((file) => file === `MID2_${spec.gameClass.replaceAll(' ','_')}_${spec.spec.replaceAll(' ','_')}.simc`);
  if (!primary) throw new Error(`No unqualified primary profile for ${spec.specId}`);
  const original = await fs.readFile(path.join(source,'profiles/MID2',primary),'utf8');
  for (const targets of [1,2,3,5]) for (const apl of ['simc','blizzard']) {
    const id = `${spec.specId}-${targets}t-${apl}`;
    const profile = apl === 'simc' ? original : original.split(/\r?\n/).filter((line) => !/^\s*actions(?:[.+=])/.test(line)).join('\n');
    const input = path.join(out, id+'.simc'), report = path.join(out,id+'.json');
    const footer = [ ...Object.entries(settings).map(([key,value]) => `${key}=${value}`),
      `desired_targets=${targets}`, 'one_button_mode=0',
      `use_blizzard_action_list=${apl === 'blizzard' ? 1 : 0}`, 'use_cds_with_blizzard_action_list=1',
      `json2=${report.replaceAll('\\','/')}`, `save_actions=${path.join(out,id+'-actions.simc').replaceAll('\\','/')}` ];
    await fs.writeFile(input,profile+'\n'+footer.join('\n')+'\n');
    jobs.push({id,input,report,specId:spec.specId,gameClass:spec.gameClass,spec:spec.spec,primary,targets,apl});
  }
}
await fs.writeFile(path.join(out,'jobs.json'),JSON.stringify(jobs,null,2)+'\n');
let completed = 0;
async function run(job) {
  try {
    const old = JSON.parse(await fs.readFile(job.report,'utf8'));
    if (old.git_revision === manifest.simcCommit.slice(0,7)
      && old.sim?.options?.dbc?.Live?.wow_version === manifest.currentBuild
      && old.sim?.players?.[0]?.collected_data?.dps?.count >= settings.iterations - 1) {
      console.log(`resume ${++completed}/${jobs.length} ${job.id}`); return;
    }
  } catch(error) { if (!['ENOENT',undefined].includes(error.code)) throw error; }
  const result = await new Promise((resolve,reject) => {
    const child = spawn(exe,[job.input],{cwd:source,windowsHide:true});
    let output = '';
    child.stdout.on('data',(chunk) => {output += chunk;});
    child.stderr.on('data',(chunk) => {output += chunk;});
    child.on('error',reject);
    child.on('close',(code) => resolve({code,output}));
  });
  await fs.writeFile(path.join(out,job.id+'.log'),result.output);
  if (result.code !== 0) throw new Error(`${job.id} failed (${result.code}): ${result.output.slice(-1800)}`);
  const report = JSON.parse(await fs.readFile(job.report,'utf8'));
  if (!(report.sim?.players?.[0]?.collected_data?.dps?.mean > 0)) throw new Error(`${job.id}: no positive player DPS`);
  console.log(`done ${++completed}/${jobs.length} ${job.id}`);
}
// Two processes, four threads each, leave headroom on the 16-thread workstation.
let cursor = 0;
await Promise.all([0,1].map(async () => { while(cursor < jobs.length) await run(jobs[cursor++]); }));
console.log(`Completed ${jobs.length} benchmark jobs under ${out}`);
