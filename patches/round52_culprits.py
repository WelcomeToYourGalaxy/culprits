#!/usr/bin/env python3
"""Round 52 (26 September): the duplicate Global Forest Watch hotspots row taken out. Upload to the culprits repo's patches folder (after round 50). Safe to run twice."""
import base64, subprocess, sys, os, tempfile
DIFF = base64.b64decode("ZGlmZiAtLWdpdCBhL21hcC9hcHAuanMgYi9tYXAvYXBwLmpzCmluZGV4IDVlMDliZTQuLjE3MGZlNDYgMTAwNjQ0Ci0tLSBhL21hcC9hcHAuanMKKysrIGIvbWFwL2FwcC5qcwpAQCAtNjEyMCw2ICs2MTIwLDEwIEBAIGNvbnN0IENBVEFMT0dVRV9CWV9USVRMRSA9IFsKICAgLy8gZW1pc3Npb25zIHBlciBoZWN0YXJlKSwgdW5kZXIgQ2xpbWF0ZS4gSXRzIGZpZ3VyZXMgYXJlIENPMiBlcXVpdmFsZW50LCBhbGwKICAgLy8gZ2FzZXMgdG9nZXRoZXIsIHNvIG5vdCB1bmRlciBvbmUgZ2FzLgogICBbL1xid3JpX2xhbmRfZ2hnX21vbml0b3Jpbmdfc3lzdGVtXGIvLCBbSU4oUCArICIgPiBDbGltYXRlIiwgImxhbmRnaGciKV1dLAorICAvLyBSb3VuZCA1MiAoMjYgU2VwdGVtYmVyLCBhdCB0aGUgb3duZXIncyB3b3JkKTogR2xvYmFsIEZvcmVzdCBXYXRjaCdzIGNvcHkgb2YKKyAgLy8gQ29uc2VydmF0aW9uIEludGVybmF0aW9uYWwncyBiaW9kaXZlcnNpdHkgaG90c3BvdHMgdGFrZW4gb3V0OyB0aGUgQXRsYXMncworICAvLyBob3RzcG90cyByb3cgZHJhd3MgdGhlIHNhbWUgMjAxNi4xIG91dGxpbmVzIGFuZCBvcGVucyB0aGUgQXRsYXMncyBwYWdlcy4KKyAgWy9cYmNpX2Jpb2RpdmVyc2l0eV9ob3RzcG90c1xiLywgbnVsbF0sCiAgIC8vIC0tLS0gMjUgU2VwdGVtYmVyIChyb3VuZCA0OSksIGF0IHRoZSBvd25lcidzIHdvcmQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tCiAgIC8vIExhbmQgYW5kIHRlcnJpdG9yeTogRkFPJ3MgZm9yZXN0cnkgZW1wbG95bWVudCBhbmQgTnVzYW50YXJhJ3MgZm91ciBzb2NpYWwKICAgLy8gZm9yZXN0cnkgcm93cyAoY29tbXVuaXR5LCBjdXN0b21hcnkgYW5kIHZpbGxhZ2UgZm9yZXN0LCBjdXN0b21hcnkKZGlmZiAtLWdpdCBhL21hcC9pbmRleC5odG1sIGIvbWFwL2luZGV4Lmh0bWwKaW5kZXggYTQ1YjdmNC4uNDM2OThlZSAxMDA2NDQKLS0tIGEvbWFwL2luZGV4Lmh0bWwKKysrIGIvbWFwL2luZGV4Lmh0bWwKQEAgLTQ5NSw4ICs0OTUsOCBAQAogICB9OwogfSkoKTsKIDwvc2NyaXB0PgotPHNjcmlwdCBzcmM9Ii4vYXBwLmpzP3Y9NTAiPjwvc2NyaXB0PgotPHNjcmlwdCBzcmM9Ii4vd2lyZS5qcz92PTUwIj48L3NjcmlwdD4KKzxzY3JpcHQgc3JjPSIuL2FwcC5qcz92PTUyIj48L3NjcmlwdD4KKzxzY3JpcHQgc3JjPSIuL3dpcmUuanM/dj01MiI+PC9zY3JpcHQ+CiA8IS0tIFRoZSBkcmFnIGJhciBvbiB0aGUgbGF5ZXJzIGJveCdzIHJpZ2h0IGVkZ2UgKG1hZGUgYnkgY29sdW1uRWRnZSgpIGluCiAgICAgIGFwcC5qcykgcmFuIHRoZSBmdWxsIGhlaWdodCBvZiB0aGUgY29sdW1uLCBzbyBpdCBzdGF5ZWQgc3RhbmRpbmcgYmVzaWRlCiAgICAgIGVtcHR5IG1hcCB3aGVuIHRoZSBib3ggd2FzIHJvbGxlZCB1cCBvciBwdWxsZWQgc2hvcnRlci4gSXQgaXMgaGVsZCB0byB0aGUKZGlmZiAtLWdpdCBhL21hcC90ZXN0Lm1qcyBiL21hcC90ZXN0Lm1qcwppbmRleCA1MTQyMTRiLi40MjM4MTU3IDEwMDY0NAotLS0gYS9tYXAvdGVzdC5tanMKKysrIGIvbWFwL3Rlc3QubWpzCkBAIC00MjAzLDcgKzQyMDMsMTcgQEAgQUFBQUFBQUFBQUFBIEFBQUFBQUFBQUFBQUFBQUEgfCBOTk5OIHwgICAgQSAgICB8IFlZWVktTU0tREQgSEg6TU0gfCBFRUVFRUVFRSB8IE4KICAgICAgICAgL1x7IGg6IDQsIHQ6ICJCaXJkcyIgXH0sICJjb3B5X2VuZGVtaWNfYmlyZF9hcmVhcyIvLnRlc3Qoc3JjKSAmJgogICAgICAgICAvIkxvZ2dpbmcgYW5kIHRpbWJlciBjb25jZXNzaW9ucyIgXH0sICJjb3B5X3Blcl9mb3Jlc3RfY29uY2Vzc2lvbnMiLCAiY29weV9vc2luZm9yX3Blcl9mb3Jlc3RfY29uY2Vzc2lvbnMiLy50ZXN0KHNyYykgJiYKICAgICAgICAgL2dmd1wvYmlyZGxpZmVfZW5kZW1pY19iaXJkX2FyZWFzXC5nZW9qc29uLy50ZXN0KHNyYykpOwotICBjaGVjaygidGhlIHBhZ2UgYXNrcyBmb3IgdGhpcyByb3VuZCdzIHNjcmlwdCIsIC9hcHBcLmpzXD92PTUwLy50ZXN0KGh0bWwpICYmIC93aXJlXC5qc1w/dj01MC8udGVzdChodG1sKSk7CisgIGNoZWNrKCJ0aGUgcGFnZSBhc2tzIGZvciB0aGlzIHJvdW5kJ3Mgc2NyaXB0IiwgL2FwcFwuanNcP3Y9KDVcZHxbNi05XVxkKS8udGVzdChodG1sKSAmJiAvd2lyZVwuanNcP3Y9KDVcZHxbNi05XVxkKS8udGVzdChodG1sKSk7Cit9Cit7CisgIGNvbnNvbGUubG9nKCJcbnJvdW5kIDUyOiB0aGUgZHVwbGljYXRlIGhvdHNwb3RzIHJvdyBvdXQiKTsKKyAgY29uc3Qgc3JjID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihIRVJFLCAiYXBwLmpzIiksICJ1dGY4Iik7CisgIGNvbnN0IGN1dCA9IChmcm9tLCB0bykgPT4gc3JjLnNsaWNlKHNyYy5pbmRleE9mKGZyb20pLCBzcmMuaW5kZXhPZih0bykpOworICBjb25zdCBsaWIgPSBuZXcgRnVuY3Rpb24oY3V0KCJjb25zdCBOVVNBTlRBUkFfTkFNRVMgPSB7IiwgIi8qIC0tLS0tLS0tLS0gYSBjYXRhbG9ndWUncyBsYXllcnMgYXMgcm93cyIpICsKKyAgICBjdXQoImNvbnN0IFAgPSBcIkRlc3RydWN0aW9uID4gT2YgdGhlIHBsYW5ldFwiOyIsICIvLyBUaGUgYm9keSBvZiB0aGUgaGVhZGluZyBhIHBhdGggbmFtZXMiKSArICI7IHJldHVybiB7IGNhdGFsb2d1ZVBsYWNlcyB9OyIpKCk7CisgIGNvbnN0IHQgPSAiQmlvZGl2ZXJzaXR5IGhvdHNwb3RzIOKAlCBHbG9iYWwgKGxhbmQgb25seSkgY2lfYmlvZGl2ZXJzaXR5X2hvdHNwb3RzIjsKKyAgY2hlY2soIkdsb2JhbCBGb3Jlc3QgV2F0Y2gncyBiaW9kaXZlcnNpdHkgaG90c3BvdHMgcm93IGlzIHRha2VuIG91dDsgdGhlIEF0bGFzJ3MgaG90c3BvdHMgcm93IHN0YXlzIiwKKyAgICAgICAgbGliLmNhdGFsb2d1ZVBsYWNlcyh0LCB0KS5qb2luKCkgPT09ICIodGFrZW4gb3V0KSIgJiYgL2lkOiAiYXRsYXNfaG90c3BvdHMiLy50ZXN0KHNyYykpOwogfQogY29uc29sZS5sb2coYFxuJHtwYXNzfSBwYXNzZWQsICR7ZmFpbH0gZmFpbGVkXG5gKTsKIHByb2Nlc3MuZXhpdChmYWlsID8gMSA6IDApOwo=")
NOTE = """
## Round 52 (26 September)

- Taken out at the owner's word: GFW's ci_biodiversity_hotspots (duplicate of
  atlas_hotspots). Aquaculture ponds kept (owner, 26 September).
- Needs round 50 applied first (patches apply in name order).
- culprits-tiles-more round 52: scripts/defor_funds_probe.py reads the latest
  SEC N-PORT quarter (tables, columns, samples) and Forest 500's data links
  into probe/nport/ and probe/forest500/, for the deforestation-funds builder.
"""
def git(*a):
    return subprocess.run(["git", *a], capture_output=True, text=True)
if not os.path.exists("map/app.js"):
    sys.exit("Run this from the culprits folder.")
with tempfile.NamedTemporaryFile("wb", suffix=".diff", delete=False) as f:
    f.write(DIFF); path = f.name
if git("apply", "--check", "-R", path).returncode == 0:
    print("Already applied. Nothing changed.")
else:
    r = git("apply", "--3way", path)
    if r.returncode != 0:
        print(r.stdout + r.stderr)
        git("checkout", "--", "map/app.js", "map/test.mjs", "map/index.html")
        sys.exit("Did not apply; nothing changed.")
    print("Code changes applied.")
os.unlink(path)
if os.path.exists("HANDOFF.md"):
    h = open("HANDOFF.md", encoding="utf-8").read()
    if "## Round 52 (26 September)" not in h:
        i = h.index("---") + 3
        open("HANDOFF.md", "w", encoding="utf-8").write(h[:i] + "\n" + NOTE + h[i:])
        print("HANDOFF.md note added.")
