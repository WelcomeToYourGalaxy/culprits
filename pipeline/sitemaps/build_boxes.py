#!/usr/bin/env python3
"""
Build each of the site's own maps as its own map in Culprits.

For every map in pipeline/sitemaps/registry.json this runs the map's own
scripts (extract.mjs) and writes two files into map/data/sitemaps/:

  <id>.places.geojson   every place the map draws, with the marker's own size
                        and colour (softened: no orange, yellow or neon), and
                        the overlay it belongs to if the map names overlays.
                        Small; loaded when the map is ticked.
  <id>.boxes.json       what a click opens: each place's popup exactly as its
                        map wrote it, the options it opens with, the map's
                        stylesheets (scoped so they style only its own boxes),
                        and the elements the map sits inside, so rules such as
                        ".animal-fight-map .leaflet-popup-content" still apply.
                        Loaded on the first click, not with the places.

It also sets each map's name in map/app.js to the name the map gives itself.

Run from the repo root, inside the venv:
  python3 pipeline/sitemaps/build_boxes.py                  every map
  python3 pipeline/sitemaps/build_boxes.py site_circus      only some (comma list)

Maps that live only inside a Weebly page are read from the saved site record.
Set WTYG_SITE_RECORD to the unzipped folder; if it is not set, the folder is
looked for under ~/Downloads and ~/Desktop (one holding suppression.html).
"""

import colorsys
import hashlib
import html
import json
import os
import pathlib
import re
import sys
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline" / "sources"))
OUT = ROOT / "map" / "data" / "sitemaps"
APP = ROOT / "map" / "app.js"

# Carbon majors is its own top-level layer with a weekly refresh, not one of
# the site-map rows, so it is left as it is. The environmental law map is not a
# simple popup map (drill-downs, charts, a script that stops under node) and is
# handled with the maps in step 4 of the work order.
SKIP = {"carbon_majors", "site_environment_law"}


def find_site_record():
    if os.environ.get("WTYG_SITE_RECORD"):
        return
    home = pathlib.Path.home()
    for base in (home / "Downloads", home / "Desktop"):
        if not base.is_dir():
            continue
        for depth in ("*", "*/*", "*/*/*"):
            for hit in base.glob(f"{depth}/suppression.html"):
                os.environ["WTYG_SITE_RECORD"] = str(hit.parent)
                print(f"reading Weebly pages from {hit.parent}")
                return


# ------------------------------------------------------------------ colours

NAMED = {"white": "#FFFFFF", "black": "#000000", "red": "#FF0000", "green": "#008000", "blue": "#0000FF",
         "gray": "#808080", "grey": "#808080", "purple": "#800080", "brown": "#A52A2A", "orange": "#FFA500",
         "gold": "#FFD700", "yellow": "#FFFF00", "crimson": "#DC143C", "darkred": "#8B0000", "navy": "#000080",
         "teal": "#008080", "maroon": "#800000", "olive": "#808000", "silver": "#C0C0C0"}


def hex_of(c):
    """#rgb, #rrggbb, rgb()/rgba() or a common name, as #RRGGBB; None otherwise."""
    c = str(c or "").strip().lower()
    if c in NAMED:
        return NAMED[c]
    m = re.fullmatch(r"#([0-9a-f]{3})", c)
    if m:
        return "#" + "".join(ch * 2 for ch in m.group(1)).upper()
    m = re.fullmatch(r"#([0-9a-f]{6})([0-9a-f]{2})?", c)
    if m:
        return "#" + m.group(1).upper()
    m = re.fullmatch(r"rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+).*\)", c)
    if m:
        return "#%02X%02X%02X" % tuple(min(255, int(x)) for x in m.groups())
    return None


