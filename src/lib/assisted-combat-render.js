/**
 * Shared render logic for the Assisted Combat analysis widget.
 *
 * This module is consumed twice. `assisted-combat-analysis.ts` imports it
 * normally to server-render the initial view, and also inlines its source
 * (via a `?raw` import) into the browser script so the client re-renders with
 * byte-identical markup instead of a second, drifting copy of the templates.
 *
 * Because of that, keep this file plain, dependency-free ES module JS whose
 * only top-level statements are `export function` / `export var`: the client
 * wrapper strips the `export ` keywords with a regex and evaluates the rest
 * inside an IIFE. No imports, no DOM access, no side effects.
 */

export var CLASS_COLORS = {
  "Death Knight": "#c41e3a",
  "Demon Hunter": "#a330c9",
  Druid: "#ff7c0a",
  Evoker: "#33937f",
  Hunter: "#aad372",
  Mage: "#3fc7eb",
  Monk: "#00ff98",
  Paladin: "#f48cba",
  Priest: "#f5f5f5",
  Rogue: "#fff468",
  Shaman: "#0070dd",
  Warlock: "#8788ee",
  Warrior: "#c69b6d",
};

export var FALLBACK_CLASS_COLOR = "#70d0ff";

export var DETAIL_TABS = [
  ["missing", "Versus SimC"],
  ["apl", "Blizzard APL"],
  ["sims", "Simulation results"],
];

