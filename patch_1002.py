#!/usr/bin/env python3
"""
Coral reefs visible from the world view; two fishing layers retitled; Live
Projects to Resist drawn on this map instead of opened beside it.

Run from the repo root:  python3 patch_1002.py

Needs patch_1001.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js                      Below zoom 7 the world reef map is asked for
                                  a 96-pixel picture of each square and drawn
                                  nearest-neighbour, so a reef a few hundred
                                  metres across can be found; the full-size
                                  picture is used from zoom 7 to 12.
                                  The two fishing rows say what they show and
                                  how they differ.
                                  The Live Projects to Resist panel row is
                                  replaced by three rows under Construction:
                                  its news wire, its trackers by country and
                                  its how-to guides by country. Its project
                                  cards are already the Development projects
                                  row, so they are not drawn twice.
  pipeline/shapes/build_shapes.py A country_docs kind: one document per
                                  country, read from a map's own page.
  pipeline/shapes/registry.json   love_trackers and love_guides.
  map/test.mjs                    Checks for all of it.
  HANDOFF.md                      What was integrated and what was left out.

After this, run the culprits-tiles-more refresh workflow with site_shapes in
the box, so the two country layers are built and published; until then those
two rows say the file is not there yet.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 50f4d32..c41702a 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -83,6 +83,26 @@ Worker: `https://culprits-proxy.welcometoyourgalaxy.workers.dev`
 
 ---
 
+## Live Projects to Resist, drawn here rather than opened beside
+
+Its panel row is gone. Three rows under Construction carry what the panel
+added: `love_wire` (its news wire, read live from the map's own
+`wire_geo.json`), `love_trackers` and `love_guides` (country layers built daily
+by `build_shapes.py`). Its project cards are the same records as
+`local_projects`, so that row stands and nothing is drawn twice, and its Earth
+First! archive is text with no positions, so nothing of it is placed.
+
+`love_guides` uses the `country_docs` kind, which reads the ISO3 index inside
+the map's own page (`LKA:{file:'srilanka.md',pdf:'...'}`) rather than GitHub's
+tree API: unauthenticated tree calls are refused after sixty an hour on a
+runner, which would empty the layer on a normal day.
+
+The wire places a story by matching its words against place names, not from a
+coordinate in the story. Weak matches happen (a story about Iowa sits near
+Geelong), so every box shows what it matched on and its score.
+
+---
+
 ## Where the archives live, and why they are spread across repos
 
 A published Pages site is capped at 1 GB, so the archives sit in whichever repo
diff --git a/map/app.js b/map/app.js
index 646795f..35e4e49 100644
--- a/map/app.js
+++ b/map/app.js
@@ -331,7 +331,7 @@ const LAYERS = [
   // The 4Wings tile endpoint has no report queue, and fishing effort is a
   // continuous field rather than a set of sites, so a heatmap says what the
   // data actually is. Attribution is required by GFW's terms of use.
-  { id:"fishing",              name:"Fishing effort",          unit:"apparent fishing hours, 12 months", colour:"#A8707E", route:"tile", ready:true, off: true,
+  { id:"fishing",              name:"Hours spent fishing, tracked from vessel signals (Global Fishing Watch)", unit:"apparent fishing hours, 12 months", colour:"#A8707E", route:"tile", ready:true, off: true,
     tileMaxZoom: 12,
     attribution: '<a href="https://globalfishingwatch.org" target="_blank" rel="noopener">Powered by Global Fishing Watch</a>' },
 
@@ -378,7 +378,7 @@ const LAYERS = [
     note: "Sector infrastructure, not confirmed exploitation. These are sites in sectors where forced and child labour concentrate; where IPIS actually observed it, the site says so." },
   { id:"slavery_ports",        name:"Ports with high-risk vessel calls", unit:"ports", colour:"#5F7480", route:"pmtiles", ready:true, off: true,
     note: "Scored on the share of calling fishing vessels flagged high-risk by a published behavioural model. A property of the calls, not of the port." },
-  { id:"slavery_fishing",      name:"Modelled at-risk fishing effort", unit:"model cells, 2.5°", colour:"#4E6A70", route:"pmtiles", ready:true, off: true,
+  { id:"slavery_fishing",      name:"Ocean squares where forced-labour fishing is predicted (model, no vessel named)", unit:"model cells, 2.5\u00b0", colour:"#4E6A70", route:"pmtiles", ready:true, off: true,
     note: "Not vessels. The authors anonymised every hull, so each mark is a cell of ocean and identifies nobody." },
   { id:"remains_records",      name:"Unearthings and burial decisions", unit:"records", colour:"#6A6257", route:"pmtiles", ready:true, off: true,
     facet: { property: "x_posture", label: "direction",
@@ -3146,13 +3146,42 @@ async function readEjatlas(cfg) {
 }
 
 // Plain GeoJSON files (Seas of Plastic; the Coastal Cleanup copy).
+// A file of records with a latitude and a longitude in each, rather than
+// GeoJSON: the Live Projects to Resist wire publishes its placed stories that
+// way. Turned into features here so one route reads both, and a record with no
+// position is left out rather than placed at 0,0 off West Africa.
+function recordsAsFeatures(rows) {
+  const num = (v) => (v === "" || v == null ? null : Number(v));
+  return rows.map((r) => {
+    const lat = num(r.lat != null ? r.lat : r.latitude), lng = num(r.lng != null ? r.lng : (r.lon != null ? r.lon : r.longitude));
+    if (!isFinite(lat) || !isFinite(lng) || lat === null || lng === null) return null;
+    const p = {};
+    Object.keys(r).forEach((k) => { if (!["lat", "lng", "lon", "latitude", "longitude"].includes(k)) p[k] = r[k]; });
+    // A record whose whole point is a link (a story, a report) gets that link
+    // as a link rather than as escaped text in a table cell. Every field is
+    // still listed underneath.
+    const href = p.link || p.url;
+    if (href) {
+      p._html = `<h4 style="margin:0 0 6px">${escapeHtml(String(p.title || p.name || href))}</h4>` +
+        `<p><a href="${escapeHtml(String(href))}" target="_blank" rel="noopener">Open it</a></p>` +
+        `<table>${fieldRows(p, ["_html"])}</table>`;
+    }
+    return { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: p };
+  }).filter(Boolean);
+}
 async function readGeojsonFiles(cfg) {
   const items = [];
   for (const f of cfg.files) {
-    const gj = await getJson(f.url, 60000);
+    const got = await getJson(f.url, 60000);
+    const gj = Array.isArray(got) ? { features: recordsAsFeatures(got) }
+      : (got && !got.features && Array.isArray(got.entries)) ? { features: recordsAsFeatures(got.entries) } : got;
     (gj.features || []).forEach((ft, i) => {
       const p = ft.properties || {};
-      const name = p.name || p.Name || p.title || p.Source || (p.TripId != null ? `Trip ${p.TripId}` : "") || p.Ocean || f.label;
+      // Which field names the place, where a file's own first choice would be
+      // the wrong one: the wire's "name" is the outlet, and a list of forty
+      // rows all reading the same outlet says nothing about where they are.
+      const first = (cfg.nameFrom || []).map((k) => p[k]).find((v) => v !== undefined && v !== null && v !== "");
+      const name = first || p.name || p.Name || p.title || p.Source || (p.TripId != null ? `Trip ${p.TripId}` : "") || p.Ocean || f.label;
       items.push({ geometry: ft.geometry, key: `${f.label}:${i}`, name: String(name), group: p.group != null ? String(p.group) : f.label,
         // A copy that carries its source's own box (_html) shows that; otherwise every field.
         h: p._html ? boxOpen + p._html + `</div>`
@@ -5008,6 +5037,9 @@ const CORAL_CLASSES = {
 // over, so nothing drops out in between (the Atlas's picture of zooms 6 to 12
 // failed to draw over the satellite view).
 const CORAL_ATLAS_PICTURE_FROM = 12;
+// Below this zoom the world reef map is drawn coarse so that reefs a few
+// hundred metres across are still findable; at and above it, full size.
+const CORAL_WORLD_SHARP = 7;
 function addCoralLayer(cfg) {
   map.addSource(`${cfg.id}-tiles`, {
     type: "vector",
@@ -5032,11 +5064,27 @@ function addCoralLayer(cfg) {
     minzoom: CORAL_ATLAS_PICTURE_FROM, layout: { visibility: "none" }, paint: { "raster-opacity": 0.9 } });
   // Wider still, the Atlas's server runs out of time drawing so much reef, so
   // UNEP-WCMC's reef map stands in, in the same colour, and the row says so.
+  //
+  // A reef is a few hundred metres across. From the world view that is a
+  // fraction of a pixel, so the layer drew a scatter of marks too faint to
+  // find. The map asks the same server for a smaller picture of each square
+  // and lets the square stretch it: a reef that covers one pixel of a 96-pixel
+  // picture covers nearly three on screen. Nothing is added or moved - the
+  // same reefs are drawn coarser, which is what makes them findable at this
+  // width. Nearest-neighbour, because smoothing spreads that one pixel into a
+  // pale smudge and undoes it. From zoom CORAL_WORLD_SHARP the squares are
+  // small enough for reefs to hold their own, and the full-size picture is
+  // used instead.
+  const wcmc = (px) => `tint://${CORAL_CLASSES["Coral/Algae"].slice(1)}/data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/MapServer/export` +
+    `?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=${px},${px}&format=png32&transparent=true&f=image`;
   map.addSource(`${cfg.id}-globe`, { type: "raster", tileSize: 256,
-    attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC",
-    tiles: [`tint://${CORAL_CLASSES["Coral/Algae"].slice(1)}/data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/MapServer/export` +
-            `?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`] });
-  map.addLayer({ id: `${cfg.id}-world`, type: "raster", source: `${cfg.id}-globe`, maxzoom: cfg.drawFrom,
+    attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC", tiles: [wcmc(96)] });
+  map.addLayer({ id: `${cfg.id}-world`, type: "raster", source: `${cfg.id}-globe`, maxzoom: CORAL_WORLD_SHARP,
+    layout: { visibility: "none" }, paint: { "raster-opacity": 1, "raster-resampling": "nearest" } });
+  map.addSource(`${cfg.id}-globe-near`, { type: "raster", tileSize: 256,
+    attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC", tiles: [wcmc(256)] });
+  map.addLayer({ id: `${cfg.id}-world-near`, type: "raster", source: `${cfg.id}-globe-near`,
+    minzoom: CORAL_WORLD_SHARP, maxzoom: cfg.drawFrom,
     layout: { visibility: "none" }, paint: { "raster-opacity": 0.9 } });
   bindHtmlPopup(`${cfg.id}-fill`, (p) =>
     `<b>${p.class_name || "Unclassified"}</b>` +
@@ -6677,9 +6725,22 @@ const OTHER_MAPS = {
     { id: "rte_trade", name: "Resource trade flows (resourcetrade.earth, Chatham House)", unit: "trade flows", colour: "#8A6356", route: "rte", ready: true, lazy: true,
       api: "https://api.resourcetrade.earth/api/rt/2.7", copy: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/rte",
       note: "The largest natural-resource trade flows between countries, read live from resourcetrade.earth (a daily copy stands in if it cannot be read)." },
-    { id: "live_projects_app", name: "Live Projects to Resist (its whole map)", unit: "opens its own map in a panel", colour: "#6E7B84", route: "companion", ready: true, lazy: true,
-      page: "https://welcometoyourgalaxy.github.io/local-map/", follow: true,
-      note: "The Live Global Project Map itself, in a panel along the bottom that follows this map's view: its country guides and how-to PDFs, lenses, trackers, regions, project cards, overlays and history." },
+    // Live Projects to Resist, drawn on this map rather than opened in a panel
+    // beside it. Its project cards are the Development projects row already
+    // under Construction, from the same records, so they are not drawn twice;
+    // what the panel added over that row is here as three more rows. Its Earth
+    // First! archive is text sections with no positions, so there is nothing
+    // to place and none is invented.
+    { id: "love_wire", name: "Resistance news placed where it happened (Live Projects to Resist)", unit: "stories", colour: "#6E7B84", route: "geojsonlive", ready: true, lazy: true,
+      files: [{ label: "Live Projects to Resist wire", url: "https://welcometoyourgalaxy.github.io/local-map/wire_geo.json" }],
+      nameFrom: ["title"],
+      note: "The map's own news wire, read live from it. Each story sits where that map matched it, by name rather than by a coordinate in the story, so a box shows what it matched on and how strongly; a weak match can put a story in the wrong country." },
+    { id: "love_trackers", name: "Who to enlist against a project, by country (Live Projects to Resist)", unit: "countries", colour: "#6E7B84", route: "shapes", ready: true, lazy: true,
+      dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/love_trackers.geojson",
+      note: "The map's country lists of firms, funds and bodies to bring in against a project, rebuilt daily from the map itself." },
+    { id: "love_guides", name: "Community resistance how-to guides, by country (Live Projects to Resist)", unit: "countries", colour: "#7B8472", route: "shapes", ready: true, lazy: true,
+      dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/love_guides.geojson",
+      note: "One guide per country, linked from the country it is written for: the how-to as a PDF, as a page, and to download. Seven of the map's entries have no outline in the boundaries file and are named in the build log rather than dropped quietly." },
     { id: "gsn", name: "Global Safety Net (One Earth)", unit: "layers", colour: "#406F2F", route: "gsn", ready: true, lazy: true,
       api: "https://api.gsn.naturedatalab.org/geo-analysis/layers",
       note: "Every layer the Global Safety Net viewer offers, drawn live from its own map service in its own colours." },
@@ -7042,7 +7103,9 @@ const LAYER_KIND = {
   ct_air: ["human", "downstream"],
   ct_pop: ["human", "downstream"],
   gsn: ["plant", "downstream"],
-  live_projects_app: ["human", "downstream"],
+  love_wire: ["human", "downstream"],
+  love_trackers: ["human", "downstream"],
+  love_guides: ["human", "downstream"],
   rte_trade: ["insentient", "upstream"],
   mymaps_supp_a: ["animal", "downstream"],
   mymaps_supp_b: ["animal", "downstream"],
@@ -7535,7 +7598,7 @@ const PANEL_ORDER = [
   { h: 3, t: "Oceans" }, "fishing", "slavery_fishing", "allen_coral", "skytruth_monitor", "skytruth_voc",
   { h: 4, t: "Oil slicks" },
   { h: 5, t: "Marine oil slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive",
-  { h: 3, t: "Construction" }, "local_projects", "live_projects_app",
+  { h: 3, t: "Construction" }, "local_projects", "love_wire", "love_trackers", "love_guides",
   { h: 3, t: "Culprits upstream" }, "ejatlas",
   { h: 4, t: "Emissions" }, "carbon_majors", "soy_organizations", "bocc",
   { h: 4, t: "Deforestation" }, "site_forest500_soy", "site_soybean_companies", "dff",
@@ -7607,6 +7670,9 @@ const PANEL_REMOVED = new Set([
   "gmo_releases",
   // Removed at the owner's request, 20 September.
   "acgf",
+  // Its own map in a panel, replaced by the love_ rows under Construction,
+  // which draw the same material on this map.
+  "live_projects_app",
   "fin_bank", "fin_centralbank", "fin_taxoffice", "fin_govfinance", "fin_financial", "fin_exchange", "fin_insurance", "fin_accountant", "fin_remittance", "fin_stockexchange", "fin_auditoffice", "fin_devbank", "fin_mint", "legal_publicdefender", "legal_immigration", "legal_probation", "legal_juvenile", "leg_parliament", "leg_audit", "leg_electoral", "leg_ombudsman", "leg_council", "exec_firestation", "exec_townhall", "leg_townhall", "exec_govoffice", "exec_ministry", "exec_diplomatic", "exec_border", "jud_courts", "legal_courthouse", "slavery_facilities", "activist_courts", "exec_police", "legal_police", "activist_police", "exec_prison", "legal_prison", "jud_prisons", "activist_prisons",
   "site_ufo_pre1900", "site_subsistence_cultures", "site_self_sufficiency", "slavery_trackers",
   "site_environment_law", "enviro_law_by_country", "site_environment_law_shapes", "gov_official_map",
diff --git a/map/test.mjs b/map/test.mjs
index f49a65e..e099b5f 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1689,8 +1689,11 @@ console.log("\nTrase, and coral at world zoom");
   check("steps come from the values themselves", JSON.stringify(br([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) === "[3,5,7,9]");
   check("the ramps carry no orange or yellow", !/#(F[A-F0-9]{5}|E[6-9A-F][0-9A-F]{2}[0-4][0-9A-F])/i.test(src.slice(src.indexOf("const TRASE_RAMPS"), src.indexOf("const traseCache"))));
   check("wider than zoom 12, coral shows UNEP-WCMC's map in the Atlas colour, with no gap",
-        /id: `\$\{cfg\.id\}-world`, type: "raster", source: `\$\{cfg\.id\}-globe`, maxzoom: cfg\.drawFrom/.test(src) &&
+        /id: `\$\{cfg\.id\}-world`, type: "raster", source: `\$\{cfg\.id\}-globe`, maxzoom: CORAL_WORLD_SHARP/.test(src) &&
+        /id: `\$\{cfg\.id\}-world-near`[\s\S]{0,160}minzoom: CORAL_WORLD_SHARP, maxzoom: cfg\.drawFrom/.test(src) &&
         /tint:\/\/\$\{CORAL_CLASSES\["Coral\/Algae"\]\.slice\(1\)\}\/data-gis\.unep-wcmc\.org/.test(src));
+  check("from the world view the reefs are drawn coarse, so a reef a few hundred metres across can be seen",
+        /wcmc\(96\)/.test(src) && /wcmc\(256\)/.test(src) && /"raster-resampling": "nearest"/.test(src));
   check("…and the row says whose map it is", /UNEP-WCMC's warm-water reefs at this width/.test(src));
   check("the switch reaches the world layer", /`\$\{id\}-world`/.test(src));
 }
@@ -1902,7 +1905,9 @@ console.log("\nSocial Spheres controls; Live Projects to Resist whole; wastewate
   const lab = new Function(src.slice(src.indexOf("function spheresLabels("), src.indexOf("function spheresControls(")) + "; return spheresLabels;")();
   check("the Social Spheres' own kind names are read", lab('const KINDLABEL={assoc:"Association & commission",club:"Club"};').club === "Club");
   check("a person or sector opens through the map's own functions only", /\["openNode", "openPerson", "openSector"\]\.includes\(fn\)/.test(src));
-  check("Live Projects to Resist opens whole, following this map", /id: "live_projects_app"/.test(src) && /map\.setView\(\[\$\{ctr\.lat\}/.test(src));
+  check("Live Projects to Resist is drawn on this map, not opened beside it",
+        !/id: "live_projects_app"/.test(src) && ["love_wire", "love_trackers", "love_guides"].every((i) => new RegExp(`id: "${i}"`).test(src)));
+  check("its project cards are not drawn a second time", (src.match(/id:\s*"local_projects"/g) || []).length === 1);
   check("the wastewater layers read the GitHub copy", (src.match(/tiles\/wastewater_N_[a-z_]+\.pmtiles/g) || []).length === 5 && !/mazu\.nceas\.ucsb\.edu/.test(src));
 }
 
@@ -1939,7 +1944,7 @@ console.log("\noutside pages whole, in the panel");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   check("every remaining outside page is a row", ["cfr_tracker", "giga_schools", "bocc", "theyrule", "skytruth_voc", "esa_risk", "gsn_rankings"].every((i) => new RegExp(`id: "${i}"`).test(src)));
-  check("only the site's own map follows this one", (src.match(/follow: true/g) || []).length === 1 && /cfg\.follow \?/.test(src));
+  check("no panel follows this map's view any more, and none claims to", (src.match(/follow: true/g) || []).length === 0);
   check("one panel at a time", /One panel at a time/.test(src));
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const order = new Function(body + "; return PANEL_ORDER;")();
@@ -2045,6 +2050,16 @@ console.log("\nEPA facilities at every zoom");
   check("the kind buttons also filter the copy", /map\.setFilter\(`\$\{cfg\.id\}-pts`, ptsFilter\(\)\)/.test(src));
 }
 
+console.log("\nLive Projects to Resist, drawn here");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const rows = new Function(src.slice(src.indexOf("function recordsAsFeatures("), src.indexOf("async function readGeojsonFiles(")) + "; return recordsAsFeatures;")();
+  const out = rows([{ name: "a", lat: 12, lng: 34 }, { name: "b", lat: "", lng: "" }, { name: "c", latitude: -1, longitude: 2 }]);
+  check("a story with a position becomes a point, keeping its fields", out.length === 2 && out[0].geometry.coordinates[0] === 34 && out[0].properties.name === "a");
+  check("a story with no position is left out rather than placed at 0,0", !out.some((f) => f.properties.name === "b"));
+  check("the three rows sit under Construction, after the projects themselves", /\{ h: 3, t: "Construction" \}, "local_projects", "love_wire", "love_trackers", "love_guides"/.test(src));
+}
+
 console.log("\nBuildings");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
diff --git a/pipeline/shapes/build_shapes.py b/pipeline/shapes/build_shapes.py
index 88a0be7..afde643 100644
--- a/pipeline/shapes/build_shapes.py
+++ b/pipeline/shapes/build_shapes.py
@@ -260,6 +260,44 @@ def from_enviro_files(e):
     return feats, missing
 
 
+# The documents a map offers per country, read from the map's own page.
+#
+# The Live Projects to Resist map keeps them in its page as an index keyed by
+# ISO3 code - LKA:{file:'srilanka.md',pdf:'srilanka-...pdf',label:'...'} - so
+# the country comes from the map itself and is never guessed from a file name.
+# The page rather than the repository's file list, because an unauthenticated
+# call to GitHub's tree API is refused once a runner has made sixty in an hour,
+# which would empty the layer on a normal day.
+DOC_ENTRY = re.compile(r"\b([A-Z]{3})\s*:\s*\{([^{}]*)\}")
+DOC_FIELD = re.compile(r"(\w+)\s*:\s*'([^']*)'")
+DOC_LABELS = {"pdf": "Community resistance how-to (PDF)", "file": "The same guide as a page",
+              "dl": "The guide to download"}
+
+
+def from_country_docs(e):
+    page = requests.get(e["page"], headers=UA, timeout=300)
+    page.raise_for_status()
+    site = e["site"].rstrip("/")
+    feats, missing = [], []
+    for iso_raw, body in DOC_ENTRY.findall(page.text):
+        fields = dict(DOC_FIELD.findall(body))
+        if not any(k in fields for k in DOC_LABELS):
+            continue
+        iso = to_iso(iso_raw)
+        if not iso:
+            missing.append(iso_raw)
+            continue
+        lines = []
+        if fields.get("label"):
+            lines.append(text(fields["label"]))
+        for key, label in DOC_LABELS.items():
+            if fields.get(key):
+                lines.append(f"{label} — {site}/{fields[key]}")
+        f = country_feature(iso, {"entries": len(lines), "list": "\n".join(lines)})
+        (feats.append(f) if f else missing.append(iso))
+    return feats, missing
+
+
 def from_extract(e):
     if "url" in e:
         spec = {"url": e["url"]}
@@ -431,7 +469,8 @@ def _swap(c):
 
 
 KINDS = {"geojson": from_geojson, "records_by_iso": from_records, "tree": from_tree,
-         "routes": from_routes, "enviro_files": from_enviro_files, "extract": from_extract}
+         "routes": from_routes, "enviro_files": from_enviro_files, "extract": from_extract,
+         "country_docs": from_country_docs}
 
 
 def main():
diff --git a/pipeline/shapes/registry.json b/pipeline/shapes/registry.json
index 5ca8554..45732ab 100644
--- a/pipeline/shapes/registry.json
+++ b/pipeline/shapes/registry.json
@@ -272,6 +272,25 @@
    "unit": "countries and places",
    "colour": "#5F6A66"
   },
+  {
+   "id": "love_trackers",
+   "group": "MORE_MAPS",
+   "kind": "tree",
+   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/local-map/main/trackerdata.json",
+   "name": "Who to enlist against a project, by country (Live Projects to Resist)",
+   "unit": "countries",
+   "colour": "#6E7B84"
+  },
+  {
+   "id": "love_guides",
+   "group": "MORE_MAPS",
+   "kind": "country_docs",
+   "page": "https://welcometoyourgalaxy.github.io/local-map/index.html",
+   "site": "https://welcometoyourgalaxy.github.io/local-map",
+   "name": "Community resistance how-to guides, by country (Live Projects to Resist)",
+   "unit": "countries",
+   "colour": "#7B8472"
+  },
   {
    "id": "capture_map",
    "group": "SITE_MAPS",
'''


def git(*args):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if "CORAL_WORLD_SHARP" in app:
        print("Already applied - nothing to do.")
        return
    if "culprits-buildings/tiles/building_types.json" not in app:
        sys.exit("patch_1001.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
