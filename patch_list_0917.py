#!/usr/bin/env python3
"""
What was left over from the Commander's list of requests.

- The zoom buttons go back beside the legend ("Showing"), bottom right: the
  legend and the buttons side by side are as wide as the news wires box. They
  leave the screen in Eyes with the other boxes. The news wires box stands
  above whichever of the two is taller, so it never covers them.
- The view row is Globe / Flat map on the left and one large Leave Earth
  button on their right. The small Globe button that sat between them is gone.
- News wires: Refresh now resets everything, including the ticked subjects,
  the time window and the search. "Weight" is renamed "Substance score", with
  one line under it saying what it counts, and its options say "points".

Edits map/app.js, map/index.html, map/wire.js, map/test.mjs and
map/wire.test.mjs, anchored on exact text.

Run from the repo root:  python3 patch_list_0917.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
M = ROOT / "map"
paths = {n: M / n for n in ("app.js", "index.html", "wire.js", "test.mjs", "wire.test.mjs")}
text = {n: p.read_text(encoding="utf-8") for n, p in paths.items()}

if 'id="zoombox"' in text["index.html"]:
    sys.exit("Already applied — nothing to do.")


def once(name, old, new):
    t = text[name]
    if t.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/{name} ({old.strip()[:70]!r}). Nothing was written.")
    text[name] = t.replace(old, new)


# ---------------------------------------------------------------- index.html

once("index.html",
     """  #legend{position:absolute;right:9px;bottom:26px;z-index:2;width:var(--box-w);max-width:none;""",
     """  #legend{position:absolute;right:calc(9px + var(--zoom-w) + var(--box-gap));bottom:26px;z-index:2;
    width:calc(var(--box-w) - var(--zoom-w) - var(--box-gap));max-width:none;""")

once("index.html",
     """  /* The zoom buttons live in the view row, beside the globe button. */
  .view-zoom{display:flex;align-items:center;gap:6px}
  .view-zoom .maplibregl-ctrl-group{position:static;margin:0;border-radius:3px;box-shadow:none;
    border:1px solid var(--rule);background:rgba(23,21,15,.6)}
  .view-zoom .maplibregl-ctrl-group button{width:26px;height:26px;background-color:transparent}
  .view-zoom .maplibregl-ctrl-group button + button{border-top:1px solid var(--rule)}
  .view-zoom .maplibregl-ctrl-icon{filter:invert(1) brightness(.86)}""",
     """  /* The zoom buttons, to the right of the legend. The two together are as
     wide as the news wires box above them. */
  #zoombox{position:absolute;right:9px;bottom:26px;z-index:2;width:var(--zoom-w)}
  #zoombox.away{opacity:0;pointer-events:none;transition:opacity .5s ease}
  #zoombox .maplibregl-ctrl-group{position:static;margin:0;border-radius:2px;box-shadow:none;
    border:1px solid var(--rule);background:rgba(17,21,15,.88)}
  #zoombox .maplibregl-ctrl-group button{width:100%;height:27px;background-color:transparent}
  #zoombox .maplibregl-ctrl-group button + button{border-top:1px solid var(--rule)}
  #zoombox .maplibregl-ctrl-icon{filter:invert(1) brightness(.86)}""")

# Leave Earth: one large button to the right of the two view choices.
once("index.html",
     """  .ctrl-box .leave{flex:0 0 auto;align-self:stretch;font:inherit;font-size:13px;line-height:1.25;
    color:var(--bone);background:none;border:1px solid var(--rule);border-radius:3px;
    padding:6px 12px;cursor:pointer}""",
     """  .ctrl-box .leave{flex:1 1 55%;align-self:stretch;font:inherit;font-size:17px;font-weight:600;line-height:1.2;
    color:var(--bone);background:rgba(92,110,119,.18);border:1px solid var(--slate);border-radius:3px;
    padding:10px 14px;cursor:pointer;text-align:center}""")

once("index.html",
     """<div id="legend" hidden></div>""",
     """<div id="legend" hidden></div>
<div id="zoombox"></div>""")

# ---------------------------------------------------------------- app.js

