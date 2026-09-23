#!/usr/bin/env python3
"""
Every file in a KNB data package, with its id and size, so a build can be
written from what the package really holds. Changes nothing.

Written for the food-footprint package behind Halpern et al. 2022, "The
environmental footprint of global food production" (Nature Sustainability),
cited there as Frazier et al., Global food system pressure data,
doi:10.5063/F1V69H1B: greenhouse gas emissions, freshwater use, habitat
disturbance and nutrient pollution, mapped food by food for 2017. Soy and
maize are among its foods (item 24: the crops' own emissions, not only the
fertiliser Climate TRACE shows).

Run from the repo root:
    python3 pipeline/knb_list.py doi:10.5063/F1V69H1B > ~/Desktop/food_package.txt
"""
import json, sys, urllib.parse, urllib.request

SOLR = "https://knb.ecoinformatics.org/knb/d1/mn/v2/query/solr/"
OBJ = "https://knb.ecoinformatics.org/knb/d1/mn/v2/object/"


def ask(q, start=0):
    url = SOLR + "?" + urllib.parse.urlencode({"q": q, "fl": "id,fileName,size,formatId,title", "rows": 1000,
                                                "start": start, "wt": "json"})
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Culprits atlas"}), timeout=120) as r:
        return json.loads(r.read())["response"]


doi = sys.argv[1] if len(sys.argv) > 1 else "doi:10.5063/F1V69H1B"
head = ask(f'id:"{doi}"')
for d in head.get("docs", []):
    print(f"package: {d.get('title') or d.get('fileName')}  [{d['id']}]")
files, start = [], 0
while True:
    got = ask(f'isDocumentedBy:"{doi}" OR documents:"{doi}"', start)
    files += [d for d in got.get("docs", []) if d["id"] != doi]
    start += 1000
    if start >= got.get("numFound", 0):
        break
total = sum(int(d.get("size") or 0) for d in files)
print(f"{len(files)} files, {total / 1e9:.2f} GB in all\n")
for d in sorted(files, key=lambda d: d.get("fileName") or ""):
    print(f"{d.get('fileName')}  |  {int(d.get('size') or 0) / 1e6:.1f} MB  |  {d.get('formatId', '')}  |  {OBJ}{urllib.parse.quote(d['id'], safe='')}")
