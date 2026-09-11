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

NOTHING IS CUT
Every source Climate TRACE publishes with a coordinate is harvested. An earlier
version kept only the largest emitters until 95% of each sector's total was
accounted for, under a hard ceiling of 60,000 features. Those two limits
interacted and produced a layer carrying 41.7% of the emissions it claimed to
show — a figure nobody chose. Selection belongs in the map panel, where the
reader can see it and change it.

The only rows dropped are those with no coordinate: there is nothing to place.
The count is printed every run.

STILL UNRUN
climatetrace.org is not reachable from the environment this was written in, so
the network paths here have still never executed. What changed is that the URL
is now observed rather than inferred, and the CSV selection no longer depends
on a guess. Run `python pipeline/probe.py climate_trace --fetch` before
trusting it; the probe reports what it found without writing anything.
"""

import csv
import io
import os
import re
import tempfile
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

# Nothing is cut. Every emissions source Climate TRACE publishes with a
# coordinate is harvested, and what a reader sees is decided in the map panel
# rather than here.
#
# Three limits used to sit at this point in the file and all three are gone:
#   COVERAGE = 0.95   kept only the largest emitters per sector
#   FEATURE_CAP       hard ceiling of 60,000 features
#   HEAP_CAP          bounded the rows held while streaming
# Together they produced a layer carrying 41.7% of the emissions it claimed to
# show, and no one chose that figure — it fell out of two caps interacting.
#
# Removing them removes the sorting and the heap as well: those existed only to
# decide what to drop. fetch() is now a generator that yields every row as it
# reads it, so memory stays flat no matter how large the dataset is.
#
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


def _rows_from_package(path, stats):
    """Yield asset-level emission rows from one sector zip on disk, skipping
    ownership and country-level CSVs by inspecting their columns.

    Takes a path rather than bytes: a 1.4 GB archive held in memory alongside
    its parsed rows is what killed the first run."""
    with zipfile.ZipFile(path) as z:
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


def _download(url, dest):
    """Stream a package to disk in chunks. Returns its size in bytes."""
    total = 0
    with requests.get(url, timeout=900, stream=True) as r:
        r.raise_for_status()
        with open(dest, "wb") as fh:
            for chunk in r.iter_content(chunk_size=1 << 20):
                fh.write(chunk)
                total += len(chunk)
    return total


def _pick(row, *candidates):
    """Column names have shifted across releases; try each in turn."""
    for c in candidates:
        if row.get(c) not in (None, ""):
            return row[c]
    return None


# Climate TRACE's own column dictionary. Its third column,
# "2026_asset-definition", is what separates a power station from a 9 km
# pasture cell, keyed on (sector, subsector) — both of which travel in the data
# rows. So precision is read from the publisher's schema rather than guessed
# from the geometry.
SCHEMA_URL = f"{DOWNLOAD_BASE}/latest/about_the_data/detailed_data_schema.csv"


# Written against the real list of 91 asset-definitions, printed from the
# schema, not against a guess at their shape. An earlier version had only
# "grid", "gadm/fua" and "everything else is a facility", and that put 51.6
# million rows in the facility bucket — including rice paddies, fields,
# reservoirs, road segments and ships. There are not 51 million refineries.
#
# The classes below are what the strings actually describe:
#   asset    a located facility — refinery, coal mine, port, cement plant
#   admin    a GADM/GHS-FUA unit, plotted at its centroid
#   grid     a model cell, plotted at its centre (cell size kept)
#   area     an extent — rice paddies, fields, reservoirs
#   segment  a line — road or rail, plotted at a point along it
#   mobile   a vessel; its position is one moment, not a site
#   unknown  the schema gives no definition
#
# Only "asset" renders solid. Everything else is a point standing in for
# something that is not a point, and the map says so.
AREA_DEFINITIONS = {"field", "rice-paddies-area", "water-reservoirs"}
MOBILE_DEFINITIONS = {"ship"}
SEGMENT_DEFINITIONS = {"road-segment"}


def _precision_of(definition):
    """Classify one asset-definition string into one of the classes above."""
    d = (definition or "").strip().lower()
    if not d or d in ("n/a", "na", "none"):
        return "unknown", None
    if "grid" in d:
        # Keep the cell size: "9km-by-9km" is the difference between a field
        # and a landscape, and the reader is entitled to know which.
        m = (re.search(r"(\d+\s*(?:km|m))-by-\1", d)
             or re.search(r"(\d+\s*(?:km|m))-by-", d))
        return "grid", (m.group(1) if m else None)
    if "gadm" in d or "fua" in d:
        # GADM is the global administrative-boundary set; GHS-FUA is functional
        # urban areas. Either way the point is a centroid, not a place.
        return "admin", None
    if d in MOBILE_DEFINITIONS:
        return "mobile", None
    if d in SEGMENT_DEFINITIONS:
        return "segment", None
    if d in AREA_DEFINITIONS or d.endswith("-area"):
        return "area", None
    return "asset", None


def load_asset_definitions():
    """Map (sector, subsector) -> asset-definition string, from the publisher.

    Positional rather than DictReader: the header repeats 'sector' and
    'subsector' later in the row, and DictReader silently keeps the last of
    each, which would key every lookup on the wrong column.
    """
    r = requests.get(SCHEMA_URL, headers=discover.UA, timeout=120)
    r.raise_for_status()
    rows = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
    if not rows:
        raise ValueError("schema CSV was empty")
    out = {}
    for row in rows[1:]:
        if len(row) < 3:
            continue
        sector, subsector, definition = row[0].strip(), row[1].strip(), row[2].strip()
        if sector and subsector:
            out[(sector.lower(), subsector.lower())] = definition
    if not out:
        raise ValueError("schema CSV parsed to no (sector, subsector) pairs")
    return out


def fetch():
    """Yield every asset-level emissions row, with its precision.

    A generator, not a list: this returns on the order of 99 million features
    and no machine holds that in memory. harvest.py writes each row as it
    arrives.
    """
    resolve()

    # Fetched before anything is downloaded: if the schema cannot be read the
    # run stops rather than emitting features with no way to tell a refinery
    # from a pasture cell.
    definitions = load_asset_definitions()
    print(f"climate_trace: schema gives {len(definitions):,} "
          f"(sector, subsector) definitions", flush=True)

    precision_counts = defaultdict(int)
    # Counted per definition as well as per class, so the next run can be
    # checked against the schema instead of trusted.
    definition_counts = defaultdict(int)
    skipped_no_coords = 0
    emitted = 0
    stats = {"skipped_files": [], "columns_seen": set()}

    for i, sector_name in enumerate(SECTORS, 1):
        url = sector_url(sector_name)
        tmp = os.path.join(tempfile.gettempdir(), f"ct_{sector_name}.zip")
        print(f"climate_trace: [{i}/{len(SECTORS)}] downloading {sector_name}...",
              flush=True)
        try:
            size = _download(url, tmp)
        except requests.RequestException as e:
            print(f"climate_trace: WARNING — {sector_name} package failed: {e}",
                  flush=True)
            continue

        print(f"climate_trace: [{i}/{len(SECTORS)}] {sector_name} "
              f"{size / 1_048_576:.0f} MB, parsing...", flush=True)
        rows_in, sector_out = 0, 0

        try:
            for row in _rows_from_package(tmp, stats):
                rows_in += 1
                if rows_in == 1:
                    stats["columns_seen"].update(row.keys())

                gas = (_pick(row, "gas") or "").lower()
                if gas and gas != GAS:
                    continue

                lat = _pick(row, *LAT_COLS)
                lon = _pick(row, *LON_COLS)
                if not lat or not lon:
                    # The only rows dropped. They carry no coordinate, so there
                    # is nothing to place on a map — not a judgement about them.
                    skipped_no_coords += 1
                    continue

                qty = _pick(row, *QTY_COLS)
                try:
                    value = float(qty) if qty else 0.0
                except ValueError:
                    value = 0.0

                sector = _pick(row, "sector") or sector_name
                subsector = _pick(row, "subsector") or ""
                definition = definitions.get((sector.lower(), subsector.lower()), "")
                precision, cell = _precision_of(definition)
                precision_counts[precision] += 1
                definition_counts[definition or "(none)"] += 1
                sector_out += 1
                emitted += 1

                yield {
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
                        # normalize namespaces these to x_*, and the map reads
                        # x_precision to render non-facilities hollow.
                        "precision": precision,
                        "sector": sector,
                        "subsector": subsector,
                        "asset_definition": definition or None,
                        "grid_cell": cell,
                        "country": _pick(row, "iso3_country", "country_iso3"),
                        "capacity": _pick(row, "capacity"),
                        "capacity_units": _pick(row, "capacity_units"),
                        "owner": _pick(row, "reporting_entity", "owner"),
                        "gas": GAS,
                    },
                }
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass

        print(f"climate_trace: [{i}/{len(SECTORS)}] {sector_name} -> "
              f"{sector_out:,} of {rows_in:,} rows", flush=True)

    print(f"climate_trace: gas={GAS}, nothing cut")
    print("  precision of features emitted:")
    for kind in ("asset", "admin", "grid", "area", "segment", "mobile", "unknown"):
        if precision_counts[kind]:
            print(f"    {kind:<10} {precision_counts[kind]:>14,}")
    print("  by asset-definition (top 20):")
    for defn, n in sorted(definition_counts.items(),
                          key=lambda kv: kv[1], reverse=True)[:20]:
        kind = _precision_of(None if defn == "(none)" else defn)[0]
        print(f"    {kind:<8} {n:>14,}  {defn[:56]}")
    if stats["skipped_files"]:
        print(f"  {len(stats['skipped_files'])} CSVs skipped as ownership or "
              f"country-level (no coordinates or no quantity)")
    if skipped_no_coords:
        print(f"  {skipped_no_coords:,} rows had no coordinates and were dropped "
              f"(gridded or country-level subsectors with no point to place)")
    print(f"  {emitted:,} features out")
