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
  globalThis.pmtiles = { Protocol: function () { return { tile: () => {} }; } };
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
  check("the parent carries a disclosure control", /data-disc=/.test(rows));

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

  const { map } = run({ layersReady: "gfw" });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const url = map.sources.get("gfw-tiles")?.tiles?.[0] || "";
  check("the tropics layer loads through the clip, cut at its own bounds",
        url.startsWith("latclip://-30,30,8A4F46/") && url.includes("/gfw_tile/{z}/{x}/{y}"), url);
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
  check("shapes draw from zoom 12", fill && fill.minzoom === 12 && s2.minzoom === 12);
  check("wider out the layer says why it is empty",
        /zoom in to 12/.test((states['[data-state="allen_coral"]'] || {}).textContent || ""));

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
  check("the boxes down the left take it", /\.left-col\{[\s\S]{0,120}width:var\(--box-w\)/.test(index));
  check("the news wires box takes it too, no longer 440px",
        /width:min\(var\(--box-w,290px\),calc\(100vw - 18px\)\)/.test(wireSrc) && !/440px/.test(wireSrc));
  check("the legend and the zoom buttons together are as wide as the wires box",
        /#legend\{position:absolute;right:calc\(9px \+ var\(--zoom-w\) \+ var\(--box-gap\)\)/.test(index) &&
        /width:calc\(var\(--box-w\) - var\(--zoom-w\) - var\(--box-gap\)\)/.test(index));
  check("the zoom buttons sit to the right of the legend",
        /function moveZoomButtons/.test(src) && /getElementById\("zoombox"\)/.test(src) &&
        /#zoombox\{position:absolute;right:9px;bottom:26px/.test(index) && /id="zoombox"/.test(index));
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
        /\.wire\{position:absolute;right:9px;top:16px;/.test(wireSrc) &&
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
  check("the name, the settings and the layers are three boxes", /class="left-col"/.test(index) &&
        /<div class="title-box">/.test(index) && /id="basemaps" class="ctrl-box"/.test(index));
  check("the layer box holds the caret that rolls it",
        /panel-head[\s\S]{0,200}id="panelRoll"/.test(index) && /\.panel\.shut > \*\{display:none\}/.test(index));
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
  check("the marks are rings of their own, not another dot",
        /"circle-stroke-color": WIRE_COLOUR/.test(src) && /"circle-color": "rgba\(0,0,0,0\)"/.test(src));
  check("stories at one place become one mark that lists them",
        /wireAt\.get\(f\.properties\.k\)/.test(src) && /\["get", "n"\]/.test(src));
  check("the page itself does not scroll", /html,body\{margin:0;height:100%;overflow:hidden/.test(index));
  check("the globe opens with room around it, clear of the hand-over",
        /const OPENING_ZOOM = 1;/.test(src) && /EYES_FIT = \{ zoom: 0\.8/.test(src));
  check("Eyes opens on the address from its own embed panel",
        /surfaceMapTiling=true/.test(src) && !/detailPanel/.test(src) && !/collapseSettingsOptions/.test(src));
  check("the bar is gone; the way back is a box and Earth itself",
        !/space-bar/.test(index) && /id="spaceBack"/.test(index) && /id="spaceEarth"/.test(index) &&
        /function showBack/.test(src) && /globeRadiusPx\(handoffZoom\(\)/.test(src));
}


console.log("\nreading the map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  check("the imagery basemap is graded like the atlas's imagery",
        /satellite: \{ "raster-brightness-min": ATLAS_TUNE\.lift/.test(src) &&
        /for \(const k of \["atlas", "satellite"\]\)/.test(src));
  check("and carries the same washes", /BASEMAP === "outlines" \|\| !options/.test(src));
  check("the caret sits in the layer box, not the title box",
        /<div class="panel-head">[\s\S]{0,200}id="panelRoll"/.test(index) &&
        !/title-box[\s\S]{0,120}panelRoll/.test(index) && /\.panel\.shut > \.panel-head\{display:flex\}/.test(index));
  check("Subjects is a drop-down row at the top of the filters", /class="wire-filter wire-subjrow"><span>Subjects<\/span>/.test(wireSrc) &&
        wireSrc.indexOf("wire-subjrow") < wireSrc.indexOf('id="wireFilters"'));
  check("Refresh sits inside the box, beside the search", /<div class="wire-search">[\s\S]{0,260}id="wireRefresh"/.test(wireSrc));
  check("View and Basemap roll up on their own", /data-roll="\$\{key\}"/.test(src) && /sectHead\("View", "view"\)/.test(src) &&
        /sectHead\("Basemap", "basemap"\)/.test(src) && /\.sect\.shut \.sect-body\{display:none\}/.test(index));
  check("Climate TRACE draws fine, ringed points in its own colours", /if \(cfg\.fine\)/.test(src) &&
        /"circle-stroke-color": "#0E0D0A"/.test(src) && /colour: CT_COLOURS\[id\]/.test(src));
  check("the filters are not folded away at all any more",
        !/state\.expanded\[/.test(wireSrc) && /class="wire-filter"/.test(wireSrc));
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
  check("the map's boxes leave the screen in Eyes", /\[".left-col", "#legend", ".wire", "#zoombox"\]/.test(src));
  check("Leave Earth stands beside the two views", /<div class="view-row"><div class="view-choices">/.test(src) &&
        /\.view-row\{display:flex/.test(index));
  check("one list of subjects, with select all and clear all",
        /SUBJECTS\.slice\(\)\.sort/.test(wireSrc) && !/Topic feeds<\/p>/.test(wireSrc) &&
        /data-all="1">Select all/.test(wireSrc) && /data-none="1">Clear all/.test(wireSrc));
  check("the Subjects button reads as a drop-down", /wire-dd wire-subjects/.test(wireSrc) &&
        /\.wire-picker\{position:absolute/.test(wireSrc));
  check("one drop-down per filter, options under the subject they came from",
        /const kinds = \[\]/.test(wireSrc) && /<optgroup label="/.test(wireSrc) &&
        /esc\(id \+ '\|' \+ o\.value\)/.test(wireSrc));
  check("the per-subject line of numbers is gone",
        !/filters set/.test(wireSrc) && !/function subjectState/.test(wireSrc) && !/harvested /.test(wireSrc));
  check("refresh clears the filters too", /\$refresh\.addEventListener\('click', \(\) => \{[\s\S]{0,120}state\.sel = \{\}/.test(wireSrc));
  check("the tick box says what it does", /show them on the map</.test(wireSrc));
  check("the wires box is not dragged", !/makePullable\(w, "top"\)/.test(src) && /makePullable\(document\.getElementById\("legend"\), "top"\)/.test(src));
  check("stories are rings, sized by how many are there",
        /id: "wire-news", type: "circle"/.test(src) && /"circle-stroke-color": WIRE_COLOUR/.test(src) &&
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
  check("terrain is drawn on a round Earth that flattens close up",
        /return TERRAIN_ON \? "globe" : VIEWS\[kind \|\| VIEW\]\.projection/.test(src));
  check("the map tilts to 85 degrees and rolls", /maxPitch: 85/.test(src) && /rollEnabled: true/.test(src));
  check("the compass shows tilt and turn", /showCompass: true, visualizePitch: true/.test(src));
  check("the whole-world button sits with the zoom buttons", /function addWorldButton/.test(src) &&
        /#zoombox \.maplibregl-ctrl-group/.test(src) && /addWorldButton\(\);/.test(src));
  check("the sky over a tilted map is dark slate", /"sky-color": "#1B242B"/.test(src));
  check("the zoom buttons are moved into their own box",
        /function moveZoomButtons/.test(src) && /holder\.insertBefore\(group/.test(src) &&
        !/\.maplibregl-ctrl-bottom-right \.maplibregl-ctrl-group\{position:absolute/.test(index));
  check("Leave Earth sits alone to the right of the view choices", !/id="to-globe"/.test(src) &&
        /\.ctrl-box \.leave\{flex:1 1 55%/.test(index));
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
  check("terrain on draws the round globe that flattens close up",
        projections.at(-1) === "globe" && terrains.at(-1) === "terrain-dem");
  panel.fire("change", { target: { name: "view", value: "flat" } });
  check("…and stays round at world scale from the flat map too", projections.at(-1) === "globe" && terrains.at(-1) === "terrain-dem");
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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
