#!/usr/bin/env python3
"""patch_0920q.py - the Stuck box above the View box; the pulp periods under
one heading; alert rows that say how they differ.

    cd ~/Desktop/culprits
    python3 patch_0920q.py

Goes on top of c439180.

1. The Stuck? box now sits above the View box with a gap between them, rather
   than under it.

2. Trase's three wood pulp concession rows sit under one heading of their own,
   "Wood pulp concessions, Indonesia (Trase)", and their titles are just the
   periods: 2015-2019, 2020-2022, 2023-2024.

3. Rows that draw nearly the same thing now say how they differ, in the title
   rather than in a note nobody opens:

   - "Trees cut, tropics only - seen by radar and optical satellites, last 30
     days (GLAD-L, GLAD-S2, RADD)"
   - "Any loss of plant cover, worldwide - cutting, fire, drought or harvest
     alike, last 30 days (DIST-ALERT)", and the same gathered over a year
   - Nusantara's three: trees cut as seen by optical satellite (GLAD), seen
     through cloud by radar (RADD), and every system at once - each saying it
     is Indonesia and Malaysia, as Nusantara reads it

   The difference between them is real and matters: the tropical alerts only
   see the tropics and only report trees being cut; DIST-ALERT covers the whole
   world and reports any loss of plant cover, a harvested field included.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 06bbdcb..520083e 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3575,9 +3575,9 @@ async function addCarbonMapperLayer(cfg) {
 // named here keeps the title the server gives it rather than being guessed at,
 // which is why a handful are still their own ids.
 const NUSANTARA_NAMES = {
-  "AlertDFCOMBINERGB": "Deforestation alerts, every system combined",
-  "AlertGLADRGB": "GLAD deforestation alerts",
-  "AlertRADDRGB": "RADD radar deforestation alerts",
+  "AlertDFCOMBINERGB": "Trees cut, Indonesia and Malaysia \u2014 every alert system at once, as Nusantara reads them",
+  "AlertGLADRGB": "Trees cut, seen by optical satellite (GLAD), as Nusantara reads it",
+  "AlertRADDRGB": "Trees cut, seen through cloud by radar (RADD), as Nusantara reads it",
   "BALI_19650531": "Bali from the air, 31 May 1965",
   "BALI_19650531_Composite1": "Bali from the air, 31 May 1965 (composite)",
   "ECJRCV2": "Forest cover (EC JRC v2)",
@@ -3707,7 +3707,7 @@ const NUSANTARA_NAMES = {
   "spatialplanrtrwn_spv": "National spatial plan (RTRWN)",
   "spatialplanrtrwp_papua_spv": "Provincial spatial plan, Papua (RTRWP)",
   "spatialplanrtrwp_papuawest_spv": "Provincial spatial plan, West Papua (RTRWP)",
-  "v3p2_AlertDFCOMBINERGB": "Deforestation alerts, every system combined (v3p2 copy)",
+  "v3p2_AlertDFCOMBINERGB": "Trees cut, Indonesia and Malaysia \u2014 every alert system at once (v3p2 copy)",
   "v3p2_GLADRGB": "GLAD deforestation alerts (v3p2 copy)",
   "v3p2_RADDRGB": "RADD radar deforestation alerts (v3p2 copy)",
   "v3p2_alertfire_combine": "Fire alerts, MODIS and VIIRS together (v3p2 copy)",
@@ -5385,8 +5385,10 @@ function moveZoomButtons() {
   // rather than floating over it, it covers nothing either.
   const wrap = document.getElementById("reload-wrap");
   const under = document.querySelector(".right-col");
-  if (under && wrap && under.appendChild && wrap.parentNode !== under) {
-    under.appendChild(wrap);
+  if (under && wrap && under.insertBefore && wrap.parentNode !== under) {
+    // Above the View box rather than under it, with a gap, so the two read as
+    // two boxes and neither sits over the other.
+    under.insertBefore(wrap, under.firstChild);
     if (wrap.classList) wrap.classList.remove("reload-early");
   }
   // The compass goes under the 3D terrain tick box, beside the notes on how
@@ -7588,7 +7590,7 @@ const FOREST_ALERTS = {
   group: true,
   ready: true,
   children: [
-    { id:"gfw",                  name:"Deforestation alerts in the tropics \u2014 GLAD-L, GLAD-S2 and RADD, last 30 days", unit:"alerts", colour:"#8A4F46", route:"tile", ready:true, off: true, lazy:true,
+    { id:"gfw",                  name:"Trees cut, tropics only \u2014 seen by radar and optical satellites, last 30 days (GLAD-L, GLAD-S2, RADD)", unit:"alerts", colour:"#8A4F46", route:"tile", ready:true, off: true, lazy:true,
       bounds: [-180, -30, 180, 30],
       // Cut at 30° to the pixel, not just to the tile. See clipTileRows.
       clipToBounds: true,
@@ -7599,13 +7601,13 @@ const FOREST_ALERTS = {
       recolor: "#8A4F46",
       note: "Pan-tropical only. GLAD and RADD do not cover boreal or temperate forest — use the global layers for those.",
       attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
-    { id:"gfw_dist",             name:"Vegetation disturbance worldwide \u2014 DIST-ALERT (UMD and NASA), last 30 days", unit:"alerts", colour:"#7A5B4E", route:"tile", ready:true, off: true, lazy:true,
+    { id:"gfw_dist",             name:"Any loss of plant cover, worldwide \u2014 cutting, fire, drought or harvest alike, last 30 days (DIST-ALERT)", unit:"alerts", colour:"#7A5B4E", route:"tile", ready:true, off: true, lazy:true,
       bounds: [-180, -30, 180, 30],
       tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=30", off: true,
       recolor: "#7A5B4E",
       note: "Global coverage, including boreal and temperate forest. Detects vegetation disturbance generally, so it catches fire and harvest as well as clearing.",
       attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
-    { id:"gfw_dist_year",        name:"Vegetation disturbance worldwide \u2014 DIST-ALERT, past year", unit:"alerts", colour:"#6E5E57", route:"tile", ready:true, off: true, lazy:true,
+    { id:"gfw_dist_year",        name:"Any loss of plant cover, worldwide \u2014 the same, gathered over a year (DIST-ALERT)", unit:"alerts", colour:"#6E5E57", route:"tile", ready:true, off: true, lazy:true,
       bounds: [-180, -30, 180, 30],
       tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=365", off: true,
       recolor: "#6E5E57",
@@ -7649,17 +7651,17 @@ const TRASE_DATA = {
         file: "id_wood_mills_facilities_v2026_02_10.geo.json",
         attribution: "Trase (CC BY 4.0)",
         note: "Trase's Indonesian wood pulp mills. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
-      { id: "trase_pulp_concessions_2015", name: "Wood pulp concessions 2015\u20132019, Indonesia (Trase)", unit: "concessions", colour: "#6F7560", route: "trasefac", ready: true, lazy: true,
+      { id: "trase_pulp_concessions_2015", name: "2015\u20132019", unit: "concessions", colour: "#6F7560", route: "trasefac", ready: true, lazy: true,
         manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-concessions-2015-2019",
         file: "indonesia_wood_pulp_concessions_2015_2019_v2026_02_20.geo.json",
         attribution: "Trase (CC BY 4.0)",
         note: "The areas Trase records as wood pulp concessions over 2015\u20132019, drawn as areas. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
-      { id: "trase_pulp_concessions_2020", name: "Wood pulp concessions 2020\u20132022, Indonesia (Trase)", unit: "concessions", colour: "#5E6A63", route: "trasefac", ready: true, lazy: true,
+      { id: "trase_pulp_concessions_2020", name: "2020\u20132022", unit: "concessions", colour: "#5E6A63", route: "trasefac", ready: true, lazy: true,
         manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-concessions-2020-2022",
         file: "indonesia_wood_pulp_concessions_2020_2022_v2026_02_20.geo.json",
         attribution: "Trase (CC BY 4.0)",
         note: "The areas Trase records as wood pulp concessions over 2020\u20132022, drawn as areas. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
-      { id: "trase_pulp_concessions_2023", name: "Wood pulp concessions 2023\u20132024, Indonesia (Trase)", unit: "concessions", colour: "#59665C", route: "trasefac", ready: true, lazy: true,
+      { id: "trase_pulp_concessions_2023", name: "2023\u20132024", unit: "concessions", colour: "#59665C", route: "trasefac", ready: true, lazy: true,
         manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-concessions-2023-2024",
         file: "indonesia_wood_pulp_concessions_2023_2024_v2026_02_20.geo.json",
         attribution: "Trase (CC BY 4.0)",
@@ -8572,7 +8574,9 @@ const PANEL_ORDER = [
   { h: 3, t: "Fire" },
   { h: 3, t: "Forest and land cover" },
   { h: 3, t: "Deforestation" }, "soilgrids", "trase_measures", "trase_pulp_indonesia",
-    "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023", "nusantara",
+    "nusantara",
+  { h: 4, t: "Wood pulp concessions, Indonesia (Trase)" },
+    "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023",
   { h: 4, t: "Global Forest Watch" }, "glad_loss", "group:forest_alerts", "gfw_catalogue",
   { h: 3, t: "Biodiversity loss" }, "gsn", "gsn_rankings", "allen_coral", "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report",
   { h: 3, t: "Land held under permit" },
diff --git a/map/test.mjs b/map/test.mjs
index 8d5419f..7855c51 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1741,7 +1741,7 @@ console.log("\ncolumns close in, a reload button, mines");
   const html2 = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
   check("a reload button is in the page from the start, with its own handler and its words beside it",
         /id="reload-map"[\s\S]{0,200}onclick="[^"]*location\.reload\(\)"/.test(html2) && /class="reload-cap">Stuck\? Reload here, or press \u2318R \(Ctrl-R\)</.test(html2));
-  check("…and moves under the view choices once they exist", /under\.appendChild\(wrap\)/.test(src));
+  check("…and moves into the right column, above the View box", /under\.insertBefore\(wrap, under\.firstChild\)/.test(src));
   check("…keeping the view as the map moves", /window\.__culpritsView = /.test(src));
   check("…and comes back to the same view", /sessionStorage\.getItem\("culprits-view"\)/.test(src));
   check("mines worldwide is a row, drawn from the tiles repo", /id: "mines_global"[^\n]*route: "pmshapes"/.test(src) &&
@@ -2235,9 +2235,9 @@ console.log("\nrows gathered, moved and renamed");
          ["trase_cocoa_ivory", String.raw`Cocoa cooperatives, C\u00f4te d'Ivoire (Trase)`],
          ["trase_palm_indonesia", String.raw`Palm oil mills, Indonesia (Trase)`],
          ["trase_pulp_indonesia", String.raw`Wood pulp mills, Indonesia (Trase)`],
-         ["trase_pulp_concessions_2015", String.raw`Wood pulp concessions 2015\u20132019, Indonesia (Trase)`],
-         ["trase_pulp_concessions_2020", String.raw`Wood pulp concessions 2020\u20132022, Indonesia (Trase)`],
-         ["trase_pulp_concessions_2023", String.raw`Wood pulp concessions 2023\u20132024, Indonesia (Trase)`]]
+         ["trase_pulp_concessions_2015", String.raw`2015\u20132019`],
+         ["trase_pulp_concessions_2020", String.raw`2020\u20132022`],
+         ["trase_pulp_concessions_2023", String.raw`2023\u20132024`]]
           .every(([i, n]) => src.includes(`id: "${i}", name: "${n}"`)) &&
         !/name: "Trase: /.test(src) && !/trasefacmenu/.test(src));
   check("each Trase row sits under the map's own heading, not a Trase one",
@@ -2493,8 +2493,8 @@ console.log("\nthe reload row is not clipped, and covers nothing");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
-  check("it moves into the right column, not inside the box that scrolls",
-        /const under = document\.querySelector\("\.right-col"\);/.test(src) && /under\.appendChild\(wrap\)/.test(src));
+  check("it moves into the right column, above the View box",
+        /const under = document\.querySelector\("\.right-col"\);/.test(src) && /under\.insertBefore\(wrap, under\.firstChild\)/.test(src));
   check("it keeps its height while the settings box scrolls in what is left",
         /\.right-col > \.reload-wrap\{flex:0 0 auto;[^}]*overflow:visible\}/.test(index) &&
         /\.right-col > #basemaps\{flex:0 1 auto;min-height:0\}/.test(index));
@@ -2629,6 +2629,27 @@ console.log("\nthe Global Forest Watch catalogue, as rows");
         /catalogueRows\(cfg, rows\);/.test(body) && /CATALOGUE_ITEMS\.set\(r\.key, r\)/.test(body));
 }
 
+console.log("\nrows that show nearly the same thing say how they differ");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("the tropical alerts say they are trees cut, and only the tropics",
+        /name:"Trees cut, tropics only \\u2014 seen by radar and optical satellites, last 30 days \(GLAD-L, GLAD-S2, RADD\)"/.test(src));
+  check("DIST-ALERT says it is any loss of plant cover, worldwide",
+        /name:"Any loss of plant cover, worldwide \\u2014 cutting, fire, drought or harvest alike, last 30 days \(DIST-ALERT\)"/.test(src) &&
+        /name:"Any loss of plant cover, worldwide \\u2014 the same, gathered over a year \(DIST-ALERT\)"/.test(src));
+  check("Nusantara's alert layers say which satellite saw it, and where",
+        /"Trees cut, seen by optical satellite \(GLAD\), as Nusantara reads it"/.test(src) &&
+        /"Trees cut, seen through cloud by radar \(RADD\), as Nusantara reads it"/.test(src) &&
+        /"Trees cut, Indonesia and Malaysia \\u2014 every alert system at once, as Nusantara reads them"/.test(src));
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED"));
+  const order = new Function(body + "; return PANEL_ORDER;")();
+  const at = (t) => order.findIndex((x) => x && x.t === t);
+  check("the three pulp-concession periods sit under one heading of their own",
+        at("Wood pulp concessions, Indonesia (Trase)") > -1 &&
+        ["trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023"]
+          .every((i) => order.indexOf(i) > at("Wood pulp concessions, Indonesia (Trase)")));
+}
+
 console.log("\nGlobal Safety Net fixes; My Maps titles");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
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
    if "const drawn = new Map();" not in app:
        sys.exit("patch_0920p.py has to be applied and committed first.")
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
