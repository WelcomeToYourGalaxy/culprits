#!/usr/bin/env python3
"""
Coral reefs at every zoom.

- Wider than zoom 12, the Coral reef habitat row now draws the Allen Coral
  Atlas's own picture of the same reefs (its map server renders it for any
  area), in the row's coral colour. From zoom 12 in, the clickable habitat
  shapes take over as before.
- A second, separate coral source joins "Other organisations' maps": UNEP-WCMC's
  Global Distribution of Warm-water Coral Reefs, drawn live by its own map server
  at every zoom, with a click asking the server what is there.

Run from the repo root:  python3 patch_coral_wide.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if 'addProtocol("tint"' in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


# The Atlas's picture, below the shapes' zoom.
once("""  addCoralShapes(cfg, false);
  bindHtmlPopup(`${cfg.id}-fill`, (p) =>""",
"""  addCoralShapes(cfg, false);
  // Wider out, the Atlas's own picture of the same reefs, from its map server,
  // in the coral colour (the server draws them black).
  map.addSource(`${cfg.id}-wide`, { type: "raster", tileSize: 256, attribution: cfg.attribution || "",
    tiles: [`tint://${CORAL_CLASSES["Coral/Algae"].slice(1)}/allencoralatlas.org/geoserver/ows?SERVICE=WMS&VERSION=1.1.1` +
            `&REQUEST=GetMap&LAYERS=coral-atlas:benthic_data_verbose&STYLES=&SRS=EPSG:3857&BBOX={bbox-epsg-3857}` +
            `&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`] });
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: `${cfg.id}-wide`, maxzoom: cfg.drawFrom,
    layout: { visibility: "none" }, paint: { "raster-opacity": 0.9 } });
  bindHtmlPopup(`${cfg.id}-fill`, (p) =>""")

once("""      setLayerState(cfg.id, `zoom in to ${cfg.drawFrom} — the Atlas cannot draw reefs over a wider area`);""",
"""      setLayerState(cfg.id, `the Atlas's picture of the reefs — zoom in to ${cfg.drawFrom} for each habitat zone and its box`);""")

once("""wider out this layer is empty by necessity, not because there are no reefs.\",""",
"""wider out the layer shows the Atlas's own picture of the same reefs instead.\",""")

# A protocol that colours every drawn pixel of a picture one colour, keeping its transparency.
once("""maplibregl.addProtocol("latclip", async (params, abortController) => {""",
"""maplibregl.addProtocol("tint", async (params, abortController) => {
  const m = params.url.match(/^tint:\\/\\/([0-9A-Fa-f]{6})\\/(.*)$/);
  const r = await fetch("https://" + m[2], { signal: abortController && abortController.signal });
  if (!r.ok) throw new Error(`${r.status}`);
  const buf = await r.arrayBuffer();
  const bmp = await createImageBitmap(new Blob([buf]));
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(bmp.width, bmp.height)
    : Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  tintPixels(img.data, [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)));
  ctx.putImageData(img, 0, 0);
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: "image/png" })
    : await new Promise((res) => canvas.toBlob(res, "image/png"));
  return { data: await blob.arrayBuffer() };
});
function tintPixels(d, rgb) {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
  }
}

maplibregl.addProtocol("latclip", async (params, abortController) => {""")

# UNEP-WCMC's reefs, live.
ROW = '''    { id: "unep_coral", name: "Warm-water coral reefs (UNEP-WCMC)", unit: "reef areas", colour: "#B06F6A", route: "arcgis", ready: true, lazy: true,
      service: "https://data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/MapServer",
      attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC",
      note: "UNEP-WCMC's Global Distribution of Warm-water Coral Reefs, drawn live by its own map server at every zoom; a click asks it what is there." },
'''
once('''    { id: "wreckers_umap",''', ROW + '''    { id: "wreckers_umap",''')
once('  wreckers_umap: ["insentient", "upstream"],\n', '  unep_coral: ["animal", "downstream"],\n  wreckers_umap: ["insentient", "upstream"],\n')
once('  setLayerState(cfg.id, "live from USDA");', '  setLayerState(cfg.id, `live from ${cfg.attribution || "the source"}`);')

TESTS = r'''
console.log("\ncoral at every zoom");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("wider than 12, the Atlas's own picture is drawn", /allencoralatlas\.org\/geoserver\/ows\?SERVICE=WMS/.test(src) &&
        /id: `\$\{cfg\.id\}-raster`, type: "raster", source: `\$\{cfg\.id\}-wide`, maxzoom: cfg\.drawFrom/.test(src));
  check("…in the coral colour, not the server's black", /tint:\/\/\$\{CORAL_CLASSES\["Coral\/Algae"\]\.slice\(1\)\}/.test(src));
  const tint = new Function(src.slice(src.indexOf("function tintPixels("), src.indexOf('maplibregl.addProtocol("latclip"')) + "; return tintPixels;")();
  const d = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]);
  tint(d, [176, 111, 106]);
  check("drawn pixels take the colour, empty ones stay empty", d[0] === 176 && d[3] === 255 && d[4] === 0 && d[7] === 0);
  check("UNEP-WCMC's reefs are a row of their own, live", /id: "unep_coral"[^\n]*route: "arcgis"/.test(src) &&
        /Global_Distribution_of_Coral_Reefs\/MapServer/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Coral now shows at every zoom. Test with: node map/test.mjs")
