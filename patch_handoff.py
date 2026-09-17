#!/usr/bin/env python3
"""
Out past the globe: the map hands the screen over to NASA's Eyes, fitted.

The backdrop is gone. It could never be more than a picture behind the map:
Eyes runs on NASA's own server, in a frame this page is not allowed to reach
into, so its camera cannot be turned when the globe turns and its clicks
cannot be shared with the map.

Instead: zoom out past the globe (or press "Leave Earth") and the map hands the
whole screen to Eyes, working in full — drag, spacecraft, time controls, the
other planets. A bar at the top brings the map back where you left it.

The join is fitted, not cropped. Before the fade the map is moved so that its
globe is exactly the size, the place and the face that Earth has in Eyes:

- Size: the globe's drawn radius is worked out from MapLibre's own camera
  (checked against measurements at zoom 0, 1, 2 and 3), and the map is zoomed
  until that radius matches Earth's radius in Eyes.
- Face: Eyes shows Earth turned as it really is at the moment you look, so the
  map is turned to the same longitude and latitude, carried forward from a
  calibration by Earth's own rate of turn.

Those numbers cannot be read out of the frame — cross-origin again — so they
are measured once, by eye, in the calibration built into this patch: open the
map with #fit at the end of the address, hold Eyes and the globe together at
half transparency, line them up with the arrow keys, and paste the printed
line into EYES_FIT in map/app.js.

Edits map/app.js, map/index.html and map/test.mjs, anchored on exact text.

Run from the repo root:  python3 patch_handoff.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs", ROOT / "map" / "index.html"
app, test, index = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX))

if "function leaveEarth(" in app:
    sys.exit("app.js already hands over to Eyes — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- index.html

index = once(index, """<!-- Space behind the map: NASA's Eyes on the Solar System, loaded the first
     time it is shown (see setSpace in app.js). Behind #map, never clickable. -->
<iframe id="space" class="space" title="NASA's Eyes on the Solar System, behind the map"
        referrerpolicy="no-referrer" hidden tabindex="-1" aria-hidden="true"></iframe>
<div id="map"></div>""", """<!-- NASA's Eyes on the Solar System. Loaded as the map nears the hand-over
     point, and given the whole screen, and every click, once it is crossed. -->
<iframe id="space" class="space" title="NASA's Eyes on the Solar System"
        referrerpolicy="no-referrer" hidden></iframe>
<div class="space-bar" id="spaceBar" hidden>
  <span class="nm">NASA&#8217;s Eyes on the Solar System</span>
  <span class="un" id="spaceNote">Drag to look around. Click a spacecraft for its own panel.</span>
  <span class="sp"></span>
  <button id="spaceBack">&#8592; Back to the map</button>
