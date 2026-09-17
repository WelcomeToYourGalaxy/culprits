#!/usr/bin/env python3
"""
The title and the settings in their own boxes, and one fewer view.

- The map's name sits in its own small box in the top left corner, with the
  caret that rolls the layer list up and down.
- View and Basemap move into a second small box under it, as names only: the
  paragraph under each one is gone.
- "Globe to flat" is gone. Two views remain: Globe and Flat map.
- "Leave Earth" works from either view and at any zoom. From the flat map it
  turns the world into a globe first, at the size Earth has in Eyes, and the
  return puts the flat map back where it was.
- The "Zoom 2.6 — wide view" line is gone.
- The layer list keeps its own box below the other two.

Edits map/app.js, map/index.html and map/test.mjs, anchored on exact text.

Run from the repo root:  python3 patch_controls.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX = (ROOT / "map" / n for n in ("app.js", "test.mjs", "index.html"))
app, test, index = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX))

if 'class="left-col"' in index:
    sys.exit("The boxes are already split up — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- three boxes down the left

index = once(index, """<div class="panel">
  <button class="p-roll" id="panelRoll" title="Roll the panel up or down" aria-expanded="true">&#9662;</button>
  <h1>The Culprits</h1>
  <p class="zoomstate" id="zoomstate">Reading the aggregate view.</p>
  <div id="basemaps" class="basemaps"></div>
  <div id="layers"></div>
  <p class="note" id="note"></p>
</div>""", """<div class="left-col">
  <div class="title-box">
    <h1>The Culprits</h1>
    <button class="p-roll" id="panelRoll" title="Roll the layer list up or down" aria-expanded="true">&#9662;</button>
  </div>
  <div id="basemaps" class="ctrl-box"></div>
  <div class="panel">
    <div id="layers"></div>
    <p class="note" id="note"></p>
  </div>
</div>""", "map/index.html")

index = once(index, """  .panel{
    position:absolute;top:16px;left:16px;width:var(--box-w);max-height:calc(100% - 32px);
    overflow:auto;background:rgba(31,28,21,.94);border:1px solid var(--rule);
    padding:16px 17px;font-size:13.5px;line-height:1.5;backdrop-filter:blur(6px);
  }
  .panel h1{font-size:17px;font-weight:600;margin:0 0 4px;letter-spacing:-.01em}""",
"""  /* Three boxes down the left: the name, the settings, the layers. */
  .left-col{position:absolute;top:16px;left:16px;width:var(--box-w);max-height:calc(100% - 32px);
    display:flex;flex-direction:column;gap:8px;pointer-events:none}
  .left-col > *{pointer-events:auto;background:rgba(31,28,21,.94);border:1px solid var(--rule);
    font-size:13.5px;line-height:1.5;backdrop-filter:blur(6px)}
  .title-box{display:flex;align-items:center;gap:8px;padding:9px 12px 10px}
  .ctrl-box{padding:9px 12px 10px}
  .panel{min-height:0;overflow:auto;padding:10px 13px 0;display:flex;flex-direction:column}
  .title-box h1{font-size:17px;font-weight:600;margin:0;letter-spacing:-.01em;flex:1}""", "map/index.html")

index = once(index, """  .panel .zoomstate{color:var(--dim);font-size:12.5px;margin:0 0 15px}
  .panel .zoomstate b{color:var(--bone);font-weight:500}
