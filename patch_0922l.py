#!/usr/bin/env python3
"""
patch_0922l.py - the harvest writes any value plainly instead of dying on a set (the 22 September run).

Run from the repo folder:  python3 patch_0922l.py
"""
import base64, pathlib, subprocess, sys

DIFF = base64.b64decode("""
ZGlmZiAtLWdpdCBhL21hcC90ZXN0Lm1qcyBiL21hcC90ZXN0Lm1qcwppbmRleCA4OTEwOGQ2Li4zZTAzYmQ3IDEwMDY0NAotLS0g
YS9tYXAvdGVzdC5tanMKKysrIGIvbWFwL3Rlc3QubWpzCkBAIC0yNzUxLDYgKzI3NTEsOCBAQCBjb25zb2xlLmxvZygiXG5OdXNh
bnRhcmEncyBsYXllcnMgc2F5IHdoYXQgdGhleSBzaG93Iik7CiAgICAgICAgICAgICAvcmVhZFBpZWNlXChgZGF0YVwvcGllY2Vz
XC9cJFx7cFwuc291cmNlXH1gLCBwXC5pZFwpLy50ZXN0KHNyYykgJiYgL0V2ZXJ5IGZpZWxkIHRoZSBzb3VyY2UgcHVibGlzaGVz
Ly50ZXN0KHNyYykgJiYKICAgICAgICAgICAgIC9oID0gXChcKGggXF4gYlwpIFwqIDB4MDEwMDAxOTNcKSAmIDB4RkZGRkZGRkYv
LnRlc3Qobm9ybSkpOwogICAgICAgY29uc3QgZmllbGRSb3dzID0gbmV3IEZ1bmN0aW9uKCJlc2NhcGVIdG1sIiwgc3JjLm1hdGNo
KC9mdW5jdGlvbiBmaWVsZFJvd3NbXHNcU10qP1xufVxuLylbMF0gKyAiOyByZXR1cm4gZmllbGRSb3dzOyIpKCh4KSA9PiBTdHJp
bmcoeCkpOworICAgICAgY2hlY2soIlx1MjAyNmFuZCBhIHZhbHVlIEpTT04gY2Fubm90IHdyaXRlIChhIHNldCwgYSBkYXRlKSBp
cyB3cml0dGVuIHBsYWlubHkgcmF0aGVyIHRoYW4gc3RvcHBpbmcgdGhlIGhhcnZlc3QiLAorICAgICAgICAgICAgL2pzb25cLmR1
bXBzXChyb3csIHNlcGFyYXRvcnM9XCgiLCIsICI6IlwpLCBkZWZhdWx0PV9wbGFpblwpLy50ZXN0KGZzLnJlYWRGaWxlU3luYyhw
YXRoLmpvaW4oSEVSRSwgIi4uIiwgInBpcGVsaW5lIiwgImhhcnZlc3QucHkiKSwgInV0ZjgiKSkpOwogICAgICAgY2hlY2soIlx1
MjAyNmEgbmVzdGVkIHZhbHVlIGluIGEgY29waWVkIGZpbGUncyByZWNvcmQgaXMgd3JpdHRlbiBvdXQsIG5vdCBkcm9wcGVkIiwK
ICAgICAgICAgICAgIC9Ob3RlczxcL3RoPjx0ZD5cWyJhIiwiYiJcXS8udGVzdChmaWVsZFJvd3MoeyBOb3RlczogWyJhIiwgImIi
XSwgRW1wdHk6IFtdIH0pKSAmJiAhL0VtcHR5Ly50ZXN0KGZpZWxkUm93cyh7IE5vdGVzOiBbImEiXSwgRW1wdHk6IFtdIH0pKSk7
CiAgICAgfQpkaWZmIC0tZ2l0IGEvcGlwZWxpbmUvaGFydmVzdC5weSBiL3BpcGVsaW5lL2hhcnZlc3QucHkKaW5kZXggZDllZmU1
NC4uN2QxNjM1ZCAxMDA2NDQKLS0tIGEvcGlwZWxpbmUvaGFydmVzdC5weQorKysgYi9waXBlbGluZS9oYXJ2ZXN0LnB5CkBAIC0z
Niw2ICszNiwxNSBAQCBkZWYgbG9hZF9zdGF0ZShwYXRoKToKICAgICByZXR1cm4ganNvbi5sb2FkcyhwLnJlYWRfdGV4dCgpKSBp
ZiBwLmV4aXN0cygpIGVsc2Uge30KIAogCitkZWYgX3BsYWluKHZhbHVlKToKKyAgICAiIiJXaGF0IGpzb24uZHVtcHMgY2Fubm90
IHdyaXRlIG9uIGl0cyBvd24sIHdyaXR0ZW4gcGxhaW5seS4iIiIKKyAgICBpZiBpc2luc3RhbmNlKHZhbHVlLCAoc2V0LCBmcm96
ZW5zZXQpKToKKyAgICAgICAgcmV0dXJuIHNvcnRlZCh2YWx1ZSwga2V5PXN0cikKKyAgICBpZiBpc2luc3RhbmNlKHZhbHVlLCBi
eXRlcyk6CisgICAgICAgIHJldHVybiB2YWx1ZS5kZWNvZGUoInV0Zi04IiwgInJlcGxhY2UiKQorICAgIHJldHVybiBzdHIodmFs
dWUpCisKKwogZGVmIHNhdmVfc3RhdGUocGF0aCwgc3RhdGUpOgogICAgIHBhdGhsaWIuUGF0aChwYXRoKS53cml0ZV90ZXh0KGpz
b24uZHVtcHMoc3RhdGUsIGluZGVudD0xLCBzb3J0X2tleXM9VHJ1ZSkpCiAKQEAgLTExOCw3ICsxMjcsMTIgQEAgZGVmIGhhcnZl
c3Rfb25lKG1ldGEpOgogICAgIGNvdW50ID0gMAogICAgIHdpdGggZ3ppcC5vcGVuKG91dCwgInd0IiwgZW5jb2Rpbmc9InV0Zi04
IikgYXMgZmg6CiAgICAgICAgIGZvciByb3cgaW4gcm93czoKLSAgICAgICAgICAgIGZoLndyaXRlKGpzb24uZHVtcHMocm93LCBz
ZXBhcmF0b3JzPSgiLCIsICI6IikpICsgIlxuIikKKyAgICAgICAgICAgICMgQSBoYXJ2ZXN0ZXIncyByb3cgbWF5IGNhcnJ5IGEg
dmFsdWUgSlNPTiBoYXMgbm8gZm9ybSBmb3IgLSBhIHNldCwgYQorICAgICAgICAgICAgIyBkYXRlLCBhIERlY2ltYWwgLSBub3cg
dGhhdCB0aGUgd2hvbGUgc291cmNlIHJvdyB0cmF2ZWxzIGFzICJyYXciLgorICAgICAgICAgICAgIyBUaGUgQ2xpbWF0ZSBUUkFD
RSBydW4gb2YgMjIgU2VwdGVtYmVyIGRpZWQgb24gb25lIHN1Y2ggc2V0IGluIHRoZQorICAgICAgICAgICAgIyB3YXN0ZSBzZWN0
b3IgYWZ0ZXIgZm91ciBob3VycyBvZiBwYXJzaW5nLiBTZXRzIGJlY29tZSBzb3J0ZWQKKyAgICAgICAgICAgICMgbGlzdHM7IGFu
eXRoaW5nIGVsc2UgYmVjb21lcyBpdHMgdGV4dC4gTm90aGluZyBpcyBsZWZ0IG91dC4KKyAgICAgICAgICAgIGZoLndyaXRlKGpz
b24uZHVtcHMocm93LCBzZXBhcmF0b3JzPSgiLCIsICI6IiksIGRlZmF1bHQ9X3BsYWluKSArICJcbiIpCiAgICAgICAgICAgICBj
b3VudCArPSAxCiAgICAgaWYgbm90IGNvdW50OgogICAgICAgICBvdXQudW5saW5rKG1pc3Npbmdfb2s9VHJ1ZSkK
""").decode("utf-8")


def run(cmd, text=None):
    return subprocess.run(cmd, input=text, text=True, capture_output=True)


def main():
    if not pathlib.Path("map/app.js").exists():
        sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits).")
    app = pathlib.Path("map/app.js").read_text(encoding="utf-8")
    if "const GLOW = {" not in app:
        sys.exit("patch_0922g.py has to be applied and committed first.")
    if run(["git", "apply", "--check", "--reverse", "-"], DIFF).returncode == 0:
        print("Already applied - nothing to do.")
        return
    check = run(["git", "apply", "--check", "-"], DIFF)
    if check.returncode != 0:
        print(check.stderr.strip())
        sys.exit("Does not apply cleanly.")
    out = run(["git", "apply", "-"], DIFF)
    if out.returncode != 0:
        print(out.stderr.strip())
        sys.exit("git apply failed.")
    print("Applied. Changed: pipeline/harvest.py, map/test.mjs")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
