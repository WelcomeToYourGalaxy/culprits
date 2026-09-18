#!/usr/bin/env python3
"""
Live maps from the Destruction page, batch 1. Each is read from its own source
at view time; nothing is copied or stored. All sit in "Other organisations' maps".

  Wreckers of the Earth (Corporate Watch)       uMap: the map's own layers and popups
  two Google My Maps maps on the page           their KML: placemarks, folders, styles
  FracTracker's Global Oil Refinery map         ArcGIS: the app's web map and its layers
  two more ArcGIS maps linked from the page     the same reader (vinyl chloride section,
                                                and the materialresearch experience)
  Global Forest Change tree cover loss (UMD)    the published tiles
  SoilGrids (ISRIC)                             its WMS, one choice per soil property
  Global Wastewater Model (Tuholske et al.)     its five published tile sets

The places read from uMap, KML and ArcGIS are drawn and opened exactly like the
site's own maps (the same rows, filter chips, hover and boxes). The pictures
(forest loss, soil, wastewater) get a chip row to choose between the source's
own layers, and say so on the row if the source does not answer.

Needs patch_palmwatch.py and patch_explorers.py first.
Run from the repo root:  python3 patch_live_batch1.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "function addLivePlacesLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(text, old, new, where="map/app.js"):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


ISRIC = "https://maps.isric.org/mapserv?map=/map/{p}.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS={p}_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={{bbox-epsg-3857}}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true"
SOIL = [("soc", "Soil organic carbon"), ("ocd", "Organic carbon density"), ("nitrogen", "Nitrogen"),
        ("phh2o", "pH (water)"), ("cec", "Cation exchange capacity"), ("bdod", "Bulk density"),
        ("cfvo", "Coarse fragments"), ("clay", "Clay"), ("sand", "Sand"), ("silt", "Silt")]
soil_choices = ",\n".join(
    f'        {{ label: "{lab}, 0\\u20135 cm", tiles: "{ISRIC.format(p=p)}" }}' for p, lab in SOIL)
WW = "https://mazu.nceas.ucsb.edu/wastewater/{n}/{{z}}/{{x}}/{{y}}.png"
ww_choices = ",\n".join(f'        {{ label: "{lab}", tiles: "{WW.format(n=n)}" }}' for n, lab in (
    ("N_effluent", "Nitrogen in all wastewater"), ("N_effluent_treated", "From sewage treatment"),
    ("N_effluent_septic", "From septic systems"), ("N_effluent_open", "Untreated (open defecation)"),
    ("N_plumes", "Coastal nitrogen plumes")))

ROWS = f'''    {{ id: "wreckers_umap", name: "Wreckers of the Earth (Corporate Watch)", unit: "companies and sites", colour: "#6E5A55", route: "umap", ready: true, lazy: true,
      umap: "https://umap.openstreetmap.fr/en", umapId: 409815,
      note: "Read live from Corporate Watch's uMap each time it is ticked, with its own layers, colours and popups." }},
    {{ id: "mymaps_chlorine", name: "Google My Maps map (plastics and chlorine section)", unit: "placemarks", colour: "#5F6B70", route: "kml", ready: true, lazy: true,
      kml: "https://www.google.com/maps/d/kml?mid=1PwPKisRf73FPC6hTtZDCv2s_B6_x0Pk7&forcekml=1",
      note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." }},
    {{ id: "mymaps_trees", name: "Google My Maps map (trees section)", unit: "placemarks", colour: "#5F6E5C", route: "kml", ready: true, lazy: true,
      kml: "https://www.google.com/maps/d/kml?mid=1c-vPoGf79mfQezTgcFoKb-xN4A4&forcekml=1",
      note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." }},
    {{ id: "fractracker_refineries", name: "Global Oil Refinery Complexes (FracTracker)", unit: "refineries", colour: "#6A5E58", route: "arcgisapp", ready: true, lazy: true,
      item: "8e72a974af4c4fe9ba6875cee03078ee",
      note: "Read live from FracTracker's ArcGIS map: its own layers, fields and popups." }},
    {{ id: "arcgis_ym8xk", name: "ArcGIS map (vinyl chloride section)", unit: "places", colour: "#5E6070", route: "arcgisapp", ready: true, lazy: true,
      item: "b1b5b5e0d08c4024a50caa88e6442281",
      note: "Read live from the ArcGIS map linked on the Destruction page (arcg.is/ym8XK); the row takes its own title once it loads." }},
    {{ id: "arcgis_materialresearch", name: "ArcGIS map (materialresearch)", unit: "places", colour: "#665E6C", route: "arcgisapp", ready: true, lazy: true,
      item: "3ff82579637f4c7a96bd62d039ac3e00",
      note: "Read live from the ArcGIS experience linked on the Destruction page (arcg.is/4q8m4); the row takes its own title once it loads." }},
    {{ id: "glad_loss", name: "Global Forest Change: tree cover loss (UMD GLAD)", unit: "loss since 2000, 30 m", colour: "#8A4F46", route: "rasterlive", ready: true, lazy: true,
      attribution: "Hansen/UMD/Google/USGS/NASA", maxzoom: 12,
      choices: [{{ label: "Tree cover loss", tiles: "https://storage.googleapis.com/earthenginepartners-hansen/tiles/gfc_v1.12/loss_alpha/{{z}}/{{x}}/{{y}}.png" }}],
      note: "The published Global Forest Change tiles, read live." }},
    {{ id: "soilgrids", name: "SoilGrids (ISRIC)", unit: "soil properties, 250 m", colour: "#6B5A4A", route: "rasterlive", ready: true, lazy: true,
      attribution: "ISRIC SoilGrids (CC BY 4.0)", maxzoom: 14,
      choices: [
{soil_choices}
      ],
      note: "ISRIC's SoilGrids map server, read live. Each chip is one soil property at 0\\u20135 cm depth, as SoilGrids publishes it." }},
    {{ id: "wastewater", name: "Global Wastewater Model (Tuholske et al.)", unit: "nitrogen from human wastewater", colour: "#5E7377", route: "rasterlive", ready: true, lazy: true,
      attribution: "Tuholske et al. 2021, Global Wastewater Model", maxzoom: 10,
      choices: [
{ww_choices}
      ],
      note: "The model's published tiles, read live. Each chip is one of the model's own layers." }},
  ],
}};'''
anchor = '''Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." },
  ],
};'''
app = once(app, anchor, anchor.replace("\n  ],\n};", "") + "\n" + ROWS)

KINDS = {
    "wreckers_umap": ("insentient", "upstream"), "mymaps_chlorine": ("insentient", "upstream"),
    "mymaps_trees": ("plant", "downstream"), "fractracker_refineries": ("insentient", "upstream"),
    "arcgis_ym8xk": ("insentient", "upstream"), "arcgis_materialresearch": ("insentient", "upstream"),
    "glad_loss": ("plant", "downstream"), "soilgrids": ("microorganism", "downstream"),
    "wastewater": ("insentient", "downstream"),
}
app = once(app, '  usda_corn: ["plant", "downstream"],\n', '  usda_corn: ["plant", "downstream"],\n' +
           "".join(f'  {k}: ["{a}", "{b}"],\n' for k, (a, b) in KINDS.items()))

app = once(app, '    : cfg.route === "arcgis" ? Promise.resolve().then(() => addArcgisLayer(cfg))',
           '    : cfg.route === "arcgis" ? Promise.resolve().then(() => addArcgisLayer(cfg))\n'
           '    : cfg.route === "umap" || cfg.route === "kml" || cfg.route === "arcgisapp" ? addLivePlacesLayer(cfg)\n'
           '    : cfg.route === "rasterlive" ? Promise.resolve().then(() => addRasterChoiceLayer(cfg))')

# addSitemapLayer takes data already in hand.
app = once(app, """async function addSitemapLayer(cfg) {
  let data;
  try {""", """async function addSitemapLayer(cfg, given) {
  let data = given;
  if (!data) try {""")

JS = r'''/* ---------- places read live from another site: uMap, KML, ArcGIS ---------- */
// Each source is read when its row is ticked, turned into the same shape as the
// site's own maps (places plus boxes), and drawn by the same code, so it gets the
// same rows, filter chips, hover and boxes. Colours are the source's own, moved a
// little toward the atlas's muted range.
function softColour(c, fallback) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
  if (!m) return c ? String(c) : fallback;
  const n = parseInt(m[1], 16), g = [0x7A, 0x75, 0x6C];
  const mix = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * 0.7 + g[i] * 0.3));
  return "#" + mix.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function relabelRow(id, title) {
  if (!title) return;
  const box = document.getElementById("layers");
  const row = box && box.querySelector && box.querySelector(`[data-layer="${id}"]`);
  const nm = row && row.closest && row.closest("label") && row.closest("label").querySelector(".nm");
  if (nm) nm.textContent = title;
}

// items: [{ geometry, key, name, colour, group, h, t }]
function livePlacesToSitemap(cfg, items) {
  const groups = new Map();
  const features = [], boxes = {};
  for (const it of items) {
    if (!it.geometry) continue;
    const g = it.group || "";
    if (g) groups.set(g, (groups.get(g) || 0) + 1);
    features.push({ type: "Feature", geometry: it.geometry,
      properties: { k: it.key, p: 1, t: it.name ? 1 : 0, n: it.name || "", c: softColour(it.colour, cfg.colour),
                    f: g ? `|g:${g}|` : "" } });
    if (!boxes[it.key]) boxes[it.key] = { h: it.h, t: it.name ? `<b>${escapeHtml(it.name)}</b>` : "", o: { maxWidth: 340, maxHeight: 420 } };
  }
  const filters = groups.size > 1
    ? [{ label: "Layer", values: [...groups].map(([g, n]) => ({ k: `g:${g}`, label: g, n })) }] : [];
  return { data: { type: "FeatureCollection", filters, features },
           boxes: { name: cfg.name, css: "", stylesheets: [], chain: [], boxes } };
}

async function addLivePlacesLayer(cfg) {
  let got;
  try {
    got = cfg.route === "umap" ? await readUmap(cfg)
        : cfg.route === "kml" ? await readKml(cfg)
        : await readArcgisApp(cfg);
  } catch (e) {
    setLayerState(cfg.id, `the source did not answer (${e.message})`);
    console.error(`[culprits] ${cfg.id}: ${e.message}`);
    return;
  }
  relabelRow(cfg.id, got.title);
  const { data, boxes } = livePlacesToSitemap(cfg, got.items);
  sitemapBoxes.set(cfg.id, Promise.resolve(boxes));
  await addSitemapLayer(cfg, data);
  if (got.note) setLayerState(cfg.id, `${data.features.length.toLocaleString()} ${cfg.unit} \u00b7 ${got.note}`);
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} at ${url}`);
  return r.json();
}

// uMap: the map's settings name its layers; each layer is its own GeoJSON.
function umapText(s) {
  return escapeHtml(String(s == null ? "" : s))
    .replace(/\{\{(https?:[^|}]+)(?:\|[^}]*)?\}\}/g, '<img src="$1" style="max-width:100%">')
    .replace(/\[\[(https?:[^|\]]+)\|([^\]]+)\]\]/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
    .replace(/\[\[(https?:[^\]]+)\]\]/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
}
async function readUmap(cfg) {
  const m = await getJson(`${cfg.umap}/map/${cfg.umapId}/geojson/`);
  const props = m.properties || {};
  const layers = props.datalayers || m.datalayers || [];
  const items = [];
  for (const dl of layers) {
    const id = dl.id || dl.uuid || (dl.settings && dl.settings.id);
    let gj = null;
    for (const u of [`${cfg.umap}/datalayer/${cfg.umapId}/${id}/`, `${cfg.umap}/datalayer/${id}/`]) {
      try { gj = await getJson(u); break; } catch (e) { /* try the older address */ }
    }
    if (!gj) continue;
    const opts = gj._umap_options || dl._umap_options || dl.settings || {};
    const group = opts.name || dl.name || "";
    (gj.features || []).forEach((f, i) => {
      const p = f.properties || {};
      const o = p._umap_options || {};
      items.push({ geometry: f.geometry, key: `${id}:${f.id || p.id || i}`, name: p.name || "", group,
        colour: o.color || opts.color || (props.color || null),
        h: `<div style="font:13px/1.4 system-ui,sans-serif;max-width:320px"><h4 style="margin:0 0 6px">${escapeHtml(p.name || "")}</h4>` +
           `<div>${umapText(p.description)}</div></div>` });
    });
  }
  return { title: props.name || cfg.name, items };
}

// KML (Google My Maps): placemarks with their folder, style colour and data.
function kmlColour(doc, styleUrl) {
  if (!styleUrl) return null;
  const id = styleUrl.replace(/^#/, "");
  let style = [...doc.getElementsByTagName("Style")].find((s) => s.getAttribute("id") === id);
  if (!style) {
    const map_ = [...doc.getElementsByTagName("StyleMap")].find((s) => s.getAttribute("id") === id);
    const pair = map_ && [...map_.getElementsByTagName("Pair")].find((p) => (p.getElementsByTagName("key")[0] || {}).textContent === "normal");
    const inner = pair && (pair.getElementsByTagName("styleUrl")[0] || {}).textContent;
    if (inner) style = [...doc.getElementsByTagName("Style")].find((s) => s.getAttribute("id") === inner.replace(/^#/, ""));
  }
  const c = style && (style.getElementsByTagName("color")[0] || {}).textContent;
  if (c && /^[0-9a-f]{8}$/i.test(c.trim())) { const t = c.trim(); return `#${t.slice(6, 8)}${t.slice(4, 6)}${t.slice(2, 4)}`; }
  const m = /-([0-9A-F]{6})(?:-|$)/i.exec(id);
  return m ? `#${m[1]}` : null;
}
function kmlCoords(el) {
  return String((el.getElementsByTagName("coordinates")[0] || {}).textContent || "").trim().split(/\s+/)
    .map((t) => t.split(",").map(Number)).filter((c) => c.length >= 2 && isFinite(c[0]) && isFinite(c[1])).map((c) => [c[0], c[1]]);
}
function kmlGeometries(pm) {
  const out = [];
  for (const p of pm.getElementsByTagName("Point")) { const c = kmlCoords(p)[0]; if (c) out.push({ type: "Point", coordinates: c }); }
  for (const l of pm.getElementsByTagName("LineString")) { const c = kmlCoords(l); if (c.length > 1) out.push({ type: "LineString", coordinates: c }); }
  for (const g of pm.getElementsByTagName("Polygon")) {
    const outer = g.getElementsByTagName("outerBoundaryIs")[0];
    const rings = [outer, ...g.getElementsByTagName("innerBoundaryIs")].filter(Boolean).map(kmlCoords).filter((r) => r.length > 3);
    if (rings.length) out.push({ type: "Polygon", coordinates: rings });
  }
  return out;
}
async function readKml(cfg) {
  const r = await fetch(cfg.kml);
  if (!r.ok) throw new Error(`${r.status} from Google`);
  const doc = new DOMParser().parseFromString(await r.text(), "application/xml");
  const docName = (doc.querySelector("Document > name") || {}).textContent || "";
  const items = [];
  [...doc.getElementsByTagName("Placemark")].forEach((pm, i) => {
    const kid = (tag) => { const el = [...pm.children].find((c) => c.tagName === tag); return el ? el.textContent : ""; };
    const folder = pm.parentElement && pm.parentElement.tagName === "Folder"
      ? ([...pm.parentElement.children].find((c) => c.tagName === "name") || {}).textContent || "" : "";
    const data = [...pm.getElementsByTagName("Data")].map((d) =>
      [d.getAttribute("name"), (d.getElementsByTagName("value")[0] || {}).textContent || ""]).filter(([, v]) => v);
    const name = kid("name").trim();
    const desc = kid("description");
    // My Maps repeats the data fields in the description; show the description as written.
    const h = `<div style="font:13px/1.4 system-ui,sans-serif;max-width:320px"><h4 style="margin:0 0 6px">${escapeHtml(name)}</h4>` +
      (desc ? `<div>${desc}</div>` : data.map(([k, v]) => `<div><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</div>`).join("")) + `</div>`;
    const colour = kmlColour(doc, kid("styleUrl").trim());
    kmlGeometries(pm).forEach((g, j) => items.push({ geometry: g, key: `pm${i}`, name, group: folder, colour, h }));
  });
  return { title: docName.trim() || cfg.name, items };
}

// ArcGIS: an app (web app, experience) names its web map; the web map names its
// layers and how each shows a clicked feature. Every feature is read.
const AGOL = "https://www.arcgis.com/sharing/rest/content/items";
async function arcgisWebmapsOf(itemId, seen = new Set()) {
  if (seen.has(itemId) || seen.size > 12) return [];
  seen.add(itemId);
  const info = await getJson(`${AGOL}/${itemId}?f=json`);
  if (info.error) throw new Error(info.error.message || "item not shared publicly");
  if (info.type === "Web Map") return [{ id: itemId, title: info.title }];
  if (info.type === "Feature Service" || info.type === "Map Service") return [{ service: info.url, title: info.title }];
  let text = "";
  try { text = await (await fetch(`${AGOL}/${itemId}/data?f=json`)).text(); } catch (e) { /* no data */ }
  const ids = [...new Set((text.match(/\b[0-9a-f]{32}\b/g) || []).filter((x) => x !== itemId))];
  const out = [];
  for (const id of ids) {
    try { out.push(...(await arcgisWebmapsOf(id, seen))); } catch (e) { /* not public or not a map */ }
  }
  if (!out.length) throw new Error("no public web map found in this app");
  out.title = info.title;
  return out;
}
function arcgisLayersOf(ops, out = []) {
  for (const l of ops || []) {
    if (l.layers && !l.url) arcgisLayersOf(l.layers, out);
    else if (l.url) out.push(l);
  }
  return out;
}
async function arcgisQueryAll(url) {
  const feats = [];
  for (let offset = 0; offset < 100000; offset += 2000) {
    const q = `${url}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=2000`;
    const j = await getJson(q);
    if (j.error) throw new Error(j.error.message || "query refused");
    feats.push(...(j.features || []));
    const more = j.exceededTransferLimit || (j.properties && j.properties.exceededTransferLimit);
    if (!more || !(j.features || []).length) break;
  }
  return feats;
}
function arcgisFill(template, attrs) {
  return String(template || "").replace(/\{([^}]+)\}/g, (all, k) => attrs[k] != null ? String(attrs[k]) : "");
}
function arcgisPopupHtml(title, info, attrs) {
  if (info && info.description) {
    return `<div style="font:13px/1.4 system-ui,sans-serif;max-width:320px"><h4 style="margin:0 0 6px">${escapeHtml(arcgisFill(info.title, attrs) || title)}</h4>` +
      `${arcgisFill(info.description, attrs)}</div>`;
  }
  const fields = info && info.fieldInfos
    ? info.fieldInfos.filter((f) => f.visible !== false).map((f) => [f.label || f.fieldName, attrs[f.fieldName]])
    : Object.entries(attrs).filter(([k]) => !/^(objectid|fid|shape)/i.test(k));
  return `<div style="font:13px/1.4 system-ui,sans-serif;max-width:320px"><h4 style="margin:0 0 6px">${escapeHtml(info ? arcgisFill(info.title, attrs) : title)}</h4>` +
    fields.filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `<div><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</div>`).join("") + `</div>`;
}
function arcgisSymbolColour(def, attrs) {
  const r = def && def.drawingInfo && def.drawingInfo.renderer;
  if (!r) return null;
  let sym = r.symbol;
  if (r.uniqueValueInfos && r.field1) {
    const hit = r.uniqueValueInfos.find((u) => String(u.value) === String(attrs[r.field1]));
    sym = (hit && hit.symbol) || r.defaultSymbol || sym;
  }
  const c = sym && sym.color;
  return Array.isArray(c) ? "#" + c.slice(0, 3).map((v) => Number(v).toString(16).padStart(2, "0")).join("") : null;
}
async function readArcgisApp(cfg) {
  const maps = await arcgisWebmapsOf(cfg.item);
  const items = [];
  let title = maps.title || (maps[0] && maps[0].title) || cfg.name;
  let skipped = 0;
  for (const wm of maps) {
    let layers = [];
    if (wm.service) {
      const s = await getJson(`${wm.service}?f=json`);
      layers = (s.layers || []).map((l) => ({ url: `${wm.service}/${l.id}`, title: l.name }));
    } else {
      const d = await getJson(`${AGOL}/${wm.id}/data?f=json`);
      for (const l of arcgisLayersOf(d.operationalLayers)) {
        if (/\/(FeatureServer|MapServer)\/\d+\/?$/.test(l.url)) layers.push(l);
        else {
          try {
            const s = await getJson(`${l.url.replace(/\/$/, "")}?f=json`);
            (s.layers || []).forEach((x) => layers.push({ url: `${l.url.replace(/\/$/, "")}/${x.id}`, title: `${l.title}: ${x.name}`, popupInfo: l.popupInfo, layerDefinition: l.layerDefinition }));
          } catch (e) { skipped++; }
        }
      }
    }
    for (const l of layers) {
      let feats;
      try { feats = await arcgisQueryAll(l.url.replace(/\/$/, "")); } catch (e) { skipped++; continue; }
      feats.forEach((f, i) => {
        const a = f.properties || {};
        const oid = a.OBJECTID != null ? a.OBJECTID : a.FID != null ? a.FID : i;
        const info = l.popupInfo;
        const name = info && info.title ? arcgisFill(info.title, a) : (a.Name || a.NAME || a.name || "");
        items.push({ geometry: f.geometry, key: `${l.url}|${oid}`, name, group: l.title || "",
          colour: arcgisSymbolColour(l.layerDefinition, a), h: arcgisPopupHtml(l.title || title, info, a) });
      });
    }
  }
  return { title, items, note: skipped ? `${skipped} layer${skipped > 1 ? "s" : ""} of the map would not answer` : "" };
}

/* ---------- pictures read live, with a choice of the source's own layers ---------- */
function addRasterChoiceLayer(cfg) {
  const src = `${cfg.id}-img`;
  cfg._pick = cfg._pick || 0;
  map.addSource(src, { type: "raster", tileSize: 256, maxzoom: cfg.maxzoom || 12,
    attribution: cfg.attribution || "", tiles: [cfg.choices[cfg._pick].tiles] });
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: src,
    paint: { "raster-opacity": 0.8, "raster-saturation": -0.35 } });
  let failed = 0;
  map.on("error", (e) => {
    if (e && e.sourceId === src) {
      failed++;
      setLayerState(cfg.id, `${cfg.choices[cfg._pick].label}: the source did not answer for ${failed} square${failed > 1 ? "s" : ""}`);
    }
  });
  if (cfg.choices.length > 1) rasterChoiceRow(cfg);
  setLayerState(cfg.id, `${cfg.choices[cfg._pick].label} \u00b7 live`);
  applyVisibility(cfg.id);
  buildLegend();
}
function rasterChoiceRow(cfg) {
  const box = document.getElementById("layers");
  const row = box && box.querySelector && box.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (!anchor || !document.createElement || box.querySelector(`.facet[data-raster-for="${cfg.id}"]`)) return;
  const el = document.createElement("div");
  el.className = "facet";
  el.dataset.rasterFor = cfg.id;
  el.innerHTML = cfg.choices.map((c, i) =>
    `<button type="button" class="chip${i === cfg._pick ? " on" : ""}" data-rc="${cfg.id}" data-ri="${i}">${escapeHtml(c.label)}</button>`).join("");
  if (anchor.after) anchor.after(el);
}
function rasterChoiceClicked(btn) {
  const cfg = childById(btn.dataset.rc);
  if (!cfg) return;
  cfg._pick = Number(btn.dataset.ri) || 0;
  const s = map.getSource(`${cfg.id}-img`);
  if (s && s.setTiles) s.setTiles([cfg.choices[cfg._pick].tiles]);
  const box = document.getElementById("layers");
  const row = box && box.querySelector(`.facet[data-raster-for="${cfg.id}"]`);
  if (row) for (const c of row.querySelectorAll("[data-ri]")) c.classList.toggle("on", Number(c.dataset.ri) === cfg._pick);
  setLayerState(cfg.id, `${cfg.choices[cfg._pick].label} \u00b7 live`);
}

/* ---------- the sky the map sits in ---------- */'''
app = once(app, "/* ---------- the sky the map sits in ---------- */", JS)
app = once(app, "    if (btn.dataset.smc) { sitemapColourClicked(btn); return; }",
           "    if (btn.dataset.rc) { rasterChoiceClicked(btn); return; }\n"
           "    if (btn.dataset.smc) { sitemapColourClicked(btn); return; }")

TESTS = r'''
console.log("\nlive maps from the Destruction page, batch 1");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  for (const id of ["wreckers_umap", "mymaps_chlorine", "mymaps_trees", "fractracker_refineries", "arcgis_ym8xk",
                    "arcgis_materialresearch", "glad_loss", "soilgrids", "wastewater"]) {
    check(`${id} is a row in Other organisations' maps`, new RegExp(`id: "${id}"`).test(src));
  }
  check("none of them goes through the Worker", !/id: "(wreckers_umap|mymaps_|fractracker|arcgis_|glad_loss|soilgrids|wastewater)[^\n]*WORKER/.test(src));
  check("the places are drawn by the site maps' own code", /await addSitemapLayer\(cfg, data\)/.test(src) &&
        /async function addSitemapLayer\(cfg, given\)/.test(src));
  check("every place can be clicked and named in a pick-list", /properties: \{ k: it\.key, p: 1, t: it\.name \? 1 : 0, n: it\.name/.test(src));
  const soft = new Function(src.slice(src.indexOf("function softColour("), src.indexOf("function relabelRow(")) + "; return softColour;")();
  check("a source's bright colour is moved toward the atlas's range", soft("#FF0000", "#000") === "#d72320");
  check("a named colour is left as the source wrote it", soft("DarkRed", "#000") === "DarkRed");
  const fill = new Function(src.slice(src.indexOf("function arcgisFill("), src.indexOf("function arcgisPopupHtml(")) + "; return arcgisFill;")();
  check("an ArcGIS popup title fills its fields", fill("{NAME} ({CAP} bpd)", { NAME: "Jamnagar", CAP: 1240000 }) === "Jamnagar (1240000 bpd)");
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const umapText = new Function("escapeHtml", src.slice(src.indexOf("function umapText("), src.indexOf("async function readUmap(")) + "; return umapText;")(esc);
  check("uMap links and bold are kept", umapText("**Shell**\n[[https://x.org|site]]") === '<b>Shell</b><br><a href="https://x.org" target="_blank" rel="noopener">site</a>');
  check("SoilGrids offers every property it publishes at the top depth", (src.match(/_0-5cm_mean/g) || []).length === 10);
  check("the wastewater model offers its five layers", (src.match(/mazu\.nceas\.ucsb\.edu\/wastewater\//g) || []).length === 5);
  check("a picture that fails says so on its row", /the source did not answer for \$\{failed\} square/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Added batch 1 of the live maps. Test with: node map/test.mjs")
