#!/usr/bin/env python3
"""
Round of 23 September (3): the wastewater build reads Mollweide points (tested against the
world ellipse, not assumed) and pipeline/wasteatlas_probe.py. Needs round_0923c.py committed first.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 1de4c83..6ff779e 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -729,6 +729,15 @@ treated, total). No projection file is included.
   `wastewater` picture row is in `PANEL_REMOVED` (its server is gone) and no
   longer under Methane.
 - Not built yet: the plume GeoTIFFs and the watershed shapes.
+- **Projection** (the owner's first run stopped, as it should): the points are
+  not in longitude and latitude, and there is no .prj. Their extent (x to
+  +-17.9 million m, y -6.8 to 8.8 million m) is wider than Robinson, Eckert IV
+  or Equal Earth allow and fits Mollweide (ESRI:54009, radius 6378137), the
+  projection of the ocean-impact maps the model feeds. The build now tests it:
+  every point must fall inside the Mollweide world ellipse, or it stops. The
+  extent's corners come back at latitude 83.6 N and 59.5 S, coasts that exist.
+- **Waste Atlas** (item 44): `pipeline/wasteatlas_probe.py` lists the page's
+  scripts and the data addresses in them, for the reader to be written from.
 
 ## Round of 23 September: one row per air pollutant; the wastewater package found
 
diff --git a/map/test.mjs b/map/test.mjs
index 24e32ea..8d60a83 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3263,5 +3263,12 @@ console.log("\nround of 23 September (2): the wastewater model from its data pac
         /"-r1"/.test(py) && /"--no-feature-limit", "--no-tile-size-limit"/.test(py) && /value=p\.get\(field\)/.test(py) && /def unit_of\(total\)/.test(py) &&
         /fits no unit/.test(py) && /not in longitude and latitude/.test(py));
 }
+console.log("\nround of 23 September (3): the wastewater points' projection; Waste Atlas looked at");
+{
+  const py = fs.readFileSync(path.join(HERE, "..", "pipeline", "wastewater_build.py"), "utf8");
+  check("points not in longitude and latitude are turned from Mollweide only if every one lies inside its world ellipse",
+        /def mollweide_inverse\(x, y\):/.test(py) && /\(x \/ \(2 \* SQ2 \* A\)\) \*\* 2 \+ \(y \/ \(SQ2 \* A\)\) \*\* 2 > 1/.test(py) && /A = 6378137\.0/.test(py));
+  check("the Waste Atlas probe exists and only reads", fs.existsSync(path.join(HERE, "..", "pipeline", "wasteatlas_probe.py")));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
diff --git a/pipeline/wasteatlas_probe.py b/pipeline/wasteatlas_probe.py
new file mode 100644
index 0000000..fe7c3cc
--- /dev/null
+++ b/pipeline/wasteatlas_probe.py
@@ -0,0 +1,60 @@
+#!/usr/bin/env python3
+"""
+Where Waste Atlas (atlas.d-waste.com) keeps the data its map draws, found in
+its own page and scripts, before a reader is written for it. Changes nothing.
+
+Waste Atlas says it holds 164 countries, 1,799 cities, 1,626 sanitary landfills,
+93 dumpsites, 130 MBT units, 78 biological treatment plants and 716
+waste-to-energy plants, drawn with Google Maps from its own PHP back end. This
+prints every script the page loads, every address in them that looks like a
+data request, and the first part of what each such address answers.
+
+Run from the repo root:  python3 pipeline/wasteatlas_probe.py > ~/Desktop/wasteatlas.txt
+"""
+import re, urllib.parse, urllib.request
+
+BASE = "https://www.atlas.d-waste.com/"
+UA = {"User-Agent": "Mozilla/5.0 (Culprits atlas; looking for Waste Atlas's data addresses)"}
+
+
+def get(url, n=None):
+    try:
+        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
+            body = r.read() if n is None else r.read(n)
+            return r.status, r.headers.get("Content-Type", ""), body.decode("utf-8", "replace")
+    except Exception as e:  # noqa: BLE001
+        return None, "", f"FAILED: {e}"
+
+
+status, kind, page = get(BASE)
+print(f"page: {status} {kind} {len(page):,} characters")
+scripts = [urllib.parse.urljoin(BASE, s) for s in re.findall(r"""<script[^>]+src=["']([^"']+)""", page, re.I)]
+print("\nscripts:")
+for s in scripts:
+    print("  " + s)
+texts = {"(the page itself)": page}
+for s in scripts:
+    if "googleapis" in s or "gstatic" in s:
+        continue
+    st, _, body = get(s)
+    texts[s] = body
+    print(f"  read {s}: {st}, {len(body):,} characters")
+
+pattern = re.compile(r"""["']([^"'\s]*?(?:\.php|\.json|\.xml|\.kml|\.csv|ajax|api/)[^"'\s]*)["']""", re.I)
+calls = re.compile(r"""(\$\.(?:get|post|ajax|getJSON)\s*\([^;]{0,240}|XMLHttpRequest[^;]{0,200}|fetch\s*\([^;]{0,200}|url\s*:\s*["'][^"']+["'][^;]{0,160})""", re.I)
+found = {}
+print("\naddresses and requests in the page and its scripts:")
+for where, text in texts.items():
+    for m in pattern.findall(text):
+        found.setdefault(urllib.parse.urljoin(BASE, m), where)
+    for m in calls.findall(text):
+        print(f"  [{where.rsplit('/', 1)[-1]}] {' '.join(m.split())[:300]}")
+print("\ncandidate data addresses:")
+for url, where in sorted(found.items()):
+    print(f"  {url}   (in {where.rsplit('/', 1)[-1]})")
+print("\nwhat each same-site address answers (first 400 characters):")
+for url in sorted(found):
+    if urllib.parse.urlparse(url).netloc.endswith("d-waste.com"):
+        st, kind, body = get(url, 20000)
+        print(f"\n  {url}\n    {st} {kind}\n    {' '.join(body.split())[:400]}")
+print("\nDone.")
diff --git a/pipeline/wastewater_build.py b/pipeline/wastewater_build.py
index 3259c1b..f8474d5 100644
--- a/pipeline/wastewater_build.py
+++ b/pipeline/wastewater_build.py
@@ -56,6 +56,18 @@ def clean(v):
     return v.strip() if isinstance(v, str) else v
 
 
+A = 6378137.0                   # the sphere radius PROJ's Mollweide (ESRI:54009, WGS84) uses
+SQ2 = math.sqrt(2)
+
+
+def mollweide_inverse(x, y):
+    theta = math.asin(max(-1.0, min(1.0, y / (SQ2 * A))))
+    lat = math.asin(max(-1.0, min(1.0, (2 * theta + math.sin(2 * theta)) / math.pi)))
+    c = math.cos(theta)
+    lon = math.pi * x / (2 * SQ2 * A * c) if c > 1e-12 else 0.0
+    return math.degrees(lon), math.degrees(lat)
+
+
 def unit_of(total):
     """The unit the tables are in, from how their global total compares with the paper's."""
     for name, per_tonne in (("kilograms", 1e3), ("grams", 1e6), ("tonnes", 1.0)):
@@ -74,16 +86,30 @@ def main():
     z = zipfile.ZipFile(ZIP)
     pts = reader(z, "effluent_N_pourpoints_all")
     x0, y0, x1, y1 = pts.bbox
-    if not (-181 <= x0 <= x1 <= 181 and -91 <= y0 <= y1 <= 91):
-        sys.exit(f"The pour points are not in longitude and latitude (their extent is {pts.bbox}), and the package "
-                 "gives no projection file; nothing was built.")
+    raw = [(sr.shape.points[0], sr.record) for sr in pts.iterShapeRecords() if sr.shape.points]
+    if -181 <= x0 <= x1 <= 181 and -91 <= y0 <= y1 <= 91:
+        to_lonlat = lambda x, y: (x, y)
+        print("wastewater: the points are in longitude and latitude", flush=True)
+    else:
+        # The package gives no projection file. Its extent (x to +-17.9 million
+        # metres, y from -6.8 to 8.8 million) is wider than Robinson, Eckert IV
+        # or Equal Earth allow and fits Mollweide, the projection of the ocean
+        # impact maps this model feeds. That is tested, not assumed: in
+        # Mollweide every point must lie inside the world's ellipse; points in
+        # Mercator or most other projections would fall outside it.
+        out = [(x, y) for (x, y), _ in raw if (x / (2 * SQ2 * A)) ** 2 + (y / (SQ2 * A)) ** 2 > 1 + 1e-9]
+        if out:
+            sys.exit(f"The pour points are not in longitude and latitude (their extent is {pts.bbox}), and {len(out):,} of them "
+                     "fall outside the Mollweide world, so the projection is not known; nothing was built.")
+        to_lonlat = mollweide_inverse
+        print(f"wastewater: the points are in Mollweide (all {len(raw):,} inside its world ellipse); turned to longitude and latitude", flush=True)
     names = [f[0] for f in pts.fields[1:]]
     rows = []
-    for sr in pts.iterShapeRecords():
-        if not sr.shape.points:
-            continue
-        lon, lat = sr.shape.points[0]
-        rows.append(((round(lon, 5), round(lat, 5)), {k: clean(v) for k, v in zip(names, sr.record)}))
+    for (x, y), rec in raw:
+        lon, lat = to_lonlat(x, y)
+        rows.append(((round(lon, 5), round(lat, 5)), {k: clean(v) for k, v in zip(names, rec)}))
+    lats = [ll[1] for ll, _ in rows]
+    print(f"wastewater: the points run from latitude {min(lats):.1f} to {max(lats):.1f}", flush=True)
     total = sum(float(p.get("tot_N") or 0) for _, p in rows)
     unit, per_tonne = unit_of(total)
     if not unit:
'''

if not (pathlib.Path.cwd() / "pipeline/wastewater_build.py").exists():
    sys.exit("round_0923c.py has to be applied and committed first (pipeline/wastewater_build.py not found here).")
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
