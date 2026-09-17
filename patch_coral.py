#!/usr/bin/env python3
"""
Fixes the coral reef layer.

MapLibre refuses a vector tile source with any tile size but 512 — addSource
throws "vector tile sources must have a tileSize of 512" — and the coral source
declared 256. The layer was never added at all. The Atlas's tiles were fine
throughout: measured 16 September, tile 13/7412/4472 off Cairns answered in
2.6 s with 280 KB and the layer named benthic_data_verbose.

Also adds a test so no vector source can declare another size again; the test
stub accepted 256 silently, which is how this passed.

Run from the repo root:  python3 patch_coral.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")

old = """    // Web Mercator tiles of 256 pixels, as the Atlas's EPSG:900913 grid serves.
    tileSize: 256,
"""
new = """    // No tileSize: MapLibre only accepts 512 for vector tiles and throws on
    // anything else, which silently left this layer unbuilt. A vector tile is
    // not a picture of a fixed size, so the Atlas's grid is read correctly.
"""
if new in app:
    sys.exit("app.js already has the coral fix — nothing to do.")
if app.count(old) != 1:
    sys.exit("Could not find the coral tile size in map/app.js. Nothing was written.")
app = app.replace(old, new)

anchor = 'console.log("\\ncoral, live");'
if test.count(anchor) != 1:
    sys.exit("Could not find the coral tests in map/test.mjs. Nothing was written.")
test = test.replace(anchor, anchor + """
{
  // MapLibre throws on a vector source whose tileSize is not 512.
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const bad = [...src.matchAll(/type:\\s*"vector"[\\s\\S]{0,400}?tileSize:\\s*(\\d+)/g)].filter((m) => m[1] !== "512");
  check("no vector source declares a tile size MapLibre refuses", bad.length === 0, bad.map((m) => m[0].slice(0, 80)).join(" | "));
}""")

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Coral fixed in map/app.js; test added to map/test.mjs.")
