#!/usr/bin/env python3
"""
Round 156b (culprits), 4 October 2026. Needs round 155b.

Light colours only where the light is wide (no pale spots).

Run from the repository root (the apply-patch workflow does).
"""
import base64, pathlib, subprocess, sys, tempfile

NOTES = ["## Round 156b (4 October)\n\nNeeds round 155b. No tiles patch. No app.js?v= bump.\n\n- Owner: the light colours (#B38C53 ochre-tan, #DCC08A warm sand, #A2A253\n  golden green, #D6C67E pale golden light) were used in a way that made the\n  close zooms look spotted. They came from single bright pixels in the\n  picture. Now each pixel may be only a little lighter than the ground round\n  it (WOOD.lift 0.1 over a 10 px blur, WOOD.lightReach, widened when the\n  picture is enlarged), so the light colours fall only in wide light areas,\n  as broad washes. Colours unchanged.\n"]


def git(*a, check=True):
    return subprocess.run(["git", *a], capture_output=True, text=True, check=check)


def main():
    root = pathlib.Path(".")
    if not (root / "map" / "app.js").exists():
        sys.exit("round156b: run from the culprits repository root")
    h = root / "HANDOFF.md"
    if "## Round 155b" not in h.read_text(encoding="utf-8"):
        sys.exit("round156b: round 155b must be applied first")
    with tempfile.NamedTemporaryFile("wb", suffix=".diff", delete=False) as f:
        f.write(base64.b64decode(DIFF))
        path = f.name
    if git("apply", "--check", "-R", "--binary", path, check=False).returncode == 0:
        print("round156b: already applied")
    else:
        r = git("apply", "--3way", "--binary", path, check=False)
        if r.returncode != 0:
            git("checkout", "--", "map/app.js", "map/test.mjs", check=False)
            sys.exit("round156b: the diff did not apply:\n" + r.stdout + r.stderr)
        print("round156b: applied")
    text = h.read_text(encoding="utf-8")
    add = "".join(n if n.endswith("\n\n") else n.rstrip("\n") + "\n\n" for n in NOTES if n.split("\n", 1)[0] not in text)
    if add:
        at = text.index("\n## Round ") + 1
        h.write_text(text[:at] + add + text[at:], encoding="utf-8")


