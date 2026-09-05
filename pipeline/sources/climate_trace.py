"""
Climate TRACE — asset-level greenhouse gas emissions, six of the page's embeds
collapsed into one layer.

WHY NOT THE API
The v7 API is public and needs no key, but it pages with limit/offset at a
maximum of 100 rows, and Climate TRACE ask that volume be kept low while it is
in beta. Against 2,765,771 emission sources a full harvest is 27,000+ requests.
That is not a reasonable thing to point at someone's beta endpoint every week,
so ingest uses the bulk download packages and the API is left for spot lookups.

THE CUT
The inventory does not fit in a browser, or in a free-hosted tile archive, so
something has to be left out and the rule for what should be visible rather
than buried in a config file.

Emissions are heavily tailed: a small number of sources account for most of the
total. So the cut is by coverage, not by an arbitrary top-N. Sources are sorted
by emissions and kept until COVERAGE of the sector's total is accounted for.
The harvester reports how many sources that took and what share of the total
they carry, so the tradeoff is visible every run rather than assumed once.

FEATURE_CAP is a second, harder limit for file size. If coverage is reached
before the cap, the cap never binds. If the cap binds first, the run says so
and reports the coverage actually achieved — it does not silently truncate.

UNTESTED
climatetrace.org is not reachable from the environment this was written in, so
unlike the Carbon Bombs harvester none of the network paths here have been run.
The bulk-package link pattern in particular is inferred, not observed. Run
`python pipeline/probe.py climate_trace` before trusting it; the probe reports
what it actually found without writing anything.
"""

import csv
import io
import zipfile
from collections import defaultdict

import requests

import discover

DATA_PAGE = "https://climatetrace.org/data"
API_BASE = "https://api.climatetrace.org/v7"

# Share of each sector's total emissions the kept sources must account for.
COVERAGE = 0.95
# Hard ceiling on features, for tile size. Binds only if COVERAGE needs more.
FEATURE_CAP = 60_000
# Gas to map. The inventory carries CO2, CH4, N2O and CO2e at 20 and 100 year
# GWPs; mixing them in one layer would be meaningless, so pick one explicitly.
GAS = "co2e_100yr"

# Inferred from the download page's naming. Verify with probe.py.
PACKAGE_PATTERN = r"(\d{4}).*global.*\.zip$"


def resolve():
    """Current bulk package URL. Discovered, never pinned."""
    url = discover.page_link(DATA_PAGE, PACKAGE_PATTERN, pick="highest")
    return url, discover.validator(url)


def _rows_from_package(content):
    """Yield asset rows from the zipped sector CSVs inside a bulk package."""
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".csv")]
        if not names:
            raise ValueError("no CSVs in the Climate TRACE package")
        for name in names:
            with z.open(name) as fh:
                text = io.TextIOWrapper(fh, encoding="utf-8-sig")
                for row in csv.DictReader(text):
                    yield row


def _pick(row, *candidates):
    """Column names have shifted across releases; try each in turn."""
    for c in candidates:
        if row.get(c) not in (None, ""):
            return row[c]
    return None


def fetch():
    url, _ = resolve()
    r = requests.get(url, timeout=900)
    r.raise_for_status()

    by_sector = defaultdict(list)
    skipped_no_coords = 0

    for row in _rows_from_package(r.content):
        gas = (_pick(row, "gas") or "").lower()
        if gas and gas != GAS:
            continue

        lat = _pick(row, "lat", "latitude")
        lon = _pick(row, "lon", "longitude")
        if not lat or not lon:
            # Some subsectors are gridded or country-level rather than sited.
            # Those belong on a choropleth, not as invented points.
            skipped_no_coords += 1
            continue

        qty = _pick(row, "emissions_quantity", "emissions_quantity_t")
        try:
            value = float(qty) if qty else 0.0
        except ValueError:
            value = 0.0

        sector = _pick(row, "sector") or "unknown"
        by_sector[sector].append({
            "ident": _pick(row, "source_id", "asset_id", "native_id") or _pick(row, "source_name", "asset_name"),
            "name": _pick(row, "source_name", "asset_name") or "Unnamed source",
            "lon": lon,
            "lat": lat,
            "value": value,
            "unit": "t CO₂e/yr (GWP-100)",
            "year": int(_pick(row, "year") or 0) or None,
            "url": None,
            "extra": {
                "sector": sector,
                "subsector": _pick(row, "subsector"),
                "country": _pick(row, "iso3_country", "country_iso3"),
                "capacity": _pick(row, "capacity"),
                "capacity_units": _pick(row, "capacity_units"),
                "owner": _pick(row, "reporting_entity", "owner"),
                "gas": GAS,
            },
        })

    kept, report = [], []
    for sector, rows in sorted(by_sector.items()):
        rows.sort(key=lambda r: r["value"], reverse=True)
        total = sum(r["value"] for r in rows)
        if total <= 0:
            continue
        running, cut = 0.0, 0
        for i, row in enumerate(rows, 1):
            running += row["value"]
            cut = i
            if running / total >= COVERAGE:
                break
        kept.extend(rows[:cut])
        report.append((sector, cut, len(rows), running / total))

    kept.sort(key=lambda r: r["value"], reverse=True)
    capped = False
    if len(kept) > FEATURE_CAP:
        capped = True
        grand = sum(r["value"] for r in kept)
        kept = kept[:FEATURE_CAP]
        achieved = sum(r["value"] for r in kept) / grand if grand else 0

    print(f"climate_trace: gas={GAS}, coverage target={COVERAGE:.0%}")
    for sector, cut, n, share in report:
        print(f"  {sector:<32} {cut:>7,} of {n:>9,} sources = {share:.1%}")
    if skipped_no_coords:
        print(f"  {skipped_no_coords:,} rows had no coordinates and were dropped "
              f"(gridded or country-level subsectors)")
    if capped:
        print(f"  FEATURE_CAP bound at {FEATURE_CAP:,}; kept features carry "
              f"{achieved:.1%} of the emissions that met the coverage rule")
    print(f"  {len(kept):,} features out")

    if not kept:
        raise RuntimeError("Climate TRACE harvest produced nothing — the package "
                           "shape has probably changed; run probe.py")
    return kept
