"""
Genetic-engineering registers — from WelcomeToYourGalaxy/GMO-map.

43,741 records: US APHIS BRS environmental-release authorisations, Canadian CFIA
approvals, Australian OGTR licences, national biosafety decisions from the CBD
Biosafety Clearing-House, and industry and clinical registers.

ALMOST NOTHING HERE IS A COORDINATE
41,948 of the 43,741 rows carry `precise: false`. APHIS publishes the state a
release was authorised in and never a field, so every US record sits at a state
centroid; CFIA records sit at the national centroid, because that register
records a national approval rather than a planting location. 1,793 rows are
genuinely located. That ratio is the single most important thing about this
layer, so `precision` travels per feature and the map draws the imprecise ones
hollow — the same treatment Carbon Bombs' 92 country centroids get.

NOTHING IS FILTERED OUT
The file mixes registers: environmental releases, Animal Welfare Act facility
licences, gene-therapy trial sponsors, fertility clinics. All of them are
harvested and `register` travels with each feature, so the reader filters in the
panel. Which of these belong on a map about environmental destruction is a
judgement, and it is not one a pipeline should make invisibly.

The upstream file has already dropped 6,085 records that were never authorised —
withdrawn, denied, void, returned, incomplete, cancelled — and states so in its
own `dropped` block. That is the source's decision, made before this harvester
sees the data; the count is printed each run so it stays visible.
"""

import hashlib
import json

import requests

import _wtyg

REPO = "GMO-map"
PATH = "projects.json"
# The map's own page carries a second set of records written into it by hand
# (PJ_SEED): about a thousand organisations - seed and trait firms, gene-editing
# and DNA-synthesis companies, contract labs, funders, regulators and trade
# bodies - and the recorded escapes and contamination cases. The map merges
# them with projects.json, keyed on url|name so a record never appears twice,
# and so does this (round 71). Before that none of them reached the atlas.
PAGE = "index.html"

# The register a record came from is the first segment of its `source` field:
# "ogtr:DIR-201" -> ogtr. Five registers in the current file.
REGISTERS = {
    "aphis": "US APHIS BRS",
    "industry": "industry register",
    "bch": "CBD Biosafety Clearing-House",
    "clinical": "clinical trial sponsor",
    "ogtr": "Australia OGTR",
    "escape": "escape and contamination record",
}


def _seed():
    """The records written into the map's own page, or [] if it cannot be read."""
    try:
        r = requests.get(_wtyg.raw_url(REPO, PAGE), headers=_wtyg.UA, timeout=_wtyg.TIMEOUT)
        r.raise_for_status()
        text = r.text
        at = text.index("var PJ_SEED=") + len("var PJ_SEED=")
        data, _ = json.JSONDecoder().raw_decode(text[at:])
        return data.get("projects") or []
    except Exception as e:  # the file's records still go through
        print(f"  gmo_releases: the page's own records could not be read ({e}); projects.json only")
        return []


def _key(r):
    # The map's merge key: String(url) + "|" + name, where a missing url reads
    # "undefined" in the browser.
    u = r.get("url")
    return f"{'undefined' if u is None else u}|{r.get('name')}"



def resolve():
    return _wtyg.resolve_repo_file(REPO, PATH)