def soften(colour):
    """Same rule as pipeline/shapes/build_shapes.py: muted, and yellow-orange
    hues moved to red-brown."""
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", str(colour or "").strip())
    if not m:
        return None
    r, g, b = (int(m.group(1)[i:i + 2], 16) / 255 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    deg = h * 360
    if 25 <= deg < 70:
        deg = 350 + (deg - 25) * (10 / 45)
    s = min(s, 0.32)
    l = min(max(l, 0.30), 0.62)
    r, g, b = colorsys.hls_to_rgb((deg % 360) / 360, l, s)
    return "#%02X%02X%02X" % tuple(round(c * 255) for c in (r, g, b))


def stroke_of(c):
    h = hex_of(c)
    if not h:
        return None
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    if max(r, g, b) - min(r, g, b) < 24:        # white, grey, black: kept as drawn
        return h
    return soften(h)


BG = re.compile(r"background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)")


def class_colour(css, classes):
    """The background a stylesheet gives one of the icon's classes, if any."""
    for cls in reversed(classes):
        for m in re.finditer(r"\." + re.escape(cls) + r"(?![\w-])[^{]*\{([^}]*)\}", css):
            b = BG.search(m.group(1))
            if b and hex_of(b.group(1)):
                return hex_of(b.group(1))
    return None


def marker_look(f, css, fallback):
    st = f.get("style") or {}
    icon = st.get("icon") or {}
    fill = hex_of(st.get("fillColor")) or hex_of(st.get("color"))
    if not fill and icon.get("html"):
        for b in BG.finditer(icon["html"]):
            if hex_of(b.group(1)):
                fill = hex_of(b.group(1))
                break
    if not fill and icon.get("className"):
        fill = class_colour(css, str(icon["className"]).split())
    radius = None
    if isinstance(st.get("radius"), (int, float)) and not st.get("metres"):
        radius = st["radius"]
    elif isinstance(icon.get("iconSize"), list) and icon["iconSize"] and isinstance(icon["iconSize"][0], (int, float)):
        radius = icon["iconSize"][0] / 2
    elif icon.get("html"):
        w = re.search(r"width\s*:\s*(\d+(?:\.\d+)?)px", icon["html"])
        if w:
            radius = float(w.group(1)) / 2
    radius = max(3.0, min(float(radius or 6), 12.0))
    out = {"c": soften(fill) or fallback, "r": round(radius, 1)}
    if st.get("color") and st.get("fillColor"):
        out["s"] = stroke_of(st["color"])
    if isinstance(st.get("weight"), (int, float)):
        out["w"] = st["weight"]
    if isinstance(st.get("fillOpacity"), (int, float)):
        out["o"] = st["fillOpacity"]
    if st.get("dashArray"):
        out["d"] = str(st["dashArray"])
    return out


# ------------------------------------------------------------------ geometry

def lnglat(v):
    """Leaflet coordinates, at any nesting, as GeoJSON [lng, lat]."""
    if isinstance(v, dict) and "lat" in v:
        return [v.get("lng", v.get("lon")), v["lat"]]
    if isinstance(v, list) and len(v) >= 2 and all(isinstance(x, (int, float)) for x in v[:2]):
        return [v[1], v[0]]
    if isinstance(v, list):
        return [lnglat(x) for x in v]
    return None


def geometry_of(f):
    if f["kind"] == "point":
        return {"type": "Point", "coordinates": [f["lon"], f["lat"]]}
    g = f.get("geometry") or {}
    if not g.get("_leaflet"):
        return g if g.get("type") and g.get("coordinates") is not None else None
    c = lnglat(g["coordinates"])
    if g["type"] == "LineString":
        depth = 0
        x = c
        while isinstance(x, list) and x and isinstance(x[0], list):
            depth, x = depth + 1, x[0]
        # A line of one point draws nothing in Leaflet either; it is counted, not drawn.
        if depth == 1:
            return {"type": "LineString", "coordinates": c} if len(c) >= 2 else None
        parts = [part for part in c if len(part) >= 2]
        return {"type": "MultiLineString", "coordinates": parts} if parts else None
    if g["type"] == "Rectangle":
        (w, s), (e, n) = c[0], c[1]
        return {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}
    if g["type"] == "Polygon":
        depth = 0
        x = c
        while isinstance(x, list) and x and isinstance(x[0], list):
            depth, x = depth + 1, x[0]
        if depth == 1:
            c = [c]
            depth = 2
        rings = c if depth == 2 else None
        if rings is not None:
            rings = [r + [r[0]] if r and r[0] != r[-1] else r for r in rings]
            return {"type": "Polygon", "coordinates": rings}
        return {"type": "MultiPolygon", "coordinates": [[r + [r[0]] if r and r[0] != r[-1] else r for r in p] for p in c]}
    return None


# ------------------------------------------------------------------ the map's own stylesheets, scoped

def split_top(s, sep=","):
    parts, depth, cur, quote = [], 0, "", None
    for ch in s:
        if quote:
            cur += ch
            if ch == quote:
                quote = None
            continue
        if ch in "\"'":
            quote = ch
        elif ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == sep and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return parts


ROOTISH = re.compile(r"^(?:html(?![\w-])\s*(?:>\s*)?body(?![\w-])|html(?![\w-])|:root(?![\w-])|body(?![\w-]))")


def scope_selector(sel, scope):
    """Limit a rule to one map's boxes without changing how strongly it applies.

    The scope is wrapped in :where(), which adds no weight, so each rule keeps
    the weight it has on the map's own page. That matters: a page's
    "* { margin: 0 }" loses to Leaflet's own ".leaflet-popup-content" margin
    there, and must lose here too.

    Ids become data attributes (so nothing can take an id the atlas uses), held
    inside :is() beside an id nobody has, which keeps an id's weight."""
    sel = sel.strip()
    if not sel:
        return sel
    sel = re.sub(r"#(-?[A-Za-z_][\w-]*)",
                 lambda m: f':is([data-wtyg-id="{m.group(1)}"],#wtyg-noid-{m.group(1)})', sel)
    where = f":where({scope})"
    m = ROOTISH.match(sel)
    if m:
        return where + sel[m.end():]
    return f"{where} {sel}"


def scope_css(css, scope):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out, imports, i, n = [], [], 0, len(css)
    while i < n:
        while i < n and css[i] in " \t\r\n;":
            i += 1
        if i >= n:
            break
        brace, semi = css.find("{", i), css.find(";", i)
        if css.startswith("@", i) and semi != -1 and (brace == -1 or semi < brace):
            rule = css[i:semi].strip()
            if rule.lower().startswith("@import"):
                u = re.search(r"url\(\s*['\"]?([^'\")]+)|['\"]([^'\"]+)['\"]", rule)
                if u:
                    imports.append(u.group(1) or u.group(2))
            i = semi + 1
            continue
        if brace == -1:
            break
        depth, j = 1, brace + 1
        while j < n and depth:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
            j += 1
        head, body = css[i:brace].strip(), css[brace + 1:j - 1]
        low = head.lower()
        if low.startswith(("@media", "@supports", "@container", "@layer")):
            inner, more = scope_css(body, scope)
            imports += more
            out.append(f"{head}{{{inner}}}")
        elif low.startswith("@"):
            out.append(f"{head}{{{body}}}")           # @font-face, @keyframes, @page: as written
        else:
            sels = ",".join(scope_selector(s, scope) for s in split_top(head))
            out.append(f"{sels}{{{body.strip()}}}")
        i = j
    return "\n".join(out), imports


# ------------------------------------------------------------------ the page around the map

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Chain(HTMLParser):
    """The elements the map sits inside, outermost first, ending with the map's
    own element; and the page's headings, for its name."""

    def __init__(self, target):
        super().__init__(convert_charrefs=True)
        self.target = target or ""
        self.stack, self.chain = [], None
        self.headings = {1: None, 2: None, 3: None}
        self.class_title = None
        self.titles = []
        self._open = None          # ("h", level, text) or ("c", None, text) while inside one
        self._title = False

    def matches(self, attrs):
        t = self.target
        if t.startswith("."):
            return t[1:] in (attrs.get("class") or "").split()
        return attrs.get("id") == t.lstrip("#")

    def handle_starttag(self, tag, attrs_list):
        attrs = dict(attrs_list)
        el = {"tag": tag, "id": attrs.get("id"), "class": attrs.get("class")}
        if self.chain is None and self.target and self.matches(attrs):
            self.chain = [e for e in self.stack if e["tag"] not in ("html", "body", "head")] + [el]
        if tag == "title":
            self._title = True
        if self._open is None:
            if re.fullmatch(r"h[1-3]", tag) and self.headings[int(tag[1])] is None:
                self._open = [tag, int(tag[1]), ""]
            elif self.class_title is None and re.search(r"(?:^|[\s_-])title(?:$|\s)", attrs.get("class") or ""):
                self._open = [tag, None, ""]
        elif self._open[1] is None and self._open[2].strip():
            self._close_open()     # a class title keeps only its own first words
        if tag not in VOID:
            self.stack.append(el)

    def _close_open(self):
        tag, level, text = self._open
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            if level:
                self.headings[level] = text
            else:
                self.class_title = text
        self._open = None

    def handle_endtag(self, tag):
        if tag == "title":
            self._title = False
        if self._open and self._open[0] == tag:
            self._close_open()
        for k in range(len(self.stack) - 1, -1, -1):
            if self.stack[k]["tag"] == tag:
                del self.stack[k:]
                break

    def handle_data(self, data):
        if self._open:
            self._open[2] += data
        if self._title:
            self.titles.append(data.strip())


GENERIC = re.compile(r"^(embedded content|document|untitled|map)$", re.I)


def page_facts(page, container, headings, registry_name):
    p = Chain(container)
    try:
        p.feed(page or "")
    except Exception:
        pass
    chain = p.chain or ([{"tag": "div", "id": container.lstrip("#"), "class": None}] if container and not container.startswith(".")
                        else [{"tag": "div", "id": None, "class": (container or "").lstrip(".") or None}])
    name = None
    for level in (1, 2, 3):
        name = p.headings[level] or next((h["text"] for h in headings or [] if h["level"] == level and h["text"]), None)
        if name:
            break
    title = " ".join(t for t in p.titles if t).strip()
    name = name or p.class_title or (title if title and not GENERIC.match(title) else None) or registry_name
    return chain, html.unescape(name)


# ------------------------------------------------------------------ the map's own filters

# What the map calls each kind of control. The values and their words come from
# the map itself; only this heading is chosen here, because the markup does not
# carry one.
GROUP_LABELS = {"data-cat": "Category", "data-category": "Category", "data-type": "Type",
                "data-kind": "Kind", "data-group": "Group", "data-filter": "Filter",
                "data-sport": "Sport", "data-layer": "Layer"}
CATCH_ALL = re.compile(r"^(all|any|everything|show all|all shows|all sports|all sites|all types)$", re.I)


def haystack(f):
    st = f.get("style") or {}
    icon = st.get("icon") or {}
    parts = [f.get("popup") or "", f.get("tooltip_html") or "", json.dumps(f.get("props") or {}),
             str(icon.get("className") or ""), str(icon.get("html") or "")]
    return " ".join(parts).lower()


def matches(value, hay):
    v = re.escape(str(value).lower())
    return re.search(r"(?<![a-z0-9])" + v + r"(?![a-z0-9])", hay) is not None


def map_filters(data, features, idents):
    """Each control group the map writes, kept only if its values actually sort
    this map's places: at least two values that match something, and at least
    half the places matched. Nothing is invented and nothing is renamed."""
    controls = data.get("controls") or []
    groups = {}
    for c in controls:
        groups.setdefault(c["group"], []).append(c)
    hays = [haystack(f) for f in features]
    out, marks = [], [set() for _ in features]
    for group, items in groups.items():
        vals = [c for c in items if not CATCH_ALL.match(c["value"]) and not CATCH_ALL.match(c["label"])]
        if len(vals) < 2:
            continue
        hits = {c["value"]: [i for i, h in enumerate(hays) if matches(c["value"], h)] for c in vals}
        # A value that catches nearly everything is a heading, not a category.
        hits = {k: v for k, v in hits.items() if len(v) <= 0.85 * len(features)}
        used = {k: v for k, v in hits.items() if v}
        covered = len({i for v in used.values() for i in v})
        if len(used) < 2 or covered < 0.5 * max(1, len(features)):
            continue
        values = []
        for c in vals:
            rows = used.get(c["value"])
            if not rows:
                continue
            values.append({"k": c["value"], "label": c["label"], "n": len(rows)})
            for i in rows:
                marks[i].add(c["value"])
        out.append({"label": GROUP_LABELS.get(group, "Type"), "values": values})
    return out, marks


TAG = re.compile(r'<span[^>]*class="[^"]*\btag\b[^"]*"[^>]*>(.*?)</span>', re.I | re.S)


def popup_types(features):
    """The type each place's own popup gives it, where the page has no control that sorts its places.

    Several of the site's maps (plants, microorganisms, the insentient) say what
    kind of company a point is only inside its popup, as <span class="tag">. That
    is the map's own word for the point, so it is read as it stands - nothing is
    inferred from the company's name. Used only if nearly every place carries
    one and they fall into at least two types; otherwise no filter is made.
    """
    found = []
    for f in features:
        m = TAG.search(f.get("popup") or "")
        text = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else ""
        found.append(re.sub(r"\s+", " ", text).replace("|", "/"))
    have = [t for t in found if t]
    kinds = sorted(set(have))
    if len(kinds) < 2 or len(have) < 0.9 * max(1, len(features)) or len(kinds) > 0.5 * len(have):
        return None, [set() for _ in features]
    values = [{"k": k, "label": k, "n": have.count(k)} for k in kinds]
    # "rows": the map's layers box gives each type a row of its own.
    return {"label": "Type", "from": "popup tag", "rows": True, "values": values}, [({t} if t else set()) for t in found]


# ------------------------------------------------------------------ one map

def build(m):
    # Maps whose data lives outside their markers are read from the page's own
    # data by rich_maps.py (25 September, round 48).
    if m.get("rich"):
        import rich_maps
        return rich_maps.build(m)
    import _sitemap
    data = _sitemap.extract(m)
    for note in data.get("notes", []):
        print(f"  {m['id']}: note: {note}")
    scope = f".wtyg-map-{m['id']}"
    raw_css = "\n".join(data.get("css") or [])
    css, imports = scope_css(raw_css, scope)
    sheets = []
    for h in (data.get("stylesheets") or []) + imports:
        if h and h not in sheets and h.startswith("http"):
            sheets.append(h)
    chain, name = page_facts(data.get("page"), data.get("map_container"), data.get("headings"), m["name"])

    filters, marks = map_filters(data, data["features"], None)
    # Only for the maps the registry names ("types_from_popup_tag"): the plants,
    # microorganisms and insentient maps, and since 23 September, at the owner's
    # word, world news, advertising, entertainment, research integrity,
    # indigenous conflicts and self-sufficiency. A popup with several tags is
    # typed by its first, the map's own leading word for the place.
    if not filters and m.get("types_from_popup_tag"):
        by_tag, tag_marks = popup_types(data["features"])
        if by_tag:
            filters, marks = [by_tag], tag_marks
    overlays = data.get("overlays") or []
    order = {}
    for k, o in enumerate(overlays):
        order.setdefault(o["group"], k)
    places, boxes, seen = [], {}, set()
    row = -1
    drawn = {"point": 0, "line": 0, "polygon": 0}
    skipped = 0
    for f in data["features"]:
        row += 1
        geom = geometry_of(f)
        if not geom:
            skipped += 1
            continue
        where = f"{f['lat']:.6f},{f['lon']:.6f}" if f["kind"] == "point" else json.dumps(geom["coordinates"])[:400]
        # One place per record, as the old harvest had it: a map that rebuilds
        # its markers when a filter changes draws the same place twice.
        ident = hashlib.sha1(f"{f['kind']}|{where}|{f.get('popup', '')}|{f.get('tooltip_html', '')}".encode()).hexdigest()[:16]
        if ident in seen:
            continue
        seen.add(ident)
        props = {"k": ident, **marker_look(f, raw_css, m["colour"])}
        label = _sitemap.name_of(f)
        if label:
            props["n"] = label[:140]
        if marks[row]:
            props["f"] = "|" + "|".join(sorted(marks[row])) + "|"
        if f.get("group") in order:
            props["ov"] = overlays[order[f["group"]]]["name"]
        box = {}
        if f.get("popup"):
            props["p"] = 1
            box["h"] = f["popup"]
            if f.get("popup_options"):
                box["o"] = f["popup_options"]
        if f.get("tooltip_html"):
            props["t"] = 1
            box["t"] = f["tooltip_html"]
            if f.get("tooltip_options"):
                box["to"] = f["tooltip_options"]
        if box:
            boxes[ident] = box
        places.append({"type": "Feature", "geometry": geom, "properties": props})
        drawn[f["kind"] if f["kind"] in drawn else "polygon"] += 1

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{m['id']}.places.geojson").write_text(json.dumps({
        "type": "FeatureCollection", "name": name, "overlays": [o["name"] for o in overlays],
        "filters": filters, "features": places}, separators=(",", ":")))
    (OUT / f"{m['id']}.boxes.json").write_text(json.dumps({
        "name": name, "page": m.get("url") or m.get("page"), "css": css, "stylesheets": sheets,
        "chain": chain, "boxes": boxes}, separators=(",", ":")))
    extra = f", {skipped} not drawable" if skipped else ""
    if not filters and (data.get("controls") or []):
        kinds = sorted({c["group"] for c in data["controls"]})
        print(f"  note  {m['id']}: its controls ({', '.join(kinds)}) do not sort its places; no filter added")
    filt = "".join(f", {f['label'].lower()} filter ({len(f['values'])})" for f in filters)
    print(f"  ok    {m['id']:<26} {name!r}: {drawn['point']} places, {drawn['line']} lines, "
          f"{drawn['polygon']} areas, {len(boxes)} boxes{extra}{filt}")
    return name


def set_names(names):
    app = APP.read_text(encoding="utf-8")
    changed = 0
    for sid, name in names.items():
        pat = re.compile(r'(\{ id: "' + re.escape(sid) + r'", name: )"((?:[^"\\]|\\.)*)"')
        new = json.dumps(name, ensure_ascii=False)
        app, k = pat.subn(lambda mm: mm.group(1) + new, app, count=1)
        changed += k
    APP.write_text(app, encoding="utf-8")
    print(f"names set in map/app.js: {changed}")


def main():
    find_site_record()
    reg = json.loads((ROOT / "pipeline" / "sitemaps" / "registry.json").read_text())["maps"]
    wanted = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    names = {}
    for m in reg:
        if m["id"] in SKIP or (wanted and m["id"] not in wanted):
            continue
        if "url" not in m and not os.environ.get("WTYG_SITE_RECORD"):
            print(f"  skip  {m['id']:<26} lives in a Weebly page; set WTYG_SITE_RECORD to the unzipped site record")
            continue
        try:
            names[m["id"]] = build(m)
        except Exception as e:
            print(f"  FAIL  {m['id']}: {e}")
    set_names(names)


if __name__ == "__main__":
    main()
