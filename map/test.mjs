/**
 * Map logic tests.
 *
 * The map can't be rendered here — no browser is installable in this
 * environment — but almost everything that goes wrong with a MapLibre map goes
 * wrong before a pixel is drawn: layers added before their source exists,
 * a beforeId naming a layer that isn't there, a fetch path that resolves to
 * the wrong place, popups asserting things the data doesn't support.
 *
 * So MapLibre is stubbed and app.js is run against it. The stub is strict on
 * purpose: it throws on the same things the real library throws on.
 *
 * Run: node map/test.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const appVersion = (h) => Number((String(h).match(/app\.js\?v=(\d+)/) || [])[1] || 0);
let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

// --- strict MapLibre stub --------------------------------------------------
class FakeMap {
  constructor() {
    this.sources = new Map();
    this.layers = [];
    this.handlers = new Map();
    this.featureState = new Map();
    this.zoom = 1.6;
    this.errors = [];
  }
  addSource(id, def) {
    if (this.sources.has(id)) throw new Error(`source "${id}" already exists`);
    this.sources.set(id, def);
  }
  getSource(id) {
    const d = this.sources.get(id);
    return d ? { ...d, setData: (data) => { d._data = data; } } : undefined;
  }
  addLayer(def, beforeId) {
    // Custom WebGL layers are the one kind MapLibre accepts with no source.
    if (def.type !== "custom" && !this.sources.has(def.source)) {
      throw new Error(`layer "${def.id}" references missing source "${def.source}"`);
    }
    if (beforeId !== undefined && !this.layers.some((l) => l.id === beforeId)) {
      throw new Error(`beforeId "${beforeId}" does not exist`);
    }
    // Inserted where MapLibre would put it, so drawing order is testable.
    if (beforeId !== undefined) this.layers.splice(this.layers.findIndex((l) => l.id === beforeId), 0, def);
    else this.layers.push(def);
  }
  getLayer(id) { return this.layers.find((l) => l.id === id); }
  setPaintProperty(id, k, v) {
    const l = this.getLayer(id);
    if (!l) throw new Error(`setPaintProperty on missing layer "${id}"`);
    (l.paint ||= {})[k] = v;
  }
  triggerRepaint() {}
  removeLayer(id) {
    const i = this.layers.findIndex((l) => l.id === id);
    if (i < 0) throw new Error(`removeLayer on missing layer "${id}"`);
    this.layers.splice(i, 1);
  }
  setLayoutProperty(id, k, v) {
    const l = this.getLayer(id);
    if (!l) throw new Error(`setLayoutProperty on missing layer "${id}"`);
    (l.layout ||= {})[k] = v;
  }
  setFeatureState({ source, id }, state) {
    if (!this.sources.has(source)) throw new Error(`featureState on missing source`);
    // MapLibre merges into existing state rather than replacing it. The stub
    // must too, or it hides exactly the collision this test is looking for.
    const k = `${source}:${id}`;
    this.featureState.set(k, { ...(this.featureState.get(k) || {}), ...state });
  }
  getFeatureState({ source, id }) { return this.featureState.get(`${source}:${id}`) || {}; }
  on(ev, a, b) {
    const key = b ? `${ev}:${a}` : ev;
    if (!this.handlers.has(key)) this.handlers.set(key, []);
    this.handlers.get(key).push(b || a);
  }
  fire(key, arg) { (this.handlers.get(key) || []).forEach((h) => h(arg)); }
  addControl() {}
  setFilter(id, f) {
    const l = this.getLayer(id);
    if (!l) throw new Error(`setFilter on missing layer "${id}"`);
    l.filter = f;
  }
  getZoom() { return this.zoom; }
  setZoom(z) { this.zoom = z; }
  setMinZoom() {}
  setProjection() {}
  getCenter() { return { lng: 0, lat: 0 }; }
  easeTo(o) { if (o && o.zoom != null) this.zoom = o.zoom; }
  jumpTo(o) { if (o && o.zoom != null) this.zoom = o.zoom; }
  setTransformConstrain() {}
  getBounds() {
    return { getWest: () => 10, getSouth: () => 20, getEast: () => 11, getNorth: () => 21 };
  }
  getCanvas() { return { style: {} }; }
}

let popups = [];
class FakePopup {
  constructor(opts) { this.html = null; this.opts = opts; }
  getElement() { return { addEventListener() {} }; }
  remove() {}
  setLngLat() { return this; }
  setHTML(h) { this.html = h; return this; }
  addTo() { popups.push(this); return this; }
}

const fetched = [];
function run({ layersReady = null, fetchImpl = null } = {}) {
  const map = new FakeMap();
  popups = []; fetched.length = 0;

  // Fresh window each run: app.js guards against executing twice, and every
  // test needs a clean slate.
  globalThis.window = {};
  const els = new Map();
  const states = {};
  globalThis.document = {
    baseURI: "https://example.test/culprits/",
    getElementById: (id) => els.get(id) || (els.set(id, {
      innerHTML: "", textContent: "", appendChild() {},
      // Recorded rather than discarded: the layer toggles are wired to the
      // panel element, so a no-op here makes every toggle untestable.
      _listeners: {},
      addEventListener(ev, fn) { (this._listeners[ev] ||= []).push(fn); },
      fire(ev, arg) { (this._listeners[ev] || []).forEach((fn) => fn(arg)); },
      // The panel queries itself for group and layer checkboxes. Returning
      // nothing is the honest stub answer — no rows are rendered here — but it
      // has to be a function, or the group code throws where a browser would
      // simply find no match.
      querySelector: () => null, querySelectorAll: () => [],
      dataset: {}, after() {}, replaceWith() {}, closest: () => null,
      insertBefore() {}, getBoundingClientRect: () => ({ height: 200 }), style: {},
      // Enough of an element to be shown, hidden and faded: the hand-over to
      // Eyes works by adding classes and clearing `hidden`.
      hidden: true, style: {}, src: "",
      classList: { list: [],
        add(c) { if (!this.list.includes(c)) this.list.push(c); },
        remove(c) { this.list = this.list.filter((x) => x !== c); },
        contains(c) { return this.list.includes(c); },
        toggle(c, on) { on ? this.add(c) : this.remove(c); } },
    }), els.get(id)),
    // One object per selector, kept, so a layer's status line can be read back.
    querySelector: (sel) => (states[sel] ||= { textContent: "", dataset: {}, style: {},
      appendChild() {}, insertBefore() {}, addEventListener() {}, getBoundingClientRect: () => ({ height: 200 }) }),
    // Closer to a real element than it was: the layer panel now builds nested
    // group rows, reads data-* attributes and inserts facet rows after a
    // checkbox, so a stub with only className and innerHTML made app.js look
    // broken when it was the harness that was thin.
    createElement: () => ({
      className: "", innerHTML: "", dataset: {}, style: {}, title: "",
      addEventListener() {}, insertBefore() {}, getBoundingClientRect: () => ({ height: 200 }),
      appendChild() {}, after() {}, replaceWith() {},
      closest: () => null, querySelector: () => null, querySelectorAll: () => [],
    }),
    addEventListener() {},
  };
  globalThis.maplibregl = {
    Map: function () { return map; },
    NavigationControl: function () {}, ScaleControl: function () {},
    Popup: FakePopup,
    // Recorded so a protocol handler can be exercised directly.
    addProtocol(name, fn) { (globalThis.__protocols ||= {})[name] = fn; },
  };
  globalThis.pmtiles = { Protocol: function () { return { tile: () => {}, add: () => {} }; },
    PMTiles: function (url) { this.url = url; this.getMetadata = async () => ({}); this.getHeader = async () => ({}); } };
  globalThis.document.baseURI = "https://example.test/culprits/";
  globalThis.fetch = fetchImpl || (async (u) => {
    fetched.push(u);
    return { ok: true, status: 200, json: async () => ({}) };
  });

  let src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  if (layersReady) src = src.replace(/ready:\s*true/g, "ready:false")
                           .replace(new RegExp(`(id:"${layersReady}"[^}]*?)ready:false`), "$1ready:true");
  new Function(src)();
  return { map, els, states };
}

console.log("\nmap wiring");

// --- layers are added against sources that exist ---------------------------
{
  const { map } = run();
  let err = null;
  try { map.fire("load"); await new Promise((r) => setTimeout(r, 5)); }
  catch (e) { err = e; }
  check("load adds layers without error", err === null, err && err.message);
  check("point source registered", map.sources.has("carbon_bombs-src"));
  check("aggregate + detail layers both added",
        !!map.getLayer("carbon_bombs-agg") && !!map.getLayer("carbon_bombs-pt"));
  check("tile URL is absolute",
        String(map.sources.get("carbon_bombs-src").url).startsWith("pmtiles://https://"),
        String(map.sources.get("carbon_bombs-src").url));
}

// --- the beforeId race -----------------------------------------------------
{
  // Country layers are added asynchronously and reference a point layer by id.
  // If no point layer is ready, that id doesn't exist and MapLibre throws.
  const { map } = run({ layersReady: "land_matrix" });
  let err = null;
  process.once("unhandledRejection", (e) => { err = e; });
  try {
    map.fire("load");
    await new Promise((r) => setTimeout(r, 5));   // let the async layer settle
  } catch (e) { err = e; }
  check("country layer alone does not throw on beforeId",
        err === null, err && err.message);
  check("country fill layer was actually added",
        !!map.getLayer("land_matrix-fill"));
}

// --- zoom threshold matches the tiling -------------------------------------
{
  const { map } = run();
  map.fire("load");
  await new Promise((r) => setTimeout(r, 5));
  const agg = map.getLayer("carbon_bombs-agg");
  const pt = map.getLayer("carbon_bombs-pt");
  check("aggregate layer stops at the cluster threshold", agg.maxzoom === 8);
  check("detail layer starts at the cluster threshold", pt.minzoom === 8);
  check("radius reads _count, not point_count",
        JSON.stringify(agg.paint["circle-radius"]).includes("_count"));
}

// --- popups: a cluster must not inherit a member's identity ----------------
{
  const { map } = run();
  map.fire("load");
  await new Promise((r) => setTimeout(r, 5));

  map.fire("click:carbon_bombs-pt", {
    lngLat: [0, 0],
    features: [{ properties: {
      _count: 425, value: 1182.3, unit: "Gt", name: "Gething Coal Mine",
      x_country: "Canada", x_operator: "CKD Mines", source: "carbon_bombs",
      url: "https://example.invalid/gething",
    } }],
  });
  const clusterHtml = popups.at(-1).html;
  check("cluster popup states the count", /425/.test(clusterHtml));
  check("cluster popup withholds the inherited name",
        !/Gething/.test(clusterHtml), clusterHtml.slice(0, 120));
  check("cluster popup withholds the inherited operator",
        !/CKD Mines/.test(clusterHtml));
  check("cluster popup withholds the inherited link",
        !/example\.invalid/.test(clusterHtml));

  map.fire("click:carbon_bombs-pt", {
    lngLat: [0, 0],
    features: [{ properties: {
      _count: 1, value: 1.6, unit: "Gt", name: "Agha Jari",
      source: "carbon_bombs", url: "https://example.invalid/agha",
    } }],
  });
  const singleHtml = popups.at(-1).html;
  check("single-site popup names the site", /Agha Jari/.test(singleHtml));
  check("single-site popup links the source record",
        /example\.invalid/.test(singleHtml));
}

// --- centroid honesty carried through --------------------------------------
{
  const { map } = run();
  map.fire("load");
  await new Promise((r) => setTimeout(r, 5));
  map.fire("click:carbon_bombs-pt", {
    lngLat: [0, 0],
    features: [{ properties: { _count: 1, value: 5, name: "X", x_precision: "country" } }],
  });
  check("centroid features say so", /centroid/i.test(popups.at(-1).html));
}

// --- country layer fetch path ----------------------------------------------
{
  const { map } = run();
  map.fire("load");
  await new Promise((r) => setTimeout(r, 5));
  const p = fetched.find((u) => String(u).includes("land_matrix"));
  check("country data fetched", !!p, `fetched: ${JSON.stringify(fetched)}`);
  if (p) check("country path has no '/../' segment", !String(p).includes("/../"),
               String(p));
}

// --- live layers only query past the threshold -----------------------------
{
  const { map } = run();
  map.fire("load");
  await new Promise((r) => setTimeout(r, 5));
  fetched.length = 0;
  map.zoom = 3;
  map.fire("moveend");
  await new Promise((r) => setTimeout(r, 0));
  // At world zoom the viewport is far wider than any source can answer for,
  // so the request is skipped rather than sent and refused.
  check("no worker call when the viewport is wider than the source allows",
        !fetched.some((u) => String(u).includes("/v1/")), JSON.stringify(fetched));
}

// --- a missing archive must say so ----------------------------------------
{
  const { map, els } = run({
    fetchImpl: async (u, o) => (String(u).endsWith(".pmtiles")
      ? { ok: false, status: 404 }
      : { ok: true, status: 200, json: async () => ({}) }),
  });
  map.fire("load");
  await new Promise((r) => setTimeout(r, 5));
  check("missing archive does not register a source",
        !map.sources.has("carbon_bombs-src"));
  check("missing archive does not throw", true);
}

// --- two country layers must not overwrite each other ---------------------
{
  const { map } = run({
    fetchImpl: async (u) => {
      const id = String(u).includes("land_matrix") ? "land_matrix" : "owid_co2";
      if (String(u).endsWith(".pmtiles")) return { ok: false, status: 404 };
      return { ok: true, status: 200, json: async () => ({
        USA: { value: id === "land_matrix" ? 111 : 999, unit: id, name: "USA" },
      }) };
    },
  });
  map.fire("load");
  await new Promise((r) => setTimeout(r, 10));
  const st = map.getFeatureState({ source: "boundaries", id: "USA" });
  check("each country layer keeps its own value",
        st.v_land_matrix === 111 && st.v_owid_co2 === 999,
        JSON.stringify(st));
}

// --- heavy-tailed data must stay visible ----------------------------------
{
  const { map } = run({
    fetchImpl: async (u) => {
      if (String(u).endsWith(".pmtiles")) return { ok: false, status: 404 };
      return { ok: true, status: 200, json: async () => ({
        CHN: { value: 12289, unit: "Mt" },   // the outlier
        KEN: { value: 21.2, unit: "Mt" },    // a median-ish country
      }) };
    },
  });
  map.fire("load");
  await new Promise((r) => setTimeout(r, 10));
  const fill = map.getLayer("owid_co2-fill");
  // Round 48: colour and depth together, on the same log scale; one depth for
  // every country with data, none for a country without.
  const expr = JSON.stringify(fill.paint["fill-opacity"]);
  const colour = JSON.stringify(fill.paint["fill-color"]);
  check("choropleth uses a log scale", /log10/.test(colour), colour.slice(0, 90));
  check("small values keep a visible floor", /0\.78/.test(expr) && (colour.match(/#[0-9A-F]{6}/gi) || []).length >= 5);
  check("no-data countries stay transparent", expr.includes('"case"') && /null\],0,/.test(expr));
}

// --- fuel filtering happens in the map, not the harvester -----------------
{
  const { map } = run();
  map.fire("load");
  await new Promise((r) => setTimeout(r, 10));
  const pt = map.getLayer("power_plants-pt");
  check("no filter is applied by default", !pt.filter,
        JSON.stringify(pt && pt.filter));
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("power_plants declares a fuel facet",
        /facet:\s*\{[^}]*property:\s*"x_fuel"/.test(src));
  check("the facet lists non-fossil fuels too — nothing is hidden by default",
        /"Solar"/.test(src) && /"Wind"/.test(src) && /"Hydro"/.test(src));
  check("filtering is wired to setFilter, not to the harvester",
        /map\.setFilter\(/.test(src) && !/FUELS/.test(
          fs.readFileSync(path.join(HERE, "..", "pipeline", "sources", "power_plants.py"), "utf8")));
}

// --- unbuilt sources must not look broken ---------------------------------
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("only ready layers get a row",
        /LAYERS\.filter\(\(c\) => c\.ready\)\.forEach/.test(src));
  check("unbuilt sources are named once, not listed as disabled rows",
        /pending-note/.test(src) && !/disabled data-layer/.test(src));
}

// --- worker layers must explain why they are empty ------------------------
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("a viewport too wide for a source says so rather than sitting empty",
        /area too wide for this source/.test(src));
  check("worker errors surface the Worker's own message, not a bare status",
        /\(await r\.json\(\)\)\.error/.test(src));
}

// --- running twice must not duplicate the layers --------------------------
{
  const { map } = run();
  map.fire("load");
  await new Promise((r) => setTimeout(r, 10));
  const before = map.layers.length;

  // Simulate index.html carrying both an inline copy and <script src>.
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  new Function(src)();
  await new Promise((r) => setTimeout(r, 10));
  check("a second execution adds no layers", map.layers.length === before,
        `${before} -> ${map.layers.length}`);
}

// --- live layers are not gated on a fixed zoom ----------------------------
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("no fixed zoom gate on live layers",
        !/getZoom\(\) < CLUSTER_MAXZOOM/.test(src));
  check("each live source declares its own area cap",
        /maxAreaDeg2/.test(src));
  check("live point layers have no minzoom",
        !/source: `\$\{cfg\.id\}-live`,\s*\n\s*minzoom/.test(src));
}

// --- live layers must not issue concurrent requests -----------------------
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("one request in flight per layer", /inFlight/.test(src));
  check("movement is allowed to settle before querying", /SETTLE_MS/.test(src));
  check("a 429 backs off and retries rather than giving up",
        /concurrent/.test(src) && /setTimeout\(\(\) => refreshLiveLayer/.test(src));
}

// --- fishing is a tile layer, not a per-viewport query ---------------------
{
  const { map, els } = run();
  map.fire("load");
  await new Promise((r) => setTimeout(r, 10));

  const src = map.sources.get("fishing-tiles");
  check("fishing registers a raster tile source", Boolean(src) && src.type === "raster",
        JSON.stringify(src));
  check("fishing tiles are addressed by z/x/y, not by bbox",
        /\/fishing_tile\/\{z\}\/\{x\}\/\{y\}/.test(src.tiles[0]) &&
        !/bbox/.test(src.tiles[0]), src.tiles[0]);
  check("fishing stops at the zoom GFW serves rather than requesting 400s",
        src.maxzoom === 12, String(src.maxzoom));
  // Required by GFW's terms of use, not decoration.
  check("the layer carries GFW attribution",
        /Powered by Global Fishing Watch/.test(src.attribution || ""), src.attribution);
  check("a raster layer is drawn from it", Boolean(map.getLayer("fishing-raster")));
  check("no geojson source is left behind for fishing", !map.sources.has("fishing-live"));

  // The whole point of the change: panning must not queue a report.
  fetched.length = 0;
  map.zoom = 9;
  map.fire("moveend");
  await new Promise((r) => setTimeout(r, 700));
  check("panning issues no /v1/fishing report request",
        !fetched.some((u) => /\/v1\/fishing(\?|$)/.test(String(u))),
        JSON.stringify(fetched));

  // The toggle must still reach it, which needs the -raster id in the list.
  els.get("layers").fire("change",
    { target: { dataset: { layer: "fishing" }, checked: false } });
  check("the layer toggle hides the raster",
        map.getLayer("fishing-raster").layout?.visibility === "none",
        JSON.stringify(map.getLayer("fishing-raster").layout));
}

// --- the report endpoint's limit is written down, not just worked around ---
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("app.js records why /report could not serve a public page",
        /report per account/i.test(src), "the reason is not stated in app.js");
}

// --- blurred positions must never draw as located sites --------------------
//
// This is regression cover for a bug that shipped in the remains harvester and
// was caught only by running it: the source tags blurred burial positions
// `geo: "coarsened"`, the mapping did not know the word, and 2,580 records
// deliberately degraded to ~5 km would have drawn as solid, precise graves.
// The map is the last place that can catch it, so the precision value has to
// be in the hollow list AND the popup has to say what happened.
{
  const { map } = run();
  map.fire("load");
  await new Promise((r) => setTimeout(r, 5));
  map.fire("click:carbon_bombs-pt", {
    lngLat: [0, 0],
    features: [{ properties: { _count: 1, name: "A permit", x_precision: "blurred" } }],
  });
  const html = popups.at(-1).html;
  check("blurred features say the position was coarsened", /coarsen/i.test(html), html);
  check("blurred features do not read as a located site",
        !/Plotted at the country centroid/.test(html));
}

// Every precision value any harvester emits must appear in the hollow list, or
// it silently renders solid. Listing them here means adding a new one to a
// harvester without adding it to the map fails a test rather than publishing a
// false position.
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const EMITTED = ["country", "admin", "grid", "area", "segment", "mobile",
                   "blurred", "locality", "unknown"];
  const lists = src.match(/\[\s*"country",[^\]]*\]/g) || [];
  check("the hollow-precision list is used in every paint property",
        lists.length === 3, `found ${lists.length}`);
  for (const v of EMITTED) {
    check(`precision "${v}" renders hollow everywhere`,
          lists.length === 3 && lists.every((l) => l.includes(`"${v}"`)));
  }
}

// --- the guerillamap frame is scoped to this map's subject -----------------
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const set = (src.match(/const GM_OVERLAYS = \[([\s\S]*?)\]/) || [])[1] || "";
  check("guerillamap overlays include fossil fuel infrastructure",
        /ppcoal/.test(set) && /pipelines/.test(set) && /refineries/.test(set));
  // conflict-feed drives the same frame with a conflict overlay set. Sharing the
  // mechanism must not mean inheriting the subject.
  check("guerillamap overlays carry none of conflict-feed's conflict layers",
        !/geoNews|conflicts|losses|terror|uyghurs|migration_routes/.test(set), set);
  check("the frame starts closed",
        /let gmOpen = false/.test(src), "a third-party frame should not load unasked");
  check("toggling the frame re-measures the map canvas",
        /gmSetOpen[\s\S]{0,600}map\.resize/.test(src),
        "the container changes height, so the canvas must be re-measured");
}

// --- polygon sources must not be drawn as circles --------------------------
//
// A circle layer handed polygon geometry does not throw. It draws nothing, and
// an empty layer is indistinguishable from a source that returned no data — so
// this is checked here rather than discovered on the map.
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const branch = (src.match(/if \(cfg\.geometry === "polygon"\)[\s\S]*?\n  }/) || [])[0] || "";
  check("addLiveLayer has a polygon branch", branch.length > 0);
  check("the polygon branch draws a fill", /type: "fill"/.test(branch));
  check("the polygon branch draws an outline too", /type: "line"/.test(branch),
        "a sub-pixel fill at low zoom disappears without one");
  check("the polygon branch draws no circle", !/type: "circle"/.test(branch));
  check("the polygon branch returns before the circle layer",
        /return;\n  }/.test(branch), "otherwise both are added to one source");

  // applyVisibility toggles a fixed list of layer id suffixes. A polygon layer
  // whose suffixes are missing from it cannot be switched off.
  const vis = (src.match(/function applyVisibility[\s\S]*?\n}/) || [])[0] || "";
  for (const sfx of ["-fill", "-line"]) {
    check(`applyVisibility reaches ${sfx} layers`, vis.includes(`${sfx}\``) || vis.includes(sfx));
  }
}

// --- filters and visibility must cover the same layers ---------------------
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const facet = (src.match(/function applyFacet[\s\S]*?\n}/) || [])[0] || "";
  for (const sfx of ["-agg", "-pt", "-fill", "-line"]) {
    check(`applyFacet filters ${sfx} layers`, facet.includes(`${sfx}\``), sfx);
  }
  // A facet must narrow what `where` selects, never replace it: replacing would
  // turn climate_trace_cafo back into every Climate TRACE source on first click.
  check("a facet is ANDed with the layer's `where`, not substituted for it",
        /const parts = \[cfg\.where, picked, keyed, timed\]\.filter\(Boolean\);/.test(facet) && /\["all", \.\.\.parts\]/.test(facet));
}

// --- layer groups ----------------------------------------------------------
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");

  // With no year archives on R2 the group must not render at all. An empty
  // disclosure, or rows that 404 on tick, read as a broken map.
  check("a group renders only when it has children",
        /GROUPS\.filter\(\(g\) => g\.children\.length\)/.test(src));
  // Two groups now share one set of functions. A child id must resolve across
  // all of them, or ticking a sector would look up only the history years and
  // silently create nothing.
  check("child lookup spans every group", /function childById[\s\S]*?for \(const g of GROUPS\)/.test(src));
  check("the toggle handler resolves which group was clicked",
        /GROUPS\.find\(\(g\) => g\.id === e\.target\.dataset\.group\)/.test(src));

  // Lazy means lazy: nothing about a year is fetched until it is ticked.
  check("year children are marked lazy", /lazy: true/.test(src));
  const load = (src.match(/map\.on\("load"[\s\S]*?buildPanel\(\)/) || [])[0] || "";
  check("no year archive is created at load",
        !/CT_HISTORY/.test(load), "the load handler must not touch the group");

  const ensure = (src.match(/function ensureLayer[\s\S]*?\n}/) || [])[0] || "";
  check("ensureLayer creates each year only once", /created\.has/.test(ensure));
  check("a failed year can be retried", /created\.delete/.test(ensure),
        "a slow R2 response must not kill the row for the session");

  // Partial selection must not read as "all on".
  const sync = (src.match(/function syncGroupBox[\s\S]*?\n}/) || [])[0] || "";
  check("the parent reports partial selection as indeterminate",
        /indeterminate = on > 0 && on < /.test(sync));
  check("the parent is only checked when every child is on",
        /checked = on === g\.children\.length/.test(sync));

  // A year archive holds 12 months; CT_MONTHS holds 66. Using the constant
  // would offer 54 months that render nothing.
  check("year facets start empty and are learned from the archive",
        /facet: \{ property: "x_period", label: "month", values: \[\] \}/.test(src));
  const learn = (src.match(/async function learnFacetValues[\s\S]*?\n}/) || [])[0] || "";
  check("a metadata read failure leaves the declared list standing",
        /catch[\s\S]*console\.warn/.test(learn));
  check("history archives are addressed off their own base, not the repo",
        /archiveUrl \|\| `\$\{TILE_BASE\}/.test(src));
}

// --- the Climate TRACE groups are actually wired ---------------------------
//
// A stale app.js passed the whole suite because nothing asserted the sector
// groups exist. The archives are split across three repos and 26 children; if
// any of that is missing the map silently offers fewer layers than were built.
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const count = (re) => (src.match(re) || []).length;

  check("the agriculture repo base is declared", /const CT_AG_BASE\s*=/.test(src));
  check("the forestry repo base is declared", /const CT_FLU_BASE\s*=/.test(src));
  check("all five groups are registered",
        /GROUPS = \[CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS/.test(src));

  check("six local sector archives", count(/"climate_trace_(?!ag_|flu_|sectors|cafo|agriculture|forestry)[a-z_]+"/g) >= 6);
  check("nine agriculture subsector archives", count(/"climate_trace_ag_[a-z_]+"/g) >= 9);
  check("eleven forestry subsector archives", count(/"climate_trace_flu_[a-z_]+"/g) >= 11);

}

// --- groups collapse, and collapsing is display-only ----------------------
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const rows = (src.match(/function groupRows[\s\S]*?\n}/) || [])[0] || "";
  check("children start hidden", /kids\.hidden = true/.test(rows));
  check("the parent carries one control, the arrow at the end of the row, not a triangle before the title too",
        !/data-disc=/.test(rows) && /const group = lead\.classList\.contains\("parent"\)/.test(src));

  // Opening a group must not load anything, and loading must not require
  // opening — so the triangle touches no layer state at all.
  const tog = (src.match(/function toggleGroup[\s\S]*?\n}/) || [])[0] || "";
  check("expanding a group creates no layer",
        !/ensureLayer|addPmtilesLayer|applyVisibility|visibility\.set/.test(tog),
        "the triangle must only show and hide rows");
}

// --- one archive instance per file, read after the map has drawn -----------
//
// learnFacetValues used to build its own PMTiles instance after addSource had
// run, so every layer fetched the header and root directory twice and the
// second pair competed with the tiles. This is purely about when requests
// happen; no feature is affected either way.
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const add = (src.match(/if \(!map\.getSource\(src\)\)[\s\S]*?map\.addSource/) || [])[0] || "";
  check("the archive is registered with the protocol before the source exists",
        /protocol\.add\(archive\)/.test(add), "otherwise the map builds a second instance");
  check("learnFacetValues is handed the instance, not a URL",
        /async function learnFacetValues\(cfg, archive\)/.test(src));
  check("the metadata read waits for the first idle",
        /map\.once\("idle", \(\) => learnFacetValues/.test(src),
        "tiles are what the reader is waiting for, not a panel row");
}

// --- lazy children are not all PMTiles -------------------------------------
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const ensure = (src.match(/function ensureLayer[\s\S]*?\n}/) || [])[0] || "";
  check("ensureLayer dispatches by route",
        /cfg\.route === "wmts"/.test(ensure),
        "the livestock species are WMTS, not archives");
  check("the livestock layers are gone", !/GLW_SPECIES/.test(src));   // round 95b: glw_ now names the relief copies
  // Most layers start off. Twenty-five point layers switched on at world zoom
  // was not a map, it was a texture. Nothing is removed — every layer is one
  // click away, and the opening view is a choropleth plus one point set.
  check("the map opens with a legible number of layers",
        (src.match(/\{ id:"[a-z_0-9]+",[^\n]*ready:true(?!, off: true)/g) || []).length <= 3,
        "more than three layers start visible");
  check("the CAFO locations layer is gone",
        !/id:"climate_trace_cafo"/.test(src));
}

// --- zoom expressions must be top-level -----------------------------------
//
// MapLibre rejects ["zoom"] nested inside another operator, and the rejection
// throws out of addLayer — so addPmtilesLayer aborts and the layer never
// exists. On the map that is indistinguishable from a missing archive, which
// is how it went unnoticed: gem_coal, carbon_bombs and power_plants all had
// archives and all drew nothing.
//
// The stub map here does not validate style expressions, so this reads the
// source instead of exercising it.
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  // Any paint property whose value starts with an operator other than
  // interpolate/step but contains ["zoom"] is the broken shape.
  const bad = [];
  const re = /"(circle-radius|circle-opacity|line-width|fill-opacity|circle-stroke-width)":\s*\[\s*"([a-z*+/-]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const op = m[2];
    if (op === "interpolate" || op === "step") continue;
    // Look ahead a little for a nested zoom reference.
    const window = src.slice(m.index, m.index + 400);
    if (/\["zoom"\]/.test(window)) bad.push(`${m[1]} starts with "${op}"`);
  }
  check("no paint property nests ['zoom'] inside another operator",
        bad.length === 0, bad.join("; "));
  check("the aggregate radius interpolates on zoom at the top level",
        /"circle-radius": \[\s*\n?\s*"interpolate", \["linear"\], \["zoom"\]/.test(src));
  check("the magnitude expression is defined once, not copied per stop",
        (src.match(/const MAGNITUDE_RADIUS =/g) || []).length === 1);
}

// --- basemaps: painted atlas, satellite, country outlines -------------------
//
// The atlas adds a custom WebGL layer and an image layer on load, first, so
// every data layer sits above them. A throw there must not cost the data
// layers, and the outlines basemap shares one boundaries source with the
// country layers, which MapLibre refuses to add twice.
console.log("\nbasemaps");
{
  const { map, els } = run();
  const warned = []; const cw = console.warn; console.warn = (...a) => warned.push(a.join(" "));
  let err = null;
  try { map.fire("load"); await new Promise((r) => setTimeout(r, 5)); } catch (e) { err = e; }
  console.warn = cw;
  check("load adds the basemap without error", err === null && !warned.some((w) => /basemap layers/.test(w)),
        (err && err.message) || warned.join("; "));
  const ids = map.layers.map((l) => l.id);
  const wash = map.getLayer("atlas-washes"), plate = map.getLayer("plate-base");
  check("the washes are a custom layer with a render function",
        wash && wash.type === "custom" && typeof wash.render === "function");
  check("the plate is drawn in map squares cut from the picture (round 118b: an image source vanished on the raised globe)", map.sources.get("plate-base")?.type === "raster" && /plate:\/\//.test(JSON.stringify(map.sources.get("plate-base").tiles)));
  const firstData = ids.findIndex((id) => !/^(atlas-|plate-base)/.test(id));
  check("washes, then plate, then everything else",
        ids.indexOf("atlas-washes") === 0 && ids.indexOf("plate-base") === 1 && firstData > 1,
        ids.slice(0, 4).join(", "));
  const op = plate && plate.paint["raster-opacity"];
  check("the plate fade reads zoom at the top level of its expression",
        Array.isArray(op) && op[0] === "interpolate" && JSON.stringify(op[2]) === '["zoom"]',
        JSON.stringify(op));
  check("the painted atlas is the opening basemap",
        (els.get("basemaps")?.innerHTML || "").includes('value="atlas" checked'));

  // Outlines: switch there, and the country layer that loaded on the same
  // source must not have been re-added.
  let e2 = null;
  const change = (v) => els.get("basemaps").fire("change", { target: { name: "basemap", value: v } });
  try { change("outlines"); change("satellite"); change("outlines"); change("atlas"); } catch (e) { e2 = e; }
  check("switching basemaps back and forth throws nothing", e2 === null, e2 && e2.message);
  check("the outlines draw under the washes",
        map.layers.findIndex((l) => l.id === "outline-land") <
        map.layers.findIndex((l) => l.id === "atlas-washes"));
  check("the outlines are hidden again in the atlas",
        map.getLayer("outline-land").layout?.visibility === "none" &&
        map.getLayer("plate-base").layout?.visibility === "visible");
  change("outlines");
  check("the plate is hidden under outlines",
        map.getLayer("plate-base").layout?.visibility === "none");
  check("one boundaries source, shared",
        [...map.sources.keys()].filter((k) => k === "boundaries").length === 1);
}

// The washes' arithmetic, against the CSS blend modes they stand in for.
// Pulled out of app.js and run alone, because no GPU is available here. The
// blend functions are simulated exactly as the GPU would apply them.
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const chunk = src.slice(src.indexOf("const ATLAS_TUNE"), src.indexOf("const atlasWashes"));
  const { ATLAS_TUNE, atlasWashPasses } =
    new Function("abs", chunk + "\nreturn { ATLAS_TUNE, atlasWashPasses };")(() => "");
  const gpu = { screen: (d, s) => s + d * (1 - s), multiply: (d, s) => d * s, gain: (d, s) => d + d * s };
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => v / 255); };
  const cssScreen = (d, c) => d + c - d * c;
  const cssOverlay = (d, c) => d <= .5 ? 2 * d * c : cssScreen(2 * d - 1, c);
  const cssSoft = (d, c) => c <= .5 ? d - (1 - 2 * c) * d * (1 - d)
    : d + (2 * c - 1) * ((d <= .25 ? ((16 * d - 12) * d + 4) * d : Math.sqrt(d)) - d);
  const mix = (d, b, a) => d + a * (b - d);
  const z = 2, P = atlasWashPasses(z);
  let worst = { sea: 0, warm: 0, green: 0 };
  for (let ch = 0; ch < 3; ch++) {
    for (let d = 0; d <= .5001; d += .05) {
      const sea = gpu.screen(d, P[0].rgb[ch]);
      worst.sea = Math.max(worst.sea, Math.abs(sea - mix(d, cssScreen(d, hex("#0f3b52")[ch]), ATLAS_TUNE.sea)));
      const warm = gpu.multiply(gpu.gain(d, P[2].rgb[ch]), P[3].rgb[ch]);
      worst.warm = Math.max(worst.warm, Math.abs(warm - mix(d, cssOverlay(d, hex("#f0c073")[ch]), ATLAS_TUNE.warm)));
    }
    const g = gpu.multiply(.5, P[1].rgb[ch]);
    worst.green = Math.max(worst.green, Math.abs(g - mix(.5, cssSoft(.5, hex("#5f8f3a")[ch]), ATLAS_TUNE.green)));
  }
  check("sea wash equals CSS screen", worst.sea < 1e-9, worst.sea);
  check("warm wash equals CSS overlay on the darker half", worst.warm < 1e-9, worst.warm);
  check("green wash is within 0.01 of CSS soft-light at mid-tone", worst.green < .01, worst.green);
  check("no pass asks the GPU for a colour outside 0-1",
        P.every((p) => p.rgb.every((v) => v >= 0 && v <= 1)));
}

// --- Cerulean slicks, live from Cerulean's own vector tiles ------------------
//
// No Worker, no archive. The tile URL must carry every field but centerlines
// and no date filter; shapes draw from zoom 7; nothing is requested while the
// layer is off; and the counts that make a cut-off tile visible must reach the
// map, surviving one slow first answer.
console.log("\ncerulean, live");
{
  const { map } = run({ layersReady: "cerulean_slicks" });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const src = map.sources.get("cerulean_slicks-tiles");
  const url = src && src.tiles[0];
  check("slicks come from Cerulean's tiles, not the Worker",
        !!url && url.startsWith("cerulean://api.cerulean.skytruth.org/") && !url.includes("workers.dev"), url);
  check("the tile request leaves out centerlines and nothing else it was given",
        !!url && !/centerlines/.test(url) && /properties=id,slick_timestamp,/.test(url) && /slick_url$/.test(url), url);
  check("no date filter: every detection since 2023", !!url && !/datetime/.test(url));
  const fill = map.getLayer("cerulean_slicks-fill");
  check("shapes draw from zoom 6, off the same zoom in the source",
        fill && fill.minzoom === 6 && fill["source-layer"] === "default" && src.minzoom === 6);
  check("nothing is counted while the layer is off",
        !fetched.some((u) => String(u).includes("cerulean")), fetched.filter((u) => String(u).includes("cerulean")).join(" "));
}
{
  let calls = 0;
  const fetchImpl = async (u) => {
    fetched.push(u);
    if (String(u).includes("api.cerulean.skytruth.org") && String(u).includes("limit=0")) {
      calls++;
      if (calls === 1) throw new Error("timed out");       // the slow first answer
      return { ok: true, status: 200, json: async () => ({ numberMatched: 171473, features: [] }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const { map, els } = run({ layersReady: "cerulean_slicks", fetchImpl });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  els.get("layers").fire("change", { target: { dataset: { layer: "cerulean_slicks" }, checked: true } });
  await new Promise((r) => setTimeout(r, 20));
  await new Promise((r) => setTimeout(r, 20));
  const countUrls = fetched.filter((u) => String(u).includes("limit=0"));
  check("at world view switching on asks one total, not a count per square",
        countUrls.length >= 1 && countUrls.every((u) => /\/collections\/public\.slick_plus\/items\?limit=0$/.test(u)),
        countUrls.join(" "));
  check("a total that times out once is asked again, not given up", calls === 2, `calls=${calls}`);
  const pts = map.sources.get("cerulean_slicks-counts")._data;
  const caps = map.sources.get("cerulean_slicks-caps")._data;
  check("nothing is shaded at world view", !pts || pts.features.length === 0);
  check("nothing is marked at world view", !caps || caps.features.length === 0);
  const cap = map.getLayer("cerulean_slicks-cap");
  check("the marking only shows where shapes are drawn", cap && cap.minzoom === 6);
  els.get("layers").fire("change", { target: { dataset: { layer: "cerulean_slicks" }, checked: false } });
  check("switching off hides the marking too", cap.layout?.visibility === "none");
}
{
  // The tile protocol: one retry, then the bytes.
  let n = 0;
  globalThis.fetch = async () => { if (++n === 1) throw new Error("timed out");
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(3) }; };
  const handler = globalThis.__protocols && globalThis.__protocols.cerulean;
  let got = null, err = null;
  try { got = await handler({ url: "cerulean://api.cerulean.skytruth.org/x" }, new AbortController()); }
  catch (e) { err = e; }
  check("a tile that times out once is fetched again", !err && got && got.data.byteLength === 3 && n === 2,
        err && err.message);
  n = 0;
  globalThis.fetch = async (u) => { n++; throw new Error("down"); };
  try { await handler({ url: "cerulean://api.cerulean.skytruth.org/x" }, new AbortController()); err = null; }
  catch (e) { err = e; }
  check("…but only once", !!err && n === 2, `n=${n}`);
}

// --- the tropics alert layer stops at 30°, to the pixel ---------------------
//
// bounds only picks which tiles load; a tile straddling 30° was drawn whole and
// painted a wash beyond the product's extent. The rows outside the band are
// cleared from the image, so beyond it the basemap shows untouched.
console.log("\ntropics clip");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const a = src.indexOf("function clipTileRows"), b = src.indexOf("// latclip://");
  const clipTileRows = new Function(src.slice(a, b) + "\nreturn clipTileRows;")();
  // z1 tile 0/0 spans 85°N to the equator: rows north of 30° are cleared.
  const rows = clipTileRows(1, 0, 256, -30, 30);
  const lat = (row) => Math.atan(Math.sinh(Math.PI * (1 - 2 * ((row + .5) / 256) / 2))) * 180 / Math.PI;
  check("a tile from the Arctic to the equator loses its rows north of 30°",
        rows.length === 1 && rows[0][0] === 0 && lat(rows[0][1] - 1) > 30 && lat(rows[0][1]) <= 30,
        JSON.stringify(rows));
  check("a tile wholly inside the tropics is left alone", clipTileRows(6, 31, 256, -30, 30).length === 0);
  const world = clipTileRows(0, 0, 256, -30, 30);
  check("the one world tile loses both poles and keeps the band",
        world.length === 2 && world[0][0] === 0 && world[1][1] === 256);

  // The tropics row is a child of the alerts group now, so it is built on the
  // first tick rather than at load; what it builds is checked on the config and
  // the tile path it goes through.
  check("the tropics layer loads through the clip, cut at its own bounds",
        /id:"gfw",[\s\S]{0,400}clipToBounds: true/.test(src) && /recolor: "#8A4F46"/.test(src) &&
        /`latclip:\/\/\$\{cfg\.clipToBounds && cfg\.bounds \? cfg\.bounds\[1\] : -90\},`/.test(src) && /gfw_tile/.test(src));
  const ra = src.indexOf("function recolorAlerts"), rb = src.indexOf("// latclip://<south>");
  const recolorAlerts = new Function(src.slice(ra, rb) + "; return recolorAlerts;")();
  const scattered = new Uint8ClampedArray(400 * 4);
  for (let i = 0; i < 40; i++) scattered.set([60, 120, 230, 255], i * 4 * 10);
  recolorAlerts(scattered, [138, 79, 70]);
  check("alert pixels take the layer's colour and keep their transparency",
        scattered[0] === 138 && scattered[1] === 79 && scattered[2] === 70 && scattered[3] === 255 && scattered[7] === 0);
  const washed = new Uint8ClampedArray(400 * 4).fill(255);
  const res = recolorAlerts(washed, [138, 79, 70]);
  check("a tile that is one flat colour is treated as a wash and cleared", res.washCleared && washed[3] === 0);
  check("the handler is registered", typeof globalThis.__protocols?.latclip === "function");
}

// --- a capped live source says it is capped ---------------------------------
console.log("\npartial answers");
{
  const fetchImpl = async (u) => {
    fetched.push(u);
    return { ok: true, status: 200, json: async () => ({
      type: "FeatureCollection", numberMatched: 49124,
      features: Array.from({ length: 2000 }, () => ({ type: "Feature", properties: {},
        geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } })) }) };
  };
  const { map, states } = run({ layersReady: "cerulean_sources", fetchImpl });
  map.fire("load"); await new Promise((r) => setTimeout(r, 10));
  const text = (states['[data-state="cerulean_sources"]'] || {}).textContent || "";
  check("a source that returns 2,000 of 49,124 says so", /2,000 of 49,124/.test(text), text);
}
{
  const fetchImpl = async (u) => {
    fetched.push(u);
    return { ok: true, status: 200, json: async () => ({ type: "FeatureCollection", numberMatched: 3,
      features: [1, 2, 3].map(() => ({ type: "Feature", properties: {}, geometry: null })) }) };
  };
  const { map, states } = run({ layersReady: "cerulean_sources", fetchImpl });
  map.fire("load"); await new Promise((r) => setTimeout(r, 10));
  const text = (states['[data-state="cerulean_sources"]'] || {}).textContent || "";
  check("a complete answer does not claim to be partial", text === "3 in view", text);
}

// --- coral reefs, live from the Atlas's own tiles ----------------------------
console.log("\ncoral, live");
{
  // MapLibre throws on a vector source whose tileSize is not 512.
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const bad = [...src.matchAll(/type:\s*"vector"[\s\S]{0,400}?tileSize:\s*(\d+)/g)].filter((m) => m[1] !== "512");
  check("no vector source declares a tile size MapLibre refuses", bad.length === 0, bad.map((m) => m[0].slice(0, 80)).join(" | "));
}
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const a = src.indexOf("function readTileLayers"), b = src.indexOf("// coral://");
  const readTileLayers = new Function(src.slice(a, b) + "\nreturn readTileLayers;")();
  // A real vector tile, encoded by the mapbox-vector-tile library, with two layers.
  const tile = Uint8Array.from(Buffer.from("Gl4KFGJlbnRoaWNfZGF0YV92ZXJib3NlEhcSBAAAAQEYAyINCQCAQBLIAccBAMgBDxoKY2xhc3NfbmFtZRoJYXJlYV9zcWttIgYKBFNhbmQiCRkAAAAAAADgPyiAIHgCGg0KBnNlY29uZCiAIHgC", "base64"));
  check("the tile reader finds every layer name in a real tile",
        JSON.stringify(readTileLayers(tile.buffer)) === '["benthic_data_verbose","second"]',
        JSON.stringify(readTileLayers(tile.buffer)));
  check("an empty tile has no names, and does not throw", readTileLayers(new ArrayBuffer(0)).length === 0);

  const { map, states } = run({ layersReady: "allen_coral" });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const s2 = map.sources.get("allen_coral-tiles");
  check("coral comes from the Atlas's tiles, not the Worker",
        s2 && s2.tiles[0].startsWith("coral://allencoralatlas.org/geoserver/gwc/service/wmts?") &&
        /TILEMATRIX=EPSG:900913:\{z\}&TILEROW=\{y\}&TILECOL=\{x\}/.test(s2.tiles[0]), s2 && s2.tiles[0]);
  check("no Worker request is made for coral", !fetched.some((u) => String(u).includes("/allen_coral?")));
  const fill = map.getLayer("allen_coral-fill");
  check("shapes draw from zoom 12", fill && fill.minzoom === 12);
  check("…from squares asked one level lower, as MapLibre reads vector squares at 512 pixels", s2.minzoom === 11);
  check("wider out the row says whose reefs are shown and where the zones begin",
        /from zoom 12 the Allen Coral Atlas/.test((states['[data-state="allen_coral"]'] || {}).textContent || ""));

  // A tile that names its layer differently: the layer is redrawn from that name.
  globalThis.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => tile.buffer.slice(0) });
  const cfgSrc = src.match(/sourceLayer: "([^"]+)"/)[1];
  check("the configured name is the one the reader will be checked against", cfgSrc === "benthic_data_verbose");
  const handler = globalThis.__protocols.coral;
  const got = await handler({ url: s2.tiles[0].replace("{z}", "13").replace("{y}", "1").replace("{x}", "2") },
                            new AbortController());
  check("the tile bytes pass through untouched", got.data.byteLength === tile.byteLength);
  check("a matching layer name leaves the layer as it was",
        map.getLayer("allen_coral-fill")["source-layer"] === "benthic_data_verbose");
}
{
  // A fresh run, whose first tile calls its layer something else.
  const { map } = run({ layersReady: "allen_coral" });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const other = Uint8Array.from(Buffer.from("GjkKB2JlbnRoaWMSFRICAAAYAyINCQCAQBLIAccBAMgBDxoKY2xhc3NfbmFtZSIGCgRTYW5kKIAgeAI=", "base64"));
  globalThis.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => other.buffer.slice(0) });
  const url = map.sources.get("allen_coral-tiles").tiles[0];
  await globalThis.__protocols.coral({ url: url.replace("{z}", "13").replace("{y}", "1").replace("{x}", "2") },
                                     new AbortController());
  check("a tile that names its layer differently is drawn from that name",
        map.getLayer("allen_coral-fill")?.["source-layer"] === "benthic" &&
        map.getLayer("allen_coral-line")?.["source-layer"] === "benthic");
  check("and the redrawn layer stays switched off like the rest",
        map.getLayer("allen_coral-fill")?.layout?.visibility === "none");
}

// --- what the wide views and the reefs look like --------------------------------

console.log("\nsite maps, each its own map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const block = src.slice(src.indexOf("const SITE_MAPS = {"), src.indexOf("const EXEC_MAP = {"));
  const rows = [...block.matchAll(/\{ id: "([^"]+)"[^\n]*route: "sitemap"[^\n]*dataUrl: "([^"]+)"/g)];
  check("the simple site maps use their own boxes", rows.length >= 20, String(rows.length));
  check("each map's places file sits in the tile repo, named for the map",
        rows.every(([, id, u]) => (u.endsWith(`/sitemaps/${id}.places.geojson`) || (id === "site_food_system" && u.endsWith("/food/system.places.geojson"))) && u.startsWith("https://welcometoyourgalaxy.github.io/")));
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


console.log("\none world, and the globe");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const opts = src.slice(src.indexOf("const map = new maplibregl.Map({"), src.indexOf("layers: [", src.indexOf("const map = new maplibregl.Map({")));
  check("the world is not repeated east and west", /renderWorldCopies:\s*false/.test(opts));
  check("the map opens as a globe", /projection:\s*\{\s*type:\s*"vertical-perspective"\s*\}/.test(opts));
  check("an atmosphere at world view, gone by zoom 7", /"atmosphere-blend":\s*\["interpolate",\s*\["linear"\],\s*\["zoom"\]/.test(opts));
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("MapLibre 5, the first version with a globe", /maplibre-gl@5\.\d+\.\d+\/dist\/maplibre-gl\.js/.test(index) && !/maplibre-gl@4/.test(index));
  check("Eyes is silent until it is handed the screen, then takes every click",
        /\.space\{[^}]*pointer-events:none/.test(index) && /\.space\.on\{[^}]*pointer-events:auto/.test(index) &&
        /id="spaceBack"/.test(index));
  const mesh = new Function(src.match(/const WASH_MESH[\s\S]*?\nfunction washMesh[\s\S]*?\n}\n/)[0] + "; return washMesh(WASH_MESH);")();
  check("the washes are a mesh over the whole world, in mercator 0..1",
        mesh.length === 96 * 64 * 12 && Math.min(...mesh) === 0 && Math.max(...mesh) === 1);
  check("the washes are placed by MapLibre's projection code, not a screen pass",
        /projectTile\(a_pos\)/.test(src) && /vertexShaderPrelude/.test(src) && !/gl_Position = vec4\(p, 0\.0, 1\.0\)/.test(src));
}
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const radius = new Function("map", src.match(/function globeRadiusPx[\s\S]*?\n}\n/)[0] + "; return globeRadiusPx;")(
    { transform: { cameraToCenterDistance: 1200 }, getCanvas: () => ({ clientHeight: 800 }), getZoom: () => 0 });
  // Measured in a browser at 1200 × 800: 76, 144, 262 and 450 pixels.
  const near = (z, px) => Math.abs(radius(z, 0) - px) <= 1.5;
  check("the globe's drawn size is worked out, not guessed", near(0, 76) && near(1, 144) && near(2, 262.5) && near(3, 450.5),
        [0, 1, 2, 3].map((z) => radius(z, 0).toFixed(1)).join(" "));
  const facing = new Function(src.match(/const EYES_FIT[\s\S]*?\nfunction eyesFacing[\s\S]*?\n}\n/)[0] + "; return { eyesFacing, EYES_FIT };")();
  const t0 = Date.parse(facing.EYES_FIT.at);
  check("Earth's face is carried forward from the calibration", Math.abs(facing.eyesFacing(t0).lon - facing.EYES_FIT.lon) < 1e-6);
  const aDay = facing.eyesFacing(t0 + 86400000).lon, anHour = facing.eyesFacing(t0 + 3600000).lon;
  check("a day on turns it once round, an hour on by fifteen degrees",
        Math.abs(aDay - facing.EYES_FIT.lon) < 1.1 && Math.abs(anHour - facing.EYES_FIT.lon - 15.04) < 0.1,
        `${aDay.toFixed(2)} ${anHour.toFixed(2)}`);
}
{
  const { map, els } = run();
  const projections = [];
  map.setProjection = (p) => projections.push(p.type);
  const minZooms = [];
  map.setMinZoom = (z) => minZooms.push(z);
  const eased = [];
  map.easeTo = (o) => eased.push(o);
  const cont = { _l: {}, addEventListener(ev, fn) { (this._l[ev] ||= []).push(fn); }, appendChild() {} };
  map.getContainer = () => cont;
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const panel = els.get("basemaps");
  check("the settings box offers the two views and the way out", /value="globe" checked/.test(panel.innerHTML) &&
        /value="flat"/.test(panel.innerHTML) && !/globe-flat/.test(panel.innerHTML) &&
        /id="leave-earth"/.test(panel.innerHTML));
  check("no view, basemap or button carries a paragraph", !/class="un"/.test(panel.innerHTML));
  const el = (id) => globalThis.document.getElementById(id);
  const frame = el("space");
  check("Eyes is not loaded while the map is being read", !frame.src);
  map.setZoom(4); map.fire("zoom");
  map.setZoom(1.5); map.fire("zoom");
  check("nearing the way out loads Eyes quietly, still hidden", /^https:\/\/eyes\.nasa\.gov\/apps\/solar-system\/#\/earth\?featured=false/.test(frame.src) && !(frame.classList.list || []).includes("on"));
  map.setZoom(-3); map.fire("zoom");
  await new Promise((r) => setTimeout(r, 50));
  check("reaching the edge does not leave by itself (round 59)", !(frame.classList.list || []).includes("on") && eased.length === 0);
  const wheel = () => (cont._l.wheel || []).forEach((fn) => fn({ deltaY: 40 }));
  wheel();
  await new Promise((r) => setTimeout(r, 300));
  check("…one scroll outward there says another will leave", eased.length === 0);
  wheel();
  await new Promise((r) => setTimeout(r, 1000));
  check("zooming out past the globe hands the screen over", (frame.classList.list || []).includes("on") &&
        (el("map").classList.list || []).includes("away") && el("spaceBack").hidden === false);
  check("the map is moved to Earth's own size and face first",
        eased.length === 1 && eased[0].zoom === 0.8 && eased[0].bearing === 0 && Array.isArray(eased[0].center));
  el("spaceBack").fire("click", {});
  check("the bar brings the map back", !(frame.classList.list || []).includes("on") &&
        !(el("map").classList.list || []).includes("away") && el("spaceBack").hidden === true);
  const change = (t) => panel.fire("change", { target: t });
  change({ name: "view", value: "flat" });
  check("the flat map is mercator, with no way out", projections.at(-1) === "mercator" && minZooms.at(-1) === -2);
  change({ name: "view", value: "globe" });
  check("the globe view stays a globe at every zoom", projections.at(-1) === "vertical-perspective");
  check("…and is stopped just past the hand-over size", minZooms.at(-1) > -4 && minZooms.at(-1) < 4,
        String(minZooms.at(-1)));
}


console.log("\nthe sky, and what opens ticked");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const f = new Function(src.match(/function seededRandom[\s\S]*?\nfunction starField[\s\S]*?\n}\n/)[0] +
                         "; return { starField, STAR_COLOURS };")();
  const a = f.starField(1200, 800), b = f.starField(1200, 800);
  check("the same sky comes back every time", a.length === b.length && a[7].x === b[7].x && a[7].c === b[7].c);
  check("about one star per seven thousand pixels", Math.abs(a.length - (1200 * 800) / 7000) <= 1, String(a.length));
  check("every star is on the canvas, dim to bright", a.every((s) => s.x >= 0 && s.x < 1200 && s.y >= 0 && s.y < 800 &&
        s.r >= 0.35 && s.r <= 1.5 && s.a > 0.15 && s.a <= 0.9));
  const hues = f.STAR_COLOURS.map((c) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
    let h = 0;
    if (mx !== mn) {
      h = mx === r ? ((g - bl) / (mx - mn)) % 6 : mx === g ? (bl - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h, sat: mx ? (mx - mn) / mx : 0 };
  });
  check("no star is orange, yellow or neon", hues.every((x) => x.sat < 0.25 && !(x.sat > 0.12 && x.h >= 25 && x.h < 70)));
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the sky is drawn behind the map", index.indexOf('id="stars"') < index.indexOf('id="map"') &&
        /\.stars\{[^}]*pointer-events:none/.test(index));
}
{
  const { map } = run();
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const vis = (id) => (map.getLayer(id) ? (map.getLayer(id).layout || {}).visibility : null);
  check("the flat map's dark is a fill over the world, so stars show beyond it",
        !!map.getLayer("world-fill") === false || vis("world-fill") !== null);
  map.layers.push({ id: "bg", type: "background", layout: {} });
  const panelHtml = globalThis.document.getElementById("basemaps");
  panelHtml.fire("change", { target: { name: "view", value: "flat" } });
  check("on the flat map the world is filled and the screen background is off",
        vis("world-fill") === "visible" && vis("bg") === "none");
  panelHtml.fire("change", { target: { name: "view", value: "globe" } });
  check("on the globe the background covers the planet again", vis("bg") === "visible" && vis("world-fill") === "none");
}
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  // A layer marked off: true opens unticked and draws nothing until it is ticked.
  const marked = (id) => new RegExp(`\\{ *id: *"${id}"[^\\n]*off: *true`).test(src) ||
                          new RegExp(`\\{ *id:"${id}"[^\\n]*off:true`).test(src);
  check("National CO₂ emissions opens unticked", marked("owid_co2"));
  check("Identified trafficking cases opens unticked", marked("slavery_cases"));
  check("the panel leaves those rows unticked", /\$\{cfg\.off \? "" : " checked"\} data-layer/.test(src));
  check("and nothing is drawn for them until they are ticked",
        /const visibility = new Map\(LAYERS\.filter\(\(c\) => c\.off\)/.test(src));
}


console.log("\nthe boxes");
{
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("one width is declared for every box", /--box-w:\s*290px/.test(index) && /--zoom-w:\s*29px/.test(index));
  check("the boxes down the left take it, through their own --left-w", /--left-w:var\(--box-w\)/.test(index) && /\.left-col\{[\s\S]{0,120}width:var\(--left-w\)/.test(index));
  check("the news wires box takes it too, no longer 440px",
        /width:min\(var\(--box-w,290px\),calc\(100vw - 18px\)\)/.test(wireSrc) && !/440px/.test(wireSrc));
  check("the legend is as wide as the layers column above it",
        /#legend\{position:absolute;left:16px;bottom:16px;z-index:2;width:var\(--left-w\)/.test(index));
  check("the zoom buttons are back in the view row, one above the other",
        /function moveZoomButtons/.test(src) && /getElementById\("view-zoom"\)/.test(src) &&
        /<div class="view-zoom" id="view-zoom"><\/div>/.test(src) &&
        /grid-template-columns:36px;/.test(index) && !/id="zoombox"/.test(index));
  check("Eyes opens without the View 3D prompt or its panels",
        /featured=false/.test(src) && /logo=false/.test(src) && !/embed=true/.test(src));
  const pull = new Function(src.match(/function pullHeight[\s\S]*?\n}\n/)[0] + "; return pullHeight;")();
  check("pulling up makes a box that stands on the bottom taller", pull(200, -60, "top", 42, 900) === 260);
  check("pulling down makes one that hangs from the top taller", pull(200, 60, "bottom", 42, 900) === 260);
  check("a box cannot be pulled past the window or shut past its grip",
        pull(200, 5000, "bottom", 42, 900) === 900 && pull(200, 5000, "top", 42, 900) === 42);
  check("the panel and the legend get a grip", /makePullable\(document\.querySelector\("\.panel"\), "bottom"\)/.test(src) &&
        /makePullable\(document\.getElementById\("legend"\), "top"\)/.test(src) && /\.pull-grip\{[^}]*cursor:ns-resize/.test(index));
  check("the scale bar no longer lies across the legend", /ScaleControl\([^)]*\), "bottom-left"\)/.test(src));
}


console.log("\ncoming back, and room to move");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  const fit = new Function(src.match(/const EYES_FIT[\s\S]*?\n};\n/)[0] +
                           src.match(/function handoffZoom[\s\S]*?\n/)[0] + "; return { EYES_FIT, handoffZoom };")();
  check("the hand-over happens at the size Earth has in Eyes, ",
        fit.EYES_FIT.zoom === 0.8 && fit.handoffZoom() === 0.8);
  check("the drop out of the map is a short one, not a zoom out to nothing",
        /handoffZoom\(\) - 0\.1/.test(src) && !/handoffZoom\(\) - 0\.45/.test(src));
  check("the way back is the screen's edge as well as the bar",
        /id="spaceEdge"/.test(index) && /\.space-edge \.se\{position:absolute;pointer-events:auto\}/.test(index) &&
        /edge\.addEventListener\("wheel"/.test(src) && /edge\.addEventListener\("dblclick"/.test(src));
  check("the flat map is handed its own camera back, so it can leave its edges",
        /function freeConstrain/.test(src) && /setTransformConstrain\(proj === "mercator" \? freeConstrain : null\)/.test(src));
  const free = new Function("maplibregl", src.match(/function freeConstrain[\s\S]*?\n}\n/)[0] + "; return freeConstrain;")(
    { LngLat: function (lng, lat) { return { lng, lat }; } });
  check("a centre well past the map's edge is kept, not pulled back",
        free({ lng: 260, lat: 40 }, 3).center.lng === 260 && free({ lng: 260, lat: 40 }, 3).zoom === 3);
  check("…but not past the poles", free({ lng: 0, lat: 120 }, 3).center.lat === 89.9);
  check("the flat map can be zoomed out until it floats", /setMinZoom\([\s\S]{0,70}: -2\)/.test(src));
  check("the news wires box hangs from the top, and opens down to the legend",
        /\.wire\{position:absolute;right:9px;top:var\(--wire-top,16px\);/.test(wireSrc) &&
        /\.wire\.open\{bottom:calc\(26px \+ var\(--wire-lift,0px\)\)\}/.test(wireSrc));
  check("the layer panel rolls up and down", /id="panelRoll"/.test(index) &&
        /\.panel\.shut > \*\{display:none\}/.test(index) && /classList\.toggle\("shut"/.test(src));
}
{
  const { map, els } = run();
  const el = (id) => globalThis.document.getElementById(id);
  const eased = [];
  map.setProjection = () => {}; map.setMinZoom = () => {}; map.setTransformConstrain = () => {};
  map.easeTo = (o) => { eased.push(o); if (o.zoom != null) map.zoom = o.zoom; };
  map.jumpTo = (o) => { if (o.zoom != null) map.zoom = o.zoom; };
  map.getCenter = () => ({ lng: 12, lat: 24 });
  const cont = { _l: {}, addEventListener(ev, fn) { (this._l[ev] ||= []).push(fn); }, appendChild() {} };
  map.getContainer = () => cont;
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  map.setZoom(4.5); map.fire("zoom");
  map.setZoom(0.4); map.fire("zoom");
  const wheel = () => (cont._l.wheel || []).forEach((fn) => fn({ deltaY: 40 }));
  wheel(); await new Promise((r) => setTimeout(r, 300)); wheel();
  await new Promise((r) => setTimeout(r, 1000));
  check("leaving eases to the hand-over size", eased.length === 1 && eased[0].zoom === 0.8);
  el("spaceBack").fire("click", {});
  check("coming back zooms in again, to the view that was left",
        eased.length === 2 && eased[1].zoom >= 1.4 && eased[1].duration >= 1000, JSON.stringify(eased.at(-1)));
}


console.log("\nthe boxes down the left");
{
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the settings box is on the right and the layers box on the left", /class="left-col"/.test(index) &&
        !/<div class="title-box">/.test(index) && /class="right-col">\s*<div id="basemaps" class="ctrl-box"/.test(index));
  check("the layer box holds the caret that rolls it",
        /panel-head[\s\S]{0,500}id="panelRoll"/.test(index) && /\.panel\.shut > \*\{display:none\}/.test(index));
  check("the zoom reading is off the page", !/id="zoomstate"/.test(index) && /const el = document\.getElementById\("zoomstate"\)/.test(src));
  check("only two views are offered", /"globe": \{ projection: "vertical-perspective"/.test(src) &&
        /"flat":  \{ projection: "mercator"/.test(src) && !/globe-flat/.test(src));
}
{
  const { map } = run();
  const el = (id) => globalThis.document.getElementById(id);
  const projections = [], eased = [];
  map.setProjection = (p) => projections.push(p.type);
  map.setMinZoom = () => {}; map.setTransformConstrain = () => {};
  map.easeTo = (o) => { eased.push(o); if (o.zoom != null) map.zoom = o.zoom; };
  map.jumpTo = (o) => { if (o.zoom != null) map.zoom = o.zoom; };
  map.getCenter = () => ({ lng: 12, lat: 24 });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const panel = el("basemaps");
  panel.fire("change", { target: { name: "view", value: "flat" } });
  map.setZoom(6);
  panel.fire("click", { target: { id: "leave-earth" } });
  await new Promise((r) => setTimeout(r, 1000));
  check("Leave Earth works from the flat map, at any zoom",
        el("spaceBack").hidden === false && projections.includes("vertical-perspective") && eased[0].zoom === 0.8);
  el("spaceBack").fire("click", {});
  check("coming back puts the flat map back", projections.at(-1) === "mercator" && eased.at(-1).zoom === 6);
}


console.log("\nthe wires on the map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the wires box has a tick box for the map", /id="wireOnMap" checked/.test(wireSrc) &&
        /\$onMap\.addEventListener\('change'/.test(wireSrc));
  check("a story keeps where it is: coordinates from the feeds, a country code from the map wires",
        /s\.at = findAt\(/.test(wireSrc) && /s\.iso = iso \|\| null/.test(wireSrc));
  check("what the box shows is what the map draws", /toTheMap\(all\)/.test(wireSrc) && /toTheMap\(\[\]\)/.test(wireSrc) &&
        /window\.culpritsWire\.show\(/.test(wireSrc));
  check("a news mark is a light dot with a dark rim inside a light ring",
        /id: "wire-news-ring"/.test(src) && /"circle-color": WIRE_COLOUR, "circle-radius": r\(0\)/.test(src) &&
        /"circle-stroke-color": WIRE_RIM/.test(src));
  check("the news marks are kept above every other layer", /function wireOnTop\(\)/.test(src) &&
        /map\.on\("styledata", wireOnTop\)/.test(src) && /map\.moveLayer\("wire-news"\)/.test(src));
  check("the stories at a mark are all listed and can be sorted", /const WIRE_SORTS = \[\["new", "Newest first"\]/.test(src) &&
        /function wirePopRows\(list, by\)/.test(src) && /\.wire-pop-list\{max-height:260px;overflow:auto/.test(index));
  check("stories that arrive before the map has loaded are drawn once it has", /function wireFlush\(\)/.test(src) &&
        /window\.__wirePending/.test(src) && /map\.on\("idle", wireFlush\)/.test(src));
  check("the outlines' sea is solid, with no relief on it", /"fill-color": "#0B1017", "fill-opacity": 1/.test(src) &&
        /type: "hillshade", source: "outline-dem", minzoom: 3\.5/.test(src));
  check("the compass sits between the views and Snap back, with a caption (24 September)", /class="compass-cap">North up, level</.test(src) &&
        /\.compass-holder\{display:flex;flex-direction:column;align-items:center;gap:3px;margin-top:14px\}/.test(index));
  check("story titles in its box are light text", /className: "wire-pop"/.test(src) && /\.wire-pop a\{color:#F2EEE6/.test(index));
  check("every layer can be ticked or unticked at once", /id="layersAllOn"/.test(index) && /id="layersAllOff"/.test(index) &&
        /const setAll = \(on\) =>/.test(src));
  check("Cerulean points read the whole record live, by id", /pointsCollection: "public\.slick_plus"/.test(src) &&
        /items\/\$\{encodeURIComponent\(p\.id\)\}\?bbox-only=true/.test(src));
  check("stories at one place become one mark that lists them",
        /wireAt\.get\(f\.properties\.k\)/.test(src) && /\["get", "n"\]/.test(src));
  check("the page itself does not scroll", /html,body\{margin:0;height:100%;overflow:hidden/.test(index));
  check("the globe opens with room around it, clear of the hand-over",
        /const OPENING_ZOOM = 1;/.test(src) && /EYES_FIT = \{ zoom: 0\.8/.test(src));
  check("Eyes opens on the address from its own embed panel",
        /surfaceMapTiling=true/.test(src) && !/detailPanel/.test(src) && !/collapseSettingsOptions/.test(src));
  check("the bar is gone; the way back is the box, and no circle over Eyes",
        !/space-bar/.test(index) && /id="spaceBack"/.test(index) && !/id="spaceEarth"/.test(index) &&
        /function showBack/.test(src) && /globeRadiusPx\(handoffZoom\(\)/.test(src));
}


// The Satellite basemap close in: one season of imagery all the way in, and
// (23 September, after the paleo-map plates) a green multiply that keeps the
// photograph's texture, where a see-through sheet flattened it.
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const chunk = src.slice(src.indexOf("const ATLAS_TUNE"), src.indexOf("const atlasWashes"));
  const f = new Function("abs", chunk + "\nreturn { SAT_CLOSE, SAT_TINT, atlasWashPasses, setB: (k) => { BASEMAP = k; } };")(() => "");
  f.setB("satellite");
  const at = (z) => f.atlasWashPasses(z);
  check("Satellite: no wash at any zoom, so nothing changes as you zoom in (the close-in multiply is off)",
        [2, 4, 8, 10, 12, 14, 18].every((z) => at(z).length === 0) && f.SAT_TINT.close.every((c) => c === 1));
  check("…the Sentinel-2 wide views are kept but switched off (SAT_CLOSE.s2 false): Esri's imagery at every zoom, as when patch o was made",
        /tiles: \["https:\/\/tiles\.maps\.eox\.at\/wmts\/1\.0\.0\/s2cloudless-2024_3857\/default\/g\/\{z\}\/\{y\}\/\{x\}\.jpg"\]/.test(src) &&
        /Contains modified Copernicus Sentinel data 2024/.test(src) &&
        /id: "base-s2", type: "raster", source: "s2", maxzoom: SAT_CLOSE\.handover\[1\]/.test(src) &&
        /id: "base-close", type: "raster", source: "base", minzoom: SAT_CLOSE\.handover\[0\]/.test(src) &&
        JSON.stringify(f.SAT_CLOSE.handover) === "[12.5,13.25]" &&
        /show\("base", kind === "atlas" \|\| \(kind === "satellite" && !SAT_CLOSE\.s2\)\);/.test(src) && /show\("base-s2", kind === "satellite" && SAT_CLOSE\.s2\);/.test(src) &&
        /show\("base-close", kind === "satellite" && SAT_CLOSE\.s2\);/.test(src) && f.SAT_CLOSE.s2 === false &&
        /\["base", "s2", "hillshade", "labels", "plate-base"\]\.includes\(src\)/.test(src));
  f.setB("atlas");
  check("…and the painted atlas's washes are unchanged by it", at(12).length === 4);
}

console.log("\nreading the map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  // 23 September, after the owner's paleo-map plates: natural ground colour,
  // a see-through terrain palette, Swiss-style shading, a calm sea.
  check("the Satellite basemap is patch paleo's look: sunlit imagery under a see-through terrain palette, Swiss shading and a calm sea; the atlas keeps its own grade",
        /satellite: \{ "raster-brightness-min": 0\.02, "raster-brightness-max": 0\.92,\n\s*"raster-saturation": 0\.12, "raster-contrast": 0\.06/.test(src) &&
        /atlas: \{ "raster-brightness-min": ATLAS_TUNE\.lift/.test(src) &&
        /id: "sat-relief-colour", type: "color-relief", source: "outline-dem"/.test(src) &&
        /id: "sat-relief-shade", type: "hillshade", source: "outline-dem", paint: SAT_RELIEF\.shade/.test(src) &&
        /id: "sat-relief-depth", type: "hillshade", source: "outline-dem", paint: SAT_RELIEF\.depth/.test(src) &&
        /id: "sat-relief-sea", type: "color-relief", source: "sea-dem",\n\s*paint: \{ "color-relief-color": SAT_RELIEF\.sea/.test(src) &&
        /show\("sat-relief-sea", kind === "satellite"\);/.test(src) && !/sat-relief-ridge/.test(src));
  {
    const block = src.slice(src.indexOf("const SAT_RELIEF = {"), src.indexOf("\n};", src.indexOf("const SAT_RELIEF = {")));
    const stops = (key, end) => [...block.slice(block.indexOf(key + ":"), block.indexOf(end)).matchAll(/(-?\d+), "rgba\((\d+),(\d+),(\d+),([\d.]+)\)"/g)]
      .map((m) => ({ h: +m[1], r: +m[2], g: +m[3], b: +m[4], a: +m[5] }));
    const colour = stops("colour", "colourOpacity"), land = colour.filter((c) => c.h > 0);
    check("…paleo's palette: see-through earth tones, green lowlands, then olive, khaki, ochre-brown, sienna and grey-brown rock; no white, no yellow",
          land.length >= 8 && land.every((c) => c.a <= 0.34 && Math.max(c.r, c.g, c.b) <= 140) &&
          land[0].g > land[0].r && land[0].g > land[0].b && land.slice(3, 6).every((c) => c.r > c.g && c.g > c.b) &&
          land.every((c) => !(c.r > 150 && c.g > 130 && c.b < 90)) &&
          block.includes('1, "rgba(46,52,34,0.32)"') && block.includes('-8000, "rgba(10,22,42,0.8)"'));
    check("…paleo's sea: navy deeps, lighter blue-green shelves, and a calm-sea layer above the shading that clears before the coast",
          colour.filter((c) => c.h < 0).every((c) => c.b >= c.r) &&
          stops("sea", "shade").filter((c) => c.h >= -80).every((c) => c.a === 0) &&
          stops("sea", "shade").filter((c) => c.h <= -3000).every((c) => c.a >= 0.5));
    check("…nothing eases off as you zoom in: tint, both lights and the sea hold their world-view strength, with faint lights (no sheen)",
          /colourOpacity: 1,/.test(block) && /"hillshade-exaggeration": 1,/.test(block) && /"hillshade-exaggeration": 0\.6,/.test(block) &&
          !/\["zoom"\]/.test(block.slice(0, block.indexOf("lift:"))) &&
          /"hillshade-illumination-direction": \[315, 270, 0, 225\]/.test(block) &&
          [...block.matchAll(/rgba\(240,236,222,([\d.]+)\)/g)].every((m) => +m[1] <= 0.1) &&
          /"fog-ground-blend": 0\.97/.test(src));
    check("…the sea's colours are drawn from depth tiles (Mapterhorn is land only, its sea is 0 m): navy deeps and shelves from the AWS heights, clear from the shore up",
          /map\.addSource\("sea-dem", Object\.assign\(\{\}, TERRAIN_SOURCE\)\)/.test(src) &&
          /id: "sat-relief-seabed", type: "color-relief", source: "sea-dem",\n\s*paint: \{ "color-relief-color": SAT_RELIEF\.seabed/.test(src) &&
          /id: "sat-relief-sea", type: "color-relief", source: "sea-dem"/.test(src) &&
          /show\("sat-relief-seabed", kind === "satellite"\);/.test(src) &&
          stops("seabed", "sea:").filter((c) => c.h >= 0).every((c) => c.a === 0) &&
          stops("seabed", "sea:").filter((c) => c.h <= -3500).every((c) => c.a >= 0.7 && c.b >= c.r));
    check("…no drawn water",
          !/sat-water/.test(src) && !/closeMultiply/.test(src) &&
          (src.match(/map\.addSource\("osm", Object\.assign\(\{\}, OSM_SOURCE\)\)/g) || []).length === 1);
    check("…the drawn relief reads its heights from Mapterhorn's 512-pixel squares, stopping at zoom 12, and the outline map shares them",
          /tiles: \["https:\/\/tiles\.mapterhorn\.com\/\{z\}\/\{x\}\/\{y\}\.webp"\],\n\s*encoding: "terrarium", tileSize: 512, maxzoom: 12,/.test(src) &&
          (src.match(/map\.addSource\("outline-dem", Object\.assign\(\{\}, RELIEF_SOURCE\)\)/g) || []).length === 2 &&
          !/addSource\("outline-dem", Object\.assign\(\{\}, TERRAIN_SOURCE\)\)/.test(src));
  check("\u2026with 3D terrain on, the ground is raised more the further out you are, and set again only when the step changes",
          /lift: \[\[3, 4\.5\], \[6, 3\], \[9, 2\], \[12, 1\.4\]\]/.test(block) && /map\.on\("zoomend", liftTerrain\)/.test(src) &&
          /if \(v === liftNow\) return;/.test(src) && /if \(BASEMAP !== "satellite"\) return TERRAIN_EXAGGERATION;/.test(src));
  }
  check("\u2026grey labels, the glow's fixed grain over it, and the atlas's tuning knob leaves it alone",
        /"raster-saturation", kind === "satellite" \? -1 : 0/.test(src) && /if \(kind === "satellite"\) glowGrain\(\);/.test(src) &&
        /BASEMAP === "satellite" \? GLOW\.grainSatellite : 0/.test(src) && /for \(const k of \["atlas"\]\)/.test(src));
  check("\u2026no teal atmosphere, no corner brackets, and threat halos small and faint",
        !/#2F8F93/.test(src) && !/class="br /.test(index) && !/rgba\(63,167,163/.test(index) && /1, 2\.5, 8, 5, 14, 8\]\);/.test(src));
  check("and carries the same washes", /BASEMAP === "outlines" \|\| !options/.test(src));
  check("the caret sits in the layer box, not the title box",
        /<div class="panel-head">[\s\S]{0,500}id="panelRoll"/.test(index) &&
        !/title-box[\s\S]{0,120}panelRoll/.test(index) && /\.panel\.shut > \.panel-head\{display:flex\}/.test(index));
  check("Subjects is a drop-down row at the top of the filters", /class="wire-filter wire-subjrow"><span>Subjects<\/span>/.test(wireSrc) &&
        wireSrc.indexOf("wire-subjrow") < wireSrc.indexOf('id="wireFilters"'));
  check("Refresh sits inside the box, beside the search", /<div class="wire-search">[\s\S]{0,260}id="wireRefresh"/.test(wireSrc));
  check("View and Basemap roll up on their own", /data-roll="\$\{key\}"/.test(src) && /sectHead\("View", "view"\)/.test(src) &&
        /sectHead\("Basemap", "basemap"\)/.test(src) && /\.sect\.shut \.sect-body\{display:none\}/.test(index));
  check("Climate TRACE draws plain dots, one size per zoom, in its own colours", /if \(cfg\.fine\)/.test(src) &&
        /"circle-radius": \["interpolate", \["linear"\], \["zoom"\], 0, 1\.2, 3, 1\.7, 6, 2\.4, 8, 3\]/.test(src) &&
        /colour: CT_COLOURS\[id\]/.test(src) && !/circle-sort-key/.test(src));
  check("the map draws at most 1.5 pixels per pixel, with no fades", /pixelRatio: Math\.min\(/.test(src) && /fadeDuration: 0/.test(src));
  check("terrain heights stop at zoom 12, and the Esri relief is put away under them",
        /encoding: "terrarium", tileSize: 256, maxzoom: 12/.test(src) && /show\("hillshade", kind === "atlas" && !TERRAIN_ON\)/.test(src));
  check("the outlines gain OpenStreetMap detail, relief and buildings closer in, with no key",
        /const OFM = "https:\/\/tiles\.openfreemap\.org\/planet"/.test(src) && !/dark_nolabels/.test(src) &&
        /type: "hillshade", source: "outline-dem"/.test(src) && /"source-layer": "building", minzoom: 13/.test(src) &&
        /OUTLINE_IDS\.forEach\(\(id\) => show\(id, !imagery\)\)/.test(src));
  check("Climate TRACE sources stand as columns by their emissions", /type: "fill-extrusion", source: "ct-columns"/.test(src) &&
        /Math\.sqrt\(v\) \* COLUMN_TALL \* mPerPx/.test(src) && /addColumnLayer\(\);/.test(src));
  check("the compass sits under the 3D terrain box", /id="compass-holder"/.test(src) && /querySelector\("\.maplibregl-ctrl-compass"\)/.test(src));
  check("the filters are not folded subject by subject",
        !/state\.expanded\[/.test(wireSrc) && /class="wire-filter"/.test(wireSrc));
  // The filters took so much of the box that no story could be read. They and the
  // time window now sit behind one Filters row, which says what is set.
  check("one Filters row holds every filter and the time window, shut until asked for",
        /id="wireFold" aria-expanded="false"/.test(wireSrc) && /filtersOpen: false/.test(wireSrc) &&
        wireSrc.indexOf('id="wireFoldBody"') < wireSrc.indexOf('id="wireFilters"') &&
        wireSrc.indexOf('id="wireFilters"') < wireSrc.indexOf('wire-when"><label') &&
        /\$foldBody\.hidden = !state\.filtersOpen/.test(wireSrc));
  {
    const WINDOWS = [{ id: "d7", label: "Last 7 days" }, { id: "all", label: "Any time" }];
    const foldSummary = new Function("WINDOWS", wireSrc.match(/function foldSummary[\s\S]*?\n}\n/)[0] + "; return foldSummary;")(WINDOWS);
    const said = foldSummary({ region: "Africa", topic: null }, "d7", (k) => k === "region" ? "Region" : k);
    check("\u2026and the row says what is set behind it, so a choice put away is still in view",
          said.length === 2 && said[0] === "Region: Africa" && said[1] === "Last 7 days" &&
          foldSummary({}, "all", (k) => k).length === 0);
  }
  check("\u2026whether it is open is remembered", /filtersOpen: state\.filtersOpen/.test(wireSrc) && /saved\.filtersOpen === true/.test(wireSrc));
  check("open, the filters sit two to a row and the stories keep the larger share of the box",
        /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(wireSrc) && /--wire-list-min', Math\.floor\(room \* 0\.6\)/.test(wireSrc) &&
        /--wire-facets-max', Math\.floor\(room \* 0\.4\)/.test(wireSrc) && !/max-height:34vh/.test(wireSrc));
  check("the news wires box starts under the whole right column, reload row included",
        /col \? col\.getBoundingClientRect\(\)\.bottom/.test(src) && /if \(col\) ro\.observe\(col\)/.test(src));
  check("Basemap comes before View in the settings box, so its three choices are never below the edge",
        /box\.innerHTML = basemapPanelHtml\(opts\) \+ viewPanelHtml\(\)/.test(src));
  check("the time window sits with the filters, below them",
        wireSrc.indexOf("id=\"wireFilters") < wireSrc.indexOf("wire-when\"><label") &&
        /class="wire-when"><label for="wireWhen">Time<\/label>/.test(wireSrc));
  check("slicks draw from zoom 6 and are counted from zoom 3",
        /drawFrom: 6/.test(src) && /const COUNT_FROM = 3/.test(src) && /map\.getZoom\(\) < COUNT_FROM/.test(src));
  check("the squares below the drawing zoom are a step finer than the view's tiles",
        /const wide = map\.getZoom\(\) < cfg\.drawFrom;/.test(src) && /\+ \(wide \? 1 : 0\)/.test(src));
  check("aggregate circles are small and sharp at world view",
        /"circle-blur": 0,/.test(src) && /0,  \["max", 2, \["\*", 0\.18 \* scale, MAGNITUDE_RADIUS\]\]/.test(src));
}


console.log("\nthe wires box, plainer");
{
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the map's boxes leave the screen in Eyes", /\[".left-col", ".right-col", "#legend", ".wire", "#zoombox"\]/.test(src));
  check("Leave Earth stands beside the two views", /<div class="view-row"><div class="view-choices">/.test(src) &&
        /\.view-row\{display:flex/.test(index));
  check("one list of subjects, with select all and clear all",
        /SUBJECTS\.slice\(\)\.sort/.test(wireSrc) && !/Topic feeds<\/p>/.test(wireSrc) &&
        /data-all="1">Select all/.test(wireSrc) && /data-none="1">Clear all/.test(wireSrc));
  check("the Subjects button reads as a drop-down", /wire-dd wire-subjects/.test(wireSrc) &&
        /\.wire-picker\{position:absolute/.test(wireSrc));
  check("one drop-down per filter, the same value from every subject as one option",
        /const kinds = \[\]/.test(wireSrc) && !/<optgroup label="/.test(wireSrc) && /merged\.set\(o\.label/.test(wireSrc));
  check("the per-subject line of numbers is gone",
        !/filters set/.test(wireSrc) && !/function subjectState/.test(wireSrc) && !/harvested /.test(wireSrc));
  check("refresh clears the filters too", /\$refresh\.addEventListener\('click', \(\) => \{[\s\S]{0,120}state\.sel = \{\}/.test(wireSrc));
  check("the tick box says what it does", /show them on the map</.test(wireSrc));
  check("the wires box is not dragged", !/makePullable\(w, "top"\)/.test(src) && /makePullable\(document\.getElementById\("legend"\), "top"\)/.test(src));
  check("stories are rings, sized by how many are there",
        /id: "wire-news", type: "circle"/.test(src) && /\["get", "n"\], 1, 2\.8 \+ add/.test(src) &&
        !/wireDiamond/.test(src));
}


console.log("\nterrain, and the two labels");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("terrain comes from a keyless elevation source",
        /elevation-tiles-prod\/terrarium/.test(src) && /encoding: "terrarium"/.test(src) &&
        !/key=|api_key|access_token/.test(src.slice(src.indexOf("TERRAIN_SOURCE"), src.indexOf("TERRAIN_EXAGGERATION"))));
  check("switching it on sets terrain and leans the camera over",
        /map\.setTerrain\(\{ source: "terrain-dem"/.test(src) && /pitch: 55/.test(src) &&
        /map\.setTerrain\(null\)/.test(src));
  check("the settings box carries the tick box", /id="terrain-toggle"/.test(src) &&
        /e\.target\.id === "terrain-toggle"/.test(src));
  check("nothing about the emitting assets is blurred", /"circle-blur": 0,/.test(src) &&
        !/"circle-blur": \["interpolate"/.test(src));

  const kinds = new Function(src.match(/const LAYER_KIND = \{[\s\S]*?\n\};\n/)[0] +
                             src.match(/const KIND_PREFIXES = \[[\s\S]*?\n\];\n/)[0] +
                             src.match(/function kindOf[\s\S]*?\n}\n/)[0] +
                             "; return { kindOf, LAYER_KIND };")();
  const ids = [...new Set([...src.matchAll(/\{ *id: *"([a-z0-9_]+)", *name/g)].map((m) => m[1])
    .concat([...src.matchAll(/\{ id:"([a-z0-9_]+)", *name/g)].map((m) => m[1])))];
  const unlabelled = ids.filter((id) => !kinds.kindOf(id)[0]);
  check("every layer carries both labels", unlabelled.length === 0, unlabelled.slice(0, 6).join(", "));
  const names = ["human", "animal", "plant", "microorganism", "insentient"];
  check("the labels are the five worlds and the two directions",
        ids.every((id) => names.includes(kinds.kindOf(id)[0]) &&
                          ["upstream", "downstream"].includes(kinds.kindOf(id)[1])));
  check("the animals are with the animals", kinds.kindOf("abattoir_facilities")[0] === "animal" &&
        kinds.kindOf("allen_coral")[0] === "animal" && kinds.kindOf("site_circus")[0] === "animal");
  check("the plants and the microorganisms have their own",
        kinds.kindOf("site_enslaved_plants")[0] === "plant" &&
        kinds.kindOf("site_enslaved_microbes")[0] === "microorganism" &&
        kinds.kindOf("gfw")[0] === "plant");
  check("finance and permitting are upstream, the sites where it lands are downstream",
        kinds.kindOf("site_export_credit")[1] === "upstream" && kinds.kindOf("carbon_majors")[1] === "upstream" &&
        kinds.kindOf("slavery_cases")[1] === "downstream" && kinds.kindOf("epa_tri")[1] === "downstream");
  check("the chips narrow the list without switching anything off",
        /function applyKindFilter/.test(src) && /row\.style\.display = wanted/.test(src) &&
        /\.facet\[data-for\]/.test(src) &&
        !/applyKindFilter[\s\S]{0,400}setLayoutProperty/.test(src) && /\.kinds \.facet\{padding:0 0 6px\}/.test(index));
}


console.log("\neach site map's own filters");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("a map's filters come from its own places file", /Array\.isArray\(data\.filters\)/.test(src) &&
        /sitemapFilters\.set\(cfg\.id/.test(src));
  check("a chip is a substring test, so a place can belong to more than one",
        /\["in", `\|\$\{k\}\|`, \["coalesce", \["get", "f"\], ""\]\]/.test(src));
  check("the chips sit under the map's own row",
        /el\.dataset\.for = `\$\{cfg\.id\}-\$\{i\}`/.test(src) && /anchor\.after\(el\)/.test(src));
}
{
  const places = { type: "FeatureCollection", name: "Test Map", overlays: [],
    filters: [{ label: "Category", values: [{ k: "circus", label: "Circuses", n: 2 }, { k: "marine", label: "Marine Shows", n: 1 }] }],
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [10, 20] }, properties: { k: "a", n: "One", f: "|circus|" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [11, 21] }, properties: { k: "b", n: "Two", f: "|marine|" } },
    ] };
  const { map } = run({ fetchImpl: async (u) => ({ ok: true, status: 200, json: async () => places }) });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const panel = globalThis.document.getElementById("layers");
  panel.fire("change", { target: { dataset: { layer: "site_circus" }, checked: true } });
  await new Promise((r) => setTimeout(r, 10));
  const pt = map.getLayer("site_circus-pt");
  check("the map draws everything until a chip is ticked",
        JSON.stringify(pt.filter) === JSON.stringify(["match", ["geometry-type"], ["Point", "MultiPoint"], true, false]));
  panel.fire("click", { target: { closest: (s) => (s === ".chip" ? { dataset: { sm: "site_circus", fi: "0", k: "circus" } } : null) } });
  const f = map.getLayer("site_circus-pt").filter;
  check("ticking one narrows the map to it", JSON.stringify(f).includes('["in","|circus|"'), JSON.stringify(f));
  check("…and leaves the map's own geometry filter in place", Array.isArray(f) && f[0] === "all");
  panel.fire("click", { target: { closest: (s) => (s === ".chip" ? { dataset: { sm: "site_circus", fi: "0", k: "" } } : null) } });
  check("the all chip puts the whole map back",
        JSON.stringify(map.getLayer("site_circus-pt").filter) ===
        JSON.stringify(["match", ["geometry-type"], ["Point", "MultiPoint"], true, false]));
}


console.log("\nthe view row, and terrain where it works");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the boxes on the left actually fade out", /\.left-col\.away,\.panel\.away/.test(index));
  check("terrain is drawn on the globe view round, and on the flat map flat",
        /return \(TERRAIN_ON \|\| raised\) && p !== "mercator" \? "globe" : p;/.test(src));
  check("the map tilts to 85 degrees and rolls", /maxPitch: 85/.test(src) && /rollEnabled: true/.test(src));
  check("the compass shows tilt and turn", /showCompass: true, visualizePitch: true/.test(src));
  check("Snap back to global scale sits over Leave Earth", /id="to-globe" class="snap"/.test(src) &&
        /Snap back to global scale<\/button>/.test(src) && /function outToTheGlobe/.test(src));
  check("the sky over a tilted map is dark slate", /"sky-color": "#1B242B"/.test(src));
  check("the zoom buttons are moved into their own box",
        /function moveZoomButtons/.test(src) && /holder\.insertBefore\(group/.test(src) &&
        !/\.maplibregl-ctrl-bottom-right \.maplibregl-ctrl-group\{position:absolute/.test(index));
  check("Snap back, Leave Earth and the zoom buttons all sit right of the view choices",
        /<div class="view-go">/.test(src) && /\.view-go\{flex:1 1 auto/.test(index));
}
{
  const { map } = run();
  const projections = [];
  map.setProjection = (p) => projections.push(p.type);
  map.setMinZoom = () => {}; map.setTransformConstrain = () => {};
  const terrains = [];
  map.setTerrain = (t) => terrains.push(t && t.source);
  map.getPitch = () => 0;
  map.easeTo = () => {};
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const panel = globalThis.document.getElementById("basemaps");
  panel.fire("change", { target: { id: "terrain-toggle", checked: true } });
  check("terrain on draws on the globe", projections.at(-1) === "globe" && terrains.at(-1) === "terrain-dem");
  panel.fire("change", { target: { name: "view", value: "flat" } });
  check("…and on the flat map, which stays flat", projections.at(-1) === "mercator" && terrains.at(-1) === "terrain-dem");
  panel.fire("change", { target: { id: "terrain-toggle", checked: false } });
  check("terrain off gives the chosen view back", !terrains.at(-1) && projections.at(-1) === "mercator");
}

console.log("\nlegibility");
{
  const { map } = run({ layersReady: "cerulean_slicks" });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const agg = map.getLayer("cerulean_slicks-agg");
  check("slick counts are shaded squares, not a dot at each square's centre",
        agg && agg.type === "fill" && JSON.stringify(agg.paint["fill-opacity"]).includes("log10"));
}
{
  const { map } = run({ layersReady: "allen_coral" });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const fill = map.getLayer("allen_coral-fill");
  const colour = fill && fill.paint["fill-color"];
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const classes = JSON.parse(src.match(/const CORAL_CLASSES = (\{[\s\S]*?\});/)[1].replace(/,\s*\}/, "}"));
  check("every benthic class the Atlas names has its own colour",
        Array.isArray(colour) && colour[0] === "match" &&
        ["Coral/Algae", "Seagrass", "Sand", "Rubble", "Rock", "Microalgal Mats"].every((c) => colour.includes(c)));
  check("reef fills are strong enough to see over water", fill.paint["fill-opacity"] >= .6);
  // The palette rule: no orange or yellow (a saturated hue between 20° and 70°).
  const hue = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return [0, 0];
    let x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(x * 60 + 360) % 360, d / (1 - Math.abs(mx + mn - 1))]; };
  const bad = Object.entries(classes).filter(([, h]) => { const [hh, sat] = hue(h); return sat > .25 && hh >= 20 && hh <= 70; });
  check("no reef class is orange or yellow", bad.length === 0, JSON.stringify(bad));
}

console.log("\ncerulean points, the fit, and how to tilt");
{
  const fetchImpl = async (u, o) => {
    fetched.push(u);
    if (o && o.method === "HEAD" && String(u).includes("cerulean_slick_points")) {
      return { ok: true, status: 200, headers: { get: (h) => (h === "content-length" ? "4096" : null) } };
    }
    if (String(u).includes("limit=0")) return { ok: true, status: 200, json: async () => ({ numberMatched: 5 }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const { map, els } = run({ layersReady: "cerulean_slicks", fetchImpl });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  check("the points file is not asked for while the layer is off",
        !fetched.some((u) => String(u).includes("cerulean_slick_points")));
  els.get("layers").fire("change", { target: { dataset: { layer: "cerulean_slicks" }, checked: true } });
  await new Promise((r) => setTimeout(r, 20));
  const pt = map.getLayer("cerulean_slicks-pt");
  check("switched on, every slick is drawn as a point below the shapes", pt && pt.type === "circle" && pt.maxzoom === 6);
  const counts = map.sources.get("cerulean_slicks-counts")._data;
  check("…and the counted squares are not drawn", !counts || counts.features.length === 0);
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the slick sources get points too", /points: "cerulean_source_points", pointsUntil: 8/.test(src));
  check("the harvester exists and asks for boxes, not shapes",
        /"bbox-only": "true"/.test(fs.readFileSync(path.join(HERE, "..", "pipeline", "cerulean", "harvest_points.py"), "utf8")));
  check("the fit carries the measured numbers and a turn",
        /const EYES_FIT = \{ zoom: 0\.8, lon: -108, lat: 66, bearing: 0,/.test(src) && /e\.key === "\["/.test(src));
  check("how to move in 3D sits under the view choices, headed, the box's whole width (round 96b)", /class="how-3d"><div class="how-h">Moving the map in 3D<\/div>/.test(src) && /<b>Mouse<\/b>/.test(src) &&
        /<b>Trackpad<\/b>/.test(src) && /The same on Mac and Windows/.test(src));
}

console.log("\nother organisations' maps: PalmWatch");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("PalmWatch is one row in its own group", /const OTHER_MAPS = \{[\s\S]*id: "palmwatch"[^\n]*route: "sitemap"/.test(src) &&
        /const GROUPS = \[[^\]]*OTHER_MAPS,/.test(src));
  check("its copy is served from GitHub, not the Worker",
        /id: "palmwatch"[^\n]*dataUrl: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/sitemaps\/palmwatch\.places\.geojson"/.test(src));
  check("its note says the catchment is modelled, not a boundary", /modelled sourcing area, not a property boundary/.test(src));
  check("a colour chip is handled before the filter chips",
        src.indexOf("if (btn.dataset.smc)") > 0 && src.indexOf("if (btn.dataset.smc)") < src.indexOf("if (btn.dataset.sm) {"));
  const body = src.slice(src.indexOf("function colouringExpression("), src.indexOf("function colouringLegend("));
  const colouringExpression = new Function("return " + body)();
  const loss = { k: "loss", prop: "l{year}", year: 2025, breaks: [0.25, 1.5], colours: ["#a", "#b", "#c"] };
  const e = colouringExpression(loss, 2019);
  check("the chosen year picks that year's value", JSON.stringify(e).includes('"l2019"'));
  check("breaks step up as PalmWatch's do", JSON.stringify(e[2]) === JSON.stringify(["step", ["to-number", ["get", "l2019"], 0], "#a", 0.25, "#b", 1.5, "#c"]));
  const s = colouringExpression({ k: "cur", prop: "cur", scores: [1, 2], colours: ["#x", "#y"] });
  check("a score is matched value by value", s[0] === "match" && s.includes("#x") && s.includes("#y"));
  check("the colours carry no orange or yellow", !/#(F[0-9A-F]{2}[0-9A-F]{3}|FF[A-F0-9]{2}00)/i.test(body));
}

console.log("\nheavy shape layers, lighter");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const b = fs.readFileSync(path.join(HERE, "..", "pipeline", "shapes", "build_shapes.py"), "utf8");
  check("the builder keeps long text in a details file", /\.details\.json/.test(b) && /"details": bool\(details\)/.test(b));
  check("…and drops no field: what leaves the shape goes to the details", /details\[str\(i\)\] = heavy/.test(b));
  check("the map reads the details on the first click, once per layer",
        /function loadShapeDetails\(/.test(src) && /shapeDetails\.has\(at\)/.test(src));
  check("a box waits for its details rather than showing without them",
        /typeof out\.then === "function"/.test(src) && /loading\\u2026/.test(src));
  check("the mover carries the details file", /\.details\.json/.test(fs.readFileSync(path.join(HERE, "..", "pipeline", "sitemaps", "move_to_tile_repos.sh"), "utf8")));
}

console.log("\nthe USDA explorers, live");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("both explorers are rows in Other organisations' maps",
        /id: "usda_soybean"[^\n]*route: "arcgis"/.test(src) && /id: "usda_corn"[^\n]*route: "arcgis"/.test(src));
  check("they read USDA's own map servers, not the Worker or a copy",
        /CommodityExplorerSoybean\/MapServer/.test(src) && /CommodityExplorerCorn\/MapServer/.test(src) &&
        !/usda_[a-z]+[^\n]*WORKER/.test(src));
  check("the map image is asked square by square as the view moves", /\/export\?bbox=\{bbox-epsg-3857\}/.test(src));
  check("a tick creates the layer through the usual lazy path", /cfg\.route === "arcgis" \? Promise\.resolve\(\)\.then\(\(\) => addArcgisLayer\(cfg\)\)/.test(src));
  const body = src.slice(src.indexOf("function arcgisBox("), src.indexOf("/* ---------- the sky the map sits in"));
  const escapeHtml = (s) => String(s);
  const arcgisBox = new Function("escapeHtml", body + "; return arcgisBox;")(escapeHtml);
  const cfg = { crop: "Soybean", name: "Soybean Map Explorer" };
  const h = arcgisBox(cfg, { layerName: "Soybean Percentage", attributes: { cntryname: "Brazil", name: "Mato Grosso", rank: 1 } });
  check("a click on the crop layer opens the explorer's own box", h.includes("Soybean - Brazil") && h.includes("Sub Region: Mato Grosso") && h.includes("Rank: 1"));
  const g = arcgisBox(cfg, { layerName: "Crop Explorer Subregions", attributes: { name: "Paraná" } });
  check("…and on the outline layer, the sub-region's name", g.includes("<b>Paraná</b>"));
}

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
  check("the wastewater model offers its five layers", (src.match(/tiles\/wastewater_N_[a-z_]+\.pmtiles/g) || []).length === 5);
  check("a picture that fails says so on its row", /the source did not answer for \$\{failed\} square/.test(src));
}

console.log("\ncoral, the row's line");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("an unticked row says to tick it rather than keeping old text", /tick this row to draw the reefs here/.test(src));
  check("a failure reading the squares is said on the row and in the console",
        /could not read the Atlas's squares/.test(src) && src.includes("console.warn(`[culprits] ${cfg.id}: ${e.message}`)"));
}

console.log("\ncoral at every zoom");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("from 12 in, the Atlas's own picture is drawn under its shapes, with no upper stop",
        /allencoralatlas\.org\/geoserver\/ows\?SERVICE=WMS/.test(src) &&
        /id: `\$\{cfg\.id\}-raster`, type: "raster", source: `\$\{cfg\.id\}-wide`,\n\s*minzoom: CORAL_ATLAS_PICTURE_FROM/.test(src));
  check("…in the coral colour, not the server's black", /tint:\/\/\$\{CORAL_CLASSES\["Coral\/Algae"\]\.slice\(1\)\}/.test(src));
  const tint = new Function(src.slice(src.indexOf("function tintPixels("), src.indexOf('maplibregl.addProtocol("latclip"')) + "; return tintPixels;")();
  const d = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]);
  tint(d, [176, 111, 106]);
  check("drawn pixels take the colour, empty ones stay empty", d[0] === 176 && d[3] === 255 && d[4] === 0 && d[7] === 0);
  check("UNEP-WCMC's reefs are a row of their own, live", /id: "unep_coral"[^\n]*route: "arcgis"/.test(src) &&
        /Global_Distribution_of_Coral_Reefs\/MapServer/.test(src));
}

console.log("\nTrase, and coral at world zoom");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  // Superseded on 20 September: one row with three menus (country, level,
  // measure) became one row per measure, drawn across every country at once.
  check("Trase's measures are rows of the box, not menus in one row", /id: "trase_measures"[^\n]*route: "trase"/.test(src) &&
        !/data-tr="metric"/.test(src) && /data-tr="year"/.test(src) && /data-tr="level"/.test(src));
  {
    const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
    const T = new Function(pick("function traseMeasures(", "async function addTraseLayer(") + pick("function traseJoin(", "async function traseDraw(") +
      "; return { traseMeasures, trasePlan, traseJoin };")();
    const m = (name, years) => ({ display_name: name, unit_abbreviation: "ha", years });
    const cat = {
      brazil: { name: "BRAZIL", levels: { state: { name: "State", metrics: { DEF: m("Deforestation", [2020, 2022]), SOY: m("Soy area", [2022]) } },
                                          municipality: { name: "Municipality", metrics: { DEF: m("Deforestation", [2020, 2022]) } } } },
      paraguay: { name: "PARAGUAY", levels: { department: { name: "Department", metrics: { DEF: m("Deforestation", [2019]), SOY2: m("Soy area", [2019]) } } } },
    };
    const list = T.traseMeasures(cat);
    const def = list.find((e) => e.metric === "DEF");
    check("\u2026one entry per measure, naming every country that publishes it", list.length === 3 &&
          def.title === "Deforestation (ha) \u2014 Brazil, Paraguay (Trase)");
    check("\u2026two measures Trase gives one name are told apart by Trase's own ids",
          list.filter((e) => /^Soy area \[SOY2?\]/.test(e.title)).length === 2);
    const own = T.trasePlan(def, "", "");
    check("\u2026each country is drawn at one level only, and by default at its own latest year",
          own.draw.length === 2 && own.draw[0].level === "municipality" && own.draw[0].year === 2022 &&
          own.draw[1].level === "department" && own.draw[1].year === 2019 && own.left.length === 0);
    const asked = T.trasePlan(def, "", "2020");
    check("\u2026a country with nothing for the chosen year is left out and named, not drawn from another year",
          asked.draw.length === 1 && asked.draw[0].country === "brazil" && /Paraguay/.test(asked.left[0]));
    const soy = T.trasePlan(list.find((e) => e.metric === "SOY"), "", "");
    check("\u2026a measure Trase publishes only by state is drawn by state", soy.draw[0].level === "state");
    const joined = T.traseJoin({ name: "Brazil", country: "brazil", levelName: "State", year: 2022 },
      { features: [{ geometry: null, properties: { code: "BR-1", name: "Acre" } }, { geometry: null, properties: { code: "BR-2", name: "Bahia" } }] },
      { 2022: { "BR-1": 5 } });
    check("\u2026values are joined to Trase's shapes by its region id, and a region with none says so",
          joined[0].properties._v === 5 && joined[1].properties._v === null && joined[0].properties._country === "Brazil");
    check("\u2026the colours use one set of steps across every country drawn", /traseBreaks\(features\.map\(\(f\) => f\.properties\._v\)\)/.test(src));
  }
  // The plants, microorganisms and insentient maps say what kind of company a
  // point is only inside its popup. The build reads that tag; the box gives each type a row.
  {
    const build = fs.readFileSync(path.join(HERE, "..", "pipeline", "sitemaps", "build_boxes.py"), "utf8");
    const reg = JSON.parse(fs.readFileSync(path.join(HERE, "..", "pipeline", "sitemaps", "registry.json"), "utf8")).maps;
    check("the site-map build reads a place's type from its popup tag, for the nine maps asked for and no others",
          /def popup_types\(features\):/.test(build) && /if not filters and m\.get\("types_from_popup_tag"\):/.test(build) &&
          // Six more asked for on 23 September.
          reg.filter((m) => m.types_from_popup_tag).map((m) => m.id).sort().join() ===
            "site_enslaved_microbes,site_enslaved_plants,site_indigenous_conflicts,site_insentient,site_research_integrity,site_self_sufficiency,site_world_advertising,site_world_entertainment,site_world_news");
    check("\u2026and each of those maps has a row per type in the box, in place of its one row",
          ["site_enslaved_plants", "site_enslaved_microbes", "site_insentient"].every((i) => new RegExp(`id: "${i}", typeRows: true`).test(src)) &&
          /readCataloguesAtStart\(\);\n  readSiteTypeRowsAtStart\(\);/.test(src) && /own_nodes\.forEach\(\(n\) => gone\.appendChild\(n\)\)/.test(src));
    const title = new Function(src.match(/function siteTypeTitle[^\n]*\n/)[0] + "; return siteTypeTitle;")();
    check("\u2026titled for the type and the map it belongs to", title("Lawns & sports turf", "Plants 2026") === "Lawns & sports turf \u2014 Plants 2026");
    check("\u2026with no type ticked the map is off, and All on ticks every type",
          /own\.checked = tr\.picked\.size > 0;/.test(src) && /tr\.picked = new Set\(own\.checked \? boxes\(\)\.map/.test(src) &&
          /siteTypeRows\.get\(cfg\.id\)\.fi === i\) return;/.test(src));
  }
  {
    const places = new Function(src.slice(src.indexOf('const P = "Destruction > Of the planet";'), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
    const ctGasRows = new Function("ctChild", "CT_COLOURS", src.slice(src.indexOf("const CT_GASES_BASE"), src.indexOf("async function addCtGasesLayer")) + "; return ctGasRows;")((id, label, base) => ({ id, name: label, archiveUrl: `${base}/tiles/${id}.pmtiles` }), {});
    const rows = ctGasRows({ ch4: { name: "methane", archives: [{ id: "climate_trace_ch4_rice_cultivation", subsector: "rice_cultivation", label: "rice cultivation" }] },
                             co2: { name: "carbon dioxide", archives: [{ id: "climate_trace_co2_electricity_generation", subsector: "electricity_generation", label: "electricity generation" }] } });
    check("Climate TRACE by gas: a row per gas and subsector, drawing its own archive from the tiles repo, filed by the gas in its title",
          rows.length === 2 && rows[0].title === "Rice cultivation \u2014 methane, tonnes a year, every site and period (Climate TRACE)" &&
          rows[0].cfg.archiveUrl === "https://welcometoyourgalaxy.github.io/culprits-tiles-gases/tiles/climate_trace_ch4_rice_cultivation.pmtiles" &&
          places(rows[0].fileBy).join() === "Destruction > Of the planet > Climate > Methane > Emissions" && places(rows[1].fileBy).join() === "Destruction > Of the planet > Climate > Carbon dioxide > Emissions" &&
          /id: "ct_gases"[^\n]*route: "ctgases"/.test(src) && /cfg\.route === "ctgases" \? addCtGasesLayer\(cfg\)/.test(src));
  }
  check("the catalogues' lists are read once the box is arranged, since their own rows are hidden and never ticked",
        /const CATALOGUE_ROUTES = new Set\(\["wmsmenu", "gfwmenu", "trase", "ctgases", "gsn"\]\)/.test(src) &&
        /box\.appendChild\(gone\);\n  wireInfoMarks\(\);\n  readCataloguesAtStart\(\);/.test(src) && /PANEL_REMOVED\.has\(c\.id\)\) ensureLayer\(c\)/.test(src));
  check("its shapes are read live from Trase", /regions: "https:\/\/resources\.trase\.earth\/data\/trase-regions"/.test(src));
  check("its values come from the weekly GitHub copy", /catalogue: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/trase\/catalogue\.json"/.test(src));
  const slug = new Function(src.slice(src.indexOf("function traseSlug("), src.indexOf("// Five steps from the values")) + "; return traseSlug;")();
  check("Trase's country names match its slugs", slug("COTE D'IVOIRE") === "cote-d-ivoire" && slug("BRAZIL") === "brazil");
  const br = new Function(src.slice(src.indexOf("function traseBreaks("), src.indexOf("function traseFormat(")) + "; return traseBreaks;")();
  check("steps come from the values themselves", JSON.stringify(br([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) === "[3,5,7,9]");
  check("the ramps carry no orange or yellow", !/#(F[A-F0-9]{5}|E[6-9A-F][0-9A-F]{2}[0-4][0-9A-F])/i.test(src.slice(src.indexOf("const TRASE_RAMPS"), src.indexOf("const traseCache"))));
  check("wider than zoom 12, coral shows UNEP-WCMC's map in the Atlas colour, with no gap",
        /id: `\$\{cfg\.id\}-world`, type: "raster", source: `\$\{cfg\.id\}-globe`, maxzoom: CORAL_WORLD_SHARP/.test(src) &&
        /id: `\$\{cfg\.id\}-world-near`[\s\S]{0,160}minzoom: CORAL_WORLD_SHARP,\n/.test(src) &&
        /tint:\/\/\$\{how \|\| CORAL_CLASSES\["Coral\/Algae"\]\.slice\(1\)\}\/data-gis\.unep-wcmc\.org/.test(src));
  check("from the world view the reefs are drawn coarse, so a reef a few hundred metres across can be seen",
        /wcmc\(256, CORAL_WORLD_TINT \+ "\+grow"\)/.test(src) && /wcmc\(256\)/.test(src) /* round 135b: full size, smoothed (white squares) */);
  check("…and the row says whose map it is", /UNEP-WCMC's warm-water reefs at this width/.test(src));
  check("the switch reaches the world layer", /`\$\{id\}-world`/.test(src));
}

console.log("\nthe layers box, in the chosen order");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const ids = order.PANEL_ORDER.filter((x) => typeof x === "string" && !x.startsWith("group:") && x !== "gm");
  // A row inside a group (a Climate TRACE subsector) counts: round 75 names them under their gas.
  const real = (id) => new RegExp(`id: ?"${id}"|\\["${id}", "`).test(src);
  check("every id in the order is a real layer", ids.every(real), ids.filter((id) => !real(id)).join(", "));
  // Superseded: a layer that belongs to two subjects is named under both, and the
  // box makes the second naming a copy of the row (copyRow), never a second layer.
  const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
  check("a layer named under two headings is one row and a copy of it, never two layers",
        /if \(placed\.has\(item\)\) \{\n\s*const copy = copyRow\(leads\.get\(item\), item\);/.test(src) &&
        // A row may sit under as many subjects as it belongs to (the crime
        // tracker is under four); each naming after the first is a copy.
        twice.every((id) => ids.filter((x) => x === id).length >= 2), twice.join(", "));
  {
    const feeds = ["skytruth_nrc", "skytruth_posts", "skytruth_marine_incidents", "skytruth_pa_permits", "skytruth_pa_spud",
                   "skytruth_pa_violations", "skytruth_well_permits", "skytruth_fracfocus", "skytruth_quakes"];
    const at = (t) => order.PANEL_ORDER.findIndex((x) => x && x.t === t);
    // Tiles since 22 September: a feed's copy ran to 86 MB in one file, and a
    // browser had to read all of it to draw a point.
    check("SkyTruth Monitor's alert feeds are rows drawn from tiles, each with its own pieces to read a record from",
          feeds.every((id) => new RegExp(`id: "${id}"[^\\n]*route: "pmtiles"[^\\n]*archiveUrl: "[^"]*/tiles/${id}\\.pmtiles"`).test(src) && (ids.includes(id) || order.PANEL_REMOVED.has(id))) &&
          (src.match(/boxes: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/skytruth\/(feed_\d+|vessels_of_concern)"/g) || []).length === 11 &&
          !/skytruth\/feed_\d+\.geojson/.test(src));
    const pieceOf = new Function(src.match(/function pieceOf[\s\S]*?\n}\n/)[0] + "; return pieceOf;")();
    check("\u2026a record's piece is found by the same hash the copy was written with",
          pieceOf("abc") === "0b" && pieceOf("5bef4812-71a8-7a20-02c5-9c88ef953109") === "37");
    check("\u2026a merged point says how many it stands for; a single one shows the record's own box and every other field",
          /bindHtmlPopup\(`\$\{cfg\.id\}-pt`, \(p\) => pieceBox\(cfg, p\)\)/.test(src) && /props\._html \|\| `<b>/.test(src) && /Merged for this zoom/.test(src));
    // Round 23 (item 2): the Oil and gas drilling heading is gone; the fracking
    // disclosures and the Pennsylvania heading are under Infrastructure
    // emitting more than one gas.
    // Round 75: the wells under Methane's infrastructure and where spills start;
    // the Pennsylvania rows and the several-gases heading are gone.
    check("\u2026filed by what they show: spill reports under slicks and pollution, the wells under Methane's infrastructure and Oil spills",
          at("Oil and gas drilling") === -1 && at("Infrastructure emitting more than one gas") === -1 && at("Pennsylvania") === -1 &&
          order.PANEL_ORDER.indexOf("skytruth_fracfocus") > at("Methane") && order.PANEL_ORDER.lastIndexOf("skytruth_fracfocus") > at("Where oil and gas is drilled") &&
          ids.filter((x) => x === "skytruth_nrc").length === 1 && !ids.includes("skytruth_pa_violations") &&
          ["skytruth_pa_permits", "skytruth_pa_spud", "skytruth_pa_violations", "skytruth_well_permits"].every((i) => order.PANEL_REMOVED.has(i)));
    check("\u2026the developers' test feed is kept as a layer but out of the box (the owner took Housekeeping out, 24 September)",
          /id: "skytruth_tests"[^\n]*route: "pmtiles"/.test(src) && /skytruth\/feed_10101"/.test(src) && !ids.includes("skytruth_tests"));
    check("\u2026an alert with no position is counted on its row, not passed over",
          /if \(!ft\.geometry\) \{ nowhere\+\+; return; \}/.test(src) && /more in the copy have no position and cannot be drawn/.test(src));
    check("\u2026and the vessels row no longer claims the last 30 days, which the service never applied",
          !/id: "skytruth_voc"[^\n]*last 30 days/.test(src) && !/vessels-of-concern alerts for the whole world over the last 30 days/.test(src));
  }
  check("nothing is both placed and removed", ids.every((id) => !order.PANEL_REMOVED.has(id)));
  // Round 105b: the threat index sits between Selected Layers and the four sections.
  const heads = order.PANEL_ORDER.filter((x) => typeof x === "object" && x.h === 1 && x.t !== "Where the threat is greatest").map((x) => x.t);
  check("Selected Layers is one layer at the very top (round 60), then the four sections in order",
        order.PANEL_ORDER[0].bundle === "selected" && heads.slice(1, 5).join("|") === "On-planet invasion|Destruction|Suppression|Off-planet invasion");
  check("unplaced layers get their own heading, not the bin", /heading\(1, "Not yet placed"\)/.test(src));
  check("removed rows stay findable by the code", /gone\.hidden = true/.test(src));
  check("the Trase row no longer shares an id", (src.match(/id: ?"trase"/g) || []).length === 1);
  const esc = (s) => String(s);
  const umapText = new Function("escapeHtml", src.slice(src.indexOf("function umapText("), src.indexOf("// A uMap popup template")) + "; return umapText;")(esc);
  const umapPopup = new Function("umapText", src.slice(src.indexOf("function umapPopup("), src.indexOf("async function readUmap(")) + "; return umapPopup;")(umapText);
  const h = umapPopup("# {name}\n*{address}*\n\n{sector}\n\n{description}", { name: "Shell", address: "Belvedere Rd", sector: "Oil", description: "HQ" });
  check("a uMap box follows the map's own template", h.includes("<h3") && h.includes("Shell") && h.includes("<i>Belvedere Rd</i>") && h.includes("Oil"));
  check("uMap layers are found where the map says they are", /props\.urls && \(props\.urls\.datalayer_view/.test(src));
  check("My Maps places given only as an address are placed from the weekly lookup, and say so",
        /geocode_\$\{mid\}\.json/.test(src) && /Position found from its address/.test(src));
  check("an ArcGIS request gives up rather than hanging", /no answer in \$\{Math\.round\(ms \/ 1000\)\} s/.test(src));
}

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
  const html2 = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("a reload button is in the page from the start, with its own handler and its words beside it",
        /id="reload-map"[\s\S]{0,200}onclick="[^"]*location\.reload\(\)"/.test(html2) && /class="reload-cap">Stuck\? Reload here, or press \u2318R \(Ctrl-R\)</.test(html2));
  check("…and moves into the right column, above the View box", /under\.insertBefore\(wrap, under\.firstChild\)/.test(src));
  check("…keeping the view as the map moves", /window\.__culpritsView = /.test(src));
  check("…and comes back to the same view", /sessionStorage\.getItem\("culprits-view"\)/.test(src));
  check("mines worldwide is a row, drawn from the tiles repo", /id: "mines_global"[^\n]*route: "pmshapes"/.test(src) &&
        /tiles\/mining_polygons\.pmtiles/.test(src));
  // The mines are published as several archives, because GitHub refuses a file over 100 MB.
  const pmShapeParts = new Function(src.match(/function pmShapeParts[\s\S]*?\n}\n/)[0] + "; return pmShapeParts;")();
  const mineUrl = "https://x.test/tiles/mining_polygons.pmtiles";
  const cutUp = pmShapeParts(mineUrl, { parts: [
    { file: "mining_polygons.pmtiles", from: 7, to: 11 }, { file: "mining_polygons_2.pmtiles", from: 12, to: 12 },
    { file: "mining_polygons_3.pmtiles", from: 13, to: 13, columns: [0, 4000] }, { file: "mining_polygons_4.pmtiles", from: 13, to: 13, columns: [4001, 8191] }] });
  check("a mines build cut into several files draws each file at its own zooms, never two at once",
        cutUp.length === 4 && cutUp[0].minzoom === 7 && cutUp[0].maxzoom === 12 && cutUp[1].minzoom === 12 && cutUp[1].maxzoom === 13 &&
        cutUp[1].url === "https://x.test/tiles/mining_polygons_2.pmtiles");
  check("\u2026the files holding the closest zoom keep drawing past it, both sides of a longitude cut",
        cutUp[2].maxzoom === 24 && cutUp[3].maxzoom === 24 && cutUp[2].minzoom === 13);
  check("\u2026and a build with no list of files draws from the one archive, as before",
        pmShapeParts(mineUrl, null).length === 1 && pmShapeParts(mineUrl, { zoom: 11 })[0].url === mineUrl);
  check("a point archive over GitHub's cap is cut by zoom by the pipeline, with no outside storage, and the points route draws each part at its own zooms",
        /python3 "\$\(dirname "\$0"\)\/split_archive\.py" "\$OUT"/.test(fs.readFileSync(path.join(HERE, "..", "pipeline", "build_tiles.sh"), "utf8")) &&
        !/needs-r2/.test(fs.readFileSync(path.join(HERE, "..", "pipeline", "build_tiles.sh"), "utf8").replace(/#[^\n]*/g, "")) &&
        /const psrc = `\$\{src\}-part\$\{i \+ 2\}`/.test(src) && /`\$\{cfg\.id\}-\$\{kind\}-part\$\{i \+ 2\}`/.test(src) &&
        /PIECES_LIMIT = 400 \* 1024 \* 1024/.test(fs.readFileSync(path.join(HERE, "..", "pipeline", "normalize.py"), "utf8")));
  check("\u2026the row reads that list and switches the extra files on and off with it",
        /\.build\.json/.test(src) && /cfg\._layerIds\.push\(lid\)/.test(src) && /setLayerZoomRange\(`\$\{cfg\.id\}-fill`/.test(src));
}

console.log("\nthe screen, rearranged");
{
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const wire = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  check("the title box is gone", !/class="title-box"/.test(html));
  check("the view and basemap box sits top right", /<div class="right-col">\s*<div id="basemaps"/.test(html));
  check("the wires box starts under it", /top:var\(--wire-top,16px\)/.test(wire) && /--wire-top/.test(src));
  check("the Showing box sits bottom left", /#legend\{position:absolute;left:16px;bottom:16px/.test(html));
  check("the layers box runs down to it", /bottom:calc\(16px \+ var\(--legend-h,0px\)\)/.test(html));
  check("every heading starts folded shut", /body\.hidden = true;/.test(src) && /aria-expanded", "false"/.test(src));
  check("each heading shows how many layers it holds", /toc-n/.test(src));
  check("leaving for space hides the right box too", /"\.right-col", "#legend"/.test(src));
}

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

console.log("\nsuppression in the given order; news box filters");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("Off-planet invasion is its own section, after Suppression, with Buildings last", at("Off-planet invasion") > at("Suppression") && at("Buildings") > at("Off-planet invasion"));
  check("Suppression opens on Of humans, then its four kinds in order",
        at("Of humans") < at("Physical suppression") && at("Physical suppression") < at("Suppression by \u201crepresentation\u201d within it") &&
        at("Suppression by \u201crepresentation\u201d within it") < at("Suppression by information") && at("Suppression by information") < at("Suppression by social molds"));
  check("Economically is now Control of physical resources", at("Economically") === -1 && at("Control of physical resources") > at("Physical suppression"));
  const last = (x) => order.map((y) => y && y.t).lastIndexOf(x);
  check("the other beings follow Of humans", last("Of animals") > at("Suppression by social molds") && last("Of microscopics") > last("Of plants"));
  const pick = new Function(src.slice(src.indexOf("const WIRE_NOT_GIVEN ="), src.indexOf("// Every story at a mark")) + "; return wirePopPick;")();
  const list = [{ subject: "Slavery", outlet: "AP", title: "Brick kilns raided" }, { subject: "Voting", outlet: "AP", title: "Polls close" },
                { subject: "Slavery", outlet: "BBC", title: "Fishing crews freed" }];
  check("a news box filters by subject", pick(list, { subject: "Slavery" }).length === 2);
  check("…by source", pick(list, { outlet: "BBC" }).length === 1);
  check("…and by words in the headline", pick(list, { title: "kilns" }).length === 1 && pick(list, { title: "" }).length === 3);
  // A story carrying no source, place or date is reachable through its menu's
  // own option rather than being filtered away by every choice.
  const day = (y, m, d) => new Date(y, m - 1, d).getTime();
  const dated = [{ subject: "Slavery", outlet: "AP", place: "Lagos", title: "one", date: day(2026, 9, 18) },
                 { subject: "Slavery", outlet: "", place: "", title: "two", date: day(2026, 9, 19) },
                 { subject: "Voting", outlet: "BBC", place: "Lagos", title: "three", date: null }];
  check("\u2026by place", pick(dated, { place: "Lagos" }).length === 2);
  check("\u2026by the day a story carries", pick(dated, { day: "2026-09-19" }).length === 1);
  check("stories with nothing in a field have an option of their own",
        pick(dated, { outlet: "\u0000none" }).length === 1 && pick(dated, { day: "\u0000none" }).length === 1);
  const filters = new Function("escapeHtml", "WIRE_SORTS",
    src.slice(src.indexOf("const WIRE_NOT_GIVEN ="), src.indexOf("// Every story at a mark")) + "; return wirePopFilters;")(
      (x) => String(x), [["new", "Newest first"]]);
  const html = filters(dated);
  check("the box carries a menu for each of them, and the headline and order",
        ["subject", "outlet", "place", "day", "title", "order"].every((k) => html.includes(`data-wf="${k}"`)));
  check("a menu whose stories all share one value is left out",
        !filters([{ subject: "Slavery", outlet: "AP", place: "Lagos", title: "one", date: day(2026, 9, 18) },
                  { subject: "Slavery", outlet: "AP", place: "Lagos", title: "two", date: day(2026, 9, 18) }])
          .includes('data-wf="subject"'));
}

console.log("\nthe Social Spheres, its own map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the Social Spheres is one row, read live from its own page", /id: "site_social_spheres", name: "The Social Spheres"[^\n]*route: "spheres"/.test(src) &&
        /maps\/main\/social_spheres\.html/.test(src));
  const read = new Function(src.slice(src.indexOf("function spheresData("), src.indexOf("function spheresKinds(")) + "; return spheresData;")();
  const d = read('<script>const DATA = {"nodes":[{"id":"a","what":"a } brace in text"}],"edges":[]};\nconst KIND={};</script>');
  check("its data is read whole, even with braces inside its text", d.nodes[0].what === "a } brace in text");
  const kinds = new Function(src.slice(src.indexOf("function spheresKinds("), src.indexOf("let spheresFrame")) + "; return spheresKinds;")();
  check("its own colours are kept", kinds("const KIND={assoc:{c:'#D6BC82'},club:{c:'#C79A55'}};").club === "#C79A55");
  check("a click opens the map's own card through its own code", /w\.eval\(`\$\{fn\}\(\$\{JSON\.stringify\(arg\)\}\)`\)/.test(src) && /srcdoc = html/.test(src));
}

console.log("\nbuilding types, one layer");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  check("Buildings is back in the box under its own heading (round 71)", o.PANEL_ORDER.includes("building_types") && !o.PANEL_REMOVED.has("building_types") && !o.PANEL_ORDER.includes("fin_bank"));
  check("…and the forty separate rows are out of the box", ["fin_bank", "jud_courts", "activist_prisons", "slavery_facilities"].every((i) => o.PANEL_REMOVED.has(i)));
  const cols = new Function(src.slice(src.indexOf("function buildingColours("), src.indexOf("async function addBuildingTypesLayer(")) + "; return buildingColours;")();
  const c = cols(["Banks", "Courts", "Police stations"]);
  check("each type gets its own muted colour", new Set(Object.values(c)).size === 3 && Object.values(c).every((v) => /hsl\(\d+, 18%/.test(v)));
  check("no type is coloured yellow or orange", Object.values(cols(Array.from({ length: 40 }, (_, i) => "t" + i))).every((v) => { const h = Number(/hsl\((\d+)/.exec(v)[1]); return !(h > 20 && h < 90); }));
}

console.log("\nOur World in Data shading; the genetic engineering map moved");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const pre = order.findIndex((x) => x && x.t === "Pre-birth frontlines"), post = order.findIndex((x) => x && x.t === "Invasion of the living");
  const gs = ["gmo_cultivation", "gmo_gmofree", "gmo_incidents", "gmo_regime", "gmo_treaties", "gmo_trials"].map((i) => order.indexOf(i));
  check("the Genetic engineering map's six layers are each a row under Pre-birth frontlines", gs.every((g) => g > pre && g < post) && !order.includes("group:gmo_map_layers"));
  const parse = new Function(src.slice(src.indexOf("function owidParse("), src.indexOf("function owidBreaks(")) + "; return [owidParse, owidPick];")();
  const rows = parse[0]('Entity,Code,Year,gc_xpn\nKenya,KEN,2020,10.5\nKenya,KEN,2022,12\n"Korea, South",KOR,2021,3\nWorld,OWID_WRL,2022,9\nX,XXX,2021,\n');
  check("a chart's rows are read, aggregates and blanks left out", rows.length === 3 && rows[2].name === "Korea, South");
  const latest = parse[1](rows, "latest"), y2020 = parse[1](rows, "2020");
  check("latest takes each country's most recent year", latest.get("KEN").year === 2022 && latest.get("KOR").year === 2021);
  check("a single year takes only that year", y2020.size === 1 && y2020.get("KEN").v === 10.5);
  check("the three charts are rows", ["owid_interest", "owid_corptax", "owid_aid"].every((i) => new RegExp(`id: "${i}"`).test(src)));
}

console.log("\nrow tools; easier-to-see points; monitors back in the wires box only");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the monitor layers are gone", !/monitor_/.test(src) && !/route: "monitor"/.test(src));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const plants = order.map((x) => x && x.t).lastIndexOf("Of plants");
  check("the Christmas tree map is under Suppression, Of plants (round 102b: worldwide)", order.indexOf("xmas_trees") === plants + 2);
  const hook = src.slice(src.indexOf("const POINT_MIN"), src.indexOf("const OPACITY_PROPS"));
  const [mapOutputs, boostOne, legibleCircle] = new Function(hook + "; return [mapOutputs, boostOne, legibleCircle];")();
  check("a small fixed point grows to a visible size", boostOne(1.4) === 3.2 && Math.abs(boostOne(6) - 7.2) < 1e-9);
  const z = mapOutputs(["interpolate", ["linear"], ["zoom"], 1, 1.5, 8, 6], boostOne);
  check("…and so does each stop of a zoom scale", z[4] === 3.2 && z[6] > 7);
  const L = { id: "x-pt", type: "circle", paint: { "circle-color": "#555", "circle-radius": 2 } };
  legibleCircle(L);
  // Round 116b: the light rim again (112b's darker edge went with the glow's return); the size still scaled by zoom.
  check("points get a light rim and a size by zoom", /242,238,230/.test(L.paint["circle-stroke-color"]) && L.paint["circle-stroke-width"] === 1 &&
        L.paint["circle-radius"][0] === "interpolate" && L.paint["circle-radius"][4] < L.paint["circle-radius"][L.paint["circle-radius"].length - 1]);
  const ring = { id: "r", type: "circle", paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": 5 } };
  legibleCircle(ring);
  check("hollow rings keep their own drawing", ring.paint["circle-radius"] === 5);
  check("each row is dragged to move it, and has a transparency slider", !/data-mv="up"/.test(src) && /function rowDragging/.test(src) && /type="range" min="10" max="100"/.test(src) && /map\.moveLayer\(id, before\)/.test(src));
}

console.log("\nlaunch sites and upcoming launches");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("both are rows under Off-planet invasion", /id: "ll2_pads"/.test(src) && /id: "ll2_upcoming"/.test(src) && /"ll2_pads", "ll2_upcoming",/.test(src));
  check("read live from Launch Library 2, with the daily copy when its hourly limit is used", /ll\.thespacedevs\.com\/2\.3\.0/.test(src) && /hourly limit was reached/.test(src));
  const pad = new Function(src.slice(src.indexOf("function ll2Pad("), src.indexOf("async function readLaunchLibrary(")) + "; return ll2Pad;")();
  check("a pad's position is read", JSON.stringify(pad({ latitude: "28.56", longitude: "-80.57" }).coordinates) === "[-80.57,28.56]" && pad({}) === null);
}

console.log("\nthe space industry map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("it is a row under Off-planet invasion", /id: "space_industry"/.test(src) && /\{ h: 3, t: "The space industry" \}, "space_industry"/.test(src));
  check("its boxes are the ones its copy carries", /p\._html \? boxOpen \+ p\._html/.test(src));
}

console.log("\nthe Suppression page's two Google My Maps maps");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("both are rows, read live from their own files", /mid=1vrnqSW4cWWdnjz6cJ-qFMmd0zbJzYd6V&forcekml=1/.test(src) && /mid=1seBCggQGg1tcRYpqpZ5ZKJaxHs4&forcekml=1/.test(src));
}

console.log("\nresource trade flows");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("it is a row under Control of physical resources, under Trade", /id: "rte_trade"/.test(src) && /\{ h: 5, t: "Trade" \}, "rte_trade", "site_trade_profits", "gta_acts"/.test(src));
  check("read live, with the daily copy when it cannot be", /api\.resourcetrade\.earth\/api\/rt\/2\.7/.test(src) && /cfg\._fromCopy = true/.test(src));
  const arc = new Function(src.slice(src.indexOf("function rteArc("), src.indexOf("async function addRteLayer(")) + "; return rteArc;")();
  const a = arc([0, 0], [10, 0]);
  check("a flow runs from exporter to importer on a curve", a[0][0] === 0 && a[a.length - 1][0] === 10 && a[12][1] !== 0);
}

console.log("\nSocial Spheres controls; Live Projects to Resist whole; wastewater from its copy");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const lab = new Function(src.slice(src.indexOf("function spheresLabels("), src.indexOf("function spheresControls(")) + "; return spheresLabels;")();
  check("the Social Spheres' own kind names are read", lab('const KINDLABEL={assoc:"Association & commission",club:"Club"};').club === "Club");
  check("a person or sector opens through the map's own functions only", /\["openNode", "openPerson", "openSector"\]\.includes\(fn\)/.test(src));
  check("Live Projects to Resist has no rows of its own; its projects are the Development projects row",
        ["live_projects_app", "love_wire", "love_trackers", "love_guides"].every((i) => !new RegExp(`id: "${i}"`).test(src)) &&
        /id:"local_projects"/.test(src));
  check("its project cards are not drawn a second time", (src.match(/id:\s*"local_projects"/g) || []).length === 1);
  check("the wastewater layers read the GitHub copy", (src.match(/tiles\/wastewater_N_[a-z_]+\.pmtiles/g) || []).length === 5 && !/mazu\.nceas\.ucsb\.edu/.test(src));
}

console.log("\nGlobal Safety Net (its layers back in round 91b, titled plainly and filed by kind; its rankings the map's own)");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const shown = new Function(src.slice(src.indexOf("function gsnShown("), src.indexOf("// Round 91b (asked 27 September): each layer's title")) + "; return gsnShown;")();
  const list = [{ id: 1, gee_tile_url: "https://e/v1/projects/p/maps/abc/tiles/{z}/{x}/{y}" }, { id: 26, gee_tile_url: "https://e/maps/x", is_hidden: "True" },
                { id: 7, gee_tile_url: "https://e/v1/projects/p/maps/def", is_multilayer: "True" }, { id: 9 },
                { id: 98, gee_tile_url: "https://earthengine.googleapis.com/v1/projects/global-safety-net/assets/cons-imp-priority-sites-sep-2026" }];
  check("the viewer's own layers are offered; its hidden helpers, and a layer given only as an asset address, are not", shown(list).map((l) => l.id).join() === "1,7");
  check("each is drawn from the fresh address its list gives, not doubled", /String\(l\.gee_tile_url/.test(src) && /\/tiles\/\{z\}\/\{x\}\/\{y\}`/.test(src) && /\/\\\{z\\\}\/\.test\(u\) \? u :/.test(src));
  check("each carries a plain title with its abbreviation spelt out; the service's name still files it",
        /label: GSN_PLAIN\[l\.id\] \?/.test(src) && /3: "Places conserved outside protected areas[^"]*\(other effective area-based conservation measures, OECMs\)"/.test(src) &&
        /27: "How much people have changed the land, at 90 m \(Human Modification index v3, HM90\)"/.test(src) && /10: "[^"]*\(mammal assemblages\)"/.test(src) && /12: "[^"]*\(climate stabilization areas\)"/.test(src));
  check("the mangroves are drawn light and grown wider out", /const GSN_GROW = \{ 18: "3FC0C9", 98: "8FD6E8" \};/.test(src) && /tpl = `grow:\/\/\$\{GSN_GROW\[l\.id\]\}\//.test(src));
  const g = new Function(src.slice(src.indexOf("function growPixels("), src.indexOf("function zoomOfBbox(")).replace(/maplibregl\.addProtocol[\s\S]*?\n\}\);\n/, "") + "; return { growPaint, growRadiusAt };")();
  const px = new Uint8ClampedArray(9 * 9 * 4); px[(4 * 9 + 4) * 4 + 3] = 40;
  g.growPaint(px, 9, 2, [63, 192, 201]);
  let lit = 0; for (let i = 3; i < px.length; i += 4) if (px[i]) lit++;
  check("…one faint pixel becomes a 7-pixel light square at zoom 2, and stays one pixel close in", lit === 49 && px[3 * 9 * 4 + 3 * 4] === 63 && g.growRadiusAt(10) === 0);
  check("the rankings page in a box is gone; the rankings are a country shading read from the tiles repo's copy",
        !/id: "gsn_rankings"/.test(src) && !/globalsafetynet\.app\/rankings\/",\n\s+note/.test(src) &&
        /id: "gsn_countries"[^\n]*route: "country"/.test(src) && /gsn\/countries\.json", field: "score" \}/.test(src));
}

console.log("\nClimate TRACE air pollution");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the air-pollution sources are under Pollution > General and all pollutants, and population density under Overpopulation", /id: "ct_air"/.test(src) && /id: "ct_pop"/.test(src) &&
        /\{ h: 5, t: "General and all pollutants" \}, "ct_air",/.test(src) && /\{ h: 3, t: "Overpopulation" \}, "ct_pop",/.test(src));
  check("a plume is drawn as one still hotspot, graded by its concentration, not a set of outlines",
        /function ctPlumeShape\(gj\)/.test(src) && /type: "heatmap", source: `\$\{cfg\.id\}-plume`/.test(src) && /"fill-opacity": \["interpolate", \["linear"\], \["get", "_strength"\]/.test(src));
  {
    const shape = new Function(src.match(/function ctPlumeShape[\s\S]*?\n}\n/)[0] + "; return ctPlumeShape;")();
    const out = shape({ type: "FeatureCollection", features: [{ type: "Feature", geometry: null, properties: { concentration: 5 } }, { type: "Feature", geometry: null, properties: { concentration: 1 } }] });
    check("\u2026the strongest part is 1 and the rest in proportion, every feature kept", out.features.length === 2 && out.features[0].properties._strength === 1 && out.features[1].properties._strength === 0.2);
  }
  check("\u2026its figures and plume are read through the Worker, since Climate TRACE sends no CORS header",
        /\$\{WORKER\}\/ct-asset\?id=/.test(src) && /\$\{WORKER\}\/ct-plume\?file=/.test(src) &&
        /url\.pathname === "\/v1\/ct-asset" \|\| url\.pathname === "\/v1\/ct-plume"/.test(fs.readFileSync(path.join(HERE, "..", "worker", "index.js"), "utf8")));
  check("nitrogen dioxide rows go under their own heading under Pollution", /\{ h: 5, t: "Nitrogen dioxide" \},/.test(src) && /nitrogen dioxide\|\\bno2\\b\|\\bnox\\b\|nitric oxide\/i, P \+ " > Pollution > Air pollution > Nitrogen dioxide"/.test(src));
  check("every pollutant Climate TRACE reports can be chosen", ["pm2_5", "bc", "oc", "so2", "vocs", "co", "nh3", "nox", "co2e_100yr"].every((g) => src.includes(`["${g}",`)));
  check("a click reads the plume and the figures live", /ct-plume\?file=\$\{encodeURIComponent\(p\.plume\)\}/.test(src) && /api\.c10e\.org\/v7\/app\/asset/.test(fs.readFileSync(path.join(HERE, "..", "worker", "index.js"), "utf8")));
  const html = new Function("escapeHtml", "CT_GASES", src.slice(src.indexOf("function ctAssetHtml("), src.indexOf("async function addCtAirLayer(")) + "; return ctAssetHtml;")((s) => String(s), [["pm2_5", "PM2.5"]]);
  const h = html({ type: "BF/BOF", subsector: "iron-and-steel", location: { country: "BRA" }, totals: { value: 807.3, capacity: 600000, capacityUnits: "t of steel", capacityFactor: 0.62 }, subsectorRanks: [{ year: 2025, rank: 418 }] }, "pm2_5");
  check("a source's box gives its figures and rank", h.includes("807.3") && h.includes("used 62%") && h.includes("2025: 418"));
}

console.log("\nGlobal Trade Alert");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("it is a row under Control of physical resources", /id: "gta_acts"/.test(src) && /"site_trade_profits", "gta_acts",/.test(src));
  const nameOf = new Function(src.slice(src.indexOf("function gtaNameOf("), src.indexOf("async function addGtaLayer(")) + "; return gtaNameOf;")();
  const known = new Set(["Italy", "United States of America"]);
  check("a shape is joined by whichever field names the country", nameOf({ NAME: "Italy" }, known) === "Italy" && nameOf({ label: "United States of America" }, known) === "United States of America" && nameOf({ name: "Atlantis" }, known) === null);
}

console.log("\noutside pages whole, in the panel");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("every remaining outside page is a row", ["cfr_tracker", "giga_schools", "bocc", "theyrule", "skytruth_voc", "esa_risk"].every((i) => new RegExp(`id: "${i}"`).test(src)));
  check("no panel follows this map's view any more, and none claims to", (src.match(/follow: true/g) || []).length === 0);
  check("one panel at a time", /One panel at a time/.test(src));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  check("each sits under its heading", order.indexOf("bocc") > order.findIndex((x) => x && x.t === "Emissions") && order.indexOf("esa_risk") > order.findIndex((x) => x && x.t === "Off-planet invasion"));
}

console.log("\nwhat was still open");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the EPA widget's facilities are drawn live from EPA's service", /id: "epa_widget"[^\n]*route: "arcgisdyn"/.test(src) && /EMEF\/efpoints\/MapServer/.test(src) && /\/identify\?geometry=/.test(src));
  check("Giga by country, Trase's facilities rows, and two of your own are rows", ["giga_countries", "trase_meat_brazil", "trase_palm_indonesia", "biosignature", "leverage_chart"].every((i) => new RegExp(`id: "${i}"`).test(src)));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  check("the waiting rows are placed", ["ejatlas", "seas_of_plastic", "coastal_cleanup", "mines_global", "atlas_hotspots", "group:ct_history"].every((i) => order.includes(i)));
}

console.log("\nvessels of concern drawn; the oil-slick archive");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("vessels of concern are drawn from the daily copy, as tiles since 22 September", /id: "skytruth_voc"[^\n]*route: "pmtiles"/.test(src) && /skytruth\/vessels_of_concern"/.test(src));
  // Round 81: the archive is the oil slicks row's "copy kept daily", with a timeline.
  check("the slick archive is folded into the live slicks row, with a timeline", /id: "slick_archive"/.test(src) && /"epa_tri_sites", "slick_archive", "skytruth_posts", "pirg_plastic",/.test(src) &&
        /timeline: \{ from: "2023-01", column: "slick_timestamp", archive: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/cerulean_archive" \}/.test(src) && /async function ceruleanTimeline\(cfg\)/.test(src));
}

console.log("\nzoos and pet industry placed");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const animals = o.PANEL_ORDER.findIndex((x) => x && x.t === "Of animals");
  check("both My Maps maps sit under Of animals", o.PANEL_ORDER.indexOf("mymaps_supp_a") > animals && o.PANEL_ORDER.indexOf("mymaps_supp_b") > animals);
  check("the Leverage Chart is out of the box", o.PANEL_REMOVED.has("leverage_chart"));
}

console.log("\nACGF placed");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  // ACGF was removed on 20 September (see "ACGF is removed").
}

console.log("\nchanges of 19 September");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const order = o.PANEL_ORDER, at = (t) => order.findIndex((x) => x && x.t === t), pos = (i) => order.indexOf(i);
  // Any of a row's namings will do: a row under several subjects is found under each.
  const between = (i, a, b) => o.PANEL_ORDER.some((x, k) => x === i && k > at(a) && (b == null || k < at(b)));
  check("no Whose world / Where in the chain chips in the box", !/chips\.innerHTML = kindChipsHtml\(\)/.test(src));
  check("every layer opens unticked", /for \(const c of LAYERS\) c\.off = true;/.test(src));
  check("the Eyes network is under Metaphysical (Religion, spirituality, etc.)", between("site_eyes_network", "Metaphysical (Religion, spirituality, etc.)", "Sports") && at("Religion and spirituality") === -1);
  check("Cartel cells, the export-credit background map and the duplicate Giga and Next Spaceflight rows are out",
        ["site_cartel_cells", "site_export_credit_shading", "giga_schools", "nsf_locations"].every((i) => o.PANEL_REMOVED.has(i)));
  check("the Break Free From Plastic page is out; the Energy Charter and ISDS rows are back under Environmental law (round 95b)", o.PANEL_REMOVED.has("bffp_audit") && !o.PANEL_REMOVED.has("ect_secrets") && !o.PANEL_REMOVED.has("isds_tracker"));
  check("the Tableau row is the CFR Global Imbalances Tracker", /id: "tableau_zsf", name: "Countries' trade and money imbalances \(Council on Foreign Relations tracker\)"/.test(src));
  check("Giga by country is under School (round 104b: School under Suppression by representation)", between("giga_countries", "School", "Politics as a front"));
  check("EJAtlas is under Of the planet > General; Culprits upstream is dissolved (22 September)", between("ejatlas", "General", "Climate") && at("Culprits upstream") === -1);
  check("Biodiversity loss holds the hotspots and hotspot cities (round 100b: the Subsidising Extinction and Power BI pages out of it)",
        ["atlas_hotspots", "atlas_cities", "wb_harm_projects", "goc_fauna"].every((i) => between(i, "Biodiversity loss", "Mining")));
  check("Mining holds the mines", between("mines_global", "Mining", "Agriculture"));
  check("the refinery map is under Climate > Fossil fuel plants and refineries", between("fractracker_refineries", "Fossil fuel plants and refineries", "Companies and financiers"));
  check("the toxic release sites are one row, carrying the live layer", o.PANEL_REMOVED.has("epa_tri") && /name:"Factories reporting toxic chemical releases, US \(EPA Toxics Release Inventory\)", [^\n]*\n[^\n]*\n[^\n]*\n\s*linked: \["epa_tri"\]/.test(src));
  check("coral is one row", o.PANEL_REMOVED.has("unep_coral") && pos("allen_coral") > 0);
  check("mines are merged into counted points wider out", /\$\{escapeHtml\(cfg\.featureWords \|\| "mines"\)\} here<\/b>/.test(src) && /"point_count"\], 1\]\]\]\],\n\s*6,/.test(src));
  check("alerts are grown and lightened wider out", /function recolorAlerts\(px, rgb, z, w\)/.test(src) && /recolorAlerts\(img\.data, tint, z, bmp\.width\)/.test(src));
  check("the atlas's two modelled sets are rows of their own, beside the registered facilities",
        !/parts: true,/.test(src) && /id:"abattoir_cafo"[^\n]*route:"cafo"/.test(src) && /id:"abattoir_glw"[^\n]*route:"glwrelief"/.test(src) &&
        /abattoir_cafo\.pmtiles/.test(src) && /style=default/.test(src) && /TileCol=\{x\}&TileRow=\{y\}/.test(src) &&
        /name:"Registered animal-use facilities/.test(src));
  check("a page panel's close button hides it", /\.companion\[hidden\]\{display:none !important\}/.test(index));
  // The alert growing, run on a tiny tile.
  const fnSrc = src.slice(src.indexOf("function recolorAlerts("), src.indexOf("// latclip://"));
  const recolor = new Function(fnSrc + "; return recolorAlerts;")();
  const w = 9, px = new Uint8ClampedArray(w * w * 4);
  px[(4 * w + 4) * 4 + 3] = 255;
  recolor(px, [138, 79, 70], 2, w);
  const lit = [...Array(w * w).keys()].filter((p) => px[p * 4 + 3]).length;
  check("one alert pixel at zoom 2 becomes a 7-pixel-wide patch", lit === 49, String(lit));
  const px2 = new Uint8ClampedArray(w * w * 4); px2[(4 * w + 4) * 4 + 3] = 255;
  recolor(px2, [138, 79, 70], 12, w);
  check("…and stays one pixel close in", [...Array(w * w).keys()].filter((p) => px2[p * 4 + 3]).length === 1);
}

console.log("\nNusantara Atlas and Global Forest Watch, by category");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const NUSANTARA_CATEGORIES"), src.indexOf("// Chips for the categories"));
  const [N, G, categoryOf] = new Function(body + "; return [NUSANTARA_CATEGORIES, GFW_CATEGORIES, categoryOf];")();
  check("Nusantara uses its own map's categories", ["Concessions", "Mills", "Protected area", "Indigenous territories", "Administrative boundary", "Roads", "Land use zone"].every((c) => N.some((r) => r[0] === c)));
  check("Global Forest Watch uses its own map's five categories", ["Forest Change", "Land Cover", "Land Use", "Climate", "Biodiversity"].every((c) => G.some((r) => r[0] === c)));
  check("a palm oil mill is a mill", categoryOf("Palm oil mills (UML)", N) === "Mills");
  check("an oil palm concession is a concession", categoryOf("Oil palm concessions HGU", N) === "Concessions");
  check("an adat territory is indigenous", categoryOf("Wilayah adat", N) === "Indigenous territories");
  check("emissions from tree cover loss are under Climate", categoryOf("Emissions from tree cover loss", G) === "Climate");
  check("integrated alerts are Forest Change", categoryOf("Integrated deforestation alerts", G) === "Forest Change");
  check("mangrove extent is Land Cover", categoryOf("Global mangrove extent", G) === "Land Cover");
  check("a layer no rule claims goes under Other, not away", categoryOf("xyz 123", G) === "Other");
  // Superseded with Nusantara's: the catalogue's datasets are rows of the box
  // now, filed by what each shows, and several can be drawn at once.
  check("Global Forest Watch's datasets are rows of the box", !/categoryMenu\(menu, /.test(src) &&
        (src.match(/^  catalogueRows\(cfg, /gm) || []).length === 5);   // Nusantara, Global Forest Watch, Trase, Climate TRACE by gas, Global Safety Net
  // Superseded: Nusantara's layers are rows of the box itself now, filed by
  // what they show, not a list inside one row.
  check("Nusantara's layers are rows of the box, filed by subject", /catalogueRows\(cfg, items\);/.test(src) && !/menu\.className = "facet ns-list"/.test(src));
}

console.log("\nEPA facilities at every zoom");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("wider out, the EPA row draws the weekly copy of every point", /epa_efpoints\.pmtiles/.test(src) && /map\.addLayer\(\{ id: lid, type: "circle", source: sid, "source-layer": "efpoints"/.test(src) && /maxzoom: Math\.min\(part\.to \+ 1, cfg\.minzoom \|\| 22\)/.test(src));
  check("a point's full record is asked of EPA on click", /\/query\?objectIds=\$\{encodeURIComponent\(p\._oid\)\}&outFields=\*/.test(src));
  check("the kind buttons also filter the copy", /for \(const l of ptsLayers\) if \(map\.getLayer\(l\)\) map\.setFilter\(l, ptsFilter\(\)\);/.test(src));
}

console.log("\nthe column's edge, the meat rows, the reefs close in");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the layers column is dragged wider by its right edge, and put back by a double-click",
        /function columnEdge\(\)/.test(src) && /root\.style\.setProperty\("--left-w"/.test(src) && /\.col-edge\{position:absolute/.test(index));
  check("the two modelled meat rows are built by the routes that know them",
        /else if \(cfg\.route === "cafo"\) addCafoLayer\(cfg\);/.test(src) && /else if \(cfg\.route === "glw"\) addGlwLayer\(cfg\);/.test(src) &&
        /id:"abattoir_cafo"[^\n]*lazy:true/.test(src) && /id:"abattoir_glw"[^\n]*lazy:true/.test(src));
  check("close in the reefs still draw: neither picture stops at zoom 12",
        !/source: `\$\{cfg\.id\}-wide`, maxzoom/.test(src) && !/minzoom: CORAL_WORLD_SHARP, maxzoom/.test(src));
}

console.log("\nCarbon Mapper's plumes, from their own platform");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  check("the row reads Carbon Mapper's catalogue, not the handful on our own page",
        /const CARBON_API = `\$\{WORKER\}\/carbonmapper`;/.test(src) &&
        o.PANEL_ORDER.includes("carbon_plumes") && o.PANEL_REMOVED.has("site_carbon_mapper_waste"));
  check("it pages through the catalogue and says how much of it is held",
        /offset=\$\{n \* 1000\}/.test(src) && /of \$\{total\.toLocaleString\(\)\} published/.test(src));
  // The first page is read alone and drawn at once; the rest follow a few at a
  // time, each batch drawn as it lands, and the row says it is still reading.
  check("the plumes are drawn as they arrive, not after the last page",
        /const CARBON_PAGES_AT_ONCE = 3;/.test(src) &&
        /feats\.length \? CARBON_PAGES_AT_ONCE : 1/.test(src) &&
        /await Promise\.all\(batch\.map\(/.test(src) &&
        /draw\(ended \|\| page >= CARBON_PLUME_PAGES\)/.test(src) &&
        /, still reading/.test(src));
  check("closer in, each plume draws its own picture at the bounds Carbon Mapper give it",
        /const CARBON_PLUME_ZOOM = 10/.test(src) && /type: "image", url: p\.picture/.test(src) &&
        /coordinates: \[\[w, n\], \[e2, n\], \[e2, s2\], \[w, s2\]\]/.test(src));
  check("only the pictures on screen are drawn, and only so many at once",
        /const CARBON_PICTURES_AT_ONCE = 40/.test(src) && /if \(wanted\.size >= CARBON_PICTURES_AT_ONCE\) break;/.test(src));
  check("a plume's box says the rate was measured at that moment, not the source's own",
        /not the source's overall rate/.test(src));
}

console.log("\nareas findable from the world view");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("an area gets an edge as well as a fill, so a shape under a pixel still shows",
        /id: `\$\{cfg\.id\}-edge`, type: "line", source,/.test(src) && /\["Polygon", "MultiPolygon"\], true, false\],\n\s*paint: \{ "line-color": colour/.test(src));
  check("and a point at its middle wider out than the areas can be seen",
        /id: `\$\{cfg\.id\}-areapt`/.test(src) && /maxzoom: cfg\.areasFrom \|\| 7/.test(src));
  check("both carry the area's own record and are clickable like the rest",
        /properties: f\.properties \|\| \{\}/.test(src) && /\["fill", "line", "pt", "edge", "areapt"\]/.test(src));
}

console.log("\nthe showing box, the queue, and menus that draw");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("every line in the showing box has its own tick, left of its colour",
        /<input type="checkbox" class="lg-on" data-lg=/.test(src) && /\.lg-on\{flex:0 0 auto/.test(index) &&
        src.indexOf('class="lg-on"') < src.indexOf('class="lg-sw"'));
  check("unticking there unticks the row in the layers box, not the map directly",
        /const row = document\.querySelector\(`\[data-layer="\$\{i\.dataset\.lg\}"\]`\)/.test(src) && /row\.dispatchEvent\(new Event\("change"/.test(src));
  check("a heading's tick sits at the end of its line", /else \{ line\.appendChild\(head\); line\.appendChild\(all\); \}/.test(src));
  check("layers are built three at a time, and a waiting row says so",
        /const QUEUE_AT_ONCE = 3/.test(src) && /waiting behind \$\{i \+ 1\} other layer/.test(src) && /queueBuild\(cfg\.id, \(\) => \{/.test(src));
  check("a catalogue row turns the row it belongs to on", /function showRowFor\(id\)/.test(src) && /showRowFor\(cfg\.id\);\n\s*on\.add\(i\);/.test(src) && /showRowFor\(cfg\.id\);\n\s*setLayerState\(cfg\.id, `\$\{d\.title\}: finding its tiles/.test(src));
}

console.log("\ntitles in one ink, sources named");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("a child row's title reads in the same ink as any other", /\.layer\.child \.nm\{color:inherit\}/.test(index));
  check("the refinery row names who made the map and credits them on it",
        /name: "Oil refinery complexes, worldwide \(FracTracker Alliance\)"/.test(src) &&
        /id: "fractracker_refineries"[\s\S]{0,400}fractracker\.org/.test(src));
  check("the Carbon Mapper row says it is the set from our own page, not their whole catalogue",
        /Methane plumes from waste sites \\u2014 the set on our own page \(Carbon Mapper\)/.test(src));
}

console.log("\nthe hotspot outlines arrive coarser");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("a layer can ask its server for outlines at a stated precision", /async function arcgisQueryAll\(url, coarse\)/.test(src) &&
        /coarse \? `&maxAllowableOffset=\$\{coarse\}&geometryPrecision=4` : ""/.test(src));
  check("the hotspots ask for about a kilometre, and the row says so", /coarse: 0\.01,/.test(src) && /at about a kilometre's precision rather than the survey's own/.test(src));
  check("layers that did not ask still get the survey's own precision", /arcgisQueryAll\(l\.url\.replace\(\/\\\/\$\/, ""\), cfg\.coarse\)/.test(src));
}

console.log("\nGlobal Forest Watch's own rows together");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  // Superseded: no heading carries an organisation's name. The alerts and the
  // tree cover loss are filed under Deforestation with everything else, and
  // the catalogue's datasets are rows of their own.
  check("no heading is named for an organisation",
        !order.some((x) => x && x.t && /(global forest watch|nusantara|trase|climate trace)/i.test(x.t)));
  check("Global Forest Change is still listed above the alerts", order.indexOf("glad_loss") < order.indexOf("group:forest_alerts"));
}

console.log("\nheading ticks, chips in words, a named archive");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("every heading takes a tick that shows or hides everything under it",
        /all\.className = "toc-all"/.test(src) && /for \(const i of body\.querySelectorAll\(bundle \? "\[data-layer\], \[data-copy\], \[data-cat\](, \[data-smtype\])?" : "\[data-layer\], \[data-copy\]"\)\)/.test(src));
  check("unticking a heading clears its layers and its groups' boxes too",
        /for \(const g of body\.querySelectorAll\("\[data-group\]"\)\) \{\n\s*g\.checked = on;/.test(src));
  check("the tick reads its layers: all, none or part-way",
        /function syncHeadingBoxes\(box\)/.test(src) && /all\.indeterminate = on > 0 && on < boxes\.length/.test(src));
  check("opening a heading and turning its layers on are separate controls",
        /all\.addEventListener\("click", \(e\) => e\.stopPropagation\(\)\)/.test(src));
  check("the slaughter chips say what the registry said", /"registry does not say"/.test(src) && /labels\[v\] \|\| v/.test(src));
  check("an archive that will not load names the file it asked for", /archive missing \(\$\{e\.message\}\) \\u2014 \$\{url\}/.test(src));
  check("the three meat rows sit together under Meat", ["abattoir_facilities", "abattoir_cafo", "abattoir_glw"].every((i) => order.indexOf(i) > at("Meat") && order.indexOf(i) < at("Oceans")));
}

console.log("\nthe slick archive reads tiles where they exist");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the month list of archives is read, and a missing one is not fatal",
        /getJson\(`\$\{cfg\.base\}\/tiles\.json`/.test(src) && /catch \(e\) \{ \/\* none tiled yet \*\//.test(src));
  check("a tiled month draws through a vector source, shapes from zoom 7 and points below",
        /url: `pmtiles:\/\/\$\{url\}`/.test(src) && /"source-layer": "slicks", minzoom: 7/.test(src) && /"source-layer": "slick_points", maxzoom: 7/.test(src));
  check("a month with no archive still reads its plain file", /if \(tiled\[m\]\) \{ showTiled\(m\); return; \}/.test(src) && /getJson\(`\$\{cfg\.base\}\/\$\{m\}\.geojson`, 60000\)/.test(src));
}

console.log("\nrows gathered, moved and renamed");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("the two EPA rows say which is which", /name:"Factories reporting toxic chemical releases, US \(EPA Toxics Release Inventory\)"/.test(src) &&
        /name: "Every US site the Environmental Protection Agency holds a record for, across all its programs \(EPA Envirofacts\)"/.test(src));
  check("HydroWASTE sits under Wastewater, and is copied under Methane", at("Wastewater") > at("Pollution") && order.lastIndexOf("hydrowaste") === at("Wastewater") + 1 &&
        order.indexOf("hydrowaste") > at("Methane") && order.indexOf("hydrowaste") < at("Nitrous oxide"));
  check("PalmWatch sits under Agriculture", order.indexOf("palmwatch") > at("Agriculture") && order.indexOf("palmwatch") < at("Meat"));
  check("the three alert layers are one row, named for what it shows, each line naming the system that saw it",
        /const FOREST_ALERTS = \{[\s\S]{0,4000}id:"gfw_dist_year"/.test(src) &&
        /name: "Trees and plant cover lost, as it happens"/.test(src) &&
        /GLAD-L, GLAD-S2 and RADD/.test(src) && (src.match(/DIST-ALERT/g) || []).length >= 2 &&
        ["gfw", "gfw_dist", "gfw_dist_year"].every((i) => !order.includes(i)));
  check("Global Forest Change is drawn above the alerts", order.indexOf("glad_loss") < order.indexOf("group:forest_alerts"));
  // The titles are compared as they are written in app.js, escapes and all,
  // so a name typed with a real accent instead of its escape is caught here.
  check("each Trase dataset is its own row, the source kept in its title",
        [["trase_measures", String.raw`How much forest each crop and animal clears, and the trade behind it (Trase)`],
         ["trase_meat_brazil", String.raw`Slaughterhouses and animal-product plants, Brazil (Trase)`],
         ["trase_silos_brazil", String.raw`Soy silos and storage, Brazil (Trase)`],
         ["trase_cocoa_ivory", String.raw`Cocoa cooperatives, C\u00f4te d'Ivoire (Trase)`],
         ["trase_palm_indonesia", String.raw`Palm oil mills, Indonesia (Trase)`],
         ["trase_pulp_indonesia", String.raw`Wood pulp mills, Indonesia (Trase)`],
         // Round 83b: the three periods are one row.
         ["trase_pulp_concessions", "Wood pulp concessions, Indonesia, 2015 to 2024 (Trase)"]]
          .every(([i, n]) => src.includes(`id: "${i}", name: "${n}"`)) &&
        !/name: "Trase: /.test(src) && !/trasefacmenu/.test(src));
  check("each Trase row sits under the map's own heading, not a Trase one",
        ["trase_pulp_indonesia"].every((i) => order.indexOf(i) > at("Deforestation")) && !order.includes("trase_measures") &&
        ["trase_palm_indonesia"]
          .every((i) => order.lastIndexOf(i) > at("Agriculture") && order.lastIndexOf(i) < at("Meat")) &&
        !order.includes("trase_cocoa_ivory") &&
        !order.includes("trase_meat_brazil") &&   // round 134b: its sites are in abattoir_facilities
        !order.includes("group:trase_data"));
  check("a group owns its children, so no row is rendered twice and none falls into Not yet placed",
        !/rowsById/.test(src) && (src.match(/id:"gfw_dist_year"/g) || []).length === 1 && (src.match(/id: "trase_measures"/g) || []).length === 1);
  check("unticking a row takes its boxes with it",
        /rowNodes\(lead\)\.slice\(1\)\.forEach\(\(n\) => n\.classList\.toggle\("fold-hide", !input\.checked\)\)/.test(src));
}

console.log("\nthe layers box, as asked for");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
  const between = (id, a, b) => o.PANEL_ORDER.indexOf(id) > at(a) && o.PANEL_ORDER.indexOf(id) < at(b);
  check("the fishing-effort layer sits under Fishing, under Oceans, and the modelled one under Slavery",
        at("Oceans") < at("Fishing") && o.PANEL_ORDER.lastIndexOf("fishing") > at("Fishing") && o.PANEL_ORDER.lastIndexOf("fishing") < at("Construction") &&   /* round 132b: also under Marine meats */
        o.PANEL_ORDER.indexOf("slavery_fishing") > at("Slavery"));
  check("the reefs sit under Biodiversity loss, with the Global Safety Net at the top of it",
        // Round 23: Fishing above Reefs and mangroves (item 11); the Global
        // Safety Net heads the first sub-heading of Biodiversity loss (item 27).
        between("allen_coral", "Reefs and mangroves", "Construction") && at("Fishing") < at("Reefs and mangroves") &&
        // Round 99b: Land Use and Ecoregions first; the country rankings lead Protected areas.
        o.PANEL_ORDER[at("Biodiversity loss") + 1].t === "Land Use and Ecoregions" && o.PANEL_ORDER[at("Protected areas") + 1] === "gsn_countries");
  check("Agriculture is Meat and agriculture, holding Agriculture and Meat",
        at("Meat and agriculture") > 0 && at("Agriculture") > at("Meat and agriculture") &&
        between("land_matrix", "Meat and agriculture", "Agriculture") && between("abattoir_facilities", "Facilities", "Marine meats"));   // round 132b: Herds above Facilities
  check("the Power BI row is named for what it shows", /id: "powerbi_report", name: "Environmental Crime Tracker"/.test(src));
  check("every row carries the fold control, ticked or not, groups included",
        /"#layers label\.layer:has\(\+ \.facet:not\(\.row-tools\)\) \.fold,#layers label\.layer:has\(\+ \.row-tools \+ \.facet\) \.fold\{display:inline-block\}"/.test(src) &&
        /"#layers \.layer\.parent \.fold\{display:inline-block\}"/.test(src) &&
        /const group = lead\.classList\.contains\("parent"\)/.test(src));
  check("the mines draw only where their own tiles hold something",
        /minzoom: cfg\.polygonFrom != null \? cfg\.polygonFrom : 7/.test(src) && /maxzoom: cfg\.pointTo != null \? cfg\.pointTo : 9/.test(src));
}

console.log("\nLive Projects to Resist, drawn here");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const rows = new Function(src.slice(src.indexOf("function recordsAsFeatures("), src.indexOf("async function readGeojsonFiles(")) + "; return recordsAsFeatures;")();
  const out = rows([{ name: "a", lat: 12, lng: 34 }, { name: "b", lat: "", lng: "" }, { name: "c", latitude: -1, longitude: 2 }]);
  check("a story with a position becomes a point, keeping its fields", out.length === 2 && out[0].geometry.coordinates[0] === 34 && out[0].properties.name === "a");
  check("a story with no position is left out rather than placed at 0,0", !out.some((f) => f.properties.name === "b"));
  check("Construction holds the projects themselves", /\{ h: 3, t: "Construction" \}, "local_projects",/.test(src));
}

console.log("\nBuildings");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the Buildings row is defined and in the box under its heading", /id: "building_types", name: "Buildings"/.test(src) && /\{ h: 1, t: "Buildings" \}, "building_types",/.test(src) && !/"building_types",\s+\/\/ taken out/.test(src));
  check("each kind of building is its own line, with its colour and count, not a drop-down",
        !/aria-label="Kind of building"/.test(src) && /class="bt-kind"><input type="checkbox" data-bt-kind=/.test(src));
  check("each kind is its own archive, loaded when ticked; an older single archive still reads", /files\[t\]/.test(src) && /const single = !Object\.keys\(files\)\.length/.test(src));
  check("Buildings is held at the foot of the layers box", /sec\.classList\.add\("toc-pinned"\)/.test(src) && /#layers \.toc-pinned\{position:sticky;bottom:14px/.test(src));
  check("the sources-in-progress line is gone", !/more sources in progress/.test(src));
  check("the archives are read from the buildings repo, off the crowded one",
        /culprits-buildings\/tiles\/building_types\.json/.test(src) && !/culprits-tiles-more\/tiles\/building_types/.test(src));
  check("each kind's archive is found beside the summary, so moving them moves both",
        /const base = cfg\.summaryUrl\.replace\(\/\[\^\/\]\+\$\/, ""\)/.test(src));
  check("the outline map has a sea sheet, so it is a card in the stars", /id: "outline-ocean", type: "fill"/.test(src) && /show\("outline-ocean", !imagery\)/.test(src));
}

console.log("\nlayer rows laid out like Global Safety Net's list");
{
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("rows are small, tight and led by a colour square", /#layers \.layer\{gap:6px;padding:0;border-top:none;font-size:12px;line-height:1\.25/.test(index) && /#layers \.swatch\{width:10px;height:10px;border-radius:2px/.test(index));
  // One line apart: an unticked row carries no padding of its own, so the
  // titles read as a list rather than a column of gaps. A ticked row takes a
  // little back, because its line of detail appears underneath it.
  check("a ticked row keeps room for its line of detail", /#layers \.layer:has\(> input:checked\)\{padding:2px 0\}/.test(index));
  check("a row's detail line shows once it is ticked", /#layers \.layer:has\(> input:checked\) \.un\{display:block\}/.test(index));
  check("the layers box rolls up whole", /\.left-col \.panel\.shut\{flex:0 0 auto;height:auto !important\}/.test(index));
}

console.log("\nMy Maps addresses from data fields");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const MYMAPS_ADDR_FIELD"), src.indexOf("// KML (Google My Maps): placemarks"));
  const f = new Function(body + "; return mymapsAddress;")();
  check("a place's own address comes first", f(" 2 Elm St ", [["Address", "x"]]) === "2 Elm St");
  check("else its Address, City and State fields, joined", f("", [["Company", "Acme"], ["Address", "1 Main St"], ["City", "Topeka"], ["State", "KS"]]) === "1 Main St, Topeka, KS");
  check("a place with neither has no address", f("", [["Notes", "x"]]) === "");
}

console.log("\nthe Satellite basemap as a planetary-defence view; folding a row's boxes");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("only the Satellite basemap turns the defence view on", /defenceMode\(kind === "satellite"\);/.test(src));
  check("threat halos sit under the real points of ticked Destruction layers only", /t\.textContent\.trim\(\) !== "Destruction"/.test(src) && /l\.type !== "circle"/.test(src) && /map\.addLayer\(spec, lid\)/.test(src));
  check("the view holds still: no scan line, no throbbing halos, no breathing areas",
        !/defence-scan/.test(index) && !/class="scan"/.test(index) &&
        !/Math\.sin\(Date\.now\(\)/.test(src) && /setInterval\(defenceTick, 500\)/.test(src));
  check("the threat colour is a red, with no orange, yellow or neon", /threat: "#B8473E"/.test(src));
  check("the frame takes no clicks, and the one thing that moves stops for reduced motion", /#defence-hud\{position:absolute;inset:0;pointer-events:none/.test(index) && /prefers-reduced-motion: reduce\)\{\.defence-ping\{animation:none;display:none\}\}/.test(index));
  check("each ticked row with boxes under it has a fold button", /f\.className = "fold";/.test(src) && /has\(\+ \.row-tools \+ \.facet\) \.fold\{display:inline-block\}/.test(src));
}

console.log("\nOff-planet sections, Of groups, names, launch links, drag bar, markers, headings");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("Off-planet has To Earth and From Earth, with their four sections and one empty",
        at("To Earth") < at("Near-Earth object impacts") && at("Unidentified anomalous phenomena") < at("From Earth") &&
        at("From Earth") < at("The space industry") && at("Space launches") < at("Extraterrestrial life"));
  // Round 48 (25 September): the fur farms moved to a heading of their own under Of the planet.
  check("Final Nail's own row is out; its farms are in the fur farms file (round 112b)", !order.includes("final_nail") && /"final_nail",/.test(src.slice(src.indexOf("const PANEL_REMOVED"))));
  check("Pet Food Companies is straight under Of animals (round 62)", order.indexOf("mymaps_supp_a") > at("Of animals") && at("The pet industry") === -1 && /name: "Pet Food Companies", fixedName: true/.test(src));
  check("each upcoming launch links to its own pages", /spacelaunchnow\.me\/launch\//.test(src) && /r\.info_urls/.test(src) && /ll2Links\(r\)/.test(src));
  check("page panels have a drag bar", /class="c-grab"/.test(src) && /ns-resize/.test(src));
  // Superseded on 22 September: the symbols gave way to a glow. Every point
  // layer gets a heat field weighted by amount wider out, and a halo under its
  // round dots closer in; the round layer is still the one that is clicked.
  // Round 116b: the glow orbs are back (112b's solid dots undone at the owner's asking).
  check("every point layer gets a faint wide haze and tight cores; the round one stays for clicks, soft-edged and unseen wider out",
        /function addHud\(/.test(src) && /rawAddLayer\(coreSpec, layer\.id\)/.test(src) && /rawAddLayer\(softSpec, layer\.id\)/.test(src) &&
        /hudOf\.set\(layer\.id, \[haze, core, soft\]\)/.test(src) && /paint\(layer\.id, "circle-blur", 0\.8\)/.test(src) /* round 134b: soft orbs again */ &&
        /z\(GLOW\.fadeOut, 0, GLOW\.gone, 0\.9\)/.test(src) && !/if \(!hotspotOf\(layer\)\) \{/.test(src));
  check("\u2026no grain over the map: its strength is 0 and it is never made (23 September)",
        /grain: 0,\s/.test(src) && /if \(!GLOW\.grain && !GLOW\.grainSatellite\) return;/.test(src));
  check("\u2026planetary defence does not pulse the glow's own layers", /if \(\/-\(halo\|haze\|core\|soft\)\$\/\.test\(lid\)\) continue;/.test(src));
  {
    const G = new Function("mapOutputs", src.slice(src.indexOf("const GLOW = {"), src.indexOf("function addHud(layer, rawAddLayer)")) + "; return { GLOW, glowWeight, glowMaxOf };")((v) => v);
    G.glowMaxOf.set("s1", 5000);
    check("\u2026the field is weighted by each source's amount over the layer's largest, so one big emitter outglows ten small ones",
          JSON.stringify(G.glowWeight({ source: "s1" })).includes('["get","value"]') && JSON.stringify(G.glowWeight({ source: "s1" })).includes("5000") &&
          JSON.stringify(G.glowWeight({ source: "none" })).includes('["get","_count"]'));
    const colours = JSON.stringify(G.GLOW);
    check("\u2026its colours run navy, blue and pale ice (round 85b), with no green, orange or yellow", /#0B4F9C/.test(colours) && /#00A8E8/.test(colours) && /#D6EEF6/.test(colours) && !/#C8FFF0|#2EE88A/.test(colours) && !/#E7A63B/i.test(colours));
    check("\u2026the archive's own largest amount is read for the weight", /glowMaxOf\.set\((src|glowKey), Number\(attr\.max\)\)/.test(src));
  }
  check("the zoom-8 note is gone", !/every layer shows summed totals/.test(src));
  const tc = new Function(src.slice(src.indexOf("const TITLE_SMALL"), src.indexOf("function pinBuildings(")) + "; return titleCase;")();
  check("headings are in title case", tc("Suppression by \u201crepresentation\u201d within it") === "Suppression by \u201cRepresentation\u201d Within It" && tc("Of the planet") === "Of the Planet" && tc("For money-written-law") === "For Money-Written-Law");
}

console.log("\nfull shape words; place lists only where markers overlap");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const bs = fs.readFileSync(path.join(HERE, "..", "pipeline", "shapes", "build_shapes.py"), "utf8");
  check("a shape's box shows every field in full", /\/\/ every field, in full/.test(src) && !/\.slice\(0, 16\)\.map\(\(\[k, v\]\)/.test(src));
  check("shapes whose words live in the page's records take them", /def attach_page_data\(e, feats\)/.test(bs) && /attach_page_data\(e, feats\)\n    return feats/.test(bs));
  check("close in, a click opens the nearest place instead of a list", /const PICK_SPLIT_ZOOM = 6;/.test(src) && /map\.getZoom\(\) >= PICK_SPLIT_ZOOM/.test(src));
}

console.log("\nGuerillamap panel, Pollution, the releases split");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
  check("Guerillamap opens as a bottom panel with a drag strip, over the map", /\.gm\{position:fixed;right:0;bottom:0;left:0;height:46vh;z-index:40/.test(index) && /class="gm-grab"/.test(index) && !/#map\.gm-open/.test(index));
  check("Plastics sits under Pollution > All-around pollution", at("Pollution") > 0 && o.PANEL_ORDER[at("Plastics")].h === 5 && at("Plastics") > at("All-around pollution") && at("All-around pollution") > at("Pollution") && at("Toxic pollution") === -1);
  const kids = ["gmo_env", "gmo_decisions", "gmo_ogtr", "gmo_therapy", "gmo_fertility", "gmo_animal_research", "gmo_animal_trade"];
  check("the releases layer is split into its registers, each its own row", o.PANEL_REMOVED.has("gmo_releases") &&
        kids.every((k) => o.PANEL_ORDER.includes(k) && new RegExp(`id:"${k}", sourceOf:"gmo_releases"`).test(src)));
}

console.log("\nHydroWASTE on the map; the EIP and HydroFATE page rows gone");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("HydroWASTE's plants are drawn from their own archive", /id:"hydrowaste", +name:"Wastewater treatment plants \(HydroWASTE\)"[^\n]*route:"pmtiles"/.test(src) &&
        // A sparse checkout (the owner's Mac leaves map/tiles out) has no archives
        // to look at; the file is on GitHub. Anywhere else it must be there.
        (fs.existsSync(path.join(HERE, "tiles", "hydrowaste.pmtiles")) || fs.existsSync(path.join(HERE, "..", ".git", "info", "sparse-checkout"))));
  check("the Environmental Integrity Project and HydroFATE page rows are gone", !/id: "eip_inventory"/.test(src) && !/id: "hydrofate"/.test(src));
}

console.log("\nthe layers column drags on its own");
{
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const edge = src.slice(src.indexOf("function columnEdge("), src.indexOf("/* ---------- Carbon Mapper"));
  check("the left column has a width of its own", /--left-w:var\(--box-w\)/.test(html) &&
        /\.left-col\{[^}]*width:var\(--left-w\)/.test(html) && /#legend\{[^}]*width:var\(--left-w\)/.test(html));
  check("the boxes on the right keep the starting width", /\.right-col\{[^}]*width:var\(--box-w\)/.test(html));
  check("the handle drags the left column, not everything", /--left-w/.test(edge) && !/--box-w/.test(edge));
}

console.log("\nlaunches are drawn, not framed");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_REMOVED = new Set(["), src.indexOf("function panelNodes("));
  check("the two Launch Library 2 rows are still there", /id: "ll2_pads"/.test(src) && /id: "ll2_upcoming"/.test(src));
  check("the framed pages showing the same launches and pads are out",
        ["wrf", "nsf_launches", "nsf_locations"].every((i) => new RegExp(`"${i}"`).test(body)));
}

console.log("\nCarbon Mapper is read through the Worker");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const worker = fs.readFileSync(path.join(HERE, "..", "worker", "index.js"), "utf8");
  check("the row asks the Worker, not the API directly",
        /const CARBON_API = `\$\{WORKER\}\/carbonmapper`;/.test(src) &&
        !/getJson\(`https:\/\/api\.carbonmapper\.org/.test(src));
  check("the Worker has the route and passes the catalogue back unchanged",
        /url\.pathname === "\/v1\/carbonmapper"/.test(worker) &&
        /const CARBON_MAPPER_BASE = "https:\/\/api\.carbonmapper\.org\/api\/v1\/catalog\/plumes\/annotated";/.test(worker));
  check("only the parameters the row sends are forwarded",
        /\["limit", "offset", "sort", "bbox", "plume_gas", "datetime"\]/.test(worker));
}

console.log("\nthe launch rows draw without waiting out the API");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the copy is read beside the live pages, not only after they fail",
        /const LL2_WAIT = 6000;/.test(src) && /const copy = getJson\(cfg\.copy, 20000\)/.test(src) &&
        /Promise\.race\(\[live, late\]\)/.test(src));
  check("a row says which of the two it is showing",
        /did not answer within \$\{Math\.round\(LL2_WAIT \/ 1000\)\} seconds; showing today's copy/.test(src) &&
        /hourly limit was reached; showing today's copy/.test(src));
  check("the reload caption names the shortcut that works while the page is busy",
        /Stuck\? Reload here, or press \u2318R \(Ctrl-R\)/.test(index));
}

console.log("\nNusantara's layers say what they show");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const table = new Function(src.slice(src.indexOf("const NUSANTARA_NAMES = {"), src.indexOf("/* ---------- a map server's whole layer list")) + "; return NUSANTARA_NAMES;")();
  check("every name is a plain one, not the server's id", Object.keys(table).length > 140 &&
        Object.values(table).every((v) => v && !/^[a-z0-9_]+$|_spv|RGB_|TTM/.test(v)));
  check("the ones that read worst are covered",
        table.Global_PlantationIOP_2025 === "Industrial oil palm plantations 2025" &&
        table.concessionitp_spv === "Industrial timber plantation concessions" &&
        table.v3p3_spatialplanmoratorium_spv === "Moratorium areas (PIPPIB) (v3p3 copy)");
  {
    const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
    const S = new Function(pick("function seenPixels(", "maplibregl.addProtocol(\"seen\"") + "; return { seenPixels, zoomOfBbox };")();
    // a 5x5 picture: one black outline pixel in the middle, one green pixel in a corner
    const px = new Uint8ClampedArray(5 * 5 * 4);
    px.set([0, 0, 0, 255], (2 * 5 + 2) * 4); px.set([40, 160, 60, 255], 0);
    const close = px.slice(); S.seenPixels(close, 5, 12);
    check("a server's black outline is redrawn light, and its own colours are kept",
          close[(2 * 5 + 2) * 4] === 220 && close[0] === 40 && close[1] === 160 && close[(2 * 5 + 3) * 4 + 3] === 0);
    const far = px.slice(); S.seenPixels(far, 5, 6);
    check("\u2026wider out a drawn pixel grows into the empty ones round it, in its own colour, so small areas show from the world view",
          far[(2 * 5 + 3) * 4 + 3] > 100 && far[(2 * 5 + 3) * 4] === 220 && far[(0 * 5 + 1) * 4 + 1] === 160 && far[(4 * 5 + 0) * 4 + 3] === 0 &&
          // Round 101b: grown round, not into a square block; faint edges cleared.
          far[(1 * 5 + 1) * 4 + 3] === 0);
    check("\u2026the zoom is read from the square asked for", S.zoomOfBbox("x?BBOX=0,0,20037508.34,20037508.34&W=1") === 1 &&
          S.zoomOfBbox("x?BBOX=0,0,2445.98,2445.98") === 14);
    check("Nusantara's pictures go through it only where the server lets them be read, and each ticked layer shows the server's own key",
          /plain\.replace\(\/\^https:\\\/\\\/\/, "seen:\/\/"\) : plain/.test(src) && /REQUEST=GetLegendGraphic/.test(src) &&
          /img\.onerror = \(\) => el\.remove\(\);/.test(src) && /else \{ on\.delete\(i\); legendOff\(items\[i\]\); \}/.test(src));
    check("a row's description sits behind an i beside its other marks, not as the whole row's hover text",
          /function infoMark\(text\)/.test(src) && !/row\.title = item\.about/.test(src) && /\$\{siteLink\(cfg\.id\)\}\$\{infoMark\(item\.about\)\}/.test(src) &&
          /if \(e\.target && e\.target\.closest && e\.target\.closest\("\.info"\)\) e\.preventDefault\(\);/.test(src));
    const G = new Function(src.slice(src.indexOf("const GFW_TITLES = {"), src.indexOf("// Datasets with no tiles of their own")) + "; return { gfwTitle, gfwPickAsset, gfwAssetIndex };")();
    const A = (asset_type, status, asset_uri) => ({ asset_type, status, asset_uri });
    check("a Global Forest Watch dataset is drawn from its ready-made tiles before the slow made-on-request ones",
          G.gfwPickAsset([A("Dynamic vector tile cache", "saved", "https://t/dynamic/{z}/{x}/{y}.pbf"), A("Static vector tile cache", "saved", "https://t/default/{z}/{x}/{y}.pbf")]).uri === "https://t/default/{z}/{x}/{y}.pbf" &&
          G.gfwPickAsset([A("Dynamic vector tile cache", "saved", "https://t/dynamic/{z}/{x}/{y}.pbf")]).slow === true);
    check("\u2026a tile cache still being made is not drawn from, and the row can say it is waiting",
          G.gfwPickAsset([A("Raster tile set", "saved", "s3://x"), A("Raster tile cache", "pending", "https://t/{z}/{x}/{y}.png")]).how === "none" &&
          G.gfwPickAsset([A("Raster tile cache", "pending", "https://t/{z}/{x}/{y}.png")]).waiting === true &&
          G.gfwPickAsset([A("Raster tile set", "saved", "s3://x")]).waiting === false);
    const cog = G.gfwPickAsset([A("Raster tile set", "saved", "s3://x"), A("COG", "saved", "s3://gfw-data-lake/d/v1/raster/epsg-4326/cog/default.tif")]);
    check("\u2026a dataset with only a GeoTIFF is drawn as a picture through Global Forest Watch's own tile service",
          cog.how === "cog" && /^https:\/\/tiles\.globalforestwatch\.org\/cog\/basic\/tiles\/WebMercatorQuad\/\{z\}\/\{x\}\/\{y\}\.png\?url=s3%3A%2F%2F/.test(cog.uri));
    check("\u2026an asset's tiles are asked for only at the zooms its record gives, which is what returned 422",
          G.gfwPickAsset([Object.assign(A("Raster tile cache", "saved", "https://t/{z}/{x}/{y}.png"), { creation_options: { min_zoom: 2, max_zoom: 9 } })]).maxzoom === 9 &&
          G.gfwPickAsset([A("Raster tile cache", "saved", "https://t/{z}/{x}/{y}.png")]).maxzoom === 12);
    const idx = G.gfwAssetIndex([{ dataset: "a", version: "v2020", asset_type: "COG", asset_uri: "s3://o" }, { dataset: "a", version: "v2023", is_latest: true, asset_type: "COG", asset_uri: "s3://n" },
                                  { dataset: "b", version: "v1", asset_type: "COG", asset_uri: "s3://b1" }, { dataset: "b", version: "v3", asset_type: "COG", asset_uri: "s3://b3" }]);
    check("\u2026the asset list is read once at the start and each dataset keeps its latest version's assets, or its newest where none is marked",
          idx.a.length === 1 && idx.a[0].asset_uri === "s3://n" && idx.b.length === 1 && idx.b[0].asset_uri === "s3://b3" &&
          /assets\?asset_type=\$\{encodeURIComponent\(kind\)\}/.test(src));
    check("\u2026and a dataset that is downloads only has no row, at the owner's request, with the count said on the catalogue's row",
          /leftOut = all\.filter\(\(d\) => gfwPickAsset\(index\[d\.dataset\] \|\| \[\]\)\.how === "none"\)/.test(src) && /more are downloads only and have no row/.test(src));
    check("\u2026a dataset with no title is named where what it is can be shown, and otherwise says it has none",
          /Maus et al/.test(G.gfwTitle({ dataset: "pangaea_global_mining", metadata: {} })) &&
          G.gfwTitle({ dataset: "wur_x_class", metadata: {} }) === "Wur x class (Global Forest Watch)" &&
          G.gfwTitle({ dataset: "a", metadata: { title: "Tree cover" } }) === "Tree cover");
    const harvester = fs.readFileSync(path.join(HERE, "..", "pipeline", "sources", "abattoir_facilities.py"), "utf8");
    check("a harvested layer's box shows every field its source published, not the first six, and scrolls when long",
          !/\.slice\(0, 6\)\s*\n\s*\.map\(\(\[k, v\]\) => `\$\{k\.slice\(2\)/.test(src) && /k\.startsWith\("x_"\) && v !== null/.test(src) &&
          /maplibregl-popup-content\{max-height:60vh;overflow-y:auto/.test(fs.readFileSync(path.join(HERE, "index.html"), "utf8")));
    check("\u2026and the facilities harvester carries through what Trase published for a site, tax number included",
          /PUBLISHED_AS = \{"br_trase": "trase"\}/.test(harvester) && /\*\*_published\(members\),/.test(harvester));
    {
      const norm = fs.readFileSync(path.join(HERE, "..", "pipeline", "normalize.py"), "utf8");
      const harv = ["gem_coal", "carbon_bombs", "fertilizer_facilities", "epa_tri_sites", "gmo_releases", "land_matrix", "local_projects", "power_plants",
                    "remains_records", "slavery_cases", "slavery_fishing", "slavery_ports", "slavery_sites", "soy_organizations", "climate_trace", "owid_co2"]
        .map((f) => fs.readFileSync(path.join(HERE, "..", "pipeline", "sources", f + ".py"), "utf8"));
      check("every harvester hands its whole source row on, and the pipeline files it in pieces beside the tiles",
            harv.every((h) => /"raw": [a-z]+,\n\s*"extra": \{/.test(h)) && /def write_pieces\(raws, pieces_dir\)/.test(norm) &&
            /pieces_dir=f"map\/data\/pieces\/\{args\.source\}"/.test(norm) && /PIECES_SKIP = \{"climate_trace"\}/.test(norm));
      check("\u2026and a click shows every field from the record's piece, found by the same hash the pipeline used, the pieces named by the layer since the tiles carry no source field",
            /readPiece\(`data\/pieces\/\$\{from\}`, p\.id\)/.test(src) && /bindPopup\(`\$\{cfg\.id\}-pt`, owner\)/.test(src) && /Every field the source publishes/.test(src) &&
            /h = \(\(h \^ b\) \* 0x01000193\) & 0xFFFFFFFF/.test(norm));
      const fieldRows = new Function("escapeHtml", src.slice(src.indexOf("const FIELD_WORDS = {"), src.indexOf("function fieldRows(")) + src.match(/function fieldRows[\s\S]*?\n}\n/)[0] + "; return fieldRows;")((x) => String(x));
      check("\u2026and a value JSON cannot write (a set, a date) is written plainly rather than stopping the harvest",
            /json\.dumps\(row, separators=\(",", ":"\), default=_plain\)/.test(fs.readFileSync(path.join(HERE, "..", "pipeline", "harvest.py"), "utf8")));
      check("\u2026a nested value in a copied file's record is written out, not dropped",
            /Notes<\/th><td>\["a","b"\]/.test(fieldRows({ Notes: ["a", "b"], Empty: [] })) && !/Empty/.test(fieldRows({ Notes: ["a"], Empty: [] })));
    }
    check("a catalogue row says what became of it on the row itself, not on the hidden row",
          /function rowSay\(key, text\)/.test(src) && /no map tiles are published for this dataset, only files to download/.test(src) && /its tiles are not answering/.test(src));
  }
  check("two more are named from Nusantara's own menu, and the three nobody can vouch for are still left alone",
        table.concessionfca_spv === "Forest Clearance Authority (FCA) concessions" && table.millopbufferol50km_spv === "Near palm oil mills, 50 km" &&
        !("concessioncma_spv" in table) && !("millopbufferol_spv" in table) && !("millopbufferpolyloreal_spv" in table) &&
        /\[\/\^concessionfca_\/i, "Papua New Guinea"\]/.test(src));
  check("a layer nobody has named keeps the server's own title, rather than a guess",
        /const said = NUSANTARA_NAMES\[id\] \|\| \(tt && tt\.textContent\) \|\| id;/.test(src));
}

console.log("\neach row links the site it is read from");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const sites = new Function(src.slice(src.indexOf("const LAYER_SITE = {"), src.indexOf("function siteLink(")) + "; return LAYER_SITE;")();
  check("most rows carry a site", Object.keys(sites).length > 90 &&
        Object.values(sites).every((u) => /^https?:\/\//.test(u) && !u.includes("{")));
  check("your own rows point at the repo or page they are read from",
        /github\.com\/WelcomeToYourGalaxy\//.test(sites.gmo_cultivation || "") &&
        /github\.com\/WelcomeToYourGalaxy\/anti-slavery-map/.test(sites.slavery_ports || ""));
  check("Trase's rows point at Trase", /trase\.earth/.test(sites.trase_palm_indonesia || ""));
  check("the link is drawn beside the title, on a row and on a group's child",
        /<span class="nm">\$\{cfg\.name\}\$\{liveMark\(cfg\)\}\$\{siteLink\(cfg\.id\)\}\$\{infoMark\(cfg\.about \|\| cfg\.note\)\}<\/span>/.test(src) &&
        /<span class="nm">\$\{child\.name\}\$\{liveMark\(child\)\}\$\{siteLink\(child\.id\)\}\$\{infoMark\(child\.about \|\| child\.note\)\}<\/span>/.test(src));
  check("a row with no site shows no link rather than a guessed one",
        /const u = LAYER_SITE\[id\];\n  if \(!u\) return "";/.test(src) && /#layers \.nm \.src\{/.test(index));
  check("titles that named no source say so now",
        /name:"Coal plant units \(Global Energy Monitor, Global Coal Plant Tracker\)"/.test(src) &&
        /name: "Where genetically engineered crops are grown \(Genetic engineering map\)"/.test(src));
}

console.log("\nbuildings stand up with the terrain");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const BUILDINGS_SOURCE ="), src.indexOf("function setTerrain("));
  check("real footprints, from a source that needs no key",
        /url: "https:\/\/tiles\.openfreemap\.org\/planet"/.test(body) && /"source-layer": "building"/.test(body) &&
        /type: "fill-extrusion"/.test(body));
  check("each is raised to the height the source records, and one without a height is left out",
        /\["get", "render_height"\]/.test(body) && /\["has", "render_height"\]/.test(body));
  check("only close in, and only while the ground is tilted",
        /minzoom: BUILDINGS_ZOOM/.test(body) && /const BUILDINGS_ZOOM = 15;/.test(body) &&
        /setBuildings3D\(TERRAIN_ON\);/.test(src));
  check("OpenStreetMap and the two that serve it are credited",
        /openstreetmap\.org\/copyright/.test(body) && /openmaptiles\.org/.test(body) && /openfreemap\.org/.test(body));
  check("nothing orange, yellow or neon in the walls", /"fill-extrusion-color": "#7C7468"/.test(body));
}

console.log("\nthe reload row is not clipped, and covers nothing");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("it moves into the right column, above the View box",
        /const under = document\.querySelector\("\.right-col"\);/.test(src) && /under\.insertBefore\(wrap, under\.firstChild\)/.test(src));
  check("it keeps its height while the settings box scrolls in what is left",
        /\.right-col > \.reload-wrap\{flex:0 0 auto;[^}]*overflow:visible\}/.test(index) &&
        /\.right-col > #basemaps\{flex:0 1 auto;min-height:0\}/.test(index));
  check("in the column's flow, so it sits over nothing", !/\.view-choices \.reload-wrap/.test(index));
  check("its words are given the room to wrap", /\.reload-cap\{line-height:1\.2;max-width:none/.test(index));
}

console.log("\nplumes show from the world view; the last sources named");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("every plume is its own point at every zoom; nothing is merged (22 September, round 4)",
        !/cluster: true, clusterMaxZoom: CARBON_CLUSTER_TO/.test(src) && !/CARBON_CLUSTER_TO/.test(src) &&
        !/plumes here<\/b>/.test(src) && /const CARBON_PLUME_ZOOM = 10;/.test(src));
  check("Nusantara's high-resolution imagery says where it is",
        /"hires": "High-resolution imagery, the southern tip of Bali"/.test(src));
  check("hiding the row hides the merged points too", /`\$\{id\}-agg`, `\$\{id\}-cl`, `\$\{id\}-pt`/.test(src));
  const sites = new Function(src.slice(src.indexOf("const LAYER_SITE = {"), src.indexOf("function siteLink(")) + "; return LAYER_SITE;")();
  const was = ["fertilizer_facilities", "gpw_map", "seas_of_plastic", "gfw_catalogue", "atlas_hotspots",
               "atlas_cities", "pe_subsidising", "powerbi_report", "skytruth_monitor", "skytruth_voc",
               "soy_organizations", "dff", "theyrule", "pe_bankrolling", "tableau_zsf", "troutwood",
               "gta_acts", "giga_countries", "capture_map", "mymaps_supp_a", "esa_risk", "biosignature",
               "building_types"];
  check("every one of the twenty-three carries a site", was.every((i) => /^https:\/\//.test(sites[i] || "")));
  check("each points at the people who published it, not at this map's copy",
        was.every((i) => !/welcometoyourgalaxy\.github\.io/.test(sites[i])));
  check("the titles that said nothing about their source now say it",
        // 22 September: "(Welcome to Your Galaxy)" dropped again from the site's own four rows, as asked.
        /name:"Fertilizer plants"/.test(src) && /name:"Soy industry bodies"/.test(src) && /name: "Biosignature Evidence Assessment"/.test(src));
}

console.log("\nlive rows say so; the grips read as handles; a shut box stops scrolling");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const live = new Function(src.slice(src.indexOf("const LIVE_ROUTES = new Set(["), src.indexOf("function liveMark(")) + "; return LIVE_ROUTES;")();
  check("the routes that read their source as you look are marked live",
        ["worker", "cerulean", "coral", "carbonmapper", "wmsmenu", "gfwmenu", "trase", "ll2"].every((r) => live.has(r)));
  check("copies are not in the live routes, and carry the NOT LIVE mark instead", !live.has("pmtiles") && !live.has("sitemap") && !live.has("shapes") && !live.has("country") &&
        /NOT LIVE<\/span>/.test(src));
  check("the mark says what it means, and is drawn beside the title",
        /not from a copy kept here/.test(src) && /#layers \.nm \.live\{/.test(index));
  check("a box pulled right down stops scrolling", /classList\.toggle\("pulled-shut", h <= PULL_MIN \+ 4\)/.test(src) &&
        /\.pulled-shut\{overflow:hidden !important\}/.test(index));
  check("the pull handle is a bar in a lip, not a hairline",
        /\.pull-grip\{flex:none;height:16px/.test(index) && /\.pull-grip::after\{/.test(index) &&
        /\.pull-grip:hover::before\{background:var\(--bone\)/.test(index));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED"));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  const kinds = order.map((x, i) => (x && x.h === 3 && ["Of humans", "Of animals", "Of plants", "Of microscopics"].includes(x.t) ? i : -1)).filter((i) => i > at("Of individuals"));
  check("Of individuals holds Of humans and Of animals (round 102b)", kinds.length === 2);
}

console.log("\na row can sit under more than one subject");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("a second naming makes a copy, not a second row",
        /if \(placed\.has\(item\)\) \{\n\s*const copy = copyRow\(leads\.get\(item\), item\);/.test(src) &&
        /function copyRow\(lead, id\)/.test(src));
  // The row has been moved into the fragment being built by the time a second
  // naming comes round, so it is kept rather than looked for in the box.
  check("the copy is taken from the row itself, wherever it has got to",
        /const leads = new Map\(\);/.test(src) && /leads\.set\(item, nodes\[0\]\)/.test(src));
  check("a copy carries data-copy, so nothing that drives layers counts it twice",
        /input\.removeAttribute\("data-layer"\);\n\s*input\.dataset\.copy = id;/.test(src));
  check("ticking a copy ticks the row it copies, and the row ticks its copies",
        /const copied = e\.target\.dataset && e\.target\.dataset\.copy;/.test(src) &&
        /syncCopies\(box, id, e\.target\.checked\);/.test(src));
  check("a copy leaves the row's own tools with the row", /for \(const tool of copy\.querySelectorAll\("\.grip, \.fold"\)\) tool\.remove\(\);/.test(src));
  check("headings count copies in the number beside them",
        /const ROW_TICKS = "\[data-layer\], \[data-copy\], \[data-gm\], \[data-cat\], \[data-cat-copy\], \[data-smtype\]";/.test(src));
  check("\u2026and the catalogues' rows and the site maps' type rows, counted again when they arrive, so no full heading reads none yet",
        /countHeadings\(box\);\n[\s\S]{0,160}if \(box\.dataset\.catWired\) return;/.test(src) && (src.match(/countHeadings\(box\);/g) || []).length >= 3 &&
        /filter\(\(i\) => !\(i\.closest && i\.closest\("\[data-removed\]"\)\)\)/.test(src));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED"));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("the eight new headings are in, in the order's own style",
        // Spatial plans is one row with sublayers under Deforestation since round 23.
        ["Fire", "Peatland", "Water scarcity", "Invasion of humans"].every((t) => at(t) > -1) && at("Base and reference") === -1 && at("Spatial plans") === -1 &&
        at("Land held under permit") === -1 && at("Forest and land cover") === -1);   // round 123b: its rows under Land Use and Ecoregions
  check("the planet's new headings sit under Of the planet, before Of groups",
        ["Fire", "Peatland", "Water scarcity", "Other concessions", "General", "Oil spills and slicks at sea"]
          .every((t) => at(t) > at("Of the planet") && at(t) < at("Of groups")));
  check("Base and reference is taken out (round 56); Buildings is back (round 71)", at("Base and reference") === -1 && at("Buildings") > -1);
}

console.log("\nNusantara's layers spread through the box");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  check("a layer goes under every subject its words answer to",
        places("Mining concessions Indonesia").includes("Destruction > Of the planet > Mining") &&
        places("Oil palm concessions, by who lends to them").join() === "Destruction > Of the planet > Meat and agriculture > Agriculture > By crop > Palm oil > Who finances them");
  const orderH = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED")) + "; return PANEL_ORDER;")();
  const atH = (t) => orderH.findIndex((x) => x && x.t === t);
  // A concession is filed by what it is for; the generic heading is gone (22 September).
  check("a concession goes under its material or activity, not a generic permit heading",
        // One level further since round 23 (item 27).
        places("Timber concessions").join() === "Destruction > Of the planet > Deforestation > Logging and timber concessions" &&
        places("Forest utilisation permits (PBPH)").join() === "Destruction > Of the planet > Deforestation > Logging and timber concessions" &&
        places("Logging concessions").join() === "Destruction > Of the planet > Deforestation > Logging and timber concessions" &&
        places("Mining concessions").join() === "Destruction > Of the planet > Mining" &&
        places("Plantation land-use rights (HGU)").join() === "Destruction > Of the planet > Meat and agriculture > Agriculture > Cropland > Plantations of no single crop (single crops are under By crop)" &&
        places("Cumulative deforestation for planted pulpwood inside concession trase").includes("Destruction > Of the planet > Deforestation > Wood pulp, Indonesia") &&
        places("Oil and gas concessions").join() === "Destruction > Of the planet > Climate > Methane > Culprits,Destruction > Of the planet > Pollution > Land pollution > Where oil and gas is drilled" &&
        !/"Destruction > Of the planet > Land held under permit"/.test(src));
  check("\u2026one that names no material or activity goes under Other concessions; rubber under Deforestation",
        places("Rubber plantations 2020, Kalimantan").join() === "Destruction > Of the planet > Deforestation > Timber and rubber plantations" &&
        places("Concessions of other kinds").join() === "Destruction > Of the planet > Other concessions" &&
        places("National Strategic Project concessions, Merauke").join() === "Destruction > Of the planet > Other concessions" &&
        places("Some permit").join() === "Destruction > Of the planet > Other concessions" &&
        (atH("Other") === -1 || atH("Other") > atH("Of groups")) &&
        atH("Other concessions") > atH("Construction") && atH("Other concessions") < atH("Of groups"));
  // 22 September: the box rearranged to the owner's list.
  // 22 September, later the same day: Climate arranged by gas, in the Destruction page's order.
  check("Climate is arranged by gas, in the page's order, and an emissions row goes under the gas it names, else carbon dioxide",
        ["General", "Carbon dioxide", "Methane", "Nitrous oxide", "F-gases", "Black carbon"].every((g, i, a) => orderH.findIndex((x, k) => k > atH("Climate") && x && x.t === g) > atH("Climate") && (!i || atH(g) > atH(a[i - 1]))) &&
        atH("By sector") === -1 && atH("By greenhouse gas") === -1 && atH("Infrastructure emitting more than one gas") === -1 &&
        places("Total GhG emissions trase").join() === "Destruction > Of the planet > Climate > Carbon dioxide > Emissions" &&
        places("Methane emissions from peat trase").includes("Destruction > Of the planet > Climate > Methane > Emissions") &&
        places("Carbon flux").join() === "Destruction > Of the planet > Climate > Carbon dioxide > Emissions");
  // Round 75: Carbon Mapper is a row per gas; the refineries are no longer under Black carbon.
  check("\u2026Carbon Mapper's methane under Methane and its carbon dioxide under Carbon dioxide; grain, soy and corn under Nitrous oxide; the refineries under Carbon dioxide",
        orderH.filter((x) => x === "carbon_plumes").length === 1 && orderH.indexOf("carbon_plumes") > atH("Methane") &&
        orderH.indexOf("carbon_plumes_co2") > atH("Carbon dioxide") && orderH.indexOf("carbon_plumes_co2") < atH("Methane") &&
        orderH.filter((x) => x === "fractracker_refineries").length === 1 &&
        orderH.indexOf("fertilizer_facilities") > atH("Nitrous oxide") && orderH.indexOf("fertilizer_facilities") < atH("F-gases") &&
        orderH.indexOf("fractracker_refineries") > atH("Carbon dioxide") && orderH.indexOf("fractracker_refineries") < atH("Methane"));
  check("\u2026and every Nusantara alert row is under Deforestation",
        places("Trees cut, Indonesia and Malaysia \u2014 every alert system at once, as Nusantara reads them").join() === "Destruction > Of the planet > Deforestation > Tree cover loss and alerts > Alerts" &&
        places("Trees cut, seen through cloud by radar (RADD), as Nusantara reads it").join() === "Destruction > Of the planet > Deforestation > Tree cover loss and alerts > Alerts");
  check("\u2026Trase's soy goes under Climate > Nitrous oxide > Emissions (round 75), not the general heading; its cocoa area is out (24 September)",
        places("Production of soy trase").join() === "Destruction > Of the planet > Climate > Nitrous oxide > Emissions" &&
        places("Cocoa area trase", "Cocoa area trase").join() === "(taken out)");
  check("\u2026the moratorium (PIPPIB) is in the spatial plans row under Deforestation; Badung's plans are out (24 September)",
        places("Moratorium areas (PIPPIB)").join() === "Destruction > Of the planet > Deforestation > Forest zoning and management plans > Indonesia's land-use plans, state forest estate and ban on new clearing permits" &&
        places("Detailed spatial plan 2023, Badung (RDTR)", "Detailed spatial plan 2023, Badung (RDTR)").join() === "(taken out)");
  check("\u2026a land-cover layer is back under Forest and land cover until the owner decides; mangroves under Reefs and mangroves",
        places("Land cover 2020, Indonesia").join() === "Destruction > Of the planet > Biodiversity loss > Land Use and Ecoregions" &&   // round 123b places("Mangrove extent").join() === "Destruction > Of the planet > Oceans > Reefs and mangroves" &&
        /leftOut\+\+; item\.leftOut = true; return;/.test(src));
  check("the Tang and Werner mine features are a row under Mining, drawn like the mines, and say what the release carries",
        /id: "mine_features"[^\n]*route: "pmshapes"/.test(src) && /tiles\/mine_features\.pmtiles/.test(src) && /pointLayer: "mine_feature_points"/.test(src) &&
        /\{ h: 3, t: "Mining" \}, "mines_global", "mine_features",/.test(src) && /no commodity or impact figure/.test(src));
  check("\u2026the cultivated-meat row is back under Meat (round 95b), and Culprits upstream is dissolved", !/"cultivated_meat_laws",/.test(src.slice(src.indexOf("const PANEL_REMOVED"))) && atH("Culprits upstream") === -1);
  check("fire alerts are fire and deforestation is deforestation",
        places("Fire alerts, VIIRS")[0] === "Destruction > Of the planet > Deforestation" ||
        places("Fire alerts, VIIRS").includes("Destruction > Of the planet > Fire"));
  check("customary forest is land and territory, not forest cover",
        places("Customary forest (hutan adat)").includes("On-planet invasion > Invasion of the living > Invasion of humans"));
  check("nothing stays under boundaries and relief (the GLAD-L coverage went on 25 September)",
        places("Coverage Layer for GLAD-L")[0] === "(taken out)" &&
        places("Hillshade relief")[0] === "(taken out)");
  check("a layer no rule claims waits in Not yet placed rather than being invented a home",
        places("qqqq zzzz")[0] === "Not yet placed");
  check("a heading nothing answers to is not made up", /function sectionBody\(box, path\)/.test(src) && /if \(!found\) return null;/.test(src));
  check("a second home ticks the first, and the first ticks its copies",
        /const copied = t\.dataset\.catCopy;/.test(src) && /querySelectorAll\(`\[data-cat-copy="\$\{key\}"\]`\)/.test(src));
  check("each row says it is live and links its source", /class="live"/.test(src) && /\$\{siteLink\(cfg\.id\)\}<\/span>/.test(src));
}

console.log("\nthe Global Forest Watch catalogue, as rows");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("async function addGfwMenuLayer("), src.indexOf("/* ---------- The Social Spheres"));
  check("several datasets can be drawn at once, each with its own source",
        /const drawn = new Map\(\);/.test(body) && /`\$\{cfg\.id\}-\$\{safe\(d\.id\)\}`/.test(body) &&
        !/const clear = \(\) =>/.test(body));
  check("unticking one takes its own layers away and leaves the others",
        /for \(const id of drawn\.get\(d\.id\) \|\| \[\]\) if \(map\.getLayer\(id\)\) map\.removeLayer\(id\);/.test(body) &&
        /drawn\.delete\(d\.id\);/.test(body));
  check("the row says how many of the catalogue are drawn",
        /\$\{drawn\.size\} of \$\{items\.length\} datasets drawn/.test(body));
  check("a dataset with no tiles says so rather than failing quietly",
        /publishes no map tiles for this dataset \(download only\)/.test(body));
  check("its rows are filed by the same rules as Nusantara's",
        /catalogueRows\(cfg, rows\);/.test(body) && /CATALOGUE_ITEMS\.set\(r\.key, r\)/.test(body));
}

console.log("\nrows that show nearly the same thing say how they differ");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the tropical alerts say they are trees cut, and only the tropics",
        /name:"Trees cut, tropics only \\u2014 seen by radar and optical satellites, last 30 days \(GLAD-L, GLAD-S2, RADD\)"/.test(src));
  check("DIST-ALERT says it is any loss of plant cover, worldwide",
        /name:"Any loss of plant cover, worldwide \\u2014 cutting, fire, drought or harvest alike, last 30 days \(DIST-ALERT\)"/.test(src) &&
        /name:"Any loss of plant cover, worldwide \\u2014 the same, gathered over a year \(DIST-ALERT\)"/.test(src));
  check("Nusantara's alert layers say which satellite saw it, and where",
        /"Trees cut, seen by optical satellite \(GLAD\), as Nusantara reads it"/.test(src) &&
        /"Trees cut, seen through cloud by radar \(RADD\), as Nusantara reads it"/.test(src) &&
        /"Trees cut, Indonesia and Malaysia \\u2014 every alert system at once, as Nusantara reads them"/.test(src));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED"));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("the pulp concessions, one row with its three periods since round 83b, sit under one heading of their own",
        at("Wood pulp, Indonesia") > -1 && order.indexOf("trase_pulp_concessions") > at("Wood pulp, Indonesia") &&
        /periods: \[/.test(src));
}

console.log("\nreallocated rows say where they are; the emptied rows leave the box");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const where = new Function(src.slice(src.indexOf("const NUSANTARA_WHERE = ["), src.indexOf("function cataloguePlaces(")) + "; return nusantaraWhere;")();
  check("a Nusantara layer says where it is, read from its own id",
        where("Global_PlantationIOP_2025") === "worldwide" && where("IDNMYSBorneo_LCHSRiver") === "Borneo" &&
        where("IDN_Mining_2023") === "Indonesia" && where("papua_expansion_2025") === "Papua" &&
        where("BALI_19650531") === "Bali");
  check("one whose id says nothing takes the atlas's own stated coverage",
        where("concessioniop_spv") === "Equatorial Asia" && where("alertfire_viirs") === "Equatorial Asia");
  check("the title carries it, unless it already says it",
        /new RegExp\(where, "i"\)\.test\(said\) \? said : `\$\{said\} \\u2014 \$\{where\}`/.test(src));
  check("a GFW dataset takes the coverage GFW record, and nothing where they record none",
        /const where = String\(GFW_WHERE\[d\.dataset\] \|\| meta\.geographic_coverage \|\| ""\)\.trim\(\);/.test(src));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  check("the two emptied rows are out of the box but still findable by the code",
        !o.PANEL_ORDER.includes("nusantara") && !o.PANEL_ORDER.includes("gfw_catalogue") &&
        o.PANEL_REMOVED.has("nusantara") && o.PANEL_REMOVED.has("gfw_catalogue"));
}

console.log("\na row's own filters read as groups, not a wall of chips");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("each filter's name is its own line, with an all beside it",
        /<div class="fl">\$\{escapeHtml\(f\.label\)\}/.test(src) &&
        /<button type="button" class="chip reset" data-sm="\$\{cfg\.id\}" data-fi="\$\{i\}" data-k="">all<\/button>/.test(src));
  check("its values sit under it, and a long list scrolls rather than pushing the box off screen",
        /<div class="fv">/.test(src) && /#layers \.facet-set \.fv\{[^}]*max-height:96px;overflow:auto/.test(index));
  check("a count is quieter than the name it belongs to", /<em>\$\{v\.n\.toLocaleString\(\)\}<\/em>/.test(src) &&
        /#layers \.facet-set \.chip em\{font-style:normal;opacity:\.6/.test(index));
  check("Colour by is a labelled group too, with its year at the end of the line and its key under it",
        /<div class="fl">Colour by/.test(src) && /#layers \.facet-set \.fl select\{margin-left:auto\}/.test(index) &&
        /#layers \.facet-set \.sm-legend\{margin-top:5px\}/.test(index));
}

console.log("\nnothing in the box is named for who published it");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const groups = [...src.matchAll(/\n  name: "([^"]+)",\n  group: true/g)].map((m) => m[1]);
  // A group's name may end with its source in parentheses (the naming rule since
  // 22 September: "Emitting sites by sector (Climate TRACE)"), but never open with it.
  check("every group is named for its subject, the source at the end if at all", groups.length > 8 &&
        !groups.some((n) => /^(climate trace|global forest watch|nusantara|trase|the site's own|map repos|organisations'|accountability map|engineering map)/i.test(n)));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED"));
  const order = new Function(body + "; return PANEL_ORDER;")();
  check("and so is every heading",
        !order.some((x) => x && x.t && /(climate trace|global forest watch|nusantara|trase|palmwatch|skytruth)/i.test(x.t)));
  check("the groups say what they hold",
        groups.includes("Emitting sites by sector (Climate TRACE)") && groups.includes("Emissions from farming and land use (Climate TRACE)") &&
        groups.includes("Trees and plant cover lost, as it happens") && groups.includes("Maps made by others"));
}

console.log("\nGlobal Safety Net fixes; My Maps titles");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("Global Safety Net's rankings are under Biodiversity loss (round 91b: as the map's own country shading)", order.indexOf("gsn_countries") > at("Biodiversity loss") && order.indexOf("gsn_countries") < at("Mining") && /"gsn",\s+\/\/ its layers are rows of their own/.test(src));
  check("My Maps rows take their maps' titles before opening", /function mymapsTitles\(/.test(src) && /map\.on\("load", \(\) => setTimeout\(mymapsTitles, 50\)\)/.test(src));
}

console.log("\nAtlas cities zoom in when clicked");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("clicking a city from further out zooms in to it, then opens its box", /route: "atlascities", zoomTo: 9,/.test(src) && /map\.flyTo\(\{ center: at, zoom: z, duration: 1600 \}\)/.test(src));
}

console.log("\nACGF removed; oil slicks grouped; the slick archive seen from afar");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
  check("ACGF is removed", o.PANEL_REMOVED.has("acgf") && !o.PANEL_ORDER.includes("acgf"));
  // Round 81: slicks at sea under Water pollution, spills on land under Land pollution.
  check("slicks at sea under Water pollution, spills on land under Land pollution, the slicks layer with its two SkyTruth parts",
        at("Water pollution") < at("Oil spills and slicks at sea") && at("Oil spills and slicks at sea") < at("Land pollution") &&
        at("Land pollution") < at("Oil and chemical spills on land") &&
        o.PANEL_ORDER.indexOf("skytruth_monitor") > at("Oil and chemical spills on land") &&
        ["cerulean_slicks", "cerulean_sources", "skytruth_voc", "skytruth_posts_sea"].every((i) => o.PANEL_ORDER.indexOf(i) > at("Oil spills and slicks at sea") && o.PANEL_ORDER.indexOf(i) < at("Plastic in the sea")) &&
        o.PANEL_ORDER.some((x) => x && x.bundle === "oilslicks") && o.PANEL_ORDER.lastIndexOf("skytruth_posts_land") > at("Oil and chemical spills on land"));
  check("the slick archive draws a point per slick wider out", /id: `\$\{cfg\.id\}-pt`, type: "circle", source: `\$\{src\}-pt`, maxzoom: 7/.test(src));
}

console.log("\nround of 22 September (2): the box refiled, rows taken out");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const order = o.PANEL_ORDER, at = (t, from = 0) => order.findIndex((x, i) => i >= from && x && x.t === t);
  const P = "Destruction > Of the planet", AG = P + " > Meat and agriculture > Agriculture";
  const f = (t) => places(t, t).join(" | ");
  check("the drivers of tree cover loss are deforestation, not fire",
        f("Tree cover loss by dominant driver") === P + " > Deforestation > Tree cover loss and alerts > What drove the loss" &&
        f("Drivers of tree cover loss (WRI/Google)") === P + " > Deforestation > Tree cover loss and alerts > What drove the loss");
  check("soy planted area is under Nitrous oxide > Emissions only (round 75: the crop areas with the emissions)",
        f("Soy planted area \u2014 South America") === `${P} > Climate > Nitrous oxide > Emissions` &&
        at("Emissions", at("Nitrous oxide")) > at("Nitrous oxide") && at("Emissions", at("Nitrous oxide")) < at("F-gases"));
  check("protected areas, intact forest landscapes worldwide and biodiversity hotspots are biodiversity loss",
        f("Protected areas (WDPA)") === P + " > Biodiversity loss > Places that matter most for species > Protected areas" &&   // round 99b
        f("Intact forest landscapes \u2014 Global") === P + " > Biodiversity loss > Places that matter most for species > Wild and intact places" &&
        f("Biodiversity hotspots (global, land only)") === P + " > Biodiversity loss > Places that matter most for species > Where species are threatened");
  check("dams go under Biodiversity loss > Fish",
        f("Major dams") === P + " > Biodiversity loss > Fish" && at("Fish") > at("Biodiversity loss") && at("Fish") < at("Mining"));
  check("forest greenhouse gas emissions and net flux go under Climate only (24 September)",
        f("Forest greenhouse gas emissions") === P + " > Climate > Carbon dioxide > Emissions" &&
        f("Forest greenhouse gas net flux \u2014 Global gfw_forest_carbon_net_flux") === `${P} > Climate > Carbon dioxide > Emissions`);
  check("DIST-ALERT is under Construction, Biodiversity loss, Fire, Mining and Deforestation",
        f("Global all ecosystem disturbance alerts (DIST-ALERT)") === "(taken out)");  // round 85b: out, the integrated rows hold it
  // Round 23 (item 2): the drilling heading is gone.
  check("oil and gas concessions go under Methane's culprits (round 120b) and where oil and gas is drilled, not Mining (round 75)",
        f("Oil and gas concessions") === `${P} > Climate > Methane > Culprits | ${P} > Pollution > Land pollution > Where oil and gas is drilled`);
  check("the named rows are taken out",
        ["Burned areas in WDPA protected areas", "Burned area, two years at a time \u2014 Equatorial Asia",
         "Burned area \u2014 Indonesia"].every((t) => f(t) === "(taken out)"));
  check("a biodiversity hotspot is not a fire hotspot", !places("Biodiversity hotspots").includes(P + " > Fire") && places("Fire hotspots").includes(P + " > Fire"));
  check("nitrogen dioxide is under Pollution, not Climate",
        f("Air quality: nitrogen dioxide satellite measurements") === P + " > Pollution > Air pollution > Nitrogen dioxide" &&
        at("Nitrogen dioxide") > at("Air pollution") && at("Nitrogen dioxide") < at("Fire"));
  // Round 81: by where it goes, air pollution by pollutant.
  check("Pollution is by where it goes: all-around, air (by pollutant), water, land",
        ["All-around pollution", "Plastics", "Air pollution", "General and all pollutants", "Nitrogen dioxide", "Water pollution", "Wastewater", "Land pollution", "Solid waste"]
          .every((t, i, a) => at(t, at("Pollution")) > at("Pollution") && (!i || at(t, at("Pollution")) > at(a[i - 1], at("Pollution")))) &&
        at("Air") === -1 && at("Toxic releases and regulated sites, US") === -1);
  const co2 = at("Carbon dioxide"), ch4 = at("Methane");
  check("carbon bombs, the Carbon Majors and Banking on Climate Chaos are under Carbon dioxide",
        ["carbon_bombs", "carbon_majors", "bocc"].every((i) => order.indexOf(i) > co2 && order.indexOf(i) < ch4));
  check("the Scribd document is out of the box", !order.includes("scribd_doc") && o.PANEL_REMOVED.has("scribd_doc"));
  check("rows are filed by title and id, not by their long description",
        /cataloguePlaces\(item\.fileBy \|\| `\$\{item\.title\} \$\{item\.name\}`, `\$\{item\.title\} \$\{item\.name\}`\)/.test(src));
  check("a Global Forest Watch row found to have nothing to draw leaves the box",
        /catalogueRowGone\(d\.key\);/.test(src) && /function catalogueRowGone\(key, ms = 8000\)/.test(src));
  check("the asset list is read a kind at a time, each tried twice",
        /GFW_DRAWABLE_KINDS\.map\(\(k\) => readKind\(k\)\.catch\(\(\) => readKind\(k\)\)\)/.test(src));
}

console.log("\nround of 22 September (3): the report's findings, live marks, legible areas and vessels");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  const P = "Destruction > Of the planet";
  const f = (t, id) => places(`${t} ${id}`, `${t} ${id}`).join(" | ");
  check("\"drivers\" is not a river and \"disturbance\" is not urban",
        f("Drivers of disturbance alerts \u2014 the driver behind each alert (Wageningen University)", "wur_integration_alert_drivers_class") === "(taken out)");  // round 87b: out at the owner's word
  check("Global Forest Watch's analysis tables are taken out, and so is the drivers dataset with no tiles",
        f("Gadm  burned areas  adm1 whitelist", "gadm__burned_areas__adm1_whitelist") === "(taken out)" &&
        f("Geostore  burned areas  daily alerts", "geostore__burned_areas__daily_alerts") === "(taken out)" &&
        f("Wdpa protected areas  glad  summary", "wdpa_protected_areas__glad__summary") === "(taken out)" &&
        f("Drivers of disturbance alerts \u2014 Three major forest basins", "wur_alert_drivers") === "(taken out)" &&
        f("Protected areas \u2014 Global", "wdpa_protected_areas") === "(taken out)" &&
        f("Protected areas \u2014 Global", "wdpa_licensed_protected_areas") === P + " > Biodiversity loss > Places that matter most for species > Protected areas");
  check("the dated intact forest landscapes are drawn from the map's own copies (round 99b), Global Forest Watch's rows of them out",
        ["2000", "2013", "2016", "2020", "2025"].every((y) => f(`Intact Forest Landscapes ${y}`, `ifl_intact_forest_landscapes_${y}`) === "(taken out)" && new RegExp(`id: "ifl_${y}"`).test(src)));
  const gfw = new Function(src.slice(src.indexOf("const GFW_TITLES = {"), src.indexOf("// Which of a dataset's assets to draw from.")) + "; return { gfwTitle, GFW_WHERE };")();
  check("untitled datasets are named from their records, and the two worldwide protected-area rows say which is which",
        /driver behind each alert/.test(gfw.gfwTitle({ dataset: "wur_integration_alert_drivers_class", metadata: {} })) &&
        gfw.gfwTitle({ dataset: "wdpa_protected_areas", metadata: { title: "Protected areas" } }) !== gfw.gfwTitle({ dataset: "wdpa_licensed_protected_areas", metadata: { title: "Protected areas" } }) &&
        !/no title/.test(gfw.gfwTitle({ dataset: "umd_soy_planted_area_buffered_10km", metadata: {} })) &&
        /50 major river basins/.test(gfw.GFW_WHERE.intl_rivers_dam_hotspots));
  const mark = new Function("escapeHtml", src.slice(src.indexOf("const LIVE_ROUTES = new Set(["), src.indexOf("/* ---------- the layers box, in the order")) + "; return liveMark;")((x) => String(x));
  check("every row carries LIVE or NOT LIVE, and a live route drawn from a copy says NOT LIVE",
        /">LIVE</.test(mark({ id: "x", route: "worker" })) && /NOT LIVE/.test(mark({ id: "x", route: "pmtiles" })) &&
        /NOT LIVE/.test(mark({ id: "coastal_cleanup", route: "geojsonlive" })) && /NOT LIVE/.test(mark({ id: "trase_measures", route: "trase" })));
  check("catalogue rows take the mark of the catalogue they come from", /escapeHtml\(plainTitle\(item\)\)\}\$\{liveMark\(cfg\)\}/.test(src));
  check("Global Forest Watch areas have a light edge at least a pixel wide", /id: `\$\{src\}-o-\$\{safe\(n\)\}`, type: "line"/.test(src) && /"line-color": "#D6CCBC"/.test(src));
  check("the vessels of concern glow at full strength", /const GLOW_FULL = new Set\(\["skytruth_voc"/.test(src) && /if \(glowFull\(layer\)\) return 1;/.test(src));
}
console.log("\nround of 22 September (4): rows of the same name told apart");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const g = new Function(src.slice(src.indexOf("const GFW_TITLES = {"), src.indexOf("// Which of a dataset's assets to draw from.")) + "; return { gfwTitle, GFW_ABOUT };")();
  const ids = ["tsc_tree_cover_loss_drivers", "wri_google_tree_cover_loss_drivers", "tsc_drivers", "umd_drivers"];
  const titles = ids.map((id) => g.gfwTitle({ dataset: id, metadata: { title: "Tree Cover Loss by Dominant Driver" } }));
  check("the four driver rows have four different titles, each saying whose it is", new Set(titles).size === 4 && titles.every((t) => /\([^)]+\)$/.test(t)));
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  check("\u2026and all four still file under Deforestation", titles.every((t, i) => places(`${t} ${ids[i]}`, `${t} ${ids[i]}`).join().startsWith("Destruction > Of the planet > Deforestation > Tree cover loss and alerts > What drove the loss > Tree cover loss by dominant driver")));
  const wdpa = ["wdpa_protected_areas", "wdpa_licensed_protected_areas"].map((id) => g.gfwTitle({ dataset: id, metadata: { title: "Protected areas" } }));
  check("the two worldwide protected-area rows are told apart", wdpa[0] !== wdpa[1] && wdpa.every((t) => /World Database on Protected Areas/.test(t)));
  check("what is known about how they differ goes first in each row's i box",
        [...ids, "wdpa_protected_areas", "wdpa_licensed_protected_areas"].every((id) => g.GFW_ABOUT[id]) &&
        /about: `\$\{gfwAbout\(d\.id\) \? gfwAbout\(d\.id\) \+ " \\u2014 " : ""\}/.test(src));
  check("the check script asks each failing source and each grey picture, and changes nothing",
        fs.existsSync(path.join(HERE, "check-sources.mjs")) && !/writeFile/.test(fs.readFileSync(path.join(HERE, "check-sources.mjs"), "utf8")));
}
console.log("\nthe Atlas's own maps, on this map (22 September)");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("a hotspot's box no longer sends the reader to another site; it shows the Atlas's map here",
        /data-atlas-auto="1" data-atlas-plate=/.test(src) && !/Open the Atlas's PDF:/.test(src) && !/Open the Atlas's page for this city<\/a>/.test(src));
  check("opening an Atlas place zooms to it and lays its placed plate over the map, as an image at the plate's four corners",
        /addPictureSource\("atlas-plate", plateUrl\(p\.image\), p\.corners\)/.test(src) &&
        /if \(auto\) atlasFrom\(auto, geometryBounds\(hit\.geometry\), hit\.cfg\.id\);/.test(src));
  check("a plate is laid only when it was placed well enough", /p && p\.kept && p\.image/.test(src));
  const gb = new Function(src.slice(src.indexOf("function geometryBounds("), src.indexOf("function atlasPanel(")) + "; return geometryBounds;")();
  const b = gb({ type: "MultiPolygon", coordinates: [[[[-50, -20], [-40, -20], [-40, -10], [-50, -20]]], [[[-60, -25], [-55, -25], [-55, -22], [-60, -25]]]] });
  check("with no plate, the map zooms to the hotspot's own outline", JSON.stringify(b) === JSON.stringify([[-60, -25], [-40, -10]]));
  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "atlas_plates.py"), "utf8");
  check("the plates are placed by the towns named on each page, with outliers set aside and the error measured",
        /def place_page\(labels, width_pt, height_pt, seed=0, bar_km_per_pt=None\):/.test(py) && /TRIES = 4000/.test(py) && /"error_km": round\(rms, 1\)/.test(py) && /MIN_AGREE = 5/.test(py));
  check("…with one scale and one turn, never a skew or a mirror, and checked against the page's own scale bar (23 September)",
        /def fit_similarity\(pairs\):/.test(py) && !/def fit_affine\(/.test(py) && /MAX_TURN = 20/.test(py) &&
        /def read_scale_bar\(page\):/.test(py) && /SCALE_TOLERANCE = 0\.2/.test(py) && /"scale_vs_bar"/.test(py));
  check("…a page with too few names is placed by its scale bar and at least two agreeing towns",
        /def place_by_bar\(/.test(py) && /len\(found\[1\]\) < 2/.test(py) && /COUNTRY_LABEL_SIZE = 9\.0/.test(py) && !/MIN_TOWN_RANK/.test(py));
  check("…a country's name, set in the Atlas's larger type, is never used, and a page with no two towns is placed by the hotspot it draws, in its key's own colour",
        /span\["size"\] >= COUNTRY_LABEL_SIZE/.test(py) && /def key_colour\(page\):/.test(py) && /def place_by_outline\(/.test(py) && /"outline_check_km"/.test(py));
  check("…only where the drawn hotspot is its outline's size, both ways, within 3%; otherwise it neither places nor checks a plate",
        /OUTLINE_SIZE_TOLERANCE = 0\.03/.test(py) && /same_size and rms/.test(py) && /outline\.get\("same_size"\) and got\.get\("affine"\)/.test(py));
}
console.log("\nround of 22 September (5): what check-sources found");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const k = new Function("escapeHtml", src.slice(src.indexOf("const GFW_KEYS = {"), src.indexOf("function catalogueKeyShow(")) + "; return { GFW_KEYS, gfwColormap, catalogueKeyHtml };")((x) => String(x));
  const d = k.GFW_KEYS.wri_google_tree_cover_loss_drivers;
  check("the drivers are coloured by the publishers' own codes, 1 to 7, in their order",
        d.values.map((v) => v[0]).join() === "1,2,3,4,5,6,7" && d.values[0][2] === "Permanent agriculture" && d.values[4][2] === "Wildfire" &&
        d.values[6][2] === "Other natural disturbances");
  check("\u2026and the tile service is told one colour per code", JSON.stringify(k.gfwColormap(d)["1"]) === JSON.stringify([140, 90, 78, 255]));
  check("DIST-ALERT is coloured by its confidence digit, as ranges", JSON.stringify(k.gfwColormap(k.GFW_KEYS.umd_glad_dist_alerts)[0][0]) === "[20000,30000]");
  {
    const w = k.GFW_KEYS.wur_integration_alert_drivers_class.values;
    check("the WUR classes carry GFW's names, paired by the colour its map code gives each number (9 Wildfire, 10 Other natural disturbances)",
      w.length === 11 && w[0][2] === "Small-scale agriculture" && w[8][2] === "Wildfire" && w[9][2] === "Other natural disturbances" &&
      w[10][2] === "Unlabeled" && w.every((v) => typeof v[3] === "string" && v[3].length > 20));
    check("the WUR key's colours stay the map's own, none of GFW's yellows or oranges", !w.some((v) => /^#(FFD966|FF8C42|F4B183|CE4D1E|FF0000)$/i.test(v[1])));
  }
  const all = Object.values(k.GFW_KEYS).flatMap((x) => (x.values || x.ranges).map((e) => x.values ? e[1] : e[2]));
  check("no key colour is orange or yellow", all.every((h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return !(r > 150 && g > 110 && b < 90); }));
  check("a keyed picture's key is under its row and indented in the Showing box",
        /catalogueKeyShow\(d\.key, d\.title, key\)/.test(src) && /padding-left:18px/.test(k.catalogueKeyHtml(d)) && /\$\{rows\}\$\{keyed\}/.test(src));
  check("of several GeoTIFFs, the classification is drawn, not the intensity one", /\/\\\/\(default\|class\)\\\.tif\$\/\.test\(a\.asset_uri\)/.test(src));
  const ex = new Function(src.slice(src.indexOf("function arcgisExperienceIds("), src.indexOf("async function arcgisWebmapsOf(")) + "; return arcgisExperienceIds;")();
  check("an Experience Builder app's own maps are read first",
        JSON.stringify(ex(JSON.stringify({ dataSources: { a: { type: "WEB_MAP", itemId: "0123456789abcdef0123456789abcdef" }, b: { type: "IMAGE", itemId: "fedcba9876543210fedcba9876543210" } } }))) === '["0123456789abcdef0123456789abcdef"]');
  check("EJAtlas's pages after the first are read four at a time", /offsets\.slice\(i, i \+ 4\)\.map/.test(src));
  check("Nusantara's pictures come in squares of 512", /WIDTH=512&HEIGHT=512/.test(src) && /map\.addSource\(lid\(i\), Object\.assign\(\{ type: "raster", tileSize: 512/.test(src));
  check("Trase's facilities are read from the weekly copy where one was made, and say NOT LIVE",
        /base = hit\.base \|\| m\.base \|\| base;/.test(src) && /trase_silos_brazil: "Trase's facilities file, from a copy made weekly/.test(src));
}
console.log("\nround of 22 September (6): the second check");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  check("USDA's retired explorers are out of the box", !o.PANEL_ORDER.includes("usda_soybean") && !o.PANEL_ORDER.includes("usda_corn") &&
        o.PANEL_REMOVED.has("usda_soybean") && o.PANEL_REMOVED.has("usda_corn"));
  check("a uMap layer is read from the daily copy first, and the row says NOT LIVE",
        /culprits-tiles-more\/umap\/\$\{cfg\.umapId\}\/\$\{id\}\.geojson/.test(src) && /wreckers_umap: "The map's settings are read live/.test(src));
}
console.log("\nround of 23 September: one row per air pollutant");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const gases = ["pm2_5", "bc", "oc", "so2", "vocs", "co", "nh3", "nox"];
  check("each pollutant Climate TRACE reports for urban sources is a row of its own", gases.every((g) => new RegExp(`id: "ct_air_${g}", [^\\n]*route: "ctairgas", gas: "${g}"`).test(src)));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER };")().PANEL_ORDER;
  const at = (t, from = 0) => o.findIndex((x, i) => i >= from && x && x.t === t);
  const pol = at("Pollution");
  check("\u2026each under its own heading in Pollution, between General and Nitrogen dioxide",
        ["Fine particles (PM2.5)", "Black carbon", "Organic carbon", "Sulphur dioxide", "Volatile organic compounds", "Carbon monoxide", "Ammonia", "Nitrogen oxides"]
          .every((t, i) => { const h = at(t, pol); return h > at("General and all pollutants", pol) && h < at("Nitrogen dioxide", pol) && o[h + 1] === `ct_air_${gases[i]}`; }));
  check("\u2026black carbon copied under Climate's Black carbon too", o.indexOf("ct_air_bc") > at("Black carbon") && o.indexOf("ct_air_bc") < at("Overpopulation"));
  check("\u2026every source kept, sized and glowing by that pollutant's yearly amount, from the weekly copy",
        /glowMaxOf\.set\(src, max\)/.test(src) && /\["get", "value"\], 0\]\], cfg\._max\]/.test(src) && /ct_air\/gases\.json/.test(src));
  check("\u2026and the rows say NOT LIVE, the click still reads live", /ct_air_\$\{g\}`,\s*"The yearly amounts come from a weekly copy/.test(src));
  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "wastewater_inspect.py"), "utf8");
  check("the wastewater package is inspected from KNB before a build is written", /urn:uuid:af8d0bd6-dc0c-4149-a3cd-93b5aed71f7c/.test(py) && /def dbf_fields/.test(py));
}
console.log("\nround of 23 September (2): the wastewater model from its data package");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const ids = ["wastewater_n_tot", "wastewater_n_treated", "wastewater_n_septic", "wastewater_n_open", "wastewater_n_countries"];
  check("the four pour-point measures and the country totals are rows under Wastewater, the dead picture row out",
        ids.every((id) => new RegExp(`id:"${id}"`).test(src) && o.PANEL_ORDER.includes(id)) && o.PANEL_REMOVED.has("wastewater") && !o.PANEL_ORDER.includes("wastewater"));
  check("\u2026each archive is read from the tiles repo, named for its row", ["tot", "treated", "septic", "open"].every((k) =>
        src.includes(`archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_${k}.pmtiles"`)));
  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "wastewater_build.py"), "utf8");
  check("the build keeps every point at every zoom, weighs each archive by its own measure, and works out the unit rather than guessing it",
        /"-r1"/.test(py) && /"--no-feature-limit", "--no-tile-size-limit"/.test(py) && /"value": p\.get\(field\)/.test(py) && /def unit_of\(total\)/.test(py) &&
        /fits no unit/.test(py) && /not in longitude and latitude/.test(py));
}
console.log("\nround of 23 September (3): the wastewater points' projection; Waste Atlas looked at");
{
  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "wastewater_build.py"), "utf8");
  check("points not in longitude and latitude are turned from Mollweide only if every one lies inside its world ellipse",
        /def mollweide_inverse\(x, y\):/.test(py) && /\(x \/ \(2 \* SQ2 \* A\)\) \*\* 2 \+ \(y \/ \(SQ2 \* A\)\) \*\* 2 > 1/.test(py) && /A = 6378137\.0/.test(py));
  check("the Waste Atlas probe exists and only reads", fs.existsSync(path.join(HERE, "..", "pipeline", "wasteatlas_probe.py")));
}
console.log("\nbuildings stand up again (23 September)");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const a = src.indexOf('id: "buildings-3d"'), block = src.slice(a, src.indexOf("});", a));
  // MapLibre only takes ["zoom"] as the input of a top-level step or
  // interpolate; anywhere else the whole layer is refused.
  const paint = block.slice(block.indexOf("paint:")).replace(/\/\/.*$/gm, "");
  const topLevel = (paint.match(/\["interpolate", \["linear"\], \["zoom"\]/g) || []).length +
                   (paint.match(/\["step", \["zoom"\]/g) || []).length;
  check("every zoom in the 3D buildings' paint is the input of a top-level interpolate or step, so MapLibre adds the layer",
        !/\["case", \[">=", \["zoom"\]/.test(block) && topLevel >= 2 &&
        (paint.match(/\["zoom"\]/g) || []).length === topLevel);
}

console.log("\nround of 23 September (4): the wastewater archives made small enough for GitHub");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "wastewater_build.py"), "utf8");
  check("the tiles carry only each point's id and value, to zoom 8, and the build stops rather than leave a file GitHub refuses",
        /"properties": \{"id": str\(p\.get\("basin_id"\)\), "value": p\.get\(field\)\}/.test(py) && /"-z8"/.test(py) && /which GitHub refuses; stopped here/.test(py));
  check("\u2026every field of every point is in 256 pieces, found by the same hash the map uses",
        /def piece_of\(key\):/.test(py) && /0x811C9DC5/.test(py) && /0x01000193/.test(py) &&
        ["tot", "treated", "septic", "open"].every((k) => new RegExp(`wastewater_n_${k}\\.pmtiles",\\n    boxes: "https://welcometoyourgalaxy\\.github\\.io/culprits-tiles-more/wastewater/pieces"`).test(src)));
  check("\u2026and its working files are removed as it goes", /path\.unlink\(missing_ok=True\)/.test(py) && /work\.rmdir\(\)/.test(py));
}
console.log("\nround of 23 September (5): the Atlas panel pared down; no grain; the boxes' bars");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const wire = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  const panel = src.slice(src.indexOf("function atlasPanel() {"), src.indexOf("function atlasPlateOff() {"));
  check("the Atlas panel holds only the see-through slider and the link to the Atlas's page",
        /class="ap-fade"/.test(panel) && /class="ap-open"/.test(panel) && !/ap-pages|ap-close|ap-said|ap-title|iframe/.test(panel));
  check("\u2026and unticking the Atlas row closes it and takes the plate away",
        /if \(vis !== "visible" && typeof atlasOwner !== "undefined" && atlasOwner === id\) atlasPlateOff\(\);/.test(src));
  check("\u2026close in, the page's detail squares are added for what is on screen, once closer than the whole plate",
        /function atlasDetail\(p, fitZoom\)/.test(src) && /minzoom: fitZoom \+ 1/.test(src));
  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "atlas_plates.py"), "utf8");
  check("\u2026the detail squares are drawn from the PDF at four times the size, each placed by the page's own fit",
        /DETAIL_SCALE = 4/.test(py) && /"detail"/.test(py));
  check("a pull sets the most a box shows, so it is never taller than its list and the layers box still gives way to the Showing box (round 66)",
        /el\.style\.maxHeight = h \+ "px";/.test(src) && !/el\.style\.flex = "0 0 auto";/.test(src) && /\.left-col \.panel\{flex:0 1 auto\}/.test(fs.readFileSync(path.join(HERE, "index.html"), "utf8")) &&
        /\.left-col \.panel > \.pull-grip\{position:sticky;bottom:0/.test(fs.readFileSync(path.join(HERE, "index.html"), "utf8")));
  check("the largest banks row reads its weekly copy, filed under Banks and monetary power (round 69)",
        /id: "largest_banks", name: "The 250 largest corporate banks by total assets \(compiled from Wikidata\)"[^\n]*route: "geojsonlive"/.test(src) &&
        /culprits-tiles-more\/banks\/largest\.geojson/.test(src) && /"Banks and monetary power" \}, "largest_banks", "development_banks"/.test(src) && /culprits-tiles-more\/banks\/development\.geojson/.test(src) &&
        /largest_banks: "Compiled weekly from Wikidata/.test(src));
  check("the watersheds are shaded in steps of ten, with a key (round 67)",
        /logSteps: \[1e5, 1e6, 1e7, 1e8, 1e9, 1e10\]/.test(src) && /const breaks = \(stepsCfg\.logSteps \|\|/.test(src) && /none to \$\{lab\(breaks\[0\]\)\}/.test(src));
  check("the Country outlines basemap keeps its own colours (round 66)", /\|sat-relief-colour\|outline-\.\*\)\$\/;/.test(src));
  check("space rows retitled (round 66)", /\{ h: 3, t: "Extraterrestrial life" \}/.test(src) && /name: "Spacecraft in space, going galactic \(NASA's Eyes on the Solar System\)"/.test(src));
  check("the news wires' open-and-shut arrow sits at the right-hand end of the bar",
        /id="wireEnd"/.test(wire) && /\.wire-toggle \.wire-caret\{display:none\}/.test(wire));
}
console.log("\nround of 23 September (6): every point at every zoom; the food package listed");
{
  const cer = fs.readFileSync(path.join(HERE, "..", "pipeline", "cerulean", "harvest_points.py"), "utf8");
  check("Cerulean's slick points are tiled with none merged", !/--cluster-/.test(cer) && /"--no-tile-size-limit"/.test(cer));
  const knb = fs.readFileSync(path.join(HERE, "..", "pipeline", "knb_list.py"), "utf8");
  check("the food-footprint package (Halpern et al. 2022) is listed from KNB before a build is written", /doi:10\.5063\/F1V69H1B/.test(knb));
}
console.log("\nround of 23 September (7): the EPA copy in one file per zoom");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the EPA row reads its copy's list of files, one per zoom, and draws each at its own zoom",
        /cfg\.points\.replace\(\/\\\.pmtiles\$\/, "\.build\.json"\)/.test(src) && /minzoom: part\.from/.test(src));
  check("\u2026and those layers go with the row when it is unticked", /cfg\._layerIds\.push\(lid\);/.test(src));
  check("\u2026a point with only its ids is named from EPA's own record on a click", /\/name\/i\.test\(k\)/.test(src));
}
console.log("\nround of 23 September (8): Waste Atlas rows; soy and maize from Halpern et al.");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER };")().PANEL_ORDER;
  // Round 81: the countries are national highlights, one measure a row.
  const kinds = ["dumpsites", "landfills", "wte", "mbt", "bt", "cities"];
  check("Waste Atlas is one row per kind of place, each reading only its own kind from the weekly copy",
        kinds.every((k) => new RegExp(`id: "wasteatlas_${k}"[^\\n]*route: "geojsonlive"`).test(src)) && /only: \["category", "Dumpsites"\]/.test(src) &&
        /got\.features = got\.features\.filter\(\(ft\) => String\(\(ft\.properties \|\| \{\}\)\[f\.only\[0\]\]\) === f\.only\[1\]\)/.test(src));
  const at = (t) => o.findIndex((x) => x && x.t === t);
  // Round 75: the incinerators only under Solid waste, at the owner's word.
  check("\u2026all under Pollution > Solid waste, dumpsites and landfills copied under Methane, the incinerators under Solid waste only",
        kinds.every((k) => o.lastIndexOf(`wasteatlas_${k}`) > at("Solid waste")) &&
        /"climate_trace_waste", "wasteatlas_dumpsites", "wasteatlas_landfills"/.test(src) && o.filter((x) => x === "wasteatlas_wte").length === 1);
  check("soy and maize each have a row with the four pressures as chips, under Nitrous oxide and under Agriculture",
        ["soyb", "maiz"].every((c) => ["ghg", "water", "nutrient", "disturbance"].every((p) => src.includes(`food_${c}_${p}.pmtiles`))) &&
        o.includes("food_soy") && o.includes("food_maize"));
}
console.log("\nround of 23 September (9): refresh notes, where each dot is, place names, the green cast");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("every row's mark carries a note of how often what it shows is renewed",
        /return `<span class="live"[^`]*>LIVE<\/span>` \+ refreshNote\(cfg\);/.test(src) && /NOT LIVE<\/span>` \+ refreshNote\(cfg\);/.test(src) &&
        /copy renewed daily/.test(src) && /copy renewed weekly/.test(src) && /read afresh each time it is ticked/.test(src));
  check("every dot's box says how exact its position is, unless the box already says it",
        /function positionText\(props, rowId\)/.test(src) && /P\.setHTML = function/.test(src) && /POSITION_SAID\.test\(h\)/.test(src) &&
        /The coordinates the source gives; it does not say how exact they are\./.test(src));
  check("a Place names tick box in the settings box takes every name off the map and puts it back as it was",
        /id="names-toggle"/.test(src) && /map\.setLayoutProperty\(l\.id, "text-field", ""\)/.test(src) && /namesField\.get\(l\.id\)/.test(src));
  check("the Satellite lowlands keep their darkness with far less green", /1, "rgba\(46,52,34,0\.32\)", 400, "rgba\(48,54,36,0\.3\)"/.test(src));
}
console.log("\nround of 23 September (10): the wastewater plumes");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the model's coastal plumes are a row under Wastewater, one chip per source of the nitrogen",
        ["tot", "treated", "septic", "open"].every((k) => src.includes(`wastewater_plume_${k}.pmtiles`)) &&
        /"hydrowaste", "wastewater_plumes", "wastewater_watersheds", "wastewater_n_countries",/.test(src));
}
console.log("\nround of 23 September (11): the modelled farms' squares made light");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("a modelled farm with only its id in the square reads its whole record from its piece on a click",
        /const CAFO_PIECES = "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/cafo\/pieces";/.test(src) &&
        /readPiece\(CAFO_PIECES, p\.id\)/.test(src));
}
console.log("\nround of 23 September (12): F-gases from EDGAR");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("EDGAR's gridded F-gas emissions are a row under Climate > F-gases", /\{ h: 4, t: "F-gases" \}, "edgar_fgases_all", "edgar_fgases",/.test(src) && /edgar_fgases_hfcs\.pmtiles/.test(src));
  check("…one chip per gas group EDGAR publishes, never added together", ["hfcs", "pfcs", "sf6", "nf3", "hcfcs"].every((g) => src.includes(`edgar_fgases_${g}.pmtiles`)) && /are not added together/.test(src));
}
console.log("\nround of 23 September (13): the crime tracker under every subject it records");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("EIA's Environmental Crime Tracker is copied under illegal logging and environmental crime, not F-gases (round 120b); round 101b: no longer under Of animals",
        /"Illegal logging and timber trafficking" \}, "powerbi_report"/.test(src) && !/"F-gases" \}[^\n]*"powerbi_report"/.test(src) && /"Environmental crime" \}[^\n]*"powerbi_report"/.test(src) &&
        !/"Of animals" \}, "powerbi_report"/.test(src));
}
console.log("\nround of 23 September (14): the Atlas's city maps laid on the map where placed");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("a hotspot city's box carries its slug, and opening it lays the city's placed map as the hotspots' are",
        /data-atlas-city="\$\{escapeHtml\(slug\)\}"/.test(src) && /cityPlate: d\.atlasCity \|\| null/.test(src) &&
        /what\.cityPlate \? \(await atlasCityPlatesRead\(\)\)\[what\.cityPlate\]/.test(src) && /culprits-tiles-more\/atlas\/city_plates\.json/.test(src));
  check("…a city with no placed map keeps its own zoom and shows its picture (round 98b)", /if \(what\.cityPlate && !\(p && p\.kept\)\) \{ atlasCityShow\(what\); return; \}/.test(src));
}
console.log("\nround of 23 September (15): the rows say their points are no longer merged");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("no row's note still says its points are merged where they crowd", !/note: "[^"\n]*merged where they crowd/.test(src) && !/note: "[^"\n]*merged into counted points/.test(src));
}
console.log("\nround of 23 September (16): watersheds, six more type rows, Trase's GDP row out");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the wastewater model's watersheds are a row under Wastewater, shaded in the steps their build wrote, each record read from its piece",
        /id: "wastewater_watersheds"[^\n]*route: "pmtareas"/.test(src) && /"wastewater_plumes", "wastewater_watersheds",/.test(src) &&
        /async function addPmtAreasLayer\(cfg\)/.test(src) && /bindHtmlPopup\(`\$\{cfg\.id\}-fill`, \(p\) => pieceBox\(cfg, p\)\)/.test(src));
  const ramp = src.match(/const AREA_RAMP = \[([^\]]*)\]/)[1].match(/#[0-9A-F]{6}/gi);
  const warm = (h) => { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return r > 150 && g > 110 && b < 90; };
  check("…its colours carry no orange or yellow", ramp.length === 7 && !ramp.some(warm));
  check("the six more site maps each have a row per type", ["site_world_news", "site_world_advertising", "site_world_entertainment", "site_research_integrity",
        "site_indigenous_conflicts", "site_self_sufficiency"].every((i) => new RegExp(`id: "${i}", typeRows: true`).test(src)));
  const T = new Function(src.match(/const TRASE_REMOVED = [^\n]*\n/)[0] + "; return TRASE_REMOVED;")();
  check("Trase's GDP per capita row is out of the box, and no other measure", T.some((r) => r.test("GDP per capita")) && !T.some((r) => r.test("Soy deforestation exposure")));
}
console.log("\nround of 23 September (17): the F-gas chips from the build's own list");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the F-gas row reads its chips from the list its build writes, one per gas drawn, keeping its own if the list cannot be read",
        /choicesUrl: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/edgar\/fgases_choices\.json"/.test(src) &&
        /if \(cfg\.choicesUrl && !cfg\._choicesRead\)/.test(src) && /if \(d && Array\.isArray\(d\.choices\) && d\.choices\.length\) cfg\.choices = d\.choices;/.test(src));
}
console.log("\nround of 23 September (18): every field in the boxes that picked their own");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("Global Trade Alert's box lists every type of act, not the first six", !/Object\.entries\(c\.types \|\| \{\}\)\.slice\(0, 6\)/.test(src));
  check("Giga's box shows every field of the country's record", /fieldRows\(c, \["flag", "name", "entity_counts"/.test(src));
  check("a reef patch's box shows every field the Atlas gives it", /fieldRows\(p, \["class_name", "area_sqkm"\]\)/.test(src));
  check("a Climate TRACE column's box shows every field, not five", /fieldRows\(p, \["_count", "layerName", "name", "value", "colSay", "picture", "bounds"\]\)/.test(src) && !/\["x_asset_definition", "x_period", "x_capacity"/.test(src));
  check("a click on EPA's picture lists every facility it touches, not the first eight", /const hits = j\.results \|\| \[\];/.test(src));
  check("a shape's own words and list are shown whole, in a box that scrolls", !/shapeText\(p\.from_the_map\)\.slice\(0, 1200\)/.test(src) && !/list\.slice\(0, 40\)/.test(src));
}
console.log("\nround of 23 September (19): the slick archive's months made small enough for GitHub");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("a month may be several tile files, each drawn through its own source", /const files = \[\]\.concat\(tiled\[m\]\);/.test(src) && /files\.forEach\(\(file, i\) =>/.test(src));
  check("…a slick with only its id and time in the tiles has its record read from Cerulean by id on a click",
        /collections\/public\.slick_plus\/items\/\$\{encodeURIComponent\(p\.id\)\}\?bbox-only=true`\)\n\s*\.then/.test(src));
  check("…each click layer is bound once, not again each time a month is shown", /if \(!bound\.has\(sfx\)\)/.test(src));
}
console.log("\nround of 23 September (20): rows refiled and taken out by name");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  const P = "Destruction > Of the planet", f = (t) => places(t, t).join(" | ");
  check("MapSPAM's rubber yield, the road-reach, capital, road, 2017 settlement and transmigration layers, the Congo forest roads and INCRA's settlements are taken out",
        ["Rubber yield (MapSPAM) spam_rubber_yield", "Land within reach of a road \u2014 Equatorial Asia roadsegmentbuffer_spv",
         "Land within reach of a road (v3p3 copy) \u2014 Equatorial Asia v3p3_roadsegmentbuffer_spv",
         "Nusantara, the new Indonesian capital (IKN) \u2014 Equatorial Asia base_ikn", "Roads \u2014 Equatorial Asia base_road",
         "Roads (their edited version) \u2014 Equatorial Asia base_road_edited", "Roads, by the year they appeared (picture) \u2014 Equatorial Asia base_roadRGB",
         "Transmigration roads \u2014 Equatorial Asia base_roadtrans", "Settlements 2017, Borneo (GHSL) IDNMYSBorneo_Settlement_2017_GHS",
         "Transmigration areas 2021, Borneo IDNMYSBorneo_Transmigration_2021", "Transmigration areas 2021, Borneo IDNMYSBorneo_Transmigration_2021_wms",
         "Congo Basin forest roads", "Brazil rural settlements (INCRA)"].every((t) => f(t) === "(taken out)") &&
        f("Towns and villages \u2014 Equatorial Asia base_populatedplace") === "(taken out)" &&
        f("Rubber plantations 2020, Kalimantan rubber_kalimantan_2020") === P + " > Deforestation > Timber and rubber plantations");
  check("Liberia's mineral exploration and development licences are taken out (round 94b)",
        f("Mineral exploration licenses \u2014 Liberia", "lbr_mineral_exploration_license") === "(taken out)" && f("Liberia development licenses (exploration)", "lbr_development_exploration_license") === "(taken out)");
  check("logging roads are under Deforestation, not Construction", f("Logging roads \u2014 Congo Basin") === P + " > Deforestation > Logging and timber concessions");
}
console.log("\nround of 23 September (21): INCRA's quilombola communities kept");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  const f = (t) => places(t, t).join(" | ");
  check("INCRA's rural settlements are out, its quilombola communities are part of the LandMark layer (round 72)",
        f("INCRA Brazil Rural Settlements incra_bra_rural_settlements") === "(taken out)" &&
        f("INCRA Brazil Quilombola Communities incra_bra_quilombola_communities") === "(taken out)");
}
console.log("\nround of 23 September (22): Liberia's development agreements and the resource rights placed");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  const f = (t) => places(t, t).join(" | ");
  check("Liberia's Mineral Development Agreements are under Mining, the resource rights in one layer with LandMark's (round 72)",
        f("Liberia Mineral Development Agreement lbr_mineral_development_agreement") === "(taken out)" &&   // round 94b
        f("Resource rights \u2014 Currently available for Cameroon, Equatorial Guinea, Liberia and Namibia gfw_resource_rights") === "On-planet invasion > Invasion of the living > Invasion of humans > Community rights to natural resources, worldwide and in Cameroon, Equatorial Guinea, Liberia and Namibia (LandMark and Global Forest Watch)");
}
console.log("\nround of 23 September (23): the owner's thirty notes on the layers box");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return { cataloguePlaces, BUNDLES };")();
  const P = "Destruction > Of the planet", AG = P + " > Meat and agriculture > Agriculture";
  const f = (t, id) => places.cataloguePlaces(`${t} ${id || ""}`, `${t} ${id || ""}`).join(" | ");
  const B = places.BUNDLES;
  const o = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes(")) + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const order = o.PANEL_ORDER, at = (t, from = 0) => order.findIndex((x, i) => i >= from && x && x.t === t);
  const bat = (k) => order.findIndex((x) => x && x.bundle === k);
  check("1: the forest net flux is under Deforestation and Carbon dioxide, and \"greenhouse gas\" is not oil and gas",
        f("Forest greenhouse gas net flux — Global", "gfw_forest_carbon_net_flux") === `${P} > Climate > Carbon dioxide > Emissions` &&
        !/Oil and gas drilling/.test(f("Some greenhouse gas layer")));
  check("2: no Oil and gas drilling heading; the fracking row under Methane's infrastructure; Pennsylvania gone (round 75)",
        at("Oil and gas drilling") === -1 && at("Pennsylvania") === -1 && order.indexOf("skytruth_fracfocus") > at("Methane") &&
        ["skytruth_pa_permits", "skytruth_pa_spud", "skytruth_pa_violations", "skytruth_well_permits"].every((i) => order.indexOf(i) === -1) &&
        f("Oil and gas concessions — Argentina", "gfw_oil_gas") === `${P} > Climate > Methane > Culprits | ${P} > Pollution > Land pollution > Where oil and gas is drilled`);
  check("3: Trase's shrimp production is out", f("Production of shrimp (t) — Ecuador, Indonesia (Trase)", "SHRIMP_TN") === "(taken out)");
  check("4, 6, 19: the Clark Labs maps of 1999, 2014, 2018 and the 1999 to 2018 change are one row under Fishing only; the other changes are out",
        ["1999", "2014", "2018", "change_1999_2018"].every((y) => f("Aquaculture ponds", `clark_labs_tropical_pond_aquaculture_${y}`) === `${P} > Oceans > Fishing > ${B.ponds}`) &&
        ["change_1999_2014", "change_2014_2018"].every((y) => f("Clark Labs Tropical Pond Aquaculture Change", `clark_labs_tropical_pond_aquaculture_${y}`) === "(taken out)") &&
        /clark_labs_tropical_pond_aquaculture_2014: "Aquaculture ponds in 2014/.test(src) && /clark_labs_tropical_pond_aquaculture_2018: "Aquaculture ponds in 2018/.test(src));
  check("5: a worldwide aquaculture pond row under Fishing, built by culprits-tiles-more, saying so until built",
        /id: "aquaculture_ponds"[^\n]*route: "pmshapes"/.test(src) && /tiles\/aquaculture_ponds\.pmtiles/.test(src) &&
        /buildScript: "scripts\/aquaculture_ponds\.py"/.test(src) && order.lastIndexOf("aquaculture_ponds") > at("Fishing") && order.lastIndexOf("aquaculture_ponds") < at("Reefs and mangroves")   /* round 132b: also under Marine meats */ &&
        /not built yet: run \$\{cfg\.buildScript\}/.test(src));
  check("7: the coral row says warm-water only, and the world view is drawn pale and grown so reefs outside the Caribbean show",
        /name:"Coral reefs, warm-water only \(Allen Coral Atlas and UNEP-WCMC\)"/.test(src) && /const CORAL_WORLD_TINT = "6FC2DA"/.test(src) /* round 135b: teal */ &&
        /if \(grow\) growPixels\(img\.data, bmp\.width, zoomOfBbox\(url\)\)/.test(src));
  check("8, 10: the three Global Mangrove Watch years are one row; 1996 is kept, and drawn without waiting on the world tile",
        ["", "_1996", "_2016"].every((y) => f("Mangroves", `gmw_global_mangrove_extent${y}`) === `${P} > Deforestation > Mangroves > ${B.mangroves}`)   /* round 94b */ &&
        /if \(!asset\.slow\) \{/.test(src) && /setTimeout\(\(\) => ctl\.abort\(\), 8000\)/.test(src));
  const keys = new Function(src.slice(src.indexOf("const GFW_KEYS = {"), src.indexOf("const hexRgba")) + "; return GFW_KEYS;")();
  check("9, 28: the mangrove biomass and 2010 tree cover pictures are drawn in colour steps, zero left out, not grey",
        keys.jpl_mangrove_aboveground_biomass_stock_2000.ranges[0][0] > 0 && keys.umd_tree_cover_density_2010.ranges[0][0] === 1 &&
        [...keys.jpl_mangrove_aboveground_biomass_stock_2000.ranges, ...keys.umd_tree_cover_density_2010.ranges].every((r) => !/^#(F|E[6-9A-F])[0-9A-F]{2}[0-4]/i.test(r[2])));
  check("11: Fishing sits above Reefs and mangroves", at("Fishing") > at("Oceans") && at("Fishing") < at("Reefs and mangroves"));
  check("12: the food system row is Who Owns the Food Industry", /id: "site_food_system", name: "Who Owns the Food Industry"/.test(src));
  check("13: the mine features glow at full strength, their boxes name their own source, and their build puts every point in the world view",
        /const GLOW_FULL = new Set\(\["skytruth_voc", "mine_features", "aquaculture_ponds"(, "remains_findings")?\]\);/.test(src) &&
        /replace\(\/-\(src\|pm\)\$\/, ""\)/.test(src) && /featureWord: "Mine feature"/.test(src) && /escapeHtml\(cfg\.attribution \|\| "Maus et al/.test(src));
  check("14: the mines layers are one row with sublayers under Mining",
        // Round 123b (asked 2 October): split, each source its own row under Mining.
        bat("mines") === -1 && order[at("Mining") + 1] === "mines_global" && order[at("Mining") + 2] === "mine_features" &&
        ["pangaea_global_mining", "gfw_mining_concessions", "IDN_Mining_2023", "concessionmining_spv"].every((id) => f("x", id) === `${P} > Mining`));
  check("15: the Equatorial Asia peatland and the two undrawable peatland datasets are out; Trase draws the latest year it has values for",
        ["base_peatland", "cifor_peatlands", "gfwpro_peatlands"].every((id) => f("Peatland", id) === "(taken out)") &&
        f("Global peatland extent", "gfw_peatlands") === `${P} > Deforestation > Peatland`);   // round 92b: under Deforestation
  const yearOf = new Function(src.match(/function traseYearWithValues[\s\S]*?\n}\n/)[0] + "; return traseYearWithValues;")();
  check("…a Trase year listed with no values falls back to the latest year with values, and a measure with none anywhere leaves the list",
        yearOf({ "2022": { a: null }, "2023": { a: 5 } }, 2024, true) === 2023 && yearOf({}, 2024, true) === null &&
        yearOf({ "2024": { a: 1 } }, 2024, true) === 2024 && yearOf({ "2023": { a: 1 } }, 2024, false) === 2024 &&
        /Trase lists this measure but publishes no values for it in any year/.test(src));
  check("16, 17, 22, 26: Borneo's land cover with rivers, the Rawa Singkil canals and Mapbox's river basins are out",
        ["IDNMYSBorneo_LCHSRiver", "rawasingkil_canal", "rawasingkil_10_canal", "mapbox_river_basins"].every((id) => f("x", id) === "(taken out)"));
  check("18: Global Forest Watch versions sort by number, so v1.12 comes after v1.9; Nusantara's slow worldwide water change is replaced",
        /const versionOrder = \(a, b\) => String\(a\)\.localeCompare\(String\(b\), "en", \{ numeric: true \}\);/.test(src) &&
        ["v1.9", "v1.12", "v1.10"].sort((a, b) => a.localeCompare(b, "en", { numeric: true })).pop() === "v1.12" &&
        f("Surface water change", "Global_WaterChange_1984to2021") === "(taken out)");
  check("20: the two reservoir anomaly layers are one row, their titles saying how they differ",
        ["global_water_watch_anomalies", "global_water_watch_anomalies2"].every((id) => f("x", id) === `${P} > Water scarcity > Reservoirs > ${B.waterwatch}`) &&   // round 123b
        /global_water_watch_anomalies: "Each reservoir month by month through 2025/.test(src) && /global_water_watch_anomalies2: "Each reservoir at one reading/.test(src));
  check("21: the Key Biodiversity Areas are out of Surface water, under Biodiversity loss",
        f("Key Biodiversity Areas — Global, terrestrial, freshwater and marine.", "birdlife_key_biodiversity_areas") === `${P} > Biodiversity loss > Places that matter most for species > Where species are threatened`);
  check("23: the EC JRC's surface water map is back under Surface water, from the JRC's own 2024 tiles, in this map's colours",
        /id: "jrc_water"[^\n]*route: "rasterlive"/.test(src) && /storage\.googleapis\.com\/water-world\/tiles2024\/\$\{layer\}/.test(src) &&
        order.indexOf("jrc_water") > at("Surface water") && order.indexOf("jrc_water") < at("Mining"));
  const R = new Function(src.slice(src.indexOf("const REMAP = {"), src.indexOf("maplibregl.addProtocol(\"remap\"")) + "; return { REMAP, remapColour };")();
  check("…the JRC's yellows, oranges and bright greens come out muted",
        Object.values(R.REMAP).every((sp) => sp.dst.every((h) => !/^(F|E[6-9A-F])[0-9A-F]{2}[0-4]/i.test(h))) &&
        JSON.stringify(R.remapColour(R.REMAP.gsw_transitions, 255, 201, 14)) === JSON.stringify([201, 207, 210]) &&
        JSON.stringify(R.remapColour(R.REMAP.gsw_occurrence, 0, 0, 255)) === JSON.stringify([47, 70, 82]));
  check("24: the water stress test copy is titled for what it is", /test_wat_006_projected_water_stress: "Water stress projected/.test(src));
  check("25: Mexico's land rights are out; the spatial plans are one row under Deforestation; the Spatial plans and Moratoriums headings are gone",
        f("Mexico land rights", "conafor_mex_forest_zoning") === "(taken out)" && at("Spatial plans") === -1 && at("Moratoriums") === -1 &&
        bat("plans") > at("Deforestation") && bat("plans") < at("Biodiversity loss") &&
        ["idn_forest_moratorium", "rtrw_tabanan_2023", "spatialplanforestland_spv", "v3p3_spatialplanmoratorium_spv", "spatialplanrtrwp_papuawest_spv"]
          .every((id) => f("x", id) === `${P} > Deforestation > Forest zoning and management plans > ${B.plans}`));  // round 89b
  check("26: Trase's peatland area is not a land cover row", !f("Peatland area Land cover Territorial PEAT AREA trase").includes("Forest and land cover"));
  check("27: long lists are split a level further, and a row lands in a sub-heading, not between heading and sub-headings",
        f("Oil palm concessions — Equatorial Asia", "concessioniop_spv") === `${AG} > By crop > Palm oil > Concessions` &&
        f("Palm oil mills — Equatorial Asia", "millop_spv") === `${AG} > By crop > Palm oil > Mills and refineries` &&
        f("Cattle herd size Production beef CATTLE HEADS trase") === "(taken out)" &&   // round 132b: taken out
        f("Soy traded under zero deforestation commitments trase") === `${P} > Deforestation > Deforestation promises` &&   // round 132b
        at("Palm oil") < at("Concessions") && order[at("Concessions")].h === 7 && /"\.panel-h7\{/.test(src));
  check("…a heading of the same name deeper down is not mistaken for this one", /found = own\.find\(named\) \|\| null;/.test(src));
  check("28: of the forest cover maps only the JRC's 2020 map stays, under Deforestation > Forest cover in 2020 (24 September, round 42)",
        f("x", "jrc_global_forest_cover") === `${P} > Deforestation > Forest cover` &&
        ["umd_tree_cover_density_2000", "umd_tree_cover_density_2010", "wri_tropical_tree_cover", "wri_tropical_tree_cover_extent"].every((id) => f("x", id) === "(taken out)"));
  check("29: the land and forest cover layers named are out",
        ["esa_land_cover_2015", "idn_land_cover_2017", "Global_LCHS_2024", "LC1970", "LC1970HS", "Global_FC_2025_TTM", "ECJRCV2", "FCHS_2020_ECJRCV2",
         "REGBRNMYSIDN_FCHS_2020_ECJRC", "REGBRNMYSIDN_FC_2020_ECJRC", "Global_FC-FNF_2024_TTM", "Global_FC-FNF_2025_TTM", "Global_FC-FNF-HS_Latest_TTM",
         "REGBRNIDNMYS_FC-FNF-HS_Latest_TTM", "REGBRNMYSIDN_FCLandArea_2020_ECJRC", "IDNMYSBorneo_LCIndustrial_1970"].every((id) => f("x", id) === "(taken out)") &&
        f("Forest cover 2020, Indonesia's own (Ministry of Environment and Forestry)", "IDN_FC2020_KLHK") === "(taken out)");
  const cog = new Function(src.slice(src.indexOf("function tileDegrees"), src.indexOf("async function cogSquare")) + "; return { cogLevel, tileDegrees };")();
  check("30: GLC_FCS30D's 35 classes, drawn from OpenLandMap's GeoTIFFs square by square, and OpenStreetMap's land use, under Forest and land cover",
        /id: "glc_fcs30d"[^\n]*route: "rasterlive"/.test(src) && /cog4326:\/\/glc_fcs30d\/\$\{y\}\/\{z\}\/\{x\}\/\{y\}/.test(src) &&
        new Function(src.match(/const GLC_FCS30D_CLASSES = \[[\s\S]*?\n\];\n/)[0] + "; return GLC_FCS30D_CLASSES;")().length === 35 &&
        /id: "osm_landuse"[^\n]*route: "osmlanduse"/.test(src) && /"source-layer": "landuse"/.test(src) &&
        order.indexOf("glc_fcs30d") > at("Land Use and Ecoregions") && order.indexOf("osm_landuse") > at("Buildings"));   // round 92b: moved
  check("…a square reads the coarsest level still as fine as the square",
        cog.cogLevel([1296000, 648000, 324000, 162000, 81000, 40500, 20250, 10125, 5063], 1296000, 360 / 1296000, 360 / 2 / 256) === 8 &&
        cog.cogLevel([1296000, 648000, 324000], 1296000, 360 / 1296000, 360 / 1296000 / 4) === 0 &&
        Math.abs(cog.tileDegrees(1, 0, 0).north - 85.0511) < 0.001 && cog.tileDegrees(1, 1, 1).west === 0);
  check("layers with sublayers read as one row: tick first, own title, tick reaching their catalogue parts, reading all, none or part-way",
        /if \(bundle\) \{ line\.appendChild\(all\); line\.appendChild\(head\); \}/.test(src) &&
        /querySelectorAll\(bundle \? "\[data-layer\], \[data-cat\], \[data-smtype\]" : "\[data-layer\]"\)/.test(src) &&
        /e\.target\.dataset\.cat\)\) syncHeadingBoxes\(box\);/.test(src) && /if \(typeof syncHeadingBoxes === "function"\) syncHeadingBoxes\(box\);/.test(src) &&
        Object.keys(B).every((k) => bat(k) > -1));
}
console.log("\nround of 24 September: a search box for the layers, and the unplaced rows filed");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const s = new Function(src.match(/function searchWords[\s\S]*?\n}\n/)[0] + src.match(/function searchMatches[\s\S]*?\n}\n/)[0] + "; return { searchWords, searchMatches };")();
  const m = (q, text) => s.searchMatches(s.searchWords(q), s.searchWords(text));
  check("every typed word must begin a word of the title or the headings above it; case and accents do not matter",
        m("mang", "Mangroves in 1996 (Global Mangrove Watch)") && m("PALM mills", "Palm oil mills Equatorial Asia") &&
        m("cote", "Cocoa cooperatives, Côte d'Ivoire") && !m("oil", "Soil properties (SoilGrids)") && !m("palm xyz", "Palm oil mills"));
  check("the box sits above the list, reads rows added later, and puts every heading back when cleared",
        /layerSearch\(box\);/.test(src) && /box\.parentElement\.insertBefore\(wrap, box\)/.test(src) &&
        /new MutationObserver/.test(src) && /el\.hidden = el\.dataset\.searchWas === "1";/.test(src) && /e\.key === "Escape"/.test(src));
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return { cataloguePlaces, BUNDLES };")();
  const P = "Destruction > Of the planet", f = (id) => places.cataloguePlaces(`x ${id}`, `x ${id}`).join(" | ");
  check("the rows no rule placed are filed by what they show",
        // Round 83b: under Loss year by year only GLAD and the global land area stay.
        f("inpe_amazon_prodes") === "(taken out)" &&
        f("idn_forest_area") === `${P} > Deforestation > Forest zoning and management plans > ${places.BUNDLES.plans}` &&
        f("jrc_global_forest_cover") === `${P} > Deforestation > Forest cover` &&
        f("birdlife_endemic_bird_areas") === `${P} > Biodiversity loss > Birds` &&
        f("ibge_bra_biomes", "ibge_bra_biomes") === "(taken out)" &&
        f("fao_management_objectives") === `${P} > Deforestation > Forest zoning and management plans`);
}
{
  // Round 25: the news popup's filter labels keep one line beside their menus.
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("function wirePopFilters("), src.indexOf("function wirePopPick("));
  check("each popup filter label is its own span, not bare text squeezed a letter a line",
        (body.match(/<span class=\"wf-l\">/g) || []).length === 4 && !/wire-pop-sort\">\$\{label\} /.test(body) &&
        /\.wf-l\{flex:0 0 64px;white-space:nowrap/.test(src) && /min-width:0;width:0/.test(src));
}
{
  // Round 28: the Sustainability Consortium's drivers, read pixel by pixel the
  // way Global Forest Watch's own map reads them.
  console.log("\nround 28: tree cover loss by dominant driver, coloured");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const g = new Function(src.slice(src.indexOf("const GFW_DECODE = {"), src.indexOf("maplibregl.addProtocol(\"gfwdecode\"")) + "; return { GFW_DECODE, gfwDecodePixels };")();
  const keys = new Function("escapeHtml", src.slice(src.indexOf("const GFW_KEYS = {"), src.indexOf("function catalogueKeyShow(")) + "; return { GFW_KEYS };")((x) => String(x)).GFW_KEYS;
  const t = keys.tsc_tree_cover_loss_drivers;
  check("the five drivers carry the names on Global Forest Watch's own raster, 1 to 5",
        t.values.map((v) => v[0] + " " + v[2]).join("; ") === "1 Commodity driven deforestation; 2 Shifting agriculture; 3 Forestry; 4 Wildfire; 5 Urbanization");
  const cols = new Map(t.values.map(([v, c]) => [v, [0, 2, 4].map((i) => parseInt(c.slice(1 + i, 3 + i), 16))]));
  // pixel 1: 2015, Forestry, full loss; pixel 2: empty; pixel 3: code 9 (not a driver); pixel 4: year 2000 (no loss year)
  const px = new Uint8ClampedArray([255, 3, 15, 255,  0, 0, 0, 255,  200, 9, 10, 255,  200, 2, 0, 255]);
  const n = g.gfwDecodePixels(px, g.GFW_DECODE.tsc_tree_cover_loss_drivers, cols, 13);
  check("a pixel reads blue as the year, green as the driver and red as how much, painted in the key's colour",
        px[0] === cols.get(3)[0] && px[1] === cols.get(3)[1] && px[2] === cols.get(3)[2] && px[3] === 255);
  check("an empty pixel, a code that is no driver and a pixel with no loss year are left clear, and the odd ones counted",
        px[7] === 0 && px[11] === 0 && px[15] === 0 && n.drawn === 3 && n.odd === 2);
  check("the tiles asked for are Global Forest Watch's own default, 30% tree cover, at its zooms 2 to 4, enlarged closer in",
        g.GFW_DECODE.tsc_tree_cover_loss_drivers.tcd === 30 && g.GFW_DECODE.tsc_tree_cover_loss_drivers.maxzoom === 4 &&
        /asset\.uri\.replace\(\/\\\/tcd_\\d\+\\\/\/, `\/tcd_\$\{dc\.tcd\}\/`\)/.test(src));
  check("the row reads the tiles through the decoder and shows the key", /gfwdecode:\/\/\$\{d\.id\}\//.test(src) && /asset\.how === "cog" \|\| decode/.test(src));
}
{
  // Round 29: every field in the boxes that used their own template, and on live points.
  console.log("\nround 29: every field, everywhere");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const f = new Function("escapeHtml", src.slice(src.indexOf("const FIELD_WORDS = {"), src.indexOf("function fieldRows(")) + src.match(/function fieldRows[\s\S]*?\n}\n/)[0] + src.match(/function everyField[\s\S]*?\n}\n/)[0] + "; return { everyField };")((x) => String(x));
  const html = f.everyField({ name: "Pad 39A", location: { country: { name: "USA" }, id: 7 }, tags: ["a", "b"], empty: "", agencies: [{ id: 1 }] }, ["name"]);
  check("a nested record is spelt out with dotted names, lists joined, blanks and skipped fields left off",
        /title="location\.country\.name">Location country name<\/th><td>USA/.test(html) && /Tags<\/th><td>a, b/.test(html) && /Agencies<\/th><td>\[\{"id":1\}\]/.test(html) &&
        !/empty/.test(html) && !/>name</.test(html) && /<details/.test(html));
  check("the uMap, ArcGIS, My Maps, WP Go Maps, Launch Library and Trase boxes all carry it",
        /umapPopup\([^)]*\) \+ `<\/div>`, p, \["_umap_options"\]\)/.test(src) && /withEveryField\(arcgisPopupHtml/.test(src) &&
        /desc && data\.length \? everyField/.test(src) && /everyField\(m, \["title", "description"\]\)/.test(src) &&
        (src.match(/everyField\(r\)/g) || []).length === 2 && /everyField\(Object\.fromEntries\(Object\.entries\(props\)/.test(src));
  check("a country total's box lists every figure its record carries",
        /totals\[e\.features\[0\]\.id\]/.test(src));
  check("a trade flow's box lists every field of the flow's record", /_all: JSON\.stringify\(r\)/.test(src));
}
{
  // Round 30: what the live check of 24 September found.
  console.log("\nround 30: the layers the live check found not drawing");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const owid = new Function(src.match(/function owidParse[\s\S]*?\n}\n/)[0] + "; return owidParse;")();
  const rows = owid("entity,code,year,oda_share_gni_recipient,owid_region\nAfghanistan,AFG,1960,3.129,Asia\nWorld,OWID_WRL,1960,1,\nChad,TCD,1961,,Africa\n");
  check("an Our World in Data file ending in a text column still reads its numbers (foreign aid drew 0 countries)",
        rows.length === 1 && rows[0].iso3 === "AFG" && rows[0].v === 3.129);
  check("a harvested layer that has drawn stops saying loading", /\/\^loading\/\.test\(stateEl\.textContent/.test(src));
  check("EJAtlas is read as GeoJSON first, the way its own map reads it, since its plain list lost its positions",
        /\$\{cfg\.api\}\?format=geojson/.test(src) && /gurl = j\.next \|\| null/.test(src));
  check("Trase's region shapes come from the weekly copy first, Trase's own server second",
        /regionsCopy: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/trase\/regions"/.test(src) &&
        /traseCopyFirst\(cfg, "metadata\.json"\)/.test(src) && /traseCopyFirst\(cfg, file\)/.test(src));
}
{
  console.log("\nround 33: ESA's risk list drawn round the globe");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const cut = src.slice(src.indexOf("const NEO_PS = "), src.indexOf("async function addNeoRingLayer("));
  const neo = new Function(cut + "; return { NEO_PS, neoColour, neoParse, neoSpan, neoAngle };")();
  const text = `Last Update: 2026-09-24 18:03 UTC
           Object             |    Diameter    |             VI Max                                   |          VIs                  |
Num/des.           Name       |   m  |   *=Y   |      Date/Time   |  IP max  | PS max |TS  | Vel km/s | Years     | IP cum   | PS cum |
AAAAAAAAAAAA AAAAAAAAAAAAAAAA | NNNN |    A    | YYYY-MM-DD HH:MM | EEEEEEEE | NNN.NN | NN |  NNN.NN  | YYYY-YYYY | EEEEEEEE | NNN.NN |
2023VD3                       |   14 |    *    | 2034-11-08 17:08 |  2.35E-3 |  -2.67 |  0 |   21.01  | 2034-2039 |  2.35E-3 |  -2.67 |
2008JL3                       |   30 |    *    | 2027-05-01 09:05 |  1.49E-4 |  -2.73 |  0 |   14.01  | 2027-2122 |  1.61E-4 |  -2.73 |
1979XB                        |  500 |    *    | 2056-12-12 21:38 |  2.34E-7 |  -2.82 |  0 |   27.54  | 2056-2113 |  7.34E-7 |  -2.70 |
101955       Bennu            |  490 |         | 2182-09-24 16:00 |  3.70E-4 |  -1.40 |  0 |   12.00  | 2178-2290 |  5.70E-4 |  -1.40 |
`;
  const { updated, rows } = neo.neoParse(text);
  check("every object row on ESA's list is read, none dropped, headings left out", rows.length === 4 && /2026-09-24/.test(updated || ""));
  const b = rows.find(r => /Bennu/.test(r.name || ""));
  check("each object keeps ESA's own date, probability and Palermo rating",
        b && b["date of likeliest impact (UTC)"] === "2182-09-24 16:00" && Number(b["impact probability, likeliest date"]) === 3.7e-4 &&
        Number(b["Palermo rating, likeliest date"]) === -1.4);
  check("Palermo colours run dark to bone, with no orange, yellow or green",
        neo.neoColour(-9) === "#2E3478" && neo.neoColour(-1.4) === "#BFEBF5" && neo.neoColour(-3) === "#46B8D8" &&
        neo.NEO_PS.every(([, c]) => !/^#(F[89A-F]|E[89A-F])[89A-F]..?[0-6]/i.test(c)));
  const span = neo.neoSpan(rows, Date.UTC(2026, 8, 24));
  check("the ring covers a hundred years at least, and reaches the latest date on the list", span >= 100 && span % 25 === 0 && span >= 2182 - 2026);
  check("the year guides fall on whole years", /const step = Math\.max\(25, Math\.ceil\(span \/ 4 \/ 25\) \* 25\)/.test(src) && !/k \+= span \/ 4/.test(src));
  check("the list is ESA's own file first, the daily copy second, and drawn only at world view",
        /neo\.ssa\.esa\.int\/PSDB-portlet\/download\?file=esa_risk_list/.test(src) && /\/neo\/esa_risk_list\.txt/.test(src) &&
        /route: "neoring"/.test(src) && /if \(!on \|\| map\.getPitch\(\) > 5 \|\| !\(R > 0\) \|\| outer - R \* 1\.1 < 45\) return;/.test(src));
}
{
  console.log("\nround 34: UFO and UAP sightings (UFOSINT)");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const fnv = new Function(src.match(/function pieceOf\(key\) \{[\s\S]*?\n\}/)[0] + "; return pieceOf;")();
  check("the map finds a sighting in the same piece the copy put it in (scripts/ufosint.py puts id 243 in 00)", fnv("243") === "00");
  check("the row draws UFOSINT's copy with every sighting's record read from gzipped pieces",
        /id: "ufo_sightings"[\s\S]{0,400}route: "ufo"[\s\S]{0,300}tiles\/ufo_sightings\.pmtiles[\s\S]{0,200}ufosint\/pieces", boxesGz: true/.test(src));
  check("a gzipped piece is unpacked only when it is a gzip stream", /DecompressionStream\("gzip"\)/.test(src) && /buf\[0\] !== 0x1f \|\| buf\[1\] !== 0x8b/.test(src) &&
        /readPiece\(cfg\.boxes, p\.id, cfg\.boxesGz\)/.test(src));
  check("it sits under Unidentified anomalous phenomena (the official term since the US FY2023 NDAA)", /\{ h: 3, t: "Unidentified anomalous phenomena" \}, "ufo_sightings"/.test(src));
  check("a news mark's box offers a Language menu (round 67)", /<select data-wf="lang">/.test(src) && /is\(s, "lang", f\.lang\)/.test(src));
  check("a split archive's further files keep the detail layer's own zooms (read before the first file's are laid over them)",
        /own\[id\] = \{ lo: was\.minzoom \|\| 0/.test(src) && /Math\.max\(own\[`\$\{cfg\.id\}-\$\{kind\}`\]\.lo, part\.minzoom\)/.test(src));
  check("the glow of a split archive's files ends at each file's own zooms", /hudWrap\("setLayerZoomRange"/.test(src) && /-part\\d\+\$\/\.test\(layer\.id\)/.test(src));
}
{
  console.log("\nround 35: Materials research from a weekly copy");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("Materials research reads its copy (manifest, tiles, gzipped pieces) and falls back to reading live",
        /id: "arcgis_materialresearch"[\s\S]{0,300}copy: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/arcgis\/arcgis_materialresearch"/.test(src) &&
        /cfg\.route === "arcgisapp" && cfg\.copy \? addArcgisCopyLayer\(cfg\)/.test(src) &&
        /no copy yet \(\$\{e\.message\}\); reading live`\); return addLivePlacesLayer\(cfg\)/.test(src));
  check("a click on the copy shows the app's own popup and every field", /readPiece\(`\$\{cfg\.copy\}\/pieces`, p\.k, true\)/.test(src) &&
        /withEveryField\(arcgisPopupHtml\(l\.title \|\| man\.title, l\.popupInfo, rec\.a \|\| \{\}\), rec\.a \|\| \{\}\)/.test(src));
}
{
  console.log("\nround 35: cattle and pasture rows filed as asked; the modelled farm rows show when ticked");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT };")();
  const at = (t) => lib.cataloguePlaces(t, t);
  const P = "Destruction > Of the planet";
  const only = (t, want) => { const got = at(t); return got.length === 1 && got[0] === want; };
  check("Trase's cattle and pasture deforestation go under Deforestation only",
        only("Cattle deforestation (ha) \u2014 Brazil (Trase) CATTLE_DEFORESTATION", P + " > Deforestation > Tree cover loss and alerts > Cattle") &&
        only("Cattle deforestation per ton (ha/t) \u2014 Brazil, Paraguay (Trase) X", P + " > Deforestation > Tree cover loss and alerts > Cattle") &&
        only("Pasture deforestation (ha) \u2014 Brazil (Trase) X", P + " > Deforestation > Tree cover loss and alerts > Cattle"));
  check("the emissions from that clearing go under Climate only",
        ["Gross emissions from cattle deforestation (t CO\u2082-eq.) \u2014 Brazil (Trase) X", "Net emissions from pasture deforestation (t) \u2014 Brazil (Trase) X",
         "Gross emissions from cattle deforestation per ton (t) \u2014 Brazil, Paraguay (Trase) X"].every((t) => only(t, P + " > Climate > Carbon dioxide > Emissions")));
  check("Trase's pasture area and every Global Pasture Watch layer are taken out",
        [ "Pasture area (ha) \u2014 Brazil, Paraguay (Trase) PASTURE_AREA", "Grasslands 2023 gpw_grasslands_2023",
          "Cultivated and natural grasslands wri_globalpasturewatch_grasslands_2010", "Grasslands (Global Pasture Watch) x"].every((t) => at(t)[0] === lib.CATALOGUE_TAKEN_OUT));
  check("soy deforestation is still filed as before", at("Soy deforestation (ha) \u2014 Brazil (Trase) X").includes(P + " > Deforestation > Tree cover loss and alerts > Soy and corn"));
  check("the modelled confined animal facilities and livestock density rows show when ticked (their layers are listed)",
        /cfg\._layerIds = \[`\$\{cfg\.id\}-cafo`\]/.test(src) && /cfg\._layerIds = \[`\$\{cfg\.id\}-glw`\]/.test(src));
}
{
  console.log("\nround 36: agriculture pared down, soy, corn and grain under Climate, Indonesia's plantations one row");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT, AG, IN };")();
  const at = (t) => lib.cataloguePlaces(t, t);
  const P = "Destruction > Of the planet", N2O = P + " > Climate > Nitrous oxide", OUT = lib.CATALOGUE_TAKEN_OUT;
  const same = (t, want) => JSON.stringify(at(t)) === JSON.stringify(want);
  check("Trase's seven corn rows are taken out",
        ["Corn traded under zero deforestation commitments (%) \u2014 Paraguay (Trase) X", "Corn yield (t/ha) \u2014 Brazil, Paraguay (Trase) X",
         "Corn yield (first crop) (t/ha) \u2014 Brazil (Trase) X", "Production of corn (second crop) (t) \u2014 Brazil (Trase) X"].every((t) => at(t)[0] === OUT));
  check("coffee, cocoa, cotton and sugarcane rows are taken out; clearing for cocoa and its emissions stay",
        ["Coffee yield (t/ha) \u2014 Brazil, Colombia (Trase) X", "Production of cocoa (t) \u2014 Brazil, C\u00f4te d'Ivoire (Trase) X",
         "Cotton yield (t/ha) \u2014 Brazil (Trase) X", "Sugarcane concessions \u2014 Merauke merauke_sugarcane", "Yield of sugarcane mapspam_yield_sugc"].every((t) => at(t)[0] === OUT) &&
        at("Cocoa deforestation (ha) \u2014 C\u00f4te d'Ivoire (Trase) X").includes(P + " > Deforestation > Tree cover loss and alerts > Cocoa") &&
        at("Gross emissions from cocoa deforestation (t) \u2014 Ghana (Trase) X")[0] !== OUT);
  check("Badung's detailed spatial plans are taken out", at("Detailed spatial plan \u2014 Bali badung_rdtr")[0] === OUT);
  check("soy, corn and grain rows are under Climate only; soy clearing is not",
        same("Soy yield (t/ha) \u2014 Brazil, Paraguay (Trase) X", [N2O + " > Emissions"]) && same("Soybean yield mapspam_yield_soyb", [N2O + " > Emissions", lib.AG + " > By crop > Soy"]) &&
        same("Soybean planted area \u2014 South America x", [N2O + " > Emissions"]) &&
        !at("Soy deforestation (ha) \u2014 Brazil (Trase) X").some((x) => x.startsWith(N2O)) &&
        !at("Soy traded under zero deforestation commitments (%) \u2014 Paraguay (Trase) X").some((x) => x.startsWith(N2O)));
  check("fertilizer is under Climate only", same("Fertilizer use x", [N2O + " > Emissions"]) && !/\{ h: 5, t: "Farm inputs" \}/.test(src));
  check("Aqueduct's layers are under Water scarcity (round 93b: the farmland one is the map's own copy)", same("Water risk for crops, baseline 2020 (WRI Aqueduct) aqueduct_crop_baseline_2020", [lib.CATALOGUE_TAKEN_OUT]) &&
        /\{ h: 3, t: "Water scarcity" \}, "jrc_water", "aqueduct_proj",/.test(src) &&   // round 123b: the farmland one out
        /\{ h: 3, t: "Water scarcity" \}/.test(src));
  check("plantation rows for Indonesia and its neighbours are one row with sublayers; worldwide ones stay beside it",
        same("Established plantations \u2014 Merauke plantation_established_merauke", [lib.IN(lib.AG + " > Cropland > Plantations of no single crop (single crops are under By crop)", "idnplant")]) &&
        same("Tree plantations \u2014 158 countries gfw_planted_forests", [lib.AG + " > Cropland > Plantations of no single crop (single crops are under By crop)"]) &&
        // Round 101b: timber plantations under Deforestation; one crop's under that crop.
        same("Industrial tree plantations \u2014 Indonesia IDN_HTI_plantation", [P + " > Deforestation > Timber and rubber plantations"]) &&
        same("Coconut plantations \u2014 Kalimantan kalimantan_coconut", [lib.AG + " > By crop > Coconut"]));
  check("the modelled rows say so in their titles", /Confined animal feeding operations \\u2014 a model's estimate, not registered sites/.test(src) &&
        /Livestock density \\u2014 a model's estimate, not a count of farms/.test(src) && /Registered animal-use facilities \\u2014 sites on official registers/.test(src));
}
{
  console.log("\nround 37: forest and land cover pared down");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT, IN, BUNDLES };")();
  const f = (t, id = "") => lib.cataloguePlaces(`${t} ${id}`, `${t} ${id}`).join(" | ");
  const P = "Destruction > Of the planet", OUT = lib.CATALOGUE_TAKEN_OUT;
  check("the rows named are taken out",
        [["GNW Carbon Model - Forest Age", "gfw_forest_age"], ["GNW Carbon Model - Litter Carbon", "gfw_litter_carbon"], ["Natural forests \u2014 Indonesia", "idn_natural_forest"],
         ["Tree height 2020 \u2014 Indonesia and Malaysia (ETH Zurich)", "REGIDNMYS_TreeHeight_2020_ETHZurich"], ["Tree cover height 2020", "umd_tree_cover_height_2020"],
         ["MapBiomas land cover \u2014 Brazil", "mapbiomas_bra_land_cover"], ["Forest type 2013 \u2014 Honduras", "icf_hnd_forest_type_2013"],
         ["RSPO land cover 2010 \u2014 Southeast Asia", "rspo_southeast_asia_land_cover_2010"], ["Tree cover gain", "umd_tree_cover_gain"],
         ["Land cover \u2014 United States", "usa_land_cover"]].every(([t, id]) => f(t, id) === OUT));
  check("the JRC's managed land is out (24 September, round 40)",
        ["jrc_managed_land_can", "jrc_managed_land_usa"].every((id) => f("JRC Managed Land", id) === OUT) && !/\{ h: 5, bundle: "managed"/.test(src));
  check("trees in mosaic landscapes (under Deforestation since round 43) and natural forests worldwide stay", f("Trees in mosaic landscapes", "wri_trees_in_mosaic_landscapes") === P + " > Deforestation > Forest cover" &&
        f("Natural forests", "sbtn_natural_forests_map") === P + " > Deforestation > Forest cover");   // round 92b
}
{
  console.log("\nround 38: biodiversity loss pared down; Global Safety Net's layers each a row");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT };")();
  const f = (t, id = "") => lib.cataloguePlaces(`${t} ${id}`, `${t} ${id}`).join(" | ");
  const P = "Destruction > Of the planet", OUT = lib.CATALOGUE_TAKEN_OUT;
  check("of the intact and primary forests only intactness, the integrity index and the Intact Forest Landscapes stay, now under Wild and intact places (round 99b)",
        f("Biodiversity Intactness \u2014 Forested Biomes Globally", "birdlife_biodiversity_intactness") === P + " > Biodiversity loss > Places that matter most for species > Wild and intact places" &&
        f("Forest Landscape Integrity Index \u2014 Global", "wcs_forest_landscape_integrity_index") === P + " > Biodiversity loss > Places that matter most for species > Wild and intact places" &&
        f("Primary forests \u2014 Indonesia", "idn_primary_forests") === OUT && f("Primary forests in the tropics, 2001", "umd_regional_primary_forest_2001") === OUT);
  check("the rows named are out",
        [["Tiger Conservation Landscapes", "tcl"], ["Conservation easements \u2014 United States", "usa_conservation_easements"], ["Protected areas \u2014 Peru", "per_protected_areas"],
         ["KHM Protected Areas", "khm_protected_areas"], ["Federal protected areas \u2014 Brazil", "icmbio_bra_federal_protected_areas"], ["Leuser Ecosystem", "haka_idn_leuser"],
         ["Protected areas, with their names \u2014 Equatorial Asia", "protectedarea_names"], ["Protected areas, merged \u2014 Equatorial Asia", "protectedarea_merged"],
         ["Protected areas \u2014 Equatorial Asia", "v3p2_protectedarea"], ["Protected area outlines \u2014 Equatorial Asia", "pa_outline"],
         ["Hydrological reserves \u2014 Equatorial Asia", "hydroreserve"], ["Forest reserves \u2014 Equatorial Asia", "forestreserve"],
         ["Ecosystem restoration concessions \u2014 Equatorial Asia", "ere"], ["Conservation landscapes \u2014 Equatorial Asia", "conslandscape"]].every(([t, id]) => f(t, id) === OUT) &&
        f("Protected areas \u2014 Equatorial Asia", "protectedarea") !== OUT);
  check("Global Safety Net's layers are filed by kind (round 91b, 99b)", f("Rare/Threatened Species (Global Safety Net)", "8") === P + " > Biodiversity loss > Places that matter most for species > Where species are threatened" &&
        f("Trees, broadleaf (Global Safety Net)", "14") === P + " > Deforestation > Forest cover" && f("Trees, mangrove (Global Safety Net)", "18") === P + " > Deforestation > Mangroves" &&
        f("Water Bodies (Global Safety Net)", "25") === P + " > Biodiversity loss > Land Use and Ecoregions" && f("Inland Water (Global Safety Net)", "13") === P + " > Biodiversity loss > Land Use and Ecoregions" &&
        f("Terrestrial Ecoregions (Global Safety Net)", "28") === OUT && f("Protected (Global Safety Net)", "2") === P + " > Biodiversity loss > Places that matter most for species > Protected areas" &&
        f("Terrestrial ecoregions", "ecoregions") === P + " > Biodiversity loss > Land Use and Ecoregions" && /title: `\$\{l\.name\} \(Global Safety Net\)`/.test(src));
  check("the endemic bird areas have a heading of their own", /\{ h: 4, t: "Birds" \}/.test(src) && f("Endemic Bird Areas", "birdlife_endemic_bird_areas") === P + " > Biodiversity loss > Birds");
}
{
  console.log("\nround 39: rings fit the screen, the assessment round the globe, UAP and launches by time");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const neo = new Function(src.slice(src.indexOf("const NEO_PS = "), src.indexOf("\n// A bar of two handles")) + "; return { neoPlace };")();
  const row = { "date of likeliest impact (UTC)": "2100-01-01 00:00", "impact probability, all dates": 1e-12, "diameter (m)": 100 };
  const far = neo.neoPlace([row], 100, 0, 0, Date.UTC(2026, 0, 1), 100, 150)[0];
  check("the asteroid ring fits the screen: its furthest mark sits at the outer edge given", Math.abs(Math.hypot(far.x, far.y) - 150) < 1e-6 &&
        /const outer = Math\.min\(R \* 1\.95, Math\.min\(w, h\) \/ 2 - 22\);/.test(src) && /outer - R \* 1\.1 < 45\) return;/.test(src));
  const W = new Function(src.slice(src.indexOf("const WORLD_PROB = "), src.indexOf("async function addWorldsRingLayer(")) + "; return { worldsParse, worldColour };")();
  const worlds = W.worldsParse(`<script>\n    ${`const WORLDS = [
    {
        id: 'mars', name: 'Mars', color: '#e07a5f',
        sub: 'Cheyava Falls, Jezero Crater',
        where: '140 million miles · Jezero Crater',
        prob: '3–8%', probMid: 5.5, logX: 0.13, size: 0.30, x: 17, y: 60,
        note: 'Strongest evidence to date. Only returned samples can confirm it.',
        badge: 'Strongest candidate',
        evidence: 'Leopard-spot textures carrying vivianite and greigite alongside organic molecules. On Earth, patterns like these form where microbes have processed sediment.',
        status: 'Peer-reviewed in Nature, September 2025. The rock is 2 to 3 billion years old. Non-biological chemistry cannot be ruled out from orbit or from the rover deck.',
        mission: 'Mars Sample Return', when: '2030 – 2039',
        missionText: 'Earth Return Orbiter around 2030, Sample Retrieval Lander around 2031, samples on Earth between 2035 and 2039. Architecture under review until mid-2026. China\\u2019s Tianwen-3 may return samples as early as 2031.'
    },
    {
        id: 'europa', name: 'Europa', color: '#e6b98c',
        sub: 'Jupiter II',
        where: '390 million miles · moon of Jupiter',
        prob: '5–15%', probMid: 10, logX: 0.35, size: 0.34, x: 40, y: 30,
        note: 'Highest habitability score in the solar system. No biosignature yet.',
        badge: 'Prime target',
        evidence: 'A liquid ocean beneath 15 to 25 km of ice, holding organic molecules and energy sources — every ingredient life is known to require.',
        status: 'The ocean is likely in contact with a rocky seafloor, which would drive hydrothermal chemistry. Nothing resembling a biosignature has been detected.',
        mission: 'Europa Clipper', when: 'Arrives 2030',
        missionText: 'Launched October 2024. More than 50 close flybys to assess the ocean\\u2019s habitability and search for biosignatures venting through the ice.'
    },
    {
        id: 'enceladus', name: 'Enceladus', color: '#9fd8ee',
        sub: 'Saturn II',
        where: '790 million miles · moon of Saturn',
        prob: '10–20%', probMid: 15, logX: 0.56, size: 0.30, x: 63, y: 58, gap: 30,
        note: 'Best conditions for life existing now, anywhere in the solar system.',
        badge: 'Prime target',
        evidence: 'Cryovolcanic plumes throw ocean water into space, where spacecraft can fly through it. October 2025 analyses found complex organics, including aromatic compounds, amino acids and phosphorus.',
        status: 'Caroline Freissinet, NASA astrobiologist, described every condition for life to arise and persist being present in one place at one time. Hydrothermal activity is evident. The plume samples the ocean directly.',
        mission: 'Enceladus Orbilander', when: 'Launch 2038 · Landing early 2050s',
        missionText: 'Proposed NASA Flagship, roughly $4.9B, project start FY2029. A 7.5-year cruise, a 4.5-year Saturn tour, 1.5 years in orbit, then two years on the surface searching for biosignatures.'
    },
    {
        id: 'k2-18b', name: 'K2-18 b', color: '#7aa7ff',
        sub: 'Leo, 124 light-years',
        where: '730 trillion miles · constellation Leo',
        prob: '<1%', probMid: 0.8, logX: 0.94, size: 0.40, x: 84, y: 27,
        note: 'Extremely low. The signal itself is still unconfirmed.',
        badge: 'Highly controversial',
        evidence: 'A tentative dimethyl sulfide detection at 3-sigma. On Earth, DMS comes almost entirely from marine phytoplankton.',
        status: 'A NASA reanalysis in July 2025 found no conclusive evidence. The signal sits below the 5-sigma threshold. The planet may be a gas-rich mini-Neptune with no habitable surface at all.',
        mission: 'JWST observations', when: '2026 · ongoing',
        missionText: '16 to 24 further hours of JWST time, aiming at 5-sigma. ESA\\u2019s Ariel, launching 2029, will provide comparative atmospheres across many exoplanets.'
    }
];`}\n</script>`);
  check("the biosignature assessment is read from the page itself: four worlds, their chances and missions", worlds.length === 4 &&
        worlds.map((w) => w.name).join() === "Mars,Europa,Enceladus,K2-18 b" && worlds[2].probMid === 15 && /Orbilander/.test(worlds[2].mission));
  check("its colours are the map's blues, not the page's orange", W.worldColour(0.8) === "#3F4FC4" && W.worldColour(15) === "#8FDCEB" &&
        /id: "biosignature"[^\n]*route: "worldsring"/.test(src));
  check("the UAP row is titled UAP, drawn by year with a bar, and lists every sighting at a spot", /name: "Unidentified anomalous phenomena \(UAP\) sightings reported worldwide \(UFOSINT\)"/.test(src) &&
        /\["==", \["get", "y"\], -9999\]/.test(src) && /queryRenderedFeatures\(e\.point, \{ layers: lids/.test(src));
  check("upcoming launches are per site, soonest first with dates, and filtered by a date bar", /name: "Rocket launches coming up, at each launch site \(The Space Devs\)"/.test(src) &&
        /cfg\.route === "ll2" && cfg\.what === "upcoming" \? addLaunchSitesLayer\(cfg\)\n      : cfg\.route === "ll2" \? addLivePlacesLayer/.test(src) &&
        /toISOString\(\)\.slice\(0, 10\) : "date not set"\)\}[\s\S]{1,9}\$\{escapeHtml\(l\.name/.test(src));
}
{
  console.log("\nround 40: zero-deforestation shares with their commodities; forest emissions under Climate");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT, AG };")();
  const f = (t, id = "") => lib.cataloguePlaces(`${t} ${id}`, `${t} ${id}`).join(" | ");
  const P = "Destruction > Of the planet";
  check("each zero-deforestation share goes with its commodity; the heading is gone",
        // Round 132b (asked 2 October): every promise under Deforestation promises.
        f("Beef traded under zero deforestation commitments (%) \u2014 Paraguay (Trase)", "X") === P + " > Deforestation > Deforestation promises" &&
        f("Soy exported under a ZDC (%) \u2014 Brazil (Trase)", "X") === P + " > Deforestation > Deforestation promises" &&
        f("Percentage of (total) cocoa that is exported under a zero deforestation commitment (%) \u2014 C\u00f4te d'Ivoire (Trase)", "X") === P + " > Deforestation > Deforestation promises" &&
        !/\{ h: 4, t: "Zero-deforestation commitments" \}/.test(src));
  check("soy's companies and financiers are under Agriculture > Soy", /\{ h: 6, t: "Soy" \}, "crop_soyb", "site_forest500_soy", "soy_traders_money", "soy_organizations"/.test(src) &&
        /\{ h: 4, t: "Companies and financiers" \}, "dff",/.test(src));
  check("forest emissions rows land under Climate, and the heading under Deforestation is gone",
        f("Gross carbon emissions from forests", "gfw_forest_carbon_gross_emissions") === P + " > Climate > Carbon dioxide > Emissions" && !/\{ h: 4, t: "Emissions from forests" \}/.test(src));
  check("Argentina's native forest land plan is out", f("Ordenamiento Territorial de Bosques Nativos \u2014 Argentina", "arg_native_forest_land_plan") === lib.CATALOGUE_TAKEN_OUT);
}
{
  console.log("\nround 41: forest management worldwide; housekeeping, Brazil's biomes and wind speed out");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT };")();
  const f = (t, id = "") => lib.cataloguePlaces(`${t} ${id}`, `${t} ${id}`).join(" | ");
  check("Brazil's biomes and wind speed potential are out", f("Brazil biomes", "ibge_bra_biomes") === lib.CATALOGUE_TAKEN_OUT && f("Wind speed potential", "dtu_wb_wind_speed_potential_2001_2010") === lib.CATALOGUE_TAKEN_OUT);
  check("the Housekeeping heading and its row are out", !/t: "Housekeeping"/.test(src) && /"skytruth_tests",\s+\/\/ the Housekeeping heading/.test(src));
  check("the forest management map is a row under Deforestation, drawn from its copy in runs of zooms", /\{ h: 3, t: "Deforestation" \}, "forest_management",/.test(src) &&
        /id: "forest_management"[^\n]*route: "rasterparts"/.test(src) && /tiles\/forest_management\.pmtiles/.test(src) && /"raster-resampling": "nearest"/.test(src));
}
{
  console.log("\nround 42: craft in space; one forest cover map; a fresh copy of the code on each round");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("NASA's Eyes is a row under From Earth > Craft in space", /\{ h: 3, t: "Craft in space" \}, "eyes_craft"/.test(src) && /id: "eyes_craft"[^\n]*route: "(companion|leave)"/.test(src));
  check("the page asks for this round's code, not a copy the browser kept", /<script src="\.\/app\.js\?v=\d+"><\/script>/.test(html) && /<script src="\.\/wire\.js\?v=\d+"><\/script>/.test(html));
}
{
  console.log("\nround 43: controls moved; alerts, mosaic landscapes, palm and mills filed; internal layers out");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT, AG };")();
  const f = (t, id = "") => lib.cataloguePlaces(`${t} ${id}`, `${t} ${id}`).join(" | ");
  const P = "Destruction > Of the planet", OUT = lib.CATALOGUE_TAKEN_OUT;
  check("the zoom buttons are right of the basemap choices; north-up where they were",
        /<div class="bm-row"><div class="bm-choices">/.test(src) && /<\/div><div class="view-zoom" id="view-zoom"><\/div><\/div><\/div><\/div>`;/.test(src) &&
        /<\/div><div class="compass-holder in-view" id="compass-holder"/.test(src));
  check("GLAD-S2 in Amazonia and its coverage are out (round 84b, at the owner's word)",
        ["umd_glad_sentinel2_alerts", "umd_glad_sentinel2_alerts_coverage"].every((id) => f("Deforestation alerts (GLAD-S2) \u2014 Amazonia", id) === OUT));
  check("mosaic landscapes, planted oil palm and forest mills filed; internal layers, DIST-ALERT coverage and the Chaco field boundaries out",
        f("Trees in mosaic landscapes coverage", "wri_trees_in_mosaic_landscapes_coverage") === P + " > Deforestation > Forest cover" &&
        f("Planted forests: oil palm", "gfw_planted_forests_oil_palm") === lib.AG + " > By crop > Palm oil > Plantations" &&
        f("Forest mills", "gfw_forest_mills") === P + " > Deforestation > Logging and timber concessions" &&
        [["Gadm geotrellis features", "gadm_geotrellis_features"], ["Gfw buffered points", "gfw_buffered_points"], ["GFW Pro forest change regions", "gfwpro_forest_change_regions"],
         ["UMD GLAD land disturbance alerts coverage", "umd_glad_dist_alerts_coverage"], ["Field boundaries \u2014 Chaco Chiquitano", "x"]].every(([t, id]) => f(t, id) === OUT));
}
{
  console.log("\nround 44: every row in the GLAD-S2 style; Boundaries and relief pared to the GLAD-L coverage");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const G = new Function(src.slice(src.indexOf("function gladHex("), src.indexOf("for (const c of LAYERS.concat(")) + "; return { gladColour };")();
  const hue = (hex) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1;
    let h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); return (h + 360) % 360; };
  const out = ["#6A6258", "#8A4F46", "#6E5A55", "#5E7377", "#7C6F84", "#B07F86", "#62755F"].map((c, i) => G.gladColour(c, "row" + i));
  check("every row colour lands between teal and cobalt (round 85b), never green, yellow, orange or purple", out.every((c) => hue(c) >= 168 && hue(c) <= 230));
  check("rows that were the same grey come out different", new Set(["a", "b", "c", "d"].map((id) => G.gladColour("#6A6258", id))).size > 1);
  check("the recolour reaches every row and group child", /for \(const c of LAYERS\.concat\(\.\.\.GROUPS\.map\(\(g\) => g\.children \|\| \[\]\)\)\) \{/.test(src));
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT };")();
  const f = (t, id = "") => lib.cataloguePlaces(`${t} ${id}`, `${t} ${id}`).join(" | ");
  check("Boundaries and relief keeps only the GLAD-L coverage",
        [["Bali from the air, 31 May 1965", "BALI_19650531"], ["Country boundaries \u2014 Equatorial Asia", "adm0"], ["Papua, Sentinel-2 true colour \u2014 location 12", "papua_s2_12"],
         ["Towns and villages \u2014 Equatorial Asia", "towns"], ["Cities boundaries test", "cities_boundaries_test"], ["GADM (4.1) national boundaries - Africa", "gadm_adm0_africa"],
         ["GADM Administrative Boundaries", "gadm_administrative_boundaries"], ["Gadm administrative boundaries disputed", "gadm_administrative_boundaries_disputed"],
         ["Borneo relief, 30 m (SRTM 2000)", "x"], ["News articles, placed \u2014 Equatorial Asia", "news"]].every(([t, id]) => f(t, id) === lib.CATALOGUE_TAKEN_OUT) &&
        f("Coverage Layer for GLAD-L", "umd_glad_landsat_alerts_coverage") === lib.CATALOGUE_TAKEN_OUT);
}
{
  console.log("\nround 45: the 500 largest companies, compiled from Wikidata, in Fortune's place");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the Fortune row is gone and the compiled row stands where it stood",
        !/fortune500|interactives\.fortune\.com/.test(src) && /"site_social_spheres", "largest_companies",/.test(src));
  check("the row reads the weekly copy and shows every field", /id: "largest_companies", name: "The 500 largest companies by revenue \(compiled from Wikidata\)"[^\n]*route: "geojsonlive"/.test(src) &&
        /culprits-tiles-more\/companies\/largest\.geojson/.test(src) && /largest_companies: "Compiled weekly from Wikidata/.test(src));
  check("the page asks for a fresh script", appVersion(html) >= 45 && /wire\.js\?v=(4[5-9]|[5-9]\d)/.test(html));
}
{
  console.log("\nround 46: every layer drawn in the GLAD-S2 colours, not only its swatch");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const G = new Function("maplibregl", src.slice(src.indexOf("const GLAD_LO = "), src.indexOf("function gladPixels(")) +
    "; return { gladRgb, gladCss, gladValue, gladSalt, GLAD_OUT };")({ addProtocol() {} });
  const hue = (hex) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1;
    let h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); return (h + 360) % 360; };
  const outs = ["#FF0000", "#E7A63B", "#FFFF00", "#00FF00", "#62755F", "#8A4F46", "#FF00FF", "#6A6258"].map((c) => G.gladCss(c, "row"));
  check("every colour a layer draws with lands between neon green and electric blue (round 82b)", outs.every((c) => hue(c) >= 114 && hue(c) <= 221));
  check("classes stay apart and in order: red, orange, yellow, green come out in rising hue",
        hue(outs[0]) < hue(outs[1]) && hue(outs[1]) < hue(outs[2]) && hue(outs[2]) < hue(outs[3]));
  check("near-white, near-black and see-through are left alone", G.gladCss("#FFFFFF", "r") === "#FFFFFF" && G.gladCss("#07100C", "r") === "#07100C" &&
        G.gladCss("rgba(0,0,0,0)", "r") === "rgba(0,0,0,0)" && G.gladCss("rgba(242,238,230,0.85)", "r") === "rgba(242,238,230,0.85)");
  check("a colour is never mapped twice", G.gladCss(outs[0], "row") === outs[0]);
  check("a zoom ramp keeps its shape with its colours mapped; a colour read from each record is mapped as it is drawn",
        (() => { const z = G.gladValue(["interpolate", ["linear"], ["zoom"], 2, "#FF0000", 8, "#00FF00"], "r"); return z[2][0] === "zoom" && hue(z[4]) >= 114 && hue(z[6]) >= 114; })() &&
        (() => { const e = G.gladValue(["coalesce", ["get", "c"], "#FF0000"], "r"); return e[0] === "let" && e[1] === "__glad" && G.gladValue(e, "r") === e; })() &&
        (() => { const m = G.gladValue(["match", ["get", "k"], "a", "#FF0000", "#00FF00"], "r"); return m[2] === "a" && hue(m[3]) >= 114 && hue(m[4]) >= 114; })());
  check("pictures from servers and this site's own archives go through the same mapping, basemaps and plates excepted",
        /tiles = spec\.tiles\.map\(\(t\) => \/\^gladpx:\/\.test\(t\) \? t : `gladpx:\/\/\$\{encodeURIComponent\(salt\)\}\/\$\{t\}`\)/.test(src) &&
        /const GLAD_SKIP_SOURCES = new Set\(\["base", "s2", "hillshade", "labels", "plate-base"\]\)/.test(src) && /GLAD_PM_RASTER\.get\(m\[1\]\)/.test(src));
  check("every layer added and every colour set passes through it", /try \{ layer = gladLayer\(layer\); \}/.test(src) && /v = gladPaint\(id, prop, v\);/.test(src) && /spec = gladSourceSpec\(id, spec\);/.test(src));
  check("the page asks for a fresh script", appVersion(html) >= 46);
}
{
  console.log("\nround 47: Eyes leaves Earth; natural disasters; soil biodiversity; keys under Showing; columns stand up");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the Eyes row leaves Earth as the button does, and coming back unticks it",
        /id: "eyes_craft"[^\n]*route: "leave"/.test(src) && /if \(vis === "visible" && !AWAY\) leaveEarth\(\);/.test(src) &&
        /if \(!c \|\| c\.route !== "leave"\) continue;/.test(src) && /cfg\.route === "leave" \? Promise\.resolve\(\)/.test(src));
  check("the earthquakes are under Destruction > Of the planet > Natural disasters, and nowhere under Base and reference",
        /\{ h: 5, t: "Earthquakes" \}, "usgs_quakes", "haz_ncei_quakes", "skytruth_quakes",/.test(src) && !/"Physical and human geography"/.test(src));
  check("a Soil biodiversity heading under Biodiversity loss holds the Underground Atlas and SoilGrids",
        /\{ h: 4, t: "Soil biodiversity" \}, "soil_spun", ("soil_nematodes", )?("soil_earthworms", )?"soilgrids",/.test(src) && /id: "soil_spun"[^\n]*route: "rasterlive"/.test(src) &&
        /soil\/spun_choices\.json/.test(src) && /if \(!cfg\.choices \|\| !cfg\.choices\.length\) \{ setLayerState/.test(src));
  check("each layer in the Showing box has its colour key indented under it",
        /`<span class="lg-un">\$\{c\.unit \|\| ""\}<\/span><\/div>` \+ legendKeyRows\(c\.id\)/.test(src) && /function legendKeyPairs\(id\)/.test(src) && /function watchKeysForLegend\(\)/.test(src));
  const lk = new Function("document", src.slice(src.indexOf("function legendKeyPairs(id)"), src.indexOf("function legendKeyRows(id)")) + "; return legendKeyPairs;");
  const mk = (bg, text) => ({ style: { backgroundColor: bg }, closest: () => ({ textContent: text }), parentNode: null });
  const fakeBox = { querySelectorAll: (q) => /facet/.test(q) ? [{ querySelectorAll: () => [mk("rgb(1, 2, 3)", " Planted forest "), mk("rgb(1, 2, 3)", "Planted forest"), mk("rgb(4, 5, 6)", "Oil palm")] }] : [] };
  const pairs = lk({ getElementById: () => fakeBox })("forest_management");
  check("\u2026read from the row's key in the layers box, each colour and meaning once", pairs.length === 2 && pairs[0][1] === "Planted forest" && pairs[1][0] === "rgb(4, 5, 6)");
  check("columns stand at least three footprints tall, and the map is not tilted for the reader (round 120b)",
        /Math\.max\(mPerPx \* 1\.5, half \* 2 \* COLUMN_STALK\) \+ Math\.sqrt\(v\)/.test(src) && /const COLUMN_STALK = 3;/.test(src) &&
        !/map\.easeTo\(\{ pitch: COLUMN_TILT, duration: 900 \}\)/.test(src));
  check("Banking on Climate Chaos is mapped: its banks at their headquarters, every figure in the box", /id: "bocc"[^\n]*route: "geojsonlive"/.test(src) &&
        /culprits-tiles-more\/bocc\/banks\.geojson" \}\], nameFrom: \["bank"\]/.test(src) && /  bocc: "The report's league tables/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 47);
}
{
  console.log("\nround 48: rows refiled and taken out; colour scales that can be told apart; the drug and Eyes maps copied whole");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(
    cut("const NUSANTARA_NAMES = {", "/* ---------- a catalogue's layers as rows") +
    cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") +
    "; return { cataloguePlaces, P, AG };")();
  const at = (t) => lib.cataloguePlaces(t, t);
  const P = lib.P, AG = lib.AG;
  check("WWF's terrestrial ecoregions and SBTN's natural lands are under Biodiversity loss",
        at("Terrestrial Ecoregions of the World (WWF) wwf_terrestrial_ecoregions").every((x) => x.startsWith(P + " > Biodiversity loss")) &&
        at("SBTN Natural Lands Map sbtn_natural_lands").every((x) => x.startsWith(P + " > Biodiversity loss")));
  check("the projected change in dry spells is under Water scarcity", at("Projected change in dry spells").join() === P + " > Water scarcity");
  check("the negligible-risk layer is under Deforestation", at("Negligible risk x").join() === P + " > Deforestation > Tree cover loss and alerts > Where clearing is likely");
  check("the palm oil mill sourcing areas are under Palm oil's mills", at("Palm oil mill sourcing areas, 10 km millopbuffer10km_spv").join() === AG + " > By crop > Palm oil > Mills and refineries" &&
        at("Near palm oil mills, 50 km millopbufferol50km_spv").join() === AG + " > By crop > Palm oil > Mills and refineries");
  const out = (t) => at(t).join() === "(taken out)";
  check("WRI's cities vulnerability, UMD's net tree cover change, TODELETE, test dataset, SICAR and Peru's permanent production forests are taken out",
        out("Cities socioeconomic vulnerability (WRI)") && out("Net tree cover change umd_net_tree_cover_change") && out("Todelete (Global Forest Watch gives this dataset no title)") &&
        out("Test dataset 001") && out("Sfb bra sicar (Global Forest Watch gives this dataset no title) sfb_bra_sicar") && out("Permanent production forests — Peru"));
  check("rows not named are where they were", at("Mining concessions gfw_mining_concessions").some((x) => /Mining/.test(x)));
  check("the fur farms have a heading of their own under Meat and agriculture (round 94b; Final Nail's row out in 112b)", /\{ h: 4, t: "Fur farms" \}, "fur_world", "fur_bans",/.test(src));
  const G = new Function("maplibregl", src.slice(src.indexOf("const GLAD_LO = "), src.indexOf("function gladPixels(")) +
    "; return { gladCss, gladValue, GLAD_SPREAD };")({ addProtocol() {} });
  const hue = (hex) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1;
    let h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); return (h + 360) % 360; };
  const light = (hex) => { const n = parseInt(hex.slice(1), 16), v = [(n >> 16), (n >> 8) & 255, n & 255]; return (Math.max(...v) + Math.min(...v)) / 510; };
  const rating = ["step", ["get", "score"], "#1A9850", 3, "#91CF60", 5, "#FEE08B", 7, "#FC8D59", 9, "#D73027"];
  const spread = G.gladValue(rating, "ratings");
  const cols = [2, 4, 6, 8, 10].map((i) => spread[i]);
  check("a rating scale is spread from cyan to violet, in order, and over lightness", spread[0] === "step" &&
        hue(cols[0]) < hue(cols[2]) && hue(cols[2]) < hue(cols[4]) && hue(cols[4]) - hue(cols[0]) > 45 &&
        Math.abs(light(cols[0]) - light(cols[4])) > 0.3);
  check("a key built from the same palette shows the same steps", G.gladCss("#FEE08B", "ratings") === cols[2] && G.gladCss("rgb(215,48,39)", "ratings") === cols[4]);
  const cases = G.gladValue(["case", ["has", "v"], ["step", ["get", "v"], "#aa0000", 1, "#00aa00", 2, "#0000aa"], "#8C877E"], "c2");
  check("a scale inside a has-test is spread too", cases[0] === "case" && cases[2][0] === "step" && new Set([cases[2][2], cases[2][4], cases[2][6]]).size === 3);
  check("the country layers use colour and depth on a log scale, with a key under the row",
        /const STEPS = \["#DCD7CC", "#B8B0A2", "#948B7D", "#6F675B", "#4A443C"\];/.test(src) && /"fill-opacity": \["case", \["==", \["feature-state", key\], null\], 0, 0\.78\]/.test(src));
  const bounds = JSON.parse(fs.readFileSync(path.join(HERE, "data", "boundaries.geojson"), "utf8"));
  check("France and Norway carry their codes, so country layers shade them", ["FRA", "NOR"].every((c) => bounds.features.some((f) => f.properties.iso3 === c && f.id === c)));
  check("a row's swatch shows the colours its places are drawn in", /setRowSwatch\(cfg\.id, swatchFill\(sitemapDrawnColours\(cfg, data\.features\)\)\);/.test(src) &&
        /swatchFill\(sitemapDrawnColours\(cfg, data\.features, v\.k\)\) \|\| cfg\.colour/.test(src));
  check("WRI's land greenhouse gas map is stretched by its own statistics, zeros left clear",
        /const GFW_COG_MEASURED = new Set\(\["wri_land_ghg_monitoring_system"\]\);/.test(src) && /rescale=\$\{lo\},\$\{hi\}/.test(src) &&
        /if \(asset\.how === "cog" && GFW_COG_MEASURED\.has\((d\.id|ds)\)\) asset\.uri \+= await gfwCogScale\(asset\.uri\);/.test(src));
  const reg = JSON.parse(fs.readFileSync(path.join(HERE, "..", "pipeline", "sitemaps", "registry.json"), "utf8")).maps;
  check("the drug map and the Eyes network are read from their pages' own data",
        reg.some((m) => m.id === "capture_map" && m.rich === "capture") && reg.some((m) => m.id === "site_eyes_network" && m.rich === "eyes") &&
        /id: "capture_map"[^\n]*route: "sitemap"[^\n]*noAreaDots: true/.test(src) &&
        fs.existsSync(path.join(HERE, "..", "pipeline", "sitemaps", "rich_maps.py")));
  check("the page asks for this round's script", appVersion(html) >= 48 && /wire\.js\?v=(4[8-9]|[5-9]\d)/.test(html));
}
{
  console.log("\nround 49: Land and territory pared down; LandMark one row with two parts; Global Forest Watch's working files out");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(
    cut("const NUSANTARA_NAMES = {", "/* ---------- a catalogue's layers as rows") +
    cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") +
    "; return { cataloguePlaces };")();
  const at = (t) => lib.cataloguePlaces(t, t).join();
  const LT = "On-planet invasion > Invasion of the living > Invasion of humans";
  const LM = LT + " > Indigenous Peoples' and local communities' lands and territories, worldwide (LandMark, with Brazil's FUNAI)";
  check("LandMark's 2026 areas and points are the two parts of one row",
        at("Lands and territories with known boundaries, as areas, worldwide (LandMark) landmark_ip_lc_and_indicative_poly") === LM &&
        at("Lands and territories with no known boundary, as points, worldwide (LandMark) landmark_ip_lc_and_indicative_points") === LM &&
        /\{ h: 5, bundle: "landmark", colour: "#6A5E66" \}/.test(src));
  const out = (t) => at(t) === "(taken out)";
  check("the older LandMark copies are taken out",
        ["landmark_icls", "landmark_indigenous_and_community_lands", "landmark_indigenous_and_community_lands_points", "landmark_indicative_lands",
         "landmark_indicative_lands_points", "landmark_ip_lc_and_indicative_poly_preprocessed", "gfw_indigenous_community_and_indicative_lands"]
          .every((id) => out(`Indigenous and community lands ${id}`)));
  check("FAO's forestry employment and Nusantara's four social forestry rows are taken out",
        out("FAO Forestry Employment fao_forestry_employment") &&
        ["hk", "hadat", "wiladat", "hd"].every((k) => out(`Customary forest (hutan adat) — Equatorial Asia socialforestry${k}_spv`)));
  check("the tenure indicators stay under Invasion of humans; FUNAI and INCRA are parts of LandMark's layer, the resource rights one layer (round 72)",
        at("LandMark Natural Resource Rights landmark_natural_resource_rights") === "On-planet invasion > Invasion of the living > Invasion of humans > Community rights to natural resources, worldwide and in Cameroon, Equatorial Guinea, Liberia and Namibia (LandMark and Global Forest Watch)" &&
        at("FUNAI Brazil Indigenous Territories funai_bra_indigenous_territories") === LM &&
        at("INCRA Brazil Quilombola Communities incra_bra_quilombola_communities") === "(taken out)" &&
        at("Indicators of Tenure Security in National Law: Local Communities' Land and Resource Rights landmark_tenure_indicators_comm") === LT + " > Quality of laws protecting their land");
  check("Global Forest Watch's working files are taken out, \"To delete\" included",
        out("SDPT Whitelist (iso) gfw_planted_forests_whitelist") && out("Pixel Area gfw_pixel_area") &&
        out("Umd area 2013 umd_area_2013") && out("To delete (Global Forest Watch gives this dataset no title) to_delete"));
  check("the page asks for this round's script", appVersion(html) >= 49 && /wire\.js\?v=(49|[5-9]\d)/.test(html));
}
{
  console.log("\nround 50: WRI's land greenhouse gases split by file; soil nematodes; our own copies of three slow Global Forest Watch datasets");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const parts = new Function(src.slice(src.indexOf("const GFW_COG_SPLIT"), src.indexOf("// The zooms an asset's tiles exist at")) + "; return gfwCogParts;")();
  const cog = (f, st) => ({ asset_type: "COG", status: st || "saved", asset_uri: `s3://gfw-data-lake/wri_land_ghg_monitoring_system/v1.0.3/raster/epsg-4326/cog/${f}.tif` });
  const got = parts({ id: "wri_land_ghg_monitoring_system", title: "x", meta: {} },
    { wri_land_ghg_monitoring_system: [cog("cropland_emissions"), cog("livestock_emissions"), cog("livestock_emissions_per_ha_v3"), cog("net_flux_per_year", "failed")] });
  check("each saved GeoTIFF of WRI's land greenhouse gas system is its own row, named from its file; failed ones are not",
        got.length === 3 && got[0].title === "Cropland emissions, CO2 equivalent (WRI land greenhouse gas monitoring system)" &&
        got[2].title === "Livestock emissions per hectare, CO2 equivalent (WRI land greenhouse gas monitoring system)" &&
        got.every((d) => d.dataset === "wri_land_ghg_monitoring_system" && /^s3:/.test(d.cog)) && new Set(got.map((d) => d.id)).size === 3);
  check("other datasets are left as one row", parts({ id: "other" }, { other: [cog("a"), cog("b")] }).length === 1);
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const NUSANTARA_NAMES = {", "/* ---------- a catalogue's layers as rows") +
    cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces };")();
  const t = "Cropland emissions, CO2 equivalent (WRI land greenhouse gas monitoring system) wri_land_ghg_monitoring_system--cropland_emissions";
  check("the parts sit together as one row with sublayers under Climate",
        lib.cataloguePlaces(t, t).join() === "Destruction > Of the planet > Climate > General > Greenhouse gases from farmland and livestock, CO2 equivalent (WRI land greenhouse gas monitoring system)" &&
        /\{ h: 4, t: "General" \},\n  "group:climate_trace_sectors"[^\n]*\n  \{ h: 5, bundle: "landghg"/.test(src));
  check("a part draws its own GeoTIFF, stretched by its own statistics",
        /const asset = d\.cog \? \{ how: "cog", uri: GFW_COG_TILES \+ encodeURIComponent\(d\.cog\)/.test(src) && /GFW_COG_MEASURED\.has\(ds\)/.test(src));
  check("soil nematodes are under Soil biodiversity, both files of the record drawn",
        /"soil_spun", "soil_nematodes", ("soil_earthworms", )?"soilgrids"/.test(src) && /soil\/nematodes_samples\.geojson/.test(src) && /soil\/nematodes_aggregated\.geojson/.test(src));
  check("the copies of Endemic Bird Areas and Peru's concessions are gone again (GFW refuses the downloads, round 56)", !/copy_(endemic_bird_areas|per_forest|osinfor)/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 50 && /wire\.js\?v=(5\d|[6-9]\d)/.test(html));
}
{
  console.log("\nround 52: the duplicate hotspots row out");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const NUSANTARA_NAMES = {", "/* ---------- a catalogue's layers as rows") +
    cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces };")();
  const t = "Biodiversity hotspots — Global (land only) ci_biodiversity_hotspots";
  check("Global Forest Watch's biodiversity hotspots row is taken out; the Atlas's hotspots row stays",
        lib.cataloguePlaces(t, t).join() === "(taken out)" && /id: "atlas_hotspots"/.test(src));
}
{
  console.log("\nround 55: the earthworm records taken out again (the owner wanted soil biodiversity as a whole)");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("no earthworm row; Soil biodiversity holds the fungi, the nematodes and SoilGrids", !/soil_earthworms/.test(src) && /"soil_spun", "soil_nematodes", "soilgrids",/.test(src));
}
{
  console.log("\nround 54: the Atlas's hotspot pages drawn from their PDFs close in");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const clipOf = new Function(src.slice(src.indexOf("function atlasPageClip("), src.indexOf("function atlasVector(")) + "; return atlasPageClip;")();
  // A page 100 x 50 points laid unturned on a box 0..10 across, 0..5 down.
  const corners = [[0, 0], [10, 0], [10, 5], [0, 5]];
  const c = clipOf(corners, 100, 50, [[2, 1], [4, 1], [4, 2], [2, 2]], 0);
  check("the part of the page in view is found in page points", c && Math.abs(c.u0 - 20) < 1e-9 && Math.abs(c.u1 - 40) < 1e-9 && Math.abs(c.v0 - 10) < 1e-9 && Math.abs(c.v1 - 20) < 1e-9);
  check("and laid back where it lies", [[2, 1], [4, 1], [4, 2], [2, 2]].every((q, i) => Math.abs(c.corners[i][0] - q[0]) < 1e-9 && Math.abs(c.corners[i][1] - q[1]) < 1e-9));
  // Turned a quarter: the page's top runs down the box's left side.
  const turned = clipOf([[0, 0], [0, 10], [5, 10], [5, 0]], 100, 50, [[-1, -1], [9, -1], [9, 11], [-1, 11]], 0);
  check("a turned page is read the right way round, and a view past its edges stops at them", turned && turned.u0 === 0 && turned.u1 === 100 && turned.v0 === 0 && turned.v1 === 50);
  check("a view off the page draws nothing", clipOf(corners, 100, 50, [[20, 20], [30, 20], [30, 30], [20, 30]]) === null);
  check("the hotspot plates are drawn from the copied PDFs by pdf.js, over the pictures",
        /const ATLAS_PDFS = "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/atlas\/pdfs\/";/.test(src) &&
        /if \(what\.plate\) atlasVector\(what\.plate, p,/.test(src) && /map\.off\("moveend", atlasPlateOff\.vec\)/.test(src));
}
{
  console.log("\nround 56: Selected Layers; Base and reference and Buildings out; every layer of a kind on at once");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const kind = new Function(src.slice(src.indexOf("const KIND_POINT"), src.indexOf("function layerKindSwitch(")) + "; return { layerKind, catalogueKind };")();
  check("rows are told apart by how they are drawn",
        kind.layerKind({ route: "pmtiles", unit: "plants" }) === "point" && kind.layerKind({ route: "sitemap", unit: "venues" }) === "point" &&
        kind.layerKind({ route: "country", unit: "Mt" }) === "national" && kind.layerKind({ route: "shapes", unit: "countries" }) === "national" &&
        kind.layerKind({ route: "shapes", unit: "routes" }) === "shape" && kind.layerKind({ route: "rasterlive", unit: "30 m" }) === "shape" &&
        kind.layerKind({ route: "geojsonlive", unit: "countries" }) === "national" && kind.layerKind({ route: "arcgisapp", unit: "biodiversity hotspots" }) === "shape" &&
        kind.layerKind({ route: "companion", unit: "opens the page itself in a panel" }) === "");
  check("catalogue rows carry a kind too",
        kind.catalogueKind({ route: "trase" }, { title: "x" }) === "national" && kind.catalogueKind({ route: "wmsmenu" }, { title: "Palm oil mills" }) === "point" &&
        kind.catalogueKind({ route: "wmsmenu" }, { title: "Logging concessions" }) === "shape" && kind.catalogueKind({ route: "gfwmenu" }, { title: "x", kind: "shape" }) === "shape" &&
        /data-kind="\$\{escapeHtml\(catalogueKind\(cfg, item\)\)\}"/.test(src));
  check("three switches, any of them together, ticking a few rows at a time",
        /\["point", "Points"\], \["shape", "Shapes"\], \["national", "National highlights"\]/.test(src) && /queue\.splice\(0, 8\)/.test(src) && /  layerKindSwitch\(box\);/.test(src));
  check("Selected Layers is one layer above everything (round 60)", /const PANEL_ORDER = \[\n[^\n]*\n[^\n]*\n  \{ h: 1, bundle: "selected", colour: "#5E6470" \},\n(?:  \/\/[^\n]*\n)*(?:  \{ h: 1, t: "Where the threat is greatest" \}[^\n]*\n(?:  "ai_threat[^\n]*\n)?)?  \{ h: 1, t: "On-planet invasion" \},/.test(src));
}
{
  console.log("\nround 57: kinds by what is drawn, a loading line, columns that keep up with the zoom, no purple on country layers or the hologram");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const kind = new Function(src.slice(src.indexOf("const KIND_POINT"), src.indexOf("function layerKindSwitch(")) + "; return { layerKind, catalogueKind, drawnKind };")();
  check("FracTracker's basins map and buffers round mills are shapes",
        kind.layerKind({ id: "fractracker_refineries", route: "arcgisapp", unit: "refineries" }) === "shape" &&
        kind.catalogueKind({ route: "wmsmenu" }, { title: "millopbufferol_spv" }) === "shape" &&
        kind.catalogueKind({ route: "wmsmenu" }, { title: "Near palm oil mills, 50 km" }) === "shape" &&
        kind.catalogueKind({ route: "wmsmenu" }, { title: "Palm oil mills" }) === "point");
  check("a drawn row's kind is read from its layers: marks make it points, areas alone a shape",
        kind.drawnKind("a", [{ id: "a-fill", type: "fill" }, { id: "a-line", type: "line" }]) === "shape" &&
        kind.drawnKind("a", [{ id: "a-fill", type: "fill" }, { id: "a-pt", type: "circle" }]) === "both" &&
        kind.drawnKind("a", [{ id: "a-pt", type: "circle" }, { id: "a-pt-soft", type: "circle" }]) === "point" &&
        kind.drawnKind("a", [{ id: "ab-pt", type: "circle" }]) === "" &&
        /KIND_SEEN\.get\(id\) \|\| layerKind\(cfgs\.get\(id\)\)/.test(src));
  check("bulk ticking shows how far it has got, holds the legend until the end, and says when it is drawn",
        /Turning \$\{verb\} \$\{Math\.min\(done, total\)\.toLocaleString\(\)\} of/.test(src) && /class="ks-spin"/.test(src) &&
        /if \(legendHold\) \{ legendHeld = true; return; \}/.test(src) && /map\.once\("idle", stop\)/.test(src));
  const H = new Function(src.slice(src.indexOf("const COLUMN_HEIGHT"), src.indexOf("function ctColumnCfgs(")) + "; return COLUMN_HEIGHT;")();
  const at = (z) => { let lo = 3; while (lo + 2 < H.length - 2 && H[lo + 2] <= z) lo += 2; const [za, zb] = [H[lo], H[lo + 2]];
    const val = (e) => typeof e[1] === "string" ? 1 : e[2]; const t = (Math.pow(0.5, z - za) - 1) / (Math.pow(0.5, zb - za) - 1);
    return val(H[lo + 1]) + (val(H[lo + 3]) - val(H[lo + 1])) * t; };
  check("a column's height halves with each zoom level, smoothly, between redraws",
        H[1][0] === "exponential" && H[1][1] === 0.5 && [0, 3.3, 7.5, 14.2, 20].every((z) => Math.abs(at(z) / Math.pow(2, -z) - 1) < 1e-9) &&
        /"fill-extrusion-height": COLUMN_HEIGHT/.test(src) && /map\.on\("zoom", columnsOnZoom\)/.test(src) &&
        /e\.isSourceLoaded && !\(typeof map\.isMoving === "function" && map\.isMoving\(\)\)/.test(src));
  const G = new Function("maplibregl", src.slice(src.indexOf("const GLAD_LO = "), src.indexOf("function gladPixels(")) +
    "; return { gladCss, gladValue, GLAD_NATIONAL };")({ addProtocol() {} });
  const hue = (hex) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1;
    let h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); return (h + 360) % 360; };
  G.GLAD_NATIONAL.add("nat");
  const steps = G.gladValue(["interpolate", ["linear"], ["get", "t"], 0, "#DCD7CC", 0.25, "#B8B0A2", 0.5, "#948B7D", 0.75, "#6F675B", 1, "#4A443C"], "nat");
  const cols = [4, 6, 8, 10, 12].map((i) => steps[i]);
  check("a country layer's five steps run teal to blue (round 85b), still told apart",
        cols.every((c) => hue(c) >= 168 && hue(c) <= 215) && new Set(cols).size === 5 && ["#FF00FF", "#8A4F46", "#6A6258"].every((c) => { const h = hue(G.gladCss(c, "nat")); return h >= 168 && h <= 215; }));
  check("country rows are named for it when the rows are read", /\["giga", "country", "owidgrapher", "trase"(, "gta", "rte")?\]\.includes\(c\.route\)/.test(src));
  check("the hologram keeps its own blues: its layers are not remapped, and its fringe and ground are not purple",
        /\|holo-\.\*(\|[a-z.*-]+)*\)\$\/;/.test(src) && /--holo-fringe: #6fb0bd;/.test(html) && /--holo-bg:     #081729;/.test(html) && !/#8e86c8/.test(html));
  check("the page asks for this round's script", appVersion(html) >= 57);
}
{
  console.log("\nround 58: kinds by what is drawn both ways, field names across, country layers shaded by their figures, kilns in place, worlds on the flat map, shared point files");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const kind = new Function(src.slice(src.indexOf("const KIND_POINT"), src.indexOf("function layerKindSwitch(")) + "; return { layerKind, catalogueKind, drawnKind };")();
  check("words no longer make points into shapes: a points archive counted in concessions or basins stays with the points unless it draws areas",
        kind.layerKind({ id: "x", route: "pmtiles", unit: "oil and gas basins" }) === "point" &&
        kind.catalogueKind({ route: "wmsmenu" }, { title: "Palm oil mills near the coast" }) === "point" &&
        kind.catalogueKind({ route: "wmsmenu" }, { title: "Near palm oil mills, 50 km" }) === "shape" &&
        /const wrong = national \|\| \(as === "point" \? k === "shape" : k === "point"\);/.test(src));
  check("a field name in a box is never squeezed to a letter a line", /\.maplibregl-popup th,\.leaflet-popup-content th,table\.meta th\{min-width:6em\}/.test(html));
  const S = new Function("loadShapeDetails", src.slice(src.indexOf("const SHAPE_STEPS"), src.indexOf("function shapeKey(")) +
    "; return { SHAPE_COLOUR_BY, shapeValues, shapeColouring };")(async () => ({ 0: { list: "x, 13.0 people per 1,000. y" }, 1: { list: "2.5 people per 1,000" } }));
  const data = { features: [{ properties: { _k: "0" } }, { properties: { _k: "1" } }, { properties: {} }] };
  await S.shapeValues("u", data, S.SHAPE_COLOUR_BY.slavery_prevalence);
  const sc = S.shapeColouring(S.SHAPE_COLOUR_BY.slavery_prevalence[0], data);
  check("the slavery estimates are shaded by people per 1,000, read from each country's write-up, with a five-step key",
        data.features[0].properties.per_1000 === 13 && data.features[1].properties.per_1000 === 2.5 && data.features[2].properties.per_1000 === undefined &&
        sc.expr[0] === "case" && sc.key.length === 5 && /13/.test(sc.key[4][1]));
  const reg = S.shapeColouring(S.SHAPE_COLOUR_BY.gmo_regime[0], { features: [{ properties: { regime: "trait" } }] });
  check("the regimes are shaded by class, in the map's own words, a colour each",
        reg.expr[0] === "match" && reg.key.map((k) => k[1]).join("|") === "Technique-based|Technique-based, with a carve-out|Trait-based" && new Set(reg.key.map((k) => k[0])).size === 3);
  const td = { features: [{ properties: { cartagena: true, nagoya_kl: true, upov91: false, upov78: false, plant_treaty: true } }] };
  await S.shapeValues("u", td, S.SHAPE_COLOUR_BY.gmo_treaties);
  const tc = S.shapeColouring(S.SHAPE_COLOUR_BY.gmo_treaties[6], td);
  check("the treaties can be shaded treaty by treaty or by how many of the five, picked in the key",
        td.features[0].properties._treaties === 3 && tc.key.length === 6 && tc.key[0][1] === "none" && tc.key[5][1] === "all 5" &&
        S.SHAPE_COLOUR_BY.gmo_treaties.length === 7 && /select data-shape-by=/.test(src) && /GLAD_NATIONAL\.add\(cfg\.id\)/.test(src));
  check("the brick kilns come from the copy that places each kiln in its own box, the old copy standing in until it is built",
        /archiveUrl: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/tiles\/slavery_sites\.pmtiles",\n    archiveBefore: `\$\{TILE_BASE\}\/slavery_sites\.pmtiles`/.test(src) &&
        /if \(!head\.ok && cfg\.archiveBefore\)/.test(src));
  check("the worlds show on the flat map too, and the map pulls back to them when they are turned on",
        /const flat = drawnProjection\(\) === "mercator";/.test(src) && /if \(on && !was\) pullBack\(\);/.test(src));
  check("rows the Points switch turns on read their points from a shared file when there is one",
        /const POINT_BUNDLES_URL = "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/bundles\/points\.json";/.test(src) &&
        /const src = bundle \? `points-bundle-\$\{bundle\.n\}` : `\$\{owner\}-src`;/.test(src) &&
        /if \(owner && POINT_BUNDLE_OF\.has\(owner\) && !el\.checked\) POINT_BUNDLE_USE\.add\(owner\);/.test(src) &&
        /fetch\(ownUrl\.replace\(\/\\\.pmtiles\$\/, "\.build\.json"\)\)/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 58);
}
{
  console.log("\nround 59: a magnifier on the asteroid ring, UAP squares, leaving Earth on purpose, visible findings, the satellite land tint, Indigenous conflicts as one layer, Land and territory moved");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("where asteroid marks bunch, a lens shows them apart and a click holds it to pick from",
        /const LENS_R = 90, LENS_K = 4, CROWD_PX = 16;/.test(src) && /lens = \{ x: e\.point\.x, y: e\.point\.y \}; hover = null;/.test(src) && /if \(inLens\(pt\)\) \{/.test(src));
  check("the UAP rows read the summed squares at wide views and offer to zoom in to them",
        /if \(!\(st\.format >= 2\)\)/.test(src) && /const squares = here\.filter\(\(f\) => f\.properties\.sq\);/.test(src) && /Zoom in to them/.test(src));
  check("leaving Earth needs a second, separate scroll outward at the edge, with a line saying so",
        /const LEAVE_GAP_MS = 250;/.test(src) && /Scroll out once more to leave Earth/.test(src) && !/if \(wasAbove && z <= edge\(\) \+ 0\.02\)/.test(src));
  check("dots of layers with no amounts are never under 2 pixels, and the Unearthings findings glow in full",
        /0,  \["max", 2, \["\*", 0\.18 \* scale, MAGNITUDE_RADIUS\]\]/.test(src) && /"aquaculture_ponds", "remains_findings"\]/.test(src));
  check("the satellite land tint keeps its own earth tones",
        /\|holo-\.\*\|sat-relief-colour(\|[a-z.*-]+)*\)\$\//.test(src));
  const o = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("];", src.indexOf("const PANEL_ORDER = [")) + 2) + "; return { PANEL_ORDER };")();
  const order = o.PANEL_ORDER;
  const at = (t) => order.findIndex((x) => x && (x.t === t || x.bundle === t));
  check("Indigenous Environmental Conflicts is one layer with its kinds under it, beside LandMark, under Invasion of humans",
        at("indigenous_conflicts") > at("Invasion of humans") && order[at("indigenous_conflicts") + 1] === "site_indigenous_conflicts" &&
        at("landmark") > at("Invasion of humans") && at("landmark") < at("Of countries by countries") && at("Land and territory") === -1 &&
        /indigenous_conflicts: "Indigenous Environmental Conflicts",/.test(src) && /\[data-cat\], \[data-smtype\]/.test(src));
  check("the Land Matrix is under Meat and agriculture; the old Land and territory paths now lead to Invasion of humans",
        order.indexOf("land_matrix") > at("Meat and agriculture") && order.indexOf("land_matrix") < at("Agriculture") && !/Suppression > Of humans > Land and territory/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 59);
}
{
  console.log("\nround 60: Selected Layers on top, the living and the after-life, one arrow only where there is more to show, no empty rhythm notes");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the two invasions of people are named for the living and the after-life",
        /\{ h: 2, t: "Invasion of the living" \}/.test(src) && /\{ h: 2, t: "Invasion of the after-life" \}, "remains_records"/.test(src) &&
        !/Post-birth invasion|Post-life invasion/.test(src.replace(/\/\/[^\n]*/g, "")));
  check("folding leaves the transparency bar in place", /filter\(\(n\) => !n\.classList\.contains\("row-tools"\)\)\.forEach\(\(n\) => n\.classList\.toggle\("fold-hide", folded\)\)/.test(src));
  check("no dotted grip where a mouse can drag the row itself", /@media \(pointer:fine\)\{#layers \.grip\{display:none\}\}/.test(src));
  check("a row whose copy has no stated rhythm carries no note", !/no set rhythm"/.test(src) && /return t \? `<span class="refresh">/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 60);
}
{
  console.log("\nround 61: the build queue never stalls, Bankrolling Extinction's banks, the Atlas conflicts pages, names");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("a layer still building after 15 s gives up its place in the queue", /const QUEUE_SLOT_MS = 15000;/.test(src) &&
        /const slow = setTimeout\(free, QUEUE_SLOT_MS\);/.test(src) && /\.then\(\(\) => \{ clearTimeout\(slow\); free\(\); \}\);/.test(src));
  check("Bankrolling Extinction's 50 banks are a row at their headquarters, their measured amounts said to be measured",
        /id: "pe_banks"[^\n]*route: "geojsonlive"/.test(src) && /culprits-tiles-more\/pe\/banks\.geojson/.test(src) && /measured from the length of its bars/.test(src) &&
        /"Companies and financiers" \}, "pe_bankrolling", "pe_banks",/.test(src));   // round 100b: Subsidising Extinction's page replaced
  check("an opened hotspot shows its conflicts page over page 1 and a mark per city opening its inset",
        /if \(what\.plate\) atlasInsets\(what\.plate\);/.test(src) && /map\.addLayer\(\{ id: "atlas-plate-conflicts", type: "raster"/.test(src) &&
        /new maplibregl\.Marker\(\{ element: el \}\)/.test(src) && /for \(const m of atlasInsets\.markers \|\| \[\]\) m\.remove\(\);/.test(src));
  const t = new Function(src.match(/function siteTypeTitle[^\n]*\n/)[0] + "; return siteTypeTitle;")();
  check("the enslavement and insentient maps' kinds read as the kind alone; other maps keep their name after it",
        t("Yeast", "The Unnecessary Enslavement of Microorganisms 2026", "site_enslaved_microbes") === "Yeast" &&
        t("Yeast", "X", "site_world_news") === "Yeast" && t("Yeast", "X", "site_rodeo") === "Yeast — X");
  check("rows renamed: Animal Fighting Locations, Animal Tourism, Global Rodeo & Charreada; Zoos and Aquariums under Spectacle and sport, keeping its name",
        /name: "Animal Fighting Locations",/.test(src) && /name: "Animal Tourism",/.test(src) && /name: "Global Rodeo & Charreada",/.test(src) &&
        /id: "mymaps_supp_b", name: "Zoos", fixedName: true/.test(src) && /"site_animal_tourism", "mymaps_supp_b",/.test(src) &&
        /if \(!cfg\.fixedName\) relabelRow\(cfg\.id, got\.title\);/.test(src));
  check("a read with no answer is tried once more with twice the time; uMap's settings come from the daily copy first",
        /if \(!\/\^no answer in\/\.test\(e\.message\)\) throw e;\n    return getJsonOnce\(url, ms \* 2\);/.test(src) &&
        /culprits-tiles-more\/umap\/\$\{cfg\.umapId\}\/map\.json/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 61);
}
{
  console.log("\nround 62: every layer straight under Of animals, keys for shaded layers, figures for earmarked funding and trade profits, stronger steps, Global Trade Alert in words, trade flows by tier, routes untangled, agencies without their background, people on the spheres' links, the dynasties' charts");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER"), src.indexOf("];", src.indexOf("const PANEL_ORDER")) + 2);
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  const oa = order.findIndex((x, i) => x && x.t === "Of animals" && order[i + 1] === "gmo_animal_research");
  const next = order.findIndex((x, i) => i > oa && x && typeof x === "object" && x.h <= 2);
  const under = order.slice(oa + 1, next);
  check("Of animals holds its layers directly, no sub-headings, Zoos among them",
        under.every((x) => typeof x === "string") && ["gmo_animal_research", "site_animal_fighting", "site_rodeo", "mymaps_supp_b", "mymaps_supp_a"].every((id) => under.includes(id)) &&
        /id: "mymaps_supp_b", name: "Zoos", fixedName: true/.test(src));
  check("resourcetrade.earth heads the Trade list", /\{ h: 5, t: "Trade" \}, "rte_trade",/.test(src));
  const im = new Function("escapeHtml", src.match(/function infoMark\([\s\S]*?\n\}\n/)[0] + "; return infoMark;")(String);
  check("an info bubble that only names where a layer came from is not drawn",
        im("From the Suppression page's network map of eyes.") === "" && im("From local-map's X map.") === "" && im("Giga's own figures.") !== "");
  const S = new Function(src.slice(src.indexOf("const SHAPE_STEPS"), src.indexOf("function shapeKey(")) + "; return { SHAPE_COLOUR_BY, shapeValues, shapeColouring, shapeStepColour };")();
  const earm = S.SHAPE_COLOUR_BY.site_earmarked_funding;
  const feats = [{ properties: { donor_amount: "$19,522M donated", recipient_amount: "No data" } }, { properties: { donor_amount: "Not a donor country", recipient_amount: "$195M received" } }];
  S.shapeValues("", { features: feats }, earm);
  check("earmarked funding is shaded by the sums the map writes, donated or received",
        feats[0].properties._donated === 19522 && feats[1].properties._received === 195 && feats[0].properties._received === undefined && earm.length === 2 && earm.every((b) => b.scale === "log"));
  const tp = S.SHAPE_COLOUR_BY.site_trade_profits[0];
  const page = `const D = {"MAR":{n:"Morocco",f:25.3,d:74.7},"LAO":{n:"Lao PDR",f:12.3,d:87.7}};`;
  const got = [...page.matchAll(tp.fromPage.re)].map((m) => [m[1], Number(m[2])]);
  const c = S.shapeColouring(tp, { features: [] });
  check("trade profits read the source map's own figures and steps (under 10 % to 50 % or more)",
        JSON.stringify(got) === '[["MAR",25.3],["LAO",12.3]]' && tp.fromPage.keys.includes("ISO_A3") && c.key.length === 9 && c.key[0][1] === "under 10%" && c.key[8][1] === "50% or more" && c.expr[2][0] === "step");
  check("a layer of one colour gets a one-colour key; per-country counts shade the government maps",
        JSON.stringify(S.shapeColouring({ single: "x", colour: "#123456" }, { features: [] }).key) === '[["#123456","x"]]' &&
        /by = \[\{ label: "entries the source lists for each", field: "entries", scale: "log"/.test(src));
  const G = new Function("maplibregl", src.slice(src.indexOf("const GLAD_LO = "), src.indexOf("function gladPixels(")) +
    "; return { gladValue, GLAD_NATIONAL };")({ addProtocol() {} });
  G.GLAD_NATIONAL.add("n62");
  const ramp = ["#E3D9CF", "#C9B3A5", "#AC8A7B", "#8A6356", "#5F3F36"];
  const m = G.gladValue(["match", ["get", "iso"], "AAA", ramp[4], "BBB", ramp[0], "CCC", ramp[2], "rgba(0,0,0,0)"], "n62");
  const L = (h) => { const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (Math.max(r, g, b) + Math.min(r, g, b)) / 510; };
  const RS = new Function(src.match(/const GLAD_RAMP_STEPS = [^\n]*\n/)[0] + src.match(/const OWID_RAMP = [^\n]*\n/)[0] + src.match(/const SHAPE_STEPS = [^\n]*\n/)[0] + "; return [GLAD_RAMP_STEPS, OWID_RAMP, SHAPE_STEPS];")();
  check("countries matched by name to a ramp keep the ramp's order, lightest to darkest",
        L(m[5]) > L(m[7]) && L(m[7]) > L(m[3]) && [...RS[1], ...RS[2]].every((c) => RS[0].has(c)));
  check("Global Trade Alert's ratings are in its own words, not colours, with what a state act is",
        !/Rated Red|Rated Amber|Rated Green/.test(src) && /Almost certainly discriminates|almost certainly discriminates against foreign commercial interests/.test(src) &&
        /A state act is one announcement of a policy by a government/.test(src) && /Harmful, likely/.test(src) && /Liberalising/.test(src));
  const rp = new Function(src.match(/function rankPairs\([\s\S]*?\n\}\n/)[0] + "; return rankPairs;")();
  check("a ranking's key leaves out empty steps", rp([1, 1, 1, 5, 9], [1, 5], ["a", "b", "c"], String).map((x) => x[1]).join("|") === "1 to under 5|5 or more");
  check("trade flows: five tiers by value, each its own width and depth, largest on top, a key, and a menu for the largest",
        /const RTE_W = \[0\.5, 1, 1\.7, 2\.6, 4\]/.test(src) && /"line-sort-key": tier/.test(src) && /data-rte-keep/.test(src) && /line \$\{\["thinnest", "thin", "middling", "wide", "widest"\]\[t\]\}/.test(src));
  check("trafficking routes: curves, width by people, largest on top, menus for the least people and one country, opening at 100 or more",
        /routes: \{ field: "n", from: "from", to: "to", least: \[1, 10, 100, 1000\] \}/.test(src) && /g\.coordinates = rteArc\(g\.coordinates\[0\], g\.coordinates\[1\]\)/.test(src) &&
        /function shapeRoutes\(cfg, data\)/.test(src) && /start\.value = "100"/.test(src));
  check("lines between countries and Global Trade Alert keep to cyan and blue", /\["giga", "country", "owidgrapher", "trase", "gta", "rte"\]\.includes\(c\.route\) \|\| c\.routes/.test(src));
  check("export credit agencies: the places alone, keyed by the source's own marker colours",
        /pointsOnly: true,/.test(src) && /if \(cfg\.pointsOnly\) data = /.test(src) && /"OECD Arrangement participant"/.test(src) && /if \(cfg\.key\) rowKey\(cfg\.id, cfg\.key, cfg\.keyHint\);/.test(src));
  check("the social spheres' links name the people in both", /who: \(e\.via \|\| \[\]\)\.map\(\(id\) => P\.get\(id\) \|\| id\)\.join/.test(src) && /String\(p\.who\)\.split/.test(src));
  // Round 105b: the timeline opens from a button under the dynasties' own row.
  check("the banking dynasties' timeline and charts open from their row, from the copy in culprits-tiles-more",
        /timeline: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/pages\/banking_dynasties\.html"/.test(src) && /if \(cfg\.timeline\) sitemapTimelineButton\(cfg\);/.test(src) &&
        !order.includes("site_banking_dynasties_charts"));
  check("Giga's and Global Trade Alert's shading have keys", (src.match(/key\.dataset\.keyFor = cfg\.id;/g) || []).length >= 3);
  check("the page asks for this round's script", appVersion(html) >= 62);
}
{
  console.log("\nround 63: every row live or not live, the worlds round the flat map, policy rates and current accounts in place of CFR's trackers");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("a site map's kind rows and Guerillamap's row carry a mark",
        /siteTypeTitle\(\(cfg\.typeTitles \|\| \{\}\)\[v\.label\] \|\| v\.label, mapName\.trim\(\), cfg\.id\)\)\}\$\{liveMark\(cfg\)\}/.test(src) && /Guerillamap overlays<span class="live"/.test(src));
  check("a layer with sublayers says live, not live, or how many of each; category headings say nothing (round 72)",
        /function headingLiveMark\(sec\)/.test(src) && /headingLiveMark\(sec\);/.test(src) && /if \(!\/toc-bundle\/\.test\(sec\.className\)\)/.test(src) &&
        /LIVE \$\{live\}/.test(src) && /NOT LIVE \$\{copy\}/.test(src) && /#layers \.toc-live \.live\{/.test(html));
  check("the dynasties' copy says not live; the worlds, read from their page, say live",
        /site_banking_dynasties_charts: "The Suppression page's own banking dynasties section, from a copy made once/.test(src) && /"worldsring",\n(  \/\/[^\n]*\n  "no2relief",\n)?\]\);/.test(src));
  check("the flat map may pull back into space while the worlds are shown, and is held again after",
        /transformConstrain: flatConstrain,/.test(src) && /if \(FREE_FLAT\) return \{ center: new maplibregl\.LngLat/.test(src) &&
        /return t\.defaultConstrain\(lngLat, zoom\);/.test(src) && /const free = \(\) => freeFlatFor\(cfg\.id, on && drawnProjection\(\) === "mercator"\);/.test(src));
  check("round the flat map, each world is placed out from the world's edge by its distance, with a line back",
        /const tl = map\.project\(\[-180, 85\.05\]\), br = map\.project\(\[180, -85\.05\]\);/.test(src) &&
        /const d = lo \+ \(hi - lo\) \* Math\.max\(0, Math\.min\(1, Number\(wd\.logX\) \|\| 0\)\);/.test(src) && /g\.setLineDash\(\[2, 4\]\)/.test(src) &&
        /map\.easeTo\(\{ center: \[0, 0\], zoom: z, pitch: 0, bearing: 0/.test(src));
  const T = new Function(src.slice(src.indexOf("const TRACKER_SEQ"), src.indexOf("async function addTrackerLayer(")) + "; return { TRACKER_MEASURES, trackerClass, trackerYearBefore, trackerValue };")();
  const rate = T.TRACKER_MEASURES.rates[0], chg = T.TRACKER_MEASURES.rates[1], ca = T.TRACKER_MEASURES.imbalances[0];
  check("policy rate steps: below 0 to 20% or more", T.trackerClass(rate, -0.5) === 0 && T.trackerClass(rate, 0) === 1 && T.trackerClass(rate, 25) === 6 && rate.names.length === rate.colours.length);
  check("a rate's change over twelve months: unchanged is its own step",
        T.trackerYearBefore("2024-03") === "2023-03" && chg.names[T.trackerClass(chg, 0)] === "unchanged" && chg.names[T.trackerClass(chg, -0.25)] === "cut by less than 0.5" && chg.names[T.trackerClass(chg, 3)] === "raised by 2 points or more");
  const d = { countries: { USA: { rates: { "2023-03": 4.75, "2024-03": 5.33 } }, DEU: { BCA_NGDPD: { "2024": 6.2 } } } };
  check("figures are read for the month or year chosen, and nothing is made up where there is none",
        T.trackerValue({ kind: "rates" }, d, "USA", chg, "2024-03") === 0.58 && T.trackerValue({ kind: "rates" }, d, "USA", chg, "2024-04") === null &&
        // Round 118b: surplus and deficit are chosen one at a time, each by its size.
        T.trackerValue({ kind: "imbalances" }, d, "DEU", ca, "2024") === 6.2 && ca.names[T.trackerClass(ca, 6.2)] === "surplus of 5 to 10%" &&
        T.trackerValue({ kind: "imbalances" }, d, "DEU", T.TRACKER_MEASURES.imbalances[1], "2024") === null &&
        T.TRACKER_MEASURES.imbalances[1].names[T.trackerClass(T.TRACKER_MEASURES.imbalances[1], 1)] === "deficit under 2% of GDP");
  check("the two tracker rows read the daily copies, keep their own colours, and sit beside CFR's",
        /id: "policy_rates",[^\n]*route: "tracker"[^\n]*keepColour: true/.test(src) && /culprits-tiles-more\/trackers\/policy_rates\.json/.test(src) &&
        /id: "imbalances",[^\n]*route: "tracker"/.test(src) && /"policy_rates", "imbalances",/.test(src) &&
        /: cfg\.route === "tracker" \? addTrackerLayer\(cfg\)/.test(src) && /if \(salt && gladKept\(salt\)\) continue;/.test(src));
  check("no violet or purple in the trackers' colours", [...new Set([...T.TRACKER_MEASURES.rates, ...T.TRACKER_MEASURES.imbalances].flatMap((m) => m.colours))].every((h) => {
    const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn;
    if (dd < 12) return true; let hue = mx === r ? 60 * (((g - b) / dd) % 6) : mx === g ? 60 * ((b - r) / dd + 2) : 60 * ((r - g) / dd + 4); hue = (hue + 360) % 360;
    return hue >= 160 && hue <= 236 || (hue < 60 && dd < 30); }));
  check("the page asks for this round's script", appVersion(html) >= 63);
}
{
  console.log("\nround 64: every colour key reaches the Showing box");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the Showing box reads a site map's Colour by key, the building kinds and the social spheres' kinds",
        /\.facet\[data-colour-for="\$\{esc\}"\], \.facet\[data-kinds="\$\{esc\}"\]/.test(src) && /el\.dataset\.keyFor = cfg\.id;   \/\/ its kinds' colours are its key/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 64);
}
{
  console.log("\nround 65: the dynasties' missing cities named in the row, keys read with their counts apart");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the dynasties row says its 11 cities are placed hollow at the city", /the 11 cities its list gives a family without a coordinate, drawn hollow at the city/.test(src));
  check("a key's words keep a space between a kind and its count", /parts\.map\(\(n\) => n\.textContent \|\| ""\)\.join\(" "\)/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 65);
}
{
  console.log("\nround 71: the Genetic engineering map's own boxes and records; hologram as a basemap; the sea's own navies; Buildings back");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const a = src.indexOf("/* ---------- the Genetic engineering map's own boxes"), b = src.indexOf("\nfunction setLayerState(id, text) {");
  const esc = src.slice(src.indexOf("function escapeHtml(s) {"), src.indexOf("\n}\n", src.indexOf("function escapeHtml(s) {")) + 2);
  const G = new Function("visibility", "facetState", "LAYERS", "map", "readPiece", "maplibregl", "document",
    esc + "\nlet popupClaimedBy = null;\n" + src.slice(a, b) +
    "; return { GMO_PICK, gmoKind, gmoShown, gmoTally, gmoTree, gmoPlace, gmoRecordHtml, gmoLabel, gmoPlaceNote };");
  const vis = new Map([["gmo_decisions", "visible"]]);
  const lay = [{ id: "gmo_industry", facet: { property: "x_src" } }];
  const fs2 = new Map();
  const T = G(vis, fs2, lay, { on() {} }, () => Promise.reject(new Error("no")), {}, undefined);
  const dec = { name: "Commission Implementing Decision (EU) 2026/2117", source: "bch:decision", type: "soybean, national biosafety decision", state: "EU", date: "2026-09-23", precise: false,
    desc: "A decision on a living modified organism, filed by the country itself.", url: "https://bch.cbd.int/x" };
  const permit = { name: "93-120-18n — Potato", source: "aphis:epermits", type: "Potato, environmental release", state: "ID, ND", desc: "Notification [CBI].", size: "2 declared release locations", status: "Acknowledged" };
  const firm = { name: "Bayer Crop Science", source: "industry:seed", type: "Seed & trait company", state: "Monheim" };
  check("every register row's test on a record matches its filter on the tiles",
        T.GMO_PICK.gmo_decisions(dec) && !T.GMO_PICK.gmo_decisions(permit) && T.GMO_PICK.gmo_env(permit) && T.GMO_PICK.gmo_industry(firm) &&
        !T.GMO_PICK.gmo_industry({ source: "industry:repro" }) && T.GMO_PICK.gmo_escapes({ source: "escape:crop" }) && T.GMO_PICK.gmo_ogtr({ source: "ogtr:DIR-201" }));
  check("a record is listed only when its row is ticked, and inside the row's chosen lenses",
        T.gmoShown(dec) && !T.gmoShown(permit) && !T.gmoShown(firm) &&
        (vis.set("gmo_industry", "visible"), T.gmoShown(firm)) && (fs2.set("gmo_industry", new Set(["industry:rules"])), !T.gmoShown(firm)));
  check("the kinds and their counts are the map's own", T.gmoKind(dec) === "biosafety" && T.gmoKind(permit) === "release" && T.gmoKind(firm) === "industry" &&
        T.gmoTally([dec, dec, permit]) === "2 biosafety decisions · 1 release authorisation");
  const tree = T.gmoTree([dec, permit, { ...dec, type: "maize, national biosafety decision" }]);
  check("a list is grouped by the type's category, then its organism", tree[0][0] === "National biosafety decision" && tree[0][1].get("Soybean").length === 1 && tree[0][1].get("Maize").length === 1);
  check("a pile is named after its place", T.gmoPlace([dec, dec]) === "European Union" && T.gmoPlace([permit]) === "Idaho");
  const box = T.gmoRecordHtml(permit);
  check("a record's box carries its description, the [CBI] note, the scale note and the Dig deeper links",
        /Notification \[CBI\]\./.test(box) && /confidential business information/.test(box) && /Sorting aid, not a measurement/.test(box) && /Dig deeper/.test(box) &&
        /Town or region only/.test(T.gmoRecordHtml(dec)) && /filed by the country itself/.test(T.gmoRecordHtml(dec)));
  check("the note over a list says why its records sit where they do", /Cartagena Protocol apply to a whole country/.test(T.gmoPlaceNote([dec])));
  check("the registers' rows filter on the record's register, not its id, and open the map's own boxes",
        /where: \["==", \["coalesce", \["get", "x_src"\], \["get", "id"\]\], "bch:decision"\]/.test(src) &&
        /\} else if \(owner === "gmo_releases"\) \{\n[^\n]*\n[^\n]*\n    bindGmoPopup\(`\$\{cfg\.id\}-agg`\);/.test(src) && /readPiece\(GMO_PIECES, p\.x_at\)/.test(src));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  check("the map's organisations and its escapes are rows under Genetic engineering",
        /"gmo_ogtr", "gmo_industry", "gmo_escapes", "gmo_cultivation"/.test(src) && /id:"gmo_industry"[^\n]*route:"geojsonlive"[^\n]*buildScript: "gmo_seed"/.test(src) && /id:"gmo_escapes"[^\n]*route:"geojsonlive"[^\n]*buildScript: "gmo_seed"/.test(src) &&
        !/name:"[^"]*:[^"]*\(Genetic engineering map\)"/.test(src));
  check("Buildings is back, last in the box", o.PANEL_ORDER[o.PANEL_ORDER.length - 2] === "building_types" && !o.PANEL_REMOVED.has("building_types"));
  check("the Satellite basemap's sea layers keep their own navies, not the mapped blues",
        /\|sat-relief-seabed\|sat-relief-sea\|holo-\.\*\|sat-relief-colour\|outline-\.\*\)\$\/;/.test(src));
  check("Hologram view is a round choice among the basemaps and clears the one it came from unless it is shown underneath",
        /<input type="radio" id="holo-toggle"/.test(html) && !/<input type="checkbox" id="holo-toggle"/.test(html) &&
        /showBaseTick\(opt\.under\);/.test(html) && /if \(on && !opt\.under\) \{\n\s*disable\(\);/.test(html));
  check("the page asks for this round's script", appVersion(html) >= 71);
}
{
  console.log("\nround 72: marks only beside layers; the conflicts layer's own tick; site boxes spaced as on their pages; land layers coloured by their own kinds; real boundaries");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const a = src.indexOf("const GFW_COLOUR_BY = {"), b = src.indexOf("const GFW_COLOUR_OFF = new Map();");
  let painted = {}, keys = [];
  const handlers = {};
  const fakeMap = { querySourceFeatures: () => [
      { properties: { current_avg_scr_cat: "Low", current_avg_scr: 0.2 } }, { properties: { current_avg_scr_cat: "High", current_avg_scr: 0.9 } },
      { properties: { current_avg_scr_cat: "Medium", current_avg_scr: 0.5 } }, { properties: {} }],
    getLayer: () => true, setPaintProperty: (id, p, v) => { painted[id] = v; }, on: (e, f) => { handlers[e] = f; }, off() {} };
  const G = new Function("map", "gladPaint", "catalogueKeyShow", "catalogueKeyHide", "setTimeout", "clearTimeout",
    src.slice(a, b) + "; return { gfwColourBy, gfwKindOrder, gfwKindColours, GFW_COLOUR_BY };");
  const T = G(fakeMap, (id, p, v) => v, (k, t, key) => keys.push(key), () => {}, (f) => { f(); return 0; }, () => {});
  T.gfwColourBy({ id: "landmark_tenure_indicators_ip", key: "k1", title: "t" }, "s", ["l"], ["s-f-l", "s-o-l"]);
  const e = painted["s-f-l"];
  check("a tenure indicator is coloured by its score's category, light to dark by the average score, with a key",
        Array.isArray(e) && e[0] === "match" && e[2] === "Low" && e[4] === "Medium" && e[6] === "High" && e[8] === "not stated" && e[3] === "#E3D9CF" && e[9] === "#77726A" &&
        keys.length === 1 && keys[0].values.length === 4 && !("s-o-l" in painted));
  check("an unordered field keeps distinct colours for each kind; LandMark's lands by holder and acknowledgement",
        new Set(T.gfwKindColours(["a", "b", "c"], {})).size === 3 && T.GFW_COLOUR_BY.landmark_ip_lc_and_indicative_poly.fields.join() === "identity,form_rec");
  check("category headings carry no live mark; a layer's own sublayers do",
        /if \(!\/toc-bundle\/\.test\(sec\.className\)\) \{ const old = head\.querySelector\("\.toc-live"\); if \(old\) old\.remove\(\); return; \}/.test(src));
  check("a layer made only of a site map's kinds can be ticked as a whole",
        /bundle \? "\[data-layer\], \[data-cat\], \[data-smtype\]" : "\[data-layer\]"/.test(src));
  const LL = new Function(src.slice(src.indexOf("const LEAFLET_CSS_LAST"), src.indexOf("function injectSitemapStyles(")) + "; return leafletCssLast;")();
  check("maps whose page loads Leaflet's styles last get them last here too, so their boxes keep Leaflet's margins",
        LL({ id: "site_secret_societies" }, { page: "https://x/maps/site/site_secret_societies.html" }) && !LL({ id: "site_rodeo" }, { page: "https://x/site_rodeo.html" }) &&
        /leaflet-after-\$\{cfg\.id\}/.test(src));
  check("a site map's box carries its position line inside it", /const at = h\.indexOf\('<\/div><\/div><div class="leaflet-popup-tip-container">'\);/.test(src));
  const J = JSON.parse(fs.readFileSync(path.join(HERE, "..", "pipeline", "shapes", "jurisdictions", "site_settler_colonialism.json"), "utf8")).entries;
  const bs = fs.readFileSync(path.join(HERE, "..", "pipeline", "shapes", "build_shapes.py"), "utf8");
  check("every settler colonialism entry is named with real jurisdictions, said in its box",
        Object.keys(J).length === 90 && Object.values(J).every((j) => j.parts.length && j.basis) &&
        /feats, juris = real_boundaries\(e, feats\)/.test(bs) && /props\["drawn_as"\] = want\["basis"\]/.test(bs));
  check("FUNAI and INCRA are parts of the LandMark layer; the resource rights are one layer",
        /\{ h: 5, bundle: "landmark", colour: "#6A5E66" \},/.test(src) && /\{ h: 5, bundle: "resrights", colour: "#5E6A66" \},/.test(src));
}
{
  console.log("\nround 73: every other country, and how it is invaded; the same facts in the settler colonialism boxes");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const a = src.indexOf("const INVADED_URL"), b = src.indexOf("\nif (typeof document !== \"undefined\" && document.head && document.createElement) {\n  const st = document.createElement(\"style\");\n  st.textContent = \".inv-h{");
  const esc = src.slice(src.indexOf("function escapeHtml(s) {"), src.indexOf("\n}\n", src.indexOf("function escapeHtml(s) {")) + 2);
  const T = new Function("fetch", esc + src.slice(a, b) + "; return { invadedBoxHtml };")(() => Promise.reject(new Error("no")));
  const c = { name: "Bolivia", indigenous: { landmark: { land: { ic_t: "36.2" }, population: { pct: "41", peoples: "Aymara, Quechua" } }, ilo169: { ratified: true, url: "u" } },
    colonial: {}, economic: { land_deals: { deals: 5, hectares: 34450.4, url: "l" }, debt: { external_debt_pct_gni: 40.1, year: 2024, url: "w" } },
    conquest: { gained: [], lost: [{ year: 1884, territory: "part of Bolivia", procedure: "conquest", other: "Chile", area_km2: 50215, armed_conflict: true, whole_unit: false, passed_on: null }] } };
  const h = T.invadedBoxHtml(c, "BOL", "", true);
  check("a country's box gives its four kinds of invasion, each fact with its source",
        /<b>Bolivia<\/b>/.test(h) && /hold 36\.2% of the land/.test(h) && /ratified\./.test(h) && /34,450 hectares/.test(h) && /40\.1% of national income \(2024\)/.test(h) &&
        /1884: part of Bolivia, conquest by Chile, 50,215 km², with fighting/.test(h) && /Correlates of War Territorial Change, v6/.test(h) && !/Colonial rule still in place/.test(h));
  check("a country nothing is compiled for says so, and adds nothing to a settler box",
        /Nothing compiled/.test(T.invadedBoxHtml(undefined, "XXX", "X", true)) && T.invadedBoxHtml(undefined, "XXX", "", false) === "");
  check("the layer is a row under Invasion of humans, shaded by a menu of measures",
        /\{ h: 4, t: "How each country is invaded" \}, "other_invaded",/.test(src) && /id: "other_invaded", name: "How each country is invaded/.test(src) &&
        /other_invaded: \[\n    \{ label: "Indigenous Peoples' and communities' share of the land \(LandMark\)"/.test(src) && /box: "invaded"/.test(src));
  check("the settler colonialism boxes add the compiled facts, said of the whole country",
        /cfg\.id === "site_settler_colonialism"/.test(src) && /\$\{all\[i\]\.name\}, the whole country/.test(src) && /Also, from other sources/.test(src));
  const bs = fs.readFileSync(path.join(HERE, "..", "pipeline", "shapes", "build_shapes.py"), "utf8");
  check("the settler shapes carry the countries they lie in", /props\["iso3"\] = ",".join\(isos\)/.test(bs));
  check("the page asks for this round's script", appVersion(html) >= 73);
}
{
  console.log("\nround 74: the map's own wars, militaries and weapons in place of Guerillamap");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  // Round 118b: the installations, test sites and OpenStreetMap places are in the rows of each kind (mil_k_*).
  const ids = ["mil_news", "mil_conflicts", "mil_attacks", "mil_aircraft", "mil_k_bases", "mil_units", "mil_k_nuclear", "mil_minefields", "mil_alliances",
    "mil_spend_gdp", "mil_spend_gov", "mil_spend_usd", "mil_personnel", "mil_warheads", "mil_tests", "mil_nuclear_position"];
  const at = order.findIndex((x) => x && x.t === "Wars, militaries and weapons, past and current");
  check("the rows sit in one layer under Of countries by countries, the country figures as a layer inside it, and the Guerillamap row is gone",
        at > -1 && ids.every((id) => order.indexOf(id) > at) && !order.includes("gm") && /const GM_ROW = false;/.test(src) &&
        order.findIndex((x) => x && x.t === "Armies and military spending, country by country") > at && ids.every((id) => new RegExp(`id: "${id}", name:`).test(src)));
  const g = new Function("escapeHtml", src.slice(src.indexOf("function gdeltLinks("), src.indexOf("async function readGdeltGeo(")) + "; return gdeltLinks;")(
    (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
  const links = g('<a href="https://x.org/a" target="_blank">Shelling <b>hits</b></a><script>alert(1)</script><a href="javascript:x">no</a>');
  check("GDELT's article list is rebuilt from its links alone", /href="https:\/\/x\.org\/a"/.test(links) && !/script|javascript/.test(links));
  const A = new Function(src.slice(src.indexOf("function adsbFeatures("), src.indexOf("async function addAdsbMilLayer(")) + "; return adsbFeatures;")();
  const f = A([{ hex: "ae1234", flight: "RCH123  ", t: "C17", lat: 50, lon: 8, alt_baro: 31000, track: 90 }, { hex: "x", lat: null }]);
  check("an aircraft is drawn where it is heard, with its callsign and type; one with no position is left out",
        f.length === 1 && f[0].properties.callsign === "RCH123" && f[0].properties.type === "C17" && f[0].properties.heading === 90);
  check("the aircraft and the news are read live; the aircraft again every minute",
        /"adsbmil", "gdeltgeo",/.test(src) && /cfg\._timer = setInterval\(draw, 60000\);/.test(src) && /copyUrl: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/military\/news\.geojson"/.test(src));
  check("the conflict events read UCDP's copy square by square, every field from gzipped pieces, and can be narrowed by kind",
        /id: "mil_conflicts"[^\n]*route: "pmtiles"[^\n]*\n\s*archiveUrl: "[^"]*\/tiles\/mil_conflicts\.pmtiles", boxes: "[^"]*\/military\/ucdp", boxesGz: true,/.test(src));
  check("a shaded layer may carry its own menu", /let by = SHAPE_COLOUR_BY\[cfg\.id\] \|\| \(Array\.isArray\(data\.menu\)/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 74);
}
{
  console.log("\nround 75: Climate by gas, each split into emissions, culprits, infrastructure and priority emitters");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const { PANEL_ORDER: o, PANEL_REMOVED: gone } = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const clim = o.findIndex((x) => x && x.t === "Climate");
  const h = (t, from = clim) => o.findIndex((x, i) => i > from && x && x.t === t);
  const co2 = h("Carbon dioxide"), ch4 = h("Methane"), n2o = h("Nitrous oxide"), fg = h("F-gases"), bc = h("Black carbon");
  const within = (id, a, b) => o.some((x, i) => x === id && i > a && i < b);
  check("General first, holding the Climate TRACE groups and the land greenhouse gas layer",
        h("General") < co2 && o.findIndex((x) => x && x.bundle === "landghg") > h("General") && o.indexOf("group:climate_trace_sectors") < co2);
  check("carbon dioxide: Climate TRACE and the other emissions, then the Carbon Majors and the banks, then the carbon bombs",
        within("climate_trace_power", h("Emissions", co2), h("Culprits", co2)) && within("carbon_majors", h("Culprits", co2), h("Priority emitters", co2)) &&
        within("bocc", h("Culprits", co2), h("Priority emitters", co2)) && within("carbon_bombs", h("Priority emitters", co2), ch4));
  check("methane in the page's order: livestock, fossil fuels, wastewater, rice, landfills; the wells as infrastructure",
        ["climate_trace_ag_enteric_fermentation_cattle_operation", "climate_trace_fossil_fuel_operations", "hydrowaste", "climate_trace_ag_rice_cultivation", "wasteatlas_landfills"]
          .every((id, i, a) => within(id, ch4, n2o) && (!i || o.indexOf(id, ch4) > o.indexOf(a[i - 1], ch4))) &&
        within("skytruth_fracfocus", h("Culprits", ch4), n2o) && h("Infrastructure", ch4) === -1);
  check("nitrous oxide: manure and fertiliser with the crop areas; soy's companies; silos and grain stores as infrastructure; the largest fertiliser plants",
        ["climate_trace_ag_manure_applied_to_soils", "climate_trace_ag_synthetic_fertilizer_application", "food_soy", "food_maize"].every((id) => within(id, h("Emissions", n2o), h("Culprits", n2o))) &&
        within("fertilizer_facilities", h("Synthetic fertiliser", n2o), fg) && !o.includes("trase_silos_brazil") && !o.includes("site_china_grain"));
  check("black carbon without the refineries; F-gases before it",
        fg < bc && within("ct_air_bc", bc, h("Overpopulation")) && !within("fractracker_refineries", bc, h("Overpopulation")));
  check("the Pennsylvania rows and the several-gases heading are gone; the waste-to-energy plants are under Solid waste only",
        h("Pennsylvania") === -1 && h("Infrastructure emitting more than one gas") === -1 && gone.has("skytruth_pa_spud") && o.filter((x) => x === "wasteatlas_wte").length === 1);
  check("the 500 largest companies under Wealth concentration", o.indexOf("largest_companies") > h("Wealth concentration", 0));
  check("a row inside a group already placed is named again as a copy", /const inner = frag\.querySelector\(`\[data-layer="\$\{item\}"\]`\);/.test(src));
  check("a row taking its source's title keeps its LIVE or NOT LIVE mark", /const words = \[\.\.\.nm\.childNodes\]\.find/.test(src) && !/if \(nm\) nm\.textContent = title;/.test(src));
  check("unticking a row hides its area edges too", /`\$\{id\}-edge`, `\$\{id\}-areapt`/.test(src));
  const tb = new Function(src.match(/function traseBreaks[\s\S]*?\n}\n/)[0] + "; return traseBreaks;")();
  const br = tb([0, 0, 0, 0, 0, 0, 5, 10, 20, 400]);
  check("Trase: regions with none are a step of their own, the rest stepped among themselves", br[0] === 5 && br.length > 2);
  check("Carbon Mapper is a row per gas, raised as columns by its rate",
        /id: "carbon_plumes_co2"[^\n]*gasOnly: "CO2"/.test(src) && /id: "carbon_plumes"[^\n]*gasOnly: "CH4"/.test(src) &&
        /if \(cfg\.gasOnly && String\(it\.gas \|\| ""\)\.toUpperCase\(\) !== cfg\.gasOnly\) return null;/.test(src) &&
        /carbon_plumes: \{ field: "emission", factor: 8\.76 \* 29\.8/.test(src) && /ct_air_bc: \{ field: "value", factor: 900/.test(src));
  check("Climate TRACE's methane and nitrous oxide lists are read beside carbon dioxide's", /\["", "_ch4", "_n2o"\]\.map/.test(src) && /const CT_GWP = \{ co2: 1, ch4: 29\.8, n2o: 273 \};/.test(src));
  check("the forest carbon flux maps draw from Global Forest Watch's own coloured tiles", /\/dynamic\/\{z\}\/\{x\}\/\{y\}\.png\?tree_cover_density_threshold=30/.test(src) &&
        /gfw_forest_carbon_gross_removals: \{ minzoom: 2, maxzoom: 12 \}/.test(src));
  check("the quilombola communities are out; the mangroves' biomass is under Deforestation",
        /\[\/\\bincra_bra_quilombola_communities\\b\|quilombola\/i, null\]/.test(src) && /mangrove biomass\/i, \[P \+ " > Deforestation > Mangroves"\]/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 75);
}
{
  console.log("\nround 76: the Genetic engineering map's country write-ups, what you can do, consultations, bodies and key filters");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "sources", "gmo_releases.py"), "utf8");
  check("a country on the shaded Genetic engineering layers opens with the map's own write-up and its What you can do list",
        /const GMO_COUNTRY_LAYERS = new Set\(\["gmo_regime", "gmo_treaties", "gmo_incidents", "gmo_cultivation", "gmo_gmofree"\]\);/.test(src) &&
        /getJson\(`\$\{GMO_BOXES\}\/countries\/\$\{iso\}\.json`/.test(src) && /bindHtmlPopup\(`\$\{cfg\.id\}-fill`, withGmo, popOpts\);/.test(src));
  check("the decisions list keeps its three menus", /window\._bchFilter = function \(a3\)/.test(src));
  check("the international bodies and the consultations and guides are rows of their own",
        /id: "gmo_bodies"[^\n]*route: "sitemap"/.test(src) && /id: "gmo_act"[^\n]*route: "gmopanel"/.test(src) &&
        /cfg\.route === "gmopanel" \? addGmoPanel\(cfg\)/.test(src) && /"gmo_trials", "gmo_bodies",\n/.test(src));
  const code = src.slice(src.indexOf("const GMO_KEY_DECADE"), src.indexOf("function keysRow("));
  const K = new Function(code + "; return { keyFilterExpr, keyOff, GMO_REL_KEYS, GMO_ORG_KEYS };")();
  K.keyOff.set("r", new Map([["x_lapsed", new Set(["expired"])]]));
  const e = JSON.stringify(K.keyFilterExpr({ id: "r", keys: K.GMO_REL_KEYS }));
  check("the key filters: releases by status, decade, consent phase and scale; organisations by kind, subject and organism",
        K.GMO_REL_KEYS.map((k) => k.label).join() === "Status,Decade granted,Consent phase,Release scale" &&
        K.GMO_ORG_KEYS.map((k) => k.label).join() === "Kind of body,Subjects,Organisms" &&
        /"in date"/.test(e) && !/"expired"/.test(e) && /\["!",\["has","x_lapsed"\]\]/.test(e) && K.keyFilterExpr({ id: "none", keys: K.GMO_REL_KEYS }) === null);
  check("…the rows carry them, and the filter narrows the row's own definition",
        /id:"gmo_env"[^\n]*\n    keys: GMO_REL_KEYS,/.test(src) &&
        /const parts = \[cfg\.where, picked, keyed, timed\]\.filter\(Boolean\);/.test(src));
  check("…and the records carry the fields, read as the map reads them",
        /"lapsed": \("expired" if r\.get\("lapsed"\) is True/.test(py) && /"subjects": _subjects\(r\)/.test(py) && /def _subjects\(r\):/.test(py));
  check("the page asks for this round's script", appVersion(html) >= 76);
}
{
  console.log("\nround 77: Invasion of the after-life, complete");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return PANEL_ORDER;")();
  const ids = ["remains_records", "remains_findings", "remains_cemeteries", "remains_crematoria", "remains_mortuaries", "remains_museums"];
  const at = o.findIndex((x) => x && x.t === "Invasion of the after-life");
  check("every part of the Unearthings map is a row under Invasion of the after-life, thaw and erosion said to have no feed",
        ids.every((id, i) => o.indexOf(id) > at && (!i || o.indexOf(id) > o.indexOf(ids[i - 1]))) &&
        o.some((x, i) => i > at && x && x.note && /Permafrost thaw and coastal erosion/.test(x.note)) && o.indexOf("remains_fire") > -1 &&
        (src.match(/id: "remains_findings"/g) || []).length === 1);
  check("the records, facilities, findings and panels are read from the map's own site",
        /const REMAINS_BASE = "https:\/\/welcometoyourgalaxy\.github\.io\/remains\/";/.test(src) && /id:"remains_records"[^\n]*route:"remains"/.test(src) &&
        /cfg\.route === "remainsfac" \? addRemainsFacLayer\(cfg\)/.test(src) && /cfg\.route === "remainspanel" \? addRemainsPanel\(cfg\)/.test(src) &&
        /"remains", "remainsfac", "remainsfind", "remainspanel",/.test(src));
  const esc = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const code = src.slice(src.indexOf("const R_POSTURES"), src.indexOf("// Resources and guides, attached by the jurisdiction"));
  const R = new Function("escapeHtml", code.replace(/const remainsCache[\s\S]*?\n}\n/, "") + "; return { remainsRecordHtml, remainsFacilityHtml, setDone: () => { rGloDone = {}; } };")(esc);
  R.setDone();
  const h = R.remainsRecordHtml({ name: "Notice of repatriation", posture: "redress", kind: "repatriation", geo: "coarsened", desc: "A repatriation under NAGPRA.", url: "https://x.org/r" });
  check("a record's box is the map's own: its direction, its kind with the plain definition, how precise its place is",
        /t-redress/.test(h) && /Repatriation notice<\/span><span class="gl-inline"> \(a published legal notice/.test(h) && /Blurred to about 5 km/.test(h) &&
        /Open the primary record/.test(h));
  check("…and the facility box says what the map says", /not blurred<\/b>, because it is a signposted public place/.test(R.remainsFacilityHtml([1, 2, "X", "", "", "Addr", "", "01"], "Crematorium")));
  check("the records keep the map's filters: register, direction, kind, trigger, scale, how recent, undated, words",
        /group\("Register", "source"/.test(src) && /group\("Direction", "posture"/.test(src) && /group\("Kind", "kind"/.test(src) &&
        /group\("What set it off", "trigger"/.test(src) && /data-rscale/.test(src) && /data-rwin/.test(src) && /data-rundated/.test(src) && /class="r-q"/.test(src));
  check("no yellow or orange in the after-life colours", !/#c9a227|#e0913f|#e8d24a/i.test(src.slice(src.indexOf("const REMAINS_BASE"), src.indexOf("const REMAINS_CSS"))));
  check("a country opens with what is in it and its guides and resources", /cfg\.box === "remainsunit"/.test(src) && /function remainsUnitHtml\(help, p\)/.test(src) &&
        /remains_units: \[\{ label: "records from the Unearthings harvest", field: "n", scale: "log" \}\]/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 77);
}
{
  console.log("\nround 78: the news of fighting kept past seven days; OpenStreetMap's and the Pentagon's own military places");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the news is kept a month to a file and read as one row with a chip per month",
        /id: "mil_news_archive"[^\n]*route: "gdeltarchive"/.test(src) && /async function readGdeltArchive\(cfg\)/.test(src) &&
        /items\.push\(\{ geometry: f\.geometry, key: `\$\{m\}:\$\{i\}`, name: p\.name \|\| "A place named in the news", group: cfg\.copyUrl \? "" : m,/.test(src) &&
        /"mil_news", "mil_news_archive", "mil_conflicts"/.test(src));
  check("OpenStreetMap's military places and MIRTA are rows of the military layer, marked NOT LIVE",
        /id: "mil_osm"[^\n]*route: "geojsonlive"/.test(src) && /id: "mil_mirta"[^\n]*route: "geojsonlive"/.test(src) &&
        /"mil_osm", "mil_mirta", "mil_test_sites"/.test(src) && /mil_osm: "Copied daily from OpenStreetMap/.test(src) && /mil_mirta: "Copied daily from catalog\.data\.gov/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 78);
}
{
  console.log("\nround 79: nuclear weapons storage, Russia's storage map, the US Navy at sea");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the three rows sit in the military layer",
        /"mil_aircraft", "mil_usni_fleet", "mil_units"/.test(src) && /"mil_k_nuclear", "mil_nuclear_storage"/.test(src) &&
        /id: "mil_nuclear_storage"[^\n]*route: "geojsonlive"/.test(src) && /id: "mil_usni_fleet"[^\n]*route: "usnifleet"/.test(src));
  check("Russia's storage map is shown whole, not copied (its licence allows no derivatives)",
        /id: "mil_russia_storage"[^\n]*route: "companion"/.test(src) && /page: "https:\/\/russianforces\.org\/maps\/Russia-12thGUMO\.html"/.test(src));
  check("each USNI week is a chip, every heading's words quoted, and the box says the mark is the middle of the area",
        /group: `week of \$\{w\}`/.test(src) && /USNI gives no coordinates, and warships often switch their transponders off/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 79);
}
{
  console.log("\nround 80: news from GDELT's event files; MISSILEMAP");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the seven-day news row reads the daily copy, GDELT's GEO API being gone",
        /id: "mil_news"[^\n]*route: "gdeltarchive"/.test(src) && /copyUrl: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/military\/news\.geojson"/.test(src));
  check("MISSILEMAP opens where the map is looking, its launch site there",
        /id: "mil_missile_ranges"[^\n]*route: "companion"/.test(src) && /pageAt: \(c, z\) => `https:\/\/nuclearsecrecy\.com\/missilemap\/\?mc=/.test(src) &&
        /frame\.src = typeof cfg\.pageAt === "function" \? cfg\.pageAt\(map\.getCenter\(\), map\.getZoom\(\)\) : cfg\.page;/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 80);
}
{
  console.log("\nround 81: pollution by where it goes, columns for air pollutants, colour-coded waste, the EPA pictures, the slicks' timeline");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
  check("Pollution is split into all-around, air, water and land",
        at("Pollution") < at("All-around pollution") && at("All-around pollution") < at("Air pollution") && at("Air pollution") < at("Water pollution") &&
        at("Water pollution") < at("Land pollution") && at("Land pollution") < at("Fire"));
  check("the Toxics Release Inventory copy is a kind of the EPA sites layer, not a row of its own",
        o.PANEL_REMOVED.has("epa_tri_sites") && !o.PANEL_ORDER.includes("epa_tri_sites") && /triRow: "epa_tri_sites"/.test(src) && /data-tri=/.test(src));
  check("PIRG's page is out, and the two built plastics rows are in",
        o.PANEL_REMOVED.has("pirg_plastic") && ["plastics_plants", "vinyl_chloride_plants"].every((i) => o.PANEL_ORDER.includes(i) && new RegExp(`id: "${i}"[^\\n]*route: "geojsonlive"`).test(src)));
  check("the four outlet rows are one layer, the countries' waste figures eight national highlights, the slicks one layer with SkyTruth's two parts",
        o.PANEL_ORDER.some((x) => x && x.bundle === "wwoutlets") && o.PANEL_ORDER.some((x) => x && x.bundle === "wastecountries") &&
        o.PANEL_ORDER.some((x) => x && x.bundle === "oilslicks") &&
        ["msw", "stress", "percap", "gni", "collect", "recycle", "unsound", "intensity"].every((k) => new RegExp(`id: "wasteatlas_nat_${k}"[^\\n]*route: "country"`).test(src)));
  check("the watersheds' title says they are weighed by area", /id: "wastewater_watersheds", name: "[^"]*weighted by watershed area/.test(src));
  const A = new Function("escapeHtml", "const HUD_SKIP = new Set();\n" + src.slice(src.indexOf("const AMOUNT_RAMP = "), src.indexOf("// WP Go Maps (Final Nail)")) +
    "; return { amountOf, colourByAmount };")((s) => String(s));
  check("a figure is read from the site's own words, a range at its middle",
        A.amountOf("2,320,000 t").v === 2320000 && A.amountOf("7,200,000 - 10,300,000 t").v === 8750000 && A.amountOf("We need your support") === null);
  const items = [
    { h: "<div>a</div>", _p: { "Estimated amount of included waste": "4,000,000 t", "Informal Sector": "100 people" } },
    { h: "<div>b</div>", _p: { "Estimated amount of included waste": "We need your support", "Informal Sector": "50 people" } },
    { h: "<div>c</div>", _p: { "Estimated amount of included waste": "We need your support", "Informal Sector": "We need your support" } },
  ];
  const out = A.colourByAmount({ id: "x", colourBy: { field: "Estimated amount of included waste", steps: [5e5, 1e6, 3e6, 1e7, 3e7], unit: "t of waste",
    estimate: { field: "Informal Sector", unit: "people working informally" } } }, items);
  check("a dumpsite with no figure is estimated from its informal workers at the rate the others show, drawn as a ring, and says so",
        items[1]._v === 2000000 && items[1].hollow === true && /Coloured by an estimate/.test(items[1].h) && items[2].group === "No figure given" &&
        out.key.some(([, t]) => /ring: estimated/.test(t)));
  const fb = new Function("escapeHtml", src.slice(src.indexOf("const FIELD_BOX_SKIP"), src.indexOf("// Which of a copy's 256 pieces")) + "; return fieldBoxHtml;")((s) => String(s));
  const hw = { name: "HydroWASTE", unit: "plants", fieldBox: { title: ["WWTP_NAME"], fallback: "Wastewater treatment plant", labels: [["POP_SERVED", "People served"]] } };
  check("a HydroWASTE plant's box gives its name and every column, plain words first",
        /<b>Fort Severn Lagoon<\/b>/.test(fb(hw, { WWTP_NAME: "Fort Severn Lagoon", POP_SERVED: 179, QUAL_LOC: "2" })) &&
        /People served/.test(fb(hw, { WWTP_NAME: "X", POP_SERVED: 179 })) && /QUAL LOC/.test(fb(hw, { WWTP_NAME: "X", QUAL_LOC: "2" })) &&
        /merged/i.test(fb(hw, { clustered: true, point_count: 4 })));
  check("the air pollutants stand as columns on their own scale, the urban sources by their fine particles",
        ["pm2_5", "oc", "so2", "vocs", "co", "nh3", "nox"].every((g) => src.includes(`["${g}", "`)) && /ct_air: ctAirColumn\("pm25_kg_hr", "fine particles \(PM2\.5\)", 8\.76\)/.test(src) &&
        /const COLUMN_OWN_TOP = 1e7;/.test(src));
  check("the EPA layer draws a picture of every point wider out than zoom 6",
        /density: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/tiles\/epa_density\.json"/.test(src) && /if \(densityFrom && part\.to < densityFrom\) return;/.test(src));
  const mb = new Function(src.slice(src.indexOf("function monthsBetween("), src.indexOf("async function ceruleanTimeline(")) + "; return { monthsBetween, monthEnd };")();
  check("the slicks' timeline runs month by month, to the month's last day",
        mb.monthsBetween("2023-11", "2024-02").join() === "2023-11,2023-12,2024-01,2024-02" && mb.monthEnd("2024-02") === "2024-02-29");
  check("the wastewater outlets glow as a hotspot spectrum with its key", /const HOTSPOT = new Set\(\["wastewater_n_tot"/.test(src) && /if \(HOTSPOT\.has\(owner\)\) rowKey\(cfg\.id, HOT_KEY/.test(src));
  check("the Material Research atlas keeps only its pollution layers", /dropLayers: \[(1, 2, )?3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13\]/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 81);
}
{
  console.log("\nround 82b: neon greens and blues; nitrogen dioxide as relief; the fire rows; forest cover and mangroves");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER };")();
  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
  check("the map-wide colours run teal to cobalt, a step less vivid (round 85b; were neon green to electric blue)", /const GLAD_LO = 172, GLAD_SPAN = 55;/.test(src) && /const GLAD_SAT_LO = 0\.5, GLAD_SAT_HI = 0\.85;/.test(src));
  check("the nitrogen dioxide row is back under its heading, read from the tiles Global Forest Watch serves",
        o.PANEL_ORDER[o.PANEL_ORDER.indexOf("no2_tropomi") - 1].t === "Nitrogen dioxide" && /tropomi_avg_nitrogen_dioxide_last_month\/latest\/default/.test(src));
  const N = new Function(src.slice(src.indexOf("const NO2_KEY = "), src.indexOf("const no2Relief = ")) + "; return { NO2_KEY };")();
  const amt = new Function("NO2_KEY", src.slice(src.indexOf("function no2Amount("), src.indexOf("function no2Colour(")) + "; return no2Amount;")(N.NO2_KEY);
  check("a picture's colour is read back into its amount along the layer's own key",
        Math.abs(amt(85, 15, 109) - 10) < 0.01 && Math.abs(amt(249, 140, 9) - 100) < 0.5 && amt(252, 254, 164) >= 299);
  check("the relief holds the ground while shown and gives it back after", /map\.setTerrain\(\{ source: `\$\{top\}-dem`, exaggeration: reliefLift\(\) \}\)/.test(src) &&
        /cfg\.afterVisibility = \(v\) => reliefGround\(cfg\.id, v === "visible"\);/.test(src) && /if \(no2Relief\.on\) return;/.test(src));
  check("the active fire row asks NASA's map service for pictures of all three VIIRS satellites", /VIIRS_SNPP_Thermal_Anomalies_375m_All,VIIRS_NOAA20_Thermal_Anomalies_375m_All,VIIRS_NOAA21_Thermal_Anomalies_375m_All/.test(src) &&
        /wms\/epsg(3857|4326)\/best\/wms\.cgi/.test(src));
  const lib = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT };")();
  const f = (t, id = "") => lib.cataloguePlaces(`${t} ${id}`, `${t} ${id}`).join(" | ");
  check("the nine Equatorial Asia fire alert rows are out",
        ["alertfire_modis", "alertfire_viirs", "alertfire_combine", "v3p2_alertfire_modis", "v3p3_alertfire_combine", "v3p2_alertfire_viirs"].every((id) => f("Fire alerts", id) === lib.CATALOGUE_TAKEN_OUT));
  check("Forest cover and Mangroves are the headings; the trees in mosaic and complex landscapes under Forest cover, the mangrove biomass under Mangroves",
        at("Forest cover") > -1 && at("Mangroves") > -1 && at("Forest cover in 2020") === -1 && at("Forest carbon and biomass") === -1 && at("Trees in mosaic landscapes") === -1 &&
        f("Trees in complex landscapes", "wri_trees_in_complex_landscapes") === "Destruction > Of the planet > Deforestation > Forest cover" &&
        f("x", "jpl_mangrove_aboveground_biomass_stock_2000") === "Destruction > Of the planet > Deforestation > Mangroves");
  const g = new Function(src.slice(src.indexOf("const GFW_TITLES = {"), src.indexOf("// Which of a dataset's assets to draw from.")) + "; return { gfwTitle, gfwAbout };")();
  check("the logging roads and the trees in mosaic landscapes are titled and described; no title says Global Forest Watch gave none",
        /Congo Basin/.test(g.gfwTitle({ dataset: "osm_logging_roads", metadata: {} })) && /Sentinel-2/.test(g.gfwAbout("wri_trees_in_mosaic_landscapes")) &&
        !/gives this dataset no title/.test(g.gfwTitle({ dataset: "abc_def", metadata: {} })));
  check("two datasets of one title make one row, the one with tiles", /datasets repeat another's title and have no row/.test(src) && /const keep = g\.find\(drawable\) \|\| g\[0\];/.test(src));
  check("the forest management classes each take their own colour, far apart", /classColours: \["#0A7E8C", "#00B4D8", "#5FD3C4"/.test(src) && /GLAD_CLASS_PALETTE\.set\(cfg\.id, pal\)/.test(src));
  check("the mangrove biomass is ringed wider out by the mangroves' outline", /jpl_mangrove_aboveground_biomass_stock_2000: \{ dataset: "gmw_global_mangrove_extent", until: 8/.test(src));
  check("Global Forest Watch's areas are drawn teal to blue with a darker edge (round 85b), servers' white areas in the row's hue", /const hue = gladSalt\(d\.id\), neon = gladHsl\(hue, 0\.72, 0\.46\), rim = gladHsl\(hue, 0\.78, 0\.26\)/.test(src) && /take a light neon of the row's own hue/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 82);
}
{
  console.log("\nround 83b: population as relief; one timber plantation row; one pulp concession row; Trase easier to see; tree cover loss pared");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER };")();
  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
  check("population density is raised by density from GHSL's numbers, with Climate TRACE's picture until they are built",
        /id: "ct_pop", name: "Population density, 2020, 1 km, raised higher where more people live \(GHSL\)"[^\n]*route: "poprelief"/.test(src) &&
        /tiles\/ghsl_pop\.pmtiles/.test(src) && /return addRasterChoiceLayer\(cfg\);/.test(src));
  check("the timber plantations of 2024 and 2025 are one row with a year chip, the catalogue's two taken out",
        /id: "nus_itp"[^\n]*route: "rasterlive"/.test(src) && /\["2025", "2024"\]\.map/.test(src) && o.PANEL_ORDER.includes("nus_itp"));
  const lib = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT };")();
  const f = (t, id = "") => lib.cataloguePlaces(`${t} ${id}`, `${t} ${id}`).join(" | ");
  check("…and the catalogue's two years are out", f("Industrial timber plantations 2024", "Global_PlantationITP_2024") === lib.CATALOGUE_TAKEN_OUT);
  check("tree cover loss from fires is under Fire (and since round 88b under What drove the loss too); the planted area on peatland under Peatland",
        f("Tree cover loss due to fires").endsWith(" | Destruction > Of the planet > Fire") && f("Planted area on peatland") === "Destruction > Of the planet > Deforestation > Peatland");
  check("under Loss year by year only GLAD and the global land area stay", f("Tree cover loss — Global land area", "umd_tree_cover_loss") !== lib.CATALOGUE_TAKEN_OUT &&
        f("Tree cover loss in Argentina", "arg_otbn_forest_loss") === lib.CATALOGUE_TAKEN_OUT);
  check("Tree cover loss and alerts sits right under Forest cover (round 89b: with Forest zoning between)", at("Forest zoning and management plans") === at("Forest cover") + 1 && at("Tree cover loss and alerts") === at("Forest cover") + 3);
  const nw = new Function(src.match(/function notWorldwide\(t\) \{[\s\S]*?\n\}\n/)[0] + "; return notWorldwide;")();
  check("the rubber plantations are not called worldwide", nw("Rubber plantations 2025 \u2014 worldwide") === "Rubber plantations 2025" && nw("Oil palm \u2014 worldwide") === "Oil palm \u2014 worldwide");
  check("Trase's regions are edged in their own colours with a dot at their middle wider out", /id: `\$\{src\}-mid`, type: "circle"/.test(src) && /"line-color": \["coalesce", \["get", "_c"\]/.test(src));
  check("the Material Research atlas keeps only its plants", /dropLayers: \[1, 2, 3,/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 83);
}
{
  console.log("\nround 84b: the forest alert rows build; rows cut between two; drag anywhere with a reset; environmental crime; Global Witness");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
  check("the Worker's picture rows are built when first ticked, not sent to the archive builder",
        /: cfg\.route === "tile" \? Promise\.resolve\(\)\.then\(\(\) => addTileLayer\(cfg\)\)/.test(src));
  check("the two worldwide disturbance rows are no longer cut to the tropics",
        !/id:"gfw_dist",[^\n]*\n\s*bounds: \[-180, -30, 180, 30\]/.test(src) && !/id:"gfw_dist_year",[^\n]*\n\s*bounds: \[-180, -30, 180, 30\]/.test(src));
  check("the rows between the forest alerts row and GLAD's 30 S to 30 N row are taken out, as the box shows them",
        /const CUT_BETWEEN = \[\{ from: '\[data-group="forest_alerts"\]'/.test(src) && /watchCuts\(box\);/.test(src));
  check("a row can be dragged into another heading or onto a heading's line, and the menu reset puts every row back",
        /function moveRowInto\(lead, body\)/.test(src) && /function resetRows\(box\)/.test(src) && /Reset layers menu/.test(src) && /drag\.where = "into";/.test(src));
  check("the box says how to use it with the map", /Drag a layer by its \\u2807 grip above or below another to draw it above or below that layer on the map/.test(src));
  check("MISSILEMAP's panel is out", o.PANEL_REMOVED.has("mil_missile_ranges") && !o.PANEL_ORDER.includes("mil_missile_ranges"));
  check("environmental crime has its heading: IBAMA's embargoes and notices and RAISG's illegal mining; RAISG under Mining too",
        at("Environmental crime") > at("Of the planet") && ["ibama_embargos", "ibama_infractions", "raisg_illegal_mining"].every((i) => o.PANEL_ORDER.indexOf(i, at("Environmental crime")) > at("Environmental crime")) &&
        o.PANEL_ORDER.indexOf("raisg_illegal_mining") < at("Environmental crime"));
  check("Global Witness is under Invasion of humans and under Of individuals > Of humans only",
        o.PANEL_ORDER.indexOf("gw_defenders") > at("Invasion of humans") && o.PANEL_ORDER.lastIndexOf("gw_defenders") > at("Of individuals") &&
        o.PANEL_ORDER.filter((x) => x === "gw_defenders").length === 2);
  check("the page asks for this round's script", appVersion(html) >= 84);
}
{
  console.log("\nround 85b: military colours apart, Russia's panel out, lookout towers out, the drivers as one layer, agriculture-linked deforestation built, environmental crime by country");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  const f = (t, id) => places(`${t} ${id}`, `${t} ${id}`).join(" | ");
  const cols = [...src.matchAll(/\{ id: "(mil_[a-z_]+)", name: "[^"]*", unit: "[^"]*", colour: "(#[0-9A-F]{6})", keepColour: true/g)];
  const pts = cols.filter(([, id]) => !/^mil_news_archive$/.test(id)).map(([, , c]) => c);
  check("every military point row has its own colour, kept out of the green-to-blue rotation",
        cols.length >= 12 && new Set(pts).size === pts.length);
  check("no military colour is orange or yellow", cols.every(([, , c]) => {
    const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === mn) return true;
    let h = mx === r ? 60 * (((g - b) / (mx - mn)) % 6) : mx === g ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - g) / (mx - mn) + 4);
    h = (h + 360) % 360;
    return h < 20 || h > 75;
  }));
  check("Russia's storage panel is out and no box links MISSILEMAP",
        o.PANEL_REMOVED.has("mil_russia_storage") && !o.PANEL_ORDER.includes("mil_russia_storage") && /!\/MISSILEMAP\/i\.test\(k\)/.test(src));
  const leave = new Function("return " + src.slice(src.indexOf("leaveOut: (p) => {") + 10, src.indexOf("},", src.indexOf("leaveOut: (p) => {")) + 1))();
  check("fire lookout towers, and places that are only observation towers or belfries, leave the military installations",
        leave({ kind: "fire lookout tower" }) && leave({ kind: "fire lookout tower, watchtower" }) && leave({ kind: "observation tower" }) &&
        !leave({ kind: "observation tower, military building" }) && !leave({ kind: "airbase" }) && /if \(cfg\.leaveOut && cfg\.leaveOut\(p\)\) return;/.test(src));
  check("the all-ecosystem disturbance alerts and GLAD alerts are out; the integrated rows stay",
        f("Global all ecosystem disturbance alerts (DIST-ALERT)", "umd_glad_dist_alerts") === "(taken out)" &&
        f("GLAD alerts \u2014 30\u00b0S to 30\u00b0N", "umd_glad_landsat_alerts") === "(taken out)" &&
        f("Integrated deforestation alerts", "gfw_integrated_alerts") !== "(taken out)" &&
        f("Global integrated disturbance alerts", "gfw_integrated_dist_alerts") !== "(taken out)");
  check("the drivers' coverage shape and Global Forest Watch's agriculture-linked deforestation are out",
        f("Drivers of disturbance alerts \u2014 the area they cover, as one shape, with no drivers in it", "wur_alert_drivers_coverage") === "(taken out)" &&
        f("Agriculture-Linked Deforestation \u2014 Global", "wri_agriculture_linked_deforestation") === "(taken out)");
  check("the drivers of tree cover loss are one layer, Curtis et al.'s first (Wageningen's part out since round 87b)",
        /Tree cover loss by dominant driver/.test(f("Tree cover loss by dominant driver", "tsc_tree_cover_loss_drivers")) &&
        f("Drivers of disturbance alerts \u2014 the driver behind each alert (Wageningen University)", "wur_integration_alert_drivers_class") === "(taken out)" &&
        /const CATALOGUE_FIRST = new Set\(\["tsc_tree_cover_loss_drivers"/.test(src) &&
        o.PANEL_ORDER.some((x) => x && x.bundle === "drivers"));
  check("the map's own agriculture-linked deforestation sits under What drove the loss, coloured by the crop or animal",
        o.PANEL_ORDER.indexOf("agri_linked") > at("What drove the loss") && /id: "agri_linked"[^\n]*route: "pmtareas"/.test(src) &&
        /const cb = cfg\.classBy;/.test(src));
  check("the cut runs through GLAD alerts, by the Alerts heading's A to Z order",
        /through: "GLAD alerts"/.test(src) && /function cutUpTo\(title, through\)/.test(src));
  check("environmental crime by country, three rows from the Global Organized Crime Index, first under Environmental crime",
        ["goc_flora", "goc_fauna", "goc_resources"].every((i, k) => o.PANEL_ORDER.lastIndexOf(i) === at("Environmental crime") + 1 + k) &&
        /if \(!tf\.field\) return j;/.test(src));
  check("no bright green is left anywhere in the map's own colours (round 85b: \"barfy alien\" green)", (() => {
    for (const m of src.matchAll(/#([0-9A-Fa-f]{6})\b|rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) {
      const [r, g, b] = m[1] ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [m[2], m[3], m[4]].map(Number);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, d = mx - mn;
      if (!d || l <= 0.15 || l >= 0.93) continue;
      const s = d / (255 * (1 - Math.abs(2 * l - 1)));
      let h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
      h = (h + 360) % 360;
      if (h >= 70 && h <= 165 && s > 0.45) return false;
    }
    return true;
  })());
  check("the global burned areas are asked for only from zoom 5 in, where Global Forest Watch can answer",
        /const GFW_MIN_ZOOM = \{ umd_modis_burned_areas: 5 \};/.test(src) && /asset\.minzoom = Math\.max\(asset\.minzoom \|\| 0, least\);/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 85);
}
{
  console.log("\nround 87b: the three switches on one line; tree cover loss years; the fire loss, Equatorial Asia alerts, RADD coverage, Wageningen and duplicate expansion out; negligible risk coloured");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  const f = (t, id) => places(`${t} ${id}`, `${t} ${id}`).join(" | ");
  check("Points, Shapes and National highlights sit on one line", /<span class="ks-l">Turn on every<\/span><span class="ks-row">/.test(src) && /\.kind-switch \.ks-row\{display:flex;flex-wrap:nowrap/.test(src) && !/text-overflow:ellipsis/.test(src.slice(src.indexOf(".kind-switch .chip{"), src.indexOf(".kind-switch .chip{") + 200)));
  check("the Global Forest Change row says its years and moves to version 1.13 when it answers",
        /id: "glad_loss", name: "Tree cover loss, each year 2001 to 2024 \(Global Forest Change v1\.12, UMD GLAD\)"/.test(src) && /gfc_v1\.13\/loss_alpha/.test(src) && /if \(cfg\.newer && !cfg\._newerTried\)/.test(src));
  check("the loss due to fire is not under Loss year by year, and is not titled 2000 to 2012",
        !/Loss year by year/.test(f("Tree cover loss due to fire \u2014 Global land area", "umd_tree_cover_loss_from_fires")) &&
        /!\/fire\/i\.test\(t\) && !\/\\b20\\d\\d\\b\/\.test\(t\)/.test(src));
  check("Nusantara's Equatorial Asia alert pictures, the RADD coverage, Wageningen's drivers and the duplicate expansion maps are out",
        ["AlertDFCOMBINERGB", "AlertGLADRGB", "AlertRADDRGB"].every((id) => f("Trees cut, as Nusantara reads it \u2014 Equatorial Asia", id) === "(taken out)") &&
        f("RADD Alerts Coverage", "wur_radd_coverage") === "(taken out)" && f("Deforestation alerts (RADD) Coverage", "wur_africa_radd_coverage") === "(taken out)" &&
        f("Drivers of disturbance alerts \u2014 the date of each alert (Wageningen University)", "wur_integration_alert_drivers_date") === "(taken out)" &&
        f("Plantation expansion, 2000 to 2024 (picture) \u2014 Equatorial Asia", "Global_AllExpansionRGB_2000to2024") === "(taken out)" &&
        f("Plantation expansion, 2000 to 2025 \u2014 Equatorial Asia", "Global_AllExpansion_2000to2025") === "(taken out)" &&
        f("Plantation expansion, 2000 to 2025 (picture) \u2014 Equatorial Asia", "Global_AllExpansionRGB_2000to2025") !== "(taken out)" &&
        f("Plantation expansion 2025, Papua", "papua_expansion_2025") !== "(taken out)" &&
        f("Integrated deforestation alerts", "gfw_integrated_alerts") !== "(taken out)");
  check("the negligible risk districts are coloured by their class and explained", /gfwpro_negligible_risk_analysis: \{ fields: \["negrisk"\]/.test(src) && /gfwpro_negligible_risk_analysis: "Each district/.test(src));
  check("the agricultural frontier is explained", /col_frontera_agricola: "Colombia's agricultural frontier, set by its Ministry of Agriculture through UPRA/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 87);
}
{
  console.log("\nround 88b: product headings by name, their emissions with them, Trase's cattle measures one row, the pulp measures told apart, the live worldwide alerts first");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER };")();
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  const f = (t, id) => places(`${t} ${id}`, `${t} ${id}`).join(" | ");
  const P = "Destruction > Of the planet", T = P + " > Deforestation > Tree cover loss and alerts";
  check("the product headings are the product's name alone", ["Cattle", "Soy and corn", "Palm oil", "Cocoa", "Wood pulp"].every((h) => o.PANEL_ORDER.some((x) => x && x.t === h && x.h === 5)) &&
        !o.PANEL_ORDER.some((x) => x && /^Clearing for (cattle|soy|palm|cocoa|wood)/.test(x.t || "")));
  check("a product's clearing emissions go under the product; all clearing's under Emissions, as one layer",
        f("Gross emissions from soy deforestation (t CO\u2082-eq.) \u2014 Brazil (Trase) CO2_GROSS_EMISSIONS_SOY_DEFORESTATION_5_YEAR_TOTAL soy trase", "x").includes(T + " > Soy and corn") &&
        f("Gross emissions from cocoa deforestation (t) \u2014 Ghana (Trase) cocoa", "x").includes(T + " > Cocoa") &&
        f("Gross emissions from deforestation (t CO\u2082-eq.) \u2014 Brazil (Trase)", "CO2_GROSS_EMISSIONS_TERRITORIAL_DEFORESTATION").startsWith(T + " > Emissions from the clearing > Gross emissions from deforestation") &&
        f("Emissions from deforestation (t CO\u2082-eq.) \u2014 Argentina, Paraguay (Trase)", "CO2_EMISSIONS_TERRITORIAL_DEFORESTATION") === f("x", "CO2_GROSS_EMISSIONS_TERRITORIAL_DEFORESTATION"));
  check("West Africa's cocoa deforestation risk is under Cocoa; the loss due to fire is under Deforestation and Fire",
        f("West Africa Cocoa Deforestation Risk Assessment", "gfw_west_africa_cocoa_deforestation_risk") === T + " > Cocoa" &&
        f("Tree cover loss due to fire \u2014 Global land area", "umd_tree_cover_loss_from_fires") === T + " > What drove the loss | " + P + " > Fire");
  check("the worldwide integrated alerts are named as a live deforestation map and lead Alerts and Disturbance",
        /gfw_integrated_dist_alerts: "Deforestation and loss of plant cover as it happens, worldwide/.test(src) &&
        f("x", "gfw_integrated_dist_alerts") === T + " > Alerts | " + P + " > Biodiversity loss > Disturbance" &&
        /const CATALOGUE_FIRST = new Set\(\[[^\]]*"gfw_integrated_dist_alerts"/.test(src));
  {
    const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
    const T2 = new Function(pick("const TRASE_REMOVED = ", "function traseMeasures(") + pick("function traseMeasures(", "// Which level and year each country is drawn at") + pick("function trasePlan(", "// Climate TRACE by gas") +
      "; return { traseMeasures, traseMerge, traseView, trasePlan };")();
    const lv = (years, extra = {}) => ({ name: "Department", metrics: {} , ...extra });
    const cat = {
      brazil: { name: "BRAZIL", levels: { municipality: { name: "Municipality", metrics: {
        CATTLE_DEFORESTATION_5_YEAR_TOTAL: { display_name: "Cattle deforestation", unit_abbreviation: "ha", years: [2022, 2023] },
        CATTLE_DEFORESTATION_PER_TN_5_YEAR_TOTAL: { display_name: "Cattle deforestation per ton", unit_abbreviation: "ha / t", years: [2022, 2023] },
        ANNUAL_WOODPULP_DEFORESTATION: { display_name: "Deforestation for planted pulpwood", unit_abbreviation: "ha", years: [2023] } } } } },
      paraguay: { name: "PARAGUAY", levels: { department: { name: "Department", metrics: {
        CATTLE_DEFORESTATION_PER_TN_5_YEAR_ANNUAL: { display_name: "Cattle deforestation per ton", unit_abbreviation: "ha / t", years: [2018, 2019] } } } } },
    };
    const list = T2.traseMerge(T2.traseMeasures(cat));
    const m = list.find((e) => e.merged);
    T2.traseView(m);
    const opts = m._options.map((x) => x.label);
    m.pick.measure = "Cattle deforestation per ton (ha / t)"; T2.traseView(m);
    const both = Object.entries(m.countries).map(([k, c]) => `${k}:${c.metric}`).join();
    m.pick.country = "paraguay"; T2.traseView(m);
    const plan = T2.trasePlan(m, "", "").draw;
    check("Trase's three cattle rows are one, with menus for the measure and the country, each country read with its own measure",
          list.filter((e) => /^Cattle deforestation/.test(e.title)).length === 1 && opts.length === 2 &&
          both === "brazil:CATTLE_DEFORESTATION_PER_TN_5_YEAR_TOTAL,paraguay:CATTLE_DEFORESTATION_PER_TN_5_YEAR_ANNUAL" &&
          plan.length === 1 && plan[0].country === "paraguay" && plan[0].year === 2019 &&
          /\(e\.countries\[part\.country\] \|\| \{\}\)\.metric \|\| e\.metric/.test(src) && /data-tr="country"/.test(src));
    check("the pulpwood measures are titled by what each counts", list.some((e) => /^Natural forest cleared each year to plant pulpwood/.test(e.title)) &&
          ["CONCESSION_DEFORESTATION", "CUMULATIVE_DEFORESTATION_SINCE_CONCESSION_START", "WOOD_PULP_DEFORESTATION_10_YEAR_TOTAL", "DEFORESTATION_ON_PEAT"].every((k) => new RegExp(`${k}: "`).test(src)));
  }
  check("the page asks for this round's script", appVersion(html) >= 88);
}
{
  console.log("\nround 89b: plain-English titles; The Culprits; zoning after forest cover; mangroves last; concession area out; peatland pulp clearing under Peatland; the Natural Lands Map");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER };")();
  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  const f = (t, id) => places(`${t} ${id}`, `${t} ${id}`).join(" | ");
  const P = "Destruction > Of the planet";
  const plain = new Function(src.slice(src.indexOf("const CATALOGUE_PLAIN = {"), src.indexOf("const LEFT_OUT = ")) + "; return { plainTitle, CATALOGUE_PLAIN, TRASE_PLAIN };")();
  check("catalogue rows show a plain-English title by their id, and keep the source's own for filing",
        plain.plainTitle({ name: "inpe_prodes", title: "PRODES deforestation" }).startsWith("Forest cleared each year, Brazil's official count") &&
        plain.plainTitle({ name: "concessionhgu_spv", title: "Plantation land-use rights (HGU)" }).startsWith("Plantation land leases") &&
        plain.plainTitle({ name: "x_unknown", title: "Kept as it is" }) === "Kept as it is" &&
        plain.plainTitle({ name: "M", title: "T", label: "Shown" }) === "Shown" &&
        /row\.dataset\.orig = item\.title;/.test(src) && /if \(el && el\.dataset && el\.dataset\.orig\) return el\.dataset\.orig;/.test(src) &&
        Object.keys(plain.CATALOGUE_PLAIN).length > 200 && Object.keys(plain.TRASE_PLAIN).length > 50);
  check("Trase rows and the merged cattle row carry plain labels", /e\.label = plain \? `\$\{plain\}\$\{unit\}/.test(src) && /name: e\.metric, title: e\.title, label: e\.label,/.test(src) && /plain: "Forest cleared for cattle"/.test(src));
  check("confusing row names are plain", /id: "skytruth_voc", name: "Disabled and sunken ships that could spill oil/.test(src) && /id: "wasteatlas_mbt", name: "Plants that sort and compost mixed rubbish/.test(src));
  const d = at("Deforestation"), next = o.PANEL_ORDER.findIndex((x, i) => i > d && x && x.h === 3);
  const h4 = o.PANEL_ORDER.slice(d, next).filter((x) => x && x.h === 4).map((x) => x.t);
  check("Deforestation reads Forest cover, Forest zoning, Tree cover loss and alerts, The Culprits, Companies and financiers, Mangroves",
        JSON.stringify(h4) === JSON.stringify(["Forest cover", "Forest zoning and management plans", "Tree cover loss and alerts", "The Culprits", "Deforestation promises", "Companies and financiers", "Mangroves", "Peatland"]));   // round 132b: promises   // round 92b: Peatland last
  const c = at("The Culprits");
  check("The Culprits holds the logging, plantation, timber crime and wood pulp headings",
        ["Logging and timber concessions", "Timber and rubber plantations", "Illegal logging and timber trafficking", "Wood pulp, Indonesia"].every((h) => { const i = at(h); return i > c && i < at("Companies and financiers") && o.PANEL_ORDER[i].h === 5; }));
  check("Indonesia's plans sit inside Forest zoning", o.PANEL_ORDER.findIndex((x) => x && x.bundle === "plans") === at("Forest zoning and management plans") + 1 &&
        f("x", "idn_forest_area").endsWith("Forest zoning and management plans > Indonesia's land-use plans, state forest estate and ban on new clearing permits"));
  check("Trase's concession area is out, its peatland clearing for pulpwood under Peatland, the Natural Lands Map under Forest cover",
        f("Concession area (ha) \u2014 Indonesia (Trase)", "CONCESSION_AREA") === "(taken out)" &&
        f("Peatland deforestation for planted pulpwood (ha) \u2014 Indonesia (Trase)", "DEFORESTATION_ON_PEAT") === P + " > Deforestation > Peatland" &&
        f("x", "sbtn_natural_lands_classification") === P + " > Biodiversity loss > Land Use and Ecoregions");   // round 99b: there instead
  check("the switches' label sits above them so each reads whole", /<span class="ks-l">Turn on every<\/span><span class="ks-row">/.test(src) && /\.kind-switch \.ks-l\{flex-basis:100%\}/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 89);
}

console.log("\nround 90b: the Atlas's hotspots open no box; its numbers are easy to hit; its PDF keys in the layer menu; its cities stand out; Fields of The World and Potapov's cropland");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("a hotspot opens no box: its click lays the Atlas's map, and a second click inside the one open does nothing",
        /if \(hit\.cfg\.pdfs\) return openAtlasHotspot\(hit\);/.test(src) && /if \(m && atlasOwner === hit\.cfg\.id && atlasOpenKey === m\[1\]\) return;/.test(src));
  check("the hotspot's area and outer limit are one hotspot, not a list of two", /const k = h\.cfg\.id \+ "\|" \+ \(h\.props\.n \|\| ""\);/.test(src));
  check("a number's click is its own: no list of places, and a click near a number is never the hotspot's",
        /el\.addEventListener\("click", \(ev\) => \{ popupClaimedBy = ev; atlasNumberTipOff\(\); \}\);/.test(src) && /if \(nearAtlasNumber\(e\)\) return;/.test(src) && /min-width:26px;height:26px/.test(src));
  const leg = JSON.parse(fs.readFileSync(path.join(HERE, "atlas", "legends.json"), "utf8"));
  const hot = Object.values(leg.hotspots);
  check("the keys printed on the PDFs were read, with their swatches", hot.length === 32 && hot.filter((h) => h.map).length >= 20 && hot.filter((h) => h.conflicts).length >= 20 &&
        leg.swatches.every((u) => u.startsWith("data:image/png;base64,")) && hot.every((h) => Object.values(h).every((items) => items.every(([t, i]) => t && leg.swatches[i]))));
  const html2 = new Function("escapeHtml", src.slice(src.indexOf("function atlasLegendHtml("), src.indexOf("async function atlasLegendShow(")) + "; return atlasLegendHtml;")((x) => String(x));
  const one = Object.keys(leg.hotspots).find((k) => leg.hotspots[k].map && leg.hotspots[k].conflicts);
  check("the menu shows the open hotspot's own keys, and before one is open the keys with its name as The hotspot",
        /Key of the Atlas's conflicts map/.test(html2(leg, one)) && /The hotspot</.test(html2(leg, null)) && /atlasLegendShow\(owner, what\.plate\)/.test(src));
  check("the Atlas's cities stand out: larger, lighter, edged, over a soft ring", /id: "atlas_cities"[\s\S]{0,200}standout: \{ fill: "#8FD6E8"/.test(src) && /if \(cfg\.standout\) \{\n    const pt = `\$\{cfg\.id\}-pt`, ring = `\$\{cfg\.id\}-ring`;/.test(src));
  check("Fields of The World is read from its own archive; Potapov's cropland from the map's copy, both under Agriculture > Cropland",
        /id: "ftw_fields"[^\n]*route: "pmvector"/.test(src) && /ftw-global-fields-2025\.pmtiles", sourceLayer: "fields"/.test(src) &&
        /\{ h: 5, t: "Cropland" \}, "ftw_fields", "potapov_cropland",/.test(src) && /: cfg\.route === "pmvector" \? Promise\.resolve\(\)\.then\(\(\) => addPmVectorLayer\(cfg\)\)/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 90);
}

console.log("\nround 91b: Global Safety Net's layers back, titled plainly and filed by kind; its rankings the map's own shading; the duplicate own layers out");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the gsn row reads the viewer's layers again, its menu row out of sight", /id: "gsn", name:[^\n]*route: "gsn"/.test(src) && /: cfg\.route === "gsn" \? addGsnLayer\(cfg\)/.test(src) && /guard: \["gsn"\]/.test(src));
  check("round 90b's duplicates of Global Safety Net's layers are gone; the mangroves and critical habitat built from their sources stay",
        !["wdpa_strict", "wdoecm", "lc_broadleaf", "lc_water", "own_modification", "own_wilderness", "own_reforestation"].some((i) => src.includes(`id: "${i}"`)) &&
        ["own_mangroves", "own_critical_habitat", "ftw_fields", "potapov_cropland"].every((i) => src.includes(`id: "${i}"`)) && !/LAND_KINDS|wcmcExport/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 91);
}

console.log("\nround 92b: land cover in 35 kinds under Land Use and Ecoregions; land use plot by plot under Buildings; natural forests under Forest cover; Peatland inside Deforestation, the worldwide map first");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the moves are in the order of the box", /\{ h: 4, t: "Land Use and Ecoregions" \}, "ecoregions_2017", "glc_fcs30d",/.test(src) && /\{ h: 1, t: "Buildings" \}, "building_types", "osm_landuse",/.test(src) &&
        /\{ h: 4, t: "Mangroves" \}, "own_mangroves",[\s\S]{0,400}\{ h: 4, t: "Peatland" \},/.test(src) && !/\{ h: 3, t: "Peatland" \}/.test(src));
  check("the worldwide peatland map leads its heading", /const CATALOGUE_FIRST = new Set\(\[[^\]]*"gfw_peatlands"/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 92);
}

console.log("\nround 93b: Surface water under Water scarcity; the ever-seen water drawn; reservoirs red and blue; Aqueduct's copies; dry spells see-through");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("anywhere water was ever seen is the occurrence map in one colour (the JRC has no extent tiles)",
        /GSW_EXTENT = `remap:\/\/gsw_extent\/storage\.googleapis\.com\/water-world\/tiles2024\/occurrence\/\{z\}\/\{x\}\/\{y\}\.png`/.test(src));
  const w = new Function("GLAD_OUT", src.slice(src.indexOf("const WATER_LESS"), src.indexOf("function waterSignColour(")) + "; return { waterSignExpr, WATER_LESS, WATER_MORE };")(new Set());
  const a = w.waterSignExpr({ sign: { months: true } }, [{ "2025_01": 10, "2025_01_monthly": 12, "2025_03": 9, "2025_03_monthly": 10, "2025_04": "" }]);
  const b = w.waterSignExpr({ sign: { months: true } }, [{ "2025_03": -4 }, { "2025_03": 2 }]);
  const c = w.waterSignExpr({ sign: { field: "anomaly" } }, [{ anomaly: -1 }]);
  check("a reservoir below its usual is red and above it blue: by area against usual, or by the anomaly where the column holds one",
        a.month === "2025-03" && a.rule === "area against the usual area" && JSON.stringify(a.expr).includes('"2025_03_monthly"') &&
        b.rule === "the anomaly" && c.rule === "the anomaly" && JSON.stringify(c.expr).includes(w.WATER_LESS) && JSON.stringify(c.expr).includes(w.WATER_MORE));
  const ch = new Function(src.slice(src.indexOf("const CHOOSE_RAMP"), src.indexOf("function addPmChooseLayer(")) + "; return { chooseLabelOrder, chooseBreaks };")();
  const o = ch.chooseLabelOrder([{ l: "High (40-80%)", r: 3 }, { l: "Low (<10%)", r: 0.5 }, { l: "No data", r: null }, { l: "High (40-80%)", r: 3.4 }], "l", "r");
  check("basins are ranked light to dark by the values behind WRI's categories; categories with no value grey",
        o.valued.join("|") === "Low (<10%)|High (40-80%)" && o.bare.join() === "No data");
  check("crop figures step on Aqueduct's 0 to 5 scale when they fit it, and on their own fifths when not",
        ch.chooseBreaks([0.2, 4.9, 3]).scale === "Aqueduct's 0 to 5 scale" && ch.chooseBreaks([1, 20, 300, 4000, 50000, 60000]).labels.length >= 2);
  check("the Borneo surface water change and Global Forest Watch's two Aqueduct copies are out; the dry spells picture is see-through",
        /\[\/IDNMYSBorneo_WaterChangeRGB/.test(src) && /nexgddp_change_dry_spells_2000_2080: \{ "raster-opacity": 0\.42 \}/.test(src) &&
        !/\{ h: 3, t: "Surface water" \}/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 93);
}

console.log("\nround 94b: Liberia's mines and Merauke's roads out; fur farms worldwide under Meat and agriculture; natural disasters of every kind; the earthquakes' timeline; the crime tracker under Environmental crime; the mangroves under Deforestation; dead zones and deep-sea mining");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const t = new Function(src.slice(src.indexOf("function timelineMonths("), src.indexOf("function addTimeline(")) + "; return { timelineMonths, monthAfter, timelineExpr };")();
  const cfg = { timeline: { field: "x_date", from: "2011-01", to: "2015-12" } };
  const months = t.timelineMonths("2011-01", "2015-12");
  cfg._timePick = [0, months.length - 1];
  const all = t.timelineExpr(cfg);
  cfg._timePick = [12, 23];
  const e = t.timelineExpr(cfg);
  check("the timeline runs month by month; the whole span filters nothing; a chosen span keeps its months only",
        months.length === 60 && all === null && JSON.stringify(e).includes('"2012-01"') && JSON.stringify(e).includes('"2013-01"') && t.monthAfter("2012-12") === "2013-01");
  check("both earthquake rows carry the timeline, and it narrows the row's own filter",
        /id: "skytruth_quakes"[\s\S]{0,400}timeline: \{ field: "x_date", from: "2011-01", to: "2015-12" \}/.test(src) && /id: "usgs_quakes"[\s\S]{0,300}timeline: \{ field: "x_date", from: "1900-01", to: "now" \}/.test(src) &&
        /addPmtilesLayer\(cfg\)\.then\(\(\) => \{ if \(cfg\.timeline\) addTimeline\(cfg\); \}\)/.test(src));
  check("Natural disasters holds every kind together and each kind", ["haz_gdacs", "haz_eonet", "usgs_quakes", "haz_volcanoes", "haz_eruptions", "haz_tsunamis", "haz_cyclones", "haz_landslides"].every((i) => src.includes(`id: "${i}"`)) &&
        /\{ h: 4, t: "Every kind together" \}, "haz_gdacs", "haz_eonet",/.test(src));
  check("the crime tracker is under Environmental crime; Liberia's mines, Merauke's roads and the broken coral copy are out",
        /"raisg_illegal_mining", "powerbi_report",\n/.test(src) && /\[\/\\blbr_\(development_exploration_license\|mineral_development_agreement\|mineral_exploration_license\)\\b\/, null\]/.test(src) &&
        /merauke_road_plan/.test(src) && /\[\/\\bbenthic_allencorral_global\\b\/, null\]/.test(src));
  check("fur farming law by country, and the new Oceans headings", /id: "fur_bans"[^\n]*route: "countrycat"/.test(src) && /\{ h: 5, t: "Dead zones"[^\n]*\}, "ocean_dead_zones",/.test(src) && /\{ h: 5, t: "Deep-sea mining"[^\n]*\}, "ocean_seabed_mining",/.test(src));   // round 132b
  check("the page asks for this round's script", appVersion(html) >= 94);
}

console.log("\nround 95b: rows back where asked; environmental law; skin farms; the plastic polluters; livestock raised by density; everyday names; four ocean layers");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const removed = src.slice(src.indexOf("const PANEL_REMOVED"), src.indexOf("function syncHeadingBoxes"));
  check("the rows asked back are back, each where asked",
        ["cultivated_meat_laws", "site_ufo_pre1900", "slavery_trackers", "site_environment_law", "enviro_law_by_country", "ect_secrets", "isds_tracker"]
          .every((i) => !removed.includes(`"${i}"`)) &&
        // Round 123b: the areas row is folded into the country row.
        /\{ h: 3, t: "Environmental law" \}, "site_environment_law", "enviro_law_by_country", "ect_secrets", "isds_tracker",/.test(src) &&
        /"ufo_sightings", "site_ufo_pre1900",/.test(src) && /\{ h: 5, t: "Meat grown from cells" \}, "cultivated_meat_laws",/.test(src) &&   // round 100b: last under Meat
        /"slavery_trackers",/.test(src.slice(src.indexOf("const PANEL_ORDER"))));
  check("every row named in everyday words is renamed at start, and keeps its name", /const PLAIN_NAMES = \{/.test(src) && /row\.name = PLAIN_NAMES\[row\.id\]; row\.fixedName = true;/.test(src) &&
        /land_matrix: "Land deals: large areas of farmland and forest bought or leased by investors, often from abroad \(Land Matrix\)"/.test(src));
  const nw = new Function(src.match(/function notWorldwide\(t\) \{[\s\S]*?\n\}\n/)[0] + "; return notWorldwide;")();
  check("the plantation layers are not called worldwide", nw("Plantations of every kind 2024 — worldwide") === "Plantations of every kind 2024" && nw("Smallholder plantations 2025 — worldwide") === "Smallholder plantations 2025");
  check("Berkeley Earth's warmer years under Extreme heat; worn-out pasture out; the frontier kept only under Where clearing is likely",
        // Round 123b: GFW's copy draws nothing; the map's own (berkeley_warming) instead.
        /\[\/\\bberkeley_earth_temp_anomaly_2000_2020\\b\|annual surface temperature anomal\/i, null\]/.test(src) &&
        /\[\/\\blapig_degraded_pasture\\b\|degraded pasture\/i, null\]/.test(src) && /\{ h: 5, t: "Extreme heat" \}, "berkeley_warming",/.test(src));
  const g = new Function(src.slice(src.indexOf("function glwRamp("), src.indexOf("async function addGlwRelief(")) + "; return glwRamp;")();
  check("livestock is raised by density, animal by animal, from its own copy", /id:"abattoir_glw"[^\n]*route:"glwrelief"/.test(src) && g(400)[g(400).length - 1][0] === 400 && g(40000).length === 6 &&
        /archiveBase: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/tiles\/glw_"/.test(src));
  check("skin farms, the plastic polluters and the four ocean layers are rows, under their headings",
        /\{ h: 4, t: "Skin farms" \}, "skin_farms",/.test(src) && /\{ h: 6, t: "The companies behind it" \}, "plastic_polluters",/.test(src) &&
        ["ocean_acid", "ocean_heat", "ocean_shipping", "ocean_impacts"].every((i) => new RegExp(`id: "${i}"[\\s\\S]{0,600}choicesUrl: "https://welcometoyourgalaxy\\.github\\.io/culprits-tiles-more/tiles/${i}\\.choices\\.json"`).test(src)));
  check("the page asks for this round's script", appVersion(html) >= 95);
}

console.log("\nround 96b: the View box laid out afresh; the frontier under Forest zoning");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const v = src.slice(src.indexOf("function viewPanelHtml()"), src.indexOf("function buildBasemapPanel()"));
  // Round 106b: 3D terrain is a box of its own after the View box, the notes and Raise figures under it.
  check("3D terrain in its own box after the views, Place names under North up, the 3D notes and Raise figures after it",
        v.indexOf('id="terrain-toggle"') > v.indexOf('id="leave-earth"') && v.indexOf('sectHead("3D terrain", "terrain")') < v.indexOf('id="terrain-toggle"') &&
        v.indexOf('class="how-3d"') > v.indexOf('id="terrain-toggle"') && v.indexOf('id="lift-toggle"') > v.indexOf('class="how-3d"') &&
        v.indexOf('id="theme-pick"') < v.indexOf('id="compass-holder"') && v.indexOf('North up, level') < v.indexOf('id="names-toggle"') &&
        v.indexOf('id="names-toggle"') < v.indexOf('id="to-globe"') && v.indexOf('class="how-3d"') > v.indexOf('id="leave-earth"'));
  check("the zoom buttons larger and centred in their space", /\.view-zoom\{flex:1 1 auto;align-self:center;display:flex;justify-content:center\}/.test(html) && /grid-template-columns:36px;/.test(html));
  const { f } = { f: (t, id = "") => new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")()(`${t} ${id}`, `${t} ${id}`).join(" | ") };
  check("Colombia's agricultural frontier is under Deforestation > Forest zoning and management plans, not Plantations",
        f("Frontera agrícola nacional", "col_frontera_agricola") === "Destruction > Of the planet > Deforestation > Forest zoning and management plans");
  check("the page asks for this round's script", appVersion(html) >= 96);
}
console.log("\nround 98b: the Atlas's numbers name their cities; a click outside goes back; five more hotspot maps placed by their coasts; the city maps in a panel");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "atlas_plates.py"), "utf8");
  const plates = JSON.parse(fs.readFileSync(path.join(HERE, "atlas", "plates.json"), "utf8"));
  check("hovering a number shows that city's name, and the hotspot's note is held back",
        /el\.addEventListener\("mouseenter", \(\) => atlasNumberTip\(c\)\);/.test(src) &&
        /if \(nearAtlasNumber\(e\)\) \{ hideSitemapTooltip\(\); return; \}/.test(src) && /\$\{escapeHtml\(c\.n \+ "\. " \+ c\.title\)\}/.test(src));
  check("a click on the map that nothing else takes closes the open hotspot or city and flies back to the view from before",
        /map\.on\("click", atlasOutsideClick\)/.test(src) && /if \(!atlasOwner \|\| popupClaimedBy === claim \|\| nearAtlasNumber\(e\)\) return;/.test(src) &&
        /if \(back && view && typeof map\.flyTo === "function"\) \{\s*map\.flyTo/.test(src) && /if \(hits\[0\]\.cfg\.route === "atlascities"\) atlasRemember\(\);/.test(src) &&
        /t\.closest\("\.maplibregl-popup, \.maplibregl-marker, #atlas-city, #atlas-panel"\)/.test(src));
  // The go-back, run: opened from one view, closed by a click nothing took.
  {
    const body = src.slice(src.indexOf("let atlasReturnView = null"), src.indexOf("// what: { plate, doc } for a hotspot"));
    const flown = [];
    const fakeMap = { getCenter: () => ({ lng: 10, lat: 20 }), getZoom: () => 3, getBearing: () => 0, getPitch: () => 0, flyTo: (o) => flown.push(o) };
    const f = new Function("map", "atlasPlateOff", "popupClaimedBy", "nearAtlasNumber", "setTimeout",
      "let atlasOwner = null;" + body + "; return { atlasRemember, atlasClose, own: (o) => { atlasOwner = o; } };");
    const t = f(fakeMap, () => {}, null, () => false, (fn) => fn());
    t.atlasRemember(); t.own("atlas_hotspots"); t.atlasClose(true);
    const first = flown.length === 1 && flown[0].zoom === 3 && flown[0].center[0] === 10;
    // Closed another way (its row unticked), the next opening takes the view anew.
    t.own(null); t.atlasRemember(); fakeMap.getZoom = () => 7; t.own(null); t.atlasClose(true);
    check("…run: the view from before it opened is the one flown back to", first && flown.length === 2 && flown[1].zoom === 3);
  }
  const coast = ["madagascar", "new_caledonia", "southwest_australia", "western_ghats_sri_lanka", "east_melanesian_islands"];
  check("Madagascar, New Caledonia, Southwest Australia, the Western Ghats and the East Melanesian Islands are placed by their coasts, their error measured",
        coast.every((k) => plates[k].kept && /coasts laid on Natural Earth/.test(plates[k].placed_by) && plates[k].error_km < plates[k].width_km * 0.01 &&
          plates[k].coast_fit.land_and_sea_agree >= 0.85 && plates[k].detail.length === 16 && fs.existsSync(path.join(HERE, plates[k].image))));
  check("…by a fit that is kept only when land and sea agree and the coasts are close", /def place_by_coast\(page, width_pt, height_pt, bar_km_per_pt, box, cache_dir\):/.test(py) &&
        /COAST_MIN_AGREE = 0\.85/.test(py) && /coast = place_by_coast\(page, w, h, bar, box, CACHE\)/.test(py));
  check("the city maps: only a placement read by the scale bar is laid down; the rest are the Atlas's picture in a panel",
        /const ATLAS_CITY_METHOD = 3;/.test(src) && /if \(what\.cityPlate && !\(p && p\.v === ATLAS_CITY_METHOD\)\) p = null;/.test(src) &&
        /img\.src = ATLAS_CITY_IMG \+ \(ATLAS_CITY_IMG_NAME\[slug\] \|\| slug\) \+ "\.png";/.test(src) && /The Atlas's map of this city<\/button>/.test(src));
  check("the country rankings say they are not built yet, not 404, until their copy is made",
        /id: "gsn_countries"[\s\S]{0,400}buildScript: "gsn_rankings"/.test(src) && /not built yet: its copy has not been made\$\{cfg\.buildScript/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 98);
}
console.log("\nround 99b: Biodiversity loss refiled; one row each for critical habitat, intactness and the intact forests; own copies of the 2017 ecoregions and the intact forests; the ecozones and nematodes coloured");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const o = new Function(src.slice(src.indexOf("const BUNDLES = {"), src.indexOf("const ZDC = ")) + src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("];", src.indexOf("const PANEL_ORDER = [")) + 2) + "; return { PANEL_ORDER, BUNDLES };")();
  const heads = (from, to) => o.PANEL_ORDER.slice(o.PANEL_ORDER.findIndex((x) => x && x.t === from), o.PANEL_ORDER.findIndex((x) => x && x.t === to)).filter((x) => x && x.t && x.h === 4).map((x) => x.t);
  check("Biodiversity loss reads Land Use and Ecoregions, Places that matter most for species, Disturbance, Birds, Fish, Soil, Wildlife and timber crime, Companies and financiers",
        JSON.stringify(heads("Biodiversity loss", "Water scarcity")) === JSON.stringify(["Land Use and Ecoregions", "Places that matter most for species", "Disturbance", "Birds", "Fish", "Soil biodiversity", "Wildlife and timber crime", "Companies and financiers"]));
  const i = o.PANEL_ORDER.findIndex((x) => x && x.t === "Places that matter most for species");
  const fives = o.PANEL_ORDER.slice(i, o.PANEL_ORDER.findIndex((x) => x && x.t === "Disturbance")).filter((x) => x && x.h === 5).map((x) => x.t);
  check("…and Places that matter most for species in five parts", JSON.stringify(fives) === JSON.stringify(["Where species are threatened", "Protected areas", "Species richness", "Wild and intact places", "Where animals gather and migrate"]) &&
        !o.PANEL_ORDER.some((x) => x && (x.t === "Protected and conserved areas" || x.t === "Intact and primary forests")));
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const lib = new Function(cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT, IN };")();
  const f = (t) => lib.cataloguePlaces(t, t).join(" | ");
  const P = "Destruction > Of the planet", B = P + " > Biodiversity loss", M = B + " > Places that matter most for species";
  check("Global Safety Net: the ITTs under Invasion of humans; the black HM90 and the land outline out; the climate stabilization areas under Carbon dioxide",
        f("ITT's Recognized (Global Safety Net) 4") === "On-planet invasion > Invasion of the living > Invasion of humans > Where Indigenous peoples and local communities live" &&
        f("Modified Land (HM90) (Global Safety Net) 27") === lib.CATALOGUE_TAKEN_OUT && f("Land (Global Safety Net) 42") === lib.CATALOGUE_TAKEN_OUT &&
        f("HM90 (White) (Global Safety Net) 40") === B + " > Land Use and Ecoregions" &&
        f("Climate Stabilization Areas (Global Safety Net) 12") === P + " > Climate > Carbon dioxide > Carbon stored in nature");
  check("…the regrowth under Deforestation too; natural, semi-natural land and the FAO zones and SBTN map under Land Use and Ecoregions",
        f("Constrained Reforestation (Global Safety Net) 41") === P + " > Deforestation > Forest cover | " + B + " > Land Use and Ecoregions" &&
        ["Natural and Barren Land (Global Safety Net) 43", "Seminatural Land (Global Safety Net) 48", "x fao_ecozones", "x sbtn_natural_lands_classification"].every((t) => f(t) === B + " > Land Use and Ecoregions"));
  check("…AIBES, critical habitat and the priorities where species are threatened; the protected layers under Protected areas",
        ["Unprotected AIBES", "All AIBES", "AIB-Only", "AES-Only", "Conservation Priorities (top 10%)"].every((n) => f(`${n} (Global Safety Net) 1`) === M + " > Where species are threatened") &&
        f("Critical habitats - marine (Global Safety Net) 97") === lib.IN(M + " > Where species are threatened", "crithab") &&
        ["Strictly Protected", "Protected", "OECMs", "Documented CAs", "PA/OECM Overlay"].every((n) => f(`${n} (Global Safety Net) 1`) === M + " > Protected areas") &&
        f("Protected areas x protectedarea_spv") === M + " > Protected areas");
  check("…richness, wildness and the gatherings each their part; the two intactness halves one row",
        f("High Biodiversity Areas (Global Safety Net) 9") === M + " > Species richness" && f("Wild & Intact Areas (Global Safety Net) 11") === M + " > Wild and intact places" &&
        f("Mammal Assemblages (Global Safety Net) 10") === M + " > Where animals gather and migrate" &&
        f("Biodiversity Intactness Index (0 - 50) (Global Safety Net) 94") === lib.IN(M + " > Wild and intact places", "bii") &&
        f("x ifl_intact_forest_landscapes") === lib.IN(M + " > Wild and intact places", "ifl"));
  check("the 2017 ecoregions and the five years of intact forest drawn from the map's own copies, the ecoregions coloured by biome",
        /id: "ecoregions_2017"[^\n]*route: "pmchoose"/.test(src) && /mode: "classes", menus: \[\], field: "BIOME_NUM"/.test(src) &&
        ["2000", "2013", "2016", "2020", "2025"].every((y) => new RegExp(`id: "ifl_${y}"[^\\n]*route: "pmvector"[^\\n]*own: true`).test(src)) &&
        /cfg\.own \? "not built yet: its copy has not been made"/.test(src));
  check("the FAO ecological zones coloured by zone; the ecoregions' title says what they are",
        /fao_ecozones: \{ fields: \["gez_term"\]/.test(src) && /wwf_terrestrial_ecoregions: "Ecoregions, 2001 version: the world's land in 867 natural regions/.test(src));
  check("the nematode samples coloured by how many nematodes each holds", /colourBy: \{ field: "Total_Number", steps: \[250, 600, 1300, 3300, 10000\]/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 99);
}
console.log("\nround 100b: skin and fur farms their own heading; the food industry's owners under Meat; zoos off the facilities; amounts as colours; heights raised; points raised where they crowd; public money behind the harm; fish; the fields wider out; the hologram's blue off");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const o = new Function(src.slice(src.indexOf("const BUNDLES = {"), src.indexOf("const ZDC = ")) + src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("];", src.indexOf("const PANEL_ORDER = [")) + 2) + "; return { PANEL_ORDER, BUNDLES };")();
  const at = (t, from = 0) => o.PANEL_ORDER.findIndex((x, i) => i >= from && x && x.t === t);
  const meat = at("Meat", at("Meat and agriculture"));
  check("fur and skin farms under their own heading, out of Meat and agriculture",
        at("Animal skin and fur farms") > meat && at("Animal skin and fur farms") < at("Oceans") && o.PANEL_ORDER[at("Animal skin and fur farms")].h === 3 &&
        o.PANEL_ORDER.indexOf("fur_world") > at("Animal skin and fur farms") && o.PANEL_ORDER.indexOf("skin_farms") > at("Animal skin and fur farms"));
  // Round 112b: straight under Meat and agriculture above the land deals; The culprits heading gone.
  check("who owns the food industry under Meat and agriculture, above the land deals; meat grown from cells last, retitled",
        o.PANEL_ORDER.indexOf("site_food_system") === at("Meat and agriculture") + 1 && o.PANEL_ORDER.indexOf("land_matrix") === at("Meat and agriculture") + 2 && at("The culprits", meat) === -1 &&
        o.PANEL_ORDER.indexOf("cultivated_meat_laws") === at("Meat grown from cells", meat) + 1 && at("Meat grown from cells", meat) + 2 === at("Animal skin and fur farms") &&
        /cultivated_meat_laws: "Where meat grown from cells, as an alternative to slaughter, is restricted or banned/.test(src));
  check("zoos are off the registered facilities (a zoo a register marks as slaughtering stays)",
        /name:"Registered animal-use facilities \\u2014 sites on official registers: slaughterhouses, farms, dairies and hatcheries \(abattoir atlas\)",\n[^\n]*\n[^\n]*\n[^\n]*\n\s*where: \["!", \["all", \[">=", \["index-of", "zoo"/.test(src));
  check("the linked-out pages are out of Biodiversity loss; the crime index's wildlife scores are in, and the public-money rows in Subsidising Extinction's place",
        /\{ h: 4, t: "Wildlife and timber crime" \}, "goc_flora", "goc_fauna",/.test(src) && /"pe_subsidising",\n/.test(src.slice(src.indexOf("const PANEL_REMOVED"))) &&
        /\{ h: 5, bundle: "publicharm", colour: "#5E6470" \}, "wb_harm_projects", "imf_fossil_subsidies",/.test(src) &&
        /id: "wb_harm_projects"[^\n]*route: "geojsonlive"/.test(src) && /id: "imf_fossil_subsidies"[^\n]*route: "country"/.test(src));
  check("point rows with an amount are coloured by it",
        ["bocc", "largest_companies", "largest_banks", "pe_banks", "haz_ncei_quakes", "haz_eruptions", "haz_tsunamis"].every((i) => new RegExp(`id: "${i}"[^\\n]*\\n\\s*// Round 100b[^\\n]*\\n\\s*colourBy: \\{ field: "`).test(src)));
  const aw = new Function(src.match(/function amountWords\(v\) \{[\s\S]*?\n\}\n/)[0] + "; return amountWords;")();
  check("…amounts said in billions, and small figures keep a decimal", aw(4.2e10) === "42 billion" && aw(6.5) === "6.5" && aw(2500) === "2,500");
  check("relief stands three times as tall from the world view, as before from zoom 5 in",
        /const RELIEF_BOOST = 3;/.test(src) && /const boost = 1 \+ \(RELIEF_BOOST - 1\) \* Math\.max\(0, Math\.min\(1, \(5 - z\) \/ 3\)\);/.test(src));
  check("country shading raised by its figure, switched in the View box",
        /id: `\$\{cfg\.id\}-lift`,\n\s*type: "fill-extrusion",/.test(src) && /id="lift-toggle"/.test(src) && /if \(e\.target && e\.target\.id === "lift-toggle"\) setLift\(e\.target\.checked\);/.test(src));
  const g = new Function("POINT_RELIEF_RES", src.slice(src.indexOf("function pointReliefGrid("), src.indexOf("function pointReliefValues(")) + "; return pointReliefGrid;")(0.25);
  const grid = g([[10.1, 20.1], [10.1, 20.1], [10.2, 20.2], [-50, -30]]);
  check("points raised where they crowd: counted on the ground, smoothed, the densest the tallest",
        grid.max > 0 && grid.g[Math.floor((90 - 20.1) / 0.25) * grid.W + Math.floor((10.1 + 180) / 0.25)] === grid.max &&
        /function riseRow\(id, on, tries\)/.test(src));
  check("fish: free-flowing rivers and fish species by basin, under Fish",
        /\{ h: 4, t: "Fish" \}, ("fish_stocks", "lpi_populations", )?"fish_rivers", "fish_basins",/.test(src) && /id: "fish_rivers"[^\n]*route: "rasterlive"/.test(src) && /id: "fish_basins"[^\n]*route: "pmchoose"/.test(src));
  check("the fields counted wider out, under the shapes", /overview: \{ choicesUrl: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/tiles\/ftw_overview\.choices\.json", maxzoom: 9 \}/.test(src) &&
        /if \(cfg\.overview\) pmVectorOverview\(cfg\);/.test(src));
  check("the hologram's blue shading can be switched off", /tick\("holo-shade", "shade", "Blue shading"/.test(html) && /const earthOn = on && opt\.shade && /.test(html) &&
        /body\.holo-on\.holo-noshade #map\{background:#0b0b0c\}/.test(html));
  check("the page asks for this round's script", appVersion(html) >= 991);
}
console.log("\nround 101b (28 September): By crop, plantations, palm oil, themes, regional layers");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const lib = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return { cataloguePlaces, CATALOGUE_TAKEN_OUT, AG, CROPS, PLANTS, IN, BUNDLES };")();
  const f = (t, id = "") => lib.cataloguePlaces(`${t} ${id}`, `${t} ${id}`);
  check("plantations of no single crop are inside Cropland; the crops under By crop",
        /\{ h: 5, t: "Cropland" \}, "ftw_fields", "potapov_cropland",\n\s*\{ h: 6, t: "Plantations of no single crop \(single crops are under By crop\)" \},/.test(src) &&
        /\{ h: 6, t: "Palm oil" \}, "crop_oilp",/.test(src) && lib.PLANTS === lib.AG + " > Cropland > Plantations of no single crop (single crops are under By crop)");
  check("each 2024 and 2025 pair is one layer",
        f("Plantations of every kind 2024", "Global_PlantationAll_2024")[0] === lib.IN(lib.PLANTS, "plantall") &&
        f("Smallholder plantations 2025", "Global_PlantationSmallholder_2025")[0] === lib.IN(lib.PLANTS, "plantsmall") &&
        f("Industrial oil palm plantations 2024", "Global_PlantationIOP_2024")[0] === lib.IN(lib.CROPS + " > Palm oil > Plantations", "palmco"));
  check("Cameroon's zones and the copy of the oil palm concessions are out; timber plantations go to Deforestation",
        f("Cameroon agro-industrial zones", "wri_cmr_agro_industrial_zones")[0] === lib.CATALOGUE_TAKEN_OUT &&
        f("Oil palm concessions (v3p3 copy)", "v3p3_concessioniop_spv")[0] === lib.CATALOGUE_TAKEN_OUT &&
        f("Industrial timber plantation concessions", "concessionitp_spv").every((x) => x.includes("Deforestation")));
  check("the crime tracker page is not under Of animals", !/"Of animals" \}, "powerbi_report"/.test(src));
  const T = new Function(src.slice(src.indexOf("function parseCssColour("), src.indexOf("function gladCss(")) +
    "const GLAD_TOP_INPUTS = new Set(['[\"zoom\"]', '[\"heatmap-density\"]', '[\"line-progress\"]']);" +
    src.slice(src.indexOf("function themeMatrix("), src.indexOf("function themeTouches(")) + "; return { themeMatrix, themeValue, themeCss };")();
  const M = T.themeMatrix([["hue-rotate", 140], ["saturate", 1.3], ["brightness", 1.15]]);
  const z = T.themeValue(["interpolate", ["linear"], ["zoom"], 0, "#1E6FA8", 8, ["get", "c"]], M);
  check("a theme turns fixed colours here and colours read from the data in the map, keeping a zoom curve on top",
        T.themeCss("#1E6FA8", M) === "#FF4761" && z[0] === "interpolate" && z[4] === "#FF4761" && z[6][0] === "let" &&
        T.themeCss("#1E6FA8", T.themeMatrix([])) === "#1E6FA8");
  check("the theme is chosen in the View box and follows the basemap when asked",
        /id="theme-pick"/.test(src) && /if \(e\.target && e\.target\.id === "theme-pick"\) setTheme\(e\.target\.value\);/.test(src) &&
        /var THEME_BY_BASEMAP = \{ atlas: "bright", satellite: "reds", outlines: "bright" \};/.test(src));
  const S = new Function(src.slice(src.indexOf("function seenPixels("), src.indexOf("maplibregl.addProtocol(\"grow\"")) + "; return { seenPixels };")();
  const px = new Uint8ClampedArray(5 * 5 * 4); px.set([40, 160, 60, 10], (2 * 5 + 2) * 4);
  S.seenPixels(px, 5, 3);
  check("a server's all-but-clear pixels are not raised into boxes", px.every((v, i) => i % 4 !== 3 || v === 0));
  check("Nusantara's regional layers are asked for only over their region", /const bounds = nusantaraBounds\(layers\[i\]\.name\);/.test(src) &&
        /"Papua": \[128\.5, -10, 141\.5, 1\]/.test(src));
  check("the Forest 500 soy scores are coloured red for the worst to blue", /recolour: \{ "#874545": \["#FF3B5C", 9\]/.test(src) && /if \(cfg\.recolour\) data = /.test(src));
  check("the planted trees map is drawn from its ready-made picture tiles", /gfw_planted_forests: \{ how: "raster", uri: "https:\/\/tiles\.globalforestwatch\.org\/gfw_planted_forests\/v20231128\/default/.test(src));
  check("blacklisted fishing vessels by flag, under Fishing and Environmental crime",
        /id: "iuu_vessels"[^\n]*route: "country"/.test(src) && /"fishing", "iuu_vessels", "iuu_positions",/.test(src) && /"goc_resources", "iuu_vessels",/.test(src));
}
console.log("\nround 102b (28 September): the insentient's kinds, Of groups, Christmas trees, asteroids on the flat map, launches, Eyes, worlds' pictures");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const D = new Function(src.slice(src.indexOf("function sitemapDropTypes("), src.indexOf("async function siteTypeRowsFor(")) + "; return sitemapDropTypes;")();
  const data = { filters: [{ label: "Type", rows: true, values: [{ k: "A", label: "A", n: 1 }, { k: "Luxury & fast fashion", label: "L", n: 2 }] }],
    features: [{ properties: { f: "|A|" } }, { properties: { f: "|Luxury & fast fashion|" } }, { properties: { f: "|Luxury & fast fashion|A|" } }] };
  const out = D({ dropTypes: ["Luxury & fast fashion"] }, data);
  check("three of the insentient's kinds are out of the box and off the map; a place of a kept kind as well stays",
        out.filters[0].values.length === 1 && out.features.length === 2 &&
        /dropTypes: \["Bottled & decorative water", "Collectibles & novelty", "Luxury & fast fashion"\], name: "The Insentient 2026"/.test(src));
  check("Destruction's Of groups holds Of humans alone; Of individuals Of humans and Of animals",
        /\{ h: 2, t: "Of groups" \},\n  \{ h: 3, t: "Of humans" \},\n  \{ h: 2, t: "Of individuals" \},\n[\s\S]{0,400}\{ h: 3, t: "Of humans" \},\n(  \{ h: 4, bundle[^\n]*\n){4}  \{ h: 3, t: "Of animals" \}, "site_animal_sacrifice",\n\n/.test(src));
  check("Christmas tree farms and sellers worldwide, the United States map inside it", /id: "xmas_trees"[^\n]*route: "geojsonlive"/.test(src) &&
        /"site_enslaved_plants", "xmas_trees",/.test(src) && /"mymaps_trees",/.test(src.slice(src.indexOf("const PANEL_REMOVED"))));
  check("the asteroids show round the flat map too, the map pulls back to them, and their see-through bar works",
        /R = Math\.hypot\(br\.x - tl\.x, br\.y - tl\.y\) \/ 2 \/ 1\.1;/.test(src) && /if \(on && !was\) pullBack\(\); draw\(\); \};\n  on = \(visibility/.test(src) &&
        /if \(ROW_OPACITY_HOOKS\.has\(id\)\) ROW_OPACITY_HOOKS\.get\(id\)\(f\);/.test(src));
  check("the launch rows are named in plain words and the pads' boxes have no map link",
        /name: "Rocket launch sites, worldwide \(The Space Devs\)"/.test(src) && !/>On a map<\/a>/.test(src));
  check("Eyes warms on the button and the map rests while Eyes has the screen",
        /for \(const ev of \["pointerenter", "focus", "touchstart"\]\) leave\.addEventListener/.test(src) && /setTimeout\(\(\) => \{ if \(AWAY\) pauseMapWhileAway\(true\); \}, 600\);/.test(src));
  check("each world's card has its picture from Wikipedia", /worldPicture\(wd\)\.then/.test(src) && /en\.wikipedia\.org\/api\/rest_v1\/page\/summary\//.test(src) && /Europa: "Europa \(moon\)"/.test(src));
  check("plantations spreading year by year lead their heading", /"gfw_peatlands", "Global_AllExpansionRGB_2000to2025", "pangaea_global_mining"\]\)/.test(src) && /CATALOGUE_FIRST\.has\(item\.id \|\| item\.name\)/.test(src));
}
console.log("\nround 103b (28 September): drug underworld colours, fertility policies, holiday culprits, fake science, one-line lists, headings dragged, slavery enforcement worldwide");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const order = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED")) + "; return PANEL_ORDER;")();
  const after = (h, id) => order.indexOf(id) > order.findIndex((x) => x && x.t === h);
  check("the drug underworld map's kinds each have their own colour, well apart, with a key",
        /id: "capture_map"[^\n]*\n\s*keepColour: true, recolour: \{ "F42A2A": "#E0304A"/.test(src) && /\["#E0304A", "Cartels and their cells"\]/.test(src));
  check("governments' birth-rate policies under Sex; holiday culprits under Holidays; who makes fake science under Science",
        /\{ h: 4, t: "Sex" \}, "fertility_policy",/.test(src) && /\{ h: 4, t: "Holidays" \}, "holiday_culprits",/.test(src) &&
        /\{ h: 4, t: "Science" \}, "site_research_integrity", "research_makers",/.test(src) && /id: "fertility_policy"[^\n]*route: "countrycat"/.test(src));
  check("the research integrity kinds are said plainly and stand out", /typeTitles: \{ "High-volume megajournal \(criticised\)": "Journals publishing huge numbers/.test(src) &&
        /standout: \{ keep: true, rim: "#F4F1EA" \}/.test(src) && /if \(!cfg\.standout\.keep\) map\.setPaintProperty\(pt, "circle-color"/.test(src));
  check("lists of places at one spot are one line each", /\.wtyg-pick button\{display:flex;[^\n]*white-space:nowrap\}/.test(src) && /maxWidth: "440px"/.test(src));
  check("headings are dragged like rows", /hg\.className = "grip grip-h";/.test(src) && /function moveHeading\(sec, where, target\)/.test(src) &&
        /if \(d\.sec\) \{ if \(d\.target\) moveHeading\(d\.sec, d\.where, d\.target\); return; \}/.test(src));
  check("slavery's routes apart from its cases and enforcement, with enforcement in every country",
        /\{ h: 5, t: "Routes" \}, "slavery_routes",\n\s*\{ h: 5, t: "Cases and enforcement" \}, "slavery_cases", "slavery_determinations", "slavery_enforcement",\n\s*"slavery_convicted_world", "slavery_detected_world", "slavery_cbp_world",/.test(src) &&
        after("Cases and enforcement", "slavery_cbp_world"));
  const reg = JSON.parse(fs.readFileSync(path.join(HERE, "..", "pipeline", "shapes", "registry.json"), "utf8"));
  check("what each country does about slavery is built again", reg.layers.some((e) => e.id === "slavery_trackers" && !e.retired));
}
console.log("\nround 104b (28 September): schools, taxes, stock market, spheres, trade flows, plain field names");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("School under Suppression by representation, with every school Giga maps and who made schooling a machine",
        /\{ h: 3, t: "Suppression by “representation” within it" \},\n[^\n]*\n[^\n]*\n  \{ h: 4, t: "School" \}, "school_culprits", "giga_school_points", "giga_countries",/.test(src) &&
        /id: "giga_school_points"[^\n]*route: "mvtlive"/.test(src) && /cfg\.route === "mvtlive" \? addMvtLiveLayer\(cfg\)/.test(src));
  check("taxes, interest and aid each a heading, out of Economic inequality, which keeps wealth and the stock market",
        /\{ h: 5, t: "Taxes" \}, "owid_corptax",\n  \{ h: 5, t: "Interest" \}, "owid_interest",\n  \{ h: 5, t: "Aid" \}, "owid_aid",\n  \{ h: 4, t: "Economic inequality within it" \},\n  \{ h: 5, t: "Wealth concentration" \}[^\n]*\n  \{ h: 5, t: "The stock market" \}, "stock_exchanges",/.test(src));
  check("Living off the land is out", !/t: "Living off the land"/.test(src) && /"site_subsistence_cultures", "site_self_sufficiency",/.test(src.slice(src.indexOf("const PANEL_REMOVED"))));
  const F = new Function(src.slice(src.indexOf("const FIELD_WORDS = {"), src.indexOf("function fieldRows(")) + "; return fieldLabel;")();
  check("field names that are codes are said in words; people's own names are left", F("iso3") === "Country code (ISO 3-letter)" && F("x_share_pct") === "Share %" &&
        F("Market cap (USD tn)") === "Market cap (USD tn)" && F("envassesmentcategorycode").startsWith("Environmental risk category"));
  const E = new Function(src.slice(src.indexOf("function rteEnd("), src.indexOf("function rteArc(")) + "; return rteEnd;")();
  const out = E([0, 0], [10, 0], true), inn = E([0, 0], [10, 0], false);
  check("a country's trade lines fan out round it: exports and imports leave from different points facing the partner",
        out[0] > 0 && inn[0] > 0 && out[1] < 0 && inn[1] > 0 && /"line-gradient": \["interpolate", \["linear"\], \["line-progress"\]/.test(src) && /data-rte-one/.test(src));
  check("the social spheres' lines run from hairline to thick", /\["interpolate", \["exponential", 1\.5\], \["get", "w"\], 1, 0\.4, maxW, 7\]/.test(src));
  check("who keeps the profits in trade is shaded from its own figure, darker for more",
        /site_trade_profits: \[\{ label: "share of the value of its exports that is made abroad[^\n]*\n\s*fromDetails: \/\(\[\\d\.\]\+\)% foreign\/, steps: \[5, 10, 15, 20, 30\]/.test(src));
  check("Global Trade Alert's in-force option is said plainly", /Still in effect today \(not yet ended or removed\)/.test(src));
}
console.log("\nround 105b (28 September): threat index, V-Dem, Troutwood's companies, Wreckers worldwide, one dynasties row, bank boxes, rates copy");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const order = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED")) + "; return PANEL_ORDER;")();
  check("where the threat is greatest: taken out in round 107b", /"threat_overall", "threat_destruction", "threat_suppression", "threat_crime", "vdem_liberal"/.test(src) || 
        order[1] && order[1].t === "Where the threat is greatest" && ["threat_overall", "threat_destruction", "threat_suppression", "threat_crime"].every((id, i) => order[2 + i] === id) &&
        (src.match(/culprits-tiles-more\/threat\/index\.json", field: "(overall|destruction|suppression|crime)" \}, linear: \[0, 1\]/g) || []).length === 4);
  check("V-Dem's scores: taken out in round 107b", /"vdem_civil", "vdem_regime",/.test(src.slice(src.indexOf("const PANEL_REMOVED"))) || 
        /\{ h: 5, t: "How democratic each country is \(V-Dem\)" \}, "vdem_liberal",/.test(src) && /id: "vdem_liberal"[^\n]*route: "owidgrapher"/.test(src) && /slug: "liberal-democracy-index",/.test(src));
  check("Troutwood's companies and Wreckers of the Earth worldwide are the map's own rows; the rows that only showed other sites' pages are out",
        /"stock_exchanges", "troutwood_companies",/.test(src) && /\{ h: 4, bundle: "wreckers", colour: "#7A1F3D" \}, "wreckers_umap", "wreckers_world",/.test(src) &&
        /"cfr_tracker", "tableau_zsf", "troutwood", "site_banking_dynasties_charts",/.test(src.slice(src.indexOf("const PANEL_REMOVED"))) &&
        !order.includes("cfr_tracker") && !order.includes("troutwood"));
  const box = new Function("escapeHtml", "boxOpen", "everyField", "amountWords",
    src.slice(src.indexOf("const cardLine = "), src.indexOf("// Round 81 (asked 27 September): a row coloured by one of its own figures,")) + "; return CARDS;")(
    (x) => String(x), "<div>", () => "", (v) => `${v / 1e9} billion`);
  const b = box.bank({ name: "KfW", total_assets_usd: 5e11, total_assets_in_dollars: "$538.8 billion", total_assets_year: "2017", rank: 1, owner: "Germany; Q1275809", hq: "Bonn", country: "Germany",
    employees: "6700", founded: "1948-11-18", wikidata: "https://www.wikidata.org/wiki/Q658270" }, "KfW", { rankOf: "of the development banks" });
  check("a bank's box leads with its assets and rank, says its facts in words, and hides bare Wikidata codes",
        b.includes("$538.8 billion") && b.includes("no. 1 of the development banks") && b.includes("Owned by") && !b.includes("Q1275809") && b.includes("6,700") && b.includes(">1948<"));
  const c = box.company({ name: "REX", symbol: "REX", market_cap: 1.4e9, sector: "Materials", industry: "Chemicals", group: "Chemicals and cement", city: "Dayton", country: "USA", price: 43.21, change_pct: 0.0086 }, "REX");
  check("a company's box leads with its market value", c.includes("1.4 billion") && c.includes("Materials: Chemicals") && c.includes("up 0.86%"));
  check("a copy written with NaN is still read (the rates row's unexpected token)", /t\.replace\(\/-\?\\bInfinity\\b\/g, "null"\)\.replace\(\/\\bNaN\\b\/g, "null"\)/.test(src));
  check("the dynasties' lines, coloured by era, under their points", /links: \{ url: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/banking\/dynasty_links\.geojson", field: "era",/.test(src) &&
        /if \(cfg\.links\) sitemapLinks\(cfg\)/.test(src));
  check("every development bank, with or without a figure", /all of them, not only the few with a total assets figure/.test(src) && /card: "bank", rankOf: "of the development banks/.test(src));
}
console.log("\nround 106b (28 September): the View and 3D terrain boxes, Turn on every at the bottom, lighter points, a loading mark, sublayers shown");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const kind = new Function(src.slice(src.indexOf("const KIND_POINT"), src.indexOf("// Round 106b: whether a drawn row's areas are whole countries")) + "; return { catalogueKind };")();
  check("boundaries and figures by country or province are national highlights, not shapes",
        kind.catalogueKind({ route: "wmsmenu" }, { name: "adminprovince_spv", title: "adminprovince_spv" }) === "national" &&
        kind.catalogueKind({ route: "gfw" }, { name: "gadm_administrative_boundaries", title: "GADM Administrative Boundaries" }) === "national" &&
        kind.catalogueKind({ route: "wmsmenu" }, { title: "Palm oil mills near the coast" }) === "point");
  check("Turn on every sits under the layers and says off when turning off", /if \(box\.after\) box\.after\(wrap\);/.test(src) && /verb = on \? "on" : "off";/.test(src));
  const L = new Function(src.slice(src.indexOf("function pointsOnly("), src.indexOf("function mapBusyMark(")) + "; return { pointsOnly, lighterPointSources };")();
  const got = [];
  const m = { addSource: (id, s) => got.push(s) };
  L.lighterPointSources(m);
  m.addSource("a", { type: "geojson", data: { features: [{ geometry: { type: "Point", coordinates: [0, 0] } }] } });
  m.addSource("b", { type: "geojson", data: { features: [{ geometry: { type: "Polygon", coordinates: [] } }] } });
  check("a source of points alone is cut into tiles to zoom 12 only; areas are left as they were", got[0].maxzoom === 12 && got[1].maxzoom === undefined);
  check("a loading mark while the map is still reading, and a notice if the browser pauses it", /el\.id = "map-busy";/.test(src) && /webglcontextlost/.test(src) && /#map-busy\{position:fixed/.test(html));
  check("ticking a layer with sublayers brings them into view, for the reader's own ticks only", /function revealSubRows\(t\)/.test(src) && /if \(!e\.isTrusted \|\| !t \|\| !t\.checked/.test(src));
  check("Layer colours under Flat map, narrow", /\.view-choices \.theme-pick select\{max-width:108px/.test(html));
}
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the owner's Attacks On Activists collection: killings, threats and cases, one by one, under Of individuals > Of humans",
        /bundle: "defenders", colour: "#9E2A3E" \}, "gw_defenders", "attacks_gw_killings", "attacks_land_resistance", "attacks_frontline",/.test(src) &&
        /id: "attacks_gw_killings"[^\n]*route: "geojsonlive"/.test(src) && /if \(cfg\.autoGroups && !cfg\.groupColours\)/.test(src) && /dates of birth and photo links included, at the owner\x27s word/.test(src));
}
console.log("\nround 107b (28 September): threat index and V-Dem out, the Pastoral Land Commission's tables, fires in South America");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the threat index and V-Dem rows are out of the menu, and no AI rows", /\/\/ Round 107b \(asked 28 September\): the threat index and V-Dem rows are not wanted\.\n  "threat_overall",[^\n]*"vdem_regime",/.test(src) &&
        !/\{ h: 1, t: "Where the threat is greatest" \}/.test(src) && !/ai_threat/.test(src));
  check("the Pastoral Land Commission's case tables and INPE's 2023 fires are rows",
        /"attacks_cpt_areas", "attacks_public_agencies", "attacks_cpt_land",/.test(src) && /"attacks_slave_labour_states", "attacks_cpt_slave_cases", "attacks_cpt_overexploitation",/.test(src) && /"ejatlas_water", "attacks_cpt_water",/.test(src) &&
        // Round 123b: INPE's 2023 fires taken out at the owner's word.
        /id: "inpe_fire_2023"[^\n]*route: "pmtiles"/.test(src) && /"inpe_fire_2023"/.test(src.slice(src.indexOf("const PANEL_REMOVED"))));
}
console.log("\nround 108b (28 September): the drag note above Selected Layers, an atlas-like relief, picture rows raised, the fires read again");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the note on dragging rows sits just above the Selected Layers heading", /hint\.id = "layer-drag-hint";/.test(src) && /box\.parentElement\.insertBefore\(hint, box\)/.test(src));
  const R = new Function("hexOf", src.slice(src.indexOf("const RELIEF_BANDS = "), src.indexOf("async function reliefTile(")) + "; return { RELIEF_BANDS, reliefBand, RELIEF_SHADE };")((c) => c);
  const light = (c) => (Math.max(c[0], c[1], c[2]) + Math.min(c[0], c[1], c[2])) / 510;
  check("the relief comes in eight steps, teal to cobalt, none of them white or green",
        R.RELIEF_BANDS.length === 8 && R.RELIEF_BANDS.every((c) => light(c) < 0.7 && c[2] >= c[1] - 10) && R.reliefBand(0) === 0 && R.reliefBand(1) === 7 && R.reliefBand(0.5) === 4);
  check("the relief's shading has no bright highlight or glow", R.RELIEF_SHADE["hillshade-highlight-color"] === "rgba(0, 0, 0, 0)" && !/#cfe8f4|#00c8ff/.test(src));
  check("each step is edged with a darker line, like contours", /const edge = rt !== b \|\| dn !== b;/.test(src));
  const U = new Function(src.slice(src.indexOf("function riseTileUrl("), src.indexOf("async function riseBytes(")) + "; return riseTileUrl;")();
  check("a picture row's squares are asked for by zoom, by box and by quadkey", U("a/{z}/{x}/{y}", 3, 2, 1) === "a/3/2/1" && U("a/{z}/{x}/{y}", 1, 0, 0, "tms") === "a/1/0/1" &&
        U("q{quadkey}", 2, 1, 1) === "q03" && U("{bbox-epsg-3857}", 0, 0, 0) === "-20037508.342789244,-20037508.342789244,20037508.342789244,20037508.342789244");
  check("with Raise figures as heights on, picture rows rise, and lie flat when it is off",
        /riseRow\(id, vis === "visible"\)/.test(src) && /if \(rowRasterSource\(id\)\) rasterRiseSet\(id, true\);/.test(src) &&
        /Every other layer rises where it covers the ground most/.test(src));
  check("the active fires come from NASA's 4326 map service, asked in its own grid and stretched here (round 120b)", /const GIBS_WMS = "https:\/\/gibs\.earthdata\.nasa\.gov\/wms\/epsg4326\/best\/wms\.cgi";/.test(src) && /tiles: "gibs:\/\/\{z\}\/\{x\}\/\{y\}\?LAYERS=VIIRS_SNPP_Thermal_Anomalies_375m_All/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 999);
}
console.log("\nround 109b (28 September): shapes raised, the alerts by grade, a colour wheel, the Atlas's cities in the corner panel only");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the insentient heading carries no quotation marks", /\{ h: 2, t: "Of the insentient" \}/.test(src) && !/\u201cinsentient\u201d/.test(src));
  check("the crowding switch is gone; points, areas and lines rise by themselves with Raise figures as heights",
        !/Raise where the points crowd<\/button>/.test(src) && !/data-crowd=/.test(src) && /function shapeCover\(features\)/.test(src) &&
        /else if \(rowVectorLayers\(id\)\.length\) pointReliefSet\(id, true\);/.test(src));
  const fn = new Function(src.slice(src.indexOf("function recolorAlerts("), src.indexOf("// latclip://")) + "; return { recolorAlerts, ALERT_TONES };")();
  const px = new Uint8ClampedArray(4 * 16);
  [[237, 164, 194], [220, 102, 153], [201, 42, 109], [90, 90, 90]].forEach((c, i) => { px.set([...c, 255], i * 16); });
  fn.recolorAlerts(px, [1, 2, 3]);
  check("each grade of alert takes its own step, teal to cobalt; another colour takes the row's",
        [0, 1, 2].every((i) => px[i * 16] === fn.ALERT_TONES[i][0] && px[i * 16 + 2] === fn.ALERT_TONES[i][2]) && px[48] === 1 && px[50] === 3);
  check("the three alert rows keep those colours, with a key", /recolor: "#8A4F46", keepColour: true,/.test(src) && /if \(cfg\.recolor\) rowKey\(cfg\.id, ALERT_TONES\.map/.test(src));
  // Round 113b: the wheel's step is wheelSteps / wheelRaster (made kind by kind).
  const C = new Function(src.slice(src.indexOf("function wheelSteps("), src.indexOf("const wheelCss")) + "; return (c) => ({ f: wheelSteps(c), raster: wheelRaster(c) });")();
  const same = C({ h: 200, r: 0.6, b: 1 }), turned = C({ h: 20, r: 1, b: 1.4 });
  check("the colour wheel: the dot at the map's own teal leaves colours as they are; elsewhere it turns them",
        same.f[0][1] === 0 && same.f[1][1] === 1 && same.f[2][1] === 1 && turned.f[0][1] === -180 && turned.f[1][1] === 1.6 && Math.abs(turned.raster["raster-brightness-min"] - 0.2) < 1e-9 &&
        /id="theme-wheel"/.test(src) && /data-theme-set="drawn"/.test(src) && /themeWheelWire\(box\);/.test(src));
  check("an Atlas city opens in the corner panel only; closed panels are hidden; a larger view; its key",
        /if \(hit\.cfg\.route === "atlascities" && typeof document\.createElement === "function"\)/.test(src) &&
        /#atlas-panel\[hidden\],#atlas-city\[hidden\]\{display:none !important\}/.test(html) && /class="ac-grow"/.test(src) && /async function atlasCityKey\(el\)/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 1000);
}
console.log("\nround 110b (29 September): Climate TRACE by gas from culprits-tiles-gases");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the by-gas archives are read from their own site; the asteroid list stays on culprits-tiles-more",
        /const CT_GASES_BASE = "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-gases";/.test(src) &&
        /const NEO_COPY = "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/neo\/esa_risk_list\.txt";/.test(src));
}
console.log("\nround 111b (29 September): ForestAtRisk, and notes after the failed refresh");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("ForestAtRisk is a row of its own, drawn from the tiles repo's copy in parts",
        /id: "forestatrisk"[^\n]*route: "rasterparts"[^\n]*buildScript: "forestatrisk"/.test(src) &&
        /culprits-tiles-more\/tiles\/forestatrisk\.pmtiles/.test(src) && /shown with Cirad's permission for non-commercial educational use/.test(src));
  check("it leads Where clearing is likely", /\{ h: 5, t: "Where clearing is likely" \}, "forestatrisk",/.test(src));
  check("it has a kind, a site and a not-live note", /forestatrisk: \["plant", "downstream"\]/.test(src) &&
        /  forestatrisk: "https:\/\/forestatrisk\.cirad\.fr\/rasters\.html",/.test(src) && /  forestatrisk: "Copied once from ForestAtRisk's own files/.test(src));
  check("a picture row can say its own state", /setLayerState\(cfg\.id, cfg\.stateSay \|\| /.test(src));
  check("the fire and fertility notes say what changed", /below zoom 6\) each fire's dot carries/.test(src) && /the 2019 country data on fertility, family planning/.test(src));
}
console.log("\nround 112b (29 September): solid dots, keys, stacked places, year bars, the Eyes framing, both tabs, the food move");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  // Round 116b: the glow is back; few-point layers are still kept large (and seen at every zoom).
  check("few-point layers kept large and seen at every zoom", /function smallLayerDots\(layer\)/.test(src) && /try \{ smallLayerDots\(layer\); \}/.test(src));
  {
    const S = new Function(src.slice(src.indexOf("function spreadStacked(data)"), src.indexOf("// A map that colours its places by kind")) + "; return spreadStacked;")();
    const pt = (x, y) => ({ type: "Feature", geometry: { type: "Point", coordinates: [x, y] }, properties: {} });
    const out = S({ features: [pt(-74, 40.7), pt(-74, 40.7), pt(-74, 40.7), pt(2, 48)] });
    const keys = new Set(out.features.map((f) => f.geometry.coordinates.join()));
    check("places at the very same spot are set round it; the first stays, others untouched", keys.size === 4 && out.features[0].geometry.coordinates.join() === "-74,40.7" &&
          out.features[3].geometry.coordinates.join() === "2,48" && Math.abs(out.features[1].geometry.coordinates[1] - 40.7) < 0.05);
  }
  check("a map with colours and no key gets one from the filter that matches its colours", /function sitemapAutoKey\(cfg, data\)/.test(src) && /try \{ sitemapAutoKey\(cfg, data\); \}/.test(src));
  check("Showing uses the row's drawn swatch", /background:\$\{legendSwatch\(c\)\}/.test(src));
  check("UFO years before 1000 say AD", /y < 1000 \? `AD \$\{y\}`/.test(src));
  {
    const Y = new Function(src.slice(src.indexOf("function yearOf(p, fields)"), src.indexOf("var sitemapTime")) + "; return yearOf;")();
    check("the capture row gets a year bar from its records' own year fields", /capture_cases: \["year", "years", "date", "filed or announced"/.test(src) &&
          Y({ "FARA: Registrant Date": "03/04/2020" }, ["year", "FARA: Registrant Date"]) === 2020 && Y({ years: "2002–2014" }, ["years"]) === 2002 && Y({}, ["year"]) === null &&
          /sitemapTime\.set\(cfg\.id, \{ lo: a, hi: b, undated: u \}\)/.test(src));
  }
  check("the Eyes network says it is a hypothesis under its title and behind its i, and opens its unplaced entries",
        /subtitle: "a hypothesis, not an established fact/.test(src) && /about: "This interactive is a hypothesis, not an established fact\./.test(src) &&
        /site_eyes_network\.unplaced\.json/.test(src) && /async function sitemapEntriesButton\(cfg\)/.test(src) && /white-space:pre-line/.test(index));
  check("the three industry maps: plain titles, kinds alone, and who owns them as rows", /name: "The advertising industries"/.test(src) && /name: "The news industry"/.test(src) &&
        /name: "The entertainment industries"/.test(src) && /"Owners: Family \/ founder-controlled": "Who owns them: families and founders"/.test(src) && !/World Advertising 2026 — Companies & Owners/.test(src));
  check("who owns the food industry is also under The food and drink industries", /\{ h: 4, t: "The food and drink industries" \}, "site_food_system",/.test(src));
  check("the schools row reads the map's own copy when built", /copy: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/tiles\/giga_points\.pmtiles"/.test(src) && /function addMvtCopy\(cfg, st\)/.test(src));
  check("the hologram's floor grid only under a floating planet, and no relief shading under 3D terrain",
        /const floating = map\.getZoom\(\) < 3/.test(index) && /id === "holo-relief" && terrainOn/.test(index) && /map\.on\("pitchend", holoFollow\)/.test(index));
}
console.log("\nround 113b (29 September): crowded points as banded, raised ground; a ring of themes made kind by kind");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("a point row of 300 or more is banded whenever shown, fading close in, and raised under the switch",
        /const DENSITY_MIN = 300;/.test(src) && /function densityBandsShow\(id, pr, on\)/.test(src) && /"raster-opacity": \["interpolate", \["linear"\], \["zoom"\], \.\.\.DENSITY_FADE\.flat\(\)\]/.test(src) &&
        /densityBandsShow\(id, pr, true\);\n  if \(!LIFT_ON\) \{/.test(src) && /else if \(vis === "visible" && !LIFT_ON && typeof pointReliefSet === "function"/.test(src));
  {
    const R = new Function("const DENSITY_WEIGHT = [\"_count\", \"point_count\", \"n\", \"schools\", \"count\"];" +
      src.slice(src.indexOf("function reliefPoints(features)"), src.indexOf("function pointReliefValues(pr)")) + "; return reliefPoints;")();
    check("the weights read are the ones the map uses", /const DENSITY_WEIGHT = \["_count", "point_count", "n", "schools", "count"\];/.test(src));
    const pts = R([{ geometry: { type: "Point", coordinates: [1, 2] }, properties: { n: 40 } }, { geometry: { type: "Point", coordinates: [1, 2] }, properties: { n: 40 } },
      { geometry: { type: "Point", coordinates: [3, 4] }, properties: { n: "Some name" } }]);
    check("a merged mark counts as its members; a mark read twice counts once; a name is not a count", pts.length === 2 && pts[0][2] === 40 && pts[1][2] === 1);
  }
  check("its key: the eight steps, fewer to more", /function densityKey\(id\)/.test(src) && /where they crowd, per 28 km square, wide out/.test(src));
  check("themes are made kind by kind: points, shapes, highlights", /var THEME_KINDS = \["points", "shapes", "highlights"\];/.test(src) &&
        /function themeKindOf\(id, type, source\)/.test(src) && /const steps = themeStepsFor\(t, themeKindOf\(id, type, layer\.source\)\);/.test(src) &&
        /const M = Ms\[themeKindOf\(l\.id, l\.type, l\.source\)\];/.test(src));
  check("eight ready-made themes in a ring round the wheel, none green, orange or yellow for points", /var THEME_PRESETS = \{/.test(src) && /class="tw-ring"/.test(src) &&
        /data-theme-preset="\$\{key\}"/.test(src) && /data-theme-target="\$\{k\}"/.test(src) &&
        (() => { const hs = [...src.slice(src.indexOf("var THEME_PRESETS = {"), src.indexOf("Object.assign(LAYER_THEMES, THEME_PRESETS);")).matchAll(/h: (\d+), r: ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
          return hs.length === 24 && hs.every(([h, r]) => r < 0.1 || !(h > 20 && h < 160)); })());
}
console.log("\nround 114b (29 September): holidays cut to corporatizers; sports facilities, betting and rigged games; the animal rows made worldwide");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the holidays row is only who corporatized holidays", /name: "Who corporatized holidays: made a holiday a company's own custom, or invented one to sell \(compiled from Wikipedia\)"/.test(src) &&
        !/Made or remade a holiday to take the place of another/.test(src));
  check("Sports holds facilities, betting and rigged games", /\{ h: 4, t: "Sports" \}, "sports_facilities", "sports_betting", "sports_fixing",/.test(src) &&
        /copy: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/tiles\/sports_facilities\.pmtiles", field: "group",/.test(src) &&
        /id: "sports_fixing"[\s\S]{0,600}yearFrom: \["year"\],/.test(src));
  check("the pet food industry, breeding places and zoos and aquariums worldwide sit with the animal rows",
        /"gmo_animal_trade", "animal_breeding_osm",/.test(src) && /"mymaps_supp_b", "zoos_aquariums_osm", "mymaps_supp_a", "pet_food_world",/.test(src));
  check("each new row has a kind, a site and a not-live note",
        ["sports_facilities", "sports_betting", "sports_fixing", "pet_food_world", "animal_breeding_osm", "zoos_aquariums_osm"].every((id) =>
          new RegExp(`\\b${id}: \\["(human|animal)", "upstream"\\]`).test(src) && new RegExp(`\\b${id}: "https:`).test(src) && new RegExp(`\\b${id}: "Built (weekly|monthly) by culprits-tiles-more`).test(src)));
  check("a copy not yet built says so", /if \(cfg\.copy && !cfg\.tiles && !cfg\.tilesFrom\) \{ setLayerState\(cfg\.id, "not built yet/.test(src));
}
console.log("\nround 115b (29 September): the medical industry's culprits");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the medical row sits under The medical industry, read from the tiles repo, with a kind, site and not-live note",
        /\{ h: 4, t: "The medical industry" \}, "medical_culprits",/.test(src) && /culprits-tiles-more\/medical\/culprits\.geojson/.test(src) &&
        /medical_culprits: \["human", "upstream"\]/.test(src) && /  medical_culprits: "https:/.test(src) && /  medical_culprits: "Built weekly by culprits-tiles-more/.test(src));
}
console.log("\nround 117b (30 September): heights made quick, points coloured by their own figures, trafficking routes both ways, discrimination (WJP)");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const zlib = await import("node:zlib");
  // The relief's squares are written as plain PNGs by hand, not compressed by the canvas.
  const png = new Function(src.slice(src.indexOf("const PNG_CRC"), src.indexOf("// The figures of one square")) + "; return rawPng;")();
  const px = new Uint8ClampedArray(4 * 4 * 4).map((_, i) => (i * 37) & 255);
  const b = Buffer.from(png(px, 4, 4));
  const idat = b.indexOf("IDAT"), len = b.readUInt32BE(idat - 4);
  const raw = zlib.inflateSync(b.subarray(idat + 4, idat + 4 + len));
  check("a relief square is a whole PNG whose pixels read back as written",
        b.subarray(1, 4).toString() === "PNG" && b.includes("IEND") && raw.length === 4 * 17 && raw[0] === 0 && raw[1] === px[0] && raw[18] === px[16]);
  check("a square's figures are worked out once for its colours, heights and shading, and no canvas encodes it",
        /const vals = await reliefValuesOnce\(r, z, x, y\);/.test(src) && !/cv\.convertToBlob \? await cv\.convertToBlob/.test(src));
  check("a row read from tiles keeps the points seen so far and is remade only when a fifth more have come",
        /pts\.length < pr\.builtFrom \* 1\.2/.test(src) && /if \(!pr\.changed\) continue;/.test(src));
  check("a row of a few points rises too", /POINT_RELIEF_MIN = 1;/.test(src));
  check("areas shaded by a figure stand as tall as it", /function shapeLift\(cfg, source, colouring\)/.test(src) && /lift: \["case", has, at, 0\]/.test(src));
  // The colour menu's steps.
  const pc = new Function("PC_RAMP", "GLAD_OUT", "AUTO_GROUP_COLOURS", "amountWords",
    src.slice(src.indexOf("function pcRound("), src.indexOf("function pcColourOf(")) + "; return { pcBreaks, pcFinish };")(
    ["#A6D3CC", "#78BCB9", "#529FAF", "#3E80A3", "#2F6195", "#233F80"], new Set(), ["#E0304A", "#3FA9C2", "#F28FB0"], (v) => String(v));
  check("steps fall where the values do, years stay years", JSON.stringify(pc.pcBreaks([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025])) === "[2019,2020,2022,2023,2024]" &&
        JSON.stringify(pc.pcBreaks([1, 2, 5, 9, 15, 250, 1200, 40, 3, 3, 3, 7])) === "[3,7,15,250]");
  const rating = pc.pcFinish({ field: "x_impact", labels: { 3: "three" } }, [3, 4, 5, 3]);
  check("a rating of a few whole numbers is one step each, in its own words", rating.kind === "cls" && rating.cls.length === 3 && rating.cls[0][1] === "three");
  check("a kind with one value is no choice at all", pc.pcFinish({ field: "k", classes: "auto" }, ["a", "a"]) === null);
  check("every row of points read from an archive or a GeoJSON copy gets the menu",
        /pointColourPmtiles\(cfg, archive, owner\)\.catch/.test(src) && /const pcList = got\.items\.some\(\(it\) => it\._pc\) \? pointColourItems\(cfg, got\.items\) : \[\];/.test(src));
  check("the slavery rows the owner named are coloured by their own figures",
        /field: "x_workers", unit: "workers", noneWords/.test(src) && /field: "x_kiln_area_m2"/.test(src) && /field: "x_high_risk_share_pct"/.test(src) &&
        /field: "x_share_of_effort_high_risk_pct"/.test(src) && /field: "workers_in_complaint"/.test(src) && /\["TOT 1995-2020"\]/.test(src) && /yearFrom: \["year"\], colourAuto: false/.test(src));
  check("the ports and ocean squares read the copy with their figures as fields, the old one until it is built",
        /tiles\/slavery_points_ports\.pmtiles",\n    archiveBefore: `\$\{TILE_BASE\}\/slavery_ports\.pmtiles`/.test(src) && /tiles\/slavery_points_fishing\.pmtiles/.test(src));
  check("the whole-country determinations are read in the prevalence box, not drawn at a country's middle",
        /where: \["!", \["in", \["get", "name"\], \["literal", Object\.keys\(DETERMINATION_COUNTRYWIDE\)\]\]\]/.test(src) && /box: "slaveryprev"/.test(src) &&
        /cfg\.box === "slaveryprev"\n    \? \(p\) => Promise\.resolve\(plain\(p\)\)\.then\(\(h\) => slaveryFindings/.test(src));
  check("trafficking routes: out of and into the country chosen, each its own tick; partners shaded; the route under the pointer alone",
        /data-routes-out checked/.test(src) && /data-routes-in checked/.test(src) && /`\$\{cfg\.id\}-cty`/.test(src) && /`\$\{cfg\.id\}-hover`/.test(src) &&
        /"symbol-placement": "line"/.test(src));
  check("identified cases say they are counted where people were exploited", /Counted in the country where the person was exploited/.test(src));
  const o = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("// A heading's tick reads its layers")) + "; return { PANEL_ORDER };")();
  const d = o.PANEL_ORDER.findIndex((x) => x && x.t === "Discrimination");
  check("discrimination (WJP) is the first thing under Discrimination, darker where it is worse",
        o.PANEL_ORDER[d + 1] === "wjp_discrimination_2022" && o.PANEL_ORDER[d + 2] === "wjp_discrimination" && o.PANEL_ORDER[d + 3] === "wjp_discrimination_change" && /linear: \[0\.2, 0\.9\], reverse: true/.test(src) &&
        /const at = cfg\.reverse \? \["-", 1, at0\] : at0;/.test(src));
  check("the Unearthings' blurred halos are drawn (zoom at the top of their size)", /"circle-radius": \["interpolate", \["linear"\], \["zoom"\], 1, \["\*", 2\.4,/.test(src));
}
console.log("\nround 118b (30 September): one surface from all ticked layers, capture as one row, Invasion of humans in subheadings, military by kind, fixes");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the globe carries terrain while a row holds the ground, so the globe does not go dark",
        /return \(TERRAIN_ON \|\| raised\) && p !== "mercator" \? "globe" : p;/.test(src) && /reliefGround[\s\S]{0,600}map\.setProjection\(\{ type: want \}\)/.test(src));
  check("the painted plate is raster tiles the colour remapping leaves alone",
        /tiles: \["plate:\/\/\{z\}\/\{x\}\/\{y\}"\]/.test(src) && /GLAD_SKIP_SOURCES = new Set\(\[[^\]]*"plate-base"\]\)/.test(src) && /"plate-base"/.test(html));
  check("a lift layer is added without naming a line layer that does not exist yet", !/shapeLift[\s\S]{0,900}`\$\{cfg\.id\}-line`\)/.test(src.slice(src.indexOf("function shapeLift"), src.indexOf("function shapeLift") + 900)));
  const pick = new Function(src.slice(src.indexOf("const COMBO_MODES"), src.indexOf("function comboFigure")) + "; return { COMBO_MODES, COMBO };")();
  check("one surface from every ticked layer: off, by density, or by the size of each place's figure, each layer weighed",
        pick.COMBO_MODES.map((m) => m[0]).join() === "off,overlap,peaks" && pick.COMBO.mode === "off" &&
        /id="combo-mode"/.test(src) && /data-combo-weight/.test(src) && /COMBO\.mode !== "off"\) on = false;/.test(src));
  const rank = new Function("reliefPoints", "DENSITY_WEIGHT", src.slice(src.indexOf("function comboPoints"), src.indexOf("async function comboBuild")) + "; return comboPoints;")(() => [], ["_count"]);
  const pt = (v) => ({ geometry: { type: "Point", coordinates: [Math.random(), Math.random()] }, properties: { v } });
  const w = rank([pt(5), pt(50), pt(500), pt(null)], "v", "intensity").map((q) => q[2]);
  check("…by figure, a layer's largest counts 1, its smallest 0.1, a place with no figure a half",
        w[0] === 0.1 && w[2] === 1 && w[3] === 0.5 && Math.abs(w[1] - 0.55) < 1e-9);
  check("the three capture rows are views of one row under Of countries by countries, picked in a menu",
        /id: "capture_all"[^\n]*route: "switch"/.test(src) && /"site_secret_societies", "capture_all",/.test(src) &&
        /"capture_cases", "capture_countries", "capture_share",\n/.test(src.slice(src.indexOf("const PANEL_REMOVED"))) &&
        /cfg\.route === "switch" \? Promise\.resolve\(\)\.then\(\(\) => addSwitchLayer\(cfg\)\)/.test(src) && /lead\.route === "switch" && lead\.parts\) switchShow\(lead, e\.target\.checked\)/.test(src));
  const o = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("];", src.indexOf("const PANEL_ORDER = [")) + 2) + "; return PANEL_ORDER;")();
  const at = (t) => o.findIndex((x) => x && (x.t === t || x.bundle === t));
  check("Invasion of humans in subheadings: where they live, rights, quality of laws, conflicts",
        ["How each country is invaded", "Where Indigenous peoples and local communities live", "Indigenous and community rights", "Quality of laws protecting their land", "Conflicts and killings"]
          .every((t, i, a) => at(t) > at("Invasion of humans") && at(t) < at("Of countries by countries") && (!i || at(t) > at(a[i - 1]))) &&
        at("landmark") > at("Where Indigenous peoples and local communities live") && at("resrights") > at("Indigenous and community rights") &&
        o.indexOf("gw_defenders") > at("Conflicts and killings") && o.indexOf("site_settler_colonialism") === -1);
  check("settler colonialism is drawn with how each country is invaded, one row", /alsoShows: \["site_settler_colonialism"\]/.test(src) && /for \(const o of \(lead && lead\.alsoShows\) \|\| \[\]\)/.test(src));
  check("military places are rows by kind, from every source, nuclear under its own heading, with no one-colour choice",
        ["air", "naval", "bases", "ranges", "schools", "forts", "other", "nuclear"].every((k) => new RegExp(`id: "mil_k_${k}"[\\s\\S]{0,2500}?noOneColour: true`).test(src) && src.includes(`military/kinds/${k}.geojson`)) &&
        /\{ h: 5, t: "Nuclear weapons" \}, "mil_k_nuclear", "mil_nuclear_storage"/.test(src));
  check("the armed clashes are coloured by kind of violence or deaths, not banded", /id: "mil_conflicts"[\s\S]{0,4000}noBands: true/.test(src) && /x_deaths/.test(src));
  check("military aircraft also come through the Worker", /\$\{WORKER\}\/adsbmil/.test(src));
  check("the genetic engineering organisations and escapes are read from the map's own page, its field trials listed", /gmo\/organisations\.geojson/.test(src) && /gmo\/escapes\.geojson/.test(src) && /function gmoTrialList/.test(src) && /"gmo_act"/.test(src.slice(src.indexOf("const PANEL_REMOVED"))));
  check("rows of state or country middles are not raised by how their points crowd", /if \(own && own\.centroids\) return;/.test(src) && /id:"gmo_env", sourceOf:"gmo_releases", centroids: true/.test(src));
  check("a lazy live row of the main list waits for its first tick", /TOP_DEFERRED_ROUTES = new Set\(\["geojsonlive", "switch"\]\)/.test(src) && /TOP_DEFERRED\.has\(id\) \? LAYERS\.find/.test(src));
  check("a row of very few points carries a pale ring to be seen from afar", /var FEW_POINTS = 25;/.test(src) && /function fewBeacon\(/.test(src));
  check("trade imbalances show surplus or deficit, one at a time, each country raised by its step", /if \(m\.sign\) return Math\.sign\(v\) === m\.sign \? Math\.abs\(v\) : null;/.test(src) && /rowLift\(cfg\.id, `\$\{cfg\.id\}-fill`, lift\.length > 3 \? lift : 0\)/.test(src));
  check("who keeps the profits is shaded dark where the country keeps them", /site_trade_profits: \[\{ label: "foreign value added[\s\S]{0,900}reverse: true/.test(src));
  check("hovering a country on resourcetrade.earth leaves only its own flows lit", /function rteHover\(/.test(src));
  check("the banking dynasties are filtered by any measure, the Complete Visual closes by its button, a click outside or Escape",
        /function linksMeasureFilter\(/.test(src) && /Complete Visual/.test(src) && /function bowedArc\(/.test(src));
  check("LandMark and FUNAI areas are titled by their own names, their working fields hidden", /function gfwRecordBox\(/.test(src) && /gfw_geostore_id/.test(src) && /terrai_nom/.test(src));
  check("a two-step colour is mapped stop by stop, so the social spheres' lines draw", /out\[i\] = gladCss\(v\[i\], salt\)/.test(src));
}
console.log("\nround 119b (30 September): attacks in plain English and as like layers, homicides, Wreckers by Corporate Watch's sections, boards, EJAtlas categories");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const o = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("];", src.indexOf("const PANEL_ORDER = [")) + 2) + "; return PANEL_ORDER;")();
  const at = (t) => o.findIndex((x) => x && (x.t === t || x.bundle === t));
  const all = (t) => o.map((x, i) => (x && (x.t === t || x.bundle === t) ? i : -1)).filter((i) => i > -1);
  check("like layers are one layer each, under Destruction > Of individuals and again under Invasion of humans",
        ["killing_indigenous", "defenders", "brazil_land", "homicides"].every((b) => all(b).length === 2) &&
        o[at("killing_indigenous") + 1] === "attacks_cimi" && o[at("defenders") + 1] === "gw_defenders" && o[at("homicides") + 1] === "homicide_rates");
  check("the water conflicts are under Water scarcity and the overexploitation of workers under Slavery, once each",
        o.filter((x) => x === "attacks_cpt_water").length === 1 && o.indexOf("attacks_cpt_water") > at("Water scarcity") &&
        o.filter((x) => x === "attacks_cpt_overexploitation").length === 1 && o.indexOf("attacks_cpt_overexploitation") === o.indexOf("attacks_cpt_slave_cases") + 1);
  check("the attacks rows read the plain-English copies first, the originals until they are built",
        ["gw_killings", "land_of_resistance", "frontline_cases", "cimi_indigenous_violence", "cpt_massacres"].every((f) => src.includes(`attacks/plain/${f}.geojson", fallback: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/attacks/${f}.geojson"`)) &&
        /catch \(e\) \{ if \(!f\.fallback\) throw e; got = await getJson\(f\.fallback, 60000\); \}/.test(src));
  const fb = new Function(src.slice(src.indexOf("function filterByTokens"), src.indexOf("function livePlacesToSitemap")) + "; return filterByTokens;")();
  const cfg = { filterBy: [{ label: "Rights", field: "rights", list: true }, { label: "Who", field: "who" }] };
  const items = [{ _pc: { rights: "Land Rights; Human Rights", who: "Police" } }, { _pc: { rights: "Land Rights", who: "Hitmen" } }, { _pc: {} }];
  fb(cfg, items);
  check("a row filters by its own fields, a field of several values under each",
        items[0].fb === "|f0:Land Rights||f0:Human Rights||f1:Police|" && items[2].fb === "" &&
        cfg._fbSets[0].values[0].label === "Land Rights" && cfg._fbSets[0].values[0].n === 2 && cfg._fbSets[1].values.length === 2);
  check("defenders killed: coloured and filtered by who killed them; rights at stake for Front Line Defenders",
        /id: "attacks_gw_killings"[\s\S]{0,2500}field: "perpetrator_type"[\s\S]{0,1500}filterBy: \[\{ label: "Who killed them"/.test(src) &&
        /filterBy: \[\{ label: "Rights at stake", field: "rights", list: true \}/.test(src));
  check("areas in land conflict are drawn as municipalities, by year", /attacks\/plain\/cpt_areas_municipal\.geojson/.test(src) && /steps: \[2, 4, 8, 16, 32\], unit: "areas in conflict that year"/.test(src));
  check("a year is written as a year in the colour keys", /yearly \? String\(x\) : x\.toLocaleString\(\)/.test(src));
  check("24 colours for kinds, and the rest said in the key", /const AUTO_GROUP_COLOURS = \[[^\]]*"#7E5E8C"\];/.test(src) && /the other \$\{cls\.length - most\} kinds, or not given/.test(src));
  check("the colour menu says its own colours, not how the row draws them", !/as the row draws them/.test(src) && /its own colours: \$\{/.test(src));
  check("a raised row's shading is lighter and gone close in; dots are sharp", /"hillshade-exaggeration": \["interpolate", \["linear"\], \["zoom"\], 0, 0\.5, 5, 0\.35, 7\.5, 0\]/.test(src) && /"circle-blur": 0\.6,/.test(src));   // round 134b: glowing orbs again (asked 2 October)
  check("EJAtlas's categories by name", /const EJ_CATEGORIES = \{ 1: "Nuclear", 2: "Mineral ores and building materials extraction"/.test(src) && /group: cat, h: box\(ejPlain\(r\)\)/.test(src));
  check("Wreckers of the Earth is one layer, London and worldwide, by Corporate Watch's sections, with why each is on it",
        o[at("wreckers") + 1] === "wreckers_umap" && o[at("wreckers") + 2] === "wreckers_world" && !/"Tobacco":/.test(src) &&
        /"Arms makers and security firms": "#F28FB0"/.test(src) && /p\["why it is on this layer"\]/.test(src));
  check("They Rule's boards from their source, and the EJAtlas below them", o.indexOf("boards_interlocks") < o.indexOf("ejatlas") && o.indexOf("boards_interlocks") > at("wreckers") &&
        /"theyrule",/.test(src.slice(src.indexOf("const PANEL_REMOVED"))) && /boards\/interlocks\.geojson/.test(src));
  check("homicides worldwide: rates, cases, Colombia's towns, Wikidata", ["homicide_rates", "homicide_cases", "homicide_colombia", "homicide_wikidata"].every((i) => new RegExp(`id: "${i}"`).test(src)) &&
        /tiles\/homicide_cases\.pmtiles", field: "group"/.test(src));
  check("WJP's 2022 map, from its scores", /id: "wjp_discrimination_2022"[\s\S]{0,1200}field: "score_2022"/.test(src));
  check("every resource trade flow, and every carbon plume page", /trades_all_\$\{year\}\.json/.test(src) && /let rteAll = \[\], rteKeep = 0, rteOne = "";/.test(src) && /const CARBON_PLUME_PAGES = 200;/.test(src));
}
console.log("\nround 120b (1 October): news box titles, no automatic tilt, NASA fires, the Atlas's maps as squares, the combined surface on top, F-gases together, methane and nitrous oxide culprits");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const wt = new Function(src.slice(src.indexOf("function wireMarkTitle"), src.indexOf("// The box's filters: a menu for each subject")) + "; return wireMarkTitle;")();
  check("a news box is titled by the country of its stories, not the first story's subject",
        wt([{ iso: "br", place: "Deforestation" }, { iso: "BR", place: "Amazon" }], "x") === "Brazil" && wt([{ place: "Lagos" }, { place: "Lagos" }, { place: "Ikeja" }], "x") === "Lagos" && wt([], "") === "News at this place");
  check("the map is not tilted on its own when a raised row or the columns come on", !/map\.easeTo\(\{ pitch: 50, duration: 800 \}\)/.test(src) && !/map\.easeTo\(\{ pitch: COLUMN_TILT/.test(src));
  check("NASA's fires are asked in latitude and longitude and stretched into the map's squares", /maplibregl\.addProtocol\("gibs"/.test(src) && /SRS=EPSG:4326&BBOX=\$\{W\},\$\{S\},\$\{E\},\$\{N\}/.test(src));
  check("the Atlas's maps are cut into map squares, so the raised globe still draws them", /maplibregl\.addProtocol\("pic"/.test(src) && /addPictureSource\("atlas-plate", plateUrl\(p\.image\), p\.corners\)/.test(src) && /addPictureSource\(id, plateUrl\(d\.image\), d\.corners\)/.test(src));
  check("a click on another region opens it in place of the one open", /map\.queryRenderedFeatures\(e\.point, \{ layers: own \}\)\.length\) return;/.test(src));
  check("the numbered cities' tips have a solid box", /background:rgba\(16,20,26,0\.96\)/.test(src));
  check("the combined surface sits at the top of the layers menu, hides the layers it combines, and says what the weights do",
        /comboBox\(box\);\n  layerSearch\(box\);/.test(src) && /function comboHideRows\(hide\)/.test(src) && /Every ticked layer takes part unless you leave it out/.test(src)   /* round 133b: cut, not hidden */ && !/data-sect="combo"/.test(src));
  const o = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("];", src.indexOf("const PANEL_ORDER = [")) + 2) + "; return PANEL_ORDER;")();
  const at = (t, from = 0) => o.findIndex((x, i) => i >= from && x && x.t === t);
  const ch4 = at("Methane"), n2o = at("Nitrous oxide"), fg = at("F-gases");
  check("F-gases: every gas together first, then gas by gas; the crime tracker not there", o[fg + 1] === "edgar_fgases_all" && o[fg + 2] === "edgar_fgases" && /route: "valrelief"/.test(src));
  check("methane: no carbon bombs, no Carbon Majors, no Infrastructure; the wells and the culprits under Culprits",
        at("Infrastructure", ch4) === -1 || at("Infrastructure", ch4) > n2o) &&
        (at("Priority emitters", ch4) === -1 || at("Priority emitters", ch4) > n2o) &&
        o.slice(ch4, n2o).indexOf("carbon_majors") === -1 && o.slice(ch4, n2o).indexOf("carbon_bombs") === -1 &&
        ["methane_imeo_plumes", "methane_ct_owners", "skytruth_fracfocus"].every((id) => o.indexOf(id, ch4) > at("Culprits", ch4) && o.indexOf(id, ch4) < n2o);
  check("nitrous oxide: Emissions then Culprits by source, fertiliser plants under fertiliser, the soy bodies above the banks, no silos",
        at("Emissions", n2o) < at("Culprits", n2o) && at("Culprits", n2o) < fg && (at("Infrastructure", n2o) === -1 || at("Infrastructure", n2o) > fg) &&
        o.indexOf("fertilizer_facilities", n2o) > at("Synthetic fertiliser", n2o) && o.indexOf("soy_organizations", n2o) < o.indexOf("site_forest500_soy", n2o) &&
        ["Manure and grazing livestock", "Fish farming"].every((t) => at(t, n2o) > -1 && at(t, n2o) < fg) && !o.includes("trase_silos_brazil") && !o.includes("site_china_grain"));
  check("the crop given the most nitrogen, country by country, its kinds listed from its own data", /id: "n2o_crop_fertiliser"[\s\S]{0,600}categories: "auto"/.test(src) && /if \(cfg\.categories === "auto" \|\| !Array\.isArray\(cfg\.categories\)\)/.test(src));
}
console.log("\nround 121b (1 October): the soy culprits coloured by money");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const o = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("];", src.indexOf("const PANEL_ORDER = [")) + 2) + "; return PANEL_ORDER;")();
  const row = (id) => { const i = src.indexOf(`{ id: "${id}"`); return i < 0 ? "" : src.slice(i, src.indexOf("\n    { id:", i + 10)); };
  const t = row("soy_traders_money");
  check("the soy traders are coloured by their revenue first, from Wikidata, and by trader", /route: "geojsonlive"/.test(t) && /soy\/traders\.geojson/.test(t) &&
        t.indexOf('field: "revenue, US$ billion"') > -1 && t.indexOf('field: "revenue, US$ billion"') < t.indexOf('field: "trader"') && /Wikidata/.test(t));
  check("the traders' row replaces the page copy in both lists; the Forest 500 soy banks keep the page's row (round 122b: Forest 500 gives no money figures)",
        !o.includes("site_soybean_companies") && o.filter((x) => x === "soy_traders_money").length === 2 && o.filter((x) => x === "site_forest500_soy").length === 2 &&
        !/forest500_soy_money/.test(src) && /"site_soybean_companies",\n/.test(src.slice(src.indexOf("const PANEL_REMOVED"))));
}
console.log("\nround 122b (2 October): every company and financial institution Forest 500 has assessed, and its country selection");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const o = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("];", src.indexOf("const PANEL_ORDER = [")) + 2) + "; return PANEL_ORDER;")();
  const row = (id) => { const i = src.indexOf(`{ id: "${id}"`); return i < 0 ? "" : src.slice(i, src.indexOf("\n    { id:", i + 10)); };
  const ids = ["forest500_companies", "forest500_institutions", "forest500_producer_countries", "forest500_trading_countries"];
  check("the four Forest 500 rows sit under Deforestation's companies and financiers, after Deforestation Free Funds", o.indexOf("dff") > -1 && ids.every((id, i) => o.indexOf(id) === o.indexOf("dff") + 1 + i));
  check("each carries Forest 500's citation and licence, and says what it is built from", ids.every((id) => /Forest 500 assessment data, Global Canopy/.test(row(id)) && /CC BY-NC 4\.0/.test(row(id)) && /buildScript: "forest500_map"/.test(row(id))));
  check("companies and institutions: coloured by their last score, filtered by commodity, placed at the capital and saying so",
        ["forest500_companies", "forest500_institutions"].every((id) => /total score, last assessed \(out of 100\)/.test(row(id)) && /field: "commodities", list: true/.test(row(id)) && /capital/.test(row(id))));
  check("the trading countries are shaded darker for a lower total rank; the producers' unit is the sheet's own",
        /field: "x_Total rank" \}, reverse: true, linear: \[0, 130\]/.test(row("forest500_trading_countries")) && /the sheet's figure/.test(row("forest500_producer_countries")));
}
console.log("\nround 123b (2 October): keyless imagery, overlap modes, raise off, disasters, laws, water, mining, fire");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const order = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED")) + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  const removed = src.slice(src.indexOf("const PANEL_REMOVED"), src.indexOf("]);", src.indexOf("const PANEL_REMOVED")));
  check("the satellite and atlas imagery and hillshade are Esri's, as the owner tuned them (round 126b)",
        /"World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}"\]/.test(src) && /"Elevation\/World_Hillshade\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}"\]/.test(src) && !/esri-hillshade-off/.test(src));
  check("the two ways to combine are the owner's, and raising is off until ticked",
        /\["overlap", "Where they cross"\]/.test(src) && /\["peaks", "Where their highest values overlap"\]/.test(src) && /var LIFT_ON = false;/.test(src));
  check("hologram blue shading off by default, a saved 'on' not kept once", /shade: false \};/.test(html) && /opt\.shade123/.test(html));
  check("each kind of disaster indented under Every kind together, and the warmer years drawn from Berkeley Earth",
        at("Earthquakes") > at("Every kind together") && order[at("Earthquakes")].h === 5 && order[at("Extreme heat")].h === 5 &&
        /id: "berkeley_warming"[^\n]*route: "rasterlive"/.test(src) && /berkeley_warming\.choices\.json/.test(src));
  check("environmental law, investor-state suits and the Energy Charter Treaty drawn on the map from data",
        /id: "site_environment_law"[^\n]*route: "geojsonlive"/.test(src) && /envlaw\/countries\.json/.test(src) &&
        /isds\/respondents\.json/.test(src) && /isds\/ect_respondents\.json/.test(src) && /"site_environment_law_shapes"/.test(removed));
  check("water scarcity: surface water first, then projected stress, Reservoirs, Water conflicts, and who causes it",
        at("Reservoirs") > at("Water scarcity") && at("Water conflicts") > at("Reservoirs") && at("Who causes water scarcity") > at("Water conflicts") &&
        order.indexOf("jrc_water") === at("Water scarcity") + 1 && /"aqueduct_crop"/.test(removed) && /onlyGroup: "Water management"/.test(src) &&
        /water\/culprits\.json/.test(src));
  check("the surface water's haze left out: only the publisher's own colours are drawn", /dataOnly: true/.test(src) && /function remapFits\(/.test(src));
  check("reservoirs with no usual area to compare are 'no reading', not blue", /no usual area given to compare with/.test(src));
  check("mining split; land cover under Land Use and Ecoregions; fire rows as asked",
        !/\{ h: 4, bundle: "mines"/.test(src) && at("Forest and land cover") === -1 && /\{ h: 4, bundle: "viirs"/.test(src) &&
        /TRASE_REMOVED_METRICS = new Set\(\["BURNED_PEAT", "EMISSION_BURNED_PEAT_CO2"\]\)/.test(src) && /tcl_fire: \{ mode: "year"/.test(src));
  check("the share of the map that is live shows at the top", /function liveShareBadge\(/.test(src) && /% of the map's layers are live layers/.test(src) && /getElementById\("combo-box"\) \|\| box/.test(src));
}
console.log("\nround 124b (2 October): a fire's country and place on the map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const ring = new Function(src.slice(src.indexOf("function inRing("), src.indexOf("function countryNameAt(")) + "; return inRing;")();
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  check("a point is found inside its country's outline", ring(5, 5, sq) && !ring(15, 5, sq));
  check("records with their own latitude and longitude get a country and an OpenStreetMap link",
        /function recordWhere\(p\)/.test(src) && /recordWhere\(p\) \+/.test(src) && /countryShapesSoon\(\);\n\s*bindHtmlPopup\(id, \(p\) => gfwRecordBox\(d, p\)\);/.test(src));
}
console.log("\nround 125b (2 October): dots seen close in, named water culprits");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("past zoom 12 a dot gains a light rim", /paint\(layer\.id, "circle-stroke-width", z\(GLOW\.fadeOut, 0, GLOW\.gone, 1\.1\)\);/.test(src));
  check("named water culprits are a row under Who causes water scarcity", /"water_culprits", "water_cases",/.test(src) && /water\/cases\.geojson/.test(src));
}
console.log("\nround 128b (2 October): national environmental-crime registers");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("three national registers under Environmental crime", /"ibama_infractions", "ea_enforcement", "canada_offenders", "epa_cases",/.test(src) &&
        ["ea_enforcement", "canada_offenders", "epa_cases"].every((id) => new RegExp(`id: "${id}"[^\\n]*route: "pmtiles"`).test(src) && new RegExp(`\\n  ${id}: "Copied weekly`).test(src)));
}
console.log("\nround 129b (2 October): blacklisted vessels where last seen");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("vessel positions row under Fishing and Environmental crime", /"iuu_vessels", "iuu_positions",/.test(src) && /"iuu_vessels", "iuu_positions", "ibama_embargos",/.test(src) &&
        /id: "iuu_positions"[^\n]*route: "geojsonlive"/.test(src) && /\n  iuu_positions: "Copied weekly/.test(src));
}
console.log("\nround 130b (2 October): Open Payments by state");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("Open Payments row under The medical industry", /"medical_culprits", "open_payments",/.test(src) && /id: "open_payments"[^\n]*route: "geojsonlive"/.test(src) &&
        /openpay\/states\.geojson/.test(src) && /\n  open_payments: "Added up weekly/.test(src));
}
console.log("\nround 132b (2 October): crops, cropland spread, meat, promises, oceans");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const ids = [...src.matchAll(/id: "(spam_[a-z]+)"/g)].map((m) => m[1]);
  check("every SPAM crop not already a row has its own row (38)", ids.length === 38 && ids.every((i) => src.includes(`"${i}",`) || src.includes(`"${i}"\n`)));
  check("rows can take only some of their build's chips", /cfg\.choiceMatch\) cfg\.choices = \(cfg\.choices \|\| \[\]\)\.filter/.test(src));
  check("cropland spread shows only net gain and net loss", /id: "potapov_cropland", name: "Cropland spread, 2003 to 2019[^\n]*choiceMatch: \/\^net \(gain\|loss\)\/i/.test(src));
  check("By crop: Other groups last", src.indexOf('{ h: 6, t: "Yams" }') < src.indexOf('{ h: 6, t: "Other cereals" }') && src.indexOf('{ h: 6, t: "Banana" }') < src.indexOf('{ h: 6, t: "Wheat" }'));
  check("Cattle and pasture and Pigs and chickens gone; Herds above Facilities; Marine meats", !src.includes('t: "Cattle and pasture" }') && !src.includes('t: "Pigs and chickens" }') && src.indexOf('{ h: 5, t: "Herds" }') < src.indexOf('{ h: 5, t: "Facilities" }') && src.includes('{ h: 5, t: "Marine meats" }'));
  check("Deforestation promises heading", src.includes('{ h: 4, t: "Deforestation promises" }') && src.includes('" > Deforestation > Deforestation promises"'));
  check("Every human impact together leads Oceans, with notes", /\{ h: 3, t: "Oceans" \},\n  \{ note: [^\n]*\},\n  \{ h: 4, t: "Every human impact together" \}, "ocean_impacts",/.test(src) && (src.match(/tag: "[^"]*Every human impact together layer/g) || []).length >= 8);   // round 136b: more headings
  check("heatwaves and bleaching are two rows of the same files", /id: "ocean_bleaching"[^\n]*choiceMatch/.test(src) && /id: "ocean_heat"[^\n]*choiceMatch: \/\^Sea surface temperature\/i/.test(src));
}
console.log("\nround 133b (2 October): combining the ticked layers cuts them to where they meet");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const lib = new Function("POINT_RELIEF_RES", src.slice(src.indexOf("function comboExpr(f)"), src.indexOf("async function comboBuild(")) + "; return { comboExpr, comboJoin, comboShape };")(90);
  check("old-style filters become expressions before the cut is added", JSON.stringify(lib.comboExpr(["all", ["==", "k", "a"], ["!has", "z"], ["in", "t", 1, 2]])) ===
        JSON.stringify(["all", ["==", ["get", "k"], "a"], ["!", ["has", "z"]], ["match", ["get", "t"], [1, 2], true, false]]) &&
        JSON.stringify(lib.comboExpr(["!=", ["get", "x"], "yes"])) === JSON.stringify(["!=", ["get", "x"], "yes"]));
  const cut = { type: "MultiPolygon", coordinates: [] };
  check("a layer's own filter is kept and the cut added", JSON.stringify(lib.comboJoin(null, cut)) === JSON.stringify(["within", cut]) &&
        JSON.stringify(lib.comboJoin(["has", "a"], cut)) === JSON.stringify(["all", ["has", "a"], ["within", cut]]) && lib.comboJoin(["has", "a"], null)[0] === "has");
  // 4 x 2 squares of 90 degrees: the two left squares of both lines, one rectangle.
  const sh = lib.comboShape(Uint8Array.from([1, 1, 0, 0, 1, 1, 0, 1]), 4, 2);
  check("kept squares are joined into rectangles", sh.coordinates.length === 2 &&
        JSON.stringify(sh.coordinates[0][0][0]) === "[-180,90]" && JSON.stringify(sh.coordinates[0][0][2]) === "[0,-90]" && JSON.stringify(sh.coordinates[1][0][0]) === "[90,0]");
  check("the two ways: where the most layers meet, or where the most are in their own top fifth", /if \(count\[i\] >= 2\) \{ keep\[i\] = 1;/.test(src) && /const COMBO_TOP = 0\.2;/.test(src) &&
        /cut = vals\.length \? vals\[Math\.floor\(vals\.length \* \(1 - COMBO_TOP\)\)\] : Infinity;/.test(src));
  check("the layers are cut, not hidden, and nothing turns on 3D", /function comboCut\(shape\)/.test(src) && !/comboHideRows\(true\)/.test(src) &&
        !/reliefGround\(rid, true, true\);\n  \} else \{\n    if \(map\.getLayer\(`\$\{rid\}-hill`\)\)/.test(src) && /setFilter[^\n]*\n  if \(!COMBO_BYPASS && COMBO_OWN\.has\(id\)\)/.test(src));
}
console.log("\nround 134b (2 October): glowing orbs, all farm animals, slaughterhouse sizes, one slaughterhouse row");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the points' cores are soft glowing orbs again", /"circle-blur": 0\.6,/.test(src) && /paint\(layer\.id, "circle-blur", 0\.8\);/.test(src));
  check("farm animals: All first, falling back to the first animal built", /species: \[\["all", "All animals", 40000\], \["ctl", "Cattle", 400\],/.test(src) &&
        /!archive && i < cfg\.species\.length && pick\[0\] === "all"/.test(src));
  const sizes = new Function(src.slice(src.indexOf("const ABATTOIR_SIZES"), src.indexOf("const LAYERS = [")) + "; return ABATTOIR_SIZES;")();
  check("the US register's sizes are said in words, and can be chosen", sizes.length === 5 && sizes.every(([v, w]) => v && w.length > 10) &&
        /keys: \[\{ label: "Size \(only the US register gives one\)", property: "x_size_class"/.test(src) && /data-kv="__none__"/.test(src));
  const kf = new Function("keyOff", src.slice(src.indexOf("function keyFilterExpr(cfg)"), src.indexOf("function keysRow(cfg)")) + "; return keyFilterExpr;");
  const off = new Map([["r", new Map([["p", new Set(["__none__"])]])]]);
  const one = kf(off)({ id: "r", keys: [{ property: "p", values: ["a", "b"] }] });
  const off2 = new Map([["r", new Map([["p", new Set(["a", "__none__"])]])]]);
  const two = kf(off2)({ id: "r", keys: [{ property: "p", values: ["a", "b"] }] });
  check("places with no size can be hidden too", JSON.stringify(one) === JSON.stringify(["all", ["all", ["has", "p"], ["!=", ["get", "p"], null]]]) &&
        JSON.stringify(two) === JSON.stringify(["all", ["any", false, ["in", ["get", "p"], ["literal", ["b"]]]]]));
  check("the Trase slaughterhouse row is out: the registries row holds every Trase site", /\n  "trase_meat_brazil",\n/.test(src));
}
console.log("\nround 135b (2 October): reefs drawn smooth in teal; the food industry map whole");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the reefs' world view is light teal, full size, smoothed", /const CORAL_WORLD_TINT = "6FC2DA";/.test(src) && /wcmc\(256, CORAL_WORLD_TINT \+ "\+grow"\)/.test(src) && /"raster-opacity": 0\.85, "raster-resampling": "linear"/.test(src));
  check("Who Owns the Food Industry reads the page's whole data", /id: "site_food_system"[^\n]*food\/system\.places\.geojson/.test(src));
}
console.log("\nround 136b (2 October): six more ocean pressures, and offshore platforms");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const ids = ["ocean_slr", "ocean_light", "ocean_trawling", "ocean_bycatch", "ocean_coastal_people", "ocean_runoff"];
  check("each pressure is a row of its own, read from its build's choices", ids.every((i) => new RegExp(`id: "${i}"[^\\n]*route: "rasterlive"`).test(src) && src.includes(`tiles/${i}.choices.json`) && src.includes(`"${i}",`)));
  check("offshore platforms under Oceans and under oil spills at sea", /id: "offshore_platforms"[^\n]*route: "geojsonlive"/.test(src) &&
        /"skytruth_marine_incidents", "offshore_platforms",\n/.test(src) && /t: "Offshore platforms", tag: "not counted/.test(src));
}
console.log("\nround 137b (2 October): fish decline, stocks and populations");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("fish stocks by country from RAM Legacy, and the Living Planet populations, under Fish and under Oceans",
        /id: "fish_stocks"[^\n]*route: "country"/.test(src) && /id: "lpi_populations"[^\n]*route: "pmtiles"/.test(src) && /keys: \[\{ label: "Kind of animal", property: "x_class"/.test(src) &&
        /t: "Fish" \}, "fish_stocks", "lpi_populations",/.test(src) && /t: "Fish decline"[^\n]*\}, "fish_stocks", "lpi_populations",/.test(src));
}
console.log("\nround 139b (2 October): fish caught and farmed, country by country (FAO)");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("FAO capture and aquaculture under Marine meats and under Oceans > Fishing", /id: "fao_capture"[^\n]*route: "country"/.test(src) && /id: "fao_aquaculture"[^\n]*route: "country"/.test(src) &&
        /t: "Wild-caught fish" \}, "fao_capture",/.test(src) && /t: "Fish and shrimp farms" \}, "fao_aquaculture",/.test(src) && /"fao_capture", "fishing", "iuu_vessels", "iuu_positions", "fao_aquaculture"/.test(src));
}
console.log("\nround 140b-142b (2 October): combine in any order; base map kept, crossings outlined");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("each tick reaches the combine, whichever came first", /Round 140b: the combine follows every tick[^\n]*\n  if \(typeof COMBO !== "undefined" && COMBO\.mode !== "off"\) comboSoon\(600\);/.test(src) &&
        /map\.on\("idle", \(\) => \{\n  if \(COMBO\.mode === "off"\) return;\n  const sig = comboSig\(\);/.test(src));
  check("pictures take part, counted where they paint", /if \(!rowVectorLayers\(id\)\.length && !comboPictureSource\(id\)\) continue;/.test(src) && /const pic = await comboPictureGrid\(id\);/.test(src));
  check("the veil is kept out of the colour mapping", /const GLAD_BASE_LAYERS = \/\^\(bg\|combo-mask\.\*\|/.test(src));
  // Round 142b: no veil; lines and areas clipped, crossings outlined, polar rows out.
  const added = [];
  const fake = { _l: new Map(), _s: new Map(),
    getLayer(id) { return this._l.get(id); }, getSource(id) { return this._s.get(id); },
    addSource(id, sp) { this._s.set(id, { data: sp.data, setData(d) { this.data = d; } }); },
    addLayer(l, before) { added.push([l.id, before]); this._l.set(l.id, l); }, moveLayer() {},
    setLayoutProperty(id, k, v) { this._l.get(id).vis = v; }, getStyle() { return { layers: [] }; } };
  const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
  const lib = new Function("map", "COMBO", "POINT_RELIEF_RES", "visibility", "rowVectorLayers", "rowRasterSource",
    cut("function comboShape(keep, W, H)", "function comboPoints(") + cut("function comboPictureSource(id)", "// A picture's own address") +
    cut("function comboSig()", "const COMBO_COPY = new Map();") + "const COMBO_MASK = \"combo-mask\", COMBO_EDGE = \"#CFEAF4\", COMBO_EDGE_MOST = \"#9FD8EA\";" +
    cut("function comboEdges(keep, W, H)", "if (typeof map.on === \"function\") map.on(\"idle\"") + "; return { comboMaskSet, comboSig, comboClip, comboRects, comboEdges, comboShape };")(
    fake, { pr: { rid: "x" }, weights: new Map() }, 90, new Map([["a", "visible"], ["b", "none"]]), () => [], () => null);
  check("what the combine was made from: the rows showing", lib.comboSig() === "a:0::1");
  const rects = lib.comboRects(lib.comboShape(Uint8Array.from([0, 0, 1, 0, 0, 0, 0, 0]), 4, 2));
  const clipped = lib.comboClip([{ properties: { k: 1 }, geometry: { type: "Polygon", coordinates: [[[-10, -10], [50, -10], [50, 50], [-10, 50], [-10, -10]]] } },
    { properties: {}, geometry: { type: "LineString", coordinates: [[-50, 10], [120, 10]] } }, { properties: {}, geometry: { type: "Point", coordinates: [10, 10] } }], rects);
  check("areas and lines are cut to the crossings, their fields kept", JSON.stringify(rects) === "[[0,0,90,90]]" && clipped.length === 2 && clipped[0].properties.k === 1 &&
        JSON.stringify(clipped[0].geometry.coordinates[0][0].map((c) => c.map(Math.round)).sort()) === JSON.stringify([[50, 0], [50, 50], [0, 50], [0, 0], [50, 0]].sort()) &&
        JSON.stringify(clipped[1].geometry.coordinates) === "[[[0,10],[90,10]]]");
  const edges = lib.comboEdges(Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 0]), 4, 2);
  check("the outline goes round the crossings, not along each square", edges.length === 4 && edges.some((l) => JSON.stringify(l) === "[[-180,90],[0,90]]") && edges.some((l) => JSON.stringify(l) === "[[-180,0],[0,0]]"));
  lib.comboMaskSet({ keepGrid: Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 0]), count: Uint8Array.from([3, 2, 0, 0, 0, 0, 0, 0]), W: 4, H: 2, best: 3, used: ["a", "b", "c"] });
  check("crossings edged in pale ice, the most-crossed brighter and thicker, no veil over the base map", added.map((a) => a[0]).join() === "combo-mask-edge,combo-mask-most" &&
        fake._l.get("combo-mask-most").paint["line-width"] > fake._l.get("combo-mask-edge").paint["line-width"] && !/fill-opacity": COMBO_VEIL/.test(src) && !/id: COMBO_MASK, type: "fill"/.test(src));
  lib.comboMaskSet(null);
  check("the outline goes when nothing is kept", fake._l.get("combo-mask-edge").vis === "none" && /if \(!hide\) \{ COMBO\.lastKey = null; COMBO\.keepGrid = null; comboCut\(null\); comboMaskSet\(null\); \}/.test(src));
  check("no squares past 85 degrees (they drew lines round the world)", /if \(Math\.abs\(90 - \(y \+ 0\.5\) \* POINT_RELIEF_RES\) > 85\) count\.fill\(0, y \* W, \(y \+ 1\) \* W\);/.test(src));
  check("an older run is dropped when a newer one starts", /const gen = \+\+COMBO\.gen;/.test(src) && /if \(COMBO\.mode === "off" \|\| gen !== COMBO\.gen\) return;/.test(src) && /const stale = \(\) =>/.test(src));
  check("pictures are clipped pixel by pixel, and put back after", /maplibregl\.addProtocol\("combocut"/.test(src) && /s\.setTiles\(own\.map\(\(t\) => `combocut:\/\/\$\{COMBO\.gen\}\/\{z\}\/\{x\}\/\{y\}\/\$\{t\}`\)\)/.test(src) &&
        /if \(cur && \/\^combocut:\/\.test\(cur\[0\]\) && typeof s\.setTiles === "function"\) s\.setTiles\(tiles\);/.test(src));
  check("the same crossings leave the map untouched", /if \(key !== COMBO\.lastKey\) \{/.test(src) && /ms == null \? 400 : ms/.test(src));
}

console.log("\nround 143b (2 October): layers grouped, so alike layers do not cross each other");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const heads = { mine_sites: "Mining", mine_features: "Mining", wdpa: "Protected areas", ufo: "" };
  const document = { querySelector: (q) => { const id = (q.match(/data-layer="([^"]+)"/) || [])[1]; return heads[id] ? { closest: () => ({ querySelector: () => ({ textContent: ` ${heads[id]} ` }) }) } : null; } };
  const COMBO = { groups: new Map() };
  const lib = new Function("document", "COMBO", src.slice(src.indexOf("const COMBO_LETTERS = "), src.indexOf("function comboList() {")).replace("COMBO.groups = new Map();", "") + "; return { comboGroups };")(document, COMBO);
  const g = lib.comboGroups(["mine_sites", "mine_features", "wdpa", "ufo"]);
  check("layers under one heading start in one group, others in their own", g.get("mine_sites") === "A" && g.get("mine_features") === "A" && g.get("wdpa") === "B" && g.get("ufo") === "C");
  COMBO.groups.set("mine_features", "B");
  const g2 = lib.comboGroups(["mine_sites", "mine_features", "wdpa"]);
  check("a layer moved by the reader keeps its group; the others take letters not chosen", g2.get("mine_features") === "B" && g2.get("mine_sites") === "A" && g2.get("wdpa") === "C");
  check("a square counts the groups present, not the layers", /here\[i\] = 1;/.test(src) && /for \(const here of present\.values\(\)\) for \(let i = 0; i < count\.length; i\+\+\) count\[i\] \+= here\[i\];/.test(src) &&
        /if \(groups < 2\) return \{ keep: null, best: 1, used, groups, oneGroup: true \};/.test(src));
  check("each row's menu: group A to H or left out", /\[\.\.\.COMBO_LETTERS\]\.map\(\(l\) => \[l, `group \$\{l\}`\]\)\.concat\(\[\["0", "left out"\]\]\)/.test(src) && /else \{ COMBO\.weights\.set\(id, 1\); COMBO\.groups\.set\(id, v\); \}/.test(src));
}

console.log("\nround 144b (2 October): how much of each layer is crossed, worldwide and in view");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const bounds = { getWest: () => -180, getEast: () => 0, getNorth: () => 90, getSouth: () => 1 };
  const map = { getBounds: () => bounds };
  const lib = new Function("map", "POINT_RELIEF_RES", src.slice(src.indexOf("function comboViewCells(W, H)"), src.indexOf("function comboStatsRender()")) + "; return { comboViewCells, comboShares };")(map, 90);
  // A 4 x 2 world: mines (A) in squares 0, 1 and 5; protected (B) present in 1 and 5; water (C) in 0.
  const present = new Map([["A", Uint8Array.from([1, 1, 0, 0, 0, 1, 0, 0])], ["B", Uint8Array.from([0, 1, 0, 0, 0, 1, 0, 0])], ["C", Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0])]]);
  const st = { W: 4, H: 2, present, rows: [{ id: "mines", grp: "A", idx: Int32Array.from([0, 1, 5]), w: Float32Array.from([2, 1, 1]), kind: "points" }] };
  const view = lib.comboViewCells(4, 2);
  const byB = lib.comboShares(st, "B", view)[0], any = lib.comboShares(st, "any", view)[0], own = lib.comboShares(st, "A", view)[0];
  check("the share crossed by one group, worldwide and in view", byB.world === 0.5 && byB.view === 1 / 3 && JSON.stringify([...view.cols]) === "[1,1,0,0]");
  check("by any other group, and none by its own", any.world === 1 && any.view === 1 && own.same === true);
  check("the shares sit in the combine box, follow the map and the menu", /<div id="combo-stats"/.test(src) && /e\.target\.id === "combo-by"\) \{ COMBO\.statsBy = e\.target\.value; comboStatsRender\(\); return; \}/.test(src) &&
        /map\.on\("moveend", \(\) => \{ if \(COMBO\.mode !== "off" && COMBO\.stats\) comboStatsRender\(\); \}\);/.test(src));
}

console.log("\nround 110c (29 September): planted, bought or captured, worldwide");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the capture row reads its cases from the tiles repo, coloured by what proves them", /id: "capture_cases"[^\n]*route: "geojsonlive"[^\n]*buildScript: "capture"/.test(src) &&
        /culprits-tiles-more\/capture\/cases\.geojson/.test(src) && /"Charged or alleged, not proven": "#F4F1EA"/.test(src) &&
        /"Settled bribery charges with a regulator \(often without admitting or denying\)": "#8FB8FF"/.test(src));
  check("it sits, as a view of the capture row, under Of countries by countries and under Politics as a front", /"site_secret_societies", "capture_all",/.test(src) && /\{ h: 4, t: "Politics as a front" \}, "capture_all",/.test(src));
  check("it has a kind, a site and a not-live note", /  capture_cases: \["human", "upstream"\],/.test(src) && /  capture_cases: "https:\/\/en\.wikipedia\.org\/wiki\/State_capture",/.test(src) &&
        /  capture_cases: "Built weekly by culprits-tiles-more/.test(src));
  check("its note names what it reads", /Venona papers/.test(src) && /Foreign Corrupt Practices Act actions/.test(src) && /Justice Department's yearly FCPA lists/.test(src) && /IPN catalogue of people in public office/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 1002);
}
console.log("\nround 111c (29 September): capture by country, seats, more sources");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the capture country rows read by_country.json", /id: "capture_countries"[^\n]*route: "country"/.test(src) && /id: "capture_share"[^\n]*route: "country"/.test(src) &&
        /capture\/by_country\.json", field: "lawmakers found per 100 seats today"/.test(src));
  check("they are views of the one capture row", /parts: \[\["capture_cases", [^\n]*\["capture_countries", [^\n]*\["capture_share", /.test(src));
  check("the capture note names the new sources", /Foreign Agents Registration Act/.test(src) && /barred for fraud or corruption/.test(src) && /Lithuanian, Latvian, Estonian/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 1003);
}
console.log("\nround 112c (29 September): StB registers matched by birth date");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the capture note names the Slovak StB matching", /Slovakia's StB registration books/.test(src) && /register's birth date matches/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 1004);
}
console.log("\nround 113c (29 September): capture boxes in plain words, truer places");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the capture row uses its own box", /buildScript: "capture", card: "capture",/.test(src) && /  capture\(p, name\) \{/.test(src) && /everyField\(p, \["summary", "name", "part"\]\)/.test(src));
  check("the capture note says how points are placed", /placed at the constituency they were elected for/.test(src));
  check("the page asks for this round's script", appVersion(html) >= 1005);
}
console.log("\nround 116b (29 September): glow orbs back, blue underworld countries, police, courts and prisons filed twice, gangs inside law enforcement");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const o = new Function(src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("// A heading's tick reads its layers")) + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
  check("the drug underworld map's countries are teal to cobalt, not grey, with darker edges",
        /colouringColours: \["#C6E7F0", "#6FC2DA", "#2E8FBA", "#1A5C92", "#0C2E5E"\], colouringEdge: "#08203F"/.test(src) &&
        /const own = Array\.isArray\(cfg\.colouringColours\)/.test(src) && /"fill-outline-color", state\.edge \|\| "#1D1B17"/.test(src));
  check("police stations under Law enforcement, courts and prisons under Courts and corrections, and all still under Buildings",
        o.PANEL_ORDER.indexOf("bld_police") === at("Law enforcement") + 1 && o.PANEL_ORDER.indexOf("bld_courts") === at("Courts and corrections") + 1 &&
        o.PANEL_ORDER.indexOf("bld_prisons") === at("Courts and corrections") + 2 && o.PANEL_ORDER.includes("building_types") &&
        /onlyKinds: \["Police stations"\]/.test(src) && /onlyKinds: \["Courts"\]/.test(src) && /onlyKinds: \["Prisons"\]/.test(src) &&
        /if \(!cfg\.onlyKinds && anchor && anchor\.after/.test(src));
  check("gangs inside law enforcement is a row under Law enforcement, coloured by which way round",
        o.PANEL_ORDER.indexOf("gang_infiltration") > at("Law enforcement") && o.PANEL_ORDER.indexOf("gang_infiltration") < at("Courts and corrections") &&
        /id: "gang_infiltration"[^\n]*route: "geojsonlive"/.test(src) && /lawenforcement\/gang_infiltration\.geojson/.test(src) &&
        /"Officers running a gang or crime ring of their own": "#4F8BFF"/.test(src));
  check("a few-point layer's glow dots are seen at every zoom", /if \(hudOf\.has\(layer\.id\) && !\(layer\.paint && layer\.paint\["circle-opacity"\] !== undefined\)\) map\.setPaintProperty\(layer\.id, "circle-opacity", 0\.9\);/.test(src));
}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
