import researchData from "./assisted-combat-data.json";
import { nonceAttr } from "./csp";
import { jsonForHtml } from "./json";
import specIcons from "./assisted-combat-spec-icons.json";
import * as render from "./assisted-combat-render.js";
// The browser gets the exact same template code the server just ran, rather
// than a hand-maintained second copy. See assisted-combat-render.js.
import renderSource from "./assisted-combat-render.js?raw";

type AplStep = {
  priority: number;
  action: string;
  spellId: number | null;
  condition: string;
  stepId: number;
  automationOnly: boolean;
};

type SpecResearch = {
  gameClass: string;
  spec: string;
  specId: number;
  assistedCombatId: number;
  role: string;
  steps: AplStep[];
  simcComparable: boolean;
  overlap: number | null;
  simcCoverage: number | null;
  sharedActionCount: number;
  blizzardActionCount: number;
  simcActionCount: number;
  alignment: string;
  simcProfiles: string[];
  simcActionLines: number[];
  usesSeason2SimcProfile: boolean;
  blizzardOnlyActions: string[];
  missingActions: string[];
  missingLogic: string[];
  comparisonLimitation: string[];
  icyRating: string;
  icySummary: string;
  icyUrl: string;
  /** Vendored spec icon name, or null to fall back to initials. */
  icon: string | null;
};

type ResearchData = typeof researchData & { specs: SpecResearch[] };

// Icons are resolved separately (scripts/fetch-spec-icons.mjs) so the research
// generator stays offline and deterministic; joined on specId here so both the
// server render and the client payload see them.
const iconBySpecId = specIcons as Record<string, string>;
const data = {
  ...researchData,
  specs: researchData.specs.map((spec) => ({
    ...spec,
    icon: iconBySpecId[String(spec.specId)] ?? null,
  })),
} as unknown as ResearchData;
const esc = render.escapeHtml;

