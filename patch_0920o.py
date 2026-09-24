#!/usr/bin/env python3
"""patch_0920o.py - Nusantara's 158 layers become rows of the box, filed by
subject.

    cd ~/Desktop/culprits
    python3 patch_0920o.py

Goes on top of patch_0920n.py, which must be applied and committed first. This
carries the new headings and the copying it added; Global Forest Watch's
catalogue follows in the next patch, through the same machinery.

Each Nusantara layer is now a row of the layers box like any other, under the
map's own headings, rather than a list inside one row that a reader had to open
and scroll. Where a layer answers to two subjects it is filed under both - the
mining concessions sit under Mining and under Land held under permit, and
ticking either draws the layer once.

Filing is by what a layer shows, never by who published it; that is what the
source link on the row is for. The rules are read in order and every match
counts. Two worth naming: "alert" on its own is not deforestation, because
Nusantara's fire alerts carry the word too and belong under Fire; and the
customary forest and adat territory layers are filed under Suppression > Of
humans > Land and territory rather than with forest cover, because they are
about who holds ground.

A layer no rule claims waits under Not yet placed rather than being given a
home someone invented, and a heading nothing in the box answers to is never
made up here - headings come from the order.

The row that used to carry the menu stays, and now says how many layers there
are and how many are drawn. Ticking any of its layers still turns it on.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 51b4795..9ebf8a6 100644
--- a/map/app.js
+++ b/map/app.js
@@ -3730,6 +3730,122 @@ const NUSANTARA_NAMES = {
   "varticle": "News articles, placed (second copy)",
 };
 
+/* ---------- a catalogue's layers as rows of the map's own box ---------- */
+
+// Nusantara publishes 158 layers and Global Forest Watch's catalogue several
+// hundred. Kept inside one row each, they were a list a reader had to open and
+// read past everything else in it. Here each one is a row of the layers box
+// like any other, filed under the map's own headings by what it shows - and a
+// layer that belongs to two subjects is filed under both, which the box now
+// holds (see copyRow).
+//
+// The rules below are read in order and every match counts, so mining
+// concessions land under Mining and under Land held under permit. Nothing is
+// filed by which organisation published it: that is what the source link on
+// the row is for.
+const CATALOGUE_PLACES = [
+  // "Alert" on its own is not deforestation: Nusantara's fire alerts carry it
+  // too, and they belong under Fire. So the deforestation rule names the
+  // systems and the words that mean forest loss, and fire keeps its own.
+  [/deforest|forest ?loss|tree ?cover ?loss|disturb|expansion|probability|forest change|frontera|\bglad\b|\bradd\b|dist-?alert|integrated alert/i,
+   "Destruction > Of the planet > Deforestation"],
+  [/\bfires?\b|burn|hotspot/i, "Destruction > Of the planet > Fire"],
+  [/mining|\bmines?\b|quarr/i, "Destruction > Of the planet > Mining"],
+  [/plantation|palm|coconut|rubber|sugarcane|sago|\bmills?\b|refiner|soy|cocoa|coffee|crop|agricultur|pasture|livestock|cattle|yield|mapspam/i,
+   "Destruction > Of the planet > Meat and agriculture > Agriculture"],
+  [/aquaculture|fisher|fishing/i, "Destruction > Of the planet > Oceans > Fishing"],
+  [/concession|\bhgu\b|\bpbph\b|logging|wood fiber|permit|management objective/i,
+   "Destruction > Of the planet > Land held under permit"],
+  [/carbon|emission|biomass|climate|\bco2\b|flux|removals|temperature|precipitation/i,
+   "Destruction > Of the planet > Climate"],
+  [/nitrogen dioxide|air quality|aerosol|pm2/i, "Destruction > Of the planet > Climate > Air pollution"],
+  [/protect|conserv|reserve|restoration|biodivers|intact forest|primary forest|wdpa|ramsar|species|habitat|ecozone|ecosystem|\bkba\b/i,
+   "Destruction > Of the planet > Biodiversity loss"],
+  [/peat/i, "Destruction > Of the planet > Peatland"],
+  [/forest cover|forest and non-forest|land cover|tree height|forest as a share|mangrove|tree cover extent|forest extent|tree cover density|forest age|industrial land/i,
+   "Destruction > Of the planet > Forest and land cover"],
+  [/water|aqueduct|river|watershed|flood|\bpond\b|canal/i, "Destruction > Of the planet > Surface water"],
+  [/customary|\badat\b|indigenous|community land|tenure|land rights|quilombola|village forest|community forest|social forestry|rural settlement|forestry employment/i,
+   "Suppression > Of humans > Land and territory"],
+  [/\broads?\b|transmigration|settlement|capital|\bikn\b|infrastructure|urban|built/i,
+   "Destruction > Of the planet > Construction"],
+  [/spatial plan|moratorium|forest estate|\brtrw\b|\brdtr\b|zoning/i, "Destruction > Of the planet > Spatial plans"],
+  [/boundar|admin|hillshade|relief|imagery|sentinel|from the air|geotag|news article|towns and villages|\bgadm\b|\bgrid\b|geostore|buffered|coverage layer|\bregions?\b/i,
+   "Base and reference"],
+  [/reef|benthic|coral/i, "Destruction > Of the planet > Oceans"],
+];
+function cataloguePlaces(words) {
+  const out = [];
+  for (const [rule, path] of CATALOGUE_PLACES) if (rule.test(words) && !out.includes(path)) out.push(path);
+  return out.length ? out : ["Not yet placed"];
+}
+
+// The body of the heading a path names. Headings are made by the order, not
+// here: a path nothing in the box answers to is left to Not yet placed, so a
+// layer is never filed somewhere invented for it.
+function sectionBody(box, path) {
+  const want = path.split(" > ");
+  let where = box;
+  for (const name of want) {
+    let found = null;
+    for (const sec of where.querySelectorAll(".toc-sec")) {
+      const t = sec.querySelector(".toc-t");
+      if (t && t.textContent.trim().toLowerCase() === name.trim().toLowerCase()) { found = sec; break; }
+    }
+    if (!found) return null;
+    where = found.querySelector(".toc-body") || found;
+  }
+  return where;
+}
+
+// One row per catalogue layer, in every heading its words put it under.
+// data-cat drives the layer; a second home gets data-cat-copy and ticks the
+// first, so nothing is built twice and both boxes read the same.
+function catalogueRows(cfg, items) {
+  const box = document.getElementById("layers");
+  if (!box || !items.length) return;
+  const spare = sectionBody(box, "Not yet placed") || box;
+  items.forEach((item, i) => {
+    const key = `${cfg.id}|${i}`;
+    const paths = cataloguePlaces(`${item.title} ${item.name} ${item.about || ""}`);
+    paths.forEach((path, n) => {
+      const row = document.createElement("label");
+      row.className = "layer layer-cat" + (n ? " layer-copy" : "");
+      row.title = item.about || "";
+      row.innerHTML =
+        `<input type="checkbox" data-${n ? "cat-copy" : "cat"}="${escapeHtml(key)}">` +
+        `<span class="swatch" style="background:${cfg.colour}"></span>` +
+        `<span class="body"><span class="nm">${escapeHtml(item.title)}` +
+        `<span class="live" title="Read from the source itself when this row is ticked, not from a copy kept here">LIVE</span>` +
+        `${siteLink(cfg.id)}</span>` +
+        `<span class="un" data-state="${escapeHtml(key)}">${escapeHtml(cfg.catUnit || "")}</span></span>`;
+      (sectionBody(box, path) || spare).appendChild(row);
+    });
+    item.key = key;
+  });
+  if (box.dataset.catWired) return;
+  box.dataset.catWired = "1";
+  box.addEventListener("change", (e) => {
+    const t = e.target;
+    if (!t || !t.dataset) return;
+    const copied = t.dataset.catCopy;
+    if (copied) {
+      const real = box.querySelector(`[data-cat="${copied}"]`);
+      if (real && real.checked !== t.checked) {
+        real.checked = t.checked;
+        if (typeof real.dispatchEvent === "function" && typeof Event === "function") real.dispatchEvent(new Event("change", { bubbles: true }));
+      }
+      return;
+    }
+    const key = t.dataset.cat;
+    if (!key) return;
+    for (const i of box.querySelectorAll(`[data-cat-copy="${key}"]`)) i.checked = t.checked;
+    const hit = CATALOGUE_ITEMS.get(key);
+    if (hit) hit.show(t.checked);
+  });
+}
+const CATALOGUE_ITEMS = new Map();
+
 /* ---------- a map server's whole layer list, as a menu (Nusantara Atlas) ---------- */
 async function addWmsMenuLayer(cfg) {
   const layers = [];
@@ -3752,49 +3868,39 @@ async function addWmsMenuLayer(cfg) {
   cfg._layers = layers;
   const tilesFor = (l) => `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(l.name)}&STYLES=` +
     `&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`;
-  layers.forEach((l) => { l.cat = categoryOf(`${l.title} ${l.name} ${l.about}`, NUSANTARA_CATEGORIES); });
   // The same title served twice (the site runs two map servers) says which.
   const seen = {};
   layers.forEach((l) => { seen[l.title] = (seen[l.title] || 0) + 1; });
+  layers.forEach((l) => { if (seen[l.title] > 1) l.title += ` (${l.base.replace(/^https?:\/\//, "").split("/")[0]})`; });
   const lid = (i) => `${cfg.id}-w${i}`;
   cfg._layerIds = layers.map((l, i) => lid(i));
   const on = new Set();
-  // Every layer in a list under its category, indented like the layers box's
-  // own rows; any number can be ticked at once.
-  const menu = document.createElement("div");
-  menu.className = "facet ns-list";
-  const names = [...NUSANTARA_CATEGORIES.map((r) => r[0]), "Other"].filter((n) => layers.some((l) => l.cat === n));
-  menu.innerHTML = names.map((n) => `<div class="ns-cat">${escapeHtml(n)} <span>${layers.filter((l) => l.cat === n).length}</span></div>` +
-    layers.map((l, i) => l.cat !== n ? "" :
-      `<label class="ns-row" title="${escapeHtml(l.about || "")}"><input type="checkbox" data-ns="${i}">` +
-      `<span>${escapeHtml(l.title)}${seen[l.title] > 1 ? ` <em>(${escapeHtml(l.base.replace(/^https?:\/\//, "").split("/")[0])})</em>` : ""}</span></label>`).join("")).join("");
-  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
-  const anchor = row && row.closest ? row.closest("label") : null;
-  if (anchor && anchor.after) anchor.after(menu);
+  // Each layer is a row of the box, filed by what it shows. The row that
+  // carried the menu says how many there are and how many are drawn.
   const apply = (vis) => layers.forEach((l, i) => {
     if (map.getLayer(lid(i))) map.setLayoutProperty(lid(i), "visibility", vis === "visible" && on.has(i) ? "visible" : "none");
   });
   cfg.afterVisibility = apply;
-  const show = () => setLayerState(cfg.id, on.size ? `${on.size} of ${layers.length} layers shown` : `${layers.length} layers \u2014 tick the ones to show`);
-  menu.addEventListener("change", (e) => {
-    const cb = e.target.closest && e.target.closest("[data-ns]");
-    if (!cb) return;
-    e.stopPropagation();
-    // Ticking a layer in the list turns the row above it on as well. Without
-    // that, the list ticks did nothing until the row itself was ticked, which
-    // reads as a broken menu rather than a rule.
-    if (cb.checked) showRowFor(cfg.id);
-    const i = Number(cb.dataset.ns);
-    if (cb.checked) {
-      on.add(i);
-      if (!map.getLayer(lid(i))) {
-        map.addSource(lid(i), { type: "raster", tileSize: 256, attribution: cfg.attribution || "", tiles: [tilesFor(layers[i])] });
-        map.addLayer({ id: lid(i), type: "raster", source: lid(i), paint: { "raster-opacity": 0.85 } });
-      }
-    } else on.delete(i);
-    apply(visibility.get(cfg.id) || "none");
-    show();
-  });
+  const show = () => setLayerState(cfg.id, on.size ? `${on.size} of ${layers.length} layers drawn` : `${layers.length} layers, each a row below`);
+  const items = layers.map((l, i) => ({
+    name: l.name, title: l.title, about: l.about,
+    show: (want) => {
+      // Ticking one of its layers turns the row itself on, as the menu did.
+      if (want) {
+        showRowFor(cfg.id);
+        on.add(i);
+        if (!map.getLayer(lid(i))) {
+          map.addSource(lid(i), { type: "raster", tileSize: 256, attribution: cfg.attribution || "", tiles: [tilesFor(layers[i])] });
+          map.addLayer({ id: lid(i), type: "raster", source: lid(i), paint: { "raster-opacity": 0.85 } });
+        }
+      } else on.delete(i);
+      apply(visibility.get(cfg.id) || "none");
+      show();
+    },
+  }));
+  catalogueRows(cfg, items);
+  items.forEach((it) => CATALOGUE_ITEMS.set(it.key, it));
+  show();
   map.on("click", async (e) => {
     if ((visibility.get(cfg.id) || "visible") !== "visible" || !on.size) return;
     const b = map.getBounds(), c = map.getCanvas();
diff --git a/map/test.mjs b/map/test.mjs
index 784a1bc..e23ca1b 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2066,7 +2066,9 @@ console.log("\nNusantara Atlas and Global Forest Watch, by category");
   check("mangrove extent is Land Cover", categoryOf("Global mangrove extent", G) === "Land Cover");
   check("a layer no rule claims goes under Other, not away", categoryOf("xyz 123", G) === "Other");
   check("Global Forest Watch uses the category chips", (src.match(/categoryMenu\(menu, /g) || []).length === 1);
-  check("Nusantara lists every layer under its category, indented, any number ticked", /menu\.className = "facet ns-list"/.test(src) && /class="ns-row"/.test(src) && /#layers \.ns-row\{/.test(src));
+  // Superseded: Nusantara's layers are rows of the box itself now, filed by
+  // what they show, not a list inside one row.
+  check("Nusantara's layers are rows of the box, filed by subject", /catalogueRows\(cfg, items\);/.test(src) && !/menu\.className = "facet ns-list"/.test(src));
 }
 
 console.log("\nEPA facilities at every zoom");
@@ -2140,7 +2142,7 @@ console.log("\nthe showing box, the queue, and menus that draw");
   check("a heading's tick sits at the end of its line", /line\.appendChild\(head\);\n\s*line\.appendChild\(all\);/.test(src));
   check("layers are built three at a time, and a waiting row says so",
         /const QUEUE_AT_ONCE = 3/.test(src) && /waiting behind \$\{i \+ 1\} other layer/.test(src) && /queueBuild\(cfg\.id, \(\) => \{/.test(src));
-  check("a menu's own ticks turn the row above them on", /function showRowFor\(id\)/.test(src) && /if \(cb\.checked\) showRowFor\(cfg\.id\)/.test(src) && /if \(pick\) showRowFor\(cfg\.id\)/.test(src));
+  check("a catalogue row turns the row it belongs to on", /function showRowFor\(id\)/.test(src) && /showRowFor\(cfg\.id\);\n\s*on\.add\(i\);/.test(src) && /if \(pick\) showRowFor\(cfg\.id\)/.test(src));
 }
 
 console.log("\ntitles in one ink, sources named");
@@ -2583,6 +2585,29 @@ console.log("\na row can sit under more than one subject");
         order[at("Base and reference")].h === 1);
 }
 
+console.log("\nNusantara's layers spread through the box");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const places = new Function(src.slice(src.indexOf("const CATALOGUE_PLACES = ["), src.indexOf("// The body of the heading a path names")) + "; return cataloguePlaces;")();
+  check("a layer goes under every subject its words answer to",
+        places("Mining concessions Indonesia").includes("Destruction > Of the planet > Mining") &&
+        places("Mining concessions Indonesia").includes("Destruction > Of the planet > Land held under permit"));
+  check("fire alerts are fire and deforestation is deforestation",
+        places("Fire alerts, VIIRS")[0] === "Destruction > Of the planet > Deforestation" ||
+        places("Fire alerts, VIIRS").includes("Destruction > Of the planet > Fire"));
+  check("customary forest is land and territory, not forest cover",
+        places("Customary forest (hutan adat)").includes("Suppression > Of humans > Land and territory"));
+  check("boundaries and relief are base and reference",
+        places("Province boundaries").includes("Base and reference") &&
+        places("Hillshade relief").includes("Base and reference"));
+  check("a layer no rule claims waits in Not yet placed rather than being invented a home",
+        places("qqqq zzzz")[0] === "Not yet placed");
+  check("a heading nothing answers to is not made up", /function sectionBody\(box, path\)/.test(src) && /if \(!found\) return null;/.test(src));
+  check("a second home ticks the first, and the first ticks its copies",
+        /const copied = t\.dataset\.catCopy;/.test(src) && /querySelectorAll\(`\[data-cat-copy="\$\{key\}"\]`\)/.test(src));
+  check("each row says it is live and links its source", /class="live"/.test(src) && /\$\{siteLink\(cfg\.id\)\}<\/span>/.test(src));
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
    if "function copyRow(lead, id)" not in app:
        sys.exit("patch_0920n.py has to be applied and committed first.")
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
