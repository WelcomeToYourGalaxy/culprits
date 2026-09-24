#!/usr/bin/env python3
"""
Round of 23 September (5): the wastewater archives small enough for GitHub and quick at the
world view (id and value in the tiles, to zoom 8; every field in 256 pieces read on a click), and the
Waste Atlas probe trying http as well as https and saying why an address did not answer.
Built against culprits main at f2db607 (it replaces round_0923e.py, which was never applied).
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 3a74060..14d9093 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -789,6 +789,14 @@ treated, total). No projection file is included.
   projection of the ocean-impact maps the model feeds. The build now tests it:
   every point must fall inside the Mollweide world ellipse, or it stops. The
   extent's corners come back at latitude 83.6 N and 59.5 S, coasts that exist.
+- **First real run**: Mollweide confirmed (all 134,846 inside the ellipse,
+  latitudes -59.5 to 83.6), the unit grams (6.19 Mt N a year in total). With
+  every field in every tile to zoom 10 the archives were 85.5 and 99.2 MB,
+  and the Mac's disk filled. The tiles now carry only `id` (basin_id) and
+  `value`, to zoom 8 (enlarged beyond), and every field is in 256 pieces at
+  culprits-tiles-more `wastewater/pieces/` (FNV-1a, the map's `pieceOf`), read
+  on a click through `cfg.boxes`. Working files are deleted as it goes; a file
+  over 95 MB stops the build.
 - **Waste Atlas** (item 44): `pipeline/wasteatlas_probe.py` lists the page's
   scripts and the data addresses in them, for the reader to be written from.
 
diff --git a/map/app.js b/map/app.js
index e154753..964d261 100644
--- a/map/app.js
+++ b/map/app.js
@@ -355,19 +355,23 @@ const LAYERS = [
   { id:"gmo_animal_trade", sourceOf:"gmo_releases", name:"Animal breeders, dealers, exhibitors and carriers (USDA Animal Welfare Act)", unit:"licensees", colour:"#74695E", route:"pmtiles", ready:true, off: true,
     where: ["all", ["==", ["get", "id"], "industry:animals"],
             ["!", ["in", ["get", "x_type"], ["literal", ["Animal Welfare Act research facility", "Accredited animal research organisation", "CCAC certified institution"]]]]] },
-  { id:"wastewater_n_tot", name:"Nitrogen from human wastewater reaching the sea, all of it, by coastal outlet (Tuholske et al.)", unit:"nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
+  { id:"wastewater_n_tot", name:"Nitrogen from human wastewater reaching the sea, all of it, by coastal outlet (Tuholske et al.)", unit:"grams of nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
     archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_tot.pmtiles",
+    boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wastewater/pieces",
     note: "The Global Wastewater Model (Tuholske et al. 2021, KNB doi:10.5063/F76B09): each of its 134,846 pour points, where a watershed's wastewater reaches the coast, weighed by this share of its nitrogen. Built from the model's data package; every field it gives is kept, the unit included. The model is not updated." },
-  { id:"wastewater_n_treated", name:"Nitrogen from sewage treatment plants reaching the sea, by coastal outlet (Tuholske et al.)", unit:"nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
+  { id:"wastewater_n_treated", name:"Nitrogen from sewage treatment plants reaching the sea, by coastal outlet (Tuholske et al.)", unit:"grams of nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
     archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_treated.pmtiles",
+    boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wastewater/pieces",
     note: "The Global Wastewater Model (Tuholske et al. 2021, KNB doi:10.5063/F76B09): each of its 134,846 pour points, where a watershed's wastewater reaches the coast, weighed by this share of its nitrogen. Built from the model's data package; every field it gives is kept, the unit included. The model is not updated." },
-  { id:"wastewater_n_septic", name:"Nitrogen from septic systems reaching the sea, by coastal outlet (Tuholske et al.)", unit:"nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
+  { id:"wastewater_n_septic", name:"Nitrogen from septic systems reaching the sea, by coastal outlet (Tuholske et al.)", unit:"grams of nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
     archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_septic.pmtiles",
+    boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wastewater/pieces",
     note: "The Global Wastewater Model (Tuholske et al. 2021, KNB doi:10.5063/F76B09): each of its 134,846 pour points, where a watershed's wastewater reaches the coast, weighed by this share of its nitrogen. Built from the model's data package; every field it gives is kept, the unit included. The model is not updated." },
-  { id:"wastewater_n_open", name:"Nitrogen from untreated human waste reaching the sea, by coastal outlet (Tuholske et al.)", unit:"nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
+  { id:"wastewater_n_open", name:"Nitrogen from untreated human waste reaching the sea, by coastal outlet (Tuholske et al.)", unit:"grams of nitrogen a year", colour:"#5E7377", route:"pmtiles", ready:true, off: true,
     archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_open.pmtiles",
+    boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/wastewater/pieces",
     note: "The Global Wastewater Model (Tuholske et al. 2021, KNB doi:10.5063/F76B09): each of its 134,846 pour points, where a watershed's wastewater reaches the coast, weighed by this share of its nitrogen. Built from the model's data package; every field it gives is kept, the unit included. The model is not updated." },
-  { id:"wastewater_n_countries", name:"Nitrogen from human wastewater reaching the sea, by country (Tuholske et al.)", unit:"nitrogen a year", colour:"#5E7377", route:"country", ready:true, off: true,
+  { id:"wastewater_n_countries", name:"Nitrogen from human wastewater reaching the sea, by country (Tuholske et al.)", unit:"grams of nitrogen a year", colour:"#5E7377", route:"country", ready:true, off: true,
     note: "The country totals the Global Wastewater Model's data package gives (Tuholske et al. 2021, KNB doi:10.5063/F76B09), with its split by treatment, septic and untreated." },
   { id:"hydrowaste",           name:"Wastewater treatment plants (HydroWASTE)", unit:"plants", colour:"#5E7278", route:"pmtiles", ready:true, off: true,
     note: "HydroWASTE v1.0: 58,502 wastewater treatment plants, with the population each serves, the treated wastewater it discharges, its level of treatment, its estimated outfall and the river's dilution there (Ehalt Macedo et al., Earth System Science Data 2022; CC BY 4.0). The database behind HydroFATE's map, whose own page cannot be read to draw here. Every column is kept." },
diff --git a/map/test.mjs b/map/test.mjs
index 8fcbec5..60dfe85 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3267,7 +3267,7 @@ console.log("\nround of 23 September (2): the wastewater model from its data pac
         src.includes(`archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_n_${k}.pmtiles"`)));
   const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "wastewater_build.py"), "utf8");
   check("the build keeps every point at every zoom, weighs each archive by its own measure, and works out the unit rather than guessing it",
-        /"-r1"/.test(py) && /"--no-feature-limit", "--no-tile-size-limit"/.test(py) && /value=p\.get\(field\)/.test(py) && /def unit_of\(total\)/.test(py) &&
+        /"-r1"/.test(py) && /"--no-feature-limit", "--no-tile-size-limit"/.test(py) && /"value": p\.get\(field\)/.test(py) && /def unit_of\(total\)/.test(py) &&
         /fits no unit/.test(py) && /not in longitude and latitude/.test(py));
 }
 console.log("\nround of 23 September (3): the wastewater points' projection; Waste Atlas looked at");
@@ -3290,5 +3290,17 @@ console.log("\nbuildings stand up again (23 September)");
         !/\["case", \[">=", \["zoom"\]/.test(block) && topLevel >= 2 &&
         (paint.match(/\["zoom"\]/g) || []).length === topLevel);
 }
+
+console.log("\nround of 23 September (4): the wastewater archives made small enough for GitHub");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "wastewater_build.py"), "utf8");
+  check("the tiles carry only each point's id and value, to zoom 8, and the build stops rather than leave a file GitHub refuses",
+        /"properties": \{"id": str\(p\.get\("basin_id"\)\), "value": p\.get\(field\)\}/.test(py) && /"-z8"/.test(py) && /which GitHub refuses; stopped here/.test(py));
+  check("\u2026every field of every point is in 256 pieces, found by the same hash the map uses",
+        /def piece_of\(key\):/.test(py) && /0x811C9DC5/.test(py) && /0x01000193/.test(py) &&
+        ["tot", "treated", "septic", "open"].every((k) => new RegExp(`wastewater_n_${k}\\.pmtiles",\\n    boxes: "https://welcometoyourgalaxy\\.github\\.io/culprits-tiles-more/wastewater/pieces"`).test(src)));
+  check("\u2026and its working files are removed as it goes", /path\.unlink\(missing_ok=True\)/.test(py) && /work\.rmdir\(\)/.test(py));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
diff --git a/pipeline/wasteatlas_probe.py b/pipeline/wasteatlas_probe.py
index fe7c3cc..98cdac2 100644
--- a/pipeline/wasteatlas_probe.py
+++ b/pipeline/wasteatlas_probe.py
@@ -13,8 +13,9 @@ Run from the repo root:  python3 pipeline/wasteatlas_probe.py > ~/Desktop/wastea
 """
 import re, urllib.parse, urllib.request
 
