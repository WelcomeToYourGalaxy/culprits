#!/usr/bin/env python3
"""
Nusantara Atlas: every layer listed under its category as indented tick rows,
any number shown at once, instead of a drop-down per category.
Run from the culprits folder, after git pull:

    python3 patch_0928.py

then:  node map/test.mjs
"""
import pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
app_path = ROOT / "map" / "app.js"
if not app_path.exists():
    sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits). Nothing was written.")
app = app_path.read_text(encoding="utf-8")
if 'facet ns-list' in app:
    sys.exit("Already applied - nothing to do.")
if "function mymapsTitles(" not in app:
    sys.exit("Run git pull first. Nothing was written.")
DIFF = r'''diff --git a/map/app.js b/map/app.js
index 0e17f69..50f590a 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3312,45 +3312,64 @@ async function addWmsMenuLayer(cfg) {
   if (!layers.length) { setLayerState(cfg.id, "the map server did not list its layers"); return; }
   layers.sort((a, b) => a.title.localeCompare(b.title));
   cfg._layers = layers;
-  cfg._pick = cfg._pick || 0;
-  const src = `${cfg.id}-img`;
   const tilesFor = (l) => `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(l.name)}&STYLES=` +
     `&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`;
-  map.addSource(src, { type: "raster", tileSize: 256, attribution: cfg.attribution || "", tiles: [tilesFor(layers[cfg._pick])] });
-  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: src, paint: { "raster-opacity": 0.85 } });
-  const menu = document.createElement("div");
-  menu.className = "facet";
   layers.forEach((l) => { l.cat = categoryOf(`${l.title} ${l.name} ${l.about}`, NUSANTARA_CATEGORIES); });
-  layers[cfg._pick]._picked = true;
+  // The same title served twice (the site runs two map servers) says which.
+  const seen = {};
+  layers.forEach((l) => { seen[l.title] = (seen[l.title] || 0) + 1; });
+  const lid = (i) => `${cfg.id}-w${i}`;
+  cfg._layerIds = layers.map((l, i) => lid(i));
+  const on = new Set();
+  // Every layer in a list under its category, indented like the layers box's
+  // own rows; any number can be ticked at once.
+  const menu = document.createElement("div");
+  menu.className = "facet ns-list";
+  const names = [...NUSANTARA_CATEGORIES.map((r) => r[0]), "Other"].filter((n) => layers.some((l) => l.cat === n));
+  menu.innerHTML = names.map((n) => `<div class="ns-cat">${escapeHtml(n)} <span>${layers.filter((l) => l.cat === n).length}</span></div>` +
+    layers.map((l, i) => l.cat !== n ? "" :
+      `<label class="ns-row" title="${escapeHtml(l.about || "")}"><input type="checkbox" data-ns="${i}">` +
+      `<span>${escapeHtml(l.title)}${seen[l.title] > 1 ? ` <em>(${escapeHtml(l.base.replace(/^https?:\/\//, "").split("/")[0])})</em>` : ""}</span></label>`).join("")).join("");
   const row = document.querySelector(`[data-layer="${cfg.id}"]`);
   const anchor = row && row.closest ? row.closest("label") : null;
   if (anchor && anchor.after) anchor.after(menu);
-  const show = () => {
-    const l = layers[cfg._pick];
-    setLayerState(cfg.id, `${l.title}${l.about ? " \u2014 " + l.about.slice(0, 120) : ""}`);
-  };
-  categoryMenu(menu, layers, NUSANTARA_CATEGORIES, "Layer", (i) => {
-    if (i == null) return;
-    cfg._pick = i;
-    const s = map.getSource(src);
-    if (s && s.setTiles) s.setTiles([tilesFor(layers[cfg._pick])]);
+  const apply = (vis) => layers.forEach((l, i) => {
+    if (map.getLayer(lid(i))) map.setLayoutProperty(lid(i), "visibility", vis === "visible" && on.has(i) ? "visible" : "none");
+  });
+  cfg.afterVisibility = apply;
+  const show = () => setLayerState(cfg.id, on.size ? `${on.size} of ${layers.length} layers shown` : `${layers.length} layers \u2014 tick the ones to show`);
+  menu.addEventListener("change", (e) => {
+    const cb = e.target.closest && e.target.closest("[data-ns]");
+    if (!cb) return;
+    e.stopPropagation();
+    const i = Number(cb.dataset.ns);
+    if (cb.checked) {
+      on.add(i);
+      if (!map.getLayer(lid(i))) {
+        map.addSource(lid(i), { type: "raster", tileSize: 256, attribution: cfg.attribution || "", tiles: [tilesFor(layers[i])] });
+        map.addLayer({ id: lid(i), type: "raster", source: lid(i), paint: { "raster-opacity": 0.85 } });
+      }
+    } else on.delete(i);
+    apply(visibility.get(cfg.id) || "none");
     show();
-  }, "Choose a layer in this category\u2026");
+  });
   map.on("click", async (e) => {
-    if ((visibility.get(cfg.id) || "visible") !== "visible" || map.getLayoutProperty(`${cfg.id}-raster`, "visibility") === "none") return;
-    const l = layers[cfg._pick], b = map.getBounds(), c = map.getCanvas();
+    if ((visibility.get(cfg.id) || "visible") !== "visible" || !on.size) return;
+    const b = map.getBounds(), c = map.getCanvas();
     const w = c.clientWidth || 800, h = c.clientHeight || 600;
     const pt = map.project(e.lngLat);
-    const q = `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${encodeURIComponent(l.name)}&QUERY_LAYERS=${encodeURIComponent(l.name)}` +
-      `&STYLES=&SRS=EPSG:4326&BBOX=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&WIDTH=${w}&HEIGHT=${h}` +
-      `&X=${Math.round(pt.x)}&Y=${Math.round(pt.y)}&INFO_FORMAT=application/json&FEATURE_COUNT=5`;
-    try {
-      const j = await getJson(q);
-      const feats = j.features || [];
-      if (!feats.length) return;
-      new maplibregl.Popup({ closeButton: true, maxWidth: "340px" }).setLngLat(e.lngLat)
-        .setHTML(`<b>${escapeHtml(l.title)}</b>` + feats.map((f) => `<table class="meta">${fieldRows(f.properties || {})}</table>`).join("<hr>")).addTo(map);
-    } catch (err) { /* nothing there, or the server declined */ }
+    const parts = [];
+    for (const i of on) {
+      const l = layers[i];
+      const q = `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${encodeURIComponent(l.name)}&QUERY_LAYERS=${encodeURIComponent(l.name)}` +
+        `&STYLES=&SRS=EPSG:4326&BBOX=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&WIDTH=${w}&HEIGHT=${h}` +
+        `&X=${Math.round(pt.x)}&Y=${Math.round(pt.y)}&INFO_FORMAT=application/json&FEATURE_COUNT=5`;
+      try {
+        const feats = (await getJson(q)).features || [];
+        if (feats.length) parts.push(`<b>${escapeHtml(l.title)}</b>` + feats.map((f) => `<table class="meta">${fieldRows(f.properties || {})}</table>`).join("<hr>"));
+      } catch (err) { /* nothing there, or the server declined */ }
+    }
+    if (parts.length) new maplibregl.Popup({ closeButton: true, maxWidth: "340px" }).setLngLat(e.lngLat).setHTML(parts.join("<hr>")).addTo(map);
   });
   show();
   applyVisibility(cfg.id);
@@ -7852,6 +7871,12 @@ function arrangePanel() {
       "#layers .facet.fold-hide{display:none}" +
       "#layers .grip{margin-left:auto;padding:0 2px 0 6px;color:var(--dim);opacity:.55;cursor:grab;touch-action:none;font-size:13px;line-height:1}" +
       "#layers .dragging{opacity:.45}" +
+      "#layers .ns-list{display:block;padding:2px 0 6px 22px;max-height:340px;overflow:auto}" +
+      "#layers .ns-cat{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:6px 0 2px}" +
+      "#layers .ns-cat span{opacity:.7}" +
+      "#layers .ns-row{display:flex;align-items:flex-start;gap:6px;margin:2px 0 2px 10px;font-size:12px;line-height:1.3;cursor:pointer}" +
+      "#layers .ns-row input{margin:1px 0 0}" +
+      "#layers .ns-row em{color:var(--dim);font-style:normal;font-size:11px}" +
       "#layers .toc-pinned{position:sticky;bottom:14px;z-index:2;background:#1F1C15;box-shadow:0 -6px 8px -4px rgba(0,0,0,.5);max-height:45vh;overflow:auto;margin-top:6px}" +
       "#layers .bt-kinds{display:block;padding:2px 0 6px 22px}" +
       "#layers .bt-all{display:flex;gap:4px;margin:2px 0 4px}" +
diff --git a/map/test.mjs b/map/test.mjs
index c677740..6df2c10 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2033,7 +2033,8 @@ console.log("\nNusantara Atlas and Global Forest Watch, by category");
   check("integrated alerts are Forest Change", categoryOf("Integrated deforestation alerts", G) === "Forest Change");
   check("mangrove extent is Land Cover", categoryOf("Global mangrove extent", G) === "Land Cover");
   check("a layer no rule claims goes under Other, not away", categoryOf("xyz 123", G) === "Other");
-  check("both menus use the category chips", (src.match(/categoryMenu\(menu, /g) || []).length === 2);
+  check("Global Forest Watch uses the category chips", (src.match(/categoryMenu\(menu, /g) || []).length === 1);
+  check("Nusantara lists every layer under its category, indented, any number ticked", /menu\.className = "facet ns-list"/.test(src) && /class="ns-row"/.test(src) && /#layers \.ns-row\{/.test(src));
 }
 
 console.log("\nEPA facilities at every zoom");
'''

with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False, encoding="utf-8") as f:
    f.write(DIFF)
chk = subprocess.run(["git", "apply", "--check", f.name], cwd=ROOT, capture_output=True, text=True)
if chk.returncode:
    sys.exit("The files differ from the copy this was made for. Run git pull first. Nothing was written. " + chk.stderr)
subprocess.run(["git", "apply", f.name], cwd=ROOT, check=True)
print("Done. Test with: node map/test.mjs")
