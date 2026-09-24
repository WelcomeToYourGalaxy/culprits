#!/usr/bin/env python3
"""
Round of 23 September (18): every field in the boxes that picked their own. Built against e9929c5.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index ebf267b..3937d9b 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -846,6 +846,17 @@ saves after each day, stops at 100 minutes, and carries on next run
 (`cerulean_archive/refill.json`). Mines' first file is 96.7 MB (92 MiB), under
 the 95 MiB cut.
 
+## Round of 23 September (18): every field in the boxes that picked their own
+
+Item 9 of the handed-over list (every field a source publishes reaches the
+box), checked across all 29 popups. The ones that chose fields by hand now
+show the rest too: Global Trade Alert (every type, not six), Giga (the whole
+country record), Allen Coral (every field of the patch), the Climate TRACE
+columns (every field, not five), the shape layers' own text and list (whole,
+not 1,200 characters and 40 entries) and EPA's picture (every facility hit,
+not eight). Long ones scroll. Site maps use their own boxes, and harvested
+layers read their pieces, so both were already whole.
+
 ## Round of 23 September (16): owner's answers of 23 September
 
 - EPA: every dot kept from the world view (the owner's choice), 17 MB first square.
diff --git a/map/app.js b/map/app.js
index e2dce35..f3bb001 100644
--- a/map/app.js
+++ b/map/app.js
@@ -6079,7 +6079,7 @@ async function addGtaLayer(cfg) {
     return `<b>${escapeHtml(p.gta)}</b>` +
       `<div class="meta">${c.total.toLocaleString()} state acts: ${dot("Red")}${c.red.toLocaleString()} Red, ${dot("Amber")}${c.amber.toLocaleString()} Amber, ` +
       `${dot("Green")}${c.green.toLocaleString()} Green; ${c.in_force.toLocaleString()} with a measure in force</div>` +
-      `<div class="meta">Commonest: ${Object.entries(c.types || {}).slice(0, 6).map(([t, n]) => `${escapeHtml(t)} (${n})`).join(", ")}</div>` +
+      `<div class="meta" style="max-height:120px;overflow:auto">By type: ${Object.entries(c.types || {}).map(([t, n]) => `${escapeHtml(t)} (${n})`).join(", ")}</div>` +
       `<div class="meta" style="max-height:220px;overflow:auto">${(c.latest || []).map((a) => `<div style="margin:5px 0">${dot(a.eval)}<b>${escapeHtml(a.date || "")}</b> ` +
         `${escapeHtml(a.title)}<br><span style="font-size:11px">${escapeHtml(a.text || "")}</span></div>`).join("")}</div>` +
       `<div class="meta">Global Trade Alert</div>`;
@@ -6197,12 +6197,13 @@ async function addArcgisDynLayer(cfg) {
       `&imageDisplay=${c.clientWidth},${c.clientHeight},96&returnGeometry=false&f=json`;
     try {
       const j = await getJson(q, 20000);
-      const hits = (j.results || []).slice(0, 8);
+      // Every facility the click touches, in a box that scrolls (it was the first eight).
+      const hits = j.results || [];
       if (!hits.length) return;
-      new maplibregl.Popup({ maxWidth: "340px" }).setLngLat(e.lngLat).setHTML(hits.map((h) =>
+      new maplibregl.Popup({ maxWidth: "340px" }).setLngLat(e.lngLat).setHTML(`<div style="max-height:360px;overflow:auto">` + hits.map((h) =>
         `<b>${escapeHtml(h.value || (h.attributes && h.attributes.PRIMARY_NAME) || "")}</b><div class="meta">${escapeHtml(h.layerName || "")}</div>` +
-        `<table class="meta">${fieldRows(Object.fromEntries(Object.entries(h.attributes || {}).filter(([k, v]) => v !== "Null" && !/^(OBJECTID|Shape)$/i.test(k))))}</table>`).join("<hr>") +
-        `<div class="meta">US EPA Envirofacts</div>`).addTo(map);
+        `<table class="meta">${fieldRows(Object.fromEntries(Object.entries(h.attributes || {}).filter(([k, v]) => v !== "Null" && !/^(OBJECTID|Shape)$/i.test(k))))}</table>`).join("<hr>") + `</div>` +
+        `<div class="meta">${hits.length.toLocaleString()} ${hits.length === 1 ? "record" : "records"} here \u00b7 US EPA Envirofacts</div>`).addTo(map);
     } catch (err) { /* nothing there */ }
   });
   setLayerState(cfg.id, `${layers.length} kinds of facility \u00b7 ${cfg.points ? "a weekly copy of every point wider out; EPA's own picture from about state level in" : "drawn from about state level in"}`);
@@ -6245,6 +6246,9 @@ async function addGigaLayer(cfg) {
       `<div class="meta">Connectivity data: ${escapeHtml(pretty(c.connectivity_availability))}; coverage data: ${escapeHtml(pretty(c.coverage_availability))}</div>` +
       (c.data_source ? `<div class="meta">Data source: ${escapeHtml(c.data_source)}</div>` : "") +
       (c.date_schools_mapped ? `<div class="meta">Mapped: ${escapeHtml(c.date_schools_mapped)}</div>` : "") +
+      // Every other field Giga gives for the country, as it names it.
+      `<div style="max-height:200px;overflow:auto"><table class="meta">${fieldRows(c, ["flag", "name", "entity_counts", "schools_with_data_percentage",
+        "connectivity_availability", "coverage_availability", "data_source", "date_schools_mapped"])}</table></div>` +
       `<div class="meta">Giga (UNICEF and ITU)</div>`;
   });
   const row = document.querySelector(`[data-layer="${cfg.id}"]`);
@@ -6626,9 +6630,7 @@ function addColumnLayer() {
       `<div class="meta">${escapeHtml(p.layerName || "")}</div>` +
       (isFinite(v) ? `<div class="meta">${Math.round(v).toLocaleString()} t CO\u2082e/yr (GWP-100)` +
         (n > 1 ? ", together" : "") + `</div>` : "") +
-      (n > 1 ? "" : ["x_asset_definition", "x_period", "x_capacity", "x_capacity_units", "x_gas"]
-        .filter((k) => p[k] != null && p[k] !== "")
-        .map((k) => `<div class="meta">${k.replace(/^x_/, "").replace(/_/g, " ")}: ${escapeHtml(String(p[k]))}</div>`).join(""));
+      (n > 1 ? "" : `<div style="max-height:200px;overflow:auto"><table class="meta">${fieldRows(p, ["_count", "layerName", "name", "value"])}</table></div>`);
   });
   map.on("moveend", scheduleColumns);
   map.on("sourcedata", (e) => {
@@ -7197,6 +7199,7 @@ function addCoralLayer(cfg) {
     `<b>${p.class_name || "Unclassified"}</b>` +
     (p.area_sqkm != null
       ? `<div class="meta">This mapped patch: ${Number(p.area_sqkm).toPrecision(3)} km²</div>` : "") +
+    `<table class="meta">${fieldRows(p, ["class_name", "area_sqkm"])}</table>` +
     `<div class="meta">Allen Coral Atlas benthic habitat, from satellite imagery ` +
     `to about 10 m depth. A class of seabed, not a survey of living coral.</div>`);
   // A layer that draws nothing looks the same whether it is working over open
@@ -7739,15 +7742,16 @@ async function addShapesLayer(cfg) {
     const skip = new Set(["name", "country", "title", "list", "from_the_map", "entries"]);
     const rows = Object.entries(p).filter(([k, v]) => !k.startsWith("_") && !skip.has(k) && v !== "" && v != null)
       .map(([k, v]) => `${shapeText(k.replace(/[_.]/g, " "))}: ${shapeText(v)}`);   // every field, in full
-    const said = p.from_the_map ? shapeText(p.from_the_map).slice(0, 1200) : "";
+    // Whole, in a box that scrolls: the text and the list were cut at 1,200
+    // characters and 40 entries until 23 September.
+    const said = p.from_the_map ? shapeText(p.from_the_map) : "";
     const list = p.list ? String(p.list).split("\n") : [];
-    const shown = list.slice(0, 40).map((l) => shapeText(l).slice(0, 300));
+    const shown = list.map((l) => shapeText(l));
     return `<b>${shapeText(title)}</b>` +
-      (said ? `<div class="meta">${said}</div>` : "") +
+      (said ? `<div class="meta" style="max-height:200px;overflow:auto">${said}</div>` : "") +
       (rows.length ? `<div class="meta">${rows.join("<br>")}</div>` : "") +
-      (shown.length ? `<div class="meta">${Number(p.entries || list.length).toLocaleString()} entries:<br>` +
-        shown.join("<br>") + (list.length > 40 ? `<br>…and ${(list.length - 40).toLocaleString()} more in the source file` : "") +
-        `</div>` : "");
+      (shown.length ? `<div class="meta" style="max-height:240px;overflow:auto">${Number(p.entries || list.length).toLocaleString()} entries:<br>` +
+        shown.join("<br>") + `</div>` : "");
   };
   // A layer built with its long text kept apart reads it on the first click.
   const popup = (p) => (data.details && p._k != null
diff --git a/map/test.mjs b/map/test.mjs
index 2c7c283..c2617b6 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -3445,5 +3445,15 @@ console.log("\nround of 23 September (17): the F-gas chips from the build's own
         /choicesUrl: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/edgar\/fgases_choices\.json"/.test(src) &&
         /if \(cfg\.choicesUrl && !cfg\._choicesRead\)/.test(src) && /if \(d && Array\.isArray\(d\.choices\) && d\.choices\.length\) cfg\.choices = d\.choices;/.test(src));
 }
+console.log("\nround of 23 September (18): every field in the boxes that picked their own");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("Global Trade Alert's box lists every type of act, not the first six", !/Object\.entries\(c\.types \|\| \{\}\)\.slice\(0, 6\)/.test(src));
+  check("Giga's box shows every field of the country's record", /fieldRows\(c, \["flag", "name", "entity_counts"/.test(src));
+  check("a reef patch's box shows every field the Atlas gives it", /fieldRows\(p, \["class_name", "area_sqkm"\]\)/.test(src));
+  check("a Climate TRACE column's box shows every field, not five", /fieldRows\(p, \["_count", "layerName", "name", "value"\]\)/.test(src) && !/\["x_asset_definition", "x_period", "x_capacity"/.test(src));
+  check("a click on EPA's picture lists every facility it touches, not the first eight", /const hits = j\.results \|\| \[\];/.test(src));
+  check("a shape's own words and list are shown whole, in a box that scrolls", !/shapeText\(p\.from_the_map\)\.slice\(0, 1200\)/.test(src) && !/list\.slice\(0, 40\)/.test(src));
+}
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail ? 1 : 0);
'''

if "mollweide_inverse" not in (pathlib.Path.cwd() / "pipeline/wastewater_build.py").read_text() if (pathlib.Path.cwd() / "pipeline/wastewater_build.py").exists() else True:
    sys.exit("round_0923d.py has to be applied first; nothing was changed.")
if not (pathlib.Path.cwd() / "map/app.js").exists():
    sys.exit("Run this from the culprits-tiles-more folder (scripts/trase.py not found here).")
with tempfile.NamedTemporaryFile("w", suffix=".diff", delete=False) as f:
    f.write(DIFF)
    patch = f.name
def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)
if git("apply", "--check", "--reverse", patch).returncode == 0 or git("apply", "--check", "--reverse", "-C1", patch).returncode == 0:
    sys.exit("Already applied: nothing to do.")
check = git("apply", "--check", patch)
if check.returncode == 0:
    done = git("apply", patch)
    if done.returncode != 0:
        sys.exit(done.stderr)
else:
    # Edits in the working files not yet committed (another session's): fit
    # the change by one line of context either side instead of three, which
    # finds its place when those edits sit next to it. Nothing is changed if
    # even that does not fit.
    three = git("apply", "-C1", patch)
    if three.returncode != 0:
        touched = sorted(set(l[6:] for l in DIFF.splitlines() if l.startswith("+++ b/")))
        st = git("status", "--short", "--", *touched).stdout
        sys.exit("This patch does not fit the files on disk, so nothing was changed.\n" + check.stderr +
                 "\nFiles it touches that differ from the last commit on this Mac:\n" + (st or "  (none)\n") +
                 "Paste this message back.")
    print(three.stderr.strip())
print("Applied.")