function sourceLink(label: string, href: string): string {
  return `<a class="ac-source" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;
}

function infoIconMarkup(text: string): string {
  return render.infoIcon(text);
}

const css = `
${Object.entries(render.CLASS_COLORS).map(([name, color]) => `#ac-root [data-game-class="${name}"]{--class-color:${color};}`).join("\n")}
#ac-root{font-family:inherit;margin:0;color:var(--text,#e9eef9);}
#ac-root *{box-sizing:border-box;}
#ac-root .ac-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;}

#ac-root .ac-hero{position:relative;overflow:hidden;padding:clamp(1.25rem,3vw,2.25rem);margin:0 0 1rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);background:var(--surface,#0f1326);}
#ac-root .ac-eyebrow{margin:0 0 .6rem;font-size:.85rem;font-weight:700;color:var(--accent,#70d0ff);}
#ac-root h2.ac-title{position:relative;z-index:1;margin:0 0 .8rem;padding:0;border:0;max-width:850px;font-family:var(--font-display);font-size:clamp(1.35rem,2.4vw,1.9rem);font-weight:600;line-height:1.2;color:var(--text,#e9eef9);}
#ac-root p.ac-lede{position:relative;z-index:1;max-width:850px;margin:0;color:var(--muted,#a3aec9);font-size:1rem;line-height:1.7;}
#ac-root .ac-lede strong{color:var(--text,#e9eef9);}
/* text-transform/letter-spacing are reset because .ac-block-title is uppercase
   and letter-spaced, which would otherwise render the glyph as "I" and nudge it
   off-centre inside the circle. */
#ac-root .ac-info{display:inline-grid;place-items:center;flex:0 0 auto;width:1rem;height:1rem;margin-left:.28rem;border:1px solid currentColor;border-radius:50%;color:inherit;font-family:Georgia,serif;font-size:.7rem;font-style:italic;font-weight:700;line-height:1;letter-spacing:0;text-transform:none;opacity:.78;cursor:help;vertical-align:middle;}
#ac-root .ac-info:hover,#ac-root .ac-info:focus-visible{opacity:1;outline:2px solid rgb(from var(--accent) r g b / 45%);outline-offset:2px;}
#ac-tooltip{box-sizing:border-box;width:max-content;overflow-wrap:anywhere;position:fixed;z-index:10000;max-width:min(340px,calc(100vw - 24px));padding:.65rem .75rem;border:1px solid rgb(from var(--accent) r g b / 42%);border-radius:var(--r-md,10px);background:rgb(5 9 20 / 98%);color:var(--text,#e9eef9);font-family:inherit;font-size:.78rem;font-style:normal;font-weight:500;line-height:1.5;opacity:0;visibility:hidden;transform:translateY(-3px);transition:opacity .06s ease,visibility 0s linear .06s;pointer-events:none;}
#ac-tooltip .ac-tooltip-text{display:block;max-height:calc(100vh - 48px);overflow-y:auto;}
#ac-tooltip::before,#ac-tooltip::after{content:"";position:absolute;left:0;right:0;height:10px;pointer-events:auto;}
#ac-tooltip::before{top:-10px;}
#ac-tooltip::after{bottom:-10px;}
#ac-tooltip.is-visible{pointer-events:auto;opacity:1;visibility:visible;transform:translateY(0);transition:opacity .06s ease;}
#ac-root button.ac-method-toggle{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:1rem;width:100%;margin:1rem 0 0;padding:.8rem .9rem;border:1px solid rgb(from var(--accent) r g b / 22%);border-radius:var(--r-md,10px);background:rgb(from var(--bg) r g b / 38%);color:var(--text,#e9eef9);font-size:.88rem;font-weight:800;text-align:left;cursor:pointer;transition:border-color .15s,background .15s;}
#ac-root button.ac-method-toggle:hover{border-color:rgb(from var(--accent) r g b / 42%);background:rgb(from var(--accent) r g b / 6%);}
#ac-root .ac-method-toggle__label{display:flex;align-items:center;gap:.55rem;}
#ac-root .ac-method-toggle__label::before{content:"i";display:grid;place-items:center;width:1.2rem;height:1.2rem;border:1px solid rgb(from var(--accent) r g b / 40%);border-radius:50%;color:var(--accent,#70d0ff);font-family:Georgia,serif;font-size:.72rem;font-style:italic;}
#ac-root .ac-method-toggle__icon{color:var(--accent,#70d0ff);font-size:1rem;line-height:1;transition:border-color var(--transition-fast);}
#ac-root button.ac-method-toggle[aria-expanded="true"] .ac-method-toggle__icon{transform:rotate(45deg);}
#ac-root .ac-method[hidden]{display:none;}
#ac-root .ac-method{position:relative;z-index:1;margin-top:.55rem;padding:1rem;border:1px solid rgb(from var(--accent) r g b / 18%);border-radius:var(--r-md,10px);background:rgb(from var(--bg) r g b / 55%);}
#ac-root p.ac-method__intro{margin:0 0 .9rem;color:var(--muted,#a3aec9);font-size:.88rem;line-height:1.6;}
#ac-root .ac-method-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch;gap:.7rem;}
#ac-root .ac-method-flow > .ac-method-card + .ac-method-card{margin-top:0;}
#ac-root .ac-method-card{display:flex;flex-direction:column;min-width:0;height:100%;padding:.9rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:rgb(255 255 255 / 2%);}
#ac-root .ac-method-card__number{display:grid;place-items:center;width:1.5rem;height:1.5rem;margin-bottom:.55rem;border-radius:var(--r-sm,6px);background:rgb(from var(--accent) r g b / 9%);color:var(--accent,#70d0ff);font-size:.75rem;font-weight:900;}
#ac-root h3.ac-method-card__title{margin:0 0 .4rem;font-size:.95rem;color:var(--text,#e9eef9);}
#ac-root p.ac-method-card__copy{margin:0;color:var(--muted,#a3aec9);font-size:.84rem;line-height:1.55;}
#ac-root .ac-method-card__fields{display:block;margin-top:.55rem;color:rgb(232 243 255 / 78%);font-family:var(--font-code);font-size:.78rem;line-height:1.5;overflow-wrap:anywhere;}
#ac-root .ac-method-links{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:auto;padding-top:.7rem;}
#ac-root a.ac-method-link{padding:.32rem .48rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);color:var(--accent,#70d0ff);font-size:.76rem;text-decoration:none;}
#ac-root a.ac-method-link:hover{border-color:rgb(from var(--accent) r g b / 38%);text-decoration:none;}
#ac-root .ac-join{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;margin-top:.75rem;padding:.65rem .75rem;border:1px solid rgb(from var(--accent) r g b / 22%);border-radius:var(--r-md,10px);background:rgb(from var(--accent) r g b / 4%);color:var(--muted,#a3aec9);font-size:.78rem;line-height:1.55;}
#ac-root .ac-join code{padding:.14rem .32rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);background:var(--surface,#0f1326);color:var(--text,#e9eef9);font-size:.75rem;}
#ac-root p.ac-method__note{margin:.75rem 0 0;color:var(--muted,#a3aec9);font-size:.82rem;line-height:1.6;}
#ac-root .ac-mono{font-family:var(--font-code);}

#ac-root .ac-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.65rem;margin:1rem 0;}
#ac-root .ac-stat{min-width:0;padding:1.1rem 1.15rem;border-radius:var(--r-lg,16px);}
#ac-root .ac-stat__value{display:flex;align-items:center;font-family:var(--font-display);font-size:1.75rem;font-weight:600;line-height:1;color:var(--text,#e9eef9);}
#ac-root .ac-stat:nth-child(2) .ac-stat__value{color:var(--accent-3,#a8ff60);}
#ac-root .ac-stat:nth-child(3) .ac-stat__value{color:var(--accent,#70d0ff);}
#ac-root .ac-stat__label{display:block;margin-top:.5rem;color:var(--muted,#a3aec9);font-size:.85rem;line-height:1.35;}

#ac-root .ac-scope{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:stretch;gap:.75rem;margin:1rem 0 1.25rem;}
#ac-root .ac-scope > .ac-callout + .ac-callout{margin-top:0;}
#ac-root .ac-callout{height:100%;padding:1.25rem 1.35rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);background:var(--surface,#0f1326);}
#ac-root h3.ac-callout__title{margin:0 0 .5rem;font-size:1rem;color:var(--text,#e9eef9);}
#ac-root p.ac-callout__text{margin:0;color:var(--muted,#a3aec9);font-size:.9rem;line-height:1.6;}
#ac-root ul.ac-chip-list{display:flex;flex-wrap:wrap;gap:.35rem;margin:.55rem 0 0;padding:0;list-style:none;}
#ac-root li.ac-chip{margin:0;padding:.3rem .7rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-pill,999px);background:var(--surface-2,#151b33);font-size:.8rem;line-height:1.35;color:var(--text-soft,#c3cbe0);}

#ac-root .ac-explorer{border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);overflow:hidden;background:var(--bg-deep,#05070f);}
#ac-root .ac-toolbar{display:grid;grid-template-columns:minmax(220px,1.6fr) repeat(2,minmax(145px,.7fr));gap:.75rem;align-items:end;padding:1rem 1.1rem;border-bottom:1px solid var(--line,#1d2442);background:var(--surface,#0f1326);}
#ac-root label.ac-field{display:flex;flex-direction:column;gap:.35rem;margin:0;color:var(--text-soft,#c3cbe0);font-size:.85rem;font-weight:700;}
#ac-root .ac-input,#ac-root .ac-select{width:100%;min-height:44px;padding:.55rem .8rem;font-size:.9rem;font-weight:500;}
#ac-root .ac-input:focus,#ac-root .ac-select:focus{border-color:var(--accent,#70d0ff);box-shadow:0 0 0 3px rgb(from var(--accent) r g b / 8%);}
#ac-root .ac-input:focus-visible,#ac-root .ac-select:focus-visible{outline:2px solid var(--accent,#70d0ff);outline-offset:2px;}
#ac-root .ac-noscript{display:block;margin:0;padding:.7rem .9rem;border-bottom:1px solid var(--line,#1d2442);background:var(--surface-2,#151b33);color:var(--muted,#a3aec9);font-size:.78rem;line-height:1.55;}

#ac-root .ac-workspace{display:grid;grid-template-columns:minmax(250px,320px) minmax(0,1fr);min-height:640px;}
#ac-root .ac-browser{border-right:1px solid var(--line,#1d2442);background:var(--bg,#070914);}
#ac-root .ac-results-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.7rem .8rem;border-bottom:1px solid var(--line,#1d2442);font-size:.72rem;color:var(--muted,#a3aec9);}
#ac-root .ac-results{display:flex;flex-direction:column;gap:.4rem;max-height:740px;overflow:auto;padding:.55rem;scrollbar-color:var(--line,#1d2442) transparent;}
#ac-root button.ac-spec-card{position:relative;display:grid;grid-template-columns:2.35rem 1fr auto;gap:.65rem;align-items:center;width:100%;padding:.7rem;border:1px solid transparent;border-radius:var(--r-md,10px);background:transparent;color:var(--text,#e9eef9);text-align:left;cursor:pointer;transition:background .15s,border-color .15s;}
#ac-root button.ac-spec-card:hover{background:rgb(255 255 255 / 4%);border-color:var(--line,#1d2442);}
#ac-root button.ac-spec-card:focus-visible{outline:2px solid var(--accent,#70d0ff);outline-offset:1px;}
#ac-root button.ac-spec-card[aria-pressed="true"]{background:color-mix(in srgb,var(--class-color) 10%,transparent);border-color:var(--accent,#70d0ff);}
#ac-root .ac-monogram{display:grid;place-items:center;width:2.35rem;height:2.35rem;border:1px solid color-mix(in srgb,var(--class-color) 55%,transparent);border-radius:var(--r-md,10px);background:color-mix(in srgb,var(--class-color) 12%,transparent);color:var(--class-color);font-size:.7rem;font-weight:900;}
/* Must out-specify .prose img (0,1,1), which would otherwise add 1rem vertical
   margin, its own border and a 10px radius to every spec icon. */
#ac-root img.ac-monogram{display:block;margin:0;max-width:none;object-fit:cover;border-radius:var(--r-md,10px);}
#ac-root .ac-spec-name{display:block;font-size:.85rem;font-weight:800;line-height:1.25;}
#ac-root .ac-class-name{display:block;margin-top:.12rem;color:var(--muted,#a3aec9);font-size:.7rem;line-height:1.2;}
#ac-root .ac-card-meta{display:flex;flex-direction:column;align-items:stretch;gap:.2rem;min-width:6.6rem;}
#ac-root .ac-score-line{display:flex;align-items:baseline;justify-content:space-between;gap:.35rem;color:var(--muted,#a3aec9);font-size:.7rem;line-height:1.2;white-space:nowrap;}
#ac-root .ac-score-line strong{display:inline-flex;align-items:center;color:var(--accent-3,#a8ff60);font-size:.72rem;font-weight:800;}
#ac-root .ac-score-line .ac-info{width:.82rem;height:.82rem;margin-left:.2rem;font-size:.7rem;}
#ac-root .ac-score-line--simc strong{color:var(--accent,#70d0ff);}
#ac-root .ac-score-na{font-size:.7rem;font-weight:800;color:var(--muted,#a3aec9);text-align:right;}
#ac-root .ac-empty{padding:2rem 1rem;text-align:center;color:var(--muted,#a3aec9);font-size:.82rem;}

#ac-root .ac-detail{min-width:0;padding:clamp(1rem,2.5vw,1.75rem);background:var(--surface,#0f1326);}
#ac-root .ac-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding-bottom:1rem;border-bottom:1px solid var(--line,#1d2442);}
#ac-root .ac-detail-kicker{margin:0 0 .3rem;color:var(--class-color,#70d0ff);font-size:.85rem;font-weight:700;}
#ac-root h3.ac-detail-title{margin:0;font-family:var(--font-display);font-size:1.5rem;font-weight:600;color:var(--text,#e9eef9);}
#ac-root .ac-badges{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.35rem;}
#ac-root .ac-badge{display:inline-flex;align-items:center;min-height:1.65rem;padding:.25rem .55rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-pill,999px);background:rgb(255 255 255 / 3%);font-size:.7rem;color:var(--muted,#a3aec9);white-space:nowrap;}
#ac-root .ac-badge--overlap{border-color:rgb(168 255 96 / 30%);color:var(--accent-3,#a8ff60);}
#ac-root .ac-badge--coverage{border-color:rgb(from var(--accent) r g b / 30%);color:var(--accent,#70d0ff);}
#ac-root .ac-badge .ac-info{margin-right:.28rem;}
#ac-root .ac-tabs{display:flex;gap:.35rem;margin:1rem 0;padding:.3rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:rgb(from var(--bg) r g b / 45%);overflow-x:auto;}
#ac-root button.ac-tab{flex:1 0 auto;padding:.55rem .7rem;border:0;border-radius:var(--r-sm,6px);background:transparent;color:var(--muted,#a3aec9);font-size:.76rem;font-weight:700;cursor:pointer;}
#ac-root button.ac-tab:focus-visible{outline:2px solid var(--accent,#70d0ff);outline-offset:-2px;}
#ac-root button.ac-tab[aria-selected="true"]{background:rgb(from var(--accent) r g b / 10%);color:var(--accent,#70d0ff);box-shadow:inset 0 0 0 1px var(--accent,#70d0ff);}
#ac-root .ac-panel[hidden]{display:none;}
#ac-root .ac-panel:focus-visible{outline:2px solid rgb(from var(--accent) r g b / 45%);outline-offset:4px;}
#ac-root .ac-panel-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;gap:.75rem;}
#ac-root .ac-panel-grid > .ac-block + .ac-block{margin-top:0;}
#ac-root .ac-block{min-width:0;height:100%;padding:.9rem;}
#ac-root .ac-block--wide{grid-column:1/-1;}
#ac-root h4.ac-block-title{margin:0 0 .6rem;color:var(--text-soft,#c3cbe0);font-size:.85rem;font-weight:700;}
#ac-root ul.ac-list{margin:0;padding:0;list-style:none;}
#ac-root li.ac-list-item{position:relative;margin:.36rem 0;padding-left:.9rem;color:var(--text,#e9eef9);font-size:.8rem;line-height:1.45;}
#ac-root li.ac-list-item::before{content:"";position:absolute;left:0;top:.56em;width:.3rem;height:.3rem;border-radius:50%;background:var(--accent,#70d0ff);}
#ac-root .ac-muted{color:var(--muted,#a3aec9);font-size:.8rem;line-height:1.55;}
#ac-root p.ac-muted{margin:.6rem 0 0;}
#ac-root p.ac-muted--flush{margin:0;}
#ac-root .ac-metric-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.55rem;}
#ac-root .ac-mini-metric{padding:.65rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:rgb(255 255 255 / 2%);}
#ac-root .ac-mini-value{display:flex;align-items:center;font-size:1rem;font-weight:800;color:var(--text,#e9eef9);}
#ac-root .ac-mini-value--match{color:var(--accent-3,#a8ff60);}
#ac-root .ac-mini-value--coverage{color:var(--accent,#70d0ff);}
#ac-root .ac-mini-label{display:block;margin-top:.18rem;color:var(--muted,#a3aec9);font-size:.7rem;line-height:1.25;}

#ac-root .ac-apl-note{margin:0 0 .75rem;padding:.65rem .75rem;border:1px solid rgb(from var(--accent) r g b / 22%);border-radius:var(--r-md,10px);background:rgb(from var(--accent) r g b / 4%);color:var(--muted,#a3aec9);font-size:.72rem;line-height:1.5;}
#ac-root .ac-apl{display:flex;flex-direction:column;gap:.45rem;max-height:560px;overflow:auto;padding-right:.25rem;scrollbar-color:var(--line,#1d2442) transparent;}
#ac-root .ac-step{display:grid;grid-template-columns:2rem minmax(120px,.65fr) minmax(220px,1.7fr);gap:.65rem;align-items:start;padding:.65rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:rgb(from var(--bg) r g b / 28%);}
#ac-root .ac-step--automation{border-style:dashed;opacity:.8;}
#ac-root .ac-step__priority{display:grid;place-items:center;width:1.65rem;height:1.65rem;border-radius:var(--r-sm,6px);background:rgb(from var(--accent) r g b / 9%);color:var(--accent,#70d0ff);font-size:.7rem;font-weight:800;}
#ac-root .ac-step__action{font-size:.78rem;font-weight:800;color:var(--text,#e9eef9);line-height:1.35;}
#ac-root .ac-step__ids{display:block;margin-top:.18rem;color:var(--muted,#a3aec9);font-family:var(--font-code);font-size:.7rem;font-weight:400;}
#ac-root .ac-step__condition{color:var(--muted,#a3aec9);font-size:.72rem;line-height:1.5;}
#ac-root .ac-auto{display:inline-block;margin-top:.28rem;padding:.12rem .35rem;border:1px solid rgb(255 63 184 / 30%);border-radius:var(--r-pill,999px);color:var(--accent-2,#ff3fb8);font-size:.7rem;font-weight:700;}

#ac-root .ac-rating{display:inline-flex;padding:.3rem .6rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-pill,999px);font-size:.7rem;font-weight:800;}
#ac-root .ac-rating[data-rating="Close"]{border-color:rgb(168 255 96 / 35%);color:var(--accent-3,#a8ff60);}
#ac-root .ac-rating[data-rating="Moderate"]{border-color:rgb(255 200 76 / 35%);color:#ffcf66;}
#ac-root .ac-rating[data-rating="Large"]{border-color:rgb(255 63 184 / 35%);color:var(--accent-2,#ff3fb8);}
#ac-root .ac-rating[data-rating="Not comparable"]{color:var(--muted,#a3aec9);}
#ac-root p.ac-copy{margin:.7rem 0 0;color:var(--text,#e9eef9);font-size:.82rem;line-height:1.65;}
#ac-root a.ac-cta{display:inline-flex;align-items:center;gap:.35rem;margin-top:.8rem;padding:.55rem .8rem;border:1px solid rgb(from var(--accent) r g b / 35%);border-radius:var(--r-md,10px);background:rgb(from var(--accent) r g b / 6%);color:var(--accent,#70d0ff);font-size:.76rem;font-weight:700;text-decoration:none;}
#ac-root a.ac-cta:hover{background:rgb(from var(--accent) r g b / 11%);text-decoration:none;}

#ac-root .ac-sources{display:flex;flex-wrap:wrap;align-items:center;gap:.45rem;margin-top:1rem;padding:.8rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:rgb(255 255 255 / 2%);}
#ac-root .ac-source-label{margin-right:.2rem;color:var(--text-soft,#c3cbe0);font-size:.85rem;font-weight:700;}
#ac-root a.ac-source{display:inline-flex;padding:.36rem .55rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);color:var(--muted,#a3aec9);font-size:.7rem;text-decoration:none;}
#ac-root a.ac-source:hover{border-color:rgb(from var(--accent) r g b / 35%);color:var(--accent,#70d0ff);text-decoration:none;}
#ac-root .ac-provenance{margin:.65rem 0 0;color:var(--muted,#a3aec9);font-size:.7rem;line-height:1.45;}

@media (max-width:980px){
  #ac-root .ac-stats{grid-template-columns:repeat(3,minmax(0,1fr));}
  #ac-root .ac-toolbar{grid-template-columns:repeat(2,minmax(0,1fr));}
  #ac-root .ac-workspace{grid-template-columns:minmax(220px,280px) minmax(0,1fr);}
  #ac-root .ac-step{grid-template-columns:2rem 1fr;}
  #ac-root .ac-step__condition{grid-column:2;}
  #ac-root .ac-metric-row{grid-template-columns:repeat(2,minmax(0,1fr));}
}
@media (max-width:760px){
  #ac-root .ac-stats{grid-template-columns:repeat(2,minmax(0,1fr));}
  #ac-root .ac-scope{grid-template-columns:1fr;}
  #ac-root .ac-method-flow{grid-template-columns:1fr;}
  #ac-root .ac-workspace{display:block;}
  #ac-root .ac-browser{border-right:0;border-bottom:1px solid var(--line,#1d2442);}
  #ac-root .ac-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));max-height:360px;}
  #ac-root .ac-panel-grid{grid-template-columns:1fr;}
  #ac-root .ac-block--wide{grid-column:auto;}
}
@media (max-width:520px){
  #ac-root .ac-toolbar{grid-template-columns:1fr;}
  #ac-root .ac-results{grid-template-columns:1fr;}
  #ac-root .ac-detail-head{display:block;}
  #ac-root .ac-badges{justify-content:flex-start;margin-top:.65rem;}
  #ac-root .ac-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible;}
  #ac-root button.ac-tab{min-width:0;}
  #ac-root .ac-metric-row{grid-template-columns:1fr;}
  #ac-root .ac-step{grid-template-columns:1.75rem minmax(0,1fr);gap:.5rem;}
}
`;

// DOM wiring only — every template lives in assisted-combat-render.js, whose
// source is spliced in above this block so both sides stay in lockstep.
const wiring = `
  function tooltipEl(){
    var el=document.getElementById('ac-tooltip');
    if(!el){
      el=document.createElement('div');
      el.id='ac-tooltip';
      el.setAttribute('role','tooltip');
      var content=document.createElement('span');
      content.className='ac-tooltip-text';
      el.appendChild(content);
      document.body.appendChild(el);
    }
    return el;
  }
  // ClientRouter swaps <body>, destroying the tooltip node, but listeners bound
  // to document/window survive. Bind them exactly once and always re-resolve
  // the node by id, otherwise every navigation stacks another handler set on a
  // detached element.
  function bindTooltip(){
    tooltipEl();
    if(window.__acTooltipBound)return;
    window.__acTooltipBound=1;
    var active=null;
    var hovered=null;
    var overTooltip=false;
    var dismissed=null;
    var hideTimer=null;
    function iconFrom(target){
      return target&&target.closest?target.closest('#ac-root .ac-info[data-tooltip]'):null;
    }
    function inTooltip(target){
      return target&&target.closest?!!target.closest('#ac-tooltip'):false;
    }
    function cancelHide(){
      if(hideTimer!==null)clearTimeout(hideTimer);
      hideTimer=null;
    }
    function hide(){
      cancelHide();
      tooltipEl().classList.remove('is-visible');
      if(active)active.removeAttribute('aria-describedby');
      active=null;
    }
    function position(icon,el){
      var iconRect=icon.getBoundingClientRect();
      var gap=8;
      var below=window.innerHeight-12-iconRect.bottom-gap;
      var above=iconRect.top-gap-12;
      var room=Math.min(window.innerHeight-24,Math.max(below,above));
      // Scroll long descriptions within the larger available side, not over the trigger.
      el.querySelector('.ac-tooltip-text').style.maxHeight=Math.max(24,room-24)+'px';
      var box=el.getBoundingClientRect();
      var left=iconRect.left+(iconRect.width/2)-(box.width/2);
      left=Math.max(12,Math.min(left,window.innerWidth-box.width-12));
      var top=iconRect.bottom+gap;
      if(top+box.height>window.innerHeight-12)top=iconRect.top-box.height-gap;
      top=Math.max(12,Math.min(top,window.innerHeight-box.height-12));
      el.style.left=Math.round(left)+'px';
      el.style.top=Math.round(top)+'px';
    }
    function show(icon){
      if(!icon.isConnected||icon===dismissed)return;
      var text=icon.getAttribute('data-tooltip');
      if(!text)return;
      cancelHide();
      var el=tooltipEl();
      if(active&&active!==icon)active.removeAttribute('aria-describedby');
      active=icon;
      var content=el.querySelector('.ac-tooltip-text');
      if(content.textContent!==text)content.textContent=text;
      el.classList.add('is-visible');
      position(icon,el);
      icon.setAttribute('aria-describedby','ac-tooltip');
    }
    function update(preferred){
      cancelHide();
      var focused=iconFrom(document.activeElement);
      if(dismissed&&hovered!==dismissed&&focused!==dismissed&&!overTooltip) dismissed=null;
      var icon=preferred||hovered||(overTooltip?active:null)||focused;
      if(icon&&icon.isConnected&&icon!==dismissed)show(icon);
      else hide();
    }
    function deferUpdate(){
      cancelHide();
      // The CSS hit area bridges the 8px gap; this also tolerates diagonal exits.
      hideTimer=setTimeout(function(){hideTimer=null;update();},120);
    }
    document.addEventListener('pointerover',function(e){
      var icon=iconFrom(e.target);
      if(icon){hovered=icon;overTooltip=false;update(icon);}
      else if(inTooltip(e.target)){overTooltip=true;update();}
    });
    document.addEventListener('pointerout',function(e){
      var icon=iconFrom(e.target);
      if(icon&&!icon.contains(e.relatedTarget)){
        hovered=iconFrom(e.relatedTarget);
        overTooltip=inTooltip(e.relatedTarget);
        if(hovered||overTooltip)update();else deferUpdate();
      }else if(inTooltip(e.target)&&!inTooltip(e.relatedTarget)){
        overTooltip=false;
        hovered=iconFrom(e.relatedTarget);
        if(hovered)update();else deferUpdate();
      }
    });
    document.addEventListener('focusin',function(e){update(iconFrom(e.target));});
    document.addEventListener('focusout',function(){deferUpdate();});
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&active){dismissed=active;overTooltip=false;hide();}
    });
    function reposition(){
      if(active&&active.isConnected)position(active,tooltipEl());
      else hide();
    }
    window.addEventListener('scroll',reposition,true);
    window.addEventListener('resize',reposition);
    document.addEventListener('astro:before-swap',function(){
      hide();hovered=null;overTooltip=false;dismissed=null;
    });
  }

  function init(){
    var root=document.getElementById('ac-root');
    if(!root||root.dataset.acInit)return;
    root.dataset.acInit='1';
    var payloadNode=root.querySelector('#ac-data');
    if(!payloadNode)return;
    var payload=JSON.parse(payloadNode.textContent||'{}');
    if(!payload.specs||!payload.specs.length)return;
    var state=defaultState(payload);
    var results=root.querySelector('#ac-results');
    var detail=root.querySelector('#ac-detail');
    var count=root.querySelector('#ac-result-count');
    var status=root.querySelector('#ac-status');
    var shown=payload.specs.length;
    bindTooltip();

    // Re-rendering the detail pane throws away the button the user just
    // activated; put focus back on its replacement so keyboard users keep
    // their place.
    function paintDetail(refocus){
      var spec=findSpec(payload,state.selected);
      if(!spec)return;
      detail.setAttribute('data-game-class',spec.gameClass);
      detail.innerHTML=renderDetail(spec,payload,state);
      if(status)status.textContent=statusMessage(spec,state,shown,payload.specs.length);
      var cards=results.querySelectorAll('.ac-spec-card');
      for(var i=0;i<cards.length;i++){
        cards[i].setAttribute('aria-pressed',cards[i].getAttribute('data-spec-key')===state.selected?'true':'false');
      }
      if(refocus){
        var target=detail.querySelector(refocus);
        if(target)target.focus();
      }
    }

    function paint(){
      var list=filterSpecs(payload,state);
      shown=list.length;
      count.textContent=list.length+' of '+payload.specs.length+' specs';
      if(!list.length){
        results.innerHTML='<div class="ac-empty">No specs match these filters.</div>';
        detail.innerHTML='<div class="ac-empty">Change a filter to continue.</div>';
        if(status)status.textContent='No specs match these filters.';
        return;
      }
      var selected=findSpec(payload,state.selected);
      if(!selected||list.indexOf(selected)===-1)state.selected=specKey(list[0]);
      results.innerHTML=renderCards(list,state);
      paintDetail(null);
    }

    function selectTab(name){
      state.tab=name;
      paintDetail('[data-detail-tab="'+name+'"]');
    }

    root.addEventListener('input',function(event){
      if(event.target.id==='ac-search'){state.search=event.target.value;paint();}
    });
    root.addEventListener('change',function(event){
      if(event.target.id==='ac-class'){state.gameClass=event.target.value;paint();}
      if(event.target.id==='ac-role'){state.role=event.target.value;paint();}
    });
    root.addEventListener('click',function(event){
      var methodButton=event.target.closest('[data-method-toggle]');
      if(methodButton){
        var methodPanel=root.querySelector('#ac-method');
        var isOpen=methodButton.getAttribute('aria-expanded')==='true';
        methodButton.setAttribute('aria-expanded',isOpen?'false':'true');
        if(methodPanel)methodPanel.hidden=isOpen;
        return;
      }
      var specButton=event.target.closest('[data-spec-key]');
      if(specButton){
        state.selected=specButton.getAttribute('data-spec-key');
        state.tab='missing';
        paintDetail(null);
        return;
      }
      var tabButton=event.target.closest('[data-detail-tab]');
      if(tabButton){selectTab(tabButton.getAttribute('data-detail-tab'));return;}
    });
    root.addEventListener('keydown',function(event){
      if(!event.target.closest)return;
      var tab=event.target.closest('[data-detail-tab]');
      if(!tab)return;
      var index=0;
      for(var i=0;i<DETAIL_TABS.length;i++){
        if(DETAIL_TABS[i][0]===tab.getAttribute('data-detail-tab'))index=i;
      }
      var next=-1;
      if(event.key==='ArrowRight')next=(index+1)%DETAIL_TABS.length;
      else if(event.key==='ArrowLeft')next=(index-1+DETAIL_TABS.length)%DETAIL_TABS.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=DETAIL_TABS.length-1;
      if(next<0)return;
      event.preventDefault();
      selectTab(DETAIL_TABS[next][0]);
    });

    // The server already rendered the default view; only repaint if the
    // hydrated state would differ (it does not on first load, so this is a
    // no-op that simply takes ownership of the DOM).
    paint();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  document.addEventListener('astro:page-load',init);
`;

// Built with concatenation, not a template literal: the render module's source
// is arbitrary JS and must not be scanned for \${} interpolation.
const clientJs = "(function(){\n" + renderSource.replace(/^export\s+/gm, "") + "\n" + wiring + "\n})();";

function buildHtml(): string {
  const summary = data.summary;
  const classes = [...new Set(data.specs.map((spec) => spec.gameClass))];
  const safeJson = jsonForHtml(data);

  const initialState = render.defaultState(data);
  const initialSpecs = render.filterSpecs(data, initialState);
  const initialSpec = initialSpecs[0];

  const classOptions = classes.map((gameClass) => `<option value="${esc(gameClass)}">${esc(gameClass)}</option>`).join("");
  const omissionChips = data.commonOmissions.map((item) => `<li class="ac-chip">${esc(item)}</li>`).join("");
  const medianBlizzardInfo = `Median across ${summary.comparableSpecs} comparable specs. Blizzard match equals shared distinct actions divided by Blizzard distinct actions.`;
  const medianSimcInfo = `Median across ${summary.comparableSpecs} comparable specs. SimC represented equals shared distinct actions divided by SimC distinct actions.`;
  const actionLinesInfo = `Executable action lines in the primary SimulationCraft profile for each of the ${summary.comparableSpecs} comparable specs, compared with ${summary.comparableBlizzardSteps} Blizzard priority steps for the same specs.`;

  const initialDetail = initialSpec
    ? `<div class="ac-detail" id="ac-detail" data-game-class="${esc(initialSpec.gameClass)}">${render.renderDetail(initialSpec, data, initialState)}</div>`
    : `<div class="ac-detail" id="ac-detail"><div class="ac-empty">No research data available.</div></div>`;

  return (
    `<div id="ac-root">` +
      `<style${nonceAttr(NONCE_PLACEHOLDER)}>${css}</style>` +
      `<section class="ac-hero">` +
        `<p class="ac-eyebrow">Blizzard Assisted Combat research</p>` +
        `<h2 class="ac-title">The core buttons are usually present. The optimized decisions are not.</h2>` +
        `<p class="ac-lede">Across the ${summary.comparableSpecs} specs with a comparable SimulationCraft profile, the median Blizzard action match is <strong>${summary.medianOverlap}%${infoIconMarkup(medianBlizzardInfo)}</strong>, while Blizzard represents <strong>${summary.medianSimcCoverage}%${infoIconMarkup(medianSimcInfo)}</strong> of SimC actions. Spell selection is largely right; the material gap is build, timing, resource, targeting, and encounter logic. Pick a specialization below for its exact priority list, what SimC does that it doesn't, and how it compares with Icy Veins.</p>` +
        `<button type="button" class="ac-method-toggle" data-method-toggle aria-expanded="false" aria-controls="ac-method"><span class="ac-method-toggle__label">Where the Blizzard APL data comes from</span><span class="ac-method-toggle__icon" aria-hidden="true">+</span></button>` +
        `<div class="ac-method" id="ac-method" hidden>` +
          `<p class="ac-method__intro">The Blizzard priority lists are reconstructed from three DB2 tables exported by Wago Tools for live build ${esc(data.currentBuild)}.</p>` +
          `<div class="ac-method-flow">` +
            `<section class="ac-method-card"><span class="ac-method-card__number">1</span><h3 class="ac-method-card__title">AssistedCombat</h3><p class="ac-method-card__copy">Identifies the Assisted Combat list assigned to each specialization.</p><span class="ac-method-card__fields">ID · ChrSpecializationID</span><div class="ac-method-links"><a class="ac-method-link" href="https://wago.tools/db2/AssistedCombat?build=${esc(data.currentBuild)}" target="_blank" rel="noopener noreferrer">Open table ↗</a></div></section>` +
            `<section class="ac-method-card"><span class="ac-method-card__number">2</span><h3 class="ac-method-card__title">AssistedCombatStep</h3><p class="ac-method-card__copy">Adds the spell for each step and its position in the priority list. ${summary.currentSteps} steps across all specs.</p><span class="ac-method-card__fields">ID · SpellID · AssistedCombatID · OrderIndex</span><div class="ac-method-links"><a class="ac-method-link" href="https://wago.tools/db2/AssistedCombatStep?build=${esc(data.currentBuild)}" target="_blank" rel="noopener noreferrer">Open table ↗</a></div></section>` +
            `<section class="ac-method-card"><span class="ac-method-card__number">3</span><h3 class="ac-method-card__title">AssistedCombatRule</h3><p class="ac-method-card__copy">Adds the ordered conditions that must pass before a step can be recommended. ${summary.currentRules.toLocaleString("en-US")} rules in the live dataset.</p><span class="ac-method-card__fields">ID · OrderIndex · ConditionType · ConditionValue1/2/3 · AssistedCombatStepID</span><div class="ac-method-links"><a class="ac-method-link" href="https://wago.tools/db2/AssistedCombatRule?build=${esc(data.currentBuild)}" target="_blank" rel="noopener noreferrer">Open table ↗</a></div></section>` +
          `</div>` +
          `<div class="ac-join"><strong>Join:</strong><code>AssistedCombat.ID</code><span>=</span><code>AssistedCombatStep.AssistedCombatID</code><span>then</span><code>AssistedCombatStep.ID</code><span>=</span><code>AssistedCombatRule.AssistedCombatStepID</code></div>` +
          `<p class="ac-method__note">Steps are sorted by <span class="ac-mono">OrderIndex</span>. Rules are grouped under their step and sorted by their own <span class="ac-mono">OrderIndex</span>. The readable condition labels use SimulationCraft's Assisted Combat enum and evaluator; the raw IDs and values are retained in the canonical CSV exports.</p>` +
        `</div>` +
      `</section>` +
      `<div class="ac-stats" role="group" aria-label="Research summary">` +
        `<div class="ui-panel ac-stat"><span class="ac-stat__value">${summary.specs}</span><span class="ac-stat__label">Specs reviewed · ${summary.classes} classes</span></div>` +
        `<div class="ui-panel ac-stat"><span class="ac-stat__value">${summary.medianOverlap}%${infoIconMarkup(medianBlizzardInfo)}</span><span class="ac-stat__label">Median Blizzard action match</span></div>` +
        `<div class="ui-panel ac-stat"><span class="ac-stat__value">${summary.medianSimcCoverage}%${infoIconMarkup(medianSimcInfo)}</span><span class="ac-stat__label">Median SimC actions represented</span></div>` +
        `<div class="ui-panel ac-stat"><span class="ac-stat__value">${summary.currentSteps}</span><span class="ac-stat__label">Blizzard 12.1 steps</span></div>` +
        `<div class="ui-panel ac-stat"><span class="ac-stat__value">${summary.simcActionLines.toLocaleString("en-US")}${infoIconMarkup(actionLinesInfo)}</span><span class="ac-stat__label">SimC action lines</span></div>` +
      `</div>` +
      `<div class="ac-scope">` +
        `<section class="ac-callout ac-callout--warning"><h3 class="ac-callout__title">How to read this</h3><p class="ac-callout__text">Assisted Combat is a baseline recommendation system, not a complete raid, dungeon, healing, or mitigation plan. Tanks are mostly shown offensive priorities; healer tables are overwhelmingly damage-oriented. Comparisons use a 12.1/MID2 SimC profile where one existed in the research snapshot, otherwise the latest available Midnight profile.</p></section>` +
        `<section class="ac-callout ac-callout--omissions"><h3 class="ac-callout__title">Common omissions versus SimC</h3><ul class="ac-chip-list">${omissionChips}</ul></section>` +
      `</div>` +
      `<section class="ac-explorer" aria-label="Specialization research explorer">` +
        `<div class="ac-toolbar">` +
          `<label class="ac-field">Search<input class="ui-control ac-input" id="ac-search" type="search" placeholder="Spec, class, action, or missing logic…" autocomplete="off" /></label>` +
          `<label class="ac-field">Class<select class="ui-control ac-select" id="ac-class"><option value="all">All classes</option>${classOptions}</select></label>` +
          `<label class="ac-field">Role<select class="ui-control ac-select" id="ac-role"><option value="all">All roles</option><option>DPS</option><option>Tank</option><option>Healer</option><option>Support DPS</option></select></label>` +
        `</div>` +
        `<noscript><p class="ac-noscript">Search, filtering, and switching between specializations need JavaScript. Every specialization is listed below and the full analysis for ${initialSpec ? esc(initialSpec.spec + " " + initialSpec.gameClass) : "the first specialization"} is shown, including all three sections.</p></noscript>` +
        `<p class="ac-sr" id="ac-status" role="status" aria-live="polite"></p>` +
        `<div class="ac-workspace">` +
          `<aside class="ac-browser"><div class="ac-results-head"><strong>Specializations</strong><span id="ac-result-count">${initialSpecs.length} of ${data.specs.length} specs</span></div><div class="ac-results" id="ac-results">${render.renderCards(initialSpecs, initialState)}</div></aside>` +
          initialDetail +
        `</div>` +
      `</section>` +
      `<div class="ac-sources">` +
        `<span class="ac-source-label">Pinned sources</span>` +
        sourceLink(`Wago live ${data.currentBuild}`, data.sources.wagoCurrent) +
        sourceLink("SimulationCraft APLs", data.sources.simc) +
        sourceLink("SimC action list docs", data.sources.simcDocs) +
        sourceLink("Research workbook", data.sources.googleSheet) +
      `</div>` +
      `<p class="ac-provenance">Blizzard data verified ${esc(data.verifiedAt)} on live build ${esc(data.currentBuild)}. Comparison research snapshot: ${esc(data.researchedAt)} · SimulationCraft ${esc(data.simcBranch)} commit <span class="ac-mono">${esc(data.simcCommit.slice(0, 12))}</span>. DB2 rows are exact; readable rule labels follow SimulationCraft's reverse-engineered condition decoder.</p>` +
      `<script type="application/json" id="ac-data">${safeJson}<\/script>` +
      `<script${nonceAttr(NONCE_PLACEHOLDER)}>${clientJs}<\/script>` +
    `</div>`
  );
}

// The output is a pure function of a static JSON import, so build it once per
// isolate instead of re-serialising ~300 KB of JSON on every request. The
// per-request CSP nonce can't be baked into that cache, so a placeholder
// stands in for it and gets swapped for the real value on every call.
const NONCE_PLACEHOLDER = "__CSP_NONCE_PLACEHOLDER__";
let cachedHtml: string | null = null;

export function generateAssistedCombatAnalysis(_attrs: Record<string, string>, nonce?: string): string {
  if (cachedHtml === null) cachedHtml = buildHtml();
  return nonce
    ? cachedHtml.replaceAll(NONCE_PLACEHOLDER, nonce)
    : cachedHtml.replaceAll(` nonce="${NONCE_PLACEHOLDER}"`, "");
}
