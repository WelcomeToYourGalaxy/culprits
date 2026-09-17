#!/usr/bin/env python3
"""
Brings map/app.js, map/test.mjs and sources.json up to date with the two layer
registries:
  pipeline/sitemaps/registry.json      the site's Leaflet maps  -> group SITE_MAPS
  pipeline/sitemaps/repo_layers.json   files in the map repos    -> one group per map

Safe to run whether or not an earlier patch has been applied, and safe to run
again: a group or layer already present is left alone, and only what is
missing is added. Every edit is checked before anything is written.

Run from the repo root, after patch_layers_0917.py:  python3 patch_add_layers.py
Backups: /tmp/culprits-add-layers-backup
"""

import json
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, SOURCES = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs", ROOT / "sources.json"
SITE = json.loads((ROOT / "pipeline" / "sitemaps" / "registry.json").read_text(encoding="utf-8"))["maps"]
REPO = json.loads((ROOT / "pipeline" / "sitemaps" / "repo_layers.json").read_text(encoding="utf-8"))
SHAPES = json.loads((ROOT / "pipeline" / "shapes" / "registry.json").read_text(encoding="utf-8"))["layers"]
GROUP_NAMES = {"GMO_MAP": ("gmo_map_layers", "Genetic engineering map")}

# The map's shapes route: countries, regions and lines from map/data/shapes/<id>.geojson.
SHAPES_FN = """
/* ---------- shapes: countries, regions and lines from the site's maps ---------- */
//
// Built by pipeline/shapes/build_shapes.py into map/data/shapes/<id>.geojson and
// fetched only when a layer is first ticked. One file can hold areas, lines and
// points together, so each is drawn by its own layer. Where the source map
// coloured a shape, that colour (softened at build time) is used; otherwise the
// layer's own colour.
function shapeText(v) {
  return String(v == null ? "" : v).replace(/<[^>]*>/g, " ").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\s+/g, " ").trim();
}
async function addShapesLayer(cfg) {
  const url = `${DATA_BASE}/shapes/${cfg.id}.geojson`;
  let data;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} at ${url}`);
    data = await r.json();
  } catch (e) {
    setLayerState(cfg.id, `not built yet (${e.message})`);
    console.error(`[culprits] ${cfg.id}: ${e.message}`);
    return;
  }
  const source = `${cfg.id}-shapes`;
  map.addSource(source, { type: "geojson", data, attribution: cfg.attribution || "" });
  const colour = ["coalesce", ["get", "_map_colour"], cfg.colour];
  const areas = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
  const lines = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source, filter: areas,
    paint: { "fill-color": colour, "fill-opacity": 0.42 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source,
    filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], false, true],
    paint: { "line-color": colour, "line-opacity": 0.85,
             "line-width": ["case", lines, 1.6, 0.6] } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source,
    filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
    paint: { "circle-color": colour, "circle-radius": 4,
             "circle-stroke-width": 0.6, "circle-stroke-color": "#17150F" } });
  const popup = (p) => {
    const title = p.name || p.country || p.title || cfg.name;
    const skip = new Set(["name", "country", "title", "list", "from_the_map", "entries"]);
    const rows = Object.entries(p).filter(([k, v]) => !k.startsWith("_") && !skip.has(k) && v !== "" && v != null)
      .slice(0, 16).map(([k, v]) => `${shapeText(k.replace(/[_.]/g, " "))}: ${shapeText(v).slice(0, 400)}`);
    const said = p.from_the_map ? shapeText(p.from_the_map).slice(0, 1200) : "";
    const list = p.list ? String(p.list).split("\\n") : [];
    const shown = list.slice(0, 40).map((l) => shapeText(l).slice(0, 300));
    return `<b>${shapeText(title)}</b>` +
      (said ? `<div class="meta">${said}</div>` : "") +
      (rows.length ? `<div class="meta">${rows.join("<br>")}</div>` : "") +
      (shown.length ? `<div class="meta">${Number(p.entries || list.length).toLocaleString()} entries:<br>` +
        shown.join("<br>") + (list.length > 40 ? `<br>…and ${(list.length - 40).toLocaleString()} more in the source file` : "") +
        `</div>` : "");
  };
  bindHtmlPopup(`${cfg.id}-fill`, popup);
  bindHtmlPopup(`${cfg.id}-line`, popup);
  bindHtmlPopup(`${cfg.id}-pt`, popup);
  setLayerState(cfg.id, `${data.features.length.toLocaleString()} ${cfg.unit}`);
  applyVisibility(cfg.id);
  buildLegend();
}
"""
BACKUP = pathlib.Path("/tmp/culprits-add-layers-backup")


def child(id_, name, unit, colour, note, route="pmtiles"):
    return ("    { id: %s, name: %s, unit: %s, colour: %s, route: %s, ready: true, lazy: true, archiveUrl: null,\n      note: %s },\n"
            % tuple(json.dumps(v, ensure_ascii=False) for v in (id_, name, unit, colour, route, note)))


