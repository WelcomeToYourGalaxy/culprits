#!/usr/bin/env python3
"""
atlas_plates.py: refuse a placement that throws the page off the map (the
OverflowError of the first run). Built against main at 8833e10.
Run from the repo root:  python3 atlas_fix_0922f.py
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 8b96700..c243897 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -455,6 +455,9 @@ map over this one, not a link out to the PDF.
   PDF with a country label and a wrong look-up mixed in: both were set aside
   and the corners came back exact. **Not yet run on the real PDFs**; the owner
   runs it (about half an hour the first time, for the look-ups).
+  First run stopped on a placement from three towns nearly in a line, which
+  threw the page off the map's square (OverflowError); such placements are now
+  refused (`on_earth`), and 300 random pages run through without error.
 - **The map**: a hotspot's or city's box carries a button marked
   `data-atlas-auto`; opening the box runs it (`atlasFrom`). A hotspot with a
   kept plate gets an image source `atlas-plate` at the four corners, the view
diff --git a/pipeline/atlas_plates.py b/pipeline/atlas_plates.py
index 633b475..563f428 100644
--- a/pipeline/atlas_plates.py
+++ b/pipeline/atlas_plates.py
@@ -83,8 +83,14 @@ R = 6378137.0
 def merc(lon, lat):
     lat = max(-85.0, min(85.0, lat))
     return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
+MERC_EDGE = R * math.pi          # the square web maps are drawn in, in metres from the centre
 def unmerc(x, y):
+    y = max(-MERC_EDGE, min(MERC_EDGE, y))
     return math.degrees(x / R), math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2)
+def on_earth(T, w, h):
+    """Whether a placement keeps the whole page on the map's square: three
+    towns nearly in a line give a placement that throws the page off it."""
+    return all(abs(v) <= MERC_EDGE for x, y in ((0, 0), (w, 0), (w, h), (0, h)) for v in apply(T, x, y))
 
 
 # Where on a label its place's dot is taken to be. Labels sit beside their dots
@@ -163,7 +169,7 @@ def place_page(labels, width_pt, height_pt, seed=0):
     for _ in range(TRIES):
         trio = rng.sample(usable, 3)
         T = fit_affine([((l[1], l[2]), rng.choice(l[3])) for l in trio])
-        if not T:
+        if not T or not on_earth(T, width_pt, height_pt):
             continue
         a, b = apply(T, 0, 0), apply(T, width_pt, 0)
         span_km = ground_km(*a, *b)
@@ -181,6 +187,8 @@ def place_page(labels, width_pt, height_pt, seed=0):
     if not best or len(best[1]) < MIN_AGREE:
         return {"kept": False, "reason": f"only {len(best[1]) if best else 0} names agree on a placement (at least {MIN_AGREE} needed)"}
     T = fit_affine([(p, c) for p, c, _ in best[1]])
+    if not T or not on_earth(T, width_pt, height_pt):
+        return {"kept": False, "reason": "the towns that agree give no placement that keeps the page on the map"}
     errs = []
     for p, c, name in best[1]:
         X, Y = apply(T, *p)
'''

if not (pathlib.Path.cwd() / "pipeline" / "atlas_plates.py").exists():
    sys.exit("Run this from ~/Desktop/culprits (pipeline/atlas_plates.py not found here).")
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
