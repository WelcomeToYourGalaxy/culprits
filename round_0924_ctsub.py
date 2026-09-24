#!/usr/bin/env python3
"""Round 32 (24 September): Climate TRACE harvest by subsector. Run from the repo folder. Safe to run twice."""
import base64, subprocess, sys, os, tempfile
DIFF = base64.b64decode("ZGlmZiAtLWdpdCBhL3BpcGVsaW5lL3NvdXJjZXMvY2xpbWF0ZV90cmFjZS5weSBiL3BpcGVsaW5lL3NvdXJjZXMvY2xpbWF0ZV90cmFjZS5weQppbmRleCAyYjgwNTZiLi41NWQ5OTA5IDEwMDY0NAotLS0gYS9waXBlbGluZS9zb3VyY2VzL2NsaW1hdGVfdHJhY2UucHkKKysrIGIvcGlwZWxpbmUvc291cmNlcy9jbGltYXRlX3RyYWNlLnB5CkBAIC0xMTIsNiArMTEyLDE5IEBAIGlmIG9zLmVudmlyb24uZ2V0KCJDVF9TRUNUT1JTIik6CiAgICAgX29ubHkgPSB7eC5zdHJpcCgpIGZvciB4IGluIG9zLmVudmlyb25bIkNUX1NFQ1RPUlMiXS5zcGxpdCgiLCIpIGlmIHguc3RyaXAoKX0KICAgICBTRUNUT1JTID0gW3ggZm9yIHggaW4gU0VDVE9SUyBpZiB4IGluIF9vbmx5XQogCisjIENUX1NVQlNFQ1RPUlMgbmFycm93cyBpdCBmdXJ0aGVyLCB0byBuYW1lZCBzdWJzZWN0b3JzICgyNCBTZXB0ZW1iZXIsIHJvdW5kCisjIDMyKTogb25lIHNlY3RvciBvZiBvbmUgZ2FzIHN0aWxsIHJhbiBwYXN0IHRoZSBqb2IncyB0aW1lIGxpbWl0IChjYXJib24KKyMgZGlveGlkZSBmcm9tIGFncmljdWx0dXJlIGlzIDU5LjkgbWlsbGlvbiByb3dzIGluIG5pbmUgc3Vic2VjdG9ycykuIENvbXBhcmVkCisjIHdpdGggZWFjaCByb3cncyBvd24gc3Vic2VjdG9yLCBsZXR0ZXJzIGFuZCBkaWdpdHMgb25seSwgc28gImNyb3BsYW5kLWZpcmVzIgorIyBhbmQgImNyb3BsYW5kX2ZpcmVzIiBhcmUgdGhlIHNhbWUuIEVhY2ggQ1NWIGluIGEgcGFja2FnZSBob2xkcyBvbmUgc3Vic2VjdG9yLAorIyBzbyBhIENTViB3aG9zZSBmaXJzdCByb3cgaXMgYW5vdGhlciBzdWJzZWN0b3IgaXMgcGFzc2VkIG92ZXIgd2hvbGUsIHdpdGhvdXQKKyMgcmVhZGluZyB0aGUgcmVzdCBvZiBpdC4gVW5zZXQsIGV2ZXJ5IHN1YnNlY3RvciBpcyBoYXJ2ZXN0ZWQsIGFzIGJlZm9yZS4KK2RlZiBfc2x1Zyh4KToKKyAgICByZXR1cm4gIiIuam9pbihjIGlmIGMuaXNhbG51bSgpIGVsc2UgIl8iIGZvciBjIGluIHN0cih4IG9yICIiKS5sb3dlcigpKQorCisKK09OTFlfU1VCU0VDVE9SUyA9IHtfc2x1Zyh4KSBmb3IgeCBpbiBvcy5lbnZpcm9uLmdldCgiQ1RfU1VCU0VDVE9SUyIsICIiKS5zcGxpdCgiLCIpIGlmIHguc3RyaXAoKX0KKwogIyBOb3RoaW5nIGlzIGN1dC4gRXZlcnkgZW1pc3Npb25zIHNvdXJjZSBDbGltYXRlIFRSQUNFIHB1Ymxpc2hlcyB3aXRoIGEKICMgY29vcmRpbmF0ZSBpcyBoYXJ2ZXN0ZWQsIGFuZCB3aGF0IGEgcmVhZGVyIHNlZXMgaXMgZGVjaWRlZCBpbiB0aGUgbWFwIHBhbmVsCiAjIHJhdGhlciB0aGFuIGhlcmUuCkBAIC0yMDUsNiArMjE4LDE1IEBAIGRlZiBfcm93c19mcm9tX3BhY2thZ2UocGF0aCwgc3RhdHMpOgogICAgICAgICAgICAgICAgICAgICBzdGF0c1sic2tpcHBlZF9maWxlcyJdLmFwcGVuZChuYW1lKQogICAgICAgICAgICAgICAgICAgICBjb250aW51ZQogICAgICAgICAgICAgICAgIHVzZWQgKz0gMQorICAgICAgICAgICAgICAgIGlmIE9OTFlfU1VCU0VDVE9SUzoKKyAgICAgICAgICAgICAgICAgICAgZmlyc3QgPSBuZXh0KHJlYWRlciwgTm9uZSkKKyAgICAgICAgICAgICAgICAgICAgaWYgZmlyc3QgaXMgTm9uZSBvciBfc2x1ZyhmaXJzdC5nZXQoInN1YnNlY3RvciIpKSBub3QgaW4gT05MWV9TVUJTRUNUT1JTOgorICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWUKKyAgICAgICAgICAgICAgICAgICAgeWllbGQgZmlyc3QKKyAgICAgICAgICAgICAgICAgICAgZm9yIHJvdyBpbiByZWFkZXI6CisgICAgICAgICAgICAgICAgICAgICAgICBpZiBfc2x1Zyhyb3cuZ2V0KCJzdWJzZWN0b3IiKSkgaW4gT05MWV9TVUJTRUNUT1JTOgorICAgICAgICAgICAgICAgICAgICAgICAgICAgIHlpZWxkIHJvdworICAgICAgICAgICAgICAgICAgICBjb250aW51ZQogICAgICAgICAgICAgICAgIGZvciByb3cgaW4gcmVhZGVyOgogICAgICAgICAgICAgICAgICAgICB5aWVsZCByb3cKICAgICAgICAgaWYgdXNlZCA9PSAwOgo=")
NOTE = """
## Round 32 (24 September): Climate TRACE by gas, one subsector at a time

The ct_gases run of 24 September (co2, agriculture) timed out at 160 minutes:
harvest 54 min and normalise 40 min for 59.9 million rows, then two of nine
subsectors tiled before the third (cattle operations, 18.8 million) ran out
of time. Nothing was saved, because the pair copied its archives only at the
end. Now:
- pipeline/sources/climate_trace.py takes CT_SUBSECTORS; a CSV whose first
  row is another subsector is passed over whole.
- culprits-tiles-more scripts/ct_gases.py works in (gas, sector, subsector)
  units, the subsectors listed from Climate TRACE's own schema CSV; each unit's
  archives (and any zoom parts with their .build.json) go into tiles/ and the
  list as soon as they are made. Units are recorded under "units" in
  tiles/climate_trace_gases.json.
"""
def git(*a):
    return subprocess.run(["git", *a], capture_output=True, text=True)
if not os.path.exists("pipeline/sources/climate_trace.py"):
    sys.exit("Run this from the right repo folder.")
with tempfile.NamedTemporaryFile("wb", suffix=".diff", delete=False) as f:
    f.write(DIFF); path = f.name
if git("apply", "--check", "-R", path).returncode == 0:
    print("Already applied. Nothing changed.")
else:
    r = git("apply", "--3way", path)
    if r.returncode != 0:
        print(r.stdout + r.stderr)
        git("checkout", "--", "pipeline/sources/climate_trace.py")
        sys.exit("Did not apply; nothing changed. Run git pull --no-edit and try again, or send this message back.")
    print("Code changes applied.")
os.unlink(path)
if NOTE.strip() and os.path.exists("HANDOFF.md"):
    h = open("HANDOFF.md", encoding="utf-8").read()
    if "## Round 32 (24 September)" not in h:
        i = h.index("---") + 3
        open("HANDOFF.md", "w", encoding="utf-8").write(h[:i] + "\n" + NOTE + h[i:])
        print("HANDOFF.md note added.")
    else:
        print("HANDOFF.md note already there.")
