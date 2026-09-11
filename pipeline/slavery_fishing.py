"""
Modelled at-risk fishing effort — from WelcomeToYourGalaxy/anti-slavery-map.

2,316 cells of ocean, each 2.5 degrees square, from the emlab-ucsb
slavery-in-fisheries release. Each carries the share of fishing effort in that
cell that the published model attributed to vessels it scored high-risk for
forced labour.

NOT VESSELS, AND NOBODY IS NAMED
The authors anonymised every hull before release, and the method has been
contested in the same journal. So every feature here is a grid cell, `precision`
is "grid", and the map draws it hollow with the cell size in the popup — the
same treatment Climate TRACE's 9 km model cells get. A solid dot would say a
ship is at this position, which is not what the file contains and not what the
authors published.

The percentage is carried as a property rather than as `value`, because `value`
sizes the symbol and a share of effort in a 2.5-degree cell is not a magnitude
comparable to anything else on this map.
"""

import _wtyg

REPO = "anti-slavery-map"
PATH = "vessels.json"

CELL = "2.5 degrees"


def resolve():
    return _wtyg.resolve_repo_file(REPO, PATH)


def fetch():
    data, _ = _wtyg.repo_json(REPO, PATH)
    rows = data["projects"]

    out = []
    skipped_coords = 0
    for r in rows:
        lat, lon = r.get("lat"), r.get("lng")
        if lat is None or lon is None:
            skipped_coords += 1
            continue

        out.append({
            "ident": f"cell:{lat},{lon}",
            "name": r.get("name") or "At-risk fishing effort",
            "lon": lon,
            "lat": lat,
            "value": None,
            "unit": "model grid cell",
            "year": None,
            "url": r.get("url") or None,
            "extra": {
                # Fixed rather than read from `precise`, because what makes
                # these imprecise is that they are cells, not that a coordinate
                # was missing — and the popup needs the cell size to say so.
                "precision": "grid",
                "grid_cell": CELL,
                "share_of_effort": r.get("status") or None,
                "gear": None,
            },
        })

    print(f"slavery_fishing: {len(out):,} grid cells of {CELL} "
          f"({skipped_coords:,} dropped for having no coordinates)")
    print(f"  source note: {data.get('note')}")
    return out


if __name__ == "__main__":
    rows = fetch()
    print(rows[0])
