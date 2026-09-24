#!/usr/bin/env python3
"""patch_0920hi.py - source links and 16 titles, and buildings that stand up.

    cd ~/Desktop/culprits
    python3 patch_0920hi.py

This replaces patch_0920h.py and patch_0920i.py, which were built before
patch_0920b.py went in and would not apply on top of it. Delete those two.
Goes on top of patch_0920g.py, with patch_0920b.py applied.

Item 8:
  - 14 titles that named no source now do - "Coal plant units (GEM Global Coal
    Plant Tracker)", "Power plants (WRI Global Power Plant Database)", and your
    own rows as the map they come from. Titles that already named a source,
    Trase's nine among them, are untouched.
  - 106 rows carry a small arrow beside the title, linking the site the row is
    read from: your own to the repo or page they come from, Trase's nine to
    trase.earth, everyone else's to their own site. A row with no site shows no
    link rather than a guessed one.
  - The arrow sits inside the row's label, and an anchor inside a label is not
    passed on to the tick, so opening a source does not turn its layer on.

Item 14: the real OpenStreetMap footprints, each raised to the height
OpenStreetMap records for it, drawn from zoom 15 and only while 3D terrain is
on. The tiles come from OpenFreeMap, which serves the OpenMapTiles schema with
no key and no request limit. A building with no recorded height and no floor
count is left out rather than given a height nobody stated. One muted stone
colour; nothing coloured by a value. OpenStreetMap, OpenMapTiles and OpenFreeMap
are credited on the source.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 21272cb..2b4d5b9 100644
--- a/map/app.js
+++ b/map/app.js
@@ -208,7 +208,7 @@ const CT_HISTORY = {
 };
 
 const LAYERS = [
-  { id:"owid_co2",             name:"National CO₂ emissions", unit:"Mt CO₂/yr", colour:"#8A5750", route:"country", ready:true, off:true },
+  { id:"owid_co2",             name:"National CO₂ emissions (Our World in Data)", unit:"Mt CO₂/yr", colour:"#8A5750", route:"country", ready:true, off:true },
   // Every row is ONE MONTH for one source, not one facility: 2021-01 through
   // 2026-06, 66 rows per source, confirmed from the harvest. Without a facet
   // the map stacks 66 coincident dots on every facility and the popup shows
@@ -226,14 +226,14 @@ const LAYERS = [
              defaultValues: [CT_MONTHS[CT_MONTHS.length - 1]] },
     note: "Monthly, 2021-01 to 2026-06. One month is shown at a time — pick others in the panel." },
 
-  { id:"gem_coal",             name:"Coal plant units",        unit:"MW capacity", colour:"#7A5548", route:"pmtiles", ready:true, off: true,
+  { id:"gem_coal",             name:"Coal plant units (GEM Global Coal Plant Tracker)",        unit:"MW capacity", colour:"#7A5548", route:"pmtiles", ready:true, off: true,
     radiusScale: 0.55,
     facet: { property: "x_status", label: "status",
              values: ["operating","construction","permitted","pre-permit","announced",
                       "shelved","mothballed","retired","cancelled"] } },
   { id:"global_energy_monitor",name:"GEM's other trackers",     unit:"capacity",   colour:"#7A5548", route:"pmtiles", ready:false },
   { id:"carbon_bombs",         name:"Carbon bombs",            unit:"Gt CO₂ lifetime", colour:"#6E4A44", route:"pmtiles", ready:true },
-  { id:"power_plants",         name:"Power plants",            unit:"MW capacity", colour:"#7E5A4E", route:"pmtiles", ready:true, off: true,
+  { id:"power_plants",         name:"Power plants (WRI Global Power Plant Database)",            unit:"MW capacity", colour:"#7E5A4E", route:"pmtiles", ready:true, off: true,
     radiusScale: 0.55,
     // The source covers every fuel and nothing is filtered out of the data.
     // Filtering happens here instead, where it is visible and reversible.
@@ -253,7 +253,7 @@ const LAYERS = [
   { id:"fertilizer_facilities",name:"Fertilizer plants",       unit:"ammonia / urea", colour:"#8A7C5C", route:"pmtiles", ready:true, off: true },
   { id:"soy_organizations",    name:"Soy industry bodies",     unit:"trade organisations", colour:"#6F7F72", route:"pmtiles", ready:true, off: true },
   { id:"trase",                name:"Commodity supply chains", unit:"ha",         colour:"#62755F", route:"pmtiles", ready:false },
-  { id:"land_matrix",          name:"Land deals",              unit:"hectares",   colour:"#6C7F63", route:"country", ready:true, off: true,  isolate:true },
+  { id:"land_matrix",          name:"Land deals (Land Matrix)",              unit:"hectares",   colour:"#6C7F63", route:"country", ready:true, off: true,  isolate:true },
   { id:"counterglow",          name:"Industrial animal farms", unit:"facilities", colour:"#7B7A5C", route:"pmtiles", ready:false },
   { id:"epa_tri",              name:"US toxic release sites",  unit:"TRI facilities", colour:"#5C6E77", route:"worker",  ready:true, off: true,
     // Upstream returns at most 500 rows per request, so a very large viewport
@@ -370,7 +370,7 @@ const LAYERS = [
   // From WelcomeToYourGalaxy/abattoir-atlas: its merged facility records, every
   // one, not the subset its own page draws. Share-alike (OSM rows and OSM-based
   // geocoding), so its archive is isolated, as local_projects is.
-  { id:"abattoir_facilities",  name:"Registered animal-use facilities \u2014 slaughterhouses, farms, dairies, hatcheries and zoos", unit:"facilities", colour:"#80605A", route:"pmtiles", ready:true, off: true,
+  { id:"abattoir_facilities",  name:"Registered animal-use facilities \u2014 slaughterhouses, farms, dairies, hatcheries and zoos (abattoir atlas)", unit:"facilities", colour:"#80605A", route:"pmtiles", ready:true, off: true,
     isolate:true,
     facet: { property: "x_slaughter", label: "slaughter",
              values: ["yes","no","not stated"],
@@ -429,7 +429,7 @@ const LAYERS = [
   // a second for 84 KB. Nothing is served below zoom 3. So shapes draw from
   // zoom 12, and wider out the layer says why it is empty rather than sitting
   // empty. The benthic set only; the Atlas's geomorphic set is not added here.
-  { id:"allen_coral",          name:"Coral reefs",      unit:"reefs (UNEP-WCMC) and habitat zones (Allen Coral Atlas)", colour:"#5E7377", route:"coral", ready:true, off: true,
+  { id:"allen_coral",          name:"Coral reefs (Allen Coral Atlas)",      unit:"reefs (UNEP-WCMC) and habitat zones (Allen Coral Atlas)", colour:"#5E7377", route:"coral", ready:true, off: true,
     drawFrom: 12,
     tiles: "https://allencoralatlas.org/geoserver/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
            "&LAYER=coral-atlas:benthic_data_verbose&STYLE=&TILEMATRIXSET=EPSG:900913" +
@@ -5086,6 +5086,55 @@ const TERRAIN_SOURCE = {
 const TERRAIN_EXAGGERATION = 1.4;
 let TERRAIN_ON = false;
 
+// Buildings, standing up, while the ground is tilted.
+//
+// Every basemap here is painted tiles, so a building on them is a picture of a
+// roof: tilt the map and the roofs lean with the ground, which is the flat,
+// slanted look. These are the real footprints from OpenStreetMap, each raised
+// to the height OpenStreetMap records for it, served by OpenFreeMap with no key
+// and no limit. render_height is OpenMapTiles' own figure, from the building's
+// height where it is recorded and from its floor count where it is not; a
+// building with neither is left out rather than given a height nobody stated.
+//
+// From zoom 15, and only while 3D terrain is on: at any wider view a building
+// is smaller than a pixel, and on the flat map there is nothing for them to
+// stand on.
+const BUILDINGS_SOURCE = {
+  type: "vector",
+  url: "https://tiles.openfreemap.org/planet",
+  attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> \u00b7 ' +
+    '<a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> \u00b7 ' +
+    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
+};
+const BUILDINGS_ZOOM = 15;
+function setBuildings3D(on) {
+  if (typeof map.getSource !== "function" || typeof map.addLayer !== "function") return;
+  if (!on) {
+    if (map.getLayer("buildings-3d")) map.setLayoutProperty("buildings-3d", "visibility", "none");
+    return;
+  }
+  if (!map.getSource("ofm-buildings")) map.addSource("ofm-buildings", BUILDINGS_SOURCE);
+  if (!map.getLayer("buildings-3d")) {
+    map.addLayer({
+      id: "buildings-3d", type: "fill-extrusion", source: "ofm-buildings", "source-layer": "building",
+      minzoom: BUILDINGS_ZOOM,
+      filter: ["all", ["has", "render_height"], ["!=", ["get", "hide_3d"], true]],
+      paint: {
+        // Stone, a shade off the ground, so a street reads as built rather than
+        // as another data layer. Nothing here is coloured by a value.
+        "fill-extrusion-color": "#7C7468",
+        // They rise as you come in, rather than appearing full height at 15.
+        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"],
+          BUILDINGS_ZOOM, 0, BUILDINGS_ZOOM + 1, ["get", "render_height"]],
+        "fill-extrusion-base": ["case", [">=", ["zoom"], BUILDINGS_ZOOM + 1],
+          ["coalesce", ["get", "render_min_height"], 0], 0],
+        "fill-extrusion-opacity": 0.85,
+      },
+    });
+  }
+  map.setLayoutProperty("buildings-3d", "visibility", "visible");
+}
+
 function setTerrain(on) {
   TERRAIN_ON = !!on;
   if (typeof map.setTerrain !== "function") return;
@@ -5109,6 +5158,7 @@ function setTerrain(on) {
       map.easeTo({ pitch: 0, duration: 500 });
     }
   }
+  setBuildings3D(TERRAIN_ON);
   const box = document.getElementById("terrain-toggle");
   if (box) box.checked = TERRAIN_ON;
 }
@@ -6769,7 +6819,7 @@ function groupRows(group) {
     row.innerHTML =
       `<input type="checkbox" data-layer="${child.id}">` +
       `<span class="swatch" style="background:${child.colour}"></span>` +
-      `<span class="body"><span class="nm">${child.name}</span>` +
+      `<span class="body"><span class="nm">${child.name}${siteLink(child.id)}</span>` +
       `<span class="un" data-state="${child.id}">not loaded</span></span>`;
     kids.appendChild(row);
   });
@@ -7080,17 +7130,17 @@ const GMO_MAP = {
   group: true,
   ready: true,
   children: [
-    { id: "gmo_cultivation", name: "Genetic-engineering cultivation", unit: "countries and regions", colour: "#6F6A5A", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_cultivation.geojson",
+    { id: "gmo_cultivation", name: "Genetic-engineering cultivation (Genetic engineering map)", unit: "countries and regions", colour: "#6F6A5A", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_cultivation.geojson",
       note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
-    { id: "gmo_gmofree", name: "GMO-free zones", unit: "zones", colour: "#5F6E5C", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_gmofree.geojson",
+    { id: "gmo_gmofree", name: "GMO-free zones (Genetic engineering map)", unit: "zones", colour: "#5F6E5C", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_gmofree.geojson",
       note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
-    { id: "gmo_incidents", name: "Contamination incidents", unit: "countries", colour: "#7A5A55", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_incidents.geojson",
+    { id: "gmo_incidents", name: "Contamination incidents (Genetic engineering map)", unit: "countries", colour: "#7A5A55", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_incidents.geojson",
       note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
-    { id: "gmo_regime", name: "Regulatory regimes", unit: "regime areas", colour: "#5E6470", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_regime.geojson",
+    { id: "gmo_regime", name: "Regulatory regimes (Genetic engineering map)", unit: "regime areas", colour: "#5E6470", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_regime.geojson",
       note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
-    { id: "gmo_treaties", name: "Biosafety and seed treaties", unit: "countries", colour: "#665E6C", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_treaties.geojson",
+    { id: "gmo_treaties", name: "Biosafety and seed treaties (Genetic engineering map)", unit: "countries", colour: "#665E6C", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_treaties.geojson",
       note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
-    { id: "gmo_trials", name: "Field trials", unit: "countries and regions", colour: "#6E6456", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_trials.geojson",
+    { id: "gmo_trials", name: "Field trials (Genetic engineering map)", unit: "countries and regions", colour: "#6E6456", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_trials.geojson",
       note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
   ],
 };
@@ -7103,10 +7153,10 @@ const OTHER_MAPS = {
   children: [
     { id: "palmwatch", name: "PalmWatch", unit: "palm oil mills", colour: "#87544A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/palmwatch.places.geojson",
       note: "PalmWatch (Inclusive Development International and the University of Chicago Data Science Institute), reread from PalmWatch every day. Each area is a mill's modelled sourcing area, not a property boundary; tree cover loss inside it is not measured as that mill's own clearing." },
-    { id: "usda_soybean", name: "Soybean Map Explorer", unit: "soybean growing areas", colour: "#6F7560", route: "arcgis", ready: true, lazy: true,
+    { id: "usda_soybean", name: "Soybean Map Explorer (USDA Foreign Agricultural Service)", unit: "soybean growing areas", colour: "#6F7560", route: "arcgis", ready: true, lazy: true,
       crop: "Soybean", service: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerSoybean/MapServer", attribution: "USDA Foreign Agricultural Service",
       note: "Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." },
-    { id: "usda_corn", name: "Corn Map Explorer", unit: "corn growing areas", colour: "#76705C", route: "arcgis", ready: true, lazy: true,
+    { id: "usda_corn", name: "Corn Map Explorer (USDA Foreign Agricultural Service)", unit: "corn growing areas", colour: "#76705C", route: "arcgis", ready: true, lazy: true,
       crop: "Corn", service: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerCorn/MapServer", attribution: "USDA Foreign Agricultural Service",
       note: "Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." },
     { id: "unep_coral", name: "Warm-water coral reefs (UNEP-WCMC)", unit: "reef areas", colour: "#B06F6A", route: "arcgis", ready: true, lazy: true,
@@ -7806,7 +7856,7 @@ function buildPanel() {
       // cannot take the map down with it.
       `<input type="checkbox"${cfg.off ? "" : " checked"} data-layer="${cfg.id}">` +
       `<span class="swatch" style="background:${cfg.colour}"></span>` +
-      `<span class="body"><span class="nm">${cfg.name}</span>` +
+      `<span class="body"><span class="nm">${cfg.name}${siteLink(cfg.id)}</span>` +
       `<span class="un" data-state="${cfg.id}">${cfg.unit}</span></span>`;
     box.appendChild(row);
     if (cfg.facet) box.appendChild(facetRow(cfg));
@@ -8144,6 +8194,128 @@ map.on("load", buildLegend);
 map.on("load", () => setTimeout(abattoirPartsInit, 0));
 map.on("load", () => setTimeout(mymapsTitles, 50));
 
+// The site each row is read from, linked beside its title. A reader looking at
+// a row should be one click from the people who published it - that is what
+// makes a claim checkable rather than something this map asserts. Your own maps
+// point at the repo or the page they are read from; everyone else's at their
+// own site. A row missing from here shows no link rather than a guessed one.
+const LAYER_SITE = {
+  abattoir_facilities: "https://raw.githubusercontent.com/WelcomeToYourGalaxy/abattoir-atlas/main/out/facilities.json.gz",
+  allen_coral: "https://allencoralatlas.org",
+  atlas_cities: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/",
+  atlas_hotspots: "https://atlas-for-the-end-of-the-world.com/hotspots/",
+  bocc: "https://www.bankingonclimatechaos.org/?bank=JPMorgan%20Chase#fulldata-panel",
+  carbon_bombs: "https://github.com/dataforgoodfr/CarbonBombs",
+  carbon_majors: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/destruction_embed_3_leaflet-map.html",
+  carbon_plumes: "https://carbonmapper.org",
+  cerulean_slicks: "https://cerulean.skytruth.org",
+  cerulean_sources: "https://cerulean.skytruth.org",
+  cfr_tracker: "https://public.tableau.com/views/CFRGlobalMonetaryPolicyTrackerNEW/GlobalMonetaryPolicyTracker?:showVizHome=no&:embed=y",
+  ct_pop: "https://tiles.climatetrace.org/ghsl-pop-1km/all",
+  dff: "https://deforestationfreefunds.org",
+  ejatlas: "https://ejatlas.org/api/v1/conflicts/",
+  epa_tri_sites: "https://data.epa.gov/efservice/tri_facility",
+  epa_widget: "https://geopub.epa.gov/arcgis/rest/services/EMEF/efpoints/MapServer",
+  esa_risk: "https://neo.ssa.esa.int/risk-list-plots",
+  final_nail: "https://finalnail.com/wp-json/wpgmza/v1/features/",
+  fishing: "https://globalfishingwatch.org",
+  fortune500: "https://interactives.fortune.com/global_500_2024/dashboard/index.html",
+  fractracker_refineries: "https://www.fractracker.org",
+  gem_coal: "https://github.com/GreenInfo-Network/coal-tracker-client",
+  gfw_catalogue: "https://data-api.globalforestwatch.org",
+  glad_loss: "https://storage.googleapis.com/earthenginepartners-hansen/tiles/gfc_v1.12/loss_alpha",
+  gmo_cultivation: "https://github.com/WelcomeToYourGalaxy/GMO-map",
+  gmo_gmofree: "https://github.com/WelcomeToYourGalaxy/GMO-map",
+  gmo_incidents: "https://github.com/WelcomeToYourGalaxy/GMO-map",
+  gmo_regime: "https://github.com/WelcomeToYourGalaxy/GMO-map",
+  gmo_treaties: "https://github.com/WelcomeToYourGalaxy/GMO-map",
+  gmo_trials: "https://github.com/WelcomeToYourGalaxy/GMO-map",
+  gpw_map: "https://globalplasticwatch.org/map",
+  gsn: "https://api.gsn.naturedatalab.org/geo-analysis/layers",
+  gsn_rankings: "https://www.globalsafetynet.app/rankings/",
+  land_matrix: "https://landmatrix.org/api",
+  local_projects: "https://github.com/WelcomeToYourGalaxy/local-map",
+  mymaps_chlorine: "https://www.google.com/maps/d/kml?mid=1PwPKisRf73FPC6hTtZDCv2s_B6_x0Pk7&forcekml=1",
+  mymaps_supp_a: "https://www.google.com/maps/d/kml?mid=1vrnqSW4cWWdnjz6cJ-qFMmd0zbJzYd6V&forcekml=1",
+  mymaps_supp_b: "https://www.google.com/maps/d/kml?mid=1seBCggQGg1tcRYpqpZ5ZKJaxHs4&forcekml=1",
+  mymaps_trees: "https://www.google.com/maps/d/kml?mid=1c-vPoGf79mfQezTgcFoKb-xN4A4&forcekml=1",
+  nusantara: "https://map.nusantara-atlas.org/geoserver/atlas-workspace-v3/wms",
+  owid_co2: "https://github.com/owid/co2-data",
+  palmwatch: "https://palmwatch.inclusivedevelopment.net/",
+  pe_bankrolling: "https://portfolio.earth/campaigns/bankrolling-extinction/",
+  pe_subsidising: "https://portfolio.earth/campaigns/subsidising-extinction/",
+  pirg_plastic: "https://pirg.org/resources/where-is-plastic-produced/",
+  power_plants: "https://github.com/wri/global-power-plant-database",
+  powerbi_report: "https://app.powerbi.com/view?r=eyJrIjoiZGJmNGIwODgtMTgyMS00NmVlLWJmNWUtZTAzZDBlMmQ1ODI2IiwidCI6IjBiMzNkZjAwLTYzNGMtNDBlYy1iOGQ5LTZhMGI2MjYyNmU1ZCJ9",
+  remains_cemeteries: "https://github.com/WelcomeToYourGalaxy/remains",
+  remains_findings: "https://github.com/WelcomeToYourGalaxy/remains",
+  remains_records: "https://github.com/WelcomeToYourGalaxy/remains",
+  rte_trade: "https://api.resourcetrade.earth/api/rt/2.7",
+  scribd_doc: "https://www.scribd.com/embeds/401203705/content?start_page=1&view_mode=scroll&access_key=key-9NzI5oK8PppZP3Bfluct",
+  seas_of_plastic: "https://app.dumpark.com/seas-of-plastic-2/app/data/AllStations.geojson",
+  site_animal_fighting: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/destruction_embed_1_leaflet-map.html",
+  site_animal_racing: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/racing-map-embed.html",
+  site_animal_sacrifice: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/sacrifice_map.html",
+  site_animal_tourism: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/suppression_embed_25_leaflet-map.html",
+  site_banking_dynasties: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/suppression_embed_29_leaflet-map.html",
+  site_central_banks: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/suppression_embed_18_leaflet-map.html",
+  site_china_grain: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/destruction_embed_11_leaflet-map.html",
+  site_circus: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/suppression_embed_26_leaflet-map.html",
+  site_earmarked_funding: "https://github.com/WelcomeToYourGalaxy/maps",
+  site_enslaved_microbes: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_enslaved_plants: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_export_credit: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_eyes_network: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_food_system: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_forest500_soy: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/destruction_embed_9_leaflet-map.html",
+  site_indigenous_conflicts: "https://github.com/WelcomeToYourGalaxy/maps",
+  site_insentient: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_research_integrity: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_rodeo: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_secret_societies: "https://www.welcometoyourgalaxy.com/on-planet-invasion.html",
+  site_settler_colonialism: "https://github.com/WelcomeToYourGalaxy/maps",
+  site_social_spheres: "https://github.com/WelcomeToYourGalaxy/maps",
+  site_soybean_companies: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/soybean_companies.html",
+  site_trade_profits: "https://github.com/WelcomeToYourGalaxy/maps",
+  site_wealth_atlas: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_world_advertising: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_world_entertainment: "https://www.welcometoyourgalaxy.com/suppression.html",
+  site_world_news: "https://www.welcometoyourgalaxy.com/suppression.html",
+  skytruth_monitor: "https://monitor.skytruth.org/",
+  slavery_cases: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
+  slavery_determinations: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
+  slavery_enforcement: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
+  slavery_fishing: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
+  slavery_ports: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
+  slavery_prevalence: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
+  slavery_routes: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
+  slavery_sites: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
+  soilgrids: "https://maps.isric.org/mapserv?map=/map",
+  tableau_zsf: "https://public.tableau.com/shared/ZSF724HPQ?:showVizHome=no&:embed=y",
+  theyrule: "https://theyrule.net/",
+  trase_cocoa_ivory: "https://trase.earth/open-data",
+  trase_measures: "https://resources.trase.earth/data/trase-regions",
+  trase_meat_brazil: "https://trase.earth/open-data",
+  trase_palm_indonesia: "https://trase.earth/open-data",
+  trase_pulp_concessions_2015: "https://trase.earth/open-data",
+  trase_pulp_concessions_2020: "https://trase.earth/open-data",
+  trase_pulp_concessions_2023: "https://trase.earth/open-data",
+  trase_pulp_indonesia: "https://trase.earth/open-data",
+  trase_silos_brazil: "https://trase.earth/open-data",
+  troutwood: "https://map.troutwood.com/",
+  usda_corn: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerCorn/MapServer",
+  usda_soybean: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerSoybean/MapServer",
+  wreckers_umap: "https://umap.openstreetmap.fr/en",
+};
+function siteLink(id) {
+  const u = LAYER_SITE[id];
+  if (!u) return "";
+  let host = u;
+  try { host = new URL(u).hostname.replace(/^www\./, ""); } catch (e) { /* shown whole */ }
+  return `<a class="src" href="${escapeHtml(u)}" target="_blank" rel="noopener" ` +
+    `title="Open ${escapeHtml(host)}" aria-label="Open ${escapeHtml(host)}, the source of this layer">\u2197</a>`;
+}
+
 /* ---------- the layers box, in the order and under the headings chosen ---------- */
 // Strings are layer ids; "group:" a whole group; "gm" the guerillamap row.
 // { h: level, t: text } is a heading. Anything not named here goes under
diff --git a/map/index.html b/map/index.html
index e84ca5b..0e720be 100644
--- a/map/index.html
+++ b/map/index.html
@@ -41,6 +41,10 @@
   #layers .layer input{margin:0}
   #layers .swatch{width:10px;height:10px;border-radius:2px;margin:0}
   #layers .layer .un{display:none;font-size:11px;line-height:1.3}
+  /* The source's own site, beside the title. A link inside a label is not
+     passed on to the tick, so opening it does not turn the layer on. */
+  #layers .nm .src{margin-left:5px;color:var(--dim);text-decoration:none;font-size:10.5px;opacity:.7}
+  #layers .nm .src:hover{color:var(--bone);opacity:1}
   #layers .layer:has(> input:checked){align-items:flex-start}
   #layers .layer:has(> input:checked){padding:2px 0}
   #layers .layer:has(> input:checked) > input,#layers .layer:has(> input:checked) > .swatch{margin-top:2px}
diff --git a/map/test.mjs b/map/test.mjs
index b1f1f88..2b3e1f6 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2438,6 +2438,44 @@ console.log("\nNusantara's layers say what they show");
         /title: NUSANTARA_NAMES\[id\] \|\| \(tt && tt\.textContent\) \|\| id/.test(src));
 }
 
+console.log("\neach row links the site it is read from");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
+  const sites = new Function(src.slice(src.indexOf("const LAYER_SITE = {"), src.indexOf("function siteLink(")) + "; return LAYER_SITE;")();
+  check("most rows carry a site", Object.keys(sites).length > 90 &&
+        Object.values(sites).every((u) => /^https?:\/\//.test(u) && !u.includes("{")));
+  check("your own rows point at the repo or page they are read from",
+        /github\.com\/WelcomeToYourGalaxy\//.test(sites.gmo_cultivation || "") &&
+        /github\.com\/WelcomeToYourGalaxy\/anti-slavery-map/.test(sites.slavery_ports || ""));
+  check("Trase's rows point at Trase", /trase\.earth/.test(sites.trase_palm_indonesia || ""));
+  check("the link is drawn beside the title, on a row and on a group's child",
+        /<span class="nm">\$\{cfg\.name\}\$\{siteLink\(cfg\.id\)\}<\/span>/.test(src) &&
+        /<span class="nm">\$\{child\.name\}\$\{siteLink\(child\.id\)\}<\/span>/.test(src));
+  check("a row with no site shows no link rather than a guessed one",
+        /const u = LAYER_SITE\[id\];\n  if \(!u\) return "";/.test(src) && /#layers \.nm \.src\{/.test(index));
+  check("titles that named no source say so now",
+        /name:"Coal plant units \(GEM Global Coal Plant Tracker\)"/.test(src) &&
+        /name: "Genetic-engineering cultivation \(Genetic engineering map\)"/.test(src));
+}
+
+console.log("\nbuildings stand up with the terrain");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const BUILDINGS_SOURCE ="), src.indexOf("function setTerrain("));
+  check("real footprints, from a source that needs no key",
+        /url: "https:\/\/tiles\.openfreemap\.org\/planet"/.test(body) && /"source-layer": "building"/.test(body) &&
+        /type: "fill-extrusion"/.test(body));
+  check("each is raised to the height the source records, and one without a height is left out",
+        /\["get", "render_height"\]/.test(body) && /\["has", "render_height"\]/.test(body));
+  check("only close in, and only while the ground is tilted",
+        /minzoom: BUILDINGS_ZOOM/.test(body) && /const BUILDINGS_ZOOM = 15;/.test(body) &&
+        /setBuildings3D\(TERRAIN_ON\);/.test(src));
+  check("OpenStreetMap and the two that serve it are credited",
+        /openstreetmap\.org\/copyright/.test(body) && /openmaptiles\.org/.test(body) && /openfreemap\.org/.test(body));
+  check("nothing orange, yellow or neon in the walls", /"fill-extrusion-color": "#7C7468"/.test(body));
+}
+
 console.log("\nGlobal Safety Net fixes; My Maps titles");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
"""


def run(args, text=None):
    return subprocess.run(args, input=text, capture_output=True, text=True)


def main():
    if run(["git", "rev-parse", "--is-inside-work-tree"]).returncode != 0:
        sys.exit("Not a git repository. Run this from ~/Desktop/culprits.")
    try:
        app = open("map/app.js", encoding="utf-8").read()
    except OSError:
        sys.exit("map/app.js not found. Run this from the top of the repo.")
    if "NUSANTARA_NAMES" not in app:
        sys.exit("patch_0920g.py has to be applied and committed first.")
    if "trase_palm_indonesia" not in app:
        sys.exit("patch_0920b.py has to be applied and committed first.")
    if run(["git", "apply", "--check", "--reverse", "-"], DIFF).returncode == 0:
        print("Already applied - nothing to do.")
        return
    check = run(["git", "apply", "--check", "-"], DIFF)
    if check.returncode != 0:
        print(check.stderr.strip())
        sys.exit("Does not apply cleanly.")
    out = run(["git", "apply", "-"], DIFF)
    if out.returncode != 0:
        print(out.stderr.strip())
        sys.exit("git apply failed.")
    print("Applied. Changed: map/app.js, map/index.html, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
