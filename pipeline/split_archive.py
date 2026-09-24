#!/usr/bin/env python3
"""
Cut a .pmtiles archive that is over GitHub's 100 MB cap into files it will take,
by zoom - the same cut as culprits-tiles-more's mines build - so nothing has to
go to outside storage and nothing is dropped.

  python3 pipeline/split_archive.py map/tiles/abattoir_facilities.pmtiles

Leaves <id>.pmtiles holding the low zooms, <id>_2.pmtiles the next zooms, and
so on, each under LIMIT, and writes <id>.build.json listing the parts and the
zooms each holds; map/app.js's pmtiles route reads that list and draws each
part at its own zooms. Every tile tippecanoe made is in exactly one file; the
count is checked before anything is kept. A single zoom too big for one file
is cut in two down a line of longitude.
"""
import json, pathlib, sqlite3, subprocess, sys, tempfile

LIMIT = 95 * 1024 * 1024


def sh(*cmd):
    subprocess.run(cmd, check=True)


def cut(src, dst, where, args):
    if dst.exists():
        dst.unlink()
    con = sqlite3.connect(str(dst))
    con.execute("ATTACH DATABASE ? AS src", (str(src),))
    con.execute("CREATE TABLE metadata (name text, value text)")
    con.execute("INSERT INTO metadata SELECT name, value FROM src.metadata")
    con.execute("CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob)")
    con.execute(f"INSERT INTO tiles SELECT zoom_level, tile_column, tile_row, tile_data FROM src.tiles WHERE {where}", args)
    con.execute("CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)")
    n = con.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
    lo, hi = con.execute("SELECT MIN(zoom_level), MAX(zoom_level) FROM tiles").fetchone()
    for k, v in (("minzoom", lo), ("maxzoom", hi)):
        con.execute("DELETE FROM metadata WHERE name = ?", (k,))
        con.execute("INSERT INTO metadata VALUES (?, ?)", (k, str(v)))
    con.commit()
    con.close()
    return n


def main(path):
    out = pathlib.Path(path)
    if out.stat().st_size <= LIMIT:
        print(f"{out.name}: {out.stat().st_size / 1e6:.0f} MB, under the cap; nothing to cut")
        return
    work = pathlib.Path(tempfile.mkdtemp())
    whole = work / "whole.mbtiles"
    sh("tile-join", "-o", str(whole), "--force", "-q", str(out))
    con = sqlite3.connect(str(whole))
    total = con.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
    zooms = [z for (z,) in con.execute("SELECT DISTINCT zoom_level FROM tiles ORDER BY 1")]
    con.close()
    for old in out.parent.glob(f"{out.stem}_*.pmtiles"):
        old.unlink()
    todo = [(zooms[0], zooms[-1], None, None)]
    parts, placed = [], 0
    while todo:
        z0, z1, x0, x1 = todo.pop(0)
        n = len(parts) + 1
        where, args = "zoom_level BETWEEN ? AND ?", [z0, z1]
        if x0 is not None:
            where, args = where + " AND tile_column BETWEEN ? AND ?", args + [x0, x1]
        piece = work / f"piece_{n}.mbtiles"
        count = cut(whole, piece, where, args)
        dest = out.parent / (out.name if n == 1 else f"{out.stem}_{n}.pmtiles")
        sh("tile-join", "-o", str(dest), "--force", "-q", str(piece))
        size = dest.stat().st_size
        if size > LIMIT:
            if z1 > z0:
                nxt = (z1, z1, x0, x1)
                if todo and x0 is None and todo[0][2] is None and todo[0][0] == z1 + 1:
                    nxt = (z1, todo.pop(0)[1], None, None)
                todo = [(z0, z1 - 1, x0, x1), nxt] + todo
            else:
                con = sqlite3.connect(str(piece))
                rows = con.execute("SELECT tile_column, SUM(LENGTH(tile_data)) FROM tiles GROUP BY 1 ORDER BY 1").fetchall()
                con.close()
                if len(rows) < 2:
                    sys.exit(f"{out.name}: zoom {z0} will not fit under the cap however it is cut")
                half, run, mid = sum(b for _, b in rows) / 2, 0, rows[0][0]
                for col, b in rows[:-1]:
                    run, mid = run + b, col
                    if run >= half:
                        break
                todo = [(z0, z0, rows[0][0], mid), (z0, z0, mid + 1, rows[-1][0])] + todo
            continue
        placed += count
        part = {"file": dest.name, "from": z0, "to": z1, "bytes": size}
        if x0 is not None:
            part["columns"] = [x0, x1]
        parts.append(part)
        print(f"  {dest.name}: zoom {z0} to {z1}" + (f", columns {x0} to {x1}" if x0 is not None else "") + f" - {size / 1e6:.1f} MB, {count:,} tiles")
    if placed != total:
        sys.exit(f"{out.name}: {total:,} tiles were made but {placed:,} reached the files; nothing kept")
    out.with_suffix(".build.json").write_text(json.dumps({"parts": parts, "zoom": zooms[-1]}, indent=1))
    print(f"{out.name}: cut into {len(parts)} files, all {total:,} tiles kept")


if __name__ == "__main__":
    main(sys.argv[1])
