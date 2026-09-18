#!/usr/bin/env python3
"""
Build map/data/shapes/<id>.geojson for every entry in pipeline/shapes/registry.json.

These are the parts of the site's maps that are not single points: shaded
countries and regions, lines between places, and per-country lists. Nothing is
filtered. Where a source keys its data by country, each country's outline comes
from map/data/boundaries.geojson and every entry for that country is carried in
full. A country code with no outline is reported, not guessed.

Colours a map gave its shapes are kept as `_map_colour`, softened so that no
shape is drawn in a bright or yellow-orange colour: saturation is capped, and
hues in the yellow-orange band are moved into the red-brown band beside it.

Usage, from the repo root:
  python3 pipeline/shapes/build_shapes.py                  every entry
  python3 pipeline/shapes/build_shapes.py leg_laws,gmo_trials
Weebly-page maps follow WTYG_SITE / WTYG_SITE_RECORD, as the point harvest does.
"""

import colorsys
import html
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

import requests

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
REG = json.loads((ROOT / "pipeline" / "shapes" / "registry.json").read_text())["layers"]
OUT = ROOT / "map" / "data" / "shapes"
EXTRACT = ROOT / "pipeline" / "sitemaps" / "extract.mjs"
SITE = os.environ.get("WTYG_SITE", "https://www.welcometoyourgalaxy.com").rstrip("/")
UA = {"User-Agent": "welcometoyourgalaxy-atlas/1.0"}

BOUNDS = json.loads((ROOT / "map" / "data" / "boundaries.geojson").read_text())["features"]
# Outlines by code. A few outlines carry no code (-99: France, Norway, Kosovo…);
# those are given one through the standard country-name table.
STD_NAMES = json.loads((ROOT / "pipeline" / "shapes" / "names_iso3.json").read_text())
OUTLINE = {}
for _f in BOUNDS:
    _code = _f["properties"]["iso3"]
    if len(_code) != 3 or not _code.isalpha():
        _code = STD_NAMES.get(_f["properties"]["name"].lower())
    if _code and _code not in OUTLINE:
        OUTLINE[_code] = _f
NAME_TO_ISO = dict(STD_NAMES)
NAME_TO_ISO.update({f["properties"]["name"].lower(): c for c, f in OUTLINE.items()})


# ---------------------------------------------------------------- helpers

def text(v):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", str(v)))).strip()


