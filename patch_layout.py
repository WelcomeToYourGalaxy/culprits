#!/usr/bin/env python3
"""
The screen, rearranged:
- The title box is gone.
- The view and basemap box moves to the top right, with the news wires box
  directly under it; the wires box shrinks to fit the space left.
- The layers box takes the whole left side, down to the "Showing" box, which
  moves to the bottom left under it.
- The layers box reads as a table of contents: every heading is folded shut
  when the page opens, with the number of layers inside it beside the name;
  click a heading to open or close it.

Run from the repo root:  python3 patch_layout.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
P = {"html": ROOT / "map/index.html", "app": ROOT / "map/app.js", "wire": ROOT / "map/wire.js", "test": ROOT / "map/test.mjs"}
T = {k: p.read_text(encoding="utf-8") for k, p in P.items()}
if "toc-body" in T["app"]:
    sys.exit("Already applied - nothing to do.")


def once(k, old, new):
    if T[k].count(old) != 1:
        sys.exit(f"Could not find the expected text in {P[k].name} ({old.strip()[:70]!r}). Nothing was written.")
    T[k] = T[k].replace(old, new)


# --- the page ------------------------------------------------------------------------
once("html", """<div class="left-col">
  <div class="title-box">
    <h1>The Culprits</h1>
  </div>
  <div id="basemaps" class="ctrl-box"></div>
  <div class="panel">""", """<div class="right-col">
  <div id="basemaps" class="ctrl-box"></div>
</div>

<div class="left-col">
  <div class="panel">""")
once("html", """  .left-col{position:absolute;top:16px;left:16px;width:var(--box-w);max-height:calc(100% - 32px);
    display:flex;flex-direction:column;gap:8px;pointer-events:none}""",
"""  .left-col{position:absolute;top:16px;left:16px;width:var(--box-w);bottom:calc(16px + var(--legend-h,0px));
    display:flex;flex-direction:column;gap:8px;pointer-events:none}
  .left-col .panel{flex:1 1 auto}
  /* The view and basemap box, top right; the news wires box sits under it. */
  .right-col{position:absolute;top:16px;right:9px;width:var(--box-w);z-index:3;max-height:48vh;
    display:flex;flex-direction:column;pointer-events:none}
  .right-col > *{pointer-events:auto;background:rgba(31,28,21,.94);border:1px solid var(--rule);
    font-size:13.5px;line-height:1.5;backdrop-filter:blur(6px);overflow:auto}
  .right-col.away{opacity:0;pointer-events:none;transition:opacity .5s ease}
  /* The layers box as a table of contents. */
  .toc-head{display:flex;align-items:baseline;gap:6px;width:100%;background:none;border:0;cursor:pointer;
    font:inherit;text-align:left;padding:3px 0}
  .toc-head:hover{color:#fff}
  .toc-arrow{display:inline-block;width:10px;color:var(--dim);transition:transform .12s}
  .toc-head[aria-expanded="true"] .toc-arrow{transform:rotate(90deg)}
  .toc-n{margin-left:auto;color:var(--dim);font-size:10.5px;font-weight:400;letter-spacing:0;text-transform:none}
  .toc-body{padding-left:6px}
  .toc-body[hidden]{display:none}
  .toc-note{color:var(--dim);font-size:11px;font-style:italic;margin:2px 0 6px 16px}""")
once("html", """  #legend{position:absolute;right:9px;bottom:26px;z-index:2;width:var(--box-w);max-width:none;""",
     """  #legend{position:absolute;left:16px;bottom:16px;z-index:2;width:var(--box-w);max-width:none;""")

# --- the wires box starts under the view box, and no longer steps over the legend ---
once("wire", ".wire{position:absolute;right:9px;top:16px;z-index:3;", ".wire{position:absolute;right:9px;top:var(--wire-top,16px);z-index:3;")
once("wire", "  if (lh || zh) lift += Math.max(lh, zh) + 8;", "  // The legend now sits bottom left, under the layers box, so only the zoom box lifts the wires.\n  if (zh) lift += zh + 8;")

# --- app: away toggle, measurements, the table of contents ----------------------------
once("app", 'for (const sel of [".left-col", "#legend", ".wire", "#zoombox"]) {',
            'for (const sel of [".left-col", ".right-col", "#legend", ".wire", "#zoombox"]) {')
once("app", '  { h: 4, t: "Being combined into one layer, with duplicate places merged" },',
            '  { note: "Being combined into one layer, with duplicate places merged." },')
