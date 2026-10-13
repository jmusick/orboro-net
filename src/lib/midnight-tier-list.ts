import specIcons from "./assisted-combat-spec-icons.json";
import { nonceAttr } from "./csp";

type Tier = "S" | "A" | "B" | "C" | "D";

interface SpecScore {
  specId: number;
  name: string;
  score: number;
}

interface CreatorScore {
  rank: number;
  name: string;
  score: number;
  url: string;
}

type TierBoard = Record<Tier, SpecScore[]>;

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D"];

const RESEARCH_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1_XGdJ0u2Kkfwl7mBGQd2teCUfgYSE_bTN3d9gQIDFyY/edit?usp=sharing";

const BOARDS: Record<string, { label: string; tiers: TierBoard }> = {
  tanks: {
    label: "Tank",
    tiers: {
      S: [{ specId: 250, name: "Blood Death Knight", score: 86.0 }],
      A: [{ specId: 66, name: "Protection Paladin", score: 65.9 }],
      B: [
        { specId: 104, name: "Guardian Druid", score: 45.2 },
        { specId: 73, name: "Protection Warrior", score: 41.5 },
        { specId: 581, name: "Vengeance Demon Hunter", score: 41.5 },
      ],
      C: [{ specId: 268, name: "Brewmaster Monk", score: 20.1 }],
      D: [],
    },
  },
  healers: {
    label: "Healer",
    tiers: {
      S: [
        { specId: 65, name: "Holy Paladin", score: 87.4 },
        { specId: 264, name: "Restoration Shaman", score: 80.3 },
      ],
      A: [],
      B: [{ specId: 270, name: "Mistweaver Monk", score: 55.7 }],
      C: [
        { specId: 256, name: "Discipline Priest", score: 38.7 },
        { specId: 1468, name: "Preservation Evoker", score: 35.9 },
        { specId: 105, name: "Restoration Druid", score: 28.4 },
      ],
      D: [{ specId: 257, name: "Holy Priest", score: 10.3 }],
    },
  },
  dps: {
    label: "DPS",
    tiers: {
      S: [
        { specId: 71, name: "Arms Warrior", score: 95.6 },
        { specId: 62, name: "Arcane Mage", score: 94.7 },
        { specId: 262, name: "Elemental Shaman", score: 85.1 },
        { specId: 251, name: "Frost Death Knight", score: 81.2 },
      ],
      A: [
        { specId: 1480, name: "Devourer Demon Hunter", score: 78.8 },
        { specId: 102, name: "Balance Druid", score: 71.9 },
        { specId: 260, name: "Outlaw Rogue", score: 65.3 },
      ],
      B: [
        { specId: 269, name: "Windwalker Monk", score: 57.2 },
        { specId: 259, name: "Assassination Rogue", score: 54.6 },
        { specId: 252, name: "Unholy Death Knight", score: 52.6 },
        { specId: 577, name: "Havoc Demon Hunter", score: 50.0 },
        { specId: 267, name: "Destruction Warlock", score: 47.6 },
        { specId: 254, name: "Marksmanship Hunter", score: 47.5 },
        { specId: 265, name: "Affliction Warlock", score: 43.1 },
        { specId: 266, name: "Demonology Warlock", score: 43.1 },
        { specId: 1473, name: "Augmentation Evoker", score: 42.5 },
        { specId: 70, name: "Retribution Paladin", score: 41.6 },
        { specId: 263, name: "Enhancement Shaman", score: 40.1 },
      ],
      C: [
        { specId: 103, name: "Feral Druid", score: 36.3 },
        { specId: 258, name: "Shadow Priest", score: 34.1 },
        { specId: 63, name: "Fire Mage", score: 33.0 },
        { specId: 64, name: "Frost Mage", score: 30.2 },
        { specId: 253, name: "Beast Mastery Hunter", score: 30.2 },
        { specId: 255, name: "Survival Hunter", score: 29.1 },
        { specId: 261, name: "Subtlety Rogue", score: 24.4 },
      ],
      D: [
        { specId: 1467, name: "Devastation Evoker", score: 15.0 },
        { specId: 72, name: "Fury Warrior", score: 10.9 },
      ],
    },
  },
};

