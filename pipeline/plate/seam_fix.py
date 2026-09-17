#!/usr/bin/env python3
"""
The plate's two edges, made to meet.

On the globe the chart's eastern and western edges meet in the Pacific, and
they were never drawn to join: the compass rose split across the two edges sits
a few pixels out, a sea serpent and a cloud plume stop dead at the edge, and
the misty top and bottom edges reach different rows on either side.

This makes them meet: the rose is made symmetric about the seam, the water and
cloud within about forty pixels of it is drawn into the plate's own open water
so nothing ends on a straight cut, painted land is left alone, and the see-
through edges are blended so the mist runs across the join at the same height.

Run once from the repo root:  python3 pipeline/plate/seam_fix.py
"""
import pathlib
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "map" / "atlas-plate.webp"

im = np.array(Image.open(SRC).convert("RGBA")).astype(np.float64)
H, W = im.shape[:2]
rgb, A = im[:, :, :3].copy(), im[:, :, 3].copy()

if np.abs(rgb[:, 0] - rgb[:, W - 1]).mean() < 6 and np.abs(A[:, 0] - A[:, W - 1]).mean() < 6:
    sys.exit("The plate's two edges already meet — nothing to do.")

ROSE = (640, 860)          # the rows the split compass rose sits in
ROSE_HALF = 90             # how far it reaches either side of the seam
VEIL = 45                  # how far the water is drawn together
FADE = 70                  # how far the see-through edges are blended

# 1. The rose: the western half becomes the mirror of the eastern half, so the
#    two halves are one rose again.
r0, r1 = ROSE
mirror = rgb[r0:r1, W - ROSE_HALF:][:, ::-1]
mirrorA = A[r0:r1, W - ROSE_HALF:][:, ::-1]
w = np.clip(1 - np.arange(ROSE_HALF) / ROSE_HALF, 0, 1) ** 0.7
rows = np.arange(r0, r1)
ends = np.clip(np.minimum(rows - r0, r1 - 1 - rows) / 25.0, 0, 1)[:, None]
weight = (w[None, :] * ends)[..., None]
rgb[r0:r1, :ROSE_HALF] = rgb[r0:r1, :ROSE_HALF] * (1 - weight) + mirror * weight
A[r0:r1, :ROSE_HALF] = A[r0:r1, :ROSE_HALF] * (1 - weight[..., 0]) + mirrorA * weight[..., 0]

# 2. Water and cloud near the seam are drawn into the plate's own open water,
#    so a serpent or a cloud fades out instead of being cut off. Painted land
#    keeps its own pixels: land does meet across the date line.
patch = rgb[650:720, 120:230]                       # open Pacific, no lines or creatures
tile = np.concatenate([patch, patch[:, ::-1]], axis=1)
tile = np.concatenate([tile, tile[::-1]], axis=0)
sea = np.tile(tile, (H // tile.shape[0] + 1, 1, 1))[:H, :2 * VEIL]
band = np.concatenate([rgb[:, W - VEIL:], rgb[:, :VEIL]], axis=1)
bandA = np.concatenate([A[:, W - VEIL:], A[:, :VEIL]], axis=1)
bright = band.mean(axis=2)
water = (band[..., 2] + band[..., 1] > band[..., 0] * 2.3) & (bright < 125)
# Everything but painted land is drawn together: water, the pale cloud plumes
# and the dark ones. Land is sand and green — warmer than it is blue.
land = (band[..., 0] > band[..., 2] + 6) & (bright > 105)
soft = gaussian_filter((~land).astype(float), 4)[..., None]
# The tile is toned to the water beside the seam, row by row.
near = band[:, VEIL - 12:VEIL + 12]
nearw = water[:, VEIL - 12:VEIL + 12]
tone = np.array([[np.median(near[r][nearw[r]][..., c]) if nearw[r].any() else np.nan
                  for c in range(3)] for r in range(H)])
for c in range(3):
    col = tone[:, c]
    good = ~np.isnan(col)
    tone[:, c] = np.interp(np.arange(H), np.arange(H)[good], col[good]) if good.any() else 40
tone = gaussian_filter(tone, (25, 0))
sea = sea - sea.reshape(-1, 3).mean(axis=0) + tone[:, None, :]
d = np.abs(np.arange(2 * VEIL) - (VEIL - 0.5))
veil = np.clip(1 - d / VEIL, 0, 1)[None, :, None] ** 0.8
rose_rows = np.zeros((H, 1, 1))
rose_rows[r0:r1] = 1
veil = veil * soft * (1 - rose_rows)                          # the rose is left as it is
band = band * (1 - veil) + sea * veil
rgb[:, W - VEIL:] = band[:, :VEIL]
rgb[:, :VEIL] = band[:, VEIL:]

# 2b. The last few pixels either side are mixed with their mirror across the
#     seam, so colour runs across the join with nothing left to see.
JOIN = 14
j = np.arange(JOIN)
tj = 0.5 * (1 - j / JOIN)
wj, ej = rgb[:, :JOIN].copy(), rgb[:, W - JOIN:].copy()
rgb[:, :JOIN] = wj * (1 - tj[None, :, None]) + ej[:, ::-1] * tj[None, :, None]
rgb[:, W - JOIN:] = ej * (1 - tj[::-1][None, :, None]) + wj[:, ::-1] * tj[::-1][None, :, None]

# 3. The see-through top and bottom edges: blended so the mist crosses the join
#    at the same height on both sides.
x = np.arange(FADE)
t = 0.5 * (1 - x / FADE)                                      # half and half at the seam
west, east = A[:, :FADE].copy(), A[:, W - FADE:].copy()
A[:, :FADE] = west * (1 - t) + east[:, ::-1] * t
A[:, W - FADE:] = east * (1 - t[::-1]) + west[:, ::-1] * t[::-1]

out = np.dstack([np.clip(rgb, 0, 255), np.clip(A, 0, 255)])
Image.fromarray(out.round().astype(np.uint8)).save(SRC, "WEBP", quality=92, alpha_quality=100, method=6)
print("edge difference now:", round(float(np.abs(out[:, 0, :3] - out[:, W - 1, :3]).mean()), 2),
      "colour,", round(float(np.abs(out[:, 0, 3] - out[:, W - 1, 3]).mean()), 2), "alpha")
