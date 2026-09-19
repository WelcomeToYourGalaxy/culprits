#!/usr/bin/env python3
"""
1. The 22 monitor layers come out again. The monitors were already subjects in
   the news wires box (with their own topics as filters there), and their
   stories show on the map when "show them on the map" is on and the subject is
   picked. That is where they belong; they are not separate layers.
2. The Real Christmas Tree Locator (the trees Google My Maps map) moves to
   Suppression > Of plants.
3. Every layer row gets its own tools, shown while the layer is ticked:
   ▲ / ▼  moves the layer up or down among the rows beside it, and draws it
          above or below them on the map to match;
   a slider sets its transparency (10% to 100%).
4. Easier to see on every basemap: points get a light rim, so they stand out on
   both the atlas and satellite imagery, and a minimum size, so the smallest
   ones are still visible at world scale.

Run from the repo root:  python3 patch_panel3.py
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "function addRowTools(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


# --- 1. monitors out -------------------------------------------------------------------
app, n = re.subn(r'    \{ id: "monitor_[a-z]+",[^\n]*\n      repo: [^\n]*\n      note: [^\n]*\n', "", app)
if n != 22:
    sys.exit(f"Expected 22 monitor rows, found {n}. Nothing was written.")
app = re.sub(r'  monitor_[a-z]+: \["[a-z]+", "[a-z]+"\],\n', "", app)
once('''  "monitor_space", "monitor_neo", "monitor_uap",''',
     '''  { note: "The space industry, launch sites and the other maps from the site's Off-Planet Invasion page come here." },''')
app = re.sub(r' "monitor_[a-z]+",', "", app)
once('''    : cfg.route === "monitor" ? addMonitorLayer(cfg)\n''', "")
a = app.index("/* ---------- your live monitors, each its own layer ---------- */")
b = app.index("\n/* ---------- ", a + 10) + 1
app = app[:a] + app[b:]
if "monitor_" in app:
    sys.exit("A monitor reference was left behind. Nothing was written.")
ta = test.index('console.log("\\nyour 22 live monitors");')
tb = test.index("console.log(", ta + 10)
test = test[:ta] + test[tb:]

# --- 2. trees under Of plants ------------------------------------------------------------
once('"glad_loss", "mymaps_trees", "palmwatch",', '"glad_loss", "palmwatch",')
once('''  { h: 2, t: "Of plants" }, "site_enslaved_plants",''', '''  { h: 2, t: "Of plants" }, "site_enslaved_plants", "mymaps_trees",''')

# --- 3 and 4: row tools; legible points ----------------------------------------------------
once("""const map = new maplibregl.Map({""", """const map = new maplibregl.Map({""")  # anchor check only
m = re.search(r"const map = new maplibregl\.Map\(\{[\s\S]*?\n\}\);\n", app)
if not m:
    sys.exit("Could not find the end of the map's creation. Nothing was written.")
HOOK = r'''
/* ---------- every layer easier to see, and its own transparency ---------- */
// Points get a light rim, so they stand out on the atlas and on satellite
// imagery, and a minimum size, so the smallest are visible at world scale.
// Hollow rings and the news marks keep their own drawing.
const POINT_MIN = 3.2, POINT_GROW = 1.2, POINT_RIM = "rgba(242,238,230,0.85)";
function hasZoom(v) { return JSON.stringify(v).includes('"zoom"'); }
function mapOutputs(v, fn) {
  if (typeof v === "number") return fn(v);
  if (Array.isArray(v) && (v[0] === "interpolate" || v[0] === "interpolate-hcl" || v[0] === "interpolate-lab") && JSON.stringify(v[2]) === '["zoom"]') {
    return v.map((x, i) => (i > 2 && (i - 3) % 2 === 1 ? mapOutputs(x, fn) : x));
  }
  if (Array.isArray(v) && v[0] === "step" && JSON.stringify(v[1]) === '["zoom"]') {
    return v.map((x, i) => (i === 2 || (i > 2 && (i - 3) % 2 === 1) ? mapOutputs(x, fn) : x));
  }
  if (Array.isArray(v) && !hasZoom(v)) return fn === boostOne ? ["max", ["*", v, POINT_GROW], POINT_MIN] : ["*", v, fn(1)];
  return v;
}
function boostOne(n) { return Math.max(n * POINT_GROW, POINT_MIN); }
function legibleCircle(layer) {
  if (!layer || layer.type !== "circle" || /^(wire-|ct-)/.test(layer.id)) return;
  const p = layer.paint = Object.assign({}, layer.paint || {});
  if (/rgba\(0,\s*0,\s*0,\s*0\)/.test(JSON.stringify(p["circle-color"] || ""))) return;
  p["circle-radius"] = mapOutputs(p["circle-radius"] === undefined ? 5 : p["circle-radius"], boostOne);
  p["circle-stroke-color"] = POINT_RIM;
  const w = p["circle-stroke-width"];
  if (w === undefined || (typeof w === "number" && w < 1)) p["circle-stroke-width"] = 1;
}
const OPACITY_PROPS = { fill: ["fill-opacity"], line: ["line-opacity"], circle: ["circle-opacity", "circle-stroke-opacity"],
  raster: ["raster-opacity"], "fill-extrusion": ["fill-extrusion-opacity"], symbol: ["icon-opacity", "text-opacity"], heatmap: ["heatmap-opacity"] };
const opacityFactor = new Map();        // row id -> 0.1..1
const opacityBase = new Map();          // "layer|prop" -> its own opacity
function rowOfLayer(layerId) {
  let best = null;
  for (const id of opacityFactor.keys()) if ((layerId === id || layerId.startsWith(id + "-")) && (!best || id.length > best.length)) best = id;
  return best;
}
function applyOpacity(layerId, f) {
  const l = map.getLayer && map.getLayer(layerId);
  if (!l) return;
  for (const prop of OPACITY_PROPS[l.type] || []) {
    const key = `${layerId}|${prop}`;
    if (!opacityBase.has(key)) {
      const v = map.getPaintProperty(layerId, prop);
      opacityBase.set(key, v === undefined ? 1 : v);
    }
    try { map.setPaintProperty(layerId, prop, f >= 0.999 ? opacityBase.get(key) : mapOutputs(opacityBase.get(key), (n) => n * f)); }
    catch (e) { /* an expression this cannot scale keeps its own value */ }
  }
}
function layersOfRow(id) {
  const st = map.getStyle && map.getStyle();
  return ((st && st.layers) || []).map((l) => l.id).filter((l) => l === id || l.startsWith(id + "-"));
}
if (typeof map.addLayer === "function") {
  const rawAddLayer = map.addLayer.bind(map);
  map.addLayer = function (layer, before) {
    try { legibleCircle(layer); } catch (e) { /* drawn as given */ }
    const out = rawAddLayer(layer, before);
    const row = layer && layer.id && rowOfLayer(layer.id);
    if (row && opacityFactor.get(row) < 0.999) applyOpacity(layer.id, opacityFactor.get(row));
    return out;
  };
}
'''
app = app[:m.end()] + HOOK + app[m.end():]

TOOLS = r'''
// ▲ ▼ and a transparency slider for every layer row, shown while it is ticked.
function rowLead(el) { return el && (el.tagName === "LABEL" && el.querySelector("[data-layer]") || (el.classList && el.classList.contains("group"))) ? el : null; }
function rowIdOf(lead) {
  const i = lead.querySelector("[data-layer]") || lead.querySelector("[data-group]");
  return i ? (i.dataset.layer || i.dataset.group) : null;
}
function rowNodes(lead) {
  const out = [lead];
  let n = lead.nextElementSibling;
  while (n && n.classList && n.classList.contains("facet")) { out.push(n); n = n.nextElementSibling; }
  return out;
}
function rowLayerIds(lead) {
  if (lead.classList && lead.classList.contains("group")) {
    return [...lead.querySelectorAll("[data-layer]")].flatMap((i) => layersOfRow(i.dataset.layer));
  }
  return layersOfRow(rowIdOf(lead));
}
function moveRow(lead, dir) {
  const parent = lead.parentElement;
  const leads = [...parent.children].filter(rowLead);
  const at = leads.indexOf(lead);
  const other = leads[dir === "up" ? at - 1 : at + 1];
  if (!other) return;
  const mine = rowNodes(lead);
  if (dir === "up") mine.forEach((n) => parent.insertBefore(n, other));
  else { const theirs = rowNodes(other); const after = theirs[theirs.length - 1].nextSibling; mine.forEach((n) => parent.insertBefore(n, after)); }
  // On the map: above the other row's layers when moved up, below them when moved down.
  const own = rowLayerIds(lead), them = rowLayerIds(other);
  if (!own.length || !them.length || typeof map.moveLayer !== "function") return;
  const order = map.getStyle().layers.map((l) => l.id);
  if (dir === "up") {
    const top = Math.max(...them.map((id) => order.indexOf(id)));
    const before = order.slice(top + 1).find((id) => !own.includes(id));
    own.forEach((id) => map.moveLayer(id, before));
  } else {
    const bottom = Math.min(...them.map((id) => order.indexOf(id)));
    own.forEach((id) => map.moveLayer(id, order[bottom]));
  }
  if (typeof wireOnTop === "function") wireOnTop();
}
function addRowTools(box) {
  for (const input of box.querySelectorAll("label > [data-layer]")) {
    const lead = input.closest("label");
    if (!lead || lead.closest("[data-removed]") || (lead.nextElementSibling && lead.nextElementSibling.classList.contains("row-tools"))) continue;
    const id = input.dataset.layer;
    const tools = document.createElement("div");
    tools.className = "facet row-tools";
    tools.dataset.for = id;
    tools.hidden = !input.checked;
    tools.innerHTML = `<button type="button" class="chip" data-mv="up" title="Move up: drawn above the layer before it">\u25B2</button>` +
      `<button type="button" class="chip" data-mv="down" title="Move down: drawn below the layer after it">\u25BC</button>` +
      `<input type="range" min="10" max="100" value="100" title="Transparency" aria-label="Transparency" style="flex:1;min-width:60px;accent-color:#8A9DA6">` +
      `<span class="rt-v" style="font-size:11px;color:var(--dim);min-width:32px;text-align:right">100%</span>`;
    tools.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-mv]");
      if (!b) return;
      e.stopPropagation();
      moveRow(lead, b.dataset.mv);
    });
    const slider = tools.querySelector("input");
    slider.addEventListener("input", () => {
      const f = Number(slider.value) / 100;
      tools.querySelector(".rt-v").textContent = `${slider.value}%`;
      opacityFactor.set(id, f);
      layersOfRow(id).forEach((l) => applyOpacity(l, f));
    });
    input.addEventListener("change", () => { tools.hidden = !input.checked; });
    lead.after(tools);
  }
  // A group's parent moves its whole group.
  for (const g of box.querySelectorAll(".group > .layer.parent")) {
    if (g.querySelector("[data-mv]")) continue;
    const grp = g.parentElement;
    const span = document.createElement("span");
    span.style.cssText = "margin-left:auto;display:flex;gap:2px";
    span.innerHTML = `<button type="button" class="chip" data-mv="up" title="Move this group up">\u25B2</button>` +
      `<button type="button" class="chip" data-mv="down" title="Move this group down">\u25BC</button>`;
    span.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-mv]");
      if (!b) return;
      e.stopPropagation(); e.preventDefault();
      moveRow(grp, b.dataset.mv);
    });
    g.appendChild(span);
  }
}
'''
once("  box.appendChild(gone);", "  box.appendChild(gone);\n  addRowTools(box);")
once("function arrangePanel() {", TOOLS + "\nfunction arrangePanel() {")
once("function panelNodes(box, key) {", "function panelNodes(box, key) {")  # unchanged: row tools carry class facet, so they travel with their row

TESTS = r'''
console.log("\nrow tools; easier-to-see points; monitors back in the wires box only");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the monitor layers are gone", !/monitor_/.test(src) && !/route: "monitor"/.test(src));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const plants = order.findIndex((x) => x && x.t === "Of plants");
  check("the Christmas tree map is under Suppression, Of plants", order.indexOf("mymaps_trees") === plants + 2);
  const hook = src.slice(src.indexOf("const POINT_MIN"), src.indexOf("const OPACITY_PROPS"));
  const [mapOutputs, boostOne, legibleCircle] = new Function(hook + "; return [mapOutputs, boostOne, legibleCircle];")();
  check("a small fixed point grows to a visible size", boostOne(1.4) === 3.2 && Math.abs(boostOne(6) - 7.2) < 1e-9);
  const z = mapOutputs(["interpolate", ["linear"], ["zoom"], 1, 1.5, 8, 6], boostOne);
  check("…and so does each stop of a zoom scale", z[4] === 3.2 && z[6] > 7);
  const L = { id: "x-pt", type: "circle", paint: { "circle-color": "#555", "circle-radius": 2 } };
  legibleCircle(L);
  check("points get a light rim", /242,238,230/.test(L.paint["circle-stroke-color"]) && L.paint["circle-stroke-width"] === 1);
  const ring = { id: "r", type: "circle", paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": 5 } };
  legibleCircle(ring);
  check("hollow rings keep their own drawing", ring.paint["circle-radius"] === 5);
  check("each row has move and transparency tools", /data-mv="up"/.test(src) && /type="range" min="10" max="100"/.test(src) && /map\.moveLayer\(id, before\)/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Done. Test with: node map/test.mjs")
