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


def write(mid, name, page, css, features, filters, boxes, colourings=None, notes=(), entries=None, stylesheets=()):
    OUT.mkdir(parents=True, exist_ok=True)
    places = {"type": "FeatureCollection", "name": name, "overlays": [], "filters": filters, "features": features}
    if colourings:
        places["colourings"] = colourings
    (OUT / f"{mid}.places.geojson").write_text(json.dumps(places, separators=(",", ":"), ensure_ascii=False))
    bx = {"name": name, "page": page, "css": css, "stylesheets": list(stylesheets), "chain": [], "boxes": boxes}
    if entries:
        # Round 188o: what a map writes up beside its places (a list, a
        # ranking, its method), kept with the boxes, which the daily refresh
        # copies, and read when its button under the row is pressed.
        bx["entries"] = entries
    (OUT / f"{mid}.boxes.json").write_text(json.dumps(bx, separators=(",", ":"), ensure_ascii=False))
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
    unplaced, unplaced_entries = [], []
    for n in nodes:
        pts = geo.get(n["id"]) or []
        if not pts:
            unplaced.append(label(n))
            # Round 112b: written up whole beside the map (<id>.unplaced.json),
            # read from a button under the row.
            conns = []
            for other, kind in connected.get(n["id"], []):
                item = f"{esc(label(by_id[other]))} <span class='meta'>({kind})</span>"
                if item not in conns:
                    conns.append(item)
            body = (f"<div class='meta'>{esc(n.get('era', ''))}</div><p><i>{n.get('short', '')}</i></p>"
                    f"<h5>What they did</h5><p>{n.get('what', '')}</p><h5>Why — the gain and control</h5><p>{n.get('why', '')}</p>")
            if n.get("controls"):
                body += "<h5>Directly funded or controlled</h5><p>" + ", ".join(esc(label(by_id[c])) for c in n["controls"] if c in by_id) + "</p>"
            if n.get("sources"):
                body += "<h5>Primary sources</h5><ul>" + "".join(f"<li>{s}</li>" for s in n["sources"]) + "</ul>"
            if conns:
                body += "<h5>All connections</h5><p>" + ", ".join(conns) + "</p>"
            unplaced_entries.append({"id": n["id"], "title": label(n), "kind": EYES_TYPE_ONE.get(n["type"], n["type"]), "html": body})
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
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{mid}.unplaced.json").write_text(json.dumps({
        "title": f"{page_title(page, m['name'])}: entries with no place on its map",
        "note": "The interactive writes these entries up in full but gives them no place on its map, so they are not drawn; each is here whole, as the interactive gives it.",
        "entries": unplaced_entries}, separators=(",", ":"), ensure_ascii=False))
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


# ------------------------------------------------------------------ two maps read by running their code
#
# Round 188o (asked 8 October): the owner's Who Writes the Law atlas, new, and
# the revised Who corporatized holidays map. Both write their boxes in their
# own code when a place is clicked, so page_reader.mjs runs that code and
# returns what it writes; nothing here rewrites a box.

def read_page(mode, url):
    out = subprocess.run(["node", str(pathlib.Path(__file__).with_name("page_reader.mjs")), mode, url],
                         capture_output=True, text=True, timeout=900)
    if out.returncode != 0:
        raise RuntimeError(f"page_reader.mjs {mode}: {out.stderr.strip()[:300]}")
    return json.loads(out.stdout)


def colour_hex(c):
    """A CSS colour the page wrote (#rgb, #rrggbb, rgb(), hsl()) as #RRGGBB, so
    the map can draw it."""
    c = str(c or "").strip()
    m = re.fullmatch(r"#([0-9a-fA-F]{3})", c)
    if m:
        return "#" + "".join(ch * 2 for ch in m.group(1)).upper()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", c):
        return c.upper()
    m = re.fullmatch(r"hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%.*\)", c)
    if m:
        import colorsys
        r, g, b = colorsys.hls_to_rgb(float(m.group(1)) / 360, float(m.group(3)) / 100, float(m.group(2)) / 100)
        return "#%02X%02X%02X" % (round(r * 255), round(g * 255), round(b * 255))
    m = re.fullmatch(r"rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+).*\)", c)
    if m:
        return "#%02X%02X%02X" % tuple(int(x) for x in m.groups())
    return None


