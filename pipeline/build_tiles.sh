#!/usr/bin/env bash
# Turn normalized line-delimited GeoJSON into one .pmtiles archive per source.
#
# A clustered feature inherits ONE arbitrary member's attributes — its name,
# operator, country, status. That is fine for the summed `value` and actively
# misleading for everything else, so the map must branch on `_count` and refuse
# to present a cluster's inherited fields as facts about it. See bindPopup().
#
# The zoom behaviour is done here, in the tiling, not in the map's JavaScript.
# Below zoom 8 tippecanoe clusters points into aggregate features and sums their
# `value`, so the global view is a snapshot of shape and magnitude rather than
# a million markers. From zoom 8 up, clustering stops and individual features
# appear, and the browser range-requests only the tiles it can see.
#
# Usage: build_tiles.sh <source_id> <normalized.geojsonl> <out_dir>

set -euo pipefail

SOURCE="${1:?source id required}"
INPUT="${2:?input geojsonl required}"
OUTDIR="${3:-dist/tiles}"

mkdir -p "$OUTDIR"
OUT="$OUTDIR/${SOURCE}.pmtiles"

# --cluster-maxzoom is the threshold the map's legend refers to. Changing it
# here changes where the map stops summarising and starts listing, so keep it
# in step with CLUSTER_MAXZOOM in map/index.html.
CLUSTER_MAXZOOM=8
MAXZOOM=12

# Attribution is baked into the archive so credit travels with the data even if
# the file is copied somewhere else.
ATTRIBUTION=$(python3 -c "
import json,sys
reg=json.load(open('sources.json'))
s={x['id']:x for x in reg['sources']}.get('$SOURCE',{})
print(f\"{s.get('name','$SOURCE')} — {s.get('licence','licence unchecked')}\")
")

tippecanoe \
  --quiet \
  --output="$OUT" \
  --force \
  --layer="$SOURCE" \
  --name="$SOURCE" \
  --minimum-zoom=0 \
  --maximum-zoom="$MAXZOOM" \
  --cluster-distance=12 \
  --cluster-maxzoom="$CLUSTER_MAXZOOM" \
  --accumulate-attribute=value:sum \
  --accumulate-attribute=_count:sum \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --preserve-input-order \
  --attribution="$ATTRIBUTION" \
  "$INPUT"

SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT")
echo "$SOURCE: $(( SIZE / 1024 / 1024 )) MB -> $OUT"

# GitHub refuses files over 100 MB. Anything larger belongs in R2, which serves
# range requests the same way and costs nothing to read.
if [ "$SIZE" -gt 99000000 ]; then
  echo "::warning::${SOURCE}.pmtiles exceeds GitHub's 100 MB file limit — upload to R2 instead"
  echo "$SOURCE" >> "$OUTDIR/.needs-r2"
fi
