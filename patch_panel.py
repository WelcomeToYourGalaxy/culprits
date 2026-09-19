#!/usr/bin/env python3
"""
1. The layers box laid out in your order, under your headings:
   On-planet invasion / Destruction / Suppression, their sub-headings, then
   Building types (to become one combined layer), then "Not yet placed" for any
   layer your list did not name. The rows on your DELETE list are taken out of
   the box (the files stay; nothing else changes).
2. Wreckers of the Earth: the uMap is read through the addresses the map itself
   publishes for its layers, and each box is written with the map's own popup
   template (name, address, sector, description).
3. The Google My Maps maps: most of their places are given only as an address
   (Google looks addresses up itself when it draws them). Those are now placed
   from a weekly OpenStreetMap lookup kept by culprits-tiles-more, and each box
   says its position came from its address.
4. The ArcGIS maps: every request gives up after 25 seconds instead of hanging,
   and the row says which step it is on, so "loading…" can no longer stick.
5. The Trase row's id no longer clashes with an older unbuilt source of the
   same name.

Run from the repo root:  python3 patch_panel.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "const PANEL_ORDER = [" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new, where="map/app.js"):
    global app, test
    text = app if where == "map/app.js" else test
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    if where == "map/app.js":
        app = app.replace(old, new)
    else:
        test = test.replace(old, new)


# --- Trase id -------------------------------------------------------------------
once('{ id: "trase", name: "Trase: deforestation and supply-chain measures"',
     '{ id: "trase_measures", name: "Trase: deforestation and supply-chain measures"')
once('  trase: ["plant", "downstream"],\n', '  trase_measures: ["plant", "downstream"],\n')
once('/id: "trase"[^\\n]*route: "trase"/', '/id: "trase_measures"[^\\n]*route: "trase"/', "map/test.mjs")

# --- uMap -----------------------------------------------------------------------
once("""  const layers = props.datalayers || m.datalayers || [];
  const items = [];
  for (const dl of layers) {
    const id = dl.id || dl.uuid || (dl.settings && dl.settings.id);
    let gj = null;
    for (const u of [`${cfg.umap}/datalayer/${cfg.umapId}/${id}/`, `${cfg.umap}/datalayer/${id}/`]) {
      try { gj = await getJson(u); break; } catch (e) { /* try the older address */ }
    }""",
"""  const layers = props.datalayers || m.datalayers || [];
  const items = [];
  // The map says where its layers live (urls.datalayer_view); older maps used
  // two fixed shapes of address, tried after it.
  const tpl = props.urls && (props.urls.datalayer_view || props.urls.datalayer_get);
  const site = cfg.umap.replace(/\\/[a-z]{2}(-[a-z]+)?$/i, "");
  const tried = [];
  for (const dl of layers) {
    const id = typeof dl === "object" ? (dl.id || dl.uuid || dl.pk || (dl.settings && dl.settings.id)) : dl;
    let gj = null;
    const urls = [
      tpl ? site + tpl.replace("{map_id}", cfg.umapId).replace("{pk}", id).replace("{datalayer_id}", id) : null,
      tpl ? cfg.umap + tpl.replace("{map_id}", cfg.umapId).replace("{pk}", id).replace("{datalayer_id}", id) : null,
      `${cfg.umap}/datalayer/${cfg.umapId}/${id}/`, `${cfg.umap}/datalayer/${id}/`,
    ].filter(Boolean);
    for (const u of urls) {
      tried.push(u);
      try { gj = await getJson(u); break; } catch (e) { /* try the next shape of address */ }
    }""")
once("""        h: `<div style="font:13px/1.4 system-ui,sans-serif;max-width:320px"><h4 style="margin:0 0 6px">${escapeHtml(p.name || "")}</h4>` +
           `<div>${umapText(p.description)}</div></div>` });
    });
  }
  return { title: props.name || cfg.name, items };""",
"""        h: `<div style="font:13px/1.4 system-ui,sans-serif;max-width:320px">` +
           umapPopup(o.popupContentTemplate || opts.popupContentTemplate || props.popupContentTemplate, p) + `</div>` });
    });
  }
  if (!items.length) console.warn(`[culprits] ${cfg.id}: no places read from ${layers.length} uMap layers; tried ${tried.join(" , ")}`);
  return { title: props.name || cfg.name, items };""")
once("async function readUmap(cfg) {", r"""// A uMap popup template: "# {name}" a heading, *…* italic, **…** bold, {field}
// the feature's field, [[url|text]] a link, blank lines paragraphs.
function umapPopup(template, p) {
  const t = template || "# {name}\n{description}";
  const filled = t.replace(/\{([^}|]+)(?:\|([^}]*))?\}/g, (all, k, fallback) =>
    p[k.trim()] != null && p[k.trim()] !== "" ? String(p[k.trim()]) : (fallback || ""));
  return filled.split(/\n/).map((line) => {
    const h = /^(#{1,3})\s*(.*)$/.exec(line);
    if (h) return `<h${h[1].length + 2} style="margin:0 0 6px">${umapText(h[2])}</h${h[1].length + 2}>`;
    const it = /^\*([^*].*[^*])\*$/.exec(line.trim());
    if (it) return `<div><i>${umapText(it[1])}</i></div>`;
    return line.trim() ? `<div>${umapText(line)}</div>` : "";
  }).join("");
}

