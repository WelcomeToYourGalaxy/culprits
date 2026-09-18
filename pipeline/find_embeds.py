#!/usr/bin/env python3
"""
List every outside map, frame and data link on the site's pages, from the saved
site record, so each can be checked and added to Culprits.

Run from the culprits repo root:
  python3 pipeline/find_embeds.py            every page in the record
  python3 pipeline/find_embeds.py destruction
The record is found as build_boxes.py finds it: WTYG_SITE_RECORD, or a folder
under ~/Desktop or ~/Downloads holding suppression.html.
"""
import html, os, pathlib, re, sys

def record():
    if os.environ.get("WTYG_SITE_RECORD"):
        return pathlib.Path(os.environ["WTYG_SITE_RECORD"])
    for base in (pathlib.Path.home() / "Desktop", pathlib.Path.home() / "Downloads"):
        for hit in base.glob("**/suppression.html"):
            return hit.parent
    sys.exit("No site record found. Set WTYG_SITE_RECORD to the unzipped folder.")

OURS = ("welcometoyourgalaxy", "weebly", "editmysite", "googleapis.com/css", "gstatic", "cloudflare", "unpkg",
        "jsdelivr", "jquery", "fonts.", "facebook", "twitter", "x.com/intent", "linkedin", "pinterest")
URL = re.compile(r"""(?:src|href|data-src|url)\s*=\s*["']([^"']+)["']|(https?://[^\s"'<>\\)]+)""", re.I)

root = record()
pages = sys.argv[1:] or sorted(p.stem for p in root.glob("*.html"))
for page in pages:
    f = root / f"{page}.html"
    if not f.exists():
        print(f"{page}: not in the record"); continue
    text = html.unescape(f.read_text(errors="replace"))
    seen = []
    for m in URL.finditer(text):
        u = (m.group(1) or m.group(2) or "").strip()
        if not u.startswith("http") or any(o in u.lower() for o in OURS):
            continue
        host = re.sub(r"^https?://([^/]+).*", r"\1", u)
        tag = text[text.rfind("<", 0, m.start()):m.start()].lower()
        frame = tag.startswith("<iframe")
        if (u, frame) not in seen:
            seen.append((u, frame))
    print(f"\n== {page}: {len(seen)} outside addresses")
    for u, frame in seen:
        print(("  FRAME  " if frame else "  link   ") + u[:200])
