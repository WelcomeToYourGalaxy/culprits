#!/usr/bin/env python3
"""Round 220r (19 October 2026): the Reproduction capture row after the map's
redesign (owner, 18 October).

From the separate "r" chat. It changes only the reproduction_capture row's
title and note, and adds a HANDOFF note and one test block, each found by
text that appears once, so it applies before or after other chats' rounds.
Needs round 215r. Stops cleanly, changing nothing, if already applied or if a
place it looks for is missing.

Upload to WelcomeToYourGalaxy/culprits, folder patches/.
"""
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
ROOT = here.parent if here.name == "patches" else (here.parent.parent if here.name == "failed" else pathlib.Path.cwd())
APP, TEST, HANDOFF = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs", ROOT / "HANDOFF.md"
for f in (APP, TEST, HANDOFF):
    if not f.exists():
        sys.exit(f"round220r: {f} not found. Run this from the culprits folder.")
app, test, handoff = (f.read_text(encoding="utf-8") for f in (APP, TEST, HANDOFF))

if "## Round 220r" in handoff:
    print("round220r: already applied; nothing to do.")
    sys.exit(0)
if "## Round 215r" not in handoff:
    sys.exit("round220r: needs round 215r first. Nothing was changed.")

OLD_NAME = 'id: "reproduction_capture", name: "Reproduction capture worldwide, by force, money, advertising and influence abroad (compiled from rulings, inquiries, the UN and reporting)"'
NEW_NAME = 'id: "reproduction_capture", name: "Reproduction capture worldwide (compiled from rulings, inquiries, the UN and reporting)"'
OLD_BITS = [
    ("with a line to each country an entry is aimed at where its sources name one, and a box for each country listing everything recorded for it. With them,",
     "with a line to each country an entry is aimed at where its sources name one. With them,"),
    ("Coloured as the map colours them: rose for coercion, teal for incentives, lavender for advertising, blue for influence abroad.",
     "Its five parts are the chips under the row: Government birth policies (UN, 2019), Forced sterilization and births, Birth incentives, "
     "Advertising and propaganda, Influence abroad. Coloured as the map colours them: rose for coercion, teal for incentives, lavender for "
     "advertising, blue for influence abroad."),
]
if app.count(OLD_NAME) != 1:
    sys.exit("round220r: the reproduction_capture title is not as round 214r left it. Nothing was changed.")
app = app.replace(OLD_NAME, NEW_NAME)
for old, new in OLD_BITS:
    if app.count(old) != 1:
        sys.exit("round220r: the reproduction_capture note is not as round 215r left it. Nothing was changed.")
    app = app.replace(old, new)

TESTS = r'''console.log("\nround 220r (19 October): the Reproduction capture row after the map's redesign");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const m = src.match(/\{ id: "reproduction_capture", name: "([^"]*)",[\s\S]*?note: "([^"]*)" \}/) || [];
  check("its title is short, with the source in brackets at the end", m[1] === "Reproduction capture worldwide (compiled from rulings, inquiries, the UN and reporting)");
  check("its note no longer promises a box per country, and names the five parts", !!m[2] && !/a box for each country/.test(m[2]) && /Government birth policies \(UN, 2019\)/.test(m[2]) && /Influence abroad\./.test(m[2]));
}

'''
anchor = 'console.log("\\nround 215r (16 October): the UN\'s 2019 answers in the Reproduction capture row");\n'
if test.count(anchor) != 1:
    sys.exit("round220r: round 215r's test block not found in map/test.mjs. Nothing was changed.")
test = test.replace(anchor, TESTS + anchor)

NOTE = '''## Round 220r (19 October)

From the separate "r" chat. Needs round 215r. Tiles patch round220r_tiles.py
beside it, and a new reproduction_capture.html for the maps repo. No
app.js?v= bump.

- Owner, 18 October, on the standalone map: the UN layer first; shorter
  layer titles; the "each country's record" layer removed; the side panel no
  longer pushes the page into scrolling; a sleeker look (small solid dots, no
  glow, plain sans type, switches); the map zooms out to the whole world and
  no longer repeats past the 180th meridian; Atlas (default), Bioluminescent
  and Hell basemaps from this map added beside Dark, the Atlas cartouche
  repainted to read "Reproduction capture".
- On this map: the row's title shortened; its note no longer mentions the
  per-country boxes and names the five parts. The overlay names the reader
  takes as chips are now the map's short titles.
- The standalone map draws Bioluminescent and Hell with MapLibre 5.24.0 under
  Leaflet (@maplibre/maplibre-gl-leaflet 0.1.4), with this map's NIGHT and
  HELL layers, sources and EB Garamond glyphs (read from the culprits Pages
  site). The sandbox cannot reach the tile servers, so those two were checked
  for errors only, not by eye.

'''
first = handoff.find("\n## Round ")
handoff = handoff[:first + 1] + NOTE + handoff[first + 1:]
APP.write_text(app, encoding="utf-8"); TEST.write_text(test, encoding="utf-8"); HANDOFF.write_text(handoff, encoding="utf-8")
print("round220r: applied (map/app.js, map/test.mjs, HANDOFF.md).")
