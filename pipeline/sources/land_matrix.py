"""
Land Matrix — large-scale land acquisitions and leases since 2000.

TWO THINGS THIS SOURCE IS NOT
It is not a point layer. The combined dataset carries Target Country and
Target Region but no coordinates, despite the mirror's README describing
location data. Deals are therefore aggregated per country and rendered as a
choropleth against real national boundaries — not as centroids, which would
put 2,370 invented pins on the map.

Its licence is unsettled. The mirror's README says CC BY-SA 4.0 and its own
datapackage.json says CC BY-NC 4.0, in the same repository. Share-alike and
non-commercial are different obligations and only one can be right. Tracked in
_publish_blockers; resolve against Land Matrix's own terms before publishing.

SCOPE, per the source: deals in low and middle-income countries, initiated
since 2000, 200 hectares or larger, transferring rights to use, control or own
land. So absence from this layer means "not captured under those criteria",
not "no land acquisition here".
"""

import csv
import io
from collections import defaultdict

import requests

import discover

REPO = "datasets/land-matrix"
PATH = "data/database.csv"
BOUNDARIES_REPO = "datasets/geo-countries"
BOUNDARIES_PATH = "data/countries.geojson"

# Land Matrix uses World Bank-style country names; the boundaries file uses
# ISO short names. These 14 differ. Listed explicitly rather than fuzzy-matched,
# because a fuzzy match that silently picks the wrong country is worse than a
# name that fails loudly.
ALIASES = {
    "Congo, Dem. Rep.": "COD",
    "Congo, Rep.": "COG",
    "Côte d'Ivoire": "CIV",
    "Egypt, Arab Rep.": "EGY",
    "Gambia, The": "GMB",
    "Kyrgyz Republic": "KGZ",
    "Lao PDR": "LAO",
    "Russian Federation": "RUS",
    "Serbia": "SRB",
    "Swaziland": "SWZ",
    "Tanzania": "TZA",
    "Timor-Leste": "TLS",
    "Türkiye": "TUR",
    "Venezuela, RB": "VEN",
}

GEOMETRY = "country"   # tells normalize.py this is an aggregate, not a point


def resolve():
    return discover.github_file(REPO, PATH)


def _iso_lookup():
    url, _ = discover.github_file(BOUNDARIES_REPO, BOUNDARIES_PATH)
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    geo = r.json()
    return {
        f["properties"]["name"]: f["properties"]["ISO3166-1-Alpha-3"]
        for f in geo["features"]
    }


def fetch():
    url, _ = resolve()
    r = requests.get(url, timeout=180)
    r.raise_for_status()

    rows = list(csv.DictReader(io.StringIO(r.text), delimiter=";"))
    by_name = _iso_lookup()

    agg = defaultdict(lambda: {"deals": 0, "hectares": 0.0, "investors": set(),
                               "crops": set(), "years": []})
    unmatched = defaultdict(int)

    for row in rows:
        country = (row.get("Target Country") or "").strip()
        if not country:
            continue
        iso = ALIASES.get(country) or by_name.get(country)
        if not iso:
            unmatched[country] += 1
            continue

        a = agg[iso]
        a["deals"] += 1
        try:
            a["hectares"] += float(row.get("Hectares") or 0)
        except ValueError:
            pass
        for k in ("Investor Country 1", "Investor Country 2", "Investor Country 3"):
            if row.get(k):
                a["investors"].add(row[k])
        for k in ("Crop 1", "Crop 2", "Crop 3"):
            if row.get(k):
                a["crops"].add(row[k])
        if (row.get("Year") or "").isdigit():
            a["years"].append(int(row["Year"]))

    if unmatched:
        # Loud, not silent. An unmatched country is data falling off the map.
        print(f"land_matrix: {len(unmatched)} country names did not match a "
              f"boundary and were DROPPED: {dict(unmatched)}")
        print("             add them to ALIASES rather than leaving them out")

    out = []
    for iso, a in sorted(agg.items()):
        out.append({
            "ident": iso,
            "name": iso,
            "iso3": iso,
            "value": round(a["hectares"], 1),
            "unit": "hectares under land deals",
            "year": max(a["years"]) if a["years"] else None,
            "url": "https://landmatrix.org/list/deals",
            "extra": {
                "deals": a["deals"],
                "investor_countries": ", ".join(sorted(a["investors"])[:8]),
                "crops": ", ".join(sorted(a["crops"])[:8]),
                "precision": "country",
            },
        })

    total = sum(r["value"] for r in out)
    print(f"land_matrix: {len(rows):,} deals -> {len(out)} countries, "
          f"{total:,.0f} hectares")
    return out


if __name__ == "__main__":
    rows = fetch()
    top = sorted(rows, key=lambda r: r["value"], reverse=True)[:5]
    for r in top:
        print(f"  {r['iso3']}  {r['value']:>12,.0f} ha  {r['extra']['deals']:>4} deals")
