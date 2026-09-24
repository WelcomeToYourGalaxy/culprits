#!/usr/bin/env python3
"""Round 22 (23 September): Liberia's Mineral Development Agreements under Mining,
the resource rights under Land and territory.
Needs main at or after 853ac02 "INCRA quilombola communities kept".
Changes map/app.js, map/test.mjs, HANDOFF.md."""
import subprocess, sys, os, tempfile

DIFF = 'diff --git a/HANDOFF.md b/HANDOFF.md\nindex 7146400..bd7d4a7 100644\n--- a/HANDOFF.md\n+++ b/HANDOFF.md\n@@ -14,7 +14,9 @@ and its v3p3 copy, `base_ikn`, `base_road`, `base_road_edited`, `base_roadRGB`,\n `IDNMYSBorneo_Transmigration_2021` and its `_wms` twin; the Congo Basin forest\n roads; INCRA\'s rural settlements in Brazil (its quilombola communities stay, under\n Land and territory: round 21 narrowed a rule that had caught them). Placed: Liberia\'s mineral\n-exploration and development licences under Mining; logging roads under\n+exploration and development licences and its Mineral Development Agreements\n+under Mining; the resource rights (Cameroon, Equatorial Guinea, Liberia,\n+Namibia) under Land and territory (round 22); logging roads under\n Deforestation only (no longer also Construction); the all-ecosystem\n disturbance alerts (DIST-ALERT) copied under Fire and Mining as well. In\n `CATALOGUE_PLACES`, rubber goes under Deforestation (the Destruction page\ndiff --git a/map/app.js b/map/app.js\nindex 8934bda..5df0e45 100644\n--- a/map/app.js\n+++ b/map/app.js\n@@ -4722,6 +4722,11 @@ const CATALOGUE_BY_TITLE = [\n   // Liberia\'s mineral exploration and development licences are mining rights,\n   // issued under its Minerals and Mining Law (23 September).\n   [/(?=.*(liberia|\\blbr_))(?=.*(exploration|development))(?=.*licen[cs]e)/i, [P + " > Mining"]],\n+  // Liberia\'s Mineral Development Agreements, under Mining beside the licences;\n+  // Global Forest Watch\'s resource rights (Cameroon, Equatorial Guinea, Liberia,\n+  // Namibia) under Land and territory (23 September, round 22).\n+  [/\\blbr_mineral_development_agreement\\b|(?=.*liberia)(?=.*mineral development agreement)/i, [P + " > Mining"]],\n+  [/\\bgfw_resource_rights\\b/, ["Suppression > Of humans > Land and territory"]],\n   // Logging roads in the Congo Basin: Deforestation only, not Construction.\n   [/logging roads?\\b/i, [P + " > Deforestation"]],\n   // Placed by name.\ndiff --git a/map/test.mjs b/map/test.mjs\nindex b650c76..4c5b691 100644\n--- a/map/test.mjs\n+++ b/map/test.mjs\n@@ -3492,5 +3492,14 @@ console.log("\\nround of 23 September (21): INCRA\'s quilombola communities kept")\n         f("INCRA Brazil Rural Settlements incra_bra_rural_settlements") === "(taken out)" &&\n         f("INCRA Brazil Quilombola Communities incra_bra_quilombola_communities") === "Suppression > Of humans > Land and territory");\n }\n+console.log("\\nround of 23 September (22): Liberia\'s development agreements and the resource rights placed");\n+{\n+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");\n+  const places = new Function(src.slice(src.indexOf("const P = \\"Destruction > Of the planet\\";"), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();\n+  const f = (t) => places(t, t).join(" | ");\n+  check("Liberia\'s Mineral Development Agreements are under Mining, the resource rights under Land and territory",\n+        f("Liberia Mineral Development Agreement lbr_mineral_development_agreement") === "Destruction > Of the planet > Mining" &&\n+        f("Resource rights \\u2014 Currently available for Cameroon, Equatorial Guinea, Liberia and Namibia gfw_resource_rights") === "Suppression > Of humans > Land and territory");\n+}\n console.log(`\\n${pass} passed, ${fail} failed\\n`);\n process.exit(fail ? 1 : 0);\n'

def run(*a):
    return subprocess.run(a, capture_output=True, text=True)

if not os.path.isfile("map/app.js"):
    sys.exit("Run this from ~/Desktop/culprits.")
src = open("map/app.js", encoding="utf-8").read()
if "gfw_resource_rights" in src:
    sys.exit("Already applied: nothing to do.")
if "incra_bra_rural_settlements" not in src:
    sys.exit('Apply round_0923_quilombola.py first ("INCRA quilombola communities kept"), then git pull.')
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
