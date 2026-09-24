#!/usr/bin/env python3
"""
patch_0923_matte.py - the Satellite relief: mountains crisp and matte instead
                      of smooth plastic, and the world view less overcast.
                      Everything else as it is.

Run from the culprits folder:  python3 patch_0923_matte.py
"""
import pathlib, sys

APP = [
# imagery: a little more contrast, so rock and scree texture reads
('''  satellite: { "raster-brightness-min": 0.0, "raster-brightness-max": 1,
               "raster-saturation": 0.15, "raster-contrast": 0.08,''',
 '''  satellite: { "raster-brightness-min": 0.0, "raster-brightness-max": 1,
               "raster-saturation": 0.15, "raster-contrast": 0.16,'''),
# comment
('''  //   shade    strong, matte: shadows up to 0.75, pale grey-white lights up to
  //            0.3, as in the plates; a broad second light for wide views only.''',
 '''  //   shade    strong, matte: shadows up to 0.75, pale grey-white lights up to
  //            0.18; a broad second light for wide views only.
  //            23 September, later: the mountains read as smooth plastic. The
  //            light is weighted harder to one low north-west sun (the other
  //            three lights' shadows cut to 0.3 and under), and the lights
  //            dimmed, so ridges read crisp and matte rather than rounded and
  //            glossy; imagery contrast 0.16 so the rock's own texture shows.
  //            The world view read overcast: both shade layers are lighter
  //            there (0.8 and 0.4 at zoom 2), back to full by zoom 5.'''),
('''    "hillshade-illumination-altitude": [30, 35, 30, 50],
    "hillshade-highlight-color": ["rgba(238,238,230,0.18)", "rgba(238,238,230,0.3)", "rgba(238,238,230,0.15)", "rgba(238,238,230,0.05)"],
    "hillshade-shadow-color": ["rgba(10,14,14,0.5)", "rgba(10,14,14,0.75)", "rgba(10,14,14,0.5)", "rgba(10,14,14,0.25)"],''',
 '''    "hillshade-illumination-altitude": [30, 28, 30, 50],
    "hillshade-highlight-color": ["rgba(238,238,230,0.08)", "rgba(238,238,230,0.18)", "rgba(238,238,230,0.06)", "rgba(238,238,230,0)"],
    "hillshade-shadow-color": ["rgba(10,14,14,0.3)", "rgba(10,14,14,0.75)", "rgba(10,14,14,0.3)", "rgba(10,14,14,0.1)"],'''),
('''"hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 2, 1, 8, 0.9, 12, 0.7, 16, 0.45],''',
 '''"hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 2, 0.8, 5, 1, 8, 0.9, 12, 0.7, 16, 0.45],'''),
('''"hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 5, 0.35, 8, 0],''',
 '''"hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 2, 0.4, 5, 0.35, 8, 0],'''),
]

TEST = [
(r'''"raster-saturation": 0\.15, "raster-contrast": 0\.08/''',
 r'''"raster-saturation": 0\.15, "raster-contrast": 0\.16/'''),
(r'''    check("…strong matte shading: shadows up to 0.75, pale lights up to 0.3, the second light wide views only; fog at the horizon",
          /"rgba\(10,14,14,0\.75\)"/.test(block) && /"rgba\(238,238,230,0\.3\)"/.test(block) &&
          /"hillshade-exaggeration": \["interpolate", \["linear"\], \["zoom"\], 2, 1, 8, 0\.9, 12, 0\.7, 16, 0\.45\]/.test(block) &&
          /"hillshade-exaggeration": \["interpolate", \["linear"\], \["zoom"\], 2, 0\.6, 5, 0\.35, 8, 0\]/.test(block) &&''',
 r'''    check("…matte shading weighted to one low north-west light: shadows up to 0.75, lights at most 0.18, both layers lighter at world view; fog at the horizon",
          /"rgba\(10,14,14,0\.75\)"/.test(block) && /"rgba\(238,238,230,0\.18\)"/.test(block) &&
          !/"rgba\(238,238,230,0\.(19|[2-9])/.test(block) &&
          /"hillshade-illumination-altitude": \[30, 28, 30, 50\]/.test(block) &&
          /"hillshade-exaggeration": \["interpolate", \["linear"\], \["zoom"\], 2, 0\.8, 5, 1, 8, 0\.9, 12, 0\.7, 16, 0\.45\]/.test(block) &&
          /"hillshade-exaggeration": \["interpolate", \["linear"\], \["zoom"\], 2, 0\.4, 5, 0\.35, 8, 0\]/.test(block) &&'''),
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
    if '"raster-contrast": 0.16' in app.read_text(encoding="utf-8"):
        sys.exit("Already applied. Nothing changed.")
    a, t = patch(app, APP), patch(test, TEST)   # both checked before either is written
    app.write_text(a, encoding="utf-8")
    test.write_text(t, encoding="utf-8")
    print("Applied. Changed: map/app.js, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")

main()
