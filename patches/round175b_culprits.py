#!/usr/bin/env python3
"""
Round 175b (culprits), 4 October 2026. Needs round 174b.

Ocean acidity note; the ocean fixes are in the tiles patch.

Run from the repository root (the apply-patch workflow does).
"""
import base64, pathlib, subprocess, sys, tempfile

NOTES = ["## Round 175b (4 October)\n\nNeeds round 174b (guards on its heading). Tiles patch round175b_tiles.py\nbeside it. No app.js?v= bump.\n\n- Ocean acidity (tiles oceans_more.py, acid): the run failed with\n  \"'NoneType' object has no attribute 'max'\": the old code took one model's\n  file (ACCESS-ESM1-5) and looked for latitude and longitude only under the\n  dimensions' names. Now it takes the accession's own multi-model median,\n  pHT_median_historical.nc (earliest year and the one nearest 2020),\n  pHT_median_ssp245.nc and pHT_median_ssp585.nc (each at its last year), and\n  finds the axes by name or standard_name (nc_axis), 2-D axes too. Tested on\n  stand-in NetCDF files. The ocean_acid note says so.\n- Ocean pressures (tiles ocean_stressors.py): the search over all of DataONE\n  by file name found nothing. Each pressure now reads its own KNB data\n  package (resource maps from the Ocean Health Index data page), listed\n  through KNB's index first and DataONE's second, downloaded from KNB\n  first. A file is taken only if its name says rescaled and has the year, or\n  from a zip named rescaled; otherwise the package's file list is written to\n  oceans/stressors.build.json and nothing is guessed. Tested with stand-ins\n  (KNB is blocked from the sandbox).\n- Coal mine owners ranked by methane: not built. The Global Energy Monitor\n  download (round 146b's tiles) never reached gem/coal/download/, which holds\n  only its README; the owner is asked to attach the files again.\n"]

