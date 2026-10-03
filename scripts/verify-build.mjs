// Post-build SEO/quality gate. Fails the build on regressions a crawler would punish.
// Checks every generated HTML page in dist/.
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const BANNED = [/jaydip/i, /vasoya/i, /jpvasoya/i, /7487029363/]; // company site: no personal identity
const MAX_PAGE_JS_KB = 260; // gzip-agnostic raw budget for scripts referenced by a page (three.js chunk is lazy)

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = await walk(DIST);
const pages = files.filter((f) => f.endsWith(".html"));
const errors = [];
const titles = new Map();
const descs = new Map();

for (const file of pages) {
  const rel = relative(DIST, file);
  const html = await readFile(file, "utf8");
  const is404 = rel.startsWith("404");
  const get = (re) => (html.match(re) || [])[1];

  const title = get(/<title>([^<]*)<\/title>/);
  const desc = get(/<meta name="description" content="([^"]*)"/);
  const canonical = get(/<link rel="canonical" href="([^"]*)"/);
  const h1s = (html.match(/<h1[\s>]/g) || []).length;

  if (!title) errors.push(`${rel}: missing <title>`);
  else if (title.length > 70) errors.push(`${rel}: title too long (${title.length}): ${title}`);
  if (!desc) errors.push(`${rel}: missing meta description`);
  else if (desc.length < 70 || desc.length > 170) errors.push(`${rel}: description length ${desc.length}`);
  if (!canonical && !is404) errors.push(`${rel}: missing canonical`);
  if (h1s !== 1) errors.push(`${rel}: expected exactly 1 <h1>, found ${h1s}`);
  if (!html.includes('application/ld+json')) errors.push(`${rel}: missing JSON-LD`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { errors.push(`${rel}: invalid JSON-LD`); }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) errors.push(`${rel}: <img> without alt`);
  for (const re of BANNED) if (re.test(html)) errors.push(`${rel}: contains banned personal identifier ${re}`);

  if (!is404) {
    if (title) titles.set(title, [...(titles.get(title) || []), rel]);
    if (desc) descs.set(desc, [...(descs.get(desc) || []), rel]);
  }

  // Internal links must resolve to a built file
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const href = m[1];
    if (href.startsWith("//")) continue;
    const target = href.endsWith("/") ? join(DIST, href, "index.html") : join(DIST, href);
    try { await stat(target); } catch { errors.push(`${rel}: broken internal link ${href}`); }
  }

  // Eager JS budget (module scripts in the page, excluding dynamically imported chunks)
  let jsBytes = 0;
  for (const m of html.matchAll(/<script type="module" src="([^"]+)"/g)) {
    try { jsBytes += (await stat(join(DIST, m[1]))).size; } catch {}
  }
  if (jsBytes / 1024 > MAX_PAGE_JS_KB) errors.push(`${rel}: eager JS ${Math.round(jsBytes / 1024)}KB > ${MAX_PAGE_JS_KB}KB`);
}

for (const [t, list] of titles) if (list.length > 1) errors.push(`duplicate title "${t}" on ${list.join(", ")}`);
for (const [, list] of descs) if (list.length > 1) errors.push(`duplicate description on ${list.join(", ")}`);

// Personal identifiers must not leak into any shipped text asset either
for (const f of files.filter((f) => /\.(js|css|txt|xml|json)$/.test(f))) {
  const txt = await readFile(f, "utf8");
  for (const re of BANNED) if (re.test(txt)) errors.push(`${relative(DIST, f)}: contains banned personal identifier ${re}`);
}

if (errors.length) {
  console.error(`\n✗ verify-build: ${errors.length} issue(s)\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ verify-build: ${pages.length} pages passed SEO, link, privacy and JS budget checks`);
