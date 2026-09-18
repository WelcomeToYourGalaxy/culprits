#!/usr/bin/env python3
"""
Add the Soybean and Corn Map Explorers (USDA Foreign Agricultural Service,
Commodity Explorer) to "Other organisations' maps", read live from USDA's own
map server at view time, the way the explorers read it: USDA draws the map
image, and a click asks USDA what is at that spot and opens the explorer's box
(crop and country, sub-region and its rank). Nothing is copied or stored.

Needs patch_palmwatch.py first (it creates the group).
Run from the repo root:  python3 patch_explorers.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "function addArcgisLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


USDA = "https://gis.ipad.fas.usda.gov/arcgis/rest/services"
ROWS = f'''    {{ id: "usda_soybean", name: "Soybean Map Explorer", unit: "soybean growing areas", colour: "#6F7560", route: "arcgis", ready: true, lazy: true,
      crop: "Soybean", service: "{USDA}/CommodityExplorerSoybean/MapServer", attribution: "USDA Foreign Agricultural Service",
      note: "Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." }},
    {{ id: "usda_corn", name: "Corn Map Explorer", unit: "corn growing areas", colour: "#76705C", route: "arcgis", ready: true, lazy: true,
      crop: "Corn", service: "{USDA}/CommodityExplorerCorn/MapServer", attribution: "USDA Foreign Agricultural Service",
      note: "Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." }},
  ],
}};

const GROUPS = ['''
anchor = '''modelled sourcing area, not a property boundary; tree cover loss inside it is not measured as that mill's own clearing." },
  ],
};'''
app = once(app, anchor, anchor.replace("\n  ],\n};", "\n" + ROWS.split("\n  ],\n};")[0] + "\n  ],\n};"), "map/app.js")
app = once(app, '  palmwatch: ["plant", "downstream"],\n',
           '  palmwatch: ["plant", "downstream"],\n  usda_soybean: ["plant", "downstream"],\n  usda_corn: ["plant", "downstream"],\n', "map/app.js")
app = once(app, '    : cfg.route === "sitemap" ? addSitemapLayer(cfg)',
           '    : cfg.route === "sitemap" ? addSitemapLayer(cfg)\n    : cfg.route === "arcgis" ? Promise.resolve().then(() => addArcgisLayer(cfg))', "map/app.js")

JS = r'''/* ---------- a live ArcGIS map server (USDA's Commodity Explorers) ---------- */
// The server draws each square of the map as the view moves, and answers what
// is at a clicked spot, as the explorers' own pages ask it. Nothing is copied.
// Its colours are the server's; they are muted a little to sit with the atlas.
function addArcgisLayer(cfg) {
  const src = `${cfg.id}-img`;
  map.addSource(src, { type: "raster", tileSize: 256, attribution: cfg.attribution || "",
    tiles: [`${cfg.service}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256` +
            `&format=png32&transparent=true&dpi=96&f=image`] });
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: src,
    paint: { "raster-opacity": 0.8, "raster-saturation": -0.45 } });
  map.on("click", (e) => {
    if ((visibility.get(cfg.id) || "visible") !== "visible" || !map.getLayer(`${cfg.id}-raster`)) return;
    if (map.getLayoutProperty(`${cfg.id}-raster`, "visibility") === "none") return;
    arcgisIdentify(cfg, e.lngLat).then((html) => {
      if (html) new maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(e.lngLat).setHTML(html).addTo(map);
    }).catch((err) => console.warn(`[culprits] ${cfg.id}: ${err.message}`));
  });
  setLayerState(cfg.id, "live from USDA");
  applyVisibility(cfg.id);
  buildLegend();
}

async function arcgisIdentify(cfg, at) {
  const b = map.getBounds(), c = map.getCanvas();
  const q = new URLSearchParams({ geometry: `${at.lng},${at.lat}`, geometryType: "esriGeometryPoint", sr: "4326",
    layers: "top", tolerance: "3", returnGeometry: "false", f: "json",
    mapExtent: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(","),
    imageDisplay: `${c.clientWidth || 800},${c.clientHeight || 600},96` });
  const r = await fetch(`${cfg.service}/identify?${q}`);
  if (!r.ok) throw new Error(`${r.status} from USDA`);
  const data = await r.json();
  const hits = (data && data.results) || [];
  if (!hits.length) return "";
  return hits.map((h) => arcgisBox(cfg, h)).join("<hr>");
}

// The explorers' own boxes: the crop and country with the sub-region and its
// rank on the percentage layer, the sub-region's name on the outline layer.
function arcgisBox(cfg, hit) {
  const a = hit.attributes || {};
  const get = (k) => a[k] != null ? a[k] : a[Object.keys(a).find((x) => x.toLowerCase() === k) || ""];
  if (hit.layerName === `${cfg.crop} Percentage`) {
    return `<b>${escapeHtml(cfg.crop)} - ${escapeHtml(get("cntryname") || "")}</b>` +
      `<div class="meta">Sub Region: ${escapeHtml(get("name") || "")}<br>Rank: ${escapeHtml(get("rank") || "")}</div>`;
  }
  if (hit.layerName === "Crop Explorer Subregions") {
    return `<b>${escapeHtml(get("name") || "")}</b><div class="meta">Sub Region: ${escapeHtml(get("name") || "")}</div>`;
  }
  const rows = Object.entries(a).filter(([k, v]) => v !== "" && v != null && !/^(objectid|shape|fid)/i.test(k) && v !== "Null")
    .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`);
  return `<b>${escapeHtml(hit.layerName || cfg.name)}</b>` + (rows.length ? `<div class="meta">${rows.join("<br>")}</div>` : "");
}

/* ---------- the sky the map sits in ---------- */'''
app = once(app, "/* ---------- the sky the map sits in ---------- */", JS, "map/app.js")

TESTS = r'''
console.log("\nthe USDA explorers, live");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("both explorers are rows in Other organisations' maps",
        /id: "usda_soybean"[^\n]*route: "arcgis"/.test(src) && /id: "usda_corn"[^\n]*route: "arcgis"/.test(src));
  check("they read USDA's own map servers, not the Worker or a copy",
        /CommodityExplorerSoybean\/MapServer/.test(src) && /CommodityExplorerCorn\/MapServer/.test(src) &&
        !/usda_[a-z]+[^\n]*WORKER/.test(src));
  check("the map image is asked square by square as the view moves", /\/export\?bbox=\{bbox-epsg-3857\}/.test(src));
  check("a tick creates the layer through the usual lazy path", /cfg\.route === "arcgis" \? Promise\.resolve\(\)\.then\(\(\) => addArcgisLayer\(cfg\)\)/.test(src));
  const body = src.slice(src.indexOf("function arcgisBox("), src.indexOf("/* ---------- the sky the map sits in"));
  const escapeHtml = (s) => String(s);
  const arcgisBox = new Function("escapeHtml", body + "; return arcgisBox;")(escapeHtml);
  const cfg = { crop: "Soybean", name: "Soybean Map Explorer" };
  const h = arcgisBox(cfg, { layerName: "Soybean Percentage", attributes: { cntryname: "Brazil", name: "Mato Grosso", rank: 1 } });
  check("a click on the crop layer opens the explorer's own box", h.includes("Soybean - Brazil") && h.includes("Sub Region: Mato Grosso") && h.includes("Rank: 1"));
  const g = arcgisBox(cfg, { layerName: "Crop Explorer Subregions", attributes: { name: "Paraná" } });
  check("…and on the outline layer, the sub-region's name", g.includes("<b>Paraná</b>"));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Added the Soybean and Corn Map Explorers. Test with: node map/test.mjs")
