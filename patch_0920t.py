#!/usr/bin/env python3
"""patch_0920t.py - nothing in the box is named for who published it.

    cd ~/Desktop/culprits
    python3 patch_0920t.py

Goes on top of 2367442.

You were right that I had only half-done this. The headings were by subject but
the group rows were still named for their sources, which reads the same way to
anyone opening the box. Every one is now named for what it holds:

  Climate TRACE - emitting assets            Emitting sites, by sector
  Climate TRACE - agriculture                Emissions from farming and land use
  Climate TRACE - forestry and land use      Emissions from forestry and land clearing
  Historical                                 Emitting sites in past years
  Live deforestation and disturbance
    alerts (Global Forest Watch)             Trees and plant cover lost, as it happens
  Trase deforestation data                   Deforestation and supply chains
  The site's own maps                        Maps made for this site
  More from the map repos                    Further rows from the same records
  Other organisations' maps                  Maps made by others
  Executive accountability map               Government offices and services
  Money and financial accountability map     Banks, tax offices and financial services
  Legal defense and prisoner support map     Legal defence and prisoner support
  Legislative accountability map             Parliaments, councils and electoral offices
  Judicial accountability map                Courts and prisons
  Genetic engineering map                    Genetic engineering registers

Who published a row still belongs on the row - in its title and in the arrow
that opens their site - so nothing about provenance is lost. A test now fails
the suite if any group or heading takes an organisation's name again.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 218699f..a7bf80a 100644
--- a/map/app.js
+++ b/map/app.js
@@ -132,7 +132,7 @@ function ctChild(id, label, base) {
 
 const CT_SECTORS = {
   id: "climate_trace_sectors",
-  name: "Climate TRACE — emitting assets",
+  name: "Emitting sites, by sector",
   group: true,
   ready: true,
   children: [
@@ -147,7 +147,7 @@ const CT_SECTORS = {
 
 const CT_AGRICULTURE = {
   id: "climate_trace_agriculture",
-  name: "Climate TRACE — agriculture",
+  name: "Emissions from farming and land use",
   group: true,
   ready: true,
   children: [
@@ -165,7 +165,7 @@ const CT_AGRICULTURE = {
 
 const CT_FORESTRY = {
   id: "climate_trace_forestry",
-  name: "Climate TRACE — forestry and land use",
+  name: "Emissions from forestry and land clearing",
   group: true,
   ready: true,
   children: [
@@ -185,7 +185,7 @@ const CT_FORESTRY = {
 
 const CT_HISTORY = {
   id: "ct_history",
-  name: "Historical",
+  name: "Emitting sites in past years",
   group: true,
   ready: true,
   children: CT_HISTORY_YEARS.map((y) => ({
@@ -7086,7 +7086,7 @@ function syncGroupBox(box, group) {
 // popup text are read from each map by pipeline/sitemaps/extract.mjs.
 const SITE_MAPS = {
   id: "site_maps",
-  name: "The site's own maps",
+  name: "Maps made for this site",
   group: true,
   ready: true,
   children: [
@@ -7179,7 +7179,7 @@ const SITE_MAPS = {
 // Generated from pipeline/sitemaps/repo_layers.json by patch_repo_layers.py.
 const EXEC_MAP = {
   id: "executive_map_layers",
-  name: "Executive accountability map",
+  name: "Government offices and services",
   group: true,
   ready: true,
   children: [
@@ -7204,7 +7204,7 @@ const EXEC_MAP = {
 
 const MONEY_MAP = {
   id: "money_map_layers",
-  name: "Money and financial accountability map",
+  name: "Banks, tax offices and financial services",
   group: true,
   ready: true,
   children: [
@@ -7239,7 +7239,7 @@ const MONEY_MAP = {
 
 const LEGAL_MAP = {
   id: "legal_map_layers",
-  name: "Legal defense and prisoner support map",
+  name: "Legal defence and prisoner support",
   group: true,
   ready: true,
   children: [
@@ -7264,7 +7264,7 @@ const LEGAL_MAP = {
 
 const LEG_MAP = {
   id: "legislative_map_layers",
-  name: "Legislative accountability map",
+  name: "Parliaments, councils and electoral offices",
   group: true,
   ready: true,
   children: [
@@ -7297,7 +7297,7 @@ const LEG_MAP = {
 
 const JUD_MAP = {
   id: "judicial_map_layers",
-  name: "Judicial accountability map",
+  name: "Courts and prisons",
   group: true,
   ready: true,
   children: [
@@ -7312,7 +7312,7 @@ const JUD_MAP = {
 
 const MORE_MAPS = {
   id: "more_map_layers",
-  name: "More from the map repos",
+  name: "Further rows from the same records",
   group: true,
   ready: true,
   children: [
@@ -7345,7 +7345,7 @@ const MORE_MAPS = {
 
 const GMO_MAP = {
   id: "gmo_map_layers",
-  name: "Genetic engineering map",
+  name: "Genetic engineering registers",
   group: true,
   ready: true,
   children: [
@@ -7366,7 +7366,7 @@ const GMO_MAP = {
 
 const OTHER_MAPS = {
   id: "other_org_maps",
-  name: "Other organisations' maps",
+  name: "Maps made by others",
   group: true,
   ready: true,
   children: [
@@ -7626,7 +7626,7 @@ const OTHER_MAPS = {
 // names the system that made it.
 const FOREST_ALERTS = {
   id: "forest_alerts",
-  name: "Live deforestation and disturbance alerts (Global Forest Watch)",
+  name: "Trees and plant cover lost, as it happens",
   group: true,
   ready: true,
   children: [
@@ -7657,7 +7657,7 @@ const FOREST_ALERTS = {
 };
 const TRASE_DATA = {
   id: "trase_data",
-  name: "Trase deforestation data",
+  name: "Deforestation and supply chains",
   group: true,
   ready: true,
   children: [
diff --git a/map/test.mjs b/map/test.mjs
index d45cc22..c447b25 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2222,9 +2222,9 @@ console.log("\nrows gathered, moved and renamed");
         /name: "Every US site EPA holds a record for, across all its programs \(EPA Envirofacts\)"/.test(src));
   check("HydroWASTE sits under Wastewater", at("Wastewater") > at("Pollution") && order.indexOf("hydrowaste") === at("Wastewater") + 1);
   check("PalmWatch sits under Agriculture", order.indexOf("palmwatch") > at("Agriculture") && order.indexOf("palmwatch") < at("Meat"));
-  check("the three alert layers are one row, and each line names the system that saw it",
+  check("the three alert layers are one row, named for what it shows, each line naming the system that saw it",
         /const FOREST_ALERTS = \{[\s\S]{0,4000}id:"gfw_dist_year"/.test(src) &&
-        /name: "Live deforestation and disturbance alerts \(Global Forest Watch\)"/.test(src) &&
+        /name: "Trees and plant cover lost, as it happens"/.test(src) &&
         /GLAD-L, GLAD-S2 and RADD/.test(src) && (src.match(/DIST-ALERT/g) || []).length >= 2 &&
         ["gfw", "gfw_dist", "gfw_dist_year"].every((i) => !order.includes(i)));
   check("Global Forest Change is drawn above the alerts", order.indexOf("glad_loss") < order.indexOf("group:forest_alerts"));
@@ -2688,6 +2688,21 @@ console.log("\na row's own filters read as groups, not a wall of chips");
         /#layers \.facet-set \.sm-legend\{margin-top:5px\}/.test(index));
 }
 
+console.log("\nnothing in the box is named for who published it");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const groups = [...src.matchAll(/\n  name: "([^"]+)",\n  group: true/g)].map((m) => m[1]);
+  check("every group is named for its subject", groups.length > 8 &&
+        !groups.some((n) => /(climate trace|global forest watch|nusantara|trase|the site's own|map repos|organisations'|accountability map|engineering map)/i.test(n)));
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED"));
+  const order = new Function(body + "; return PANEL_ORDER;")();
+  check("and so is every heading",
+        !order.some((x) => x && x.t && /(climate trace|global forest watch|nusantara|trase|palmwatch|skytruth)/i.test(x.t)));
+  check("the groups say what they hold",
+        groups.includes("Emitting sites, by sector") && groups.includes("Emissions from farming and land use") &&
+        groups.includes("Trees and plant cover lost, as it happens") && groups.includes("Maps made by others"));
+}
+
 console.log("\nGlobal Safety Net fixes; My Maps titles");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
"""


def run(args, text=None):
    return subprocess.run(args, input=text, capture_output=True, text=True)


def main():
    if run(["git", "rev-parse", "--is-inside-work-tree"]).returncode != 0:
        sys.exit("Not a git repository. Run this from ~/Desktop/culprits.")
    try:
        app = open("map/app.js", encoding="utf-8").read()
    except OSError:
        sys.exit("map/app.js not found. Run this from the top of the repo.")
    if "facet-set" not in app:
        sys.exit("patch_0920s.py has to be applied and committed first.")
    if run(["git", "apply", "--check", "--reverse", "-"], DIFF).returncode == 0:
        print("Already applied - nothing to do.")
        return
    check = run(["git", "apply", "--check", "-"], DIFF)
    if check.returncode != 0:
        print(check.stderr.strip())
        sys.exit("Does not apply cleanly.")
    out = run(["git", "apply", "-"], DIFF)
    if out.returncode != 0:
        print(out.stderr.strip())
        sys.exit("git apply failed.")
    print("Applied. Changed: map/app.js, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
