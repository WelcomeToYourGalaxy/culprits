#!/usr/bin/env python3
"""
Round 145h (culprits), 3 October 2026. Needs round 144h.

Hell: no grey on high ground.

Run from the repository root (the apply-patch workflow does).
"""
import base64, pathlib, subprocess, sys, tempfile

NOTES = ['## Round 145h (3 October)\n\nNeeds round 144h. No tiles patch. No app.js?v= bump. Hell basemap only.\n\n- Hell\'s land no longer fades to grey on high ground (asked 3 October: it did\n  not fit). HELL.ground above sea level now darkens from basalt black into\n  scorched oxblood (#131215 to #3B171E); a test checks every step is red-led.\n- Found while checking "place names show API key required": CARTO now stamps\n  "API KEY REQUIRED" on its raster tiles when no key is sent (carto.com/\n  basemaps/apikey). This hits the place names on every basemap (app.js\n  "labels" source, voyager_only_labels) and the hologram\'s names\n  (index.html, dark_only_labels). The key is free; waiting on the owner to\n  request one, then append ?key= to both tile addresses.\n']


def git(*a, check=True):
    return subprocess.run(["git", *a], capture_output=True, text=True, check=check)


def main():
    root = pathlib.Path(".")
    if not (root / "map" / "app.js").exists():
        sys.exit("round145h: run from the culprits repository root")
    h = root / "HANDOFF.md"
    if "## Round 144h" not in h.read_text(encoding="utf-8"):
        sys.exit("round145h: round 144h must be applied first")
    with tempfile.NamedTemporaryFile("wb", suffix=".diff", delete=False) as f:
        f.write(base64.b64decode(DIFF))
        path = f.name
    if git("apply", "--check", "-R", "--binary", path, check=False).returncode == 0:
        print("round145h: already applied")
    else:
        r = git("apply", "--3way", "--binary", path, check=False)
        if r.returncode != 0:
            git("checkout", "--", "map/app.js", "map/test.mjs", check=False)
            sys.exit("round145h: the diff did not apply:\n" + r.stdout + r.stderr)
        print("round145h: applied")
    text = h.read_text(encoding="utf-8")
    add = "".join(n if n.endswith("\n\n") else n.rstrip("\n") + "\n\n" for n in NOTES if n.split("\n", 1)[0] not in text)
    if add:
        at = text.index("\n## Round ") + 1
        h.write_text(text[:at] + add + text[at:], encoding="utf-8")