once("app.js",
     """function moveZoomButtons() {
  const holder = document.getElementById("view-zoom");""",
     """function moveZoomButtons() {
  const holder = document.getElementById("zoombox");""")

once("app.js",
     """// MapLibre puts its zoom buttons in a corner of the map. They belong with the
// view choices, so the element is moved into the row once it exists.""",
     """// MapLibre puts its zoom buttons in a corner of the map. They belong to the
// right of the legend, so the element is moved into its own box there.""")

once("app.js",
     """    `</div><div class="view-zoom" id="view-zoom">` +
    `<button type="button" id="to-globe" class="to-globe" title="Out to the whole planet">Globe</button></div>` +
    `<button type="button" id="leave-earth" class="leave\"""",
     """    `</div>` +
    `<button type="button" id="leave-earth" class="leave\"""")

once("app.js",
     """  for (const sel of [".left-col", "#legend", ".wire"]) {""",
     """  for (const sel of [".left-col", "#legend", ".wire", "#zoombox"]) {""")

# ---------------------------------------------------------------- wire.js

# The wires box stands above the legend or the zoom buttons, whichever is taller.
once("wire.js",
     """  if (legend && !legend.hidden) lift += legend.getBoundingClientRect().height + 8;""",
     """  const zoom = document.getElementById('zoombox');
  const lh = legend && !legend.hidden ? legend.getBoundingClientRect().height : 0;
  const zh = zoom ? zoom.getBoundingClientRect().height : 0;
  if (lh || zh) lift += Math.max(lh, zh) + 8;""")

once("wire.js",
     """    if (legend) new ResizeObserver(layout).observe(legend);""",
     """    if (legend) new ResizeObserver(layout).observe(legend);
    const zoom = document.getElementById('zoombox');
    if (zoom) new ResizeObserver(layout).observe(zoom);""")

# Refresh resets everything, the ticked subjects included.
once("wire.js",
     """  $refresh.addEventListener('click', () => {
    state.sel = {};
    state.shown = PAGE;
    save();
    state.picked.forEach((id) => load(id, true));
    renderData();
  });""",
     """  $refresh.addEventListener('click', () => {
    const had = state.picked.slice();
    state.sel = {};
    state.picked = [];
    state.pickerOpen = true;
    state.when = 'all';
    state.q = '';
    $when.value = state.when;
    $q.value = '';
    state.shown = PAGE;
    save();
    had.forEach((id) => load(id, true));   // fresh copies wait for the next ticks
    renderData();
  });""")

# "Weight" said nothing about what it weighs.
once("wire.js",
     """    facets.push(facet('weight', 'Weight', { weight: true,
      mark: markKey ? data[markKey] : null,""",
     """    facets.push(facet('weight', 'Substance score', { weight: true,
      mark: markKey ? data[markKey] : null,""")
once("wire.js",
     """  if (weightOn) facets.push(facet('weight', 'Weight', { weight: true, mark: null, markName: null }));""",
     """  if (weightOn) facets.push(facet('weight', 'Substance score', { weight: true, mark: null, markName: null }));""")
once("wire.js",
     """      label: 'At least ' + v + (f.mark === v ? ', the wire’s ' + f.markName + ' mark' : ''),""",
     """      label: 'At least ' + v + (v === 1 ? ' point' : ' points') + (f.mark === v ? ', the wire’s ' + f.markName + ' mark' : ''),""")
once("wire.js",
     """    if (s.w != null) meta.push('<span>Weight ' + s.w + '</span>');""",
     """    if (s.w != null) meta.push('<span>Substance ' + s.w + '</span>');""")
once("wire.js",
     """    return '<label class="wire-filter" for="' + fid + '">' + esc(k.label) +
      '<select id="' + fid + '" data-key="' + k.key + '"' + (set ? ' class="set"' : '') + '>' +
        '<option value="">All</option>' + body +
      '</select></label>';""",
     """    const hint = k.key === 'weight'
      ? '<p class="wire-hint">Points each wire gives a story for what it contains: a decision, official papers, ' +
        'a measured figure, a named place, a primary source. Each wire scores in its own way; ' +
        'a high score is not a claim that the story is true.</p>' : '';
    return '<label class="wire-filter" for="' + fid + '">' + esc(k.label) +
      '<select id="' + fid + '" data-key="' + k.key + '"' + (set ? ' class="set"' : '') + '>' +
        '<option value="">All</option>' + body +
      '</select></label>' + hint;""")
