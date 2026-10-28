/** Responsive artwork uses the canonical zone; local previews keep originals. */
import { MEDIA_ORIGIN } from "./media-upload.ts";
const SITE_ORIGIN = "https://orboro.net";
export const ART_WIDTHS = [480, 800, 1200] as const;
export const HERO_WIDTHS = [800, 1200, 1600, 2000] as const;
// Lazy images use their actual laid-out width where sizes=auto is supported.
export const LISTING_IMAGE_SIZES = "auto, (max-width: 768px) 92vw, (max-width: 900px) 44vw, (max-width: 1000px) calc(92vw - 320px), (max-width: 1339px) calc((92vw - 344px) / 2), 320px";

export function responsiveImage(
  url: string,
  widths: readonly number[],
  sizes: string,
  requestUrl?: URL,
): { src: string; srcset?: string; sizes?: string } {
  const unchanged = { src: url };
  // /cdn-cgi/image does not exist in Wrangler or on preview hosts.
  if (requestUrl && requestUrl.origin !== SITE_ORIGIN) return unchanged;
  // Document-relative paths must keep resolving against the current page.
  if (!url.startsWith("/") && !URL.canParse(url)) return unchanged;
  let source: URL;
  try { source = new URL(url, SITE_ORIGIN); } catch { return unchanged; }
  const isMedia = source.origin === MEDIA_ORIGIN;
  const isSiteImage = source.origin === SITE_ORIGIN && source.pathname.startsWith("/images/");
  if ((!isMedia && !isSiteImage) || source.username || source.password) return unchanged;
  const candidates = [...new Set(widths.filter(w => Number.isSafeInteger(w) && w > 0))].sort((a, b) => a - b);
  if (candidates.length === 0) return unchanged;
  // Encode source commas so they cannot split a srcset candidate.
  const sourceUrl = source.href.replaceAll(",", "%2C");
  const variant = (width: number) => `${SITE_ORIGIN}/cdn-cgi/image/width=${width},quality=80,format=auto/${sourceUrl}`;
  return {
    src: variant(candidates[candidates.length - 1]),
    srcset: candidates.map(w => `${variant(w)} ${w}w`).join(", "),
    sizes,
  };
}
