#!/usr/bin/env python3
"""patch_0920n.py - a row can sit under more than one subject; the eight new
headings.

    cd ~/Desktop/culprits
    python3 patch_0920n.py

Goes on top of 49c79e3. This is the first half of spreading Nusantara's and
GFW's layers through the map's own categories: the box learns to hold a row in
two places, and the headings those layers need are put in. The layers
themselves follow in the next patch.

1. Naming a layer twice in the order now works. The first naming moves the row
   itself; every later one gets a copy of it. A copy carries data-copy instead
   of data-layer, so nothing that counts rows or drives layers sees it twice,
   and its tick is wired to the row it copies: tick either and the layer is
   drawn once, and both read the same. The row's own tools - the drag grip and
   the fold - stay with the row. Headings count their copies in the number
   beside them.

2. Eight headings go in, in the order's own style and folded shut like the
   rest: Fire, Forest and land cover, Land held under permit, Spatial plans,
   Peatland and Surface water under Of the planet; Land and territory under
   Suppression > Of humans; and Base and reference as its own section beside
   Buildings, for the boundaries, roads, relief and imagery that are not
   destruction but what you read it against.

Nothing moves yet: every row sits where it sat, and the new headings are empty
until the next patch fills them.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 1587037..51b4795 100644
--- a/map/app.js
+++ b/map/app.js
@@ -7982,8 +7982,21 @@ function buildPanel() {
       return;
     }
 
+    // A copy has no layer of its own: it ticks the row it copies, and
+    // everything follows from there as if the row had been clicked.
+    const copied = e.target.dataset && e.target.dataset.copy;
+    if (copied) {
+      const real = box.querySelector(`[data-layer="${copied}"]`);
+      if (real && real.checked !== e.target.checked) {
+        real.checked = e.target.checked;
+        if (typeof real.dispatchEvent === "function" && typeof Event === "function") real.dispatchEvent(new Event("change", { bubbles: true }));
+      }
+      return;
+    }
+
     const id = e.target.dataset.layer;
     if (!id) return;
+    syncCopies(box, id, e.target.checked);
     // Remembered, because layers load asynchronously: a toggle flipped before
     // its archive arrives would otherwise be lost and the layer would appear.
     visibility.set(id, e.target.checked ? "visible" : "none");
@@ -8442,10 +8455,16 @@ const PANEL_ORDER = [
   { h: 3, t: "Pollution" }, "epa_tri_sites", "epa_widget",
   { h: 4, t: "Wastewater" }, "hydrowaste",
   { h: 4, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
+  { h: 3, t: "Fire" },
+  { h: 3, t: "Forest and land cover" },
   { h: 3, t: "Deforestation" }, "soilgrids", "trase_measures", "trase_pulp_indonesia",
     "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023", "nusantara",
   { h: 4, t: "Global Forest Watch" }, "glad_loss", "group:forest_alerts", "gfw_catalogue",
   { h: 3, t: "Biodiversity loss" }, "gsn", "gsn_rankings", "allen_coral", "atlas_hotspots", "atlas_cities", "pe_subsidising", "powerbi_report",
+  { h: 3, t: "Land held under permit" },
+  { h: 3, t: "Spatial plans" },
+  { h: 3, t: "Peatland" },
+  { h: 3, t: "Surface water" },
   { h: 3, t: "Mining" }, "mines_global",
   { h: 3, t: "Meat and agriculture" },
   { h: 4, t: "Agriculture" }, "land_matrix", "palmwatch", "trase_palm_indonesia", "trase_silos_brazil", "trase_cocoa_ivory",
@@ -8475,6 +8494,7 @@ const PANEL_ORDER = [
 
   { h: 1, t: "Suppression" },
   { h: 2, t: "Of humans" },
+  { h: 3, t: "Land and territory" },
   { h: 3, t: "Physical suppression" },
   { h: 4, t: "Control of physical resources" }, "site_central_banks", "site_banking_dynasties", "site_export_credit", "site_wealth_atlas",
     "site_earmarked_funding", "site_trade_profits", "site_social_spheres",
@@ -8519,6 +8539,7 @@ const PANEL_ORDER = [
   { h: 3, t: "Space launches" }, "ll2_pads", "ll2_upcoming",
   { h: 3, t: "Protecting extraterrestrial life" }, "biosignature",
 
+  { h: 1, t: "Base and reference" },
   { h: 1, t: "Buildings" }, "building_types",
 ];
 const PANEL_REMOVED = new Set([
@@ -8565,6 +8586,30 @@ function syncHeadingBoxes(box) {
   }
 }
 
+// A second home for a row already placed elsewhere. The copy is the row's own
+// markup with its tick renamed, so it cannot be mistaken for the row itself by
+// anything that reads [data-layer]; its chips and menus stay with the original,
+// which is where a row's own controls belong.
+function copyRow(lead, id) {
+  if (!lead || typeof lead.cloneNode !== "function") return null;
+  const first = lead.querySelector ? lead.querySelector("[data-layer]") : null;
+  const copy = lead.cloneNode(true);
+  copy.classList.add("layer-copy");
+  const input = copy.querySelector("[data-layer]");
+  if (input) {
+    input.removeAttribute("data-layer");
+    input.dataset.copy = id;
+    input.checked = first.checked;
+  }
+  for (const tool of copy.querySelectorAll(".grip, .fold")) tool.remove();
+  return copy;
+}
+
+// Every copy of a row reads what the row reads.
+function syncCopies(box, id, on) {
+  for (const i of box.querySelectorAll(`[data-copy="${id}"]`)) i.checked = on;
+}
+
 function panelNodes(box, key) {
   let lead = null;
   if (key === "gm") { const i = box.querySelector("[data-gm]"); lead = i && i.closest("label"); }
@@ -8788,6 +8833,9 @@ function arrangePanel() {
   box.dataset.arranged = "1";
   const frag = document.createDocumentFragment();
   const placed = new Set();
+  // The row itself, kept so a second naming can copy it: by then it has been
+  // moved into the fragment being built and is no longer found in the box.
+  const leads = new Map();
   // Each heading is a section that folds; the rows under it go in its body,
   // nested by level. Every section starts folded shut.
   const stack = [{ level: 0, body: frag }];
@@ -8824,7 +8872,7 @@ function arrangePanel() {
     all.addEventListener("click", (e) => e.stopPropagation());
     all.addEventListener("change", () => {
       const on = all.checked;
-      for (const i of body.querySelectorAll("[data-layer]")) {
+      for (const i of body.querySelectorAll("[data-layer], [data-copy]")) {
         if (i.checked === on) continue;
         i.checked = on;
         if (typeof i.dispatchEvent === "function" && typeof Event === "function") i.dispatchEvent(new Event("change", { bubbles: true }));
@@ -8855,9 +8903,19 @@ function arrangePanel() {
       continue;
     }
     if (typeof item === "object") { heading(item.h, item.t); continue; }
+    // A layer that belongs to two subjects is named twice in the order. The
+    // first naming moves the row itself; every later one gets a copy that
+    // mirrors it - tick either and the layer is drawn once, and both read the
+    // same. Copies carry data-copy rather than data-layer, so nothing that
+    // counts or drives layers sees a row twice.
+    if (placed.has(item)) {
+      const copy = copyRow(leads.get(item), item);
+      if (copy) into().appendChild(copy);
+      continue;
+    }
     const nodes = panelNodes(box, item);
     nodes.forEach((n) => into().appendChild(n));
-    if (nodes.length) placed.add(item);
+    if (nodes.length) { placed.add(item); leads.set(item, nodes[0]); }
   }
   // Removed rows go into a hidden holder, so code that looks them up still finds them.
   const gone = document.createElement("div");
@@ -8887,7 +8945,7 @@ function arrangePanel() {
   });
   // Beside each heading, how many layers are inside it.
   for (const sec of box.querySelectorAll(".toc-sec")) {
-    const n = sec.querySelectorAll("[data-layer], [data-gm]").length;
+    const n = sec.querySelectorAll("[data-layer], [data-copy], [data-gm]").length;
     const el = sec.querySelector(".toc-n");
     if (el) el.textContent = n ? String(n) : "none yet";
   }
diff --git a/map/test.mjs b/map/test.mjs
index 823b827..784a1bc 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2183,7 +2183,7 @@ console.log("\nheading ticks, chips in words, a named archive");
   const order = new Function(body + "; return PANEL_ORDER;")();
   const at = (t) => order.findIndex((x) => x && x.t === t);
   check("every heading takes a tick that shows or hides everything under it",
-        /all\.className = "toc-all"/.test(src) && /for \(const i of body\.querySelectorAll\("\[data-layer\]"\)\)/.test(src));
+        /all\.className = "toc-all"/.test(src) && /for \(const i of body\.querySelectorAll\("\[data-layer\], \[data-copy\]"\)\)/.test(src));
   check("unticking a heading clears its layers and its groups' boxes too",
         /for \(const g of body\.querySelectorAll\("\[data-group\]"\)\) \{\n\s*g\.checked = on;/.test(src));
   check("the tick reads its layers: all, none or part-way",
@@ -2552,6 +2552,37 @@ console.log("\nlive rows say so; the grips read as handles; a shut box stops scr
   check("Of individuals holds the same kinds as Of groups", kinds.length === 4);
 }
 
+console.log("\na row can sit under more than one subject");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("a second naming makes a copy, not a second row",
+        /if \(placed\.has\(item\)\) \{\n\s*const copy = copyRow\(leads\.get\(item\), item\);/.test(src) &&
+        /function copyRow\(lead, id\)/.test(src));
+  // The row has been moved into the fragment being built by the time a second
+  // naming comes round, so it is kept rather than looked for in the box.
+  check("the copy is taken from the row itself, wherever it has got to",
+        /const leads = new Map\(\);/.test(src) && /leads\.set\(item, nodes\[0\]\)/.test(src));
+  check("a copy carries data-copy, so nothing that drives layers counts it twice",
+        /input\.removeAttribute\("data-layer"\);\n\s*input\.dataset\.copy = id;/.test(src));
+  check("ticking a copy ticks the row it copies, and the row ticks its copies",
+        /const copied = e\.target\.dataset && e\.target\.dataset\.copy;/.test(src) &&
+        /syncCopies\(box, id, e\.target\.checked\);/.test(src));
+  check("a copy leaves the row's own tools with the row", /for \(const tool of copy\.querySelectorAll\("\.grip, \.fold"\)\) tool\.remove\(\);/.test(src));
+  check("headings count copies in the number beside them",
+        /sec\.querySelectorAll\("\[data-layer\], \[data-copy\], \[data-gm\]"\)\.length/.test(src));
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED"));
+  const order = new Function(body + "; return PANEL_ORDER;")();
+  const at = (t) => order.findIndex((x) => x && x.t === t);
+  check("the eight new headings are in, in the order's own style",
+        ["Fire", "Forest and land cover", "Land held under permit", "Spatial plans", "Peatland",
+         "Surface water", "Base and reference", "Land and territory"].every((t) => at(t) > -1));
+  check("the planet's new headings sit under Of the planet, before Of groups",
+        ["Fire", "Forest and land cover", "Land held under permit", "Spatial plans", "Peatland", "Surface water"]
+          .every((t) => at(t) > at("Of the planet") && at(t) < at("Of groups")));
+  check("Base and reference is its own section, beside Buildings", at("Base and reference") < at("Buildings") &&
+        order[at("Base and reference")].h === 1);
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
    if "LIVE_ROUTES" not in app:
        sys.exit("patch_0920m.py has to be applied and committed first.")
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
