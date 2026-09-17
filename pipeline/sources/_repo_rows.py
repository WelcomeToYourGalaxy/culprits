"""
Shared harvester for the facility files in the accountability map repos
(executive-map, financial-map, legal-map, legislative-map, judicial-map).

Each file becomes one layer. The maps themselves read four fields per row —
latitude, longitude, name, link — and so does this. Some files carry more
fields after the link (an address, a phone number, an operator) without saying
which is which; those are kept as they are under "also in the file" rather
than given names the file does not give them.

Rows are dropped only when they have no usable position, and every drop is
counted and printed.
"""

import fnmatch
import gzip
import json
import os
import pathlib

import requests

import discover

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
REG = json.loads((ROOT / "pipeline" / "sitemaps" / "repo_layers.json").read_text())
LAYERS = {l["id"]: l for l in REG["layers"]}


def _num(v):
    try:
        f = float(v)
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def make(sid):
    meta = LAYERS[sid]
    repo = f"WelcomeToYourGalaxy/{meta['repo']}"

    def glob_files():
        # The files follow a regular grid (…_<lat>_<lon>.json.gz in 10° steps), so
        # every possible name is tried directly rather than asking GitHub's API for
        # a listing — the API allows 60 requests an hour without a token and a
        # full build uses them up. Names that do not exist answer 404 and are skipped.
        stem = meta["file"].split("*")[0]
        names = [meta["file"].replace("_*", "")]
        names += [f"{stem}{lat}_{lon}.json.gz" for lat in range(-90, 90, 10) for lon in range(-180, 180, 10)]
        return names

    def resolve():
        if meta.get("glob"):
            return f"https://github.com/{repo}", None      # many files: re-read every run
        return discover.github_file(repo, meta["file"])

    def load(path):
        r = requests.get(f"https://raw.githubusercontent.com/{repo}/HEAD/{path}", timeout=300)
        if r.status_code == 404:
            return []
        r.raise_for_status()
        return json.loads(gzip.decompress(r.content) if path.endswith(".gz") else r.content)

    def fetch():
        if meta.get("glob"):
            rows = []
            for path in glob_files():
                part = load(path)
                rows.extend(part if isinstance(part, list) else [])
        else:
            url, _ = resolve()
            r = requests.get(url, timeout=300)
            r.raise_for_status()
            rows = json.loads(gzip.decompress(r.content) if url.split("?")[0].endswith(".gz") else r.content)
        if meta.get("records"):
            rows = rows.get(meta["records"], []) if isinstance(rows, dict) else []
        out, bad, other_kind = [], 0, 0
        page = f"https://github.com/{repo}/blob/main/{meta['file']}"
        for i, row in enumerate(rows):
            if isinstance(row, dict) and meta.get("records"):
                # Named fields: every one the record carries is kept under its own name.
                lat, lon = _num(row.get(meta["lat"])), _num(row.get(meta["lon"]))
                name, link = row.get(meta["name_field"]), row.get(meta.get("url", "url"))
                named = {k: v for k, v in row.items()
                         if k not in (meta["lat"], meta["lon"], meta["name_field"], meta.get("url", "url"))
                         and isinstance(v, (str, int, float, bool)) and v != ""}
                rest = None
            elif isinstance(row, dict):      # judicial_facilities.json
                is_prison = row.get("k") == "p"
                if meta.get("kind") == "prison" and not is_prison or meta.get("kind") == "court" and is_prison:
                    other_kind += 1
                    continue
                lat, lon, name, link, rest, named = _num(row.get("la")), _num(row.get("lo")), row.get("n"), row.get("u"), [], None
            else:
                named = None
                if not isinstance(row, list) or len(row) < 2:
                    bad += 1
                    continue
                lat, lon = _num(row[0]), _num(row[1])
                name = row[2] if len(row) > 2 else None
                link = row[3] if len(row) > 3 else None
                rest = [str(x) for x in row[4:] if x not in (None, "")]
            if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
                bad += 1
                continue
            link = link if isinstance(link, str) and link.startswith("http") else None
            out.append({
                "ident": f"{meta['file']}#{i}",
                "name": name or "Unnamed in the source",
                "lon": lon, "lat": lat,
                "value": None, "unit": meta["unit"], "year": None, "url": link,
                "extra": (dict(named, from_file=page) if named is not None
                          else {"also_in_the_file": " ; ".join(rest) or None, "from_file": page}),
            })
        note = f", {other_kind} of the other kind left to its own layer" if other_kind else ""
        print(f"{sid}: {len(out)} of {len(rows)} rows{note}; {bad} without a usable position")
        return out

    return resolve, fetch
