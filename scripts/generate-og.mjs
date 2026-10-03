// Generates brand raster assets (OG image, PNG icons, favicon.ico) from SVG.
// Run with `npm run og` after changing the logo or OG copy. Outputs are committed to /public.
// Text renders with the system "Inter" font if installed (falls back to sans-serif).
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const out = (f) => new URL(`../public/${f}`, import.meta.url);

const mark = (size, pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${32 + pad * 2} ${32 + pad * 2}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
    <stop stop-color="#a99bff"/><stop offset="1" stop-color="#4fd1c5"/></linearGradient></defs>
  <rect x="${-pad}" y="${-pad}" width="${32 + pad * 2}" height="${32 + pad * 2}" fill="#08090a"/>
  <rect x="1" y="1" width="30" height="30" rx="8" fill="#0d0e11" stroke="url(#g)" stroke-opacity=".7"/>
  <path d="M9 10h9l-9 12h9" fill="none" stroke="url(#g)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="22.5" cy="16" r="3.2" fill="none" stroke="#f7f8f8" stroke-width="2"/>
</svg>`;

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
  <g transform="translate(72 72) scale(1.6)">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="#0d0e11" stroke="url(#txt)" stroke-opacity=".7"/>
    <path d="M9 10h9l-9 12h9" fill="none" stroke="url(#txt)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="22.5" cy="16" r="3.2" fill="none" stroke="#f7f8f8" stroke-width="2"/>
  </g>
  <text x="140" y="111" font-family="Inter, sans-serif" font-size="30" font-weight="650" fill="#f7f8f8" letter-spacing="-0.5">ZeroTwo <tspan fill="#8a8f98" font-weight="500">Solutions</tspan></text>
  <text x="72" y="250" font-family="Inter, sans-serif" font-size="72" font-weight="650" fill="#f7f8f8" letter-spacing="-2.6">AI agents and real-time</text>
  <text x="72" y="332" font-family="Inter, sans-serif" font-size="72" font-weight="650" fill="url(#txt)" letter-spacing="-2.6">FinTech products that ship.</text>
  <text x="72" y="400" font-family="Inter, sans-serif" font-size="28" font-weight="450" fill="#b4b8c1">Claude &amp; Bedrock agents · MCP servers · Market data · SaaS on AWS</text>
  <rect x="72" y="520" width="330" height="48" rx="24" fill="#f7f8f8"/>
  <text x="237" y="551" text-anchor="middle" font-family="Inter, sans-serif" font-size="20" font-weight="600" fill="#08090a">zerotwosolutions.com</text>
</svg>`;

await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(out("og.png").pathname);
await sharp(Buffer.from(mark(512))).png().toFile(out("logo.png").pathname);
await sharp(Buffer.from(mark(180, 3))).png().toFile(out("apple-touch-icon.png").pathname);
await sharp(Buffer.from(mark(192))).png().toFile(out("icon-192.png").pathname);
await sharp(Buffer.from(mark(512))).png().toFile(out("icon-512.png").pathname);
await sharp(Buffer.from(mark(512, 6))).png().toFile(out("icon-maskable-512.png").pathname);

// favicon.ico: single 32x32 PNG-encoded ICO entry (supported by all modern browsers)
const png32 = await sharp(Buffer.from(mark(32))).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(22, 18);
await writeFile(out("favicon.ico"), Buffer.concat([header, png32]));
await writeFile(out("favicon.svg"), mark(32).replace(/<rect x="0" y="0"[^>]*\/>/, "").replace(/<rect x="-?0" y="-?0" width="32" height="32" fill="#08090a"\/>/, ""));
console.log("Generated og.png, logo.png, icons, favicon.ico, favicon.svg");
