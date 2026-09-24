#!/usr/bin/env python3
"""patch_0920c.py - layer rows one line apart.

    cd ~/Desktop/culprits
    python3 patch_0920c.py

Goes on top of 50af167 ("The layers box gets its headings back"). Independent of
patch_0920b.py - different files - so either order is fine.

An unticked row had 2px above and below and a 1.35 line, which read as a gap
between every title. Now: no padding of its own and a 1.25 line, so the titles
sit one line apart. A ticked row takes the 2px back, because its line of detail
appears underneath it and would otherwise touch the next title. Groups and their
children lose a pixel each for the same reason.

The test that pinned the old numbers is updated, and a second test holds the
ticked row's breathing room.
"""

import subprocess
import sys

DIFF = r"""diff --git a/map/index.html b/map/index.html
index 51a6250..7c2e392 100644
--- a/map/index.html
+++ b/map/index.html
@@ -37,16 +37,18 @@
   /* Layer rows in the layers box, laid out like Global Safety Net's own list:
      a small square of the layer's colour, the name, little space between. A
      row's line of detail (its count, or why it is empty) shows once it is ticked. */
-  #layers .layer{gap:6px;padding:2px 0;border-top:none;font-size:12px;line-height:1.35;align-items:center}
+  #layers .layer{gap:6px;padding:0;border-top:none;font-size:12px;line-height:1.25;align-items:center}
   #layers .layer input{margin:0}
   #layers .swatch{width:10px;height:10px;border-radius:2px;margin:0}
   #layers .layer .un{display:none;font-size:11px;line-height:1.3}
   #layers .layer:has(> input:checked){align-items:flex-start}
+  #layers .layer:has(> input:checked){padding:2px 0}
   #layers .layer:has(> input:checked) > input,#layers .layer:has(> input:checked) > .swatch{margin-top:2px}
   #layers .layer:has(> input:checked) .un{display:block}
   #layers .layer.parent .un{display:block}
   #layers .facet{padding:1px 0 5px 22px}
-  #layers .kids{margin:0 0 2px 9px}
+  #layers .kids{margin:0 0 1px 9px}
+  #layers .group{margin:0}
   /* The Satellite basemap's planetary-defence frame (see DEFENCE in app.js).
      Fine corner brackets and a faint vignette; none of it takes clicks or
      covers the middle of the map. The scan line that used to sweep down the
diff --git a/map/test.mjs b/map/test.mjs
index 9ae5253..744e93f 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -2256,7 +2256,11 @@ console.log("\nBuildings");
 console.log("\nlayer rows laid out like Global Safety Net's list");
 {
   const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
-  check("rows are small, tight and led by a colour square", /#layers \.layer\{gap:6px;padding:2px 0;border-top:none;font-size:12px/.test(index) && /#layers \.swatch\{width:10px;height:10px;border-radius:2px/.test(index));
+  check("rows are small, tight and led by a colour square", /#layers \.layer\{gap:6px;padding:0;border-top:none;font-size:12px;line-height:1\.25/.test(index) && /#layers \.swatch\{width:10px;height:10px;border-radius:2px/.test(index));
+  // One line apart: an unticked row carries no padding of its own, so the
+  // titles read as a list rather than a column of gaps. A ticked row takes a
+  // little back, because its line of detail appears underneath it.
+  check("a ticked row keeps room for its line of detail", /#layers \.layer:has\(> input:checked\)\{padding:2px 0\}/.test(index));
   check("a row's detail line shows once it is ticked", /#layers \.layer:has\(> input:checked\) \.un\{display:block\}/.test(index));
   check("the layers box rolls up whole", /\.left-col \.panel\.shut\{flex:0 0 auto;height:auto !important\}/.test(index));
 }
"""


def run(args, text=None):
    return subprocess.run(args, input=text, capture_output=True, text=True)


def main():
    if run(["git", "rev-parse", "--is-inside-work-tree"]).returncode != 0:
        sys.exit("Not a git repository. Run this from ~/Desktop/culprits.")

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

    print("Applied. Changed: map/index.html, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
