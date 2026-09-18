// Copy every map that lives only inside a Weebly page into the maps repo, as a
// standalone page of its own, so it can be read from GitHub like the others and
// kept current by the daily refresh.
//
// It reads the saved site record (the unzipped folder of pages), picks each
// map's own custom-HTML block the same way extract.mjs does, unpacks the map
// from it (an iframe's srcdoc, a base64 document, a text/html island) and
// writes it as <maps repo>/site/<id>.html. It also writes the Settler
// Colonialism map over the maps repo's broken copy
// (on-planet-invasion_embed_17_leaflet-map.html, whose line breaks were saved
// as spaces), and points both registries at the new files.
//
// Usage, from the culprits repo root:
//   node pipeline/sitemaps/export_page_maps.mjs <site record folder> <maps repo folder>
import fs from "node:fs";
import path from "node:path";

const [record, mapsRepo] = process.argv.slice(2);
if (!record || !mapsRepo || !fs.existsSync(record) || !fs.existsSync(mapsRepo)) {
  console.error("usage: node pipeline/sitemaps/export_page_maps.mjs <site record folder> <maps repo folder>");
  process.exit(1);
}
const RAW = "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/";
const BROKEN = { site_settler_colonialism: "on-planet-invasion_embed_17_leaflet-map.html" };

function pickBlock(html, marker) {
  const starts = [];
  const re = /class="wcustomhtml"/g;
  let m;
  while ((m = re.exec(html))) starts.push(m.index);
  starts.push(html.length);
  for (let i = 0; i < starts.length - 1; i++) {
    const b = html.slice(starts[i], starts[i + 1]);
    if (b.includes(marker)) return b;
  }
  throw new Error(`no custom-HTML block contains ${JSON.stringify(marker)}`);
}
function decodeEntities(s) {
  return s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (all, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[e.toLowerCase()];
  });
}
function decodeDoc(block, mode) {
  if (mode === "base64-iframe") {
    const m = block.match(/data:text\/html[^,]*;base64,([A-Za-z0-9+/=]+)/);
    if (!m) throw new Error("no base64 document in the block");
    return Buffer.from(m[1], "base64").toString("utf8");
  }
  if (mode === "base64-script") {
    for (const [, c] of block.matchAll(/["']([A-Za-z0-9+/=]{2000,})["']/g)) {
      const t = Buffer.from(c, "base64").toString("utf8");
      if (/<html|<script/i.test(t)) return t;
    }
    throw new Error("no base64 document in the block's scripts");
  }
  const island = block.match(/<script[^>]*type\s*=\s*["']text\/html["'][^>]*>([\s\S]*?)<\/script>/i);
  if (/\ssrcdoc\s*=\s*["']/.test(block)) {
    let m = block.match(/\ssrcdoc\s*=\s*"([^"]*)"/);
    if (!m) {
      const at = block.search(/\ssrcdoc\s*=\s*'/);
      const start = block.indexOf("'", at) + 1;
      const tail = block.slice(start);
      const end = tail.search(/'(?=\s*(?:[\w-]+\s*=|\/?>))/);
      m = [null, end >= 0 ? tail.slice(0, end) : tail];
    }
    let doc = decodeEntities(m[1]);
    if (!doc.includes("\n") && doc.includes("\\n")) doc = doc.replace(/\\n/g, "\n");
    return doc;
  }
  if (island && /L\.map\(/.test(island[1])) return island[1];
  // The map written straight into the block: keep the block's own markup.
  const inner = block.replace(/^class="wcustomhtml"[^>]*>/, "");
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n${inner}\n</body>\n</html>\n`;
}

const registries = [
  ["pipeline/sitemaps/registry.json", "maps"],
  ["pipeline/shapes/registry.json", "layers"],
];
fs.mkdirSync(path.join(mapsRepo, "site"), { recursive: true });
const written = new Map();
let ok = 0, failed = 0;
for (const [file, key] of registries) {
  const reg = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const m of reg[key]) {
    if (!m.page || !m.block) continue;
    try {
      let rel = written.get(`${m.page}|${m.block}|${m.decode || ""}`);
      if (!rel) {
        const page = fs.readFileSync(path.join(record, `${m.page}.html`), "utf8");
        const doc = decodeDoc(pickBlock(page, m.block), m.decode);
        if (!/L\.map\(|<svg|<canvas|new Chart/i.test(doc)) throw new Error("the block holds no map");
        rel = BROKEN[m.id] || `site/${m.id}.html`;
        fs.writeFileSync(path.join(mapsRepo, rel), doc);
        written.set(`${m.page}|${m.block}|${m.decode || ""}`, rel);
      }
      m.url = RAW + rel;
      m.note = (m.note || "").replace(/\s*\(maps repo\)$/, "") ;
      delete m.page; delete m.block; delete m.decode;
      console.log(`  ok    ${m.id.padEnd(28)} -> ${rel}`);
      ok++;
    } catch (e) {
      console.log(`  FAIL  ${m.id.padEnd(28)} ${e.message}`);
      failed++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(reg, null, 1) + "\n");
}
console.log(`${ok} maps copied into the maps repo, ${failed} could not be read.`);
if (failed) process.exitCode = 1;