def page_css(mid, raw, drop):
    """The page's own stylesheet, limited to this map's boxes (build_boxes.scope_css),
    without the rules for the page around its map (its panels, its tiles)."""
    from build_boxes import scope_css
    raw = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
    kept, i, n = [], 0, len(raw)
    while i < n:
        b = raw.find("{", i)
        if b == -1:
            break
        depth, j = 1, b + 1
        while j < n and depth:
            depth += {"{": 1, "}": -1}.get(raw[j], 0)
            j += 1
        head = raw[i:b].strip()
        if not head.startswith("@") and all(re.search(d, sel.strip()) is None for sel in head.split(",") for d in drop):
            kept.append(raw[i:j])
        elif head.startswith("@media"):
            pass                                # the page's layout for small screens: not the boxes
        elif not head.startswith("@"):
            sels = [sel for sel in head.split(",") if all(re.search(d, sel.strip()) is None for d in drop)]
            if sels:
                kept.append(",".join(sels) + raw[b:j])
        i = j
    css, _ = scope_css("\n".join(kept), f".wtyg-map-{mid}")
    return css


def page_fonts(html_text):
    """The page's own web fonts (Google Fonts only), so its boxes read as on the page."""
    return [h for h in re.findall(r'<link[^>]+href="(https://fonts\.googleapis\.com/css2\?[^"]+)"', html_text)]


def strip_ids(h, keep=r"ref-\d+"):
    """Ids inside a box become data attributes, so nothing in a box can take an
    id the Culprits map uses; the citation anchors (ref-N) keep theirs."""
    return re.sub(r'\sid="(?!' + keep + r'")([^"]+)"', r' data-wtyg-id="\1"', h)


LAW_STEPS6 = ["#D6EEF6", "#8FD6E8", "#3FA9C2", "#2275A8", "#13447A", "#0C2E5E"]
LAW_STEPS5 = ["#C6E7F0", "#6FC2DA", "#2E8FBA", "#1A5C92", "#0C2E5E"]
LAW_ONE_STEPS = {2: ["#6FC2DA", "#1A5C92"], 3: ["#6FC2DA", "#2E8FBA", "#0C2E5E"]}
# The page's eleven areas of law, each its own colour here (the page's own
# include greens; the owner's map takes none: teal, cobalt, rose, plum, bone).
LAW_CATS = {"security": "#1E6FA8", "tax": "#7A1F3D", "fin": "#4F8BFF", "env": "#14A8A0", "health": "#8FD6E8",
            "polfin": "#E0304A", "contracts": "#9C6B5A", "labor": "#F28FB0", "data": "#C9B8A6", "econ": "#6A5A5E",
            "general": "#D6CFC2"}
# The page's own scales, in order from least to most (its SRAMP and RAMP).
LAW_SRAMP = ["#5D7671", "#8B9C92", "#BDBAA8", "#A78784", "#80525B", "#542838"]
LAW_RAMP = ["#CDC7BB", "#AE9893", "#8D676C", "#663E4A", "#432231"]
# The page's ALEC statuses (its ALEC_ST), and the colour each takes here.
LAW_ALEC = [("none", "No change recorded", "#A3586A", "#B83B5E"), ("left", "Left, stopped funding or closed", "#8FA59A", "#3FA9C2"),
            ("rejoined", "Left, then rejoined", "#B49AA6", "#F28FB0"), ("dispute", "Says it was never, or is no longer, a member", "#7D8FA3", "#8A8F98")]
