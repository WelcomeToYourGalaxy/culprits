#!/usr/bin/env python3
"""
Two of the site's maps copied whole, not only as named dots (25 September,
round 48).

build_boxes.py copies a map by what it draws on its Leaflet map: each marker's
place, colour, tooltip and popup. Two maps keep most of what they hold outside
that: the Eyes network ("The Network That Tried to Harness the Eyes to Harvest
the World") draws its links, periods and write-ups in a diagram beside the
map, and the Drug underworld and capture map builds its popups, groups, cases,
companies, corridors and country scores from one data block when a mark is
clicked. Copied the usual way, the Culprits map showed their names and little
else. These builders read each page's own data instead and write the same two
files build_boxes.py writes (map/data/sitemaps/<id>.places.geojson and
<id>.boxes.json), with:

  eyes    every placed entry at each of its places, its whole write-up (era,
          what they did, why, sources, every connection) in the box; the links
          between entries drawn as lines, each kind (documented, inferred,
          convergence) as the page names them; and the page's seven periods
          as a filter, each entry in the period its row of the diagram sits in.
  capture every organised-crime group (typed as the page types them, with the
          researched note where there is one), every public-office case, every
          company, every trafficking corridor with its note, and every country
          shaded by any of the page's six measures, its scores, record and
          cases in its box.

Nothing is left out that the page draws. What cannot be placed is counted and
said: an entry with no place on the page's own map, a country whose name
matches no boundary.

Run through build_boxes.py (registry entries with "rich"), or alone:
  python3 pipeline/sitemaps/rich_maps.py site_eyes_network capture_map
"""

import hashlib
import html
import json
import math
import pathlib
import re
import subprocess
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "map" / "data" / "sitemaps"


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "culprits-map"}), timeout=120) as r:
        return r.read().decode("utf-8")


def key(*parts):
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def great_circle(pts, step_km=250):
    """A line through the given [lng, lat] points along great circles, the
    longitudes kept continuous so a line over the 180th meridian is drawn
    across it rather than back round the world."""
    out = []
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        la1, lo1, la2, lo2 = map(math.radians, (y1, x1, y2, x2))
        d = 2 * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 +
                                    math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))
        n = max(1, int(d * 6371 / step_km))
        for i in range(n + (1 if (x2, y2) == tuple(pts[-1]) else 0)):
            f = i / n
            if d == 0:
                lat, lon = y1, x1
            else:
                a = math.sin((1 - f) * d) / math.sin(d)
                b = math.sin(f * d) / math.sin(d)
                x = a * math.cos(la1) * math.cos(lo1) + b * math.cos(la2) * math.cos(lo2)
                y = a * math.cos(la1) * math.sin(lo1) + b * math.cos(la2) * math.sin(lo2)
                z = a * math.sin(la1) + b * math.sin(la2)
                lat, lon = math.degrees(math.atan2(z, math.hypot(x, y))), math.degrees(math.atan2(y, x))
            if out:
                prev = out[-1][0]
                while lon - prev > 180:
                    lon -= 360
                while lon - prev < -180:
                    lon += 360
            out.append([round(lon, 4), round(lat, 4)])
    return out


def write(mid, name, page, css, features, filters, boxes, colourings=None, notes=()):
    OUT.mkdir(parents=True, exist_ok=True)
    places = {"type": "FeatureCollection", "name": name, "overlays": [], "filters": filters, "features": features}
    if colourings:
        places["colourings"] = colourings
    (OUT / f"{mid}.places.geojson").write_text(json.dumps(places, separators=(",", ":"), ensure_ascii=False))
    (OUT / f"{mid}.boxes.json").write_text(json.dumps({
        "name": name, "page": page, "css": css, "stylesheets": [], "chain": [], "boxes": boxes},
        separators=(",", ":"), ensure_ascii=False))
    kinds = {}
    for f in features:
        t = f["geometry"]["type"]
        kinds[t] = kinds.get(t, 0) + 1
    print(f"  ok    {mid:<26} {name!r}: " + ", ".join(f"{n} {k}" for k, n in sorted(kinds.items())) +
          f", {len(boxes)} boxes" + "".join(f"\n        note: {n}" for n in notes))
    return name


