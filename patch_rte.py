#!/usr/bin/env python3
"""
Resource Trade Earth (Chatham House): the largest natural-resource trade flows
between countries, as its own map shows them: a line from exporter to importer,
wider for larger trade, with a year menu (2000 onward). A click gives the two
countries, the trade value, weight and CO2 figures as resourcetrade.earth
publishes them, and a link to the flow on its site. Read live from its own data
address; if a browser cannot read it, from culprits-tiles-more's daily copy.
Placed under Suppression > Control of physical resources.

Run from the repo root:  python3 patch_rte.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function addRteLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
once('''    { id: "wreckers_umap",''', f'''    {{ id: "rte_trade", name: "Resource trade flows (resourcetrade.earth, Chatham House)", unit: "trade flows", colour: "#8A6356", route: "rte", ready: true, lazy: true,
      api: "https://api.resourcetrade.earth/api/rt/2.7", copy: "{HOME}/rte",
      note: "The largest natural-resource trade flows between countries, read live from resourcetrade.earth (a daily copy stands in if it cannot be read)." }},
    {{ id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  rte_trade: ["insentient", "upstream"],\n')
once('"owid_interest", "owid_corptax", "owid_aid",', '"owid_interest", "owid_corptax", "owid_aid", "rte_trade",')
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "rte" ? addRteLayer(cfg)''')

JS = r'''/* ---------- Resource Trade Earth: trade flows between countries ---------- */
async function rteGet(cfg, live, copy) {
  try { return await getJson(`${cfg.api}${live}`, 40000); }
  catch (e) { cfg._fromCopy = true; return getJson(`${cfg.copy}/${copy}`, 40000); }
}
// A gentle curve from exporter to importer, so flows between the same pair in
// each direction do not lie on top of each other.
function rteArc(a, b, steps = 24) {
  const [x1, y1] = a, [x2, y2] = b;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
  const cx = mx - dy * 0.18, cy = my + dx * 0.18;
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2]);
  }
  return out;
}
async function addRteLayer(cfg) {
  let models;
  try { models = await rteGet(cfg, "/models", "models.json"); }
  catch (e) { setLayerState(cfg.id, `resourcetrade.earth did not answer (${e.message})`); return; }
  const C = new Map((models.countries || []).filter((c) => c.lat != null && c.lng != null).map((c) => [c.id, c]));
  const years = (models.years || []).map((y) => Number(y.id)).sort((a, b) => b - a);
  map.addSource(`${cfg.id}-src`, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-src`, layout: { "line-cap": "round" },
    paint: { "line-color": cfg.colour, "line-opacity": 0.75,
             "line-width": ["interpolate", ["linear"], ["get", "share"], 0, 0.8, 1, 7] } });
  const draw = async (year) => {
    setLayerState(cfg.id, `reading ${year}\u2026`);
    let j;
    try { j = await rteGet(cfg, `/trades?year=${year}&autozoom=1`, `trades_${year}.json`); }
    catch (e) { setLayerState(cfg.id, `no flows could be read for ${year}`); return; }
    const rows = (j.main || []).filter((r) => C.has(r.exporter) && C.has(r.importer));
    const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
    const feats = rows.map((r) => {
      const a = C.get(r.exporter), b = C.get(r.importer);
      return { type: "Feature", geometry: { type: "LineString", coordinates: rteArc([a.lng, a.lat], [b.lng, b.lat]) },
        properties: { from: a.name, to: b.name, value: r.value, weight: r.weight, co2: r.env_co2, year: r.year,
                      share: Math.sqrt((Number(r.value) || 0) / max), ex: r.exporter, im: r.importer } };
    });
    map.getSource(`${cfg.id}-src`).setData({ type: "FeatureCollection", features: feats });
    const left = (j.main || []).length - rows.length;
    setLayerState(cfg.id, `${feats.length} largest flows of ${Number(j.total || 0).toLocaleString()} in ${year}` +
      (left ? ` (${left} to or from unplaced areas)` : "") + (cfg._fromCopy ? " \u00b7 from today's copy" : ""));
  };
  const n = (v) => (v == null ? "\u2014" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }));
  bindHtmlPopup(`${cfg.id}-line`, (p) => `<b>${escapeHtml(p.from)} \u2192 ${escapeHtml(p.to)}</b>` +
    `<div class="meta">${escapeHtml(String(p.year))}</div>` +
    `<div class="meta">Trade value: ${n(p.value)}<br>Weight: ${n(p.weight)}<br>CO\u2082: ${n(p.co2)}</div>` +
    `<div class="meta">Figures as resourcetrade.earth publishes them (its units are on its site).</div>` +
    `<div class="meta"><a href="https://resourcetrade.earth/?year=${p.year}&exporter=${p.ex}&importer=${p.im}" target="_blank" rel="noopener">Open on resourcetrade.earth</a></div>`);
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Year">${years.map((y) => `<option value="${y}">${y}</option>`).join("")}</select>`;
    el.querySelector("select").addEventListener("change", (e) => draw(Number(e.target.value)));
    anchor.after(el);
  }
  await draw(years[0]);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nresource trade flows");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("it is a row under Control of physical resources", /id: "rte_trade"/.test(src) && /"owid_aid", "rte_trade",/.test(src));
  check("read live, with the daily copy when it cannot be", /api\.resourcetrade\.earth\/api\/rt\/2\.7/.test(src) && /cfg\._fromCopy = true/.test(src));
  const arc = new Function(src.slice(src.indexOf("function rteArc("), src.indexOf("async function addRteLayer(")) + "; return rteArc;")();
  const a = arc([0, 0], [10, 0]);
  check("a flow runs from exporter to importer on a curve", a[0][0] === 0 && a[a.length - 1][0] === 10 && a[12][1] !== 0);
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Resource trade flows added. Test with: node map/test.mjs")
