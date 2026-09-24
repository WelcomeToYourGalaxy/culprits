#!/usr/bin/env python3
"""
A tick on every line of the showing box; heading ticks moved to the end of
their line; layers built three at a time; a menu's own ticks draw.

Run from the repo root:  python3 patch_1009.py

Needs patch_1008.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js      Each line in the showing box takes its own tick, left of its
                  colour; unticking there unticks the row in the layers box, so
                  that box still holds the truth.
                  A heading's bulk tick moves to the end of its line.
                  ensureLayer builds three layers at a time and the rest say
                  what they are waiting behind. Ticking a heading with thirty
                  layers under it used to fire thirty archives at once, which
                  stalled the map and let the slowest source hold up the rest.
                  Nothing changed about the first load: every layer still
                  starts unticked.
                  Ticking something inside a row's own menu - Nusantara's layer
                  list, the Global Forest Watch catalogue - turns that row on,
                  instead of doing nothing until the row is ticked separately.
  map/index.html  The showing box's tick.
  map/test.mjs    Checks for all of it.
  HANDOFF.md      The queue, and why the menus needed it.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 988d2eb..0320c0b 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -83,6 +83,24 @@ Worker: `https://culprits-proxy.welcometoyourgalaxy.workers.dev`
 
 ---
 
+## Layers are built three at a time
+
+Ticking a heading turns on everything under it, which can be thirty layers.
+Fired together they open thirty archives and live services in one breath: the
+browser queues most of them anyway, the map stalls while they arrive, and the
+slowest source holds up every other. `queueBuild` in `ensureLayer` runs three
+at a time and the rest say what they are waiting behind, so a layer that has
+not drawn yet does not read as one that failed. Nothing changed about the
+opening view: every layer still starts unticked, so a first load fetches the
+basemap, the boundaries and nothing else.
+
+A menu inside a row - Nusantara's layer list, the Global Forest Watch
+catalogue - turns its row on when something in it is ticked (`showRowFor`). Its
+ticks used to do nothing until the row itself was ticked, which reads as a
+broken menu.
+
+---
+
 ## Two sources that need work, written down so they are not lost
 
 **The Global Wastewater Model (Tuholske et al. 2021).** Its row reads copies in
diff --git a/map/app.js b/map/app.js
index af8e8b4..9dacd0e 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3302,6 +3302,22 @@ function categoryMenu(el, items, rules, label, onPick, placeholder) {
   draw();
 }
 
+// Turn a row on from inside one of its own menus: the row's own box is ticked,
+// so the layers box still holds the truth and everything that follows from a
+// tick happens exactly as it does when the box is clicked.
+function showRowFor(id) {
+  if ((visibility.get(id) || "none") === "visible") return;
+  const box = typeof document !== "undefined" && document.querySelector
+    ? document.querySelector(`[data-layer="${id}"]`) : null;
+  if (box && !box.checked) {
+    box.checked = true;
+    if (typeof box.dispatchEvent === "function" && typeof Event === "function") box.dispatchEvent(new Event("change", { bubbles: true }));
+  } else {
+    visibility.set(id, "visible");
+    applyVisibility(id);
+  }
+}
+
 /* ---------- a map server's whole layer list, as a menu (Nusantara Atlas) ---------- */
 async function addWmsMenuLayer(cfg) {
   const layers = [];
@@ -3351,6 +3367,10 @@ async function addWmsMenuLayer(cfg) {
     const cb = e.target.closest && e.target.closest("[data-ns]");
     if (!cb) return;
     e.stopPropagation();
+    // Ticking a layer in the list turns the row above it on as well. Without
+    // that, the list ticks did nothing until the row itself was ticked, which
+    // reads as a broken menu rather than a rule.
+    if (cb.checked) showRowFor(cfg.id);
     const i = Number(cb.dataset.ns);
     if (cb.checked) {
       on.add(i);
@@ -3418,6 +3438,9 @@ async function addGfwMenuLayer(cfg) {
   };
   categoryMenu(menu, items, GFW_CATEGORIES, "Dataset", async (pick) => {
     clear();
+    // Choosing a dataset turns the row on, so the choice draws rather than
+    // waiting on a second tick.
+    if (pick) showRowFor(cfg.id);
     const d = pick == null ? null : items[pick];
     if (!d) return;
     setLayerState(cfg.id, `${d.title}: finding its tiles\u2026`);
@@ -6080,8 +6103,13 @@ function buildLegend() {
   if (!shown.length) { box.hidden = true; return; }
   box.hidden = false;
 
+  // Each line takes a tick of its own, left of its colour, so a layer can be
+  // put away from the box that says it is showing rather than by finding its
+  // row again in the layers list.
   const rows = shown.map((c) =>
-    `<div class="lg-row"><span class="lg-sw" style="background:${c.colour}"></span>` +
+    `<div class="lg-row"><input type="checkbox" class="lg-on" data-lg="${escapeHtml(c.id)}" checked ` +
+    `aria-label="Hide ${escapeHtml(c.name)}" title="Hide this layer">` +
+    `<span class="lg-sw" style="background:${c.colour}"></span>` +
     `<span class="lg-nm">${c.name}</span>` +
     `<span class="lg-un">${c.unit || ""}</span></div>`).join("");
 
@@ -6091,6 +6119,19 @@ function buildLegend() {
     `<div class="lg-row"><span class="lg-sw lg-hollow"></span>` +
     `<span class="lg-nm">hollow</span>` +
     `<span class="lg-un">no site coordinate published</span></div>`;
+  // The layers box holds the truth; unticking here unticks the row there, and
+  // everything that follows from that happens as it always did.
+  if (!box.dataset.wired) {
+    box.dataset.wired = "1";
+    box.addEventListener("change", (e) => {
+      const i = e.target && e.target.closest && e.target.closest("[data-lg]");
+      if (!i) return;
+      const row = document.querySelector(`[data-layer="${i.dataset.lg}"]`);
+      if (!row) return;
+      row.checked = i.checked;
+      row.dispatchEvent(new Event("change", { bubbles: true }));
+    });
+  }
 }
 
 /* ---------- shared ---------- */
@@ -6982,6 +7023,34 @@ function childById(id) {
 // failure marks the row rather than throwing into the change handler, where an
 // unhandled rejection would leave the box ticked and nothing on the map.
 const created = new Set();
+// Layers are built a few at a time, not all at once.
+//
+// Ticking a heading turns on everything under it, which can be thirty layers.
+// Fired together they open thirty archives and thirty live services in one
+// breath: the browser holds most of them in a queue anyway, the map stalls
+// while they arrive, and the slowest source delays every other. Three at a
+// time keeps the map answering and lets the first layers draw while the rest
+// wait their turn. The row says where it is in the queue, so a layer that has
+// not drawn yet does not read as a layer that failed.
+const QUEUE_AT_ONCE = 3;
+let queueRunning = 0;
+const queueWaiting = [];
+function queueNext() {
+  while (queueRunning < QUEUE_AT_ONCE && queueWaiting.length) {
+    const next = queueWaiting.shift();
+    queueRunning++;
+    setLayerState(next.id, "loading\u2026");
+    Promise.resolve().then(next.job).then(next.done, next.fail)
+      .then(() => { queueRunning--; queueNext(); });
+  }
+  queueWaiting.forEach((w, i) => setLayerState(w.id, `waiting behind ${i + 1} other layer${i ? "s" : ""}\u2026`));
+}
+function queueBuild(id, job) {
+  return new Promise((done, fail) => {
+    queueWaiting.push({ id, job, done, fail });
+    queueNext();
+  });
+}
 function ensureLayer(cfg) {
   if (created.has(cfg.id)) return;
   created.add(cfg.id);
@@ -6990,35 +7059,37 @@ function ensureLayer(cfg) {
   // not all PMTiles — the livestock species are WMTS — and calling the archive
   // builder for a tile layer would fail on a URL that was never meant to be an
   // archive. addWmtsLayer is synchronous, so it is wrapped to keep one shape.
-  const build = cfg.route === "wmts"
+  queueBuild(cfg.id, () => {
+    const build = cfg.route === "wmts"
     ? Promise.resolve().then(() => addWmtsLayer(cfg))
-    : cfg.route === "shapes" ? addShapesLayer(cfg)
-    : cfg.route === "sitemap" ? addSitemapLayer(cfg)
-    : cfg.route === "arcgis" ? Promise.resolve().then(() => addArcgisLayer(cfg))
-    : cfg.route === "umap" || cfg.route === "kml" || cfg.route === "arcgisapp" ? addLivePlacesLayer(cfg)
-    : cfg.route === "rasterlive" ? Promise.resolve().then(() => addRasterChoiceLayer(cfg))
-    : cfg.route === "trase" ? addTraseLayer(cfg)
-    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
-    : cfg.route === "slickarchive" ? addSlickArchive(cfg)
-    : cfg.route === "cafo" ? Promise.resolve().then(() => addCafoLayer(cfg))
-    : cfg.route === "glw" ? Promise.resolve().then(() => addGlwLayer(cfg))
-    : cfg.route === "arcgisdyn" ? addArcgisDynLayer(cfg)
-    : cfg.route === "giga" ? addGigaLayer(cfg)
-    : cfg.route === "trasefacmenu" ? addTraseFacMenu(cfg)
-    : cfg.route === "gta" ? addGtaLayer(cfg)
-    : cfg.route === "ctair" ? addCtAirLayer(cfg)
-    : cfg.route === "gsn" ? addGsnLayer(cfg)
-    : cfg.route === "companion" ? Promise.resolve().then(() => addCompanion(cfg))
-    : cfg.route === "rte" ? addRteLayer(cfg)
-    : cfg.route === "ll2" ? addLivePlacesLayer(cfg)
-    : cfg.route === "owidgrapher" ? addOwidGrapherLayer(cfg)
-    : cfg.route === "buildings" ? addBuildingTypesLayer(cfg)
-    : cfg.route === "spheres" ? addSpheresLayer(cfg)
-    : ["ejatlas", "geojsonlive", "wpgmza", "atlascities", "trasefac"].includes(cfg.route) ? addLivePlacesLayer(cfg)
-    : cfg.route === "wmsmenu" ? addWmsMenuLayer(cfg)
-    : cfg.route === "gfwmenu" ? addGfwMenuLayer(cfg)
-    : addPmtilesLayer(cfg);
-  build
+      : cfg.route === "shapes" ? addShapesLayer(cfg)
+      : cfg.route === "sitemap" ? addSitemapLayer(cfg)
+      : cfg.route === "arcgis" ? Promise.resolve().then(() => addArcgisLayer(cfg))
+      : cfg.route === "umap" || cfg.route === "kml" || cfg.route === "arcgisapp" ? addLivePlacesLayer(cfg)
+      : cfg.route === "rasterlive" ? Promise.resolve().then(() => addRasterChoiceLayer(cfg))
+      : cfg.route === "trase" ? addTraseLayer(cfg)
+      : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
+      : cfg.route === "slickarchive" ? addSlickArchive(cfg)
+      : cfg.route === "cafo" ? Promise.resolve().then(() => addCafoLayer(cfg))
+      : cfg.route === "glw" ? Promise.resolve().then(() => addGlwLayer(cfg))
+      : cfg.route === "arcgisdyn" ? addArcgisDynLayer(cfg)
+      : cfg.route === "giga" ? addGigaLayer(cfg)
+      : cfg.route === "trasefacmenu" ? addTraseFacMenu(cfg)
+      : cfg.route === "gta" ? addGtaLayer(cfg)
+      : cfg.route === "ctair" ? addCtAirLayer(cfg)
+      : cfg.route === "gsn" ? addGsnLayer(cfg)
+      : cfg.route === "companion" ? Promise.resolve().then(() => addCompanion(cfg))
+      : cfg.route === "rte" ? addRteLayer(cfg)
+      : cfg.route === "ll2" ? addLivePlacesLayer(cfg)
+      : cfg.route === "owidgrapher" ? addOwidGrapherLayer(cfg)
+      : cfg.route === "buildings" ? addBuildingTypesLayer(cfg)
+      : cfg.route === "spheres" ? addSpheresLayer(cfg)
+      : ["ejatlas", "geojsonlive", "wpgmza", "atlascities", "trasefac"].includes(cfg.route) ? addLivePlacesLayer(cfg)
+      : cfg.route === "wmsmenu" ? addWmsMenuLayer(cfg)
+      : cfg.route === "gfwmenu" ? addGfwMenuLayer(cfg)
+      : addPmtilesLayer(cfg);
+    return build;
+  })
     .then(() => {
       const box = document.getElementById("layers");
       if (cfg.facet) {
@@ -8031,8 +8102,8 @@ function arrangePanel() {
       }
       syncHeadingBoxes(document.getElementById("layers"));
     });
-    line.appendChild(all);
     line.appendChild(head);
+    line.appendChild(all);
     sec.appendChild(line);
     sec.appendChild(body);
     stack[stack.length - 1].body.appendChild(sec);
diff --git a/map/index.html b/map/index.html
index ac8ee0a..91d306c 100644
--- a/map/index.html
+++ b/map/index.html
@@ -271,6 +271,7 @@
   .lg-hd{color:var(--bone);font-size:10.5px;letter-spacing:.06em;
     text-transform:uppercase;margin-bottom:4px}
   .lg-row{display:flex;align-items:baseline;gap:6px;margin:2px 0}
+  .lg-on{flex:0 0 auto;width:11px;height:11px;margin:0;accent-color:#8A9DA6;cursor:pointer}
   .lg-sw{flex:0 0 auto;width:8px;height:8px;border-radius:50%;margin-top:3px}
   .lg-hollow{background:none;border:1px solid var(--dim)}
   .lg-nm{color:var(--bone);flex:0 0 auto}
diff --git a/map/test.mjs b/map/test.mjs
index 4a8ffb7..60b4c50 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2056,6 +2056,21 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\nthe showing box, the queue, and menus that draw");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
+  check("every line in the showing box has its own tick, left of its colour",
+        /<input type="checkbox" class="lg-on" data-lg=/.test(src) && /\.lg-on\{flex:0 0 auto/.test(index) &&
+        src.indexOf('class="lg-on"') < src.indexOf('class="lg-sw"'));
+  check("unticking there unticks the row in the layers box, not the map directly",
+        /const row = document\.querySelector\(`\[data-layer="\$\{i\.dataset\.lg\}"\]`\)/.test(src) && /row\.dispatchEvent\(new Event\("change"/.test(src));
+  check("a heading's tick sits at the end of its line", /line\.appendChild\(head\);\n\s*line\.appendChild\(all\);/.test(src));
+  check("layers are built three at a time, and a waiting row says so",
+        /const QUEUE_AT_ONCE = 3/.test(src) && /waiting behind \$\{i \+ 1\} other layer/.test(src) && /queueBuild\(cfg\.id, \(\) => \{/.test(src));
+  check("a menu's own ticks turn the row above them on", /function showRowFor\(id\)/.test(src) && /if \(cb\.checked\) showRowFor\(cfg\.id\)/.test(src) && /if \(pick\) showRowFor\(cfg\.id\)/.test(src));
+}
+
 console.log("\ntitles in one ink, sources named");
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
    if "QUEUE_AT_ONCE" in app:
        print("Already applied - nothing to do.")
        return
    with open("map/index.html", encoding="utf-8") as fh:
        if ".layer.child .nm{color:inherit}" not in fh.read():
            sys.exit("patch_1008.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
