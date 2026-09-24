#!/usr/bin/env python3
"""
Round of 23 September (8): the EPA row draws its copy from one file per zoom when the list says so
(and its points go with the row when unticked); Waste Atlas as seven rows by kind; soy and maize from
Halpern et al. 2022 with four pressures each. Built against d0feaaa.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index e36c4cc..ff94aca 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -761,6 +761,33 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 23 September (7): the EPA copy, rebuilt in parts
+
+The first unmerged EPA build was over 95 MB at every depth, and the old
+script then deleted the last copy (commit aff4631 in culprits-tiles-more).
+The owner restores it from ecef1f0. `scripts/epa_efpoints.py` now builds one
+file per zoom 0 to 6 (`epa_efpoints_z<z>.pmtiles`, the map draws EPA's own
+picture from 6.5), each point carrying only `_lid` and `_oid`, listed in
+`epa_efpoints.build.json`; the files replace the old copy only if all fit; a
+failed try writes `epa_efpoints.tried.json` with the sizes and keeps the copy.
+Rebuilt every four weeks. The map reads the list (one file if there is none),
+registers the layers in `cfg._layerIds` so unticking the row hides them, and
+names a point from EPA's record on a click.
+
+Waste Atlas rows (item 44): the copy holds 4,606 markers (2 with no position)
+in seven categories: city 1,799, Sanitary Landfills 1,626, WtE 716, country
+164, MBT 130, Dumpsites 93, Biological Treatment 78. One `geojsonlive` row
+per category (`files[].only = [field, value]`), under Pollution > Solid waste;
+dumpsites and landfills copied under Climate > Methane, WtE under Carbon
+dioxide. Soy and maize (item 24): `food_soy`, `food_maize` (rasterlive, four
+chips each) from culprits-tiles-more `scripts/food_crops.py` (by hand), which
+reads eight rasters out of `crops_food_feed_raw.zip` by byte range and builds
+`tiles/food_<crop>_<pressure>.pmtiles` and `food/<same>.key.json`.
+
+Waste Atlas: its data is `http://www.atlas.d-waste.com/uploads/data.xml`
+(https has an expired certificate); `scripts/wasteatlas.py` copies it weekly.
+Soy and corn: `scripts/food_list.py` lists the package's zips.
+
 ## Round of 23 September (6): every point at every zoom (item 25); soy and corn (item 24)
 
 - **No merged points.** The owner asked for every dot at every zoom. The
diff --git a/map/app.js b/map/app.js
index db51b7b..c062d7f 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3870,6 +3870,8 @@ async function readGeojsonFiles(cfg) {
   let nowhere = 0;
   for (const f of cfg.files) {
     const got = await getJson(f.url, 60000);
+    // A file that holds several kinds, one row per kind: only: [field, value].
+    if (f.only && got && Array.isArray(got.features)) got.features = got.features.filter((ft) => String((ft.properties || {})[f.only[0]]) === f.only[1]);
     const gj = Array.isArray(got) ? { features: recordsAsFeatures(got) }
       : (got && !got.features && Array.isArray(got.entries)) ? { features: recordsAsFeatures(got.entries) } : got;
     (gj.features || []).forEach((ft, i) => {
@@ -6034,7 +6036,7 @@ async function addArcgisDynLayer(cfg) {
       b.classList.toggle("on", on.has(id));
       const s = map.getSource(src);
       if (s && s.setTiles) s.setTiles(tilesFor());
-      if (map.getLayer(`${cfg.id}-pts`)) map.setFilter(`${cfg.id}-pts`, ptsFilter());
+      for (const l of ptsLayers) if (map.getLayer(l)) map.setFilter(l, ptsFilter());
     });
     anchor.after(el);
   }
@@ -6043,36 +6045,56 @@ async function addArcgisDynLayer(cfg) {
   function ptsFilter() {
     return ["any", [">", ["coalesce", ["get", "point_count"], 1], 1], ["in", ["get", "_lid"], ["literal", [...on]]]];
   }
+  // The copy may be one file, or (since 23 September, every point drawn with
+  // none merged) one file per zoom, listed in epa_efpoints.build.json.
+  const ptsLayers = [];
+  const layerName = (lid) => ((layers.find((l) => String(l.id) === String(lid)) || {}).name || "");
   if (cfg.points) {
+    let parts = [{ url: cfg.points, from: 0, to: 22 }];
     try {
-      map.addSource(`${cfg.id}-pts-src`, { type: "vector", url: `pmtiles://${cfg.points}`, attribution: cfg.attribution || "" });
-      const n = ["coalesce", ["get", "point_count"], 1];
-      map.addLayer({ id: `${cfg.id}-pts`, type: "circle", source: `${cfg.id}-pts-src`, "source-layer": "efpoints",
-        maxzoom: cfg.minzoom || 22, filter: ptsFilter(),
-        paint: { "circle-color": cfg.colour, "circle-opacity": 0.8,
-                 "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["+", 1.4, ["*", 0.8, ["log10", n]]], 6, ["+", 2.6, ["*", 1, ["log10", n]]]] } },
-        `${cfg.id}-raster`);
-      map.on("click", `${cfg.id}-pts`, async (e) => {
-        const f = e.features && e.features[0];
-        if (!f) return;
-        const p = f.properties;
-        const pop = new maplibregl.Popup({ maxWidth: "340px" }).setLngLat(e.lngLat);
-        if (Number(p.point_count) > 1) {
-          pop.setHTML(`<b>${Number(p.point_count).toLocaleString()} EPA facilities here</b><div class="meta">Merged at this zoom. Zoom in to see each one.</div>`).addTo(map);
-          return;
-        }
-        pop.setHTML(`<b>${escapeHtml(p.name || "")}</b><div class="meta">${escapeHtml(p._layer || "")} \u00b7 asking EPA\u2026</div>`).addTo(map);
-        try {
-          const j = await getJson(`${cfg.service}/${p._lid}/query?objectIds=${encodeURIComponent(p._oid)}&outFields=*&returnGeometry=false&f=json`, 20000);
-          const at = ((j.features || [])[0] || {}).attributes || {};
-          pop.setHTML(`<b>${escapeHtml(p.name || "")}</b><div class="meta">${escapeHtml(p._layer || "")}</div>` +
-            `<table class="meta">${fieldRows(Object.fromEntries(Object.entries(at).filter(([k, v]) => v !== "Null" && v != null && !/^(OBJECTID|Shape)$/i.test(k))))}</table>` +
-            `<div class="meta">US EPA Envirofacts</div>`);
-        } catch (err) {
-          pop.setHTML(`<b>${escapeHtml(p.name || "")}</b><div class="meta">${escapeHtml(p._layer || "")} \u00b7 EPA did not answer (${escapeHtml(err.message)})</div>`);
-        }
-      });
-    } catch (e) { console.warn("[culprits] EPA points:", e.message); }
+      const st = await getJson(cfg.points.replace(/\.pmtiles$/, ".build.json"), 15000);
+      if (st && Array.isArray(st.parts) && st.parts.length) {
+        parts = st.parts.map((p) => ({ url: cfg.points.replace(/[^/]+$/, p.file), from: Number(p.from), to: Number(p.to) }));
+      }
+    } catch (e) { /* no list: the one file */ }
+    const vis = visibility.get(cfg.id) || "visible";
+    cfg._layerIds = cfg._layerIds || [];
+    parts.forEach((part, i) => {
+      const sid = `${cfg.id}-pts-src${i || ""}`, lid = `${cfg.id}-pts${i || ""}`;
+      try {
+        map.addSource(sid, { type: "vector", url: `pmtiles://${part.url}`, attribution: cfg.attribution || "" });
+        const n = ["coalesce", ["get", "point_count"], 1];
+        map.addLayer({ id: lid, type: "circle", source: sid, "source-layer": "efpoints",
+          minzoom: part.from, maxzoom: Math.min(part.to + 1, cfg.minzoom || 22), filter: ptsFilter(), layout: { visibility: vis },
+          paint: { "circle-color": cfg.colour, "circle-opacity": 0.8,
+                   "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["+", 1.4, ["*", 0.8, ["log10", n]]], 6, ["+", 2.6, ["*", 1, ["log10", n]]]] } },
+          `${cfg.id}-raster`);
+        ptsLayers.push(lid);
+        cfg._layerIds.push(lid);
+        map.on("click", lid, async (e) => {
+          const f = e.features && e.features[0];
+          if (!f) return;
+          const p = f.properties;
+          const kind = p._layer || layerName(p._lid);
+          const pop = new maplibregl.Popup({ maxWidth: "340px" }).setLngLat(e.lngLat);
+          if (Number(p.point_count) > 1) {
+            pop.setHTML(`<b>${Number(p.point_count).toLocaleString()} EPA facilities here</b><div class="meta">Merged at this zoom. Zoom in to see each one.</div>`).addTo(map);
+            return;
+          }
+          pop.setHTML(`<b>${escapeHtml(p.name || "EPA facility")}</b><div class="meta">${escapeHtml(kind)} \u00b7 asking EPA\u2026</div>`).addTo(map);
+          try {
+            const j = await getJson(`${cfg.service}/${p._lid}/query?objectIds=${encodeURIComponent(p._oid)}&outFields=*&returnGeometry=false&f=json`, 20000);
+            const at = ((j.features || [])[0] || {}).attributes || {};
+            const title = p.name || Object.entries(at).find(([k, v]) => /name/i.test(k) && v && v !== "Null")?.[1] || "EPA facility";
+            pop.setHTML(`<b>${escapeHtml(String(title))}</b><div class="meta">${escapeHtml(kind)}</div>` +
+              `<table class="meta">${fieldRows(Object.fromEntries(Object.entries(at).filter(([k, v]) => v !== "Null" && v != null && !/^(OBJECTID|Shape)$/i.test(k))))}</table>` +
+              `<div class="meta">US EPA Envirofacts</div>`);
+          } catch (err) {
+            pop.setHTML(`<b>${escapeHtml(p.name || "EPA facility")}</b><div class="meta">${escapeHtml(kind)} \u00b7 EPA did not answer (${escapeHtml(err.message)})</div>`);
+          }
+        });
+      } catch (e) { console.warn("[culprits] EPA points:", e.message); }
+    });
   }
   map.on("click", async (e) => {
     if ((visibility.get(cfg.id) || "visible") !== "visible" || !map.getLayer(`${cfg.id}-raster`) || map.getZoom() < (cfg.minzoom || 0) || !on.size) return;
@@ -8737,6 +8759,27 @@ const OTHER_MAPS = {
     { id: "gfw_catalogue", name: "Global Forest Watch / Global Nature Watch: every dataset", unit: "datasets", colour: "#62755F", route: "gfwmenu", ready: true, lazy: true,
       api: "https://data-api.globalforestwatch.org",
       note: "Its whole data catalogue, read live; a dataset draws from its own published tiles when it has them." },
+    { id: "wasteatlas_dumpsites", name: "Dumpsites (Waste Atlas)", unit: "dumpsites", colour: "#6A6258", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Dumpsites", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wasteatlas/places.geojson", only: ["category", "Dumpsites"] }],
+      note: "Waste Atlas (D-Waste, with ISWA and the University of Leeds): the markers its own map draws with the category Dumpsites, every figure in its box kept; copied weekly by culprits-tiles-more, since the site answers only over plain http." },
+    { id: "wasteatlas_landfills", name: "Sanitary landfills (Waste Atlas)", unit: "landfills", colour: "#6A6258", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Sanitary landfills", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wasteatlas/places.geojson", only: ["category", "Sanitary Landfills"] }],
+      note: "Waste Atlas (D-Waste, with ISWA and the University of Leeds): the markers its own map draws with the category Sanitary Landfills, every figure in its box kept; copied weekly by culprits-tiles-more, since the site answers only over plain http." },
+    { id: "wasteatlas_wte", name: "Waste-to-energy plants (incinerators) (Waste Atlas)", unit: "plants", colour: "#6A6258", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Waste-to-energy plants (incinerators)", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wasteatlas/places.geojson", only: ["category", "WtE"] }],
+      note: "Waste Atlas (D-Waste, with ISWA and the University of Leeds): the markers its own map draws with the category WtE, every figure in its box kept; copied weekly by culprits-tiles-more, since the site answers only over plain http." },
+    { id: "wasteatlas_mbt", name: "Mechanical-biological treatment plants (Waste Atlas)", unit: "plants", colour: "#6A6258", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Mechanical-biological treatment plants", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wasteatlas/places.geojson", only: ["category", "MBT"] }],
+      note: "Waste Atlas (D-Waste, with ISWA and the University of Leeds): the markers its own map draws with the category MBT, every figure in its box kept; copied weekly by culprits-tiles-more, since the site answers only over plain http." },
+    { id: "wasteatlas_bt", name: "Biological treatment plants (Waste Atlas)", unit: "plants", colour: "#6A6258", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Biological treatment plants", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wasteatlas/places.geojson", only: ["category", "Biological Treatment"] }],
+      note: "Waste Atlas (D-Waste, with ISWA and the University of Leeds): the markers its own map draws with the category Biological Treatment, every figure in its box kept; copied weekly by culprits-tiles-more, since the site answers only over plain http." },
+    { id: "wasteatlas_cities", name: "Cities' waste figures (Waste Atlas)", unit: "cities", colour: "#6A6258", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Cities' waste figures", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wasteatlas/places.geojson", only: ["category", "city"] }],
+      note: "Waste Atlas (D-Waste, with ISWA and the University of Leeds): the markers its own map draws with the category city, every figure in its box kept; copied weekly by culprits-tiles-more, since the site answers only over plain http." },
+    { id: "wasteatlas_countries", name: "Countries' waste figures (Waste Atlas)", unit: "countries", colour: "#6A6258", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Countries' waste figures", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wasteatlas/places.geojson", only: ["category", "country"] }],
+      note: "Waste Atlas (D-Waste, with ISWA and the University of Leeds): the markers its own map draws with the category country, every figure in its box kept; copied weekly by culprits-tiles-more, since the site answers only over plain http." },
     { id: "coastal_cleanup", name: "Coastal Cleanup (Ocean Conservancy)", unit: "cleanup sites", colour: "#5F6B70", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Cleanups", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/coastal/cleanups.geojson" }],
       note: "Ocean Conservancy's cleanup sites, copied daily by culprits-tiles-more (its server lets only its own site read it)." },
@@ -8990,6 +9033,24 @@ const OTHER_MAPS = {
         { label: "Silt, 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/silt.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=silt_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" }
       ],
       note: "ISRIC's SoilGrids map server, read live. Each chip is one soil property at 0\u20135 cm depth, as SoilGrids publishes it." },
+    { id: "food_soy", name: "Soy: greenhouse gases, water, nutrients and disturbance, 2017 (Halpern et al.)", unit: "per map cell", colour: "#6A4A5E", route: "rasterlive", ready: true, lazy: true,
+      attribution: "Halpern et al. 2022; Frazier et al., Global food system pressure data (KNB doi:10.5063/F1V69H1B)", maxzoom: 6,
+      choices: [
+        { label: "Greenhouse gases", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_soyb_ghg.pmtiles" },
+        { label: "Freshwater use", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_soyb_water.pmtiles" },
+        { label: "Nutrient pollution", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_soyb_nutrient.pmtiles" },
+        { label: "Habitat disturbance", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_soyb_disturbance.pmtiles" }
+      ],
+      note: "What growing soy put on the land in 2017, food and feed together, mapped by Halpern et al. 2022 (Nature Sustainability) from their data package. Each chip is one of its four pressures, per map cell, coloured dark to light on a log scale cut at the values' own steps (food/<name>.key.json in culprits-tiles-more). Built once from the package; it is not updated." },
+    { id: "food_maize", name: "Maize (corn): greenhouse gases, water, nutrients and disturbance, 2017 (Halpern et al.)", unit: "per map cell", colour: "#6A4A5E", route: "rasterlive", ready: true, lazy: true,
+      attribution: "Halpern et al. 2022; Frazier et al., Global food system pressure data (KNB doi:10.5063/F1V69H1B)", maxzoom: 6,
+      choices: [
+        { label: "Greenhouse gases", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_maiz_ghg.pmtiles" },
+        { label: "Freshwater use", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_maiz_water.pmtiles" },
+        { label: "Nutrient pollution", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_maiz_nutrient.pmtiles" },
+        { label: "Habitat disturbance", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_maiz_disturbance.pmtiles" }
+      ],
+      note: "What growing maize (corn) put on the land in 2017, food and feed together, mapped by Halpern et al. 2022 (Nature Sustainability) from their data package. Each chip is one of its four pressures, per map cell, coloured dark to light on a log scale cut at the values' own steps (food/<name>.key.json in culprits-tiles-more). Built once from the package; it is not updated." },
     { id: "wastewater", name: "Global Wastewater Model (Tuholske et al.)", unit: "nitrogen from human wastewater", colour: "#5E7377", route: "rasterlive", ready: true, lazy: true,
       attribution: "Tuholske et al. 2021, Global Wastewater Model", maxzoom: 10,
       choices: [
@@ -9370,6 +9431,14 @@ const LAYER_KIND = {
   nusantara: ["plant", "downstream"],
   gfw_catalogue: ["plant", "downstream"],
   coastal_cleanup: ["insentient", "downstream"],
+  food_soy: ["plant", "downstream"], food_maize: ["plant", "downstream"],
+  wasteatlas_dumpsites: ["insentient", "downstream"],
+  wasteatlas_landfills: ["insentient", "downstream"],
+  wasteatlas_wte: ["insentient", "downstream"],
+  wasteatlas_mbt: ["insentient", "downstream"],
+  wasteatlas_bt: ["insentient", "downstream"],
+  wasteatlas_cities: ["insentient", "downstream"],
+  wasteatlas_countries: ["insentient", "downstream"],
   atlas_hotspots: ["plant", "downstream"],
   atlas_cities: ["human", "downstream"],
   wreckers_umap: ["insentient", "upstream"],
@@ -9866,6 +9935,14 @@ const LAYER_SITE = {
   pe_subsidising: "https://portfolio.earth/campaigns/subsidising-extinction/",
   powerbi_report: "https://app.powerbi.com/view?r=eyJrIjoiZGJmNGIwODgtMTgyMS00NmVlLWJmNWUtZTAzZDBlMmQ1ODI2IiwidCI6IjBiMzNkZjAwLTYzNGMtNDBlYy1iOGQ5LTZhMGI2MjYyNmU1ZCJ9",
   seas_of_plastic: "https://app.dumpark.com/seas-of-plastic-2/",
+  food_soy: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B", food_maize: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B",
+  wasteatlas_dumpsites: "http://www.atlas.d-waste.com/",
+  wasteatlas_landfills: "http://www.atlas.d-waste.com/",
+  wasteatlas_wte: "http://www.atlas.d-waste.com/",
+  wasteatlas_mbt: "http://www.atlas.d-waste.com/",
+  wasteatlas_bt: "http://www.atlas.d-waste.com/",
+  wasteatlas_cities: "http://www.atlas.d-waste.com/",
+  wasteatlas_countries: "http://www.atlas.d-waste.com/",
   skytruth_monitor: "https://monitor.skytruth.org/",
   skytruth_voc: "https://monitor.skytruth.org/",
   skytruth_nrc: "https://monitor.skytruth.org/",
@@ -10056,6 +10133,15 @@ function liveMark(cfg) {
 // Every row now carries one mark or the other (22 September, round 3).
 const NOT_LIVE = {
   coastal_cleanup: "Ocean Conservancy's cleanup sites, from a copy made daily (their server lets only their own site read it)",
+  food_soy: "Built once from the 2017 data package of Halpern et al. 2022; it is not updated",
+  food_maize: "Built once from the 2017 data package of Halpern et al. 2022; it is not updated",
+  wasteatlas_dumpsites: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
+  wasteatlas_landfills: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
+  wasteatlas_wte: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
+  wasteatlas_mbt: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
+  wasteatlas_bt: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
+  wasteatlas_cities: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
+  wasteatlas_countries: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
   space_industry: "openmaps.space's places, from a copy made daily",
   gta_acts: "Global Trade Alert's acts, from a copy made daily",
   giga_countries: "Giga's figures, from a copy made daily (its service does not let other sites read it)",
@@ -10111,11 +10197,11 @@ const PANEL_ORDER = [
   { h: 4, t: "Emitting sites by sector, until split by gas" }, "group:climate_trace_sectors", "group:climate_trace_agriculture", "group:climate_trace_forestry", "group:ct_history",
   // Carbon bombs, the Carbon Majors and Banking on Climate Chaos under Carbon
   // dioxide, and nitrogen dioxide moved to Pollution (22 September, round 2).
-  { h: 4, t: "Carbon dioxide" }, "owid_co2", "gem_coal", "power_plants", "fractracker_refineries", "carbon_plumes", "carbon_bombs", "carbon_majors", "bocc",
-  { h: 4, t: "Methane" }, "carbon_plumes", "hydrowaste",
+  { h: 4, t: "Carbon dioxide" }, "owid_co2", "gem_coal", "power_plants", "fractracker_refineries", "carbon_plumes", "carbon_bombs", "carbon_majors", "bocc", "wasteatlas_wte",
+  { h: 4, t: "Methane" }, "carbon_plumes", "hydrowaste", "wasteatlas_dumpsites", "wasteatlas_landfills",
   { h: 4, t: "Nitrous oxide" }, "fertilizer_facilities",
-  { h: 5, t: "Soy" }, "trase_silos_brazil",
-  { h: 5, t: "Corn" },
+  { h: 5, t: "Soy" }, "trase_silos_brazil", "food_soy",
+  { h: 5, t: "Corn" }, "food_maize",
   { h: 5, t: "Grain" }, "site_china_grain",
   { h: 4, t: "F-gases" },
   { h: 4, t: "Black carbon" }, "fractracker_refineries", "ct_air_bc",
@@ -10141,6 +10227,8 @@ const PANEL_ORDER = [
   // The model's map server is gone; its data package is drawn instead
   // (pipeline/wastewater_build.py, 23 September).
   { h: 4, t: "Wastewater" }, "hydrowaste", "wastewater_n_tot", "wastewater_n_treated", "wastewater_n_septic", "wastewater_n_open", "wastewater_n_countries",
+  // Waste Atlas (item 44), one row per kind of place it maps (23 September).
+  { h: 4, t: "Solid waste" }, "wasteatlas_dumpsites", "wasteatlas_landfills", "wasteatlas_wte", "wasteatlas_mbt", "wasteatlas_bt", "wasteatlas_cities", "wasteatlas_countries",
   { h: 4, t: "Plastics" },
   { h: 5, t: "Production" }, "pirg_plastic", "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch",
   { h: 5, t: "Waste and dumping" }, "gpw_map", "seas_of_plastic", "coastal_cleanup",
@@ -10167,7 +10255,7 @@ const PANEL_ORDER = [
   { h: 3, t: "Meat and agriculture" }, "site_food_system",
   { h: 4, t: "Agriculture" },
   { h: 5, t: "Palm oil" }, "palmwatch", "trase_palm_indonesia",
-  { h: 5, t: "Soy, corn and grain" }, "trase_silos_brazil", "site_china_grain",
+  { h: 5, t: "Soy, corn and grain" }, "trase_silos_brazil", "site_china_grain", "food_soy", "food_maize",
   { h: 5, t: "Cocoa and cotton" }, "trase_cocoa_ivory",
   { h: 5, t: "Farm inputs" }, "fertilizer_facilities",
   { h: 5, t: "Moratoriums" },
diff --git a/map/test.mjs b/map/test.mjs
index 13730be..057a3ee 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2288,9 +2288,9 @@ console.log("\nNusantara Atlas and Global Forest Watch, by category");
 console.log("\nEPA facilities at every zoom");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
-  check("wider out, the EPA row draws the weekly copy of every point", /epa_efpoints\.pmtiles/.test(src) && /id: `\$\{cfg\.id\}-pts`, type: "circle"/.test(src) && /maxzoom: cfg\.minzoom \|\| 22/.test(src));
+  check("wider out, the EPA row draws the weekly copy of every point", /epa_efpoints\.pmtiles/.test(src) && /map\.addLayer\(\{ id: lid, type: "circle", source: sid, "source-layer": "efpoints"/.test(src) && /maxzoom: Math\.min\(part\.to \+ 1, cfg\.minzoom \|\| 22\)/.test(src));
   check("a point's full record is asked of EPA on click", /\/query\?objectIds=\$\{encodeURIComponent\(p\._oid\)\}&outFields=\*/.test(src));
-  check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
+  check("the kind buttons also filter the copy", /for \(const l of ptsLayers\) if \(map\.getLayer\(l\)\) map\.setFilter\(l, ptsFilter\(\)\);/.test(src));
 }
 
 console.log("\nthe column's edge, the meat rows, the reefs close in");
@@ -3328,5 +3328,30 @@ console.log("\nround of 23 September (6): every point at every zoom; the food pa
   const knb = fs.readFileSync(path.join(HERE, "..", "pipeline", "knb_list.py"), "utf8");
   check("the food-footprint package (Halpern et al. 2022) is listed from KNB before a build is written", /doi:10\.5063\/F1V69H1B/.test(knb));
 }
+console.log("\nround of 23 September (7): the EPA copy in one file per zoom");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("the EPA row reads its copy's list of files, one per zoom, and draws each at its own zoom",
+        /cfg\.points\.replace\(\/\\\.pmtiles\$\/, "\.build\.json"\)/.test(src) && /minzoom: part\.from/.test(src));
+  check("\u2026and those layers go with the row when it is unticked", /cfg\._layerIds\.push\(lid\);/.test(src));
+  check("\u2026a point with only its ids is named from EPA's own record on a click", /\/name\/i\.test\(k\)/.test(src));
+}
+console.log("\nround of 23 September (8): Waste Atlas rows; soy and maize from Halpern et al.");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const o = new Function(body + "; return { PANEL_ORDER };")().PANEL_ORDER;
+  const kinds = ["dumpsites", "landfills", "wte", "mbt", "bt", "cities", "countries"];
+  check("Waste Atlas is one row per kind of place, each reading only its own kind from the weekly copy",
+        kinds.every((k) => new RegExp(`id: "wasteatlas_${k}"[^\\n]*route: "geojsonlive"`).test(src)) && /only: \["category", "Dumpsites"\]/.test(src) &&
+        /got\.features = got\.features\.filter\(\(ft\) => String\(\(ft\.properties \|\| \{\}\)\[f\.only\[0\]\]\) === f\.only\[1\]\)/.test(src));
+  const at = (t) => o.findIndex((x) => x && x.t === t);
+  check("\u2026all under Pollution > Solid waste, dumpsites and landfills copied under Methane, incinerators under Carbon dioxide",
+        kinds.every((k) => o.lastIndexOf(`wasteatlas_${k}`) > at("Solid waste")) &&
+        /\{ h: 4, t: "Methane" \}, [^\n]*"wasteatlas_dumpsites", "wasteatlas_landfills"/.test(src) && /\{ h: 4, t: "Carbon dioxide" \}, [^\n]*"wasteatlas_wte"/.test(src));
+  check("soy and maize each have a row with the four pressures as chips, under Nitrous oxide and under Agriculture",
+        ["soyb", "maiz"].every((c) => ["ghg", "water", "nutrient", "disturbance"].every((p) => src.includes(`food_${c}_${p}.pmtiles`))) &&
+        o.includes("food_soy") && o.includes("food_maize"));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
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
