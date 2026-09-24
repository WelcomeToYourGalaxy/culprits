#!/usr/bin/env python3
"""
Round of 23 September (9): a refresh note beside every row's LIVE / NOT LIVE mark; a Position line in
every dot's box; a Place names tick box; the Satellite lowlands far less green. Built against e2be4ea.
"""
import pathlib, subprocess, sys, tempfile

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index ff94aca..7ee154f 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -761,6 +761,26 @@ owner's request, so a land-cover layer that no other rule claims gets no row
 and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
 list was not made: Nusantara has one moratorium layer and it is a forest one.
 
+## Round of 23 September (9): refresh notes, positions, place names, the green cast
+
+- **Refresh notes**: `refreshNote(cfg)` adds a small note after every LIVE /
+  NOT LIVE mark. Live rows: "read afresh each time it is ticked" (as the map
+  moves for `worker` and `cerulean`). Copies: the rhythm read from the row's
+  NOT_LIVE reason, note and name (hourly, daily, weekly, every four weeks,
+  made once); where none is said, "copy; renewed when rebuilt, no set rhythm".
+- **Positions**: every dot's box gets a "Position:" line (`positionText`),
+  added by wrapping `maplibregl.Popup.prototype.setHTML/setDOMContent` with
+  the point under the last click. Precision fields first (`x_precision`,
+  `precise`), then `POSITION_BY_ROW` / `POSITION_BY_PREFIX`, else "The
+  coordinates the source gives; it does not say how exact they are." A box
+  that already says (`POSITION_SAID`) is left alone.
+- **Place names** tick box beside 3D terrain: empties every symbol layer's
+  `text-field` and restores it (kept in `namesField`); remembered in
+  localStorage; applied again on `styledata` while off.
+- **Satellite**: the lowland stops of `SAT_RELIEF.colour` (1, 400, 1000 m) are
+  far less green at the same darkness and alpha; nothing else in the look
+  changed. (The Satellite basemap is also being worked on in another chat.)
+
 ## Round of 23 September (7): the EPA copy, rebuilt in parts
 
 The first unmerged EPA build was over 95 MB at every depth, and the old
diff --git a/map/app.js b/map/app.js
index c062d7f..dafd5ed 100644
--- a/map/app.js
+++ b/map/app.js
@@ -838,7 +838,10 @@ const SAT_RELIEF = {
   colour: ["interpolate", ["linear"], ["elevation"],
     -8000, "rgba(10,22,42,0.8)", -3500, "rgba(12,28,50,0.72)", -1200, "rgba(16,40,60,0.6)",
     -200, "rgba(26,70,86,0.38)", -40, "rgba(40,96,102,0.22)", 0, "rgba(40,90,90,0.1)",
-    1, "rgba(30,60,26,0.32)", 400, "rgba(34,62,28,0.3)", 1000, "rgba(62,76,40,0.28)",
+    // The lowland green was cut back on 23 September: over the flat half of
+    // every continent it read as a green cast from the world view. Same
+    // darkness and see-through, far less green; the slopes and sea unchanged.
+    1, "rgba(46,52,34,0.32)", 400, "rgba(48,54,36,0.3)", 1000, "rgba(64,70,44,0.28)",
     1700, "rgba(108,100,66,0.26)", 2500, "rgba(118,90,60,0.3)", 3300, "rgba(110,80,62,0.32)",
     4300, "rgba(102,92,84,0.3)", 5500, "rgba(132,128,122,0.2)"],
   colourOpacity: 1,
@@ -6781,6 +6784,9 @@ function viewPanelHtml() {
     `<div class="terrain-row"><div class="terrain-left"><label class="layer"><input type="checkbox" id="terrain-toggle"${TERRAIN_ON ? " checked" : ""}` +
     ` title="Ground height under the imagery, on the globe or the flat map.">` +
     `<span class="nm">3D terrain</span></label>` +
+    `<label class="layer"><input type="checkbox" id="names-toggle"${NAMES_ON ? " checked" : ""}` +
+    ` title="Every place name on the map: the basemap's and the layers' own.">` +
+    `<span class="nm">Place names</span></label>` +
     `<div class="compass-holder" id="compass-holder" title="Click to stand the map upright, facing north">` +
     `<span class="compass-cap">Click: north up, level</span></div></div>` +
     `<div class="how-boxes">` +
@@ -6813,9 +6819,38 @@ function buildBasemapPanel() {
     if (e.target && e.target.name === "basemap") setBasemap(e.target.value);
     if (e.target && e.target.name === "view") setView(e.target.value);
     if (e.target && e.target.id === "terrain-toggle") setTerrain(e.target.checked);
+    if (e.target && e.target.id === "names-toggle") setNames(e.target.checked);
   });
 }
 