def box_css(mid):
    s = f".wtyg-map-{mid}"
    return (f"{s} .rm{{font:13px/1.45 system-ui,sans-serif;color:#1F1D1A;max-width:380px}}"
            f"{s} .rm h4{{margin:0 0 3px;font-size:15px}}"
            f"{s} .rm .meta{{color:#5A554C;font-size:12px;margin:0 0 6px}}"
            f"{s} .rm h5{{margin:9px 0 2px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#5A554C}}"
            f"{s} .rm p{{margin:0 0 6px}}"
            f"{s} .rm ul{{margin:0 0 6px 16px;padding:0}}"
            f"{s} .rm .cite{{color:#5A554C;font-size:11.5px;margin-top:4px}}"
            f"{s} .rm table{{border-collapse:collapse;font-size:12px;margin:2px 0 6px}}"
            f"{s} .rm td{{padding:1px 8px 1px 0;vertical-align:top}}"
            f"{s} .rm .term{{font-style:italic}}")


# ------------------------------------------------------------------ the Eyes network

EYES_TYPES = [  # the page's own order and names (its key and its panel)
    ("precond", "Pre-conditions"), ("thinker", "Thinkers"), ("institution", "Institutions"),
    ("government", "Governments"), ("media", "Media and distribution"), ("controller", "Funders and controllers")]
EYES_TYPE_ONE = {"thinker": "Thinker", "institution": "Institution", "government": "Government",
                 "media": "Media / Distribution", "precond": "Pre-Condition (Human Vulnerability)",
                 "controller": "Funder & Controller"}
# Colours chosen so that, once the map draws them between cyan and violet, the
# kinds stay far apart (the page's own orange, red and gold would all land near
# cyan together).
EYES_COLOUR = {"thinker": "#C0504D", "media": "#B8B04A", "institution": "#4AB86A", "precond": "#4AB0B8",
               "government": "#4A62B8", "controller": "#A04AB8"}
EYES_LINKS = [
    ("verifiedEdges", "documented", "Documented links", "#B8B04A", 2.0,
     "A documented line: funding or direct intellectual influence, as the page's key puts it."),
    ("inferredEdges", "inferred", "Inferred links", "#4AB0B8", 1.4,
     "An inferred line: asserted without full documentation, as the page marks it in the entries."),
    ("convergEdges", "convergence", "Convergences", "#A04AB8", 1.1,
     "A convergence: projects that share metaphysical ground without sharing intent, as the page defines it."),
]


def eyes_data(page):
    a = page.find("const C=")
    b = page.find("const allEdges")
    if a < 0 or b < 0:
        raise RuntimeError("the page's data block was not found (const C= ... const allEdges)")
    js = page[a:b] + "\nprocess.stdout.write(JSON.stringify({C,eras,GEO,nodes,verifiedEdges,inferredEdges,convergEdges}));"
    run = subprocess.run(["node", "-"], input=js, capture_output=True, text=True, timeout=120)
    if run.returncode:
        raise RuntimeError(f"node could not read the page's data: {run.stderr[:400]}")
    return json.loads(run.stdout)


def page_title(page, fallback):
    t = re.search(r"<title>([^<]+)</title>", page)
    return html.unescape(t.group(1)).strip() if t and t.group(1).strip() else fallback


