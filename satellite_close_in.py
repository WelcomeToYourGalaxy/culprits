#!/usr/bin/env python3
"""Satellite basemap close in: one season of imagery, and a multiply instead of a sheet.

Built against main at 78486f5 ("Drawn relief from Mapterhorn; lighter tint at
world view"). That commit must be in place first. Run from ~/Desktop/culprits.
"""
import subprocess, sys, tempfile, os

PATCH = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 22f1838..cd2a690 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -317,6 +317,35 @@ Cost: three more package downloads per sector per run (agriculture's co2e
 package alone is 1.4 GB), so the per-gas harvest should run as its own job
 with its own ETags rather than inside the existing one. Not written yet.
 
+## The Satellite basemap close in: one season, and a multiply instead of a sheet (23 September)
+
+Two things the owner saw on the Satellite basemap. Zooming in went green,
+brown, green: Esri's World Imagery is a different photograph at different
+zooms, and around zoom 12 it is often a leaf-off or dry-season one. And close
+in the ground looked like plastic: the tint (`sat-relief-colour`) at 0.9
+opacity with land alphas around 0.46 is one flat colour over roughly
+two-fifths of the photograph, which cuts the contrast inside every tree crown,
+rock face and river by that much; the shading over it comes from heights that
+end at zoom 12 and are only enlarged past it, so it is smoother than the
+photograph.
+
+Now, on the Satellite basemap only (the atlas is unchanged):
+- Imagery: `base` shows on the atlas only. The Satellite basemap uses two
+  layers, `base-s2` (EOX Sentinel-2 cloudless 2024, source `s2`,
+  https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg,
+  maxzoom 14, layer maxzoom 13.25) and `base-close` (Esri, the `base`
+  source, layer minzoom 12.5, fading in 12.5 to 13.25). `SAT_CLOSE.handover`.
+  EOX's WMTS is free for non-commercial use with the attribution given in the
+  source; commercial use needs their licence.
+- Tint: `colourOpacity` 0.95 to zoom 11, then 0.4 at 14 and 0.3 at 16.
+- Shading: main exaggeration 0.7 at 12, 0.35 at 14, 0.15 at 16.
+- Theme close in: `atlasWashPasses` returns one multiply on Satellite,
+  `SAT_CLOSE.multiply` [0.80, 0.93, 0.80], off to zoom 10, full from 14.
+  Multiply scales each pixel, so texture keeps its contrast.
+Not seen rendered from the sandbox (it cannot reach the tile hosts). If the
+close-in green is too strong or too weak, `SAT_CLOSE.multiply` is the knob;
+if EOX's squares fail, the console names source `s2`.
+
 ## The drawn relief from Mapterhorn; a lighter tint wide out (22 September, night, later)
 
 While zooming the owner saw the tint and shading come and go, the plain
