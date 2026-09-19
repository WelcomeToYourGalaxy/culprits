#!/usr/bin/env python3
"""
Building types: the accountability maps' building files combined into one set,
one record per place, with duplicates merged.

Read from the same files the separate rows used (pipeline/sitemaps/repo_layers.json,
via sources/_repo_rows.py). Places of the same type that sit within 120 m of each
other and carry the same name (or where one has no name) are one place: the
fuller record is kept, and every field the other adds is kept too, marked with
the file it came from. Nothing is dropped: every source row ends up in exactly
one output record, and each record lists all the files that describe it.

Usage:  python3 pipeline/building_types.py OUT.geojsonl SUMMARY.json
"""
import json, math, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from sources._repo_rows import make, LAYERS  # noqa: E402

TYPES = [
    ("Banks", ["fin_bank"]), ("Central bank buildings", ["fin_centralbank"]), ("Tax offices", ["fin_taxoffice"]),
    ("Government finance offices", ["fin_govfinance"]), ("Financial services", ["fin_financial"]),
    ("Currency exchanges", ["fin_exchange"]), ("Insurance offices", ["fin_insurance"]), ("Accountants", ["fin_accountant"]),
    ("Money transfer offices", ["fin_remittance"]), ("Stock exchanges", ["fin_stockexchange"]),
    ("Audit offices", ["fin_auditoffice", "leg_audit"]), ("Development banks", ["fin_devbank"]), ("Mints", ["fin_mint"]),
    ("Public defenders and prosecutors", ["legal_publicdefender"]), ("Immigration enforcement", ["legal_immigration"]),
    ("Probation offices", ["legal_probation"]), ("Juvenile detention", ["legal_juvenile"]),
    ("Parliaments and legislatures", ["leg_parliament"]), ("Electoral offices", ["leg_electoral"]),
    ("Ombudsman offices", ["leg_ombudsman"]), ("Councils", ["leg_council"]), ("Fire stations", ["exec_firestation"]),
    ("Town halls", ["exec_townhall", "leg_townhall"]), ("Government offices", ["exec_govoffice"]),
    ("Ministries and agencies", ["exec_ministry"]), ("Embassies and consulates", ["exec_diplomatic"]),
    ("Border posts", ["exec_border"]),
    ("Courts", ["jud_courts", "legal_courthouse", "activist_courts"]),
    ("Police stations", ["exec_police", "legal_police", "activist_police"]),
    ("Prisons", ["exec_prison", "legal_prison", "jud_prisons", "activist_prisons"]),
]
MIXED = "slavery_facilities"   # courthouses, consulates and border posts in one file: sorted by its own type field


def words(s):
    return set(w for w in re.split(r"[^a-z0-9]+", str(s or "").lower()) if len(w) > 2)


def same_name(a, b):
    if not a or not b or a.startswith("Unnamed") or b.startswith("Unnamed"):
        return True
    wa, wb = words(a), words(b)
    return bool(wa and wb) and len(wa & wb) / max(len(wa), len(wb)) >= 0.5


def metres(a, b):
    dx = (a["lon"] - b["lon"]) * 111320 * math.cos(math.radians((a["lat"] + b["lat"]) / 2))
    dy = (a["lat"] - b["lat"]) * 110540
    return math.hypot(dx, dy)


def mixed_type(extra):
    text = " ".join(str(v) for k, v in extra.items() if re.search(r"type|kind|categ|facility", k, re.I)).lower()
    if "consul" in text or "embass" in text:
        return "Embassies and consulates"
    if "labo" in text:
        return "Labour offices"
    if "border" in text or "customs" in text:
        return "Border posts"
    if "court" in text:
        return "Courts"
    return "Courthouses, consulates and labour offices (type not given)"


def fields(r):
    out = {k: v for k, v in (r.get("extra") or {}).items() if v not in (None, "")}
    if r.get("url"):
        out["url"] = r["url"]
    return out


def main(out_path, summary_path):
    rows = []
    for tname, ids in TYPES:
        for sid in ids:
            _, fetch = make(sid)
            for r in fetch():
                rows.append((tname, sid, r))
    _, fetch = make(MIXED)
    for r in fetch():
        rows.append((mixed_type(r.get("extra") or {}), MIXED, r))

    places, grid = [], {}
    for tname, sid, r in rows:
        cell = (tname, round(r["lat"] * 500), round(r["lon"] * 500))
        hit = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in grid.get((tname, cell[1] + dx, cell[2] + dy), []):
                    p = places[i]
                    if metres(p, r) <= 120 and same_name(p["name"], r["name"]):
                        hit = i
                        break
                if hit is not None:
                    break
            if hit is not None:
                break
        f, label = fields(r), LAYERS[sid]["name"]
        if hit is None:
            grid.setdefault(cell, []).append(len(places))
            places.append({"type": tname, "name": r["name"], "lat": r["lat"], "lon": r["lon"],
                           "fields": f, "sources": [label]})
            continue
        p = places[hit]
        if label not in p["sources"]:
            p["sources"].append(label)
        # The fuller record leads; the other's fields are kept beside it.
        if len(f) > len(p["fields"]):
            p["fields"], f = f, p["fields"]
            if r["name"] and not r["name"].startswith("Unnamed"):
                p["name"] = r["name"]
        for k, v in f.items():
            if k not in p["fields"]:
                p["fields"][k] = v
            elif p["fields"][k] != v:
                p["fields"][f"{k} ({label})"] = v

    counts = {}
    with open(out_path, "w", encoding="utf-8") as fo:
        for p in places:
            counts[p["type"]] = counts.get(p["type"], 0) + 1
            props = {"type": p["type"], "name": p["name"], "sources": " ; ".join(p["sources"]),
                     "merged": len(p["sources"])}
            props.update({k: v for k, v in p["fields"].items() if isinstance(v, (str, int, float, bool))})
            fo.write(json.dumps({"type": "Feature", "geometry": {"type": "Point", "coordinates": [p["lon"], p["lat"]]},
                                 "properties": props}, ensure_ascii=False, separators=(",", ":")) + "\n")
    summary = {"rows": len(rows), "places": len(places), "types": dict(sorted(counts.items(), key=lambda x: -x[1]))}
    pathlib.Path(summary_path).write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"building types: {len(rows):,} source rows became {len(places):,} places in {len(counts)} types")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
