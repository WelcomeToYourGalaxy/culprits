#!/usr/bin/env python3
"""
Rounds of 22 September (3) and (4) together, rebuilt on top of the two commits
another session pushed ("Tang and Werner mine features as a row; Forest and
land cover back" and "The glow made finer"). Replaces round_0922c.py and
round_0922d.py, which no longer fit; delete those two.

- the filing report's findings: word edges, GFW analysis tables out, dated
  Intact Forest Landscapes kept, untitled datasets named
- LIVE / NOT LIVE on every row; light edges on GFW areas; vessels at full strength
- the four driver rows and two protected-area rows titled apart, with what is
  known about them in their i boxes
- Carbon Mapper plumes no longer merged
- map/check-sources.mjs

Built against main at 5dbeb61. Run from the repo root:  python3 round_0922cd.py
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index a0a76a8..046fcb7 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -420,6 +420,61 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 22 September (4): same-name rows told apart, plumes unmerged, a source check
+
+- **Four "Tree cover loss by dominant driver" rows and two worldwide protected
+  area rows** are titled apart in `GFW_TITLES` (source at the end), and
+  `GFW_ABOUT` puts what is known about how they differ first in each row's
+  "i" box, ahead of GFW's own description. Where the records do not say how
+  two differ, the box says that rather than guessing.
+- **Carbon Mapper plumes are no longer merged** (item 25, map side): the
+  source has no `cluster`, the counted `-cl` layer and `CARBON_CLUSTER_TO` are
+  gone, and every plume is its own point at every zoom, with the glow under
+  them showing where they crowd.
+- **Still merged, in culprits-tiles-more**: mines points, mine feature points,
+  CAFO, EPA facilities and the SkyTruth feeds (`--cluster-densest-as-needed`),
+  and Cerulean's slick points in this repo (`pipeline/cerulean/harvest_points.py`).
+  Unmerging them means lifting the tile-size cap they were merged to meet, so
+  the world tiles grow; each needs its world-tile weight measured first.
+- **`node map/check-sources.mjs`** asks every row reported as not drawing
+  (USDA soybean and corn, Trase soy silos, EJAtlas, Wreckers of the Earth,
+  Materials research, Seas of Plastic, the wastewater archives, Nusantara's
+  fire alerts) what it answers, with timing and whether it sends a CORS
+  header; reads the records, assets and COG pixel values of the GFW pictures
+  that draw grey (the driver rows, WUR driver class, DIST-ALERT, burned areas,
+  mining concessions) so their colours and keys can be built from what the
+  pixels actually are; and lists the files in the wastewater package on KNB.
+
+## Round of 22 September (3): what the filing report showed, live marks, legibility
+
+Read from the owner's run of `map/filing-report.mjs`:
+
+- **Word edges.** "drivers" matched `river` (Surface water) and "disturbance"
+  matched `urban` (Construction); both rules now need a word start.
+- **Rules by name see the id as well** (`title + " " + id`). Global Forest
+  Watch's analysis tables - any id with `__`, the per-country, per-province,
+  per-protected-area and per-shape alert counts - are taken out: they are
+  tables and never draw. `wur_alert_drivers` is taken out (no tiles, item 10).
+- **The dated Intact Forest Landscapes (2000, 2013, 2016, 2020) stay** under
+  Biodiversity loss. Round 2's rule took out any title without "global"; the
+  report showed those rows are years, not regions.
+- **Titles from records** (`GFW_TITLES`, which now wins over GFW's own title):
+  the WUR driver class and date rows, the coverage row (said to be one shape
+  with no drivers in it), the 10 km soy buffer, IFL 2025, and the two worldwide
+  protected-area sets told apart (public WDPA release, and the copy licensed to
+  GFW). `GFW_WHERE` replaces a coverage record that is a sentence (major dams).
+- **LIVE / NOT LIVE (item 43).** Every row carries one. `NOT_LIVE` lists rows
+  whose route reads live but which draw a copy: Coastal Cleanup, space
+  industry, Global Trade Alert, Giga, the wastewater model, Trase's measures
+  (values weekly, shapes live), Atlas cities (places weekly). Catalogue rows
+  take their catalogue's mark rather than a hard-coded LIVE.
+- **Areas from Global Forest Watch get a light edge** (`-o-` line layer, bone,
+  1.6 px at the world view) in place of a near-black outline, so mines and
+  concessions show as specks from far out (item 37).
+- **Vessels of concern glow at full strength** (`GLOW_FULL`): a few dozen
+  points with no amounts were weighed at a tenth each and could not be found
+  from the world view (item 41).
+
 ## Round of 22 September (2): the box refiled, rows taken out
 
 The owner sent 44 items; this round is the filing and removal ones (1, 2, 3, 5,
diff --git a/map/app.js b/map/app.js
index 6dfe316..e818839 100644
--- a/map/app.js
+++ b/map/app.js
@@ -1258,7 +1258,13 @@ const GLOW = {
   fadeOut: 9, gone: 12,                        // haze and cores: full to 9, gone by 12; the dots the other way
 };
 const glowMaxOf = new Map();                   // source id -> the largest "value" in it, from the archive's own stats
+// Layers of a few dozen points with no amounts: each point glows at full
+// strength, or at the world view they are too faint to find (22 September,
+// round 3: the vessels of concern).
+const GLOW_FULL = new Set(["skytruth_voc"]);
+const glowFull = (layer) => GLOW_FULL.has(String(layer.source || "").replace(/-src$/, ""));
 function glowWeight(layer) {
+  if (glowFull(layer)) return 1;
   const max = glowMaxOf.get(layer.source);
   const count = ["max", 1, ["coalesce", ["to-number", ["get", "_count"]], 1]];
   if (!max) return ["min", 1, ["/", ["log2", ["+", 1, count]], 10]];
@@ -3862,39 +3868,20 @@ function columnEdge() {
 // all of it.
 const CARBON_PLUME_ZOOM = 10;     // from here in, the plumes' own pictures
 const CARBON_PLUME_PAGES = 10;    // 1,000 plumes a page
-// Merged and counted up to the zoom where each plume starts drawing its own
-// picture. Stopping at 6 left a gap: from a continent or a country the
-// clusters were gone and what replaced them was a scatter of three-pixel
-// dots, so the layer read as empty again between the world view and the
-// street. Now the counted points carry it the whole way.
-const CARBON_CLUSTER_TO = CARBON_PLUME_ZOOM - 1;
 const CARBON_PAGES_AT_ONCE = 3;    // after the first, which is drawn on its own
 const CARBON_PICTURES_AT_ONCE = 40;
 async function addCarbonMapperLayer(cfg) {
   const src = `${cfg.id}-src`;
-  // Tens of thousands of plumes, most of them in a few basins, each a dot two
-  // pixels across at world view: from any distance the layer read as empty.
-  // Where they crowd they are merged into one point that says how many it
-  // stands for, the way the mines already work, so the basins show from the
-  // world view and nothing is dropped to make them show. From
-  // CARBON_CLUSTER_TO in, every plume is its own point again.
+  // Every plume is its own point at every zoom (22 September, round 4). They
+  // used to be merged into counted points out to zoom 9, which bunched them at
+  // the world view and split them apart on the way in; the owner asked for
+  // every dot at every zoom. Where they crowd, the glow under the points shows
+  // it, weighed by how many there are, and nothing is merged.
   map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] },
-    cluster: true, clusterMaxZoom: CARBON_CLUSTER_TO, clusterRadius: 30,
     attribution: cfg.attribution || "" });
-  map.addLayer({ id: `${cfg.id}-cl`, type: "circle", source: src, filter: ["has", "point_count"],
-    paint: {
-      "circle-color": cfg.colour, "circle-opacity": 0.75,
-      "circle-radius": ["interpolate", ["linear"], ["zoom"],
-        1, ["+", 3, ["*", 2.2, ["log10", ["max", ["get", "point_count"], 1]]]],
-        CARBON_CLUSTER_TO, ["+", 4, ["*", 2.6, ["log10", ["max", ["get", "point_count"], 1]]]]],
-      "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5 } });
-  bindHtmlPopup(`${cfg.id}-cl`, (p) =>
-    `<b>${Number(p.point_count).toLocaleString()} plumes here</b>` +
-    `<div class="meta">Merged at this zoom. Zoom in to see each one, its rate and its picture.</div>` +
-    `<div class="meta">Carbon Mapper data platform</div>`);
   // Sized by the emission rate Carbon Mapper measured, which is the one number
   // that says how much this plume matters; unmeasured plumes keep the base size.
-  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, filter: ["!", ["has", "point_count"]],
+  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src,
     paint: {
       "circle-color": ["case", ["==", ["get", "gas"], "CO2"], "#6E6358", cfg.colour],
       "circle-opacity": 0.85,
@@ -4245,10 +4232,10 @@ const CATALOGUE_PLACES = [
   // Kept where they were, at the owner's word (22 September, "I'll decide later").
   [/forest cover|forest and non-forest|land cover|tree height|forest as a share|tree cover extent|forest extent|tree cover density|forest age|industrial land/i, P + " > Forest and land cover"],
   [/mangrove|reef|benthic|coral/i, P + " > Oceans > Reefs and mangroves"],
-  [/water|aqueduct|river|watershed|flood|\bpond\b|canal/i, P + " > Surface water"],
+  [/water|aqueduct|\brivers?\b|watershed|flood|\bpond\b|canal/i, P + " > Surface water"],
   [/customary|\badat\b|indigenous|community land|tenure|land rights|quilombola|village forest|community forest|social forestry|rural settlement|forestry employment/i,
    "Suppression > Of humans > Land and territory"],
-  [/\broads?\b|transmigration|settlement|capital|\bikn\b|infrastructure|urban|built/i, P + " > Construction"],
+  [/\broads?\b|transmigration|settlement|capital|\bikn\b|infrastructure|\burban|\bbuilt\b/i, P + " > Construction"],
   // Spatial plans: the national and provincial plans and the moratorium (PIPPIB)
   // stay; the moratorium is also under Deforestation, being a bar on clearing
   // forest and peat; Badung's detailed plans go under Agriculture, as asked.
@@ -4270,7 +4257,12 @@ const CATALOGUE_BY_TITLE = [
   [/annual surface temperature anomal/i, null],
   [/(wdpa|protected areas?).*burn|burn.*(wdpa|protected areas?)/i, null],
   [/burn(ed|t) areas?.*(indonesia|equatorial asia|malaysia|brunei|borneo|kalimantan)/i, null],
-  [/^(?!.*(global|worldwide)).*intact forest landscape/i, null],
+  // Global Forest Watch's analysis tables (ids with "__": alert counts per
+  // country, province, protected area or drawn shape). Tables, never tiles.
+  [/[a-z0-9]__[a-z0-9]/, null],
+  // The drivers of disturbance alerts as one dataset: no tiles published. Its
+  // driver classes are drawn by the "driver class" row.
+  [/\bwur_alert_drivers$/, null],
   // Placed by name.
   [/tree cover loss by (dominant )?driver|drivers? of tree cover loss/i, [P + " > Deforestation > Tree cover loss and alerts"]],
   [/soy(bean)? planted area/i, [P + " > Climate > Nitrous oxide > Soy", AG + " > Soy, corn and grain"]],
@@ -4310,6 +4302,7 @@ function nusantaraWhere(id) {
 const LEFT_OUT = "(left out)";
 function cataloguePlaces(words, title) {
   if (title != null) {
+    // The title and, after it, the id (the id rules above end in $ or name it).
     for (const [rule, paths] of CATALOGUE_BY_TITLE) if (rule.test(title)) return paths ? paths.slice() : [CATALOGUE_TAKEN_OUT];
   }
   let out = [];
@@ -4366,7 +4359,7 @@ function catalogueRows(cfg, items) {
     // passing word in it filed rows under subjects they are not about: the
     // drivers of tree cover loss under Fire (fire is one driver), protected
     // areas and dams under Fire, oil and gas concessions under Mining.
-    const paths = cataloguePlaces(item.fileBy || `${item.title} ${item.name}`, item.title);
+    const paths = cataloguePlaces(item.fileBy || `${item.title} ${item.name}`, `${item.title} ${item.name}`);
     item.key = key;
     if (paths[0] === LEFT_OUT) { leftOut++; item.leftOut = true; return; }
     if (paths[0] === CATALOGUE_TAKEN_OUT) { takenOut.push(item.title); item.leftOut = true; return; }
@@ -4376,8 +4369,7 @@ function catalogueRows(cfg, items) {
       row.innerHTML =
         `<input type="checkbox" data-${n ? "cat-copy" : "cat"}="${escapeHtml(key)}">` +
         `<span class="swatch" style="background:${cfg.colour}"></span>` +
-        `<span class="body"><span class="nm">${escapeHtml(item.title)}` +
-        `<span class="live" title="Read from the source itself when this row is ticked, not from a copy kept here">LIVE</span>` +
+        `<span class="body"><span class="nm">${escapeHtml(item.title)}${liveMark(cfg)}` +
         `${siteLink(cfg.id)}${infoMark(item.about)}</span>` +
         `<span class="un" data-state="${escapeHtml(key)}">${escapeHtml(cfg.catUnit || "")}</span></span>`;
       (sectionBody(box, path) || spare).appendChild(row);
@@ -4575,11 +4567,38 @@ async function addWmsMenuLayer(cfg) {
 // dataset shows its id in words, marked as having no title, rather than a guess.
 const GFW_TITLES = {
   pangaea_global_mining: "Mining areas worldwide \u2014 outlines by Maus et al., from the PANGAEA data library (Global Forest Watch\u2019s copy)",
+  // Named from their ids and records (22 September, round 3).
+  wur_integration_alert_drivers_class: "Drivers of disturbance alerts \u2014 the driver behind each alert (Wageningen University)",
+  wur_integration_alert_drivers_date: "Drivers of disturbance alerts \u2014 the date of each alert (Wageningen University)",
+  wur_alert_drivers_coverage: "Drivers of disturbance alerts \u2014 the area they cover, as one shape, with no drivers in it",
+  umd_soy_planted_area_buffered_10km: "Soy planted area, widened by 10 km on every side",
+  ifl_intact_forest_landscapes_2025: "Intact Forest Landscapes 2025",
+  wdpa_protected_areas: "Protected areas, public release (World Database on Protected Areas)",
+  wdpa_licensed_protected_areas: "Protected areas, copy licensed to Global Forest Watch (World Database on Protected Areas)",
+  // The four rows of the same name told apart (22 September, round 4).
+  tsc_tree_cover_loss_drivers: "Tree cover loss by dominant driver, first method, coarse grid (Curtis et al., The Sustainability Consortium)",
+  wri_google_tree_cover_loss_drivers: "Tree cover loss by dominant driver, newest, 1 km (WRI and Google)",
+  tsc_drivers: "Tree cover loss by dominant driver, second record, tiles unfinished (The Sustainability Consortium)",
+  umd_drivers: "Tree cover loss by dominant driver, University of Maryland record (UMD)",
+};
+// What is known about how rows of the same name differ, put first in the
+// row's "i" box, ahead of Global Forest Watch's own description.
+const GFW_ABOUT = {
+  tsc_tree_cover_loss_drivers: "The original method (Curtis et al. 2018, The Sustainability Consortium): each square of a coarse grid, about 10 km across, is given the one driver that caused most of its tree cover loss. Five drivers: commodity-driven deforestation, shifting agriculture, forestry, wildfire, urbanization. Global Forest Watch lists three other datasets under the same title; this is the one its id marks as the Sustainability Consortium's.",
+  wri_google_tree_cover_loss_drivers: "The newest version, made by WRI with Google at 1 km, much finer than the original coarse grid, with more kinds of driver, among them mining and energy, and settlements and infrastructure, which the original grouped differently.",
+  tsc_drivers: "A second dataset under the Sustainability Consortium's name with the same title. Global Forest Watch lists map tiles for it that it has not finished making; if it still has none when ticked, the row leaves the list. Its record does not say how it differs from the first.",
+  umd_drivers: "A dataset of the same title that its id marks as the University of Maryland's. Its record does not say how it differs from the Sustainability Consortium's or from the WRI and Google version.",
+  wdpa_protected_areas: "The public release of the World Database on Protected Areas (UNEP-WCMC and IUCN), as Global Forest Watch serves it. There is a second worldwide row, the copy licensed to Global Forest Watch; the records do not say how the two differ beyond that.",
+  wdpa_licensed_protected_areas: "The World Database on Protected Areas as licensed to Global Forest Watch. There is a second worldwide row, the public release; the records do not say how the two differ beyond that.",
+};
+// Where a dataset is, where the record's own wording does not fit a title.
+const GFW_WHERE = {
+  intl_rivers_dam_hotspots: "the world\u2019s 50 major river basins",
 };
 function gfwTitle(d) {
   const meta = d.metadata || {};
-  if (meta.title) return meta.title;
   if (GFW_TITLES[d.dataset]) return GFW_TITLES[d.dataset];
+  if (meta.title) return meta.title;
   const words = String(d.dataset).replace(/_/g, " ");
   return `${words.charAt(0).toUpperCase()}${words.slice(1)} (Global Forest Watch gives this dataset no title)`;
 }
@@ -4684,7 +4703,7 @@ async function addGfwMenuLayer(cfg) {
   const items = all.filter((d) => !leftOut.includes(d.dataset)).map((d) => {
     const meta = d.metadata || {};
     const said = gfwTitle(d);
-    const where = String(meta.geographic_coverage || "").trim();
+    const where = String(GFW_WHERE[d.dataset] || meta.geographic_coverage || "").trim();
     return { id: d.dataset, meta,
       title: where && !new RegExp(where.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(said) ? `${said} \u2014 ${where}` : said };
   })
@@ -4738,7 +4757,14 @@ async function addGfwMenuLayer(cfg) {
         map.addSource(src, { type: "vector", tiles: [uri], minzoom: asset.minzoom, maxzoom: asset.maxzoom });
         for (const n of (names.length ? names : [d.id, "default"])) {
           const base = { source: src, "source-layer": n };
-          map.addLayer({ id: `${src}-f-${safe(n)}`, type: "fill", ...base, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": cfg.colour, "fill-opacity": 0.45, "fill-outline-color": "#1D1B17" } });
+          map.addLayer({ id: `${src}-f-${safe(n)}`, type: "fill", ...base, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": cfg.colour, "fill-opacity": 0.5 } });
+          // A light edge on every area, never thinner than a pixel, so areas far
+          // smaller than a pixel at the world view (mines, concessions) still show
+          // as specks; it was a near-black edge on a dark map (22 September, round 3).
+          map.addLayer({ id: `${src}-o-${safe(n)}`, type: "line", ...base, filter: ["==", ["geometry-type"], "Polygon"],
+            paint: { "line-color": "#D6CCBC", "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.95, 10, 0.75],
+                     "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1.6, 6, 1.2, 12, 0.9] } });
+          ids.push(`${src}-o-${safe(n)}`);
           map.addLayer({ id: `${src}-l-${safe(n)}`, type: "line", ...base, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": cfg.colour, "line-width": 1.2 } });
           map.addLayer({ id: `${src}-p-${safe(n)}`, type: "circle", ...base, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": cfg.colour, "circle-radius": 3, "circle-stroke-width": 0.5, "circle-stroke-color": "#17150F" } });
           for (const id of [`${src}-f-${safe(n)}`, `${src}-l-${safe(n)}`, `${src}-p-${safe(n)}`]) {
@@ -4785,7 +4811,7 @@ async function addGfwMenuLayer(cfg) {
     }
   };
   const rows = items.map((d) => ({
-    name: d.id, title: d.title, about: `${d.meta.function || ""} ${d.meta.overview || ""}`.trim(),
+    name: d.id, title: d.title, about: `${GFW_ABOUT[d.id] ? GFW_ABOUT[d.id] + " \u2014 " : ""}${d.meta.function || ""} ${d.meta.overview || ""}`.trim(),
     show: (want) => { if (want) put(d); else { take(d); rowSay(d.key, cfg.catUnit || ""); } },
   }));
   catalogueRows(cfg, rows);
@@ -9469,9 +9495,24 @@ function wireInfoMarks() {
 }
 
 function liveMark(cfg) {
-  if (!cfg || !LIVE_ROUTES.has(cfg.route)) return "";
-  return `<span class="live" title="Read from the source itself when this row is ticked, not from a copy kept here">LIVE</span>`;
-}
+  if (!cfg) return "";
+  const copy = NOT_LIVE[cfg.id];
+  if (LIVE_ROUTES.has(cfg.route) && !copy) return `<span class="live" title="Read from the source itself when this row is ticked, not from a copy kept here">LIVE</span>`;
+  const why = copy || "Drawn from a copy or file kept here, made when the source was last gathered, not read from the source each time";
+  return `<span class="live notlive" title="${escapeHtml(why)}">NOT LIVE</span>`;
+}
+// Rows whose way of reading would count as live, but which draw from a copy
+// kept here (the source cannot be read by another site, or its server is gone).
+// Every row now carries one mark or the other (22 September, round 3).
+const NOT_LIVE = {
+  coastal_cleanup: "Ocean Conservancy's cleanup sites, from a copy made daily (their server lets only their own site read it)",
+  space_industry: "openmaps.space's places, from a copy made daily",
+  gta_acts: "Global Trade Alert's acts, from a copy made daily",
+  giga_countries: "Giga's figures, from a copy made daily (its service does not let other sites read it)",
+  wastewater: "The Global Wastewater Model, from copies kept here; the model is not updated",
+  trase_measures: "Trase's values come from a copy made weekly; only the region shapes are read live",
+  atlas_cities: "The places are from a copy made weekly; each city's own page is read live",
+};
 
 /* ---------- the layers box, in the order and under the headings chosen ---------- */
 // Strings are layer ids; "group:" a whole group; "gm" the guerillamap row.
diff --git a/map/check-sources.mjs b/map/check-sources.mjs
new file mode 100644
index 0000000..a5a167b
--- /dev/null
+++ b/map/check-sources.mjs
@@ -0,0 +1,105 @@
+/**
+ * Asks each source that does not draw, or draws too slowly, what it answers
+ * today, the way the map asks it from its own page. Changes nothing.
+ *
+ * For each: the status, how long it took, how much came back, and whether the
+ * source lets the map's page read it (the CORS header). Then, for the Global
+ * Forest Watch pictures that draw as grey, what their records and tile service
+ * say about their pixel values. Then the files in the wastewater model's data
+ * package.
+ *
+ * Run: node map/check-sources.mjs
+ * Paste everything it prints back into the chat.
+ */
+const ORIGIN = "https://welcometoyourgalaxy.github.io";
+const GFW = "https://data-api.globalforestwatch.org";
+const COG = "https://tiles.globalforestwatch.org/cog/basic";
+
+async function ask(label, url, opts = {}) {
+  const t0 = Date.now();
+  const ctrl = new AbortController();
+  const timer = setTimeout(() => ctrl.abort(), opts.ms || 60000);
+  try {
+    const r = await fetch(url, { method: opts.method || "GET", headers: { Origin: ORIGIN }, signal: ctrl.signal });
+    const body = opts.method === "HEAD" ? "" : await r.text();
+    const cors = r.headers.get("access-control-allow-origin");
+    console.log(`${label}\n    ${r.status} in ${Date.now() - t0} ms, ${body.length.toLocaleString()} characters, ` +
+      `type ${r.headers.get("content-type") || "-"}, readable by the map: ${cors ? `yes (${cors})` : "NO (no CORS header)"}`);
+    if (opts.show) console.log("    " + body.slice(0, opts.show).replace(/\s+/g, " "));
+    return { r, body };
+  } catch (e) {
+    console.log(`${label}\n    FAILED after ${Date.now() - t0} ms: ${ctrl.signal.aborted ? "no answer in time" : e.message}`);
+    return null;
+  } finally { clearTimeout(timer); }
+}
+const json = (x) => { try { return JSON.parse(x.body); } catch (e) { return null; } };
+
+console.log("\n=== Rows that do not draw ===\n");
+const bbox = "-6000000,-4000000,-4000000,-2000000";   // part of South America, in map metres
+for (const crop of ["Soybean", "Corn"]) {
+  const svc = `https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorer${crop}/MapServer`;
+  await ask(`(22/23) USDA ${crop} explorer: the service`, `${svc}?f=json`, { show: 200 });
+  await ask(`(22/23) USDA ${crop} explorer: one picture`, `${svc}/export?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`);
+}
+const man = await ask("(24) Trase facilities list (our copy)", `${ORIGIN}/culprits-tiles-more/trase/facilities.json`);
+let silos = "silos_consolidated_capacity_website_brazil_2024_2_post.geo.json", base = "https://resources.trase.earth/data/facilities-data/";
+const m = man && json(man);
+if (m) { const hit = (m.types || []).find((t) => t.id === "brazil-silos"); if (hit && hit.file) { silos = hit.file; base = m.base || base; } }
+await ask(`(24) Trase soy silos file: ${silos}`, base + silos, { ms: 120000 });
+await ask("(29) EJAtlas, first page of 500", "https://ejatlas.org/api/v1/conflicts/?limit=500&offset=0", { ms: 120000 });
+const um = await ask("(30) Wreckers of the Earth, the uMap map", "https://umap.openstreetmap.fr/en/map/409815/geojson/", { show: 300 });
+const umj = um && json(um);
+const layers = umj && ((umj.properties && umj.properties.datalayers) || []);
+for (const l of (layers || []).slice(0, 5)) {
+  const id = l.id || (l.properties && l.properties.id);
+  await ask(`(30) Wreckers of the Earth, layer ${id}`, `https://umap.openstreetmap.fr/en/datalayer/409815/${id}/`);
+}
+await ask("(42) Materials research, the ArcGIS item", "https://www.arcgis.com/sharing/rest/content/items/3ff82579637f4c7a96bd62d039ac3e00?f=json", { show: 400 });
+await ask("(42) Materials research, the item's data", "https://www.arcgis.com/sharing/rest/content/items/3ff82579637f4c7a96bd62d039ac3e00/data?f=json", { show: 600 });
+for (const f of ["AllStations", "AllTrips", "Oceans"]) {
+  await ask(`(43) Seas of Plastic, ${f}`, `https://app.dumpark.com/seas-of-plastic-2/app/data/${f}.geojson`, { show: 120 });
+}
+for (const f of ["wastewater_N_effluent", "wastewater_N_plumes"]) {
+  await ask(`(26) Wastewater archive on our site: ${f}`, `${ORIGIN}/culprits-tiles-more/tiles/${f}.pmtiles`, { method: "HEAD" });
+}
+const nus = "https://map.nusantara-atlas.org/geoserver/atlas-workspace-v3/wms";
+for (const layer of ["v3p3_alertfire_modis", "v3p3_alertfire_viirs", "v3p3_alertfire_combine"]) {
+  await ask(`(14) Nusantara fire alerts, one picture: ${layer}`,
+    `${nus}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&STYLES=&SRS=EPSG:3857&BBOX=10018754,-1252344,12523443,1252344&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`);
+}
+
+console.log("\n=== Global Forest Watch pictures: what their pixels mean ===\n");
+const GFW_IDS = ["tsc_tree_cover_loss_drivers", "wri_google_tree_cover_loss_drivers", "tsc_drivers", "umd_drivers",
+  "wur_integration_alert_drivers_class", "umd_glad_dist_alerts", "umd_modis_burned_areas", "gfw_mining_concessions"];
+for (const id of GFW_IDS) {
+  const d = await ask(`${id}: its record`, `${GFW}/dataset/${id}`);
+  const dj = d && json(d);
+  const meta = (dj && dj.data && dj.data.metadata) || {};
+  const versions = (dj && dj.data && dj.data.versions) || [];
+  for (const k of ["title", "resolution", "content_date", "cautions", "key_restrictions", "legend", "scale"]) if (meta[k]) console.log(`    ${k}: ${String(meta[k]).replace(/\s+/g, " ").slice(0, 500)}`);
+  const v = versions.slice().sort().pop();
+  if (!v) continue;
+  const a = await ask(`${id}: assets of ${v}`, `${GFW}/dataset/${id}/${v}/assets`);
+  for (const as of ((a && json(a)) || {}).data || []) {
+    console.log(`    ${as.asset_type} | ${as.status} | ${as.asset_uri}`);
+    if (/^COG$/i.test(as.asset_type) && /^s3:/.test(as.asset_uri || "")) {
+      const u = encodeURIComponent(as.asset_uri);
+      await ask(`${id}: the tile service's reading of the COG`, `${COG}/info?url=${u}`, { show: 900 });
+      await ask(`${id}: its pixel values`, `${COG}/statistics?url=${u}&categorical=true&max_size=512`, { show: 1500 });
+    }
+    if (/raster tile cache/i.test(as.asset_type)) {
+      await ask(`${id}: raster tile cache record`, `${GFW}/asset/${as.asset_id}`, { show: 1200 });
+    }
+  }
+}
+
+console.log("\n=== The wastewater model's data package (KNB) ===\n");
+const eml = await ask("Tuholske et al. 2021 package metadata", "https://knb.ecoinformatics.org/knb/d1/mn/v2/object/doi%3A10.5063%2FF76B09", { ms: 90000 });
+if (eml && eml.body) {
+  const names = [...eml.body.matchAll(/<entityName>([^<]+)<\/entityName>/g)].map((x) => x[1]);
+  const urls = [...eml.body.matchAll(/<url[^>]*>([^<]+)<\/url>/g)].map((x) => x[1]);
+  const sizes = [...eml.body.matchAll(/<size[^>]*>([^<]+)<\/size>/g)].map((x) => x[1]);
+  names.forEach((n, i) => console.log(`    ${n} | ${sizes[i] || "?"} bytes | ${urls[i] || ""}`));
+  if (!names.length) console.log("    " + eml.body.slice(0, 800).replace(/\s+/g, " "));
+}
+console.log("\nDone.");
diff --git a/map/filing-report.mjs b/map/filing-report.mjs
index 9ec835a..435851b 100644
--- a/map/filing-report.mjs
+++ b/map/filing-report.mjs
@@ -20,7 +20,7 @@ const lib = new Function(
   cut("const NUSANTARA_NAMES = {", "/* ---------- a catalogue's layers as rows") +
   cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") +
   cut("const GFW_TITLES = {", "// Which of a dataset's assets to draw from.") +
-  "; return { NUSANTARA_NAMES, nusantaraWhere, cataloguePlaces, CATALOGUE_BY_TITLE, gfwTitle };")();
+  "; return { NUSANTARA_NAMES, nusantaraWhere, cataloguePlaces, CATALOGUE_BY_TITLE, gfwTitle, GFW_WHERE };")();
 
 const words = process.argv.slice(2).map((w) => w.toLowerCase());
 const want = (t) => !words.length || words.some((w) => t.toLowerCase().includes(w));
@@ -33,7 +33,7 @@ async function gfw() {
     const rows = (await r.json()).data || [];
     for (const d of rows) {
       const said = lib.gfwTitle(d);
-      const where = String((d.metadata || {}).geographic_coverage || "").trim();
+      const where = String(lib.GFW_WHERE[d.dataset] || (d.metadata || {}).geographic_coverage || "").trim();
       const title = where && !new RegExp(where.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(said) ? `${said} \u2014 ${where}` : said;
       out.push({ from: "Global Forest Watch", id: d.dataset, title });
     }
@@ -59,11 +59,11 @@ const rows = [];
 for (const [name, fn] of [["Global Forest Watch", gfw], ["Nusantara", nusantara]]) {
   try { rows.push(...await fn()); } catch (e) { console.log(`${name}: ${e.message}`); }
 }
-for (const r of rows) r.paths = lib.cataloguePlaces(`${r.title} ${r.id}`, r.title);
+for (const r of rows) r.paths = lib.cataloguePlaces(`${r.title} ${r.id}`, `${r.title} ${r.id}`);
 
 console.log("\nCaught by the rules by name:");
 lib.CATALOGUE_BY_TITLE.forEach(([rule, paths]) => {
-  const hit = rows.filter((r) => lib.CATALOGUE_BY_TITLE.find(([x]) => x.test(r.title))?.[0] === rule);
+  const hit = rows.filter((r) => lib.CATALOGUE_BY_TITLE.find(([x]) => x.test(`${r.title} ${r.id}`))?.[0] === rule);
   console.log(`\n  ${rule}  ->  ${paths ? paths.join(" | ") : "TAKEN OUT"}`);
   if (!hit.length) console.log("      (matched nothing)");
   for (const r of hit) console.log(`      ${r.title}  [${r.from}: ${r.id}]`);
diff --git a/map/index.html b/map/index.html
index 64b6465..969f2b4 100644
--- a/map/index.html
+++ b/map/index.html
@@ -314,6 +314,7 @@
   /* Live rows say so, beside the title. */
   #layers .nm .live{margin-left:5px;padding:0 3px;border:1px solid var(--rule);border-radius:2px;
     color:var(--dim);font-size:8.5px;letter-spacing:.08em;vertical-align:1px}
+  #layers .nm .live.notlive{border-style:dashed;opacity:.75}
   .panel,#legend{overflow:auto}
   /* The grip stays on the box's edge while its contents scroll under it. */
   .panel .pull-grip{position:sticky;bottom:0;margin-top:8px;background:rgba(31,28,21,.94)}
diff --git a/map/test.mjs b/map/test.mjs
index 015e0f4..7965341 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2743,18 +2743,9 @@ console.log("\nthe reload row is not clipped, and covers nothing");
 console.log("\nplumes show from the world view; the last sources named");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
-  check("crowded plumes are merged into one counted point, and split again close in",
-        /cluster: true, clusterMaxZoom: CARBON_CLUSTER_TO/.test(src) &&
-        /const CARBON_CLUSTER_TO = CARBON_PLUME_ZOOM - 1;/.test(src) &&
-        /filter: \["has", "point_count"\]/.test(src) &&
-        /filter: \["!", \["has", "point_count"\]\]/.test(src));
-  check("a merged point says how many are under it", /plumes here<\/b>/.test(src));
-  // The counted points run to the zoom where each plume starts drawing its own
-  // picture, so there is no band between the world view and the street where
-  // the layer reads as empty.
-  check("the counted points carry every zoom up to the pictures",
-        src.indexOf("const CARBON_PLUME_ZOOM") < src.indexOf("const CARBON_CLUSTER_TO") &&
-        /const CARBON_PLUME_ZOOM = 10;/.test(src));
+  check("every plume is its own point at every zoom; nothing is merged (22 September, round 4)",
+        !/cluster: true, clusterMaxZoom: CARBON_CLUSTER_TO/.test(src) && !/CARBON_CLUSTER_TO/.test(src) &&
+        !/plumes here<\/b>/.test(src) && /const CARBON_PLUME_ZOOM = 10;/.test(src));
   check("Nusantara's high-resolution imagery says where it is",
         /"hires": "High-resolution imagery, the southern tip of Bali"/.test(src));
   check("hiding the row hides the merged points too", /`\$\{id\}-agg`, `\$\{id\}-cl`, `\$\{id\}-pt`/.test(src));
@@ -2779,7 +2770,8 @@ console.log("\nlive rows say so; the grips read as handles; a shut box stops scr
   const live = new Function(src.slice(src.indexOf("const LIVE_ROUTES = new Set(["), src.indexOf("function liveMark(")) + "; return LIVE_ROUTES;")();
   check("the routes that read their source as you look are marked live",
         ["worker", "cerulean", "coral", "carbonmapper", "wmsmenu", "gfwmenu", "trase", "ll2"].every((r) => live.has(r)));
-  check("copies carry no mark", !live.has("pmtiles") && !live.has("sitemap") && !live.has("shapes") && !live.has("country"));
+  check("copies are not in the live routes, and carry the NOT LIVE mark instead", !live.has("pmtiles") && !live.has("sitemap") && !live.has("shapes") && !live.has("country") &&
+        /NOT LIVE<\/span>/.test(src));
   check("the mark says what it means, and is drawn beside the title",
         /not from a copy kept here/.test(src) && /#layers \.nm \.live\{/.test(index));
   check("a box pulled right down stops scrolling", /classList\.toggle\("pulled-shut", h <= PULL_MIN \+ 4\)/.test(src) &&
@@ -2950,7 +2942,7 @@ console.log("\nreallocated rows say where they are; the emptied rows leave the b
   check("the title carries it, unless it already says it",
         /new RegExp\(where, "i"\)\.test\(said\) \? said : `\$\{said\} \\u2014 \$\{where\}`/.test(src));
   check("a GFW dataset takes the coverage GFW record, and nothing where they record none",
-        /const where = String\(meta\.geographic_coverage \|\| ""\)\.trim\(\);/.test(src));
+        /const where = String\(GFW_WHERE\[d\.dataset\] \|\| meta\.geographic_coverage \|\| ""\)\.trim\(\);/.test(src));
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
   check("the two emptied rows are out of the box but still findable by the code",
@@ -3051,7 +3043,7 @@ console.log("\nround of 22 September (2): the box refiled, rows taken out");
         f("Oil and gas concessions") === `${P} > Oil and gas drilling | ${P} > Climate > Infrastructure emitting more than one gas`);
   check("the named rows are taken out",
         ["Annual surface temperature anomalies", "Burned areas in WDPA protected areas", "Burned area, two years at a time \u2014 Equatorial Asia",
-         "Burned area \u2014 Indonesia", "Intact forest landscapes \u2014 Equatorial Asia"].every((t) => f(t) === "(taken out)"));
+         "Burned area \u2014 Indonesia"].every((t) => f(t) === "(taken out)"));
   check("a biodiversity hotspot is not a fire hotspot", !places("Biodiversity hotspots").includes(P + " > Fire") && places("Fire hotspots").includes(P + " > Fire"));
   check("nitrogen dioxide is under Pollution, not Climate",
         f("Air quality: nitrogen dioxide satellite measurements") === P + " > Pollution > Nitrogen dioxide" &&
@@ -3065,12 +3057,59 @@ console.log("\nround of 22 September (2): the box refiled, rows taken out");
         ["carbon_bombs", "carbon_majors", "bocc"].every((i) => order.indexOf(i) > co2 && order.indexOf(i) < ch4));
   check("the Scribd document is out of the box", !order.includes("scribd_doc") && o.PANEL_REMOVED.has("scribd_doc"));
   check("rows are filed by title and id, not by their long description",
-        /cataloguePlaces\(item\.fileBy \|\| `\$\{item\.title\} \$\{item\.name\}`, item\.title\)/.test(src));
+        /cataloguePlaces\(item\.fileBy \|\| `\$\{item\.title\} \$\{item\.name\}`, `\$\{item\.title\} \$\{item\.name\}`\)/.test(src));
   check("a Global Forest Watch row found to have nothing to draw leaves the box",
         /catalogueRowGone\(d\.key\);/.test(src) && /function catalogueRowGone\(key, ms = 8000\)/.test(src));
   check("the asset list is read a kind at a time, each tried twice",
         /GFW_DRAWABLE_KINDS\.map\(\(k\) => readKind\(k\)\.catch\(\(\) => readKind\(k\)\)\)/.test(src));
 }
 
+console.log("\nround of 22 September (3): the report's findings, live marks, legible areas and vessels");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
+  const P = "Destruction > Of the planet";
+  const f = (t, id) => places(`${t} ${id}`, `${t} ${id}`).join(" | ");
+  check("\"drivers\" is not a river and \"disturbance\" is not urban",
+        f("Drivers of disturbance alerts \u2014 the driver behind each alert (Wageningen University)", "wur_integration_alert_drivers_class") === P + " > Deforestation > Tree cover loss and alerts");
+  check("Global Forest Watch's analysis tables are taken out, and so is the drivers dataset with no tiles",
+        f("Gadm  burned areas  adm1 whitelist", "gadm__burned_areas__adm1_whitelist") === "(taken out)" &&
+        f("Geostore  burned areas  daily alerts", "geostore__burned_areas__daily_alerts") === "(taken out)" &&
+        f("Wdpa protected areas  glad  summary", "wdpa_protected_areas__glad__summary") === "(taken out)" &&
+        f("Drivers of disturbance alerts \u2014 Three major forest basins", "wur_alert_drivers") === "(taken out)" &&
+        f("Protected areas \u2014 Global", "wdpa_protected_areas") === P + " > Biodiversity loss");
+  check("the dated intact forest landscapes stay, under Biodiversity loss",
+        ["2000", "2013", "2016", "2020"].every((y) => f(`Intact Forest Landscapes ${y}`, `ifl_intact_forest_landscapes_${y}`) === P + " > Biodiversity loss"));
+  const gfw = new Function(src.slice(src.indexOf("const GFW_TITLES = {"), src.indexOf("// Which of a dataset's assets to draw from.")) + "; return { gfwTitle, GFW_WHERE };")();
+  check("untitled datasets are named from their records, and the two worldwide protected-area rows say which is which",
+        /driver behind each alert/.test(gfw.gfwTitle({ dataset: "wur_integration_alert_drivers_class", metadata: {} })) &&
+        gfw.gfwTitle({ dataset: "wdpa_protected_areas", metadata: { title: "Protected areas" } }) !== gfw.gfwTitle({ dataset: "wdpa_licensed_protected_areas", metadata: { title: "Protected areas" } }) &&
+        !/no title/.test(gfw.gfwTitle({ dataset: "umd_soy_planted_area_buffered_10km", metadata: {} })) &&
+        /50 major river basins/.test(gfw.GFW_WHERE.intl_rivers_dam_hotspots));
+  const mark = new Function("escapeHtml", src.slice(src.indexOf("const LIVE_ROUTES = new Set(["), src.indexOf("/* ---------- the layers box, in the order")) + "; return liveMark;")((x) => String(x));
+  check("every row carries LIVE or NOT LIVE, and a live route drawn from a copy says NOT LIVE",
+        /">LIVE</.test(mark({ id: "x", route: "worker" })) && /NOT LIVE/.test(mark({ id: "x", route: "pmtiles" })) &&
+        /NOT LIVE/.test(mark({ id: "coastal_cleanup", route: "geojsonlive" })) && /NOT LIVE/.test(mark({ id: "trase_measures", route: "trase" })));
+  check("catalogue rows take the mark of the catalogue they come from", /escapeHtml\(item\.title\)\}\$\{liveMark\(cfg\)\}/.test(src));
+  check("Global Forest Watch areas have a light edge at least a pixel wide", /id: `\$\{src\}-o-\$\{safe\(n\)\}`, type: "line"/.test(src) && /"line-color": "#D6CCBC"/.test(src));
+  check("the vessels of concern glow at full strength", /const GLOW_FULL = new Set\(\["skytruth_voc"\]\);/.test(src) && /if \(glowFull\(layer\)\) return 1;/.test(src));
+}
+console.log("\nround of 22 September (4): rows of the same name told apart");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const g = new Function(src.slice(src.indexOf("const GFW_TITLES = {"), src.indexOf("// Which of a dataset's assets to draw from.")) + "; return { gfwTitle, GFW_ABOUT };")();
+  const ids = ["tsc_tree_cover_loss_drivers", "wri_google_tree_cover_loss_drivers", "tsc_drivers", "umd_drivers"];
+  const titles = ids.map((id) => g.gfwTitle({ dataset: id, metadata: { title: "Tree Cover Loss by Dominant Driver" } }));
+  check("the four driver rows have four different titles, each saying whose it is", new Set(titles).size === 4 && titles.every((t) => /\([^)]+\)$/.test(t)));
+  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
+  check("\u2026and all four still file under Deforestation", titles.every((t, i) => places(`${t} ${ids[i]}`, `${t} ${ids[i]}`).join() === "Destruction > Of the planet > Deforestation > Tree cover loss and alerts"));
+  const wdpa = ["wdpa_protected_areas", "wdpa_licensed_protected_areas"].map((id) => g.gfwTitle({ dataset: id, metadata: { title: "Protected areas" } }));
+  check("the two worldwide protected-area rows are told apart", wdpa[0] !== wdpa[1] && wdpa.every((t) => /World Database on Protected Areas/.test(t)));
+  check("what is known about how they differ goes first in each row's i box",
+        [...ids, "wdpa_protected_areas", "wdpa_licensed_protected_areas"].every((id) => g.GFW_ABOUT[id]) &&
+        /about: `\$\{GFW_ABOUT\[d\.id\] \? GFW_ABOUT\[d\.id\] \+ " \\u2014 " : ""\}/.test(src));
+  check("the check script asks each failing source and each grey picture, and changes nothing",
+        fs.existsSync(path.join(HERE, "check-sources.mjs")) && !/writeFile/.test(fs.readFileSync(path.join(HERE, "check-sources.mjs"), "utf8")));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
'''

app = pathlib.Path.cwd() / "map" / "app.js"
if not app.exists():
    sys.exit("Run this from ~/Desktop/culprits (map/app.js not found here).")
if "glowGrain" not in app.read_text():
    sys.exit("Your copy is older than main at 5dbeb61 (The glow made finer). Run git pull first; nothing was changed.")

with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False) as f:
    f.write(DIFF)
    patch = f.name

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)

if git("apply", "--check", "--reverse", patch).returncode == 0:
    sys.exit("Already applied: nothing to do.")
check = git("apply", "--check", patch)
if check.returncode != 0:
    sys.exit("This patch does not fit the files on disk, so nothing was changed.\n" + check.stderr)
done = git("apply", patch)
if done.returncode != 0:
    sys.exit(done.stderr)
print("Applied. Now run: node map/test.mjs && node map/wire.test.mjs")
