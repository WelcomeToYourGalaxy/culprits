#!/usr/bin/env python3
"""
Geometric markers instead of round bubbles; the zoom-8 note removed; a drag bar
on the page panels; each upcoming launch linked to its own pages; Off-planet as
To Earth / From Earth; Of groups in Destruction with its beings; Fur Farms
(Final Nail); Pet Food Companies under The Pet Industry; headings in title case.
Run from the culprits folder, after git pull:

    python3 patch_0923.py

then:  node map/test.mjs
"""
import pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
app_path = ROOT / "map" / "app.js"
if not app_path.exists():
    sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits). Nothing was written.")
app = app_path.read_text(encoding="utf-8")
if "function addHud(" in app:
    sys.exit("Already applied - nothing to do.")
if "function pinBuildings" not in app:
    sys.exit("Run git pull first. Nothing was written.")
DIFF = r'''diff --git a/map/app.js b/map/app.js
index 2580345..d25ce95 100644
--- a/map/app.js
+++ b/map/app.js
@@ -1028,11 +1028,226 @@ function layersOfRow(id) {
   const st = map.getStyle && map.getStyle();
   return ((st && st.layers) || []).map((l) => l.id).filter((l) => l === id || l.startsWith(id + "-"));
 }
+/* ---------- markers: geometric HUD symbols instead of round bubbles ---------- */
+// Every point layer's places are drawn as a small geometric symbol: a thin
+// outline around a solid core, with a soft glow. The symbol's shape and glow
+// say which part of the map the layer belongs to (below); its fill keeps the
+// layer's own colours, so kinds, facets and colour keys still read as before.
+// A place the source gives only as an area (drawn hollow before) is the
+// outline alone. The round layer stays underneath, unseen, so clicking, boxes,
+// filters and the layer tools work exactly as they did; everything done to it
+// (shown, hidden, filtered, recoloured, resized, moved, removed) is done to
+// its symbol too. (A breathing glow on every marker was tried and dropped: it
+// kept the whole map redrawing ten times a second.)
+const HUD = {
+  // Glow colours. Amber and cyan are as asked for these markers.
+  cyan: "#43D9E0", amber: "#E7A63B", red: "#C8323C", white: "#EEF3F2",
+  R: 11,                     // a circle of this radius is a symbol at size 1
+};
+const HUD_KIND = {
+  // [top section, heading under it] -> [shape, glow]; "*" is any heading.
+  "On-planet invasion|*": ["chevron", "cyan"],
+  "Destruction|Climate": ["hexagon", "amber"],
+  "Destruction|Toxic pollution": ["triangle", "red"],
+  "Destruction|Plastics": ["square", "white"],
+  "Destruction|Deforestation": ["diamond", "red"],
+  "Destruction|Biodiversity loss": ["diamond", "red"],
+  "Destruction|Mining": ["cross", "amber"],
+  "Destruction|Agriculture": ["hexagon", "red"],
+  "Destruction|Oceans": ["reticle", "cyan"],
+  "Destruction|Construction": ["square", "amber"],
+  "Destruction|Culprits upstream": ["diamond", "amber"],
+  "Destruction|*": ["triangle", "red"],
+  "Suppression|*": ["square", "white"],
+  "Off-planet invasion|*": ["reticle", "cyan"],
+  "Buildings|*": ["square", "white"],
+  "*": ["diamond", "white"],
+};
+let hudPlaces = null;
+function hudPlace(layerId) {
+  if (!hudPlaces) {
+    hudPlaces = new Map();
+    let h1 = "", h3 = "";
+    for (const x of (typeof PANEL_ORDER !== "undefined" ? PANEL_ORDER : [])) {
+      if (x && typeof x === "object") { if (x.h === 1) { h1 = x.t; h3 = ""; } else if (x.h === 3) h3 = x.t; else if (x.h === 2) h3 = ""; continue; }
+      const id = String(x).replace(/^group:/, "");
+      hudPlaces.set(id, [h1, h3]);
+      const g = typeof GROUPS !== "undefined" && GROUPS.find((gg) => gg.id === id);
+      if (g) g.children.forEach((c) => hudPlaces.set(c.id, [h1, h3]));
+    }
+  }
+  let best = null;
+  for (const id of hudPlaces.keys()) if ((layerId === id || layerId.startsWith(id + "-")) && (!best || id.length > best.length)) best = id;
+  const [h1, h3] = best ? hudPlaces.get(best) : ["", ""];
+  return HUD_KIND[`${h1}|${h3}`] || HUD_KIND[`${h1}|*`] || HUD_KIND["*"];
+}
+// The symbols, drawn once as signed-distance images, so each takes any colour
+// and a glow of any width.
+const HUD_SHAPES = ["hexagon", "triangle", "square", "diamond", "cross", "chevron", "reticle"];
+function hudPolygon(shape, c, r) {
+  const pts = (n, rot) => [...Array(n).keys()].map((i) => [c + r * Math.cos(rot + i * 2 * Math.PI / n), c + r * Math.sin(rot + i * 2 * Math.PI / n)]);
+  if (shape === "hexagon") return pts(6, Math.PI / 6);
+  if (shape === "triangle") return pts(3, -Math.PI / 2).map(([x, y]) => [x, y + r * 0.18]);
+  if (shape === "square") return pts(4, Math.PI / 4).map(([x, y]) => [c + (x - c) * 0.9, c + (y - c) * 0.9]);
+  if (shape === "diamond") return pts(4, 0).map(([x, y]) => [c + (x - c) * 0.8, y]);
+  if (shape === "chevron") return [[c, c - r], [c + r * 0.85, c + r * 0.75], [c, c + r * 0.25], [c - r * 0.85, c + r * 0.75]];
+  if (shape === "cross") { const a = r * 0.36; return [[c - a, c - r], [c + a, c - r], [c + a, c - a], [c + r, c - a], [c + r, c + a], [c + a, c + a], [c + a, c + r], [c - a, c + r], [c - a, c + a], [c - r, c + a], [c - r, c - a], [c - a, c - a]]; }
+  return null;
+}
+function hudInside(poly, x, y) {
+  let inside = false;
+  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
+    const [xi, yi] = poly[i], [xj, yj] = poly[j];
+    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
+  }
+  return inside;
+}
+function hudMask(shape, hollow, S) {
+  const c = S / 2, r = S * 0.34, m = new Uint8Array(S * S);
+  const poly = hudPolygon(shape, c, r);
+  const inner = poly && poly.map(([x, y]) => [c + (x - c) * 0.72, c + (y - c) * 0.72]);
+  const core = poly && poly.map(([x, y]) => [c + (x - c) * 0.42, c + (y - c) * 0.42]);
+  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
+    const px = x + 0.5, py = y + 0.5;
+    let on;
+    if (shape === "reticle") {
+      const d = Math.hypot(px - c, py - c);
+      const ring = d > r * 0.72 && d < r;
+      const ticks = (Math.abs(px - c) < r * 0.09 || Math.abs(py - c) < r * 0.09) && d > r * 0.95 && d < r * 1.3;
+      on = ring || ticks || (!hollow && d < r * 0.38);
+    } else {
+      const outline = hudInside(poly, px, py) && !hudInside(inner, px, py);
+      on = outline || (!hollow && hudInside(core, px, py));
+    }
+    m[y * S + x] = on ? 1 : 0;
+  }
+  return m;
+}
+function hudSdf(mask, S) {
+  // Distance to the nearest pixel of the other kind, signed: + inside.
+  const edge = [];
+  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
+    const v = mask[y * S + x];
+    if ((x > 0 && mask[y * S + x - 1] !== v) || (y > 0 && mask[(y - 1) * S + x] !== v)) edge.push([x, y]);
+  }
+  const data = new Uint8ClampedArray(S * S * 4);
+  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
+    let d = 1e9;
+    for (const [ex, ey] of edge) { const dd = (ex - x) * (ex - x) + (ey - y) * (ey - y); if (dd < d) d = dd; }
+    d = Math.sqrt(d) * (mask[y * S + x] ? 1 : -1);
+    const i = (y * S + x) * 4;
+    data[i] = data[i + 1] = data[i + 2] = 255;
+    data[i + 3] = Math.max(0, Math.min(255, Math.round((0.75 + d / 8) * 255)));
+  }
+  return data;
+}
+function hudImages() {
+  if (typeof map.hasImage !== "function" || map.hasImage("hud-diamond")) return;
+  const S = 48;
+  for (const shape of HUD_SHAPES) for (const hollow of [false, true]) {
+    const id = `hud-${shape}${hollow ? "-hollow" : ""}`;
+    if (!map.hasImage(id)) map.addImage(id, { width: S, height: S, data: hudSdf(hudMask(shape, hollow, S), S) }, { sdf: true, pixelRatio: 2 });
+  }
+}
+const hudOf = new Map();       // circle layer id -> its symbol layer id
+function hudEligible(layer) {
+  if (!layer || layer.type !== "circle" || !layer.id || /^(wire-|ct-)/.test(layer.id) || /-(halo|hud)$/.test(layer.id)) return false;
+  const c = JSON.stringify((layer.paint || {})["circle-color"] || "");
+  return !/rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(c);
+}
+function hudSize(radius) {
+  return mapOutputs(radius === undefined ? 5 : radius, (n) => Math.max(0.3, n / HUD.R * 1.05));
+}
+function addHud(layer, rawAddLayer) {
+  hudImages();
+  const [shape, glow] = hudPlace(layer.id);
+  const p = layer.paint || {};
+  const op = p["circle-opacity"];
+  // A place drawn hollow (opacity 0 by a rule on its data) is the outline alone.
+  const hollowRule = Array.isArray(op) && !hasZoom(op) ? ["<", op, 0.2] : null;
+  const hid = `${layer.id}-hud`;
+  const spec = {
+    id: hid, type: "symbol", source: layer.source,
+    layout: {
+      "icon-image": hollowRule ? ["case", hollowRule, `hud-${shape}-hollow`, `hud-${shape}`] : `hud-${shape}`,
+      "icon-size": hudSize(p["circle-radius"]),
+      "icon-allow-overlap": true, "icon-ignore-placement": true,
+      visibility: (layer.layout && layer.layout.visibility) || "visible",
+    },
+    paint: {
+      "icon-color": p["circle-color"] === undefined ? "#EEF3F2" : p["circle-color"],
+      "icon-opacity": hollowRule || op === undefined ? 1 : op,
+      "icon-halo-color": HUD[glow], "icon-halo-width": 0.7, "icon-halo-blur": 1.1,
+    },
+  };
+  if (layer["source-layer"]) spec["source-layer"] = layer["source-layer"];
+  if (layer.filter) spec.filter = layer.filter;
+  if (layer.minzoom != null) spec.minzoom = layer.minzoom;
+  if (layer.maxzoom != null) spec.maxzoom = layer.maxzoom;
+  try {
+    rawAddLayer(spec, hudNext(layer.id));
+    // The round layer stays for clicks and boxes, unseen.
+    const paint = hudRaw.setPaintProperty || map.setPaintProperty.bind(map);
+    paint(layer.id, "circle-opacity", 0);
+    paint(layer.id, "circle-stroke-opacity", 0);
+    hudOf.set(layer.id, hid);
+  } catch (e) { /* this layer keeps its round markers */ }
+}
+function hudNext(layerId) {
+  const ls = (map.getStyle().layers || []).map((l) => l.id);
+  const i = ls.indexOf(layerId);
+  return i >= 0 && i + 1 < ls.length ? ls[i + 1] : undefined;
+}
+// Everything done to a round layer is done to its symbol.
+const hudRaw = {};
+function hudWrap(name, make) {
+  if (typeof map[name] !== "function") return;
+  hudRaw[name] = map[name].bind(map);
+  map[name] = make(hudRaw[name]);
+}
+hudWrap("setLayoutProperty", (raw) => function (id, prop, v, o) {
+  const out = raw(id, prop, v, o);
+  const h = hudOf.get(id);
+  if (h && prop === "visibility" && map.getLayer(h)) raw(h, prop, v, o);
+  return out;
+});
+hudWrap("setFilter", (raw) => function (id, f, o) {
+  const out = raw(id, f, o);
+  const h = hudOf.get(id);
+  if (h && map.getLayer(h)) raw(h, f, o);
+  return out;
+});
+hudWrap("setPaintProperty", (raw) => function (id, prop, v, o) {
+  const h = hudOf.get(id);
+  // The round layer's own opacity stays at nothing; its symbol has its own
+  // (the transparency slider sets that one directly).
+  if (h && (prop === "circle-opacity" || prop === "circle-stroke-opacity")) return map;
+  const out = raw(id, prop, v, o);
+  if (h && map.getLayer(h)) {
+    try {
+      if (prop === "circle-color") raw(h, "icon-color", v, o);
+      if (prop === "circle-radius" && hudRaw.setLayoutProperty) hudRaw.setLayoutProperty(h, "icon-size", hudSize(v), o);
+    } catch (e) { /* kept */ }
+  }
+  return out;
+});
+hudWrap("moveLayer", (raw) => function (id, before) {
+  const out = raw(id, before);
+  const h = hudOf.get(id);
+  if (h && map.getLayer(h)) raw(h, before);
+  return out;
+});
+hudWrap("removeLayer", (raw) => function (id) {
+  const h = hudOf.get(id);
+  if (h && map.getLayer(h)) { raw(h); hudOf.delete(id); }
+  return raw(id);
+});
 if (typeof map.addLayer === "function") {
   const rawAddLayer = map.addLayer.bind(map);
   map.addLayer = function (layer, before) {
     try { legibleCircle(layer); } catch (e) { /* drawn as given */ }
     const out = rawAddLayer(layer, before);
+    try { if (hudEligible(layer)) addHud(layer, rawAddLayer); } catch (e) { /* round markers stay */ }
     const row = layer && layer.id && rowOfLayer(layer.id);
     if (row && opacityFactor.get(row) < 0.999) applyOpacity(layer.id, opacityFactor.get(row));
     return out;
@@ -3513,6 +3728,18 @@ async function ll2All(path) {
   }
   return out;
 }
+// A launch's own pages: The Space Devs' page for it (Space Launch Now, their
+// public site for this record), then every page and webcast the record lists.
+function ll2Links(r) {
+  const a = (u, t) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`;
+  const out = [];
+  if (r.slug) out.push(a(`https://spacelaunchnow.me/launch/${encodeURIComponent(r.slug)}`, "This launch's page \u2197"));
+  for (const u of r.info_urls || []) if (u && u.url) out.push(a(u.url, (u.title || u.source || "More") + " \u2197"));
+  for (const u of r.vid_urls || []) if (u && u.url) out.push(a(u.url, (u.title ? "Webcast: " + u.title : "Webcast") + " \u2197"));
+  if (r.flightclub_url) out.push(a(r.flightclub_url, "Flight Club trajectory \u2197"));
+  if (r.url) out.push(a(r.url, "Launch Library 2 record \u2197"));
+  return out.length ? `<p style="display:flex;flex-direction:column;gap:3px">${out.join("")}</p>` : "";
+}
 function ll2Img(x) { return x && (typeof x === "string" ? x : x.image_url || x.thumbnail_url) || ""; }
 function ll2Pad(p, extra) {
   const lat = Number(p.latitude), lng = Number(p.longitude);
@@ -3557,6 +3784,7 @@ async function readLaunchLibrary(cfg) {
           `<div>${escapeHtml([rocket, lsp].filter(Boolean).join(" \u00b7 "))}</div>` +
           `<div>${escapeHtml(pad.name || "")}${pad.location ? ", " + escapeHtml(pad.location.name || "") : ""}</div>` +
           (m.name ? `<p><b>${escapeHtml(m.name)}</b>${m.orbit && m.orbit.name ? " \u2192 " + escapeHtml(m.orbit.name) : ""}<br>${escapeHtml(m.description || "")}</p>` : "") +
+          ll2Links(r) +
           `<div style="font-size:11px">Launch Library 2, The Space Devs</div></div>` });
     }
   }
@@ -3648,7 +3876,10 @@ function addCompanion(cfg) {
     el.className = "companion";
     el.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:46vh;z-index:40;display:flex;flex-direction:column;" +
       "background:var(--peat,#17150F);border-top:1px solid var(--rule,#322E27)";
-    el.innerHTML = `<div style="display:flex;align-items:center;gap:11px;padding:6px 12px;font-size:12.5px;color:var(--dim)">` +
+    // The bar along its top is a handle: drag it up or down to size the panel.
+    el.innerHTML = `<div class="c-grab" title="Drag up or down to resize" style="height:9px;cursor:ns-resize;touch-action:none;display:flex;justify-content:center;align-items:center">` +
+      `<span style="width:44px;height:3px;border-radius:2px;background:var(--rule,#322E27)"></span></div>` +
+      `<div class="c-bar" style="display:flex;align-items:center;gap:11px;padding:2px 12px 6px;font-size:12.5px;color:var(--dim);cursor:ns-resize;touch-action:none">` +
       `<span style="color:var(--bone)">${escapeHtml(cfg.name)}</span>` +
       (cfg.follow ? `<label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" checked> follow this map</label>`
         : `<span style="font-size:11.5px">If this stays blank, the site does not allow being shown inside another page: use open \u2197</span>`) +
@@ -3665,6 +3896,24 @@ function addCompanion(cfg) {
       if (cb) { cb.checked = false; cb.dispatchEvent(new Event("change", { bubbles: true })); }
     });
     frame.addEventListener("load", () => setTimeout(() => companionSync(cfg), 800));
+    // Dragging the grab strip or the bar (not its buttons or links) resizes
+    // the panel; the frame ignores the pointer meanwhile so it cannot swallow it.
+    let drag = null;
+    const grabbers = [el.querySelector(".c-grab"), el.querySelector(".c-bar")];
+    grabbers.forEach((g) => g.addEventListener("pointerdown", (e) => {
+      if (e.target.closest && e.target.closest("button, a, input, label")) return;
+      drag = { y: e.clientY, h: el.getBoundingClientRect().height };
+      frame.style.pointerEvents = "none";
+      g.setPointerCapture && g.setPointerCapture(e.pointerId);
+      e.preventDefault();
+    }));
+    const move = (e) => {
+      if (!drag) return;
+      const h = Math.max(90, Math.min(window.innerHeight - 40, drag.h + (drag.y - e.clientY)));
+      el.style.height = `${Math.round(h)}px`;
+    };
+    const end = () => { if (drag) { drag = null; frame.style.pointerEvents = ""; } };
+    grabbers.forEach((g) => { g.addEventListener("pointermove", move); g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end); });
     if (c.follow) c.follow.addEventListener("change", () => companionSync(cfg));
     map.on("moveend", () => companionSync(cfg));
     frame.src = cfg.page;
@@ -6268,7 +6517,7 @@ const OTHER_MAPS = {
               { label: "Trips", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/AllTrips.geojson" },
               { label: "Oceans", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/Oceans.geojson" }],
       note: "Seas of Plastic's own data files, read live: sampling stations, the trips that took them, and its ocean areas." },
-    { id: "final_nail", name: "Final Nail (fur farms)", unit: "farms", colour: "#6B5A4A", route: "wpgmza", ready: true, lazy: true,
+    { id: "final_nail", name: "Fur Farms (Final Nail)", unit: "farms", colour: "#6B5A4A", route: "wpgmza", ready: true, lazy: true,
       api: "https://finalnail.com/wp-json/wpgmza/v1/features/",
       note: "Final Nail's map, read live from its own data address, as it publishes it (names and addresses included)." },
     { id: "nusantara", name: "Nusantara Atlas (TheTreeMap)", unit: "map layers", colour: "#6F7560", route: "wmsmenu", ready: true, lazy: true,
@@ -6310,7 +6559,7 @@ const OTHER_MAPS = {
     { id: "space_industry", name: "The space industry (openmaps.space)", unit: "places", colour: "#5E6070", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Places", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/openmaps/space_industry.geojson" }],
       note: "openmaps.space's space industry map: every place it lists, with the organisations there, copied daily from its own data file." },
-    { id: "mymaps_supp_a", name: "Google My Maps map (Suppression page)", unit: "placemarks", colour: "#6A5E66", route: "kml", ready: true, lazy: true,
+    { id: "mymaps_supp_a", name: "Pet Food Companies", unit: "placemarks", colour: "#6A5E66", route: "kml", ready: true, lazy: true,
       kml: "https://www.google.com/maps/d/kml?mid=1vrnqSW4cWWdnjz6cJ-qFMmd0zbJzYd6V&forcekml=1",
       note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." },
     { id: "mymaps_supp_b", name: "Google My Maps map (Suppression page)", unit: "placemarks", colour: "#6A5E66", route: "kml", ready: true, lazy: true,
@@ -6903,10 +7152,6 @@ function buildPanel() {
     syncGroupBox(box);
   });
 
-  document.getElementById("note").textContent =
-    `Below zoom ${CLUSTER_MAXZOOM} every layer shows summed totals. Zoom past it and ` +
-    `individual assets load for the visible area only. Units differ by layer and ` +
-    `are never combined into a single figure.`;
 }
 
 function updateZoomState() {
@@ -7168,6 +7413,11 @@ const PANEL_ORDER = [
   { h: 4, t: "Food generally" }, "site_food_system",
   { h: 4, t: "Generally" }, "wreckers_umap", "fortune500", "theyrule", "pe_bankrolling", "scribd_doc",
   { h: 2, t: "Of groups" },
+  { h: 3, t: "Of humans" },
+  { h: 3, t: "Of animals" }, "final_nail",
+  { h: 3, t: "Of plants" },
+  { h: 3, t: "Of microorganisms" },
+  { h: 3, t: "Of the \u201cinsentient\u201d" },
   { h: 2, t: "Of individuals" }, "site_animal_sacrifice",
 
   { h: 1, t: "Suppression" },
@@ -7201,13 +7451,20 @@ const PANEL_ORDER = [
   { h: 4, t: "Holidays" },
   { h: 4, t: "Sex" },
   { h: 4, t: "Drugs" }, "capture_map",
-  { h: 2, t: "Of animals" }, "site_animal_fighting", "site_animal_tourism", "site_circus", "site_animal_racing", "site_rodeo", "final_nail", "mymaps_supp_a", "mymaps_supp_b",
+  { h: 2, t: "Of animals" }, "site_animal_fighting", "site_animal_tourism", "site_circus", "site_animal_racing", "site_rodeo", "mymaps_supp_b",
+  { h: 3, t: "The pet industry" }, "mymaps_supp_a",
   { h: 2, t: "Of plants" }, "site_enslaved_plants", "mymaps_trees",
   { h: 2, t: "Of microscopics" }, "site_enslaved_microbes",
   { h: 2, t: "Of the \u201cinsentient\u201d" }, "site_insentient",
 
   { h: 1, t: "Off-planet invasion" },
-  "space_industry", "ll2_pads", "ll2_upcoming", "wrf", "nsf_launches", "esa_risk", "biosignature",
+  { h: 2, t: "To Earth" },
+  { h: 3, t: "Near-Earth object impacts" }, "esa_risk",
+  { h: 3, t: "Unidentified aerial phenomena" },
+  { h: 2, t: "From Earth" },
+  { h: 3, t: "The space industry" }, "space_industry",
+  { h: 3, t: "Space launches" }, "ll2_pads", "ll2_upcoming", "wrf", "nsf_launches",
+  { h: 3, t: "Protecting extraterrestrial life" }, "biosignature",
 
   { h: 1, t: "Buildings" }, "building_types",
 ];
@@ -7396,6 +7653,20 @@ function rowDragging(box) {
 // Buildings sits at the foot of the layers box, held there while the rest
 // scrolls above it, rather than as the last of the sections. It stays inside
 // the box, so its rows keep every tool the others have.
+// Headings are shown in title case: every word capitalised except short
+// joining words, and the first word always; hyphenated parts each capitalised.
+const TITLE_SMALL = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "vs"]);
+function titleCase(t) {
+  let first = true;
+  return String(t).split(/(\s+)/).map((w) => {
+    if (/^\s+$/.test(w) || !w) return w;
+    const lead = w.match(/^[^A-Za-z\u00C0-\u024F]*/)[0], core = w.slice(lead.length);
+    const out = !first && TITLE_SMALL.has(core.toLowerCase()) ? core.toLowerCase()
+      : core.split("-").map((p) => p ? p[0].toUpperCase() + p.slice(1) : p).join("-");
+    first = false;
+    return lead + out;
+  }).join("");
+}
 function pinBuildings(box) {
   const sec = [...box.querySelectorAll(".toc-sec.toc-l1")].find((x) => {
     const t = x.querySelector(".toc-t");
@@ -7424,7 +7695,7 @@ function arrangePanel() {
     head.type = "button";
     head.className = `toc-head panel-h panel-h${h}`;
     head.setAttribute("aria-expanded", "false");
-    head.innerHTML = `<span class="toc-arrow">\u25B8</span><span class="toc-t">${escapeHtml(t)}</span><span class="toc-n"></span>`;
+    head.innerHTML = `<span class="toc-arrow">\u25B8</span><span class="toc-t">${escapeHtml(titleCase(t))}</span><span class="toc-n"></span>`;
     const body = document.createElement("div");
     body.className = "toc-body";
     body.hidden = true;
diff --git a/map/test.mjs b/map/test.mjs
index 53673d2..0a7a935 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1789,7 +1789,8 @@ console.log("\nsuppression in the given order; news box filters");
         at("Of humans") < at("Physical suppression") && at("Physical suppression") < at("Suppression by \u201crepresentation\u201d within it") &&
         at("Suppression by \u201crepresentation\u201d within it") < at("Suppression by information") && at("Suppression by information") < at("Suppression by social molds"));
   check("Economically is now Control of physical resources", at("Economically") === -1 && at("Control of physical resources") > at("Physical suppression"));
-  check("the other beings follow Of humans", at("Of animals") > at("Suppression by social molds") && at("Of microscopics") > at("Of plants"));
+  const last = (x) => order.map((y) => y && y.t).lastIndexOf(x);
+  check("the other beings follow Of humans", last("Of animals") > at("Suppression by social molds") && last("Of microscopics") > last("Of plants"));
   const pick = new Function(src.slice(src.indexOf("function wirePopPick("), src.indexOf("// Every story at a mark")) + "; return wirePopPick;")();
   const list = [{ subject: "Slavery", outlet: "AP", title: "Brick kilns raided" }, { subject: "Voting", outlet: "AP", title: "Polls close" },
                 { subject: "Slavery", outlet: "BBC", title: "Fishing crews freed" }];
@@ -1847,7 +1848,7 @@ console.log("\nrow tools; easier-to-see points; monitors back in the wires box o
   check("the monitor layers are gone", !/monitor_/.test(src) && !/route: "monitor"/.test(src));
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const order = new Function(body + "; return PANEL_ORDER;")();
-  const plants = order.findIndex((x) => x && x.t === "Of plants");
+  const plants = order.map((x) => x && x.t).lastIndexOf("Of plants");
   check("the Christmas tree map is under Suppression, Of plants", order.indexOf("mymaps_trees") === plants + 2);
   const hook = src.slice(src.indexOf("const POINT_MIN"), src.indexOf("const OPACITY_PROPS"));
   const [mapOutputs, boostOne, legibleCircle] = new Function(hook + "; return [mapOutputs, boostOne, legibleCircle];")();
@@ -1875,7 +1876,7 @@ console.log("\nlaunch sites and upcoming launches");
 console.log("\nthe space industry map");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
-  check("it is a row under Off-planet invasion", /id: "space_industry"/.test(src) && /"space_industry", "ll2_pads"/.test(src));
+  check("it is a row under Off-planet invasion", /id: "space_industry"/.test(src) && /\{ h: 3, t: "The space industry" \}, "space_industry"/.test(src));
   check("its boxes are the ones its copy carries", /p\._html \? boxOpen \+ p\._html/.test(src));
 }
 
@@ -2084,5 +2085,24 @@ console.log("\nthe Satellite basemap as a planetary-defence view; folding a row'
   check("each ticked row with boxes under it has a fold button", /f\.className = "fold";/.test(src) && /has\(\+ \.facet\) \.fold\{display:inline-block\}/.test(src));
 }
 
+console.log("\nOff-planet sections, Of groups, names, launch links, drag bar, markers, headings");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const order = new Function(body + "; return PANEL_ORDER;")();
+  const at = (t) => order.findIndex((x) => x && x.t === t);
+  check("Off-planet has To Earth and From Earth, with their four sections and one empty",
+        at("To Earth") < at("Near-Earth object impacts") && at("Unidentified aerial phenomena") < at("From Earth") &&
+        at("From Earth") < at("The space industry") && at("Space launches") < at("Protecting extraterrestrial life"));
+  check("Fur Farms (Final Nail) is under Destruction, Of groups, Of animals", order.indexOf("final_nail") === at("Of animals") + 1 && at("Of animals") > at("Of groups") && /name: "Fur Farms \(Final Nail\)"/.test(src));
+  check("Pet Food Companies is under The pet industry", order.indexOf("mymaps_supp_a") === at("The pet industry") + 1 && /name: "Pet Food Companies"/.test(src));
+  check("each upcoming launch links to its own pages", /spacelaunchnow\.me\/launch\//.test(src) && /r\.info_urls/.test(src) && /ll2Links\(r\)/.test(src));
+  check("page panels have a drag bar", /class="c-grab"/.test(src) && /ns-resize/.test(src));
+  check("every point layer gets a geometric marker; the round one stays for clicks", /function addHud\(/.test(src) && /paint\(layer\.id, "circle-opacity", 0\)/.test(src));
+  check("the zoom-8 note is gone", !/every layer shows summed totals/.test(src));
+  const tc = new Function(src.slice(src.indexOf("const TITLE_SMALL"), src.indexOf("function pinBuildings(")) + "; return titleCase;")();
+  check("headings are in title case", tc("Suppression by \u201crepresentation\u201d within it") === "Suppression by \u201cRepresentation\u201d Within It" && tc("Of the planet") === "Of the Planet" && tc("For money-written-law") === "For Money-Written-Law");
+}
+
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
'''

with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False, encoding="utf-8") as f:
    f.write(DIFF)
chk = subprocess.run(["git", "apply", "--check", f.name], cwd=ROOT, capture_output=True, text=True)
if chk.returncode:
    sys.exit("The map files differ from the copy this was made for. Run git pull first. Nothing was written. " + chk.stderr)
subprocess.run(["git", "apply", f.name], cwd=ROOT, check=True)
print("Done. Test with: node map/test.mjs")