DIFF = 'ZGlmZiAtLWdpdCBhL21hcC9hcHAuanMgYi9tYXAvYXBwLmpzCmluZGV4IGFkMGZkNjAuLjA4NzBiZTAgMTAwNjQ0Ci0tLSBhL21hcC9hcHAuanMKKysrIGIvbWFwL2FwcC5qcwpAQCAtMTM2OTMsOCArMTM2OTMsOCBAQCBmdW5jdGlvbiBidWlsZEJhc2VtYXBQYW5lbCgpIHsKIC8vIHNhbWUgb3BlbiBkYXRhLCBkcmF3biBpbiBvdGhlciBjb2xvdXJzOgogLy8gICBzZWEgICAgICBveGJsb29kLCBkYXJrZXIgaW4gdGhlIGRlZXBzIGFuZCBsaWdodGVyIG92ZXIgdGhlIHNoZWx2ZXMsIHNvCiAvLyAgICAgICAgICAgIGV2ZXJ5IGNvYXN0IGlzIHJpbW1lZCBpbiByZWQgKEFXUyB0ZXJyYWluIHRpbGVzLCB3aGljaCBjYXJyeSBkZXB0aHMpCi0vLyAgIGxhbmQgICAgIGJhc2FsdCBibGFjaywgYXNoIGdyZXkgdXAgdGhlIHNsb3BlcywgcGFsZSBhc2ggb24gdGhlIGhpZ2hlc3QKLS8vICAgICAgICAgICAgZ3JvdW5kIGFuZCB0aGUgaWNlICh0aGUgc2FtZSB0aWxlcykKKy8vICAgbGFuZCAgICAgYmFzYWx0IGJsYWNrLCBkYXJrZW5pbmcgaW50byBzY29yY2hlZCBveGJsb29kIHVwIHRoZSBzbG9wZXMKKy8vICAgICAgICAgICAgKHRoZSBzYW1lIHRpbGVzOyBubyBncmV5IG9uIGhpZ2ggZ3JvdW5kIHNpbmNlIHJvdW5kIDE0NWgpCiAvLyAgIHJlbGllZiAgIGNvbGQgYmx1ZS1ncmV5IGxpZ2h0IGZyb20gZm91ciBkaXJlY3Rpb25zIG92ZXIgYmxhY2sgc2hhZG93CiAvLyAgICAgICAgICAgIChNYXB0ZXJob3JuIGhlaWdodHMsIGFzIHRoZSBvdGhlciBiYXNlbWFwcykKIC8vICAgd2F0ZXIgICAgbGFrZXMgYXMgZGFyayBibG9vZCwgcml2ZXJzIGFzIHRoaW4gcmVkIHZlaW5zIHdpdGggYSBmYWludApAQCAtMTM3MTIsOCArMTM3MTIsMTEgQEAgdmFyIEhFTEwgPSB7CiAgIGdyb3VuZDogWyJpbnRlcnBvbGF0ZSIsIFsibGluZWFyIl0sIFsiZWxldmF0aW9uIl0sCiAgICAgLTgwMDAsICIjMTEwNDA3IiwgLTUwMDAsICIjMTgwNjBBIiwgLTMwMDAsICIjMjAwNzBDIiwgLTE1MDAsICIjMkEwQTBGIiwgLTUwMCwgIiMzNjBDMTEiLAogICAgIC0xMjAsICIjNDgxMTE2IiwgLTIwLCAiIzU3MTUxQSIsIC0xLCAiIzVGMTgxRCIsCi0gICAgMCwgIiMxMzEyMTUiLCAyMDAsICIjMTYxNTE5IiwgNjAwLCAiIzFCMUExRiIsIDEyMDAsICIjMjMyMjI4IiwgMjAwMCwgIiMyRDJDMzMiLAotICAgIDMwMDAsICIjM0EzOTQxIiwgNDIwMCwgIiM0RjRFNTciLCA1NjAwLCAiIzY3NjY2RiJdLAorICAgIC8vIFJvdW5kIDE0NWggKGFza2VkIDMgT2N0b2JlcjogdGhlIGdyZXkgb24gaGlnaCBncm91bmQgZGlkIG5vdCBmaXQpOgorICAgIC8vIHRoZSBsYW5kIGRhcmtlbnMgZnJvbSBiYXNhbHQgYmxhY2sgaW50byBzY29yY2hlZCBveGJsb29kIGFzIGl0IHJpc2VzLAorICAgIC8vIHdpdGggbm8gZ3JleSBvciBhc2ggYXQgdGhlIHRvcC4KKyAgICAwLCAiIzEzMTIxNSIsIDIwMCwgIiMxNTEyMTUiLCA2MDAsICIjMUExMjE0IiwgMTIwMCwgIiMxRjE0MTYiLCAyMDAwLCAiIzI0MTQxOCIsCisgICAgMzAwMCwgIiMyQjE1MUEiLCA0MjAwLCAiIzMzMTYxQyIsIDU2MDAsICIjM0IxNzFFIl0sCiAgIHNoYWRlOiB7CiAgICAgImhpbGxzaGFkZS1tZXRob2QiOiAibXVsdGlkaXJlY3Rpb25hbCIsCiAgICAgImhpbGxzaGFkZS1pbGx1bWluYXRpb24tZGlyZWN0aW9uIjogWzMxNSwgMjcwLCAwLCAyMjVdLApkaWZmIC0tZ2l0IGEvbWFwL3Rlc3QubWpzIGIvbWFwL3Rlc3QubWpzCmluZGV4IDZjYjZiZjEuLmFmZjE0NTQgMTAwNjQ0Ci0tLSBhL21hcC90ZXN0Lm1qcworKysgYi9tYXAvdGVzdC5tanMKQEAgLTYxNjUsNiArNjE2NSwxNSBAQCBjb25zb2xlLmxvZygiXG5yb3VuZCAxNDRoICgzIE9jdG9iZXIpOiBIZWxsLCBhIGZvdXJ0aCBiYXNlbWFwIik7CiAgIGNoZWNrKCJub3RoaW5nIGJyaWdodDogbm8gc29saWQgY29sb3VyIGFib3ZlIDcwJSBsaWdodG5lc3MgKHRoZSBmYWludCBzZWUtdGhyb3VnaCBsaWdodHMgYXNpZGUpIiwgaHVlcy5ldmVyeSgoeCkgPT4geC52IDw9IDAuNyB8fCB4LmEgPCAwLjM1KSwgaHVlcy5maWx0ZXIoKHgpID0+IHgudiA+IDAuNyAmJiB4LmEgPj0gMC4zNSkubWFwKCh4KSA9PiB4LmMpLmpvaW4oIiAiKSk7CiB9CiAKK2NvbnNvbGUubG9nKCJcbnJvdW5kIDE0NWggKDMgT2N0b2Jlcik6IG5vIGdyZXkgb24gSGVsbCdzIGhpZ2ggZ3JvdW5kIik7Cit7CisgIGNvbnN0IHNyYyA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oSEVSRSwgImFwcC5qcyIpLCAidXRmOCIpOworICBjb25zdCBnID0gc3JjLnNsaWNlKHNyYy5pbmRleE9mKCJ2YXIgSEVMTCA9IHsiKSwgc3JjLmluZGV4T2YoIiAgc2hhZGU6IHsiLCBzcmMuaW5kZXhPZigidmFyIEhFTEwgPSB7IikpKTsKKyAgY29uc3QgbGFuZCA9IFsuLi5nLm1hdGNoQWxsKC8oXGQrKSwgIiMoWzAtOUEtRl17Nn0pIi9nKV0uZmlsdGVyKChtKSA9PiArbVsxXSA+PSAwICYmICFnLnNsaWNlKG0uaW5kZXggLSAxLCBtLmluZGV4KS5pbmNsdWRlcygiLSIpKS5tYXAoKG0pID0+IFswLCAyLCA0XS5tYXAoKGkpID0+IHBhcnNlSW50KG1bMl0uc2xpY2UoaSwgaSArIDIpLCAxNikpKTsKKyAgY2hlY2soInRoZSBsYW5kIGRhcmtlbnMgaW50byBveGJsb29kIGFzIGl0IHJpc2VzOiByZWQgbGVhZHMgZXZlcnkgc3RlcCBhYm92ZSBzZWEgbGV2ZWwsIG5vbmUgZ3JleSIsIGxhbmQubGVuZ3RoID09PSA4ICYmCisgICAgICAgIGxhbmQuc2xpY2UoMSkuZXZlcnkoKFtyLCBnZywgYl0pID0+IHIgPiBnZyArIDIgJiYgciA+PSBiKSAmJiBsYW5kLmV2ZXJ5KChbcl0pID0+IHIgPCA3MCkpOworfQorCiBjb25zb2xlLmxvZygiXG5yb3VuZCAxNDNiICgyIE9jdG9iZXIpOiBsYXllcnMgZ3JvdXBlZCwgc28gYWxpa2UgbGF5ZXJzIGRvIG5vdCBjcm9zcyBlYWNoIG90aGVyIik7CiB7CiAgIGNvbnN0IHNyYyA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oSEVSRSwgImFwcC5qcyIpLCAidXRmOCIpOwo='

if __name__ == "__main__":
    main()
