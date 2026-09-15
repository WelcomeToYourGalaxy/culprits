#!/usr/bin/env python3
"""
Three display changes, applied in place to map/app.js and map/index.html.

Edits your files rather than replacing them, because two sessions are working
in app.js and a wholesale swap has already lost work twice today. Every edit is
anchored on exact text and asserts before writing — if an anchor has moved, the
script stops and changes nothing rather than half-applying.

Run from the repo root:  python3 patch_display.py
Undo:                    cp /tmp/app.js.bak map/app.js ; cp /tmp/index.html.bak map/index.html
"""

import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP = ROOT / "map" / "app.js"
HTML = ROOT / "map" / "index.html"


def main():
    for f in (APP, HTML):
        if not f.exists():
            sys.exit(f"no {f} — run from the repo root")
    shutil.copy(APP, "/tmp/app.js.bak")
    shutil.copy(HTML, "/tmp/index.html.bak")

    app = APP.read_text()
    html = HTML.read_text()

    # ---- 1. the alert rasters stop at their own coverage ------------------
    #
    # GFW's integrated and DIST alerts are tropical products. Outside that band
    # their tile server still answers, and what comes back is not transparent —
    # so the layer painted a flat wash over the rest of the world, which reads
    # as data where there is none. Worse after the hue rotation, which turned
    # that wash a different colour from the alerts themselves.
    #
    # A raster source can declare its own bounds, and MapLibre then requests no
    # tiles outside them. That is the honest fix: the product covers the
    # tropics, so the source says so, and nothing is drawn where nothing is
    # measured. -30 to 30 is GFW's stated coverage for integrated alerts.
    anchor = """    maxzoom: cfg.tileMaxZoom || 12,"""
    if anchor not in app:
        sys.exit("anchor 1 not found — send me `grep -n 'tileMaxZoom' map/app.js`")
    app = app.replace(anchor, """    maxzoom: cfg.tileMaxZoom || 12,
    // Declared coverage. Without this the server answers outside the product's
    // extent with a non-transparent tile, and the map paints a wash over half
    // the planet that a reader has no reason to read as "no data".
    ...(cfg.bounds ? { bounds: cfg.bounds } : {}),""", 1)

    for lid in ("gfw", "gfw_dist", "gfw_dist_year"):
        m = re.search(r'\{ id:"' + lid + r'",[^\n]*\n', app)
        if m and "bounds:" not in m.group(0):
            app = app.replace(m.group(0), m.group(0).rstrip("\n") +
                              "\n    bounds: [-180, -30, 180, 30],\n", 1)

    # ---- 2. per-layer dot sizing ------------------------------------------
    #
    # The dense facility layers overlap into a single mass at world zoom. Their
    # magnitudes are genuinely large, so the shared ramp sizes them correctly
    # and illegibly. radiusScale shrinks a layer's dots without touching the
    # ramp everything else uses — relative sizes within the layer are
    # unchanged, so a bigger plant is still a bigger dot.
    old_r = '''        0,  ["*", 0.26, MAGNITUDE_RADIUS],
        3,  ["*", 0.38, MAGNITUDE_RADIUS],
        6,  ["*", 0.60, MAGNITUDE_RADIUS],
        10, ["*", 1.00, MAGNITUDE_RADIUS],'''
    if old_r not in app:
        sys.exit("anchor 2 not found — send me `grep -n 'MAGNITUDE_RADIUS' map/app.js`")
    app = app.replace(old_r, '''        0,  ["*", 0.26 * scale, MAGNITUDE_RADIUS],
        3,  ["*", 0.38 * scale, MAGNITUDE_RADIUS],
        6,  ["*", 0.60 * scale, MAGNITUDE_RADIUS],
        10, ["*", 1.00 * scale, MAGNITUDE_RADIUS],''', 1)

    old_fn = "async function addPmtilesLayer(cfg) {"
    app = app.replace(old_fn, old_fn + '''
  // Per layer, defaulting to no change. Set radiusScale on a layer whose dots
  // crowd at low zoom; everything else keeps the shared ramp exactly.
  const scale = typeof cfg.radiusScale === "number" ? cfg.radiusScale : 1;''', 1)

    # The crowded ones, and a tighter stroke so a small dot still has an edge.
    for lid in ("power_plants", "gem_coal", "climate_trace"):
        for m in re.finditer(r'\{ id:"' + lid + r'[a-z_0-9]*",[^\n]*\n', app):
            if "radiusScale" not in m.group(0):
                app = app.replace(m.group(0), m.group(0).rstrip("\n") +
                                  "\n    radiusScale: 0.55,\n", 1)

    # ---- 3. legend --------------------------------------------------------
    #
    # Lists what is switched ON, not every layer in the registry. A legend for
    # forty layers is a second panel nobody reads, and one that names layers a
    # reader cannot see is worse than none. It rebuilds on every toggle.
    #
    # The precision convention is always shown, because it is the one piece of
    # encoding that is not per layer: hollow means the source did not give a
    # position, and that applies across the whole map.
    legend_js = '''
/* ---------- legend ---------- */
//
// What the colours mean, for the layers currently drawn. Rebuilt on every
// toggle so it can never name a layer that is not on the map — a legend that
// drifts from what is displayed is worse than no legend, because a reader
// trusts it.
function buildLegend() {
  const box = document.getElementById("legend");
  if (!box) return;

  const shown = [];
  for (const cfg of LAYERS) {
    if (!cfg.ready) continue;
    if ((visibility.get(cfg.id) || "visible") !== "visible") continue;
    shown.push(cfg);
  }
  for (const g of (typeof GROUPS !== "undefined" ? GROUPS : [])) {
    for (const child of g.children) {
      if ((visibility.get(child.id) || "none") === "visible") shown.push(child);
    }
  }

  if (!shown.length) { box.hidden = true; return; }
  box.hidden = false;

  const rows = shown.map((c) =>
    `<div class="lg-row"><span class="lg-sw" style="background:${c.colour}"></span>` +
    `<span class="lg-nm">${c.name}</span>` +
    `<span class="lg-un">${c.unit || ""}</span></div>`).join("");

  box.innerHTML =
    `<div class="lg-hd">Showing</div>${rows}` +
    `<div class="lg-rule"></div>` +
    `<div class="lg-row"><span class="lg-sw lg-hollow"></span>` +
    `<span class="lg-nm">hollow</span>` +
    `<span class="lg-un">no site coordinate published</span></div>`;
}
'''
    app = app.replace("/* ---------- shared ---------- */", legend_js +
                      "\n/* ---------- shared ---------- */", 1)

    # Rebuild whenever visibility changes.
    app = re.sub(r'(\n\s*)applyVisibility\((cfg\.id|id|child\.id)\);',
                 r'\1applyVisibility(\2);\1buildLegend();', app)
    app = app.replace("map.on(\"load\", gmInit);",
                      "map.on(\"load\", gmInit);\nmap.on(\"load\", buildLegend);", 1)

    legend_css = '''  /* Legend. Bottom right, above the attribution, narrow enough not to cover
     the map. Lists only what is switched on. */
  #legend{position:absolute;right:9px;bottom:26px;z-index:2;max-width:236px;
    background:rgba(17,21,15,.88);border:1px solid var(--rule);border-radius:2px;
    padding:6px 8px;font-size:11px;line-height:1.35;color:var(--dim);
    max-height:42vh;overflow-y:auto}
  #legend[hidden]{display:none}
  .lg-hd{color:var(--bone);font-size:10.5px;letter-spacing:.06em;
    text-transform:uppercase;margin-bottom:4px}
  .lg-row{display:flex;align-items:baseline;gap:6px;margin:2px 0}
  .lg-sw{flex:0 0 auto;width:8px;height:8px;border-radius:50%;margin-top:3px}
  .lg-hollow{background:none;border:1px solid var(--dim)}
  .lg-nm{color:var(--bone);flex:0 0 auto}
  .lg-un{color:var(--dim);font-size:10px}
  .lg-rule{border-top:1px solid var(--rule);margin:5px 0 3px}

'''
    if "#legend{" not in html:
        anchor3 = "  .maplibregl-popup-content{"
        if anchor3 not in html:
            sys.exit("anchor 3 not found — send me `grep -n 'popup-content' map/index.html`")
        html = html.replace(anchor3, legend_css + anchor3, 1)
        html = html.replace('<div class="gm" id="gm" hidden>',
                            '<div id="legend" hidden></div>\n\n<div class="gm" id="gm" hidden>', 1)

    APP.write_text(app)
    HTML.write_text(html)
    print("patched map/app.js and map/index.html")
    print("backups at /tmp/app.js.bak and /tmp/index.html.bak")
    print("\nNow run: node map/test.mjs")


if __name__ == "__main__":
    main()
