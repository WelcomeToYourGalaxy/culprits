#!/usr/bin/env python3
"""
Place each hotspot map from the Atlas for the End of the World on the map.

The Atlas publishes each biodiversity hotspot as a PDF whose first page is a
map of that hotspot, with the cities on it named in text that stays text in
the file. That is enough to put the page where it belongs:

  1. read every place name on the first page and where it sits on the page;
  2. look each one up on OpenStreetMap (Nominatim), towns and cities only
     (countries and states the plate prints are set aside and listed),
     and only inside the hotspot's own outline box (Conservation
     International's Biodiversity Hotspots 2016.1, the outlines the map
     draws), so a same-named town elsewhere cannot answer: the Philippines
     plate was once pulled to 9,000 km wide by a town called China;
  3. find the one straight-line (affine) placement of the page that puts the
     most names within reach of where OpenStreetMap has them, trying many
     sets of three at random so that a wrongly-matched name cannot pull the
     page out of place (RANSAC);
  4. refine it on every name that agrees, and measure how far each still is
     from its place: that distance is the plate's error, and it is written
     down with the plate and shown on the map;
  5. draw the page as a picture and record where its four corners fall.

A plate is kept only when enough names agree and the error is small next to
the plate's size (MIN_AGREE, MAX_ERROR_SHARE), or when one name fewer agrees
and the error is half that (MIN_AGREE_SMALL, MAX_ERROR_SHARE_SMALL; set
MIN_AGREE_SMALL to MIN_AGREE to switch this off). The rest are listed with the
reason, and the map shows their PDF without placing it. Nothing is guessed:
the placement comes only from the Atlas's own labels and OpenStreetMap.

A label sits beside its town's dot, not on it, so the error is never zero; it
is of the order of a label's offset on the page.

Writes map/atlas/plates/<slug>.webp and map/atlas/plates.json. Downloads and
look-ups are kept in pipeline/.atlas-cache so a second run makes no requests.

Run from the repo root, with the venv on:
    pip install pymupdf pillow requests
    python3 pipeline/atlas_plates.py            every hotspot
    python3 pipeline/atlas_plates.py cerrado    one or more by name
    python3 pipeline/atlas_plates.py --show new_zealand philippines
        places nothing; writes pipeline/.atlas-cache/<slug>.page.txt with
        every piece of text on the page (kept or dropped, and why) and the
        largest shapes drawn on it, to see why a page will not place

Hotspots that cross the 180th meridian (New Zealand's Chatham Islands) keep
their longitudes running on past 180 (179, 181) rather than jumping to -179,
so the fit and the corners stay in one piece; the map draws such corners in
the neighbouring copy of the world, which is where they belong.
"""
import io
import json
import math
import pathlib
import random
import re
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "map" / "atlas"
CACHE = ROOT / "pipeline" / ".atlas-cache"
PDF_BASE = "https://atlas-for-the-end-of-the-world.com/hotspots/"
UA = {"User-Agent": "welcometoyourgalaxy-atlas/1.0 (+https://welcometoyourgalaxy.com)"}

# The same list the map carries (atlas_hotspots.pdfs in map/app.js).
HOTSPOTS = [
    ("atlantic_forests", "Atlantic Forest"), ("california_floristic_province", "California Floristic Province"),
    ("cape_floristic_region", "Cape Floristic Region"), ("caribbean_islands", "Caribbean Islands"),
    ("caucasus", "Caucasus"), ("cerrado", "Cerrado"), ("chilean_valdivian_forests", "Chilean Winter Rainfall Valdivian Forests"),
    ("coastal_forests_of_eastern_africa", "Coastal Forests of Eastern Africa"), ("east_melanesian_islands", "East Melanesian Islands"),
    ("eastern_afromontane", "Eastern Afromontane"), ("forests_of_east_australia", "Forests of Eastern Australia"),
    ("guinean_forests_of_west_africa", "Guinean Forests of West Africa"), ("himalaya", "Himalaya"), ("horn_of_africa", "Horn of Africa"),
    ("japan", "Japan"), ("madagascar", "Madagascar & The Indian Ocean Islands"), ("madrean_woodlands", "Madrean Pine-Oak Woodlands"),
    ("maputaland_pondoland_albany", "Maputaland Pondoland Albany"), ("mediterranean_basin", "Mediterranean Basin"),
    ("mesoamerica", "Mesoamerica"), ("mountains_of_central_asia", "Mountains of Central Asia"),
    ("mountains_of_southwest_china", "Mountains of Southwest China"), ("new_caledonia", "New Caledonia"), ("new_zealand", "New Zealand"),
    ("philippines", "Philippines"), ("north_american_coastal_plain", "North American Coastal Plain"),
    ("southwest_australia", "Southwest Australia"), ("succulent_karoo", "Succulent Karoo"), ("sundaland", "Sundaland"),
    ("tropical_andes", "Tropical Andes"), ("wallacea", "Wallacea"), ("western_ghats_sri_lanka", "Western Ghats & Sri Lanka"),
]

