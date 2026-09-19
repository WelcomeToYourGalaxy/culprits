#!/usr/bin/env python3
"""
Live maps, batch 2. All sit in "Other organisations' maps" (so they appear
under "Not yet placed" until you place them).

  EJAtlas                    every conflict (about 4,600), read live, each with its own summary and link
  Seas of Plastic            its stations, sampling trips and ocean areas, read live
  Final Nail                 its fur-farm map, read live, as published
  Nusantara Atlas            every layer its map server publishes, chosen from a menu and drawn live;
                             a click asks the server what is there
  Global Forest Watch /      every dataset in its catalogue, chosen from a menu; drawn live from its own
  Global Nature Watch        tiles when it publishes tiles for that dataset
  Coastal Cleanup            its cleanup sites, from a daily GitHub copy (its server lets only its own
                             site read it)
  Atlas for the End of the   the 36 biodiversity hotspots, drawn live from Conservation International's
  World: Hotspots            boundaries; each box links the Atlas's own PDF for that hotspot
  Atlas for the End of the   its 33 cities, each placed from its name (weekly OpenStreetMap lookup);
  World: Hotspot Cities      each box links the Atlas's own page for that city
Also fixed: the eight Trase facilities rows now read Trase's files (their reader
was missing, so they fell through to the ArcGIS reader).

Run from the repo root:  python3 patch_live_batch2.py
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function readEjatlas(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
HOTSPOT_PDFS = [["atlantic_forests", "Atlantic Forest"], ["california_floristic_province", "California Floristic Province"], ["cape_floristic_region", "Cape Floristic Region"], ["caribbean_islands", "Caribbean Islands"], ["caucasus", "Caucasus"], ["cerrado", "Cerrado"], ["chilean_valdivian_forests", "Chilean Winter Rainfall Valdivian Forests"], ["coastal_forests_of_eastern_africa", "Coastal Forests of Eastern Africa"], ["east_melanesian_islands", "East Melanesian Islands"], ["eastern_afromontane", "Eastern Afromontane"], ["forests_of_east_australia", "Forests of Eastern Australia"], ["guinean_forests_of_west_africa", "Guinean Forests of West Africa"], ["himalaya", "Himalaya"], ["horn_of_africa", "Horn of Africa"], ["japan", "Japan"], ["madagascar", "Madagascar & The Indian Ocean Islands"], ["madrean_woodlands", "Madrean Pine-Oak Woodlands"], ["maputaland_pondoland_albany", "Maputaland Pondoland Albany"], ["mediterranean_basin", "Mediterranean Basin"], ["mesoamerica", "Mesoamerica"], ["mountains_of_central_asia", "Mountains of Central Asia"], ["mountains_of_southwest_china", "Mountains of Southwest China"], ["new_caledonia", "New Caledonia"], ["new_zealand", "New Zealand"], ["philippines", "Philippines"], ["north_american_coastal_plain", "North American Coastal Plain"], ["southwest_australia", "Southwest Australia"], ["succulent_karoo", "Succulent Karoo"], ["sundaland", "Sundaland"], ["tropical_andes", "Tropical Andes"], ["wallacea", "Wallacea"], ["western_ghats_sri_lanka", "Western Ghats & Sri Lanka"]]
CITIES = [["antananarivo", "Antananarivo, Madagascar"], ["auckland", "Auckland, New Zealand"], ["baku", "Baku, Azerbaijan"], ["bogota", "Bogot\u00e1, Colombia"], ["brasilia", "Bras\u00edlia, Brazil"], ["cape_town", "Cape Town, South Africa"], ["chengdu", "Chengdu, China"], ["colombo", "Colombo, Sri Lanka"], ["dar_es_salaam", "Dar es Salaam, Tanzania"], ["davao", "Davao, Philippines"], ["durban", "Durban, South Africa"], ["esfahan", "Esfahan, Iran"], ["guadalajara", "Guadalajara, Mexico"], ["guayaquil", "Guayaquil, Ecuador"], ["hongknog_shenzhen_quangzhou", "Hongkong-Shenzhen-Guangzhou, China"], ["honolulu", "Honolulu, United States"], ["houston", "Houston, United States"], ["jakarta", "Jakarta, Indonesia"], ["lagos", "Lagos, Nigeria"], ["los_angeles", "Los Angeles, United States"], ["makassar", "Makassar, Indonesia"], ["mecca", "Mecca, Saudi Arabia"], ["mexico_city", "Mexico City, Mexico"], ["nairobi", "Nairobi, Kenya"], ["osaka", "Osaka, Japan"], ["perth", "Perth, Australia"], ["port-au-prince", "Port-au-Prince, Haiti"], ["rawalpindi", "Rawalpindi, Pakistan"], ["santiago", "Santiago, Chile"], ["sao_paulo", "S\u00e3o Paulo, Brazil"], ["sydney", "Sydney, Australia"], ["tashkent", "Tashkent, Uzbekistan"], ["tel_aviv", "Tel Aviv, Israel"]]

ROWS = f'''    {{ id: "ejatlas", name: "Environmental Justice Atlas (EJAtlas)", unit: "conflicts", colour: "#7A5A55", route: "ejatlas", ready: true, lazy: true,
      api: "https://ejatlas.org/api/v1/conflicts/",
      note: "Every conflict in the EJAtlas, read live from its own data address; each box links the conflict's page." }},
    {{ id: "seas_of_plastic", name: "Seas of Plastic", unit: "stations, trips and ocean areas", colour: "#5E7377", route: "geojsonlive", ready: true, lazy: true,
      files: [{{ label: "Stations", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/AllStations.geojson" }},
              {{ label: "Trips", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/AllTrips.geojson" }},
              {{ label: "Oceans", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/Oceans.geojson" }}],
      note: "Seas of Plastic's own data files, read live: sampling stations, the trips that took them, and its ocean areas." }},
    {{ id: "final_nail", name: "Final Nail (fur farms)", unit: "farms", colour: "#6B5A4A", route: "wpgmza", ready: true, lazy: true,
      api: "https://finalnail.com/wp-json/wpgmza/v1/features/",
      note: "Final Nail's map, read live from its own data address, as it publishes it (names and addresses included)." }},
    {{ id: "nusantara", name: "Nusantara Atlas (TheTreeMap)", unit: "map layers", colour: "#6F7560", route: "wmsmenu", ready: true, lazy: true,
      wms: ["https://map.nusantara-atlas.org/geoserver/atlas-workspace-v3/wms", "https://map.nusantara-atlas.org/geoserver/atlas-workspace-v2/wms"],
      attribution: "Nusantara Atlas, TheTreeMap",
      note: "Every layer Nusantara Atlas's map server publishes, drawn live; its alerts and compliance lists need a login and are not included." }},
    {{ id: "gfw_catalogue", name: "Global Forest Watch / Global Nature Watch: every dataset", unit: "datasets", colour: "#62755F", route: "gfwmenu", ready: true, lazy: true,
      api: "https://data-api.globalforestwatch.org",
      note: "Its whole data catalogue, read live; a dataset draws from its own published tiles when it has them." }},
    {{ id: "coastal_cleanup", name: "Coastal Cleanup (Ocean Conservancy)", unit: "cleanup sites", colour: "#5F6B70", route: "geojsonlive", ready: true, lazy: true,
      files: [{{ label: "Cleanups", url: "{HOME}/coastal/cleanups.geojson" }}],
      note: "Ocean Conservancy's cleanup sites, copied daily by culprits-tiles-more (its server lets only its own site read it)." }},
    {{ id: "atlas_hotspots", name: "Atlas for the End of the World: Hotspots", unit: "biodiversity hotspots", colour: "#6E5A55", route: "arcgisapp", ready: true, lazy: true,
      item: "ba55aa1bff5447e7b72559b8dc1a0e83", pdfBase: "https://atlas-for-the-end-of-the-world.com/hotspots/",
      pdfs: {json.dumps(HOTSPOT_PDFS)},
      note: "The 36 biodiversity hotspots, outlined live from Conservation International's Biodiversity Hotspots 2016.1 (CC BY 3.0), the boundaries the Atlas maps; each box links the Atlas's own PDF for that hotspot." }},
    {{ id: "atlas_cities", name: "Atlas for the End of the World: Hotspot Cities", unit: "cities", colour: "#5E6070", route: "atlascities", ready: true, lazy: true,
      pageBase: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/", positions: "{HOME}/atlas/cities.json",
      cities: {json.dumps(CITIES, ensure_ascii=False)},
      note: "The Atlas's 33 hotspot cities; each is placed from its name through a weekly OpenStreetMap lookup, and its box links the Atlas's own page." }},
'''
once('''    { id: "wreckers_umap",''', ROWS + '''    { id: "wreckers_umap",''')
KINDS = {"ejatlas": ("human", "downstream"), "seas_of_plastic": ("animal", "downstream"), "final_nail": ("animal", "downstream"),
         "nusantara": ("plant", "downstream"), "gfw_catalogue": ("plant", "downstream"), "coastal_cleanup": ("insentient", "downstream"),
         "atlas_hotspots": ("plant", "downstream"), "atlas_cities": ("human", "downstream")}
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n' +
     "".join(f'  {k}: ["{a}", "{b}"],\n' for k, (a, b) in KINDS.items()))
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : ["ejatlas", "geojsonlive", "wpgmza", "atlascities", "trasefac"].includes(cfg.route) ? addLivePlacesLayer(cfg)
    : cfg.route === "wmsmenu" ? addWmsMenuLayer(cfg)
    : cfg.route === "gfwmenu" ? addGfwMenuLayer(cfg)''')
once("""    got = cfg.route === "umap" ? await readUmap(cfg)
        : cfg.route === "kml" ? await readKml(cfg)
        : await readArcgisApp(cfg);""", """    got = cfg.route === "umap" ? await readUmap(cfg)
        : cfg.route === "kml" ? await readKml(cfg)
        : cfg.route === "ejatlas" ? await readEjatlas(cfg)
        : cfg.route === "geojsonlive" ? await readGeojsonFiles(cfg)
        : cfg.route === "wpgmza" ? await readWpgmza(cfg)
        : cfg.route === "atlascities" ? await readAtlasCities(cfg)
        : cfg.route === "trasefac" ? await readTraseFacilities(cfg)
        : await readArcgisApp(cfg);
    if (cfg.pdfs) linkAtlasPdfs(cfg, got.items);""")

JS = r'''/* ---------- live places, batch 2 ---------- */
const boxOpen = `<div style="font:13px/1.4 system-ui,sans-serif;max-width:340px">`;
function fieldRows(p, skip = []) {
  return Object.keys(p).filter((k) => !skip.includes(k) && p[k] !== null && p[k] !== "" && typeof p[k] !== "object")
    .map((k) => `<tr><th style="text-align:left;padding-right:8px;vertical-align:top">${escapeHtml(k.replace(/_/g, " "))}</th><td>${escapeHtml(p[k])}</td></tr>`).join("");
}
function pointOf(r) {
  const n = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  const pairs = [[r.lon, r.lat], [r.lng, r.lat], [r.longitude, r.latitude], [r.long, r.lat]];
  for (const [x, y] of pairs) if (isFinite(n(x)) && isFinite(n(y))) return { type: "Point", coordinates: [n(x), n(y)] };
  for (const g of [r.geometry, r.point, r.location, r.geom]) {
    if (g && g.type && g.coordinates) return g;
    if (g && isFinite(n(g.lat)) && isFinite(n(g.lon ?? g.lng))) return { type: "Point", coordinates: [n(g.lon ?? g.lng), n(g.lat)] };
  }
  return null;
}

// EJAtlas: its conflicts, page by page.
async function readEjatlas(cfg) {
  const items = [];
  let url = `${cfg.api}?limit=500&offset=0`, pages = 0, sample = null;
  while (url && pages < 40) {
    const j = await getJson(url.replace(/^http:/, "https:"), 60000);
    for (const r of j.results || []) {
      sample = sample || r;
      const g = pointOf(r);
      if (!g) continue;
      const title = r.title || r.name || r.headline || `Conflict ${r.id}`;
      const link = r.slug ? `https://ejatlas.org/conflict/${encodeURIComponent(r.slug)}` : (r.url || "");
      items.push({ geometry: g, key: `c${r.id}`, name: title, group: r.category || r.type || "",
        h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(title)}</h4>` +
          (r.image ? `<img src="${escapeHtml(r.image)}" style="max-width:100%;margin:4px 0">` : "") +
          (r.headline && r.headline !== title ? `<p>${escapeHtml(r.headline)}</p>` : "") +
          `<table>${fieldRows(r, ["id", "slug", "image", "headline", "title", "name", "lat", "lon", "lng", "latitude", "longitude"])}</table>` +
          (link ? `<p><a href="${escapeHtml(link)}" target="_blank" rel="noopener">Open on EJAtlas</a></p>` : "") + `</div>` });
    }
    url = j.next; pages++;
  }
  if (!items.length && sample) console.warn(`[culprits] ejatlas: no position found in its records; their fields are ${Object.keys(sample).join(", ")}`);
  return { title: cfg.name, items };
}

// Plain GeoJSON files (Seas of Plastic; the Coastal Cleanup copy).
async function readGeojsonFiles(cfg) {
  const items = [];
  for (const f of cfg.files) {
    const gj = await getJson(f.url, 60000);
    (gj.features || []).forEach((ft, i) => {
      const p = ft.properties || {};
      const name = p.name || p.Name || p.title || p.Source || (p.TripId != null ? `Trip ${p.TripId}` : "") || p.Ocean || f.label;
      items.push({ geometry: ft.geometry, key: `${f.label}:${i}`, name: String(name), group: f.label,
        h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(name)}</h4><table>${fieldRows(p)}</table></div>` });
    });
  }
  return { title: cfg.name, items };
}

// WP Go Maps (Final Nail): its markers as published.
async function readWpgmza(cfg) {
  const j = await getJson(cfg.api, 60000);
  const items = (j.markers || []).map((m, i) => {
    const lat = Number(m.lat), lng = Number(m.lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { geometry: { type: "Point", coordinates: [lng, lat] }, key: `m${m.id || i}`, name: m.title || "",
      group: "", h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(m.title || "")}</h4>${m.description || ""}` +
        (m.link ? `<p><a href="${escapeHtml(m.link)}" target="_blank" rel="noopener">More</a></p>` : "") + `</div>` };
  }).filter(Boolean);
  return { title: cfg.name, items };
}

// Atlas for the End of the World: a hotspot's box links the Atlas's PDF for it.
function atlasWords(s) { return new Set(String(s).toLowerCase().replace(/&/g, " and ").split(/[^a-z]+/).filter((w) => w.length > 2 && w !== "and" && w !== "the")); }
function atlasPdfFor(cfg, name) {
  const want = atlasWords(name);
  let best = null, score = 0;
  for (const [file, label] of cfg.pdfs) {
    const have = atlasWords(label);
    const common = [...want].filter((w) => have.has(w)).length;
    const s = common / Math.max(want.size, have.size);
    if (s > score) { score = s; best = [file, label]; }
  }
  return score >= 0.5 ? best : null;
}
function linkAtlasPdfs(cfg, items) {
  for (const it of items) {
    const hit = atlasPdfFor(cfg, it.name);
    it.h = it.h.replace(/<\/div>$/, hit
      ? `<p><a href="${cfg.pdfBase}${hit[0]}.pdf" target="_blank" rel="noopener">Open the Atlas's PDF: ${escapeHtml(hit[1])}</a></p></div>`
      : `<p style="font-size:11px">The Atlas has no PDF for this hotspot.</p></div>`);
  }
}

// The Atlas's cities, placed from the weekly lookup of their names.
async function readAtlasCities(cfg) {
  let at = {};
  try { at = await getJson(cfg.positions); } catch (e) { /* not built yet */ }
  const items = [];
  let missing = 0;
  for (const [slug, name] of cfg.cities) {
    const c = at[name];
    if (!c) { missing++; continue; }
    items.push({ geometry: { type: "Point", coordinates: c }, key: slug, name, group: "",
      h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(name)}</h4>` +
        `<p><a href="${cfg.pageBase}${slug}.html" target="_blank" rel="noopener">Open the Atlas's page for this city</a></p>` +
        `<p style="font-size:11px">Placed from its name through OpenStreetMap; the Atlas gives no coordinates.</p></div>` });
  }
  return { title: cfg.name, items, note: missing ? `${missing} not yet placed` : "" };
}

// Trase's facilities maps: the current file from the weekly manifest, read live from Trase.
async function readTraseFacilities(cfg) {
  let file = cfg.file, base = "https://resources.trase.earth/data/facilities-data/";
  try {
    const m = await getJson(cfg.manifest);
    const hit = (m.types || []).find((t) => t.id === cfg.facilityType);
    if (hit && hit.file) { file = hit.file; base = m.base || base; }
  } catch (e) { /* the manifest is not built yet: use the file known when this was written */ }
  const gj = await getJson(base + file, 120000);
  const items = (gj.features || []).map((f, i) => {
    const p = f.properties || {};
    const keys = Object.keys(p);
    const nameKey = keys.find((k) => /(^|_)(name|nome|razao|mill|coop|company|facility)(_|$)/i.test(k) && typeof p[k] === "string" && p[k]);
    const groupKey = keys.find((k) => /commodit/i.test(k)) || keys.find((k) => /^(type|facility_type|tipo)$/i.test(k));
    return { geometry: f.geometry, key: `f${i}`, name: nameKey ? p[nameKey] : "", group: groupKey ? String(p[groupKey] ?? "") : "",
      h: boxOpen + (nameKey ? `<h4 style="margin:0 0 6px">${escapeHtml(p[nameKey])}</h4>` : "") +
        `<table>${fieldRows(p)}</table><div style="margin-top:6px;font-size:11px">Trase (CC BY 4.0)</div></div>` };
  });
  return { title: cfg.name, items };
}

/* ---------- a map server's whole layer list, as a menu (Nusantara Atlas) ---------- */
async function addWmsMenuLayer(cfg) {
  const layers = [];
  for (const base of cfg.wms) {
    try {
      const r = await fetch(`${base}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`);
      const doc = new DOMParser().parseFromString(await r.text(), "application/xml");
      for (const l of doc.getElementsByTagName("Layer")) {
        const nm = [...l.children].find((c) => c.tagName === "Name");
        if (!nm || [...l.getElementsByTagName("Layer")].length) continue;
        const tt = [...l.children].find((c) => c.tagName === "Title");
        const ab = [...l.children].find((c) => c.tagName === "Abstract");
        layers.push({ base, name: nm.textContent, title: (tt && tt.textContent) || nm.textContent, about: (ab && ab.textContent) || "" });
      }
    } catch (e) { console.warn(`[culprits] ${cfg.id}: ${base}: ${e.message}`); }
  }
  if (!layers.length) { setLayerState(cfg.id, "the map server did not list its layers"); return; }
  layers.sort((a, b) => a.title.localeCompare(b.title));
  cfg._layers = layers;
  cfg._pick = cfg._pick || 0;
  const src = `${cfg.id}-img`;
  const tilesFor = (l) => `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(l.name)}&STYLES=` +
    `&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`;
  map.addSource(src, { type: "raster", tileSize: 256, attribution: cfg.attribution || "", tiles: [tilesFor(layers[cfg._pick])] });
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: src, paint: { "raster-opacity": 0.85 } });
  const menu = document.createElement("div");
  menu.className = "facet";
  menu.innerHTML = `<select aria-label="Layer" style="max-width:100%">${layers.map((l, i) =>
    `<option value="${i}">${escapeHtml(l.title)}</option>`).join("")}</select>`;
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) anchor.after(menu);
  const sel = menu.querySelector("select");
  const show = () => {
    const l = layers[cfg._pick];
    setLayerState(cfg.id, `${l.title}${l.about ? " \u2014 " + l.about.slice(0, 120) : ""}`);
  };
  sel.addEventListener("change", () => {
    cfg._pick = Number(sel.value) || 0;
    const s = map.getSource(src);
    if (s && s.setTiles) s.setTiles([tilesFor(layers[cfg._pick])]);
    show();
  });
  map.on("click", async (e) => {
    if ((visibility.get(cfg.id) || "visible") !== "visible" || map.getLayoutProperty(`${cfg.id}-raster`, "visibility") === "none") return;
    const l = layers[cfg._pick], b = map.getBounds(), c = map.getCanvas();
    const w = c.clientWidth || 800, h = c.clientHeight || 600;
    const pt = map.project(e.lngLat);
    const q = `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${encodeURIComponent(l.name)}&QUERY_LAYERS=${encodeURIComponent(l.name)}` +
      `&STYLES=&SRS=EPSG:4326&BBOX=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&WIDTH=${w}&HEIGHT=${h}` +
      `&X=${Math.round(pt.x)}&Y=${Math.round(pt.y)}&INFO_FORMAT=application/json&FEATURE_COUNT=5`;
    try {
      const j = await getJson(q);
      const feats = j.features || [];
      if (!feats.length) return;
      new maplibregl.Popup({ closeButton: true, maxWidth: "340px" }).setLngLat(e.lngLat)
        .setHTML(`<b>${escapeHtml(l.title)}</b>` + feats.map((f) => `<table class="meta">${fieldRows(f.properties || {})}</table>`).join("<hr>")).addTo(map);
    } catch (err) { /* nothing there, or the server declined */ }
  });
  show();
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- Global Forest Watch's whole catalogue, as a menu ---------- */
async function addGfwMenuLayer(cfg) {
  const all = [];
  for (let page = 1; page < 30; page++) {
    let j;
    try { j = await getJson(`${cfg.api}/datasets?page[size]=100&page[number]=${page}`, 40000); } catch (e) { break; }
    const rows = j.data || [];
    all.push(...rows);
    if (rows.length < 100) break;
  }
  if (!all.length) { setLayerState(cfg.id, "the catalogue did not answer"); return; }
  const items = all.map((d) => ({ id: d.dataset, title: (d.metadata && d.metadata.title) || d.dataset, meta: d.metadata || {} }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const menu = document.createElement("div");
  menu.className = "facet";
  menu.innerHTML = `<select aria-label="Dataset" style="max-width:100%"><option value="">Choose one of ${items.length} datasets\u2026</option>` +
    items.map((d, i) => `<option value="${i}">${escapeHtml(d.title)}</option>`).join("") + `</select>`;
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) anchor.after(menu);
  setLayerState(cfg.id, `${items.length} datasets \u2014 choose one`);
  const clear = () => {
    for (const id of [...(cfg._layerIds || [])]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(`${cfg.id}-gfw`)) map.removeSource(`${cfg.id}-gfw`);
    cfg._layerIds = [];
  };
  menu.querySelector("select").addEventListener("change", async (ev) => {
    clear();
    const d = items[Number(ev.target.value)];
    if (!d) return;
    setLayerState(cfg.id, `${d.title}: finding its tiles\u2026`);
    try {
      const v = await getJson(`${cfg.api}/dataset/${d.id}/latest`);
      const version = (v.data && v.data.version) || "latest";
      const assets = (await getJson(`${cfg.api}/dataset/${d.id}/${version}/assets`)).data || [];
      const vec = assets.find((a) => /vector tile cache/i.test(a.asset_type || ""));
      const ras = assets.find((a) => /raster tile cache/i.test(a.asset_type || ""));
      const about = [d.meta.license ? `licence: ${d.meta.license}` : "", d.meta.source ? `source: ${String(d.meta.source).replace(/\[|\]\([^)]*\)/g, "")}` : ""].filter(Boolean).join("; ");
      if (vec) {
        const uri = vec.asset_uri;
        const buf = await (await fetch(uri.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0"))).arrayBuffer().catch(() => null);
        const names = buf ? readTileLayers(buf) : [];
        map.addSource(`${cfg.id}-gfw`, { type: "vector", tiles: [uri], minzoom: 0, maxzoom: 12 });
        for (const n of (names.length ? names : [d.id, "default"])) {
          const base = { source: `${cfg.id}-gfw`, "source-layer": n };
          map.addLayer({ id: `${cfg.id}-f-${n}`, type: "fill", ...base, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": cfg.colour, "fill-opacity": 0.45, "fill-outline-color": "#1D1B17" } });
          map.addLayer({ id: `${cfg.id}-l-${n}`, type: "line", ...base, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": cfg.colour, "line-width": 1.2 } });
          map.addLayer({ id: `${cfg.id}-p-${n}`, type: "circle", ...base, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": cfg.colour, "circle-radius": 3, "circle-stroke-width": 0.5, "circle-stroke-color": "#17150F" } });
          for (const id of [`${cfg.id}-f-${n}`, `${cfg.id}-l-${n}`, `${cfg.id}-p-${n}`]) {
            cfg._layerIds.push(id);
            bindHtmlPopup(id, (p) => `<b>${escapeHtml(d.title)}</b><table class="meta">${fieldRows(p)}</table>`);
          }
        }
        setLayerState(cfg.id, `${d.title} \u00b7 live${about ? " \u00b7 " + about : ""}`);
      } else if (ras) {
        map.addSource(`${cfg.id}-gfw`, { type: "raster", tileSize: 256, tiles: [ras.asset_uri], maxzoom: 12 });
        map.addLayer({ id: `${cfg.id}-r`, type: "raster", source: `${cfg.id}-gfw`, paint: { "raster-opacity": 0.8, "raster-saturation": -0.3 } });
        cfg._layerIds.push(`${cfg.id}-r`);
        setLayerState(cfg.id, `${d.title} \u00b7 live picture${about ? " \u00b7 " + about : ""}`);
      } else {
        setLayerState(cfg.id, `${d.title}: Global Forest Watch publishes no map tiles for this dataset (download only)`);
      }
      const vis = visibility.get(cfg.id) || "visible";
      for (const id of cfg._layerIds) map.setLayoutProperty(id, "visibility", vis);
    } catch (e) {
      setLayerState(cfg.id, `${d.title}: ${e.message}`);
    }
  });
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

# The dataset menu's own layers follow the row's tick box.
once("""  if (cfg && cfg.route === "cerulean" && vis === "visible") {""", """  const extra = (cfg || childById(id) || {})._layerIds;
  if (extra) for (const l of extra) if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
  if (cfg && cfg.route === "cerulean" && vis === "visible") {""")

TESTS = r'''
console.log("\nlive maps, batch 2");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  for (const id of ["ejatlas", "seas_of_plastic", "final_nail", "nusantara", "gfw_catalogue", "coastal_cleanup", "atlas_hotspots", "atlas_cities"]) {
    check(`${id} is a row`, new RegExp(`id: "${id}"`).test(src));
  }
  check("the Trase facilities rows have their own reader again", /async function readTraseFacilities\(/.test(src) &&
        /cfg\.route === "trasefac" \? await readTraseFacilities\(cfg\)/.test(src));
  const body = src.slice(src.indexOf("function atlasWords("), src.indexOf("function linkAtlasPdfs("));
  const pdfFor = new Function(body + "; return atlasPdfFor;")();
  const cfg = { pdfs: [["madagascar", "Madagascar & The Indian Ocean Islands"], ["western_ghats_sri_lanka", "Western Ghats & Sri Lanka"], ["himalaya", "Himalaya"]] };
  check("a hotspot finds its Atlas PDF by name", (pdfFor(cfg, "Madagascar and the Indian Ocean Islands") || [])[0] === "madagascar" &&
        (pdfFor(cfg, "Western Ghats and Sri Lanka") || [])[0] === "western_ghats_sri_lanka");
  check("…and one the Atlas has no PDF for finds none", pdfFor(cfg, "Irano-Anatolian") === null);
  const p = new Function(src.slice(src.indexOf("function pointOf("), src.indexOf("// EJAtlas: its conflicts")) + "; return pointOf;")();
  check("a record's position is found under its usual names", JSON.stringify(p({ lat: "1.5", lon: "2" }).coordinates) === "[2,1.5]" &&
        JSON.stringify(p({ point: { type: "Point", coordinates: [3, 4] } }).coordinates) === "[3,4]");
  check("the Nusantara menu lists every layer its server publishes", /REQUEST=GetCapabilities/.test(src) && /REQUEST=GetFeatureInfo/.test(src));
  check("the GFW menu reads the whole catalogue and each dataset's tiles", /datasets\?page\[size\]=100/.test(src) && /vector tile cache/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Batch 2 added. Test with: node map/test.mjs")
