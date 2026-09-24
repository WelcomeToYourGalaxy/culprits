/**
 * Where each catalogue row lands in the layers box.
 *
 * Reads Global Forest Watch's dataset list and Nusantara Atlas's layer list
 * live, titles each row the way the map does, and files it with the map's own
 * rules (cataloguePlaces in app.js). Prints the rows that the owner's rules by
 * name (CATALOGUE_BY_TITLE) caught, then every row by heading.
 *
 * Run: node map/filing-report.mjs            everything
 *      node map/filing-report.mjs fire dam   only titles containing any of these words
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const lib = new Function(
  cut("const NUSANTARA_NAMES = {", "/* ---------- a catalogue's layers as rows") +
  cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") +
  cut("const GFW_TITLES = {", "// Which of a dataset's assets to draw from.") +
  "; return { NUSANTARA_NAMES, nusantaraWhere, cataloguePlaces, CATALOGUE_BY_TITLE, gfwTitle, GFW_WHERE };")();

const words = process.argv.slice(2).map((w) => w.toLowerCase());
const want = (t) => !words.length || words.some((w) => t.toLowerCase().includes(w));

async function gfw() {
  const out = [];
  for (let page = 1; page < 30; page++) {
    const r = await fetch(`https://data-api.globalforestwatch.org/datasets?page[size]=100&page[number]=${page}`);
    if (!r.ok) throw new Error(`Global Forest Watch answered ${r.status}`);
    const rows = (await r.json()).data || [];
    for (const d of rows) {
      const said = lib.gfwTitle(d);
      const where = String(lib.GFW_WHERE[d.dataset] || (d.metadata || {}).geographic_coverage || "").trim();
      const title = where && !new RegExp(where.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(said) && !(/\bworldwide\b/i.test(said) && /^global\b/i.test(where)) ? `${said} \u2014 ${where}` : said;
      out.push({ from: "Global Forest Watch", id: d.dataset, title });
    }
    if (rows.length < 100) break;
  }
  return out;
}
async function nusantara() {
  const out = [];
  for (const base of ["https://map.nusantara-atlas.org/geoserver/atlas-workspace-v3/wms", "https://map.nusantara-atlas.org/geoserver/atlas-workspace-v2/wms"]) {
    const r = await fetch(`${base}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`);
    if (!r.ok) { console.log(`Nusantara ${base} answered ${r.status}`); continue; }
    const xml = await r.text();
    for (const m of xml.matchAll(/<Layer[^>]*>\s*<Name>([^<]+)<\/Name>\s*<Title>([^<]*)<\/Title>/g)) {
      const id = m[1], said = lib.NUSANTARA_NAMES[id] || m[2] || id, where = lib.nusantaraWhere(id);
      out.push({ from: "Nusantara", id, title: new RegExp(where, "i").test(said) ? said : `${said} \u2014 ${where}` });
    }
  }
  return out;
}

const rows = [];
for (const [name, fn] of [["Global Forest Watch", gfw], ["Nusantara", nusantara]]) {
  try { rows.push(...await fn()); } catch (e) { console.log(`${name}: ${e.message}`); }
}
for (const r of rows) r.paths = lib.cataloguePlaces(`${r.title} ${r.id}`, `${r.title} ${r.id}`);

console.log("\nCaught by the rules by name:");
lib.CATALOGUE_BY_TITLE.forEach(([rule, paths]) => {
  const hit = rows.filter((r) => lib.CATALOGUE_BY_TITLE.find(([x]) => x.test(`${r.title} ${r.id}`))?.[0] === rule);
  console.log(`\n  ${rule}  ->  ${paths ? paths.join(" | ") : "TAKEN OUT"}`);
  if (!hit.length) console.log("      (matched nothing)");
  for (const r of hit) console.log(`      ${r.title}  [${r.from}: ${r.id}]`);
});

console.log("\nEvery row, by heading:");
const by = {};
for (const r of rows.filter((x) => want(x.title))) for (const p of r.paths) (by[p] = by[p] || []).push(r);
for (const p of Object.keys(by).sort()) {
  console.log(`\n${p}`);
  for (const r of by[p].sort((a, b) => a.title.localeCompare(b.title))) console.log(`    ${r.title}  [${r.from}: ${r.id}]`);
}