+// Place names on and off, all at once (asked for 23 September): every symbol
+// layer's words, the basemap's and the layers' own. The words are taken out
+// of the layer (its text-field emptied) and put back as they were, so the
+// layer's own showing, hiding and see-through setting are left alone. A layer
+// added while names are off comes in without its words.
+let NAMES_ON = true;
+try { NAMES_ON = localStorage.getItem("culprits-names") !== "off"; } catch (e) { /* storage refused: names on */ }
+const namesField = new Map();          // layer id -> its own text-field
+function namesApply() {
+  const st = map.getStyle && map.getStyle();
+  for (const l of (st && st.layers) || []) {
+    if (l.type !== "symbol") continue;
+    const cur = map.getLayoutProperty(l.id, "text-field");
+    if (NAMES_ON) {
+      if (namesField.has(l.id)) { map.setLayoutProperty(l.id, "text-field", namesField.get(l.id)); namesField.delete(l.id); }
+    } else if (cur !== undefined && cur !== "" && !namesField.has(l.id)) {
+      namesField.set(l.id, cur);
+      map.setLayoutProperty(l.id, "text-field", "");
+    }
+  }
+}
+function setNames(on) {
+  NAMES_ON = !!on;
+  try { localStorage.setItem("culprits-names", NAMES_ON ? "on" : "off"); } catch (e) { /* not kept */ }
+  namesApply();
+}
+map.on("styledata", () => { if (!NAMES_ON) namesApply(); });
+
 // Choropleth fills belong under the point layers so they don't hide them. But
 // the point layers are added asynchronously too, so the id may not exist yet —
 // and MapLibre throws on a beforeId that isn't there. Return undefined in that
@@ -9165,6 +9200,81 @@ const TRASE_DATA = {
 };
 
 const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS, EXEC_MAP, MONEY_MAP, LEGAL_MAP, LEG_MAP, JUD_MAP, MORE_MAPS, GMO_MAP, OTHER_MAPS, FOREST_ALERTS, TRASE_DATA];
