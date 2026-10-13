import { fetchBounded, normalizeBookmarks, readLimitedText, type Bookmark } from "./bookmarks-data";
import { nonceAttr } from "./csp";

const TAGSTASH_USER = "JD";
const CACHE_TTL_SECONDS = 600;

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Only validated, bounded results are cached, so an upstream error or
// malformed body is never replayed for the TTL.
async function fetchBookmarks(tag: string): Promise<Bookmark[]> {
  const url = `https://tagsta.sh/api/profiles/${encodeURIComponent(TAGSTASH_USER)}?tag=${encodeURIComponent(tag)}`;
  const cache = (caches as CacheStorage & { readonly default: Cache }).default;
  const cacheKey = new Request(url);

  const cached = await cache.match(cacheKey);
  if (cached) {
    try {
      return normalizeBookmarks(JSON.parse(await readLimitedText(cached)));
    } catch {
      // Fall through and refetch.
    }
  }

  const res = await fetchBounded(url);
  if (!res.ok) throw new Error(`tagsta.sh responded with ${res.status}`);
  const bookmarks = normalizeBookmarks(JSON.parse(await readLimitedText(res)));

  await cache.put(
    cacheKey,
    new Response(JSON.stringify({ bookmarks: bookmarks.map((b) => ({
      title: b.title,
      url: b.url,
      description: b.description,
      favicon_url: b.faviconUrl,
      tags: b.tags.map((name) => ({ name })),
    })) }), {
      headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` },
    }),
  );
  return bookmarks;
}

// A broken upstream or a rendering fault must not 500 the containing page.
export async function generateBookmarksList(attrs: Record<string, string>, nonce?: string): Promise<string> {
  try {
    return await buildBookmarksList(attrs, nonce);
  } catch {
    return `<p><em>Couldn't load bookmarks right now. Try again later.</em></p>`;
  }
}

async function buildBookmarksList(attrs: Record<string, string>, nonce?: string): Promise<string> {
  const tag = attrs.tag;
  if (!tag) {
    return `<p><em>Bookmark list error: missing "tag" attribute.</em></p>`;
  }

  let bookmarks: Bookmark[];
  try {
    bookmarks = await fetchBookmarks(tag);
  } catch {
    return `<p><em>Couldn't load bookmarks for "${esc(tag)}" right now. Try again later.</em></p>`;
  }

  if (bookmarks.length === 0) {
    return `<p><em>No bookmarks tagged "${esc(tag)}" yet.</em></p>`;
  }

  const sorted = [...bookmarks].sort((a, b) => a.title.localeCompare(b.title));

  // The tag this list was fetched by is never useful as a category — every bookmark
  // here has it by definition. Beyond that, which tags count as "noise" rather than a
  // real category varies per page (e.g. poe2 links are all tagged arpg/gaming), so that's
  // left to the page author via the exclude_categories attribute rather than guessed.
  const excludedTagNames = new Set(
    [tag, ...(attrs.exclude_categories ?? "").split(",")]
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  const tagNameLists = sorted.map((b) => b.tags);
  const categoriesByBookmark = tagNameLists.map((names) =>
    names.filter((name) => !excludedTagNames.has(name.toLowerCase())).sort((a, b) => a.localeCompare(b))
  );

  const categoryCounts = new Map<string, number>();
  categoriesByBookmark.forEach((names) => {
    for (const name of names) categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
  });
  const categories = [...categoryCounts.keys()].sort((a, b) => a.localeCompare(b));

  const itemsHtml = sorted.map((b, i) => {
    const favicon = b.faviconUrl
      ? `<img class="bml-favicon" src="${esc(b.faviconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
      : `<span class="bml-favicon bml-favicon--placeholder" aria-hidden="true"></span>`;
    const description = b.description
      ? `<span class="bml-desc">${esc(b.description)}</span>`
      : "";
    const cats = categoriesByBookmark[i];
    const dataCats = esc(cats.join(" "));

    return (
      `<a class="ui-panel bml-item" data-categories="${dataCats}" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">` +
      favicon +
      `<span class="bml-body">` +
      `<span class="bml-title">${esc(b.title)}</span>` +
      description +
      `</span>` +
      `</a>`
    );
  }).join("");

  const categoryChips = categories.length > 0
    ? `<div class="bml-cats">` +
      `<button type="button" class="ui-action bml-cat bml-cat--active" data-category="" aria-pressed="true">All <span class="bml-cat__count">${sorted.length}</span></button>` +
      categories
        .map((c) => `<button type="button" class="ui-action bml-cat" data-category="${esc(c)}" aria-pressed="false">${esc(c)} <span class="bml-cat__count">${categoryCounts.get(c)}</span></button>`)
        .join("") +
      `</div>`
    : "";

  const css = `
#bml-root{font-family:inherit;margin:0;}
#bml-root *{box-sizing:border-box;}

#bml-root .bml-list{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;}
@media (max-width:640px){#bml-root .bml-list{grid-template-columns:1fr;}}

#bml-root .bml-item{display:flex;align-items:center;gap:.7rem;min-height:44px;padding:.6rem .85rem;text-decoration:none;color:var(--text,#e9eef9);transition:border-color .18s ease,background .18s ease;min-width:0;}
#bml-root .bml-item:hover{border-color:var(--line-strong,#3a4a78);}

#bml-root .bml-favicon{width:16px;height:16px;flex:none;border-radius:var(--r-sm,6px);}
#bml-root .bml-favicon--placeholder{background:var(--surface,#0f1326);border:1px solid var(--line,#1d2442);}

#bml-root .bml-body{display:flex;flex-direction:column;gap:.1rem;min-width:0;}

#bml-root .bml-title{font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

#bml-root .bml-desc{color:var(--muted,#a3aec9);font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

#bml-root .bml-item[hidden]{display:none;}

#bml-root p.bml-status{margin:0 0 .7rem;font-size:.85rem;color:var(--muted,#a3aec9);}
#bml-root .bml-cats{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.7rem;}
#bml-root .bml-cat{display:inline-flex;align-items:center;gap:.35rem;min-height:36px;color:var(--text-soft,#c3cbe0);padding:.3rem .9rem;border-radius:var(--r-pill,999px);font-size:.85rem;font-weight:600;cursor:pointer;transition:color .15s ease,border-color .15s ease,background .15s ease;}
#bml-root .bml-cat:hover{color:var(--text,#e9eef9);border-color:var(--muted,#a3aec9);}
#bml-root .bml-cat--active{color:var(--accent-ink,#06101c);background:var(--accent,#70d0ff);border-color:var(--accent,#70d0ff);}
#bml-root .bml-cat--active:hover{color:var(--accent-ink,#06101c);}
#bml-root .bml-cat__count{font-size:.72rem;opacity:.75;}

#bml-root hr.bml-divider{border:none;border-top:1px solid var(--line,#1d2442);margin:1.25rem 0;}

#bml-root p.bml-credit{display:flex;align-items:center;gap:.7rem;margin:0;padding:.75rem 1rem;border:1px solid rgb(from var(--accent) r g b / 25%);border-radius:var(--r-md,10px);background:rgb(from var(--accent) r g b / 5%);font-size:.85rem;color:var(--text,#e9eef9);}
#bml-root .bml-credit-icon{flex:none;color:var(--accent,#70d0ff);}
#bml-root .bml-credit-text{flex:1 1 auto;min-width:0;}
#bml-root .bml-credit a{display:inline-flex;align-items:center;gap:.3rem;color:var(--accent,#70d0ff);text-decoration:none;font-weight:700;}
#bml-root .bml-credit a:hover{text-decoration:underline;}
#bml-root .bml-credit-favicon{width:16px;height:16px;border-radius:var(--r-sm,6px);}
`;

  const credit =
    `<p class="bml-credit">` +
    `<svg class="bml-credit-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>` +
    `<span class="bml-credit-text">This list is powered by ` +
    `<a href="https://tagsta.sh/?utm_source=orboro.net&utm_medium=referral&utm_campaign=bookmarks_credit" target="_blank" rel="noopener noreferrer">` +
    `<img class="bml-credit-favicon" src="https://www.google.com/s2/favicons?sz=64&domain=tagsta.sh" alt="" loading="lazy" referrerpolicy="no-referrer" />Tagstash</a>` +
    `, organize and share your own bookmarks, try it out!</span>` +
    `</p>`;

  const js = categories.length > 0
    ? `
(function(){
  function init(){
    var root=document.getElementById('bml-root');
    if(!root||root.dataset.bmlInit)return;
    root.dataset.bmlInit='1';
    root.querySelectorAll('.bml-cat').forEach(function(chip){
      chip.addEventListener('click',function(){
        root.querySelectorAll('.bml-cat').forEach(function(c){c.classList.remove('bml-cat--active');c.setAttribute('aria-pressed','false');});
        chip.classList.add('bml-cat--active');
        chip.setAttribute('aria-pressed','true');
        var visible=0;
        var category=chip.dataset.category;
        root.querySelectorAll('.bml-item').forEach(function(item){
          var cats=(item.dataset.categories||'').split(' ');
          item.hidden=!!category&&cats.indexOf(category)===-1;
          if(!item.hidden)visible++;
        });
        var message=visible+' bookmark'+(visible===1?'':'s')+' shown'+(category?' in '+category:' in all categories')+'.';
        var status=root.querySelector('.bml-status');
        if(status.textContent!==message)status.textContent=message;
      });
    });
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else {
    init();
  }
  document.addEventListener('astro:page-load',init);
})();
    `.trim()
    : "";

  const script = js ? `<script${nonceAttr(nonce)}>${js}<\/script>` : "";

  return `<div id="bml-root"><style${nonceAttr(nonce)}>${css}</style>${categoryChips}<p class="bml-status" role="status" aria-atomic="true">${sorted.length} bookmarks shown in all categories.</p><div class="bml-list">${itemsHtml}</div><hr class="bml-divider" />${credit}${script}</div>`;
}
