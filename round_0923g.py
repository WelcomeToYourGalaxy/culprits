#!/usr/bin/env python3
"""
Round of 23 September (6): no grain over the map; a pulled layers box keeps its height; the news
wires' arrow on the right; the Atlas panel only a slider and a link, closing with its row; detail squares
for the Atlas plates; the HydroWASTE test passes on a sparse checkout. Needs round_0923f.py applied first.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 14d9093..835ec27 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -761,6 +761,26 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 23 September (5): the owner's notes on the map
+
+- **No grain.** The fixed-noise overlay (`glowGrain`) textured the whole map
+  whenever a point layer was on; `GLOW.grain` is 0 and the grain is never made.
+- **Pulling the layers box up** did nothing: `.left-col .panel{flex:1 1 auto}`
+  filled the column whatever height the pull set. A pulled box now gets
+  `flex:0 0 auto`; a double-click on the bar puts it back.
+- **The news wires' arrow** is at the right-hand end of its bar (`#wireEnd`);
+  the title still opens and closes the box.
+- **Atlas for the End of the World**: the panel holds only the see-through
+  slider and a link to the Atlas's page. It closes, and the plate goes, when
+  the row that opened it is unticked (`atlasOwner`, checked in
+  `applyVisibility`). For detail close in, `atlas_plates.py` also draws each
+  placed page at four times the size in a 4 x 4 grid, each square placed by
+  the page's own fit (`plates.json` `detail`); the map adds the squares on
+  screen once the view is closer than the whole plate. Re-run
+  `pipeline/atlas_plates.py` to make them (the look-ups are cached).
+- The HydroWASTE archive test accepts a sparse checkout, which leaves
+  `map/tiles` out, so the suite passes on the owner's Mac and `&&` chains run.
+
 ## Round of 23 September (2): the Global Wastewater Model from its data package
 
 `pipeline/wastewater_inspect.py` showed the N package holds pour points
diff --git a/map/app.js b/map/app.js
index 964d261..db51b7b 100644
--- a/map/app.js
+++ b/map/app.js
@@ -1388,7 +1388,7 @@ const GLOW = {
   hazeOpacity: 0.3,                            // very faint: the soft spread only
   core: (w) => ["interpolate", ["linear"], ["sqrt", w], 0, "#6E4A6A", 0.45, "#B07087", 0.8, "#D9B8BF", 1, "#E8DFD0"],
   grainSatellite: 0,                           // the grain over the Satellite basemap, where there is no glow
-  grain: 0.3,                                  // the grain's strength over the light
+  grain: 0,                                    // no grain: it textured the whole map, not the dots (taken out 23 September)
   fadeOut: 9, gone: 12,                        // haze and cores: full to 9, gone by 12; the dots the other way
 };
 const glowMaxOf = new Map();                   // source id -> the largest "value" in it, from the archive's own stats
@@ -1457,6 +1457,9 @@ function addHud(layer, rawAddLayer) {
 // leaves near-black almost untouched and textures the lit parts most. It
 // fades with the haze and cores, and is off when no glow layer is showing.
 function glowGrain() {
+  // The owner did not want the whole map gritty when a layer is on; with both
+  // strengths at 0 the grain is never made at all.
+  if (!GLOW.grain && !GLOW.grainSatellite) return;
   if (glowGrain.el || typeof document === "undefined" || !map.getCanvas) return;
   const n = 256, c = document.createElement("canvas");
   c.width = c.height = n;
@@ -3950,83 +3953,89 @@ function geometryBounds(g) {
   if (g && g.coordinates) walk(g.coordinates);
   return isFinite(w) ? [[w, s], [e, n]] : null;
 }
+// The panel holds only what the owner asked for (23 September): the slider
+// between the Atlas's map and this one, and a link to the Atlas's own page.
+// It closes, and the plate goes, when the Atlas row is unticked.
+let atlasOwner = null;                 // the row whose box opened it
+const atlasLayers = () => (map.getStyle && map.getStyle() ? map.getStyle().layers : []).map((l) => l.id).filter((id) => /^atlas-plate/.test(id));
 function atlasPanel() {
   let el = document.getElementById("atlas-panel");
   if (el) return el;
   el = document.createElement("div");
   el.id = "atlas-panel";
   el.hidden = true;
-  el.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:min(620px,62vw);max-height:62vh;z-index:45;" +
-    "display:flex;flex-direction:column;background:var(--peat,#17150F);border:1px solid var(--rule,#322E27);border-radius:3px;" +
-    "box-shadow:0 8px 30px rgba(0,0,0,.5);font-size:12.5px;color:var(--dim)";
-  el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px 4px">` +
-      `<b class="ap-title" style="color:var(--bone);font-weight:600"></b><span style="margin-left:auto"></span>` +
-      `<a class="ap-open" target="_blank" rel="noopener" title="Only if the pages stay blank: the Atlas's site may not allow being shown inside another page" ` +
-      `style="color:var(--slate,#8A9DA6);font-size:11.5px">open \u2197</a>` +
-      `<button type="button" class="ap-pages" style="font:inherit;background:none;color:var(--dim);border:1px solid var(--rule);border-radius:2px;padding:1px 7px;cursor:pointer">pages</button>` +
-      `<button type="button" class="ap-close" style="font:inherit;background:none;color:var(--dim);border:1px solid var(--rule);border-radius:2px;padding:1px 7px;cursor:pointer">close</button></div>` +
-    `<div class="ap-said" style="padding:0 10px 4px;font-size:11.5px"></div>` +
-    `<label class="ap-fade" style="display:flex;gap:8px;align-items:center;padding:0 10px 7px;font-size:11.5px">` +
-      `the Atlas's map <input type="range" min="0" max="100" value="85" style="flex:1"> this map</label>` +
-    `<iframe class="ap-frame" title="The Atlas's pages" hidden style="flex:1;min-height:40vh;width:100%;border:0;border-top:1px solid var(--rule)"></iframe>`;
+  el.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:min(420px,70vw);z-index:45;" +
+    "display:flex;align-items:center;gap:12px;padding:7px 12px;background:var(--peat,#17150F);border:1px solid var(--rule,#322E27);" +
+    "border-radius:3px;box-shadow:0 8px 30px rgba(0,0,0,.5);font-size:12px;color:var(--dim)";
+  el.innerHTML = `<label class="ap-fade" style="display:flex;gap:8px;align-items:center;flex:1">` +
+      `<input type="range" min="0" max="100" value="15" style="flex:1" aria-label="See through the Atlas's map"></label>` +
+    `<a class="ap-open" target="_blank" rel="noopener" style="color:var(--slate,#8A9DA6);white-space:nowrap">the Atlas's page \u2197</a>`;
   document.body.appendChild(el);
-  const frame = el.querySelector(".ap-frame");
-  el.querySelector(".ap-pages").addEventListener("click", () => {
-    frame.hidden = !frame.hidden;
-    if (!frame.hidden && frame.dataset.src && frame.src !== frame.dataset.src) frame.src = frame.dataset.src;
-  });
-  el.querySelector(".ap-close").addEventListener("click", atlasPlateOff);
   el.querySelector(".ap-fade input").addEventListener("input", (e) => {
-    if (map.getLayer("atlas-plate")) map.setPaintProperty("atlas-plate", "raster-opacity", 1 - Number(e.target.value) / 100 + 0.0);
+    for (const id of atlasLayers()) map.setPaintProperty(id, "raster-opacity", 1 - Number(e.target.value) / 100);
   });
   return el;
 }
 function atlasPlateOff() {
-  if (map.getLayer("atlas-plate")) map.removeLayer("atlas-plate");
-  if (map.getSource("atlas-plate")) map.removeSource("atlas-plate");
+  for (const id of atlasLayers()) { map.removeLayer(id); if (map.getSource(id)) map.removeSource(id); }
+  if (atlasPlateOff.move) { map.off("moveend", atlasPlateOff.move); atlasPlateOff.move = null; }
+  atlasOwner = null;
   const el = document.getElementById("atlas-panel");
-  if (el) { el.hidden = true; const f = el.querySelector(".ap-frame"); f.hidden = true; f.removeAttribute("src"); }
-}
-// what: { plate, doc, title } for a hotspot, { page, title } for a city;
-// bounds: the hotspot's own outline, used when there is no placed plate.
-async function showAtlas(what, bounds) {
+  if (el) el.hidden = true;
+}
+// Close in, the page's detail: plates.json can give a plate in squares drawn
+// from the page at four times the resolution (pipeline/atlas_plates.py). The
+// squares on screen are added once the view is closer than the whole plate,
+// the rest only as the view reaches them.
+function atlasDetail(p, fitZoom) {
+  const detail = Array.isArray(p.detail) ? p.detail : [];
+  if (!detail.length) return;
+  const opacity = () => { const i = document.querySelector("#atlas-panel .ap-fade input"); return i ? 1 - Number(i.value) / 100 : 0.85; };
+  const add = () => {
+    if (map.getZoom() < fitZoom + 1) return;
+    const b = map.getBounds();
+    detail.forEach((d, i) => {
+      const id = `atlas-plate-d${i}`;
+      if (map.getSource(id)) return;
+      const lons = d.corners.map((c) => c[0]), lats = d.corners.map((c) => c[1]);
+      if (Math.max(...lons) < b.getWest() || Math.min(...lons) > b.getEast() || Math.max(...lats) < b.getSouth() || Math.min(...lats) > b.getNorth()) return;
+      map.addSource(id, { type: "image", url: abs("./" + d.image), coordinates: d.corners });
+      map.addLayer({ id, type: "raster", source: id, minzoom: fitZoom + 1, paint: { "raster-opacity": opacity(), "raster-fade-duration": 0 } });
+    });
+  };
+  atlasPlateOff.move = add;
+  map.on("moveend", add);
+}
+// what: { plate, doc } for a hotspot, { page } for a city; bounds: the
+// hotspot's own outline, used when there is no placed plate.
+async function showAtlas(what, bounds, owner) {
+  atlasPlateOff();
+  atlasOwner = owner || null;
   const el = atlasPanel();
-  const frame = el.querySelector(".ap-frame");
-  el.querySelector(".ap-title").textContent = what.title || "Atlas for the End of the World";
-  frame.dataset.src = what.doc || what.page || "";
-  el.querySelector(".ap-open").href = frame.dataset.src;
-  frame.hidden = !what.page;                       // a city's page opens at once; a hotspot's pages on asking
-  if (!frame.hidden) frame.src = frame.dataset.src;
-  const said = el.querySelector(".ap-said"), fade = el.querySelector(".ap-fade");
+  el.querySelector(".ap-open").href = what.doc || what.page || "#";
+  const fade = el.querySelector(".ap-fade");
   fade.hidden = true;
-  if (map.getLayer("atlas-plate")) map.removeLayer("atlas-plate");
-  if (map.getSource("atlas-plate")) map.removeSource("atlas-plate");
   el.hidden = false;
-  if (!what.plate) {
-    said.textContent = "The Atlas's own page for this city. Its maps carry no named places to fit them by, so they are shown here rather than laid on the map.";
-    return;
-  }
+  if (!what.plate) return;
   const p = (await atlasPlatesRead())[what.plate];
   if (p && p.kept && p.image && Array.isArray(p.corners) && p.corners.length === 4) {
     map.addSource("atlas-plate", { type: "image", url: abs("./" + p.image), coordinates: p.corners });
     map.addLayer({ id: "atlas-plate", type: "raster", source: "atlas-plate", paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 } });
     fade.hidden = false;
     fade.querySelector("input").value = 15;
-    said.textContent = `The first page of the Atlas's PDF, placed by the ${p.names.length} towns named on it: ` +
-      `they sit on average ${p.error_km} km from where OpenStreetMap has them, on a plate ${p.width_km} km across. ` +
-      `The key and title on the page are drawn with it.`;
     const lons = p.corners.map((c) => c[0]), lats = p.corners.map((c) => c[1]);
-    if (typeof map.fitBounds === "function") map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 30, duration: 1400 });
+    const box = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
+    const fit = typeof map.cameraForBounds === "function" ? map.cameraForBounds(box, { padding: 30 }) : null;
+    atlasDetail(p, fit && Number.isFinite(fit.zoom) ? fit.zoom : 4);
+    if (typeof map.fitBounds === "function") map.fitBounds(box, { padding: 30, duration: 1400 });
     return;
   }
-  said.textContent = p && p.reason ? `The Atlas's map is not laid on this one: ${p.reason}. Its pages are under pages.`
-    : "The Atlas's map has not been placed yet (pipeline/atlas_plates.py). Its pages are under pages.";
   if (bounds && typeof map.fitBounds === "function") map.fitBounds(bounds, { padding: 30, duration: 1400 });
 }
-function atlasFrom(btn, bounds) {
+function atlasFrom(btn, bounds, owner) {
   const d = btn.dataset;
-  if (d.atlasPlate) showAtlas({ plate: d.atlasPlate, doc: d.atlasDoc, title: d.atlasTitle }, bounds);
-  else if (d.atlasPage) showAtlas({ page: d.atlasPage, title: d.atlasTitle }, bounds);
+  if (d.atlasPlate) showAtlas({ plate: d.atlasPlate, doc: d.atlasDoc }, bounds, owner);
+  else if (d.atlasPage) showAtlas({ page: d.atlasPage }, bounds, owner);
 }
 
 // The Atlas's cities, placed from the weekly lookup of their names.
@@ -6364,6 +6373,10 @@ function makePullable(el, edge) {
   const move = (e) => {
     const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : from);
     el.style.maxHeight = "none";
+    // The layers box grows to fill its column (flex 1 1 auto), which undid any
+    // height the pull set: pulled up, it did not get shorter and its bar stayed
+    // put. A pulled box keeps the height it is pulled to (23 September).
+    el.style.flex = "0 0 auto";
     const h = pullHeight(height, y - from, edge, PULL_MIN, ceiling());
     el.style.height = h + "px";
     settle(h);
@@ -6379,7 +6392,7 @@ function makePullable(el, edge) {
     document.addEventListener("pointermove", move);
     document.addEventListener("pointerup", stop);
   });
-  grip.addEventListener("dblclick", () => { el.style.height = ""; el.style.maxHeight = ""; settle(999); });
+  grip.addEventListener("dblclick", () => { el.style.height = ""; el.style.maxHeight = ""; el.style.flex = ""; settle(999); });
 }
 
 // The news wires box is built by wire.js, which runs after this file.
@@ -7877,11 +7890,11 @@ async function openSitemapBox(hit, at) {
       const x = ev.target.closest && ev.target.closest(".leaflet-popup-close-button");
       if (x) { ev.preventDefault(); popup.remove(); }
       const a = ev.target.closest && ev.target.closest(".atlas-show");
-      if (a) { ev.preventDefault(); atlasFrom(a, geometryBounds(hit.geometry)); }
+      if (a) { ev.preventDefault(); atlasFrom(a, geometryBounds(hit.geometry), hit.cfg.id); }
     });
     // An Atlas hotspot or city shows its own map or page as soon as it is opened.
     const auto = el.querySelector && el.querySelector("[data-atlas-auto]");
-    if (auto) atlasFrom(auto, geometryBounds(hit.geometry));
+    if (auto) atlasFrom(auto, geometryBounds(hit.geometry), hit.cfg.id);
   }
 }
 
@@ -8240,6 +8253,8 @@ const visibility = new Map(LAYERS.filter((c) => c.off).map((c) => [c.id, "none"]
 
 function applyVisibility(id) {
   const vis = visibility.get(id) || "visible";
+  // An Atlas row unticked takes its map and its panel with it.
+  if (vis !== "visible" && typeof atlasOwner !== "undefined" && atlasOwner === id) atlasPlateOff();
   [`${id}-agg`, `${id}-cl`, `${id}-pt`, `${id}-fill`, `${id}-line`, `${id}-raster`, `${id}-world`, `${id}-cap`].forEach((l) => {
     if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
   });
diff --git a/map/test.mjs b/map/test.mjs
index 60dfe85..4fbb888 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2578,9 +2578,8 @@ console.log("\nOff-planet sections, Of groups, names, launch links, drag bar, ma
   check("\u2026the cores are small specks, the haze faint and never brighter than rose, the dots soft-edged and unseen wider out",
         /"circle-radius": z\(0, \["\*", 0\.8, lift\]/.test(src) && /hazeOpacity: 0\.3,/.test(src) && /1, "rgba\(176,112,135,0\.6\)"\]/.test(src) &&
         /paint\(layer\.id, "circle-blur", 1\)/.test(src) && /z\(GLOW\.fadeOut, 0, GLOW\.gone, 0\.9\)/.test(src));
-  check("\u2026the grain is one noise image from a set seed, made once and held still",
-        /let seed = 0x2F6B4A1D;/.test(src) && /if \(glowGrain\.el \|\| typeof document/.test(src) && /mix-blend-mode:soft-light/.test(src) &&
-        !/glowGrain[\s\S]{0,1200}Math\.random/.test(src.slice(src.indexOf("function glowGrain()"), src.indexOf("function glowGrainSync()"))));
+  check("\u2026no grain over the map: its strength is 0 and it is never made (23 September)",
+        /grain: 0,\s/.test(src) && /if \(!GLOW\.grain && !GLOW\.grainSatellite\) return;/.test(src));
   check("\u2026planetary defence does not pulse the glow's own layers", /if \(\/-\(halo\|haze\|core\|soft\)\$\/\.test\(lid\)\) continue;/.test(src));
   {
     const G = new Function("mapOutputs", src.slice(src.indexOf("const GLOW = {"), src.indexOf("function addHud(layer, rawAddLayer)")) + "; return { GLOW, glowWeight, glowMaxOf };")((v) => v);
@@ -2623,7 +2622,10 @@ console.log("\nGuerillamap panel, Pollution, the releases split");
 console.log("\nHydroWASTE on the map; the EIP and HydroFATE page rows gone");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
-  check("HydroWASTE's plants are drawn from their own archive", /id:"hydrowaste", +name:"Wastewater treatment plants \(HydroWASTE\)"[^\n]*route:"pmtiles"/.test(src) && fs.existsSync(path.join(HERE, "tiles", "hydrowaste.pmtiles")));
+  check("HydroWASTE's plants are drawn from their own archive", /id:"hydrowaste", +name:"Wastewater treatment plants \(HydroWASTE\)"[^\n]*route:"pmtiles"/.test(src) &&
+        // A sparse checkout (the owner's Mac leaves map/tiles out) has no archives
+        // to look at; the file is on GitHub. Anywhere else it must be there.
+        (fs.existsSync(path.join(HERE, "tiles", "hydrowaste.pmtiles")) || fs.existsSync(path.join(HERE, "..", ".git", "info", "sparse-checkout"))));
   check("the Environmental Integrity Project and HydroFATE page rows are gone", !/id: "eip_inventory"/.test(src) && !/id: "hydrofate"/.test(src));
 }
 
@@ -3192,9 +3194,8 @@ console.log("\nthe Atlas's own maps, on this map (22 September)");
         /data-atlas-auto="1" data-atlas-plate=/.test(src) && !/Open the Atlas's PDF:/.test(src) && !/Open the Atlas's page for this city<\/a>/.test(src));
   check("opening an Atlas place zooms to it and lays its placed plate over the map, as an image at the plate's four corners",
         /map\.addSource\("atlas-plate", \{ type: "image", url: abs\("\.\/" \+ p\.image\), coordinates: p\.corners \}\)/.test(src) &&
-        /if \(auto\) atlasFrom\(auto, geometryBounds\(hit\.geometry\)\);/.test(src));
-  check("a plate is laid only when it was placed well enough, and says how far off its towns are",
-        /p && p\.kept && p\.image/.test(src) && /\$\{p\.error_km\} km/.test(src));
+        /if \(auto\) atlasFrom\(auto, geometryBounds\(hit\.geometry\), hit\.cfg\.id\);/.test(src));
+  check("a plate is laid only when it was placed well enough", /p && p\.kept && p\.image/.test(src));
   const gb = new Function(src.slice(src.indexOf("function geometryBounds("), src.indexOf("function atlasPanel(")) + "; return geometryBounds;")();
   const b = gb({ type: "MultiPolygon", coordinates: [[[[-50, -20], [-40, -20], [-40, -10], [-50, -20]]], [[[-60, -25], [-55, -25], [-55, -22], [-60, -25]]]] });
   check("with no plate, the map zooms to the hotspot's own outline", JSON.stringify(b) === JSON.stringify([[-60, -25], [-40, -10]]));
@@ -3302,5 +3303,23 @@ console.log("\nround of 23 September (4): the wastewater archives made small eno
         ["tot", "treated", "septic", "open"].every((k) => new RegExp(`wastewater_n_${k}\\.pmtiles",\\n    boxes: "https://welcometoyourgalaxy\\.github\\.io/culprits-tiles-more/wastewater/pieces"`).test(src)));
   check("\u2026and its working files are removed as it goes", /path\.unlink\(missing_ok=True\)/.test(py) && /work\.rmdir\(\)/.test(py));
 }
+console.log("\nround of 23 September (5): the Atlas panel pared down; no grain; the boxes' bars");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const wire = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
+  const panel = src.slice(src.indexOf("function atlasPanel() {"), src.indexOf("function atlasPlateOff() {"));
+  check("the Atlas panel holds only the see-through slider and the link to the Atlas's page",
+        /class="ap-fade"/.test(panel) && /class="ap-open"/.test(panel) && !/ap-pages|ap-close|ap-said|ap-title|iframe/.test(panel));
+  check("\u2026and unticking the Atlas row closes it and takes the plate away",
+        /if \(vis !== "visible" && typeof atlasOwner !== "undefined" && atlasOwner === id\) atlasPlateOff\(\);/.test(src));
+  check("\u2026close in, the page's detail squares are added for what is on screen, once closer than the whole plate",
+        /function atlasDetail\(p, fitZoom\)/.test(src) && /minzoom: fitZoom \+ 1/.test(src));
+  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "atlas_plates.py"), "utf8");
+  check("\u2026the detail squares are drawn from the PDF at four times the size, each placed by the page's own fit",
+        /DETAIL_SCALE = 4/.test(py) && /"detail"/.test(py));
+  check("a pulled box keeps the height it is pulled to, the layers box included", /el\.style\.flex = "0 0 auto";/.test(src));
+  check("the news wires' open-and-shut arrow sits at the right-hand end of the bar",
+        /id="wireEnd"/.test(wire) && /\.wire-toggle \.wire-caret\{display:none\}/.test(wire));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
diff --git a/map/wire.js b/map/wire.js
index 359a182..35d0a3a 100644
--- a/map/wire.js
+++ b/map/wire.js
@@ -675,6 +675,8 @@ const CSS = `
 .wire.open .wire-caret{transform:rotate(90deg)}
 .wire-sum{display:none}
 .wire-onmap{margin-left:auto}
+.wire-toggle .wire-caret{display:none}
+.wire-end{background:none;border:0;padding:4px 2px 4px 6px;cursor:pointer;display:flex;align-items:center}
 .wire-onmap{display:flex;align-items:center;gap:5px;color:var(--dim,#948D7C);font-size:12px;
   white-space:nowrap;cursor:pointer}
 .wire-onmap input{accent-color:var(--moss,#62755F)}
@@ -785,6 +787,10 @@ function build() {
       '<span class="wire-sum" id="wireSum" aria-live="polite"></span>' +
       '<label class="wire-onmap" title="Draw the stories that name a place on the map">' +
         '<input type="checkbox" id="wireOnMap" checked> show them on the map</label>' +
+      // The box's open-and-shut arrow, at the right-hand end of its bar
+      // (moved from the left, 23 September); the title still opens it too.
+      '<button type="button" class="wire-end" id="wireEnd" aria-label="Open or close the news wires" aria-controls="wireBody">' +
+        '<span class="wire-caret" aria-hidden="true"></span></button>' +
     '</div>' +
     '<div class="wire-body" id="wireBody" hidden>' +
       '<div class="wire-tools"><div class="wire-search">' +
@@ -833,6 +839,7 @@ function build() {
   $when.value = state.when;
 
   $toggle.addEventListener('click', () => setOpen(!state.open));
+  box.querySelector('#wireEnd').addEventListener('click', () => setOpen(!state.open));
   if ($onMap) $onMap.addEventListener('change', () => { state.onMap = $onMap.checked; save(); renderList(); });
   $pickBtn.addEventListener('click', () => { state.pickerOpen = !state.pickerOpen; renderPicker(); layout(); });
   document.addEventListener('click', (e) => {
diff --git a/pipeline/atlas_plates.py b/pipeline/atlas_plates.py
index 58c03b7..6c18275 100644
--- a/pipeline/atlas_plates.py
+++ b/pipeline/atlas_plates.py
@@ -69,6 +69,11 @@ MIN_AGREE = 5            # names that must agree on the placement
 MAX_ERROR_SHARE = 0.03   # typical error no more than 3% of the plate's width
 TRIES = 4000             # random sets of three tried
 IMAGE_WIDTH = 2400       # pixels across the drawn page
+# Close in, the page is also drawn at four times that, cut into a grid of
+# squares, each placed by the same fit: the PDF is drawn in lines, so this keeps
+# its detail when the map is zoomed in (asked for 23 September).
+DETAIL_SCALE = 4
+DETAIL_GRID = 4
 
 # Words on the plates that are the key, the title or the figures, never places.
 NOT_PLACES = {
@@ -200,7 +205,7 @@ def place_page(labels, width_pt, height_pt, seed=0):
     return {"kept": kept, "reason": "" if kept else f"typical error {rms:.0f} km is more than {MAX_ERROR_SHARE:.0%} of the plate's {span_km:.0f} km",
             "corners": [[round(lon, 5), round(lat, 5)] for lon, lat in corners],
             "error_km": round(rms, 1), "width_km": round(span_km), "names": sorted(n for _, n in errs),
-            "worst": sorted(errs, reverse=True)[:3]}
+            "worst": sorted(errs, reverse=True)[:3], "affine": T}
 
 
 def geocode(name, cache, session):
@@ -263,12 +268,28 @@ def main(only):
         got = got or {"kept": False, "reason": "fewer than three names on the page could be found"}
         entry = {"title": title, "pdf": PDF_BASE + slug + ".pdf", "labels": len(labels), **got}
         entry.pop("worst", None)
+        T = entry.pop("affine", None)
         if got.get("kept"):
             zoom = IMAGE_WIDTH / w
             pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
             img = Image.open(io.BytesIO(pix.tobytes("png")))
             img.save(OUT / "plates" / f"{slug}.webp", "WEBP", quality=80)
             entry["image"] = f"atlas/plates/{slug}.webp"
+            # The detail squares: each a part of the page, drawn at four times
+            # the size, and placed by the page's own fit at its four corners.
+            ddir = OUT / "plates" / slug
+            ddir.mkdir(parents=True, exist_ok=True)
+            dzoom = zoom * DETAIL_SCALE
+            entry["detail"] = []
+            for r in range(DETAIL_GRID):
+                for c in range(DETAIL_GRID):
+                    x0, x1 = w * c / DETAIL_GRID, w * (c + 1) / DETAIL_GRID
+                    y0, y1 = h * r / DETAIL_GRID, h * (r + 1) / DETAIL_GRID
+                    part = page.get_pixmap(matrix=pymupdf.Matrix(dzoom, dzoom), clip=pymupdf.Rect(x0, y0, x1, y1), alpha=False)
+                    Image.open(io.BytesIO(part.tobytes("png"))).save(ddir / f"d{r}{c}.webp", "WEBP", quality=80)
+                    corners = [unmerc(*apply(T, x, y)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
+                    entry["detail"].append({"image": f"atlas/plates/{slug}/d{r}{c}.webp",
+                                            "corners": [[round(lon, 5), round(lat, 5)] for lon, lat in corners]})
         plates[slug] = entry
         say = f"placed, {len(got['names'])} names agree, typical error {got['error_km']} km on a {got['width_km']} km plate" if got.get("kept") else f"not placed: {got['reason']}"
         print(f"{slug}: {say}")
'''

if "mollweide_inverse" not in (pathlib.Path.cwd() / "pipeline/wastewater_build.py").read_text() if (pathlib.Path.cwd() / "pipeline/wastewater_build.py").exists() else True:
    sys.exit("round_0923d.py has to be applied first; nothing was changed.")
wb = pathlib.Path.cwd() / "pipeline/wastewater_build.py"
if not wb.exists() or "def piece_of" not in wb.read_text():
    sys.exit("round_0923f.py has to be applied first; nothing was changed.")
if not (pathlib.Path.cwd() / "map/app.js").exists():
    sys.exit("Run this from the culprits-tiles-more folder (scripts/trase.py not found here).")
with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False) as f:
    f.write(DIFF)
    patch = f.name
def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)
if git("apply", "--check", "--reverse", patch).returncode == 0 or git("apply", "--check", "--reverse", "-C1", patch).returncode == 0:
    sys.exit("Already applied: nothing to do.")
check = git("apply", "--check", patch)
if check.returncode == 0:
    done = git("apply", patch)
    if done.returncode != 0:
        sys.exit(done.stderr)
else:
    # Edits in the working files not yet committed (another session's): fit
    # the change by one line of context either side instead of three, which
    # finds its place when those edits sit next to it. Nothing is changed if
    # even that does not fit.
    three = git("apply", "-C1", patch)
    if three.returncode != 0:
        touched = sorted(set(l[6:] for l in DIFF.splitlines() if l.startswith("+++ b/")))
        st = git("status", "--short", "--", *touched).stdout
        sys.exit("This patch does not fit the files on disk, so nothing was changed.\n" + check.stderr +
                 "\nFiles it touches that differ from the last commit on this Mac:\n" + (st or "  (none)\n") +
                 "Paste this message back.")
    print(three.stderr.strip())
print("Applied.")
