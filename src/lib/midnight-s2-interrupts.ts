import researchData from "./midnight-s2-interrupt-data.json";
import communityData from "./midnight-s2-community-tips.json";
import { nonceAttr } from "./csp";

type Row = (typeof researchData.rows)[number];
type CommunityTip = (typeof communityData.tips)[number];

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderRow(row: Row): string {
  const responseSlug = slug(row.response);
  const prioritySlug = slug(row.priority);
  const search = [row.dungeon, row.area, row.enemy, row.ability, row.response, row.priority, row.fallback, row.action]
    .join(" ")
    .toLowerCase();

  return (
    `<tr data-m2iu-row data-dungeon="${esc(row.dungeon)}" data-response="${esc(row.response)}" data-priority="${esc(row.priority)}" data-search="${esc(search)}">` +
    `<td data-label="Area"><span class="m2iu-area">${esc(row.area)}</span></td>` +
    `<td data-label="Enemy / Boss"><strong>${esc(row.enemy)}</strong></td>` +
    `<td data-label="Ability"><strong class="m2iu-ability">${esc(row.ability)}</strong></td>` +
    `<td data-label="Response"><span class="m2iu-badge m2iu-response--${responseSlug}">${esc(row.response)}</span></td>` +
    `<td data-label="Priority"><span class="m2iu-badge m2iu-priority--${prioritySlug}">${esc(row.priority)}</span></td>` +
    `<td data-label="Fallback / Clear">${esc(row.fallback)}</td>` +
    `<td data-label="What to do" class="m2iu-action">${esc(row.action)}</td>` +
    `<td data-label="Source"><a class="m2iu-source" href="${esc(row.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open source for ${esc(row.ability)}">Guide ↗</a></td>` +
    `</tr>`
  );
}

function renderCommunityTip(tip: CommunityTip): string {
  const search = [tip.dungeon, tip.category, tip.confidence, tip.tip].join(" ").toLowerCase();
  const confidenceSlug = slug(tip.confidence);
  return (
    `<article class="m2iu-tip" data-m2iu-tip data-dungeon="${esc(tip.dungeon)}" data-search="${esc(search)}">` +
    `<div class="m2iu-tip-meta"><span>${esc(tip.category)}</span><span class="m2iu-confidence m2iu-confidence--${confidenceSlug}">${esc(tip.confidence)}</span></div>` +
    `<p>${esc(tip.tip)}</p>` +
    `<a href="${esc(tip.sourceUrl)}" target="_blank" rel="noopener noreferrer">Reddit discussion ↗</a>` +
    `</article>`
  );
}