DIFF = "ZGlmZiAtLWdpdCBhL21hcC9hcHAuanMgYi9tYXAvYXBwLmpzCmluZGV4IDBmODRjYTAuLjYxYTFlNTEgMTAwNjQ0Ci0tLSBhL21hcC9hcHAuanMKKysrIGIvbWFwL2FwcC5qcwpAQCAtMjQwNDIsNyArMjQwNDIsNyBAQCBjb25zdCBPVEhFUl9NQVBTID0gewogICAgIHsgaWQ6ICJvY2Vhbl9hY2lkIiwgbmFtZTogIkhvdyBhY2lkaWMgdGhlIHNlYSBzdXJmYWNlIGlzLCAxNzUwLCB0b2RheSBhbmQgMjEwMCAocEg7IEppYW5nIGV0IGFsLiAyMDIzLCBOT0FBKSIsIHVuaXQ6ICJwSCIsIGNvbG91cjogIiMxRTZGQTgiLCBrZWVwQ29sb3VyOiB0cnVlLCByb3V0ZTogInJhc3RlcmxpdmUiLCByZWFkeTogdHJ1ZSwgbGF6eTogdHJ1ZSwKICAgICAgIGF0dHJpYnV0aW9uOiAiSmlhbmcgZXQgYWwuIDIwMjMsIE5PQUEgTkNFSSAwMjU5MzkxIChDQzApIiwgcmFzdGVyUGFpbnQ6IHsgInJhc3Rlci1vcGFjaXR5IjogMC44NSwgInJhc3Rlci1zYXR1cmF0aW9uIjogMCB9LAogICAgICAgY2hvaWNlczogW10sIGNob2ljZXNVcmw6ICJodHRwczovL3dlbGNvbWV0b3lvdXJnYWxheHkuZ2l0aHViLmlvL2N1bHByaXRzLXRpbGVzLW1vcmUvdGlsZXMvb2NlYW5fYWNpZC5jaG9pY2VzLmpzb24iLAotICAgICAgbm90ZTogIlN1cmZhY2Ugb2NlYW4gcEggd29ybGR3aWRlIGZyb20gSmlhbmcgZXQgYWwuIDIwMjMgKE5PQUEgTkNFSSBhY2Nlc3Npb24gMDI1OTM5MSwgQ0MwKSwgZnJvbSBiZWZvcmUgaW5kdXN0cnkgdG8gdGhlIGVuZCBvZiB0aGUgY2VudHVyeTogdGhlIGxvd2VyIHRoZSBwSCwgdGhlIG1vcmUgYWNpZGljLCBhcyB0aGUgc2VhIHRha2VzIHVwIHRoZSBjYXJib24gZGlveGlkZSBwZW9wbGUgcmVsZWFzZS4gU2hlbGxzIGFuZCBjb3JhbHMgZ3JvdyB3aXRoIG1vcmUgZGlmZmljdWx0eSBhcyBpdCBmYWxscy4gVGhlIG1hcCdzIG93biBjb3B5LCBtYWRlIGJ5IGN1bHByaXRzLXRpbGVzLW1vcmUgKHNjcmlwdHMvb2NlYW5zX21vcmUucHkpLiIgfSwKKyAgICAgIG5vdGU6ICJTdXJmYWNlIG9jZWFuIHBIIHdvcmxkd2lkZSBmcm9tIEppYW5nIGV0IGFsLiAyMDIzIChOT0FBIE5DRUkgYWNjZXNzaW9uIDAyNTkzOTEsIENDMCksIGZyb20gYmVmb3JlIGluZHVzdHJ5IHRvIHRoZSBlbmQgb2YgdGhlIGNlbnR1cnksIGFzIHRoZSBtZWRpYW4gb2YgdGhlIGFjY2Vzc2lvbidzIGNsaW1hdGUgbW9kZWxzOyB0aGUgZnV0dXJlcyBhcmUgbWlkZGxlIG9mIHRoZSByb2FkIChTU1AyLTQuNSkgYW5kIHZlcnkgaGlnaCBlbWlzc2lvbnMgKFNTUDUtOC41KSwgZWFjaCBhdCAyMTAwLiBUaGUgbG93ZXIgdGhlIHBILCB0aGUgbW9yZSBhY2lkaWMsIGFzIHRoZSBzZWEgdGFrZXMgdXAgdGhlIGNhcmJvbiBkaW94aWRlIHBlb3BsZSByZWxlYXNlLiBTaGVsbHMgYW5kIGNvcmFscyBncm93IHdpdGggbW9yZSBkaWZmaWN1bHR5IGFzIGl0IGZhbGxzLiBUaGUgbWFwJ3Mgb3duIGNvcHksIG1hZGUgYnkgY3VscHJpdHMtdGlsZXMtbW9yZSAoc2NyaXB0cy9vY2VhbnNfbW9yZS5weSkuIiB9LAogICAgIHsgaWQ6ICJvY2Vhbl9oZWF0IiwgbmFtZTogIk1hcmluZSBoZWF0d2F2ZXM6IGhvdyBtdWNoIHdhcm1lciBvciBjb2xkZXIgdGhlIHNlYSBzdXJmYWNlIGlzIHRoYW4gdXN1YWwsIG5ld2VzdCBkYXkgKE5PQUEgQ29yYWwgUmVlZiBXYXRjaCkiLCBjaG9pY2VNYXRjaDogL15TZWEgc3VyZmFjZSB0ZW1wZXJhdHVyZS9pLCB1bml0OiAiNSBrbSIsIGNvbG91cjogIiNBMDUyNUEiLCBrZWVwQ29sb3VyOiB0cnVlLCByb3V0ZTogInJhc3RlcmxpdmUiLCByZWFkeTogdHJ1ZSwgbGF6eTogdHJ1ZSwKICAgICAgIGF0dHJpYnV0aW9uOiAiTk9BQSBDb3JhbCBSZWVmIFdhdGNoIiwgcmFzdGVyUGFpbnQ6IHsgInJhc3Rlci1vcGFjaXR5IjogMC44NSwgInJhc3Rlci1zYXR1cmF0aW9uIjogMCB9LAogICAgICAgY2hvaWNlczogW10sIGNob2ljZXNVcmw6ICJodHRwczovL3dlbGNvbWV0b3lvdXJnYWxheHkuZ2l0aHViLmlvL2N1bHByaXRzLXRpbGVzLW1vcmUvdGlsZXMvb2NlYW5faGVhdC5jaG9pY2VzLmpzb24iLApkaWZmIC0tZ2l0IGEvbWFwL3Rlc3QubWpzIGIvbWFwL3Rlc3QubWpzCmluZGV4IGQ4OGM5ZmUuLjM4ZGJkNjEgMTAwNjQ0Ci0tLSBhL21hcC90ZXN0Lm1qcworKysgYi9tYXAvdGVzdC5tanMKQEAgLTY5MTIsNiArNjkxMiwxMiBAQCBjb25zb2xlLmxvZygiXG5yb3VuZCAxNzRiICg0IE9jdG9iZXIpOiBvbmUgY29sb3VyIGZvciBhIGxheWVyIG9yIGEgaGVhZGluZyAodGhlCiAgICAgICAgIC9cLnRvYy1zZWMvLnRlc3Qoc3JjLnNsaWNlKHNyYy5pbmRleE9mKCJmdW5jdGlvbiB0aW50VG9vbHMoYm94KSIpLCBzcmMuaW5kZXhPZigiZnVuY3Rpb24gYWRkUm93VG9vbHMoYm94KSIpKSkpOwogfQogCitjb25zb2xlLmxvZygiXG5yb3VuZCAxNzViICg0IE9jdG9iZXIpOiBvY2VhbiBhY2lkaXR5IGZyb20gdGhlIG1vZGVscycgbWVkaWFuIik7Cit7CisgIGNvbnN0IHNyYyA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oSEVSRSwgImFwcC5qcyIpLCAidXRmOCIpOworICBjaGVjaygidGhlIGFjaWRpdHkgcm93IHNheXMgaXQgaXMgdGhlIG1vZGVscycgbWVkaWFuLCB3aXRoIGJvdGggZnV0dXJlcyIsIC9hcyB0aGUgbWVkaWFuIG9mIHRoZSBhY2Nlc3Npb24ncyBjbGltYXRlIG1vZGVsczsgdGhlIGZ1dHVyZXMgYXJlIG1pZGRsZSBvZiB0aGUgcm9hZCBcKFNTUDItNFwuNVwpIGFuZCB2ZXJ5IGhpZ2ggZW1pc3Npb25zIFwoU1NQNS04XC41XCkvLnRlc3Qoc3JjKSk7Cit9CisKIGNvbnNvbGUubG9nKCJcbnJvdW5kIDExMGMgKDI5IFNlcHRlbWJlcik6IHBsYW50ZWQsIGJvdWdodCBvciBjYXB0dXJlZCwgd29ybGR3aWRlIik7CiB7CiAgIGNvbnN0IHNyYyA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oSEVSRSwgImFwcC5qcyIpLCAidXRmOCIpOwo="


