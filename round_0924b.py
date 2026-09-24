#!/usr/bin/env python3
"""
Round of 24 September (2): the Climate TRACE harvester can take one sector (CT_SECTORS). Built against the current main.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index adef8ce..714456d 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -1135,6 +1135,17 @@ saves after each day, stops at 100 minutes, and carries on next run
 (`cerulean_archive/refill.json`). Mines' first file is 96.7 MB (92 MiB), under
 the 95 MiB cut.
 
+## Round of 24 September (2): ct_gases a sector at a time
+
+The CO2 run harvested and normalised all 111,949,068 rows, then was stopped
+by the 160-minute limit while splitting, and kept nothing. The harvester now
+reads `CT_SECTORS` (comma list; unset means every sector, as before), and
+culprits-tiles-more `scripts/ct_gases.py` builds one (gas, sector) pair at a
+time, never-built first, starting a new pair only in the first 45 minutes and
+recording each as it finishes (`tiles/climate_trace_gases.json`: per gas,
+`sectors` and the `archives` the map reads). 24 pairs; run `ct_gases` until
+the log says every pair is built.
+
 ## Round of 24 September: ct_gases past normalize
 
 The first real `ct_gases` run (CO2) harvested 111,949,068 rows, then stopped in
diff --git a/pipeline/sources/climate_trace.py b/pipeline/sources/climate_trace.py
index d131e05..2b8056b 100644
--- a/pipeline/sources/climate_trace.py
+++ b/pipeline/sources/climate_trace.py
@@ -104,6 +104,13 @@ SECTORS = [
     "transportation",
     "waste",
 ]
+# CT_SECTORS narrows the harvest to named sectors (24 September): the per-gas
+# build in culprits-tiles-more (scripts/ct_gases.py) takes one sector a time,
+# since a whole gas is over 100 million rows and ran past the job's time limit.
+# Unset, every sector is harvested, as before.
+if os.environ.get("CT_SECTORS"):
+    _only = {x.strip() for x in os.environ["CT_SECTORS"].split(",") if x.strip()}
+    SECTORS = [x for x in SECTORS if x in _only]
 
 # Nothing is cut. Every emissions source Climate TRACE publishes with a
 # coordinate is harvested, and what a reader sees is decided in the map panel
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
