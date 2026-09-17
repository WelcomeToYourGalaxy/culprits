#!/usr/bin/env python3
"""
Points the new layers at the two repos their files are published from:
  culprits-tiles-gov    executive, legislative, judicial and legal defense maps
  culprits-tiles-more   money map, site maps, GMO map, and the rest
(see pipeline/sitemaps/homes.json for why).

Edits map/app.js (each child's archiveUrl, or dataUrl for shape layers, and
the shapes route so it reads dataUrl) and sources.json (these sources are
marked as built locally, so the weekly refresh does not rebuild them into this
repo). Run after patch_add_layers.py. Safe to run again.
"""

import json
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, SOURCES = ROOT / "map" / "app.js", ROOT / "sources.json"
H = json.loads((ROOT / "pipeline" / "sitemaps" / "homes.json").read_text())


def main():
    app = APP.read_text(encoding="utf-8")
    if "function addShapesLayer" not in app:
        sys.exit("Run patch_add_layers.py first. Nothing was written.")
    moved = 0
    for repo, consts in H["homes"].items():
        base = f"{H['base']}/{repo}"
        for const in consts:
            head = f"const {const} = {{"
            if head not in app:
                continue
            start = app.index(head)
            end = app.index("\n  ],\n};", start)
            block = app[start:end]

            def fix(m):
                nonlocal moved
                id_, route = m.group(1), m.group(2)
                moved += 1
                where = (f'dataUrl: "{base}/shapes/{id_}.geojson"' if route == "shapes"
                         else f'archiveUrl: "{base}/tiles/{id_}.pmtiles"')
                return f'{{ id: "{id_}"{m.group(3)}route: "{route}", ready: true, lazy: true, {where},'

            block = re.sub(r'\{ id: "([^"]+)"(.*?)route: "(pmtiles|shapes)", ready: true, lazy: true, (?:archiveUrl|dataUrl): [^,]+,',
                           lambda m: fix(type("M", (), {"group": lambda self, i: [None, m.group(1), m.group(3), m.group(2)][i]})()),
                           block)
            app = app[:start] + block + app[end:]

    old = "  const url = `${DATA_BASE}/shapes/${cfg.id}.geojson`;"
    if old in app:
        app = app.replace(old, "  const url = cfg.dataUrl || `${DATA_BASE}/shapes/${cfg.id}.geojson`;", 1)

    reg = json.loads(SOURCES.read_text(encoding="utf-8"))
    site = {m["id"] for m in json.loads((ROOT / "pipeline" / "sitemaps" / "registry.json").read_text())["maps"]}
    repo = {l["id"] for l in json.loads((ROOT / "pipeline" / "sitemaps" / "repo_layers.json").read_text())["layers"]}
    local = (site | repo) - {"carbon_majors"}
    for s in reg["sources"]:
        if s["id"] in local:
            s["mode"] = "tiles"
            s["built_by"] = "pipeline/sitemaps/build.sh, published from culprits-tiles-gov / culprits-tiles-more"

    shutil.copy(APP, "/tmp/app.js.homes.bak")
    shutil.copy(SOURCES, "/tmp/sources.json.homes.bak")
    APP.write_text(app, encoding="utf-8")
    SOURCES.write_text(json.dumps(reg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Pointed {moved} layers at culprits-tiles-gov and culprits-tiles-more "
          f"(backups: /tmp/app.js.homes.bak, /tmp/sources.json.homes.bak).")


if __name__ == "__main__":
    main()
