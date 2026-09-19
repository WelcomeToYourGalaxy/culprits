#!/usr/bin/env python3
"""
Off-planet invasion: the space industry map from openmaps.space. Every place it
lists (headquarters, factories, test sites, launch sites, offices), each box
showing the organisations there as that map groups them: name, logo,
description, owners and their shares, staff, products and links. Chips filter by
the kind of place. Copied daily from openmaps.space's own data file by
culprits-tiles-more (scripts/openmaps_space.py).

Run from the repo root:  python3 patch_space_industry.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if 'id: "space_industry"' in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
once('''    { id: "wreckers_umap",''', f'''    {{ id: "space_industry", name: "The space industry (openmaps.space)", unit: "places", colour: "#5E6070", route: "geojsonlive", ready: true, lazy: true,
      files: [{{ label: "Places", url: "{HOME}/openmaps/space_industry.geojson" }}],
      note: "openmaps.space's space industry map: every place it lists, with the organisations there, copied daily from its own data file." }},
    {{ id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  space_industry: ["insentient", "upstream"],\n')
once('"ll2_pads", "ll2_upcoming",', '"space_industry", "ll2_pads", "ll2_upcoming",')
once('''      items.push({ geometry: ft.geometry, key: `${f.label}:${i}`, name: String(name), group: f.label,
        h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(name)}</h4><table>${fieldRows(p)}</table></div>` });''',
     '''      items.push({ geometry: ft.geometry, key: `${f.label}:${i}`, name: String(name), group: p.group != null ? String(p.group) : f.label,
        // A copy that carries its source's own box (_html) shows that; otherwise every field.
        h: p._html ? boxOpen + p._html + `</div>`
          : boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(name)}</h4><table>${fieldRows(p)}</table></div>` });''')

TESTS = r'''
console.log("\nthe space industry map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("it is a row under Off-planet invasion", /id: "space_industry"/.test(src) && /"space_industry", "ll2_pads"/.test(src));
  check("its boxes are the ones its copy carries", /p\._html \? boxOpen \+ p\._html/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("The space industry map added. Test with: node map/test.mjs")
