import { nonceAttr } from "./csp";

type SimulationResult = {
  windowMs: number;
  gcd: number;
  clean: number;
  gap: number;
  early: number;
  uptime: number;
  averageGap: number;
};

const DEFAULTS = {
  gcd: 1000,
  latency: 40,
  cadence: 250,
  jitter: 30,
};

const FIGHT_LENGTHS_MS = [60_000, 180_000, 300_000, 480_000];

function lostCasts(gcd: number, averageGap: number, fightMs: number): number {
  if (!averageGap) return 0;
  return Math.round((fightMs * averageGap) / (gcd * (gcd + averageGap)));
}

function simulateWindow(windowMs: number): SimulationResult {
  const { gcd, latency, cadence, jitter } = DEFAULTS;
  let ready = gcd;
  let time = 0;
  let completed = 0;
  let clean = 0;
  let gap = 0;
  let early = 0;
  let queued = false;
  let guard = 0;

  while (completed < 30 && guard < 10000) {
    const variation = Math.sin(guard * 2.117 + 0.7) * jitter;
    time += Math.max(20, cadence + variation);
    const arrival = time + latency / 2;

    if (queued && arrival >= ready) {
      completed += 1;
      clean += 1;
      queued = false;
      ready += gcd;
      guard += 1;
      if (completed >= 30) break;
      continue;
    }

    if (arrival >= ready) {
      gap += arrival - ready;
      completed += 1;
      ready = arrival + gcd;
    } else if (arrival >= ready - windowMs) {
      queued = true;
    } else {
      early += 1;
    }
    guard += 1;
  }

  const uptime = completed ? (completed * gcd) / (completed * gcd + gap) * 100 : 0;
  return {
    windowMs,
    gcd,
    clean,
    gap,
    early,
    uptime,
    averageGap: completed ? gap / completed : 0,
  };
}

function resultCard(result: SimulationResult): string {
  const label = result.windowMs ? String(result.windowMs) : "Off";
  const unit = result.windowMs ? "ms SQW" : "SQW";
  const selected = result.windowMs === 250 ? " selected" : "";
  const quality = result.uptime >= 99.95 ? "Gapless" : result.uptime >= 99 ? "Minor gaps" : "Visible gaps";
  const lostGrid = FIGHT_LENGTHS_MS
    .map((ms) => {
      const minutes = ms / 60_000;
      const lost = lostCasts(result.gcd, result.averageGap, ms);
      return `<div><strong>${lost}</strong><small>${minutes} min</small></div>`;
    })
    .join("");
  return (
    `<article class="ui-panel sql-result-card${selected}">` +
    `<h3 class="sql-result-title">${label} <span>${unit}</span></h3>` +
    `<div class="sql-score"><strong>${result.uptime.toFixed(2)}%</strong><span>GCD uptime</span></div>` +
    `<progress class="sql-bar" max="100" value="${result.uptime.toFixed(2)}" aria-hidden="true"></progress>` +
    `<dl>` +
    `<div><dt>Average gap</dt><dd>${result.averageGap.toFixed(1)} ms</dd></div>` +
    `<div><dt>Total gap, 30 casts</dt><dd>${Math.round(result.gap)} ms</dd></div>` +
    `<div><dt>Early presses ignored</dt><dd>${result.early}</dd></div>` +
    `<div><dt>Result</dt><dd>${quality}</dd></div>` +
    `</dl>` +
    `<p class="sql-lost-label">Casts lost over a fight</p>` +
    `<div class="sql-lost-grid">${lostGrid}</div>` +
    `</article>`
  );
}

const initialCards = [0, 100, 250, 400].map(simulateWindow).map(resultCard).join("");

