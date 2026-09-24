#!/usr/bin/env python3
"""patch_0920b.py - Trase's nine datasets become nine rows, filed by subject.

Apply from the top of the repo:

    cd ~/Desktop/culprits
    python3 patch_0920b.py

patch_0920.py must be applied and committed first - this patch touches the same
two files and will refuse if that one is missing.

What changes:

  - The one Facilities row with a dropdown of eight datasets becomes eight rows,
    each route "trasefac". They draw through the sitemap path, so the three
    concession datasets get real areas with their own edges instead of the
    dropdown's flat fill.
  - Every row carries its source in its title: "Palm oil mills, Indonesia
    (Trase)", "Wood pulp concessions 2015-2019, Indonesia (Trase)", and so on.
    The measures row becomes "Deforestation and supply-chain measures (Trase)".
  - All nine are filed under the map's own headings: the measures and the four
    pulp rows under Deforestation, palm mills, soy silos and cocoa cooperatives
    under Agriculture, the Brazilian slaughterhouses under Meat. They stay
    children of the trase_data group, which is what keeps them lazy and
    reachable by ensureLayer; with every child placed by id the empty group row
    drops into the hidden holder, the same way the site_ rows already work.
  - Each row carries the file name from the current manifest as a fallback, so
    a manifest that fails to answer does not leave the row fetching nothing.
  - The soy silos row's note carries Trase's own caveat: identified by an
    image-reading workflow they state is over 90 per cent accurate, so not a
    register and a share of the rows is wrong.
  - addTraseFacMenu and the trasefacmenu route go, nothing else used them.
  - kindOf gets a trase_ prefix rule, with the Brazilian slaughterhouses named
    separately as animal.

Three tests encoded the earlier decision that Trase should be one row - "Trase
is one row, its two layers named without the prefix", the row-existence check
and the placement check that looked for group:trase_data. All three are
rewritten here. To put the old single row back:

    python3 patch_0920b.py --undo
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 930fd9b..ddbb055 100644
--- a/map/app.js
+++ b/map/app.js
@@ -4488,36 +4488,6 @@ async function addGigaLayer(cfg) {
   buildLegend();
 }
 
-/* ---------- Trase facilities, from Trase's own menu ---------- */
-async function addTraseFacMenu(cfg) {
-  const src = `${cfg.id}-src`;
-  map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
-  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: src, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": cfg.colour, "fill-opacity": 0.45 } });
-  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: src, filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": "#1D1B17", "line-width": 0.5 } });
-  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": cfg.colour, "circle-radius": 4 } });
-  for (const l of [`${cfg.id}-fill`, `${cfg.id}-pt`]) bindHtmlPopup(l, (p) => p.h || "");
-  const show = async (type) => {
-    setLayerState(cfg.id, "reading Trase\u2026");
-    try {
-      const got = await readTraseFacilities({ ...cfg, facilityType: type });
-      map.getSource(src).setData({ type: "FeatureCollection", features: got.items.map((it) => ({ type: "Feature", geometry: it.geometry, properties: { h: it.h } })) });
-      setLayerState(cfg.id, `${got.items.length.toLocaleString()} ${cfg.types.find((t) => t[0] === type)[1]}`);
-    } catch (e) { setLayerState(cfg.id, `Trase did not answer (${e.message})`); }
-  };
-  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
-  const anchor = row && row.closest ? row.closest("label") : null;
-  if (anchor && anchor.after) {
-    const el = document.createElement("div");
-    el.className = "facet";
-    el.innerHTML = `<select aria-label="Facilities">${cfg.types.map(([k, l]) => `<option value="${k}">${escapeHtml(l)}</option>`).join("")}</select>`;
-    el.querySelector("select").addEventListener("change", (e) => show(e.target.value));
-    anchor.after(el);
-  }
-  await show(cfg.types[0][0]);
-  applyVisibility(cfg.id);
-  buildLegend();
-}
-
 /* ---------- the daily oil-slick archive, by month ---------- */
 async function addSlickArchive(cfg) {
   let index;
@@ -7203,18 +7173,51 @@ const TRASE_DATA = {
   group: true,
   ready: true,
   children: [
-      { id: "trase_measures", name: "Deforestation and supply-chain measures", unit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
+      { id: "trase_measures", name: "Deforestation and supply-chain measures (Trase)", unit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
         catalogue: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/catalogue.json", values: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/values",
         regions: "https://resources.trase.earth/data/trase-regions",
         attribution: "Trase (CC BY 4.0)",
         note: "Trase's own measures for every country, region level and year it publishes. Region shapes are read live from Trase; the values come from a copy reread weekly, because Trase does not let other sites read them." },
-      { id: "trase_facilities", name: "Facilities", unit: "facilities", colour: "#62755F", route: "trasefacmenu", ready: true, lazy: true,
-        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json",
-        types: [["brazil-facilities", "Brazil: slaughterhouses and animal-product facilities"], ["brazil-silos", "Brazil: soy silos and storage"],
-                ["cote-d-ivoire-cocoa-cooperatives", "C\u00f4te d'Ivoire: cocoa cooperatives"], ["indonesia-palm-oil-mills", "Indonesia: palm oil mills"],
-                ["indonesia-wood-pulp-mills", "Indonesia: wood pulp mills"], ["indonesia-wood-pulp-concessions-2015-2019", "Indonesia: wood pulp concessions, 2015\u20132019"],
-                ["indonesia-wood-pulp-concessions-2020-2022", "Indonesia: wood pulp concessions, 2020\u20132022"], ["indonesia-wood-pulp-concessions-2023-2024", "Indonesia: wood pulp concessions, 2023\u20132024"]],
-        note: "Trase's facilities maps, chosen from its own menu, read live from Trase's files (CC BY 4.0)." },
+      { id: "trase_meat_brazil", name: "Slaughterhouses and animal-product plants, Brazil (Trase)", unit: "facilities", colour: "#8C5548", route: "trasefac", ready: true, lazy: true,
+        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "brazil-facilities",
+        file: "2026-05-07-br_beef_logistics_map_v6.geo.json",
+        attribution: "Trase (CC BY 4.0)",
+        note: "Trase's map of Brazilian slaughterhouses and other animal-product facilities. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
+      { id: "trase_silos_brazil", name: "Soy silos and storage, Brazil (Trase)", unit: "silos and stores", colour: "#6E6A55", route: "trasefac", ready: true, lazy: true,
+        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "brazil-silos",
+        file: "silos_consolidated_capacity_website_brazil_2024_2_post.geo.json",
+        attribution: "Trase (CC BY 4.0)",
+        note: "About 9,300 Brazilian soy silos and processing sites with their owners. Trase identified them with an image-reading workflow it states is over 90% accurate, so this is not a register and a share of the rows is wrong. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
+      { id: "trase_cocoa_ivory", name: "Cocoa cooperatives, C\u00f4te d'Ivoire (Trase)", unit: "cooperatives", colour: "#6B5B4E", route: "trasefac", ready: true, lazy: true,
+        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "cote-d-ivoire-cocoa-cooperatives",
+        file: "IC2B_coopyear_clean.geo.json",
+        attribution: "Trase (CC BY 4.0)",
+        note: "Trase's list of Ivorian cocoa cooperatives. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
+      { id: "trase_palm_indonesia", name: "Palm oil mills, Indonesia (Trase)", unit: "mills", colour: "#62755F", route: "trasefac", ready: true, lazy: true,
+        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-palm-oil-mills",
+        file: "IDN_PO_mills_clean.geo.json",
+        attribution: "Trase (CC BY 4.0)",
+        note: "Trase's Indonesian palm oil mills, carrying the Universal Mill List id where it has one. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
+      { id: "trase_pulp_indonesia", name: "Wood pulp mills, Indonesia (Trase)", unit: "mills", colour: "#5F6E6A", route: "trasefac", ready: true, lazy: true,
+        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-mills",
+        file: "id_wood_mills_facilities_v2026_02_10.geo.json",
+        attribution: "Trase (CC BY 4.0)",
+        note: "Trase's Indonesian wood pulp mills. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
+      { id: "trase_pulp_concessions_2015", name: "Wood pulp concessions 2015\u20132019, Indonesia (Trase)", unit: "concessions", colour: "#6F7560", route: "trasefac", ready: true, lazy: true,
+        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-concessions-2015-2019",
+        file: "indonesia_wood_pulp_concessions_2015_2019_v2026_02_20.geo.json",
+        attribution: "Trase (CC BY 4.0)",
+        note: "The areas Trase records as wood pulp concessions over 2015\u20132019, drawn as areas. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
+      { id: "trase_pulp_concessions_2020", name: "Wood pulp concessions 2020\u20132022, Indonesia (Trase)", unit: "concessions", colour: "#5E6A63", route: "trasefac", ready: true, lazy: true,
+        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-concessions-2020-2022",
+        file: "indonesia_wood_pulp_concessions_2020_2022_v2026_02_20.geo.json",
+        attribution: "Trase (CC BY 4.0)",
+        note: "The areas Trase records as wood pulp concessions over 2020\u20132022, drawn as areas. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
+      { id: "trase_pulp_concessions_2023", name: "Wood pulp concessions 2023\u20132024, Indonesia (Trase)", unit: "concessions", colour: "#59665C", route: "trasefac", ready: true, lazy: true,
+        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-concessions-2023-2024",
+        file: "indonesia_wood_pulp_concessions_2023_2024_v2026_02_20.geo.json",
+        attribution: "Trase (CC BY 4.0)",
+        note: "The areas Trase records as wood pulp concessions over 2023\u20132024, drawn as areas. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
   ],
 };
 
@@ -7283,7 +7286,6 @@ function ensureLayer(cfg) {
       : cfg.route === "glw" ? Promise.resolve().then(() => addGlwLayer(cfg))
       : cfg.route === "arcgisdyn" ? addArcgisDynLayer(cfg)
       : cfg.route === "giga" ? addGigaLayer(cfg)
-      : cfg.route === "trasefacmenu" ? addTraseFacMenu(cfg)
       : cfg.route === "gta" ? addGtaLayer(cfg)
       : cfg.route === "ctair" ? addCtAirLayer(cfg)
       : cfg.route === "gsn" ? addGsnLayer(cfg)
@@ -7418,7 +7420,7 @@ const LAYER_KIND = {
   mines_global: ["insentient", "downstream"],
   slick_archive: ["animal", "downstream"],
   giga_countries: ["human", "upstream"],
-  trase_facilities: ["plant", "upstream"],
+  trase_meat_brazil: ["animal", "upstream"],
   biosignature: ["insentient", "downstream"],
   leverage_chart: ["human", "upstream"],
   cfr_tracker: ["human", "upstream"],
@@ -7517,6 +7519,9 @@ const KIND_PREFIXES = [
   ["slavery_", ["human", "downstream"]],
   ["remains_", ["human", "downstream"]],
   ["site_", ["human", "upstream"]],
+  // Trase's facilities rows are all plant commodities except the Brazilian
+  // slaughterhouses, which are named above; the measures row is named above too.
+  ["trase_", ["plant", "upstream"]],
 ];
 
 function kindOf(id) {
@@ -7944,13 +7949,14 @@ const PANEL_ORDER = [
   { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget",
   { h: 4, t: "Wastewater" }, "hydrowaste",
   { h: 4, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
-  { h: 3, t: "Deforestation" }, "soilgrids", "group:trase_data", "nusantara",
+  { h: 3, t: "Deforestation" }, "soilgrids", "trase_measures", "trase_pulp_indonesia",
+    "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023", "nusantara",
   { h: 4, t: "Global Forest Watch" }, "glad_loss", "group:forest_alerts", "gfw_catalogue",
   { h: 3, t: "Biodiversity loss" }, "gsn", "gsn_rankings", "allen_coral", "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report",
   { h: 3, t: "Mining" }, "mines_global",
   { h: 3, t: "Meat and agriculture" },
-  { h: 4, t: "Agriculture" }, "land_matrix", "palmwatch",
-  { h: 4, t: "Meat" }, "abattoir_facilities", "abattoir_cafo", "abattoir_glw", "cultivated_meat_laws",
+  { h: 4, t: "Agriculture" }, "land_matrix", "palmwatch", "trase_palm_indonesia", "trase_silos_brazil", "trase_cocoa_ivory",
+  { h: 4, t: "Meat" }, "abattoir_facilities", "trase_meat_brazil", "abattoir_cafo", "abattoir_glw", "cultivated_meat_laws",
   { h: 3, t: "Oceans" },
   { h: 4, t: "Fishing" }, "fishing",
   { h: 4, t: "Oil slicks" },
diff --git a/map/test.mjs b/map/test.mjs
index a35287b..19a7e1f 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1959,10 +1959,10 @@ console.log("\nwhat was still open");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   check("the EPA widget's facilities are drawn live from EPA's service", /id: "epa_widget"[^\n]*route: "arcgisdyn"/.test(src) && /EMEF\/efpoints\/MapServer/.test(src) && /\/identify\?geometry=/.test(src));
-  check("Giga by country, Trase facilities, and two of your own are rows", ["giga_countries", "trase_facilities", "biosignature", "leverage_chart"].every((i) => new RegExp(`id: "${i}"`).test(src)));
+  check("Giga by country, Trase's facilities rows, and two of your own are rows", ["giga_countries", "trase_meat_brazil", "trase_palm_indonesia", "biosignature", "leverage_chart"].every((i) => new RegExp(`id: "${i}"`).test(src)));
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const order = new Function(body + "; return PANEL_ORDER;")();
-  check("the waiting rows are placed", ["ejatlas", "group:trase_data", "nusantara", "gfw_catalogue", "gsn", "seas_of_plastic", "coastal_cleanup", "mines_global", "atlas_hotspots", "final_nail", "group:ct_history"].every((i) => order.includes(i)));
+  check("the waiting rows are placed", ["ejatlas", "trase_measures", "nusantara", "gfw_catalogue", "gsn", "seas_of_plastic", "coastal_cleanup", "mines_global", "atlas_hotspots", "final_nail", "group:ct_history"].every((i) => order.includes(i)));
 }
 
 console.log("\nvessels of concern drawn; the oil-slick archive");
@@ -2193,9 +2193,27 @@ console.log("\nrows gathered, moved and renamed");
         /GLAD-L, GLAD-S2 and RADD/.test(src) && (src.match(/DIST-ALERT/g) || []).length >= 2 &&
         ["gfw", "gfw_dist", "gfw_dist_year"].every((i) => !order.includes(i)));
   check("Global Forest Change is drawn above the alerts", order.indexOf("glad_loss") < order.indexOf("group:forest_alerts"));
-  check("Trase is one row, its two layers named without the prefix",
-        /name: "Trase deforestation data"/.test(src) && /const TRASE_DATA = \{[\s\S]{0,4000}id: "trase_facilities"/.test(src) &&
-        !/name: "Trase: /.test(src));
+  // The titles are compared as they are written in app.js, escapes and all,
+  // so a name typed with a real accent instead of its escape is caught here.
+  check("each Trase dataset is its own row, the source kept in its title",
+        [["trase_measures", String.raw`Deforestation and supply-chain measures (Trase)`],
+         ["trase_meat_brazil", String.raw`Slaughterhouses and animal-product plants, Brazil (Trase)`],
+         ["trase_silos_brazil", String.raw`Soy silos and storage, Brazil (Trase)`],
+         ["trase_cocoa_ivory", String.raw`Cocoa cooperatives, C\u00f4te d'Ivoire (Trase)`],
+         ["trase_palm_indonesia", String.raw`Palm oil mills, Indonesia (Trase)`],
+         ["trase_pulp_indonesia", String.raw`Wood pulp mills, Indonesia (Trase)`],
+         ["trase_pulp_concessions_2015", String.raw`Wood pulp concessions 2015\u20132019, Indonesia (Trase)`],
+         ["trase_pulp_concessions_2020", String.raw`Wood pulp concessions 2020\u20132022, Indonesia (Trase)`],
+         ["trase_pulp_concessions_2023", String.raw`Wood pulp concessions 2023\u20132024, Indonesia (Trase)`]]
+          .every(([i, n]) => src.includes(`id: "${i}", name: "${n}"`)) &&
+        !/name: "Trase: /.test(src) && !/trasefacmenu/.test(src));
+  check("each Trase row sits under the map's own heading, not a Trase one",
+        ["trase_measures", "trase_pulp_indonesia", "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023"]
+          .every((i) => order.indexOf(i) > at("Deforestation") && order.indexOf(i) < at("Global Forest Watch")) &&
+        ["trase_palm_indonesia", "trase_silos_brazil", "trase_cocoa_ivory"]
+          .every((i) => order.indexOf(i) > at("Agriculture") && order.indexOf(i) < at("Meat")) &&
+        order.indexOf("trase_meat_brazil") > at("Meat") && order.indexOf("trase_meat_brazil") < at("Oceans") &&
+        !order.includes("group:trase_data"));
   check("a group owns its children, so no row is rendered twice and none falls into Not yet placed",
         !/rowsById/.test(src) && (src.match(/id:"gfw_dist_year"/g) || []).length === 1 && (src.match(/id: "trase_measures"/g) || []).length === 1);
   check("unticking a row takes its boxes with it",
"""


