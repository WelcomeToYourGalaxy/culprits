#!/usr/bin/env python3
"""
Save chosen blocks of one page of the saved site record as standalone HTML
files, unpacked the way list_page_maps.py unpacks them.

Run from the culprits repo root:
  python3 pipeline/export_blocks.py destruction 43 53
  python3 pipeline/export_blocks.py suppression 87
Files land in ~/Desktop/blocks/<page>_block<N>.html
"""
import pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from list_page_maps import record, unpack  # noqa: E402

OUT = pathlib.Path.home() / "Desktop" / "blocks"


def main(page, wanted):
    text = (record() / f"{page}.html").read_text(errors="replace")
    starts = [m.start() for m in re.finditer(r'class="wcustomhtml"', text)] + [len(text)]
    OUT.mkdir(parents=True, exist_ok=True)
    for n in wanted:
        if not 1 <= n < len(starts):
            print(f"{page}: there is no block {n}")
            continue
        doc, how = unpack(text[starts[n - 1]:starts[n]])
        f = OUT / f"{page}_block{n}.html"
        f.write_text(doc, encoding="utf-8")
        print(f"saved {f} ({how}, {len(doc):,} characters)")


if __name__ == "__main__":
    main(sys.argv[1], [int(x) for x in sys.argv[2:]])
