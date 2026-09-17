#!/usr/bin/env bash
# Harvest, normalize and tile every map in pipeline/sitemaps/registry.json.
#
# Run from the repo root, inside the venv:   bash pipeline/sitemaps/build.sh
# Only some:                                 bash pipeline/sitemaps/build.sh site_circus,site_rodeo
#
# Reads the Weebly pages from the live site. If they are not at
#   https://www.welcometoyourgalaxy.com/<page>.html
# set WTYG_SITE to the right address, or set WTYG_SITE_RECORD to a folder of
# saved pages (an unzipped site record) to read those instead.
set -euo pipefail

command -v node >/dev/null || { echo "node is needed: the maps' own scripts are run to read their places" >&2; exit 1; }
command -v tippecanoe >/dev/null || { echo "tippecanoe is needed to build the tiles" >&2; exit 1; }

# The accountability repos' files, plus the site maps still drawn from archives.
# The other site maps are built as their own maps by build_boxes.py, below.
ALL=$(python3 -c 'import json
keep={"carbon_majors","site_environment_law"}
a=[m["id"] for m in json.load(open("pipeline/sitemaps/registry.json"))["maps"] if m["id"] in keep]
b=[l["id"] for l in json.load(open("pipeline/sitemaps/repo_layers.json"))["layers"]]
print(",".join(a+b))')
IDS="${1:-$ALL}"

# The Suppression page is only a reachability check: it holds most of the maps
# read from the live site. If it cannot be reached, those maps are skipped by
# the harvest (each says so) and everything read from GitHub still builds.
if [ -z "${WTYG_SITE_RECORD:-}" ]; then
  SITE="${WTYG_SITE:-https://www.welcometoyourgalaxy.com}"
  if ! curl -sS -o /dev/null -A "Mozilla/5.0" --max-time 30 "$SITE/suppression.html"; then
    echo "  warning: $SITE could not be reached (the error is above). Maps on the site's own pages will be skipped." >&2
    echo "           Set WTYG_SITE to the address in your browser bar, or WTYG_SITE_RECORD to a folder of saved pages." >&2
  fi
fi

mkdir -p data/raw data/normalized map/tiles
# Each source is run directly rather than through harvest.py, which skips
# sources marked as built locally (so the weekly refresh leaves them alone).
python3 - "$IDS" <<'PY'
import json, pathlib, sys, traceback
sys.path.insert(0, "pipeline")
import harvest
wanted = sys.argv[1].split(",")
meta = {s["id"]: s for s in harvest.REGISTRY["sources"]}
for sid in wanted:
    if sid not in meta:
        continue
    try:
        count, problem = harvest.harvest_one(meta[sid])
        print(f"  {'wait' if problem else 'ok  '}  {sid:<26} {problem or str(count) + ' rows'}")
    except Exception:
        print(f"  FAIL  {sid}:")
        traceback.print_exc(limit=2)
PY

chmod +x pipeline/build_tiles.sh
for id in $(tr ',' ' ' <<< "$IDS"); do
  raw="data/raw/$id.jsonl.gz"
  [ -f "$raw" ] || raw="data/raw/$id.json"
  if [ ! -f "$raw" ]; then
    echo "  no rows for $id — see the harvest lines above" >&2
    continue
  fi
  python3 pipeline/normalize.py --source "$id" --in "$raw" --out "data/normalized/$id.geojsonl"
  TILE_TMPDIR="${TILE_TMPDIR:-/tmp}" ./pipeline/build_tiles.sh "$id" "data/normalized/$id.geojsonl" map/tiles
done
echo "Building shapes (countries, regions, lines)…"
python3 pipeline/shapes/build_shapes.py ${1:+"$1"}
echo "Building the site's own maps (places and boxes)…"
python3 pipeline/sitemaps/build_boxes.py ${1:+"$1"}
echo "Done. New archives are in map/tiles/, shapes in map/data/shapes/."