def run(args, text=None):
    return subprocess.run(args, input=text, capture_output=True, text=True)


def main():
    undo = "--undo" in sys.argv[1:]

    inside = run(["git", "rev-parse", "--is-inside-work-tree"])
    if inside.returncode != 0:
        sys.exit("Not a git repository. Run this from ~/Desktop/culprits.")

    # patch_0920.py first: without it the layers box has no headings to file
    # these rows under, and this patch's placement test would fail for a reason
    # that has nothing to do with Trase.
    try:
        app = open("map/app.js", encoding="utf-8").read()
    except OSError:
        sys.exit("map/app.js not found. Run this from the top of the repo.")
    if 'line.className = "toc-line"' not in app:
        sys.exit("patch_0920.py has to be applied and committed first.")

    applied = run(["git", "apply", "--check", "--reverse", "-"], DIFF).returncode == 0

    if undo:
        if not applied:
            print("Not applied - nothing to undo.")
            return
        back = run(["git", "apply", "--reverse", "-"], DIFF)
        if back.returncode != 0:
            print(back.stderr.strip())
            sys.exit("Could not reverse.")
        print("Reversed. Changed: map/app.js, map/test.mjs")
        return

    if applied:
        print("Already applied - nothing to do.")
        return

    check = run(["git", "apply", "--check", "-"], DIFF)
    if check.returncode != 0:
        print(check.stderr.strip())
        sys.exit("Does not apply cleanly. patch_0920.py has to be applied and committed first.")

    out = run(["git", "apply", "-"], DIFF)
    if out.returncode != 0:
        print(out.stderr.strip())
        sys.exit("git apply failed.")

    print("Applied. Changed: map/app.js, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
