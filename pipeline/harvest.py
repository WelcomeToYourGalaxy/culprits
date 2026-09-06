#!/usr/bin/env python3
"""
Harvest driver.

Two jobs. First, decide which sources actually changed — these publish on
release cycles, so most weeks nothing has, and a HEAD request settles it far
cheaper than a download. Second, hand the changed ones to their source module.

A source module is one function, `fetch() -> list[dict]`, where each dict is
the keyword arguments for normalize.feature(). Nothing else. That contract is
deliberately narrow so adding a source is a small file, not a change here.

Modules that don't exist yet are reported as pending rather than failing the
run, so the pipeline is useful before all 20 sources are written.
"""

import argparse
import importlib
import json
import pathlib
import sys
import traceback

import requests

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = json.loads((ROOT / "sources.json").read_text())
SOURCES = [s for s in REGISTRY["sources"] if not s["id"].startswith("_")]
UA = {"User-Agent": "welcometoyourgalaxy-atlas/1.0 (+https://welcometoyourgalaxy.com)"}


def load_state(path):
    p = pathlib.Path(path)
    return json.loads(p.read_text()) if p.exists() else {}


def save_state(path, state):
    pathlib.Path(path).write_text(json.dumps(state, indent=1, sort_keys=True))


def changed_upstream(meta, state, force):
    """
    Returns (needs_harvest, reason, validator).

    Release detection is a HEAD request comparing ETag or Last-Modified. Where
    a source has no stable URL to poll — GEM's download sits behind a request
    form — we fall back to watching the manual drop directory instead.
    """
    sid = meta["id"]
    if force:
        return True, "forced", None

    if meta.get("auth") == "manual":
        drop = ROOT / meta.get("manual_drop", f"data/manual/{sid}/")
        if not drop.exists() or not any(drop.iterdir()):
            return False, "awaiting a manual download — nothing in the drop directory", None
        stamp = max(f.stat().st_mtime for f in drop.iterdir() if f.is_file())
        if state.get(sid, {}).get("validator") == stamp:
            return False, "manual drop unchanged", stamp
        return True, "new file in manual drop", stamp

    # A source module that defines resolve() finds its own current URL, so
    # nothing in this repo holds a path that can expire. Only sources without
    # one fall back to the static entry in sources.json.
    tag = None
    try:
        mod = importlib.import_module(f"sources.{sid}")
        if hasattr(mod, "resolve"):
            url, tag = mod.resolve()
            if url is None and tag is None:
                return False, "harvester reports its source is not resolvable yet", None
        else:
            raise AttributeError
    except (ModuleNotFoundError, AttributeError):
        url = meta.get("bulk") or meta.get("endpoint")
        if not url:
            return False, "no endpoint recorded yet", None
        try:
            r = requests.head(url, headers=UA, timeout=25, allow_redirects=True)
            tag = r.headers.get("ETag") or r.headers.get("Last-Modified")
        except requests.RequestException as e:
            return False, f"HEAD failed: {e}", None
    except Exception as e:
        return False, f"could not resolve download URL: {e}", None
    if not tag:
        # No validator offered. Re-harvest rather than silently going stale;
        # these run weekly, so the cost is bounded.
        return True, "no ETag or Last-Modified offered — refreshing anyway", None
    if state.get(sid, {}).get("validator") == tag:
        return False, "unchanged", tag
    return True, "new release", tag


def harvest_one(meta):
    """Import the source module and run it. Missing module is not an error."""
    sid = meta["id"]
    try:
        mod = importlib.import_module(f"sources.{sid}")
    except ModuleNotFoundError:
        return None, f"pending — sources/{sid}.py not written yet"

    rows = mod.fetch()
    if not rows:
        return None, "returned no rows"
    out = ROOT / "data" / "raw" / f"{sid}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows))
    return len(rows), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", default=".etags.json")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", help="comma-separated source ids")
    args = ap.parse_args()

    sys.path.insert(0, str(ROOT / "pipeline"))
    state = load_state(args.state)
    wanted = set(args.only.split(",")) if args.only else None

    changed = []
    for meta in SOURCES:
        sid = meta["id"]
        if wanted and sid not in wanted:
            continue
        if meta.get("mode") in ("none", "tiles"):
            continue

        needed, why, validator = changed_upstream(meta, state, args.force)
        if not needed:
            print(f"  skip  {sid:<24} {why}")
            continue

        try:
            count, problem = harvest_one(meta)
        except Exception:
            # One broken source must not take the whole refresh down.
            print(f"  FAIL  {sid:<24} harvester raised:")
            traceback.print_exc(limit=3)
            continue

        if problem:
            print(f"  wait  {sid:<24} {problem}")
            continue

        print(f"  ok    {sid:<24} {count} rows ({why})")
        changed.append(sid)
        # Only record the validator after a successful harvest, so a failed run
        # is retried next week rather than being marked as done.
        state.setdefault(sid, {})["validator"] = validator

    save_state(args.state, state)
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / ".changed").write_text("\n".join(changed))
    print(f"\n{len(changed)} source(s) refreshed: {', '.join(changed) or 'none'}")


if __name__ == "__main__":
    main()
