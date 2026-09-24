#!/usr/bin/env python3
"""patch_0920.py - the layers box gets its headings back.

Apply from the top of the repo:

    cd ~/Desktop/culprits
    python3 patch_0920.py

Goes on top of commit 2792030 ("Heading ticks back, and unticking one clears
everything under it"), which is patch_1013 and is already on the remote.
Nothing else has to come first.

What was wrong: that round rewrote the heading builder in arrangePanel and
dropped the two lines that make the heading's own line element, while the three
lines that fill it stayed. The first heading therefore threw on an undeclared
name. The arranging runs inside setTimeout, so the error went to the console and
nothing else happened - the layers box kept every row but lost every heading and
every category, reading as one flat list.

This puts the element back and adds two tests: one for the element itself, one
that every name the arranging fills is declared in it, so this cannot recur
quietly.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/app.js b/map/app.js
index 1dfa8fc..930fd9b 100644
--- a/map/app.js
+++ b/map/app.js
@@ -8302,6 +8302,11 @@ function arrangePanel() {
       body.hidden = !body.hidden;
       head.setAttribute("aria-expanded", String(!body.hidden));
     });
+    // The heading's own line: the title, then its tick at the end. Without
+    // this element the first heading threw and the whole box stayed a flat
+    // list with no headings at all.
+    const line = document.createElement("div");
+    line.className = "toc-line";
     // Every heading takes its own tick, at the end of its line: it turns on
     // every layer under it, sub-headings included, and unticking it turns all
     // of them off again. It sits beside the heading rather than inside it, so
diff --git a/map/test.mjs b/map/test.mjs
index 9ae5253..a35287b 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2334,6 +2334,21 @@ console.log("\nHydroWASTE on the map; the EIP and HydroFATE page rows gone");
   check("the Environmental Integrity Project and HydroFATE page rows are gone", !/id: "eip_inventory"/.test(src) && !/id: "hydrofate"/.test(src));
 }
 
+console.log("\nthe layers box keeps its headings");
+{
+  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
+  const body = src.slice(src.indexOf("function arrangePanel("), src.indexOf("map.on(\"load\", () => setTimeout(arrangePanel, 0))"));
+  check("a heading's line is made before it is filled",
+        /const line = document\.createElement\("div"\);/.test(body) && /line\.className = "toc-line";/.test(body) &&
+        body.indexOf("const line =") > -1 && body.indexOf("const line =") < body.indexOf("line.appendChild(head)"));
+  // The first heading threw on an element nobody had made, and because the
+  // arranging runs in a timeout the error went to the console while the box
+  // stayed a flat list. So: everything the arranging fills is made in it.
+  const filled = [...body.matchAll(/\n\s*([A-Za-z_$][\w$]*)\.appendChild\(/g)].map((m) => m[1]);
+  check("every element the arranging fills is made in it",
+        [...new Set(filled)].every((n) => new RegExp(`(const|let) ${n}\\b`).test(body)));
+}
+
 console.log("\nGlobal Safety Net fixes; My Maps titles");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
"""


def run(args, text=None):
    return subprocess.run(args, input=text, capture_output=True, text=True)


def main():
    inside = run(["git", "rev-parse", "--is-inside-work-tree"])
    if inside.returncode != 0:
        sys.exit("Not a git repository. Run this from ~/Desktop/culprits.")

    reverse = run(["git", "apply", "--check", "--reverse", "-"], DIFF)
    if reverse.returncode == 0:
        print("Already applied - nothing to do.")
        return

    check = run(["git", "apply", "--check", "-"], DIFF)
    if check.returncode != 0:
        print(check.stderr.strip())
        sys.exit("Does not apply cleanly. Check that git log --oneline -1 reads 2792030.")

    apply = run(["git", "apply", "-"], DIFF)
    if apply.returncode != 0:
        print(apply.stderr.strip())
        sys.exit("git apply failed.")

    print("Applied. Changed: map/app.js, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