-BASE = "https://www.atlas.d-waste.com/"
-UA = {"User-Agent": "Mozilla/5.0 (Culprits atlas; looking for Waste Atlas's data addresses)"}
+BASES = ["https://www.atlas.d-waste.com/", "http://www.atlas.d-waste.com/", "http://atlas.d-waste.com/"]
+UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
+      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}
 
 
 def get(url, n=None):
@@ -26,8 +27,16 @@ def get(url, n=None):
         return None, "", f"FAILED: {e}"
 
 
-status, kind, page = get(BASE)
-print(f"page: {status} {kind} {len(page):,} characters")
+# The first run got no answer from the https address and did not say why;
+# each address is now tried in turn, with the reason printed.
+BASE = page = None
+for b in BASES:
+    status, kind, body = get(b)
+    print(f"{b}: {status} {kind} {len(body):,} characters" + (f" \u2014 {body}" if status is None else ""))
+    if status and page is None:
+        BASE, page = b, body
+if page is None:
+    raise SystemExit("No address of Waste Atlas answered; nothing more to read.")
 scripts = [urllib.parse.urljoin(BASE, s) for s in re.findall(r"""<script[^>]+src=["']([^"']+)""", page, re.I)]
 print("\nscripts:")
 for s in scripts:
diff --git a/pipeline/wastewater_build.py b/pipeline/wastewater_build.py
index f8474d5..356a3af 100644
--- a/pipeline/wastewater_build.py
+++ b/pipeline/wastewater_build.py
@@ -68,6 +68,14 @@ def mollweide_inverse(x, y):
     return math.degrees(lon), math.degrees(lat)
 
 
