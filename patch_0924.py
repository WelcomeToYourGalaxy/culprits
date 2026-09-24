#!/usr/bin/env python3
"""
Shapes whose words the page writes only on click (such as the settler
colonialism territories) now take them from the page's own records; a shape's
box shows every field in full; close in, a click opens the nearest place, and
a list of places is offered only where markers overlap.
Run from the culprits folder, after git pull:

    python3 patch_0924.py

then:  node map/test.mjs
"""
import pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
app_path = ROOT / "map" / "app.js"
if not app_path.exists():
    sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits). Nothing was written.")
app = app_path.read_text(encoding="utf-8")
if "PICK_SPLIT_ZOOM" in app:
    sys.exit("Already applied - nothing to do.")
if "function addHud(" not in app:
    sys.exit("Run git pull first. Nothing was written.")
DIFF = r'''diff --git a/map/app.js b/map/app.js
index d25ce95..9a28fc8 100644
--- a/map/app.js
+++ b/map/app.js
@@ -5499,7 +5499,7 @@ async function addShapesLayer(cfg) {
     const title = p.name || p.country || p.title || cfg.name;
     const skip = new Set(["name", "country", "title", "list", "from_the_map", "entries"]);
     const rows = Object.entries(p).filter(([k, v]) => !k.startsWith("_") && !skip.has(k) && v !== "" && v != null)
-      .slice(0, 16).map(([k, v]) => `${shapeText(k.replace(/[_.]/g, " "))}: ${shapeText(v).slice(0, 400)}`);
+      .map(([k, v]) => `${shapeText(k.replace(/[_.]/g, " "))}: ${shapeText(v)}`);   // every field, in full
     const said = p.from_the_map ? shapeText(p.from_the_map).slice(0, 1200) : "";
     const list = p.list ? String(p.list).split("\n") : [];
     const shown = list.slice(0, 40).map((l) => shapeText(l).slice(0, 300));
@@ -5767,6 +5767,7 @@ async function openSitemapBox(hit, at) {
   }
 }
 
+const PICK_SPLIT_ZOOM = 6;
 function openSitemapClick(e) {
   const claim = e.originalEvent || e;
   if (popupClaimedBy === claim) return;
@@ -5777,6 +5778,17 @@ function openSitemapClick(e) {
     hits = hits.filter((h) => h.geometry && h.geometry.type === "Point");
   }
   if (!hits.length) return;
+  // A list of places is offered only where their markers sit on top of one
+  // another: wide out, where nearby places merge on the screen. From zoom
+  // PICK_SPLIT_ZOOM they have come apart, so the click opens the place nearest
+  // to it; only places at the very same spot still share a list.
+  if (hits.length > 1 && map.getZoom() >= PICK_SPLIT_ZOOM && e.point && map.project) {
+    const px = (h) => { const g = h.geometry; if (!g || g.type !== "Point") return null; const q = map.project(g.coordinates); return [q.x, q.y]; };
+    const d = (h) => { const q = px(h); return q ? Math.hypot(q[0] - e.point.x, q[1] - e.point.y) : 1e9; };
+    hits.sort((a, b) => d(a) - d(b));
+    const first = px(hits[0]);
+    hits = first ? hits.filter((h) => { const q = px(h); return q && Math.hypot(q[0] - first[0], q[1] - first[1]) < 1.5; }) : [hits[0]];
+  }
   popupClaimedBy = claim;
   ensureBoxCss();
   if (hits.length === 1) { openSitemapBox(hits[0], placeOf(hits[0], e)); return; }
diff --git a/map/test.mjs b/map/test.mjs
index 0a7a935..20dae59 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2104,5 +2104,14 @@ console.log("\nOff-planet sections, Of groups, names, launch links, drag bar, ma
   check("headings are in title case", tc("Suppression by \u201crepresentation\u201d within it") === "Suppression by \u201cRepresentation\u201d Within It" && tc("Of the planet") === "Of the Planet" && tc("For money-written-law") === "For Money-Written-Law");
 }
 
+console.log("\nfull shape words; place lists only where markers overlap");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const bs = fs.readFileSync(path.join(HERE, "..", "pipeline", "shapes", "build_shapes.py"), "utf8");
+  check("a shape's box shows every field in full", /\/\/ every field, in full/.test(src) && !/\.slice\(0, 16\)\.map\(\(\[k, v\]\)/.test(src));
+  check("shapes whose words live in the page's records take them", /def attach_page_data\(e, feats\)/.test(bs) && /attach_page_data\(e, feats\)\n    return feats/.test(bs));
+  check("close in, a click opens the nearest place instead of a list", /const PICK_SPLIT_ZOOM = 6;/.test(src) && /map\.getZoom\(\) >= PICK_SPLIT_ZOOM/.test(src));
+}
+
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
diff --git a/pipeline/shapes/build_shapes.py b/pipeline/shapes/build_shapes.py
index bae5fdc..10d1e13 100644
--- a/pipeline/shapes/build_shapes.py
+++ b/pipeline/shapes/build_shapes.py
@@ -294,9 +294,81 @@ def from_extract(e):
         if c:
             props["_map_colour"] = c
         feats.append({"type": "Feature", "geometry": geom, "properties": props})
+    attach_page_data(e, feats)
     return feats, []
 
 
+# Some maps write a shape's words only when it is clicked, from a list of
+# records in the page (a name, an explanation, sources, and the shape's own
+# corner points). The extraction sees the shapes but not those words, so the
+# records are read here and each shape takes every field of the record whose
+# corner points it has.
+PAGE_ARRAYS_JS = r"""
+const fs = require("fs"), vm = require("vm");
+const html = fs.readFileSync(process.argv[1], "utf8");
+const out = {};
+const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[/g;
+let m;
+while ((m = re.exec(html))) {
+  let i = re.lastIndex - 1, depth = 0, q = null, esc = false, j = i;
+  for (; j < html.length; j++) {
+    const c = html[j], n = html[j + 1];
+    if (q) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === q) q = null; continue; }
+    if (c === "/" && n === "/") { j = html.indexOf("\n", j); if (j < 0) break; continue; }
+    if (c === "/" && n === "*") { j = html.indexOf("*/", j) + 1; continue; }
+    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
+    if (c === "[" || c === "{") depth++;
+    if (c === "]" || c === "}") { depth--; if (depth === 0) break; }
+  }
+  try {
+    const v = vm.runInNewContext("(" + html.slice(i, j + 1) + ")", {}, { timeout: 2000 });
+    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) out[m[1]] = v;
+  } catch (e) { /* not a plain list */ }
+}
+process.stdout.write(JSON.stringify(out));
+"""
+
+
+def attach_page_data(e, feats):
+    if "url" not in e or not any(f["geometry"]["type"] != "Point" and set(f["properties"]) <= {"_map_colour"} for f in feats):
+        return
+    try:
+        html_text = requests.get(e["url"], headers=UA, timeout=60).text
+    except Exception as ex:  # noqa: BLE001
+        print(f"  {e['id']}: note: the page's records could not be read ({ex})")
+        return
+    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as fh:
+        fh.write(html_text)
+    try:
+        arrays = json.loads(subprocess.run(["node", "-e", PAGE_ARRAYS_JS, fh.name], capture_output=True,
+                                           text=True, timeout=120).stdout or "{}")
+    finally:
+        os.unlink(fh.name)
+    key = lambda pts: tuple((round(a, 3), round(b, 3)) for a, b in pts[:4])
+    records = {}
+    for rows in arrays.values():
+        for r in rows:
+            for k, v in r.items():
+                if isinstance(v, list) and len(v) >= 3 and all(isinstance(p, list) and len(p) == 2 for p in v):
+                    records[key([(p[1], p[0]) for p in v])] = (k, r)     # [lat, lng] -> [lng, lat]
+                    records.setdefault(key([(p[0], p[1]) for p in v]), (k, r))
+    n = 0
+    for f in feats:
+        g = f["geometry"]
+        rings = g["coordinates"] if g["type"] == "Polygon" else [p[0] for p in g["coordinates"]] if g["type"] == "MultiPolygon" else [g["coordinates"]] if g["type"] == "LineString" else []
+        for ring in (rings if g["type"] != "Polygon" else [rings[0]]):
+            hit = records.get(key(ring))
+            if hit:
+                ck, r = hit
+                for k, v in r.items():
+                    if k != ck and not isinstance(v, (list, dict)):
+                        f["properties"][k] = v
+                n += 1
+                break
+    if n:
+        print(f"  {e['id']}: the words of {n} shapes read from the page's own records")
+
+
 def leaflet_geometry(g):
     t, c = g.get("type"), g.get("coordinates")
     if t in ("Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon") and c and isinstance(_first_number(c), (int, float)):
'''

with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False, encoding="utf-8") as f:
    f.write(DIFF)
chk = subprocess.run(["git", "apply", "--check", f.name], cwd=ROOT, capture_output=True, text=True)
if chk.returncode:
    sys.exit("The files differ from the copy this was made for. Run git pull first. Nothing was written. " + chk.stderr)
subprocess.run(["git", "apply", f.name], cwd=ROOT, check=True)
print("Done. Test with: node map/test.mjs")
