/** Rebuild the widget offline from pinned research inputs in the project library.
 * ASSISTED_COMBAT_RESEARCH_ROOT contains manifest.json, the four Wago CSVs
 * (AssistedCombat, AssistedCombatStep, AssistedCombatRule, SpellName),
 * baseline-12-1.json (previous published payload), baseline-steps.csv and
 * baseline-rules.csv (its raw source tables), and extracted SimC source.
 * No curated guide notes or network access are used. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCsv, decodeRule, normalizeAction, parseProfile, compareSteps } from './lib/assisted-combat.mjs';

const root = process.env.ASSISTED_COMBAT_RESEARCH_ROOT
  ?? 'C:/Users/JD/Projects/orboro-net/games/world-of-warcraft/assisted-combat/source-snapshot/2026-10-29';
const read = async (name) => fs.readFile(path.join(root, name), 'utf8');
const manifest = JSON.parse(await read('manifest.json'));
const { currentBuild, simcCommit, simcDirectory, researchedAt } = manifest;
if (!/^12\.1\.5\.\d+$/.test(currentBuild) || !/^[a-f0-9]{40}$/.test(simcCommit)) throw new Error('Invalid pinned source identifiers');
const [lists, steps, rules, names, baseline, baselineSteps, baselineRules] = await Promise.all([
  ...['AssistedCombat', 'AssistedCombatStep', 'AssistedCombatRule', 'SpellName'].map(async (table) => parseCsv(await read(`${table}.${currentBuild}.csv`))),
  read('baseline-12-1.json').then(JSON.parse), read('baseline-steps.csv').then(parseCsv), read('baseline-rules.csv').then(parseCsv),
]);
const spellNames = new Map(names.map((row) => [Number(row.ID), row.Name_lang]));
const spellName = (id) => {
  return spellNames.get(id) ?? `Unresolved spell ${id}`;
};
const listBySpec = new Map(lists.map((row) => [Number(row.ChrSpecializationID), Number(row.ID)]));
if (listBySpec.size !== baseline.specs.length) throw new Error('Specialization coverage changed; review the baseline catalog');
const rulesByStep = new Map();
for (const row of rules) {
  const rule = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
  const id = rule.AssistedCombatStepID;
  if (!rulesByStep.has(id)) rulesByStep.set(id, []);
  rulesByStep.get(id).push(rule);
}
const stepIds = new Set(steps.map((step) => Number(step.ID)));
if (rules.some((rule) => !stepIds.has(Number(rule.AssistedCombatStepID)))) throw new Error('Orphan rule');
if (new Set(rules.map((rule) => rule.ID)).size !== rules.length) throw new Error('Duplicate rule ID');
// Canonical shape excludes row IDs: changing a row's ID alone does not change
// behavior. Rule order, condition type and all values do affect the comparison.
const canonicalRules = (rows) => rows.map((rule) => [rule.OrderIndex, rule.ConditionType, rule.ConditionValue1, rule.ConditionValue2, rule.ConditionValue3, rule.Field_11_1_7_60520_002]);
const profileDir = path.join(root, simcDirectory, 'profiles', 'MID2');
const profileFiles = (await fs.readdir(profileDir)).filter((file) => file.endsWith('.simc')).sort();
const profiles = await Promise.all(profileFiles.map(async (file) => ({ file, text: await fs.readFile(path.join(profileDir, file), 'utf8') })));
const specs = baseline.specs.map((old) => {
  const assistedCombatId = listBySpec.get(old.specId);
  const currentSteps = steps.filter((step) => Number(step.AssistedCombatID) === assistedCombatId)
    .sort((a, b) => Number(a.OrderIndex) - Number(b.OrderIndex) || Number(a.ID) - Number(b.ID))
    .map((step, index) => {
      const rawRules = (rulesByStep.get(Number(step.ID)) ?? []).sort((a, b) => a.OrderIndex - b.OrderIndex || a.ID - b.ID);
      return { priority: index + 1, action: spellName(Number(step.SpellID)), spellId: Number(step.SpellID),
        condition: rawRules.map((rule) => decodeRule(rule, spellName) + (rule.Field_11_1_7_60520_002 ? ` [undecoded field=${rule.Field_11_1_7_60520_002}; interpretation uncertain]` : '')).join('; ') || 'No explicit conditions',
        stepId: Number(step.ID), orderIndex: Number(step.OrderIndex),
        automationOnly: rawRules.some((rule) => rule.ConditionType === 70), rules: canonicalRules(rawRules) };
    });
  if (!currentSteps.length) throw new Error(`Empty APL: ${old.gameClass} ${old.spec}`);
  const oldSteps = old.steps.map((step) => {
    const source = baselineSteps.find((row) => Number(row.ID) === step.stepId);
    if (!source || Number(source.SpellID) !== step.spellId) throw new Error(`Baseline mismatch ${step.stepId}`);
    const rows = baselineRules.filter((row) => Number(row.AssistedCombatStepID) === step.stepId)
      .map((row) => Object.fromEntries(Object.entries(row).map(([key,value]) => [key,Number(value)])))
      .sort((a,b) => a.OrderIndex - b.OrderIndex || a.ID - b.ID);
    return { ...step, orderIndex: Number(source.OrderIndex), rules: canonicalRules(rows) };
  });
  const prefix = `MID2_${old.gameClass.replaceAll(' ', '_')}_${old.spec.replaceAll(' ', '_')}`;
  const parsed = profiles.filter(({ file }) => file === `${prefix}.simc` || file.startsWith(`${prefix}_`))
    .map(({ file, text }) => ({ file, ...parseProfile(text, old.gameClass) }));
  const simcActions = [...new Set(parsed.flatMap((profile) => profile.actions))].sort();
  const blizzardActions = [...new Set(currentSteps.map((step) => normalizeAction(step.action)))].sort();
  const shared = blizzardActions.filter((action) => simcActions.includes(action));
  const comparable = !['Healer', 'Support DPS'].includes(old.role) && parsed.length > 0;
  const overlap = comparable ? Math.round(100 * shared.length / blizzardActions.length) : null;
  return { gameClass: old.gameClass, spec: old.spec, specId: old.specId, assistedCombatId, role: old.role,
    steps: currentSteps, simcComparable: comparable, overlap,
    simcCoverage: comparable ? Math.round(100 * shared.length / simcActions.length) : null,
    sharedActionCount: shared.length, blizzardActionCount: blizzardActions.length, simcActionCount: simcActions.length,
    alignment: !comparable ? 'Not comparable' : overlap >= 75 ? 'High literal overlap' : overlap >= 50 ? 'Moderate literal overlap' : 'Low literal overlap',
    simcProfiles: parsed.map((profile) => profile.file), simcActionLines: parsed.map((profile) => profile.entries),
    usesSeason2SimcProfile: comparable, simcActions, blizzardActions,
    blizzardOnlyActions: blizzardActions.filter((action) => !simcActions.includes(action)),
    missingActions: comparable ? simcActions.filter((action) => !blizzardActions.includes(action)) : [],
    missingLogic: comparable ? [...new Set(parsed.flatMap((profile) => profile.logic))].sort() : [],
    comparisonLimitation: comparable ? [] : ['No comparable optimized MID2 reference profile is published for this role/spec in the pinned SimulationCraft snapshot.'],
    changes: compareSteps(oldSteps, currentSteps),
  };
});
if (specs.reduce((sum, spec) => sum + spec.steps.length, 0) !== steps.length) throw new Error('Unassigned or duplicate steps');
const comparable = specs.filter((spec) => spec.simcComparable);
const median = (values) => { const v = values.sort((a,b) => a-b); return Math.round((v[Math.floor((v.length-1)/2)] + v[Math.floor(v.length/2)]) / 2); };
const payload = { researchedAt, verifiedAt: researchedAt, currentBuild, sourceBuild: currentBuild,
  baselineBuild: baseline.currentBuild, baselineSourceBuild: baseline.sourceBuild, simcBranch: 'midnight', simcCommit,
  ruleColumns: ['OrderIndex','ConditionType','ConditionValue1','ConditionValue2','ConditionValue3','Field_11_1_7_60520_002'],
  summary: { specs: specs.length, classes: new Set(specs.map((spec) => spec.gameClass)).size,
    comparableSpecs: comparable.length, medianOverlap: median(comparable.map((spec) => spec.overlap)),
    medianSimcCoverage: median(comparable.map((spec) => spec.simcCoverage)), currentSteps: steps.length, currentRules: rules.length,
    simcActionLines: comparable.reduce((sum, spec) => sum + spec.simcActionLines[0], 0),
    comparableBlizzardSteps: comparable.reduce((sum, spec) => sum + spec.steps.length, 0),
    changedSpecs: specs.filter((spec) => spec.changes.changed).length,
    baselineSteps: baseline.summary.currentSteps, baselineRules: baseline.summary.currentRules,
    profileCount: comparable.reduce((sum, spec) => sum + spec.simcProfiles.length, 0) },
  commonOmissions: ['Action overlap measures spell vocabulary, not damage or rotation quality.',
    'SimC profiles model selected talents and gear; generic Blizzard fallback actions may lower literal overlap.',
    'Named lists, variables and target selectors describe SimC structure; they do not prove Blizzard lacks every equivalent decision.',
    'Tank lists are not complete mitigation plans; healer damage lists are not healing rotations.'],
  sources: { wagoCurrent: `https://wago.tools/db2/AssistedCombat?build=${currentBuild}`,
    simc: `https://github.com/simulationcraft/simc/tree/${simcCommit}/profiles/MID2`,
    simcDocs: 'https://github.com/simulationcraft/simc/wiki/ActionLists',
    decoder: `https://github.com/simulationcraft/simc/blob/${simcCommit}/engine/player/player.cpp`,
    patchNotes: 'https://worldofwarcraft.blizzard.com/en-us/news/24304162',
    hotfixes: 'https://worldofwarcraft.blizzard.com/en-us/news/24307310' }, specs };
// Keep raw integer tuples on one line so the generated rule data is reviewable.
const serialized = JSON.stringify(payload,null,2).replace(/\[\n\s+(-?\d+(?:,\n\s+-?\d+)*)\n\s+\]/g,
  (_,values) => `[${values.replace(/,\n\s+/g,', ')}]`);
await fs.writeFile(path.resolve(import.meta.dirname, '../src/lib/assisted-combat-data.json'), serialized + '\n');
console.log(JSON.stringify(payload.summary, null, 2));
