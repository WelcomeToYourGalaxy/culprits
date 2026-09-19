#!/usr/bin/env python3
"""
List every map and chart inside one page of the saved site record: each
custom-HTML block, unpacked the way export_page_maps.mjs unpacks it, with its
title, what it is built with, how many places it seems to hold, and the data
files or frames it loads.

Run from the culprits repo root:
  python3 pipeline/list_page_maps.py off-planet-invasion
"""
import base64, html, os, pathlib, re, sys


def record():
    if os.environ.get("WTYG_SITE_RECORD"):
        return pathlib.Path(os.environ["WTYG_SITE_RECORD"])
    for base in (pathlib.Path.home() / "Desktop", pathlib.Path.home() / "Downloads"):
        for hit in base.glob("**/suppression.html"):
            return hit.parent
    sys.exit("No site record found. Set WTYG_SITE_RECORD to the unzipped folder.")


def unpack(block):
    m = re.search(r"data:text/html[^,]*;base64,([A-Za-z0-9+/=]+)", block)
    if m:
        return base64.b64decode(m.group(1)).decode("utf-8", "replace"), "base64 frame"
    for c in re.findall(r"[\"']([A-Za-z0-9+/=]{2000,})[\"']", block):
        try:
            t = base64.b64decode(c).decode("utf-8", "replace")
            if re.search(r"<html|<script", t, re.I):
                return t, "base64 script"
        except Exception:  # noqa: BLE001
            pass
    m = re.search(r"\ssrcdoc\s*=\s*\"([^\"]*)\"", block) or re.search(r"\ssrcdoc\s*=\s*'(.*?)'(?=\s*(?:[\w-]+\s*=|/?>))", block, re.S)
    if m:
        return html.unescape(m.group(1)), "srcdoc frame"
    m = re.search(r"<script[^>]*type\s*=\s*[\"']text/html[\"'][^>]*>([\s\S]*?)</script>", block, re.I)
    if m:
        return m.group(1), "html island"
    return block, "inline"


LIBS = [("Leaflet", r"L\.map\("), ("MapLibre/Mapbox", r"maplibregl|mapboxgl"), ("Cesium", r"Cesium"),
        ("three.js", r"THREE\."), ("globe.gl", r"Globe\(\)|globe\.gl"), ("D3", r"d3\.(select|geo)"),
        ("Chart.js", r"new Chart\("), ("canvas", r"getContext\(['\"]2d"), ("Google Maps", r"google\.maps"),
        ("ArcGIS", r"esri/|arcgis"), ("Plotly", r"Plotly\.")]


def main(page):
    f = record() / f"{page}.html"
    if not f.exists():
        sys.exit(f"{f} is not in the site record")
    text = f.read_text(errors="replace")
    starts = [m.start() for m in re.finditer(r'class="wcustomhtml"', text)] + [len(text)]
    n = 0
    for i in range(len(starts) - 1):
        block = text[starts[i]:starts[i + 1]]
        doc, how = unpack(block)
        libs = [name for name, pat in LIBS if re.search(pat, doc)]
        frames = re.findall(r"<iframe[^>]*src=[\"']([^\"']+)", doc)
        if not libs and not frames:
            continue
        n += 1
        title = re.search(r"<title>(.*?)</title>|<h[12][^>]*>(.*?)</h[12]>", doc, re.S | re.I)
        title = re.sub(r"<[^>]+>", "", (title.group(1) or title.group(2)) if title else "").strip()[:90]
        places = len(re.findall(r"\blat(itude)?\b\s*[:=]", doc))
        data = sorted(set(re.findall(r"https?://[^\"'\s)]+\.(?:json|geojson|csv|kml|pmtiles)(?:\?[^\"'\s)]*)?", doc)))[:5]
        print(f"\n== block {i + 1}: {title or '(no title)'}")
        print(f"   built with: {', '.join(libs) or '-'}   packed as: {how}   size: {len(doc):,} characters")
        print(f"   places written in it (lat fields): {places}")
        for u in data:
            print(f"   data: {u}")
        for u in frames[:5]:
            print(f"   frame: {u[:150]}")
    print(f"\n{n} maps or charts on {page}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "off-planet-invasion")
