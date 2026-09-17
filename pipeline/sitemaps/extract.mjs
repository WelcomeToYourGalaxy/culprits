// Read the places out of one of the site's Leaflet maps, by running the map's
// own scripts against a stand-in Leaflet that records what they draw.
//
// Why run the scripts rather than parse them: the maps were written one at a
// time and keep their data in forty different shapes — arrays of objects,
// arrays of arrays, GeoJSON, markers built in loops, data fetched from a file
// beside the page. What they all share is that every place ends up passed to
// L.marker, L.circleMarker, L.circle, L.polygon or L.geoJSON, with its popup
// passed to bindPopup. So those calls are what is recorded, and the popup is
// kept whole: it is what the map itself tells a reader about the place.
//
// Usage:
//   node extract.mjs '<spec as JSON>'          prints { features, notes } as JSON
// spec:
//   url      page to read (https), or
//   file     a local copy of the page, for testing
//   base     where relative files resolve (defaults to url)
//   block    text that picks one custom-HTML block out of a Weebly page
//   decode   "base64-iframe" | "base64-script" when the map sits inside the
//            block as an encoded document
//
// Nothing here is specific to one map. A map that draws without Leaflet (a
// chart, a canvas, D3) records nothing, and the output says so.
//
// Besides the places, the output carries what is needed to show each place the
// way its own map shows it: the popup HTML as the map wrote it, the options it
// was opened with, the marker's own size and colour, which named overlay (from
// L.control.layers) it belongs to, every stylesheet the page carries — written
// in the page or added by its scripts — and the page itself with its scripts
// emptied, so the elements around the map can be found.

import fs from "node:fs";
import vm from "node:vm";

const spec = JSON.parse(process.argv[2] || "{}");
const notes = [];

// A map's own code failing later — a timed-out fetch, a promise nobody caught —
// must not take the reading down with it. Recorded, and the places kept.
process.on("unhandledRejection", (e) => notes.push(`the map's code failed later (${String(e && e.message || e).slice(0, 120)})`));
process.on("uncaughtException", (e) => notes.push(`the map's code failed later (${String(e && e.message || e).slice(0, 120)})`));

// ---------------------------------------------------------------------------
// The page, the block, the document inside it
// ---------------------------------------------------------------------------

