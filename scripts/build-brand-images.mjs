// Rebuilds the derived brand images from the source artwork in public/images.
//   node scripts/build-brand-images.mjs
// Outputs (committed):
//   public/images/social-default.png  1200x630 default og:image / twitter:image
//   public/images/logo-480.png        header logo at 2x of its 240px CSS width
//                                     (a palette PNG beat WebP here: 14 KB vs 21 KB)
// public/images/logo.png stays untouched (admin header, JSON-LD publisher logo).
// `sharp` is not a direct dependency; it comes in through Astro's image service.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";

const dir = fileURLToPath(new URL("../public/images/", import.meta.url));
const BG = "#080b18"; // --bg in src/styles/tokens.css
const SURFACE = "#0e1428"; // --surface

const W = 1200;
const H = 630;

// Background: the header art, cover-cropped around the center, then washed
// with the brand indigo so the logo reads cleanly on top.
const art = await sharp(dir + "gaming-header.png")
  .resize(W, H, { fit: "cover", position: "centre" })
  .modulate({ brightness: 0.8, saturation: 0.85 })
  .blur(2)
  .toBuffer();

const wash = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
     <defs>
       <radialGradient id="g" cx="50%" cy="50%" r="65%">
         <stop offset="0" stop-color="${SURFACE}" stop-opacity="0.9"/>
         <stop offset="1" stop-color="${BG}" stop-opacity="0.94"/>
       </radialGradient>
     </defs>
     <rect width="${W}" height="${H}" fill="url(#g)"/>
     <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#70d0ff" fill-opacity="0.85"/>
   </svg>`,
);

const logoW = 840;
const logo = await sharp(dir + "logo.png").resize({ width: logoW }).toBuffer();
const logoH = (await sharp(logo).metadata()).height;

await sharp(art)
  .composite([
    { input: wash },
    { input: logo, left: Math.round((W - logoW) / 2), top: Math.round((H - logoH) / 2) - 6 },
  ])
  .flatten({ background: BG })
  .png({ palette: true, quality: 80, effort: 10, colours: 128 })
  .toFile(dir + "social-default.png");

// Header logo: rendered at 240 CSS px wide, so 480px covers 2x displays.
await sharp(dir + "logo.png")
  .resize({ width: 480 })
  .png({ palette: true, quality: 90, effort: 10 }).toFile(dir + "logo-480.png");

for (const f of ["social-default.png", "logo-480.png"]) {
  const m = await sharp(dir + f).metadata();
  console.log(f, `${m.width}x${m.height}`, statSync(dir + f).size, "bytes");
}
