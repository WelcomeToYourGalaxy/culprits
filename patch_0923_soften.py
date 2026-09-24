#!/usr/bin/env python3
"""
patch_0923_soften.py - the Satellite basemap a little less saturated and a
                       little less shadowed. Needs patch_0923_matte.py first.

Run from the culprits folder:  python3 patch_0923_soften.py
"""
import pathlib, sys

APP = [
('''               "raster-saturation": 0.15, "raster-contrast": 0.16,''',
 '''               "raster-saturation": 0.05, "raster-contrast": 0.16,'''),
('''  //   shade    strong, matte: shadows up to 0.75, pale grey-white lights up to
  //            0.18; a broad second light for wide views only.''',
 '''  //   shade    matte: shadows up to 0.6, pale grey-white lights up to 0.18;
  //            a broad second light for wide views only (shadow 0.35).
  //            23 September, last: saturation 0.05 and shadows eased, as the
  //            owner found the matte version a little too saturated and dark.'''),
('''    "hillshade-shadow-color": ["rgba(10,14,14,0.3)", "rgba(10,14,14,0.75)", "rgba(10,14,14,0.3)", "rgba(10,14,14,0.1)"],''',
 '''    "hillshade-shadow-color": ["rgba(10,14,14,0.24)", "rgba(10,14,14,0.6)", "rgba(10,14,14,0.24)", "rgba(10,14,14,0.08)"],'''),
('''    "hillshade-shadow-color": "rgba(10,14,14,0.45)",''',
 '''    "hillshade-shadow-color": "rgba(10,14,14,0.35)",'''),
]

TEST = [
(r'''"raster-saturation": 0\.15, "raster-contrast": 0\.16/''',
 r'''"raster-saturation": 0\.05, "raster-contrast": 0\.16/'''),
(r'''    check("…matte shading weighted to one low north-west light: shadows up to 0.75, lights at most 0.18, both layers lighter at world view; fog at the horizon",
          /"rgba\(10,14,14,0\.75\)"/.test(block) &&''',
 r'''    check("…matte shading weighted to one low north-west light: shadows up to 0.6, lights at most 0.18, both layers lighter at world view; fog at the horizon",
          /"rgba\(10,14,14,0\.6\)"/.test(block) && !/"rgba\(10,14,14,0\.(6[1-9]|[7-9])/.test(block) &&'''),
]

def patch(path, pairs):
    s = path.read_text(encoding="utf-8")
    for old, new in pairs:
        if s.count(old) != 1:
            sys.exit(f"{path}: a line this patch changes is not as expected. Nothing changed.")
        s = s.replace(old, new)
    return s

def main():
    app, test = pathlib.Path("map/app.js"), pathlib.Path("map/test.mjs")
    if not app.exists() or not test.exists():
        sys.exit("Run this from the culprits folder (the one with map/app.js).")
    s = app.read_text(encoding="utf-8")
    if '"raster-saturation": 0.05, "raster-contrast": 0.16' in s:
        sys.exit("Already applied. Nothing changed.")
    if '"raster-contrast": 0.16' not in s:
        sys.exit("patch_0923_matte.py has to be applied first.")
    a, t = patch(app, APP), patch(test, TEST)
    app.write_text(a, encoding="utf-8")
    test.write_text(t, encoding="utf-8")
    print("Applied. Changed: map/app.js, map/test.mjs")

main()
