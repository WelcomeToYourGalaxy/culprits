"""
Shared harvester for the site's own Leaflet maps.

Each map in pipeline/sitemaps/registry.json becomes its own source and its own
layer. The places are read by running the map's own scripts under node
(pipeline/sitemaps/extract.mjs), so what reaches the atlas is what that map
draws: its positions and its popup text, unedited.

Points only. A map that also shades countries or draws shapes has those counted
and reported, not drawn — a country shading placed at a point would claim a
site that does not exist.

Where the pages are read from:
  Weebly pages   WTYG_SITE (default https://www.welcometoyourgalaxy.com)/<page>.html
  a saved copy   set WTYG_SITE_RECORD to a folder of saved pages, e.g. the
                 unzipped site record, to read those instead of the live site
  GitHub maps    the raw file in the repo, always live
"""

import hashlib
import html
import json
import os
import pathlib
import re
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
REGISTRY = json.loads((ROOT / "pipeline" / "sitemaps" / "registry.json").read_text())["maps"]
EXTRACT = ROOT / "pipeline" / "sitemaps" / "extract.mjs"
SITE = os.environ.get("WTYG_SITE", "https://www.welcometoyourgalaxy.com").rstrip("/")


def entry(sid):
    for m in REGISTRY:
        if m["id"] == sid:
            return m
    raise KeyError(f"{sid} is not in pipeline/sitemaps/registry.json")


def spec_for(m):
    if "url" in m:
        spec = {"url": m["url"]}
    else:
        record = os.environ.get("WTYG_SITE_RECORD")
        if record:
            spec = {"file": str(pathlib.Path(record) / f"{m['page']}.html")}
        else:
            spec = {"url": f"{SITE}/{m['page']}.html"}
        spec["block"] = m["block"]
    if m.get("decode"):
        spec["decode"] = m["decode"]
    return spec


def extract(m):
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as fh:
        out = fh.name
    spec = dict(spec_for(m), out=out)
    subprocess.run(["node", str(EXTRACT), json.dumps(spec)], check=True, timeout=300)
    data = json.loads(pathlib.Path(out).read_text())
    os.unlink(out)
    return data


TITLE = re.compile(r"<(b|strong|h[1-6])\b[^>]*>(.*?)</\1>|class=[\"'][^\"']*(?:title|name)[^\"']*[\"'][^>]*>(.*?)<",
                   re.I | re.S)


def _text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def name_of(f):
    for mt in TITLE.finditer(f.get("popup") or ""):
        t = _text(mt.group(2) or mt.group(3))
        if t and not t.lower().startswith("rank #") and len(t) < 160:
            return t
    for line in (f.get("popup_text") or "").split("\n"):
        line = line.strip()
        if line and not line.lower().startswith("rank #"):
            return line[:160]
    if f.get("tooltip"):
        return f["tooltip"].split("\n")[0][:160]
    props = f.get("props") or {}
    for k in ("name", "title", "Name", "NAME", "label"):
        if props.get(k):
            return str(props[k])[:160]
    return None


def rows(sid):
    m = entry(sid)
    data = extract(m)
    counts = data.get("counts", {})
    for n in data.get("notes", []):
        print(f"{sid}: note: {n}")
    shapes = sum(v for k, v in counts.items() if k in ("polygon", "line", "other"))
    if shapes:
        print(f"{sid}: {shapes} shapes on that map are not points and are not drawn in this layer")

    where = m.get("url") or f"{SITE}/{m['page']}.html"
    out = []
    for f in data["features"]:
        if f["kind"] != "point" or f["lat"] is None:
            continue
        text = html.escape(f.get("popup_text") or f.get("tooltip") or "").replace("\n", "<br>")
        props = f.get("props") or {}
        extra = {"from_the_map": text or None, "map_page": where}
        if not text and props:
            extra["from_the_map"] = html.escape("; ".join(f"{k}: {v}" for k, v in props.items()
                                                         if isinstance(v, (str, int, float)))[:2000]) or None
        ident = hashlib.sha1(f"{f['lat']:.6f},{f['lon']:.6f}|{f.get('popup_text','')}".encode()).hexdigest()[:16]
        out.append({
            "ident": ident,
            "name": name_of(f) or "Unnamed place on this map",
            "lon": f["lon"], "lat": f["lat"],
            "value": None, "unit": m["unit"], "year": None, "url": None,
            "extra": extra,
        })
    print(f"{sid}: {len(out)} places")
    return out


def make(sid):
    def resolve():
        # The page itself is the release: re-read it every run. There is no
        # ETag on a Weebly page worth trusting, and the read is cheap.
        return (entry(sid).get("url") or f"{SITE}/{entry(sid)['page']}.html"), None

    def fetch():
        return rows(sid)

    return resolve, fetch
