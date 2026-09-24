#!/usr/bin/env python3
"""
patch_0920y.py - nothing SkyTruth publishes is left out.

  - The developers' test feed (10101) is a row too, titled for what it is.
  - An alert with no position is counted on its row instead of passed over.
  - The rows' notes say what the daily copy now does: every alert, the back
    history fetched over several days.

Goes with the new scripts/skytruth.py in culprits-tiles-more.
Needs patch_0920x.py applied and committed first.
Run from the repo folder:  python3 patch_0920y.py
"""
import pathlib, subprocess, sys

DIFF = r"""diff --git a/HANDOFF.md b/HANDOFF.md
index d828b77..e2ac0ab 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -279,6 +279,33 @@ Test 1773 used to forbid naming a layer twice in `PANEL_ORDER`; the box has
 made the second naming a copy for some time (`copyRow`), so the test now checks
 that instead.
 
+### Nothing excluded (asked for the same day)
+
+The owner asked that nothing SkyTruth publishes be left out, all four things the
+first version dropped:
+
+1. **The back history.** No depth limit now: a full area is quartered until it
+   is not full, down to a square the size of a building. A busy feed needs
+   thousands of requests, so each run spends at most 600 per feed
+   (`SKYTRUTH_REQUESTS` changes it): first what is new, stopping at any full
+   area whose 100 alerts are all in the copy already; then history, from the
+   areas left waiting in `feeds.json` (`todo`). `history_complete` says when a
+   feed is done. On the 1st of each month the walk skips the shortcut, in case
+   an alert was added late under an old date.
+   **What still cannot be reached:** more than 100 alerts at the very same
+   point (reports pinned to a town's centre). `feeds.json` lists them as
+   `stacked`. Only a date option on the service would reach them; none found.
+   **Size:** at 60 MB a feed's history pauses (new alerts still added) and the
+   log says the feed needs tiles. Expect that for the National Response Center.
+2. **Feed 10101**, the developers' test entries, is a row (`skytruth_tests`,
+   under Base and reference), titled for what it is.
+3. **Alerts with no position** stay in the file with no geometry;
+   `readGeojsonFiles` counts them and the row says how many.
+4. **Pictures** in an alert's text are shown, with only their address kept.
+   The one thing still cut is `ga.php`, an invisible 1-pixel counter that
+   reports each reader of the map to SkyTruth's analytics - not a picture and
+   not data. The untouched text is in each alert's `content`.
+
 ## The catalogues were never being read
 
 Nusantara's and Global Forest Watch's layers became rows of the box, and their
diff --git a/map/app.js b/map/app.js
index b34e797..9404260 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3348,11 +3348,15 @@ function recordsAsFeatures(rows) {
 }
 async function readGeojsonFiles(cfg) {
   const items = [];
+  let nowhere = 0;
   for (const f of cfg.files) {
     const got = await getJson(f.url, 60000);
     const gj = Array.isArray(got) ? { features: recordsAsFeatures(got) }
       : (got && !got.features && Array.isArray(got.entries)) ? { features: recordsAsFeatures(got.entries) } : got;
     (gj.features || []).forEach((ft, i) => {
+      // A record the source gives no position cannot be drawn. It is still in
+      // the file; the row says how many there are rather than passing over them.
+      if (!ft.geometry) { nowhere++; return; }
       const p = ft.properties || {};
       // Which field names the place, where a file's own first choice would be
       // the wrong one: the wire's "name" is the outlet, and a list of forty
@@ -3365,7 +3369,8 @@ async function readGeojsonFiles(cfg) {
           : boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(name)}</h4><table>${fieldRows(p)}</table></div>` });
     });
   }
-  return { title: cfg.name, items };
+  return { title: cfg.name, items,
+    note: nowhere ? `${nowhere.toLocaleString()} more in the file have no position and cannot be drawn` : "" };
 }
 
 // WP Go Maps (Final Nail): its markers as published.
@@ -7701,31 +7706,34 @@ const OTHER_MAPS = {
     // SkyTruth Monitor's alert feeds, one row each, from the same daily copy.
     { id: "skytruth_nrc", name: "Spills, releases and rail incidents reported to the US National Response Center (SkyTruth Monitor)", unit: "incident reports", colour: "#6A5A4E", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Incident reports", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_1.geojson" }],
-      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Each report as the National Response Center took it down, with SkyTruth's own reading of it where it made one. Reports are what a caller said, not findings." },
+      note: "Every alert SkyTruth's service will give, from a daily copy: it hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. Each report as the National Response Center took it down, with SkyTruth's own reading of it where it made one. Reports are what a caller said, not findings." },
     { id: "skytruth_posts", name: "Spills and accidents written up by SkyTruth itself \u2014 Taylor Energy, derailments, refuge spills (SkyTruth Monitor)", unit: "write-ups", colour: "#5E6B70", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Write-ups", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_2.geojson" }],
-      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. SkyTruth's own posts about incidents it followed, placed where each happened." },
+      note: "Every alert SkyTruth's service will give, from a daily copy: it hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. SkyTruth's own posts about incidents it followed, placed where each happened." },
     { id: "skytruth_marine_incidents", name: "Sinkings, groundings and mystery slicks, as US responders wrote them up (SkyTruth Monitor)", unit: "incident reports", colour: "#5A6772", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Incident reports", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_3.geojson" }],
-      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Incident reports in the words of the responders, NOAA's and the Coast Guard's among them." },
+      note: "Every alert SkyTruth's service will give, from a daily copy: it hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. Incident reports in the words of the responders, NOAA's and the Coast Guard's among them." },
     { id: "skytruth_pa_permits", name: "Oil and gas drilling permits issued, Pennsylvania (SkyTruth Monitor)", unit: "permits", colour: "#6E6A55", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Permits", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_4.geojson" }],
-      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Each permit as Pennsylvania issued it: well type, operator, site, township." },
+      note: "Every alert SkyTruth's service will give, from a daily copy: it hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. Each permit as Pennsylvania issued it: well type, operator, site, township." },
     { id: "skytruth_pa_spud", name: "Oil and gas wells where drilling has started, Pennsylvania (SkyTruth Monitor)", unit: "drilling starts", colour: "#73664F", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Drilling starts", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_5.geojson" }],
-      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Operators' own reports that drilling began (SPUD reports)." },
+      note: "Every alert SkyTruth's service will give, from a daily copy: it hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. Operators' own reports that drilling began (SPUD reports)." },
     { id: "skytruth_pa_violations", name: "Violations issued to oil and gas operators, Pennsylvania (SkyTruth Monitor)", unit: "violations", colour: "#7A5B4E", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Violations", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_9.geojson" }],
-      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Each violation as Pennsylvania's inspectors recorded it, with its code." },
+      note: "Every alert SkyTruth's service will give, from a daily copy: it hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. Each violation as Pennsylvania's inspectors recorded it, with its code." },
     { id: "skytruth_well_permits", name: "Well plugging and other well permit activity, by county (SkyTruth Monitor)", unit: "permit reports", colour: "#6B6056", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Permit reports", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_8.geojson" }],
-      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. Permit activity as operators reported it. The feed does not say which state it covers; the newest report seen on 20 September 2026 was from December 2011." },
+      note: "Every alert SkyTruth's service will give, from a daily copy: it hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. Permit activity as operators reported it. The feed does not say which state it covers; the newest report seen on 20 September 2026 was from December 2011." },
     { id: "skytruth_fracfocus", name: "Gas and oil wells fracked, United States \u2014 operators' FracFocus disclosures (SkyTruth Monitor)", unit: "disclosures", colour: "#6F5F58", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Disclosures", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_10.geojson" }],
-      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. An alert for each disclosure SkyTruth found on FracFocus.org." },
+      note: "Every alert SkyTruth's service will give, from a daily copy: it hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. An alert for each disclosure SkyTruth found on FracFocus.org." },
+    { id: "skytruth_tests", name: "Test entries left by SkyTruth Monitor's own developers (SkyTruth Monitor)", unit: "test entries", colour: "#6A6A66", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Test entries", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_10101.geojson" }],
+      note: "Every alert SkyTruth's service will give, from a daily copy: it hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. Feed 10101: entries its developers made while trying the service out (\"This is dan's house\"). Not environmental data; here because the service publishes it and nothing it publishes is left out." },
     { id: "skytruth_quakes", name: "Earthquakes, worldwide (SkyTruth Monitor)", unit: "earthquakes", colour: "#65676A", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Earthquakes", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_6.geojson" }],
-      note: "SkyTruth's service hands out only the 100 newest alerts for any area asked, so the daily copy asks area by area, smaller wherever 100 came back, and keeps everything gathered on earlier days. The earthquakes SkyTruth's feed carries; the newest seen on 20 September 2026 was from July 2015." },
+      note: "Every alert SkyTruth's service will give, from a daily copy: it hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. The earthquakes SkyTruth's feed carries; the newest seen on 20 September 2026 was from July 2015." },
     { id: "slick_archive", name: "Oil slick archive (Cerulean, kept daily)", unit: "slicks by month", colour: "#5A5750", route: "slickarchive", ready: true, lazy: true,
       base: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/cerulean_archive",
       note: "Every Cerulean slick kept by month from a daily copy, so they stay on the map whatever happens to the live service." },
@@ -8138,6 +8146,7 @@ const LAYER_KIND = {
   skytruth_well_permits: ["animal", "downstream"],
   skytruth_fracfocus: ["animal", "downstream"],
   skytruth_quakes: ["insentient", "downstream"],
+  skytruth_tests: ["insentient", "downstream"],
   wrf: ["insentient", "upstream"],
   nsf_launches: ["insentient", "upstream"],
   nsf_locations: ["insentient", "upstream"],
@@ -8667,6 +8676,7 @@ const LAYER_SITE = {
   skytruth_well_permits: "https://monitor.skytruth.org/",
   skytruth_fracfocus: "https://monitor.skytruth.org/",
   skytruth_quakes: "https://monitor.skytruth.org/",
+  skytruth_tests: "https://monitor.skytruth.org/",
   soy_organizations: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/soy_organizations.html",
   tableau_zsf: "https://public.tableau.com/shared/ZSF724HPQ",
   theyrule: "https://theyrule.net/",
@@ -8915,7 +8925,7 @@ const PANEL_ORDER = [
   { h: 3, t: "Space launches" }, "ll2_pads", "ll2_upcoming",
   { h: 3, t: "Protecting extraterrestrial life" }, "biosignature",
 
-  { h: 1, t: "Base and reference" }, "skytruth_quakes",
+  { h: 1, t: "Base and reference" }, "skytruth_quakes", "skytruth_tests",
   { h: 1, t: "Buildings" }, "building_types",
 ];
 const PANEL_REMOVED = new Set([
diff --git a/map/test.mjs b/map/test.mjs
index 37f44d3..fb60b89 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1782,10 +1782,14 @@ console.log("\nthe layers box, in the chosen order");
     const at = (t) => order.PANEL_ORDER.findIndex((x) => x && x.t === t);
     check("SkyTruth Monitor's nine alert feeds are rows, each from its own daily copy",
           feeds.every((id) => new RegExp(`id: "${id}"[^\\n]*route: "geojsonlive"`).test(src) && ids.includes(id)) &&
-          (src.match(/culprits-tiles-more\/skytruth\/feed_\d+\.geojson/g) || []).length === 9);
+          (src.match(/culprits-tiles-more\/skytruth\/feed_\d+\.geojson/g) || []).length === 10);
     check("\u2026filed by what they show: spill reports under slicks and pollution, drilling under its own heading",
           at("Oil and gas drilling") > at("Mining") && order.PANEL_ORDER.indexOf("skytruth_fracfocus") > at("Oil and gas drilling") &&
           ids.filter((x) => x === "skytruth_nrc").length === 2 && ids.filter((x) => x === "skytruth_pa_violations").length === 2);
+    check("\u2026nothing SkyTruth publishes is left out: the developers' test feed is a row too",
+          /id: "skytruth_tests"[^\n]*route: "geojsonlive"/.test(src) && /skytruth\/feed_10101\.geojson/.test(src) && ids.includes("skytruth_tests"));
+    check("\u2026an alert with no position is counted on its row, not passed over",
+          /if \(!ft\.geometry\) \{ nowhere\+\+; return; \}/.test(src) && /more in the file have no position and cannot be drawn/.test(src));
     check("\u2026and the vessels row no longer claims the last 30 days, which the service never applied",
           !/id: "skytruth_voc"[^\n]*last 30 days/.test(src) && !/vessels-of-concern alerts for the whole world over the last 30 days/.test(src));
   }
"""


def run(cmd, text=None):
    return subprocess.run(cmd, input=text, text=True, capture_output=True)


def main():
    if not pathlib.Path("map/app.js").exists():
        sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits).")
    app = pathlib.Path("map/app.js").read_text(encoding="utf-8")
    if 'id: "skytruth_quakes"' not in app:
        sys.exit("patch_0920x.py has to be applied and committed first.")
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
