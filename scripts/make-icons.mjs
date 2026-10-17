// Generates the favicon and app icon set from the brand SVGs in public/brand (rule: the mark comes from the design system, never redrawn).
// Run: node scripts/make-icons.mjs   (uses the installed Edge, like the browser tests; E2E_BROWSER=chrome for Chrome)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, "public/brand", f), "utf8");
const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const INK = "#15171A"; // the brand ink, only used here to fill the icon background

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER ?? "msedge" });

async function render(size, html, transparent) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;width:${size}px;height:${size}px;background:${transparent ? "transparent" : INK}}img{display:block}</style>${html}`);
  const png = await page.screenshot({ omitBackground: transparent });
  await page.close();
  return png;
}

const appIcon = dataUri(read("ratable-app-icon.svg"));
const markLime = dataUri(read("ratable-mark-lime.svg"));
const out = path.join(root, "public/icons");

// Rounded app icon as it is drawn in the design system.
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(out, `icon-${size}.png`), await render(size, `<img src="${appIcon}" width="${size}" height="${size}">`, true));
}
// Maskable: full square with the mark inside the safe zone (the OS cuts the shape).
const maskable = (size, ratio) => `<img src="${markLime}" width="${size * ratio}" height="${size * ratio}" style="margin:${(size * (1 - ratio)) / 2}px">`;
fs.writeFileSync(path.join(out, "icon-maskable-512.png"), await render(512, maskable(512, 0.6), false));
fs.writeFileSync(path.join(out, "apple-touch-icon.png"), await render(180, maskable(180, 0.72), false));
const fav32 = await render(32, `<img src="${appIcon}" width="32" height="32">`, true);
fs.writeFileSync(path.join(out, "favicon-32.png"), fav32);

// favicon.ico with the 32 px PNG inside.
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 32; header[7] = 32; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(fav32.length, 14); header.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(root, "src/app/favicon.ico"), Buffer.concat([header, fav32]));

await browser.close();
console.log("icons written to public/icons and src/app/favicon.ico");
