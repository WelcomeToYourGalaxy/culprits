#!/usr/bin/env python3
"""
Round of 23 September (19): the slick archive's months as several slim files, records read from Cerulean by id.
Built against ffdb20e.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 1b27103..6ac1596 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -869,6 +869,27 @@ saves after each day, stops at 100 minutes, and carries on next run
 (`cerulean_archive/refill.json`). Mines' first file is 96.7 MB (92 MiB), under
 the 95 MiB cut.
 
+## Round of 23 September (19): the slick archive, the saves, the city maps
+
+The run of 23 September (logs_97274071361) showed:
+- Slick archive: July and August were read back in full (48,546 and 49,107
+  slicks), but a month gzipped was over 95 MB and a month's tiles with every
+  field were 744 to 752 MB, and the save then stuck on a rebase clash over a
+  Python cache file. `scripts/cerulean_archive.py` now keeps a day to a file
+  (`cerulean_archive/<month>/<date>.geojson.gz`, older whole-month files
+  split on the next run), tiles only each slick's `id` and `t` (time), goes
+  from zoom 10 to 9, then splits a month by date into several files;
+  `tiles.json` may list an array per month. The map draws each file through
+  its own source and reads a slick's record from Cerulean by id on a click.
+- `.github/save.sh`: drops Python cache files before committing, and undoes a
+  rebase that stopped on a clash before trying again.
+- City maps: 2 of 33 placed (Osaka, Tel Aviv); OCR read 1 to 10 words a
+  picture. Now read at three times the size in grey at full contrast, in two
+  modes, and a north-up, one-scale fit (two names fix it, a third checks it)
+  is tried where the free fit finds too few.
+- That run's EDGAR job checked out the code before the nested-zip fix; it
+  needs running again.
+
 ## Round of 23 September (18): every field in the boxes that picked their own
 
 Item 9 of the handed-over list (every field a source publishes reaches the
diff --git a/map/app.js b/map/app.js
index f3bb001..63abd9c 100644
--- a/map/app.js
+++ b/map/app.js
@@ -6303,22 +6303,48 @@ async function addSlickArchive(cfg) {
   // The tiled form draws through its own pair of layers, so the plain-file
   // pair can stay exactly as it was; only one pair is ever shown.
   const tsrc = `${cfg.id}-pm`;
-  let tiledNow = null;
+  let tiledNow = null, tiledIds = [];
+  const bound = new Set();
+  // Since 23 September a month's tiles carry each slick's id and time only (a
+  // whole month with every field came to 750 MB); a click reads the slick's
+  // record from Cerulean by its id, as the live slick points do. The shapes
+  // stay on the map whatever the service does; its words need it answering.
+  // A month too big for one file is several, listed in tiles.json as an array.
+  const slickBox = (p, tail) => {
+    const foot = `<div class="meta">SkyTruth Cerulean, kept daily${tail}</div>`;
+    if (p.id == null || !Object.keys(p).every((k) => k === "id" || k === "t")) return `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table>${foot}`;
+    return fetch(`${CERULEAN}/collections/public.slick_plus/items/${encodeURIComponent(p.id)}?bbox-only=true`)
+      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
+      .then((j) => `<b>Oil slick</b><table class="meta">${fieldRows(j.properties || {}, ["centerlines"])}</table>${foot}`)
+      .catch((e) => `<b>Oil slick ${escapeHtml(String(p.id))}</b><div class="meta">${escapeHtml(String(p.t || ""))}</div>` +
+        `<div class="meta">Its record could not be read from Cerulean just now (${escapeHtml(e.message)}); the shape is kept here.</div>${foot}`);
+  };
   const showTiled = (m) => {
-    const url = `${cfg.base}/${tiled[m]}`;
+    const files = [].concat(tiled[m]);
+    const url = files.join(",");
     if (tiledNow !== url) {
-      ["-tfill", "-tline", "-tpt"].forEach((suffix) => { if (map.getLayer(cfg.id + suffix)) map.removeLayer(cfg.id + suffix); });
+      for (const id of tiledIds) if (map.getLayer(id)) map.removeLayer(id);
+      for (let i = 0; map.getSource(`${tsrc}${i}`); i++) map.removeSource(`${tsrc}${i}`);
       if (map.getSource(tsrc)) map.removeSource(tsrc);
-      map.addSource(tsrc, { type: "vector", url: `pmtiles://${url}` });
-      map.addLayer({ id: `${cfg.id}-tfill`, type: "fill", source: tsrc, "source-layer": "slicks", minzoom: 7,
-        paint: { "fill-color": "#1D1B17", "fill-opacity": 0.55 } });
-      map.addLayer({ id: `${cfg.id}-tline`, type: "line", source: tsrc, "source-layer": "slicks", minzoom: 7,
-        paint: { "line-color": "#B8A79E", "line-width": 1 } });
-      map.addLayer({ id: `${cfg.id}-tpt`, type: "circle", source: tsrc, "source-layer": "slick_points", maxzoom: 7,
-        paint: { "circle-color": "#B8A79E", "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.2, 6, 3.6],
-                 "circle-stroke-color": "#1D1B17", "circle-stroke-width": 0.5, "circle-opacity": 0.9 } });
-      bindHtmlPopup(`${cfg.id}-tfill`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily</div>`);
-      bindHtmlPopup(`${cfg.id}-tpt`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily \u00b7 zoom in for its shape</div>`);
+      tiledIds = [];
+      files.forEach((file, i) => {
+        const sid = `${tsrc}${i}`, sfx = i ? String(i) : "";
+        map.addSource(sid, { type: "vector", url: `pmtiles://${cfg.base}/${file}` });
+        map.addLayer({ id: `${cfg.id}-tfill${sfx}`, type: "fill", source: sid, "source-layer": "slicks", minzoom: 7,
+          paint: { "fill-color": "#1D1B17", "fill-opacity": 0.55 } });
+        map.addLayer({ id: `${cfg.id}-tline${sfx}`, type: "line", source: sid, "source-layer": "slicks", minzoom: 7,
+          paint: { "line-color": "#B8A79E", "line-width": 1 } });
+        map.addLayer({ id: `${cfg.id}-tpt${sfx}`, type: "circle", source: sid, "source-layer": "slick_points", maxzoom: 7,
+          paint: { "circle-color": "#B8A79E", "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.2, 6, 3.6],
+                   "circle-stroke-color": "#1D1B17", "circle-stroke-width": 0.5, "circle-opacity": 0.9 } });
+        tiledIds.push(`${cfg.id}-tfill${sfx}`, `${cfg.id}-tline${sfx}`, `${cfg.id}-tpt${sfx}`);
+        if (!bound.has(sfx)) {
+          bound.add(sfx);
+          bindHtmlPopup(`${cfg.id}-tfill${sfx}`, (p) => slickBox(p, ""));
+          bindHtmlPopup(`${cfg.id}-tpt${sfx}`, (p) => slickBox(p, " \u00b7 zoom in for its shape"));
+        }
+      });
+      cfg._layerIds = tiledIds.slice();
       tiledNow = url;
     }
     map.getSource(src).setData({ type: "FeatureCollection", features: [] });
diff --git a/map/test.mjs b/map/test.mjs
index c2617b6..35e8f27 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3455,5 +3455,13 @@ console.log("\nround of 23 September (18): every field in the boxes that picked
   check("a click on EPA's picture lists every facility it touches, not the first eight", /const hits = j\.results \|\| \[\];/.test(src));
   check("a shape's own words and list are shown whole, in a box that scrolls", !/shapeText\(p\.from_the_map\)\.slice\(0, 1200\)/.test(src) && !/list\.slice\(0, 40\)/.test(src));
 }
+console.log("\nround of 23 September (19): the slick archive's months made small enough for GitHub");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("a month may be several tile files, each drawn through its own source", /const files = \[\]\.concat\(tiled\[m\]\);/.test(src) && /files\.forEach\(\(file, i\) =>/.test(src));
+  check("…a slick with only its id and time in the tiles has its record read from Cerulean by id on a click",
+        /collections\/public\.slick_plus\/items\/\$\{encodeURIComponent\(p\.id\)\}\?bbox-only=true`\)\n\s*\.then/.test(src));
+  check("…each click layer is bound once, not again each time a month is shown", /if \(!bound\.has\(sfx\)\)/.test(src));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
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