def eyes(m):
    mid = m["id"]
    page = fetch(m["url"])
    d = eyes_data(page)
    eras, geo, nodes = d["eras"], d["GEO"], d["nodes"]
    by_id = {n["id"]: n for n in nodes}
    label = lambda n: re.sub(r"\s*\\?\n\s*", " ", n["label"]).replace("\\n", " ").strip()

    def era_of(n):
        # The diagram lays time down its length: an entry's period is the band its row sits in.
        for i, e in enumerate(eras):
            if e["y"] <= n["y"] < e["y"] + e["h"]:
                return i
        return 0 if n["y"] < eras[0]["y"] else len(eras) - 1

    era_label = lambda i: f"{eras[i]['label']} · {eras[i]['desc']}"
    links = []
    for arr, kind, _, _, _, _ in EYES_LINKS:
        for e in d[arr]:
            links.append((kind, e["s"], e["t"]))
    connected = {}
    for kind, s, t in links:
        for a_, b_ in ((s, t), (t, s)):
            if b_ in by_id:
                connected.setdefault(a_, []).append((b_, kind))

    features, boxes = [], {}
    n_type, n_era, n_show = {}, {}, {}
    unplaced = []
    for n in nodes:
        pts = geo.get(n["id"]) or []
        if not pts:
            unplaced.append(label(n))
            continue
        ei = era_of(n)
        conns = []
        for other, kind in connected.get(n["id"], []):
            item = f"{esc(label(by_id[other]))} <span class='meta'>({kind})</span>"
            if item not in conns:
                conns.append(item)
        body = (f"<div class='rm'><div class='meta'>{esc(n.get('era', ''))}</div><h4>{esc(label(n))}</h4>"
                f"<div class='meta'>{esc(EYES_TYPE_ONE.get(n['type'], n['type']))} · period on the page's diagram: {esc(era_label(ei))}</div>"
                f"<p><i>{n.get('short', '')}</i></p>"
                f"<h5>What they did</h5><p>{n.get('what', '')}</p>"
                f"<h5>Why — the gain and control</h5><p>{n.get('why', '')}</p>")
        if n.get("controls"):
            body += "<h5>Directly funded or controlled</h5><p>" + ", ".join(
                esc(label(by_id[c])) for c in n["controls"] if c in by_id) + "</p>"
        if n.get("sources"):
            body += "<h5>Primary sources</h5><ul>" + "".join(f"<li>{s}</li>" for s in n["sources"]) + "</ul>"
        if conns:
            body += "<h5>All connections</h5><p>" + ", ".join(conns) + "</p>"
        for i, (lat, lng, where) in enumerate(p[:3] for p in pts):
            k = key(mid, n["id"], i)
            features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [lng, lat]},
                             "properties": {"k": k, "c": EYES_COLOUR.get(n["type"], "#4A62B8"), "r": 6.5 if i == 0 else 5,
                                            "s": "#17150F", "w": 1, "o": 0.9, "n": label(n)[:140], "t": 1, "p": 1,
                                            "f": f"|show:places|type:{n['type']}|era:{ei}|"}})
            boxes[k] = {"h": body + f"<h5>This place</h5><p>{esc(where)}</p></div>",
                        "t": f"<b>{esc(label(n))}</b><br><span style='opacity:.75'>{esc(where)}</span>",
                        "o": {"maxWidth": 400, "maxHeight": 440}}
            n_type[n["type"]] = n_type.get(n["type"], 0) + 1
            n_era[ei] = n_era.get(ei, 0) + 1
            n_show["places"] = n_show.get("places", 0) + 1

    unlinked = 0
    for arr, kind, _, colour, width, says in EYES_LINKS:
        for e in d[arr]:
            a_, b_ = by_id.get(e["s"]), by_id.get(e["t"])
            pa, pb = geo.get(e["s"]) or [], geo.get(e["t"]) or []
            if not (a_ and b_ and pa and pb):
                unlinked += 1
                continue
            ea, eb = era_of(a_), era_of(b_)
            k = key(mid, "link", kind, e["s"], e["t"])
            line = great_circle([[pa[0][1], pa[0][0]], [pb[0][1], pb[0][0]]])
            features.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": line},
                             "properties": {"k": k, "c": colour, "w": width, "n": f"{label(a_)} → {label(b_)}",
                                            "t": 1, "p": 1, "f": f"|show:{kind}|type:{a_['type']}|type:{b_['type']}|era:{ea}|era:{eb}|"}})
            boxes[k] = {"h": f"<div class='rm'><h4>{esc(label(a_))} → {esc(label(b_))}</h4><p>{esc(says)}</p>"
                             f"<div class='meta'>{esc(label(a_))}: {esc(pa[0][2])}<br>{esc(label(b_))}: {esc(pb[0][2])}</div>"
                             f"<div class='cite'>Drawn between each entry's first place on the page's map. Click either end for its full entry.</div></div>",
                        "t": f"<b>{esc(label(a_))} → {esc(label(b_))}</b><br><span style='opacity:.75'>{esc(kind)}</span>",
                        "o": {"maxWidth": 360}}
            n_show[kind] = n_show.get(kind, 0) + 1
            for ei in {ea, eb}:
                n_era[ei] = n_era.get(ei, 0) + 1

    filters = [
        {"label": "Show", "values": [{"k": "show:places", "label": "Places", "n": n_show.get("places", 0)}] +
            [{"k": f"show:{kind}", "label": lab, "n": n_show.get(kind, 0)} for _, kind, lab, _, _, _ in EYES_LINKS]},
        {"label": "Period", "values": [{"k": f"era:{i}", "label": era_label(i), "n": n_era[i]} for i in range(len(eras)) if n_era.get(i)]},
        {"label": "Kind", "values": [{"k": f"type:{t}", "label": lab, "n": n_type[t]} for t, lab in EYES_TYPES if n_type.get(t)]},
    ]
    notes = []
    if unplaced:
        notes.append(f"{len(unplaced)} entries have no place on the page's map and are not drawn: {', '.join(unplaced)}")
    if unlinked:
        notes.append(f"{unlinked} links touch an entry with no place and are not drawn")
    return write(mid, page_title(page, m["name"]), m["url"], box_css(mid), features, filters, boxes, notes=notes)


