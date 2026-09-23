#!/usr/bin/env python3
"""
What is inside the Global Wastewater Model's data package (Tuholske et al.
2021, KNB doi:10.5063/F76B09), before a build is written for it.

The model's own map server is gone, so the five rows of the wastewater layer
have nothing to draw. KNB keeps the data (found 23 September):
  N_PourPoint_And_Watershed.zip     urn:uuid:af8d0bd6-dc0c-4149-a3cd-93b5aed71f7c   403 MB
  FIO_PourPoint_And_Watershed.zip   urn:uuid:cd0c1813-9109-4f27-897b-bdba4384bda1   910 MB
  Global_N_Coastal_Plumes_tifs.zip  urn:uuid:efef18ef-416e-4d4d-9190-f17485c02c15   276 MB

This downloads the nitrogen and plume files (about 680 MB, kept in
pipeline/.wastewater-cache so it happens once) and prints every file inside,
with, for each table, its column names and number of rows, and for each
picture its size. Nothing is changed. Add "fio" to include the 910 MB file of
faecal indicator organisms too.

Run from the repo root:  python3 pipeline/wastewater_inspect.py
"""
import pathlib, struct, sys, urllib.request, zipfile

KNB = "https://knb.ecoinformatics.org/knb/d1/mn/v2/object/"
FILES = {"N_PourPoint_And_Watershed.zip": "urn:uuid:af8d0bd6-dc0c-4149-a3cd-93b5aed71f7c",
         "Global_N_Coastal_Plumes_tifs.zip": "urn:uuid:efef18ef-416e-4d4d-9190-f17485c02c15"}
if "fio" in sys.argv[1:]:
    FILES["FIO_PourPoint_And_Watershed.zip"] = "urn:uuid:cd0c1813-9109-4f27-897b-bdba4384bda1"
CACHE = pathlib.Path(__file__).resolve().parent / ".wastewater-cache"


def fetch(name, pid):
    path = CACHE / name
    if path.exists() and zipfile.is_zipfile(path):
        return path
    CACHE.mkdir(parents=True, exist_ok=True)
    print(f"downloading {name} ...", flush=True)
    req = urllib.request.Request(KNB + urllib.request.quote(pid, safe=""), headers={"User-Agent": "Culprits atlas"})
    with urllib.request.urlopen(req, timeout=600) as r, open(path.with_suffix(".part"), "wb") as out:
        got = 0
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
            got += len(chunk)
            if got % (50 << 20) < (1 << 20):
                print(f"  {got >> 20} MB", flush=True)
    path.with_suffix(".part").rename(path)
    return path


def dbf_fields(data):
    """Column names and row count of a dBase table (the .dbf beside a shapefile)."""
    rows, header = struct.unpack("<IH", data[4:10])
    names, at = [], 32
    while at < header - 1 and data[at] != 0x0D:
        names.append((data[at:at + 11].split(b"\0")[0].decode("latin-1"), chr(data[at + 11]), data[at + 16]))
        at += 32
    return rows, names


for name, pid in FILES.items():
    z = zipfile.ZipFile(fetch(name, pid))
    print(f"\n=== {name} ===")
    for info in z.infolist():
        print(f"  {info.filename}  ({info.file_size:,} bytes)")
        if info.filename.lower().endswith(".dbf"):
            rows, names = dbf_fields(z.read(info))
            print(f"      {rows:,} rows; columns: " + ", ".join(f"{n} ({t}{w})" for n, t, w in names))
        if info.filename.lower().endswith((".prj", ".txt", ".xml", ".csv")) and info.file_size < 4000:
            print("      " + z.read(info).decode("latin-1").replace("\n", " ")[:600])
print("\nDone.")