""", "", "map/index.html")

index = once(index, """  .p-roll{position:absolute;top:12px;right:12px;background:none;border:0;color:var(--dim);
    font-size:13px;line-height:1;cursor:pointer;padding:2px 4px}
  .p-roll:hover{color:var(--bone)}
  .panel.shut{height:auto;max-height:none;overflow:hidden}
  .panel.shut > *{display:none}
  .panel.shut > h1,.panel.shut > .p-roll{display:block}""",
"""  .p-roll{background:none;border:0;color:var(--dim);font-size:13px;line-height:1;cursor:pointer;padding:2px 4px}
  .p-roll:hover{color:var(--bone)}
  .panel.shut{display:none}

  /* The settings box: names only, close together. */
  .ctrl-box .layer{padding:3px 0;gap:7px;border-top:none}
  .ctrl-box .bm-h{margin:6px 0 2px}
  .ctrl-box .bm-h:first-child{margin-top:0}
  .ctrl-box .leave{margin:6px 0 2px;font:inherit;font-size:12.5px;color:var(--bone);background:none;
    border:1px solid var(--rule);border-radius:3px;padding:3px 9px;cursor:pointer}
  .ctrl-box .leave:hover{border-color:var(--bone)}""", "map/index.html")

index = once(index, """  .basemaps{margin:0 0 14px;padding-bottom:6px;border-bottom:1px solid var(--rule)}
""", "", "map/index.html")

# ---------------------------------------------------------------- app.js: two views, no paragraphs

app = once(app, """const VIEWS = {
  "globe":      { projection: "vertical-perspective", leave: true,
                  nm: "Globe", un: "A globe at every zoom. Zoom out past it to leave Earth." },
  "globe-flat": { projection: "globe", leave: true,
                  nm: "Globe to flat", un: "A globe at world view that flattens into the map as you zoom in. Zoom out past it to leave Earth." },
  "flat":       { projection: "mercator", leave: false,
                  nm: "Flat map", un: "The flat map, with no way out to space." },
};
let VIEW = "globe-flat";""", """const VIEWS = {
  "globe": { projection: "vertical-perspective", leave: true, nm: "Globe" },
  "flat":  { projection: "mercator", leave: false, nm: "Flat map" },
};
let VIEW = "globe";""", "map/app.js")

app = once(app, """    // The opening view: a globe that flattens as you zoom in. See VIEWS.
    projection: { type: "globe" },""", """    // The opening view: a globe. See VIEWS.
    projection: { type: "vertical-perspective" },""", "map/app.js")

app = once(app, """function viewPanelHtml() {
  return `<p class="bm-h">View</p>` + Object.entries(VIEWS).map(([k, v]) =>
    `<label class="layer"><input type="radio" name="view" value="${k}"${k === VIEW ? " checked" : ""}>` +
    `<span class="body"><span class="nm">${v.nm}</span><span class="un">${v.un}</span></span></label>`).join("") +
    `<div class="layer leave-row"><button type="button" id="leave-earth" class="leave">Leave Earth &#8594;</button>` +
    `<span class="un">Hands the screen to NASA's Eyes on the Solar System, working in full, with Earth ` +
    `where this globe was. A bar at the top brings the map back.</span></div>` +
    `<p class="bm-h" style="margin-top:10px">Basemap</p>`;
}""", """// Names only: the settings box says what each one is, not what it does.
function viewPanelHtml() {
  return `<p class="bm-h">View</p>` + Object.entries(VIEWS).map(([k, v]) =>
    `<label class="layer"><input type="radio" name="view" value="${k}"${k === VIEW ? " checked" : ""}>` +
    `<span class="nm">${v.nm}</span></label>`).join("") +
    `<button type="button" id="leave-earth" class="leave" title="Hands the screen to NASA's Eyes on ` +
    `the Solar System. A bar at the top brings the map back.">Leave Earth &#8594;</button>` +
    `<p class="bm-h">Basemap</p>`;
}""", "map/app.js")

app = re.sub(r'  const opts = \[\n(?:.*\n)*?  \];\n  box\.innerHTML = viewPanelHtml\(\) \+ opts\.map\(\(\[k, nm, un\]\) =>\n'
             r'.*\n.*\n.*\n',
"""  const opts = [["atlas", "Painted atlas"], ["satellite", "Satellite imagery"], ["outlines", "Country outlines"]];
  box.innerHTML = viewPanelHtml() + opts.map(([k, nm]) =>
    `<label class="layer"><input type="radio" name="basemap" value="${k}"` +
    `${k === BASEMAP ? " checked" : ""}><span class="nm">${nm}</span></label>`).join("");
