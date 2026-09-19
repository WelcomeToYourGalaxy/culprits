#!/usr/bin/env python3
"""
1. Climate TRACE columns keep a sensible size as you zoom in. They used to stay
   3 pixels wide at every zoom, so close in they became thin needles. Now each
   column grows with the zoom (up to 28 pixels across), but never wider than
   the gap to its nearest neighbour allows, so columns still never overlap.
2. A "reload the map" button beside the zoom buttons, for when the map gets
   stuck. It reloads the page on the same view.
3. Mines worldwide: the 2024 merge of Maus et al.'s satellite-traced mine
   outlines with OpenStreetMap's mines (192,584 outlines, each with its tree
   cover loss 2000-2019; ODbL), built once into the tiles repo by
   culprits-tiles-more's scripts/mines.py. Points wider out, outlines closer in.

Run from the repo root:  python3 patch_cols.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "COLUMN_PX_MAX" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


# --- 1. columns ---------------------------------------------------------------------
once("""const COLUMN_PX = 1.5;          // half the footprint, in screen pixels""",
"""const COLUMN_PX = 1.5;          // half the footprint, in screen pixels, at world view
const COLUMN_PX_MAX = 14;       // half the footprint at most, close in
const COLUMN_GROW = 1.35;       // footprint growth per zoom level past 3""")
once("""  rows.sort((a, b) => b.v - a.v);
  const half = COLUMN_PX * mPerPx;
  const features = rows.slice(0, COLUMN_MAX).map(({ lng, lat, v, cfg, p }) => {
    const dLat = half / 111320, dLng = half / (111320 * Math.max(.05, Math.cos(lat * Math.PI / 180)));
    return { type: "Feature",
      properties: Object.assign({}, p, { colour: cfg.colour, layerName: cfg.name,
        h: Math.max(mPerPx * 1.5, Math.sqrt(v) * COLUMN_TALL * mPerPx) }),""",
"""  rows.sort((a, b) => b.v - a.v);
  const kept = rows.slice(0, COLUMN_MAX);
  const halves = columnHalves(kept, z);
  const grow = Math.sqrt(halves.want / COLUMN_PX);
  const features = kept.map(({ lng, lat, v, cfg, p }, i) => {
    const half = halves.px[i] * mPerPx;
    const dLat = half / 111320, dLng = half / (111320 * Math.max(.05, Math.cos(lat * Math.PI / 180)));
    return { type: "Feature",
      properties: Object.assign({}, p, { colour: cfg.colour, layerName: cfg.name,
        h: Math.max(mPerPx * 1.5, Math.sqrt(v) * COLUMN_TALL * mPerPx * grow) }),""")
once("function addColumnLayer() {", r"""// Half the footprint of each column, in screen pixels: larger as the map zooms
// in, but never more than just under half the distance to the nearest other
// column, so neighbours cannot overlap. Neighbours are found on a grid of cells
// one full footprint wide.
function columnHalves(rows, z) {
  const want = Math.min(COLUMN_PX_MAX, COLUMN_PX * Math.pow(COLUMN_GROW, Math.max(0, z - 3)));
  const px = rows.map(() => want);
  if (typeof map.project !== "function" || rows.length < 2 || want <= COLUMN_PX) return { want, px };
  const pts = rows.map((r) => map.project([r.lng, r.lat]));
  const cell = want * 2, grid = new Map();
  pts.forEach((q, i) => {
    const k = `${Math.floor(q.x / cell)}|${Math.floor(q.y / cell)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  pts.forEach((q, i) => {
    const cx = Math.floor(q.x / cell), cy = Math.floor(q.y / cell);
    let near = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of grid.get(`${cx + dx}|${cy + dy}`) || []) {
        if (j === i) continue;
        const d = Math.max(Math.abs(pts[j].x - q.x), Math.abs(pts[j].y - q.y));
        if (d < near) near = d;
      }
    }
    // Squares: they meet when the larger of the two distances is two halves.
    if (near < Infinity) px[i] = Math.max(COLUMN_PX, Math.min(want, near * 0.45));
  });
  return { want, px };
}

function addColumnLayer() {""")

# --- 2. reload button ----------------------------------------------------------------
once("""  if (holder && group && holder.insertBefore) holder.insertBefore(group, holder.firstChild);""",
"""  if (holder && group && holder.insertBefore) holder.insertBefore(group, holder.firstChild);
  // Beside the zoom buttons: reload the whole map on the same view, for when it gets stuck.
  if (holder && holder.appendChild && document.createElement && !document.getElementById("reload-map")) {
    const b = document.createElement("button");
    b.id = "reload-map";
    b.type = "button";
    b.title = "Reload the map (if it gets stuck)";
    b.setAttribute("aria-label", "Reload the map");
    b.textContent = "\\u21bb";
    b.style.cssText = "margin-left:6px;width:29px;height:29px;border-radius:4px;border:0;cursor:pointer;" +
      "background:#fff;color:#333;font:17px/29px system-ui,sans-serif;box-shadow:0 0 0 2px rgba(0,0,0,.1)";
    b.addEventListener("click", () => {
      try {
        const c = map.getCenter();
        const view = `${c.lng.toFixed(4)},${c.lat.toFixed(4)},${map.getZoom().toFixed(2)}`;
        sessionStorage.setItem("culprits-view", view);
      } catch (e) { /* the view is not kept; the page still reloads */ }
      location.reload();
    });
    holder.appendChild(b);
  }""")
