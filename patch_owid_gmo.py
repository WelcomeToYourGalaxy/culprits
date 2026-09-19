#!/usr/bin/env python3
"""
1. The Genetic engineering map moves to Pre-birth frontlines.
2. Our World in Data's three maps from the Suppression page, as country
   shading, read live from Our World in Data each time they are ticked:
     - Share of government spending going to interest payments
     - Statutory corporate income tax rate
     - Foreign aid received as a share of national income
   Each has a year menu: "Latest for each country" (each country at its most
   recent year, the year shown in its box) or any single year. A click gives the
   country, the value and its year, and a link to the chart on Our World in Data.
   They sit under Control of physical resources.

Run from the repo root:  python3 patch_owid_gmo.py
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function addOwidGrapherLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


once('''  { h: 2, t: "Pre-birth frontlines" }, "monitor_abortion", "gmo_releases",''',
     '''  { h: 2, t: "Pre-birth frontlines" }, "monitor_abortion", "gmo_releases", "group:gmo_map_layers",''')
once('''  { h: 3, t: "Invasion of nonhumans" }, "monitor_invasion", "group:gmo_map_layers",''',
     '''  { h: 3, t: "Invasion of nonhumans" }, "monitor_invasion",''')

G = [("owid_interest", "share-of-government-expenditure-going-to-interest-payments", "Share of government spending going to interest payments (Our World in Data)", "% of spending"),
     ("owid_corptax", "statutory-corporate-income-tax-rate", "Statutory corporate income tax rate (Our World in Data)", "% rate"),
     ("owid_aid", "foreign-aid-received-as-a-share-of-national-income-net", "Foreign aid received as a share of national income (Our World in Data)", "% of income")]
rows = "".join(f'''    {{ id: "{i}", name: {json.dumps(n)}, unit: "{u}", colour: "#6E5F52", route: "owidgrapher", ready: true, lazy: true,
      slug: "{s}",
      note: "Read live from Our World in Data each time it is ticked; the chart's own data, by country and year." }},
''' for i, s, n, u in G)
once('''    { id: "wreckers_umap",''', rows + '''    { id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n' +
     "".join(f'  {i}: ["human", "upstream"],\n' for i, *_ in G))
once('''    "site_export_credit_shading", "site_earmarked_funding", "site_trade_profits", "site_social_spheres",''',
     '''    "site_export_credit_shading", "site_earmarked_funding", "site_trade_profits", "site_social_spheres",
    "owid_interest", "owid_corptax", "owid_aid",''')
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "owidgrapher" ? addOwidGrapherLayer(cfg)''')

JS = r'''/* ---------- Our World in Data charts as country shading ---------- */
const OWID_RAMP = ["#E3D9CF", "#C9B3A5", "#AC8A7B", "#8A6356", "#5F3F36"];
function owidParse(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const split = (l) => { const out = []; let cur = "", q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; }
    out.push(cur); return out; };
  const head = split(lines[0]).map((h) => h.trim().toLowerCase());
  const ci = head.indexOf("code"), yi = head.indexOf("year");
  const vi = head.length - 1;
  const rows = [];
  for (const l of lines.slice(1)) {
    const c = split(l);
    const v = Number(c[vi]);
    if (!c[ci] || c[ci].startsWith("OWID") || !isFinite(v) || c[vi] === "") continue;
    rows.push({ iso3: c[ci], name: c[head.indexOf("entity")], year: Number(c[yi]), v });
  }
  return rows;
}
function owidPick(rows, year) {
  const by = new Map();
  for (const r of rows) {
    if (year !== "latest" && r.year !== Number(year)) continue;
    const had = by.get(r.iso3);
    if (!had || r.year > had.year) by.set(r.iso3, r);
  }
  return by;
}
function owidBreaks(values) {
  const v = values.slice().sort((a, b) => a - b);
  if (!v.length) return [];
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return [...new Set([q(0.2), q(0.4), q(0.6), q(0.8)])];
}
async function addOwidGrapherLayer(cfg) {
  let rows, meta = {};
  try {
    const r = await fetch(`https://ourworldindata.org/grapher/${cfg.slug}.csv?v=1&csvType=full&useColumnShortNames=true`);
    if (!r.ok) throw new Error(`${r.status}`);
    rows = owidParse(await r.text());
    try { meta = await getJson(`https://ourworldindata.org/grapher/${cfg.slug}.metadata.json?v=1&csvType=full&useColumnShortNames=true`); } catch (e) { /* the chart's title is enough */ }
  } catch (e) { setLayerState(cfg.id, `Our World in Data did not answer (${e.message})`); return; }
  const shapes = await getJson(BOUNDARIES_URL);
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);
  map.addSource(`${cfg.id}-src`, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-src`,
    paint: { "fill-color": ["coalesce", ["get", "_c"], "rgba(0,0,0,0)"], "fill-opacity": 0.75 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-src`, paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
  const title = (meta.chart && meta.chart.title) || cfg.name;
  const unit = (() => { const c = meta.columns && Object.values(meta.columns)[0]; return (c && (c.shortUnit || c.unit)) || ""; })();
  const draw = (year) => {
    const pick = owidPick(rows, year);
    const breaks = owidBreaks([...pick.values()].map((r) => r.v));
    const colourOf = (v) => { let i = 0; while (i < breaks.length && v >= breaks[i]) i++; return OWID_RAMP[Math.min(i + (4 - breaks.length), 4)]; };
    const feats = shapes.features.map((f) => {
      const r = pick.get(f.properties.iso3);
      return { type: "Feature", geometry: f.geometry, properties: { name: f.properties.name, v: r ? r.v : null, year: r ? r.year : null, _c: r ? colourOf(r.v) : null } };
    });
    map.getSource(`${cfg.id}-src`).setData({ type: "FeatureCollection", features: feats });
    setLayerState(cfg.id, `${pick.size} countries \u00b7 ${year === "latest" ? "latest year for each" : year}`);
  };
  bindHtmlPopup(`${cfg.id}-fill`, (p) => `<b>${escapeHtml(p.name)}</b>` +
    `<div class="meta">${escapeHtml(title)}</div>` +
    `<div class="meta">${p.v === null || p.v === "null" ? "No figure" : Number(p.v).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + escapeHtml(unit)}` +
    `${p.year && p.year !== "null" ? ` (${p.year})` : ""}</div>` +
    `<div class="meta"><a href="https://ourworldindata.org/grapher/${cfg.slug}" target="_blank" rel="noopener">Open the chart on Our World in Data</a></div>`);
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Year"><option value="latest">Latest for each country</option>` +
      years.map((y) => `<option value="${y}">${y}</option>`).join("") + `</select>`;
    el.querySelector("select").addEventListener("change", (e) => draw(e.target.value));
    anchor.after(el);
  }
  draw("latest");
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nOur World in Data shading; the genetic engineering map moved");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const pre = order.findIndex((x) => x && x.t === "Pre-birth frontlines"), post = order.findIndex((x) => x && x.t === "Post-birth invasion");
  const g = order.indexOf("group:gmo_map_layers");
  check("the Genetic engineering map is under Pre-birth frontlines", g > pre && g < post);
  const parse = new Function(src.slice(src.indexOf("function owidParse("), src.indexOf("function owidBreaks(")) + "; return [owidParse, owidPick];")();
  const rows = parse[0]('Entity,Code,Year,gc_xpn\nKenya,KEN,2020,10.5\nKenya,KEN,2022,12\n"Korea, South",KOR,2021,3\nWorld,OWID_WRL,2022,9\nX,XXX,2021,\n');
  check("a chart's rows are read, aggregates and blanks left out", rows.length === 3 && rows[2].name === "Korea, South");
  const latest = parse[1](rows, "latest"), y2020 = parse[1](rows, "2020");
  check("latest takes each country's most recent year", latest.get("KEN").year === 2022 && latest.get("KOR").year === 2021);
  check("a single year takes only that year", y2020.size === 1 && y2020.get("KEN").v === 10.5);
  check("the three charts are rows", ["owid_interest", "owid_corptax", "owid_aid"].every((i) => new RegExp(`id: "${i}"`).test(src)));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Done. Test with: node map/test.mjs")
