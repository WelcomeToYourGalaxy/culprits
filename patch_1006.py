#!/usr/bin/env python3
"""
A tick on every heading; the abattoir atlas's three parts as three rows; the
guides row removed; the modelled fishing layer moved to Slavery; Terrestrial
slicks first; slaughter chips in words; an archive that fails names its file.

Run from the repo root:  python3 patch_1006.py

Needs patch_1005.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js                     Every heading and sub-heading takes its own
                                 tick, which shows or hides every layer under
                                 it and reads all, none or part-way from them.
                                 The abattoir atlas's modelled confined animal
                                 facilities and FAO livestock grid become rows
                                 of their own under Meat, beside the registered
                                 facilities, instead of chips inside one row.
                                 The community resistance guides row is
                                 removed. The modelled at-risk fishing layer
                                 moves to Slavery. Terrestrial slicks is listed
                                 above Marine slicks. The slaughter chips read
                                 "registered to slaughter", "registered, does
                                 not slaughter", "registry does not say".
                                 An archive that will not load now names the
                                 file it asked for, so a failure can be told
                                 apart from a wrong address.
  pipeline/shapes/registry.json  love_guides marked retired.
  map/test.mjs                   Checks for all of it.
  HANDOFF.md                     The heading ticks and the three meat rows.

In culprits-tiles-more, re-upload scripts/retire.py (it now names love_guides
as well) and run the refresh workflow with retire in the box.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 55987d0..09adc76 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -83,6 +83,21 @@ Worker: `https://culprits-proxy.welcometoyourgalaxy.workers.dev`
 
 ---
 
+## Bulk ticks, and the abattoir atlas's three rows
+
+Every heading carries its own tick, beside the heading rather than inside it,
+which shows or hides every layer under it including sub-headings;
+`syncHeadingBoxes` keeps it reading all, none or part-way from the layers
+themselves. Ticking a heading with many layers under it loads all of them.
+
+The abattoir atlas's three parts are three rows under Meat rather than chip
+buttons inside one row: the registered facilities, Climate TRACE's modelled
+confined animal feeding operations (`route:"cafo"`), and FAO's modelled
+livestock density grid (`route:"glw"`). They answer different questions, and a
+reader ticking slaughterhouses should not get a model's estimate with it.
+
+---
+
 ## What the alert rows actually are
 
 The three live-alert rows are Global Forest Watch products, served by GFW's own
@@ -142,10 +157,12 @@ by `build_shapes.py`). Its project cards are the same records as
 `local_projects`, so that row stands and nothing is drawn twice, and its Earth
 First! archive is text with no positions, so nothing of it is placed.
 
-Its wire and its country tracker lists were rows here briefly and are not any
-more: the wire belongs in the wires box, and the tracker lists were taken off
-at the owner's request. `love_trackers` is marked retired in the shapes
-registry and its published files are removed by `scripts/retire.py`.
+Nothing of it is a row here any more. The wire belongs in the wires box, and
+the tracker lists and the country guides were taken off at the owner's request;
+its project cards were always the Development projects row. `love_trackers` and
+`love_guides` are marked retired in the shapes registry and their published
+files are removed by `scripts/retire.py`. The `country_docs` kind stays, unused
+until something wants it.
 
 `love_guides` uses the `country_docs` kind, which reads the ISO3 index inside
 the map's own page (`LKA:{file:'srilanka.md',pdf:'...'}`) rather than GitHub's
diff --git a/map/app.js b/map/app.js
index f9ced40..5ba472c 100644
--- a/map/app.js
+++ b/map/app.js
@@ -387,15 +387,22 @@ const LAYERS = [
   // From WelcomeToYourGalaxy/abattoir-atlas: its merged facility records, every
   // one, not the subset its own page draws. Share-alike (OSM rows and OSM-based
   // geocoding), so its archive is isolated, as local_projects is.
-  { id:"abattoir_facilities",  name:"Slaughterhouses, farms and other animal-use sites", unit:"facilities", colour:"#80605A", route:"pmtiles", ready:true, off: true,
+  { id:"abattoir_facilities",  name:"Registered animal-use facilities \u2014 slaughterhouses, farms, dairies, hatcheries and zoos", unit:"facilities", colour:"#80605A", route:"pmtiles", ready:true, off: true,
     isolate:true,
-    // The abattoir atlas draws two more things beside its facility list, and
-    // so does this row: Climate TRACE's modelled confined animal facilities
-    // and FAO's livestock density grid. See addAbattoirParts.
-    parts: true,
     facet: { property: "x_slaughter", label: "slaughter",
-             values: ["yes","no","not stated"] },
+             values: ["yes","no","not stated"],
+             // The registry's three answers, in words. "yes" and "no" are a
+             // registry's statement about the site, not a finding of ours, and
+             // "not stated" is the commonest of the three: it means the
+             // registry recorded the site without recording what it does.
+             labels: { "yes": "registered to slaughter",
+                       "no": "registered, does not slaughter",
+                       "not stated": "registry does not say" } },
     note: "Most of these are not slaughterhouses: farms, dairies, processors, transporters, hatcheries and zoos are registered animal-use sites too. Slaughter is marked yes or no only where a registry says; for most it says neither. Hollow points are placed at a town, not the site. Records with no position at all are not drawn." },
+  { id:"abattoir_cafo",        name:"Confined animal feeding operations, modelled (Climate TRACE)", unit:"modelled facilities", colour:"#7B6A4E", route:"cafo", ready:true, off: true,
+    note: "A model's estimate from satellite imagery and census data, not a permit register: nothing here has necessarily been visited, licensed or confirmed by any authority. Hollow where Climate TRACE give an area rather than the facility's own position." },
+  { id:"abattoir_glw",         name:"Livestock density, modelled (FAO Gridded Livestock of the World 4, 2020)", unit:"animals per square km", colour:"#6E6A55", route:"glw", ready:true, off: true,
+    note: "A modelled grid of where animals are kept, not a count of farms. FAO fit census totals to land cover and other predictors, so a dense square means the model puts animals there." },
   { id:"slavery_cases",        name:"Identified trafficking cases", unit:"identified cases", colour:"#7A6A72", route:"country", ready:true, off:true,
     note: "Detection, not prevalence. A country with a large count has organisations filing records; a country with none may have no one counting." },
 
@@ -1383,8 +1390,11 @@ async function addPmtilesLayer(cfg) {
     const head = await fetch(url, { method: "HEAD" });
     if (!head.ok) throw new Error(`${head.status} at ${url}`);
   } catch (e) {
-    setLayerState(cfg.id, `archive missing (${e.message})`);
-    console.error(`[culprits] ${cfg.id}: ${e.message}`);
+    // The file as well as the failure: "Failed to fetch" on its own cannot be
+    // told apart from a wrong address, a blocked request or a file that never
+    // deployed, and the address is the first thing to check.
+    setLayerState(cfg.id, `archive missing (${e.message}) \u2014 ${url}`);
+    console.error(`[culprits] ${cfg.id}: ${e.message} at ${url}`);
     return;
   }
 
@@ -3033,43 +3043,22 @@ const CAFO_TILES = "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ti
 const GLW_TILES = "https://data.apps.fao.org/map/wmts/wmts?layer=fao-gismgr/GLW4-2020/mapsets/D-DA" +
   "&tilematrixset=EPSG:3857&Service=WMTS&request=GetTile&Version=1.0.0&style=default&Format=image/png" +
   "&layertype=Image&TileMatrix={z}&TileCol={x}&TileRow={y}";
-function partsRow(cfg) {
-  cfg._parts = cfg._parts || { reg: true, cafo: true, glw: true };
-  const el = document.createElement("div");
-  el.className = "facet";
-  el.dataset.parts = cfg.id;
-  el.innerHTML = ABATTOIR_PARTS.map(([k, t]) =>
-    `<button type="button" class="chip${cfg._parts[k] ? " on" : ""}" data-part="${k}">${escapeHtml(t)}</button>`).join("");
-  el.addEventListener("click", (e) => {
-    const b = e.target.closest && e.target.closest("[data-part]");
-    if (!b) return;
-    e.stopPropagation();
-    cfg._parts[b.dataset.part] = !cfg._parts[b.dataset.part];
-    b.classList.toggle("on", cfg._parts[b.dataset.part]);
-    applyAbattoirParts(cfg, visibility.get(cfg.id) || "none");
-  });
-  return el;
-}
-function applyAbattoirParts(cfg, vis) {
-  const parts = cfg._parts || { reg: true, cafo: true, glw: true };
-  const own = new Set(cfg._layerIds || []);
-  const set = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis === "visible" && on ? "visible" : "none"); };
-  for (const id of layersOfRow(cfg.id)) {
-    if (own.has(id)) continue;
-    set(id, parts.reg);
-  }
-  set(`${cfg.id}-cafo`, parts.cafo);
-  set(`${cfg.id}-glw`, parts.glw);
-}
-function addAbattoirParts(cfg) {
-  if (!cfg || map.getSource(`${cfg.id}-cafo-src`)) return;
-  cfg._parts = cfg._parts || { reg: true, cafo: true, glw: true };
-  cfg._layerIds = [`${cfg.id}-glw`, `${cfg.id}-cafo`];
-  const first = layersOfRow(cfg.id)[0];
+// The two modelled sets the abattoir atlas draws beside its facility list are
+// rows of their own, not buttons inside one row. They answer different
+// questions - what is registered, what a model puts where, how many animals a
+// grid says are there - and a reader ticking "slaughterhouses" should not have
+// a model's estimate arrive with it.
+function addGlwLayer(cfg) {
+  if (!cfg || map.getSource(`${cfg.id}-glw-src`)) return;
   map.addSource(`${cfg.id}-glw-src`, { type: "raster", tileSize: 256, maxzoom: 10, tiles: [GLW_TILES],
     attribution: 'Livestock density: FAO, Gridded Livestock of the World 4 (2020), CC BY 4.0 \u2014 modelled, not counted' });
   map.addLayer({ id: `${cfg.id}-glw`, type: "raster", source: `${cfg.id}-glw-src`, layout: { visibility: "none" },
-    paint: { "raster-opacity": 0.6, "raster-saturation": -0.55 } }, first);
+    paint: { "raster-opacity": 0.6, "raster-saturation": -0.55 } }, pointLayerAbove());
+  setLayerState(cfg.id, "FAO's modelled grid of how many animals are kept where, 2020");
+  applyVisibility(cfg.id);
+}
+function addCafoLayer(cfg) {
+  if (!cfg || map.getSource(`${cfg.id}-cafo-src`)) return;
   map.addSource(`${cfg.id}-cafo-src`, { type: "vector", url: `pmtiles://${CAFO_TILES}`,
     attribution: 'Confined animal facilities: Climate TRACE, CC BY 4.0 \u2014 modelled, not a permit register' });
   const n = ["coalesce", ["get", "point_count"], 1];
@@ -3081,12 +3070,12 @@ function addAbattoirParts(cfg) {
       "circle-opacity": ["case", ["==", ["get", "precise"], 0], 0, 0.75],
       "circle-stroke-color": "#7B6A4E",
       "circle-stroke-width": ["case", ["==", ["get", "precise"], 0], 1, 0.4],
-    } }, first);
+    } }, pointLayerAbove());
   bindHtmlPopup(`${cfg.id}-cafo`, (p) => Number(p.point_count) > 1
     ? `<b>${Number(p.point_count).toLocaleString()} modelled facilities here</b><div class="meta">Merged at this zoom. Zoom in to see each one.</div>`
     : `<b>Confined animal facility (modelled)</b><table class="meta">${fieldRows(p, ["precise"])}</table>` +
       `<div class="meta">Climate TRACE model these from satellite imagery and census data. Nothing here has necessarily been visited, licensed or confirmed by any authority${Number(p.precise) === 0 ? "; hollow because the source gives an area, not a position" : ""}.</div>`);
-  cfg.afterVisibility = (vis) => applyAbattoirParts(cfg, vis);
+  setLayerState(cfg.id, "Climate TRACE's modelled confined animal facilities");
   applyVisibility(cfg.id);
 }
 // Google My Maps rows: the daily address job (culprits-tiles-more) keeps each
@@ -3108,11 +3097,7 @@ async function mymapsTitles() {
   }
   if (typeof buildLegend === "function") buildLegend();
 }
-function abattoirPartsInit() {
-  const cfg = LAYERS.find((l) => l.id === "abattoir_facilities");
-  // After the row's own layers exist, so the grid and points sit beneath them.
-  try { if (cfg) addAbattoirParts(cfg); } catch (e) { console.warn("[culprits] abattoir parts:", e.message); }
-}
+function abattoirPartsInit() { /* both parts are rows of their own now */ }
 
 /* ---------- live places, batch 2 ---------- */
 const boxOpen = `<div style="font:13px/1.4 system-ui,sans-serif;max-width:340px">`;
@@ -6320,8 +6305,9 @@ function facetRow(cfg) {
   const box = document.createElement("div");
   box.className = "facet";
   box.dataset.for = cfg.id;
+  const labels = cfg.facet.labels || {};
   box.innerHTML = cfg.facet.values
-    .map((v) => `<button class="chip" data-facet="${cfg.id}" data-value="${v}">${v}</button>`)
+    .map((v) => `<button class="chip" data-facet="${cfg.id}" data-value="${escapeHtml(v)}" title="${escapeHtml(v)}">${escapeHtml(labels[v] || v)}</button>`)
     .join("") + `<button class="chip reset" data-facet="${cfg.id}" data-value="">all</button>`;
   return box;
 }
@@ -6772,16 +6758,6 @@ const OTHER_MAPS = {
     { id: "rte_trade", name: "Resource trade flows (resourcetrade.earth, Chatham House)", unit: "trade flows", colour: "#8A6356", route: "rte", ready: true, lazy: true,
       api: "https://api.resourcetrade.earth/api/rt/2.7", copy: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/rte",
       note: "The largest natural-resource trade flows between countries, read live from resourcetrade.earth (a daily copy stands in if it cannot be read)." },
-    // Live Projects to Resist, drawn on this map rather than opened in a panel
-    // beside it. Its project cards are the Development projects row already
-    // under Construction, from the same records, so they are not drawn twice;
-    // what it adds over that row is its country guides, below. Its news wire
-    // belongs in the wires box and is read there, not as places on the map,
-    // and its Earth First! archive is text sections with no positions, so
-    // there is nothing of it to place.
-    { id: "love_guides", name: "Community resistance how-to guides, by country (Live Projects to Resist)", unit: "countries", colour: "#7B8472", route: "shapes", ready: true, lazy: true,
-      dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/love_guides.geojson",
-      note: "One guide per country, linked from the country it is written for: the how-to as a PDF, as a page, and to download. Seven of the map's entries have no outline in the boundaries file and are named in the build log rather than dropped quietly." },
     { id: "gsn", name: "Global Safety Net (One Earth)", unit: "layers", colour: "#406F2F", route: "gsn", ready: true, lazy: true,
       api: "https://api.gsn.naturedatalab.org/geo-analysis/layers",
       note: "Every layer the Global Safety Net viewer offers, drawn live from its own map service in its own colours." },
@@ -7017,6 +6993,8 @@ function ensureLayer(cfg) {
     : cfg.route === "trase" ? addTraseLayer(cfg)
     : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
     : cfg.route === "slickarchive" ? addSlickArchive(cfg)
+    : cfg.route === "cafo" ? Promise.resolve().then(() => addCafoLayer(cfg))
+    : cfg.route === "glw" ? Promise.resolve().then(() => addGlwLayer(cfg))
     : cfg.route === "arcgisdyn" ? addArcgisDynLayer(cfg)
     : cfg.route === "giga" ? addGigaLayer(cfg)
     : cfg.route === "trasefacmenu" ? addTraseFacMenu(cfg)
@@ -7110,6 +7088,8 @@ const LAYER_KIND = {
   remains_findings: ["human", "downstream"],
   remains_cemeteries: ["human", "downstream"],
   abattoir_facilities: ["animal", "downstream"],
+  abattoir_cafo: ["animal", "downstream"],
+  abattoir_glw: ["animal", "downstream"],
   cultivated_meat_laws: ["animal", "upstream"],
   cerulean_slicks: ["insentient", "downstream"],
   cerulean_sources: ["insentient", "upstream"],
@@ -7183,7 +7163,6 @@ const LAYER_KIND = {
   ct_air: ["human", "downstream"],
   ct_pop: ["human", "downstream"],
   gsn: ["plant", "downstream"],
-  love_guides: ["human", "downstream"],
   rte_trade: ["insentient", "upstream"],
   mymaps_supp_a: ["animal", "downstream"],
   mymaps_supp_b: ["animal", "downstream"],
@@ -7319,7 +7298,6 @@ function buildPanel() {
       `<span class="un" data-state="${cfg.id}">${cfg.unit}</span></span>`;
     box.appendChild(row);
     if (cfg.facet) box.appendChild(facetRow(cfg));
-    if (cfg.parts) box.appendChild(partsRow(cfg));
   });
 
   // The group renders only if it has children. With no year archives on R2 the
@@ -7673,13 +7651,13 @@ const PANEL_ORDER = [
   { h: 3, t: "Mining" }, "mines_global",
   { h: 3, t: "Meat and agriculture" },
   { h: 4, t: "Agriculture" }, "land_matrix", "palmwatch",
-  { h: 4, t: "Meat" }, "abattoir_facilities", "cultivated_meat_laws",
+  { h: 4, t: "Meat" }, "abattoir_facilities", "abattoir_cafo", "abattoir_glw", "cultivated_meat_laws",
   { h: 3, t: "Oceans" },
-  { h: 4, t: "Fishing" }, "fishing", "slavery_fishing",
+  { h: 4, t: "Fishing" }, "fishing",
   { h: 4, t: "Oil slicks" },
-  { h: 5, t: "Marine slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc",
   { h: 5, t: "Terrestrial slicks" }, "skytruth_monitor",
-  { h: 3, t: "Construction" }, "local_projects", "love_guides",
+  { h: 5, t: "Marine slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc",
+  { h: 3, t: "Construction" }, "local_projects",
   { h: 3, t: "Culprits upstream" }, "ejatlas",
   { h: 4, t: "Emissions" }, "carbon_majors", "soy_organizations", "bocc",
   { h: 4, t: "Deforestation" }, "site_forest500_soy", "site_soybean_companies", "dff",
@@ -7704,7 +7682,7 @@ const PANEL_ORDER = [
   { h: 4, t: "Law enforcement" },
   { h: 4, t: "Courts and corrections" },
   { h: 4, t: "Discrimination" },
-  { h: 4, t: "Slavery" }, "slavery_sites", "slavery_ports", "slavery_routes", "slavery_determinations", "slavery_enforcement",
+  { h: 4, t: "Slavery" }, "slavery_sites", "slavery_ports", "slavery_fishing", "slavery_routes", "slavery_determinations", "slavery_enforcement",
   { h: 5, t: "National shading" }, "slavery_cases", "slavery_prevalence",
   { h: 3, t: "Suppression by \u201crepresentation\u201d within it" },
   { h: 4, t: "Politics as a front" },
@@ -7763,6 +7741,22 @@ const PANEL_REMOVED = new Set([
   "leg_municipal", "leg_municipal_recover", "leg_laws",
 ]);
 
+// A heading's tick reads its layers, never the other way round: all on, none
+// on, or part-way, which is the only honest rendering of a heading holding
+// some ticked rows.
+function syncHeadingBoxes(box) {
+  if (!box || !box.querySelectorAll) return;
+  for (const sec of box.querySelectorAll(".toc-sec")) {
+    const all = sec.querySelector(".toc-all");
+    if (!all) continue;
+    const boxes = [...sec.querySelectorAll("[data-layer]")];
+    const on = boxes.filter((i) => i.checked).length;
+    all.checked = boxes.length > 0 && on === boxes.length;
+    all.indeterminate = on > 0 && on < boxes.length;
+    all.disabled = boxes.length === 0;
+  }
+}
+
 function panelNodes(box, key) {
   let lead = null;
   if (key === "gm") { const i = box.querySelector("[data-gm]"); lead = i && i.closest("label"); }
@@ -8006,7 +8000,32 @@ function arrangePanel() {
       body.hidden = !body.hidden;
       head.setAttribute("aria-expanded", String(!body.hidden));
     });
-    sec.appendChild(head);
+    // Every heading takes its own tick, which shows or hides every layer under
+    // it, sub-headings included. It sits beside the heading rather than inside
+    // it, so opening a heading and turning its layers on stay separate
+    // actions - the same reason a group's triangle and its box are separate.
+    // Ticking a heading with many layers under it loads all of them, which is
+    // why the tick says so.
+    const line = document.createElement("div");
+    line.className = "toc-line";
+    const all = document.createElement("input");
+    all.type = "checkbox";
+    all.className = "toc-all";
+    all.title = "Show or hide every layer under this heading";
+    all.setAttribute("aria-label", `Show or hide every layer under ${titleCase(t)}`);
+    all.addEventListener("click", (e) => e.stopPropagation());
+    all.addEventListener("change", () => {
+      const on = all.checked;
+      for (const i of body.querySelectorAll("[data-layer]")) {
+        if (i.checked === on) continue;
+        i.checked = on;
+        if (typeof i.dispatchEvent === "function" && typeof Event === "function") i.dispatchEvent(new Event("change", { bubbles: true }));
+      }
+      syncHeadingBoxes(document.getElementById("layers"));
+    });
+    line.appendChild(all);
+    line.appendChild(head);
+    sec.appendChild(line);
     sec.appendChild(body);
     stack[stack.length - 1].body.appendChild(sec);
     stack.push({ level: h, body });
@@ -8048,6 +8067,10 @@ function arrangePanel() {
     box.appendChild(sec);
     sec.querySelector(".toc-body").appendChild(rest);
   }
+  syncHeadingBoxes(box);
+  box.addEventListener("change", (e) => {
+    if (e && e.target && e.target.dataset && e.target.dataset.layer) syncHeadingBoxes(box);
+  });
   // Beside each heading, how many layers are inside it.
   for (const sec of box.querySelectorAll(".toc-sec")) {
     const n = sec.querySelectorAll("[data-layer], [data-gm]").length;
@@ -8061,7 +8084,11 @@ function arrangePanel() {
   if (!document.getElementById("panel-h-style")) {
     const st = document.createElement("style");
     st.id = "panel-h-style";
-    st.textContent = ".panel-h{margin:10px 0 4px;color:var(--ink,#e8e2d6)}" +
+    st.textContent = ".toc-line{display:flex;align-items:center;gap:6px}" +
+      ".toc-line .toc-head{flex:1;text-align:left}" +
+      ".toc-all{flex:none;accent-color:#8A9DA6;cursor:pointer}" +
+      ".toc-all:disabled{opacity:.3;cursor:default}" +
+      ".panel-h{margin:10px 0 4px;color:var(--ink,#e8e2d6)}" +
       ".panel-h1{font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-top:1px solid rgba(255,255,255,.18);padding-top:8px;font-weight:700}" +
       ".panel-h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;padding-left:4px;font-weight:600}" +
       ".panel-h3{font-size:11px;opacity:.8;padding-left:10px;font-weight:600}" +
diff --git a/map/test.mjs b/map/test.mjs
index 469e80b..25b3795 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1905,10 +1905,9 @@ console.log("\nSocial Spheres controls; Live Projects to Resist whole; wastewate
   const lab = new Function(src.slice(src.indexOf("function spheresLabels("), src.indexOf("function spheresControls(")) + "; return spheresLabels;")();
   check("the Social Spheres' own kind names are read", lab('const KINDLABEL={assoc:"Association & commission",club:"Club"};').club === "Club");
   check("a person or sector opens through the map's own functions only", /\["openNode", "openPerson", "openSector"\]\.includes\(fn\)/.test(src));
-  check("Live Projects to Resist is drawn on this map, not opened beside it",
-        !/id: "live_projects_app"/.test(src) && /id: "love_guides"/.test(src));
-  check("its wire stays in the wires box and its tracker lists are gone from the map",
-        !/id: "love_wire"/.test(src) && !/id: "love_trackers"/.test(src));
+  check("Live Projects to Resist has no rows of its own; its projects are the Development projects row",
+        ["live_projects_app", "love_wire", "love_trackers", "love_guides"].every((i) => !new RegExp(`id: "${i}"`).test(src)) &&
+        /id:"local_projects"/.test(src));
   check("its project cards are not drawn a second time", (src.match(/id:\s*"local_projects"/g) || []).length === 1);
   check("the wastewater layers read the GitHub copy", (src.match(/tiles\/wastewater_N_[a-z_]+\.pmtiles/g) || []).length === 5 && !/mazu\.nceas\.ucsb\.edu/.test(src));
 }
@@ -2011,7 +2010,10 @@ console.log("\nchanges of 19 September");
   check("coral is one row", o.PANEL_REMOVED.has("unep_coral") && pos("allen_coral") > 0);
   check("mines are merged into counted points wider out", /mines here<\/b>/.test(src) && /"point_count"\], 1\]\]\]\],\n\s*6,/.test(src));
   check("alerts are grown and lightened wider out", /function recolorAlerts\(px, rgb, z, w\)/.test(src) && /recolorAlerts\(img\.data, tint, z, bmp\.width\)/.test(src));
-  check("the Slaughterhouses row carries the atlas's modelled facilities and livestock grid", /parts: true,/.test(src) && /abattoir_cafo\.pmtiles/.test(src) && /style=default/.test(src) && /TileCol=\{x\}&TileRow=\{y\}/.test(src));
+  check("the atlas's two modelled sets are rows of their own, beside the registered facilities",
+        !/parts: true,/.test(src) && /id:"abattoir_cafo"[^\n]*route:"cafo"/.test(src) && /id:"abattoir_glw"[^\n]*route:"glw"/.test(src) &&
+        /abattoir_cafo\.pmtiles/.test(src) && /style=default/.test(src) && /TileCol=\{x\}&TileRow=\{y\}/.test(src) &&
+        /name:"Registered animal-use facilities/.test(src));
   check("a page panel's close button hides it", /\.companion\[hidden\]\{display:none !important\}/.test(index));
   // The alert growing, run on a tiny tile.
   const fnSrc = src.slice(src.indexOf("function recolorAlerts("), src.indexOf("// latclip://"));
@@ -2052,6 +2054,21 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\nheading ticks, chips in words, a named archive");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const order = new Function(body + "; return PANEL_ORDER;")();
+  const at = (t) => order.findIndex((x) => x && x.t === t);
+  check("every heading takes a tick that shows or hides everything under it",
+        /all\.className = "toc-all"/.test(src) && /for \(const i of body\.querySelectorAll\("\[data-layer\]"\)\)/.test(src));
+  check("the tick reads its layers: all, none or part-way", /function syncHeadingBoxes\(box\)/.test(src) && /all\.indeterminate = on > 0 && on < boxes\.length/.test(src));
+  check("opening a heading and turning its layers on are separate controls", /all\.addEventListener\("click", \(e\) => e\.stopPropagation\(\)\)/.test(src));
+  check("the slaughter chips say what the registry said", /"registry does not say"/.test(src) && /labels\[v\] \|\| v/.test(src));
+  check("an archive that will not load names the file it asked for", /archive missing \(\$\{e\.message\}\) \\u2014 \$\{url\}/.test(src));
+  check("the three meat rows sit together under Meat", ["abattoir_facilities", "abattoir_cafo", "abattoir_glw"].every((i) => order.indexOf(i) > at("Meat") && order.indexOf(i) < at("Oceans")));
+}
+
 console.log("\nthe slick archive reads tiles where they exist");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
@@ -2092,8 +2109,9 @@ console.log("\nthe layers box, as asked for");
   const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
   const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
   const between = (id, a, b) => o.PANEL_ORDER.indexOf(id) > at(a) && o.PANEL_ORDER.indexOf(id) < at(b);
-  check("both fishing layers sit under Fishing, under Oceans", at("Oceans") < at("Fishing") &&
-        ["fishing", "slavery_fishing"].every((i) => between(i, "Fishing", "Oil slicks")));
+  check("the fishing-effort layer sits under Fishing, under Oceans, and the modelled one under Slavery",
+        at("Oceans") < at("Fishing") && between("fishing", "Fishing", "Oil slicks") &&
+        o.PANEL_ORDER.indexOf("slavery_fishing") > at("Slavery"));
   check("the reefs sit under Biodiversity loss, with the Global Safety Net at the top of it",
         between("allen_coral", "Biodiversity loss", "Mining") &&
         o.PANEL_ORDER[at("Biodiversity loss") + 1] === "gsn");
@@ -2116,7 +2134,7 @@ console.log("\nLive Projects to Resist, drawn here");
   const out = rows([{ name: "a", lat: 12, lng: 34 }, { name: "b", lat: "", lng: "" }, { name: "c", latitude: -1, longitude: 2 }]);
   check("a story with a position becomes a point, keeping its fields", out.length === 2 && out[0].geometry.coordinates[0] === 34 && out[0].properties.name === "a");
   check("a story with no position is left out rather than placed at 0,0", !out.some((f) => f.properties.name === "b"));
-  check("the guides sit under Construction, after the projects themselves", /\{ h: 3, t: "Construction" \}, "local_projects", "love_guides"/.test(src));
+  check("Construction holds the projects themselves", /\{ h: 3, t: "Construction" \}, "local_projects",/.test(src));
 }
 
 console.log("\nBuildings");
@@ -2240,9 +2258,10 @@ console.log("\nACGF removed; oil slicks grouped; the slick archive seen from afa
   const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
   const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
   check("ACGF is removed", o.PANEL_REMOVED.has("acgf") && !o.PANEL_ORDER.includes("acgf"));
-  check("the slick layers sit under Oil slicks, in Marine slicks and Terrestrial slicks", at("Oil slicks") < at("Marine slicks") &&
-        ["cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc"].every((i) => o.PANEL_ORDER.indexOf(i) > at("Marine slicks") && o.PANEL_ORDER.indexOf(i) < at("Terrestrial slicks")) &&
-        o.PANEL_ORDER.indexOf("skytruth_monitor") > at("Terrestrial slicks") && o.PANEL_ORDER.indexOf("skytruth_monitor") < at("Construction"));
+  check("Terrestrial slicks comes first, then Marine slicks with the four marine rows",
+        at("Oil slicks") < at("Terrestrial slicks") && at("Terrestrial slicks") < at("Marine slicks") &&
+        o.PANEL_ORDER.indexOf("skytruth_monitor") > at("Terrestrial slicks") && o.PANEL_ORDER.indexOf("skytruth_monitor") < at("Marine slicks") &&
+        ["cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc"].every((i) => o.PANEL_ORDER.indexOf(i) > at("Marine slicks") && o.PANEL_ORDER.indexOf(i) < at("Construction")));
   check("the slick archive draws a point per slick wider out", /id: `\$\{cfg\.id\}-pt`, type: "circle", source: `\$\{src\}-pt`, maxzoom: 7/.test(src));
 }
 
diff --git a/pipeline/shapes/registry.json b/pipeline/shapes/registry.json
index 16072ce..199ef33 100644
--- a/pipeline/shapes/registry.json
+++ b/pipeline/shapes/registry.json
@@ -284,6 +284,7 @@
   },
   {
    "id": "love_guides",
+   "retired": true,
    "group": "MORE_MAPS",
    "kind": "country_docs",
    "page": "https://welcometoyourgalaxy.github.io/local-map/index.html",
'''


def git(*args):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if "syncHeadingBoxes" in app:
        print("Already applied - nothing to do.")
        return
    if "showTiled" not in app:
        sys.exit("patch_1005.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
