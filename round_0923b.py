#!/usr/bin/env python3
"""
Round of 23 September: one row per air pollutant (Climate TRACE), the wastewater package
inspection script, and check-sources reading the soy silos from the copy. Built against culprits main at 7958bd0.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/.gitignore b/.gitignore
index 1b038d3..ae3ddb1 100644
--- a/.gitignore
+++ b/.gitignore
@@ -6,3 +6,4 @@ __pycache__/
 map/tiles/.needs-r2
 
 pipeline/.atlas-cache/
+pipeline/.wastewater-cache/
diff --git a/HANDOFF.md b/HANDOFF.md
index d23ab39..6174db6 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -670,6 +670,27 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 23 September: one row per air pollutant; the wastewater package found
+
+- **Climate TRACE air pollution by pollutant** (item 39). Eight rows,
+  `ct_air_pm2_5`, `_bc`, `_oc`, `_so2`, `_vocs`, `_co`, `_nh3`, `_nox`, route
+  `ctairgas` (drawn by `addCtAirLayer`), each under its own heading in
+  Pollution between General and Nitrogen dioxide; black carbon also under
+  Climate > Black carbon. Every source in `ct_air/sources.geojson` is drawn,
+  its `value` the pollutant's yearly amount from `ct_air/gases.json`, and the
+  glow is weighed by it (`glowMaxOf`). The amounts come from
+  culprits-tiles-more `scripts/ct_air_gases.py`: weekly (Mondays or by hand),
+  `api.c10e.org/v7/app/asset/<id>?gas=<gas>&years=2024` -> `totals.value`, eight
+  requests at a time, least recently read first, saved as it goes, stopping at
+  130 minutes; a figure not answered keeps the last one. About 9,400 sources x
+  8 pollutants, so the first copy may take two runs. The rows are NOT LIVE; a
+  click still reads the plume and figures live through the Worker.
+- **Wastewater**: KNB's index gives the three files' ids (N pour points and
+  watersheds 403 MB, FIO 910 MB, N coastal plume GeoTIFFs 276 MB).
+  `pipeline/wastewater_inspect.py` downloads the N and plume files and lists
+  what is in them; the build is written from that listing.
+- `check-sources.mjs` now asks for the soy silos where the map does (the copy).
+
 ## Round of 22 September (6): the second check
 
 - **USDA's explorers are gone.** ipad.fas.usda.gov now answers 503 with a page
diff --git a/map/app.js b/map/app.js
index e15261d..97e1c89 100644
--- a/map/app.js
+++ b/map/app.js
@@ -5810,6 +5810,23 @@ async function addCtAirLayer(cfg) {
   try { gj = await getJson(cfg.list, 60000); }
   catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
   const src = `${cfg.id}-src`;
+  // A pollutant's own row: each source carries that pollutant's yearly amount
+  // as its value, and the glow is weighed by it. Sources with no figure yet
+  // are kept, drawn at the least weight, and counted on the row.
+  let withAmount = 0;
+  if (cfg.gas) {
+    let g = {};
+    try { g = await getJson(cfg.gases, 60000); } catch (e) { /* not copied yet: every source drawn alike */ }
+    const vals = (g && g.values) || {};
+    let max = 0;
+    gj = { type: "FeatureCollection", features: (gj.features || []).map((f) => {
+      const v = vals[f.properties.id] ? vals[f.properties.id][cfg.gas] : null;
+      if (Number.isFinite(Number(v)) && v !== null) { withAmount++; max = Math.max(max, Number(v)); }
+      return { type: "Feature", geometry: f.geometry, properties: Object.assign({}, f.properties, { value: v === undefined ? null : v }) };
+    }) };
+    if (max > 0) glowMaxOf.set(src, max);
+    cfg._max = max;
+  }
   map.addSource(src, { type: "geojson", data: gj });
   map.addSource(`${cfg.id}-plume`, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
   // The plume as a still hotspot, not a set of outlines: Climate TRACE's own
@@ -5825,8 +5842,10 @@ async function addCtAirLayer(cfg) {
     paint: { "line-color": cfg.colour, "line-width": 3, "line-opacity": 0.5, "line-blur": 2 } });
   map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src,
     paint: { "circle-color": cfg.colour, "circle-opacity": 0.9,
-             "circle-radius": ["interpolate", ["linear"], ["sqrt", ["max", 0, ["to-number", ["get", "pm25_kg_hr"], 0]]], 0, 2.5, 10, 9] } });
-  let gas = "pm2_5";
+             "circle-radius": cfg.gas && cfg._max
+               ? ["interpolate", ["linear"], ["sqrt", ["/", ["max", 0, ["to-number", ["get", "value"], 0]], cfg._max]], 0, 2.5, 1, 9]
+               : ["interpolate", ["linear"], ["sqrt", ["max", 0, ["to-number", ["get", "pm25_kg_hr"], 0]]], 0, 2.5, 10, 9] } });
+  let gas = cfg.gas || "pm2_5";
   map.on("click", `${cfg.id}-pt`, async (e) => {
     const f = e.features && e.features[0];
     if (!f) return;
@@ -5857,7 +5876,8 @@ async function addCtAirLayer(cfg) {
   });
   map.on("mouseenter", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = "pointer"; });
   map.on("mouseleave", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = ""; });
-  setLayerState(cfg.id, `${(gj.features || []).length.toLocaleString()} sources \u00b7 click one for its plume and pollutants`);
+  setLayerState(cfg.id, `${(gj.features || []).length.toLocaleString()} sources` +
+    (cfg.gas ? ` \u00b7 ${withAmount.toLocaleString()} with a yearly figure copied so far` : "") + ` \u00b7 click one for its plume and pollutants`);
   applyVisibility(cfg.id);
   buildLegend();
 }
@@ -8696,6 +8716,34 @@ const OTHER_MAPS = {
     { id: "ct_air", name: "Urban air-pollution sources and their plumes (Climate TRACE)", unit: "sources", colour: "#7A5A55", route: "ctair", ready: true, lazy: true,
       list: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/sources.geojson",
       note: "The sources Climate TRACE's city air-pollution pages cover; a click draws the source's modelled plume and gives its figures for every pollutant, read live." },
+    // One row per pollutant (22 September, round 7): the same sources, each
+    // sized and glowing by how much of that one pollutant it puts out a year,
+    // from a weekly copy of Climate TRACE's figures (scripts/ct_air_gases.py in
+    // culprits-tiles-more). A click still reads the plume and figures live.
+    { id: "ct_air_pm2_5", name: "Fine particles (PM2.5) from urban air-pollution sources (Climate TRACE)", unit: "tonnes a year", colour: "#7A5A55", route: "ctairgas", gas: "pm2_5", ready: true, lazy: true,
+      list: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/sources.geojson", gases: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/gases.json",
+      note: "Every source Climate TRACE's city air-pollution pages cover, sized by its fine particles (PM2.5) in a year, from a weekly copy of Climate TRACE's figures; a click reads its plume and every pollutant live." },
+    { id: "ct_air_bc", name: "Black carbon from urban air-pollution sources (Climate TRACE)", unit: "tonnes a year", colour: "#7A5A55", route: "ctairgas", gas: "bc", ready: true, lazy: true,
+      list: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/sources.geojson", gases: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/gases.json",
+      note: "Every source Climate TRACE's city air-pollution pages cover, sized by its black carbon in a year, from a weekly copy of Climate TRACE's figures; a click reads its plume and every pollutant live." },
+    { id: "ct_air_oc", name: "Organic carbon from urban air-pollution sources (Climate TRACE)", unit: "tonnes a year", colour: "#7A5A55", route: "ctairgas", gas: "oc", ready: true, lazy: true,
+      list: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/sources.geojson", gases: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/gases.json",
+      note: "Every source Climate TRACE's city air-pollution pages cover, sized by its organic carbon in a year, from a weekly copy of Climate TRACE's figures; a click reads its plume and every pollutant live." },
+    { id: "ct_air_so2", name: "Sulphur dioxide from urban air-pollution sources (Climate TRACE)", unit: "tonnes a year", colour: "#7A5A55", route: "ctairgas", gas: "so2", ready: true, lazy: true,
+      list: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/sources.geojson", gases: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/gases.json",
+      note: "Every source Climate TRACE's city air-pollution pages cover, sized by its sulphur dioxide in a year, from a weekly copy of Climate TRACE's figures; a click reads its plume and every pollutant live." },
+    { id: "ct_air_vocs", name: "Volatile organic compounds from urban air-pollution sources (Climate TRACE)", unit: "tonnes a year", colour: "#7A5A55", route: "ctairgas", gas: "vocs", ready: true, lazy: true,
+      list: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/sources.geojson", gases: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/gases.json",
+      note: "Every source Climate TRACE's city air-pollution pages cover, sized by its volatile organic compounds in a year, from a weekly copy of Climate TRACE's figures; a click reads its plume and every pollutant live." },
+    { id: "ct_air_co", name: "Carbon monoxide from urban air-pollution sources (Climate TRACE)", unit: "tonnes a year", colour: "#7A5A55", route: "ctairgas", gas: "co", ready: true, lazy: true,
+      list: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/sources.geojson", gases: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/gases.json",
+      note: "Every source Climate TRACE's city air-pollution pages cover, sized by its carbon monoxide in a year, from a weekly copy of Climate TRACE's figures; a click reads its plume and every pollutant live." },
+    { id: "ct_air_nh3", name: "Ammonia from urban air-pollution sources (Climate TRACE)", unit: "tonnes a year", colour: "#7A5A55", route: "ctairgas", gas: "nh3", ready: true, lazy: true,
+      list: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/sources.geojson", gases: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/gases.json",
+      note: "Every source Climate TRACE's city air-pollution pages cover, sized by its ammonia in a year, from a weekly copy of Climate TRACE's figures; a click reads its plume and every pollutant live." },
+    { id: "ct_air_nox", name: "Nitrogen oxides from urban air-pollution sources (Climate TRACE)", unit: "tonnes a year", colour: "#7A5A55", route: "ctairgas", gas: "nox", ready: true, lazy: true,
+      list: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/sources.geojson", gases: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/gases.json",
+      note: "Every source Climate TRACE's city air-pollution pages cover, sized by its nitrogen oxides in a year, from a weekly copy of Climate TRACE's figures; a click reads its plume and every pollutant live." },
     { id: "ct_pop", name: "Population density, 1 km (GHSL via Climate TRACE)", unit: "people per square km", colour: "#6A6258", route: "rasterlive", ready: true, lazy: true,
       attribution: "Climate TRACE; GHSL population", maxzoom: 12,
       choices: [{ label: "Population", tiles: "https://tiles.climatetrace.org/ghsl-pop-1km/all/{z}/{x}/{y}.png" }],
@@ -9048,7 +9096,7 @@ function ensureLayer(cfg) {
       : cfg.route === "arcgisdyn" ? addArcgisDynLayer(cfg)
       : cfg.route === "giga" ? addGigaLayer(cfg)
       : cfg.route === "gta" ? addGtaLayer(cfg)
-      : cfg.route === "ctair" ? addCtAirLayer(cfg)
+      : cfg.route === "ctair" || cfg.route === "ctairgas" ? addCtAirLayer(cfg)
       : cfg.route === "gsn" ? addGsnLayer(cfg)
       : cfg.route === "companion" ? Promise.resolve().then(() => addCompanion(cfg))
       : cfg.route === "rte" ? addRteLayer(cfg)
@@ -9223,6 +9271,14 @@ const LAYER_KIND = {
   gsn_rankings: ["plant", "downstream"],
   gta_acts: ["human", "upstream"],
   ct_air: ["human", "downstream"],
+  ct_air_pm2_5: ["human", "downstream"],
+  ct_air_bc: ["human", "downstream"],
+  ct_air_oc: ["human", "downstream"],
+  ct_air_so2: ["human", "downstream"],
+  ct_air_vocs: ["human", "downstream"],
+  ct_air_co: ["human", "downstream"],
+  ct_air_nh3: ["human", "downstream"],
+  ct_air_nox: ["human", "downstream"],
   ct_pop: ["human", "downstream"],
   gsn: ["plant", "downstream"],
   rte_trade: ["insentient", "upstream"],
@@ -9930,6 +9986,8 @@ const NOT_LIVE = {
   wastewater: "The Global Wastewater Model, from copies kept here; the model is not updated",
   trase_measures: "Trase's values come from a copy made weekly; only the region shapes are read live",
   atlas_cities: "The places are from a copy made weekly; each city's own page is read live",
+  ...Object.fromEntries(["pm2_5", "bc", "oc", "so2", "vocs", "co", "nh3", "nox"].map((g) => [`ct_air_${g}`,
+    "The yearly amounts come from a weekly copy of Climate TRACE's figures; a click reads the plume and every pollutant live"])),
   wreckers_umap: "The map's settings are read live from uMap; its places come from a daily copy, since uMap lets no other site read them",
   // Trase's file server sends no CORS header (checked 22 September), so its
   // facilities maps are read from a weekly copy in culprits-tiles-more.
@@ -9983,7 +10041,7 @@ const PANEL_ORDER = [
   { h: 5, t: "Corn" },
   { h: 5, t: "Grain" }, "site_china_grain",
   { h: 4, t: "F-gases" },
-  { h: 4, t: "Black carbon" }, "fractracker_refineries",
+  { h: 4, t: "Black carbon" }, "fractracker_refineries", "ct_air_bc",
   // Oil and gas concessions (from the catalogues) are filed here as well as
   // under Oil and gas drilling: the wells emit carbon dioxide, methane and,
   // where gas is flared, black carbon.
@@ -9994,6 +10052,14 @@ const PANEL_ORDER = [
   // sits under General until it is split into a row per pollutant.
   { h: 3, t: "Pollution" },
   { h: 4, t: "General and all pollutants" }, "ct_air", "epa_tri_sites", "epa_widget",
+  { h: 4, t: "Fine particles (PM2.5)" }, "ct_air_pm2_5",
+  { h: 4, t: "Black carbon" }, "ct_air_bc",
+  { h: 4, t: "Organic carbon" }, "ct_air_oc",
+  { h: 4, t: "Sulphur dioxide" }, "ct_air_so2",
+  { h: 4, t: "Volatile organic compounds" }, "ct_air_vocs",
+  { h: 4, t: "Carbon monoxide" }, "ct_air_co",
+  { h: 4, t: "Ammonia" }, "ct_air_nh3",
+  { h: 4, t: "Nitrogen oxides" }, "ct_air_nox",
   { h: 4, t: "Nitrogen dioxide" },
   { h: 4, t: "Wastewater" }, "hydrowaste", "wastewater",
   { h: 4, t: "Plastics" },
diff --git a/map/check-sources.mjs b/map/check-sources.mjs
index 935304d..616cd6f 100644
--- a/map/check-sources.mjs
+++ b/map/check-sources.mjs
@@ -45,7 +45,7 @@ for (const crop of ["Soybean", "Corn"]) {
 const man = await ask("(24) Trase facilities list (our copy)", `${ORIGIN}/culprits-tiles-more/trase/facilities.json`);
 let silos = "silos_consolidated_capacity_website_brazil_2024_2_post.geo.json", base = "https://resources.trase.earth/data/facilities-data/";
 const m = man && json(man);
-if (m) { const hit = (m.types || []).find((t) => t.id === "brazil-silos"); if (hit && hit.file) { silos = hit.file; base = m.base || base; } }
+if (m) { const hit = (m.types || []).find((t) => t.id === "brazil-silos"); if (hit && hit.file) { silos = hit.file; base = hit.base || m.base || base; } }
 await ask(`(24) Trase soy silos file: ${silos}`, base + silos, { ms: 120000 });
 await ask("(29) EJAtlas, first page of 500", "https://ejatlas.org/api/v1/conflicts/?limit=500&offset=0", { ms: 120000 });
 const um = await ask("(30) Wreckers of the Earth, the uMap map", "https://umap.openstreetmap.fr/en/map/409815/geojson/", { show: 300 });
diff --git a/map/test.mjs b/map/test.mjs
index a6b92af..3f51e4c 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3215,5 +3215,24 @@ console.log("\nround of 22 September (6): the second check");
   check("a uMap layer is read from the daily copy first, and the row says NOT LIVE",
         /culprits-tiles-more\/umap\/\$\{cfg\.umapId\}\/\$\{id\}\.geojson/.test(src) && /wreckers_umap: "The map's settings are read live/.test(src));
 }
+console.log("\nround of 23 September: one row per air pollutant");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const gases = ["pm2_5", "bc", "oc", "so2", "vocs", "co", "nh3", "nox"];
+  check("each pollutant Climate TRACE reports for urban sources is a row of its own", gases.every((g) => new RegExp(`id: "ct_air_${g}", [^\\n]*route: "ctairgas", gas: "${g}"`).test(src)));
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const o = new Function(body + "; return { PANEL_ORDER };")().PANEL_ORDER;
+  const at = (t, from = 0) => o.findIndex((x, i) => i >= from && x && x.t === t);
+  const pol = at("Pollution");
+  check("\u2026each under its own heading in Pollution, between General and Nitrogen dioxide",
+        ["Fine particles (PM2.5)", "Black carbon", "Organic carbon", "Sulphur dioxide", "Volatile organic compounds", "Carbon monoxide", "Ammonia", "Nitrogen oxides"]
+          .every((t, i) => { const h = at(t, pol); return h > at("General and all pollutants", pol) && h < at("Nitrogen dioxide", pol) && o[h + 1] === `ct_air_${gases[i]}`; }));
+  check("\u2026black carbon copied under Climate's Black carbon too", o.indexOf("ct_air_bc") > at("Black carbon") && o.indexOf("ct_air_bc") < at("Infrastructure emitting more than one gas"));
+  check("\u2026every source kept, sized and glowing by that pollutant's yearly amount, from the weekly copy",
+        /glowMaxOf\.set\(src, max\)/.test(src) && /\["get", "value"\], 0\]\], cfg\._max\]/.test(src) && /ct_air\/gases\.json/.test(src));
+  check("\u2026and the rows say NOT LIVE, the click still reads live", /ct_air_\$\{g\}`,\s*"The yearly amounts come from a weekly copy/.test(src));
+  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "wastewater_inspect.py"), "utf8");
+  check("the wastewater package is inspected from KNB before a build is written", /urn:uuid:af8d0bd6-dc0c-4149-a3cd-93b5aed71f7c/.test(py) && /def dbf_fields/.test(py));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
diff --git a/pipeline/wastewater_inspect.py b/pipeline/wastewater_inspect.py
new file mode 100644
index 0000000..24b6459
--- /dev/null
+++ b/pipeline/wastewater_inspect.py
@@ -0,0 +1,71 @@
+#!/usr/bin/env python3
+"""
+What is inside the Global Wastewater Model's data package (Tuholske et al.
+2021, KNB doi:10.5063/F76B09), before a build is written for it.
+
+The model's own map server is gone, so the five rows of the wastewater layer
+have nothing to draw. KNB keeps the data (found 23 September):
+  N_PourPoint_And_Watershed.zip     urn:uuid:af8d0bd6-dc0c-4149-a3cd-93b5aed71f7c   403 MB
+  FIO_PourPoint_And_Watershed.zip   urn:uuid:cd0c1813-9109-4f27-897b-bdba4384bda1   910 MB
+  Global_N_Coastal_Plumes_tifs.zip  urn:uuid:efef18ef-416e-4d4d-9190-f17485c02c15   276 MB
+
+This downloads the nitrogen and plume files (about 680 MB, kept in
+pipeline/.wastewater-cache so it happens once) and prints every file inside,
+with, for each table, its column names and number of rows, and for each
+picture its size. Nothing is changed. Add "fio" to include the 910 MB file of
+faecal indicator organisms too.
+
+Run from the repo root:  python3 pipeline/wastewater_inspect.py
+"""
+import pathlib, struct, sys, urllib.request, zipfile
+
+KNB = "https://knb.ecoinformatics.org/knb/d1/mn/v2/object/"
+FILES = {"N_PourPoint_And_Watershed.zip": "urn:uuid:af8d0bd6-dc0c-4149-a3cd-93b5aed71f7c",
+         "Global_N_Coastal_Plumes_tifs.zip": "urn:uuid:efef18ef-416e-4d4d-9190-f17485c02c15"}
+if "fio" in sys.argv[1:]:
+    FILES["FIO_PourPoint_And_Watershed.zip"] = "urn:uuid:cd0c1813-9109-4f27-897b-bdba4384bda1"
+CACHE = pathlib.Path(__file__).resolve().parent / ".wastewater-cache"
+
+
+def fetch(name, pid):
+    path = CACHE / name
+    if path.exists() and zipfile.is_zipfile(path):
+        return path
+    CACHE.mkdir(parents=True, exist_ok=True)
+    print(f"downloading {name} ...", flush=True)
+    req = urllib.request.Request(KNB + urllib.request.quote(pid, safe=""), headers={"User-Agent": "Culprits atlas"})
+    with urllib.request.urlopen(req, timeout=600) as r, open(path.with_suffix(".part"), "wb") as out:
+        got = 0
+        while True:
+            chunk = r.read(1 << 20)
+            if not chunk:
+                break
+            out.write(chunk)
+            got += len(chunk)
+            if got % (50 << 20) < (1 << 20):
+                print(f"  {got >> 20} MB", flush=True)
+    path.with_suffix(".part").rename(path)
+    return path
+
+
+def dbf_fields(data):
+    """Column names and row count of a dBase table (the .dbf beside a shapefile)."""
+    rows, header = struct.unpack("<IH", data[4:10])
+    names, at = [], 32
+    while at < header - 1 and data[at] != 0x0D:
+        names.append((data[at:at + 11].split(b"\0")[0].decode("latin-1"), chr(data[at + 11]), data[at + 16]))
+        at += 32
+    return rows, names
+
+
+for name, pid in FILES.items():
+    z = zipfile.ZipFile(fetch(name, pid))
+    print(f"\n=== {name} ===")
+    for info in z.infolist():
+        print(f"  {info.filename}  ({info.file_size:,} bytes)")
+        if info.filename.lower().endswith(".dbf"):
+            rows, names = dbf_fields(z.read(info))
+            print(f"      {rows:,} rows; columns: " + ", ".join(f"{n} ({t}{w})" for n, t, w in names))
+        if info.filename.lower().endswith((".prj", ".txt", ".xml", ".csv")) and info.file_size < 4000:
+            print("      " + z.read(info).decode("latin-1").replace("\n", " ")[:600])
+print("\nDone.")
'''

if not (pathlib.Path.cwd() / "map/app.js").exists():
    sys.exit("Run this from the culprits-tiles-more folder (scripts/trase.py not found here).")
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