LAW_PEOPLE = {"person": ("Named people", "#8FD6E8"), "firm": ("Named companies and groups", "#F4F1EA")}
# The page's kinds of evidence (its COL), as its findings' swatches show them.
LAW_KINDS = {"#5F7F8C": "#1E6FA8", "#7B5C4A": "#9C6B5A", "#6B6487": "#4F8BFF", "#9A6A95": "#F28FB0", "#7193AD": "#6FB7D9",
             "#9A5458": "#E0304A", "#5B8A84": "#8FD6E8", "#8F877B": "#6A5A5E", "#8A9870": "#C9B8A6"}
# The page's areas of law (its CATS), by the colour it gives each.
LAW_CAT_HEX = {"#5F7F8C": "security", "#8A6F9E": "tax", "#6F7FA8": "fin", "#6E8A6A": "env", "#5B8A84": "health", "#9A5458": "polfin",
               "#A07F72": "contracts", "#7C9BB0": "labor", "#9592AB": "data", "#8F877B": "econ", "#BDB5A9": "general"}


def law_recolour(h):
    """The colours the page writes into its boxes (score bars, swatches, ALEC
    and people dots, areas of law, kinds of evidence) as the same steps and
    kinds are drawn on this map, so a box and the map agree."""
    table = {}
    for i, c in enumerate(LAW_SRAMP):
        table[c] = LAW_STEPS6[i]
    for i, c in enumerate(LAW_RAMP):
        table[c] = LAW_STEPS5[i]
    for c, k in LAW_CAT_HEX.items():
        table[c] = LAW_CATS[k]
    for c, t in LAW_KINDS.items():
        table.setdefault(c, t)
    for a in LAW_ALEC:
        table[a[2]] = a[3]
    table["#9FB3A6"], table["#C9C1B0"] = LAW_PEOPLE["person"][1], LAW_PEOPLE["firm"][1]
    return re.sub(r"#[0-9a-fA-F]{6}\b", lambda m: table.get(m.group(0).upper(), m.group(0)), h)


def law_number(x):
    x = float(x)
    return str(int(round(x))) if abs(x - round(x)) < 1e-9 or abs(x) >= 10 else f"{x:.1f}"


# The page's fill for one colour drawn stronger with more evidence (its
# styleCountry): counts of cases .55 for one, .72 for two or more; one area's
# cases .5, .7 and .85 for one, two, three or more.
LAW_ONE_LEVELS = {0.55: ("One", "#6FC2DA"), 0.72: ("Two or more", "#1A5C92"),
                  0.5: ("One", "#6FC2DA"), 0.7: ("Two", "#2E8FBA"), 0.85: ("Three or more", "#0C2E5E")}


def law_steps(view_id, rows, ends, cats=None, by_rank=False):
    """Which step of its scale the page puts each country (or state) in for one
    view, read from the colour and fill the page's own code gives it, and the
    words for each step. Returns ({key: step}, scores, colours, labels)."""
    got = {r["_key"]: (r["v"].get(view_id), colour_hex(r["c"].get(view_id)), r["o"].get(view_id)) for r in rows if r["v"].get(view_id) is not None}
    if not got:
        return {}, [], [], []
    seen = {c for _, c, _ in got.values()}
    step, words = {}, []
    # End words are kept only where they say something the numbers do not
    # ("less captured", "Stronger laws"), not "1 measure" or "45% of income".
    ends = ends if ends and all(e for e in ends) and (by_rank or not any(re.search(r"\d", e) for e in ends)) else None
    if cats:                                   # the area of law with the most evidence
        order = [k for k in cats if any(v == k for v, _, _ in got.values())]
        for key, (v, _, _) in got.items():
            step[key] = order.index(v)
        return step, list(range(len(order))), [LAW_CATS[k] for k in order], [cats[k]["l"] for k in order]
    if seen <= set(LAW_SRAMP) or seen <= set(LAW_RAMP):
        scale = LAW_SRAMP if seen <= set(LAW_SRAMP) else LAW_RAMP
        here = LAW_STEPS6 if scale is LAW_SRAMP else LAW_STEPS5
        for key, (v, c, _) in got.items():
            step[key] = scale.index(c)
        idx = sorted(set(step.values()))
        for i in idx:
            if by_rank:                        # coloured by rank, not by the score shown: the page's own ramp words only
                words.append("")
                continue
            vals = [got[k][0] for k, s in step.items() if s == i]
            lo, hi = min(vals), max(vals)
            words.append(law_number(lo) if lo == hi else f"{law_number(lo)} to {law_number(hi)}")
        if ends and words:
            words[0] = (words[0] + f" ({ends[0]})").strip() if words[0] else ends[0]
            if len(words) > 1:
                words[-1] = (words[-1] + f" ({ends[1]})").strip() if words[-1] else ends[1]
        return step, idx, [here[i] for i in idx], words
    # One colour, drawn stronger with more evidence (the page's fill).
    levels = sorted({round(float(o), 2) for _, _, o in got.values() if o is not None})
    for key, (_, _, o) in got.items():
        step[key] = levels.index(round(float(o), 2))
    idx = list(range(len(levels)))
    words = [LAW_ONE_LEVELS.get(l, (str(l), None))[0] for l in levels]
    colours = [LAW_ONE_LEVELS.get(l, (None, LAW_STEPS6[i]))[1] or LAW_STEPS6[i] for i, l in enumerate(levels)]
    return step, idx, colours, words


