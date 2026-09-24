#!/usr/bin/env python3
"""
Round of 22 September (2): the layers box refiled, rows taken out.

Applies one git diff to map/app.js, map/test.mjs, HANDOFF.md and adds
map/filing-report.mjs. Built against main at 212f812 ("Delete .github/save.sh");
no earlier patch is needed.

Run from the repo root:  python3 refile_0922b.py
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index e5cab83..cdc1826 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -394,6 +394,55 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 22 September (2): the box refiled, rows taken out
+
+The owner sent 44 items; this round is the filing and removal ones (1, 2, 3, 5,
+6, 8, 9, 10, 11, 12, 13, 19, 20, 27, 28, 31, 33, 35, 38 and the headings of 39).
+
+- **Catalogue rows are filed by title and id only.** `catalogueRows` used to
+  add each row's long description to the words the rules read, and a passing
+  word there filed rows under subjects they are not about: the drivers of tree
+  cover loss under Fire (fire is one driver), dams and protected areas under
+  Fire, oil and gas concessions and intact forest landscapes under Mining.
+  Trase's rows still carry their own `fileBy`.
+- **`CATALOGUE_BY_TITLE`**, read before `CATALOGUE_PLACES`, against the title:
+  the first match decides and its paths are the row's only homes; `null`
+  takes the row out (`(taken out)`, listed in the console). It holds the
+  owner's placements by name. Titles are matched by words, not ids, because
+  the ids could not be read from here; `node map/filing-report.mjs [words]`
+  reads both catalogues live and prints what each rule caught and where every
+  row lands. **Run it after any change to the rules.**
+- Taken out by name: annual surface temperature anomalies; burned area in
+  protected areas (WDPA); burned area in Indonesia / Equatorial Asia /
+  Malaysia / Borneo; intact forest landscapes other than the worldwide one.
+  Burned peatland and the peat-burning emissions are not taken out.
+- **A Global Forest Watch row found to have nothing to draw leaves the box**
+  (`catalogueRowGone`, 8 s after saying why). The asset list is meant to keep
+  such rows out from the start; the owner seeing "has not finished making
+  them" means the list was not read in their browser. Each kind is now read on
+  its own, twice if the first try fails, with 60 s a page.
+- `hotspot` in the Fire rule no longer catches biodiversity hotspots.
+- Climate: carbon bombs, the Carbon Majors and Banking on Climate Chaos under
+  Carbon dioxide ("Companies and financiers" under Climate is gone); Nitrous
+  oxide holds Soy, Corn and Grain; Infrastructure emitting more than one gas
+  now takes oil and gas concessions (also under Oil and gas drilling).
+- Pollution by pollutant: General and all pollutants (Climate TRACE air
+  pollution until it is split per pollutant, EPA toxic releases), Nitrogen
+  dioxide (moved from Climate), Wastewater, Plastics, Oil spills and slicks.
+- Biodiversity loss > Fish holds dams. Forest greenhouse gas emissions is
+  under Deforestation only, as asked ("move"). The Scribd document is in
+  `PANEL_REMOVED`.
+- The drivers of disturbance alerts row now files under Deforestation > Tree
+  cover loss and alerts by its title (it had been under Mining through its
+  description).
+
+Still to do from the list: legends and colour for the driver layers and
+DIST-ALERT at the world view (21, 32, 34, 36), visibility of mining outlines
+and vessels (37, 41), dots at every zoom (25), LIVE / NOT LIVE marks (43), the
+Climate TRACE pollutants as rows (39), the layers that do not draw or are too
+slow (4, 7, 14-18, 22, 23, 24, 26, 29, 30, 40, 42, seas of plastic), soy and
+corn emissions (24) and D-Waste (44).
+
 ## Concessions filed by what they are for; "Land held under permit" retired
 
 Asked for on 22 September. `CATALOGUE_PLACES` no longer has a generic permit
diff --git a/map/app.js b/map/app.js
index 86742f8..443794d 100644
--- a/map/app.js
+++ b/map/app.js
@@ -4147,7 +4147,7 @@ const CATALOGUE_PLACES = [
   // systems and the words that mean forest loss, and fire keeps its own.
   [/deforest|forest ?loss|tree ?cover ?loss|disturb|expansion|probability|forest change|frontera|\bglad\b|\bradd\b|dist-?alert|integrated alert|trees cut|alert system|forest alert/i,
    P + " > Deforestation > Tree cover loss and alerts"],
-  [/\bfires?\b|burn|hotspot/i, P + " > Fire"],
+  [/\bfires?\b|burn|(?<!biodiversity )hotspot/i, P + " > Fire"],
   [/mining|\bmines?\b|quarr|\bcoal\b|nickel|bauxite|\bgold\b/i, P + " > Mining"],
   [/oil and gas|oil & gas|\bgas\b|petroleum|geothermal/i, P + " > Oil and gas drilling"],
   // Agriculture, by crop where the box has a heading for it (22 September).
@@ -4173,8 +4173,8 @@ const CATALOGUE_PLACES = [
   [/methane|\bch4\b/i, P + " > Climate > Methane"],
   [/nitrous|\bn2o\b/i, P + " > Climate > Nitrous oxide"],
   [/carbon|emission|biomass|climate|\bco2\b|flux|removals|temperature|precipitation/i, P + " > Climate > Carbon dioxide"],
-  [/nitrogen dioxide|\bno2\b|\bnox\b|nitric oxide/i, P + " > Climate > Nitrogen dioxide"],
-  [/air quality|aerosol|pm2/i, P + " > Pollution > Air"],
+  [/nitrogen dioxide|\bno2\b|\bnox\b|nitric oxide/i, P + " > Pollution > Nitrogen dioxide"],
+  [/air quality|aerosol|pm2/i, P + " > Pollution > General and all pollutants"],
   [/protect|conserv|reserve|restoration|biodivers|intact forest|primary forest|wdpa|ramsar|species|habitat|ecozone|ecosystem|\bkba\b/i,
    P + " > Biodiversity loss"],
   [/peat/i, P + " > Peatland"],
@@ -4196,6 +4196,32 @@ const CATALOGUE_PLACES = [
   [/boundar|admin|hillshade|relief|imagery|sentinel|from the air|geotag|news article|towns and villages|\bgadm\b|\bgrid\b|geostore|buffered|coverage layer|\bregions?\b/i,
    "Base and reference > Boundaries and relief"],
 ];
+// Rows the owner placed or took out by name (22 September, round 2). Read
+// before the rules above, against the row's title: the first that matches
+// decides, and its paths are the row's only homes. A null path takes the row
+// out of the box. Where a rule names a title the catalogue no longer carries,
+// it matches nothing and changes nothing; map/filing-report.mjs lists which
+// titles each rule caught.
+const CATALOGUE_TAKEN_OUT = "(taken out)";
+const CATALOGUE_BY_TITLE = [
+  // Taken out: no tiles published, or regional repeats of worldwide rows.
+  [/annual surface temperature anomal/i, null],
+  [/(wdpa|protected areas?).*burn|burn.*(wdpa|protected areas?)/i, null],
+  [/burn(ed|t) areas?.*(indonesia|equatorial asia|malaysia|brunei|borneo|kalimantan)/i, null],
+  [/^(?!.*(global|worldwide)).*intact forest landscape/i, null],
+  // Placed by name.
+  [/tree cover loss by (dominant )?driver|drivers? of tree cover loss/i, [P + " > Deforestation > Tree cover loss and alerts"]],
+  [/soy(bean)? planted area/i, [P + " > Climate > Nitrous oxide > Soy", AG + " > Soy, corn and grain"]],
+  [/forest greenhouse gas emissions/i, [P + " > Deforestation"]],
+  [/all[- ]ecosystem disturbance alerts|dist-?alert/i,
+   [P + " > Construction", P + " > Biodiversity loss", P + " > Deforestation > Tree cover loss and alerts"]],
+  [/intact forest landscape/i, [P + " > Biodiversity loss"]],
+  [/biodiversity hotspots/i, [P + " > Biodiversity loss"]],
+  [/\bdams?\b/i, [P + " > Biodiversity loss > Fish"]],
+  [/oil (and|&) gas (concession|block|licen|lease)/i, [P + " > Oil and gas drilling", P + " > Climate > Infrastructure emitting more than one gas"]],
+  [/protected areas?/i, [P + " > Biodiversity loss"]],
+  [/nitrogen dioxide|\bno2\b/i, [P + " > Pollution > Nitrogen dioxide"]],
+];
 // Where a catalogue layer is, said in its title. Nusantara names the place in
 // most of its ids and covers Equatorial Asia in the rest; a reader clicking
 // "Fire alerts, VIIRS" under Fire should not have to find out by drawing it
@@ -4220,7 +4246,10 @@ function nusantaraWhere(id) {
 }
 
 const LEFT_OUT = "(left out)";
-function cataloguePlaces(words) {
+function cataloguePlaces(words, title) {
+  if (title != null) {
+    for (const [rule, paths] of CATALOGUE_BY_TITLE) if (rule.test(title)) return paths ? paths.slice() : [CATALOGUE_TAKEN_OUT];
+  }
   let out = [];
   let dropped = false;
   for (const [rule, path] of CATALOGUE_PLACES) {
@@ -4266,13 +4295,19 @@ function catalogueRows(cfg, items) {
   if (!box || !items.length) return;
   const spare = sectionBody(box, "Not yet placed") || box;
   let leftOut = 0;
+  const takenOut = [];
   items.forEach((item, i) => {
     const key = `${cfg.id}|${i}`;
     // A row may say what it is to be filed by, where its long description would
     // mislead: a Trase tooltip that mentions water in passing is not a water layer.
-    const paths = cataloguePlaces(item.fileBy || `${item.title} ${item.name} ${item.about || ""}`);
+    // Filed by its title and id. The long description used to count too, and a
+    // passing word in it filed rows under subjects they are not about: the
+    // drivers of tree cover loss under Fire (fire is one driver), protected
+    // areas and dams under Fire, oil and gas concessions under Mining.
+    const paths = cataloguePlaces(item.fileBy || `${item.title} ${item.name}`, item.title);
     item.key = key;
     if (paths[0] === LEFT_OUT) { leftOut++; item.leftOut = true; return; }
+    if (paths[0] === CATALOGUE_TAKEN_OUT) { takenOut.push(item.title); item.leftOut = true; return; }
     paths.forEach((path, n) => {
       const row = document.createElement("label");
       row.className = "layer layer-cat" + (n ? " layer-copy" : "");
@@ -4287,6 +4322,7 @@ function catalogueRows(cfg, items) {
     });
   });
   if (leftOut) console.info(`[culprits] ${cfg.id}: ${leftOut} land-cover layers have no row, at the owner's request (22 September)`);
+  if (takenOut.length) console.info(`[culprits] ${cfg.id}: taken out by name at the owner's request: ${takenOut.join("; ")}`);
   countHeadings(box);
   if (box.dataset.catWired) return;
   box.dataset.catWired = "1";
@@ -4310,6 +4346,25 @@ function catalogueRows(cfg, items) {
   });
 }
 const CATALOGUE_ITEMS = new Map();
+// A catalogue row found, when ticked, to have nothing it can draw leaves the
+// box (and so do its copies), after saying why for a few seconds. The owner's
+// rule is that a row which can never draw is not shown (21 and 22 September);
+// the asset list read at the start normally keeps such rows out, and this
+// catches the ones it missed.
+function catalogueRowGone(key, ms = 8000) {
+  const box = document.getElementById("layers");
+  if (!box || !box.querySelectorAll) return;
+  setTimeout(() => {
+    for (const tick of box.querySelectorAll(`[data-cat="${key}"], [data-cat-copy="${key}"]`)) {
+      const row = tick.closest ? tick.closest("label") : null;
+      if (row && row.remove) row.remove();
+    }
+    const legend = box.querySelector ? box.querySelector(`.facet[data-legend-for="${key}"]`) : null;
+    if (legend && legend.remove) legend.remove();
+    CATALOGUE_ITEMS.delete(key);
+    if (typeof countHeadings === "function") countHeadings(box);
+  }, ms);
+}
 // What is happening to one catalogue row, said on that row and its copies. It
 // used to be said on the catalogue's own row, which is out of sight: a dataset
 // with no tiles, or one whose server refused, looked as if nothing had happened.
@@ -4537,15 +4592,20 @@ async function addGfwMenuLayer(cfg) {
   // dataset's assets are looked up when it is ticked.
   let index = null;
   try {
-    const rows = [];
-    for (const kind of GFW_DRAWABLE_KINDS) {
+    // Each kind is read on its own and tried twice. One slow page used to throw
+    // the whole list away, and then every download-only dataset got a row.
+    const readKind = async (kind) => {
+      const got = [];
       for (let page = 1; page < 20; page++) {
-        const j = await getJson(`${cfg.api}/assets?asset_type=${encodeURIComponent(kind)}&page[size]=1000&page[number]=${page}`, 40000);
-        const got = Array.isArray(j.data) ? j.data : [];
-        rows.push(...got);
-        if (got.length < 1000) break;
+        const j = await getJson(`${cfg.api}/assets?asset_type=${encodeURIComponent(kind)}&page[size]=1000&page[number]=${page}`, 60000);
+        const part = Array.isArray(j.data) ? j.data : [];
+        got.push(...part);
+        if (part.length < 1000) break;
       }
-    }
+      return got;
+    };
+    const kinds = await Promise.all(GFW_DRAWABLE_KINDS.map((k) => readKind(k).catch(() => readKind(k))));
+    const rows = [].concat(...kinds);
     if (rows.length) index = gfwAssetIndex(rows);
   } catch (e) { console.warn(`[culprits] ${cfg.id}: the asset list could not be read (${e.message}); assets are looked up on each tick`); }
   // Datasets Global Forest Watch publishes only as downloads - no tile cache and
@@ -4633,7 +4693,10 @@ async function addGfwMenuLayer(cfg) {
         rowSay(d.key, (asset.waiting
           ? "Global Forest Watch lists map tiles for this dataset but has not finished making them \u2014 nothing to draw yet"
           : "no map tiles are published for this dataset, only files to download \u2014 nothing to draw") +
-          (GFW_DRAWN_BY[d.id] ? `. The same alerts are drawn by the row \u201c${GFW_DRAWN_BY[d.id]}\u201d` : ""));
+          (GFW_DRAWN_BY[d.id] ? `. The same alerts are drawn by the row \u201c${GFW_DRAWN_BY[d.id]}\u201d` : "") +
+          ". This row will now leave the list.");
+        console.info(`[culprits] ${cfg.id}: ${d.id} has nothing to draw; its row is taken out`);
+        catalogueRowGone(d.key);
         return;
       }
       drawn.set(d.id, ids);
@@ -9360,7 +9423,7 @@ const PANEL_ORDER = [
 
   { h: 1, t: "Destruction" },
   { h: 2, t: "Of the planet" },
-  { h: 3, t: "General" }, "ejatlas", "wreckers_umap", "fortune500", "theyrule", "scribd_doc",
+  { h: 3, t: "General" }, "ejatlas", "wreckers_umap", "fortune500", "theyrule",
   // Climate is arranged by greenhouse gas, in the Destruction page's own order
   // (22 September): a row goes under the gas its sites mainly emit, and a row
   // whose sites emit more than one in earnest is under Infrastructure, or
@@ -9373,18 +9436,27 @@ const PANEL_ORDER = [
   // gas it emits (22 September): filed under one gas each, the gases a
   // sector also emits were drowned out.
   { h: 4, t: "Emitting sites by sector, until split by gas" }, "group:climate_trace_sectors", "group:climate_trace_agriculture", "group:climate_trace_forestry", "group:ct_history",
-  { h: 4, t: "Carbon dioxide" }, "owid_co2", "gem_coal", "power_plants", "fractracker_refineries", "carbon_plumes",
+  // Carbon bombs, the Carbon Majors and Banking on Climate Chaos under Carbon
+  // dioxide, and nitrogen dioxide moved to Pollution (22 September, round 2).
+  { h: 4, t: "Carbon dioxide" }, "owid_co2", "gem_coal", "power_plants", "fractracker_refineries", "carbon_plumes", "carbon_bombs", "carbon_majors", "bocc",
   { h: 4, t: "Methane" }, "carbon_plumes", "hydrowaste", "wastewater",
-  { h: 4, t: "Nitrous oxide" }, "fertilizer_facilities", "usda_soybean", "usda_corn", "site_china_grain", "trase_silos_brazil",
+  { h: 4, t: "Nitrous oxide" }, "fertilizer_facilities",
+  { h: 5, t: "Soy" }, "usda_soybean", "trase_silos_brazil",
+  { h: 5, t: "Corn" }, "usda_corn",
+  { h: 5, t: "Grain" }, "site_china_grain",
   { h: 4, t: "F-gases" },
   { h: 4, t: "Black carbon" }, "fractracker_refineries",
-  { h: 4, t: "Nitrogen dioxide" },
-  { h: 4, t: "Infrastructure emitting more than one gas" }, "carbon_bombs",
-  { h: 4, t: "Companies and financiers" }, "carbon_majors", "bocc",
+  // Oil and gas concessions (from the catalogues) are filed here as well as
+  // under Oil and gas drilling: the wells emit carbon dioxide, methane and,
+  // where gas is flared, black carbon.
+  { h: 4, t: "Infrastructure emitting more than one gas" },
   { h: 3, t: "Overpopulation" }, "ct_pop",
+  // Pollution by pollutant, as Climate is by gas (22 September, round 2).
+  // Climate TRACE's air-pollution row covers every pollutant it reports and
+  // sits under General until it is split into a row per pollutant.
   { h: 3, t: "Pollution" },
-  { h: 4, t: "Air" }, "ct_air",
-  { h: 4, t: "Toxic releases and regulated sites, US" }, "epa_tri_sites", "epa_widget",
+  { h: 4, t: "General and all pollutants" }, "ct_air", "epa_tri_sites", "epa_widget",
+  { h: 4, t: "Nitrogen dioxide" },
   { h: 4, t: "Wastewater" }, "hydrowaste", "wastewater",
   { h: 4, t: "Plastics" },
   { h: 5, t: "Production" }, "pirg_plastic", "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch",
@@ -9399,6 +9471,7 @@ const PANEL_ORDER = [
   { h: 4, t: "Wood pulp, Indonesia" }, "trase_pulp_indonesia", "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023",
   { h: 4, t: "Companies and financiers" }, "site_forest500_soy", "site_soybean_companies", "soy_organizations", "dff",
   { h: 3, t: "Biodiversity loss" }, "gsn", "gsn_rankings", "atlas_hotspots", "atlas_cities", "powerbi_report",
+  { h: 4, t: "Fish" },
   { h: 4, t: "Companies and financiers" }, "pe_subsidising", "pe_bankrolling",
   { h: 3, t: "Spatial plans" },
   { h: 3, t: "Peatland" },
@@ -9501,6 +9574,7 @@ const PANEL_ORDER = [
 const PANEL_REMOVED = new Set([
   "leverage_chart",
   "cultivated_meat_laws",          // taken out 22 September at the owner's request
+  "scribd_doc",                    // the Destruction page document, taken out 22 September (round 2)
   // Taken out 19 Sept: near duplicates, a background map mistaken for data, rows
   // merged into another, and pages asked to be removed.
   "site_cartel_cells", "site_export_credit_shading", "giga_schools", "nsf_locations",
diff --git a/map/filing-report.mjs b/map/filing-report.mjs
new file mode 100644
index 0000000..9ec835a
--- /dev/null
+++ b/map/filing-report.mjs
@@ -0,0 +1,78 @@
+/**
+ * Where each catalogue row lands in the layers box.
+ *
+ * Reads Global Forest Watch's dataset list and Nusantara Atlas's layer list
+ * live, titles each row the way the map does, and files it with the map's own
+ * rules (cataloguePlaces in app.js). Prints the rows that the owner's rules by
+ * name (CATALOGUE_BY_TITLE) caught, then every row by heading.
+ *
+ * Run: node map/filing-report.mjs            everything
+ *      node map/filing-report.mjs fire dam   only titles containing any of these words
+ */
+import fs from "node:fs";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
+
+const HERE = path.dirname(fileURLToPath(import.meta.url));
+const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
+const lib = new Function(
+  cut("const NUSANTARA_NAMES = {", "/* ---------- a catalogue's layers as rows") +
+  cut("const P = \"Destruction > Of the planet\";", "// The body of the heading a path names") +
+  cut("const GFW_TITLES = {", "// Which of a dataset's assets to draw from.") +
+  "; return { NUSANTARA_NAMES, nusantaraWhere, cataloguePlaces, CATALOGUE_BY_TITLE, gfwTitle };")();
+
+const words = process.argv.slice(2).map((w) => w.toLowerCase());
+const want = (t) => !words.length || words.some((w) => t.toLowerCase().includes(w));
+
+async function gfw() {
+  const out = [];
+  for (let page = 1; page < 30; page++) {
+    const r = await fetch(`https://data-api.globalforestwatch.org/datasets?page[size]=100&page[number]=${page}`);
+    if (!r.ok) throw new Error(`Global Forest Watch answered ${r.status}`);
+    const rows = (await r.json()).data || [];
+    for (const d of rows) {
+      const said = lib.gfwTitle(d);
+      const where = String((d.metadata || {}).geographic_coverage || "").trim();
+      const title = where && !new RegExp(where.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(said) ? `${said} \u2014 ${where}` : said;
+      out.push({ from: "Global Forest Watch", id: d.dataset, title });
+    }
+    if (rows.length < 100) break;
+  }
+  return out;
+}
+async function nusantara() {
+  const out = [];
+  for (const base of ["https://map.nusantara-atlas.org/geoserver/atlas-workspace-v3/wms", "https://map.nusantara-atlas.org/geoserver/atlas-workspace-v2/wms"]) {
+    const r = await fetch(`${base}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`);
+    if (!r.ok) { console.log(`Nusantara ${base} answered ${r.status}`); continue; }
+    const xml = await r.text();
+    for (const m of xml.matchAll(/<Layer[^>]*>\s*<Name>([^<]+)<\/Name>\s*<Title>([^<]*)<\/Title>/g)) {
+      const id = m[1], said = lib.NUSANTARA_NAMES[id] || m[2] || id, where = lib.nusantaraWhere(id);
+      out.push({ from: "Nusantara", id, title: new RegExp(where, "i").test(said) ? said : `${said} \u2014 ${where}` });
+    }
+  }
+  return out;
+}
+
+const rows = [];
+for (const [name, fn] of [["Global Forest Watch", gfw], ["Nusantara", nusantara]]) {
+  try { rows.push(...await fn()); } catch (e) { console.log(`${name}: ${e.message}`); }
+}
+for (const r of rows) r.paths = lib.cataloguePlaces(`${r.title} ${r.id}`, r.title);
+
+console.log("\nCaught by the rules by name:");
+lib.CATALOGUE_BY_TITLE.forEach(([rule, paths]) => {
+  const hit = rows.filter((r) => lib.CATALOGUE_BY_TITLE.find(([x]) => x.test(r.title))?.[0] === rule);
+  console.log(`\n  ${rule}  ->  ${paths ? paths.join(" | ") : "TAKEN OUT"}`);
+  if (!hit.length) console.log("      (matched nothing)");
+  for (const r of hit) console.log(`      ${r.title}  [${r.from}: ${r.id}]`);
+});
+
+console.log("\nEvery row, by heading:");
+const by = {};
+for (const r of rows.filter((x) => want(x.title))) for (const p of r.paths) (by[p] = by[p] || []).push(r);
+for (const p of Object.keys(by).sort()) {
+  console.log(`\n${p}`);
+  for (const r of by[p].sort((a, b) => a.title.localeCompare(b.title))) console.log(`    ${r.title}  [${r.from}: ${r.id}]`);
+}
diff --git a/map/test.mjs b/map/test.mjs
index aada9bb..5d76210 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2072,8 +2072,8 @@ console.log("\nGlobal Safety Net");
 console.log("\nClimate TRACE air pollution");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
-  check("the air-pollution sources are under Pollution > Air, and population density under Overpopulation (22 September)", /id: "ct_air"/.test(src) && /id: "ct_pop"/.test(src) &&
-        /\{ h: 4, t: "Air" \}, "ct_air",/.test(src) && /\{ h: 3, t: "Overpopulation" \}, "ct_pop",/.test(src));
+  check("the air-pollution sources are under Pollution > General and all pollutants, and population density under Overpopulation", /id: "ct_air"/.test(src) && /id: "ct_pop"/.test(src) &&
+        /\{ h: 4, t: "General and all pollutants" \}, "ct_air", "epa_tri_sites", "epa_widget",/.test(src) && /\{ h: 3, t: "Overpopulation" \}, "ct_pop",/.test(src));
   check("a plume is drawn as one still hotspot, graded by its concentration, not a set of outlines",
         /function ctPlumeShape\(gj\)/.test(src) && /type: "heatmap", source: `\$\{cfg\.id\}-plume`/.test(src) && /"fill-opacity": \["interpolate", \["linear"\], \["get", "_strength"\]/.test(src));
   {
@@ -2084,7 +2084,7 @@ console.log("\nClimate TRACE air pollution");
   check("\u2026its figures and plume are read through the Worker, since Climate TRACE sends no CORS header",
         /\$\{WORKER\}\/ct-asset\?id=/.test(src) && /\$\{WORKER\}\/ct-plume\?file=/.test(src) &&
         /url\.pathname === "\/v1\/ct-asset" \|\| url\.pathname === "\/v1\/ct-plume"/.test(fs.readFileSync(path.join(HERE, "..", "worker", "index.js"), "utf8")));
-  check("nitrogen dioxide rows go under their own gas heading under Climate", /\{ h: 4, t: "Nitrogen dioxide" \},/.test(src) && /nitrogen dioxide\|\\bno2\\b/.test(src));
+  check("nitrogen dioxide rows go under their own heading under Pollution", /\{ h: 4, t: "Nitrogen dioxide" \},/.test(src) && /nitrogen dioxide\|\\bno2\\b\|\\bnox\\b\|nitric oxide\/i, P \+ " > Pollution > Nitrogen dioxide"/.test(src));
   check("every pollutant Climate TRACE reports can be chosen", ["pm2_5", "bc", "oc", "so2", "vocs", "co", "nh3", "nox", "co2e_100yr"].every((g) => src.includes(`["${g}",`)));
   check("a click reads the plume and the figures live", /ct-plume\?file=\$\{encodeURIComponent\(p\.plume\)\}/.test(src) && /api\.c10e\.org\/v7\/app\/asset/.test(fs.readFileSync(path.join(HERE, "..", "worker", "index.js"), "utf8")));
   const html = new Function("escapeHtml", "CT_GASES", src.slice(src.indexOf("function ctAssetHtml("), src.indexOf("async function addCtAirLayer(")) + "; return ctAssetHtml;")((s) => String(s), [["pm2_5", "PM2.5"]]);
@@ -3010,5 +3010,55 @@ console.log("\nACGF removed; oil slicks grouped; the slick archive seen from afa
   check("the slick archive draws a point per slick wider out", /id: `\$\{cfg\.id\}-pt`, type: "circle", source: `\$\{src\}-pt`, maxzoom: 7/.test(src));
 }
 
+console.log("\nround of 22 September (2): the box refiled, rows taken out");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const places = new Function(src.slice(src.indexOf("const P = \"Destruction > Of the planet\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
+  const order = o.PANEL_ORDER, at = (t, from = 0) => order.findIndex((x, i) => i >= from && x && x.t === t);
+  const P = "Destruction > Of the planet", AG = P + " > Meat and agriculture > Agriculture";
+  const f = (t) => places(t, t).join(" | ");
+  check("the drivers of tree cover loss are deforestation, not fire",
+        f("Tree cover loss by dominant driver") === P + " > Deforestation > Tree cover loss and alerts" &&
+        f("Drivers of tree cover loss (WRI/Google)") === P + " > Deforestation > Tree cover loss and alerts");
+  check("soy planted area is under Nitrous oxide > Soy and still under Agriculture",
+        f("Soy planted area \u2014 South America") === `${P} > Climate > Nitrous oxide > Soy | ${AG} > Soy, corn and grain` &&
+        at("Soy", at("Nitrous oxide")) > at("Nitrous oxide") && at("Soy", at("Nitrous oxide")) < at("F-gases"));
+  check("protected areas, intact forest landscapes worldwide and biodiversity hotspots are biodiversity loss",
+        f("Protected areas (WDPA)") === P + " > Biodiversity loss" &&
+        f("Intact forest landscapes \u2014 Global") === P + " > Biodiversity loss" &&
+        f("Biodiversity hotspots (global, land only)") === P + " > Biodiversity loss");
+  check("dams go under Biodiversity loss > Fish",
+        f("Major dams") === P + " > Biodiversity loss > Fish" && at("Fish") > at("Biodiversity loss") && at("Fish") < at("Spatial plans"));
+  check("forest greenhouse gas emissions go under Deforestation",
+        f("Forest greenhouse gas emissions") === P + " > Deforestation");
+  check("DIST-ALERT is under Construction, Biodiversity loss and Deforestation, not Mining",
+        f("Global all ecosystem disturbance alerts (DIST-ALERT)") === `${P} > Construction | ${P} > Biodiversity loss | ${P} > Deforestation > Tree cover loss and alerts`);
+  check("oil and gas concessions go under Oil and gas drilling and Climate, not Mining",
+        f("Oil and gas concessions") === `${P} > Oil and gas drilling | ${P} > Climate > Infrastructure emitting more than one gas`);
+  check("the named rows are taken out",
+        ["Annual surface temperature anomalies", "Burned areas in WDPA protected areas", "Burned area, two years at a time \u2014 Equatorial Asia",
+         "Burned area \u2014 Indonesia", "Intact forest landscapes \u2014 Equatorial Asia"].every((t) => f(t) === "(taken out)"));
+  check("a biodiversity hotspot is not a fire hotspot", !places("Biodiversity hotspots").includes(P + " > Fire") && places("Fire hotspots").includes(P + " > Fire"));
+  check("nitrogen dioxide is under Pollution, not Climate",
+        f("Air quality: nitrogen dioxide satellite measurements") === P + " > Pollution > Nitrogen dioxide" &&
+        at("Nitrogen dioxide") > at("Pollution") && at("Nitrogen dioxide") < at("Fire"));
+  check("Pollution is by pollutant: General and all pollutants, Nitrogen dioxide, Wastewater, Plastics, Oil spills",
+        ["General and all pollutants", "Nitrogen dioxide", "Wastewater", "Plastics", "Oil spills and slicks"]
+          .every((t, i, a) => at(t, at("Pollution")) > at("Pollution") && (!i || at(t, at("Pollution")) > at(a[i - 1], at("Pollution")))) &&
+        at("Air") === -1 && at("Toxic releases and regulated sites, US") === -1);
+  const co2 = at("Carbon dioxide"), ch4 = at("Methane");
+  check("carbon bombs, the Carbon Majors and Banking on Climate Chaos are under Carbon dioxide",
+        ["carbon_bombs", "carbon_majors", "bocc"].every((i) => order.indexOf(i) > co2 && order.indexOf(i) < ch4));
+  check("the Scribd document is out of the box", !order.includes("scribd_doc") && o.PANEL_REMOVED.has("scribd_doc"));
+  check("rows are filed by title and id, not by their long description",
+        /cataloguePlaces\(item\.fileBy \|\| `\$\{item\.title\} \$\{item\.name\}`, item\.title\)/.test(src));
+  check("a Global Forest Watch row found to have nothing to draw leaves the box",
+        /catalogueRowGone\(d\.key\);/.test(src) && /function catalogueRowGone\(key, ms = 8000\)/.test(src));
+  check("the asset list is read a kind at a time, each tried twice",
+        /GFW_DRAWABLE_KINDS\.map\(\(k\) => readKind\(k\)\.catch\(\(\) => readKind\(k\)\)\)/.test(src));
+}
+
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
'''

root = pathlib.Path.cwd()
if not (root / "map" / "app.js").exists():
    sys.exit("Run this from ~/Desktop/culprits (map/app.js not found here).")

with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False) as f:
    f.write(DIFF)
    patch = f.name

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)

if git("apply", "--check", "--reverse", patch).returncode == 0:
    sys.exit("Already applied: nothing to do.")
check = git("apply", "--check", patch)
if check.returncode != 0:
    sys.exit("This patch does not fit the files on disk, so nothing was changed.\n"
             "It was built against main at 212f812; run git pull first, or git status to see local edits.\n\n" + check.stderr)
done = git("apply", patch)
if done.returncode != 0:
    sys.exit(done.stderr)
print("Applied. Now run: node map/test.mjs && node map/wire.test.mjs")
