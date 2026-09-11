"""
Identified trafficking cases by country — from WelcomeToYourGalaxy/anti-slavery-map.

1,153 rows from the Counter-Trafficking Data Collaborative, contributed by IOM,
Polaris, A21, RecollectiV and the Portuguese observatory. Country of exploitation
and exploitation type, by period.

DETECTION, NOT PREVALENCE
These are people an organisation actually identified. A country with a large
count has counter-trafficking organisations filing records; a country with none
may have no cases or no one counting, and this data cannot tell those apart.
The repo states this in the file and the layer note repeats it, because a
choropleth invites exactly the opposite reading.

COUNTRY ROUTE, NOT POINTS
The source records a country, never a coordinate — the file says "Country level
only, by design". So these become country rows and draw against real national
borders, which is what normalize.country_row() and the map's country route are
for. A centroid would dress an aggregate up as a site.

THE ROWS OVERLAP, SO THEY MUST NOT BE SUMMED
Each country carries two kinds of row: a grand total typed "Identified cases
(CTDC)" with no period, and a set of rows broken down by exploitation type and
period. The breakdown is a complete partition of the total, not an addition to
it — the United States has a grand total of 116,418, and its fourteen type-by-
period rows also sum to exactly 116,418. Adding both together reported every
such country at double, and produced a global figure of 418,750 that no source
states.

So the grand-total row is the value where it exists, the breakdown is summed
only where it does not, and the two are compared whenever both are present. A
disagreement is printed rather than resolved silently: if upstream changes what
these rows mean, that should surface as a complaint, not as a number.
"""

import re
from collections import defaultdict

import _wtyg

REPO = "anti-slavery-map"
PATH = "cases.json"


def resolve():
    return _wtyg.resolve_repo_file(REPO, PATH)


def fetch():
    data, _ = _wtyg.repo_json(REPO, PATH)
    rows = data["projects"]

    per_country = defaultdict(lambda: {"total": None, "parts": 0, "rows": 0,
                                       "types": set(), "periods": set()})
    no_count = 0
    for r in rows:
        iso = r.get("iso")
        if not iso or len(iso) != 3:
            continue
        n = _count_from(r.get("name"))
        if n is None:
            no_count += 1
            continue

        c = per_country[iso]
        c["rows"] += 1
        if _is_grand_total(r):
            # Several grand-total rows for one country would mean the shape of
            # the file has changed; keep the largest and let the mismatch
            # report below say so.
            c["total"] = n if c["total"] is None else max(c["total"], n)
        else:
            c["parts"] += n
            if r.get("type"):
                c["types"].add(r["type"])
            if r.get("period"):
                c["periods"].add(r["period"])

    out = []
    mismatches = []
    for iso, c in per_country.items():
        if c["total"] is not None:
            value = c["total"]
            basis = "stated country total"
            if c["parts"] and c["parts"] != c["total"]:
                mismatches.append((iso, c["total"], c["parts"]))
        else:
            value = c["parts"]
            basis = "sum of the type-by-period breakdown; no country total stated"

        out.append({
            "iso3": iso,
            "name": iso,
            "value": value,
            "unit": "identified cases",
            "year": None,
            "url": "https://www.ctdatacollaborative.org/",
            "extra": {
                "basis": basis,
                "rows": c["rows"],
                "exploitation_types": "; ".join(sorted(c["types"])) or None,
                "periods": "; ".join(sorted(c["periods"])) or None,
            },
        })

    print(f"slavery_cases: {len(out):,} countries, "
          f"{sum(r['value'] for r in out):,} identified cases")
    if no_count:
        print(f"  {no_count:,} rows carried no parseable count and were not added "
              f"to any total")
    if mismatches:
        print(f"  {len(mismatches)} countries where the breakdown does not equal the "
              f"stated total — the stated total was used:")
        for iso, total, parts in mismatches[:10]:
            print(f"    {iso}: total {total:,}, breakdown {parts:,}")
    print(f"  source note: {data.get('note')}")
    return out


def _is_grand_total(r):
    """
    The country grand total is the row with no period and the undifferentiated
    type. Matched on both, because either alone would also match a breakdown
    row if upstream started omitting periods.
    """
    return r.get("period") in (None, "") and r.get("type") == "Identified cases (CTDC)"


def _count_from(name):
    """
    The count is stated at the front of the row's name: "36,866 identified:
    sexual exploitation, 2015-2019". There is no numeric field in the file, so
    this reads the number the source itself printed and returns None rather
    than a guess when the pattern is not there.
    """
    if not name:
        return None
    m = re.match(r"\s*([\d,]+)\s", str(name))
    if not m:
        return None
    try:
        return int(m.group(1).replace(",", ""))
    except ValueError:
        return None


if __name__ == "__main__":
    rows = fetch()
    print(sorted(rows, key=lambda r: -r["value"])[:5])
