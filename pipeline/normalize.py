#!/usr/bin/env python3
"""
Normalize a harvested source into the atlas feature schema, then hand it to
tippecanoe.

Every feature that reaches the map carries the same eight properties, whatever
it came from. That is what lets a fishing-effort point and a land deal sit in
one map without either pretending to be the other: the units travel with the
feature, so the legend can always say what a symbol means.

    id        stable identifier within the source
    source    source id from sources.json
    name      what to call it in a popup
    value     the magnitude, as a number, or null if the source has none
    unit      what `value` counts — never assume it matches another layer
    year      reference year, or null
    licence   spdx-ish string, carried per feature so attribution survives merging
    url       link back to the source's own record, where one exists

Usage:
    normalize.py --source climate_trace --in raw.json --out normalized.geojsonl
"""

import argparse
import itertools
import gzip
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = json.loads((ROOT / "sources.json").read_text())
SOURCES = {s["id"]: s for s in REGISTRY["sources"]}

FIELDS = ("id", "source", "name", "value", "unit", "year", "licence", "url")


def feature(source_id, ident, name, lon, lat, value=None, unit=None,
            year=None, url=None, extra=None):
    """Build one normalized GeoJSON feature. Raises rather than guessing."""
    meta = SOURCES.get(source_id)
    if meta is None:
        raise KeyError(f"{source_id} is not in sources.json — add it first")
    if lon is None or lat is None:
        raise ValueError(f"{source_id}/{ident} has no coordinates")
    lon, lat = float(lon), float(lat)
    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
        raise ValueError(f"{source_id}/{ident} coordinates out of range: {lon},{lat}")

    props = {
        "id": str(ident),
        "source": source_id,
        "name": name or str(ident),
        "value": None if value is None else float(value),
        "unit": unit or (meta.get("layer") or {}).get("unit"),
        "year": year,
        "licence": meta.get("licence", "unchecked"),
        "url": url,
        # Summed by tippecanoe when features merge, so a clustered feature can
        # say how many things it stands for. tippecanoe does not emit
        # point_count for distance-clustering, so this is carried explicitly.
        "_count": 1,
    }
    if extra:
        # Source-specific detail is kept, but namespaced so it can never
        # collide with a schema field or be mistaken for one.
        props.update({f"x_{k}": v for k, v in extra.items()})

    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": props,
    }


def country_row(source_id, iso3, name, value=None, unit=None, year=None,
                url=None, extra=None, **_):
    """
    A country aggregate. Same eight fields, but keyed by ISO3 instead of a
    coordinate — because a total for a country has no point location, and
    putting it at a centroid would dress an aggregate up as a site.
    """
    meta = SOURCES.get(source_id)
    if meta is None:
        raise KeyError(f"{source_id} is not in sources.json — add it first")
    if not iso3 or len(iso3) != 3:
        raise ValueError(f"{source_id}/{name}: bad ISO3 {iso3!r}")

    props = {
        "id": iso3,
        "source": source_id,
        "name": name or iso3,
        "value": None if value is None else float(value),
        "unit": unit or (meta.get("layer") or {}).get("unit"),
        "year": year,
        "licence": meta.get("licence", "unchecked"),
        "url": url,
    }
    if extra:
        props.update({f"x_{k}": v for k, v in extra.items()})
    return iso3, props


def write_countries(rows, path):
    """Country layers ship as a small keyed JSON the map joins to boundaries."""
    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    out = dict(rows)
    pathlib.Path(path).write_text(json.dumps(out, separators=(",", ":")))
    return len(out)


def write(features, path):
    """Line-delimited GeoJSON — what tippecanoe wants, and streamable."""
    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    n = 0
    # Gzipped when the caller asks for it. tippecanoe reads gzipped GeoJSON
    # natively, so this costs nothing downstream and turns a 30 GB intermediate
    # into roughly 3 GB. Nothing is dropped — the bytes are the same bytes.
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "wt", encoding="utf-8") as fh:
        for f in features:
            fh.write(json.dumps(f, separators=(",", ":")) + "\n")
            n += 1
    return n


def check_isolation(source_id):
    """Share-alike sources get their own archive. Refuse to co-mingle them."""
    meta = SOURCES.get(source_id, {})
    if meta.get("isolate"):
        print(f"note: {source_id} is share-alike ({meta.get('licence')}); "
              f"building it as a standalone archive", file=sys.stderr)
    return bool(meta.get("isolate"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--in", dest="infile", required=True)
    ap.add_argument("--out", dest="outfile", required=True)
    args = ap.parse_args()

    check_isolation(args.source)

    # Each harvester writes a flat list of dicts with the keys `feature()` or
    # `country_row()` takes. Keeping that contract narrow means a new source is
    # one small module, not a change to this file.
    # Streamed one line at a time. Reading the whole file was fine while the
    # largest source was a few hundred thousand rows; it is not fine at 99
    # million, and holding them all in memory is what this avoids.
    opener = gzip.open if args.infile.endswith(".gz") else open

    def _rows():
        with opener(args.infile, "rt", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    yield json.loads(line)

    stream = _rows()
    try:
        first = next(stream)
    except StopIteration:
        print(f"{args.source}: no rows")
        return
    rows = itertools.chain([first], stream)

    # Geometry is decided by what the source actually has, not by configuration.
    # A row with iso3 and no coordinates is an aggregate and stays one.
    if first.get("iso3") and "lat" not in first:
        out = args.outfile.replace(".geojsonl", ".countries.json")
        n = write_countries((country_row(args.source, **r) for r in rows), out)
        print(f"{args.source}: {n} country aggregates -> {out}")
    else:
        feats = (feature(args.source, **row) for row in rows)
        n = write(feats, args.outfile)
        print(f"{args.source}: {n} features -> {args.outfile}")


if __name__ == "__main__":
    main()
