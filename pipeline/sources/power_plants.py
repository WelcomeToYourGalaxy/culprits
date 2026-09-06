"""
Power plants — from WRI's Global Power Plant Database.

All 34,936 plants worldwide, every fuel, all geocoded.

NOTHING IS FILTERED OUT
Every row the source publishes is harvested. `fuel` travels with each feature
so the map can offer filtering at view time, where the reader chooses and can
change their mind — rather than here, where a choice would be invisible and
permanent.

LICENCE
CC BY 4.0, per the repo README, for the database. Note the README distinguishes
the tagged release at datasets.wri.org from the "bleeding-edge" copy in
output_database/ that this harvests — same licence, less settled data.

CAPACITY, NOT EMISSIONS
capacity_mw is what a plant could produce, not what it emitted. It is the only
figure present for every plant, so it is what the layer carries, and the unit
says so. Generation columns exist but are sparse and lag by years.
"""

import csv
import io

import requests

import discover

REPO = "wri/global-power-plant-database"
PATH = "output_database/global_power_plant_database.csv"

def resolve():
    return discover.github_file(REPO, PATH, branch="master")


def fetch():
    url, _ = resolve()
    r = requests.get(url, timeout=300)
    r.raise_for_status()

    out = []
    skipped_coords = 0
    for row in csv.DictReader(io.StringIO(r.text)):
        lat, lon = row.get("latitude"), row.get("longitude")
        if not lat or not lon:
            skipped_coords += 1
            continue

        try:
            cap = float(row["capacity_mw"]) if row.get("capacity_mw") else None
        except ValueError:
            cap = None

        year = row.get("commissioning_year") or ""
        try:
            year = int(float(year)) if year else None
        except ValueError:
            year = None

        out.append({
            "ident": row["gppd_idnr"],
            "name": row.get("name") or row["gppd_idnr"],
            "lon": lon,
            "lat": lat,
            "value": cap,
            "unit": "MW capacity",
            "year": year,
            "url": row.get("url") or None,
            "extra": {
                "country": row.get("country_long"),
                "fuel": row.get("primary_fuel"),
                "other_fuel": row.get("other_fuel1") or None,
                "owner": row.get("owner") or None,
                "source": row.get("source") or None,
                # Coordinates come from many upstreams of differing quality;
                # carried so a plant's position can be traced rather than
                # assumed accurate.
                "geo_source": row.get("geolocation_source") or None,
            },
        })

    total = sum(r["value"] or 0 for r in out)
    print(f"power_plants: {len(out):,} plants, {total:,.0f} MW "
          f"({skipped_coords:,} dropped for having no coordinates)")
    return out


if __name__ == "__main__":
    from collections import Counter
    rows = fetch()
    print("by fuel:", Counter(r["extra"]["fuel"] for r in rows).most_common())
    top = sorted(rows, key=lambda r: r["value"] or 0, reverse=True)[:5]
    for r in top:
        print(f"  {r['value']:>8,.0f} MW  {r['extra']['fuel']:<5} {r['name'][:44]}")
