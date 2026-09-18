#!/usr/bin/env python3
"""
Every Cerulean slick and every slick source, as a point, for the wide views.

Cerulean draws a slick's shape only close up; wider out it can give a count
for an area but not where the slicks are. This asks its API for every record
with its shape swapped for the smallest box around it (tipg's bbox-only), puts
a point in the middle of that box, keeps every field the collection publishes
except its shapes, and tiles the lot into one archive per collection:

    map/tiles/cerulean_slick_points.pmtiles    from public.slick_plus
    map/tiles/cerulean_source_points.pmtiles   from public.source_plus

The map draws these below the zoom where the live shapes take over. Where
points crowd at a wide zoom they are merged, and a merged point carries how
many records it stands for (_count), so nothing is dropped from the count.

Resumable: a stopped run picks up where it left off. Delete
data/cerulean/*.state.json to start again from nothing.

Run from the repo root, with the venv on and tippecanoe installed:
    python3 pipeline/cerulean/harvest_points.py
Only one collection:
    python3 pipeline/cerulean/harvest_points.py slicks
    python3 pipeline/cerulean/harvest_points.py sources
"""
import gzip
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.cerulean.skytruth.org"
PAGE = 10000                     # tipg's largest page
ROOT = pathlib.Path(__file__).resolve().parents[2]
WORK = ROOT / "data" / "cerulean"
TILES = ROOT / "map" / "tiles"
JOBS = {
    "slicks":  ("public.slick_plus",  "cerulean_slick_points"),
    "sources": ("public.source_plus", "cerulean_source_points"),
}
PAGES_FILE_CAP = 95 * 1024 * 1024   # under GitHub's 100 MB per file


def get(url, tries=6):
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "WelcomeToYourGalaxy culprits map"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403, 404):
                body = e.read().decode("utf-8", "replace")[:300]
                sys.exit(f"Cerulean refused {url}\n  {e.code}: {body}")
            wait = 10 * (n + 1)
            print(f"  {e.code} from Cerulean, trying again in {wait} s")
        except Exception as e:  # timeouts, dropped connections
            wait = 10 * (n + 1)
            print(f"  {type(e).__name__}: {e} — trying again in {wait} s")
        time.sleep(wait)
    sys.exit(f"Cerulean did not answer after {tries} tries: {url}")


def fields(collection):
    """Every field the collection publishes, less its shapes."""
    q = get(f"{API}/collections/{collection}/queryables")
    keep = []
    for name, spec in (q.get("properties") or {}).items():
        text = json.dumps(spec).lower()
        if "geojson" in text or '"format": "geometry' in text:
            continue
        keep.append(name)
    return keep


def box_of(geom):
    xs, ys = [], []

    def walk(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            xs.append(c[0]); ys.append(c[1])
        elif isinstance(c, (list, tuple)):
            for d in c:
                walk(d)
    walk((geom or {}).get("coordinates"))
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def harvest(job):
    collection, name = JOBS[job]
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / f"{name}.geojsonl.gz"
    state_file = WORK / f"{name}.state.json"
    state = json.loads(state_file.read_text()) if state_file.exists() else {"offset": 0, "written": 0, "no_position": 0}
    if state["offset"] == 0 and out.exists():
        out.unlink()

    props = fields(collection)
    print(f"{collection}: {len(props)} fields — {', '.join(props)}")
    total = get(f"{API}/collections/{collection}/items?limit=0").get("numberMatched")
    print(f"  {total:,} records" if isinstance(total, int) else "  record count not given")

    while True:
        qs = urllib.parse.urlencode({"limit": PAGE, "offset": state["offset"], "bbox-only": "true",
                                     "properties": ",".join(props)})
        page = get(f"{API}/collections/{collection}/items?{qs}")
        feats = page.get("features") or []
        with gzip.open(out, "at", encoding="utf-8") as f:
            for ft in feats:
                b = box_of(ft.get("geometry"))
                if not b:
                    state["no_position"] += 1
                    continue
                w, s, e, n = b
                p = dict(ft.get("properties") or {})
                if ft.get("id") is not None and "id" not in p:
                    p["id"] = ft["id"]
                p["x_extent"] = f"{w:.4f},{s:.4f},{e:.4f},{n:.4f}"
                p["_count"] = 1
                f.write(json.dumps({"type": "Feature", "properties": p,
                                    "geometry": {"type": "Point", "coordinates": [round((w + e) / 2, 5), round((s + n) / 2, 5)]}},
                                   separators=(",", ":")) + "\n")
                state["written"] += 1
        state["offset"] += len(feats)
        state_file.write_text(json.dumps(state))
        shown = f"{state['offset']:,}" + (f" of {total:,}" if isinstance(total, int) else "")
        print(f"  {shown}")
        if len(feats) < PAGE:
            break

    print(f"  {state['written']:,} points written; {state['no_position']:,} records came with no position and are not drawn")
    return name, out, state


def tile(name, src, state):
    TILES.mkdir(parents=True, exist_ok=True)
    dest = TILES / f"{name}.pmtiles"
    part = TILES / f"{name}.partial.pmtiles"
    cmd = ["tippecanoe", "--quiet", "--force", f"--output={part}", f"--layer={name}", f"--name={name}",
           "--minimum-zoom=0", "--maximum-zoom=10", "--full-detail=12",
           # Crowded points are merged, never dropped, and each merged point
           # carries how many records it stands for.
           "--cluster-distance=2", "--cluster-densest-as-needed", "--accumulate-attribute=_count:sum",
           "--attribution=SkyTruth Cerulean (cerulean.skytruth.org) — potential slicks from Sentinel-1 radar, not confirmed spills",
           str(src)]
    print("  tiling…")
    subprocess.run(cmd, check=True)
    os.replace(part, dest)
    size = dest.stat().st_size
    print(f"  {dest.relative_to(ROOT)}: {size / 1048576:.1f} MB")
    if size > PAGES_FILE_CAP:
        print(f"  WARNING: over 95 MB — GitHub will refuse it. Tell Claude the size; it needs splitting.")
    (WORK / f"{name}.state.json").unlink(missing_ok=True)   # finished: the next run starts fresh


def main():
    wanted = sys.argv[1:] or list(JOBS)
    for job in wanted:
        if job not in JOBS:
            sys.exit(f"Unknown: {job}. Use slicks, sources, or nothing for both.")
    if subprocess.run(["which", "tippecanoe"], capture_output=True).returncode != 0:
        sys.exit("tippecanoe is not on this machine's path.")
    for job in wanted:
        name, src, state = harvest(job)
        tile(name, src, state)
    print("Done. Commit map/tiles/cerulean_*_points.pmtiles and push.")


if __name__ == "__main__":
    main()
