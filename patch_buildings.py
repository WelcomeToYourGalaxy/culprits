#!/usr/bin/env python3
"""
Building types as ONE layer. The 40 separate building rows (banks, tax offices,
courts, police, prisons, town halls and the rest, from the executive, financial,
legal, legislative, judicial, anti-slavery and activist-rights maps) become one
row, "Building types", with a chip for each type. Where two files describe the
same place (same type, within 120 m, same name), it is one record: the fuller
record leads, and every field the other adds is kept, marked with its file.
Each box lists every file that describes the place.

Built weekly into culprits-tiles-more/tiles/building_types.pmtiles by
scripts/building_types.py there, from pipeline/building_types.py here.
The old separate rows come out of the layers box.

Run from the repo root:  python3 patch_buildings.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "function addBuildingTypesLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


IDS = ["fin_bank", "fin_centralbank", "fin_taxoffice", "fin_govfinance", "fin_financial", "fin_exchange", "fin_insurance",
       "fin_accountant", "fin_remittance", "fin_stockexchange", "fin_auditoffice", "fin_devbank", "fin_mint",
       "legal_publicdefender", "legal_immigration", "legal_probation", "legal_juvenile",
       "leg_parliament", "leg_audit", "leg_electoral", "leg_ombudsman", "leg_council",
       "exec_firestation", "exec_townhall", "leg_townhall", "exec_govoffice", "exec_ministry", "exec_diplomatic", "exec_border",
       "jud_courts", "legal_courthouse", "slavery_facilities", "activist_courts",
       "exec_police", "legal_police", "activist_police",
       "exec_prison", "legal_prison", "jud_prisons", "activist_prisons"]
OLD = '''  { h: 1, t: "Building types" },
  { note: "Being combined into one layer, with duplicate places merged." },
  "fin_bank", "fin_centralbank", "fin_taxoffice", "fin_govfinance", "fin_financial", "fin_exchange", "fin_insurance",
  "fin_accountant", "fin_remittance", "fin_stockexchange", "fin_auditoffice", "fin_devbank", "fin_mint",
  "legal_publicdefender", "legal_immigration", "legal_probation", "legal_juvenile",
  "leg_parliament", "leg_audit", "leg_electoral", "leg_ombudsman", "leg_council",
  "exec_firestation", "exec_townhall", "leg_townhall", "exec_govoffice", "exec_ministry", "exec_diplomatic", "exec_border",
  "jud_courts", "legal_courthouse", "slavery_facilities", "activist_courts",
  "exec_police", "legal_police", "activist_police",
  "exec_prison", "legal_prison", "jud_prisons", "activist_prisons",
];'''
once(OLD, '''  { h: 1, t: "Building types" }, "building_types",
];''')
once('const PANEL_REMOVED = new Set([\n', 'const PANEL_REMOVED = new Set([\n  ' +
     ", ".join(f'"{i}"' for i in IDS) + ",\n")

HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
ROW = f'''    {{ id: "building_types", name: "Building types", unit: "places", colour: "#6A6258", route: "buildings", ready: true, lazy: true,
      archiveUrl: "{HOME}/tiles/building_types.pmtiles", summaryUrl: "{HOME}/tiles/building_types.json",
      note: "Every building in the executive, financial, legal, legislative, judicial, anti-slavery and activist-rights maps' files, one record per place: where two files describe the same place, the fuller record leads and every field the other adds is kept." }},
'''
once('''    { id: "wreckers_umap",''', ROW + '''    { id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  building_types: ["human", "upstream"],\n')
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "buildings" ? addBuildingTypesLayer(cfg)''')

JS = r'''/* ---------- Building types: one layer, a chip per type ---------- */
// Muted colours, one per type, skipping the yellows and oranges.
function buildingColours(types) {
  const hues = [0, 350, 335, 320, 300, 280, 265, 250, 235, 220, 205, 190, 175, 160, 145, 130, 115, 100, 12, 342];
  const out = {};
  types.forEach((t, i) => {
    const h = hues[i % hues.length], l = 42 + (Math.floor(i / hues.length) % 3) * 8;
    out[t] = `hsl(${h}, 18%, ${l}%)`;
  });
  return out;
}
async function addBuildingTypesLayer(cfg) {
  let summary;
  try { summary = await getJson(cfg.summaryUrl); }
  catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
  const types = Object.keys(summary.types || {});
  const colours = buildingColours(types);
  const colour = ["match", ["get", "type"]];
  for (const t of types) colour.push(t, colours[t]);
  colour.push(cfg.colour);
  const src = `${cfg.id}-pm`;
  map.addSource(src, { type: "vector", url: `pmtiles://${cfg.archiveUrl}` });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, "source-layer": "buildings",
    paint: { "circle-color": colour, "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.6, 10, 4, 15, 6],
             "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5, "circle-opacity": 0.9 } });
  bindHtmlPopup(`${cfg.id}-pt`, (p) => {
    const skip = new Set(["type", "name", "sources", "merged"]);
    const rows = Object.keys(p).filter((k) => !skip.has(k) && p[k] !== "" && p[k] != null).map((k) => {
      const v = String(p[k]);
      return `${escapeHtml(k.replace(/_/g, " "))}: ` + (/^https?:\/\//.test(v)
        ? `<a href="${escapeHtml(v)}" target="_blank" rel="noopener">${escapeHtml(v.length > 60 ? v.slice(0, 57) + "\u2026" : v)}</a>` : escapeHtml(v));
    });
    return `<b>${escapeHtml(p.name || "Unnamed in the source")}</b><div class="meta">${escapeHtml(p.type)}</div>` +
      (rows.length ? `<div class="meta">${rows.join("<br>")}</div>` : "") +
      `<div class="meta">From: ${escapeHtml(p.sources || "")}${Number(p.merged) > 1 ? ` (${p.merged} files describe this place; merged)` : ""}</div>`;
  });
  // A chip per type, with its count; none picked means every type.
  const picked = new Set();
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after && document.createElement) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<span class="chip reset" data-bt="">All types</span>` + types.map((t) =>
      `<button type="button" class="chip" data-bt="${escapeHtml(t)}"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;` +
      `background:${colours[t]};margin-right:4px"></i>${escapeHtml(t)} (${Number(summary.types[t]).toLocaleString()})</button>`).join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-bt]");
      if (!b) return;
      e.stopPropagation();
      const t = b.dataset.bt;
      if (!t) picked.clear(); else if (picked.has(t)) picked.delete(t); else picked.add(t);
      for (const c of el.querySelectorAll("[data-bt]")) c.classList.toggle("on", c.dataset.bt ? picked.has(c.dataset.bt) : picked.size === 0);
      map.setFilter(`${cfg.id}-pt`, picked.size ? ["in", ["get", "type"], ["literal", [...picked]]] : null);
    });
    anchor.after(el);
  }
  setLayerState(cfg.id, `${Number(summary.places).toLocaleString()} places in ${types.length} types (from ${Number(summary.rows).toLocaleString()} file rows)`);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nbuilding types, one layer");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  check("Building types is one row", o.PANEL_ORDER.includes("building_types") && !o.PANEL_ORDER.includes("fin_bank"));
  check("…and the forty separate rows are out of the box", ["fin_bank", "jud_courts", "activist_prisons", "slavery_facilities"].every((i) => o.PANEL_REMOVED.has(i)));
  const cols = new Function(src.slice(src.indexOf("function buildingColours("), src.indexOf("async function addBuildingTypesLayer(")) + "; return buildingColours;")();
  const c = cols(["Banks", "Courts", "Police stations"]);
  check("each type gets its own muted colour", new Set(Object.values(c)).size === 3 && Object.values(c).every((v) => /hsl\(\d+, 18%/.test(v)));
  check("no type is coloured yellow or orange", Object.values(cols(Array.from({ length: 40 }, (_, i) => "t" + i))).every((v) => { const h = Number(/hsl\((\d+)/.exec(v)[1]); return !(h > 20 && h < 90); }));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Building types added. Test with: node map/test.mjs")