def soften(colour):
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", str(colour or "").strip())
    if not m:
        return None
    r, g, b = (int(m.group(1)[i:i + 2], 16) / 255 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    deg = h * 360
    if 25 <= deg < 70:                         # yellow-orange -> red-brown
        deg = 350 + (deg - 25) * (10 / 45)
    s = min(s, 0.32)
    l = min(max(l, 0.30), 0.62)
    r, g, b = colorsys.hls_to_rgb((deg % 360) / 360, l, s)
    return "#%02X%02X%02X" % tuple(round(c * 255) for c in (r, g, b))


def flat(obj, prefix=""):
    """Every value in a record, as name -> text, nested names joined with a dot."""
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.update(flat(v, f"{prefix}{k}." if isinstance(v, (dict, list)) else f"{prefix}{k}"))
    elif isinstance(obj, list):
        if all(not isinstance(x, (dict, list)) for x in obj):
            out[prefix.rstrip(".")] = " ; ".join(text(x) for x in obj if x not in (None, ""))
        else:
            for i, x in enumerate(obj):
                out.update(flat(x, f"{prefix}{i}."))
    elif obj not in (None, ""):
        out[prefix.rstrip(".")] = obj if isinstance(obj, (int, float, bool)) else text(obj)
    return out


def line_of(entry):
    if isinstance(entry, dict):
        parts = [text(entry.get(k)) for k in ("name", "title", "status", "focus", "type", "url", "desc") if entry.get(k)]
        rest = [f"{k}: {text(v)}" for k, v in flat(entry).items()
                if k not in ("name", "title", "status", "focus", "type", "url", "desc") and v not in ("", None)]
        return " — ".join(parts + rest)
    if isinstance(entry, list):
        return " — ".join(text(x) for x in entry if x not in (None, ""))
    return text(entry)


def country_feature(iso, props):
    f = OUTLINE.get(iso)
    if not f:
        return None
    return {"type": "Feature", "geometry": f["geometry"],
            "properties": dict({"country": f["properties"]["name"], "iso3": iso}, **props)}


def centre(iso):
    g = OUTLINE[iso]["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    ring = max((p[0] for p in polys), key=lambda r: abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(r, r[1:]))))
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        c = x0 * y1 - x1 * y0
        a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
    if not a:
        return ring[0]
    return [cx / (3 * a), cy / (3 * a)]


def to_iso(key):
    k = str(key).strip()
    if len(k) == 3 and k.upper() in OUTLINE:
        return k.upper()
    return NAME_TO_ISO.get(k.lower())


def get_json(url):
    r = requests.get(url, headers=UA, timeout=300)
    r.raise_for_status()
    return r.json()


# ---------------------------------------------------------------- kinds

def from_geojson(e):
    d = get_json(e["url"])
    feats = []
    for f in d.get("features", []):
        props = flat(f.get("properties") or {})
        feats.append({"type": "Feature", "geometry": f["geometry"], "properties": props})
    return feats, []


def from_records(e):
    d = get_json(e["url"])
    recs = d.get(e["records"]) if e.get("records") else None
    if recs is None:
        # the list inside the file whose entries name a country
        recs = next((v for v in (d.values() if isinstance(d, dict) else [d])
                     if isinstance(v, list) and v and isinstance(v[0], dict)), [])
    by_iso, missing = {}, []
    for r in recs:
        tries = [r.get(e["iso"])] if e.get("iso") else []
        tries += [r.get(k) for k in ("iso3", "iso", "code", "country_name", "country", "state")]
        iso_raw = next((x for x in tries if x), None)
        iso = next((to_iso(x) for x in tries if x and to_iso(x)), None)
        if not iso:
            missing.append(str(iso_raw))
            continue
        by_iso.setdefault(iso, []).append(r)
    # Entries below country level with no outline of their own (US states)
    # are listed under their country rather than left out.
    extra = {}
    if e.get("also"):
        for r in d.get(e["also"]["key"], []):
            extra.setdefault(e["also"]["iso"], []).append(f"{e['also']['label']} {line_of(r)}")
    statuses = d.get("statuses") if isinstance(d, dict) else None
    feats = []
    for iso in set(by_iso) | set(extra):
        rows = by_iso.get(iso, [])
        lines = [line_of(r) for r in rows] + extra.get(iso, [])
        props = {"entries": len(lines), "list": "\n".join(lines)}
        if len(rows) == 1:
            props.update(flat(rows[0]))
            if statuses and rows[0].get("status") in statuses:
                st = statuses[rows[0]["status"]]
                props["status_label"] = st.get("label")
                c = soften(st.get("colour"))
                if c:
                    props["_map_colour"] = c
        f = country_feature(iso, props)
        (feats.append(f) if f else missing.append(iso))
    return feats, missing


def from_tree(e):
    d = get_json(e["url"])
    feats, missing = [], []
    for key, val in d.items():
        if key.startswith("_"):
            continue
        iso = to_iso(key)
        lines = []
        if isinstance(val, dict) and "trackers" in val:
            lines = [line_of(t) for t in val["trackers"]]
        elif isinstance(val, dict):
            for region, inner in val.items():
                if region == "name":
                    continue
                items = inner.get("trackers", []) if isinstance(inner, dict) else inner if isinstance(inner, list) else [inner]
                lines += [f"{region}: {line_of(t)}" for t in items]
        elif isinstance(val, list):
            lines = [line_of(t) for t in val]
        f = country_feature(iso, {"entries": len(lines), "list": "\n".join(lines)}) if iso else None
        (feats.append(f) if f else missing.append(key))
    return feats, missing


def from_routes(e):
    d = get_json(e["url"])
    feats, missing = [], []
    for r in d.get(e["records"], []):
        a, b = to_iso(r.get("from")), to_iso(r.get("to"))
        if not a or not b:
            missing.append(f"{r.get('from')}->{r.get('to')}")
            continue
        props = flat(r)
        if a == b:
            geom = {"type": "Point", "coordinates": centre(a)}
        else:
            geom = {"type": "LineString", "coordinates": [centre(a), centre(b)]}
        feats.append({"type": "Feature", "geometry": geom, "properties": props})
    return feats, missing


def iso2_to_iso3():
    # From the outlines' own names would miss codes; use the standard table shipped with this script.
    table = json.loads((ROOT / "pipeline" / "shapes" / "iso2_iso3.json").read_text())
    return table


def from_enviro_files(e):
    headers = {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"} if os.environ.get("GITHUB_TOKEN") else {}
    tree = requests.get(f"https://api.github.com/repos/{e['repo']}/git/trees/HEAD?recursive=1", headers=headers, timeout=60)
    tree.raise_for_status()
    paths = sorted(t["path"] for t in tree.json()["tree"] if re.fullmatch(r"[A-Z]{2}(_[^/]+)?\.json", t["path"]))
    table = iso2_to_iso3()
    by_iso, missing = {}, []
    for p in paths:
        code = p[:2]
        iso = table.get(code)
        region = p[3:-5].replace("_", " ") if len(p) > 7 else None
        try:
            data = get_json(f"https://raw.githubusercontent.com/{e['repo']}/HEAD/{p}")
        except Exception as ex:
            missing.append(f"{p} ({ex})")
            continue
        if not iso or iso not in OUTLINE:
            missing.append(p)
            continue
        entries = data if isinstance(data, list) else next((v for v in data.values() if isinstance(v, list)), [data]) \
            if isinstance(data, dict) else [data]
        by_iso.setdefault(iso, []).extend((f"{region}: " if region else "") + line_of(x) for x in entries)
    feats = [country_feature(iso, {"entries": len(lines), "list": "\n".join(lines)}) for iso, lines in by_iso.items()]
    return feats, missing


def from_extract(e):
    if "url" in e:
        spec = {"url": e["url"]}
    else:
        rec = os.environ.get("WTYG_SITE_RECORD")
        spec = {"file": str(pathlib.Path(rec) / f"{e['page']}.html")} if rec else {"url": f"{SITE}/{e['page']}.html"}
        spec["block"] = e["block"]
        if e.get("decode"):
            spec["decode"] = e["decode"]
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as fh:
        spec["out"] = fh.name
    subprocess.run(["node", str(EXTRACT), json.dumps(spec)], check=True, timeout=400)
    d = json.loads(pathlib.Path(spec["out"]).read_text())
    os.unlink(spec["out"])
    for n in d.get("notes", []):
        print(f"  {e['id']}: note: {n}")
    feats = []
    for f in d["features"]:
        if f["kind"] == "point":
            if e.get("shapes_only"):
                continue
            geom = {"type": "Point", "coordinates": [f["lon"], f["lat"]]}
        else:
            g = f.get("geometry") or {}
            geom = leaflet_geometry(g)
            if not geom:
                continue
        props = flat(f.get("props") or {})
        if f.get("popup_text") or f.get("tooltip"):
            props["from_the_map"] = f.get("popup_text") or f.get("tooltip")
        c = soften(f.get("color"))
        if c:
            props["_map_colour"] = c
        feats.append({"type": "Feature", "geometry": geom, "properties": props})
    return feats, []


def leaflet_geometry(g):
    t, c = g.get("type"), g.get("coordinates")
    if t in ("Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon") and c and isinstance(_first_number(c), (int, float)):
        # GeoJSON from L.geoJSON is already [lon, lat]; latlngs from L.polygon / L.polyline are [lat, lon] pairs
        # or {lat, lng} objects, recorded by extract.mjs under the same type name.
        if g.get("_leaflet"):
            c = _swap(c)
            depth = _depth(c)
            if t == "Polygon":
                if depth == 2:
                    c, t = [c], "Polygon"
                elif depth == 4:
                    t = "MultiPolygon"
                c = _close(c)
            elif t == "LineString" and depth == 3:
                t = "MultiLineString"
        return {"type": t, "coordinates": c}
    if t == "Rectangle" and c:
        (s, w), (n, e) = _pairs(c)[:2]
        return {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}
    return None


def _depth(c):
    d = 0
    while isinstance(c, list) and c:
        c, d = c[0], d + 1
    return d


def _close(c):
    if _depth(c) == 2:
        return c + [c[0]] if c and c[0] != c[-1] else c
    return [_close(x) for x in c]


def _first_number(c):
    while isinstance(c, list) and c:
        c = c[0]
    return c


def _pairs(c):
    if isinstance(c, dict):
        return [(c["lat"], c.get("lng", c.get("lon")))]
    if isinstance(c, list) and len(c) == 2 and all(isinstance(x, (int, float)) for x in c):
        return [tuple(c)]
    out = []
    for x in c or []:
        out += _pairs(x)
    return out


def _swap(c):
    if isinstance(c, dict):
        return [c.get("lng", c.get("lon")), c["lat"]]
    if isinstance(c, list) and len(c) == 2 and all(isinstance(x, (int, float)) for x in c):
        return [c[1], c[0]]
    return [_swap(x) for x in c]


KINDS = {"geojson": from_geojson, "records_by_iso": from_records, "tree": from_tree,
         "routes": from_routes, "enviro_files": from_enviro_files, "extract": from_extract}


def main():
    wanted = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    OUT.mkdir(parents=True, exist_ok=True)
    for e in REG:
        if wanted and e["id"] not in wanted:
            continue
        try:
            feats, missing = KINDS[e["kind"]](e)
        except Exception as ex:
            print(f"  FAIL  {e['id']}: {ex}")
            continue
        feats = [f for f in feats if f]
        if not feats:
            print(f"  wait  {e['id']}: nothing to draw")
            continue
        # Long text (per-country lists, the map's own words) goes in a second
        # file that the map fetches on the first click, so ticking the layer
        # only downloads the shapes. Every field is kept.
        details = {}
        for i, f in enumerate(feats):
            props = f.get("properties") or {}
            heavy = {k: v for k, v in props.items()
                     if k in ("list", "from_the_map") or (isinstance(v, str) and len(v) > 300)}
            if heavy:
                details[str(i)] = heavy
                light = {k: v for k, v in props.items() if k not in heavy}
                light["_k"] = str(i)
                if "list" in heavy and "entries" not in light:
                    light["entries"] = len(str(heavy["list"]).split("\n"))
                f["properties"] = light
        path = OUT / f"{e['id']}.geojson"
        path.write_text(json.dumps({"type": "FeatureCollection", "details": bool(details), "features": feats},
                                   ensure_ascii=False, separators=(",", ":")))
        dpath = OUT / f"{e['id']}.details.json"
        if details:
            dpath.write_text(json.dumps(details, ensure_ascii=False, separators=(",", ":")))
        elif dpath.exists():
            dpath.unlink()
        kinds = {}
        for f in feats:
            kinds[f["geometry"]["type"]] = kinds.get(f["geometry"]["type"], 0) + 1
        miss = f"; {len(missing)} without an outline or position: {', '.join(missing[:8])}{' …' if len(missing) > 8 else ''}" if missing else ""
        print(f"  ok    {e['id']}: {len(feats)} features {kinds}, {path.stat().st_size // 1024} KB{miss}")


if __name__ == "__main__":
    main()