const css = `
#sql-root{font-family:inherit;margin:0;color:var(--text,#e9eef9);}
#sql-root *{box-sizing:border-box;}
#sql-root button,#sql-root input{font:inherit;}
#sql-root button{color:inherit;}
#sql-root .sql-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;}

#sql-root .sql-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:1.25rem;margin:1.5rem 0 1rem;padding:1rem 1.1rem;border:1px solid rgb(from var(--accent) r g b / 24%);border-radius:var(--r-md,10px);background:rgb(from var(--accent) r g b / 5%);}
#sql-root p.sql-intro-copy{max-width:880px;margin:0;color:var(--muted,#a3aec9);font-size:.9rem;line-height:1.65;}
#sql-root .sql-intro-copy strong{color:var(--text,#e9eef9);}
#sql-root .sql-retail{flex:none;padding:.3rem .55rem;border:1px solid rgb(168 255 96 / 28%);border-radius:var(--r-pill,999px);color:var(--accent-3,#a8ff60);font-size:.78rem;font-weight:700;white-space:nowrap;}

#sql-root .sql-workspace{display:grid;grid-template-columns:minmax(245px,310px) minmax(0,1fr);gap:1rem;align-items:start;}
#sql-root .sql-panel{min-width:0;overflow:hidden;}
#sql-root .sql-controls{padding:1.05rem;}
#sql-root .sql-eyebrow{margin:0 0 .35rem;color:var(--accent,#70d0ff);font-size:.78rem;font-weight:700;}
#sql-root h2.sql-heading{margin:0;padding:0;border:0;color:var(--text,#e9eef9);font-family:var(--font-display);font-size:1.25rem;font-weight:600;line-height:1.25;}
#sql-root p.sql-copy{margin:.5rem 0 1rem;color:var(--muted,#a3aec9);font-size:.82rem;line-height:1.55;}

#sql-root .sql-control{margin-top:.85rem;padding-top:.85rem;border-top:1px solid var(--line,#1d2442);}
#sql-root .sql-control-head{display:flex;align-items:baseline;justify-content:space-between;gap:.75rem;margin-bottom:.45rem;}
#sql-root .sql-control-head label{color:var(--text,#e9eef9);font-size:.78rem;font-weight:700;}
#sql-root .sql-value{color:var(--accent,#70d0ff);font-family:var(--font-code);font-size:.72rem;font-variant-numeric:tabular-nums;}
#sql-root input[type="range"]{display:block;width:100%;margin:0;accent-color:var(--accent,#70d0ff);cursor:pointer;}
#sql-root .sql-range-notes{display:flex;justify-content:space-between;margin-top:.2rem;color:var(--muted,#a3aec9);font-size:.7rem;}
#sql-root .sql-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.35rem;margin-top:.5rem;}
#sql-root #sql-timer-fill{width:100%;}
#sql-root p.sql-copy.sql-rhythm-copy{margin:.5rem 0 0;}
#sql-root .sql-example-press--early{--press:45%;--marker:var(--muted);}
#sql-root .sql-example-press--queued{--press:78%;--marker:var(--accent-2);}
#sql-root .sql-example-press--late{--press:96%;--marker:var(--warning);}
#sql-root .sql-dot--early{background:var(--muted);}
#sql-root .sql-dot--queued{background:var(--accent-2);}
#sql-root .sql-dot--ready{background:var(--accent);}
#sql-root .sql-timer-track{height:.5rem;margin-top:.5rem;border-radius:var(--r-pill,999px);overflow:hidden;background:var(--bg,#070914);}
#sql-root .sql-timer-track i{display:block;height:100%;border-radius:inherit;background:var(--accent);transition:width .2s linear;}
#sql-root dl.sql-rhythm-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.4rem;margin:.65rem 0 0;}
#sql-root .sql-rhythm-stats div{padding:.5rem .6rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);background:var(--surface,#0f1326);}
#sql-root .sql-rhythm-stats dt{margin:0 0 .2rem;color:var(--muted,#a3aec9);font-size:.7rem;}
#sql-root .sql-rhythm-stats dd{margin:0;color:var(--accent,#70d0ff);font-size:.95rem;font-weight:700;font-variant-numeric:tabular-nums;}
#sql-root button.sql-chip{min-width:0;padding:.38rem .15rem;color:var(--muted,#a3aec9);font-size:.7rem;cursor:pointer;transition:color .15s ease,border-color .15s ease,background .15s ease;}
#sql-root button.sql-chip:hover,#sql-root button.sql-chip.active{border-color:rgb(from var(--accent) r g b / 55%);background:rgb(from var(--accent) r g b / 8%);color:var(--accent,#70d0ff);}
#sql-root button.sql-primary,#sql-root button.sql-secondary{display:block;width:100%;min-height:44px;border-radius:var(--r-pill,999px);font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease;}
#sql-root button.sql-primary{margin-top:1rem;padding:.72rem .8rem;border:1px solid var(--accent,#70d0ff);background:var(--accent,#70d0ff);color:var(--accent-ink,#06101c);}
#sql-root button.sql-primary:hover{background:var(--accent-hover);}
#sql-root button.sql-secondary{margin-top:.45rem;padding:.62rem .8rem;border:1px solid rgb(from var(--accent) r g b / 30%);background:rgb(from var(--accent) r g b / 5%);color:var(--accent,#70d0ff);}
#sql-root button.sql-secondary:hover{border-color:rgb(from var(--accent) r g b / 55%);background:rgb(from var(--accent) r g b / 9%);}
#sql-root button.sql-primary:focus-visible{outline:2px solid var(--accent,#70d0ff);outline-offset:3px;}
#sql-root p.sql-shortcut{margin:.5rem 0 0;text-align:center;color:var(--muted,#a3aec9);font-size:.7rem;}
#sql-root kbd{padding:.08rem .3rem;border:1px solid var(--line,#1d2442);border-bottom-width:2px;border-radius:var(--r-sm,6px);background:var(--surface,#0f1326);color:var(--text,#e9eef9);font-family:inherit;}

#sql-root .sql-stage{padding:1.05rem;}
#sql-root .sql-stage-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin-bottom:.85rem;}
#sql-root p.sql-stage-copy{margin:.25rem 0 0;color:var(--muted,#a3aec9);font-size:.78rem;}
#sql-root .sql-live{display:flex;align-items:center;gap:.4rem;color:var(--muted,#a3aec9);font-size:.7rem;white-space:nowrap;}
#sql-root .sql-live[hidden]{display:none;}
#sql-root .sql-live::before{content:"";width:.38rem;height:.38rem;border-radius:50%;background:var(--accent-3,#a8ff60);}
#sql-root .sql-live.stopped::before{background:var(--muted,#a3aec9);box-shadow:none;}
#sql-root .sql-timeline-wrap{padding:.85rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:var(--bg-deep,#05070f);overflow:hidden;}
#sql-root .sql-scale{display:grid;grid-template-columns:repeat(5,1fr);margin:0 .15rem .35rem;color:var(--muted,#a3aec9);font-size:.7rem;}
#sql-root .sql-scale span:not(:first-child){text-align:right;}
#sql-root .sql-track{position:relative;height:88px;border:1px solid rgb(from var(--accent) r g b / 20%);border-radius:var(--r-md,10px);overflow:hidden;background:linear-gradient(90deg,rgb(from var(--accent) r g b / 11%),rgb(from var(--accent) r g b / 2%));}
#sql-root .sql-track::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 1px),rgb(255 255 255 / 4%) calc(10% - 1px) 10%);pointer-events:none;}
#sql-root .sql-queue-band{position:absolute;z-index:1;inset:0 0 0 auto;width:25%;border-left:1px dashed rgb(255 63 184 / 90%);background:linear-gradient(90deg,rgb(255 63 184 / 3%),rgb(255 63 184 / 19%));transition:width .18s ease;}
#sql-root .sql-queue-band span{position:absolute;top:.45rem;left:.55rem;color:var(--accent-2,#ff3fb8);font-size:.78rem;font-weight:700;}
#sql-root .sql-cursor{position:absolute;z-index:4;top:0;bottom:0;left:0;width:2px;background:var(--text,#e9eef9);transform:translateX(-1px);}
#sql-root .sql-pulse{position:absolute;z-index:5;bottom:.7rem;width:.55rem;height:.55rem;border-radius:50%;transform:translateX(-50%);animation:sql-pop .45s ease-out forwards;}
#sql-root .sql-pulse.early{background:var(--muted,#a3aec9);}
#sql-root .sql-pulse.queued{background:var(--accent-2,#ff3fb8);}
#sql-root .sql-pulse.cast{background:var(--accent,#70d0ff);}
@keyframes sql-pop{0%{scale:.4;opacity:.15}45%{scale:1.25;opacity:1}100%{scale:1;opacity:.88}}
#sql-root .sql-track-labels{display:flex;justify-content:space-between;gap:.5rem;margin-top:.4rem;color:var(--muted,#a3aec9);font-size:.7rem;}
#sql-root .sql-legend{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:.6rem;color:var(--muted,#a3aec9);font-size:.7rem;}
#sql-root .sql-legend span{display:flex;align-items:center;gap:.3rem;}
#sql-root .sql-dot{width:.38rem;height:.38rem;border-radius:50%;}

#sql-root .sql-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.5rem;margin-top:.65rem;}
#sql-root .sql-metric{min-width:0;padding:.7rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:rgb(from var(--surface) r g b / 55%);}
#sql-root .sql-metric span{display:block;margin-bottom:.25rem;color:var(--muted,#a3aec9);font-size:.7rem;line-height:1.25;}
#sql-root .sql-metric strong{color:var(--text,#e9eef9);font-family:var(--font-display);font-size:1.05rem;font-weight:600;font-variant-numeric:tabular-nums;}
#sql-root .sql-metric small{margin-left:.18rem;color:var(--muted,#a3aec9);font-size:.7rem;}
#sql-root .sql-event{display:flex;align-items:center;gap:.45rem;min-height:2.55rem;margin-top:.65rem;padding:.62rem .72rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);color:var(--muted,#a3aec9);font-size:.72rem;line-height:1.4;}
#sql-root .sql-event::before{content:"";flex:0 0 auto;width:.42rem;height:.42rem;border-radius:50%;background:var(--muted,#a3aec9);}
#sql-root .sql-event.queued::before{background:var(--accent-2,#ff3fb8);}
#sql-root .sql-event.cast::before{background:var(--accent,#70d0ff);}
#sql-root .sql-callout{margin-top:.65rem;padding:.72rem;border:1px solid rgb(255 63 184 / 24%);border-radius:var(--r-md,10px);background:rgb(255 63 184 / 4%);color:var(--muted,#a3aec9);font-size:.7rem;line-height:1.5;}
#sql-root .sql-callout strong{color:var(--text,#e9eef9);}

#sql-root .sql-bench{margin-top:1rem;padding:1.05rem;}
#sql-root .sql-bench-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin-bottom:.85rem;}
#sql-root p.sql-bench-copy{max-width:760px;margin:.25rem 0 0;color:var(--muted,#a3aec9);font-size:.78rem;line-height:1.5;}
#sql-root .sql-run-summary{padding:.38rem .58rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-pill,999px);background:var(--surface,#0f1326);color:var(--muted,#a3aec9);font-size:.7rem;white-space:nowrap;}
#sql-root .sql-compare-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.55rem;}
#sql-root .sql-result-card{position:relative;min-width:0;padding:.8rem;}
#sql-root .sql-result-card.selected{border-color:rgb(from var(--accent) r g b / 46%);}
#sql-root .sql-result-card.selected::before{content:"Selected";position:absolute;top:.58rem;right:.58rem;color:var(--accent,#70d0ff);font-size:.78rem;font-weight:700;}
#sql-root h3.sql-result-title{margin:0 0 .7rem;color:var(--text,#e9eef9);font-size:.85rem;}
#sql-root .sql-result-title span{margin-left:.1rem;color:var(--muted,#a3aec9);font-size:.7rem;font-weight:500;}
#sql-root .sql-score{display:flex;align-items:baseline;gap:.3rem;margin-bottom:.4rem;}
#sql-root .sql-score strong{font-family:var(--font-display);font-size:1.3rem;font-weight:600;font-variant-numeric:tabular-nums;}
#sql-root .sql-score span{color:var(--muted,#a3aec9);font-size:.7rem;}
#sql-root .sql-bar{display:block;width:100%;appearance:none;border:0;height:.34rem;margin-bottom:.6rem;border-radius:var(--r-pill,999px);overflow:hidden;background:var(--bg,#070914);}
#sql-root .sql-bar::-webkit-progress-bar{background:var(--bg,#070914);border-radius:inherit;}
#sql-root .sql-bar::-webkit-progress-value{background:var(--accent);border-radius:inherit;}
#sql-root .sql-bar::-moz-progress-bar{background:var(--accent);border-radius:inherit;}
#sql-root .sql-result-card dl{display:grid;gap:.32rem;margin:0;}
#sql-root .sql-result-card dl div{display:flex;justify-content:space-between;gap:.5rem;font-size:.7rem;line-height:1.3;}
#sql-root .sql-result-card dt{color:var(--muted,#a3aec9);}
#sql-root .sql-result-card dd{margin:0;color:var(--text,#e9eef9);font-variant-numeric:tabular-nums;text-align:right;}
#sql-root p.sql-lost-label{margin:.75rem 0 .4rem;padding-top:.65rem;border-top:1px solid var(--line,#1d2442);color:var(--muted,#a3aec9);font-size:.78rem;font-weight:700;}
#sql-root .sql-lost-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.3rem;}
#sql-root .sql-lost-grid div{padding:.4rem .3rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);background:rgb(from var(--bg) r g b / 40%);text-align:center;}
#sql-root .sql-lost-grid strong{display:block;color:var(--accent-2,#ff3fb8);font-size:.92rem;font-variant-numeric:tabular-nums;}
#sql-root .sql-lost-grid small{display:block;margin-top:.15rem;color:var(--muted,#a3aec9);font-size:.7rem;}
#sql-root .sql-notes{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:.55rem;margin-top:.55rem;}
#sql-root .sql-note{padding:.72rem;color:var(--muted,#a3aec9);font-size:.7rem;line-height:1.55;}
#sql-root .sql-note strong{color:var(--text,#e9eef9);}
#sql-root .sql-note code{padding:.08rem .28rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);background:var(--bg,#070914);color:var(--accent,#70d0ff);font-size:.7rem;overflow-wrap:anywhere;}
#sql-root .sql-note a{color:var(--accent,#70d0ff);}

#sql-root .sql-guide{margin-top:1rem;}
#sql-root .sql-guide-head{padding:clamp(1.25rem,3vw,2.25rem);border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);background:var(--surface,#0f1326);}
#sql-root h2.sql-guide-title{max-width:780px;margin:0;padding:0;border:0;color:var(--text,#e9eef9);font-family:var(--font-display);font-size:clamp(1.35rem,2.4vw,1.9rem);font-weight:600;line-height:1.2;}
#sql-root p.sql-guide-lead{max-width:850px;margin:.7rem 0 0;color:var(--muted,#a3aec9);font-size:1rem;line-height:1.7;}
#sql-root .sql-guide-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.38fr);gap:1rem;margin-top:1rem;align-items:start;}
#sql-root .sql-article{min-width:0;padding:clamp(1.15rem,2.5vw,1.75rem);border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);background:var(--surface,#0f1326);}
#sql-root .sql-article-section+ .sql-article-section{margin-top:1.8rem;padding-top:1.8rem;border-top:1px solid var(--line,#1d2442);}
#sql-root h3.sql-article-title{margin:0 0 .6rem;color:var(--text,#e9eef9);font-family:var(--font-display);font-size:1.1rem;font-weight:600;line-height:1.35;}
#sql-root .sql-article p{margin:.65rem 0;color:var(--muted,#a3aec9);font-size:.96rem;line-height:1.72;}
#sql-root .sql-article strong{color:var(--text,#e9eef9);}
#sql-root .sql-article ul,#sql-root .sql-article ol{margin:.7rem 0;padding-left:1.25rem;color:var(--muted,#a3aec9);font-size:.94rem;line-height:1.65;}
#sql-root .sql-article li+li{margin-top:.4rem;}
#sql-root .sql-diagrams{display:grid;gap:.65rem;margin-top:1rem;}
#sql-root figure.sql-diagram{margin:0;padding:.8rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:rgb(from var(--surface) r g b / 48%);}
#sql-root .sql-diagram figcaption{display:flex;align-items:baseline;justify-content:space-between;gap:.75rem;margin-bottom:.58rem;color:var(--text,#e9eef9);font-size:.9rem;font-weight:700;}
#sql-root .sql-diagram figcaption span{color:var(--muted,#a3aec9);font-size:.82rem;font-weight:500;text-align:right;}
#sql-root .sql-example-track{position:relative;height:54px;border:1px solid rgb(from var(--accent) r g b / 18%);border-radius:var(--r-sm,6px);overflow:hidden;background:rgb(from var(--bg) r g b / 62%);}
#sql-root .sql-example-gcd{position:absolute;inset:0 10% 0 0;background:rgb(from var(--accent) r g b / 9%);}
#sql-root .sql-example-window{position:absolute;inset:0 10% 0 auto;width:36%;border-left:1px dashed rgb(255 63 184 / 85%);background:rgb(255 63 184 / 14%);}
#sql-root .sql-example-ready{position:absolute;z-index:2;top:0;bottom:0;right:10%;width:1px;background:var(--accent-3,#a8ff60);}
#sql-root .sql-example-ready::after{content:"GCD ends";position:absolute;right:.3rem;top:.25rem;color:var(--accent-3,#a8ff60);font-size:.76rem;white-space:nowrap;}
#sql-root .sql-example-press{position:absolute;z-index:3;bottom:.55rem;left:var(--press);width:.55rem;height:.55rem;border:2px solid var(--bg,#070914);border-radius:50%;background:var(--marker,var(--muted,#a3aec9));transform:translateX(-50%);}
#sql-root .sql-example-press::before{content:attr(data-label);position:absolute;left:50%;bottom:.75rem;color:var(--text,#e9eef9);font-size:.76rem;font-weight:700;white-space:nowrap;transform:translateX(-50%);}
#sql-root .sql-example-gap{position:absolute;inset:0 0 0 90%;background:repeating-linear-gradient(135deg,rgb(255 189 74 / 18%) 0 5px,rgb(255 189 74 / 6%) 5px 10px);}
#sql-root .sql-example-axis{position:relative;height:1.1em;margin-top:.3rem;color:var(--muted,#a3aec9);font-size:.8rem;}
#sql-root .sql-example-axis span{position:absolute;top:0;white-space:nowrap;}
#sql-root .sql-example-axis span:first-child{left:0;}
#sql-root .sql-example-axis span:nth-child(2){left:54%;transform:translateX(-50%);}
#sql-root .sql-example-axis span:last-child{right:0;text-align:right;}
#sql-root .sql-equation{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;margin-top:1rem;}
#sql-root .sql-equation div{padding:.7rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:rgb(from var(--surface) r g b / 48%);text-align:center;}
#sql-root .sql-equation strong{display:block;color:var(--accent,#70d0ff);font-family:var(--font-display);font-size:1.05rem;font-weight:600;}
#sql-root .sql-equation span{display:block;margin-top:.2rem;color:var(--muted,#a3aec9);font-size:.74rem;line-height:1.35;}
#sql-root .sql-side{display:grid;gap:.65rem;position:sticky;top:1rem;}
#sql-root .sql-side-card{padding:.85rem;}
#sql-root h3.sql-side-title{margin:0 0 .45rem;color:var(--text,#e9eef9);font-size:.98rem;}
#sql-root .sql-side-card p,#sql-root .sql-side-card li{color:var(--muted,#a3aec9);font-size:.84rem;line-height:1.55;}
#sql-root .sql-side-card p{margin:.4rem 0;}
#sql-root .sql-side-card ol{margin:.5rem 0 0;padding-left:1.1rem;}
#sql-root .sql-command{display:block;margin:.45rem 0 0;padding:.55rem .6rem;border:1px solid rgb(from var(--accent) r g b / 22%);border-radius:var(--r-sm,6px);background:var(--bg,#070914);color:var(--accent,#70d0ff);font-family:var(--font-code);font-size:.76rem;overflow-wrap:anywhere;user-select:all;}
#sql-root .sql-source-links{display:grid;gap:.35rem;margin-top:.5rem;}
#sql-root .sql-source-links a{color:var(--accent,#70d0ff);font-size:.82rem;line-height:1.4;}

@media(max-width:900px){
  #sql-root .sql-workspace{grid-template-columns:1fr;}
  #sql-root .sql-metrics{grid-template-columns:repeat(2,minmax(0,1fr));}
  #sql-root .sql-compare-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  #sql-root .sql-guide-grid{grid-template-columns:1fr;}
  #sql-root .sql-side{position:static;grid-template-columns:repeat(2,minmax(0,1fr));}
}
@media(max-width:600px){
  #sql-root .sql-intro,#sql-root .sql-stage-head,#sql-root .sql-bench-head{align-items:flex-start;flex-direction:column;}
  #sql-root .sql-retail{align-self:flex-start;}
  #sql-root .sql-track{height:104px;}
  #sql-root .sql-compare-grid,#sql-root .sql-notes{grid-template-columns:1fr;}
  #sql-root .sql-run-summary{white-space:normal;}
  #sql-root .sql-equation,#sql-root .sql-side{grid-template-columns:1fr;}
  #sql-root .sql-diagram figcaption{align-items:flex-start;flex-direction:column;}
  #sql-root .sql-diagram figcaption span{text-align:left;}
}
@media(prefers-reduced-motion:reduce){#sql-root *,#sql-root *::before,#sql-root *::after{animation-duration:.01ms!important;scroll-behavior:auto!important;}}
`.trim();

