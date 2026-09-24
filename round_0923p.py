#!/usr/bin/env python3
"""
Round of 23 September (15): the mines, mine features and EPA rows no longer say their points are merged.
Built against 351d2e1.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/map/app.js b/map/app.js
index 78a92a5..c262977 100644
--- a/map/app.js
+++ b/map/app.js
@@ -8790,11 +8790,11 @@ const OTHER_MAPS = {
     { id: "mines_global", name: "Mines worldwide (Maus et al. 2022 and OpenStreetMap)", unit: "mine outlines", colour: "#6E5E52", route: "pmshapes", ready: true, lazy: true,
       archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/mining_polygons.pmtiles", polygonLayer: "mines", pointLayer: "mine_points",
       attribution: "Maus et al. 2022; OpenStreetMap contributors; merged by WU Vienna 2024 (ODbL)",
-      note: "192,584 mine outlines: Maus et al.'s satellite-traced mining areas merged with OpenStreetMap's mines and quarries (Zenodo 7307210, ODbL), with the tree cover loss inside each from 2000 to 2019. Every mine as a point from the world view, merged where they crowd; outlines from zoom 7." },
+      note: "192,584 mine outlines: Maus et al.'s satellite-traced mining areas merged with OpenStreetMap's mines and quarries (Zenodo 7307210, ODbL), with the tree cover loss inside each from 2000 to 2019. Every mine as its own point from the world view, none merged (since 23 September); outlines from zoom 7." },
     { id: "mine_features", name: "Mine features worldwide \u2014 pits, waste dumps, tailings dams and plant, traced one by one (Tang and Werner 2023)", unit: "mine features", colour: "#7A6A5E", route: "pmshapes", ready: true, lazy: true,
       archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/mine_features.pmtiles", polygonLayer: "mine_features", pointLayer: "mine_feature_points",
       attribution: "Tang and Werner 2023, Communications Earth & Environment (Zenodo 7894216, CC BY 4.0)",
-      note: "74,548 outlines drawn tight round each feature of a mine - the pit, the waste rock dump, the tailings dam, the pond, the heap leach pad, the plant - rather than round the whole site, which is how this differs from the Mines row. The release carries an id, a name (mostly blank or a digitising leftover; a few say Au, Cu, Fe, diamond, coal, tungsten), a length and an area, and no commodity or impact figure. Every feature as a point from the world view, merged where they crowd; outlines from zoom 7." },
+      note: "74,548 outlines drawn tight round each feature of a mine - the pit, the waste rock dump, the tailings dam, the pond, the heap leach pad, the plant - rather than round the whole site, which is how this differs from the Mines row. The release carries an id, a name (mostly blank or a digitising leftover; a few say Au, Cu, Fe, diamond, coal, tungsten), a length and an area, and no commodity or impact figure. Every feature as its own point from the world view, none merged (since 23 September); outlines from zoom 7." },
     { id: "ejatlas", name: "Environmental justice conflicts (EJAtlas)", unit: "conflicts", colour: "#7A5A55", route: "ejatlas", ready: true, lazy: true,
       api: "https://ejatlas.org/api/v1/conflicts/",
       note: "Every conflict in the EJAtlas, read live from its own data address; each box links the conflict's page." },
@@ -8955,7 +8955,7 @@ const OTHER_MAPS = {
       // culprits-tiles-more); each point's full record is fetched from EPA on click.
       points: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/epa_efpoints.pmtiles",
       attribution: "US EPA Envirofacts",
-      note: "The facility points behind EPA's Envirofacts multisystem widget, drawn live from EPA's EnviroMapper service; EPA draws them from about state level in; wider out, a weekly copy of every point is drawn, merged into counted points where they crowd." },
+      note: "The facility points behind EPA's Envirofacts multisystem widget, drawn live from EPA's EnviroMapper service; EPA draws them from about state level in; wider out, a copy of every point is drawn, none merged, renewed every four weeks (one file per zoom, so the world view is the heaviest to load)." },
     { id: "bocc", name: "Banking on Climate Chaos", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
       page: "https://www.bankingonclimatechaos.org/?bank=JPMorgan%20Chase#fulldata-panel",
       note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
diff --git a/map/test.mjs b/map/test.mjs
index 6028333..476aa25 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3405,5 +3405,10 @@ console.log("\nround of 23 September (14): the Atlas's city maps laid on the map
         /what\.cityPlate \? \(await atlasCityPlatesRead\(\)\)\[what\.cityPlate\]/.test(src) && /culprits-tiles-more\/atlas\/city_plates\.json/.test(src));
   check("…a city with no placed map keeps its own zoom", /if \(what\.cityPlate\) return;/.test(src));
 }
+console.log("\nround of 23 September (15): the rows say their points are no longer merged");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("no row's note still says its points are merged where they crowd", !/note: "[^"\n]*merged where they crowd/.test(src) && !/note: "[^"\n]*merged into counted points/.test(src));
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