</div>
<div id="map"></div>""", "map/index.html")

index = once(index, """  .space{position:fixed;inset:0;width:100%;height:100%;border:0;pointer-events:none;background:#000}
  .space[hidden]{display:none}""", """  .space{position:fixed;inset:0;width:100%;height:100%;border:0;pointer-events:none;
         background:#000;opacity:0;transition:opacity .9s ease}
  .space[hidden]{display:none}
  .space.on{opacity:1;pointer-events:auto}
  #map{transition:opacity .9s ease}
  #map.away{opacity:0;pointer-events:none}
  .panel.away,#legend.away,.wire.away{opacity:0;pointer-events:none;transition:opacity .5s ease}
  .space-bar{position:fixed;left:0;right:0;top:0;z-index:60;display:flex;gap:10px;align-items:center;
             padding:7px 12px;background:rgba(11,16,23,.86);border-bottom:1px solid var(--rule);
             font-size:12.5px;color:var(--bone)}
  .space-bar[hidden]{display:none}
  .space-bar .un{color:var(--dim)}
  .space-bar .sp{flex:1}
  .space-bar button{font:inherit;color:var(--bone);background:none;border:1px solid var(--rule);
                    border-radius:3px;padding:3px 9px;cursor:pointer}
  .space-bar button:hover{border-color:var(--bone)}
  .leave-row{display:block}
  .leave-row .leave{display:inline-block;margin:2px 0 4px;font:inherit;color:var(--bone);background:none;
                    border:1px solid var(--rule);border-radius:3px;padding:4px 10px;cursor:pointer}
  .leave-row .leave:hover{border-color:var(--bone)}
  .leave-row .un{display:block}
  .fit-box{position:fixed;left:12px;bottom:12px;z-index:61;max-width:340px;padding:10px 12px;
           background:rgba(11,16,23,.9);border:1px solid var(--rule);color:var(--bone);font-size:12px}
  .fit-box code{display:block;margin-top:6px;color:var(--dim);word-break:break-all}""", "map/index.html")

# ---------------------------------------------------------------- app.js: replace the backdrop with the hand-over

start = app.index("/* ---------- views: globe, globe to flat, flat; and space behind ---------- */")
end = app.index("\nfunction buildBasemapPanel() {")
NEW = r'''/* ---------- views, and the hand-over to NASA's Eyes ---------- */

// MapLibre's own projection names. "globe" is its globe that turns into the
// flat map between zoom 10 and 12; "vertical-perspective" stays a globe.
const VIEWS = {
  "globe":      { projection: "vertical-perspective", leave: true,
                  nm: "Globe", un: "A globe at every zoom. Zoom out past it to leave Earth." },
  "globe-flat": { projection: "globe", leave: true,
                  nm: "Globe to flat", un: "A globe at world view that flattens into the map as you zoom in. Zoom out past it to leave Earth." },
  "flat":       { projection: "mercator", leave: false,
                  nm: "Flat map", un: "The flat map, with no way out to space." },
};
let VIEW = "globe-flat";
let AWAY = false;             // true while Eyes has the screen
let leaving = false;          // guards the hand-over animation

// NASA's Eyes on the Solar System, centred on Earth, with its panels closed.
const SPACE_URL = "https://eyes.nasa.gov/apps/solar-system/#/earth?embed=true&logo=false&menu=false&featured=false";

// How Earth sits in Eyes, measured by eye once (open the map with #fit at the
// end of the address; see fitMode below). radius is Earth's drawn radius as a
// share of the window's height. lon and lat are the point facing the camera at
// the moment given by at. rate is how fast that point moves: "stars" if Eyes
// holds its camera against the stars (a sidereal day), "sun" if it holds it
// against the Sun (a solar day). If the globe and Earth line up when you
// calibrate but have drifted apart a day later, switch rate.
const EYES_FIT = { radius: 0.24, lon: 0, lat: 0, at: "2026-09-17T00:00:00Z", rate: "stars" };
const TURN = { stars: 360.9856473, sun: 360 };   // degrees a day

// The globe's drawn radius in screen pixels, from MapLibre's own camera: the
// camera sits cameraToCenterDistance in front of the surface, the planet is
// worldSize / 2π across (wider near the poles, as MapLibre scales it), and the
// silhouette is where the line of sight grazes it.
function globeRadiusPx(zoom, lat) {
  const t = map.transform || {};
  const c2c = t.cameraToCenterDistance || (1.5 * (map.getCanvas().clientHeight || 800));
  const R = (512 * Math.pow(2, zoom)) / (2 * Math.PI) / Math.cos((lat || 0) * Math.PI / 180);
  const D = c2c + R;                             // camera to the planet's centre
  return c2c * R / Math.sqrt(D * D - R * R);
}

// The zoom at which the globe is exactly as big as Earth is in Eyes.
function handoffZoom() {
  const want = EYES_FIT.radius * (map.getCanvas().clientHeight || 800);
  let lo = -4, hi = 6;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (globeRadiusPx(mid, EYES_FIT.lat) < want) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// The point on Earth facing Eyes' camera now, carried forward from the
// calibration by Earth's own rate of turn.
function eyesFacing(now) {
  const days = ((now || Date.now()) - Date.parse(EYES_FIT.at)) / 86400000;
  const lon = ((EYES_FIT.lon + TURN[EYES_FIT.rate] * days + 180) % 360 + 360) % 360 - 180;
  return { lon, lat: EYES_FIT.lat };
}

function spaceFrame() { return document.getElementById("space"); }

// Loaded before it is needed: Eyes is a whole application, and a cold start in
// the middle of the hand-over would show a black screen.
function warmSpace() {
  const f = spaceFrame();
  if (f && !f.src) { f.src = SPACE_URL; f.hidden = false; }
}

function panelsAway(on) {
  for (const sel of [".panel", "#legend", ".wire"]) {
    const el = document.querySelector(sel);
    if (el && el.classList) el.classList.toggle("away", on);
  }
}

function leaveEarth() {
  if (AWAY || leaving || !VIEWS[VIEW].leave) return;
  leaving = true;
  warmSpace();
  const to = eyesFacing(Date.now());
  const done = () => {
    AWAY = true;
    leaving = false;
    const f = spaceFrame();
    if (f) { f.hidden = false; f.classList.add("on"); }
    const bar = document.getElementById("spaceBar");
    if (bar) bar.hidden = false;
    const el = document.getElementById("map");
    if (el && el.classList) el.classList.add("away");
    panelsAway(true);
  };
  // Moved to Earth's own face and size first, then faded across.
  if (typeof map.easeTo === "function") {
    map.easeTo({ center: [to.lon, to.lat], zoom: handoffZoom(), bearing: 0, pitch: 0, duration: 900 });
    setTimeout(done, 950);
  } else {
    done();
  }
}

function backToMap() {
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
}

// Zooming out past the globe is what leaves Earth. The map is stopped a little
// below the hand-over size so the last turn of the wheel has somewhere to go.
function watchForLeaving() {
  const edge = () => handoffZoom() - 0.45;
  const check = () => {
    if (!VIEWS[VIEW].leave || AWAY || leaving) return;
    const z = map.getZoom();
    if (z < handoffZoom() + 1.2) warmSpace();
    if (z <= edge() + 0.02) leaveEarth();
  };
  map.on("zoom", check);
  map.on("moveend", check);
  const setEdge = () => { if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[VIEW].leave ? edge() : 0); };
  map.on("resize", setEdge);
  setEdge();
}

function setView(kind) {
  if (!VIEWS[kind]) return;
  VIEW = kind;
  if (typeof map.setProjection === "function") map.setProjection({ type: VIEWS[kind].projection });
  if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[kind].leave ? handoffZoom() - 0.45 : 0);
  if (!VIEWS[kind].leave && AWAY) backToMap();
  if (typeof map.triggerRepaint === "function") map.triggerRepaint();
}

// Lining the two up, once: open the map with #fit at the end of the address.
// Eyes is held over the globe at half transparency; the arrow keys turn the
// globe, +/- change its size, and the box prints the line to paste into
// EYES_FIT above.
function fitMode() {
  if (typeof location === "undefined" || !/(^|[#&])fit\b/.test(location.hash || "")) return;
  warmSpace();
  const f = spaceFrame();
  if (f) { f.hidden = false; f.classList.add("on"); f.style.opacity = ".5"; f.style.pointerEvents = "none"; }
  const box = document.createElement("div");
  box.className = "fit-box";
  document.body.appendChild(box);
  const state = { radius: EYES_FIT.radius, lon: map.getCenter().lng, lat: map.getCenter().lat };
  const draw = () => {
    EYES_FIT.radius = state.radius;
    map.jumpTo({ center: [state.lon, state.lat], zoom: handoffZoom(), bearing: 0, pitch: 0 });
    box.innerHTML = "Line the globe up with Earth behind it. Arrows turn it, + and &#8722; resize it." +
      "<code>const EYES_FIT = { radius: " + state.radius.toFixed(4) + ", lon: " + state.lon.toFixed(2) +
      ", lat: " + state.lat.toFixed(2) + ', at: "' + new Date().toISOString() + '", rate: "stars" };</code>';
  };
  window.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.2 : 2;
    if (e.key === "ArrowLeft") state.lon -= step;
    else if (e.key === "ArrowRight") state.lon += step;
    else if (e.key === "ArrowUp") state.lat = Math.min(85, state.lat + step);
    else if (e.key === "ArrowDown") state.lat = Math.max(-85, state.lat - step);
    else if (e.key === "+" || e.key === "=") state.radius *= 1.01;
    else if (e.key === "-") state.radius /= 1.01;
    else return;
    e.preventDefault();
    draw();
  });
  draw();
}

function viewPanelHtml() {
  return `<p class="bm-h">View</p>` + Object.entries(VIEWS).map(([k, v]) =>
    `<label class="layer"><input type="radio" name="view" value="${k}"${k === VIEW ? " checked" : ""}>` +
    `<span class="body"><span class="nm">${v.nm}</span><span class="un">${v.un}</span></span></label>`).join("") +
    `<div class="layer leave-row"><button type="button" id="leave-earth" class="leave">Leave Earth &#8594;</button>` +
    `<span class="un">Hands the screen to NASA's Eyes on the Solar System, working in full, with Earth ` +
    `where this globe was. A bar at the top brings the map back.</span></div>` +
    `<p class="bm-h" style="margin-top:10px">Basemap</p>`;
}
'''
app = app[:start] + NEW + app[end:]

app = once(app, """    if (e.target && e.target.name === "view") setView(e.target.value);
    if (e.target && e.target.id === "space-toggle") setSpace(e.target.checked);""",
           """    if (e.target && e.target.name === "view") setView(e.target.value);""", "map/app.js")
app = once(app, """  box.addEventListener("change", (e) => {
    if (e.target && e.target.name === "basemap") setBasemap(e.target.value);""", """  box.addEventListener("click", (e) => {
    if (e.target && e.target.id === "leave-earth") leaveEarth();
  });
  box.addEventListener("change", (e) => {
    if (e.target && e.target.name === "basemap") setBasemap(e.target.value);""", "map/app.js")
app = once(app, """  setBasemap(BASEMAP);
  setSpace(SPACE);
  buildBasemapPanel();""", """  setBasemap(BASEMAP);
  buildBasemapPanel();
  watchForLeaving();
  fitMode();
  const back = document.getElementById("spaceBack");
  if (back) back.addEventListener("click", backToMap);""", "map/app.js")

# ---------------------------------------------------------------- tests

old = re.search(r'\{\n  const \{ map, els \} = run\(\);\n  map\.layers\.push\(\{ id: "bg".*?\n\}\n', test, re.S)
if not old:
    sys.exit("Could not find the view tests in map/test.mjs. Nothing was written.")
test = test.replace(old.group(0), r'''{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const radius = new Function("map", src.match(/function globeRadiusPx[\s\S]*?\n}\n/)[0] + "; return globeRadiusPx;")(
    { transform: { cameraToCenterDistance: 1200 }, getCanvas: () => ({ clientHeight: 800 }), getZoom: () => 0 });
  // Measured in a browser at 1200 × 800: 76, 144, 262 and 450 pixels.
  const near = (z, px) => Math.abs(radius(z, 0) - px) <= 1.5;
  check("the globe's drawn size is worked out, not guessed", near(0, 76) && near(1, 144) && near(2, 262.5) && near(3, 450.5),
        [0, 1, 2, 3].map((z) => radius(z, 0).toFixed(1)).join(" "));
  const facing = new Function(src.match(/const EYES_FIT[\s\S]*?\nfunction eyesFacing[\s\S]*?\n}\n/)[0] + "; return { eyesFacing, EYES_FIT };")();
  const t0 = Date.parse(facing.EYES_FIT.at);
  check("Earth's face is carried forward from the calibration", Math.abs(facing.eyesFacing(t0).lon - facing.EYES_FIT.lon) < 1e-6);
  const aDay = facing.eyesFacing(t0 + 86400000).lon, anHour = facing.eyesFacing(t0 + 3600000).lon;
  check("a day on turns it once round, an hour on by fifteen degrees",
        Math.abs(aDay - facing.EYES_FIT.lon) < 1.1 && Math.abs(anHour - facing.EYES_FIT.lon - 15.04) < 0.1,
        `${aDay.toFixed(2)} ${anHour.toFixed(2)}`);
}
{
  const { map, els } = run();
  const projections = [];
  map.setProjection = (p) => projections.push(p.type);
  const minZooms = [];
  map.setMinZoom = (z) => minZooms.push(z);
  const eased = [];
  map.easeTo = (o) => eased.push(o);
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const panel = els.get("basemaps");
  check("the panel offers the three views and the way out", /value="globe"/.test(panel.innerHTML) &&
        /value="globe-flat" checked/.test(panel.innerHTML) && /value="flat"/.test(panel.innerHTML) &&
        /id="leave-earth"/.test(panel.innerHTML));
  const el = (id) => globalThis.document.getElementById(id);
  const frame = el("space");
  check("Eyes is not loaded while the map is being read", !frame.src);
  map.setZoom(2.4); map.fire("zoom");
  check("nearing the way out loads Eyes quietly, still hidden", /^https:\/\/eyes\.nasa\.gov\/apps\/solar-system\/#\/earth\?embed=true/.test(frame.src) && !(frame.classList.list || []).includes("on"));
  map.setZoom(-3); map.fire("zoom");
  await new Promise((r) => setTimeout(r, 1000));
  check("zooming out past the globe hands the screen over", (frame.classList.list || []).includes("on") &&
        (el("map").classList.list || []).includes("away") && el("spaceBar").hidden === false);
  check("the map is moved to Earth's own size and face first",
        eased.length === 1 && Math.abs(eased[0].zoom - (-0.6)) < 3 && eased[0].bearing === 0 && Array.isArray(eased[0].center));
  el("spaceBack").fire("click", {});
  check("the bar brings the map back", !(frame.classList.list || []).includes("on") &&
        !(el("map").classList.list || []).includes("away") && el("spaceBar").hidden === true);
  const change = (t) => panel.fire("change", { target: t });
  change({ name: "view", value: "flat" });
  check("the flat map is mercator, with no way out", projections.at(-1) === "mercator" && minZooms.at(-1) === 0);
  change({ name: "view", value: "globe" });
  check("the globe view stays a globe at every zoom", projections.at(-1) === "vertical-perspective");
  check("…and is stopped just past the hand-over size", minZooms.at(-1) > -4 && minZooms.at(-1) < 4,
        String(minZooms.at(-1)));
  change({ name: "view", value: "globe-flat" });
  check("globe to flat uses MapLibre's own transition", projections.at(-1) === "globe");
}
''')
test = once(test, """  check("the space frame sits behind the map and cannot be clicked",
        index.indexOf('id="space"') < index.indexOf('id="map"') && /\\.space\\{[^}]*pointer-events:none/.test(index));""",
            """  check("Eyes is silent until it is handed the screen, then takes every click",
        /\\.space\\{[^}]*pointer-events:none/.test(index) && /\\.space\\.on\\{[^}]*pointer-events:auto/.test(index) &&
        /id="spaceBack"/.test(index));""", "map/test.mjs")

test = once(test, """  getZoom() { return this.zoom; }""", """  getZoom() { return this.zoom; }
  setZoom(z) { this.zoom = z; }
  setMinZoom() {}
  setProjection() {}
  getCenter() { return { lng: 0, lat: 0 }; }
  easeTo(o) { if (o && o.zoom != null) this.zoom = o.zoom; }""", "map/test.mjs")
test = once(test, """      dataset: {}, after() {}, replaceWith() {}, closest: () => null,
    }), els.get(id)),""", """      dataset: {}, after() {}, replaceWith() {}, closest: () => null,
      // Enough of an element to be shown, hidden and faded: the hand-over to
      // Eyes works by adding classes and clearing `hidden`.
      hidden: true, style: {}, src: "",
      classList: { list: [],
        add(c) { if (!this.list.includes(c)) this.list.push(c); },
        remove(c) { this.list = this.list.filter((x) => x !== c); },
        contains(c) { return this.list.includes(c); },
        toggle(c, on) { on ? this.add(c) : this.remove(c); } },
    }), els.get(id)),""", "map/test.mjs")

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
print("Zooming out past the globe now hands the screen to NASA's Eyes, fitted; backdrop removed.")
