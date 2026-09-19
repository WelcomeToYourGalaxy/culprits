#!/usr/bin/env python3
"""
ACGF goes under Destruction > Agriculture, where it sits on the Destruction page
(after China Grain Storage). Move it later if it belongs elsewhere.

Run from the repo root:  python3 patch_acgf.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if '{ h: 3, t: "Agriculture" }, "acgf",' in app:
    sys.exit("Already applied - nothing to do.")
old = '{ h: 3, t: "Agriculture" },'
if app.count(old) != 1:
    sys.exit("Could not find the Agriculture heading in map/app.js. Nothing was written.")
app = app.replace(old, old + ' "acgf",')
TESTS = r'''
console.log("\nACGF placed");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("ACGF sits under Agriculture", /\{ h: 3, t: "Agriculture" \}, "acgf",/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Done. Test with: node map/test.mjs")