DIFF = 'ZGlmZiAtLWdpdCBhL21hcC9hcHAuanMgYi9tYXAvYXBwLmpzCmluZGV4IDZiYWY1MjAuLjhlMjQ4ZjYgMTAwNjQ0Ci0tLSBhL21hcC9hcHAuanMKKysrIGIvbWFwL2FwcC5qcwpAQCAtMTM5NTMsNiArMTM5NTMsOCBAQCB2YXIgV09PRCA9IHsKICAgICB7IHNwOiA0LCBsZW46IFs0LCA3XSwgdzogWzEuNiwgMi42XSwgYTogWzAuNSwgMC44NV0sIGRldGFpbDogNSwgb2Z0ZW46IDAuMDggfSwKICAgXSwKICAgbWFyZ2luOiAzMiwKKyAgbGlnaHRSZWFjaDogMTAsICAgLy8gcm91bmQgMTU2YjogaG93IHdpZGUgKHB4KSB0aGUgbGlnaHQgbXVzdCBiZSB0byByZWFjaCB0aGUgbGlnaHQgY29sb3VycworICBsaWZ0OiAwLjEsICAgICAgICAvLyBob3cgbXVjaCBsaWdodGVyIHRoYW4gaXRzIHN1cnJvdW5kaW5ncyBvbmUgcGl4ZWwgbWF5IGJlCiB9OwogdmFyIFdPT0RfSURTID0gWyJvdXRsaW5lLXdvb2Qtc2hlZXQiLCAib3V0bGluZS13b29kLXBhaW50IiwgIm91dGxpbmUtd29vZC1zZWEiLCAib3V0bGluZS13b29kLXNoYWRlIiwKICAgIm91dGxpbmUtd29vZC1taXN0IiwgIm91dGxpbmUtd29vZC1sYWtlIiwgIm91dGxpbmUtd29vZC10b3duIiwgIm91dGxpbmUtd29vZC1yaXZlciIsCkBAIC0xNDAxMiw3ICsxNDAxNCwxNSBAQCBmdW5jdGlvbiB3b29kUGFpbnRQaXhlbHMoZGF0YSwgdywgaCwgZ3gwLCBneTAsIHNvZnQpIHsKICAgICAgIFRbcF0gPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCAwLjUgKyAodCAtIDAuNSkgKiAxLjE1KSk7CiAgICAgfQogICB9Ci0gIGNvbnN0IFZzID0gYmx1cihWLCAzICogc29mdCksIFRzID0gYmx1cihULCBzb2Z0IC0gMC41KTsKKyAgY29uc3QgVnMgPSBibHVyKFYsIDMgKiBzb2Z0KSwgVHAgPSBibHVyKFQsIHNvZnQgLSAwLjUpOworICAvLyBSb3VuZCAxNTZiOiB0aGUgbGlnaHQgY29sb3VycyAob2NocmUtdGFuLCB3YXJtIHNhbmQsIGdvbGRlbiBncmVlbiwgcGFsZQorICAvLyBnb2xkZW4gbGlnaHQpIGFyZSByZWFjaGVkIG9ubHkgd2hlcmUgdGhlIGdyb3VuZCByb3VuZCBhYm91dCBpcyBsaWdodCB0b28uCisgIC8vIEEgcGl4ZWwgbWF5IGJlIG9ubHkgYSBsaXR0bGUgbGlnaHRlciB0aGFuIGl0cyBzdXJyb3VuZGluZ3MgKFdPT0QubGlmdCksCisgIC8vIHNvIHNpbmdsZSBicmlnaHQgcGl4ZWxzIChnYXBzIGJldHdlZW4gdHJlZXMsIHJvb2ZzLCBhIGJhcmUgcGF0Y2gpIHN0YXkgaW4KKyAgLy8gdGhlIG1pZGRsZSB0b25lcyBpbnN0ZWFkIG9mIHN0YW5kaW5nIG91dCBhcyBwYWxlIHNwb3RzOyB3aWRlIGZpZWxkcywKKyAgLy8gY2xlYXJpbmdzIGFuZCBkcnkgbGFuZCBzdGlsbCB0YWtlIHRoZSBsaWdodCBjb2xvdXJzLCBhcyBicm9hZCB3YXNoZXMuCisgIGNvbnN0IFR3ID0gYmx1cihULCBXT09ELmxpZ2h0UmVhY2ggKiBzb2Z0KSwgVHMgPSBuZXcgRmxvYXQzMkFycmF5KG4pOworICBmb3IgKGxldCBwID0gMDsgcCA8IG47IHArKykgVHNbcF0gPSBNYXRoLm1pbihUcFtwXSwgVHdbcF0gKyBXT09ELmxpZnQpOwogICBjb25zdCBSID0gbmV3IEZsb2F0MzJBcnJheShuKSwgRyA9IG5ldyBGbG9hdDMyQXJyYXkobiksIEIgPSBuZXcgRmxvYXQzMkFycmF5KG4pOwogICBmb3IgKGxldCBwID0gMDsgcCA8IG47IHArKykgewogICAgIGxldCBjOwpkaWZmIC0tZ2l0IGEvbWFwL3Rlc3QubWpzIGIvbWFwL3Rlc3QubWpzCmluZGV4IGM1YmY4ZjEuLjg3NTdiYTIgMTAwNjQ0Ci0tLSBhL21hcC90ZXN0Lm1qcworKysgYi9tYXAvdGVzdC5tanMKQEAgLTY0OTQsNiArNjQ5NCwyMSBAQCBjb25zb2xlLmxvZygiXG5yb3VuZCAxNTViICg0IE9jdG9iZXIpOiBXb29kbGFuZHMgaW4gdmlzaWJsZSBicnVzaHN0cm9rZXMgYXQgZXZlcgogICBjaGVjaygibm8gZmxhdCBzZWEgZmlsbCBvdmVyIHRoZSBzdHJva2VzOyB0aGUgc2VhJ3MgZGVwdGhzIG9ubHkgdGludCB0aGVtIiwgIS9vdXRsaW5lLXdvb2QtY29hc3QvLnRlc3QoYmxvY2spICYmIC9zZWFPcGFjaXR5OiAwXC4zNS8udGVzdChibG9jaykpOwogfQogCitjb25zb2xlLmxvZygiXG5yb3VuZCAxNTZiICg0IE9jdG9iZXIpOiBsaWdodCBjb2xvdXJzIG9ubHkgd2hlcmUgdGhlIGxpZ2h0IGlzIHdpZGUiKTsKK3sKKyAgY29uc3Qgc3JjID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihIRVJFLCAiYXBwLmpzIiksICJ1dGY4Iik7CisgIGNvbnN0IGJsb2NrID0gc3JjLnNsaWNlKHNyYy5pbmRleE9mKCIvKiAtLS0tLS0tLS0tIEF1dHVtbiB3b29kbGFuZHMsIGEgc2l4dGggYmFzZW1hcCIpLCBzcmMuaW5kZXhPZigiLyogLS0tLS0tLS0tLSBlbmQgb2YgQXV0dW1uIHdvb2RsYW5kcyAtLS0tLS0tLS0tICovIikpOworICBjb25zdCBsaWIgPSBuZXcgRnVuY3Rpb24oYmxvY2suc2xpY2UoYmxvY2suaW5kZXhPZigidmFyIFdPT0QgPSB7IiksIGJsb2NrLmluZGV4T2YoIi8vIFRoZSBwYWludGluZ3MgYXJlIG1hZGUgb2ZmIHRoZSBwYWdlJ3MgbWFpbiB0aHJlYWQiKSkgKyAiOyByZXR1cm4geyB3b29kUGFpbnRQaXhlbHMgfTsiKSgpOworICBjb25zdCB0aWxlID0gKGYpID0+IHsgY29uc3QgZCA9IG5ldyBVaW50OENsYW1wZWRBcnJheSg2NCAqIDY0ICogNCk7IGZvciAobGV0IHkgPSAwOyB5IDwgNjQ7IHkrKykgZm9yIChsZXQgeCA9IDA7IHggPCA2NDsgeCsrKSB7IGNvbnN0IGMgPSBmKHgsIHkpLCBxID0gKHkgKiA2NCArIHgpICogNDsgZFtxXSA9IGNbMF07IGRbcSArIDFdID0gY1sxXTsgZFtxICsgMl0gPSBjWzJdOyBkW3EgKyAzXSA9IDI1NTsgfSByZXR1cm4gZDsgfTsKKyAgY29uc3QgTCA9IChkLCB4LCB5KSA9PiB7IGNvbnN0IHEgPSAoeSAqIDY0ICsgeCkgKiA0OyByZXR1cm4gMC4zICogZFtxXSArIDAuNTkgKiBkW3EgKyAxXSArIDAuMTEgKiBkW3EgKyAyXTsgfTsKKyAgLy8gQSBmb3Jlc3Qgd2l0aCBzaW5nbGUgYnJpZ2h0IHBpeGVscyBpbiBpdCwgYW5kIGEgd2lkZSBicmlnaHQgZmllbGQuCisgIGNvbnN0IGRvdHMgPSBsaWIud29vZFBhaW50UGl4ZWxzKHRpbGUoKHgsIHkpID0+ICh4ICUgOSA9PT0gNCAmJiB5ICUgOSA9PT0gNCkgPyBbMjEwLCAyMDAsIDE2MF0gOiBbMzQsIDYyLCAzMF0pLCA2NCwgNjQpOworICBjb25zdCBmaWVsZCA9IGxpYi53b29kUGFpbnRQaXhlbHModGlsZSgoKSA9PiBbMjEwLCAyMDAsIDE2MF0pLCA2NCwgNjQpOworICBjb25zdCBzcG90ID0gTChkb3RzLCAzMSwgMzEpLCByb3VuZCA9IEwoZG90cywgMjcsIDI3KSwgd2lkZSA9IEwoZmllbGQsIDMyLCAzMik7CisgIGNoZWNrKCJhIHNpbmdsZSBicmlnaHQgcGl4ZWwgaW4gYSBmb3Jlc3QgaXMgbm8gcGFsZSBzcG90IChjbG9zZSB0byBpdHMgc3Vycm91bmRpbmdzKSIsIHNwb3QgLSByb3VuZCA8IDI1LCBzcG90LnRvRml4ZWQoMCkgKyAiIC8gIiArIHJvdW5kLnRvRml4ZWQoMCkpOworICBjaGVjaygiYSB3aWRlIGxpZ2h0IGZpZWxkIHN0aWxsIHRha2VzIHRoZSBsaWdodCBjb2xvdXJzIiwgd2lkZSA+IDE3MCwgd2lkZS50b0ZpeGVkKDApKTsKK30KKwogY29uc29sZS5sb2coIlxucm91bmQgMTEwYyAoMjkgU2VwdGVtYmVyKTogcGxhbnRlZCwgYm91Z2h0IG9yIGNhcHR1cmVkLCB3b3JsZHdpZGUiKTsKIHsKICAgY29uc3Qgc3JjID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihIRVJFLCAiYXBwLmpzIiksICJ1dGY4Iik7Cg=='

if __name__ == "__main__":
    main()