def fetch():
    data, _ = _wtyg.repo_json(REPO, PATH)
    rows = list(data["projects"])
    # Every row of projects.json is kept; a hand-written record is added only
    # where the file does not already hold it, as the map itself does.
    have = {_key(r) for r in rows}
    seed = [r for r in _seed() if _key(r) not in have]
    rows += seed
    print(f"gmo_releases: {len(seed):,} records from the map's own page added to projects.json's {len(data['projects']):,}")
    seen_ids = {}

    out = []
    skipped_coords = 0
    for r in rows:
        lat, lon = r.get("lat"), r.get("lng")
        if lat is None or lon is None:
            skipped_coords += 1
            continue

        src = r.get("source") or ""
        register = src.split(":")[0]
        # One id per record. It was the register's name ("bch:decision"), which
        # 3,028 decisions shared, so the pieces kept one record per register and
        # a click showed another record's description (round 71).
        h = hashlib.sha1("|".join(str(r.get(k)) for k in ("source", "url", "name", "date", "state", "type")).encode("utf-8")).hexdigest()[:12]
        n = seen_ids.get(h, 0)
        seen_ids[h] = n + 1
        ident = f"{h}-{n}" if n else h

        out.append({
            "ident": ident,
            "name": r.get("name"),
            "lon": lon,
            "lat": lat,
            # No magnitude. These are authorisations, not quantities: the file
            # records hectares only as free text ("1 site, max 2 ha/yr") and
            # parsing that into a number would be inventing one.
            "value": None,
            "unit": "authorisation",
            "year": _year(r.get("date")),
            "url": r.get("url") or None,
            # Every column the source published, kept whole beside the chosen fields:
            # normalize.py files it in map/data/pieces/<source>/ and the map shows it on click.
            "raw": r,
            "extra": {
                # The register and entry kind ("bch:decision", "industry:seed"),
                # which the map's rows filter on, and the place, which the whole
                # records at that point are filed under in the pieces.
                "src": src or None,
                "at": f"{float(lon):.5f},{float(lat):.5f}",
                "precision": _wtyg.precision_from(r),
                "register": REGISTERS.get(register, register or None),
                "type": r.get("type"),
                "applicant": r.get("company") or None,
                "state": r.get("state") or None,
                "extent": r.get("size") or None,
                "status": r.get("status") or None,
                # Round 76: what the Genetic engineering map's key filters on,
                # read from the same fields it reads (pjRelPasses, pjSubjOf).
                # A field the record does not carry is left empty, and an empty
                # field is never hidden by a filter.
                "lapsed": ("expired" if r.get("lapsed") is True else "in date" if r.get("lapsed") is False else None),
                "decade": (f"{(_year(r.get('date')) // 10) * 10}s" if _year(r.get("date")) else "no date given"),
                "phase": {"pre": "under assessment", "post": "consented", "live": "consented"}.get(r.get("phase")) if r.get("phase") else None,
                "scale": SCALE.get(r.get("impact")) if r.get("impact") else None,
                "otype": (r.get("otype") or "company") if register == "industry" else None,
                "subjects": _subjects(r) if register == "industry" else None,
                "organisms": ("|" + "|".join(r.get("species")) + "|") if isinstance(r.get("species"), list) and r.get("species") else None,
            },
        })

    dropped = (data.get("dropped") or {})
    print(f"gmo_releases: {len(out):,} records "
          f"({skipped_coords:,} dropped for having no coordinates)")
    print(f"  upstream had already excluded {dropped.get('total', 0):,} never-authorised "
          f"records ({dropped.get('share_pct', '?')}% of {dropped.get('seen', 0):,} seen): "
          f"{dropped.get('reason', 'reason not stated')}")
    imprecise = sum(1 for r in out if r["extra"]["precision"])
    print(f"  {imprecise:,} of {len(out):,} carry no site coordinate and draw hollow")
    return out


# The Genetic engineering map's release scale (its SCALE labels, by impact).
SCALE = {1: "small, one site", 2: "a few sites", 3: "medium, several sites or states",
         4: "large, ten or more sites", 5: "largest, forty sites or ten states"}
# Its subjects (PJ_SUBJ): which tags go under which, and where an unmapped tag's
# facet puts it.
SUBJ_TAGS = {
    "plants and crops": ["seed:traits", "seed:germplasm", "seed:majors", "seed:licensees", "seed:distribution", "editing:agtech", "deextinct:trees"],
    "animals": ["animals:models", "animals:breeders", "animals:primates", "animals:services", "livestock:livestock", "livestock:cloning",
                "livestock:aqua", "livestock:pets", "deextinct:rescue", "deextinct:biobank", "deextinct:ventures"],
    "human medicine and reproduction": ["clinical:therapy", "clinical:trials", "clinical:vectors", "clinical:germline", "repro:clinics",
                                        "repro:banks", "repro:surrogacy", "repro:screening"],
    "wild release": ["wild:insects", "wild:microbes", "wild:drives"],
    "microbes and fermentation": ["editing:synbio", "synthesis:synth", "synthesis:seq", "synthesis:reagents", "synthesis:repos", "cro:cdmo"],
    "tools, patents and platforms": ["editing:platform", "editing:patents", "rules:ip", "cro:cro", "clinical:cro"],
    "money": ["money:vc", "money:markets", "money:public", "money:philanthropy", "money:defence"],
    "rules and influence": ["rules:regulators", "rules:standards", "rules:associations", "rules:influence", "cro:regulatory"],
}
TAG_SUBJ = {}
for _k, _tags in SUBJ_TAGS.items():
    for _t in _tags:
        TAG_SUBJ.setdefault(_t, []).append(_k)
FACET_SUBJ = {"seed": "plants and crops", "editing": "plants and crops", "animals": "animals", "livestock": "animals",
              "deextinct": "animals", "clinical": "human medicine and reproduction", "repro": "human medicine and reproduction",
              "wild": "wild release", "synthesis": "microbes and fermentation", "cro": "microbes and fermentation",
              "money": "money", "rules": "rules and influence"}


def _subjects(r):
    """|subject|subject| from the record's tags, as the map's pjSubjOf reads them."""
    out = []
    for t in r.get("tags") or []:
        for k in TAG_SUBJ.get(t) or [FACET_SUBJ.get(str(t).split(":")[0])]:
            if k and k not in out:
                out.append(k)
    return ("|" + "|".join(out) + "|") if out else None


def _year(date):
    """The file's dates are YYYY-MM-DD strings. Take the year, or nothing."""
    if not date:
        return None
    try:
        return int(str(date)[:4])
    except ValueError:
        return None


if __name__ == "__main__":
    from collections import Counter
    rows = fetch()
    print("by register:", Counter(r["extra"]["register"] for r in rows).most_common())
    print("by precision:", Counter(r["extra"]["precision"] for r in rows).most_common())
