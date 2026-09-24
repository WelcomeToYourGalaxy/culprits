#!/usr/bin/env python3
"""
Titles that say which EPA row is which; HydroWASTE under Wastewater; PalmWatch
under Agriculture; the three live alert layers gathered into one row and named
for the systems that make them; Trase's two layers gathered into one row;
unticking a row takes its boxes with it.

Run from the repo root:  python3 patch_1004.py

Needs patch_1003.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js     "US toxic release sites" becomes "Factories reporting toxic
                 chemical releases, US (EPA Toxics Release Inventory)", and the
                 Envirofacts row says what it holds instead of naming a widget.
                 Pollution gains a Wastewater sub-heading holding HydroWASTE.
                 PalmWatch moves to Meat and agriculture > Agriculture.
                 The three alert rows become children of one row, "Live
                 deforestation and disturbance alerts (Global Forest Watch)",
                 each named for its own system; Global Forest Change is listed
                 above that row. The children are the same objects as in
                 LAYERS, gathered rather than moved, so nothing about how they
                 load changes.
                 Trase's two rows become children of "Trase deforestation
                 data", named without the "Trase:" their row now carries.
                 Unticking a row hides everything under it - filters, kind
                 lists, month pickers, the transparency slider - and ticking it
                 brings them back.
  map/test.mjs   Checks for all of it.
  HANDOFF.md     What the alert products actually are, and who makes them.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 709f0ac..43eed9e 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -83,6 +83,22 @@ Worker: `https://culprits-proxy.welcometoyourgalaxy.workers.dev`
 
 ---
 
+## What the alert rows actually are
+
+The three live-alert rows are Global Forest Watch products, served by GFW's own
+tile service: integrated deforestation alerts for the tropics (GLAD-L, GLAD-S2
+and RADD) and DIST-ALERT, the UMD and NASA vegetation-disturbance product that
+covers the whole world, over 30 days and over a year. Global Nature Watch is
+the WRI platform Global Forest Watch now sits inside, not the maker of any of
+them, so the row that holds the three names the service and each line names the
+system. They sit in a group whose children are the same objects as in LAYERS -
+gathered by `rowsById`, not copied - so nothing about how they load changed.
+Whether the same products also appear in the `gfw_catalogue` row's dataset list
+is unchecked: that list comes from GFW's data API and was not readable from
+here.
+
+---
+
 ## The layers box, as it is asked to read
 
 Headings carry the meaning, so they are changed rather than worked around:
diff --git a/map/app.js b/map/app.js
index dca63fd..0588107 100644
--- a/map/app.js
+++ b/map/app.js
@@ -266,7 +266,7 @@ const LAYERS = [
   // never ambiguous which one a dot came from.
   //
   // ready:false until map/tiles/epa_tri_sites.pmtiles exists.
-  { id:"epa_tri_sites",        name:"US toxic release sites", unit:"TRI facilities", colour:"#5C6E77", route:"pmtiles", ready:true, off: true,
+  { id:"epa_tri_sites",        name:"Factories reporting toxic chemical releases, US (EPA Toxics Release Inventory)", unit:"TRI facilities", colour:"#5C6E77", route:"pmtiles", ready:true, off: true,
     // One row: the whole copy at every zoom, and EPA's live answer drawn over it
     // once the view is small enough for EPA to send it.
     linked: ["epa_tri"],
@@ -296,7 +296,7 @@ const LAYERS = [
   // They are kept separate rather than merged because they detect different
   // things by different instruments, and a reader who sees an alert should be
   // able to tell which one saw it.
-  { id:"gfw",                  name:"Deforestation alerts — tropics",  unit:"GLAD + RADD, last 30 days", colour:"#8A4F46", route:"tile", ready:true, off: true,
+  { id:"gfw",                  name:"Deforestation alerts in the tropics \u2014 GLAD-L, GLAD-S2 and RADD, last 30 days", unit:"alerts", colour:"#8A4F46", route:"tile", ready:true, off: true,
     bounds: [-180, -30, 180, 30],
     // Cut at 30° to the pixel, not just to the tile. See clipTileRows.
     clipToBounds: true,
@@ -307,13 +307,13 @@ const LAYERS = [
     recolor: "#8A4F46",
     note: "Pan-tropical only. GLAD and RADD do not cover boreal or temperate forest — use the global layers for those.",
     attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
-  { id:"gfw_dist",             name:"Disturbance alerts — global",     unit:"DIST-ALERT, last 30 days", colour:"#7A5B4E", route:"tile", ready:true, off: true,
+  { id:"gfw_dist",             name:"Vegetation disturbance worldwide \u2014 DIST-ALERT (UMD and NASA), last 30 days", unit:"alerts", colour:"#7A5B4E", route:"tile", ready:true, off: true,
     bounds: [-180, -30, 180, 30],
     tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=30", off: true,
     recolor: "#7A5B4E",
     note: "Global coverage, including boreal and temperate forest. Detects vegetation disturbance generally, so it catches fire and harvest as well as clearing.",
     attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
-  { id:"gfw_dist_year",        name:"Disturbance alerts — past year",  unit:"DIST-ALERT, last 365 days", colour:"#6E5E57", route:"tile", ready:true, off: true,
+  { id:"gfw_dist_year",        name:"Vegetation disturbance worldwide \u2014 DIST-ALERT, past year", unit:"alerts", colour:"#6E5E57", route:"tile", ready:true, off: true,
     bounds: [-180, -30, 180, 30],
     tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=365", off: true,
     recolor: "#6E5E57",
@@ -6662,7 +6662,7 @@ const OTHER_MAPS = {
     { id: "usda_corn", name: "Corn Map Explorer", unit: "corn growing areas", colour: "#76705C", route: "arcgis", ready: true, lazy: true,
       crop: "Corn", service: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerCorn/MapServer", attribution: "USDA Foreign Agricultural Service",
       note: "Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." },
-    { id: "trase_measures", name: "Trase: deforestation and supply-chain measures", unit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
+    { id: "trase_measures", name: "Deforestation and supply-chain measures", unit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
       catalogue: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/catalogue.json", values: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/values",
       regions: "https://resources.trase.earth/data/trase-regions",
       attribution: "Trase (CC BY 4.0)",
@@ -6792,7 +6792,7 @@ const OTHER_MAPS = {
     { id: "gpw_map", name: "Global Plastic Watch", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
       page: "https://globalplasticwatch.org/map",
       note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
-    { id: "epa_widget", name: "EPA Envirofacts facilities (the multisystem widget)", unit: "facilities", colour: "#6A6258", route: "arcgisdyn", ready: true, lazy: true,
+    { id: "epa_widget", name: "Every US site EPA holds a record for, across all its programs (EPA Envirofacts)", unit: "facilities", colour: "#6A6258", route: "arcgisdyn", ready: true, lazy: true,
       service: "https://geopub.epa.gov/arcgis/rest/services/EMEF/efpoints/MapServer", minzoom: 6.5,
       // EPA's service draws nothing wider than about state level, so wider out
       // the row draws a weekly copy of every point (scripts/epa_efpoints.py in
@@ -6854,7 +6854,7 @@ const OTHER_MAPS = {
     { id: "giga_countries", name: "Giga: school mapping by country", unit: "countries", colour: "#627A86", route: "giga", ready: true, lazy: true,
       data: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/giga/countries.json",
       note: "Giga's own figures for every country on its map, copied daily (its service does not let other sites read it)." },
-    { id: "trase_facilities", name: "Trase: facilities", unit: "facilities", colour: "#62755F", route: "trasefacmenu", ready: true, lazy: true,
+    { id: "trase_facilities", name: "Facilities", unit: "facilities", colour: "#62755F", route: "trasefacmenu", ready: true, lazy: true,
       manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json",
       types: [["brazil-facilities", "Brazil: slaughterhouses and animal-product facilities"], ["brazil-silos", "Brazil: soy silos and storage"],
               ["cote-d-ivoire-cocoa-cooperatives", "C\u00f4te d'Ivoire: cocoa cooperatives"], ["indonesia-palm-oil-mills", "Indonesia: palm oil mills"],
@@ -6917,7 +6917,46 @@ const OTHER_MAPS = {
   ],
 };
 
-const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS, EXEC_MAP, MONEY_MAP, LEGAL_MAP, LEG_MAP, JUD_MAP, MORE_MAPS, GMO_MAP, OTHER_MAPS];
+
+// Two rows that gather layers defined above, so a reader meets one line where
+// the subject is one subject. The children are the same objects as in LAYERS -
+// referenced, not copied - so each still loads exactly as it did; only where it
+// appears in the box has changed, and PANEL_ORDER names the group rather than
+// the children, so nothing is listed twice.
+//
+// The alerts are one row because a reader wants "what has been cleared lately"
+// in one place, and three lines inside it because they detect different things
+// by different instruments: whoever sees an alert can still tell which system
+// saw it. All three come from Global Forest Watch's tile service. Global Nature
+// Watch is the platform Global Forest Watch now sits inside, not the maker of
+// these products, so the row names the service that serves them and each line
+// names the system that made it.
+function rowsById(...ids) {
+  return ids.map((id) => {
+    const hit = LAYERS.find((l) => l.id === id);
+    if (!hit) throw new Error(`no layer "${id}" to gather into a group`);
+    return hit;
+  });
+}
+const FOREST_ALERTS = {
+  id: "forest_alerts",
+  name: "Live deforestation and disturbance alerts (Global Forest Watch)",
+  group: true,
+  ready: true,
+  children: rowsById("gfw", "gfw_dist", "gfw_dist_year"),
+};
+const TRASE_DATA = {
+  id: "trase_data",
+  name: "Trase deforestation data",
+  group: true,
+  ready: true,
+  children: [],
+};
+
+const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS, EXEC_MAP, MONEY_MAP, LEGAL_MAP, LEG_MAP, JUD_MAP, MORE_MAPS, GMO_MAP, OTHER_MAPS, FOREST_ALERTS, TRASE_DATA];
+// Trase's two layers sit inside other groups above; this row gathers those same
+// objects, so both read as one subject without either being defined twice.
+TRASE_DATA.children = ["trase_measures", "trase_facilities"].map(childById);
 function childById(id) {
   for (const g of GROUPS) {
     const hit = g.children.find((c) => c.id === id);
@@ -7598,13 +7637,14 @@ const PANEL_ORDER = [
     "usda_soybean", "usda_corn", "wastewater", "group:ct_history",
   { h: 4, t: "National shading" }, "owid_co2",
   { h: 4, t: "Air pollution" }, "ct_air", "ct_pop",
-  { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget", "hydrowaste",
+  { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget",
+  { h: 4, t: "Wastewater" }, "hydrowaste",
   { h: 4, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
-  { h: 3, t: "Deforestation" }, "gfw", "gfw_dist", "gfw_dist_year", "glad_loss", "palmwatch", "soilgrids", "trase_measures", "trase_facilities", "nusantara", "gfw_catalogue",
+  { h: 3, t: "Deforestation" }, "glad_loss", "group:forest_alerts", "soilgrids", "group:trase_data", "nusantara", "gfw_catalogue",
   { h: 3, t: "Biodiversity loss" }, "gsn", "gsn_rankings", "allen_coral", "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report",
   { h: 3, t: "Mining" }, "mines_global",
   { h: 3, t: "Meat and agriculture" },
-  { h: 4, t: "Agriculture" }, "land_matrix",
+  { h: 4, t: "Agriculture" }, "land_matrix", "palmwatch",
   { h: 4, t: "Meat" }, "abattoir_facilities", "cultivated_meat_laws",
   { h: 3, t: "Oceans" },
   { h: 4, t: "Fishing" }, "fishing", "slavery_fishing",
@@ -7770,7 +7810,16 @@ function addRowTools(box) {
       opacityFactor.set(id, f);
       layersOfRow(id).forEach((l) => applyOpacity(l, f));
     });
-    input.addEventListener("change", () => { tools.hidden = !input.checked; });
+    // Unticking a row takes everything under it away too - its filters, its
+    // kind lists, its month pickers, this slider - rather than leaving a stack
+    // of controls for a layer that is no longer drawn. Ticking it again brings
+    // them back exactly as they were.
+    input.addEventListener("change", () => {
+      tools.hidden = !input.checked;
+      rowNodes(lead).slice(1).forEach((n) => n.classList.toggle("fold-hide", !input.checked));
+      const f = lead.querySelector(".fold");
+      if (f) f.textContent = input.checked && !lead.classList.contains("folded") ? "\u25B4" : "\u25BE";
+    });
     lead.after(tools);
   }
   // Each row carries a grip; the row is dragged above or below the others
diff --git a/map/test.mjs b/map/test.mjs
index cbe4f74..894295c 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1581,7 +1581,7 @@ console.log("\nother organisations' maps: PalmWatch");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   check("PalmWatch is one row in its own group", /const OTHER_MAPS = \{[\s\S]*id: "palmwatch"[^\n]*route: "sitemap"/.test(src) &&
-        /const GROUPS = \[[^\]]*OTHER_MAPS\]/.test(src));
+        /const GROUPS = \[[^\]]*OTHER_MAPS,/.test(src));
   check("its copy is served from GitHub, not the Worker",
         /id: "palmwatch"[^\n]*dataUrl: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/sitemaps\/palmwatch\.places\.geojson"/.test(src));
   check("its note says the catchment is modelled, not a boundary", /modelled sourcing area, not a property boundary/.test(src));
@@ -1958,7 +1958,7 @@ console.log("\nwhat was still open");
   check("Giga by country, Trase facilities, and two of your own are rows", ["giga_countries", "trase_facilities", "biosignature", "leverage_chart"].every((i) => new RegExp(`id: "${i}"`).test(src)));
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const order = new Function(body + "; return PANEL_ORDER;")();
-  check("the waiting rows are placed", ["ejatlas", "trase_measures", "nusantara", "gfw_catalogue", "gsn", "seas_of_plastic", "coastal_cleanup", "mines_global", "atlas_hotspots", "final_nail", "group:ct_history"].every((i) => order.includes(i)));
+  check("the waiting rows are placed", ["ejatlas", "group:trase_data", "nusantara", "gfw_catalogue", "gsn", "seas_of_plastic", "coastal_cleanup", "mines_global", "atlas_hotspots", "final_nail", "group:ct_history"].every((i) => order.includes(i)));
 }
 
 console.log("\nvessels of concern drawn; the oil-slick archive");
@@ -2005,7 +2005,7 @@ console.log("\nchanges of 19 September");
         ["atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report"].every((i) => between(i, "Biodiversity loss", "Mining")));
   check("Mining holds the mines", between("mines_global", "Mining", "Agriculture"));
   check("the refinery map is under Climate", between("fractracker_refineries", "Climate", "National shading"));
-  check("the toxic release sites are one row, carrying the live layer", o.PANEL_REMOVED.has("epa_tri") && /name:"US toxic release sites", [^\n]*\n[^\n]*\n[^\n]*\n\s*linked: \["epa_tri"\]/.test(src));
+  check("the toxic release sites are one row, carrying the live layer", o.PANEL_REMOVED.has("epa_tri") && /name:"Factories reporting toxic chemical releases, US \(EPA Toxics Release Inventory\)", [^\n]*\n[^\n]*\n[^\n]*\n\s*linked: \["epa_tri"\]/.test(src));
   check("coral is one row", o.PANEL_REMOVED.has("unep_coral") && pos("allen_coral") > 0);
   check("mines are merged into counted points wider out", /mines here<\/b>/.test(src) && /"point_count"\], 1\]\]\]\],\n\s*6,/.test(src));
   check("alerts are grown and lightened wider out", /function recolorAlerts\(px, rgb, z, w\)/.test(src) && /recolorAlerts\(img\.data, tint, z, bmp\.width\)/.test(src));
@@ -2050,6 +2050,29 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\nrows gathered, moved and renamed");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const order = new Function(body + "; return PANEL_ORDER;")();
+  const at = (t) => order.findIndex((x) => x && x.t === t);
+  check("the two EPA rows say which is which", /name:"Factories reporting toxic chemical releases, US \(EPA Toxics Release Inventory\)"/.test(src) &&
+        /name: "Every US site EPA holds a record for, across all its programs \(EPA Envirofacts\)"/.test(src));
+  check("HydroWASTE sits under Wastewater", at("Wastewater") > at("Pollution") && order.indexOf("hydrowaste") === at("Wastewater") + 1);
+  check("PalmWatch sits under Agriculture", order.indexOf("palmwatch") > at("Agriculture") && order.indexOf("palmwatch") < at("Meat"));
+  check("the three alert layers are one row, and each line names the system that saw it",
+        /children: rowsById\("gfw", "gfw_dist", "gfw_dist_year"\)/.test(src) &&
+        /name: "Live deforestation and disturbance alerts \(Global Forest Watch\)"/.test(src) &&
+        /GLAD-L, GLAD-S2 and RADD/.test(src) && (src.match(/DIST-ALERT/g) || []).length >= 2 &&
+        ["gfw", "gfw_dist", "gfw_dist_year"].every((i) => !order.includes(i)));
+  check("Global Forest Change is drawn above the alerts", order.indexOf("glad_loss") < order.indexOf("group:forest_alerts"));
+  check("Trase is one row, its two layers named without the prefix",
+        /name: "Trase deforestation data"/.test(src) && /TRASE_DATA\.children = \["trase_measures", "trase_facilities"\]\.map\(childById\)/.test(src) &&
+        !/name: "Trase: /.test(src));
+  check("unticking a row takes its boxes with it",
+        /rowNodes\(lead\)\.slice\(1\)\.forEach\(\(n\) => n\.classList\.toggle\("fold-hide", !input\.checked\)\)/.test(src));
+}
+
 console.log("\nthe layers box, as asked for");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
'''


def git(*args):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if "FOREST_ALERTS" in app:
        print("Already applied - nothing to do.")
        return
    if '{ h: 5, t: "Terrestrial slicks" }' not in app:
        sys.exit("patch_1003.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
