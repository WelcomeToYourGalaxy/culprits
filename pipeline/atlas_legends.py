#!/usr/bin/env python3
"""
The keys printed on the Atlas for the End of the World's hotspot PDFs, for the
layer menu (round 90b, asked 27 September: "add the legends shown on the pdfs
themselves to the layer menu too").

For each hotspot PDF (copies in culprits-tiles-more atlas/pdfs/), two keys are
read: the one beside its first map (page 1) and the one beside its conflicts
map (the page titled "... | CONFLICTS"). A key is a column of short lines, each
with a swatch just to its left. The words are read from the PDF's own text
(poppler's pdftotext -bbox-layout); each swatch is cut from the page drawn at
four times its size (pdftoppm), so hatching and gradients come across as
printed. Identical swatches are stored once.

  python3 pipeline/atlas_legends.py <folder of the hotspot PDFs>

Writes map/atlas/legends.json:
  { "swatches": [data-URI PNG, ...],
    "hotspots": { slug: { "map": [[label, swatch index], ...], "conflicts": [...] } } }
"""
import base64, hashlib, html, io, json, pathlib, re, subprocess, sys, tempfile
from PIL import Image

OUT = pathlib.Path(__file__).resolve().parent.parent / "map" / "atlas" / "legends.json"
DPI = 288                       # 4x the PDF's 72 points to the inch
K = DPI / 72


def words(pdf, page):
    xml = subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), "-bbox-layout", str(pdf), "-"],
                         capture_output=True, text=True, check=True).stdout
    out = []
    for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', xml):
        out.append((float(m[1]), float(m[2]), float(m[3]), float(m[4]), html.unescape(m[5]).strip()))
    return out


def lines(ws):
    # Words on the same baseline (within 1.5 pt), left to right, joined.
    rows = []
    for w in sorted(ws, key=lambda w: (round(w[1]), w[0])):
        for r in rows:
            if abs(r["y0"] - w[1]) < 1.5 and w[0] - r["x1"] < 4.5:
                r["t"].append(w[4]); r["x1"] = w[2]; r["y1"] = max(r["y1"], w[3])
                break
        else:
            rows.append({"x0": w[0], "y0": w[1], "x1": w[2], "y1": w[3], "t": [w[4]]})
    for r in rows:
        r["text"] = " ".join(t for t in r["t"] if t)
    return rows


def pages(pdf):
    n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout)[1])
    return n


def render(pdf, page, tmp):
    stem = pathlib.Path(tmp) / f"p{page}"
    subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(DPI), "-png", "-singlefile", str(pdf), str(stem)], check=True)
    return Image.open(str(stem) + ".png").convert("RGB")


def background(img):
    # The page's own colour: the commonest colour of its border.
    w, h = img.size
    px = [img.getpixel((x, y)) for x in range(0, w, 7) for y in (2, h - 3)]
    return max(set(px), key=px.count)


def far(c, bg):
    return sum(abs(a - b) for a, b in zip(c, bg)) > 24


def swatch(img, bg, r):
    # The swatch sits left of the words, as tall as the line: look in the
    # 30 points before the words for the block of non-background pixels
    # nearest them.
    y0, y1 = int((r["y0"] - 1) * K), int((r["y1"] + 1) * K)
    xs = [x for x in range(int((r["x0"] - 30) * K), int((r["x0"] - 1) * K))
          if sum(far(img.getpixel((x, y)), bg) for y in range(y0, y1)) >= 2]
    if len(xs) < 6:
        return None
    # The run of columns nearest the words.
    run = [xs[-1]]
    for x in reversed(xs[:-1]):
        if run[-1] - x > 2:
            break
        run.append(x)
    x0, x1 = min(run), max(run) + 1
    if x1 - x0 < 6:
        return None
    ys = [y for y in range(y0, y1) if sum(far(img.getpixel((x, y)), bg) for x in range(x0, x1)) > (x1 - x0) * 0.2]
    if not ys:
        return None
    crop = img.crop((x0, min(ys), x1, max(ys) + 1))
    crop.thumbnail((28, 28))
    buf = io.BytesIO()
    crop.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def clean(t):
    # Words from beside the key that sit on its line: the protected-share
    # figures ("13% NA", "2015: 17.6% PROTECTED") and a town label printed
    # just after a key line's closing bracket.
    t = re.sub(r"\s+(\d{4}:\s*)?\.?\d+(\.\d+)?%.*$", "", t)
    t = re.sub(r"^((?:Protected Area|Agriculture) \([^)]*\)).*$", r"\1", t)
    return t.strip()


def key_of(pdf, page, tmp, min_rows=4):
    rows = [r for r in lines(words(pdf, page)) if r["text"]]
    img = render(pdf, page, tmp)
    bg = background(img)
    # Candidate key lines: short lines whose left edges line up (within 1 pt)
    # with at least min_rows others, in the right half of the page, each with a swatch.
    W = img.size[0] / K
    best = []
    for r in rows:
        if r["x0"] < W * 0.45 and not re.search(r"conflict|topography", r["text"], re.I):
            continue
        col = [s for s in rows if abs(s["x0"] - r["x0"]) < 1 and len(s["text"]) < 60 and (s["y1"] - s["y0"]) < 14]
        if len(col) > len(best):
            best = col
    got = []
    # A line of figures alone (the protected-share chart beside the key) is not a key line.
    best = [r for r in best if re.search(r"[A-Za-z]{3}", r["text"])]
    for r in sorted(best, key=lambda r: r["y0"]):
        sw = swatch(img, bg, r)
        if sw:
            got.append((clean(r["text"]), sw))
    return got if len(got) >= min_rows else []


def main(folder):
    folder = pathlib.Path(folder)
    swatches, index, hot = [], {}, {}
    for pdf in sorted(folder.glob("*.pdf")):
        n = pages(pdf)
        conflicts = None
        for p in range(1, n + 1):
            head = subprocess.run(["pdftotext", "-f", str(p), "-l", str(p), str(pdf), "-"], capture_output=True, text=True).stdout[:200]
            if re.search(r"\|\s*CONFLICTS", head, re.I):
                conflicts = p
                break
        rec = {}
        with tempfile.TemporaryDirectory() as tmp:
            for name, page in (("map", 1), ("conflicts", conflicts)):
                if not page:
                    continue
                items = []
                for text, sw in key_of(pdf, page, tmp):
                    h = hashlib.sha1(sw).hexdigest()
                    if h not in index:
                        index[h] = len(swatches)
                        swatches.append("data:image/png;base64," + base64.b64encode(sw).decode())
                    items.append([text, index[h]])
                if items:
                    rec[name] = items
        hot[pdf.stem] = rec
        print(pdf.stem, {k: len(v) for k, v in rec.items()}, flush=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"swatches": swatches, "hotspots": hot}, ensure_ascii=False, separators=(",", ":")))
    print(f"{OUT}: {len(swatches)} swatches, {OUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "atlas/pdfs")
