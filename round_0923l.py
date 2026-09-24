#!/usr/bin/env python3
"""
Round of 23 September (11): the modelled farms read their records from pieces on a click; HANDOFF keeps a list
of what could not be got or needs the owner. Built against 6dced71.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index b6bc474..8e9bd69 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -761,6 +761,40 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Could not get, could not add, or needs the owner (kept current)
+
+Kept as the rounds go; move a line out when it is settled.
+
+- **Wageningen driver classes**: the alert-drivers layer is keyed Class 1 to
+  11; Global Forest Watch publishes the numbers without names and no public
+  list was found. Needs the class list from Wageningen or GFW.
+- **Atlas for the End of the World plates not placed** (10): Cape Floristic
+  Region, East Melanesian Islands, Madagascar, Mountains of Southwest China,
+  New Caledonia, New Zealand, Philippines, Southwest Australia, Succulent
+  Karoo, Wallacea: too few named towns agreed, or the fit was off by too much.
+  They zoom to their outline instead.
+- **USDA soybean and corn explorers**: USDA retired the site; rows removed.
+- **Three Nusantara layers** keep the server's own titles: nobody could vouch
+  for what they show.
+- **Three older Global Forest Watch driver layers** stay grey: GFW paints them
+  itself and two have no finished tiles.
+- **Wastewater watershed shapes** (103 MB) not built: waiting on the owner.
+- **Waste Atlas** is a 2016-era site: its figures are as it last published
+  them; its https certificate has expired, hence the weekly copy.
+- **Workflow files**: the owner's Mac token cannot push `.github/workflows`
+  changes; those are edited on github.com.
+- **Satellite basemap** is also worked on in another chat; changes here are
+  kept to the lowland colour stops.
+
+## Round of 23 September (11): the modelled farms' squares made light
+
+The unmerged CAFO archive's world square was 3.6 MB. `abattoir_cafo.py` now
+tiles only `id` and `precise`, with every field in `cafo/pieces/<hh>.json`
+(FNV-1a); the map reads the piece on a click (`CAFO_PIECES`), and an older
+full-field square still shows as before. The mines' tile-join now keeps
+squares over 500 kB (`--no-tile-size-limit`); the first unmerged build had
+lost the world-view squares. Soy and maize are built (4 to 10 MB each).
+
 ## Round of 23 September (10): the wastewater plumes
 
 `wastewater_plumes` (rasterlive, four chips) under Pollution > Wastewater, from
diff --git a/map/app.js b/map/app.js
index b82d09d..e9e7ba5 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3719,6 +3719,9 @@ const ABATTOIR_PARTS = [
   ["glw", "Livestock density (FAO, modelled)"],
 ];
 const CAFO_TILES = "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/abattoir_cafo.pmtiles";
+// Since 23 September the squares carry only each facility's id and whether its
+// position is its own; every field is in pieces beside them, read on a click.
+const CAFO_PIECES = "https://welcometoyourgalaxy.github.io/culprits-tiles-more/cafo/pieces";
 const GLW_TILES = "https://data.apps.fao.org/map/wmts/wmts?layer=fao-gismgr/GLW4-2020/mapsets/D-DA" +
   "&tilematrixset=EPSG:3857&Service=WMTS&request=GetTile&Version=1.0.0&style=default&Format=image/png" +
   "&layertype=Image&TileMatrix={z}&TileCol={x}&TileRow={y}";
@@ -3750,10 +3753,14 @@ function addCafoLayer(cfg) {
       "circle-stroke-color": "#7B6A4E",
       "circle-stroke-width": ["case", ["==", ["get", "precise"], 0], 1, 0.4],
     } }, pointLayerAbove());
+  const cafoBox = (p) => `<b>Confined animal facility (modelled)</b><table class="meta">${fieldRows(p, ["precise", "id"])}</table>` +
+    `<div class="meta">Climate TRACE model these from satellite imagery and census data. Nothing here has necessarily been visited, licensed or confirmed by any authority${Number(p.precise) === 0 ? "; hollow because the source gives an area, not a position" : ""}.</div>`;
   bindHtmlPopup(`${cfg.id}-cafo`, (p) => Number(p.point_count) > 1
     ? `<b>${Number(p.point_count).toLocaleString()} modelled facilities here</b><div class="meta">Merged at this zoom. Zoom in to see each one.</div>`
-    : `<b>Confined animal facility (modelled)</b><table class="meta">${fieldRows(p, ["precise"])}</table>` +
-      `<div class="meta">Climate TRACE model these from satellite imagery and census data. Nothing here has necessarily been visited, licensed or confirmed by any authority${Number(p.precise) === 0 ? "; hollow because the source gives an area, not a position" : ""}.</div>`);
+    // A square with only the id reads the facility's whole record from its piece.
+    : Object.keys(p).every((k) => k === "id" || k === "precise")
+      ? readPiece(CAFO_PIECES, p.id).then((piece) => cafoBox(Object.assign({}, (piece[p.id] || {}).properties || {}, { precise: p.precise })))
+      : cafoBox(p));
   setLayerState(cfg.id, "Climate TRACE's modelled confined animal facilities");
   applyVisibility(cfg.id);
 }
diff --git a/map/test.mjs b/map/test.mjs
index 1750a27..38b8ef4 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3375,5 +3375,12 @@ console.log("\nround of 23 September (10): the wastewater plumes");
         ["tot", "treated", "septic", "open"].every((k) => src.includes(`wastewater_plume_${k}.pmtiles`)) &&
         /"wastewater_n_countries", "wastewater_plumes",/.test(src));
 }
+console.log("\nround of 23 September (11): the modelled farms' squares made light");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("a modelled farm with only its id in the square reads its whole record from its piece on a click",
+        /const CAFO_PIECES = "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/cafo\/pieces";/.test(src) &&
+        /readPiece\(CAFO_PIECES, p\.id\)/.test(src));
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
