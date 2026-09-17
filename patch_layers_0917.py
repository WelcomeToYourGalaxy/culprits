#!/usr/bin/env python3
"""
Three map changes, applied in place. Edits map/app.js, map/test.mjs and
sources.json rather than replacing them, because other sessions edit those
files. Every edit is anchored on exact text and checked before anything is
written: if one anchor has moved, nothing is changed at all.

1. Deforestation and disturbance alerts are drawn in one muted colour each.
   GFW paints its alert tiles itself; rotating their hue left them glaring.
   Every tile now goes through the latclip protocol, which already opens the
   tile to cut it at 30°, and each alert pixel is given the layer's own colour
   (the same colour the legend shows). A tile that is mostly one flat colour
   has that colour cleared first, so a wash over the whole extent cannot come
   back as a solid band. Wide out the alerts are lighter; they reach full
   strength by zoom 8. Which pixels are alerts does not change.

2. Oil slicks: nothing is counted square by square any more. Below zoom 7 the
   layer asks Cerulean one question — how many slicks in total — and states
   the answer in the panel. That removes the grey squares and the cross, and
   switching the layer on at world view no longer waits on dozens of slow
   count requests. Shapes still draw from zoom 7.

3. The site's other maps: one layer each, in a new group, "The site's other
   maps". Their data comes from pipeline/sitemaps (see the note there). The
   Carbon major HQs row, listed but never built, now reads from the same
   harvester.

Run from the repo root:   python3 patch_layers_0917.py
Undo:                     cp /tmp/culprits-0917-backup/* back into place
"""

import json
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP = ROOT / "map" / "app.js"
TEST = ROOT / "map" / "test.mjs"
SOURCES = ROOT / "sources.json"
REGISTRY = ROOT / "pipeline" / "sitemaps" / "registry.json"
BACKUP = pathlib.Path("/tmp/culprits-0917-backup")


