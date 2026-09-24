#!/usr/bin/env python3
"""
The Atlas for the End of the World's maps laid on this map: a hotspot zooms to
itself and shows the Atlas's own map over this one; a city zooms and shows the
Atlas's page in a panel. Adds pipeline/atlas_plates.py, which places the maps.

Built against main at ee84d99; checked to apply on 02d12cc too. Run from the repo root:  python3 atlas_0922e.py
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/.gitignore b/.gitignore
index b89a272..1b038d3 100644
--- a/.gitignore
+++ b/.gitignore
@@ -5,3 +5,4 @@ __pycache__/
 .DS_Store
 map/tiles/.needs-r2
 
+pipeline/.atlas-cache/
diff --git a/HANDOFF.md b/HANDOFF.md
index 046fcb7..271aca1 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -420,6 +420,36 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## The Atlas for the End of the World's maps, on this map (22 September)
+
+Asked for: opening a hotspot or a city zooms to it and shows the Atlas's own
+map over this one, not a link out to the PDF.
+
+- **`pipeline/atlas_plates.py`** places each hotspot PDF's first page. The
+  towns on the page are text in the file, so each is read with where it sits,
+  looked up on OpenStreetMap (Nominatim, settlements only, cached in
+  `pipeline/.atlas-cache`), and a straight-line placement of the page is
+  found that the most names agree on, trying 4,000 random sets of three so a
+  wrongly matched name cannot drag it (RANSAC); five places on a label are
+  tried as its dot (centre, each edge) and the best-fitting kept. The error -
+  how far the agreeing towns still are from their places - is written with
+  the plate. A plate is kept with at least 5 agreeing towns and an error under
+  3% of its width; otherwise `plates.json` carries the reason. Output:
+  `map/atlas/plates/<slug>.webp` (the page at 2,400 px) and
+  `map/atlas/plates.json` (corners, error, towns used). Tested on a made-up
+  PDF with a country label and a wrong look-up mixed in: both were set aside
+  and the corners came back exact. **Not yet run on the real PDFs**; the owner
+  runs it (about half an hour the first time, for the look-ups).
+- **The map**: a hotspot's or city's box carries a button marked
+  `data-atlas-auto`; opening the box runs it (`atlasFrom`). A hotspot with a
+  kept plate gets an image source `atlas-plate` at the four corners, the view
+  fits it, and a panel (`#atlas-panel`) says how many towns placed it and the
+  error, with a slider between the two maps and the PDF's pages behind a
+  "pages" button. Without a plate the view fits the hotspot's own outline and
+  the panel says why. A city zooms (as before) and its Atlas page opens in the
+  panel: the city maps carry no named places to fit them by, so they are not
+  laid on the map. The page itself is on the plate, key and title included.
+
 ## Round of 22 September (4): same-name rows told apart, plumes unmerged, a source check
 
 - **Four "Tree cover loss by dominant driver" rows and two worldwide protected
diff --git a/map/app.js b/map/app.js
index e818839..9cd6a11 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3691,12 +3691,117 @@ function atlasPdfFor(cfg, name) {
 function linkAtlasPdfs(cfg, items) {
   for (const it of items) {
     const hit = atlasPdfFor(cfg, it.name);
+    // Opening a hotspot zooms to it and lays the Atlas's own map of it over
+    // this one, where it has been placed (pipeline/atlas_plates.py); its pages
+    // open in a panel on the map rather than on another site (22 September).
     it.h = it.h.replace(/<\/div>$/, hit
-      ? `<p><a href="${cfg.pdfBase}${hit[0]}.pdf" target="_blank" rel="noopener">Open the Atlas's PDF: ${escapeHtml(hit[1])}</a></p></div>`
+      ? `<p><button type="button" class="atlas-show" data-atlas-auto="1" data-atlas-plate="${escapeHtml(hit[0])}" ` +
+        `data-atlas-doc="${escapeHtml(cfg.pdfBase + hit[0] + ".pdf")}" data-atlas-title="${escapeHtml(hit[1])}">` +
+        `The Atlas's map of ${escapeHtml(hit[1])}, on this map</button></p></div>`
       : `<p style="font-size:11px">The Atlas has no PDF for this hotspot.</p></div>`);
   }
 }
 
+/* ---------- the Atlas's own maps, laid on this one ---------- */
+// plates.json (built by pipeline/atlas_plates.py) says, for each hotspot PDF,
+// where the corners of its first page fall, fitted to the towns named on it,
+// and how far those towns still are from their places (error_km). A plate that
+// could not be placed well enough carries the reason instead, and its pages are
+// shown without laying it on the map.
+let atlasPlates = null;
+function atlasPlatesRead() {
+  if (!atlasPlates) atlasPlates = getJson(abs("./atlas/plates.json")).catch(() => ({}));
+  return atlasPlates;
+}
+// The box around a geometry, as [[west, south], [east, north]].
+function geometryBounds(g) {
+  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
+  const walk = (c) => {
+    if (typeof c[0] === "number") { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); }
+    else c.forEach(walk);
+  };
+  if (g && g.coordinates) walk(g.coordinates);
+  return isFinite(w) ? [[w, s], [e, n]] : null;
+}
+function atlasPanel() {
+  let el = document.getElementById("atlas-panel");
+  if (el) return el;
+  el = document.createElement("div");
+  el.id = "atlas-panel";
+  el.hidden = true;
+  el.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:min(620px,62vw);max-height:62vh;z-index:45;" +
+    "display:flex;flex-direction:column;background:var(--peat,#17150F);border:1px solid var(--rule,#322E27);border-radius:3px;" +
+    "box-shadow:0 8px 30px rgba(0,0,0,.5);font-size:12.5px;color:var(--dim)";
+  el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px 4px">` +
+      `<b class="ap-title" style="color:var(--bone);font-weight:600"></b><span style="margin-left:auto"></span>` +
+      `<a class="ap-open" target="_blank" rel="noopener" title="Only if the pages stay blank: the Atlas's site may not allow being shown inside another page" ` +
+      `style="color:var(--slate,#8A9DA6);font-size:11.5px">open \u2197</a>` +
+      `<button type="button" class="ap-pages" style="font:inherit;background:none;color:var(--dim);border:1px solid var(--rule);border-radius:2px;padding:1px 7px;cursor:pointer">pages</button>` +
+      `<button type="button" class="ap-close" style="font:inherit;background:none;color:var(--dim);border:1px solid var(--rule);border-radius:2px;padding:1px 7px;cursor:pointer">close</button></div>` +
+    `<div class="ap-said" style="padding:0 10px 4px;font-size:11.5px"></div>` +
+    `<label class="ap-fade" style="display:flex;gap:8px;align-items:center;padding:0 10px 7px;font-size:11.5px">` +
+      `the Atlas's map <input type="range" min="0" max="100" value="85" style="flex:1"> this map</label>` +
+    `<iframe class="ap-frame" title="The Atlas's pages" hidden style="flex:1;min-height:40vh;width:100%;border:0;border-top:1px solid var(--rule)"></iframe>`;
+  document.body.appendChild(el);
+  const frame = el.querySelector(".ap-frame");
+  el.querySelector(".ap-pages").addEventListener("click", () => {
+    frame.hidden = !frame.hidden;
+    if (!frame.hidden && frame.dataset.src && frame.src !== frame.dataset.src) frame.src = frame.dataset.src;
+  });
+  el.querySelector(".ap-close").addEventListener("click", atlasPlateOff);
+  el.querySelector(".ap-fade input").addEventListener("input", (e) => {
+    if (map.getLayer("atlas-plate")) map.setPaintProperty("atlas-plate", "raster-opacity", 1 - Number(e.target.value) / 100 + 0.0);
+  });
+  return el;
+}
+function atlasPlateOff() {
+  if (map.getLayer("atlas-plate")) map.removeLayer("atlas-plate");
+  if (map.getSource("atlas-plate")) map.removeSource("atlas-plate");
+  const el = document.getElementById("atlas-panel");
+  if (el) { el.hidden = true; const f = el.querySelector(".ap-frame"); f.hidden = true; f.removeAttribute("src"); }
+}
+// what: { plate, doc, title } for a hotspot, { page, title } for a city;
+// bounds: the hotspot's own outline, used when there is no placed plate.
+async function showAtlas(what, bounds) {
+  const el = atlasPanel();
+  const frame = el.querySelector(".ap-frame");
+  el.querySelector(".ap-title").textContent = what.title || "Atlas for the End of the World";
+  frame.dataset.src = what.doc || what.page || "";
+  el.querySelector(".ap-open").href = frame.dataset.src;
+  frame.hidden = !what.page;                       // a city's page opens at once; a hotspot's pages on asking
+  if (!frame.hidden) frame.src = frame.dataset.src;
+  const said = el.querySelector(".ap-said"), fade = el.querySelector(".ap-fade");
+  fade.hidden = true;
+  if (map.getLayer("atlas-plate")) map.removeLayer("atlas-plate");
+  if (map.getSource("atlas-plate")) map.removeSource("atlas-plate");
+  el.hidden = false;
+  if (!what.plate) {
+    said.textContent = "The Atlas's own page for this city. Its maps carry no named places to fit them by, so they are shown here rather than laid on the map.";
+    return;
+  }
+  const p = (await atlasPlatesRead())[what.plate];
+  if (p && p.kept && p.image && Array.isArray(p.corners) && p.corners.length === 4) {
+    map.addSource("atlas-plate", { type: "image", url: abs("./" + p.image), coordinates: p.corners });
+    map.addLayer({ id: "atlas-plate", type: "raster", source: "atlas-plate", paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 } });
+    fade.hidden = false;
+    fade.querySelector("input").value = 15;
+    said.textContent = `The first page of the Atlas's PDF, placed by the ${p.names.length} towns named on it: ` +
+      `they sit on average ${p.error_km} km from where OpenStreetMap has them, on a plate ${p.width_km} km across. ` +
+      `The key and title on the page are drawn with it.`;
+    const lons = p.corners.map((c) => c[0]), lats = p.corners.map((c) => c[1]);
+    if (typeof map.fitBounds === "function") map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 30, duration: 1400 });
+    return;
+  }
+  said.textContent = p && p.reason ? `The Atlas's map is not laid on this one: ${p.reason}. Its pages are under pages.`
+    : "The Atlas's map has not been placed yet (pipeline/atlas_plates.py). Its pages are under pages.";
+  if (bounds && typeof map.fitBounds === "function") map.fitBounds(bounds, { padding: 30, duration: 1400 });
+}
+function atlasFrom(btn, bounds) {
+  const d = btn.dataset;
+  if (d.atlasPlate) showAtlas({ plate: d.atlasPlate, doc: d.atlasDoc, title: d.atlasTitle }, bounds);
+  else if (d.atlasPage) showAtlas({ page: d.atlasPage, title: d.atlasTitle }, bounds);
+}
+
 // The Atlas's cities, placed from the weekly lookup of their names.
 async function readAtlasCities(cfg) {
   let at = {};
@@ -3708,7 +3813,8 @@ async function readAtlasCities(cfg) {
     if (!c) { missing++; continue; }
     items.push({ geometry: { type: "Point", coordinates: c }, key: slug, name, group: "",
       h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(name)}</h4>` +
-        `<p><a href="${cfg.pageBase}${slug}.html" target="_blank" rel="noopener">Open the Atlas's page for this city</a></p>` +
+        `<p><button type="button" class="atlas-show" data-atlas-auto="1" data-atlas-page="${escapeHtml(cfg.pageBase + slug + ".html")}" ` +
+        `data-atlas-title="${escapeHtml(name)}">The Atlas's page for this city, on this map</button></p>` +
         `<p style="font-size:11px">Placed from its name through OpenStreetMap; the Atlas gives no coordinates.</p></div>` });
   }
   return { title: cfg.name, items, note: missing ? `${missing} not yet placed` : "" };
@@ -7398,7 +7504,12 @@ async function openSitemapBox(hit, at) {
     el.addEventListener("click", (ev) => {
       const x = ev.target.closest && ev.target.closest(".leaflet-popup-close-button");
       if (x) { ev.preventDefault(); popup.remove(); }
+      const a = ev.target.closest && ev.target.closest(".atlas-show");
+      if (a) { ev.preventDefault(); atlasFrom(a, geometryBounds(hit.geometry)); }
     });
+    // An Atlas hotspot or city shows its own map or page as soon as it is opened.
+    const auto = el.querySelector && el.querySelector("[data-atlas-auto]");
+    if (auto) atlasFrom(auto, geometryBounds(hit.geometry));
   }
 }
 
@@ -8235,11 +8346,11 @@ const OTHER_MAPS = {
       // the survey's own precision and took most of a minute to arrive.
       coarse: 0.01,
       pdfs: [["atlantic_forests", "Atlantic Forest"], ["california_floristic_province", "California Floristic Province"], ["cape_floristic_region", "Cape Floristic Region"], ["caribbean_islands", "Caribbean Islands"], ["caucasus", "Caucasus"], ["cerrado", "Cerrado"], ["chilean_valdivian_forests", "Chilean Winter Rainfall Valdivian Forests"], ["coastal_forests_of_eastern_africa", "Coastal Forests of Eastern Africa"], ["east_melanesian_islands", "East Melanesian Islands"], ["eastern_afromontane", "Eastern Afromontane"], ["forests_of_east_australia", "Forests of Eastern Australia"], ["guinean_forests_of_west_africa", "Guinean Forests of West Africa"], ["himalaya", "Himalaya"], ["horn_of_africa", "Horn of Africa"], ["japan", "Japan"], ["madagascar", "Madagascar & The Indian Ocean Islands"], ["madrean_woodlands", "Madrean Pine-Oak Woodlands"], ["maputaland_pondoland_albany", "Maputaland Pondoland Albany"], ["mediterranean_basin", "Mediterranean Basin"], ["mesoamerica", "Mesoamerica"], ["mountains_of_central_asia", "Mountains of Central Asia"], ["mountains_of_southwest_china", "Mountains of Southwest China"], ["new_caledonia", "New Caledonia"], ["new_zealand", "New Zealand"], ["philippines", "Philippines"], ["north_american_coastal_plain", "North American Coastal Plain"], ["southwest_australia", "Southwest Australia"], ["succulent_karoo", "Succulent Karoo"], ["sundaland", "Sundaland"], ["tropical_andes", "Tropical Andes"], ["wallacea", "Wallacea"], ["western_ghats_sri_lanka", "Western Ghats & Sri Lanka"]],
-      note: "The 36 biodiversity hotspots, outlined live from Conservation International's Biodiversity Hotspots 2016.1 (CC BY 3.0), the boundaries the Atlas maps; each box links the Atlas's own PDF for that hotspot. The outlines are asked for at about a kilometre's precision rather than the survey's own, which is what makes them arrive in seconds; every field comes across unchanged." },
+      note: "The 36 biodiversity hotspots, outlined live from Conservation International's Biodiversity Hotspots 2016.1 (CC BY 3.0), the boundaries the Atlas maps; opening one zooms to it and lays the Atlas's own map of it over this one, where it has been placed by the towns named on it, with its pages in a panel. The outlines are asked for at about a kilometre's precision rather than the survey's own, which is what makes them arrive in seconds; every field comes across unchanged." },
     { id: "atlas_cities", name: "Hotspot Cities (Atlas for the End of the World)", unit: "cities", colour: "#5E6070", route: "atlascities", zoomTo: 9, ready: true, lazy: true,
       pageBase: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/", positions: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/atlas/cities.json",
       cities: [["antananarivo", "Antananarivo, Madagascar"], ["auckland", "Auckland, New Zealand"], ["baku", "Baku, Azerbaijan"], ["bogota", "Bogotá, Colombia"], ["brasilia", "Brasília, Brazil"], ["cape_town", "Cape Town, South Africa"], ["chengdu", "Chengdu, China"], ["colombo", "Colombo, Sri Lanka"], ["dar_es_salaam", "Dar es Salaam, Tanzania"], ["davao", "Davao, Philippines"], ["durban", "Durban, South Africa"], ["esfahan", "Esfahan, Iran"], ["guadalajara", "Guadalajara, Mexico"], ["guayaquil", "Guayaquil, Ecuador"], ["hongknog_shenzhen_quangzhou", "Hongkong-Shenzhen-Guangzhou, China"], ["honolulu", "Honolulu, United States"], ["houston", "Houston, United States"], ["jakarta", "Jakarta, Indonesia"], ["lagos", "Lagos, Nigeria"], ["los_angeles", "Los Angeles, United States"], ["makassar", "Makassar, Indonesia"], ["mecca", "Mecca, Saudi Arabia"], ["mexico_city", "Mexico City, Mexico"], ["nairobi", "Nairobi, Kenya"], ["osaka", "Osaka, Japan"], ["perth", "Perth, Australia"], ["port-au-prince", "Port-au-Prince, Haiti"], ["rawalpindi", "Rawalpindi, Pakistan"], ["santiago", "Santiago, Chile"], ["sao_paulo", "São Paulo, Brazil"], ["sydney", "Sydney, Australia"], ["tashkent", "Tashkent, Uzbekistan"], ["tel_aviv", "Tel Aviv, Israel"]],
-      note: "The Atlas's 33 hotspot cities; each is placed from its name through a weekly OpenStreetMap lookup, and its box links the Atlas's own page." },
+      note: "The Atlas's 33 hotspot cities; each is placed from its name through a weekly OpenStreetMap lookup, and opening one zooms to it and shows the Atlas's own page for it in a panel on the map." },
     { id: "building_types", name: "Buildings", unit: "places", colour: "#6A6258", route: "buildings", ready: true, lazy: true,
       // Their own repo and Pages site: a site is capped at 1 GB and these are
       // about 700 MB. See culprits-buildings.
diff --git a/map/test.mjs b/map/test.mjs
index 7965341..a3fd5b3 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3111,5 +3111,22 @@ console.log("\nround of 22 September (4): rows of the same name told apart");
   check("the check script asks each failing source and each grey picture, and changes nothing",
         fs.existsSync(path.join(HERE, "check-sources.mjs")) && !/writeFile/.test(fs.readFileSync(path.join(HERE, "check-sources.mjs"), "utf8")));
 }
+console.log("\nthe Atlas's own maps, on this map (22 September)");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("a hotspot's box no longer sends the reader to another site; it shows the Atlas's map here",
+        /data-atlas-auto="1" data-atlas-plate=/.test(src) && !/Open the Atlas's PDF:/.test(src) && !/Open the Atlas's page for this city<\/a>/.test(src));
+  check("opening an Atlas place zooms to it and lays its placed plate over the map, as an image at the plate's four corners",
+        /map\.addSource\("atlas-plate", \{ type: "image", url: abs\("\.\/" \+ p\.image\), coordinates: p\.corners \}\)/.test(src) &&
+        /if \(auto\) atlasFrom\(auto, geometryBounds\(hit\.geometry\)\);/.test(src));
+  check("a plate is laid only when it was placed well enough, and says how far off its towns are",
+        /p && p\.kept && p\.image/.test(src) && /\$\{p\.error_km\} km/.test(src));
+  const gb = new Function(src.slice(src.indexOf("function geometryBounds("), src.indexOf("function atlasPanel(")) + "; return geometryBounds;")();
+  const b = gb({ type: "MultiPolygon", coordinates: [[[[-50, -20], [-40, -20], [-40, -10], [-50, -20]]], [[[-60, -25], [-55, -25], [-55, -22], [-60, -25]]]] });
+  check("with no plate, the map zooms to the hotspot's own outline", JSON.stringify(b) === JSON.stringify([[-60, -25], [-40, -10]]));
+  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "atlas_plates.py"), "utf8");
+  check("the plates are placed by the towns named on each page, with outliers set aside and the error measured",
+        /def place_page\(labels, width_pt, height_pt, seed=0\):/.test(py) && /TRIES = 4000/.test(py) && /"error_km": round\(rms, 1\)/.test(py) && /MIN_AGREE = 5/.test(py));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
diff --git a/pipeline/atlas_plates.py b/pipeline/atlas_plates.py
new file mode 100644
index 0000000..633b475
--- /dev/null
+++ b/pipeline/atlas_plates.py
@@ -0,0 +1,268 @@
+#!/usr/bin/env python3
+"""
+Place each hotspot map from the Atlas for the End of the World on the map.
+
+The Atlas publishes each biodiversity hotspot as a PDF whose first page is a
+map of that hotspot, with the cities on it named in text that stays text in
+the file. That is enough to put the page where it belongs:
+
+  1. read every place name on the first page and where it sits on the page;
+  2. look each one up on OpenStreetMap (Nominatim), towns and cities only;
+  3. find the one straight-line (affine) placement of the page that puts the
+     most names within reach of where OpenStreetMap has them, trying many
+     sets of three at random so that a wrongly-matched name cannot pull the
+     page out of place (RANSAC);
+  4. refine it on every name that agrees, and measure how far each still is
+     from its place: that distance is the plate's error, and it is written
+     down with the plate and shown on the map;
+  5. draw the page as a picture and record where its four corners fall.
+
+A plate is kept only when enough names agree and the error is small next to
+the plate's size (MIN_AGREE, MAX_ERROR_SHARE). The rest are listed with the
+reason, and the map shows their PDF without placing it. Nothing is guessed:
+the placement comes only from the Atlas's own labels and OpenStreetMap.
+
+A label sits beside its town's dot, not on it, so the error is never zero; it
+is of the order of a label's offset on the page.
+
+Writes map/atlas/plates/<slug>.webp and map/atlas/plates.json. Downloads and
+look-ups are kept in pipeline/.atlas-cache so a second run makes no requests.
+
+Run from the repo root, with the venv on:
+    pip install pymupdf pillow requests
+    python3 pipeline/atlas_plates.py            every hotspot
+    python3 pipeline/atlas_plates.py cerrado    one or more by name
+"""
+import io
+import json
+import math
+import pathlib
+import random
+import re
+import sys
+import time
+
+ROOT = pathlib.Path(__file__).resolve().parent.parent
+OUT = ROOT / "map" / "atlas"
+CACHE = ROOT / "pipeline" / ".atlas-cache"
+PDF_BASE = "https://atlas-for-the-end-of-the-world.com/hotspots/"
+UA = {"User-Agent": "welcometoyourgalaxy-atlas/1.0 (+https://welcometoyourgalaxy.com)"}
+
+# The same list the map carries (atlas_hotspots.pdfs in map/app.js).
+HOTSPOTS = [
+    ("atlantic_forests", "Atlantic Forest"), ("california_floristic_province", "California Floristic Province"),
+    ("cape_floristic_region", "Cape Floristic Region"), ("caribbean_islands", "Caribbean Islands"),
+    ("caucasus", "Caucasus"), ("cerrado", "Cerrado"), ("chilean_valdivian_forests", "Chilean Winter Rainfall Valdivian Forests"),
+    ("coastal_forests_of_eastern_africa", "Coastal Forests of Eastern Africa"), ("east_melanesian_islands", "East Melanesian Islands"),
+    ("eastern_afromontane", "Eastern Afromontane"), ("forests_of_east_australia", "Forests of Eastern Australia"),
+    ("guinean_forests_of_west_africa", "Guinean Forests of West Africa"), ("himalaya", "Himalaya"), ("horn_of_africa", "Horn of Africa"),
+    ("japan", "Japan"), ("madagascar", "Madagascar & The Indian Ocean Islands"), ("madrean_woodlands", "Madrean Pine-Oak Woodlands"),
+    ("maputaland_pondoland_albany", "Maputaland Pondoland Albany"), ("mediterranean_basin", "Mediterranean Basin"),
+    ("mesoamerica", "Mesoamerica"), ("mountains_of_central_asia", "Mountains of Central Asia"),
+    ("mountains_of_southwest_china", "Mountains of Southwest China"), ("new_caledonia", "New Caledonia"), ("new_zealand", "New Zealand"),
+    ("philippines", "Philippines"), ("north_american_coastal_plain", "North American Coastal Plain"),
+    ("southwest_australia", "Southwest Australia"), ("succulent_karoo", "Succulent Karoo"), ("sundaland", "Sundaland"),
+    ("tropical_andes", "Tropical Andes"), ("wallacea", "Wallacea"), ("western_ghats_sri_lanka", "Western Ghats & Sri Lanka"),
+]
+
+MIN_AGREE = 5            # names that must agree on the placement
+MAX_ERROR_SHARE = 0.03   # typical error no more than 3% of the plate's width
+TRIES = 4000             # random sets of three tried
+IMAGE_WIDTH = 2400       # pixels across the drawn page
+
+# Words on the plates that are the key, the title or the figures, never places.
+NOT_PLACES = {
+    "kilometers", "hotspot", "neighboring", "protected", "area", "urban", "agriculture", "roads", "railroads",
+    "biodiversity", "target", "category", "landuse", "population", "topography", "water", "body", "remnant",
+    "vegetation", "existing", "growth", "projection", "conflict", "zone", "extreme", "threatened", "species",
+    "habitat", "ecoregions", "ecoregion", "biomes", "endemic", "plant", "animal", "major", "crops", "threats",
+    "shortfall", "assessment", "forests", "grasslands", "savannas", "shrublands", "conflicts", "protected",
+}
+
+R = 6378137.0
+def merc(lon, lat):
+    lat = max(-85.0, min(85.0, lat))
+    return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
+def unmerc(x, y):
+    return math.degrees(x / R), math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2)
+
+
+# Where on a label its place's dot is taken to be. Labels sit beside their dots
+# on one side or another; each is tried and the one that fits best is kept, so
+# the choice is measured, not assumed.
+ANCHORS = {"centre": lambda b: ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2),
+           "left edge": lambda b: (b[0], (b[1] + b[3]) / 2),
+           "right edge": lambda b: (b[2], (b[1] + b[3]) / 2),
+           "below": lambda b: ((b[0] + b[2]) / 2, b[3]),
+           "above": lambda b: ((b[0] + b[2]) / 2, b[1])}
+
+
+def label_candidates(page, anchor="centre"):
+    """Each piece of text on the page that could be a place name, with its anchor point."""
+    out = []
+    for block in page.get_text("dict")["blocks"]:
+        for line in block.get("lines", []):
+            for span in line.get("spans", []):
+                t = re.sub(r"\s+", " ", span["text"]).strip(" ,.;:")
+                if not (3 <= len(t) <= 40) or re.search(r"\d", t) or not t[0].isupper() or t.isupper():
+                    continue
+                if any(w.lower() in NOT_PLACES for w in re.split(r"[\s\-()]+", t) if w):
+                    continue
+                x, y = ANCHORS[anchor](span["bbox"])
+                out.append((t, x, y))
+    return out
+
+
+def fit_affine(pairs):
+    """Least squares page (x, y) -> mercator (X, Y); pairs of ((x, y), (X, Y))."""
+    # Normal equations for X = a x + b y + c and Y = d x + e y + f, solved by hand (3x3).
+    sxx = sxy = syy = sx = sy = n = 0.0
+    sxX = syX = sX = sxY = syY = sY = 0.0
+    for (x, y), (X, Y) in pairs:
+        sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; n += 1
+        sxX += x * X; syX += y * X; sX += X; sxY += x * Y; syY += y * Y; sY += Y
+    M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]]
+    def solve(b):
+        a = [row[:] + [v] for row, v in zip(M, b)]
+        for i in range(3):
+            p = max(range(i, 3), key=lambda r: abs(a[r][i]))
+            if abs(a[p][i]) < 1e-12:
+                return None
+            a[i], a[p] = a[p], a[i]
+            for r in range(3):
+                if r != i:
+                    f = a[r][i] / a[i][i]
+                    for c in range(i, 4):
+                        a[r][c] -= f * a[i][c]
+        return [a[i][3] / a[i][i] for i in range(3)]
+    u, v = solve([sxX, syX, sX]), solve([sxY, syY, sY])
+    return (u, v) if u and v else None
+
+
+def apply(T, x, y):
+    (a, b, c), (d, e, f) = T
+    return a * x + b * y + c, d * x + e * y + f
+
+
+def ground_km(X1, Y1, X2, Y2):
+    """Distance between two mercator points in kilometres on the ground."""
+    lon1, lat1 = unmerc(X1, Y1)
+    lon2, lat2 = unmerc(X2, Y2)
+    p1, p2 = math.radians(lat1), math.radians(lat2)
+    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
+    return 2 * 6371.0 * math.asin(math.sqrt(min(1.0, h)))
+
+
+def place_page(labels, width_pt, height_pt, seed=0):
+    """labels: [(name, x, y, [(X, Y), ...candidates])]. The placement, its inliers and its error, or None."""
+    usable = [l for l in labels if l[3]]
+    if len(usable) < 3:
+        return None
+    rng = random.Random(seed)
+    best = None
+    for _ in range(TRIES):
+        trio = rng.sample(usable, 3)
+        T = fit_affine([((l[1], l[2]), rng.choice(l[3])) for l in trio])
+        if not T:
+            continue
+        a, b = apply(T, 0, 0), apply(T, width_pt, 0)
+        span_km = ground_km(*a, *b)
+        if not (10 < span_km < 20000):
+            continue
+        reach = span_km * MAX_ERROR_SHARE * 2
+        agree = []
+        for l in usable:
+            X, Y = apply(T, l[1], l[2])
+            d, c = min((ground_km(X, Y, *c), c) for c in l[3])
+            if d <= reach:
+                agree.append(((l[1], l[2]), c, l[0]))
+        if not best or len(agree) > len(best[1]):
+            best = (T, agree)
+    if not best or len(best[1]) < MIN_AGREE:
+        return {"kept": False, "reason": f"only {len(best[1]) if best else 0} names agree on a placement (at least {MIN_AGREE} needed)"}
+    T = fit_affine([(p, c) for p, c, _ in best[1]])
+    errs = []
+    for p, c, name in best[1]:
+        X, Y = apply(T, *p)
+        errs.append((ground_km(X, Y, *c), name))
+    rms = math.sqrt(sum(e * e for e, _ in errs) / len(errs))
+    span_km = ground_km(*apply(T, 0, 0), *apply(T, width_pt, 0))
+    corners = [unmerc(*apply(T, x, y)) for x, y in ((0, 0), (width_pt, 0), (width_pt, height_pt), (0, height_pt))]
+    kept = rms <= span_km * MAX_ERROR_SHARE
+    return {"kept": kept, "reason": "" if kept else f"typical error {rms:.0f} km is more than {MAX_ERROR_SHARE:.0%} of the plate's {span_km:.0f} km",
+            "corners": [[round(lon, 5), round(lat, 5)] for lon, lat in corners],
+            "error_km": round(rms, 1), "width_km": round(span_km), "names": sorted(n for _, n in errs),
+            "worst": sorted(errs, reverse=True)[:3]}
+
+
+def geocode(name, cache, session):
+    if name in cache:
+        return cache[name]
+    time.sleep(1.1)                     # Nominatim's limit: one request a second
+    r = session.get("https://nominatim.openstreetmap.org/search",
+                    params={"q": name, "format": "jsonv2", "featureType": "settlement", "limit": 5}, headers=UA, timeout=60)
+    got = [(float(h["lon"]), float(h["lat"])) for h in (r.json() if r.ok else [])]
+    cache[name] = got
+    return got
+
+
+def main(only):
+    try:
+        import pymupdf
+    except ImportError:
+        import fitz as pymupdf
+    import requests
+    from PIL import Image
+    CACHE.mkdir(parents=True, exist_ok=True)
+    (OUT / "plates").mkdir(parents=True, exist_ok=True)
+    gc_path = CACHE / "geocode.json"
+    cache = json.loads(gc_path.read_text()) if gc_path.exists() else {}
+    session = requests.Session()
+    out_path = OUT / "plates.json"
+    plates = json.loads(out_path.read_text()) if out_path.exists() else {}
+    for slug, title in HOTSPOTS:
+        if only and slug not in only:
+            continue
+        pdf = CACHE / f"{slug}.pdf"
+        if not pdf.exists():
+            r = session.get(PDF_BASE + slug + ".pdf", headers=UA, timeout=180)
+            if not r.ok:
+                print(f"{slug}: the PDF did not come ({r.status_code})")
+                continue
+            pdf.write_bytes(r.content)
+        doc = pymupdf.open(str(pdf))
+        page = doc[0]
+        labels = label_candidates(page)
+        for name in dict.fromkeys(n for n, _, _ in labels):
+            geocode(name, cache, session)
+        gc_path.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
+        w, h = page.rect.width, page.rect.height
+        got = None
+        for anchor in ANCHORS:
+            rows = [(n, x, y, [merc(lon, lat) for lon, lat in cache.get(n, [])]) for n, x, y in label_candidates(page, anchor)]
+            tried = place_page(rows, w, h)
+            if tried and tried.get("corners") and (not got or not got.get("corners") or
+                                                   (len(tried["names"]), -tried["error_km"]) > (len(got["names"]), -got["error_km"])):
+                got = dict(tried, anchor=anchor)
+            elif not got:
+                got = tried
+        got = got or {"kept": False, "reason": "fewer than three names on the page could be found"}
+        entry = {"title": title, "pdf": PDF_BASE + slug + ".pdf", "labels": len(labels), **got}
+        entry.pop("worst", None)
+        if got.get("kept"):
+            zoom = IMAGE_WIDTH / w
+            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
+            img = Image.open(io.BytesIO(pix.tobytes("png")))
+            img.save(OUT / "plates" / f"{slug}.webp", "WEBP", quality=80)
+            entry["image"] = f"atlas/plates/{slug}.webp"
+        plates[slug] = entry
+        say = f"placed, {len(got['names'])} names agree, typical error {got['error_km']} km on a {got['width_km']} km plate" if got.get("kept") else f"not placed: {got['reason']}"
+        print(f"{slug}: {say}")
+        if got.get("worst"):
+            print("    furthest: " + "; ".join(f"{n} {d:.0f} km" for d, n in got["worst"]))
+        out_path.write_text(json.dumps(plates, ensure_ascii=False, indent=1))
+    print(f"wrote {out_path}")
+
+
+if __name__ == "__main__":
+    main(set(sys.argv[1:]))
'''

app = pathlib.Path.cwd() / "map" / "app.js"
if not app.exists():
    sys.exit("Run this from ~/Desktop/culprits (map/app.js not found here).")
if "const NOT_LIVE = {" not in app.read_text():
    sys.exit("round_0922cd.py has to be applied first; nothing was changed.")

with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False) as f:
    f.write(DIFF)
    patch = f.name

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)

if git("apply", "--check", "--reverse", patch).returncode == 0:
    sys.exit("Already applied: nothing to do.")
check = git("apply", "--check", patch)
if check.returncode != 0:
    sys.exit("This patch does not fit the files on disk, so nothing was changed. Run git pull first.\n" + check.stderr)
done = git("apply", patch)
if done.returncode != 0:
    sys.exit(done.stderr)
print("Applied. Now run: node map/test.mjs && node map/wire.test.mjs")
