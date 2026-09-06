"""
Climate TRACE — asset-level greenhouse gas emissions, six of the page's embeds
collapsed into one layer.

WHY NOT THE API
The API is public and needs no key, but it pages with limit/offset at a maximum
of 100 rows, and Climate TRACE ask that volume be kept low while it is in beta.
Against 2,765,771 emission sources a full harvest is 27,000+ requests. That is
not a reasonable thing to point at someone's beta endpoint every week, so
ingest uses the bulk download packages and the API is left for spot lookups.

WHAT THE PACKAGES ACTUALLY ARE
The first version of this file assumed one year-stamped global zip, discovered
by scraping climatetrace.org/data for a link matching `(\\d{4}).*global.*\\.zip`.
No such file exists, and that page builds its download list in the browser, so
the scrape would have found nothing even if it had.

The real layout was established by listing the S3 bucket and then probing
candidate keys until they returned 206. It is one zip per sector, PER GAS, under
a `latest/` prefix that always points at the current monthly release:

    https://downloads.climatetrace.org/latest/sector_packages/<gas>/<sector>.zip

The gas segment sits BEFORE the sector, which is the part no documentation
states and the part every wrong guess got backwards. Verified live:

    latest/sector_packages/co2e_100yr/power.zip   206
    latest/sector_packages/co2/power.zip          206
    latest/sector_packages/power/co2e_100yr.zip   404

A third-party downloader (liamlaverty/climate-trace-data-downloader, last
touched 2023) uses `sector_packages/<sector>.zip` with no `latest/` and no gas.
That path is dead — it 404s — which is worth knowing because it is the first
thing a search turns up.

`latest/` is what makes the no-pinned-URLs rule cheap here: Climate TRACE now
release monthly (v5.10.0 in August 2026), and the prefix resolves to the
current release without any discovery step at all.

Country packages exist too, at latest/country_packages/<gas>/<ISO3>.zip. They
are not used: the USA co2 package alone is 343 MB and Brazil is 272 MB, so a
per-country harvest would be several GB per run for the same emissions the
sector packages carry.

WHAT IS INSIDE A PACKAGE, AND WHY FILENAMES ARE NOT TRUSTED
Each zip holds CSVs per subsector, split three ways: asset-level emissions,
asset-level OWNERSHIP, and COUNTRY-level emissions. Only the first belongs in a
point layer. Reading every CSV — which the first version did — mixes ownership
rows that carry no emissions and country rows that carry no coordinates into
the same pile, silently inflating the dropped-row count and the source count.

Rather than guess at filename conventions that have shifted between releases,
each CSV is classified by the columns it actually has. A file is asset-level
emissions if it carries coordinates and an emissions quantity. That is
self-correcting: if Climate TRACE rename their files, this keeps working, and
if they restructure their columns the run says so instead of returning junk.

THE CUT
The inventory does not fit in a browser, or in a free-hosted tile archive, so
something has to be left out, and the rule for what should be visible rather
than buried in a config file.

Emissions are heavily tailed: a small number of sources account for most of the
total. So the cut is by coverage, not by an arbitrary top-N. Sources are sorted
by emissions and kept until COVERAGE of the sector's total is accounted for.
The harvester reports how many sources that took and what share of the total
they carry, so the tradeoff is visible every run rather than assumed once.

FEATURE_CAP is a second, harder limit for file size. If coverage is reached
before the cap, the cap never binds. If the cap binds first, the run says so
and reports the coverage actually achieved — it does not silently truncate.

STILL UNRUN
climatetrace.org is not reachable from the environment this was written in, so
the network paths here have still never executed. What changed is that the URL
is now observed rather than inferred, and the CSV selection no longer depends
on a guess. Run `python pipeline/probe.py climate_trace --fetch` before
trusting it; the probe reports what it found without writing anything.
"""

import csv
import io
import zipfile
from collections import defaultdict

import requests

import discover

DOWNLOAD_BASE = "https://downloads.climatetrace.org"

# The eight sector packages the downloader above enumerates. Climate TRACE
# describe "10 top-level sectors" in their own documentation, so this list may
# be short by two — mineral extraction among them. resolve() reports every
# package it cannot reach, and probe_packages() below lists what is actually
# there, so a missing sector shows up as a named gap rather than as quietly
# absent data.
SECTORS = [
    "agriculture",
    "buildings",
    "forestry_and_land_use",
    "fossil_fuel_operations",
    "manufacturing",
    "power",
    "transportation",
    "waste",
]

# Share of each sector's total emissions the kept sources must account for.
COVERAGE = 0.95
# Hard ceiling on features, for tile size. Binds only if COVERAGE needs more.
FEATURE_CAP = 60_000
# Gas to map. The inventory carries CO2, CH4, N2O and CO2e at 20 and 100 year
# GWPs; mixing them in one layer would be meaningless, so pick one explicitly.
GAS = "co2e_100yr"

LAT_COLS = ("lat", "latitude", "st_astext_lat")
LON_COLS = ("lon", "lng", "longitude")
QTY_COLS = ("emissions_quantity", "emissions_quantity_t")


def sector_url(sector, gas=None):
    """Gas before sector — see the note at the top of this file."""
    return f"{DOWNLOAD_BASE}/latest/sector_packages/{gas or GAS}/{sector}.zip"


