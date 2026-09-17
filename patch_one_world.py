#!/usr/bin/env python3
"""
One world, not a row of them.

- The map no longer repeats east and west of itself (renderWorldCopies: false).
- The atlas's colour washes are drawn only over that one world. They are a
  full-screen pass, so with the copies gone they would otherwise tint the empty
  space beside it.
- A test for each.

The plate image itself (its misted southern edge) is a separate file in the
same download: map/atlas-plate.webp, made by pipeline/plate/south_mist.py.

Run from the repo root:  python3 patch_one_world.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")

if "renderWorldCopies: false" in app:
    sys.exit("app.js already shows one world — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


app = once(app, """const map = new maplibregl.Map({
  container: "map",
  center: [12, 24],""", """const map = new maplibregl.Map({
  container: "map",
  // One world. Repeated copies east and west read as more planet than there is.
  renderWorldCopies: false,
  center: [12, 24],""", "map/app.js")

app = once(app, """function hexRgb(h) {""", """// The screen rectangle the one world covers, in the GL canvas's own pixels,
// bottom-left origin, clamped to the canvas: [x, y, width, height]. The washes
// are a full-screen pass and are cut to this, so the empty space beside the
// world is not tinted.
const WORLD_EDGE_LAT = 85.0511287798066;
function worldScissor(m, canvas) {
  const scale = canvas.width / (canvas.clientWidth || canvas.width);
  const pts = [[-180, WORLD_EDGE_LAT], [180, WORLD_EDGE_LAT], [180, -WORLD_EDGE_LAT], [-180, -WORLD_EDGE_LAT]]
    .map((c) => m.project(c));
  const xs = pts.map((p) => p.x * scale), ys = pts.map((p) => p.y * scale);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(canvas.width, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(canvas.height, Math.ceil(Math.max(...ys)));
  return [x0, canvas.height - y1, Math.max(0, x1 - x0), Math.max(0, y1 - y0)];
}
function hexRgb(h) {""", "map/app.js")

app = once(app, """    for (const pass of atlasWashPasses(this.map.getZoom())) {
      const [src, dst] = func[pass.mode];
      gl.blendFuncSeparate(src, dst, gl.ZERO, gl.ONE);
      gl.uniform3f(this.uCol, pass.rgb[0], pass.rgb[1], pass.rgb[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  },""", """    const [sx, sy, sw, sh] = worldScissor(this.map, this.map.getCanvas());
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(sx, sy, sw, sh);
    for (const pass of atlasWashPasses(this.map.getZoom())) {
      const [src, dst] = func[pass.mode];
      gl.blendFuncSeparate(src, dst, gl.ZERO, gl.ONE);
      gl.uniform3f(this.uCol, pass.rgb[0], pass.rgb[1], pass.rgb[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.SCISSOR_TEST);
  },""", "map/app.js")

TESTS = r'''
console.log("\none world");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const opts = src.slice(src.indexOf("const map = new maplibregl.Map({"), src.indexOf("style: {", src.indexOf("const map = new maplibregl.Map({")));
  check("the world is not repeated east and west", /renderWorldCopies:\s*false/.test(opts));
  const fn = new Function(src.match(/const WORLD_EDGE_LAT[\s\S]*?\nfunction worldScissor[\s\S]*?\n}\n/)[0] + "; return worldScissor;")();
  // A 1000 × 500 CSS-pixel map drawn at 2× where the world spans x 200..800, y 0..500 and beyond.
  const m = { project: ([lng, lat]) => ({ x: 500 + lng * (300 / 180), y: 250 - lat * (400 / 85.0511287798066) }) };
  const canvas = { width: 2000, height: 1000, clientWidth: 1000 };
  const [x, y, w, h] = fn(m, canvas);
  check("the washes are cut to the world's width, in device pixels", x === 400 && w === 1200, JSON.stringify([x, y, w, h]));
  check("…and to the canvas where the world runs off it", y === 0 && h === 1000, JSON.stringify([x, y, w, h]));
  check("the wash pass turns the cut on and off again", /gl\.enable\(gl\.SCISSOR_TEST\)[\s\S]{0,400}gl\.disable\(gl\.SCISSOR_TEST\)/.test(src));
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("One world: copies off, washes cut to the world; tests added.")