const CREATOR_ACCURACY_TIERS: Record<Tier, CreatorScore[]> = {
  S: [],
  A: [],
  B: [
    { rank: 1, name: "izen", score: 61.6, url: "https://www.youtube.com/watch?v=KktdoK1OZVY" },
    { rank: 2, name: "YoDaTV", score: 60.6, url: "https://www.youtube.com/watch?v=Zc-pNsazA90" },
    { rank: 3, name: "Petko", score: 59.7, url: "https://www.youtube.com/watch?v=bUlSIg2dFCI" },
    { rank: 4, name: "Tactyks / Method", score: 59.3, url: "https://www.method.gg/guides/tier-list/mythic-plus" },
    { rank: 5, name: "Dorki", score: 58.4, url: "https://www.youtube.com/watch?v=3r_vwmTUZXs" },
    { rank: 6, name: "Tettles", score: 57.5, url: "https://www.youtube.com/watch?v=8W_Ezsy1u6I" },
    { rank: 7, name: "Naowh / Robin panel", score: 55.8, url: "https://www.youtube.com/watch?v=LLe9lSftDRs" },
    { rank: 8, name: "zor thas", score: 53.6, url: "https://www.youtube.com/watch?v=SV3Snl21XC8" },
  ],
  C: [
    { rank: 9, name: "Saltii", score: 49.1, url: "https://www.youtube.com/watch?v=qrXc0jCNskE" },
    { rank: 10, name: "mulltiy", score: 46.7, url: "https://www.youtube.com/watch?v=CTlLWOcIx40" },
    { rank: 11, name: "Casualaddict", score: 42.8, url: "https://www.youtube.com/watch?v=GKA7XF7sRtE" },
    { rank: 12, name: "Chorsh", score: 38.9, url: "https://www.youtube.com/watch?v=9n0fHh5ouLg" },
  ],
  D: [
    { rank: 13, name: "Kushi", score: 22.1, url: "https://www.youtube.com/watch?v=Ux9DoFKaddY" },
  ],
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSpec(spec: SpecScore): string {
  const icon = (specIcons as Record<string, string>)[String(spec.specId)];
  const iconMarkup = icon
    ? `<img class="mtl-spec-icon" src="/images/wow-spec-icons/${esc(icon)}.jpg" alt="" width="34" height="34" loading="lazy" decoding="async">`
    : "";

  return (
    `<span class="mtl-spec">` +
    `<span class="mtl-spec-main">${iconMarkup}<span class="mtl-spec-name">${esc(spec.name)}</span></span>` +
    `<span class="mtl-score" aria-label="Score ${spec.score.toFixed(1)}">${spec.score.toFixed(1)}</span>` +
    `</span>`
  );
}

export function generateMidnightSheetLink(_attrs: Record<string, string>, nonce?: string): string {
  const css = `
#mts-root{margin:1.25rem 0 1.75rem;font-family:inherit;}
#mts-root *{box-sizing:border-box;}
#mts-root a.mts-link{display:flex;align-items:center;gap:1rem;width:100%;padding:1.1rem 1.25rem;border:1px solid rgb(from var(--accent) r g b / 35%);border-radius:var(--r-lg,16px);background:var(--surface,#0f1326);color:var(--text,#e9eef9);text-decoration:none;transition:border-color .18s;}
#mts-root a.mts-link:hover{border-color:var(--accent,#70d0ff);text-decoration:none;}
#mts-root a.mts-link:focus-visible{outline:2px solid var(--accent,#70d0ff);outline-offset:3px;}
#mts-root .mts-icon{display:grid;place-items:center;flex:0 0 auto;width:2.65rem;height:2.65rem;border:1px solid rgb(from var(--accent) r g b / 28%);border-radius:var(--r-md,10px);background:rgb(from var(--accent) r g b / 8%);color:var(--accent,#70d0ff);}
#mts-root .mts-copy{display:flex;flex:1;flex-direction:column;gap:.2rem;min-width:0;}
#mts-root .mts-eyebrow{color:var(--accent,#70d0ff);font-size:.78rem;font-weight:700;}
#mts-root .mts-title{font-family:var(--font-display);font-size:1rem;font-weight:600;line-height:1.3;color:var(--text,#e9eef9);}
#mts-root .mts-note{color:var(--muted,#a3aec9);font-size:.78rem;line-height:1.35;}
#mts-root .mts-external{display:inline-flex;align-items:center;gap:.35rem;flex:0 0 auto;padding:.42rem .62rem;border:1px solid rgb(from var(--accent) r g b / 24%);border-radius:var(--r-pill,999px);background:rgb(from var(--accent) r g b / 6%);color:var(--accent,#70d0ff);font-size:.72rem;font-weight:750;white-space:nowrap;}
@media (max-width:560px){
  #mts-root a.mts-link{align-items:flex-start;gap:.75rem;padding:.9rem;}
  #mts-root .mts-icon{width:2.35rem;height:2.35rem;}
  #mts-root .mts-external{display:none;}
}
`;

  return (
    `<div id="mts-root"><style${nonceAttr(nonce)}>${css}</style>` +
    `<a class="mts-link" href="${RESEARCH_SHEET_URL}" target="_blank" rel="noopener noreferrer" aria-label="Open the complete tier-list research workbook in Google Sheets in a new tab">` +
    `<span class="mts-icon" aria-hidden="true">` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>` +
    `</span>` +
    `<span class="mts-copy">` +
    `<span class="mts-eyebrow">Full research data</span>` +
    `<span class="mts-title">View the complete tier-list workbook in Google Sheets</span>` +
    `<span class="mts-note">Raw placements, normalized scores, source dates, weights, and evidence links. Opens in a new tab.</span>` +
    `</span>` +
    `<span class="mts-external" aria-hidden="true">External link ↗</span>` +
    `</a></div>`
  );
}

export function generateMidnightTierList(attrs: Record<string, string>, nonce?: string): string {
  const roleKey = (attrs.role ?? "").trim().toLowerCase();
  const board = BOARDS[roleKey];
  if (!board) return `<p><em>Unknown tier-list role.</em></p>`;
  const scopeId = esc(roleKey);

  const rows = TIER_ORDER.map((tier) => {
    const specs = board.tiers[tier];
    const contents = specs.length
      ? specs.map(renderSpec).join("")
      : `<span class="mtl-empty">No specs</span>`;

    return (
      `<div class="mtl-row mtl-${tier.toLowerCase()}" role="row">` +
      `<div class="mtl-tier" role="rowheader" aria-label="${tier} tier">${tier}</div>` +
      `<div class="mtl-specs" role="cell">${contents}</div>` +
      `</div>`
    );
  }).join("");

  const css = `
#mtl-${scopeId}{margin:1rem 0 2rem;font-family:inherit;}
#mtl-${scopeId} *{box-sizing:border-box;}
#mtl-${scopeId}.mtl-board{display:flex;flex-direction:column;gap:.45rem;}
#mtl-${scopeId} .mtl-row{display:grid;grid-template-columns:4.25rem minmax(0,1fr);min-height:4.25rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);overflow:hidden;background:var(--surface,#0f1326);}
#mtl-${scopeId} .mtl-tier{display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:1.6rem;font-weight:700;line-height:1;color:#101522;}
#mtl-${scopeId} .mtl-s .mtl-tier{background:#ff6b6b;}
#mtl-${scopeId} .mtl-a .mtl-tier{background:#ffad66;}
#mtl-${scopeId} .mtl-b .mtl-tier{background:#ffd966;}
#mtl-${scopeId} .mtl-c .mtl-tier{background:#8bd17c;}
#mtl-${scopeId} .mtl-d .mtl-tier{background:#72b7e8;}
#mtl-${scopeId} .mtl-specs{display:flex;flex-wrap:wrap;align-items:center;gap:.55rem;padding:.65rem;min-width:0;}
#mtl-${scopeId} .mtl-spec{display:inline-flex;align-items:center;gap:.6rem;min-height:2.9rem;padding:.35rem .5rem .35rem .4rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:var(--surface-2,#151b33);color:var(--text,#e9eef9);}
#mtl-${scopeId} .mtl-spec-main{display:inline-flex;align-items:center;gap:.55rem;min-width:0;}
#mtl-${scopeId} img.mtl-spec-icon{display:block;flex:0 0 auto;width:2.125rem;height:2.125rem;margin:0;max-width:none;border:1px solid rgb(255 255 255 / 14%);border-radius:var(--r-sm,6px);object-fit:cover;}
#mtl-${scopeId} .mtl-spec-name{font-size:.84rem;font-weight:650;line-height:1.2;}
#mtl-${scopeId} .mtl-score{display:inline-flex;align-items:center;justify-content:center;min-width:2.7rem;padding:.2rem .38rem;border-radius:var(--r-sm,6px);background:rgb(255 255 255 / 7%);color:var(--muted,#a3aec9);font-size:.72rem;font-variant-numeric:tabular-nums;}
#mtl-${scopeId} .mtl-empty{color:var(--muted,#a3aec9);font-size:.8rem;font-style:italic;}
@media (max-width:560px){
  #mtl-${scopeId} .mtl-row{grid-template-columns:3.25rem minmax(0,1fr);min-height:3.75rem;}
  #mtl-${scopeId} .mtl-tier{font-size:1.35rem;}
  #mtl-${scopeId} .mtl-specs{gap:.4rem;padding:.5rem;}
  #mtl-${scopeId} .mtl-spec{width:100%;justify-content:space-between;}
}
`;

  return (
    `<div id="mtl-${scopeId}" class="mtl-board" role="table" aria-label="${esc(board.label)} weighted aggregate tier list">` +
    `<style${nonceAttr(nonce)}>${css}</style>${rows}</div>`
  );
}

export function generateMidnightCreatorAccuracyTierList(
  _attrs: Record<string, string>,
  nonce?: string,
): string {
  const rows = TIER_ORDER.map((tier) => {
    const creators = CREATOR_ACCURACY_TIERS[tier];
    const contents = creators.length
      ? creators.map((creator) => (
          `<a class="mcal-card" href="${esc(creator.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(creator.name)} forecast source">` +
          `<span class="mcal-rank">#${creator.rank}</span>` +
          `<span class="mcal-name">${esc(creator.name)}</span>` +
          `<span class="mcal-score" aria-label="Accuracy score ${creator.score.toFixed(1)}">${creator.score.toFixed(1)}</span>` +
          `</a>`
        )).join("")
      : `<span class="mcal-empty">No creators</span>`;

    return (
      `<div class="mcal-row mcal-${tier.toLowerCase()}" role="row">` +
      `<div class="mcal-tier" role="rowheader" aria-label="${tier} tier">${tier}</div>` +
      `<div class="mcal-creators" role="cell">${contents}</div>` +
      `</div>`
    );
  }).join("");

  const css = `
#mcal-root{margin:1rem 0 2rem;font-family:inherit;}
#mcal-root *{box-sizing:border-box;}
#mcal-root.mcal-board{display:flex;flex-direction:column;gap:.45rem;}
#mcal-root .mcal-row{display:grid;grid-template-columns:4.25rem minmax(0,1fr);min-height:4.25rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);overflow:hidden;background:var(--surface,#0f1326);}
#mcal-root .mcal-tier{display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:1.6rem;font-weight:700;line-height:1;color:#101522;}
#mcal-root .mcal-s .mcal-tier{background:#ff6b6b;}
#mcal-root .mcal-a .mcal-tier{background:#ffad66;}
#mcal-root .mcal-b .mcal-tier{background:#ffd966;}
#mcal-root .mcal-c .mcal-tier{background:#8bd17c;}
#mcal-root .mcal-d .mcal-tier{background:#72b7e8;}
#mcal-root .mcal-creators{display:flex;flex-wrap:wrap;align-items:center;gap:.55rem;padding:.65rem;min-width:0;}
#mcal-root a.mcal-card{display:inline-grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.55rem;min-height:2.9rem;padding:.42rem .55rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:var(--surface-2,#151b33);color:var(--text,#e9eef9);text-decoration:none;transition:border-color .18s;}
#mcal-root a.mcal-card:hover{border-color:rgb(from var(--accent) r g b / 48%);text-decoration:none;}
#mcal-root a.mcal-card:focus-visible{outline:2px solid var(--accent,#70d0ff);outline-offset:2px;}
#mcal-root .mcal-rank{display:inline-flex;align-items:center;justify-content:center;min-width:2.1rem;padding:.2rem .35rem;border-radius:var(--r-sm,6px);background:rgb(from var(--accent) r g b / 9%);color:var(--accent,#70d0ff);font-size:.7rem;font-weight:800;font-variant-numeric:tabular-nums;}
#mcal-root .mcal-name{font-size:.84rem;font-weight:700;line-height:1.2;}
#mcal-root .mcal-score{display:inline-flex;align-items:center;justify-content:center;min-width:2.9rem;padding:.2rem .38rem;border-radius:var(--r-sm,6px);background:rgb(255 255 255 / 7%);color:var(--muted,#a3aec9);font-size:.72rem;font-variant-numeric:tabular-nums;}
#mcal-root .mcal-empty{color:var(--muted,#a3aec9);font-size:.8rem;font-style:italic;}
@media (max-width:560px){
  #mcal-root .mcal-row{grid-template-columns:3.25rem minmax(0,1fr);min-height:3.75rem;}
  #mcal-root .mcal-tier{font-size:1.35rem;}
  #mcal-root .mcal-creators{gap:.4rem;padding:.5rem;}
  #mcal-root a.mcal-card{width:100%;}
}
`;

  return (
    `<div id="mcal-root" class="mcal-board" role="table" aria-label="Creator prediction accuracy tier list">` +
    `<style${nonceAttr(nonce)}>${css}</style>${rows}</div>`
  );
}
