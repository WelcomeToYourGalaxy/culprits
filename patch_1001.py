#!/usr/bin/env python3
"""
Buildings move to their own repo, and retired layers stop being rebuilt.

Run from the repo root:  python3 patch_1001.py

Needs patch_0930.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js                      Buildings reads culprits-buildings, not
                                  culprits-tiles-more.
  pipeline/shapes/registry.json   The thirteen shape layers taken off the panel
                                  are marked retired.
  pipeline/shapes/build_shapes.py A retired layer is skipped unless it is named
                                  on the command line.
  map/test.mjs                    Two checks for where Buildings reads from.
  HANDOFF.md                      Where the archives live, repo by repo.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 8f18aca..50f4d32 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -83,6 +83,35 @@ Worker: `https://culprits-proxy.welcometoyourgalaxy.workers.dev`
 
 ---
 
+## Where the archives live, and why they are spread across repos
+
+A published Pages site is capped at 1 GB, so the archives sit in whichever repo
+has room, each with its own Pages site:
+
+- `culprits/map/tiles/` — the small ones and anything the map needs at once.
+- `culprits-tiles-more` — most of the daily-rebuilt archives, shapes, sitemaps.
+- `culprits-buildings` — the building archives (about 700 MB), one per kind.
+  Rebuilt weekly there by `scripts/building_types.py`, which runs this repo's
+  `pipeline/building_types.py`. Each save replaces that repo's history with one
+  commit, so it stays the size of what it publishes.
+- `culprits-tiles-ag` and `culprits-tiles-flu` — the Climate TRACE agriculture
+  and forestry archives, too big for the first repo.
+- `culprits-tiles-gov` — the government-building archives the separate rows
+  read. Those rows are inside Buildings now, so most of it is unread; worth
+  clearing when that repo starts to matter.
+
+The map finds each kind of building beside its summary (`base` in
+`addBuildingTypesLayer`), so moving the set again means changing `summaryUrl`
+alone.
+
+Layers taken off the panel are marked `"retired": true` in
+`pipeline/shapes/registry.json`, so `build_shapes.py` stops rebuilding them,
+and their published files are deleted by `scripts/retire.py` in
+`culprits-tiles-more`. That freed about 483 MB of rows that had been merged
+into Buildings or removed on request.
+
+---
+
 ## How data reaches the map — five routes
 
 Set per layer in `map/app.js` as `route:`.
diff --git a/map/app.js b/map/app.js
index 9fb1835..646795f 100644
--- a/map/app.js
+++ b/map/app.js
@@ -6646,7 +6646,9 @@ const OTHER_MAPS = {
       cities: [["antananarivo", "Antananarivo, Madagascar"], ["auckland", "Auckland, New Zealand"], ["baku", "Baku, Azerbaijan"], ["bogota", "Bogotá, Colombia"], ["brasilia", "Brasília, Brazil"], ["cape_town", "Cape Town, South Africa"], ["chengdu", "Chengdu, China"], ["colombo", "Colombo, Sri Lanka"], ["dar_es_salaam", "Dar es Salaam, Tanzania"], ["davao", "Davao, Philippines"], ["durban", "Durban, South Africa"], ["esfahan", "Esfahan, Iran"], ["guadalajara", "Guadalajara, Mexico"], ["guayaquil", "Guayaquil, Ecuador"], ["hongknog_shenzhen_quangzhou", "Hongkong-Shenzhen-Guangzhou, China"], ["honolulu", "Honolulu, United States"], ["houston", "Houston, United States"], ["jakarta", "Jakarta, Indonesia"], ["lagos", "Lagos, Nigeria"], ["los_angeles", "Los Angeles, United States"], ["makassar", "Makassar, Indonesia"], ["mecca", "Mecca, Saudi Arabia"], ["mexico_city", "Mexico City, Mexico"], ["nairobi", "Nairobi, Kenya"], ["osaka", "Osaka, Japan"], ["perth", "Perth, Australia"], ["port-au-prince", "Port-au-Prince, Haiti"], ["rawalpindi", "Rawalpindi, Pakistan"], ["santiago", "Santiago, Chile"], ["sao_paulo", "São Paulo, Brazil"], ["sydney", "Sydney, Australia"], ["tashkent", "Tashkent, Uzbekistan"], ["tel_aviv", "Tel Aviv, Israel"]],
       note: "The Atlas's 33 hotspot cities; each is placed from its name through a weekly OpenStreetMap lookup, and its box links the Atlas's own page." },
     { id: "building_types", name: "Buildings", unit: "places", colour: "#6A6258", route: "buildings", ready: true, lazy: true,
-      archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/building_types.pmtiles", summaryUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/building_types.json",
+      // Their own repo and Pages site: a site is capped at 1 GB and these are
+      // about 700 MB. See culprits-buildings.
+      archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-buildings/tiles/building_types.pmtiles", summaryUrl: "https://welcometoyourgalaxy.github.io/culprits-buildings/tiles/building_types.json",
       note: "Every building in the executive, financial, legal, legislative, judicial, anti-slavery and activist-rights maps' files, one record per place: where two files describe the same place, the fuller record leads and every field the other adds is kept." },
     { id: "owid_interest", name: "Share of government spending going to interest payments (Our World in Data)", unit: "% of spending", colour: "#6E5F52", route: "owidgrapher", ready: true, lazy: true,
       slug: "share-of-government-expenditure-going-to-interest-payments",
diff --git a/map/test.mjs b/map/test.mjs
index 810da03..f49a65e 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2054,6 +2054,10 @@ console.log("\nBuildings");
   check("each kind is its own archive, loaded when ticked; an older single archive still reads", /files\[t\]/.test(src) && /const single = !Object\.keys\(files\)\.length/.test(src));
   check("Buildings is held at the foot of the layers box", /sec\.classList\.add\("toc-pinned"\)/.test(src) && /#layers \.toc-pinned\{position:sticky;bottom:14px/.test(src));
   check("the sources-in-progress line is gone", !/more sources in progress/.test(src));
+  check("the archives are read from the buildings repo, off the crowded one",
+        /culprits-buildings\/tiles\/building_types\.json/.test(src) && !/culprits-tiles-more\/tiles\/building_types/.test(src));
+  check("each kind's archive is found beside the summary, so moving them moves both",
+        /const base = cfg\.summaryUrl\.replace\(\/\[\^\/\]\+\$\/, ""\)/.test(src));
   check("the outline map has a sea sheet, so it is a card in the stars", /id: "outline-ocean", type: "fill"/.test(src) && /show\("outline-ocean", !imagery\)/.test(src));
 }
 
diff --git a/pipeline/shapes/build_shapes.py b/pipeline/shapes/build_shapes.py
index 10d1e13..88a0be7 100644
--- a/pipeline/shapes/build_shapes.py
+++ b/pipeline/shapes/build_shapes.py
@@ -440,6 +440,11 @@ def main():
     for e in REG:
         if wanted and e["id"] not in wanted:
             continue
+        # A layer the map no longer shows is not rebuilt. Its files were taking
+        # room on a Pages site that is capped at 1 GB, and nothing read them.
+        # Naming it on the command line still builds it.
+        if e.get("retired") and not wanted:
+            continue
         try:
             feats, missing = KINDS[e["kind"]](e)
         except Exception as ex:
diff --git a/pipeline/shapes/registry.json b/pipeline/shapes/registry.json
index 69e8372..5ca8554 100644
--- a/pipeline/shapes/registry.json
+++ b/pipeline/shapes/registry.json
@@ -1,5 +1,5 @@
 {
- "_note": "Every non-point feature of the site's maps — country shading, regions, lines — plus maps whose whole content is read here. Built into map/data/shapes/<id>.geojson by build_shapes.py and drawn by the map's shapes route. kind: geojson (the repo's own file), extract (the map's scripts, via ../sitemaps/extract.mjs), records_by_iso and tree (country-keyed data joined to country outlines), routes (country-to-country lines between the outlines' centres, as the anti-slavery map draws them), enviro_files (one file per country or region).",
+ "_note": "Every non-point feature of the site's maps — country shading, regions, lines — plus maps whose whole content is read here. Built into map/data/shapes/<id>.geojson by build_shapes.py and drawn by the map's shapes route. kind: geojson (the repo's own file), extract (the map's scripts, via ../sitemaps/extract.mjs), records_by_iso and tree (country-keyed data joined to country outlines), routes (country-to-country lines between the outlines' centres, as the anti-slavery map draws them), enviro_files (one file per country or region). retired: true means the map no longer shows this layer, so it is not rebuilt unless it is named on the command line.",
  "layers": [
   {
    "id": "gmo_cultivation",
@@ -78,6 +78,7 @@
   },
   {
    "id": "slavery_trackers",
+   "retired": true,
    "group": "MORE_MAPS",
    "kind": "tree",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/anti-slavery-map/main/trackerdata.json",
@@ -103,6 +104,7 @@
   },
   {
    "id": "legal_by_state",
+   "retired": true,
    "group": "LEGAL_MAP",
    "kind": "tree",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/legal-map/main/lmap_sub.json",
@@ -112,6 +114,7 @@
   },
   {
    "id": "judicial_by_state",
+   "retired": true,
    "group": "JUD_MAP",
    "kind": "tree",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/judicial-map/main/judicial_sub_data.json",
@@ -121,6 +124,7 @@
   },
   {
    "id": "leg_by_state",
+   "retired": true,
    "group": "LEG_MAP",
    "kind": "tree",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/legislative-map/main/legmap_sub.json",
@@ -130,6 +134,7 @@
   },
   {
    "id": "leg_subnational",
+   "retired": true,
    "group": "LEG_MAP",
    "kind": "tree",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/legislative-map/main/legmap_subnational.json",
@@ -139,6 +144,7 @@
   },
   {
    "id": "leg_county",
+   "retired": true,
    "group": "LEG_MAP",
    "kind": "tree",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/legislative-map/main/legmap_county.json",
@@ -148,6 +154,7 @@
   },
   {
    "id": "leg_municipal",
+   "retired": true,
    "group": "LEG_MAP",
    "kind": "tree",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/legislative-map/main/legmap_municipal.json",
@@ -157,6 +164,7 @@
   },
   {
    "id": "leg_municipal_recover",
+   "retired": true,
    "group": "LEG_MAP",
    "kind": "tree",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/legislative-map/main/legmap_municipal_recover.json",
@@ -166,6 +174,7 @@
   },
   {
    "id": "leg_laws",
+   "retired": true,
    "group": "LEG_MAP",
    "kind": "tree",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/legislative-map/main/laws.json",
@@ -175,6 +184,7 @@
   },
   {
    "id": "enviro_law_by_country",
+   "retired": true,
    "group": "SITE_MAPS",
    "kind": "enviro_files",
    "repo": "WelcomeToYourGalaxy/enviro-atlas",
@@ -231,6 +241,7 @@
   },
   {
    "id": "site_environment_law_shapes",
+   "retired": true,
    "group": "SITE_MAPS",
    "kind": "extract",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/enviro-atlas/main/destruction-environment-law-map.html",
@@ -241,6 +252,7 @@
   },
   {
    "id": "site_export_credit_shading",
+   "retired": true,
    "group": "SITE_MAPS",
    "kind": "extract",
    "shapes_only": true,
@@ -252,6 +264,7 @@
   },
   {
    "id": "gov_official_map",
+   "retired": true,
    "group": "SITE_MAPS",
    "kind": "extract",
    "url": "https://raw.githubusercontent.com/WelcomeToYourGalaxy/become-a-gov-official/main/index.html",
'''


def git(*args, **kw):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True, **kw)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if "culprits-buildings/tiles/building_types.json" in app:
        print("Already applied - nothing to do.")
        return
    if "cerulean_slicks" not in app:
        sys.exit("patch_0930.py has to go in first.")
    if git("apply", "--check", "-").returncode:
        r = git("apply", "--check", "-")
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
