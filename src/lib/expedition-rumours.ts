import { nonceAttr } from "./csp";

interface Rumour {
  id: string;
  type: "Unique Map" | "Rumour" | "Powerful Boss" | "Boss Encounter";
  name: string;
  map: string;
  aldursOk: boolean;
}

const RUMOURS: Rumour[] = [
  // Unique Maps — only Fallen Skies is safe with Aldur's
  { id: "fallen-skies",       type: "Unique Map",     name: "Fallen Skies",         map: "Moor of Fallen Skies",  aldursOk: true  },
  { id: "all-that-glitters",  type: "Unique Map",     name: "All that Glitters",    map: "Castaway",              aldursOk: false },
  { id: "reflective-waters",  type: "Unique Map",     name: "Reflective Waters",    map: "Lake of Kalandra",      aldursOk: false },
  { id: "almost-paradise",    type: "Unique Map",     name: "Almost Paradise",      map: "Untainted Paradise",    aldursOk: false },
  { id: "a-good-fellow",      type: "Unique Map",     name: "A Good Fellow...",     map: "Moment of Zen",         aldursOk: false },

  // Rumours — all OK with Aldur's
  { id: "endless-cliffs",     type: "Rumour",         name: "Endless Cliffs",       map: "Craggy Peninsula",      aldursOk: true  },
  { id: "sulphite",           type: "Rumour",         name: "Sulphite!",            map: "Scorched Cay",          aldursOk: true  },
  { id: "cold-as-ice",        type: "Rumour",         name: "Cold as Ice",          map: "Frigid Bluffs",         aldursOk: true  },
  { id: "unknown-ruins",      type: "Rumour",         name: "Unknown Ruins",        map: "Exhumed Ruins",         aldursOk: true  },
  { id: "warm-but-risky",     type: "Rumour",         name: "Warm but Risky",       map: "Grazed Prairie",        aldursOk: true  },
  { id: "wild-roaming-free",  type: "Rumour",         name: "Wild, Roaming Free",   map: "Lush Island",           aldursOk: true  },
  { id: "something-fishy",    type: "Rumour",         name: "Something Fishy",      map: "Bleached Shoals",       aldursOk: true  },
  { id: "nothing-to-drink",   type: "Rumour",         name: "Nothing to Drink",     map: "Stagnant Basin",        aldursOk: true  },
  { id: "its-dry-at-least",   type: "Rumour",         name: "It's Dry at Least",   map: "Sloughed Gully",        aldursOk: true  },
  { id: "bleak-and-awful",    type: "Rumour",         name: "Bleak and Awful",      map: "Barren Atoll",          aldursOk: true  },

  // Boss types — never safe with Aldur's
  { id: "crazed-chieftain",   type: "Powerful Boss",  name: "Crazed Chieftain...", map: "Jade Isles",            aldursOk: false },
  { id: "stardrinker",        type: "Boss Encounter", name: "Stardrinker...",       map: "Secluded Temple",       aldursOk: false },
  { id: "origin-of-the-fall", type: "Boss Encounter", name: "Origin of the Fall...", map: "Obscure Island",      aldursOk: false },
  { id: "the-last-to-fall",   type: "Boss Encounter", name: "The Last to Fall...", map: "Mournful Cliffside",    aldursOk: false },
  { id: "end-of-the-circle",  type: "Boss Encounter", name: "End of the Circle...", map: "Sprawling Jungle",     aldursOk: false },
];

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateExpeditionRumourSheet(_attrs: Record<string, string>, nonce?: string): string {
  const sorted = [...RUMOURS].sort((a, b) => a.name.localeCompare(b.name));

  const cardsHtml = sorted.map(r => {
    const warnClass = !r.aldursOk ? " ers-card--warn" : "";
    const search = esc(r.name.toLowerCase());
    return (
      `<button type="button" class="ers-card${warnClass}" ` +
      `data-id="${esc(r.id)}" data-type="${esc(r.type)}" data-name="${esc(r.name)}" data-search="${search}" ` +
      `aria-pressed="false">` +
      `<span class="ers-name">${esc(r.name)}</span>` +
      `<span class="ers-map">${esc(r.map)}</span>` +
      `</button>`
    );
  }).join("");

  const css = `
#ers-root{font-family:inherit;margin:0;}
#ers-root *{box-sizing:border-box;}

#ers-root .ers-filter-label{display:block;margin-bottom:.4rem;font-size:.85rem;font-weight:600;color:var(--text,#e9eef9);}
#ers-root .ers-filter-row{display:flex;gap:.4rem;margin-bottom:.6rem;}
#ers-filter{flex:1;min-height:44px;padding:.55rem .85rem;font-size:.9rem;transition:border-color .12s;}
#ers-filter::placeholder{color:var(--muted,#a3aec9);}
#ers-filter:focus{border-color:var(--accent,#70d0ff);}
#ers-filter:focus-visible{outline:2px solid var(--accent,#70d0ff);outline-offset:2px;}
#ers-filter-clear{min-width:44px;padding:.45rem .65rem;cursor:pointer;font-size:.85rem;line-height:1;transition:color .12s,border-color .12s;display:none;}
#ers-filter-clear.visible{display:block;}
#ers-filter-clear:hover{color:var(--text,#e9eef9);border-color:var(--muted,#a3aec9);}

#ers-root .ers-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-bottom:.75rem;}
#ers-root .ers-card.ers-hidden{display:none;}

#ers-root .ers-card{display:flex;flex-direction:column;gap:.2rem;min-height:44px;padding:.6rem .75rem;background:var(--surface,#0f1326);border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);cursor:pointer;text-align:left;transition:border-color .12s,background .12s;font:inherit;color:inherit;width:100%;}
#ers-root .ers-card:hover{border-color:var(--accent,#70d0ff);background:rgb(from var(--accent) r g b / .05);}
#ers-root .ers-card[aria-pressed="true"]{border-color:var(--accent,#70d0ff);background:rgb(from var(--accent) r g b / .1);box-shadow:0 0 0 1px var(--accent,#70d0ff);}
#ers-root .ers-card--warn{border-color:rgba(255,96,128,.25);}
#ers-root .ers-card--warn:hover{border-color:#ff6080;background:rgba(255,60,128,.05);}
#ers-root .ers-card--warn[aria-pressed="true"]{border-color:#ff6080;background:rgba(255,60,128,.1);box-shadow:0 0 0 1px #ff6080;}

#ers-root .ers-name{font-size:.85rem;font-weight:600;color:var(--text,#e9eef9);line-height:1.2;}
#ers-root .ers-map{font-size:.78rem;color:var(--muted,#a3aec9);line-height:1.25;}

#ers-root .ers-footer{display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;}
#ers-root .ers-hint{font-size:.8rem;color:var(--muted,#a3aec9);}
#ers-root .ers-hint span{color:rgba(255,96,128,.7);}
#ers-root .ers-reset{min-height:36px;color:var(--muted,#a3aec9);padding:.3rem .9rem;border-radius:var(--r-pill,999px);cursor:pointer;font-size:.8rem;transition:color .12s,border-color .12s;}
#ers-root .ers-reset:hover{color:var(--text,#e9eef9);border-color:var(--muted,#a3aec9);}

#ers-root .ers-verdict{display:flex;align-items:center;gap:1rem;padding:1.15rem 1.35rem;border-radius:var(--r-lg,16px);border:1px solid;transition:background .2s,border-color .2s,color .2s;}
#ers-root .ers-verdict--neutral{background:rgba(255,255,255,.02);border-color:var(--line,#1d2442);color:var(--muted,#a3aec9);}
#ers-root .ers-verdict--safe{background:rgba(168,255,96,.08);border-color:rgba(168,255,96,.4);color:#a8ff60;}
#ers-root .ers-verdict--danger{background:rgba(255,60,128,.08);border-color:rgba(255,60,128,.4);color:#ff6080;}
#ers-root .ers-verdict--warn{background:rgba(255,170,64,.08);border-color:rgba(255,170,64,.4);color:#ffaa40;}
#ers-root .ers-verdict__icon{font-size:1.6rem;flex-shrink:0;line-height:1;width:2rem;text-align:center;}
#ers-root .ers-verdict__body{flex:1;min-width:0;}
#ers-root .ers-verdict__main{font-family:var(--font-display);font-weight:600;font-size:1.05rem;}
#ers-root .ers-verdict__sub{font-size:.8rem;margin-top:.15rem;opacity:.85;line-height:1.4;}
#ers-root .ers-verdict__count{font-family:var(--font-display);font-size:2rem;font-weight:600;opacity:.25;flex-shrink:0;line-height:1;}

#ers-root .ers-meta{display:flex;justify-content:space-between;align-items:center;margin:.75rem 0 0;font-size:.75rem;gap:1rem;}
#ers-root .ers-credit{color:var(--muted,#a3aec9);}
#ers-root .ers-credit a, #ers-root .ers-report-link{color:var(--muted,#a3aec9);text-decoration:none;}
#ers-root .ers-credit a:hover, #ers-root .ers-report-link:hover{color:var(--accent,#70d0ff);}

@media(max-width:600px){#ers-root .ers-grid{grid-template-columns:repeat(2,1fr);}}
  `.trim();

  const js = `
(function(){
  function init(){
  var root=document.getElementById('ers-root');
  if(!root||root.dataset.ersInit)return;
  root.dataset.ersInit='1';

  var sel=new Set();
  var verdict=document.getElementById('ers-verdict');
  var iconEl=document.getElementById('ers-icon');
  var mainEl=document.getElementById('ers-main');
  var subEl=document.getElementById('ers-sub');
  var cntEl=document.getElementById('ers-count');

  function update(){
    if(!verdict)return;
    var count=sel.size;
    var status,icon,main,sub;
    if(count===0){
      status='neutral';icon='○';
      main="Select your logbook's active rumours above";sub='';
    } else {
      var cards=Array.from(sel).map(function(id){
        return document.querySelector('#ers-root .ers-card[data-id="'+id+'"]');
      }).filter(Boolean);
      var boss=cards.find(function(c){return c.dataset.type==='Powerful Boss'||c.dataset.type==='Boss Encounter';});
      var badMap=cards.find(function(c){return c.dataset.type==='Unique Map'&&c.dataset.id!=='fallen-skies';});
      if(boss){
        status='danger';icon='✗';main="Don't use Aldur's Saga";
        sub='Boss encounter present ('+boss.dataset.name+'): Aldur\\'s may alter or remove the boss node';
      } else if(badMap){
        status='danger';icon='✗';main="Don't use Aldur's Saga";
        sub='Unique Map present ('+badMap.dataset.name+'): Fallen Skies is the only safe Unique Map';
      } else if(count<3){
        status='warn';icon='⚠';main="Don't use Aldur's Saga";
        sub='Only '+count+' rumour'+(count===1?'':'s')+' selected: need at least 3 (less content otherwise)';
      } else {
        status='safe';icon='✓';main="Safe to use Aldur's Saga!";
        sub=count+' rumour'+(count===1?'':'s')+', no boss, no problematic unique map';
      }
    }
    verdict.className='ers-verdict ers-verdict--'+status;
    if(iconEl.textContent!==icon)iconEl.textContent=icon;
    if(mainEl.textContent!==main)mainEl.textContent=main;
    if(subEl.textContent!==sub)subEl.textContent=sub;
    cntEl.textContent=count>0?String(count):'';
  }

  document.querySelectorAll('#ers-root .ers-card').forEach(function(card){
    card.addEventListener('click',function(){
      var id=this.dataset.id;
      if(sel.has(id)){sel.delete(id);this.setAttribute('aria-pressed','false');}
      else{sel.add(id);this.setAttribute('aria-pressed','true');}
      update();
    });
  });

  var resetBtn=document.getElementById('ers-reset');
  if(resetBtn){resetBtn.addEventListener('click',function(){
    sel.clear();
    document.querySelectorAll('#ers-root .ers-card').forEach(function(c){c.setAttribute('aria-pressed','false');});
    update();
  });}

  var filterEl=document.getElementById('ers-filter');
  var filterClear=document.getElementById('ers-filter-clear');
  function applyFilter(q){
    var cards=document.querySelectorAll('#ers-root .ers-card');
    cards.forEach(function(c){
      var match=!q||c.dataset.search.indexOf(q)!==-1||c.getAttribute('aria-pressed')==='true';
      c.classList.toggle('ers-hidden',!match);
    });
    if(filterClear)filterClear.classList.toggle('visible',q.length>0);
  }
  if(filterEl){
    filterEl.addEventListener('input',function(){applyFilter(this.value.toLowerCase().trim());});
  }
  if(filterClear){
    filterClear.addEventListener('click',function(){
      if(filterEl)filterEl.value='';
      applyFilter('');
      if(filterEl)filterEl.focus();
    });
  }

  update();
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else {
    init();
  }
  document.addEventListener('astro:page-load',init);
})();
  `.trim();

  return (
    `<div id="ers-root">` +
    `<style${nonceAttr(nonce)}>${css}</style>` +
    `<label class="ers-filter-label" for="ers-filter">Filter rumours</label>` +
    `<div class="ers-filter-row">` +
    `<input class="ui-control" type="text" id="ers-filter" placeholder="Filter by rumour name…" autocomplete="off" spellcheck="false">` +
    `<button class="ui-action" type="button" id="ers-filter-clear" aria-label="Clear filter">✕</button>` +
    `</div>` +
    `<div class="ers-grid">${cardsHtml}</div>` +
    `<div class="ers-footer">` +
    `<span class="ers-hint"><span>■</span> = no Aldur's (boss / unique map)</span>` +
    `<button type="button" class="ui-action ers-reset" id="ers-reset">Clear</button>` +
    `</div>` +
    `<div id="ers-verdict" role="status" aria-atomic="true" class="ers-verdict ers-verdict--neutral">` +
    `<div class="ers-verdict__icon" id="ers-icon" aria-hidden="true">○</div>` +
    `<div class="ers-verdict__body">` +
    `<div class="ers-verdict__main" id="ers-main">Select your logbook's active rumours above</div>` +
    `<div class="ers-verdict__sub" id="ers-sub"></div>` +
    `</div>` +
    `<div class="ers-verdict__count" id="ers-count" aria-hidden="true"></div>` +
    `</div>` +
    `<script${nonceAttr(nonce)}>${js}<\/script>` +
    `<div class="ers-meta">` +
    `<span class="ers-credit">Data from <a href="https://docs.google.com/spreadsheets/d/1d5FFDUSgoL2WNbEwv1gkBra3ALnI4UsdokksSADxx_0/edit?gid=1976406181#gid=1976406181" target="_blank" rel="noopener">Dracorath's Expedition Explained</a></span>` +
    `<a class="ers-report-link" href="https://github.com/jmusick/orboro-net/issues" target="_blank" rel="noopener">Report errors or issues</a>` +
    `</div>` +
    `</div>`
  );
}