def law_box(name, sub, body):
    body = body.replace('data-mlens="', 'data-wtyg-colour="m_').replace('data-sview="', 'data-wtyg-colour="s_')
    # The ALEC list's and the electoral bonds list's own filters, worked by the
    # Culprits map (they called the page's filterALEC and filterEB).
    body = re.sub(r'\s(?:onchange|oninput)="filterALEC\(\)"', "", body)
    body = re.sub(r'class="(atf|akd|aq)"', lambda m: f'class="{m.group(1)}" data-wtyg-filter="{ {"atf": "tf", "akd": "kd", "aq": "n"}[m.group(1)] }"', body)
    body = body.replace('class="acount"', 'class="acount" data-wtyg-count')
    body = body.replace('id="alecBox"', 'id="alecBox" data-wtyg-filterbox')
    body = body.replace(' oninput="filterEB(this)"', ' data-wtyg-filter="n"')
    return law_recolour(strip_ids(f'<div class="lw-dossier"><header><h2>{esc(name)}</h2><div class="sub">{esc(sub)}</div></header><div class="dbody">{body}</div></div>'))


LAW_DROP = [r"^(html|body|#map|#mast|#legend|#crumbs|#tools|#rank|#rlist|#dossier|#dbody|\.overlay|\.sheet|\.basesw|\.tbtn|\.lens|\.lenses|\.why|\.weights|\.wrow|\.areabox|\.fold|\.mhead|\.subhead|\.gbody)\b",
            r"^\.leaflet-(tile|control|bottom|bar)", r"^#", r"^\.leaflet-container\s"]


