"""
Soy industry organisations — from the Welcome to Your Galaxy maps repo.

21 trade bodies, associations and standards organisations with addresses and
coordinates, compiled for the Destruction page's soy section and embedded there
as soy_organizations.html.

These are not facilities. They are the bodies that set the rules for the trade —
FOSFA, the American Soybean Association, the United Soybean Board — so the layer
carries no magnitude. There is nothing to count, and inventing one would make
them look like emitters.
"""

import re

import requests

import discover
import jsobj

REPO = "WelcomeToYourGalaxy/maps"
PATH = "soy_organizations.html"


def resolve():
    return discover.github_file(REPO, PATH)


def fetch():
    url, _ = resolve()
    r = requests.get(url, timeout=90)
    r.raise_for_status()

    m = re.search(r'const organizations\s*=\s*(\[[\s\S]*?\]);', r.text)
    if not m:
        raise RuntimeError(
            "the organizations array is no longer where this expects it — "
            "check soy_organizations.html"
        )
    rows = jsobj.parse(m.group(1))

    out = []
    for row in rows:
        if row.get("lat") is None or row.get("lon") is None:
            continue
        out.append({
            "ident": row.get("name"),
            "name": row.get("name") or "Unnamed organisation",
            "lon": row["lon"],
            "lat": row["lat"],
            "value": None,
            "unit": "soy industry body",
            "year": None,
            "url": None,
            "extra": {
                "address": row.get("address"),
                "country": row.get("country"),
            },
        })

    print(f"soy_organizations: {len(out)} organisations")
    return out


if __name__ == "__main__":
    for r in fetch()[:5]:
        print(f"  {r['name'][:46]:<48} {r['extra']['country']}")
