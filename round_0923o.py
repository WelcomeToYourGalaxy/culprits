#!/usr/bin/env python3
"""
Round of 23 September (14): the Atlas's hotspot-city maps laid on the map where they have been placed.
Built against bee06e3.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 92c3cc4..fb7ce84 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -791,9 +791,13 @@ Kept as the rounds go; move a line out when it is settled.
   `powerbi_report`, now copied under Illegal logging and timber trafficking,
   F-gases and Of animals as well as Biodiversity loss.
 - **Atlas hotspot-city maps** (their item 7): each city's map is a PNG, not a
-  PDF (atlas-for-the-end-of-the-world.com/images/hotspot_cities/<slug>.png),
-  so its town names are pixels, not text; placing them needs reading the
-  names off the picture (OCR) first. Not attempted yet.
+  PDF, so its town names are pixels. culprits-tiles-more
+  `scripts/atlas_city_plates.py` (by hand) reads them with Tesseract, looks
+  each up on Nominatim within 1.5 degrees of the city, and places the picture
+  where at least 4 names agree with a typical error under 3% of its width
+  (`atlas/city_plates.json`, `atlas/city_plates/<slug>.webp`). The map lays a
+  placed city's picture as it does a hotspot's; an unplaced city keeps its old
+  behaviour. How many place depends on how legible the pictures are.
 
 ## Round of 23 September (12): the other chat's list taken over; F-gases; the slick archive
 
diff --git a/map/app.js b/map/app.js
index 1b709f0..78a92a5 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3955,6 +3955,16 @@ function atlasPlatesRead() {
   if (!atlasPlates) atlasPlates = getJson(abs("./atlas/plates.json")).catch(() => ({}));
   return atlasPlates;
 }
+// The hotspot cities' own maps, placed by the town names read off each picture
+// (culprits-tiles-more scripts/atlas_city_plates.py, 23 September). Their
+// images are addressed in full, since they live in the tiles repo.
+const ATLAS_CITY_PLATES = "https://welcometoyourgalaxy.github.io/culprits-tiles-more/atlas/city_plates.json";
+let atlasCityPlates = null;
+function atlasCityPlatesRead() {
+  if (!atlasCityPlates) atlasCityPlates = getJson(ATLAS_CITY_PLATES).catch(() => ({}));
+  return atlasCityPlates;
+}
+const plateUrl = (image) => (/^https?:/.test(image) ? image : abs("./" + image));
 // The box around a geometry, as [[west, south], [east, north]].
 function geometryBounds(g) {
   let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
@@ -4011,7 +4021,7 @@ function atlasDetail(p, fitZoom) {
       if (map.getSource(id)) return;
       const lons = d.corners.map((c) => c[0]), lats = d.corners.map((c) => c[1]);
       if (Math.max(...lons) < b.getWest() || Math.min(...lons) > b.getEast() || Math.max(...lats) < b.getSouth() || Math.min(...lats) > b.getNorth()) return;
-      map.addSource(id, { type: "image", url: abs("./" + d.image), coordinates: d.corners });
+      map.addSource(id, { type: "image", url: plateUrl(d.image), coordinates: d.corners });
       map.addLayer({ id, type: "raster", source: id, minzoom: fitZoom + 1, paint: { "raster-opacity": opacity(), "raster-fade-duration": 0 } });
     });
   };
@@ -4028,10 +4038,10 @@ async function showAtlas(what, bounds, owner) {
   const fade = el.querySelector(".ap-fade");
   fade.hidden = true;
   el.hidden = false;
-  if (!what.plate) return;
-  const p = (await atlasPlatesRead())[what.plate];
+  if (!what.plate && !what.cityPlate) return;
+  const p = what.cityPlate ? (await atlasCityPlatesRead())[what.cityPlate] : (await atlasPlatesRead())[what.plate];
   if (p && p.kept && p.image && Array.isArray(p.corners) && p.corners.length === 4) {
-    map.addSource("atlas-plate", { type: "image", url: abs("./" + p.image), coordinates: p.corners });
+    map.addSource("atlas-plate", { type: "image", url: plateUrl(p.image), coordinates: p.corners });
     map.addLayer({ id: "atlas-plate", type: "raster", source: "atlas-plate", paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 } });
     fade.hidden = false;
     fade.querySelector("input").value = 15;
@@ -4042,12 +4052,14 @@ async function showAtlas(what, bounds, owner) {
     if (typeof map.fitBounds === "function") map.fitBounds(box, { padding: 30, duration: 1400 });
     return;
   }
+  // A city with no placed map keeps the zoom its own click already made.
+  if (what.cityPlate) return;
   if (bounds && typeof map.fitBounds === "function") map.fitBounds(bounds, { padding: 30, duration: 1400 });
 }
 function atlasFrom(btn, bounds, owner) {
   const d = btn.dataset;
   if (d.atlasPlate) showAtlas({ plate: d.atlasPlate, doc: d.atlasDoc }, bounds, owner);
-  else if (d.atlasPage) showAtlas({ page: d.atlasPage }, bounds, owner);
+  else if (d.atlasPage) showAtlas({ page: d.atlasPage, cityPlate: d.atlasCity || null }, bounds, owner);
 }
 
 // The Atlas's cities, placed from the weekly lookup of their names.
@@ -4061,7 +4073,7 @@ async function readAtlasCities(cfg) {
     if (!c) { missing++; continue; }
     items.push({ geometry: { type: "Point", coordinates: c }, key: slug, name, group: "",
       h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(name)}</h4>` +
-        `<p><button type="button" class="atlas-show" data-atlas-auto="1" data-atlas-page="${escapeHtml(cfg.pageBase + slug + ".html")}" ` +
+        `<p><button type="button" class="atlas-show" data-atlas-auto="1" data-atlas-page="${escapeHtml(cfg.pageBase + slug + ".html")}" data-atlas-city="${escapeHtml(slug)}" ` +
         `data-atlas-title="${escapeHtml(name)}">The Atlas's page for this city, on this map</button></p>` +
         `<p style="font-size:11px">Placed from its name through OpenStreetMap; the Atlas gives no coordinates.</p></div>` });
   }
diff --git a/map/test.mjs b/map/test.mjs
index 27a3586..6028333 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3198,7 +3198,7 @@ console.log("\nthe Atlas's own maps, on this map (22 September)");
   check("a hotspot's box no longer sends the reader to another site; it shows the Atlas's map here",
         /data-atlas-auto="1" data-atlas-plate=/.test(src) && !/Open the Atlas's PDF:/.test(src) && !/Open the Atlas's page for this city<\/a>/.test(src));
   check("opening an Atlas place zooms to it and lays its placed plate over the map, as an image at the plate's four corners",
-        /map\.addSource\("atlas-plate", \{ type: "image", url: abs\("\.\/" \+ p\.image\), coordinates: p\.corners \}\)/.test(src) &&
+        /map\.addSource\("atlas-plate", \{ type: "image", url: plateUrl\(p\.image\), coordinates: p\.corners \}\)/.test(src) &&
         /if \(auto\) atlasFrom\(auto, geometryBounds\(hit\.geometry\), hit\.cfg\.id\);/.test(src));
   check("a plate is laid only when it was placed well enough", /p && p\.kept && p\.image/.test(src));
   const gb = new Function(src.slice(src.indexOf("function geometryBounds("), src.indexOf("function atlasPanel(")) + "; return geometryBounds;")();
@@ -3397,5 +3397,13 @@ console.log("\nround of 23 September (13): the crime tracker under every subject
         /"Illegal logging and timber trafficking" \}, "powerbi_report"/.test(src) && /"F-gases" \}, "edgar_fgases", "powerbi_report"/.test(src) &&
         /"Of animals" \}, "final_nail", "powerbi_report"/.test(src));
 }
+console.log("\nround of 23 September (14): the Atlas's city maps laid on the map where placed");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("a hotspot city's box carries its slug, and opening it lays the city's placed map as the hotspots' are",
+        /data-atlas-city="\$\{escapeHtml\(slug\)\}"/.test(src) && /cityPlate: d\.atlasCity \|\| null/.test(src) &&
+        /what\.cityPlate \? \(await atlasCityPlatesRead\(\)\)\[what\.cityPlate\]/.test(src) && /culprits-tiles-more\/atlas\/city_plates\.json/.test(src));
+  check("…a city with no placed map keeps its own zoom", /if \(what\.cityPlate\) return;/.test(src));
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
