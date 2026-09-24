#!/usr/bin/env python3
"""
Round of 23 September (16): the wastewater watersheds row, six more site maps split into a row per type, and
Trase's GDP per capita row taken out. Built against 5f7cf87.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 846a588..0902079 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -830,6 +830,21 @@ saves after each day, stops at 100 minutes, and carries on next run
 (`cerulean_archive/refill.json`). Mines' first file is 96.7 MB (92 MiB), under
 the 95 MiB cut.
 
+## Round of 23 September (16): owner's answers of 23 September
+
+- EPA: every dot kept from the world view (the owner's choice), 17 MB first square.
+- Wastewater watersheds: row `wastewater_watersheds` (route `pmtareas`, a new
+  area route: fill in 7 plum-to-bone steps from `wastewater/watersheds.key.json`,
+  records from `wastewater/pieces` by basin id). Built by culprits-tiles-more
+  `scripts/wastewater_watersheds.py` (by hand).
+- Forest and land cover stays as it is.
+- Trase's "GDP per capita" (Colombia) measure is dropped (`TRASE_REMOVED`).
+- Six more site maps split by their popup tag into a row per type
+  (`types_from_popup_tag` in the registry, `typeRows: true` in app.js):
+  world news, advertising, entertainment, research integrity, indigenous
+  conflicts, self-sufficiency. The empty refresh rebuilds them; a map whose
+  tags do not split cleanly keeps its one row.
+
 ## Round of 23 September (11): the modelled farms' squares made light
 
 The unmerged CAFO archive's world square was 3.6 MB. `abattoir_cafo.py` now
diff --git a/map/app.js b/map/app.js
index eff2b04..f047383 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3393,6 +3393,7 @@ function traseFormat(x) {
 // states, never both, or the same ground would be coloured twice): by default
 // the municipality level where Trase publishes the measure there, otherwise
 // the first level Trase lists for it - the same default the single row used.
+const TRASE_REMOVED = [/^GDP per capita\b/i];
 function traseMeasures(cat) {
   const byId = new Map();
   for (const ck of Object.keys(cat || {}).sort()) {
@@ -3457,7 +3458,9 @@ async function addTraseLayer(cfg) {
     return;
   }
   cfg._regions = regions;
-  const entries = traseMeasures(cat.countries || {});
+  // The owner asked for Trase's "GDP per capita" measure (Colombia only) to be
+  // taken out of the box (23 September); every other measure stays.
+  const entries = traseMeasures(cat.countries || {}).filter((e) => !TRASE_REMOVED.some((r) => r.test(e.name || "")));
   const drawn = new Map();          // measure id -> the layer ids it drew
   const safe = (x) => String(x).replace(/[^a-z0-9_]/gi, "_");
   cfg._layerIds = [];
@@ -3739,6 +3742,27 @@ function addGlwLayer(cfg) {
   setLayerState(cfg.id, "FAO's modelled grid of how many animals are kept where, 2020");
   applyVisibility(cfg.id);
 }
+// Areas from a PMTiles archive, shaded by each area's value in steps its build
+// wrote beside it (key: { breaks: [...] }), with every field read from the
+// record's piece on a click. First used for the wastewater model's watersheds.
+const AREA_RAMP = ["#2E2433", "#4A3346", "#6B4458", "#8C5A68", "#A97E80", "#C7ABA2", "#E3D7CB"];
+async function addPmtAreasLayer(cfg) {
+  if (!cfg || map.getSource(`${cfg.id}-src`)) return;
+  let key = {};
+  try { key = await getJson(cfg.keyUrl, 20000); } catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
+  const breaks = (key.breaks || []).filter((b) => Number.isFinite(b)).slice(0, AREA_RAMP.length - 1);
+  const v = ["to-number", ["get", "value"], 0];
+  const colour = breaks.length ? ["step", v, AREA_RAMP[0], ...breaks.flatMap((b, i) => [b, AREA_RAMP[i + 1]])] : AREA_RAMP[3];
+  map.addSource(`${cfg.id}-src`, { type: "vector", url: `pmtiles://${cfg.archiveUrl}`, attribution: "Tuholske et al. 2021, Global Wastewater Model, KNB" });
+  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-src`, "source-layer": cfg.sourceLayer, layout: { visibility: "none" },
+    paint: { "fill-color": colour, "fill-opacity": 0.7 } }, pointLayerAbove());
+  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-src`, "source-layer": cfg.sourceLayer, layout: { visibility: "none" },
+    paint: { "line-color": "#C7ABA2", "line-width": 0.4, "line-opacity": 0.5 } }, pointLayerAbove());
+  cfg._layerIds = [`${cfg.id}-fill`, `${cfg.id}-line`];
+  bindHtmlPopup(`${cfg.id}-fill`, (p) => pieceBox(cfg, p));
+  setLayerState(cfg.id, breaks.length ? `${(key.count || 0).toLocaleString()} areas, in ${breaks.length + 1} steps` : "areas");
+  applyVisibility(cfg.id);
+}
 function addCafoLayer(cfg) {
   if (!cfg || map.getSource(`${cfg.id}-cafo-src`)) return;
   map.addSource(`${cfg.id}-cafo-src`, { type: "vector", url: `pmtiles://${CAFO_TILES}`,
@@ -8524,13 +8548,13 @@ const SITE_MAPS = {
       note: "From the Suppression page's wealth atlas." },
     { id: "site_food_system", name: "Who Owns the", unit: "companies", colour: "#6E6A55", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_food_system.places.geojson",
       note: "From the Suppression page's food system ownership map." },
-    { id: "site_world_advertising", name: "World Advertising 2026 — Companies & Owners", unit: "companies", colour: "#6C5F66", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_world_advertising.places.geojson",
+    { id: "site_world_advertising", typeRows: true, name: "World Advertising 2026 — Companies & Owners", unit: "companies", colour: "#6C5F66", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_world_advertising.places.geojson",
       note: "From the Suppression page's World Advertising 2026 map." },
-    { id: "site_world_news", name: "World News 2026 — Outlets & Owners", unit: "outlets and owners", colour: "#626A6F", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_world_news.places.geojson",
+    { id: "site_world_news", typeRows: true, name: "World News 2026 — Outlets & Owners", unit: "outlets and owners", colour: "#626A6F", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_world_news.places.geojson",
       note: "From the Suppression page's World News 2026 map." },
-    { id: "site_research_integrity", name: "World Research Integrity 2026 — Who's Breaking Science", unit: "institutions and publishers", colour: "#5F6E6A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_research_integrity.places.geojson",
+    { id: "site_research_integrity", typeRows: true, name: "World Research Integrity 2026 — Who's Breaking Science", unit: "institutions and publishers", colour: "#5F6E6A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_research_integrity.places.geojson",
       note: "From the Suppression page's research integrity map." },
-    { id: "site_world_entertainment", name: "World Entertainment 2026 — Companies & Owners", unit: "companies", colour: "#6D5E5A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_world_entertainment.places.geojson",
+    { id: "site_world_entertainment", typeRows: true, name: "World Entertainment 2026 — Companies & Owners", unit: "companies", colour: "#6D5E5A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_world_entertainment.places.geojson",
       note: "From the Suppression page's World Entertainment 2026 map." },
     { id: "site_eyes_network", name: "The Network That Tried to Harness the Eyes to Harvest the World", unit: "places", colour: "#5B6360", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_eyes_network.places.geojson",
       note: "From the Suppression page's sports section network map." },
@@ -8550,13 +8574,13 @@ const SITE_MAPS = {
       note: "From the Suppression page's map of industries built on things called insentient." },
     { id: "site_subsistence_cultures", name: "Global Subsistence Cultures", unit: "peoples", colour: "#5F7166", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_subsistence_cultures.places.geojson",
       note: "From the Suppression page's subsistence cultures map." },
-    { id: "site_self_sufficiency", name: "Why some famous programs aren’t on this map", unit: "programs", colour: "#5E6F5B", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_self_sufficiency.places.geojson",
+    { id: "site_self_sufficiency", typeRows: true, name: "Why some famous programs aren’t on this map", unit: "programs", colour: "#5E6F5B", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_self_sufficiency.places.geojson",
       note: "From the Solution page's self-sufficiency programs map." },
     { id: "site_environment_law", name: "Environmental law instruments", unit: "legal instruments", colour: "#5A6B72", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_environment_law.pmtiles",
       note: "From the Destruction page's environmental law map (enviro-atlas repo)." },
     { id: "site_cartel_cells", name: "Cartel cells", unit: "cells and sites", colour: "#6A5A58", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_cartel_cells.places.geojson",
       note: "From the Suppression page's cartel cells map (maps repo), with its connecting lines." },
-    { id: "site_indigenous_conflicts", name: "Indigenous Environmental Conflicts", unit: "conflicts", colour: "#6B5A4A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_indigenous_conflicts.places.geojson",
+    { id: "site_indigenous_conflicts", typeRows: true, name: "Indigenous Environmental Conflicts", unit: "conflicts", colour: "#6B5A4A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_indigenous_conflicts.places.geojson",
       note: "From local-map's Indigenous Environmental Conflicts map (EJAtlas cases, real coordinates)." },
     { id: "enviro_law_by_country", name: "Environmental law by country and region (enviro-atlas)", unit: "countries", colour: "#5A6B72", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/enviro_law_by_country.geojson",
       note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
@@ -9115,6 +9139,10 @@ const OTHER_MAPS = {
         { label: "Hydrochlorofluorocarbons (HCFCs)", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/edgar_fgases_hcfcs.pmtiles" }
       ],
       note: "EDGAR's gridded emissions of each group of fluorinated gases (refrigerants, foam blowing, solvents, electrical insulation, aluminium and chip making), every 0.1-degree cell with a value, from the latest year in EDGAR's release, coloured dark to light on a log scale cut at the values' own steps. Each chip is one gas group in tonnes of that gas; the groups are not added together, as a tonne of one warms very differently from a tonne of another. The year, file and unit of each are in edgar/edgar_fgases_<gas>.key.json in culprits-tiles-more. Built from EDGAR's yearly release; it is not updated between releases." },
+    { id: "wastewater_watersheds", name: "Nitrogen from human wastewater, by the watershed it drains from (Tuholske et al.)", unit: "grams of nitrogen a year", colour: "#5E7377", route: "pmtareas", ready: true, lazy: true,
+      archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_watersheds.pmtiles", keyUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wastewater/watersheds.key.json",
+      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wastewater/pieces", sourceLayer: "watersheds",
+      note: "The Global Wastewater Model's watersheds: the land each coastal outlet drains, shaded by all the nitrogen from human wastewater that reaches the sea from it, dark to light on a log scale cut at the values' own steps. A click shows every figure the model gives for it. Built once from the model's 2021 data package (scripts/wastewater_watersheds.py in culprits-tiles-more); it is not updated." },
     { id: "wastewater_plumes", name: "Nitrogen from human wastewater in coastal waters, 2015 (Tuholske et al.)", unit: "per map cell", colour: "#5E7377", route: "rasterlive", ready: true, lazy: true,
       attribution: "Tuholske et al. 2021, Global Wastewater Model (KNB doi:10.5063/F76B09)", maxzoom: 6,
       choices: [
@@ -9374,6 +9402,7 @@ function ensureLayer(cfg) {
       : cfg.route === "slickarchive" ? addSlickArchive(cfg)
       : cfg.route === "carbonmapper" ? addCarbonMapperLayer(cfg)
     : cfg.route === "cafo" ? Promise.resolve().then(() => addCafoLayer(cfg))
+      : cfg.route === "pmtareas" ? addPmtAreasLayer(cfg)
       : cfg.route === "glw" ? Promise.resolve().then(() => addGlwLayer(cfg))
       : cfg.route === "arcgisdyn" ? addArcgisDynLayer(cfg)
       : cfg.route === "giga" ? addGigaLayer(cfg)
@@ -9581,6 +9610,7 @@ const LAYER_KIND = {
   coastal_cleanup: ["insentient", "downstream"],
   food_soy: ["plant", "downstream"], food_maize: ["plant", "downstream"],
   wastewater_plumes: ["insentient", "downstream"],
+  wastewater_watersheds: ["insentient", "downstream"],
   edgar_fgases: ["insentient", "downstream"],
   wasteatlas_dumpsites: ["insentient", "downstream"],
   wasteatlas_landfills: ["insentient", "downstream"],
@@ -9881,6 +9911,7 @@ map.on("load", () => {
       // had one. That is what broke the two modelled meat rows when they were
       // split out: named here, and marked lazy so the first tick builds them.
       else if (cfg.route === "cafo") addCafoLayer(cfg);
+      else if (cfg.route === "pmtareas") addPmtAreasLayer(cfg);
       else if (cfg.route === "glw") addGlwLayer(cfg);
       else if (cfg.route === "carbonmapper") {
         addCarbonMapperLayer(cfg).catch((e) => setLayerState(cfg.id, `failed (${e.message})`));
@@ -10088,6 +10119,7 @@ const LAYER_SITE = {
   seas_of_plastic: "https://app.dumpark.com/seas-of-plastic-2/",
   food_soy: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B",
   wastewater_plumes: "https://knb.ecoinformatics.org/view/doi:10.5063/F76B09",
+  wastewater_watersheds: "https://knb.ecoinformatics.org/view/doi:10.5063/F76B09",
   edgar_fgases: "https://edgar.jrc.ec.europa.eu/dataset_ghg2025", food_maize: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B",
   wasteatlas_dumpsites: "http://www.atlas.d-waste.com/",
   wasteatlas_landfills: "http://www.atlas.d-waste.com/",
@@ -10310,6 +10342,7 @@ const NOT_LIVE = {
   coastal_cleanup: "Ocean Conservancy's cleanup sites, from a copy made daily (their server lets only their own site read it)",
   food_soy: "Built once from the 2017 data package of Halpern et al. 2022; it is not updated",
   wastewater_plumes: "Built once from the Global Wastewater Model's 2021 data package; it is not updated",
+  wastewater_watersheds: "Built once from the Global Wastewater Model's 2021 data package; it is not updated",
   edgar_fgases: "Built from EDGAR's yearly release; it is not updated between releases",
   food_maize: "Built once from the 2017 data package of Halpern et al. 2022; it is not updated",
   wasteatlas_dumpsites: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
@@ -10403,7 +10436,7 @@ const PANEL_ORDER = [
   { h: 4, t: "Nitrogen dioxide" },
   // The model's map server is gone; its data package is drawn instead
   // (pipeline/wastewater_build.py, 23 September).
-  { h: 4, t: "Wastewater" }, "hydrowaste", "wastewater_n_tot", "wastewater_n_treated", "wastewater_n_septic", "wastewater_n_open", "wastewater_n_countries", "wastewater_plumes",
+  { h: 4, t: "Wastewater" }, "hydrowaste", "wastewater_n_tot", "wastewater_n_treated", "wastewater_n_septic", "wastewater_n_open", "wastewater_watersheds", "wastewater_n_countries", "wastewater_plumes",
   // Waste Atlas (item 44), one row per kind of place it maps (23 September).
   { h: 4, t: "Solid waste" }, "wasteatlas_dumpsites", "wasteatlas_landfills", "wasteatlas_wte", "wasteatlas_mbt", "wasteatlas_bt", "wasteatlas_cities", "wasteatlas_countries",
   { h: 4, t: "Plastics" },
diff --git a/map/test.mjs b/map/test.mjs
index 8f276bf..7cc8e35 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1821,9 +1821,11 @@ console.log("\nTrase, and coral at world zoom");
   {
     const build = fs.readFileSync(path.join(HERE, "..", "pipeline", "sitemaps", "build_boxes.py"), "utf8");
     const reg = JSON.parse(fs.readFileSync(path.join(HERE, "..", "pipeline", "sitemaps", "registry.json"), "utf8")).maps;
-    check("the site-map build reads a place's type from its popup tag, for the three maps asked for and no others",
+    check("the site-map build reads a place's type from its popup tag, for the nine maps asked for and no others",
           /def popup_types\(features\):/.test(build) && /if not filters and m\.get\("types_from_popup_tag"\):/.test(build) &&
-          reg.filter((m) => m.types_from_popup_tag).map((m) => m.id).sort().join() === "site_enslaved_microbes,site_enslaved_plants,site_insentient");
+          // Six more asked for on 23 September.
+          reg.filter((m) => m.types_from_popup_tag).map((m) => m.id).sort().join() ===
+            "site_enslaved_microbes,site_enslaved_plants,site_indigenous_conflicts,site_insentient,site_research_integrity,site_self_sufficiency,site_world_advertising,site_world_entertainment,site_world_news");
     check("\u2026and each of those maps has a row per type in the box, in place of its one row",
           ["site_enslaved_plants", "site_enslaved_microbes", "site_insentient"].every((i) => new RegExp(`id: "${i}", typeRows: true`).test(src)) &&
           /readCataloguesAtStart\(\);\n  readSiteTypeRowsAtStart\(\);/.test(src) && /own_nodes\.forEach\(\(n\) => gone\.appendChild\(n\)\)/.test(src));
@@ -3411,5 +3413,19 @@ console.log("\nround of 23 September (15): the rows say their points are no long
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   check("no row's note still says its points are merged where they crowd", !/note: "[^"\n]*merged where they crowd/.test(src) && !/note: "[^"\n]*merged into counted points/.test(src));
 }
+console.log("\nround of 23 September (16): watersheds, six more type rows, Trase's GDP row out");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("the wastewater model's watersheds are a row under Wastewater, shaded in the steps their build wrote, each record read from its piece",
+        /id: "wastewater_watersheds"[^\n]*route: "pmtareas"/.test(src) && /"wastewater_n_open", "wastewater_watersheds",/.test(src) &&
+        /async function addPmtAreasLayer\(cfg\)/.test(src) && /bindHtmlPopup\(`\$\{cfg\.id\}-fill`, \(p\) => pieceBox\(cfg, p\)\)/.test(src));
+  const ramp = src.match(/const AREA_RAMP = \[([^\]]*)\]/)[1].match(/#[0-9A-F]{6}/gi);
+  const warm = (h) => { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return r > 150 && g > 110 && b < 90; };
+  check("…its colours carry no orange or yellow", ramp.length === 7 && !ramp.some(warm));
+  check("the six more site maps each have a row per type", ["site_world_news", "site_world_advertising", "site_world_entertainment", "site_research_integrity",
+        "site_indigenous_conflicts", "site_self_sufficiency"].every((i) => new RegExp(`id: "${i}", typeRows: true`).test(src)));
+  const T = new Function(src.match(/const TRASE_REMOVED = [^\n]*\n/)[0] + "; return TRASE_REMOVED;")();
+  check("Trase's GDP per capita row is out of the box, and no other measure", T.some((r) => r.test("GDP per capita")) && !T.some((r) => r.test("Soy deforestation exposure")));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
diff --git a/pipeline/sitemaps/build_boxes.py b/pipeline/sitemaps/build_boxes.py
index c22b07a..9c1df1a 100644
--- a/pipeline/sitemaps/build_boxes.py
+++ b/pipeline/sitemaps/build_boxes.py
@@ -491,10 +491,11 @@ def build(m):
     chain, name = page_facts(data.get("page"), data.get("map_container"), data.get("headings"), m["name"])
 
     filters, marks = map_filters(data, data["features"], None)
-    # Only for the maps the registry names ("types_from_popup_tag"): the three the
-    # owner asked to have split. Six more of the site's maps tag their popups the
-    # same way (world news, advertising, entertainment, research integrity,
-    # indigenous conflicts, self-sufficiency) and would split just as cleanly.
+    # Only for the maps the registry names ("types_from_popup_tag"): the plants,
+    # microorganisms and insentient maps, and since 23 September, at the owner's
+    # word, world news, advertising, entertainment, research integrity,
+    # indigenous conflicts and self-sufficiency. A popup with several tags is
+    # typed by its first, the map's own leading word for the place.
     if not filters and m.get("types_from_popup_tag"):
         by_tag, tag_marks = popup_types(data["features"])
         if by_tag:
diff --git a/pipeline/sitemaps/registry.json b/pipeline/sitemaps/registry.json
index ba3c00a..0ed5439 100644
--- a/pipeline/sitemaps/registry.json
+++ b/pipeline/sitemaps/registry.json
@@ -119,7 +119,8 @@
    "unit": "companies",
    "colour": "#6C5F66",
    "note": "From the Suppression page's World Advertising 2026 map.",
-   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_world_advertising.html"
+   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_world_advertising.html",
+   "types_from_popup_tag": true
   },
   {
    "id": "site_world_news",
@@ -127,7 +128,8 @@
    "unit": "outlets and owners",
    "colour": "#626A6F",
    "note": "From the Suppression page's World News 2026 map.",
-   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_world_news.html"
+   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_world_news.html",
+   "types_from_popup_tag": true
   },
   {
    "id": "site_research_integrity",
@@ -135,7 +137,8 @@
    "unit": "institutions and publishers",
    "colour": "#5F6E6A",
    "note": "From the Suppression page's research integrity map.",
-   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_research_integrity.html"
+   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_research_integrity.html",
+   "types_from_popup_tag": true
   },
   {
    "id": "site_world_entertainment",
@@ -143,7 +146,8 @@
    "unit": "companies",
    "colour": "#6D5E5A",
    "note": "From the Suppression page's World Entertainment 2026 map.",
-   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_world_entertainment.html"
+   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_world_entertainment.html",
+   "types_from_popup_tag": true
   },
   {
    "id": "site_eyes_network",
@@ -186,7 +190,8 @@
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_rodeo.html"
   },
   {
-   "id": "site_enslaved_plants", "types_from_popup_tag": true,
+   "id": "site_enslaved_plants",
+   "types_from_popup_tag": true,
    "name": "Unnecessary enslavement of plants",
    "unit": "companies",
    "colour": "#62705A",
@@ -194,7 +199,8 @@
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_enslaved_plants.html"
   },
   {
-   "id": "site_enslaved_microbes", "types_from_popup_tag": true,
+   "id": "site_enslaved_microbes",
+   "types_from_popup_tag": true,
    "name": "Unnecessary enslavement of microorganisms",
    "unit": "companies",
    "colour": "#6A6E62",
@@ -202,7 +208,8 @@
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_enslaved_microbes.html"
   },
   {
-   "id": "site_insentient", "types_from_popup_tag": true,
+   "id": "site_insentient",
+   "types_from_popup_tag": true,
    "name": "The insentient",
    "unit": "companies",
    "colour": "#66625E",
@@ -223,7 +230,8 @@
    "unit": "programs",
    "colour": "#5E6F5B",
    "note": "From the Solution page's self-sufficiency programs map.",
-   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_self_sufficiency.html"
+   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/site/site_self_sufficiency.html",
+   "types_from_popup_tag": true
   },
   {
    "id": "site_environment_law",
@@ -247,7 +255,8 @@
    "unit": "conflicts",
    "colour": "#6B5A4A",
    "note": "From local-map's Indigenous Environmental Conflicts map (local-map repo).",
-   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/local-map/main/indigenous_conflicts_map_REAL.html"
+   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/local-map/main/indigenous_conflicts_map_REAL.html",
+   "types_from_popup_tag": true
   }
  ]
 }
'''

if "mollweide_inverse" not in (pathlib.Path.cwd() / "pipeline/wastewater_build.py").read_text() if (pathlib.Path.cwd() / "pipeline/wastewater_build.py").exists() else True:
    sys.exit("round_0923d.py has to be applied first; nothing was changed.")
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
