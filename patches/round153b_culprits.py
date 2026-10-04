#!/usr/bin/env python3
"""
Round 153b (culprits), 4 October 2026. Needs round 152b.

Stops the Woodlands picture being recoloured blue.

Run from the repository root (the apply-patch workflow does).
"""
import base64, pathlib, subprocess, sys, tempfile

NOTES = ["## Round 153b (4 October)\n\nNeeds round 152b. No tiles patch. No app.js?v= bump. One-line fix.\n\n- The Woodlands basemap showed as pale blue \"snow\": its painted picture\n  source (outline-wood-paint) went through the map-wide layer colour mapping\n  (gladpx), which turned its greens and browns teal-to-cobalt. gladSourceSpec\n  now leaves every \"outline-...\" (basemap) source alone. Layer pictures are\n  still mapped (tested).\n"]


def git(*a, check=True):
    return subprocess.run(["git", *a], capture_output=True, text=True, check=check)


def main():
    root = pathlib.Path(".")
    if not (root / "map" / "app.js").exists():
        sys.exit("round153b: run from the culprits repository root")
    h = root / "HANDOFF.md"
    if "## Round 152b" not in h.read_text(encoding="utf-8"):
        sys.exit("round153b: round 152b must be applied first")
    with tempfile.NamedTemporaryFile("wb", suffix=".diff", delete=False) as f:
        f.write(base64.b64decode(DIFF))
        path = f.name
    if git("apply", "--check", "-R", "--binary", path, check=False).returncode == 0:
        print("round153b: already applied")
    else:
        r = git("apply", "--3way", "--binary", path, check=False)
        if r.returncode != 0:
            git("checkout", "--", "map/app.js", "map/test.mjs", check=False)
            sys.exit("round153b: the diff did not apply:\n" + r.stdout + r.stderr)
        print("round153b: applied")
    text = h.read_text(encoding="utf-8")
    add = "".join(n if n.endswith("\n\n") else n.rstrip("\n") + "\n\n" for n in NOTES if n.split("\n", 1)[0] not in text)
    if add:
        at = text.index("\n## Round ") + 1
        h.write_text(text[:at] + add + text[at:], encoding="utf-8")