def law(m):
    mid, D = m["id"], read_page("law", m["url"])
    OUT.mkdir(parents=True, exist_ok=True)
    for n in D.get("notes", []):
        print(f"  {mid}: note: {n}")
    cats = D["cats"]
    # Every view the page offers, in its order: its lenses, which laws are
    # affected (by documented cases and by sector indices), each of the
    # measures behind the score, and the US states' views.
    views = [(l["id"], l["name"], l["ds"], "c", l) for l in D["lenses"]]
    views += [(a["id"], "Which laws: " + a["name"], a["ds"], "c", a) for a in D["areas"]]
    views += [("m_" + c["k"], "Measure: " + c["name"], c["ds"], "c", c) for c in D["measures"]]
    views += [("s_" + s["k"], "US states: " + s["name"], f'{s["name"]} ({s["src"]})', "s", s) for s in D["svViews"]]
    countries = [dict(r, _key="c:" + r["iso"]) for r in D["countries"]]
    states = [dict(r, _key="s:" + r["code"]) for r in D["states"]]
    ends_for = {"score": ("less captured", "more captured")}
    colourings, step_of = [], {}
    for vid, label, note, scope, spec in views:
        rows = countries if scope == "c" else states
        if vid.startswith("m_") or vid.startswith("area_idx_") and not vid.endswith("_all"):
            ends = ("least captured", "most captured")
        elif scope == "s":
            ends = (spec.get("lo"), spec.get("hi")) if spec.get("lo") else None
        else:
            ends = ends_for.get(spec.get("kind")) or ((spec.get("lo"), spec.get("hi")) if spec.get("lo") else None)
        is_cats = vid.endswith("_all") and vid.startswith("area_")
        if scope == "s" and spec.get("cat"):
            ends = None                         # the page lists these as steps, not as a ramp
        step, scores, colours, labels = law_steps(vid, rows, ends, cats if is_cats else None, by_rank=vid.startswith("s_sii"))
        if not step:
            continue
        step_of[vid] = step
        c = {"k": vid, "prop": "l_" + vid, "label": label, "note": note, "scores": scores, "colours": colours, "labels": labels}
        if vid == "overall":
            c["opacityProp"] = "o_overall"       # the page's own fading: less data, fainter
        colourings.append(c)
    css = page_css(mid, D["css"], LAW_DROP) + (
        f":where(.wtyg-map-{mid}) .lw-dossier{{font-family:var(--serif);color:var(--bone);max-height:520px;overflow:auto}}"
        f":where(.wtyg-map-{mid}) .lw-dossier header{{padding:6px 2px 10px;border-bottom:1px solid var(--line)}}"
        f":where(.wtyg-map-{mid}) .lw-dossier h2{{font-weight:500;font-size:28px;line-height:1.05;margin:0 0 6px;letter-spacing:-.02em}}"
        f":where(.wtyg-map-{mid}) .lw-dossier .sub{{font-family:var(--cond);font-size:13px;color:var(--ash)}}"
        f":where(.wtyg-map-{mid}) .lw-dossier .dbody{{padding:0 2px 6px}}"
        f":where(.wtyg-map-{mid}) .lw-entry{{font-family:var(--serif);color:var(--bone)}}"
        f":where(.wtyg-map-{mid}) .lw-entry ol.lw-rank{{list-style:none;margin:0;padding:0;font-family:var(--cond)}}"
        f":where(.wtyg-map-{mid}) .lw-entry ol.lw-rank button{{display:grid;grid-template-columns:34px 1fr 40px;gap:4px 8px;align-items:center;width:100%;background:none;border:0;padding:5px 0;text-align:left}}")
    features, boxes, count = [], {}, {}
    usa = next((r for r in countries if r["iso"] == "USA"), None)
    wbox = {"maxWidth": 470, "minWidth": 300, "className": "ppop"}
    def colour_props(r):
        p = {}
        for vid, step in step_of.items():
            if r["_key"] in step:
                p["l_" + vid] = step[r["_key"]]
        return p
    for r in countries:
        k = key(mid, "country", r["iso"])
        p = {"k": k, "n": r["name"], "t": 1, "p": 1, "f": "|show:countries|"}
        p.update(colour_props(r))
        if r.get("o", {}).get("overall") is not None:
            p["o_overall"] = round(float(r["o"]["overall"]), 3)
        if r["iso"] == "USA":
            p["fo"] = 0                           # drawn by its states, which carry its colour
        features.append({"type": "Feature", "geometry": r["geometry"], "properties": p})
        b = r.get("box") or {}
        boxes[k] = {"h": law_box(b.get("name") or r["name"], b.get("sub", ""), b.get("body", "")), "o": wbox,
                    "t": f"<b>{esc(r['name'])}</b><br>" + (esc(r["t"]["overall"]) + (f", rank {r['rank']} of {D['scored']}" if r.get("rank") else "") if r["t"].get("overall") else "No overall score: no measure covers it"),
                    "to": {"className": "tt"}}
        count["show:countries"] = count.get("show:countries", 0) + 1
    usa_props = colour_props(usa) if usa else {}
    if usa and usa.get("o", {}).get("overall") is not None:
        usa_props["o_overall"] = round(float(usa["o"]["overall"]), 3)
    for r in states:
        k = key(mid, "state", r["code"])
        p = {"k": k, "n": r["name"], "t": 1, "p": 1, "f": "|show:states|"}
        p.update(usa_props)                       # under a world view, the United States' own colour
        p.update(colour_props(r))
        features.append({"type": "Feature", "geometry": r["geometry"], "properties": p})
        b = r.get("box") or {}
        first = next((r["t"][v] for v in r["t"]), "")
        boxes[k] = {"h": law_box(b.get("name") or r["name"], b.get("sub", ""), b.get("body", "")), "o": wbox,
                    "t": f"<b>{esc(r['name'])}</b>" + (f"<br>{esc(first)}" if first else ""), "to": {"className": "tt"}}
        count["show:states"] = count.get("show:states", 0) + 1
    alec_by_fill = {a[2]: a for a in LAW_ALEC}
    for i, mk in enumerate(D["marks"]):
        fill = colour_hex(mk.get("fill"))
        if mk.get("k"):                           # a named person or company (the page's people layer)
            kind = "person" if mk["k"] == "person" else "firm"
            c, f = LAW_PEOPLE[kind][1], f"|show:{kind}|"
            count[f"show:{kind}"] = count.get(f"show:{kind}", 0) + 1
        elif fill in alec_by_fill:                # a company listed as involved with ALEC
            st = alec_by_fill[fill]
            c, f = st[3], f"|show:alec|al:{st[0]}|"
            count["show:alec"] = count.get("show:alec", 0) + 1
            count[f"al:{st[0]}"] = count.get(f"al:{st[0]}", 0) + 1
        else:
            print(f"  {mid}: note: a mark with fill {mk.get('fill')} is of no kind the page names; drawn plain")
            c, f = fill or "#8A8F98", "|show:other|"
        name = re.sub(r"<[^>]+>", "", html.unescape(mk.get("tooltip") or "")).strip()
        k = key(mid, "mark", i, mk["ll"][0], mk["ll"][1], name)
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [mk["ll"][1], mk["ll"][0]]},
                         "properties": {"k": k, "n": name, "c": c, "r": mk.get("radius") or 4, "s": "#1C2023", "w": 1, "o": 0.92, "t": 1, "p": 1, "f": f}})
        boxes[k] = {"h": law_recolour(strip_ids(mk.get("popup") or "")), "o": mk.get("popupOpts") or {"maxWidth": 330, "className": "ppop"},
                    "t": mk.get("tooltip") or esc(name), "to": {"className": "tt"}}
    filters = [
        {"label": "Show", "values": [{"k": k, "label": lab, "n": count.get(k, 0)} for k, lab in [
            ("show:countries", "Countries, shaded"), ("show:states", "US states, shaded"), ("show:person", LAW_PEOPLE["person"][0]),
            ("show:firm", LAW_PEOPLE["firm"][0]), ("show:alec", "Companies listed as involved with ALEC")] if count.get(k)]},
        {"label": "ALEC", "values": [{"k": f"al:{a[0]}", "label": a[1], "n": count.get(f"al:{a[0]}", 0)} for a in LAW_ALEC if count.get(f"al:{a[0]}")]},
    ]
    entries = [
        {"title": "Cross-border studies", "kind": f"{D.get('globalCount', 0)} findings that cover many countries at once",
         "html": law_recolour(f'<div class="lw-entry">{strip_ids(D["findings"])}</div>')},
        {"title": "Ranking", "kind": f"{D['scored']} countries by overall capture score, most captured first",
         "html": law_recolour(f'<div class="lw-entry"><ol class="lw-rank">{strip_ids(D["ranking"])}</ol></div>')},
        {"title": "Compare countries", "kind": "every country's score, rank and each measure",
         "html": law_recolour(f'<div class="lw-entry"><div class="tablewrap"><table class="cmp">{strip_ids(D["compare"])}</table></div></div>')},
        {"title": "How it's ranked", "kind": "the atlas's method", "html": f'<div class="lw-entry">{strip_ids(D["method"])}</div>'},
    ]
    write(mid, m["name"], m["url"], css, features, filters, boxes, colourings,
          [f"{len(colourings)} views to colour by", "the boxes are the atlas's own, written by its renderCountry and renderState"],
          entries={"title": D.get("title") or m["name"], "entries": entries}, stylesheets=D.get("fonts") or [])
    return m["name"]


