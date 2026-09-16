#!/usr/bin/env bash
# Turn normalized line-delimited GeoJSON into one .pmtiles archive per source.
#
# Usage: build_tiles.sh <source_id> <normalized.geojsonl> [out_dir]
#
# Default out_dir is map/tiles — GitHub Pages serves map/, and the map fetches
# ./tiles/<id>.pmtiles relative to itself. A history archive built for R2 should
# be written somewhere else and uploaded; nothing here knows about R2.
#
# Environment:
#   TILE_TMPDIR   where tippecanoe writes scratch. See the note below — at
#                 100M+ features this is the difference between a build and a
#                 disk-full failure, and tippecanoe does NOT read TMPDIR.
#   EXCLUDE       space-separated property names to leave out of the archive.
#                 See the note on constants below before adding to it.
#   DETAIL        tippecanoe's -d, coordinate resolution WITHIN a tile. Default
#                 12, which is tippecanoe's own. See the note below.
#
# NOTHING IS CLUSTERED, AND THE COMMENTS USED TO SAY OTHERWISE
# An earlier version of this header described clustering below zoom 8. There is
# no --cluster-distance and no --cluster-maxzoom in the command below, and there
# has not been since clustering was removed: a merged feature inherits one
# arbitrary member's name and owner, so the map was captioning a dot of 34,936
# power plants with one plant's operator. tippecanoe thins only the densest
# points when a single tile would exceed its size limit, and only in that tile.
# Nothing is dropped from the dataset and zooming in restores full detail.
#
# One consequence worth knowing: normalize.py writes `_count: 1` on every
# feature so that tippecanoe can sum it when features merge. Since features
# never merge, every `_count` is 1, and the map's aggregate layer sizes its dots
# by magnitude rather than by member count. That is the intended path, not a
# fallback — but a future change that reintroduces clustering would silently
# change what those dots mean.

set -euo pipefail

SOURCE="${1:?source id required}"
INPUT="${2:?input geojsonl required}"
OUTDIR="${3:-map/tiles}"

mkdir -p "$OUTDIR"
OUT="$OUTDIR/${SOURCE}.pmtiles"

# Built under a different name and moved into place only on success.
#
# A failed tippecanoe leaves a partial file behind, and the map's HEAD check
# cannot tell a 28 KB husk from a real archive — it sees 200 OK and registers a
# source that renders nothing. That happened, and it reads as a broken layer
# rather than a failed build. With an atomic move, a failure leaves no archive
# at all, which the map reports honestly as "archive missing".
# The PID is in the name because two builds of the same source running at once
# would otherwise write to one path and interleave into a corrupt archive that
# still reports a size and still passes a HEAD check. That happened: two
# overlapping runs produced a 593 MB file that no reader could open.
# THE EXTENSION MUST STAY .pmtiles. tippecanoe chooses its output format from
# the filename, so a partial called <id>.pmtiles.1234.partial makes it write
# MBTiles — a valid SQLite file with the right size and the wrong format, which
# the mv then installs under a .pmtiles name. It reads back as
# MagicNumberNotFound, and without the world-tile check it would have shipped.
PARTIAL="${OUT%.pmtiles}.$$.partial.pmtiles"
trap 'rm -f "$PARTIAL"' EXIT

# And refuse to start if another build of this source is already running, since
# the second one would win the mv and the first would vanish mid-write.
if ls "${OUT%.pmtiles}."*.partial.pmtiles >/dev/null 2>&1; then
  echo "::error::another build of ${SOURCE} is already running (found $(ls "${OUT%.pmtiles}."*.partial.pmtiles)). Wait for it, or delete that file if it is stale." >&2
  exit 1
fi

# Maximum zoom in the archive, NOT a clustering threshold. The map's own
# CLUSTER_MAXZOOM (map/app.js, currently 8) is where it stops drawing the
# aggregate layer and starts drawing individual features; it is a separate
# number and the two do not have to match. Past this zoom the map keeps
# rendering from the highest tiles available, so raising it costs archive size
# and gains precision at close range.
#
# Per source, from `tile_maxzoom` in sources.json, because two archives only fit
# under GitHub's 100 MiB file cap below 12: local_projects at 10 (142 MB at 12)
# and abattoir_facilities at 11 (112 MB at 12, 84 MB at 11). Held in the
# registry rather than typed on a command line, so the weekly refresh builds
# them the same way a hand build does. MAXZOOM in the environment still wins.
MAXZOOM="${MAXZOOM:-$(python3 -c "
import json
reg = {x['id']: x for x in json.load(open('sources.json'))['sources']}
print(reg.get('$SOURCE', {}).get('tile_maxzoom', 12))
")}"

