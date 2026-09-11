"""
Shared loader for the Welcome to Your Galaxy repos.

Five of the maps in this suite already publish their data as JSON in a public
GitHub repo. That makes them the cheapest sources in the queue: the shape is
known, the licence question is the same one as this repo's, and every file is
fetchable without a key.

It sits in pipeline/ beside discover.py rather than in sources/, because it is not
a harvester: the driver only imports `sources.<id>` for ids listed in
sources.json, so nothing here is ever run as a source.

TWO WAYS IN, DELIBERATELY

`repo_json()` goes through discover.github_file(), which asks the API for the
file's blob SHA. The SHA changes when and only when the content changes, so it
is the best validator available — but it costs one API call per file, and
unauthenticated GitHub allows 60 an hour per IP.

`raw_json()` skips the API and reads raw.githubusercontent directly. Use it for
the second and subsequent files of a source that has already resolved one
through the API — local-map's 826 project tiles would otherwise spend 826 calls
against a 60-per-hour budget and fail partway, leaving a harvest that looks
complete and is not.
"""

import gzip
import json

import requests

import discover

OWNER = "WelcomeToYourGalaxy"
UA = {"User-Agent": "welcometoyourgalaxy-atlas/1.0 (+https://welcometoyourgalaxy.com)"}
TIMEOUT = 300


def resolve_repo_file(repo, path, branch="main"):
    """(url, validator) for one file, via the API. Costs one API call."""
    return discover.github_file(f"{OWNER}/{repo}", path, branch=branch)


def raw_url(repo, path, branch="main"):
    return f"https://raw.githubusercontent.com/{OWNER}/{repo}/{branch}/{path}"


def _decode(content, url):
    # .json.gz is stored as gzipped bytes in the repo, and raw.githubusercontent
    # serves those bytes without a Content-Encoding header — so requests does
    # not transparently decompress them and .text would be mojibake. Sniff the
    # gzip magic number rather than trusting the extension, because a file
    # renamed without being recompressed would otherwise fail silently.
    if content[:2] == b"\x1f\x8b":
        content = gzip.decompress(content)
    return json.loads(content)


def raw_json(repo, path, branch="main"):
    """Read a JSON (or .json.gz) file straight from raw.githubusercontent."""
    url = raw_url(repo, path, branch)
    r = requests.get(url, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    return _decode(r.content, url)


def repo_json(repo, path, branch="main"):
    """Resolve through the API, then read. Returns (data, validator)."""
    url, validator = resolve_repo_file(repo, path, branch=branch)
    r = requests.get(url, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    return _decode(r.content, url), validator


def precision_from(row):
    """
    Map these repos' own imprecision flags onto the atlas's `precision`
    vocabulary, which the map reads to decide whether a dot renders solid.

    The repos record imprecision two ways: a boolean `precise`, and in the
    remains repo a `geo` string naming what kind of thing the point stands for.

    THE GEO VOCABULARY IS NOT OPTIONAL TO GET RIGHT
    The remains repo's values are `exact`, `coarsened`, `area` and `admin`.
    `coarsened` is the blur it applies to anything that is itself a burial
    location — 2,580 of 4,020 records — and an earlier version of this function
    did not know the word, so all 2,580 fell through to None and would have
    drawn as solid, precisely located graves. That is the failure the source
    repo exists to prevent, and it was invisible: the harvest succeeded, the
    counts looked right, and the map would have published coordinates dressed
    as exact that the source had deliberately degraded.

    So the mapping is explicit and unknown values fail safe to "unknown", which
    the map already draws hollow with a popup saying the source gives no
    definition. A vocabulary that grows a new term should cost a vague dot, not
    a false one.
    """
    geo = row.get("geo")
    if geo is not None:
        return {
            "exact": None,        # a located record; draws solid
            "coarsened": "blurred",
            "area": "area",
            "admin": "admin",
            "grid": "grid",
            "country": "country",
        }.get(geo, "unknown")
    if row.get("precise") is False:
        return "admin"
    return None
