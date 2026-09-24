#!/usr/bin/env python3
"""
Round of 23 September (13): EIA's Environmental Crime Tracker copied under illegal logging, F-gases and
Of animals; notes on what it and the Atlas's city maps need. Built against 2bcec0f.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 4a7eb22..92c3cc4 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -785,6 +785,15 @@ Kept as the rounds go; move a line out when it is settled.
   changes; those are edited on github.com.
 - **Satellite basemap** is also worked on in another chat; changes here are
   kept to the lowland colour stops.
+- **EIA Environmental Crime Tracker** (their item 6): a Power BI report; the
+  full dataset is "available on request" from EIA's enquiry form, so it cannot
+  be drawn as points until the owner asks for it. Until then it is the page row
+  `powerbi_report`, now copied under Illegal logging and timber trafficking,
+  F-gases and Of animals as well as Biodiversity loss.
+- **Atlas hotspot-city maps** (their item 7): each city's map is a PNG, not a
+  PDF (atlas-for-the-end-of-the-world.com/images/hotspot_cities/<slug>.png),
+  so its town names are pixels, not text; placing them needs reading the
+  names off the picture (OCR) first. Not attempted yet.
 
 ## Round of 23 September (12): the other chat's list taken over; F-gases; the slick archive
 
diff --git a/map/app.js b/map/app.js
index 9aced67..1b709f0 100644
--- a/map/app.js
+++ b/map/app.js
@@ -10362,7 +10362,7 @@ const PANEL_ORDER = [
   { h: 5, t: "Soy" }, "trase_silos_brazil", "food_soy",
   { h: 5, t: "Corn" }, "food_maize",
   { h: 5, t: "Grain" }, "site_china_grain",
-  { h: 4, t: "F-gases" }, "edgar_fgases",
+  { h: 4, t: "F-gases" }, "edgar_fgases", "powerbi_report",
   { h: 4, t: "Black carbon" }, "fractracker_refineries", "ct_air_bc",
   // Oil and gas concessions (from the catalogues) are filed here as well as
   // under Oil and gas drilling: the wells emit carbon dioxide, methane and,
@@ -10396,6 +10396,9 @@ const PANEL_ORDER = [
   { h: 5, t: "Marine slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc", "skytruth_marine_incidents", "skytruth_posts",
   { h: 3, t: "Fire" },
   { h: 3, t: "Deforestation" },
+  // EIA's Environmental Crime Tracker also records illegal logging and timber
+  // seizures, and smuggled HFC refrigerant gases: copied under both (23 September).
+  { h: 4, t: "Illegal logging and timber trafficking" }, "powerbi_report",
   { h: 4, t: "Tree cover loss and alerts" }, "glad_loss", "group:forest_alerts",
   { h: 4, t: "Moratoriums" },
   { h: 4, t: "Wood pulp, Indonesia" }, "trase_pulp_indonesia", "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023",
@@ -10429,7 +10432,7 @@ const PANEL_ORDER = [
   { h: 3, t: "Other" },
   { h: 2, t: "Of groups" },
   { h: 3, t: "Of humans" },
-  { h: 3, t: "Of animals" }, "final_nail",
+  { h: 3, t: "Of animals" }, "final_nail", "powerbi_report",
   { h: 3, t: "Of plants" },
   { h: 3, t: "Of microorganisms" },
   { h: 3, t: "Of the “insentient”" },
diff --git a/map/test.mjs b/map/test.mjs
index f840c85..27a3586 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1866,7 +1866,9 @@ console.log("\nthe layers box, in the chosen order");
   const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
   check("a layer named under two headings is one row and a copy of it, never two layers",
         /if \(placed\.has\(item\)\) \{\n\s*const copy = copyRow\(leads\.get\(item\), item\);/.test(src) &&
-        twice.every((id) => ids.filter((x) => x === id).length === 2), twice.join(", "));
+        // A row may sit under as many subjects as it belongs to (the crime
+        // tracker is under four); each naming after the first is a copy.
+        twice.every((id) => ids.filter((x) => x === id).length >= 2), twice.join(", "));
   {
     const feeds = ["skytruth_nrc", "skytruth_posts", "skytruth_marine_incidents", "skytruth_pa_permits", "skytruth_pa_spud",
                    "skytruth_pa_violations", "skytruth_well_permits", "skytruth_fracfocus", "skytruth_quakes"];
@@ -2226,7 +2228,8 @@ console.log("\nchanges of 19 September");
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
   const order = o.PANEL_ORDER, at = (t) => order.findIndex((x) => x && x.t === t), pos = (i) => order.indexOf(i);
-  const between = (i, a, b) => pos(i) > at(a) && (b == null || pos(i) < at(b));
+  // Any of a row's namings will do: a row under several subjects is found under each.
+  const between = (i, a, b) => o.PANEL_ORDER.some((x, k) => x === i && k > at(a) && (b == null || k < at(b)));
   check("no Whose world / Where in the chain chips in the box", !/chips\.innerHTML = kindChipsHtml\(\)/.test(src));
   check("every layer opens unticked", /for \(const c of LAYERS\) c\.off = true;/.test(src));
   check("the Eyes network is under Metaphysical (Religion, spirituality, etc.)", between("site_eyes_network", "Metaphysical (Religion, spirituality, etc.)", "Sports") && at("Religion and spirituality") === -1);
@@ -3387,5 +3390,12 @@ console.log("\nround of 23 September (12): F-gases from EDGAR");
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   check("EDGAR's gridded F-gas emissions are a row under Climate > F-gases", /\{ h: 4, t: "F-gases" \}, "edgar_fgases",/.test(src) && /edgar_fgases\.pmtiles/.test(src));
 }
+console.log("\nround of 23 September (13): the crime tracker under every subject it records");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("EIA's Environmental Crime Tracker is copied under illegal logging, F-gases and the animals as well as biodiversity loss",
+        /"Illegal logging and timber trafficking" \}, "powerbi_report"/.test(src) && /"F-gases" \}, "edgar_fgases", "powerbi_report"/.test(src) &&
+        /"Of animals" \}, "final_nail", "powerbi_report"/.test(src));
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
