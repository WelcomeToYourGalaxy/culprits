#!/usr/bin/env python3
"""
The layers box as asked: headings, titles, one fold control per row; the mines
drawn only where their tiles hold something; the Satellite view toned down.

Run from the repo root:  python3 patch_1003.py

Needs patch_1002.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js       Oceans holds Fishing and Oil slicks; Oil slicks holds Marine
                   slicks (Cerulean's three rows and vessels of concern) and
                   Terrestrial slicks (SkyTruth Monitor). The reefs move to
                   Biodiversity loss, which now leads with the Global Safety
                   Net. Agriculture becomes Meat and agriculture, holding
                   Agriculture and Meat. The Power BI row is named
                   Environmental Crime Tracker.
                   One fold control on every row, ticked or not, groups
                   included.
                   The mines' outlines draw from zoom 7 and their points stop
                   at 9, so the map stops asking for tiles that hold nothing
                   for them.
                   The Satellite view holds still: steady halos, no breathing.
  map/index.html   No scan line; finer corner brackets; a quieter click ring.
  map/test.mjs     Checks for all of it.
  HANDOFF.md       What the headings now say, and what the view no longer does.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index c41702a..709f0ac 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -83,6 +83,27 @@ Worker: `https://culprits-proxy.welcometoyourgalaxy.workers.dev`
 
 ---
 
+## The layers box, as it is asked to read
+
+Headings carry the meaning, so they are changed rather than worked around:
+Oceans holds Fishing (both fishing layers, whose titles say how they differ)
+and Oil slicks, which holds Marine slicks (Cerulean's three rows and SkyTruth's
+vessels of concern) and Terrestrial slicks (the SkyTruth Monitor row).
+Biodiversity loss leads with the Global Safety Net and holds the reefs.
+Agriculture is Meat and agriculture, holding Agriculture (the national shading)
+and Meat (the slaughterhouse rows).
+
+Every row has one fold control at its end, ticked or not, groups included: on a
+group's parent row it works the disclosure triangle, so the arrow means the
+same thing wherever it appears.
+
+The Satellite view was toned down: no scan line sweeping the screen, halos held
+steady instead of pulsing, the protected areas lifted once rather than
+breathing, finer corner brackets, a quieter click ring. Its timer now only
+notices rows being ticked.
+
+---
+
 ## Live Projects to Resist, drawn here rather than opened beside
 
 Its panel row is gone. Three rows under Construction carry what the panel
diff --git a/map/app.js b/map/app.js
index 35e4e49..dca63fd 100644
--- a/map/app.js
+++ b/map/app.js
@@ -1677,16 +1677,17 @@ function setBasemap(kind) {
 // Only on the Satellite imagery basemap. The imagery stays the photograph; on
 // top of it:
 //   - a livelier grade (BASE_GRADE.satellite) and a teal atmosphere;
-//   - a thin frame at the screen's edges, a faint vignette and a slow scan line
-//     (index.html, #defence-hud), none of which take clicks;
-//   - every ticked layer under Destruction whose places are points gets a slow
-//     red pulse beneath its own points: a threat zone at each real site, never a
-//     place the layer does not give;
-//   - Global Safety Net's areas (the places identified for protection) breathe
-//     slowly brighter and back;
+//   - a fine frame at the screen's edges and a faint vignette (index.html,
+//     #defence-hud), neither of which takes clicks;
+//   - every ticked layer under Destruction whose places are points gets a soft
+//     red halo beneath its own points, held steady: a threat zone at each real
+//     site, never a place the layer does not give;
+//   - Global Safety Net's areas (the places identified for protection) sit a
+//     little brighter than the imagery around them;
 //   - a click answers with a ring where it landed.
-// Nothing is invented: no scores, no places, no numbers. Motion stops for
-// anyone whose system asks for reduced motion.
+// Nothing is invented: no scores, no places, no numbers. The only thing that
+// moves is the ring a click leaves, and that stops for anyone whose system asks
+// for reduced motion.
 const DEFENCE = {
   threat: "#B8473E",
   sky: { "sky-color": "#0B1A22", "horizon-color": "#2F8F93", "fog-color": "#2F8F93",
@@ -1725,7 +1726,7 @@ function ensureHalo(lid) {
   if (map.getLayer(hid)) return hid;
   const l = map.getLayer(lid);
   const spec = { id: hid, type: "circle", source: l.source,
-    paint: { "circle-color": DEFENCE.threat, "circle-blur": 0.85, "circle-opacity": 0,
+    paint: { "circle-color": DEFENCE.threat, "circle-blur": 1, "circle-opacity": 0,
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 6, 8, 11, 14, 16] } };
   if (l.sourceLayer) spec["source-layer"] = l.sourceLayer;
   // Only at the zooms its layer draws at.
@@ -1738,9 +1739,11 @@ function ensureHalo(lid) {
 }
 function defenceTick() {
   if (!DEFENCE_ON) return;
-  const t = (Date.now() % 2800) / 2800;           // one pulse every 2.8 s
-  const still = reducedMotion();
   const live = new Set();
+  // Steady, not throbbing. A pulse that grew and faded every 2.8 seconds read
+  // as an arcade screen rather than an instrument, and it kept the map
+  // redrawing while nothing on it had changed. Each threatened point keeps one
+  // soft halo at a fixed size and a low opacity; what moves is the map.
   for (const lid of defenceHalos()) {
     const hid = ensureHalo(lid);
     if (!hid) continue;
@@ -1748,20 +1751,20 @@ function defenceTick() {
     map.setLayoutProperty(hid, "visibility", "visible");
     const f = map.getFilter(lid);
     map.setFilter(hid, f || null);
-    const grow = still ? 0.5 : t;
-    map.setPaintProperty(hid, "circle-opacity", still ? 0.28 : 0.42 * (1 - grow));
+    map.setPaintProperty(hid, "circle-opacity", 0.22);
     map.setPaintProperty(hid, "circle-radius", ["interpolate", ["linear"], ["zoom"],
-      1, 3 + 7 * grow, 8, 6 + 10 * grow, 14, 9 + 14 * grow]);
+      1, 5, 8, 9, 14, 13]);
   }
   for (const l of map.getStyle().layers || []) {
     if (l.id.endsWith("-halo") && !live.has(l.id)) map.setLayoutProperty(l.id, "visibility", "none");
   }
+  // The places identified for protection are lifted a little out of the
+  // imagery and left there, rather than breathing in and out.
   for (const row of DEFENCE.guard) {
     if ((visibility.get(row) || "none") !== "visible") continue;
-    const k = still ? 0.5 : 0.5 + 0.5 * Math.sin(Date.now() / 1400);
     for (const lid of layersOfRow(row)) {
       const l = map.getLayer(lid);
-      if (l && l.type === "raster") map.setPaintProperty(lid, "raster-brightness-min", 0.05 + 0.13 * k);
+      if (l && l.type === "raster") map.setPaintProperty(lid, "raster-brightness-min", 0.11);
     }
   }
 }
@@ -1776,7 +1779,9 @@ function defenceMode(on) {
       map.setSky(Object.assign({}, defenceSky || {}, DEFENCE.sky));
     } else if (defenceSky) { map.setSky(defenceSky); defenceSky = null; }
   }
-  if (on && !defenceTimer) defenceTimer = setInterval(defenceTick, 90);
+  // Nothing animates any more, so this only has to notice a row being ticked
+  // or unticked: twice a second instead of eleven times.
+  if (on && !defenceTimer) { defenceTick(); defenceTimer = setInterval(defenceTick, 500); }
   if (!on && defenceTimer) {
     clearInterval(defenceTimer);
     defenceTimer = null;
@@ -2981,9 +2986,15 @@ function traseBox(cfg, props) {
 function addPmShapesLayer(cfg) {
   const src = `${cfg.id}-pm`;
   map.addSource(src, { type: "vector", url: `pmtiles://${cfg.archiveUrl}`, attribution: cfg.attribution || "" });
+  // Each part only where its own tiles hold anything: the outlines are tiled
+  // from zoom 7 and the points to zoom 8. Without these bounds MapLibre keeps
+  // asking for, and stretching, tiles that carry nothing for the layer, which
+  // is most of the wait on a 72 MB archive.
   map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: src, "source-layer": cfg.polygonLayer,
+    minzoom: cfg.polygonFrom != null ? cfg.polygonFrom : 7,
     paint: { "fill-color": cfg.colour, "fill-opacity": 0.55, "fill-outline-color": "#1D1B17" } });
   map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, "source-layer": cfg.pointLayer,
+    maxzoom: cfg.pointTo != null ? cfg.pointTo : 9,
     paint: { "circle-color": cfg.colour,
              // Merged points carry how many mines they stand for (point_count).
              "circle-radius": ["interpolate", ["linear"], ["zoom"],
@@ -6807,7 +6818,7 @@ const OTHER_MAPS = {
     { id: "pe_subsidising", name: "Portfolio Earth: Subsidising Extinction", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
       page: "https://portfolio.earth/campaigns/subsidising-extinction/",
       note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
-    { id: "powerbi_report", name: "Power BI report (Destruction page)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
+    { id: "powerbi_report", name: "Environmental Crime Tracker", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
       page: "https://app.powerbi.com/view?r=eyJrIjoiZGJmNGIwODgtMTgyMS00NmVlLWJmNWUtZTAzZDBlMmQ1ODI2IiwidCI6IjBiMzNkZjAwLTYzNGMtNDBlYy1iOGQ5LTZhMGI2MjYyNmU1ZCJ9",
       note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
     { id: "scribd_doc", name: "Scribd document (Destruction page)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
@@ -7590,14 +7601,16 @@ const PANEL_ORDER = [
   { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget", "hydrowaste",
   { h: 4, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
   { h: 3, t: "Deforestation" }, "gfw", "gfw_dist", "gfw_dist_year", "glad_loss", "palmwatch", "soilgrids", "trase_measures", "trase_facilities", "nusantara", "gfw_catalogue",
-  { h: 3, t: "Biodiversity loss" }, "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report", "gsn", "gsn_rankings",
+  { h: 3, t: "Biodiversity loss" }, "gsn", "gsn_rankings", "allen_coral", "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report",
   { h: 3, t: "Mining" }, "mines_global",
-  { h: 3, t: "Agriculture" },
-  { h: 4, t: "National shading" }, "land_matrix",
-  { h: 4, t: "Slaughterhouses" }, "abattoir_facilities", "cultivated_meat_laws",
-  { h: 3, t: "Oceans" }, "fishing", "slavery_fishing", "allen_coral", "skytruth_monitor", "skytruth_voc",
+  { h: 3, t: "Meat and agriculture" },
+  { h: 4, t: "Agriculture" }, "land_matrix",
+  { h: 4, t: "Meat" }, "abattoir_facilities", "cultivated_meat_laws",
+  { h: 3, t: "Oceans" },
+  { h: 4, t: "Fishing" }, "fishing", "slavery_fishing",
   { h: 4, t: "Oil slicks" },
-  { h: 5, t: "Marine oil slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive",
+  { h: 5, t: "Marine slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc",
+  { h: 5, t: "Terrestrial slicks" }, "skytruth_monitor",
   { h: 3, t: "Construction" }, "local_projects", "love_wire", "love_trackers", "love_guides",
   { h: 3, t: "Culprits upstream" }, "ejatlas",
   { h: 4, t: "Emissions" }, "carbon_majors", "soy_organizations", "bocc",
@@ -7765,21 +7778,34 @@ function addRowTools(box) {
   for (const lead of box.querySelectorAll("label.layer, .group > .layer.parent")) {
     if (lead.closest("[data-removed]") || lead.querySelector(".grip")) continue;
     if (!lead.querySelector("[data-layer], [data-group]")) continue;
-    // A ticked row's boxes underneath it (its sources, kinds, transparency)
-    // fold away and back with this.
-    if (lead.tagName === "LABEL" && !lead.querySelector(".fold")) {
+    // One control on every row, ticked or not: it pulls that row's sublayers
+    // up out of sight and back down. On an ordinary row those are the boxes
+    // underneath it (its sources, kinds, transparency); on a group's parent
+    // row they are the group's children, which the triangle on the left also
+    // shows and hides - both now say the same thing, so the arrow at the end
+    // of the row means the same wherever it is.
+    if (!lead.querySelector(".fold")) {
+      const group = lead.classList.contains("parent");
+      const kids = group ? lead.parentElement.querySelector("[data-kids]") : null;
       const f = document.createElement("button");
       f.type = "button";
       f.className = "fold";
-      f.title = "Hide or show this layer's boxes";
-      f.setAttribute("aria-label", "Hide or show this layer's boxes");
-      f.textContent = "\u25B4";
+      f.title = "Pull this layer's sublayers up or down";
+      f.setAttribute("aria-label", "Pull this layer's sublayers up or down");
+      f.textContent = group && kids && kids.hidden ? "\u25BE" : "\u25B4";
       f.addEventListener("click", (e) => {
         e.preventDefault();
         e.stopPropagation();
-        const folded = !lead.classList.contains("folded");
-        lead.classList.toggle("folded", folded);
-        rowNodes(lead).slice(1).forEach((n) => n.classList.toggle("fold-hide", folded));
+        let folded;
+        if (group && kids) {
+          const id = lead.querySelector("[data-group]").dataset.group;
+          toggleGroup(box, id);
+          folded = kids.hidden;
+        } else {
+          folded = !lead.classList.contains("folded");
+          lead.classList.toggle("folded", folded);
+          rowNodes(lead).slice(1).forEach((n) => n.classList.toggle("fold-hide", folded));
+        }
         f.textContent = folded ? "\u25BE" : "\u25B4";
         f.setAttribute("aria-expanded", String(!folded));
       });
@@ -7966,8 +7992,9 @@ function arrangePanel() {
       ".panel-h5{font-size:10.5px;opacity:.62;padding-left:22px}" +
       "#layers label.layer,#layers .group>.layer.parent{cursor:grab;user-select:none}" +
       "#layers .fold{display:none;margin-left:auto;padding:0 4px;border:0;background:none;color:var(--dim);cursor:pointer;font-size:11px;line-height:1}" +
-      "#layers label.layer:has(> input:checked):has(+ .facet) .fold{display:inline-block}" +
-      "#layers label.layer:has(> input:checked):has(+ .facet) .grip{margin-left:0}" +
+      "#layers label.layer:has(+ .facet) .fold{display:inline-block}" +
+      "#layers .layer.parent .fold{display:inline-block}" +
+      "#layers label.layer:has(+ .facet) .grip{margin-left:0}" +
       "#layers .facet.fold-hide{display:none}" +
       "#layers .grip{margin-left:auto;padding:0 2px 0 6px;color:var(--dim);opacity:.55;cursor:grab;touch-action:none;font-size:13px;line-height:1}" +
       "#layers .dragging{opacity:.45}" +
diff --git a/map/index.html b/map/index.html
index d2d47d0..fe1a86b 100644
--- a/map/index.html
+++ b/map/index.html
@@ -48,24 +48,23 @@
   #layers .facet{padding:1px 0 5px 22px}
   #layers .kids{margin:0 0 2px 9px}
   /* The Satellite basemap's planetary-defence frame (see DEFENCE in app.js).
-     Thin corner brackets, a faint vignette and a slow scan line; none of it
-     takes clicks or covers the middle of the map. */
+     Fine corner brackets and a faint vignette; none of it takes clicks or
+     covers the middle of the map. The scan line that used to sweep down the
+     screen is gone: a bar crossing the map every eleven seconds is an arcade
+     screen, not an instrument, and it drew attention away from the map it was
+     supposed to be framing. */
   #defence-hud{position:absolute;inset:0;pointer-events:none;z-index:1;
-    background:radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(4,16,22,.38) 100%)}
+    background:radial-gradient(ellipse at center, rgba(0,0,0,0) 68%, rgba(4,16,22,.30) 100%)}
   #defence-hud[hidden]{display:none}
-  #defence-hud .br{position:absolute;width:38px;height:38px;border:1.5px solid rgba(63,167,163,.55)}
+  #defence-hud .br{position:absolute;width:56px;height:56px;border:1px solid rgba(63,167,163,.28)}
   #defence-hud .tl{top:10px;left:calc(var(--box-w) + 32px);border-right:0;border-bottom:0}
   #defence-hud .tr{top:10px;right:calc(var(--box-w) + 24px);border-left:0;border-bottom:0}
   #defence-hud .bl{bottom:34px;left:calc(var(--box-w) + 32px);border-right:0;border-top:0}
   #defence-hud .bre{bottom:34px;right:calc(var(--box-w) + 24px);border-left:0;border-top:0}
-  #defence-hud .scan{position:absolute;left:0;right:0;height:2px;top:0;
-    background:linear-gradient(90deg, rgba(63,167,163,0), rgba(63,167,163,.28), rgba(63,167,163,0));
-    animation:defence-scan 11s linear infinite}
-  @keyframes defence-scan{from{top:0}to{top:100%}}
-  .defence-ping{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;
-    border:1.5px solid rgba(63,167,163,.85);pointer-events:none;z-index:2;animation:defence-ping .95s ease-out forwards}
-  @keyframes defence-ping{to{transform:scale(6);opacity:0}}
-  @media (prefers-reduced-motion: reduce){#defence-hud .scan,.defence-ping{animation:none;display:none}}
+  .defence-ping{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;
+    border:1px solid rgba(63,167,163,.55);pointer-events:none;z-index:2;animation:defence-ping .7s ease-out forwards}
+  @keyframes defence-ping{to{transform:scale(3.4);opacity:0}}
+  @media (prefers-reduced-motion: reduce){.defence-ping{animation:none;display:none}}
   /* The layers box rolls up whole: the box shrinks to its heading. */
   .left-col .panel.shut{flex:0 0 auto;height:auto !important}
   /* A page panel sets display:flex, which would otherwise override hidden. */
@@ -303,7 +302,7 @@
      there and clickable from the first moment, before the map has loaded and
      even if the map's script is slow or has failed. Once the view box exists
      it is moved beside the zoom buttons. -->
-<div id="defence-hud" hidden><i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br bre"></i><i class="scan"></i></div>
+<div id="defence-hud" hidden><i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br bre"></i></div>
 <div class="reload-wrap reload-early" id="reload-wrap">
   <button type="button" id="reload-map" aria-label="Reload the map"
           onclick="try{var v=window.__culpritsView;if(v)sessionStorage.setItem('culprits-view',v)}catch(e){}location.reload()">&#8635;</button>
diff --git a/map/test.mjs b/map/test.mjs
index e099b5f..cbe4f74 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2050,6 +2050,30 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\nthe layers box, as asked for");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
+  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
+  const between = (id, a, b) => o.PANEL_ORDER.indexOf(id) > at(a) && o.PANEL_ORDER.indexOf(id) < at(b);
+  check("both fishing layers sit under Fishing, under Oceans", at("Oceans") < at("Fishing") &&
+        ["fishing", "slavery_fishing"].every((i) => between(i, "Fishing", "Oil slicks")));
+  check("the reefs sit under Biodiversity loss, with the Global Safety Net at the top of it",
+        between("allen_coral", "Biodiversity loss", "Mining") &&
+        o.PANEL_ORDER[at("Biodiversity loss") + 1] === "gsn");
+  check("Agriculture is Meat and agriculture, holding Agriculture and Meat",
+        at("Meat and agriculture") > 0 && at("Agriculture") > at("Meat and agriculture") &&
+        between("land_matrix", "Agriculture", "Meat") && between("abattoir_facilities", "Meat", "Oceans"));
+  check("the Power BI row is named for what it shows", /id: "powerbi_report", name: "Environmental Crime Tracker"/.test(src));
+  check("every row carries the fold control, ticked or not, groups included",
+        /"#layers label\.layer:has\(\+ \.facet\) \.fold\{display:inline-block\}"/.test(src) &&
+        /"#layers \.layer\.parent \.fold\{display:inline-block\}"/.test(src) &&
+        /const group = lead\.classList\.contains\("parent"\)/.test(src));
+  check("the mines draw only where their own tiles hold something",
+        /minzoom: cfg\.polygonFrom != null \? cfg\.polygonFrom : 7/.test(src) && /maxzoom: cfg\.pointTo != null \? cfg\.pointTo : 9/.test(src));
+}
+
 console.log("\nLive Projects to Resist, drawn here");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
@@ -2099,9 +2123,12 @@ console.log("\nthe Satellite basemap as a planetary-defence view; folding a row'
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
   check("only the Satellite basemap turns the defence view on", /defenceMode\(kind === "satellite"\);/.test(src));
-  check("threat pulses sit under the real points of ticked Destruction layers only", /t\.textContent\.trim\(\) !== "Destruction"/.test(src) && /l\.type !== "circle"/.test(src) && /map\.addLayer\(spec, lid\)/.test(src));
+  check("threat halos sit under the real points of ticked Destruction layers only", /t\.textContent\.trim\(\) !== "Destruction"/.test(src) && /l\.type !== "circle"/.test(src) && /map\.addLayer\(spec, lid\)/.test(src));
+  check("the view holds still: no scan line, no throbbing halos, no breathing areas",
+        !/defence-scan/.test(index) && !/class="scan"/.test(index) &&
+        !/Math\.sin\(Date\.now\(\)/.test(src) && /setInterval\(defenceTick, 500\)/.test(src));
   check("the threat colour is a red, with no orange, yellow or neon", /threat: "#B8473E"/.test(src));
-  check("the frame takes no clicks and stops moving for reduced motion", /#defence-hud\{position:absolute;inset:0;pointer-events:none/.test(index) && /prefers-reduced-motion: reduce\)\{#defence-hud \.scan/.test(index));
+  check("the frame takes no clicks, and the one thing that moves stops for reduced motion", /#defence-hud\{position:absolute;inset:0;pointer-events:none/.test(index) && /prefers-reduced-motion: reduce\)\{\.defence-ping\{animation:none;display:none\}\}/.test(index));
   check("each ticked row with boxes under it has a fold button", /f\.className = "fold";/.test(src) && /has\(\+ \.facet\) \.fold\{display:inline-block\}/.test(src));
 }
 
@@ -2178,8 +2205,9 @@ console.log("\nACGF removed; oil slicks grouped; the slick archive seen from afa
   const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
   const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
   check("ACGF is removed", o.PANEL_REMOVED.has("acgf") && !o.PANEL_ORDER.includes("acgf"));
-  check("the three slick layers sit under Oil slicks, Marine oil slicks", at("Oil slicks") < at("Marine oil slicks") &&
-        ["cerulean_slicks", "cerulean_sources", "slick_archive"].every((i) => o.PANEL_ORDER.indexOf(i) > at("Marine oil slicks")) && o.PANEL_ORDER.indexOf("slick_archive") < at("Construction"));
+  check("the slick layers sit under Oil slicks, in Marine slicks and Terrestrial slicks", at("Oil slicks") < at("Marine slicks") &&
+        ["cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc"].every((i) => o.PANEL_ORDER.indexOf(i) > at("Marine slicks") && o.PANEL_ORDER.indexOf(i) < at("Terrestrial slicks")) &&
+        o.PANEL_ORDER.indexOf("skytruth_monitor") > at("Terrestrial slicks") && o.PANEL_ORDER.indexOf("skytruth_monitor") < at("Construction"));
   check("the slick archive draws a point per slick wider out", /id: `\$\{cfg\.id\}-pt`, type: "circle", source: `\$\{src\}-pt`, maxzoom: 7/.test(src));
 }
 
'''


def git(*args):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if '{ h: 5, t: "Terrestrial slicks" }' in app:
        print("Already applied - nothing to do.")
        return
    if "love_trackers" not in app:
        sys.exit("patch_1002.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
