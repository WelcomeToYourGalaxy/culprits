"""
National CO₂ emissions — Our World in Data.

50,411 country-years from 1750 to 2024. This layer takes the most recent year
in which a usable number of countries reported, and carries annual production
CO₂ per country, with cumulative and per-capita figures alongside it.

WHY THE LATEST YEAR IS NOT HARDCODED
The dataset gains a year annually and the newest year is sparse while reporting
catches up. `latest_usable_year()` walks back from the newest year until it
finds one where at least MIN_COUNTRIES reported, so the layer never silently
shows a half-empty world and never needs editing when the data updates.

WHY PRODUCTION CO2
`co2` is territorial production emissions — what was emitted inside the
country's borders. `consumption_co2` reassigns emissions to where goods are
consumed and tells a very different story about wealthy importers. Both are in
the source; production is carried as the layer value and consumption travels
alongside it in the popup, so the difference is visible rather than decided
here.

LICENCE
CC BY 4.0 for what OWID produces. Note their README's caveat: third-party data
they redistribute keeps its original terms, so a specific series may carry
conditions of its own.
"""

import csv
import io
from collections import defaultdict

import requests

import discover

REPO = "owid/co2-data"
PATH = "owid-co2-data.csv"

# Below this many reporting countries a year is treated as still filling in.
MIN_COUNTRIES = 150

GEOMETRY = "country"


def resolve():
    return discover.github_file(REPO, PATH, branch="master")


def _num(v):
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


def latest_usable_year(by_year):
    for year in sorted(by_year, reverse=True):
        reporting = sum(1 for r in by_year[year] if _num(r.get("co2")) is not None)
        if reporting >= MIN_COUNTRIES:
            return year, reporting
    raise RuntimeError("no year in the dataset has enough reporting countries")


def fetch():
    url, _ = resolve()
    r = requests.get(url, timeout=300)
    r.raise_for_status()

    by_year = defaultdict(list)
    for row in csv.DictReader(io.StringIO(r.text)):
        iso = (row.get("iso_code") or "").strip()
        # OWID uses the iso_code column for aggregates too — regions, income
        # groups, "World" — with codes like OWID_WRL. Real countries only.
        if len(iso) != 3 or iso.startswith("OWID"):
            continue
        try:
            by_year[int(row["year"])].append(row)
        except (ValueError, KeyError):
            continue

    year, reporting = latest_usable_year(by_year)

    out = []
    for row in by_year[year]:
        co2 = _num(row.get("co2"))
        if co2 is None:
            continue
        out.append({
            "ident": row["iso_code"],
            "name": row.get("country") or row["iso_code"],
            "iso3": row["iso_code"],
            "value": round(co2, 2),
            "unit": "million tonnes CO₂ (production, annual)",
            "year": year,
            "url": "https://ourworldindata.org/co2-emissions",
            "extra": {
                "per_capita": _num(row.get("co2_per_capita")),
                "cumulative": _num(row.get("cumulative_co2")),
                "share_global": _num(row.get("share_global_co2")),
                "consumption": _num(row.get("consumption_co2")),
                "coal": _num(row.get("coal_co2")),
                "oil": _num(row.get("oil_co2")),
                "gas": _num(row.get("gas_co2")),
                "cement": _num(row.get("cement_co2")),
                "precision": "country",
            },
        })

    total = sum(r["value"] for r in out)
    print(f"owid_co2: {year} — {len(out)} countries, {total:,.0f} Mt CO₂ "
          f"({reporting} reported that year)")
    return out


if __name__ == "__main__":
    rows = fetch()
    for r in sorted(rows, key=lambda x: x["value"], reverse=True)[:5]:
        print(f"  {r['iso3']}  {r['value']:>10,.0f} Mt   "
              f"{r['extra']['share_global']}% of global")
