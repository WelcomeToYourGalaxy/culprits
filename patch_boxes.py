#!/usr/bin/env python3
"""
The boxes lined up, the zoom buttons beside the legend, and every box pullable.

- One width for all of them: --box-w, 290px, the width the layer panel already
  had. The news wires box on the right takes it too (it was 440px).
- The zoom buttons move from the top right to the bottom right corner, level
  with the legend and to the right of it. The legend is narrowed by exactly
  their width and the gap, so the legend and the buttons together are as wide
  as the news wires box above them.
- Every box — the layer panel, the legend and the news wires — gets a grip on
  its free edge. Drag it to pull the box open or shut; double-click it to put
  the box back to its own height. The panel's grip is along its bottom, the
  other two along their top, so in each case pulling away from the box's
  corner makes it taller.
- The address for NASA's Eyes is replaced with the one written by Eyes' own
  embed panel, with the "View 3D" prompt and the other panels turned off.

Edits map/app.js, map/index.html, map/wire.js and map/test.mjs, anchored on
exact text.

Run from the repo root:  python3 patch_boxes.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX, WIRE = (ROOT / "map" / n for n in ("app.js", "test.mjs", "index.html", "wire.js"))
app, test, index, wire = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX, WIRE))

if "function makePullable(" in app:
    sys.exit("app.js already has pullable boxes — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- one width, one corner

index = once(index, """    --sans:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;""",
             """    --sans:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
    /* One width for the layer panel, the news wires box, and the legend and
       zoom buttons side by side. */
    --box-w:290px; --zoom-w:29px; --box-gap:6px;""", "map/index.html")

index = once(index, """    position:absolute;top:16px;left:16px;width:290px;max-height:calc(100% - 32px);""",
             """    position:absolute;top:16px;left:16px;width:var(--box-w);max-height:calc(100% - 32px);""", "map/index.html")

index = once(index, """  #legend{position:absolute;right:9px;bottom:26px;z-index:2;max-width:236px;""",
             """  #legend{position:absolute;right:calc(9px + var(--zoom-w) + var(--box-gap));bottom:26px;z-index:2;
    width:calc(var(--box-w) - var(--zoom-w) - var(--box-gap));max-width:none;""", "map/index.html")

index = once(index, """  #legend[hidden]{display:none}""", """  #legend[hidden]{display:none}
  /* The zoom buttons, pinned to the legend's line rather than stacked above
     the scale bar and the attribution. */
  .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group{position:absolute;right:9px;bottom:26px;margin:0;z-index:3}

  /* The grip each box is pulled by. */
  .pull-grip{flex:none;height:9px;cursor:ns-resize;position:relative;touch-action:none}
  .pull-grip::before{content:"";position:absolute;left:50%;top:50%;width:34px;height:2px;margin:-1px 0 0 -17px;
    border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
  .pull-grip:hover::before{border-color:var(--dim)}
  .panel,#legend{overflow:auto}
  /* The grip stays on the box's edge while its contents scroll under it. */
  .panel .pull-grip{position:sticky;bottom:0;margin-top:8px;background:rgba(31,28,21,.94)}
  #legend .pull-grip{position:sticky;top:0;background:rgba(17,21,15,.88)}""", "map/index.html")

# ---------------------------------------------------------------- the news wires box takes the same width

wire = once(wire, """  width:min(440px,calc(100vw - 18px));display:flex;flex-direction:column;""",
            """  width:min(var(--box-w,290px),calc(100vw - 18px));display:flex;flex-direction:column;""", "map/wire.js")

# ---------------------------------------------------------------- app.js

# The scale bar shared the bottom right corner and lay across the legend.
app = once(app, """map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-right");""",
           """map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");""", "map/app.js")

app = once(app, """map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");""",
           """map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");""", "map/app.js")

app = once(app, """const SPACE_URL = "https://eyes.nasa.gov/apps/solar-system/#/earth?embed=true&logo=false&menu=false&featured=false";""",
           """const SPACE_URL = "https://eyes.nasa.gov/apps/solar-system/#/earth?featured=false&detailPanel=false" +
  "&logo=false&shareButton=false&collapseSettingsOptions=true&surfaceMapTiling=true&hd=true" +
  "&minorMoons=true&heliosphere=true&lighting=natural";""", "map/app.js")

