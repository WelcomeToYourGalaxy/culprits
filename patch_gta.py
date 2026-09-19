#!/usr/bin/env python3
"""
Global Trade Alert: every state act in its database (about 67,000), summed by
the country that took it, shaded on Global Trade Alert's own country shapes as
its activity tracker map does. A menu picks the shading: all acts, or those
Global Trade Alert rates Red, Amber or Green. A click gives the country's
counts, its commonest kinds of intervention, and its latest acts with their
dates and ratings. Gathered daily by culprits-tiles-more (scripts/gta.py).
Placed under Suppression > Control of physical resources.

Run from the repo root:  python3 patch_gta.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function addGtaLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
once('''    { id: "wreckers_umap",''', f'''    {{ id: "gta_acts", name: "Global Trade Alert: state acts by country", unit: "state acts", colour: "#8A6356", route: "gta", ready: true, lazy: true,
      data: "{HOME}/gta/countries.json", shapes: "{HOME}/gta/world.geojson",
      note: "Every state act in Global Trade Alert's database, summed by the country that took it, from a daily copy." }},
    {{ id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  gta_acts: ["human", "upstream"],\n')
once('"owid_aid", "rte_trade",', '"owid_aid", "rte_trade", "gta_acts",')
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "gta" ? addGtaLayer(cfg)''')

JS = r'''/* ---------- Global Trade Alert: state acts by country ---------- */
const GTA_EVAL = { Red: "#8F4E40", Amber: "#8A7560", Green: "#62755F" };
// The country a shape stands for: whichever of its fields names a country in the data.
function gtaNameOf(props, known) {
  for (const k of ["name", "NAME", "name_long", "admin", "ADMIN", "name_en", "country", "Country"]) if (props[k] && known.has(props[k])) return props[k];
  return Object.values(props).find((v) => typeof v === "string" && known.has(v)) || null;
}
async function addGtaLayer(cfg) {
  let data, shapes;
  try { [data, shapes] = await Promise.all([getJson(cfg.data, 60000), getJson(cfg.shapes, 60000).catch(() => getJson(BOUNDARIES_URL))]); }
  catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
  const C = data.countries || {};
  const known = new Set(Object.keys(C));
  const feats = (shapes.features || []).map((f) => ({ type: "Feature", geometry: f.geometry, properties: { gta: gtaNameOf(f.properties || {}, known), name: (f.properties || {}).name || "" } }));
  map.addSource(`${cfg.id}-src`, { type: "geojson", data: { type: "FeatureCollection", features: feats } });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-src`, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0.75 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-src`, paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
  const ramp = OWID_RAMP;
  const shade = (measure) => {
    const vals = Object.values(C).map((c) => c[measure] || 0).filter((v) => v > 0);
    const breaks = owidBreaks(vals);
    const expr = ["match", ["coalesce", ["get", "gta"], ""]];
    for (const [nm, c] of Object.entries(C)) {
      const v = c[measure] || 0;
      if (!v) continue;
      let i = 0; while (i < breaks.length && v >= breaks[i]) i++;
      expr.push(nm, ramp[Math.min(i + (4 - breaks.length), 4)]);
    }
    expr.push("rgba(0,0,0,0)");
    map.setPaintProperty(`${cfg.id}-fill`, "fill-color", expr.length > 3 ? expr : "rgba(0,0,0,0)");
  };
  bindHtmlPopup(`${cfg.id}-fill`, (p) => {
    const c = C[p.gta];
    if (!c) return `<b>${escapeHtml(p.name)}</b><div class="meta">No state acts named for this country.</div>`;
    const dot = (e) => e ? `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${GTA_EVAL[e] || "#777"};margin-right:4px"></i>` : "";
    return `<b>${escapeHtml(p.gta)}</b>` +
      `<div class="meta">${c.total.toLocaleString()} state acts: ${dot("Red")}${c.red.toLocaleString()} Red, ${dot("Amber")}${c.amber.toLocaleString()} Amber, ` +
      `${dot("Green")}${c.green.toLocaleString()} Green; ${c.in_force.toLocaleString()} with a measure in force</div>` +
      `<div class="meta">Commonest: ${Object.entries(c.types || {}).slice(0, 6).map(([t, n]) => `${escapeHtml(t)} (${n})`).join(", ")}</div>` +
      `<div class="meta" style="max-height:220px;overflow:auto">${(c.latest || []).map((a) => `<div style="margin:5px 0">${dot(a.eval)}<b>${escapeHtml(a.date || "")}</b> ` +
        `${escapeHtml(a.title)}<br><span style="font-size:11px">${escapeHtml(a.text || "")}</span></div>`).join("")}</div>` +
      `<div class="meta">Global Trade Alert</div>`;
  });
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Shade by"><option value="total">All state acts</option><option value="red">Rated Red</option>` +
      `<option value="amber">Rated Amber</option><option value="green">Rated Green</option><option value="in_force">With a measure in force</option></select>`;
    el.querySelector("select").addEventListener("change", (e) => shade(e.target.value));
    anchor.after(el);
  }
  shade("total");
  const placed = new Set(feats.map((f) => f.properties.gta).filter(Boolean));
  setLayerState(cfg.id, `${Number(data.acts || 0).toLocaleString()} state acts by ${known.size} countries` +
    (known.size > placed.size ? ` (${known.size - placed.size} names not on the shapes)` : ""));
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nGlobal Trade Alert");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("it is a row under Control of physical resources", /id: "gta_acts"/.test(src) && /"rte_trade", "gta_acts",/.test(src));
  const nameOf = new Function(src.slice(src.indexOf("function gtaNameOf("), src.indexOf("async function addGtaLayer(")) + "; return gtaNameOf;")();
  const known = new Set(["Italy", "United States of America"]);
  check("a shape is joined by whichever field names the country", nameOf({ NAME: "Italy" }, known) === "Italy" && nameOf({ label: "United States of America" }, known) === "United States of America" && nameOf({ name: "Atlantis" }, known) === null);
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Global Trade Alert added. Test with: node map/test.mjs")
