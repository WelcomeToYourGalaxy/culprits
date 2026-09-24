#!/usr/bin/env python3
"""
Round of 23 September (17): the F-gas row takes its chips from the list its build writes. Built against 71bba5e.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/map/app.js b/map/app.js
index 86c2dd3..e2dce35 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3296,6 +3296,16 @@ async function readArcgisApp(cfg) {
 
 /* ---------- pictures read live, with a choice of the source's own layers ---------- */
 function addRasterChoiceLayer(cfg) {
+  // A row whose build writes its own list of chips (choicesUrl) reads it first:
+  // EDGAR's HFCs and the like come as one file per gas, so the chips are known
+  // only once the build has run. The chips written here stand if it cannot be read.
+  if (cfg.choicesUrl && !cfg._choicesRead) {
+    cfg._choicesRead = true;
+    return getJson(cfg.choicesUrl, 20000)
+      .then((d) => { if (d && Array.isArray(d.choices) && d.choices.length) cfg.choices = d.choices; })
+      .catch(() => {})
+      .then(() => addRasterChoiceLayer(cfg));
+  }
   const src = `${cfg.id}-img`;
   cfg._pick = cfg._pick || 0;
   map.addSource(src, rasterChoiceSource(cfg));
@@ -9169,6 +9179,7 @@ const OTHER_MAPS = {
       ],
       note: "What growing maize (corn) put on the land in 2017, food and feed together, mapped by Halpern et al. 2022 (Nature Sustainability) from their data package. Each chip is one of its four pressures, per map cell, coloured dark to light on a log scale cut at the values' own steps (food/<name>.key.json in culprits-tiles-more). Built once from the package; it is not updated." },
     { id: "edgar_fgases", name: "Fluorinated gas emissions by 10 km cell, one chip per gas, latest year (EDGAR)", unit: "tonnes of the gas per map cell", colour: "#6A5A6E", route: "rasterlive", ready: true, lazy: true,
+      choicesUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/edgar/fgases_choices.json",
       attribution: "EDGAR_2025_GHG, European Commission JRC, CC BY 4.0", maxzoom: 6,
       choices: [
         { label: "Hydrofluorocarbons (HFCs)", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/edgar_fgases_hfcs.pmtiles" },
diff --git a/map/test.mjs b/map/test.mjs
index f4a3453..2c7c283 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3438,5 +3438,12 @@ console.log("\nround of 23 September (16): watersheds, six more type rows, Trase
   const T = new Function(src.match(/const TRASE_REMOVED = [^\n]*\n/)[0] + "; return TRASE_REMOVED;")();
   check("Trase's GDP per capita row is out of the box, and no other measure", T.some((r) => r.test("GDP per capita")) && !T.some((r) => r.test("Soy deforestation exposure")));
 }
+console.log("\nround of 23 September (17): the F-gas chips from the build's own list");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("the F-gas row reads its chips from the list its build writes, one per gas drawn, keeping its own if the list cannot be read",
+        /choicesUrl: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/edgar\/fgases_choices\.json"/.test(src) &&
+        /if \(cfg\.choicesUrl && !cfg\._choicesRead\)/.test(src) && /if \(d && Array\.isArray\(d\.choices\) && d\.choices\.length\) cfg\.choices = d\.choices;/.test(src));
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
