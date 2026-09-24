#!/usr/bin/env python3
"""
patch_0920u.py - the mines row reads a build cut into several files.

GitHub refuses any file over 100 MB, so the mine outlines to zoom 13 are
published as several archives. The mines row reads the list of them
(tiles/mining_polygons.build.json) and draws each file at its own zooms. If
the list is not there, the one archive draws as it does today, so this can go
in before or after the tiles are rebuilt.

Needs patch_0920t.py applied and committed first.
Run from the repo folder:  python3 patch_0920u.py
"""
import pathlib, subprocess, sys

DIFF = r"""diff --git a/HANDOFF.md b/HANDOFF.md
index 365abe9..4738d24 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -242,6 +242,25 @@ as before, so nothing breaks while the tiling catches up.
 
 ---
 
+## The mines are several archives, not one
+
+GitHub refuses any file over 100 MB, and the mine outlines to zoom 13 weigh more
+than that; the single archive had to stop at zoom 11. `scripts/mines.py` in
+`culprits-tiles-more` now tiles the outlines once, to zoom 13, and cuts the
+result into as many files as it takes: `tiles/mining_polygons.pmtiles` (the
+points, and the first zooms of outlines), then `mining_polygons_2.pmtiles` and
+so on. It cuts by zoom; a single zoom too big for one file is cut in two down a
+line of longitude. It counts the tiles in the files against the tiles it made
+and keeps nothing if they differ. `tiles/mining_polygons.build.json` lists the
+files and the zooms each holds.
+
+`addPmShapesLayer` reads that list (`pmShapeParts`) and gives each extra file
+its own source and outline layer, drawn only at that file's zooms - otherwise
+the file below stretches its last tiles over the finer ones and every outline
+is painted twice. The extra layer ids go in `cfg._layerIds`, so the row's tick
+switches them. If the list does not answer, the first archive draws alone, as
+it always did, so the map and the tiles repo can be updated in either order.
+
 ## Live Projects to Resist, drawn here rather than opened beside
 
 Its panel row is gone. Three rows under Construction carry what the panel
diff --git a/map/app.js b/map/app.js
index a7bf80a..030d177 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3018,6 +3018,24 @@ function traseBox(cfg, props) {
 }
 
 /* ---------- outlines from a PMTiles archive (points wider out) ---------- */
+// GitHub refuses any file over 100 MB, so a big set of outlines is published as
+// several archives, each holding some zooms (and, where one zoom is too big,
+// one side of a line of longitude). The build lists them in <archive>.build.json.
+// This turns that list into what each file's outline layer needs: its address
+// and the zooms it may draw at. A file draws only at its own zooms, or the file
+// below would stretch its last tiles over the finer ones and paint every outline
+// twice; the files holding the closest zoom go on drawing past it.
+function pmShapeParts(archiveUrl, stamp) {
+  const parts = stamp && Array.isArray(stamp.parts) ? stamp.parts.filter((p) => p && p.file) : [];
+  if (!parts.length) return [{ url: archiveUrl, first: true }];
+  const top = Math.max(...parts.map((p) => Number(p.to)));
+  const base = archiveUrl.slice(0, archiveUrl.lastIndexOf("/") + 1);
+  return parts.map((p, i) => ({
+    url: base + p.file, first: i === 0,
+    minzoom: Number(p.from), maxzoom: Number(p.to) === top ? 24 : Number(p.to) + 1,
+  }));
+}
+
 function addPmShapesLayer(cfg) {
   const src = `${cfg.id}-pm`;
   map.addSource(src, { type: "vector", url: `pmtiles://${cfg.archiveUrl}`, attribution: cfg.attribution || "" });
@@ -3048,6 +3066,28 @@ function addPmShapesLayer(cfg) {
   };
   bindHtmlPopup(`${cfg.id}-fill`, box);
   bindHtmlPopup(`${cfg.id}-pt`, box);
+  // The other files of the same build, if it was cut into several. Until the
+  // list answers (or if it never does) the first file draws alone, as before.
+  fetch(cfg.archiveUrl.replace(/\.pmtiles$/, ".build.json"))
+    .then((r) => (r.ok ? r.json() : null))
+    .then((stamp) => {
+      const parts = pmShapeParts(cfg.archiveUrl, stamp);
+      if (parts.length < 2) return;
+      map.setLayerZoomRange(`${cfg.id}-fill`, parts[0].minzoom, parts[0].maxzoom);
+      cfg._layerIds = cfg._layerIds || [];
+      parts.slice(1).forEach((part, i) => {
+        const psrc = `${cfg.id}-pm-${i + 2}`, lid = `${cfg.id}-fill-${i + 2}`;
+        if (map.getLayer(lid)) return;
+        map.addSource(psrc, { type: "vector", url: `pmtiles://${part.url}`, attribution: cfg.attribution || "" });
+        map.addLayer({ id: lid, type: "fill", source: psrc, "source-layer": cfg.polygonLayer,
+          minzoom: part.minzoom, maxzoom: part.maxzoom,
+          paint: { "fill-color": cfg.colour, "fill-opacity": 0.55, "fill-outline-color": "#1D1B17" } }, `${cfg.id}-pt`);
+        cfg._layerIds.push(lid);
+        bindHtmlPopup(lid, box);
+      });
+      applyVisibility(cfg.id);
+    })
+    .catch((e) => console.warn(`[culprits] ${cfg.id} build list: ${e.message}`));
   setLayerState(cfg.id, "every mine as a point from the world view (merged where they crowd), outlines from zoom 7");
   applyVisibility(cfg.id);
   buildLegend();
diff --git a/map/test.mjs b/map/test.mjs
index c447b25..8d4514c 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1746,6 +1746,21 @@ console.log("\ncolumns close in, a reload button, mines");
   check("…and comes back to the same view", /sessionStorage\.getItem\("culprits-view"\)/.test(src));
   check("mines worldwide is a row, drawn from the tiles repo", /id: "mines_global"[^\n]*route: "pmshapes"/.test(src) &&
         /tiles\/mining_polygons\.pmtiles/.test(src));
+  // The mines are published as several archives, because GitHub refuses a file over 100 MB.
+  const pmShapeParts = new Function(src.match(/function pmShapeParts[\s\S]*?\n}\n/)[0] + "; return pmShapeParts;")();
+  const mineUrl = "https://x.test/tiles/mining_polygons.pmtiles";
+  const cutUp = pmShapeParts(mineUrl, { parts: [
+    { file: "mining_polygons.pmtiles", from: 7, to: 11 }, { file: "mining_polygons_2.pmtiles", from: 12, to: 12 },
+    { file: "mining_polygons_3.pmtiles", from: 13, to: 13, columns: [0, 4000] }, { file: "mining_polygons_4.pmtiles", from: 13, to: 13, columns: [4001, 8191] }] });
+  check("a mines build cut into several files draws each file at its own zooms, never two at once",
+        cutUp.length === 4 && cutUp[0].minzoom === 7 && cutUp[0].maxzoom === 12 && cutUp[1].minzoom === 12 && cutUp[1].maxzoom === 13 &&
+        cutUp[1].url === "https://x.test/tiles/mining_polygons_2.pmtiles");
+  check("\u2026the files holding the closest zoom keep drawing past it, both sides of a longitude cut",
+        cutUp[2].maxzoom === 24 && cutUp[3].maxzoom === 24 && cutUp[2].minzoom === 13);
+  check("\u2026and a build with no list of files draws from the one archive, as before",
+        pmShapeParts(mineUrl, null).length === 1 && pmShapeParts(mineUrl, { zoom: 11 })[0].url === mineUrl);
+  check("\u2026the row reads that list and switches the extra files on and off with it",
+        /\.build\.json/.test(src) && /cfg\._layerIds\.push\(lid\)/.test(src) && /setLayerZoomRange\(`\$\{cfg\.id\}-fill`/.test(src));
 }
 
 console.log("\nthe screen, rearranged");
"""


def run(cmd, text=None):
    return subprocess.run(cmd, input=text, text=True, capture_output=True)


def main():
    if not pathlib.Path("map/app.js").exists():
        sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits).")
    tests = pathlib.Path("map/test.mjs").read_text(encoding="utf-8")
    if "every group is named for its subject" not in tests:
        sys.exit("patch_0920t.py has to be applied and committed first.")
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
    print("Applied. Changed: map/app.js, map/test.mjs, HANDOFF.md")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
