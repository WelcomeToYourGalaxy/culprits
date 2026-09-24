#!/usr/bin/env python3
"""
Round of 23 September (2): the Global Wastewater Model drawn from its data package:
pipeline/wastewater_build.py and the five rows under Pollution > Wastewater. Built against culprits main at fcc1552.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 6174db6..5aec806 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -670,6 +670,28 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 23 September (2): the Global Wastewater Model from its data package
+
+`pipeline/wastewater_inspect.py` showed the N package holds pour points
+(134,846; basin_id, open_N, septic_N, treated_N, tot_N and their shares),
+watersheds (the same table, 103 MB of shapes), country totals (255 rows,
+ISO3), and four global 3 GB GeoTIFFs of the coastal plumes (open, septic,
+treated, total). No projection file is included.
+
+- `pipeline/wastewater_build.py` (run on the Mac; pyshp and tippecanoe) makes
+  `wastewater_n_{tot,treated,septic,open}.pmtiles` in culprits-tiles-more
+  `tiles/` (every point, every zoom, `-r1 --no-feature-limit
+  --no-tile-size-limit`; `value` = that measure; every field kept) and
+  `map/data/wastewater_n_countries.countries.json`. It stops if the points are
+  not in longitude and latitude, and works the unit out from the global total
+  against the paper's 6.2 Mt N a year (stops if none fits), writing it on
+  every point.
+- Rows `wastewater_n_tot`, `_treated`, `_septic`, `_open` (pmtiles) and
+  `wastewater_n_countries` (country) under Pollution > Wastewater. The old
+  `wastewater` picture row is in `PANEL_REMOVED` (its server is gone) and no
+  longer under Methane.
+- Not built yet: the plume GeoTIFFs and the watershed shapes.
+
 ## Round of 23 September: one row per air pollutant; the wastewater package found
 
 - **Climate TRACE air pollution by pollutant** (item 39). Eight rows,
diff --git a/map/app.js b/map/app.js
index 97e1c89..4aa1983 100644
--- a/map/app.js
+++ b/map/app.js
@@ -355,6 +355,20 @@ const LAYERS = [
   { id:"gmo_animal_trade", sourceOf:"gmo_releases", name:"Animal breeders, dealers, exhibitors and carriers (USDA Animal Welfare Act)", unit:"licensees", colour:"#74695E", route:"pmtiles", ready:true, off: true,
     where: ["all", ["==", ["get", "id"], "industry:animals"],
             ["!", ["in", ["get", "x_type"], ["literal", ["Animal Welfare Act research facility", "Accredited animal research organisation", "CCAC certified institution"]]]]] },
+  { id:"wastewater_n_tot", name:"Nitrogen from human wastewater reaching the sea, all of it, by coastal outlet (Tuholske et al.)", unit:"nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
+    archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_tot.pmtiles",
+    note: "The Global Wastewater Model (Tuholske et al. 2021, KNB doi:10.5063/F76B09): each of its 134,846 pour points, where a watershed's wastewater reaches the coast, weighed by this share of its nitrogen. Built from the model's data package; every field it gives is kept, the unit included. The model is not updated." },
+  { id:"wastewater_n_treated", name:"Nitrogen from sewage treatment plants reaching the sea, by coastal outlet (Tuholske et al.)", unit:"nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
+    archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_treated.pmtiles",
+    note: "The Global Wastewater Model (Tuholske et al. 2021, KNB doi:10.5063/F76B09): each of its 134,846 pour points, where a watershed's wastewater reaches the coast, weighed by this share of its nitrogen. Built from the model's data package; every field it gives is kept, the unit included. The model is not updated." },
+  { id:"wastewater_n_septic", name:"Nitrogen from septic systems reaching the sea, by coastal outlet (Tuholske et al.)", unit:"nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
+    archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_septic.pmtiles",
+    note: "The Global Wastewater Model (Tuholske et al. 2021, KNB doi:10.5063/F76B09): each of its 134,846 pour points, where a watershed's wastewater reaches the coast, weighed by this share of its nitrogen. Built from the model's data package; every field it gives is kept, the unit included. The model is not updated." },
+  { id:"wastewater_n_open", name:"Nitrogen from untreated human waste reaching the sea, by coastal outlet (Tuholske et al.)", unit:"nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
+    archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_open.pmtiles",
+    note: "The Global Wastewater Model (Tuholske et al. 2021, KNB doi:10.5063/F76B09): each of its 134,846 pour points, where a watershed's wastewater reaches the coast, weighed by this share of its nitrogen. Built from the model's data package; every field it gives is kept, the unit included. The model is not updated." },
+  { id:"wastewater_n_countries", name:"Nitrogen from human wastewater reaching the sea, by country (Tuholske et al.)", unit:"nitrogen a year", colour:"#5E7377", route:"country", ready:true, off: true,
+    note: "The country totals the Global Wastewater Model's data package gives (Tuholske et al. 2021, KNB doi:10.5063/F76B09), with its split by treatment, septic and untreated." },
   { id:"hydrowaste",           name:"Wastewater treatment plants (HydroWASTE)", unit:"plants", colour:"#5E7278", route:"pmtiles", ready:true, off: true,
     note: "HydroWASTE v1.0: 58,502 wastewater treatment plants, with the population each serves, the treated wastewater it discharges, its level of treatment, its estimated outfall and the river's dilution there (Ehalt Macedo et al., Earth System Science Data 2022; CC BY 4.0). The database behind HydroFATE's map, whose own page cannot be read to draw here. Every column is kept." },
   { id:"slavery_sites",        name:"Brick kilns and artisanal mining", unit:"sites", colour:"#8A6B62", route:"pmtiles", ready:true, off: true,
@@ -9308,6 +9322,9 @@ const LAYER_KIND = {
   glad_loss: ["plant", "downstream"],
   soilgrids: ["microorganism", "downstream"],
   wastewater: ["insentient", "downstream"],
+  wastewater_n_tot: ["insentient", "downstream"], wastewater_n_treated: ["insentient", "downstream"],
+  wastewater_n_septic: ["insentient", "downstream"], wastewater_n_open: ["insentient", "downstream"],
+  wastewater_n_countries: ["insentient", "downstream"],
   site_environment_law: ["human", "upstream"],
   site_environment_law_shapes: ["human", "upstream"],
   enviro_law_by_country: ["human", "upstream"],
@@ -9984,6 +10001,7 @@ const NOT_LIVE = {
   gta_acts: "Global Trade Alert's acts, from a copy made daily",
   giga_countries: "Giga's figures, from a copy made daily (its service does not let other sites read it)",
   wastewater: "The Global Wastewater Model, from copies kept here; the model is not updated",
+  ...Object.fromEntries(["tot", "treated", "septic", "open"].map((k) => [`wastewater_n_${k}`, "Built once from the Global Wastewater Model's data package (2021); the model is not updated"])),
   trase_measures: "Trase's values come from a copy made weekly; only the region shapes are read live",
   atlas_cities: "The places are from a copy made weekly; each city's own page is read live",
   ...Object.fromEntries(["pm2_5", "bc", "oc", "so2", "vocs", "co", "nh3", "nox"].map((g) => [`ct_air_${g}`,
@@ -10035,7 +10053,7 @@ const PANEL_ORDER = [
   // Carbon bombs, the Carbon Majors and Banking on Climate Chaos under Carbon
   // dioxide, and nitrogen dioxide moved to Pollution (22 September, round 2).
   { h: 4, t: "Carbon dioxide" }, "owid_co2", "gem_coal", "power_plants", "fractracker_refineries", "carbon_plumes", "carbon_bombs", "carbon_majors", "bocc",
-  { h: 4, t: "Methane" }, "carbon_plumes", "hydrowaste", "wastewater",
+  { h: 4, t: "Methane" }, "carbon_plumes", "hydrowaste",
   { h: 4, t: "Nitrous oxide" }, "fertilizer_facilities",
   { h: 5, t: "Soy" }, "trase_silos_brazil",
   { h: 5, t: "Corn" },
@@ -10061,7 +10079,9 @@ const PANEL_ORDER = [
   { h: 4, t: "Ammonia" }, "ct_air_nh3",
   { h: 4, t: "Nitrogen oxides" }, "ct_air_nox",
   { h: 4, t: "Nitrogen dioxide" },
-  { h: 4, t: "Wastewater" }, "hydrowaste", "wastewater",
+  // The model's map server is gone; its data package is drawn instead
+  // (pipeline/wastewater_build.py, 23 September).
+  { h: 4, t: "Wastewater" }, "hydrowaste", "wastewater_n_tot", "wastewater_n_treated", "wastewater_n_septic", "wastewater_n_open", "wastewater_n_countries",
   { h: 4, t: "Plastics" },
   { h: 5, t: "Production" }, "pirg_plastic", "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch",
   { h: 5, t: "Waste and dumping" }, "gpw_map", "seas_of_plastic", "coastal_cleanup",
@@ -10184,6 +10204,9 @@ const PANEL_REMOVED = new Set([
   // available to the public", checked 22 September); the two explorers can
   // never draw. Soy and corn are still drawn by MapSPAM's rows and Trase's.
   "usda_soybean", "usda_corn",
+  // The Global Wastewater Model's map server is gone (its five pictures 404);
+  // its data package is drawn by the wastewater_n_* rows instead.
+  "wastewater",
   // Taken out 19 Sept: near duplicates, a background map mistaken for data, rows
   // merged into another, and pages asked to be removed.
   "site_cartel_cells", "site_export_credit_shading", "giga_schools", "nsf_locations",
diff --git a/map/test.mjs b/map/test.mjs
index 3f51e4c..28ea3ff 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3234,5 +3234,20 @@ console.log("\nround of 23 September: one row per air pollutant");
   const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "wastewater_inspect.py"), "utf8");
   check("the wastewater package is inspected from KNB before a build is written", /urn:uuid:af8d0bd6-dc0c-4149-a3cd-93b5aed71f7c/.test(py) && /def dbf_fields/.test(py));
 }
+console.log("\nround of 23 September (2): the wastewater model from its data package");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
+  const ids = ["wastewater_n_tot", "wastewater_n_treated", "wastewater_n_septic", "wastewater_n_open", "wastewater_n_countries"];
+  check("the four pour-point measures and the country totals are rows under Wastewater, the dead picture row out",
+        ids.every((id) => new RegExp(`id:"${id}"`).test(src) && o.PANEL_ORDER.includes(id)) && o.PANEL_REMOVED.has("wastewater") && !o.PANEL_ORDER.includes("wastewater"));
+  check("\u2026each archive is read from the tiles repo, named for its row", ["tot", "treated", "septic", "open"].every((k) =>
+        src.includes(`archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_${k}.pmtiles"`)));
+  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "wastewater_build.py"), "utf8");
+  check("the build keeps every point at every zoom, weighs each archive by its own measure, and works out the unit rather than guessing it",
+        /"-r1"/.test(py) && /"--no-feature-limit", "--no-tile-size-limit"/.test(py) && /value=p\.get\(field\)/.test(py) && /def unit_of\(total\)/.test(py) &&
+        /fits no unit/.test(py) && /not in longitude and latitude/.test(py));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
diff --git a/pipeline/wastewater_build.py b/pipeline/wastewater_build.py
new file mode 100644
index 0000000..3259c1b
--- /dev/null
+++ b/pipeline/wastewater_build.py
@@ -0,0 +1,132 @@
+#!/usr/bin/env python3
+"""
+The Global Wastewater Model (Tuholske et al. 2021, KNB doi:10.5063/F76B09),
+rebuilt from its data package now that its own map server is gone.
+
+Reads the package that pipeline/wastewater_inspect.py downloaded into
+pipeline/.wastewater-cache and makes:
+
+  <tiles>/wastewater_n_tot.pmtiles       every one of the 134,846 pour points
+  <tiles>/wastewater_n_treated.pmtiles   (where a watershed's wastewater
+  <tiles>/wastewater_n_septic.pmtiles    reaches the coast), each archive
+  <tiles>/wastewater_n_open.pmtiles      weighing the points by one measure
+  map/data/wastewater_n_countries.countries.json   the package's own country totals
+
+Every point is kept, with every field the package gives it. Each archive's
+"value" is its own measure (all wastewater, from treatment plants, from septic
+systems, or untreated), so the map's glow is weighed by it. The unit is not
+written in the package's tables; it is worked out from the global total the
+paper states (6.2 million tonnes of nitrogen a year) and printed, and the build
+stops if the total fits no unit, rather than guessing.
+
+The coastal plume pictures (four 3 GB GeoTIFFs) are not built here.
+
+Run from the repo root, with tippecanoe installed:
+    pip install pyshp
+    python3 pipeline/wastewater_build.py [--tiles ~/Desktop/culprits-tiles-more/tiles]
+"""
+import io, json, math, pathlib, subprocess, sys, tempfile, zipfile
+
+ROOT = pathlib.Path(__file__).resolve().parent.parent
+CACHE = ROOT / "pipeline" / ".wastewater-cache"
+ZIP = CACHE / "N_PourPoint_And_Watershed.zip"
+DATA = ROOT / "map" / "data" / "wastewater_n_countries.countries.json"
+MEASURES = {"tot": "tot_N", "treated": "treated_N", "septic": "septic_N", "open": "open_N"}
+PAPER_TOTAL_T = 6.2e6          # tonnes of nitrogen a year, the paper's global figure
+CITE = "Tuholske et al. 2021, Global Wastewater Model (KNB doi:10.5063/F76B09)"
+
+
+def tiles_dir():
+    if "--tiles" in sys.argv:
+        return pathlib.Path(sys.argv[sys.argv.index("--tiles") + 1]).expanduser()
+    return pathlib.Path("~/Desktop/culprits-tiles-more/tiles").expanduser()
+
+
+def reader(z, stem, table_only=False):
+    import shapefile
+    part = lambda ext: io.BytesIO(z.read(f"{stem}.{ext}")) if f"{stem}.{ext}" in z.namelist() else None
+    if table_only:                       # the country shapes are 510 MB and only their table is used
+        return shapefile.Reader(dbf=part("dbf"), encoding="utf-8")
+    return shapefile.Reader(shp=part("shp"), shx=part("shx"), dbf=part("dbf"), encoding="utf-8")
+
+
+def clean(v):
+    if isinstance(v, float) and not math.isfinite(v):
+        return None
+    return v.strip() if isinstance(v, str) else v
+
+
+def unit_of(total):
+    """The unit the tables are in, from how their global total compares with the paper's."""
+    for name, per_tonne in (("kilograms", 1e3), ("grams", 1e6), ("tonnes", 1.0)):
+        if 0.5 <= total / (PAPER_TOTAL_T * per_tonne) <= 2:
+            return name, per_tonne
+    return None, None
+
+
+def main():
+    if not ZIP.exists():
+        sys.exit(f"{ZIP} is not there; run pipeline/wastewater_inspect.py first.")
+    try:
+        import shapefile  # noqa: F401
+    except ImportError:
+        sys.exit("pyshp is needed: pip install pyshp")
+    z = zipfile.ZipFile(ZIP)
+    pts = reader(z, "effluent_N_pourpoints_all")
+    x0, y0, x1, y1 = pts.bbox
+    if not (-181 <= x0 <= x1 <= 181 and -91 <= y0 <= y1 <= 91):
+        sys.exit(f"The pour points are not in longitude and latitude (their extent is {pts.bbox}), and the package "
+                 "gives no projection file; nothing was built.")
+    names = [f[0] for f in pts.fields[1:]]
+    rows = []
+    for sr in pts.iterShapeRecords():
+        if not sr.shape.points:
+            continue
+        lon, lat = sr.shape.points[0]
+        rows.append(((round(lon, 5), round(lat, 5)), {k: clean(v) for k, v in zip(names, sr.record)}))
+    total = sum(float(p.get("tot_N") or 0) for _, p in rows)
+    unit, per_tonne = unit_of(total)
+    if not unit:
+        sys.exit(f"The pour points add up to {total:,.0f}, which fits no unit against the paper's 6.2 million tonnes; nothing was built.")
+    print(f"wastewater: {len(rows):,} pour points; together {total:,.0f}, so the tables are in {unit} of nitrogen a year "
+          f"({total / per_tonne / 1e6:.2f} million tonnes)", flush=True)
+    unit_text = f"{unit} of nitrogen a year"
+
+    out = tiles_dir()
+    out.mkdir(parents=True, exist_ok=True)
+    for key, field in MEASURES.items():
+        lid = f"wastewater_n_{key}"
+        with tempfile.NamedTemporaryFile("w", suffix=".geojsonl", delete=False) as f:
+            for (lon, lat), p in rows:
+                props = dict(p, value=p.get(field), unit=unit_text, source=CITE)
+                f.write(json.dumps({"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]},
+                                    "properties": props}, separators=(",", ":")) + "\n")
+            path = f.name
+        dest = out / f"{lid}.pmtiles"
+        # Every point at every zoom: no dropping, no merging.
+        cmd = ["tippecanoe", "-o", str(dest), "--force", "-l", lid, "-z10", "-r1",
+               "--no-feature-limit", "--no-tile-size-limit", "-P", path]
+        subprocess.run(cmd, check=True)
+        size = dest.stat().st_size
+        print(f"wastewater: {dest.name} {size / 1e6:.1f} MB", flush=True)
+        if size > 95e6:
+            print(f"  {dest.name} is over 95 MB, which GitHub refuses; say so and it will be cut into parts.", flush=True)
+
+    cty = reader(z, "effluent_N_countries_gdam_all", table_only=True)
+    cnames = [f[0] for f in cty.fields[1:]]
+    countries = {}
+    for rec in cty.iterRecords():
+        p = {k: clean(v) for k, v in zip(cnames, rec)}
+        iso = p.get("ISO3")
+        if not iso:
+            continue
+        countries[iso] = dict({"id": iso, "source": "wastewater_n_countries", "name": iso, "value": p.get("tot_N"),
+                               "unit": unit_text, "year": 2015, "licence": "see the KNB record",
+                               "url": "https://doi.org/10.5063/F76B09"},
+                              **{f"x_{k}": v for k, v in p.items()})
+    DATA.write_text(json.dumps(countries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
+    print(f"wastewater: {len(countries)} countries written to {DATA.relative_to(ROOT)}", flush=True)
+
+
+if __name__ == "__main__":
+    main()
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
