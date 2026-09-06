"""
Synthetic fertilizer facilities — from the Welcome to Your Galaxy maps repo.

58 ammonia and urea plants with company, location and capacity, compiled for
the Destruction page and embedded there as fertilizer_facilities.html.

WHY THIS IS HARVESTED RATHER THAN EMBEDDED
The atlas already links the original map. Reading its data instead puts these
facilities on the same canvas as coal units, power plants and carbon bombs,
which is the point of a combined map — and it does so without a second copy of
the numbers to keep in step, since the source of truth stays the maps repo.

CAPACITY IS TEXT, NOT A NUMBER
The source records capacity as prose — "4.3M tons ammonia/year - world's
largest" — because it was written to be read in a popup. Parsing that into a
number would mean guessing at units and at what "largest" qualifies, so it is
carried verbatim and the layer has no numeric magnitude. Any figure here would
be invented.
"""

import json
import re

import requests

import discover

REPO = "WelcomeToYourGalaxy/maps"
PATH = "fertilizer_facilities.html"


def resolve():
    return discover.github_file(REPO, PATH)


def fetch():
    url, _ = resolve()
    r = requests.get(url, timeout=90)
    r.raise_for_status()

    m = re.search(r'const facilities\s*=\s*(\[[\s\S]*?\]);', r.text)
    if not m:
        raise RuntimeError(
            "the facilities array is no longer where this expects it — the map "
            "has been restructured; check fertilizer_facilities.html"
        )
    rows = json.loads(m.group(1))

    out = []
    for row in rows:
        if row.get("lat") is None or row.get("lon") is None:
            continue
        where = ", ".join(x for x in (row.get("city"), row.get("state"),
                                      row.get("country")) if x)
        out.append({
            "ident": f"{row.get('company')}|{row.get('name')}",
            "name": row.get("name") or "Unnamed facility",
            "lon": row["lon"],
            "lat": row["lat"],
            "value": None,          # see module docstring
            "unit": "ammonia / urea plant",
            "year": None,
            "url": None,
            "extra": {
                "company": row.get("company"),
                "capacity": row.get("capacity"),
                "country": row.get("country"),
                "city": row.get("city"),
                "state": row.get("state"),
            },
        })

    print(f"fertilizer_facilities: {len(out)} plants")
    return out


if __name__ == "__main__":
    from collections import Counter
    rows = fetch()
    print("by company:", Counter(r["extra"]["company"] for r in rows).most_common(5))
    print("by country:", Counter(r["extra"]["country"] for r in rows).most_common(5))
