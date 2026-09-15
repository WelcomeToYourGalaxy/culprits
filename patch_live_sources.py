#!/usr/bin/env python3
"""
Add the Cerulean and Allen Coral Worker routes, and turn their layers on.

Edits worker/index.js and map/app.js in place, anchored on exact text, asserting
before it writes. Run from the repo root:  python3 patch_live_sources.py
Undo: cp /tmp/worker.js.bak worker/index.js ; cp /tmp/app2.js.bak map/app.js
"""

import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent
W = ROOT / "worker" / "index.js"
APP = ROOT / "map" / "app.js"

ROUTES = '''  // Cerulean — Sentinel-1 radar detections of oil at sea, and the vessels and
  // platforms the model associates with them. Two collections of one OGC
  // Features API, so two routes over the same host.
  //
  // No key, and the responses are already GeoJSON, so shape() passes them
  // through untouched and nothing here has to know their field names.
  //
  // THE BBOX ORDER IS THE ONE THING TO WATCH. This Worker hands over
  // w,s,e,n — standard OGC minx,miny,maxx,maxy — but SkyTruth's own guide
  // shows examples reading 10.9,42.3,19.7,36.1, which is west,north,east,south.
  // One of the two is wrong and it cannot be settled from the documentation.
  // Standard order is sent; if the first live call returns features in the
  // wrong hemisphere, swap here and nowhere else.
  cerulean_slicks: {
    // SkyTruth's own caveat, which the layer note carries: oil cannot be
    // definitively identified from radar alone, so every polygon is a
    // POTENTIAL slick awaiting review, and coverage is EEZs rather than the
    // high seas.
    maxAreaDeg2: 120,
    url: (bbox) =>
      "https://api.cerulean.skytruth.org/collections/public.slick_plus/items" +
      `?bbox=${bbox}&limit=500&f=geojson`,
    headers: () => ({}),
  },
  cerulean_sources: {
    // The attribution side, and the reason this one needs care: it names
    // specific vessels and platforms. source_collated_score runs -5 to +5 and
    // SkyTruth treat above 0 as credible — but nothing is filtered here. A
    // score is an estimated likelihood, not a finding, and the reader sees the
    // number rather than a decision made on their behalf.
    maxAreaDeg2: 120,
    url: (bbox) =>
      "https://api.cerulean.skytruth.org/collections/public.source_plus/items" +
      `?bbox=${bbox}&limit=500&f=geojson`,
    headers: () => ({}),
  },
  // Allen Coral Atlas — benthic habitat zones, CC BY 4.0, verified from the
  // WFS capabilities rather than from documentation.
  //
  // TWO TRAPS, BOTH IN THE QUERY STRING.
  //
  // CountDefault on this service is 1,000,000. Without an explicit count a
  // single request can try to return the reefs of the world, which is neither
  // servable nor drawable. Capped at 2,000.
  //
  // And the axis order: WFS 2.0 with "EPSG:4326" means LATITUDE FIRST, which
  // is the opposite of what this Worker hands over and of what everyone
  // expects. Naming CRS84 explicitly in the bbox makes it longitude-first and
  // removes the ambiguity, rather than relying on GeoServer's interpretation.
  //
  // The declared extent is -32 to +32 degrees. A request outside it returns an
  // empty collection, which is correct and looks like a broken layer — the
  // layer note says so.
  allen_coral: {
    maxAreaDeg2: 40,
    url: (bbox) =>
      "https://allencoralatlas.org/geoserver/ows?service=WFS&version=2.0.0" +
      "&request=GetFeature&typeNames=coral-atlas:benthic_data_verbose" +
      "&outputFormat=application/json&srsName=EPSG:4326&count=2000" +
      `&bbox=${bbox},urn:ogc:def:crs:OGC:1.3:CRS84`,
    headers: () => ({}),
  },
'''


def main():
    for f in (W, APP):
        if not f.exists():
            sys.exit(f"no {f} — run from the repo root")
    shutil.copy(W, "/tmp/worker.js.bak")
    shutil.copy(APP, "/tmp/app2.js.bak")

    w = W.read_text()
    app = APP.read_text()

    if "cerulean_slicks:" in w:
        sys.exit("the Worker already has these routes — nothing to do")

    anchor = "  epa_tri: {"
    if anchor not in w:
        sys.exit("anchor not found — send me `grep -n 'epa_tri: {' worker/index.js`")
    w = w.replace(anchor, ROUTES + anchor, 1)

    # The cache is keyed on CACHE_VERSION. New routes do not need it bumped,
    # but BUILD is what /v1/_diag reports, and a deploy nobody can confirm has
    # already cost this project a session.
    w = re.sub(r'const CACHE_VERSION = "v\d+";',
               'const CACHE_VERSION = "v12";', w, count=1)
    w = re.sub(r'const BUILD = "[^"]*";',
               'const BUILD = "2026-09-14 cerulean slicks and sources, allen coral benthic";',
               w, count=1)

    # /v1/_diag lists its routes from a hardcoded array naming only the four
    # original ones. Left alone rather than half-corrected here — it is a
    # separate fix, and a diagnostic that lies about half its routes is worth
    # doing properly rather than patching by hand.

    for lid in ("cerulean_slicks", "cerulean_sources", "allen_coral"):
        m = re.search(r'\{ id:"' + lid + r'",[^\n]*', app)
        if not m:
            sys.exit(f"no layer entry for {lid} in map/app.js")
        line = m.group(0)
        if "ready:false" in line:
            app = app.replace(line, line.replace("ready:false", "ready:true, off: true"), 1)

    W.write_text(w)
    APP.write_text(app)
    print("added 3 Worker routes, turned 3 layers on (off by default)")
    print("backups at /tmp/worker.js.bak and /tmp/app2.js.bak")
    print("\nNow run:")
    print("  node worker/test.mjs && node map/test.mjs")
    print("  cd worker && npx wrangler deploy && cd ..")
    print("  curl -s \"$W/v1/_diag\" | head -20      # BUILD should name cerulean")


if __name__ == "__main__":
    main()
