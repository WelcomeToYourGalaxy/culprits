"""
Find the current download URL for a source, every run.

A hardcoded path is a maintenance appointment. Banking on Climate Chaos stamps
the year into its filename; GitHub repos rename their default branch; agencies
reorganise their download pages. Each of those breaks a pinned URL silently —
the harvest keeps succeeding against a stale file, or starts 404ing, and either
way nobody finds out until someone checks by hand.

So no source module stores a URL. Each one asks for its file by description,
and gets whatever is current.
"""

import os
import re
import urllib.parse

import requests

UA = {"User-Agent": "welcometoyourgalaxy-atlas/1.0 (+https://welcometoyourgalaxy.com)"}
TIMEOUT = 60


def _gh_headers():
    """
    Unauthenticated GitHub API is 60 requests/hour, shared per IP — enough to
    fail on a busy runner. Actions sets GITHUB_TOKEN automatically and it lifts
    the limit to 1,000/hour, so use it when it's there.
    """
    h = dict(UA)
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        h["Authorization"] = f"Bearer {token}"
    h["Accept"] = "application/vnd.github+json"
    return h


def github_file(repo, path, branch=None):
    """
    Resolve a file in a GitHub repo to its raw URL plus a content hash.

    Asks the API for the repo's current default branch rather than assuming
    'main', then for the file's blob SHA. The SHA is a better change signal
    than an ETag: it changes when and only when the file's content changes.

    If the API is unavailable — rate limit, outage — falls back to the
    conventional branch and to the raw file's own ETag, so a rate limit
    degrades the change signal instead of failing the harvest.

    Returns (raw_url, validator).
    """
    api = "https://api.github.com"
    resolved = branch

    if resolved is None:
        try:
            r = requests.get(f"{api}/repos/{repo}", headers=_gh_headers(), timeout=TIMEOUT)
            r.raise_for_status()
            resolved = r.json()["default_branch"]
        except requests.RequestException:
            resolved = "main"

    raw = f"https://raw.githubusercontent.com/{repo}/{resolved}/{path}"

    try:
        r = requests.get(f"{api}/repos/{repo}/contents/{path}",
                         params={"ref": resolved}, headers=_gh_headers(), timeout=TIMEOUT)
        r.raise_for_status()
        meta = r.json()
        if isinstance(meta, list):
            raise ValueError(f"{repo}/{path} is a directory, not a file")
        return raw, meta["sha"]
    except (requests.RequestException, KeyError, ValueError):
        return raw, validator(raw)


def page_link(page_url, pattern, pick="last", base=None):
    """
    Scrape a page for the link matching `pattern` and return it absolute.

    `pick` decides which match wins when there are several:
      "last"    — last in document order
      "first"   — first in document order
      "highest" — the one whose first capture group sorts highest, which is how
                  you get the newest year out of a set of year-stamped files
                  without knowing what years exist

    Raises if nothing matches. A source that silently finds no file and
    harvests nothing looks identical to a source with no new data, and those
    two need to be told apart.
    """
    r = requests.get(page_url, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()

    rx = re.compile(pattern, re.I)
    hits = []
    for href in re.findall(r'href=["\']([^"\']+)["\']', r.text, re.I):
        m = rx.search(href)
        if m:
            hits.append((m.groups()[0] if m.groups() else "", href))

    if not hits:
        raise LookupError(f"no link matching {pattern!r} on {page_url}")

    if pick == "highest":
        chosen = max(hits, key=lambda h: h[0])[1]
    elif pick == "first":
        chosen = hits[0][1]
    else:
        chosen = hits[-1][1]

    return urllib.parse.urljoin(base or page_url, chosen)


def validator(url):
    """Cheapest available change signal for an arbitrary URL."""
    try:
        r = requests.head(url, headers=UA, timeout=30, allow_redirects=True)
        return r.headers.get("ETag") or r.headers.get("Last-Modified")
    except requests.RequestException:
        return None
