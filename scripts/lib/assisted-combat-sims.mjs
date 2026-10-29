import assert from 'node:assert/strict';

/** Read player DPS only; never substitute raid DPS or a stdout guess. */
export function validateRun(report, expected) {
  assert.equal(report.git_revision, expected.simcCommit.slice(0,7), 'Wrong SimC revision');
  const sim = report.sim, options = sim.options;
  assert.equal(options.dbc.version_used, 'Live', 'PTR results are not accepted');
  assert.equal(options.dbc.Live.wow_version, expected.build, 'Wrong live build');
  assert.equal(options.desired_targets, expected.targets, 'Wrong target count');
  for (const [key,value] of Object.entries(expected.settings)) {
    if (['iterations','statistics_level'].includes(key)) continue;
    assert.equal(typeof value === 'number' ? Number(options[key]) : options[key], value, `Setting mismatch: ${key}`);
  }
  assert.equal(options.iterations, expected.settings.iterations + expected.settings.threads - 1, 'Iteration allocation differs');
  assert.equal(sim.players.length, 1, 'Expected a single player');
  const player = sim.players[0], dps = player.collected_data.dps;
  if (expected.specialization) assert.equal(player.specialization,expected.specialization,'Wrong specialization');
  assert.ok(Number.isFinite(dps.mean) && dps.mean > 0, 'Invalid player DPS');
  assert.equal(dps.count, expected.settings.iterations - 1, 'Unexpected number of measured samples');
  assert.ok(Number.isFinite(dps.mean_std_dev) && dps.mean_std_dev >= 0, 'Missing standard error');
  assert.equal(player.collected_data.fight_length.min, expected.settings.max_time, 'Player did not fight full duration');
  assert.equal(player.collected_data.fight_length.max, expected.settings.max_time, 'Player duration differs');
  assert.equal(player.collected_data.deaths?.count ?? 0, 0, 'Player deaths confound DPS comparison');
  return { player, dps, warnings:report.logs ?? [], hotfix:options.dbc.Live, timestamp:report.timestamp };
}

export function compareRuns(simc, blizzard) {
  for (const key of ['gear','talents','race','level','role','specialization','potion','flask','food','augmentation','temporary_enchant']) {
    assert.deepEqual(blizzard.player[key],simc.player[key],`Pair differs in ${key}`);
  }
  assert.deepEqual(blizzard.hotfix,simc.hotfix,'Pair uses different hotfix data');
  const a = simc.dps.mean, b = blizzard.dps.mean;
  // Approximate 95% interval with independent-run error propagation. The seed
  // is fixed but this is not a paired-difference statistical estimator.
  const uncertainty = 1.9599639854088815 * 100 * b/a * Math.hypot(simc.dps.mean_std_dev/a,blizzard.dps.mean_std_dev/b);
  return { simcDps:a, blizzardDps:b, changePct:100*(b/a-1), uncertaintyPp:uncertainty,
    simcSamples:simc.dps.count, blizzardSamples:blizzard.dps.count,
    simcStandardError:simc.dps.mean_std_dev, blizzardStandardError:blizzard.dps.mean_std_dev };
}
