#!/usr/bin/env python3
"""Round 224r (19 October 2026): the Reproduction capture row after the
owner's 19 October changes to the map (its forced sterilization and forced
births layers separated).

From the separate "r" chat. It changes only two sentences of the
reproduction_capture row's note, and adds a HANDOFF note and one test block,
each found by text that appears once, so it applies before or after other
chats' rounds. Needs round 220r. Stops cleanly, changing nothing, if already
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
        sys.exit(f"round224r: {f} not found. Run this from the culprits folder.")
app, test, handoff = (f.read_text(encoding="utf-8") for f in (APP, TEST, HANDOFF))

if "## Round 224r" in handoff:
    print("round224r: already applied; nothing to do.")
    sys.exit(0)
if "## Round 220r" not in handoff:
    sys.exit("round224r: needs round 220r first. Nothing was changed.")

SWAPS = [
    ("Its five parts are the chips under the row: Government birth policies (UN, 2019), Forced sterilization and births, Birth incentives, "
     "Advertising and propaganda, Influence abroad.",
     "Its six parts are the chips under the row: Government birth policies (UN, 2019), Forced sterilization, Forced births and birth control, "
     "Birth incentives, Advertising and propaganda, Influence abroad."),
    ("Coloured as the map colours them: rose for coercion, teal for incentives, lavender for advertising, blue for influence abroad.",
     "Coloured as the map colours them: dark rose for forced sterilization, dusty rose for forced births and birth control, teal for incentives, "
     "violet for advertising, blue for influence abroad."),
]
for old, new in SWAPS:
    if app.count(old) != 1:
        sys.exit("round224r: the reproduction_capture note is not as round 220r left it. Nothing was changed.")
    app = app.replace(old, new)

TESTS = r'''console.log("\nround 224r (19 October): Reproduction capture's six parts");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const note = (src.match(/\{ id: "reproduction_capture",[\s\S]*?note: "([^"]*)" \}/) || [])[1] || "";
  check("the note names the six parts, forced sterilization apart from forced births",
    /Its six parts are the chips under the row: Government birth policies \(UN, 2019\), Forced sterilization, Forced births and birth control, Birth incentives, Advertising and propaganda, Influence abroad\./.test(note));
}

'''
anchor = 'console.log("\\nround 220r (19 October): the Reproduction capture row after the map\'s redesign");\n'
if test.count(anchor) != 1:
    sys.exit("round224r: round 220r's test block not found in map/test.mjs. Nothing was changed.")
test = test.replace(anchor, TESTS + anchor)

NOTE = '''## Round 224r (19 October)

From the separate "r" chat. Needs round 220r. Tiles patch round224r_tiles.py
beside it, and a new reproduction_capture.html for the maps repo. No
app.js?v= bump.

- Owner, 19 October, on the standalone map: forced sterilization and forced
  births made two layers (the 53 coercion cases split by kind: 33 forced or
  coerced sterilization; 20 forced births, abortion, contraception, quotas
  and fines, breeding and child removal); muted colours and small flat dots
  with a fine light rim; the local-map's lettering (Marcellus, Uncial
  Antiqua for the title); the UN's 1976-2019 table in place of the one-year
  figure; a question picker that wraps inside the panel; drag anywhere;
  a whole-world button and a click on the empty map zooming back out; a
  click on a dot from far out flying in; a Names switch; a Satellite
  basemap.
- On this map: the row's note names the six parts and their colours. The
  generic reader now finds six overlays, so the row has six chips.

'''
first = handoff.find("\n## Round ")
handoff = handoff[:first + 1] + NOTE + handoff[first + 1:]
APP.write_text(app, encoding="utf-8"); TEST.write_text(test, encoding="utf-8"); HANDOFF.write_text(handoff, encoding="utf-8")
print("round224r: applied (map/app.js, map/test.mjs, HANDOFF.md).")
