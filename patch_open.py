#!/usr/bin/env python3
"""
What was still open:

1. EPA Envirofacts (the "EPA emissions widget"): now drawn live from the map
   service behind it, EPA's EnviroMapper facility points: Superfund, toxic
   releases, water dischargers, air pollution, hazardous waste and brownfields,
   each a chip. EPA draws these from about zoom 7 in (state level); a click gives
   each facility's own record. Its panel row is replaced by this.
2. Giga school mapping by country (copied daily; its service does not let other
   sites read it): shading by schools mapped, share with connectivity data, or
   whether connectivity and coverage data exist; a click gives the country's own
   figures. Its whole map stays a panel row too, since its school points come
   from its own server and cannot be read.
3. Trase facilities: one row with Trase's own facilities menu (Brazil
   slaughterhouses and animal-product facilities, soy silos; Côte d'Ivoire cocoa
   cooperatives; Indonesia palm oil mills, wood pulp mills and the three periods
   of wood pulp concessions), read live from Trase.
4. Two of your own: the Biosignature Evidence Assessment (Off-planet invasion)
   and the Leverage Chart, each whole in the panel.
5. The rows that were waiting under "Not yet placed" are placed:
     Invasion of humans: EJAtlas
     Deforestation: Trase measures, Trase facilities, Nusantara Atlas, the Global
       Forest Watch catalogue, Global Safety Net and its rankings
     Plastics: Seas of Plastic, Coastal Cleanup
     Oceans: UNEP-WCMC coral
     Construction: Mines worldwide
     Of the planet: Atlas for the End of the World, hotspots and cities
     Climate: Climate TRACE history
     Suppression, Of animals: Final Nail
   The two Suppression-page Google My Maps maps, ACGF and the Leverage Chart
   stay under "Not yet placed" until you say where.

Run from the repo root:  python3 patch_open.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function addArcgisDynLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"

# --- 1. EPA --------------------------------------------------------------------------------
once('''    { id: "epa_widget", name: "EPA emissions widget", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://www.epa.gov/sites/production/files/widgets/ef-multisystem.html",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },''',
     '''    { id: "epa_widget", name: "EPA Envirofacts facilities (the multisystem widget)", unit: "facilities", colour: "#6A6258", route: "arcgisdyn", ready: true, lazy: true,
      service: "https://geopub.epa.gov/arcgis/rest/services/EMEF/efpoints/MapServer", minzoom: 6.5,
      attribution: "US EPA Envirofacts",
      note: "The facility points behind EPA's Envirofacts multisystem widget, drawn live from EPA's EnviroMapper service; EPA draws them from about state level in." },''')

# --- 2. Giga, 3. Trase facilities, 4. own pages ---------------------------------------------------
ROWS = f'''    {{ id: "giga_countries", name: "Giga: school mapping by country", unit: "countries", colour: "#627A86", route: "giga", ready: true, lazy: true,
      data: "{HOME}/giga/countries.json",
      note: "Giga's own figures for every country on its map, copied daily (its service does not let other sites read it)." }},
    {{ id: "trase_facilities", name: "Trase: facilities", unit: "facilities", colour: "#62755F", route: "trasefacmenu", ready: true, lazy: true,
      manifest: "{HOME}/trase/facilities.json",
      types: [["brazil-facilities", "Brazil: slaughterhouses and animal-product facilities"], ["brazil-silos", "Brazil: soy silos and storage"],
              ["cote-d-ivoire-cocoa-cooperatives", "C\\u00f4te d'Ivoire: cocoa cooperatives"], ["indonesia-palm-oil-mills", "Indonesia: palm oil mills"],
              ["indonesia-wood-pulp-mills", "Indonesia: wood pulp mills"], ["indonesia-wood-pulp-concessions-2015-2019", "Indonesia: wood pulp concessions, 2015\\u20132019"],
              ["indonesia-wood-pulp-concessions-2020-2022", "Indonesia: wood pulp concessions, 2020\\u20132022"], ["indonesia-wood-pulp-concessions-2023-2024", "Indonesia: wood pulp concessions, 2023\\u20132024"]],
      note: "Trase's facilities maps, chosen from its own menu, read live from Trase's files (CC BY 4.0)." }},
    {{ id: "biosignature", name: "Biosignature Evidence Assessment", unit: "opens it in a panel", colour: "#5E6070", route: "companion", ready: true, lazy: true,
      page: "https://welcometoyourgalaxy.github.io/maps/off-planet-invasion_embed_13_large-script.html",
      note: "Your own assessment from the Off-Planet Invasion page, whole, in the panel along the bottom." }},
    {{ id: "leverage_chart", name: "The Leverage Chart", unit: "opens it in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://welcometoyourgalaxy.github.io/maps/leverage-chart.html",
      note: "Your own chart from the Solution page, whole, in the panel along the bottom." }},
'''
once('''    { id: "wreckers_umap",''', ROWS + '''    { id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  giga_countries: ["human", "upstream"],\n  trase_facilities: ["plant", "upstream"],\n  biosignature: ["insentient", "downstream"],\n  leverage_chart: ["human", "upstream"],\n')
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "arcgisdyn" ? addArcgisDynLayer(cfg)
    : cfg.route === "giga" ? addGigaLayer(cfg)
    : cfg.route === "trasefacmenu" ? addTraseFacMenu(cfg)''')

# --- 5. placements --------------------------------------------------------------------------------
PLACE = [
    ('{ h: 3, t: "Invasion of humans" }, "site_settler_colonialism", "site_indigenous_conflicts",', ' "ejatlas",'),
    ('{ h: 3, t: "Deforestation" }, "gfw", "gfw_dist", "gfw_dist_year", "glad_loss", "palmwatch", "soilgrids",',
     ' "trase_measures", "trase_facilities", "nusantara", "gfw_catalogue", "gsn", "gsn_rankings",'),
    ('"pirg_plastic", "bffp_audit", "gpw_map",', ' "seas_of_plastic", "coastal_cleanup",'),
    ('"skytruth_monitor", "skytruth_voc",', ' "unep_coral",'),
    ('"local_projects", "live_projects_app",', ' "mines_global",'),
    ('{ h: 2, t: "Of the planet" },', ' "atlas_hotspots", "atlas_cities",'),
    ('"usda_soybean", "usda_corn", "wastewater",', ' "group:ct_history",'),
    ('"site_animal_racing", "site_rodeo",', ' "final_nail",'),
    ('"nsf_locations", "esa_risk",', ' "biosignature",'),
]
for anchor, add in PLACE:
    once(anchor, anchor + add)

JS = r'''/* ---------- an ArcGIS map service drawn as pictures, its layers as chips (EPA Envirofacts) ---------- */
async function addArcgisDynLayer(cfg) {
  let info;
  try { info = await getJson(`${cfg.service}?f=json`, 30000); }
  catch (e) { setLayerState(cfg.id, `the service did not answer (${e.message})`); return; }
  const layers = (info.layers || []).filter((l) => !l.subLayerIds);
  const on = new Set(layers.map((l) => l.id));
  const tilesFor = () => [`${cfg.service}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true` +
    `&layers=show:${[...on].join(",") || "-1"}&dpi=96&f=image`];
  const src = `${cfg.id}-img`;
  map.addSource(src, { type: "raster", tileSize: 256, minzoom: Math.floor(cfg.minzoom || 0), tiles: tilesFor(), attribution: cfg.attribution || "" });
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: src, minzoom: cfg.minzoom || 0 });
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = layers.map((l) => `<button type="button" class="chip on" data-dl="${l.id}">${escapeHtml(l.name)}</button>`).join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-dl]");
      if (!b) return;
      e.stopPropagation();
      const id = Number(b.dataset.dl);
      if (on.has(id)) on.delete(id); else on.add(id);
      b.classList.toggle("on", on.has(id));
      const s = map.getSource(src);
      if (s && s.setTiles) s.setTiles(tilesFor());
    });
    anchor.after(el);
  }
  map.on("click", async (e) => {
    if ((visibility.get(cfg.id) || "visible") !== "visible" || !map.getLayer(`${cfg.id}-raster`) || map.getZoom() < (cfg.minzoom || 0) || !on.size) return;
    const b = map.getBounds(), c = map.getCanvas();
    const q = `${cfg.service}/identify?geometry=${e.lngLat.lng},${e.lngLat.lat}&geometryType=esriGeometryPoint&sr=4326` +
      `&layers=visible:${[...on].join(",")}&tolerance=6&mapExtent=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}` +
      `&imageDisplay=${c.clientWidth},${c.clientHeight},96&returnGeometry=false&f=json`;
    try {
      const j = await getJson(q, 20000);
      const hits = (j.results || []).slice(0, 8);
      if (!hits.length) return;
      new maplibregl.Popup({ maxWidth: "340px" }).setLngLat(e.lngLat).setHTML(hits.map((h) =>
        `<b>${escapeHtml(h.value || (h.attributes && h.attributes.PRIMARY_NAME) || "")}</b><div class="meta">${escapeHtml(h.layerName || "")}</div>` +
        `<table class="meta">${fieldRows(Object.fromEntries(Object.entries(h.attributes || {}).filter(([k, v]) => v !== "Null" && !/^(OBJECTID|Shape)$/i.test(k))))}</table>`).join("<hr>") +
        `<div class="meta">US EPA Envirofacts</div>`).addTo(map);
    } catch (err) { /* nothing there */ }
  });
  setLayerState(cfg.id, `${layers.length} kinds of facility \u00b7 drawn from about state level in`);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- Giga: school mapping by country ---------- */
async function addGigaLayer(cfg) {
  let data;
  try { data = await getJson(cfg.data, 60000); }
  catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
  const C = new Map((data.countries || []).map((c) => [c.iso3_format, c]));
  const shapes = await getJson(BOUNDARIES_URL);
  map.addSource(`${cfg.id}-src`, { type: "geojson", data: { type: "FeatureCollection", features: shapes.features.filter((f) => C.has(f.properties.iso3)) } });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-src`, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0.75 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-src`, paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
  const shade = (m) => {
    const expr = ["match", ["get", "iso3"]];
    const val = (c) => m === "schools" ? (c.entity_counts || {}).school || 0 : m === "share" ? c.schools_with_data_percentage || 0 : null;
    if (m === "schools" || m === "share") {
      const breaks = owidBreaks([...C.values()].map(val).filter((v) => v > 0));
      for (const [iso, c] of C) { const v = val(c); if (!v) continue; let i = 0; while (i < breaks.length && v >= breaks[i]) i++; expr.push(iso, OWID_RAMP[Math.min(i + (4 - breaks.length), 4)]); }
    } else {
      const cats = [...new Set([...C.values()].map((c) => c[m]).filter(Boolean))].sort();
      const pal = ["#3F5663", "#8A9DA6", "#B3C0C6", "#CDAEA4", "#8C5548", "#62755F"];
      for (const [iso, c] of C) if (c[m]) expr.push(iso, pal[cats.indexOf(c[m]) % pal.length]);
    }
    expr.push("rgba(0,0,0,0)");
    map.setPaintProperty(`${cfg.id}-fill`, "fill-color", expr.length > 3 ? expr : "rgba(0,0,0,0)");
  };
  bindHtmlPopup(`${cfg.id}-fill`, (p) => {
    const c = C.get(p.iso3);
    if (!c) return "";
    const pretty = (s) => String(s || "\u2014").replace(/_/g, " ");
    return (c.flag ? `<img src="${escapeHtml(c.flag)}" style="height:18px;margin-right:6px;vertical-align:middle">` : "") + `<b>${escapeHtml(c.name)}</b>` +
      `<div class="meta">Schools mapped: ${Number((c.entity_counts || {}).school || 0).toLocaleString()}` +
      ((c.entity_counts || {}).health ? `; health facilities: ${Number(c.entity_counts.health).toLocaleString()}` : "") + `</div>` +
      `<div class="meta">With connectivity data: ${Number(c.schools_with_data_percentage || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%</div>` +
      `<div class="meta">Connectivity data: ${escapeHtml(pretty(c.connectivity_availability))}; coverage data: ${escapeHtml(pretty(c.coverage_availability))}</div>` +
      (c.data_source ? `<div class="meta">Data source: ${escapeHtml(c.data_source)}</div>` : "") +
      (c.date_schools_mapped ? `<div class="meta">Mapped: ${escapeHtml(c.date_schools_mapped)}</div>` : "") +
      `<div class="meta">Giga (UNICEF and ITU)</div>`;
  });
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Shade by"><option value="schools">Schools mapped</option><option value="share">Share with connectivity data</option>` +
      `<option value="connectivity_availability">Connectivity data</option><option value="coverage_availability">Coverage data</option></select>`;
    el.querySelector("select").addEventListener("change", (e) => shade(e.target.value));
    anchor.after(el);
  }
  shade("schools");
  const w = data.world && data.world.school;
  setLayerState(cfg.id, `${C.size} countries` + (w ? ` \u00b7 ${Number(w.entities_total).toLocaleString()} schools mapped worldwide` : ""));
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- Trase facilities, from Trase's own menu ---------- */
async function addTraseFacMenu(cfg) {
  const src = `${cfg.id}-src`;
  map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: src, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": cfg.colour, "fill-opacity": 0.45 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: src, filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": "#1D1B17", "line-width": 0.5 } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": cfg.colour, "circle-radius": 4 } });
  for (const l of [`${cfg.id}-fill`, `${cfg.id}-pt`]) bindHtmlPopup(l, (p) => p.h || "");
  const show = async (type) => {
    setLayerState(cfg.id, "reading Trase\u2026");
    try {
      const got = await readTraseFacilities({ ...cfg, facilityType: type });
      map.getSource(src).setData({ type: "FeatureCollection", features: got.items.map((it) => ({ type: "Feature", geometry: it.geometry, properties: { h: it.h } })) });
      setLayerState(cfg.id, `${got.items.length.toLocaleString()} ${cfg.types.find((t) => t[0] === type)[1]}`);
    } catch (e) { setLayerState(cfg.id, `Trase did not answer (${e.message})`); }
  };
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Facilities">${cfg.types.map(([k, l]) => `<option value="${k}">${escapeHtml(l)}</option>`).join("")}</select>`;
    el.querySelector("select").addEventListener("change", (e) => show(e.target.value));
    anchor.after(el);
  }
  await show(cfg.types[0][0]);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nwhat was still open");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the EPA widget's facilities are drawn live from EPA's service", /id: "epa_widget"[^\n]*route: "arcgisdyn"/.test(src) && /EMEF\/efpoints\/MapServer/.test(src) && /\/identify\?geometry=/.test(src));
  check("Giga by country, Trase facilities, and two of your own are rows", ["giga_countries", "trase_facilities", "biosignature", "leverage_chart"].every((i) => new RegExp(`id: "${i}"`).test(src)));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  check("the waiting rows are placed", ["ejatlas", "trase_measures", "nusantara", "gfw_catalogue", "gsn", "seas_of_plastic", "coastal_cleanup", "unep_coral", "mines_global", "atlas_hotspots", "final_nail", "group:ct_history"].every((i) => order.includes(i)));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Done. Test with: node map/test.mjs")
