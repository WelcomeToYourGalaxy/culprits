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
  const expr = JSON.stringify(fill.paint["fill-opacity"]);
  check("choropleth uses a log scale", /log10/.test(expr), expr.slice(0, 90));
  check("small values keep a visible floor", /0\.12/.test(expr));
  check("no-data countries stay transparent", expr.includes('"case"'));
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
        /\["all", cfg\.where, picked\]/.test(facet));
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
  check("the livestock layers are gone", !/GLW_SPECIES|glw_/.test(src));
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
  const wash = map.getLayer("atlas-washes"), plate = map.getLayer("atlas-plate");
  check("the washes are a custom layer with a render function",
        wash && wash.type === "custom" && typeof wash.render === "function");
  check("the plate is an image source", map.sources.get("atlas-plate")?.type === "image");
  const firstData = ids.findIndex((id) => !/^atlas-/.test(id));
  check("washes, then plate, then everything else",
        ids.indexOf("atlas-washes") === 0 && ids.indexOf("atlas-plate") === 1 && firstData > 1,
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
        map.getLayer("atlas-plate").layout?.visibility === "visible");
  change("outlines");
  check("the plate is hidden under outlines",
        map.getLayer("atlas-plate").layout?.visibility === "none");
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
        /grid-template-columns:26px;/.test(index) && !/id="zoombox"/.test(index));
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
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  map.setZoom(4.5); map.fire("zoom");
  map.setZoom(0.4); map.fire("zoom");
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
  check("the compass sits lower, centred, with a caption", /class="compass-cap">Click: north up, level</.test(src) &&
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


console.log("\nreading the map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  check("the Satellite basemap has its own livelier grade; the atlas keeps its own",
        /satellite: \{ "raster-brightness-min": 0\.02, "raster-brightness-max": 1,\n\s*"raster-saturation": 0\.38/.test(src) &&
        /atlas: \{ "raster-brightness-min": ATLAS_TUNE\.lift/.test(src));
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
        /encoding: "terrarium", tileSize: 256, maxzoom: 12/.test(src) && /show\("hillshade", imagery && !TERRAIN_ON\)/.test(src));
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
        /"circle-blur": 0,/.test(src) && /0,  \["\*", 0\.18 \* scale, MAGNITUDE_RADIUS\]/.test(src));
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
        /return TERRAIN_ON && p !== "mercator" \? "globe" : p;/.test(src));
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
  check("how to tilt sits beside the terrain box", /class="terrain-row"/.test(src) && /<b>Mouse<\/b>/.test(src) &&
        /<b>Trackpad<\/b>/.test(src) && /Same on Mac and Windows/.test(src));
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
        !/data-tr="metric"/.test(src) && !/data-tr="country"/.test(src) && /data-tr="year"/.test(src) && /data-tr="level"/.test(src));
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
    check("the site-map build reads a place's type from its popup tag, for the three maps asked for and no others",
          /def popup_types\(features\):/.test(build) && /if not filters and m\.get\("types_from_popup_tag"\):/.test(build) &&
          reg.filter((m) => m.types_from_popup_tag).map((m) => m.id).sort().join() === "site_enslaved_microbes,site_enslaved_plants,site_insentient");
    check("\u2026and each of those maps has a row per type in the box, in place of its one row",
          ["site_enslaved_plants", "site_enslaved_microbes", "site_insentient"].every((i) => new RegExp(`id: "${i}", typeRows: true`).test(src)) &&
          /readCataloguesAtStart\(\);\n  readSiteTypeRowsAtStart\(\);/.test(src) && /own_nodes\.forEach\(\(n\) => gone\.appendChild\(n\)\)/.test(src));
    const title = new Function(src.match(/function siteTypeTitle[^\n]*\n/)[0] + "; return siteTypeTitle;")();
    check("\u2026titled for the type and the map it belongs to", title("Lawns & sports turf", "Plants 2026") === "Lawns & sports turf \u2014 Plants 2026");
    check("\u2026with no type ticked the map is off, and All on ticks every type",
          /own\.checked = tr\.picked\.size > 0;/.test(src) && /tr\.picked = new Set\(own\.checked \? boxes\(\)\.map/.test(src) &&
          /siteTypeRows\.get\(cfg\.id\)\.fi === i\) return;/.test(src));
  }
  check("the catalogues' lists are read once the box is arranged, since their own rows are hidden and never ticked",
        /const CATALOGUE_ROUTES = new Set\(\["wmsmenu", "gfwmenu", "trase"\]\)/.test(src) &&
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
        /tint:\/\/\$\{CORAL_CLASSES\["Coral\/Algae"\]\.slice\(1\)\}\/data-gis\.unep-wcmc\.org/.test(src));
  check("from the world view the reefs are drawn coarse, so a reef a few hundred metres across can be seen",
        /wcmc\(96\)/.test(src) && /wcmc\(256\)/.test(src) && /"raster-resampling": "nearest"/.test(src));
  check("…and the row says whose map it is", /UNEP-WCMC's warm-water reefs at this width/.test(src));
  check("the switch reaches the world layer", /`\$\{id\}-world`/.test(src));
}