# Coordinate resolution inside each tile, as a power of two: detail 12 divides a
# tile into 4096 units, detail 10 into 1024.
#
# THIS IS NOT A ZOOM CHANGE. Every zoom level still exists and the map still
# separates features at every scale it did before; what changes is how finely a
# position is recorded within its tile. At z12 a tile spans roughly 10 km, so
# detail 12 records to about 2.4 m and detail 10 to about 10 m.
#
# Ten metres is below the precision this data claims. 68 of Climate TRACE's 91
# asset definitions are not facilities — they are GADM administrative units,
# model grid cells and operation-level estimates — and those already carry
# `precision` flags that make the map draw them hollow. Recording a province
# centroid to 2.4 m spends bytes asserting something the source does not say.
#
# Left at tippecanoe's default so other sources are unaffected. Pass DETAIL=10
# for the Climate TRACE builds.
DETAIL="${DETAIL:-12}"

# Scratch space. tippecanoe ignores TMPDIR and defaults to /tmp, which on a Mac
# is the internal disk regardless of where the input and output live — so a
# build whose data sits on an external drive still fails when /tmp fills.
#
# Measured: 112M features needed roughly 10 GB of scratch. A GitHub runner has
# about 14 GB total, which is what forced these builds local.
TILE_TMPDIR="${TILE_TMPDIR:-${TMPDIR:-/tmp}}"
mkdir -p "$TILE_TMPDIR"

# Properties to leave out.
#
# tippecanoe stores every attribute at every zoom, so a property with one value
# across the whole archive is written ~13 times per feature to say nothing. In
# the first climate_trace month build, six of the twenty-one properties were
# constant: unit and licence (both already in the layer config and the archive's
# attribution), source (the layer's own id), and x_start_time / x_end_time,
# which restate x_period as full timestamps.
#
# x_sector and x_subsector joined them once the month was split: each archive IS
# one subsector, so both are constant within the file. THAT IS ONLY TRUE OF A
# SPLIT ARCHIVE — building a whole month in one file again would need them back,
# or the sector would be unrecoverable from the tiles.
#
# x_country is different: it varies, and it is dropped because it is derivable.
# Every feature has a coordinate, and a coordinate already says which country it
# is in. This is the one exclusion that removes information rather than
# repetition, and it is safe only because the information is reconstructable.
#
# x_period is deliberately NOT excluded. It is constant in a single-month
# archive but varies in a year archive, where the map's month facet reads it out
# of the metadata. Excluding it would silently empty that facet.
#
# Still carried, and not to be dropped without a decision: x_owner, x_capacity
# and x_capacity_units. They are unused by the map today and are exactly the
# facets a map about responsibility will want next.
#
# What does NOT help, measured rather than assumed: tippecanoe's --full-detail.
# Dropping it from 12 to 10 produced a byte-identical archive for
# climate_trace_power — 15 MB, same world tile, same feature count. Detail
# reduces coordinate precision within a tile, which shrinks long polygon and
# line boundaries; a point is two small integers either way. The weight in this
# data is attributes, not geometry. Rounding source coordinates fails for the
# same reason.
EXCLUDE="${EXCLUDE-unit licence source x_start_time x_end_time x_sector x_subsector x_country}"
EXCLUDE_ARGS=()
for prop in $EXCLUDE; do EXCLUDE_ARGS+=( "--exclude=$prop" ); done

# A truncated input is the quiet failure this guard exists for.
#
# normalize.py raises on a bad row rather than guessing, so a crash leaves a
# partial .geojsonl.gz behind. Run as a separate command, this script then tiles
# it happily: epa_tri_sites built an archive of 16,000 features where the
# harvest had produced 36,755, and nothing in the output said so. gzip -t reads
# the whole stream and fails on a file whose trailer is missing, which is
# exactly what an interrupted writer leaves.
case "$INPUT" in
  *.gz)
    if ! gzip -t "$INPUT" 2>/dev/null; then
      echo "::error::${INPUT} is truncated or corrupt — the step that wrote it did not finish. Not tiling a partial dataset." >&2
      exit 1
    fi
    ;;
esac

case "$INPUT" in
  *.gz) FEATURES=$(gzip -cd "$INPUT" | wc -l) ;;
  *)    FEATURES=$(wc -l < "$INPUT") ;;
esac
FEATURES=$(( FEATURES + 0 ))

# Rough guide from the one large build that has been measured: ~10 GB of scratch
# for ~112M features, so about 90 bytes per feature. Reported rather than
# enforced, because the ratio varies with geometry and attribute width and a
# hard gate would refuse builds that would have worked.
NEED_MB=$(( FEATURES / 11000 ))
FREE_MB=$(df -Pm "$TILE_TMPDIR" | awk 'NR==2 {print $4}')
echo "$SOURCE: $(printf "%'d" "$FEATURES" 2>/dev/null || echo "$FEATURES") features"
echo "  scratch: $TILE_TMPDIR — ${FREE_MB} MB free, roughly ${NEED_MB} MB wanted"
echo "  excluding: ${EXCLUDE:-(nothing)}"
echo "  max zoom ${MAXZOOM}, tile detail ${DETAIL}"
if [ "$NEED_MB" -gt 0 ] && [ "$FREE_MB" -lt "$NEED_MB" ]; then
  echo "::warning::${SOURCE}: ${FREE_MB} MB free where ~${NEED_MB} MB is expected." \
       "Set TILE_TMPDIR to a volume with room, e.g. TILE_TMPDIR=/Volumes/DRIVE/tile-tmp"
fi