function buildHtml(): string {
  const rows = researchData.rows as Row[];
  const responses = [...new Set(rows.map((row) => row.response))];
  const priorityOrder = ["Critical", "High", "Medium", "Situational"];
  const priorities = [...new Set(rows.map((row) => row.priority))].sort(
    (a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b),
  );
  const interruptCount = researchData.responseCounts.Interrupt ?? 0;
  const stopCount = researchData.responseCounts["Stop / CC"] ?? 0;
  const utilityCount = rows.length - interruptCount - stopCount;

  const dungeonOptions = researchData.dungeons
    .map((dungeon) => `<option value="${esc(dungeon)}">${esc(dungeon)}</option>`)
    .join("");
  const responseOptions = responses
    .map((response) => `<option value="${esc(response)}">${esc(response)}</option>`)
    .join("");
  const priorityOptions = priorities
    .map((priority) => `<option value="${esc(priority)}">${esc(priority)}</option>`)
    .join("");

  const tipSections = researchData.dungeons.map((dungeon) => {
    const tips = (communityData.tips as CommunityTip[]).filter((tip) => tip.dungeon === dungeon);
    if (tips.length === 0) return "";
    return (
      `<section class="m2iu-tip-section" data-m2iu-tip-section data-dungeon="${esc(dungeon)}">` +
      `<h3>${esc(dungeon)}</h3><div class="m2iu-tip-grid">${tips.map(renderCommunityTip).join("")}</div></section>`
    );
  }).join("");

  const sections = researchData.dungeons.map((dungeon) => {
    const dungeonRows = rows.filter((row) => row.dungeon === dungeon);
    return (
      `<section class="ui-panel m2iu-dungeon" data-m2iu-section data-dungeon="${esc(dungeon)}" data-total="${dungeonRows.length}">` +
      `<div class="m2iu-dungeon-head"><h3>${esc(dungeon)}</h3><span data-m2iu-section-count>${dungeonRows.length} entries</span></div>` +
      `<div class="m2iu-table-wrap"><table>` +
      `<thead><tr><th>Area</th><th>Enemy / Boss</th><th>Ability</th><th>Response</th><th>Priority</th><th>Fallback / Clear</th><th>What to do</th><th>Source</th></tr></thead>` +
      `<tbody>${dungeonRows.map(renderRow).join("")}</tbody>` +
      `</table></div></section>`
    );
  }).join("");

  const css = `
#m2iu-root{margin:1.25rem 0 2rem;color:var(--text,#e9eef9);font-family:inherit;}
#m2iu-root *{box-sizing:border-box;}
#m2iu-root .m2iu-hero{position:relative;overflow:hidden;padding:clamp(1.25rem,3vw,2.25rem);border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);background:var(--surface,#0f1326);}
#m2iu-root .m2iu-eyebrow{margin:0 0 .6rem;color:var(--accent,#70d0ff);font-size:.85rem;font-weight:700;}
#m2iu-root h2.m2iu-title{margin:0;padding:0;border:0;color:var(--text,#e9eef9);font-family:var(--font-display);font-size:clamp(1.35rem,2.4vw,1.9rem);font-weight:600;line-height:1.2;}
#m2iu-root p.m2iu-lede{max-width:880px;margin:.65rem 0 0;color:var(--muted,#a3aec9);font-size:.95rem;line-height:1.65;}
#m2iu-root .m2iu-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.6rem;margin-top:1rem;}
#m2iu-root .m2iu-stat{padding:1rem 1.1rem;border-radius:var(--r-lg,16px);}
#m2iu-root .m2iu-stat strong{display:block;color:var(--text,#e9eef9);font-family:var(--font-display);font-size:1.6rem;font-weight:600;line-height:1;}
#m2iu-root .m2iu-stat span{display:block;margin-top:.45rem;color:var(--muted,#a3aec9);font-size:.85rem;line-height:1.3;}
#m2iu-root .m2iu-sheet{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1rem;padding:.8rem .9rem;border:1px solid rgb(from var(--accent) r g b / 24%);border-radius:var(--r-md,10px);background:rgb(from var(--accent) r g b / 5%);}
#m2iu-root p.m2iu-sheet-copy{margin:0;color:var(--muted,#a3aec9);font-size:.82rem;line-height:1.45;}
#m2iu-root a.m2iu-sheet-link{flex:0 0 auto;display:inline-flex;align-items:center;min-height:44px;padding:0 1.1rem;border-radius:var(--r-pill,999px);background:var(--accent,#70d0ff);color:var(--accent-ink,#06101c);font-size:.88rem;font-weight:700;text-decoration:none;white-space:nowrap;transition:background-color var(--transition-fast);}
#m2iu-root a.m2iu-sheet-link:hover{background:var(--accent-hover);text-decoration:none;}
#m2iu-root details.m2iu-community{margin:1rem 0;border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);background:var(--surface,#0f1326);overflow:hidden;}
#m2iu-root summary.m2iu-community-summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.1rem;color:var(--text,#e9eef9);font-size:1.04rem;font-weight:700;cursor:pointer;list-style:none;}
#m2iu-root summary.m2iu-community-summary::-webkit-details-marker{display:none;}
#m2iu-root .m2iu-community-body{padding:0 1.1rem 1.1rem;border-top:1px solid var(--line,#1d2442);}
#m2iu-root p.m2iu-community-note{margin:.9rem 0;color:var(--muted,#a3aec9);font-size:.88rem;line-height:1.6;}
#m2iu-root p.m2iu-community-note a{color:var(--accent,#70d0ff);}
#m2iu-root .m2iu-tip-section{margin:.8rem 0 0;}
#m2iu-root .m2iu-tip-section[hidden],#m2iu-root .m2iu-tip[hidden]{display:none;}
#m2iu-root .m2iu-tip-section h3{margin:0 0 .6rem;color:var(--text,#e9eef9);font-family:var(--font-display);font-size:1rem;font-weight:600;}
#m2iu-root .m2iu-tip-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem;}
#m2iu-root .m2iu-tip{display:flex;flex-direction:column;min-width:0;padding:.85rem .9rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:var(--bg,#070914);}
#m2iu-root .m2iu-tip-meta{display:flex;align-items:center;justify-content:space-between;gap:.5rem;color:var(--accent,#70d0ff);font-size:.78rem;font-weight:700;}
#m2iu-root .m2iu-confidence{padding:.2rem .45rem;border:1px solid currentColor;border-radius:var(--r-pill,999px);color:var(--muted,#a3aec9);font-size:.7rem;letter-spacing:0;text-transform:none;white-space:nowrap;}
#m2iu-root .m2iu-confidence--corroborated{color:var(--accent-3,#a8ff60);}
#m2iu-root .m2iu-confidence--hotfix-sensitive,#m2iu-root .m2iu-confidence--caution{color:#ffd28a;}
#m2iu-root .m2iu-tip p{margin:.6rem 0;color:var(--text,#e9eef9);font-size:.92rem;line-height:1.58;}
#m2iu-root .m2iu-tip a{align-self:flex-start;margin-top:auto;color:var(--muted,#a3aec9);font-size:.78rem;text-decoration:none;}
#m2iu-root .m2iu-tip a:hover{color:var(--accent,#70d0ff);text-decoration:underline;}
#m2iu-root .m2iu-toolbar{display:grid;grid-template-columns:minmax(210px,1.4fr) repeat(3,minmax(140px,.7fr)) auto;gap:.75rem;align-items:end;margin:1rem 0;padding:1rem 1.1rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);background:var(--surface,#0f1326);}
#m2iu-root label.m2iu-field{display:flex;flex-direction:column;gap:.35rem;margin:0;color:var(--text-soft,#c3cbe0);font-size:.85rem;font-weight:700;}
#m2iu-root .m2iu-input,#m2iu-root .m2iu-select{width:100%;min-height:44px;padding:.55rem .8rem;font-size:.9rem;font-weight:500;}
#m2iu-root .m2iu-input:focus,#m2iu-root .m2iu-select:focus{border-color:var(--accent,#70d0ff);box-shadow:0 0 0 3px rgb(from var(--accent) r g b / 8%);}
#m2iu-root .m2iu-input:focus-visible,#m2iu-root .m2iu-select:focus-visible{outline:2px solid var(--accent,#70d0ff);outline-offset:2px;}
#m2iu-root button.m2iu-reset{min-height:44px;padding:0 1.1rem;border:1px solid var(--line-strong,#3a4a78);border-radius:var(--r-pill,999px);background:transparent;color:var(--muted,#a3aec9);font-size:.78rem;font-weight:750;cursor:pointer;}
#m2iu-root button.m2iu-reset:hover{border-color:rgb(from var(--accent) r g b / 34%);color:var(--text,#e9eef9);}
#m2iu-root p.m2iu-status{margin:.35rem 0 .8rem;color:var(--muted,#a3aec9);font-size:.78rem;}
#m2iu-root .m2iu-dungeon{margin:0 0 1rem;overflow:hidden;}
#m2iu-root .m2iu-dungeon[hidden],#m2iu-root tr[hidden]{display:none;}
#m2iu-root .m2iu-dungeon-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.9rem 1.1rem;border-bottom:1px solid var(--line,#1d2442);background:var(--surface-2,#151b33);}
#m2iu-root .m2iu-dungeon-head h3{margin:0;color:var(--text,#e9eef9);font-family:var(--font-display);font-size:1.05rem;font-weight:600;}
#m2iu-root .m2iu-dungeon-head span{color:var(--muted,#a3aec9);font-size:.72rem;}
#m2iu-root .m2iu-table-wrap{overflow-x:auto;}
#m2iu-root table{width:100%;min-width:960px;margin:0;border:0;border-collapse:collapse;background:transparent;font-size:.76rem;table-layout:fixed;}
#m2iu-root thead{background:var(--bg-deep,#05070f);}
#m2iu-root th{padding:.6rem .55rem;border:0;border-bottom:1px solid var(--line,#1d2442);color:var(--muted,#a3aec9);font-size:.78rem;font-weight:700;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#m2iu-root td{padding:.62rem .55rem;border:0;border-bottom:1px solid var(--line,#1d2442);color:var(--muted,#a3aec9);line-height:1.4;vertical-align:top;overflow-wrap:break-word;}
#m2iu-root th:nth-child(1),#m2iu-root td:nth-child(1){width:4.5%;}
#m2iu-root th:nth-child(2),#m2iu-root td:nth-child(2){width:13%;}
#m2iu-root th:nth-child(3),#m2iu-root td:nth-child(3){width:12%;}
#m2iu-root th:nth-child(4),#m2iu-root td:nth-child(4){width:9.5%;}
#m2iu-root th:nth-child(5),#m2iu-root td:nth-child(5){width:8.5%;}
#m2iu-root th:nth-child(6),#m2iu-root td:nth-child(6){width:13%;}
#m2iu-root th:nth-child(7),#m2iu-root td:nth-child(7){width:32%;}
#m2iu-root th:nth-child(8),#m2iu-root td:nth-child(8){width:7.5%;}
#m2iu-root tbody tr:last-child td{border-bottom:0;}
#m2iu-root tbody tr:hover{background:rgb(from var(--accent) r g b / 3%);}
#m2iu-root td strong{color:var(--text,#e9eef9);font-weight:750;}
#m2iu-root .m2iu-area{display:inline-flex;min-width:2.25rem;justify-content:center;padding:.18rem .35rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);background:rgb(255 255 255 / 3%);color:var(--text,#e9eef9);font-family:var(--font-code);font-size:.7rem;white-space:nowrap;}
#m2iu-root .m2iu-ability{color:var(--accent,#70d0ff);}
#m2iu-root .m2iu-badge{display:inline-flex;padding:.2rem .42rem;border:1px solid currentColor;border-radius:var(--r-pill,999px);font-size:.7rem;font-weight:800;line-height:1.2;white-space:nowrap;}
#m2iu-root .m2iu-response--interrupt{color:#ff858e;background:rgb(199 59 74 / 10%);}
#m2iu-root .m2iu-response--stop-cc{color:#ffad66;background:rgb(217 120 34 / 10%);}
#m2iu-root .m2iu-response--dispel{color:#72b7e8;background:rgb(38 114 201 / 10%);}
#m2iu-root .m2iu-response--purge-soothe{color:#c7a7ff;background:rgb(122 75 194 / 10%);}
#m2iu-root .m2iu-response--defensive{color:#72d6ad;background:rgb(39 138 102 / 10%);}
#m2iu-root .m2iu-response--mechanic{color:#b8c0ce;background:rgb(92 102 119 / 10%);}
#m2iu-root .m2iu-priority--critical{color:#fff;background:#8a1f2b;border-color:#a53340;}
#m2iu-root .m2iu-priority--high{color:#ffd28a;background:rgb(217 120 34 / 12%);}
#m2iu-root .m2iu-priority--medium{color:#9fd7ff;background:rgb(38 114 201 / 10%);}
#m2iu-root .m2iu-priority--situational{color:#c5cfdd;background:rgb(92 102 119 / 10%);}
#m2iu-root .m2iu-action{min-width:240px;}
#m2iu-root a.m2iu-source{color:var(--accent,#70d0ff);font-size:.7rem;font-weight:750;text-decoration:none;white-space:nowrap;}
#m2iu-root a.m2iu-source:hover{text-decoration:underline;}
#m2iu-root .m2iu-noscript{display:block;margin:0 0 .8rem;padding:.65rem .8rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:var(--surface-2,#151b33);color:var(--muted,#a3aec9);font-size:.78rem;line-height:1.5;}
@media (max-width:960px){#m2iu-root .m2iu-toolbar{grid-template-columns:repeat(2,minmax(0,1fr));}#m2iu-root button.m2iu-reset{width:100%;}}
@media (max-width:680px){
  #m2iu-root .m2iu-stats{grid-template-columns:repeat(2,minmax(0,1fr));}
  #m2iu-root .m2iu-sheet{align-items:flex-start;flex-direction:column;}
  #m2iu-root .m2iu-toolbar{grid-template-columns:1fr;}
  #m2iu-root .m2iu-tip-grid{grid-template-columns:1fr;}
  #m2iu-root .m2iu-table-wrap{overflow:visible;}
  #m2iu-root table,#m2iu-root tbody{display:block;width:100%;min-width:0;table-layout:auto;}
  #m2iu-root thead{position:absolute;width:1px;height:1px;margin:-1px;clip:rect(0 0 0 0);overflow:hidden;}
  #m2iu-root tr{display:block;min-width:0;padding:.75rem;border-bottom:1px solid var(--line,#1d2442);}
  #m2iu-root tbody tr:last-child{border-bottom:0;}
  #m2iu-root td{display:grid;grid-template-columns:7.2rem minmax(0,1fr);gap:.65rem;padding:.28rem 0;border:0;overflow-wrap:anywhere;}
  #m2iu-root td::before{content:attr(data-label);color:var(--muted,#a3aec9);font-size:.78rem;font-weight:700;}
  #m2iu-root .m2iu-action{min-width:0;}
}
`;

  const clientJs = `
(function(){
  function init(){
    var root=document.getElementById('m2iu-root');
    if(!root||root.dataset.m2iuInit)return;
    root.dataset.m2iuInit='1';
    var search=root.querySelector('#m2iu-search');
    var dungeon=root.querySelector('#m2iu-dungeon');
    var response=root.querySelector('#m2iu-response');
    var priority=root.querySelector('#m2iu-priority');
    var reset=root.querySelector('#m2iu-reset');
    var status=root.querySelector('#m2iu-status');
    var rows=Array.prototype.slice.call(root.querySelectorAll('[data-m2iu-row]'));
    var sections=Array.prototype.slice.call(root.querySelectorAll('[data-m2iu-section]'));
    var tips=Array.prototype.slice.call(root.querySelectorAll('[data-m2iu-tip]'));
    var tipSections=Array.prototype.slice.call(root.querySelectorAll('[data-m2iu-tip-section]'));
    function apply(){
      var q=(search.value||'').trim().toLowerCase();
      var visible=0;
      rows.forEach(function(row){
        var show=(!q||row.dataset.search.indexOf(q)!==-1)&&(!dungeon.value||row.dataset.dungeon===dungeon.value)&&(!response.value||row.dataset.response===response.value)&&(!priority.value||row.dataset.priority===priority.value);
        row.hidden=!show;
        if(show)visible++;
      });
      sections.forEach(function(section){
        var sectionVisible=section.querySelectorAll('[data-m2iu-row]:not([hidden])').length;
        var total=Number(section.dataset.total||0);
        section.hidden=sectionVisible===0;
        section.querySelector('[data-m2iu-section-count]').textContent=sectionVisible===total?total+' entries':sectionVisible+' of '+total+' entries';
      });
      tips.forEach(function(tip){
        tip.hidden=!((!q||tip.dataset.search.indexOf(q)!==-1)&&(!dungeon.value||tip.dataset.dungeon===dungeon.value));
      });
      tipSections.forEach(function(section){section.hidden=!section.querySelector('[data-m2iu-tip]:not([hidden])');});
      status.textContent=visible+' of '+rows.length+' entries shown';
    }
    [search,dungeon,response,priority].forEach(function(control){control.addEventListener(control===search?'input':'change',apply);});
    reset.addEventListener('click',function(){search.value='';dungeon.value='';response.value='';priority.value='';apply();search.focus();});
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  document.addEventListener('astro:page-load',init);
})();`;

  return (
    `<div id="m2iu-root"><style${nonceAttr(NONCE_PLACEHOLDER)}>${css}</style>` +
    `<section class="m2iu-hero">` +
    `<p class="m2iu-eyebrow">Midnight Season 2 · Mythic+</p>` +
    `<h2 class="m2iu-title">Interrupt and utility explorer</h2>` +
    `<p class="m2iu-lede">Every verified entry from the companion workbook is available here. Filter by dungeon, response, or priority before a key, then use the source link when you need the full encounter context.</p>` +
    `<div class="m2iu-stats" role="group" aria-label="Guide coverage">` +
    `<div class="ui-panel m2iu-stat"><strong>${rows.length}</strong><span>verified entries</span></div>` +
    `<div class="ui-panel m2iu-stat"><strong>${researchData.dungeons.length}</strong><span>Season 2 dungeons</span></div>` +
    `<div class="ui-panel m2iu-stat"><strong>${interruptCount}</strong><span>interrupts</span></div>` +
    `<div class="ui-panel m2iu-stat"><strong>${stopCount + utilityCount}</strong><span>CC and utility entries</span></div>` +
    `</div>` +
    `<div class="m2iu-sheet"><p class="m2iu-sheet-copy">Prefer a second-monitor table? The Google Sheet contains the same dataset in a shareable workbook view.</p><a class="m2iu-sheet-link" href="${esc(researchData.sheetUrl)}" target="_blank" rel="noopener noreferrer">Open Google Sheet ↗</a></div>` +
    `</section>` +
    `<details class="m2iu-community"><summary class="m2iu-community-summary">Community tips and tricks <span>${communityData.tips.length} curated tips</span></summary>` +
    `<div class="m2iu-community-body"><p class="m2iu-community-note">These are curated community reports from the <a href="${esc(communityData.threadUrl)}" target="_blank" rel="noopener noreferrer">r/CompetitiveWoW Season 2 megathread ↗</a>, captured ${esc(communityData.capturedAt)}. They can be hotfixed or route-dependent, so confidence labels and direct discussion links are included.</p>${tipSections}</div></details>` +
    `<div class="m2iu-toolbar" aria-label="Filter the cheat sheet">` +
    `<label class="m2iu-field">Search<input class="ui-control m2iu-input" id="m2iu-search" type="search" placeholder="Enemy, ability, action…" autocomplete="off"></label>` +
    `<label class="m2iu-field">Dungeon<select class="ui-control m2iu-select" id="m2iu-dungeon"><option value="">All dungeons</option>${dungeonOptions}</select></label>` +
    `<label class="m2iu-field">Response<select class="ui-control m2iu-select" id="m2iu-response"><option value="">All responses</option>${responseOptions}</select></label>` +
    `<label class="m2iu-field">Priority<select class="ui-control m2iu-select" id="m2iu-priority"><option value="">All priorities</option>${priorityOptions}</select></label>` +
    `<button class="m2iu-reset" id="m2iu-reset" type="button">Reset filters</button>` +
    `</div>` +
    `<noscript><p class="m2iu-noscript">Filtering needs JavaScript, but all ${rows.length} entries remain visible below.</p></noscript>` +
    `<p class="m2iu-status" id="m2iu-status" role="status" aria-live="polite">${rows.length} of ${rows.length} entries shown</p>` +
    sections +
    `<p class="m2iu-status">Research verified ${esc(researchData.verifiedAt)}. Dungeon mechanics can change with hotfixes; use each row's guide link for encounter context.</p>` +
    `<script${nonceAttr(NONCE_PLACEHOLDER)}>${clientJs}<\/script></div>`
  );
}

// See assisted-combat-analysis.ts for why this is memoized with a nonce
// placeholder instead of the real per-request value.
const NONCE_PLACEHOLDER = "__CSP_NONCE_PLACEHOLDER__";
let cachedHtml: string | null = null;

export function generateMidnightS2Interrupts(_attrs: Record<string, string>, nonce?: string): string {
  if (cachedHtml === null) cachedHtml = buildHtml();
  return nonce
    ? cachedHtml.replaceAll(NONCE_PLACEHOLDER, nonce)
    : cachedHtml.replaceAll(` nonce="${NONCE_PLACEHOLDER}"`, "");
}