MIN_AGREE = 5            # names that must agree on the placement
MAX_ERROR_SHARE = 0.03   # typical error no more than 3% of the plate's width
# OpenStreetMap's rank of a place: 4 a country, 8 a state, 12 a county, 16 a
# city, 18 a town. Nominatim's "settlement" type lets countries and states
# through, and the plates also print country names ("Malawi", "Philippines"):
# on 23 September every plate placed with 4 names leaned on one of them. Only
# answers ranked as a town or finer are used.
MIN_TOWN_RANK = 13
REGIONS = set()          # names whose only answers were countries or regions
MIN_AGREE_SMALL = 4      # one fewer is accepted only with half the error
MAX_ERROR_SHARE_SMALL = 0.015
BOX_MARGIN = 0.25        # share of the outline box added on each side (at least 1 degree)
HOTSPOT_ITEM = "ba55aa1bff5447e7b72559b8dc1a0e83"   # the map's atlas_hotspots.item
AGOL = "https://www.arcgis.com/sharing/rest/content/items"
TRIES = 4000             # random sets of three tried
IMAGE_WIDTH = 2400       # pixels across the drawn page
# Close in, the page is also drawn at four times that, cut into a grid of
# squares, each placed by the same fit: the PDF is drawn in lines, so this keeps
# its detail when the map is zoomed in (asked for 23 September).
DETAIL_SCALE = 4
DETAIL_GRID = 4

# Words on the plates that are the key, the title or the figures, never places.
NOT_PLACES = {
    "kilometers", "hotspot", "neighboring", "protected", "area", "urban", "agriculture", "roads", "railroads",
    "biodiversity", "target", "category", "landuse", "population", "topography", "water", "body", "remnant",
    "vegetation", "existing", "growth", "projection", "conflict", "zone", "extreme", "threatened", "species",
    "habitat", "ecoregions", "ecoregion", "biomes", "endemic", "plant", "animal", "major", "crops", "threats",
    "shortfall", "assessment", "forests", "grasslands", "savannas", "shrublands", "conflicts", "protected",
}

R = 6378137.0
def merc(lon, lat):
    lat = max(-85.0, min(85.0, lat))
    return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
MERC_EDGE = R * math.pi          # the square web maps are drawn in, in metres from the centre
def unmerc(x, y):
    y = max(-MERC_EDGE, min(MERC_EDGE, y))
    return math.degrees(x / R), math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2)
def on_earth(T, w, h):
    """Whether a placement keeps the whole page on the map's square: three
    towns nearly in a line give a placement that throws the page off it.
    East-west it may run one world past the edge, for plates across the
    180th meridian whose longitudes are kept continuous (179, 181)."""
    for x, y in ((0, 0), (w, 0), (w, h), (0, h)):
        X, Y = apply(T, x, y)
        if not (-MERC_EDGE <= X <= 3 * MERC_EDGE and abs(Y) <= MERC_EDGE):
            return False
    return True


# Where on a label its place's dot is taken to be. Labels sit beside their dots
# on one side or another; each is tried and the one that fits best is kept, so
# the choice is measured, not assumed.
ANCHORS = {"centre": lambda b: ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2),
           "left edge": lambda b: (b[0], (b[1] + b[3]) / 2),
           "right edge": lambda b: (b[2], (b[1] + b[3]) / 2),
           "below": lambda b: ((b[0] + b[2]) / 2, b[3]),
           "above": lambda b: ((b[0] + b[2]) / 2, b[1])}


