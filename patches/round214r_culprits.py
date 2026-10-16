#!/usr/bin/env python3
"""Round 214r (16 October 2026): Reproduction capture, one row under
On-planet invasion > Pre-birth frontlines.

Written in a separate chat from the one doing the "o" rounds. So it can go in
before or after any of that chat's rounds, it does not carry a fixed diff: it
finds each place by a line that only appears once and inserts beside it, and
touches nothing else. It needs round 213o (guards on its heading) and stops
cleanly, changing nothing, if it has already been applied or if any place it
looks for is missing.

Upload to WelcomeToYourGalaxy/culprits, folder patches/. Upload
round214r_tiles.py to culprits-tiles-more, folder patches/, so the row draws
before the next full refresh. Upload reproduction_capture.html to
WelcomeToYourGalaxy/maps (top folder) first.
"""
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
ROOT = here.parent if here.name in ("patches", "failed") else pathlib.Path.cwd()
if here.name == "failed":
    ROOT = here.parent.parent
APP = ROOT / "map" / "app.js"
TEST = ROOT / "map" / "test.mjs"
REG = ROOT / "pipeline" / "sitemaps" / "registry.json"
HANDOFF = ROOT / "HANDOFF.md"

for f in (APP, TEST, REG, HANDOFF):
    if not f.exists():
        sys.exit(f"round214r: {f} not found. Run this from the culprits folder.")

app = APP.read_text(encoding="utf-8")
test = TEST.read_text(encoding="utf-8")
reg = REG.read_text(encoding="utf-8")
handoff = HANDOFF.read_text(encoding="utf-8")

if "## Round 214r" in handoff or 'id: "reproduction_capture"' in app:
    print("round214r: already applied; nothing to do.")
    sys.exit(0)
if "## Round 213o" not in handoff:
    sys.exit("round214r: needs round 213o first (its heading is not in HANDOFF.md). Nothing was changed.")

ROW_NAME = ("Reproduction capture worldwide, by force, money, advertising and influence abroad "
            "(compiled from rulings, inquiries, the UN and reporting)")

ROW = '''    // Round 214r (asked 15 October 2026): the owner's Reproduction capture map
    // (maps repo, reproduction_capture.html), from the On-Planet Invasion
    // page's section of that name: governments pushing births up or down by
    // force, money and advertising, and the funding, funding cuts, networks and
    // fertility companies that carry it to other countries. Read each day from
    // the map itself by the generic site-map reader; its own layers are the
    // chips under the row and its boxes are its own.
    { id: "reproduction_capture", name: %s, unit: "entries", colour: "#5D80C2", route: "sitemap", ready: true, lazy: true,
      dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/reproduction_capture.places.geojson",
      keepColour: true,
      note: "The owner's map of reproduction capture (WelcomeToYourGalaxy/maps, reproduction_capture.html), read each day from the map itself: forced and coerced sterilization, forced contraception and forced births; cash, tax and housing incentives to raise or lower births; advertising and propaganda; and influence carried abroad (donor funding, funding cuts such as the Mexico City Policy, international networks, surrogacy and egg markets, fertility companies), with a line to each country an entry is aimed at where its sources name one, and a box for each country listing everything recorded for it. Each entry's box gives what happened, the figures as its sources give them, accountability, and its sources. Coloured as the map colours them: rose for coercion, teal for incentives, lavender for advertising, blue for influence abroad. A compiled list, not every case." },

''' % ('"' + ROW_NAME + '"')

REG_ENTRY = '''  {
   "id": "reproduction_capture",
   "name": "%s",
   "unit": "entries",
   "colour": "#5D80C2",
   "note": "The owner's Reproduction capture map (maps repo), from the On-Planet Invasion page's section of that name.",
   "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/reproduction_capture.html"
  },
''' % ROW_NAME

TESTS = r'''console.log("\nround 214r (16 October): reproduction capture under Pre-birth frontlines");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  const pre = at("Pre-birth frontlines"), h = at("Reproduction capture"), gen = at("Genetic engineering"), post = at("Invasion of the living");
  const r = order.indexOf("reproduction_capture");
  check("Reproduction capture is a heading under Pre-birth frontlines, before Genetic engineering, holding its row", pre >= 0 && pre < h && h < r && r < gen && gen < post);
  check("the row appears once in the layers box", order.filter((x) => x === "reproduction_capture").length === 1);
  const reg = JSON.parse(fs.readFileSync(path.join(HERE, "..", "pipeline", "sitemaps", "registry.json"), "utf8")).maps;
  const m = reg.find((x) => x.id === "reproduction_capture");
  check("the registry reads it from the owner's maps repo with the generic reader", !!m && m.url === "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/reproduction_capture.html" && !m.rich);
  check("its row is a site-map row reading the tiles copy, in the map's own colours",
    /\{ id: "reproduction_capture", name: "Reproduction capture worldwide[^"]+\(compiled from [^"]+\)", [^\n]*route: "sitemap"/.test(src) &&
    /sitemaps\/reproduction_capture\.places\.geojson",\n\s*keepColour: true,/.test(src));
  const nm = (src.match(/\{ id: "reproduction_capture", name: "([^"]+)"/) || [])[1] || "";
  check("its title has no code names, underscores or colons", !!nm && !/[_:]/.test(nm));
  check("it links to the map in the maps repo, is marked as read each day, and is filed as a human, upstream layer",
    /\n  reproduction_capture: "https:\/\/github\.com\/WelcomeToYourGalaxy\/maps\/blob\/main\/reproduction_capture\.html",/.test(src) &&
    /\n  reproduction_capture: "Read each day from the owner's map in the maps repo",/.test(src) &&
    /\n  reproduction_capture: \["human", "upstream"\],/.test(src) && /\n  reproduction_capture: "Reproduction capture \(compiled\)",/.test(src));
}

'''

