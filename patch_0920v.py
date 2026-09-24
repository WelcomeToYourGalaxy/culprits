#!/usr/bin/env python3
"""
patch_0920v.py - the right-hand column: wires box, basemap list, filters.

Three fixes to the right-hand column:
  - the news wires box no longer sits over the bottom of the box above it;
  - Basemap comes before View, so its three choices are never below the edge;
  - the wire's filters and time window sit behind one Filters row that says
    what is set, so the stories have room to be read.

Needs patch_0920u.py applied and committed first.
Run from the repo folder:  python3 patch_0920v.py
"""
import pathlib, subprocess, sys

DIFF = r"""diff --git a/HANDOFF.md b/HANDOFF.md
index 4738d24..0262762 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -242,6 +242,30 @@ as before, so nothing breaks while the tiling catches up.
 
 ---
 
+## The right-hand column: three things that went wrong together
+
+The news wires box is pinned between the bottom of the right column and the
+bottom of the screen, so it is often only 350 px tall. Three faults met there:
+
+- `trackBoxHeights` placed the wires box by adding up the view box's height
+  alone. Once the reload row joined the column above it, the wires box started
+  that much too high and sat over the last rows of the column. It now measures
+  to the bottom of `.right-col` and watches the column itself.
+- Basemap was the last section of a box that stops at 48vh and scrolls, so its
+  three choices were below the edge and the heading looked empty. Basemap now
+  comes first (`basemapPanelHtml`), View under it.
+- The filters could take 34vh and the stories were left 60 px. Every filter and
+  the time window now sit behind one **Filters** row in `wire.js`, shut until
+  asked for and remembered; the row says what is set ("Region: Africa - Last 7
+  days"), so a choice put away is still in view. Open, the filters sit two to a
+  row and scroll inside two fifths of what the fixed rows leave; the stories
+  keep three fifths (`layout()` measures both). This is one fold for the lot,
+  not the per-subject folds that were taken out earlier.
+
+Checked in a headless browser against the live wires at 1440x800 and 1280x680:
+before, the wires box overlapped the column by 42 px and the stories had 60 to
+120 px; after, no overlap and 166 to 228 px with the fold shut.
+
 ## The mines are several archives, not one
 
 GitHub refuses any file over 100 MB, and the mine outlines to zoom 13 weigh more
diff --git a/map/app.js b/map/app.js
index 030d177..d91ad1f 100644
--- a/map/app.js
+++ b/map/app.js
@@ -5490,6 +5490,16 @@ function sectHead(name, key) {
     `title="Roll ${name.toLowerCase()} up or down">&#9662;</button></div>`;
 }
 
+// Basemap comes first. It is three short rows; View is long, and the box stops
+// at 48vh and scrolls, so with Basemap last its choices sat below the bottom
+// edge and the heading looked like an empty section.
+function basemapPanelHtml(opts) {
+  return `<div class="sect" data-sect="basemap">` + sectHead("Basemap", "basemap") + `<div class="sect-body">` +
+    opts.map(([k, nm]) =>
+      `<label class="layer"><input type="radio" name="basemap" value="${k}"` +
+      `${k === BASEMAP ? " checked" : ""}><span class="nm">${nm}</span></label>`).join("") + `</div></div>`;
+}
+
 function viewPanelHtml() {
   return `<div class="sect" data-sect="view">` + sectHead("View", "view") + `<div class="sect-body">` +
     `<div class="view-row"><div class="view-choices">` +
@@ -5511,17 +5521,14 @@ function viewPanelHtml() {
     `<p class="how"><b>Mouse</b> Right-drag: tilt and turn. Ctrl + right-drag: roll.</p>` +
     `<p class="how"><b>Trackpad</b> Ctrl + drag: tilt and turn. Ctrl + two-finger click, then drag: roll.</p>` +
     `<p class="how">Same on Mac and Windows. Keys: Shift + arrows.</p>` +
-    `</div></div></div></div>` +
-    `<div class="sect" data-sect="basemap">` + sectHead("Basemap", "basemap") + `<div class="sect-body">`;
+    `</div></div></div></div>`;
 }
 
 function buildBasemapPanel() {
   const box = document.getElementById("basemaps");
   if (!box) return;
   const opts = [["atlas", "Painted atlas"], ["satellite", "Satellite imagery"], ["outlines", "Country outlines"]];
-  box.innerHTML = viewPanelHtml() + opts.map(([k, nm]) =>
-    `<label class="layer"><input type="radio" name="basemap" value="${k}"` +
-    `${k === BASEMAP ? " checked" : ""}><span class="nm">${nm}</span></label>`).join("") + `</div></div>`;
+  box.innerHTML = basemapPanelHtml(opts) + viewPanelHtml();
   box.addEventListener("click", (e) => {
     const roll = e.target && e.target.closest ? e.target.closest("[data-roll]") : null;
     if (roll) {
@@ -9203,16 +9210,21 @@ function trackBoxHeights() {
   const root = document.documentElement;
   const legend = document.getElementById("legend");
   const view = document.getElementById("basemaps");
+  const col = document.querySelector(".right-col");
   if (!root || !root.style || typeof ResizeObserver === "undefined") return;
   const set = () => {
     const lh = legend && !legend.hidden ? legend.getBoundingClientRect().height : 0;
     root.style.setProperty("--legend-h", lh ? Math.round(lh + 8) + "px" : "0px");
-    const vh = view ? view.getBoundingClientRect().height : 0;
-    root.style.setProperty("--wire-top", Math.round(16 + vh + 8) + "px");
+    // Measured to the bottom of the whole column. It used to add up the view
+    // box's height alone, so once the reload row joined the column above it,
+    // the wires box started that much too high and sat over the last rows.
+    const bottom = col ? col.getBoundingClientRect().bottom : (view ? 16 + view.getBoundingClientRect().height : 16);
+    root.style.setProperty("--wire-top", Math.round(bottom + 8) + "px");
   };
   const ro = new ResizeObserver(set);
   if (legend) ro.observe(legend);
   if (view) ro.observe(view);
+  if (col) ro.observe(col);
   if (legend && typeof MutationObserver !== "undefined") new MutationObserver(set).observe(legend, { attributes: true, attributeFilter: ["hidden"] });
   set();
 }
diff --git a/map/test.mjs b/map/test.mjs
index 8d4514c..d7f56c3 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1365,8 +1365,31 @@ console.log("\nreading the map");
   check("Climate TRACE sources stand as columns by their emissions", /type: "fill-extrusion", source: "ct-columns"/.test(src) &&
         /Math\.sqrt\(v\) \* COLUMN_TALL \* mPerPx/.test(src) && /addColumnLayer\(\);/.test(src));
   check("the compass sits under the 3D terrain box", /id="compass-holder"/.test(src) && /querySelector\("\.maplibregl-ctrl-compass"\)/.test(src));
-  check("the filters are not folded away at all any more",
+  check("the filters are not folded subject by subject",
         !/state\.expanded\[/.test(wireSrc) && /class="wire-filter"/.test(wireSrc));
+  // The filters took so much of the box that no story could be read. They and the
+  // time window now sit behind one Filters row, which says what is set.
+  check("one Filters row holds every filter and the time window, shut until asked for",
+        /id="wireFold" aria-expanded="false"/.test(wireSrc) && /filtersOpen: false/.test(wireSrc) &&
+        wireSrc.indexOf('id="wireFoldBody"') < wireSrc.indexOf('id="wireFilters"') &&
+        wireSrc.indexOf('id="wireFilters"') < wireSrc.indexOf('wire-when"><label') &&
+        /\$foldBody\.hidden = !state\.filtersOpen/.test(wireSrc));
+  {
+    const WINDOWS = [{ id: "d7", label: "Last 7 days" }, { id: "all", label: "Any time" }];
+    const foldSummary = new Function("WINDOWS", wireSrc.match(/function foldSummary[\s\S]*?\n}\n/)[0] + "; return foldSummary;")(WINDOWS);
+    const said = foldSummary({ region: "Africa", topic: null }, "d7", (k) => k === "region" ? "Region" : k);
+    check("\u2026and the row says what is set behind it, so a choice put away is still in view",
+          said.length === 2 && said[0] === "Region: Africa" && said[1] === "Last 7 days" &&
+          foldSummary({}, "all", (k) => k).length === 0);
+  }
+  check("\u2026whether it is open is remembered", /filtersOpen: state\.filtersOpen/.test(wireSrc) && /saved\.filtersOpen === true/.test(wireSrc));
+  check("open, the filters sit two to a row and the stories keep the larger share of the box",
+        /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(wireSrc) && /--wire-list-min', Math\.floor\(room \* 0\.6\)/.test(wireSrc) &&
+        /--wire-facets-max', Math\.floor\(room \* 0\.4\)/.test(wireSrc) && !/max-height:34vh/.test(wireSrc));
+  check("the news wires box starts under the whole right column, reload row included",
+        /col \? col\.getBoundingClientRect\(\)\.bottom/.test(src) && /if \(col\) ro\.observe\(col\)/.test(src));
+  check("Basemap comes before View in the settings box, so its three choices are never below the edge",
+        /box\.innerHTML = basemapPanelHtml\(opts\) \+ viewPanelHtml\(\)/.test(src));
   check("the time window sits with the filters, below them",
         wireSrc.indexOf("id=\"wireFilters") < wireSrc.indexOf("wire-when\"><label") &&
         /class="wire-when"><label for="wireWhen">Time<\/label>/.test(wireSrc));
diff --git a/map/wire.js b/map/wire.js
index bfd7458..d09de98 100644
--- a/map/wire.js
+++ b/map/wire.js
@@ -577,7 +577,7 @@ const REFRESH_MS = 30 * 60000;
 
 const state = {
   open: true, picked: [], when: 'all', q: '', sel: {}, cross: {}, expanded: {},
-  pickerOpen: false, shown: PAGE, wires: {}   // wires[id] = { status, error, loadedAt, wire }
+  pickerOpen: false, filtersOpen: false, shown: PAGE, wires: {}   // wires[id] = { status, error, loadedAt, wire }
 };
 
 try {
@@ -588,13 +588,14 @@ try {
     state.when = WINDOWS.some((w) => w.id === saved.when) ? saved.when : 'all';
     state.cross = saved.cross || {};
     state.expanded = saved.expanded || {};
+    state.filtersOpen = saved.filtersOpen === true;
   }
 } catch (e) { /* storage blocked: start fresh */ }
 
 function save() {
   try {
     localStorage.setItem(STORE, JSON.stringify({ open: state.open, picked: state.picked, when: state.when,
-      cross: state.cross, expanded: state.expanded }));
+      cross: state.cross, expanded: state.expanded, filtersOpen: state.filtersOpen }));
   } catch (e) { /* storage blocked: nothing to keep */ }
 }
 
@@ -661,7 +662,26 @@ const CSS = `
 .wire-pick input{accent-color:var(--moss,#62755F);margin:0}
 .wire-pick .n{color:var(--dim,#948D7C);font-size:11.5px;margin-left:auto}
 .wire-filters{flex:none}
-.wire-facets{max-height:34vh;overflow:auto}
+/* The filters are all still there and none is folded away, but they sit two
+   to a row and scroll inside their share of the box, and the stories always
+   keep the larger share. Before, the filters could take 34vh of a box that is
+   often not much taller than that, leaving the stories 60px - less than one
+   headline. The two shares are measured in layout(). */
+.wire-facets{max-height:var(--wire-facets-max,120px);overflow:auto;display:grid;
+  grid-template-columns:repeat(2,minmax(0,1fr));gap:3px 8px;padding:2px 10px 4px}
+.wire-facets .wire-filter{flex-direction:column;align-items:stretch;gap:0;padding:0;font-size:11.5px}
+.wire-facets .wire-filter > span:first-child{flex:none}
+.wire-facets .wire-filter select{flex:none;width:100%}
+.wire-facets .wire-unread{grid-column:1 / -1;padding:3px 0}
+.wire-fold{display:flex;align-items:center;gap:7px;width:100%;background:none;border:0;cursor:pointer;
+  padding:4px 10px 6px;color:var(--dim,#948D7C);font-size:12px;text-align:left}
+.wire-fold:hover{color:var(--bone,#DCD6C6)}
+.wire-fold[hidden]{display:none}
+.wire.open .wire-fold .wire-caret{transform:none}
+.wire.open .wire-fold[aria-expanded="true"] .wire-caret{transform:rotate(90deg)}
+.wire-fold-sum{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--bone,#DCD6C6)}
+.wire-fold-sum.none{color:var(--dim,#948D7C)}
+.wire-foldbody[hidden]{display:none}
 .wire-subj{border-top:1px solid var(--rule,#322E27);padding:5px 10px}
 .wire-subj:first-child{border-top:0}
 .wire-subj-head{display:flex;align-items:baseline;gap:8px}
@@ -674,7 +694,7 @@ const CSS = `
 .wire-grid[hidden]{display:none}
 .wire-grid label{display:flex;flex-direction:column;gap:1px;color:var(--dim,#948D7C);font-size:11.5px;min-width:0}
 .wire-grid select.set{border-color:var(--moss,#62755F);color:var(--bone,#DCD6C6)}
-.wire-list{flex:1;overflow:auto;border-top:1px solid var(--rule,#322E27);min-height:60px}
+.wire-list{flex:1;overflow:auto;border-top:1px solid var(--rule,#322E27);min-height:var(--wire-list-min,160px)}
 .wire-list ol{list-style:none;margin:0;padding:0}
 .wire-item{padding:7px 10px;border-top:1px solid rgba(50,46,39,.6)}
 .wire-item:first-child{border-top:0}
@@ -691,7 +711,7 @@ const CSS = `
 @media (prefers-reduced-motion:reduce){.wire-caret{transition:none}}
 `;
 
-let box, $sum, $body, $toggle, $pickBtn, $picker, $filters, $list, $q, $when, $refresh, $onMap;
+let box, $sum, $body, $toggle, $pickBtn, $picker, $filters, $list, $q, $when, $refresh, $onMap, $fold, $foldBody, $foldSum;
 
 function build() {
   const style = document.createElement('style');
@@ -722,12 +742,20 @@ function build() {
             '<span class="t" id="wirePickLabel">Choose</span><span class="wire-caret" aria-hidden="true"></span></button>' +
           '<div class="wire-picker" id="wirePicker" hidden></div>' +
         '</div>' +
+        // Every filter and the time window sit behind this one row, so the
+        // stories have the box. The row says what is set, so a choice made
+        // and then put away is still in view.
+        '<button type="button" class="wire-fold" id="wireFold" aria-expanded="false" aria-controls="wireFoldBody">' +
+          '<span class="wire-caret" aria-hidden="true"></span><span>Filters</span>' +
+          '<span class="wire-fold-sum" id="wireFoldSum"></span></button>' +
+        '<div class="wire-foldbody" id="wireFoldBody" hidden>' +
         '<div class="wire-facets" id="wireFilters"></div>' +
-      '</div>' +
       '<div class="wire-when"><label for="wireWhen">Time</label>' +
         '<select id="wireWhen" aria-label="Time window">' +
           WINDOWS.map((w) => '<option value="' + w.id + '">' + w.label + '</option>').join('') +
         '</select></div>' +
+        '</div>' +
+      '</div>' +
       '<div class="wire-list" id="wireList"></div>' +
     '</div>';
   document.body.appendChild(box);
@@ -743,6 +771,10 @@ function build() {
   $when = box.querySelector('#wireWhen');
   $refresh = box.querySelector('#wireRefresh');
   $onMap = box.querySelector('#wireOnMap');
+  $fold = box.querySelector('#wireFold');
+  $foldBody = box.querySelector('#wireFoldBody');
+  $foldSum = box.querySelector('#wireFoldSum');
+  $fold.addEventListener('click', () => { state.filtersOpen = !state.filtersOpen; save(); renderFold(); layout(); });
   $when.value = state.when;
 
   $toggle.addEventListener('click', () => setOpen(!state.open));
@@ -860,6 +892,16 @@ function layout() {
   // The legend now sits bottom left, under the layers box, so only the zoom box lifts the wires.
   if (zh) lift += zh + 8;
   document.documentElement.style.setProperty('--wire-lift', Math.round(lift) + 'px');
+  // What is left of the box once its fixed rows (the bar, the search, Subjects,
+  // Time) are taken out is shared: the filters scroll inside two fifths of it
+  // at most, and the stories always keep three fifths. Measured, not guessed,
+  // so it still fits when the box is short.
+  if (box && box.style && box.querySelector) {
+    const tall = (sel) => { const el = box.querySelector(sel); return el ? el.getBoundingClientRect().height : 0; };
+    const room = Math.max(0, box.getBoundingClientRect().height - tall('.wire-bar') - tall('.wire-tools') - tall('.wire-subjrow') - tall('.wire-fold') - tall('.wire-when'));
+    box.style.setProperty('--wire-facets-max', Math.floor(room * 0.4) + 'px');
+    box.style.setProperty('--wire-list-min', Math.floor(room * 0.6) + 'px');
+  }
 }
 
 function setOpen(open) {
@@ -938,10 +980,38 @@ function renderData(focusId) {
   renderSum();
   renderPicker();
   renderFilters(focusId);
+  renderFold();
   renderList();
   layout();
 }
 
+// The Filters row: what is set behind it, in words.
+function foldSummary(cross, when, labelFor) {
+  const set = Object.keys(cross || {}).filter((k) => cross[k] != null).map((k) => labelFor(k) + ': ' + cross[k]);
+  const w = WINDOWS.find((x) => x.id === when);
+  if (w && w.id !== 'all') set.push(w.label);
+  return set;
+}
+
+function renderFold() {
+  if (!$fold) return;
+  $fold.hidden = !state.picked.length;
+  $foldBody.hidden = !state.filtersOpen || !state.picked.length;
+  $fold.setAttribute('aria-expanded', String(state.filtersOpen));
+  const labelFor = (key) => {
+    for (const id of state.picked) {
+      const e = state.wires[id];
+      const f = e && e.wire && e.wire.facets.find((x) => x.key === key);
+      if (f) return f.label;
+    }
+    return key;
+  };
+  const set = foldSummary(state.cross, state.when, labelFor);
+  $foldSum.textContent = set.length ? set.join(' \u00b7 ') : 'none set';
+  $foldSum.classList.toggle('none', !set.length);
+  $foldSum.title = set.join('\n');
+}
+
 function renderSum() {
   $refresh.hidden = !state.open || !state.picked.length;
   if (!state.picked.length) { $sum.textContent = 'No subjects ticked'; return; }
"""


def run(cmd, text=None):
    return subprocess.run(cmd, input=text, text=True, capture_output=True)


def main():
    if not pathlib.Path("map/app.js").exists():
        sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits).")
    app = pathlib.Path("map/app.js").read_text(encoding="utf-8")
    if "function pmShapeParts" not in app:
        sys.exit("patch_0920u.py has to be applied and committed first.")
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
    print("Applied. Changed: map/app.js, map/wire.js, map/test.mjs, HANDOFF.md")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