diff --git a/map/app.js b/map/app.js
index 5f25fba..2073abd 100644
--- a/map/app.js
+++ b/map/app.js
@@ -833,7 +833,12 @@ const SAT_RELIEF = {
   // map read as the plain photograph; only steep ground showed the theme.
   // Lighter at the world view, where the green lay too heavy over whole
   // continents; full from zoom 8 in, where it carries the look.
-  colourOpacity: ["interpolate", ["linear"], ["zoom"], 2, 0.5, 5, 0.72, 8, 0.95, 14, 0.9, 16, 0.85],
+  // Thinned close in (23 September): at 0.9 the veil was a flat sheet of one
+  // colour over about two-fifths of the photograph, which is what flattened
+  // every tree, rock and rapid into the plastic look. From zoom 11 the theme's
+  // green comes instead from SAT_CLOSE's multiply (see atlasWashPasses),
+  // which darkens and greens the photograph without covering its texture.
+  colourOpacity: ["interpolate", ["linear"], ["zoom"], 2, 0.5, 5, 0.72, 8, 0.95, 11, 0.95, 14, 0.4, 16, 0.3],
   // Light from four directions, weighted to the north-west (Swiss style):
   // green-black shadows, faint warm sunlight on the lit faces.
   shade: {
@@ -843,7 +848,10 @@ const SAT_RELIEF = {
     "hillshade-highlight-color": ["rgba(252,244,220,0.08)", "rgba(252,244,220,0.14)", "rgba(252,244,220,0.06)", "rgba(252,244,220,0)"],
     "hillshade-shadow-color": ["rgba(8,14,10,0.5)", "rgba(8,14,10,0.8)", "rgba(8,14,10,0.5)", "rgba(8,14,10,0.25)"],
     "hillshade-accent-color": "rgba(11,19,13,0.6)",
-    "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 2, 1, 8, 0.9, 12, 0.7, 15, 0.55],
+    // Eased past zoom 12, where Mapterhorn's heights end and are only
+    // enlarged: shading drawn from them is smoother than the photograph and
+    // rounds its slopes into a sheet. The photograph's own shadows take over.
+    "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 2, 1, 8, 0.9, 12, 0.7, 14, 0.35, 16, 0.15],
     "hillshade-illumination-anchor": "map",
   },
   // A second, low north-west light for depth wide out; gone by zoom 11, where
@@ -862,6 +870,23 @@ const SAT_RELIEF = {
   lift: [[3, 7], [6, 4], [9, 2.4], [12, 1.4]],
 };
 
+// The Satellite basemap close in (23 September). What gives a landscape its
+// character up close (single tree crowns, rock with its own shadow, white
+// water in a river) is in the photograph, so nothing is laid over it as a
+// sheet. The theme's deep green comes from a multiply instead: every pixel is
+// scaled, so light and dark within a tree crown keep their ratio and the
+// texture stays. Off to zoom 10, full from 14, as the tint above thins.
+const SAT_CLOSE = {
+  multiply: [0.80, 0.93, 0.80],
+  from: 10, to: 14,
+  // Two photographs, so one season all the way in. Esri's World Imagery is a
+  // different photograph at different zooms; around zoom 12 it is often a
+  // leaf-off or dry-season one, so zooming in went green, brown, green. Out to
+  // zoom 12.5 the Satellite basemap shows EOX's Sentinel-2 cloudless 2024
+  // mosaic (one year, cloud-free, the same everywhere); Esri's sharper photo
+  // fades in between 12.5 and 13.25.
+  handover: [12.5, 13.25],
+};
 
 // The colour washes, as one WebGL layer drawn over the imagery.
 //
@@ -902,8 +927,12 @@ function hexRgb(h) {
 // arithmetic can be tested without a GPU.
 // The Satellite basemap takes none of the atlas's sea, green and warm washes:
 // its colour comes from the relief (SAT_RELIEF), which the washes would tint.
+// Close in it takes one multiply of its own (SAT_CLOSE).
 function atlasWashPasses(z) {
-  if (BASEMAP === "satellite") return [];
+  if (BASEMAP === "satellite") {
+    const k = Math.min(1, Math.max(0, (z - SAT_CLOSE.from) / (SAT_CLOSE.to - SAT_CLOSE.from)));
+    return k > 0 ? [{ mode: "multiply", rgb: SAT_CLOSE.multiply.map((c) => 1 - k * (1 - c)) }] : [];
+  }
   const { t, sea } = atlasWashRamp(z);
   const passes = [];
   const aSea = ATLAS_TUNE.sea * sea;
@@ -1081,6 +1110,14 @@ const map = new maplibregl.Map({
         tileSize: 256, maxzoom: 18,
         attribution: "Imagery © Esri, Maxar",
       },
+      // The Satellite basemap's wide views (SAT_CLOSE.handover). Free for
+      // non-commercial use with this attribution (CC BY-NC-SA 4.0).
+      s2: {
+        type: "raster",
+        tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg"],
+        tileSize: 256, maxzoom: 14,
+        attribution: '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless - https://s2maps.eu</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)',
+      },
       // Relief is what makes imagery read as terrain rather than as a
       // photograph. In the Leaflet map it multiplies; here it can only sit on
       // top at low opacity, which is weaker but the same idea.
@@ -1109,6 +1146,15 @@ const map = new maplibregl.Map({
       // basemap; setBasemap() swaps it for the satellite grading.
       { id: "base", type: "raster", source: "base",
         paint: { "raster-opacity": 1, ...BASE_GRADE.atlas } },
+      // The Satellite basemap's imagery: Sentinel-2 out to 13.25, Esri's photo
+      // from 12.5, fading in over it. Separate layers so neither asks for
+      // squares at zooms where it is not drawn.
+      { id: "base-s2", type: "raster", source: "s2", maxzoom: SAT_CLOSE.handover[1],
+        layout: { visibility: "none" }, paint: { ...BASE_GRADE.satellite } },
+      { id: "base-close", type: "raster", source: "base", minzoom: SAT_CLOSE.handover[0],
+        layout: { visibility: "none" },
+        paint: { ...BASE_GRADE.satellite, "raster-opacity":
+          ["interpolate", ["linear"], ["zoom"], SAT_CLOSE.handover[0], 0, SAT_CLOSE.handover[1], 1] } },
       // Relief eases IN as you zoom, the way the Leaflet ramp does it: wide out
       // it muddies the picture, at valley scale it is what you want more of.
       { id: "hillshade", type: "raster", source: "hillshade",
@@ -1946,7 +1992,9 @@ function setBasemap(kind) {
   };
   const imagery = kind !== "outlines";
   if (!imagery) addOutlineLayers();
-  show("base", imagery);
+  show("base", kind === "atlas");
+  show("base-s2", kind === "satellite");
+  show("base-close", kind === "satellite");
   // Esri's relief tiles on the atlas only; the Satellite basemap has its own.
   show("hillshade", kind === "atlas" && !TERRAIN_ON);
   show("atlas-plate", kind === "atlas");
@@ -1959,8 +2007,11 @@ function setBasemap(kind) {
   show("outline-land", !imagery);
   OUTLINE_IDS.forEach((id) => show(id, !imagery));
   show("outline-line", !imagery);
-  if (imagery && map.getLayer("base")) {
-    for (const [k, v] of Object.entries(BASE_GRADE[kind])) map.setPaintProperty("base", k, v);
+  if (imagery) {
+    for (const id of kind === "satellite" ? ["base-s2", "base-close"] : ["base"]) {
+      if (!map.getLayer(id)) continue;
+      for (const [k, v] of Object.entries(BASE_GRADE[kind])) map.setPaintProperty(id, k, v);
+    }
   }
   // The plate carries its own drawn place names, so map labels wait until it
   // has faded, as they do on the Leaflet atlas.
@@ -9448,7 +9499,7 @@ function updateZoomState() {
 const badTiles = new Set();
 map.on("error", (e) => {
   const src = e && e.sourceId;
-  if (src && ["base", "hillshade", "labels", "atlas-plate"].includes(src) && !badTiles.has(src)) {
+  if (src && ["base", "s2", "hillshade", "labels", "atlas-plate"].includes(src) && !badTiles.has(src)) {
     badTiles.add(src);
     console.warn(`[culprits] basemap source "${src}" is failing to load tiles ` +
                  `— the map still works, but it will look wrong.`);
diff --git a/map/test.mjs b/map/test.mjs
index 0eaeac4..6cfec19 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1335,6 +1335,34 @@ console.log("\nthe wires on the map");
 }
 
 
+// The Satellite basemap close in (23 September): a multiply, not a sheet, and
+// one season of imagery all the way in.
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const chunk = src.slice(src.indexOf("const ATLAS_TUNE"), src.indexOf("const atlasWashes"));
+  const f = new Function("abs", chunk + "\nreturn { SAT_CLOSE, atlasWashPasses, setB: (k) => { BASEMAP = k; } };")(() => "");
+  f.setB("satellite");
+  const at = (z) => f.atlasWashPasses(z);
+  check("Satellite close in: no wash out to zoom 10, one multiply from there, full at 14",
+        at(4).length === 0 && at(10).length === 0 && at(12).length === 1 && at(12)[0].mode === "multiply" &&
+        JSON.stringify(at(14)[0].rgb) === JSON.stringify(f.SAT_CLOSE.multiply) &&
+        JSON.stringify(at(18)[0].rgb) === JSON.stringify(f.SAT_CLOSE.multiply));
+  check("…the multiply only darkens, never past 0.75 on any channel, and greens (green kept most)",
+        [11, 12, 13, 14, 17].every((z) => at(z)[0].rgb.every((c) => c <= 1 && c >= 0.75)) &&
+        f.SAT_CLOSE.multiply[1] > f.SAT_CLOSE.multiply[0] && f.SAT_CLOSE.multiply[1] > f.SAT_CLOSE.multiply[2]);
+  check("…Sentinel-2 cloudless 2024 out to 13.25, Esri's photo fading in from 12.5, the atlas keeps its own imagery layer",
+        /tiles: \["https:\/\/tiles\.maps\.eox\.at\/wmts\/1\.0\.0\/s2cloudless-2024_3857\/default\/g\/\{z\}\/\{y\}\/\{x\}\.jpg"\]/.test(src) &&
+        /Contains modified Copernicus Sentinel data 2024/.test(src) &&
+        /id: "base-s2", type: "raster", source: "s2", maxzoom: SAT_CLOSE\.handover\[1\]/.test(src) &&
+        /id: "base-close", type: "raster", source: "base", minzoom: SAT_CLOSE\.handover\[0\]/.test(src) &&
+        JSON.stringify(f.SAT_CLOSE.handover) === "[12.5,13.25]" &&
+        /show\("base", kind === "atlas"\);/.test(src) && /show\("base-s2", kind === "satellite"\);/.test(src) &&
+        /show\("base-close", kind === "satellite"\);/.test(src) &&
+        /\["base", "s2", "hillshade", "labels", "atlas-plate"\]\.includes\(src\)/.test(src));
+  f.setB("atlas");
+  check("…and the painted atlas's washes are unchanged by it", at(12).length === 4);
+}
+
 console.log("\nreading the map");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
@@ -1357,9 +1385,9 @@ console.log("\nreading the map");
           alphas.length >= 10 && alphas.every((m) => Math.max(+m[1], +m[2], +m[3]) <= 130) &&
           alphas.filter((m, i) => i >= 5).every((m) => +m[4] <= 0.5));
     // Fourth version: the owner wants the tint and shading kept close in, without the sheen.
-    check("…the tint and shading stay nearly full at every zoom; the depth light is gone by 11; faint warm lights only; fog only at the horizon",
-        /colourOpacity: \["interpolate", \["linear"\], \["zoom"\], 2, 0\.5, 5, 0\.72, 8, 0\.95, 14, 0\.9, 16, 0\.85\]/.test(src) &&
-        /"hillshade-exaggeration": \["interpolate", \["linear"\], \["zoom"\], 2, 1, 8, 0\.9, 12, 0\.7, 15, 0\.55\]/.test(src) &&
+    check("…the tint is full from 8 to 11 and thins close in; the shading eases past zoom 12; the depth light is gone by 11; faint warm lights only; fog only at the horizon",
+        /colourOpacity: \["interpolate", \["linear"\], \["zoom"\], 2, 0\.5, 5, 0\.72, 8, 0\.95, 11, 0\.95, 14, 0\.4, 16, 0\.3\]/.test(src) &&
+        /"hillshade-exaggeration": \["interpolate", \["linear"\], \["zoom"\], 2, 1, 8, 0\.9, 12, 0\.7, 14, 0\.35, 16, 0\.15\]/.test(src) &&
         /"hillshade-exaggeration": \["interpolate", \["linear"\], \["zoom"\], 2, 0\.85, 6, 0\.55, 9, 0\.2, 11, 0\]/.test(src) &&
         /"rgba\(252,244,220,0\.14\)"/.test(src) && !/"rgba\(2\d\d,2\d\d,2\d\d,0\.[3-9]/.test(block) &&
         /"fog-ground-blend": 0\.97/.test(src));
'''

def git(*a, **k):
    return subprocess.run(["git", *a], capture_output=True, text=True, **k)

if not os.path.isdir(".git") or not os.path.isfile("map/app.js"):
    sys.exit("Run this from ~/Desktop/culprits.")
with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False) as f:
    f.write(PATCH)
    path = f.name
try:
    if git("apply", "--reverse", "--check", path).returncode == 0:
        sys.exit("Already applied. Nothing to do.")
    if "const SAT_CLOSE" in open("map/app.js").read():
        sys.exit("map/app.js already has SAT_CLOSE but differs from this patch. Not touching it.")
    if "tiles.mapterhorn.com" not in open("map/app.js").read():
        sys.exit("Apply the Mapterhorn relief patch (78486f5) first, then run this again.")
    chk = git("apply", "--check", path)
    if chk.returncode != 0:
        sys.exit("The patch does not fit this copy of the repo. Nothing changed.\n" + chk.stderr)
    res = git("apply", path)
    if res.returncode != 0:
        sys.exit("git apply failed. Nothing should have changed.\n" + res.stderr)
    print("Applied: HANDOFF.md, map/app.js, map/test.mjs")
finally:
    os.unlink(path)