const js = `
(function(){
  function init(){
    var root=document.getElementById('sql-root');
    if(!root||root.dataset.sqlInit)return;
    root.dataset.sqlInit='1';
    var get=function(id){return root.querySelector('#'+id);};
    var sqw=get('sql-sqw'),gcd=get('sql-gcd'),latency=get('sql-latency');
    var cursor=get('sql-cursor'),band=get('sql-queue-band'),track=get('sql-track');
    var spellButton=get('sql-spell-button');
    if(!sqw||!gcd||!latency||!cursor||!band||!track||!spellButton)return;
    var TEST_MS=30000;
    var state={started:false,cycleStart:performance.now(),queued:false,casts:0,clean:0,totalGap:0,presses:[],pulses:[],cadence:250,jitter:30,captureActive:false,captureDone:false,captureStart:0,testPresses:[]};
    function settings(){return{sqw:+sqw.value,gcd:+gcd.value,latency:+latency.value,cadence:state.cadence,jitter:state.jitter};}
    function text(id,value){var el=get(id);if(el)el.textContent=value;}
    function renderSettings(){
      var s=settings();
      text('sql-sqw-value',s.sqw+' ms');text('sql-gcd-value',(s.gcd/1000).toFixed(2)+' s');text('sql-latency-value',s.latency+' ms');
      band.style.width=Math.min(100,s.sqw/s.gcd*100)+'%';text('sql-open-label','Queue opens at '+Math.max(0,s.gcd-s.sqw)+' ms');
      text('sql-run-summary',(s.gcd/1000).toFixed(2)+'s GCD · '+s.cadence+'ms rhythm · ±'+s.jitter+'ms');
      root.querySelectorAll('[data-sqw]').forEach(function(el){var on=+el.dataset.sqw===s.sqw;el.classList.toggle('active',on);el.setAttribute('aria-pressed',on?'true':'false');});
    }
    function addPulse(progress,type){
      var pulse=document.createElement('i');pulse.className='sql-pulse '+type;pulse.style.left=Math.max(1,Math.min(99,progress*100))+'%';track.appendChild(pulse);
      state.pulses.push(pulse);if(state.pulses.length>12){var old=state.pulses.shift();if(old)old.remove();}
    }
    function say(message,type){var el=get('sql-event');if(!el)return;el.textContent=message;el.className='sql-event '+(type||'');}
    function updateMetrics(){
      text('sql-casts',String(state.casts));text('sql-clean',String(state.casts?Math.round(state.clean/state.casts*100):0));text('sql-gap',String(Math.round(state.totalGap)));
      if(state.presses.length>1){
        var diffs=state.presses.slice(1).map(function(t,i){return t-state.presses[i];});
        var mean=diffs.reduce(function(a,b){return a+b;},0)/diffs.length;
        text('sql-interval',String(Math.round(mean)));
      }
    }
    function finishCapture(){
      state.captureActive=false;state.captureDone=true;
      var diffs=state.testPresses.slice(1).map(function(t,i){return t-state.testPresses[i];});
      if(diffs.length>=2){
        var mean=diffs.reduce(function(a,b){return a+b;},0)/diffs.length;
        var dev=diffs.reduce(function(a,d){return a+Math.abs(d-mean);},0)/diffs.length;
        state.cadence=Math.min(600,Math.max(60,Math.round(mean)));
        state.jitter=Math.min(120,Math.max(0,Math.round(dev)));
        text('sql-rhythm-cadence-value',state.cadence+' ms');
        text('sql-rhythm-jitter-value','±'+state.jitter+' ms');
        var stats=get('sql-rhythm-stats');if(stats)stats.hidden=false;
        say("Test complete. Measured " +state.cadence+" ms average interval, ±"+state.jitter+" ms variation.",'cast');
      }else{
        say('Not enough presses to measure a rhythm. Press Reset and cast more than once.','early');
      }
      spellButton.disabled=true;spellButton.textContent="Time's up";
      text('sql-timer-value','0s');
      var live=get('sql-live-status');if(live){live.textContent='Simulator stopped';live.classList.add('stopped');}
      renderSettings();renderComparison();
      var benchTitle=get('sql-bench-title');if(benchTitle)benchTitle.scrollIntoView({behavior:'smooth',block:'start'});
    }
    function resetTest(){
      state.started=false;state.cycleStart=performance.now();state.queued=false;
      state.casts=0;state.clean=0;state.totalGap=0;state.presses=[];state.testPresses=[];
      state.captureActive=false;state.captureDone=false;state.captureStart=0;
      state.cadence=250;state.jitter=30;
      spellButton.disabled=false;spellButton.textContent='Cast Arcane Pulse';
      text('sql-timer-value','30s');text('sql-interval','—');
      var stats=get('sql-rhythm-stats');if(stats)stats.hidden=true;
      say('Press the spell to begin measuring your rhythm.','');
      updateMetrics();renderSettings();renderComparison();
      var fill=get('sql-timer-fill');if(fill)fill.style.width='100%';
      var live=get('sql-live-status');if(live){live.hidden=true;live.classList.remove('stopped');}
      requestAnimationFrame(tick);
    }
    function processArrival(){
      if(!root.isConnected)return;
      var now=performance.now(),s=settings(),elapsed=now-state.cycleStart;
      if(elapsed<s.gcd-s.sqw){addPulse(elapsed/s.gcd,'early');say('Input arrived '+Math.ceil((s.gcd-s.sqw)-elapsed)+' ms before the queue opened. It was ignored.','early');}
      else if(elapsed<s.gcd){state.queued=true;addPulse(elapsed/s.gcd,'queued');say('Input arrived inside the queue with '+Math.ceil(s.gcd-elapsed)+' ms left. The next cast will be gapless.','queued');}
      else{var gap=elapsed-s.gcd;state.casts+=1;state.totalGap+=gap;addPulse(1,'cast');say('Cast after the GCD. A '+Math.round(gap)+' ms gap was added before this cast.','cast');state.cycleStart=now;state.queued=false;}
      updateMetrics();
    }
    function castInput(){
      if(state.captureDone)return;
      var now=performance.now(),oneWay=settings().latency/2;
      if(!state.started){state.started=true;state.cycleStart=now;var live=get('sql-live-status');if(live){live.hidden=false;live.classList.remove('stopped');live.textContent='Simulator running';}}
      if(!state.captureActive){state.captureActive=true;state.captureStart=now;state.testPresses=[];}
      state.testPresses.push(now);
      state.presses.push(now);if(state.presses.length>8)state.presses.shift();updateMetrics();
      if(oneWay){say('Input sent. It will arrive after an estimated '+Math.round(oneWay)+' ms one-way delay.','');setTimeout(processArrival,oneWay);}else{processArrival();}
    }
    function tick(now){
      if(!root.isConnected||state.captureDone)return;
      if(state.captureActive){
        var remaining=Math.max(0,TEST_MS-(now-state.captureStart));
        var pct=Math.max(0,Math.min(100,remaining/TEST_MS*100));
        text('sql-timer-value',Math.ceil(remaining/1000)+'s');
        var fill=get('sql-timer-fill');if(fill)fill.style.width=pct+'%';
        if(remaining<=0){finishCapture();return;}
      }
      if(!state.started){state.cycleStart=now;cursor.style.left='0%';requestAnimationFrame(tick);return;}
      var s=settings(),elapsed=now-state.cycleStart;
      if(elapsed>=s.gcd&&state.queued){state.casts+=1;state.clean+=1;state.cycleStart+=s.gcd;state.queued=false;say('Queued cast fired exactly as the GCD ended. No rotational gap.','queued');updateMetrics();elapsed=now-state.cycleStart;}
      var openGap=state.queued?0:Math.max(0,elapsed-s.gcd);text('sql-gap',String(Math.round(state.totalGap+openGap)));
      cursor.style.left=Math.min(100,elapsed/s.gcd*100)+'%';requestAnimationFrame(tick);
    }
    function simulate(windowMs){
      var s=settings(),ready=s.gcd,time=0,completed=0,clean=0,gap=0,early=0,queued=false,guard=0;
      while(completed<30&&guard<10000){
        var variation=Math.sin(guard*2.117+.7)*s.jitter;time+=Math.max(20,s.cadence+variation);var arrival=time+s.latency/2;
        if(queued&&arrival>=ready){completed+=1;clean+=1;queued=false;ready+=s.gcd;guard+=1;if(completed>=30)break;continue;}
        if(arrival>=ready){gap+=arrival-ready;completed+=1;ready=arrival+s.gcd;}else if(arrival>=ready-windowMs){queued=true;}else{early+=1;}guard+=1;
      }
      var uptime=completed?(completed*s.gcd)/(completed*s.gcd+gap)*100:0;
      return{windowMs:windowMs,gcd:s.gcd,completed:completed,clean:clean,gap:gap,early:early,uptime:uptime,averageGap:completed?gap/completed:0};
    }
    var FIGHT_LENGTHS_MS=[60000,180000,300000,480000];
    function lostCasts(gcd,averageGap,fightMs){
      if(!averageGap)return 0;
      return Math.round((fightMs*averageGap)/(gcd*(gcd+averageGap)));
    }
    function renderComparison(){
      var chosen=settings().sqw,grid=get('sql-compare-grid');if(!grid)return;
      grid.innerHTML=[0,100,250,400].map(simulate).map(function(r){
        var selected=r.windowMs===chosen?' selected':'',label=r.windowMs?String(r.windowMs):'Off',unit=r.windowMs?'ms SQW':'SQW';
        var quality=r.uptime>=99.95?'Gapless':r.uptime>=99?'Minor gaps':'Visible gaps';
        var lostGrid=FIGHT_LENGTHS_MS.map(function(ms){return '<div><strong>'+lostCasts(r.gcd,r.averageGap,ms)+'</strong><small>'+(ms/60000)+' min</small></div>';}).join('');
        return '<article class="sql-result-card'+selected+'"><h3 class="sql-result-title">'+label+' <span>'+unit+'</span></h3><div class="sql-score"><strong>'+r.uptime.toFixed(2)+'%</strong><span>GCD uptime</span></div><progress class="sql-bar" max="100" value="'+r.uptime.toFixed(2)+'" aria-hidden="true"></progress><dl><div><dt>Average gap</dt><dd>'+r.averageGap.toFixed(1)+' ms</dd></div><div><dt>Total gap, 30 casts</dt><dd>'+Math.round(r.gap)+' ms</dd></div><div><dt>Early presses ignored</dt><dd>'+r.early+'</dd></div><div><dt>Result</dt><dd>'+quality+'</dd></div></dl><p class="sql-lost-label">Casts lost over a fight</p><div class="sql-lost-grid">'+lostGrid+'</div></article>';
      }).join('');
    }
    function updateAll(){renderSettings();renderComparison();}
    sqw.addEventListener('input',updateAll);latency.addEventListener('input',updateAll);
    gcd.addEventListener('input',function(){state.cycleStart=performance.now();state.queued=false;updateAll();});
    root.querySelectorAll('[data-sqw]').forEach(function(el){el.addEventListener('click',function(){sqw.value=el.dataset.sqw;updateAll();});});
    spellButton.addEventListener('click',castInput);
    get('sql-reset-button').addEventListener('click',resetTest);
    spellButton.addEventListener('keydown',function(event){
      if(!root.isConnected||document.activeElement!==spellButton||event.defaultPrevented||event.key!=='1'||event.repeat||event.isComposing)return;
      if(event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)return;
      var target=event.target;
      if(target instanceof HTMLElement&&(target.isContentEditable||target.closest('input,textarea,select,[role="textbox"]')))return;
      event.preventDefault();castInput();
    });
    updateAll();requestAnimationFrame(tick);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
  document.addEventListener('astro:page-load',init);
})();
`.trim();

