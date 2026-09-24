#!/usr/bin/env python3
"""patch_0920d.py - the column drags alone, Carbon Mapper through the Worker,
the duplicate launch rows out.

    cd ~/Desktop/culprits
    python3 patch_0920d.py

Goes on top of patch_0920c.py, which must be applied and committed first.
Independent of patch_0920b.py, so that one can be either side of this.

Three things:

1. Dragging the layers column widened the view and wires boxes on the right as
   well, because the handle set --box-w, which every box measures from. The left
   column now has its own --left-w, which is what the handle drags: the layers
   box, the Showing box under it and the left half of the defence frame. The
   boxes on the right keep --box-w and do not move.

2. Carbon Mapper answers a plain browser GET with 200 and no
   Access-Control-Allow-Origin, so the browser refuses the response before the
   map sees a status - that was "Failed to fetch". The endpoint and its
   parameters were right all along; only the origin was the problem. A
   /v1/carbonmapper route on the Worker passes the catalogue back untouched with
   its own CORS headers, forwarding only the parameters the row sends, and the
   row reads it through WORKER. Nothing is reshaped, so the field mapping in
   addCarbonMapperLayer gets its first real test once this is deployed.

   THIS HALF NEEDS A WORKER DEPLOY as well as a push:

       cd worker && npx wrangler deploy

   Until that runs, the row will say the Worker answered 404.

3. When Rockets Fly and Next Spaceflight are the same upcoming launches and the
   same pads as the two Launch Library 2 rows, as framed pages rather than as
   map data. Both go into PANEL_REMOVED, beside Next Spaceflight's locations
   page, which was already there. The LL2 rows are untouched.

Tests: three for the column, two for the launch rows, three for the Carbon
Mapper route, and the four that pinned the old --box-w behaviour are updated.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 66cee44..8ea00a7 100644
--- a/map/app.js
+++ b/map/app.js
@@ -18,6 +18,12 @@ const DATA_BASE = abs("./data");
 const R2_BASE = "https://tiles.welcometoyourgalaxy.com";
 const WORKER = "https://culprits-proxy.welcometoyourgalaxy.workers.dev/v1";
 
+// Read through the Worker. api.carbonmapper.org answers a plain browser GET
+// with 200 and no Access-Control-Allow-Origin, so the response is refused
+// before the map sees a status and the row read "Failed to fetch". The
+// Worker passes the catalogue back untouched with its own CORS headers.
+const CARBON_API = `${WORKER}/carbonmapper`;
+
 // One entry per layer. `colour` carries identity only — magnitude is encoded
 // per layer, because tonnes of CO2e and hectares of land are not comparable
 // and a shared size ramp would imply that they are.
@@ -3321,8 +3327,12 @@ function showRowFor(id) {
 // The layers column's right edge is a handle. Long layer names were being cut
 // at 290 pixels with no way to see the rest; now the column is dragged as wide
 // as it needs to be and dragged back for more map. Double-click puts it back to
-// where it started. The width is the same --box-w everything else measures
-// from, so the zoom strip and the defence frame move with it.
+// where it started.
+//
+// It drags --left-w, which is the left column's own width: the layers box, the
+// Showing box under it and the left half of the defence frame. Dragging used to
+// set --box-w, which the view and wires boxes on the right measure from too, so
+// widening the layers column widened those as well.
 function columnEdge() {
   const col = typeof document !== "undefined" && document.querySelector ? document.querySelector(".left-col") : null;
   if (!col || typeof col.querySelector !== "function" || col.querySelector(".col-edge") ||
@@ -3335,7 +3345,7 @@ function columnEdge() {
   edge.setAttribute("aria-hidden", "true");
   let from = 0, was = START;
   const widthNow = () => {
-    const v = parseFloat(getComputedStyle(root).getPropertyValue("--box-w"));
+    const v = parseFloat(getComputedStyle(root).getPropertyValue("--left-w"));
     return isFinite(v) ? v : START;
   };
   edge.addEventListener("pointerdown", (e) => {
@@ -3347,12 +3357,12 @@ function columnEdge() {
   edge.addEventListener("pointermove", (e) => {
     if (!from) return;
     const want = Math.max(MIN, Math.min(MAX, was + (e.clientX - from)));
-    root.style.setProperty("--box-w", `${Math.round(want)}px`);
+    root.style.setProperty("--left-w", `${Math.round(want)}px`);
   });
   const done = () => { from = 0; if (map && typeof map.resize === "function") map.resize(); };
   edge.addEventListener("pointerup", done);
   edge.addEventListener("pointercancel", done);
-  edge.addEventListener("dblclick", () => { root.style.setProperty("--box-w", `${START}px`); done(); });
+  edge.addEventListener("dblclick", () => { root.style.setProperty("--left-w", `${START}px`); done(); });
   col.appendChild(edge);
 }
 /* ---------- Carbon Mapper's plumes, read from its own data platform ---------- */
@@ -3371,7 +3381,6 @@ function columnEdge() {
 // The catalogue is large, so the row reads the newest CARBON_PLUME_PAGES pages
 // and says how many of the total it is holding rather than pretending to have
 // all of it.
-const CARBON_API = "https://api.carbonmapper.org/api/v1/catalog/plumes/annotated";
 const CARBON_PLUME_ZOOM = 10;     // from here in, the plumes' own pictures
 const CARBON_PLUME_PAGES = 10;    // 1,000 plumes a page
 const CARBON_PICTURES_AT_ONCE = 40;
@@ -8013,7 +8022,7 @@ const PANEL_ORDER = [
   { h: 3, t: "Unidentified aerial phenomena" },
   { h: 2, t: "From Earth" },
   { h: 3, t: "The space industry" }, "space_industry",
-  { h: 3, t: "Space launches" }, "ll2_pads", "ll2_upcoming", "wrf", "nsf_launches",
+  { h: 3, t: "Space launches" }, "ll2_pads", "ll2_upcoming",
   { h: 3, t: "Protecting extraterrestrial life" }, "biosignature",
 
   { h: 1, t: "Buildings" }, "building_types",
@@ -8028,6 +8037,9 @@ const PANEL_REMOVED = new Set([
   "gmo_releases",
   // Removed at the owner's request, 20 September.
   "acgf",
+  // The same upcoming launches and the same pads as the two Launch Library 2
+  // rows, but as framed pages rather than on the map.
+  "wrf", "nsf_launches",
   // Replaced by carbon_plumes, which reads Carbon Mapper's own platform rather
   // than the handful of plumes listed on our page.
   "site_carbon_mapper_waste",
diff --git a/map/index.html b/map/index.html
index 7c2e392..54acc3b 100644
--- a/map/index.html
+++ b/map/index.html
@@ -12,7 +12,7 @@
     --sans:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
     /* One width for the layer panel, the news wires box, and the legend and
        zoom buttons side by side. */
-    --box-w:290px; --zoom-w:29px; --box-gap:6px;
+    --box-w:290px; --left-w:var(--box-w); --zoom-w:29px; --box-gap:6px;
   }
   *{box-sizing:border-box}
   html,body{margin:0;height:100%;overflow:hidden;background:var(--peat);color:var(--bone);font-family:var(--sans)}
@@ -59,9 +59,9 @@
     background:radial-gradient(ellipse at center, rgba(0,0,0,0) 68%, rgba(4,16,22,.30) 100%)}
   #defence-hud[hidden]{display:none}
   #defence-hud .br{position:absolute;width:56px;height:56px;border:1px solid rgba(63,167,163,.28)}
-  #defence-hud .tl{top:10px;left:calc(var(--box-w) + 32px);border-right:0;border-bottom:0}
+  #defence-hud .tl{top:10px;left:calc(var(--left-w) + 32px);border-right:0;border-bottom:0}
   #defence-hud .tr{top:10px;right:calc(var(--box-w) + 24px);border-left:0;border-bottom:0}
-  #defence-hud .bl{bottom:34px;left:calc(var(--box-w) + 32px);border-right:0;border-top:0}
+  #defence-hud .bl{bottom:34px;left:calc(var(--left-w) + 32px);border-right:0;border-top:0}
   #defence-hud .bre{bottom:34px;right:calc(var(--box-w) + 24px);border-left:0;border-top:0}
   .defence-ping{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;
     border:1px solid rgba(63,167,163,.55);pointer-events:none;z-index:2;animation:defence-ping .7s ease-out forwards}
@@ -107,7 +107,7 @@
   .col-edge::before{content:"";position:absolute;top:50%;right:5px;width:2px;height:34px;
     margin-top:-17px;border-radius:2px;background:var(--rule)}
   .col-edge:hover::before{background:var(--dim)}
-  .left-col{position:absolute;top:16px;left:16px;width:var(--box-w);bottom:calc(16px + var(--legend-h,0px));
+  .left-col{position:absolute;top:16px;left:16px;width:var(--left-w);bottom:calc(16px + var(--legend-h,0px));
     display:flex;flex-direction:column;gap:8px;pointer-events:none}
   .left-col .panel{flex:1 1 auto}
   /* The view and basemap box, top right; the news wires box sits under it. */
@@ -234,7 +234,7 @@
 
   /* Legend. Bottom right, above the attribution, narrow enough not to cover
      the map. Lists only what is switched on. */
-  #legend{position:absolute;left:16px;bottom:16px;z-index:2;width:var(--box-w);max-width:none;
+  #legend{position:absolute;left:16px;bottom:16px;z-index:2;width:var(--left-w);max-width:none;
     background:rgba(17,21,15,.88);border:1px solid var(--rule);border-radius:2px;
     padding:6px 8px;font-size:11px;line-height:1.35;color:var(--dim);
     max-height:42vh;overflow-y:auto}
diff --git a/map/test.mjs b/map/test.mjs
index 744e93f..29fe0bc 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1190,11 +1190,11 @@ console.log("\nthe boxes");
   const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   check("one width is declared for every box", /--box-w:\s*290px/.test(index) && /--zoom-w:\s*29px/.test(index));
-  check("the boxes down the left take it", /\.left-col\{[\s\S]{0,120}width:var\(--box-w\)/.test(index));
+  check("the boxes down the left take it, through their own --left-w", /--left-w:var\(--box-w\)/.test(index) && /\.left-col\{[\s\S]{0,120}width:var\(--left-w\)/.test(index));
   check("the news wires box takes it too, no longer 440px",
         /width:min\(var\(--box-w,290px\),calc\(100vw - 18px\)\)/.test(wireSrc) && !/440px/.test(wireSrc));
-  check("the legend is as wide as the wires box",
-        /#legend\{position:absolute;left:16px;bottom:16px;z-index:2;width:var\(--box-w\)/.test(index));
+  check("the legend is as wide as the layers column above it",
+        /#legend\{position:absolute;left:16px;bottom:16px;z-index:2;width:var\(--left-w\)/.test(index));
   check("the zoom buttons are back in the view row, one above the other",
         /function moveZoomButtons/.test(src) && /getElementById\("view-zoom"\)/.test(src) &&
         /<div class="view-zoom" id="view-zoom"><\/div>/.test(src) &&
@@ -2062,7 +2062,7 @@ console.log("\nthe column's edge, the meat rows, the reefs close in");
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
   const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
   check("the layers column is dragged wider by its right edge, and put back by a double-click",
-        /function columnEdge\(\)/.test(src) && /root\.style\.setProperty\("--box-w"/.test(src) && /\.col-edge\{position:absolute/.test(index));
+        /function columnEdge\(\)/.test(src) && /root\.style\.setProperty\("--left-w"/.test(src) && /\.col-edge\{position:absolute/.test(index));
   check("the two modelled meat rows are built by the routes that know them",
         /else if \(cfg\.route === "cafo"\) addCafoLayer\(cfg\);/.test(src) && /else if \(cfg\.route === "glw"\) addGlwLayer\(cfg\);/.test(src) &&
         /id:"abattoir_cafo"[^\n]*lazy:true/.test(src) && /id:"abattoir_glw"[^\n]*lazy:true/.test(src));
@@ -2076,7 +2076,7 @@ console.log("\nCarbon Mapper's plumes, from their own platform");
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const o = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
   check("the row reads Carbon Mapper's catalogue, not the handful on our own page",
-        /const CARBON_API = "https:\/\/api\.carbonmapper\.org\/api\/v1\/catalog\/plumes\/annotated"/.test(src) &&
+        /const CARBON_API = `\$\{WORKER\}\/carbonmapper`;/.test(src) &&
         o.PANEL_ORDER.includes("carbon_plumes") && o.PANEL_REMOVED.has("site_carbon_mapper_waste"));
   check("it pages through the catalogue and says how much of it is held",
         /offset=\$\{page \* 1000\}/.test(src) && /of \$\{total\.toLocaleString\(\)\} published/.test(src));
@@ -2338,6 +2338,40 @@ console.log("\nHydroWASTE on the map; the EIP and HydroFATE page rows gone");
   check("the Environmental Integrity Project and HydroFATE page rows are gone", !/id: "eip_inventory"/.test(src) && !/id: "hydrofate"/.test(src));
 }
 
+console.log("\nthe layers column drags on its own");
+{
+  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const edge = src.slice(src.indexOf("function columnEdge("), src.indexOf("/* ---------- Carbon Mapper"));
+  check("the left column has a width of its own", /--left-w:var\(--box-w\)/.test(html) &&
+        /\.left-col\{[^}]*width:var\(--left-w\)/.test(html) && /#legend\{[^}]*width:var\(--left-w\)/.test(html));
+  check("the boxes on the right keep the starting width", /\.right-col\{[^}]*width:var\(--box-w\)/.test(html));
+  check("the handle drags the left column, not everything", /--left-w/.test(edge) && !/--box-w/.test(edge));
+}
+
+console.log("\nlaunches are drawn, not framed");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("const PANEL_REMOVED = new Set(["), src.indexOf("function panelNodes("));
+  check("the two Launch Library 2 rows are still there", /id: "ll2_pads"/.test(src) && /id: "ll2_upcoming"/.test(src));
+  check("the framed pages showing the same launches and pads are out",
+        ["wrf", "nsf_launches", "nsf_locations"].every((i) => new RegExp(`"${i}"`).test(body)));
+}
+
+console.log("\nCarbon Mapper is read through the Worker");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const worker = fs.readFileSync(path.join(HERE, "..", "worker", "index.js"), "utf8");
+  check("the row asks the Worker, not the API directly",
+        /const CARBON_API = `\$\{WORKER\}\/carbonmapper`;/.test(src) &&
+        !/getJson\(`https:\/\/api\.carbonmapper\.org/.test(src));
+  check("the Worker has the route and passes the catalogue back unchanged",
+        /url\.pathname === "\/v1\/carbonmapper"/.test(worker) &&
+        /const CARBON_MAPPER_BASE = "https:\/\/api\.carbonmapper\.org\/api\/v1\/catalog\/plumes\/annotated";/.test(worker));
+  check("only the parameters the row sends are forwarded",
+        /\["limit", "offset", "sort", "bbox", "plume_gas", "datetime"\]/.test(worker));
+}
+
 console.log("\nGlobal Safety Net fixes; My Maps titles");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
diff --git a/worker/index.js b/worker/index.js
index 2c32e26..697678e 100644
--- a/worker/index.js
+++ b/worker/index.js
@@ -36,7 +36,7 @@ const CACHE_VERSION = "v12";
 // Reported by /v1/_diag so it is possible to tell, in one request, which build
 // is actually live. Several fixes appeared not to work when the real problem
 // was that the deploy had not happened.
-const BUILD = "2026-09-14 cerulean slicks and sources, allen coral benthic";
+const BUILD = "2026-09-20 carbon mapper passthrough; cerulean slicks and sources, allen coral benthic";
 
 // How far back deforestation alerts are fetched. Wider means more rows and a
 // slower, heavier query; the API has no LIMIT to fall back on.
@@ -57,6 +57,7 @@ const ALERT_WINDOW_DAYS = 30;
 let gfwVersion = { value: null, at: 0 };
 const GFW_VERSION_TTL = 6 * 3600 * 1000;
 const GFW_BASE = "https://data-api.globalforestwatch.org";
+const CARBON_MAPPER_BASE = "https://api.carbonmapper.org/api/v1/catalog/plumes/annotated";
 const GFW_MAX_LOOKBACK = 6;
 
 async function gfwLatestVersion(env) {
@@ -832,6 +833,41 @@ export default {
     // and the key never leaves the Worker.
     //   /v1/_gfw?path=/dataset/gfw_integrated_alerts
     //   /v1/_gfw?path=/dataset/gfw_integrated_alerts/latest/fields
+    // Carbon Mapper's plume catalogue, passed through untouched.
+    //
+    // api.carbonmapper.org answers a plain GET with 200 and no
+    // Access-Control-Allow-Origin, so the browser refuses the response before
+    // the map ever sees a status - the row read "Failed to fetch". Nothing is
+    // reshaped here: the catalogue's own JSON goes back as it arrives, with
+    // this Worker's CORS headers on it. Only the parameters the row sends are
+    // forwarded, so this cannot be used as an open proxy for the rest of the API.
+    if (url.pathname === "/v1/carbonmapper") {
+      const pass = new URLSearchParams();
+      for (const k of ["limit", "offset", "sort", "bbox", "plume_gas", "datetime"]) {
+        const v = url.searchParams.get(k);
+        if (v !== null && v !== "") pass.set(k, v);
+      }
+      const target = `${CARBON_MAPPER_BASE}?${pass.toString()}`;
+      const key = new Request(`${url.origin}${url.pathname}?${pass.toString()}&_c=${CACHE_VERSION}`);
+      const fresh = url.searchParams.get("fresh") === "1";
+      const hit = fresh ? null : await cache.match(key);
+      if (hit) return withCors(hit, origin);
+      let upstream;
+      try {
+        upstream = await fetch(target, { headers: { Accept: "application/json" } });
+      } catch (e) {
+        return bad(`Carbon Mapper unreachable: ${e.message}`, 502, origin);
+      }
+      if (!upstream.ok) return bad(`Carbon Mapper answered ${upstream.status}`, upstream.status, origin);
+      const body = await upstream.text();
+      const stored = new Response(body, {
+        status: 200,
+        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
+      });
+      ctx.waitUntil(cache.put(key, stored.clone()));
+      return withCors(stored, origin);
+    }
+
     if (url.pathname === "/v1/_gfw") {
       const rel = url.searchParams.get("path") || "";
       if (!rel.startsWith("/")) return bad("path must start with /", 400, origin);
"""


def run(args, text=None):
    return subprocess.run(args, input=text, capture_output=True, text=True)


def main():
    if run(["git", "rev-parse", "--is-inside-work-tree"]).returncode != 0:
        sys.exit("Not a git repository. Run this from ~/Desktop/culprits.")

    try:
        html = open("map/index.html", encoding="utf-8").read()
    except OSError:
        sys.exit("map/index.html not found. Run this from the top of the repo.")
    if "#layers .layer{gap:6px;padding:0;" not in html:
        sys.exit("patch_0920c.py has to be applied and committed first.")

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

    print("Applied. Changed: map/app.js, map/index.html, map/test.mjs, worker/index.js")
    print("Run the suites, then push AND deploy the Worker:")
    print("    cd map && node test.mjs && node wire.test.mjs")
    print("    cd ../worker && node test.mjs && npx wrangler deploy")


if __name__ == "__main__":
    main()
