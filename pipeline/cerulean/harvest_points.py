#!/usr/bin/env python3
"""
Every Cerulean slick and every slick source, as a point, for the wide views.

Cerulean draws a slick's shape only close up; wider out it can give a count
for an area but not where the slicks are. This asks its API for every record
with its shape swapped for the smallest box around it (tipg's bbox-only), puts
a point in the middle of that box, keeps each record's id, and tiles the lot
into one archive per collection (a click on a point reads the whole record
from Cerulean by that id, so every field is shown and the files stay small):

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
PAGE = 2000                      # small pages: deep ones time out at 10,000
ROOT = pathlib.Path(__file__).resolve().parents[2]
WORK = ROOT / "data" / "cerulean"
TILES = ROOT / "map" / "tiles"
# collection, archive name, deepest zoom the map shows the points at
JOBS = {
    "slicks":  ("public.slick_plus",  "cerulean_slick_points", 5),
    "sources": ("public.source_plus", "cerulean_source_points", 7),
}
PAGES_FILE_CAP = 95 * 1024 * 1024   # under GitHub's 100 MB per file


class Refused(Exception):
    pass


def get(url, tries=8):
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "WelcomeToYourGalaxy culprits map"})
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403, 404, 422):
                body = e.read().decode("utf-8", "replace")[:300]
                raise Refused(f"{e.code}: {body}")
            wait = 10 * (n + 1)
            print(f"  {e.code} from Cerulean, trying again in {wait} s")
        except Exception as e:  # timeouts, dropped connections
            wait = 10 * (n + 1)
            print(f"  {type(e).__name__}: {e} — trying again in {wait} s")
        time.sleep(wait)
    sys.exit(f"Cerulean did not answer after {tries} tries: {url}")


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


def page_url(collection, state):
    q = {"limit": PAGE, "bbox-only": "true", "properties": "id"}
    if state["mode"] == "keyset":
        # Each page starts after the last id seen: as fast deep in as at the
        # start, where an offset makes the server count past every row first.
        q.update({"sortby": "id", "filter-lang": "cql2-text"})
        if state["last"] is not None:
            last = state["last"]
            q["filter"] = f"id > {last}" if isinstance(last, (int, float)) else "id > '" + str(last).replace("'", "''") + "'"
    else:
        q["offset"] = state["offset"]
    return f"{API}/collections/{collection}/items?" + urllib.parse.urlencode(q)


def harvest(job):
    collection, name, _ = JOBS[job]
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / f"{name}.geojsonl.gz"
    state_file = WORK / f"{name}.state.json"
    fresh = {"mode": "keyset", "last": None, "offset": 0, "written": 0, "no_position": 0}
    state = json.loads(state_file.read_text()) if state_file.exists() else dict(fresh)
    if "mode" not in state:          # left by the first version of this script
        state = dict(fresh)
    if state == fresh and out.exists():
        out.unlink()

    total = get(f"{API}/collections/{collection}/items?limit=0").get("numberMatched")
    print(f"{collection}: " + (f"{total:,} records" if isinstance(total, int) else "record count not given"))

    while True:
        try:
            page = get(page_url(collection, state))
        except Refused as e:
            if state["mode"] == "keyset":
                # Start again from the top, paging by position. Mixing the two
                # orders part way through would miss or repeat records.
                print(f"  paging by id refused ({e}); starting again, paging by position")
                state = dict(fresh, mode="offset")   # a new copy; fresh itself is never changed
                if out.exists():
                    out.unlink()
                continue
            sys.exit(f"Cerulean refused a page: {e}")
        feats = page.get("features") or []
        with gzip.open(out, "at", encoding="utf-8") as f:
            for ft in feats:
                fid = ft.get("id", (ft.get("properties") or {}).get("id"))
                b = box_of(ft.get("geometry"))
                if not b:
                    state["no_position"] += 1
                    continue
                w, s, e, n = b
                f.write(json.dumps({"type": "Feature", "properties": {"id": fid, "_count": 1},
                                    "geometry": {"type": "Point",
                                                 "coordinates": [round((w + e) / 2, 5), round((s + n) / 2, 5)]}},
                                   separators=(",", ":")) + "\n")
                state["written"] += 1
        if feats:
            last = feats[-1].get("id", (feats[-1].get("properties") or {}).get("id"))
            if state["mode"] == "keyset" and last == state["last"]:
                sys.exit("Paging by id is not moving forward; delete data/cerulean and tell Claude.")
            state["last"] = last
        state["offset"] += len(feats)
        state_file.write_text(json.dumps(state))
        done = state["written"] + state["no_position"]
        print(f"  {done:,}" + (f" of {total:,}" if isinstance(total, int) else ""))
        if len(feats) < PAGE:
            break

    print(f"  {state['written']:,} points written; {state['no_position']:,} records came with no position and are not drawn")
    return name, out, state


def tile(name, src, state):
    TILES.mkdir(parents=True, exist_ok=True)
    dest = TILES / f"{name}.pmtiles"
    part = TILES / f"{name}.partial.pmtiles"
    maxz = next(z for (_, n, z) in JOBS.values() if n == name)
    cmd = ["tippecanoe", "--quiet", "--force", f"--output={part}", f"--layer={name}", f"--name={name}",
           "--minimum-zoom=0", f"--maximum-zoom={maxz}", "--full-detail=12",
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