def label_candidates(page, anchor="centre"):
    """Each piece of text on the page that could be a place name, with its anchor point."""
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                t = re.sub(r"\s+", " ", span["text"]).strip(" ,.;:")
                if not (3 <= len(t) <= 40) or re.search(r"\d", t) or not t[0].isupper() or t.isupper():
                    continue
                if any(w.lower() in NOT_PLACES for w in re.split(r"[\s\-()]+", t) if w):
                    continue
                x, y = ANCHORS[anchor](span["bbox"])
                out.append((t, x, y))
    return out


def fit_affine(pairs):
    """Least squares page (x, y) -> mercator (X, Y); pairs of ((x, y), (X, Y))."""
    # Normal equations for X = a x + b y + c and Y = d x + e y + f, solved by hand (3x3).
    sxx = sxy = syy = sx = sy = n = 0.0
    sxX = syX = sX = sxY = syY = sY = 0.0
    for (x, y), (X, Y) in pairs:
        sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; n += 1
        sxX += x * X; syX += y * X; sX += X; sxY += x * Y; syY += y * Y; sY += Y
    M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]]
    def solve(b):
        a = [row[:] + [v] for row, v in zip(M, b)]
        for i in range(3):
            p = max(range(i, 3), key=lambda r: abs(a[r][i]))
            if abs(a[p][i]) < 1e-12:
                return None
            a[i], a[p] = a[p], a[i]
            for r in range(3):
                if r != i:
                    f = a[r][i] / a[i][i]
                    for c in range(i, 4):
                        a[r][c] -= f * a[i][c]
        return [a[i][3] / a[i][i] for i in range(3)]
    u, v = solve([sxX, syX, sX]), solve([sxY, syY, sY])
    return (u, v) if u and v else None


def apply(T, x, y):
    (a, b, c), (d, e, f) = T
    return a * x + b * y + c, d * x + e * y + f


def ground_km(X1, Y1, X2, Y2):
    """Distance between two mercator points in kilometres on the ground."""
    lon1, lat1 = unmerc(X1, Y1)
    lon2, lat2 = unmerc(X2, Y2)
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(min(1.0, h)))


def place_page(labels, width_pt, height_pt, seed=0):
    """labels: [(name, x, y, [(X, Y), ...candidates])]. The placement, its inliers and its error, or None."""
    usable = [l for l in labels if l[3]]
    if len(usable) < 3:
        return None
    rng = random.Random(seed)
    best = None
    for _ in range(TRIES):
        trio = rng.sample(usable, 3)
        T = fit_affine([((l[1], l[2]), rng.choice(l[3])) for l in trio])
        if not T or not on_earth(T, width_pt, height_pt):
            continue
        a, b = apply(T, 0, 0), apply(T, width_pt, 0)
        span_km = ground_km(*a, *b)
        if not (10 < span_km < 20000):
            continue
        reach = span_km * MAX_ERROR_SHARE * 2
        agree = []
        for l in usable:
            X, Y = apply(T, l[1], l[2])
            d, c = min((ground_km(X, Y, *c), c) for c in l[3])
            if d <= reach:
                agree.append(((l[1], l[2]), c, l[0]))
        if not best or len(agree) > len(best[1]):
            best = (T, agree)
    if not best or len(best[1]) < MIN_AGREE_SMALL:
        return {"kept": False, "reason": f"only {len(best[1]) if best else 0} names agree on a placement (at least {MIN_AGREE} needed, or {MIN_AGREE_SMALL} with half the error)"}
    share = MAX_ERROR_SHARE if len(best[1]) >= MIN_AGREE else MAX_ERROR_SHARE_SMALL
    T = fit_affine([(p, c) for p, c, _ in best[1]])
    if not T or not on_earth(T, width_pt, height_pt):
        return {"kept": False, "reason": "the towns that agree give no placement that keeps the page on the map"}
    errs = []
    for p, c, name in best[1]:
        X, Y = apply(T, *p)
        errs.append((ground_km(X, Y, *c), name))
    rms = math.sqrt(sum(e * e for e, _ in errs) / len(errs))
    span_km = ground_km(*apply(T, 0, 0), *apply(T, width_pt, 0))
    corners = [unmerc(*apply(T, x, y)) for x, y in ((0, 0), (width_pt, 0), (width_pt, height_pt), (0, height_pt))]
    kept = rms <= span_km * share
    return {"kept": kept, "reason": "" if kept else f"typical error {rms:.0f} km is more than {share:.1%} of the plate's {span_km:.0f} km with {len(errs)} names agreeing",
            "corners": [[round(lon, 5), round(lat, 5)] for lon, lat in corners],
            "error_km": round(rms, 1), "width_km": round(span_km), "names": sorted(n for _, n in errs),
            "worst": sorted(errs, reverse=True)[:3], "affine": T}


