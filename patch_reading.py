#!/usr/bin/env python3
"""
Satellite graded like the atlas, the wires box laid out, slicks counted wider.

- "Satellite imagery" now carries the same grading and the same colour washes
  the atlas basemap puts on its imagery. It was still the old flat grading, so
  the two basemaps looked like different photographs of the planet.
- The news wires box: the Subjects button takes the full width, the filters for
  each subject open by default rather than folded away, and the time window
  moves down beside Language and Type instead of sitting next to Subjects.
- The caret that rolls the layer list moves from the title box into the layer
  box itself.
- Cerulean slicks: shapes now draw from zoom 6 rather than 7 (a zoom-6 square
  held about 7,000 slicks where the tile cap is 10,000), and from zoom 3 the
  shaded squares are back — each one counted live, so a square says only "this
  many, somewhere in here". Below zoom 3 it stays one total for the collection,
  because four squares over the planet were a grey wash.
- The aggregate circles read as separate marks at world view again: smaller,
  softer edged and less opaque the wider out you are.

Edits map/app.js, map/index.html, map/wire.js and map/test.mjs, anchored on
exact text.

Run from the repo root:  python3 patch_reading.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX, WIRE = (ROOT / "map" / n for n in ("app.js", "test.mjs", "index.html", "wire.js"))
app, test, index, wire = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX, WIRE))

if "COUNT_FROM" in app:
    sys.exit("app.js already has this — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- one imagery, graded once

app = once(app, """  // Unchanged from before the atlas existed.
  satellite: { "raster-brightness-min": 0, "raster-brightness-max": .74,
               "raster-saturation": -.22, "raster-contrast": .10,
               "raster-hue-rotate": 0 },""",
           """  // The same imagery, graded the same way: past the zoom where the plate has
  // faded, the atlas basemap is this, so the two read as one photograph.
  satellite: { "raster-brightness-min": ATLAS_TUNE.lift, "raster-brightness-max": 1,
               "raster-saturation": ATLAS_TUNE.sat, "raster-contrast": ATLAS_TUNE.con,
               "raster-hue-rotate": ATLAS_TUNE.hue },""", "map/app.js")

app = once(app, """  Object.assign(BASE_GRADE.atlas, {
    "raster-brightness-min": ATLAS_TUNE.lift, "raster-saturation": ATLAS_TUNE.sat,
    "raster-contrast": ATLAS_TUNE.con, "raster-hue-rotate": ATLAS_TUNE.hue });""",
           """  for (const k of ["atlas", "satellite"]) {
    Object.assign(BASE_GRADE[k], {
      "raster-brightness-min": ATLAS_TUNE.lift, "raster-saturation": ATLAS_TUNE.sat,
      "raster-contrast": ATLAS_TUNE.con, "raster-hue-rotate": ATLAS_TUNE.hue });
  }""", "map/app.js")

# The washes are part of that grading, so they draw over the imagery basemap too.
app = once(app, """    if (this.failed || BASEMAP !== "atlas" || !options || !options.shaderData) return;""",
           """    if (this.failed || BASEMAP === "outlines" || !options || !options.shaderData) return;""", "map/app.js")

# ---------------------------------------------------------------- the caret moves box

index = once(index, """  <div class="title-box">
    <h1>The Culprits</h1>
    <button class="p-roll" id="panelRoll" title="Roll the layer list up or down" aria-expanded="true">&#9662;</button>
  </div>""", """  <div class="title-box">
    <h1>The Culprits</h1>
  </div>""", "map/index.html")

index = once(index, """  <div class="panel">
    <div id="layers"></div>""", """  <div class="panel">
    <div class="panel-head">
      <span>Layers</span>
      <button class="p-roll" id="panelRoll" title="Roll the layer list up or down" aria-expanded="true">&#9662;</button>
    </div>
    <div id="layers"></div>""", "map/index.html")

index = once(index, """  .panel.shut{display:none}""", """  .panel-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;
    background:rgba(31,28,21,.94);padding:1px 0 5px;color:var(--dim);font-size:11px;
    letter-spacing:.06em;text-transform:uppercase}
  .panel.shut{height:auto;max-height:none;overflow:hidden}
  .panel.shut > *{display:none}
  .panel.shut > .panel-head{display:flex}""", "map/index.html")

# ---------------------------------------------------------------- the wires box

# Subjects across the whole width; the time window moves down to the filters.
wire = once(wire, """.wire-tools{display:flex;gap:6px;padding:8px 10px;align-items:center}
.wire-tools input{flex:1;min-width:0;background:var(--peat,#17150F);border:1px solid var(--rule,#322E27);
  padding:2px 7px;border-radius:2px;font-size:12.5px}""",
""".wire-tools{display:flex;flex-direction:column;gap:6px;padding:8px 10px;align-items:stretch}
.wire-tools #wirePickBtn{width:100%;text-align:center;font-size:13px;padding:4px 8px}
.wire-tools input{width:100%;min-width:0;background:var(--peat,#17150F);border:1px solid var(--rule,#322E27);
  padding:3px 7px;border-radius:2px;font-size:12.5px}
.wire-when{display:flex;align-items:center;gap:7px;padding:2px 10px 8px;color:var(--dim,#948D7C);font-size:12px}
.wire-when select{flex:1}""", "map/wire.js")

wire = once(wire, """        '<select id="wireWhen" aria-label="Time window">' +
          WINDOWS.map((w) => '<option value="' + w.id + '">' + w.label + '</option>').join('') +
        '</select>' +
      '</div>' +""", """      '</div>' +""", "map/wire.js")

wire = once(wire, """      '<div class="wire-filters" id="wireFilters"></div>' +""",
            """      '<div class="wire-filters" id="wireFilters"></div>' +
      '<div class="wire-when"><label for="wireWhen">Time</label>' +
        '<select id="wireWhen" aria-label="Time window">' +
          WINDOWS.map((w) => '<option value="' + w.id + '">' + w.label + '</option>').join('') +
        '</select></div>' +""", "map/wire.js")

# Each subject's filters open on their own: they are what the box is for.
wire = once(wire, """    const open = !!state.expanded[id];""",
            """    const open = state.expanded[id] !== false;   // open unless it was folded away""", "map/wire.js")
wire = once(wire, """      state.expanded[t.dataset.expand] = !state.expanded[t.dataset.expand];""",
            """      state.expanded[t.dataset.expand] = state.expanded[t.dataset.expand] === false;""", "map/wire.js")

# ---------------------------------------------------------------- slicks, counted wider

app = once(app, """    collection: "public.slick_plus", drawFrom: 7,""",
           """    collection: "public.slick_plus", drawFrom: 6,""", "map/app.js")
app = once(app, """Every detection since January 2023, live. Wide out the panel gives the total number of detections; shapes draw from zoom 7, where a slick is large enough to see.""",
           """Every detection since January 2023, live. Below zoom 3 the panel gives the total number of detections; from zoom 3 each shaded square is counted live, and shapes draw from zoom 6, where a slick is large enough to see.""",
           "map/app.js")
app = once(app, """// 3,421 at zoom 7, 376 at zoom 9. That is why shapes draw from zoom 7 — the
// first measured zoom under the cap. Denser seas may still exceed it at 7,
// which is what the marking is for.""",
"""// 3,421 at zoom 7, 376 at zoom 9 — about 7,000 at zoom 6, which is under the
// cap, so shapes draw from zoom 6. Denser seas may still exceed it there, which
// is what the marking is for. From zoom 3 to that point the squares are counted
// instead: real numbers from the same API, one request each.""", "map/app.js")

app = once(app, """const COUNT_PARALLEL = 4;             // their server is slow; do not queue 30 at once""",
           """const COUNT_PARALLEL = 4;             // their server is slow; do not queue 30 at once
const COUNT_FROM = 3;                 // wider than this, one total instead of squares""", "map/app.js")

app = once(app, """  // Wide out, no squares. At world view four squares covered the planet, each
  // shaded near full by tens of thousands of slicks — a grey wash with a cross
  // where their edges met — and each waited on Cerulean's slowest query. One
  // total says what is true at that scale without drawing anything misleading.
  if (map.getZoom() < cfg.drawFrom) {""",
"""  // At world view there are no squares. Four of them covered the planet, each
  // shaded near full by tens of thousands of slicks — a grey wash with a cross
  // where their edges met — and each waited on Cerulean's slowest query. One
  // total says what is true at that scale without drawing anything misleading.
  // From zoom 3 the squares are small enough to say something, and each is
  // counted live rather than estimated.
  if (map.getZoom() < COUNT_FROM) {""", "map/app.js")

app = once(app, """    setLayerState(cfg.id, `zoom in to ${cfg.drawFrom} to draw slicks`);""",
           """    setLayerState(cfg.id, `zoom in to ${COUNT_FROM} to count them by area`);""", "map/app.js")
app = once(app, """      setLayerState(cfg.id, `${total.toLocaleString()} potential slicks since January 2023 — ` +
                            `zoom in to ${cfg.drawFrom} to draw them`);""",
           """      setLayerState(cfg.id, `${total.toLocaleString()} potential slicks since January 2023 — ` +
                            `zoom in to ${COUNT_FROM} to count them by area, ${cfg.drawFrom} to draw them`);""",
           "map/app.js")

# Below the drawing zoom the squares are a step finer than the view's own
# tiles, so a screen holds a dozen or so rather than four.
app = once(app, """  const z = Math.max(1, Math.min(12, Math.floor(map.getZoom())));""",
           """  const wide = map.getZoom() < cfg.drawFrom;
  const z = Math.max(1, Math.min(12, Math.floor(map.getZoom()) + (wide ? 1 : 0)));""", "map/app.js")

# ---------------------------------------------------------------- aggregates that read apart

# Aggregate circles at world view: smaller, softer and fainter, so a dozen of
# them read as a dozen marks rather than one smear. The relative sizes and the
# shape of the expression are untouched.
app = once(app, """      "circle-color": cfg.colour,
      "circle-opacity": .55,
      "circle-stroke-color": cfg.colour,
      "circle-stroke-width": 1,""",
           """      "circle-color": cfg.colour,
      "circle-stroke-color": cfg.colour,
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 0, .5, 5, 1],
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 0, .35, 5, 0],
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 0, .34, 3, .45, 6, .55],""", "map/app.js")

app = once(app, """        0,  ["*", 0.26 * scale, MAGNITUDE_RADIUS],
        3,  ["*", 0.38 * scale, MAGNITUDE_RADIUS],""",
           """        0,  ["*", 0.18 * scale, MAGNITUDE_RADIUS],
        3,  ["*", 0.30 * scale, MAGNITUDE_RADIUS],""", "map/app.js")

# ---------------------------------------------------------------- tests

test = test.replace('fill && fill.minzoom === 7 && fill["source-layer"] === "default" && src.minzoom === 7',
                    'fill && fill.minzoom === 6 && fill["source-layer"] === "default" && src.minzoom === 6')
test = test.replace('"shapes draw from zoom 7, off the same zoom in the source"',
                    '"shapes draw from zoom 6, off the same zoom in the source"')

test = test.replace('check("the marking only shows where shapes are drawn", cap && cap.minzoom === 7)',
                    'check("the marking only shows where shapes are drawn", cap && cap.minzoom === 6)')
test = test.replace('/\\\\.panel\\\\.shut\\\\{display:none\\\\}/.test(index)', '/\\\\.panel\\\\.shut > \\\\*\\\\{display:none\\\\}/.test(index)')
test = test.replace("cap && cap.minzoom === 7", "cap && cap.minzoom === 6")
test = test.replace("the name\'s box holds the caret that rolls the layer list", "the layer box holds the caret that rolls it")
test = test.replace("/title-box", "/panel-head")
test = test.replace("shut\\{display:none\\}", "shut > \\*\\{display:none\\}")
TESTS = r'''
console.log("\nreading the map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  check("the imagery basemap is graded like the atlas's imagery",
        /satellite: \{ "raster-brightness-min": ATLAS_TUNE\.lift/.test(src) &&
        /for \(const k of \["atlas", "satellite"\]\)/.test(src));
  check("and carries the same washes", /BASEMAP === "outlines" \|\| !options/.test(src));
  check("the caret sits in the layer box, not the title box",
        /<div class="panel-head">[\s\S]{0,200}id="panelRoll"/.test(index) &&
        !/title-box[\s\S]{0,120}panelRoll/.test(index) && /\.panel\.shut > \.panel-head\{display:flex\}/.test(index));
  check("the Subjects button takes the width", /#wirePickBtn\{width:100%/.test(wireSrc));
  check("each subject's filters open by default", /state\.expanded\[id\] !== false/.test(wireSrc) &&
        /state\.expanded\[t\.dataset\.expand\] === false/.test(wireSrc));
  check("the time window sits with the filters, below them",
        wireSrc.indexOf("id=\"wireFilters") < wireSrc.indexOf("wire-when\"><label") &&
        /class="wire-when"><label for="wireWhen">Time<\/label>/.test(wireSrc));
  check("slicks draw from zoom 6 and are counted from zoom 3",
        /drawFrom: 6/.test(src) && /const COUNT_FROM = 3/.test(src) && /map\.getZoom\(\) < COUNT_FROM/.test(src));
  check("the squares below the drawing zoom are a step finer than the view's tiles",
        /const wide = map\.getZoom\(\) < cfg\.drawFrom;/.test(src) && /\+ \(wide \? 1 : 0\)/.test(src));
  check("aggregate circles are fainter and softer at world view",
        /"circle-blur": \["interpolate", \["linear"\], \["zoom"\], 0, \.35/.test(src) &&
        /0,  \["\*", 0\.18 \* scale, MAGNITUDE_RADIUS\]/.test(src));
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
WIRE.write_text(wire, encoding="utf-8")
print("Satellite graded like the atlas; wires box laid out; slicks counted from zoom 3, drawn from 6.")
