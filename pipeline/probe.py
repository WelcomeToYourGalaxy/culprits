#!/usr/bin/env python3
"""
Check a source's discovery and shape without writing anything.

Some sources could not be reached from the machine their harvester was written
on. Rather than ship code whose network paths have never run and hope, this
tells you in one command whether a harvester's assumptions hold:

    python pipeline/probe.py climate_trace

It resolves the download URL, checks the URL responds, and — with --fetch —
runs the harvester and reports what came back, without touching data/ or the
tile build. Nothing is committed and nothing downstream sees the result.
"""

import argparse
import json
import pathlib
import sys
import traceback

import requests

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

REGISTRY = json.loads((ROOT / "sources.json").read_text())
SOURCES = {s["id"]: s for s in REGISTRY["sources"]}
UA = {"User-Agent": "welcometoyourgalaxy-atlas/1.0 (+https://welcometoyourgalaxy.com)"}

OK, WARN, BAD = "  ok  ", " warn ", " FAIL "


def probe(sid, do_fetch=False):
    meta = SOURCES.get(sid)
    if not meta:
        print(f"{BAD} {sid} is not in sources.json")
        return False

    print(f"\n{sid} — {meta.get('name', sid)}")
    print(f"       licence: {meta.get('licence', 'unchecked')}"
          f"{'' if meta.get('licence_verified') else '  (UNVERIFIED)'}")

    try:
        import importlib
        mod = importlib.import_module(f"sources.{sid}")
    except ModuleNotFoundError:
        print(f"{WARN} no harvester written yet")
        return False

    if not hasattr(mod, "resolve"):
        print(f"{WARN} no resolve() — this source still relies on a static URL")
    else:
        try:
            url, validator = mod.resolve()
        except Exception as e:
            print(f"{BAD} resolve() failed: {type(e).__name__}: {e}")
            # Distinguish "I can't reach the host" from "the page changed".
            # Blaming the pattern for a firewall sends you editing a regex that
            # was never wrong.
            text = f"{e}".lower()
            if "403" in text or "forbidden" in text or "host_not_allowed" in text:
                print("       403 — could be a network policy blocking the host, "
                      "or the site refusing an automated request.")
                print("       Check the host is reachable from here before touching the pattern.")
            elif isinstance(e, LookupError):
                print("       the page loaded but no link matched — the pattern is stale")
            else:
                print("       network or parsing failure; rerun before changing anything")
            return False
        print(f"{OK} resolved: {url}")
        print(f"       change signal: {(validator or 'none')[:40]}")

        try:
            head = requests.head(url, headers=UA, timeout=45, allow_redirects=True)
            size = head.headers.get("Content-Length")
            print(f"{OK if head.ok else BAD} URL responds {head.status_code}"
                  + (f", {int(size)/1e6:.1f} MB" if size else ""))
            if not head.ok:
                return False
        except requests.RequestException as e:
            print(f"{BAD} URL unreachable: {e}")
            return False

    if not do_fetch:
        print("       (add --fetch to run the harvester and check the data shape)")
        return True

    try:
        rows = mod.fetch()
    except Exception:
        print(f"{BAD} fetch() raised:")
        traceback.print_exc(limit=4)
        return False

    if not rows:
        print(f"{WARN} fetch() returned no rows")
        return False

    print(f"{OK} {len(rows):,} rows")
    sample = rows[0]
    missing = [k for k in ("ident", "name", "lon", "lat") if sample.get(k) in (None, "")]
    if missing:
        print(f"{BAD} first row missing required fields: {missing}")
        return False
    print(f"       sample: {sample['name']} @ {sample['lat']},{sample['lon']} "
          f"= {sample.get('value')} {sample.get('unit')}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sources", nargs="*", help="source ids; omit for all with harvesters")
    ap.add_argument("--fetch", action="store_true", help="also run fetch() and check shape")
    args = ap.parse_args()

    ids = args.sources or sorted(
        p.stem for p in (ROOT / "pipeline" / "sources").glob("*.py")
        if not p.stem.startswith("__")
    )
    results = {sid: probe(sid, args.fetch) for sid in ids}

    good = sum(1 for v in results.values() if v)
    print(f"\n{good}/{len(results)} passed")
    sys.exit(0 if good == len(results) else 1)


if __name__ == "__main__":
    main()
