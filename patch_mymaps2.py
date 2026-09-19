#!/usr/bin/env python3
"""
The two Google My Maps maps on the Suppression page, read live from their own
files like the other two: each row takes its map's own title once it loads, its
folders become chips, and places given only as an address are placed from the
weekly OpenStreetMap lookup (their boxes say so). They start under "Not yet
placed" until their titles show where they belong.

Run from the repo root:  python3 patch_mymaps2.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if 'id: "mymaps_supp_a"' in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


ROWS = ""
for i, mid in (("mymaps_supp_a", "1vrnqSW4cWWdnjz6cJ-qFMmd0zbJzYd6V"), ("mymaps_supp_b", "1seBCggQGg1tcRYpqpZ5ZKJaxHs4")):
    ROWS += f'''    {{ id: "{i}", name: "Google My Maps map (Suppression page)", unit: "placemarks", colour: "#6A5E66", route: "kml", ready: true, lazy: true,
      kml: "https://www.google.com/maps/d/kml?mid={mid}&forcekml=1",
      note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." }},
'''
once('''    { id: "wreckers_umap",''', ROWS + '''    { id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  mymaps_supp_a: ["human", "upstream"],\n  mymaps_supp_b: ["human", "upstream"],\n')

TESTS = r'''
console.log("\nthe Suppression page's two Google My Maps maps");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("both are rows, read live from their own files", /mid=1vrnqSW4cWWdnjz6cJ-qFMmd0zbJzYd6V&forcekml=1/.test(src) && /mid=1seBCggQGg1tcRYpqpZ5ZKJaxHs4&forcekml=1/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Two My Maps maps added. Test with: node map/test.mjs")
