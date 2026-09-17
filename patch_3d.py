#!/usr/bin/env python3
"""
Terrain, crisper emitting assets, and every layer sorted two ways.

- 3D terrain: a tick box in the settings box drapes the imagery over real
  elevation (AWS Terrain Tiles, Mapzen's terrarium encoding, no key needed) and
  tilts the camera so it reads. It says what it is: ground height only, no
  buildings, and it tells above zoom 8.
- The Climate TRACE circles are sharp again at world view. The softening I put
  on them last time was a blur, which is what made them smear together; they
  are small, hard-edged and thinly outlined instead.
- Every layer carries two labels. Whose world it is about — human, animal,
  plant, microorganism or insentient — and where it sits in the chain: upstream
  (the deciding, owning, financing and permitting) or downstream (where it
  lands). Two rows of chips at the top of the layer list narrow the list to
  them; nothing is switched off by narrowing, only hidden from the list.

Edits map/app.js, map/index.html and map/test.mjs.

Run from the repo root:  python3 patch_3d.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX = (ROOT / "map" / n for n in ("app.js", "test.mjs", "index.html"))
app, test, index = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX))

if "LAYER_KIND" in app:
    sys.exit("app.js already has this — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- crisp again

app = once(app, """      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 0, .5, 5, 1],
      "circle-blur": ["interpolate", ["linear"], ["zoom"], 0, .35, 5, 0],
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 0, .34, 3, .45, 6, .55],""",
"""      // Hard edges. The soft edge tried here before was a blur, and a field of
      // blurred discs is exactly the smear it was meant to avoid: small, sharp
      // and thinly outlined reads as many marks, not one cloud.
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 0, .6, 5, 1],
      "circle-blur": 0,
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 0, .3, 3, .42, 6, .55],""", "map/app.js")

# ---------------------------------------------------------------- terrain

TERRAIN = r'''
/* ---------- 3D terrain ---------- */

// Ground height, draped under the imagery. Mapzen's terrarium tiles on AWS
// need no key and are served to any origin; they are elevation of the ground,
// not buildings, and below about zoom 8 the whole planet is smooth enough that
// the tilt is all you see.
const TERRAIN_SOURCE = {
  type: "raster-dem",
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  encoding: "terrarium", tileSize: 256, maxzoom: 15,
  attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a>',
};
const TERRAIN_EXAGGERATION = 1.4;
let TERRAIN_ON = false;

function setTerrain(on) {
  TERRAIN_ON = !!on;
  if (typeof map.setTerrain !== "function") return;
  if (TERRAIN_ON) {
    if (!map.getSource("terrain-dem")) map.addSource("terrain-dem", TERRAIN_SOURCE);
    map.setTerrain({ source: "terrain-dem", exaggeration: TERRAIN_EXAGGERATION });
    // Flat on, height says nothing: the camera leans over so the ground reads.
    if (typeof map.easeTo === "function" && map.getPitch && map.getPitch() < 25) {
      map.easeTo({ pitch: 55, duration: 700 });
    }
  } else {
    map.setTerrain(null);
    if (typeof map.easeTo === "function" && map.getPitch && map.getPitch() > 0) {
      map.easeTo({ pitch: 0, duration: 500 });
    }
  }
  const box = document.getElementById("terrain-toggle");
  if (box) box.checked = TERRAIN_ON;
}
'''
app = once(app, "\nfunction viewPanelHtml() {", TERRAIN + "\nfunction viewPanelHtml() {", "map/app.js")

app = once(app, """    `<p class="bm-h">Basemap</p>`;
}""", """    `<label class="layer"><input type="checkbox" id="terrain-toggle"${TERRAIN_ON ? " checked" : ""}>` +
    `<span class="nm">3D terrain</span></label>` +
    `<p class="bm-h">Basemap</p>`;
}""", "map/app.js")

app = once(app, """    if (e.target && e.target.name === "view") setView(e.target.value);""",
           """    if (e.target && e.target.name === "view") setView(e.target.value);
    if (e.target && e.target.id === "terrain-toggle") setTerrain(e.target.checked);""", "map/app.js")

# ---------------------------------------------------------------- whose world, and where in the chain

KINDS = r'''
/* ---------- two labels on every layer ---------- */

// Whose world the layer is about, and where it sits in the chain. Upstream is
// the deciding, owning, financing, permitting and supplying; downstream is
// where it lands. A layer with no entry falls to the prefix rules below, and
// anything still unlabelled shows whatever the chips say.
const LAYER_KIND = {
  owid_co2: ["insentient", "upstream"],
  climate_trace: ["insentient", "upstream"],
  gem_coal: ["insentient", "upstream"],
  global_energy_monitor: ["insentient", "upstream"],
  carbon_bombs: ["insentient", "upstream"],
  power_plants: ["insentient", "upstream"],
  carbon_majors: ["insentient", "upstream"],
  fertilizer_facilities: ["insentient", "upstream"],
  soy_organizations: ["plant", "upstream"],
  trase: ["plant", "upstream"],
  land_matrix: ["human", "upstream"],
  counterglow: ["animal", "downstream"],
  epa_tri: ["insentient", "downstream"],
  epa_tri_sites: ["insentient", "downstream"],
  gfw: ["plant", "downstream"],
  gfw_dist: ["plant", "downstream"],
  gfw_dist_year: ["plant", "downstream"],
  fishing: ["animal", "downstream"],
  local_projects: ["human", "upstream"],
  gmo_releases: ["plant", "upstream"],
  slavery_sites: ["human", "downstream"],
  slavery_ports: ["human", "downstream"],
  slavery_fishing: ["human", "downstream"],
  slavery_cases: ["human", "downstream"],
  slavery_prevalence: ["human", "downstream"],
  slavery_routes: ["human", "downstream"],
  slavery_determinations: ["human", "downstream"],
  slavery_enforcement: ["human", "downstream"],
  slavery_facilities: ["human", "upstream"],
  slavery_trackers: ["human", "upstream"],
  remains_records: ["human", "downstream"],
  remains_findings: ["human", "downstream"],
  remains_cemeteries: ["human", "downstream"],
  abattoir_facilities: ["animal", "downstream"],
  cultivated_meat_laws: ["animal", "upstream"],
  cerulean_slicks: ["insentient", "downstream"],
  cerulean_sources: ["insentient", "upstream"],
  allen_coral: ["animal", "downstream"],
  site_animal_sacrifice: ["animal", "downstream"],
  site_animal_fighting: ["animal", "downstream"],
  site_animal_tourism: ["animal", "downstream"],
  site_circus: ["animal", "downstream"],
  site_animal_racing: ["animal", "downstream"],
  site_rodeo: ["animal", "downstream"],
  site_carbon_mapper_waste: ["insentient", "downstream"],
  site_forest500_soy: ["plant", "upstream"],
  site_china_grain: ["plant", "upstream"],
  site_soybean_companies: ["plant", "upstream"],
  site_food_system: ["human", "upstream"],
  site_secret_societies: ["human", "upstream"],
  site_ufo_pre1900: ["human", "downstream"],
  site_central_banks: ["human", "upstream"],
  site_banking_dynasties: ["human", "upstream"],
  site_export_credit: ["human", "upstream"],
  site_export_credit_shading: ["human", "upstream"],
  site_wealth_atlas: ["human", "upstream"],
  site_world_advertising: ["human", "upstream"],
  site_world_news: ["human", "upstream"],
  site_world_entertainment: ["human", "upstream"],
  site_research_integrity: ["human", "upstream"],
  site_eyes_network: ["human", "upstream"],
  site_earmarked_funding: ["human", "upstream"],
  site_trade_profits: ["human", "upstream"],
  site_social_spheres: ["human", "upstream"],
  site_cartel_cells: ["human", "upstream"],
  site_environment_law: ["human", "upstream"],
  site_environment_law_shapes: ["human", "upstream"],
  enviro_law_by_country: ["human", "upstream"],
  site_settler_colonialism: ["human", "downstream"],
  site_subsistence_cultures: ["human", "downstream"],
  site_self_sufficiency: ["human", "downstream"],
  site_enslaved_plants: ["plant", "downstream"],
  site_enslaved_microbes: ["microorganism", "downstream"],
  site_insentient: ["insentient", "downstream"],
  gov_official_map: ["human", "upstream"],
  capture_map: ["human", "upstream"],
  gmo_cultivation: ["plant", "downstream"],
  gmo_trials: ["plant", "downstream"],
  gmo_incidents: ["plant", "downstream"],
  gmo_gmofree: ["plant", "upstream"],
  gmo_regime: ["plant", "upstream"],
  gmo_treaties: ["plant", "upstream"],
  legal_prison: ["human", "downstream"],
  legal_juvenile: ["human", "downstream"],
  legal_immigration: ["human", "downstream"],
  exec_prison: ["human", "downstream"],
  jud_prisons: ["human", "downstream"],
  activist_prisons: ["human", "downstream"],
};

// Whole families of layers share a label: every office, court and ministry is
// human and upstream; every Climate TRACE asset is insentient and upstream.
const KIND_PREFIXES = [
  ["climate_trace", ["insentient", "upstream"]],
  ["exec_", ["human", "upstream"]],
  ["fin_", ["human", "upstream"]],
  ["legal_", ["human", "upstream"]],
  ["leg_", ["human", "upstream"]],
  ["jud", ["human", "upstream"]],
  ["activist_", ["human", "upstream"]],
  ["gmo_", ["plant", "upstream"]],
  ["slavery_", ["human", "downstream"]],
  ["remains_", ["human", "downstream"]],
  ["site_", ["human", "upstream"]],
];

function kindOf(id) {
  if (LAYER_KIND[id]) return LAYER_KIND[id];
  for (const [p, v] of KIND_PREFIXES) if (String(id).startsWith(p)) return v;
  return [null, null];
}

const KIND_NAMES = ["human", "animal", "plant", "microorganism", "insentient"];
const FLOW_NAMES = ["upstream", "downstream"];
const kindPicked = new Set();
const flowPicked = new Set();

function kindChipsHtml() {
  const chip = (v, on) => `<button type="button" class="chip${on ? " on" : ""}" data-kind="${v}">${v}</button>`;
  return `<div class="kinds">` +
    `<p class="bm-h">Whose world</p><div class="facet">` +
    KIND_NAMES.map((k) => chip(k, kindPicked.has(k))).join("") + `</div>` +
    `<p class="bm-h">Where in the chain</p><div class="facet">` +
    FLOW_NAMES.map((k) => chip(k, flowPicked.has(k))).join("") + `</div></div>`;
}

// Narrowing hides rows from the list. It never switches a layer off: a layer
// that is drawing stays drawn, and comes back into the list when the chips are
// cleared.
function applyKindFilter() {
  const box = document.getElementById("layers");
  if (!box || !box.querySelectorAll) return;
  const wanted = (id) => {
    const [kind, flow] = kindOf(id);
    if (kindPicked.size && (!kind || !kindPicked.has(kind))) return false;
    if (flowPicked.size && (!flow || !flowPicked.has(flow))) return false;
    return true;
  };
  for (const input of box.querySelectorAll("[data-layer]")) {
    const row = input.closest ? input.closest("label") : null;
    if (row && row.style) row.style.display = wanted(input.dataset.layer) ? "" : "none";
  }
  for (const row of box.querySelectorAll(".facet[data-for]")) {
    if (row.style) row.style.display = wanted(row.dataset.for) ? "" : "none";
  }
  for (const group of box.querySelectorAll(".group")) {
    const kids = group.querySelectorAll ? [...group.querySelectorAll("[data-layer]")] : [];
    const any = kids.some((i) => wanted(i.dataset.layer));
    if (group.style) group.style.display = kids.length && !any ? "none" : "";
  }
}
'''
app = once(app, "\nfunction buildPanel() {", KINDS + "\nfunction buildPanel() {", "map/app.js")

app = once(app, """function buildPanel() {
  const box = document.getElementById("layers");
""", """function buildPanel() {
  const box = document.getElementById("layers");
  const chips = document.createElement("div");
  chips.innerHTML = kindChipsHtml();
  box.appendChild(chips);
  chips.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-kind]");
    if (!b) return;
    const v = b.dataset.kind;
    const set = KIND_NAMES.includes(v) ? kindPicked : flowPicked;
    if (set.has(v)) set.delete(v); else set.add(v);
    if (b.classList) b.classList.toggle("on", set.has(v));
    applyKindFilter();
  });