# Attribution is baked into the archive so credit travels with the data even if
# the file is copied somewhere else.
ATTRIBUTION=$(python3 -c "
import json
reg = json.load(open('sources.json'))
by_id = {x['id']: x for x in reg['sources']}
sid = '$SOURCE'
# A split archive is not its own source. climate_trace_agriculture carries the
# same data under the same licence as climate_trace, so the id is shortened at
# underscores until one matches. Without this every sector archive would be
# stamped 'licence unchecked' and credit would stop travelling with the file.
while sid and sid not in by_id and '_' in sid:
    sid = sid.rsplit('_', 1)[0]
s = by_id.get(sid, {})
print('%s — %s' % (s.get('name', '$SOURCE'), s.get('licence', 'licence unchecked')))
")

tippecanoe \
  --quiet \
  --output="$PARTIAL" \
  --force \
  --layer="$SOURCE" \
  --name="$SOURCE" \
  --minimum-zoom=0 \
  --maximum-zoom="$MAXZOOM" \
  --full-detail="$DETAIL" \
  --drop-rate=1 \
  --drop-densest-as-needed \
  --preserve-input-order \
  --temporary-directory="$TILE_TMPDIR" \
  ${EXCLUDE_ARGS[@]+"${EXCLUDE_ARGS[@]}"} \
  --attribution="$ATTRIBUTION" \
  "$INPUT"

# Only now is it a real archive.
mv "$PARTIAL" "$OUT"
trap - EXIT

SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT")
echo "$SOURCE: $(( SIZE / 1024 / 1024 )) MB -> $OUT"

# Archive size is not what the reader pays. PMTiles fetches tiles by range
# request, so the number that matters is the heaviest tile someone actually
# loads — the world tile, which every visitor gets. Report it, because a large
# archive with small tiles is fine and a small archive with a 5 MB z0 tile is
# not.
FEATURE_COUNT="$FEATURES" python3 - "$OUT" "$SOURCE" <<'TILECHECK' || true
import sys, os
path, layer = sys.argv[1], sys.argv[2]

# Every import here is optional. This block reports on the archive; it does not
# make it. A missing library must not fail a build that already succeeded.
try:
    import gzip
    from pmtiles.reader import Reader, MmapSource
    import mapbox_vector_tile as mvt
except ImportError as e:
    print(f"{layer}: skipping world-tile report ({e})")
    raise SystemExit(0)

try:
    r = Reader(MmapSource(open(path, "rb")))
    z0 = r.get(0, 0, 0)
    if not z0:
        print(f"::error::{layer} has no world tile — the map will look empty at "
              f"the default zoom")
        raise SystemExit(0)
    kb = len(z0) / 1000
    raw = gzip.decompress(z0) if z0[:2] == b"\x1f\x8b" else z0
    shown = len(mvt.decode(raw).get(layer, {}).get("features", []))
    total = int(os.environ.get("FEATURE_COUNT", 0))
    frac = f" of {total:,}" if total else ""
    print(f"{layer}: world tile {kb:.0f} KB carrying {shown:,}{frac} features "
          f"— every visitor downloads this")
    if kb > 800:
        print(f"::warning::{layer} world tile is {kb:.0f} KB")

    # The map reads facet values out of this metadata rather than from a
    # hardcoded list, so a build that records none leaves the facet empty and
    # the layer looks like it has no data. Reported here, where the archive is
    # in hand, rather than discovered in a browser.
    md = r.metadata() or {}
    stats = md.get("tilestats")
    if not stats and md.get("json"):
        import json as _json
        try:
            stats = _json.loads(md["json"]).get("tilestats")
        except Exception:
            stats = None
    attrs = set()
    for lyr in (stats or {}).get("layers", []):
        for a in lyr.get("attributes", []):
            attrs.add(a.get("attribute"))
    if attrs:
        print(f"{layer}: metadata records value lists for {len(attrs)} attributes"
              + (" including x_period" if "x_period" in attrs else ""))
    else:
        print(f"::warning::{layer}: the archive records no per-attribute value "
              f"lists, so any facet reading them will come up empty")
except Exception as e:
    print(f"{layer}: could not inspect archive ({type(e).__name__}: {e})")
    print(f"::warning::{layer}: the archive could not be read back. A corrupt "
          f"archive still has a size and still passes the map's HEAD check, so "
          f"do not publish this file until it opens.")
TILECHECK

# GitHub refuses files over 100 MB. Anything larger belongs in R2, which serves
# range requests the same way and costs nothing to read.
# GitHub blocks pushes of files over 100 MiB (104,857,600 bytes). Warned at 100
# MB decimal, which leaves ~4.6 MiB of headroom without crying wolf — an earlier
# threshold of 99,000,000 flagged 95 and 96 MiB archives that fit perfectly well,
# and a warning that fires on files which are fine teaches you to ignore it.
if [ "$SIZE" -gt 100000000 ]; then
  echo "::warning::${SOURCE}.pmtiles exceeds GitHub's 100 MB file limit — upload to R2 instead"
  echo "$SOURCE" >> "$OUTDIR/.needs-r2"
fi
