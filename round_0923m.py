#!/usr/bin/env python3
"""
Round of 23 September (12): EDGAR's F-gas emissions as a row under Climate > F-gases; the handed-over list
in HANDOFF. Built against f518cf2.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 8e9bd69..4a7eb22 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -786,6 +786,25 @@ Kept as the rounds go; move a line out when it is settled.
 - **Satellite basemap** is also worked on in another chat; changes here are
   kept to the lowland colour stops.
 
+## Round of 23 September (12): the other chat's list taken over; F-gases; the slick archive
+
+The other chat handed over its open items (HANDOFF_TO_OTHER_CHAT.md, 23
+September). Done or already covered: the Global Wastewater Model (pour
+points, countries, plumes), the outside-server checks for USDA, EJAtlas,
+materialresearch and Wreckers of the Earth.
+
+- **EDGAR F-gases** (`edgar_fgases`, rasterlive, Climate > F-gases): from
+  culprits-tiles-more `scripts/edgar_fgases.py` (by hand). EDGAR's page folds
+  its gridmap links, so the script reads the release's own file index on
+  jeodpp, writes `edgar/listing.txt`, and takes the latest annual F-gas
+  emissions gridmap it finds; if none, it stops and the listing says why.
+- **Cerulean slick archive**: `scripts/cerulean_archive.py` keeps each month as
+  `<month>.geojson.gz` (was plain GeoJSON; September's 85 MB file was about to
+  pass the cut, and August and July had already been lost to it), tiles each
+  changed month into `<month>.pmtiles` (layers `slicks` from zoom 7,
+  `slick_points` to 6, which the map already reads), writes `tiles.json`, and
+  reads again from Cerulean any month the index lists with no store.
+
 ## Round of 23 September (11): the modelled farms' squares made light
 
 The unmerged CAFO archive's world square was 3.6 MB. `abattoir_cafo.py` now
diff --git a/map/app.js b/map/app.js
index e9e7ba5..9aced67 100644
--- a/map/app.js
+++ b/map/app.js
@@ -9093,6 +9093,10 @@ const OTHER_MAPS = {
         { label: "Habitat disturbance", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_maiz_disturbance.pmtiles" }
       ],
       note: "What growing maize (corn) put on the land in 2017, food and feed together, mapped by Halpern et al. 2022 (Nature Sustainability) from their data package. Each chip is one of its four pressures, per map cell, coloured dark to light on a log scale cut at the values' own steps (food/<name>.key.json in culprits-tiles-more). Built once from the package; it is not updated." },
+    { id: "edgar_fgases", name: "Fluorinated gas emissions by 10 km cell, latest year (EDGAR)", unit: "per map cell", colour: "#6A5A6E", route: "rasterlive", ready: true, lazy: true,
+      attribution: "EDGAR_2025_GHG, European Commission JRC, CC BY 4.0", maxzoom: 6,
+      choices: [{ label: "All F-gases", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/edgar_fgases.pmtiles" }],
+      note: "EDGAR's gridded emissions of fluorinated gases (refrigerants, solvents, electrical insulation gas and the like), every 0.1-degree cell with a value, coloured dark to light on a log scale cut at the values' own steps. The file, variable and unit used are in edgar/fgases.key.json in culprits-tiles-more. Built from EDGAR's yearly release; it is not updated between releases." },
     { id: "wastewater_plumes", name: "Nitrogen from human wastewater in coastal waters, 2015 (Tuholske et al.)", unit: "per map cell", colour: "#5E7377", route: "rasterlive", ready: true, lazy: true,
       attribution: "Tuholske et al. 2021, Global Wastewater Model (KNB doi:10.5063/F76B09)", maxzoom: 6,
       choices: [
@@ -9559,6 +9563,7 @@ const LAYER_KIND = {
   coastal_cleanup: ["insentient", "downstream"],
   food_soy: ["plant", "downstream"], food_maize: ["plant", "downstream"],
   wastewater_plumes: ["insentient", "downstream"],
+  edgar_fgases: ["insentient", "downstream"],
   wasteatlas_dumpsites: ["insentient", "downstream"],
   wasteatlas_landfills: ["insentient", "downstream"],
   wasteatlas_wte: ["insentient", "downstream"],
@@ -10064,7 +10069,8 @@ const LAYER_SITE = {
   powerbi_report: "https://app.powerbi.com/view?r=eyJrIjoiZGJmNGIwODgtMTgyMS00NmVlLWJmNWUtZTAzZDBlMmQ1ODI2IiwidCI6IjBiMzNkZjAwLTYzNGMtNDBlYy1iOGQ5LTZhMGI2MjYyNmU1ZCJ9",
   seas_of_plastic: "https://app.dumpark.com/seas-of-plastic-2/",
   food_soy: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B",
-  wastewater_plumes: "https://knb.ecoinformatics.org/view/doi:10.5063/F76B09", food_maize: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B",
+  wastewater_plumes: "https://knb.ecoinformatics.org/view/doi:10.5063/F76B09",
+  edgar_fgases: "https://edgar.jrc.ec.europa.eu/dataset_ghg2025", food_maize: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B",
   wasteatlas_dumpsites: "http://www.atlas.d-waste.com/",
   wasteatlas_landfills: "http://www.atlas.d-waste.com/",
   wasteatlas_wte: "http://www.atlas.d-waste.com/",
@@ -10286,6 +10292,7 @@ const NOT_LIVE = {
   coastal_cleanup: "Ocean Conservancy's cleanup sites, from a copy made daily (their server lets only their own site read it)",
   food_soy: "Built once from the 2017 data package of Halpern et al. 2022; it is not updated",
   wastewater_plumes: "Built once from the Global Wastewater Model's 2021 data package; it is not updated",
+  edgar_fgases: "Built from EDGAR's yearly release; it is not updated between releases",
   food_maize: "Built once from the 2017 data package of Halpern et al. 2022; it is not updated",
   wasteatlas_dumpsites: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
   wasteatlas_landfills: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
@@ -10355,7 +10362,7 @@ const PANEL_ORDER = [
   { h: 5, t: "Soy" }, "trase_silos_brazil", "food_soy",
   { h: 5, t: "Corn" }, "food_maize",
   { h: 5, t: "Grain" }, "site_china_grain",
-  { h: 4, t: "F-gases" },
+  { h: 4, t: "F-gases" }, "edgar_fgases",
   { h: 4, t: "Black carbon" }, "fractracker_refineries", "ct_air_bc",
   // Oil and gas concessions (from the catalogues) are filed here as well as
   // under Oil and gas drilling: the wells emit carbon dioxide, methane and,
diff --git a/map/test.mjs b/map/test.mjs
index 38b8ef4..f840c85 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3382,5 +3382,10 @@ console.log("\nround of 23 September (11): the modelled farms' squares made ligh
         /const CAFO_PIECES = "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/cafo\/pieces";/.test(src) &&
         /readPiece\(CAFO_PIECES, p\.id\)/.test(src));
 }
+console.log("\nround of 23 September (12): F-gases from EDGAR");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("EDGAR's gridded F-gas emissions are a row under Climate > F-gases", /\{ h: 4, t: "F-gases" \}, "edgar_fgases",/.test(src) && /edgar_fgases\.pmtiles/.test(src));
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