EDITS = [
    # (file, anchor that must appear exactly once, text, before|after)
    ("app", "    // ---- round 116b (asked 29 September): gangs inside law enforcement, worldwide ----\n", ROW, "before"),
    ("app", '  holiday_culprits: "Who corporatized holidays (compiled)",\n',
     '  reproduction_capture: "Reproduction capture (compiled)",\n', "after"),
    ("app", '  holiday_culprits: ["human", "upstream"], medical_culprits: ["human", "upstream"],',
     '  reproduction_capture: ["human", "upstream"],\n', "before"),
    ("app", '  holiday_culprits: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/holiday_culprits.html",\n',
     '  reproduction_capture: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/reproduction_capture.html",\n', "after"),
    ("app", '  holiday_culprits: "Read each day from the owner\'s map in the maps repo",',
     '  reproduction_capture: "Read each day from the owner\'s map in the maps repo",\n', "before"),
    ("app", '  { h: 3, t: "Genetic engineering" }, "gmo_env",',
     '  // Round 214r (asked 15 October): the On-Planet Invasion page\'s order,\n'
     '  // (i) reproduction capture, then (ii) engineering.\n'
     '  { h: 3, t: "Reproduction capture" }, "reproduction_capture",\n', "before"),
    ("test", 'console.log("\\nOur World in Data shading; the genetic engineering map moved");\n', TESTS, "before"),
    ("reg", '  {\n   "id": "site_ufo_pre1900",\n', REG_ENTRY, "before"),
]

texts = {"app": app, "test": test, "reg": reg}
for name, anchor, text, where in EDITS:
    s = texts[name]
    n = s.count(anchor)
    if n != 1:
        sys.exit(f"round214r: expected one place in {name} starting {anchor.strip()[:70]!r}, found {n}. Nothing was changed.")
    # a line-anchored insert: "before" goes at the start of the anchor's line
    i = s.index(anchor)
    if where == "before":
        i = s.rfind("\n", 0, i) + 1
        s = s[:i] + text + s[i:]
    else:
        j = i + len(anchor)
        s = s[:j] + text + s[j:]
    texts[name] = s

NOTE = '''## Round 214r (16 October)

From a separate chat (the "r" round; the "o" rounds go on in their own chat).
Needs round 213o (guards on its heading). Tiles patch round214r_tiles.py beside
it. Its own file in the maps repo: reproduction_capture.html. No app.js?v= bump.
It inserts by anchors rather than a fixed diff, so it applies before or after
other rounds.

- Owner, 15 October: a global map of the On-Planet Invasion page's
  Reproduction capture section, as its own map in WelcomeToYourGalaxy/maps,
  and a layer under Invasion of the pre-birth (the box's heading is
  "Pre-birth frontlines"). New heading "Reproduction capture" there, before
  Genetic engineering (the page's order: (i) reproduction capture, (ii)
  engineering), with one row, reproduction_capture.
- The map: 197 entries with sources in every box. 53 coercion cases (forced
  or coerced sterilization, forced contraception, forced births, birth quotas
  and fines, Lebensborn, child removal), 40 incentive programmes, 30
  advertising and propaganda campaigns, 74 entries of influence abroad (KFF
  and UNFPA donor funding, the Mexico City Policy's on and off years, USAID
  and Population Council history, Bucharest and Cairo conferences, Budapest
  Demographic Summit, World Congress of Families, FP2030, surrogacy and egg
  markets, fertility companies), 52 lines to the countries an entry's sources
  name, and a box per country (80) listing everything recorded for it.
- Read by the generic site-map reader (registry.json, no "rich" builder): its
  five overlays are the chips under the row; boxes are its own popups.
  keepColour: rose, teal, lavender and blue as the map has them (no green,
  orange or yellow).
- Not yet in: the UN's per-country policy on the level of fertility
  (World Population Policies, 2019 data). Its only sources are an Excel file
  and a PDF annex on un.org, which the sandbox could not read. The map adds a
  sixth overlay, "Government policy on birth levels (UN, 2019)", by itself
  once its rows are filled in (build_map.py reads research/un_policies.json).
- Tests: one block before "Our World in Data shading; the genetic engineering
  map moved" in map/test.mjs (not at the round 110c line the "o" rounds use).

'''
first = handoff.find("\n## Round ")
if first < 0:
    sys.exit("round214r: no round headings in HANDOFF.md. Nothing was changed.")
handoff = handoff[:first + 1] + NOTE + handoff[first + 1:]

APP.write_text(texts["app"], encoding="utf-8")
TEST.write_text(texts["test"], encoding="utf-8")
REG.write_text(texts["reg"], encoding="utf-8")
HANDOFF.write_text(handoff, encoding="utf-8")
print("round214r: applied (map/app.js, map/test.mjs, pipeline/sitemaps/registry.json, HANDOFF.md).")
