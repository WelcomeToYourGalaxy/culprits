// Read one of the owner's maps by running its own script (round 188o), for the
// two maps whose boxes are written by their code when a place is clicked, so
// that reading what they draw (extract.mjs) would get names and little else:
//
//   law       Who Writes the Law: it works out its scores, its colours and
//             every country's and state's record in the browser from one data
//             block. Its own functions are asked for each country's record
//             (renderCountry), each US state's (renderState), every view's
//             value and colour for every country and state, the ranking, the
//             comparison table, the worldwide findings, and every person,
//             company and ALEC member it marks, with the box it gives each.
//   holidays  Who corporatized holidays: each entry's story panel (show), its
//             year colour (tone) and its tooltip, in the page's own order.
//
// Nothing is rewritten: what the boxes say is what the map's code writes.
//
// Usage: node pipeline/sitemaps/page_reader.mjs <law|holidays> <page url or file>
// Prints one JSON object.
import fs from "node:fs";
import vm from "node:vm";

const [mode, src] = process.argv.slice(2);
if (!src || !["law", "holidays"].includes(mode)) { console.error("usage: node page_reader.mjs <law|holidays> <page url or file>"); process.exit(1); }
const html = /^https?:/.test(src) ? await (await fetch(src, { headers: { "User-Agent": "culprits-map" } })).text() : fs.readFileSync(src, "utf8");

// ---- a stand-in for anything the page touches that does not matter here
function absorb(label) {
  const store = new Map();
  const fn = function () { return absorb(label + "()"); };
  return new Proxy(fn, {
    get(t, k) {
      if (store.has(k)) return store.get(k);
      if (k === Symbol.toPrimitive) return () => "";
      if (k === Symbol.iterator) return function* () {};
      if (k === "then") return undefined;
      if (k === "length") return 0;
      if (k === "toString" || k === "valueOf") return () => "";
      if (k === "querySelectorAll" || k === "getElementsByClassName" || k === "getElementsByTagName") return () => [];
      if (k === "querySelector" || k === "closest") return () => null;
      if (k === "classList") return { add() {}, remove() {}, toggle() { return false; }, contains: () => false };
      if (k === "style") { const o = { setProperty() {}, removeProperty() {}, getPropertyValue: () => "" }; store.set(k, o); return o; }
      if (k === "dataset") { const o = {}; store.set(k, o); return o; }
      if (k === "children" || k === "childNodes") return [];
      if (k === "value" || k === "innerHTML" || k === "textContent" || k === "innerText") return "";
      if (k === "x") return 1280;
      if (k === "y") return 800;
      return absorb(label + "." + String(k));
    },
    set(t, k, v) { store.set(k, v); return true; },
    apply() { return absorb(label + "()"); },
    construct() { return absorb("new " + label); },
    has() { return true; },
  });
}