+/* ---------- where a dot is: every point's box says how exact its position is ---------- */
+// Asked for 23 September: each dot's box says whether it is the place itself
+// (exact coordinates), a town or city, an area's centre, or placed from a name
+// or address. A box that already says so (Climate TRACE's precision, My Maps
+// places found from an address) is left as it is. What a source does not say
+// is not guessed: the line then says the coordinates are the source's own and
+// that it gives no measure of how exact they are.
+const POSITION_BY_ROW = {
+  atlas_cities: "Placed from the city's name through an OpenStreetMap lookup: the city, not a site in it.",
+  wasteatlas_cities: "Waste Atlas's marker for the city; its figures are for the whole city, not this point.",
+  wasteatlas_countries: "Waste Atlas's marker for the country; its figures are for the whole country, not this point.",
+  wastewater_n_tot: "A modelled coastal outlet: where the model has this watershed's wastewater reach the sea, not a pipe or plant.",
+  wastewater_n_treated: "A modelled coastal outlet: where the model has this watershed's wastewater reach the sea, not a pipe or plant.",
+  wastewater_n_septic: "A modelled coastal outlet: where the model has this watershed's wastewater reach the sea, not a pipe or plant.",
+  wastewater_n_open: "A modelled coastal outlet: where the model has this watershed's wastewater reach the sea, not a pipe or plant.",
+  carbon_plumes: "Where the plume was detected from the air or from orbit, at the moment of the pass.",
+  epa_widget: "EPA's recorded coordinates for the facility.",
+  ll2_pads: "The launch pad's own coordinates, as Launch Library 2 gives them.",
+};
+const POSITION_BY_PREFIX = [
+  [/^ct_air/, "Climate TRACE's own coordinates for the source."],
+  [/^wasteatlas_/, "Waste Atlas's own coordinates for the facility; it gives no measure of how exact they are."],
+  [/^climate_trace/, "Climate TRACE's own coordinates for the source."],
+];
+const POSITION_SAID = /Position found from its address|Plotted at the country|plotted at its centroid|plotted at its centre|plotted at a single point|plotted at one point|deliberately coarsened|Placed at the town or village|A vessel, not a site|data-pos=/;
+function positionText(props, rowId) {
+  const p = props || {};
+  if (p.x_precision && !/^(exact|asset|facility|high|point)$/i.test(String(p.x_precision))) return "";
+  if (p.x_precision) return "The source's own coordinates for the site itself.";
+  if (p.precise === 1 || p.precise === "1") return "The facility's own position, as the source gives it.";
+  if (p.precise === 0 || p.precise === "0") return "An area the source gives, drawn at one point in it; not the site itself.";
+  if (rowId && POSITION_BY_ROW[rowId]) return POSITION_BY_ROW[rowId];
+  for (const [re, t] of POSITION_BY_PREFIX) if (rowId && re.test(rowId)) return t;
+  return "The coordinates the source gives; it does not say how exact they are.";
+}
+let lastPoint = null;          // the dot under the last click, for the box it opens
+function positionNotesInit() {
+  if (positionNotesInit.done || typeof maplibregl === "undefined" || !maplibregl.Popup) return;
+  positionNotesInit.done = true;
+  map.on("click", (e) => {
+    lastPoint = null;
+    let hits = [];
+    try { hits = map.queryRenderedFeatures(e.point) || []; } catch (err) { return; }
+    const f = hits.find((h) => h.geometry && h.geometry.type === "Point" && h.layer && !/^(gm|wire|news)/.test(h.layer.id));
+    if (!f) return;
+    let row = rowOfLayer(f.layer.id);
+    if (!row) for (const c of [...LAYERS, ...GROUPS.flatMap((g) => g.children || [])]) {
+      if ((f.layer.id === c.id || f.layer.id.startsWith(c.id + "-")) && (!row || c.id.length > row.length)) row = c.id;
+    }
+    lastPoint = { props: f.properties || {}, row, t: Date.now() };
+  });
+  const line = () => {
+    if (!lastPoint || Date.now() - lastPoint.t > 8000) return "";
+    const t = positionText(lastPoint.props, lastPoint.row);
+    return t ? `<div class="meta" data-pos="1" style="margin-top:6px">Position: ${escapeHtml(t)}</div>` : "";
+  };
+  const P = maplibregl.Popup.prototype;
+  const setHTML = P.setHTML;
+  P.setHTML = function (html) {
+    const h = String(html == null ? "" : html);
+    return setHTML.call(this, POSITION_SAID.test(h) ? h : h + line());
+  };
+  if (P.setDOMContent) {
+    const setDOM = P.setDOMContent;
+    P.setDOMContent = function (node) {
+      try {
+        const txt = node && (node.innerHTML || node.textContent || "");
+        const add = !POSITION_SAID.test(txt) ? line() : "";
+        if (add && node.insertAdjacentHTML) node.insertAdjacentHTML("beforeend", add);
+      } catch (err) { /* leave the box as it was */ }
+      return setDOM.call(this, node);
+    };
+  }
+}
+
 function childById(id) {
   for (const g of GROUPS) {
     const hit = g.children.find((c) => c.id === id);
@@ -9907,6 +10017,7 @@ function gmInit() {
 }
 
 map.on("load", gmInit);
+map.on("load", positionNotesInit);
 map.on("load", buildLegend);
 map.on("load", () => setTimeout(abattoirPartsInit, 0));
 map.on("load", () => setTimeout(mymapsTitles, 50));
@@ -10124,9 +10235,31 @@ function wireInfoMarks() {
 function liveMark(cfg) {
   if (!cfg) return "";
   const copy = NOT_LIVE[cfg.id];
-  if (LIVE_ROUTES.has(cfg.route) && !copy) return `<span class="live" title="Read from the source itself when this row is ticked, not from a copy kept here">LIVE</span>`;
+  if (LIVE_ROUTES.has(cfg.route) && !copy) return `<span class="live" title="Read from the source itself when this row is ticked, not from a copy kept here">LIVE</span>` + refreshNote(cfg);
   const why = copy || "Drawn from a copy or file kept here, made when the source was last gathered, not read from the source each time";
-  return `<span class="live notlive" title="${escapeHtml(why)}">NOT LIVE</span>`;
+  return `<span class="live notlive" title="${escapeHtml(why)}">NOT LIVE</span>` + refreshNote(cfg);
+}
+// How often what the row shows is renewed, as a small note beside its mark
+// (asked for 23 September). A live row is read afresh each time it is ticked
+// (and, for the rows read by area, as the map moves). A copy's rhythm is read
+// from what its own description says; where nothing says, the note says so.
+const REFRESH = {
+  worker: "read afresh as the map moves",
+  cerulean: "read afresh as the map moves",
+};
+function refreshNote(cfg) {
+  let t;
+  if (LIVE_ROUTES.has(cfg.route) && !NOT_LIVE[cfg.id]) t = REFRESH[cfg.route] || "read afresh each time it is ticked";
+  else {
+    const said = `${NOT_LIVE[cfg.id] || ""} ${cfg.note || ""} ${cfg.name || ""}`.toLowerCase();
+    t = /hourly|every hour/.test(said) ? "copy renewed hourly"
+      : /\bdaily\b|each day|every day/.test(said) ? "copy renewed daily"
+      : /four weeks|monthly/.test(said) ? "copy renewed every four weeks"
+      : /weekly|each week|every week/.test(said) ? "copy renewed weekly"
+      : /built once|not updated|made once|retired|is gone|fixed .*release/.test(said) ? "copy made once; not renewed"
+      : "copy; renewed when rebuilt, no set rhythm";
+  }
+  return `<span class="refresh">${escapeHtml(t)}</span>`;
 }
 // Rows whose way of reading would count as live, but which draw from a copy
 // kept here (the source cannot be read by another site, or its server is gone).
diff --git a/map/index.html b/map/index.html
index 7958ff3..3aa564a 100644
--- a/map/index.html
+++ b/map/index.html
@@ -311,6 +311,7 @@
   #layers .nm .live{margin-left:5px;padding:0 3px;border:1px solid var(--rule);border-radius:2px;
     color:var(--dim);font-size:8.5px;letter-spacing:.08em;vertical-align:1px}
   #layers .nm .live.notlive{border-style:dashed;opacity:.75}
+  #layers .nm .refresh{margin-left:5px;font-size:9px;color:var(--dim);opacity:.8;white-space:nowrap}
   .panel,#legend{overflow:auto}
   /* The grip stays on the box's edge while its contents scroll under it. */
   .panel .pull-grip{position:sticky;bottom:0;margin-top:8px;background:rgba(31,28,21,.94)}
diff --git a/map/test.mjs b/map/test.mjs
index 057a3ee..89108d6 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1383,7 +1383,7 @@ console.log("\nreading the map");
           land.length >= 8 && land.every((c) => c.a <= 0.34 && Math.max(c.r, c.g, c.b) <= 140) &&
           land[0].g > land[0].r && land[0].g > land[0].b && land.slice(3, 6).every((c) => c.r > c.g && c.g > c.b) &&
           land.every((c) => !(c.r > 150 && c.g > 130 && c.b < 90)) &&
-          block.includes('1, "rgba(30,60,26,0.32)"') && block.includes('-8000, "rgba(10,22,42,0.8)"'));
+          block.includes('1, "rgba(46,52,34,0.32)"') && block.includes('-8000, "rgba(10,22,42,0.8)"'));
     check("…paleo's sea: navy deeps, lighter blue-green shelves, and a calm-sea layer above the shading that clears before the coast",
           colour.filter((c) => c.h < 0).every((c) => c.b >= c.r) &&
           stops("sea", "shade").filter((c) => c.h >= -80).every((c) => c.a === 0) &&
@@ -3353,5 +3353,18 @@ console.log("\nround of 23 September (8): Waste Atlas rows; soy and maize from H
         ["soyb", "maiz"].every((c) => ["ghg", "water", "nutrient", "disturbance"].every((p) => src.includes(`food_${c}_${p}.pmtiles`))) &&
         o.includes("food_soy") && o.includes("food_maize"));
 }
+console.log("\nround of 23 September (9): refresh notes, where each dot is, place names, the green cast");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  check("every row's mark carries a note of how often what it shows is renewed",
+        /return `<span class="live"[^`]*>LIVE<\/span>` \+ refreshNote\(cfg\);/.test(src) && /NOT LIVE<\/span>` \+ refreshNote\(cfg\);/.test(src) &&
+        /copy renewed daily/.test(src) && /copy renewed weekly/.test(src) && /read afresh each time it is ticked/.test(src));
+  check("every dot's box says how exact its position is, unless the box already says it",
+        /function positionText\(props, rowId\)/.test(src) && /P\.setHTML = function/.test(src) && /POSITION_SAID\.test\(h\)/.test(src) &&
+        /The coordinates the source gives; it does not say how exact they are\./.test(src));
+  check("a Place names tick box in the settings box takes every name off the map and puts it back as it was",
+        /id="names-toggle"/.test(src) && /map\.setLayoutProperty\(l\.id, "text-field", ""\)/.test(src) && /namesField\.get\(l\.id\)/.test(src));
+  check("the Satellite lowlands keep their darkness with far less green", /1, "rgba\(46,52,34,0\.32\)", 400, "rgba\(48,54,36,0\.3\)"/.test(src));
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
