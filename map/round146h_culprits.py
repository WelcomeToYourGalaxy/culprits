#!/usr/bin/env python3
"""
Round 146h (culprits), 3 October 2026. Needs round 145h.

CARTO place names with the map's key.

Run from the repository root (the apply-patch workflow does).
"""
import base64, pathlib, subprocess, sys, tempfile

NOTES = ['## Round 146h (3 October)\n\nNeeds round 145h. No tiles patch. No app.js?v= bump.\n\n- CARTO\'s place names were stamped "API KEY REQUIRED" on every basemap and in\n  the hologram (CARTO now asks for a free key: carto.com/basemaps/apikey). The\n  owner\'s key is added as ?key= to the three CARTO addresses: the "labels"\n  source in map/app.js (voyager_only_labels) and the hologram\'s names in\n  map/index.html and index.html (dark_only_labels). The key is meant to be\n  seen in the page; keys are managed at dashboard.basemaps.carto.com. Not\n  checked from the sandbox (CARTO is blocked there). Browsers and CARTO\'s\n  servers may hold stamped squares for a while: force-refresh.\n']


def git(*a, check=True):
    return subprocess.run(["git", *a], capture_output=True, text=True, check=check)


def main():
    root = pathlib.Path(".")
    if not (root / "map" / "app.js").exists():
        sys.exit("round146h: run from the culprits repository root")
    h = root / "HANDOFF.md"
    if "## Round 145h" not in h.read_text(encoding="utf-8"):
        sys.exit("round146h: round 145h must be applied first")
    with tempfile.NamedTemporaryFile("wb", suffix=".diff", delete=False) as f:
        f.write(base64.b64decode(DIFF))
        path = f.name
    if git("apply", "--check", "-R", "--binary", path, check=False).returncode == 0:
        print("round146h: already applied")
    else:
        r = git("apply", "--3way", "--binary", path, check=False)
        if r.returncode != 0:
            git("checkout", "--", "map/app.js", "map/test.mjs", "map/index.html", "index.html", check=False)
            sys.exit("round146h: the diff did not apply:\n" + r.stdout + r.stderr)
        print("round146h: applied")
    text = h.read_text(encoding="utf-8")
    add = "".join(n if n.endswith("\n\n") else n.rstrip("\n") + "\n\n" for n in NOTES if n.split("\n", 1)[0] not in text)
    if add:
        at = text.index("\n## Round ") + 1
        h.write_text(text[:at] + add + text[at:], encoding="utf-8")