export function generateSpellQueueLab(_attrs: Record<string, string>, nonce?: string): string {
  const guideSection = (
    `<section class="sql-guide" aria-labelledby="sql-guide-title">` +
    `<header class="sql-guide-head"><p class="sql-eyebrow">The complete guide</p><h2 class="sql-guide-title" id="sql-guide-title">What the Spell Queue Window changes, and what it does not</h2><p class="sql-guide-lead">The setting is easiest to understand as a deadline that opens before your current action finishes. It does not shorten the global cooldown or make the server run faster. It gives your next eligible input a place to wait so it can begin as soon as the current action allows it.</p></header>` +
    `<div class="sql-guide-grid"><article class="sql-article">` +
    `<section class="sql-article-section"><h3 class="sql-article-title">A small buffer can remove a repeated delay</h3><p>Suppose your GCD lasts one second and you press a key every 250 ms. With the documented default of a 400 ms queue window, one of those presses can arrive during the final 40% of the GCD and wait for the exact finish. With the queue disabled, the presses made before the finish do nothing, so the first useful press may not arrive until a fraction of a second afterward.</p><p>That leftover time is the rotational gap. A single gap may look harmless, but the same delay repeated across a long encounter reduces the number of actions you can fit into the fight.</p>` +
    `<div class="sql-diagrams" aria-label="Three original spell queue timing examples">` +
    `<figure class="sql-diagram"><figcaption>Press arrives too early <span>The input is outside the open queue</span></figcaption><div class="sql-example-track"><i class="sql-example-gcd"></i><i class="sql-example-window"></i><i class="sql-example-ready"></i><i class="sql-example-press sql-example-press--early" data-label="Ignored"></i><i class="sql-example-gap"></i></div><div class="sql-example-axis"><span>GCD starts</span><span>Queue opens</span><span>Next press adds a gap</span></div></figure>` +
    `<figure class="sql-diagram"><figcaption>Press arrives inside the window <span>The action waits and fires at ready</span></figcaption><div class="sql-example-track"><i class="sql-example-gcd"></i><i class="sql-example-window"></i><i class="sql-example-ready"></i><i class="sql-example-press sql-example-press--queued" data-label="Queued"></i></div><div class="sql-example-axis"><span>GCD starts</span><span>Queue opens</span><span>Zero modeled gap</span></div></figure>` +
    `<figure class="sql-diagram"><figcaption>Press arrives after ready <span>The action can fire, but the idle time remains</span></figcaption><div class="sql-example-track"><i class="sql-example-gcd"></i><i class="sql-example-window"></i><i class="sql-example-ready"></i><i class="sql-example-gap"></i><i class="sql-example-press sql-example-press--late" data-label="Late"></i></div><div class="sql-example-axis"><span>GCD starts</span><span>Queue opens</span><span>Gap before cast</span></div></figure>` +
    `</div></section>` +
    `<section class="sql-article-section"><h3 class="sql-article-title">Your keypress rhythm matters as much as the number</h3><p>A queue window only helps if one of your inputs reaches the server while it is open. That makes the spacing between presses important. A player pressing every 100 ms gets several chances to enter a 250 ms window. A player pressing every 300 ms can skip over a 100 ms window entirely, even with stable latency.</p><div class="sql-equation"><div><strong>Queue size</strong><span>How early the buffer begins</span></div><div><strong>Press spacing</strong><span>How often you get another chance</span></div><div><strong>Arrival variation</strong><span>Latency and human timing shift each press</span></div></div><p>This is why copying another player&apos;s number is unreliable. Their network, hardware, class pace, and button rhythm may not resemble yours.</p></section>` +
    `<section class="sql-article-section"><h3 class="sql-article-title">Wide and narrow windows solve different problems</h3><p><strong>A wider window favors continuity.</strong> You can commit the next action earlier and are less likely to leave the GCD empty. That is useful when the next choice is already clear or when your keypresses are relatively far apart.</p><p><strong>A narrower window favors late decisions.</strong> The queue only ever holds your most recent press, so whichever action you choose last before the GCD ends is what fires regardless of window size. What a narrow window changes is how early that final press can land: an attempt made too soon arrives before the window opens and is dropped outright, so you are forced to commit closer to the deadline. That gives you a shorter runway to change your mind, but it does not make an early press "stick" — you can still overwrite it with a later one as long as it lands inside the window. The cost is a smaller target for your next press. If your cadence cannot hit it consistently, gaps appear.</p><p>The goal is not the smallest possible value. It is the smallest value that still gives your real input pattern enough room to produce reliable back-to-back casts.</p></section>` +
    `<section class="sql-article-section"><h3 class="sql-article-title">A practical way to choose a setting</h3><ol><li>Start at the 400 ms default and play content where your rotation is familiar.</li><li>Use the simulator below with your normal GCD, world latency, and an honest estimate of how quickly you repeat a key.</li><li>Lower the window in modest steps, such as 50 ms, and test for several minutes rather than a few casts.</li><li>If casts begin to leave small empty spaces, move back to the last stable value.</li><li>Repeat the test during high-haste effects. A shorter GCD gives you less total time to place the next input.</li></ol><p>Do not treat a popular formula such as “ping plus a fixed amount” as a universal rule. Latency is only one part of the timing chain, and the game&apos;s displayed round-trip latency is not a perfect measurement of when every input reaches processing.</p></section>` +
    `<section class="sql-article-section"><h3 class="sql-article-title">What this simulator leaves out</h3><p>The model deliberately reduces the system to GCD length, a queue deadline, estimated one-way travel, and repeated keypresses. The live game also has frame timing, variable network conditions, server processing, ability-specific rules, off-GCD actions, channels, cast times, macros, and cases where an action is not eligible when pressed.</p><p>Use the numbers to understand the relationship and compare settings. Validate the final choice by feel and combat logs in the content you actually play.</p></section>` +
    `</article><aside class="sql-side" aria-label="Spell Queue Window reference">` +
    `<section class="ui-panel sql-side-card"><h3 class="sql-side-title">In-game commands</h3><p>Check the current account-level CVar:</p><code class="sql-command">/dump GetCVar("SpellQueueWindow")</code><p>Set it to the documented default:</p><code class="sql-command">/console SpellQueueWindow 400</code></section>` +
    `<section class="ui-panel sql-side-card"><h3 class="sql-side-title">Quick interpretation</h3><ol><li>More total gap means the window is too hard for the modeled rhythm to hit.</li><li>More ignored presses means inputs often arrive before the queue opens.</li><li>Near-100% uptime means the current pattern usually reaches the queue in time.</li></ol></section>` +
    `<section class="ui-panel sql-side-card"><h3 class="sql-side-title">Further reading</h3><p>This guide is an original explanation inspired by the topic covered by Maxroll, with independent diagrams and examples.</p><div class="sql-source-links"><a href="https://maxroll.gg/wow/resources/spell-queue-window" target="_blank" rel="noopener noreferrer">Maxroll: Spell Queue Window</a><a href="https://warcraft.wiki.gg/wiki/CVar" target="_blank" rel="noopener noreferrer">Warcraft Wiki: console variables</a></div></section>` +
    `</aside></div></section>`
  );

  return (
    `<div id="sql-root">` +
    `<style${nonceAttr(nonce)}>${css}</style>` +
    guideSection +
    `<div class="sql-intro"><p class="sql-intro-copy"><strong>Now try it yourself.</strong> Press during the highlighted end of the global cooldown below and WoW can hold the action until the GCD finishes. Press too early and the input is ignored. Press after the GCD and the delay becomes a rotational gap.</p><span class="sql-retail">Retail model</span></div>` +
    `<div class="sql-workspace">` +
    `<aside class="ui-panel sql-panel sql-controls" aria-label="Simulation controls">` +
    `<p class="sql-eyebrow">Live timing test</p><h2 class="sql-heading">Find the window your rhythm can hit.</h2><p class="sql-copy">Click the spell or focus Cast Arcane Pulse and press 1 repeatedly. Your first press starts a 30-second timer — cast at your normal rhythm and we will measure your real press interval and variation from it.</p>` +
    `<div class="sql-control"><div class="sql-control-head"><label for="sql-sqw">Spell Queue Window</label><output class="sql-value" id="sql-sqw-value">250 ms</output></div><input id="sql-sqw" type="range" min="0" max="400" step="10" value="250"><div class="sql-range-notes"><span>0 ms</span><span>400 ms</span></div><div class="sql-quick" role="group" aria-label="Queue window presets"><button type="button" class="ui-action sql-chip" data-sqw="0" aria-pressed="false">Off</button><button type="button" class="ui-action sql-chip" data-sqw="100" aria-pressed="false">100</button><button type="button" class="ui-action sql-chip active" data-sqw="250" aria-pressed="true">250</button><button type="button" class="ui-action sql-chip" data-sqw="400" aria-pressed="false">400</button></div></div>` +
    `<div class="sql-control"><div class="sql-control-head"><label for="sql-gcd">Global cooldown</label><output class="sql-value" id="sql-gcd-value">1.00 s</output></div><input id="sql-gcd" type="range" min="750" max="1500" step="50" value="1000"><div class="sql-range-notes"><span>0.75 s</span><span>1.50 s</span></div></div>` +
    `<div class="sql-control"><div class="sql-control-head"><label for="sql-latency">World latency</label><output class="sql-value" id="sql-latency-value">40 ms</output></div><input id="sql-latency" type="range" min="0" max="200" step="5" value="40"><div class="sql-range-notes"><span>0 ms</span><span>200 ms RTT</span></div></div>` +
    `<div class="sql-control"><div class="sql-control-head"><label>Test your rhythm</label><output class="sql-value" id="sql-timer-value">30s</output></div><div class="sql-timer-track"><i id="sql-timer-fill"></i></div><p class="sql-copy sql-rhythm-copy">Cast for 30 seconds at the pace you actually play. We measure your average interval and its variation from those real presses instead of a guess.</p><dl class="sql-rhythm-stats" id="sql-rhythm-stats" hidden><div><dt>Average interval</dt><dd id="sql-rhythm-cadence-value">— ms</dd></div><div><dt>Variation</dt><dd id="sql-rhythm-jitter-value">± — ms</dd></div></dl></div>` +
    `<button type="button" class="ui-action sql-primary" id="sql-spell-button" aria-describedby="sql-shortcut">Cast Arcane Pulse</button><button type="button" class="ui-action sql-secondary" id="sql-reset-button">Reset test</button><p class="sql-shortcut" id="sql-shortcut">Click to cast, or press <kbd>1</kbd> repeatedly while Cast Arcane Pulse is focused.</p>` +
    `</aside>` +
    `<section class="ui-panel sql-panel sql-stage" aria-labelledby="sql-live-title"><div class="sql-stage-head"><div><p class="sql-eyebrow">Current GCD</p><h2 class="sql-heading" id="sql-live-title">Input timeline</h2><p class="sql-stage-copy">One cycle repeats continuously so you can test your own cadence.</p></div><span class="sql-live" id="sql-live-status" hidden>Simulator running</span></div>` +
    `<div class="sql-timeline-wrap"><div class="sql-scale"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>Ready</span></div><div class="sql-track" id="sql-track" aria-label="Current global cooldown progress"><div class="sql-queue-band" id="sql-queue-band"><span>Queue open</span></div><div class="sql-cursor" id="sql-cursor"></div></div><div class="sql-track-labels"><span>GCD starts</span><span id="sql-open-label">Queue opens at 750 ms</span><span>Next cast</span></div><div class="sql-legend"><span><i class="sql-dot sql-dot--early"></i> Too early</span><span><i class="sql-dot sql-dot--queued"></i> Queued</span><span><i class="sql-dot sql-dot--ready"></i> Cast after ready</span></div></div>` +
    `<div class="sql-metrics" aria-live="polite"><div class="sql-metric"><span>Casts completed</span><strong id="sql-casts">0</strong></div><div class="sql-metric"><span>Queued cleanly</span><strong id="sql-clean">0</strong><small>%</small></div><div class="sql-metric"><span>Total gap, live</span><strong id="sql-gap">0</strong><small>ms</small></div><div class="sql-metric"><span>Your press interval</span><strong id="sql-interval">—</strong><small>ms</small></div></div>` +
    `<div class="sql-event" id="sql-event" aria-live="polite">Press the spell to begin measuring your rhythm.</div><div class="sql-callout"><strong>The useful test:</strong> can your next press consistently land after the highlighted window opens? A queue shorter than the space between key presses can miss every opening and add a repeatable gap.</div></section>` +
    `</div>` +
    `<section class="ui-panel sql-panel sql-bench" aria-labelledby="sql-bench-title"><div class="sql-bench-head"><div><p class="sql-eyebrow">Same player, four settings</p><h2 class="sql-heading" id="sql-bench-title">Queue window comparison</h2><p class="sql-bench-copy">Each card runs the same 30-cast input pattern. GCD uptime falls whenever no press reaches the open queue before the cooldown ends.</p></div><span class="sql-run-summary" id="sql-run-summary">1.00s GCD · 250ms rhythm · ±30ms</span></div><div class="sql-compare-grid" id="sql-compare-grid">${initialCards}</div>` +
    `<div class="sql-notes"><div class="ui-callout sql-note"><strong>How the model works.</strong> A press before the queue opens is ignored. A press inside the window is held and fires when the GCD ends. A press arriving afterward fires immediately, but its delay becomes a gap. Latency delays arrival by half of the displayed round-trip time. This is a teaching model, not a frame-perfect recreation of Blizzard's server.</div><div class="ui-callout sql-note"><strong>In game:</strong> check with <code>/dump GetCVar("SpellQueueWindow")</code> and set with <code>/console SpellQueueWindow 400</code>, the documented default.</div></div></section>` +
    `<script${nonceAttr(nonce)}>${js}<\/script>` +
    `</div>`
  );
}
