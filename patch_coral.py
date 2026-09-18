#!/usr/bin/env python3
"""
Coral reefs: make the row say what is happening, and ask for the right squares.

1. MapLibre treats every vector square as 512 pixels wide, so at map zoom 12 it
   asks for zoom-11 squares, which the layer refused (it only allowed 12 and up).
   The Atlas's squares are now asked from one level lower, so reefs start to
   draw at zoom 12 as the row says.
2. The row's line no longer sticks on "zoom in to 12". Zoomed in with the row
   unticked it says to tick it; if reading the squares fails, it says so and the
   console names the error, instead of the line silently keeping its old text.

Run from the repo root:  python3 patch_coral.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP = ROOT / "map" / "app.js"
app = APP.read_text(encoding="utf-8")
if "the Atlas's squares are asked from one level lower" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


once("""    // not a picture of a fixed size, so the Atlas's grid is read correctly.
    minzoom: cfg.drawFrom, maxzoom: 16,""",
"""    // not a picture of a fixed size, so the Atlas's grid is read correctly.
    // MapLibre counts a vector square as 512 pixels, so at map zoom 12 it asks
    // for zoom-11 squares: the Atlas's squares are asked from one level lower,
    // or nothing would draw until zoom 13.
    minzoom: cfg.drawFrom - 1, maxzoom: 16,""")

once("""    if ((visibility.get(cfg.id) || "visible") !== "visible") return;
    const failed = coralFailures.get(cfg.id) || 0;
    const loaded = typeof map.querySourceFeatures === "function"
      ? map.querySourceFeatures(`${cfg.id}-tiles`, { sourceLayer: cfg.sourceLayer }).length : 0;
    const loading = typeof map.isSourceLoaded === "function" && !map.isSourceLoaded(`${cfg.id}-tiles`);""",
"""    if ((visibility.get(cfg.id) || "visible") !== "visible") {
      setLayerState(cfg.id, "tick this row to draw the reefs here");
      return;
    }
    const failed = coralFailures.get(cfg.id) || 0;
    let loaded = 0, loading = false;
    try {
      loaded = typeof map.querySourceFeatures === "function"
        ? map.querySourceFeatures(`${cfg.id}-tiles`, { sourceLayer: cfg.sourceLayer }).length : 0;
      loading = typeof map.isSourceLoaded === "function" && !map.isSourceLoaded(`${cfg.id}-tiles`);
    } catch (e) {
      console.warn(`[culprits] ${cfg.id}: ${e.message}`);
      setLayerState(cfg.id, `could not read the Atlas's squares (${e.message})`);
      return;
    }""")

TEST = ROOT / "map" / "test.mjs"
test = TEST.read_text(encoding="utf-8")
old_t = '  check("shapes draw from zoom 12", fill && fill.minzoom === 12 && s2.minzoom === 12);'
new_t = ('  check("shapes draw from zoom 12", fill && fill.minzoom === 12);\n'
         '  check("…from squares asked one level lower, as MapLibre reads vector squares at 512 pixels", s2.minzoom === 11);')
if test.count(old_t) != 1:
    sys.exit("Could not find the coral zoom test in map/test.mjs. Nothing was written.")
test = test.replace(old_t, new_t)
EXTRA = r'''
console.log("\ncoral, the row's line");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("an unticked row says to tick it rather than keeping old text", /tick this row to draw the reefs here/.test(src));
  check("a failure reading the squares is said on the row and in the console",
        /could not read the Atlas's squares/.test(src) && src.includes("console.warn(`[culprits] ${cfg.id}: ${e.message}`)"));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, EXTRA + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Coral fixed. Test with: node map/test.mjs")
