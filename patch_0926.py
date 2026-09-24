#!/usr/bin/env python3
"""
HydroWASTE's 58,502 wastewater treatment plants drawn on the map (in place of
the HydroFATE page panel); the Environmental Integrity Project row removed.
Needs map/tiles/hydrowaste.pmtiles copied in first. Run from the culprits
folder, after git pull:

    python3 patch_0926.py

then:  node map/test.mjs
"""
import pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
app_path = ROOT / "map" / "app.js"
if not app_path.exists():
    sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits). Nothing was written.")
app = app_path.read_text(encoding="utf-8")
if 'id:"hydrowaste"' in app:
    sys.exit("Already applied - nothing to do.")
if 'id:"gmo_fertility"' not in app:
    sys.exit("Run git pull first. Nothing was written.")
DIFF = r'''diff --git a/map/app.js b/map/app.js
index 4d28142..4331d29 100644
--- a/map/app.js
+++ b/map/app.js
@@ -372,6 +372,8 @@ const LAYERS = [
   { id:"gmo_animal_trade", sourceOf:"gmo_releases", name:"Animal breeders, dealers, exhibitors and carriers (USDA Animal Welfare Act)", unit:"licensees", colour:"#74695E", route:"pmtiles", ready:true, off: true,
     where: ["all", ["==", ["get", "id"], "industry:animals"],
             ["!", ["in", ["get", "x_type"], ["literal", ["Animal Welfare Act research facility", "Accredited animal research organisation", "CCAC certified institution"]]]]] },
+  { id:"hydrowaste",           name:"Wastewater treatment plants (HydroWASTE)", unit:"plants", colour:"#5E7278", route:"pmtiles", ready:true, off: true,
+    note: "HydroWASTE v1.0: 58,502 wastewater treatment plants, with the population each serves, the treated wastewater it discharges, its level of treatment, its estimated outfall and the river's dilution there (Ehalt Macedo et al., Earth System Science Data 2022; CC BY 4.0). The database behind HydroFATE's map, whose own page cannot be read to draw here. Every column is kept." },
   { id:"slavery_sites",        name:"Brick kilns and artisanal mining", unit:"sites", colour:"#8A6B62", route:"pmtiles", ready:true, off: true,
     note: "Sector infrastructure, not confirmed exploitation. These are sites in sectors where forced and child labour concentrate; where IPIS actually observed it, the site says so." },
   { id:"slavery_ports",        name:"Ports with high-risk vessel calls", unit:"ports", colour:"#5F7480", route:"pmtiles", ready:true, off: true,
@@ -6649,12 +6651,6 @@ const OTHER_MAPS = {
       points: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/epa_efpoints.pmtiles",
       attribution: "US EPA Envirofacts",
       note: "The facility points behind EPA's Envirofacts multisystem widget, drawn live from EPA's EnviroMapper service; EPA draws them from about state level in; wider out, a weekly copy of every point is drawn, merged into counted points where they crowd." },
-    { id: "eip_inventory", name: "Environmental Integrity Project: state emissions inventory", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
-      page: "https://environmentalintegrity.org/state-emissions-inventory/",
-      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
-    { id: "hydrofate", name: "HydroFATE map", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
-      page: "https://hydrofate.org/map/",
-      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
     { id: "bocc", name: "Banking on Climate Chaos", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
       page: "https://www.bankingonclimatechaos.org/?bank=JPMorgan%20Chase#fulldata-panel",
       note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
@@ -6875,6 +6871,7 @@ const LAYER_KIND = {
   counterglow: ["animal", "downstream"],
   epa_tri: ["insentient", "downstream"],
   epa_tri_sites: ["insentient", "downstream"],
+  hydrowaste: ["insentient", "downstream"],
   gfw: ["plant", "downstream"],
   gfw_dist: ["plant", "downstream"],
   gfw_dist_year: ["plant", "downstream"],
@@ -6948,8 +6945,6 @@ const LAYER_KIND = {
   bffp_audit: ["insentient", "upstream"],
   gpw_map: ["insentient", "downstream"],
   epa_widget: ["insentient", "downstream"],
-  eip_inventory: ["insentient", "downstream"],
-  hydrofate: ["insentient", "downstream"],
   bocc: ["human", "upstream"],
   dff: ["plant", "upstream"],
   fortune500: ["human", "upstream"],
@@ -7451,7 +7446,7 @@ const PANEL_ORDER = [
     "usda_soybean", "usda_corn", "wastewater", "group:ct_history",
   { h: 4, t: "National shading" }, "owid_co2",
   { h: 4, t: "Air pollution" }, "ct_air", "ct_pop",
-  { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget", "eip_inventory", "hydrofate",
+  { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget", "hydrowaste",
   { h: 4, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
   { h: 3, t: "Deforestation" }, "gfw", "gfw_dist", "gfw_dist_year", "glad_loss", "palmwatch", "soilgrids", "trase_measures", "trase_facilities", "nusantara", "gfw_catalogue", "gsn", "gsn_rankings",
   { h: 3, t: "Biodiversity loss" }, "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report",
diff --git a/map/test.mjs b/map/test.mjs
index c9f9d4e..7f9bc4d 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2127,5 +2127,12 @@ console.log("\nGuerillamap panel, Pollution, the releases split");
         kids.every((k) => o.PANEL_ORDER.includes(k) && new RegExp(`id:"${k}", sourceOf:"gmo_releases"`).test(src)));
 }
 
+console.log("\nHydroWASTE on the map; the EIP and HydroFATE page rows gone");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("HydroWASTE's plants are drawn from their own archive", /id:"hydrowaste", +name:"Wastewater treatment plants \(HydroWASTE\)"[^\n]*route:"pmtiles"/.test(src) && fs.existsSync(path.join(HERE, "tiles", "hydrowaste.pmtiles")));
+  check("the Environmental Integrity Project and HydroFATE page rows are gone", !/id: "eip_inventory"/.test(src) && !/id: "hydrofate"/.test(src));
+}
+
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
'''

with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False, encoding="utf-8") as f:
    f.write(DIFF)
chk = subprocess.run(["git", "apply", "--check", f.name], cwd=ROOT, capture_output=True, text=True)
if chk.returncode:
    sys.exit("The files differ from the copy this was made for. Run git pull first. Nothing was written. " + chk.stderr)
subprocess.run(["git", "apply", f.name], cwd=ROOT, check=True)
print("Done. Test with: node map/test.mjs")
