"""
Development projects worldwide — from WelcomeToYourGalaxy/local-map.

401,100 projects across 826 tiles: mines, pipelines, LNG terminals, oil and gas
extraction, offshore wind, dredge spoil dumping, mineral tenements, and the
environmental-review and planning filings that precede them — harvested from 68
registers including the US Federal Register and public-land NEPA dockets, Canada's
IAAC, Chile's SEIA, Ireland's planning and EIA registers, Washington SEPA,
Saskatchewan EIA, EMODnet, Land Matrix, the World Bank, IATI, national WFS
services, and ArcGIS and Socrata portals.

This is the largest source in the queue and the most directly on subject: it is a
register of what is about to be built, at the point where it is still a filing.

826 TILES, ONE API CALL
The repo shards its projects into 5-degree tiles under projects/tiles/, listed in
projects/index.json. Only index.json is resolved through the GitHub API; the
tiles are read from raw.githubusercontent directly. Resolving each tile would
cost 826 API calls against an unauthenticated limit of 60 an hour, and the
harvest would stop partway through with no signal that the map was now missing
whole continents.

TYPE AND SOURCE ARE INDICES, NOT STRINGS
Each row carries `t` and `s`, which index into index.json's `types` and `sources`
arrays. They are resolved here. An out-of-range index yields None rather than a
wrong label, and the count of those is printed — a mismatched index means the
index file and the tiles were written by different runs, which is worth knowing.

NO FACET
The other large layers offer chips in the panel. This one has 1,491 distinct
types and 68 sources, which is not a row of chips. Both travel per feature and
appear in the popup instead. Nothing is filtered out to make the vocabulary
smaller.
"""

import _wtyg

REPO = "local-map"
INDEX = "projects/index.json"


def resolve():
    return _wtyg.resolve_repo_file(REPO, INDEX)


def fetch():
    index, _ = _wtyg.repo_json(REPO, INDEX)
    types = index.get("types") or []
    sources = index.get("sources") or []
    tiles = index.get("tiles") or []
    declared = index.get("total")

    print(f"local_projects: {len(tiles)} tiles, {declared:,} projects declared, "
          f"{len(types)} types, {len(sources)} sources")

    seen = 0
    skipped_coords = 0
    bad_index = 0
    failed_tiles = []

    for i, tile in enumerate(tiles, 1):
        path = f"projects/tiles/{tile['file']}"
        try:
            rows = _wtyg.raw_json(REPO, path)
        except Exception as e:
            # One unreachable tile must not cost the other 825. Recorded and
            # reported at the end: a harvest that quietly returns a continent
            # less than last week looks like the world got smaller.
            failed_tiles.append((tile["file"], str(e)))
            continue

        for r in rows:
            lat, lon = r.get("lat"), r.get("lng")
            if lat is None or lon is None:
                skipped_coords += 1
                continue

            t_label, s_label = None, None
            ti, si = r.get("t"), r.get("s")
            if isinstance(ti, int) and 0 <= ti < len(types):
                t_label = types[ti]
            elif ti is not None:
                bad_index += 1
            if isinstance(si, int) and 0 <= si < len(sources):
                s_label = sources[si]
            elif si is not None:
                bad_index += 1

            seen += 1
            yield_row = {
                "ident": f"{tile['file']}:{seen}",
                "name": r.get("name") or t_label or "Unnamed project",
                "lon": lon,
                "lat": lat,
                # Acres where the register states them. This is the one
                # magnitude in the file that is a measured quantity rather
                # than a rank, and it is present on only part of the rows —
                # the rest carry None and draw at the minimum radius.
                "value": r.get("acres"),
                "unit": "acres",
                "year": None,
                "url": r.get("url") or None,
                "extra": {
                    "type": t_label,
                    "register": s_label,
                    "status": r.get("status") or None,
                    "extent": r.get("size") or None,
                    "impact_rank": r.get("impact"),
                },
            }
            yield yield_row

        if i % 200 == 0:
            print(f"  {i}/{len(tiles)} tiles, {seen:,} projects so far")

    print(f"local_projects: {seen:,} projects "
          f"({skipped_coords:,} dropped for having no coordinates)")
    if declared and seen + skipped_coords != declared:
        print(f"  note: index.json declares {declared:,}; tiles yielded "
              f"{seen + skipped_coords:,}. A gap means index and tiles were "
              f"written by different runs.")
    if bad_index:
        print(f"  {bad_index:,} type/source indices were out of range and left unlabelled")
    if failed_tiles:
        print(f"  {len(failed_tiles)} TILES FAILED TO LOAD — this layer is incomplete:")
        for name, err in failed_tiles[:10]:
            print(f"    {name}: {err}")


if __name__ == "__main__":
    from collections import Counter
    c = Counter()
    n = 0
    for row in fetch():
        c[row["extra"]["register"]] += 1
        n += 1
    print(f"{n:,} rows; top registers:", c.most_common(10))
