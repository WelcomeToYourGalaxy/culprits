#!/usr/bin/env python3
"""
The Global Wastewater Model (Tuholske et al. 2021, KNB doi:10.5063/F76B09),
rebuilt from its data package now that its own map server is gone.

Reads the package that pipeline/wastewater_inspect.py downloaded into
pipeline/.wastewater-cache and makes:

  <tiles>/wastewater_n_tot.pmtiles       every one of the 134,846 pour points
  <tiles>/wastewater_n_treated.pmtiles   (where a watershed's wastewater
  <tiles>/wastewater_n_septic.pmtiles    reaches the coast), each archive
  <tiles>/wastewater_n_open.pmtiles      weighing the points by one measure
  map/data/wastewater_n_countries.countries.json   the package's own country totals

Every point is kept, with every field the package gives it. Each archive's
"value" is its own measure (all wastewater, from treatment plants, from septic
systems, or untreated), so the map's glow is weighed by it. The unit is not
written in the package's tables; it is worked out from the global total the
paper states (6.2 million tonnes of nitrogen a year) and printed, and the build
stops if the total fits no unit, rather than guessing.

The coastal plume pictures (four 3 GB GeoTIFFs) are not built here.

Run from the repo root, with tippecanoe installed:
    pip install pyshp
    python3 pipeline/wastewater_build.py [--tiles ~/Desktop/culprits-tiles-more/tiles]
"""
import io, json, math, pathlib, subprocess, sys, tempfile, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".wastewater-cache"
ZIP = CACHE / "N_PourPoint_And_Watershed.zip"
DATA = ROOT / "map" / "data" / "wastewater_n_countries.countries.json"
MEASURES = {"tot": "tot_N", "treated": "treated_N", "septic": "septic_N", "open": "open_N"}
PAPER_TOTAL_T = 6.2e6          # tonnes of nitrogen a year, the paper's global figure
CITE = "Tuholske et al. 2021, Global Wastewater Model (KNB doi:10.5063/F76B09)"


def tiles_dir():
    if "--tiles" in sys.argv:
        return pathlib.Path(sys.argv[sys.argv.index("--tiles") + 1]).expanduser()
    return pathlib.Path("~/Desktop/culprits-tiles-more/tiles").expanduser()


def reader(z, stem, table_only=False):
    import shapefile
    part = lambda ext: io.BytesIO(z.read(f"{stem}.{ext}")) if f"{stem}.{ext}" in z.namelist() else None
    if table_only:                       # the country shapes are 510 MB and only their table is used
        return shapefile.Reader(dbf=part("dbf"), encoding="utf-8")
    return shapefile.Reader(shp=part("shp"), shx=part("shx"), dbf=part("dbf"), encoding="utf-8")


def clean(v):
    if isinstance(v, float) and not math.isfinite(v):
        return None
    return v.strip() if isinstance(v, str) else v


def unit_of(total):
    """The unit the tables are in, from how their global total compares with the paper's."""
    for name, per_tonne in (("kilograms", 1e3), ("grams", 1e6), ("tonnes", 1.0)):
        if 0.5 <= total / (PAPER_TOTAL_T * per_tonne) <= 2:
            return name, per_tonne
    return None, None


def main():
    if not ZIP.exists():
        sys.exit(f"{ZIP} is not there; run pipeline/wastewater_inspect.py first.")
    try:
        import shapefile  # noqa: F401
    except ImportError:
        sys.exit("pyshp is needed: pip install pyshp")
    z = zipfile.ZipFile(ZIP)
    pts = reader(z, "effluent_N_pourpoints_all")
    x0, y0, x1, y1 = pts.bbox
    if not (-181 <= x0 <= x1 <= 181 and -91 <= y0 <= y1 <= 91):
        sys.exit(f"The pour points are not in longitude and latitude (their extent is {pts.bbox}), and the package "
                 "gives no projection file; nothing was built.")
    names = [f[0] for f in pts.fields[1:]]
    rows = []
    for sr in pts.iterShapeRecords():
        if not sr.shape.points:
            continue
        lon, lat = sr.shape.points[0]
        rows.append(((round(lon, 5), round(lat, 5)), {k: clean(v) for k, v in zip(names, sr.record)}))
    total = sum(float(p.get("tot_N") or 0) for _, p in rows)
    unit, per_tonne = unit_of(total)
    if not unit:
        sys.exit(f"The pour points add up to {total:,.0f}, which fits no unit against the paper's 6.2 million tonnes; nothing was built.")
    print(f"wastewater: {len(rows):,} pour points; together {total:,.0f}, so the tables are in {unit} of nitrogen a year "
          f"({total / per_tonne / 1e6:.2f} million tonnes)", flush=True)
    unit_text = f"{unit} of nitrogen a year"

    out = tiles_dir()
    out.mkdir(parents=True, exist_ok=True)
    for key, field in MEASURES.items():
        lid = f"wastewater_n_{key}"
        with tempfile.NamedTemporaryFile("w", suffix=".geojsonl", delete=False) as f:
            for (lon, lat), p in rows:
                props = dict(p, value=p.get(field), unit=unit_text, source=CITE)
                f.write(json.dumps({"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]},
                                    "properties": props}, separators=(",", ":")) + "\n")
            path = f.name
        dest = out / f"{lid}.pmtiles"
        # Every point at every zoom: no dropping, no merging.
        cmd = ["tippecanoe", "-o", str(dest), "--force", "-l", lid, "-z10", "-r1",
               "--no-feature-limit", "--no-tile-size-limit", "-P", path]
        subprocess.run(cmd, check=True)
        size = dest.stat().st_size
        print(f"wastewater: {dest.name} {size / 1e6:.1f} MB", flush=True)
        if size > 95e6:
            print(f"  {dest.name} is over 95 MB, which GitHub refuses; say so and it will be cut into parts.", flush=True)

    cty = reader(z, "effluent_N_countries_gdam_all", table_only=True)
    cnames = [f[0] for f in cty.fields[1:]]
    countries = {}
    for rec in cty.iterRecords():
        p = {k: clean(v) for k, v in zip(cnames, rec)}
        iso = p.get("ISO3")
        if not iso:
            continue
        countries[iso] = dict({"id": iso, "source": "wastewater_n_countries", "name": iso, "value": p.get("tot_N"),
                               "unit": unit_text, "year": 2015, "licence": "see the KNB record",
                               "url": "https://doi.org/10.5063/F76B09"},
                              **{f"x_{k}": v for k, v in p.items()})
    DATA.write_text(json.dumps(countries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wastewater: {len(countries)} countries written to {DATA.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
