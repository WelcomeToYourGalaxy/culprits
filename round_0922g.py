#!/usr/bin/env python3
"""
Round of 22 September (5): colours and keys for the driver pictures and DIST-ALERT, Trase facilities
from a weekly copy, Materials research's maps found, EJAtlas and Nusantara faster, a second check; atlas_plates.py goes past a PDF that will not come.
Built against culprits main at 0f7f616.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 8d1eb55..a2c83dd 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -451,6 +451,49 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 22 September (5): what check-sources.mjs found
+
+Read from the owner's run of `map/check-sources.mjs`:
+
+- **Drivers of tree cover loss (WRI and Google) in colour, with a key.** Its
+  COG holds codes 1-7 (uint8, 0 = nothing); the Zenodo record (Sims et al.
+  2025) gives the codes: permanent agriculture 1, hard commodities 2, shifting
+  cultivation 3, logging 4, wildfire 5, settlements and infrastructure 6,
+  other natural disturbances 7. `GFW_KEYS` gives each a colour; the COG tile
+  URL carries `&colormap=` (titiler's form); the key shows under the row and,
+  indented, in the Showing box (`CATALOGUE_KEYS`). `gfwPickAsset` now takes
+  `default.tif`/`class.tif`, not an `intensity` COG.
+- **DIST-ALERT** (int16, 20,759-32,083): coloured by its first digit, 2 low
+  and 3 high confidence, as ranges.
+- **WUR driver classes** (1-11): coloured, but keyed "Class 1" to "Class 11":
+  GFW's record names no driver per number. Names wait on a source that gives
+  the mapping.
+- **Not yet coloured**: Curtis/TSC drivers (`tsc_tree_cover_loss_drivers`) are
+  GFW's own raster tile caches per canopy threshold (tcd_10 ... tcd_75), whose
+  colouring is GFW's; `tsc_drivers` has only a pending cache; `umd_drivers`
+  lists no assets at all.
+- **Trase facilities**: resources.trase.earth sends no CORS header, so the
+  browser cannot read them (the soy silos row). culprits-tiles-more's
+  `scripts/trase.py` now copies each file to `trase/facilities/` weekly and
+  gives each type its own `base`; the map reads `hit.base`. The eight rows are
+  NOT LIVE.
+- **Materials research** is an Experience Builder app ("Web Experience");
+  its maps are named in `dataSources` and are now read first
+  (`arcgisExperienceIds`), with a larger allowance (40 items).
+- **EJAtlas**: first page gives `count`; the rest are read four at a time.
+- **Nusantara's fire alerts**: 2-12 s per picture on their server; squares are
+  now 512 px (a quarter as many requests).
+- **Seas of Plastic**: all three files answer with CORS; kept.
+- **Wreckers of the Earth**: the map's GeoJSON answers, its layers do not (HTML,
+  no CORS) at the `/en/` address; round 2 of the check tries the map's own
+  address without the language part before a copy is made.
+- **USDA explorers**: every request failed in about 0.3 s (the connection, not
+  the service). Round 2 asks the USDA hosts that are still up.
+- **Wastewater**: the archives are 404; the KNB package lists
+  `N_PourPoint_And_Watershed.zip`, `FIO_PourPoint_And_Watershed.zip` and
+  `Global_N_Coastal_Plumes_tifs.zip`; round 2 asks for their addresses.
+- `node map/check-sources.mjs round2` runs without the long GFW and KNB parts.
+
 ## The Atlas for the End of the World's maps, on this map (22 September)
 
 Asked for: opening a hotspot or a city zooms to it and shows the Atlas's own
diff --git a/map/app.js b/map/app.js
index cea9db7..2886fde 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3034,16 +3034,33 @@ async function readKml(cfg) {
 // ArcGIS: an app (web app, experience) names its web map; the web map names its
 // layers and how each shows a clicked feature. Every feature is read.
 const AGOL = "https://www.arcgis.com/sharing/rest/content/items";
+// An Experience Builder app (a "Web Experience", like Materials research) names
+// its maps in dataSources; those are read first. Its data also carries dozens of
+// other ids (images, widgets, themes), and reading them in order used the
+// twelve-item allowance up before a map was reached (22 September, round 5).
+function arcgisExperienceIds(text) {
+  let j = null;
+  try { j = JSON.parse(text); } catch (e) { return []; }
+  const out = [];
+  const walk = (o) => {
+    if (!o || typeof o !== "object") return;
+    if (typeof o.itemId === "string" && /^[0-9a-f]{32}$/.test(o.itemId) && /WEB_MAP|WEB_SCENE|FEATURE|MAP_SERVICE/i.test(String(o.type || ""))) out.push(o.itemId);
+    for (const v of Object.values(o)) walk(v);
+  };
+  walk(j.dataSources);
+  return [...new Set(out)];
+}
 async function arcgisWebmapsOf(itemId, seen = new Set()) {
-  if (seen.has(itemId) || seen.size > 12) return [];
+  if (seen.has(itemId) || seen.size > 40) return [];
   seen.add(itemId);
   const info = await getJson(`${AGOL}/${itemId}?f=json`);
   if (info.error) throw new Error(info.error.message || "item not shared publicly");
-  if (info.type === "Web Map") return [{ id: itemId, title: info.title }];
+  if (info.type === "Web Map" || info.type === "Web Scene") return [{ id: itemId, title: info.title }];
   if (info.type === "Feature Service" || info.type === "Map Service") return [{ service: info.url, title: info.title }];
   let text = "";
   try { text = await (await fetch(`${AGOL}/${itemId}/data?f=json`)).text(); } catch (e) { /* no data */ }
-  const ids = [...new Set((text.match(/\b[0-9a-f]{32}\b/g) || []).filter((x) => x !== itemId))];
+  const named = arcgisExperienceIds(text);
+  const ids = named.length ? named : [...new Set((text.match(/\b[0-9a-f]{32}\b/g) || []).filter((x) => x !== itemId))];
   const out = [];
   for (const id of ids) {
     try { out.push(...(await arcgisWebmapsOf(id, seen))); } catch (e) { /* not public or not a map */ }
@@ -3652,8 +3669,23 @@ function pointOf(r) {
 async function readEjatlas(cfg) {
   const items = [];
   let url = `${cfg.api}?limit=500&offset=0`, pages = 0, sample = null;
-  while (url && pages < 40) {
-    const j = await getJson(url.replace(/^http:/, "https:"), 60000);
+  // The first page says how many there are; the rest are then read four at a
+  // time rather than one after another (about a second and a quarter each),
+  // which is what made the row slow (22 September, round 5).
+  const pagesRead = [];
+  const first = await getJson(url, 60000);
+  pagesRead.push(first);
+  if (Number.isFinite(Number(first.count)) && first.next) {
+    const offsets = [];
+    for (let o = 500; o < Number(first.count) && offsets.length < 39; o += 500) offsets.push(o);
+    for (let i = 0; i < offsets.length; i += 4) {
+      const got = await Promise.all(offsets.slice(i, i + 4).map((o) =>
+        getJson(`${cfg.api}?limit=500&offset=${o}`, 60000).catch(() => null)));
+      got.forEach((j) => { if (j) pagesRead.push(j); });
+    }
+    url = null;
+  } else url = first.next;
+  const handle = (j) => {
     for (const r of j.results || []) {
       sample = sample || r;
       const g = pointOf(r);
@@ -3667,6 +3699,12 @@ async function readEjatlas(cfg) {
           `<table>${fieldRows(r, ["id", "slug", "image", "headline", "title", "name", "lat", "lon", "lng", "latitude", "longitude"])}</table>` +
           (link ? `<p><a href="${escapeHtml(link)}" target="_blank" rel="noopener">Open on EJAtlas</a></p>` : "") + `</div>` });
     }
+  };
+  pagesRead.forEach(handle);
+  // A service that does not give its count is read page by page, as before.
+  while (url && pages < 40) {
+    const j = await getJson(url.replace(/^http:/, "https:"), 60000);
+    handle(j);
     url = j.next; pages++;
   }
   if (!items.length && sample) console.warn(`[culprits] ejatlas: no position found in its records; their fields are ${Object.keys(sample).join(", ")}`);
@@ -3888,7 +3926,7 @@ async function readTraseFacilities(cfg) {
   try {
     const m = await getJson(cfg.manifest);
     const hit = (m.types || []).find((t) => t.id === cfg.facilityType);
-    if (hit && hit.file) { file = hit.file; base = m.base || base; }
+    if (hit && hit.file) { file = hit.file; base = hit.base || m.base || base; }   // the weekly copy, where one was made
   } catch (e) { /* the manifest is not built yet: use the file known when this was written */ }
   const gj = await getJson(base + file, 120000);
   const items = (gj.features || []).map((f, i) => {
@@ -4624,7 +4662,10 @@ async function addWmsMenuLayer(cfg) {
   layers.sort((a, b) => a.title.localeCompare(b.title));
   cfg._layers = layers;
   const tilesFor = (l) => `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(l.name)}&STYLES=` +
-    `&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`;
+    `&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=512&HEIGHT=512&FORMAT=image/png&TRANSPARENT=true`;
+  // Squares of 512 pixels, a quarter as many requests: Nusantara's server
+  // takes 2 to 12 seconds for each picture (measured 22 September), so the
+  // number asked for is what decides how long a layer takes to fill in.
   // The same title served twice (the site runs two map servers) says which.
   const seen = {};
   layers.forEach((l) => { seen[l.title] = (seen[l.title] || 0) + 1; });
@@ -4638,7 +4679,7 @@ async function addWmsMenuLayer(cfg) {
   const canRead = async (l) => {
     if (!(l.base in readable)) {
       try {
-        const r = await fetch(tilesFor(l).replace("{bbox-epsg-3857}", "0,0,1,1").replace("WIDTH=256&HEIGHT=256", "WIDTH=2&HEIGHT=2"));
+        const r = await fetch(tilesFor(l).replace("{bbox-epsg-3857}", "0,0,1,1").replace("WIDTH=512&HEIGHT=512", "WIDTH=2&HEIGHT=2"));
         readable[l.base] = r.ok;
       } catch (e) { readable[l.base] = false; }
     }
@@ -4690,7 +4731,7 @@ async function addWmsMenuLayer(cfg) {
             adding.delete(i);
             if (map.getLayer(lid(i))) return;
             const plain = tilesFor(layers[i]);
-            map.addSource(lid(i), { type: "raster", tileSize: 256, attribution: cfg.attribution || "",
+            map.addSource(lid(i), { type: "raster", tileSize: 512, attribution: cfg.attribution || "",
               tiles: [ok ? plain.replace(/^https:\/\//, "seen://") : plain] });
             map.addLayer({ id: lid(i), type: "raster", source: lid(i), paint: { "raster-opacity": 0.85 } });
             apply(visibility.get(cfg.id) || "none");
@@ -4760,6 +4801,73 @@ const GFW_ABOUT = {
   wdpa_licensed_protected_areas: "The World Database on Protected Areas as licensed to Global Forest Watch. There is a second worldwide row, the public release; the records do not say how the two differ beyond that.",
 };
 // Where a dataset is, where the record's own wording does not fit a title.
+// What a picture's pixel values mean, for the datasets Global Forest Watch
+// publishes as one GeoTIFF of numbers (drawn grey by its tile service unless it
+// is told a colour for each). Each is drawn in these colours and its key is
+// shown under its row and in the Showing box (22 September, round 5). Codes
+// are the publishers' own, as cited; nothing here is a guess at a code.
+const GFW_KEYS = {
+  // Sims et al. 2025, WRI and Google DeepMind; codes as the Zenodo record gives
+  // them (Driver_primary_code): 1 to 7.
+  wri_google_tree_cover_loss_drivers: { values: [
+    [1, "#8C5A4E", "Permanent agriculture"],
+    [2, "#6F5A7A", "Hard commodities (mining and energy)"],
+    [3, "#6E8058", "Shifting cultivation"],
+    [4, "#4F6E6A", "Logging"],
+    [5, "#B0707C", "Wildfire"],
+    [6, "#A9A39A", "Settlements and infrastructure"],
+    [7, "#5E6D8A", "Other natural disturbances"]],
+    source: "codes from the dataset's Zenodo record (Sims et al. 2025)" },
+  // DIST-ALERT's pixels carry the confidence as their first digit (2 low, 3
+  // high) and the date in the rest; its values run from 20,759 to 32,083.
+  umd_glad_dist_alerts: { ranges: [
+    [20000, 30000, "#9E7A86", "Low confidence"],
+    [30000, 40000, "#D9B8BF", "High confidence"]],
+    source: "the first digit of each pixel is its confidence" },
+  // Eleven classes; Global Forest Watch's record gives no name for each number,
+  // so the key names them by number rather than guessing which is which.
+  wur_integration_alert_drivers_class: { values: [
+    [1, "#8C5A4E", "Class 1"], [2, "#6F5A7A", "Class 2"], [3, "#6E8058", "Class 3"], [4, "#4F6E6A", "Class 4"],
+    [5, "#B0707C", "Class 5"], [6, "#A9A39A", "Class 6"], [7, "#5E6D8A", "Class 7"], [8, "#7A6A5C", "Class 8"],
+    [9, "#5C7A73", "Class 9"], [10, "#8A7486", "Class 10"], [11, "#6A6258", "Class 11"]],
+    source: "the record names no driver for each number; the kinds GFW describes include small- and large-scale agriculture, roads, mining and wildfire" },
+};
+const hexRgba = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(255);
+// The colour instruction the tile service takes (titiler's colormap).
+function gfwColormap(key) {
+  if (key.values) return Object.fromEntries(key.values.map(([v, c]) => [String(v), hexRgba(c)]));
+  return key.ranges.map(([lo, hi, c]) => [[lo, hi], hexRgba(c)]);
+}
+// Keys of the catalogue rows drawn now, for the Showing box.
+const CATALOGUE_KEYS = new Map();
+function catalogueKeyHtml(k) {
+  return (k.values || k.ranges).map((e) => {
+    const [c, label] = k.values ? [e[1], e[2]] : [e[2], e[3]];
+    return `<div class="lg-row lg-sub" style="padding-left:18px"><span class="lg-sw lg-key" style="background:${c}"></span>` +
+      `<span class="lg-nm">${escapeHtml(label)}</span></div>`;
+  }).join("");
+}
+function catalogueKeyShow(key, title, k) {
+  CATALOGUE_KEYS.set(key, { title, k });
+  const box = document.getElementById("layers");
+  const tick = box && box.querySelector ? box.querySelector(`[data-cat="${key}"]`) : null;
+  const row = tick && tick.closest ? tick.closest("label") : null;
+  if (row && row.after && !box.querySelector(`.facet[data-key-for="${key}"]`)) {
+    const el = document.createElement("div");
+    el.className = "facet cat-key";
+    el.dataset.keyFor = key;
+    el.innerHTML = catalogueKeyHtml(k) + `<div style="padding-left:18px;font-size:10.5px;color:var(--dim)">${escapeHtml(k.source)}</div>`;
+    row.after(el);
+  }
+  buildLegend();
+}
+function catalogueKeyHide(key) {
+  CATALOGUE_KEYS.delete(key);
+  const box = document.getElementById("layers");
+  const el = box && box.querySelector ? box.querySelector(`.facet[data-key-for="${key}"]`) : null;
+  if (el) el.remove();
+  buildLegend();
+}
 const GFW_WHERE = {
   intl_rivers_dam_hotspots: "the world\u2019s 50 major river basins",
 };
@@ -4796,7 +4904,10 @@ function gfwPickAsset(assets) {
   if (vec) return { how: "vector", slow: !/static/i.test(vec.asset_type), uri: vec.asset_uri, ...gfwZooms(vec) };
   const ras = kind(/raster tile cache/i);
   if (ras) return { how: "raster", uri: ras.asset_uri, ...gfwZooms(ras) };
-  const cog = kind(/^COG$/i, saved.filter((a) => /^s3:\/\//.test(a.asset_uri || "")));
+  // Of several COGs, the classification itself (default.tif, class.tif) before
+  // the "intensity" ones, which are only for fading the picture wider out.
+  const cogs = saved.filter((a) => /^s3:\/\//.test(a.asset_uri || "") && /^COG$/i.test(a.asset_type || ""));
+  const cog = cogs.find((a) => /\/(default|class)\.tif$/.test(a.asset_uri)) || cogs.find((a) => !/intensity/.test(a.asset_uri)) || cogs[0];
   if (cog) return { how: "cog", uri: GFW_COG_TILES + encodeURIComponent(cog.asset_uri), minzoom: 0, maxzoom: 12 };
   const waiting = (assets || []).some((a) => /tile cache/i.test(a.asset_type || "") && !/saved/i.test(a.status || ""));
   return { how: "none", waiting };
@@ -4890,6 +5001,7 @@ async function addGfwMenuLayer(cfg) {
     ? `${drawn.size} of ${items.length} datasets drawn`
     : `${items.length} datasets, each a row below`) + (leftOut.length ? ` \u00b7 ${leftOut.length} more are downloads only and have no row` : ""));
   const take = (d) => {
+    if (GFW_KEYS[d.id]) catalogueKeyHide(d.key);
     for (const id of drawn.get(d.id) || []) if (map.getLayer(id)) map.removeLayer(id);
     if (map.getSource(`${cfg.id}-${safe(d.id)}`)) map.removeSource(`${cfg.id}-${safe(d.id)}`);
     drawn.delete(d.id);
@@ -4916,7 +5028,10 @@ async function addGfwMenuLayer(cfg) {
       }
       const asset = gfwPickAsset(assets);
       const vec = asset.how === "vector" ? { asset_uri: asset.uri } : null;
-      const ras = asset.how === "raster" || asset.how === "cog" ? { asset_uri: asset.uri } : null;
+      const key = asset.how === "cog" ? GFW_KEYS[d.id] : null;
+      // A keyed GeoTIFF is asked for in its key's colours, one colour per code.
+      const ras = asset.how === "raster" || asset.how === "cog"
+        ? { asset_uri: key ? `${asset.uri}&colormap=${encodeURIComponent(JSON.stringify(gfwColormap(key)))}` : asset.uri } : null;
       const about = [d.meta.license ? `licence: ${d.meta.license}` : "", d.meta.source ? `source: ${String(d.meta.source).replace(/\[|\]\([^)]*\)/g, "")}` : ""].filter(Boolean).join("; ");
       if (vec) {
         const uri = vec.asset_uri;
@@ -4942,8 +5057,13 @@ async function addGfwMenuLayer(cfg) {
         }
       } else if (ras) {
         map.addSource(src, { type: "raster", tileSize: 256, tiles: [ras.asset_uri], minzoom: asset.minzoom, maxzoom: asset.maxzoom });
-        map.addLayer({ id: `${src}-r`, type: "raster", source: src, paint: { "raster-opacity": 0.8, "raster-saturation": -0.3 } });
+        // Keyed pictures keep their key's colours exactly and are not blurred
+        // between codes; others are toned down as before.
+        map.addLayer({ id: `${src}-r`, type: "raster", source: src, paint: key
+          ? { "raster-opacity": 0.9, "raster-resampling": "nearest" }
+          : { "raster-opacity": 0.8, "raster-saturation": -0.3 } });
         ids.push(`${src}-r`);
+        if (key) catalogueKeyShow(d.key, d.title, key);
       } else {
         setLayerState(cfg.id, `${d.title}: Global Forest Watch publishes no map tiles for this dataset (download only)`);
         rowSay(d.key, (asset.waiting
@@ -7737,7 +7857,7 @@ function buildLegend() {
     }
   }
 
-  if (!shown.length) { box.hidden = true; return; }
+  if (!shown.length && !(typeof CATALOGUE_KEYS !== "undefined" && CATALOGUE_KEYS.size)) { box.hidden = true; return; }
   box.hidden = false;
 
   // Each line takes a tick of its own, left of its colour, so a layer can be
@@ -7750,8 +7870,14 @@ function buildLegend() {
     `<span class="lg-nm">${c.name}</span>` +
     `<span class="lg-un">${c.unit || ""}</span></div>`).join("");
 
+  // A catalogue row drawn from a key: its title, then each colour and what it
+  // means, indented under it (22 September, round 5).
+  const keyed = typeof CATALOGUE_KEYS === "undefined" ? "" : [...CATALOGUE_KEYS.entries()].map(([key, { title, k }]) =>
+    `<div class="lg-row"><input type="checkbox" class="lg-on" data-lg-cat="${escapeHtml(key)}" checked aria-label="Hide ${escapeHtml(title)}" title="Hide this layer">` +
+    `<span class="lg-sw" style="background:none"></span><span class="lg-nm">${escapeHtml(title)}</span></div>` +
+    catalogueKeyHtml(k)).join("");
   box.innerHTML =
-    `<div class="lg-hd">Showing</div>${rows}` +
+    `<div class="lg-hd">Showing</div>${rows}${keyed}` +
     `<div class="lg-rule"></div>` +
     `<div class="lg-row"><span class="lg-sw lg-hollow"></span>` +
     `<span class="lg-nm">hollow</span>` +
@@ -7761,6 +7887,13 @@ function buildLegend() {
   if (!box.dataset.wired) {
     box.dataset.wired = "1";
     box.addEventListener("change", (e) => {
+      // A keyed catalogue row: unticked here, unticked in the layers box.
+      const c = e.target && e.target.closest && e.target.closest("[data-lg-cat]");
+      if (c) {
+        const t = document.querySelector(`[data-cat="${c.dataset.lgCat}"]`);
+        if (t) { t.checked = c.checked; t.dispatchEvent(new Event("change", { bubbles: true })); }
+        return;
+      }
       const i = e.target && e.target.closest && e.target.closest("[data-lg]");
       if (!i) return;
       const row = document.querySelector(`[data-layer="${i.dataset.lg}"]`);
@@ -9685,6 +9818,16 @@ const NOT_LIVE = {
   wastewater: "The Global Wastewater Model, from copies kept here; the model is not updated",
   trase_measures: "Trase's values come from a copy made weekly; only the region shapes are read live",
   atlas_cities: "The places are from a copy made weekly; each city's own page is read live",
+  // Trase's file server sends no CORS header (checked 22 September), so its
+  // facilities maps are read from a weekly copy in culprits-tiles-more.
+  trase_meat_brazil: "Trase's facilities file, from a copy made weekly (its file server does not let other sites read it)",
+  trase_silos_brazil: "Trase's facilities file, from a copy made weekly (its file server does not let other sites read it)",
+  trase_cocoa_ivory: "Trase's facilities file, from a copy made weekly (its file server does not let other sites read it)",
+  trase_palm_indonesia: "Trase's facilities file, from a copy made weekly (its file server does not let other sites read it)",
+  trase_pulp_indonesia: "Trase's facilities file, from a copy made weekly (its file server does not let other sites read it)",
+  trase_pulp_concessions_2015: "Trase's facilities file, from a copy made weekly (its file server does not let other sites read it)",
+  trase_pulp_concessions_2020: "Trase's facilities file, from a copy made weekly (its file server does not let other sites read it)",
+  trase_pulp_concessions_2023: "Trase's facilities file, from a copy made weekly (its file server does not let other sites read it)",
 };
 
 /* ---------- the layers box, in the order and under the headings chosen ---------- */
diff --git a/map/check-sources.mjs b/map/check-sources.mjs
index a5a167b..0e02bb9 100644
--- a/map/check-sources.mjs
+++ b/map/check-sources.mjs
@@ -8,7 +8,8 @@
  * say about their pixel values. Then the files in the wastewater model's data
  * package.
  *
- * Run: node map/check-sources.mjs
+ * Run: node map/check-sources.mjs            everything
+ *      node map/check-sources.mjs round2     without the long Global Forest Watch and KNB sections
  * Paste everything it prints back into the chat.
  */
 const ORIGIN = "https://welcometoyourgalaxy.github.io";
@@ -68,6 +69,46 @@ for (const layer of ["v3p3_alertfire_modis", "v3p3_alertfire_viirs", "v3p3_alert
     `${nus}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&STYLES=&SRS=EPSG:3857&BBOX=10018754,-1252344,12523443,1252344&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`);
 }
 
+console.log("\n=== Round 2 (22 September): where the answers were not enough ===\n");
+// uMap: the same layers at the address the map's own settings give, without the language part.
+if (umj) {
+  const tpl = umj.properties && umj.properties.urls && (umj.properties.urls.datalayer_view || umj.properties.urls.datalayer_get);
+  console.log(`    the map's own address for a layer: ${tpl || "(none given)"}`);
+  const first = (layers || [])[0];
+  const id = first && (first.id || (first.properties && first.properties.id));
+  if (id) {
+    const forms = [tpl && "https://umap.openstreetmap.fr" + tpl.replace("{map_id}", "409815").replace("{pk}", id).replace("{datalayer_id}", id),
+      `https://umap.openstreetmap.fr/datalayer/409815/${id}/`];
+    for (const u of forms.filter(Boolean)) await ask(`(30) Wreckers of the Earth, layer ${id} at ${u}`, u, { show: 160 });
+  }
+}
+// USDA: which of its servers answer at all, and what they list.
+for (const u of ["https://gis.ipad.fas.usda.gov/arcgis/rest/services?f=json", "https://geo.fas.usda.gov/arcgis/rest/services?f=json",
+                 "https://ipad.fas.usda.gov/cropexplorer/", "https://ipad.fas.usda.gov/"]) {
+  await ask(`(22/23) USDA: ${u}`, u, { show: 600 });
+}
+// GFW's tile service: does it colour a GeoTIFF when told the colours?
+{
+  const cog = "s3://gfw-data-lake/wri_google_tree_cover_loss_drivers/v20241224/raster/epsg-4326/cog/default.tif";
+  const cm = encodeURIComponent(JSON.stringify({ 1: [140, 90, 78, 255], 5: [176, 112, 124, 255] }));
+  const got = await ask("(21) Drivers in colour, one square over the Amazon", `${COG}/tiles/WebMercatorQuad/4/5/8.png?url=${encodeURIComponent(cog)}&colormap=${cm}`);
+  if (got && got.r.ok) console.log("    the square came back as a picture; if the colours are wrong on the map, say so and I will read this square's pixels next.");
+}
+// The wastewater package: the files' own addresses (the first reading listed names only).
+{
+  const e = await ask("(26) Wastewater package, file addresses", "https://knb.ecoinformatics.org/knb/d1/mn/v2/object/doi%3A10.5063%2FF76B09", { ms: 90000 });
+  if (e && e.body) {
+    for (const m of e.body.matchAll(/<otherEntity[^>]*?(?:id="([^"]+)")?[^>]*>[\s\S]*?<entityName>([^<]+)<\/entityName>[\s\S]*?<\/otherEntity>/g)) {
+      const block = m[0];
+      const url = (/<url[^>]*>([^<]+)<\/url>/.exec(block) || [])[1] || "";
+      const size = (/<size[^>]*>([^<]+)<\/size>/.exec(block) || [])[1] || "?";
+      console.log(`    ${m[2]} | id ${m[1] || "-"} | ${size} bytes | ${url}`);
+    }
+  }
+  await ask("(26) the package's list of files", "https://knb.ecoinformatics.org/knb/d1/mn/v2/query/solr/?q=resourceMap:%22resource_map_doi:10.5063/F76B09%22&fl=identifier,fileName,size&rows=50&wt=json", { show: 2500 });
+}
+
+if (!process.argv.includes("round2")) {
 console.log("\n=== Global Forest Watch pictures: what their pixels mean ===\n");
 const GFW_IDS = ["tsc_tree_cover_loss_drivers", "wri_google_tree_cover_loss_drivers", "tsc_drivers", "umd_drivers",
   "wur_integration_alert_drivers_class", "umd_glad_dist_alerts", "umd_modis_burned_areas", "gfw_mining_concessions"];
@@ -102,4 +143,5 @@ if (eml && eml.body) {
   names.forEach((n, i) => console.log(`    ${n} | ${sizes[i] || "?"} bytes | ${urls[i] || ""}`));
   if (!names.length) console.log("    " + eml.body.slice(0, 800).replace(/\s+/g, " "));
 }
+}
 console.log("\nDone.");
diff --git a/map/test.mjs b/map/test.mjs
index c034e94..2d0de44 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3143,5 +3143,29 @@ console.log("\nthe Atlas's own maps, on this map (22 September)");
   check("the plates are placed by the towns named on each page, with outliers set aside and the error measured",
         /def place_page\(labels, width_pt, height_pt, seed=0\):/.test(py) && /TRIES = 4000/.test(py) && /"error_km": round\(rms, 1\)/.test(py) && /MIN_AGREE = 5/.test(py));
 }
+console.log("\nround of 22 September (5): what check-sources found");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const k = new Function("escapeHtml", src.slice(src.indexOf("const GFW_KEYS = {"), src.indexOf("function catalogueKeyShow(")) + "; return { GFW_KEYS, gfwColormap, catalogueKeyHtml };")((x) => String(x));
+  const d = k.GFW_KEYS.wri_google_tree_cover_loss_drivers;
+  check("the drivers are coloured by the publishers' own codes, 1 to 7, in their order",
+        d.values.map((v) => v[0]).join() === "1,2,3,4,5,6,7" && d.values[0][2] === "Permanent agriculture" && d.values[4][2] === "Wildfire" &&
+        d.values[6][2] === "Other natural disturbances");
+  check("\u2026and the tile service is told one colour per code", JSON.stringify(k.gfwColormap(d)["1"]) === JSON.stringify([140, 90, 78, 255]));
+  check("DIST-ALERT is coloured by its confidence digit, as ranges", JSON.stringify(k.gfwColormap(k.GFW_KEYS.umd_glad_dist_alerts)[0][0]) === "[20000,30000]");
+  check("the WUR classes are keyed by number, not given guessed names", k.GFW_KEYS.wur_integration_alert_drivers_class.values.every((v) => /^Class \d+$/.test(v[2])));
+  const all = Object.values(k.GFW_KEYS).flatMap((x) => (x.values || x.ranges).map((e) => x.values ? e[1] : e[2]));
+  check("no key colour is orange or yellow", all.every((h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return !(r > 150 && g > 110 && b < 90); }));
+  check("a keyed picture's key is under its row and indented in the Showing box",
+        /catalogueKeyShow\(d\.key, d\.title, key\)/.test(src) && /padding-left:18px/.test(k.catalogueKeyHtml(d)) && /\$\{rows\}\$\{keyed\}/.test(src));
+  check("of several GeoTIFFs, the classification is drawn, not the intensity one", /\/\\\/\(default\|class\)\\\.tif\$\/\.test\(a\.asset_uri\)/.test(src));
+  const ex = new Function(src.slice(src.indexOf("function arcgisExperienceIds("), src.indexOf("async function arcgisWebmapsOf(")) + "; return arcgisExperienceIds;")();
+  check("an Experience Builder app's own maps are read first",
+        JSON.stringify(ex(JSON.stringify({ dataSources: { a: { type: "WEB_MAP", itemId: "0123456789abcdef0123456789abcdef" }, b: { type: "IMAGE", itemId: "fedcba9876543210fedcba9876543210" } } }))) === '["0123456789abcdef0123456789abcdef"]');
+  check("EJAtlas's pages after the first are read four at a time", /offsets\.slice\(i, i \+ 4\)\.map/.test(src));
+  check("Nusantara's pictures come in squares of 512", /WIDTH=512&HEIGHT=512/.test(src) && /map\.addSource\(lid\(i\), \{ type: "raster", tileSize: 512/.test(src));
+  check("Trase's facilities are read from the weekly copy where one was made, and say NOT LIVE",
+        /base = hit\.base \|\| m\.base \|\| base;/.test(src) && /trase_silos_brazil: "Trase's facilities file, from a copy made weekly/.test(src));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
diff --git a/pipeline/atlas_plates.py b/pipeline/atlas_plates.py
index 563f428..58c03b7 100644
--- a/pipeline/atlas_plates.py
+++ b/pipeline/atlas_plates.py
@@ -233,8 +233,14 @@ def main(only):
             continue
         pdf = CACHE / f"{slug}.pdf"
         if not pdf.exists():
-            r = session.get(PDF_BASE + slug + ".pdf", headers=UA, timeout=180)
-            if not r.ok:
+            # One PDF that will not come (the Atlas lists the North American
+            # Coastal Plain as not yet assessed) no longer stops the run.
+            try:
+                r = session.get(PDF_BASE + slug + ".pdf", headers=UA, timeout=180)
+            except Exception as e:  # noqa: BLE001
+                print(f"{slug}: the PDF did not come ({e.__class__.__name__})")
+                continue
+            if not r.ok or not r.content.startswith(b"%PDF"):
                 print(f"{slug}: the PDF did not come ({r.status_code})")
                 continue
             pdf.write_bytes(r.content)
'''

if not (pathlib.Path.cwd() / "map/app.js").exists():
    sys.exit("Run this from ~/Desktop/culprits (map/app.js not found here).")
with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False) as f:
    f.write(DIFF)
    patch = f.name
def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)
if git("apply", "--check", "--reverse", patch).returncode == 0:
    sys.exit("Already applied: nothing to do.")
check = git("apply", "--check", patch)
if check.returncode != 0:
    sys.exit("This patch does not fit the files on disk, so nothing was changed. Run git pull first.\n" + check.stderr)
done = git("apply", patch)
if done.returncode != 0:
    sys.exit(done.stderr)
print("Applied.")
