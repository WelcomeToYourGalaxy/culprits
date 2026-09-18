#!/usr/bin/env python3
"""
The boxes leave with the map, terrain on the flat map only, zoom by the views.

- The three boxes on the left stayed on screen in Eyes. They were being given
  the class that fades things out, but no rule ever faded that element: only
  the old panel, the legend and the wires had one. They go now.
- 3D terrain broke the globe: a see-through planet with strips of raw
  elevation. MapLibre's terrain is drawn for the flat map; on the globe nothing
  renders at all — checked here with a stand-in elevation tile, where the flat
  map drew both the painted plate and the imagery over the hills and the globe
  drew nothing. So terrain now belongs to the flat map: switching it on moves
  the view there, and going back to the globe switches it off.
- The zoom buttons move out of the bottom right corner and into the view row,
  with a globe button beside them that pulls the map back out to the whole
  planet. The legend takes the full width again.

Edits map/app.js, map/index.html and map/test.mjs.

Run from the repo root:  python3 patch_viewzoom.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX = (ROOT / "map" / n for n in ("app.js", "test.mjs", "index.html"))
app, test, index = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX))

if "view-zoom" in app:
    sys.exit("app.js already has this — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- the boxes fade out

index = once(index, """  .panel.away,#legend.away,.wire.away{opacity:0;pointer-events:none;transition:opacity .5s ease}""",
             """  .left-col.away,.panel.away,#legend.away,.wire.away{opacity:0;pointer-events:none;transition:opacity .5s ease}""",
             "map/index.html")

# ---------------------------------------------------------------- zoom buttons by the views

index = once(index, """  #legend{position:absolute;right:calc(9px + var(--zoom-w) + var(--box-gap));bottom:26px;z-index:2;
    width:calc(var(--box-w) - var(--zoom-w) - var(--box-gap));max-width:none;""",
             """  #legend{position:absolute;right:9px;bottom:26px;z-index:2;width:var(--box-w);max-width:none;""",
             "map/index.html")

index = once(index, """  /* The zoom buttons, pinned to the legend's line rather than stacked above
     the scale bar and the attribution. */
  .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group{position:absolute;right:9px;bottom:26px;margin:0;z-index:3}""",
             """  /* The zoom buttons live in the view row, beside the globe button. */
  .view-zoom{display:flex;align-items:center;gap:6px}
  .view-zoom .maplibregl-ctrl-group{position:static;margin:0;border-radius:3px;box-shadow:none;
    border:1px solid var(--rule);background:rgba(23,21,15,.6)}
  .view-zoom .maplibregl-ctrl-group button{width:26px;height:26px;background-color:transparent}
  .view-zoom .maplibregl-ctrl-group button + button{border-top:1px solid var(--rule)}
  .view-zoom .maplibregl-ctrl-icon{filter:invert(1) brightness(.86)}
  .to-globe{font:inherit;font-size:12.5px;color:var(--bone);background:none;border:1px solid var(--rule);
    border-radius:3px;padding:4px 8px;cursor:pointer;white-space:nowrap}
  .to-globe:hover{border-color:var(--bone)}""", "map/index.html")

# ---------------------------------------------------------------- terrain belongs to the flat map

app = once(app, """function setTerrain(on) {
  TERRAIN_ON = !!on;
  if (typeof map.setTerrain !== "function") return;
  if (TERRAIN_ON) {""", """function setTerrain(on) {
  TERRAIN_ON = !!on;
  if (typeof map.setTerrain !== "function") return;
  // MapLibre draws terrain for the flat map. On the globe the planet renders
  // as nothing at all, so switching terrain on moves the view with it.
  if (TERRAIN_ON && VIEWS[VIEW].projection !== "mercator") setView("flat");
  if (TERRAIN_ON) {""", "map/app.js")

app = once(app, """function setView(kind) {
  if (!VIEWS[kind]) return;
  VIEW = kind;""", """function setView(kind) {
  if (!VIEWS[kind]) return;
  VIEW = kind;
  // The globe cannot carry terrain, so choosing it puts terrain away.
  if (VIEWS[kind].projection !== "mercator" && TERRAIN_ON) setTerrain(false);""", "map/app.js")

app = once(app, """    `<label class="layer"><input type="checkbox" id="terrain-toggle"${TERRAIN_ON ? " checked" : ""}>` +
    `<span class="nm">3D terrain</span></label>` +""",
           """    `<label class="layer"><input type="checkbox" id="terrain-toggle"${TERRAIN_ON ? " checked" : ""}` +
    ` title="Ground height under the imagery. The flat map only: the globe cannot carry it.">` +
    `<span class="nm">3D terrain (flat map)</span></label>` +""", "map/app.js")

# ---------------------------------------------------------------- the view row

app = once(app, """    `</div><button type="button" id="leave-earth" class="leave" title="Hands the screen to NASA's Eyes ` +
    `on the Solar System. A box in the corner brings the map back.">Leave<br>Earth &#8594;</button></div>` +""",
           """    `</div><div class="view-zoom" id="view-zoom">` +
    `<button type="button" id="to-globe" class="to-globe" title="Out to the whole planet">Globe</button></div>` +
    `<button type="button" id="leave-earth" class="leave" title="Hands the screen to NASA's Eyes ` +
    `on the Solar System. A box in the corner brings the map back.">Leave<br>Earth &#8594;</button></div>` +""",
           "map/app.js")

