#!/usr/bin/env python3
"""
Round of 23 September (10): the wastewater model's coastal plumes as a row under Pollution > Wastewater.
Built against b4ab10e.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 7ee154f..b6bc474 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -761,6 +761,16 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 23 September (10): the wastewater plumes
+
+`wastewater_plumes` (rasterlive, four chips) under Pollution > Wastewater, from
+culprits-tiles-more `scripts/wastewater_plumes.py` (by hand): downloads the
+plume zip, reads each 3 GB raster at a quarter resolution (average), draws it
+with `food_crops.build_array` (which now skips any square whose parent held
+nothing), into `tiles/wastewater_plume_<k>.pmtiles` and
+`wastewater/plume_<k>.key.json`. A raster with no projection is not drawn.
+The watershed shapes are not built.
+
 ## Round of 23 September (9): refresh notes, positions, place names, the green cast
 
 - **Refresh notes**: `refreshNote(cfg)` adds a small note after every LIVE /
diff --git a/map/app.js b/map/app.js
index dafd5ed..b82d09d 100644
--- a/map/app.js
+++ b/map/app.js
@@ -9086,6 +9086,15 @@ const OTHER_MAPS = {
         { label: "Habitat disturbance", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_maiz_disturbance.pmtiles" }
       ],
       note: "What growing maize (corn) put on the land in 2017, food and feed together, mapped by Halpern et al. 2022 (Nature Sustainability) from their data package. Each chip is one of its four pressures, per map cell, coloured dark to light on a log scale cut at the values' own steps (food/<name>.key.json in culprits-tiles-more). Built once from the package; it is not updated." },
+    { id: "wastewater_plumes", name: "Nitrogen from human wastewater in coastal waters, 2015 (Tuholske et al.)", unit: "per map cell", colour: "#5E7377", route: "rasterlive", ready: true, lazy: true,
+      attribution: "Tuholske et al. 2021, Global Wastewater Model (KNB doi:10.5063/F76B09)", maxzoom: 6,
+      choices: [
+        { label: "All wastewater", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_plume_tot.pmtiles" },
+        { label: "From sewage treatment", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_plume_treated.pmtiles" },
+        { label: "From septic systems", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_plume_septic.pmtiles" },
+        { label: "Untreated", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_plume_open.pmtiles" }
+      ],
+      note: "The model's coastal plumes: how the nitrogen from each watershed's wastewater spreads into the sea, per map cell. Drawn from the model's own rasters (scripts/wastewater_plumes.py in culprits-tiles-more), read at about 4 km and coloured dark to light on a log scale cut at the values' own steps. Built once from the 2021 data package; the model is not updated." },
     { id: "wastewater", name: "Global Wastewater Model (Tuholske et al.)", unit: "nitrogen from human wastewater", colour: "#5E7377", route: "rasterlive", ready: true, lazy: true,
       attribution: "Tuholske et al. 2021, Global Wastewater Model", maxzoom: 10,
       choices: [
@@ -9542,6 +9551,7 @@ const LAYER_KIND = {
   gfw_catalogue: ["plant", "downstream"],
   coastal_cleanup: ["insentient", "downstream"],
   food_soy: ["plant", "downstream"], food_maize: ["plant", "downstream"],
+  wastewater_plumes: ["insentient", "downstream"],
   wasteatlas_dumpsites: ["insentient", "downstream"],
   wasteatlas_landfills: ["insentient", "downstream"],
   wasteatlas_wte: ["insentient", "downstream"],
@@ -10046,7 +10056,8 @@ const LAYER_SITE = {
   pe_subsidising: "https://portfolio.earth/campaigns/subsidising-extinction/",
   powerbi_report: "https://app.powerbi.com/view?r=eyJrIjoiZGJmNGIwODgtMTgyMS00NmVlLWJmNWUtZTAzZDBlMmQ1ODI2IiwidCI6IjBiMzNkZjAwLTYzNGMtNDBlYy1iOGQ5LTZhMGI2MjYyNmU1ZCJ9",
   seas_of_plastic: "https://app.dumpark.com/seas-of-plastic-2/",
-  food_soy: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B", food_maize: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B",
+  food_soy: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B",
+  wastewater_plumes: "https://knb.ecoinformatics.org/view/doi:10.5063/F76B09", food_maize: "https://knb.ecoinformatics.org/view/doi:10.5063/F1V69H1B",
   wasteatlas_dumpsites: "http://www.atlas.d-waste.com/",
   wasteatlas_landfills: "http://www.atlas.d-waste.com/",
   wasteatlas_wte: "http://www.atlas.d-waste.com/",
@@ -10267,6 +10278,7 @@ function refreshNote(cfg) {
 const NOT_LIVE = {
   coastal_cleanup: "Ocean Conservancy's cleanup sites, from a copy made daily (their server lets only their own site read it)",
   food_soy: "Built once from the 2017 data package of Halpern et al. 2022; it is not updated",
+  wastewater_plumes: "Built once from the Global Wastewater Model's 2021 data package; it is not updated",
   food_maize: "Built once from the 2017 data package of Halpern et al. 2022; it is not updated",
   wasteatlas_dumpsites: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
   wasteatlas_landfills: "Waste Atlas\u2019s markers, from a copy made weekly (the site answers only over plain http)",
@@ -10359,7 +10371,7 @@ const PANEL_ORDER = [
   { h: 4, t: "Nitrogen dioxide" },
   // The model's map server is gone; its data package is drawn instead
   // (pipeline/wastewater_build.py, 23 September).
-  { h: 4, t: "Wastewater" }, "hydrowaste", "wastewater_n_tot", "wastewater_n_treated", "wastewater_n_septic", "wastewater_n_open", "wastewater_n_countries",
+  { h: 4, t: "Wastewater" }, "hydrowaste", "wastewater_n_tot", "wastewater_n_treated", "wastewater_n_septic", "wastewater_n_open", "wastewater_n_countries", "wastewater_plumes",
   // Waste Atlas (item 44), one row per kind of place it maps (23 September).
   { h: 4, t: "Solid waste" }, "wasteatlas_dumpsites", "wasteatlas_landfills", "wasteatlas_wte", "wasteatlas_mbt", "wasteatlas_bt", "wasteatlas_cities", "wasteatlas_countries",
   { h: 4, t: "Plastics" },
diff --git a/map/test.mjs b/map/test.mjs
index 89108d6..4144886 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3366,5 +3366,12 @@ console.log("\nround of 23 September (9): refresh notes, where each dot is, plac
         /id="names-toggle"/.test(src) && /map\.setLayoutProperty\(l\.id, "text-field", ""\)/.test(src) && /namesField\.get\(l\.id\)/.test(src));
   check("the Satellite lowlands keep their darkness with far less green", /1, "rgba\(46,52,34,0\.32\)", 400, "rgba\(48,54,36,0\.3\)"/.test(src));
 }
+console.log("\nround of 23 September (10): the wastewater plumes");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("the model's coastal plumes are a row under Wastewater, one chip per source of the nitrogen",
+        ["tot", "treated", "septic", "open"].every((k) => src.includes(`wastewater_plume_${k}.pmtiles`)) &&
+        /"wastewater_n_countries", "wastewater_plumes",/.test(src));
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
