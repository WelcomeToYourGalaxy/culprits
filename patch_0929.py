#!/usr/bin/env python3
"""
Atlas for the End of the World cities: clicking one from further out zooms in
to it, then opens its box. Needs patch_0928.py applied first.
Run from the culprits folder:

    python3 patch_0929.py

then:  node map/test.mjs
"""
import pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
app_path = ROOT / "map" / "app.js"
if not app_path.exists():
    sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits). Nothing was written.")
app = app_path.read_text(encoding="utf-8")
if 'route: "atlascities", zoomTo: 9,' in app:
    sys.exit("Already applied - nothing to do.")
if "facet ns-list" not in app:
    sys.exit("Run patch_0928.py first. Nothing was written.")
DIFF = r'''diff --git a/map/app.js b/map/app.js
index 50f590a..0ea8238 100644
--- a/map/app.js
+++ b/map/app.js
@@ -5858,7 +5858,18 @@ function openSitemapClick(e) {
   }
   popupClaimedBy = claim;
   ensureBoxCss();
-  if (hits.length === 1) { openSitemapBox(hits[0], placeOf(hits[0], e)); return; }
+  if (hits.length === 1) {
+    // A layer that marks whole places (a city) zooms in to it when clicked
+    // from further out, then opens its box.
+    const z = hits[0].cfg.zoomTo, at = placeOf(hits[0], e);
+    if (z && map.getZoom() < z - 0.5 && typeof map.flyTo === "function") {
+      map.flyTo({ center: at, zoom: z, duration: 1600 });
+      map.once("moveend", () => openSitemapBox(hits[0], at));
+      return;
+    }
+    openSitemapBox(hits[0], at);
+    return;
+  }
   const rows = hits.map((h, i) =>
     `<button type="button" data-hit="${i}"><span class="pl">${escapeHtml(h.props.n || "Unnamed place")}</span>` +
     `<span class="mp">${escapeHtml(h.cfg.name)}</span></button>`).join("");
@@ -6613,7 +6624,7 @@ const OTHER_MAPS = {
       item: "ba55aa1bff5447e7b72559b8dc1a0e83", pdfBase: "https://atlas-for-the-end-of-the-world.com/hotspots/",
       pdfs: [["atlantic_forests", "Atlantic Forest"], ["california_floristic_province", "California Floristic Province"], ["cape_floristic_region", "Cape Floristic Region"], ["caribbean_islands", "Caribbean Islands"], ["caucasus", "Caucasus"], ["cerrado", "Cerrado"], ["chilean_valdivian_forests", "Chilean Winter Rainfall Valdivian Forests"], ["coastal_forests_of_eastern_africa", "Coastal Forests of Eastern Africa"], ["east_melanesian_islands", "East Melanesian Islands"], ["eastern_afromontane", "Eastern Afromontane"], ["forests_of_east_australia", "Forests of Eastern Australia"], ["guinean_forests_of_west_africa", "Guinean Forests of West Africa"], ["himalaya", "Himalaya"], ["horn_of_africa", "Horn of Africa"], ["japan", "Japan"], ["madagascar", "Madagascar & The Indian Ocean Islands"], ["madrean_woodlands", "Madrean Pine-Oak Woodlands"], ["maputaland_pondoland_albany", "Maputaland Pondoland Albany"], ["mediterranean_basin", "Mediterranean Basin"], ["mesoamerica", "Mesoamerica"], ["mountains_of_central_asia", "Mountains of Central Asia"], ["mountains_of_southwest_china", "Mountains of Southwest China"], ["new_caledonia", "New Caledonia"], ["new_zealand", "New Zealand"], ["philippines", "Philippines"], ["north_american_coastal_plain", "North American Coastal Plain"], ["southwest_australia", "Southwest Australia"], ["succulent_karoo", "Succulent Karoo"], ["sundaland", "Sundaland"], ["tropical_andes", "Tropical Andes"], ["wallacea", "Wallacea"], ["western_ghats_sri_lanka", "Western Ghats & Sri Lanka"]],
       note: "The 36 biodiversity hotspots, outlined live from Conservation International's Biodiversity Hotspots 2016.1 (CC BY 3.0), the boundaries the Atlas maps; each box links the Atlas's own PDF for that hotspot." },
-    { id: "atlas_cities", name: "Atlas for the End of the World: Hotspot Cities", unit: "cities", colour: "#5E6070", route: "atlascities", ready: true, lazy: true,
+    { id: "atlas_cities", name: "Atlas for the End of the World: Hotspot Cities", unit: "cities", colour: "#5E6070", route: "atlascities", zoomTo: 9, ready: true, lazy: true,
       pageBase: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/", positions: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/atlas/cities.json",
       cities: [["antananarivo", "Antananarivo, Madagascar"], ["auckland", "Auckland, New Zealand"], ["baku", "Baku, Azerbaijan"], ["bogota", "Bogotá, Colombia"], ["brasilia", "Brasília, Brazil"], ["cape_town", "Cape Town, South Africa"], ["chengdu", "Chengdu, China"], ["colombo", "Colombo, Sri Lanka"], ["dar_es_salaam", "Dar es Salaam, Tanzania"], ["davao", "Davao, Philippines"], ["durban", "Durban, South Africa"], ["esfahan", "Esfahan, Iran"], ["guadalajara", "Guadalajara, Mexico"], ["guayaquil", "Guayaquil, Ecuador"], ["hongknog_shenzhen_quangzhou", "Hongkong-Shenzhen-Guangzhou, China"], ["honolulu", "Honolulu, United States"], ["houston", "Houston, United States"], ["jakarta", "Jakarta, Indonesia"], ["lagos", "Lagos, Nigeria"], ["los_angeles", "Los Angeles, United States"], ["makassar", "Makassar, Indonesia"], ["mecca", "Mecca, Saudi Arabia"], ["mexico_city", "Mexico City, Mexico"], ["nairobi", "Nairobi, Kenya"], ["osaka", "Osaka, Japan"], ["perth", "Perth, Australia"], ["port-au-prince", "Port-au-Prince, Haiti"], ["rawalpindi", "Rawalpindi, Pakistan"], ["santiago", "Santiago, Chile"], ["sao_paulo", "São Paulo, Brazil"], ["sydney", "Sydney, Australia"], ["tashkent", "Tashkent, Uzbekistan"], ["tel_aviv", "Tel Aviv, Israel"]],
       note: "The Atlas's 33 hotspot cities; each is placed from its name through a weekly OpenStreetMap lookup, and its box links the Atlas's own page." },
diff --git a/map/test.mjs b/map/test.mjs
index 6df2c10..38da1e0 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2146,5 +2146,11 @@ console.log("\nGlobal Safety Net fixes; My Maps titles");
   check("My Maps rows take their maps' titles before opening", /function mymapsTitles\(/.test(src) && /map\.on\("load", \(\) => setTimeout\(mymapsTitles, 50\)\)/.test(src));
 }
 
+console.log("\nAtlas cities zoom in when clicked");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("clicking a city from further out zooms in to it, then opens its box", /route: "atlascities", zoomTo: 9,/.test(src) && /map\.flyTo\(\{ center: at, zoom: z, duration: 1600 \}\)/.test(src));
+}
+
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
'''

with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False, encoding="utf-8") as f:
    f.write(DIFF)
chk = subprocess.run(["git", "apply", "--check", f.name], cwd=ROOT, capture_output=True, text=True)
if chk.returncode:
    sys.exit("The files differ from the copy this was made for. Nothing was written. " + chk.stderr)
subprocess.run(["git", "apply", f.name], cwd=ROOT, check=True)
print("Done. Test with: node map/test.mjs")
