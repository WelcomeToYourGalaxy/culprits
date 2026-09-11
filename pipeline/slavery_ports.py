"""
Ports with high-risk vessel calls — from WelcomeToYourGalaxy/anti-slavery-map.

3,424 ports, scored against the published behavioural model in McDonald et al.,
PNAS 2021, which is trained on 27 observable vessel behaviours — AIS gaps over 12
and over 24 hours, presence on an official IUU list, flag of convenience, visits
to ports of convenience, transhipment with IUU or known forced-labour vessels.

WHAT THE SCORE IS ABOUT
The share of fishing vessels calling at a port that the model flagged high-risk.
It is a property of the calls, not of the port authority, and it names nobody:
the model scores behaviour, and behaviour consistent with forced labour is not a
finding of forced labour. The repo's own note puts it as infrastructure rather
than findings — ports where crews can be transferred — and that framing is what
the layer carries.

A port is a real place with a real coordinate, so these draw solid. That is the
one thing here that is not in doubt.
"""

import _wtyg

REPO = "anti-slavery-map"
PATH = "infra.json"


def resolve():
    return _wtyg.resolve_repo_file(REPO, PATH)


def fetch():
    data, _ = _wtyg.repo_json(REPO, PATH)
    rows = data["projects"]

    out = []
    skipped_coords = 0
    for r in rows:
        lat, lon = r.get("lat"), r.get("lng")
        if lat is None or lon is None:
            skipped_coords += 1
            continue

        out.append({
            "ident": f"port:{r.get('name')}:{lat},{lon}",
            "name": r.get("name"),
            "lon": lon,
            "lat": lat,
            "value": None,
            "unit": "port",
            "year": None,
            "url": r.get("url") or None,
            "extra": {
                "precision": _wtyg.precision_from(r),
                "type": r.get("type"),
                "country": r.get("state") or None,
                # The repo's own 1-5 scales. Carried under their own names
                # rather than promoted to `value`, because neither is a
                # measured quantity and putting one in the magnitude field
                # would size a dot by an ordinal.
                "exposure_rank": r.get("exposure"),
                "impact_rank": r.get("impact"),
            },
        })

    print(f"slavery_ports: {len(out):,} ports "
          f"({skipped_coords:,} dropped for having no coordinates)")
    print(f"  source note: {data.get('note')}")
    return out


if __name__ == "__main__":
    rows = fetch()
    print(rows[0])
