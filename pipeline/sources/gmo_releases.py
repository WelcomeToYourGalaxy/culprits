"""
Genetic-engineering registers — from WelcomeToYourGalaxy/GMO-map.

43,741 records: US APHIS BRS environmental-release authorisations, Canadian CFIA
approvals, Australian OGTR licences, national biosafety decisions from the CBD
Biosafety Clearing-House, and industry and clinical registers.

ALMOST NOTHING HERE IS A COORDINATE
41,948 of the 43,741 rows carry `precise: false`. APHIS publishes the state a
release was authorised in and never a field, so every US record sits at a state
centroid; CFIA records sit at the national centroid, because that register
records a national approval rather than a planting location. 1,793 rows are
genuinely located. That ratio is the single most important thing about this
layer, so `precision` travels per feature and the map draws the imprecise ones
hollow — the same treatment Carbon Bombs' 92 country centroids get.

NOTHING IS FILTERED OUT
The file mixes registers: environmental releases, Animal Welfare Act facility
licences, gene-therapy trial sponsors, fertility clinics. All of them are
harvested and `register` travels with each feature, so the reader filters in the
panel. Which of these belong on a map about environmental destruction is a
judgement, and it is not one a pipeline should make invisibly.

The upstream file has already dropped 6,085 records that were never authorised —
withdrawn, denied, void, returned, incomplete, cancelled — and states so in its
own `dropped` block. That is the source's decision, made before this harvester
sees the data; the count is printed each run so it stays visible.
"""

import _wtyg

REPO = "GMO-map"
PATH = "projects.json"

# The register a record came from is the first segment of its `source` field:
# "ogtr:DIR-201" -> ogtr. Five registers in the current file.
REGISTERS = {
    "aphis": "US APHIS BRS",
    "industry": "industry register",
    "bch": "CBD Biosafety Clearing-House",
    "clinical": "clinical trial sponsor",
    "ogtr": "Australia OGTR",
}


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

        register = (r.get("source") or "").split(":")[0]

        out.append({
            "ident": r.get("source") or r.get("name"),
            "name": r.get("name"),
            "lon": lon,
            "lat": lat,
            # No magnitude. These are authorisations, not quantities: the file
            # records hectares only as free text ("1 site, max 2 ha/yr") and
            # parsing that into a number would be inventing one.
            "value": None,
            "unit": "authorisation",
            "year": _year(r.get("date")),
            "url": r.get("url") or None,
            "extra": {
                "precision": _wtyg.precision_from(r),
                "register": REGISTERS.get(register, register or None),
                "type": r.get("type"),
                "applicant": r.get("company") or None,
                "state": r.get("state") or None,
                "extent": r.get("size") or None,
                "status": r.get("status") or None,
            },
        })

    dropped = (data.get("dropped") or {})
    print(f"gmo_releases: {len(out):,} records "
          f"({skipped_coords:,} dropped for having no coordinates)")
    print(f"  upstream had already excluded {dropped.get('total', 0):,} never-authorised "
          f"records ({dropped.get('share_pct', '?')}% of {dropped.get('seen', 0):,} seen): "
          f"{dropped.get('reason', 'reason not stated')}")
    imprecise = sum(1 for r in out if r["extra"]["precision"])
    print(f"  {imprecise:,} of {len(out):,} carry no site coordinate and draw hollow")
    return out


def _year(date):
    """The file's dates are YYYY-MM-DD strings. Take the year, or nothing."""
    if not date:
        return None
    try:
        return int(str(date)[:4])
    except ValueError:
        return None


if __name__ == "__main__":
    from collections import Counter
    rows = fetch()
    print("by register:", Counter(r["extra"]["register"] for r in rows).most_common())
    print("by precision:", Counter(r["extra"]["precision"] for r in rows).most_common())
