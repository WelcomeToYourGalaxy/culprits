#!/usr/bin/env python3
"""
Step 1, finished: each site map's own filters, on its own row.

The maps do not use Leaflet's layer menu — each writes its own controls, as
checkboxes or as buttons carrying a category. Those controls are now read out
of each map's markup (extract.mjs), matched against that map's own places, and
carried into Culprits as chips under the map's row:

- The values and the words on them are the map's own. Only the heading over a
  row is chosen here, because the markup does not carry one.
- A control group is kept only if it actually sorts that map's places: at least
  two of its values match something, and at least half the places are matched.
  A map whose controls sort nothing gets no filter and the build says so, rather
  than a row of chips that do nothing.
- Ticking chips narrows what the map draws. Nothing else on the atlas moves.

This patch is the map side. The two pipeline files in the same download read
the controls and write them into each map's places file; run the build to make
them, as before.

Edits map/app.js and map/test.mjs.

Run from the repo root:  python3 patch_mapfilters.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = (ROOT / "map" / n for n in ("app.js", "test.mjs"))
app, test = (p.read_text(encoding="utf-8") for p in (APP, TEST))

if "sitemapFilters" in app:
    sys.exit("app.js already carries the maps' own filters — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


FILTERS = r'''
/* ---------- each site map's own filters ---------- */

// Built by pipeline/sitemaps/build_boxes.py from the map's own controls. A
// place carries the values it matched as "|a|b|", so a chip is a substring
// test and a place can belong to more than one.
const sitemapFilters = new Map();     // map id -> { filters, picked: [Set], base: {layerId: filter} }

function sitemapChipRows(cfg) {
  const state = sitemapFilters.get(cfg.id);
  const box = document.getElementById("layers");
  if (!state || !box || !box.querySelector) return;
  const row = box.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (!anchor || !document.createElement) return;
  state.filters.forEach((f, i) => {
    if (box.querySelector(`.facet[data-for="${cfg.id}-${i}"]`)) return;
    const el = document.createElement("div");
    el.className = "facet";
    el.dataset.for = `${cfg.id}-${i}`;
    el.innerHTML = `<span class="chip reset" data-sm="${cfg.id}" data-fi="${i}" data-k="">${f.label}: all</span>` +
      f.values.map((v) =>
        `<button type="button" class="chip" data-sm="${cfg.id}" data-fi="${i}" data-k="${escapeHtml(v.k)}">` +
        `${escapeHtml(v.label)} (${v.n.toLocaleString()})</button>`).join("");
    if (anchor.after) anchor.after(el);
  });
}

// A chip narrows what the map draws; an empty set means the whole map.
function applySitemapFilters(id) {
  const state = sitemapFilters.get(id);
  if (!state) return;
  const conditions = [];
  state.picked.forEach((set) => {
    if (!set.size) return;
    conditions.push(["any", ...[...set].map((k) => ["in", `|${k}|`, ["coalesce", ["get", "f"], ""]])]);
  });
  for (const [layerId, base] of Object.entries(state.base)) {
    if (!map.getLayer(layerId)) continue;
    map.setFilter(layerId, conditions.length ? ["all", base, ...conditions] : base);
  }
}

function sitemapChipClicked(btn) {
  const state = sitemapFilters.get(btn.dataset.sm);
  if (!state) return;
  const set = state.picked[Number(btn.dataset.fi)];
  if (!set) return;
  if (!btn.dataset.k) set.clear();
  else if (set.has(btn.dataset.k)) set.delete(btn.dataset.k);
  else set.add(btn.dataset.k);
  const box = document.getElementById("layers");
  const row = box && box.querySelector(`.facet[data-for="${btn.dataset.sm}-${btn.dataset.fi}"]`);
  if (row && row.querySelectorAll) {
    for (const chip of row.querySelectorAll("[data-k]")) {
      const on = chip.dataset.k ? set.has(chip.dataset.k) : set.size === 0;
      if (chip.classList) chip.classList.toggle("on", on);
    }
  }
  applySitemapFilters(btn.dataset.sm);
}
'''
app = once(app, "\n/* ---------- the sky the map sits in ---------- */", FILTERS + "\n/* ---------- the sky the map sits in ---------- */", "map/app.js")

# The site map layers remember the filter they were built with, so a chip can
# be added to it rather than replacing it.
app = once(app, """  for (const kind of ["fill", "line", "pt"]) {
    const id = `${cfg.id}-${kind}`;
    SITEMAP_LAYERS.add(id);""", """  if (Array.isArray(data.filters) && data.filters.length) {
    sitemapFilters.set(cfg.id, {
      filters: data.filters,
      picked: data.filters.map(() => new Set()),
      base: {
        [`${cfg.id}-fill`]: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
        [`${cfg.id}-line`]: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
        [`${cfg.id}-pt`]: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
      },
    });
    sitemapChipRows(cfg);
  }
  for (const kind of ["fill", "line", "pt"]) {
    const id = `${cfg.id}-${kind}`;
    SITEMAP_LAYERS.add(id);""", "map/app.js")

app = once(app, """    const btn = e.target.closest(".chip");
    if (!btn) return;""", """    const btn = e.target.closest(".chip");
    if (!btn) return;
    if (btn.dataset.sm) { sitemapChipClicked(btn); return; }""", "map/app.js")

TESTS = r'''
console.log("\neach site map's own filters");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("a map's filters come from its own places file", /Array\.isArray\(data\.filters\)/.test(src) &&
        /sitemapFilters\.set\(cfg\.id/.test(src));
  check("a chip is a substring test, so a place can belong to more than one",
        /\["in", `\|\$\{k\}\|`, \["coalesce", \["get", "f"\], ""\]\]/.test(src));
  check("the chips sit under the map's own row",
        /el\.dataset\.for = `\$\{cfg\.id\}-\$\{i\}`/.test(src) && /anchor\.after\(el\)/.test(src));
}
{
  const places = { type: "FeatureCollection", name: "Test Map", overlays: [],
    filters: [{ label: "Category", values: [{ k: "circus", label: "Circuses", n: 2 }, { k: "marine", label: "Marine Shows", n: 1 }] }],
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [10, 20] }, properties: { k: "a", n: "One", f: "|circus|" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [11, 21] }, properties: { k: "b", n: "Two", f: "|marine|" } },
    ] };
  const { map } = run({ fetchImpl: async (u) => ({ ok: true, status: 200, json: async () => places }) });
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const panel = globalThis.document.getElementById("layers");
  panel.fire("change", { target: { dataset: { layer: "site_circus" }, checked: true } });
  await new Promise((r) => setTimeout(r, 10));
  const pt = map.getLayer("site_circus-pt");
  check("the map draws everything until a chip is ticked",
        JSON.stringify(pt.filter) === JSON.stringify(["match", ["geometry-type"], ["Point", "MultiPoint"], true, false]));
  panel.fire("click", { target: { closest: (s) => (s === ".chip" ? { dataset: { sm: "site_circus", fi: "0", k: "circus" } } : null) } });
  const f = map.getLayer("site_circus-pt").filter;
  check("ticking one narrows the map to it", JSON.stringify(f).includes('["in","|circus|"'), JSON.stringify(f));
  check("…and leaves the map's own geometry filter in place", Array.isArray(f) && f[0] === "all");
  panel.fire("click", { target: { closest: (s) => (s === ".chip" ? { dataset: { sm: "site_circus", fi: "0", k: "" } } : null) } });
  check("the all chip puts the whole map back",
        JSON.stringify(map.getLayer("site_circus-pt").filter) ===
        JSON.stringify(["match", ["geometry-type"], ["Point", "MultiPoint"], true, false]));
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Each site map's own filters now show as chips under its row.")
