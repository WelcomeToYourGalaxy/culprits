#!/usr/bin/env python3
"""patch_0920k.py - plumes visible from the world view; the last twenty-three
sources named.

    cd ~/Desktop/culprits
    python3 patch_0920k.py

Goes on top of c3586d4 (the reload row and Carbon Mapper's paging), which is
what is on the remote now.

1. The plumes only showed close in. Tens of thousands of them, most in a few
   basins, each a dot two pixels across: from any distance the layer read as
   empty. Where they crowd they are now merged into one point carrying how many
   it stands for - the way the mines already work - so the basins show from the
   world view. Nothing is dropped to make them show: from zoom 6 in every plume
   is its own point again, with its rate and its picture, and clicking a merged
   point says how many are under it. Unticking the row clears both.

2. The twenty-three rows that named no source now carry one, taken from what
   each row already fetches rather than from anything I assumed: Global Plastic
   Watch, Seas of Plastic, Global Forest Watch, the Atlas for the End of the
   World, Portfolio Earth's two campaigns, SkyTruth Monitor, Deforestation Free
   Funds, They Rule, the CFR tracker, Troutwood, Global Trade Alert, Giga, ESA,
   the Power BI report, Google My Maps for the pet food map, and your own repo
   for the fertilizer plants, the soy bodies, the capture map, the biosignature
   map and the buildings. Five titles that said nothing about where they come
   from now say it. If "(Welcome to Your Galaxy)" is the wrong form for those
   five, name what you want instead and it is one line each.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index e4ed9c9..fb471d1 100644
--- a/map/app.js
+++ b/map/app.js
@@ -250,8 +250,8 @@ const LAYERS = [
   // once map/tiles/<id>.pmtiles exists, or once a harvester is registered.
   { id:"carbon_majors",        name:"Carbon major HQs",        unit:"company headquarters", colour:"#7E6B8F", route:"pmtiles", ready:true, off: true,
     note: "From the Destruction page's Carbon Majors headquarters map (maps repo): the addresses written into that map." },
-  { id:"fertilizer_facilities",name:"Fertilizer plants",       unit:"ammonia / urea", colour:"#8A7C5C", route:"pmtiles", ready:true, off: true },
-  { id:"soy_organizations",    name:"Soy industry bodies",     unit:"trade organisations", colour:"#6F7F72", route:"pmtiles", ready:true, off: true },
+  { id:"fertilizer_facilities",name:"Fertilizer plants (Welcome to Your Galaxy)",       unit:"ammonia / urea", colour:"#8A7C5C", route:"pmtiles", ready:true, off: true },
+  { id:"soy_organizations",    name:"Soy industry bodies (Welcome to Your Galaxy)",     unit:"trade organisations", colour:"#6F7F72", route:"pmtiles", ready:true, off: true },
   { id:"trase",                name:"Commodity supply chains", unit:"ha",         colour:"#62755F", route:"pmtiles", ready:false },
   { id:"land_matrix",          name:"Land deals (Land Matrix)",              unit:"hectares",   colour:"#6C7F63", route:"country", ready:true, off: true,  isolate:true },
   { id:"counterglow",          name:"Industrial animal farms", unit:"facilities", colour:"#7B7A5C", route:"pmtiles", ready:false },
@@ -3411,22 +3411,41 @@ function columnEdge() {
 // all of it.
 const CARBON_PLUME_ZOOM = 10;     // from here in, the plumes' own pictures
 const CARBON_PLUME_PAGES = 10;    // 1,000 plumes a page
+const CARBON_CLUSTER_TO = 6;      // to here, crowded plumes are merged and counted
 const CARBON_PAGES_AT_ONCE = 3;    // after the first, which is drawn on its own
 const CARBON_PICTURES_AT_ONCE = 40;
 async function addCarbonMapperLayer(cfg) {
   const src = `${cfg.id}-src`;
+  // Tens of thousands of plumes, most of them in a few basins, each a dot two
+  // pixels across at world view: from any distance the layer read as empty.
+  // Where they crowd they are merged into one point that says how many it
+  // stands for, the way the mines already work, so the basins show from the
+  // world view and nothing is dropped to make them show. From
+  // CARBON_CLUSTER_TO in, every plume is its own point again.
   map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] },
+    cluster: true, clusterMaxZoom: CARBON_CLUSTER_TO, clusterRadius: 30,
     attribution: cfg.attribution || "" });
+  map.addLayer({ id: `${cfg.id}-cl`, type: "circle", source: src, filter: ["has", "point_count"],
+    paint: {
+      "circle-color": cfg.colour, "circle-opacity": 0.75,
+      "circle-radius": ["interpolate", ["linear"], ["zoom"],
+        1, ["+", 3, ["*", 2.2, ["log10", ["max", ["get", "point_count"], 1]]]],
+        CARBON_CLUSTER_TO, ["+", 4, ["*", 2.6, ["log10", ["max", ["get", "point_count"], 1]]]]],
+      "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5 } });
+  bindHtmlPopup(`${cfg.id}-cl`, (p) =>
+    `<b>${Number(p.point_count).toLocaleString()} plumes here</b>` +
+    `<div class="meta">Merged at this zoom. Zoom in to see each one, its rate and its picture.</div>` +
+    `<div class="meta">Carbon Mapper data platform</div>`);
   // Sized by the emission rate Carbon Mapper measured, which is the one number
   // that says how much this plume matters; unmeasured plumes keep the base size.
-  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src,
+  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, filter: ["!", ["has", "point_count"]],
     paint: {
       "circle-color": ["case", ["==", ["get", "gas"], "CO2"], "#6E6358", cfg.colour],
-      "circle-opacity": 0.8,
+      "circle-opacity": 0.85,
       "circle-radius": ["interpolate", ["linear"], ["zoom"],
-        1, ["+", 1.8, ["*", 0.7, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]],
-        9, ["+", 3, ["*", 1.4, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]]],
-      "circle-stroke-color": "#17150F", "circle-stroke-width": 0.4 } });
+        1, ["+", 2.6, ["*", 0.8, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]],
+        9, ["+", 3.4, ["*", 1.4, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]]],
+      "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5 } });
   const num = (v, unit) => (v === null || v === undefined || v === "" || !isFinite(Number(v)) ? "" :
     `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}${unit}`);
   bindHtmlPopup(`${cfg.id}-pt`, (p) =>
@@ -6739,7 +6758,7 @@ const visibility = new Map(LAYERS.filter((c) => c.off).map((c) => [c.id, "none"]
 
 function applyVisibility(id) {
   const vis = visibility.get(id) || "visible";
-  [`${id}-agg`, `${id}-pt`, `${id}-fill`, `${id}-line`, `${id}-raster`, `${id}-world`, `${id}-cap`].forEach((l) => {
+  [`${id}-agg`, `${id}-cl`, `${id}-pt`, `${id}-fill`, `${id}-line`, `${id}-raster`, `${id}-world`, `${id}-cap`].forEach((l) => {
     if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
   });
   const cfg = LAYERS.find((l) => l.id === id);
@@ -6983,7 +7002,7 @@ const SITE_MAPS = {
       note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
     { id: "gov_official_map", name: "How to become a government official", unit: "countries and places", colour: "#5F6A66", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gov_official_map.geojson",
       note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
-    { id: "capture_map", name: "Drug underworld and capture map", unit: "places and areas", colour: "#6A5A5E", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/capture_map.geojson",
+    { id: "capture_map", name: "Drug underworld and capture map (Welcome to Your Galaxy)", unit: "places and areas", colour: "#6A5A5E", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/capture_map.geojson",
       note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
   ],
 };
@@ -7254,7 +7273,7 @@ const OTHER_MAPS = {
     { id: "space_industry", name: "The space industry (openmaps.space)", unit: "places", colour: "#5E6070", route: "geojsonlive", ready: true, lazy: true,
       files: [{ label: "Places", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/openmaps/space_industry.geojson" }],
       note: "openmaps.space's space industry map: every place it lists, with the organisations there, copied daily from its own data file." },
-    { id: "mymaps_supp_a", name: "Pet Food Companies", unit: "placemarks", colour: "#6A5E66", route: "kml", ready: true, lazy: true,
+    { id: "mymaps_supp_a", name: "Pet Food Companies (Google My Maps)", unit: "placemarks", colour: "#6A5E66", route: "kml", ready: true, lazy: true,
       kml: "https://www.google.com/maps/d/kml?mid=1vrnqSW4cWWdnjz6cJ-qFMmd0zbJzYd6V&forcekml=1",
       note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." },
     { id: "mymaps_supp_b", name: "Google My Maps map (Suppression page)", unit: "placemarks", colour: "#6A5E66", route: "kml", ready: true, lazy: true,
@@ -7365,7 +7384,7 @@ const OTHER_MAPS = {
     { id: "giga_countries", name: "Giga: school mapping by country", unit: "countries", colour: "#627A86", route: "giga", ready: true, lazy: true,
       data: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/giga/countries.json",
       note: "Giga's own figures for every country on its map, copied daily (its service does not let other sites read it)." },
-    { id: "biosignature", name: "Biosignature Evidence Assessment", unit: "opens it in a panel", colour: "#5E6070", route: "companion", ready: true, lazy: true,
+    { id: "biosignature", name: "Biosignature Evidence Assessment (Welcome to Your Galaxy)", unit: "opens it in a panel", colour: "#5E6070", route: "companion", ready: true, lazy: true,
       page: "https://welcometoyourgalaxy.github.io/maps/off-planet-invasion_embed_13_large-script.html",
       note: "Your own assessment from the Off-Planet Invasion page, whole, in the panel along the bottom." },
     { id: "leverage_chart", name: "The Leverage Chart", unit: "opens it in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
@@ -8232,6 +8251,29 @@ map.on("load", () => setTimeout(mymapsTitles, 50));
 // point at the repo or the page they are read from; everyone else's at their
 // own site. A row missing from here shows no link rather than a guessed one.
 const LAYER_SITE = {
+  atlas_cities: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/",
+  atlas_hotspots: "https://atlas-for-the-end-of-the-world.com/hotspots/",
+  biosignature: "https://github.com/WelcomeToYourGalaxy/maps",
+  building_types: "https://github.com/WelcomeToYourGalaxy",
+  capture_map: "https://github.com/WelcomeToYourGalaxy/maps",
+  dff: "https://deforestationfreefunds.org",
+  esa_risk: "https://neo.ssa.esa.int/risk-list-plots",
+  fertilizer_facilities: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/fertilizer_facilities.html",
+  gfw_catalogue: "https://www.globalforestwatch.org",
+  giga_countries: "https://giga.global",
+  gpw_map: "https://globalplasticwatch.org/map",
+  gta_acts: "https://globaltradealert.org",
+  mymaps_supp_a: "https://www.google.com/maps/d/viewer?mid=1vrnqSW4cWWdnjz6cJ-qFMmd0zbJzYd6V",
+  pe_bankrolling: "https://portfolio.earth/campaigns/bankrolling-extinction/",
+  pe_subsidising: "https://portfolio.earth/campaigns/subsidising-extinction/",
+  powerbi_report: "https://app.powerbi.com/view?r=eyJrIjoiZGJmNGIwODgtMTgyMS00NmVlLWJmNWUtZTAzZDBlMmQ1ODI2IiwidCI6IjBiMzNkZjAwLTYzNGMtNDBlYy1iOGQ5LTZhMGI2MjYyNmU1ZCJ9",
+  seas_of_plastic: "https://app.dumpark.com/seas-of-plastic-2/",
+  skytruth_monitor: "https://monitor.skytruth.org/",
+  skytruth_voc: "https://monitor.skytruth.org/",
+  soy_organizations: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/soy_organizations.html",
+  tableau_zsf: "https://public.tableau.com/shared/ZSF724HPQ",
+  theyrule: "https://theyrule.net/",
+  troutwood: "https://map.troutwood.com/",
   abattoir_facilities: "https://raw.githubusercontent.com/WelcomeToYourGalaxy/abattoir-atlas/main/out/facilities.json.gz",
   allen_coral: "https://allencoralatlas.org",
   atlas_cities: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/",
diff --git a/map/test.mjs b/map/test.mjs
index 0056897..7116e93 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2345,7 +2345,7 @@ console.log("\nOff-planet sections, Of groups, names, launch links, drag bar, ma
         at("To Earth") < at("Near-Earth object impacts") && at("Unidentified aerial phenomena") < at("From Earth") &&
         at("From Earth") < at("The space industry") && at("Space launches") < at("Protecting extraterrestrial life"));
   check("Fur Farms (Final Nail) is under Destruction, Of groups, Of animals", order.indexOf("final_nail") === at("Of animals") + 1 && at("Of animals") > at("Of groups") && /name: "Fur Farms \(Final Nail\)"/.test(src));
-  check("Pet Food Companies is under The pet industry", order.indexOf("mymaps_supp_a") === at("The pet industry") + 1 && /name: "Pet Food Companies"/.test(src));
+  check("Pet Food Companies is under The pet industry", order.indexOf("mymaps_supp_a") === at("The pet industry") + 1 && /name: "Pet Food Companies \(Google My Maps\)"/.test(src));
   check("each upcoming launch links to its own pages", /spacelaunchnow\.me\/launch\//.test(src) && /r\.info_urls/.test(src) && /ll2Links\(r\)/.test(src));
   check("page panels have a drag bar", /class="c-grab"/.test(src) && /ns-resize/.test(src));
   check("every point layer gets a geometric marker; the round one stays for clicks", /function addHud\(/.test(src) && /paint\(layer\.id, "circle-opacity", 0\)/.test(src));
@@ -2497,6 +2497,31 @@ console.log("\nthe reload row is not clipped, and covers nothing");
   check("its words are given the room to wrap", /\.reload-cap\{line-height:1\.2;max-width:none/.test(index));
 }
 
+console.log("\nplumes show from the world view; the last sources named");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("crowded plumes are merged into one counted point, and split again close in",
+        /cluster: true, clusterMaxZoom: CARBON_CLUSTER_TO/.test(src) &&
+        /const CARBON_CLUSTER_TO = 6;/.test(src) &&
+        /filter: \["has", "point_count"\]/.test(src) &&
+        /filter: \["!", \["has", "point_count"\]\]/.test(src));
+  check("a merged point says how many are under it", /plumes here<\/b>/.test(src));
+  check("hiding the row hides the merged points too", /`\$\{id\}-agg`, `\$\{id\}-cl`, `\$\{id\}-pt`/.test(src));
+  const sites = new Function(src.slice(src.indexOf("const LAYER_SITE = {"), src.indexOf("function siteLink(")) + "; return LAYER_SITE;")();
+  const was = ["fertilizer_facilities", "gpw_map", "seas_of_plastic", "gfw_catalogue", "atlas_hotspots",
+               "atlas_cities", "pe_subsidising", "powerbi_report", "skytruth_monitor", "skytruth_voc",
+               "soy_organizations", "dff", "theyrule", "pe_bankrolling", "tableau_zsf", "troutwood",
+               "gta_acts", "giga_countries", "capture_map", "mymaps_supp_a", "esa_risk", "biosignature",
+               "building_types"];
+  check("every one of the twenty-three carries a site", was.every((i) => /^https:\/\//.test(sites[i] || "")));
+  check("each points at the people who published it, not at this map's copy",
+        was.every((i) => !/welcometoyourgalaxy\.github\.io/.test(sites[i])));
+  check("the titles that said nothing about their source now say it",
+        /name:"Fertilizer plants \(Welcome to Your Galaxy\)"/.test(src) &&
+        /name:"Soy industry bodies \(Welcome to Your Galaxy\)"/.test(src) &&
+        /name: "Biosignature Evidence Assessment \(Welcome to Your Galaxy\)"/.test(src));
+}
+
 console.log("\nGlobal Safety Net fixes; My Maps titles");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
"""


def run(args, text=None):
    return subprocess.run(args, input=text, capture_output=True, text=True)


def main():
    if run(["git", "rev-parse", "--is-inside-work-tree"]).returncode != 0:
        sys.exit("Not a git repository. Run this from ~/Desktop/culprits.")
    try:
        app = open("map/app.js", encoding="utf-8").read()
    except OSError:
        sys.exit("map/app.js not found. Run this from the top of the repo.")
    if "CARBON_PAGES_AT_ONCE" not in app:
        sys.exit("patch_0920j.py has to be applied and committed first.")
    if run(["git", "apply", "--check", "--reverse", "-"], DIFF).returncode == 0:
        print("Already applied - nothing to do.")
        return
    check = run(["git", "apply", "--check", "-"], DIFF)
    if check.returncode != 0:
        print(check.stderr.strip())
        sys.exit("Does not apply cleanly.")
    out = run(["git", "apply", "-"], DIFF)
    if out.returncode != 0:
        print(out.stderr.strip())
        sys.exit("git apply failed.")
    print("Applied. Changed: map/app.js, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
