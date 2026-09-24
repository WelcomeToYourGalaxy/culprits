#!/usr/bin/env python3
"""
ACGF removed; the three oil-slick layers under Oil slicks > Marine oil slicks;
the slick archive drawn as a point per slick wider out than zoom 7.
Needs patch_0929.py applied first. Run from the culprits folder:

    python3 patch_0930.py

then:  node map/test.mjs
"""
import pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
app_path = ROOT / "map" / "app.js"
if not app_path.exists():
    sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits). Nothing was written.")
app = app_path.read_text(encoding="utf-8")
if 'Marine oil slicks' in app:
    sys.exit("Already applied - nothing to do.")
if 'zoomTo: 9,' not in app:
    sys.exit("Run patch_0929.py first. Nothing was written.")
DIFF = r'''diff --git a/map/app.js b/map/app.js
index 0ea8238..9fb1835 100644
--- a/map/app.js
+++ b/map/app.js
@@ -4333,11 +4333,28 @@ async function addSlickArchive(cfg) {
   map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
   map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: src, paint: { "fill-color": "#1D1B17", "fill-opacity": 0.55 } });
   map.addLayer({ id: `${cfg.id}-line`, type: "line", source: src, paint: { "line-color": "#B8A79E", "line-width": 1 } });
+  // Wider out a slick is smaller than a pixel, so each is also a point at its
+  // middle until zoom 7, where the shapes are big enough to see.
+  map.addSource(`${src}-pt`, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
+  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: `${src}-pt`, maxzoom: 7,
+    paint: { "circle-color": "#B8A79E", "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.2, 6, 3.6],
+             "circle-stroke-color": "#1D1B17", "circle-stroke-width": 0.5, "circle-opacity": 0.9 } });
   bindHtmlPopup(`${cfg.id}-fill`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily</div>`);
+  bindHtmlPopup(`${cfg.id}-pt`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily \u00b7 zoom in for its shape</div>`);
+  const middles = (gj) => ({ type: "FeatureCollection", features: (gj.features || []).map((f) => {
+    const pts = [];
+    const walk = (c) => { if (typeof c[0] === "number") pts.push(c); else c.forEach(walk); };
+    if (f.geometry && f.geometry.coordinates) walk(f.geometry.coordinates);
+    if (!pts.length) return null;
+    const x = pts.reduce((a, p) => a + p[0], 0) / pts.length, y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
+    return { type: "Feature", properties: f.properties || {}, geometry: { type: "Point", coordinates: [x, y] } };
+  }).filter(Boolean) });
   const show = async (m) => {
     setLayerState(cfg.id, `reading ${m}\u2026`);
     try {
-      map.getSource(src).setData(await getJson(`${cfg.base}/${m}.geojson`, 60000));
+      const gj = await getJson(`${cfg.base}/${m}.geojson`, 60000);
+      map.getSource(src).setData(gj);
+      map.getSource(`${src}-pt`).setData(middles(gj));
       setLayerState(cfg.id, `${Number(index[m]).toLocaleString()} slicks in ${m} \u00b7 ${months.length} months kept`);
     } catch (e) { setLayerState(cfg.id, `${m} could not be read (${e.message})`); }
   };
@@ -7510,10 +7527,12 @@ const PANEL_ORDER = [
   { h: 3, t: "Deforestation" }, "gfw", "gfw_dist", "gfw_dist_year", "glad_loss", "palmwatch", "soilgrids", "trase_measures", "trase_facilities", "nusantara", "gfw_catalogue",
   { h: 3, t: "Biodiversity loss" }, "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report", "gsn", "gsn_rankings",
   { h: 3, t: "Mining" }, "mines_global",
-  { h: 3, t: "Agriculture" }, "acgf",
+  { h: 3, t: "Agriculture" },
   { h: 4, t: "National shading" }, "land_matrix",
   { h: 4, t: "Slaughterhouses" }, "abattoir_facilities", "cultivated_meat_laws",
-  { h: 3, t: "Oceans" }, "fishing", "slavery_fishing", "cerulean_slicks", "cerulean_sources", "slick_archive", "allen_coral", "skytruth_monitor", "skytruth_voc",
+  { h: 3, t: "Oceans" }, "fishing", "slavery_fishing", "allen_coral", "skytruth_monitor", "skytruth_voc",
+  { h: 4, t: "Oil slicks" },
+  { h: 5, t: "Marine oil slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive",
   { h: 3, t: "Construction" }, "local_projects", "live_projects_app",
   { h: 3, t: "Culprits upstream" }, "ejatlas",
   { h: 4, t: "Emissions" }, "carbon_majors", "soy_organizations", "bocc",
@@ -7584,6 +7603,8 @@ const PANEL_REMOVED = new Set([
   "ect_secrets", "isds_tracker", "bffp_audit", "epa_tri", "unep_coral",
   // Split into its registers (gmo_env and the rows after it) on 20 September.
   "gmo_releases",
+  // Removed at the owner's request, 20 September.
+  "acgf",
   "fin_bank", "fin_centralbank", "fin_taxoffice", "fin_govfinance", "fin_financial", "fin_exchange", "fin_insurance", "fin_accountant", "fin_remittance", "fin_stockexchange", "fin_auditoffice", "fin_devbank", "fin_mint", "legal_publicdefender", "legal_immigration", "legal_probation", "legal_juvenile", "leg_parliament", "leg_audit", "leg_electoral", "leg_ombudsman", "leg_council", "exec_firestation", "exec_townhall", "leg_townhall", "exec_govoffice", "exec_ministry", "exec_diplomatic", "exec_border", "jud_courts", "legal_courthouse", "slavery_facilities", "activist_courts", "exec_police", "legal_police", "activist_police", "exec_prison", "legal_prison", "jud_prisons", "activist_prisons",
   "site_ufo_pre1900", "site_subsistence_cultures", "site_self_sufficiency", "slavery_trackers",
   "site_environment_law", "enviro_law_by_country", "site_environment_law_shapes", "gov_official_map",
diff --git a/map/test.mjs b/map/test.mjs
index 38da1e0..810da03 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1976,7 +1976,7 @@ console.log("\nzoos and pet industry placed");
 console.log("\nACGF placed");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
-  check("ACGF sits under Agriculture", /\{ h: 3, t: "Agriculture" \}, "acgf",/.test(src));
+  // ACGF was removed on 20 September (see "ACGF is removed").
 }
 
 console.log("\nchanges of 19 September");
@@ -2152,5 +2152,17 @@ console.log("\nAtlas cities zoom in when clicked");
   check("clicking a city from further out zooms in to it, then opens its box", /route: "atlascities", zoomTo: 9,/.test(src) && /map\.flyTo\(\{ center: at, zoom: z, duration: 1600 \}\)/.test(src));
 }
 
+console.log("\nACGF removed; oil slicks grouped; the slick archive seen from afar");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
+  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
+  check("ACGF is removed", o.PANEL_REMOVED.has("acgf") && !o.PANEL_ORDER.includes("acgf"));
+  check("the three slick layers sit under Oil slicks, Marine oil slicks", at("Oil slicks") < at("Marine oil slicks") &&
+        ["cerulean_slicks", "cerulean_sources", "slick_archive"].every((i) => o.PANEL_ORDER.indexOf(i) > at("Marine oil slicks")) && o.PANEL_ORDER.indexOf("slick_archive") < at("Construction"));
+  check("the slick archive draws a point per slick wider out", /id: `\$\{cfg\.id\}-pt`, type: "circle", source: `\$\{src\}-pt`, maxzoom: 7/.test(src));
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
