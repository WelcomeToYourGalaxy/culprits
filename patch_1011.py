#!/usr/bin/env python3
"""
Carbon Mapper read from its own platform: far more plumes, and each plume's own
shape instead of a dot.

Run from the repo root:  python3 patch_1011.py

Needs patch_1010.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js     A new route, "carbonmapper", reading
                 api.carbonmapper.org/api/v1/catalog/plumes/annotated: ten
                 pages of a thousand, newest first, each plume a point sized by
                 the emission rate measured at that moment, and from zoom 10
                 each plume's own picture laid on the map at the bounds Carbon
                 Mapper give for it, forty at a time and only where they are on
                 screen. The row says how many of the published total it holds.
                 The old row - the handful of waste-site plumes listed on our
                 own page - is retired.
  map/test.mjs   Checks for all of it.
  HANDOFF.md     What it reads, and what has not been confirmed.

Not yet seen in a browser: this was built from the response shape Carbon Mapper
document in their product guide, and the sandbox it was written in cannot reach
their API. Tick the row and look. If the platform answers with differently
named fields, the row will say so or the boxes will be thin, and the mapping in
addCarbonMapperLayer is where to fix it.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 9b5df4d..f4ebe37 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -123,11 +123,16 @@ doi:10.5063/F76B09, with the code at OHI-Science/GlobalWasteWater. Rebuilding
 means fetching those GeoTIFFs and tiling them rather than copying someone
 else's picture squares.
 
-**Carbon Mapper.** The row here is the set of waste-site plumes from our own
-page, which is a fraction of what Carbon Mapper publish, and it draws each as a
-point where their own viewer draws the plume's shape. Their public API is the
-way to both: the plume records carry their footprints, so a route that reads it
-would give the shapes and the rest of the catalogue at once.
+**Carbon Mapper — done, but unconfirmed in a browser.** `route:"carbonmapper"`
+reads `api.carbonmapper.org/api/v1/catalog/plumes/annotated`, ten pages of a
+thousand, newest first, and says how many of `total_count` it is holding. Each
+plume is a point sized by `emission_auto`; from zoom 10 the plume's own picture
+(`plume_png`) is laid on the map at `plume_bounds`, forty at a time, only where
+they are on screen. Built from the shape Carbon Mapper document in their
+product guide, not from a live call: this sandbox cannot reach their API, so
+the first real test is a browser. If the fields come back named differently the
+row will say the platform did not answer, or draw points with thin boxes, and
+the mapping in `addCarbonMapperLayer` is the place to fix it.
 
 ---
 
diff --git a/map/app.js b/map/app.js
index 763b7af..7ecdbae 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3318,6 +3318,132 @@ function showRowFor(id) {
   }
 }
 
+/* ---------- Carbon Mapper's plumes, read from its own data platform ---------- */
+
+// What was here before was the handful of waste-site plumes listed on our own
+// page, drawn as dots. Carbon Mapper publish far more than that, and their own
+// viewer draws each plume's shape rather than a dot, because the shape is the
+// reading: a plume is a smear of gas with a direction and a length, and a dot
+// says only that something was seen somewhere.
+//
+// So: the newest plumes from their catalogue, each as a point that can be
+// found from any zoom, and from CARBON_PLUME_ZOOM in, each plume's own picture
+// laid on the map at the bounds Carbon Mapper give for it. The picture is
+// theirs, drawn where they say it belongs; nothing is redrawn or inferred.
+//
+// The catalogue is large, so the row reads the newest CARBON_PLUME_PAGES pages
+// and says how many of the total it is holding rather than pretending to have
+// all of it.
+const CARBON_API = "https://api.carbonmapper.org/api/v1/catalog/plumes/annotated";
+const CARBON_PLUME_ZOOM = 10;     // from here in, the plumes' own pictures
+const CARBON_PLUME_PAGES = 10;    // 1,000 plumes a page
+const CARBON_PICTURES_AT_ONCE = 40;
+async function addCarbonMapperLayer(cfg) {
+  const src = `${cfg.id}-src`;
+  map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] },
+    attribution: cfg.attribution || "" });
+  // Sized by the emission rate Carbon Mapper measured, which is the one number
+  // that says how much this plume matters; unmeasured plumes keep the base size.
+  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src,
+    paint: {
+      "circle-color": ["case", ["==", ["get", "gas"], "CO2"], "#6E6358", cfg.colour],
+      "circle-opacity": 0.8,
+      "circle-radius": ["interpolate", ["linear"], ["zoom"],
+        1, ["+", 1.8, ["*", 0.7, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]],
+        9, ["+", 3, ["*", 1.4, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]]],
+      "circle-stroke-color": "#17150F", "circle-stroke-width": 0.4 } });
+  const num = (v, unit) => (v === null || v === undefined || v === "" || !isFinite(Number(v)) ? "" :
+    `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}${unit}`);
+  bindHtmlPopup(`${cfg.id}-pt`, (p) =>
+    `<b>${escapeHtml(p.gas || "Plume")} plume${p.plume_id ? " " + escapeHtml(p.plume_id) : ""}</b>` +
+    (p.picture ? `<div><img src="${escapeHtml(p.picture)}" alt="" style="max-width:320px;width:100%;margin:6px 0"></div>` : "") +
+    `<table class="meta">${fieldRows(p, ["picture", "bounds"])}</table>` +
+    (p.emission ? `<div class="meta">${num(p.emission, " kg per hour")}${p.emission_uncertainty ? ` \u00b1 ${num(p.emission_uncertainty, "")}` : ""}, as Carbon Mapper measured it at that moment \u2014 not the source's overall rate</div>` : "") +
+    `<div class="meta">Carbon Mapper data platform</div>`);
+
+  let held = [];
+  const read = async () => {
+    const feats = [];
+    let total = null;
+    for (let page = 0; page < CARBON_PLUME_PAGES; page++) {
+      setLayerState(cfg.id, `reading Carbon Mapper, page ${page + 1}\u2026`);
+      let j;
+      try { j = await getJson(`${CARBON_API}?sort=desc&limit=1000&offset=${page * 1000}`, 60000); }
+      catch (e) { if (!feats.length) { setLayerState(cfg.id, `Carbon Mapper did not answer (${e.message})`); return; } break; }
+      const items = j.items || j.features || [];
+      if (total === null && j.total_count != null) total = Number(j.total_count);
+      for (const it of items) {
+        const g = it.geometry_json || it.geometry;
+        const at = g && g.coordinates;
+        if (!at || !isFinite(Number(at[0])) || !isFinite(Number(at[1]))) continue;
+        feats.push({ type: "Feature", geometry: { type: "Point", coordinates: [Number(at[0]), Number(at[1])] },
+          properties: {
+            plume_id: it.plume_id || it.id || "", gas: it.gas || "",
+            seen: it.scene_timestamp || it.datetime || "", instrument: it.instrument || "",
+            platform: it.platform || "", quality: it.plume_quality || "",
+            sector: it.sector || (it.source && it.source.sector) || "",
+            emission: it.emission_auto != null ? it.emission_auto : it.emission,
+            emission_uncertainty: it.emission_uncertainty_auto != null ? it.emission_uncertainty_auto : it.emission_uncertainty,
+            wind_speed: it.wind_speed_avg_auto, wind_direction: it.wind_direction_avg_auto,
+            collection: it.collection || "",
+            picture: it.plume_png || it.plume_rgb_png || "",
+            bounds: Array.isArray(it.plume_bounds) && it.plume_bounds.length === 4 ? it.plume_bounds.join(",") : "",
+          } });
+      }
+      if (items.length < 1000) break;
+    }
+    held = feats;
+    if (map.getSource(src)) map.getSource(src).setData({ type: "FeatureCollection", features: feats });
+    setLayerState(cfg.id, `${feats.length.toLocaleString()} plumes` +
+      (total ? ` of ${total.toLocaleString()} published` : "") +
+      ` \u00b7 their own pictures from zoom ${CARBON_PLUME_ZOOM}`);
+  };
+
+  // Each plume's own picture, at the bounds Carbon Mapper give for it. Only
+  // the ones on screen, and only so many at once: a picture is a source and a
+  // layer of its own, and a hundred of them at a time is a stalled map.
+  const drawn = new Map();
+  const pictures = () => {
+    const wanted = new Set();
+    if (map.getZoom() >= CARBON_PLUME_ZOOM && (visibility.get(cfg.id) || "none") === "visible") {
+      const b = map.getBounds();
+      for (const f of held) {
+        const p = f.properties;
+        if (!p.picture || !p.bounds) continue;
+        const [w, s2, e2, n] = p.bounds.split(",").map(Number);
+        if (e2 < b.getWest() || w > b.getEast() || n < b.getSouth() || s2 > b.getNorth()) continue;
+        wanted.add(p.plume_id);
+        if (wanted.size >= CARBON_PICTURES_AT_ONCE) break;
+      }
+    }
+    for (const [id, layer] of [...drawn]) {
+      if (wanted.has(id)) continue;
+      if (map.getLayer(layer)) map.removeLayer(layer);
+      if (map.getSource(layer)) map.removeSource(layer);
+      drawn.delete(id);
+    }
+    for (const f of held) {
+      const p = f.properties;
+      if (!wanted.has(p.plume_id) || drawn.has(p.plume_id)) continue;
+      const [w, s2, e2, n] = p.bounds.split(",").map(Number);
+      const id = `${cfg.id}-img-${drawn.size}-${String(p.plume_id).replace(/[^A-Za-z0-9_-]/g, "")}`;
+      try {
+        map.addSource(id, { type: "image", url: p.picture,
+          coordinates: [[w, n], [e2, n], [e2, s2], [w, s2]] });
+        map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.85 } }, `${cfg.id}-pt`);
+        drawn.set(p.plume_id, id);
+      } catch (err) { /* a picture that will not load costs only itself */ }
+    }
+  };
+  cfg.afterVisibility = () => pictures();
+  map.on("moveend", pictures);
+  map.on("zoomend", pictures);
+  await read();
+  pictures();
+  applyVisibility(cfg.id);
+  buildLegend();
+}
+
 /* ---------- a map server's whole layer list, as a menu (Nusantara Atlas) ---------- */
 async function addWmsMenuLayer(cfg) {
   const layers = [];
@@ -6464,6 +6590,9 @@ const SITE_MAPS = {
       note: "From the Destruction page's animal sacrifice map." },
     { id: "site_animal_fighting", name: "Animal Fighting Locations Map", unit: "venues", colour: "#84594F", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_animal_fighting.places.geojson",
       note: "From the Destruction page's animal fighting map (maps repo)." },
+    { id: "carbon_plumes", name: "Methane and carbon dioxide plumes, as Carbon Mapper saw them", unit: "plumes", colour: "#6D6A5E", route: "carbonmapper", ready: true, lazy: true,
+      attribution: '<a href="https://carbonmapper.org" target="_blank" rel="noopener">Carbon Mapper</a>',
+      note: "Read live from Carbon Mapper's own data platform: the newest 10,000 plumes it publishes, each with the emission rate measured at that moment, and from zoom 10 each plume's own picture laid where Carbon Mapper say it belongs. The row says how many of the published total it is holding." },
     { id: "site_carbon_mapper_waste", name: "Methane plumes from waste sites \u2014 the set on our own page (Carbon Mapper)", unit: "plume sources", colour: "#6D6A5E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_carbon_mapper_waste.places.geojson",
       note: "From the Destruction page's Carbon Mapper waste-sector map: the hotspots written into that map, not Carbon Mapper's live feed." },
     { id: "site_forest500_soy", name: "Forest 500: Worst Soy Financial Institutions (2024)", unit: "financial institutions", colour: "#6B5B4E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_forest500_soy.places.geojson",
@@ -7103,7 +7232,8 @@ function ensureLayer(cfg) {
       : cfg.route === "trase" ? addTraseLayer(cfg)
       : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
       : cfg.route === "slickarchive" ? addSlickArchive(cfg)
-      : cfg.route === "cafo" ? Promise.resolve().then(() => addCafoLayer(cfg))
+      : cfg.route === "carbonmapper" ? addCarbonMapperLayer(cfg)
+    : cfg.route === "cafo" ? Promise.resolve().then(() => addCafoLayer(cfg))
       : cfg.route === "glw" ? Promise.resolve().then(() => addGlwLayer(cfg))
       : cfg.route === "arcgisdyn" ? addArcgisDynLayer(cfg)
       : cfg.route === "giga" ? addGigaLayer(cfg)
@@ -7212,6 +7342,7 @@ const LAYER_KIND = {
   site_animal_racing: ["animal", "downstream"],
   site_rodeo: ["animal", "downstream"],
   site_carbon_mapper_waste: ["insentient", "downstream"],
+  carbon_plumes: ["insentient", "downstream"],
   site_forest500_soy: ["plant", "upstream"],
   site_china_grain: ["plant", "upstream"],
   site_soybean_companies: ["plant", "upstream"],
@@ -7750,7 +7881,7 @@ const PANEL_ORDER = [
   { h: 1, t: "Destruction" },
   { h: 2, t: "Of the planet" },
   { h: 3, t: "Climate" }, "group:climate_trace_sectors", "group:climate_trace_agriculture", "group:climate_trace_forestry",
-    "gem_coal", "carbon_bombs", "power_plants", "fertilizer_facilities", "fractracker_refineries", "site_carbon_mapper_waste", "site_china_grain",
+    "gem_coal", "carbon_bombs", "power_plants", "fertilizer_facilities", "fractracker_refineries", "carbon_plumes", "site_china_grain",
     "usda_soybean", "usda_corn", "wastewater", "group:ct_history",
   { h: 4, t: "National shading" }, "owid_co2",
   { h: 4, t: "Air pollution" }, "ct_air", "ct_pop",
@@ -7841,6 +7972,9 @@ const PANEL_REMOVED = new Set([
   "gmo_releases",
   // Removed at the owner's request, 20 September.
   "acgf",
+  // Replaced by carbon_plumes, which reads Carbon Mapper's own platform rather
+  // than the handful of plumes listed on our page.
+  "site_carbon_mapper_waste",
   // Its own map in a panel, replaced by the love_ rows under Construction,
   // which draw the same material on this map.
   "live_projects_app",
diff --git a/map/test.mjs b/map/test.mjs
index 6511059..7a6b36f 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2056,6 +2056,25 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\nCarbon Mapper's plumes, from their own platform");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
+  check("the row reads Carbon Mapper's catalogue, not the handful on our own page",
+        /const CARBON_API = "https:\/\/api\.carbonmapper\.org\/api\/v1\/catalog\/plumes\/annotated"/.test(src) &&
+        o.PANEL_ORDER.includes("carbon_plumes") && o.PANEL_REMOVED.has("site_carbon_mapper_waste"));
+  check("it pages through the catalogue and says how much of it is held",
+        /offset=\$\{page \* 1000\}/.test(src) && /of \$\{total\.toLocaleString\(\)\} published/.test(src));
+  check("closer in, each plume draws its own picture at the bounds Carbon Mapper give it",
+        /const CARBON_PLUME_ZOOM = 10/.test(src) && /type: "image", url: p\.picture/.test(src) &&
+        /coordinates: \[\[w, n\], \[e2, n\], \[e2, s2\], \[w, s2\]\]/.test(src));
+  check("only the pictures on screen are drawn, and only so many at once",
+        /const CARBON_PICTURES_AT_ONCE = 40/.test(src) && /if \(wanted\.size >= CARBON_PICTURES_AT_ONCE\) break;/.test(src));
+  check("a plume's box says the rate was measured at that moment, not the source's own",
+        /not the source's overall rate/.test(src));
+}
+
 console.log("\nareas findable from the world view");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
'''


def git(*args):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if "CARBON_API" in app:
        print("Already applied - nothing to do.")
        return
    if "areasFrom" not in app:
        sys.exit("patch_1010.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