+def piece_of(key):
+    """Which of 256 pieces a record is in: FNV-1a over its id, as the map's pieceOf."""
+    h = 0x811C9DC5
+    for b in str(key).encode("utf-8"):
+        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
+    return format(h % 256, "02x")
+
+
 def unit_of(total):
     """The unit the tables are in, from how their global total compares with the paper's."""
     for name, per_tonne in (("kilograms", 1e3), ("grams", 1e6), ("tonnes", 1.0)):
@@ -120,23 +128,43 @@ def main():
 
     out = tiles_dir()
     out.mkdir(parents=True, exist_ok=True)
+    # The tiles carry only each point's id and the measure it is weighed by;
+    # everything else the package gives for it is in 256 pieces beside them,
+    # read on a click (the map's pieceBox, FNV-1a of the id, as SkyTruth's are).
+    # With every field in every tile at every zoom the archives were 85 to 99 MB.
+    pieces_dir = out.parent / "wastewater" / "pieces"
+    pieces_dir.mkdir(parents=True, exist_ok=True)
+    pieces = {}
+    for (lon, lat), p in rows:
+        rid = str(p.get("basin_id"))
+        pieces.setdefault(piece_of(rid), {})[rid] = {"properties": dict(
+            {"title": f"Coastal outlet of watershed {rid}", "longitude": lon, "latitude": lat, "unit": unit_text, "source": CITE}, **p)}
+    for key, recs in pieces.items():
+        (pieces_dir / f"{key}.json").write_text(json.dumps(recs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
+    print(f"wastewater: {len(rows):,} records in {len(pieces)} pieces in {pieces_dir}", flush=True)
+    work = out / ".wastewater-build"
+    work.mkdir(exist_ok=True)
     for key, field in MEASURES.items():
         lid = f"wastewater_n_{key}"
-        with tempfile.NamedTemporaryFile("w", suffix=".geojsonl", delete=False) as f:
+        path = work / f"{lid}.geojsonl"
+        with open(path, "w", encoding="utf-8") as f:
             for (lon, lat), p in rows:
-                props = dict(p, value=p.get(field), unit=unit_text, source=CITE)
                 f.write(json.dumps({"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]},
-                                    "properties": props}, separators=(",", ":")) + "\n")
-            path = f.name
+                                    "properties": {"id": str(p.get("basin_id")), "value": p.get(field)}}, separators=(",", ":")) + "\n")
         dest = out / f"{lid}.pmtiles"