DIFF = 'ZGlmZiAtLWdpdCBhL2luZGV4Lmh0bWwgYi9pbmRleC5odG1sCmluZGV4IGQ4ODcxMDUuLmNkODI2YjUgMTAwNjQ0Ci0tLSBhL2luZGV4Lmh0bWwKKysrIGIvaW5kZXguaHRtbApAQCAtNjkzLDcgKzY5Myw3IEBACiAgICAgLy8gc2V0IChkYXJrIHRleHQpLiBUaGlzIGlzIENBUlRPJ3Mgc2V0IGZvciBkYXJrIG1hcHMsIHNhbWUgcHJvdmlkZXIsIHBhbGUKICAgICAvLyB0ZXh0IHdpdGggYSBkYXJrIGVkZ2UsIHNvIGl0IHJlYWRzIG9uIHRoZSBob2xvZ3JhbS4KICAgICBpZiAoIW1hcC5nZXRTb3VyY2UoImhvbG8tbGFiZWxzIikpIG1hcC5hZGRTb3VyY2UoImhvbG8tbGFiZWxzIiwgeyB0eXBlOiAicmFzdGVyIiwgdGlsZVNpemU6IDI1NiwKLSAgICAgIHRpbGVzOiBbImh0dHBzOi8vYS5iYXNlbWFwcy5jYXJ0b2Nkbi5jb20vcmFzdGVydGlsZXMvZGFya19vbmx5X2xhYmVscy97en0ve3h9L3t5fUAyeC5wbmciXSwKKyAgICAgIHRpbGVzOiBbImh0dHBzOi8vYS5iYXNlbWFwcy5jYXJ0b2Nkbi5jb20vcmFzdGVydGlsZXMvZGFya19vbmx5X2xhYmVscy97en0ve3h9L3t5fUAyeC5wbmc/a2V5PWNiMV80OTRwXzFfZWViYmJmY2I2NWJjNTczZTU0NzgzZDQyIl0sCiAgICAgICBhdHRyaWJ1dGlvbjogIkxhYmVscyDCqSBDQVJUTywgwqkgT3BlblN0cmVldE1hcCIgfSk7CiAgICAgaWYgKCFtYXAuZ2V0U291cmNlKCJvdXRsaW5lLWRlbSIpKSBtYXAuYWRkU291cmNlKCJvdXRsaW5lLWRlbSIsIE9iamVjdC5hc3NpZ24oe30sIFJFTElFRl9TT1VSQ0UpKTsKICAgICBjb25zdCBiZWZvcmUgPSBob2xvQmVmb3JlKCk7CmRpZmYgLS1naXQgYS9tYXAvYXBwLmpzIGIvbWFwL2FwcC5qcwppbmRleCAwODcwYmUwLi5kY2FiNjBhIDEwMDY0NAotLS0gYS9tYXAvYXBwLmpzCisrKyBiL21hcC9hcHAuanMKQEAgLTIxNzAsNyArMjE3MCw3IEBAIGNvbnN0IG1hcCA9IG5ldyBtYXBsaWJyZWdsLk1hcCh7CiAgICAgICBsYWJlbHM6IHsKICAgICAgICAgdHlwZTogInJhc3RlciIsCiAgICAgICAgIHRpbGVzOiBbImh0dHBzOi8vYS5iYXNlbWFwcy5jYXJ0b2Nkbi5jb20vcmFzdGVydGlsZXMvIiArCi0gICAgICAgICAgICAgICAgInZveWFnZXJfb25seV9sYWJlbHMve3p9L3t4fS97eX1AMngucG5nIl0sCisgICAgICAgICAgICAgICAgInZveWFnZXJfb25seV9sYWJlbHMve3p9L3t4fS97eX1AMngucG5nP2tleT1jYjFfNDk0cF8xX2VlYmJiZmNiNjViYzU3M2U1NDc4M2Q0MiJdLAogICAgICAgICB0aWxlU2l6ZTogMjU2LAogICAgICAgICBhdHRyaWJ1dGlvbjogIkxhYmVscyDCqSBDQVJUTywgwqkgT3BlblN0cmVldE1hcCIsCiAgICAgICB9LApkaWZmIC0tZ2l0IGEvbWFwL2luZGV4Lmh0bWwgYi9tYXAvaW5kZXguaHRtbAppbmRleCBhM2E3ZmE1Li41NjAzMzAyIDEwMDY0NAotLS0gYS9tYXAvaW5kZXguaHRtbAorKysgYi9tYXAvaW5kZXguaHRtbApAQCAtNzQwLDcgKzc0MCw3IEBACiAgICAgLy8gc2V0IChkYXJrIHRleHQpLiBUaGlzIGlzIENBUlRPJ3Mgc2V0IGZvciBkYXJrIG1hcHMsIHNhbWUgcHJvdmlkZXIsIHBhbGUKICAgICAvLyB0ZXh0IHdpdGggYSBkYXJrIGVkZ2UsIHNvIGl0IHJlYWRzIG9uIHRoZSBob2xvZ3JhbS4KICAgICBpZiAoIW1hcC5nZXRTb3VyY2UoImhvbG8tbGFiZWxzIikpIG1hcC5hZGRTb3VyY2UoImhvbG8tbGFiZWxzIiwgeyB0eXBlOiAicmFzdGVyIiwgdGlsZVNpemU6IDI1NiwKLSAgICAgIHRpbGVzOiBbImh0dHBzOi8vYS5iYXNlbWFwcy5jYXJ0b2Nkbi5jb20vcmFzdGVydGlsZXMvZGFya19vbmx5X2xhYmVscy97en0ve3h9L3t5fUAyeC5wbmciXSwKKyAgICAgIHRpbGVzOiBbImh0dHBzOi8vYS5iYXNlbWFwcy5jYXJ0b2Nkbi5jb20vcmFzdGVydGlsZXMvZGFya19vbmx5X2xhYmVscy97en0ve3h9L3t5fUAyeC5wbmc/a2V5PWNiMV80OTRwXzFfZWViYmJmY2I2NWJjNTczZTU0NzgzZDQyIl0sCiAgICAgICBhdHRyaWJ1dGlvbjogIkxhYmVscyDCqSBDQVJUTywgwqkgT3BlblN0cmVldE1hcCIgfSk7CiAgICAgaWYgKCFtYXAuZ2V0U291cmNlKCJvdXRsaW5lLWRlbSIpKSBtYXAuYWRkU291cmNlKCJvdXRsaW5lLWRlbSIsIE9iamVjdC5hc3NpZ24oe30sIFJFTElFRl9TT1VSQ0UpKTsKICAgICBjb25zdCBiZWZvcmUgPSBob2xvQmVmb3JlKCk7CmRpZmYgLS1naXQgYS9tYXAvdGVzdC5tanMgYi9tYXAvdGVzdC5tanMKaW5kZXggYWZmMTQ1NC4uNGJiOThlNiAxMDA2NDQKLS0tIGEvbWFwL3Rlc3QubWpzCisrKyBiL21hcC90ZXN0Lm1qcwpAQCAtNjE3NCw2ICs2MTc0LDE3IEBAIGNvbnNvbGUubG9nKCJcbnJvdW5kIDE0NWggKDMgT2N0b2Jlcik6IG5vIGdyZXkgb24gSGVsbCdzIGhpZ2ggZ3JvdW5kIik7CiAgICAgICAgIGxhbmQuc2xpY2UoMSkuZXZlcnkoKFtyLCBnZywgYl0pID0+IHIgPiBnZyArIDIgJiYgciA+PSBiKSAmJiBsYW5kLmV2ZXJ5KChbcl0pID0+IHIgPCA3MCkpOwogfQogCitjb25zb2xlLmxvZygiXG5yb3VuZCAxNDZoICgzIE9jdG9iZXIpOiBDQVJUTydzIHBsYWNlIG5hbWVzIGFza2VkIHdpdGggdGhlIG1hcCdzIGtleSIpOworeworICBjb25zdCBzcmMgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKEhFUkUsICJhcHAuanMiKSwgInV0ZjgiKTsKKyAgY29uc3QgaG9sbyA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oSEVSRSwgImluZGV4Lmh0bWwiKSwgInV0ZjgiKTsKKyAgY29uc3QgdG9wID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihIRVJFLCAiLi4iLCAiaW5kZXguaHRtbCIpLCAidXRmOCIpOworICBjb25zdCBrID0gL2NhcnRvY2RuXC5jb21cL3Jhc3RlcnRpbGVzXC9bXiJdKlw/a2V5PWNiMV9bMC05YS16X10rIi87CisgIGNoZWNrKCJldmVyeSBDQVJUTyBsYWJlbCBhZGRyZXNzIGNhcnJpZXMgdGhlIGtleSAobm8gQVBJIEtFWSBSRVFVSVJFRCBzdGFtcCkiLAorICAgICAgICAvdm95YWdlcl9vbmx5X2xhYmVsc1wvXHt6XH1cL1x7eFx9XC9ce3lcfUAyeFwucG5nXD9rZXk9Y2IxXy8udGVzdChzcmMpICYmIGsudGVzdChob2xvKSAmJiBrLnRlc3QodG9wKSAmJgorICAgICAgICAhW3NyYywgaG9sbywgdG9wXS5zb21lKCh0KSA9PiAvQDJ4XC5wbmciXF0vLnRlc3QodC5zbGljZSh0LmluZGV4T2YoImNhcnRvY2RuIikpKSkpOworfQorCiBjb25zb2xlLmxvZygiXG5yb3VuZCAxNDNiICgyIE9jdG9iZXIpOiBsYXllcnMgZ3JvdXBlZCwgc28gYWxpa2UgbGF5ZXJzIGRvIG5vdCBjcm9zcyBlYWNoIG90aGVyIik7CiB7CiAgIGNvbnN0IHNyYyA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oSEVSRSwgImFwcC5qcyIpLCAidXRmOCIpOwo='

if __name__ == "__main__":
    main()
