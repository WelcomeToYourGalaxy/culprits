#!/usr/bin/env python3
"""
Step 1 of the option-2 work order: the simple popup maps, each shown as its
own map.

- Each site map is one panel row under the map's own name (build_boxes.py sets
  the names from the maps themselves).
- A click opens that map's own box: its popup HTML as the map wrote it, styled
  by the map's own stylesheet, inside the same elements it sits in on its page.
- Where several places are under the click, a short list comes first; picking
  one opens its box.
- Places load when the row is ticked (small files); boxes load on the first
  click, not with the places.
- The cartel map's connecting lines are drawn with its places again, so the
  separate "connecting lines" row is removed.

Edits map/app.js, map/index.html, map/test.mjs, pipeline/sitemaps/build.sh and
pipeline/sitemaps/move_to_tile_repos.sh. Every edit is anchored on exact text;
if an anchor is missing nothing is written.

Run from the repo root:  python3 patch_sitemaps.py
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
BUILD, MOVE = ROOT / "pipeline" / "sitemaps" / "build.sh", ROOT / "pipeline" / "sitemaps" / "move_to_tile_repos.sh"
REG = json.loads((ROOT / "pipeline" / "sitemaps" / "registry.json").read_text())["maps"]
HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
KEEP_AS_IS = {"carbon_majors", "site_environment_law"}

app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
build, move = BUILD.read_text(encoding="utf-8"), MOVE.read_text(encoding="utf-8")

if "async function addSitemapLayer(" in app:
    sys.exit("app.js already has the site-map boxes — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- the rows

ids = [m["id"] for m in REG if m["id"] not in KEEP_AS_IS]
for sid in ids:
    pat = re.compile(r'(\{ id: "' + re.escape(sid) + r'", name: "(?:[^"\\]|\\.)*", unit: "[^"]*", colour: "[^"]*", )'
                     r'route: "pmtiles", ready: true, lazy: true, archiveUrl: "[^"]*"')
    app, k = pat.subn(lambda m: m.group(1) + f'route: "sitemap", ready: true, lazy: true, dataUrl: "{HOME}/sitemaps/{sid}.places.geojson"', app)
    if k != 1:
        sys.exit(f"Could not find the row for {sid} in map/app.js. Nothing was written.")

cartel_lines = re.compile(r'\n    \{ id: "site_cartel_lines", [^\n]*\n      note: "[^"]*" \},')
app, k = cartel_lines.subn("", app)
if k != 1:
    sys.exit("Could not find the cartel connecting-lines row in map/app.js. Nothing was written.")
app = once(app, """      note: "From the Suppression page's cartel cells map (maps repo). Its 238 connecting lines are not drawn in this layer, only the places." },""",
           """      note: "From the Suppression page's cartel cells map (maps repo), with its connecting lines." },""", "map/app.js")

app = once(app, """const SITE_MAPS = {
  id: "site_maps",
  name: "The site's other maps",""", """const SITE_MAPS = {
  id: "site_maps",
  name: "The site's own maps",""", "map/app.js")

# ---------------------------------------------------------------- dispatch

app = once(app, """    : cfg.route === "shapes" ? addShapesLayer(cfg)
    : addPmtilesLayer(cfg);""", """    : cfg.route === "shapes" ? addShapesLayer(cfg)
    : cfg.route === "sitemap" ? addSitemapLayer(cfg)
    : addPmtilesLayer(cfg);""", "map/app.js")

# A facet on a group child (a site map's own overlays) must find its layer.
app = once(app, """    const btn = e.target.closest(".chip");
    if (!btn) return;
    const cfg = LAYERS.find((l) => l.id === btn.dataset.facet);""", """    const btn = e.target.closest(".chip");
    if (!btn) return;
    const cfg = LAYERS.find((l) => l.id === btn.dataset.facet) || childById(btn.dataset.facet);""", "map/app.js")

# ---------------------------------------------------------------- the layer and its boxes

SITEMAP_JS = r'''
/* ---------- the site's own maps, each shown as its own map ---------- */

// Built by pipeline/sitemaps/build_boxes.py. Two files per map:
//   <id>.places.geojson  every place, with the marker's own size and colour
//                        (softened) and the overlay it belongs to, if any
//   <id>.boxes.json      each place's popup as the map wrote it, the map's own
//                        stylesheets scoped to its boxes, and the elements the
//                        map sits inside on its page
// The places load when the row is ticked. The boxes load on the first click.
const SITEMAP_LAYERS = new Set();       // map layer ids, for the click list
const sitemapBoxes = new Map();         // map id -> Promise of its boxes file

function sitemapBoxesUrl(cfg) {
  return cfg.dataUrl.replace(/\.places\.geojson$/, ".boxes.json");
}

async function addSitemapLayer(cfg) {
  let data;
  try {
    const r = await fetch(cfg.dataUrl);
    if (!r.ok) throw new Error(`${r.status} at ${cfg.dataUrl}`);
    data = await r.json();
  } catch (e) {
    setLayerState(cfg.id, `not built yet (${e.message})`);
    console.error(`[culprits] ${cfg.id}: ${e.message}`);
    return;
  }
  const source = `${cfg.id}-places`;
  map.addSource(source, { type: "geojson", data });
  const colour = ["coalesce", ["get", "c"], cfg.colour];
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source,
    filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
    paint: { "fill-color": colour, "fill-opacity": 0.35 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source,
    filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
    paint: { "line-color": colour, "line-opacity": 0.8,
             "line-width": ["min", ["coalesce", ["get", "w"], 2], 4] } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source,
    filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
    paint: {
      "circle-color": colour,
      // The map's own marker size, a little smaller at world zoom so a
      // crowded map does not merge into one blot.
      "circle-radius": ["interpolate", ["linear"], ["zoom"],
        1, ["*", 0.6, ["coalesce", ["get", "r"], 6]],
        6, ["coalesce", ["get", "r"], 6]],
      "circle-stroke-color": ["coalesce", ["get", "s"], "#17150F"],
      "circle-stroke-width": ["min", ["coalesce", ["get", "w"], 0.8], 3],
      "circle-opacity": ["coalesce", ["get", "o"], 0.85],
    } });
  for (const kind of ["fill", "line", "pt"]) {
    const id = `${cfg.id}-${kind}`;
    SITEMAP_LAYERS.add(id);
    map.on("click", id, (e) => openSitemapClick(e));
    map.on("mouseenter", id, (e) => { map.getCanvas().style.cursor = "pointer"; showSitemapTooltip(e); });
    map.on("mousemove", id, (e) => showSitemapTooltip(e));
    map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; hideSitemapTooltip(); });
  }
  // The map's own overlays (from its layer control), as chips under its row.
  if (Array.isArray(data.overlays) && data.overlays.length) {
    cfg.facet = { property: "ov", label: "layer", values: data.overlays };
  }
  const n = data.features.length;
  setLayerState(cfg.id, `${n.toLocaleString()} ${cfg.unit}`);
  applyVisibility(cfg.id);
  buildLegend();
}

function loadSitemapBoxes(cfg) {
  if (!sitemapBoxes.has(cfg.id)) {
    const p = fetch(sitemapBoxesUrl(cfg))
      .then((r) => { if (!r.ok) throw new Error(`${r.status} at ${sitemapBoxesUrl(cfg)}`); return r.json(); })
      .then((b) => { injectSitemapStyles(cfg, b); return b; });
    p.catch(() => sitemapBoxes.delete(cfg.id));   // a failed load may be retried
    sitemapBoxes.set(cfg.id, p);
  }
  return sitemapBoxes.get(cfg.id);
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Leaflet's own popup and tooltip rules, as every one of these maps loaded
// them. The scope is wrapped in :where() so each rule keeps Leaflet's own
// weight, and the map's stylesheet, added after, settles ties as it does on
// the map's page. index.html's popup rules skip these boxes (patched there).
const LEAFLET_BOX_CSS = `
:where(.wtyg-leaflet) *{box-sizing:content-box}
:where(.wtyg-leaflet) .leaflet-container{font-family:"Helvetica Neue",Arial,Helvetica,sans-serif;font-size:12px;font-size:.75rem;line-height:1.5}
:where(.wtyg-leaflet) .leaflet-container a{color:#0078A8}
:where(.wtyg-leaflet) .leaflet-popup{position:relative;text-align:center;margin-bottom:20px}
:where(.wtyg-leaflet) .leaflet-popup-content-wrapper{padding:1px;text-align:left;border-radius:12px}
:where(.wtyg-leaflet) .leaflet-popup-content{margin:13px 24px 13px 20px;line-height:1.3;font-size:13px;font-size:1.08333em;min-height:1px}
:where(.wtyg-leaflet) .leaflet-popup-content p{margin:1.3em 0}
:where(.wtyg-leaflet) .leaflet-popup-tip-container{width:40px;height:20px;position:absolute;left:50%;margin-top:-1px;margin-left:-20px;overflow:hidden;pointer-events:none}
:where(.wtyg-leaflet) .leaflet-popup-tip{width:17px;height:17px;padding:1px;margin:-10px auto 0;pointer-events:auto;transform:rotate(45deg)}
:where(.wtyg-leaflet) .leaflet-popup-content-wrapper,:where(.wtyg-leaflet) .leaflet-popup-tip{background:white;color:#333;box-shadow:0 3px 14px rgba(0,0,0,.4)}
:where(.wtyg-leaflet) .leaflet-container a.leaflet-popup-close-button{position:absolute;top:0;right:0;border:none;text-align:center;width:24px;height:24px;font:16px/24px Tahoma,Verdana,sans-serif;color:#757575;text-decoration:none;background:transparent}
:where(.wtyg-leaflet) .leaflet-container a.leaflet-popup-close-button:hover,:where(.wtyg-leaflet) .leaflet-container a.leaflet-popup-close-button:focus{color:#585858}
:where(.wtyg-leaflet) .leaflet-popup-scrolled{overflow:auto}
:where(.wtyg-leaflet) .leaflet-tooltip{position:relative;padding:6px;background-color:#fff;border:1px solid #fff;border-radius:3px;color:#222;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.maplibregl-popup.wtyg-box .maplibregl-popup-content,.maplibregl-popup.wtyg-tip .maplibregl-popup-content{background:none;border:0;padding:0;max-width:none;box-shadow:none;border-radius:0}
.maplibregl-popup.wtyg-box .maplibregl-popup-tip,.maplibregl-popup.wtyg-tip .maplibregl-popup-tip{display:none}
.wtyg-pick{font-size:12.5px}
.wtyg-pick .hd{color:var(--dim);font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin:0 0 5px}
.wtyg-pick button{display:block;width:100%;text-align:left;font:inherit;background:none;color:var(--bone);border:0;border-top:1px solid var(--rule);padding:5px 0;cursor:pointer}
.wtyg-pick button:first-of-type{border-top:0}
.wtyg-pick button:hover .pl{text-decoration:underline}
.wtyg-pick .mp{display:block;color:var(--dim);font-size:11.5px}
`;

let leafletBoxCssAdded = false;
function ensureBoxCss() {
  if (!leafletBoxCssAdded) { addStyle(LEAFLET_BOX_CSS, "leaflet-boxes"); leafletBoxCssAdded = true; }
}
function addStyle(text, key) {
  if (!document.head || !document.createElement) return;
  const el = document.createElement("style");
  el.dataset.wtyg = key;
  el.textContent = text;
  document.head.appendChild(el);
}

function injectSitemapStyles(cfg, boxes) {
  ensureBoxCss();
  for (const href of boxes.stylesheets || []) {
    if (!document.head || !document.createElement) break;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
  addStyle(boxes.css || "", `map-${cfg.id}`);
}

// Layout only: the map's containers carry their colours and fonts into the box,
// as they do on the map's page, but not their size, border or background.
const NEUTRAL = "display:block;position:relative;inset:auto;width:auto;height:auto;min-width:0;min-height:0;" +
  "max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;" +
  "overflow:visible;transform:none;opacity:1;filter:none;backdrop-filter:none";

function sitemapBoxHtml(cfg, boxes, box, tooltip) {
  const chain = (boxes.chain && boxes.chain.length ? boxes.chain : [{ tag: "div" }]);
  let open = `<div class="wtyg-map-${cfg.id} wtyg-leaflet" style="${NEUTRAL}">`;
  let close = "</div>";
  chain.forEach((el, i) => {
    const last = i === chain.length - 1;
    const cls = [el.class || "", last ? "leaflet-container" : ""].join(" ").trim();
    open += `<div${cls ? ` class="${escapeHtml(cls)}"` : ""}${el.id ? ` data-wtyg-id="${escapeHtml(el.id)}"` : ""} style="${NEUTRAL}">`;
    close = "</div>" + close;
  });
  let inner;
  if (tooltip) {
    const o = box.to || {};
    inner = `<div class="leaflet-tooltip ${escapeHtml(o.className || "")}">${box.t}</div>`;
  } else {
    const o = box.o || {};
    const maxW = Number(o.maxWidth) || 300, minW = Number(o.minWidth) || 50;
    const maxH = Number(o.maxHeight) || 0;
    inner = `<div class="leaflet-popup ${escapeHtml(o.className || "")}">` +
      `<div class="leaflet-popup-content-wrapper">` +
      `<div class="leaflet-popup-content${maxH ? " leaflet-popup-scrolled" : ""}" style="width:max-content;max-width:${maxW}px;min-width:${minW}px${maxH ? `;max-height:${maxH}px;overflow:auto` : ""}">${box.h}</div></div>` +
      `<div class="leaflet-popup-tip-container"><div class="leaflet-popup-tip"></div></div>` +
      `<a class="leaflet-popup-close-button" role="button" aria-label="Close popup" href="#close"><span aria-hidden="true">&#215;</span></a>` +
      `</div>`;
  }
  return open + inner + close;
}

function sitemapHits(e) {
  const layers = [...SITEMAP_LAYERS].filter((id) => map.getLayer(id) &&
    (map.getLayoutProperty ? map.getLayoutProperty(id, "visibility") !== "none" : true));
  const p = e.point || { x: 0, y: 0 };
  const feats = map.queryRenderedFeatures
    ? map.queryRenderedFeatures([[p.x - 4, p.y - 4], [p.x + 4, p.y + 4]], { layers })
    : (e.features || []);
  const seen = new Set(), hits = [];
  for (const f of feats) {
    const layer = (f.layer && f.layer.id) || "";
    const mapId = layer.replace(/-(pt|line|fill)$/, "");
    const k = f.properties && f.properties.k;
    if (!k || seen.has(mapId + "|" + k)) continue;
    seen.add(mapId + "|" + k);
    const cfg = childById(mapId);
    if (cfg) hits.push({ cfg, props: f.properties, geometry: f.geometry });
  }
  return hits;
}

function placeOf(hit, e) {
  const g = hit.geometry;
  return g && g.type === "Point" ? g.coordinates : e.lngLat;
}

async function openSitemapBox(hit, at) {
  let boxes;
  try { boxes = await loadSitemapBoxes(hit.cfg); }
  catch (err) {
    new maplibregl.Popup({ closeButton: true, maxWidth: "280px" }).setLngLat(at)
      .setHTML(`<b>${escapeHtml(hit.cfg.name)}</b><div class="meta">This map's boxes could not be loaded (${escapeHtml(err.message)}).</div>`).addTo(map);
    return;
  }
  const box = boxes.boxes && boxes.boxes[hit.props.k];
  if (!box || !box.h) return;
  hideSitemapTooltip();
  const popup = new maplibregl.Popup({ closeButton: false, className: "wtyg-box", maxWidth: "none", anchor: "bottom", offset: 4 })
    .setLngLat(at).setHTML(sitemapBoxHtml(hit.cfg, boxes, box, false)).addTo(map);
  const el = popup.getElement && popup.getElement();
  if (el) {
    el.addEventListener("click", (ev) => {
      const x = ev.target.closest && ev.target.closest(".leaflet-popup-close-button");
      if (x) { ev.preventDefault(); popup.remove(); }
    });
  }
}

function openSitemapClick(e) {
  const claim = e.originalEvent || e;
  if (popupClaimedBy === claim) return;
  let hits = sitemapHits(e).filter((h) => h.props.p);
  // A place drawn over a line or an area is what the click meant, as on the
  // maps themselves, where the marker sits on top.
  if (hits.some((h) => h.geometry && h.geometry.type === "Point")) {
    hits = hits.filter((h) => h.geometry && h.geometry.type === "Point");
  }
  if (!hits.length) return;
  popupClaimedBy = claim;
  ensureBoxCss();
  if (hits.length === 1) { openSitemapBox(hits[0], placeOf(hits[0], e)); return; }
  const rows = hits.map((h, i) =>
    `<button type="button" data-hit="${i}"><span class="pl">${escapeHtml(h.props.n || "Unnamed place")}</span>` +
    `<span class="mp">${escapeHtml(h.cfg.name)}</span></button>`).join("");
  const list = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
    .setLngLat(e.lngLat).setHTML(`<div class="wtyg-pick"><div class="hd">${hits.length} places here</div>${rows}</div>`).addTo(map);
  const el = list.getElement && list.getElement();
  if (el) {
    el.addEventListener("click", (ev) => {
      const b = ev.target.closest && ev.target.closest("[data-hit]");
      if (!b) return;
      const hit = hits[Number(b.dataset.hit)];
      list.remove();
      openSitemapBox(hit, placeOf(hit, e));
    });
  }
}

// Leaflet shows a tooltip on hover; so does this, for places whose map gave one.
let sitemapTip = null, sitemapTipKey = null;
function hideSitemapTooltip() {
  if (sitemapTip) sitemapTip.remove();
  sitemapTip = null; sitemapTipKey = null;
}
async function showSitemapTooltip(e) {
  const hit = sitemapHits(e).find((h) => h.props.t);
  if (!hit) { hideSitemapTooltip(); return; }
  const key = hit.cfg.id + "|" + hit.props.k;
  if (key === sitemapTipKey) return;
  sitemapTipKey = key;
  let boxes;
  try { boxes = await loadSitemapBoxes(hit.cfg); } catch (err) { return; }
  const box = boxes.boxes && boxes.boxes[hit.props.k];
  if (!box || !box.t || sitemapTipKey !== key) return;
  if (sitemapTip) sitemapTip.remove();
  sitemapTip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "wtyg-tip", maxWidth: "none", anchor: "bottom", offset: 8 })
    .setLngLat(placeOf(hit, e)).setHTML(sitemapBoxHtml(hit.cfg, boxes, box, true)).addTo(map);
}
'''

app = once(app, "\n/* ---------- raster tile layers, via the Worker ---------- */", SITEMAP_JS + "\n/* ---------- raster tile layers, via the Worker ---------- */", "map/app.js")

# ---------------------------------------------------------------- tests

TESTS = r'''
console.log("\nsite maps, each its own map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const block = src.slice(src.indexOf("const SITE_MAPS = {"), src.indexOf("const EXEC_MAP = {"));
  const rows = [...block.matchAll(/\{ id: "([^"]+)"[^\n]*route: "sitemap"[^\n]*dataUrl: "([^"]+)"/g)];
  check("the simple site maps use their own boxes", rows.length >= 20, String(rows.length));
  check("each map's places file sits in the tile repo, named for the map",
        rows.every(([, id, u]) => u.endsWith(`/sitemaps/${id}.places.geojson`) && u.startsWith("https://welcometoyourgalaxy.github.io/")));
  check("the cartel map is one row again, lines included", !/site_cartel_lines/.test(block));
}
{
  const places = { type: "FeatureCollection", name: "Test Map", overlays: [], features: [
    { type: "Feature", geometry: { type: "Point", coordinates: [10, 20] }, properties: { k: "aaa", n: "Plaza", c: "#6A5A58", r: 8, p: 1 } },
  ] };
  const boxes = { name: "Test Map", css: ".wtyg-map-site_circus .circus-name{font-weight:600}", stylesheets: [],
    chain: [{ tag: "div", class: "animal-fight-map" }, { tag: "div", id: "fightMap" }],
    boxes: { aaa: { h: '<div class="circus-name">Carson &amp; Barnes</div>', o: { maxWidth: 320, className: "custom-popup" } } } };
  const got = [];
  const { map } = run({ fetchImpl: async (u) => { got.push(String(u)); return { ok: true, status: 200,
    json: async () => (String(u).endsWith(".boxes.json") ? boxes : places) }; } });
  const head = [];
  globalThis.document.head = { appendChild: (el) => head.push(el) };
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const panel = globalThis.document.getElementById("layers");
  panel.fire("change", { target: { dataset: { layer: "site_circus" }, checked: true } });
  await new Promise((r) => setTimeout(r, 10));
  check("ticking a site map loads its places, not its boxes",
        got.some((u) => u.endsWith("site_circus.places.geojson")) && !got.some((u) => u.endsWith(".boxes.json")));
  const pt = map.getLayer("site_circus-pt");
  check("its places draw in the map's own colours and sizes",
        pt && JSON.stringify(pt.paint["circle-color"]).includes('"c"') && JSON.stringify(pt.paint["circle-radius"]).includes('"r"'));
  check("its lines and areas have layers too", !!map.getLayer("site_circus-line") && !!map.getLayer("site_circus-fill"));

  let hitsAt = [{ layer: { id: "site_circus-pt" }, properties: places.features[0].properties, geometry: places.features[0].geometry }];
  map.queryRenderedFeatures = () => hitsAt;
  map.getLayoutProperty = () => "visible";
  const ev = { lngLat: [10, 20], point: { x: 5, y: 5 }, originalEvent: {}, features: hitsAt };
  map.fire("click:site_circus-pt", ev);
  await new Promise((r) => setTimeout(r, 10));
  const box = popups.at(-1);
  check("a click opens the map's own box", box && /Carson &amp; Barnes/.test(box.html) && /class="circus-name"/.test(box.html));
  check("the box is scoped to its map, inside the elements the map sits in",
        /wtyg-map-site_circus/.test(box.html) && /class="animal-fight-map"/.test(box.html) && /data-wtyg-id="fightMap"/.test(box.html) && !/ id="fightMap"/.test(box.html));
  check("the box opens with the map's own popup options", /max-width:320px/.test(box.html) && /leaflet-popup custom-popup/.test(box.html));
  check("the map's stylesheet is added once, after Leaflet's defaults",
        head.filter((el) => el.textContent && el.textContent.includes("circus-name")).length === 1 &&
        head.findIndex((el) => (el.textContent || "").includes(".leaflet-popup-content-wrapper")) <
        head.findIndex((el) => (el.textContent || "").includes("circus-name")));
  check("boxes load on the first click", got.filter((u) => u.endsWith("site_circus.boxes.json")).length === 1);

  hitsAt = [hitsAt[0], { layer: { id: "site_rodeo-pt" }, properties: { k: "bbb", n: "Arena", p: 1 }, geometry: { type: "Point", coordinates: [10, 20] } }];
  map.fire("click:site_circus-pt", { ...ev, originalEvent: {}, features: hitsAt });
  await new Promise((r) => setTimeout(r, 10));
  const list = popups.at(-1);
  check("several places at one spot give a short list first",
        list && /2 places here/.test(list.html) && /Plaza/.test(list.html) && /Arena/.test(list.html) && /data-hit="1"/.test(list.html));
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")
test = once(test, """class FakePopup {
  constructor() { this.html = null; }""", """class FakePopup {
  constructor(opts) { this.html = null; this.opts = opts; }
  getElement() { return { addEventListener() {} }; }
  remove() {}""", "map/test.mjs")

# ---------------------------------------------------------------- build and move

build = once(build, """# Every map layer: the site's own maps, then the accountability repos' files.
ALL=$(python3 -c 'import json
a=[m["id"] for m in json.load(open("pipeline/sitemaps/registry.json"))["maps"]]
b=[l["id"] for l in json.load(open("pipeline/sitemaps/repo_layers.json"))["layers"]]
print(",".join(a+b))')""", """# The accountability repos' files, plus the site maps still drawn from archives.
# The other site maps are built as their own maps by build_boxes.py, below.
ALL=$(python3 -c 'import json
keep={"carbon_majors","site_environment_law"}
a=[m["id"] for m in json.load(open("pipeline/sitemaps/registry.json"))["maps"] if m["id"] in keep]
b=[l["id"] for l in json.load(open("pipeline/sitemaps/repo_layers.json"))["layers"]]
print(",".join(a+b))')""", "pipeline/sitemaps/build.sh")
build = once(build, """echo "Building shapes (countries, regions, lines)…"
python3 pipeline/shapes/build_shapes.py ${1:+"$1"}""", """echo "Building shapes (countries, regions, lines)…"
python3 pipeline/shapes/build_shapes.py ${1:+"$1"}
echo "Building the site's own maps (places and boxes)…"
python3 pipeline/sitemaps/build_boxes.py ${1:+"$1"}""", "pipeline/sitemaps/build.sh")

move = once(move, """print(f"moved {moved} files")""", """# The site maps' places and boxes.
sm = root / "map/data/sitemaps"
if sm.is_dir():
    dest = root.parent / "culprits-tiles-more" / "sitemaps"
    dest.mkdir(parents=True, exist_ok=True)
    for f in sorted(sm.iterdir()):
        if f.name.endswith((".places.geojson", ".boxes.json")):
            shutil.move(str(f), dest / f.name)
            moved += 1
print(f"moved {moved} files")""", "pipeline/sitemaps/move_to_tile_repos.sh")

INDEX = ROOT / "map" / "index.html"
index = INDEX.read_text(encoding="utf-8")
index = once(index, """  .maplibregl-popup-content b{display:block;margin-bottom:3px}
  .maplibregl-popup-content .meta{color:var(--dim);font-size:12px;margin-top:5px}""",
"""  /* Not inside a site map's own box (.wtyg-box): those carry their map's styling. */
  .maplibregl-popup:not(.wtyg-box) .maplibregl-popup-content b{display:block;margin-bottom:3px}
  .maplibregl-popup:not(.wtyg-box) .maplibregl-popup-content .meta{color:var(--dim);font-size:12px;margin-top:5px}""", "map/index.html")

INDEX.write_text(index, encoding="utf-8")
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
BUILD.write_text(build, encoding="utf-8")
MOVE.write_text(move, encoding="utf-8")
print(f"Site maps now open their own boxes: {len(ids)} rows in map/app.js; tests added; build and move scripts updated.")
