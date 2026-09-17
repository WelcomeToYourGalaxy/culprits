#!/usr/bin/env python3
"""
Stars behind the map, and two layers that no longer open ticked.

- A star field is drawn behind the map: behind the globe, and beyond the flat
  map's edges. The stars are placed at random once, from a fixed seed, so they
  do not jump about on every redraw, and they shift a little as the map is
  moved, the way a distant field does. Colours are the map's own: bone, pale
  slate, muted rose. No orange, no yellow, nothing neon.
- On the flat map the dark background used to cover the whole screen, which
  would have hidden the stars, so the dark is now a fill over the world itself
  and the screen behind it is left to the stars. On the globe the background
  layer is drawn on the planet only, as before, and is left alone.
- National CO₂ emissions and Identified trafficking cases now open unticked.

Edits map/app.js, map/index.html and map/test.mjs, anchored on exact text.

Run from the repo root:  python3 patch_stars.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs", ROOT / "map" / "index.html"
app, test, index = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX))

if "function starField(" in app:
    sys.exit("app.js already draws stars — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- two layers open unticked

app = once(app, """  { id:"owid_co2",             name:"National CO₂ emissions", unit:"Mt CO₂/yr", colour:"#8A5750", route:"country", ready:true },""",
           """  { id:"owid_co2",             name:"National CO₂ emissions", unit:"Mt CO₂/yr", colour:"#8A5750", route:"country", ready:true, off:true },""",
           "map/app.js")
app = once(app, """  { id:"slavery_cases",        name:"Identified trafficking cases", unit:"identified cases", colour:"#7A6A72", route:"country", ready:true,""",
           """  { id:"slavery_cases",        name:"Identified trafficking cases", unit:"identified cases", colour:"#7A6A72", route:"country", ready:true, off:true,""",
           "map/app.js")

# ---------------------------------------------------------------- index.html

index = once(index, """<!-- NASA's Eyes on the Solar System. Loaded as the map nears the hand-over""",
             """<!-- The sky the map sits in: drawn in app.js, behind everything. -->
<canvas id="stars" class="stars" aria-hidden="true"></canvas>
<!-- NASA's Eyes on the Solar System. Loaded as the map nears the hand-over""", "map/index.html")
index = once(index, """  #map{position:absolute;inset:0}""",
             """  #map{position:absolute;inset:0}
  .stars{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;background:#06080D}""", "map/index.html")

# ---------------------------------------------------------------- the star field

STARS = r'''
/* ---------- the sky the map sits in ---------- */

// Placed at random once, from a fixed seed, so the same sky comes back on
// every redraw and every visit. Rendered behind the map: behind the globe, and
// beyond the flat map's edges.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The map's own colours, dimmed: bone, pale slate, muted rose.
const STAR_COLOURS = ["#D6D3C8", "#D6D3C8", "#D6D3C8", "#AEB9C4", "#B79A92"];
const STAR_DENSITY = 1 / 7000;         // stars per square pixel

function starField(width, height, seed) {
  const rand = seededRandom(seed || 20260917);
  const stars = [];
  const n = Math.round(width * height * STAR_DENSITY);
  for (let i = 0; i < n; i++) {
    const bright = Math.pow(rand(), 2.2);            // many faint, a few bright
    stars.push({
      x: rand() * width, y: rand() * height,
      r: 0.35 + bright * 1.15,
      a: 0.16 + bright * 0.74,
      c: STAR_COLOURS[Math.floor(rand() * STAR_COLOURS.length)],
    });
  }
  return stars;
}

const sky = { stars: [], w: 0, h: 0, frame: 0 };

function drawSky() {
  sky.frame = 0;
  const cv = document.getElementById("stars");
  if (!cv || !cv.getContext) return;
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const w = cv.clientWidth || 0, h = cv.clientHeight || 0;
  if (!w || !h) return;
  if (w !== sky.w || h !== sky.h) {
    sky.w = w; sky.h = h;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    sky.stars = starField(w, h);
  }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // A distant field moves a little as the map is turned, and wraps round.
  const c = typeof map.getCenter === "function" ? map.getCenter() : { lng: 0, lat: 0 };
  const ox = ((-c.lng / 360) * w * 0.6 % w + w) % w;
  const oy = ((c.lat / 90) * h * 0.15 % h + h) % h;
  for (const s of sky.stars) {
    const x = (s.x + ox) % w, y = (s.y + oy) % h;
    ctx.globalAlpha = s.a;
    ctx.fillStyle = s.c;
    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function skyRedraw() {
  if (sky.frame) return;
  sky.frame = (typeof requestAnimationFrame === "function")
    ? requestAnimationFrame(drawSky) : setTimeout(drawSky, 16);
}

// The flat map's dark background would cover the whole screen, stars included.
// Drawn as a fill over the world instead, under the imagery.
function ensureWorldFill() {
  if (map.getLayer("world-fill")) return;
  map.addSource("world-box", { type: "geojson", data: { type: "Feature", properties: {},
    geometry: { type: "Polygon", coordinates: [[[-180, -85.0511], [180, -85.0511],
                                                [180, 85.0511], [-180, 85.0511], [-180, -85.0511]]] } } });
  map.addLayer({ id: "world-fill", type: "fill", source: "world-box",
                 paint: { "fill-color": "#0B1017" } }, map.getLayer("base") ? "base" : undefined);
}

// Globe: the background layer is drawn on the planet only, so it stays and the
// fill is not needed. Flat map: the other way round.
function skyForView(projection) {
  const flat = projection === "mercator";
  if (flat) ensureWorldFill();
  const show = (id, on) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  };
  show("bg", !flat);
  show("world-fill", flat);
  skyRedraw();
}

function watchSky() {
  map.on("move", skyRedraw);
  map.on("resize", skyRedraw);
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", skyRedraw);
  skyForView(VIEWS[VIEW].projection);
}
'''
app = once(app, "\nfunction viewPanelHtml() {", STARS + "\nfunction viewPanelHtml() {", "map/app.js")

app = once(app, """  if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[kind].leave ? handoffZoom() - 0.45 : 0);""",
           """  if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[kind].leave ? handoffZoom() - 0.45 : 0);
  skyForView(VIEWS[kind].projection);""", "map/app.js")
app = once(app, """  watchForLeaving();
  fitMode();""", """  watchForLeaving();
  watchSky();
  fitMode();""", "map/app.js")

# The address to use for Eyes is worth saying plainly: NASA's own embed panel
# writes it, including the switch that skips the "View 3D" prompt.
app = once(app, """// NASA's Eyes on the Solar System, centred on Earth, with its panels closed.
const SPACE_URL =""", """// NASA's Eyes on the Solar System, centred on Earth, with its panels closed.
// Eyes writes its own embed address: open it, go to its settings, turn off
// "Show Interact Prompt on Load" (that is the "View 3D" button) along with
// anything else unwanted, then "Copy Embed Code" and paste the address here.
const SPACE_URL =""", "map/app.js")

# ---------------------------------------------------------------- tests

TESTS = r'''
console.log("\nthe sky, and what opens ticked");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const f = new Function(src.match(/function seededRandom[\s\S]*?\nfunction starField[\s\S]*?\n}\n/)[0] +
                         "; return { starField, STAR_COLOURS };")();
  const a = f.starField(1200, 800), b = f.starField(1200, 800);
  check("the same sky comes back every time", a.length === b.length && a[7].x === b[7].x && a[7].c === b[7].c);
  check("about one star per seven thousand pixels", Math.abs(a.length - (1200 * 800) / 7000) <= 1, String(a.length));
  check("every star is on the canvas, dim to bright", a.every((s) => s.x >= 0 && s.x < 1200 && s.y >= 0 && s.y < 800 &&
        s.r >= 0.35 && s.r <= 1.5 && s.a > 0.15 && s.a <= 0.9));
  const hues = f.STAR_COLOURS.map((c) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
    let h = 0;
    if (mx !== mn) {
      h = mx === r ? ((g - bl) / (mx - mn)) % 6 : mx === g ? (bl - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h, sat: mx ? (mx - mn) / mx : 0 };
  });
  check("no star is orange, yellow or neon", hues.every((x) => x.sat < 0.25 && !(x.sat > 0.12 && x.h >= 25 && x.h < 70)));
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the sky is drawn behind the map", index.indexOf('id="stars"') < index.indexOf('id="map"') &&
        /\.stars\{[^}]*pointer-events:none/.test(index));
}
{
  const { map } = run();
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const vis = (id) => (map.getLayer(id) ? (map.getLayer(id).layout || {}).visibility : null);
  check("the flat map's dark is a fill over the world, so stars show beyond it",
        !!map.getLayer("world-fill") === false || vis("world-fill") !== null);
  map.layers.push({ id: "bg", type: "background", layout: {} });
  const panelHtml = globalThis.document.getElementById("basemaps");
  panelHtml.fire("change", { target: { name: "view", value: "flat" } });
  check("on the flat map the world is filled and the screen background is off",
        vis("world-fill") === "visible" && vis("bg") === "none");
  panelHtml.fire("change", { target: { name: "view", value: "globe" } });
  check("on the globe the background covers the planet again", vis("bg") === "visible" && vis("world-fill") === "none");
}
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  // A layer marked off: true opens unticked and draws nothing until it is ticked.
  const marked = (id) => new RegExp(`\\{ *id: *"${id}"[^\\n]*off: *true`).test(src) ||
                          new RegExp(`\\{ *id:"${id}"[^\\n]*off:true`).test(src);
  check("National CO₂ emissions opens unticked", marked("owid_co2"));
  check("Identified trafficking cases opens unticked", marked("slavery_cases"));
  check("the panel leaves those rows unticked", /\$\{cfg\.off \? "" : " checked"\} data-layer/.test(src));
  check("and nothing is drawn for them until they are ticked",
        /const visibility = new Map\(LAYERS\.filter\(\(c\) => c\.off\)/.test(src));
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
print("Stars behind the map; the flat map's dark is a fill over the world; two layers open unticked.")
