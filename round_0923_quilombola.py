#!/usr/bin/env python3
"""Round 21 (23 September): INCRA's quilombola communities kept.
Needs main at or after 491d9aa "Rows refiled and taken out by name".
Changes map/app.js, map/test.mjs, HANDOFF.md."""
import subprocess, sys, os, tempfile

DIFF = 'diff --git a/HANDOFF.md b/HANDOFF.md\nindex a5dcd14..7146400 100644\n--- a/HANDOFF.md\n+++ b/HANDOFF.md\n@@ -12,7 +12,8 @@ MapSPAM\'s rubber yield (no tiles published); Nusantara\'s `roadsegmentbuffer_spv`\n and its v3p3 copy, `base_ikn`, `base_road`, `base_road_edited`, `base_roadRGB`,\n `base_roadtrans`, `IDNMYSBorneo_Settlement_2017_GHS`,\n `IDNMYSBorneo_Transmigration_2021` and its `_wms` twin; the Congo Basin forest\n-roads; INCRA\'s rural settlements in Brazil. Placed: Liberia\'s mineral\n+roads; INCRA\'s rural settlements in Brazil (its quilombola communities stay, under\n+Land and territory: round 21 narrowed a rule that had caught them). Placed: Liberia\'s mineral\n exploration and development licences under Mining; logging roads under\n Deforestation only (no longer also Construction); the all-ecosystem\n disturbance alerts (DIST-ALERT) copied under Fire and Mining as well. In\ndiff --git a/map/app.js b/map/app.js\nindex f740031..8934bda 100644\n--- a/map/app.js\n+++ b/map/app.js\n@@ -4717,7 +4717,8 @@ const CATALOGUE_BY_TITLE = [\n   [/\\bIDNMYSBorneo_Settlement_2017_GHS\\b/, null],\n   [/\\bIDNMYSBorneo_Transmigration_2021(_wms)?\\b/, null],\n   [/(?=.*congo)(?=.*forest roads?\\b)/i, null],\n-  [/\\bincra\\b|(?=.*brazil)(?=.*rural settlements?)/i, null],\n+  // Rural settlements only: INCRA\'s quilombola communities stay (23 September, round 21).\n+  [/\\bincra_bra_rural_settlements\\b|(?=.*brazil)(?=.*rural settlements?)/i, null],\n   // Liberia\'s mineral exploration and development licences are mining rights,\n   // issued under its Minerals and Mining Law (23 September).\n   [/(?=.*(liberia|\\blbr_))(?=.*(exploration|development))(?=.*licen[cs]e)/i, [P + " > Mining"]],\ndiff --git a/map/test.mjs b/map/test.mjs\nindex affb41a..b650c76 100644\n--- a/map/test.mjs\n+++ b/map/test.mjs\n@@ -3483,5 +3483,14 @@ console.log("\\nround of 23 September (20): rows refiled and taken out by name");\n         f("Mineral exploration licenses \\u2014 Liberia") === P + " > Mining" && f("Liberia development licenses (exploration)") === P + " > Mining");\n   check("logging roads are under Deforestation, not Construction", f("Logging roads \\u2014 Congo Basin") === P + " > Deforestation");\n }\n+console.log("\\nround of 23 September (21): INCRA\'s quilombola communities kept");\n+{\n+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");\n+  const places = new Function(src.slice(src.indexOf("const P = \\"Destruction > Of the planet\\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();\n+  const f = (t) => places(t, t).join(" | ");\n+  check("INCRA\'s rural settlements are out, its quilombola communities are under Land and territory",\n+        f("INCRA Brazil Rural Settlements incra_bra_rural_settlements") === "(taken out)" &&\n+        f("INCRA Brazil Quilombola Communities incra_bra_quilombola_communities") === "Suppression > Of humans > Land and territory");\n+}\n console.log(`\\n${pass} passed, ${fail} failed\\n`);\n process.exit(fail ? 1 : 0);\n'

def run(*a):
    return subprocess.run(a, capture_output=True, text=True)

if not os.path.isfile("map/app.js"):
    sys.exit("Run this from ~/Desktop/culprits.")
src = open("map/app.js", encoding="utf-8").read()
if "incra_bra_rural_settlements" in src:
    sys.exit("Already applied: nothing to do.")
if '{ h: 3, t: "Other concessions" }' not in src:
    sys.exit('Apply round_0923_refile.py first ("Rows refiled and taken out by name"), then git pull.')
with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False, encoding="utf-8") as f:
    f.write(DIFF)
chk = run("git", "apply", "--check", f.name)
if chk.returncode:
    os.unlink(f.name)
    sys.exit("The patch does not fit this copy; nothing changed.\n" + chk.stderr)
res = run("git", "apply", f.name)
os.unlink(f.name)
if res.returncode:
    sys.exit(res.stderr)
print("Applied: map/app.js, map/test.mjs, HANDOFF.md")
