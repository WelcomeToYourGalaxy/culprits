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
  getBounds() {
    return { getWest: () => 10, getSouth: () => 20, getEast: () => 11, getNorth: () => 21 };
  }
  getCanvas() { return { style: {} }; }
}

let popups = [];
class FakePopup {
  constructor() { this.html = null; }
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
    }), els.get(id)),
    // One object per selector, kept, so a layer's status line can be read back.
    querySelector: (sel) => (states[sel] ||= { textContent: "" }),
    // Closer to a real element than it was: the layer panel now builds nested
    // group rows, reads data-* attributes and inserts facet rows after a
    // checkbox, so a stub with only className and innerHTML made app.js look
    // broken when it was the harness that was thin.
    createElement: () => ({
      className: "", innerHTML: "", dataset: {},
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
  check("shapes draw from zoom 7, off the same zoom in the source",
        fill && fill.minzoom === 7 && fill["source-layer"] === "default" && src.minzoom === 7);
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
  check("the marking only shows where shapes are drawn", cap && cap.minzoom === 7);
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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
