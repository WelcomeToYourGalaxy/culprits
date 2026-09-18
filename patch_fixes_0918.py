#!/usr/bin/env python3
"""
The smaller fixes, 18 September.

1. Heavy shape layers load their long text on click, not with the shapes.
   pipeline/shapes/build_shapes.py now writes each layer in two files:
     <id>.geojson        the shapes, with short fields only (fast to tick on)
     <id>.details.json   each shape's long lists and the map's own text,
                         fetched the first time a shape in that layer is clicked
   Nothing is dropped: every field still shows in the box, it just arrives on
   the click. move_to_tile_repos.sh moves the new file with its shapes.
2. The test stand-in for the PMTiles library gains the two parts the map uses,
   so the "PMTiles is not a constructor" lines stop. (The live page loads the
   real library and never printed them.)

Run from the repo root:  python3 patch_fixes_0918.py
Every edit is anchored on exact text; if an anchor is missing nothing is written.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
P = {k: ROOT / v for k, v in {"app": "map/app.js", "test": "map/test.mjs", "shapes": "pipeline/shapes/build_shapes.py",
                               "move": "pipeline/sitemaps/move_to_tile_repos.sh"}.items()}
T = {k: p.read_text(encoding="utf-8") for k, p in P.items()}
if "function loadShapeDetails(" in T["app"]:
    sys.exit("Already applied - nothing to do.")


def once(k, old, new):
    if T[k].count(old) != 1:
        sys.exit(f"Could not find the expected text in {P[k].relative_to(ROOT)} ({old.strip()[:70]!r}). Nothing was written.")
    T[k] = T[k].replace(old, new)


# --- 1a. the builder splits long text out --------------------------------------
once("shapes", """        path = OUT / f"{e['id']}.geojson"
        path.write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                                   ensure_ascii=False, separators=(",", ":")))""",
"""        # Long text (per-country lists, the map's own words) goes in a second
        # file that the map fetches on the first click, so ticking the layer
        # only downloads the shapes. Every field is kept.
        details = {}
        for i, f in enumerate(feats):
            props = f.get("properties") or {}
            heavy = {k: v for k, v in props.items()
                     if k in ("list", "from_the_map") or (isinstance(v, str) and len(v) > 300)}
            if heavy:
                details[str(i)] = heavy
                light = {k: v for k, v in props.items() if k not in heavy}
                light["_k"] = str(i)
                if "list" in heavy and "entries" not in light:
                    light["entries"] = len(str(heavy["list"]).split("\\n"))
                f["properties"] = light
        path = OUT / f"{e['id']}.geojson"
        path.write_text(json.dumps({"type": "FeatureCollection", "details": bool(details), "features": feats},
                                   ensure_ascii=False, separators=(",", ":")))
        dpath = OUT / f"{e['id']}.details.json"
        if details:
            dpath.write_text(json.dumps(details, ensure_ascii=False, separators=(",", ":")))
        elif dpath.exists():
            dpath.unlink()""")

# --- 1b. the mover takes the details file along --------------------------------
once("move", """            for src, sub, ext in ((root / "map/tiles", "tiles", ".pmtiles"), (root / "map/data/shapes", "shapes", ".geojson")):""",
     """            for src, sub, ext in ((root / "map/tiles", "tiles", ".pmtiles"), (root / "map/data/shapes", "shapes", ".geojson"),
                                  (root / "map/data/shapes", "shapes", ".details.json")):""")

# --- 1c. the map fetches the details on the first click ------------------------
once("app", """    new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
      .setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(map);
  });""", """    const out = html(e.features[0].properties);
    const pop = new maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(e.lngLat);
    if (out && typeof out.then === "function") {
      // The box's long text is fetched on this first click; say so meanwhile.
      pop.setHTML(`<div class="meta">loading\\u2026</div>`).addTo(map);
      out.then((h) => pop.setHTML(h))
        .catch((err) => pop.setHTML(`<div class="meta">could not load this box (${shapeText(err.message)})</div>`));
    } else {
      pop.setHTML(out).addTo(map);
    }
  });""")

once("app", """  const popup = (p) => {
    const title = p.name || p.country || p.title || cfg.name;""",
"""  const render = (p) => {
    const title = p.name || p.country || p.title || cfg.name;""")
once("app", """  bindHtmlPopup(`${cfg.id}-fill`, popup);
  bindHtmlPopup(`${cfg.id}-line`, popup);
  bindHtmlPopup(`${cfg.id}-pt`, popup);""",
"""  // A layer built with its long text kept apart reads it on the first click.
  const popup = (p) => (data.details && p._k != null
    ? loadShapeDetails(url).then((d) => render(Object.assign({}, p, d[p._k] || {})))
    : render(p));
  bindHtmlPopup(`${cfg.id}-fill`, popup);
  bindHtmlPopup(`${cfg.id}-line`, popup);
  bindHtmlPopup(`${cfg.id}-pt`, popup);""")
once("app", "/* ---------- the site's own maps, each shown as its own map ---------- */",
"""const shapeDetails = new Map();
function loadShapeDetails(url) {
  const at = url.replace(/\\.geojson$/, ".details.json");
  if (!shapeDetails.has(at)) {
    const p = fetch(at).then((r) => { if (!r.ok) throw new Error(`${r.status} at ${at}`); return r.json(); });
    p.catch(() => shapeDetails.delete(at));   // a failed load may be retried
    shapeDetails.set(at, p);
  }
  return shapeDetails.get(at);
}

/* ---------- the site's own maps, each shown as its own map ---------- */""")

# --- 2. the test stand-in ------------------------------------------------------
once("test", """  globalThis.pmtiles = { Protocol: function () { return { tile: () => {} }; } };""",
"""  globalThis.pmtiles = { Protocol: function () { return { tile: () => {}, add: () => {} }; },
    PMTiles: function (url) { this.url = url; this.getMetadata = async () => ({}); this.getHeader = async () => ({}); } };""")

TESTS = r'''
console.log("\nheavy shape layers, lighter");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const b = fs.readFileSync(path.join(HERE, "..", "pipeline", "shapes", "build_shapes.py"), "utf8");
  check("the builder keeps long text in a details file", /\.details\.json/.test(b) && /"details": bool\(details\)/.test(b));
  check("…and drops no field: what leaves the shape goes to the details", /details\[str\(i\)\] = heavy/.test(b));
  check("the map reads the details on the first click, once per layer",
        /function loadShapeDetails\(/.test(src) && /shapeDetails\.has\(at\)/.test(src));
  check("a box waits for its details rather than showing without them",
        /typeof out\.then === "function"/.test(src) && /loading\\u2026/.test(src));
  check("the mover carries the details file", /\.details\.json/.test(fs.readFileSync(path.join(HERE, "..", "pipeline", "sitemaps", "move_to_tile_repos.sh"), "utf8")));
}
'''
anchor = '\nconsole.log(`\\n${pass} passed'
if T["test"].count(anchor) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
T["test"] = T["test"].replace(anchor, TESTS + anchor)

for k, p in P.items():
    p.write_text(T[k], encoding="utf-8")
print("Applied. Next: python3 pipeline/shapes/build_shapes.py, then bash pipeline/sitemaps/move_to_tile_repos.sh")
