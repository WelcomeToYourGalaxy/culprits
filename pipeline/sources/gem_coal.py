"""
Coal plant units — Global Energy Monitor's Global Coal Plant Tracker.

13,784 generating units worldwide, each with coordinates, capacity, owner,
parent company and status.

WHY THIS PATH
GEM's own download sits behind a request form, which is why this source was
listed as the one thing that could never be automated. But GEM's public tracker
maps are built by GreenInfo-Network and the data is committed to their repo, so
the same dataset is reachable over plain HTTP and refreshes when they update it.
The manual drop directory stays for the trackers not mirrored this way.

STATUS IS KEPT, NOT FILTERED
The tracker covers operating, construction, pre-permit, permitted, announced,
shelved, cancelled, retired and mothballed units. A map of culprits could
reasonably want only some of those, but that is a decision for the reader, so
every unit is harvested and `status` travels per feature for filtering in the
map panel.

UNITS, NOT PLANTS
Rows are generating units, so one power station appears several times at nearly
the same coordinates. Capacity is per unit and sums correctly; a count of rows
is a count of units, not stations.
"""

import requests

DATA_URL = ("https://raw.githubusercontent.com/GreenInfo-Network/"
            "coal-tracker-client/master/data/trackers.json")


def resolve():
    """
    Not routed through discover.github_file: the GitHub contents API is rate
    limited to 60 requests/hour unauthenticated and this file is large. The raw
    URL carries an ETag, which is all the change detection needs.
    """
    try:
        head = requests.head(DATA_URL, timeout=45, allow_redirects=True)
        return DATA_URL, head.headers.get("ETag") or head.headers.get("Last-Modified")
    except requests.RequestException:
        return DATA_URL, None


def _num(v):
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def fetch():
    r = requests.get(DATA_URL, timeout=300)
    r.raise_for_status()
    rows = r.json()

    out = []
    no_coords = 0
    for row in rows:
        lat, lng = _num(row.get("lat")), _num(row.get("lng"))
        if lat is None or lng is None:
            no_coords += 1
            continue

        name = row.get("plant") or "Unnamed"
        unit = row.get("unit")
        out.append({
            "ident": row.get("id"),
            "name": f"{name} — {unit}" if unit else name,
            "lon": lng,
            "lat": lat,
            "value": _num(row.get("capacity")),
            "unit": "MW capacity",
            "year": int(row["year"]) if str(row.get("year", "")).isdigit() else None,
            "url": row.get("url") or None,
            "extra": {
                "status": row.get("status"),
                "country": row.get("country"),
                "subnational": row.get("subnational"),
                "region": row.get("region"),
                "owner": row.get("owner"),
                "parent": row.get("parent"),
                "plant": name,
                "local_name": row.get("plant_local"),
            },
        })

    total = sum(r["value"] or 0 for r in out)
    print(f"gem_coal: {len(out):,} coal units, {total:,.0f} MW "
          f"({no_coords:,} dropped for having no coordinates)")
    return out


if __name__ == "__main__":
    from collections import Counter
    rows = fetch()
    print("status:", Counter(r["extra"]["status"] for r in rows).most_common())
    print("top parents:", Counter(r["extra"]["parent"] for r in rows).most_common(3))