# ------------------------------------------------------------------ the capture map

def capture_data(page):
    i = page.find("var DATA = ")
    if i < 0:
        raise RuntimeError("the page's data block (var DATA = ...) was not found")
    data, _ = json.JSONDecoder().raw_decode(page[i + len("var DATA = "):])
    return data


OUTCOME = {"convicted": "Convicted", "indicted": "Indicted", "settled": "Settled", "investigation": "Investigating",
           "alleged": "Alleged", "acquitted": "Acquitted", "designated": "Designated", "inquiry": "Inquiry"}
# The five severity bands, as written on the page ("Severe" 7.5 and over ...
# "Minimal" under 3), light to dark from minimal; the map spreads them from
# cyan to violet as it draws them.
BAND_STEPS = ["#DCD7CC", "#B8B0A2", "#948B7D", "#6F675B", "#4A443C"]


# Names in the page's World Bank style that no list here spells that way.
WB_NAMES = {"Congo, Dem. Rep.": "COD"}


def capture_iso(rows, alias):
    names = json.loads((ROOT / "pipeline" / "shapes" / "names_iso3.json").read_text())
    bounds = json.loads((ROOT / "map" / "data" / "boundaries.geojson").read_text())
    by_name = {f["properties"]["name"].lower(): f["properties"]["iso3"] for f in bounds["features"]}
    shapes = {f["properties"]["iso3"]: f["geometry"] for f in bounds["features"]}
    look = lambda s: names.get(s.lower()) or by_name.get(s.lower())
    iso, missing = {}, []
    for k in rows:
        tries = [k] + [a for a, v in alias.items() if v == k] + [re.sub(r"^St\. ", "Saint ", k)]
        hit = WB_NAMES.get(k) or next((look(t) for t in tries if look(t)), None)
        if hit and hit in shapes:
            iso[k] = hit
        else:
            missing.append(k)
    return iso, shapes, missing


