#!/usr/bin/env python3
"""
The slick archive reads per-month archives; the wire and tracker rows come off
the map.

Run from the repo root:  python3 patch_1005.py

Needs patch_1004.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js                     The oil slick archive reads
                                 cerulean_archive/tiles.json: a month that has
                                 been tiled draws through a vector source
                                 (shapes from zoom 7, a point per slick below),
                                 and a month that has not still reads its plain
                                 file. A busy month is 58 MB of GeoJSON, which
                                 is what "could not be read" was.
                                 The Live Projects to Resist news wire and its
                                 country tracker lists are removed as rows; its
                                 country guides stay under Construction.
  pipeline/shapes/registry.json  love_trackers marked retired, so the daily job
                                 stops rebuilding it.
  map/test.mjs                   Checks for all of it.
  HANDOFF.md                     Why the archive is tiled, and what came off.

Two things go with this, in culprits-tiles-more:
  * upload the new scripts/cerulean_archive.py and run the refresh workflow
    with cerulean_archive in the box - the first run tiles every month it
    holds, so give it time;
  * re-upload scripts/retire.py (it now names love_trackers) and run it.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 43eed9e..55987d0 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -120,6 +120,19 @@ notices rows being ticked.
 
 ---
 
+## The slick archive reads tiles, not a 58 MB file
+
+A busy month of Cerulean slicks is 58 MB of GeoJSON. Fetching it whole took a
+minute when it worked at all, which is what "could not be read" was.
+`scripts/cerulean_archive.py` in culprits-tiles-more now also tiles each month
+it touches into `cerulean_archive/tiles/<month>.pmtiles` (layers `slicks` and
+`slick_points`) and lists them in `cerulean_archive/tiles.json`. The map reads
+that list: a month with an archive draws through a vector source, fetching only
+the squares on screen; a month without one still reads the plain file exactly
+as before, so nothing breaks while the tiling catches up.
+
+---
+
 ## Live Projects to Resist, drawn here rather than opened beside
 
 Its panel row is gone. Three rows under Construction carry what the panel
@@ -129,6 +142,11 @@ by `build_shapes.py`). Its project cards are the same records as
 `local_projects`, so that row stands and nothing is drawn twice, and its Earth
 First! archive is text with no positions, so nothing of it is placed.
 
+Its wire and its country tracker lists were rows here briefly and are not any
+more: the wire belongs in the wires box, and the tracker lists were taken off
+at the owner's request. `love_trackers` is marked retired in the shapes
+registry and its published files are removed by `scripts/retire.py`.
+
 `love_guides` uses the `country_docs` kind, which reads the ISO3 index inside
 the map's own page (`LKA:{file:'srilanka.md',pdf:'...'}`) rather than GitHub's
 tree API: unauthenticated tree calls are refused after sixty an hour on a
diff --git a/map/app.js b/map/app.js
index 0588107..f9ced40 100644
--- a/map/app.js
+++ b/map/app.js
@@ -4369,6 +4369,12 @@ async function addSlickArchive(cfg) {
   try { index = await getJson(`${cfg.base}/index.json`, 30000); }
   catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
   const months = Object.keys(index).sort().reverse();
+  // A month as an archive where the daily job has tiled it, and as the plain
+  // file where it has not. A busy month is 58 MB of GeoJSON, which is a minute
+  // of waiting and often a failure - "could not be read" was that. From an
+  // archive the map fetches only the squares on screen.
+  let tiled = {};
+  try { tiled = await getJson(`${cfg.base}/tiles.json`, 30000); } catch (e) { /* none tiled yet */ }
   const src = `${cfg.id}-src`;
   map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
   map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: src, paint: { "fill-color": "#1D1B17", "fill-opacity": 0.55 } });
@@ -4389,12 +4395,42 @@ async function addSlickArchive(cfg) {
     const x = pts.reduce((a, p) => a + p[0], 0) / pts.length, y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
     return { type: "Feature", properties: f.properties || {}, geometry: { type: "Point", coordinates: [x, y] } };
   }).filter(Boolean) });
+  // The tiled form draws through its own pair of layers, so the plain-file
+  // pair can stay exactly as it was; only one pair is ever shown.
+  const tsrc = `${cfg.id}-pm`;
+  let tiledNow = null;
+  const showTiled = (m) => {
+    const url = `${cfg.base}/${tiled[m]}`;
+    if (tiledNow !== url) {
+      ["-tfill", "-tline", "-tpt"].forEach((suffix) => { if (map.getLayer(cfg.id + suffix)) map.removeLayer(cfg.id + suffix); });
+      if (map.getSource(tsrc)) map.removeSource(tsrc);
+      map.addSource(tsrc, { type: "vector", url: `pmtiles://${url}` });
+      map.addLayer({ id: `${cfg.id}-tfill`, type: "fill", source: tsrc, "source-layer": "slicks", minzoom: 7,
+        paint: { "fill-color": "#1D1B17", "fill-opacity": 0.55 } });
+      map.addLayer({ id: `${cfg.id}-tline`, type: "line", source: tsrc, "source-layer": "slicks", minzoom: 7,
+        paint: { "line-color": "#B8A79E", "line-width": 1 } });
+      map.addLayer({ id: `${cfg.id}-tpt`, type: "circle", source: tsrc, "source-layer": "slick_points", maxzoom: 7,
+        paint: { "circle-color": "#B8A79E", "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.2, 6, 3.6],
+                 "circle-stroke-color": "#1D1B17", "circle-stroke-width": 0.5, "circle-opacity": 0.9 } });
+      bindHtmlPopup(`${cfg.id}-tfill`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily</div>`);
+      bindHtmlPopup(`${cfg.id}-tpt`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily \u00b7 zoom in for its shape</div>`);
+      tiledNow = url;
+    }
+    map.getSource(src).setData({ type: "FeatureCollection", features: [] });
+    map.getSource(`${src}-pt`).setData({ type: "FeatureCollection", features: [] });
+    applyVisibility(cfg.id);
+    setLayerState(cfg.id, `${Number(index[m]).toLocaleString()} slicks in ${m} \u00b7 ${months.length} months kept`);
+  };
   const show = async (m) => {
+    if (tiled[m]) { showTiled(m); return; }
     setLayerState(cfg.id, `reading ${m}\u2026`);
     try {
       const gj = await getJson(`${cfg.base}/${m}.geojson`, 60000);
       map.getSource(src).setData(gj);
       map.getSource(`${src}-pt`).setData(middles(gj));
+      ["-tfill", "-tline", "-tpt"].forEach((suffix) => {
+        if (map.getLayer(cfg.id + suffix)) map.setLayoutProperty(cfg.id + suffix, "visibility", "none");
+      });
       setLayerState(cfg.id, `${Number(index[m]).toLocaleString()} slicks in ${m} \u00b7 ${months.length} months kept`);
     } catch (e) { setLayerState(cfg.id, `${m} could not be read (${e.message})`); }
   };
@@ -6739,16 +6775,10 @@ const OTHER_MAPS = {
     // Live Projects to Resist, drawn on this map rather than opened in a panel
     // beside it. Its project cards are the Development projects row already
     // under Construction, from the same records, so they are not drawn twice;
-    // what the panel added over that row is here as three more rows. Its Earth
-    // First! archive is text sections with no positions, so there is nothing
-    // to place and none is invented.
-    { id: "love_wire", name: "Resistance news placed where it happened (Live Projects to Resist)", unit: "stories", colour: "#6E7B84", route: "geojsonlive", ready: true, lazy: true,
-      files: [{ label: "Live Projects to Resist wire", url: "https://welcometoyourgalaxy.github.io/local-map/wire_geo.json" }],
-      nameFrom: ["title"],
-      note: "The map's own news wire, read live from it. Each story sits where that map matched it, by name rather than by a coordinate in the story, so a box shows what it matched on and how strongly; a weak match can put a story in the wrong country." },
-    { id: "love_trackers", name: "Who to enlist against a project, by country (Live Projects to Resist)", unit: "countries", colour: "#6E7B84", route: "shapes", ready: true, lazy: true,
-      dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/love_trackers.geojson",
-      note: "The map's country lists of firms, funds and bodies to bring in against a project, rebuilt daily from the map itself." },
+    // what it adds over that row is its country guides, below. Its news wire
+    // belongs in the wires box and is read there, not as places on the map,
+    // and its Earth First! archive is text sections with no positions, so
+    // there is nothing of it to place.
     { id: "love_guides", name: "Community resistance how-to guides, by country (Live Projects to Resist)", unit: "countries", colour: "#7B8472", route: "shapes", ready: true, lazy: true,
       dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/love_guides.geojson",
       note: "One guide per country, linked from the country it is written for: the how-to as a PDF, as a page, and to download. Seven of the map's entries have no outline in the boundaries file and are named in the build log rather than dropped quietly." },
@@ -7153,8 +7183,6 @@ const LAYER_KIND = {
   ct_air: ["human", "downstream"],
   ct_pop: ["human", "downstream"],
   gsn: ["plant", "downstream"],
-  love_wire: ["human", "downstream"],
-  love_trackers: ["human", "downstream"],
   love_guides: ["human", "downstream"],
   rte_trade: ["insentient", "upstream"],
   mymaps_supp_a: ["animal", "downstream"],
@@ -7651,7 +7679,7 @@ const PANEL_ORDER = [
   { h: 4, t: "Oil slicks" },
   { h: 5, t: "Marine slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc",
   { h: 5, t: "Terrestrial slicks" }, "skytruth_monitor",
-  { h: 3, t: "Construction" }, "local_projects", "love_wire", "love_trackers", "love_guides",
+  { h: 3, t: "Construction" }, "local_projects", "love_guides",
   { h: 3, t: "Culprits upstream" }, "ejatlas",
   { h: 4, t: "Emissions" }, "carbon_majors", "soy_organizations", "bocc",
   { h: 4, t: "Deforestation" }, "site_forest500_soy", "site_soybean_companies", "dff",
diff --git a/map/test.mjs b/map/test.mjs
index 894295c..469e80b 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1906,7 +1906,9 @@ console.log("\nSocial Spheres controls; Live Projects to Resist whole; wastewate
   check("the Social Spheres' own kind names are read", lab('const KINDLABEL={assoc:"Association & commission",club:"Club"};').club === "Club");
   check("a person or sector opens through the map's own functions only", /\["openNode", "openPerson", "openSector"\]\.includes\(fn\)/.test(src));
   check("Live Projects to Resist is drawn on this map, not opened beside it",
-        !/id: "live_projects_app"/.test(src) && ["love_wire", "love_trackers", "love_guides"].every((i) => new RegExp(`id: "${i}"`).test(src)));
+        !/id: "live_projects_app"/.test(src) && /id: "love_guides"/.test(src));
+  check("its wire stays in the wires box and its tracker lists are gone from the map",
+        !/id: "love_wire"/.test(src) && !/id: "love_trackers"/.test(src));
   check("its project cards are not drawn a second time", (src.match(/id:\s*"local_projects"/g) || []).length === 1);
   check("the wastewater layers read the GitHub copy", (src.match(/tiles\/wastewater_N_[a-z_]+\.pmtiles/g) || []).length === 5 && !/mazu\.nceas\.ucsb\.edu/.test(src));
 }
@@ -2050,6 +2052,16 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\nthe slick archive reads tiles where they exist");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("the month list of archives is read, and a missing one is not fatal",
+        /getJson\(`\$\{cfg\.base\}\/tiles\.json`/.test(src) && /catch \(e\) \{ \/\* none tiled yet \*\//.test(src));
+  check("a tiled month draws through a vector source, shapes from zoom 7 and points below",
+        /url: `pmtiles:\/\/\$\{url\}`/.test(src) && /"source-layer": "slicks", minzoom: 7/.test(src) && /"source-layer": "slick_points", maxzoom: 7/.test(src));
+  check("a month with no archive still reads its plain file", /if \(tiled\[m\]\) \{ showTiled\(m\); return; \}/.test(src) && /getJson\(`\$\{cfg\.base\}\/\$\{m\}\.geojson`, 60000\)/.test(src));
+}
+
 console.log("\nrows gathered, moved and renamed");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
@@ -2104,7 +2116,7 @@ console.log("\nLive Projects to Resist, drawn here");
   const out = rows([{ name: "a", lat: 12, lng: 34 }, { name: "b", lat: "", lng: "" }, { name: "c", latitude: -1, longitude: 2 }]);
   check("a story with a position becomes a point, keeping its fields", out.length === 2 && out[0].geometry.coordinates[0] === 34 && out[0].properties.name === "a");
   check("a story with no position is left out rather than placed at 0,0", !out.some((f) => f.properties.name === "b"));
-  check("the three rows sit under Construction, after the projects themselves", /\{ h: 3, t: "Construction" \}, "local_projects", "love_wire", "love_trackers", "love_guides"/.test(src));
+  check("the guides sit under Construction, after the projects themselves", /\{ h: 3, t: "Construction" \}, "local_projects", "love_guides"/.test(src));
 }
 
 console.log("\nBuildings");
diff --git a/pipeline/shapes/registry.json b/pipeline/shapes/registry.json
index 45732ab..16072ce 100644
--- a/pipeline/shapes/registry.json
+++ b/pipeline/shapes/registry.json
@@ -274,6 +274,7 @@
   },
   {
    "id": "love_trackers",
+   "retired": true,
    "group": "MORE_MAPS",
    "kind": "tree",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/local-map/main/trackerdata.json",
'''


def git(*args):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if "showTiled" in app:
        print("Already applied - nothing to do.")
        return
    if "FOREST_ALERTS" not in app:
        sys.exit("patch_1004.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
