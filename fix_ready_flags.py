#!/usr/bin/env python3
"""
Set each layer's `ready` and `off` flags to match what actually exists.

Edits map/app.js IN PLACE, so it works against whatever version of the file is
on disk rather than replacing it. Two sessions have been editing app.js today
and a wholesale replacement has already lost work once.

WHY THIS IS NEEDED
ready:true means "there is a row in the panel for this". A row whose archive or
Worker route does not exist renders "archive missing" or a Worker error, which
reads as a broken map rather than an unbuilt source — and eight layers are in
that state right now. ready:false is not hiding them: unbuilt sources are still
named, once, at the foot of the panel.

Run from the repo root:  python3 fix_ready_flags.py
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP = ROOT / "map" / "app.js"
TILES = ROOT / "map" / "tiles"

# Layers that open visible. Everything else that is ready starts switched off.
# Twenty-five point layers on at once is a texture, not a map. This is an
# editorial choice about what a reader meets first — change the set freely, it
# costs nothing and hides nothing.
OPENING_SET = {"owid_co2", "carbon_bombs"}

# Routes that do not need a .pmtiles file. Their availability is checked by
# hand below rather than guessed from the filesystem.
NON_PMTILES = {"country", "worker", "tile", "wmts"}

# No Worker route exists for these — grep for them in worker/index.js returns
# zero. Registered with verified contracts, waiting on the route to be written.
NO_ROUTE_YET = {"cerulean_slicks", "cerulean_sources", "allen_coral"}


def main():
    if not APP.exists():
        sys.exit(f"no {APP} — run this from the repo root")

    src = APP.read_text()
    have = {p.stem for p in TILES.glob("*.pmtiles")} if TILES.exists() else set()
    print(f"{len(have)} archives present in map/tiles/")

    # One layer entry per line in this file, which is what makes a line-wise
    # edit safe. A future multi-line entry would need a parser instead.
    out, changed = [], []
    for line in src.splitlines(keepends=True):
        m = re.search(r'\{ id:"([a-z_0-9]+)",', line)
        if not m or "ready:" not in line:
            out.append(line)
            continue

        lid = m.group(1)
        route = (re.search(r'route:"([a-z]+)"', line) or [None, "pmtiles"])[1]

        if lid in NO_ROUTE_YET:
            available, why = False, "no Worker route written yet"
        elif route in NON_PMTILES:
            # Left as found. A country or tile layer's backing is not a file in
            # map/tiles, so this script has no evidence either way and will not
            # guess — guessing is how a working layer gets switched off.
            out.append(line)
            continue
        else:
            available = lid in have
            why = "archive present" if available else "no .pmtiles archive"

        want_ready = "ready:true" if available else "ready:false"
        was_ready = "ready:true" in line

        new = re.sub(r'ready:(true|false)', want_ready, line)
        # off:true on everything ready that is not in the opening set.
        new = re.sub(r',?\s*off:\s*true', '', new)
        if available and lid not in OPENING_SET:
            new = new.replace(want_ready, want_ready + ", off: true", 1)

        if new != line:
            changed.append(f"  {lid:<28} {'on' if was_ready else 'off'} -> "
                           f"{'on' if available else 'off'}   ({why})")
        out.append(new)

    APP.write_text("".join(out))
    print("\n".join(changed) if changed else "  nothing to change")
    print("\nNow run: node map/test.mjs")


if __name__ == "__main__":
    main()