def git(*a, check=True):
    return subprocess.run(["git", *a], capture_output=True, text=True, check=check)


def main():
    root = pathlib.Path(".")
    if not (root / "map" / "app.js").exists():
        sys.exit("round175b: run from the culprits repository root")
    h = root / "HANDOFF.md"
    if "## Round 174b" not in h.read_text(encoding="utf-8"):
        sys.exit("round175b: round 174b must be applied first")
    with tempfile.NamedTemporaryFile("wb", suffix=".diff", delete=False) as f:
        f.write(base64.b64decode(DIFF))
        path = f.name
    if git("apply", "--check", "-R", path, check=False).returncode == 0:
        print("round175b: already applied")
    else:
        r = git("apply", "--3way", path, check=False)
        if r.returncode != 0:
            git("checkout", "--", "map/app.js", "map/test.mjs", check=False)
            sys.exit("round175b: the diff did not apply:\n" + r.stdout + r.stderr)
        print("round175b: applied")
    text = h.read_text(encoding="utf-8")
    add = "".join(n if n.endswith("\n\n") else n.rstrip("\n") + "\n\n" for n in NOTES if n.split("\n", 1)[0] not in text)
    if add:
        at = text.index("\n## Round ") + 1
        h.write_text(text[:at] + add + text[at:], encoding="utf-8")


if __name__ == "__main__":
    main()