/** Never emit `undefined` into a custom property: it silently kills color-mix(). */
export function classColor(gameClass) {
  return CLASS_COLORS[gameClass] || FALLBACK_CLASS_COLOR;
}

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function titleAction(value) {
  return String(value)
    .split("_")
    .map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function initials(value) {
  return String(value)
    .split(/\s+/)
    .map(function (part) {
      return part.charAt(0);
    })
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function specKey(spec) {
  return spec.gameClass + "|" + spec.spec;
}

/**
 * Spec icons are vendored under /images/wow-spec-icons/ by
 * scripts/fetch-spec-icons.mjs. Falls back to the spec's initials when a spec
 * has no mapped icon, so a missing entry degrades instead of showing a broken
 * image. The name is filtered to listfile-safe characters because it lands in
 * a URL, not just in text.
 */
export function specIconMarkup(spec) {
  var icon = spec.icon ? String(spec.icon).replace(/[^a-z0-9_-]/gi, "") : "";
  if (!icon) {
    return '<span class="ac-monogram" aria-hidden="true">' + escapeHtml(initials(spec.spec)) + "</span>";
  }
  return (
    '<img class="ac-monogram ac-monogram--art" src="/images/wow-spec-icons/' +
    icon +
    '.jpg" alt="" width="38" height="38" loading="lazy" decoding="async">'
  );
}

export function infoIcon(text) {
  return (
    '<span class="ac-info" role="note" tabindex="0" aria-label="' +
    escapeHtml(text) +
    '" data-tooltip="' +
    escapeHtml(text) +
    '">i</span>'
  );
}

export function blizzardMatchInfo(spec) {
  return (
    spec.sharedActionCount +
    " of " +
    spec.blizzardActionCount +
    " distinct Blizzard actions also appear in SimC. Blizzard match equals shared actions divided by Blizzard actions."
  );
}

export function simcCoverageInfo(spec) {
  return (
    spec.sharedActionCount +
    " of " +
    spec.simcActionCount +
    " distinct SimC actions are represented by Blizzard. SimC covered equals shared actions divided by SimC actions."
  );
}

export function profilesInfo(spec) {
  if (!spec.simcProfiles || !spec.simcProfiles.length) return "No SimC profile was matched to this specialization.";
  return (
    "Executable action lines in each matched SimC profile: " +
    spec.simcProfiles
      .map(function (profile, index) {
        return profile + " (" + spec.simcActionLines[index] + ")";
      })
      .join(", ") +
    "."
  );
}

export var MISSING_ACTIONS_INFO =
  "Distinct actions in the pinned SimC profiles that are absent from Blizzard's list, after the same name normalization used by the scores. "
  + "Includes setup, pet and fallback names. Consumables, racials, interrupts and list-control commands are excluded. This is not a list of mandatory extra buttons.";

export var MISSING_LOGIC_INFO =
  "Features detected in executable lines of the pinned SimC profiles. Blizzard also checks resources, auras, cooldowns and target counts; "
  + "these labels describe SimC's structure and do not establish that every listed feature is absent from Blizzard.";

export function bulletList(items, empty) {
  if (!items || !items.length) return '<p class="ac-muted ac-muted--flush">' + escapeHtml(empty) + "</p>";
  return (
    '<ul class="ac-list">' +
    items
      .map(function (item) {
        return '<li class="ac-list-item">' + escapeHtml(item) + "</li>";
      })
      .join("") +
    "</ul>"
  );
}

export function defaultState(payload) {
  return {
    search: "",
    gameClass: "all",
    role: "all",
    selected: payload.specs.length ? specKey(payload.specs[0]) : "",
    tab: payload.simulations ? "sims" : "missing",
  };
}

/** Everything a free-text search should be able to reach, including APL actions. */
export function searchHaystack(spec) {
  return [
    spec.gameClass,
    spec.spec,
    spec.role,
    spec.alignment,
    spec.missingActions.join(" "),
    spec.missingLogic.join(" "),
    spec.comparisonLimitation.join(" "),
    spec.steps
      .map(function (step) {
        return step.action;
      })
      .join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

export function filterSpecs(payload, state) {
  var needle = state.search.trim().toLowerCase();
  return payload.specs.filter(function (spec) {
    if (state.gameClass !== "all" && spec.gameClass !== state.gameClass) return false;
    if (state.role !== "all" && spec.role !== state.role) return false;
    if (!needle) return true;
    return searchHaystack(spec).indexOf(needle) !== -1;
  });
}

export function findSpec(payload, key) {
  for (var i = 0; i < payload.specs.length; i++) {
    if (specKey(payload.specs[i]) === key) return payload.specs[i];
  }
  return null;
}

export function renderCards(specs, state) {
  return specs
    .map(function (spec) {
      var selected = specKey(spec) === state.selected;
      var scores = spec.simcComparable
        ? '<span class="ac-score-line"><span>Blizzard match</span><strong>' +
          spec.overlap +
          "%" +
          infoIcon(blizzardMatchInfo(spec)) +
          "</strong></span>" +
          '<span class="ac-score-line ac-score-line--simc"><span>SimC covered</span><strong>' +
          spec.simcCoverage +
          "%" +
          infoIcon(simcCoverageInfo(spec)) +
          "</strong></span>"
        : '<span class="ac-score-na">N/A</span>';
      return (
        '<button type="button" class="ac-spec-card" data-spec-key="' +
        escapeHtml(specKey(spec)) +
        '" aria-pressed="' +
        (selected ? "true" : "false") +
        '" data-game-class="' +
        escapeHtml(spec.gameClass) +
        '">' +
        specIconMarkup(spec) +
        '<span><span class="ac-spec-name">' +
        escapeHtml(spec.spec) +
        '</span><span class="ac-class-name">' +
        escapeHtml(spec.gameClass) +
        " · " +
        escapeHtml(spec.role) +
        "</span></span>" +
        '<span class="ac-card-meta">' +
        scores +
        "</span>" +
        "</button>"
      );
    })
    .join("");
}

export function renderSteps(spec) {
  return spec.steps
    .map(function (step) {
      return (
        '<div class="ac-step' +
        (step.automationOnly ? " ac-step--automation" : "") +
        '">' +
        '<span class="ac-step__priority">' +
        step.priority +
        "</span>" +
        '<span class="ac-step__action">' +
        escapeHtml(step.action) +
        (step.automationOnly ? '<span class="ac-auto">Automation only</span>' : "") +
        '<span class="ac-step__ids">spell ' +
        (step.spellId == null ? "not available" : step.spellId) +
        " · step " +
        step.stepId +
        "</span></span>" +
        '<span class="ac-step__condition">' +
        escapeHtml(step.condition) +
        "</span>" +
        "</div>"
      );
    })
    .join("");
}

function renderMissingPanel(spec, payload) {
  if (!spec.simcComparable) {
    return (
      '<section class="ui-panel ac-block"><h4 class="ac-block-title">Not directly comparable</h4>' +
      bulletList(
        spec.comparisonLimitation,
        "SimulationCraft does not provide an equivalent optimized profile for this role/spec."
      ) +
      '<p class="ac-muted">The Blizzard list is still shown in the APL tab, but the directional action scores are intentionally omitted.</p></section>'
    );
  }
  return (
    '<div class="ac-panel-grid">' +
    '<section class="ui-panel ac-block"><h4 class="ac-block-title">In SimC, not in Blizzard\'s list' +
    infoIcon(MISSING_ACTIONS_INFO) +
    "</h4>" +
    bulletList(spec.missingActions.map(titleAction), "No distinct SimC actions are absent from Blizzard's list.") +
    "</section>" +
    '<section class="ui-panel ac-block"><h4 class="ac-block-title">Decision features in SimC' +
    infoIcon(MISSING_LOGIC_INFO) +
    "</h4>" +
    bulletList(spec.missingLogic, "No additional missing logic was called out.") +
    "</section>" +
    '<section class="ui-panel ac-block ac-block--wide"><h4 class="ac-block-title">Comparison context</h4><div class="ac-metric-row">' +
    '<div class="ac-mini-metric"><span class="ac-mini-value ac-mini-value--match">' +
    spec.overlap +
    "%" +
    infoIcon(blizzardMatchInfo(spec)) +
    '</span><span class="ac-mini-label">Blizzard actions found in SimC · ' +
    spec.sharedActionCount +
    " / " +
    spec.blizzardActionCount +
    "</span></div>" +
    '<div class="ac-mini-metric"><span class="ac-mini-value ac-mini-value--coverage">' +
    spec.simcCoverage +
    "%" +
    infoIcon(simcCoverageInfo(spec)) +
    '</span><span class="ac-mini-label">SimC actions represented by Blizzard · ' +
    spec.sharedActionCount +
    " / " +
    spec.simcActionCount +
    "</span></div>" +
    '<div class="ac-mini-metric"><span class="ac-mini-value">' +
    spec.steps.length +
    '</span><span class="ac-mini-label">Blizzard 12.1.5 priority steps</span></div>' +
    '<div class="ac-mini-metric"><span class="ac-mini-value">' +
    escapeHtml(spec.simcActionLines.join(" / ")) +
    infoIcon(profilesInfo(spec)) +
    '</span><span class="ac-mini-label">SimC lines by profile · ' +
    "MID2 snapshot" +
    "</span></div>" +
    "</div>" +
    (spec.blizzardOnlyActions.length
      ? '<p class="ac-muted">Blizzard-only or fallback action names: ' +
        escapeHtml(spec.blizzardOnlyActions.map(titleAction).join(", ")) +
        ".</p>"
      : "") +
    '<p class="ac-muted">Pinned SimC profiles: ' + spec.simcProfiles.map(function (file) {
      return '<a href="https://github.com/simulationcraft/simc/blob/' + escapeHtml(payload.simcCommit) + '/profiles/MID2/' + encodeURIComponent(file) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(file) + '</a>';
    }).join(', ') + '.</p>' +
    "</section>" +
    "</div>"
  );
}

function renderAplPanel(spec, payload) {
  return (
    '<p class="ac-apl-note"><strong>Live build ' +
    escapeHtml(payload.currentBuild) +
    " · " +
    spec.steps.length +
    ' steps.</strong> Priority 1 is evaluated first. Every condition shown on a step must pass; “automation only” entries are internal cooldown actions and are not part of Assisted Highlight. List ' + spec.assistedCombatId + ', specialization ' + spec.specId + '.</p><div class="ac-apl">' +
    renderSteps(spec) +
    "</div>"
  );
}

export function simulationChange(result) {
  var change = result.changePct;
  return (change > 0 ? '+' : '') + change.toFixed(2) + '%';
}

export function simulationDps(value) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function simulationUncertainty(result) {
  return 'Approximate 95% uncertainty: ±' + result.uncertaintyPp.toFixed(2) + ' percentage points, using independent-run standard-error propagation. '
    + result.simcSamples.toLocaleString('en-US') + ' measured iterations per run after warm-up. This interval excludes model uncertainty.';
}

export function renderSimulationPanel(spec, simulations) {
  var row = simulations && simulations.rows.find(function (row) { return row.specId === spec.specId; });
  if (!row) return '<section class="ui-panel ac-block"><h4 class="ac-block-title">No paired simulation</h4><p class="ac-copy">No current MID2 reference profile is available for this specialization in the pinned snapshot. No DPS result is inferred from its action overlap score.</p></section>';
  return '<p class="ac-apl-note">Same primary MID2 build, gear and talents in both runs. Blizzard priorities use SimC’s manual cooldown support, with no Single-Button Assistant penalty. Five-minute Patchwerk fights; 10,000 requested iterations per run. Tank rows compare damage, not survival.</p>'
    + (row.unmodeledRuleFields ? '<p class="ac-apl-note">This specialization has ' + row.unmodeledRuleFields + ' undocumented DB2 field values that SimC does not explicitly represent. Interpret this row with that model limitation.</p>' : '')
    + '<div class="ac-table-scroll" role="region" aria-label="Paired simulation DPS" tabindex="0"><table class="ac-sim-table"><caption>' + escapeHtml(row.spec + ' ' + row.gameClass) + ' APL comparison</caption><thead><tr><th scope="col">Targets</th><th scope="col">SimC DPS</th><th scope="col">Blizzard DPS</th><th scope="col">Change</th></tr></thead><tbody>'
    + row.results.map(function (result) {
      return '<tr><th scope="row">' + result.targets + '</th><td>' + simulationDps(result.simcDps) + '</td><td>' + simulationDps(result.blizzardDps) + '</td><td data-result="' + (result.changePct < 0 ? 'loss' : 'gain') + '"><strong>' + simulationChange(result) + '</strong>' + infoIcon(simulationUncertainty(result)) + '</td></tr>';
    }).join('') + '</tbody></table></div><p class="ac-muted">Change = (Blizzard DPS ÷ SimC DPS − 1) × 100. Negative values are losses. '
    + 'Primary profile: <a target="_blank" rel="noopener noreferrer" href="https://github.com/simulationcraft/simc/blob/' + escapeHtml(simulations.simcCommit) + '/profiles/MID2/' + encodeURIComponent(row.profile) + '">' + escapeHtml(row.profile) + '</a>.</p>';
}

export function renderSimulationOverview(simulations) {
  return '<details class="ui-panel ac-block ac-benchmark"><summary>Compare simulation results across all ' + simulations.rows.length + ' specs</summary><div class="ac-benchmark-body">'
    + '<p class="ac-copy">Each cell shows Blizzard’s DPS change against the same SimC build, then both mean DPS values. Manual cooldown support is enabled; the Single-Button Assistant penalty is disabled. These results describe the pinned builds and simulation model.</p>'
    + '<div class="ac-table-scroll" role="region" aria-label="Simulation results for all specializations" tabindex="0"><table class="ac-sim-table"><caption>Five-minute Patchwerk APL comparison</caption><thead><tr><th scope="col">Specialization</th>'
    + [1,2,3,5].map(function (targets) { return '<th scope="col">' + targets + (targets === 1 ? ' target' : ' targets') + '</th>'; }).join('')
    + '</tr></thead><tbody>' + simulations.rows.map(function (row) {
      return '<tr><th scope="row">' + escapeHtml(row.spec) + '<small>' + escapeHtml(row.gameClass) + '</small>' + (row.unmodeledRuleFields ? '<small>' + row.unmodeledRuleFields + ' unmodeled DB2 fields</small>' : '') + '</th>' + row.results.map(function (result) {
        return '<td data-result="' + (result.changePct < 0 ? 'loss' : 'gain') + '"><strong>' + simulationChange(result) + '</strong>' + infoIcon(simulationUncertainty(result)) + '<small>SimC ' + simulationDps(result.simcDps) + '<br>Blizzard ' + simulationDps(result.blizzardDps) + '</small></td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div><p class="ac-muted">Formula: (Blizzard DPS ÷ SimC DPS − 1) × 100. Same gear, talents, race, consumables and fight settings within each pair. One primary MID2 profile per spec; the build is not re-optimized for each target count. These are not class rankings or in-game performance guarantees.</p>'
    + renderSimulationMethod(simulations) + '</div></details>';
}

export function renderSimulationMethod(simulations) {
  return '<details class="ac-method-details"><summary>Simulation method and model limits</summary><div class="ac-method-body">'
    + '<section><h4 class="ac-block-title">Run setup</h4><dl class="ac-settings"><dt>Fight</dt><dd>Fixed five-minute Patchwerk</dd><dt>Iterations</dt><dd>10,000 requested; 9,999 measured after warm-up</dd><dt>Character</dt><dd>Same gear, talents, race and consumables within each pair</dd><dt>Raid buffs</dt><dd>Full raid buffs enabled</dd><dt>Cooldowns</dt><dd>Manual cooldown support enabled</dd><dt>Single-button penalty</dt><dd>Disabled</dd></dl></section>'
    + '<section><h4 class="ac-block-title">Reading the comparison</h4><p>Percent uncertainty uses approximate 95% independent-run error propagation. It does not include simulator model uncertainty.</p><p>SimC’s class-specific importer may correct or omit unsupported rules. These results model Blizzard priorities with manual cooldown support. Tank rows measure damage only; healers, Augmentation and specs without current MID2 profiles are omitted.</p></section>'
    + '<section><h4 class="ac-block-title">Data snapshot</h4><dl class="ac-settings"><dt>Live build</dt><dd>' + escapeHtml(simulations.hotfix.wow_version) + '</dd><dt>Hotfix snapshot</dt><dd>' + escapeHtml(simulations.hotfix.hotfix_date) + '</dd><dt>Engine commit</dt><dd><code>' + escapeHtml(simulations.simcCommit.slice(0,12)) + '</code></dd></dl></section>'
    + '<details class="ac-engine-details"><summary>Engine settings and model messages</summary><div class="ac-engine-body"><ul class="ac-engine-options"><li><code>use_blizzard_action_list=1</code></li><li><code>use_cds_with_blizzard_action_list=1</code></li><li><code>one_button_mode=0</code></li><li>Seed 20261029; four threads</li></ul><ul class="ac-engine-messages">'
    + simulations.warnings.map(function (warning) {
      var split = warning.indexOf(': ');
      var level = split < 0 ? '' : warning.slice(0,split);
      var message = split < 0 ? warning : warning.slice(split+2);
      var label = level === 'implementation_not_yet_verified' ? 'Unverified model' : level === 'trivial' ? 'Engine note' : titleAction(level || 'Engine message');
      return '<li><span class="ac-engine-level">' + escapeHtml(label) + '</span><p>' + escapeHtml(message) + '</p></li>';
    }).join('') + '</ul></div></details></div></details>';
}

export function renderDetail(spec, payload, state) {
  var panels = {
    missing: renderMissingPanel(spec, payload),
    apl: renderAplPanel(spec, payload),
    sims: renderSimulationPanel(spec, payload.simulations),
  };
  var tabs = DETAIL_TABS.map(function (tab) {
    var isSelected = state.tab === tab[0];
    return (
      '<button type="button" class="ac-tab" role="tab" id="ac-tab-' +
      tab[0] +
      '" aria-controls="ac-panel-' +
      tab[0] +
      '" aria-selected="' +
      isSelected +
      '" tabindex="' +
      (isSelected ? "0" : "-1") +
      '" data-detail-tab="' +
      tab[0] +
      '">' +
      tab[1] +
      "</button>"
    );
  }).join("");
  var panelMarkup = DETAIL_TABS.map(function (tab) {
    return (
      '<div class="ac-panel" role="tabpanel" id="ac-panel-' +
      tab[0] +
      '" aria-labelledby="ac-tab-' +
      tab[0] +
      '" tabindex="0" data-panel="' +
      tab[0] +
      '"' +
      (state.tab === tab[0] ? "" : " hidden") +
      ">" +
      panels[tab[0]] +
      "</div>"
    );
  }).join("");

  return (
    '<div class="ac-detail-head"><div><p class="ac-detail-kicker"><span>' +
    escapeHtml(spec.gameClass) +
    '</span><span>' +
    escapeHtml(spec.role) +
    '</span></p><h3 class="ac-detail-title">' +
    escapeHtml(spec.spec) +
    '</h3></div><div class="ac-badges">' +
    (spec.simcComparable
      ? '<span class="ac-badge ac-badge--overlap">' +
        spec.overlap +
        "%" +
        infoIcon(blizzardMatchInfo(spec)) +
        ' Blizzard match</span><span class="ac-badge ac-badge--coverage">' +
        spec.simcCoverage +
        "%" +
        infoIcon(simcCoverageInfo(spec)) +
        " SimC represented</span>"
      : '<span class="ac-badge">Not SimC-comparable</span>') +
    "</div></div>" +
    '<div class="ac-tabs" role="tablist" aria-label="' +
    escapeHtml(spec.spec + " " + spec.gameClass) +
    ' analysis sections">' +
    tabs +
    "</div>" +
    panelMarkup
  );
}

/** Short, stable sentence for the polite status region — never the whole panel. */
export function statusMessage(spec, state, shown, total) {
  var tabLabel = "";
  for (var i = 0; i < DETAIL_TABS.length; i++) {
    if (DETAIL_TABS[i][0] === state.tab) tabLabel = DETAIL_TABS[i][1];
  }
  return (
    shown + " of " + total + " specs listed. Showing " + spec.spec + " " + spec.gameClass + ", " + tabLabel + "."
  );
}
