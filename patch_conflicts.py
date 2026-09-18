#!/usr/bin/env python3
"""
Add local-map's Indigenous Environmental Conflicts map to Culprits as its own
map: one row under its own name, its 1,534 conflicts drawn with their own
markers, and a click opening the map's own box.

Changes:
  pipeline/sitemaps/extract.mjs   the stand-in page gains Option, which the
                                  map's filter menus use (without it the map's
                                  script stopped before drawing anything)
  pipeline/sitemaps/registry.json the map's entry
  map/app.js                      its row, after the cartel cells row, and its
                                  two labels (human, downstream)

Every edit is anchored on exact text; if an anchor is missing nothing is written.
Run from the repo root:  python3 patch_conflicts.py
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP = ROOT / "map" / "app.js"
EXT = ROOT / "pipeline" / "sitemaps" / "extract.mjs"
REG = ROOT / "pipeline" / "sitemaps" / "registry.json"
ID = "site_indigenous_conflicts"
HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"

app, ext = APP.read_text(encoding="utf-8"), EXT.read_text(encoding="utf-8")
reg = json.loads(REG.read_text(encoding="utf-8"))

if f'id: "{ID}"' in app:
    sys.exit("app.js already has Indigenous Environmental Conflicts - nothing to do.")

def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)

if "Option: class" not in ext:
    ext = once(ext, "Image: class {},",
               'Image: class {}, Option: class { constructor(text = "", value = "") { this.text = text; this.value = value; this.textContent = text; } },',
               "extract.mjs")

ROW = (f'    {{ id: "{ID}", name: "Indigenous Environmental Conflicts", unit: "conflicts", colour: "#6B5A4A", '
       f'route: "sitemap", ready: true, lazy: true, dataUrl: "{HOME}/sitemaps/{ID}.places.geojson",\n'
       '      note: "From local-map\'s Indigenous Environmental Conflicts map (EJAtlas cases, real coordinates)." },\n')
anchor = """      note: "From the Suppression page's cartel cells map (maps repo), with its connecting lines." },\n"""
app = once(app, anchor, anchor + ROW, "map/app.js")
app = once(app, '  site_cartel_cells: ["human", "upstream"],\n',
           '  site_cartel_cells: ["human", "upstream"],\n' + f'  {ID}: ["human", "downstream"],\n', "map/app.js")

if not any(m["id"] == ID for m in reg["maps"]):
    reg["maps"].append({"id": ID, "name": "Indigenous Environmental Conflicts", "unit": "conflicts",
        "colour": "#6B5A4A", "note": "From local-map's Indigenous Environmental Conflicts map (local-map repo).",
        "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/local-map/main/indigenous_conflicts_map_REAL.html"})

APP.write_text(app, encoding="utf-8")
EXT.write_text(ext, encoding="utf-8")
REG.write_text(json.dumps(reg, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print("Added Indigenous Environmental Conflicts. Next: python3 pipeline/sitemaps/build_boxes.py site_indigenous_conflicts")
