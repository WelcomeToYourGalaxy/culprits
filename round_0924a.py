#!/usr/bin/env python3
"""
Round of 24 September: normalize.py takes Climate TRACE's registry entry for the per-gas ids (climate_trace_co2 ...).
Built against d641772.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 4dd47ce..9bebcc1 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -931,6 +931,14 @@ saves after each day, stops at 100 minutes, and carries on next run
 (`cerulean_archive/refill.json`). Mines' first file is 96.7 MB (92 MiB), under
 the 95 MiB cut.
 
+## Round of 24 September: ct_gases past normalize
+
+The first real `ct_gases` run (CO2) harvested 111,949,068 rows, then stopped in
+`pipeline/normalize.py`: `climate_trace_co2` was not in sources.json. The
+per-gas ids now take the `climate_trace` registry entry (normalize.py, after
+SOURCES). Watch the next run's time: a row count that size may be near the
+160-minute job limit.
+
 ## Round of 23 September (19): the slick archive, the saves, the city maps
 
 The run of 23 September (logs_97274071361) showed:
diff --git a/pipeline/normalize.py b/pipeline/normalize.py
index 5676597..343acb4 100644
--- a/pipeline/normalize.py
+++ b/pipeline/normalize.py
@@ -31,6 +31,12 @@ import sys
 ROOT = pathlib.Path(__file__).resolve().parent.parent
 REGISTRY = json.loads((ROOT / "sources.json").read_text())
 SOURCES = {s["id"]: s for s in REGISTRY["sources"]}
+# Climate TRACE by gas (culprits-tiles-more scripts/ct_gases.py) writes one
+# archive per gas under ids like climate_trace_co2; each is Climate TRACE's
+# own record, so it takes that registry entry (23 September: the first run
+# stopped here with "climate_trace_co2 is not in sources.json").
+for _gas in ("co2", "ch4", "n2o", "co2e_20yr", "co2e_100yr"):
+    SOURCES.setdefault(f"climate_trace_{_gas}", SOURCES["climate_trace"])
 
 FIELDS = ("id", "source", "name", "value", "unit", "year", "licence", "url")
 
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
