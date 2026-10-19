#!/usr/bin/env python3
"""Round 225r (19 October 2026): the Reproduction capture row's colours,
after the owner asked for the Biodiversity Intactness Index 51-100% colours
(violet to electric blue, from the Invasion of non-humans map) across the
whole map.

From the separate "r" chat. It changes only one sentence of the
reproduction_capture row's note, and adds a HANDOFF note and one test block,
each found by text that appears once, so it applies before or after other
chats' rounds. Needs round 224r. Stops cleanly, changing nothing, if already
applied or if a place it looks for is missing.

Upload to WelcomeToYourGalaxy/culprits, folder patches/.
"""
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
ROOT = here.parent if here.name == "patches" else (here.parent.parent if here.name == "failed" else pathlib.Path.cwd())
APP, TEST, HANDOFF = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs", ROOT / "HANDOFF.md"
for f in (APP, TEST, HANDOFF):
    if not f.exists():
        sys.exit(f"round225r: {f} not found. Run this from the culprits folder.")
app, test, handoff = (f.read_text(encoding="utf-8") for f in (APP, TEST, HANDOFF))

if "## Round 225r" in handoff:
    print("round225r: already applied; nothing to do.")
    sys.exit(0)
if "## Round 224r" not in handoff:
    sys.exit("round225r: needs round 224r first. Nothing was changed.")

OLD = ("Coloured as the map colours them: dark rose for forced sterilization, dusty rose for forced births and birth control, teal for incentives, "
       "violet for advertising, blue for influence abroad.")
NEW = ("Coloured as the map colours them, in the five colours of the Biodiversity Intactness Index 51 to 100% layer (the Invasion of non-humans "
       "map's colours), violet to electric blue: violet for forced sterilization, pale violet for forced births and birth control, deep violet "
       "for incentives, indigo for advertising, electric blue for influence abroad.")
if app.count(OLD) != 1:
    sys.exit("round225r: the reproduction_capture note is not as round 224r left it. Nothing was changed.")
app = app.replace(OLD, NEW)

TESTS = r'''console.log("\nround 225r (19 October): Reproduction capture in the Biodiversity Intactness colours");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const note = (src.match(/\{ id: "reproduction_capture",[\s\S]*?note: "([^"]*)" \}/) || [])[1] || "";
  check("the note says the row takes the Biodiversity Intactness Index 51 to 100% colours", /Biodiversity Intactness Index 51 to 100% layer/.test(note) && !/dusty rose/.test(note));
}

'''
anchor = 'console.log("\\nround 224r (19 October): Reproduction capture\'s six parts");\n'
if test.count(anchor) != 1:
    sys.exit("round225r: round 224r's test block not found in map/test.mjs. Nothing was changed.")
test = test.replace(anchor, TESTS + anchor)

NOTE = '''## Round 225r (19 October)

From the separate "r" chat. Needs round 224r. Tiles patch round225r_tiles.py
beside it, and a new reproduction_capture.html for the maps repo. No
app.js?v= bump.

- Owner, 19 October, on the standalone map: the colours of the Invasion of
  non-humans map's Biodiversity Intactness Index 51 to 100% layer
  (#9B00C1, #7800CF, #5600DC, #3300EA, #1000F7, and paler mixes; greys for
  none and not given) for everything; smaller, flatter dots with a dark
  hairline; square check boxes and bar swatches in place of switches and
  round blobs; the Culprits map's Jurassic basemap (its Satellite basemap:
  graded Esri imagery, SAT_RELIEF's terrain palette, Swiss shading and calm
  sea) added beside Atlas, Satellite, Bioluminescent and Dark.
- On this map: one sentence of the row's note gives the new colours. The row
  keeps keepColour, so it draws the map's own colours.

'''
first = handoff.find("\n## Round ")
handoff = handoff[:first + 1] + NOTE + handoff[first + 1:]
APP.write_text(app, encoding="utf-8"); TEST.write_text(test, encoding="utf-8"); HANDOFF.write_text(handoff, encoding="utf-8")
print("round225r: applied (map/app.js, map/test.mjs, HANDOFF.md).")