def resolve():
    """Confirm the sector packages respond. Paths are stable, so nothing is
    scraped — but nothing is assumed either."""
    missing = []
    for sector in SECTORS:
        url = sector_url(sector)
        try:
            r = requests.head(url, headers=discover.UA, timeout=45, allow_redirects=True)
            if not r.ok:
                missing.append(f"{sector} ({r.status_code})")
        except requests.RequestException as e:
            missing.append(f"{sector} ({type(e).__name__})")

    if len(missing) == len(SECTORS):
        raise LookupError(
            "no Climate TRACE sector package responded — the download host or "
            f"the path layout has changed: {DOWNLOAD_BASE}/sector_packages/"
        )
    if missing:
        # Partial loss is worth harvesting around, but not worth hiding.
        print(f"climate_trace: WARNING — packages not reachable: {', '.join(missing)}")

    # The probe reports one URL and one change signal; give it the largest
    # sector, since that is the one whose disappearance matters most.
    primary = sector_url("power")
    return primary, discover.validator(primary)


def _is_asset_emissions(fieldnames):
    """Asset-level emissions carry coordinates AND a quantity. Ownership files
    have no quantity; country-level files have no coordinates."""
    if not fieldnames:
        return False
    cols = {c.strip().lower() for c in fieldnames}
    return (bool(cols & set(LAT_COLS))
            and bool(cols & set(LON_COLS))
            and bool(cols & set(QTY_COLS)))


def _rows_from_package(content, stats):
    """Yield asset-level emission rows from one sector zip, skipping ownership
    and country-level CSVs by inspecting their columns."""
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".csv")]
        if not names:
            raise ValueError("no CSVs in the Climate TRACE package")
        used = 0
        for name in names:
            with z.open(name) as fh:
                text = io.TextIOWrapper(fh, encoding="utf-8-sig")
                reader = csv.DictReader(text)
                if not _is_asset_emissions(reader.fieldnames):
                    stats["skipped_files"].append(name)
                    continue
                used += 1
                for row in reader:
                    yield row
        if used == 0:
            # Every CSV failed the column test. That is a schema change, not an
            # empty release, and it must not read as "this sector has no data".
            raise ValueError(
                f"no asset-level emissions CSV found among {len(names)} files; "
                f"columns seen: {sorted(stats['columns_seen'])[:12]}"
            )


def _pick(row, *candidates):
    """Column names have shifted across releases; try each in turn."""
    for c in candidates:
        if row.get(c) not in (None, ""):
            return row[c]
    return None


def fetch():
    resolve()

    by_sector = defaultdict(list)
    skipped_no_coords = 0
    stats = {"skipped_files": [], "columns_seen": set()}

    # Progress is printed per sector because this run takes many minutes: eight
    # packages to download and several million CSV rows to parse. A harvester
    # that prints nothing until it finishes is indistinguishable from one that
    # has hung, and the first version of this file was exactly that.
    for i, sector_name in enumerate(SECTORS, 1):
        url = sector_url(sector_name)
        print(f"climate_trace: [{i}/{len(SECTORS)}] downloading {sector_name}...",
              flush=True)
        try:
            r = requests.get(url, timeout=900)
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"climate_trace: WARNING — {sector_name} package failed: {e}",
                  flush=True)
            continue

        mb = len(r.content) / 1_048_576
        print(f"climate_trace: [{i}/{len(SECTORS)}] {sector_name} {mb:.1f} MB, parsing...",
              flush=True)
        before = sum(len(v) for v in by_sector.values())

        for row in _rows_from_package(r.content, stats):
            stats["columns_seen"].update(row.keys())

            # The gas is already fixed by the URL path, so this is a sanity
            # check rather than a filter: a mismatch means the package layout
            # changed under us and the rows are not what was asked for.
            gas = (_pick(row, "gas") or "").lower()
            if gas and gas != GAS:
                continue

            lat = _pick(row, *LAT_COLS)
            lon = _pick(row, *LON_COLS)
            if not lat or not lon:
                skipped_no_coords += 1
                continue

            qty = _pick(row, *QTY_COLS)
            try:
                value = float(qty) if qty else 0.0
            except ValueError:
                value = 0.0

            sector = _pick(row, "sector") or sector_name
            by_sector[sector].append({
                "ident": _pick(row, "source_id", "asset_id", "native_id")
                         or _pick(row, "source_name", "asset_name"),
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

        gained = sum(len(v) for v in by_sector.values()) - before
        print(f"climate_trace: [{i}/{len(SECTORS)}] {sector_name} -> {gained:,} rows",
              flush=True)

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
    achieved = 1.0
    if len(kept) > FEATURE_CAP:
        capped = True
        grand = sum(r["value"] for r in kept)
        kept = kept[:FEATURE_CAP]
        achieved = sum(r["value"] for r in kept) / grand if grand else 0

    print(f"climate_trace: gas={GAS}, coverage target={COVERAGE:.0%}")
    for sector, cut, n, share in report:
        print(f"  {sector:<32} {cut:>7,} of {n:>9,} sources = {share:.1%}")
    if stats["skipped_files"]:
        print(f"  {len(stats['skipped_files'])} CSVs skipped as ownership or "
              f"country-level (no coordinates or no quantity)")
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
