#!/usr/bin/env python3
"""
Every remaining outside page from the site's pages whose data cannot be read
directly (charts, dashboards, reports and maps that publish no data address) is
now a row that opens the page itself, whole, in the panel along the bottom of
the screen, as the site's own pages show it. Only one panel is open at a time.
Each sits under its heading:

  Control of physical resources  CFR Global Monetary Policy Tracker; the second
                                  Tableau dashboard; Troutwood; Energy Charter
                                  Treaty's Dirty Secrets; Global ISDS Tracker
  School                          Giga school connectivity map
  Plastics                        PIRG plastic production; Break Free From Plastic
                                  brand audit 2023; Global Plastic Watch
  Toxic pollution                 EPA emissions widget; Environmental Integrity
                                  state emissions inventory; HydroFATE
  Culprits upstream               Banking on Climate Chaos (Emissions); Deforestation
                                  Free Funds (Deforestation); Fortune Global 500,
                                  They Rule, Portfolio Earth's two campaigns, the
                                  Power BI report, the Scribd document (Generally)
  Oceans                          SkyTruth Monitor; its vessels of concern
  Off-planet invasion             When Rockets Fly; Next Spaceflight launches and
                                  launch sites; ESA's near-Earth-object risk list
  Not yet placed                  ACGF; Global Safety Net country rankings

Each can be replaced by a drawn layer later, where its data can be read.

Run from the repo root:  python3 patch_companions.py
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if 'id: "cfr_tracker"' in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


PAGES = [
    # id, name, page, where (anchor in the layers order), kind
    ("cfr_tracker", "CFR Global Monetary Policy Tracker (Tableau)", "https://public.tableau.com/views/CFRGlobalMonetaryPolicyTrackerNEW/GlobalMonetaryPolicyTracker?:showVizHome=no&:embed=y", "cpr", ("human", "upstream")),
    ("tableau_zsf", "Tableau dashboard (Suppression page)", "https://public.tableau.com/shared/ZSF724HPQ?:showVizHome=no&:embed=y", "cpr", ("human", "upstream")),
    ("troutwood", "Troutwood map", "https://map.troutwood.com/", "cpr", ("human", "upstream")),
    ("ect_secrets", "Energy Charter Treaty's Dirty Secrets", "https://energy-charter-dirty-secrets.org/", "cpr", ("human", "upstream")),
    ("isds_tracker", "Global ISDS Tracker", "https://www.globalisdstracker.org/database/", "cpr", ("human", "upstream")),
    ("giga_schools", "Giga: school connectivity map", "https://maps.giga.global/map", "school", ("human", "upstream")),
    ("pirg_plastic", "Where is plastic produced? (PIRG)", "https://pirg.org/resources/where-is-plastic-produced/", "plastics", ("insentient", "upstream")),
    ("bffp_audit", "Break Free From Plastic brand audit 2023", "https://brandaudit.breakfreefromplastic.org/brand-audit-2023/", "plastics", ("insentient", "upstream")),
    ("gpw_map", "Global Plastic Watch", "https://globalplasticwatch.org/map", "plastics", ("insentient", "downstream")),
    ("epa_widget", "EPA emissions widget", "https://www.epa.gov/sites/production/files/widgets/ef-multisystem.html", "toxic", ("insentient", "downstream")),
    ("eip_inventory", "Environmental Integrity Project: state emissions inventory", "https://environmentalintegrity.org/state-emissions-inventory/", "toxic", ("insentient", "downstream")),
    ("hydrofate", "HydroFATE map", "https://hydrofate.org/map/", "toxic", ("insentient", "downstream")),
    ("bocc", "Banking on Climate Chaos", "https://www.bankingonclimatechaos.org/?bank=JPMorgan%20Chase#fulldata-panel", "emissions", ("human", "upstream")),
    ("dff", "Deforestation Free Funds", "https://deforestationfreefunds.org", "defor", ("plant", "upstream")),
    ("fortune500", "Fortune Global 500 (2024)", "https://interactives.fortune.com/global_500_2024/dashboard/index.html", "generally", ("human", "upstream")),
    ("theyrule", "They Rule", "https://theyrule.net/", "generally", ("human", "upstream")),
    ("pe_bankrolling", "Portfolio Earth: Bankrolling Extinction", "https://portfolio.earth/campaigns/bankrolling-extinction/", "generally", ("animal", "upstream")),
    ("pe_subsidising", "Portfolio Earth: Subsidising Extinction", "https://portfolio.earth/campaigns/subsidising-extinction/", "generally", ("animal", "upstream")),
    ("powerbi_report", "Power BI report (Destruction page)", "https://app.powerbi.com/view?r=eyJrIjoiZGJmNGIwODgtMTgyMS00NmVlLWJmNWUtZTAzZDBlMmQ1ODI2IiwidCI6IjBiMzNkZjAwLTYzNGMtNDBlYy1iOGQ5LTZhMGI2MjYyNmU1ZCJ9", "generally", ("human", "upstream")),
    ("scribd_doc", "Scribd document (Destruction page)", "https://www.scribd.com/embeds/401203705/content?start_page=1&view_mode=scroll&access_key=key-9NzI5oK8PppZP3Bfluct", "generally", ("human", "upstream")),
    ("skytruth_monitor", "SkyTruth Monitor", "https://monitor.skytruth.org/", "oceans", ("animal", "downstream")),
    ("skytruth_voc", "SkyTruth Monitor: vessels of concern", "https://monitor.skytruth.org/issue/vessels-of-concern", "oceans", ("animal", "downstream")),
    ("wrf", "When Rockets Fly", "https://whenrocketsfly.com/", "offplanet", ("insentient", "upstream")),
    ("nsf_launches", "Next Spaceflight: launches", "https://nextspaceflight.com/launches/", "offplanet", ("insentient", "upstream")),
    ("nsf_locations", "Next Spaceflight: launch sites", "https://nextspaceflight.com/locations/", "offplanet", ("insentient", "upstream")),
    ("esa_risk", "ESA near-Earth-object risk list", "https://neo.ssa.esa.int/risk-list-plots", "offplanet", ("insentient", "downstream")),
    ("acgf", "ACGF", "https://acgf.org/index.htm", None, ("human", "upstream")),
    ("gsn_rankings", "Global Safety Net: country rankings", "https://www.globalsafetynet.app/rankings/", None, ("plant", "downstream")),
]
ANCHORS = {
    "cpr": '"owid_aid", "rte_trade",',
    "school": '{ h: 5, t: "School" },',
    "plastics": '{ h: 3, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch",',
    "toxic": '{ h: 3, t: "Toxic pollution" }, "epa_tri", "epa_tri_sites",',
    "emissions": '{ h: 4, t: "Emissions" }, "carbon_majors", "soy_organizations", "fractracker_refineries",',
    "defor": '{ h: 4, t: "Deforestation" }, "site_forest500_soy", "site_soybean_companies",',
    "generally": '{ h: 4, t: "Generally" }, "wreckers_umap",',
    "oceans": '"cerulean_sources", "allen_coral",',
    "offplanet": '"space_industry", "ll2_pads", "ll2_upcoming",',
}
rows = "".join(f'''    {{ id: "{i}", name: {json.dumps(n)}, unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: {json.dumps(p)},
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." }},
''' for i, n, p, _w, _k in PAGES)
once('''    { id: "wreckers_umap",''', rows + '''    { id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n' +
     "".join(f'  {i}: ["{a}", "{b}"],\n' for i, _n, _p, _w, (a, b) in PAGES))
for key, anchor in ANCHORS.items():
    ids = [i for i, _n, _p, w, _k in PAGES if w == key]
    listed = ", ".join(f'"{i}"' for i in ids) + ","
    # Before the Control of physical resources rows that later patches extend; after the others.
    once(anchor, listed + " " + anchor if key == "cpr" else anchor + " " + listed)

# The Live Projects panel follows this map; outside pages do not.
once('''      page: "https://welcometoyourgalaxy.github.io/local-map/",''', '''      page: "https://welcometoyourgalaxy.github.io/local-map/", follow: true,''')
once("""  if (!c || c.el.hidden || !c.follow.checked) return;""", """  if (!c || c.el.hidden || !c.follow || !c.follow.checked) return;""")
once("""      `<label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" checked> follow this map</label>` +""",
     """      (cfg.follow ? `<label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" checked> follow this map</label>`
        : `<span style="font-size:11.5px">If this stays blank, the site does not allow being shown inside another page: use open \\u2197</span>`) +""")
once("""    c = { el, frame, follow: el.querySelector("input") };""", """    c = { el, frame, follow: el.querySelector("input[type=checkbox]") };""")
once("""    c.follow.addEventListener("change", () => companionSync(cfg));""", """    if (c.follow) c.follow.addEventListener("change", () => companionSync(cfg));""")
once("""  if (comp) { comp.el.hidden = vis !== "visible"; if (vis === "visible") companionSync(childById(id) || cfg); }""",
     """  if (comp) {
    comp.el.hidden = vis !== "visible";
    if (vis === "visible") {
      // One panel at a time: opening one closes any other.
      for (const [oid, oc] of companions) {
        if (oid === id || oc.el.hidden) continue;
        const cb = document.querySelector(`[data-layer="${oid}"]`);
        if (cb && cb.checked) { cb.checked = false; cb.dispatchEvent(new Event("change", { bubbles: true })); }
        else oc.el.hidden = true;
      }
      companionSync(childById(id) || cfg);
    }
  }""")

TESTS = r'''
console.log("\noutside pages whole, in the panel");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("every remaining outside page is a row", ["cfr_tracker", "giga_schools", "bocc", "theyrule", "skytruth_voc", "esa_risk", "gsn_rankings"].every((i) => new RegExp(`id: "${i}"`).test(src)));
  check("only the site's own map follows this one", (src.match(/follow: true/g) || []).length === 1 && /cfg\.follow \?/.test(src));
  check("one panel at a time", /One panel at a time/.test(src));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  check("each sits under its heading", order.indexOf("bocc") > order.findIndex((x) => x && x.t === "Emissions") && order.indexOf("esa_risk") > order.findIndex((x) => x && x.t === "Off-planet invasion"));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Outside pages added. Test with: node map/test.mjs")
