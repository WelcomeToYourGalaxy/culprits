#!/usr/bin/env python3
"""
Southern South America and New Zealand, painted where they really are.

The painted chart is not drawn to true geography at the far south. Its
Patagonia stops short and bends, the old southern fade had to be undone
there, and undoing it left the tip blocky and misshapen. New Zealand was
never painted: a wind-cloud covers the spot.

This paints both from the map's own country shapes (map/data/
boundaries.geojson): land in a parchment texture taken from the chart's own
painted land and tinted to the chart's Patagonia, water in the chart's own
open-sea texture, a dark coastline, and a pale contour line offshore like
the chart's other coasts. Land is fully opaque, so the misted southern edge
no longer fades it; the sea around keeps its mist.

The painting's own Argentina north of 38°S is left alone, and the new work is
blended into it over three degrees of latitude so there is no seam.

Run once from the repo root:  python3 pipeline/plate/paint_south.py
It refuses to run twice.
"""
import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_dilation, gaussian_filter

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "map" / "atlas-plate.webp"
MARK = ROOT / "pipeline" / "plate" / ".south_painted"
BOUNDS = ROOT / "map" / "data" / "boundaries.geojson"
TOP, BOT = 85.05112877980659, -80.55          # the plate's own edges (app.js PLATE)

if MARK.exists():
    print("The south is already painted — nothing to do.")
    sys.exit(0)

im = np.array(Image.open(SRC).convert("RGBA")).astype(np.float64)
H, W = im.shape[:2]
rgb, A = im[:, :, :3], im[:, :, 3]


def ym(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def px(lng, lat):
    return ((lng + 180) / 360 * W, (ym(TOP) - ym(max(min(lat, 85), -85))) / (ym(TOP) - ym(BOT)) * H)


# Regions to paint: (west, south, east, north), and where the blend begins.
SA = (-78, -60, -52, -38)
NZ = (165, -48.5, 179.99, -33.5)
SS = 4                                         # supersampling for smooth coasts


def land_mask(box):
    w, s, e, n = box
    big = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(big)
    for f in json.loads(BOUNDS.read_text())["features"]:
        g = f.get("geometry") or {}
        polys = g.get("coordinates", [])
        polys = polys if g.get("type") == "MultiPolygon" else [polys]
        for poly in polys:
            ring = poly[0]
            xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
            if max(xs) < w or min(xs) > e or max(ys) < s or min(ys) > n:
                continue
            d.polygon([tuple(c * SS for c in px(x, y)) for x, y in ring], fill=255)
            for hole in poly[1:]:
                d.polygon([tuple(c * SS for c in px(x, y)) for x, y in hole], fill=0)
    return np.array(big.resize((W, H), Image.LANCZOS)).astype(np.float64) / 255


def box_weight(box, feather_north, soft=18):
    """1 inside the box, easing to 0 over `feather_north` degrees at its north
    edge and over `soft` pixels at its other three edges."""
    w, s, e, n = box
    x0, _ = px(w, 0); x1, _ = px(e, 0)
    _, y_n = px(0, n); _, y_f = px(0, n - feather_north); _, y_s = px(0, s)
    rows = np.arange(H)[:, None].astype(float)
    cols = np.arange(W)[None, :].astype(float)
    north = np.clip((rows - y_n) / max(1, y_f - y_n), 0, 1) if feather_north else (rows >= y_n).astype(float)
    if soft:
        south = np.clip((y_s - rows) / soft, 0, 1)
        west = np.clip((cols - x0) / soft, 0, 1)
        east = np.clip((x1 - cols) / soft, 0, 1)
    else:
        south = (rows <= y_s).astype(float)
        west = (cols >= x0).astype(float); east = (cols <= x1).astype(float)
    return north * south * west * east


def tile_from(y0, y1, x0, x1):
    p = rgb[y0:y1, x0:x1]
    t = np.concatenate([p, p[:, ::-1]], axis=1)
    t = np.concatenate([t, t[::-1]], axis=0)
    return np.tile(t, (H // t.shape[0] + 1, W // t.shape[1] + 1, 1))[:H, :W]


# Textures from the chart itself: clean painted land, and open Pacific water.
land_tex = tile_from(890, 930, 1370, 1410)
sea_tex = tile_from(650, 720, 120, 230)
# Tint the land toward the chart's own Patagonia, which is greener than the
# Australian desert the clean patch comes from.
pat = rgb[905:955, 505:560].reshape(-1, 3)
pat = pat[(pat.mean(axis=1) > 90) & (pat[:, 0] > pat[:, 2] + 15)]        # painted land only
if len(pat):
    land_tex = np.clip(land_tex - land_tex.reshape(-1, 3).mean(0) + pat.mean(0), 0, 255)
# A little grain so the tiling does not show.
rng = np.random.default_rng(7)
land_tex = np.clip(land_tex + gaussian_filter(rng.normal(0, 9, (H, W)), 2)[..., None], 0, 255)

COAST = np.array([34, 38, 30.0])
CONTOUR = np.array([88, 134, 132.0])

# The Andes: the chart's own painted range, carried down Chile's side.
andes_tex = tile_from(930, 970, 486, 500)

for box, feather, replace_sea in ((SA, 3, True), (NZ, 0, False)):
    m = land_mask(box)
    wt = box_weight(box, feather, 18 if replace_sea else 0)
    solid = m > 0.5
    ring = binary_dilation(solid, iterations=1) & ~solid
    halo = binary_dilation(solid, iterations=5) & ~binary_dilation(solid, iterations=4)
    new = sea_tex.copy() if replace_sea else rgb.copy()
    tex = land_tex
    if replace_sea:
        # A band about nine pixels in from the west coast of each row.
        first = np.full(H, W)
        cols = np.where(solid.any(axis=1))[0]
        for r in cols:
            first[r] = np.argmax(solid[r])
        dist = np.arange(W)[None, :] - first[:, None]
        band = np.clip(1 - (dist - 7) / 4, 0, 1) * (dist >= 0)
        band = gaussian_filter(band, 1)[..., None]
        tex = land_tex * (1 - band) + andes_tex * band
    new = new * (1 - m[..., None]) + tex * m[..., None]
    # Land darkens a touch toward its coast, as the chart's does.
    edge = gaussian_filter(solid.astype(float), 2.5)
    new = new * (0.82 + 0.18 * np.clip(edge * 1.6 - 0.3, 0, 1))[..., None] * m[..., None] + new * (1 - m[..., None])
    new[ring] = COAST
    new[halo] = new[halo] * 0.55 + CONTOUR * 0.45
    if replace_sea:
        W8 = wt
    else:
        # New Zealand: paint only the islands, their coast and the contour line
        # around them, so the rest of the cloud and sea stays as painted.
        W8 = wt * np.clip(gaussian_filter((binary_dilation(solid, iterations=6)).astype(float), 1.2), 0, 1)
    rgb[:] = rgb * (1 - W8[..., None]) + new * W8[..., None]
    # Land and its coast are opaque; the sea keeps its mist.
    A[:] = np.maximum(A, 255 * np.clip(gaussian_filter(binary_dilation(solid, iterations=2).astype(float), 1), 0, 1) * (wt > 0))

out = np.dstack([rgb, A]).clip(0, 255).astype(np.uint8)
Image.fromarray(out, "RGBA").save(SRC, "WEBP", quality=92, method=6)
MARK.write_text("painted\n")
print("Painted southern South America and New Zealand on map/atlas-plate.webp")
