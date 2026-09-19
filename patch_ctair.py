#!/usr/bin/env python3
"""
Climate TRACE air pollution, as its city air-pollution pages show it:
1. Urban air-pollution sources: every source its pages cover (the ones with
   modelled plumes), sized by PM2.5 rate. Click one and, read live from Climate
   TRACE:
     - its modelled pollution plume is drawn on the map (the paths the polluted
       air took from the source, as its pages show);
     - its box gives its figures for any of Climate TRACE's pollutants (PM2.5,
       black carbon, organic carbon, SO2, VOCs, CO, ammonia, NOx, CO2e), with its
       capacity, activity and yearly rank in its sector, and a link to its city page.
2. Population density: the 1 km population layer the pages draw underneath,
   read live from Climate TRACE.
The list of sources is gathered daily by culprits-tiles-more (scripts/ct_air.py);
everything else is read live.

Run from the repo root:  python3 patch_ctair.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function addCtAirLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
once('''    { id: "wreckers_umap",''', f'''    {{ id: "ct_air", name: "Climate TRACE: urban air-pollution sources and their plumes", unit: "sources", colour: "#7A5A55", route: "ctair", ready: true, lazy: true,
      list: "{HOME}/ct_air/sources.geojson",
      note: "The sources Climate TRACE's city air-pollution pages cover; a click draws the source's modelled plume and gives its figures for every pollutant, read live." }},
    {{ id: "ct_pop", name: "Population density (Climate TRACE, GHSL 1 km)", unit: "people per square km", colour: "#6A6258", route: "rasterlive", ready: true, lazy: true,
      attribution: "Climate TRACE; GHSL population", maxzoom: 12,
      choices: [{{ label: "Population", tiles: "https://tiles.climatetrace.org/ghsl-pop-1km/all/{{z}}/{{x}}/{{y}}.png" }}],
      note: "The population layer Climate TRACE's air-pollution pages draw underneath, read live." }},
    {{ id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  ct_air: ["human", "downstream"],\n  ct_pop: ["human", "downstream"],\n')
once('''{ h: 4, t: "National shading" }, "owid_co2",''', '''{ h: 4, t: "National shading" }, "owid_co2",
  { h: 4, t: "Air pollution" }, "ct_air", "ct_pop",''')
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "ctair" ? addCtAirLayer(cfg)''')

JS = r'''/* ---------- Climate TRACE air pollution: sources, plumes, every pollutant ---------- */
const CT_GASES = [["pm2_5", "PM2.5"], ["bc", "Black carbon"], ["oc", "Organic carbon"], ["so2", "SO\u2082"], ["vocs", "VOCs"],
  ["co", "CO"], ["nh3", "Ammonia"], ["nox", "NOx"], ["co2e_100yr", "CO\u2082e (100-year)"]];
function ctAssetHtml(a, gas) {
  const t = a.totals || {};
  const n = (v, d = 0) => (v == null ? "\u2014" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));
  const ranks = (a.subsectorRanks || []).slice(-1)[0];
  return `<div class="meta">${escapeHtml([a.type, (a.subsector || "").replace(/-/g, " "), (a.location && a.location.country) || ""].filter(Boolean).join(" \u00b7 "))}</div>` +
    `<div class="meta"><b>${escapeHtml((CT_GASES.find((g) => g[0] === gas) || [gas, gas])[1])}:</b> ${n(t.value, 1)} t a year</div>` +
    (t.capacity ? `<div class="meta">Capacity: ${n(t.capacity)} ${escapeHtml(t.capacityUnits || "")}` +
      (t.capacityFactor != null ? ` (used ${n(t.capacityFactor * 100)}%)` : "") + `</div>` : "") +
    (t.activity ? `<div class="meta">Activity: ${n(t.activity)} ${escapeHtml(t.activityUnits || "")}</div>` : "") +
    (t.emissionsFactor ? `<div class="meta">Rate: ${n(t.emissionsFactor, 5)} ${escapeHtml(t.emissionsFactorUnits || "")}</div>` : "") +
    (ranks ? `<div class="meta">Rank in its sector, ${ranks.year}: ${n(ranks.rank)}</div>` : "");
}
async function addCtAirLayer(cfg) {
  let gj;
  try { gj = await getJson(cfg.list, 60000); }
  catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
  const src = `${cfg.id}-src`;
  map.addSource(src, { type: "geojson", data: gj });
  map.addSource(`${cfg.id}-plume`, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-plume`, layout: { "line-cap": "round" },
    paint: { "line-color": "#B8A79E", "line-width": 1.6, "line-opacity": 0.8 } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src,
    paint: { "circle-color": cfg.colour, "circle-opacity": 0.9,
             "circle-radius": ["interpolate", ["linear"], ["sqrt", ["max", 0, ["to-number", ["get", "pm25_kg_hr"], 0]]], 0, 2.5, 10, 9] } });
  let gas = "pm2_5";
  map.on("click", `${cfg.id}-pt`, async (e) => {
    const f = e.features && e.features[0];
    if (!f) return;
    popupClaimedBy = e.originalEvent || e;
    const p = f.properties;
    const pop = new maplibregl.Popup({ maxWidth: "320px" }).setLngLat(f.geometry.coordinates).setHTML(
      `<b>${escapeHtml(p.name)}</b>` +
      `<div class="meta">PM2.5: ${Number(p.pm25_kg_hr || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg an hour (monthly average)</div>` +
      `<div class="meta"><select aria-label="Pollutant">${CT_GASES.map(([k, l]) => `<option value="${k}"${k === gas ? " selected" : ""}>${l}</option>`).join("")}</select></div>` +
      `<div class="ct-air-figs meta">Reading Climate TRACE\u2026</div>` +
      (p.area ? `<div class="meta"><a href="https://climatetrace.org/air-pollution/${encodeURIComponent(p.area)}" target="_blank" rel="noopener">Its city air-pollution page</a></div>` : "") +
      `<div class="meta">Climate TRACE (CC BY 4.0)</div>`).addTo(map);
    const el = pop.getElement();
    const figs = async () => {
      const box = el.querySelector(".ct-air-figs");
      try {
        const a = await getJson(`https://api.c10e.org/v7/app/asset/${encodeURIComponent(p.id)}?gas=${gas}&years=2024`, 30000);
        box.innerHTML = ctAssetHtml(a, gas);
      } catch (err) { box.textContent = `Climate TRACE did not answer (${err.message})`; }
    };
    el.querySelector("select").addEventListener("change", (ev) => { gas = ev.target.value; figs(); });
    figs();
    if (p.plume) {
      try { map.getSource(`${cfg.id}-plume`).setData(await getJson(`https://plumes.climatetrace.org/${p.plume}`, 30000)); }
      catch (err) { /* no plume for this date */ }
    }
  });
  map.on("mouseenter", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = ""; });
  setLayerState(cfg.id, `${(gj.features || []).length.toLocaleString()} sources \u00b7 click one for its plume and pollutants`);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nClimate TRACE air pollution");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("sources and population are rows under Climate > Air pollution", /id: "ct_air"/.test(src) && /id: "ct_pop"/.test(src) && /\{ h: 4, t: "Air pollution" \}, "ct_air", "ct_pop"/.test(src));
  check("every pollutant Climate TRACE reports can be chosen", ["pm2_5", "bc", "oc", "so2", "vocs", "co", "nh3", "nox", "co2e_100yr"].every((g) => src.includes(`["${g}",`)));
  check("a click reads the plume and the figures live", /plumes\.climatetrace\.org\/\$\{p\.plume\}/.test(src) && /api\.c10e\.org\/v7\/app\/asset/.test(src));
  const html = new Function("escapeHtml", "CT_GASES", src.slice(src.indexOf("function ctAssetHtml("), src.indexOf("async function addCtAirLayer(")) + "; return ctAssetHtml;")((s) => String(s), [["pm2_5", "PM2.5"]]);
  const h = html({ type: "BF/BOF", subsector: "iron-and-steel", location: { country: "BRA" }, totals: { value: 807.3, capacity: 600000, capacityUnits: "t of steel", capacityFactor: 0.62 }, subsectorRanks: [{ year: 2025, rank: 418 }] }, "pm2_5");
  check("a source's box gives its figures and rank", h.includes("807.3") && h.includes("used 62%") && h.includes("2025: 418"));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Climate TRACE air pollution added. Test with: node map/test.mjs")
