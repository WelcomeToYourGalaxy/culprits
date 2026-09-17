#!/usr/bin/env python3
"""
Coming back from Eyes, the size of the hand-over, panning out into space.

- Size: Eyes' Earth is as big as this globe at zoom 2, not at 0.7. The fit is
  now written that way — EYES_FIT.zoom, the zoom whose globe matches Earth in
  Eyes — so the hand-over happens at that size, and the drop out of the map is
  a short one rather than a long zoom out.
- Coming back: the return now mirrors the way out. The map fades in at the size
  Earth had in Eyes and zooms back to the view you left. Scrolling in over the
  edge of the screen, or double-clicking there, brings it back, as well as the
  bar at the top. The middle of the screen belongs to Eyes and this page cannot
  read a wheel there: a frame from another site keeps its own events, which is
  why the way back is the screen's edge and the bar.
- The flat map can be dragged past its own edges now, into the stars, instead
  of being held so that it always fills the window. It can also be zoomed out
  further, until the whole chart sits in space.
- The layer panel rolls up and down from a caret beside its title, as well as
  being pulled by its grip.
- The news wires box opens to the top of the map, as the layer panel does; it
  stopped at just over half the window.

Edits map/app.js, map/index.html, map/wire.js and map/test.mjs, anchored on
exact text. The plate in the same download carries the fix for the tip of
South America.

Run from the repo root:  python3 patch_pan.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX, WIRE = (ROOT / "map" / n for n in ("app.js", "test.mjs", "index.html", "wire.js"))
app, test, index, wire = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX, WIRE))

if "function freeConstrain(" in app:
    sys.exit("app.js already has this — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- the fit, written as a zoom

app = once(app, """// How Earth sits in Eyes, measured by eye once (open the map with #fit at the
// end of the address; see fitMode below). radius is Earth's drawn radius as a
// share of the window's height. lon and lat are the point facing the camera at
// the moment given by at. rate is how fast that point moves: "stars" if Eyes
// holds its camera against the stars (a sidereal day), "sun" if it holds it
// against the Sun (a solar day). If the globe and Earth line up when you
// calibrate but have drifted apart a day later, switch rate.
const EYES_FIT = { radius: 0.24, lon: 0, lat: 0, at: "2026-09-17T00:00:00Z", rate: "stars" };""",
"""// How Earth sits in Eyes, measured by eye once (open the map with #fit at the
// end of the address; see fitMode below). zoom is the map zoom whose globe is
// the same size as Earth in Eyes — measured at 2. lon and lat are the point
// facing the camera at the moment given by at. rate is how fast that point
// moves: "stars" if Eyes holds its camera against the stars (a sidereal day),
// "sun" if it holds it against the Sun (a solar day). If the globe and Earth
// line up when you calibrate but have drifted apart a day later, switch rate.
const EYES_FIT = { zoom: 2, lon: 0, lat: 0, at: "2026-09-17T00:00:00Z", rate: "stars" };""", "map/app.js")

app = once(app, """// The zoom at which the globe is exactly as big as Earth is in Eyes.
function handoffZoom() {
  const want = EYES_FIT.radius * (map.getCanvas().clientHeight || 800);
  let lo = -4, hi = 6;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (globeRadiusPx(mid, EYES_FIT.lat) < want) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}""", """// The zoom at which the globe is exactly as big as Earth is in Eyes.
function handoffZoom() { return EYES_FIT.zoom; }""", "map/app.js")

# The drop out of the map is short now, so the wheel has only a little room
# below the hand-over size before it is crossed.
app = once(app, """  const edge = () => handoffZoom() - 0.45;""", """  const edge = () => handoffZoom() - 0.15;""", "map/app.js")
app = once(app, """  if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[kind].leave ? handoffZoom() - 0.45 : 0);""",
           """  if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[kind].leave ? handoffZoom() - 0.15 : -1);
  // The flat map is free of its own edges: drag it out into the stars.
  if (typeof map.setTransformConstrain === "function") {
    map.setTransformConstrain(VIEWS[kind].projection === "mercator" ? freeConstrain : null);
  }""", "map/app.js")

app = once(app, """  const setEdge = () => { if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[VIEW].leave ? edge() : 0); };""",
           """  const setEdge = () => { if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[VIEW].leave ? edge() : -1); };""",
           "map/app.js")

# ---------------------------------------------------------------- panning out into space

app = once(app, """function spaceFrame() { return document.getElementById("space"); }""",
"""// MapLibre holds the flat map so that it always fills the window, which is why
// the drag stopped at the map's edges once the repeated copies were turned
// off. This hands the camera back whatever it was given, so the chart can be
// dragged and zoomed out into the stars around it.
function freeConstrain(lngLat, zoom) {
  const lat = Math.max(-89.9, Math.min(89.9, lngLat.lat));
  const lng = Math.max(-540, Math.min(540, lngLat.lng));
  return { center: new maplibregl.LngLat(lng, lat), zoom: zoom == null ? 0 : zoom };
}

