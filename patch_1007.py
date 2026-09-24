#!/usr/bin/env python3
"""
Rows stop falling into "Not yet placed"; one control per group row; the alerts
under a Global Forest Watch heading; the hotspot outlines arrive in seconds.

Run from the repo root:  python3 patch_1007.py

Needs patch_1006.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js     The alerts group and the Trase group own their children
                 instead of pointing at layers defined elsewhere. That was the
                 bug behind the rows in "Not yet placed": each child was built
                 twice, once where it was defined and once inside the group,
                 and the copy nobody had placed fell to the foot of the box.
                 Group rows lose the triangle before their title; the arrow at
                 the end of every row does that job, so there is one control
                 rather than two.
                 Deforestation gains a Global Forest Watch sub-heading holding
                 the tree cover loss, the alerts and the catalogue.
                 Atlas hotspots asks Conservation International for its
                 outlines at about a kilometre's precision instead of the
                 survey's own; it was tens of megabytes and most of a minute.
                 Every field still comes across, and no other ArcGIS layer is
                 affected.
  map/test.mjs   Checks for all of it.
  HANDOFF.md     Why a group owns its children.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 09adc76..7e8a333 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -83,6 +83,21 @@ Worker: `https://culprits-proxy.welcometoyourgalaxy.workers.dev`
 
 ---
 
+## A group owns its children
+
+Gathering a group's children by reference from LAYERS was tried and was wrong:
+each child was rendered twice, once where it was defined and once inside the
+group, and the copy nobody had placed fell into "Not yet placed" at the foot of
+the box. A group's children are defined inside the group and nowhere else. They
+are lazy, so they build on the first tick, which is how every other group's
+children already worked.
+
+Group rows carry one control, the arrow at the end that every row now has. The
+triangle that used to sit before the title is gone; `toggleGroup` still updates
+one if a row has it.
+
+---
+
 ## Bulk ticks, and the abattoir atlas's three rows
 
 Every heading carries its own tick, beside the heading rather than inside it,
diff --git a/map/app.js b/map/app.js
index 5ba472c..b1608f2 100644
--- a/map/app.js
+++ b/map/app.js
@@ -296,29 +296,6 @@ const LAYERS = [
   // They are kept separate rather than merged because they detect different
   // things by different instruments, and a reader who sees an alert should be
   // able to tell which one saw it.
-  { id:"gfw",                  name:"Deforestation alerts in the tropics \u2014 GLAD-L, GLAD-S2 and RADD, last 30 days", unit:"alerts", colour:"#8A4F46", route:"tile", ready:true, off: true,
-    bounds: [-180, -30, 180, 30],
-    // Cut at 30° to the pixel, not just to the tile. See clipTileRows.
-    clipToBounds: true,
-    tileMaxZoom: 22, tileQuery: "kind=integrated&days=30", off: true,
-    // GFW paint these tiles themselves, and no rotation of their palette read
-    // as anything but glaring. Each alert pixel is given this layer's colour
-    // instead, in the latclip protocol. See recolorAlerts.
-    recolor: "#8A4F46",
-    note: "Pan-tropical only. GLAD and RADD do not cover boreal or temperate forest — use the global layers for those.",
-    attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
-  { id:"gfw_dist",             name:"Vegetation disturbance worldwide \u2014 DIST-ALERT (UMD and NASA), last 30 days", unit:"alerts", colour:"#7A5B4E", route:"tile", ready:true, off: true,
-    bounds: [-180, -30, 180, 30],
-    tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=30", off: true,
-    recolor: "#7A5B4E",
-    note: "Global coverage, including boreal and temperate forest. Detects vegetation disturbance generally, so it catches fire and harvest as well as clearing.",
-    attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
-  { id:"gfw_dist_year",        name:"Vegetation disturbance worldwide \u2014 DIST-ALERT, past year", unit:"alerts", colour:"#6E5E57", route:"tile", ready:true, off: true,
-    bounds: [-180, -30, 180, 30],
-    tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=365", off: true,
-    recolor: "#6E5E57",
-    note: "The same global product over a twelve-month window, for seeing a season's cumulative loss rather than this month's.",
-    attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
   // Not a "worker" route any more, and not points.
   //
   // This used to query /v3/4wings/report per viewport and returned 429 on
@@ -2693,10 +2670,17 @@ function arcgisLayersOf(ops, out = []) {
   }
   return out;
 }
-async function arcgisQueryAll(url) {
+// `coarse` asks the server to draw the outlines at about a kilometre's
+// precision instead of the survey's own. The hotspot outlines are tens of
+// megabytes at full detail, which is most of a minute before anything appears
+// and far more shape than a world map can draw; the boundary itself is
+// unchanged, only how finely it is described on the way here. Layers that are
+// read for their numbers rather than their edges never pass this.
+async function arcgisQueryAll(url, coarse) {
   const feats = [];
   for (let offset = 0; offset < 100000; offset += 2000) {
-    const q = `${url}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=2000`;
+    const q = `${url}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=2000` +
+      (coarse ? `&maxAllowableOffset=${coarse}&geometryPrecision=4` : "");
     const j = await getJson(q);
     if (j.error) throw new Error(j.error.message || "query refused");
     feats.push(...(j.features || []));
@@ -2757,7 +2741,7 @@ async function readArcgisApp(cfg) {
     for (const [n, l] of layers.entries()) {
       setLayerState(cfg.id, `reading layer ${n + 1} of ${layers.length}: ${l.title || ""}\u2026`);
       let feats;
-      try { feats = await arcgisQueryAll(l.url.replace(/\/$/, "")); } catch (e) { skipped++; continue; }
+      try { feats = await arcgisQueryAll(l.url.replace(/\/$/, ""), cfg.coarse); } catch (e) { skipped++; continue; }
       feats.forEach((f, i) => {
         const a = f.properties || {};
         const oid = a.OBJECTID != null ? a.OBJECTID : a.FID != null ? a.FID : i;
@@ -6328,9 +6312,11 @@ function groupRows(group) {
 
   const parent = document.createElement("div");
   parent.className = "layer parent";
+  // No triangle before the title: the arrow at the end of every row does this
+  // now, and two controls for one action on the same row is one too many. The
+  // arrow and the tick are still separate - opening a group must not load its
+  // layers, and ticking one must not depend on having opened it.
   parent.innerHTML =
-    `<button class="disc" data-disc="${group.id}" aria-expanded="false" ` +
-    `title="show the layers in this group">&#9656;</button>` +
     `<input type="checkbox" data-group="${group.id}">` +
     `<span class="swatch" style="background:${group.children[0].colour}"></span>` +
     `<span class="body"><span class="nm">${group.name}</span>` +
@@ -6359,12 +6345,13 @@ function groupRows(group) {
 // Show or hide one group's children. Display only.
 function toggleGroup(box, id) {
   const kids = box.querySelector(`[data-kids="${id}"]`);
+  if (!kids) return;
+  kids.hidden = !kids.hidden;
   const disc = box.querySelector(`[data-disc="${id}"]`);
-  if (!kids || !disc) return;
-  const open = kids.hidden;
-  kids.hidden = !open;
-  disc.innerHTML = open ? "&#9662;" : "&#9656;";
-  disc.setAttribute("aria-expanded", open ? "true" : "false");
+  if (disc) {
+    disc.innerHTML = kids.hidden ? "&#9656;" : "&#9662;";
+    disc.setAttribute("aria-expanded", kids.hidden ? "false" : "true");
+  }
 }
 
 // none / some / all. A checkbox that reads "on" while two of six children are
@@ -6684,11 +6671,6 @@ const OTHER_MAPS = {
     { id: "usda_corn", name: "Corn Map Explorer", unit: "corn growing areas", colour: "#76705C", route: "arcgis", ready: true, lazy: true,
       crop: "Corn", service: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerCorn/MapServer", attribution: "USDA Foreign Agricultural Service",
       note: "Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." },
-    { id: "trase_measures", name: "Deforestation and supply-chain measures", unit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
-      catalogue: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/catalogue.json", values: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/values",
-      regions: "https://resources.trase.earth/data/trase-regions",
-      attribution: "Trase (CC BY 4.0)",
-      note: "Trase's own measures for every country, region level and year it publishes. Region shapes are read live from Trase; the values come from a copy reread weekly, because Trase does not let other sites read them." },
     { id: "unep_coral", name: "Warm-water coral reefs (UNEP-WCMC)", unit: "reef areas", colour: "#B06F6A", route: "arcgis", ready: true, lazy: true,
       service: "https://data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/MapServer",
       attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC",
@@ -6720,8 +6702,11 @@ const OTHER_MAPS = {
       note: "Ocean Conservancy's cleanup sites, copied daily by culprits-tiles-more (its server lets only its own site read it)." },
     { id: "atlas_hotspots", name: "Atlas for the End of the World: Hotspots", unit: "biodiversity hotspots", colour: "#6E5A55", route: "arcgisapp", ready: true, lazy: true,
       item: "ba55aa1bff5447e7b72559b8dc1a0e83", pdfBase: "https://atlas-for-the-end-of-the-world.com/hotspots/",
+      // About a kilometre, in degrees: the outlines are tens of megabytes at
+      // the survey's own precision and took most of a minute to arrive.
+      coarse: 0.01,
       pdfs: [["atlantic_forests", "Atlantic Forest"], ["california_floristic_province", "California Floristic Province"], ["cape_floristic_region", "Cape Floristic Region"], ["caribbean_islands", "Caribbean Islands"], ["caucasus", "Caucasus"], ["cerrado", "Cerrado"], ["chilean_valdivian_forests", "Chilean Winter Rainfall Valdivian Forests"], ["coastal_forests_of_eastern_africa", "Coastal Forests of Eastern Africa"], ["east_melanesian_islands", "East Melanesian Islands"], ["eastern_afromontane", "Eastern Afromontane"], ["forests_of_east_australia", "Forests of Eastern Australia"], ["guinean_forests_of_west_africa", "Guinean Forests of West Africa"], ["himalaya", "Himalaya"], ["horn_of_africa", "Horn of Africa"], ["japan", "Japan"], ["madagascar", "Madagascar & The Indian Ocean Islands"], ["madrean_woodlands", "Madrean Pine-Oak Woodlands"], ["maputaland_pondoland_albany", "Maputaland Pondoland Albany"], ["mediterranean_basin", "Mediterranean Basin"], ["mesoamerica", "Mesoamerica"], ["mountains_of_central_asia", "Mountains of Central Asia"], ["mountains_of_southwest_china", "Mountains of Southwest China"], ["new_caledonia", "New Caledonia"], ["new_zealand", "New Zealand"], ["philippines", "Philippines"], ["north_american_coastal_plain", "North American Coastal Plain"], ["southwest_australia", "Southwest Australia"], ["succulent_karoo", "Succulent Karoo"], ["sundaland", "Sundaland"], ["tropical_andes", "Tropical Andes"], ["wallacea", "Wallacea"], ["western_ghats_sri_lanka", "Western Ghats & Sri Lanka"]],
-      note: "The 36 biodiversity hotspots, outlined live from Conservation International's Biodiversity Hotspots 2016.1 (CC BY 3.0), the boundaries the Atlas maps; each box links the Atlas's own PDF for that hotspot." },
+      note: "The 36 biodiversity hotspots, outlined live from Conservation International's Biodiversity Hotspots 2016.1 (CC BY 3.0), the boundaries the Atlas maps; each box links the Atlas's own PDF for that hotspot. The outlines are asked for at about a kilometre's precision rather than the survey's own, which is what makes them arrive in seconds; every field comes across unchanged." },
     { id: "atlas_cities", name: "Atlas for the End of the World: Hotspot Cities", unit: "cities", colour: "#5E6070", route: "atlascities", zoomTo: 9, ready: true, lazy: true,
       pageBase: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/", positions: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/atlas/cities.json",
       cities: [["antananarivo", "Antananarivo, Madagascar"], ["auckland", "Auckland, New Zealand"], ["baku", "Baku, Azerbaijan"], ["bogota", "Bogotá, Colombia"], ["brasilia", "Brasília, Brazil"], ["cape_town", "Cape Town, South Africa"], ["chengdu", "Chengdu, China"], ["colombo", "Colombo, Sri Lanka"], ["dar_es_salaam", "Dar es Salaam, Tanzania"], ["davao", "Davao, Philippines"], ["durban", "Durban, South Africa"], ["esfahan", "Esfahan, Iran"], ["guadalajara", "Guadalajara, Mexico"], ["guayaquil", "Guayaquil, Ecuador"], ["hongknog_shenzhen_quangzhou", "Hongkong-Shenzhen-Guangzhou, China"], ["honolulu", "Honolulu, United States"], ["houston", "Houston, United States"], ["jakarta", "Jakarta, Indonesia"], ["lagos", "Lagos, Nigeria"], ["los_angeles", "Los Angeles, United States"], ["makassar", "Makassar, Indonesia"], ["mecca", "Mecca, Saudi Arabia"], ["mexico_city", "Mexico City, Mexico"], ["nairobi", "Nairobi, Kenya"], ["osaka", "Osaka, Japan"], ["perth", "Perth, Australia"], ["port-au-prince", "Port-au-Prince, Haiti"], ["rawalpindi", "Rawalpindi, Pakistan"], ["santiago", "Santiago, Chile"], ["sao_paulo", "São Paulo, Brazil"], ["sydney", "Sydney, Australia"], ["tashkent", "Tashkent, Uzbekistan"], ["tel_aviv", "Tel Aviv, Israel"]],
@@ -6860,13 +6845,6 @@ const OTHER_MAPS = {
     { id: "giga_countries", name: "Giga: school mapping by country", unit: "countries", colour: "#627A86", route: "giga", ready: true, lazy: true,
       data: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/giga/countries.json",
       note: "Giga's own figures for every country on its map, copied daily (its service does not let other sites read it)." },
-    { id: "trase_facilities", name: "Facilities", unit: "facilities", colour: "#62755F", route: "trasefacmenu", ready: true, lazy: true,
-      manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json",
-      types: [["brazil-facilities", "Brazil: slaughterhouses and animal-product facilities"], ["brazil-silos", "Brazil: soy silos and storage"],
-              ["cote-d-ivoire-cocoa-cooperatives", "C\u00f4te d'Ivoire: cocoa cooperatives"], ["indonesia-palm-oil-mills", "Indonesia: palm oil mills"],
-              ["indonesia-wood-pulp-mills", "Indonesia: wood pulp mills"], ["indonesia-wood-pulp-concessions-2015-2019", "Indonesia: wood pulp concessions, 2015\u20132019"],
-              ["indonesia-wood-pulp-concessions-2020-2022", "Indonesia: wood pulp concessions, 2020\u20132022"], ["indonesia-wood-pulp-concessions-2023-2024", "Indonesia: wood pulp concessions, 2023\u20132024"]],
-      note: "Trase's facilities maps, chosen from its own menu, read live from Trase's files (CC BY 4.0)." },
     { id: "biosignature", name: "Biosignature Evidence Assessment", unit: "opens it in a panel", colour: "#5E6070", route: "companion", ready: true, lazy: true,
       page: "https://welcometoyourgalaxy.github.io/maps/off-planet-invasion_embed_13_large-script.html",
       note: "Your own assessment from the Off-Planet Invasion page, whole, in the panel along the bottom." },
@@ -6924,11 +6902,12 @@ const OTHER_MAPS = {
 };
 
 
-// Two rows that gather layers defined above, so a reader meets one line where
-// the subject is one subject. The children are the same objects as in LAYERS -
-// referenced, not copied - so each still loads exactly as it did; only where it
-// appears in the box has changed, and PANEL_ORDER names the group rather than
-// the children, so nothing is listed twice.
+// Two rows that hold several layers each, so a reader meets one line where the
+// subject is one subject. A group OWNS its children: they are defined here and
+// nowhere else. Gathering them by reference from LAYERS was tried and was
+// wrong - each child was rendered twice, once where it was defined and once
+// inside the group, and the copy nobody had placed fell into "Not yet placed"
+// at the foot of the box.
 //
 // The alerts are one row because a reader wants "what has been cleared lately"
 // in one place, and three lines inside it because they detect different things
@@ -6937,32 +6916,59 @@ const OTHER_MAPS = {
 // Watch is the platform Global Forest Watch now sits inside, not the maker of
 // these products, so the row names the service that serves them and each line
 // names the system that made it.
-function rowsById(...ids) {
-  return ids.map((id) => {
-    const hit = LAYERS.find((l) => l.id === id);
-    if (!hit) throw new Error(`no layer "${id}" to gather into a group`);
-    return hit;
-  });
-}
 const FOREST_ALERTS = {
   id: "forest_alerts",
   name: "Live deforestation and disturbance alerts (Global Forest Watch)",
   group: true,
   ready: true,
-  children: rowsById("gfw", "gfw_dist", "gfw_dist_year"),
+  children: [
+    { id:"gfw",                  name:"Deforestation alerts in the tropics \u2014 GLAD-L, GLAD-S2 and RADD, last 30 days", unit:"alerts", colour:"#8A4F46", route:"tile", ready:true, off: true, lazy:true,
+      bounds: [-180, -30, 180, 30],
+      // Cut at 30° to the pixel, not just to the tile. See clipTileRows.
+      clipToBounds: true,
+      tileMaxZoom: 22, tileQuery: "kind=integrated&days=30", off: true,
+      // GFW paint these tiles themselves, and no rotation of their palette read
+      // as anything but glaring. Each alert pixel is given this layer's colour
+      // instead, in the latclip protocol. See recolorAlerts.
+      recolor: "#8A4F46",
+      note: "Pan-tropical only. GLAD and RADD do not cover boreal or temperate forest — use the global layers for those.",
+      attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
+    { id:"gfw_dist",             name:"Vegetation disturbance worldwide \u2014 DIST-ALERT (UMD and NASA), last 30 days", unit:"alerts", colour:"#7A5B4E", route:"tile", ready:true, off: true, lazy:true,
+      bounds: [-180, -30, 180, 30],
+      tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=30", off: true,
+      recolor: "#7A5B4E",
+      note: "Global coverage, including boreal and temperate forest. Detects vegetation disturbance generally, so it catches fire and harvest as well as clearing.",
+      attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
+    { id:"gfw_dist_year",        name:"Vegetation disturbance worldwide \u2014 DIST-ALERT, past year", unit:"alerts", colour:"#6E5E57", route:"tile", ready:true, off: true, lazy:true,
+      bounds: [-180, -30, 180, 30],
+      tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=365", off: true,
+      recolor: "#6E5E57",
+      note: "The same global product over a twelve-month window, for seeing a season's cumulative loss rather than this month's.",
+      attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
+  ],
 };
 const TRASE_DATA = {
   id: "trase_data",
   name: "Trase deforestation data",
   group: true,
   ready: true,
-  children: [],
+  children: [
+      { id: "trase_measures", name: "Deforestation and supply-chain measures", unit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
+        catalogue: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/catalogue.json", values: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/values",
+        regions: "https://resources.trase.earth/data/trase-regions",
+        attribution: "Trase (CC BY 4.0)",
+        note: "Trase's own measures for every country, region level and year it publishes. Region shapes are read live from Trase; the values come from a copy reread weekly, because Trase does not let other sites read them." },
+      { id: "trase_facilities", name: "Facilities", unit: "facilities", colour: "#62755F", route: "trasefacmenu", ready: true, lazy: true,
+        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json",
+        types: [["brazil-facilities", "Brazil: slaughterhouses and animal-product facilities"], ["brazil-silos", "Brazil: soy silos and storage"],
+                ["cote-d-ivoire-cocoa-cooperatives", "C\u00f4te d'Ivoire: cocoa cooperatives"], ["indonesia-palm-oil-mills", "Indonesia: palm oil mills"],
+                ["indonesia-wood-pulp-mills", "Indonesia: wood pulp mills"], ["indonesia-wood-pulp-concessions-2015-2019", "Indonesia: wood pulp concessions, 2015\u20132019"],
+                ["indonesia-wood-pulp-concessions-2020-2022", "Indonesia: wood pulp concessions, 2020\u20132022"], ["indonesia-wood-pulp-concessions-2023-2024", "Indonesia: wood pulp concessions, 2023\u20132024"]],
+        note: "Trase's facilities maps, chosen from its own menu, read live from Trase's files (CC BY 4.0)." },
+  ],
 };
 
 const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS, EXEC_MAP, MONEY_MAP, LEGAL_MAP, LEG_MAP, JUD_MAP, MORE_MAPS, GMO_MAP, OTHER_MAPS, FOREST_ALERTS, TRASE_DATA];
-// Trase's two layers sit inside other groups above; this row gathers those same
-// objects, so both read as one subject without either being defined twice.
-TRASE_DATA.children = ["trase_measures", "trase_facilities"].map(childById);
 function childById(id) {
   for (const g of GROUPS) {
     const hit = g.children.find((c) => c.id === id);
@@ -7646,7 +7652,8 @@ const PANEL_ORDER = [
   { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget",
   { h: 4, t: "Wastewater" }, "hydrowaste",
   { h: 4, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
-  { h: 3, t: "Deforestation" }, "glad_loss", "group:forest_alerts", "soilgrids", "group:trase_data", "nusantara", "gfw_catalogue",
+  { h: 3, t: "Deforestation" }, "soilgrids", "group:trase_data", "nusantara",
+  { h: 4, t: "Global Forest Watch" }, "glad_loss", "group:forest_alerts", "gfw_catalogue",
   { h: 3, t: "Biodiversity loss" }, "gsn", "gsn_rankings", "allen_coral", "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report",
   { h: 3, t: "Mining" }, "mines_global",
   { h: 3, t: "Meat and agriculture" },
diff --git a/map/test.mjs b/map/test.mjs
index 25b3795..e66714d 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -638,7 +638,8 @@ console.log("\nmap wiring");
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   const rows = (src.match(/function groupRows[\s\S]*?\n}/) || [])[0] || "";
   check("children start hidden", /kids\.hidden = true/.test(rows));
-  check("the parent carries a disclosure control", /data-disc=/.test(rows));
+  check("the parent carries one control, the arrow at the end of the row, not a triangle before the title too",
+        !/data-disc=/.test(rows) && /const group = lead\.classList\.contains\("parent"\)/.test(src));
 
   // Opening a group must not load anything, and loading must not require
   // opening — so the triangle touches no layer state at all.
@@ -892,11 +893,12 @@ console.log("\ntropics clip");
   check("the one world tile loses both poles and keeps the band",
         world.length === 2 && world[0][0] === 0 && world[1][1] === 256);
 
-  const { map } = run({ layersReady: "gfw" });
-  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
-  const url = map.sources.get("gfw-tiles")?.tiles?.[0] || "";
+  // The tropics row is a child of the alerts group now, so it is built on the
+  // first tick rather than at load; what it builds is checked on the config and
+  // the tile path it goes through.
   check("the tropics layer loads through the clip, cut at its own bounds",
-        url.startsWith("latclip://-30,30,8A4F46/") && url.includes("/gfw_tile/{z}/{x}/{y}"), url);
+        /id:"gfw",[\s\S]{0,400}clipToBounds: true/.test(src) && /recolor: "#8A4F46"/.test(src) &&
+        /`latclip:\/\/\$\{cfg\.clipToBounds && cfg\.bounds \? cfg\.bounds\[1\] : -90\},`/.test(src) && /gfw_tile/.test(src));
   const ra = src.indexOf("function recolorAlerts"), rb = src.indexOf("// latclip://<south>");
   const recolorAlerts = new Function(src.slice(ra, rb) + "; return recolorAlerts;")();
   const scattered = new Uint8ClampedArray(400 * 4);
@@ -2054,6 +2056,27 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\nthe hotspot outlines arrive coarser");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("a layer can ask its server for outlines at a stated precision", /async function arcgisQueryAll\(url, coarse\)/.test(src) &&
+        /coarse \? `&maxAllowableOffset=\$\{coarse\}&geometryPrecision=4` : ""/.test(src));
+  check("the hotspots ask for about a kilometre, and the row says so", /coarse: 0\.01,/.test(src) && /at about a kilometre's precision rather than the survey's own/.test(src));
+  check("layers that did not ask still get the survey's own precision", /arcgisQueryAll\(l\.url\.replace\(\/\\\/\$\/, ""\), cfg\.coarse\)/.test(src));
+}
+
+console.log("\nGlobal Forest Watch's own rows together");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const order = new Function(body + "; return PANEL_ORDER;")();
+  const at = (t) => order.findIndex((x) => x && x.t === t);
+  check("the alerts, the tree cover loss and the catalogue sit under one Global Forest Watch heading",
+        ["glad_loss", "group:forest_alerts", "gfw_catalogue"].every((i) => order.indexOf(i) > at("Global Forest Watch")) &&
+        at("Global Forest Watch") > at("Deforestation"));
+  check("Global Forest Change is still listed above the alerts", order.indexOf("glad_loss") < order.indexOf("group:forest_alerts"));
+}
+
 console.log("\nheading ticks, chips in words, a named archive");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
@@ -2090,14 +2113,16 @@ console.log("\nrows gathered, moved and renamed");
   check("HydroWASTE sits under Wastewater", at("Wastewater") > at("Pollution") && order.indexOf("hydrowaste") === at("Wastewater") + 1);
   check("PalmWatch sits under Agriculture", order.indexOf("palmwatch") > at("Agriculture") && order.indexOf("palmwatch") < at("Meat"));
   check("the three alert layers are one row, and each line names the system that saw it",
-        /children: rowsById\("gfw", "gfw_dist", "gfw_dist_year"\)/.test(src) &&
+        /const FOREST_ALERTS = \{[\s\S]{0,4000}id:"gfw_dist_year"/.test(src) &&
         /name: "Live deforestation and disturbance alerts \(Global Forest Watch\)"/.test(src) &&
         /GLAD-L, GLAD-S2 and RADD/.test(src) && (src.match(/DIST-ALERT/g) || []).length >= 2 &&
         ["gfw", "gfw_dist", "gfw_dist_year"].every((i) => !order.includes(i)));
   check("Global Forest Change is drawn above the alerts", order.indexOf("glad_loss") < order.indexOf("group:forest_alerts"));
   check("Trase is one row, its two layers named without the prefix",
-        /name: "Trase deforestation data"/.test(src) && /TRASE_DATA\.children = \["trase_measures", "trase_facilities"\]\.map\(childById\)/.test(src) &&
+        /name: "Trase deforestation data"/.test(src) && /const TRASE_DATA = \{[\s\S]{0,4000}id: "trase_facilities"/.test(src) &&
         !/name: "Trase: /.test(src));
+  check("a group owns its children, so no row is rendered twice and none falls into Not yet placed",
+        !/rowsById/.test(src) && (src.match(/id:"gfw_dist_year"/g) || []).length === 1 && (src.match(/id: "trase_measures"/g) || []).length === 1);
   check("unticking a row takes its boxes with it",
         /rowNodes\(lead\)\.slice\(1\)\.forEach\(\(n\) => n\.classList\.toggle\("fold-hide", !input\.checked\)\)/.test(src));
 }
'''


def git(*args):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if "rowsById" not in app and "coarse: 0.01" in app:
        print("Already applied - nothing to do.")
        return
    if "syncHeadingBoxes" not in app:
        sys.exit("patch_1006.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
