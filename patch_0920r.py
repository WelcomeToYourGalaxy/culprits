#!/usr/bin/env python3
"""patch_0920r.py - reallocated rows say where they are; the emptied rows leave
the box; no heading carries an organisation's name.

    cd ~/Desktop/culprits
    python3 patch_0920r.py

Goes on top of ecfb2a1.

1. Where a layer is, in its title. Nusantara names the place in most of its own
   ids - Global_, IDNMYSBorneo, IDN_, papua, merauke, rawasingkil, BALI - and
   those are read straight off it: worldwide, Borneo, Indonesia, Papua,
   Merauke, Rawa Singkil, Bali. A layer whose id says nothing takes the atlas's
   own stated coverage, Equatorial Asia, rather than a guess. A title that
   already names its place is left alone. GFW datasets take the coverage GFW
   themselves record, and nothing where they record none - 257 of the 382 say
   nothing, and inventing it would be worse than silence.

2. The Nusantara row and the GFW catalogue row are out of the box. Their layers
   are rows of their own now, so what was left was an empty husk. They are kept
   out of sight rather than deleted: the layers still read their visibility
   from them, and ticking one still turns its parent on where nobody sees it.

3. No heading is named for an organisation any more. The "Global Forest Watch"
   sub-heading is gone - the tree cover loss and the alert rows sit under
   Deforestation with everything else - and the pulp concession heading reads
   "Wood pulp concessions, Indonesia". Filing is by subject throughout; who
   published a row is on the row, in its title and its source link.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 520083e..0380f11 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3774,6 +3774,28 @@ const CATALOGUE_PLACES = [
    "Base and reference"],
   [/reef|benthic|coral/i, "Destruction > Of the planet > Oceans"],
 ];
+// Where a catalogue layer is, said in its title. Nusantara names the place in
+// most of its ids and covers Equatorial Asia in the rest; a reader clicking
+// "Fire alerts, VIIRS" under Fire should not have to find out by drawing it
+// that it stops at Indonesia. Read from the id, never assumed: a layer whose id
+// says nothing takes the atlas's own stated coverage.
+const NUSANTARA_WHERE = [
+  [/^Global_|^v3p\d_Global/i, "worldwide"],
+  [/BRNIDNMYS|BRNMYSIDN/i, "Brunei, Indonesia and Malaysia"],
+  [/IDNMYSBorneo/i, "Borneo"],
+  [/REGIDNMYS/i, "Indonesia and Malaysia"],
+  [/^BALI_|badung|tabanan/i, "Bali"],
+  [/papua/i, "Papua"],
+  [/merauke/i, "Merauke"],
+  [/rawasingkil/i, "Rawa Singkil"],
+  [/kalimantan/i, "Kalimantan"],
+  [/^IDN_|_KLHK|^IDN/i, "Indonesia"],
+];
+function nusantaraWhere(id) {
+  for (const [rule, where] of NUSANTARA_WHERE) if (rule.test(id)) return where;
+  return "Equatorial Asia";
+}
+
 function cataloguePlaces(words) {
   const out = [];
   for (const [rule, path] of CATALOGUE_PLACES) if (rule.test(words) && !out.includes(path)) out.push(path);
@@ -3859,7 +3881,10 @@ async function addWmsMenuLayer(cfg) {
         const tt = [...l.children].find((c) => c.tagName === "Title");
         const ab = [...l.children].find((c) => c.tagName === "Abstract");
         const id = nm.textContent;
-      layers.push({ base, name: id, title: NUSANTARA_NAMES[id] || (tt && tt.textContent) || id, about: (ab && ab.textContent) || "" });
+      const said = NUSANTARA_NAMES[id] || (tt && tt.textContent) || id;
+      const where = nusantaraWhere(id);
+      layers.push({ base, name: id, title: new RegExp(where, "i").test(said) ? said : `${said} \u2014 ${where}`,
+        about: (ab && ab.textContent) || "" });
       }
     } catch (e) { console.warn(`[culprits] ${cfg.id}: ${base}: ${e.message}`); }
   }
@@ -3935,7 +3960,15 @@ async function addGfwMenuLayer(cfg) {
     if (rows.length < 100) break;
   }
   if (!all.length) { setLayerState(cfg.id, "the catalogue did not answer"); return; }
-  const items = all.map((d) => ({ id: d.dataset, title: (d.metadata && d.metadata.title) || d.dataset, meta: d.metadata || {} }))
+  // Where a dataset is, as GFW themselves record it. Left off where they
+  // record nothing rather than guessed at from the name.
+  const items = all.map((d) => {
+    const meta = d.metadata || {};
+    const said = meta.title || d.dataset;
+    const where = String(meta.geographic_coverage || "").trim();
+    return { id: d.dataset, meta,
+      title: where && !new RegExp(where.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(said) ? `${said} \u2014 ${where}` : said };
+  })
     .sort((a, b) => a.title.localeCompare(b.title));
   // Each dataset is a row of the layers box, filed by what it shows. Several
   // can be drawn at once now: the menu drew one at a time and cleared the last,
@@ -8574,10 +8607,11 @@ const PANEL_ORDER = [
   { h: 3, t: "Fire" },
   { h: 3, t: "Forest and land cover" },
   { h: 3, t: "Deforestation" }, "soilgrids", "trase_measures", "trase_pulp_indonesia",
-    "nusantara",
-  { h: 4, t: "Wood pulp concessions, Indonesia (Trase)" },
+  { h: 4, t: "Wood pulp concessions, Indonesia" },
     "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023",
-  { h: 4, t: "Global Forest Watch" }, "glad_loss", "group:forest_alerts", "gfw_catalogue",
+  // No heading carries an organisation's name any more: these are rows about
+  // forest loss, filed with the rest of it.
+  "glad_loss", "group:forest_alerts",
   { h: 3, t: "Biodiversity loss" }, "gsn", "gsn_rankings", "allen_coral", "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report",
   { h: 3, t: "Land held under permit" },
   { h: 3, t: "Spatial plans" },
@@ -8670,6 +8704,11 @@ const PANEL_REMOVED = new Set([
   "gmo_releases",
   // Removed at the owner's request, 20 September.
   "acgf",
+  // Their layers are rows of the box now, filed by subject, so the row that
+  // used to carry the menu would be an empty husk. It is kept out of sight
+  // rather than deleted: its layers still read their visibility from it, and
+  // ticking one of them still turns it on where nobody has to see it.
+  "nusantara", "gfw_catalogue",
   // The same upcoming launches and the same pads as the two Launch Library 2
   // rows, but as framed pages rather than on the map.
   "wrf", "nsf_launches",
diff --git a/map/test.mjs b/map/test.mjs
index 7855c51..69dbefa 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1982,7 +1982,7 @@ console.log("\nwhat was still open");
   check("Giga by country, Trase's facilities rows, and two of your own are rows", ["giga_countries", "trase_meat_brazil", "trase_palm_indonesia", "biosignature", "leverage_chart"].every((i) => new RegExp(`id: "${i}"`).test(src)));
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const order = new Function(body + "; return PANEL_ORDER;")();
-  check("the waiting rows are placed", ["ejatlas", "trase_measures", "nusantara", "gfw_catalogue", "gsn", "seas_of_plastic", "coastal_cleanup", "mines_global", "atlas_hotspots", "final_nail", "group:ct_history"].every((i) => order.includes(i)));
+  check("the waiting rows are placed", ["ejatlas", "trase_measures", "gsn", "seas_of_plastic", "coastal_cleanup", "mines_global", "atlas_hotspots", "final_nail", "group:ct_history"].every((i) => order.includes(i)));
 }
 
 console.log("\nvessels of concern drawn; the oil-slick archive");
@@ -2175,9 +2175,11 @@ console.log("\nGlobal Forest Watch's own rows together");
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const order = new Function(body + "; return PANEL_ORDER;")();
   const at = (t) => order.findIndex((x) => x && x.t === t);
-  check("the alerts, the tree cover loss and the catalogue sit under one Global Forest Watch heading",
-        ["glad_loss", "group:forest_alerts", "gfw_catalogue"].every((i) => order.indexOf(i) > at("Global Forest Watch")) &&
-        at("Global Forest Watch") > at("Deforestation"));
+  // Superseded: no heading carries an organisation's name. The alerts and the
+  // tree cover loss are filed under Deforestation with everything else, and
+  // the catalogue's datasets are rows of their own.
+  check("no heading is named for an organisation",
+        !order.some((x) => x && x.t && /(global forest watch|nusantara|trase|climate trace)/i.test(x.t)));
   check("Global Forest Change is still listed above the alerts", order.indexOf("glad_loss") < order.indexOf("group:forest_alerts"));
 }
 
@@ -2241,8 +2243,7 @@ console.log("\nrows gathered, moved and renamed");
           .every(([i, n]) => src.includes(`id: "${i}", name: "${n}"`)) &&
         !/name: "Trase: /.test(src) && !/trasefacmenu/.test(src));
   check("each Trase row sits under the map's own heading, not a Trase one",
-        ["trase_measures", "trase_pulp_indonesia", "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023"]
-          .every((i) => order.indexOf(i) > at("Deforestation") && order.indexOf(i) < at("Global Forest Watch")) &&
+        ["trase_measures", "trase_pulp_indonesia"].every((i) => order.indexOf(i) > at("Deforestation")) &&
         ["trase_palm_indonesia", "trase_silos_brazil", "trase_cocoa_ivory"]
           .every((i) => order.indexOf(i) > at("Agriculture") && order.indexOf(i) < at("Meat")) &&
         order.indexOf("trase_meat_brazil") > at("Meat") && order.indexOf("trase_meat_brazil") < at("Oceans") &&
@@ -2448,7 +2449,7 @@ console.log("\nNusantara's layers say what they show");
         table.concessionitp_spv === "Industrial timber plantation concessions" &&
         table.v3p3_spatialplanmoratorium_spv === "Moratorium areas (PIPPIB) (v3p3 copy)");
   check("a layer nobody has named keeps the server's own title, rather than a guess",
-        /title: NUSANTARA_NAMES\[id\] \|\| \(tt && tt\.textContent\) \|\| id/.test(src));
+        /const said = NUSANTARA_NAMES\[id\] \|\| \(tt && tt\.textContent\) \|\| id;/.test(src));
 }
 
 console.log("\neach row links the site it is read from");
@@ -2645,9 +2646,30 @@ console.log("\nrows that show nearly the same thing say how they differ");
   const order = new Function(body + "; return PANEL_ORDER;")();
   const at = (t) => order.findIndex((x) => x && x.t === t);
   check("the three pulp-concession periods sit under one heading of their own",
-        at("Wood pulp concessions, Indonesia (Trase)") > -1 &&
+        at("Wood pulp concessions, Indonesia") > -1 &&
         ["trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023"]
-          .every((i) => order.indexOf(i) > at("Wood pulp concessions, Indonesia (Trase)")));
+          .every((i) => order.indexOf(i) > at("Wood pulp concessions, Indonesia")));
+}
+
+console.log("\nreallocated rows say where they are; the emptied rows leave the box");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const where = new Function(src.slice(src.indexOf("const NUSANTARA_WHERE = ["), src.indexOf("function cataloguePlaces(")) + "; return nusantaraWhere;")();
+  check("a Nusantara layer says where it is, read from its own id",
+        where("Global_PlantationIOP_2025") === "worldwide" && where("IDNMYSBorneo_LCHSRiver") === "Borneo" &&
+        where("IDN_Mining_2023") === "Indonesia" && where("papua_expansion_2025") === "Papua" &&
+        where("BALI_19650531") === "Bali");
+  check("one whose id says nothing takes the atlas's own stated coverage",
+        where("concessioniop_spv") === "Equatorial Asia" && where("alertfire_viirs") === "Equatorial Asia");
+  check("the title carries it, unless it already says it",
+        /new RegExp\(where, "i"\)\.test\(said\) \? said : `\$\{said\} \\u2014 \$\{where\}`/.test(src));
+  check("a GFW dataset takes the coverage GFW record, and nothing where they record none",
+        /const where = String\(meta\.geographic_coverage \|\| ""\)\.trim\(\);/.test(src));
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
+  const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
+  check("the two emptied rows are out of the box but still findable by the code",
+        !o.PANEL_ORDER.includes("nusantara") && !o.PANEL_ORDER.includes("gfw_catalogue") &&
+        o.PANEL_REMOVED.has("nusantara") && o.PANEL_REMOVED.has("gfw_catalogue"));
 }
 
 console.log("\nGlobal Safety Net fixes; My Maps titles");
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
    if "Wood pulp concessions, Indonesia" not in app:
        sys.exit("patch_0920q.py has to be applied and committed first.")
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
