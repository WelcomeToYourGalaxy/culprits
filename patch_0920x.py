#!/usr/bin/env python3
"""
patch_0920x.py - SkyTruth Monitor's nine alert feeds as rows.

  - Nine rows, one per feed, each read from its own daily copy in
    culprits-tiles-more (upload the new scripts/skytruth.py there and run it,
    or the rows will say their file is missing).
  - Filed by subject; a new heading, "Oil and gas drilling", after Mining.
  - The Vessels of concern row no longer says "last 30 days": the service
    never applied the days it was asked for.

Needs patch_0920w.py applied and committed first.
Run from the repo folder:  python3 patch_0920x.py
"""
import pathlib, subprocess, sys

DIFF = r"""diff --git a/HANDOFF.md b/HANDOFF.md
index 358f513..d828b77 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -242,6 +242,43 @@ as before, so nothing breaks while the tiling catches up.
 
 ---
 
+## SkyTruth Monitor's alert feeds
+
+The feeds are numbered. Asking the service for feeds 1 to 30 and 10095 to 10110
+(20 September) found nine with alerts - 1, 2, 3, 4, 5, 6, 8, 9, 10 - plus 10101,
+a developer's test entries ("This is dan's house"), left out, and 10102, Vessels
+of concern. Each of the nine is a `geojsonlive` row reading
+`culprits-tiles-more/skytruth/feed_<n>.geojson`, filed by subject: National
+Response Center reports under Terrestrial slicks and Pollution; SkyTruth's own
+write-ups under both slick headings; responders' marine reports under Marine
+slicks; Pennsylvania permits, drilling starts and violations, the county well
+permits and FracFocus under a new heading, **Oil and gas drilling**; earthquakes
+under Base and reference.
+
+Two things about the service, both found the hard way:
+
+- It returns **the 100 newest alerts for the area asked, never more**, whatever
+  `n` says. `scripts/skytruth.py` therefore asks area by area - the world, then
+  the four quarters of any area that came back full, six levels down - and
+  writes any square still full at the bottom into `skytruth/feeds.json`.
+- It **does not apply `d` (days)**. The Vessels row said "last 30 days" and
+  never was; it holds ships from 2019. The row now says what it is.
+
+Each run adds to the file already there, matched on SkyTruth's own alert id, so
+nothing gathered is lost when it drops out of the newest 100. An active feed's
+file will grow (the National Response Center takes roughly 70 reports a day);
+past about 20 MB it should move to tiles, as the slick archive did. Alert text
+is SkyTruth's HTML and is cut down to plain formatting and http links before it
+is kept (`clean_html`): feed 10101 shows anyone with an account can write one.
+
+Several feeds look dormant - the newest seen were July 2015 (earthquakes),
+December 2011 (county well permits), 2013-14 (SkyTruth's write-ups, marine
+reports). `feeds.json` records each feed's oldest and newest after every run.
+
+Test 1773 used to forbid naming a layer twice in `PANEL_ORDER`; the box has
+made the second naming a copy for some time (`copyRow`), so the test now checks
+that instead.
+
 ## The catalogues were never being read
 
 Nusantara's and Global Forest Watch's layers became rows of the box, and their
diff --git a/map/app.js b/map/app.js
index 736b6e9..b34e797 100644
--- a/map/app.js
+++ b/map/app.js
@@ -7693,9 +7693,39 @@ const OTHER_MAPS = {
     { id: "skytruth_monitor", name: "SkyTruth Monitor", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
       page: "https://monitor.skytruth.org/",
       note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
-    { id: "skytruth_voc", name: "SkyTruth Monitor: vessels of concern", unit: "alerts, last 30 days", colour: "#5E7377", route: "geojsonlive", ready: true, lazy: true,
+    // It said "last 30 days". It never was: SkyTruth's service does not apply the
+    // days it is asked for, and the copy holds ships from 2019 and 2024.
+    { id: "skytruth_voc", name: "SkyTruth Monitor: vessels of concern", unit: "alerts", colour: "#5E7377", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Vessels of concern", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/vessels_of_concern.geojson" }],
-      note: "SkyTruth Monitor's vessels-of-concern alerts for the whole world over the last 30 days, from a daily copy of its own service." },
+      note: "SkyTruth's own list of disabled and sunken ships that threaten a spill, every one it lists whatever its date, from a daily copy of its service." },
+    // SkyTruth Monitor's alert feeds, one row each, from the same daily copy.
+    { id: "skytruth_nrc", name: "Spills, releases and rail incidents reported to the US National Response Center (SkyTruth Monitor)", unit: "incident reports", colour: "#6A5A4E", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Incident reports", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_1.geojson" }],
+      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Each report as the National Response Center took it down, with SkyTruth's own reading of it where it made one. Reports are what a caller said, not findings." },
+    { id: "skytruth_posts", name: "Spills and accidents written up by SkyTruth itself \u2014 Taylor Energy, derailments, refuge spills (SkyTruth Monitor)", unit: "write-ups", colour: "#5E6B70", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Write-ups", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_2.geojson" }],
+      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. SkyTruth's own posts about incidents it followed, placed where each happened." },
+    { id: "skytruth_marine_incidents", name: "Sinkings, groundings and mystery slicks, as US responders wrote them up (SkyTruth Monitor)", unit: "incident reports", colour: "#5A6772", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Incident reports", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_3.geojson" }],
+      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Incident reports in the words of the responders, NOAA's and the Coast Guard's among them." },
+    { id: "skytruth_pa_permits", name: "Oil and gas drilling permits issued, Pennsylvania (SkyTruth Monitor)", unit: "permits", colour: "#6E6A55", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Permits", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_4.geojson" }],
+      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Each permit as Pennsylvania issued it: well type, operator, site, township." },
+    { id: "skytruth_pa_spud", name: "Oil and gas wells where drilling has started, Pennsylvania (SkyTruth Monitor)", unit: "drilling starts", colour: "#73664F", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Drilling starts", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_5.geojson" }],
+      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Operators' own reports that drilling began (SPUD reports)." },
+    { id: "skytruth_pa_violations", name: "Violations issued to oil and gas operators, Pennsylvania (SkyTruth Monitor)", unit: "violations", colour: "#7A5B4E", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Violations", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_9.geojson" }],
+      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Each violation as Pennsylvania's inspectors recorded it, with its code." },
+    { id: "skytruth_well_permits", name: "Well plugging and other well permit activity, by county (SkyTruth Monitor)", unit: "permit reports", colour: "#6B6056", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Permit reports", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_8.geojson" }],
+      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Permit activity as operators reported it. The feed does not say which state it covers; the newest report seen on 20 September 2026 was from December 2011." },
+    { id: "skytruth_fracfocus", name: "Gas and oil wells fracked, United States \u2014 operators' FracFocus disclosures (SkyTruth Monitor)", unit: "disclosures", colour: "#6F5F58", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Disclosures", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_10.geojson" }],
+      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. An alert for each disclosure SkyTruth found on FracFocus.org." },
+    { id: "skytruth_quakes", name: "Earthquakes, worldwide (SkyTruth Monitor)", unit: "earthquakes", colour: "#65676A", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Earthquakes", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_6.geojson" }],
+      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. The earthquakes SkyTruth's feed carries; the newest seen on 20 September 2026 was from July 2015." },
     { id: "slick_archive", name: "Oil slick archive (Cerulean, kept daily)", unit: "slicks by month", colour: "#5A5750", route: "slickarchive", ready: true, lazy: true,
       base: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/cerulean_archive",
       note: "Every Cerulean slick kept by month from a daily copy, so they stay on the map whatever happens to the live service." },
@@ -8099,6 +8129,15 @@ const LAYER_KIND = {
   scribd_doc: ["human", "upstream"],
   skytruth_monitor: ["animal", "downstream"],
   skytruth_voc: ["animal", "downstream"],
+  skytruth_nrc: ["animal", "downstream"],
+  skytruth_posts: ["animal", "downstream"],
+  skytruth_marine_incidents: ["animal", "downstream"],
+  skytruth_pa_permits: ["animal", "downstream"],
+  skytruth_pa_spud: ["animal", "downstream"],
+  skytruth_pa_violations: ["animal", "downstream"],
+  skytruth_well_permits: ["animal", "downstream"],
+  skytruth_fracfocus: ["animal", "downstream"],
+  skytruth_quakes: ["insentient", "downstream"],
   wrf: ["insentient", "upstream"],
   nsf_launches: ["insentient", "upstream"],
   nsf_locations: ["insentient", "upstream"],
@@ -8619,6 +8658,15 @@ const LAYER_SITE = {
   seas_of_plastic: "https://app.dumpark.com/seas-of-plastic-2/",
   skytruth_monitor: "https://monitor.skytruth.org/",
   skytruth_voc: "https://monitor.skytruth.org/",
+  skytruth_nrc: "https://monitor.skytruth.org/",
+  skytruth_posts: "https://monitor.skytruth.org/",
+  skytruth_marine_incidents: "https://monitor.skytruth.org/",
+  skytruth_pa_permits: "https://monitor.skytruth.org/",
+  skytruth_pa_spud: "https://monitor.skytruth.org/",
+  skytruth_pa_violations: "https://monitor.skytruth.org/",
+  skytruth_well_permits: "https://monitor.skytruth.org/",
+  skytruth_fracfocus: "https://monitor.skytruth.org/",
+  skytruth_quakes: "https://monitor.skytruth.org/",
   soy_organizations: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/soy_organizations.html",
   tableau_zsf: "https://public.tableau.com/shared/ZSF724HPQ",
   theyrule: "https://theyrule.net/",
@@ -8776,7 +8824,7 @@ const PANEL_ORDER = [
     "usda_soybean", "usda_corn", "wastewater", "group:ct_history",
   { h: 4, t: "National shading" }, "owid_co2",
   { h: 4, t: "Air pollution" }, "ct_air", "ct_pop",
-  { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget",
+  { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget", "skytruth_nrc", "skytruth_pa_violations",
   { h: 4, t: "Wastewater" }, "hydrowaste",
   { h: 4, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
   { h: 3, t: "Fire" },
@@ -8793,14 +8841,15 @@ const PANEL_ORDER = [
   { h: 3, t: "Peatland" },
   { h: 3, t: "Surface water" },
   { h: 3, t: "Mining" }, "mines_global",
+  { h: 3, t: "Oil and gas drilling" }, "skytruth_pa_permits", "skytruth_pa_spud", "skytruth_pa_violations", "skytruth_well_permits", "skytruth_fracfocus",
   { h: 3, t: "Meat and agriculture" },
   { h: 4, t: "Agriculture" }, "land_matrix", "palmwatch", "trase_palm_indonesia", "trase_silos_brazil", "trase_cocoa_ivory",
   { h: 4, t: "Meat" }, "abattoir_facilities", "trase_meat_brazil", "abattoir_cafo", "abattoir_glw", "cultivated_meat_laws",
   { h: 3, t: "Oceans" },
   { h: 4, t: "Fishing" }, "fishing",
   { h: 4, t: "Oil slicks" },
-  { h: 5, t: "Terrestrial slicks" }, "skytruth_monitor",
-  { h: 5, t: "Marine slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc",
+  { h: 5, t: "Terrestrial slicks" }, "skytruth_monitor", "skytruth_nrc", "skytruth_posts",
+  { h: 5, t: "Marine slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc", "skytruth_marine_incidents", "skytruth_posts",
   { h: 3, t: "Construction" }, "local_projects",
   { h: 3, t: "Culprits upstream" }, "ejatlas",
   { h: 4, t: "Emissions" }, "carbon_majors", "soy_organizations", "bocc",
@@ -8866,7 +8915,7 @@ const PANEL_ORDER = [
   { h: 3, t: "Space launches" }, "ll2_pads", "ll2_upcoming",
   { h: 3, t: "Protecting extraterrestrial life" }, "biosignature",
 
-  { h: 1, t: "Base and reference" },
+  { h: 1, t: "Base and reference" }, "skytruth_quakes",
   { h: 1, t: "Buildings" }, "building_types",
 ];
 const PANEL_REMOVED = new Set([
diff --git a/map/test.mjs b/map/test.mjs
index 5a02dfd..37f44d3 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1770,7 +1770,25 @@ console.log("\nthe layers box, in the chosen order");
   const ids = order.PANEL_ORDER.filter((x) => typeof x === "string" && !x.startsWith("group:") && x !== "gm");
   check("every id in the order is a real layer", ids.every((id) => new RegExp(`id: ?"${id}"`).test(src)),
         ids.filter((id) => !new RegExp(`id: ?"${id}"`).test(src)).join(", "));
-  check("no layer is placed twice", new Set(ids).size === ids.length);
+  // Superseded: a layer that belongs to two subjects is named under both, and the
+  // box makes the second naming a copy of the row (copyRow), never a second layer.
+  const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
+  check("a layer named under two headings is one row and a copy of it, never two layers",
+        /if \(placed\.has\(item\)\) \{\n\s*const copy = copyRow\(leads\.get\(item\), item\);/.test(src) &&
+        twice.every((id) => ids.filter((x) => x === id).length === 2), twice.join(", "));
+  {
+    const feeds = ["skytruth_nrc", "skytruth_posts", "skytruth_marine_incidents", "skytruth_pa_permits", "skytruth_pa_spud",
+                   "skytruth_pa_violations", "skytruth_well_permits", "skytruth_fracfocus", "skytruth_quakes"];
+    const at = (t) => order.PANEL_ORDER.findIndex((x) => x && x.t === t);
+    check("SkyTruth Monitor's nine alert feeds are rows, each from its own daily copy",
+          feeds.every((id) => new RegExp(`id: "${id}"[^\\n]*route: "geojsonlive"`).test(src) && ids.includes(id)) &&
+          (src.match(/culprits-tiles-more\/skytruth\/feed_\d+\.geojson/g) || []).length === 9);
+    check("\u2026filed by what they show: spill reports under slicks and pollution, drilling under its own heading",
+          at("Oil and gas drilling") > at("Mining") && order.PANEL_ORDER.indexOf("skytruth_fracfocus") > at("Oil and gas drilling") &&
+          ids.filter((x) => x === "skytruth_nrc").length === 2 && ids.filter((x) => x === "skytruth_pa_violations").length === 2);
+    check("\u2026and the vessels row no longer claims the last 30 days, which the service never applied",
+          !/id: "skytruth_voc"[^\n]*last 30 days/.test(src) && !/vessels-of-concern alerts for the whole world over the last 30 days/.test(src));
+  }
   check("nothing is both placed and removed", ids.every((id) => !order.PANEL_REMOVED.has(id)));
   const heads = order.PANEL_ORDER.filter((x) => typeof x === "object" && x.h === 1).map((x) => x.t);
   check("the four sections come first, in order", heads.slice(0, 4).join("|") === "On-planet invasion|Destruction|Suppression|Off-planet invasion");
"""


def run(cmd, text=None):
    return subprocess.run(cmd, input=text, text=True, capture_output=True)


def main():
    if not pathlib.Path("map/app.js").exists():
        sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits).")
    app = pathlib.Path("map/app.js").read_text(encoding="utf-8")
    if "function readCataloguesAtStart" not in app:
        sys.exit("patch_0920w.py has to be applied and committed first.")
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
    print("Applied. Changed: map/app.js, map/test.mjs, HANDOFF.md")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