function spaceFrame() { return document.getElementById("space"); }""", "map/app.js")

# ---------------------------------------------------------------- leaving and coming back

app = once(app, """function leaveEarth() {
  if (AWAY || leaving || !VIEWS[VIEW].leave) return;
  leaving = true;""", """let leftFrom = null;          // the view the map was at when Eyes took over

function leaveEarth() {
  if (AWAY || leaving || !VIEWS[VIEW].leave) return;
  leaving = true;
  leftFrom = { center: map.getCenter(), zoom: Math.max(map.getZoom(), handoffZoom() + 0.6) };""", "map/app.js")

app = once(app, """    const bar = document.getElementById("spaceBar");
    if (bar) bar.hidden = false;
    const el = document.getElementById("map");
    if (el && el.classList) el.classList.add("away");
    panelsAway(true);""", """    const bar = document.getElementById("spaceBar");
    if (bar) bar.hidden = false;
    const edge = document.getElementById("spaceEdge");
    if (edge) edge.hidden = false;
    const el = document.getElementById("map");
    if (el && el.classList) el.classList.add("away");
    panelsAway(true);""", "map/app.js")

app = once(app, """function backToMap() {
  if (!AWAY) return;
  AWAY = false;
  const f = spaceFrame();
  if (f) f.classList.remove("on");
  const bar = document.getElementById("spaceBar");
  if (bar) bar.hidden = true;
  const el = document.getElementById("map");
  if (el && el.classList) el.classList.remove("away");
  panelsAway(false);
  if (typeof map.triggerRepaint === "function") map.triggerRepaint();
}""", """function backToMap() {
  if (!AWAY) return;
  AWAY = false;
  const f = spaceFrame();
  if (f) f.classList.remove("on");
  const bar = document.getElementById("spaceBar");
  if (bar) bar.hidden = true;
  const edge = document.getElementById("spaceEdge");
  if (edge) edge.hidden = true;
  const el = document.getElementById("map");
  if (el && el.classList) el.classList.remove("away");
  panelsAway(false);
  // The way in mirrors the way out: the globe appears at the size Earth had in
  // Eyes, then grows back to the view that was left.
  if (leftFrom && typeof map.easeTo === "function") {
    map.jumpTo({ center: [eyesFacing(Date.now()).lon, EYES_FIT.lat], zoom: handoffZoom(), bearing: 0, pitch: 0 });
    map.easeTo({ center: leftFrom.center, zoom: leftFrom.zoom, duration: 1400 });
  }
  if (typeof map.triggerRepaint === "function") map.triggerRepaint();
}

// The wheel and the clicks in the middle of the screen belong to Eyes, which
// is another site's frame: this page never sees them. The edge of the screen
// is this page's own, so scrolling in there, or double-clicking, comes back.
function watchSpaceEdge() {
  const edge = document.getElementById("spaceEdge");
  if (!edge || !edge.addEventListener) return;
  edge.addEventListener("wheel", (e) => {
    if (AWAY && e.deltaY < 0) { if (e.preventDefault) e.preventDefault(); backToMap(); }
  }, { passive: false });
  edge.addEventListener("dblclick", () => { if (AWAY) backToMap(); });
}""", "map/app.js")

app = once(app, """  const back = document.getElementById("spaceBack");
  if (back) back.addEventListener("click", backToMap);""", """  const back = document.getElementById("spaceBack");
  if (back) back.addEventListener("click", backToMap);
  watchSpaceEdge();
  const roll = document.getElementById("panelRoll");
  if (roll) roll.addEventListener("click", () => {
    const panel = document.querySelector(".panel");
    if (!panel || !panel.classList) return;
    const shut = panel.classList.contains("shut");
    panel.classList.toggle("shut", !shut);
    roll.textContent = shut ? "\\u25BE" : "\\u25B4";
    roll.setAttribute("aria-expanded", shut ? "true" : "false");
  });""", "map/app.js")

# The calibration now moves the zoom rather than a radius.
app = once(app, """  const state = { radius: EYES_FIT.radius, lon: map.getCenter().lng, lat: map.getCenter().lat };
  const draw = () => {
    EYES_FIT.radius = state.radius;
    map.jumpTo({ center: [state.lon, state.lat], zoom: handoffZoom(), bearing: 0, pitch: 0 });
    box.innerHTML = "Line the globe up with Earth behind it. Arrows turn it, + and &#8722; resize it." +
      "<code>const EYES_FIT = { radius: " + state.radius.toFixed(4) + ", lon: " + state.lon.toFixed(2) +
      ", lat: " + state.lat.toFixed(2) + ', at: "' + new Date().toISOString() + '", rate: "stars" };</code>';
  };""", """  const state = { zoom: EYES_FIT.zoom, lon: map.getCenter().lng, lat: map.getCenter().lat };
  const draw = () => {
    EYES_FIT.zoom = state.zoom;
    map.jumpTo({ center: [state.lon, state.lat], zoom: handoffZoom(), bearing: 0, pitch: 0 });
    box.innerHTML = "Line the globe up with Earth behind it. Arrows turn it, + and &#8722; resize it." +
      "<code>const EYES_FIT = { zoom: " + state.zoom.toFixed(3) + ", lon: " + state.lon.toFixed(2) +
      ", lat: " + state.lat.toFixed(2) + ', at: "' + new Date().toISOString() + '", rate: "stars" };</code>';
  };""", "map/app.js")
app = once(app, """    else if (e.key === "+" || e.key === "=") state.radius *= 1.01;
    else if (e.key === "-") state.radius /= 1.01;""",
           """    else if (e.key === "+" || e.key === "=") state.zoom += 0.05;
    else if (e.key === "-") state.zoom -= 0.05;""", "map/app.js")

# ---------------------------------------------------------------- index.html

index = once(index, """<div class="space-bar" id="spaceBar" hidden>""",
             """<!-- The screen's own edge while Eyes has the middle: scroll in here, or
     double-click, to come back to the map. -->
<div class="space-edge" id="spaceEdge" hidden aria-hidden="true">
  <div class="se t"></div><div class="se b"></div><div class="se l"></div><div class="se r"></div>
</div>
<div class="space-bar" id="spaceBar" hidden>""", "map/index.html")

index = once(index, """  .space-bar[hidden]{display:none}""", """  .space-bar[hidden]{display:none}
  .space-edge{position:fixed;inset:0;z-index:59;pointer-events:none}
  .space-edge[hidden]{display:none}
  .space-edge .se{position:absolute;pointer-events:auto}
  .space-edge .t{left:0;right:0;top:0;height:46px}
  .space-edge .b{left:0;right:0;bottom:0;height:34px}
  .space-edge .l{top:0;bottom:0;left:0;width:34px}
  .space-edge .r{top:0;bottom:0;right:0;width:34px}""", "map/index.html")

index = once(index, """<div class="panel">
  <h1>The Culprits</h1>""", """<div class="panel">
  <button class="p-roll" id="panelRoll" title="Roll the panel up or down" aria-expanded="true">&#9662;</button>
  <h1>The Culprits</h1>""", "map/index.html")

index = once(index, """  .panel h1{font-size:17px;font-weight:600;margin:0 0 4px;letter-spacing:-.01em}""",
             """  .panel h1{font-size:17px;font-weight:600;margin:0 0 4px;letter-spacing:-.01em}
  .p-roll{position:absolute;top:12px;right:12px;background:none;border:0;color:var(--dim);
    font-size:13px;line-height:1;cursor:pointer;padding:2px 4px}
  .p-roll:hover{color:var(--bone)}
  .panel.shut{height:auto;max-height:none;overflow:hidden}
  .panel.shut > *{display:none}
  .panel.shut > h1,.panel.shut > .p-roll{display:block}""", "map/index.html")

# ---------------------------------------------------------------- the wires box, up to the top

wire = once(wire, """.wire.open{height:min(54vh,600px,calc(100% - 96px - var(--wire-lift,0px)))}""",
            """.wire.open{height:calc(100vh - 42px - var(--wire-lift,0px))}""", "map/wire.js")

# ---------------------------------------------------------------- tests

TESTS = r'''
console.log("\ncoming back, and room to move");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  const fit = new Function(src.match(/const EYES_FIT[\s\S]*?\n};\n/)[0] +
                           src.match(/function handoffZoom[\s\S]*?\n/)[0] + "; return { EYES_FIT, handoffZoom };")();
  check("the hand-over happens at the size Earth has in Eyes, measured at zoom 2",
        fit.EYES_FIT.zoom === 2 && fit.handoffZoom() === 2);
  check("the drop out of the map is a short one, not a zoom out to nothing",
        /handoffZoom\(\) - 0\.15/.test(src) && !/handoffZoom\(\) - 0\.45/.test(src));
  check("the way back is the screen's edge as well as the bar",
        /id="spaceEdge"/.test(index) && /\.space-edge \.se\{position:absolute;pointer-events:auto\}/.test(index) &&
        /edge\.addEventListener\("wheel"/.test(src) && /edge\.addEventListener\("dblclick"/.test(src));
  check("the flat map is handed its own camera back, so it can leave its edges",
        /function freeConstrain/.test(src) && /setTransformConstrain\(VIEWS\[kind\]\.projection === "mercator" \? freeConstrain : null\)/.test(src));
  const free = new Function("maplibregl", src.match(/function freeConstrain[\s\S]*?\n}\n/)[0] + "; return freeConstrain;")(
    { LngLat: function (lng, lat) { return { lng, lat }; } });
  check("a centre well past the map's edge is kept, not pulled back",
        free({ lng: 260, lat: 40 }, 3).center.lng === 260 && free({ lng: 260, lat: 40 }, 3).zoom === 3);
  check("…but not past the poles", free({ lng: 0, lat: 120 }, 3).center.lat === 89.9);
  check("the flat map can be zoomed out until it floats", /setMinZoom\([\s\S]{0,70}: -1\)/.test(src));
  check("the news wires box opens to the top of the map",
        /\.wire\.open\{height:calc\(100vh - 42px - var\(--wire-lift,0px\)\)\}/.test(wireSrc));
  check("the layer panel rolls up and down", /id="panelRoll"/.test(index) &&
        /\.panel\.shut > \*\{display:none\}/.test(index) && /classList\.toggle\("shut"/.test(src));
}
{
  const { map, els } = run();
  const el = (id) => globalThis.document.getElementById(id);
  const eased = [];
  map.setProjection = () => {}; map.setMinZoom = () => {}; map.setTransformConstrain = () => {};
  map.easeTo = (o) => { eased.push(o); if (o.zoom != null) map.zoom = o.zoom; };
  map.jumpTo = (o) => { if (o.zoom != null) map.zoom = o.zoom; };
  map.getCenter = () => ({ lng: 12, lat: 24 });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  map.setZoom(4.5);
  map.setZoom(1.5); map.fire("zoom");
  await new Promise((r) => setTimeout(r, 1000));
  check("leaving eases to the hand-over size", eased.length === 1 && eased[0].zoom === 2);
  el("spaceBack").fire("click", {});
  check("coming back zooms in again, to the view that was left",
        eased.length === 2 && eased[1].zoom >= 2.6 && eased[1].duration >= 1000, JSON.stringify(eased.at(-1)));
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

test = once(test, """  easeTo(o) { if (o && o.zoom != null) this.zoom = o.zoom; }""",
            """  easeTo(o) { if (o && o.zoom != null) this.zoom = o.zoom; }
  jumpTo(o) { if (o && o.zoom != null) this.zoom = o.zoom; }
  setTransformConstrain() {}""", "map/test.mjs")

test = once(test, """  check("the flat map is mercator, with no way out", projections.at(-1) === "mercator" && minZooms.at(-1) === 0);""",
            """  check("the flat map is mercator, with no way out", projections.at(-1) === "mercator" && minZooms.at(-1) === -1);""",
            "map/test.mjs")

# The old check of the hand-over zoom guessed a range; it is a fixed number now.
test = once(test, """  check("the map is moved to Earth's own size and face first",
        eased.length === 1 && Math.abs(eased[0].zoom - (-0.6)) < 3 && eased[0].bearing === 0 && Array.isArray(eased[0].center));""",
            """  check("the map is moved to Earth's own size and face first",
        eased.length === 1 && eased[0].zoom === 2 && eased[0].bearing === 0 && Array.isArray(eased[0].center));""",
            "map/test.mjs")

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
WIRE.write_text(wire, encoding="utf-8")
print("Hand-over at Eyes' own size; the way back mirrors it; the flat map can leave its edges; panel rolls; wires reach the top.")
