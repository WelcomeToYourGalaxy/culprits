#!/usr/bin/env python3
"""
Round of 23 September (7): Cerulean's slick points tiled with none merged, and
pipeline/knb_list.py for the food-footprint package (soy and corn). Needs round_0923g.py applied first.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 835ec27..e36c4cc 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -761,6 +761,23 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 23 September (6): every point at every zoom (item 25); soy and corn (item 24)
+
+- **No merged points.** The owner asked for every dot at every zoom. The
+  archives that merged crowded points into counts are now built with none
+  merged (`-r1 --no-feature-limit --no-tile-size-limit`, no `--cluster-*`):
+  culprits-tiles-more `mines.py` (points), `mine_features.py` (points),
+  `abattoir_cafo.py`, `epa_efpoints.py`, `skytruth_tiles.py`, and this repo's
+  `pipeline/cerulean/harvest_points.py`. Each marks its build as unmerged, so
+  the next run rebuilds once. CAFO and EPA lower their deepest zoom only if the
+  file would pass 95 MB. The cost, said to the owner: at the world view each
+  row fetches one heavier square before it draws.
+- **Soy and corn emissions**: Halpern et al. 2022 (Nature Sustainability)
+  maps greenhouse gases, water, disturbance and nutrients per food for 2017;
+  its data is KNB doi:10.5063/F1V69H1B (Frazier et al., Global food system
+  pressure data). `pipeline/knb_list.py` lists the package; the build is
+  written from that list.
+
 ## Round of 23 September (5): the owner's notes on the map
 
 - **No grain.** The fixed-noise overlay (`glowGrain`) textured the whole map
diff --git a/map/test.mjs b/map/test.mjs
index 4fbb888..13730be 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3321,5 +3321,12 @@ console.log("\nround of 23 September (5): the Atlas panel pared down; no grain;
   check("the news wires' open-and-shut arrow sits at the right-hand end of the bar",
         /id="wireEnd"/.test(wire) && /\.wire-toggle \.wire-caret\{display:none\}/.test(wire));
 }
+console.log("\nround of 23 September (6): every point at every zoom; the food package listed");
+{
+  const cer = fs.readFileSync(path.join(HERE, "..", "pipeline", "cerulean", "harvest_points.py"), "utf8");
+  check("Cerulean's slick points are tiled with none merged", !/--cluster-/.test(cer) && /"--no-tile-size-limit"/.test(cer));
+  const knb = fs.readFileSync(path.join(HERE, "..", "pipeline", "knb_list.py"), "utf8");
+  check("the food-footprint package (Halpern et al. 2022) is listed from KNB before a build is written", /doi:10\.5063\/F1V69H1B/.test(knb));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
diff --git a/pipeline/cerulean/harvest_points.py b/pipeline/cerulean/harvest_points.py
index 2766a52..642ce63 100644
--- a/pipeline/cerulean/harvest_points.py
+++ b/pipeline/cerulean/harvest_points.py
@@ -166,9 +166,8 @@ def tile(name, src, state):
     maxz = next(z for (_, n, z) in JOBS.values() if n == name)
     cmd = ["tippecanoe", "--quiet", "--force", f"--output={part}", f"--layer={name}", f"--name={name}",
            "--minimum-zoom=0", f"--maximum-zoom={maxz}", "--full-detail=12",
-           # Crowded points are merged, never dropped, and each merged point
-           # carries how many records it stands for.
-           "--cluster-distance=2", "--cluster-densest-as-needed", "--accumulate-attribute=_count:sum",
+           # Every slick at every zoom, none merged (asked for 23 September).
+           "-r1", "--no-feature-limit", "--no-tile-size-limit",
            "--attribution=SkyTruth Cerulean (cerulean.skytruth.org) — potential slicks from Sentinel-1 radar, not confirmed spills",
            str(src)]
     print("  tiling…")
diff --git a/pipeline/knb_list.py b/pipeline/knb_list.py
new file mode 100644
index 0000000..59cad81
--- /dev/null
+++ b/pipeline/knb_list.py
@@ -0,0 +1,44 @@
+#!/usr/bin/env python3
+"""
+Every file in a KNB data package, with its id and size, so a build can be
+written from what the package really holds. Changes nothing.
+
+Written for the food-footprint package behind Halpern et al. 2022, "The
+environmental footprint of global food production" (Nature Sustainability),
+cited there as Frazier et al., Global food system pressure data,
+doi:10.5063/F1V69H1B: greenhouse gas emissions, freshwater use, habitat
+disturbance and nutrient pollution, mapped food by food for 2017. Soy and
+maize are among its foods (item 24: the crops' own emissions, not only the
+fertiliser Climate TRACE shows).
+
+Run from the repo root:
+    python3 pipeline/knb_list.py doi:10.5063/F1V69H1B > ~/Desktop/food_package.txt
+"""
+import json, sys, urllib.parse, urllib.request
+
+SOLR = "https://knb.ecoinformatics.org/knb/d1/mn/v2/query/solr/"
+OBJ = "https://knb.ecoinformatics.org/knb/d1/mn/v2/object/"
+
+
+def ask(q, start=0):
+    url = SOLR + "?" + urllib.parse.urlencode({"q": q, "fl": "id,fileName,size,formatId,title", "rows": 1000,
+                                                "start": start, "wt": "json"})
+    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Culprits atlas"}), timeout=120) as r:
+        return json.loads(r.read())["response"]
+
+
+doi = sys.argv[1] if len(sys.argv) > 1 else "doi:10.5063/F1V69H1B"
+head = ask(f'id:"{doi}"')
+for d in head.get("docs", []):
+    print(f"package: {d.get('title') or d.get('fileName')}  [{d['id']}]")
+files, start = [], 0
+while True:
+    got = ask(f'isDocumentedBy:"{doi}" OR documents:"{doi}"', start)
+    files += [d for d in got.get("docs", []) if d["id"] != doi]
+    start += 1000
+    if start >= got.get("numFound", 0):
+        break
+total = sum(int(d.get("size") or 0) for d in files)
+print(f"{len(files)} files, {total / 1e9:.2f} GB in all\n")
+for d in sorted(files, key=lambda d: d.get("fileName") or ""):
+    print(f"{d.get('fileName')}  |  {int(d.get('size') or 0) / 1e6:.1f} MB  |  {d.get('formatId', '')}  |  {OBJ}{urllib.parse.quote(d['id'], safe='')}")
'''

if "mollweide_inverse" not in (pathlib.Path.cwd() / "pipeline/wastewater_build.py").read_text() if (pathlib.Path.cwd() / "pipeline/wastewater_build.py").exists() else True:
    sys.exit("round_0923d.py has to be applied first; nothing was changed.")
ap = pathlib.Path.cwd() / "map/app.js"
if not ap.exists() or "let atlasOwner" not in ap.read_text():
    sys.exit("round_0923g.py has to be applied first; nothing was changed.")
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