# After a reload from the button, return to the same view.
once("function moveZoomButtons() {", """if (typeof map.once === "function") map.once("load", () => {
  try {
    const v = sessionStorage.getItem("culprits-view");
    if (!v) return;
    sessionStorage.removeItem("culprits-view");
    const [lng, lat, z] = v.split(",").map(Number);
    if ([lng, lat, z].every(isFinite)) map.jumpTo({ center: [lng, lat], zoom: z });
  } catch (e) { /* no saved view */ }
});

function moveZoomButtons() {""")

# --- 3. mines -------------------------------------------------------------------------
HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
ROW = f'''    {{ id: "mines_global", name: "Mines worldwide (Maus et al. 2022 + OpenStreetMap)", unit: "mine outlines", colour: "#6E5E52", route: "pmshapes", ready: true, lazy: true,
      archiveUrl: "{HOME}/tiles/mining_polygons.pmtiles", polygonLayer: "mines", pointLayer: "mine_points",
      attribution: "Maus et al. 2022; OpenStreetMap contributors; merged by WU Vienna 2024 (ODbL)",
      note: "192,584 mine outlines: Maus et al.'s satellite-traced mining areas merged with OpenStreetMap's mines and quarries (Zenodo 7307210, ODbL), with the tree cover loss inside each from 2000 to 2019. Points wider out, outlines from zoom 7." }},
'''
once('''    { id: "wreckers_umap",''', ROW + '''    { id: "wreckers_umap",''')
once('  wreckers_umap: ["insentient", "upstream"],\n', '  mines_global: ["insentient", "downstream"],\n  wreckers_umap: ["insentient", "upstream"],\n')
once('''    : cfg.route === "trase" ? addTraseLayer(cfg)''', '''    : cfg.route === "trase" ? addTraseLayer(cfg)
    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''')
once("/* ---------- the sky the map sits in ---------- */", r"""/* ---------- outlines from a PMTiles archive (points wider out) ---------- */
function addPmShapesLayer(cfg) {
  const src = `${cfg.id}-pm`;
  map.addSource(src, { type: "vector", url: `pmtiles://${cfg.archiveUrl}`, attribution: cfg.attribution || "" });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: src, "source-layer": cfg.polygonLayer,
    paint: { "fill-color": cfg.colour, "fill-opacity": 0.55, "fill-outline-color": "#1D1B17" } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, "source-layer": cfg.pointLayer,
    paint: { "circle-color": cfg.colour, "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 1.4, 6, 3],
             "circle-stroke-color": "#17150F", "circle-stroke-width": 0.4, "circle-opacity": 0.85 } });
  const box = (p) => {
    const loss = Object.keys(p).filter((k) => /(19|20)\d\d/.test(k) && isFinite(Number(p[k])))
      .sort().map((k) => `${escapeHtml(k.replace(/_/g, " "))}: ${Number(p[k]).toLocaleString(undefined, { maximumFractionDigits: 3 })}`);
    const rest = Object.keys(p).filter((k) => !/(19|20)\d\d/.test(k) && p[k] !== "" && p[k] != null)
      .map((k) => `${escapeHtml(k.replace(/_/g, " "))}: ${escapeHtml(k === "area" ? Number(p[k]).toLocaleString(undefined, { maximumFractionDigits: 3 }) + " km\u00b2" : p[k])}`);
    return `<b>Mine${p.country ? " \u2014 " + escapeHtml(p.country) : ""}</b><div class="meta">${rest.join("<br>")}</div>` +
      (loss.length ? `<div class="meta">Tree cover loss inside it:<br>${loss.join("<br>")}</div>` : "") +
      `<div class="meta">Maus et al. 2022 and OpenStreetMap, merged by WU Vienna (ODbL)</div>`;
  };
  bindHtmlPopup(`${cfg.id}-fill`, box);
  bindHtmlPopup(`${cfg.id}-pt`, box);
  setLayerState(cfg.id, "points wider out, outlines from zoom 7");
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */""")

TESTS = r'''
console.log("\ncolumns close in, a reload button, mines");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("function columnHalves("), src.indexOf("function addColumnLayer("));
  const fakeMap = { project: ([x, y]) => ({ x: x * 100, y: y * 100 }) };
  const halves = new Function("map", "COLUMN_PX", "COLUMN_PX_MAX", "COLUMN_GROW", body + "; return columnHalves;")(fakeMap, 1.5, 14, 1.35);
  const far = halves([{ lng: 0, lat: 0 }, { lng: 5, lat: 5 }], 12);
  check("close in, a lone column grows past its world-view size", far.px[0] > 1.5 && far.px[0] <= 14);
  const near = halves([{ lng: 0, lat: 0 }, { lng: 0.1, lat: 0 }], 12);
  check("…but never so wide that it meets its neighbour", near.px[0] * 2 < 10 && near.px[1] * 2 < 10);
  check("at world view columns keep their old size", halves([{ lng: 0, lat: 0 }, { lng: 1, lat: 1 }], 2).want === 1.5);
  check("a reload button sits beside the zoom buttons", /id = "reload-map"/.test(src) && /location\.reload\(\)/.test(src));
  check("…and comes back to the same view", /sessionStorage\.getItem\("culprits-view"\)/.test(src));
  check("mines worldwide is a row, drawn from the tiles repo", /id: "mines_global"[^\n]*route: "pmshapes"/.test(src) &&
        /tiles\/mining_polygons\.pmtiles/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Columns, reload button and mines added. Test with: node map/test.mjs")
