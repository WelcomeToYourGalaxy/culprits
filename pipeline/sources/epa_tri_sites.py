"""
US toxic release sites — EPA Toxics Release Inventory, harvested whole.

WHY THIS EXISTS WHEN THERE IS ALREADY A WORKER ROUTE
The live `epa_tri` route queries Envirofacts for whatever is in view, which
means it cannot draw at world zoom: the API will not serve a continent in one
request, so the layer sits behind an area cap and tells the reader to zoom in.
Harvested once into an archive, the same facilities draw at every zoom like any
other pmtiles layer.

The Worker route is not replaced by this. It stays as the live view, and the two
can coexist — one is current to the minute within a small box, the other is
complete and static.

COLUMN NAMES ARE NOT GUESSED
`pref_latitude`, `pref_longitude`, `tri_facility_id`, `facility_name` and
`state_abbr` are taken from the Worker's own shaper, which has been rendering
these facilities on the map. That is stronger evidence than EPA's documentation,
which still describes a CAFO view that both of its live services now reject.

TWO TRAPS, BOTH ALREADY PAID FOR ONCE
Envirofacts SILENTLY IGNORES range filters on this table — asking for latitude
between 33.9 and 34.1 returns Puerto Rico. So the only filter that can be
trusted is equality, and the harvest iterates states rather than boxes.

Some longitudes arrive positive. Every TRI facility is in the United States or
its territories, all of which are west of the meridian, so a positive longitude
is a sign dropped somewhere upstream and is flipped. A facility at -118.2 that
arrives as 118.2 would otherwise plot in inner Mongolia, which looks like a
plausible dot rather than an error.

ONE THING TO WATCH
EPA discontinued collecting latitude and longitude in TRI itself; positions now
come from the Facility Registry Service and are surfaced through these columns.
Rows with no usable coordinate are dropped and counted, never given a state
centroid — a TRI facility is a real address, and inventing a position for one
would be the same error as plotting a country centroid as a site.
"""

import json

import requests

UA = {"User-Agent": "welcometoyourgalaxy-atlas/1.0 (+https://welcometoyourgalaxy.com)"}
BASE = "https://data.epa.gov/efservice/tri_facility"
PAGE = 10000          # Envirofacts' own default and maximum per request
TIMEOUT = 180

# 50 states, DC, and the territories TRI covers. Iterated rather than filtered
# by box because only equality filters work on this table. Any code returning
# zero rows is printed, so a state disappearing upstream shows up as a line in
# the log rather than as a quietly emptier map.
STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
    "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
    "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
    "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
    "WV", "WI", "WY",
    "PR", "VI", "GU", "AS", "MP",
]


def resolve():
    """
    No blob SHA and no ETag to lean on, so the row count is the change signal:
    it moves when facilities are added or removed, and not otherwise. If COUNT
    is unavailable the harvest still runs — it just refreshes every time, which
    is wasteful rather than wrong.
    """
    url = f"{BASE}/COUNT/JSON"
    try:
        r = requests.get(url, headers=UA, timeout=60)
        r.raise_for_status()
        body = r.json()
        count = None
        if isinstance(body, list) and body:
            count = next(iter(body[0].values()), None)
        elif isinstance(body, dict):
            count = next(iter(body.values()), None)
        if count is None:
            raise ValueError(f"no count in response: {str(body)[:200]}")
        return BASE, f"count:{count}"
    except Exception as e:
        print(f"epa_tri_sites: COUNT unavailable ({e}); "
              f"harvesting unconditionally this run")
        return BASE, None


def fetch():
    out = []
    seen_ids = set()
    no_coords = 0
    flipped = 0
    empty_states = []

    for abbr in STATES:
        rows = _all_rows_for(abbr)
        if not rows:
            empty_states.append(abbr)
            continue

        kept = 0
        for r in rows:
            lat = _num(_get(r, "pref_latitude", "latitude"))
            lon = _num(_get(r, "pref_longitude", "longitude"))
            if lat is None or lon is None or (lat == 0 and lon == 0):
                no_coords += 1
                continue
            if lon > 0:
                lon = -lon
                flipped += 1

            ident = _get(r, "tri_facility_id", "frs_id") or f"{abbr}:{lat},{lon}"
            # The same facility appears under more than one reporting year in
            # some extracts. Keyed by id so a facility is one dot, not five.
            if ident in seen_ids:
                continue
            seen_ids.add(ident)

            out.append({
                "ident": ident,
                "name": _get(r, "facility_name") or "TRI facility",
                "lon": lon,
                "lat": lat,
                # No magnitude. This table lists facilities; release quantities
                # live in tri_reporting_form and are per chemical per year, so
                # a single number here would be an invention.
                "value": None,
                "unit": "TRI facility",
                "year": None,
                "url": (f"https://enviro.epa.gov/enviro/tris_control_v2.tris_print?"
                        f"tris_id={ident}" if ident else None),
                "extra": {
                    "state": _get(r, "state_abbr") or abbr,
                    "city": _get(r, "city_name"),
                    "county": _get(r, "county_name"),
                    "street": _get(r, "street_address"),
                    "zip": _get(r, "zip_code"),
                    "parent": _get(r, "parent_co_name"),
                    "federal_facility": _get(r, "federal_facility_ind"),
                },
            })
            kept += 1
        print(f"  {abbr}: {kept:,} facilities")

    print(f"epa_tri_sites: {len(out):,} facilities across "
          f"{len(STATES) - len(empty_states)} states and territories")
    if no_coords:
        print(f"  {no_coords:,} rows had no usable coordinate and were dropped, "
              f"not placed at a centroid")
    if flipped:
        print(f"  {flipped:,} longitudes arrived positive and were flipped west")
    if empty_states:
        print(f"  NO ROWS for: {', '.join(empty_states)} — check before assuming "
              f"these have no TRI facilities")
    return out


def _all_rows_for(abbr):
    """Page through one state until a short page says there is no more."""
    rows, start = [], 0
    while True:
        url = f"{BASE}/state_abbr/{abbr}/rows/{start}:{start + PAGE - 1}/JSON"
        try:
            r = requests.get(url, headers=UA, timeout=TIMEOUT)
            r.raise_for_status()
            page = r.json()
        except Exception as e:
            # Reported rather than raised: one state failing should not cost the
            # other fifty-five, but it must not pass unnoticed either.
            print(f"  {abbr}: FAILED at row {start} ({e})")
            break
        if not isinstance(page, list) or not page:
            break
        rows.extend(page)
        if len(page) < PAGE:
            break
        start += PAGE
    return rows


def _get(row, *names):
    """Envirofacts varies the case of its keys between endpoints."""
    for n in names:
        for key in (n, n.upper(), n.lower()):
            if key in row and row[key] not in ("", None):
                return row[key]
    return None


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    rows = fetch()
    print(json.dumps(rows[0], indent=1) if rows else "no rows")
