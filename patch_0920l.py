#!/usr/bin/env python3
"""patch_0920l.py - the plumes carry the middle zooms too; Nusantara's imagery
layer named.

    cd ~/Desktop/culprits
    python3 patch_0920l.py

Goes on top of 97de4a2.

1. The counted points stopped at zoom 6, so from a continent or a country the
   clusters were gone and what replaced them was a scatter of three-pixel dots
   - the layer read as empty again between the world view and the street. The
   merging now runs to zoom 9, which is where each plume starts drawing its own
   picture, so the counted points carry every zoom up to that and individual
   plumes take over exactly when there is something to see. The individual dots
   are a little larger too.

2. Nusantara's `hires` layer is named: high-resolution imagery, the southern
   tip of Bali. Five still keep their server ids - concessioncma_spv,
   concessionfca_spv, millopbufferol_spv, millopbufferol50km_spv,
   millopbufferpolyloreal_spv - and a layer not in the table keeps whatever
   title the server gives it, so nothing is lost by leaving them.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index fb471d1..06a10c7 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3411,7 +3411,12 @@ function columnEdge() {
 // all of it.
 const CARBON_PLUME_ZOOM = 10;     // from here in, the plumes' own pictures
 const CARBON_PLUME_PAGES = 10;    // 1,000 plumes a page
-const CARBON_CLUSTER_TO = 6;      // to here, crowded plumes are merged and counted
+// Merged and counted up to the zoom where each plume starts drawing its own
+// picture. Stopping at 6 left a gap: from a continent or a country the
+// clusters were gone and what replaced them was a scatter of three-pixel
+// dots, so the layer read as empty again between the world view and the
+// street. Now the counted points carry it the whole way.
+const CARBON_CLUSTER_TO = CARBON_PLUME_ZOOM - 1;
 const CARBON_PAGES_AT_ONCE = 3;    // after the first, which is drawn on its own
 const CARBON_PICTURES_AT_ONCE = 40;
 async function addCarbonMapperLayer(cfg) {
@@ -3443,8 +3448,8 @@ async function addCarbonMapperLayer(cfg) {
       "circle-color": ["case", ["==", ["get", "gas"], "CO2"], "#6E6358", cfg.colour],
       "circle-opacity": 0.85,
       "circle-radius": ["interpolate", ["linear"], ["zoom"],
-        1, ["+", 2.6, ["*", 0.8, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]],
-        9, ["+", 3.4, ["*", 1.4, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]]],
+        1, ["+", 3, ["*", 0.9, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]],
+        9, ["+", 3.8, ["*", 1.4, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]]],
       "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5 } });
   const num = (v, unit) => (v === null || v === undefined || v === "" || !isFinite(Number(v)) ? "" :
     `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}${unit}`);
@@ -3656,6 +3661,7 @@ const NUSANTARA_NAMES = {
   "concessiontimber_spv": "Timber concessions",
   "geotag": "Geotagged photographs",
   "hillshade": "Hillshade relief",
+  "hires": "High-resolution imagery, the southern tip of Bali",
   "merauke_concessionother_sugarcane": "Sugarcane concessions, Merauke",
   "merauke_road_plan": "Planned roads, Merauke",
   "millop_finance_credit": "Palm oil mills, by who lends to them",
diff --git a/map/test.mjs b/map/test.mjs
index 7116e93..8dbf826 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2502,10 +2502,18 @@ console.log("\nplumes show from the world view; the last sources named");
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   check("crowded plumes are merged into one counted point, and split again close in",
         /cluster: true, clusterMaxZoom: CARBON_CLUSTER_TO/.test(src) &&
-        /const CARBON_CLUSTER_TO = 6;/.test(src) &&
+        /const CARBON_CLUSTER_TO = CARBON_PLUME_ZOOM - 1;/.test(src) &&
         /filter: \["has", "point_count"\]/.test(src) &&
         /filter: \["!", \["has", "point_count"\]\]/.test(src));
   check("a merged point says how many are under it", /plumes here<\/b>/.test(src));
+  // The counted points run to the zoom where each plume starts drawing its own
+  // picture, so there is no band between the world view and the street where
+  // the layer reads as empty.
+  check("the counted points carry every zoom up to the pictures",
+        src.indexOf("const CARBON_PLUME_ZOOM") < src.indexOf("const CARBON_CLUSTER_TO") &&
+        /const CARBON_PLUME_ZOOM = 10;/.test(src));
+  check("Nusantara's high-resolution imagery says where it is",
+        /"hires": "High-resolution imagery, the southern tip of Bali"/.test(src));
   check("hiding the row hides the merged points too", /`\$\{id\}-agg`, `\$\{id\}-cl`, `\$\{id\}-pt`/.test(src));
   const sites = new Function(src.slice(src.indexOf("const LAYER_SITE = {"), src.indexOf("function siteLink(")) + "; return LAYER_SITE;")();
   const was = ["fertilizer_facilities", "gpw_map", "seas_of_plastic", "gfw_catalogue", "atlas_hotspots",
"""


def run(args, text=None):
    return subprocess.run(args, input=text, capture_output=True, text=True)


def main():
    if run(["git", "rev-parse", "--is-inside-work-tree"]).returncode != 0:
        sys.exit("Not a git repository. Run this from ~/Desktop/culprits.")
    try:
        app = open("map/app.js", encoding="utf-8").read()
    except OSError:
        sys.exit("map/app.js not found. Run this from the top of the repo.")
    if "CARBON_CLUSTER_TO" not in app:
        sys.exit("patch_0920k.py has to be applied and committed first.")
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
    print("Applied. Changed: map/app.js, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
