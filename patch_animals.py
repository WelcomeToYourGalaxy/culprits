#!/usr/bin/env python3
"""
The two Suppression-page Google My Maps maps (zoos and the pet industry) go under
Suppression > Of animals; the Leverage Chart row comes out of the layers box.

Run from the repo root:  python3 patch_animals.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if '"final_nail", "mymaps_supp_a", "mymaps_supp_b",' in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


once('"site_animal_racing", "site_rodeo", "final_nail",', '"site_animal_racing", "site_rodeo", "final_nail", "mymaps_supp_a", "mymaps_supp_b",')
once("const PANEL_REMOVED = new Set([\n", 'const PANEL_REMOVED = new Set([\n  "leverage_chart",\n')
once('  mymaps_supp_a: ["human", "upstream"],\n  mymaps_supp_b: ["human", "upstream"],\n', '  mymaps_supp_a: ["animal", "downstream"],\n  mymaps_supp_b: ["animal", "downstream"],\n')

TESTS = r'''
console.log("\nzoos and pet industry placed");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const animals = o.PANEL_ORDER.findIndex((x) => x && x.t === "Of animals");
  check("both My Maps maps sit under Of animals", o.PANEL_ORDER.indexOf("mymaps_supp_a") > animals && o.PANEL_ORDER.indexOf("mymaps_supp_b") > animals);
  check("the Leverage Chart is out of the box", o.PANEL_REMOVED.has("leverage_chart"));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
test = test.replace(anchor_t, TESTS + anchor_t) if test.count(anchor_t) == 1 else sys.exit("Could not find the end of map/test.mjs.")
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Done. Test with: node map/test.mjs")
