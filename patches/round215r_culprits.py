#!/usr/bin/env python3
"""Round 215r (16 October 2026): the UN's 2019 country answers added to the
Reproduction capture row (round 214r).

From the separate "r" chat. It only changes the reproduction_capture row's
note and adds a HANDOFF note and one test block, each found by a line that
appears once, so it applies before or after other chats' rounds. Needs round
214r. Stops cleanly, changing nothing, if already applied or if a place it
looks for is missing.

Upload to WelcomeToYourGalaxy/culprits, folder patches/.
"""
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
ROOT = here.parent if here.name == "patches" else (here.parent.parent if here.name == "failed" else pathlib.Path.cwd())
APP, TEST, HANDOFF = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs", ROOT / "HANDOFF.md"
for f in (APP, TEST, HANDOFF):
    if not f.exists():
        sys.exit(f"round215r: {f} not found. Run this from the culprits folder.")
app, test, handoff = (f.read_text(encoding="utf-8") for f in (APP, TEST, HANDOFF))

if "## Round 215r" in handoff:
    print("round215r: already applied; nothing to do.")
    sys.exit(0)
if "## Round 214r" not in handoff or 'id: "reproduction_capture"' not in app:
    sys.exit("round215r: needs round 214r first. Nothing was changed.")

OLD = "with a line to each country an entry is aimed at where its sources name one, and a box for each country listing everything recorded for it."
NEW = (OLD + " With them, every government's answers to the UN's 2018\\u20132019 questionnaire on fertility, family planning, "
       "reproductive health and abortion (World Population Policies 2019, UN DESA Population Division, CC BY 3.0 IGO): all 197 countries "
       "in the UN's table, 107 of which answered, each shaded by the policy it stated on the present level of fertility (raise, lower, "
       "maintain, no official policy) and each box giving all 161 answers and the UN's notes as the table gives them. The map itself "
       "can shade by any of the 161 questions; this row shows the first.")

TESTS = r'''console.log("\nround 215r (16 October): the UN's 2019 answers in the Reproduction capture row");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const row = (src.match(/\{ id: "reproduction_capture",[\s\S]*?note: "([^"]*)" \}/) || [])[1] || "";
  check("the row's note names the UN's 2019 questionnaire, its licence and its 107 answering governments",
    /World Population Policies 2019/.test(row) && /CC BY 3\.0 IGO/.test(row) && /107 of which answered/.test(row) && /all 161 answers/.test(row));
}

'''

if app.count(OLD) != 1:
    sys.exit("round215r: the reproduction_capture note is not as round 214r left it. Nothing was changed.")
app = app.replace(OLD, NEW)
anchor = 'console.log("\\nround 214r (16 October): reproduction capture under Pre-birth frontlines");\n'
if test.count(anchor) != 1:
    sys.exit("round215r: round 214r's test block not found in map/test.mjs. Nothing was changed.")
test = test.replace(anchor, TESTS + anchor)

NOTE = '''## Round 215r (16 October)

From the separate "r" chat. Needs round 214r. Tiles patch round215r_tiles.py
beside it, and a new reproduction_capture.html for the maps repo. No
app.js?v= bump.

- Owner, 16 October: added the UN's country file they downloaded
  (desa_pd_2019_fertility_family_planning_reproductive_health_country_data.xlsx,
  World Population Policies 2019, CC BY 3.0 IGO). Its Table 1 holds every
  question of Tables 2 to 6: 161 answer columns plus footnote columns, for
  197 countries. 107 governments answered (the UN's page for the data says
  107 responses to this module of its Twelfth Inquiry, 2018-2019); the other
  90 rows are all "—" in the table and are drawn as "no answer".
- The map gains a sixth overlay, "What each government told the UN about
  births, family planning and abortion (2019)": every country, shaded by
  question 2.1 (policy on the present level of fertility: Raise 23, Lower
  35, Maintain at Current Levels 7, No Official Policy 38, ".." 4, no answer
  90). The standalone map can shade by any of the 161 questions; the Culprits
  row (generic site-map reader) carries the 2.1 shading. Each box gives all
  161 answers by section with the UN's notes; ".." is shown as the table
  gives it (the table does not define it).
- Country shapes are now drawn with L.polygon and their colours set when
  made, so extract.mjs keeps each country's colour (through L.geoJSON the
  colours were lost and every country took the row colour).
- Only the row's note changes here.

'''
first = handoff.find("\n## Round ")
handoff = handoff[:first + 1] + NOTE + handoff[first + 1:]
APP.write_text(app, encoding="utf-8"); TEST.write_text(test, encoding="utf-8"); HANDOFF.write_text(handoff, encoding="utf-8")
print("round215r: applied (map/app.js, map/test.mjs, HANDOFF.md).")
