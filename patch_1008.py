#!/usr/bin/env python3
"""
Child titles read in the same ink; the refinery row names and credits its
source; the Carbon Mapper row says what it actually holds.

Run from the repo root:  python3 patch_1008.py

Needs patch_1007.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/index.html  A row inside a group no longer has its title dimmed. The
                  indent and the rule down the left already say it sits in a
                  group; the dimming also said it mattered less.
  map/app.js      "Global Oil Refinery Complexes (FracTracker Alliance)", with
                  FracTracker credited on the map itself, which it was not.
                  The Carbon Mapper row is named for the set it draws - the
                  waste-site plumes from our own page - rather than reading as
                  Carbon Mapper's whole catalogue.
  map/test.mjs    Checks for all of it.
  HANDOFF.md      The two sources that need real work: the Global Wastewater
                  Model, whose tile server is gone and whose data is on KNB,
                  and Carbon Mapper, whose API carries the plume shapes and the
                  rest of the catalogue.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 7e8a333..988d2eb 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -83,6 +83,25 @@ Worker: `https://culprits-proxy.welcometoyourgalaxy.workers.dev`
 
 ---
 
+## Two sources that need work, written down so they are not lost
+
+**The Global Wastewater Model (Tuholske et al. 2021).** Its row reads copies in
+culprits-tiles-more built by `scripts/wastewater.py` from
+`mazu.nceas.ucsb.edu/wastewater`, and that server no longer answers, so the
+archives were never built and the row draws nothing. The data itself is alive:
+the paper's final rasters are on the Knowledge Network for Biocomplexity at
+doi:10.5063/F76B09, with the code at OHI-Science/GlobalWasteWater. Rebuilding
+means fetching those GeoTIFFs and tiling them rather than copying someone
+else's picture squares.
+
+**Carbon Mapper.** The row here is the set of waste-site plumes from our own
+page, which is a fraction of what Carbon Mapper publish, and it draws each as a
+point where their own viewer draws the plume's shape. Their public API is the
+way to both: the plume records carry their footprints, so a route that reads it
+would give the shapes and the rest of the catalogue at once.
+
+---
+
 ## A group owns its children
 
 Gathering a group's children by reference from LAYERS was tried and was wrong:
diff --git a/map/app.js b/map/app.js
index b1608f2..af8e8b4 100644
--- a/map/app.js
+++ b/map/app.js
@@ -6390,7 +6390,7 @@ const SITE_MAPS = {
       note: "From the Destruction page's animal sacrifice map." },
     { id: "site_animal_fighting", name: "Animal Fighting Locations Map", unit: "venues", colour: "#84594F", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_animal_fighting.places.geojson",
       note: "From the Destruction page's animal fighting map (maps repo)." },
-    { id: "site_carbon_mapper_waste", name: "Methane plumes from waste sites (Carbon Mapper)", unit: "plume sources", colour: "#6D6A5E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_carbon_mapper_waste.places.geojson",
+    { id: "site_carbon_mapper_waste", name: "Methane plumes from waste sites \u2014 the set on our own page (Carbon Mapper)", unit: "plume sources", colour: "#6D6A5E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_carbon_mapper_waste.places.geojson",
       note: "From the Destruction page's Carbon Mapper waste-sector map: the hotspots written into that map, not Carbon Mapper's live feed." },
     { id: "site_forest500_soy", name: "Forest 500: Worst Soy Financial Institutions (2024)", unit: "financial institutions", colour: "#6B5B4E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_forest500_soy.places.geojson",
       note: "From the Destruction page's Forest 500 map: institutions scoring 2 or less of 94 on soy policy, placed at their headquarters." },
@@ -6860,9 +6860,10 @@ const OTHER_MAPS = {
     { id: "mymaps_trees", name: "Google My Maps map (trees section)", unit: "placemarks", colour: "#5F6E5C", route: "kml", ready: true, lazy: true,
       kml: "https://www.google.com/maps/d/kml?mid=1c-vPoGf79mfQezTgcFoKb-xN4A4&forcekml=1",
       note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." },
-    { id: "fractracker_refineries", name: "Global Oil Refinery Complexes (FracTracker)", unit: "refineries", colour: "#6A5E58", route: "arcgisapp", ready: true, lazy: true,
+    { id: "fractracker_refineries", name: "Global Oil Refinery Complexes (FracTracker Alliance)", unit: "refineries", colour: "#6A5E58", route: "arcgisapp", ready: true, lazy: true,
       item: "8e72a974af4c4fe9ba6875cee03078ee",
-      note: "Read live from FracTracker's ArcGIS map: its own layers, fields and popups." },
+      attribution: '<a href="https://www.fractracker.org" target="_blank" rel="noopener">FracTracker Alliance</a>',
+      note: "FracTracker Alliance's own Global Oil Refinery Complexes map, read live from it: its layers, its fields and its popups, unchanged." },
     { id: "arcgis_ym8xk", name: "ArcGIS map (vinyl chloride section)", unit: "places", colour: "#5E6070", route: "arcgisapp", ready: true, lazy: true,
       item: "b1b5b5e0d08c4024a50caa88e6442281",
       note: "Read live from the ArcGIS map linked on the Destruction page (arcg.is/ym8XK); the row takes its own title once it loads." },
diff --git a/map/index.html b/map/index.html
index fe1a86b..ac8ee0a 100644
--- a/map/index.html
+++ b/map/index.html
@@ -200,7 +200,10 @@
   .kids{border-left:1px solid var(--rule);margin:1px 0 3px 9px}
   .kids[hidden]{display:none}
   .layer.child{padding-left:13px}
-  .layer.child .nm{color:var(--dim)}
+  /* A child row's title is a layer's title like any other, so it reads in the
+     same ink. The indent and the rule down the left already say it sits inside
+     a group; dimming it as well said, wrongly, that it mattered less. */
+  .layer.child .nm{color:inherit}
 
   /* Guerillamap opens like every other outside page: a panel along the bottom,
      over the map, with a strip and bar to drag it taller or shorter. */
diff --git a/map/test.mjs b/map/test.mjs
index e66714d..4a8ffb7 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2056,6 +2056,18 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\ntitles in one ink, sources named");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
+  check("a child row's title reads in the same ink as any other", /\.layer\.child \.nm\{color:inherit\}/.test(index));
+  check("the refinery row names who made the map and credits them on it",
+        /name: "Global Oil Refinery Complexes \(FracTracker Alliance\)"/.test(src) &&
+        /id: "fractracker_refineries"[\s\S]{0,400}fractracker\.org/.test(src));
+  check("the Carbon Mapper row says it is the set from our own page, not their whole catalogue",
+        /Methane plumes from waste sites \\u2014 the set on our own page \(Carbon Mapper\)/.test(src));
+}
+
 console.log("\nthe hotspot outlines arrive coarser");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
'''


def git(*args):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/index.html", encoding="utf-8") as fh:
        index = fh.read()
    if ".layer.child .nm{color:inherit}" in index:
        print("Already applied - nothing to do.")
        return
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if "coarse: 0.01" not in app:
        sys.exit("patch_1007.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