def atlas_words(s):
    """The same word test the map uses to pair a hotspot with its PDF (atlasWords in map/app.js)."""
    return {w for w in re.split(r"[^a-z]+", str(s).lower().replace("&", " and ")) if len(w) > 2 and w not in ("and", "the")}


def slug_for(name):
    want = atlas_words(name)
    best, score = None, 0.0
    for slug, title in HOTSPOTS:
        have = atlas_words(title)
        if not want or not have:
            continue
        sc = len(want & have) / max(len(want), len(have))
        if sc > score:
            best, score = slug, sc
    return best if score >= 0.5 else None


def continuous(lons):
    """Longitudes that straddle the 180th meridian, kept running on past 180."""
    if lons and max(lons) - min(lons) > 180:
        return [l + 360 if l < 0 else l for l in lons]
    return lons


def hotspot_boxes(session):
    """[west, south, east, north] of each hotspot's outline, west < east always
    (east may pass 180), from the same ArcGIS item the map draws. Kept in the cache."""
    path = CACHE / "hotspot_boxes.json"
    if path.exists():
        return json.loads(path.read_text())
    info = session.get(f"{AGOL}/{HOTSPOT_ITEM}", params={"f": "json"}, headers=UA, timeout=60).json()
    url = (info.get("url") or "").rstrip("/")
    if not url:
        raise RuntimeError("the hotspot item names no service")
    if re.search(r"/\d+$", url):
        layers = [url]
    else:
        svc = session.get(url, params={"f": "json"}, headers=UA, timeout=60).json()
        layers = [f"{url}/{l['id']}" for l in svc.get("layers", [])]
    pts = {}
    for layer in layers:
        offset = 0
        while True:
            j = session.get(layer + "/query", params={
                "where": "1=1", "outFields": "*", "returnGeometry": "true", "outSR": 4326, "f": "json",
                "maxAllowableOffset": 0.05, "resultOffset": offset, "resultRecordCount": 1000}, headers=UA, timeout=180).json()
            feats = j.get("features") or []
            for f in feats:
                names = [v for v in (f.get("attributes") or {}).values() if isinstance(v, str)]
                slug = next((s for s in map(slug_for, names) if s), None)
                if not slug:
                    continue
                for ring in (f.get("geometry") or {}).get("rings", []):
                    pts.setdefault(slug, []).extend((p[0], p[1]) for p in ring)
            if not j.get("exceededTransferLimit") or not feats:
                break
            offset += len(feats)
    boxes = {}
    for slug, ps in pts.items():
        lons = continuous([p[0] for p in ps])
        lats = [p[1] for p in ps]
        boxes[slug] = [min(lons), min(lats), max(lons), max(lats)]
    path.write_text(json.dumps(boxes, indent=1))
    return boxes


def widen(box):
    w, s, e, n = box
    mx = max(1.0, (e - w) * BOX_MARGIN)
    my = max(1.0, (n - s) * BOX_MARGIN)
    return [w - mx, max(-85.0, s - my), e + mx, min(85.0, n + my)]


def inside(lon, lat, box):
    """(lon, lat) as it falls in the box, longitude shifted by 360 if that is
    how it gets there, or None when it is outside."""
    w, s, e, n = box
    if not (s <= lat <= n):
        return None
    for shift in (0, 360, -360):
        if w <= lon + shift <= e:
            return (lon + shift, lat)
    return None