async function readUmap(cfg) {""")


# --- My Maps: places given only as an address --------------------------------------
once("""  const items = [];
  [...doc.getElementsByTagName("Placemark")].forEach((pm, i) => {""",
"""  const items = [];
  // Places the map gives only as an address: positions looked up weekly from
  // OpenStreetMap by culprits-tiles-more (Google looks them up itself when it
  // draws the map, so its file carries none).
  const mid = (/[?&]mid=([^&]+)/.exec(cfg.kml) || [])[1];
  let looked = {};
  try { looked = await getJson(`https://welcometoyourgalaxy.github.io/culprits-tiles-more/mymaps/geocode_${mid}.json`); } catch (e) { /* not built yet */ }
  let fromAddress = 0, noPlace = 0;
  [...doc.getElementsByTagName("Placemark")].forEach((pm, i) => {""")
once("""    kmlGeometries(pm).forEach((g, j) => items.push({ geometry: g, key: `pm${i}`, name, group: folder, colour, h }));
  });
  return { title: docName.trim() || cfg.name, items };""",
"""    const geoms = kmlGeometries(pm);
    if (!geoms.length) {
      const addr = kid("address").replace(/\\s+/g, " ").trim();
      const at = addr && looked[addr];
      if (at) {
        fromAddress++;
        items.push({ geometry: { type: "Point", coordinates: at }, key: `pm${i}`, name, group: folder, colour,
          h: h.replace(/<\\/div>$/, `<div style="margin-top:6px;font-size:11px">Position found from its address (${escapeHtml(addr)}) through OpenStreetMap; the map itself gives only the address.</div></div>`) });
      } else noPlace++;
      return;
    }
    geoms.forEach((g, j) => items.push({ geometry: g, key: `pm${i}`, name, group: folder, colour, h }));
  });
  const parts = [];
  if (fromAddress) parts.push(`${fromAddress.toLocaleString()} placed from their addresses`);
  if (noPlace) parts.push(`${noPlace.toLocaleString()} not yet placed (address not yet looked up or not found)`);
  return { title: docName.trim() || cfg.name, items, note: parts.join("; ") };""")

# --- ArcGIS: timeouts and progress -----------------------------------------------
once("""async function getJson(url) {
  const r = await fetch(url);""", """async function getJson(url, ms = 25000) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
  let r;
  try { r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined); }
  catch (e) { throw new Error(ctrl && ctrl.signal.aborted ? `no answer in ${Math.round(ms / 1000)} s from ${url.split("?")[0]}` : e.message); }
  finally { if (timer) clearTimeout(timer); }""")
once("""async function readArcgisApp(cfg) {
  const maps = await arcgisWebmapsOf(cfg.item);""", """async function readArcgisApp(cfg) {
  setLayerState(cfg.id, "finding the map inside the ArcGIS app\\u2026");
  const maps = await arcgisWebmapsOf(cfg.item);""")
once("""    for (const l of layers) {
      let feats;""", """    for (const [n, l] of layers.entries()) {
      setLayerState(cfg.id, `reading layer ${n + 1} of ${layers.length}: ${l.title || ""}\\u2026`);
      let feats;""")

# --- the panel order -------------------------------------------------------------
ORDER = r'''/* ---------- the layers box, in the order and under the headings chosen ---------- */
// Strings are layer ids; "group:" a whole group; "gm" the guerillamap row.
// { h: level, t: text } is a heading. Anything not named here goes under
// "Not yet placed" at the end, so nothing disappears unseen; ids in
// PANEL_REMOVED are taken out of the box.
const PANEL_ORDER = [
  { h: 1, t: "On-planet invasion" },
  { h: 2, t: "Pre-birth frontlines" }, "gmo_releases",
  { h: 2, t: "Post-birth invasion" },
  { h: 3, t: "Invasion of nonhumans" }, "group:gmo_map_layers",
  { h: 3, t: "Invasion of humans" }, "site_settler_colonialism", "site_indigenous_conflicts",
  { h: 3, t: "Of countries by countries" }, "site_secret_societies", "gm",
  { h: 2, t: "Post-life invasion" }, "remains_records", "remains_findings", "remains_cemeteries",

  { h: 1, t: "Destruction" },
  { h: 2, t: "Of the planet" },
  { h: 3, t: "Climate" }, "group:climate_trace_sectors", "group:climate_trace_agriculture", "group:climate_trace_forestry",
    "gem_coal", "carbon_bombs", "power_plants", "fertilizer_facilities", "site_carbon_mapper_waste", "site_china_grain",
    "usda_soybean", "usda_corn", "wastewater",
  { h: 4, t: "National shading" }, "owid_co2",
  { h: 3, t: "Toxic pollution" }, "epa_tri", "epa_tri_sites",
  { h: 3, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch",
  { h: 3, t: "Deforestation" }, "gfw", "gfw_dist", "gfw_dist_year", "glad_loss", "mymaps_trees", "palmwatch", "soilgrids",
  { h: 3, t: "Agriculture" },
  { h: 4, t: "National shading" }, "land_matrix",
  { h: 4, t: "Slaughterhouses" }, "abattoir_facilities", "cultivated_meat_laws",
  { h: 3, t: "Oceans" }, "fishing", "slavery_fishing", "cerulean_slicks", "cerulean_sources", "allen_coral",
  { h: 3, t: "Construction" }, "local_projects",
  { h: 3, t: "Culprits upstream" },
  { h: 4, t: "Emissions" }, "carbon_majors", "soy_organizations", "fractracker_refineries",
  { h: 4, t: "Deforestation" }, "site_forest500_soy", "site_soybean_companies",
  { h: 4, t: "Food generally" }, "site_food_system",
  { h: 4, t: "Generally" }, "wreckers_umap",
  { h: 2, t: "Of groups" },
  { h: 2, t: "Of individuals" }, "site_animal_sacrifice",

  { h: 1, t: "Suppression" },
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

  { h: 1, t: "Building types" },
  { h: 4, t: "Being combined into one layer, with duplicate places merged" },
  "fin_bank", "fin_centralbank", "fin_taxoffice", "fin_govfinance", "fin_financial", "fin_exchange", "fin_insurance",
  "fin_accountant", "fin_remittance", "fin_stockexchange", "fin_auditoffice", "fin_devbank", "fin_mint",
  "legal_publicdefender", "legal_immigration", "legal_probation", "legal_juvenile",
  "leg_parliament", "leg_audit", "leg_electoral", "leg_ombudsman", "leg_council",
  "exec_firestation", "exec_townhall", "leg_townhall", "exec_govoffice", "exec_ministry", "exec_diplomatic", "exec_border",
  "jud_courts", "legal_courthouse", "slavery_facilities", "activist_courts",
  "exec_police", "legal_police", "activist_police",
  "exec_prison", "legal_prison", "jud_prisons", "activist_prisons",
];
const PANEL_REMOVED = new Set([
  "site_ufo_pre1900", "site_subsistence_cultures", "site_self_sufficiency", "slavery_trackers",
  "site_environment_law", "enviro_law_by_country", "site_environment_law_shapes", "gov_official_map",
  "group:executive_map_layers", "group:money_map_layers", "group:legal_map_layers",
  "group:legislative_map_layers", "group:judicial_map_layers",
  "legal_by_state", "leg_by_state", "judicial_by_state", "leg_subnational", "leg_county",
  "leg_municipal", "leg_municipal_recover", "leg_laws",
]);

function panelNodes(box, key) {
  let lead = null;
  if (key === "gm") { const i = box.querySelector("[data-gm]"); lead = i && i.closest("label"); }
  else if (key.startsWith("group:")) { const i = box.querySelector(`[data-group="${key.slice(6)}"]`); lead = i && i.closest(".group"); }
  else { const i = box.querySelector(`[data-layer="${key}"]`); lead = i && i.closest("label"); }
  if (!lead) return [];
  const nodes = [lead];
  // A row's chips and menus sit right after it.
  let next = lead.nextElementSibling;
  while (next && next.classList && next.classList.contains("facet")) { nodes.push(next); next = next.nextElementSibling; }
  return nodes;
}

function arrangePanel() {
  const box = document.getElementById("layers");
  if (!box || !box.querySelector || typeof document.createDocumentFragment !== "function" || !box.dataset || box.dataset.arranged) return;
  box.dataset.arranged = "1";
  const frag = document.createDocumentFragment();
  const placed = new Set();
  const heading = (h, t) => {
    const el = document.createElement("div");
    el.className = `panel-h panel-h${h}`;
    el.textContent = t;
    return el;
  };
  for (const item of PANEL_ORDER) {
    if (typeof item === "object") { frag.appendChild(heading(item.h, item.t)); continue; }
    const nodes = panelNodes(box, item);
    nodes.forEach((n) => frag.appendChild(n));
    if (nodes.length) placed.add(item);
  }
  // Removed rows go into a hidden holder, so code that looks them up still finds them.
  const gone = document.createElement("div");
  gone.hidden = true;
  gone.dataset.removed = "1";
  for (const key of PANEL_REMOVED) panelNodes(box, key).forEach((n) => gone.appendChild(n));
  // What is left: rows and groups nobody placed.
  const rest = document.createDocumentFragment();
  for (const el of [...box.children]) {
    if (el.classList && el.classList.contains("group")) {
      const inside = el.querySelectorAll ? el.querySelectorAll("[data-layer]").length : 0;
      if (!inside) { gone.appendChild(el); continue; }
    }
    if (el.tagName === "LABEL" || (el.classList && (el.classList.contains("group") || el.classList.contains("facet")))) rest.appendChild(el);
  }
  const tail = [...box.children];
  box.insertBefore(frag, box.children[1] || null);
  if (rest.childNodes.length) { box.appendChild(heading(1, "Not yet placed")); box.appendChild(rest); }
  tail.filter((el) => el.classList && el.classList.contains("pending-note")).forEach((el) => box.appendChild(el));
  box.appendChild(gone);
  if (!document.getElementById("panel-h-style")) {
    const st = document.createElement("style");
    st.id = "panel-h-style";
    st.textContent = ".panel-h{margin:10px 0 4px;color:var(--ink,#e8e2d6)}" +
      ".panel-h1{font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-top:1px solid rgba(255,255,255,.18);padding-top:8px;font-weight:700}" +
      ".panel-h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;padding-left:4px;font-weight:600}" +
      ".panel-h3{font-size:11px;opacity:.8;padding-left:10px;font-weight:600}" +
      ".panel-h4{font-size:10.5px;opacity:.7;padding-left:16px;font-style:italic}";
    document.head.appendChild(st);
  }
}
map.on("load", () => setTimeout(arrangePanel, 0));
'''
once('map.on("load", buildLegend);', 'map.on("load", buildLegend);\n\n' + ORDER)

TESTS = r'''
console.log("\nthe layers box, in the chosen order");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return { PANEL_ORDER, PANEL_REMOVED };")();
  const ids = order.PANEL_ORDER.filter((x) => typeof x === "string" && !x.startsWith("group:") && x !== "gm");
  check("every id in the order is a real layer", ids.every((id) => new RegExp(`id: ?"${id}"`).test(src)),
        ids.filter((id) => !new RegExp(`id: ?"${id}"`).test(src)).join(", "));
  check("no layer is placed twice", new Set(ids).size === ids.length);
  check("nothing is both placed and removed", ids.every((id) => !order.PANEL_REMOVED.has(id)));
  const heads = order.PANEL_ORDER.filter((x) => typeof x === "object" && x.h === 1).map((x) => x.t);
  check("the three sections come first, in order", heads.slice(0, 3).join("|") === "On-planet invasion|Destruction|Suppression");
  check("unplaced layers get their own heading, not the bin", /heading\(1, "Not yet placed"\)/.test(src));
  check("removed rows stay findable by the code", /gone\.hidden = true/.test(src));
  check("the Trase row no longer shares an id", (src.match(/id: ?"trase"/g) || []).length === 1);
  const esc = (s) => String(s);
  const umapText = new Function("escapeHtml", src.slice(src.indexOf("function umapText("), src.indexOf("// A uMap popup template")) + "; return umapText;")(esc);
  const umapPopup = new Function("umapText", src.slice(src.indexOf("function umapPopup("), src.indexOf("async function readUmap(")) + "; return umapPopup;")(umapText);
  const h = umapPopup("# {name}\n*{address}*\n\n{sector}\n\n{description}", { name: "Shell", address: "Belvedere Rd", sector: "Oil", description: "HQ" });
  check("a uMap box follows the map's own template", h.includes("<h3") && h.includes("Shell") && h.includes("<i>Belvedere Rd</i>") && h.includes("Oil"));
  check("uMap layers are found where the map says they are", /props\.urls && \(props\.urls\.datalayer_view/.test(src));
  check("My Maps places given only as an address are placed from the weekly lookup, and say so",
        /geocode_\$\{mid\}\.json/.test(src) && /Position found from its address/.test(src));
  check("an ArcGIS request gives up rather than hanging", /no answer in \$\{Math\.round\(ms \/ 1000\)\} s/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Layers box arranged; uMap and ArcGIS fixed. Test with: node map/test.mjs")
