#!/usr/bin/env python3
"""
Guerillamap opens as a bottom panel like the other outside pages, with a drag
strip; Plastics under a Pollution heading; Genetic-engineering releases split
into its registers, each its own row. Run from the culprits folder, after git pull:

    python3 patch_0925.py

then:  node map/test.mjs
"""
import pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
app_path = ROOT / "map" / "app.js"
if not app_path.exists():
    sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits). Nothing was written.")
app = app_path.read_text(encoding="utf-8")
if 'id:"gmo_fertility"' in app:
    sys.exit("Already applied - nothing to do.")
if "PICK_SPLIT_ZOOM" not in app:
    sys.exit("Run git pull first. Nothing was written.")
DIFF = r'''diff --git a/map/app.js b/map/app.js
index 9a28fc8..4d28142 100644
--- a/map/app.js
+++ b/map/app.js
@@ -353,6 +353,25 @@ const LAYERS = [
                       "CBD Biosafety Clearing-House","clinical trial sponsor",
                       "Australia OGTR"] },
     note: "96% of these records carry no site coordinate. APHIS publishes the state a release was authorised in and never the field, so most draw hollow at a state centroid." },
+  // The releases archive holds several different registers; each is its own
+  // row here, drawn from the same archive with its own filter.
+  { id:"gmo_env", sourceOf:"gmo_releases", name:"Engineered crops and trees released outdoors (US APHIS)", unit:"authorisations", colour:"#7C6F84", route:"pmtiles", ready:true, off: true,
+    where: ["in", ["get", "id"], ["literal", ["aphis:epermits", "aphis:efile"]]],
+    note: "US Department of Agriculture authorisations to release genetically engineered plants and trees into the environment. APHIS publishes the state, not the field, so most draw hollow at a state's centre." },
+  { id:"gmo_decisions", sourceOf:"gmo_releases", name:"National biosafety decisions (CBD Biosafety Clearing-House)", unit:"decisions", colour:"#6F6A84", route:"pmtiles", ready:true, off: true,
+    where: ["==", ["get", "id"], "bch:decision"] },
+  { id:"gmo_ogtr", sourceOf:"gmo_releases", name:"Gene technology licences (Australia OGTR)", unit:"licences", colour:"#84707A", route:"pmtiles", ready:true, off: true,
+    where: ["==", ["slice", ["get", "id"], 0, 4], "ogtr"] },
+  { id:"gmo_therapy", sourceOf:"gmo_releases", name:"Gene and cell therapy trial sponsors", unit:"sponsors", colour:"#6E7484", route:"pmtiles", ready:true, off: true,
+    where: ["==", ["get", "id"], "clinical:sponsor"] },
+  { id:"gmo_fertility", sourceOf:"gmo_releases", name:"Fertility clinics", unit:"clinics", colour:"#846F74", route:"pmtiles", ready:true, off: true,
+    where: ["==", ["get", "id"], "industry:repro"] },
+  { id:"gmo_animal_research", sourceOf:"gmo_releases", name:"Animal research facilities", unit:"facilities", colour:"#7A6A6A", route:"pmtiles", ready:true, off: true,
+    where: ["all", ["==", ["get", "id"], "industry:animals"],
+            ["in", ["get", "x_type"], ["literal", ["Animal Welfare Act research facility", "Accredited animal research organisation", "CCAC certified institution"]]]] },
+  { id:"gmo_animal_trade", sourceOf:"gmo_releases", name:"Animal breeders, dealers, exhibitors and carriers (USDA Animal Welfare Act)", unit:"licensees", colour:"#74695E", route:"pmtiles", ready:true, off: true,
+    where: ["all", ["==", ["get", "id"], "industry:animals"],
+            ["!", ["in", ["get", "x_type"], ["literal", ["Animal Welfare Act research facility", "Accredited animal research organisation", "CCAC certified institution"]]]]] },
   { id:"slavery_sites",        name:"Brick kilns and artisanal mining", unit:"sites", colour:"#8A6B62", route:"pmtiles", ready:true, off: true,
     note: "Sector infrastructure, not confirmed exploitation. These are sites in sectors where forced and child labour concentrate; where IPIS actually observed it, the site says so." },
   { id:"slavery_ports",        name:"Ports with high-risk vessel calls", unit:"ports", colour:"#5F7480", route:"pmtiles", ready:true, off: true,
@@ -1048,8 +1067,7 @@ const HUD_KIND = {
   // [top section, heading under it] -> [shape, glow]; "*" is any heading.
   "On-planet invasion|*": ["chevron", "cyan"],
   "Destruction|Climate": ["hexagon", "amber"],
-  "Destruction|Toxic pollution": ["triangle", "red"],
-  "Destruction|Plastics": ["square", "white"],
+  "Destruction|Pollution": ["triangle", "red"],
   "Destruction|Deforestation": ["diamond", "red"],
   "Destruction|Biodiversity loss": ["diamond", "red"],
   "Destruction|Mining": ["cross", "amber"],
@@ -7352,7 +7370,6 @@ function gmSetOpen(open) {
   if (!el || !canvas) return;
   gmOpen = open;
   el.hidden = !open;
-  canvas.classList.toggle("gm-open", open);
   // The container changed size, so MapLibre has to re-measure or the canvas
   // keeps the old dimensions and the mouse lands in the wrong place.
   if (typeof map.resize === "function") map.resize();
@@ -7361,7 +7378,32 @@ function gmSetOpen(open) {
 
 function gmInit() {
   const close = document.getElementById("gmClose");
-  if (close) close.addEventListener("click", () => gmSetOpen(false));
+  if (close) close.addEventListener("click", () => {
+    const cb = document.querySelector("[data-gm]");
+    if (cb) cb.checked = false;
+    gmSetOpen(false);
+    if (typeof buildLegend === "function") buildLegend();
+  });
+  // The strip and the bar size the panel, as on the other outside pages.
+  const panel = document.getElementById("gm"), frame = document.getElementById("gmFrame");
+  let drag = null;
+  const grabbers = panel ? [panel.querySelector(".gm-grab"), panel.querySelector(".gm-bar")].filter(Boolean) : [];
+  grabbers.forEach((g) => {
+    g.addEventListener("pointerdown", (e) => {
+      if (e.target.closest && e.target.closest("button, a, input, label")) return;
+      drag = { y: e.clientY, h: panel.getBoundingClientRect().height };
+      if (frame) frame.style.pointerEvents = "none";
+      if (g.setPointerCapture) g.setPointerCapture(e.pointerId);
+      e.preventDefault();
+    });
+    g.addEventListener("pointermove", (e) => {
+      if (!drag) return;
+      panel.style.height = `${Math.round(Math.max(90, Math.min(window.innerHeight - 40, drag.h + (drag.y - e.clientY))))}px`;
+    });
+    const end = () => { if (drag) { drag = null; if (frame) frame.style.pointerEvents = ""; } };
+    g.addEventListener("pointerup", end);
+    g.addEventListener("pointercancel", end);
+  });
   const follow = document.getElementById("gmFollow");
   if (follow) follow.addEventListener("change", () => gmSync(true));
 
@@ -7395,7 +7437,7 @@ map.on("load", () => setTimeout(abattoirPartsInit, 0));
 // PANEL_REMOVED are taken out of the box.
 const PANEL_ORDER = [
   { h: 1, t: "On-planet invasion" },
-  { h: 2, t: "Pre-birth frontlines" }, "gmo_releases", "gmo_cultivation", "gmo_gmofree", "gmo_incidents", "gmo_regime", "gmo_treaties", "gmo_trials",
+  { h: 2, t: "Pre-birth frontlines" }, "gmo_env", "gmo_decisions", "gmo_ogtr", "gmo_therapy", "gmo_fertility", "gmo_animal_research", "gmo_animal_trade", "gmo_cultivation", "gmo_gmofree", "gmo_incidents", "gmo_regime", "gmo_treaties", "gmo_trials",
   { h: 2, t: "Post-birth invasion" },
   { h: 3, t: "Invasion of nonhumans" },
   { h: 3, t: "Invasion of humans" }, "site_settler_colonialism", "site_indigenous_conflicts",
@@ -7409,8 +7451,8 @@ const PANEL_ORDER = [
     "usda_soybean", "usda_corn", "wastewater", "group:ct_history",
   { h: 4, t: "National shading" }, "owid_co2",
   { h: 4, t: "Air pollution" }, "ct_air", "ct_pop",
-  { h: 3, t: "Toxic pollution" }, "epa_tri_sites", "epa_widget", "eip_inventory", "hydrofate",
-  { h: 3, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
+  { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget", "eip_inventory", "hydrofate",
+  { h: 4, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
   { h: 3, t: "Deforestation" }, "gfw", "gfw_dist", "gfw_dist_year", "glad_loss", "palmwatch", "soilgrids", "trase_measures", "trase_facilities", "nusantara", "gfw_catalogue", "gsn", "gsn_rankings",
   { h: 3, t: "Biodiversity loss" }, "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report",
   { h: 3, t: "Mining" }, "mines_global",
@@ -7486,6 +7528,8 @@ const PANEL_REMOVED = new Set([
   // merged into another, and pages asked to be removed.
   "site_cartel_cells", "site_export_credit_shading", "giga_schools", "nsf_locations",
   "ect_secrets", "isds_tracker", "bffp_audit", "epa_tri", "unep_coral",
+  // Split into its registers (gmo_env and the rows after it) on 20 September.
+  "gmo_releases",
   "fin_bank", "fin_centralbank", "fin_taxoffice", "fin_govfinance", "fin_financial", "fin_exchange", "fin_insurance", "fin_accountant", "fin_remittance", "fin_stockexchange", "fin_auditoffice", "fin_devbank", "fin_mint", "legal_publicdefender", "legal_immigration", "legal_probation", "legal_juvenile", "leg_parliament", "leg_audit", "leg_electoral", "leg_ombudsman", "leg_council", "exec_firestation", "exec_townhall", "leg_townhall", "exec_govoffice", "exec_ministry", "exec_diplomatic", "exec_border", "jud_courts", "legal_courthouse", "slavery_facilities", "activist_courts", "exec_police", "legal_police", "activist_police", "exec_prison", "legal_prison", "jud_prisons", "activist_prisons",
   "site_ufo_pre1900", "site_subsistence_cultures", "site_self_sufficiency", "slavery_trackers",
   "site_environment_law", "enviro_law_by_country", "site_environment_law_shapes", "gov_official_map",
diff --git a/map/index.html b/map/index.html
index ba7f63b..d2d47d0 100644
--- a/map/index.html
+++ b/map/index.html
@@ -203,22 +203,23 @@
   .layer.child{padding-left:13px}
   .layer.child .nm{color:var(--dim)}
 
-  .gm{position:absolute;right:0;bottom:0;left:0;height:38vh;background:var(--peat);
-    border-top:1px solid var(--rule);display:flex;flex-direction:column}
+  /* Guerillamap opens like every other outside page: a panel along the bottom,
+     over the map, with a strip and bar to drag it taller or shorter. */
+  .gm{position:fixed;right:0;bottom:0;left:0;height:46vh;z-index:40;background:var(--peat,#17150F);
+      border-top:1px solid var(--rule,#322E27);display:flex;flex-direction:column}
   .gm[hidden]{display:none}
-  .gm-bar{display:flex;align-items:center;gap:11px;padding:7px 12px;
-    font-size:12.5px;color:var(--dim);border-bottom:1px solid var(--rule)}
+  .gm-grab{height:9px;cursor:ns-resize;touch-action:none;display:flex;justify-content:center;align-items:center}
+  .gm-grab span{width:44px;height:3px;border-radius:2px;background:var(--rule,#322E27)}
+  .gm-bar{display:flex;align-items:center;gap:11px;padding:2px 12px 6px;font-size:12.5px;color:var(--dim);cursor:ns-resize;touch-action:none}
   .gm-bar .nm{color:var(--bone)}
   .gm-bar label{display:flex;align-items:center;gap:5px;cursor:pointer}
   .gm-bar input{accent-color:var(--moss)}
-  .gm-bar a{color:var(--slate)}
+  .gm-bar a{color:var(--slate,#8A9DA6)}
   .gm-bar .sp{margin-left:auto}
-  .gm-bar button{font:inherit;font-size:12.5px;background:none;color:var(--dim);
-    border:1px solid var(--rule);padding:1px 7px;cursor:pointer;border-radius:2px}
+  .gm-bar button{font:inherit;background:none;color:var(--dim);border:1px solid var(--rule);border-radius:2px;padding:1px 7px;cursor:pointer}
   .gm-bar button:hover{color:var(--bone);border-color:var(--dim)}
   .gm-frame{flex:1;width:100%;border:0}
   .gm-wait{margin:0;padding:7px 12px;font-size:12px;color:var(--dim)}
-  #map.gm-open{bottom:38vh;inset-block-end:38vh}
 
   /* Legend. Bottom right, above the attribution, narrow enough not to cover
      the map. Lists only what is switched on. */
@@ -327,6 +328,7 @@
 <div id="legend" hidden></div>
 
 <div class="gm" id="gm" hidden>
+  <div class="gm-grab" title="Drag up or down to resize"><span></span></div>
   <div class="gm-bar">
     <span class="nm">Guerillamap overlays</span>
     <label><input type="checkbox" id="gmFollow" checked> follow this map</label>
diff --git a/map/test.mjs b/map/test.mjs
index 20dae59..c9f9d4e 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2113,5 +2113,19 @@ console.log("\nfull shape words; place lists only where markers overlap");
   check("close in, a click opens the nearest place instead of a list", /const PICK_SPLIT_ZOOM = 6;/.test(src) && /map\.getZoom\(\) >= PICK_SPLIT_ZOOM/.test(src));
 }
 
+console.log("\nGuerillamap panel, Pollution, the releases split");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
+  const at = (t) => o.PANEL_ORDER.findIndex((x) => x && x.t === t);
+  check("Guerillamap opens as a bottom panel with a drag strip, over the map", /\.gm\{position:fixed;right:0;bottom:0;left:0;height:46vh;z-index:40/.test(index) && /class="gm-grab"/.test(index) && !/#map\.gm-open/.test(index));
+  check("Plastics sits under Pollution", at("Pollution") > 0 && o.PANEL_ORDER[at("Plastics")].h === 4 && at("Plastics") > at("Pollution") && at("Toxic pollution") === -1);
+  const kids = ["gmo_env", "gmo_decisions", "gmo_ogtr", "gmo_therapy", "gmo_fertility", "gmo_animal_research", "gmo_animal_trade"];
+  check("the releases layer is split into its registers, each its own row", o.PANEL_REMOVED.has("gmo_releases") &&
+        kids.every((k) => o.PANEL_ORDER.includes(k) && new RegExp(`id:"${k}", sourceOf:"gmo_releases"`).test(src)));
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
