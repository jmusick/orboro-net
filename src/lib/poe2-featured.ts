import { nonceAttr } from "./csp";

interface FeaturedItem {
  title: string;
  description: string;
  href: string;
  iconSvg: string;
}

const ITEMS: FeaturedItem[] = [
  {
    title: "Atlas Farming Strategies",
    description: "Curated endgame Atlas strategies for efficient mapping and farming.",
    href: "/pages/atlas-farming-strategies",
    iconSvg: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  },
  {
    title: "Expedition Rumours Cheat Sheet",
    description: "Quick reference for which Expedition rumours are safe to detonate with Aldur's Bloodmark.",
    href: "/pages/expedition-rumours-cheat-sheet",
    iconSvg: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  },
  {
    title: "Useful POE2 Links",
    description: "A running list of bookmarked tools, trackers, and resources for Path of Exile 2.",
    href: "/pages/useful-poe2-links",
    iconSvg: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  },
];

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generatePoe2Featured(_attrs: Record<string, string>, nonce?: string): string {
  const itemsHtml = ITEMS.map((item) => (
    `<a class="ui-panel pf-card" href="${esc(item.href)}">` +
    `<svg class="pf-icon" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.iconSvg}</svg>` +
    `<span class="pf-title">${esc(item.title)}</span>` +
    `<span class="pf-desc">${esc(item.description)}</span>` +
    `</a>`
  )).join("");

  const css = `
#pf-root{font-family:inherit;margin:0;}
#pf-root *{box-sizing:border-box;}

#pf-root .pf-label{font-size:.85rem;font-weight:700;color:var(--text-soft,#c3cbe0);margin:1.75rem 0 .75rem;}

#pf-root .pf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:0;}
@media (max-width:768px){#pf-root .pf-grid{grid-template-columns:1fr 1fr;}}
@media (max-width:520px){#pf-root .pf-grid{grid-template-columns:1fr;}}

#pf-root .pf-card{display:flex;flex-direction:column;gap:.6rem;padding:1.25rem;border-radius:var(--r-lg,16px);text-decoration:none;color:var(--text,#e9eef9);transition:border-color .2s ease;}
#pf-root .pf-card:hover{border-color:var(--line-strong,#3a4a78);}

#pf-root .pf-icon{color:var(--game-poe,#ff8a73);flex:none;}

#pf-root .pf-title{font-family:var(--font-display);font-weight:600;font-size:1rem;line-height:1.3;}

#pf-root .pf-desc{color:var(--muted,#a3aec9);font-size:.85rem;line-height:1.5;}
`;

  return `<div id="pf-root"><style${nonceAttr(nonce)}>${css}</style><p class="pf-label">On This Site</p><div class="pf-grid">${itemsHtml}</div></div>`;
}

const INTRO_PARAGRAPHS = [
  "Path of Exile 2 is Grinding Gear Games' free-to-play action RPG, the sequel to the original " +
    "Path of Exile: deep skill and passive systems, brutal combat, and an evolving endgame built " +
    "around the Atlas.",
  "The content here isn't a full guide to the game. It's a small collection of tools, utilities, " +
    "and reference material I put together for myself while playing (farming strategies, cheat " +
    "sheets, and useful links) that I figured might be handy for other exiles too.",
];

export function generatePoe2Intro(_attrs: Record<string, string>, nonce?: string): string {
  const css = `
#pi-root{font-family:inherit;margin:0;}
#pi-root *{box-sizing:border-box;}

#pi-root .pi-row{display:flex;gap:1.5rem;align-items:center;margin:1rem 0;}
@media (max-width:700px){#pi-root .pi-row{flex-direction:column;align-items:stretch;}}

#pi-root .pi-text{flex:1;margin:0;line-height:1.7;color:var(--text,#e9eef9);}
#pi-root .pi-text p{margin:0 0 1rem;}
#pi-root .pi-text p:last-child{margin-bottom:0;}

#pi-root .pi-links{flex:0 0 400px;display:flex;flex-direction:column;gap:.75rem;}
@media (max-width:700px){#pi-root .pi-links{flex-basis:auto;}}

#pi-root .pi-link{display:flex;align-items:center;gap:.9rem;min-height:44px;padding:.9rem 1.1rem;border-radius:var(--r-lg,16px);text-decoration:none;color:var(--text,#e9eef9);transition:border-color .18s ease,background .18s ease;}
#pi-root .pi-link:hover{border-color:var(--line-strong,#3a4a78);}

#pi-root .pi-icon{color:var(--accent);flex:none;}

#pi-root .pi-title{font-weight:600;font-size:.95rem;white-space:nowrap;min-width:0;}
@media (max-width:700px){#pi-root .pi-title{white-space:normal;}}
`;

  return (
    `<div id="pi-root"><style${nonceAttr(nonce)}>${css}</style>` +
    `<div class="pi-row">` +
    `<div class="pi-text">${INTRO_PARAGRAPHS.map((p) => `<p>${esc(p)}</p>`).join("")}</div>` +
    `<div class="pi-links">` +
    `<a class="ui-panel pi-link" href="https://pathofexile2.com" target="_blank" rel="noopener noreferrer">` +
    `<svg class="pi-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>` +
    `</svg>` +
    `<span class="pi-title">Visit the Official Path of Exile 2 Site ↗</span>` +
    `</a>` +
    `<a class="ui-panel pi-link" href="https://poe.ninja/poe2/profile/XingYuen-3765" target="_blank" rel="noopener noreferrer">` +
    `<svg class="pi-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>` +
    `</svg>` +
    `<span class="pi-title">View My Characters on poe.ninja ↗</span>` +
    `</a>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}
