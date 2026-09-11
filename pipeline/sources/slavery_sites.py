"""
Brick kilns and artisanal mining sites — from WelcomeToYourGalaxy/anti-slavery-map.

7,552 sites: 4,630 brick kilns, and 2,922 artisanal mining sites field-visited by
IPIS in eastern DR Congo, 1,791 of which IPIS recorded child or forced labour at.

THE SOURCE FILE'S OWN CAVEAT, CARRIED FORWARD
Its note reads: sector infrastructure at coordinate precision, NOT confirmed
exploitation — sites in sectors where forced and child labour are documented to
concentrate. That distinction is the difference between a map of kilns and an
accusation about each one, so `status` travels per feature and says which it is.
The IPIS rows that do record an observation say so in `status`
("Child labour observed"); the kilns do not, and nothing here adds it.

Kept as its own layer rather than merged with the ports and the fishing grid,
which are in the same repo and are different kinds of claim about different
things. The repo makes that split itself and states the reason in each file.
"""

import _wtyg

REPO = "anti-slavery-map"
PATH = "points.json"


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
            "ident": f"{r.get('source')}:{r.get('name')}:{lat},{lon}",
            "name": r.get("name") or r.get("type"),
            "lon": lon,
            "lat": lat,
            # Worker counts appear in some IPIS descriptions as prose and in no
            # structured field, so there is no number to carry. A layer that
            # reported one would be parsing it out of a sentence.
            "value": None,
            "unit": "site",
            "year": None,
            "url": r.get("url") or None,
            "extra": {
                "precision": _wtyg.precision_from(r),
                "type": r.get("type"),
                "status": r.get("status") or None,
                "region": r.get("state") or None,
                "dataset": r.get("source") or None,
            },
        })

    print(f"slavery_sites: {len(out):,} sites "
          f"({skipped_coords:,} dropped for having no coordinates)")
    print(f"  source note: {data.get('note')}")
    return out


if __name__ == "__main__":
    from collections import Counter
    rows = fetch()
    print("by type:", Counter(r["extra"]["type"] for r in rows).most_common())
