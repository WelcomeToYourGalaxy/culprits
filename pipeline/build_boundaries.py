#!/usr/bin/env python3
"""
Build the simplified national boundaries the country-level layers draw against.

Country aggregates need real borders, not centroids. The full boundaries file
is ~14.6 MB, far too much to load in a browser for a background layer, so it is
decimated here: coordinates rounded to a fixed grid, consecutive duplicates
dropped, and rings that collapse below a minimum point count removed.

This is deliberately crude. The layer's job is to show which country a total
belongs to at global zoom, not to be authoritative about coastlines, and the
source file is kept in the pipeline so the precision decision is visible rather
than baked into an opaque asset.
"""
import json, pathlib, sys
import requests
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import discover

PRECISION = 1      # decimal places ≈ 11 km at the equator
MIN_RING = 5       # rings with fewer points than this are noise at this scale
MIN_SPAN = 0.35    # drop rings whose bounding box is smaller than this, in
                   # degrees. Removes small islands, which a global choropleth
                   # cannot render legibly anyway. Countries that ARE small
                   # islands are exempted below so they don't vanish entirely.
OUT = pathlib.Path(__file__).resolve().parent.parent / "map" / "data" / "boundaries.geojson"


def thin(ring, keep_small=False):
    seen, out = None, []
    for x, y in ring:
        p = (round(x, PRECISION), round(y, PRECISION))
        if p != seen:
            out.append(list(p)); seen = p
    if len(out) < MIN_RING:
        return None
    if not keep_small:
        xs = [p[0] for p in out]; ys = [p[1] for p in out]
        if max(xs) - min(xs) < MIN_SPAN and max(ys) - min(ys) < MIN_SPAN:
            return None
    if out[0] != out[-1]:
        out.append(out[0])
    return out


def walk(geom, keep_small=False):
    t = geom["type"]
    if t == "Polygon":
        rings = [r for r in (thin(x, keep_small) for x in geom["coordinates"]) if r]
        return {"type": "Polygon", "coordinates": rings} if rings else None
    if t == "MultiPolygon":
        # Keep only the largest few parts: a country's mainland carries the
        # choropleth, and hundreds of islets are invisible at this scale.
        parts = sorted(geom["coordinates"], key=lambda poly: len(poly[0]), reverse=True)[:6]
        polys = []
        for poly in parts:
            rings = [r for r in (thin(x, keep_small) for x in poly) if r]
            if rings:
                polys.append(rings)
        return {"type": "MultiPolygon", "coordinates": polys} if polys else None
    return None


def main():
    url, _ = discover.github_file("datasets/geo-countries", "data/countries.geojson")
    src = requests.get(url, timeout=300).json()
    feats = []
    dropped = []
    for f in src["features"]:
        iso = f["properties"]["ISO3166-1-Alpha-3"]
        g = walk(f["geometry"])
        if not g:
            # A small-island country would otherwise disappear. Retry keeping
            # its small rings rather than losing the country from the map.
            g = walk(f["geometry"], keep_small=True)
        if not g:
            dropped.append(iso)
            continue
        feats.append({
            "type": "Feature",
            "id": f["properties"]["ISO3166-1-Alpha-3"],   # for feature-state joins
            "geometry": g,
            "properties": {
                "iso3": f["properties"]["ISO3166-1-Alpha-3"],
                "name": f["properties"]["name"],
            },
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                              separators=(",", ":")))
    print(f"{len(feats)} countries -> {OUT} ({OUT.stat().st_size/1e6:.2f} MB)")
    if dropped:
        print(f"dropped entirely: {dropped}")


if __name__ == "__main__":
    main()
