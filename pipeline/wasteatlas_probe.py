#!/usr/bin/env python3
"""
Where Waste Atlas (atlas.d-waste.com) keeps the data its map draws, found in
its own page and scripts, before a reader is written for it. Changes nothing.

Waste Atlas says it holds 164 countries, 1,799 cities, 1,626 sanitary landfills,
93 dumpsites, 130 MBT units, 78 biological treatment plants and 716
waste-to-energy plants, drawn with Google Maps from its own PHP back end. This
prints every script the page loads, every address in them that looks like a
data request, and the first part of what each such address answers.

Run from the repo root:  python3 pipeline/wasteatlas_probe.py > ~/Desktop/wasteatlas.txt
"""
import re, urllib.parse, urllib.request

BASE = "https://www.atlas.d-waste.com/"
UA = {"User-Agent": "Mozilla/5.0 (Culprits atlas; looking for Waste Atlas's data addresses)"}


def get(url, n=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
            body = r.read() if n is None else r.read(n)
            return r.status, r.headers.get("Content-Type", ""), body.decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return None, "", f"FAILED: {e}"


status, kind, page = get(BASE)
print(f"page: {status} {kind} {len(page):,} characters")
scripts = [urllib.parse.urljoin(BASE, s) for s in re.findall(r"""<script[^>]+src=["']([^"']+)""", page, re.I)]
print("\nscripts:")
for s in scripts:
    print("  " + s)
texts = {"(the page itself)": page}
for s in scripts:
    if "googleapis" in s or "gstatic" in s:
        continue
    st, _, body = get(s)
    texts[s] = body
    print(f"  read {s}: {st}, {len(body):,} characters")

pattern = re.compile(r"""["']([^"'\s]*?(?:\.php|\.json|\.xml|\.kml|\.csv|ajax|api/)[^"'\s]*)["']""", re.I)
calls = re.compile(r"""(\$\.(?:get|post|ajax|getJSON)\s*\([^;]{0,240}|XMLHttpRequest[^;]{0,200}|fetch\s*\([^;]{0,200}|url\s*:\s*["'][^"']+["'][^;]{0,160})""", re.I)
found = {}
print("\naddresses and requests in the page and its scripts:")
for where, text in texts.items():
    for m in pattern.findall(text):
        found.setdefault(urllib.parse.urljoin(BASE, m), where)
    for m in calls.findall(text):
        print(f"  [{where.rsplit('/', 1)[-1]}] {' '.join(m.split())[:300]}")
print("\ncandidate data addresses:")
for url, where in sorted(found.items()):
    print(f"  {url}   (in {where.rsplit('/', 1)[-1]})")
print("\nwhat each same-site address answers (first 400 characters):")
for url in sorted(found):
    if urllib.parse.urlparse(url).netloc.endswith("d-waste.com"):
        st, kind, body = get(url, 20000)
        print(f"\n  {url}\n    {st} {kind}\n    {' '.join(body.split())[:400]}")
print("\nDone.")
