#!/usr/bin/env python3
"""
Global Safety Net: tile addresses no longer doubled, each layer keeps its tick,
and the rows sit under Biodiversity loss. Google My Maps rows show their maps'
own titles before they are opened. Needs patch_0926.py applied first.
Run from the culprits folder:

    python3 patch_0927.py

then:  node map/test.mjs
"""
import pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
app_path = ROOT / "map" / "app.js"
if not app_path.exists():
    sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits). Nothing was written.")
app = app_path.read_text(encoding="utf-8")
if "function mymapsTitles(" in app:
    sys.exit("Already applied - nothing to do.")
if 'id:"hydrowaste"' not in app:
    sys.exit("Run patch_0926.py first. Nothing was written.")
DIFF = r'''diff --git a/map/app.js b/map/app.js
index 4331d29..0e17f69 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3078,6 +3078,25 @@ function addAbattoirParts(cfg) {
   cfg.afterVisibility = (vis) => applyAbattoirParts(cfg, vis);
   applyVisibility(cfg.id);
 }
+// Google My Maps rows: the daily address job (culprits-tiles-more) keeps each
+// map's own title, so the row shows it before the layer is opened.
+const MYMAPS_TITLES = "https://welcometoyourgalaxy.github.io/culprits-tiles-more/mymaps/titles.json";
+async function mymapsTitles() {
+  let titles;
+  try { titles = await getJson(MYMAPS_TITLES, 15000); } catch (e) { return; }
+  const all = LAYERS.concat(...(typeof GROUPS !== "undefined" ? GROUPS.map((g) => g.children) : []));
+  for (const cfg of all) {
+    if (cfg.route !== "kml" || !cfg.kml || !/^Google My Maps map/.test(cfg.name)) continue;
+    const mid = (cfg.kml.match(/mid=([^&]+)/) || [])[1];
+    const t = mid && titles[mid];
+    if (!t) continue;
+    cfg.name = t;
+    const nm = document.querySelector(`[data-layer="${cfg.id}"]`);
+    const el = nm && nm.closest && nm.closest("label") && nm.closest("label").querySelector(".nm");
+    if (el) el.textContent = t;
+  }
+  if (typeof buildLegend === "function") buildLegend();
+}
 function abattoirPartsInit() {
   const cfg = LAYERS.find((l) => l.id === "abattoir_facilities");
   // After the row's own layers exist, so the grid and points sit beneath them.
@@ -3967,7 +3986,11 @@ async function addGsnLayer(cfg) {
       const l = list.find((x) => String(x.id) === cb.dataset.gsn);
       const id = `${cfg.id}-r-${l.id}`;
       if (cb.checked && !map.getLayer(id)) {
-        map.addSource(id, { type: "raster", tileSize: 256, tiles: [`${l.gee_tile_url}/tiles/{z}/{x}/{y}`],
+        // The service gives either a map address to add /tiles/{z}/{x}/{y} to,
+        // or the tile template itself; adding it twice made every tile fail.
+        const u = String(l.gee_tile_url || l.tile_url || l.url || "");
+        const tpl = /\{z\}/.test(u) ? u : `${u.replace(/\/+$/, "")}/tiles/{z}/{x}/{y}`;
+        map.addSource(id, { type: "raster", tileSize: 256, tiles: [tpl],
           attribution: "Global Safety Net, One Earth / Nature Data Lab" });
         map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.85 } });
         cfg._layerIds.push(id);
@@ -3977,6 +4000,11 @@ async function addGsnLayer(cfg) {
       setLayerState(cfg.id, `${on} of ${list.length} layers shown` + (cb.checked && l.description ? ` \u00b7 ${l.name}: ${l.description.slice(0, 140)}` : ""));
     });
     anchor.after(el);
+    // Switching the row on or off keeps each layer's own tick.
+    cfg.afterVisibility = (vis) => el.querySelectorAll("[data-gsn]").forEach((cb) => {
+      const id = `${cfg.id}-r-${cb.dataset.gsn}`;
+      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis === "visible" && cb.checked ? "visible" : "none");
+    });
   }
   setLayerState(cfg.id, `${list.length} layers \u2014 tick the ones to show`);
 }
@@ -7424,6 +7452,7 @@ function gmInit() {
 map.on("load", gmInit);
 map.on("load", buildLegend);
 map.on("load", () => setTimeout(abattoirPartsInit, 0));
+map.on("load", () => setTimeout(mymapsTitles, 50));
 
 /* ---------- the layers box, in the order and under the headings chosen ---------- */
 // Strings are layer ids; "group:" a whole group; "gm" the guerillamap row.
@@ -7448,8 +7477,8 @@ const PANEL_ORDER = [
   { h: 4, t: "Air pollution" }, "ct_air", "ct_pop",
   { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget", "hydrowaste",
   { h: 4, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
-  { h: 3, t: "Deforestation" }, "gfw", "gfw_dist", "gfw_dist_year", "glad_loss", "palmwatch", "soilgrids", "trase_measures", "trase_facilities", "nusantara", "gfw_catalogue", "gsn", "gsn_rankings",
-  { h: 3, t: "Biodiversity loss" }, "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report",
+  { h: 3, t: "Deforestation" }, "gfw", "gfw_dist", "gfw_dist_year", "glad_loss", "palmwatch", "soilgrids", "trase_measures", "trase_facilities", "nusantara", "gfw_catalogue",
+  { h: 3, t: "Biodiversity loss" }, "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report", "gsn", "gsn_rankings",
   { h: 3, t: "Mining" }, "mines_global",
   { h: 3, t: "Agriculture" }, "acgf",
   { h: 4, t: "National shading" }, "land_matrix",
diff --git a/map/test.mjs b/map/test.mjs
index 7f9bc4d..c677740 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1912,7 +1912,7 @@ console.log("\nGlobal Safety Net");
   const shown = new Function(src.slice(src.indexOf("function gsnShown("), src.indexOf("async function addGsnLayer(")) + "; return gsnShown;")();
   const list = [{ id: 1, gee_tile_url: "u" }, { id: 26, gee_tile_url: "u", is_hidden: "True" }, { id: 7, gee_tile_url: "u", is_multilayer: "True" }, { id: 9 }];
   check("the viewer's own layers are offered, its hidden helpers are not", shown(list).map((l) => l.id).join() === "1,7");
-  check("each is drawn from the fresh address its list gives", /\$\{l\.gee_tile_url\}\/tiles\/\{z\}\/\{x\}\/\{y\}/.test(src));
+  check("each is drawn from the fresh address its list gives", /String\(l\.gee_tile_url/.test(src) && /\/tiles\/\{z\}\/\{x\}\/\{y\}`/.test(src));
 }
 
 console.log("\nClimate TRACE air pollution");
@@ -2134,5 +2134,16 @@ console.log("\nHydroWASTE on the map; the EIP and HydroFATE page rows gone");
   check("the Environmental Integrity Project and HydroFATE page rows are gone", !/id: "eip_inventory"/.test(src) && !/id: "hydrofate"/.test(src));
 }
 
+console.log("\nGlobal Safety Net fixes; My Maps titles");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const order = new Function(body + "; return PANEL_ORDER;")();
+  const at = (t) => order.findIndex((x) => x && x.t === t);
+  check("Global Safety Net rows are under Biodiversity loss", order.indexOf("gsn") > at("Biodiversity loss") && order.indexOf("gsn") < at("Mining") && order.indexOf("gsn_rankings") < at("Mining"));
+  check("a GSN tile template is not doubled", /\/\\\{z\\\}\/\.test\(u\) \? u :/.test(src));
+  check("My Maps rows take their maps' titles before opening", /function mymapsTitles\(/.test(src) && /map\.on\("load", \(\) => setTimeout\(mymapsTitles, 50\)\)/.test(src));
+}
+
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
'''

with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False, encoding="utf-8") as f:
    f.write(DIFF)
chk = subprocess.run(["git", "apply", "--check", f.name], cwd=ROOT, capture_output=True, text=True)
if chk.returncode:
    sys.exit("The files differ from the copy this was made for. Nothing was written. " + chk.stderr)
subprocess.run(["git", "apply", f.name], cwd=ROOT, check=True)
print("Done. Test with: node map/test.mjs")
