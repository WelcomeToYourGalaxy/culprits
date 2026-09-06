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
    if (!this.sources.has(def.source)) {
      throw new Error(`layer "${def.id}" references missing source "${def.source}"`);
    }
    if (beforeId !== undefined && !this.layers.some((l) => l.id === beforeId)) {
      throw new Error(`beforeId "${beforeId}" does not exist`);
    }
    this.layers.push(def);
  }
  getLayer(id) { return this.layers.find((l) => l.id === id); }
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

  const els = new Map();
  globalThis.document = {
    baseURI: "https://example.test/culprits/",
    getElementById: (id) => els.get(id) || (els.set(id, {
      innerHTML: "", textContent: "", appendChild() {}, addEventListener() {},
    }), els.get(id)),
    querySelector: () => ({ textContent: "" }),
    createElement: () => ({ className: "", innerHTML: "", appendChild() {} }),
    addEventListener() {},
  };
  globalThis.maplibregl = {
    Map: function () { return map; },
    NavigationControl: function () {}, ScaleControl: function () {},
    Popup: FakePopup,
    addProtocol() {},
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
  return { map, els };
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
  check("no worker call at aggregate zoom",
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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
