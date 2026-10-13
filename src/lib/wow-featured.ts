import { nonceAttr } from "./csp";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const INTRO_PARAGRAPHS = [
  "World of Warcraft is Blizzard Entertainment's long-running MMORPG, two decades of expansions " +
    "built around questing, dungeons, raids, and a persistent world shared with millions of other players.",
  "The content here isn't a full guide to the game. It's a small collection of research and useful " +
    "links I've gathered while playing, plus a look at The Hidden Lodge, the raiding guild I run with.",
];

export function generateWowIntro(_attrs: Record<string, string>, nonce?: string): string {
  const css = `
#wi-root{font-family:inherit;margin:0;}
#wi-root *{box-sizing:border-box;}

#wi-root .wi-row{display:flex;gap:1.5rem;align-items:center;margin:1rem 0;}
@media (max-width:700px){#wi-root .wi-row{flex-direction:column;align-items:stretch;}}

#wi-root .wi-text{flex:1;margin:0;line-height:1.7;color:var(--text,#e9eef9);}
#wi-root .wi-text p{margin:0 0 1rem;}
#wi-root .wi-text p:last-child{margin-bottom:0;}

#wi-root .wi-links{flex:0 0 400px;display:flex;flex-direction:column;gap:.75rem;}
@media (max-width:700px){#wi-root .wi-links{flex-basis:auto;}}

#wi-root a.wi-link{display:flex;align-items:center;gap:.9rem;min-height:44px;padding:.9rem 1.1rem;border-radius:var(--r-lg,16px);text-decoration:none;color:var(--text,#e9eef9);transition:border-color .18s ease,background .18s ease;}
#wi-root a.wi-link:hover{border-color:var(--line-strong,#3a4a78);text-decoration:none;}

#wi-root .wi-icon{color:var(--accent);flex:none;}

#wi-root .wi-title{font-weight:600;font-size:.95rem;white-space:nowrap;min-width:0;}
@media (max-width:700px){#wi-root .wi-title{white-space:normal;}}
`;

  return (
    `<div id="wi-root"><style${nonceAttr(nonce)}>${css}</style>` +
    `<div class="wi-row">` +
    `<div class="wi-text">${INTRO_PARAGRAPHS.map((p) => `<p>${esc(p)}</p>`).join("")}</div>` +
    `<div class="wi-links">` +
    `<a class="ui-panel wi-link" href="https://worldofwarcraft.com" target="_blank" rel="noopener noreferrer">` +
    `<svg class="wi-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>` +
    `</svg>` +
    `<span class="wi-title">Visit the Official World of Warcraft Site ↗</span>` +
    `</a>` +
    `<a class="ui-panel wi-link" href="https://worldofwarcraft.blizzard.com/en-us/news" target="_blank" rel="noopener noreferrer">` +
    `<svg class="wi-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>` +
    `</svg>` +
    `<span class="wi-title">Official WoW News ↗</span>` +
    `</a>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

interface FeaturedItem {
  title: string;
  description: string;
  href: string;
  iconSvg: string;
}

const FEATURED_ITEMS: FeaturedItem[] = [
  {
    title: "Spell Queue Window Guide & Simulator",
    description:
      "A full guide to the Spell Queue Window plus an interactive simulator testing how queue size, GCD length, latency, and keypress rhythm combine to create or prevent rotational gaps.",
    href: "/pages/spell-queue-window-simulator",
    iconSvg: '<path d="M3 12h4l2-7 4 14 3-9 2 5h3"/>',
  },
  {
    title: "Assisted Combat Analysis",
    description:
      "Blizzard's built-in rotation priority list for every specialization, pulled straight from the game's data "
      + "and compared against SimulationCraft and Icy Veins.",
    href: "/pages/assisted-combat-analysis",
    iconSvg: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  },
  {
    title: "Useful WoW Links",
    description: "A running list of bookmarked tools, trackers, and resources for World of Warcraft.",
    href: "/pages/useful-wow-links",
    iconSvg: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  },
];

export function generateWowFeatured(_attrs: Record<string, string>, nonce?: string): string {
  const itemsHtml = FEATURED_ITEMS.map((item) => (
    `<a class="ui-panel wf-card" href="${esc(item.href)}">` +
    `<svg class="wf-icon" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.iconSvg}</svg>` +
    `<span class="wf-title">${esc(item.title)}</span>` +
    `<span class="wf-desc">${esc(item.description)}</span>` +
    `</a>`
  )).join("");

  // Every rule is scoped by #wf-root: `.prose p` and `.prose a` in BaseLayout
  // are (0,1,1) and would otherwise beat bare classes, overriding the label's
  // margin and repainting the card text accent-blue with a hover underline.
  const css = `
#wf-root{font-family:inherit;margin:0;}
#wf-root *{box-sizing:border-box;}

#wf-root p.wf-label{margin:1.75rem 0 .75rem;font-size:.85rem;font-weight:700;color:var(--text-soft,#c3cbe0);}

#wf-root .wf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin:0;}
@media (max-width:640px){#wf-root .wf-grid{grid-template-columns:1fr;}}

#wf-root a.wf-card{display:flex;flex-direction:column;gap:.6rem;min-width:0;padding:1.25rem;border-radius:var(--r-lg,16px);color:var(--text,#e9eef9);text-decoration:none;transition:border-color .2s ease;}
#wf-root a.wf-card:hover{border-color:var(--line-strong,#3a4a78);text-decoration:none;}
#wf-root a.wf-card:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

#wf-root .wf-icon{color:var(--game-wow,#f5c46b);flex:none;}
#wf-root .wf-title{font-family:var(--font-display);font-weight:600;font-size:1rem;line-height:1.3;}
#wf-root .wf-desc{color:var(--muted,#a3aec9);font-size:.85rem;line-height:1.5;}
`;

  return `<div id="wf-root"><style${nonceAttr(nonce)}>${css}</style><p class="wf-label">On This Site</p><div class="wf-grid">${itemsHtml}</div></div>`;
}

const HIDDEN_LODGE_FACTS: { label: string; value: string }[] = [
  { label: "Realm", value: "Illidan (US)" },
  { label: "Schedule", value: "Thu / Fri, 9:00 PM – 12:00 AM ET" },
  { label: "Focus", value: "Ahead of the Curve → Mythic progression" },
];

export function generateHiddenLodgeFeature(_attrs: Record<string, string>, nonce?: string): string {
  const css = `
#hl-root{font-family:inherit;margin:0;}
#hl-root *{box-sizing:border-box;}

#hl-root .hl-card{position:relative;overflow:hidden;margin:1.5rem 0;border-radius:var(--r-lg,16px);}

#hl-root .hl-media{position:absolute;top:0;right:0;bottom:0;width:42%;overflow:hidden;}
@media (max-width:700px){#hl-root .hl-media{position:static;width:100%;aspect-ratio:16/9;}}

/* The .prose img/h2/ul/p rules in BaseLayout out-specify a bare class, so
   these overrides are scoped by #hl-root to win. */
#hl-root img.hl-img{display:block;width:100%;height:100%;margin:0;border:0;border-radius:0;object-fit:cover;object-position:center 42%;}

#hl-root .hl-body{padding:1.25rem 1.5rem 1.5rem 1.5rem;margin-right:calc(42% + 1.5rem);}
@media (max-width:700px){#hl-root .hl-body{margin-right:0;padding:1.25rem 1.25rem 1.5rem;}}

#hl-root h2.hl-title{margin:0 0 .4rem;padding:0;border:0;font-family:var(--font-display);font-size:1.35rem;font-weight:600;color:var(--text,#e9eef9);}

#hl-root p.hl-tagline{margin:0 0 1rem;font-size:.85rem;font-style:italic;color:var(--accent,#70d0ff);}

#hl-root p.hl-desc{margin:0 0 1.1rem;line-height:1.7;color:var(--text,#e9eef9);}

#hl-root ul.hl-facts{display:flex;flex-wrap:wrap;gap:.6rem;margin:0 0 1.2rem;padding:0;list-style:none;}
#hl-root li.hl-fact{display:flex;align-items:baseline;gap:.4rem;margin:0;padding:.4rem .8rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-pill,999px);font-size:.8rem;color:var(--muted,#a3aec9);}
#hl-root .hl-fact strong{color:var(--text,#e9eef9);font-weight:600;}

#hl-root a.hl-cta{display:inline-flex;align-items:center;gap:.5rem;padding:.7rem 1.2rem;border:1px solid var(--accent,#70d0ff);border-radius:var(--r-md,10px);color:var(--accent,#70d0ff);text-decoration:none;font-weight:600;font-size:.9rem;transition:background .18s ease;}
#hl-root a.hl-cta:hover{background:rgb(from var(--accent) r g b / 10%);text-decoration:none;}
`;

  const factsHtml = HIDDEN_LODGE_FACTS
    .map((f) => `<li class="hl-fact">${esc(f.label)}: <strong>${esc(f.value)}</strong></li>`)
    .join("");

  return (
    `<div id="hl-root"><style${nonceAttr(nonce)}>${css}</style>` +
    `<div class="ui-panel hl-card">` +
    `<div class="hl-media">` +
    `<img class="hl-img" src="/images/hidden-lodge-header.webp" alt="The Hidden Lodge banner: For Azeroth. For The Hidden Lodge." loading="lazy" />` +
    `</div>` +
    `<div class="hl-body">` +
    `<h2 class="hl-title">The Hidden Lodge</h2>` +
    `<p class="hl-tagline">For Azeroth. For The Hidden Lodge.</p>` +
    `<p class="hl-desc">The Hidden Lodge is the raiding guild I run with, a semi-hardcore crew on Illidan (US) ` +
    `focused on getting Ahead of the Curve each tier before pushing into Mythic progression. We take the game ` +
    `seriously without turning raid night into a second job: lock in during pulls, joke around the rest of the time.</p>` +
    `<ul class="hl-facts">${factsHtml}</ul>` +
    `<a class="hl-cta" href="https://hidden-lodge.com" target="_blank" rel="noopener noreferrer">` +
    `Visit The Hidden Lodge ↗` +
    `</a>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}
