#!/usr/bin/env bash
# Split a Climate TRACE extract by sector and build one archive per sector.
#
# Usage: split_sectors.sh <sorted.geojsonl.gz> [out_dir]
#
# Environment:
#   SPLIT_KEY   property to split on. Default x_sector. Set to x_subsector to
#               break a sector that is still over the file cap — agriculture is
#               907,067 features and 264 MB on its own.
#   PREFIX      archive id prefix. Default climate_trace.
#
# WHY SPLIT
# One month of Climate TRACE is 1,696,198 features and tiles to ~475 MB, past
# GitHub's 100 MB file cap. Split by sector, each archive fits in the repo and
# needs no object store, no account and no proxy in front of every tile.
#
# It is also a better map. One switch for "all emissions" is not how the rest of
# this atlas works — coal, power plants and carbon bombs are separate layers
# because they measure different things, and agriculture and electricity differ
# at least as much. Split, a reader can look at power without cropland fires.
#
# SECTORS ARE DISCOVERED, NOT LISTED
# The sector names come from the data on each run. Hardcoding them means a
# sector Climate TRACE adds is silently dropped, and one they rename builds an
# empty archive — both of which look like a working map with less in it.

set -euo pipefail

INPUT="${1:?sorted geojsonl.gz required}"
OUTDIR="${2:-map/tiles}"
SPLIT_KEY="${SPLIT_KEY:-x_sector}"
PREFIX="${PREFIX:-climate_trace}"
WORK="${TILE_TMPDIR:-${TMPDIR:-/tmp}}/ct-split"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Checked up front. Without this a mistyped path runs the whole pipeline against
# nothing, prints "TOTAL 0" and exits — which looks like a file with no sectors
# in it rather than a file that is not there.
if [ ! -f "$INPUT" ]; then
  echo "::error::no such input: $INPUT" >&2
  ls "$(dirname "$INPUT")" 2>/dev/null | head -20 | sed 's/^/  candidate: /' >&2 || true
  exit 1
fi

mkdir -p "$WORK" "$OUTDIR"

# Keyed by the input file as well as the split key, and emptied first.
#
# Without both, a second run writes its parts beside the first run's and the
# build loop globs everything it finds — so splitting forestry after agriculture
# rebuilt all nine agriculture subsectors under the forestry prefix. The archives
# were valid, correctly sized and completely mislabelled, which is worse than a
# crash: nothing reported an error.
WORK="${WORK}/${SPLIT_KEY}/$(basename "$INPUT" .geojsonl.gz)"
rm -rf "$WORK"
mkdir -p "$WORK"
echo "Splitting $INPUT by $SPLIT_KEY into $WORK"

# One pass, writing every sector's file as it goes. Reading the input once per
# sector would mean nine passes over 1.6 GB; this is one, and it preserves the
# magnitude sort within each sector because lines are appended in input order.
gzip -cd "$INPUT" | python3 -c '
import sys, json, os, gzip, collections

work, key = sys.argv[1], sys.argv[2]
handles, counts = {}, collections.Counter()
skipped = 0

for line in sys.stdin:
    try:
        sector = json.loads(line)["properties"].get(key)
    except Exception:
        skipped += 1
        continue
    if not sector:
        # A feature with no sector is not filed under a guess. Counted and
        # reported, so a change upstream shows up as a number rather than as a
        # layer quietly missing rows.
        skipped += 1
        continue
    slug = "".join(c if c.isalnum() else "_" for c in sector.lower())
    if slug not in handles:
        handles[slug] = gzip.open(os.path.join(work, slug + ".geojsonl.gz"), "wt")
    handles[slug].write(line)
    counts[slug] += 1

for h in handles.values():
    h.close()

for slug, n in counts.most_common():
    print(f"  {slug:<24} {n:>10,}")
if skipped:
    print("  %-24s %10s" % ("(no sector, not written)", format(skipped, ",")))
print("  %-24s %10s" % ("TOTAL", format(sum(counts.values()), ",")))
' "$WORK" "$SPLIT_KEY"

# Build each sector. A failure in one does not stop the rest — a sector that
# cannot be tiled should be visibly absent, not take the other eight with it.
FAILED=()
for f in "$WORK"/*.geojsonl.gz; do
  slug="$(basename "$f" .geojsonl.gz)"
  echo
  echo "=== ${PREFIX}_${slug} ==="
  if ! "$HERE/build_tiles.sh" "${PREFIX}_${slug}" "$f" "$OUTDIR"; then
    FAILED+=( "$slug" )
  fi
done

echo
echo "Archives in $OUTDIR:"
ls -lh "$OUTDIR"/${PREFIX}_*.pmtiles 2>/dev/null | awk '{print "  " $9 "  " $5}'

if [ ${#FAILED[@]} -gt 0 ]; then
  echo
  echo "::error::these sectors did not build: ${FAILED[*]}"
  exit 1
fi

echo
echo "Add each id to CT_SECTORS in map/app.js. Any archive still over 100 MB"
echo "needs splitting further or a lower MAXZOOM — it cannot go in the repo."
