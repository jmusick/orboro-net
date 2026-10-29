/** Pure parsers shared by the offline data generator and its tests. */
export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r' && c !== '\uFEFF') field += c;
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => {
    if (r.length !== header.length) throw new Error('CSV column count mismatch');
    return Object.fromEntries(header.map((key, i) => [key, r[i]]));
  });
}

// Follow the pinned SimC evaluator, which marks some boundaries uncertain.
// Raw values accompany every rule so readable labels never replace evidence.
export function decodeRule(rule, spellName) {
  const t = rule.ConditionType, a = rule.ConditionValue1, b = rule.ConditionValue2, c = rule.ConditionValue3;
  const name = (id) => `${spellName(id)} [${id}]`;
  const action = [0,1,2,14,56].includes(t) && a ? name(a) : 'action';
  if (t === 0) return `${action} is learned`;
  if (t === 1 || t === 2) return `${action} is ${t === 1 ? 'on' : 'off'} cooldown`;
  if (t === 3 || t === 4) return `target distance ${t === 3 ? '≤' : '>'} ${a} yd`;
  if (t === 5 || t === 6) return `target is ${t === 5 ? 'hostile' : 'friendly'}`;
  if (t === 7 || t === 8) return `target health ${t === 7 ? '≥' : '≤'} ${a}%`;
  if (t === 9) return `player has any of: ${[...new Set([a,b,c].filter(Boolean))].map(name).join(' or ')}`;
  if (t === 10) return `target has ${name(a)}`;
  if ([11,12,49,50].includes(t)) return `enemies within ${b} yd of ${[11,49].includes(t) ? 'target' : 'player'} ${t < 49 ? '>' : '≤'} ${a}`;
  if (t === 13 || t === 51) return `nearby targets with ${name(c)} ${t === 13 ? '≥' : '≤'} ${a} (radius ${b} yd; decoder uncertain)`;
  if (t === 14) return `${action} cost is affordable`;
  if (t === 15 || t === 16) return `${t === 15 ? 'target' : 'player'} is missing ${name(a)}`;
  if (t === 17 || t === 18) return `${t === 17 ? 'player has' : 'target'} ${name(a)} with ≤ ${b / 1000}s remaining`;
  if (t >= 19 && t <= 48) {
    const resources = ['Mana','Rage','Focus','Energy','Combo points','Runes','Runic power','Soul shards','Astral power','Holy power','Maelstrom','Chi','Insanity','Essence','Arcane charges'];
    const i = Math.floor((t - 19) / 2), divisor = [0,1,6,7,8].includes(i) ? 10 : i === 12 ? 100 : 1;
    return `${resources[i]} ${t % 2 ? '≥' : '≤'} ${a / divisor}${i === 0 ? '%' : ''}`;
  }
  if (t >= 52 && t <= 55) return `${t < 54 ? 'target' : 'player'} ${name(a)} stacks ${t % 2 ? '≤' : '≥'} ${b}`;
  if (t === 56) return `${action} is in range`;
  if (t === 57 || t === 58) return `player has ${t === 58 ? 'no ' : ''}active pet`;
  if (t >= 59 && t <= 62) return `${t < 61 ? 'Fury' : 'Pain'} ${t % 2 ? '≥' : '≤'} ${a}`;
  if (t === 63 || t === 64) return `action charges ${t === 63 ? '≥' : '≤'} ${a}${b ? ` (raw second value ${b}; SimC ignores it)` : ''}`;
  if (t === 65 || t === 66) return `${name(a)} cooldown remaining ${t === 65 ? '≥' : '≤'} ${b / 1000}s`;
  if (t === 67) return 'allow recommendation while casting';
  if (t === 68 || t === 69) return `player health ${t === 68 ? '≥' : '≤'} ${a}%`;
  if (t === 70) return 'automation-only (excluded from Assisted Highlight)';
  throw new Error(`Unknown AssistedCombat condition type ${t}`);
}

const ALIASES = { any_dnd: 'death_and_decay', death_s_due: 'death_and_decay', fire_blast_2: 'fire_blast', frostbolt_2: 'frostbolt', metamorphosis_havoc: 'metamorphosis', metamorphosis_vengeance: 'metamorphosis', multishot: 'multi_shot', swipe_bear: 'swipe', swipe_cat: 'swipe', wildfire_bomb_2: 'wildfire_bomb' };
export function normalizeAction(value) {
  const token = value.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return ALIASES[token] ?? token;
}
const META = new Set(('ancestral_call arcane_torrent berserking blood_fury cancel_action cancel_buff call_action_list counterspell cycling_variable fireblood disrupt flask food invoke_external_buff kick lights_judgment mind_freeze muzzle potion pool_resource pummel quell rebuke run_action_list snapshot_stats use_item use_items variable wait auto_attack auto_shot augmentation retarget_auto_attack temporary_enchant wind_shear bag_of_tricks haymaker rocket_barrage shadowmeld thorn_bloom').split(' '));
export function parseProfile(text, gameClass) {
  const actions = new Set(), logic = new Set(); let entries = 0;
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.trim().match(/^actions(?:\.([^=+]+))?\+?=\/?([^,\s]+)(.*)$/);
    if (!match) continue;
    const [, list = 'default', original, conditions] = match;
    const action = normalizeAction(original);
    if (/racial/.test(list) || list === 'race_actions') continue;
    if (/target_if=|cycle_targets=/.test(conditions)) logic.add('Target selection or target cycling');
    if (/talent\./.test(conditions)) logic.add('Talent-dependent branches');
    if (/fight_remains|time_to_die|raid_event\./.test(conditions)) logic.add('Fight duration or encounter-event checks');
    if (/active_enemies|spell_targets\./.test(conditions)) logic.add('Target-count conditions');
    if (/buff\.|debuff\.|dot\./.test(conditions)) logic.add('Aura, proc or damage-over-time conditions');
    if (/cooldown\./.test(conditions)) logic.add('Cooldown-state conditions');
    if (action === 'variable' || action === 'cycling_variable') logic.add('Computed variables');
    if (action === 'pool_resource') logic.add('Explicit resource pooling');
    if (action === 'call_action_list' || action === 'run_action_list') logic.add('Named action-list branching');
    if (META.has(action) || action === 'retarget' || (action === 'arcane_pulse' && gameClass !== 'Mage')) continue;
    actions.add(action); entries++;
  }
  return { actions: [...actions].sort(), entries, logic: [...logic].sort() };
}

/** Compare canonical raw rows, not presentation labels. */
export function compareSteps(previous, current) {
  const before = new Map(previous.map((step) => [step.stepId, step]));
  const after = new Map(current.map((step) => [step.stepId, step]));
  const added = current.filter((step) => !before.has(step.stepId)).map((step) => step.action);
  const removed = previous.filter((step) => !after.has(step.stepId)).map((step) => step.action);
  const modified = current.filter((step) => {
    const old = before.get(step.stepId);
    if (!old) return false;
    return old.spellId !== step.spellId || old.orderIndex !== step.orderIndex || JSON.stringify(old.rules) !== JSON.stringify(step.rules);
  }).map((step) => step.action);
  return { changed: !!(added.length || removed.length || modified.length), added, removed, modified };
}
