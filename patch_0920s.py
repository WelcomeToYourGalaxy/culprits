#!/usr/bin/env python3
"""patch_0920s.py - a row's own filters read as groups, not a wall of chips.

    cd ~/Desktop/culprits
    python3 patch_0920s.py

Goes on top of 9c9ba37.

PalmWatch's sub-toggles, and every other row's, were one long wrapped line of
chips with the filter's name buried in the first one ("Brand: all", then
fifteen brands). Now:

  - the filter's name is its own small line, with an "all" beside it
  - its values sit under it, and a long list is held to a few rows that scroll
    rather than pushing the rest of the box off the screen
  - a value's count is quieter than the name it belongs to
  - "Colour by" is a labelled group too, with its year select at the end of its
    line and its colour key on a line of its own underneath

Nothing about what the filters do changes - the same chips, the same counts,
the same colourings.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 0380f11..218699f 100644
--- a/map/app.js
+++ b/map/app.js
@@ -2279,10 +2279,16 @@ function sitemapChipRows(cfg) {
     const el = document.createElement("div");
     el.className = "facet";
     el.dataset.for = `${cfg.id}-${i}`;
-    el.innerHTML = `<span class="chip reset" data-sm="${cfg.id}" data-fi="${i}" data-k="">${f.label}: all</span>` +
-      f.values.map((v) =>
+    // A wall of chips with the filter's name buried in the first one read as
+    // one long list. The name is its own line now, with the chips under it and
+    // a long list held to a few rows that scroll, so a row with fifteen brands
+    // under it does not push the rest of the box off the screen.
+    el.classList.add("facet-set");
+    el.innerHTML = `<div class="fl">${escapeHtml(f.label)}` +
+      `<button type="button" class="chip reset" data-sm="${cfg.id}" data-fi="${i}" data-k="">all</button></div>` +
+      `<div class="fv">` + f.values.map((v) =>
         `<button type="button" class="chip" data-sm="${cfg.id}" data-fi="${i}" data-k="${escapeHtml(v.k)}">` +
-        `${escapeHtml(v.label)} (${v.n.toLocaleString()})</button>`).join("");
+        `${escapeHtml(v.label)} <em>${v.n.toLocaleString()}</em></button>`).join("") + `</div>`;
     if (anchor.after) anchor.after(el);
   });
 }
@@ -2366,13 +2372,14 @@ function renderColourRow(id) {
   if (!state || !el) return;
   const c = state.list[state.pick];
   const year = state.year[c.k] != null ? state.year[c.k] : c.year;
-  el.innerHTML = `<span class="chip reset">Colour by:</span>` +
-    state.list.map((o, i) =>
-      `<button type="button" class="chip${i === state.pick ? " on" : ""}" data-smc="${id}" data-ci="${i}">${escapeHtml(o.label)}</button>`).join("") +
+  el.classList.add("facet-set");
+  el.innerHTML = `<div class="fl">Colour by` +
     (Array.isArray(c.years) && c.years.length
       ? `<select class="sm-year" data-smy="${id}" aria-label="Year">` +
         c.years.map((y) => `<option value="${y}"${y === year ? " selected" : ""}>${y}</option>`).join("") + `</select>`
-      : "") +
+      : "") + `</div>` +
+    `<div class="fv">` + state.list.map((o, i) =>
+      `<button type="button" class="chip${i === state.pick ? " on" : ""}" data-smc="${id}" data-ci="${i}">${escapeHtml(o.label)}</button>`).join("") + `</div>` +
     `<div class="sm-legend">${colouringLegend(c)}</div>`;
   const sel = el.querySelector && el.querySelector("select");
   if (sel && sel.addEventListener) sel.addEventListener("change", () => {
diff --git a/map/index.html b/map/index.html
index 303c069..ab8c0aa 100644
--- a/map/index.html
+++ b/map/index.html
@@ -54,6 +54,17 @@
   #layers .layer:has(> input:checked) .un{display:block}
   #layers .layer.parent .un{display:block}
   #layers .facet{padding:1px 0 5px 22px}
+  /* A row's own filters: the filter's name on its own line, its chips under
+     it, and a long list held to a few rows that scroll rather than pushing
+     the rest of the box off the screen. */
+  #layers .facet-set{display:block}
+  #layers .facet-set .fl{display:flex;align-items:center;gap:6px;margin:3px 0 2px;
+    color:var(--dim);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}
+  #layers .facet-set .fl .chip{text-transform:none;letter-spacing:0;padding:0 5px}
+  #layers .facet-set .fl select{margin-left:auto}
+  #layers .facet-set .fv{display:flex;flex-wrap:wrap;gap:4px;max-height:96px;overflow:auto;padding-right:3px}
+  #layers .facet-set .chip em{font-style:normal;opacity:.6;font-size:10.5px}
+  #layers .facet-set .sm-legend{margin-top:5px}
   #layers .kids{margin:0 0 1px 9px}
   #layers .group{margin:0}
   /* The Satellite basemap's planetary-defence frame (see DEFENCE in app.js).
diff --git a/map/test.mjs b/map/test.mjs
index 69dbefa..d45cc22 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2672,6 +2672,22 @@ console.log("\nreallocated rows say where they are; the emptied rows leave the b
         o.PANEL_REMOVED.has("nusantara") && o.PANEL_REMOVED.has("gfw_catalogue"));
 }
 
+console.log("\na row's own filters read as groups, not a wall of chips");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
+  check("each filter's name is its own line, with an all beside it",
+        /<div class="fl">\$\{escapeHtml\(f\.label\)\}/.test(src) &&
+        /<button type="button" class="chip reset" data-sm="\$\{cfg\.id\}" data-fi="\$\{i\}" data-k="">all<\/button>/.test(src));
+  check("its values sit under it, and a long list scrolls rather than pushing the box off screen",
+        /<div class="fv">/.test(src) && /#layers \.facet-set \.fv\{[^}]*max-height:96px;overflow:auto/.test(index));
+  check("a count is quieter than the name it belongs to", /<em>\$\{v\.n\.toLocaleString\(\)\}<\/em>/.test(src) &&
+        /#layers \.facet-set \.chip em\{font-style:normal;opacity:\.6/.test(index));
+  check("Colour by is a labelled group too, with its year at the end of the line and its key under it",
+        /<div class="fl">Colour by/.test(src) && /#layers \.facet-set \.fl select\{margin-left:auto\}/.test(index) &&
+        /#layers \.facet-set \.sm-legend\{margin-top:5px\}/.test(index));
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
    if "NUSANTARA_WHERE" not in app:
        sys.exit("patch_0920r.py has to be applied and committed first.")
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
