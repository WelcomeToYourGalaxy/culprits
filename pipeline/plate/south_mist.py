#!/usr/bin/env python3
"""
The painted plate's southern edge, misted like its northern one.

The plate (map/atlas-plate.webp) fades organically into the imagery in the
north, but in the south it stopped on a straight line at row 950 (about 32°S),
with only the compass rose, cartouche and sea creatures below it. This gives
the south the north's own edge: the northern mist, turned over and shifted half
a world so the two do not mirror, over 250 rows as in the north. Under it the
painting runs to its own end (row 995); below that, open water taken from the
plate is filled in and toned to the painting's water, because the plate's
padding there is flat smears. The ornaments keep their own pixels; only what
showed through around them now shows mist.

Run once from the repo root:  python3 pipeline/plate/south_mist.py
"""
import numpy as np
from PIL import Image

import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "map" / "atlas-plate.webp"
im = np.array(Image.open(SRC).convert("RGBA")).astype(np.float64)
H, W = im.shape[:2]
rgb, A = im[:, :, :3], im[:, :, 3] / 255.0
# Already done: the old plate is see-through at row 1060 except under the
# ornaments (about a quarter of the row); the misted one is mostly covered.
if (A[1060] > 0.3).mean() > 0.6:
    sys.exit("The plate's southern edge is already misted — nothing to do.")

LINE = 950          # where the old straight edge begins
END = 1200          # where the new mist reaches nothing: 250 rows, as in the north

# 1. Below the old line the plate holds two things: the painting itself, which
#    reaches different depths in different places (South America's tip, the sea
#    creatures, the cartouche), and flat smears the plate was padded with. The
#    painting is kept wherever it is real; only the smears are replaced, with
#    open water from the plate itself, toned to the painting's own water.
from scipy.ndimage import uniform_filter, gaussian_filter, binary_closing

grey = rgb.mean(axis=2)
across = np.pad(np.abs(np.diff(grey, axis=1)), ((0, 0), (0, 1)))
painted = uniform_filter(across, size=(1, 21)) > 0.45      # smears vary by nothing across a row
painted = binary_closing(painted, np.ones((3, 9)))
real = np.zeros((H, W), bool)
real[:LINE] = True
for x in range(W):
    r = LINE
    while r < H - 1:
        if painted[r, x]:
            real[r, x] = True
            r += 1
        elif painted[r:r + 12, x].any():                   # a smooth patch inside the painting
            real[r, x] = True
            r += 1
        else:
            break

patch = rgb[650:720, 120:230]             # open Pacific: the cleanest water on the plate, no lines or creatures
def mirrored_tile(p, h, w):
    row = np.concatenate([p, p[:, ::-1]], axis=1)
    blk = np.concatenate([row, row[::-1]], axis=0)
    reps = (h // blk.shape[0] + 1, w // blk.shape[1] + 1, 1)
    return np.tile(blk, reps)[:h, :w]
sea = mirrored_tile(patch, H - LINE, W)
edge = rgb[960:995]                                        # the painting's water at the old line
dark = edge.mean(axis=2) < np.percentile(edge.mean(axis=2), 60)
water = np.array([np.median(edge[..., c][dark]) for c in range(3)])
sea = sea - sea.reshape(-1, 3).mean(axis=0) + water
keep = gaussian_filter(real[LINE:].astype(float), 6)[..., None]   # feathered, so no hard join
fill = rgb.copy()
fill[LINE:] = rgb[LINE:] * keep + sea * (1 - keep)
# The plate's own padding down here is coarse in places (upscaled blocks around
# the tip of South America). Softened with depth, which also reads as mist.
soft = gaussian_filter(fill[LINE:], sigma=(2.0, 2.0, 0))
depth = np.clip((np.arange(LINE, H) - 985) / 80.0, 0, 1)[:, None, None]
fill[LINE:] = fill[LINE:] * (1 - depth) + soft * depth

# 3. The edge: the northern mist, turned upside down and shifted half a world so
#    it does not mirror the north, squeezed into LINE..END.
north = A[200:500].copy()
north[:, :40] = north[:, 40:41]          # the notch at the left edge is not part of the mist
north = np.roll(north[::-1, ::-1], W // 2, axis=1)   # now full at row 0, empty at the bottom
rows = np.linspace(0, north.shape[0] - 1, END - LINE)
mist = np.zeros((H - LINE, W))
lo = np.floor(rows).astype(int); hi = np.minimum(lo + 1, north.shape[0] - 1); t = rows - lo
mist[:END - LINE] = north[lo] * (1 - t)[:, None] + north[hi] * t[:, None]
mist[:4] = np.maximum(mist[:4], 1.0)      # joins the painting above without a seam

# Land below the old line — the tip of South America and the islands by it —
# is drawn as solidly as the land above it, with the mist closing round it,
# rather than being faded out with the water.
low = rgb[LINE:1090]
bright = low.mean(axis=2) > 95
warm = (low[..., 0] - low[..., 2] > 5) | (low.mean(axis=2) > 150)
land = np.zeros((H - LINE, W), bool)
land[:1090 - LINE] = bright & warm & real[LINE:1090] & (A[LINE:1090] == 0)
land = gaussian_filter(land.astype(float), 5)
mist = np.maximum(mist, np.clip(land * 2.2, 0, 1))

# 4. The compass rose, cartouche and sea creatures keep their own pixels exactly;
#    only what was see-through around them now shows mist instead of imagery.
out = im.copy()
ad = A[LINE:]
aout = ad + mist * (1 - ad)
num = rgb[LINE:] * ad[..., None] + fill[LINE:] * (mist * (1 - ad))[..., None]
out[LINE:, :, :3] = np.where(aout[..., None] > 0, num / np.maximum(aout, 1e-6)[..., None], rgb[LINE:])
out[LINE:, :, 3] = aout * 255
Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8)).save(SRC, "WEBP", quality=92, alpha_quality=100, method=6)

# checks
new = out
dec = (A[LINE:] > 0.98)
print("decoration pixels unchanged:", np.abs(new[LINE:][dec] - im[LINE:][dec]).max())
print("above the line unchanged:", np.abs(new[:LINE] - im[:LINE]).max())
print("rows below END transparent except decorations:", float((new[END:, :, 3][A[END:] == 0]).max()))
