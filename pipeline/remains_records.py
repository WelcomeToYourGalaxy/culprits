"""
Unearthings and decisions about unearthed human remains — from
WelcomeToYourGalaxy/remains.

4,020 records: 2,411 burial grounds recorded as removed, 906 permits authorising
harm to burial sites, 368 repatriation notices, 164 exhumations, plus dispositions,
environmental and planning reviews, excavations, reinterments and discoveries.
From the US Federal Register (NAGPRA notices and federal burial reviews), NSW
Aboriginal Heritage Impact Permits, California CEQA filings, UK planning
applications, OpenStreetMap, and government open-data portals.

THIS LAYER DOES NOT PLOT GRAVES, AND MUST NOT START
The source repo is built around that: precise burial locations are withheld by
archaeologists, descendant communities and states because publishing them invites
desecration, and in the US site-location data is exempt from disclosure under
NHPA s.304 and ARPA s.9 for that reason. The unit of the source map is the
accountable actor and the decision — the institution holding the remains, the
centre of a permit area, the administrative unit a review names — and anything
that is itself a burial location is blurred to about 5 km before it is written.

Every row therefore arrives already blurred or already aggregated. This harvester
adds no precision and derives no coordinate: it reads lat/lng as published and
carries the source's own `geo` flag into `precision`, so a blurred record draws
hollow here as it draws as a haloed ring there. Do not add a geocoding step to
this source, and do not merge it with a site register.

BOTH DIRECTIONS ARE HERE
3,485 records are `harm` — permits to destroy, grounds recorded as removed — and
535 are `redress` or `watch`: repatriations, reinterments. The repo separates
direction from magnitude deliberately, since a large repatriation is a large
event and not a bad one. `posture` travels per feature and drives the panel chips
so a reader can tell them apart rather than reading every mark as damage.
"""

import _wtyg

REPO = "remains"
PATH = "remains.json.gz"

POSTURES = ["harm", "watch", "redress", "unlawful"]


def resolve():
    return _wtyg.resolve_repo_file(REPO, PATH)


def fetch():
    data, _ = _wtyg.repo_json(REPO, PATH)
    rows = data["records"]

    out = []
    skipped_coords = 0
    for r in rows:
        lat, lon = r.get("lat"), r.get("lng")
        if lat is None or lon is None:
            skipped_coords += 1
            continue

        out.append({
            "ident": f"{r.get('source')}:{r.get('name')}:{lat},{lon}",
            "name": r.get("name"),
            "lon": lon,
            "lat": lat,
            # No count of individuals. The source's rule is that a number
            # appears only where a register states one, and it stores none in a
            # structured field — so there is nothing to carry, and absence here
            # means the source was silent, never that the number is small.
            "value": None,
            "unit": "record",
            "year": None,
            "url": r.get("url") or None,
            "extra": {
                "precision": _wtyg.precision_from(r),
                "posture": r.get("posture") or None,
                "kind": r.get("kind") or None,
                "trigger": r.get("trigger") or None,
                "actor": r.get("actor") or None,
                "region": r.get("region") or None,
                "country": r.get("country") or None,
                "status": r.get("status") or None,
                "register": r.get("source") or None,
            },
        })

    from collections import Counter
    posture = Counter(r["extra"]["posture"] for r in out)
    print(f"remains_records: {len(out):,} records "
          f"({skipped_coords:,} dropped for having no coordinates)")
    print(f"  by posture: {posture.most_common()}")
    print(f"  by precision: "
          f"{Counter(r['extra']['precision'] for r in out).most_common()}")
    return out


if __name__ == "__main__":
    from collections import Counter
    rows = fetch()
    print("by kind:", Counter(r["extra"]["kind"] for r in rows).most_common())