app = once(app, """  box.addEventListener("click", (e) => {
    if (e.target && e.target.id === "leave-earth") leaveEarth();
  });""", """  box.addEventListener("click", (e) => {
    if (e.target && e.target.id === "leave-earth") leaveEarth();
    if (e.target && e.target.id === "to-globe") outToTheGlobe();
  });
  moveZoomButtons();""", "map/app.js")

app = once(app, """function viewPanelHtml() {""", """// Out to the whole planet: the globe view at the zoom it opens on.
function outToTheGlobe() {
  setView("globe");
  const box = document.querySelector('input[name="view"][value="globe"]');
  if (box) box.checked = true;
  if (typeof map.easeTo === "function") {
    map.easeTo({ zoom: OPENING_ZOOM, pitch: 0, bearing: 0, duration: 900 });
  }
}

// MapLibre puts its zoom buttons in a corner of the map. They belong with the
// view choices, so the element is moved into the row once it exists.
function moveZoomButtons() {
  const holder = document.getElementById("view-zoom");
  const group = document.querySelector(".maplibregl-ctrl-bottom-right .maplibregl-ctrl-group");
  if (holder && group && holder.insertBefore) holder.insertBefore(group, holder.firstChild);
}

function viewPanelHtml() {""", "map/app.js")

app = once(app, """  center: [12, 24],
  zoom: 1,""", """  center: [12, 24],
  zoom: OPENING_ZOOM,""", "map/app.js")
app = once(app, """const BASE_GRADE = {""", """// The zoom the globe opens on, and the one the globe button returns to.
const OPENING_ZOOM = 1;

const BASE_GRADE = {""", "map/app.js")

# ---------------------------------------------------------------- tests

TESTS = r'''
console.log("\nthe view row, and terrain where it works");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the boxes on the left actually fade out", /\.left-col\.away,\.panel\.away/.test(index));
  check("terrain moves the view to the flat map",
        /if \(TERRAIN_ON && VIEWS\[VIEW\]\.projection !== "mercator"\) setView\("flat"\)/.test(src) &&
        /projection !== "mercator" && TERRAIN_ON\) setTerrain\(false\)/.test(src));
  check("the tick box says where terrain works", /3D terrain \(flat map\)/.test(src));
  check("the zoom buttons are moved into the view row",
        /function moveZoomButtons/.test(src) && /holder\.insertBefore\(group/.test(src) &&
        /\.view-zoom \.maplibregl-ctrl-group\{position:static/.test(index) &&
        !/\.maplibregl-ctrl-bottom-right \.maplibregl-ctrl-group\{position:absolute/.test(index));
  check("a globe button sits beside them", /id="to-globe"/.test(src) && /function outToTheGlobe/.test(src) &&
        /zoom: OPENING_ZOOM, pitch: 0/.test(src));
  check("the legend takes the full width again", /#legend\{position:absolute;right:9px;bottom:26px;z-index:2;width:var\(--box-w\)/.test(index));
}
{
  const { map } = run();
  const projections = [];
  map.setProjection = (p) => projections.push(p.type);
  map.setMinZoom = () => {}; map.setTransformConstrain = () => {};
  const terrains = [];
  map.setTerrain = (t) => terrains.push(t && t.source);
  map.getPitch = () => 0;
  map.easeTo = () => {};
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const panel = globalThis.document.getElementById("basemaps");
  panel.fire("change", { target: { id: "terrain-toggle", checked: true } });
  check("terrain on the globe takes you to the flat map first",
        projections.at(-1) === "mercator" && terrains.at(-1) === "terrain-dem");
  panel.fire("change", { target: { name: "view", value: "globe" } });
  check("…and the globe puts it away again", !terrains.at(-1) && projections.at(-1) === "vertical-perspective");
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

test = test.replace('''  check("the zoom buttons sit in the bottom right corner, level with the legend",
        /NavigationControl\\([^)]*\\), "bottom-right"\\)/.test(src) &&
        /\\.maplibregl-ctrl-bottom-right \\.maplibregl-ctrl-group\\{position:absolute;right:9px;bottom:26px/.test(index));''',
'''  check("the zoom buttons are with the view choices",
        /function moveZoomButtons/.test(src) && /\\.view-zoom \\.maplibregl-ctrl-group\\{position:static/.test(index));''')
test = test.replace('''  check("the legend is narrowed by the zoom buttons and the gap",
        /#legend\\{[\\s\\S]{0,260}width:calc\\(var\\(--box-w\\) - var\\(--zoom-w\\) - var\\(--box-gap\\)\\)/.test(index) &&
        /#legend\\{position:absolute;right:calc\\(9px \\+ var\\(--zoom-w\\) \\+ var\\(--box-gap\\)\\)/.test(index));''',
'''  check("the legend is as wide as the wires box above it",
        /#legend\\{position:absolute;right:9px;bottom:26px;z-index:2;width:var\\(--box-w\\)/.test(index));''')

test = test.replace('/zoom: 1,/.test(src) && /EYES_FIT = \\{ zoom: 0\\.8/.test(src)',
                    '/const OPENING_ZOOM = 1;/.test(src) && /EYES_FIT = \\{ zoom: 0\\.8/.test(src)')

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
print("Boxes fade out in Eyes; terrain on the flat map; zoom and globe buttons in the view row.")
