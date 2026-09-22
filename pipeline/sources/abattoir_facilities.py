"""
Animal-use facilities — from WelcomeToYourGalaxy/abattoir-atlas.

The atlas merges official registries (US FSIS, EU TRACES, the EU industrial
emissions register, UK FSA, CFIA, Brazil SIF, Australia DAFF, NZ MPI, China via
CIFER), the Farm Transparency Project's map and OpenStreetMap into one record
per facility, with duplicates across registries collapsed. It publishes that
merged set as out/facilities.json.gz, which is what this reads: every record,
before the atlas's own page leaves out the activities it treats as post-mortem
only (casings, agricultural shows and the like). Selection belongs in this
map's panel, not in the harvest.

WHAT A POINT IS
Most records are not slaughterhouses. Farms, dairies, processors, cutting
plants, cold stores, transporters, hatcheries and zoos are all registered
animal-use sites. `slaughter` is carried as the atlas gives it — yes where a
registry states slaughter, no where it states otherwise, and "not stated" for
the majority where the registry says nothing either way. The panel facet reads
that field, so a reader can ask for slaughter sites without the harvest having
decided for them.

POSITION
The atlas records how each position was found. `rooftop` and `street` are
located addresses and draw solid. `locality` is a town or village — the
registry gave an address the geocoder could only place at the settlement — and
draws hollow, with the popup saying so. Any other value fails safe to
"unknown". Records with no position at all cannot be drawn and are counted in
the harvest output rather than silently vanishing.

LICENCE
Mixed and unverified: each registry's terms, the Farm Transparency Project's,
OpenStreetMap's (ODbL, share-alike) for the OSM rows, and — because many
addresses were geocoded with Photon and Nominatim, both built on OpenStreetMap
— ODbL again for those positions. Built isolated, like local_projects.
"""

import json

import _wtyg

REPO = "abattoir-atlas"
PATH = "out/facilities.json.gz"

PRECISION = {
    "rooftop": None,      # a located address; draws solid
    "street": None,
    "locality": "locality",
}


def resolve():
    return _wtyg.resolve_repo_file(REPO, PATH)


def _join(values):
    values = [str(v) for v in (values or []) if v not in (None, "")]
    return "; ".join(values) or None


# Short names for the registers whose own published fields the atlas carries
# through (members[].published). Only Trase so far.
PUBLISHED_AS = {"br_trase": "trase"}


def _published(members):
    """Every field a register published beyond the atlas's own, flattened for the
    popup: trase_status, trase_cnpj, trase_capacity_value_text and so on. Where
    two records of one register were merged into a facility, their values sit
    side by side. Nothing is left out; a nested value is written as JSON."""
    out = {}
    for m in members:
        short = PUBLISHED_AS.get(m.get("source"))
        if not short:
            continue
        for k, v in (m.get("published") or {}).items():
            if v in (None, ""):
                continue
            if isinstance(v, (list, dict)):
                v = json.dumps(v, ensure_ascii=False, separators=(",", ":"))
            key = f"{short}_{k}"
            v = str(v)
            if key in out and v not in out[key].split(" | "):
                out[key] += " | " + v
            else:
                out.setdefault(key, v)
    return out


def fetch():
    data, _ = _wtyg.repo_json(REPO, PATH)

    no_position = 0
    kept = 0
    precision_counts = {}
    for r in data:
        lat, lon = r.get("lat"), r.get("lon")
        if lat is None or lon is None:
            no_position += 1
            continue

        raw_precision = r.get("geo_precision")
        precision = PRECISION.get(raw_precision, "unknown")
        precision_counts[raw_precision] = precision_counts.get(raw_precision, 0) + 1

        members = r.get("members") or []
        slaughter = r.get("slaughter")
        kept += 1
        yield {
            "ident": r.get("uid"),
            "name": r.get("name"),
            "lon": lon,
            "lat": lat,
            "value": None,
            "unit": "facility",
            "year": None,
            "url": None,
            # Order matters: the popup shows the first six x_ fields.
            "extra": {
                "precision": precision,
                "activities": _join(r.get("activities")),
                "species": _join(r.get("species")),
                "slaughter": {True: "yes", False: "no"}.get(slaughter, "not stated"),
                "operator": r.get("operator") or None,
                "registries": _join(sorted({m.get("source") for m in members if m.get("source")})),
                "address": r.get("address") or None,
                "country": r.get("country_iso3"),
                "size_class": r.get("size_class") or None,
                "records_merged": len(members),
                "position_found_by": r.get("geo_source"),
                "position_precision": raw_precision,
                # The atlas's own flag for a merge it was not sure of.
                "merge_needs_review": bool(r.get("review")),
                # Then everything Trase published for the site: inspection level
                # and number, status, capacity, export approvals, tax number.
                **_published(members),
            },
        }

    print(f"abattoir_facilities: {kept:,} facilities with a position; "
          f"{no_position:,} records have none and cannot be drawn")
    print(f"  position precision as the atlas records it: {precision_counts}")


if __name__ == "__main__":
    for i, row in enumerate(fetch()):
        if i == 0:
            print(row)