// ---- the page's elements, kept so what a function writes can be read back
const elements = new Map();
const byId = (id) => { if (!elements.has(id)) elements.set(id, absorb("#" + id)); return elements.get(id); };
const document = new Proxy(absorb("document"), {
  get(t, k) {
    if (k === "getElementById") return byId;
    if (k === "querySelector") return (sel) => (/^#[\w-]+$/.test(sel) ? byId(sel.slice(1)) : null);
    if (k === "querySelectorAll") return () => [];
    if (k === "createElement") return (tag) => absorb("<" + tag + ">");
    if (k === "body") return byId("__body");
    return t[k];
  },
});

// ---- Leaflet stand-ins that keep what is drawn
const marks = [];            // every circle marker: where, its style, its box
function marker(ll, o) {
  const m = absorb("marker");
  const rec = { ll: Array.isArray(ll) ? ll.slice(0, 2) : [ll.lat, ll.lng], o: Object.assign({}, o || {}), popup: null, popupOpts: null, tooltip: null };
  marks.push(rec);
  const self = new Proxy(m, {
    get(t, k) {
      if (k === "bindPopup") return (h, po) => { rec.popup = typeof h === "function" ? h() : h; rec.popupOpts = po || null; return self; };
      if (k === "bindTooltip") return (h) => { rec.tooltip = typeof h === "function" ? h() : h; return self; };
      if (k === "setLatLng" || k === "setRadius" || k === "setStyle" || k === "on" || k === "addTo") return () => self;
      if (k === "_rec") return rec;
      return Reflect.get(t, k);
    },
    set(t, k, v) { if (k === "_k") rec.k = v; return Reflect.set(t, k, v); },
  });
  return self;
}
function layerGroup(list) {
  const items = new Set(list || []);
  const g = absorb("group");
  return new Proxy(g, {
    get(t, k) {
      if (k === "addLayer") return (l) => { items.add(l); return g; };
      if (k === "removeLayer") return (l) => { items.delete(l); return g; };
      if (k === "hasLayer") return (l) => items.has(l);
      if (k === "eachLayer") return (cb) => { for (const l of items) cb(l); };
      if (k === "addTo") return () => g;
      return Reflect.get(t, k);
    },
  });
}
function geoJSON(data, opts) {
  const layers = [];
  for (const f of (data && data.features) || []) {
    const l = absorb("feature");
    l.feature = f;
    layers.push(l);
    if (opts && opts.onEachFeature) { try { opts.onEachFeature(f, l); } catch (e) { /* display only */ } }
  }
  const g = absorb("geojson");
  return new Proxy(g, {
    get(t, k) {
      if (k === "eachLayer") return (cb) => layers.forEach(cb);
      if (k === "options") return opts || {};
      if (k === "addTo" || k === "setStyle" || k === "resetStyle" || k === "bringToBack" || k === "bringToFront") return () => g;
      return Reflect.get(t, k);
    },
  });
}
const L = new Proxy(absorb("L"), {
  get(t, k) {
    if (k === "circleMarker" || k === "marker" || k === "circle") return marker;
    if (k === "layerGroup" || k === "featureGroup") return layerGroup;
    if (k === "geoJSON" || k === "geoJson") return geoJSON;
    if (k === "latLngBounds") return () => absorb("bounds");
    if (k === "latLng") return (a, b) => (Array.isArray(a) ? { lat: a[0], lng: a[1] } : (typeof a === "object" ? a : { lat: a, lng: b }));
    return t[k];
  },
});

const sandbox = {
  L, document, console: { log() {}, warn() {}, error() {}, info() {} },
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  addEventListener() {}, removeEventListener() {}, scrollTo() {},
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  navigator: { userAgent: "node", language: "en" }, location: { href: "https://example.invalid/", search: "", hash: "" },
  URL, URLSearchParams, structuredClone,
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((m) => !/\bsrc\s*=/.test(m[1]) && m[2].trim());
const notes = [];
for (const m of scripts) {
  try { vm.runInContext(m[2], ctx, { timeout: 60000, filename: "page" }); }
  catch (e) { notes.push(`the page's script stopped early: ${String(e.message).slice(0, 160)}`); }
}

// ---- ask the page's own code for what it makes
const askHolidays = `(() => {
  const out = { entries: [], y0, y1 };
  for (const f of feats) {
    const e = { p: f.properties, m: null, li: null, dot: () => null };
    show(e);
    out.entries.push({ p: f.properties, ll: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
      story: document.getElementById("story").innerHTML, colour: tone(f.properties._year, 58), glow: tone(f.properties._year, 50, 60, .55),
      listColour: tone(f.properties._year, 66) });
  }
  out.keyFrom = tone(y0); out.keyTo = tone(y1);
  return JSON.stringify(out);
})()`;
const askLaw = `(() => {
  const out = { countries: [], states: [], lenses: [], measures: [], areas: [], areaSources: ASRCS, cats: CATS, svViews: [],
                findings: "", ranking: "", compare: "", total: COMPS.length, scored: SCORE_N };
  const val = (l, iso) => { try { const v = l.val(iso); return v == null ? null : v; } catch (e) { return null; } };
  const fmt = (l, v, iso) => { try { return l.fmt(v, iso); } catch (e) { return String(v); } };
  for (const l of LENSES_) out.lenses.push({ id: l.id, name: l.name, ds: l.ds, kind: l.kind, min: l.min, max: l.max, sqrt: !!l.sqrt, lo: l.lo, hi: l.hi });
  for (const c of COMPS) out.measures.push({ k: c.k, name: c.l, ds: c.d, w: c.w });
  // The view "Which laws are affected": for each source (cases, indices) the
  // top area, and each area on its own.
  const areaViews = [];
  for (const src of Object.keys(ASRCS)) {
    areaViews.push({ id: "area_" + src + "_all", src, area: "all" });
    const keys = src === "idx" ? Object.keys(IDXAREA) : Object.keys(CATS);
    for (const a of keys) areaViews.push({ id: "area_" + src + "_" + a, src, area: a });
  }
  out.areas = areaViews.map((v) => ({ id: v.id, src: v.src, area: v.area, name: v.area === "all" ? (v.src === "idx" ? "Area of law it ranks worst on (sector indices)" : "Area of law with the most cases") : CATS[v.area].l + (v.src === "idx" ? " (sector index)" : " (documented cases)"), ds: v.src === "idx" && v.area !== "all" ? "Position 0 to 100 on " + IDXAREA[v.area].l + " (100 = most captured)." : AREALENS.ds }));
  const dossier = () => ({ name: document.getElementById("dname").textContent, sub: document.getElementById("dsub").textContent, body: document.getElementById("dbody").innerHTML });
  for (const f of WORLD.features) {
    const iso = f.properties.iso;
    const row = { iso, name: nm(iso), geometry: f.geometry, v: {}, t: {}, c: {}, o: {}, cov: SCORE[iso] ? SCORE[iso].cov : null, rank: SCORE[iso] ? SCORE[iso].rank : null };
    // The colour and fill the page's own code gives the country under each view
    // (colorFor and styleCountry, with no country selected).
    const look = (id) => { try { row.c[id] = colorFor(iso); row.o[id] = styleCountry(f).fillOpacity; } catch (e) { /* no colour */ } };
    state.country = null; state.region = null;
    for (const l of LENSES_) { lens = l; const v = val(l, iso); if (v != null) { row.v[l.id] = v; row.t[l.id] = fmt(l, v, iso); look(l.id); } }
    for (const c of COMPS) {
      const x = CP[c.k][iso];
      lens = { id: "m_" + c.k, name: c.l, kind: "pos", val: (i) => (CP[c.k][i] ? CP[c.k][i].p : null), fmt: (v) => String(v) };
      if (x) { row.v["m_" + c.k] = x.p; row.t["m_" + c.k] = c.raw(x.raw) + " · position " + Math.round(x.p) + " of 100"; look("m_" + c.k); }
    }
    lens = AREALENS;
    for (const v of areaViews) {
      ASRC = v.src; AREA = v.area;
      const x = val(AREALENS, iso);
      if (x != null) { row.v[v.id] = x; row.t[v.id] = fmt(AREALENS, x, iso); look(v.id); }
    }
    ASRC = "cases"; AREA = "all"; lens = LENSES[0];
    try { renderCountry(iso); Object.assign(row, { box: dossier() }); } catch (e) { row.box = null; row.err = String(e.message).slice(0, 160); }
    out.countries.push(row);
  }
  for (const [k, s] of Object.entries(SVIEWS)) out.svViews.push({ k, name: s.l, src: s.src, lo: s.lo, hi: s.hi, cat: !!s.cat });
  for (const f of USST.features) {
    const code = f.properties.postal, row = { code, name: f.properties.name, geometry: f.geometry, v: {}, t: {}, c: {}, o: {} };
    for (const [k, s] of Object.entries(SVIEWS)) {
      let v = null; try { v = s.val(code); } catch (e) { v = null; }
      if (v != null) {
        row.v["s_" + k] = v;
        try { row.t["s_" + k] = s.fmt(v, code); } catch (e) { row.t["s_" + k] = String(v); }
        try { row.c["s_" + k] = s.col(v, code); row.o["s_" + k] = .66; } catch (e) { /* no colour */ }
      }
    }
    try { renderState(code, f.properties.name); row.box = dossier(); } catch (e) { row.box = null; row.err = String(e.message).slice(0, 160); }
    out.states.push(row);
  }
  try { out.findings = areaTotals() + DATA.global.map(findingHTML).join(""); } catch (e) { out.findingsErr = String(e.message); }
  try { renderRank(); out.ranking = document.getElementById("rlist").innerHTML; } catch (e) { out.rankingErr = String(e.message); }
  try { renderCompare(); out.compare = document.getElementById("cmpTable").innerHTML; } catch (e) { out.compareErr = String(e.message); }
  out.globalCount = DATA.global.length;
  return JSON.stringify(out);
})()`;
let got;
try { got = JSON.parse(vm.runInContext(mode === "law" ? askLaw : askHolidays, ctx, { timeout: 600000 })); }
catch (e) { console.error(`law_atlas: the page's functions could not be run: ${e.message}`); process.exit(2); }
got.marks = marks.map((r) => ({ ll: r.ll, k: r.k || null, pane: r.o.pane || null, fill: r.o.fillColor || null, radius: r.o.radius || null, popup: r.popup, popupOpts: r.popupOpts, tooltip: r.tooltip }));
got.mode = mode;
const meth = html.match(/<div class="overlay" id="meth"[\s\S]*?<div class="gbody">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
got.method = meth ? meth[1] : "";
const title = html.match(/<title>([^<]*)<\/title>/i);
got.title = title ? title[1].trim() : "";
// The words the page itself writes around its map (the holidays map's #desc,
// #hint and #foot), for the window that lists its entries.
for (const id of ["desc", "hint", "foot"]) {
  const m = html.match(new RegExp(`<(p|div)[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1>`));
  if (m) got[id] = m[2].trim();
}
const css = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
got.css = css ? css[1] : "";
got.fonts = [...html.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
got.notes = notes;
process.stdout.write(JSON.stringify(got));