""", "map/app.js")

app = once(app, """  const pending = LAYERS.filter((c) => !c.ready);""",
           """  applyKindFilter();

  const pending = LAYERS.filter((c) => !c.ready);""", "map/app.js")

index = once(index, """  .facet{display:flex;flex-wrap:wrap;gap:4px;padding:0 0 9px 27px}""",
             """  .kinds{padding:0 0 6px;border-bottom:1px solid var(--rule);margin-bottom:6px}
  .kinds .facet{padding:0 0 6px}
  .kinds .bm-h{margin:4px 0 3px}
  .facet{display:flex;flex-wrap:wrap;gap:4px;padding:0 0 9px 27px}""", "map/index.html")

# ---------------------------------------------------------------- tests

TESTS = r'''
console.log("\nterrain, and the two labels");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("terrain comes from a keyless elevation source",
        /elevation-tiles-prod\/terrarium/.test(src) && /encoding: "terrarium"/.test(src) &&
        !/key=|api_key|access_token/.test(src.slice(src.indexOf("TERRAIN_SOURCE"), src.indexOf("TERRAIN_EXAGGERATION"))));
  check("switching it on sets terrain and leans the camera over",
        /map\.setTerrain\(\{ source: "terrain-dem"/.test(src) && /pitch: 55/.test(src) &&
        /map\.setTerrain\(null\)/.test(src));
  check("the settings box carries the tick box", /id="terrain-toggle"/.test(src) &&
        /e\.target\.id === "terrain-toggle"/.test(src));
  check("nothing about the emitting assets is blurred", /"circle-blur": 0,/.test(src) &&
        !/"circle-blur": \["interpolate"/.test(src));

  const kinds = new Function(src.match(/const LAYER_KIND = \{[\s\S]*?\n\};\n/)[0] +
                             src.match(/const KIND_PREFIXES = \[[\s\S]*?\n\];\n/)[0] +
                             src.match(/function kindOf[\s\S]*?\n}\n/)[0] +
                             "; return { kindOf, LAYER_KIND };")();
  const ids = [...new Set([...src.matchAll(/\{ *id: *"([a-z0-9_]+)", *name/g)].map((m) => m[1])
    .concat([...src.matchAll(/\{ id:"([a-z0-9_]+)", *name/g)].map((m) => m[1])))];
  const unlabelled = ids.filter((id) => !kinds.kindOf(id)[0]);
  check("every layer carries both labels", unlabelled.length === 0, unlabelled.slice(0, 6).join(", "));
  const names = ["human", "animal", "plant", "microorganism", "insentient"];
  check("the labels are the five worlds and the two directions",
        ids.every((id) => names.includes(kinds.kindOf(id)[0]) &&
                          ["upstream", "downstream"].includes(kinds.kindOf(id)[1])));
  check("the animals are with the animals", kinds.kindOf("abattoir_facilities")[0] === "animal" &&
        kinds.kindOf("allen_coral")[0] === "animal" && kinds.kindOf("site_circus")[0] === "animal");
  check("the plants and the microorganisms have their own",
        kinds.kindOf("site_enslaved_plants")[0] === "plant" &&
        kinds.kindOf("site_enslaved_microbes")[0] === "microorganism" &&
        kinds.kindOf("gfw")[0] === "plant");
  check("finance and permitting are upstream, the sites where it lands are downstream",
        kinds.kindOf("site_export_credit")[1] === "upstream" && kinds.kindOf("carbon_majors")[1] === "upstream" &&
        kinds.kindOf("slavery_cases")[1] === "downstream" && kinds.kindOf("epa_tri")[1] === "downstream");
  check("the chips narrow the list without switching anything off",
        /function applyKindFilter/.test(src) && /row\.style\.display = wanted/.test(src) &&
        /\.facet\[data-for\]/.test(src) &&
        !/applyKindFilter[\s\S]{0,400}setLayoutProperty/.test(src) && /\.kinds \.facet\{padding:0 0 6px\}/.test(index));
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

test = test.replace('''  check("aggregate circles are fainter and softer at world view",
        /"circle-blur": \\["interpolate", \\["linear"\\], \\["zoom"\\], 0, \\.35/.test(src) &&
        /0,  \\["\\*", 0\\.18 \\* scale, MAGNITUDE_RADIUS\\]/.test(src));''',
'''  check("aggregate circles are small and sharp at world view",
        /"circle-blur": 0,/.test(src) && /0,  \\["\\*", 0\\.18 \\* scale, MAGNITUDE_RADIUS\\]/.test(src));''')

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
print("3D terrain added; emitting assets sharp again; every layer labelled by world and by direction.")