def geocode(name, cache, session, box=None):
    """Towns and cities called `name`; with a box, only those inside it,
    asked for inside it, so the answer is not five same-named towns elsewhere."""
    key = name + "|towns" if box is None else name + "|towns|" + ",".join(f"{v:.2f}" for v in box)
    if key in cache:
        return cache[key]
    if box is None:
        parts = [None]
    else:
        w, s, e, n = box
        # Nominatim's box cannot cross the 180th meridian: ask in two halves.
        parts = [(w, s, min(e, 180.0), n)] + ([(-180.0, s, e - 360.0, n)] if e > 180 else [])
    got = []
    for part in parts:
        time.sleep(1.1)                     # Nominatim's limit: one request a second
        params = {"q": name, "format": "jsonv2", "featureType": "settlement", "limit": 5}
        if part:
            params.update(viewbox=",".join(f"{v:.4f}" for v in part), bounded=1)
        r = session.get("https://nominatim.openstreetmap.org/search", params=params, headers=UA, timeout=60)
        hits = r.json() if r.ok else []
        towns = [h for h in hits if int(h.get("place_rank") or 0) >= MIN_TOWN_RANK]
        if hits and not towns:
            REGIONS.add(name)
        got += [(float(h["lon"]), float(h["lat"])) for h in towns]
    if box is not None:
        got = [p for p in (inside(lon, lat, box) for lon, lat in got) if p]
    cache[key] = got
    if name in REGIONS:
        cache[f"{name}|regions"] = True
    return got


def show_page(slug, page):
    """Everything on a page, for seeing why it will not place (--show)."""
    lines = [f"{slug}: page {page.rect.width:.0f} x {page.rect.height:.0f} pt", "", "TEXT (kept = read as a possible place name)"]
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                raw = span["text"]
                t = re.sub(r"\s+", " ", raw).strip(" ,.;:")
                why = ("too short or long" if not (3 <= len(t) <= 40) else "has a digit" if re.search(r"\d", t)
                       else "starts lower-case" if not t[:1].isupper() else "all capitals" if t.isupper()
                       else "a key word" if any(w.lower() in NOT_PLACES for w in re.split(r"[\s\-()]+", t) if w) else "kept")
                b = span["bbox"]
                lines.append(f"  {why:18} {t!r:44} at ({b[0]:.0f},{b[1]:.0f})-({b[2]:.0f},{b[3]:.0f}) size {span['size']:.1f} font {span['font']}")
    try:
        drawings = page.get_drawings()
    except Exception as e:  # noqa: BLE001
        drawings = []
        lines.append(f"(shapes could not be read: {e})")
    big = sorted(drawings, key=lambda d: -(d["rect"].width * d["rect"].height))[:25]
    lines += ["", f"SHAPES: {len(drawings)} drawn; the 25 largest by their box"]
    for d in big:
        r = d["rect"]
        lines.append(f"  box ({r.x0:.0f},{r.y0:.0f})-({r.x1:.0f},{r.y1:.0f})  fill {d.get('fill')}  stroke {d.get('color')}  parts {len(d.get('items', []))}")
    path = CACHE / f"{slug}.page.txt"
    path.write_text("\n".join(lines) + "\n")
    return path


