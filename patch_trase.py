#!/usr/bin/env python3
"""
1. Trase's regional measures, as one row in "Other organisations' maps".
   Under the row, four menus, as on Trase's own map: country, region level,
   measure and year. Every measure Trase publishes for every country, level and
   year is offered (its own list, reread weekly by culprits-tiles-more). Region
   shapes are read live from Trase; values come from the weekly copy, because
   Trase does not let other sites read them. A click gives the region, the value
   with its unit, and Trase's own description and citation for the measure.
2. Coral reef habitat at world zoom. The Atlas's server cannot draw a picture
   wider than about zoom 6 (it runs out of time), so wider out the row now shows
   UNEP-WCMC's reef map in the same colour, and says so; from 6 in, the Atlas's
   own picture; from 12 in, its clickable shapes.

Run from the repo root:  python3 patch_trase.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function addTraseLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
UNEP = "https://data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/MapServer"

# --- coral at world zoom -----------------------------------------------------
once("""  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: `${cfg.id}-wide`, maxzoom: cfg.drawFrom,
    layout: { visibility: "none" }, paint: { "raster-opacity": 0.9 } });""",
f"""  map.addLayer({{ id: `${{cfg.id}}-raster`, type: "raster", source: `${{cfg.id}}-wide`, maxzoom: cfg.drawFrom,
    minzoom: CORAL_ATLAS_PICTURE_FROM, layout: {{ visibility: "none" }}, paint: {{ "raster-opacity": 0.9 }} }});
  // Wider still, the Atlas's server runs out of time drawing so much reef, so
  // UNEP-WCMC's reef map stands in, in the same colour, and the row says so.
  map.addSource(`${{cfg.id}}-globe`, {{ type: "raster", tileSize: 256,
    attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC",
    tiles: [`tint://${{CORAL_CLASSES["Coral/Algae"].slice(1)}}/{UNEP.replace("https://", "")}/export` +
            `?bbox={{bbox-epsg-3857}}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`] }});
  map.addLayer({{ id: `${{cfg.id}}-world`, type: "raster", source: `${{cfg.id}}-globe`, maxzoom: CORAL_ATLAS_PICTURE_FROM,
    layout: {{ visibility: "none" }}, paint: {{ "raster-opacity": 0.9 }} }});""")
once("""      setLayerState(cfg.id, `the Atlas's picture of the reefs — zoom in to ${cfg.drawFrom} for each habitat zone and its box`);""",
"""      setLayerState(cfg.id, map.getZoom() < CORAL_ATLAS_PICTURE_FROM
        ? `UNEP-WCMC's reef map at this width (the Atlas cannot draw this much); the Atlas's own from zoom ${CORAL_ATLAS_PICTURE_FROM} — zoom in to ${cfg.drawFrom} for each habitat zone and its box`
        : `the Atlas's picture of the reefs — zoom in to ${cfg.drawFrom} for each habitat zone and its box`);""")
once("function addCoralLayer(cfg) {", "const CORAL_ATLAS_PICTURE_FROM = 6;\nfunction addCoralLayer(cfg) {")
once("[`${id}-agg`, `${id}-pt`, `${id}-fill`, `${id}-line`, `${id}-raster`, `${id}-cap`].forEach((l) => {",
     "[`${id}-agg`, `${id}-pt`, `${id}-fill`, `${id}-line`, `${id}-raster`, `${id}-world`, `${id}-cap`].forEach((l) => {")

# --- the Trase row -------------------------------------------------------------
ROW = f'''    {{ id: "trase", name: "Trase: deforestation and supply-chain measures", unit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
      catalogue: "{HOME}/trase/catalogue.json", values: "{HOME}/trase/values",
      regions: "https://resources.trase.earth/data/trase-regions",
      attribution: "Trase (CC BY 4.0)",
      note: "Trase's own measures for every country, region level and year it publishes. Region shapes are read live from Trase; the values come from a copy reread weekly, because Trase does not let other sites read them." }},
'''
once('''    { id: "unep_coral",''', ROW + '''    { id: "unep_coral",''')
once('  unep_coral: ["animal", "downstream"],\n', '  unep_coral: ["animal", "downstream"],\n  trase: ["plant", "downstream"],\n')
once('''    : cfg.route === "rasterlive" ? Promise.resolve().then(() => addRasterChoiceLayer(cfg))''',
     '''    : cfg.route === "rasterlive" ? Promise.resolve().then(() => addRasterChoiceLayer(cfg))
    : cfg.route === "trase" ? addTraseLayer(cfg)''')

JS = r'''/* ---------- Trase: a measure per region, chosen as on Trase's own map ---------- */
const TRASE_RAMPS = {
  red: ["#E3D8D2", "#CDAEA4", "#B07F72", "#8C5548", "#643129"],
  blue: ["#D9DEE0", "#B3C0C6", "#8A9DA6", "#627A86", "#3F5663"],
  bluered: ["#3F5663", "#8A9DA6", "#DAD6CF", "#B07F72", "#643129"],
};
const traseCache = new Map();
function traseJson(url) {
  if (!traseCache.has(url)) {
    const p = fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status} at ${url}`); return r.json(); });
    p.catch(() => traseCache.delete(url));
    traseCache.set(url, p);
  }
  return traseCache.get(url);
}
function traseSlug(name) {
  return String(name || "").toLowerCase().replace(/'/g, " ").trim().replace(/\s+/g, "-");
}
// Five steps from the values themselves, so a few very large regions do not
// wash the rest into one colour.
function traseBreaks(values) {
  const v = values.filter((x) => typeof x === "number" && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return [];
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return [...new Set([q(0.2), q(0.4), q(0.6), q(0.8)])];
}
function traseFormat(x) {
  if (typeof x !== "number") return String(x);
  return Math.abs(x) >= 100 ? Math.round(x).toLocaleString() : x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function addTraseLayer(cfg) {
  let cat, regions;
  try {
    [cat, regions] = await Promise.all([traseJson(cfg.catalogue), traseJson(`${cfg.regions}/metadata.json`)]);
  } catch (e) {
    setLayerState(cfg.id, `not built yet (${e.message})`);
    return;
  }
  cfg._cat = cat.countries || {};
  cfg._regions = regions;
  const countries = Object.keys(cfg._cat).sort();
  const pick = cfg._pick = cfg._pick || {};
  pick.country = pick.country && cfg._cat[pick.country] ? pick.country : (cfg._cat.brazil ? "brazil" : countries[0]);
  map.addSource(`${cfg.id}-shapes`, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: cfg.attribution });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-shapes`,
    paint: { "fill-color": ["coalesce", ["get", "_c"], "rgba(0,0,0,0)"], "fill-opacity": 0.72 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-shapes`,
    paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
  bindHtmlPopup(`${cfg.id}-fill`, (p) => traseBox(cfg, p));
  traseMenus(cfg);
  await traseDraw(cfg);
  applyVisibility(cfg.id);
  buildLegend();
}

function traseLevelOk(cfg) {
  const p = cfg._pick, levels = cfg._cat[p.country].levels;
  if (!levels[p.level]) p.level = levels.municipality ? "municipality" : Object.keys(levels)[0];
  const metrics = levels[p.level].metrics;
  if (!metrics[p.metric]) {
    p.metric = Object.keys(metrics).sort((a, b) => (Number(metrics[a].display_order) || 999) - (Number(metrics[b].display_order) || 999))[0];
  }
  const years = metrics[p.metric].years || [];
  if (!years.includes(p.year)) p.year = years[years.length - 1];
}

function traseMenus(cfg) {
  const box = document.getElementById("layers");
  const row = box && box.querySelector && box.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (!anchor || !document.createElement) return;
  let el = box.querySelector(`.facet[data-trase-for="${cfg.id}"]`);
  if (!el) {
    el = document.createElement("div");
    el.className = "facet trase-menus";
    el.dataset.traseFor = cfg.id;
    if (anchor.after) anchor.after(el);
  }
  traseLevelOk(cfg);
  const p = cfg._pick, c = cfg._cat[p.country], lv = c.levels[p.level], m = lv.metrics[p.metric];
  const opt = (v, label, on) => `<option value="${escapeHtml(v)}"${on ? " selected" : ""}>${escapeHtml(label)}</option>`;
  const byOrder = (ms) => Object.keys(ms).sort((a, b) => (Number(ms[a].display_order) || 999) - (Number(ms[b].display_order) || 999));
  el.innerHTML =
    `<select data-tr="country" aria-label="Country">${Object.keys(cfg._cat).sort().map((k) => opt(k, cfg._cat[k].name, k === p.country)).join("")}</select>` +
    `<select data-tr="level" aria-label="Region level">${Object.keys(c.levels).map((k) => opt(k, c.levels[k].name, k === p.level)).join("")}</select>` +
    `<select data-tr="metric" aria-label="Measure">${byOrder(lv.metrics).map((k) => opt(k, (lv.metrics[k].metric_group ? lv.metrics[k].metric_group + ": " : "") + (lv.metrics[k].display_name || k), k === p.metric)).join("")}</select>` +
    `<select data-tr="year" aria-label="Year">${(m.years || []).map((y) => opt(y, y, y === p.year)).join("")}</select>` +
    `<div class="sm-legend" data-trase-legend></div>`;
  for (const s of el.querySelectorAll ? el.querySelectorAll("select") : []) {
    s.addEventListener("change", () => {
      const k = s.dataset.tr;
      p[k] = k === "year" ? Number(s.value) : s.value;
      traseMenus(cfg);
      traseDraw(cfg).catch((e) => setLayerState(cfg.id, `could not draw (${e.message})`));
    });
  }
}

function traseRegionFile(cfg) {
  const p = cfg._pick, name = cfg._cat[p.country].name;
  const hits = (cfg._regions || []).filter((r) => traseSlug(r.country) === p.country && r.node_type_slug === p.level);
  const hit = hits.find((r) => p.year >= Number(r.year_start) && p.year <= Number(r.year_end)) || hits[0];
  return hit ? `${cfg.regions}/${hit.endpoint_geojson}` : null;
}

async function traseDraw(cfg) {
  const p = cfg._pick, m = cfg._cat[p.country].levels[p.level].metrics[p.metric];
  const file = traseRegionFile(cfg);
  if (!file) { setLayerState(cfg.id, "Trase publishes no shapes for this level"); return; }
  setLayerState(cfg.id, "loading from Trase\u2026");
  const [shapes, values] = await Promise.all([traseJson(file), traseJson(`${cfg.values}/${p.country}/${p.level}/${p.metric}.json`)]);
  const yr = values[String(p.year)] || {};
  const ids = new Set(Object.keys(yr));
  // Which field of the shapes holds Trase's region id: the one whose values are keys of the data.
  let idKey = null;
  for (const f of (shapes.features || []).slice(0, 50)) {
    idKey = Object.keys(f.properties || {}).find((k) => ids.has(String(f.properties[k])));
    if (idKey) break;
  }
  const ramp = TRASE_RAMPS[m.color_scheme] || TRASE_RAMPS.red;
  const breaks = traseBreaks(Object.values(yr));
  const colourOf = (v) => {
    if (typeof v !== "number") return null;
    let i = 0;
    while (i < breaks.length && v >= breaks[i]) i++;
    return ramp[Math.min(i + (ramp.length - 1 - breaks.length), ramp.length - 1)];
  };
  let shown = 0;
  const features = (shapes.features || []).map((f) => {
    const id = idKey ? String(f.properties[idKey]) : "";
    const v = yr[id];
    if (v !== undefined) shown++;
    return { type: "Feature", geometry: f.geometry,
      properties: Object.assign({}, f.properties, { _id: id, _v: v === undefined ? null : v, _c: colourOf(v) }) };
  });
  map.getSource(`${cfg.id}-shapes`).setData({ type: "FeatureCollection", features });
  const legend = document.querySelector(`[data-trase-for="${cfg.id}"] [data-trase-legend]`);
  if (legend) {
    const edges = [null, ...breaks];
    legend.innerHTML = edges.map((b, i) => `<span class="sm-key"><i style="background:${ramp[i + (ramp.length - 1 - breaks.length)]}"></i>` +
      `${b === null ? "below " + traseFormat(breaks[0] ?? 0) : "from " + traseFormat(b)}</span>`).join("") +
      ` <span class="sm-key">${escapeHtml(m.unit_abbreviation || m.unit || "")}</span>`;
  }
  setLayerState(cfg.id, `${shown.toLocaleString()} regions \u00b7 ${m.display_name || p.metric}, ${p.year}`);
}

function traseBox(cfg, props) {
  const p = cfg._pick, m = cfg._cat[p.country].levels[p.level].metrics[p.metric];
  const name = props.name || props.region || props.NAME || props.nome || props._id;
  const v = props._v;
  return `<b>${escapeHtml(name)}</b>` +
    `<div class="meta">${escapeHtml(m.display_name || p.metric)}, ${p.year}: ` +
    `${v === null || v === undefined || v === "null" ? "no value published" : escapeHtml(traseFormat(Number(v)))} ${escapeHtml(m.unit_abbreviation || "")}</div>` +
    (m.tooltip && m.tooltip !== "." ? `<div class="meta">${escapeHtml(m.tooltip)}</div>` : "") +
    (m.data_source ? `<div class="meta">Source: ${escapeHtml(m.data_source)}</div>` : "") +
    (m.citation ? `<div class="meta">${escapeHtml(m.citation)}</div>` : "") +
    `<div class="meta"><a href="https://trase.earth/explore/spatial-data/map?country=${encodeURIComponent(p.country)}" target="_blank" rel="noopener">Open on Trase</a></div>`;
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nTrase, and coral at world zoom");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("Trase is one row with its own menus", /id: "trase"[^\n]*route: "trase"/.test(src) && /data-tr="metric"/.test(src) && /data-tr="year"/.test(src));
  check("its shapes are read live from Trase", /regions: "https:\/\/resources\.trase\.earth\/data\/trase-regions"/.test(src));
  check("its values come from the weekly GitHub copy", /catalogue: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/trase\/catalogue\.json"/.test(src));
  const slug = new Function(src.slice(src.indexOf("function traseSlug("), src.indexOf("// Five steps from the values")) + "; return traseSlug;")();
  check("Trase's country names match its slugs", slug("COTE D'IVOIRE") === "cote-d-ivoire" && slug("BRAZIL") === "brazil");
  const br = new Function(src.slice(src.indexOf("function traseBreaks("), src.indexOf("function traseFormat(")) + "; return traseBreaks;")();
  check("steps come from the values themselves", JSON.stringify(br([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) === "[3,5,7,9]");
  check("the ramps carry no orange or yellow", !/#(F[A-F0-9]{5}|E[6-9A-F][0-9A-F]{2}[0-4][0-9A-F])/i.test(src.slice(src.indexOf("const TRASE_RAMPS"), src.indexOf("const traseCache"))));
  check("wider than zoom 6, coral shows UNEP-WCMC's map in the Atlas colour",
        /id: `\$\{cfg\.id\}-world`, type: "raster", source: `\$\{cfg\.id\}-globe`, maxzoom: CORAL_ATLAS_PICTURE_FROM/.test(src) &&
        /tint:\/\/\$\{CORAL_CLASSES\["Coral\/Algae"\]\.slice\(1\)\}\/data-gis\.unep-wcmc\.org/.test(src));
  check("…and the row says whose map it is", /UNEP-WCMC's reef map at this width/.test(src));
  check("the switch reaches the world layer", /`\$\{id\}-world`/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Added Trase and coral at world zoom. Test with: node map/test.mjs")
