#!/usr/bin/env python3
"""
The layers column drags wider; the two modelled meat rows work again; the reefs
keep drawing as you zoom in.

Run from the repo root:  python3 patch_1012.py

Needs patch_1011.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js      The layers column's right edge is a handle: drag it wider for
                  long layer names, drag it back for more map, double-click to
                  put it where it was.
                  The load handler dispatches by route and sends anything it
                  does not recognise to the archive builder, which asks for
                  map/tiles/<id>.pmtiles. The two modelled meat rows were given
                  routes only ensureLayer knew, so at load they asked for
                  archives that never existed and failed. Both dispatches now
                  name them, and both rows are lazy.
                  The Atlas's own picture of the reefs carried maxzoom 12 and
                  minzoom 12, so it drew at no zoom at all: from 12 in there was
                  nothing but the Atlas's vector shapes, and when those do not
                  arrive the reefs vanished as you zoomed toward them. Both reef
                  pictures now run to the top.
  map/index.html  The column's drag edge.
  map/test.mjs    Checks for all of it.
  HANDOFF.md      What broke and why.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index f4ebe37..2960ac9 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -101,6 +101,24 @@ broken menu.
 
 ---
 
+## Two things that broke, and why
+
+**The two modelled meat rows.** The load handler dispatches by route with a
+chain of `else if`s and everything it does not recognise falls through to the
+archive builder, which asks for `map/tiles/<id>.pmtiles`. Splitting the abattoir
+atlas's parts into rows gave them routes `cafo` and `glw`, which only
+`ensureLayer` knew, so at load both asked for archives that never existed and
+failed. Both dispatches now name them, and both rows are lazy.
+
+**The reefs close in.** `${id}-raster`, the Atlas's own picture, carried
+`maxzoom: cfg.drawFrom` - which is 12, the same as its `minzoom` - so it drew
+at no zoom at all. From 12 in there was nothing but the Atlas's vector shapes,
+and when those do not arrive the reefs vanished as you zoomed toward them. Both
+pictures now run to the top: UNEP-WCMC's under everything, the Atlas's from 12
+under its own shapes.
+
+---
+
 ## Areas at the world view
 
 A sitemap layer's areas get an edge as well as a fill, and a point at each
diff --git a/map/app.js b/map/app.js
index 7ecdbae..2eaf066 100644
--- a/map/app.js
+++ b/map/app.js
@@ -376,9 +376,9 @@ const LAYERS = [
                        "no": "registered, does not slaughter",
                        "not stated": "registry does not say" } },
     note: "Most of these are not slaughterhouses: farms, dairies, processors, transporters, hatcheries and zoos are registered animal-use sites too. Slaughter is marked yes or no only where a registry says; for most it says neither. Hollow points are placed at a town, not the site. Records with no position at all are not drawn." },
-  { id:"abattoir_cafo",        name:"Confined animal feeding operations, modelled (Climate TRACE)", unit:"modelled facilities", colour:"#7B6A4E", route:"cafo", ready:true, off: true,
+  { id:"abattoir_cafo",        name:"Confined animal feeding operations, modelled (Climate TRACE)", unit:"modelled facilities", colour:"#7B6A4E", route:"cafo", ready:true, off: true, lazy:true,
     note: "A model's estimate from satellite imagery and census data, not a permit register: nothing here has necessarily been visited, licensed or confirmed by any authority. Hollow where Climate TRACE give an area rather than the facility's own position." },
-  { id:"abattoir_glw",         name:"Livestock density, modelled (FAO Gridded Livestock of the World 4, 2020)", unit:"animals per square km", colour:"#6E6A55", route:"glw", ready:true, off: true,
+  { id:"abattoir_glw",         name:"Livestock density, modelled (FAO Gridded Livestock of the World 4, 2020)", unit:"animals per square km", colour:"#6E6A55", route:"glw", ready:true, off: true, lazy:true,
     note: "A modelled grid of where animals are kept, not a count of farms. FAO fit census totals to land cover and other predictors, so a dense square means the model puts animals there." },
   { id:"slavery_cases",        name:"Identified trafficking cases", unit:"identified cases", colour:"#7A6A72", route:"country", ready:true, off:true,
     note: "Detection, not prevalence. A country with a large count has organisations filing records; a country with none may have no one counting." },
@@ -3318,6 +3318,43 @@ function showRowFor(id) {
   }
 }
 
+// The layers column's right edge is a handle. Long layer names were being cut
+// at 290 pixels with no way to see the rest; now the column is dragged as wide
+// as it needs to be and dragged back for more map. Double-click puts it back to
+// where it started. The width is the same --box-w everything else measures
+// from, so the zoom strip and the defence frame move with it.
+function columnEdge() {
+  const col = typeof document !== "undefined" && document.querySelector ? document.querySelector(".left-col") : null;
+  if (!col || typeof col.querySelector !== "function" || col.querySelector(".col-edge") ||
+      typeof document.createElement !== "function" || typeof getComputedStyle !== "function") return;
+  const root = document.documentElement;
+  const START = 290, MIN = 220, MAX = 680;
+  const edge = document.createElement("div");
+  edge.className = "col-edge";
+  edge.title = "Drag to make the layers box wider or narrower. Double-click to put it back.";
+  edge.setAttribute("aria-hidden", "true");
+  let from = 0, was = START;
+  const widthNow = () => {
+    const v = parseFloat(getComputedStyle(root).getPropertyValue("--box-w"));
+    return isFinite(v) ? v : START;
+  };
+  edge.addEventListener("pointerdown", (e) => {
+    from = e.clientX;
+    was = widthNow();
+    if (edge.setPointerCapture) edge.setPointerCapture(e.pointerId);
+    e.preventDefault();
+  });
+  edge.addEventListener("pointermove", (e) => {
+    if (!from) return;
+    const want = Math.max(MIN, Math.min(MAX, was + (e.clientX - from)));
+    root.style.setProperty("--box-w", `${Math.round(want)}px`);
+  });
+  const done = () => { from = 0; if (map && typeof map.resize === "function") map.resize(); };
+  edge.addEventListener("pointerup", done);
+  edge.addEventListener("pointercancel", done);
+  edge.addEventListener("dblclick", () => { root.style.setProperty("--box-w", `${START}px`); done(); });
+  col.appendChild(edge);
+}
 /* ---------- Carbon Mapper's plumes, read from its own data platform ---------- */
 
 // What was here before was the handful of waste-site plumes listed on our own
@@ -5225,7 +5262,13 @@ function addCoralLayer(cfg) {
     tiles: [`tint://${CORAL_CLASSES["Coral/Algae"].slice(1)}/allencoralatlas.org/geoserver/ows?SERVICE=WMS&VERSION=1.1.1` +
             `&REQUEST=GetMap&LAYERS=coral-atlas:benthic_data_verbose&STYLES=&SRS=EPSG:3857&BBOX={bbox-epsg-3857}` +
             `&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`] });
-  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: `${cfg.id}-wide`, maxzoom: cfg.drawFrom,
+  // The Atlas's own picture of the same reefs, from zoom 12 in, with no upper
+  // stop. It used to carry maxzoom: cfg.drawFrom, which is also 12, so it drew
+  // at no zoom at all: closer in there was nothing but the Atlas's vector
+  // shapes, and when those do not arrive - the Atlas is slow, and answers some
+  // squares and not others - the reefs simply vanished as you zoomed in. Now
+  // the picture stays underneath the shapes the whole way in.
+  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: `${cfg.id}-wide`,
     minzoom: CORAL_ATLAS_PICTURE_FROM, layout: { visibility: "none" }, paint: { "raster-opacity": 0.9 } });
   // Wider still, the Atlas's server runs out of time drawing so much reef, so
   // UNEP-WCMC's reef map stands in, in the same colour, and the row says so.
@@ -5248,8 +5291,11 @@ function addCoralLayer(cfg) {
     layout: { visibility: "none" }, paint: { "raster-opacity": 1, "raster-resampling": "nearest" } });
   map.addSource(`${cfg.id}-globe-near`, { type: "raster", tileSize: 256,
     attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC", tiles: [wcmc(256)] });
+  // No upper stop here either: UNEP-WCMC's reef map is the one thing that
+  // always answers, so it stays under everything else rather than handing over
+  // at zoom 12 and leaving a gap if the Atlas is silent.
   map.addLayer({ id: `${cfg.id}-world-near`, type: "raster", source: `${cfg.id}-globe-near`,
-    minzoom: CORAL_WORLD_SHARP, maxzoom: cfg.drawFrom,
+    minzoom: CORAL_WORLD_SHARP,
     layout: { visibility: "none" }, paint: { "raster-opacity": 0.9 } });
   bindHtmlPopup(`${cfg.id}-fill`, (p) =>
     `<b>${p.class_name || "Unclassified"}</b>` +
@@ -7689,6 +7735,15 @@ map.on("load", () => {
       else if (cfg.route === "wmts") addWmtsLayer(cfg);
       else if (cfg.route === "cerulean") addCeruleanLayer(cfg);
       else if (cfg.route === "coral") addCoralLayer(cfg);
+      // Routes this loop does not know fall through to the archive builder,
+      // which asks for map/tiles/<id>.pmtiles and fails on a layer that never
+      // had one. That is what broke the two modelled meat rows when they were
+      // split out: named here, and marked lazy so the first tick builds them.
+      else if (cfg.route === "cafo") addCafoLayer(cfg);
+      else if (cfg.route === "glw") addGlwLayer(cfg);
+      else if (cfg.route === "carbonmapper") {
+        addCarbonMapperLayer(cfg).catch((e) => setLayerState(cfg.id, `failed (${e.message})`));
+      }
       else if (cfg.route === "country") {
         // Async: without a catch a failure here becomes an unhandled rejection
         // and the layer just silently never appears.
@@ -7700,6 +7755,7 @@ map.on("load", () => {
     }
   });
   buildPanel();
+  columnEdge();
   updateZoomState();
   LAYERS.filter((c) => c.ready && c.route === "worker").forEach(refreshLiveLayer);
 });
diff --git a/map/index.html b/map/index.html
index 91d306c..51a6250 100644
--- a/map/index.html
+++ b/map/index.html
@@ -98,6 +98,13 @@
   .fit-box code{display:block;margin-top:6px;color:var(--dim);word-break:break-all}
 
   /* Three boxes down the left: the name, the settings, the layers. */
+  /* The right edge of the layers column is a handle: drag it out for long
+     layer names, drag it back for more map. Double-click puts it back. */
+  .col-edge{position:absolute;top:0;right:-7px;width:12px;bottom:0;cursor:ew-resize;
+    z-index:6;touch-action:none;pointer-events:auto}
+  .col-edge::before{content:"";position:absolute;top:50%;right:5px;width:2px;height:34px;
+    margin-top:-17px;border-radius:2px;background:var(--rule)}
+  .col-edge:hover::before{background:var(--dim)}
   .left-col{position:absolute;top:16px;left:16px;width:var(--box-w);bottom:calc(16px + var(--legend-h,0px));
     display:flex;flex-direction:column;gap:8px;pointer-events:none}
   .left-col .panel{flex:1 1 auto}
diff --git a/map/test.mjs b/map/test.mjs
index 7a6b36f..e748acc 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1668,8 +1668,9 @@ console.log("\ncoral, the row's line");
 console.log("\ncoral at every zoom");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
-  check("wider than 12, the Atlas's own picture is drawn", /allencoralatlas\.org\/geoserver\/ows\?SERVICE=WMS/.test(src) &&
-        /id: `\$\{cfg\.id\}-raster`, type: "raster", source: `\$\{cfg\.id\}-wide`, maxzoom: cfg\.drawFrom/.test(src));
+  check("from 12 in, the Atlas's own picture is drawn under its shapes, with no upper stop",
+        /allencoralatlas\.org\/geoserver\/ows\?SERVICE=WMS/.test(src) &&
+        /id: `\$\{cfg\.id\}-raster`, type: "raster", source: `\$\{cfg\.id\}-wide`,\n\s*minzoom: CORAL_ATLAS_PICTURE_FROM/.test(src));
   check("…in the coral colour, not the server's black", /tint:\/\/\$\{CORAL_CLASSES\["Coral\/Algae"\]\.slice\(1\)\}/.test(src));
   const tint = new Function(src.slice(src.indexOf("function tintPixels("), src.indexOf('maplibregl.addProtocol("latclip"')) + "; return tintPixels;")();
   const d = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]);
@@ -1692,7 +1693,7 @@ console.log("\nTrase, and coral at world zoom");
   check("the ramps carry no orange or yellow", !/#(F[A-F0-9]{5}|E[6-9A-F][0-9A-F]{2}[0-4][0-9A-F])/i.test(src.slice(src.indexOf("const TRASE_RAMPS"), src.indexOf("const traseCache"))));
   check("wider than zoom 12, coral shows UNEP-WCMC's map in the Atlas colour, with no gap",
         /id: `\$\{cfg\.id\}-world`, type: "raster", source: `\$\{cfg\.id\}-globe`, maxzoom: CORAL_WORLD_SHARP/.test(src) &&
-        /id: `\$\{cfg\.id\}-world-near`[\s\S]{0,160}minzoom: CORAL_WORLD_SHARP, maxzoom: cfg\.drawFrom/.test(src) &&
+        /id: `\$\{cfg\.id\}-world-near`[\s\S]{0,160}minzoom: CORAL_WORLD_SHARP,\n/.test(src) &&
         /tint:\/\/\$\{CORAL_CLASSES\["Coral\/Algae"\]\.slice\(1\)\}\/data-gis\.unep-wcmc\.org/.test(src));
   check("from the world view the reefs are drawn coarse, so a reef a few hundred metres across can be seen",
         /wcmc\(96\)/.test(src) && /wcmc\(256\)/.test(src) && /"raster-resampling": "nearest"/.test(src));
@@ -2056,6 +2057,19 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\nthe column's edge, the meat rows, the reefs close in");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
+  check("the layers column is dragged wider by its right edge, and put back by a double-click",
+        /function columnEdge\(\)/.test(src) && /root\.style\.setProperty\("--box-w"/.test(src) && /\.col-edge\{position:absolute/.test(index));
+  check("the two modelled meat rows are built by the routes that know them",
+        /else if \(cfg\.route === "cafo"\) addCafoLayer\(cfg\);/.test(src) && /else if \(cfg\.route === "glw"\) addGlwLayer\(cfg\);/.test(src) &&
+        /id:"abattoir_cafo"[^\n]*lazy:true/.test(src) && /id:"abattoir_glw"[^\n]*lazy:true/.test(src));
+  check("close in the reefs still draw: neither picture stops at zoom 12",
+        !/source: `\$\{cfg\.id\}-wide`, maxzoom/.test(src) && !/minzoom: CORAL_WORLD_SHARP, maxzoom/.test(src));
+}
+
 console.log("\nCarbon Mapper's plumes, from their own platform");
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
    if "function columnEdge()" in app:
        print("Already applied - nothing to do.")
        return
    if "CARBON_API" not in app:
        sys.exit("patch_1011.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