def swap(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit(f"stopped: {label} — expected the anchor once, found it {n} times. Nothing was written.")
    return text.replace(old, new, 1)


def main():
    for f in (APP, TEST, SOURCES, REGISTRY):
        if not f.exists():
            sys.exit(f"missing {f} — run from the repo root, with pipeline/sitemaps in place")
    app = APP.read_text(encoding="utf-8")
    test = TEST.read_text(encoding="utf-8")
    if "SITE_MAPS" in app:
        sys.exit("app.js already has these changes — nothing to do.")
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))["maps"]

    # ---------------------------------------------------------------- 1. GFW
    app = swap(app,
        '{ id:"gfw",                  name:"Deforestation alerts — tropics",  unit:"GLAD + RADD, last 30 days", colour:"#55705E",',
        '{ id:"gfw",                  name:"Deforestation alerts — tropics",  unit:"GLAD + RADD, last 30 days", colour:"#8A4F46",',
        "gfw colour")
    app = swap(app,
        '''    // GFW paint these blue. +100 landed on magenta, which places the source at
    // roughly 210 degrees, so -90 is the rotation that reaches the muted green
    // this map uses for forest loss. Measured off the wrong answer rather than
    // guessed twice.
    rasterAdjust: { "raster-hue-rotate": -90, "raster-saturation": -0.35 },
    note: "Pan-tropical''',
        '''    // GFW paint these tiles themselves, and no rotation of their palette read
    // as anything but glaring. Each alert pixel is given this layer's colour
    // instead, in the latclip protocol. See recolorAlerts.
    recolor: "#8A4F46",
    note: "Pan-tropical''',
        "gfw rasterAdjust")
    app = swap(app,
        '{ id:"gfw_dist",             name:"Disturbance alerts — global",     unit:"DIST-ALERT, last 30 days", colour:"#6E7A55",',
        '{ id:"gfw_dist",             name:"Disturbance alerts — global",     unit:"DIST-ALERT, last 30 days", colour:"#7A5B4E",',
        "gfw_dist colour")
    app = swap(app,
        '''    tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=30", off: true,
    rasterAdjust: { "raster-hue-rotate": -90, "raster-saturation": -0.35 },''',
        '''    tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=30", off: true,
    recolor: "#7A5B4E",''',
        "gfw_dist rasterAdjust")
    app = swap(app,
        '{ id:"gfw_dist_year",        name:"Disturbance alerts — past year",  unit:"DIST-ALERT, last 365 days", colour:"#7E6F4E",',
        '{ id:"gfw_dist_year",        name:"Disturbance alerts — past year",  unit:"DIST-ALERT, last 365 days", colour:"#6E5E57",',
        "gfw_dist_year colour")
    app = swap(app,
        '''    tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=365", off: true,''',
        '''    tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=365", off: true,
    recolor: "#6E5E57",''',
        "gfw_dist_year recolor")

    app = swap(app,
        '''// latclip://<south>,<north>/<https URL without the scheme>
maplibregl.addProtocol("latclip", async (params, abortController) => {
  const m = params.url.match(/^latclip:\\/\\/(-?[\\d.]+),(-?[\\d.]+)\\/(.*)$/);
  const url = "https://" + m[3];''',
        '''// Give every alert pixel one colour, keeping its transparency.
//
// A tile that is mostly a single flat colour is carrying a wash rather than
// alerts — alerts are scattered, a wash is uniform — so that colour is cleared
// before anything is painted. Kept apart from the canvas so it can be tested
// on a plain array.
function recolorAlerts(px, rgb) {
  const counts = new Map();
  let opaque = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    opaque++;
    const k = (px[i] << 24 | px[i + 1] << 16 | px[i + 2] << 8 | px[i + 3]) >>> 0;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let wash = null;
  for (const [k, n] of counts) if (n > (px.length / 4) * 0.6) wash = k;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const k = (px[i] << 24 | px[i + 1] << 16 | px[i + 2] << 8 | px[i + 3]) >>> 0;
    if (k === wash) { px[i + 3] = 0; continue; }
    px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2];
  }
  return { opaque, washCleared: wash !== null };
}

// latclip://<south>,<north>[,<RRGGBB>]/<https URL without the scheme>
maplibregl.addProtocol("latclip", async (params, abortController) => {
  const m = params.url.match(/^latclip:\\/\\/(-?[\\d.]+),(-?[\\d.]+)(?:,([0-9A-Fa-f]{6}))?\\/(.*)$/);
  const url = "https://" + m[4];
  const tint = m[3] ? [0, 2, 4].map((i) => parseInt(m[3].slice(i, i + 2), 16)) : null;''',
        "latclip header")
    app = swap(app,
        '''  // Most tiles sit wholly inside the band; those go through untouched.
  if (!clipTileRows(z, y, 256, south, north).length) return { data: buf };''',
        '''  // Most tiles sit wholly inside the band; untinted, those go through untouched.
  if (!tint && !clipTileRows(z, y, 256, south, north).length) return { data: buf };''',
        "latclip early return")
    app = swap(app,
        '''  for (const [a, b] of clipTileRows(z, y, bmp.height, south, north)) {
    ctx.clearRect(0, a, bmp.width, b - a);
  }''',
        '''  for (const [a, b] of clipTileRows(z, y, bmp.height, south, north)) {
    ctx.clearRect(0, a, bmp.width, b - a);
  }
  if (tint) {
    const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
    recolorAlerts(img.data, tint);
    ctx.putImageData(img, 0, 0);
  }''',
        "latclip recolor")
    app = swap(app,
        '''    tiles: [(cfg.clipToBounds && cfg.bounds
              ? WORKER.replace(/^https:\\/\\//, `latclip://${cfg.bounds[1]},${cfg.bounds[3]}/`)
              : WORKER) +''',
        '''    tiles: [((cfg.clipToBounds && cfg.bounds) || cfg.recolor
              ? WORKER.replace(/^https:\\/\\//,
                  `latclip://${cfg.clipToBounds && cfg.bounds ? cfg.bounds[1] : -90},` +
                  `${cfg.clipToBounds && cfg.bounds ? cfg.bounds[3] : 90}` +
                  `${cfg.recolor ? "," + cfg.recolor.slice(1) : ""}/`)
              : WORKER) +''',
        "tile url")
    app = swap(app,
        '''      "raster-opacity": 0.85,''',
        '''      // Recoloured alerts are lighter wide out, where a month of them over a
      // continent would otherwise fill it, and full strength from zoom 8.
      "raster-opacity": cfg.recolor
        ? ["interpolate", ["linear"], ["zoom"], 2, 0.5, 8, 0.85] : 0.85,''',
        "raster opacity")

    # ---------------------------------------------------------- 2. Cerulean
    app = swap(app,
        "Wide out, each shaded square is a live count of the slicks somewhere inside it; shapes draw from zoom 7. A square marked with a dashed edge",
        "Wide out the panel gives the total number of detections; shapes draw from zoom 7, where a slick is large enough to see. From there, a square marked with a dashed edge",
        "cerulean note")
    app = swap(app,
        '''async function refreshCerulean(cfg) {
  if ((visibility.get(cfg.id) || "visible") !== "visible") return;   // off: ask nothing
  const counts = map.getSource(`${cfg.id}-counts`);
  const caps = map.getSource(`${cfg.id}-caps`);
  if (!counts || !caps) return;''',
        '''// One number for the whole collection, asked once per page view.
const ceruleanTotals = new Map();     // id -> number, or a pending promise
async function ceruleanTotal(cfg) {
  const url = `${CERULEAN}/collections/${cfg.collection}/items?limit=0`;
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status}`);
      const matched = (await r.json()).numberMatched;
      if (typeof matched !== "number") throw new Error("no count returned");
      return matched;
    } catch (err) {
      if (attempt >= 1) throw err;
    }
  }
}

async function refreshCerulean(cfg) {
  if ((visibility.get(cfg.id) || "visible") !== "visible") return;   // off: ask nothing
  const counts = map.getSource(`${cfg.id}-counts`);
  const caps = map.getSource(`${cfg.id}-caps`);
  if (!counts || !caps) return;

  // Wide out, no squares. At world view four squares covered the planet, each
  // shaded near full by tens of thousands of slicks — a grey wash with a cross
  // where their edges met — and each waited on Cerulean's slowest query. One
  // total says what is true at that scale without drawing anything misleading.
  if (map.getZoom() < cfg.drawFrom) {
    const empty = { type: "FeatureCollection", features: [] };
    counts.setData(empty);
    caps.setData(empty);
    const total = ceruleanTotals.get(cfg.id);
    if (typeof total === "number") {
      setLayerState(cfg.id, `${total.toLocaleString()} potential slicks since January 2023 — ` +
                            `zoom in to ${cfg.drawFrom} to draw them`);
    } else {
      setLayerState(cfg.id, `zoom in to ${cfg.drawFrom} to draw slicks`);
      if (total === undefined) {
        ceruleanTotals.set(cfg.id, ceruleanTotal(cfg).then(
          (n) => { ceruleanTotals.set(cfg.id, n); refreshCerulean(cfg); },
          () => { ceruleanTotals.set(cfg.id, null); }));
      }
    }
    return;
  }''',
        "refreshCerulean")

    # -------------------------------------------------------- 3. site maps
    app = swap(app,
        '{ id:"carbon_majors",        name:"Carbon major HQs",        unit:"company headquarters", colour:"#7E6B8F", route:"pmtiles", ready:false },',
        '{ id:"carbon_majors",        name:"Carbon major HQs",        unit:"company headquarters", colour:"#7E6B8F", route:"pmtiles", ready:true, off: true,\n'
        '    note: "From the Destruction page\'s Carbon Majors headquarters map (maps repo): the addresses written into that map." },',
        "carbon_majors row")
    children = [m for m in registry if m["id"] != "carbon_majors"]
    lines = ",\n".join(
        "    { id: %s, name: %s, unit: %s, colour: %s, route: \"pmtiles\", ready: true, lazy: true, archiveUrl: null,\n      note: %s }"
        % tuple(json.dumps(v, ensure_ascii=False) for v in (m["id"], m["name"], m["unit"], m["colour"], m["note"]))
        for m in children)
    app = swap(app,
        "const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY];",
        "// The site's own maps, one layer each. Generated from\n"
        "// pipeline/sitemaps/registry.json by patch_layers_0917.py; the places and\n"
        "// popup text are read from each map by pipeline/sitemaps/extract.mjs.\n"
        "const SITE_MAPS = {\n  id: \"site_maps\",\n  name: \"The site's other maps\",\n  group: true,\n  ready: true,\n"
        "  children: [\n" + lines + ",\n  ],\n};\n\n"
        "const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS];",
        "GROUPS")

    # ---------------------------------------------------------------- tests
    test = swap(test,
        '''  const countUrls = fetched.filter((u) => String(u).includes("limit=0"));
  check("switching on asks Cerulean for counts, with no geometry", countUrls.length >= 2 &&
        countUrls.every((u) => /\\/collections\\/public\\.slick_plus\\/items\\?bbox=/.test(u)), countUrls.join(" "));
  check("a count that times out once is asked again, not given up", calls === 2, `calls=${calls}`);
  const pts = map.sources.get("cerulean_slicks-counts")._data;
  const caps = map.sources.get("cerulean_slicks-caps")._data;
  check("the count reaches the map", pts && pts.features.length === 1 && pts.features[0].properties.n === 171473);
  check("a square over 10,000 is marked", caps && caps.features.length === 1);''',
        '''  await new Promise((r) => setTimeout(r, 20));
  const countUrls = fetched.filter((u) => String(u).includes("limit=0"));
  check("at world view switching on asks one total, not a count per square",
        countUrls.length >= 1 && countUrls.every((u) => /\\/collections\\/public\\.slick_plus\\/items\\?limit=0$/.test(u)),
        countUrls.join(" "));
  check("a total that times out once is asked again, not given up", calls === 2, `calls=${calls}`);
  const pts = map.sources.get("cerulean_slicks-counts")._data;
  const caps = map.sources.get("cerulean_slicks-caps")._data;
  check("nothing is shaded at world view", !pts || pts.features.length === 0);
  check("nothing is marked at world view", !caps || caps.features.length === 0);''',
        "test cerulean")
    test = swap(test,
        '''        url.startsWith("latclip://-30,30/") && url.includes("/gfw_tile/{z}/{x}/{y}"), url);''',
        '''        url.startsWith("latclip://-30,30,8A4F46/") && url.includes("/gfw_tile/{z}/{x}/{y}"), url);
  const ra = src.indexOf("function recolorAlerts"), rb = src.indexOf("// latclip://<south>");
  const recolorAlerts = new Function(src.slice(ra, rb) + "; return recolorAlerts;")();
  const scattered = new Uint8ClampedArray(400 * 4);
  for (let i = 0; i < 40; i++) scattered.set([60, 120, 230, 255], i * 4 * 10);
  recolorAlerts(scattered, [138, 79, 70]);
  check("alert pixels take the layer's colour and keep their transparency",
        scattered[0] === 138 && scattered[1] === 79 && scattered[2] === 70 && scattered[3] === 255 && scattered[7] === 0);
  const washed = new Uint8ClampedArray(400 * 4).fill(255);
  const res = recolorAlerts(washed, [138, 79, 70]);
  check("a tile that is one flat colour is treated as a wash and cleared", res.washCleared && washed[3] === 0);''',
        "test gfw")


    test = swap(test,
        """  check("all four groups are registered",
        /GROUPS = \\[CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY\\]/.test(src));""",
        """  check("all five groups are registered",
        /GROUPS = \\[CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS\\]/.test(src));""",
        "test groups")

    # --------------------------------------------------------- sources.json
    reg = json.loads(SOURCES.read_text(encoding="utf-8"))
    have = {s["id"] for s in reg["sources"]}
    added = 0
    for m in registry:
        if m["id"] in have:
            continue
        reg["sources"].append({
            "id": m["id"], "name": m["name"], "mode": "bulk", "auth": "none", "route": "pmtiles",
            "bulk": m.get("url") or f"https://www.welcometoyourgalaxy.com/{m['page']}.html",
            "licence": "Welcome to Your Galaxy's own map; the sources it cites carry their own terms",
            "licence_verified": False, "access_verified": True,
            "notes": m["note"] + " Read by pipeline/sources/_sitemap.py, which runs the map's own scripts; "
                                 "positions and popup text are the map's own. Points only.",
            "layer": {"kind": "point", "value": None, "unit": m["unit"]},
        })
        added += 1

    BACKUP.mkdir(parents=True, exist_ok=True)
    for f in (APP, TEST, SOURCES):
        shutil.copy(f, BACKUP / f.name)
    APP.write_text(app, encoding="utf-8")
    TEST.write_text(test, encoding="utf-8")
    SOURCES.write_text(json.dumps(reg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Patched map/app.js and map/test.mjs; added {added} sources to sources.json "
          f"(backups in {BACKUP}).")


if __name__ == "__main__":
    main()
