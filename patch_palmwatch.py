#!/usr/bin/env python3
"""
Add PalmWatch to Culprits, drawn the way PalmWatch draws it, from a copy that
GitHub rereads from PalmWatch every day (culprits-tiles-more's refresh workflow).

- A new group, "Other organisations' maps", with PalmWatch as one row.
- Each mill's sourcing area, coloured as PalmWatch colours it: tree cover loss
  for a chosen year (its default: the latest year), or one of its three
  deforestation scores. The choice sits under the row, as chips plus a year menu,
  with the legend beside it.
- Hover shows the mill; a click opens its box: PalmWatch's mill details, the
  brands that disclosed buying from it, and its loss year by year.
- Its filters (recent score, RSPO status, country) are chips under the row.

The colour choice is general: any site-map file that carries "colourings" gets
the same row, so later maps can use it too.

Run from the repo root, after patch_conflicts.py:  python3 patch_palmwatch.py
Every edit is anchored on exact text; if an anchor is missing nothing is written.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if 'id: "palmwatch"' in app:
    sys.exit("app.js already has PalmWatch - nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
GROUP = f'''const OTHER_MAPS = {{
  id: "other_org_maps",
  name: "Other organisations' maps",
  group: true,
  ready: true,
  children: [
    {{ id: "palmwatch", name: "PalmWatch", unit: "palm oil mills", colour: "#87544A", route: "sitemap", ready: true, lazy: true, dataUrl: "{HOME}/sitemaps/palmwatch.places.geojson",
      note: "PalmWatch (Inclusive Development International and the University of Chicago Data Science Institute), reread from PalmWatch every day. Each area is a mill's modelled sourcing area, not a property boundary; tree cover loss inside it is not measured as that mill's own clearing." }},
  ],
}};

const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS, EXEC_MAP, MONEY_MAP, LEGAL_MAP, LEG_MAP, JUD_MAP, MORE_MAPS, GMO_MAP, OTHER_MAPS];'''
app = once(app, "const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS, EXEC_MAP, MONEY_MAP, LEGAL_MAP, LEG_MAP, JUD_MAP, MORE_MAPS, GMO_MAP];",
           GROUP, "map/app.js")

app = once(app, '  site_indigenous_conflicts: ["human", "downstream"],\n',
           '  site_indigenous_conflicts: ["human", "downstream"],\n  palmwatch: ["plant", "downstream"],\n', "map/app.js")

app = once(app, "    sitemapChipRows(cfg);\n  }\n",
           "    sitemapChipRows(cfg);\n  }\n"
           "  if (Array.isArray(data.colourings) && data.colourings.length) {\n"
           "    sitemapColourings.set(cfg.id, { list: data.colourings, pick: 0, year: {} });\n"
           "    sitemapColourRow(cfg);\n"
           "    applySitemapColouring(cfg.id);\n"
           "  }\n", "map/app.js")

app = once(app, "    if (btn.dataset.sm) { sitemapChipClicked(btn); return; }",
           "    if (btn.dataset.smc) { sitemapColourClicked(btn); return; }\n"
           "    if (btn.dataset.sm) { sitemapChipClicked(btn); return; }", "map/app.js")

JS = r'''/* ---------- a site map coloured by a chosen value ---------- */
// Some maps colour their areas by a value the reader chooses (PalmWatch: tree
// cover loss in a chosen year, or one of three scores). The places file lists
// those choices as "colourings"; the row under the map offers them as chips,
// with a year menu where the value is per year, and a legend for the one shown.
const sitemapColourings = new Map();

function colouringExpression(c, year) {
  const prop = String(c.prop || c.k).replace("{year}", year != null ? year : (c.year != null ? c.year : ""));
  if (Array.isArray(c.scores)) {
    const pairs = [];
    c.scores.forEach((s, i) => pairs.push(s, c.colours[i]));
    return ["match", ["to-number", ["get", prop], -1], ...pairs, "#8C877E"];
  }
  const expr = ["step", ["to-number", ["get", prop], 0], c.colours[0]];
  (c.breaks || []).forEach((b, i) => expr.push(b, c.colours[i + 1]));
  return ["case", ["has", prop], expr, "#8C877E"];
}

function colouringLegend(c) {
  return c.colours.map((col, i) =>
    `<span class="sm-key"><i style="background:${col}"></i>${escapeHtml((c.labels || [])[i] || "")}</span>`).join("");
}

function sitemapColourRow(cfg) {
  const state = sitemapColourings.get(cfg.id);
  const box = document.getElementById("layers");
  if (!state || !box || !box.querySelector || !document.createElement) return;
  const row = box.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (!anchor || box.querySelector(`.facet[data-colour-for="${cfg.id}"]`)) return;
  const el = document.createElement("div");
  el.className = "facet sm-colour";
  el.dataset.colourFor = cfg.id;
  if (anchor.after) anchor.after(el);
  renderColourRow(cfg.id);
}

function renderColourRow(id) {
  const state = sitemapColourings.get(id);
  const box = document.getElementById("layers");
  const el = box && box.querySelector && box.querySelector(`.facet[data-colour-for="${id}"]`);
  if (!state || !el) return;
  const c = state.list[state.pick];
  const year = state.year[c.k] != null ? state.year[c.k] : c.year;
  el.innerHTML = `<span class="chip reset">Colour by:</span>` +
    state.list.map((o, i) =>
      `<button type="button" class="chip${i === state.pick ? " on" : ""}" data-smc="${id}" data-ci="${i}">${escapeHtml(o.label)}</button>`).join("") +
    (Array.isArray(c.years) && c.years.length
      ? `<select class="sm-year" data-smy="${id}" aria-label="Year">` +
        c.years.map((y) => `<option value="${y}"${y === year ? " selected" : ""}>${y}</option>`).join("") + `</select>`
      : "") +
    `<div class="sm-legend">${colouringLegend(c)}</div>`;
  const sel = el.querySelector && el.querySelector("select");
  if (sel && sel.addEventListener) sel.addEventListener("change", () => {
    state.year[c.k] = Number(sel.value);
    applySitemapColouring(id);
  });
}

function applySitemapColouring(id) {
  const state = sitemapColourings.get(id);
  if (!state || !map.getLayer(`${id}-fill`)) return;
  const c = state.list[state.pick];
  const year = state.year[c.k] != null ? state.year[c.k] : c.year;
  map.setPaintProperty(`${id}-fill`, "fill-color", colouringExpression(c, year));
  map.setPaintProperty(`${id}-fill`, "fill-opacity", 0.6);
  map.setPaintProperty(`${id}-fill`, "fill-outline-color", "#1D1B17");
}

function sitemapColourClicked(btn) {
  const state = sitemapColourings.get(btn.dataset.smc);
  if (!state) return;
  state.pick = Number(btn.dataset.ci) || 0;
  renderColourRow(btn.dataset.smc);
  applySitemapColouring(btn.dataset.smc);
}

/* ---------- the sky the map sits in ---------- */'''
app = once(app, "/* ---------- the sky the map sits in ---------- */", JS, "map/app.js")

TESTS = r'''
console.log("\nother organisations' maps: PalmWatch");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("PalmWatch is one row in its own group", /const OTHER_MAPS = \{[\s\S]*id: "palmwatch"[^\n]*route: "sitemap"/.test(src) &&
        /const GROUPS = \[[^\]]*OTHER_MAPS\]/.test(src));
  check("its copy is served from GitHub, not the Worker",
        /id: "palmwatch"[^\n]*dataUrl: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/sitemaps\/palmwatch\.places\.geojson"/.test(src));
  check("its note says the catchment is modelled, not a boundary", /modelled sourcing area, not a property boundary/.test(src));
  check("a colour chip is handled before the filter chips",
        src.indexOf("if (btn.dataset.smc)") > 0 && src.indexOf("if (btn.dataset.smc)") < src.indexOf("if (btn.dataset.sm) {"));
  const body = src.slice(src.indexOf("function colouringExpression("), src.indexOf("function colouringLegend("));
  const colouringExpression = new Function("return " + body)();
  const loss = { k: "loss", prop: "l{year}", year: 2025, breaks: [0.25, 1.5], colours: ["#a", "#b", "#c"] };
  const e = colouringExpression(loss, 2019);
  check("the chosen year picks that year's value", JSON.stringify(e).includes('"l2019"'));
  check("breaks step up as PalmWatch's do", JSON.stringify(e[2]) === JSON.stringify(["step", ["to-number", ["get", "l2019"], 0], "#a", 0.25, "#b", 1.5, "#c"]));
  const s = colouringExpression({ k: "cur", prop: "cur", scores: [1, 2], colours: ["#x", "#y"] });
  check("a score is matched value by value", s[0] === "match" && s.includes("#x") && s.includes("#y"));
  check("the colours carry no orange or yellow", !/#(F[0-9A-F]{2}[0-9A-F]{3}|FF[A-F0-9]{2}00)/i.test(body));
}
'''
anchor = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor, TESTS + anchor)

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Added PalmWatch. Test with: node map/test.mjs")
