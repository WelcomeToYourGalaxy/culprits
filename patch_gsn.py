#!/usr/bin/env python3
"""
Global Safety Net (One Earth / Nature Data Lab): every layer its own viewer
offers (41: protection levels, Indigenous territories, areas of biodiversity and
climate importance, land cover, modified land, ecoregions, biodiversity
intactness, critical habitats and the combined views), as a list of tick boxes
under the row, each drawn live in the viewer's own colours. Its layer list gives
fresh picture addresses each time it is read, so the row reads it when ticked.
The 30 entries the viewer itself keeps hidden (masks, per-class copies and
statistics helpers) are not listed, as in the viewer.

Run from the repo root:  python3 patch_gsn.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function addGsnLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


once('''    { id: "wreckers_umap",''', '''    { id: "gsn", name: "Global Safety Net (One Earth)", unit: "layers", colour: "#406F2F", route: "gsn", ready: true, lazy: true,
      api: "https://api.gsn.naturedatalab.org/geo-analysis/layers",
      note: "Every layer the Global Safety Net viewer offers, drawn live from its own map service in its own colours." },
    { id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  gsn: ["plant", "downstream"],\n')
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "gsn" ? addGsnLayer(cfg)''')

JS = r'''/* ---------- Global Safety Net: its viewer's layers, ticked one by one ---------- */
function gsnShown(list) {
  return (list || []).filter((l) => l.gee_tile_url && !(l.is_hidden === true || l.is_hidden === "True"));
}
async function addGsnLayer(cfg) {
  let list;
  try { list = gsnShown(await getJson(cfg.api, 40000)); }
  catch (e) { setLayerState(cfg.id, `Global Safety Net did not answer (${e.message})`); return; }
  cfg._layerIds = [];
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.style.cssText = "display:block;max-height:220px;overflow:auto";
    el.innerHTML = list.map((l) => `<label title="${escapeHtml(l.description || "")}" style="display:flex;gap:6px;align-items:center;font-size:12px;margin:2px 0;cursor:pointer">` +
      `<input type="checkbox" data-gsn="${escapeHtml(String(l.id))}"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${escapeHtml(l.colour || "#777")}"></i>` +
      `${escapeHtml(l.name)}</label>`).join("");
    el.addEventListener("change", (e) => {
      const cb = e.target;
      if (!cb.dataset || !cb.dataset.gsn) return;
      e.stopPropagation();
      const l = list.find((x) => String(x.id) === cb.dataset.gsn);
      const id = `${cfg.id}-r-${l.id}`;
      if (cb.checked && !map.getLayer(id)) {
        map.addSource(id, { type: "raster", tileSize: 256, tiles: [`${l.gee_tile_url}/tiles/{z}/{x}/{y}`],
          attribution: "Global Safety Net, One Earth / Nature Data Lab" });
        map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.85 } });
        cfg._layerIds.push(id);
      }
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", cb.checked && (visibility.get(cfg.id) || "visible") === "visible" ? "visible" : "none");
      const on = el.querySelectorAll("input:checked").length;
      setLayerState(cfg.id, `${on} of ${list.length} layers shown` + (cb.checked && l.description ? ` \u00b7 ${l.name}: ${l.description.slice(0, 140)}` : ""));
    });
    anchor.after(el);
  }
  setLayerState(cfg.id, `${list.length} layers \u2014 tick the ones to show`);
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nGlobal Safety Net");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const shown = new Function(src.slice(src.indexOf("function gsnShown("), src.indexOf("async function addGsnLayer(")) + "; return gsnShown;")();
  const list = [{ id: 1, gee_tile_url: "u" }, { id: 26, gee_tile_url: "u", is_hidden: "True" }, { id: 7, gee_tile_url: "u", is_multilayer: "True" }, { id: 9 }];
  check("the viewer's own layers are offered, its hidden helpers are not", shown(list).map((l) => l.id).join() === "1,7");
  check("each is drawn from the fresh address its list gives", /\$\{l\.gee_tile_url\}\/tiles\/\{z\}\/\{x\}\/\{y\}/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Global Safety Net added. Test with: node map/test.mjs")
