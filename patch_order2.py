#!/usr/bin/env python3
"""
1. The layers box:
   - A new "Off-planet invasion" section, after On-planet invasion, ready for
     the space industry, launch sites and the other maps from the site's
     Off-Planet Invasion page.
   - Suppression in the order you gave:
       Of humans
         Physical suppression
           Control of physical resources (was "Economically")
           Economic inequality within it / School
           Law enforcement / Courts and corrections / Discrimination
           Slavery (with its national shading)
         Suppression by "representation" within it
           Politics as a front / Voter suppression / Representation as
           presentation / For money-written-law
           The food and drink industries / The medical industry
         Suppression by information
           Advertising / News / Entertainment / Science
         Suppression by social molds
           Religion and spirituality / Sports / Holidays / Sex / Drugs
       Of animals / Of plants / Of microscopics / Of the "insentient"
     Headings with nothing in them yet say "none yet".
2. The news marks' boxes: instead of one "Sort by" menu, each field gets its own
   filter: a Subject menu, a Source menu, a Headline search box, and the order.

Run from the repo root:  python3 patch_order2.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, HTML = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs", ROOT / "map" / "index.html"
app, test, html = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8"), HTML.read_text(encoding="utf-8")
if 't: "Off-planet invasion"' in app:
    sys.exit("Already applied - nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


OLD = '''  { h: 1, t: "Suppression" },
  { h: 2, t: "Economically" }, "site_central_banks", "site_banking_dynasties", "site_export_credit", "site_wealth_atlas",
    "site_export_credit_shading", "site_earmarked_funding", "site_trade_profits", "site_social_spheres",
  { h: 2, t: "Slavery" },
  { h: 3, t: "Of humans" }, "slavery_sites", "slavery_ports", "slavery_routes", "slavery_determinations", "slavery_enforcement",
  { h: 4, t: "National shading" }, "slavery_cases", "slavery_prevalence",
  { h: 3, t: "With information" }, "site_world_advertising", "site_world_news", "site_research_integrity", "site_world_entertainment",
  { h: 3, t: "Metaphysically" }, "site_eyes_network",
  { h: 3, t: "Socially" }, "capture_map", "site_cartel_cells",
  { h: 3, t: "Of animals" }, "site_animal_fighting", "site_animal_tourism", "site_circus", "site_animal_racing", "site_rodeo",
  { h: 3, t: "Of plants" }, "site_enslaved_plants",
  { h: 3, t: "Of microorganisms" }, "site_enslaved_microbes",
  { h: 3, t: "Of the insentient" }, "site_insentient",
'''
NEW = '''  { h: 1, t: "Suppression" },
  { h: 2, t: "Of humans" },
  { h: 3, t: "Physical suppression" },
  { h: 4, t: "Control of physical resources" }, "site_central_banks", "site_banking_dynasties", "site_export_credit", "site_wealth_atlas",
    "site_export_credit_shading", "site_earmarked_funding", "site_trade_profits", "site_social_spheres",
  { h: 4, t: "Economic inequality within it" },
  { h: 5, t: "School" },
  { h: 4, t: "Law enforcement" },
  { h: 4, t: "Courts and corrections" },
  { h: 4, t: "Discrimination" },
  { h: 4, t: "Slavery" }, "slavery_sites", "slavery_ports", "slavery_routes", "slavery_determinations", "slavery_enforcement",
  { h: 5, t: "National shading" }, "slavery_cases", "slavery_prevalence",
  { h: 3, t: "Suppression by \\u201crepresentation\\u201d within it" },
  { h: 4, t: "Politics as a front" },
  { h: 5, t: "Voter suppression" },
  { h: 5, t: "Representation as presentation" },
  { h: 5, t: "For money-written-law" },
  { h: 4, t: "The food and drink industries" },
  { h: 4, t: "The medical industry" },
  { h: 3, t: "Suppression by information" },
  { h: 4, t: "The advertising industries" }, "site_world_advertising",
  { h: 4, t: "The news industry" }, "site_world_news",
  { h: 4, t: "The entertainment industries" }, "site_world_entertainment",
  { h: 4, t: "Science" }, "site_research_integrity",
  { h: 3, t: "Suppression by social molds" },
  { h: 4, t: "Religion and spirituality" },
  { h: 4, t: "Sports" }, "site_eyes_network",
  { h: 4, t: "Holidays" },
  { h: 4, t: "Sex" },
  { h: 4, t: "Drugs" }, "capture_map", "site_cartel_cells",
  { h: 2, t: "Of animals" }, "site_animal_fighting", "site_animal_tourism", "site_circus", "site_animal_racing", "site_rodeo",
  { h: 2, t: "Of plants" }, "site_enslaved_plants",
  { h: 2, t: "Of microscopics" }, "site_enslaved_microbes",
  { h: 2, t: "Of the \\u201cinsentient\\u201d" }, "site_insentient",
'''
app = once(app, OLD, NEW, "map/app.js")
app = once(app, '''  { h: 1, t: "Destruction" },''', '''  { h: 1, t: "Off-planet invasion" },
  { note: "The space industry, launch sites and the other maps from the site's Off-Planet Invasion page come here." },

  { h: 1, t: "Destruction" },''', "map/app.js")
app = once(app, '''      ".panel-h4{font-size:10.5px;opacity:.7;padding-left:16px;font-style:italic}";''',
          '''      ".panel-h4{font-size:10.5px;opacity:.7;padding-left:16px;font-style:italic}" +
      ".panel-h5{font-size:10.5px;opacity:.62;padding-left:22px}";''', "map/app.js")
test = once(test, '''heads.slice(0, 3).join("|") === "On-planet invasion|Destruction|Suppression"''',
            '''heads.slice(0, 4).join("|") === "On-planet invasion|Off-planet invasion|Destruction|Suppression"''', "map/test.mjs")
test = once(test, '''check("the three sections come first, in order",''', '''check("the four sections come first, in order",''', "map/test.mjs")

# --- news mark boxes: a filter per field ------------------------------------------------
app = once(app, '''                 (list.length > 1 ? `<label class="wire-pop-sort">Sort by <select>` +
                   WIRE_SORTS.map(([k, nm]) => `<option value="${k}">${nm}</option>`).join("") +
                   `</select></label>` : "") +
                 `<div class="wire-pop-list">${wirePopRows(list, "new")}</div>`)
        .addTo(map);
      const el = pop.getElement && pop.getElement();
      const sel = el && el.querySelector(".wire-pop-sort select");
      if (sel) sel.addEventListener("change", () => {
        el.querySelector(".wire-pop-list").innerHTML = wirePopRows(list, sel.value);
      });''', '''                 (list.length > 1 ? wirePopFilters(list) : "") +
                 `<div class="wire-pop-list">${wirePopRows(list, "new")}</div>`)
        .addTo(map);
      const el = pop.getElement && pop.getElement();
      const redraw = () => {
        const f = {};
        for (const c of el.querySelectorAll("[data-wf]")) f[c.dataset.wf] = c.value;
        const shown = wirePopPick(list, f);
        el.querySelector(".wire-pop-list").innerHTML = shown.length ? wirePopRows(shown, f.order || "new")
          : `<div class="meta">No story matches these filters.</div>`;
        const n = el.querySelector(".wire-pop-n");
        if (n) n.textContent = shown.length === list.length ? "" : `${shown.length} of ${list.length} shown`;
      };
      if (el) for (const c of el.querySelectorAll("[data-wf]")) c.addEventListener(c.tagName === "INPUT" ? "input" : "change", redraw);''', "map/app.js")
app = once(app, '''// Every story at a mark, in the order chosen in its box.''', r'''// The box's filters: a menu for each subject and source, a search for the
// headline, and the order.
function wirePopFilters(list) {
  const opts = (key) => [...new Set(list.map((s) => s[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const menu = (key, label) => {
    const vals = opts(key);
    return vals.length > 1
      ? `<label class="wire-pop-sort">${label} <select data-wf="${key}"><option value="">All</option>` +
        vals.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("") + `</select></label>` : "";
  };
  return menu("subject", "Subject") + menu("outlet", "Source") +
    `<label class="wire-pop-sort">Headline <input data-wf="title" type="search" placeholder="words in the headline" ` +
    `style="flex:1;font:inherit;color:var(--bone);background:var(--peat,#17150F);border:1px solid var(--rule);border-radius:2px;padding:1px 4px"></label>` +
    `<label class="wire-pop-sort">Order <select data-wf="order">` +
    WIRE_SORTS.map(([k, nm]) => `<option value="${k}">${nm}</option>`).join("") + `</select></label>` +
    `<div class="meta wire-pop-n"></div>`;
}
function wirePopPick(list, f) {
  const words = String(f.title || "").toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((s) => (!f.subject || s.subject === f.subject) && (!f.outlet || s.outlet === f.outlet) &&
    words.every((w) => String(s.title || "").toLocaleLowerCase().includes(w)));
}

// Every story at a mark, in the order chosen in its box.''', "map/app.js")

TESTS = r'''
console.log("\nsuppression in the given order; news box filters");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const at = (t) => order.findIndex((x) => x && x.t === t);
  check("Off-planet invasion is its own section", at("Off-planet invasion") > at("On-planet invasion") && at("Off-planet invasion") < at("Destruction"));
  check("Suppression opens on Of humans, then its four kinds in order",
        at("Of humans") < at("Physical suppression") && at("Physical suppression") < at("Suppression by \u201crepresentation\u201d within it") &&
        at("Suppression by \u201crepresentation\u201d within it") < at("Suppression by information") && at("Suppression by information") < at("Suppression by social molds"));
  check("Economically is now Control of physical resources", at("Economically") === -1 && at("Control of physical resources") > at("Physical suppression"));
  check("the other beings follow Of humans", at("Of animals") > at("Suppression by social molds") && at("Of microscopics") > at("Of plants"));
  const pick = new Function(src.slice(src.indexOf("function wirePopPick("), src.indexOf("// Every story at a mark")) + "; return wirePopPick;")();
  const list = [{ subject: "Slavery", outlet: "AP", title: "Brick kilns raided" }, { subject: "Voting", outlet: "AP", title: "Polls close" },
                { subject: "Slavery", outlet: "BBC", title: "Fishing crews freed" }];
  check("a news box filters by subject", pick(list, { subject: "Slavery" }).length === 2);
  check("…by source", pick(list, { outlet: "BBC" }).length === 1);
  check("…and by words in the headline", pick(list, { title: "kilns" }).length === 1 && pick(list, { title: "" }).length === 3);
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Order and news filters done. Test with: node map/test.mjs")
