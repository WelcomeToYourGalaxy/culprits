#!/usr/bin/env python3
"""patch_0920g.py - Nusantara's layers say what they show.

    cd ~/Desktop/culprits
    python3 patch_0920g.py

Goes on top of patch_0920f.py, which must be applied and committed first.

Their server publishes its own layer ids as the titles, so the menu read as a
list of file names - Global_PlantationIOP_2025, concessionitp_spv,
v3p3_spatialplanmoratorium_spv. 152 of the 158 layers their two workspaces
publish now carry a plain name, written from the id and from what the workspace
publishes beside it.

Six are still their own ids, because I could not read them with certainty and
will not guess: concessioncma_spv, concessionfca_spv, millopbufferol_spv,
millopbufferol50km_spv, millopbufferpolyloreal_spv, hires. Any layer not in the
table keeps the title the server gives it, so nothing is lost by leaving them.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 01d9c01..35a62c4 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3518,6 +3518,167 @@ async function addCarbonMapperLayer(cfg) {
   buildLegend();
 }
 
+// Nusantara's server publishes its own layer names as the titles, so the menu
+// read as a list of file names: Global_PlantationIOP_2025, concessionitp_spv,
+// v3p3_spatialplanmoratorium_spv. Each one below is that layer said plainly,
+// written from its own name and what its workspace publishes. A layer not
+// named here keeps the title the server gives it rather than being guessed at,
+// which is why a handful are still their own ids.
+const NUSANTARA_NAMES = {
+  "AlertDFCOMBINERGB": "Deforestation alerts, every system combined",
+  "AlertGLADRGB": "GLAD deforestation alerts",
+  "AlertRADDRGB": "RADD radar deforestation alerts",
+  "BALI_19650531": "Bali from the air, 31 May 1965",
+  "BALI_19650531_Composite1": "Bali from the air, 31 May 1965 (composite)",
+  "ECJRCV2": "Forest cover (EC JRC v2)",
+  "FCHS_2020_ECJRCV2": "Forest cover 2020, with hillshade (EC JRC v2)",
+  "Global_AllExpansionRGB_2000to2024": "Plantation expansion, 2000 to 2024 (picture)",
+  "Global_AllExpansionRGB_2000to2025": "Plantation expansion, 2000 to 2025 (picture)",
+  "Global_AllExpansion_2000to2025": "Plantation expansion, 2000 to 2025",
+  "Global_FC-FNF-HS_Latest_TTM": "Forest and non-forest, latest, with hillshade (TheTreeMap)",
+  "Global_FC-FNF_2024_TTM": "Forest and non-forest 2024 (TheTreeMap)",
+  "Global_FC-FNF_2025_TTM": "Forest and non-forest 2025 (TheTreeMap)",
+  "Global_FC_2025_TTM": "Forest cover 2025 (TheTreeMap)",
+  "Global_LCHS_2024": "Land cover 2024, with hillshade",
+  "Global_PlantationAll_2024": "Plantations of every kind 2024",
+  "Global_PlantationAll_2025": "Plantations of every kind 2025",
+  "Global_PlantationIOP_2024": "Industrial oil palm plantations 2024",
+  "Global_PlantationIOP_2025": "Industrial oil palm plantations 2025",
+  "Global_PlantationITP_2024": "Industrial timber plantations 2024",
+  "Global_PlantationITP_2025": "Industrial timber plantations 2025",
+  "Global_PlantationSmallholder_2024": "Smallholder plantations 2024",
+  "Global_PlantationSmallholder_2025": "Smallholder plantations 2025",
+  "Global_WaterChange_1984to2021": "Surface water change, 1984 to 2021 (EC JRC)",
+  "IDNMYSBorneo_LCHSRiver": "Borneo land cover, with hillshade and rivers",
+  "IDNMYSBorneo_LCIndustrial_1970": "Borneo industrial land 1970",
+  "IDNMYSBorneo_SRTMHS30WGS_2000": "Borneo relief, 30 m (SRTM 2000)",
+  "IDNMYSBorneo_Settlement_2017_GHS": "Settlements 2017, Borneo (GHSL)",
+  "IDNMYSBorneo_Transmigration_2021": "Transmigration areas 2021, Borneo",
+  "IDNMYSBorneo_Transmigration_2021_wms": "Transmigration areas 2021, Borneo",
+  "IDNMYSBorneo_WaterChangeRGB_1984to2020_JRC": "Surface water change, 1984 to 2021 \u2014 Borneo (EC JRC)",
+  "IDN_BurnedArea_2019_TheTreeMap": "Burned area 2019, Indonesia (TheTreeMap)",
+  "IDN_BurnedArea_2020_TheTreeMap": "Burned area 2020, Indonesia (TheTreeMap)",
+  "IDN_BurnedArea_2021_TheTreeMap": "Burned area 2021, Indonesia (TheTreeMap)",
+  "IDN_FC2020_KLHK": "Forest cover 2020, Indonesia's own (Ministry of Environment and Forestry)",
+  "IDN_Mining_2023": "Mining areas 2023, Indonesia",
+  "LC1970": "Land cover 1970",
+  "LC1970HS": "Land cover 1970, with hillshade",
+  "REGBRNIDNMYS_Coconut_2020_Descal": "Coconut plantations 2020 \u2014 Brunei, Indonesia, Malaysia (Descals)",
+  "REGBRNIDNMYS_FC-FNF-HS_Latest_TTM": "Forest and non-forest, latest, with hillshade \u2014 Brunei, Indonesia, Malaysia (TheTreeMap)",
+  "REGBRNMYSIDN_FCHS_2020_ECJRC": "Forest cover 2020, with hillshade \u2014 Brunei, Malaysia, Indonesia (EC JRC)",
+  "REGBRNMYSIDN_FCLandArea_2020_ECJRC": "Forest as a share of land area 2020 \u2014 Brunei, Malaysia, Indonesia (EC JRC)",
+  "REGBRNMYSIDN_FC_2020_ECJRC": "Forest cover 2020 \u2014 Brunei, Malaysia, Indonesia (EC JRC)",
+  "REGIDNMYS_TreeHeight_2020_ETHZurich": "Tree height 2020 \u2014 Indonesia and Malaysia (ETH Zurich)",
+  "RGBProbabilityDF": "Deforestation probability",
+  "admincountry_spv": "Country boundaries",
+  "admindistrict_spv": "District boundaries",
+  "adminprovince_spv": "Province boundaries",
+  "adminsubdistrict_spv": "Sub-district boundaries",
+  "adminvillage_spv": "Village boundaries",
+  "alertfire_combine": "Fire alerts, MODIS and VIIRS together",
+  "alertfire_modis": "Fire alerts, MODIS",
+  "alertfire_viirs": "Fire alerts, VIIRS",
+  "article_spv": "News articles, placed",
+  "base_ikn": "Nusantara, the new Indonesian capital (IKN)",
+  "base_peatland": "Peatland",
+  "base_populatedplace": "Towns and villages",
+  "base_road": "Roads",
+  "base_roadRGB": "Roads, by the year they appeared (picture)",
+  "base_road_edited": "Roads (their edited version)",
+  "base_roadtrans": "Transmigration roads",
+  "base_sagoindicative": "Sago, where it is likely to grow",
+  "benthic_allencorral_global": "Reef habitats (Allen Coral Atlas)",
+  "burned_area_annual": "Burned area, by year",
+  "burned_area_biennial": "Burned area, two years at a time",
+  "burned_area_biennial_del": "Burned area, two years at a time (marked for deletion on their server)",
+  "burned_area_biennial_test": "Burned area, two years at a time (their test copy)",
+  "burned_area_monthly": "Burned area, by month",
+  "burned_area_rgb_crop": "Burned area (picture, cropped)",
+  "burnedarea_rgb": "Burned area (picture)",
+  "burnedareanrt": "Burned area, near real time, showing overlaps",
+  "concessionhgu_spv": "Plantation land-use rights (HGU)",
+  "concessioniop_finance_credit": "Oil palm concessions, by who lends to them",
+  "concessioniop_finance_invest": "Oil palm concessions, by who invests in them",
+  "concessioniop_spv": "Oil palm concessions",
+  "concessionitp_spv": "Industrial timber plantation concessions",
+  "concessionlogging_spv": "Logging concessions",
+  "concessionmining_spv": "Mining concessions",
+  "concessionother_finance_credit": "Other concessions, by who lends to them",
+  "concessionother_finance_invest": "Other concessions, by who invests in them",
+  "concessionother_spv": "Concessions of other kinds",
+  "concessionpbph_spv": "Forest utilisation permits (PBPH)",
+  "concessionpsnmerauke_spv": "National Strategic Project concessions, Merauke",
+  "concessiontimber_spv": "Timber concessions",
+  "geotag": "Geotagged photographs",
+  "hillshade": "Hillshade relief",
+  "merauke_concessionother_sugarcane": "Sugarcane concessions, Merauke",
+  "merauke_road_plan": "Planned roads, Merauke",
+  "millop_finance_credit": "Palm oil mills, by who lends to them",
+  "millop_finance_invest": "Palm oil mills, by who invests in them",
+  "millop_spv": "Palm oil mills",
+  "millopbuffer10km_spv": "Palm oil mill sourcing areas, 10 km",
+  "millopbuffer1hr_spv": "Palm oil mill sourcing areas, one hour's drive",
+  "millopbuffer2hr_spv": "Palm oil mill sourcing areas, two hours' drive",
+  "millopbuffer_spv": "Palm oil mill sourcing areas",
+  "milloprefineries_sp": "Palm oil refineries",
+  "papua_concessioniop_edited": "Oil palm concessions, Papua (their edited version)",
+  "papua_expansion_2025": "Plantation expansion 2025, Papua",
+  "papua_location12_sentinel2_true": "Papua, Sentinel-2 true colour \u2014 location 12",
+  "papua_location13_sentinel2_true": "Papua, Sentinel-2 true colour \u2014 location 13",
+  "papua_location1_sentinel2_true": "Papua, Sentinel-2 true colour \u2014 location 1",
+  "papua_location2_sentinel2_true": "Papua, Sentinel-2 true colour \u2014 location 2",
+  "papua_location6_sentinel2_true": "Papua, Sentinel-2 true colour \u2014 location 6",
+  "plantation_established_merauke": "Established plantations, Merauke",
+  "protectedarea_spv": "Protected areas",
+  "protectedarea_spv_withlabel": "Protected areas, with their names",
+  "protectedareadissolve_sp": "Protected areas, merged into one shape",
+  "protectedareaoutline": "Protected area outlines",
+  "protectedareareaconservationlandscape_spv": "Conservation landscapes",
+  "protectedareareaecosystemrestoration_spv": "Ecosystem restoration areas",
+  "protectedareareaforestreserve_spv": "Forest reserves",
+  "protectedareareahydrologicalreserve_spv": "Hydrological reserves",
+  "rawasingkil_10_canal": "Canals in Rawa Singkil, the ten longest",
+  "rawasingkil_canal": "Canals in Rawa Singkil",
+  "rawasingkil_illegal_oilpalm": "Illegal oil palm in Rawa Singkil",
+  "rdtr_badung_2023": "Detailed spatial plan 2023, Badung (RDTR)",
+  "roadsegmentbuffer_spv": "Land within reach of a road",
+  "rtrw_badung_2024": "District spatial plan 2024, Badung (RTRW)",
+  "rtrw_badung_2025": "District spatial plan 2025, Badung (RTRW)",
+  "rtrw_tabanan_2023": "District spatial plan 2023, Tabanan (RTRW)",
+  "rubber_kalimantan_2020": "Rubber plantations 2020, Kalimantan",
+  "socialforestryhadat_spv": "Customary forest (hutan adat)",
+  "socialforestryhd_spv": "Village forest (hutan desa)",
+  "socialforestryhk_spv": "Community forest (hutan kemasyarakatan)",
+  "socialforestryht_spv": "Community plantation forest (hutan tanaman rakyat)",
+  "socialforestrywiladat_spv": "Customary territories (wilayah adat)",
+  "spatialplanforestland_spv": "Forest estate, as the state designates it",
+  "spatialplanmoratorium_spv": "Moratorium areas (PIPPIB)",
+  "spatialplanrtrwn_spv": "National spatial plan (RTRWN)",
+  "spatialplanrtrwp_papua_spv": "Provincial spatial plan, Papua (RTRWP)",
+  "spatialplanrtrwp_papuawest_spv": "Provincial spatial plan, West Papua (RTRWP)",
+  "v3p2_AlertDFCOMBINERGB": "Deforestation alerts, every system combined (v3p2 copy)",
+  "v3p2_GLADRGB": "GLAD deforestation alerts (v3p2 copy)",
+  "v3p2_RADDRGB": "RADD radar deforestation alerts (v3p2 copy)",
+  "v3p2_alertfire_combine": "Fire alerts, MODIS and VIIRS together (v3p2 copy)",
+  "v3p2_alertfire_modis": "Fire alerts, MODIS (v3p2 copy)",
+  "v3p2_alertfire_viirs": "Fire alerts, VIIRS (v3p2 copy)",
+  "v3p2_protectedarea_spv": "Protected areas (v3p2 copy)",
+  "v3p3_admincountry_spv": "Country boundaries (v3p3 copy)",
+  "v3p3_admindistrict_spv": "District boundaries (v3p3 copy)",
+  "v3p3_adminprovince_spv": "Province boundaries (v3p3 copy)",
+  "v3p3_adminsubdistrict_spv": "Sub-district boundaries (v3p3 copy)",
+  "v3p3_adminvillage_spv": "Village boundaries (v3p3 copy)",
+  "v3p3_alertfire_combine": "Fire alerts, MODIS and VIIRS together (v3p3 copy)",
+  "v3p3_alertfire_modis": "Fire alerts, MODIS (v3p3 copy)",
+  "v3p3_alertfire_viirs": "Fire alerts, VIIRS (v3p3 copy)",
+  "v3p3_concessioniop_spv": "Oil palm concessions (v3p3 copy)",
+  "v3p3_concessionother_spv": "Concessions of other kinds (v3p3 copy)",
+  "v3p3_roadsegmentbuffer_spv": "Land within reach of a road (v3p3 copy)",
+  "v3p3_spatialplanforestland_spv": "Forest estate, as the state designates it (v3p3 copy)",
+  "v3p3_spatialplanmoratorium_spv": "Moratorium areas (PIPPIB) (v3p3 copy)",
+  "varticle": "News articles, placed (second copy)",
+};
+
 /* ---------- a map server's whole layer list, as a menu (Nusantara Atlas) ---------- */
 async function addWmsMenuLayer(cfg) {
   const layers = [];
@@ -3530,7 +3691,8 @@ async function addWmsMenuLayer(cfg) {
         if (!nm || [...l.getElementsByTagName("Layer")].length) continue;
         const tt = [...l.children].find((c) => c.tagName === "Title");
         const ab = [...l.children].find((c) => c.tagName === "Abstract");
-        layers.push({ base, name: nm.textContent, title: (tt && tt.textContent) || nm.textContent, about: (ab && ab.textContent) || "" });
+        const id = nm.textContent;
+      layers.push({ base, name: id, title: NUSANTARA_NAMES[id] || (tt && tt.textContent) || id, about: (ab && ab.textContent) || "" });
       }
     } catch (e) { console.warn(`[culprits] ${cfg.id}: ${base}: ${e.message}`); }
   }
diff --git a/map/test.mjs b/map/test.mjs
index 842bd30..dabf11c 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2406,6 +2406,20 @@ console.log("\nthe launch rows draw without waiting out the API");
         /Stuck\? Reload here, or press \u2318R \(Ctrl-R\)/.test(index));
 }
 
+console.log("\nNusantara's layers say what they show");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const table = new Function(src.slice(src.indexOf("const NUSANTARA_NAMES = {"), src.indexOf("/* ---------- a map server's whole layer list")) + "; return NUSANTARA_NAMES;")();
+  check("every name is a plain one, not the server's id", Object.keys(table).length > 140 &&
+        Object.values(table).every((v) => v && !/^[a-z0-9_]+$|_spv|RGB_|TTM/.test(v)));
+  check("the ones that read worst are covered",
+        table.Global_PlantationIOP_2025 === "Industrial oil palm plantations 2025" &&
+        table.concessionitp_spv === "Industrial timber plantation concessions" &&
+        table.v3p3_spatialplanmoratorium_spv === "Moratorium areas (PIPPIB) (v3p3 copy)");
+  check("a layer nobody has named keeps the server's own title, rather than a guess",
+        /title: NUSANTARA_NAMES\[id\] \|\| \(tt && tt\.textContent\) \|\| id/.test(src));
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
    if "LL2_WAIT" not in app:
        sys.exit("patch_0920f.py has to be applied and committed first.")
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
