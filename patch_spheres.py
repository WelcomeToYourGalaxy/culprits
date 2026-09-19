#!/usr/bin/env python3
"""
The Social Spheres as its own layer: one row, read live from the map's own page
in the maps repo. Its 62 bodies are drawn in the map's own colours, with the
174 links between them (the people who sit in both). Clicking a body opens the
map's OWN card, run by the map's own code: what it is, how you get in, its power
rating, the claims register, everyone named there; click a person for their
card, a sector for its card, and Back to return, exactly as on its page.

Run from the repo root:  python3 patch_spheres.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function addSpheresLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


import re
m = re.search(r'    \{ id: "site_social_spheres", name: "The social spheres \(board and membership links\)"[^\n]*\n(      [^\n]*\n)*?', app)
row_start = app.index('    { id: "site_social_spheres", name: "The social spheres (board and membership links)"')
row_end = app.index("},\n", row_start) + 3
NEW_ROW = ('    { id: "site_social_spheres", name: "The Social Spheres", unit: "bodies and the people between them", colour: "#5E6068", route: "spheres", ready: true, lazy: true,\n'
           '      page: "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/social_spheres.html",\n'
           '      note: "Read live from the map\'s own page in the maps repo; a click opens the map\'s own card, run by its own code." },\n')
app = app[:row_start] + NEW_ROW + app[row_end:]

once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "spheres" ? addSpheresLayer(cfg)''')

JS = r'''/* ---------- The Social Spheres: its bodies on the map, its own card on a click ---------- */
// The map's data is read from its own page; the card is the page itself, loaded
// once into a frame of the same origin (srcdoc) with everything but its card
// hidden, and asked to open a body with its own openNode().
function spheresData(html) {
  const at = html.indexOf("const DATA = ");
  if (at < 0) throw new Error("the page no longer carries its DATA");
  let i = html.indexOf("{", at), depth = 0, inStr = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(html.slice(i, j + 1));
  }
  throw new Error("the page's DATA could not be read");
}
function spheresKinds(html) {
  const m = /const KIND=\{([^;]*)\};/.exec(html);
  const out = {};
  if (m) for (const [, k, c] of m[1].matchAll(/(\w+):\{c:'(#[0-9A-Fa-f]{6})'\}/g)) out[k] = c;
  return out;
}
let spheresFrame = null;
function spheresCard(cfg, html, id) {
  let wrap = document.getElementById("spheres-card");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "spheres-card";
    wrap.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,92vw);height:min(82vh,900px);" +
      "z-index:70;border:1px solid var(--rule);box-shadow:0 10px 40px rgba(0,0,0,.6);background:#EDE6D6";
    spheresFrame = document.createElement("iframe");
    spheresFrame.title = "The Social Spheres";
    spheresFrame.style.cssText = "width:100%;height:100%;border:0;display:block";
    const hide = "<style>body>*:not(#card):not(#scrim){display:none!important}" +
      "#card{position:fixed!important;inset:0!important;left:0!important;top:0!important;width:100%!important;height:100%!important;" +
      "max-width:none!important;max-height:none!important;transform:none!important;display:flex!important}" +
      "#scrim{display:none!important}#recentre,.rsz{display:none!important}</style>";
    spheresFrame.srcdoc = html.replace("</head>", hide + "</head>");
    wrap.appendChild(spheresFrame);
    document.body.appendChild(wrap);
    spheresFrame.addEventListener("load", () => {
      const d = spheresFrame.contentDocument;
      const shut = d && d.getElementById("shut");
      if (shut) shut.addEventListener("click", () => { wrap.hidden = true; });
      spheresOpen(wrap._pending);
    });
  }
  wrap.hidden = false;
  wrap._pending = id;
  spheresOpen(id);
}
function spheresOpen(id) {
  const w = spheresFrame && spheresFrame.contentWindow;
  if (!id || !w || !w.document || w.document.readyState !== "complete") return;
  try { w.eval(`openNode(${JSON.stringify(id)})`); } catch (e) { console.warn("[culprits] social spheres card:", e.message); }
}

async function addSpheresLayer(cfg) {
  let html;
  try {
    const r = await fetch(cfg.page);
    if (!r.ok) throw new Error(`${r.status}`);
    html = await r.text();
  } catch (e) { setLayerState(cfg.id, `the map's page could not be read (${e.message})`); return; }
  let D;
  try { D = spheresData(html); } catch (e) { setLayerState(cfg.id, e.message); return; }
  const kinds = spheresKinds(html);
  const N = new Map(D.nodes.map((n) => [n.id, n]));
  const pts = D.nodes.map((n) => ({ type: "Feature", geometry: { type: "Point", coordinates: [n.lng, n.lat] },
    properties: { id: n.id, name: n.name, c: kinds[n.kind] || cfg.colour, linked: n.linked ? 1 : 0 } }));
  const lines = (D.edges || []).filter((e) => N.has(e.a) && N.has(e.b)).map((e) => ({ type: "Feature",
    geometry: { type: "LineString", coordinates: [[N.get(e.a).lng, N.get(e.a).lat], [N.get(e.b).lng, N.get(e.b).lat]] },
    properties: { w: e.w || 1, a: N.get(e.a).name, b: N.get(e.b).name, n: (e.via || []).length } }));
  map.addSource(`${cfg.id}-lines`, { type: "geojson", data: { type: "FeatureCollection", features: lines } });
  map.addSource(`${cfg.id}-places`, { type: "geojson", data: { type: "FeatureCollection", features: pts } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-lines`,
    paint: { "line-color": "#B6A488", "line-opacity": 0.45, "line-width": ["interpolate", ["linear"], ["get", "w"], 1, 0.6, 20, 3] } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: `${cfg.id}-places`,
    paint: { "circle-color": ["get", "c"], "circle-radius": 6, "circle-stroke-color": "#07100C", "circle-stroke-width": 1.2,
             "circle-opacity": ["case", ["==", ["get", "linked"], 1], 1, 0.5] } });
  map.on("click", `${cfg.id}-pt`, (e) => {
    const f = e.features && e.features[0];
    if (!f) return;
    popupClaimedBy = e.originalEvent || e;
    spheresCard(cfg, html, f.properties.id);
  });
  bindHtmlPopup(`${cfg.id}-line`, (p) => `<b>${escapeHtml(p.a)} \u2194 ${escapeHtml(p.b)}</b><div class="meta">${Number(p.n || p.w)} people sit in both</div>`);
  map.on("mouseenter", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = ""; });
  setLayerState(cfg.id, `${D.nodes.length} bodies, ${(D.people || []).length.toLocaleString()} people, ${lines.length} links`);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nthe Social Spheres, its own map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("the Social Spheres is one row, read live from its own page", /id: "site_social_spheres", name: "The Social Spheres"[^\n]*route: "spheres"/.test(src) &&
        /maps\/main\/social_spheres\.html/.test(src));
  const read = new Function(src.slice(src.indexOf("function spheresData("), src.indexOf("function spheresKinds(")) + "; return spheresData;")();
  const d = read('<script>const DATA = {"nodes":[{"id":"a","what":"a } brace in text"}],"edges":[]};\nconst KIND={};</script>');
  check("its data is read whole, even with braces inside its text", d.nodes[0].what === "a } brace in text");
  const kinds = new Function(src.slice(src.indexOf("function spheresKinds("), src.indexOf("let spheresFrame")) + "; return spheresKinds;")();
  check("its own colours are kept", kinds("const KIND={assoc:{c:'#D6BC82'},club:{c:'#C79A55'}};").club === "#C79A55");
  check("a click opens the map's own card through its own code", /openNode\(\$\{JSON\.stringify\(id\)\}\)/.test(src) && /srcdoc = html/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("The Social Spheres added. Test with: node map/test.mjs")