""", app, count=1)
if "Painted atlas\"]]" not in app and '["atlas", "Painted atlas"]' not in app:
    sys.exit("Could not rewrite the basemap rows in map/app.js. Nothing was written.")

app = once(app, """  document.getElementById("zoomstate").innerHTML = z < CLUSTER_MAXZOOM
    ? `Zoom <b>${z.toFixed(1)}</b> — wide view.`
    : `Zoom <b>${z.toFixed(1)}</b> — detail view.`;""",
           """  // The line that said "Zoom 2.6 — wide view" is gone; this is kept for
  // anything that still puts the reading on the page.
  const el = document.getElementById("zoomstate");
  if (el) el.innerHTML = `Zoom <b>${z.toFixed(1)}</b> — ${z < CLUSTER_MAXZOOM ? "wide" : "detail"} view.`;""",
           "map/app.js")

# ---------------------------------------------------------------- leaving from the flat map too

app = once(app, """function leaveEarth() {
  if (AWAY || leaving || !VIEWS[VIEW].leave) return;
  leaving = true;
  leftFrom = { center: map.getCenter(), zoom: Math.max(map.getZoom(), handoffZoom() + 0.6) };""",
"""function leaveEarth() {
  if (AWAY || leaving) return;
  leaving = true;
  leftFrom = { center: map.getCenter(), zoom: Math.max(map.getZoom(), handoffZoom() + 0.6), view: VIEW };
  // From the flat map the world becomes a globe first, so what fades out is
  // the same Earth that fades in.
  if (VIEWS[VIEW].projection === "mercator") {
    if (typeof map.setProjection === "function") map.setProjection({ type: VIEWS.globe.projection });
    if (typeof map.setTransformConstrain === "function") map.setTransformConstrain(null);
  }""", "map/app.js")

app = once(app, """  if (leftFrom && typeof map.easeTo === "function") {
    map.jumpTo({ center: [eyesFacing(Date.now()).lon, EYES_FIT.lat], zoom: handoffZoom(), bearing: 0, pitch: 0 });
    map.easeTo({ center: leftFrom.center, zoom: leftFrom.zoom, duration: 1400 });
  }""", """  if (leftFrom && typeof map.easeTo === "function") {
    map.jumpTo({ center: [eyesFacing(Date.now()).lon, EYES_FIT.lat], zoom: handoffZoom(), bearing: 0, pitch: 0 });
    if (leftFrom.view && leftFrom.view !== VIEW) setView(leftFrom.view);
    else if (leftFrom.view === "flat") setView("flat");
    map.easeTo({ center: leftFrom.center, zoom: leftFrom.zoom, duration: 1400 });
  }""", "map/app.js")

# ---------------------------------------------------------------- opening above the hand-over

# The hand-over size is zoom 2, so the map has to open wider than that, and the
# drop has to be a zoom-out the reader makes rather than where the map starts.
app = once(app, """  center: [12, 24],
  zoom: 1.6,""", """  center: [12, 24],
  zoom: 2.9,""", "map/app.js")

app = once(app, """function watchForLeaving() {
  const edge = () => handoffZoom() - 0.15;
  const check = () => {
    if (!VIEWS[VIEW].leave || AWAY || leaving) return;
    const z = map.getZoom();
    if (z < handoffZoom() + 1.2) warmSpace();
    if (z <= edge() + 0.02) leaveEarth();
  };""", """function watchForLeaving() {
  const edge = () => handoffZoom() - 0.15;
  // Only a zoom-out the reader makes leaves Earth. Without this the map would
  // hand over as it opened, because it opens near the hand-over size.
  let wasAbove = false;
  const check = () => {
    if (!VIEWS[VIEW].leave || AWAY || leaving) return;
    const z = map.getZoom();
    if (z > edge() + 0.25) wasAbove = true;
    if (z < handoffZoom() + 1.2) warmSpace();
    if (wasAbove && z <= edge() + 0.02) { wasAbove = false; leaveEarth(); }
  };""", "map/app.js")

# ---------------------------------------------------------------- tests

test = once(test, """  check("the panel offers the three views and the way out", /value="globe"/.test(panel.innerHTML) &&
        /value="globe-flat" checked/.test(panel.innerHTML) && /value="flat"/.test(panel.innerHTML) &&
        /id="leave-earth"/.test(panel.innerHTML));""",
"""  check("the settings box offers the two views and the way out", /value="globe" checked/.test(panel.innerHTML) &&
        /value="flat"/.test(panel.innerHTML) && !/globe-flat/.test(panel.innerHTML) &&
        /id="leave-earth"/.test(panel.innerHTML));
  check("no view, basemap or button carries a paragraph", !/class="un"/.test(panel.innerHTML));""", "map/test.mjs")

test = once(test, """  change({ name: "view", value: "globe" });
  check("the globe view stays a globe at every zoom", projections.at(-1) === "vertical-perspective");
  check("…and is stopped just past the hand-over size", minZooms.at(-1) > -4 && minZooms.at(-1) < 4,
        String(minZooms.at(-1)));
  change({ name: "view", value: "globe-flat" });
  check("globe to flat uses MapLibre's own transition", projections.at(-1) === "globe");""",
"""  change({ name: "view", value: "globe" });
  check("the globe view stays a globe at every zoom", projections.at(-1) === "vertical-perspective");
  check("…and is stopped just past the hand-over size", minZooms.at(-1) > -4 && minZooms.at(-1) < 4,
        String(minZooms.at(-1)));""", "map/test.mjs")

test = once(test, """  check("the map opens as a globe that flattens as you zoom in", /projection:\\s*\\{\\s*type:\\s*"globe"\\s*\\}/.test(opts));""",
            """  check("the map opens as a globe", /projection:\\s*\\{\\s*type:\\s*"vertical-perspective"\\s*\\}/.test(opts));""",
            "map/test.mjs")

test = once(test, """  check("the layer panel takes it", /\\.panel\\{[\\s\\S]{0,200}width:var\\(--box-w\\)/.test(index));""",
            """  check("the boxes down the left take it", /\\.left-col\\{[\\s\\S]{0,120}width:var\\(--box-w\\)/.test(index));""",
            "map/test.mjs")
test = once(test, """  check("the layer panel rolls up and down", /id="panelRoll"/.test(index) &&
        /\\.panel\\.shut > \\*\\{display:none\\}/.test(index) && /classList\\.toggle\\("shut"/.test(src));""",
            """  check("the layer panel rolls up and down", /id="panelRoll"/.test(index) &&
        /\\.panel\\.shut\\{display:none\\}/.test(index) && /classList\\.toggle\\("shut"/.test(src));""",
            "map/test.mjs")

test = once(test, """  map.setZoom(4.5);
  map.setZoom(1.5); map.fire("zoom");""",
            """  map.setZoom(4.5); map.fire("zoom");
  map.setZoom(1.5); map.fire("zoom");""", "map/test.mjs")
test = once(test, """  map.setZoom(2.4); map.fire("zoom");""",
            """  map.setZoom(4); map.fire("zoom");
  map.setZoom(2.4); map.fire("zoom");""", "map/test.mjs")

TESTS = r'''
console.log("\nthe boxes down the left");
{
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the name, the settings and the layers are three boxes", /class="left-col"/.test(index) &&
        /<div class="title-box">/.test(index) && /id="basemaps" class="ctrl-box"/.test(index));
  check("the name's box holds the caret that rolls the layer list",
        /title-box[\s\S]{0,200}id="panelRoll"/.test(index) && /\.panel\.shut\{display:none\}/.test(index));
  check("the zoom reading is off the page", !/id="zoomstate"/.test(index) && /const el = document\.getElementById\("zoomstate"\)/.test(src));
  check("only two views are offered", /"globe": \{ projection: "vertical-perspective"/.test(src) &&
        /"flat":  \{ projection: "mercator"/.test(src) && !/globe-flat/.test(src));
}
{
  const { map } = run();
  const el = (id) => globalThis.document.getElementById(id);
  const projections = [], eased = [];
  map.setProjection = (p) => projections.push(p.type);
  map.setMinZoom = () => {}; map.setTransformConstrain = () => {};
  map.easeTo = (o) => { eased.push(o); if (o.zoom != null) map.zoom = o.zoom; };
  map.jumpTo = (o) => { if (o.zoom != null) map.zoom = o.zoom; };
  map.getCenter = () => ({ lng: 12, lat: 24 });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const panel = el("basemaps");
  panel.fire("change", { target: { name: "view", value: "flat" } });
  map.setZoom(6);
  panel.fire("click", { target: { id: "leave-earth" } });
  await new Promise((r) => setTimeout(r, 1000));
  check("Leave Earth works from the flat map, at any zoom",
        el("spaceBar").hidden === false && projections.includes("vertical-perspective") && eased[0].zoom === 2);
  el("spaceBack").fire("click", {});
  check("coming back puts the flat map back", projections.at(-1) === "mercator" && eased.at(-1).zoom === 6);
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
print("Title and settings in their own boxes, names only; two views; Leave Earth works from the flat map.")
