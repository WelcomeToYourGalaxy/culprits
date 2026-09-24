#!/usr/bin/env python3
"""
Round of 23 September (16): the F-gas row has one chip per gas group. Built against 6882c74.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index fb7ce84..846a588 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -818,6 +818,18 @@ materialresearch and Wreckers of the Earth.
   `slick_points` to 6, which the map already reads), writes `tiles.json`, and
   reads again from Cerulean any month the index lists with no store.
 
+## Round of 23 September (16): the first run of the new builds
+
+Every job saved except the slick archive. EDGAR's first build took sulphur
+hexafluoride only, from the first file in its zip, which is not necessarily
+the latest year; `edgar_fgases.py` now builds one archive per gas group
+(HFCs, PFCs, SF6, NF3, HCFCs) from the latest year in each zip, and the row has
+a chip per gas. The slick archive's job was stopped while reading August again
+in one piece; `cerulean_archive.py` now reads a lost month a day at a time,
+saves after each day, stops at 100 minutes, and carries on next run
+(`cerulean_archive/refill.json`). Mines' first file is 96.7 MB (92 MiB), under
+the 95 MiB cut.
+
 ## Round of 23 September (11): the modelled farms' squares made light
 
 The unmerged CAFO archive's world square was 3.6 MB. `abattoir_cafo.py` now
diff --git a/map/app.js b/map/app.js
index c262977..eff2b04 100644
--- a/map/app.js
+++ b/map/app.js
@@ -9105,10 +9105,16 @@ const OTHER_MAPS = {
         { label: "Habitat disturbance", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/food_maiz_disturbance.pmtiles" }
       ],
       note: "What growing maize (corn) put on the land in 2017, food and feed together, mapped by Halpern et al. 2022 (Nature Sustainability) from their data package. Each chip is one of its four pressures, per map cell, coloured dark to light on a log scale cut at the values' own steps (food/<name>.key.json in culprits-tiles-more). Built once from the package; it is not updated." },
-    { id: "edgar_fgases", name: "Fluorinated gas emissions by 10 km cell, latest year (EDGAR)", unit: "per map cell", colour: "#6A5A6E", route: "rasterlive", ready: true, lazy: true,
+    { id: "edgar_fgases", name: "Fluorinated gas emissions by 10 km cell, one chip per gas, latest year (EDGAR)", unit: "tonnes of the gas per map cell", colour: "#6A5A6E", route: "rasterlive", ready: true, lazy: true,
       attribution: "EDGAR_2025_GHG, European Commission JRC, CC BY 4.0", maxzoom: 6,
-      choices: [{ label: "All F-gases", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/edgar_fgases.pmtiles" }],
-      note: "EDGAR's gridded emissions of fluorinated gases (refrigerants, solvents, electrical insulation gas and the like), every 0.1-degree cell with a value, coloured dark to light on a log scale cut at the values' own steps. The file, variable and unit used are in edgar/fgases.key.json in culprits-tiles-more. Built from EDGAR's yearly release; it is not updated between releases." },
+      choices: [
+        { label: "Hydrofluorocarbons (HFCs)", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/edgar_fgases_hfcs.pmtiles" },
+        { label: "Perfluorocarbons (PFCs)", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/edgar_fgases_pfcs.pmtiles" },
+        { label: "Sulphur hexafluoride (SF6)", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/edgar_fgases_sf6.pmtiles" },
+        { label: "Nitrogen trifluoride (NF3)", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/edgar_fgases_nf3.pmtiles" },
+        { label: "Hydrochlorofluorocarbons (HCFCs)", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/edgar_fgases_hcfcs.pmtiles" }
+      ],
+      note: "EDGAR's gridded emissions of each group of fluorinated gases (refrigerants, foam blowing, solvents, electrical insulation, aluminium and chip making), every 0.1-degree cell with a value, from the latest year in EDGAR's release, coloured dark to light on a log scale cut at the values' own steps. Each chip is one gas group in tonnes of that gas; the groups are not added together, as a tonne of one warms very differently from a tonne of another. The year, file and unit of each are in edgar/edgar_fgases_<gas>.key.json in culprits-tiles-more. Built from EDGAR's yearly release; it is not updated between releases." },
     { id: "wastewater_plumes", name: "Nitrogen from human wastewater in coastal waters, 2015 (Tuholske et al.)", unit: "per map cell", colour: "#5E7377", route: "rasterlive", ready: true, lazy: true,
       attribution: "Tuholske et al. 2021, Global Wastewater Model (KNB doi:10.5063/F76B09)", maxzoom: 6,
       choices: [
diff --git a/map/test.mjs b/map/test.mjs
index 476aa25..8f276bf 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3388,7 +3388,8 @@ console.log("\nround of 23 September (11): the modelled farms' squares made ligh
 console.log("\nround of 23 September (12): F-gases from EDGAR");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
-  check("EDGAR's gridded F-gas emissions are a row under Climate > F-gases", /\{ h: 4, t: "F-gases" \}, "edgar_fgases",/.test(src) && /edgar_fgases\.pmtiles/.test(src));
+  check("EDGAR's gridded F-gas emissions are a row under Climate > F-gases", /\{ h: 4, t: "F-gases" \}, "edgar_fgases",/.test(src) && /edgar_fgases_hfcs\.pmtiles/.test(src));
+  check("…one chip per gas group EDGAR publishes, never added together", ["hfcs", "pfcs", "sf6", "nf3", "hcfcs"].every((g) => src.includes(`edgar_fgases_${g}.pmtiles`)) && /are not added together/.test(src));
 }
 console.log("\nround of 23 September (13): the crime tracker under every subject it records");
 {
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
