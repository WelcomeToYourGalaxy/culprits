#!/usr/bin/env python3
"""
Round of 22 September (6): USDA's retired explorers out, Wreckers of the Earth from a daily copy,
the KNB question asked again. Built against culprits main at fa9737d.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 6c15016..8287d56 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -470,6 +470,26 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 22 September (6): the second check
+
+- **USDA's explorers are gone.** ipad.fas.usda.gov now answers 503 with a page
+  titled "IPAD retired": per USDA guidance the site is no longer public, and
+  gis.ipad.fas.usda.gov does not connect at all. `usda_soybean` and
+  `usda_corn` are in `PANEL_REMOVED` (their configs kept, for the record).
+  Soy and corn are still on the map through MapSPAM (GFW catalogue) and
+  Trase's measures.
+- **Wreckers of the Earth**: every layer comes back as text/html with no CORS
+  header, at the map's own address and without the language part, though the
+  body is the GeoJSON. culprits-tiles-more now has `scripts/umap_copy.py`
+  (run daily by refresh.yml, which runs every script in scripts/), writing
+  `umap/<map>/<layer>.geojson`; `readUmap` tries that copy first. The row is
+  NOT LIVE.
+- **GFW's tile service colours a GeoTIFF when given `colormap`** (a square over
+  the Amazon came back 200, image/png), so the round 5 keys hold.
+- **Wastewater (KNB)**: the package metadata names three zips but gives no
+  addresses; the resource-map query found nothing. The check now asks the
+  index by the package id itself.
+
 ## Round of 22 September (5): what check-sources.mjs found
 
 Read from the owner's run of `map/check-sources.mjs`:
diff --git a/map/app.js b/map/app.js
index 91c6cab..d4a41e6 100644
--- a/map/app.js
+++ b/map/app.js
@@ -2943,7 +2943,11 @@ async function readUmap(cfg) {
   for (const dl of layers) {
     const id = typeof dl === "object" ? (dl.id || dl.uuid || dl.pk || (dl.settings && dl.settings.id)) : dl;
     let gj = null;
+    // The daily copy first: uMap sends each layer without a CORS header, at
+    // either address, so the browser cannot read it there (checked 22
+    // September). The live addresses stay after it, for the day uMap changes.
     const urls = [
+      `https://welcometoyourgalaxy.github.io/culprits-tiles-more/umap/${cfg.umapId}/${id}.geojson`,
       tpl ? site + tpl.replace("{map_id}", cfg.umapId).replace("{pk}", id).replace("{datalayer_id}", id) : null,
       tpl ? cfg.umap + tpl.replace("{map_id}", cfg.umapId).replace("{pk}", id).replace("{datalayer_id}", id) : null,
       `${cfg.umap}/datalayer/${cfg.umapId}/${id}/`, `${cfg.umap}/datalayer/${id}/`,
@@ -9864,6 +9868,7 @@ const NOT_LIVE = {
   wastewater: "The Global Wastewater Model, from copies kept here; the model is not updated",
   trase_measures: "Trase's values come from a copy made weekly; only the region shapes are read live",
   atlas_cities: "The places are from a copy made weekly; each city's own page is read live",
+  wreckers_umap: "The map's settings are read live from uMap; its places come from a daily copy, since uMap lets no other site read them",
   // Trase's file server sends no CORS header (checked 22 September), so its
   // facilities maps are read from a weekly copy in culprits-tiles-more.
   trase_meat_brazil: "Trase's facilities file, from a copy made weekly (its file server does not let other sites read it)",
@@ -9912,8 +9917,8 @@ const PANEL_ORDER = [
   { h: 4, t: "Carbon dioxide" }, "owid_co2", "gem_coal", "power_plants", "fractracker_refineries", "carbon_plumes", "carbon_bombs", "carbon_majors", "bocc",
   { h: 4, t: "Methane" }, "carbon_plumes", "hydrowaste", "wastewater",
   { h: 4, t: "Nitrous oxide" }, "fertilizer_facilities",
-  { h: 5, t: "Soy" }, "usda_soybean", "trase_silos_brazil",
-  { h: 5, t: "Corn" }, "usda_corn",
+  { h: 5, t: "Soy" }, "trase_silos_brazil",
+  { h: 5, t: "Corn" },
   { h: 5, t: "Grain" }, "site_china_grain",
   { h: 4, t: "F-gases" },
   { h: 4, t: "Black carbon" }, "fractracker_refineries",
@@ -9955,7 +9960,7 @@ const PANEL_ORDER = [
   { h: 3, t: "Meat and agriculture" }, "site_food_system",
   { h: 4, t: "Agriculture" },
   { h: 5, t: "Palm oil" }, "palmwatch", "trase_palm_indonesia",
-  { h: 5, t: "Soy, corn and grain" }, "trase_silos_brazil", "usda_soybean", "usda_corn", "site_china_grain",
+  { h: 5, t: "Soy, corn and grain" }, "trase_silos_brazil", "site_china_grain",
   { h: 5, t: "Cocoa and cotton" }, "trase_cocoa_ivory",
   { h: 5, t: "Farm inputs" }, "fertilizer_facilities",
   { h: 5, t: "Moratoriums" },
@@ -10047,6 +10052,10 @@ const PANEL_REMOVED = new Set([
   "leverage_chart",
   "cultivated_meat_laws",          // taken out 22 September at the owner's request
   "scribd_doc",                    // the Destruction page document, taken out 22 September (round 2)
+  // USDA retired its IPAD site and map servers (the site says so: "no longer
+  // available to the public", checked 22 September); the two explorers can
+  // never draw. Soy and corn are still drawn by MapSPAM's rows and Trase's.
+  "usda_soybean", "usda_corn",
   // Taken out 19 Sept: near duplicates, a background map mistaken for data, rows
   // merged into another, and pages asked to be removed.
   "site_cartel_cells", "site_export_credit_shading", "giga_schools", "nsf_locations",
diff --git a/map/check-sources.mjs b/map/check-sources.mjs
index 0e02bb9..935304d 100644
--- a/map/check-sources.mjs
+++ b/map/check-sources.mjs
@@ -105,6 +105,9 @@ for (const u of ["https://gis.ipad.fas.usda.gov/arcgis/rest/services?f=json", "h
       console.log(`    ${m[2]} | id ${m[1] || "-"} | ${size} bytes | ${url}`);
     }
   }
+  for (const q of ['id:"doi:10.5063/F76B09"', 'documents:"doi:10.5063/F76B09" OR isDocumentedBy:"doi:10.5063/F76B09"']) {
+    await ask(`(26) KNB index: ${q}`, `https://knb.ecoinformatics.org/knb/d1/mn/v2/query/solr/?q=${encodeURIComponent(q)}&fl=id,fileName,size,resourceMap,documents&rows=50&wt=json`, { show: 3000 });
+  }
   await ask("(26) the package's list of files", "https://knb.ecoinformatics.org/knb/d1/mn/v2/query/solr/?q=resourceMap:%22resource_map_doi:10.5063/F76B09%22&fl=identifier,fileName,size&rows=50&wt=json", { show: 2500 });
 }
 
diff --git a/map/test.mjs b/map/test.mjs
index 57849d8..81abdb5 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3174,5 +3174,15 @@ console.log("\nround of 22 September (5): what check-sources found");
   check("Trase's facilities are read from the weekly copy where one was made, and say NOT LIVE",
         /base = hit\.base \|\| m\.base \|\| base;/.test(src) && /trase_silos_brazil: "Trase's facilities file, from a copy made weekly/.test(src));
 }
+console.log("\nround of 22 September (6): the second check");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
+  check("USDA's retired explorers are out of the box", !o.PANEL_ORDER.includes("usda_soybean") && !o.PANEL_ORDER.includes("usda_corn") &&
+        o.PANEL_REMOVED.has("usda_soybean") && o.PANEL_REMOVED.has("usda_corn"));
+  check("a uMap layer is read from the daily copy first, and the row says NOT LIVE",
+        /culprits-tiles-more\/umap\/\$\{cfg\.umapId\}\/\$\{id\}\.geojson/.test(src) && /wreckers_umap: "The map's settings are read live/.test(src));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
'''

if not (pathlib.Path.cwd() / "map/app.js").exists():
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
    sys.exit("This patch does not fit the files on disk, so nothing was changed. Run git pull first.\n" + check.stderr)
done = git("apply", patch)
if done.returncode != 0:
    sys.exit(done.stderr)
print("Applied.")
