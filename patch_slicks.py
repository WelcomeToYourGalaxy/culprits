#!/usr/bin/env python3
"""
1. SkyTruth Monitor's "Vessels of concern" is now drawn: its alerts for the
   whole world over the last 30 days, each with its own fields, from a daily
   copy (scripts/skytruth.py in culprits-tiles-more). Its panel row is replaced;
   the SkyTruth Monitor panel stays.
2. The daily oil-slick archive: every Cerulean slick kept by month
   (scripts/cerulean_archive.py), as a row with a month menu, beside the live
   Cerulean rows under Oceans. A click gives the slick's own fields.

Run from the repo root:  python3 patch_slicks.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function addSlickArchive(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
once('''    { id: "skytruth_voc", name: "SkyTruth Monitor: vessels of concern", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://monitor.skytruth.org/issue/vessels-of-concern",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },''',
     f'''    {{ id: "skytruth_voc", name: "SkyTruth Monitor: vessels of concern", unit: "alerts, last 30 days", colour: "#5E7377", route: "geojsonlive", ready: true, lazy: true,
      files: [{{ label: "Vessels of concern", url: "{HOME}/skytruth/vessels_of_concern.geojson" }}],
      note: "SkyTruth Monitor's vessels-of-concern alerts for the whole world over the last 30 days, from a daily copy of its own service." }},
    {{ id: "slick_archive", name: "Oil slick archive (Cerulean, kept daily)", unit: "slicks by month", colour: "#5A5750", route: "slickarchive", ready: true, lazy: true,
      base: "{HOME}/cerulean_archive",
      note: "Every Cerulean slick kept by month from a daily copy, so they stay on the map whatever happens to the live service." }},''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  slick_archive: ["animal", "downstream"],\n')
once('"cerulean_slicks", "cerulean_sources",', '"cerulean_slicks", "cerulean_sources", "slick_archive",')
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "slickarchive" ? addSlickArchive(cfg)''')

JS = r'''/* ---------- the daily oil-slick archive, by month ---------- */
async function addSlickArchive(cfg) {
  let index;
  try { index = await getJson(`${cfg.base}/index.json`, 30000); }
  catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
  const months = Object.keys(index).sort().reverse();
  const src = `${cfg.id}-src`;
  map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: src, paint: { "fill-color": "#1D1B17", "fill-opacity": 0.55 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: src, paint: { "line-color": "#B8A79E", "line-width": 1 } });
  bindHtmlPopup(`${cfg.id}-fill`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily</div>`);
  const show = async (m) => {
    setLayerState(cfg.id, `reading ${m}\u2026`);
    try {
      map.getSource(src).setData(await getJson(`${cfg.base}/${m}.geojson`, 60000));
      setLayerState(cfg.id, `${Number(index[m]).toLocaleString()} slicks in ${m} \u00b7 ${months.length} months kept`);
    } catch (e) { setLayerState(cfg.id, `${m} could not be read (${e.message})`); }
  };
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Month">${months.map((m) => `<option value="${m}">${m} (${Number(index[m]).toLocaleString()})</option>`).join("")}</select>`;
    el.querySelector("select").addEventListener("change", (e) => show(e.target.value));
    anchor.after(el);
  }
  if (months.length) await show(months[0]);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nvessels of concern drawn; the oil-slick archive");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("vessels of concern are drawn from the daily copy", /id: "skytruth_voc"[^\n]*route: "geojsonlive"/.test(src) && /skytruth\/vessels_of_concern\.geojson/.test(src));
  check("the slick archive is a row beside the live slicks", /id: "slick_archive"/.test(src) && /"cerulean_sources", "slick_archive",/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Done. Test with: node map/test.mjs")
