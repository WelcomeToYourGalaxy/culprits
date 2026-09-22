#!/usr/bin/env python3
"""
Place each hotspot map from the Atlas for the End of the World on the map.

The Atlas publishes each biodiversity hotspot as a PDF whose first page is a
map of that hotspot, with the cities on it named in text that stays text in
the file. That is enough to put the page where it belongs:

  1. read every place name on the first page and where it sits on the page;
  2. look each one up on OpenStreetMap (Nominatim), towns and cities only;
  3. find the one straight-line (affine) placement of the page that puts the
     most names within reach of where OpenStreetMap has them, trying many
     sets of three at random so that a wrongly-matched name cannot pull the
     page out of place (RANSAC);
  4. refine it on every name that agrees, and measure how far each still is
     from its place: that distance is the plate's error, and it is written
     down with the plate and shown on the map;
  5. draw the page as a picture and record where its four corners fall.

A plate is kept only when enough names agree and the error is small next to
the plate's size (MIN_AGREE, MAX_ERROR_SHARE). The rest are listed with the
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
TRIES = 4000             # random sets of three tried
IMAGE_WIDTH = 2400       # pixels across the drawn page

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
    towns nearly in a line give a placement that throws the page off it."""
    return all(abs(v) <= MERC_EDGE for x, y in ((0, 0), (w, 0), (w, h), (0, h)) for v in apply(T, x, y))


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
    if not best or len(best[1]) < MIN_AGREE:
        return {"kept": False, "reason": f"only {len(best[1]) if best else 0} names agree on a placement (at least {MIN_AGREE} needed)"}
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
    kept = rms <= span_km * MAX_ERROR_SHARE
    return {"kept": kept, "reason": "" if kept else f"typical error {rms:.0f} km is more than {MAX_ERROR_SHARE:.0%} of the plate's {span_km:.0f} km",
            "corners": [[round(lon, 5), round(lat, 5)] for lon, lat in corners],
            "error_km": round(rms, 1), "width_km": round(span_km), "names": sorted(n for _, n in errs),
            "worst": sorted(errs, reverse=True)[:3]}


def geocode(name, cache, session):
    if name in cache:
        return cache[name]
    time.sleep(1.1)                     # Nominatim's limit: one request a second
    r = session.get("https://nominatim.openstreetmap.org/search",
                    params={"q": name, "format": "jsonv2", "featureType": "settlement", "limit": 5}, headers=UA, timeout=60)
    got = [(float(h["lon"]), float(h["lat"])) for h in (r.json() if r.ok else [])]
    cache[name] = got
    return got


def main(only):
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
    out_path = OUT / "plates.json"
    plates = json.loads(out_path.read_text()) if out_path.exists() else {}
    for slug, title in HOTSPOTS:
        if only and slug not in only:
            continue
        pdf = CACHE / f"{slug}.pdf"
        if not pdf.exists():
            r = session.get(PDF_BASE + slug + ".pdf", headers=UA, timeout=180)
            if not r.ok:
                print(f"{slug}: the PDF did not come ({r.status_code})")
                continue
            pdf.write_bytes(r.content)
        doc = pymupdf.open(str(pdf))
        page = doc[0]
        labels = label_candidates(page)
        for name in dict.fromkeys(n for n, _, _ in labels):
            geocode(name, cache, session)
        gc_path.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
        w, h = page.rect.width, page.rect.height
        got = None
        for anchor in ANCHORS:
            rows = [(n, x, y, [merc(lon, lat) for lon, lat in cache.get(n, [])]) for n, x, y in label_candidates(page, anchor)]
            tried = place_page(rows, w, h)
            if tried and tried.get("corners") and (not got or not got.get("corners") or
                                                   (len(tried["names"]), -tried["error_km"]) > (len(got["names"]), -got["error_km"])):
                got = dict(tried, anchor=anchor)
            elif not got:
                got = tried
        got = got or {"kept": False, "reason": "fewer than three names on the page could be found"}
        entry = {"title": title, "pdf": PDF_BASE + slug + ".pdf", "labels": len(labels), **got}
        entry.pop("worst", None)
        if got.get("kept"):
            zoom = IMAGE_WIDTH / w
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            img.save(OUT / "plates" / f"{slug}.webp", "WEBP", quality=80)
            entry["image"] = f"atlas/plates/{slug}.webp"
        plates[slug] = entry
        say = f"placed, {len(got['names'])} names agree, typical error {got['error_km']} km on a {got['width_km']} km plate" if got.get("kept") else f"not placed: {got['reason']}"
        print(f"{slug}: {say}")
        if got.get("worst"):
            print("    furthest: " + "; ".join(f"{n} {d:.0f} km" for d, n in got["worst"]))
        out_path.write_text(json.dumps(plates, ensure_ascii=False, indent=1))
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
