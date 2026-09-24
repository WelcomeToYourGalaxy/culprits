#!/usr/bin/env python3
"""
The heading ticks come back, and unticking one clears everything under it.

Run from the repo root:  python3 patch_1013.py

Needs patch_1012.py in first. Refuses cleanly if it is already applied or if
the files underneath have moved on.

What it changes:
  map/app.js     Every heading and sub-heading carries a tick at the end of its
                 line again. It turns on every layer under it, sub-headings
                 included; unticking it turns them all off and clears any group
                 boxes inside it, which is what was missing before.
                 syncHeadingBoxes keeps each tick reading all, none or part-way
                 from the layers themselves. Opening a heading still loads
                 nothing - the arrow and the tick are separate controls.
  map/test.mjs   Checks for all of it.
  HANDOFF.md     What the heading ticks do.

Nothing else from the last two rounds is touched: the layers column still drags
wider, the meat rows still work, the reefs still draw close in, and PalmWatch's
areas still show from the world view.
"""
import subprocess, sys

DIFF = r'''diff --git a/HANDOFF.md b/HANDOFF.md
index 2960ac9..365abe9 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -169,13 +169,16 @@ one if a row has it.
 
 ---
 
-## Headings are menus, not controls
+## Heading ticks
 
-No tick on a heading. A heading is a way through the list: its arrow opens it
-and the rows inside it are what can be turned on. The bulk tick that was there
-briefly also invited turning on thirty layers at once, which is a minute of
-loading and a map nobody can read. The build queue below stays, because a row
-can still be ticked faster than its archives arrive.
+Every heading and sub-heading carries a tick at the end of its line. It turns
+on every layer under it, sub-headings included, and unticking it turns them all
+off again and clears any group boxes inside it. `syncHeadingBoxes` keeps it
+reading all, none or part-way from the layers themselves. Opening a heading and
+turning its layers on are separate actions, so opening one loads nothing.
+
+They were taken out once and put back: a heading with thirty layers under it
+does load thirty layers, which is what the build queue below is for.
 
 ---
 
diff --git a/map/app.js b/map/app.js
index 2eaf066..1dfa8fc 100644
--- a/map/app.js
+++ b/map/app.js
@@ -8043,6 +8043,22 @@ const PANEL_REMOVED = new Set([
   "leg_municipal", "leg_municipal_recover", "leg_laws",
 ]);
 
+// A heading's tick reads its layers, never the other way round: all on, none
+// on, or part-way, which is the only honest rendering of a heading holding
+// some ticked rows.
+function syncHeadingBoxes(box) {
+  if (!box || !box.querySelectorAll) return;
+  for (const sec of box.querySelectorAll(".toc-sec")) {
+    const all = sec.querySelector(".toc-all");
+    if (!all) continue;
+    const boxes = [...sec.querySelectorAll("[data-layer]")];
+    const on = boxes.filter((i) => i.checked).length;
+    all.checked = boxes.length > 0 && on === boxes.length;
+    all.indeterminate = on > 0 && on < boxes.length;
+    all.disabled = boxes.length === 0;
+  }
+}
+
 function panelNodes(box, key) {
   let lead = null;
   if (key === "gm") { const i = box.querySelector("[data-gm]"); lead = i && i.closest("label"); }
@@ -8286,11 +8302,35 @@ function arrangePanel() {
       body.hidden = !body.hidden;
       head.setAttribute("aria-expanded", String(!body.hidden));
     });
-    // No tick on a heading. A heading is a way through the list, not a layer:
-    // its arrow opens it and the rows inside it are what can be turned on.
-    // A tick here also invited turning on thirty layers with one click, which
-    // is a minute of loading and a map nobody can read.
+    // Every heading takes its own tick, at the end of its line: it turns on
+    // every layer under it, sub-headings included, and unticking it turns all
+    // of them off again. It sits beside the heading rather than inside it, so
+    // opening a heading and turning its layers on stay separate actions - the
+    // same reason a group's arrow and its box are separate. A heading with
+    // many layers under it loads all of them, which the build queue paces.
+    const all = document.createElement("input");
+    all.type = "checkbox";
+    all.className = "toc-all";
+    all.title = "Show or hide every layer under this heading";
+    all.setAttribute("aria-label", `Show or hide every layer under ${titleCase(t)}`);
+    all.addEventListener("click", (e) => e.stopPropagation());
+    all.addEventListener("change", () => {
+      const on = all.checked;
+      for (const i of body.querySelectorAll("[data-layer]")) {
+        if (i.checked === on) continue;
+        i.checked = on;
+        if (typeof i.dispatchEvent === "function" && typeof Event === "function") i.dispatchEvent(new Event("change", { bubbles: true }));
+      }
+      // A group's own box follows its children rather than being left ticked
+      // over layers that are no longer drawn.
+      for (const g of body.querySelectorAll("[data-group]")) {
+        g.checked = on;
+        g.indeterminate = false;
+      }
+      syncHeadingBoxes(document.getElementById("layers"));
+    });
     line.appendChild(head);
+    line.appendChild(all);
     sec.appendChild(line);
     sec.appendChild(body);
     stack[stack.length - 1].body.appendChild(sec);
@@ -8333,6 +8373,10 @@ function arrangePanel() {
     box.appendChild(sec);
     sec.querySelector(".toc-body").appendChild(rest);
   }
+  syncHeadingBoxes(box);
+  box.addEventListener("change", (e) => {
+    if (e && e.target && e.target.dataset && (e.target.dataset.layer || e.target.dataset.group)) syncHeadingBoxes(box);
+  });
   // Beside each heading, how many layers are inside it.
   for (const sec of box.querySelectorAll(".toc-sec")) {
     const n = sec.querySelectorAll("[data-layer], [data-gm]").length;
@@ -8348,6 +8392,8 @@ function arrangePanel() {
     st.id = "panel-h-style";
     st.textContent = ".toc-line{display:flex;align-items:center;gap:6px}" +
       ".toc-line .toc-head{flex:1;text-align:left}" +
+      ".toc-all{flex:none;accent-color:#8A9DA6;cursor:pointer}" +
+      ".toc-all:disabled{opacity:.3;cursor:default}" +
       ".panel-h{margin:10px 0 4px;color:var(--ink,#e8e2d6)}" +
       ".panel-h1{font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-top:1px solid rgba(255,255,255,.18);padding-top:8px;font-weight:700}" +
       ".panel-h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;padding-left:4px;font-weight:600}" +
diff --git a/map/test.mjs b/map/test.mjs
index e748acc..9ae5253 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2109,7 +2109,7 @@ console.log("\nthe showing box, the queue, and menus that draw");
         src.indexOf('class="lg-on"') < src.indexOf('class="lg-sw"'));
   check("unticking there unticks the row in the layers box, not the map directly",
         /const row = document\.querySelector\(`\[data-layer="\$\{i\.dataset\.lg\}"\]`\)/.test(src) && /row\.dispatchEvent\(new Event\("change"/.test(src));
-  check("a heading's line holds its arrow and title and nothing else", /line\.appendChild\(head\);\n\s*sec\.appendChild\(line\);/.test(src));
+  check("a heading's tick sits at the end of its line", /line\.appendChild\(head\);\n\s*line\.appendChild\(all\);/.test(src));
   check("layers are built three at a time, and a waiting row says so",
         /const QUEUE_AT_ONCE = 3/.test(src) && /waiting behind \$\{i \+ 1\} other layer/.test(src) && /queueBuild\(cfg\.id, \(\) => \{/.test(src));
   check("a menu's own ticks turn the row above them on", /function showRowFor\(id\)/.test(src) && /if \(cb\.checked\) showRowFor\(cfg\.id\)/.test(src) && /if \(pick\) showRowFor\(cfg\.id\)/.test(src));
@@ -2154,8 +2154,14 @@ console.log("\nheading ticks, chips in words, a named archive");
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const order = new Function(body + "; return PANEL_ORDER;")();
   const at = (t) => order.findIndex((x) => x && x.t === t);
-  check("a heading is a way through the list, not a control: no tick on it",
-        !/toc-all/.test(src) && !/syncHeadingBoxes/.test(src));
+  check("every heading takes a tick that shows or hides everything under it",
+        /all\.className = "toc-all"/.test(src) && /for \(const i of body\.querySelectorAll\("\[data-layer\]"\)\)/.test(src));
+  check("unticking a heading clears its layers and its groups' boxes too",
+        /for \(const g of body\.querySelectorAll\("\[data-group\]"\)\) \{\n\s*g\.checked = on;/.test(src));
+  check("the tick reads its layers: all, none or part-way",
+        /function syncHeadingBoxes\(box\)/.test(src) && /all\.indeterminate = on > 0 && on < boxes\.length/.test(src));
+  check("opening a heading and turning its layers on are separate controls",
+        /all\.addEventListener\("click", \(e\) => e\.stopPropagation\(\)\)/.test(src));
   check("the slaughter chips say what the registry said", /"registry does not say"/.test(src) && /labels\[v\] \|\| v/.test(src));
   check("an archive that will not load names the file it asked for", /archive missing \(\$\{e\.message\}\) \\u2014 \$\{url\}/.test(src));
   check("the three meat rows sit together under Meat", ["abattoir_facilities", "abattoir_cafo", "abattoir_glw"].every((i) => order.indexOf(i) > at("Meat") && order.indexOf(i) < at("Oceans")));
'''


def git(*args):
    return subprocess.run(["git", *args], input=DIFF.encode(), capture_output=True)


def main():
    if subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True).returncode:
        sys.exit("Run this from inside the culprits repo (cd ~/Desktop/culprits).")
    with open("map/app.js", encoding="utf-8") as fh:
        app = fh.read()
    if "syncHeadingBoxes" in app:
        print("Already applied - nothing to do.")
        return
    if "function columnEdge()" not in app:
        sys.exit("patch_1012.py has to go in first.")
    r = git("apply", "--check", "-")
    if r.returncode:
        sys.exit("Will not apply cleanly, so nothing was changed:\n" + r.stderr.decode())
    r = git("apply", "-")
    if r.returncode:
        sys.exit("Failed while applying:\n" + r.stderr.decode())
    print("Applied. Now: node map/test.mjs && node map/wire.test.mjs")


if __name__ == "__main__":
    main()