once("app", """  const frag = document.createDocumentFragment();
  const placed = new Set();
  const heading = (h, t) => {
    const el = document.createElement("div");
    el.className = `panel-h panel-h${h}`;
    el.textContent = t;
    return el;
  };
  for (const item of PANEL_ORDER) {
    if (typeof item === "object") { frag.appendChild(heading(item.h, item.t)); continue; }
    const nodes = panelNodes(box, item);
    nodes.forEach((n) => frag.appendChild(n));
    if (nodes.length) placed.add(item);
  }""", """  const frag = document.createDocumentFragment();
  const placed = new Set();
  // Each heading is a section that folds; the rows under it go in its body,
  // nested by level. Every section starts folded shut.
  const stack = [{ level: 0, body: frag }];
  const heading = (h, t) => {
    while (stack.length > 1 && stack[stack.length - 1].level >= h) stack.pop();
    const sec = document.createElement("div");
    sec.className = `toc-sec toc-l${h}`;
    const head = document.createElement("button");
    head.type = "button";
    head.className = `toc-head panel-h panel-h${h}`;
    head.setAttribute("aria-expanded", "false");
    head.innerHTML = `<span class="toc-arrow">\\u25B8</span><span class="toc-t">${escapeHtml(t)}</span><span class="toc-n"></span>`;
    const body = document.createElement("div");
    body.className = "toc-body";
    body.hidden = true;
    head.addEventListener("click", (e) => {
      e.preventDefault();
      body.hidden = !body.hidden;
      head.setAttribute("aria-expanded", String(!body.hidden));
    });
    sec.appendChild(head);
    sec.appendChild(body);
    stack[stack.length - 1].body.appendChild(sec);
    stack.push({ level: h, body });
    return sec;
  };
  const into = () => stack[stack.length - 1].body;
  for (const item of PANEL_ORDER) {
    if (typeof item === "object" && item.note) {
      const n = document.createElement("div");
      n.className = "toc-note";
      n.textContent = item.note;
      into().appendChild(n);
      continue;
    }
    if (typeof item === "object") { heading(item.h, item.t); continue; }
    const nodes = panelNodes(box, item);
    nodes.forEach((n) => into().appendChild(n));
    if (nodes.length) placed.add(item);
  }""")
once("app", """  if (rest.childNodes.length) { box.appendChild(heading(1, "Not yet placed")); box.appendChild(rest); }""",
"""  if (rest.childNodes.length) {
    stack.length = 1;
    const sec = heading(1, "Not yet placed");
    box.appendChild(sec);
    sec.querySelector(".toc-body").appendChild(rest);
  }
  // Beside each heading, how many layers are inside it.
  for (const sec of box.querySelectorAll(".toc-sec")) {
    const n = sec.querySelectorAll("[data-layer], [data-gm]").length;
    const el = sec.querySelector(".toc-n");
    if (el) el.textContent = n ? String(n) : "none yet";
  }""")
once("app", """map.on("load", () => setTimeout(arrangePanel, 0));""", """map.on("load", () => setTimeout(arrangePanel, 0));

// The layers box runs down to the "Showing" box; the news wires box starts
// under the view box. Both follow those boxes' heights as they change.
function trackBoxHeights() {
  const root = document.documentElement;
  const legend = document.getElementById("legend");
  const view = document.getElementById("basemaps");
  if (!root || !root.style || typeof ResizeObserver === "undefined") return;
  const set = () => {
    const lh = legend && !legend.hidden ? legend.getBoundingClientRect().height : 0;
    root.style.setProperty("--legend-h", lh ? Math.round(lh + 8) + "px" : "0px");
    const vh = view ? view.getBoundingClientRect().height : 0;
    root.style.setProperty("--wire-top", Math.round(16 + vh + 8) + "px");
  };
  const ro = new ResizeObserver(set);
  if (legend) ro.observe(legend);
  if (view) ro.observe(view);
  if (legend && typeof MutationObserver !== "undefined") new MutationObserver(set).observe(legend, { attributes: true, attributeFilter: ["hidden"] });
  set();
}
map.on("load", () => setTimeout(trackBoxHeights, 0));""")


# --- earlier tests that described the old layout -----------------------------------
once("test", r"""/#legend\{position:absolute;right:9px;bottom:26px;z-index:2;width:var\(--box-w\)/.test(index)""",
             r"""/#legend\{position:absolute;left:16px;bottom:16px;z-index:2;width:var\(--box-w\)/.test(index)""")
once("test", r"""/\.wire\{position:absolute;right:9px;top:16px;/.test(wireSrc)""",
             r"""/\.wire\{position:absolute;right:9px;top:var\(--wire-top,16px\);/.test(wireSrc)""")
once("test", r"""  check("the name, the settings and the layers are three boxes", /class="left-col"/.test(index) &&
        /<div class="title-box">/.test(index) && /id="basemaps" class="ctrl-box"/.test(index));""",
             r"""  check("the settings box is on the right and the layers box on the left", /class="left-col"/.test(index) &&
        !/<div class="title-box">/.test(index) && /class="right-col">\s*<div id="basemaps" class="ctrl-box"/.test(index));""")
once("test", r"""/\[".left-col", "#legend", ".wire", "#zoombox"\]/.test(src)""",
             r"""/\[".left-col", ".right-col", "#legend", ".wire", "#zoombox"\]/.test(src)""")

TESTS = r'''
console.log("\nthe screen, rearranged");
{
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const wire = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  check("the title box is gone", !/class="title-box"/.test(html));
  check("the view and basemap box sits top right", /<div class="right-col">\s*<div id="basemaps"/.test(html));
  check("the wires box starts under it", /top:var\(--wire-top,16px\)/.test(wire) && /--wire-top/.test(src));
  check("the Showing box sits bottom left", /#legend\{position:absolute;left:16px;bottom:16px/.test(html));
  check("the layers box runs down to it", /bottom:calc\(16px \+ var\(--legend-h,0px\)\)/.test(html));
  check("every heading starts folded shut", /body\.hidden = true;/.test(src) && /aria-expanded", "false"/.test(src));
  check("each heading shows how many layers it holds", /toc-n/.test(src));
  check("leaving for space hides the right box too", /"\.right-col", "#legend"/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if T["test"].count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
T["test"] = T["test"].replace(anchor_t, TESTS + anchor_t)
for k, p in P.items():
    p.write_text(T[k], encoding="utf-8")
print("Screen rearranged. Test with: node map/test.mjs")