-        # Every point at every zoom: no dropping, no merging.
-        cmd = ["tippecanoe", "-o", str(dest), "--force", "-l", lid, "-z10", "-r1",
-               "--no-feature-limit", "--no-tile-size-limit", "-P", path]
-        subprocess.run(cmd, check=True)
+        # Every point at every zoom: no dropping, no merging. Zoom 8 is the
+        # deepest square made; closer in, the map enlarges those squares.
+        cmd = ["tippecanoe", "-o", str(dest), "--force", "-l", lid, "-z8", "-r1",
+               "--no-feature-limit", "--no-tile-size-limit", "-t", str(work), "-P", str(path)]
+        try:
+            subprocess.run(cmd, check=True)
+        finally:
+            path.unlink(missing_ok=True)
         size = dest.stat().st_size
         print(f"wastewater: {dest.name} {size / 1e6:.1f} MB", flush=True)
         if size > 95e6:
-            print(f"  {dest.name} is over 95 MB, which GitHub refuses; say so and it will be cut into parts.", flush=True)
+            sys.exit(f"  {dest.name} is over 95 MB, which GitHub refuses; stopped here so nothing too big is left to commit.")
+    work.rmdir()
 
     cty = reader(z, "effluent_N_countries_gdam_all", table_only=True)
     cnames = [f[0] for f in cty.fields[1:]]
'''

if "mollweide_inverse" not in (pathlib.Path.cwd() / "pipeline/wastewater_build.py").read_text() if (pathlib.Path.cwd() / "pipeline/wastewater_build.py").exists() else True:
    sys.exit("round_0923d.py has to be applied first; nothing was changed.")
if not (pathlib.Path.cwd() / "map/app.js").exists():
    sys.exit("Run this from the culprits-tiles-more folder (scripts/trase.py not found here).")
with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False) as f:
    f.write(DIFF)
    patch = f.name
def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)
if git("apply", "--check", "--reverse", patch).returncode == 0 or git("apply", "--check", "--reverse", "-C1", patch).returncode == 0:
    sys.exit("Already applied: nothing to do.")
check = git("apply", "--check", patch)
if check.returncode == 0:
    done = git("apply", patch)
    if done.returncode != 0:
        sys.exit(done.stderr)
else:
    # Edits in the working files not yet committed (another session's): fit
    # the change by one line of context either side instead of three, which
    # finds its place when those edits sit next to it. Nothing is changed if
    # even that does not fit.
    three = git("apply", "-C1", patch)
    if three.returncode != 0:
        touched = sorted(set(l[6:] for l in DIFF.splitlines() if l.startswith("+++ b/")))
        st = git("status", "--short", "--", *touched).stdout
        sys.exit("This patch does not fit the files on disk, so nothing was changed.\n" + check.stderr +
                 "\nFiles it touches that differ from the last commit on this Mac:\n" + (st or "  (none)\n") +
                 "Paste this message back.")
    print(three.stderr.strip())
print("Applied.")
