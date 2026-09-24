#!/usr/bin/env python3
"""
Areas findable from the world view; headings become menus rather than controls.

Run from the repo root:  python3 patch_1010.py

Needs patch_1009.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js     A sitemap layer's areas gain an edge as well as a fill, and a
                 point at each area's middle below zoom 7 (`areasFrom` on a row
                 to change it). PalmWatch's mill concessions are tens of
                 hectares, a fraction of a pixel at the world view, so the fill
                 drew nothing at all. Nothing is added: the edge is the area's
                 own boundary, the point sits inside it, and both carry that
                 area's own record.
                 The tick on each heading is removed, with the code that kept
                 it in step. A heading is a way through the list, not a layer:
                 its arrow opens it, and the rows inside it are what can be
                 turned on.
  map/test.mjs   Checks for all of it.
  HANDOFF.md     Headings as menus, and areas at the world view.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 0320c0b..9b5df4d 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -101,6 +101,17 @@ broken menu.
 
 ---
 
+## Areas at the world view
+
+A sitemap layer's areas get an edge as well as a fill, and a point at each
+area's middle below zoom 7 (`areasFrom` to change it). PalmWatch's mill
+concessions are tens of hectares, which is a fraction of a pixel at the world
+view: the fill drew nothing and the layer read as broken. Nothing is added -
+the edge is the area's own boundary, the point sits inside it, and both carry
+that area's own record, so a click says the same wherever it lands.
+
+---
+
 ## Two sources that need work, written down so they are not lost
 
 **The Global Wastewater Model (Tuholske et al. 2021).** Its row reads copies in
@@ -135,12 +146,17 @@ one if a row has it.
 
 ---
 
-## Bulk ticks, and the abattoir atlas's three rows
+## Headings are menus, not controls
+
+No tick on a heading. A heading is a way through the list: its arrow opens it
+and the rows inside it are what can be turned on. The bulk tick that was there
+briefly also invited turning on thirty layers at once, which is a minute of
+loading and a map nobody can read. The build queue below stays, because a row
+can still be ticked faster than its archives arrive.
+
+---
 
-Every heading carries its own tick, beside the heading rather than inside it,
-which shows or hides every layer under it including sub-headings;
-`syncHeadingBoxes` keeps it reading all, none or part-way from the layers
-themselves. Ticking a heading with many layers under it loads all of them.
+## The abattoir atlas's three rows
 
 The abattoir atlas's three parts are three rows under Meat rather than chip
 buttons inside one row: the registered facilities, Climate TRACE's modelled
diff --git a/map/app.js b/map/app.js
index 9dacd0e..763b7af 100644
--- a/map/app.js
+++ b/map/app.js
@@ -5741,6 +5741,15 @@ async function addSitemapLayer(cfg, given) {
     filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
     paint: { "line-color": colour, "line-opacity": 0.8,
              "line-width": ["min", ["coalesce", ["get", "w"], 2], 4] } });
+  // An area on a world map is often a fraction of a pixel. PalmWatch's mill
+  // concessions are tens of hectares: at the widest view they drew as nothing.
+  // So an area also gets an edge, which shows as a mark even where the fill is
+  // smaller than a pixel. Nothing is added: the edge is the area's own
+  // boundary and carries the area's own record.
+  map.addLayer({ id: `${cfg.id}-edge`, type: "line", source,
+    filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
+    paint: { "line-color": colour, "line-opacity": 0.9,
+             "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.8, 8, 1.2] } });
   map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source,
     filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
     paint: {
@@ -5754,6 +5763,28 @@ async function addSitemapLayer(cfg, given) {
       "circle-stroke-width": ["min", ["coalesce", ["get", "w"], 0.8], 3],
       "circle-opacity": ["coalesce", ["get", "o"], 0.85],
     } });
+  // The middle of each area, drawn wider out than an area can be seen at.
+  const areas = (data.features || []).filter((f) => f.geometry && /Polygon$/.test(f.geometry.type));
+  if (areas.length) {
+    const middleOf = (g) => {
+      const pts = [];
+      const walk = (c) => { if (c && typeof c[0] === "number") pts.push(c); else if (Array.isArray(c)) c.forEach(walk); };
+      walk(g.coordinates);
+      if (!pts.length) return null;
+      return [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
+    };
+    const feats = [];
+    for (const f of areas) {
+      const at = middleOf(f.geometry);
+      if (at) feats.push({ type: "Feature", properties: f.properties || {}, geometry: { type: "Point", coordinates: at } });
+    }
+    map.addSource(`${cfg.id}-areapt-src`, { type: "geojson", data: { type: "FeatureCollection", features: feats } });
+    map.addLayer({ id: `${cfg.id}-areapt`, type: "circle", source: `${cfg.id}-areapt-src`,
+      maxzoom: cfg.areasFrom || 7,
+      paint: { "circle-color": colour, "circle-opacity": 0.85,
+               "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.2, 6, 3.6],
+               "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5 } });
+  }
   if (Array.isArray(data.filters) && data.filters.length) {
     sitemapFilters.set(cfg.id, {
       filters: data.filters,
@@ -5762,6 +5793,7 @@ async function addSitemapLayer(cfg, given) {
         [`${cfg.id}-fill`]: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
         [`${cfg.id}-line`]: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
         [`${cfg.id}-pt`]: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
+        [`${cfg.id}-edge`]: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
       },
     });
     sitemapChipRows(cfg);
@@ -5771,8 +5803,9 @@ async function addSitemapLayer(cfg, given) {
     sitemapColourRow(cfg);
     applySitemapColouring(cfg.id);
   }
-  for (const kind of ["fill", "line", "pt"]) {
+  for (const kind of ["fill", "line", "pt", "edge", "areapt"]) {
     const id = `${cfg.id}-${kind}`;
+    if (!map.getLayer(id)) continue;
     SITEMAP_LAYERS.add(id);
     map.on("click", id, (e) => openSitemapClick(e));
     map.on("mouseenter", id, (e) => { map.getCanvas().style.cursor = "pointer"; showSitemapTooltip(e); });
@@ -7820,22 +7853,6 @@ const PANEL_REMOVED = new Set([
   "leg_municipal", "leg_municipal_recover", "leg_laws",
 ]);
 
-// A heading's tick reads its layers, never the other way round: all on, none
-// on, or part-way, which is the only honest rendering of a heading holding
-// some ticked rows.
-function syncHeadingBoxes(box) {
-  if (!box || !box.querySelectorAll) return;
-  for (const sec of box.querySelectorAll(".toc-sec")) {
-    const all = sec.querySelector(".toc-all");
-    if (!all) continue;
-    const boxes = [...sec.querySelectorAll("[data-layer]")];
-    const on = boxes.filter((i) => i.checked).length;
-    all.checked = boxes.length > 0 && on === boxes.length;
-    all.indeterminate = on > 0 && on < boxes.length;
-    all.disabled = boxes.length === 0;
-  }
-}
-
 function panelNodes(box, key) {
   let lead = null;
   if (key === "gm") { const i = box.querySelector("[data-gm]"); lead = i && i.closest("label"); }
@@ -8079,31 +8096,11 @@ function arrangePanel() {
       body.hidden = !body.hidden;
       head.setAttribute("aria-expanded", String(!body.hidden));
     });
-    // Every heading takes its own tick, which shows or hides every layer under
-    // it, sub-headings included. It sits beside the heading rather than inside
-    // it, so opening a heading and turning its layers on stay separate
-    // actions - the same reason a group's triangle and its box are separate.
-    // Ticking a heading with many layers under it loads all of them, which is
-    // why the tick says so.
-    const line = document.createElement("div");
-    line.className = "toc-line";
-    const all = document.createElement("input");
-    all.type = "checkbox";
-    all.className = "toc-all";
-    all.title = "Show or hide every layer under this heading";
-    all.setAttribute("aria-label", `Show or hide every layer under ${titleCase(t)}`);
-    all.addEventListener("click", (e) => e.stopPropagation());
-    all.addEventListener("change", () => {
-      const on = all.checked;
-      for (const i of body.querySelectorAll("[data-layer]")) {
-        if (i.checked === on) continue;
-        i.checked = on;
-        if (typeof i.dispatchEvent === "function" && typeof Event === "function") i.dispatchEvent(new Event("change", { bubbles: true }));
-      }
-      syncHeadingBoxes(document.getElementById("layers"));
-    });
+    // No tick on a heading. A heading is a way through the list, not a layer:
+    // its arrow opens it and the rows inside it are what can be turned on.
+    // A tick here also invited turning on thirty layers with one click, which
+    // is a minute of loading and a map nobody can read.
     line.appendChild(head);
-    line.appendChild(all);
     sec.appendChild(line);
     sec.appendChild(body);
     stack[stack.length - 1].body.appendChild(sec);
@@ -8146,10 +8143,6 @@ function arrangePanel() {
     box.appendChild(sec);
     sec.querySelector(".toc-body").appendChild(rest);
   }
-  syncHeadingBoxes(box);
-  box.addEventListener("change", (e) => {
-    if (e && e.target && e.target.dataset && e.target.dataset.layer) syncHeadingBoxes(box);
-  });
   // Beside each heading, how many layers are inside it.
   for (const sec of box.querySelectorAll(".toc-sec")) {
     const n = sec.querySelectorAll("[data-layer], [data-gm]").length;
@@ -8165,8 +8158,6 @@ function arrangePanel() {
     st.id = "panel-h-style";
     st.textContent = ".toc-line{display:flex;align-items:center;gap:6px}" +
       ".toc-line .toc-head{flex:1;text-align:left}" +
-      ".toc-all{flex:none;accent-color:#8A9DA6;cursor:pointer}" +
-      ".toc-all:disabled{opacity:.3;cursor:default}" +
       ".panel-h{margin:10px 0 4px;color:var(--ink,#e8e2d6)}" +
       ".panel-h1{font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-top:1px solid rgba(255,255,255,.18);padding-top:8px;font-weight:700}" +
       ".panel-h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;padding-left:4px;font-weight:600}" +
diff --git a/map/test.mjs b/map/test.mjs
index 60b4c50..6511059 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2056,6 +2056,17 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\nareas findable from the world view");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("an area gets an edge as well as a fill, so a shape under a pixel still shows",
+        /id: `\$\{cfg\.id\}-edge`, type: "line", source,/.test(src) && /\["Polygon", "MultiPolygon"\], true, false\],\n\s*paint: \{ "line-color": colour/.test(src));
+  check("and a point at its middle wider out than the areas can be seen",
+        /id: `\$\{cfg\.id\}-areapt`/.test(src) && /maxzoom: cfg\.areasFrom \|\| 7/.test(src));
+  check("both carry the area's own record and are clickable like the rest",
+        /properties: f\.properties \|\| \{\}/.test(src) && /\["fill", "line", "pt", "edge", "areapt"\]/.test(src));
+}
+
 console.log("\nthe showing box, the queue, and menus that draw");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
@@ -2065,7 +2076,7 @@ console.log("\nthe showing box, the queue, and menus that draw");
         src.indexOf('class="lg-on"') < src.indexOf('class="lg-sw"'));
   check("unticking there unticks the row in the layers box, not the map directly",
         /const row = document\.querySelector\(`\[data-layer="\$\{i\.dataset\.lg\}"\]`\)/.test(src) && /row\.dispatchEvent\(new Event\("change"/.test(src));
-  check("a heading's tick sits at the end of its line", /line\.appendChild\(head\);\n\s*line\.appendChild\(all\);/.test(src));
+  check("a heading's line holds its arrow and title and nothing else", /line\.appendChild\(head\);\n\s*sec\.appendChild\(line\);/.test(src));
   check("layers are built three at a time, and a waiting row says so",
         /const QUEUE_AT_ONCE = 3/.test(src) && /waiting behind \$\{i \+ 1\} other layer/.test(src) && /queueBuild\(cfg\.id, \(\) => \{/.test(src));
   check("a menu's own ticks turn the row above them on", /function showRowFor\(id\)/.test(src) && /if \(cb\.checked\) showRowFor\(cfg\.id\)/.test(src) && /if \(pick\) showRowFor\(cfg\.id\)/.test(src));
@@ -2110,10 +2121,8 @@ console.log("\nheading ticks, chips in words, a named archive");
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const order = new Function(body + "; return PANEL_ORDER;")();
   const at = (t) => order.findIndex((x) => x && x.t === t);
-  check("every heading takes a tick that shows or hides everything under it",
-        /all\.className = "toc-all"/.test(src) && /for \(const i of body\.querySelectorAll\("\[data-layer\]"\)\)/.test(src));
-  check("the tick reads its layers: all, none or part-way", /function syncHeadingBoxes\(box\)/.test(src) && /all\.indeterminate = on > 0 && on < boxes\.length/.test(src));
-  check("opening a heading and turning its layers on are separate controls", /all\.addEventListener\("click", \(e\) => e\.stopPropagation\(\)\)/.test(src));
+  check("a heading is a way through the list, not a control: no tick on it",
+        !/toc-all/.test(src) && !/syncHeadingBoxes/.test(src));
   check("the slaughter chips say what the registry said", /"registry does not say"/.test(src) && /labels\[v\] \|\| v/.test(src));
   check("an archive that will not load names the file it asked for", /archive missing \(\$\{e\.message\}\) \\u2014 \$\{url\}/.test(src));
   check("the three meat rows sit together under Meat", ["abattoir_facilities", "abattoir_cafo", "abattoir_glw"].every((i) => order.indexOf(i) > at("Meat") && order.indexOf(i) < at("Oceans")));
'''


def git(*args):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if "areasFrom" in app and "toc-all" not in app:
        print("Already applied - nothing to do.")
        return
    if "QUEUE_AT_ONCE" not in app:
        sys.exit("patch_1009.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