async function getText(u) {
  const r = await fetch(u, { headers: { "User-Agent": "welcometoyourgalaxy-atlas/1.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
  return r.text();
}

function pickBlock(html, marker) {
  const starts = [];
  const re = /class="wcustomhtml"/g;
  let m;
  while ((m = re.exec(html))) starts.push(m.index);
  starts.push(html.length);
  const hits = [];
  for (let i = 0; i < starts.length - 1; i++) {
    const b = html.slice(starts[i], starts[i + 1]);
    if (b.includes(marker)) hits.push(b);
  }
  if (!hits.length) throw new Error(`no custom-HTML block contains ${JSON.stringify(marker)}`);
  if (hits.length > 1) notes.push(`${hits.length} blocks contain the marker; reading the first`);
  return hits[0];
}

function decodeDoc(block, mode) {
  if (mode === "base64-iframe") {
    const m = block.match(/data:text\/html[^,]*;base64,([A-Za-z0-9+/=]+)/);
    if (!m) throw new Error("no base64 document in the block");
    return Buffer.from(m[1], "base64").toString("utf8");
  }
  if (!mode) {
    // A map pasted as an iframe's srcdoc, or kept in a text/html script island
    // that the block's own script writes into an iframe.
    const island = block.match(/<script[^>]*type\s*=\s*["']text\/html["'][^>]*>([\s\S]*?)<\/script>/i);
    if (/\ssrcdoc\s*=\s*["']/.test(block)) mode = "srcdoc";
    else if (island && /L\.map\(/.test(island[1])) return island[1];
  }
  if (mode === "srcdoc") {
    let m = block.match(/\ssrcdoc\s*=\s*"([^"]*)"/);
    if (!m) {
      // single-quoted: the value runs to the quote that closes the attribute,
      // not to the first apostrophe inside the page
      const at = block.search(/\ssrcdoc\s*=\s*'/);
      if (at >= 0) {
        const start = block.indexOf("'", at) + 1;
        const tail = block.slice(start);
        const end = tail.search(/'(?=\s*(?:[\w-]+\s*=|\/?>))/);
        m = [null, end >= 0 ? tail.slice(0, end) : tail];
      }
    }
    if (!m) throw new Error("no srcdoc document in the block");
    let doc = decodeEntities(m[1]);
    // A copy saved with its line breaks written out as the two characters "\n"
    // runs every line comment to the end of the script. Restore them.
    if (!doc.includes("\n") && doc.includes("\\n")) doc = doc.replace(/\\n/g, "\n");
    return doc;
  }
  if (mode === "base64-script") {
    const cands = [...block.matchAll(/["']([A-Za-z0-9+/=]{2000,})["']/g)].map((x) => x[1]);
    for (const c of cands) {
      const t = Buffer.from(c, "base64").toString("utf8");
      if (/<html|<script/i.test(t)) return t;
    }
    throw new Error("no base64 document in the block's scripts");
  }
  return block;
}

function decodeEntities(s) { return s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (all, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[e.toLowerCase()];
}); }

function textOf(html) {
  return decodeEntities(String(html == null ? "" : html)
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

// ---------------------------------------------------------------------------
// A document that absorbs anything, and a Leaflet that records
// ---------------------------------------------------------------------------

const listeners = [];     // [type, fn] from window/document addEventListener
const dynamicCss = [];    // stylesheets the page's scripts write at run time

// A string a script hands the page that carries a stylesheet: kept.
function catchCss(v) {
  if (typeof v !== "string" || !/<style/i.test(v)) return;
  for (const m of v.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) dynamicCss.push(m[1]);
}
const observed = [];      // IntersectionObserver callbacks, fired once as visible

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
      if (k === "addEventListener") return (type, cb) => { if (typeof cb === "function") listeners.push([type, cb]); };
      if (k === "querySelectorAll" || k === "getElementsByClassName" || k === "getElementsByTagName") return () => [];
      if (k === "classList") return { add() {}, remove() {}, toggle() {}, contains: () => false };
      if (k === "style") { const o = { setProperty() {}, removeProperty() {}, getPropertyValue: () => "" }; store.set(k, o); return o; }
      if (k === "dataset") { const o = {}; store.set(k, o); return o; }
      if (k === "fonts") return { ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true };
      if (k === "getBoundingClientRect") return () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 });
      if (k === "offsetWidth" || k === "clientWidth") return 800;
      if (k === "offsetHeight" || k === "clientHeight") return 600;
      if (k === "value" || k === "innerHTML" || k === "textContent" || k === "innerText") return "";
      if (k === "checked") return true;
      return absorb(label + "." + String(k));
    },
    set(t, k, v) {
      store.set(k, v);
      if (label === "style-element" && (k === "textContent" || k === "innerHTML" || k === "innerText") && typeof v === "string") dynamicCss.push(v);
      else catchCss(v);
      return true;
    },
    apply(t, self, args) {
      for (const a of args || []) catchCss(a);
      if (/\.createElement$/.test(label) && String(args && args[0]).toLowerCase() === "style") return absorb("style-element");
      return absorb(label + "()");
    },
    construct() { return absorb("new " + label); },
    has() { return true; },
  });
}

const records = [];
let mapContainer = null;  // the element L.map was built on, by id or selector

function toLatLng(a, b) {
  if (typeof a === "number" && typeof b === "number") return [a, b];
  if (Array.isArray(a) && typeof a[0] === "number") return [a[0], a[1]];
  if (a && typeof a === "object") {
    const lat = a.lat ?? a.latitude;
    const lng = a.lng ?? a.lon ?? a.long ?? a.longitude;
    if (typeof lat === "number" && typeof lng === "number") return [lat, lng];
  }
  return null;
}

function content(c, layer) {
  if (typeof c === "function") { try { return content(c(layer), layer); } catch (e) { return ""; } }
  if (c == null) return "";
  if (typeof c === "string") return c;
  if (typeof c === "object" && typeof c.outerHTML === "string") return c.outerHTML;
  return String(c);
}

function layerObject(rec) {
  let px;
  const self = {
    _rec: rec,
    options: rec.options || {},
    feature: rec.props ? { properties: rec.props } : undefined,
    bindPopup(c, o) { rec.popup = content(c, px); rec.popupOptions = pickPopupOptions(o); return px; },
    bindTooltip(c, o) { rec.tooltip = content(c, px); rec.tooltipOptions = pickPopupOptions(o); return px; },
    addTo(target) { if (target && typeof target.__gid === "number") rec.group = target.__gid; return px; },
    setIcon(icon) { rec.options = Object.assign({}, rec.options, { icon }); return px; },
    setPopupContent(c) { rec.popup = content(c, px); return px; },
    setTooltipContent(c) { rec.tooltip = content(c, px); return px; },
    getLatLng() { return rec.lat != null ? { lat: rec.lat, lng: rec.lon } : { lat: 0, lng: 0 }; },
    setStyle(s) { if (s && s.fillColor) rec.color = s.fillColor; else if (s && s.color) rec.color = s.color; return px; },
    getBounds() { return absorb("bounds"); },
    getPopup() { return { getContent: () => rec.popup, setContent: (c) => { rec.popup = content(c, self); } }; },
    getRadius() { return (rec.options || {}).radius || 5; },
  };
  px = new Proxy(self, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "then") return undefined;
      return () => px;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return px;
}

function pickPopupOptions(o) {
  if (!o || typeof o !== "object") return null;
  const out = {};
  for (const k of ["maxWidth", "minWidth", "maxHeight", "className"]) if (o[k] != null && typeof o[k] !== "object") out[k] = o[k];
  return Object.keys(out).length ? out : null;
}

// The marker as its map draws it: circle size and colours, or its icon.
function markerStyle(o) {
  o = o || {};
  const out = {};
  for (const k of ["radius", "fillColor", "color", "weight", "opacity", "fillOpacity", "dashArray"]) if (o[k] != null && typeof o[k] !== "object") out[k] = o[k];
  if (o.__metres) out.metres = true;
  const ic = o.icon;
  if (ic && ic.__icon) {
    out.icon = { kind: ic.__icon };
    for (const k of ["html", "className", "iconUrl", "iconSize"]) if (ic[k] != null) out.icon[k] = typeof ic[k] === "object" && !Array.isArray(ic[k]) ? content(ic[k]) : ic[k];
  }
  return Object.keys(out).length ? out : null;
}

function record(kind, latlngs, options) {
  const rec = { kind, options: options || {} };
  if (kind === "point") { rec.lat = latlngs[0]; rec.lon = latlngs[1]; }
  rec.color = (options && (options.fillColor || options.color)) || null;
  records.push(rec);
  return layerObject(rec);
}

let groupCount = 0;
const overlays = [];      // [{ name, group }] in the order the map's layer control lists them

function joinGroup(layer, gid) {
  if (Array.isArray(layer)) { layer.forEach((l) => joinGroup(l, gid)); return; }
  try { if (layer && layer._rec && layer._rec.group == null) layer._rec.group = gid; } catch (e) { /* not a recorded layer */ }
}

function group() {
  const gid = groupCount++;
  const g = {
    __gid: gid,
    addLayer(l) { joinGroup(l, gid); return g; }, removeLayer() { return g; }, clearLayers() { return g; }, addTo() { return g; },
    eachLayer() { return g; }, getLayers() { return []; }, getBounds() { return absorb("bounds"); },
    on() { return g; }, off() { return g; }, remove() { return g; }, addLayers() { return g; },
    setStyle() { return g; }, bringToFront() { return g; }, hasLayer() { return false; },
    refreshClusters() { return g; },
  };
  g.addLayers = (ls) => { joinGroup(ls, gid); return g; };
  return new Proxy(g, { get(t, k) { if (k in t) return t[k]; if (k === "then") return undefined; return () => g; } });
}

function geoJSONLayer(data, opts) {
  opts = opts || {};
  const gl = group();
  const add = (d) => {
    if (!d) return gl;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { return gl; } }
    const feats = d.type === "FeatureCollection" ? d.features : d.type === "Feature" ? [d] : Array.isArray(d) ? d : [];
    for (const f of feats || []) {
      if (!f || !f.geometry) continue;
      if (opts.filter && !opts.filter(f)) continue;
      const g = f.geometry;
      let lyr;
      if (g.type === "Point") {
        const ll = { lat: g.coordinates[1], lng: g.coordinates[0] };
        const before = records.length;
        if (opts.pointToLayer) { try { lyr = opts.pointToLayer(f, ll); } catch (e) { lyr = null; } }
        if (!lyr || records.length === before) lyr = record("point", [ll.lat, ll.lng]);
        const rec = lyr._rec || records[records.length - 1];
        rec.props = f.properties || {};
        if (rec.group == null) rec.group = gl.__gid;
      } else {
        const kind = /Polygon/.test(g.type) ? "polygon" : /LineString/.test(g.type) ? "line" : "other";
        const rec = { kind, props: f.properties || {}, geometry: g, options: {}, group: gl.__gid };
        records.push(rec);
        lyr = layerObject(rec);
        if (typeof opts.style === "function") { try { lyr.setStyle(opts.style(f)); } catch (e) { /* style needs the page */ } }
      }
      if (opts.onEachFeature) { try { opts.onEachFeature(f, lyr); } catch (e) { /* handler needs the page */ } }
    }
    return gl;
  };
  gl.addData = add;
  add(data);
  return gl;
}

const L = new Proxy({
  version: "1.9.4",
  map: (el) => {
    const id = typeof el === "string" ? el : el && [el.__wtygId, el.__wtygSel].find((v) => typeof v === "string");
    if (id) mapContainer = id;
    return absorb("map");
  },
  divIcon: (o) => Object.assign({ __icon: "div" }, o || {}),
  icon: (o) => Object.assign({ __icon: "img" }, o || {}),
  control: new Proxy(function () { return absorb("control"); }, {
    get(t, k) {
      if (k === "layers") return (base, over) => {
        for (const [name, lyr] of Object.entries(over || {})) if (lyr && typeof lyr.__gid === "number") overlays.push({ name, group: lyr.__gid });
        const c = new Proxy({}, { get(tt, kk) {
          if (kk === "addOverlay") return (lyr, name) => { if (lyr && typeof lyr.__gid === "number") overlays.push({ name, group: lyr.__gid }); return c; };
          if (kk === "then") return undefined;
          return () => c;
        } });
        return c;
      };
      if (k === "then") return undefined;
      return absorb("L.control." + String(k));
    },
  }),
  marker: (ll, o) => { const p = toLatLng(ll); return p ? record("point", p, o) : absorb("marker"); },
  circleMarker: (ll, o) => { const p = toLatLng(ll); return p ? record("point", p, o) : absorb("marker"); },
  // L.circle's radius is in metres, not pixels; marked so it is not read as a dot size.
  circle: (ll, o) => { const p = toLatLng(ll); return p ? record("point", p, Object.assign({}, o, { __metres: true })) : absorb("marker"); },
  polygon: (lls, o) => { const r = record("polygon", null, o); r._rec.geometry = { type: "Polygon", coordinates: lls, _leaflet: true }; return r; },
  polyline: (lls, o) => { const r = record("line", null, o); r._rec.geometry = { type: "LineString", coordinates: lls, _leaflet: true }; return r; },
  rectangle: (b, o) => { const r = record("polygon", null, o); r._rec.geometry = { type: "Rectangle", coordinates: b, _leaflet: true }; return r; },
  geoJSON: geoJSONLayer, geoJson: geoJSONLayer,
  layerGroup: group, featureGroup: group, markerClusterGroup: group,
  latLng: (a, b) => { const p = toLatLng(a, b); return p ? { lat: p[0], lng: p[1] } : absorb("latLng"); },
}, {
  get(t, k) { if (k in t) return t[k]; if (k === "then") return undefined; return absorb("L." + String(k)); },
});

// ---------------------------------------------------------------------------
// Running the scripts
// ---------------------------------------------------------------------------

async function main() {
  let html = spec.file ? fs.readFileSync(spec.file, "utf8") : await getText(spec.url);
  if (spec.block) html = pickBlock(html, spec.block);
  html = decodeDoc(html, spec.decode);
  const base = spec.base || spec.url || "https://example.invalid/";

  const scripts = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    const src = (attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (/type\s*=\s*["'](?!text\/javascript|module|application\/javascript)[^"']+["']/i.test(attrs) && !src) {
      // a JSON data island: expose it to getElementById(...).textContent
      const id = (attrs.match(/\bid\s*=\s*["']([^"']+)["']/i) || [])[1];
      if (id) scripts.push({ island: id, text: m[2] });
      continue;
    }
    if (src) {
      // Libraries are the stand-ins above; only the page's own files are read.
      if (/leaflet|markercluster|chart|d3|topojson|jquery|turf|papaparse|unpkg|cdnjs|jsdelivr|googleapis|gdpr|weebly|editmysite/i.test(src)) continue;
      try { scripts.push({ code: await getText(new URL(src, base).href), name: src }); }
      catch (e) { notes.push(`could not read script ${src}: ${e.message}`); }
    } else if (m[2].trim()) {
      scripts.push({ code: m[2], name: "inline" });
    }
  }

  const islands = Object.fromEntries(scripts.filter((s) => s.island).map((s) => [s.island, s.text]));
  const document = absorb("document");
  const elementById = (id) => {
    const el = absorb("#" + id);
    el.__wtygId = id;
    if (islands[id] != null) { el.textContent = islands[id]; el.innerHTML = islands[id]; }
    return el;
  };
  const docProxy = new Proxy(document, {
    get(t, k) {
      if (k === "getElementById") return elementById;
      if (k === "querySelector") return (sel) => {
        if (/^#[\w-]+$/.test(sel)) return elementById(sel.slice(1));
        const el = absorb(sel); el.__wtygSel = sel; return el;
      };
      if (k === "readyState") return "loading";
      return t[k];
    },
  });

  const realFetch = (u, o) => {
    const href = new URL(String(u), base).href;
    return fetch(href, o).then((r) => {
      if (!r.ok) notes.push(`the map asked for ${href} and got HTTP ${r.status}`);
      return r;
    }, (e) => { notes.push(`the map asked for ${href}: ${e.message}`); throw e; });
  };

  const sandbox = {
    L, document: docProxy, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    fetch: spec.file && !spec.base ? () => Promise.reject(new Error("offline")) : realFetch,
    setTimeout: (f, ms) => setTimeout(() => { try { f(); } catch (e) { /* page code */ } }, Math.min(ms || 0, 50)),
    clearTimeout, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: (f) => setTimeout(() => { try { f(0); } catch (e) { /* page code */ } }, 0),
    cancelAnimationFrame: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: { userAgent: "node", language: "en" },
    location: new URL(base),
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => "", setProperty() {} }),
    IntersectionObserver: class { constructor(cb) { this.cb = cb; } observe(el) { observed.push([this.cb, el, this]); } unobserve() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} unobserve() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    Chart: absorb("Chart"), d3: absorb("d3"), topojson: absorb("topojson"), $: absorb("$"), jQuery: absorb("jQuery"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    TextDecoder, TextEncoder, URL, URLSearchParams, Blob, Image: class {}, Uint8Array, ArrayBuffer,
    DecompressionStream: globalThis.DecompressionStream, Response,
    alert() {}, confirm: () => true, prompt: () => "",
    addEventListener: (type, cb) => { if (typeof cb === "function") listeners.push([type, cb]); },
    removeEventListener() {}, dispatchEvent() {}, scrollTo() {},
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    performance: { now: () => Date.now() }, structuredClone,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  let ran = 0;
  for (const s of scripts.filter((x) => x.code)) {
    try { vm.runInContext(s.code, ctx, { timeout: 20000, filename: s.name }); ran++; }
    catch (e) { notes.push(`a script stopped early (${String(e.message).slice(0, 120)}); places recorded before that point are kept`); }
  }
  for (const [type, cb] of listeners.splice(0)) {
    if (/^(DOMContentLoaded|load|readystatechange)$/.test(type)) { try { cb({ type }); } catch (e) { notes.push(`${type} handler stopped early (${String(e.message).slice(0, 100)})`); } }
  }
  for (const [cb, el, obs] of observed.splice(0)) { try { cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], obs); } catch (e) { /* page code */ } }
  await new Promise((r) => setTimeout(r, spec.wait || 2500));

  // One record per place. A map that rebuilds its markers when a filter changes
  // draws the same place twice; the popup and position together identify it.
  const seen = new Set();
  const features = [];
  const counts = { point: 0, polygon: 0, line: 0, other: 0, duplicate: 0 };
  for (const r of records) {
    const popup = r.popup || "";
    const key = r.kind + "|" + (r.kind === "point" ? r.lat.toFixed(6) + "," + r.lon.toFixed(6) : JSON.stringify(r.geometry || "").slice(0, 400)) + "|" + popup + "|" + (r.tooltip || "");
    if (seen.has(key)) { counts.duplicate++; continue; }
    seen.add(key);
    counts[r.kind] = (counts[r.kind] || 0) + 1;
    features.push({
      kind: r.kind, lat: r.lat ?? null, lon: r.lon ?? null, geometry: r.kind === "point" ? null : r.geometry || null,
      popup: popup, popup_text: textOf(popup), tooltip: textOf(r.tooltip || ""), color: r.color, props: r.props || null,
      popup_options: r.popupOptions || null, tooltip_html: r.tooltip || "", tooltip_options: r.tooltipOptions || null,
      style: markerStyle(r.options), group: r.group ?? null,
    });
  }
  if (!features.length) notes.push(ran ? "the scripts ran but drew nothing through Leaflet" : "no scripts ran");
  const staticCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const stylesheets = [...html.matchAll(/<link\b[^>]*rel\s*=\s*["']?stylesheet[^>]*>/gi)]
    .map((m) => (m[0].match(/href\s*=\s*["']([^"']+)["']/i) || [])[1]).filter(Boolean)
    .filter((h) => !/leaflet|markercluster/i.test(h)).map((h) => { try { return new URL(h, base).href; } catch (e) { return h; } });
  const page = html.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, "$1$2").replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi, "$1$2");
  const out = JSON.stringify({
    features, counts, notes,
    css: staticCss.concat(dynamicCss), stylesheets, map_container: mapContainer,
    overlays, page: page.length < 4e6 ? page : page.slice(0, 4e6),
    // Headings written as plain text anywhere in the page, scripts included: a
    // map that builds its header in JavaScript still names itself there.
    headings: [...html.matchAll(/<h([1-3])\b[^>]*>([^<]{2,160})<\/h\1>/gi)]
      .filter((m) => !/\$\{|['"`]\s*\+|\+\s*['"`]/.test(m[2])).map((m) => ({ level: Number(m[1]), text: decodeEntities(m[2]).trim() })),
  });
  if (spec.out) { fs.writeFileSync(spec.out, out); process.exit(0); }
  process.stdout.write(out, () => process.exit(0));
}

main().catch((e) => {
  const out = JSON.stringify({ features: [], counts: {}, notes: [String(e.message)] });
  if (spec.out) { fs.writeFileSync(spec.out, out); process.exit(0); }
  process.stdout.write(out, () => process.exit(0));
});