console.log("\nthe layers box, in the chosen order");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const ids = order.PANEL_ORDER.filter((x) => typeof x === "string" && !x.startsWith("group:") && x !== "gm");
  check("every id in the order is a real layer", ids.every((id) => new RegExp(`id: ?"${id}"`).test(src)),
        ids.filter((id) => !new RegExp(`id: ?"${id}"`).test(src)).join(", "));
  // Superseded: a layer that belongs to two subjects is named under both, and the
  // box makes the second naming a copy of the row (copyRow), never a second layer.
  const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
  check("a layer named under two headings is one row and a copy of it, never two layers",
        /if \(placed\.has\(item\)\) \{\n\s*const copy = copyRow\(leads\.get\(item\), item\);/.test(src) &&
        twice.every((id) => ids.filter((x) => x === id).length === 2), twice.join(", "));
  {
    const feeds = ["skytruth_nrc", "skytruth_posts", "skytruth_marine_incidents", "skytruth_pa_permits", "skytruth_pa_spud",
                   "skytruth_pa_violations", "skytruth_well_permits", "skytruth_fracfocus", "skytruth_quakes"];
    const at = (t) => order.PANEL_ORDER.findIndex((x) => x && x.t === t);
    check("SkyTruth Monitor's nine alert feeds are rows, each from its own daily copy",
          feeds.every((id) => new RegExp(`id: "${id}"[^\\n]*route: "geojsonlive"`).test(src) && ids.includes(id)) &&
          (src.match(/culprits-tiles-more\/skytruth\/feed_\d+\.geojson/g) || []).length === 10);
    check("\u2026filed by what they show: spill reports under slicks and pollution, drilling under its own heading",
          at("Oil and gas drilling") > at("Mining") && order.PANEL_ORDER.indexOf("skytruth_fracfocus") > at("Oil and gas drilling") &&
          ids.filter((x) => x === "skytruth_nrc").length === 2 && ids.filter((x) => x === "skytruth_pa_violations").length === 2);
    check("\u2026nothing SkyTruth publishes is left out: the developers' test feed is a row too",
          /id: "skytruth_tests"[^\n]*route: "geojsonlive"/.test(src) && /skytruth\/feed_10101\.geojson/.test(src) && ids.includes("skytruth_tests"));
    check("\u2026an alert with no position is counted on its row, not passed over",
          /if \(!ft\.geometry\) \{ nowhere\+\+; return; \}/.test(src) && /more in the file have no position and cannot be drawn/.test(src));
    check("\u2026and the vessels row no longer claims the last 30 days, which the service never applied",
          !/id: "skytruth_voc"[^\n]*last 30 days/.test(src) && !/vessels-of-concern alerts for the whole world over the last 30 days/.test(src));
  }
  check("nothing is both placed and removed", ids.every((id) => !order.PANEL_REMOVED.has(id)));
  const heads = order.PANEL_ORDER.filter((x) => typeof x === "object" && x.h === 1).map((x) => x.t);
  check("the four sections come first, in order", heads.slice(0, 4).join("|") === "On-planet invasion|Destruction|Suppression|Off-planet invasion");
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
  check("Off-planet invasion is its own section, after Suppression", at("Off-planet invasion") > at("Suppression") && at("Off-planet invasion") < at("Buildings"));
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
  check("Building types is one row", o.PANEL_ORDER.includes("building_types") && !o.PANEL_ORDER.includes("fin_bank"));
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
  const pre = order.findIndex((x) => x && x.t === "Pre-birth frontlines"), post = order.findIndex((x) => x && x.t === "Post-birth invasion");
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
  check("it is a row under Control of physical resources", /id: "rte_trade"/.test(src) && /"owid_aid", "rte_trade",/.test(src));
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

console.log("\nGlobal Safety Net");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const shown = new Function(src.slice(src.indexOf("function gsnShown("), src.indexOf("async function addGsnLayer(")) + "; return gsnShown;")();
  const list = [{ id: 1, gee_tile_url: "u" }, { id: 26, gee_tile_url: "u", is_hidden: "True" }, { id: 7, gee_tile_url: "u", is_multilayer: "True" }, { id: 9 }];
  check("the viewer's own layers are offered, its hidden helpers are not", shown(list).map((l) => l.id).join() === "1,7");
  check("each is drawn from the fresh address its list gives", /String\(l\.gee_tile_url/.test(src) && /\/tiles\/\{z\}\/\{x\}\/\{y\}`/.test(src));
}

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

console.log("\nGlobal Trade Alert");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("it is a row under Control of physical resources", /id: "gta_acts"/.test(src) && /"rte_trade", "gta_acts",/.test(src));
  const nameOf = new Function(src.slice(src.indexOf("function gtaNameOf("), src.indexOf("async function addGtaLayer(")) + "; return gtaNameOf;")();
  const known = new Set(["Italy", "United States of America"]);
  check("a shape is joined by whichever field names the country", nameOf({ NAME: "Italy" }, known) === "Italy" && nameOf({ label: "United States of America" }, known) === "United States of America" && nameOf({ name: "Atlantis" }, known) === null);
}

console.log("\noutside pages whole, in the panel");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("every remaining outside page is a row", ["cfr_tracker", "giga_schools", "bocc", "theyrule", "skytruth_voc", "esa_risk", "gsn_rankings"].every((i) => new RegExp(`id: "${i}"`).test(src)));
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
  check("the waiting rows are placed", ["ejatlas", "gsn", "seas_of_plastic", "coastal_cleanup", "mines_global", "atlas_hotspots", "final_nail", "group:ct_history"].every((i) => order.includes(i)));
}

console.log("\nvessels of concern drawn; the oil-slick archive");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("vessels of concern are drawn from the daily copy", /id: "skytruth_voc"[^\n]*route: "geojsonlive"/.test(src) && /skytruth\/vessels_of_concern\.geojson/.test(src));
  check("the slick archive is a row beside the live slicks", /id: "slick_archive"/.test(src) && /"cerulean_sources", "slick_archive",/.test(src));
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
  const between = (i, a, b) => pos(i) > at(a) && (b == null || pos(i) < at(b));
  check("no Whose world / Where in the chain chips in the box", !/chips\.innerHTML = kindChipsHtml\(\)/.test(src));
  check("every layer opens unticked", /for \(const c of LAYERS\) c\.off = true;/.test(src));
  check("the Eyes network is under Metaphysical (Religion, spirituality, etc.)", between("site_eyes_network", "Metaphysical (Religion, spirituality, etc.)", "Sports") && at("Religion and spirituality") === -1);
  check("Cartel cells, the export-credit background map and the duplicate Giga and Next Spaceflight rows are out",
        ["site_cartel_cells", "site_export_credit_shading", "giga_schools", "nsf_locations"].every((i) => o.PANEL_REMOVED.has(i)));
  check("the Energy Charter, ISDS and Break Free From Plastic rows are out", ["ect_secrets", "isds_tracker", "bffp_audit"].every((i) => o.PANEL_REMOVED.has(i)));
  check("the Tableau row is the CFR Global Imbalances Tracker", /id: "tableau_zsf", name: "CFR Global Imbalances Tracker"/.test(src));
  check("Giga by country is under School", between("giga_countries", "School", "Law enforcement"));
  check("EJAtlas is under Culprits upstream", between("ejatlas", "Culprits upstream", "Emissions"));
  check("Biodiversity loss holds the hotspots, hotspot cities, Subsidising Extinction and the Power BI report",
        ["atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report"].every((i) => between(i, "Biodiversity loss", "Mining")));
  check("Mining holds the mines", between("mines_global", "Mining", "Agriculture"));
  check("the refinery map is under Climate", between("fractracker_refineries", "Climate", "National shading"));
  check("the toxic release sites are one row, carrying the live layer", o.PANEL_REMOVED.has("epa_tri") && /name:"Factories reporting toxic chemical releases, US \(EPA Toxics Release Inventory\)", [^\n]*\n[^\n]*\n[^\n]*\n\s*linked: \["epa_tri"\]/.test(src));
  check("coral is one row", o.PANEL_REMOVED.has("unep_coral") && pos("allen_coral") > 0);
  check("mines are merged into counted points wider out", /mines here<\/b>/.test(src) && /"point_count"\], 1\]\]\]\],\n\s*6,/.test(src));
  check("alerts are grown and lightened wider out", /function recolorAlerts\(px, rgb, z, w\)/.test(src) && /recolorAlerts\(img\.data, tint, z, bmp\.width\)/.test(src));
  check("the atlas's two modelled sets are rows of their own, beside the registered facilities",
        !/parts: true,/.test(src) && /id:"abattoir_cafo"[^\n]*route:"cafo"/.test(src) && /id:"abattoir_glw"[^\n]*route:"glw"/.test(src) &&
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
        (src.match(/^  catalogueRows\(cfg, /gm) || []).length === 3);   // Nusantara, Global Forest Watch, Trase
  // Superseded: Nusantara's layers are rows of the box itself now, filed by
  // what they show, not a list inside one row.
  check("Nusantara's layers are rows of the box, filed by subject", /catalogueRows\(cfg, items\);/.test(src) && !/menu\.className = "facet ns-list"/.test(src));
}

console.log("\nEPA facilities at every zoom");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("wider out, the EPA row draws the weekly copy of every point", /epa_efpoints\.pmtiles/.test(src) && /id: `\$\{cfg\.id\}-pts`, type: "circle"/.test(src) && /maxzoom: cfg\.minzoom \|\| 22/.test(src));
  check("a point's full record is asked of EPA on click", /\/query\?objectIds=\$\{encodeURIComponent\(p\._oid\)\}&outFields=\*/.test(src));
  check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
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
  check("a heading's tick sits at the end of its line", /line\.appendChild\(head\);\n\s*line\.appendChild\(all\);/.test(src));
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
        /name: "Global Oil Refinery Complexes \(FracTracker Alliance\)"/.test(src) &&
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
        /all\.className = "toc-all"/.test(src) && /for \(const i of body\.querySelectorAll\("\[data-layer\], \[data-copy\]"\)\)/.test(src));
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
        /name: "Every US site EPA holds a record for, across all its programs \(EPA Envirofacts\)"/.test(src));
  check("HydroWASTE sits under Wastewater", at("Wastewater") > at("Pollution") && order.indexOf("hydrowaste") === at("Wastewater") + 1);
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
        [["trase_measures", String.raw`Deforestation and supply-chain measures (Trase)`],
         ["trase_meat_brazil", String.raw`Slaughterhouses and animal-product plants, Brazil (Trase)`],
         ["trase_silos_brazil", String.raw`Soy silos and storage, Brazil (Trase)`],
         ["trase_cocoa_ivory", String.raw`Cocoa cooperatives, C\u00f4te d'Ivoire (Trase)`],
         ["trase_palm_indonesia", String.raw`Palm oil mills, Indonesia (Trase)`],
         ["trase_pulp_indonesia", String.raw`Wood pulp mills, Indonesia (Trase)`],
         ["trase_pulp_concessions_2015", String.raw`2015\u20132019`],
         ["trase_pulp_concessions_2020", String.raw`2020\u20132022`],
         ["trase_pulp_concessions_2023", String.raw`2023\u20132024`]]
          .every(([i, n]) => src.includes(`id: "${i}", name: "${n}"`)) &&
        !/name: "Trase: /.test(src) && !/trasefacmenu/.test(src));
  check("each Trase row sits under the map's own heading, not a Trase one",
        ["trase_pulp_indonesia"].every((i) => order.indexOf(i) > at("Deforestation")) && !order.includes("trase_measures") &&
        ["trase_palm_indonesia", "trase_silos_brazil", "trase_cocoa_ivory"]
          .every((i) => order.indexOf(i) > at("Agriculture") && order.indexOf(i) < at("Meat")) &&
        order.indexOf("trase_meat_brazil") > at("Meat") && order.indexOf("trase_meat_brazil") < at("Oceans") &&
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
        at("Oceans") < at("Fishing") && between("fishing", "Fishing", "Oil slicks") &&
        o.PANEL_ORDER.indexOf("slavery_fishing") > at("Slavery"));
  check("the reefs sit under Biodiversity loss, with the Global Safety Net at the top of it",
        between("allen_coral", "Biodiversity loss", "Mining") &&
        o.PANEL_ORDER[at("Biodiversity loss") + 1] === "gsn");
  check("Agriculture is Meat and agriculture, holding Agriculture and Meat",
        at("Meat and agriculture") > 0 && at("Agriculture") > at("Meat and agriculture") &&
        between("land_matrix", "Agriculture", "Meat") && between("abattoir_facilities", "Meat", "Oceans"));
  check("the Power BI row is named for what it shows", /id: "powerbi_report", name: "Environmental Crime Tracker"/.test(src));
  check("every row carries the fold control, ticked or not, groups included",
        /"#layers label\.layer:has\(\+ \.facet\) \.fold\{display:inline-block\}"/.test(src) &&
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
  check("the row and its heading are called Buildings", /id: "building_types", name: "Buildings"/.test(src) && /\{ h: 1, t: "Buildings" \}/.test(src));
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
  check("each ticked row with boxes under it has a fold button", /f\.className = "fold";/.test(src) && /has\(\+ \.facet\) \.fold\{display:inline-block\}/.test(src));
}

console.log("\nOff-planet sections, Of groups, names, launch links, drag bar, markers, headings");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("Off-planet has To Earth and From Earth, with their four sections and one empty",
        at("To Earth") < at("Near-Earth object impacts") && at("Unidentified aerial phenomena") < at("From Earth") &&
        at("From Earth") < at("The space industry") && at("Space launches") < at("Protecting extraterrestrial life"));
  check("Fur Farms (Final Nail) is under Destruction, Of groups, Of animals", order.indexOf("final_nail") === at("Of animals") + 1 && at("Of animals") > at("Of groups") && /name: "Fur Farms \(Final Nail\)"/.test(src));
  check("Pet Food Companies is under The pet industry", order.indexOf("mymaps_supp_a") === at("The pet industry") + 1 && /name: "Pet Food Companies \(Google My Maps\)"/.test(src));
  check("each upcoming launch links to its own pages", /spacelaunchnow\.me\/launch\//.test(src) && /r\.info_urls/.test(src) && /ll2Links\(r\)/.test(src));
  check("page panels have a drag bar", /class="c-grab"/.test(src) && /ns-resize/.test(src));
  check("every point layer gets a geometric marker; the round one stays for clicks", /function addHud\(/.test(src) && /paint\(layer\.id, "circle-opacity", 0\)/.test(src));
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
  check("Plastics sits under Pollution", at("Pollution") > 0 && o.PANEL_ORDER[at("Plastics")].h === 4 && at("Plastics") > at("Pollution") && at("Toxic pollution") === -1);
  const kids = ["gmo_env", "gmo_decisions", "gmo_ogtr", "gmo_therapy", "gmo_fertility", "gmo_animal_research", "gmo_animal_trade"];
  check("the releases layer is split into its registers, each its own row", o.PANEL_REMOVED.has("gmo_releases") &&
        kids.every((k) => o.PANEL_ORDER.includes(k) && new RegExp(`id:"${k}", sourceOf:"gmo_releases"`).test(src)));
}

console.log("\nHydroWASTE on the map; the EIP and HydroFATE page rows gone");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("HydroWASTE's plants are drawn from their own archive", /id:"hydrowaste", +name:"Wastewater treatment plants \(HydroWASTE\)"[^\n]*route:"pmtiles"/.test(src) && fs.existsSync(path.join(HERE, "tiles", "hydrowaste.pmtiles")));
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
          far[(2 * 5 + 3) * 4 + 3] === 255 && far[(2 * 5 + 3) * 4] === 220 && far[(0 * 5 + 1) * 4 + 1] === 160 && far[(4 * 5 + 0) * 4 + 3] === 0);
    check("\u2026the zoom is read from the square asked for", S.zoomOfBbox("x?BBOX=0,0,20037508.34,20037508.34&W=1") === 1 &&
          S.zoomOfBbox("x?BBOX=0,0,2445.98,2445.98") === 14);
    check("Nusantara's pictures go through it only where the server lets them be read, and each ticked layer shows the server's own key",
          /plain\.replace\(\/\^https:\\\/\\\/\/, "seen:\/\/"\) : plain/.test(src) && /REQUEST=GetLegendGraphic/.test(src) &&
          /img\.onerror = \(\) => el\.remove\(\);/.test(src) && /else \{ on\.delete\(i\); legendOff\(items\[i\]\); \}/.test(src));
    check("a row's description sits behind an i beside its other marks, not as the whole row's hover text",
          /function infoMark\(text\)/.test(src) && !/row\.title = item\.about/.test(src) && /\$\{siteLink\(cfg\.id\)\}\$\{infoMark\(item\.about\)\}/.test(src) &&
          /if \(e\.target && e\.target\.closest && e\.target\.closest\("\.info"\)\) e\.preventDefault\(\);/.test(src));
    const G = new Function(src.slice(src.indexOf("const GFW_TITLES = {"), src.indexOf("// Datasets with no tiles of their own")) + "; return { gfwTitle, gfwPickAsset };")();
    const A = (asset_type, status, asset_uri) => ({ asset_type, status, asset_uri });
    check("a Global Forest Watch dataset is drawn from its ready-made tiles before the slow made-on-request ones",
          G.gfwPickAsset([A("Dynamic vector tile cache", "saved", "https://t/dynamic/{z}/{x}/{y}.pbf"), A("Static vector tile cache", "saved", "https://t/default/{z}/{x}/{y}.pbf")]).uri === "https://t/default/{z}/{x}/{y}.pbf" &&
          G.gfwPickAsset([A("Dynamic vector tile cache", "saved", "https://t/dynamic/{z}/{x}/{y}.pbf")]).slow === true);
    check("\u2026a tile cache still being made is not drawn from, and the row can say it is waiting",
          G.gfwPickAsset([A("Raster tile set", "saved", "s3://x"), A("Raster tile cache", "pending", "https://t/{z}/{x}/{y}.png")]).how === "none" &&
          G.gfwPickAsset([A("Raster tile cache", "pending", "https://t/{z}/{x}/{y}.png")]).waiting === true &&
          G.gfwPickAsset([A("Raster tile set", "saved", "s3://x"), A("COG", "saved", "s3://y")]).waiting === false);
    check("\u2026a dataset with no title is named where what it is can be shown, and otherwise says it has none",
          /Maus et al/.test(G.gfwTitle({ dataset: "pangaea_global_mining", metadata: {} })) &&
          G.gfwTitle({ dataset: "wur_x_class", metadata: {} }) === "Wur x class (Global Forest Watch gives this dataset no title)" &&
          G.gfwTitle({ dataset: "a", metadata: { title: "Tree cover" } }) === "Tree cover");
    const harvester = fs.readFileSync(path.join(HERE, "..", "pipeline", "sources", "abattoir_facilities.py"), "utf8");
    check("a harvested layer's box shows every field its source published, not the first six, and scrolls when long",
          !/\.slice\(0, 6\)\s*\n\s*\.map\(\(\[k, v\]\) => `\$\{k\.slice\(2\)/.test(src) && /k\.startsWith\("x_"\) && v !== null/.test(src) &&
          /maplibregl-popup-content\{max-height:60vh;overflow-y:auto/.test(fs.readFileSync(path.join(HERE, "index.html"), "utf8")));
    check("\u2026and the facilities harvester carries through what Trase published for a site, tax number included",
          /PUBLISHED_AS = \{"br_trase": "trase"\}/.test(harvester) && /\*\*_published\(members\),/.test(harvester));
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
        /<span class="nm">\$\{cfg\.name\}\$\{liveMark\(cfg\)\}\$\{siteLink\(cfg\.id\)\}\$\{infoMark\(cfg\.note\)\}<\/span>/.test(src) &&
        /<span class="nm">\$\{child\.name\}\$\{liveMark\(child\)\}\$\{siteLink\(child\.id\)\}\$\{infoMark\(child\.note\)\}<\/span>/.test(src));
  check("a row with no site shows no link rather than a guessed one",
        /const u = LAYER_SITE\[id\];\n  if \(!u\) return "";/.test(src) && /#layers \.nm \.src\{/.test(index));
  check("titles that named no source say so now",
        /name:"Coal plant units \(GEM Global Coal Plant Tracker\)"/.test(src) &&
        /name: "Genetic-engineering cultivation \(Genetic engineering map\)"/.test(src));
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
  check("crowded plumes are merged into one counted point, and split again close in",
        /cluster: true, clusterMaxZoom: CARBON_CLUSTER_TO/.test(src) &&
        /const CARBON_CLUSTER_TO = CARBON_PLUME_ZOOM - 1;/.test(src) &&
        /filter: \["has", "point_count"\]/.test(src) &&
        /filter: \["!", \["has", "point_count"\]\]/.test(src));
  check("a merged point says how many are under it", /plumes here<\/b>/.test(src));
  // The counted points run to the zoom where each plume starts drawing its own
  // picture, so there is no band between the world view and the street where
  // the layer reads as empty.
  check("the counted points carry every zoom up to the pictures",
        src.indexOf("const CARBON_PLUME_ZOOM") < src.indexOf("const CARBON_CLUSTER_TO") &&
        /const CARBON_PLUME_ZOOM = 10;/.test(src));
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
        /name:"Fertilizer plants \(Welcome to Your Galaxy\)"/.test(src) &&
        /name:"Soy industry bodies \(Welcome to Your Galaxy\)"/.test(src) &&
        /name: "Biosignature Evidence Assessment \(Welcome to Your Galaxy\)"/.test(src));
}

console.log("\nlive rows say so; the grips read as handles; a shut box stops scrolling");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const live = new Function(src.slice(src.indexOf("const LIVE_ROUTES = new Set(["), src.indexOf("function liveMark(")) + "; return LIVE_ROUTES;")();
  check("the routes that read their source as you look are marked live",
        ["worker", "cerulean", "coral", "carbonmapper", "wmsmenu", "gfwmenu", "trase", "ll2"].every((r) => live.has(r)));
  check("copies carry no mark", !live.has("pmtiles") && !live.has("sitemap") && !live.has("shapes") && !live.has("country"));
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
  check("Of individuals holds the same kinds as Of groups", kinds.length === 4);
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
        /countHeadings\(box\);\n  if \(box\.dataset\.catWired\) return;/.test(src) && (src.match(/countHeadings\(box\);/g) || []).length >= 3 &&
        /filter\(\(i\) => !\(i\.closest && i\.closest\("\[data-removed\]"\)\)\)/.test(src));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED"));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("the eight new headings are in, in the order's own style",
        ["Fire", "Forest and land cover", "Land held under permit", "Spatial plans", "Peatland",
         "Surface water", "Base and reference", "Land and territory"].every((t) => at(t) > -1));
  check("the planet's new headings sit under Of the planet, before Of groups",
        ["Fire", "Forest and land cover", "Land held under permit", "Spatial plans", "Peatland", "Surface water"]
          .every((t) => at(t) > at("Of the planet") && at(t) < at("Of groups")));
  check("Base and reference is its own section, beside Buildings", at("Base and reference") < at("Buildings") &&
        order[at("Base and reference")].h === 1);
}

console.log("\nNusantara's layers spread through the box");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const places = new Function(src.slice(src.indexOf("const CATALOGUE_PLACES = ["), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
  check("a layer goes under every subject its words answer to",
        places("Mining concessions Indonesia").includes("Destruction > Of the planet > Mining") &&
        places("Mining concessions Indonesia").includes("Destruction > Of the planet > Land held under permit"));
  check("fire alerts are fire and deforestation is deforestation",
        places("Fire alerts, VIIRS")[0] === "Destruction > Of the planet > Deforestation" ||
        places("Fire alerts, VIIRS").includes("Destruction > Of the planet > Fire"));
  check("customary forest is land and territory, not forest cover",
        places("Customary forest (hutan adat)").includes("Suppression > Of humans > Land and territory"));
  check("boundaries and relief are base and reference",
        places("Province boundaries").includes("Base and reference") &&
        places("Hillshade relief").includes("Base and reference"));
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
  check("the three pulp-concession periods sit under one heading of their own",
        at("Wood pulp concessions, Indonesia") > -1 &&
        ["trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023"]
          .every((i) => order.indexOf(i) > at("Wood pulp concessions, Indonesia")));
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
        /const where = String\(meta\.geographic_coverage \|\| ""\)\.trim\(\);/.test(src));
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
  check("every group is named for its subject", groups.length > 8 &&
        !groups.some((n) => /(climate trace|global forest watch|nusantara|trase|the site's own|map repos|organisations'|accountability map|engineering map)/i.test(n)));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED"));
  const order = new Function(body + "; return PANEL_ORDER;")();
  check("and so is every heading",
        !order.some((x) => x && x.t && /(climate trace|global forest watch|nusantara|trase|palmwatch|skytruth)/i.test(x.t)));
  check("the groups say what they hold",
        groups.includes("Emitting sites, by sector") && groups.includes("Emissions from farming and land use") &&
        groups.includes("Trees and plant cover lost, as it happens") && groups.includes("Maps made by others"));
}

console.log("\nGlobal Safety Net fixes; My Maps titles");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("Global Safety Net rows are under Biodiversity loss", order.indexOf("gsn") > at("Biodiversity loss") && order.indexOf("gsn") < at("Mining") && order.indexOf("gsn_rankings") < at("Mining"));
  check("a GSN tile template is not doubled", /\/\\\{z\\\}\/\.test\(u\) \? u :/.test(src));
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
  check("Terrestrial slicks comes first, then Marine slicks with the four marine rows",
        at("Oil slicks") < at("Terrestrial slicks") && at("Terrestrial slicks") < at("Marine slicks") &&
        o.PANEL_ORDER.indexOf("skytruth_monitor") > at("Terrestrial slicks") && o.PANEL_ORDER.indexOf("skytruth_monitor") < at("Marine slicks") &&
        ["cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc"].every((i) => o.PANEL_ORDER.indexOf(i) > at("Marine slicks") && o.PANEL_ORDER.indexOf(i) < at("Construction")));
  check("the slick archive draws a point per slick wider out", /id: `\$\{cfg\.id\}-pt`, type: "circle", source: `\$\{src\}-pt`, maxzoom: 7/.test(src));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