HOL_DROP = [r"^(html|body|#map|#wrap|#panel|#head|#desc|#hint|#key|#body|#list|#foot|#back|h1)\b", r"^#", r"^\.leaflet-(tile|control|bottom|bar)", r"^\.leaflet-container\b"]


def holidays(m):
    mid, D = m["id"], read_page("holidays", m["url"])
    OUT.mkdir(parents=True, exist_ok=True)
    for n in D.get("notes", []):
        print(f"  {mid}: note: {n}")
    css = page_css(mid, D["css"], HOL_DROP) + (
        f":where(.wtyg-map-{mid}) .hol-pop .leaflet-popup-content-wrapper,:where(.wtyg-map-{mid}) .hol-pop .leaflet-popup-tip{{background:var(--panel);color:var(--bone);border:1px solid var(--line)}}"
        f":where(.wtyg-map-{mid}) .hol-story{{font-family:Figtree,system-ui,-apple-system,\"Segoe UI\",sans-serif;font-size:15px;line-height:1.45;color:var(--bone)}}"
        f":where(.wtyg-map-{mid}) .hol-story .s-hol{{margin-top:2px}}")
    features, boxes, entries = [], {}, []
    for i, e in enumerate(D["entries"]):
        p = e["p"]
        story = re.sub(r'<button id="back"[^>]*>.*?</button>', "", e["story"], flags=re.S).strip()
        box = f'<div class="hol-story">{strip_ids(story)}</div>'
        k = key(mid, i, p.get("name"), p.get("holiday"))
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [e["ll"][1], e["ll"][0]]},
                         "properties": {"k": k, "n": p.get("name"), "c": colour_hex(e["colour"]), "r": 6.5, "s": "#081018", "w": 1.5, "o": 0.95,
                                        "t": 1, "p": 1, "f": "|"}})
        tip = next((mk["tooltip"] for mk in D["marks"] if mk["ll"] == e["ll"]), None) or esc(f'{p.get("holiday")}: {p.get("name")}')
        boxes[k] = {"h": box, "o": {"maxWidth": 400, "minWidth": 280, "maxHeight": 520, "className": "hol-pop"}, "t": tip, "to": {"className": "tip"}}
        entries.append({"title": f'{p.get("_year", "")} · {p.get("holiday", "")}', "kind": p.get("name", ""), "html": f'<div class="hol-story">{strip_ids(story)}</div>'})
    write(mid, m["name"], m["url"], css, features, [], boxes, None, [f"{len(entries)} entries, {D['y0']} to {D['y1']}"],
          entries={"title": "Who corporatized holidays, by year",
                   "note": " ".join(html.unescape(re.sub(r"<[^>]+>", "", D.get(x) or "")).strip() for x in ("desc", "hint", "foot") if D.get(x)),
                   "entries": entries}, stylesheets=D.get("fonts") or [])
    return m["name"]


BUILDERS = {"eyes": eyes, "capture": capture, "law": law, "holidays": holidays}


def build(m):
    return BUILDERS[m["rich"]](m)


if __name__ == "__main__":
    reg = json.loads((ROOT / "pipeline" / "sitemaps" / "registry.json").read_text())["maps"]
    want = set(sys.argv[1:])
    for m in reg:
        if m.get("rich") and (not want or m["id"] in want):
            build(m)