def main():
    app = APP.read_text(encoding="utf-8")
    test = TEST.read_text(encoding="utf-8")
    if "SITE_MAPS" not in app:
        sys.exit("Run patch_layers_0917.py first. Nothing was written.")

    m = re.search(r"const GROUPS = \[([^\]]*)\];", app)
    if not m:
        sys.exit("Could not find the GROUPS line in map/app.js. Nothing was written.")
    consts = [c.strip() for c in m.group(1).split(",") if c.strip()]
    added_layers = added_groups = 0

    wanted = [("SITE_MAPS", "site_maps", "The site's other maps",
               [child(s["id"], s["name"], s["unit"], s["colour"], s["note"]) for s in SITE if s["id"] != "carbon_majors"],
               [s["id"] for s in SITE if s["id"] != "carbon_majors"])]
    for g in REPO["groups"]:
        kids = [l for l in REPO["layers"] if l["group"] == g["key"]]
        wanted.append((g["const"], g["id"], g["name"],
                       [child(l["id"], l["name"], l["unit"], l["colour"],
                              f"Every row of {l['file']} in WelcomeToYourGalaxy/{l['repo']}.") for l in kids],
                       [l["id"] for l in kids]))

    # Shape layers join the group of the map they come from.
    for const in dict.fromkeys(l["group"] for l in SHAPES):
        kids = [l for l in SHAPES if l["group"] == const]
        rows = [child(l["id"], l["name"], l["unit"], l["colour"],
                      "Areas, lines and per-country lists from the map, drawn as the map draws them.", "shapes") for l in kids]
        ids = [l["id"] for l in kids]
        hit = next((w for w in wanted if w[0] == const), None)
        if hit:
            hit[3].extend(rows); hit[4].extend(ids)
        else:
            gid, gname = GROUP_NAMES.get(const, (const.lower(), const.replace("_", " ").title()))
            wanted.append((const, gid, gname, rows, ids))

    if "function addShapesLayer" not in app:
        anchor = "/* ---------- raster tile layers, via the Worker ---------- */"
        if app.count(anchor) != 1:
            sys.exit("Could not find where to add the shapes route in map/app.js. Nothing was written.")
        app = app.replace(anchor, SHAPES_FN.strip() + "\n\n" + anchor, 1)
        dispatch = """  const build = cfg.route === "wmts"
    ? Promise.resolve().then(() => addWmtsLayer(cfg))
    : addPmtilesLayer(cfg);"""
        if app.count(dispatch) != 1:
            sys.exit("Could not find the layer dispatch in ensureLayer. Nothing was written.")
        app = app.replace(dispatch, """  const build = cfg.route === "wmts"
    ? Promise.resolve().then(() => addWmtsLayer(cfg))
    : cfg.route === "shapes" ? addShapesLayer(cfg)
    : addPmtilesLayer(cfg);""", 1)
        m = re.search(r"const GROUPS = \[([^\]]*)\];", app)

    for const, gid, gname, rows, ids in wanted:
        head = f"const {const} = {{"
        if head not in app:
            block = (f"{head}\n  id: {json.dumps(gid)},\n  name: {json.dumps(gname, ensure_ascii=False)},\n"
                     f"  group: true,\n  ready: true,\n  children: [\n{''.join(rows)}  ],\n}};\n\n")
            app = app.replace(m.group(0), block + m.group(0), 1)
            added_groups += 1
            added_layers += len(rows)
        else:
            start = app.index(head)
            end = app.index("\n  ],\n};", start)
            missing = [r for r, i in zip(rows, ids) if f"id: {json.dumps(i)}" not in app[start:end]]
            if missing:
                app = app[:end + 1] + "".join(missing) + app[end + 1:]
                added_layers += len(missing)
        if const not in consts:
            consts.append(const)
        m = re.search(r"const GROUPS = \[([^\]]*)\];", app)

    app = app.replace(m.group(0), f"const GROUPS = [{', '.join(consts)}];", 1)

    test = re.sub(r"/GROUPS = \\\[CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY[^/]*/\.test\(src\)\);",
                  "/GROUPS = \\\\[CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS/.test(src));", test)

    reg = json.loads(SOURCES.read_text(encoding="utf-8"))
    by_id = {s["id"]: s for s in reg["sources"]}
    new_sources = 0
    for s in SITE:
        bulk = s.get("url") or f"https://www.welcometoyourgalaxy.com/{s['page']}.html"
        entry = by_id.get(s["id"])
        if entry:
            entry["bulk"] = bulk          # a map moved from the site page to the maps repo
            continue
        reg["sources"].append({"id": s["id"], "name": s["name"], "mode": "bulk", "auth": "none", "route": "pmtiles",
            "bulk": bulk, "licence": "Welcome to Your Galaxy's own map; the sources it cites carry their own terms",
            "licence_verified": False, "access_verified": True,
            "notes": s["note"] + " Read by pipeline/sources/_sitemap.py. Points only.",
            "layer": {"kind": "point", "value": None, "unit": s["unit"]}})
        new_sources += 1
    for l in REPO["layers"]:
        if l["id"] in by_id:
            continue
        reg["sources"].append({"id": l["id"], "name": l["name"], "mode": "bulk", "auth": "none", "route": "pmtiles",
            "bulk": f"https://raw.githubusercontent.com/WelcomeToYourGalaxy/{l['repo']}/main/{l['file']}",
            "licence": "Welcome to Your Galaxy's own compilation; unverified (no licence file in the repo; many rows appear to come from OpenStreetMap, ODbL)",
            "licence_verified": False, "access_verified": True,
            "notes": f"Every row of {l['file']} in WelcomeToYourGalaxy/{l['repo']}. Read by pipeline/sources/_repo_rows.py.",
            "layer": {"kind": "point", "value": None, "unit": l["unit"]}})
        new_sources += 1
    # Two archives are past GitHub's 100 MB cap at zoom 12; built one level lower.
    for s in reg["sources"]:
        if s["id"] in ("exec_govoffice", "fin_bank"):
            s["tile_maxzoom"] = 11

    BACKUP.mkdir(parents=True, exist_ok=True)
    for f in (APP, TEST, SOURCES):
        shutil.copy(f, BACKUP / f.name)
    APP.write_text(app, encoding="utf-8")
    TEST.write_text(test, encoding="utf-8")
    SOURCES.write_text(json.dumps(reg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Added {added_groups} groups and {added_layers} layers to map/app.js, and {new_sources} sources "
          f"to sources.json (backups in {BACKUP}).")


if __name__ == "__main__":
    main()
