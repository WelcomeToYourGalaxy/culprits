#!/usr/bin/env python3
"""patch_0920m.py - live rows say so; clearer pull handles; no leftover
scrollbar; Of individuals gains its kinds.

    cd ~/Desktop/culprits
    python3 patch_0920m.py

Goes on top of ee27950.

1. Every row that reads its source as you look at it now carries a small LIVE
   beside its title, with a note saying what that means: read from the source
   itself when the row is ticked, not from a copy kept here. Archives,
   sitemaps, shapes and country shadings are copies and carry no mark, so the
   difference is visible rather than something a reader has to know.

2. The pull handle was a hairline nobody found. It is now a bar sitting in a
   lip, brighter on hover, and the strip it lives in is taller to grab.

3. A box pulled right down kept scrolling what it was hiding, so a scrollbar
   stood down the side of a box with nothing in it. At the minimum it stops
   scrolling; a double-click on the handle puts it back as before.

4. Of individuals, under Destruction, gains Of humans, Of animals, Of plants
   and Of microscopics, matching Of groups above it. The animal sacrifice row
   moves under Of animals. Of groups already carried these four and its
   "insentient", so it is unchanged.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 06a10c7..1587037 100644
--- a/map/app.js
+++ b/map/app.js
@@ -4975,10 +4975,16 @@ function makePullable(el, edge) {
 
   let from = 0, height = 0;
   const ceiling = () => Math.max(PULL_MIN + 20, (typeof window !== "undefined" ? window.innerHeight : 800) - 60);
+  // Pulled right down, a box is a title bar and nothing else - but it still
+  // scrolls what it is hiding, so the scrollbar stayed down the side of a box
+  // with nothing in it. At the minimum the box stops scrolling.
+  const settle = (h) => { if (el.classList) el.classList.toggle("pulled-shut", h <= PULL_MIN + 4); };
   const move = (e) => {
     const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : from);
     el.style.maxHeight = "none";
-    el.style.height = pullHeight(height, y - from, edge, PULL_MIN, ceiling()) + "px";
+    const h = pullHeight(height, y - from, edge, PULL_MIN, ceiling());
+    el.style.height = h + "px";
+    settle(h);
   };
   const stop = () => {
     document.removeEventListener("pointermove", move);
@@ -4991,7 +4997,7 @@ function makePullable(el, edge) {
     document.addEventListener("pointermove", move);
     document.addEventListener("pointerup", stop);
   });
-  grip.addEventListener("dblclick", () => { el.style.height = ""; el.style.maxHeight = ""; });
+  grip.addEventListener("dblclick", () => { el.style.height = ""; el.style.maxHeight = ""; settle(999); });
 }
 
 // The news wires box is built by wire.js, which runs after this file.
@@ -6876,7 +6882,7 @@ function groupRows(group) {
     row.innerHTML =
       `<input type="checkbox" data-layer="${child.id}">` +
       `<span class="swatch" style="background:${child.colour}"></span>` +
-      `<span class="body"><span class="nm">${child.name}${siteLink(child.id)}</span>` +
+      `<span class="body"><span class="nm">${child.name}${liveMark(child)}${siteLink(child.id)}</span>` +
       `<span class="un" data-state="${child.id}">not loaded</span></span>`;
     kids.appendChild(row);
   });
@@ -7913,7 +7919,7 @@ function buildPanel() {
       // cannot take the map down with it.
       `<input type="checkbox"${cfg.off ? "" : " checked"} data-layer="${cfg.id}">` +
       `<span class="swatch" style="background:${cfg.colour}"></span>` +
-      `<span class="body"><span class="nm">${cfg.name}${siteLink(cfg.id)}</span>` +
+      `<span class="body"><span class="nm">${cfg.name}${liveMark(cfg)}${siteLink(cfg.id)}</span>` +
       `<span class="un" data-state="${cfg.id}">${cfg.unit}</span></span>`;
     box.appendChild(row);
     if (cfg.facet) box.appendChild(facetRow(cfg));
@@ -8396,6 +8402,22 @@ function siteLink(id) {
     `title="Open ${escapeHtml(host)}" aria-label="Open ${escapeHtml(host)}, the source of this layer">\u2197</a>`;
 }
 
+// Which rows read their source as you look at them, rather than a copy kept
+// here. A reader cannot tell by looking, and the difference matters: a live row
+// shows what the source says right now and goes dark when the source does; a
+// copy is as old as its last build. Archives, sitemaps, shapes and country
+// shadings are copies and carry no mark.
+const LIVE_ROUTES = new Set([
+  "worker", "tile", "wmts", "rasterlive", "cerulean", "coral", "carbonmapper",
+  "arcgis", "arcgisdyn", "arcgisapp", "umap", "kml", "ll2", "ejatlas", "geojsonlive",
+  "wpgmza", "atlascities", "trase", "trasefac", "wmsmenu", "gfwmenu", "giga", "gta",
+  "rte", "owidgrapher", "spheres", "companion",
+]);
+function liveMark(cfg) {
+  if (!cfg || !LIVE_ROUTES.has(cfg.route)) return "";
+  return `<span class="live" title="Read from the source itself when this row is ticked, not from a copy kept here">LIVE</span>`;
+}
+
 /* ---------- the layers box, in the order and under the headings chosen ---------- */
 // Strings are layer ids; "group:" a whole group; "gm" the guerillamap row.
 // { h: level, t: text } is a heading. Anything not named here goes under
@@ -8445,7 +8467,11 @@ const PANEL_ORDER = [
   { h: 3, t: "Of plants" },
   { h: 3, t: "Of microorganisms" },
   { h: 3, t: "Of the \u201cinsentient\u201d" },
-  { h: 2, t: "Of individuals" }, "site_animal_sacrifice",
+  { h: 2, t: "Of individuals" },
+  { h: 3, t: "Of humans" },
+  { h: 3, t: "Of animals" }, "site_animal_sacrifice",
+  { h: 3, t: "Of plants" },
+  { h: 3, t: "Of microscopics" },
 
   { h: 1, t: "Suppression" },
   { h: 2, t: "Of humans" },
diff --git a/map/index.html b/map/index.html
index 59da91b..303c069 100644
--- a/map/index.html
+++ b/map/index.html
@@ -280,10 +280,21 @@
   .to-globe:hover{border-color:var(--bone)}
 
   /* The grip each box is pulled by. */
-  .pull-grip{flex:none;height:9px;cursor:ns-resize;position:relative;touch-action:none}
-  .pull-grip::before{content:"";position:absolute;left:50%;top:50%;width:34px;height:2px;margin:-1px 0 0 -17px;
-    border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
-  .pull-grip:hover::before{border-color:var(--dim)}
+  /* The handle that pulls a box open or shut. It was a hairline nobody
+     found: now a bar with a lip above and below it, brighter on hover. */
+  .pull-grip{flex:none;height:16px;cursor:ns-resize;position:relative;touch-action:none}
+  .pull-grip::before{content:"";position:absolute;left:50%;top:50%;width:46px;height:4px;margin:-2px 0 0 -23px;
+    border-radius:2px;background:var(--dim);opacity:.7}
+  .pull-grip::after{content:"";position:absolute;left:50%;top:50%;width:70px;height:12px;margin:-6px 0 0 -35px;
+    border-radius:3px;border:1px solid var(--rule)}
+  .pull-grip:hover::before{background:var(--bone);opacity:1}
+  .pull-grip:hover::after{border-color:var(--dim)}
+  /* Pulled right down, a box stops scrolling what it is hiding, so no
+     scrollbar is left standing down the side of an empty box. */
+  .pulled-shut{overflow:hidden !important}
+  /* Live rows say so, beside the title. */
+  #layers .nm .live{margin-left:5px;padding:0 3px;border:1px solid var(--rule);border-radius:2px;
+    color:var(--dim);font-size:8.5px;letter-spacing:.08em;vertical-align:1px}
   .panel,#legend{overflow:auto}
   /* The grip stays on the box's edge while its contents scroll under it. */
   .panel .pull-grip{position:sticky;bottom:0;margin-top:8px;background:rgba(31,28,21,.94)}
diff --git a/map/test.mjs b/map/test.mjs
index 8dbf826..823b827 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2458,8 +2458,8 @@ console.log("\neach row links the site it is read from");
         /github\.com\/WelcomeToYourGalaxy\/anti-slavery-map/.test(sites.slavery_ports || ""));
   check("Trase's rows point at Trase", /trase\.earth/.test(sites.trase_palm_indonesia || ""));
   check("the link is drawn beside the title, on a row and on a group's child",
-        /<span class="nm">\$\{cfg\.name\}\$\{siteLink\(cfg\.id\)\}<\/span>/.test(src) &&
-        /<span class="nm">\$\{child\.name\}\$\{siteLink\(child\.id\)\}<\/span>/.test(src));
+        /<span class="nm">\$\{cfg\.name\}\$\{liveMark\(cfg\)\}\$\{siteLink\(cfg\.id\)\}<\/span>/.test(src) &&
+        /<span class="nm">\$\{child\.name\}\$\{liveMark\(child\)\}\$\{siteLink\(child\.id\)\}<\/span>/.test(src));
   check("a row with no site shows no link rather than a guessed one",
         /const u = LAYER_SITE\[id\];\n  if \(!u\) return "";/.test(src) && /#layers \.nm \.src\{/.test(index));
   check("titles that named no source say so now",
@@ -2530,6 +2530,28 @@ console.log("\nplumes show from the world view; the last sources named");
         /name: "Biosignature Evidence Assessment \(Welcome to Your Galaxy\)"/.test(src));
 }
 
+console.log("\nlive rows say so; the grips read as handles; a shut box stops scrolling");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
+  const live = new Function(src.slice(src.indexOf("const LIVE_ROUTES = new Set(["), src.indexOf("function liveMark(")) + "; return LIVE_ROUTES;")();
+  check("the routes that read their source as you look are marked live",
+        ["worker", "cerulean", "coral", "carbonmapper", "wmsmenu", "gfwmenu", "trase", "ll2"].every((r) => live.has(r)));
+  check("copies carry no mark", !live.has("pmtiles") && !live.has("sitemap") && !live.has("shapes") && !live.has("country"));
+  check("the mark says what it means, and is drawn beside the title",
+        /not from a copy kept here/.test(src) && /#layers \.nm \.live\{/.test(index));
+  check("a box pulled right down stops scrolling", /classList\.toggle\("pulled-shut", h <= PULL_MIN \+ 4\)/.test(src) &&
+        /\.pulled-shut\{overflow:hidden !important\}/.test(index));
+  check("the pull handle is a bar in a lip, not a hairline",
+        /\.pull-grip\{flex:none;height:16px/.test(index) && /\.pull-grip::after\{/.test(index) &&
+        /\.pull-grip:hover::before\{background:var\(--bone\)/.test(index));
+  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("const PANEL_REMOVED"));
+  const order = new Function(body + "; return PANEL_ORDER;")();
+  const at = (t) => order.findIndex((x) => x && x.t === t);
+  const kinds = order.map((x, i) => (x && x.h === 3 && ["Of humans", "Of animals", "Of plants", "Of microscopics"].includes(x.t) ? i : -1)).filter((i) => i > at("Of individuals"));
+  check("Of individuals holds the same kinds as Of groups", kinds.length === 4);
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
    if "CARBON_CLUSTER_TO = CARBON_PLUME_ZOOM" not in app:
        sys.exit("patch_0920l.py has to be applied and committed first.")
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
    print("Applied. Changed: map/app.js, map/index.html, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