once("wire.js",
     """.wire-unread{padding:3px 10px;color:#B98A80;font-size:11.5px}""",
     """.wire-unread{padding:3px 10px;color:#B98A80;font-size:11.5px}
.wire-hint{margin:0;padding:0 10px 4px;color:var(--dim,#948D7C);font-size:11px;line-height:1.35}""")

# ---------------------------------------------------------------- tests

once("test.mjs",
     """  check("the legend is as wide as the wires box above it",
        /#legend\\{position:absolute;right:9px;bottom:26px;z-index:2;width:var\\(--box-w\\)/.test(index));
  check("the zoom buttons are with the view choices",
        /function moveZoomButtons/.test(src) && /\\.view-zoom \\.maplibregl-ctrl-group\\{position:static/.test(index));""",
     """  check("the legend and the zoom buttons together are as wide as the wires box",
        /#legend\\{position:absolute;right:calc\\(9px \\+ var\\(--zoom-w\\) \\+ var\\(--box-gap\\)\\)/.test(index) &&
        /width:calc\\(var\\(--box-w\\) - var\\(--zoom-w\\) - var\\(--box-gap\\)\\)/.test(index));
  check("the zoom buttons sit to the right of the legend",
        /function moveZoomButtons/.test(src) && /getElementById\\("zoombox"\\)/.test(src) &&
        /#zoombox\\{position:absolute;right:9px;bottom:26px/.test(index) && /id="zoombox"/.test(index));""")

once("test.mjs",
     """  check("the zoom buttons are moved into the view row",
        /function moveZoomButtons/.test(src) && /holder\\.insertBefore\\(group/.test(src) &&
        /\\.view-zoom \\.maplibregl-ctrl-group\\{position:static/.test(index) &&
        !/\\.maplibregl-ctrl-bottom-right \\.maplibregl-ctrl-group\\{position:absolute/.test(index));
  check("a globe button sits beside them", /id="to-globe"/.test(src) && /function outToTheGlobe/.test(src) &&
        /zoom: OPENING_ZOOM, pitch: 0/.test(src));
  check("the legend takes the full width again", /#legend\\{position:absolute;right:9px;bottom:26px;z-index:2;width:var\\(--box-w\\)/.test(index));""",
     """  check("the zoom buttons are moved into their own box",
        /function moveZoomButtons/.test(src) && /holder\\.insertBefore\\(group/.test(src) &&
        !/\\.maplibregl-ctrl-bottom-right \\.maplibregl-ctrl-group\\{position:absolute/.test(index));
  check("Leave Earth sits alone to the right of the view choices", !/id="to-globe"/.test(src) &&
        /\\.ctrl-box \\.leave\\{flex:1 1 55%/.test(index));""")

once("test.mjs",
     """  check("the map's boxes leave the screen in Eyes", /\\[".left-col", "#legend", ".wire"\\]/.test(src));""",
     """  check("the map's boxes leave the screen in Eyes", /\\[".left-col", "#legend", ".wire", "#zoombox"\\]/.test(src));""")

once("wire.test.mjs",
     """        W.optionsFor(c, weight, {}, ANY).some((o) => /notable mark/.test(o.label) && o.value === 3));""",
     """        W.optionsFor(c, weight, {}, ANY).some((o) => /notable mark/.test(o.label) && o.value === 3));
  check("the score is named for what it counts", weight.label === "Substance score" &&
        W.optionsFor(c, weight, {}, ANY).some((o) => /^At least \\d+ points?\\b/.test(o.label)));""")

for n, p in paths.items():
    p.write_text(text[n], encoding="utf-8")
print("Done: zoom beside the legend, a large Leave Earth, Refresh resets subjects, Weight explained.")
