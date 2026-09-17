#!/usr/bin/env bash
# Move the new layers' files out of this repo into the two tile repos, which
# must be cloned beside it:  ~/Desktop/culprits-tiles-gov  and  ~/Desktop/culprits-tiles-more
# Run from the culprits repo root:  bash pipeline/sitemaps/move_to_tile_repos.sh
set -euo pipefail
python3 - <<'PY'
import json, pathlib, shutil, sys
root = pathlib.Path.cwd()
H = json.loads((root / "pipeline/sitemaps/homes.json").read_text())
app = (root / "map/app.js").read_text()
moved = 0
for repo, consts in H["homes"].items():
    dest = root.parent / repo
    if not dest.is_dir():
        sys.exit(f"{dest} is not there — clone {repo} beside culprits first")
    (dest / "tiles").mkdir(exist_ok=True)
    (dest / "shapes").mkdir(exist_ok=True)
    (dest / ".nojekyll").touch()
    for const in consts:
        head = f"const {const} = {{"
        if head not in app:
            continue
        block = app[app.index(head):app.index("\n  ],\n};", app.index(head))]
        for id_ in __import__("re").findall(r'\{ id: "([^"]+)"', block):
            for src, sub, ext in ((root / "map/tiles", "tiles", ".pmtiles"), (root / "map/data/shapes", "shapes", ".geojson")):
                f = src / f"{id_}{ext}"
                if f.exists():
                    shutil.move(str(f), dest / sub / f.name)
                    moved += 1
print(f"moved {moved} files")
PY
