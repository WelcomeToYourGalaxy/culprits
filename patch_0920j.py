#!/usr/bin/env python3
"""patch_0920j.py - the reload row stops being clipped; Carbon Mapper draws as
it reads.

    cd ~/Desktop/culprits
    python3 patch_0920j.py

Goes on top of 7994603, which is what is on the remote now.

1. The reload button sat at the foot of the settings box - a box that scrolls
   and stops at 48vh - so on a short window the button and its words were cut
   off by the box's own edge. It is now its own row under that box, inside the
   right column: it keeps its full height whatever the box above does, the box
   above scrolls in what is left, and because it is in the column's flow rather
   than floating over it, it covers nothing. Its caption is free to wrap rather
   than being held to 90 pixels.

2. Carbon Mapper read ten pages of a thousand detailed records one after
   another and drew nothing until the last one landed. Now the first page is
   read on its own and drawn as soon as it arrives, and the rest follow three
   at a time, each batch drawn as it lands. The row says how many plumes are
   held, how many the catalogue publishes, and that it is still reading, so a
   part-read map never reads as the whole catalogue. Nothing about which plumes
   are kept has changed.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 2b4d5b9..e4ed9c9 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3411,6 +3411,7 @@ function columnEdge() {
 // all of it.
 const CARBON_PLUME_ZOOM = 10;     // from here in, the plumes' own pictures
 const CARBON_PLUME_PAGES = 10;    // 1,000 plumes a page
+const CARBON_PAGES_AT_ONCE = 3;    // after the first, which is drawn on its own
 const CARBON_PICTURES_AT_ONCE = 40;
 async function addCarbonMapperLayer(cfg) {
   const src = `${cfg.id}-src`;
@@ -3436,41 +3437,66 @@ async function addCarbonMapperLayer(cfg) {
     `<div class="meta">Carbon Mapper data platform</div>`);
 
   let held = [];
+  // One plume, as this map keeps it. Every field the catalogue gives that the
+  // box shows is carried; nothing is worked out here.
+  const asFeature = (it) => {
+    const g = it.geometry_json || it.geometry;
+    const at = g && g.coordinates;
+    if (!at || !isFinite(Number(at[0])) || !isFinite(Number(at[1]))) return null;
+    return { type: "Feature", geometry: { type: "Point", coordinates: [Number(at[0]), Number(at[1])] },
+      properties: {
+        plume_id: it.plume_id || it.id || "", gas: it.gas || "",
+        seen: it.scene_timestamp || it.datetime || "", instrument: it.instrument || "",
+        platform: it.platform || "", quality: it.plume_quality || "",
+        sector: it.sector || (it.source && it.source.sector) || "",
+        emission: it.emission_auto != null ? it.emission_auto : it.emission,
+        emission_uncertainty: it.emission_uncertainty_auto != null ? it.emission_uncertainty_auto : it.emission_uncertainty,
+        wind_speed: it.wind_speed_avg_auto, wind_direction: it.wind_direction_avg_auto,
+        collection: it.collection || "",
+        picture: it.plume_png || it.plume_rgb_png || "",
+        bounds: Array.isArray(it.plume_bounds) && it.plume_bounds.length === 4 ? it.plume_bounds.join(",") : "",
+      } };
+  };
+  // Ten pages of a thousand detailed records, read one after another, with
+  // nothing on the map until the last one landed: that was the wait. Now the
+  // first page is read on its own and drawn as soon as it arrives, and the
+  // rest follow CARBON_PAGES_AT_ONCE at a time, each batch drawn as it lands.
+  // The row says how many are held and that it is still reading, so a part-read
+  // map never reads as the whole catalogue.
   const read = async () => {
     const feats = [];
     let total = null;
-    for (let page = 0; page < CARBON_PLUME_PAGES; page++) {
-      setLayerState(cfg.id, `reading Carbon Mapper, page ${page + 1}\u2026`);
-      let j;
-      try { j = await getJson(`${CARBON_API}?sort=desc&limit=1000&offset=${page * 1000}`, 60000); }
-      catch (e) { if (!feats.length) { setLayerState(cfg.id, `Carbon Mapper did not answer (${e.message})`); return; } break; }
-      const items = j.items || j.features || [];
-      if (total === null && j.total_count != null) total = Number(j.total_count);
-      for (const it of items) {
-        const g = it.geometry_json || it.geometry;
-        const at = g && g.coordinates;
-        if (!at || !isFinite(Number(at[0])) || !isFinite(Number(at[1]))) continue;
-        feats.push({ type: "Feature", geometry: { type: "Point", coordinates: [Number(at[0]), Number(at[1])] },
-          properties: {
-            plume_id: it.plume_id || it.id || "", gas: it.gas || "",
-            seen: it.scene_timestamp || it.datetime || "", instrument: it.instrument || "",
-            platform: it.platform || "", quality: it.plume_quality || "",
-            sector: it.sector || (it.source && it.source.sector) || "",
-            emission: it.emission_auto != null ? it.emission_auto : it.emission,
-            emission_uncertainty: it.emission_uncertainty_auto != null ? it.emission_uncertainty_auto : it.emission_uncertainty,
-            wind_speed: it.wind_speed_avg_auto, wind_direction: it.wind_direction_avg_auto,
-            collection: it.collection || "",
-            picture: it.plume_png || it.plume_rgb_png || "",
-            bounds: Array.isArray(it.plume_bounds) && it.plume_bounds.length === 4 ? it.plume_bounds.join(",") : "",
-          } });
+    const draw = (done) => {
+      held = feats;
+      if (map.getSource(src)) map.getSource(src).setData({ type: "FeatureCollection", features: feats });
+      setLayerState(cfg.id, `${feats.length.toLocaleString()} plumes` +
+        (total ? ` of ${total.toLocaleString()} published` : "") +
+        (done ? ` \u00b7 their own pictures from zoom ${CARBON_PLUME_ZOOM}` : ", still reading\u2026"));
+    };
+    let page = 0, ended = false;
+    while (page < CARBON_PLUME_PAGES && !ended) {
+      const batch = [];
+      for (let k = 0; k < (feats.length ? CARBON_PAGES_AT_ONCE : 1) && page + k < CARBON_PLUME_PAGES; k++) batch.push(page + k);
+      let got;
+      try {
+        got = await Promise.all(batch.map((n) =>
+          getJson(`${CARBON_API}?sort=desc&limit=1000&offset=${n * 1000}`, 60000)));
+      } catch (e) {
+        if (!feats.length) { setLayerState(cfg.id, `Carbon Mapper did not answer (${e.message})`); return; }
+        break;
       }
-      if (items.length < 1000) break;
+      for (const j of got) {
+        const items = j.items || j.features || [];
+        if (total === null && j.total_count != null) total = Number(j.total_count);
+        for (const it of items) {
+          const f = asFeature(it);
+          if (f) feats.push(f);
+        }
+        if (items.length < 1000) ended = true;
+      }
+      page += batch.length;
+      draw(ended || page >= CARBON_PLUME_PAGES);
     }
-    held = feats;
-    if (map.getSource(src)) map.getSource(src).setData({ type: "FeatureCollection", features: feats });
-    setLayerState(cfg.id, `${feats.length.toLocaleString()} plumes` +
-      (total ? ` of ${total.toLocaleString()} published` : "") +
-      ` \u00b7 their own pictures from zoom ${CARBON_PLUME_ZOOM}`);
   };
 
   // Each plume's own picture, at the bounds Carbon Mapper give for it. Only
@@ -5204,10 +5230,16 @@ function moveZoomButtons() {
   const group = document.querySelector(".maplibregl-ctrl-bottom-right .maplibregl-ctrl-group");
   if (holder && group && holder.insertBefore) holder.insertBefore(group, holder.firstChild);
   // The reload button is in the page itself (index.html), clickable before the
-  // map loads; it moves under the Globe and Flat map choices here. The view it keeps is
+  // map loads; it moves into the right column here. The view it keeps is
   // written as the map moves, so a click needs nothing from this script.
+  //
+  // It sits as its own row under the settings box, not inside it. Inside, it
+  // was the last thing in a box that scrolls and stops at 48vh, so on a short
+  // window the button and its words were cut off at the bottom edge. As a row
+  // of its own it is never clipped, and because it is in the column's flow
+  // rather than floating over it, it covers nothing either.
   const wrap = document.getElementById("reload-wrap");
-  const under = document.querySelector(".view-choices");
+  const under = document.querySelector(".right-col");
   if (under && wrap && under.appendChild && wrap.parentNode !== under) {
     under.appendChild(wrap);
     if (wrap.classList) wrap.classList.remove("reload-early");
diff --git a/map/index.html b/map/index.html
index 0e720be..59da91b 100644
--- a/map/index.html
+++ b/map/index.html
@@ -28,12 +28,15 @@
   /* Beside Eyes' own search button, top right. */
   .reload-wrap{display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:11.5px;color:var(--dim)}
   .reload-early{position:absolute;top:16px;right:9px;z-index:4;background:rgba(31,28,21,.94);border:1px solid var(--rule)}
-  .view-choices .reload-wrap{padding:8px 0 0;background:none;border:0}
+  /* Its own row under the settings box: it keeps its height whatever the
+     box above does, and the box above scrolls within what is left. */
+  .right-col > .reload-wrap{flex:0 0 auto;margin-top:6px;padding:5px 9px;overflow:visible}
+  .right-col > #basemaps{flex:0 1 auto;min-height:0}
   /* A row's tools and chips stay put away while it is unticked. */
   .facet[hidden]{display:none}
   #reload-map{width:26px;height:26px;border-radius:4px;border:0;cursor:pointer;flex:none;
     background:#fff;color:#333;font:16px/26px system-ui,sans-serif;box-shadow:0 0 0 2px rgba(0,0,0,.1)}
-  .reload-cap{line-height:1.2;max-width:90px}
+  .reload-cap{line-height:1.2;max-width:none;flex:1;min-width:0}
   /* Layer rows in the layers box, laid out like Global Safety Net's own list:
      a small square of the layer's colour, the name, little space between. A
      row's line of detail (its count, or why it is empty) shows once it is ticked. */
diff --git a/map/test.mjs b/map/test.mjs
index 2b3e1f6..0056897 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2099,7 +2099,15 @@ console.log("\nCarbon Mapper's plumes, from their own platform");
         /const CARBON_API = `\$\{WORKER\}\/carbonmapper`;/.test(src) &&
         o.PANEL_ORDER.includes("carbon_plumes") && o.PANEL_REMOVED.has("site_carbon_mapper_waste"));
   check("it pages through the catalogue and says how much of it is held",
-        /offset=\$\{page \* 1000\}/.test(src) && /of \$\{total\.toLocaleString\(\)\} published/.test(src));
+        /offset=\$\{n \* 1000\}/.test(src) && /of \$\{total\.toLocaleString\(\)\} published/.test(src));
+  // The first page is read alone and drawn at once; the rest follow a few at a
+  // time, each batch drawn as it lands, and the row says it is still reading.
+  check("the plumes are drawn as they arrive, not after the last page",
+        /const CARBON_PAGES_AT_ONCE = 3;/.test(src) &&
+        /feats\.length \? CARBON_PAGES_AT_ONCE : 1/.test(src) &&
+        /await Promise\.all\(batch\.map\(/.test(src) &&
+        /draw\(ended \|\| page >= CARBON_PLUME_PAGES\)/.test(src) &&
+        /, still reading/.test(src));
   check("closer in, each plume draws its own picture at the bounds Carbon Mapper give it",
         /const CARBON_PLUME_ZOOM = 10/.test(src) && /type: "image", url: p\.picture/.test(src) &&
         /coordinates: \[\[w, n\], \[e2, n\], \[e2, s2\], \[w, s2\]\]/.test(src));
@@ -2476,6 +2484,19 @@ console.log("\nbuildings stand up with the terrain");
   check("nothing orange, yellow or neon in the walls", /"fill-extrusion-color": "#7C7468"/.test(body));
 }
 
+console.log("\nthe reload row is not clipped, and covers nothing");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
+  check("it moves into the right column, not inside the box that scrolls",
+        /const under = document\.querySelector\("\.right-col"\);/.test(src) && /under\.appendChild\(wrap\)/.test(src));
+  check("it keeps its height while the settings box scrolls in what is left",
+        /\.right-col > \.reload-wrap\{flex:0 0 auto;[^}]*overflow:visible\}/.test(index) &&
+        /\.right-col > #basemaps\{flex:0 1 auto;min-height:0\}/.test(index));
+  check("in the column's flow, so it sits over nothing", !/\.view-choices \.reload-wrap/.test(index));
+  check("its words are given the room to wrap", /\.reload-cap\{line-height:1\.2;max-width:none/.test(index));
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
    if "const BUILDINGS_SOURCE = {" not in app:
        sys.exit("patch_0920hi.py has to be applied and committed first.")
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