def main(only, show=False):
    try:
        import pymupdf
    except ImportError:
        import fitz as pymupdf
    import requests
    from PIL import Image
    CACHE.mkdir(parents=True, exist_ok=True)
    (OUT / "plates").mkdir(parents=True, exist_ok=True)
    gc_path = CACHE / "geocode.json"
    cache = json.loads(gc_path.read_text()) if gc_path.exists() else {}
    session = requests.Session()
    try:
        boxes = hotspot_boxes(session)
        print(f"hotspot outline boxes: {len(boxes)} of {len(HOTSPOTS)}")
    except Exception as e:  # noqa: BLE001
        boxes = {}
        print(f"hotspot outline boxes could not be read ({e.__class__.__name__}: {e}); looking names up worldwide")
    out_path = OUT / "plates.json"
    plates = json.loads(out_path.read_text()) if out_path.exists() else {}
    for slug, title in HOTSPOTS:
        if only and slug not in only:
            continue
        pdf = CACHE / f"{slug}.pdf"
        if not pdf.exists():
            # One PDF that will not come (the Atlas lists the North American
            # Coastal Plain as not yet assessed) no longer stops the run.
            try:
                r = session.get(PDF_BASE + slug + ".pdf", headers=UA, timeout=180)
            except Exception as e:  # noqa: BLE001
                print(f"{slug}: the PDF did not come ({e.__class__.__name__})")
                continue
            if not r.ok or not r.content.startswith(b"%PDF"):
                print(f"{slug}: the PDF did not come ({r.status_code})")
                continue
            pdf.write_bytes(r.content)
        doc = pymupdf.open(str(pdf))
        page = doc[0]
        if show:
            print(f"{slug}: wrote {show_page(slug, page)}")
            continue
        box = widen(boxes[slug]) if slug in boxes else None
        labels = label_candidates(page)
        found = {name: geocode(name, cache, session, box) for name in dict.fromkeys(n for n, _, _ in labels)}
        gc_path.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
        w, h = page.rect.width, page.rect.height
        got = None
        for anchor in ANCHORS:
            rows = [(n, x, y, [merc(lon, lat) for lon, lat in found.get(n, [])]) for n, x, y in label_candidates(page, anchor)]
            tried = place_page(rows, w, h)
            if tried and tried.get("corners") and (not got or not got.get("corners") or
                                                   (len(tried["names"]), -tried["error_km"]) > (len(got["names"]), -got["error_km"])):
                got = dict(tried, anchor=anchor)
            elif not got:
                got = tried
        got = got or {"kept": False, "reason": "fewer than three names on the page could be found"}
        entry = {"title": title, "pdf": PDF_BASE + slug + ".pdf", "labels": len(labels), **got}
        if box:
            entry["looked_up_within"] = [round(v, 3) for v in box]
        regions = sorted(n for n in found if n in REGIONS or not found[n] and cache.get(f"{n}|regions"))
        if regions:
            entry["set_aside_as_regions"] = regions
        entry.pop("worst", None)
        T = entry.pop("affine", None)
        if got.get("kept"):
            zoom = IMAGE_WIDTH / w
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            img.save(OUT / "plates" / f"{slug}.webp", "WEBP", quality=80)
            entry["image"] = f"atlas/plates/{slug}.webp"
            # The detail squares: each a part of the page, drawn at four times
            # the size, and placed by the page's own fit at its four corners.
            ddir = OUT / "plates" / slug
            ddir.mkdir(parents=True, exist_ok=True)
            dzoom = zoom * DETAIL_SCALE
            entry["detail"] = []
            for r in range(DETAIL_GRID):
                for c in range(DETAIL_GRID):
                    x0, x1 = w * c / DETAIL_GRID, w * (c + 1) / DETAIL_GRID
                    y0, y1 = h * r / DETAIL_GRID, h * (r + 1) / DETAIL_GRID
                    part = page.get_pixmap(matrix=pymupdf.Matrix(dzoom, dzoom), clip=pymupdf.Rect(x0, y0, x1, y1), alpha=False)
                    Image.open(io.BytesIO(part.tobytes("png"))).save(ddir / f"d{r}{c}.webp", "WEBP", quality=80)
                    corners = [unmerc(*apply(T, x, y)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
                    entry["detail"].append({"image": f"atlas/plates/{slug}/d{r}{c}.webp",
                                            "corners": [[round(lon, 5), round(lat, 5)] for lon, lat in corners]})
        plates[slug] = entry
        say = f"placed, {len(got['names'])} names agree, typical error {got['error_km']} km on a {got['width_km']} km plate" if got.get("kept") else f"not placed: {got['reason']}"
        print(f"{slug}: {say}")
        if got.get("worst"):
            print("    furthest: " + "; ".join(f"{n} {d:.0f} km" for d, n in got["worst"]))
        out_path.write_text(json.dumps(plates, ensure_ascii=False, indent=1))
    print(f"wrote {out_path}")


if __name__ == "__main__":
    args = sys.argv[1:]
    main({a for a in args if a != "--show"}, show="--show" in args)
