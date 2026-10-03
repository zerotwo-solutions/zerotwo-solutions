// Generates brand raster assets from the official ZeroTwo logo (public/assets/img/newLogo1.svg):
//   - public/brand/logo-dark.webp        full logo with tagline, black parts recolored white for dark UI
//   - public/brand/logo-dark-compact.webp same, without the tagline (navbar size)
//   - icons (apple-touch, 192, 512, maskable), schema logo.png: the "2" mark on white, matching favicon.ico
//   - og.png social card with the dark logo
// Run with `npm run og` after changing the logo or OG copy. Outputs are committed to /public.
// favicon.ico is the original brand favicon and is not regenerated.
// Text renders with the system "Inter" font if installed (falls back to sans-serif).
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const out = (f) => new URL(`../public/${f}`, import.meta.url).pathname;
const SOURCE = out("assets/img/newLogo1.svg");
await mkdir(out("brand"), { recursive: true });

// Render the source logo (960x384 viewport) at high resolution with a transparent background.
const W = 2400;
const { data, info } = await sharp(SOURCE, { density: (W / 960) * 72 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height } = info;

const fromRaw = (buf) => sharp(buf, { raw: { width, height, channels: 4 } });

// Dark-UI variant: near-black pixels become off-white; the brand blue is untouched.
const dark = Buffer.from(data);
for (let i = 0; i < dark.length; i += 4) {
  if (dark[i + 3] > 0 && Math.max(dark[i], dark[i + 1], dark[i + 2]) < 90) {
    dark[i] = 247;
    dark[i + 1] = 248;
    dark[i + 2] = 248;
  }
}

// Compact variant: drop the tagline ("Your Business, Our Solutions !!") which is unreadable at navbar size.
// It sits right of the mark, below "SOLUTIONS" (fractions of the 960x384 artboard).
const compact = Buffer.from(dark);
for (let y = Math.round(height * 0.67); y < Math.round(height * 0.8); y++) {
  for (let x = Math.round(width * 0.385); x < width; x++) compact[(y * width + x) * 4 + 3] = 0;
}

const logoDark = await fromRaw(dark).trim().resize({ height: 160 }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
const logoCompact = await fromRaw(compact).trim().resize({ height: 120 }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
await sharp(logoDark).toFile(out("brand/logo-dark.webp"));
await sharp(logoCompact).toFile(out("brand/logo-dark-compact.webp"));
const meta = async (b) => sharp(b).metadata();
const [m1, m2] = [await meta(logoDark), await meta(logoCompact)];
console.log(`logo-dark.webp ${m1.width}x${m1.height}, logo-dark-compact.webp ${m2.width}x${m2.height}`);

// The "2" mark in original colors, cropped square from the artboard.
const side = Math.round(width * 0.33);
const markSrc = await fromRaw(data)
  .extract({ left: Math.round(width * 0.04), top: Math.max(0, Math.round(height * 0.494 - side / 2)), width: side, height: Math.min(side, height) })
  .png()
  .toBuffer();

const iconOnWhite = async (size, padRatio, file) => {
  const inner = Math.round(size * (1 - padRatio * 2));
  const markPng = await sharp(markSrc).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
    .composite([{ input: markPng, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(out(file));
};
await iconOnWhite(512, 0.08, "logo.png");
await iconOnWhite(180, 0.1, "apple-touch-icon.png");
await iconOnWhite(192, 0.08, "icon-192.png");
await iconOnWhite(512, 0.08, "icon-512.png");
await iconOnWhite(512, 0.2, "icon-maskable-512.png");

// Dot field echoing the hero's 3D "signal field"
let dots = "";
for (let j = 0; j < 22; j++) {
  for (let i = 0; i < 60; i++) {
    const x = 20 + i * 20;
    const wave = Math.sin(i * 0.22 + j * 0.35) * 18 + Math.sin(i * 0.07 - j * 0.2) * 26;
    const y = 360 + j * 14 + wave;
    const t = i / 59;
    const r = Math.round(169 + (79 - 169) * t), g = Math.round(155 + (209 - 155) * t), b = Math.round(255 + (197 - 255) * t);
    const a = (0.08 + 0.5 * (j / 21)) * (0.4 + 0.6 * Math.sin(Math.PI * t));
    dots += `<circle cx="${x}" cy="${y.toFixed(1)}" r="${(1 + j * 0.07).toFixed(2)}" fill="rgb(${r},${g},${b})" fill-opacity="${a.toFixed(2)}"/>`;
  }
}

const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="50%" cy="0%" r="75%"><stop offset="0" stop-color="#8b7cff" stop-opacity=".35"/><stop offset="1" stop-color="#08090a" stop-opacity="0"/></radialGradient>
    <linearGradient id="txt" x1="0" x2="1"><stop stop-color="#a99bff"/><stop offset=".45" stop-color="#8b7cff"/><stop offset="1" stop-color="#4fd1c5"/></linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#08090a" stop-opacity="0"/><stop offset="1" stop-color="#08090a"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#08090a"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  ${dots}
  <rect width="1200" height="630" fill="url(#fade)"/>
  <text x="72" y="270" font-family="Inter, sans-serif" font-size="72" font-weight="650" fill="#f7f8f8" letter-spacing="-2.6">AI agents and real-time</text>
  <text x="72" y="352" font-family="Inter, sans-serif" font-size="72" font-weight="650" fill="url(#txt)" letter-spacing="-2.6">FinTech products that ship.</text>
  <text x="72" y="420" font-family="Inter, sans-serif" font-size="28" font-weight="450" fill="#b4b8c1">Claude &amp; Bedrock agents · MCP servers · Market data · SaaS on AWS</text>
  <rect x="72" y="520" width="330" height="48" rx="24" fill="#f7f8f8"/>
  <text x="237" y="551" text-anchor="middle" font-family="Inter, sans-serif" font-size="20" font-weight="600" fill="#08090a">zerotwosolutions.com</text>
</svg>`;

const ogLogo = await sharp(logoCompact).resize({ height: 84 }).toBuffer();
await sharp(Buffer.from(og))
  .composite([{ input: ogLogo, left: 64, top: 64 }])
  .png({ compressionLevel: 9 })
  .toFile(out("og.png"));

console.log("Generated brand logos, og.png, logo.png and icons");