PULL = r'''
/* ---------- boxes that can be pulled open and shut ---------- */

// Where a drag leaves a box. Dragging away from the edge the box is anchored
// to makes it taller: down for the panel, which hangs from the top of the
// window, up for the legend and the news wires, which stand on the bottom.
function pullHeight(startHeight, dy, edge, min, max) {
  const h = startHeight + (edge === "top" ? -dy : dy);
  return Math.max(min, Math.min(max, h));
}

const PULL_MIN = 42;

function makePullable(el, edge) {
  if (!el || !el.dataset || el.dataset.pullable || typeof document.createElement !== "function") return;
  el.dataset.pullable = "1";
  const grip = document.createElement("div");
  grip.className = "pull-grip";
  grip.title = "Drag to pull this open or shut. Double-click to put it back.";
  const place = () => {
    if (grip.parentNode === el && (edge === "top" ? el.firstChild === grip : el.lastChild === grip)) return;
    if (edge === "top") el.insertBefore(grip, el.firstChild); else el.appendChild(grip);
  };
  place();
  // The legend and the wires rewrite their own contents; the grip goes back.
  if (typeof MutationObserver === "function") new MutationObserver(place).observe(el, { childList: true });

  let from = 0, height = 0;
  const ceiling = () => Math.max(PULL_MIN + 20, (typeof window !== "undefined" ? window.innerHeight : 800) - 60);
  const move = (e) => {
    const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : from);
    el.style.maxHeight = "none";
    el.style.height = pullHeight(height, y - from, edge, PULL_MIN, ceiling()) + "px";
  };
  const stop = () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", stop);
  };
  grip.addEventListener("pointerdown", (e) => {
    from = e.clientY;
    height = el.getBoundingClientRect ? el.getBoundingClientRect().height : 0;
    if (e.preventDefault) e.preventDefault();
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
  });
  grip.addEventListener("dblclick", () => { el.style.height = ""; el.style.maxHeight = ""; });
}

// The news wires box is built by wire.js, which runs after this file.
function pullableBoxes() {
  makePullable(document.querySelector(".panel"), "bottom");
  makePullable(document.getElementById("legend"), "top");
  let tries = 0;
  const wireLater = () => {
    const w = document.getElementById("wire");
    if (w) { makePullable(w, "top"); return; }
    if (++tries < 25 && typeof setTimeout === "function") setTimeout(wireLater, 300);
  };
  wireLater();
}
'''
app = once(app, "\nfunction viewPanelHtml() {", PULL + "\nfunction viewPanelHtml() {", "map/app.js")
app = once(app, """  watchForLeaving();
  watchSky();""", """  watchForLeaving();
  watchSky();
  pullableBoxes();""", "map/app.js")

# ---------------------------------------------------------------- tests

TESTS = r'''
console.log("\nthe boxes");
{
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("one width is declared for every box", /--box-w:\s*290px/.test(index) && /--zoom-w:\s*29px/.test(index));
  check("the layer panel takes it", /\.panel\{[\s\S]{0,200}width:var\(--box-w\)/.test(index));
  check("the news wires box takes it too, no longer 440px",
        /width:min\(var\(--box-w,290px\),calc\(100vw - 18px\)\)/.test(wireSrc) && !/440px/.test(wireSrc));
  check("the legend is narrowed by the zoom buttons and the gap",
        /#legend\{[\s\S]{0,260}width:calc\(var\(--box-w\) - var\(--zoom-w\) - var\(--box-gap\)\)/.test(index) &&
        /#legend\{position:absolute;right:calc\(9px \+ var\(--zoom-w\) \+ var\(--box-gap\)\)/.test(index));
  check("the zoom buttons sit in the bottom right corner, level with the legend",
        /NavigationControl\([^)]*\), "bottom-right"\)/.test(src) &&
        /\.maplibregl-ctrl-bottom-right \.maplibregl-ctrl-group\{position:absolute;right:9px;bottom:26px/.test(index));
  check("Eyes opens without the View 3D prompt or its panels",
        /detailPanel=false/.test(src) && /featured=false/.test(src) && !/embed=true/.test(src));
  const pull = new Function(src.match(/function pullHeight[\s\S]*?\n}\n/)[0] + "; return pullHeight;")();
  check("pulling up makes a box that stands on the bottom taller", pull(200, -60, "top", 42, 900) === 260);
  check("pulling down makes one that hangs from the top taller", pull(200, 60, "bottom", 42, 900) === 260);
  check("a box cannot be pulled past the window or shut past its grip",
        pull(200, 5000, "bottom", 42, 900) === 900 && pull(200, 5000, "top", 42, 900) === 42);
  check("every box gets a grip", /makePullable\(document\.querySelector\("\.panel"\), "bottom"\)/.test(src) &&
        /makePullable\(document\.getElementById\("legend"\), "top"\)/.test(src) && /getElementById\("wire"\)/.test(src) &&
        /\.pull-grip\{[^}]*cursor:ns-resize/.test(index));
  check("the scale bar no longer lies across the legend", /ScaleControl\([^)]*\), "bottom-left"\)/.test(src));
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

# The address changed, so the tests that check it change with it.
test = test.replace('/^https:\\/\\/eyes\\.nasa\\.gov\\/apps\\/solar-system\\/#\\/earth\\?embed=true/',
                    '/^https:\\/\\/eyes\\.nasa\\.gov\\/apps\\/solar-system\\/#\\/earth\\?featured=false/')

# The harness's stub elements need enough of an element to carry a grip.
test = once(test, """    querySelector: (sel) => (states[sel] ||= { textContent: "" }),""",
            """    querySelector: (sel) => (states[sel] ||= { textContent: "", dataset: {}, style: {},
      appendChild() {}, insertBefore() {}, addEventListener() {}, getBoundingClientRect: () => ({ height: 200 }) }),""",
            "map/test.mjs")
test = once(test, """      dataset: {}, after() {}, replaceWith() {}, closest: () => null,""",
            """      dataset: {}, after() {}, replaceWith() {}, closest: () => null,
      insertBefore() {}, getBoundingClientRect: () => ({ height: 200 }), style: {},""", "map/test.mjs")
test = once(test, """    createElement: () => ({
      className: "", innerHTML: "", dataset: {},""",
            """    createElement: () => ({
      className: "", innerHTML: "", dataset: {}, style: {}, title: "",
      addEventListener() {}, insertBefore() {}, getBoundingClientRect: () => ({ height: 200 }),""",
            "map/test.mjs")

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
WIRE.write_text(wire, encoding="utf-8")
print("Boxes share one width; zoom buttons beside the legend; every box pullable; Eyes address updated.")
