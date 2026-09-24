#!/usr/bin/env python3
"""patch_0920e.py - a menu per field in a news mark's box.

    cd ~/Desktop/culprits
    python3 patch_0920e.py

Goes on top of patch_0920d.py, which must be applied and committed first.
Independent of patch_0920b.py.

The box that opens on a news mark had a Subject menu that appeared only when the
stories there carried more than one subject, a Source menu, the headline search
and the order. It now carries one menu for each thing a story actually carries:

  Subject, Source, Place, Date, then the headline search and the order.

Two rules hold across all of them. A menu whose stories all share one value is
left out, because setting it would change nothing - that is how the wires box
itself already treats its filters. And where some stories carry a value and
others do not, the ones without get an option of their own ("No source named",
"No date given"), so nothing at a mark is unreachable through the menus.

Date lists the days the stories themselves carry, newest first, rather than
windows of my choosing; a story with no date is under "No date given".

The menus scroll in their own strip so six rows cannot push the list of stories
out of the box.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 8ea00a7..19fe5d1 100644
--- a/map/app.js
+++ b/map/app.js
@@ -2110,7 +2110,7 @@ function wireSource() {
         .setLngLat(f.geometry.coordinates)
         .setHTML(`<b>${escapeHtml(f.properties.place || "News wire")}</b>` +
                  `<div class="meta">${list.length} ${list.length === 1 ? "story" : "stories"}</div>` +
-                 (list.length > 1 ? wirePopFilters(list) : "") +
+                 (list.length > 1 ? `<div class="wire-pop-filters">${wirePopFilters(list)}</div>` : "") +
                  `<div class="wire-pop-list">${wirePopRows(list, "new")}</div>`)
         .addTo(map);
       const el = pop.getElement && pop.getElement();
@@ -2134,15 +2134,41 @@ function wireSource() {
 
 // The box's filters: a menu for each subject and source, a search for the
 // headline, and the order.
+// The box above a mark's list: one menu per thing a story carries, plus the
+// headline search and the order. A menu only appears where its stories differ
+// on it - a menu with one value in it does nothing when set - and where some
+// stories carry the value and others do not, the ones without get an option of
+// their own rather than being left unreachable.
+const WIRE_NOT_GIVEN = "\u0000none";
+function wireDay(s) {
+  if (s.date == null) return "";
+  const d = new Date(s.date);
+  return isFinite(d.getTime())
+    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
+    : "";
+}
+function wireDayLabel(key) {
+  const [y, m, d] = key.split("-").map(Number);
+  return new Date(y, m - 1, d).toLocaleDateString();
+}
 function wirePopFilters(list) {
-  const opts = (key) => [...new Set(list.map((s) => s[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
-  const menu = (key, label) => {
-    const vals = opts(key);
-    return vals.length > 1
-      ? `<label class="wire-pop-sort">${label} <select data-wf="${key}"><option value="">All</option>` +
-        vals.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("") + `</select></label>` : "";
+  const row = (key, label, values, missing, blank, labelOf) => {
+    if (values.length + (missing ? 1 : 0) < 2) return "";
+    return `<label class="wire-pop-sort">${label} <select data-wf="${key}"><option value="">All</option>` +
+      values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(labelOf ? labelOf(v) : v)}</option>`).join("") +
+      (missing ? `<option value="${WIRE_NOT_GIVEN}">${escapeHtml(blank)}</option>` : "") +
+      `</select></label>`;
+  };
+  const menu = (key, label, blank) => {
+    const values = [...new Set(list.map((s) => s[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
+    return row(key, label, values, list.some((s) => !s[key]), blank);
   };
-  return menu("subject", "Subject") + menu("outlet", "Source") +
+  // Newest day first, which is the order the list itself opens in.
+  const days = [...new Set(list.map(wireDay).filter(Boolean))].sort().reverse();
+  return menu("subject", "Subject", "No subject given") +
+    menu("outlet", "Source", "No source named") +
+    menu("place", "Place", "No place named") +
+    row("day", "Date", days, list.some((s) => !wireDay(s)), "No date given", wireDayLabel) +
     `<label class="wire-pop-sort">Headline <input data-wf="title" type="search" placeholder="words in the headline" ` +
     `style="flex:1;font:inherit;color:var(--bone);background:var(--peat,#17150F);border:1px solid var(--rule);border-radius:2px;padding:1px 4px"></label>` +
     `<label class="wire-pop-sort">Order <select data-wf="order">` +
@@ -2151,8 +2177,10 @@ function wirePopFilters(list) {
 }
 function wirePopPick(list, f) {
   const words = String(f.title || "").toLocaleLowerCase().split(/\s+/).filter(Boolean);
-  return list.filter((s) => (!f.subject || s.subject === f.subject) && (!f.outlet || s.outlet === f.outlet) &&
-    words.every((w) => String(s.title || "").toLocaleLowerCase().includes(w)));
+  const is = (s, key, want) => !want || (want === "\u0000none" ? !s[key] : s[key] === want);
+  const onDay = (s, want) => !want || (want === "\u0000none" ? !wireDay(s) : wireDay(s) === want);
+  return list.filter((s) => is(s, "subject", f.subject) && is(s, "outlet", f.outlet) && is(s, "place", f.place) &&
+    onDay(s, f.day) && words.every((w) => String(s.title || "").toLocaleLowerCase().includes(w)));
 }
 
 // Every story at a mark, in the order chosen in its box.
diff --git a/map/index.html b/map/index.html
index 54acc3b..9595c86 100644
--- a/map/index.html
+++ b/map/index.html
@@ -144,7 +144,11 @@
   /* Story titles in a news mark's box: plain light text, not link purple. */
   .wire-pop a{color:#F2EEE6;text-decoration:none}
   .wire-pop-list{max-height:260px;overflow:auto;padding-right:4px}
-  .wire-pop-sort{display:flex;align-items:center;gap:6px;margin:6px 0 2px;font-size:11.5px;color:var(--dim)}
+  .wire-pop-sort{display:flex;align-items:center;gap:6px;margin:3px 0 2px;font-size:11.5px;color:var(--dim)}
+  /* Six rows of menus would push the list out of the box, so they scroll
+     together and the stories keep their own room underneath. */
+  .wire-pop-sort > :first-child{flex:0 0 62px}
+  .wire-pop-filters{max-height:150px;overflow:auto;padding-right:4px}
   .wire-pop-sort select{flex:1;font:inherit;color:var(--bone);background:var(--peat,#17150F);
     border:1px solid var(--rule);border-radius:2px;padding:1px 4px}
   .wire-pop a:hover{text-decoration:underline;text-decoration-color:var(--dim)}
diff --git a/map/test.mjs b/map/test.mjs
index 29fe0bc..e09945f 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1797,12 +1797,32 @@ console.log("\nsuppression in the given order; news box filters");
   check("Economically is now Control of physical resources", at("Economically") === -1 && at("Control of physical resources") > at("Physical suppression"));
   const last = (x) => order.map((y) => y && y.t).lastIndexOf(x);
   check("the other beings follow Of humans", last("Of animals") > at("Suppression by social molds") && last("Of microscopics") > last("Of plants"));
-  const pick = new Function(src.slice(src.indexOf("function wirePopPick("), src.indexOf("// Every story at a mark")) + "; return wirePopPick;")();
+  const pick = new Function(src.slice(src.indexOf("const WIRE_NOT_GIVEN ="), src.indexOf("// Every story at a mark")) + "; return wirePopPick;")();
   const list = [{ subject: "Slavery", outlet: "AP", title: "Brick kilns raided" }, { subject: "Voting", outlet: "AP", title: "Polls close" },
                 { subject: "Slavery", outlet: "BBC", title: "Fishing crews freed" }];
   check("a news box filters by subject", pick(list, { subject: "Slavery" }).length === 2);
   check("…by source", pick(list, { outlet: "BBC" }).length === 1);
   check("…and by words in the headline", pick(list, { title: "kilns" }).length === 1 && pick(list, { title: "" }).length === 3);
+  // A story carrying no source, place or date is reachable through its menu's
+  // own option rather than being filtered away by every choice.
+  const day = (y, m, d) => new Date(y, m - 1, d).getTime();
+  const dated = [{ subject: "Slavery", outlet: "AP", place: "Lagos", title: "one", date: day(2026, 9, 18) },
+                 { subject: "Slavery", outlet: "", place: "", title: "two", date: day(2026, 9, 19) },
+                 { subject: "Voting", outlet: "BBC", place: "Lagos", title: "three", date: null }];
+  check("\u2026by place", pick(dated, { place: "Lagos" }).length === 2);
+  check("\u2026by the day a story carries", pick(dated, { day: "2026-09-19" }).length === 1);
+  check("stories with nothing in a field have an option of their own",
+        pick(dated, { outlet: "\u0000none" }).length === 1 && pick(dated, { day: "\u0000none" }).length === 1);
+  const filters = new Function("escapeHtml", "WIRE_SORTS",
+    src.slice(src.indexOf("const WIRE_NOT_GIVEN ="), src.indexOf("// Every story at a mark")) + "; return wirePopFilters;")(
+      (x) => String(x), [["new", "Newest first"]]);
+  const html = filters(dated);
+  check("the box carries a menu for each of them, and the headline and order",
+        ["subject", "outlet", "place", "day", "title", "order"].every((k) => html.includes(`data-wf="${k}"`)));
+  check("a menu whose stories all share one value is left out",
+        !filters([{ subject: "Slavery", outlet: "AP", place: "Lagos", title: "one", date: day(2026, 9, 18) },
+                  { subject: "Slavery", outlet: "AP", place: "Lagos", title: "two", date: day(2026, 9, 18) }])
+          .includes('data-wf="subject"'));
 }
 
 console.log("\nthe Social Spheres, its own map");
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
    if "${WORKER}/carbonmapper" not in app:
        sys.exit("patch_0920d.py has to be applied and committed first.")

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
