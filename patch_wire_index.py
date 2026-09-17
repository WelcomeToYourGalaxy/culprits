#!/usr/bin/env python3
"""
Adds the news wire box to the map: one <script src="./wire.js"> line in
map/index.html, straight after the app.js line. Nothing else in the file
changes, and app.js is not touched.

Anchored on exact text: if the app.js line is missing or appears more than
once, the script stops and writes nothing. Running it twice is safe; the
second run sees the line already there and does nothing.

Run from the repo root:  python3 patch_wire_index.py
Undo:                    cp /tmp/index.html.wire.bak map/index.html
"""

import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / "map" / "index.html"
WIRE = ROOT / "map" / "wire.js"

ANCHOR = '<script src="./app.js"></script>'
LINE = '<script src="./wire.js"></script>'


def main():
    if not HTML.exists():
        sys.exit(f"no {HTML} — run this from the repo root")
    if not WIRE.exists():
        sys.exit(f"no {WIRE} — move wire.js into map/ first")

    text = HTML.read_text(encoding="utf-8")

    if LINE in text:
        print("map/index.html already loads wire.js — nothing to do.")
        return

    found = text.count(ANCHOR)
    if found != 1:
        sys.exit(f"expected the app.js script line once in map/index.html, found {found}. "
                 "Nothing was changed.")

    shutil.copy(HTML, "/tmp/index.html.wire.bak")
    text = text.replace(ANCHOR, ANCHOR + "\n" + LINE, 1)
    HTML.write_text(text, encoding="utf-8")

    assert text.count(LINE) == 1 and text.index(LINE) > text.index(ANCHOR)
    print("Added wire.js to map/index.html (backup at /tmp/index.html.wire.bak).")


if __name__ == "__main__":
    main()