def capture(m):
    mid = m["id"]
    page = fetch(m["url"])
    D = capture_data(page)
    gtypes = {t["k"]: t for t in D["gtypes"]}
    sectors = {s["k"]: s for s in D["sectors"]}
    buckets = {b[0]: b for b in D["casebuckets"]}
    notes_ = D["notes"]
    features, boxes = [], {}
    count = {}

    def add(geom, props, h, t, tags, o=None):
        k = props["k"]
        props["f"] = "|" + "|".join(tags) + "|"
        features.append({"type": "Feature", "geometry": geom, "properties": props})
        boxes[k] = {"h": f"<div class='rm'>{h}</div>", "t": t, "o": o or {"maxWidth": 420, "maxHeight": 440}}
        for tg in tags:
            count[tg] = count.get(tg, 0) + 1

    def cite(x):
        return (f"<div class='cite'>{x.get('cite', '')}" +
                (f" — <a href='{esc(x['url'])}' target='_blank' rel='noopener'>source</a>" if x.get("url") else "") + "</div>")

    def undone(x):
        return f"<p><b>Outcome undone:</b> {x['undone']}</p>" if x.get("undone") else ""

    for i, g in enumerate(D["groups"]):
        gt = gtypes.get(g.get("ty"), {})
        nt = notes_[g["note"]] if isinstance(g.get("note"), int) and 0 <= g["note"] < len(notes_) else None
        h = (f"<h4>{esc(g['n'])}</h4><div class='meta'>{esc(gt.get('label', 'Organised-crime group'))} · {esc(g.get('c', ''))}</div>")
        if nt:
            h += (f"<h5>{esc(nt.get('title', ''))}{(' · ' + esc(nt['where'])) if nt.get('where') else ''}</h5>"
                  f"<p>{nt.get('d', '')}</p><div class='cite'>{nt.get('cite', '')}</div>")
        if g.get("geo"):
            h += f"<p class='meta'><b>Placed at:</b> {esc(g['geo'])}" + (f" · country label corrected from {esc(g['c0'])}" if g.get("c0") else "") + "</p>"
        if gt.get("d"):
            h += f"<h5>{esc(gt.get('label', ''))}</h5><p class='meta'>{esc(gt['d'])}</p>"
        add({"type": "Point", "coordinates": [g["lng"], g["lat"]]},
            {"k": key(mid, "g", i, g["n"]), "c": gt.get("accent", "#B3182F"), "r": 5 if nt else 3.8, "s": "#0A0C16",
             "w": 1.4 if nt else 0.9, "o": 0.95, "n": g["n"][:140], "t": 1, "p": 1},
            h, f"{esc(g['n'])} — {esc(g.get('c', ''))}" + (f" · {esc(gt['label'])}" if gt.get("label") else ""),
            ["show:groups", f"gt:{g.get('ty', '')}"])

    for i, c in enumerate(D["cases"]):
        b = buckets.get(c.get("bk"), [c.get("bk"), c.get("bk") or "Public office", ""])
        h = (f"<h4>{esc(c['n'])}</h4><div class='meta'>{esc(OUTCOME.get(c.get('status'), c.get('status', '')))} · "
             f"{esc(c.get('rank', ''))} · {esc(c.get('y', ''))} · {esc(c.get('c', ''))}</div>"
             f"<p>{c.get('d', '')}</p>{undone(c)}{cite(c)}<h5>{esc(b[1])}</h5><p class='meta'>{esc(b[2])}</p>")
        add({"type": "Point", "coordinates": [c["lng"], c["lat"]]},
            {"k": key(mid, "c", i, c["n"]), "c": {"exec": "#C04A6A", "cabinet": "#A04AB8", "court": "#5A4AB8",
                                                  "elected": "#4A7AB8", "enforce": "#4AB0B8"}.get(c.get("bk"), "#8A4AB8"),
             "r": 6, "s": "#F2EEE6", "w": 1.2, "o": 0.95, "n": c["n"][:140], "t": 1, "p": 1},
            h, esc(c["n"]), ["show:cases", f"bk:{c.get('bk', '')}"])

    for i, e in enumerate(D["entities"]):
        s = sectors.get(e.get("s"), {})
        h = (f"<h4>{esc(e['n'])}</h4><div class='meta'>{esc(OUTCOME.get(e.get('status'), e.get('status', '')))} · {esc(e.get('y', ''))} · "
             f"{esc(e.get('c', ''))}</div><div class='meta'>{esc(e.get('role', ''))} · {esc(s.get('label', e.get('s', '')))}</div>"
             f"<p>{e.get('d', '')}</p>{undone(e)}{cite(e)}" + (f"<h5>{esc(s['label'])}</h5><p class='meta'>{esc(s['d'])}</p>" if s.get("d") else ""))
        add({"type": "Point", "coordinates": [e["lng"], e["lat"]]},
            {"k": key(mid, "e", i, e["n"]), "c": s.get("accent", "#8FB8C9"), "r": 5.5, "s": "#0A0C16", "w": 1, "o": 0.95,
             "n": e["n"][:140], "t": 1, "p": 1},
            h, f"{esc(e['n'])} — {esc(s.get('label', ''))}", ["show:firms", f"sec:{e.get('s', '')}"])

    for i, r in enumerate(D["routes"]):
        pts = [[p[1], p[0]] for p in r["p"]]
        if len(pts) < 2:
            continue
        note = r.get("note") or {}
        h = (f"<h4>{esc(r['n'])}</h4><div class='meta'>Trafficking corridor · {len(r['p'])} waypoints" +
             (f" · {r['trim']} endpoint{'s' if r['trim'] > 1 else ''} trimmed" if r.get("trim") else "") + "</div>" +
             (f"<p>{note.get('d', '')}</p><div class='cite'>{note.get('cite', '')}</div>" if note else "") +
             "<div class='cite'>The curve is the shortest path between the waypoints, not a straight line drawn on a flat map. "
             "It is not a surveyed track: it does not follow roads or shipping lanes.</div>")
        add({"type": "LineString", "coordinates": great_circle(pts, 150)},
            {"k": key(mid, "r", i, r["n"]), "c": "#B8B04A", "w": 1.8, "n": r["n"][:140], "t": 1, "p": 1},
            h, esc(r["n"]), ["show:routes"], {"maxWidth": 360, "maxHeight": 440})

    rows, cnotes = D["rows"], D.get("cnotes") or {}
    iso, shapes, missing = capture_iso(rows, D.get("alias") or {})
    by_c = {}
    for c in D["cases"]:
        by_c.setdefault(c.get("c"), []).append((c.get("y") or 0, f"{esc(c['n'])} <span class='meta'>({esc(OUTCOME.get(c.get('status'), c.get('status', '')))}, {esc(c.get('y', ''))})</span>"))
    for e in D["entities"]:
        by_c.setdefault(e.get("c"), []).append((e.get("y") or 0, f"{esc(e['n'])} <span class='meta'>({esc(OUTCOME.get(e.get('status'), e.get('status', '')))}, {esc(e.get('y', ''))})</span>"))
    band = lambda v: [b[0] for b in D["bands"]][0 if v >= 7.5 else 1 if v >= 6 else 2 if v >= 4.5 else 3 if v >= 3 else 4]
    for k, r in rows.items():
        if k not in iso:
            continue
        f2 = lambda x: f"{x:.2f}" if isinstance(x, (int, float)) else esc(x)
        h = (f"<h4>{esc(k)}</h4><div class='meta'>Capture exposure {f2(r['exp'])} · {esc(band(r['exp']))}</div><table>" +
             "".join(f"<tr><td>{lab}</td><td>{val}</td></tr>" for lab, val in [
                 ("State-embedded actors", f2(r["sea"])), ("Cocaine trade", f2(r["coc"])), ("Synthetic drug trade", f2(r["syn"])),
                 ("Heroin trade", f2(r["her"])), ("Cannabis trade", f2(r["can"])),
                 ("Drug intensity (peak / mean)", f"{f2(r['drug'])} / {f2(r['dmean'])}"), ("Criminality (overall)", f2(r["crim"])),
                 ("Resilience", f2(r["res"])), ("Exposure (mean-based)", f2(r["expm"]))]) + "</table>")
        cn = cnotes.get(k)
        if cn:
            h += f"<h5>The record</h5><p>{cn.get('d', '')}</p><div class='cite'>{cn.get('cite', '')}</div>"
        recs = sorted(by_c.get(k, []), key=lambda x: -x[0])
        h += ("<h5>Cases and companies (each is its own mark)</h5><ul>" + "".join(f"<li>{t}</li>" for _, t in recs) + "</ul>") if recs else \
             "<p class='meta'>No case in this layer. That is an absence of documentation, not an absence of capture.</p>"
        h += "<div class='cite'>Scores: GI-TOC Organized Crime Index 2025. Exposure is the page's composite, not a GI-TOC figure.</div>"
        props = {"k": key(mid, "country", k), "n": k, "t": 1, "p": 1}
        for lz in D["lenses"]:
            v = r.get(lz["k"])
            if isinstance(v, (int, float)):
                props[f"l_{lz['k']}"] = round(10 - v, 2) if lz["k"] == "res" else v
        add({"type": "MultiPolygon" if shapes[iso[k]]["type"] == "MultiPolygon" else "Polygon", "coordinates": shapes[iso[k]]["coordinates"]},
            props, h, f"{esc(k)} — capture exposure {f2(r['exp'])}", ["show:countries"])

    labels = [f"{b[0]} ({'7.5 and over' if i == 0 else '6 to 7.5' if i == 1 else '4.5 to 6' if i == 2 else '3 to 4.5' if i == 3 else 'under 3'})"
              for i, b in enumerate(D["bands"])]
    colourings = [{"k": f"l_{lz['k']}", "prop": f"l_{lz['k']}", "label": lz["label"] + (" (inverted: darker is weaker)" if lz["k"] == "res" else ""),
                   "note": lz.get("desc", ""), "breaks": [3, 4.5, 6, 7.5], "colours": BAND_STEPS, "labels": labels[::-1]}
                  for lz in D["lenses"]]
    filters = [
        {"label": "Show", "values": [{"k": k, "label": lab, "n": count.get(k, 0)} for k, lab in [
            ("show:groups", "Organised-crime groups"), ("show:cases", "Public-office cases"), ("show:firms", "Companies"),
            ("show:routes", "Trafficking corridors"), ("show:countries", "Countries, shaded")] if count.get(k)]},
        {"label": "Group type", "values": [{"k": f"gt:{t['k']}", "label": t["label"], "n": count.get(f"gt:{t['k']}", 0)}
                                           for t in D["gtypes"] if count.get(f"gt:{t['k']}")]},
        {"label": "Office", "values": [{"k": f"bk:{b[0]}", "label": b[1], "n": count.get(f"bk:{b[0]}", 0)}
                                       for b in D["casebuckets"] if count.get(f"bk:{b[0]}")]},
        {"label": "Company sector", "values": [{"k": f"sec:{s['k']}", "label": s["label"], "n": count.get(f"sec:{s['k']}", 0)}
                                               for s in D["sectors"] if count.get(f"sec:{s['k']}")]},
    ]
    notes = [f"{len(missing)} scored countries match no boundary and are not shaded: {', '.join(missing)}"] if missing else []
    return write(mid, m["name"], m["url"], box_css(mid), features, filters, boxes, colourings, notes)


BUILDERS = {"eyes": eyes, "capture": capture}


def build(m):
    return BUILDERS[m["rich"]](m)


if __name__ == "__main__":
    reg = json.loads((ROOT / "pipeline" / "sitemaps" / "registry.json").read_text())["maps"]
    want = set(sys.argv[1:])
    for m in reg:
        if m.get("rich") and (not want or m["id"] in want):
            build(m)