DIFF = 'ZGlmZiAtLWdpdCBhL21hcC9hcHAuanMgYi9tYXAvYXBwLmpzCmluZGV4IGZhNWUxMDYuLjQzZDdkOTAgMTAwNjQ0Ci0tLSBhL21hcC9hcHAuanMKKysrIGIvbWFwL2FwcC5qcwpAQCAtOTU1LDcgKzk1NSw5IEBAIGZ1bmN0aW9uIGdsYWRLZXB0KGlkKSB7CiBmdW5jdGlvbiBnbGFkU291cmNlU3BlYyhpZCwgc3BlYykgewogICAvLyBQaWN0dXJlcyB0aGlzIG1hcCBkcmF3cyBpbiBpdHMgb3duIGNvbG91cnMgKHJvdW5kIDgyYjogdGhlIEVQQSBkZW5zaXR5CiAgIC8vIHBpY3R1cmVzLCB0aGUgbml0cm9nZW4gZGlveGlkZSByZWxpZWYpIGFyZSBub3QgbWFwcGVkIGFnYWluLgotICBpZiAoIXNwZWMgfHwgc3BlYy50eXBlICE9PSAicmFzdGVyIiB8fCBHTEFEX1NLSVBfU09VUkNFUy5oYXMoaWQpIHx8IC9eYXRsYXMtcGxhdGUvLnRlc3QoaWQpIHx8IC8tZGVucy1zcmNcZCskLy50ZXN0KGlkKSB8fCBnbGFkS2VwdChpZCkpIHJldHVybiBzcGVjOworICAvLyBCYXNlbWFwcycgb3duIHBpY3R1cmVzICgib3V0bGluZS0uLi4iIHNvdXJjZXMsIHJvdW5kIDE1M2IpIGtlZXAgdGhlaXIKKyAgLy8gY29sb3VyczogbWFwcGVkLCB0aGUgV29vZGxhbmRzJyBncmVlbnMgYW5kIGJyb3ducyBjYW1lIG91dCBwYWxlIGJsdWUuCisgIGlmICghc3BlYyB8fCBzcGVjLnR5cGUgIT09ICJyYXN0ZXIiIHx8IEdMQURfU0tJUF9TT1VSQ0VTLmhhcyhpZCkgfHwgL15vdXRsaW5lLS8udGVzdChpZCkgfHwgL15hdGxhcy1wbGF0ZS8udGVzdChpZCkgfHwgLy1kZW5zLXNyY1xkKyQvLnRlc3QoaWQpIHx8IGdsYWRLZXB0KGlkKSkgcmV0dXJuIHNwZWM7CiAgIC8vIFRoZSByZWxpZWYncyBvd24gc3RlcHBlZCB0aW50cyAocm91bmQgMTA4YikgYXJlIGluIHRoaXMgbWFwJ3MgY29sb3VycyBhbHJlYWR5LgogICBpZiAoQXJyYXkuaXNBcnJheShzcGVjLnRpbGVzKSAmJiBzcGVjLnRpbGVzLmV2ZXJ5KCh0KSA9PiAvXnJlbGllZjpcL1wvLy50ZXN0KHQpKSkgcmV0dXJuIHNwZWM7CiAgIGNvbnN0IHNhbHQgPSBnbGFkUm93T2YoaWQpIHx8IGlkOwpkaWZmIC0tZ2l0IGEvbWFwL3Rlc3QubWpzIGIvbWFwL3Rlc3QubWpzCmluZGV4IGZjYWYwYmIuLjY2YjhhNjQgMTAwNjQ0Ci0tLSBhL21hcC90ZXN0Lm1qcworKysgYi9tYXAvdGVzdC5tanMKQEAgLTYzOTIsNiArNjM5MiwxNiBAQCBjb25zb2xlLmxvZygiXG5yb3VuZCAxNTJiICg0IE9jdG9iZXIpOiBXb29kbGFuZHMgcGFpbnRlZCBmcm9tIHRoZSByZWFsIEVhcnRoIGluCiAgIGNoZWNrKCJ0aGUgc2FtZSBwaWN0dXJlIHBhaW50cyB0aGUgc2FtZSBldmVyeSB0aW1lIiwgYS5ldmVyeSgodiwgaSkgPT4gdiA9PT0gYltpXSkpOwogfQogCitjb25zb2xlLmxvZygiXG5yb3VuZCAxNTNiICg0IE9jdG9iZXIpOiB0aGUgV29vZGxhbmRzIHBpY3R1cmUga2VlcHMgaXRzIG93biBjb2xvdXJzIik7Cit7CisgIGNvbnN0IHNyYyA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oSEVSRSwgImFwcC5qcyIpLCAidXRmOCIpOworICBjb25zdCBmbiA9IHNyYy5zbGljZShzcmMuaW5kZXhPZigiZnVuY3Rpb24gZ2xhZFNvdXJjZVNwZWMoIiksIHNyYy5pbmRleE9mKCJcbn1cbiIsIHNyYy5pbmRleE9mKCJmdW5jdGlvbiBnbGFkU291cmNlU3BlYygiKSkgKyAzKTsKKyAgY29uc3QgZ2xhZFNvdXJjZVNwZWMgPSBuZXcgRnVuY3Rpb24oIkdMQURfU0tJUF9TT1VSQ0VTIiwgImdsYWRLZXB0IiwgImdsYWRSb3dPZiIsICJHTEFEX1BNX1JBU1RFUiIsIGZuICsgIjsgcmV0dXJuIGdsYWRTb3VyY2VTcGVjOyIpKG5ldyBTZXQoKSwgKCkgPT4gZmFsc2UsIChpZCkgPT4gaWQsIG5ldyBNYXAoKSk7CisgIGNvbnN0IHNwZWMgPSB7IHR5cGU6ICJyYXN0ZXIiLCB0aWxlczogWyJ3b29kcGFpbnQ6Ly97en0ve3h9L3t5fSJdIH07CisgIGNoZWNrKCJiYXNlbWFwIHBpY3R1cmVzIGFyZSBub3QgbWFwcGVkIGludG8gdGhlIGxheWVyIGNvbG91cnMiLCBnbGFkU291cmNlU3BlYygib3V0bGluZS13b29kLXBhaW50Iiwgc3BlYykudGlsZXNbMF0gPT09ICJ3b29kcGFpbnQ6Ly97en0ve3h9L3t5fSIpOworICBjaGVjaygibGF5ZXIgcGljdHVyZXMgc3RpbGwgYXJlIiwgL15nbGFkcHg6Ly50ZXN0KGdsYWRTb3VyY2VTcGVjKCJzb21lX3JvdyIsIHNwZWMpLnRpbGVzWzBdKSk7Cit9CisKIGNvbnNvbGUubG9nKCJcbnJvdW5kIDExMGMgKDI5IFNlcHRlbWJlcik6IHBsYW50ZWQsIGJvdWdodCBvciBjYXB0dXJlZCwgd29ybGR3aWRlIik7CiB7CiAgIGNvbnN0IHNyYyA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oSEVSRSwgImFwcC5qcyIpLCAidXRmOCIpOwo='

if __name__ == "__main__":
    main()
