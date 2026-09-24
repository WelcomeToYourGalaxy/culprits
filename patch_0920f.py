#!/usr/bin/env python3
"""patch_0920f.py - the launch rows stop waiting out Launch Library; the reload
caption names the shortcut.

    cd ~/Desktop/culprits
    python3 patch_0920f.py

Goes on top of patch_0920e.py, which must be applied and committed first.

1. Launch sites and Upcoming launches read Launch Library in six pages, one
   after another, each a detailed record, with a rate limit under them. The row
   waited for all of it before drawing anything. Now the daily copy kept in
   culprits-tiles-more is read beside the live pages, and the live read is given
   six seconds; whichever is in hand is what the row draws, and the row's line
   says which it is. Nothing is mixed - the rows drawn are all live or all copy.

2. The reload button's caption now reads "Stuck? Reload here, or press Cmd-R
   (Ctrl-R)". While a script is blocking the page nothing in the page can be
   clicked, the button included - that is the browser, not this map - but the
   browser's own reload always answers.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 19fe5d1..01d9c01 100644
--- a/map/app.js
+++ b/map/app.js
@@ -4036,11 +4036,31 @@ function ll2Pad(p, extra) {
   if (!isFinite(lat) || !isFinite(lng)) return null;
   return { type: "Point", coordinates: [lng, lat] };
 }
+// Launch Library answers slowly: six pages in turn, each a detailed record, and
+// a rate limit under them. The row used to wait for all of it before drawing
+// anything, which for the pads was most of a minute. So the copy kept here
+// daily is read first - one file, one request - and the live read runs beside
+// it with LL2_WAIT to answer in. If it lands in time the row draws the live
+// rows; if it does not, the row draws the copy and says so. Nothing is mixed:
+// what is drawn is one or the other, and the row's line says which.
+const LL2_WAIT = 6000;
 async function readLaunchLibrary(cfg) {
   let rows, note = "";
-  try { rows = await ll2All(cfg.what === "pads" ? "/pads/" : "/launches/upcoming/"); }
-  catch (e) {
-    rows = (await getJson(cfg.copy)).results || [];
+  const copy = getJson(cfg.copy, 20000).then((j) => j.results || []);
+  copy.catch(() => {});   // handled below; this only stops an unhandled rejection
+  const live = ll2All(cfg.what === "pads" ? "/pads/" : "/launches/upcoming/");
+  live.catch(() => {});
+  const late = new Promise((done) => setTimeout(() => done("late"), LL2_WAIT));
+  try {
+    const first = await Promise.race([live, late]);
+    if (first === "late") {
+      rows = await copy;
+      note = `Launch Library did not answer within ${Math.round(LL2_WAIT / 1000)} seconds; showing today's copy`;
+    } else {
+      rows = first;
+    }
+  } catch (e) {
+    rows = await copy;
     note = e.message === "rate" ? "Launch Library's hourly limit was reached; showing today's copy" : `Launch Library did not answer; showing today's copy`;
   }
   const items = [];
diff --git a/map/index.html b/map/index.html
index 9595c86..e84ca5b 100644
--- a/map/index.html
+++ b/map/index.html
@@ -323,7 +323,7 @@
 <div class="reload-wrap reload-early" id="reload-wrap">
   <button type="button" id="reload-map" aria-label="Reload the map"
           onclick="try{var v=window.__culpritsView;if(v)sessionStorage.setItem('culprits-view',v)}catch(e){}location.reload()">&#8635;</button>
-  <span class="reload-cap">Reload if the map gets stuck</span>
+  <span class="reload-cap">Stuck? Reload here, or press ⌘R (Ctrl-R)</span>
 </div>
 <div class="right-col">
   <div id="basemaps" class="ctrl-box"></div>
diff --git a/map/test.mjs b/map/test.mjs
index e09945f..842bd30 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1740,7 +1740,7 @@ console.log("\ncolumns close in, a reload button, mines");
   check("at world view columns keep their old size", halves([{ lng: 0, lat: 0 }, { lng: 1, lat: 1 }], 2).want === 1.5);
   const html2 = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
   check("a reload button is in the page from the start, with its own handler and its words beside it",
-        /id="reload-map"[\s\S]{0,200}onclick="[^"]*location\.reload\(\)"/.test(html2) && /class="reload-cap">Reload if the map gets stuck</.test(html2));
+        /id="reload-map"[\s\S]{0,200}onclick="[^"]*location\.reload\(\)"/.test(html2) && /class="reload-cap">Stuck\? Reload here, or press \u2318R \(Ctrl-R\)</.test(html2));
   check("…and moves under the view choices once they exist", /under\.appendChild\(wrap\)/.test(src));
   check("…keeping the view as the map moves", /window\.__culpritsView = /.test(src));
   check("…and comes back to the same view", /sessionStorage\.getItem\("culprits-view"\)/.test(src));
@@ -2392,6 +2392,20 @@ console.log("\nCarbon Mapper is read through the Worker");
         /\["limit", "offset", "sort", "bbox", "plume_gas", "datetime"\]/.test(worker));
 }
 
+console.log("\nthe launch rows draw without waiting out the API");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
+  check("the copy is read beside the live pages, not only after they fail",
+        /const LL2_WAIT = 6000;/.test(src) && /const copy = getJson\(cfg\.copy, 20000\)/.test(src) &&
+        /Promise\.race\(\[live, late\]\)/.test(src));
+  check("a row says which of the two it is showing",
+        /did not answer within \$\{Math\.round\(LL2_WAIT \/ 1000\)\} seconds; showing today's copy/.test(src) &&
+        /hourly limit was reached; showing today's copy/.test(src));
+  check("the reload caption names the shortcut that works while the page is busy",
+        /Stuck\? Reload here, or press \u2318R \(Ctrl-R\)/.test(index));
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
    if "WIRE_NOT_GIVEN" not in app:
        sys.exit("patch_0920e.py has to be applied and committed first.")

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
    print("Applied. Changed: map/app.js, map/index.html, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
