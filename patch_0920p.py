#!/usr/bin/env python3
"""patch_0920p.py - Global Forest Watch's catalogue becomes rows too.

    cd ~/Desktop/culprits
    python3 patch_0920p.py

Goes on top of 03134a8.

The 382 datasets GFW's data API publishes are now rows of the layers box,
filed by what each shows, through the same machinery Nusantara's layers use -
so a dataset that answers to two subjects sits under both, and the rules that
file them are the ones in the table you read.

Two things change beyond where they sit:

  - Several can be drawn at once. The menu drew one dataset at a time and
    cleared the last, so comparing two of them was impossible. Each row now
    has its own source and its own layers, and unticking one takes away only
    its own.
  - The row that carried the menu says how many of the catalogue are drawn.

A dataset GFW publishes no map tiles for still says so on the row rather than
failing quietly, and its licence and source go to the console as before.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 9ebf8a6..06bbdcb 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3937,32 +3937,31 @@ async function addGfwMenuLayer(cfg) {
   if (!all.length) { setLayerState(cfg.id, "the catalogue did not answer"); return; }
   const items = all.map((d) => ({ id: d.dataset, title: (d.metadata && d.metadata.title) || d.dataset, meta: d.metadata || {} }))
     .sort((a, b) => a.title.localeCompare(b.title));
-  const menu = document.createElement("div");
-  menu.className = "facet";
-  // The category the catalogue gives, where it gives one; otherwise by the words
-  // of its title and description, in Global Forest Watch's own map categories.
-  items.forEach((d) => {
-    const given = [d.meta.category, ...(Array.isArray(d.meta.tags) ? d.meta.tags : [])].map((c) => String(c || ""))
-      .map((c) => GFW_CATEGORIES.find(([n]) => n.toLowerCase() === c.toLowerCase())).find(Boolean);
-    d.cat = given ? given[0] : categoryOf(`${d.title} ${d.meta.function || ""} ${d.meta.overview || ""} ${d.id}`, GFW_CATEGORIES);
-  });
-  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
-  const anchor = row && row.closest ? row.closest("label") : null;
-  if (anchor && anchor.after) anchor.after(menu);
-  setLayerState(cfg.id, `${items.length} datasets \u2014 choose one`);
-  const clear = () => {
-    for (const id of [...(cfg._layerIds || [])]) if (map.getLayer(id)) map.removeLayer(id);
-    if (map.getSource(`${cfg.id}-gfw`)) map.removeSource(`${cfg.id}-gfw`);
-    cfg._layerIds = [];
+  // Each dataset is a row of the layers box, filed by what it shows. Several
+  // can be drawn at once now: the menu drew one at a time and cleared the last,
+  // which made comparing two of them impossible.
+  const drawn = new Map();          // dataset id -> the layer ids it drew
+  const safe = (x) => String(x).replace(/[^a-z0-9_]/gi, "_");
+  cfg._layerIds = [];
+  const applyAll = (vis) => {
+    for (const ids of drawn.values()) for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
   };
-  categoryMenu(menu, items, GFW_CATEGORIES, "Dataset", async (pick) => {
-    clear();
-    // Choosing a dataset turns the row on, so the choice draws rather than
-    // waiting on a second tick.
-    if (pick) showRowFor(cfg.id);
-    const d = pick == null ? null : items[pick];
-    if (!d) return;
+  cfg.afterVisibility = applyAll;
+  const said = () => setLayerState(cfg.id, drawn.size
+    ? `${drawn.size} of ${items.length} datasets drawn`
+    : `${items.length} datasets, each a row below`);
+  const take = (d) => {
+    for (const id of drawn.get(d.id) || []) if (map.getLayer(id)) map.removeLayer(id);
+    if (map.getSource(`${cfg.id}-${safe(d.id)}`)) map.removeSource(`${cfg.id}-${safe(d.id)}`);
+    drawn.delete(d.id);
+    cfg._layerIds = [].concat(...drawn.values());
+    said();
+  };
+  const put = async (d) => {
+    showRowFor(cfg.id);
     setLayerState(cfg.id, `${d.title}: finding its tiles\u2026`);
+    const src = `${cfg.id}-${safe(d.id)}`;
+    const ids = [];
     try {
       const v = await getJson(`${cfg.api}/dataset/${d.id}/latest`);
       const version = (v.data && v.data.version) || "latest";
@@ -3974,32 +3973,41 @@ async function addGfwMenuLayer(cfg) {
         const uri = vec.asset_uri;
         const buf = await (await fetch(uri.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0"))).arrayBuffer().catch(() => null);
         const names = buf ? readTileLayers(buf) : [];
-        map.addSource(`${cfg.id}-gfw`, { type: "vector", tiles: [uri], minzoom: 0, maxzoom: 12 });
+        map.addSource(src, { type: "vector", tiles: [uri], minzoom: 0, maxzoom: 12 });
         for (const n of (names.length ? names : [d.id, "default"])) {
-          const base = { source: `${cfg.id}-gfw`, "source-layer": n };
-          map.addLayer({ id: `${cfg.id}-f-${n}`, type: "fill", ...base, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": cfg.colour, "fill-opacity": 0.45, "fill-outline-color": "#1D1B17" } });
-          map.addLayer({ id: `${cfg.id}-l-${n}`, type: "line", ...base, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": cfg.colour, "line-width": 1.2 } });
-          map.addLayer({ id: `${cfg.id}-p-${n}`, type: "circle", ...base, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": cfg.colour, "circle-radius": 3, "circle-stroke-width": 0.5, "circle-stroke-color": "#17150F" } });
-          for (const id of [`${cfg.id}-f-${n}`, `${cfg.id}-l-${n}`, `${cfg.id}-p-${n}`]) {
-            cfg._layerIds.push(id);
+          const base = { source: src, "source-layer": n };
+          map.addLayer({ id: `${src}-f-${safe(n)}`, type: "fill", ...base, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": cfg.colour, "fill-opacity": 0.45, "fill-outline-color": "#1D1B17" } });
+          map.addLayer({ id: `${src}-l-${safe(n)}`, type: "line", ...base, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": cfg.colour, "line-width": 1.2 } });
+          map.addLayer({ id: `${src}-p-${safe(n)}`, type: "circle", ...base, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": cfg.colour, "circle-radius": 3, "circle-stroke-width": 0.5, "circle-stroke-color": "#17150F" } });
+          for (const id of [`${src}-f-${safe(n)}`, `${src}-l-${safe(n)}`, `${src}-p-${safe(n)}`]) {
+            ids.push(id);
             bindHtmlPopup(id, (p) => `<b>${escapeHtml(d.title)}</b><table class="meta">${fieldRows(p)}</table>`);
           }
         }
-        setLayerState(cfg.id, `${d.title} \u00b7 live${about ? " \u00b7 " + about : ""}`);
       } else if (ras) {
-        map.addSource(`${cfg.id}-gfw`, { type: "raster", tileSize: 256, tiles: [ras.asset_uri], maxzoom: 12 });
-        map.addLayer({ id: `${cfg.id}-r`, type: "raster", source: `${cfg.id}-gfw`, paint: { "raster-opacity": 0.8, "raster-saturation": -0.3 } });
-        cfg._layerIds.push(`${cfg.id}-r`);
-        setLayerState(cfg.id, `${d.title} \u00b7 live picture${about ? " \u00b7 " + about : ""}`);
+        map.addSource(src, { type: "raster", tileSize: 256, tiles: [ras.asset_uri], maxzoom: 12 });
+        map.addLayer({ id: `${src}-r`, type: "raster", source: src, paint: { "raster-opacity": 0.8, "raster-saturation": -0.3 } });
+        ids.push(`${src}-r`);
       } else {
         setLayerState(cfg.id, `${d.title}: Global Forest Watch publishes no map tiles for this dataset (download only)`);
+        return;
       }
-      const vis = visibility.get(cfg.id) || "visible";
-      for (const id of cfg._layerIds) map.setLayoutProperty(id, "visibility", vis);
+      drawn.set(d.id, ids);
+      cfg._layerIds = [].concat(...drawn.values());
+      applyAll(visibility.get(cfg.id) || "visible");
+      said();
+      if (about) console.info(`[culprits] ${d.title} \u2014 ${about}`);
     } catch (e) {
       setLayerState(cfg.id, `${d.title}: ${e.message}`);
     }
-  }, "Choose a dataset in this category\u2026");
+  };
+  const rows = items.map((d) => ({
+    name: d.id, title: d.title, about: `${d.meta.function || ""} ${d.meta.overview || ""}`.trim(),
+    show: (want) => { if (want) put(d); else take(d); },
+  }));
+  catalogueRows(cfg, rows);
+  rows.forEach((r) => CATALOGUE_ITEMS.set(r.key, r));
+  said();
 }
 
 /* ---------- The Social Spheres: its bodies on the map, its own card on a click ---------- */
diff --git a/map/test.mjs b/map/test.mjs
index e23ca1b..8d5419f 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2065,7 +2065,10 @@ console.log("\nNusantara Atlas and Global Forest Watch, by category");
   check("integrated alerts are Forest Change", categoryOf("Integrated deforestation alerts", G) === "Forest Change");
   check("mangrove extent is Land Cover", categoryOf("Global mangrove extent", G) === "Land Cover");
   check("a layer no rule claims goes under Other, not away", categoryOf("xyz 123", G) === "Other");
-  check("Global Forest Watch uses the category chips", (src.match(/categoryMenu\(menu, /g) || []).length === 1);
+  // Superseded with Nusantara's: the catalogue's datasets are rows of the box
+  // now, filed by what each shows, and several can be drawn at once.
+  check("Global Forest Watch's datasets are rows of the box", !/categoryMenu\(menu, /.test(src) &&
+        (src.match(/^  catalogueRows\(cfg, /gm) || []).length === 2);
   // Superseded: Nusantara's layers are rows of the box itself now, filed by
   // what they show, not a list inside one row.
   check("Nusantara's layers are rows of the box, filed by subject", /catalogueRows\(cfg, items\);/.test(src) && !/menu\.className = "facet ns-list"/.test(src));
@@ -2142,7 +2145,7 @@ console.log("\nthe showing box, the queue, and menus that draw");
   check("a heading's tick sits at the end of its line", /line\.appendChild\(head\);\n\s*line\.appendChild\(all\);/.test(src));
   check("layers are built three at a time, and a waiting row says so",
         /const QUEUE_AT_ONCE = 3/.test(src) && /waiting behind \$\{i \+ 1\} other layer/.test(src) && /queueBuild\(cfg\.id, \(\) => \{/.test(src));
-  check("a catalogue row turns the row it belongs to on", /function showRowFor\(id\)/.test(src) && /showRowFor\(cfg\.id\);\n\s*on\.add\(i\);/.test(src) && /if \(pick\) showRowFor\(cfg\.id\)/.test(src));
+  check("a catalogue row turns the row it belongs to on", /function showRowFor\(id\)/.test(src) && /showRowFor\(cfg\.id\);\n\s*on\.add\(i\);/.test(src) && /showRowFor\(cfg\.id\);\n\s*setLayerState\(cfg\.id, `\$\{d\.title\}: finding its tiles/.test(src));
 }
 
 console.log("\ntitles in one ink, sources named");
@@ -2608,6 +2611,24 @@ console.log("\nNusantara's layers spread through the box");
   check("each row says it is live and links its source", /class="live"/.test(src) && /\$\{siteLink\(cfg\.id\)\}<\/span>/.test(src));
 }
 
+console.log("\nthe Global Forest Watch catalogue, as rows");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("async function addGfwMenuLayer("), src.indexOf("/* ---------- The Social Spheres"));
+  check("several datasets can be drawn at once, each with its own source",
+        /const drawn = new Map\(\);/.test(body) && /`\$\{cfg\.id\}-\$\{safe\(d\.id\)\}`/.test(body) &&
+        !/const clear = \(\) =>/.test(body));
+  check("unticking one takes its own layers away and leaves the others",
+        /for \(const id of drawn\.get\(d\.id\) \|\| \[\]\) if \(map\.getLayer\(id\)\) map\.removeLayer\(id\);/.test(body) &&
+        /drawn\.delete\(d\.id\);/.test(body));
+  check("the row says how many of the catalogue are drawn",
+        /\$\{drawn\.size\} of \$\{items\.length\} datasets drawn/.test(body));
+  check("a dataset with no tiles says so rather than failing quietly",
+        /publishes no map tiles for this dataset \(download only\)/.test(body));
+  check("its rows are filed by the same rules as Nusantara's",
+        /catalogueRows\(cfg, rows\);/.test(body) && /CATALOGUE_ITEMS\.set\(r\.key, r\)/.test(body));
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
    if "function catalogueRows(cfg, items)" not in app:
        sys.exit("patch_0920o.py has to be applied and committed first.")
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
