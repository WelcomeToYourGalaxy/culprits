if (window.__culpritsLoaded) {
  console.warn("[culprits] app.js ran twice — index.html is probably still " +
               "carrying the old inline <script> as well as <script src>. " +
               "Ignoring the second run; layers would otherwise be duplicated " +
               "and only one copy would answer the toggles.");
} else {
  window.__culpritsLoaded = true;

// Where the map stops summarising and starts listing individual culprits.
// Must match CLUSTER_MAXZOOM in pipeline/build_tiles.sh.
const CLUSTER_MAXZOOM = 8;

// Archives live wherever they fit: under 100 MB in the repo, larger ones in R2.
// Both serve HTTP range requests, so the map treats them identically.
const abs = (p) => new URL(p, document.baseURI).href;
const TILE_BASE = abs("./tiles");
const DATA_BASE = abs("./data");
const R2_BASE = "https://tiles.welcometoyourgalaxy.com";
const WORKER = "https://culprits-proxy.welcometoyourgalaxy.workers.dev/v1";

// Read through the Worker. api.carbonmapper.org answers a plain browser GET
// with 200 and no Access-Control-Allow-Origin, so the response is refused
// before the map sees a status and the row read "Failed to fetch". The
// Worker passes the catalogue back untouched with its own CORS headers.
const CARBON_API = `${WORKER}/carbonmapper`;

// One entry per layer. `colour` carries identity only — magnitude is encoded
// per layer, because tonnes of CO2e and hectares of land are not comparable
// and a shared size ramp would imply that they are.
// Climate TRACE publishes monthly: 2021-01 through 2026-06, 66 periods, each
// source appearing once per month. Generated rather than listed so extending
// the range is one number.
const CT_MONTHS = (() => {
  const out = [];
  for (let y = 2021; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2026 && m > 6) break;
      out.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

// Climate TRACE history, as a group of per-year archives.
//
// One month tiles to about 95 MB and fits in the repo. Twelve months measured
// 1,132 MB with a 375 KB world tile — past GitHub's 100 MB file cap, and a
// world tile every visitor downloads before seeing anything. So the current
// month ships in the repo and the past ships per year, off by default, on R2.
//
// PER YEAR RATHER THAN ONE HISTORY FILE
// PMTiles fetches tiles by range request, but the header and index load per
// archive. One multi-gigabyte history makes every reader pay for an index
// spanning all years; per year they pay for the year they opened. An unticked
// year costs nothing, because the file is never requested. And a finished year
// is finished — 2024 never needs rebuilding.
//
// EMPTY UNTIL THE ARCHIVES EXIST
// Add "2024" here when culprits-tiles/climate_trace_2024.pmtiles is on R2, and
// the group appears. With no years the parent row is not rendered at all,
// rather than offering toggles that 404 — an archive-missing row reads as a
// broken map, which is the same reason unbuilt sources are named at the bottom
// instead of listed as dead checkboxes.
const CT_HISTORY_BASE = "https://tiles.welcometoyourgalaxy.com";
const CT_HISTORY_YEARS = [];

// Climate TRACE, split across three groups and three repos.
//
// One month is 1,696,198 features. As a single archive it tiled to ~475 MB,
// past GitHub's 100 MiB file cap; split by sector, agriculture (233 MB) and
// forestry (121 MB) were still over, so those two are split again by subsector.
// That yields 26 archives, none above 96 MiB.
//
// THREE REPOS, BECAUSE A PAGES SITE IS CAPPED AT 1 GB
// The six small sectors stay here (~345 MB). Agriculture's nine (~563 MB) and
// forestry's eleven (~523 MB) each get their own repo and their own Pages site.
// Verified before building on it: GitHub Pages returns
// access-control-allow-origin: * and accept-ranges: bytes, and answers a range
// request with 206 — which is all PMTiles needs. No object store, no account,
// no proxy in front of every tile.
//
// THREE GROUPS RATHER THAN ONE
// 26 checkboxes under a single parent is not a list anyone reads. Split into
// three siblings, each is scannable, and it states something true: at this
// granularity agriculture and forestry are their own subjects, not two entries
// in a sector list.
const CT_AG_BASE  = "https://welcometoyourgalaxy.github.io/culprits-tiles-ag";
const CT_FLU_BASE = "https://welcometoyourgalaxy.github.io/culprits-tiles-flu";

// Shared shape. `base` null means the archive is in this repo, so addPmtilesLayer
// resolves it against TILE_BASE as every other layer does.
// One colour per subsector, so two ticked at once stay apart. Earthy and
// muted; none orange or yellow.
const CT_COLOURS = {
  climate_trace_power: "#8F4E40", climate_trace_fossil_fuel_operations: "#6E5A6E",
  climate_trace_manufacturing: "#5F7480", climate_trace_transportation: "#6C7F63",
  climate_trace_buildings: "#8A7A6A", climate_trace_waste: "#6A5A4C",
  climate_trace_ag_enteric_fermentation_cattle_operation: "#7C8F5E",
  climate_trace_ag_manure_management_cattle_operation: "#5E8C7A",
  climate_trace_ag_enteric_fermentation_cattle_pasture: "#8A9A6E",
  climate_trace_ag_manure_left_on_pasture_cattle: "#4F6E5A",
  climate_trace_ag_manure_applied_to_soils: "#9A8E78",
  climate_trace_ag_synthetic_fertilizer_application: "#6E7E8A",
  climate_trace_ag_rice_cultivation: "#6A8A8A",
  climate_trace_ag_cropland_fires: "#8F5A4E",
  climate_trace_ag_crop_residues: "#5A6B4A",
  climate_trace_flu_forest_land_clearing: "#4E6A5E", climate_trace_flu_forest_land_degradation: "#6E8C6A",
  climate_trace_flu_forest_land_fires: "#8F5A4E", climate_trace_flu_shrubgrass_fires: "#9A6E5E",
  climate_trace_flu_wetland_fires: "#7E5A6A", climate_trace_flu_net_forest_land: "#3F5F55",
  climate_trace_flu_net_shrubgrass: "#7A7458", climate_trace_flu_net_wetland: "#5E7A70",
  climate_trace_flu_net_soil_organic_carbon: "#6A5A4C", climate_trace_flu_removals: "#5F7480",
  climate_trace_flu_water_reservoirs: "#6A7F90",
};

function ctChild(id, label, base) {
  return {
    id,
    name: label,
    unit: "t CO\u2082e/yr (GWP-100)",
    colour: CT_COLOURS[id] || "#8F4E40",
    // Drawn as fine, sharp points with a dark rim at world view: see FINE_PAINT.
    fine: true,
    route: "pmtiles",
    ready: true,
    lazy: true,
    archiveUrl: base ? `${base}/tiles/${id}.pmtiles` : null,
    // Learned from each archive's own metadata rather than from CT_MONTHS:
    // a month archive holds one month and the shared constant holds 66.
    facet: { property: "x_period", label: "month", values: [] },
  };
}

const CT_SECTORS = {
  id: "climate_trace_sectors",
  name: "Emitting sites by sector (Climate TRACE)",
  group: true,
  ready: true,
  children: [
    ["climate_trace_power", "power"],
    ["climate_trace_fossil_fuel_operations", "fossil fuel operations"],
    ["climate_trace_manufacturing", "manufacturing"],
    ["climate_trace_transportation", "transportation"],
    ["climate_trace_buildings", "buildings"],
    ["climate_trace_waste", "waste"],
  ].map(([id, label]) => ctChild(id, label, null)),
};

const CT_AGRICULTURE = {
  id: "climate_trace_agriculture",
  name: "Emissions from farming and land use (Climate TRACE)",
  group: true,
  ready: true,
  children: [
    ["climate_trace_ag_enteric_fermentation_cattle_operation", "enteric fermentation, cattle operations"],
    ["climate_trace_ag_manure_management_cattle_operation", "manure management, cattle operations"],
    ["climate_trace_ag_enteric_fermentation_cattle_pasture", "enteric fermentation, pasture"],
    ["climate_trace_ag_manure_left_on_pasture_cattle", "manure left on pasture"],
    ["climate_trace_ag_manure_applied_to_soils", "manure applied to soils"],
    ["climate_trace_ag_synthetic_fertilizer_application", "synthetic fertiliser"],
    ["climate_trace_ag_rice_cultivation", "rice cultivation"],
    ["climate_trace_ag_cropland_fires", "cropland fires"],
    ["climate_trace_ag_crop_residues", "crop residues"],
  ].map(([id, label]) => ctChild(id, label, CT_AG_BASE)),
};

const CT_FORESTRY = {
  id: "climate_trace_forestry",
  name: "Emissions from forestry and land clearing (Climate TRACE)",
  group: true,
  ready: true,
  children: [
    ["climate_trace_flu_forest_land_clearing", "forest land clearing"],
    ["climate_trace_flu_forest_land_degradation", "forest land degradation"],
    ["climate_trace_flu_forest_land_fires", "forest land fires"],
    ["climate_trace_flu_shrubgrass_fires", "shrub and grass fires"],
    ["climate_trace_flu_wetland_fires", "wetland fires"],
    ["climate_trace_flu_net_forest_land", "net forest land"],
    ["climate_trace_flu_net_shrubgrass", "net shrub and grass"],
    ["climate_trace_flu_net_wetland", "net wetland"],
    ["climate_trace_flu_net_soil_organic_carbon", "net soil organic carbon"],
    ["climate_trace_flu_removals", "removals"],
    ["climate_trace_flu_water_reservoirs", "water reservoirs"],
  ].map(([id, label]) => ctChild(id, label, CT_FLU_BASE)),
};

const CT_HISTORY = {
  id: "ct_history",
  name: "Emitting sites in past years (Climate TRACE)",
  group: true,
  ready: true,
  children: CT_HISTORY_YEARS.map((y) => ({
    id: `climate_trace_${y}`,
    name: String(y),
    unit: "t CO\u2082e/yr (GWP-100)",
    colour: "#8F4E40",
    route: "pmtiles",
    ready: true,
    // Not created at load. The source and its layers are added the first time
    // the box is ticked, so ten unopened years cost ten zero requests.
    lazy: true,
    archiveUrl: `${CT_HISTORY_BASE}/climate_trace_${y}.pmtiles`,
    // Months come from the archive's own metadata, not from CT_MONTHS. A year
    // archive holds twelve months and the shared constant holds sixty-six, so
    // using the constant would offer fifty-four months that render nothing.
    facet: { property: "x_period", label: "month", values: [] },
    note: `Climate TRACE emissions for ${y}, monthly.`,
  })),
};

const LAYERS = [
  { id:"owid_co2",             name:"National CO₂ emissions (Our World in Data)", unit:"Mt CO₂/yr", colour:"#8A5750", route:"country", ready:true, off:true },
  // Every row is ONE MONTH for one source, not one facility: 2021-01 through
  // 2026-06, 66 rows per source, confirmed from the harvest. Without a facet
  // the map stacks 66 coincident dots on every facility and the popup shows
  // one arbitrary month with no date on it.
  //
  // A facet rather than a cut: nothing is dropped, and the reader can see and
  // change which month they are looking at. Defaults to the latest so the map
  // opens showing one dot per facility.
  // Everything Climate TRACE locates, confined animal facilities included —
  // this is the complete emissions layer and nothing is held back from it.
  { id:"climate_trace",        name:"Emitting assets",         unit:"t CO₂e/yr (GWP-100)", colour:"#8F4E40", route:"pmtiles", ready:false,
    radiusScale: 0.55,
    facet: { property: "x_period", label: "month", values: CT_MONTHS,
             // One month selected on load. Every other month is one click away.
             defaultValues: [CT_MONTHS[CT_MONTHS.length - 1]] },
    note: "Monthly, 2021-01 to 2026-06. One month is shown at a time — pick others in the panel." },

  { id:"gem_coal",             name:"Coal plant units (Global Energy Monitor, Global Coal Plant Tracker)",        unit:"MW capacity", colour:"#7A5548", route:"pmtiles", ready:true, off: true,
    radiusScale: 0.55,
    facet: { property: "x_status", label: "status",
             values: ["operating","construction","permitted","pre-permit","announced",
                      "shelved","mothballed","retired","cancelled"] } },
  { id:"global_energy_monitor",name:"GEM's other trackers",     unit:"capacity",   colour:"#7A5548", route:"pmtiles", ready:false },
  { id:"carbon_bombs",         name:"Carbon bombs",            unit:"Gt CO₂ lifetime", colour:"#6E4A44", route:"pmtiles", ready:true },
  { id:"power_plants",         name:"Power plants (WRI Global Power Plant Database)",            unit:"MW capacity", colour:"#7E5A4E", route:"pmtiles", ready:true, off: true,
    radiusScale: 0.55,
    // The source covers every fuel and nothing is filtered out of the data.
    // Filtering happens here instead, where it is visible and reversible.
    facet: { property: "x_fuel", label: "fuel",
             values: ["Coal","Gas","Oil","Petcoke","Nuclear","Hydro","Wind","Solar",
                      "Biomass","Waste","Geothermal","Storage","Cogeneration",
                      "Wave and Tidal","Other"] } },
  // The next three carry no harvester and no entry in sources.json: their data
  // came from the separate maps repo, and neither the archive nor a way to
  // rebuild it is in this repository. Listing them as live layers put a row in
  // the panel that always failed with "archive missing", which reads as a
  // broken map rather than an unbuilt source. ready:false names them once in
  // the unbuilt list instead, which is what the panel is for. Flip back to true
  // once map/tiles/<id>.pmtiles exists, or once a harvester is registered.
  { id:"carbon_majors",        name:"Carbon major HQs",        unit:"company headquarters", colour:"#7E6B8F", route:"pmtiles", ready:true, off: true,
    note: "From the Destruction page's Carbon Majors headquarters map (maps repo): the addresses written into that map." },
  { id:"fertilizer_facilities",name:"Fertilizer plants",       unit:"ammonia / urea", colour:"#8A7C5C", route:"pmtiles", ready:true, off: true },
  { id:"soy_organizations",    name:"Soy industry bodies",     unit:"trade organisations", colour:"#6F7F72", route:"pmtiles", ready:true, off: true },
  { id:"trase",                name:"Commodity supply chains", unit:"ha",         colour:"#62755F", route:"pmtiles", ready:false },
  { id:"land_matrix",          name:"Land deals (Land Matrix)",              unit:"hectares",   colour:"#6C7F63", route:"country", ready:true, off: true,  isolate:true },
  { id:"counterglow",          name:"Industrial animal farms", unit:"facilities", colour:"#7B7A5C", route:"pmtiles", ready:false },
  { id:"epa_tri",              name:"US toxic release sites",  unit:"TRI facilities", colour:"#5C6E77", route:"worker",  ready:true, off: true,
    // Upstream returns at most 500 rows per request, so a very large viewport
    // would show an arbitrary 500 rather than everything. Capped to keep what
    // is drawn honest rather than a truncated sample presented as complete.
    // Raised from 25 so sites appear roughly two zoom levels earlier. The cap
    // exists because upstream returns at most 500 rows, so a viewport wider
    // than this would show an arbitrary 500 presented as the whole picture.
    maxAreaDeg2: 100 },
  // The same facilities, harvested whole so they draw at every zoom.
  //
  // The live route above cannot show the country: Envirofacts will not serve a
  // continent in one request, so it sits behind an area cap and asks the reader
  // to zoom in. Both are kept — one is current to the minute inside a small
  // box, the other is complete and static — and they are separate rows so it is
  // never ambiguous which one a dot came from.
  //
  // ready:false until map/tiles/epa_tri_sites.pmtiles exists.
  { id:"epa_tri_sites",        name:"Factories reporting toxic chemical releases, US (EPA Toxics Release Inventory)", unit:"TRI facilities", colour:"#5C6E77", route:"pmtiles", ready:true, off: true,
    // One row: the whole copy at every zoom, and EPA's live answer drawn over it
    // once the view is small enough for EPA to send it.
    linked: ["epa_tri"],
    note: "Every TRI facility, at any zoom. Facilities only — this table lists sites, not quantities; release amounts are per chemical per year and live elsewhere. Facilities with no coordinate published are absent rather than placed at a state centroid." },      // Disabled pending GFW. Their raster query endpoint returns
  // 500 {"message":null} for every request tried, including GFW's own
  // documented example, on fully built dataset versions. Route, shaper, version
  // resolver and tests all stay — this is one flag to flip when it works.
  // Also a tile layer, and for the same reason as fishing. /query/json is an
  // analysis endpoint: it computes over one area of interest, which is why it
  // wants a tiny polygon and a date filter and still returned 500s. WRI runs a
  // separate tile service that GFW's own map renders from, and its integrated
  // alerts route needs no API key. Colour and confidence come from upstream:
  // alert_confidence=low means every alert published, filtered nowhere.
  // FAO's Gridded Livestock of the World, served as raster tiles from FAO's own

  // Three alert layers, not one, because they do not cover the same planet.
  //
  // "Integrated" combines GLAD-L, GLAD-S2 and RADD, and all three are
  // PAN-TROPICAL by design. That is why it lights up the Amazon, the Congo
  // basin and Southeast Asia and shows nothing in British Columbia, Sweden or
  // Siberia: not missing data, a stated extent. Anyone reading the map without
  // that stated would reasonably conclude the boreal forest is untouched.
  //
  // The two DIST layers are global vegetation-disturbance products, and they
  // are what shows clearing outside the tropics.
  //
  // They are kept separate rather than merged because they detect different
  // things by different instruments, and a reader who sees an alert should be
  // able to tell which one saw it.
  // Not a "worker" route any more, and not points.
  //
  // This used to query /v3/4wings/report per viewport and returned 429 on
  // almost every pan. That was not a pacing bug. GFW allows one concurrent
  // report per account, shared across everyone who opens this page, and a
  // report runs asynchronously for up to 100 seconds. Two readers at once
  // were already over the limit, so no amount of debouncing here could have
  // fixed it.
  //
  // The 4Wings tile endpoint has no report queue, and fishing effort is a
  // continuous field rather than a set of sites, so a heatmap says what the
  // data actually is. Attribution is required by GFW's terms of use.
  { id:"fishing",              name:"Hours spent fishing, tracked from vessel signals (Global Fishing Watch)", unit:"apparent fishing hours, 12 months", colour:"#A8707E", route:"tile", ready:true, off: true,
    tileMaxZoom: 12,
    attribution: '<a href="https://globalfishingwatch.org" target="_blank" rel="noopener">Powered by Global Fishing Watch</a>' },

  // ---- the other maps in this suite -------------------------------------
  //
  // Seven layers out of five repos in the WelcomeToYourGalaxy org. Their
  // harvesters are written and have been run against live data; what does not
  // exist yet is map/tiles/<id>.pmtiles, because the refresh workflow has not
  // built them. So they are ready:false — not because anything is missing, but
  // because ready:true with no archive puts a row in the panel reading
  // "archive missing", and that has been reported as a broken map three times.
  // Flip each to true once its archive lands.
  { id:"local_projects",       name:"Development projects",    unit:"acres, where the register states them", colour:"#6E7B84", route:"pmtiles", ready:true, off: true,
    isolate:true,
    note: "401,100 filings from 68 registers — mines, pipelines, LNG, offshore wind, and the environmental reviews that precede them. What is about to be built, at the point where it is still a filing." },
  { id:"gmo_releases",         name:"Genetic-engineering releases", unit:"authorisations", colour:"#7C6F84", route:"pmtiles", ready:true, off: true,
    facet: { property: "x_register", label: "register",
             values: ["US APHIS BRS","industry register",
                      "CBD Biosafety Clearing-House","clinical trial sponsor",
                      "Australia OGTR"] },
    note: "96% of these records carry no site coordinate. APHIS publishes the state a release was authorised in and never the field, so most draw hollow at a state centroid." },
  // The releases archive holds several different registers; each is its own
  // row here, drawn from the same archive with its own filter.
  { id:"gmo_env", sourceOf:"gmo_releases", name:"Engineered crops and trees released outdoors (US APHIS)", unit:"authorisations", colour:"#7C6F84", route:"pmtiles", ready:true, off: true,
    where: ["in", ["get", "id"], ["literal", ["aphis:epermits", "aphis:efile"]]],
    note: "US Department of Agriculture authorisations to release genetically engineered plants and trees into the environment. APHIS publishes the state, not the field, so most draw hollow at a state's centre." },
  { id:"gmo_decisions", sourceOf:"gmo_releases", name:"National biosafety decisions (CBD Biosafety Clearing-House)", unit:"decisions", colour:"#6F6A84", route:"pmtiles", ready:true, off: true,
    where: ["==", ["get", "id"], "bch:decision"] },
  { id:"gmo_ogtr", sourceOf:"gmo_releases", name:"Gene technology licences (Australia OGTR)", unit:"licences", colour:"#84707A", route:"pmtiles", ready:true, off: true,
    where: ["==", ["slice", ["get", "id"], 0, 4], "ogtr"] },
  { id:"gmo_therapy", sourceOf:"gmo_releases", name:"Gene and cell therapy trial sponsors", unit:"sponsors", colour:"#6E7484", route:"pmtiles", ready:true, off: true,
    where: ["==", ["get", "id"], "clinical:sponsor"] },
  { id:"gmo_fertility", sourceOf:"gmo_releases", name:"Fertility clinics (Assisted Reproduction)", unit:"clinics", colour:"#846F74", route:"pmtiles", ready:true, off: true,
    where: ["==", ["get", "id"], "industry:repro"] },
  { id:"gmo_animal_research", sourceOf:"gmo_releases", name:"Animal research facilities", unit:"facilities", colour:"#7A6A6A", route:"pmtiles", ready:true, off: true,
    where: ["all", ["==", ["get", "id"], "industry:animals"],
            ["in", ["get", "x_type"], ["literal", ["Animal Welfare Act research facility", "Accredited animal research organisation", "CCAC certified institution"]]]] },
  { id:"gmo_animal_trade", sourceOf:"gmo_releases", name:"Animal breeders, dealers, exhibitors and carriers (USDA Animal Welfare Act)", unit:"licensees", colour:"#74695E", route:"pmtiles", ready:true, off: true,
    where: ["all", ["==", ["get", "id"], "industry:animals"],
            ["!", ["in", ["get", "x_type"], ["literal", ["Animal Welfare Act research facility", "Accredited animal research organisation", "CCAC certified institution"]]]]] },
  { id:"hydrowaste",           name:"Wastewater treatment plants (HydroWASTE)", unit:"plants", colour:"#5E7278", route:"pmtiles", ready:true, off: true,
    note: "HydroWASTE v1.0: 58,502 wastewater treatment plants, with the population each serves, the treated wastewater it discharges, its level of treatment, its estimated outfall and the river's dilution there (Ehalt Macedo et al., Earth System Science Data 2022; CC BY 4.0). The database behind HydroFATE's map, whose own page cannot be read to draw here. Every column is kept." },
  { id:"slavery_sites",        name:"Brick kilns and artisanal mining", unit:"sites", colour:"#8A6B62", route:"pmtiles", ready:true, off: true,
    note: "Sector infrastructure, not confirmed exploitation. These are sites in sectors where forced and child labour concentrate; where IPIS actually observed it, the site says so." },
  { id:"slavery_ports",        name:"Ports with high-risk vessel calls", unit:"ports", colour:"#5F7480", route:"pmtiles", ready:true, off: true,
    note: "Scored on the share of calling fishing vessels flagged high-risk by a published behavioural model. A property of the calls, not of the port." },
  { id:"slavery_fishing",      name:"Ocean squares where forced-labour fishing is predicted (model, no vessel named)", unit:"model cells, 2.5\u00b0", colour:"#4E6A70", route:"pmtiles", ready:true, off: true,
    note: "Not vessels. The authors anonymised every hull, so each mark is a cell of ocean and identifies nobody." },
  { id:"remains_records",      name:"Unearthings and burial decisions", unit:"records", colour:"#6A6257", route:"pmtiles", ready:true, off: true,
    facet: { property: "x_posture", label: "direction",
             values: ["harm","watch","redress","unlawful"] },
    note: "This layer does not plot graves. Burial locations arrive blurred to about 5 km from the source and stay that way. Direction is separate from size: a large repatriation is a large event, not a bad one." },
  // From WelcomeToYourGalaxy/abattoir-atlas: its merged facility records, every
  // one, not the subset its own page draws. Share-alike (OSM rows and OSM-based
  // geocoding), so its archive is isolated, as local_projects is.
  { id:"abattoir_facilities",  name:"Registered animal-use facilities \u2014 slaughterhouses, farms, dairies, hatcheries and zoos (abattoir atlas)", unit:"facilities", colour:"#80605A", route:"pmtiles", ready:true, off: true,
    isolate:true,
    facet: { property: "x_slaughter", label: "slaughter",
             values: ["yes","no","not stated"],
             // The registry's three answers, in words. "yes" and "no" are a
             // registry's statement about the site, not a finding of ours, and
             // "not stated" is the commonest of the three: it means the
             // registry recorded the site without recording what it does.
             labels: { "yes": "registered to slaughter",
                       "no": "registered, does not slaughter",
                       "not stated": "registry does not say" } },
    note: "Most of these are not slaughterhouses: farms, dairies, processors, transporters, hatcheries and zoos are registered animal-use sites too. Slaughter is marked yes or no only where a registry says; for most it says neither. Hollow points are placed at a town, not the site. Records with no position at all are not drawn." },
  { id:"abattoir_cafo",        name:"Confined animal feeding operations, modelled (Climate TRACE)", unit:"modelled facilities", colour:"#7B6A4E", route:"cafo", ready:true, off: true, lazy:true,
    note: "A model's estimate from satellite imagery and census data, not a permit register: nothing here has necessarily been visited, licensed or confirmed by any authority. Hollow where Climate TRACE give an area rather than the facility's own position." },
  { id:"abattoir_glw",         name:"Livestock density, modelled (FAO Gridded Livestock of the World 4, 2020)", unit:"animals per square km", colour:"#6E6A55", route:"glw", ready:true, off: true, lazy:true,
    note: "A modelled grid of where animals are kept, not a count of farms. FAO fit census totals to land cover and other predictors, so a dense square means the model puts animals there." },
  { id:"slavery_cases",        name:"Identified trafficking cases", unit:"identified cases", colour:"#7A6A72", route:"country", ready:true, off:true,
    note: "Detection, not prevalence. A country with a large count has organisations filing records; a country with none may have no one counting." },

  // ---- polygon layers: Cerulean and Allen Coral ---------------------------
  //
  // Registered here rather than left out so the geometry, the caps and the
  // wording are settled while the API documentation is fresh. All three are
  // polygons, which is why addLiveLayer grew a fill/line branch. Each needs a
  // Worker route before ready can flip.
  // Straight from Cerulean's own vector tiles, not through the Worker, and not
  // an archive. Measured 15 September 2026 from the Commander's machine: the
  // server answers with CORS for this site and a one-hour cache, every
  // detection since January 2023 is served, and a tile off Durrës weighed
  // 21.4 MB with every field and 6.4 MB without centerlines (2.7 MB as the
  // browser downloads it). See CERULEAN below for the limits this works within.
  { id:"cerulean_slicks",      name:"Oil slicks (Cerulean)",   unit:"potential slicks, Sentinel-1", colour:"#5A5750", route:"cerulean", ready:true, off: true,
    collection: "public.slick_plus", drawFrom: 6,
    // Every slick as a point, below drawFrom: pipeline/cerulean/harvest_points.py.
    points: "cerulean_slick_points", pointsUntil: 6, pointsColour: "#8A9AA2", pointsCollection: "public.slick_plus",
    // Every field the collection publishes except centerlines — a skeleton of
    // each slick nested inside it, which the map cannot draw and which was
    // most of every tile's weight. Geometry columns are never sent as fields.
    // Read from /queryables, not from documentation. If SkyTruth add a field it
    // will not appear until it is added here.
    properties: ["id", "slick_timestamp", "machine_confidence", "slick_confidence", "length", "area", "perimeter", "polsby_popper", "fill_factor", "aspect_ratio_factor", "cls", "orchestrator_run", "linearity", "s1_scene_id", "hitl_cls", "hitl_cls_name", "aoi_type_1_ids", "aoi_type_2_ids", "aoi_type_3_ids", "source_type_1_ids", "source_type_2_ids", "source_type_3_ids", "max_source_collated_score", "slick_url"],
    note: "Potential slicks. SkyTruth state that oil cannot be definitively identified from radar alone, so every shape here is a detection awaiting review. Coverage is EEZs rather than the high seas. Every detection since January 2023, live. Below zoom 3 the panel gives the total number of detections; from zoom 3 each shaded square is counted live, and shapes draw from zoom 6, where a slick is large enough to see. From there, a square marked with a dashed edge holds more slicks than one tile can carry, and shows only some of them until you zoom in.",
    attribution: '<a href="https://cerulean.skytruth.org" target="_blank" rel="noopener">SkyTruth Cerulean</a>' },
  { id:"cerulean_sources",     name:"Slick sources (Cerulean)", unit:"candidate vessels and platforms", colour:"#6B5F58", route:"worker", ready:true, off: true,
    geometry:"polygon", maxAreaDeg2: 120,
    points: "cerulean_source_points", pointsUntil: 8, pointsColour: "#9A8078", pointsCollection: "public.source_plus",
    note: "Candidates, ranked. The score is an estimated likelihood on a -5 to +5 scale, not a finding, and vessel identity lags up to 72 hours behind the detection. This layer names parties and must read as a question rather than an answer.",
    attribution: '<a href="https://cerulean.skytruth.org" target="_blank" rel="noopener">SkyTruth Cerulean</a>' },
  // Straight from the Atlas's own vector tiles, not through the Worker.
  //
  // Measured 16 September 2026 from the Commander's machine. Through the Worker
  // every request was cut at 2,000 shapes: off Cairns 2,000 of 49,124, over the
  // widest allowed area 2,000 of 706,608, and 55 seconds to answer. The Atlas's
  // tiles carry every shape in the square and send CORS for this site — but it
  // builds each tile when asked, and wide squares never finish: zoom 6 gave up
  // after 60 s in every format, zoom 10 took 21 s for 2.4 MB, zoom 14 took under
  // a second for 84 KB. Nothing is served below zoom 3. So shapes draw from
  // zoom 12, and wider out the layer says why it is empty rather than sitting
  // empty. The benthic set only; the Atlas's geomorphic set is not added here.
  { id:"allen_coral",          name:"Coral reefs (Allen Coral Atlas)",      unit:"reefs (UNEP-WCMC) and habitat zones (Allen Coral Atlas)", colour:"#5E7377", route:"coral", ready:true, off: true,
    drawFrom: 12,
    tiles: "https://allencoralatlas.org/geoserver/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
           "&LAYER=coral-atlas:benthic_data_verbose&STYLE=&TILEMATRIXSET=EPSG:900913" +
           "&TILEMATRIX=EPSG:900913:{z}&TILEROW={y}&TILECOL={x}&FORMAT=application/vnd.mapbox-vector-tile",
    // GeoServer names the layer inside each tile. This is the expected name; if a
    // tile says otherwise the layer re-reads it from the tile (see readTileLayers).
    sourceLayer: "benthic_data_verbose",
    note: "Mapped between 32°N and 32°S only, which is the product's stated extent and not an absence of reefs elsewhere. Benthic zones to 10 m depth. The Atlas draws its shapes only for small areas, so they appear from zoom 12; wider out the layer shows the Atlas's own picture of the same reefs instead.",
    attribution: '<a href="https://allencoralatlas.org" target="_blank" rel="noopener">Allen Coral Atlas</a> (CC BY 4.0)' },
];

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

// Cerulean, read directly. Its API is tipg, which serves every collection as
// vector tiles and as counts, and answers this site's origin with CORS.
//
// TILE_CAP is tipg's default number of features per tile, which Cerulean's
// deploy config does not change. A tile over an area holding more than that is
// cut off at the cap, and a vector tile carries no count to say so. So the
// count is asked for separately (items?bbox=…&limit=0 returns numberMatched and
// no geometry) and any square over the cap is marked on the map.
//
// Measured off Durrës: 171,473 slicks in a zoom-3 tile, 13,138 at zoom 5,
// 3,421 at zoom 7, 376 at zoom 9 — about 7,000 at zoom 6, which is under the
// cap, so shapes draw from zoom 6. Denser seas may still exceed it there, which
// is what the marking is for. From zoom 3 to that point the squares are counted
// instead: real numbers from the same API, one request each.
// Raster tiles cut to a band of latitude, to the pixel.
//
// `bounds` on a raster source only decides which TILES are requested. A tile
// that straddles the edge is drawn whole, and GFW's tile server paints the part
// beyond its product's extent rather than leaving it transparent — so at low
// zoom, where one tile runs from the equator to the Arctic, the tropics layer
// laid a coloured wash over half the planet. The raster paint options cannot
// clip by latitude, so the clipping happens to the image itself: rows whose
// latitude falls outside the band are made transparent before MapLibre sees
// the tile. Beyond the band the basemap shows exactly as it does with the
// layer switched off.
//
// Which rows to clear, for a 256- or 512-pixel Web Mercator tile. Kept apart
// from the canvas work so it can be tested without a browser.
function clipTileRows(z, y, height, south, north) {
  const n = 2 ** z;
  const out = [];
  let start = -1;
  for (let row = 0; row < height; row++) {
    const merc = Math.PI * (1 - 2 * (y + (row + 0.5) / height) / n);
    const lat = Math.atan(Math.sinh(merc)) * 180 / Math.PI;
    const outside = lat > north || lat < south;
    if (outside && start < 0) start = row;
    if (!outside && start >= 0) { out.push([start, row]); start = -1; }
  }
  if (start >= 0) out.push([start, height]);
  return out;   // [firstRow, endRow) ranges to clear
}

// Give every alert pixel one colour, keeping its transparency.
//
// A tile that is mostly a single flat colour is carrying a wash rather than
// alerts — alerts are scattered, a wash is uniform — so that colour is cleared
// before anything is painted. Kept apart from the canvas so it can be tested
// on a plain array.
function recolorAlerts(px, rgb, z, w) {
  const counts = new Map();
  let opaque = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    opaque++;
    const k = (px[i] << 24 | px[i + 1] << 16 | px[i + 2] << 8 | px[i + 3]) >>> 0;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let wash = null;
  for (const [k, n] of counts) if (n > (px.length / 4) * 0.6) wash = k;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const k = (px[i] << 24 | px[i + 1] << 16 | px[i + 2] << 8 | px[i + 3]) >>> 0;
    if (k === wash) { px[i + 3] = 0; continue; }
    px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = 255;
  }
  // Wider out an alert is a single pixel or less, so each is grown into a
  // small solid patch and lightened, or the layer vanishes at world scale.
  const r = z == null ? 0 : z <= 3 ? 3 : z <= 5 ? 2 : z <= 8 ? 1 : 0;
  if (r && w) {
    const h = px.length / 4 / w, src = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) src[p] = px[p * 4 + 3] ? 1 : 0;
    const lit = rgb.map((c) => Math.round(c + (232 - c) * 0.35));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!src[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = (yy * w + xx) * 4;
        px[q] = lit[0]; px[q + 1] = lit[1]; px[q + 2] = lit[2]; px[q + 3] = 255;
      }
    }
  }
  return { opaque, washCleared: wash !== null };
}

// latclip://<south>,<north>[,<RRGGBB>]/<https URL without the scheme>
maplibregl.addProtocol("tint", async (params, abortController) => {
  const m = params.url.match(/^tint:\/\/([0-9A-Fa-f]{6})\/(.*)$/);
  const r = await fetch("https://" + m[2], { signal: abortController && abortController.signal });
  if (!r.ok) throw new Error(`${r.status}`);
  const buf = await r.arrayBuffer();
  const bmp = await createImageBitmap(new Blob([buf]));
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(bmp.width, bmp.height)
    : Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  tintPixels(img.data, [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)));
  ctx.putImageData(img, 0, 0);
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: "image/png" })
    : await new Promise((res) => canvas.toBlob(res, "image/png"));
  return { data: await blob.arrayBuffer() };
});
// seen://<https URL without the scheme> - a map server's picture made legible
// on a dark map, its own colours kept:
//   - a pixel drawn black or near it (a server's default outline) is redrawn
//     in bone: black concession outlines on the dark atlas could not be seen;
//   - wider out, every drawn pixel is grown into the empty pixels round it, in
//     its own colour, so a scatter of small areas (Indonesia's mining areas)
//     still shows from the world view. Filled pictures are unchanged by this,
//     since they have no empty pixels to grow into.
// The zoom is read from the width of the square asked for, the address being a
// bounding box rather than z/x/y. Kept apart from the canvas so it is tested.
function seenPixels(px, w, zoom) {
  const h = px.length / 4 / w;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    if (px[i] < 70 && px[i + 1] < 70 && px[i + 2] < 70) { px[i] = 220; px[i + 1] = 214; px[i + 2] = 198; }
    if (px[i + 3] < 200) px[i + 3] = Math.min(255, px[i + 3] + 60);
  }
  const r = zoom <= 4 ? 2 : zoom <= 7 ? 1 : 0;
  if (!r) return;
  const src = px.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (!src[o + 3]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const q = (yy * w + xx) * 4;
      if (src[q + 3]) continue;                      // only into empty pixels
      px[q] = src[o]; px[q + 1] = src[o + 1]; px[q + 2] = src[o + 2]; px[q + 3] = 255;
    }
  }
}
function zoomOfBbox(url) {
  const m = /BBOX=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/i.exec(url);
  if (!m) return 99;
  const width = Math.abs(Number(m[3]) - Number(m[1]));
  return width > 0 ? Math.round(Math.log2(40075016.68 / width)) : 99;
}
maplibregl.addProtocol("seen", async (params, abortController) => {
  const url = "https://" + params.url.replace(/^seen:\/\//, "");
  const r = await fetch(url, { signal: abortController && abortController.signal });
  if (!r.ok) throw new Error(`${r.status}`);
  const bmp = await createImageBitmap(new Blob([await r.arrayBuffer()]));
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(bmp.width, bmp.height)
    : Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  seenPixels(img.data, bmp.width, zoomOfBbox(url));
  ctx.putImageData(img, 0, 0);
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: "image/png" })
    : await new Promise((res) => canvas.toBlob(res, "image/png"));
  return { data: await blob.arrayBuffer() };
});

function tintPixels(d, rgb) {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
  }
}

maplibregl.addProtocol("latclip", async (params, abortController) => {
  const m = params.url.match(/^latclip:\/\/(-?[\d.]+),(-?[\d.]+)(?:,([0-9A-Fa-f]{6}))?\/(.*)$/);
  const url = "https://" + m[4];
  const tint = m[3] ? [0, 2, 4].map((i) => parseInt(m[3].slice(i, i + 2), 16)) : null;
  const r = await fetch(url, { signal: abortController && abortController.signal });
  if (!r.ok) throw new Error(`${r.status}`);
  const buf = await r.arrayBuffer();
  const t = url.match(/\/(\d+)\/(\d+)\/(\d+)(?:\?|$)/);
  if (!t) return { data: buf };
  const [z, , y] = t.slice(1).map(Number);
  const south = Number(m[1]), north = Number(m[2]);
  // Most tiles sit wholly inside the band; untinted, those go through untouched.
  if (!tint && !clipTileRows(z, y, 256, south, north).length) return { data: buf };

  const bmp = await createImageBitmap(new Blob([buf]));
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(bmp.width, bmp.height)
    : Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  for (const [a, b] of clipTileRows(z, y, bmp.height, south, north)) {
    ctx.clearRect(0, a, bmp.width, b - a);
  }
  if (tint) {
    const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
    recolorAlerts(img.data, tint, z, bmp.width);
    ctx.putImageData(img, 0, 0);
  }
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: "image/png" })
    : await new Promise((res) => canvas.toBlob(res, "image/png"));
  return { data: await blob.arrayBuffer() };
});

// Which layers a vector tile contains, read from the tile's own bytes.
//
// A vector-tile layer is drawn by naming the layer inside the tile. Name it
// wrong and MapLibre draws nothing and reports nothing — the failure that looks
// exactly like a source with no data. The Allen Coral Atlas's tiles could not be
// opened to check the name before this was written, so the first tile that
// arrives is read: a Mapbox Vector Tile is a protobuf whose field 3 repeats per
// layer, each with its name in field 1.
function readTileLayers(buffer) {
  const b = new Uint8Array(buffer);
  const names = [];
  let i = 0;
  const varint = () => {
    let r = 0, shift = 0, c;
    do { c = b[i++]; r += (c & 0x7f) * 2 ** shift; shift += 7; } while (c & 0x80 && i < b.length);
    return r;
  };
  const skip = (wire) => {
    if (wire === 0) varint();
    else if (wire === 1) i += 8;
    else if (wire === 5) i += 4;
    else if (wire === 2) { const len = varint(); i += len; }   // read the length first: `i += varint()` uses i from before the read
    else i = b.length;   // not a tile this reader understands; stop
  };
  while (i < b.length) {
    const key = varint();
    if ((key >> 3) === 3 && (key & 7) === 2) {
      const size = varint();
      const end = i + size;
      while (i < end) {
        const k = varint();
        if ((k >> 3) === 1 && (k & 7) === 2) {
          const len = varint();
          names.push(new TextDecoder().decode(b.subarray(i, i + len)));
          i += len;
        } else skip(k & 7);
      }
      i = end;
    } else skip(key & 7);
  }
  return names;
}

// coral://<the tile URL without its scheme>. One retry, because the Atlas
// builds tiles on request and a first answer can fail where a second succeeds;
// and a check of the layer name on the first tile that carries one.
const coralLayerChecked = new Set();
const coralFailures = new Map();     // id -> squares the Atlas failed to answer
maplibregl.addProtocol("coral", async (params, abortController) => {
  const url = params.url.replace(/^coral:\/\//, "https://");
  let buf;
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { signal: abortController && abortController.signal });
      if (!r.ok) throw new Error(`${r.status}`);
      buf = await r.arrayBuffer();
      break;
    } catch (e) {
      if (abortController && abortController.signal.aborted) throw e;
      if (attempt >= 1) {
        const failedCfg = LAYERS.find((l) => l.route === "coral");
        if (failedCfg) coralFailures.set(failedCfg.id, (coralFailures.get(failedCfg.id) || 0) + 1);
        throw e;
      }
    }
  }
  const cfg = LAYERS.find((l) => l.route === "coral" && url.includes(l.tiles.split("?")[1].split("&")[3]));
  if (cfg && !coralLayerChecked.has(cfg.id) && buf.byteLength) {
    const names = readTileLayers(buf);
    if (names.length) {
      coralLayerChecked.add(cfg.id);
      if (!names.includes(cfg.sourceLayer)) {
        console.warn(`[culprits] ${cfg.id}: tiles name their layer "${names[0]}", ` +
                     `not "${cfg.sourceLayer}"; drawing from "${names[0]}"`);
        cfg.sourceLayer = names[0];
        addCoralShapes(cfg, true);
      }
    }
  }
  return { data: buf };
});

const CERULEAN = "https://api.cerulean.skytruth.org";
const CERULEAN_TILE_CAP = 10000;

// Cerulean's server is often slow to answer its first request and times out
// once, then answers. MapLibre does not retry a failed tile, so tiles go
// through this: the same request, tried a second time before giving up.
maplibregl.addProtocol("cerulean", async (params, abortController) => {
  const url = params.url.replace(/^cerulean:\/\//, "https://");
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { signal: abortController && abortController.signal });
      if (!r.ok) throw new Error(`${r.status}`);
      return { data: await r.arrayBuffer() };
    } catch (e) {
      if (attempt >= 1 || (abortController && abortController.signal.aborted)) throw e;
    }
  }
});

/* ---------- basemaps ---------- */
//
// Three, chosen in the panel:
//   atlas      a painted world chart that fades into recoloured satellite
//              imagery between zoom 3 and 5 (the opening basemap)
//   satellite  the imagery as this map has always drawn it
//   outlines   country shapes from data/boundaries.geojson, no imagery at all
//
// The painted chart is the same plate as the Pre-Birth Rights map: already
// reprojected to Web Mercator, covering 80.55°S to 85.05°N. MapLibre places an
// image source linearly in Mercator space, so it registers with no warping.
const PLATE = {
  url: abs("./atlas-plate.webp"),
  coordinates: [[-180, 85.05112877980659], [180, 85.05112877980659],
                [180, -80.55], [-180, -80.55]],
  fadeIn: 3, fadeOut: 5,          // zoom: full plate -> full imagery
};

// The Leaflet atlas's settings, kept under the same names so the two maps can
// be compared line by line. MapLibre's raster controls are not CSS filters, so
// the grading is the nearest equivalent rather than the same numbers: CSS
// saturate(1.15) is raster-saturation +0.15, and brightness(1.06) — which
// MapLibre cannot exceed 1 on — is approximated by lifting the floor.
const ATLAS_TUNE = {
  sat: .15, con: .05, lift: .03, hue: -6,
  sea: .55, green: .30, warm: .22,
};
// The zoom the globe opens on, and the one the globe button returns to.
const OPENING_ZOOM = 1;

const BASE_GRADE = {
  atlas: { "raster-brightness-min": ATLAS_TUNE.lift, "raster-brightness-max": 1,
           "raster-saturation": ATLAS_TUNE.sat, "raster-contrast": ATLAS_TUNE.con,
           "raster-hue-rotate": ATLAS_TUNE.hue },
  // The Satellite imagery basemap on its own (not the imagery under the painted
  // atlas, which keeps the atlas grade): graded livelier, so forest reads green
  // and water blue. Part of the planetary-defence look (see DEFENCE below).
  satellite: { "raster-brightness-min": 0.02, "raster-brightness-max": 1,
               "raster-saturation": 0.38, "raster-contrast": 0.14,
               "raster-hue-rotate": 0 },
};
let BASEMAP = "atlas";

// The colour washes, as one WebGL layer drawn over the imagery.
//
// The Leaflet atlas lays three flat colours over its imagery with CSS blend
// modes. MapLibre has no blend modes for its own layers, but a custom WebGL
// layer sets the GPU's blend equation directly. Those equations are linear,
// so each wash is reproduced as closely as linear allows:
//
//   sea    #0f3b52  screen      EXACT. screen(d, c) = d + c(1 - d), which is
//                               blendFunc(ONE, ONE_MINUS_SRC_COLOR) with the
//                               colour premultiplied by the wash's opacity.
//   warm   #f0c073  overlay     EXACT FOR THE DARKER HALF of the picture. For
//                               d <= 0.5 overlay is d * 2c: a gain above 1 on
//                               red and green (drawn as d + d*k with
//                               blendFunc(DST_COLOR, ONE)) and a multiply below
//                               1 on blue. Above d = 0.5 real overlay levels
//                               off and this keeps climbing, so bright ground
//                               comes out warmer than on the Leaflet map.
//   green  #5f8f3a  soft-light  MATCHED AT MID-TONES. Soft-light is quadratic
//                               in d. This is the multiply that gives the same
//                               result at d = 0.5; darker and lighter ground
//                               drift from it. Its small lift on green is
//                               dropped.
//
// Relief is the existing hillshade layer. The Leaflet map multiplies it; here
// it stays a normal overlay, as it was before the atlas.
function atlasWashRamp(z) {
  // Tints ease off as you zoom in: wide out they do the work, close in they
  // cover the detail somebody zoomed in to see.
  const t = z <= 6 ? 1 : z >= 13 ? 0.45 : 1 - (z - 6) * (0.55 / 7);
  return { t, sea: z <= 6 ? 1 : 0.7 };
}
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
// Passes for one frame, as { mode, rgb }. Kept separate from the GL code so the
// arithmetic can be tested without a GPU.
function atlasWashPasses(z) {
  const { t, sea } = atlasWashRamp(z);
  const passes = [];
  const aSea = ATLAS_TUNE.sea * sea;
  passes.push({ mode: "screen", rgb: hexRgb("#0f3b52").map((c) => c * aSea) });

  const aG = ATLAS_TUNE.green * t;
  passes.push({ mode: "multiply", rgb: hexRgb("#5f8f3a").map((c) =>
    1 - aG * (1 - (c < .5 ? .5 + c : 1))) });

  const aW = ATLAS_TUNE.warm * t;
  const warm = hexRgb("#f0c073");
  passes.push({ mode: "gain", rgb: warm.map((c) => c > .5 ? aW * (2 * c - 1) : 0) });
  passes.push({ mode: "multiply", rgb: warm.map((c) => c < .5 ? 1 - aW * (1 - 2 * c) : 1) });
  return passes;
}
// The washes are drawn as a mesh over the world, not as one pass over the
// screen: on a globe a screen pass would tint space too. MapLibre hands a
// custom layer its own projection code (shaderData) and its uniforms
// (defaultProjectionData); with them one mesh in Web Mercator coordinates
// lands on the flat map and on the globe alike. The mesh is fine enough that
// its straight edges follow the curve of the globe.
const WASH_MESH = { cols: 96, rows: 64 };
function washMesh({ cols, rows }) {
  const v = [];
  for (let j = 0; j < rows; j++) {
    const y0 = j / rows, y1 = (j + 1) / rows;
    for (let i = 0; i < cols; i++) {
      const x0 = i / cols, x1 = (i + 1) / cols;
      v.push(x0, y0, x1, y0, x0, y1, x1, y0, x1, y1, x0, y1);
    }
  }
  return new Float32Array(v);
}
const atlasWashes = {
  id: "atlas-washes", type: "custom", renderingMode: "2d",
  onAdd(m, gl) {
    this.map = m;
    this.programs = new Map();        // one per projection variant MapLibre names
    try {
      this.mesh = washMesh(WASH_MESH);
      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, this.mesh, gl.STATIC_DRAW);
    } catch (e) {
      this.failed = true;
      console.warn("[culprits] atlas washes unavailable:", e.message || e);
    }
  },
  program(gl, shaderData) {
    const key = shaderData.variantName;
    if (this.programs.has(key)) return this.programs.get(key);
    const sh = (type, src) => {
      const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, `#version 300 es
${shaderData.vertexShaderPrelude}
${shaderData.define}
in vec2 a_pos;
void main() { gl_Position = projectTile(a_pos); }`));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float;
uniform vec3 c;
out vec4 colour;
void main() { colour = vec4(c, 1.0); }`));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = (n) => gl.getUniformLocation(p, n);
    const prog = { p, aPos: gl.getAttribLocation(p, "a_pos"), uCol: u("c"),
      uMatrix: u("u_projection_matrix"), uFallback: u("u_projection_fallback_matrix"),
      uTile: u("u_projection_tile_mercator_coords"), uClip: u("u_projection_clipping_plane"),
      uTransition: u("u_projection_transition") };
    this.programs.set(key, prog);
    return prog;
  },
  render(gl, options) {
    if (this.failed || BASEMAP === "outlines" || !options || !options.shaderData) return;
    let prog;
    try { prog = this.program(gl, options.shaderData); }
    catch (e) {
      // A GPU that rejects the shader leaves the imagery ungraded by washes
      // rather than taking the map down. Everything else still draws.
      this.failed = true;
      console.warn("[culprits] atlas washes unavailable:", e.message || e);
      return;
    }
    // MapLibre binds its own vertex array objects. Drawing with one still bound
    // would rewrite MapLibre's attribute state; unbind first. MapLibre marks its
    // GL state dirty around a custom layer and restores the rest itself.
    if (gl.bindVertexArray) gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.CULL_FACE);
    gl.useProgram(prog.p);
    const d = options.defaultProjectionData;
    if (prog.uMatrix) gl.uniformMatrix4fv(prog.uMatrix, false, d.mainMatrix);
    if (prog.uFallback) gl.uniformMatrix4fv(prog.uFallback, false, d.fallbackMatrix);
    if (prog.uTile) gl.uniform4f(prog.uTile, ...d.tileMercatorCoords);
    if (prog.uClip) gl.uniform4f(prog.uClip, ...d.clippingPlane);
    if (prog.uTransition) gl.uniform1f(prog.uTransition, d.projectionTransition);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(prog.aPos);
    gl.vertexAttribPointer(prog.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    // Alpha is left as it was in every pass: these change colour, not coverage.
    const func = {
      screen:   [gl.ONE, gl.ONE_MINUS_SRC_COLOR],
      multiply: [gl.ZERO, gl.SRC_COLOR],
      gain:     [gl.DST_COLOR, gl.ONE],
    };
    const count = this.mesh.length / 2;
    for (const pass of atlasWashPasses(this.map.getZoom())) {
      const [src, dst] = func[pass.mode];
      gl.blendFuncSeparate(src, dst, gl.ZERO, gl.ONE);
      gl.uniform3f(prog.uCol, pass.rgb[0], pass.rgb[1], pass.rgb[2]);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }
  },
};

// Colour is a judgement and judgements want a knob, not a redeploy:
//   atlasTune({ green: .4, warm: .3, sat: .25 })     atlasTune() prints them
window.atlasTune = (next) => {
  if (!next) { console.log("[culprits] atlas tune", JSON.stringify(ATLAS_TUNE)); return ATLAS_TUNE; }
  for (const k of Object.keys(next)) if (k in ATLAS_TUNE) ATLAS_TUNE[k] = next[k];
  for (const k of ["atlas", "satellite"]) {
    Object.assign(BASE_GRADE[k], {
      "raster-brightness-min": ATLAS_TUNE.lift, "raster-saturation": ATLAS_TUNE.sat,
      "raster-contrast": ATLAS_TUNE.con, "raster-hue-rotate": ATLAS_TUNE.hue });
  }
  setBasemap(BASEMAP);
  return ATLAS_TUNE;
};

const map = new maplibregl.Map({
  container: "map",
  // One world. Repeated copies east and west read as more planet than there is.
  renderWorldCopies: false,
  // Speed. A Retina screen draws four pixels for every one; capped at 1.5 the
  // map draws about half as many, and the dots stay sharp. No cross-fades.
  pixelRatio: Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 1.5),
  fadeDuration: 0,
  // Tilt and turn on every axis: right-drag (or Ctrl-drag) turns and tilts,
  // Ctrl + right-drag rolls. Tilt goes to 85 degrees, near the horizon.
  maxPitch: 85,
  rollEnabled: true,
  center: [12, 24],
  zoom: OPENING_ZOOM,
  attributionControl: { compact: true },
  style: {
    version: 8,
    // The opening view: a globe. See VIEWS.
    projection: { type: "vertical-perspective" },
    // The atmosphere, at world view only; gone by the time the map is flat.
    // Tilted close up, the sky above the horizon is dark slate, not
    // MapLibre's default bright blue.
    sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 0.8, 7, 0],
           "sky-color": "#1B242B", "horizon-color": "#46545B", "fog-color": "#46545B",
           "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.7 },
    sources: {
      // Imagery, relief and labels as three layers, the way the Leaflet atlas
      // builds them. What this map documents is physical — a mine, a cleared
      // block, a plantation edge — and on a drawn basemap those float over an
      // abstraction rather than sitting on the ground they refer to.
      //
      // The painted atlas (see BASEMAPS below) adds the Leaflet atlas's colour
      // washes on top of these through a WebGL layer. Two of its three washes
      // are reproduced exactly and one is matched at mid-tones; the comments
      // there say which.
      base: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/" +
                "World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256, maxzoom: 18,
        attribution: "Imagery © Esri, Maxar",
      },
      // Relief is what makes imagery read as terrain rather than as a
      // photograph. In the Leaflet map it multiplies; here it can only sit on
      // top at low opacity, which is weaker but the same idea.
      hillshade: {
        type: "raster",
        tiles: ["https://services.arcgisonline.com/arcgis/rest/services/" +
                "Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256, maxzoom: 16,
        attribution: "Hillshade © Esri",
      },
      // Labels only — coastlines and place names over the imagery. Without
      // them satellite is unreadable at low zoom: no way to tell which coast.
      labels: {
        type: "raster",
        tiles: ["https://a.basemaps.cartocdn.com/rastertiles/" +
                "voyager_only_labels/{z}/{x}/{y}@2x.png"],
        tileSize: 256,
        attribution: "Labels © CARTO, © OpenStreetMap",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0B1017" } },
      // Graded down so the data layers read on top. Raw Esri imagery is bright
      // enough that a muted point layer disappears into it.
      // Starts in the painted atlas's grading, because that is the opening
      // basemap; setBasemap() swaps it for the satellite grading.
      { id: "base", type: "raster", source: "base",
        paint: { "raster-opacity": 1, ...BASE_GRADE.atlas } },
      // Relief eases IN as you zoom, the way the Leaflet ramp does it: wide out
      // it muddies the picture, at valley scale it is what you want more of.
      { id: "hillshade", type: "raster", source: "hillshade",
        paint: { "raster-opacity":
          ["interpolate", ["linear"], ["zoom"], 4, .18, 9, .34, 13, .46] } },
    ],
  },
});

/* ---------- every layer easier to see, and its own transparency ---------- */
// Points get a light rim, so they stand out on the atlas and on satellite
// imagery, and a minimum size, so the smallest are visible at world scale.
// Hollow rings and the news marks keep their own drawing.
const POINT_MIN = 3.2, POINT_GROW = 1.2, POINT_RIM = "rgba(242,238,230,0.85)";
function hasZoom(v) { return JSON.stringify(v).includes('"zoom"'); }
function mapOutputs(v, fn) {
  if (typeof v === "number") return fn(v);
  if (Array.isArray(v) && (v[0] === "interpolate" || v[0] === "interpolate-hcl" || v[0] === "interpolate-lab") && JSON.stringify(v[2]) === '["zoom"]') {
    return v.map((x, i) => (i > 2 && (i - 3) % 2 === 1 ? mapOutputs(x, fn) : x));
  }
  if (Array.isArray(v) && v[0] === "step" && JSON.stringify(v[1]) === '["zoom"]') {
    return v.map((x, i) => (i === 2 || (i > 2 && (i - 3) % 2 === 1) ? mapOutputs(x, fn) : x));
  }
  if (Array.isArray(v) && !hasZoom(v)) return fn === boostOne ? ["max", ["*", v, POINT_GROW], POINT_MIN] : ["*", v, fn(1)];
  return v;
}
function boostOne(n) { return Math.max(n * POINT_GROW, POINT_MIN); }
function legibleCircle(layer) {
  if (!layer || layer.type !== "circle" || /^(wire-|ct-)/.test(layer.id)) return;
  const p = layer.paint = Object.assign({}, layer.paint || {});
  if (/rgba\(0,\s*0,\s*0,\s*0\)/.test(JSON.stringify(p["circle-color"] || ""))) return;
  p["circle-radius"] = mapOutputs(p["circle-radius"] === undefined ? 5 : p["circle-radius"], boostOne);
  p["circle-stroke-color"] = POINT_RIM;
  const w = p["circle-stroke-width"];
  if (w === undefined || (typeof w === "number" && w < 1)) p["circle-stroke-width"] = 1;
}
const OPACITY_PROPS = { fill: ["fill-opacity"], line: ["line-opacity"], circle: ["circle-opacity", "circle-stroke-opacity"],
  raster: ["raster-opacity"], "fill-extrusion": ["fill-extrusion-opacity"], symbol: ["icon-opacity", "text-opacity"], heatmap: ["heatmap-opacity"] };
const opacityFactor = new Map();        // row id -> 0.1..1
const opacityBase = new Map();          // "layer|prop" -> its own opacity
function rowOfLayer(layerId) {
  let best = null;
  for (const id of opacityFactor.keys()) if ((layerId === id || layerId.startsWith(id + "-")) && (!best || id.length > best.length)) best = id;
  return best;
}
function applyOpacity(layerId, f) {
  const l = map.getLayer && map.getLayer(layerId);
  if (!l) return;
  for (const prop of OPACITY_PROPS[l.type] || []) {
    const key = `${layerId}|${prop}`;
    if (!opacityBase.has(key)) {
      const v = map.getPaintProperty(layerId, prop);
      opacityBase.set(key, v === undefined ? 1 : v);
    }
    try { map.setPaintProperty(layerId, prop, f >= 0.999 ? opacityBase.get(key) : mapOutputs(opacityBase.get(key), (n) => n * f)); }
    catch (e) { /* an expression this cannot scale keeps its own value */ }
  }
}
function layersOfRow(id) {
  const st = map.getStyle && map.getStyle();
  return ((st && st.layers) || []).map((l) => l.id).filter((l) => l === id || l.startsWith(id + "-"));
}
/* ---------- markers: geometric HUD symbols instead of round bubbles ---------- */
// Every point layer's places are drawn as a small geometric symbol: a thin
// outline around a solid core, with a soft glow. The symbol's shape and glow
// say which part of the map the layer belongs to (below); its fill keeps the
// layer's own colours, so kinds, facets and colour keys still read as before.
// A place the source gives only as an area (drawn hollow before) is the
// outline alone. The round layer stays underneath, unseen, so clicking, boxes,
// filters and the layer tools work exactly as they did; everything done to it
// (shown, hidden, filtered, recoloured, resized, moved, removed) is done to
// its symbol too. (A breathing glow on every marker was tried and dropped: it
// kept the whole map redrawing ten times a second.)
const HUD = {
  // Glow colours. Amber and cyan are as asked for these markers.
  cyan: "#43D9E0", amber: "#E7A63B", red: "#C8323C", white: "#EEF3F2",
  R: 11,                     // a circle of this radius is a symbol at size 1
};
const HUD_KIND = {
  // [top section, heading under it] -> [shape, glow]; "*" is any heading.
  "On-planet invasion|*": ["chevron", "cyan"],
  "Destruction|Climate": ["hexagon", "amber"],
  "Destruction|Pollution": ["triangle", "red"],
  "Destruction|Deforestation": ["diamond", "red"],
  "Destruction|Biodiversity loss": ["diamond", "red"],
  "Destruction|Mining": ["cross", "amber"],
  "Destruction|Agriculture": ["hexagon", "red"],
  "Destruction|Oceans": ["reticle", "cyan"],
  "Destruction|Construction": ["square", "amber"],
  "Destruction|Other": ["diamond", "amber"],
  "Destruction|*": ["triangle", "red"],
  "Suppression|*": ["square", "white"],
  "Off-planet invasion|*": ["reticle", "cyan"],
  "Buildings|*": ["square", "white"],
  "*": ["diamond", "white"],
};
let hudPlaces = null;
function hudPlace(layerId) {
  if (!hudPlaces) {
    hudPlaces = new Map();
    let h1 = "", h3 = "";
    for (const x of (typeof PANEL_ORDER !== "undefined" ? PANEL_ORDER : [])) {
      if (x && typeof x === "object") { if (x.h === 1) { h1 = x.t; h3 = ""; } else if (x.h === 3) h3 = x.t; else if (x.h === 2) h3 = ""; continue; }
      const id = String(x).replace(/^group:/, "");
      hudPlaces.set(id, [h1, h3]);
      const g = typeof GROUPS !== "undefined" && GROUPS.find((gg) => gg.id === id);
      if (g) g.children.forEach((c) => hudPlaces.set(c.id, [h1, h3]));
    }
  }
  let best = null;
  for (const id of hudPlaces.keys()) if ((layerId === id || layerId.startsWith(id + "-")) && (!best || id.length > best.length)) best = id;
  const [h1, h3] = best ? hudPlaces.get(best) : ["", ""];
  return HUD_KIND[`${h1}|${h3}`] || HUD_KIND[`${h1}|*`] || HUD_KIND["*"];
}
// The symbols, drawn once as signed-distance images, so each takes any colour
// and a glow of any width.
const HUD_SHAPES = ["hexagon", "triangle", "square", "diamond", "cross", "chevron", "reticle"];
function hudPolygon(shape, c, r) {
  const pts = (n, rot) => [...Array(n).keys()].map((i) => [c + r * Math.cos(rot + i * 2 * Math.PI / n), c + r * Math.sin(rot + i * 2 * Math.PI / n)]);
  if (shape === "hexagon") return pts(6, Math.PI / 6);
  if (shape === "triangle") return pts(3, -Math.PI / 2).map(([x, y]) => [x, y + r * 0.18]);
  if (shape === "square") return pts(4, Math.PI / 4).map(([x, y]) => [c + (x - c) * 0.9, c + (y - c) * 0.9]);
  if (shape === "diamond") return pts(4, 0).map(([x, y]) => [c + (x - c) * 0.8, y]);
  if (shape === "chevron") return [[c, c - r], [c + r * 0.85, c + r * 0.75], [c, c + r * 0.25], [c - r * 0.85, c + r * 0.75]];
  if (shape === "cross") { const a = r * 0.36; return [[c - a, c - r], [c + a, c - r], [c + a, c - a], [c + r, c - a], [c + r, c + a], [c + a, c + a], [c + a, c + r], [c - a, c + r], [c - a, c + a], [c - r, c + a], [c - r, c - a], [c - a, c - a]]; }
  return null;
}
function hudInside(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function hudMask(shape, hollow, S) {
  const c = S / 2, r = S * 0.34, m = new Uint8Array(S * S);
  const poly = hudPolygon(shape, c, r);
  const inner = poly && poly.map(([x, y]) => [c + (x - c) * 0.72, c + (y - c) * 0.72]);
  const core = poly && poly.map(([x, y]) => [c + (x - c) * 0.42, c + (y - c) * 0.42]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const px = x + 0.5, py = y + 0.5;
    let on;
    if (shape === "reticle") {
      const d = Math.hypot(px - c, py - c);
      const ring = d > r * 0.72 && d < r;
      const ticks = (Math.abs(px - c) < r * 0.09 || Math.abs(py - c) < r * 0.09) && d > r * 0.95 && d < r * 1.3;
      on = ring || ticks || (!hollow && d < r * 0.38);
    } else {
      const outline = hudInside(poly, px, py) && !hudInside(inner, px, py);
      on = outline || (!hollow && hudInside(core, px, py));
    }
    m[y * S + x] = on ? 1 : 0;
  }
  return m;
}
function hudSdf(mask, S) {
  // Distance to the nearest pixel of the other kind, signed: + inside.
  const edge = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = mask[y * S + x];
    if ((x > 0 && mask[y * S + x - 1] !== v) || (y > 0 && mask[(y - 1) * S + x] !== v)) edge.push([x, y]);
  }
  const data = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d = 1e9;
    for (const [ex, ey] of edge) { const dd = (ex - x) * (ex - x) + (ey - y) * (ey - y); if (dd < d) d = dd; }
    d = Math.sqrt(d) * (mask[y * S + x] ? 1 : -1);
    const i = (y * S + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.max(0, Math.min(255, Math.round((0.75 + d / 8) * 255)));
  }
  return data;
}
function hudImages() {
  if (typeof map.hasImage !== "function" || map.hasImage("hud-diamond")) return;
  const S = 48;
  for (const shape of HUD_SHAPES) for (const hollow of [false, true]) {
    const id = `hud-${shape}${hollow ? "-hollow" : ""}`;
    if (!map.hasImage(id)) map.addImage(id, { width: S, height: S, data: hudSdf(hudMask(shape, hollow, S), S) }, { sdf: true, pixelRatio: 2 });
  }
}
const hudOf = new Map();       // circle layer id -> its symbol layer id
function hudEligible(layer) {
  if (!layer || layer.type !== "circle" || !layer.id || /^(wire-|ct-)/.test(layer.id) || /-(halo|hud|glow)$/.test(layer.id)) return false;
  const c = JSON.stringify((layer.paint || {})["circle-color"] || "");
  return !/rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(c);
}
function hudSize(radius) {
  return mapOutputs(radius === undefined ? 5 : radius, (n) => Math.max(0.3, n / HUD.R * 1.05));
}
// The glow, asked for on 22 September in place of the geometric symbols: a
// satellite-derived look where emissions read as a continuous field of light.
//   Wider out: a heat field (one WebGL heatmap layer per point layer, so
//   thousands of points stay fast) whose brightness comes from each source's
//   AMOUNT - one huge emitter glows brighter than ten tiny ones unless the
//   tiny ones together emit more - weighted by value over the layer's largest
//   value, read from its archive (glowMaxOf); a layer with no amounts weighs
//   each point, or each merged point's count, alike. Every source is in it.
//   Closer in: the field fades and the sources stand as round dots, sized
//   by the layer's own rule (an area proportional to the amount), each with a
//   faint blurred halo. Nothing has a hard edge. Colours run plum, rose and
//   pale bone at the hottest points; no orange or yellow anywhere.
// The round layer stays the one that is clicked, filtered, recoloured and
// removed; the glow and the halo follow it (the wrappers below).
const GLOW = {
  plum: "#6E4A6A", rose: "#B07087", bone: "#E8DFD0", red: "#C77A8A", white: "#DCD6C6",
  cyan: "#8C8FA8", amber: "#9E6E82",          // the old symbol glows, mapped into the same range
  ramp: ["interpolate", ["linear"], ["heatmap-density"],
    0, "rgba(60,30,60,0)", 0.15, "rgba(80,40,80,0.45)", 0.4, "#6E4A6A", 0.7, "#B07087", 0.9, "#D9B8BF", 1, "#E8DFD0"],
  fadeOut: 9, gone: 12,                        // the field: full to 9, gone by 12; the dots the other way
};
const glowMaxOf = new Map();                   // source id -> the largest "value" in it, from the archive's own stats
function glowWeight(layer) {
  const max = glowMaxOf.get(layer.source);
  const count = ["max", 1, ["coalesce", ["to-number", ["get", "_count"]], 1]];
  if (!max) return ["min", 1, ["/", ["log2", ["+", 1, count]], 10]];
  // Amount over the layer's largest amount; a merged point carries its members' sum already.
  return ["min", 1, ["/", ["max", 0, ["coalesce", ["to-number", ["get", "value"]], 0]], max]];
}
function addHud(layer, rawAddLayer) {
  const [, glowName] = hudPlace(layer.id);
  const p = layer.paint || {};
  const halo = `${layer.id}-halo`, field = `${layer.id}-glow`;
  const base = { source: layer.source };
  if (layer["source-layer"]) base["source-layer"] = layer["source-layer"];
  if (layer.filter) base.filter = layer.filter;
  const vis = (layer.layout && layer.layout.visibility) || "visible";
  const fieldSpec = Object.assign({ id: field, type: "heatmap", layout: { visibility: vis },
    minzoom: layer.minzoom != null ? layer.minzoom : 0, maxzoom: GLOW.gone,
    paint: {
      "heatmap-weight": glowWeight(layer),
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1.2, 6, 2, 10, 3],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 10, 4, 18, 8, 34, 12, 60],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], GLOW.fadeOut, 0.9, GLOW.gone, 0],
      "heatmap-color": GLOW.ramp,
    } }, base);
  const haloSpec = Object.assign({ id: halo, type: "circle", layout: { visibility: vis },
    paint: {
      "circle-color": GLOW[glowName] || GLOW.rose,
      "circle-radius": mapOutputs(p["circle-radius"] === undefined ? 5 : p["circle-radius"], (n) => n * 2.4),
      "circle-blur": 1, "circle-opacity": ["interpolate", ["linear"], ["zoom"], GLOW.fadeOut, 0.12, GLOW.gone, 0.38],
    } }, base);
  if (layer.minzoom != null) haloSpec.minzoom = layer.minzoom;
  if (layer.maxzoom != null) haloSpec.maxzoom = layer.maxzoom;
  try {
    rawAddLayer(fieldSpec, layer.id);
    rawAddLayer(haloSpec, layer.id);
    // The dots themselves: soft-edged, and rising as the field fades.
    const paint = hudRaw.setPaintProperty || map.setPaintProperty.bind(map);
    paint(layer.id, "circle-blur", 0.35);
    paint(layer.id, "circle-stroke-width", 0);
    if (p["circle-opacity"] === undefined) paint(layer.id, "circle-opacity", ["interpolate", ["linear"], ["zoom"], GLOW.fadeOut, 0.55, GLOW.gone, 0.95]);
    hudOf.set(layer.id, [field, halo]);
  } catch (e) { /* this layer keeps its round markers alone */ }
}
function hudNext(layerId) {
  const ls = (map.getStyle().layers || []).map((l) => l.id);
  const i = ls.indexOf(layerId);
  return i >= 0 && i + 1 < ls.length ? ls[i + 1] : undefined;
}
// Everything done to a round layer is done to its symbol.
const hudRaw = {};
function hudWrap(name, make) {
  if (typeof map[name] !== "function") return;
  hudRaw[name] = map[name].bind(map);
  map[name] = make(hudRaw[name]);
}
const hudMates = (id) => (hudOf.get(id) || []).filter((h) => map.getLayer(h));
hudWrap("setLayoutProperty", (raw) => function (id, prop, v, o) {
  const out = raw(id, prop, v, o);
  if (prop === "visibility") hudMates(id).forEach((h) => raw(h, prop, v, o));
  return out;
});
hudWrap("setFilter", (raw) => function (id, f, o) {
  const out = raw(id, f, o);
  hudMates(id).forEach((h) => raw(h, f, o));
  return out;
});
hudWrap("setPaintProperty", (raw) => function (id, prop, v, o) {
  const out = raw(id, prop, v, o);
  for (const h of hudMates(id)) {
    try {
      if (h.endsWith("-halo") && prop === "circle-radius") raw(h, "circle-radius", mapOutputs(v, (n) => n * 2.4), o);
      if (h.endsWith("-halo") && prop === "circle-opacity" && typeof v === "number") raw(h, "circle-opacity", v * 0.38, o);
      if (h.endsWith("-glow") && prop === "circle-opacity" && typeof v === "number") raw(h, "heatmap-opacity", v * 0.9, o);
    } catch (e) { /* kept */ }
  }
  return out;
});
hudWrap("moveLayer", (raw) => function (id, before) {
  const out = raw(id, before);
  hudMates(id).forEach((h) => raw(h, id));    // the glow and the halo stay under their dots
  return out;
});
hudWrap("removeLayer", (raw) => function (id) {
  hudMates(id).forEach((h) => raw(h));
  hudOf.delete(id);
  return raw(id);
});
if (typeof map.addLayer === "function") {
  const rawAddLayer = map.addLayer.bind(map);
  map.addLayer = function (layer, before) {
    try { legibleCircle(layer); } catch (e) { /* drawn as given */ }
    const out = rawAddLayer(layer, before);
    try { if (hudEligible(layer)) addHud(layer, rawAddLayer); } catch (e) { /* round markers stay */ }
    const row = layer && layer.id && rowOfLayer(layer.id);
    if (row && opacityFactor.get(row) < 0.999) applyOpacity(layer.id, opacityFactor.get(row));
    return out;
  };
}

map.on("error", (e) => {
  const id = e.sourceId || "";
  const cfg = LAYERS.find((l) => id.startsWith(l.id));
  const msg = (e.error && e.error.message) || "failed to load";
  if (cfg) setLayerState(cfg.id, msg);
  console.error("[culprits]", id || "map", msg, e.error || e);
});

// The compass shows the turn and tilt, and a click on it stands the map
// back upright facing north.
map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true, visualizeRoll: true }), "bottom-right");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");

/* ---------- pre-tiled layers ---------- */

// Read a facet's values out of the archive rather than declaring them.
//
// tippecanoe writes per-attribute value lists into the tile metadata, so the
// months an archive actually holds are recorded in the file. Reading them means
// a facet can never offer a month the archive lacks, or omit one it gained —
// the two ways a hardcoded CT_MONTHS goes wrong, in opposite directions, as
// soon as the build granularity or the publishing schedule changes.
//
// TWO THINGS HERE ARE ABOUT SPEED, AND BOTH WERE BUGS
//
// It takes the instance rather than making one. An earlier version called
// `new pmtiles.PMTiles(url)` here, AFTER map.addSource had already run — by
// which point the protocol had built its own instance for the same file. So
// every layer fetched the header and the root directory twice, and the second
// pair of requests competed with the tiles the reader was waiting on. The
// instance is now created and registered before the source, so the map and this
// share one.
//
// And it is deferred. Metadata is for a panel row nobody is looking at during
// the first paint; tiles are what the reader is waiting for. Called on the first
// idle, so it uses the connection after the map has drawn rather than during.
//
// No data is affected either way. This reads the archive's own index; it
// changes when a request happens, not what the archive contains.
async function learnFacetValues(cfg, archive) {
  try {
    const md = await archive.getMetadata();
    const values = facetValuesFrom(md, cfg.facet.property);
    if (!values.length) throw new Error("no recorded values for " + cfg.facet.property);
    cfg.facet.values = values;
    refreshFacetRow(cfg);
  } catch (e) {
    console.warn(`[culprits] ${cfg.id}: could not read facet values from the ` +
                 `archive (${e.message}). The declared list stands.`);
  }
}

// tippecanoe has written this in more than one shape across versions: a
// top-level `tilestats`, or a `json` key holding either a string or an object.
// All three are tried rather than assuming the one this build happens to emit.
function facetValuesFrom(md, property) {
  if (!md) return [];
  let stats = md.tilestats;
  if (!stats && md.json) {
    try {
      const j = typeof md.json === "string" ? JSON.parse(md.json) : md.json;
      stats = j.tilestats;
    } catch (_) { /* not JSON; fall through to the empty list */ }
  }
  const layers = (stats && stats.layers) || [];
  const out = new Set();
  for (const layer of layers) {
    for (const attr of layer.attributes || []) {
      if (attr.attribute !== property) continue;
      for (const v of attr.values || []) out.add(String(v));
    }
  }
  return [...out].sort();
}

// How big a dot is before zoom is taken into account.
//
// Two cases share the aggregate layer. Large sources are clustered, so `_count`
// is how many sites a dot stands for. Small sources are not clustered, so every
// `_count` is 1 and size has to come from the magnitude instead — otherwise
// every dot renders at the minimum and the map reads flat.
//
// Referenced four times in the radius below, once per zoom stop. Defined here
// so the four stay identical: four hand-written copies would drift, and a dot
// that changes meaning between z6 and z7 is worse than one that is too big.
const MAGNITUDE_RADIUS = [
  "case",
  [">", ["coalesce", ["get", "_count"], 1], 1],
  ["interpolate", ["linear"], ["get", "_count"],
    1, 4, 10, 7, 100, 11, 1000, 17, 10000, 23],
  ["interpolate", ["linear"], ["sqrt", ["coalesce", ["get", "value"], 0]],
    0, 2.5, 1, 4, 3, 7, 6, 12],
];

async function addPmtilesLayer(cfg) {
  // Per layer, defaulting to no change. Set radiusScale on a layer whose dots
  // crowd at low zoom; everything else keeps the shared ramp exactly.
  const scale = typeof cfg.radiusScale === "number" ? cfg.radiusScale : 1;
  // A layer may draw from another layer's archive — see climate_trace_cafo.
  // The source and source-layer keep the OWNER's id; only the map layers and
  // the filter belong to this one.
  const owner = cfg.sourceOf || cfg.id;
  // History years live on R2, not in the repo, so a layer may name its own
  // archive. Everything else resolves against the repo's tiles directory.
  const url = cfg.archiveUrl || `${TILE_BASE}/${owner}.pmtiles`;
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) throw new Error(`${head.status} at ${url}`);
  } catch (e) {
    // The file as well as the failure: "Failed to fetch" on its own cannot be
    // told apart from a wrong address, a blocked request or a file that never
    // deployed, and the address is the first thing to check.
    setLayerState(cfg.id, `archive missing (${e.message}) \u2014 ${url}`);
    console.error(`[culprits] ${cfg.id}: ${e.message} at ${url}`);
    return;
  }

  const src = `${owner}-src`;
  // Added once; a second layer over the same archive reuses it.
  if (!map.getSource(src)) {
    // Registered with the protocol BEFORE the source exists, so the map reuses
    // this instance instead of building a second one for the same file. One
    // header fetch and one root-directory fetch per archive, not two.
    let archive = null;
    try {
      archive = new pmtiles.PMTiles(url);
      protocol.add(archive);
    } catch (e) {
      // No instance is not fatal — the protocol makes its own from the URL, as
      // it did before. Only the deduplication and the facet read are lost.
      console.warn(`[culprits] ${cfg.id}: could not pre-register the archive ` +
                   `(${e.message}). Falling back to the protocol's own instance.`);
    }

    map.addSource(src, { type: "vector", url: `pmtiles://${url}` });
    // The largest amount in the archive, from tippecanoe's own statistics, so
    // the glow can weigh each source by its share of it. Read before the
    // layers are added, since their weight expression is set at that moment.
    if (archive && !glowMaxOf.has(src)) {
      try {
        const meta = await archive.getMetadata();
        const stats = (meta && (meta.tilestats || (typeof meta.json === "string" ? JSON.parse(meta.json).tilestats : undefined))) || {};
        const lay = (stats.layers || []).find((l) => l.layer === owner) || (stats.layers || [])[0];
        const attr = lay && (lay.attributes || []).find((x) => x.attribute === "value");
        if (attr && Number.isFinite(Number(attr.max)) && Number(attr.max) > 0) glowMaxOf.set(src, Number(attr.max));
      } catch (e) { /* no statistics: the glow weighs points alike */ }
    }
    // An archive that declares its own facet values is asked for them, so a
    // year archive offers its twelve months rather than the shared list's
    // sixty-six. Failure here is not fatal: the declared list stands and the
    // reason is logged, because a facet that silently empties looks like a
    // layer with no data.
    if (archive && cfg.facet && Array.isArray(cfg.facet.values) &&
        cfg.facet.values.length === 0) {
      // After the map has drawn, not while it is drawing.
      map.once("idle", () => learnFacetValues(cfg, archive));
    }
  }

  // Aggregate view. tippecanoe summed `value` into the clustered features, so
  // radius can encode magnitude *within this layer* without claiming anything
  // about any other.
  if (cfg.fine) {
    // Climate TRACE: hundreds of thousands of points per layer. Plain dots,
    // one size at each zoom, no rim: sized by magnitude or ringed they read as
    // bubbles. The size of an emission is in the popup, not in the dot.
    map.addLayer({
      id: `${cfg.id}-agg`, type: "circle", source: src, "source-layer": owner,
      ...(cfg.where ? { filter: cfg.where } : {}),
      maxzoom: CLUSTER_MAXZOOM,
      paint: {
        "circle-color": cfg.colour,
        "circle-opacity": .9,
        "circle-blur": 0,
        "circle-stroke-width": 0,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 1.2, 3, 1.7, 6, 2.4, 8, 3],
      },
    });
  } else
  map.addLayer({
    id: `${cfg.id}-agg`,
    type: "circle",
    source: src,
    "source-layer": owner,
    ...(cfg.where ? { filter: cfg.where } : {}),
    maxzoom: CLUSTER_MAXZOOM,
    paint: {
      "circle-color": cfg.colour,
      "circle-stroke-color": cfg.colour,
      // Hard edges. The soft edge tried here before was a blur, and a field of
      // blurred discs is exactly the smear it was meant to avoid: small, sharp
      // and thinly outlined reads as many marks, not one cloud.
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 0, .6, 5, 1],
      "circle-blur": 0,
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 0, .3, 3, .42, 6, .55],
      // Two cases share this layer. Large sources are clustered, so _count is
      // how many sites a dot stands for. Small sources are not clustered, so
      // every _count is 1 and size must come from the magnitude instead —
      // otherwise every dot renders at the minimum and the map reads flat.
      // Radius is scaled by zoom as well as by magnitude. Sized on magnitude
      // alone, a 10,000-site cluster drew a 26px disc at z2, and half a dozen
      // of those covered whole continents in overlapping blobs — the global
      // view showed less than a blank map would. The multiplier keeps the
      // relative sizes intact (a big cluster is still visibly bigger than a
      // small one) while shrinking everything at the zooms where they collide.
      //
      // ZOOM HAS TO BE THE OUTERMOST EXPRESSION. Written as
      // ["*", ["interpolate", … ["zoom"] …], <magnitude>] this is rejected by
      // MapLibre — "zoom expression may only be used as input to a top-level
      // step or interpolate expression" — and the rejection throws out of
      // addLayer, so addPmtilesLayer aborts and the layer silently never
      // exists. It reads exactly like a missing archive. Same arithmetic,
      // legal shape: interpolate on zoom at the top, and the magnitude
      // multiplied in at each stop.
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        // Much smaller at the top than the magnitude alone would give. At 0.55
        // a 10,000-site cluster drew a 25px disc at z0 and a handful of them
        // merged into one blob over each continent — the global view carried
        // less information than an empty map. The relative sizes are untouched:
        // a big cluster is still visibly bigger than a small one at every zoom.
        0,  ["*", 0.18 * scale, MAGNITUDE_RADIUS],
        3,  ["*", 0.30 * scale, MAGNITUDE_RADIUS],
        6,  ["*", 0.60 * scale, MAGNITUDE_RADIUS],
        10, ["*", 1.00 * scale, MAGNITUDE_RADIUS],
      ],
    },
  });

  // Individual features, from the threshold up. Only the visible tiles are
  // fetched, by range request, so this costs what the viewport costs.
  map.addLayer({
    id: `${cfg.id}-pt`,
    type: "circle",
    source: src,
    "source-layer": owner,
    ...(cfg.where ? { filter: cfg.where } : {}),
    minzoom: CLUSTER_MAXZOOM,
    paint: {
      "circle-color": cfg.colour,
      "circle-opacity": .75,
      "circle-stroke-color": "#17150F",
      "circle-stroke-width": .6,
      // A location layer draws every point the same size. Encoding magnitude
      // here would say "this farm matters more", which is not what the layer
      // is for, and with 37.7 million points it would read as noise regardless.
      "circle-radius": cfg.uniformRadius
        ? ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 4.5]
        : ["interpolate", ["linear"], ["zoom"], 8, 3.5, 14, 7],
      // Anything that is not a located facility is hollow, so it never reads
      // as one. Seven kinds: a country centroid, an administrative unit
      // (GADM province, GHS urban area), a model grid cell, an area (paddies,
      // fields, reservoirs), a road or rail segment, a vessel, and rows the
      // source gives no definition for. Every one of them is a point standing
      // in for something that is not a point.
      //
      // Only genuine facilities render solid: plants, mines, ports, airports,
      // refineries, waste sites — 23 of Climate TRACE's 91 definitions.
      "circle-opacity": ["case", ["in", ["get", "x_precision"],
        ["literal", ["country", "admin", "grid", "area", "segment", "mobile", "blurred", "locality", "unknown"]]], 0, .75],
      "circle-stroke-color": ["case", ["in", ["get", "x_precision"],
        ["literal", ["country", "admin", "grid", "area", "segment", "mobile", "blurred", "locality", "unknown"]]], cfg.colour, "#17150F"],
      "circle-stroke-width": ["case", ["in", ["get", "x_precision"],
        ["literal", ["country", "admin", "grid", "area", "segment", "mobile", "blurred", "locality", "unknown"]]], 1.4, .6],
    },
  });

  // Both layers, not just the detail one: below the cluster threshold the
  // aggregate layer is the only thing on screen, and it was unclickable.
  if (cfg.boxes) {
    // The points carry only an id, a title and a date; the record itself is in
    // the copy, in 256 pieces, and a click reads the one piece that holds it.
    bindHtmlPopup(`${cfg.id}-agg`, (p) => pieceBox(cfg, p));
    bindHtmlPopup(`${cfg.id}-pt`, (p) => pieceBox(cfg, p));
    fetch(url.replace(/\.pmtiles$/, ".build.json")).then((r) => (r.ok ? r.json() : null)).then((b) => {
      if (!b) return;
      setLayerState(cfg.id, `${Number(b.alerts_with_position).toLocaleString()} ${cfg.unit}` +
        (b.no_position ? ` \u00b7 ${Number(b.no_position).toLocaleString()} more in the copy have no position and cannot be drawn` : ""));
    }).catch(() => {});
  } else {
    bindPopup(`${cfg.id}-agg`);
    bindPopup(`${cfg.id}-pt`);
  }
  applyVisibility(cfg.id);
  buildLegend();
}

// Which of a copy's 256 pieces a record is in: FNV-1a over its id, two hex
// digits. scripts/skytruth.py in culprits-tiles-more has the same function;
// the two must agree.
function pieceOf(key) {
  let h = 0x811C9DC5;
  for (const b of new TextEncoder().encode(String(key))) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return (h % 256).toString(16).padStart(2, "0");
}
const pieces = new Map();
const noPieces = new Set();      // sources whose pieces are not there, so they are not asked for again
function readPiece(base, key) {
  const at = `${base}/${pieceOf(key)}.json`;
  if (!pieces.has(at)) {
    const p = fetch(at).then((r) => { if (!r.ok) throw new Error(`${r.status} at ${at}`); return r.json(); });
    p.catch(() => pieces.delete(at));
    pieces.set(at, p);
  }
  return pieces.get(at);
}
function pieceBox(cfg, p) {
  const count = Number(p._count || 1);
  if (count > 1) {
    return `<b>${count.toLocaleString()} ${escapeHtml(cfg.unit || "records")}</b>` +
      `<div class="meta">Merged for this zoom. Zoom in to see each one.</div><div class="meta">${escapeHtml(p.source || "")}</div>`;
  }
  return readPiece(cfg.boxes, p.id).then((piece) => {
    const f = piece[String(p.id)];
    if (!f) return `<b>${escapeHtml(p.name || "")}</b><div class="meta">not found in the copy (id ${escapeHtml(p.id)})</div>`;
    const props = f.properties || {};
    // The record's own box (_html, made safe when it was copied) and then every
    // other field it carries, so nothing the source published is out of reach.
    const rest = Object.entries(props).filter(([k, v]) => !["_html", "content", "title"].includes(k) && v !== null && v !== "")
      .map(([k, v]) => `<tr><th>${escapeHtml(k.replace(/_/g, " "))}</th><td>${escapeHtml(String(v))}</td></tr>`).join("");
    return (props._html || `<b>${escapeHtml(props.title || p.name || "")}</b>`) + (rest ? `<table class="meta">${rest}</table>` : "");
  }).catch((e) => `<b>${escapeHtml(p.name || "")}</b><div class="meta">its record could not be read (${escapeHtml(e.message)})</div>`);
}

/* ---------- country aggregate layers (choropleth) ---------- */

// Some sources have no coordinates — only totals per country. Those draw
// against real national borders rather than centroids, because a centroid
// dressed as a point claims a location the source never gave.
let boundariesAdded = false;

// One boundaries source for the country layers and the outlines basemap.
// MapLibre throws on a second addSource with the same id, so both ask here.
const BOUNDARIES_URL = `${DATA_BASE}/boundaries.geojson`;

function ensureBoundaries() {
  if (boundariesAdded) return;
  map.addSource("boundaries", { type: "geojson", data: `${DATA_BASE}/boundaries.geojson`,
                                promoteId: "iso3" });
  boundariesAdded = true;
}

// Added first on load, so everything after sits above them: imagery and relief
// (from the style), then the washes, then the painted plate, then labels and
// every data layer.
function addBasemapLayers() {
  if (map.getLayer("atlas-plate")) return;
  map.addLayer(atlasWashes);
  map.addSource("atlas-plate", { type: "image", url: PLATE.url,
                                 coordinates: PLATE.coordinates });
  map.addLayer({
    id: "atlas-plate", type: "raster", source: "atlas-plate",
    // zoom at the top level of the expression: MapLibre rejects it nested.
    paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"],
                                PLATE.fadeIn, 1, PLATE.fadeOut, 0],
             "raster-fade-duration": 0 },
  });
}

// Drawn under the washes and plate, which are both off while it shows. Added
// the first time outlines are chosen, not on load: the boundary file is 1.7 MB
// and most readers never open this basemap.
const OFM = "https://tiles.openfreemap.org/planet";
const OUTLINE_IDS = ["outline-relief", "outline-water", "outline-green", "outline-town", "outline-waterway",
                     "outline-rail", "outline-road-minor", "outline-road", "outline-road-major", "outline-buildings"];
function OUTLINE_DETAIL(map) {
  if (!map.getSource("osm")) map.addSource("osm", { type: "vector", url: OFM,
    attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © OpenStreetMap contributors' });
  if (!map.getSource("outline-dem")) map.addSource("outline-dem", Object.assign({}, TERRAIN_SOURCE));
  const fade = (a) => ["interpolate", ["linear"], ["zoom"], 3.5, 0, 6, a];
  const road = (w) => ["interpolate", ["exponential", 1.4], ["zoom"], 5, w * .3, 10, w, 16, w * 6];
  const kind = (list) => ["match", ["get", "class"], list, true, false];
  return [
    { id: "outline-relief", type: "hillshade", source: "outline-dem", minzoom: 3.5,
      paint: { "hillshade-exaggeration": .45, "hillshade-shadow-color": "#050504",
               "hillshade-highlight-color": "#4A4A40", "hillshade-accent-color": "#15150F" } },
    // Solid, in the sea's own colour, over the relief: the elevation tiles
    // carry the sea floor too, and its shading read as texture on the water.
    { id: "outline-water", type: "fill", source: "osm", "source-layer": "water", minzoom: 3.5,
      paint: { "fill-color": "#0B1017", "fill-opacity": 1 } },
    { id: "outline-green", type: "fill", source: "osm", "source-layer": "landcover", minzoom: 5,
      filter: kind(["wood", "forest", "grass", "wetland", "farmland"]),
      paint: { "fill-color": ["match", ["get", "class"], ["wood", "forest"], "#1C2A20", "wetland", "#1B2624", "#212720"],
               "fill-opacity": fade(.8) } },
    { id: "outline-town", type: "fill", source: "osm", "source-layer": "landuse", minzoom: 6,
      filter: kind(["residential", "commercial", "industrial", "retail", "suburb", "neighbourhood"]),
      paint: { "fill-color": ["match", ["get", "class"], "industrial", "#2A2826", "#262625"], "fill-opacity": fade(.9) } },
    { id: "outline-waterway", type: "line", source: "osm", "source-layer": "waterway", minzoom: 6,
      paint: { "line-color": "#22323C", "line-width": road(.9) } },
    { id: "outline-rail", type: "line", source: "osm", "source-layer": "transportation", minzoom: 9,
      filter: kind(["rail", "transit"]),
      paint: { "line-color": "#46494A", "line-width": 1, "line-dasharray": [3, 2] } },
    { id: "outline-road-minor", type: "line", source: "osm", "source-layer": "transportation", minzoom: 11,
      filter: kind(["minor", "service", "track", "street", "street_limited"]),
      paint: { "line-color": "#34373A", "line-width": road(.45) } },
    { id: "outline-road", type: "line", source: "osm", "source-layer": "transportation", minzoom: 7,
      filter: kind(["secondary", "tertiary"]),
      paint: { "line-color": "#44484A", "line-width": road(.6) } },
    { id: "outline-road-major", type: "line", source: "osm", "source-layer": "transportation", minzoom: 4,
      filter: kind(["motorway", "trunk", "primary"]),
      paint: { "line-color": "#5E6264", "line-width": road(.8), "line-opacity": fade(1) } },
    { id: "outline-buildings", type: "fill-extrusion", source: "osm", "source-layer": "building", minzoom: 13,
      paint: { "fill-extrusion-color": "#34383A",
               "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
               "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
               "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, .9] } },
  ];
}

function addOutlineLayers() {
  if (map.getLayer("outline-land")) return;
  ensureBoundaries();
  // The sea, as one sheet the size of the world, so the outline map is a card
  // with edges, dragged out into the stars like the satellite map, rather than
  // continents floating on them.
  if (!map.getSource("outline-ocean")) {
    map.addSource("outline-ocean", { type: "geojson", data: { type: "Feature", properties: {},
      geometry: { type: "Polygon", coordinates: [[[-180, -85.06], [180, -85.06], [180, 85.06], [-180, 85.06], [-180, -85.06]]] } } });
  }
  map.addLayer({ id: "outline-ocean", type: "fill", source: "outline-ocean",
                 paint: { "fill-color": "#141C1F", "fill-antialias": false } }, "atlas-washes");
  map.addLayer({ id: "outline-land", type: "fill", source: "boundaries",
                 paint: { "fill-color": "#202825" } }, "atlas-washes");
  // Closer in, the plain shapes give nothing to find a place by. OpenStreetMap
  // from OpenFreeMap (vector tiles: free, no key, no limits), drawn here in this
  // map's own muted darks: relief shading from the elevation tiles, water,
  // woods and parks, towns, roads and rail, and from zoom 13 every building
  // raised to its mapped height. Names come from the labels layer.
  for (const l of OUTLINE_DETAIL(map)) map.addLayer(l, "atlas-washes");
  map.addLayer({ id: "outline-line", type: "line", source: "boundaries",
                 paint: { "line-color": "rgba(214,211,200,.17)",
                          "line-width": ["interpolate", ["linear"], ["zoom"], 3, .6, 4, .9] } },
               "atlas-washes");
}

function setBasemap(kind) {
  BASEMAP = kind;
  const show = (id, on) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  };
  const imagery = kind !== "outlines";
  if (!imagery) addOutlineLayers();
  show("base", imagery);
  show("hillshade", imagery && !TERRAIN_ON);
  show("atlas-plate", kind === "atlas");
  show("outline-ocean", !imagery);
  show("outline-land", !imagery);
  OUTLINE_IDS.forEach((id) => show(id, !imagery));
  show("outline-line", !imagery);
  if (imagery && map.getLayer("base")) {
    for (const [k, v] of Object.entries(BASE_GRADE[kind])) map.setPaintProperty("base", k, v);
  }
  // The plate carries its own drawn place names, so map labels wait until it
  // has faded, as they do on the Leaflet atlas.
  if (map.getLayer("labels")) {
    map.setPaintProperty("labels", "raster-opacity", kind === "atlas"
      ? ["interpolate", ["linear"], ["zoom"], PLATE.fadeIn, 0, PLATE.fadeOut, .92]
      : .92);
  }
  defenceMode(kind === "satellite");
  if (typeof map.triggerRepaint === "function") map.triggerRepaint();
}

/* ---------- the Satellite basemap as a planetary-defence view ---------- */
// Only on the Satellite imagery basemap. The imagery stays the photograph; on
// top of it:
//   - a livelier grade (BASE_GRADE.satellite) and a teal atmosphere;
//   - a fine frame at the screen's edges and a faint vignette (index.html,
//     #defence-hud), neither of which takes clicks;
//   - every ticked layer under Destruction whose places are points gets a soft
//     red halo beneath its own points, held steady: a threat zone at each real
//     site, never a place the layer does not give;
//   - Global Safety Net's areas (the places identified for protection) sit a
//     little brighter than the imagery around them;
//   - a click answers with a ring where it landed.
// Nothing is invented: no scores, no places, no numbers. The only thing that
// moves is the ring a click leaves, and that stops for anyone whose system asks
// for reduced motion.
const DEFENCE = {
  threat: "#B8473E",
  sky: { "sky-color": "#0B1A22", "horizon-color": "#2F8F93", "fog-color": "#2F8F93",
         "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 0.85, 7, 0] },
  guard: ["gsn"],
  maxPulsing: 16,
};
let DEFENCE_ON = false, defenceTimer = null, defenceSky = null;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function destructionRows() {
  const out = [];
  if (typeof document === "undefined" || !document.querySelectorAll) return out;
  for (const sec of document.querySelectorAll("#layers .toc-sec.toc-l1")) {
    const t = sec.querySelector(".toc-t");
    if (!t || t.textContent.trim() !== "Destruction") continue;
    for (const i of sec.querySelectorAll("[data-layer]")) if (i.checked) out.push(i.dataset.layer);
  }
  return out;
}
function defenceHalos() {
  const ids = [];
  for (const row of destructionRows()) {
    for (const lid of layersOfRow(row)) {
      if (lid.endsWith("-halo")) continue;
      const l = map.getLayer(lid);
      if (!l || l.type !== "circle" || map.getLayoutProperty(lid, "visibility") === "none") continue;
      ids.push(lid);
      if (ids.length >= DEFENCE.maxPulsing) return ids;
    }
  }
  return ids;
}
function ensureHalo(lid) {
  const hid = `${lid}-halo`;
  if (map.getLayer(hid)) return hid;
  const l = map.getLayer(lid);
  const spec = { id: hid, type: "circle", source: l.source,
    paint: { "circle-color": DEFENCE.threat, "circle-blur": 1, "circle-opacity": 0,
             "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 6, 8, 11, 14, 16] } };
  if (l.sourceLayer) spec["source-layer"] = l.sourceLayer;
  // Only at the zooms its layer draws at.
  if (l.minzoom != null) spec.minzoom = l.minzoom;
  if (l.maxzoom != null) spec.maxzoom = l.maxzoom;
  const filter = map.getFilter(lid);
  if (filter) spec.filter = filter;
  try { map.addLayer(spec, lid); } catch (e) { return null; }
  return hid;
}
function defenceTick() {
  if (!DEFENCE_ON) return;
  const live = new Set();
  // Steady, not throbbing. A pulse that grew and faded every 2.8 seconds read
  // as an arcade screen rather than an instrument, and it kept the map
  // redrawing while nothing on it had changed. Each threatened point keeps one
  // soft halo at a fixed size and a low opacity; what moves is the map.
  for (const lid of defenceHalos()) {
    const hid = ensureHalo(lid);
    if (!hid) continue;
    live.add(hid);
    map.setLayoutProperty(hid, "visibility", "visible");
    const f = map.getFilter(lid);
    map.setFilter(hid, f || null);
    map.setPaintProperty(hid, "circle-opacity", 0.22);
    map.setPaintProperty(hid, "circle-radius", ["interpolate", ["linear"], ["zoom"],
      1, 5, 8, 9, 14, 13]);
  }
  for (const l of map.getStyle().layers || []) {
    if (l.id.endsWith("-halo") && !live.has(l.id)) map.setLayoutProperty(l.id, "visibility", "none");
  }
  // The places identified for protection are lifted a little out of the
  // imagery and left there, rather than breathing in and out.
  for (const row of DEFENCE.guard) {
    if ((visibility.get(row) || "none") !== "visible") continue;
    for (const lid of layersOfRow(row)) {
      const l = map.getLayer(lid);
      if (l && l.type === "raster") map.setPaintProperty(lid, "raster-brightness-min", 0.11);
    }
  }
}
function defenceMode(on) {
  if (!map || typeof map.getStyle !== "function") return;
  DEFENCE_ON = on;
  const hud = typeof document !== "undefined" && document.getElementById ? document.getElementById("defence-hud") : null;
  if (hud) hud.hidden = !on;
  if (typeof map.setSky === "function") {
    if (on) {
      if (!defenceSky && typeof map.getSky === "function") defenceSky = map.getSky();
      map.setSky(Object.assign({}, defenceSky || {}, DEFENCE.sky));
    } else if (defenceSky) { map.setSky(defenceSky); defenceSky = null; }
  }
  // Nothing animates any more, so this only has to notice a row being ticked
  // or unticked: twice a second instead of eleven times.
  if (on && !defenceTimer) { defenceTick(); defenceTimer = setInterval(defenceTick, 500); }
  if (!on && defenceTimer) {
    clearInterval(defenceTimer);
    defenceTimer = null;
    for (const l of (map.getStyle() && map.getStyle().layers) || []) {
      if (l.id.endsWith("-halo")) map.setLayoutProperty(l.id, "visibility", "none");
    }
    for (const row of DEFENCE.guard) for (const lid of layersOfRow(row)) {
      const l = map.getLayer(lid);
      if (l && l.type === "raster") map.setPaintProperty(lid, "raster-brightness-min", 0);
    }
  }
}
if (typeof map.on === "function") map.on("click", (e) => {
  if (!DEFENCE_ON || reducedMotion() || typeof document === "undefined") return;
  const box = map.getContainer && map.getContainer();
  if (!box || !box.appendChild) return;
  const ring = document.createElement("div");
  ring.className = "defence-ping";
  ring.style.left = `${e.point.x}px`;
  ring.style.top = `${e.point.y}px`;
  box.appendChild(ring);
  setTimeout(() => ring.remove(), 1000);
});

/* ---------- views, and the hand-over to NASA's Eyes ---------- */

// MapLibre's own projection names. "globe" is its globe that turns into the
// flat map between zoom 10 and 12; "vertical-perspective" stays a globe.
const VIEWS = {
  "globe": { projection: "vertical-perspective", leave: true, nm: "Globe" },
  "flat":  { projection: "mercator", leave: false, nm: "Flat map" },
};
let VIEW = "globe";
let AWAY = false;             // true while Eyes has the screen
let leaving = false;          // guards the hand-over animation

// NASA's Eyes on the Solar System, centred on Earth, with its panels closed.
// Eyes writes its own embed address: open it, go to its settings, turn off
// "Show Interact Prompt on Load" (that is the "View 3D" button) along with
// anything else unwanted, then "Copy Embed Code" and paste the address here.
const SPACE_URL = "https://eyes.nasa.gov/apps/solar-system/#/earth?featured=false&logo=false" +
  "&shareButton=false&surfaceMapTiling=true&hd=true&minorMoons=true&heliosphere=true&lighting=natural";

// How Earth sits in Eyes, measured by eye once (open the map with #fit at the
// end of the address; see fitMode below). zoom is the map zoom whose globe is
// the same size as Earth in Eyes — measured at 2. lon and lat are the point
// facing the camera at the moment given by at. rate is how fast that point
// moves: "stars" if Eyes holds its camera against the stars (a sidereal day),
// "sun" if it holds it against the Sun (a solar day). If the globe and Earth
// line up when you calibrate but have drifted apart a day later, switch rate.
// Measured by the Commander with #fit on 18 September 2026. bearing turns the
// globe on the screen, for Earth's axis leaning sideways in Eyes.
const EYES_FIT = { zoom: 0.8, lon: -108, lat: 66, bearing: 0, at: "2026-09-18T01:14:17.620Z", rate: "stars" };
const TURN = { stars: 360.9856473, sun: 360 };   // degrees a day

// The globe's drawn radius in screen pixels, from MapLibre's own camera: the
// camera sits cameraToCenterDistance in front of the surface, the planet is
// worldSize / 2π across (wider near the poles, as MapLibre scales it), and the
// silhouette is where the line of sight grazes it.
function globeRadiusPx(zoom, lat) {
  const t = map.transform || {};
  const c2c = t.cameraToCenterDistance || (1.5 * (map.getCanvas().clientHeight || 800));
  const R = (512 * Math.pow(2, zoom)) / (2 * Math.PI) / Math.cos((lat || 0) * Math.PI / 180);
  const D = c2c + R;                             // camera to the planet's centre
  return c2c * R / Math.sqrt(D * D - R * R);
}

// The zoom at which the globe is exactly as big as Earth is in Eyes.
function handoffZoom() { return EYES_FIT.zoom; }

// The point on Earth facing Eyes' camera now, carried forward from the
// calibration by Earth's own rate of turn.
function eyesFacing(now) {
  const days = ((now || Date.now()) - Date.parse(EYES_FIT.at)) / 86400000;
  const lon = ((EYES_FIT.lon + TURN[EYES_FIT.rate] * days + 180) % 360 + 360) % 360 - 180;
  return { lon, lat: EYES_FIT.lat };
}

// MapLibre holds the flat map so that it always fills the window, which is why
// the drag stopped at the map's edges once the repeated copies were turned
// off. This hands the camera back whatever it was given, so the chart can be
// dragged and zoomed out into the stars around it.
function freeConstrain(lngLat, zoom) {
  const lat = Math.max(-89.9, Math.min(89.9, lngLat.lat));
  const lng = Math.max(-540, Math.min(540, lngLat.lng));
  return { center: new maplibregl.LngLat(lng, lat), zoom: zoom == null ? 0 : zoom };
}

function spaceFrame() { return document.getElementById("space"); }

// Two ways back: a box in the top right corner, beside Eyes' own search, and
// Earth itself — a circle the size the globe had when it handed over.
function showBack(on) {
  const back = document.getElementById("spaceBack");
  if (back) back.hidden = !on;
  const earth = document.getElementById("spaceEarth");
  if (!earth) return;
  if (on && earth.style) {
    const d = Math.round(2 * globeRadiusPx(handoffZoom(), EYES_FIT.lat));
    earth.style.width = d + "px";
    earth.style.height = d + "px";
  }
  earth.hidden = !on;
}

// Loaded before it is needed: Eyes is a whole application, and a cold start in
// the middle of the hand-over would show a black screen.
function warmSpace() {
  const f = spaceFrame();
  if (f && !f.src) { f.src = SPACE_URL; f.hidden = false; }
}

function panelsAway(on) {
  for (const sel of [".left-col", ".right-col", "#legend", ".wire", "#zoombox"]) {
    const el = document.querySelector(sel);
    if (el && el.classList) el.classList.toggle("away", on);
  }
}

let leftFrom = null;          // the view the map was at when Eyes took over

function leaveEarth() {
  if (AWAY || leaving) return;
  leaving = true;
  leftFrom = { center: map.getCenter(), zoom: Math.max(map.getZoom(), handoffZoom() + 0.6), view: VIEW };
  // From the flat map the world becomes a globe first, so what fades out is
  // the same Earth that fades in.
  if (drawnProjection() === "mercator") {
    if (typeof map.setProjection === "function") map.setProjection({ type: VIEWS.globe.projection });
    if (typeof map.setTransformConstrain === "function") map.setTransformConstrain(null);
  }
  warmSpace();
  const to = eyesFacing(Date.now());
  const done = () => {
    AWAY = true;
    leaving = false;
    const f = spaceFrame();
    if (f) { f.hidden = false; f.classList.add("on"); }
    showBack(true);
    const edge = document.getElementById("spaceEdge");
    if (edge) edge.hidden = false;
    const el = document.getElementById("map");
    if (el && el.classList) el.classList.add("away");
    panelsAway(true);
  };
  // Moved to Earth's own face and size first, then faded across.
  if (typeof map.easeTo === "function") {
    map.easeTo({ center: [to.lon, to.lat], zoom: handoffZoom(), bearing: EYES_FIT.bearing || 0, pitch: 0, roll: 0, duration: 900 });
    setTimeout(done, 950);
  } else {
    done();
  }
}

function backToMap() {
  if (!AWAY) return;
  AWAY = false;
  const f = spaceFrame();
  if (f) f.classList.remove("on");
  showBack(false);
  const edge = document.getElementById("spaceEdge");
  if (edge) edge.hidden = true;
  const el = document.getElementById("map");
  if (el && el.classList) el.classList.remove("away");
  panelsAway(false);
  // The way in mirrors the way out: the globe appears at the size Earth had in
  // Eyes, then grows back to the view that was left.
  if (leftFrom && typeof map.easeTo === "function") {
    map.jumpTo({ center: [eyesFacing(Date.now()).lon, EYES_FIT.lat], zoom: handoffZoom(), bearing: EYES_FIT.bearing || 0, pitch: 0 });
    if (leftFrom.view && leftFrom.view !== VIEW) setView(leftFrom.view);
    else if (leftFrom.view === "flat") setView("flat");
    map.easeTo({ center: leftFrom.center, zoom: leftFrom.zoom, duration: 1400 });
  }
  if (typeof map.triggerRepaint === "function") map.triggerRepaint();
}

// The wheel and the clicks in the middle of the screen belong to Eyes, which
// is another site's frame: this page never sees them. The edge of the screen
// is this page's own, so scrolling in there, or double-clicking, comes back.
function watchSpaceEdge() {
  const edge = document.getElementById("spaceEdge");
  if (!edge || !edge.addEventListener) return;
  edge.addEventListener("wheel", (e) => {
    if (AWAY && e.deltaY < 0) { if (e.preventDefault) e.preventDefault(); backToMap(); }
  }, { passive: false });
  edge.addEventListener("dblclick", () => { if (AWAY) backToMap(); });
}

// Zooming out past the globe is what leaves Earth. The map is stopped a little
// below the hand-over size so the last turn of the wheel has somewhere to go.
function watchForLeaving() {
  const edge = () => handoffZoom() - 0.1;
  // Only a zoom-out the reader makes leaves Earth. Without this the map would
  // hand over as it opened, because it opens near the hand-over size.
  let wasAbove = false;
  const check = () => {
    if (!VIEWS[VIEW].leave || AWAY || leaving) return;
    const z = map.getZoom();
    if (z > edge() + 0.25) wasAbove = true;
    if (z < handoffZoom() + 1.2) warmSpace();
    if (wasAbove && z <= edge() + 0.02) { wasAbove = false; leaveEarth(); }
  };
  map.on("zoom", check);
  map.on("moveend", check);
  const setEdge = () => { if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[VIEW].leave ? edge() : -2); };
  map.on("resize", setEdge);
  setEdge();
}

// The projection actually drawn. 3D terrain is drawn on either view: on the
// globe it needs MapLibre's "globe" (round at world scale, flattening close
// up), the one round projection that carries terrain; the flat map stays flat.
function drawnProjection(kind) {
  const p = VIEWS[kind || VIEW].projection;
  return TERRAIN_ON && p !== "mercator" ? "globe" : p;
}

function setView(kind) {
  if (!VIEWS[kind]) return;
  VIEW = kind;
  const proj = drawnProjection(kind);
  if (typeof map.setProjection === "function") map.setProjection({ type: proj });
  // The flat map zooms out to MapLibre's floor, -2: the chart a small card in the stars.
  if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[kind].leave ? handoffZoom() - 0.1 : -2);
  // The flat map is free of its own edges: drag it out into the stars.
  if (typeof map.setTransformConstrain === "function") {
    map.setTransformConstrain(proj === "mercator" ? freeConstrain : null);
  }
  skyForView(proj);
  if (!VIEWS[kind].leave && AWAY) backToMap();
  if (typeof map.triggerRepaint === "function") map.triggerRepaint();
}

// Lining the two up, once: open the map with #fit at the end of the address.
// Eyes is held over the globe at half transparency; the arrow keys turn the
// globe, +/- change its size, and the box prints the line to paste into
// EYES_FIT above.
function fitMode() {
  if (typeof location === "undefined" || !/(^|[#&])fit\b/.test(location.hash || "")) return;
  warmSpace();
  const f = spaceFrame();
  if (f) { f.hidden = false; f.classList.add("on"); f.style.opacity = ".5"; f.style.pointerEvents = "none"; }
  const box = document.createElement("div");
  box.className = "fit-box";
  document.body.appendChild(box);
  const state = { zoom: EYES_FIT.zoom, lon: EYES_FIT.lon, lat: EYES_FIT.lat, bearing: EYES_FIT.bearing || 0 };
  const draw = () => {
    EYES_FIT.zoom = state.zoom;
    map.jumpTo({ center: [state.lon, state.lat], zoom: handoffZoom(), bearing: state.bearing, pitch: 0 });
    box.innerHTML = "Line the globe up with Earth behind it. Arrows turn it, + and &#8722; resize it." +
      "<code>const EYES_FIT = { zoom: " + state.zoom.toFixed(3) + ", lon: " + state.lon.toFixed(2) +
      ", lat: " + state.lat.toFixed(2) + ", bearing: " + state.bearing.toFixed(1) +
      ', at: "' + new Date().toISOString() + '", rate: "stars" };</code>';
  };
  window.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.2 : 2;
    if (e.key === "ArrowLeft") state.lon -= step;
    else if (e.key === "ArrowRight") state.lon += step;
    else if (e.key === "ArrowUp") state.lat = Math.min(85, state.lat + step);
    else if (e.key === "ArrowDown") state.lat = Math.max(-85, state.lat - step);
    else if (e.key === "+" || e.key === "=") state.zoom += 0.05;
    else if (e.key === "-") state.zoom -= 0.05;
    else if (e.key === "[" || e.key === "{") state.bearing -= step;
    else if (e.key === "]" || e.key === "}") state.bearing += step;
    else return;
    e.preventDefault();
    draw();
  });
  draw();
}

/* ---------- the news wires, on the map ---------- */

// wire.js hands over the stories it is showing that name a place. The feeds
// publish their own table of place coordinates; the map repos' wires give a
// country code, placed here from this map's own boundary file. Stories at one
// place become one mark, and clicking it lists them.
// A news mark reads on the painted atlas, on imagery and on the outlines alike:
// a near-white dot with a near-black rim, inside a thin light ring. No data
// layer on the map uses a rim or a ring, so a mark never reads as a site.
const WIRE_COLOUR = "#F2EEE6";
const WIRE_RIM = "#0D0C09";
let wireAt = new Map();          // "lng,lat" -> the stories there
let countryPoints = null;        // ISO -> [lng, lat], read once from the boundaries

async function countryCentres() {
  if (countryPoints) return countryPoints;
  countryPoints = new Map();
  try {
    const r = await fetch(BOUNDARIES_URL);
    const data = await r.json();
    for (const f of data.features || []) {
      const iso = (f.properties && (f.properties.iso_a2 || f.properties.ISO_A2 || f.properties.iso2 || f.properties.id)) || "";
      if (!iso || iso.length !== 2) continue;
      let minX = 180, maxX = -180, minY = 90, maxY = -90;
      const walk = (co) => {
        if (typeof co[0] === "number") {
          minX = Math.min(minX, co[0]); maxX = Math.max(maxX, co[0]);
          minY = Math.min(minY, co[1]); maxY = Math.max(maxY, co[1]);
        } else co.forEach(walk);
      };
      walk(f.geometry.coordinates);
      countryPoints.set(iso.toUpperCase(), [(minX + maxX) / 2, (minY + maxY) / 2]);
    }
  } catch (e) {
    console.warn("[culprits] country places for the wires could not be read:", e.message || e);
  }
  return countryPoints;
}

function wireSource() {
  if (!map.getSource("wire-news")) {
    map.addSource("wire-news", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    const r = (add) => ["interpolate", ["linear"], ["zoom"],
      1, ["interpolate", ["linear"], ["get", "n"], 1, 2.8 + add, 25, 5 + add],
      8, ["interpolate", ["linear"], ["get", "n"], 1, 3.6 + add, 25, 7 + add]];
    map.addLayer({
      id: "wire-news-ring", type: "circle", source: "wire-news",
      paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": r(3.2),
               "circle-stroke-color": "rgba(242,238,230,.8)", "circle-stroke-width": 1 },
    });
    map.addLayer({
      id: "wire-news", type: "circle", source: "wire-news",
      paint: { "circle-color": WIRE_COLOUR, "circle-radius": r(0),
               "circle-stroke-color": WIRE_RIM, "circle-stroke-width": 1.6 },
    });
    map.on("click", "wire-news", (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      popupClaimedBy = e.originalEvent || e;
      const list = wireAt.get(f.properties.k) || [];
      const pop = new maplibregl.Popup({ closeButton: true, maxWidth: "320px", className: "wire-pop" })
        .setLngLat(f.geometry.coordinates)
        .setHTML(`<b>${escapeHtml(f.properties.place || "News wire")}</b>` +
                 `<div class="meta">${list.length} ${list.length === 1 ? "story" : "stories"}</div>` +
                 (list.length > 1 ? `<div class="wire-pop-filters">${wirePopFilters(list)}</div>` : "") +
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
      if (el) for (const c of el.querySelectorAll("[data-wf]")) c.addEventListener(c.tagName === "INPUT" ? "input" : "change", redraw);
    });
    map.on("styledata", wireOnTop);
    map.on("mouseenter", "wire-news", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "wire-news", () => { map.getCanvas().style.cursor = ""; });
  }
  return map.getSource("wire-news");
}

// The box's filters: a menu for each subject and source, a search for the
// headline, and the order.
// The box above a mark's list: one menu per thing a story carries, plus the
// headline search and the order. A menu only appears where its stories differ
// on it - a menu with one value in it does nothing when set - and where some
// stories carry the value and others do not, the ones without get an option of
// their own rather than being left unreachable.
const WIRE_NOT_GIVEN = "\u0000none";
function wireDay(s) {
  if (s.date == null) return "";
  const d = new Date(s.date);
  return isFinite(d.getTime())
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : "";
}
function wireDayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}
function wirePopFilters(list) {
  const row = (key, label, values, missing, blank, labelOf) => {
    if (values.length + (missing ? 1 : 0) < 2) return "";
    return `<label class="wire-pop-sort">${label} <select data-wf="${key}"><option value="">All</option>` +
      values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(labelOf ? labelOf(v) : v)}</option>`).join("") +
      (missing ? `<option value="${WIRE_NOT_GIVEN}">${escapeHtml(blank)}</option>` : "") +
      `</select></label>`;
  };
  const menu = (key, label, blank) => {
    const values = [...new Set(list.map((s) => s[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    return row(key, label, values, list.some((s) => !s[key]), blank);
  };
  // Newest day first, which is the order the list itself opens in.
  const days = [...new Set(list.map(wireDay).filter(Boolean))].sort().reverse();
  return menu("subject", "Subject", "No subject given") +
    menu("outlet", "Source", "No source named") +
    menu("place", "Place", "No place named") +
    row("day", "Date", days, list.some((s) => !wireDay(s)), "No date given", wireDayLabel) +
    `<label class="wire-pop-sort">Headline <input data-wf="title" type="search" placeholder="words in the headline" ` +
    `style="flex:1;font:inherit;color:var(--bone);background:var(--peat,#17150F);border:1px solid var(--rule);border-radius:2px;padding:1px 4px"></label>` +
    `<label class="wire-pop-sort">Order <select data-wf="order">` +
    WIRE_SORTS.map(([k, nm]) => `<option value="${k}">${nm}</option>`).join("") + `</select></label>` +
    `<div class="meta wire-pop-n"></div>`;
}
function wirePopPick(list, f) {
  const words = String(f.title || "").toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const is = (s, key, want) => !want || (want === "\u0000none" ? !s[key] : s[key] === want);
  const onDay = (s, want) => !want || (want === "\u0000none" ? !wireDay(s) : wireDay(s) === want);
  return list.filter((s) => is(s, "subject", f.subject) && is(s, "outlet", f.outlet) && is(s, "place", f.place) &&
    onDay(s, f.day) && words.every((w) => String(s.title || "").toLocaleLowerCase().includes(w)));
}

// Every story at a mark, in the order chosen in its box.
const WIRE_SORTS = [["new", "Newest first"], ["old", "Oldest first"], ["subject", "Subject"],
                    ["outlet", "News source"], ["title", "Headline A–Z"]];
function wirePopRows(list, by) {
  const t = (s) => (s.date == null ? -Infinity : s.date);
  const txt = (v) => String(v || "\uffff").toLocaleLowerCase();
  const sorted = list.slice().sort((a, b) =>
    by === "old" ? t(a) - t(b) :
    by === "subject" ? txt(a.subject).localeCompare(txt(b.subject)) || t(b) - t(a) :
    by === "outlet" ? txt(a.outlet).localeCompare(txt(b.outlet)) || t(b) - t(a) :
    by === "title" ? txt(a.title).localeCompare(txt(b.title)) :
    t(b) - t(a));
  return sorted.map((s) =>
    `<div class="meta" style="margin:6px 0 0">` +
    (s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a>`
           : escapeHtml(s.title)) +
    `<br>${escapeHtml([s.subject, s.outlet, s.date != null ? new Date(s.date).toLocaleDateString() : ""]
      .filter(Boolean).join(" · "))}</div>`).join("");
}

// The news marks stay on top of everything, the painted plate included: the
// box is made before the basemap and the layers, which would otherwise all be
// drawn over it.
function wireOnTop() {
  if (!map.getLayer("wire-news") || typeof map.moveLayer !== "function") return;
  const order = typeof map.getLayersOrder === "function" ? map.getLayersOrder() : null;
  if (order && order[order.length - 1] === "wire-news" && order[order.length - 2] === "wire-news-ring") return;
  map.moveLayer("wire-news-ring");
  map.moveLayer("wire-news");
}

async function showWireStories(stories) {
  const src = wireSource();
  if (!src) return;
  const needsCountries = stories.some((s) => !s.at && s.iso);
  const centres = needsCountries ? await countryCentres() : null;
  wireAt = new Map();
  for (const s of stories) {
    const at = s.at || (centres && s.iso ? centres.get(String(s.iso).toUpperCase()) : null);
    if (!at) continue;
    const k = at[0].toFixed(3) + "," + at[1].toFixed(3);
    if (!wireAt.has(k)) wireAt.set(k, []);
    wireAt.get(k).push(Object.assign({ place: s.place }, s, { at }));
  }
  const features = [];
  for (const [k, list] of wireAt) {
    const [lng, lat] = k.split(",").map(Number);
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] },
                    properties: { k, n: list.length, place: list[0].place || "" } });
  }
  src.setData({ type: "FeatureCollection", features });
  wireOnTop();
}

// wire.js calls this whenever what it shows changes, or the tick box moves.
// The wires can arrive before the map has finished loading, and a source added
// then is refused; the latest list is kept and drawn as soon as the map is
// ready. wire.js also leaves its list on window.__wirePending if it ran first.
let wirePending = null;
function wireFlush() {
  if (!wirePending || !(map.isStyleLoaded && map.isStyleLoaded()) && !map.loaded()) return;
  const stories = wirePending;
  wirePending = null;
  showWireStories(stories).catch((e) => console.warn("[culprits] wires on the map:", e.message || e));
}
window.culpritsWire = {
  show(stories) {
    wirePending = Array.isArray(stories) ? stories : [];
    try { wireFlush(); } catch (e) { console.warn("[culprits] wires on the map:", e.message || e); }
  },
};
(map.once || map.on).call(map, "load", () => {
  if (!wirePending && Array.isArray(window.__wirePending)) wirePending = window.__wirePending;
  wireFlush();
});
map.on("idle", wireFlush);

/* ---------- each site map's own filters ---------- */

// Built by pipeline/sitemaps/build_boxes.py from the map's own controls. A
// place carries the values it matched as "|a|b|", so a chip is a substring
// test and a place can belong to more than one.
const sitemapFilters = new Map();     // map id -> { filters, picked: [Set], base: {layerId: filter} }

// A site map whose places file marks a filter "rows" gets a row of the layers
// box for each of its types, in place of its one row. The map is still one
// layer underneath: ticking types narrows it to them, exactly as chips would,
// and with no type ticked it is off. The places file is small and is read once
// the box is arranged, so the rows are there before anything is ticked.
const siteTypeRows = new Map();      // map id -> { fi, picked: Set, busy }

function siteTypeTitle(label, mapName) { return `${label} \u2014 ${mapName}`; }

function siteTypeSync(cfg) {
  const tr = siteTypeRows.get(cfg.id);
  const state = sitemapFilters.get(cfg.id);
  if (!tr || !state) return;
  state.picked[tr.fi] = tr.picked;
  applySitemapFilters(cfg.id);
}

async function siteTypeRowsFor(cfg) {
  const box = document.getElementById("layers");
  const own = box && box.querySelector ? box.querySelector(`[data-layer="${cfg.id}"]`) : null;
  const lead = own && own.closest ? own.closest("label") : null;
  if (!lead || !document.createElement || siteTypeRows.has(cfg.id)) return;
  let data;
  try { data = await getJson(cfg.dataUrl, 40000); } catch (e) { return; }      // the one row stays, as before
  const fi = (data.filters || []).findIndex((f) => f && f.rows && Array.isArray(f.values) && f.values.length > 1);
  if (fi < 0) return;
  const tr = { fi, picked: new Set(), busy: false };
  siteTypeRows.set(cfg.id, tr);
  const mapName = (lead.querySelector(".nm") && lead.querySelector(".nm").firstChild && lead.querySelector(".nm").firstChild.textContent) || cfg.name;
  const rows = data.filters[fi].values.map((v) => {
    const row = document.createElement("label");
    row.className = "layer layer-cat";
    row.innerHTML = `<input type="checkbox" data-smtype="${escapeHtml(cfg.id)}" data-k="${escapeHtml(v.k)}">` +
      `<span class="swatch" style="background:${cfg.colour}"></span>` +
      `<span class="body"><span class="nm">${escapeHtml(siteTypeTitle(v.label, mapName.trim()))}${siteLink(cfg.id)}</span>` +
      `<span class="un">${Number(v.n).toLocaleString()} ${escapeHtml(cfg.unit || "places")}</span></span>`;
    return row;
  });
  // After the row and whatever sits under it (its tools), which are then put
  // where removed rows go: still findable, out of sight.
  const own_nodes = rowNodes(lead);
  let at = own_nodes[own_nodes.length - 1];
  for (const row of rows) { at.after(row); at = row; }
  const gone = box.querySelector("[data-removed]");
  if (gone) own_nodes.forEach((n) => gone.appendChild(n)); else own_nodes.forEach((n) => { n.hidden = true; });
  countHeadings(box);
  const boxes = () => [...box.querySelectorAll(`[data-smtype="${cfg.id}"]`)];
  box.addEventListener("change", (e) => {
    const t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.smtype === cfg.id) {
      if (t.checked) tr.picked.add(t.dataset.k); else tr.picked.delete(t.dataset.k);
      tr.busy = true;
      try {
        if (own.checked !== tr.picked.size > 0) {
          own.checked = tr.picked.size > 0;
          own.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } finally { tr.busy = false; }
      siteTypeSync(cfg);
    } else if (t === own && !tr.busy) {
      // "All on" and "All off" tick the hidden row itself: every type follows it.
      tr.picked = new Set(own.checked ? boxes().map((i) => i.dataset.k) : []);
      boxes().forEach((i) => { i.checked = own.checked; });
      siteTypeSync(cfg);
    }
  });
}

function readSiteTypeRowsAtStart() {
  for (const g of GROUPS) for (const c of g.children) {
    if (c.ready && c.route === "sitemap" && c.typeRows && c.dataUrl) siteTypeRowsFor(c).catch((e) => console.warn(`[culprits] ${c.id} types: ${e.message}`));
  }
}

function sitemapChipRows(cfg) {
  const state = sitemapFilters.get(cfg.id);
  const box = document.getElementById("layers");
  if (!state || !box || !box.querySelector) return;
  const row = box.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (!anchor || !document.createElement) return;
  state.filters.forEach((f, i) => {
    if (siteTypeRows.has(cfg.id) && siteTypeRows.get(cfg.id).fi === i) return;      // its types are rows, not chips
    if (box.querySelector(`.facet[data-for="${cfg.id}-${i}"]`)) return;
    const el = document.createElement("div");
    el.className = "facet";
    el.dataset.for = `${cfg.id}-${i}`;
    // A wall of chips with the filter's name buried in the first one read as
    // one long list. The name is its own line now, with the chips under it and
    // a long list held to a few rows that scroll, so a row with fifteen brands
    // under it does not push the rest of the box off the screen.
    el.classList.add("facet-set");
    el.innerHTML = `<div class="fl">${escapeHtml(f.label)}` +
      `<button type="button" class="chip reset" data-sm="${cfg.id}" data-fi="${i}" data-k="">all</button></div>` +
      `<div class="fv">` + f.values.map((v) =>
        `<button type="button" class="chip" data-sm="${cfg.id}" data-fi="${i}" data-k="${escapeHtml(v.k)}">` +
        `${escapeHtml(v.label)} <em>${v.n.toLocaleString()}</em></button>`).join("") + `</div>`;
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

/* ---------- a site map coloured by a chosen value ---------- */
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
  el.classList.add("facet-set");
  el.innerHTML = `<div class="fl">Colour by` +
    (Array.isArray(c.years) && c.years.length
      ? `<select class="sm-year" data-smy="${id}" aria-label="Year">` +
        c.years.map((y) => `<option value="${y}"${y === year ? " selected" : ""}>${y}</option>`).join("") + `</select>`
      : "") + `</div>` +
    `<div class="fv">` + state.list.map((o, i) =>
      `<button type="button" class="chip${i === state.pick ? " on" : ""}" data-smc="${id}" data-ci="${i}">${escapeHtml(o.label)}</button>`).join("") + `</div>` +
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

/* ---------- a live ArcGIS map server (USDA's Commodity Explorers) ---------- */
// The server draws each square of the map as the view moves, and answers what
// is at a clicked spot, as the explorers' own pages ask it. Nothing is copied.
// Its colours are the server's; they are muted a little to sit with the atlas.
function addArcgisLayer(cfg) {
  const src = `${cfg.id}-img`;
  map.addSource(src, { type: "raster", tileSize: 256, attribution: cfg.attribution || "",
    tiles: [`${cfg.service}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256` +
            `&format=png32&transparent=true&dpi=96&f=image`] });
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: src,
    paint: { "raster-opacity": 0.8, "raster-saturation": -0.45 } });
  map.on("click", (e) => {
    if ((visibility.get(cfg.id) || "visible") !== "visible" || !map.getLayer(`${cfg.id}-raster`)) return;
    if (map.getLayoutProperty(`${cfg.id}-raster`, "visibility") === "none") return;
    arcgisIdentify(cfg, e.lngLat).then((html) => {
      if (html) new maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(e.lngLat).setHTML(html).addTo(map);
    }).catch((err) => console.warn(`[culprits] ${cfg.id}: ${err.message}`));
  });
  setLayerState(cfg.id, `live from ${cfg.attribution || "the source"}`);
  applyVisibility(cfg.id);
  buildLegend();
}

async function arcgisIdentify(cfg, at) {
  const b = map.getBounds(), c = map.getCanvas();
  const q = new URLSearchParams({ geometry: `${at.lng},${at.lat}`, geometryType: "esriGeometryPoint", sr: "4326",
    layers: "top", tolerance: "3", returnGeometry: "false", f: "json",
    mapExtent: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(","),
    imageDisplay: `${c.clientWidth || 800},${c.clientHeight || 600},96` });
  const r = await fetch(`${cfg.service}/identify?${q}`);
  if (!r.ok) throw new Error(`${r.status} from USDA`);
  const data = await r.json();
  const hits = (data && data.results) || [];
  if (!hits.length) return "";
  return hits.map((h) => arcgisBox(cfg, h)).join("<hr>");
}

// The explorers' own boxes: the crop and country with the sub-region and its
// rank on the percentage layer, the sub-region's name on the outline layer.
function arcgisBox(cfg, hit) {
  const a = hit.attributes || {};
  const get = (k) => a[k] != null ? a[k] : a[Object.keys(a).find((x) => x.toLowerCase() === k) || ""];
  if (hit.layerName === `${cfg.crop} Percentage`) {
    return `<b>${escapeHtml(cfg.crop)} - ${escapeHtml(get("cntryname") || "")}</b>` +
      `<div class="meta">Sub Region: ${escapeHtml(get("name") || "")}<br>Rank: ${escapeHtml(get("rank") || "")}</div>`;
  }
  if (hit.layerName === "Crop Explorer Subregions") {
    return `<b>${escapeHtml(get("name") || "")}</b><div class="meta">Sub Region: ${escapeHtml(get("name") || "")}</div>`;
  }
  const rows = Object.entries(a).filter(([k, v]) => v !== "" && v != null && !/^(objectid|shape|fid)/i.test(k) && v !== "Null")
    .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`);
  return `<b>${escapeHtml(hit.layerName || cfg.name)}</b>` + (rows.length ? `<div class="meta">${rows.join("<br>")}</div>` : "");
}

/* ---------- places read live from another site: uMap, KML, ArcGIS ---------- */
// Each source is read when its row is ticked, turned into the same shape as the
// site's own maps (places plus boxes), and drawn by the same code, so it gets the
// same rows, filter chips, hover and boxes. Colours are the source's own, moved a
// little toward the atlas's muted range.
function softColour(c, fallback) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
  if (!m) return c ? String(c) : fallback;
  const n = parseInt(m[1], 16), g = [0x7A, 0x75, 0x6C];
  const mix = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * 0.7 + g[i] * 0.3));
  return "#" + mix.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function relabelRow(id, title) {
  if (!title) return;
  const box = document.getElementById("layers");
  const row = box && box.querySelector && box.querySelector(`[data-layer="${id}"]`);
  const nm = row && row.closest && row.closest("label") && row.closest("label").querySelector(".nm");
  if (nm) nm.textContent = title;
}

// items: [{ geometry, key, name, colour, group, h, t }]
function livePlacesToSitemap(cfg, items) {
  const groups = new Map();
  const features = [], boxes = {};
  for (const it of items) {
    if (!it.geometry) continue;
    const g = it.group || "";
    if (g) groups.set(g, (groups.get(g) || 0) + 1);
    features.push({ type: "Feature", geometry: it.geometry,
      properties: { k: it.key, p: 1, t: it.name ? 1 : 0, n: it.name || "", c: softColour(it.colour, cfg.colour),
                    f: g ? `|g:${g}|` : "" } });
    if (!boxes[it.key]) boxes[it.key] = { h: it.h, t: it.name ? `<b>${escapeHtml(it.name)}</b>` : "", o: { maxWidth: 340, maxHeight: 420 } };
  }
  const filters = groups.size > 1
    ? [{ label: "Layer", values: [...groups].map(([g, n]) => ({ k: `g:${g}`, label: g, n })) }] : [];
  return { data: { type: "FeatureCollection", filters, features },
           boxes: { name: cfg.name, css: "", stylesheets: [], chain: [], boxes } };
}

async function addLivePlacesLayer(cfg) {
  let got;
  try {
    got = cfg.route === "umap" ? await readUmap(cfg)
        : cfg.route === "kml" ? await readKml(cfg)
        : cfg.route === "ll2" ? await readLaunchLibrary(cfg)
        : cfg.route === "ejatlas" ? await readEjatlas(cfg)
        : cfg.route === "geojsonlive" ? await readGeojsonFiles(cfg)
        : cfg.route === "wpgmza" ? await readWpgmza(cfg)
        : cfg.route === "atlascities" ? await readAtlasCities(cfg)
        : cfg.route === "trasefac" ? await readTraseFacilities(cfg)
        : await readArcgisApp(cfg);
    if (cfg.pdfs) linkAtlasPdfs(cfg, got.items);
  } catch (e) {
    setLayerState(cfg.id, `the source did not answer (${e.message})`);
    console.error(`[culprits] ${cfg.id}: ${e.message}`);
    return;
  }
  relabelRow(cfg.id, got.title);
  const { data, boxes } = livePlacesToSitemap(cfg, got.items);
  sitemapBoxes.set(cfg.id, Promise.resolve(boxes));
  await addSitemapLayer(cfg, data);
  if (got.note) setLayerState(cfg.id, `${data.features.length.toLocaleString()} ${cfg.unit} \u00b7 ${got.note}`);
}

async function getJson(url, ms = 25000) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
  let r;
  try { r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined); }
  catch (e) { throw new Error(ctrl && ctrl.signal.aborted ? `no answer in ${Math.round(ms / 1000)} s from ${url.split("?")[0]}` : e.message); }
  finally { if (timer) clearTimeout(timer); }
  if (!r.ok) throw new Error(`${r.status} at ${url}`);
  return r.json();
}

// uMap: the map's settings name its layers; each layer is its own GeoJSON.
function umapText(s) {
  return escapeHtml(String(s == null ? "" : s))
    .replace(/\{\{(https?:[^|}]+)(?:\|[^}]*)?\}\}/g, '<img src="$1" style="max-width:100%">')
    .replace(/\[\[(https?:[^|\]]+)\|([^\]]+)\]\]/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
    .replace(/\[\[(https?:[^\]]+)\]\]/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
}
// A uMap popup template: "# {name}" a heading, *…* italic, **…** bold, {field}
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

async function readUmap(cfg) {
  const m = await getJson(`${cfg.umap}/map/${cfg.umapId}/geojson/`);
  const props = m.properties || {};
  const layers = props.datalayers || m.datalayers || [];
  const items = [];
  // The map says where its layers live (urls.datalayer_view); older maps used
  // two fixed shapes of address, tried after it.
  const tpl = props.urls && (props.urls.datalayer_view || props.urls.datalayer_get);
  const site = cfg.umap.replace(/\/[a-z]{2}(-[a-z]+)?$/i, "");
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
    }
    if (!gj) continue;
    const opts = gj._umap_options || dl._umap_options || dl.settings || {};
    const group = opts.name || dl.name || "";
    (gj.features || []).forEach((f, i) => {
      const p = f.properties || {};
      const o = p._umap_options || {};
      items.push({ geometry: f.geometry, key: `${id}:${f.id || p.id || i}`, name: p.name || "", group,
        colour: o.color || opts.color || (props.color || null),
        h: `<div style="font:13px/1.4 system-ui,sans-serif;max-width:320px">` +
           umapPopup(o.popupContentTemplate || opts.popupContentTemplate || props.popupContentTemplate, p) + `</div>` });
    });
  }
  if (!items.length) console.warn(`[culprits] ${cfg.id}: no places read from ${layers.length} uMap layers; tried ${tried.join(" , ")}`);
  return { title: props.name || cfg.name, items };
}

// A place's address: its <address>, or else its address-like data fields
// (Address, City, State, Zip, Country ...) joined in the map's order — the
// same string scripts/mymaps_geocode.py looks up in culprits-tiles-more.
const MYMAPS_ADDR_FIELD = /^(full[ _]?)?(address|street|addr|city|town|state|province|region|zip|postal ?code|postcode|country|location)$/i;
function mymapsAddress(own, data) {
  const a = String(own || "").replace(/\s+/g, " ").trim();
  if (a) return a;
  return (data || []).filter(([k]) => MYMAPS_ADDR_FIELD.test(String(k || "").trim()))
    .map(([, v]) => String(v).replace(/\s+/g, " ").trim()).filter(Boolean).join(", ");
}

// KML (Google My Maps): placemarks with their folder, style colour and data.
function kmlColour(doc, styleUrl) {
  if (!styleUrl) return null;
  const id = styleUrl.replace(/^#/, "");
  let style = [...doc.getElementsByTagName("Style")].find((s) => s.getAttribute("id") === id);
  if (!style) {
    const map_ = [...doc.getElementsByTagName("StyleMap")].find((s) => s.getAttribute("id") === id);
    const pair = map_ && [...map_.getElementsByTagName("Pair")].find((p) => (p.getElementsByTagName("key")[0] || {}).textContent === "normal");
    const inner = pair && (pair.getElementsByTagName("styleUrl")[0] || {}).textContent;
    if (inner) style = [...doc.getElementsByTagName("Style")].find((s) => s.getAttribute("id") === inner.replace(/^#/, ""));
  }
  const c = style && (style.getElementsByTagName("color")[0] || {}).textContent;
  if (c && /^[0-9a-f]{8}$/i.test(c.trim())) { const t = c.trim(); return `#${t.slice(6, 8)}${t.slice(4, 6)}${t.slice(2, 4)}`; }
  const m = /-([0-9A-F]{6})(?:-|$)/i.exec(id);
  return m ? `#${m[1]}` : null;
}
function kmlCoords(el) {
  return String((el.getElementsByTagName("coordinates")[0] || {}).textContent || "").trim().split(/\s+/)
    .map((t) => t.split(",").map(Number)).filter((c) => c.length >= 2 && isFinite(c[0]) && isFinite(c[1])).map((c) => [c[0], c[1]]);
}
function kmlGeometries(pm) {
  const out = [];
  for (const p of pm.getElementsByTagName("Point")) { const c = kmlCoords(p)[0]; if (c) out.push({ type: "Point", coordinates: c }); }
  for (const l of pm.getElementsByTagName("LineString")) { const c = kmlCoords(l); if (c.length > 1) out.push({ type: "LineString", coordinates: c }); }
  for (const g of pm.getElementsByTagName("Polygon")) {
    const outer = g.getElementsByTagName("outerBoundaryIs")[0];
    const rings = [outer, ...g.getElementsByTagName("innerBoundaryIs")].filter(Boolean).map(kmlCoords).filter((r) => r.length > 3);
    if (rings.length) out.push({ type: "Polygon", coordinates: rings });
  }
  return out;
}
async function readKml(cfg) {
  const r = await fetch(cfg.kml);
  if (!r.ok) throw new Error(`${r.status} from Google`);
  const doc = new DOMParser().parseFromString(await r.text(), "application/xml");
  const docName = (doc.querySelector("Document > name") || {}).textContent || "";
  const items = [];
  // Places the map gives only as an address: positions looked up weekly from
  // OpenStreetMap by culprits-tiles-more (Google looks them up itself when it
  // draws the map, so its file carries none).
  const mid = (/[?&]mid=([^&]+)/.exec(cfg.kml) || [])[1];
  let looked = {};
  try { looked = await getJson(`https://welcometoyourgalaxy.github.io/culprits-tiles-more/mymaps/geocode_${mid}.json`); } catch (e) { /* not built yet */ }
  let fromAddress = 0, noPlace = 0;
  [...doc.getElementsByTagName("Placemark")].forEach((pm, i) => {
    const kid = (tag) => { const el = [...pm.children].find((c) => c.tagName === tag); return el ? el.textContent : ""; };
    const folder = pm.parentElement && pm.parentElement.tagName === "Folder"
      ? ([...pm.parentElement.children].find((c) => c.tagName === "name") || {}).textContent || "" : "";
    const data = [...pm.getElementsByTagName("Data")].map((d) =>
      [d.getAttribute("name"), (d.getElementsByTagName("value")[0] || {}).textContent || ""]).filter(([, v]) => v);
    const name = kid("name").trim();
    const desc = kid("description");
    // My Maps repeats the data fields in the description; show the description as written.
    const h = `<div style="font:13px/1.4 system-ui,sans-serif;max-width:320px"><h4 style="margin:0 0 6px">${escapeHtml(name)}</h4>` +
      (desc ? `<div>${desc}</div>` : data.map(([k, v]) => `<div><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</div>`).join("")) + `</div>`;
    const colour = kmlColour(doc, kid("styleUrl").trim());
    const geoms = kmlGeometries(pm);
    if (!geoms.length) {
      const addr = mymapsAddress(kid("address"), data);
      const at = addr && looked[addr];
      if (at) {
        fromAddress++;
        items.push({ geometry: { type: "Point", coordinates: at }, key: `pm${i}`, name, group: folder, colour,
          h: h.replace(/<\/div>$/, `<div style="margin-top:6px;font-size:11px">Position found from its address (${escapeHtml(addr)}) through OpenStreetMap; the map itself gives only the address.</div></div>`) });
      } else noPlace++;
      return;
    }
    geoms.forEach((g, j) => items.push({ geometry: g, key: `pm${i}`, name, group: folder, colour, h }));
  });
  const parts = [];
  if (fromAddress) parts.push(`${fromAddress.toLocaleString()} placed from their addresses`);
  if (noPlace) parts.push(`${noPlace.toLocaleString()} not yet placed (address not yet looked up or not found)`);
  return { title: docName.trim() || cfg.name, items, note: parts.join("; ") };
}

// ArcGIS: an app (web app, experience) names its web map; the web map names its
// layers and how each shows a clicked feature. Every feature is read.
const AGOL = "https://www.arcgis.com/sharing/rest/content/items";
async function arcgisWebmapsOf(itemId, seen = new Set()) {
  if (seen.has(itemId) || seen.size > 12) return [];
  seen.add(itemId);
  const info = await getJson(`${AGOL}/${itemId}?f=json`);
  if (info.error) throw new Error(info.error.message || "item not shared publicly");
  if (info.type === "Web Map") return [{ id: itemId, title: info.title }];
  if (info.type === "Feature Service" || info.type === "Map Service") return [{ service: info.url, title: info.title }];
  let text = "";
  try { text = await (await fetch(`${AGOL}/${itemId}/data?f=json`)).text(); } catch (e) { /* no data */ }
  const ids = [...new Set((text.match(/\b[0-9a-f]{32}\b/g) || []).filter((x) => x !== itemId))];
  const out = [];
  for (const id of ids) {
    try { out.push(...(await arcgisWebmapsOf(id, seen))); } catch (e) { /* not public or not a map */ }
  }
  if (!out.length) throw new Error("no public web map found in this app");
  out.title = info.title;
  return out;
}
function arcgisLayersOf(ops, out = []) {
  for (const l of ops || []) {
    if (l.layers && !l.url) arcgisLayersOf(l.layers, out);
    else if (l.url) out.push(l);
  }
  return out;
}
// `coarse` asks the server to draw the outlines at about a kilometre's
// precision instead of the survey's own. The hotspot outlines are tens of
// megabytes at full detail, which is most of a minute before anything appears
// and far more shape than a world map can draw; the boundary itself is
// unchanged, only how finely it is described on the way here. Layers that are
// read for their numbers rather than their edges never pass this.
async function arcgisQueryAll(url, coarse) {
  const feats = [];
  for (let offset = 0; offset < 100000; offset += 2000) {
    const q = `${url}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=2000` +
      (coarse ? `&maxAllowableOffset=${coarse}&geometryPrecision=4` : "");
    const j = await getJson(q);
    if (j.error) throw new Error(j.error.message || "query refused");
    feats.push(...(j.features || []));
    const more = j.exceededTransferLimit || (j.properties && j.properties.exceededTransferLimit);
    if (!more || !(j.features || []).length) break;
  }
  return feats;
}
function arcgisFill(template, attrs) {
  return String(template || "").replace(/\{([^}]+)\}/g, (all, k) => attrs[k] != null ? String(attrs[k]) : "");
}
function arcgisPopupHtml(title, info, attrs) {
  if (info && info.description) {
    return `<div style="font:13px/1.4 system-ui,sans-serif;max-width:320px"><h4 style="margin:0 0 6px">${escapeHtml(arcgisFill(info.title, attrs) || title)}</h4>` +
      `${arcgisFill(info.description, attrs)}</div>`;
  }
  const fields = info && info.fieldInfos
    ? info.fieldInfos.filter((f) => f.visible !== false).map((f) => [f.label || f.fieldName, attrs[f.fieldName]])
    : Object.entries(attrs).filter(([k]) => !/^(objectid|fid|shape)/i.test(k));
  return `<div style="font:13px/1.4 system-ui,sans-serif;max-width:320px"><h4 style="margin:0 0 6px">${escapeHtml(info ? arcgisFill(info.title, attrs) : title)}</h4>` +
    fields.filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `<div><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</div>`).join("") + `</div>`;
}
function arcgisSymbolColour(def, attrs) {
  const r = def && def.drawingInfo && def.drawingInfo.renderer;
  if (!r) return null;
  let sym = r.symbol;
  if (r.uniqueValueInfos && r.field1) {
    const hit = r.uniqueValueInfos.find((u) => String(u.value) === String(attrs[r.field1]));
    sym = (hit && hit.symbol) || r.defaultSymbol || sym;
  }
  const c = sym && sym.color;
  return Array.isArray(c) ? "#" + c.slice(0, 3).map((v) => Number(v).toString(16).padStart(2, "0")).join("") : null;
}
async function readArcgisApp(cfg) {
  setLayerState(cfg.id, "finding the map inside the ArcGIS app\u2026");
  const maps = await arcgisWebmapsOf(cfg.item);
  const items = [];
  let title = maps.title || (maps[0] && maps[0].title) || cfg.name;
  let skipped = 0;
  for (const wm of maps) {
    let layers = [];
    if (wm.service) {
      const s = await getJson(`${wm.service}?f=json`);
      layers = (s.layers || []).map((l) => ({ url: `${wm.service}/${l.id}`, title: l.name }));
    } else {
      const d = await getJson(`${AGOL}/${wm.id}/data?f=json`);
      for (const l of arcgisLayersOf(d.operationalLayers)) {
        if (/\/(FeatureServer|MapServer)\/\d+\/?$/.test(l.url)) layers.push(l);
        else {
          try {
            const s = await getJson(`${l.url.replace(/\/$/, "")}?f=json`);
            (s.layers || []).forEach((x) => layers.push({ url: `${l.url.replace(/\/$/, "")}/${x.id}`, title: `${l.title}: ${x.name}`, popupInfo: l.popupInfo, layerDefinition: l.layerDefinition }));
          } catch (e) { skipped++; }
        }
      }
    }
    for (const [n, l] of layers.entries()) {
      setLayerState(cfg.id, `reading layer ${n + 1} of ${layers.length}: ${l.title || ""}\u2026`);
      let feats;
      try { feats = await arcgisQueryAll(l.url.replace(/\/$/, ""), cfg.coarse); } catch (e) { skipped++; continue; }
      feats.forEach((f, i) => {
        const a = f.properties || {};
        const oid = a.OBJECTID != null ? a.OBJECTID : a.FID != null ? a.FID : i;
        const info = l.popupInfo;
        const name = info && info.title ? arcgisFill(info.title, a) : (a.Name || a.NAME || a.name || "");
        items.push({ geometry: f.geometry, key: `${l.url}|${oid}`, name, group: l.title || "",
          colour: arcgisSymbolColour(l.layerDefinition, a), h: arcgisPopupHtml(l.title || title, info, a) });
      });
    }
  }
  return { title, items, note: skipped ? `${skipped} layer${skipped > 1 ? "s" : ""} of the map would not answer` : "" };
}

/* ---------- pictures read live, with a choice of the source's own layers ---------- */
function addRasterChoiceLayer(cfg) {
  const src = `${cfg.id}-img`;
  cfg._pick = cfg._pick || 0;
  map.addSource(src, rasterChoiceSource(cfg));
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: src,
    paint: { "raster-opacity": 0.8, "raster-saturation": -0.35 } });
  let failed = 0;
  map.on("error", (e) => {
    if (e && e.sourceId === src) {
      failed++;
      setLayerState(cfg.id, `${cfg.choices[cfg._pick].label}: the source did not answer for ${failed} square${failed > 1 ? "s" : ""}`);
    }
  });
  if (cfg.choices.length > 1) rasterChoiceRow(cfg);
  setLayerState(cfg.id, `${cfg.choices[cfg._pick].label} \u00b7 live`);
  applyVisibility(cfg.id);
  buildLegend();
}
// A choice is live squares (tiles) or a PMTiles copy (archive).
function rasterChoiceSource(cfg) {
  const ch = cfg.choices[cfg._pick];
  return ch.archive
    ? { type: "raster", tileSize: 256, url: `pmtiles://${ch.archive}`, attribution: cfg.attribution || "" }
    : { type: "raster", tileSize: 256, maxzoom: cfg.maxzoom || 12, attribution: cfg.attribution || "", tiles: [ch.tiles] };
}
function rasterChoiceRow(cfg) {
  const box = document.getElementById("layers");
  const row = box && box.querySelector && box.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (!anchor || !document.createElement || box.querySelector(`.facet[data-raster-for="${cfg.id}"]`)) return;
  const el = document.createElement("div");
  el.className = "facet";
  el.dataset.rasterFor = cfg.id;
  el.innerHTML = cfg.choices.map((c, i) =>
    `<button type="button" class="chip${i === cfg._pick ? " on" : ""}" data-rc="${cfg.id}" data-ri="${i}">${escapeHtml(c.label)}</button>`).join("");
  if (anchor.after) anchor.after(el);
}
function rasterChoiceClicked(btn) {
  const cfg = childById(btn.dataset.rc);
  if (!cfg) return;
  cfg._pick = Number(btn.dataset.ri) || 0;
  const s = map.getSource(`${cfg.id}-img`);
  if (cfg.choices[cfg._pick].archive || !(s && s.setTiles)) {
    // A copy is its own archive: the source is replaced, in the same place in the drawing order.
    const order = map.getStyle().layers.map((l) => l.id);
    const at = order.indexOf(`${cfg.id}-raster`);
    const before = at >= 0 ? order[at + 1] : undefined;
    const paint = { "raster-opacity": map.getPaintProperty(`${cfg.id}-raster`, "raster-opacity") ?? 0.8, "raster-saturation": -0.35 };
    if (map.getLayer(`${cfg.id}-raster`)) map.removeLayer(`${cfg.id}-raster`);
    if (s) map.removeSource(`${cfg.id}-img`);
    map.addSource(`${cfg.id}-img`, rasterChoiceSource(cfg));
    map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: `${cfg.id}-img`, paint }, before && map.getLayer(before) ? before : undefined);
    applyVisibility(cfg.id);
  } else s.setTiles([cfg.choices[cfg._pick].tiles]);
  const box = document.getElementById("layers");
  const row = box && box.querySelector(`.facet[data-raster-for="${cfg.id}"]`);
  if (row) for (const c of row.querySelectorAll("[data-ri]")) c.classList.toggle("on", Number(c.dataset.ri) === cfg._pick);
  setLayerState(cfg.id, `${cfg.choices[cfg._pick].label} \u00b7 live`);
}

/* ---------- Trase: a measure per region, chosen as on Trase's own map ---------- */
const TRASE_RAMPS = {
  red: ["#E3D8D2", "#CDAEA4", "#B07F72", "#8C5548", "#643129"],
  blue: ["#D9DEE0", "#B3C0C6", "#8A9DA6", "#627A86", "#3F5663"],
  bluered: ["#3F5663", "#8A9DA6", "#DAD6CF", "#B07F72", "#643129"],
};
const traseCache = new Map();
function traseJson(url) {
  if (!traseCache.has(url)) {
    const p = fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status} at ${url}`); return r.json(); });
    p.catch(() => traseCache.delete(url));
    traseCache.set(url, p);
  }
  return traseCache.get(url);
}
function traseSlug(name) {
  return String(name || "").toLowerCase().replace(/'/g, " ").trim().replace(/\s+/g, "-");
}
// Five steps from the values themselves, so a few very large regions do not
// wash the rest into one colour.
function traseBreaks(values) {
  const v = values.filter((x) => typeof x === "number" && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return [];
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return [...new Set([q(0.2), q(0.4), q(0.6), q(0.8)])];
}
function traseFormat(x) {
  if (typeof x !== "number") return String(x);
  return Math.abs(x) >= 100 ? Math.round(x).toLocaleString() : x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Every measure Trase publishes, each as one entry across all the countries that
// publish it. Trase's own map shows one country at a time; here "Deforestation"
// is one layer drawn over Argentina, Bolivia, Brazil and the rest together.
// A country is drawn at one region level at a time (its municipalities or its
// states, never both, or the same ground would be coloured twice): by default
// the municipality level where Trase publishes the measure there, otherwise
// the first level Trase lists for it - the same default the single row used.
function traseMeasures(cat) {
  const byId = new Map();
  for (const ck of Object.keys(cat || {}).sort()) {
    const c = cat[ck];
    for (const lk of Object.keys(c.levels || {})) {
      const metrics = c.levels[lk].metrics || {};
      for (const mk of Object.keys(metrics)) {
        const m = metrics[mk];
        let e = byId.get(mk);
        if (!e) byId.set(mk, e = { metric: mk, said: {}, countries: {} });
        const nm = m.display_name || mk;
        e.said[nm] = (e.said[nm] || 0) + 1;
        const cc = e.countries[ck] = e.countries[ck] || { name: c.name, levels: {} };
        cc.levels[lk] = { name: c.levels[lk].name, years: (m.years || []).slice(), meta: m };
      }
    }
  }
  const list = [...byId.values()];
  for (const e of list) {
    // Trase words the same measure slightly differently from country to country; the commonest wording is used.
    e.name = Object.keys(e.said).sort((a, b) => e.said[b] - e.said[a] || a.localeCompare(b))[0];
    for (const cc of Object.values(e.countries)) cc.own = cc.levels.municipality ? "municipality" : Object.keys(cc.levels)[0];
    e.meta = Object.values(e.countries)[0].levels[Object.values(e.countries)[0].own].meta;
  }
  // Two different measures Trase gives the same name are told apart by Trase's
  // own id for each, since nothing else Trase publishes says how they differ.
  const count = {};
  list.forEach((e) => { count[e.name] = (count[e.name] || 0) + 1; });
  for (const e of list) {
    const where = Object.values(e.countries).map((c) => traseCountryName(c.name)).sort().join(", ");
    const unit = e.meta.unit_abbreviation ? ` (${e.meta.unit_abbreviation})` : "";
    e.title = `${e.name}${count[e.name] > 1 ? ` [${e.metric}]` : ""}${unit} \u2014 ${where} (Trase)`;
  }
  return list.sort((a, b) => a.title.localeCompare(b.title));
}
function traseCountryName(n) {
  return String(n || "").toLowerCase().replace(/-/g, " ").replace(/\b([a-z])/g, (x) => x.toUpperCase()).replace(/\bD Ivoire\b/i, "d'Ivoire");
}
// Which level and year each country is drawn at, for what the row's menus say.
// level "" is each country's own default; year "" the latest each publishes.
// A country with nothing at the chosen level or year is left out and named.
function trasePlan(entry, level, year) {
  const draw = [], left = [];
  for (const ck of Object.keys(entry.countries).sort()) {
    const cc = entry.countries[ck];
    const lk = level || cc.own;
    const lv = cc.levels[lk];
    if (!lv) { left.push(`${traseCountryName(cc.name)} (no ${level} level)`); continue; }
    const yr = year ? (lv.years.includes(Number(year)) ? Number(year) : null) : lv.years[lv.years.length - 1];
    if (yr == null) { left.push(`${traseCountryName(cc.name)} (nothing for ${year})`); continue; }
    draw.push({ country: ck, name: traseCountryName(cc.name), level: lk, levelName: lv.name, year: yr, meta: lv.meta });
  }
  return { draw, left };
}

async function addTraseLayer(cfg) {
  let cat, regions;
  try {
    [cat, regions] = await Promise.all([traseJson(cfg.catalogue), traseJson(`${cfg.regions}/metadata.json`)]);
  } catch (e) {
    setLayerState(cfg.id, `not built yet (${e.message})`);
    return;
  }
  cfg._regions = regions;
  const entries = traseMeasures(cat.countries || {});
  const drawn = new Map();          // measure id -> the layer ids it drew
  const safe = (x) => String(x).replace(/[^a-z0-9_]/gi, "_");
  cfg._layerIds = [];
  cfg.afterVisibility = (vis) => {
    for (const ids of drawn.values()) for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
  };
  const said = () => setLayerState(cfg.id, drawn.size ? `${drawn.size} of ${entries.length} measures drawn` : `${entries.length} measures, each a row`);
  const take = (e) => {
    for (const id of drawn.get(e.metric) || []) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(`${cfg.id}-${safe(e.metric)}`)) map.removeSource(`${cfg.id}-${safe(e.metric)}`);
    drawn.delete(e.metric);
    cfg._layerIds = [].concat(...drawn.values());
    const menus = document.querySelector(`.facet[data-trase-for="${e.key}"]`);
    if (menus && menus.remove) menus.remove();
    said();
  };
  const put = async (e) => {
    showRowFor(cfg.id);
    const src = `${cfg.id}-${safe(e.metric)}`;
    if (!map.getSource(src)) {
      map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: cfg.attribution });
      map.addLayer({ id: `${src}-fill`, type: "fill", source: src,
        paint: { "fill-color": ["coalesce", ["get", "_c"], "rgba(0,0,0,0)"], "fill-opacity": 0.72 } });
      map.addLayer({ id: `${src}-line`, type: "line", source: src,
        paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
      bindHtmlPopup(`${src}-fill`, (p) => traseBox(e, p));
      drawn.set(e.metric, [`${src}-fill`, `${src}-line`]);
      cfg._layerIds = [].concat(...drawn.values());
    }
    e.pick = e.pick || { level: "", year: "" };
    traseMenus(cfg, e);
    await traseDraw(cfg, e);
    cfg.afterVisibility(visibility.get(cfg.id) || "visible");
    said();
  };
  const rows = entries.map((e) => ({
    name: e.metric, title: e.title,
    // Filed by what Trase itself calls it: its name, its group and its commodity.
    fileBy: `${e.name} ${e.meta.metric_group || ""} ${e.meta.commodity || ""} ${e.metric.replace(/_/g, " ")} trase`,
    about: `${e.meta.metric_group || ""} ${e.meta.tooltip && e.meta.tooltip !== "." ? e.meta.tooltip : ""}`.trim(),
    show: (want) => { if (want) put(e).catch((err) => traseSay(e, `could not draw (${err.message})`)); else take(e); },
  }));
  catalogueRows(cfg, rows);
  rows.forEach((r, i) => { entries[i].key = r.key; CATALOGUE_ITEMS.set(r.key, r); });
  said();
}

function traseSay(e, text) {
  const el = typeof document !== "undefined" && document.querySelector ? document.querySelector(`[data-state="${e.key}"]`) : null;
  if (el) el.textContent = text;
}

// Under a ticked measure: which region level, which year, and the key.
function traseMenus(cfg, e) {
  const box = document.getElementById("layers");
  const tick = box && box.querySelector && box.querySelector(`[data-cat="${e.key}"]`);
  const anchor = tick && tick.closest ? tick.closest("label") : null;
  if (!anchor || !document.createElement) return;
  let el = box.querySelector(`.facet[data-trase-for="${e.key}"]`);
  if (!el) {
    el = document.createElement("div");
    el.className = "facet trase-menus";
    el.dataset.traseFor = e.key;
    if (anchor.after) anchor.after(el);
  }
  const levels = {}, years = new Set();
  for (const cc of Object.values(e.countries)) {
    for (const [lk, lv] of Object.entries(cc.levels)) {
      levels[lk] = lv.name;
      if (!e.pick.level || e.pick.level === lk) lv.years.forEach((y) => years.add(y));
    }
  }
  const opt = (v, label, on) => `<option value="${escapeHtml(v)}"${on ? " selected" : ""}>${escapeHtml(label)}</option>`;
  el.innerHTML =
    `<select data-tr="level" aria-label="Region level">${opt("", "Each country at its own level", !e.pick.level)}` +
      Object.keys(levels).sort().map((k) => opt(k, levels[k], k === e.pick.level)).join("") + `</select>` +
    `<select data-tr="year" aria-label="Year">${opt("", "Latest year each country has", !e.pick.year)}` +
      [...years].sort((a, b) => b - a).map((y) => opt(y, y, String(y) === String(e.pick.year))).join("") + `</select>` +
    `<div class="sm-legend" data-trase-legend></div>`;
  for (const s of el.querySelectorAll ? el.querySelectorAll("select") : []) {
    s.addEventListener("change", () => {
      e.pick[s.dataset.tr] = s.value;
      if (s.dataset.tr === "level") e.pick.year = "";
      traseMenus(cfg, e);
      traseDraw(cfg, e).catch((err) => traseSay(e, `could not draw (${err.message})`));
    });
  }
}

function traseRegionFile(cfg, part) {
  const hits = (cfg._regions || []).filter((r) => traseSlug(r.country) === part.country && r.node_type_slug === part.level);
  const hit = hits.find((r) => part.year >= Number(r.year_start) && part.year <= Number(r.year_end)) || hits[0];
  return hit ? `${cfg.regions}/${hit.endpoint_geojson}` : null;
}

// One country's regions with this measure's value on each. Pure, so it is tested.
function traseJoin(part, shapes, values) {
  const yr = (values || {})[String(part.year)] || {};
  const ids = new Set(Object.keys(yr));
  // Which field of the shapes holds Trase's region id: the one whose values are keys of the data.
  let idKey = null;
  for (const f of (shapes.features || []).slice(0, 50)) {
    idKey = Object.keys(f.properties || {}).find((k) => ids.has(String(f.properties[k])));
    if (idKey) break;
  }
  return (shapes.features || []).map((f) => {
    const id = idKey ? String(f.properties[idKey]) : "";
    const v = yr[id];
    return { type: "Feature", geometry: f.geometry,
      properties: Object.assign({}, f.properties, { _id: id, _v: v === undefined ? null : v,
        _country: part.name, _slug: part.country, _level: part.levelName, _year: part.year }) };
  });
}

async function traseDraw(cfg, e) {
  const src = map.getSource(`${cfg.id}-${String(e.metric).replace(/[^a-z0-9_]/gi, "_")}`);
  if (!src) return;
  const plan = trasePlan(e, e.pick.level, e.pick.year);
  traseSay(e, "loading from Trase\u2026");
  const left = plan.left.slice();
  const got = await Promise.all(plan.draw.map(async (part) => {
    const file = traseRegionFile(cfg, part);
    if (!file) { left.push(`${part.name} (Trase publishes no shapes for its ${part.levelName.toLowerCase()} level)`); return []; }
    try {
      const [shapes, values] = await Promise.all([traseJson(file), traseJson(`${cfg.values}/${part.country}/${part.level}/${e.metric}.json`)]);
      return traseJoin(part, shapes, values);
    } catch (err) {
      left.push(`${part.name} (${err.message})`);
      return [];
    }
  }));
  const features = [].concat(...got);
  // One set of steps across every country drawn, so a colour means the same
  // amount on both sides of a border.
  const ramp = TRASE_RAMPS[e.meta.color_scheme] || TRASE_RAMPS.red;
  const breaks = traseBreaks(features.map((f) => f.properties._v));
  let shown = 0;
  for (const f of features) {
    const v = f.properties._v;
    if (typeof v !== "number") { f.properties._c = null; continue; }
    shown++;
    let i = 0;
    while (i < breaks.length && v >= breaks[i]) i++;
    f.properties._c = ramp[Math.min(i + (ramp.length - 1 - breaks.length), ramp.length - 1)];
  }
  src.setData({ type: "FeatureCollection", features });
  const legend = document.querySelector(`[data-trase-for="${e.key}"] [data-trase-legend]`);
  if (legend) {
    const edges = [null, ...breaks];
    legend.innerHTML = edges.map((b, i) => `<span class="sm-key"><i style="background:${ramp[i + (ramp.length - 1 - breaks.length)]}"></i>` +
      `${b === null ? "below " + traseFormat(breaks[0] ?? 0) : "from " + traseFormat(b)}</span>`).join("") +
      ` <span class="sm-key">${escapeHtml(e.meta.unit_abbreviation || e.meta.unit || "")}</span>`;
  }
  const countries = new Set(features.filter((f) => typeof f.properties._v === "number").map((f) => f.properties._country)).size;
  traseSay(e, `${shown.toLocaleString()} regions in ${countries} ${countries === 1 ? "country" : "countries"}` +
    (left.length ? ` \u00b7 not drawn: ${left.join("; ")}` : ""));
}

function traseBox(e, props) {
  const cc = e.countries[props._slug];
  const lv = cc && Object.values(cc.levels).find((l) => l.name === props._level);
  const m = (lv && lv.meta) || e.meta;
  const name = props.name || props.region || props.NAME || props.nome || props._id;
  const v = props._v;
  return `<b>${escapeHtml(name)}</b><div class="meta">${escapeHtml(props._country || "")}${props._level ? " \u00b7 " + escapeHtml(props._level) : ""}</div>` +
    `<div class="meta">${escapeHtml(m.display_name || e.name)}, ${escapeHtml(props._year)}: ` +
    `${v === null || v === undefined || v === "null" ? "no value published" : escapeHtml(traseFormat(Number(v)))} ${escapeHtml(m.unit_abbreviation || "")}</div>` +
    (m.tooltip && m.tooltip !== "." ? `<div class="meta">${escapeHtml(m.tooltip)}</div>` : "") +
    (m.data_source ? `<div class="meta">Source: ${escapeHtml(m.data_source)}</div>` : "") +
    (m.citation ? `<div class="meta">${escapeHtml(m.citation)}</div>` : "") +
    `<div class="meta"><a href="https://trase.earth/explore/spatial-data/map?country=${encodeURIComponent(props._slug || "")}" target="_blank" rel="noopener">Open on Trase</a></div>`;
}

/* ---------- outlines from a PMTiles archive (points wider out) ---------- */
// GitHub refuses any file over 100 MB, so a big set of outlines is published as
// several archives, each holding some zooms (and, where one zoom is too big,
// one side of a line of longitude). The build lists them in <archive>.build.json.
// This turns that list into what each file's outline layer needs: its address
// and the zooms it may draw at. A file draws only at its own zooms, or the file
// below would stretch its last tiles over the finer ones and paint every outline
// twice; the files holding the closest zoom go on drawing past it.
function pmShapeParts(archiveUrl, stamp) {
  const parts = stamp && Array.isArray(stamp.parts) ? stamp.parts.filter((p) => p && p.file) : [];
  if (!parts.length) return [{ url: archiveUrl, first: true }];
  const top = Math.max(...parts.map((p) => Number(p.to)));
  const base = archiveUrl.slice(0, archiveUrl.lastIndexOf("/") + 1);
  return parts.map((p, i) => ({
    url: base + p.file, first: i === 0,
    minzoom: Number(p.from), maxzoom: Number(p.to) === top ? 24 : Number(p.to) + 1,
  }));
}

function addPmShapesLayer(cfg) {
  const src = `${cfg.id}-pm`;
  map.addSource(src, { type: "vector", url: `pmtiles://${cfg.archiveUrl}`, attribution: cfg.attribution || "" });
  // Each part only where its own tiles hold anything: the outlines are tiled
  // from zoom 7 and the points to zoom 8. Without these bounds MapLibre keeps
  // asking for, and stretching, tiles that carry nothing for the layer, which
  // is most of the wait on a 72 MB archive.
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: src, "source-layer": cfg.polygonLayer,
    minzoom: cfg.polygonFrom != null ? cfg.polygonFrom : 7,
    paint: { "fill-color": cfg.colour, "fill-opacity": 0.55, "fill-outline-color": "#1D1B17" } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, "source-layer": cfg.pointLayer,
    maxzoom: cfg.pointTo != null ? cfg.pointTo : 9,
    paint: { "circle-color": cfg.colour,
             // Merged points carry how many mines they stand for (point_count).
             "circle-radius": ["interpolate", ["linear"], ["zoom"],
               1, ["+", 1.6, ["*", 0.9, ["log10", ["coalesce", ["get", "point_count"], 1]]]],
               6, ["+", 3, ["*", 1.2, ["log10", ["coalesce", ["get", "point_count"], 1]]]]],
             "circle-stroke-color": "#17150F", "circle-stroke-width": 0.4, "circle-opacity": 0.85 } });
  const box = (p) => {
    if (Number(p.point_count) > 1) return `<b>${Number(p.point_count).toLocaleString()} mines here</b><div class="meta">Merged at this zoom. Zoom in to see each one and its outline.</div>`;
    const loss = Object.keys(p).filter((k) => /(19|20)\d\d/.test(k) && isFinite(Number(p[k])))
      .sort().map((k) => `${escapeHtml(k.replace(/_/g, " "))}: ${Number(p[k]).toLocaleString(undefined, { maximumFractionDigits: 3 })}`);
    const rest = Object.keys(p).filter((k) => !/(19|20)\d\d/.test(k) && p[k] !== "" && p[k] != null)
      .map((k) => `${escapeHtml(k.replace(/_/g, " "))}: ${escapeHtml(k === "area" ? Number(p[k]).toLocaleString(undefined, { maximumFractionDigits: 3 }) + " km\u00b2" : p[k])}`);
    return `<b>Mine${p.country ? " \u2014 " + escapeHtml(p.country) : ""}</b><div class="meta">${rest.join("<br>")}</div>` +
      (loss.length ? `<div class="meta">Tree cover loss inside it:<br>${loss.join("<br>")}</div>` : "") +
      `<div class="meta">Maus et al. 2022 and OpenStreetMap, merged by WU Vienna (ODbL)</div>`;
  };
  bindHtmlPopup(`${cfg.id}-fill`, box);
  bindHtmlPopup(`${cfg.id}-pt`, box);
  // The other files of the same build, if it was cut into several. Until the
  // list answers (or if it never does) the first file draws alone, as before.
  fetch(cfg.archiveUrl.replace(/\.pmtiles$/, ".build.json"))
    .then((r) => (r.ok ? r.json() : null))
    .then((stamp) => {
      const parts = pmShapeParts(cfg.archiveUrl, stamp);
      if (parts.length < 2) return;
      map.setLayerZoomRange(`${cfg.id}-fill`, parts[0].minzoom, parts[0].maxzoom);
      cfg._layerIds = cfg._layerIds || [];
      parts.slice(1).forEach((part, i) => {
        const psrc = `${cfg.id}-pm-${i + 2}`, lid = `${cfg.id}-fill-${i + 2}`;
        if (map.getLayer(lid)) return;
        map.addSource(psrc, { type: "vector", url: `pmtiles://${part.url}`, attribution: cfg.attribution || "" });
        map.addLayer({ id: lid, type: "fill", source: psrc, "source-layer": cfg.polygonLayer,
          minzoom: part.minzoom, maxzoom: part.maxzoom,
          paint: { "fill-color": cfg.colour, "fill-opacity": 0.55, "fill-outline-color": "#1D1B17" } }, `${cfg.id}-pt`);
        cfg._layerIds.push(lid);
        bindHtmlPopup(lid, box);
      });
      applyVisibility(cfg.id);
    })
    .catch((e) => console.warn(`[culprits] ${cfg.id} build list: ${e.message}`));
  setLayerState(cfg.id, "every mine as a point from the world view (merged where they crowd), outlines from zoom 7");
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the abattoir atlas's other two parts, inside the Slaughterhouses row ---------- */
// As the atlas draws them: Climate TRACE's confined animal facilities (a
// model's estimate, solid where it gives the facility's position and hollow
// where it gives an area), and FAO's Gridded Livestock of the World 4, read
// live. The atlas found the address FAO's service answers: rows counted from
// the top, and style=default, which FAO's own template leaves out.
const ABATTOIR_PARTS = [
  ["reg", "Registered facilities"],
  ["cafo", "Confined animal facilities (Climate TRACE, modelled)"],
  ["glw", "Livestock density (FAO, modelled)"],
];
const CAFO_TILES = "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/abattoir_cafo.pmtiles";
const GLW_TILES = "https://data.apps.fao.org/map/wmts/wmts?layer=fao-gismgr/GLW4-2020/mapsets/D-DA" +
  "&tilematrixset=EPSG:3857&Service=WMTS&request=GetTile&Version=1.0.0&style=default&Format=image/png" +
  "&layertype=Image&TileMatrix={z}&TileCol={x}&TileRow={y}";
// The two modelled sets the abattoir atlas draws beside its facility list are
// rows of their own, not buttons inside one row. They answer different
// questions - what is registered, what a model puts where, how many animals a
// grid says are there - and a reader ticking "slaughterhouses" should not have
// a model's estimate arrive with it.
function addGlwLayer(cfg) {
  if (!cfg || map.getSource(`${cfg.id}-glw-src`)) return;
  map.addSource(`${cfg.id}-glw-src`, { type: "raster", tileSize: 256, maxzoom: 10, tiles: [GLW_TILES],
    attribution: 'Livestock density: FAO, Gridded Livestock of the World 4 (2020), CC BY 4.0 \u2014 modelled, not counted' });
  map.addLayer({ id: `${cfg.id}-glw`, type: "raster", source: `${cfg.id}-glw-src`, layout: { visibility: "none" },
    paint: { "raster-opacity": 0.6, "raster-saturation": -0.55 } }, pointLayerAbove());
  setLayerState(cfg.id, "FAO's modelled grid of how many animals are kept where, 2020");
  applyVisibility(cfg.id);
}
function addCafoLayer(cfg) {
  if (!cfg || map.getSource(`${cfg.id}-cafo-src`)) return;
  map.addSource(`${cfg.id}-cafo-src`, { type: "vector", url: `pmtiles://${CAFO_TILES}`,
    attribution: 'Confined animal facilities: Climate TRACE, CC BY 4.0 \u2014 modelled, not a permit register' });
  const n = ["coalesce", ["get", "point_count"], 1];
  map.addLayer({ id: `${cfg.id}-cafo`, type: "circle", source: `${cfg.id}-cafo-src`, "source-layer": "cafo", layout: { visibility: "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["+", 1.6, ["*", 0.8, ["log10", n]]], 8, ["+", 2.6, ["*", 1, ["log10", n]]], 12, 4.2],
      // Solid where Climate TRACE gives the facility's own position, hollow where it gives an area.
      "circle-color": "#7B6A4E",
      "circle-opacity": ["case", ["==", ["get", "precise"], 0], 0, 0.75],
      "circle-stroke-color": "#7B6A4E",
      "circle-stroke-width": ["case", ["==", ["get", "precise"], 0], 1, 0.4],
    } }, pointLayerAbove());
  bindHtmlPopup(`${cfg.id}-cafo`, (p) => Number(p.point_count) > 1
    ? `<b>${Number(p.point_count).toLocaleString()} modelled facilities here</b><div class="meta">Merged at this zoom. Zoom in to see each one.</div>`
    : `<b>Confined animal facility (modelled)</b><table class="meta">${fieldRows(p, ["precise"])}</table>` +
      `<div class="meta">Climate TRACE model these from satellite imagery and census data. Nothing here has necessarily been visited, licensed or confirmed by any authority${Number(p.precise) === 0 ? "; hollow because the source gives an area, not a position" : ""}.</div>`);
  setLayerState(cfg.id, "Climate TRACE's modelled confined animal facilities");
  applyVisibility(cfg.id);
}
// Google My Maps rows: the daily address job (culprits-tiles-more) keeps each
// map's own title, so the row shows it before the layer is opened.
const MYMAPS_TITLES = "https://welcometoyourgalaxy.github.io/culprits-tiles-more/mymaps/titles.json";
async function mymapsTitles() {
  let titles;
  try { titles = await getJson(MYMAPS_TITLES, 15000); } catch (e) { return; }
  const all = LAYERS.concat(...(typeof GROUPS !== "undefined" ? GROUPS.map((g) => g.children) : []));
  for (const cfg of all) {
    if (cfg.route !== "kml" || !cfg.kml || !/^Google My Maps map/.test(cfg.name)) continue;
    const mid = (cfg.kml.match(/mid=([^&]+)/) || [])[1];
    const t = mid && titles[mid];
    if (!t) continue;
    cfg.name = t;
    const nm = document.querySelector(`[data-layer="${cfg.id}"]`);
    const el = nm && nm.closest && nm.closest("label") && nm.closest("label").querySelector(".nm");
    if (el) el.textContent = t;
  }
  if (typeof buildLegend === "function") buildLegend();
}
function abattoirPartsInit() { /* both parts are rows of their own now */ }

/* ---------- live places, batch 2 ---------- */
const boxOpen = `<div style="font:13px/1.4 system-ui,sans-serif;max-width:340px">`;
function fieldRows(p, skip = []) {
  // A nested value (a list, a record inside the record) is written out as
  // text rather than left off: it used to be dropped without a word.
  const text = (v) => (typeof v === "object" ? JSON.stringify(v) : String(v));
  return Object.keys(p).filter((k) => !skip.includes(k) && p[k] !== null && p[k] !== "" && !(Array.isArray(p[k]) && !p[k].length))
    .map((k) => `<tr><th style="text-align:left;padding-right:8px;vertical-align:top">${escapeHtml(k.replace(/_/g, " "))}</th><td>${escapeHtml(text(p[k]))}</td></tr>`).join("");
}
function pointOf(r) {
  const n = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  const pairs = [[r.lon, r.lat], [r.lng, r.lat], [r.longitude, r.latitude], [r.long, r.lat]];
  for (const [x, y] of pairs) if (isFinite(n(x)) && isFinite(n(y))) return { type: "Point", coordinates: [n(x), n(y)] };
  for (const g of [r.geometry, r.point, r.location, r.geom]) {
    if (g && g.type && g.coordinates) return g;
    if (g && isFinite(n(g.lat)) && isFinite(n(g.lon ?? g.lng))) return { type: "Point", coordinates: [n(g.lon ?? g.lng), n(g.lat)] };
  }
  return null;
}

// EJAtlas: its conflicts, page by page.
async function readEjatlas(cfg) {
  const items = [];
  let url = `${cfg.api}?limit=500&offset=0`, pages = 0, sample = null;
  while (url && pages < 40) {
    const j = await getJson(url.replace(/^http:/, "https:"), 60000);
    for (const r of j.results || []) {
      sample = sample || r;
      const g = pointOf(r);
      if (!g) continue;
      const title = r.title || r.name || r.headline || `Conflict ${r.id}`;
      const link = r.slug ? `https://ejatlas.org/conflict/${encodeURIComponent(r.slug)}` : (r.url || "");
      items.push({ geometry: g, key: `c${r.id}`, name: title, group: r.category || r.type || "",
        h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(title)}</h4>` +
          (r.image ? `<img src="${escapeHtml(r.image)}" style="max-width:100%;margin:4px 0">` : "") +
          (r.headline && r.headline !== title ? `<p>${escapeHtml(r.headline)}</p>` : "") +
          `<table>${fieldRows(r, ["id", "slug", "image", "headline", "title", "name", "lat", "lon", "lng", "latitude", "longitude"])}</table>` +
          (link ? `<p><a href="${escapeHtml(link)}" target="_blank" rel="noopener">Open on EJAtlas</a></p>` : "") + `</div>` });
    }
    url = j.next; pages++;
  }
  if (!items.length && sample) console.warn(`[culprits] ejatlas: no position found in its records; their fields are ${Object.keys(sample).join(", ")}`);
  return { title: cfg.name, items };
}

// Plain GeoJSON files (Seas of Plastic; the Coastal Cleanup copy).
// A file of records with a latitude and a longitude in each, rather than
// GeoJSON: the Live Projects to Resist wire publishes its placed stories that
// way. Turned into features here so one route reads both, and a record with no
// position is left out rather than placed at 0,0 off West Africa.
function recordsAsFeatures(rows) {
  const num = (v) => (v === "" || v == null ? null : Number(v));
  return rows.map((r) => {
    const lat = num(r.lat != null ? r.lat : r.latitude), lng = num(r.lng != null ? r.lng : (r.lon != null ? r.lon : r.longitude));
    if (!isFinite(lat) || !isFinite(lng) || lat === null || lng === null) return null;
    const p = {};
    Object.keys(r).forEach((k) => { if (!["lat", "lng", "lon", "latitude", "longitude"].includes(k)) p[k] = r[k]; });
    // A record whose whole point is a link (a story, a report) gets that link
    // as a link rather than as escaped text in a table cell. Every field is
    // still listed underneath.
    const href = p.link || p.url;
    if (href) {
      p._html = `<h4 style="margin:0 0 6px">${escapeHtml(String(p.title || p.name || href))}</h4>` +
        `<p><a href="${escapeHtml(String(href))}" target="_blank" rel="noopener">Open it</a></p>` +
        `<table>${fieldRows(p, ["_html"])}</table>`;
    }
    return { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: p };
  }).filter(Boolean);
}
async function readGeojsonFiles(cfg) {
  const items = [];
  let nowhere = 0;
  for (const f of cfg.files) {
    const got = await getJson(f.url, 60000);
    const gj = Array.isArray(got) ? { features: recordsAsFeatures(got) }
      : (got && !got.features && Array.isArray(got.entries)) ? { features: recordsAsFeatures(got.entries) } : got;
    (gj.features || []).forEach((ft, i) => {
      // A record the source gives no position cannot be drawn. It is still in
      // the file; the row says how many there are rather than passing over them.
      if (!ft.geometry) { nowhere++; return; }
      const p = ft.properties || {};
      // Which field names the place, where a file's own first choice would be
      // the wrong one: the wire's "name" is the outlet, and a list of forty
      // rows all reading the same outlet says nothing about where they are.
      const first = (cfg.nameFrom || []).map((k) => p[k]).find((v) => v !== undefined && v !== null && v !== "");
      const name = first || p.name || p.Name || p.title || p.Source || (p.TripId != null ? `Trip ${p.TripId}` : "") || p.Ocean || f.label;
      items.push({ geometry: ft.geometry, key: `${f.label}:${i}`, name: String(name), group: p.group != null ? String(p.group) : f.label,
        // A copy that carries its source's own box (_html) shows that; otherwise every field.
        h: p._html ? boxOpen + p._html + `</div>`
          : boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(name)}</h4><table>${fieldRows(p)}</table></div>` });
    });
  }
  return { title: cfg.name, items,
    note: nowhere ? `${nowhere.toLocaleString()} more in the file have no position and cannot be drawn` : "" };
}

// WP Go Maps (Final Nail): its markers as published.
async function readWpgmza(cfg) {
  const j = await getJson(cfg.api, 60000);
  const items = (j.markers || []).map((m, i) => {
    const lat = Number(m.lat), lng = Number(m.lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { geometry: { type: "Point", coordinates: [lng, lat] }, key: `m${m.id || i}`, name: m.title || "",
      group: "", h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(m.title || "")}</h4>${m.description || ""}` +
        (m.link ? `<p><a href="${escapeHtml(m.link)}" target="_blank" rel="noopener">More</a></p>` : "") + `</div>` };
  }).filter(Boolean);
  return { title: cfg.name, items };
}

// Atlas for the End of the World: a hotspot's box links the Atlas's PDF for it.
function atlasWords(s) { return new Set(String(s).toLowerCase().replace(/&/g, " and ").split(/[^a-z]+/).filter((w) => w.length > 2 && w !== "and" && w !== "the")); }
function atlasPdfFor(cfg, name) {
  const want = atlasWords(name);
  let best = null, score = 0;
  for (const [file, label] of cfg.pdfs) {
    const have = atlasWords(label);
    const common = [...want].filter((w) => have.has(w)).length;
    const s = common / Math.max(want.size, have.size);
    if (s > score) { score = s; best = [file, label]; }
  }
  return score >= 0.5 ? best : null;
}
function linkAtlasPdfs(cfg, items) {
  for (const it of items) {
    const hit = atlasPdfFor(cfg, it.name);
    it.h = it.h.replace(/<\/div>$/, hit
      ? `<p><a href="${cfg.pdfBase}${hit[0]}.pdf" target="_blank" rel="noopener">Open the Atlas's PDF: ${escapeHtml(hit[1])}</a></p></div>`
      : `<p style="font-size:11px">The Atlas has no PDF for this hotspot.</p></div>`);
  }
}

// The Atlas's cities, placed from the weekly lookup of their names.
async function readAtlasCities(cfg) {
  let at = {};
  try { at = await getJson(cfg.positions); } catch (e) { /* not built yet */ }
  const items = [];
  let missing = 0;
  for (const [slug, name] of cfg.cities) {
    const c = at[name];
    if (!c) { missing++; continue; }
    items.push({ geometry: { type: "Point", coordinates: c }, key: slug, name, group: "",
      h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(name)}</h4>` +
        `<p><a href="${cfg.pageBase}${slug}.html" target="_blank" rel="noopener">Open the Atlas's page for this city</a></p>` +
        `<p style="font-size:11px">Placed from its name through OpenStreetMap; the Atlas gives no coordinates.</p></div>` });
  }
  return { title: cfg.name, items, note: missing ? `${missing} not yet placed` : "" };
}

// Trase's facilities maps: the current file from the weekly manifest, read live from Trase.
async function readTraseFacilities(cfg) {
  let file = cfg.file, base = "https://resources.trase.earth/data/facilities-data/";
  try {
    const m = await getJson(cfg.manifest);
    const hit = (m.types || []).find((t) => t.id === cfg.facilityType);
    if (hit && hit.file) { file = hit.file; base = m.base || base; }
  } catch (e) { /* the manifest is not built yet: use the file known when this was written */ }
  const gj = await getJson(base + file, 120000);
  const items = (gj.features || []).map((f, i) => {
    const p = f.properties || {};
    const keys = Object.keys(p);
    const nameKey = keys.find((k) => /(^|_)(name|nome|razao|mill|coop|company|facility)(_|$)/i.test(k) && typeof p[k] === "string" && p[k]);
    const groupKey = keys.find((k) => /commodit/i.test(k)) || keys.find((k) => /^(type|facility_type|tipo)$/i.test(k));
    return { geometry: f.geometry, key: `f${i}`, name: nameKey ? p[nameKey] : "", group: groupKey ? String(p[groupKey] ?? "") : "",
      h: boxOpen + (nameKey ? `<h4 style="margin:0 0 6px">${escapeHtml(p[nameKey])}</h4>` : "") +
        `<table>${fieldRows(p)}</table><div style="margin-top:6px;font-size:11px">Trase (CC BY 4.0)</div></div>` };
  });
  return { title: cfg.name, items };
}

/* ---------- a long layer list, split into the source's own categories ---------- */
// Neither server says which category a layer belongs to, so each is placed by
// the words in its name and description, in the categories the source's own
// map uses. Rules are tried in order; a layer no rule claims goes under "Other"
// rather than being left out.
const NUSANTARA_CATEGORIES = [
  ["Deforestation and fires", /alert|deforest|forest ?loss|tree ?loss|clear(ing|ed)|disturb|fire|hotspot|burn/],
  ["Mills", /\bmills?\b|pabrik/],
  ["Indigenous territories", /indigenous|\badat\b|customary|ulayat|wilayah adat/],
  ["Roads", /\broads?\b|jalan/],
  ["Administrative boundary", /boundar|admin|province|provinsi|district|kabupaten|regency|kecamatan|village|desa\b|country/],
  ["Land use zone", /land ?use|zon(e|ing)|kawasan hutan|forest estate|spatial plan|rtrw|moratorium|pippib|forest area status/],
  ["Concessions", /concession|\bhgu\b|iuphhk|pbph|\biup\b|\bhti\b|\bhph\b|permit|licen[cs]e|izin/],
  ["Protected area", /protect|conserv|national park|taman nasional|reserve|wdpa|sanctuary/],
  ["Forest, peat and plantations", /forest|peat|gambut|mangrove|plantation|oil ?palm|acacia|pulp|land ?cover|tree|kebun/],
];
const GFW_CATEGORIES = [
  ["Climate", /carbon|emission|co2|co₂|biomass|sequestr|removal|greenhouse|\bflux|soil organic/],
  ["Forest Change", /loss|gain|alert|deforest|disturb|glad|radd|fire|burn|degradation|drivers|change|clearing/],
  ["Biodiversity", /biodivers|species|habitat|protected|wdpa|key biodiversity|\bkba|hotspot|intact|endemi|wildlife|ecoregion/],
  ["Land Use", /concession|logging|mining|\bmine|oil ?palm|palm oil|plantation|planted|indigenous|community|land rights|infrastructure|road|dam\b|agricultur|crop|pasture|cattle|soy|cocoa|coffee|rubber|commodit|land use|boundar|admin/],
  ["Land Cover", /land ?cover|tree cover|canopy|mangrove|primary forest|forest extent|peat|wetland|tree height|natural forest|forest type|vegetation|grassland/],
];
function categoryOf(text, rules) {
  const t = String(text || "").toLowerCase();
  for (const [name, re] of rules) if (re.test(t)) return name;
  return "Other";
}
// Chips for the categories (with counts) above one menu of the chosen category's layers.
function categoryMenu(el, items, rules, label, onPick, placeholder) {
  const names = [...rules.map((r) => r[0]), "Other"].filter((n) => items.some((it) => it.cat === n));
  let cat = names[0];
  const draw = () => {
    const list = items.map((it, i) => [it, i]).filter(([it]) => it.cat === cat);
    el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px">` +
      names.map((n) => `<button type="button" class="chip${n === cat ? " on" : ""}" data-cat="${escapeHtml(n)}">${escapeHtml(n)} ` +
        `<span style="opacity:.6">${items.filter((it) => it.cat === n).length}</span></button>`).join("") + `</div>` +
      `<select aria-label="${escapeHtml(label)}" style="max-width:100%">` +
      (placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "") +
      list.map(([it, i]) => `<option value="${i}"${it._picked ? " selected" : ""}>${escapeHtml(it.title)}</option>`).join("") + `</select>`;
  };
  el.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-cat]");
    if (!b) return;
    e.stopPropagation();
    cat = b.dataset.cat;
    draw();
  });
  el.addEventListener("change", (e) => {
    if (!e.target.matches || !e.target.matches("select")) return;
    items.forEach((it) => { it._picked = false; });
    const i = e.target.value === "" ? null : Number(e.target.value);
    if (i != null && items[i]) items[i]._picked = true;
    onPick(i);
  });
  draw();
}

// Turn a row on from inside one of its own menus: the row's own box is ticked,
// so the layers box still holds the truth and everything that follows from a
// tick happens exactly as it does when the box is clicked.
function showRowFor(id) {
  if ((visibility.get(id) || "none") === "visible") return;
  const box = typeof document !== "undefined" && document.querySelector
    ? document.querySelector(`[data-layer="${id}"]`) : null;
  if (box && !box.checked) {
    box.checked = true;
    if (typeof box.dispatchEvent === "function" && typeof Event === "function") box.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    visibility.set(id, "visible");
    applyVisibility(id);
  }
}

// The layers column's right edge is a handle. Long layer names were being cut
// at 290 pixels with no way to see the rest; now the column is dragged as wide
// as it needs to be and dragged back for more map. Double-click puts it back to
// where it started.
//
// It drags --left-w, which is the left column's own width: the layers box, the
// Showing box under it and the left half of the defence frame. Dragging used to
// set --box-w, which the view and wires boxes on the right measure from too, so
// widening the layers column widened those as well.
function columnEdge() {
  const col = typeof document !== "undefined" && document.querySelector ? document.querySelector(".left-col") : null;
  if (!col || typeof col.querySelector !== "function" || col.querySelector(".col-edge") ||
      typeof document.createElement !== "function" || typeof getComputedStyle !== "function") return;
  const root = document.documentElement;
  const START = 290, MIN = 220, MAX = 680;
  const edge = document.createElement("div");
  edge.className = "col-edge";
  edge.title = "Drag to make the layers box wider or narrower. Double-click to put it back.";
  edge.setAttribute("aria-hidden", "true");
  let from = 0, was = START;
  const widthNow = () => {
    const v = parseFloat(getComputedStyle(root).getPropertyValue("--left-w"));
    return isFinite(v) ? v : START;
  };
  edge.addEventListener("pointerdown", (e) => {
    from = e.clientX;
    was = widthNow();
    if (edge.setPointerCapture) edge.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  edge.addEventListener("pointermove", (e) => {
    if (!from) return;
    const want = Math.max(MIN, Math.min(MAX, was + (e.clientX - from)));
    root.style.setProperty("--left-w", `${Math.round(want)}px`);
  });
  const done = () => { from = 0; if (map && typeof map.resize === "function") map.resize(); };
  edge.addEventListener("pointerup", done);
  edge.addEventListener("pointercancel", done);
  edge.addEventListener("dblclick", () => { root.style.setProperty("--left-w", `${START}px`); done(); });
  col.appendChild(edge);
}
/* ---------- Carbon Mapper's plumes, read from its own data platform ---------- */

// What was here before was the handful of waste-site plumes listed on our own
// page, drawn as dots. Carbon Mapper publish far more than that, and their own
// viewer draws each plume's shape rather than a dot, because the shape is the
// reading: a plume is a smear of gas with a direction and a length, and a dot
// says only that something was seen somewhere.
//
// So: the newest plumes from their catalogue, each as a point that can be
// found from any zoom, and from CARBON_PLUME_ZOOM in, each plume's own picture
// laid on the map at the bounds Carbon Mapper give for it. The picture is
// theirs, drawn where they say it belongs; nothing is redrawn or inferred.
//
// The catalogue is large, so the row reads the newest CARBON_PLUME_PAGES pages
// and says how many of the total it is holding rather than pretending to have
// all of it.
const CARBON_PLUME_ZOOM = 10;     // from here in, the plumes' own pictures
const CARBON_PLUME_PAGES = 10;    // 1,000 plumes a page
// Merged and counted up to the zoom where each plume starts drawing its own
// picture. Stopping at 6 left a gap: from a continent or a country the
// clusters were gone and what replaced them was a scatter of three-pixel
// dots, so the layer read as empty again between the world view and the
// street. Now the counted points carry it the whole way.
const CARBON_CLUSTER_TO = CARBON_PLUME_ZOOM - 1;
const CARBON_PAGES_AT_ONCE = 3;    // after the first, which is drawn on its own
const CARBON_PICTURES_AT_ONCE = 40;
async function addCarbonMapperLayer(cfg) {
  const src = `${cfg.id}-src`;
  // Tens of thousands of plumes, most of them in a few basins, each a dot two
  // pixels across at world view: from any distance the layer read as empty.
  // Where they crowd they are merged into one point that says how many it
  // stands for, the way the mines already work, so the basins show from the
  // world view and nothing is dropped to make them show. From
  // CARBON_CLUSTER_TO in, every plume is its own point again.
  map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] },
    cluster: true, clusterMaxZoom: CARBON_CLUSTER_TO, clusterRadius: 30,
    attribution: cfg.attribution || "" });
  map.addLayer({ id: `${cfg.id}-cl`, type: "circle", source: src, filter: ["has", "point_count"],
    paint: {
      "circle-color": cfg.colour, "circle-opacity": 0.75,
      "circle-radius": ["interpolate", ["linear"], ["zoom"],
        1, ["+", 3, ["*", 2.2, ["log10", ["max", ["get", "point_count"], 1]]]],
        CARBON_CLUSTER_TO, ["+", 4, ["*", 2.6, ["log10", ["max", ["get", "point_count"], 1]]]]],
      "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5 } });
  bindHtmlPopup(`${cfg.id}-cl`, (p) =>
    `<b>${Number(p.point_count).toLocaleString()} plumes here</b>` +
    `<div class="meta">Merged at this zoom. Zoom in to see each one, its rate and its picture.</div>` +
    `<div class="meta">Carbon Mapper data platform</div>`);
  // Sized by the emission rate Carbon Mapper measured, which is the one number
  // that says how much this plume matters; unmeasured plumes keep the base size.
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["case", ["==", ["get", "gas"], "CO2"], "#6E6358", cfg.colour],
      "circle-opacity": 0.85,
      "circle-radius": ["interpolate", ["linear"], ["zoom"],
        1, ["+", 3, ["*", 0.9, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]],
        9, ["+", 3.8, ["*", 1.4, ["log10", ["max", ["coalesce", ["get", "emission"], 1], 1]]]]],
      "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5 } });
  const num = (v, unit) => (v === null || v === undefined || v === "" || !isFinite(Number(v)) ? "" :
    `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}${unit}`);
  bindHtmlPopup(`${cfg.id}-pt`, (p) =>
    `<b>${escapeHtml(p.gas || "Plume")} plume${p.plume_id ? " " + escapeHtml(p.plume_id) : ""}</b>` +
    (p.picture ? `<div><img src="${escapeHtml(p.picture)}" alt="" style="max-width:320px;width:100%;margin:6px 0"></div>` : "") +
    `<table class="meta">${fieldRows(p, ["picture", "bounds"])}</table>` +
    (p.emission ? `<div class="meta">${num(p.emission, " kg per hour")}${p.emission_uncertainty ? ` \u00b1 ${num(p.emission_uncertainty, "")}` : ""}, as Carbon Mapper measured it at that moment \u2014 not the source's overall rate</div>` : "") +
    `<div class="meta">Carbon Mapper data platform</div>`);

  let held = [];
  // One plume, as this map keeps it. Every field the catalogue gives that the
  // box shows is carried; nothing is worked out here.
  const asFeature = (it) => {
    const g = it.geometry_json || it.geometry;
    const at = g && g.coordinates;
    if (!at || !isFinite(Number(at[0])) || !isFinite(Number(at[1]))) return null;
    return { type: "Feature", geometry: { type: "Point", coordinates: [Number(at[0]), Number(at[1])] },
      properties: {
        plume_id: it.plume_id || it.id || "", gas: it.gas || "",
        seen: it.scene_timestamp || it.datetime || "", instrument: it.instrument || "",
        platform: it.platform || "", quality: it.plume_quality || "",
        sector: it.sector || (it.source && it.source.sector) || "",
        emission: it.emission_auto != null ? it.emission_auto : it.emission,
        emission_uncertainty: it.emission_uncertainty_auto != null ? it.emission_uncertainty_auto : it.emission_uncertainty,
        wind_speed: it.wind_speed_avg_auto, wind_direction: it.wind_direction_avg_auto,
        collection: it.collection || "",
        picture: it.plume_png || it.plume_rgb_png || "",
        bounds: Array.isArray(it.plume_bounds) && it.plume_bounds.length === 4 ? it.plume_bounds.join(",") : "",
      } };
  };
  // Ten pages of a thousand detailed records, read one after another, with
  // nothing on the map until the last one landed: that was the wait. Now the
  // first page is read on its own and drawn as soon as it arrives, and the
  // rest follow CARBON_PAGES_AT_ONCE at a time, each batch drawn as it lands.
  // The row says how many are held and that it is still reading, so a part-read
  // map never reads as the whole catalogue.
  const read = async () => {
    const feats = [];
    let total = null;
    const draw = (done) => {
      held = feats;
      if (map.getSource(src)) map.getSource(src).setData({ type: "FeatureCollection", features: feats });
      setLayerState(cfg.id, `${feats.length.toLocaleString()} plumes` +
        (total ? ` of ${total.toLocaleString()} published` : "") +
        (done ? ` \u00b7 their own pictures from zoom ${CARBON_PLUME_ZOOM}` : ", still reading\u2026"));
    };
    let page = 0, ended = false;
    while (page < CARBON_PLUME_PAGES && !ended) {
      const batch = [];
      for (let k = 0; k < (feats.length ? CARBON_PAGES_AT_ONCE : 1) && page + k < CARBON_PLUME_PAGES; k++) batch.push(page + k);
      let got;
      try {
        got = await Promise.all(batch.map((n) =>
          getJson(`${CARBON_API}?sort=desc&limit=1000&offset=${n * 1000}`, 60000)));
      } catch (e) {
        if (!feats.length) { setLayerState(cfg.id, `Carbon Mapper did not answer (${e.message})`); return; }
        break;
      }
      for (const j of got) {
        const items = j.items || j.features || [];
        if (total === null && j.total_count != null) total = Number(j.total_count);
        for (const it of items) {
          const f = asFeature(it);
          if (f) feats.push(f);
        }
        if (items.length < 1000) ended = true;
      }
      page += batch.length;
      draw(ended || page >= CARBON_PLUME_PAGES);
    }
  };

  // Each plume's own picture, at the bounds Carbon Mapper give for it. Only
  // the ones on screen, and only so many at once: a picture is a source and a
  // layer of its own, and a hundred of them at a time is a stalled map.
  const drawn = new Map();
  const pictures = () => {
    const wanted = new Set();
    if (map.getZoom() >= CARBON_PLUME_ZOOM && (visibility.get(cfg.id) || "none") === "visible") {
      const b = map.getBounds();
      for (const f of held) {
        const p = f.properties;
        if (!p.picture || !p.bounds) continue;
        const [w, s2, e2, n] = p.bounds.split(",").map(Number);
        if (e2 < b.getWest() || w > b.getEast() || n < b.getSouth() || s2 > b.getNorth()) continue;
        wanted.add(p.plume_id);
        if (wanted.size >= CARBON_PICTURES_AT_ONCE) break;
      }
    }
    for (const [id, layer] of [...drawn]) {
      if (wanted.has(id)) continue;
      if (map.getLayer(layer)) map.removeLayer(layer);
      if (map.getSource(layer)) map.removeSource(layer);
      drawn.delete(id);
    }
    for (const f of held) {
      const p = f.properties;
      if (!wanted.has(p.plume_id) || drawn.has(p.plume_id)) continue;
      const [w, s2, e2, n] = p.bounds.split(",").map(Number);
      const id = `${cfg.id}-img-${drawn.size}-${String(p.plume_id).replace(/[^A-Za-z0-9_-]/g, "")}`;
      try {
        map.addSource(id, { type: "image", url: p.picture,
          coordinates: [[w, n], [e2, n], [e2, s2], [w, s2]] });
        map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.85 } }, `${cfg.id}-pt`);
        drawn.set(p.plume_id, id);
      } catch (err) { /* a picture that will not load costs only itself */ }
    }
  };
  cfg.afterVisibility = () => pictures();
  map.on("moveend", pictures);
  map.on("zoomend", pictures);
  await read();
  pictures();
  applyVisibility(cfg.id);
  buildLegend();
}

// Nusantara's server publishes its own layer names as the titles, so the menu
// read as a list of file names: Global_PlantationIOP_2025, concessionitp_spv,
// v3p3_spatialplanmoratorium_spv. Each one below is that layer said plainly,
// written from its own name and what its workspace publishes. A layer not
// named here keeps the title the server gives it rather than being guessed at,
// which is why a handful are still their own ids.
const NUSANTARA_NAMES = {
  "AlertDFCOMBINERGB": "Trees cut, Indonesia and Malaysia \u2014 every alert system at once, as Nusantara reads them",
  "AlertGLADRGB": "Trees cut, seen by optical satellite (GLAD), as Nusantara reads it",
  "AlertRADDRGB": "Trees cut, seen through cloud by radar (RADD), as Nusantara reads it",
  "BALI_19650531": "Bali from the air, 31 May 1965",
  "BALI_19650531_Composite1": "Bali from the air, 31 May 1965 (composite)",
  "ECJRCV2": "Forest cover (EC JRC v2)",
  "FCHS_2020_ECJRCV2": "Forest cover 2020, with hillshade (EC JRC v2)",
  "Global_AllExpansionRGB_2000to2024": "Plantation expansion, 2000 to 2024 (picture)",
  "Global_AllExpansionRGB_2000to2025": "Plantation expansion, 2000 to 2025 (picture)",
  "Global_AllExpansion_2000to2025": "Plantation expansion, 2000 to 2025",
  "Global_FC-FNF-HS_Latest_TTM": "Forest and non-forest, latest, with hillshade (TheTreeMap)",
  "Global_FC-FNF_2024_TTM": "Forest and non-forest 2024 (TheTreeMap)",
  "Global_FC-FNF_2025_TTM": "Forest and non-forest 2025 (TheTreeMap)",
  "Global_FC_2025_TTM": "Forest cover 2025 (TheTreeMap)",
  "Global_LCHS_2024": "Land cover 2024, with hillshade",
  "Global_PlantationAll_2024": "Plantations of every kind 2024",
  "Global_PlantationAll_2025": "Plantations of every kind 2025",
  "Global_PlantationIOP_2024": "Industrial oil palm plantations 2024",
  "Global_PlantationIOP_2025": "Industrial oil palm plantations 2025",
  "Global_PlantationITP_2024": "Industrial timber plantations 2024",
  "Global_PlantationITP_2025": "Industrial timber plantations 2025",
  "Global_PlantationSmallholder_2024": "Smallholder plantations 2024",
  "Global_PlantationSmallholder_2025": "Smallholder plantations 2025",
  "Global_WaterChange_1984to2021": "Surface water change, 1984 to 2021 (EC JRC)",
  "IDNMYSBorneo_LCHSRiver": "Borneo land cover, with hillshade and rivers",
  "IDNMYSBorneo_LCIndustrial_1970": "Borneo industrial land 1970",
  "IDNMYSBorneo_SRTMHS30WGS_2000": "Borneo relief, 30 m (SRTM 2000)",
  "IDNMYSBorneo_Settlement_2017_GHS": "Settlements 2017, Borneo (GHSL)",
  "IDNMYSBorneo_Transmigration_2021": "Transmigration areas 2021, Borneo",
  "IDNMYSBorneo_Transmigration_2021_wms": "Transmigration areas 2021, Borneo",
  "IDNMYSBorneo_WaterChangeRGB_1984to2020_JRC": "Surface water change, 1984 to 2021 \u2014 Borneo (EC JRC)",
  "IDN_BurnedArea_2019_TheTreeMap": "Burned area 2019, Indonesia (TheTreeMap)",
  "IDN_BurnedArea_2020_TheTreeMap": "Burned area 2020, Indonesia (TheTreeMap)",
  "IDN_BurnedArea_2021_TheTreeMap": "Burned area 2021, Indonesia (TheTreeMap)",
  "IDN_FC2020_KLHK": "Forest cover 2020, Indonesia's own (Ministry of Environment and Forestry)",
  "IDN_Mining_2023": "Mining areas 2023, Indonesia",
  "LC1970": "Land cover 1970",
  "LC1970HS": "Land cover 1970, with hillshade",
  "REGBRNIDNMYS_Coconut_2020_Descal": "Coconut plantations 2020 \u2014 Brunei, Indonesia, Malaysia (Descals)",
  "REGBRNIDNMYS_FC-FNF-HS_Latest_TTM": "Forest and non-forest, latest, with hillshade \u2014 Brunei, Indonesia, Malaysia (TheTreeMap)",
  "REGBRNMYSIDN_FCHS_2020_ECJRC": "Forest cover 2020, with hillshade \u2014 Brunei, Malaysia, Indonesia (EC JRC)",
  "REGBRNMYSIDN_FCLandArea_2020_ECJRC": "Forest as a share of land area 2020 \u2014 Brunei, Malaysia, Indonesia (EC JRC)",
  "REGBRNMYSIDN_FC_2020_ECJRC": "Forest cover 2020 \u2014 Brunei, Malaysia, Indonesia (EC JRC)",
  "REGIDNMYS_TreeHeight_2020_ETHZurich": "Tree height 2020 \u2014 Indonesia and Malaysia (ETH Zurich)",
  "RGBProbabilityDF": "Deforestation probability",
  "admincountry_spv": "Country boundaries",
  "admindistrict_spv": "District boundaries",
  "adminprovince_spv": "Province boundaries",
  "adminsubdistrict_spv": "Sub-district boundaries",
  "adminvillage_spv": "Village boundaries",
  "alertfire_combine": "Fire alerts, MODIS and VIIRS together",
  "alertfire_modis": "Fire alerts, MODIS",
  "alertfire_viirs": "Fire alerts, VIIRS",
  "article_spv": "News articles, placed",
  "base_ikn": "Nusantara, the new Indonesian capital (IKN)",
  "base_peatland": "Peatland",
  "base_populatedplace": "Towns and villages",
  "base_road": "Roads",
  "base_roadRGB": "Roads, by the year they appeared (picture)",
  "base_road_edited": "Roads (their edited version)",
  "base_roadtrans": "Transmigration roads",
  "base_sagoindicative": "Sago, where it is likely to grow",
  "benthic_allencorral_global": "Reef habitats (Allen Coral Atlas)",
  "burned_area_annual": "Burned area, by year",
  "burned_area_biennial": "Burned area, two years at a time",
  "burned_area_biennial_del": "Burned area, two years at a time (marked for deletion on their server)",
  "burned_area_biennial_test": "Burned area, two years at a time (their test copy)",
  "burned_area_monthly": "Burned area, by month",
  "burned_area_rgb_crop": "Burned area (picture, cropped)",
  "burnedarea_rgb": "Burned area (picture)",
  "burnedareanrt": "Burned area, near real time, showing overlaps",
  // Named from Nusantara Atlas's own menu, as the owner read it off their site on
  // 21 September 2026: "Forest Clearance Authority (FCA) - Papua New Guinea".
  "concessionfca_spv": "Forest Clearance Authority (FCA) concessions",
  "concessionhgu_spv": "Plantation land-use rights (HGU)",
  "concessioniop_finance_credit": "Oil palm concessions, by who lends to them",
  "concessioniop_finance_invest": "Oil palm concessions, by who invests in them",
  "concessioniop_spv": "Oil palm concessions",
  "concessionitp_spv": "Industrial timber plantation concessions",
  "concessionlogging_spv": "Logging concessions",
  "concessionmining_spv": "Mining concessions",
  "concessionother_finance_credit": "Other concessions, by who lends to them",
  "concessionother_finance_invest": "Other concessions, by who invests in them",
  "concessionother_spv": "Concessions of other kinds",
  "concessionpbph_spv": "Forest utilisation permits (PBPH)",
  "concessionpsnmerauke_spv": "National Strategic Project concessions, Merauke",
  "concessiontimber_spv": "Timber concessions",
  "geotag": "Geotagged photographs",
  "hillshade": "Hillshade relief",
  "hires": "High-resolution imagery, the southern tip of Bali",
  "merauke_concessionother_sugarcane": "Sugarcane concessions, Merauke",
  "merauke_road_plan": "Planned roads, Merauke",
  "millop_finance_credit": "Palm oil mills, by who lends to them",
  "millop_finance_invest": "Palm oil mills, by who invests in them",
  "millop_spv": "Palm oil mills",
  "millopbuffer10km_spv": "Palm oil mill sourcing areas, 10 km",
  "millopbuffer1hr_spv": "Palm oil mill sourcing areas, one hour's drive",
  "millopbuffer2hr_spv": "Palm oil mill sourcing areas, two hours' drive",
  "millopbuffer_spv": "Palm oil mill sourcing areas",
  // Their menu lists "Near palm oil mills" at 10, 25 and 50 km. This id carries
  // its 50 km; what its "ol" stands for is not known and is not guessed at.
  "millopbufferol50km_spv": "Near palm oil mills, 50 km",
  "milloprefineries_sp": "Palm oil refineries",
  "papua_concessioniop_edited": "Oil palm concessions, Papua (their edited version)",
  "papua_expansion_2025": "Plantation expansion 2025, Papua",
  "papua_location12_sentinel2_true": "Papua, Sentinel-2 true colour \u2014 location 12",
  "papua_location13_sentinel2_true": "Papua, Sentinel-2 true colour \u2014 location 13",
  "papua_location1_sentinel2_true": "Papua, Sentinel-2 true colour \u2014 location 1",
  "papua_location2_sentinel2_true": "Papua, Sentinel-2 true colour \u2014 location 2",
  "papua_location6_sentinel2_true": "Papua, Sentinel-2 true colour \u2014 location 6",
  "plantation_established_merauke": "Established plantations, Merauke",
  "protectedarea_spv": "Protected areas",
  "protectedarea_spv_withlabel": "Protected areas, with their names",
  "protectedareadissolve_sp": "Protected areas, merged into one shape",
  "protectedareaoutline": "Protected area outlines",
  "protectedareareaconservationlandscape_spv": "Conservation landscapes",
  "protectedareareaecosystemrestoration_spv": "Ecosystem restoration areas",
  "protectedareareaforestreserve_spv": "Forest reserves",
  "protectedareareahydrologicalreserve_spv": "Hydrological reserves",
  "rawasingkil_10_canal": "Canals in Rawa Singkil, the ten longest",
  "rawasingkil_canal": "Canals in Rawa Singkil",
  "rawasingkil_illegal_oilpalm": "Illegal oil palm in Rawa Singkil",
  "rdtr_badung_2023": "Detailed spatial plan 2023, Badung (RDTR)",
  "roadsegmentbuffer_spv": "Land within reach of a road",
  "rtrw_badung_2024": "District spatial plan 2024, Badung (RTRW)",
  "rtrw_badung_2025": "District spatial plan 2025, Badung (RTRW)",
  "rtrw_tabanan_2023": "District spatial plan 2023, Tabanan (RTRW)",
  "rubber_kalimantan_2020": "Rubber plantations 2020, Kalimantan",
  "socialforestryhadat_spv": "Customary forest (hutan adat)",
  "socialforestryhd_spv": "Village forest (hutan desa)",
  "socialforestryhk_spv": "Community forest (hutan kemasyarakatan)",
  "socialforestryht_spv": "Community plantation forest (hutan tanaman rakyat)",
  "socialforestrywiladat_spv": "Customary territories (wilayah adat)",
  "spatialplanforestland_spv": "Forest estate, as the state designates it",
  "spatialplanmoratorium_spv": "Moratorium areas (PIPPIB)",
  "spatialplanrtrwn_spv": "National spatial plan (RTRWN)",
  "spatialplanrtrwp_papua_spv": "Provincial spatial plan, Papua (RTRWP)",
  "spatialplanrtrwp_papuawest_spv": "Provincial spatial plan, West Papua (RTRWP)",
  "v3p2_AlertDFCOMBINERGB": "Trees cut, Indonesia and Malaysia \u2014 every alert system at once (v3p2 copy)",
  "v3p2_GLADRGB": "GLAD deforestation alerts (v3p2 copy)",
  "v3p2_RADDRGB": "RADD radar deforestation alerts (v3p2 copy)",
  "v3p2_alertfire_combine": "Fire alerts, MODIS and VIIRS together (v3p2 copy)",
  "v3p2_alertfire_modis": "Fire alerts, MODIS (v3p2 copy)",
  "v3p2_alertfire_viirs": "Fire alerts, VIIRS (v3p2 copy)",
  "v3p2_protectedarea_spv": "Protected areas (v3p2 copy)",
  "v3p3_admincountry_spv": "Country boundaries (v3p3 copy)",
  "v3p3_admindistrict_spv": "District boundaries (v3p3 copy)",
  "v3p3_adminprovince_spv": "Province boundaries (v3p3 copy)",
  "v3p3_adminsubdistrict_spv": "Sub-district boundaries (v3p3 copy)",
  "v3p3_adminvillage_spv": "Village boundaries (v3p3 copy)",
  "v3p3_alertfire_combine": "Fire alerts, MODIS and VIIRS together (v3p3 copy)",
  "v3p3_alertfire_modis": "Fire alerts, MODIS (v3p3 copy)",
  "v3p3_alertfire_viirs": "Fire alerts, VIIRS (v3p3 copy)",
  "v3p3_concessioniop_spv": "Oil palm concessions (v3p3 copy)",
  "v3p3_concessionother_spv": "Concessions of other kinds (v3p3 copy)",
  "v3p3_roadsegmentbuffer_spv": "Land within reach of a road (v3p3 copy)",
  "v3p3_spatialplanforestland_spv": "Forest estate, as the state designates it (v3p3 copy)",
  "v3p3_spatialplanmoratorium_spv": "Moratorium areas (PIPPIB) (v3p3 copy)",
  "varticle": "News articles, placed (second copy)",
};

/* ---------- a catalogue's layers as rows of the map's own box ---------- */

// Nusantara publishes 158 layers and Global Forest Watch's catalogue several
// hundred. Kept inside one row each, they were a list a reader had to open and
// read past everything else in it. Here each one is a row of the layers box
// like any other, filed under the map's own headings by what it shows - and a
// layer that belongs to two subjects is filed under both, which the box now
// holds (see copyRow).
//
// The rules below are read in order and every match counts, so mining
// concessions land under Mining. Nothing is
// filed by which organisation published it: that is what the source link on
// the row is for.
const P = "Destruction > Of the planet";
const AG = P + " > Meat and agriculture > Agriculture";
const CATALOGUE_PLACES = [
  // "Alert" on its own is not deforestation: Nusantara's fire alerts carry it
  // too, and they belong under Fire. So the deforestation rule names the
  // systems and the words that mean forest loss, and fire keeps its own.
  [/deforest|forest ?loss|tree ?cover ?loss|disturb|expansion|probability|forest change|frontera|\bglad\b|\bradd\b|dist-?alert|integrated alert|trees cut|alert system|forest alert/i,
   P + " > Deforestation > Tree cover loss and alerts"],
  [/\bfires?\b|burn|(?<!biodiversity )hotspot/i, P + " > Fire"],
  [/mining|\bmines?\b|quarr|\bcoal\b|nickel|bauxite|\bgold\b/i, P + " > Mining"],
  [/oil and gas|oil & gas|\bgas\b|petroleum|geothermal/i, P + " > Oil and gas drilling"],
  // Agriculture, by crop where the box has a heading for it (22 September).
  [/palm|\bmills?\b|refiner/i, AG + " > Palm oil"],
  [/\bsoy|\bcorn\b|maize|grain|silo/i, AG + " > Soy, corn and grain"],
  [/cocoa|cotton/i, AG + " > Cocoa and cotton"],
  [/fertili[sz]er/i, AG + " > Farm inputs"],
  [/plantation|coconut|sugarcane|sago|coffee|crop|agricultur|pasture|yield|mapspam|\bhgu\b/i, AG],
  [/\bbeef\b|cattle|slaughter|\bpigs?\b|chickens?|livestock|pasture/i, P + " > Meat and agriculture > Meat > Facilities"],
  [/pulpwood|\bpulp\b|\bzdc\b|zero.deforestation/i, P + " > Deforestation > Wood pulp, Indonesia"],
  [/aquaculture|fisher|fishing|shrimp/i, P + " > Oceans > Fishing"],
  // A concession or permit is filed by what it is for - mining under Mining,
  // timber under Deforestation, oil palm under Agriculture (22 September; the
  // generic "Land held under permit" heading is gone). One for a material or
  // activity no heading covers (rubber, a project that names none) goes under
  // Other, below; so does a permit whose words say nothing about its use.
  [/timber|logging|wood fiber|forest utili[sz]ation|\bpbph\b|forest clearance|\bfca\b|management objective|forest concession|\bhph\b|\bhti\b|iuphhk/i,
   P + " > Deforestation"],
  [/rubber|concessions? of other kinds|other concessions|national strategic project|\bpsn\b/i, P + " > Other"],
  // Emissions catalogue rows, by gas (22 September): methane and nitrous oxide
  // where a title names them; otherwise carbon dioxide, the gas a forest or
  // land-use emission is.
  [/methane|\bch4\b/i, P + " > Climate > Methane"],
  [/nitrous|\bn2o\b/i, P + " > Climate > Nitrous oxide"],
  [/carbon|emission|biomass|climate|\bco2\b|flux|removals|temperature|precipitation/i, P + " > Climate > Carbon dioxide"],
  [/nitrogen dioxide|\bno2\b|\bnox\b|nitric oxide/i, P + " > Pollution > Nitrogen dioxide"],
  [/air quality|aerosol|pm2/i, P + " > Pollution > General and all pollutants"],
  [/protect|conserv|reserve|restoration|biodivers|intact forest|primary forest|wdpa|ramsar|species|habitat|ecozone|ecosystem|\bkba\b/i,
   P + " > Biodiversity loss"],
  [/peat/i, P + " > Peatland"],
  // Forest and land cover: the heading and its rows were taken out of the box
  // at the owner's request (22 September). A layer only this rule claims is
  // left out, and counted on the catalogue's own row.
  [/forest cover|forest and non-forest|land cover|tree height|forest as a share|tree cover extent|forest extent|tree cover density|forest age|industrial land/i, null],
  [/mangrove|reef|benthic|coral/i, P + " > Oceans > Reefs and mangroves"],
  [/water|aqueduct|river|watershed|flood|\bpond\b|canal/i, P + " > Surface water"],
  [/customary|\badat\b|indigenous|community land|tenure|land rights|quilombola|village forest|community forest|social forestry|rural settlement|forestry employment/i,
   "Suppression > Of humans > Land and territory"],
  [/\broads?\b|transmigration|settlement|capital|\bikn\b|infrastructure|urban|built/i, P + " > Construction"],
  // Spatial plans: the national and provincial plans and the moratorium (PIPPIB)
  // stay; the moratorium is also under Deforestation, being a bar on clearing
  // forest and peat; Badung's detailed plans go under Agriculture, as asked.
  [/badung/i, AG + " > Detailed spatial plans, Badung"],
  [/moratorium|pippib/i, P + " > Deforestation > Moratoriums"],
  [/spatial plan|forest estate|\brtrw\b|\brtrwn\b|\brtrwp\b|\brdtr\b|zoning|moratorium|pippib/i, P + " > Spatial plans"],
  [/boundar|admin|hillshade|relief|imagery|sentinel|from the air|geotag|news article|towns and villages|\bgadm\b|\bgrid\b|geostore|buffered|coverage layer|\bregions?\b/i,
   "Base and reference > Boundaries and relief"],
];
// Rows the owner placed or took out by name (22 September, round 2). Read
// before the rules above, against the row's title: the first that matches
// decides, and its paths are the row's only homes. A null path takes the row
// out of the box. Where a rule names a title the catalogue no longer carries,
// it matches nothing and changes nothing; map/filing-report.mjs lists which
// titles each rule caught.
const CATALOGUE_TAKEN_OUT = "(taken out)";
const CATALOGUE_BY_TITLE = [
  // Taken out: no tiles published, or regional repeats of worldwide rows.
  [/annual surface temperature anomal/i, null],
  [/(wdpa|protected areas?).*burn|burn.*(wdpa|protected areas?)/i, null],
  [/burn(ed|t) areas?.*(indonesia|equatorial asia|malaysia|brunei|borneo|kalimantan)/i, null],
  [/^(?!.*(global|worldwide)).*intact forest landscape/i, null],
  // Placed by name.
  [/tree cover loss by (dominant )?driver|drivers? of tree cover loss/i, [P + " > Deforestation > Tree cover loss and alerts"]],
  [/soy(bean)? planted area/i, [P + " > Climate > Nitrous oxide > Soy", AG + " > Soy, corn and grain"]],
  [/forest greenhouse gas emissions/i, [P + " > Deforestation"]],
  [/all[- ]ecosystem disturbance alerts|dist-?alert/i,
   [P + " > Construction", P + " > Biodiversity loss", P + " > Deforestation > Tree cover loss and alerts"]],
  [/intact forest landscape/i, [P + " > Biodiversity loss"]],
  [/biodiversity hotspots/i, [P + " > Biodiversity loss"]],
  [/\bdams?\b/i, [P + " > Biodiversity loss > Fish"]],
  [/oil (and|&) gas (concession|block|licen|lease)/i, [P + " > Oil and gas drilling", P + " > Climate > Infrastructure emitting more than one gas"]],
  [/protected areas?/i, [P + " > Biodiversity loss"]],
  [/nitrogen dioxide|\bno2\b/i, [P + " > Pollution > Nitrogen dioxide"]],
];
// Where a catalogue layer is, said in its title. Nusantara names the place in
// most of its ids and covers Equatorial Asia in the rest; a reader clicking
// "Fire alerts, VIIRS" under Fire should not have to find out by drawing it
// that it stops at Indonesia. Read from the id, never assumed: a layer whose id
// says nothing takes the atlas's own stated coverage.
const NUSANTARA_WHERE = [
  [/^Global_|^v3p\d_Global/i, "worldwide"],
  [/BRNIDNMYS|BRNMYSIDN/i, "Brunei, Indonesia and Malaysia"],
  [/IDNMYSBorneo/i, "Borneo"],
  [/REGIDNMYS/i, "Indonesia and Malaysia"],
  [/^BALI_|badung|tabanan/i, "Bali"],
  [/^concessionfca_/i, "Papua New Guinea"],
  [/papua/i, "Papua"],
  [/merauke/i, "Merauke"],
  [/rawasingkil/i, "Rawa Singkil"],
  [/kalimantan/i, "Kalimantan"],
  [/^IDN_|_KLHK|^IDN/i, "Indonesia"],
];
function nusantaraWhere(id) {
  for (const [rule, where] of NUSANTARA_WHERE) if (rule.test(id)) return where;
  return "Equatorial Asia";
}

const LEFT_OUT = "(left out)";
function cataloguePlaces(words, title) {
  if (title != null) {
    for (const [rule, paths] of CATALOGUE_BY_TITLE) if (rule.test(title)) return paths ? paths.slice() : [CATALOGUE_TAKEN_OUT];
  }
  let out = [];
  let dropped = false;
  for (const [rule, path] of CATALOGUE_PLACES) {
    if (!rule.test(words)) continue;
    if (path === null) dropped = true; else if (!out.includes(path)) out.push(path);
  }
  const drop = (path) => { const i = out.indexOf(path); if (i > -1) out.splice(i, 1); };
  // Rubber was asked to go under Other, not Agriculture, though its rows say "plantation".
  if (/rubber/i.test(words)) drop(AG);
  // A crop's own heading stands in for the general one; by sector stands in for by gas.
  if (out.some((p) => p.startsWith(AG + " > "))) drop(AG);
  if (out.some((x) => x === P + " > Climate > Methane" || x === P + " > Climate > Nitrous oxide")) drop(P + " > Climate > Carbon dioxide");
  if (out.includes(AG + " > Detailed spatial plans, Badung")) drop(P + " > Spatial plans");
  // A concession or permit whose words name no material and no activity.
  if (!out.length && !dropped && /concession|permit|licen[cs]e|\bizin\b/i.test(words)) out.push(P + " > Other");
  if (!out.length && dropped) return [LEFT_OUT];
  return out.length ? out : ["Not yet placed"];
}

// The body of the heading a path names. Headings are made by the order, not
// here: a path nothing in the box answers to is left to Not yet placed, so a
// layer is never filed somewhere invented for it.
function sectionBody(box, path) {
  const want = path.split(" > ");
  let where = box;
  for (const name of want) {
    let found = null;
    for (const sec of where.querySelectorAll(".toc-sec")) {
      const t = sec.querySelector(".toc-t");
      if (t && t.textContent.trim().toLowerCase() === name.trim().toLowerCase()) { found = sec; break; }
    }
    if (!found) return null;
    where = found.querySelector(".toc-body") || found;
  }
  return where;
}

// One row per catalogue layer, in every heading its words put it under.
// data-cat drives the layer; a second home gets data-cat-copy and ticks the
// first, so nothing is built twice and both boxes read the same.
function catalogueRows(cfg, items) {
  const box = document.getElementById("layers");
  if (!box || !items.length) return;
  const spare = sectionBody(box, "Not yet placed") || box;
  let leftOut = 0;
  const takenOut = [];
  items.forEach((item, i) => {
    const key = `${cfg.id}|${i}`;
    // A row may say what it is to be filed by, where its long description would
    // mislead: a Trase tooltip that mentions water in passing is not a water layer.
    // Filed by its title and id. The long description used to count too, and a
    // passing word in it filed rows under subjects they are not about: the
    // drivers of tree cover loss under Fire (fire is one driver), protected
    // areas and dams under Fire, oil and gas concessions under Mining.
    const paths = cataloguePlaces(item.fileBy || `${item.title} ${item.name}`, item.title);
    item.key = key;
    if (paths[0] === LEFT_OUT) { leftOut++; item.leftOut = true; return; }
    if (paths[0] === CATALOGUE_TAKEN_OUT) { takenOut.push(item.title); item.leftOut = true; return; }
    paths.forEach((path, n) => {
      const row = document.createElement("label");
      row.className = "layer layer-cat" + (n ? " layer-copy" : "");
      row.innerHTML =
        `<input type="checkbox" data-${n ? "cat-copy" : "cat"}="${escapeHtml(key)}">` +
        `<span class="swatch" style="background:${cfg.colour}"></span>` +
        `<span class="body"><span class="nm">${escapeHtml(item.title)}` +
        `<span class="live" title="Read from the source itself when this row is ticked, not from a copy kept here">LIVE</span>` +
        `${siteLink(cfg.id)}${infoMark(item.about)}</span>` +
        `<span class="un" data-state="${escapeHtml(key)}">${escapeHtml(cfg.catUnit || "")}</span></span>`;
      (sectionBody(box, path) || spare).appendChild(row);
    });
  });
  if (leftOut) console.info(`[culprits] ${cfg.id}: ${leftOut} land-cover layers have no row, at the owner's request (22 September)`);
  if (takenOut.length) console.info(`[culprits] ${cfg.id}: taken out by name at the owner's request: ${takenOut.join("; ")}`);
  countHeadings(box);
  if (box.dataset.catWired) return;
  box.dataset.catWired = "1";
  box.addEventListener("change", (e) => {
    const t = e.target;
    if (!t || !t.dataset) return;
    const copied = t.dataset.catCopy;
    if (copied) {
      const real = box.querySelector(`[data-cat="${copied}"]`);
      if (real && real.checked !== t.checked) {
        real.checked = t.checked;
        if (typeof real.dispatchEvent === "function" && typeof Event === "function") real.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }
    const key = t.dataset.cat;
    if (!key) return;
    for (const i of box.querySelectorAll(`[data-cat-copy="${key}"]`)) i.checked = t.checked;
    const hit = CATALOGUE_ITEMS.get(key);
    if (hit) hit.show(t.checked);
  });
}
const CATALOGUE_ITEMS = new Map();
// A catalogue row found, when ticked, to have nothing it can draw leaves the
// box (and so do its copies), after saying why for a few seconds. The owner's
// rule is that a row which can never draw is not shown (21 and 22 September);
// the asset list read at the start normally keeps such rows out, and this
// catches the ones it missed.
function catalogueRowGone(key, ms = 8000) {
  const box = document.getElementById("layers");
  if (!box || !box.querySelectorAll) return;
  setTimeout(() => {
    for (const tick of box.querySelectorAll(`[data-cat="${key}"], [data-cat-copy="${key}"]`)) {
      const row = tick.closest ? tick.closest("label") : null;
      if (row && row.remove) row.remove();
    }
    const legend = box.querySelector ? box.querySelector(`.facet[data-legend-for="${key}"]`) : null;
    if (legend && legend.remove) legend.remove();
    CATALOGUE_ITEMS.delete(key);
    if (typeof countHeadings === "function") countHeadings(box);
  }, ms);
}
// What is happening to one catalogue row, said on that row and its copies. It
// used to be said on the catalogue's own row, which is out of sight: a dataset
// with no tiles, or one whose server refused, looked as if nothing had happened.
function rowSay(key, text) {
  const box = document.getElementById("layers");
  if (!box || !box.querySelectorAll) return;
  for (const tick of box.querySelectorAll(`[data-cat="${key}"], [data-cat-copy="${key}"]`)) {
    const row = tick.closest ? tick.closest("label") : null;
    const el = row && row.querySelector(".un");
    if (el) el.textContent = text;
  }
}

/* ---------- a map server's whole layer list, as a menu (Nusantara Atlas) ---------- */
async function addWmsMenuLayer(cfg) {
  const layers = [];
  for (const base of cfg.wms) {
    try {
      const r = await fetch(`${base}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`);
      const doc = new DOMParser().parseFromString(await r.text(), "application/xml");
      for (const l of doc.getElementsByTagName("Layer")) {
        const nm = [...l.children].find((c) => c.tagName === "Name");
        if (!nm || [...l.getElementsByTagName("Layer")].length) continue;
        const tt = [...l.children].find((c) => c.tagName === "Title");
        const ab = [...l.children].find((c) => c.tagName === "Abstract");
        const id = nm.textContent;
      const said = NUSANTARA_NAMES[id] || (tt && tt.textContent) || id;
      const where = nusantaraWhere(id);
      layers.push({ base, name: id, title: new RegExp(where, "i").test(said) ? said : `${said} \u2014 ${where}`,
        about: (ab && ab.textContent) || "" });
      }
    } catch (e) { console.warn(`[culprits] ${cfg.id}: ${base}: ${e.message}`); }
  }
  if (!layers.length) { setLayerState(cfg.id, "the map server did not list its layers"); return; }
  layers.sort((a, b) => a.title.localeCompare(b.title));
  cfg._layers = layers;
  const tilesFor = (l) => `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(l.name)}&STYLES=` +
    `&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`;
  // The same title served twice (the site runs two map servers) says which.
  const seen = {};
  layers.forEach((l) => { seen[l.title] = (seen[l.title] || 0) + 1; });
  layers.forEach((l) => { if (seen[l.title] > 1) l.title += ` (${l.base.replace(/^https?:\/\//, "").split("/")[0]})`; });
  const lid = (i) => `${cfg.id}-w${i}`;
  cfg._layerIds = layers.map((l, i) => lid(i));
  // Whether this server lets a page read its pictures (it must, for "seen" to
  // work on them). Asked once per server, with the smallest picture there is;
  // a server that refuses has its pictures drawn as they come.
  const readable = {};
  const canRead = async (l) => {
    if (!(l.base in readable)) {
      try {
        const r = await fetch(tilesFor(l).replace("{bbox-epsg-3857}", "0,0,1,1").replace("WIDTH=256&HEIGHT=256", "WIDTH=2&HEIGHT=2"));
        readable[l.base] = r.ok;
      } catch (e) { readable[l.base] = false; }
    }
    return readable[l.base];
  };
  // The server's own key to a layer's colours, under its row while it is ticked.
  const legendFor = (item, l) => {
    const box = document.getElementById("layers");
    const tick = box && box.querySelector ? box.querySelector(`[data-cat="${item.key}"]`) : null;
    const row = tick && tick.closest ? tick.closest("label") : null;
    if (!row || !document.createElement || box.querySelector(`.facet[data-legend-for="${item.key}"]`)) return;
    const el = document.createElement("div");
    el.className = "facet wms-legend";
    el.dataset.legendFor = item.key;
    const img = document.createElement("img");
    img.alt = `Key to ${l.title}`;
    img.loading = "lazy";
    img.src = `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&TRANSPARENT=true&LAYER=${encodeURIComponent(l.name)}` +
      `&LEGEND_OPTIONS=${encodeURIComponent("fontColor:0xDCD6C6;fontAntiAliasing:true;fontSize:11;forceLabels:on")}`;
    img.onerror = () => el.remove();                  // no key published: no empty box
    el.appendChild(img);
    row.after(el);
  };
  const legendOff = (item) => {
    const box = document.getElementById("layers");
    const el = box && box.querySelector ? box.querySelector(`.facet[data-legend-for="${item.key}"]`) : null;
    if (el) el.remove();
  };
  const on = new Set();
  const adding = new Set();
  // Each layer is a row of the box, filed by what it shows. The row that
  // carried the menu says how many there are and how many are drawn.
  const apply = (vis) => layers.forEach((l, i) => {
    if (map.getLayer(lid(i))) map.setLayoutProperty(lid(i), "visibility", vis === "visible" && on.has(i) ? "visible" : "none");
  });
  cfg.afterVisibility = apply;
  const show = () => setLayerState(cfg.id, on.size ? `${on.size} of ${layers.length} layers drawn` : `${layers.length} layers, each a row below`);
  const items = layers.map((l, i) => ({
    name: l.name, title: l.title, about: l.about,
    show: (want) => {
      // Ticking one of its layers turns the row itself on, as the menu did.
      if (want) {
        showRowFor(cfg.id);
        on.add(i);
        legendFor(items[i], layers[i]);
        if (!map.getLayer(lid(i)) && !adding.has(i)) {
          adding.add(i);
          canRead(layers[i]).then((ok) => {
            adding.delete(i);
            if (map.getLayer(lid(i))) return;
            const plain = tilesFor(layers[i]);
            map.addSource(lid(i), { type: "raster", tileSize: 256, attribution: cfg.attribution || "",
              tiles: [ok ? plain.replace(/^https:\/\//, "seen://") : plain] });
            map.addLayer({ id: lid(i), type: "raster", source: lid(i), paint: { "raster-opacity": 0.85 } });
            apply(visibility.get(cfg.id) || "none");
          });
        }
      } else { on.delete(i); legendOff(items[i]); }
      apply(visibility.get(cfg.id) || "none");
      show();
    },
  }));
  catalogueRows(cfg, items);
  items.forEach((it) => CATALOGUE_ITEMS.set(it.key, it));
  show();
  map.on("click", async (e) => {
    if ((visibility.get(cfg.id) || "visible") !== "visible" || !on.size) return;
    const b = map.getBounds(), c = map.getCanvas();
    const w = c.clientWidth || 800, h = c.clientHeight || 600;
    const pt = map.project(e.lngLat);
    const parts = [];
    for (const i of on) {
      const l = layers[i];
      const q = `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${encodeURIComponent(l.name)}&QUERY_LAYERS=${encodeURIComponent(l.name)}` +
        `&STYLES=&SRS=EPSG:4326&BBOX=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&WIDTH=${w}&HEIGHT=${h}` +
        `&X=${Math.round(pt.x)}&Y=${Math.round(pt.y)}&INFO_FORMAT=application/json&FEATURE_COUNT=5`;
      try {
        const feats = (await getJson(q)).features || [];
        if (feats.length) parts.push(`<b>${escapeHtml(l.title)}</b>` + feats.map((f) => `<table class="meta">${fieldRows(f.properties || {})}</table>`).join("<hr>"));
      } catch (err) { /* nothing there, or the server declined */ }
    }
    if (parts.length) new maplibregl.Popup({ closeButton: true, maxWidth: "340px" }).setLngLat(e.lngLat).setHTML(parts.join("<hr>")).addTo(map);
  });
  show();
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- Global Forest Watch's whole catalogue, as a menu ---------- */
// A dataset Global Forest Watch lists without a title gets one here, where what
// it is can be shown. pangaea_global_mining (version 2) is the mining-area
// outlines of Maus et al., published through the PANGAEA data library - the
// same work as the Mines row, in Global Forest Watch's copy. Any other untitled
// dataset shows its id in words, marked as having no title, rather than a guess.
const GFW_TITLES = {
  pangaea_global_mining: "Mining areas worldwide \u2014 outlines by Maus et al., from the PANGAEA data library (Global Forest Watch\u2019s copy)",
};
function gfwTitle(d) {
  const meta = d.metadata || {};
  if (meta.title) return meta.title;
  if (GFW_TITLES[d.dataset]) return GFW_TITLES[d.dataset];
  const words = String(d.dataset).replace(/_/g, " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} (Global Forest Watch gives this dataset no title)`;
}
// Which of a dataset's assets to draw from. Only one marked "saved": a tile
// cache still "pending" has no tiles behind it (tsc_drivers), and drew nothing.
// A static vector cache before a dynamic one: dynamic tiles are made on request
// from the database and are slow, which is what made the mining concessions and
// the PANGAEA mining layer seem not to load.
// A dataset with no tile cache but a COG (one cloud-ready GeoTIFF) is drawn
// through the tile service Global Forest Watch's own map uses for them, which
// answers an outside page (checked 21 September: 200, image/png). That is how
// DIST-ALERT, the integrated alerts and the WRI/Google drivers now draw.
const GFW_COG_TILES = "https://tiles.globalforestwatch.org/cog/basic/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=";
// The zooms an asset's tiles exist at, as its record says (creation_options or
// metadata); asking past them is what returned 422 for several datasets.
function gfwZooms(a) {
  const m = Object.assign({}, a.metadata || {}, a.creation_options || {});
  const lo = Number.isFinite(Number(m.min_zoom)) ? Number(m.min_zoom) : 0;
  const hi = Number.isFinite(Number(m.max_zoom)) ? Number(m.max_zoom) : 12;
  return { minzoom: Math.max(0, Math.min(lo, hi)), maxzoom: Math.max(lo, hi) };
}
function gfwPickAsset(assets) {
  const saved = (assets || []).filter((a) => String(a.status || "saved").toLowerCase() === "saved");
  const ok = saved.filter((a) => /^https?:/.test(a.asset_uri || ""));
  const kind = (re, from) => (from || ok).find((a) => re.test(a.asset_type || ""));
  const vec = kind(/static vector tile cache/i) || kind(/vector tile cache/i);
  if (vec) return { how: "vector", slow: !/static/i.test(vec.asset_type), uri: vec.asset_uri, ...gfwZooms(vec) };
  const ras = kind(/raster tile cache/i);
  if (ras) return { how: "raster", uri: ras.asset_uri, ...gfwZooms(ras) };
  const cog = kind(/^COG$/i, saved.filter((a) => /^s3:\/\//.test(a.asset_uri || "")));
  if (cog) return { how: "cog", uri: GFW_COG_TILES + encodeURIComponent(cog.asset_uri), minzoom: 0, maxzoom: 12 };
  const waiting = (assets || []).some((a) => /tile cache/i.test(a.asset_type || "") && !/saved/i.test(a.status || ""));
  return { how: "none", waiting };
}
// Every asset Global Forest Watch lists, read in four requests at the start
// (one per kind that can be drawn) instead of two per dataset on each tick,
// grouped by dataset with the latest version's assets kept. From this the box
// knows before any row is made which datasets can be drawn at all.
function gfwAssetIndex(rows) {
  const by = {};
  for (const a of rows || []) {
    if (!a || !a.dataset) continue;
    (by[a.dataset] = by[a.dataset] || []).push(a);
  }
  const out = {};
  for (const id of Object.keys(by)) {
    const list = by[id];
    const latest = list.filter((a) => a.is_latest);
    const versions = [...new Set(list.map((a) => String(a.version || "")))].sort();
    out[id] = latest.length ? latest : list.filter((a) => String(a.version || "") === versions[versions.length - 1]);
  }
  return out;
}
const GFW_DRAWABLE_KINDS = ["Static vector tile cache", "Dynamic vector tile cache", "Raster tile cache", "COG"];
// Datasets with no tiles of their own whose alerts another row already draws.
const GFW_DRAWN_BY = {
  umd_glad_dist_alerts: "Any loss of plant cover, worldwide (DIST-ALERT)",
  gfw_integrated_dist_alerts: "Any loss of plant cover, worldwide (DIST-ALERT)",
};

async function addGfwMenuLayer(cfg) {
  const all = [];
  for (let page = 1; page < 30; page++) {
    let j;
    try { j = await getJson(`${cfg.api}/datasets?page[size]=100&page[number]=${page}`, 40000); } catch (e) { break; }
    const rows = j.data || [];
    all.push(...rows);
    if (rows.length < 100) break;
  }
  if (!all.length) { setLayerState(cfg.id, "the catalogue did not answer"); return; }
  // The asset index. If it cannot be read the rows are made as before and each
  // dataset's assets are looked up when it is ticked.
  let index = null;
  try {
    // Each kind is read on its own and tried twice. One slow page used to throw
    // the whole list away, and then every download-only dataset got a row.
    const readKind = async (kind) => {
      const got = [];
      for (let page = 1; page < 20; page++) {
        const j = await getJson(`${cfg.api}/assets?asset_type=${encodeURIComponent(kind)}&page[size]=1000&page[number]=${page}`, 60000);
        const part = Array.isArray(j.data) ? j.data : [];
        got.push(...part);
        if (part.length < 1000) break;
      }
      return got;
    };
    const kinds = await Promise.all(GFW_DRAWABLE_KINDS.map((k) => readKind(k).catch(() => readKind(k))));
    const rows = [].concat(...kinds);
    if (rows.length) index = gfwAssetIndex(rows);
  } catch (e) { console.warn(`[culprits] ${cfg.id}: the asset list could not be read (${e.message}); assets are looked up on each tick`); }
  // Datasets Global Forest Watch publishes only as downloads - no tile cache and
  // no COG - are left out of the box, at the owner's request (21 September):
  // a row that can never draw is noise. How many were left out is said on the
  // catalogue's own row and in the console, with their ids.
  let leftOut = [];
  if (index) {
    leftOut = all.filter((d) => gfwPickAsset(index[d.dataset] || []).how === "none").map((d) => d.dataset);
    if (leftOut.length) console.info(`[culprits] ${cfg.id}: ${leftOut.length} datasets are downloads only and have no row: ${leftOut.join(", ")}`);
  }
  // Where a dataset is, as GFW themselves record it. Left off where they
  // record nothing rather than guessed at from the name.
  const items = all.filter((d) => !leftOut.includes(d.dataset)).map((d) => {
    const meta = d.metadata || {};
    const said = gfwTitle(d);
    const where = String(meta.geographic_coverage || "").trim();
    return { id: d.dataset, meta,
      title: where && !new RegExp(where.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(said) ? `${said} \u2014 ${where}` : said };
  })
    .sort((a, b) => a.title.localeCompare(b.title));
  // Each dataset is a row of the layers box, filed by what it shows. Several
  // can be drawn at once now: the menu drew one at a time and cleared the last,
  // which made comparing two of them impossible.
  const drawn = new Map();          // dataset id -> the layer ids it drew
  const safe = (x) => String(x).replace(/[^a-z0-9_]/gi, "_");
  cfg._layerIds = [];
  const applyAll = (vis) => {
    for (const ids of drawn.values()) for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
  };
  cfg.afterVisibility = applyAll;
  const said = () => setLayerState(cfg.id, (drawn.size
    ? `${drawn.size} of ${items.length} datasets drawn`
    : `${items.length} datasets, each a row below`) + (leftOut.length ? ` \u00b7 ${leftOut.length} more are downloads only and have no row` : ""));
  const take = (d) => {
    for (const id of drawn.get(d.id) || []) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(`${cfg.id}-${safe(d.id)}`)) map.removeSource(`${cfg.id}-${safe(d.id)}`);
    drawn.delete(d.id);
    cfg._layerIds = [].concat(...drawn.values());
    said();
  };
  const put = async (d) => {
    showRowFor(cfg.id);
    setLayerState(cfg.id, `${d.title}: finding its tiles\u2026`);
    rowSay(d.key, "finding its tiles\u2026");
    const src = `${cfg.id}-${safe(d.id)}`;
    const ids = [];
    try {
      let assets = index ? (index[d.id] || []) : null;
      if (!assets) {
        let version = null;
        try { version = (await getJson(`${cfg.api}/dataset/${d.id}/latest`)).data.version; } catch (e) { /* none marked latest */ }
        if (!version) {
          // No version is marked latest (a 404 there): the newest one listed.
          const vs = ((await getJson(`${cfg.api}/dataset/${d.id}`)).data || {}).versions || [];
          version = vs.slice().sort().pop();
        }
        assets = version ? ((await getJson(`${cfg.api}/dataset/${d.id}/${version}/assets`)).data || []) : [];
      }
      const asset = gfwPickAsset(assets);
      const vec = asset.how === "vector" ? { asset_uri: asset.uri } : null;
      const ras = asset.how === "raster" || asset.how === "cog" ? { asset_uri: asset.uri } : null;
      const about = [d.meta.license ? `licence: ${d.meta.license}` : "", d.meta.source ? `source: ${String(d.meta.source).replace(/\[|\]\([^)]*\)/g, "")}` : ""].filter(Boolean).join("; ");
      if (vec) {
        const uri = vec.asset_uri;
        const buf = await (await fetch(uri.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0"))).arrayBuffer().catch(() => null);
        const names = buf ? readTileLayers(buf) : [];
        map.addSource(src, { type: "vector", tiles: [uri], minzoom: asset.minzoom, maxzoom: asset.maxzoom });
        for (const n of (names.length ? names : [d.id, "default"])) {
          const base = { source: src, "source-layer": n };
          map.addLayer({ id: `${src}-f-${safe(n)}`, type: "fill", ...base, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": cfg.colour, "fill-opacity": 0.45, "fill-outline-color": "#1D1B17" } });
          map.addLayer({ id: `${src}-l-${safe(n)}`, type: "line", ...base, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": cfg.colour, "line-width": 1.2 } });
          map.addLayer({ id: `${src}-p-${safe(n)}`, type: "circle", ...base, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": cfg.colour, "circle-radius": 3, "circle-stroke-width": 0.5, "circle-stroke-color": "#17150F" } });
          for (const id of [`${src}-f-${safe(n)}`, `${src}-l-${safe(n)}`, `${src}-p-${safe(n)}`]) {
            ids.push(id);
            bindHtmlPopup(id, (p) => `<b>${escapeHtml(d.title)}</b><table class="meta">${fieldRows(p)}</table>`);
          }
        }
      } else if (ras) {
        map.addSource(src, { type: "raster", tileSize: 256, tiles: [ras.asset_uri], minzoom: asset.minzoom, maxzoom: asset.maxzoom });
        map.addLayer({ id: `${src}-r`, type: "raster", source: src, paint: { "raster-opacity": 0.8, "raster-saturation": -0.3 } });
        ids.push(`${src}-r`);
      } else {
        setLayerState(cfg.id, `${d.title}: Global Forest Watch publishes no map tiles for this dataset (download only)`);
        rowSay(d.key, (asset.waiting
          ? "Global Forest Watch lists map tiles for this dataset but has not finished making them \u2014 nothing to draw yet"
          : "no map tiles are published for this dataset, only files to download \u2014 nothing to draw") +
          (GFW_DRAWN_BY[d.id] ? `. The same alerts are drawn by the row \u201c${GFW_DRAWN_BY[d.id]}\u201d` : "") +
          ". This row will now leave the list.");
        console.info(`[culprits] ${cfg.id}: ${d.id} has nothing to draw; its row is taken out`);
        catalogueRowGone(d.key);
        return;
      }
      drawn.set(d.id, ids);
      cfg._layerIds = [].concat(...drawn.values());
      applyAll(visibility.get(cfg.id) || "visible");
      said();
      rowSay(d.key, vec ? (asset.slow ? "drawn from tiles Global Forest Watch makes as they are asked for, so it fills in slowly" : "drawn from its vector tiles")
        : asset.how === "cog" ? "drawn as a picture from its GeoTIFF, through Global Forest Watch\u2019s own tile service"
        : `drawn from its picture tiles, to zoom ${asset.maxzoom}`);
      // A tile that fails says so on the row, once, instead of leaving an empty map.
      const failed = (e) => {
        if (!e || e.sourceId !== src) return;
        map.off("error", failed);
        const st = e.error && e.error.status;
        if (st === 404 && e.tile) return;                       // an empty square: nothing there, not a fault
        rowSay(d.key, st === 422 ? "Global Forest Watch refuses tiles at this zoom for this dataset (422); zoom out or in"
          : `its tiles are not answering (${(e.error && e.error.message) || "error"})`);
      };
      map.on("error", failed);
      if (about) console.info(`[culprits] ${d.title} \u2014 ${about}`);
    } catch (e) {
      setLayerState(cfg.id, `${d.title}: ${e.message}`);
      rowSay(d.key, `could not be read (${e.message})`);
    }
  };
  const rows = items.map((d) => ({
    name: d.id, title: d.title, about: `${d.meta.function || ""} ${d.meta.overview || ""}`.trim(),
    show: (want) => { if (want) put(d); else { take(d); rowSay(d.key, cfg.catUnit || ""); } },
  }));
  catalogueRows(cfg, rows);
  rows.forEach((r, i) => { items[i].key = r.key; CATALOGUE_ITEMS.set(r.key, r); });
  said();
}

/* ---------- The Social Spheres: its bodies on the map, its own card on a click ---------- */
// The map's data is read from its own page; the card is the page itself, loaded
// once into a frame of the same origin (srcdoc) with everything but its card
// hidden, and asked to open a body with its own openNode().
function spheresData(html) {
  const at = html.indexOf("const DATA = ");
  if (at < 0) throw new Error("the page no longer carries its DATA");
  let i = html.indexOf("{", at), depth = 0, inStr = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(html.slice(i, j + 1));
  }
  throw new Error("the page's DATA could not be read");
}
function spheresKinds(html) {
  const m = /const KIND=\{([^;]*)\};/.exec(html);
  const out = {};
  if (m) for (const [, k, c] of m[1].matchAll(/(\w+):\{c:'(#[0-9A-Fa-f]{6})'\}/g)) out[k] = c;
  return out;
}
let spheresFrame = null;
function spheresCard(cfg, html, id) {
  let wrap = document.getElementById("spheres-card");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "spheres-card";
    wrap.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,92vw);height:min(82vh,900px);" +
      "z-index:70;border:1px solid var(--rule);box-shadow:0 10px 40px rgba(0,0,0,.6);background:#EDE6D6";
    spheresFrame = document.createElement("iframe");
    spheresFrame.title = "The Social Spheres";
    spheresFrame.style.cssText = "width:100%;height:100%;border:0;display:block";
    const hide = "<style>body>*:not(#card):not(#scrim){display:none!important}" +
      "#card{position:fixed!important;inset:0!important;left:0!important;top:0!important;width:100%!important;height:100%!important;" +
      "max-width:none!important;max-height:none!important;transform:none!important;display:flex!important}" +
      "#scrim{display:none!important}#recentre,.rsz{display:none!important}</style>";
    spheresFrame.srcdoc = html.replace("</head>", hide + "</head>");
    wrap.appendChild(spheresFrame);
    document.body.appendChild(wrap);
    spheresFrame.addEventListener("load", () => {
      const d = spheresFrame.contentDocument;
      const shut = d && d.getElementById("shut");
      if (shut) shut.addEventListener("click", () => { wrap.hidden = true; });
      spheresOpen(wrap._pending);
    });
  }
  wrap.hidden = false;
  wrap._pending = id;
  spheresOpen(id);
}
// What to open: a body's id, or { fn: "openPerson" | "openSector", arg } - the map's own functions.
function spheresOpen(what) {
  const w = spheresFrame && spheresFrame.contentWindow;
  if (!what || !w || !w.document || w.document.readyState !== "complete") return;
  const fn = typeof what === "string" ? "openNode" : what.fn;
  if (!["openNode", "openPerson", "openSector"].includes(fn)) return;
  const arg = typeof what === "string" ? what : what.arg;
  try { w.eval(`${fn}(${JSON.stringify(arg)})`); } catch (e) { console.warn("[culprits] social spheres card:", e.message); }
}
function spheresLabels(html) {
  const m = /const KINDLABEL=\{([^;]*)\};/.exec(html || "");
  const out = {};
  if (m) for (const [, k, v] of m[1].matchAll(/(\w+):"([^"]*)"/g)) out[k] = v;
  return out;
}
function spheresControls(cfg, html, D, kinds) {
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (!anchor || !anchor.after || !document.createElement) return;
  const labels = spheresLabels(html);
  const used = [...new Set(D.nodes.map((n) => n.kind))];
  const picked = new Set();
  const el = document.createElement("div");
  el.className = "facet";
  const people = (D.people || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const sectors = (D.sectors || []).map((s) => s.name).sort();
  el.innerHTML = `<span class="chip reset" data-sk="">All kinds</span>` + used.map((k) =>
      `<button type="button" class="chip" data-sk="${escapeHtml(k)}"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;` +
      `background:${kinds[k] || cfg.colour};margin-right:4px"></i>${escapeHtml(labels[k] || k)}</button>`).join("") +
    `<input list="${cfg.id}-people" placeholder="Find a person" aria-label="Find a person" style="flex:1 1 100%;margin-top:4px;font:inherit;` +
      `color:var(--bone);background:var(--peat,#17150F);border:1px solid var(--rule);border-radius:2px;padding:2px 5px">` +
    `<datalist id="${cfg.id}-people">${people.map((p) => `<option value="${escapeHtml(p.name)}"></option>`).join("")}</datalist>` +
    (sectors.length ? `<select aria-label="Sector" style="flex:1 1 100%;margin-top:4px"><option value="">Sector\u2026</option>` +
      sectors.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("") + `</select>` : "");
  el.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-sk]");
    if (!b) return;
    e.stopPropagation();
    const k = b.dataset.sk;
    if (!k) picked.clear(); else if (picked.has(k)) picked.delete(k); else picked.add(k);
    for (const c of el.querySelectorAll("[data-sk]")) c.classList.toggle("on", c.dataset.sk ? picked.has(c.dataset.sk) : picked.size === 0);
    map.setFilter(`${cfg.id}-pt`, picked.size ? ["in", ["get", "kind"], ["literal", [...picked]]] : null);
  });
  const find = el.querySelector("input");
  find.addEventListener("change", () => {
    const p = people.find((x) => x.name === find.value);
    if (p) spheresCard(cfg, html, { fn: "openPerson", arg: p.id });
  });
  const sec = el.querySelector("select");
  if (sec) sec.addEventListener("change", () => { if (sec.value) spheresCard(cfg, html, { fn: "openSector", arg: sec.value }); });
  anchor.after(el);
}

async function addSpheresLayer(cfg) {
  let html;
  try {
    const r = await fetch(cfg.page);
    if (!r.ok) throw new Error(`${r.status}`);
    html = await r.text();
  } catch (e) { setLayerState(cfg.id, `the map's page could not be read (${e.message})`); return; }
  let D;
  try { D = spheresData(html); } catch (e) { setLayerState(cfg.id, e.message); return; }
  const kinds = spheresKinds(html);
  const N = new Map(D.nodes.map((n) => [n.id, n]));
  const pts = D.nodes.map((n) => ({ type: "Feature", geometry: { type: "Point", coordinates: [n.lng, n.lat] },
    properties: { id: n.id, name: n.name, kind: n.kind, c: kinds[n.kind] || cfg.colour, linked: n.linked ? 1 : 0 } }));
  const lines = (D.edges || []).filter((e) => N.has(e.a) && N.has(e.b)).map((e) => ({ type: "Feature",
    geometry: { type: "LineString", coordinates: [[N.get(e.a).lng, N.get(e.a).lat], [N.get(e.b).lng, N.get(e.b).lat]] },
    properties: { w: e.w || 1, a: N.get(e.a).name, b: N.get(e.b).name, n: (e.via || []).length } }));
  map.addSource(`${cfg.id}-lines`, { type: "geojson", data: { type: "FeatureCollection", features: lines } });
  map.addSource(`${cfg.id}-places`, { type: "geojson", data: { type: "FeatureCollection", features: pts } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-lines`,
    paint: { "line-color": "#B6A488", "line-opacity": 0.45, "line-width": ["interpolate", ["linear"], ["get", "w"], 1, 0.6, 20, 3] } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: `${cfg.id}-places`,
    paint: { "circle-color": ["get", "c"], "circle-radius": 6, "circle-stroke-color": "#07100C", "circle-stroke-width": 1.2,
             "circle-opacity": ["case", ["==", ["get", "linked"], 1], 1, 0.5] } });
  map.on("click", `${cfg.id}-pt`, (e) => {
    const f = e.features && e.features[0];
    if (!f) return;
    popupClaimedBy = e.originalEvent || e;
    spheresCard(cfg, html, f.properties.id);
  });
  bindHtmlPopup(`${cfg.id}-line`, (p) => `<b>${escapeHtml(p.a)} \u2194 ${escapeHtml(p.b)}</b><div class="meta">${Number(p.n || p.w)} people sit in both</div>`);
  map.on("mouseenter", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = ""; });
  spheresControls(cfg, html, D, kinds);
  setLayerState(cfg.id, `${D.nodes.length} bodies, ${(D.people || []).length.toLocaleString()} people, ${lines.length} links`);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- Building types: one layer, a chip per type ---------- */
// Muted colours, one per type, skipping the yellows and oranges.
function buildingColours(types) {
  const hues = [0, 350, 335, 320, 300, 280, 265, 250, 235, 220, 205, 190, 175, 160, 145, 130, 115, 100, 12, 342];
  const out = {};
  types.forEach((t, i) => {
    const h = hues[i % hues.length], l = 42 + (Math.floor(i / hues.length) % 3) * 8;
    out[t] = `hsl(${h}, 18%, ${l}%)`;
  });
  return out;
}
async function addBuildingTypesLayer(cfg) {
  let summary;
  try { summary = await getJson(cfg.summaryUrl); }
  catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
  const types = Object.keys(summary.types || {});
  const colours = buildingColours(types);
  const files = summary.files || {};
  const base = cfg.summaryUrl.replace(/[^/]+$/, "");
  // Each kind is its own archive (see scripts/building_types.py in
  // culprits-tiles-more), loaded when its line is ticked. An older build with
  // one archive for every kind is still read, filtered by kind.
  const single = !Object.keys(files).length;
  const on = cfg._kinds = cfg._kinds || Object.fromEntries(types.map((t) => [t, true]));
  const layerId = (i) => `${cfg.id}-k${i}`;
  cfg._layerIds = types.map((t, i) => layerId(i));
  const popup = (p) => {
    const skip = new Set(["type", "name", "sources", "merged"]);
    const rows = Object.keys(p).filter((k) => !skip.has(k) && p[k] !== "" && p[k] != null).map((k) => {
      const v = String(p[k]);
      return `${escapeHtml(k.replace(/_/g, " "))}: ` + (/^https?:\/\//.test(v)
        ? `<a href="${escapeHtml(v)}" target="_blank" rel="noopener">${escapeHtml(v.length > 60 ? v.slice(0, 57) + "\u2026" : v)}</a>` : escapeHtml(v));
    });
    return `<b>${escapeHtml(p.name || "Unnamed in the source")}</b><div class="meta">${escapeHtml(p.type)}</div>` +
      (rows.length ? `<div class="meta">${rows.join("<br>")}</div>` : "") +
      `<div class="meta">From: ${escapeHtml(p.sources || "")}${Number(p.merged) > 1 ? ` (${p.merged} files describe this place; merged)` : ""}</div>`;
  };
  const ensure = (t, i) => {
    const id = layerId(i);
    if (map.getLayer(id)) return id;
    const src = single ? `${cfg.id}-pm` : `${cfg.id}-src${i}`;
    if (!map.getSource(src)) {
      if (!single && !files[t]) return null;
      map.addSource(src, { type: "vector", url: `pmtiles://${single ? cfg.archiveUrl : base + files[t]}` });
    }
    map.addLayer(Object.assign({ id, type: "circle", source: src, "source-layer": "buildings",
      layout: { visibility: "none" },
      paint: { "circle-color": colours[t], "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.6, 10, 4, 15, 6],
               "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5, "circle-opacity": 0.9 } },
      single ? { filter: ["==", ["get", "type"], t] } : {}));
    bindHtmlPopup(id, popup);
    return id;
  };
  const apply = (vis) => {
    types.forEach((t, i) => {
      const want = vis === "visible" && on[t];
      const id = want ? ensure(t, i) : layerId(i);
      if (id && map.getLayer(id)) map.setLayoutProperty(id, "visibility", want ? "visible" : "none");
    });
  };
  cfg.afterVisibility = apply;
  // Each kind as its own line, the way other layers list their kinds: a tick,
  // its colour and its count, close together.
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after && document.createElement && !document.querySelector(`[data-kinds="${cfg.id}"]`)) {
    const el = document.createElement("div");
    el.className = "facet bt-kinds";
    el.dataset.kinds = cfg.id;
    el.innerHTML = `<div class="bt-all"><button type="button" class="chip" data-bt="all">all</button>` +
      `<button type="button" class="chip" data-bt="none">none</button></div>` +
      types.map((t) => `<label class="bt-kind"><input type="checkbox" data-bt-kind="${escapeHtml(t)}"${on[t] ? " checked" : ""}>` +
        `<i style="background:${colours[t]}"></i><span>${escapeHtml(t)}</span>` +
        `<em>${Number(summary.types[t]).toLocaleString()}</em></label>`).join("");
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const b = e.target.closest && e.target.closest("[data-bt]");
      if (!b) return;
      const all = b.dataset.bt === "all";
      types.forEach((t) => { on[t] = all; });
      el.querySelectorAll("[data-bt-kind]").forEach((i) => { i.checked = all; });
      apply(visibility.get(cfg.id) || "none");
    });
    el.addEventListener("change", (e) => {
      const i = e.target.closest && e.target.closest("[data-bt-kind]");
      if (!i) return;
      on[i.dataset.btKind] = i.checked;
      apply(visibility.get(cfg.id) || "none");
    });
    anchor.after(el);
  }
  setLayerState(cfg.id, `${Number(summary.places).toLocaleString()} places in ${types.length} kinds (from ${Number(summary.rows).toLocaleString()} file rows)`);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- Our World in Data charts as country shading ---------- */
const OWID_RAMP = ["#E3D9CF", "#C9B3A5", "#AC8A7B", "#8A6356", "#5F3F36"];
function owidParse(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const split = (l) => { const out = []; let cur = "", q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; }
    out.push(cur); return out; };
  const head = split(lines[0]).map((h) => h.trim().toLowerCase());
  const ci = head.indexOf("code"), yi = head.indexOf("year");
  const vi = head.length - 1;
  const rows = [];
  for (const l of lines.slice(1)) {
    const c = split(l);
    const v = Number(c[vi]);
    if (!c[ci] || c[ci].startsWith("OWID") || !isFinite(v) || c[vi] === "") continue;
    rows.push({ iso3: c[ci], name: c[head.indexOf("entity")], year: Number(c[yi]), v });
  }
  return rows;
}
function owidPick(rows, year) {
  const by = new Map();
  for (const r of rows) {
    if (year !== "latest" && r.year !== Number(year)) continue;
    const had = by.get(r.iso3);
    if (!had || r.year > had.year) by.set(r.iso3, r);
  }
  return by;
}
function owidBreaks(values) {
  const v = values.slice().sort((a, b) => a - b);
  if (!v.length) return [];
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return [...new Set([q(0.2), q(0.4), q(0.6), q(0.8)])];
}
async function addOwidGrapherLayer(cfg) {
  let rows, meta = {};
  try {
    const r = await fetch(`https://ourworldindata.org/grapher/${cfg.slug}.csv?v=1&csvType=full&useColumnShortNames=true`);
    if (!r.ok) throw new Error(`${r.status}`);
    rows = owidParse(await r.text());
    try { meta = await getJson(`https://ourworldindata.org/grapher/${cfg.slug}.metadata.json?v=1&csvType=full&useColumnShortNames=true`); } catch (e) { /* the chart's title is enough */ }
  } catch (e) { setLayerState(cfg.id, `Our World in Data did not answer (${e.message})`); return; }
  const shapes = await getJson(BOUNDARIES_URL);
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);
  map.addSource(`${cfg.id}-src`, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-src`,
    paint: { "fill-color": ["coalesce", ["get", "_c"], "rgba(0,0,0,0)"], "fill-opacity": 0.75 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-src`, paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
  const title = (meta.chart && meta.chart.title) || cfg.name;
  const unit = (() => { const c = meta.columns && Object.values(meta.columns)[0]; return (c && (c.shortUnit || c.unit)) || ""; })();
  const draw = (year) => {
    const pick = owidPick(rows, year);
    const breaks = owidBreaks([...pick.values()].map((r) => r.v));
    const colourOf = (v) => { let i = 0; while (i < breaks.length && v >= breaks[i]) i++; return OWID_RAMP[Math.min(i + (4 - breaks.length), 4)]; };
    const feats = shapes.features.map((f) => {
      const r = pick.get(f.properties.iso3);
      return { type: "Feature", geometry: f.geometry, properties: { name: f.properties.name, v: r ? r.v : null, year: r ? r.year : null, _c: r ? colourOf(r.v) : null } };
    });
    map.getSource(`${cfg.id}-src`).setData({ type: "FeatureCollection", features: feats });
    setLayerState(cfg.id, `${pick.size} countries \u00b7 ${year === "latest" ? "latest year for each" : year}`);
  };
  bindHtmlPopup(`${cfg.id}-fill`, (p) => `<b>${escapeHtml(p.name)}</b>` +
    `<div class="meta">${escapeHtml(title)}</div>` +
    `<div class="meta">${p.v === null || p.v === "null" ? "No figure" : Number(p.v).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + escapeHtml(unit)}` +
    `${p.year && p.year !== "null" ? ` (${p.year})` : ""}</div>` +
    `<div class="meta"><a href="https://ourworldindata.org/grapher/${cfg.slug}" target="_blank" rel="noopener">Open the chart on Our World in Data</a></div>`);
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Year"><option value="latest">Latest for each country</option>` +
      years.map((y) => `<option value="${y}">${y}</option>`).join("") + `</select>`;
    el.querySelector("select").addEventListener("change", (e) => draw(e.target.value));
    anchor.after(el);
  }
  draw("latest");
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- Launch Library 2: launch sites and upcoming launches ---------- */
const LL2 = "https://ll.thespacedevs.com/2.3.0";
async function ll2All(path) {
  const out = [];
  let url = `${LL2}${path}${path.includes("?") ? "&" : "?"}limit=100&mode=detailed`;
  for (let i = 0; url && i < 6; i++) {
    const r = await fetch(url);
    if (r.status === 429) throw new Error("rate");
    if (!r.ok) throw new Error(`${r.status}`);
    const j = await r.json();
    out.push(...(j.results || []));
    url = j.next;
  }
  return out;
}
// A launch's own pages: The Space Devs' page for it (Space Launch Now, their
// public site for this record), then every page and webcast the record lists.
function ll2Links(r) {
  const a = (u, t) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`;
  const out = [];
  if (r.slug) out.push(a(`https://spacelaunchnow.me/launch/${encodeURIComponent(r.slug)}`, "This launch's page \u2197"));
  for (const u of r.info_urls || []) if (u && u.url) out.push(a(u.url, (u.title || u.source || "More") + " \u2197"));
  for (const u of r.vid_urls || []) if (u && u.url) out.push(a(u.url, (u.title ? "Webcast: " + u.title : "Webcast") + " \u2197"));
  if (r.flightclub_url) out.push(a(r.flightclub_url, "Flight Club trajectory \u2197"));
  if (r.url) out.push(a(r.url, "Launch Library 2 record \u2197"));
  return out.length ? `<p style="display:flex;flex-direction:column;gap:3px">${out.join("")}</p>` : "";
}
function ll2Img(x) { return x && (typeof x === "string" ? x : x.image_url || x.thumbnail_url) || ""; }
function ll2Pad(p, extra) {
  const lat = Number(p.latitude), lng = Number(p.longitude);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { type: "Point", coordinates: [lng, lat] };
}
// Launch Library answers slowly: six pages in turn, each a detailed record, and
// a rate limit under them. The row used to wait for all of it before drawing
// anything, which for the pads was most of a minute. So the copy kept here
// daily is read first - one file, one request - and the live read runs beside
// it with LL2_WAIT to answer in. If it lands in time the row draws the live
// rows; if it does not, the row draws the copy and says so. Nothing is mixed:
// what is drawn is one or the other, and the row's line says which.
const LL2_WAIT = 6000;
async function readLaunchLibrary(cfg) {
  let rows, note = "";
  const copy = getJson(cfg.copy, 20000).then((j) => j.results || []);
  copy.catch(() => {});   // handled below; this only stops an unhandled rejection
  const live = ll2All(cfg.what === "pads" ? "/pads/" : "/launches/upcoming/");
  live.catch(() => {});
  const late = new Promise((done) => setTimeout(() => done("late"), LL2_WAIT));
  try {
    const first = await Promise.race([live, late]);
    if (first === "late") {
      rows = await copy;
      note = `Launch Library did not answer within ${Math.round(LL2_WAIT / 1000)} seconds; showing today's copy`;
    } else {
      rows = first;
    }
  } catch (e) {
    rows = await copy;
    note = e.message === "rate" ? "Launch Library's hourly limit was reached; showing today's copy" : `Launch Library did not answer; showing today's copy`;
  }
  const items = [];
  for (const r of rows) {
    if (cfg.what === "pads") {
      const g = ll2Pad(r);
      if (!g) continue;
      const loc = r.location || {};
      const country = (loc.country && loc.country.name) || loc.country_code || r.country_code || "";
      items.push({ geometry: g, key: `p${r.id}`, name: r.name || "", group: country,
        h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(r.name || "")}</h4>` +
          `<div>${escapeHtml(loc.name || "")}${country ? " \u00b7 " + escapeHtml(country) : ""}</div>` +
          (r.total_launch_count != null ? `<div>${Number(r.total_launch_count).toLocaleString()} launches` +
            (r.orbital_launch_attempt_count != null ? `, ${Number(r.orbital_launch_attempt_count).toLocaleString()} orbital attempts` : "") + `</div>` : "") +
          (r.description ? `<p>${escapeHtml(r.description)}</p>` : "") +
          (r.wiki_url ? `<p><a href="${escapeHtml(r.wiki_url)}" target="_blank" rel="noopener">About this site</a></p>` : "") +
          (r.map_url ? `<p><a href="${escapeHtml(r.map_url)}" target="_blank" rel="noopener">On a map</a></p>` : "") +
          `<div style="font-size:11px">Launch Library 2, The Space Devs</div></div>` });
    } else {
      const pad = r.pad || {};
      const g = ll2Pad(pad);
      if (!g) continue;
      const lsp = (r.launch_service_provider && r.launch_service_provider.name) || "";
      const rocket = (r.rocket && r.rocket.configuration && (r.rocket.configuration.full_name || r.rocket.configuration.name)) || "";
      const m = r.mission || {};
      const when = r.net ? new Date(r.net) : null;
      items.push({ geometry: g, key: `l${r.id}`, name: r.name || "", group: (r.status && r.status.name) || "",
        h: boxOpen + (ll2Img(r.image) ? `<img src="${escapeHtml(ll2Img(r.image))}" style="max-width:100%;margin-bottom:6px">` : "") +
          `<h4 style="margin:0 0 6px">${escapeHtml(r.name || "")}</h4>` +
          `<div>${when ? escapeHtml(when.toUTCString().replace(" GMT", " UTC")) : ""}${r.status ? " \u00b7 " + escapeHtml(r.status.name) : ""}</div>` +
          `<div>${escapeHtml([rocket, lsp].filter(Boolean).join(" \u00b7 "))}</div>` +
          `<div>${escapeHtml(pad.name || "")}${pad.location ? ", " + escapeHtml(pad.location.name || "") : ""}</div>` +
          (m.name ? `<p><b>${escapeHtml(m.name)}</b>${m.orbit && m.orbit.name ? " \u2192 " + escapeHtml(m.orbit.name) : ""}<br>${escapeHtml(m.description || "")}</p>` : "") +
          ll2Links(r) +
          `<div style="font-size:11px">Launch Library 2, The Space Devs</div></div>` });
    }
  }
  return { title: cfg.name, items, note };
}

/* ---------- Resource Trade Earth: trade flows between countries ---------- */
async function rteGet(cfg, live, copy) {
  try { return await getJson(`${cfg.api}${live}`, 40000); }
  catch (e) { cfg._fromCopy = true; return getJson(`${cfg.copy}/${copy}`, 40000); }
}
// A gentle curve from exporter to importer, so flows between the same pair in
// each direction do not lie on top of each other.
function rteArc(a, b, steps = 24) {
  const [x1, y1] = a, [x2, y2] = b;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
  const cx = mx - dy * 0.18, cy = my + dx * 0.18;
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2]);
  }
  return out;
}
async function addRteLayer(cfg) {
  let models;
  try { models = await rteGet(cfg, "/models", "models.json"); }
  catch (e) { setLayerState(cfg.id, `resourcetrade.earth did not answer (${e.message})`); return; }
  const C = new Map((models.countries || []).filter((c) => c.lat != null && c.lng != null).map((c) => [c.id, c]));
  const years = (models.years || []).map((y) => Number(y.id)).sort((a, b) => b - a);
  map.addSource(`${cfg.id}-src`, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-src`, layout: { "line-cap": "round" },
    paint: { "line-color": cfg.colour, "line-opacity": 0.75,
             "line-width": ["interpolate", ["linear"], ["get", "share"], 0, 0.8, 1, 7] } });
  const draw = async (year) => {
    setLayerState(cfg.id, `reading ${year}\u2026`);
    let j;
    try { j = await rteGet(cfg, `/trades?year=${year}&autozoom=1`, `trades_${year}.json`); }
    catch (e) { setLayerState(cfg.id, `no flows could be read for ${year}`); return; }
    const rows = (j.main || []).filter((r) => C.has(r.exporter) && C.has(r.importer));
    const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
    const feats = rows.map((r) => {
      const a = C.get(r.exporter), b = C.get(r.importer);
      return { type: "Feature", geometry: { type: "LineString", coordinates: rteArc([a.lng, a.lat], [b.lng, b.lat]) },
        properties: { from: a.name, to: b.name, value: r.value, weight: r.weight, co2: r.env_co2, year: r.year,
                      share: Math.sqrt((Number(r.value) || 0) / max), ex: r.exporter, im: r.importer } };
    });
    map.getSource(`${cfg.id}-src`).setData({ type: "FeatureCollection", features: feats });
    const left = (j.main || []).length - rows.length;
    setLayerState(cfg.id, `${feats.length} largest flows of ${Number(j.total || 0).toLocaleString()} in ${year}` +
      (left ? ` (${left} to or from unplaced areas)` : "") + (cfg._fromCopy ? " \u00b7 from today's copy" : ""));
  };
  const n = (v) => (v == null ? "\u2014" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }));
  bindHtmlPopup(`${cfg.id}-line`, (p) => `<b>${escapeHtml(p.from)} \u2192 ${escapeHtml(p.to)}</b>` +
    `<div class="meta">${escapeHtml(String(p.year))}</div>` +
    `<div class="meta">Trade value: ${n(p.value)}<br>Weight: ${n(p.weight)}<br>CO\u2082: ${n(p.co2)}</div>` +
    `<div class="meta">Figures as resourcetrade.earth publishes them (its units are on its site).</div>` +
    `<div class="meta"><a href="https://resourcetrade.earth/?year=${p.year}&exporter=${p.ex}&importer=${p.im}" target="_blank" rel="noopener">Open on resourcetrade.earth</a></div>`);
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Year">${years.map((y) => `<option value="${y}">${y}</option>`).join("")}</select>`;
    el.querySelector("select").addEventListener("change", (e) => draw(Number(e.target.value)));
    anchor.after(el);
  }
  await draw(years[0]);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- a whole map of the site's own, in a panel that follows this one ---------- */
// The page is on the same site, so this map can move it to the same place. Its
// Leaflet zoom is one more than this map's (512-pixel tiles here, 256 there).
const companions = new Map();
function companionSync(cfg) {
  const c = companions.get(cfg.id);
  if (!c || c.el.hidden || !c.follow || !c.follow.checked) return;
  try {
    const w = c.frame.contentWindow, ctr = map.getCenter();
    w.eval(`map.setView([${ctr.lat}, ${ctr.lng}], ${Math.round(map.getZoom() + 1)}, { animate: false })`);
  } catch (e) { /* the page is still loading */ }
}
function addCompanion(cfg) {
  let c = companions.get(cfg.id);
  if (!c) {
    const el = document.createElement("div");
    el.className = "companion";
    el.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:46vh;z-index:40;display:flex;flex-direction:column;" +
      "background:var(--peat,#17150F);border-top:1px solid var(--rule,#322E27)";
    // The bar along its top is a handle: drag it up or down to size the panel.
    el.innerHTML = `<div class="c-grab" title="Drag up or down to resize" style="height:9px;cursor:ns-resize;touch-action:none;display:flex;justify-content:center;align-items:center">` +
      `<span style="width:44px;height:3px;border-radius:2px;background:var(--rule,#322E27)"></span></div>` +
      `<div class="c-bar" style="display:flex;align-items:center;gap:11px;padding:2px 12px 6px;font-size:12.5px;color:var(--dim);cursor:ns-resize;touch-action:none">` +
      `<span style="color:var(--bone)">${escapeHtml(cfg.name)}</span>` +
      (cfg.follow ? `<label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" checked> follow this map</label>`
        : `<span style="font-size:11.5px">If this stays blank, the site does not allow being shown inside another page: use open \u2197</span>`) +
      `<a href="${escapeHtml(cfg.page)}" target="_blank" rel="noopener" style="color:var(--slate,#8A9DA6)">open \u2197</a>` +
      `<span style="margin-left:auto"></span><button type="button" style="font:inherit;background:none;color:var(--dim);border:1px solid var(--rule);` +
      `border-radius:2px;padding:1px 7px;cursor:pointer">close</button></div>` +
      `<iframe title="${escapeHtml(cfg.name)}" style="flex:1;width:100%;border:0"></iframe>`;
    document.body.appendChild(el);
    const frame = el.querySelector("iframe");
    c = { el, frame, follow: el.querySelector("input[type=checkbox]") };
    companions.set(cfg.id, c);
    el.querySelector("button").addEventListener("click", () => {
      const cb = document.querySelector(`[data-layer="${cfg.id}"]`);
      if (cb) { cb.checked = false; cb.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    frame.addEventListener("load", () => setTimeout(() => companionSync(cfg), 800));
    // Dragging the grab strip or the bar (not its buttons or links) resizes
    // the panel; the frame ignores the pointer meanwhile so it cannot swallow it.
    let drag = null;
    const grabbers = [el.querySelector(".c-grab"), el.querySelector(".c-bar")];
    grabbers.forEach((g) => g.addEventListener("pointerdown", (e) => {
      if (e.target.closest && e.target.closest("button, a, input, label")) return;
      drag = { y: e.clientY, h: el.getBoundingClientRect().height };
      frame.style.pointerEvents = "none";
      g.setPointerCapture && g.setPointerCapture(e.pointerId);
      e.preventDefault();
    }));
    const move = (e) => {
      if (!drag) return;
      const h = Math.max(90, Math.min(window.innerHeight - 40, drag.h + (drag.y - e.clientY)));
      el.style.height = `${Math.round(h)}px`;
    };
    const end = () => { if (drag) { drag = null; frame.style.pointerEvents = ""; } };
    grabbers.forEach((g) => { g.addEventListener("pointermove", move); g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end); });
    if (c.follow) c.follow.addEventListener("change", () => companionSync(cfg));
    map.on("moveend", () => companionSync(cfg));
    frame.src = cfg.page;
  }
  setLayerState(cfg.id, "open along the bottom of the screen");
  applyVisibility(cfg.id);
}

/* ---------- Global Safety Net: its viewer's layers, ticked one by one ---------- */
function gsnShown(list) {
  return (list || []).filter((l) => l.gee_tile_url && !(l.is_hidden === true || l.is_hidden === "True"));
}
async function addGsnLayer(cfg) {
  let list;
  try { list = gsnShown(await getJson(cfg.api, 40000)); }
  catch (e) { setLayerState(cfg.id, `Global Safety Net did not answer (${e.message})`); return; }
  cfg._layerIds = [];
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.style.cssText = "display:block;max-height:220px;overflow:auto";
    el.innerHTML = list.map((l) => `<label title="${escapeHtml(l.description || "")}" style="display:flex;gap:6px;align-items:center;font-size:12px;margin:2px 0;cursor:pointer">` +
      `<input type="checkbox" data-gsn="${escapeHtml(String(l.id))}"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${escapeHtml(l.colour || "#777")}"></i>` +
      `${escapeHtml(l.name)}</label>`).join("");
    el.addEventListener("change", (e) => {
      const cb = e.target;
      if (!cb.dataset || !cb.dataset.gsn) return;
      e.stopPropagation();
      const l = list.find((x) => String(x.id) === cb.dataset.gsn);
      const id = `${cfg.id}-r-${l.id}`;
      if (cb.checked && !map.getLayer(id)) {
        // The service gives either a map address to add /tiles/{z}/{x}/{y} to,
        // or the tile template itself; adding it twice made every tile fail.
        const u = String(l.gee_tile_url || l.tile_url || l.url || "");
        const tpl = /\{z\}/.test(u) ? u : `${u.replace(/\/+$/, "")}/tiles/{z}/{x}/{y}`;
        map.addSource(id, { type: "raster", tileSize: 256, tiles: [tpl],
          attribution: "Global Safety Net, One Earth / Nature Data Lab" });
        map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.85 } });
        cfg._layerIds.push(id);
      }
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", cb.checked && (visibility.get(cfg.id) || "visible") === "visible" ? "visible" : "none");
      const on = el.querySelectorAll("input:checked").length;
      setLayerState(cfg.id, `${on} of ${list.length} layers shown` + (cb.checked && l.description ? ` \u00b7 ${l.name}: ${l.description.slice(0, 140)}` : ""));
    });
    anchor.after(el);
    // Switching the row on or off keeps each layer's own tick.
    cfg.afterVisibility = (vis) => el.querySelectorAll("[data-gsn]").forEach((cb) => {
      const id = `${cfg.id}-r-${cb.dataset.gsn}`;
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis === "visible" && cb.checked ? "visible" : "none");
    });
  }
  setLayerState(cfg.id, `${list.length} layers \u2014 tick the ones to show`);
}

/* ---------- Climate TRACE air pollution: sources, plumes, every pollutant ---------- */
const CT_GASES = [["pm2_5", "PM2.5"], ["bc", "Black carbon"], ["oc", "Organic carbon"], ["so2", "SO\u2082"], ["vocs", "VOCs"],
  ["co", "CO"], ["nh3", "Ammonia"], ["nox", "NOx"], ["co2e_100yr", "CO\u2082e (100-year)"]];
function ctAssetHtml(a, gas) {
  const t = a.totals || {};
  const n = (v, d = 0) => (v == null ? "\u2014" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));
  const ranks = (a.subsectorRanks || []).slice(-1)[0];
  return `<div class="meta">${escapeHtml([a.type, (a.subsector || "").replace(/-/g, " "), (a.location && a.location.country) || ""].filter(Boolean).join(" \u00b7 "))}</div>` +
    `<div class="meta"><b>${escapeHtml((CT_GASES.find((g) => g[0] === gas) || [gas, gas])[1])}:</b> ${n(t.value, 1)} t a year</div>` +
    (t.capacity ? `<div class="meta">Capacity: ${n(t.capacity)} ${escapeHtml(t.capacityUnits || "")}` +
      (t.capacityFactor != null ? ` (used ${n(t.capacityFactor * 100)}%)` : "") + `</div>` : "") +
    (t.activity ? `<div class="meta">Activity: ${n(t.activity)} ${escapeHtml(t.activityUnits || "")}</div>` : "") +
    (t.emissionsFactor ? `<div class="meta">Rate: ${n(t.emissionsFactor, 5)} ${escapeHtml(t.emissionsFactorUnits || "")}</div>` : "") +
    (ranks ? `<div class="meta">Rank in its sector, ${ranks.year}: ${n(ranks.rank)}</div>` : "");
}
// A plume file as one still shape: every feature kept, and each given a
// _strength from 0 to 1 read from whatever concentration figure it carries
// (the first numeric field named like one), so the drawing can grade it.
// A file with no such figure draws at one strength.
function ctPlumeShape(gj) {
  const feats = (gj && gj.features) || (gj && gj.type === "Feature" ? [gj] : []);
  const pick = (p) => { for (const k of Object.keys(p || {})) if (/conc|value|weight|level|density|pm|mass|rate/i.test(k) && Number.isFinite(Number(p[k]))) return Number(p[k]); return null; };
  const vals = feats.map((f) => pick(f.properties)).filter((v) => v !== null);
  const max = vals.length ? Math.max(...vals) : 0;
  return { type: "FeatureCollection", features: feats.map((f) => {
    const v = pick(f.properties);
    return { type: "Feature", geometry: f.geometry, properties: Object.assign({}, f.properties, { _strength: v === null || !max ? 0.6 : Math.max(0.05, v / max) }) };
  }) };
}
async function addCtAirLayer(cfg) {
  let gj;
  try { gj = await getJson(cfg.list, 60000); }
  catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
  const src = `${cfg.id}-src`;
  map.addSource(src, { type: "geojson", data: gj });
  map.addSource(`${cfg.id}-plume`, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  // The plume as a still hotspot, not a set of outlines: Climate TRACE's own
  // page animates it moving downwind; here the same shape is drawn once, its
  // fill graded by whatever concentration figure the file carries (the
  // strongest part darkest), fading out to its edge, with no hard line.
  map.addLayer({ id: `${cfg.id}-plume-fill`, type: "fill", source: `${cfg.id}-plume`, filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": cfg.colour, "fill-opacity": ["interpolate", ["linear"], ["get", "_strength"], 0, 0.12, 1, 0.7], "fill-antialias": false } });
  map.addLayer({ id: `${cfg.id}-plume-heat`, type: "heatmap", source: `${cfg.id}-plume`, filter: ["==", ["geometry-type"], "Point"],
    paint: { "heatmap-weight": ["get", "_strength"], "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 6, 12, 40], "heatmap-opacity": 0.65,
             "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "rgba(122,91,78,0.35)", 0.6, "rgba(122,91,78,0.7)", 1, "rgba(80,50,45,0.9)"] } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-plume`, filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round" },
    paint: { "line-color": cfg.colour, "line-width": 3, "line-opacity": 0.5, "line-blur": 2 } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src,
    paint: { "circle-color": cfg.colour, "circle-opacity": 0.9,
             "circle-radius": ["interpolate", ["linear"], ["sqrt", ["max", 0, ["to-number", ["get", "pm25_kg_hr"], 0]]], 0, 2.5, 10, 9] } });
  let gas = "pm2_5";
  map.on("click", `${cfg.id}-pt`, async (e) => {
    const f = e.features && e.features[0];
    if (!f) return;
    popupClaimedBy = e.originalEvent || e;
    const p = f.properties;
    const pop = new maplibregl.Popup({ maxWidth: "320px" }).setLngLat(f.geometry.coordinates).setHTML(
      `<b>${escapeHtml(p.name)}</b>` +
      `<div class="meta">PM2.5: ${Number(p.pm25_kg_hr || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg an hour (monthly average)</div>` +
      `<div class="meta"><select aria-label="Pollutant">${CT_GASES.map(([k, l]) => `<option value="${k}"${k === gas ? " selected" : ""}>${l}</option>`).join("")}</select></div>` +
      `<div class="ct-air-figs meta">Reading Climate TRACE\u2026</div>` +
      (p.area ? `<div class="meta"><a href="https://climatetrace.org/air-pollution/${encodeURIComponent(p.area)}" target="_blank" rel="noopener">Its city air-pollution page</a></div>` : "") +
      `<div class="meta">Climate TRACE (CC BY 4.0)</div>`).addTo(map);
    const el = pop.getElement();
    const figs = async () => {
      const box = el.querySelector(".ct-air-figs");
      try {
        // Through the Worker: api.c10e.org sends no CORS header, so read straight the box stayed at "Reading".
        const a = await getJson(`${WORKER}/ct-asset?id=${encodeURIComponent(p.id)}&gas=${encodeURIComponent(gas)}&years=2024`, 30000);
        box.innerHTML = ctAssetHtml(a, gas);
      } catch (err) { box.textContent = `Climate TRACE did not answer (${err.message})`; }
    };
    el.querySelector("select").addEventListener("change", (ev) => { gas = ev.target.value; figs(); });
    figs();
    if (p.plume) {
      try { map.getSource(`${cfg.id}-plume`).setData(ctPlumeShape(await getJson(`${WORKER}/ct-plume?file=${encodeURIComponent(p.plume)}`, 30000))); }
      catch (err) { const box = el.querySelector(".ct-air-figs"); if (box) box.insertAdjacentHTML("afterend", `<div class="meta">its plume could not be read (${escapeHtml(err.message)})</div>`); }
    }
  });
  map.on("mouseenter", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = ""; });
  setLayerState(cfg.id, `${(gj.features || []).length.toLocaleString()} sources \u00b7 click one for its plume and pollutants`);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- Global Trade Alert: state acts by country ---------- */
const GTA_EVAL = { Red: "#8F4E40", Amber: "#8A7560", Green: "#62755F" };
// The country a shape stands for: whichever of its fields names a country in the data.
function gtaNameOf(props, known) {
  for (const k of ["name", "NAME", "name_long", "admin", "ADMIN", "name_en", "country", "Country"]) if (props[k] && known.has(props[k])) return props[k];
  return Object.values(props).find((v) => typeof v === "string" && known.has(v)) || null;
}
async function addGtaLayer(cfg) {
  let data, shapes;
  try { [data, shapes] = await Promise.all([getJson(cfg.data, 60000), getJson(cfg.shapes, 60000).catch(() => getJson(BOUNDARIES_URL))]); }
  catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
  const C = data.countries || {};
  const known = new Set(Object.keys(C));
  const feats = (shapes.features || []).map((f) => ({ type: "Feature", geometry: f.geometry, properties: { gta: gtaNameOf(f.properties || {}, known), name: (f.properties || {}).name || "" } }));
  map.addSource(`${cfg.id}-src`, { type: "geojson", data: { type: "FeatureCollection", features: feats } });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-src`, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0.75 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-src`, paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
  const ramp = OWID_RAMP;
  const shade = (measure) => {
    const vals = Object.values(C).map((c) => c[measure] || 0).filter((v) => v > 0);
    const breaks = owidBreaks(vals);
    const expr = ["match", ["coalesce", ["get", "gta"], ""]];
    for (const [nm, c] of Object.entries(C)) {
      const v = c[measure] || 0;
      if (!v) continue;
      let i = 0; while (i < breaks.length && v >= breaks[i]) i++;
      expr.push(nm, ramp[Math.min(i + (4 - breaks.length), 4)]);
    }
    expr.push("rgba(0,0,0,0)");
    map.setPaintProperty(`${cfg.id}-fill`, "fill-color", expr.length > 3 ? expr : "rgba(0,0,0,0)");
  };
  bindHtmlPopup(`${cfg.id}-fill`, (p) => {
    const c = C[p.gta];
    if (!c) return `<b>${escapeHtml(p.name)}</b><div class="meta">No state acts named for this country.</div>`;
    const dot = (e) => e ? `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${GTA_EVAL[e] || "#777"};margin-right:4px"></i>` : "";
    return `<b>${escapeHtml(p.gta)}</b>` +
      `<div class="meta">${c.total.toLocaleString()} state acts: ${dot("Red")}${c.red.toLocaleString()} Red, ${dot("Amber")}${c.amber.toLocaleString()} Amber, ` +
      `${dot("Green")}${c.green.toLocaleString()} Green; ${c.in_force.toLocaleString()} with a measure in force</div>` +
      `<div class="meta">Commonest: ${Object.entries(c.types || {}).slice(0, 6).map(([t, n]) => `${escapeHtml(t)} (${n})`).join(", ")}</div>` +
      `<div class="meta" style="max-height:220px;overflow:auto">${(c.latest || []).map((a) => `<div style="margin:5px 0">${dot(a.eval)}<b>${escapeHtml(a.date || "")}</b> ` +
        `${escapeHtml(a.title)}<br><span style="font-size:11px">${escapeHtml(a.text || "")}</span></div>`).join("")}</div>` +
      `<div class="meta">Global Trade Alert</div>`;
  });
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Shade by"><option value="total">All state acts</option><option value="red">Rated Red</option>` +
      `<option value="amber">Rated Amber</option><option value="green">Rated Green</option><option value="in_force">With a measure in force</option></select>`;
    el.querySelector("select").addEventListener("change", (e) => shade(e.target.value));
    anchor.after(el);
  }
  shade("total");
  const placed = new Set(feats.map((f) => f.properties.gta).filter(Boolean));
  setLayerState(cfg.id, `${Number(data.acts || 0).toLocaleString()} state acts by ${known.size} countries` +
    (known.size > placed.size ? ` (${known.size - placed.size} names not on the shapes)` : ""));
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- an ArcGIS map service drawn as pictures, its layers as chips (EPA Envirofacts) ---------- */
async function addArcgisDynLayer(cfg) {
  let info;
  try { info = await getJson(`${cfg.service}?f=json`, 30000); }
  catch (e) { setLayerState(cfg.id, `the service did not answer (${e.message})`); return; }
  const layers = (info.layers || []).filter((l) => !l.subLayerIds);
  const on = new Set(layers.map((l) => l.id));
  const tilesFor = () => [`${cfg.service}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true` +
    `&layers=show:${[...on].join(",") || "-1"}&dpi=96&f=image`];
  const src = `${cfg.id}-img`;
  map.addSource(src, { type: "raster", tileSize: 256, minzoom: Math.floor(cfg.minzoom || 0), tiles: tilesFor(), attribution: cfg.attribution || "" });
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: src, minzoom: cfg.minzoom || 0 });
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = layers.map((l) => `<button type="button" class="chip on" data-dl="${l.id}">${escapeHtml(l.name)}</button>`).join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-dl]");
      if (!b) return;
      e.stopPropagation();
      const id = Number(b.dataset.dl);
      if (on.has(id)) on.delete(id); else on.add(id);
      b.classList.toggle("on", on.has(id));
      const s = map.getSource(src);
      if (s && s.setTiles) s.setTiles(tilesFor());
      if (map.getLayer(`${cfg.id}-pts`)) map.setFilter(`${cfg.id}-pts`, ptsFilter());
    });
    anchor.after(el);
  }
  // Wider out than EPA draws: the weekly copy of every point. A merged point
  // stands for points of several kinds, so the kind buttons leave it shown.
  function ptsFilter() {
    return ["any", [">", ["coalesce", ["get", "point_count"], 1], 1], ["in", ["get", "_lid"], ["literal", [...on]]]];
  }
  if (cfg.points) {
    try {
      map.addSource(`${cfg.id}-pts-src`, { type: "vector", url: `pmtiles://${cfg.points}`, attribution: cfg.attribution || "" });
      const n = ["coalesce", ["get", "point_count"], 1];
      map.addLayer({ id: `${cfg.id}-pts`, type: "circle", source: `${cfg.id}-pts-src`, "source-layer": "efpoints",
        maxzoom: cfg.minzoom || 22, filter: ptsFilter(),
        paint: { "circle-color": cfg.colour, "circle-opacity": 0.8,
                 "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["+", 1.4, ["*", 0.8, ["log10", n]]], 6, ["+", 2.6, ["*", 1, ["log10", n]]]] } },
        `${cfg.id}-raster`);
      map.on("click", `${cfg.id}-pts`, async (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        const p = f.properties;
        const pop = new maplibregl.Popup({ maxWidth: "340px" }).setLngLat(e.lngLat);
        if (Number(p.point_count) > 1) {
          pop.setHTML(`<b>${Number(p.point_count).toLocaleString()} EPA facilities here</b><div class="meta">Merged at this zoom. Zoom in to see each one.</div>`).addTo(map);
          return;
        }
        pop.setHTML(`<b>${escapeHtml(p.name || "")}</b><div class="meta">${escapeHtml(p._layer || "")} \u00b7 asking EPA\u2026</div>`).addTo(map);
        try {
          const j = await getJson(`${cfg.service}/${p._lid}/query?objectIds=${encodeURIComponent(p._oid)}&outFields=*&returnGeometry=false&f=json`, 20000);
          const at = ((j.features || [])[0] || {}).attributes || {};
          pop.setHTML(`<b>${escapeHtml(p.name || "")}</b><div class="meta">${escapeHtml(p._layer || "")}</div>` +
            `<table class="meta">${fieldRows(Object.fromEntries(Object.entries(at).filter(([k, v]) => v !== "Null" && v != null && !/^(OBJECTID|Shape)$/i.test(k))))}</table>` +
            `<div class="meta">US EPA Envirofacts</div>`);
        } catch (err) {
          pop.setHTML(`<b>${escapeHtml(p.name || "")}</b><div class="meta">${escapeHtml(p._layer || "")} \u00b7 EPA did not answer (${escapeHtml(err.message)})</div>`);
        }
      });
    } catch (e) { console.warn("[culprits] EPA points:", e.message); }
  }
  map.on("click", async (e) => {
    if ((visibility.get(cfg.id) || "visible") !== "visible" || !map.getLayer(`${cfg.id}-raster`) || map.getZoom() < (cfg.minzoom || 0) || !on.size) return;
    const b = map.getBounds(), c = map.getCanvas();
    const q = `${cfg.service}/identify?geometry=${e.lngLat.lng},${e.lngLat.lat}&geometryType=esriGeometryPoint&sr=4326` +
      `&layers=visible:${[...on].join(",")}&tolerance=6&mapExtent=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}` +
      `&imageDisplay=${c.clientWidth},${c.clientHeight},96&returnGeometry=false&f=json`;
    try {
      const j = await getJson(q, 20000);
      const hits = (j.results || []).slice(0, 8);
      if (!hits.length) return;
      new maplibregl.Popup({ maxWidth: "340px" }).setLngLat(e.lngLat).setHTML(hits.map((h) =>
        `<b>${escapeHtml(h.value || (h.attributes && h.attributes.PRIMARY_NAME) || "")}</b><div class="meta">${escapeHtml(h.layerName || "")}</div>` +
        `<table class="meta">${fieldRows(Object.fromEntries(Object.entries(h.attributes || {}).filter(([k, v]) => v !== "Null" && !/^(OBJECTID|Shape)$/i.test(k))))}</table>`).join("<hr>") +
        `<div class="meta">US EPA Envirofacts</div>`).addTo(map);
    } catch (err) { /* nothing there */ }
  });
  setLayerState(cfg.id, `${layers.length} kinds of facility \u00b7 ${cfg.points ? "a weekly copy of every point wider out; EPA's own picture from about state level in" : "drawn from about state level in"}`);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- Giga: school mapping by country ---------- */
async function addGigaLayer(cfg) {
  let data;
  try { data = await getJson(cfg.data, 60000); }
  catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
  const C = new Map((data.countries || []).map((c) => [c.iso3_format, c]));
  const shapes = await getJson(BOUNDARIES_URL);
  map.addSource(`${cfg.id}-src`, { type: "geojson", data: { type: "FeatureCollection", features: shapes.features.filter((f) => C.has(f.properties.iso3)) } });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-src`, paint: { "fill-color": "rgba(0,0,0,0)", "fill-opacity": 0.75 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-src`, paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
  const shade = (m) => {
    const expr = ["match", ["get", "iso3"]];
    const val = (c) => m === "schools" ? (c.entity_counts || {}).school || 0 : m === "share" ? c.schools_with_data_percentage || 0 : null;
    if (m === "schools" || m === "share") {
      const breaks = owidBreaks([...C.values()].map(val).filter((v) => v > 0));
      for (const [iso, c] of C) { const v = val(c); if (!v) continue; let i = 0; while (i < breaks.length && v >= breaks[i]) i++; expr.push(iso, OWID_RAMP[Math.min(i + (4 - breaks.length), 4)]); }
    } else {
      const cats = [...new Set([...C.values()].map((c) => c[m]).filter(Boolean))].sort();
      const pal = ["#3F5663", "#8A9DA6", "#B3C0C6", "#CDAEA4", "#8C5548", "#62755F"];
      for (const [iso, c] of C) if (c[m]) expr.push(iso, pal[cats.indexOf(c[m]) % pal.length]);
    }
    expr.push("rgba(0,0,0,0)");
    map.setPaintProperty(`${cfg.id}-fill`, "fill-color", expr.length > 3 ? expr : "rgba(0,0,0,0)");
  };
  bindHtmlPopup(`${cfg.id}-fill`, (p) => {
    const c = C.get(p.iso3);
    if (!c) return "";
    const pretty = (s) => String(s || "\u2014").replace(/_/g, " ");
    return (c.flag ? `<img src="${escapeHtml(c.flag)}" style="height:18px;margin-right:6px;vertical-align:middle">` : "") + `<b>${escapeHtml(c.name)}</b>` +
      `<div class="meta">Schools mapped: ${Number((c.entity_counts || {}).school || 0).toLocaleString()}` +
      ((c.entity_counts || {}).health ? `; health facilities: ${Number(c.entity_counts.health).toLocaleString()}` : "") + `</div>` +
      `<div class="meta">With connectivity data: ${Number(c.schools_with_data_percentage || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%</div>` +
      `<div class="meta">Connectivity data: ${escapeHtml(pretty(c.connectivity_availability))}; coverage data: ${escapeHtml(pretty(c.coverage_availability))}</div>` +
      (c.data_source ? `<div class="meta">Data source: ${escapeHtml(c.data_source)}</div>` : "") +
      (c.date_schools_mapped ? `<div class="meta">Mapped: ${escapeHtml(c.date_schools_mapped)}</div>` : "") +
      `<div class="meta">Giga (UNICEF and ITU)</div>`;
  });
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Shade by"><option value="schools">Schools mapped</option><option value="share">Share with connectivity data</option>` +
      `<option value="connectivity_availability">Connectivity data</option><option value="coverage_availability">Coverage data</option></select>`;
    el.querySelector("select").addEventListener("change", (e) => shade(e.target.value));
    anchor.after(el);
  }
  shade("schools");
  const w = data.world && data.world.school;
  setLayerState(cfg.id, `${C.size} countries` + (w ? ` \u00b7 ${Number(w.entities_total).toLocaleString()} schools mapped worldwide` : ""));
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the daily oil-slick archive, by month ---------- */
async function addSlickArchive(cfg) {
  let index;
  try { index = await getJson(`${cfg.base}/index.json`, 30000); }
  catch (e) { setLayerState(cfg.id, `not built yet (${e.message})`); return; }
  const months = Object.keys(index).sort().reverse();
  // A month as an archive where the daily job has tiled it, and as the plain
  // file where it has not. A busy month is 58 MB of GeoJSON, which is a minute
  // of waiting and often a failure - "could not be read" was that. From an
  // archive the map fetches only the squares on screen.
  let tiled = {};
  try { tiled = await getJson(`${cfg.base}/tiles.json`, 30000); } catch (e) { /* none tiled yet */ }
  const src = `${cfg.id}-src`;
  map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: src, paint: { "fill-color": "#1D1B17", "fill-opacity": 0.55 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: src, paint: { "line-color": "#B8A79E", "line-width": 1 } });
  // Wider out a slick is smaller than a pixel, so each is also a point at its
  // middle until zoom 7, where the shapes are big enough to see.
  map.addSource(`${src}-pt`, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: `${src}-pt`, maxzoom: 7,
    paint: { "circle-color": "#B8A79E", "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.2, 6, 3.6],
             "circle-stroke-color": "#1D1B17", "circle-stroke-width": 0.5, "circle-opacity": 0.9 } });
  bindHtmlPopup(`${cfg.id}-fill`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily</div>`);
  bindHtmlPopup(`${cfg.id}-pt`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily \u00b7 zoom in for its shape</div>`);
  const middles = (gj) => ({ type: "FeatureCollection", features: (gj.features || []).map((f) => {
    const pts = [];
    const walk = (c) => { if (typeof c[0] === "number") pts.push(c); else c.forEach(walk); };
    if (f.geometry && f.geometry.coordinates) walk(f.geometry.coordinates);
    if (!pts.length) return null;
    const x = pts.reduce((a, p) => a + p[0], 0) / pts.length, y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return { type: "Feature", properties: f.properties || {}, geometry: { type: "Point", coordinates: [x, y] } };
  }).filter(Boolean) });
  // The tiled form draws through its own pair of layers, so the plain-file
  // pair can stay exactly as it was; only one pair is ever shown.
  const tsrc = `${cfg.id}-pm`;
  let tiledNow = null;
  const showTiled = (m) => {
    const url = `${cfg.base}/${tiled[m]}`;
    if (tiledNow !== url) {
      ["-tfill", "-tline", "-tpt"].forEach((suffix) => { if (map.getLayer(cfg.id + suffix)) map.removeLayer(cfg.id + suffix); });
      if (map.getSource(tsrc)) map.removeSource(tsrc);
      map.addSource(tsrc, { type: "vector", url: `pmtiles://${url}` });
      map.addLayer({ id: `${cfg.id}-tfill`, type: "fill", source: tsrc, "source-layer": "slicks", minzoom: 7,
        paint: { "fill-color": "#1D1B17", "fill-opacity": 0.55 } });
      map.addLayer({ id: `${cfg.id}-tline`, type: "line", source: tsrc, "source-layer": "slicks", minzoom: 7,
        paint: { "line-color": "#B8A79E", "line-width": 1 } });
      map.addLayer({ id: `${cfg.id}-tpt`, type: "circle", source: tsrc, "source-layer": "slick_points", maxzoom: 7,
        paint: { "circle-color": "#B8A79E", "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.2, 6, 3.6],
                 "circle-stroke-color": "#1D1B17", "circle-stroke-width": 0.5, "circle-opacity": 0.9 } });
      bindHtmlPopup(`${cfg.id}-tfill`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily</div>`);
      bindHtmlPopup(`${cfg.id}-tpt`, (p) => `<b>Oil slick</b><table class="meta">${fieldRows(p)}</table><div class="meta">SkyTruth Cerulean, kept daily \u00b7 zoom in for its shape</div>`);
      tiledNow = url;
    }
    map.getSource(src).setData({ type: "FeatureCollection", features: [] });
    map.getSource(`${src}-pt`).setData({ type: "FeatureCollection", features: [] });
    applyVisibility(cfg.id);
    setLayerState(cfg.id, `${Number(index[m]).toLocaleString()} slicks in ${m} \u00b7 ${months.length} months kept`);
  };
  const show = async (m) => {
    if (tiled[m]) { showTiled(m); return; }
    setLayerState(cfg.id, `reading ${m}\u2026`);
    try {
      const gj = await getJson(`${cfg.base}/${m}.geojson`, 60000);
      map.getSource(src).setData(gj);
      map.getSource(`${src}-pt`).setData(middles(gj));
      ["-tfill", "-tline", "-tpt"].forEach((suffix) => {
        if (map.getLayer(cfg.id + suffix)) map.setLayoutProperty(cfg.id + suffix, "visibility", "none");
      });
      setLayerState(cfg.id, `${Number(index[m]).toLocaleString()} slicks in ${m} \u00b7 ${months.length} months kept`);
    } catch (e) { setLayerState(cfg.id, `${m} could not be read (${e.message})`); }
  };
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<select aria-label="Month">${months.map((m) => `<option value="${m}">${m} (${Number(index[m]).toLocaleString()})</option>`).join("")}</select>`;
    el.querySelector("select").addEventListener("change", (e) => show(e.target.value));
    anchor.after(el);
  }
  if (months.length) await show(months[0]);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */

// Placed at random once, from a fixed seed, so the same sky comes back on
// every redraw and every visit. Rendered behind the map: behind the globe, and
// beyond the flat map's edges.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The map's own colours, dimmed: bone, pale slate, muted rose.
const STAR_COLOURS = ["#D6D3C8", "#D6D3C8", "#D6D3C8", "#AEB9C4", "#B79A92"];
const STAR_DENSITY = 1 / 7000;         // stars per square pixel

function starField(width, height, seed) {
  const rand = seededRandom(seed || 20260917);
  const stars = [];
  const n = Math.round(width * height * STAR_DENSITY);
  for (let i = 0; i < n; i++) {
    const bright = Math.pow(rand(), 2.2);            // many faint, a few bright
    stars.push({
      x: rand() * width, y: rand() * height,
      r: 0.35 + bright * 1.15,
      a: 0.16 + bright * 0.74,
      c: STAR_COLOURS[Math.floor(rand() * STAR_COLOURS.length)],
    });
  }
  return stars;
}

const sky = { stars: [], w: 0, h: 0, frame: 0 };

function drawSky() {
  sky.frame = 0;
  const cv = document.getElementById("stars");
  if (!cv || !cv.getContext) return;
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const w = cv.clientWidth || 0, h = cv.clientHeight || 0;
  if (!w || !h) return;
  if (w !== sky.w || h !== sky.h) {
    sky.w = w; sky.h = h;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    sky.stars = starField(w, h);
  }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // A distant field moves a little as the map is turned, and wraps round.
  const c = typeof map.getCenter === "function" ? map.getCenter() : { lng: 0, lat: 0 };
  const ox = ((-c.lng / 360) * w * 0.6 % w + w) % w;
  const oy = ((c.lat / 90) * h * 0.15 % h + h) % h;
  for (const s of sky.stars) {
    const x = (s.x + ox) % w, y = (s.y + oy) % h;
    ctx.globalAlpha = s.a;
    ctx.fillStyle = s.c;
    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function skyRedraw() {
  if (sky.frame) return;
  sky.frame = (typeof requestAnimationFrame === "function")
    ? requestAnimationFrame(drawSky) : setTimeout(drawSky, 16);
}

// The flat map's dark background would cover the whole screen, stars included.
// Drawn as a fill over the world instead, under the imagery.
function ensureWorldFill() {
  if (map.getLayer("world-fill")) return;
  map.addSource("world-box", { type: "geojson", data: { type: "Feature", properties: {},
    geometry: { type: "Polygon", coordinates: [[[-180, -85.0511], [180, -85.0511],
                                                [180, 85.0511], [-180, 85.0511], [-180, -85.0511]]] } } });
  map.addLayer({ id: "world-fill", type: "fill", source: "world-box",
                 paint: { "fill-color": "#0B1017" } }, map.getLayer("base") ? "base" : undefined);
}

// Globe: the background layer is drawn on the planet only, so it stays and the
// fill is not needed. Flat map: the other way round.
function skyForView(projection) {
  const flat = projection === "mercator";
  if (flat) ensureWorldFill();
  const show = (id, on) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  };
  show("bg", !flat);
  show("world-fill", flat);
  skyRedraw();
}

function watchSky() {
  map.on("move", skyRedraw);
  map.on("resize", skyRedraw);
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", skyRedraw);
  skyForView(drawnProjection());
}

/* ---------- boxes that can be pulled open and shut ---------- */

// Where a drag leaves a box. Dragging away from the edge the box is anchored
// to makes it taller: down for the panel, which hangs from the top of the
// window, up for the legend and the news wires, which stand on the bottom.
function pullHeight(startHeight, dy, edge, min, max) {
  const h = startHeight + (edge === "top" ? -dy : dy);
  return Math.max(min, Math.min(max, h));
}

const PULL_MIN = 42;

function makePullable(el, edge) {
  if (!el || !el.dataset || el.dataset.pullable || typeof document.createElement !== "function") return;
  el.dataset.pullable = "1";
  const grip = document.createElement("div");
  grip.className = "pull-grip";
  grip.title = "Drag to pull this open or shut. Double-click to put it back.";
  const place = () => {
    if (grip.parentNode === el && (edge === "top" ? el.firstChild === grip : el.lastChild === grip)) return;
    if (edge === "top") el.insertBefore(grip, el.firstChild); else el.appendChild(grip);
  };
  place();
  // The legend and the wires rewrite their own contents; the grip goes back.
  if (typeof MutationObserver === "function") new MutationObserver(place).observe(el, { childList: true });

  let from = 0, height = 0;
  const ceiling = () => Math.max(PULL_MIN + 20, (typeof window !== "undefined" ? window.innerHeight : 800) - 60);
  // Pulled right down, a box is a title bar and nothing else - but it still
  // scrolls what it is hiding, so the scrollbar stayed down the side of a box
  // with nothing in it. At the minimum the box stops scrolling.
  const settle = (h) => { if (el.classList) el.classList.toggle("pulled-shut", h <= PULL_MIN + 4); };
  const move = (e) => {
    const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : from);
    el.style.maxHeight = "none";
    const h = pullHeight(height, y - from, edge, PULL_MIN, ceiling());
    el.style.height = h + "px";
    settle(h);
  };
  const stop = () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", stop);
  };
  grip.addEventListener("pointerdown", (e) => {
    from = e.clientY;
    height = el.getBoundingClientRect ? el.getBoundingClientRect().height : 0;
    if (e.preventDefault) e.preventDefault();
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
  });
  grip.addEventListener("dblclick", () => { el.style.height = ""; el.style.maxHeight = ""; settle(999); });
}

// The news wires box is built by wire.js, which runs after this file.
function pullableBoxes() {
  makePullable(document.querySelector(".panel"), "bottom");
  makePullable(document.getElementById("legend"), "top");
  // The wires box is not dragged: it opens and closes on its own caret.
}

// Names only: the settings box says what each one is, not what it does.
/* ---------- Climate TRACE as columns ---------- */

// Each emitting asset as a column whose height follows its emissions, the way
// Climate TRACE's own map draws them. MapLibre raises polygons, not points, so
// every point in the loaded tiles gets a small square footprint here, rebuilt
// when the map stops moving. Height is by the square root of the emissions, so
// the largest sources stand tall without flattening the rest to nothing, and
// it scales with zoom so the columns keep their size on the screen.
const COLUMN_MAX = 15000;       // columns at once, the largest first
const COLUMN_PX = 1.5;          // half the footprint, in screen pixels, at world view
const COLUMN_PX_MAX = 14;       // half the footprint at most, close in
const COLUMN_GROW = 1.35;       // footprint growth per zoom level past 3
const COLUMN_TALL = 0.03;       // screen pixels of height per √(t CO₂e)
let columnsTimer = null;

function ctColumnCfgs() {
  return [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY].flatMap((g) => g.children)
    .filter((c) => created.has(c.id) && (visibility.get(c.id) || "visible") === "visible" &&
                   map.getSource(`${c.sourceOf || c.id}-src`));
}

function scheduleColumns() {
  clearTimeout(columnsTimer);
  columnsTimer = setTimeout(buildColumns, 250);
}

function buildColumns() {
  const src = map.getSource("ct-columns");
  if (!src || typeof map.querySourceFeatures !== "function") return;
  const z = map.getZoom();
  const mPerPx = 40075016 / (512 * Math.pow(2, z));   // metres per screen pixel at the equator
  const rows = [];
  for (const cfg of ctColumnCfgs()) {
    const owner = cfg.sourceOf || cfg.id;
    const filter = map.getLayer(`${cfg.id}-agg`) ? map.getFilter(`${cfg.id}-agg`) : null;
    const seen = new Set();
    for (const f of map.querySourceFeatures(`${owner}-src`, { sourceLayer: owner, ...(filter ? { filter } : {}) })) {
      if (!f.geometry || f.geometry.type !== "Point") continue;
      const [lng, lat] = f.geometry.coordinates;
      const key = `${f.properties.id}|${lng.toFixed(4)}|${lat.toFixed(4)}`;
      if (seen.has(key)) continue;          // a point on a tile edge comes back twice
      seen.add(key);
      rows.push({ lng, lat, v: Math.max(0, Number(f.properties.value) || 0), cfg, p: f.properties });
    }
  }
  rows.sort((a, b) => b.v - a.v);
  const kept = rows.slice(0, COLUMN_MAX);
  const halves = columnHalves(kept, z);
  const grow = Math.sqrt(halves.want / COLUMN_PX);
  const features = kept.map(({ lng, lat, v, cfg, p }, i) => {
    const half = halves.px[i] * mPerPx;
    const dLat = half / 111320, dLng = half / (111320 * Math.max(.05, Math.cos(lat * Math.PI / 180)));
    return { type: "Feature",
      properties: Object.assign({}, p, { colour: cfg.colour, layerName: cfg.name,
        h: Math.max(mPerPx * 1.5, Math.sqrt(v) * COLUMN_TALL * mPerPx * grow) }),
      geometry: { type: "Polygon", coordinates: [[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat],
        [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]] } };
  });
  src.setData({ type: "FeatureCollection", features });
  if (rows.length > COLUMN_MAX) console.info(`[culprits] Climate TRACE: the ${COLUMN_MAX.toLocaleString()} largest of ` +
    `${rows.length.toLocaleString()} sources in view are raised as columns; the rest stay as dots.`);
}

// Half the footprint of each column, in screen pixels: larger as the map zooms
// in, but never more than just under half the distance to the nearest other
// column, so neighbours cannot overlap. Neighbours are found on a grid of cells
// one full footprint wide.
function columnHalves(rows, z) {
  const want = Math.min(COLUMN_PX_MAX, COLUMN_PX * Math.pow(COLUMN_GROW, Math.max(0, z - 3)));
  const px = rows.map(() => want);
  if (typeof map.project !== "function" || rows.length < 2 || want <= COLUMN_PX) return { want, px };
  const pts = rows.map((r) => map.project([r.lng, r.lat]));
  const cell = want * 2, grid = new Map();
  pts.forEach((q, i) => {
    const k = `${Math.floor(q.x / cell)}|${Math.floor(q.y / cell)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  pts.forEach((q, i) => {
    const cx = Math.floor(q.x / cell), cy = Math.floor(q.y / cell);
    let near = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of grid.get(`${cx + dx}|${cy + dy}`) || []) {
        if (j === i) continue;
        const d = Math.max(Math.abs(pts[j].x - q.x), Math.abs(pts[j].y - q.y));
        if (d < near) near = d;
      }
    }
    // Squares: they meet when the larger of the two distances is two halves.
    if (near < Infinity) px[i] = Math.max(COLUMN_PX, Math.min(want, near * 0.45));
  });
  return { want, px };
}

function addColumnLayer() {
  if (map.getSource("ct-columns")) return;
  map.addSource("ct-columns", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "ct-columns", type: "fill-extrusion", source: "ct-columns",
    paint: { "fill-extrusion-color": ["get", "colour"], "fill-extrusion-height": ["get", "h"],
             "fill-extrusion-base": 0, "fill-extrusion-opacity": .92,
             "fill-extrusion-vertical-gradient": true } });
  bindHtmlPopup("ct-columns", (p) => {
    const n = Number(p._count || 1);
    const v = Number(p.value);
    return `<b>${escapeHtml(n > 1 ? `${n.toLocaleString()} sources here` : (p.name || "Emitting asset"))}</b>` +
      `<div class="meta">${escapeHtml(p.layerName || "")}</div>` +
      (isFinite(v) ? `<div class="meta">${Math.round(v).toLocaleString()} t CO\u2082e/yr (GWP-100)` +
        (n > 1 ? ", together" : "") + `</div>` : "") +
      (n > 1 ? "" : ["x_asset_definition", "x_period", "x_capacity", "x_capacity_units", "x_gas"]
        .filter((k) => p[k] != null && p[k] !== "")
        .map((k) => `<div class="meta">${k.replace(/^x_/, "").replace(/_/g, " ")}: ${escapeHtml(String(p[k]))}</div>`).join(""));
  });
  map.on("moveend", scheduleColumns);
  map.on("sourcedata", (e) => {
    if (e && e.sourceId && /^climate_trace/.test(e.sourceId) && e.isSourceLoaded) scheduleColumns();
  });
}

/* ---------- 3D terrain ---------- */

// Ground height, draped under the imagery. Mapzen's terrarium tiles on AWS
// need no key and are served to any origin; they are elevation of the ground,
// not buildings, and below about zoom 8 the whole planet is smooth enough that
// the tilt is all you see.
const TERRAIN_SOURCE = {
  type: "raster-dem",
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  // Heights stop at zoom 12 and are stretched beyond it: past that the extra
  // detail is metres, and every tile toward a tilted horizon cost a download.
  encoding: "terrarium", tileSize: 256, maxzoom: 12,
  attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a>',
};
const TERRAIN_EXAGGERATION = 1.4;
let TERRAIN_ON = false;

// Buildings, standing up, while the ground is tilted.
//
// Every basemap here is painted tiles, so a building on them is a picture of a
// roof: tilt the map and the roofs lean with the ground, which is the flat,
// slanted look. These are the real footprints from OpenStreetMap, each raised
// to the height OpenStreetMap records for it, served by OpenFreeMap with no key
// and no limit. render_height is OpenMapTiles' own figure, from the building's
// height where it is recorded and from its floor count where it is not; a
// building with neither is left out rather than given a height nobody stated.
//
// From zoom 15, and only while 3D terrain is on: at any wider view a building
// is smaller than a pixel, and on the flat map there is nothing for them to
// stand on.
const BUILDINGS_SOURCE = {
  type: "vector",
  url: "https://tiles.openfreemap.org/planet",
  attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> \u00b7 ' +
    '<a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> \u00b7 ' +
    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
};
const BUILDINGS_ZOOM = 15;
function setBuildings3D(on) {
  if (typeof map.getSource !== "function" || typeof map.addLayer !== "function") return;
  if (!on) {
    if (map.getLayer("buildings-3d")) map.setLayoutProperty("buildings-3d", "visibility", "none");
    return;
  }
  if (!map.getSource("ofm-buildings")) map.addSource("ofm-buildings", BUILDINGS_SOURCE);
  if (!map.getLayer("buildings-3d")) {
    map.addLayer({
      id: "buildings-3d", type: "fill-extrusion", source: "ofm-buildings", "source-layer": "building",
      minzoom: BUILDINGS_ZOOM,
      filter: ["all", ["has", "render_height"], ["!=", ["get", "hide_3d"], true]],
      paint: {
        // Stone, a shade off the ground, so a street reads as built rather than
        // as another data layer. Nothing here is coloured by a value.
        "fill-extrusion-color": "#7C7468",
        // They rise as you come in, rather than appearing full height at 15.
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"],
          BUILDINGS_ZOOM, 0, BUILDINGS_ZOOM + 1, ["get", "render_height"]],
        "fill-extrusion-base": ["case", [">=", ["zoom"], BUILDINGS_ZOOM + 1],
          ["coalesce", ["get", "render_min_height"], 0], 0],
        "fill-extrusion-opacity": 0.85,
      },
    });
  }
  map.setLayoutProperty("buildings-3d", "visibility", "visible");
}

function setTerrain(on) {
  TERRAIN_ON = !!on;
  if (typeof map.setTerrain !== "function") return;
  setView(VIEW);
  // The Esri relief layer is a second set of tiles to fetch; with real
  // heights under the imagery it is put away.
  if (map.getLayer("hillshade")) {
    map.setLayoutProperty("hillshade", "visibility", !TERRAIN_ON && BASEMAP !== "outlines" ? "visible" : "none");
  }
  if (TERRAIN_ON) {
    if (!map.getSource("terrain-dem")) map.addSource("terrain-dem", TERRAIN_SOURCE);
    map.setTerrain({ source: "terrain-dem", exaggeration: TERRAIN_EXAGGERATION });
    // Close up, the camera leans over so the ground reads. At world scale it
    // stays upright: the planet's own curve already shows it is round.
    if (typeof map.easeTo === "function" && map.getPitch && map.getPitch() < 25 && map.getZoom() >= 6) {
      map.easeTo({ pitch: 55, duration: 700 });
    }
  } else {
    map.setTerrain(null);
    if (typeof map.easeTo === "function" && map.getPitch && map.getPitch() > 0) {
      map.easeTo({ pitch: 0, duration: 500 });
    }
  }
  setBuildings3D(TERRAIN_ON);
  const box = document.getElementById("terrain-toggle");
  if (box) box.checked = TERRAIN_ON;
}

// Out to the whole planet, in the view already chosen: on the globe (and with
// terrain, which is drawn round) the zoom the map opens on; on the flat map the
// zoom at which the whole chart fits the window.
function outToTheGlobe() {
  if (typeof map.easeTo !== "function") return;
  const round = drawnProjection() !== "mercator";
  let zoom = OPENING_ZOOM;
  if (!round) {
    const c = map.getCanvas ? map.getCanvas() : null;
    const w = (c && c.clientWidth) || 1280, h = (c && c.clientHeight) || 800;
    // The Mercator square is 512 px wide at zoom 0; fit it with a margin.
    zoom = Math.log2(Math.min(w / 512, h / 512) * 0.92);
  }
  map.easeTo({ center: [round ? map.getCenter().lng : 0, round ? 20 : 0], zoom,
               pitch: 0, bearing: 0, roll: 0, duration: 900 });
}


// MapLibre puts its zoom buttons in a corner of the map. They belong in the
// view row, so the element is moved there once it exists.
if (typeof map.on === "function") map.on("moveend", () => {
  try {
    const c = map.getCenter();
    window.__culpritsView = `${c.lng.toFixed(4)},${c.lat.toFixed(4)},${map.getZoom().toFixed(2)}`;
  } catch (e) { /* the view is not kept; the page still reloads */ }
});
if (typeof map.once === "function") map.once("load", () => {
  try {
    const v = sessionStorage.getItem("culprits-view");
    if (!v) return;
    sessionStorage.removeItem("culprits-view");
    const [lng, lat, z] = v.split(",").map(Number);
    if ([lng, lat, z].every(isFinite)) map.jumpTo({ center: [lng, lat], zoom: z });
  } catch (e) { /* no saved view */ }
});

function moveZoomButtons() {
  const holder = document.getElementById("view-zoom");
  const group = document.querySelector(".maplibregl-ctrl-bottom-right .maplibregl-ctrl-group");
  if (holder && group && holder.insertBefore) holder.insertBefore(group, holder.firstChild);
  // The reload button is in the page itself (index.html), clickable before the
  // map loads; it moves into the right column here. The view it keeps is
  // written as the map moves, so a click needs nothing from this script.
  //
  // It sits as its own row under the settings box, not inside it. Inside, it
  // was the last thing in a box that scrolls and stops at 48vh, so on a short
  // window the button and its words were cut off at the bottom edge. As a row
  // of its own it is never clipped, and because it is in the column's flow
  // rather than floating over it, it covers nothing either.
  const wrap = document.getElementById("reload-wrap");
  const under = document.querySelector(".right-col");
  if (under && wrap && under.insertBefore && wrap.parentNode !== under) {
    // Above the View box rather than under it, with a gap, so the two read as
    // two boxes and neither sits over the other.
    under.insertBefore(wrap, under.firstChild);
    if (wrap.classList) wrap.classList.remove("reload-early");
  }
  // The compass goes under the 3D terrain tick box, beside the notes on how
  // to tilt. MapLibre keeps its own hold on the button, so it still turns.
  const compass = group && group.querySelector ? group.querySelector(".maplibregl-ctrl-compass") : null;
  const spot = document.getElementById("compass-holder");
  if (compass && spot && spot.appendChild) {
    const wrap = document.createElement("div");
    wrap.className = "maplibregl-ctrl maplibregl-ctrl-group";
    wrap.appendChild(compass);
    spot.insertBefore(wrap, spot.firstChild);
  }
}

// Each section of the settings box rolls up and down on its own caret.
function sectHead(name, key) {
  return `<div class="sect-head"><span class="bm-h">${name}</span>` +
    `<button type="button" class="p-roll" data-roll="${key}" aria-expanded="true" ` +
    `title="Roll ${name.toLowerCase()} up or down">&#9662;</button></div>`;
}

// Basemap comes first. It is three short rows; View is long, and the box stops
// at 48vh and scrolls, so with Basemap last its choices sat below the bottom
// edge and the heading looked like an empty section.
function basemapPanelHtml(opts) {
  return `<div class="sect" data-sect="basemap">` + sectHead("Basemap", "basemap") + `<div class="sect-body">` +
    opts.map(([k, nm]) =>
      `<label class="layer"><input type="radio" name="basemap" value="${k}"` +
      `${k === BASEMAP ? " checked" : ""}><span class="nm">${nm}</span></label>`).join("") + `</div></div>`;
}

function viewPanelHtml() {
  return `<div class="sect" data-sect="view">` + sectHead("View", "view") + `<div class="sect-body">` +
    `<div class="view-row"><div class="view-choices">` +
    Object.entries(VIEWS).map(([k, v]) =>
      `<label class="layer"><input type="radio" name="view" value="${k}"${k === VIEW ? " checked" : ""}>` +
      `<span class="nm">${v.nm}</span></label>`).join("") +
    `</div><div class="view-zoom" id="view-zoom"></div>` +
    `<div class="view-go">` +
    `<button type="button" id="to-globe" class="snap" title="Out to the whole world, in the view you are in">` +
    `Snap back to global scale</button>` +
    `<button type="button" id="leave-earth" class="leave" title="Hands the screen to NASA's Eyes ` +
    `on the Solar System. A box in the corner brings the map back.">Leave Earth &#8594;</button></div></div>` +
    `<div class="terrain-row"><div class="terrain-left"><label class="layer"><input type="checkbox" id="terrain-toggle"${TERRAIN_ON ? " checked" : ""}` +
    ` title="Ground height under the imagery, on the globe or the flat map.">` +
    `<span class="nm">3D terrain</span></label>` +
    `<div class="compass-holder" id="compass-holder" title="Click to stand the map upright, facing north">` +
    `<span class="compass-cap">Click: north up, level</span></div></div>` +
    `<div class="how-boxes">` +
    `<p class="how"><b>Mouse</b> Right-drag: tilt and turn. Ctrl + right-drag: roll.</p>` +
    `<p class="how"><b>Trackpad</b> Ctrl + drag: tilt and turn. Ctrl + two-finger click, then drag: roll.</p>` +
    `<p class="how">Same on Mac and Windows. Keys: Shift + arrows.</p>` +
    `</div></div></div></div>`;
}

function buildBasemapPanel() {
  const box = document.getElementById("basemaps");
  if (!box) return;
  const opts = [["atlas", "Painted atlas"], ["satellite", "Satellite imagery"], ["outlines", "Country outlines"]];
  box.innerHTML = basemapPanelHtml(opts) + viewPanelHtml();
  box.addEventListener("click", (e) => {
    const roll = e.target && e.target.closest ? e.target.closest("[data-roll]") : null;
    if (roll) {
      const sect = roll.closest(".sect");
      const shut = !sect.classList.contains("shut");
      sect.classList.toggle("shut", shut);
      roll.innerHTML = shut ? "&#9652;" : "&#9662;";
      roll.setAttribute("aria-expanded", shut ? "false" : "true");
      return;
    }
    if (e.target && e.target.id === "leave-earth") leaveEarth();
    if (e.target && e.target.id === "to-globe") outToTheGlobe();
  });
  moveZoomButtons();
  box.addEventListener("change", (e) => {
    if (e.target && e.target.name === "basemap") setBasemap(e.target.value);
    if (e.target && e.target.name === "view") setView(e.target.value);
    if (e.target && e.target.id === "terrain-toggle") setTerrain(e.target.checked);
  });
}

// Choropleth fills belong under the point layers so they don't hide them. But
// the point layers are added asynchronously too, so the id may not exist yet —
// and MapLibre throws on a beforeId that isn't there. Return undefined in that
// case and let the fill go on top; ordering is cosmetic, a thrown error is not.
function pointLayerAbove() {
  for (const l of LAYERS) {
    if (l.ready && l.route !== "country" && map.getLayer(`${l.id}-agg`)) {
      return `${l.id}-agg`;
    }
  }
  return undefined;
}

async function addCountryLayer(cfg) {
  ensureBoundaries();

  let totals;
  try {
    const r = await fetch(`${DATA_BASE}/${cfg.id}.countries.json`);
    if (!r.ok) throw new Error(`${r.status}`);
    totals = await r.json();
  } catch (e) {
    setLayerState(cfg.id, `unavailable (${e.message})`);
    return;
  }

  const values = Object.values(totals).map((t) => t.value).filter((v) => v > 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);

  // Log scale, not linear or square-root. These distributions are extremely
  // heavy-tailed: China emits 12,289 Mt against a median country's 11.8, so a
  // square-root ramp gave the median an opacity of 0.02 — data present, nothing
  // visible. Log spreads the middle of the range where most countries sit.
  //
  // OPACITY_FLOOR keeps the smallest reporting country distinguishable from a
  // country with no data at all, which must stay fully transparent.
  const OPACITY_FLOOR = 0.12, OPACITY_CEIL = 0.72;
  const lo = Math.log10(Math.max(min, 1e-6));
  const span = Math.max(Math.log10(max) - lo, 0.001);

  // Country layers share one boundaries source, so each needs its own
  // feature-state key. A shared "v" meant the second layer to load silently
  // overwrote the first's values for every country.
  const key = `v_${cfg.id}`;

  map.addLayer({
    id: `${cfg.id}-fill`,
    type: "fill",
    source: "boundaries",
    paint: {
      "fill-color": cfg.colour,
      // Square root, not linear: one country holding a third of the total
      // would otherwise flatten every other country to invisible.
      "fill-opacity": [
        "case", ["==", ["feature-state", key], null], 0,
        ["+", OPACITY_FLOOR, ["*", OPACITY_CEIL - OPACITY_FLOOR,
          ["/", ["-", ["log10", ["max", ["feature-state", key], 1e-6]], lo], span]]],
      ],
    },
  }, pointLayerAbove());

  map.addLayer({
    id: `${cfg.id}-line`,
    type: "line",
    source: "boundaries",
    paint: {
      "line-color": cfg.colour,
      "line-width": 0.6,
      "line-opacity": ["case", ["==", ["feature-state", key], null], 0, 0.55],
    },
  });

  for (const [iso, t] of Object.entries(totals)) {
    // Merge rather than replace: another country layer may already hold state
    // on this feature.
    map.setFeatureState({ source: "boundaries", id: iso }, {
      [key]: t.value,
      [`${key}_unit`]: t.unit,
      [`${key}_note`]: t.x_deals ? `${t.x_deals} deals`
                     : t.x_share_global ? `${t.x_share_global}% of global`
                     : null,
    });
  }

  map.on("click", `${cfg.id}-fill`, (e) => {
    const st = map.getFeatureState({ source: "boundaries", id: e.features[0].id });
    if (st[key] == null) return;
    new maplibregl.Popup({ maxWidth: "280px" })
      .setLngLat(e.lngLat)
      .setHTML(
        `<b>${e.features[0].properties.name}</b>` +
        `${Number(st[key]).toLocaleString()} ${st[`${key}_unit`] || ""}` +
        (st[`${key}_note`] ? `<div class="meta">${st[`${key}_note`]}</div>` : "") +
        `<div class="meta" style="color:#8F4E40">Country total — the source ` +
        `records no site coordinates for these.</div>`
      )
      .addTo(map);
  });
  map.on("mouseenter", `${cfg.id}-fill`, () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", `${cfg.id}-fill`, () => (map.getCanvas().style.cursor = ""));
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- live layers, via the Worker ---------- */

const liveCache = new Map();

async function refreshLiveLayer(cfg) {
  const b = map.getBounds();
  const west = Math.max(b.getWest(), -180), east = Math.min(b.getEast(), 180);
  const south = Math.max(b.getSouth(), -90), north = Math.min(b.getNorth(), 90);

  // No fixed zoom threshold. Live layers load at whatever zoom the source can
  // answer for — which differs by source, because a request covering half the
  // planet is a different thing to EPA than it is to a 10 m alert raster.
  const area = (east - west) * (north - south);
  const cap = cfg.maxAreaDeg2 || 25;
  if (area > cap) {
    setLayerState(cfg.id, `zoom in — area too wide for this source`);
    const src = map.getSource(`${cfg.id}-live`);
    if (src) src.setData({ type: "FeatureCollection", features: [] });
    return;
  }

  const bbox = [west, south, east, north].map((n) => n.toFixed(3)).join(",");

  if (inFlight.get(cfg.id)) return;   // one at a time; the settle timer retries
  if (liveCache.get(cfg.id) === bbox) return;    // same viewport, already have it
  liveCache.set(cfg.id, bbox);

  const src = map.getSource(`${cfg.id}-live`);
  if (!src) return;
  inFlight.set(cfg.id, true);
  try {
    setLayerState(cfg.id, "loading…");
    const r = await fetch(`${WORKER}/${cfg.id}?bbox=${bbox}&z=${Math.round(map.getZoom())}`);
    if (!r.ok) {
      // Surface the Worker's own explanation, which names the upstream problem,
      // rather than a bare status code.
      let detail = `${r.status}`;
      try { detail = (await r.json()).error || detail; } catch (_) {}
      throw new Error(detail);
    }
    const geo = await r.json();
    src.setData(geo);
    const n = (geo.features || []).length;
    // Several sources cap how many features one request returns — the Allen
    // Coral Atlas at 2,000, Cerulean's source collection at 500 — and say how
    // many matched. Off Cairns that was 2,000 of 49,124: 4% drawn, and the panel
    // said "2,000 in view" as though that were all of it. Where the source
    // states its match count, the panel states it too.
    const matched = Number(geo.numberMatched ?? geo.totalFeatures);
    const partial = Number.isFinite(matched) && matched > n;
    setLayerState(cfg.id, partial
      ? `showing ${n.toLocaleString()} of ${matched.toLocaleString()} here — the source sends ` +
        `at most ${n.toLocaleString()} at once`
      : n ? `${n.toLocaleString()} in view` : "none in this area");
    console.log(`[culprits] ${cfg.id}: ${n} features for ${bbox}`);
  } catch (e) {
    // A live source failing is not a reason for the map to fail. The layer
    // stays empty and says so rather than throwing.
    const busy = /429|Too Many Requests|concurrent/.test(e.message);
    setLayerState(cfg.id, busy
      ? "the source is still finishing the last request — pausing, then retrying"
      : `unavailable (${e.message})`);
    if (busy) {
      // The previous report is still running upstream. Forget the cached
      // viewport so the next attempt actually re-requests it.
      liveCache.delete(cfg.id);
      setTimeout(() => refreshLiveLayer(cfg), 8000);
    }
  } finally {
    inFlight.set(cfg.id, false);
  }
}

/* ---------- Allen Coral Atlas, live from its own tiles ---------- */

// The Atlas's benthic classes, as they appear in class_name.
const CORAL_CLASSES = {
  "Coral/Algae":     "#B06F6A",
  "Seagrass":        "#6F8F68",
  "Sand":            "#D2CBC2",
  "Rubble":          "#958C86",
  "Rock":            "#5F5A57",
  "Microalgal Mats": "#7D7191",
};

// UNEP-WCMC's reef map from the world view until the Atlas's own shapes take
// over, so nothing drops out in between (the Atlas's picture of zooms 6 to 12
// failed to draw over the satellite view).
const CORAL_ATLAS_PICTURE_FROM = 12;
// Below this zoom the world reef map is drawn coarse so that reefs a few
// hundred metres across are still findable; at and above it, full size.
const CORAL_WORLD_SHARP = 7;
function addCoralLayer(cfg) {
  map.addSource(`${cfg.id}-tiles`, {
    type: "vector",
    tiles: [cfg.tiles.replace(/^https:\/\//, "coral://")],
    // No tileSize: MapLibre only accepts 512 for vector tiles and throws on
    // anything else, which silently left this layer unbuilt. A vector tile is
    // not a picture of a fixed size, so the Atlas's grid is read correctly.
    // MapLibre counts a vector square as 512 pixels, so at map zoom 12 it asks
    // for zoom-11 squares: the Atlas's squares are asked from one level lower,
    // or nothing would draw until zoom 13.
    minzoom: cfg.drawFrom - 1, maxzoom: 16,
    attribution: cfg.attribution || "",
  });
  addCoralShapes(cfg, false);
  // Wider out, the Atlas's own picture of the same reefs, from its map server,
  // in the coral colour (the server draws them black).
  map.addSource(`${cfg.id}-wide`, { type: "raster", tileSize: 256, attribution: cfg.attribution || "",
    tiles: [`tint://${CORAL_CLASSES["Coral/Algae"].slice(1)}/allencoralatlas.org/geoserver/ows?SERVICE=WMS&VERSION=1.1.1` +
            `&REQUEST=GetMap&LAYERS=coral-atlas:benthic_data_verbose&STYLES=&SRS=EPSG:3857&BBOX={bbox-epsg-3857}` +
            `&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`] });
  // The Atlas's own picture of the same reefs, from zoom 12 in, with no upper
  // stop. It used to carry maxzoom: cfg.drawFrom, which is also 12, so it drew
  // at no zoom at all: closer in there was nothing but the Atlas's vector
  // shapes, and when those do not arrive - the Atlas is slow, and answers some
  // squares and not others - the reefs simply vanished as you zoomed in. Now
  // the picture stays underneath the shapes the whole way in.
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: `${cfg.id}-wide`,
    minzoom: CORAL_ATLAS_PICTURE_FROM, layout: { visibility: "none" }, paint: { "raster-opacity": 0.9 } });
  // Wider still, the Atlas's server runs out of time drawing so much reef, so
  // UNEP-WCMC's reef map stands in, in the same colour, and the row says so.
  //
  // A reef is a few hundred metres across. From the world view that is a
  // fraction of a pixel, so the layer drew a scatter of marks too faint to
  // find. The map asks the same server for a smaller picture of each square
  // and lets the square stretch it: a reef that covers one pixel of a 96-pixel
  // picture covers nearly three on screen. Nothing is added or moved - the
  // same reefs are drawn coarser, which is what makes them findable at this
  // width. Nearest-neighbour, because smoothing spreads that one pixel into a
  // pale smudge and undoes it. From zoom CORAL_WORLD_SHARP the squares are
  // small enough for reefs to hold their own, and the full-size picture is
  // used instead.
  const wcmc = (px) => `tint://${CORAL_CLASSES["Coral/Algae"].slice(1)}/data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/MapServer/export` +
    `?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=${px},${px}&format=png32&transparent=true&f=image`;
  map.addSource(`${cfg.id}-globe`, { type: "raster", tileSize: 256,
    attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC", tiles: [wcmc(96)] });
  map.addLayer({ id: `${cfg.id}-world`, type: "raster", source: `${cfg.id}-globe`, maxzoom: CORAL_WORLD_SHARP,
    layout: { visibility: "none" }, paint: { "raster-opacity": 1, "raster-resampling": "nearest" } });
  map.addSource(`${cfg.id}-globe-near`, { type: "raster", tileSize: 256,
    attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC", tiles: [wcmc(256)] });
  // No upper stop here either: UNEP-WCMC's reef map is the one thing that
  // always answers, so it stays under everything else rather than handing over
  // at zoom 12 and leaving a gap if the Atlas is silent.
  map.addLayer({ id: `${cfg.id}-world-near`, type: "raster", source: `${cfg.id}-globe-near`,
    minzoom: CORAL_WORLD_SHARP,
    layout: { visibility: "none" }, paint: { "raster-opacity": 0.9 } });
  bindHtmlPopup(`${cfg.id}-fill`, (p) =>
    `<b>${p.class_name || "Unclassified"}</b>` +
    (p.area_sqkm != null
      ? `<div class="meta">This mapped patch: ${Number(p.area_sqkm).toPrecision(3)} km²</div>` : "") +
    `<div class="meta">Allen Coral Atlas benthic habitat, from satellite imagery ` +
    `to about 10 m depth. A class of seabed, not a survey of living coral.</div>`);
  // A layer that draws nothing looks the same whether it is working over open
  // water or failing. So the panel says which: patches drawn on screen, squares
  // still loading, or squares the Atlas failed to answer.
  const state = () => {
    if (map.getZoom() < cfg.drawFrom) {
      setLayerState(cfg.id, map.getZoom() < CORAL_ATLAS_PICTURE_FROM
        ? `UNEP-WCMC's warm-water reefs at this width — from zoom ${cfg.drawFrom} the Allen Coral Atlas's habitat zones, each with its box`
        : `UNEP-WCMC's warm-water reefs at this width — from zoom ${cfg.drawFrom} the Allen Coral Atlas's habitat zones, each with its box`);
      return;
    }
    if ((visibility.get(cfg.id) || "visible") !== "visible") {
      setLayerState(cfg.id, "tick this row to draw the reefs here");
      return;
    }
    const failed = coralFailures.get(cfg.id) || 0;
    let loaded = 0, loading = false;
    try {
      loaded = typeof map.querySourceFeatures === "function"
        ? map.querySourceFeatures(`${cfg.id}-tiles`, { sourceLayer: cfg.sourceLayer }).length : 0;
      loading = typeof map.isSourceLoaded === "function" && !map.isSourceLoaded(`${cfg.id}-tiles`);
    } catch (e) {
      console.warn(`[culprits] ${cfg.id}: ${e.message}`);
      setLayerState(cfg.id, `could not read the Atlas's squares (${e.message})`);
      return;
    }
    let text = loaded ? `${loaded.toLocaleString()} reef patches loaded here`
             : loading ? "loading from the Atlas — squares can take 20 seconds"
             : "no mapped reef in this view";
    if (failed) text += ` (the Atlas did not answer for ${failed} square${failed > 1 ? "s" : ""})`;
    setLayerState(cfg.id, text);
  };
  map.on("zoomend", state);
  map.on("idle", state);
  map.on("moveend", () => coralFailures.set(cfg.id, 0));
  state();
  applyVisibility(cfg.id);
  buildLegend();
}

// Fill and outline, on whatever layer name the tiles use. Called again if the
// first tile names its layer differently from the config.
function addCoralShapes(cfg, replace) {
  if (replace) {
    [`${cfg.id}-fill`, `${cfg.id}-line`].forEach((l) => { if (map.getLayer(l)) map.removeLayer(l); });
  }
  // One grey-blue at 38% vanished into the imagery of shallow water, which is
  // itself grey-blue. Each class now has its own colour, strong enough to read
  // over water, with a pale edge. Earthy, and none of them orange or yellow —
  // sand is a pale stone rather than sand-coloured for that reason.
  map.addLayer({
    id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-tiles`, "source-layer": cfg.sourceLayer,
    minzoom: cfg.drawFrom,
    paint: {
      "fill-color": ["match", ["get", "class_name"],
        "Coral/Algae", CORAL_CLASSES["Coral/Algae"],
        "Seagrass", CORAL_CLASSES["Seagrass"],
        "Sand", CORAL_CLASSES["Sand"],
        "Rubble", CORAL_CLASSES["Rubble"],
        "Rock", CORAL_CLASSES["Rock"],
        "Microalgal Mats", CORAL_CLASSES["Microalgal Mats"],
        cfg.colour],
      "fill-opacity": .68,
    },
  });
  map.addLayer({
    id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-tiles`, "source-layer": cfg.sourceLayer,
    minzoom: cfg.drawFrom,
    paint: { "line-color": "rgba(236,231,222,.55)", "line-width": .6 },
  });
  if (replace) applyVisibility(cfg.id);
}

/* ---------- Cerulean, live from its own tiles ---------- */

// Every record as a point, for the zooms where the live shapes are not drawn.
// Built by pipeline/cerulean/harvest_points.py. A merged point says how many
// records it stands for and, like the other layers, withholds the rest.
async function addPointOverview(cfg) {
  const url = `${TILE_BASE}/${cfg.points}.pmtiles`;
  const head = await fetch(url, { method: "HEAD" }).catch(() => null);
  const size = head && head.headers && head.headers.get ? Number(head.headers.get("content-length")) : 0;
  if (!head || !head.ok || !(size > 0)) {
    console.warn(`[culprits] ${cfg.id}: no ${cfg.points}.pmtiles yet — run pipeline/cerulean/harvest_points.py`);
    return;
  }
  const src = `${cfg.id}-points`;
  if (map.getSource(src)) return;
  map.addSource(src, { type: "vector", url: `pmtiles://${url}` });
  map.addLayer({
    id: `${cfg.id}-pt`, type: "circle", source: src, "source-layer": cfg.points,
    maxzoom: cfg.pointsUntil,
    paint: {
      "circle-color": cfg.pointsColour || cfg.colour,
      "circle-opacity": .9, "circle-blur": 0, "circle-stroke-width": 0,
      "circle-radius": ["interpolate", ["linear"], ["zoom"],
        0, ["+", 0.9, ["*", 0.35, ["log10", ["coalesce", ["get", "_count"], 1]]]],
        4, ["+", 1.4, ["*", 0.6, ["log10", ["coalesce", ["get", "_count"], 1]]]],
        8, ["+", 2.4, ["*", 0.9, ["log10", ["coalesce", ["get", "_count"], 1]]]]],
    },
  });
  cfg._points = true;
  // The points carry only an id; a click asks Cerulean for the whole record,
  // so every field it publishes is shown and the points file stays small.
  map.on("click", `${cfg.id}-pt`, async (e) => {
    const claim = e.originalEvent || e;
    if (popupClaimedBy === claim) return;
    popupClaimedBy = claim;
    const p = (e.features && e.features[0] && e.features[0].properties) || {};
    const n = Number(p._count || 1);
    const pop = new maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(e.lngLat);
    if (n > 1 || p.id == null) {
      pop.setHTML(`<b>${n.toLocaleString()} records here</b><div class="meta">Points this close are ` +
        `merged at this zoom. Zoom in to see each one.</div>`).addTo(map);
      return;
    }
    pop.setHTML(`<b>${cfg.name}</b><div class="meta">Reading the record from Cerulean…</div>`).addTo(map);
    try {
      const r = await fetch(`${CERULEAN}/collections/${cfg.pointsCollection}/items/${encodeURIComponent(p.id)}?bbox-only=true`);
      if (!r.ok) throw new Error(`${r.status}`);
      const rec = (await r.json()).properties || {};
      const rows = Object.keys(rec).filter((k) => !/centerline/i.test(k) && rec[k] !== null && rec[k] !== "")
        .map((k) => `${k.replace(/_/g, " ")}: ${typeof rec[k] === "object" ? JSON.stringify(rec[k]) : rec[k]}`).join("<br>");
      pop.setHTML(`<b>${cfg.name}</b><div class="meta">${rows}</div>` +
        (rec.slick_url ? `<div class="meta"><a href="${rec.slick_url}" target="_blank" rel="noopener">Open in Cerulean</a></div>` : "") +
        `<div class="meta">Placed at the middle of the record's extent. Zoom in for its shape.</div>`);
    } catch (err) {
      pop.setHTML(`<b>${cfg.name}</b><div class="meta">Record ${p.id}. Cerulean did not answer (${err.message}); ` +
        `zoom in to read it from the shapes.</div>`);
    }
  });
  map.on("mouseenter", `${cfg.id}-pt`, () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", `${cfg.id}-pt`, () => (map.getCanvas().style.cursor = ""));
  applyVisibility(cfg.id);
  if (cfg.route === "cerulean") refreshCerulean(cfg).catch(() => {});
}

function addCeruleanLayer(cfg) {
  const base = CERULEAN.replace(/^https:\/\//, "cerulean://");
  map.addSource(`${cfg.id}-tiles`, {
    type: "vector",
    // No date filter: every detection the collection holds.
    tiles: [`${base}/collections/${cfg.collection}/tiles/WebMercatorQuad/{z}/{x}/{y}` +
            `?properties=${cfg.properties.join(",")}`],
    minzoom: cfg.drawFrom, maxzoom: 14,
    attribution: cfg.attribution || "",
  });
  // Same drawing as the Worker version: the slick's shape is the evidence.
  map.addLayer({
    id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-tiles`, "source-layer": "default",
    minzoom: cfg.drawFrom,
    paint: { "fill-color": cfg.colour, "fill-opacity": .38 },
  });
  map.addLayer({
    id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-tiles`, "source-layer": "default",
    minzoom: cfg.drawFrom,
    paint: { "line-color": cfg.colour,
             "line-width": ["interpolate", ["linear"], ["zoom"], 7, .8, 12, 1.6],
             "line-opacity": .85 },
  });

  // Counts, below the zoom where shapes draw: each square shaded by how many
  // slicks it holds. It was a circle at each square's centre, which put the
  // count wherever the centre fell — often on land, reading as a slick there.
  // A shaded square claims only what the count knows: somewhere in this area.
  map.addSource(`${cfg.id}-counts`, { type: "geojson",
    data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: `${cfg.id}-agg`, type: "fill", source: `${cfg.id}-counts`,
    maxzoom: cfg.drawFrom,
    paint: {
      "fill-color": "#C9C2B6",
      // Darker for more, on a log scale: counts run from 1 to over 100,000.
      "fill-opacity": ["interpolate", ["linear"], ["log10", ["max", ["get", "n"], 1]],
                       0, .10, 5, .55],
      "fill-outline-color": "rgba(233,227,216,.45)",
    },
  });
  // Squares holding more than one tile can carry, from the zoom shapes draw.
  map.addSource(`${cfg.id}-caps`, { type: "geojson",
    data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: `${cfg.id}-cap`, type: "line", source: `${cfg.id}-caps`,
    minzoom: cfg.drawFrom,
    paint: { "line-color": "rgba(220,214,198,.8)", "line-width": 1.2,
             "line-dasharray": [3, 2] },
  });

  bindHtmlPopup(`${cfg.id}-agg`, (p) =>
    `<b>${Number(p.n).toLocaleString()} potential slicks</b>` +
    `<div class="meta">Detected somewhere in this shaded square since January 2023, ` +
    `counted live from SkyTruth Cerulean. The shading is the count, not their ` +
    `positions. Zoom to ${cfg.drawFrom} to draw each one.</div>`);
  bindHtmlPopup(`${cfg.id}-cap`, (p) =>
    `<b>${Number(p.n).toLocaleString()} potential slicks in this square</b>` +
    `<div class="meta">One tile carries at most ${CERULEAN_TILE_CAP.toLocaleString()}, ` +
    `so this square shows only some of them. Zoom in here to draw all of them.</div>`);
  // Every field as Cerulean names it. Units are not stated because the API
  // does not state them.
  bindHtmlPopup(`${cfg.id}-fill`, (p) => {
    const rows = cfg.properties
      .filter((k) => k !== "slick_url" && p[k] !== undefined && p[k] !== null && p[k] !== "")
      .map((k) => `${k.replace(/_/g, " ")}: ${p[k]}`).join("<br>");
    return `<b>Potential slick</b>` +
      `<div class="meta">${rows}</div>` +
      `<div class="meta">A radar detection awaiting review, not a confirmed spill.` +
      (p.slick_url ? `<br><a href="${p.slick_url}" target="_blank" rel="noopener">Open in Cerulean</a>` : "") +
      `</div>`;
  });
  applyVisibility(cfg.id);
  buildLegend();
}

// One popup per click, sharing the claim with bindPopup.
function bindHtmlPopup(layerId, html) {
  map.on("click", layerId, (e) => {
    const claim = e.originalEvent || e;
    if (popupClaimedBy === claim) return;
    popupClaimedBy = claim;
    const out = html(e.features[0].properties);
    const pop = new maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(e.lngLat);
    if (out && typeof out.then === "function") {
      // The box's long text is fetched on this first click; say so meanwhile.
      pop.setHTML(`<div class="meta">loading\u2026</div>`).addTo(map);
      out.then((h) => pop.setHTML(h))
        .catch((err) => pop.setHTML(`<div class="meta">could not load this box (${shapeText(err.message)})</div>`));
    } else {
      pop.setHTML(out).addTo(map);
    }
  });
  map.on("mouseenter", layerId, () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", layerId, () => (map.getCanvas().style.cursor = ""));
}

// Square (tile) bounds in lon/lat.
function tileBounds(z, x, y) {
  const n = 2 ** z;
  const lon = (i) => i / n * 360 - 180;
  const lat = (j) => Math.atan(Math.sinh(Math.PI * (1 - 2 * j / n))) * 180 / Math.PI;
  return [lon(x), lat(y + 1), lon(x + 1), lat(y)];
}
function tileIndex(z, lon, lat) {
  const n = 2 ** z;
  const clampLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const x = Math.floor((lon + 180) / 360 * n);
  const r = clampLat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  return [Math.max(0, Math.min(n - 1, x)), Math.max(0, Math.min(n - 1, y))];
}

// Counts are cached for an hour, the same time Cerulean's own responses carry.
const ceruleanCounts = new Map();     // "id z/x/y" -> { n, at }
const ceruleanRun = new Map();        // id -> run number, so a late answer is dropped
const COUNT_TTL_MS = 3600 * 1000;
const COUNT_PARALLEL = 4;             // their server is slow; do not queue 30 at once
const COUNT_FROM = 3;                 // wider than this, one total instead of squares

async function ceruleanCount(cfg, z, x, y) {
  const key = `${cfg.id} ${z}/${x}/${y}`;
  const hit = ceruleanCounts.get(key);
  if (hit && Date.now() - hit.at < COUNT_TTL_MS) return hit.n;
  const [w, s, e, n] = tileBounds(z, x, y).map((v) => v.toFixed(5));
  const url = `${CERULEAN}/collections/${cfg.collection}/items?bbox=${w},${s},${e},${n}&limit=0`;
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status}`);
      const matched = (await r.json()).numberMatched;
      if (typeof matched !== "number") throw new Error("no count returned");
      ceruleanCounts.set(key, { n: matched, at: Date.now() });
      return matched;
    } catch (err) {
      if (attempt >= 1) throw err;
    }
  }
}

// One number for the whole collection, asked once per page view.
const ceruleanTotals = new Map();     // id -> number, or a pending promise
async function ceruleanTotal(cfg) {
  const url = `${CERULEAN}/collections/${cfg.collection}/items?limit=0`;
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status}`);
      const matched = (await r.json()).numberMatched;
      if (typeof matched !== "number") throw new Error("no count returned");
      return matched;
    } catch (err) {
      if (attempt >= 1) throw err;
    }
  }
}

async function refreshCerulean(cfg) {
  if ((visibility.get(cfg.id) || "visible") !== "visible") return;   // off: ask nothing
  const counts = map.getSource(`${cfg.id}-counts`);
  const caps = map.getSource(`${cfg.id}-caps`);
  if (!counts || !caps) return;

  // At world view there are no squares. Four of them covered the planet, each
  // shaded near full by tens of thousands of slicks — a grey wash with a cross
  // where their edges met — and each waited on Cerulean's slowest query. One
  // total says what is true at that scale without drawing anything misleading.
  // From zoom 3 the squares are small enough to say something, and each is
  // counted live rather than estimated.
  // With every slick drawn as a point, the counted squares are not needed.
  if (cfg._points && map.getZoom() < cfg.drawFrom) {
    const empty = { type: "FeatureCollection", features: [] };
    counts.setData(empty);
    caps.setData(empty);
    setLayerState(cfg.id, `every detection as a point — shapes draw from zoom ${cfg.drawFrom}`);
    return;
  }
  if (map.getZoom() < COUNT_FROM) {
    const empty = { type: "FeatureCollection", features: [] };
    counts.setData(empty);
    caps.setData(empty);
    const total = ceruleanTotals.get(cfg.id);
    if (typeof total === "number") {
      setLayerState(cfg.id, `${total.toLocaleString()} potential slicks since January 2023 — ` +
                            `zoom in to ${COUNT_FROM} to count them by area, ${cfg.drawFrom} to draw them`);
    } else {
      setLayerState(cfg.id, `zoom in to ${COUNT_FROM} to count them by area`);
      if (total === undefined) {
        ceruleanTotals.set(cfg.id, ceruleanTotal(cfg).then(
          (n) => { ceruleanTotals.set(cfg.id, n); refreshCerulean(cfg); },
          () => { ceruleanTotals.set(cfg.id, null); }));
      }
    }
    return;
  }
  const run = (ceruleanRun.get(cfg.id) || 0) + 1;
  ceruleanRun.set(cfg.id, run);

  // Squares are the same tiles MapLibre requests, so a marked square is exactly
  // a tile that was cut off. Past zoom 12 the squares stop shrinking, which
  // keeps the number of count requests down; a zoom-12 square is 10 km.
  const b = map.getBounds();
  const wide = map.getZoom() < cfg.drawFrom;
  const z = Math.max(1, Math.min(12, Math.floor(map.getZoom()) + (wide ? 1 : 0)));
  const [x0, y0] = tileIndex(z, Math.max(b.getWest(), -180), b.getNorth());
  const [x1, y1] = tileIndex(z, Math.min(b.getEast(), 180), b.getSouth());
  const cells = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cells.push([x, y]);
  if (cells.length > 64) { setLayerState(cfg.id, "zoom in a little to count"); return; }

  setLayerState(cfg.id, "counting…");
  const results = [];
  let failed = 0, next = 0;
  await Promise.all(Array.from({ length: COUNT_PARALLEL }, async () => {
    while (next < cells.length) {
      const [x, y] = cells[next++];
      try { results.push({ x, y, n: await ceruleanCount(cfg, z, x, y) }); }
      catch (_) { failed++; }
    }
  }));
  if (ceruleanRun.get(cfg.id) !== run) return;   // the map moved on

  const points = [], over = [];
  let total = 0;
  for (const { x, y, n } of results) {
    total += n;
    const [w, s, e, nn] = tileBounds(z, x, y);
    if (n > 0) points.push({ type: "Feature", properties: { n },
      geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, nn], [w, nn], [w, s]]] } });
    if (n > CERULEAN_TILE_CAP) over.push({ type: "Feature", properties: { n },
      geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, nn], [w, nn], [w, s]]] } });
  }
  counts.setData({ type: "FeatureCollection", features: points });
  caps.setData({ type: "FeatureCollection", features: over });

  const drawn = map.getZoom() >= cfg.drawFrom;
  let text = `${total.toLocaleString()} in the squares on screen`;
  if (!drawn) text += ` — shapes draw from zoom ${cfg.drawFrom}`;
  else if (over.length) text += ` — ${over.length} marked square${over.length > 1 ? "s" : ""} ` +
                                 `show only some; zoom in there`;
  else text += ", all drawn";
  if (failed) text += ` (${failed} square${failed > 1 ? "s" : ""} could not be counted)`;
  setLayerState(cfg.id, text);
}

function addLiveLayer(cfg) {
  map.addSource(`${cfg.id}-live`, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  // Not every live source is a set of points.
  //
  // Cerulean returns oil slicks as MultiPolygon, and the slick's shape is the
  // evidence: a long thin streak behind a transiting vessel is what makes the
  // detection a bilge dump rather than a smudge, and SkyTruth's own attribution
  // model reads its linearity and aspect ratio. Collapsing that to a dot would
  // throw away the part a reader can actually judge. Allen Coral's benthic and
  // geomorphic zones are polygons for the same reason — a reef zone has an
  // extent and is not anywhere in particular.
  //
  // A circle layer given polygon geometry does not error. It draws nothing,
  // which reads as a source that returned no data.
  if (cfg.geometry === "polygon") {
    map.addLayer({
      id: `${cfg.id}-fill`,
      type: "fill",
      source: `${cfg.id}-live`,
      paint: {
        "fill-color": cfg.colour,
        // Lower than a point layer's. These overlap each other and the basemap
        // needs to stay readable underneath — a slick over a coastline is the
        // thing you want to see the relationship of.
        "fill-opacity": .38,
      },
    });
    // The outline separately, because at low zoom a slick is a few pixels wide
    // and a fill alone disappears. The line keeps it findable when the fill is
    // sub-pixel.
    map.addLayer({
      id: `${cfg.id}-line`,
      type: "line",
      source: `${cfg.id}-live`,
      paint: {
        "line-color": cfg.colour,
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, .7, 10, 1.6],
        "line-opacity": .85,
      },
    });
    bindPopup(`${cfg.id}-fill`);
    applyVisibility(cfg.id);
    buildLegend();
    return;
  }

  map.addLayer({
    id: `${cfg.id}-pt`,
    type: "circle",
    source: `${cfg.id}-live`,
    paint: {
      "circle-color": cfg.colour,
      "circle-opacity": .75,
      "circle-stroke-color": "#17150F",
      "circle-stroke-width": .6,
      // A location layer draws every point the same size. Encoding magnitude
      // here would say "this farm matters more", which is not what the layer
      // is for, and with 37.7 million points it would read as noise regardless.
      "circle-radius": cfg.uniformRadius
        ? ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 4.5]
        : ["interpolate", ["linear"], ["zoom"], 8, 3.5, 14, 7],
    },
  });
  bindPopup(`${cfg.id}-pt`);
  applyVisibility(cfg.id);
  buildLegend();
}

// Place names go on top of the data rather than under it. Added last, after
// every other layer exists, because MapLibre draws in insertion order and a
// beforeId naming a layer that has not been added yet throws.
function addLabelsOnTop() {
  if (map.getLayer("labels")) return;
  // Skipped rather than thrown if the style did not supply the source. A
  // missing label layer costs place names; a throw here costs every layer
  // added after it, which is a far worse failure for one cosmetic overlay.
  if (typeof map.getSource === "function" && !map.getSource("labels")) return;
  map.addLayer({
    id: "labels", type: "raster", source: "labels",
    paint: { "raster-opacity": .92 },
  });
}

// FAO serves WMTS directly with permissive CORS, so these need no Worker —
// unlike the keyed sources, there is nothing to hide and nothing to proxy.
//
// Note the axes: FAO's template puts TileCol={y} and TileRow={x}, which is the
// reverse of the usual convention. That is what their catalogue publishes, and
// swapping them to "fix" it returns the wrong tiles.
function addWmtsLayer(cfg) {
  map.addSource(`${cfg.id}-tiles`, {
    type: "raster",
    tiles: ["https://data.apps.fao.org/map/wmts/wmts" +
            `?layer=${encodeURIComponent(cfg.wmtsLayer)}` +
            "&tilematrixset=EPSG%3A3857&Service=WMTS&request=GetTile" +
            "&Version=1.0.0&Format=image/png" +
            "&TileMatrix={z}&TileCol={y}&TileRow={x}&layertype=Image"],
    tileSize: 256,
    maxzoom: 10,
    attribution: cfg.attribution || "",
  });
  map.addLayer({
    id: `${cfg.id}-raster`,
    type: "raster",
    source: `${cfg.id}-tiles`,
    paint: { "raster-opacity": 0.8 },
  });
  setLayerState(cfg.id, cfg.unit);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- shapes: countries, regions and lines from the site's maps ---------- */
//
// Built by pipeline/shapes/build_shapes.py into map/data/shapes/<id>.geojson and
// fetched only when a layer is first ticked. One file can hold areas, lines and
// points together, so each is drawn by its own layer. Where the source map
// coloured a shape, that colour (softened at build time) is used; otherwise the
// layer's own colour.
function shapeText(v) {
  return String(v == null ? "" : v).replace(/<[^>]*>/g, " ").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\s+/g, " ").trim();
}
async function addShapesLayer(cfg) {
  const url = cfg.dataUrl || `${DATA_BASE}/shapes/${cfg.id}.geojson`;
  let data;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} at ${url}`);
    data = await r.json();
  } catch (e) {
    setLayerState(cfg.id, `not built yet (${e.message})`);
    console.error(`[culprits] ${cfg.id}: ${e.message}`);
    return;
  }
  const source = `${cfg.id}-shapes`;
  map.addSource(source, { type: "geojson", data, attribution: cfg.attribution || "" });
  const colour = ["coalesce", ["get", "_map_colour"], cfg.colour];
  const areas = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
  const lines = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source, filter: areas,
    paint: { "fill-color": colour, "fill-opacity": 0.42 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source,
    filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], false, true],
    paint: { "line-color": colour, "line-opacity": 0.85,
             "line-width": ["case", lines, 1.6, 0.6] } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source,
    filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
    paint: { "circle-color": colour, "circle-radius": 4,
             "circle-stroke-width": 0.6, "circle-stroke-color": "#17150F" } });
  const render = (p) => {
    const title = p.name || p.country || p.title || cfg.name;
    const skip = new Set(["name", "country", "title", "list", "from_the_map", "entries"]);
    const rows = Object.entries(p).filter(([k, v]) => !k.startsWith("_") && !skip.has(k) && v !== "" && v != null)
      .map(([k, v]) => `${shapeText(k.replace(/[_.]/g, " "))}: ${shapeText(v)}`);   // every field, in full
    const said = p.from_the_map ? shapeText(p.from_the_map).slice(0, 1200) : "";
    const list = p.list ? String(p.list).split("\n") : [];
    const shown = list.slice(0, 40).map((l) => shapeText(l).slice(0, 300));
    return `<b>${shapeText(title)}</b>` +
      (said ? `<div class="meta">${said}</div>` : "") +
      (rows.length ? `<div class="meta">${rows.join("<br>")}</div>` : "") +
      (shown.length ? `<div class="meta">${Number(p.entries || list.length).toLocaleString()} entries:<br>` +
        shown.join("<br>") + (list.length > 40 ? `<br>…and ${(list.length - 40).toLocaleString()} more in the source file` : "") +
        `</div>` : "");
  };
  // A layer built with its long text kept apart reads it on the first click.
  const popup = (p) => (data.details && p._k != null
    ? loadShapeDetails(url).then((d) => render(Object.assign({}, p, d[p._k] || {})))
    : render(p));
  bindHtmlPopup(`${cfg.id}-fill`, popup);
  bindHtmlPopup(`${cfg.id}-line`, popup);
  bindHtmlPopup(`${cfg.id}-pt`, popup);
  setLayerState(cfg.id, `${data.features.length.toLocaleString()} ${cfg.unit}`);
  applyVisibility(cfg.id);
  buildLegend();
}

const shapeDetails = new Map();
function loadShapeDetails(url) {
  const at = url.replace(/\.geojson$/, ".details.json");
  if (!shapeDetails.has(at)) {
    const p = fetch(at).then((r) => { if (!r.ok) throw new Error(`${r.status} at ${at}`); return r.json(); });
    p.catch(() => shapeDetails.delete(at));   // a failed load may be retried
    shapeDetails.set(at, p);
  }
  return shapeDetails.get(at);
}

/* ---------- the site's own maps, each shown as its own map ---------- */

// Built by pipeline/sitemaps/build_boxes.py. Two files per map:
//   <id>.places.geojson  every place, with the marker's own size and colour
//                        (softened) and the overlay it belongs to, if any
//   <id>.boxes.json      each place's popup as the map wrote it, the map's own
//                        stylesheets scoped to its boxes, and the elements the
//                        map sits inside on its page
// The places load when the row is ticked. The boxes load on the first click.
const SITEMAP_LAYERS = new Set();       // map layer ids, for the click list
const sitemapBoxes = new Map();         // map id -> Promise of its boxes file

function sitemapBoxesUrl(cfg) {
  return cfg.dataUrl.replace(/\.places\.geojson$/, ".boxes.json");
}

async function addSitemapLayer(cfg, given) {
  let data = given;
  if (!data) try {
    const r = await fetch(cfg.dataUrl);
    if (!r.ok) throw new Error(`${r.status} at ${cfg.dataUrl}`);
    data = await r.json();
  } catch (e) {
    setLayerState(cfg.id, `not built yet (${e.message})`);
    console.error(`[culprits] ${cfg.id}: ${e.message}`);
    return;
  }
  const source = `${cfg.id}-places`;
  map.addSource(source, { type: "geojson", data });
  const colour = ["coalesce", ["get", "c"], cfg.colour];
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source,
    filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
    paint: { "fill-color": colour, "fill-opacity": 0.35 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source,
    filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
    paint: { "line-color": colour, "line-opacity": 0.8,
             "line-width": ["min", ["coalesce", ["get", "w"], 2], 4] } });
  // An area on a world map is often a fraction of a pixel. PalmWatch's mill
  // concessions are tens of hectares: at the widest view they drew as nothing.
  // So an area also gets an edge, which shows as a mark even where the fill is
  // smaller than a pixel. Nothing is added: the edge is the area's own
  // boundary and carries the area's own record.
  map.addLayer({ id: `${cfg.id}-edge`, type: "line", source,
    filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
    paint: { "line-color": colour, "line-opacity": 0.9,
             "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.8, 8, 1.2] } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source,
    filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
    paint: {
      "circle-color": colour,
      // The map's own marker size, a little smaller at world zoom so a
      // crowded map does not merge into one blot.
      "circle-radius": ["interpolate", ["linear"], ["zoom"],
        1, ["*", 0.6, ["coalesce", ["get", "r"], 6]],
        6, ["coalesce", ["get", "r"], 6]],
      "circle-stroke-color": ["coalesce", ["get", "s"], "#17150F"],
      "circle-stroke-width": ["min", ["coalesce", ["get", "w"], 0.8], 3],
      "circle-opacity": ["coalesce", ["get", "o"], 0.85],
    } });
  // The middle of each area, drawn wider out than an area can be seen at.
  const areas = (data.features || []).filter((f) => f.geometry && /Polygon$/.test(f.geometry.type));
  if (areas.length) {
    const middleOf = (g) => {
      const pts = [];
      const walk = (c) => { if (c && typeof c[0] === "number") pts.push(c); else if (Array.isArray(c)) c.forEach(walk); };
      walk(g.coordinates);
      if (!pts.length) return null;
      return [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
    };
    const feats = [];
    for (const f of areas) {
      const at = middleOf(f.geometry);
      if (at) feats.push({ type: "Feature", properties: f.properties || {}, geometry: { type: "Point", coordinates: at } });
    }
    map.addSource(`${cfg.id}-areapt-src`, { type: "geojson", data: { type: "FeatureCollection", features: feats } });
    map.addLayer({ id: `${cfg.id}-areapt`, type: "circle", source: `${cfg.id}-areapt-src`,
      maxzoom: cfg.areasFrom || 7,
      paint: { "circle-color": colour, "circle-opacity": 0.85,
               "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.2, 6, 3.6],
               "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5 } });
  }
  if (Array.isArray(data.filters) && data.filters.length) {
    sitemapFilters.set(cfg.id, {
      filters: data.filters,
      picked: data.filters.map(() => new Set()),
      base: {
        [`${cfg.id}-fill`]: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
        [`${cfg.id}-line`]: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
        [`${cfg.id}-pt`]: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
        [`${cfg.id}-edge`]: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
      },
    });
    sitemapChipRows(cfg);
    siteTypeSync(cfg);      // types ticked before the layer was built
  }
  if (Array.isArray(data.colourings) && data.colourings.length) {
    sitemapColourings.set(cfg.id, { list: data.colourings, pick: 0, year: {} });
    sitemapColourRow(cfg);
    applySitemapColouring(cfg.id);
  }
  for (const kind of ["fill", "line", "pt", "edge", "areapt"]) {
    const id = `${cfg.id}-${kind}`;
    if (!map.getLayer(id)) continue;
    SITEMAP_LAYERS.add(id);
    map.on("click", id, (e) => openSitemapClick(e));
    map.on("mouseenter", id, (e) => { map.getCanvas().style.cursor = "pointer"; showSitemapTooltip(e); });
    map.on("mousemove", id, (e) => showSitemapTooltip(e));
    map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; hideSitemapTooltip(); });
  }
  // The map's own overlays (from its layer control), as chips under its row.
  if (Array.isArray(data.overlays) && data.overlays.length) {
    cfg.facet = { property: "ov", label: "layer", values: data.overlays };
  }
  const n = data.features.length;
  setLayerState(cfg.id, `${n.toLocaleString()} ${cfg.unit}`);
  applyVisibility(cfg.id);
  buildLegend();
}

function loadSitemapBoxes(cfg) {
  if (!sitemapBoxes.has(cfg.id)) {
    const p = fetch(sitemapBoxesUrl(cfg))
      .then((r) => { if (!r.ok) throw new Error(`${r.status} at ${sitemapBoxesUrl(cfg)}`); return r.json(); })
      .then((b) => { injectSitemapStyles(cfg, b); return b; });
    p.catch(() => sitemapBoxes.delete(cfg.id));   // a failed load may be retried
    sitemapBoxes.set(cfg.id, p);
  }
  return sitemapBoxes.get(cfg.id);
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Leaflet's own popup and tooltip rules, as every one of these maps loaded
// them. The scope is wrapped in :where() so each rule keeps Leaflet's own
// weight, and the map's stylesheet, added after, settles ties as it does on
// the map's page. index.html's popup rules skip these boxes (patched there).
const LEAFLET_BOX_CSS = `
:where(.wtyg-leaflet) *{box-sizing:content-box}
:where(.wtyg-leaflet) .leaflet-container{font-family:"Helvetica Neue",Arial,Helvetica,sans-serif;font-size:12px;font-size:.75rem;line-height:1.5}
:where(.wtyg-leaflet) .leaflet-container a{color:#0078A8}
:where(.wtyg-leaflet) .leaflet-popup{position:relative;text-align:center;margin-bottom:20px}
:where(.wtyg-leaflet) .leaflet-popup-content-wrapper{padding:1px;text-align:left;border-radius:12px}
:where(.wtyg-leaflet) .leaflet-popup-content{margin:13px 24px 13px 20px;line-height:1.3;font-size:13px;font-size:1.08333em;min-height:1px}
:where(.wtyg-leaflet) .leaflet-popup-content p{margin:1.3em 0}
:where(.wtyg-leaflet) .leaflet-popup-tip-container{width:40px;height:20px;position:absolute;left:50%;margin-top:-1px;margin-left:-20px;overflow:hidden;pointer-events:none}
:where(.wtyg-leaflet) .leaflet-popup-tip{width:17px;height:17px;padding:1px;margin:-10px auto 0;pointer-events:auto;transform:rotate(45deg)}
:where(.wtyg-leaflet) .leaflet-popup-content-wrapper,:where(.wtyg-leaflet) .leaflet-popup-tip{background:white;color:#333;box-shadow:0 3px 14px rgba(0,0,0,.4)}
:where(.wtyg-leaflet) .leaflet-container a.leaflet-popup-close-button{position:absolute;top:0;right:0;border:none;text-align:center;width:24px;height:24px;font:16px/24px Tahoma,Verdana,sans-serif;color:#757575;text-decoration:none;background:transparent}
:where(.wtyg-leaflet) .leaflet-container a.leaflet-popup-close-button:hover,:where(.wtyg-leaflet) .leaflet-container a.leaflet-popup-close-button:focus{color:#585858}
:where(.wtyg-leaflet) .leaflet-popup-scrolled{overflow:auto}
:where(.wtyg-leaflet) .leaflet-tooltip{position:relative;padding:6px;background-color:#fff;border:1px solid #fff;border-radius:3px;color:#222;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.maplibregl-popup.wtyg-box .maplibregl-popup-content,.maplibregl-popup.wtyg-tip .maplibregl-popup-content{background:none;border:0;padding:0;max-width:none;box-shadow:none;border-radius:0}
.maplibregl-popup.wtyg-box .maplibregl-popup-tip,.maplibregl-popup.wtyg-tip .maplibregl-popup-tip{display:none}
.wtyg-pick{font-size:12.5px}
.wtyg-pick .hd{color:var(--dim);font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin:0 0 5px}
.wtyg-pick button{display:block;width:100%;text-align:left;font:inherit;background:none;color:var(--bone);border:0;border-top:1px solid var(--rule);padding:5px 0;cursor:pointer}
.wtyg-pick button:first-of-type{border-top:0}
.wtyg-pick button:hover .pl{text-decoration:underline}
.wtyg-pick .mp{display:block;color:var(--dim);font-size:11.5px}
`;

let leafletBoxCssAdded = false;
function ensureBoxCss() {
  if (!leafletBoxCssAdded) { addStyle(LEAFLET_BOX_CSS, "leaflet-boxes"); leafletBoxCssAdded = true; }
}
function addStyle(text, key) {
  if (!document.head || !document.createElement) return;
  const el = document.createElement("style");
  el.dataset.wtyg = key;
  el.textContent = text;
  document.head.appendChild(el);
}

function injectSitemapStyles(cfg, boxes) {
  ensureBoxCss();
  for (const href of boxes.stylesheets || []) {
    if (!document.head || !document.createElement) break;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
  addStyle(boxes.css || "", `map-${cfg.id}`);
}

// Layout only: the map's containers carry their colours and fonts into the box,
// as they do on the map's page, but not their size, border or background.
const NEUTRAL = "display:block;position:relative;inset:auto;width:auto;height:auto;min-width:0;min-height:0;" +
  "max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:none;box-shadow:none;" +
  "overflow:visible;transform:none;opacity:1;filter:none;backdrop-filter:none";

function sitemapBoxHtml(cfg, boxes, box, tooltip) {
  const chain = (boxes.chain && boxes.chain.length ? boxes.chain : [{ tag: "div" }]);
  let open = `<div class="wtyg-map-${cfg.id} wtyg-leaflet" style="${NEUTRAL}">`;
  let close = "</div>";
  chain.forEach((el, i) => {
    const last = i === chain.length - 1;
    const cls = [el.class || "", last ? "leaflet-container" : ""].join(" ").trim();
    open += `<div${cls ? ` class="${escapeHtml(cls)}"` : ""}${el.id ? ` data-wtyg-id="${escapeHtml(el.id)}"` : ""} style="${NEUTRAL}">`;
    close = "</div>" + close;
  });
  let inner;
  if (tooltip) {
    const o = box.to || {};
    inner = `<div class="leaflet-tooltip ${escapeHtml(o.className || "")}">${box.t}</div>`;
  } else {
    const o = box.o || {};
    const maxW = Number(o.maxWidth) || 300, minW = Number(o.minWidth) || 50;
    const maxH = Number(o.maxHeight) || 0;
    inner = `<div class="leaflet-popup ${escapeHtml(o.className || "")}">` +
      `<div class="leaflet-popup-content-wrapper">` +
      `<div class="leaflet-popup-content${maxH ? " leaflet-popup-scrolled" : ""}" style="width:max-content;max-width:${maxW}px;min-width:${minW}px${maxH ? `;max-height:${maxH}px;overflow:auto` : ""}">${box.h}</div></div>` +
      `<div class="leaflet-popup-tip-container"><div class="leaflet-popup-tip"></div></div>` +
      `<a class="leaflet-popup-close-button" role="button" aria-label="Close popup" href="#close"><span aria-hidden="true">&#215;</span></a>` +
      `</div>`;
  }
  return open + inner + close;
}

function sitemapHits(e) {
  const layers = [...SITEMAP_LAYERS].filter((id) => map.getLayer(id) &&
    (map.getLayoutProperty ? map.getLayoutProperty(id, "visibility") !== "none" : true));
  const p = e.point || { x: 0, y: 0 };
  const feats = map.queryRenderedFeatures
    ? map.queryRenderedFeatures([[p.x - 4, p.y - 4], [p.x + 4, p.y + 4]], { layers })
    : (e.features || []);
  const seen = new Set(), hits = [];
  for (const f of feats) {
    const layer = (f.layer && f.layer.id) || "";
    const mapId = layer.replace(/-(pt|line|fill)$/, "");
    const k = f.properties && f.properties.k;
    if (!k || seen.has(mapId + "|" + k)) continue;
    seen.add(mapId + "|" + k);
    const cfg = childById(mapId);
    if (cfg) hits.push({ cfg, props: f.properties, geometry: f.geometry });
  }
  return hits;
}

function placeOf(hit, e) {
  const g = hit.geometry;
  return g && g.type === "Point" ? g.coordinates : e.lngLat;
}

async function openSitemapBox(hit, at) {
  let boxes;
  try { boxes = await loadSitemapBoxes(hit.cfg); }
  catch (err) {
    new maplibregl.Popup({ closeButton: true, maxWidth: "280px" }).setLngLat(at)
      .setHTML(`<b>${escapeHtml(hit.cfg.name)}</b><div class="meta">This map's boxes could not be loaded (${escapeHtml(err.message)}).</div>`).addTo(map);
    return;
  }
  const box = boxes.boxes && boxes.boxes[hit.props.k];
  if (!box || !box.h) return;
  hideSitemapTooltip();
  const popup = new maplibregl.Popup({ closeButton: false, className: "wtyg-box", maxWidth: "none", anchor: "bottom", offset: 4 })
    .setLngLat(at).setHTML(sitemapBoxHtml(hit.cfg, boxes, box, false)).addTo(map);
  const el = popup.getElement && popup.getElement();
  if (el) {
    el.addEventListener("click", (ev) => {
      const x = ev.target.closest && ev.target.closest(".leaflet-popup-close-button");
      if (x) { ev.preventDefault(); popup.remove(); }
    });
  }
}

const PICK_SPLIT_ZOOM = 6;
function openSitemapClick(e) {
  const claim = e.originalEvent || e;
  if (popupClaimedBy === claim) return;
  let hits = sitemapHits(e).filter((h) => h.props.p);
  // A place drawn over a line or an area is what the click meant, as on the
  // maps themselves, where the marker sits on top.
  if (hits.some((h) => h.geometry && h.geometry.type === "Point")) {
    hits = hits.filter((h) => h.geometry && h.geometry.type === "Point");
  }
  if (!hits.length) return;
  // A list of places is offered only where their markers sit on top of one
  // another: wide out, where nearby places merge on the screen. From zoom
  // PICK_SPLIT_ZOOM they have come apart, so the click opens the place nearest
  // to it; only places at the very same spot still share a list.
  if (hits.length > 1 && map.getZoom() >= PICK_SPLIT_ZOOM && e.point && map.project) {
    const px = (h) => { const g = h.geometry; if (!g || g.type !== "Point") return null; const q = map.project(g.coordinates); return [q.x, q.y]; };
    const d = (h) => { const q = px(h); return q ? Math.hypot(q[0] - e.point.x, q[1] - e.point.y) : 1e9; };
    hits.sort((a, b) => d(a) - d(b));
    const first = px(hits[0]);
    hits = first ? hits.filter((h) => { const q = px(h); return q && Math.hypot(q[0] - first[0], q[1] - first[1]) < 1.5; }) : [hits[0]];
  }
  popupClaimedBy = claim;
  ensureBoxCss();
  if (hits.length === 1) {
    // A layer that marks whole places (a city) zooms in to it when clicked
    // from further out, then opens its box.
    const z = hits[0].cfg.zoomTo, at = placeOf(hits[0], e);
    if (z && map.getZoom() < z - 0.5 && typeof map.flyTo === "function") {
      map.flyTo({ center: at, zoom: z, duration: 1600 });
      map.once("moveend", () => openSitemapBox(hits[0], at));
      return;
    }
    openSitemapBox(hits[0], at);
    return;
  }
  const rows = hits.map((h, i) =>
    `<button type="button" data-hit="${i}"><span class="pl">${escapeHtml(h.props.n || "Unnamed place")}</span>` +
    `<span class="mp">${escapeHtml(h.cfg.name)}</span></button>`).join("");
  const list = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
    .setLngLat(e.lngLat).setHTML(`<div class="wtyg-pick"><div class="hd">${hits.length} places here</div>${rows}</div>`).addTo(map);
  const el = list.getElement && list.getElement();
  if (el) {
    el.addEventListener("click", (ev) => {
      const b = ev.target.closest && ev.target.closest("[data-hit]");
      if (!b) return;
      const hit = hits[Number(b.dataset.hit)];
      list.remove();
      openSitemapBox(hit, placeOf(hit, e));
    });
  }
}

// Leaflet shows a tooltip on hover; so does this, for places whose map gave one.
let sitemapTip = null, sitemapTipKey = null;
function hideSitemapTooltip() {
  if (sitemapTip) sitemapTip.remove();
  sitemapTip = null; sitemapTipKey = null;
}
async function showSitemapTooltip(e) {
  const hit = sitemapHits(e).find((h) => h.props.t);
  if (!hit) { hideSitemapTooltip(); return; }
  const key = hit.cfg.id + "|" + hit.props.k;
  if (key === sitemapTipKey) return;
  sitemapTipKey = key;
  let boxes;
  try { boxes = await loadSitemapBoxes(hit.cfg); } catch (err) { return; }
  const box = boxes.boxes && boxes.boxes[hit.props.k];
  if (!box || !box.t || sitemapTipKey !== key) return;
  if (sitemapTip) sitemapTip.remove();
  sitemapTip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "wtyg-tip", maxWidth: "none", anchor: "bottom", offset: 8 })
    .setLngLat(placeOf(hit, e)).setHTML(sitemapBoxHtml(hit.cfg, boxes, box, true)).addTo(map);
}

/* ---------- raster tile layers, via the Worker ---------- */

// A continuous field rather than a set of located things. There is nothing to
// cluster and nothing to debounce: MapLibre asks for the tiles the viewport
// covers, the Worker caches them at the edge, and panning back over ground
// already seen costs nothing.
function addTileLayer(cfg) {
  map.addSource(`${cfg.id}-tiles`, {
    type: "raster",
    // tilePath lets several layers share one Worker route, distinguished by
    // tileQuery — the three alert layers are the same endpoint with different
    // datasets and windows behind it.
    tiles: [((cfg.clipToBounds && cfg.bounds) || cfg.recolor
              ? WORKER.replace(/^https:\/\//,
                  `latclip://${cfg.clipToBounds && cfg.bounds ? cfg.bounds[1] : -90},` +
                  `${cfg.clipToBounds && cfg.bounds ? cfg.bounds[3] : 90}` +
                  `${cfg.recolor ? "," + cfg.recolor.slice(1) : ""}/`)
              : WORKER) +
            `/${cfg.tilePath || cfg.id + "_tile"}/{z}/{x}/{y}` +
            (cfg.tileQuery ? `?${cfg.tileQuery}` : "")],
    tileSize: 256,
    // Past its maxzoom MapLibre scales the last tiles up rather than asking for
    // tiles the source does not serve — which would be a 400 on every one.
    maxzoom: cfg.tileMaxZoom || 12,
    // Declared coverage. Without this the server answers outside the product's
    // extent with a non-transparent tile, and the map paints a wash over half
    // the planet that a reader has no reason to read as "no data".
    ...(cfg.bounds ? { bounds: cfg.bounds } : {}),
    attribution: cfg.attribution || "",
  });

  // Added here, synchronously, while the pmtiles layers are still awaiting
  // their HEAD requests — so the circles land on top of the heatmap rather than
  // under it. beforeId is not used because the layers it would name may not
  // exist yet, and MapLibre throws on a beforeId that is missing.
  map.addLayer({
    id: `${cfg.id}-raster`,
    type: "raster",
    source: `${cfg.id}-tiles`,
    paint: {
      // The ramp's own lowest step is fully transparent, so empty ocean stays
      // empty; this only softens the painted cells against the basemap.
      // Recoloured alerts are lighter wide out, where a month of them over a
      // continent would otherwise fill it, and full strength from zoom 8.
      "raster-opacity": cfg.recolor
        ? ["interpolate", ["linear"], ["zoom"], 2, 0.5, 8, 0.85] : 0.85,
      // A display transform on somebody else's palette.
      //
      // The alert tiles are rendered by GFW's own server with render_type=
      // true_color, so their colour is not ours to set at source. When that
      // palette lands on a hue this map does not use — bright blue over the
      // tropics — the only lever on this side is to rotate it. That changes how
      // the tiles look and nothing about which pixels are alerts.
      //
      // rasterAdjust is per layer and optional. hue-rotate is in degrees; if a
      // layer still reads wrong, that one number is what to turn.
      ...(cfg.rasterAdjust || {}),
    },
  });

  setLayerState(cfg.id, cfg.unit);
  applyVisibility(cfg.id);
  buildLegend();
}


/* ---------- legend ---------- */
//
// What the colours mean, for the layers currently drawn. Rebuilt on every
// toggle so it can never name a layer that is not on the map — a legend that
// drifts from what is displayed is worse than no legend, because a reader
// trusts it.
function buildLegend() {
  const box = document.getElementById("legend");
  if (!box) return;

  const shown = [];
  for (const cfg of LAYERS) {
    if (!cfg.ready) continue;
    if ((visibility.get(cfg.id) || "visible") !== "visible") continue;
    shown.push(cfg);
  }
  for (const g of (typeof GROUPS !== "undefined" ? GROUPS : [])) {
    for (const child of g.children) {
      if ((visibility.get(child.id) || "none") === "visible") shown.push(child);
    }
  }

  if (!shown.length) { box.hidden = true; return; }
  box.hidden = false;

  // Each line takes a tick of its own, left of its colour, so a layer can be
  // put away from the box that says it is showing rather than by finding its
  // row again in the layers list.
  const rows = shown.map((c) =>
    `<div class="lg-row"><input type="checkbox" class="lg-on" data-lg="${escapeHtml(c.id)}" checked ` +
    `aria-label="Hide ${escapeHtml(c.name)}" title="Hide this layer">` +
    `<span class="lg-sw" style="background:${c.colour}"></span>` +
    `<span class="lg-nm">${c.name}</span>` +
    `<span class="lg-un">${c.unit || ""}</span></div>`).join("");

  box.innerHTML =
    `<div class="lg-hd">Showing</div>${rows}` +
    `<div class="lg-rule"></div>` +
    `<div class="lg-row"><span class="lg-sw lg-hollow"></span>` +
    `<span class="lg-nm">hollow</span>` +
    `<span class="lg-un">no site coordinate published</span></div>`;
  // The layers box holds the truth; unticking here unticks the row there, and
  // everything that follows from that happens as it always did.
  if (!box.dataset.wired) {
    box.dataset.wired = "1";
    box.addEventListener("change", (e) => {
      const i = e.target && e.target.closest && e.target.closest("[data-lg]");
      if (!i) return;
      const row = document.querySelector(`[data-layer="${i.dataset.lg}"]`);
      if (!row) return;
      row.checked = i.checked;
      row.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
}

/* ---------- shared ---------- */

// One popup per click, however many layers were hit.
//
// bindPopup registers a handler per layer, and MapLibre fires every one whose
// features are under the cursor. Two layers over the same place — the live EPA
// route and the harvested archive, say — therefore opened two popups, the
// second overlapping the first.
//
// Keyed on the browser's own event object rather than a timestamp: two handlers
// for one click receive the same originalEvent, and two genuinely separate
// clicks never do, however fast they come.
let popupClaimedBy = null;

function bindPopup(layerId) {
  map.on("click", layerId, (e) => {
    const claim = e.originalEvent || e;
    if (popupClaimedBy === claim) return;
    popupClaimedBy = claim;

    const p = e.features[0].properties;
    const count = Number(p._count || 1);
    // Some layers genuinely have no magnitude — a head office, a trade body,
    // a facility record with no release figure. Rather than announce the
    // absence, show what the source does know.
    const detail = Object.entries(p)
      // Every field the source published, not the first six: the cut-off hid
      // most of what each harvested layer knows (a facility's address, country,
      // how its position was found; Trase's capacity, status and export
      // approvals). The box scrolls when the list is long.
      .filter(([k, v]) => k.startsWith("x_") && v !== null && v !== "" &&
                          k !== "x_precision")
      .map(([k, v]) => `${escapeHtml(k.slice(2).replace(/_/g, " "))}: ${escapeHtml(String(v))}`)
      .join("<br>");
    const value = p.value != null && p.value !== ""
      ? `${Number(p.value).toLocaleString()} ${p.unit || ""}`
      : (p.unit || "");

    // A merged feature inherits ONE member's name, operator, country, status
    // and link. The summed value is real; those fields are not facts about the
    // cluster, so they are withheld rather than shown with a caveat.
    const html = count > 1
      ? `<b>${count.toLocaleString()} sites</b>${value}` +
        `<div class="meta">Combined total for this area. Zoom in to see the ` +
        `individual sites and their details.</div>` +
        `<div class="meta">${p.source}<br>${p.licence || ""}</div>`
      : `<b>${p.name || "Unnamed"}</b>${value}` +
        (detail ? `<div class="meta">${detail}</div>` : "") +
        (p.x_precision === "country"
          ? `<div class="meta" style="color:#8F4E40">Plotted at the country ` +
            `centroid — the source has no site coordinate for this one.</div>`
          : p.x_precision === "admin"
          ? `<div class="meta" style="color:#8F4E40">Not a facility. This is an ` +
            `administrative area${p.x_asset_definition ? ` (${p.x_asset_definition})` : ""}` +
            `, plotted at its centroid — the emissions are modelled across the ` +
            `whole unit, not emitted at this point.</div>`
          : p.x_precision === "grid"
          ? `<div class="meta" style="color:#8F4E40">Not a facility. This is a ` +
            `model grid cell${p.x_grid_cell ? ` of about ${p.x_grid_cell}` : ""}` +
            `, plotted at its centre — the emissions are spread across the cell.</div>`
          : p.x_precision === "area"
          ? `<div class="meta" style="color:#8F4E40">Not a facility. This is an ` +
            `area${p.x_asset_definition ? ` (${p.x_asset_definition})` : ""} — ` +
            `paddies, fields or a reservoir — plotted at a single point.</div>`
          : p.x_precision === "segment"
          ? `<div class="meta" style="color:#8F4E40">Not a facility. This is a ` +
            `stretch of road or rail, plotted at one point along it rather than ` +
            `drawn as the line it is.</div>`
          : p.x_precision === "blurred"
          ? `<div class="meta" style="color:#8F4E40">This position has been ` +
            `deliberately coarsened by the source, to about 5 km. Burial ` +
            `locations are withheld because publishing them invites ` +
            `desecration. The mark is a neighbourhood, not a site.</div>`
          : p.x_precision === "locality"
          ? `<div class="meta" style="color:#8F4E40">Placed at the town or village ` +
            `in the registry's address, not at the site. The facility is somewhere ` +
            `in or near that settlement.</div>`
          : p.x_precision === "mobile"
          ? `<div class="meta" style="color:#8F4E40">A vessel, not a site. This ` +
            `position is where it was recorded, not where it stays.</div>`
          : p.x_precision === "unknown"
          ? `<div class="meta" style="color:#8F4E40">The source gives no ` +
            `definition for what this point represents, so it is not shown as a ` +
            `facility.</div>`
          : "") +
        `<div class="meta">${p.source}${p.year ? " · " + p.year : ""}<br>${p.licence || ""}` +
        (p.url ? `<br><a href="${p.url}" target="_blank" rel="noopener">Source record</a>` : "") +
        `</div>`;

    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
      .setLngLat(e.lngLat).setHTML(html).addTo(map);
    // Then every field the source published, from the layer's pieces
    // (map/data/pieces/<source>/, written by the pipeline beside the tiles).
    // A layer with no pieces - one built before they existed, or one too big
    // for them - shows what the tiles carry and nothing more.
    if (count === 1 && p.source && p.id != null && !noPieces.has(p.source)) {
      readPiece(`data/pieces/${p.source}`, p.id).then((piece) => {
        const raw = piece && piece[String(p.id)];
        if (!raw || typeof raw !== "object") return;
        const rows = Object.entries(raw).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length))
          .map(([k, v]) => `<tr><th style="text-align:left;padding-right:8px;vertical-align:top">${escapeHtml(k.replace(/_/g, " "))}</th>` +
            `<td>${escapeHtml(typeof v === "object" ? JSON.stringify(v) : String(v))}</td></tr>`).join("");
        if (rows && popup.isOpen()) popup.setHTML(html + `<div class="meta"><b>Every field the source publishes</b><table>${rows}</table></div>`);
      }).catch(() => noPieces.add(p.source));
    }
  });
  map.on("mouseenter", layerId, () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", layerId, () => (map.getCanvas().style.cursor = ""));
}

function setLayerState(id, text) {
  const el = document.querySelector(`[data-state="${id}"]`);
  if (el) el.textContent = text;
}

// Which facet values are currently shown, per layer. Empty set means all.
// Seeded from defaultValues so a layer with 66 monthly periods opens on one of
// them rather than drawing all 66 stacked on the same point.
const facetState = new Map(
  LAYERS.filter((c) => c.facet && c.facet.defaultValues)
        .map((c) => [c.id, new Set(c.facet.defaultValues)]));

// One request in flight per layer. Global Fishing Watch tokens permit a single
// concurrent report, and panning fires a request per movement — so without
// this the map issues several at once and every one after the first is
// refused with 429.
const inFlight = new Map();

// Panning emits a burst of moveend events. Waiting for the movement to settle
// turns a drag across a country into one request instead of a dozen.
const SETTLE_MS = 600;
let settleTimer = null;
function afterMovement(fn) {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(fn, SETTLE_MS);
}

// Desired visibility per layer, applied whenever its layers exist.
// Seeded from the layer configs so an `off` layer is hidden the moment it is
// added, not after the panel is built.
// Every layer opens unticked; nothing draws until its row is ticked.
for (const c of LAYERS) c.off = true;
const visibility = new Map(LAYERS.filter((c) => c.off).map((c) => [c.id, "none"]));

function applyVisibility(id) {
  const vis = visibility.get(id) || "visible";
  [`${id}-agg`, `${id}-cl`, `${id}-pt`, `${id}-fill`, `${id}-line`, `${id}-raster`, `${id}-world`, `${id}-cap`].forEach((l) => {
    if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
  });
  const cfg = LAYERS.find((l) => l.id === id);
  if (/^climate_trace/.test(id)) scheduleColumns();
  // The points file is asked for the first time the layer is switched on.
  if (cfg && cfg.points && vis === "visible" && !cfg._pointsTried) {
    cfg._pointsTried = true;
    addPointOverview(cfg).catch((e) => console.warn(`[culprits] ${cfg.id} points: ${e.message}`));
  }
  const comp = typeof companions !== "undefined" && companions.get(id);
  if (comp) {
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
  }
  const extra = (cfg || childById(id) || {})._layerIds;
  if (extra) for (const l of extra) if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
  // A row that carries another source inside it switches that one with it.
  // (Rows inside a group, such as Buildings, are found by childById.)
  const rc = cfg || (typeof childById === "function" ? childById(id) : null);
  if (rc && rc.linked) for (const l of rc.linked) { visibility.set(l, vis); if (l !== id) applyVisibility(l); }
  if (rc && typeof rc.afterVisibility === "function") rc.afterVisibility(vis);
  if (cfg && cfg.route === "cerulean" && vis === "visible") {
    refreshCerulean(cfg).catch((e) => setLayerState(id, `unavailable (${e.message})`));
  }
}

function applyFacet(cfg) {
  const chosen = facetState.get(cfg.id);
  const picked = (!chosen || chosen.size === 0)
    ? null
    : ["in", ["get", cfg.facet.property], ["literal", [...chosen]]];
  // `where` defines what the layer IS (climate_trace_cafo is one definition out
  // of a shared archive). The facet narrows within that. Replacing rather than
  // combining would silently turn the CAFO layer back into every source.
  const filter = cfg.where
    ? (picked ? ["all", cfg.where, picked] : cfg.where)
    : picked;
  // Same four ids applyVisibility walks. -fill and -line are here because a
  // polygon layer can carry `where` or a facet just as a point layer can, and
  // a filter that reaches only the circle layers would leave the polygons
  // showing everything while the panel says otherwise — the silent-disagreement
  // failure this function's `where` guard already exists to prevent.
  [`${cfg.id}-agg`, `${cfg.id}-pt`, `${cfg.id}-fill`, `${cfg.id}-line`].forEach((l) => {
    if (map.getLayer(l)) map.setFilter(l, filter);
  });
  const el = document.querySelector(`[data-state="${cfg.id}"]`);
  if (el) {
    el.textContent = (!chosen || chosen.size === 0)
      ? cfg.unit
      : `${cfg.unit} · ${chosen.size} of ${cfg.facet.values.length} ${cfg.facet.label}s`;
  }
}

function facetRow(cfg) {
  const box = document.createElement("div");
  box.className = "facet";
  box.dataset.for = cfg.id;
  const labels = cfg.facet.labels || {};
  box.innerHTML = cfg.facet.values
    .map((v) => `<button class="chip" data-facet="${cfg.id}" data-value="${escapeHtml(v)}" title="${escapeHtml(v)}">${escapeHtml(labels[v] || v)}</button>`)
    .join("") + `<button class="chip reset" data-facet="${cfg.id}" data-value="">all</button>`;
  return box;
}

// Build the parent row and its nested children, collapsed.
//
// Twenty-six children across three groups is more rows than the whole rest of
// the panel. Collapsed by default, the panel reads as four lines rather than
// thirty, and a reader who wants forestry subsectors opens forestry.
//
// The disclosure triangle and the checkbox are separate controls on purpose:
// opening a group must not load eleven archives, and loading one must not
// depend on having opened the group. So the triangle shows and hides rows and
// does nothing else — no layer is created, no request is made.
function groupRows(group) {
  const wrap = document.createElement("div");
  wrap.className = "group";

  const parent = document.createElement("div");
  parent.className = "layer parent";
  // No triangle before the title: the arrow at the end of every row does this
  // now, and two controls for one action on the same row is one too many. The
  // arrow and the tick are still separate - opening a group must not load its
  // layers, and ticking one must not depend on having opened it.
  parent.innerHTML =
    `<input type="checkbox" data-group="${group.id}">` +
    `<span class="swatch" style="background:${group.children[0].colour}"></span>` +
    `<span class="body"><span class="nm">${group.name}</span>` +
    `<span class="un" data-state="${group.id}">` +
    `${group.children.length} layers, loaded on demand</span></span>`;
  wrap.appendChild(parent);

  const kids = document.createElement("div");
  kids.className = "kids";
  kids.dataset.kids = group.id;
  kids.hidden = true;
  group.children.forEach((child) => {
    const row = document.createElement("label");
    row.className = "layer child";
    row.innerHTML =
      `<input type="checkbox" data-layer="${child.id}">` +
      `<span class="swatch" style="background:${child.colour}"></span>` +
      `<span class="body"><span class="nm">${child.name}${liveMark(child)}${siteLink(child.id)}${infoMark(child.note)}</span>` +
      `<span class="un" data-state="${child.id}">not loaded</span></span>`;
    kids.appendChild(row);
  });
  wrap.appendChild(kids);
  return wrap;
}

// Show or hide one group's children. Display only.
function toggleGroup(box, id) {
  const kids = box.querySelector(`[data-kids="${id}"]`);
  if (!kids) return;
  kids.hidden = !kids.hidden;
  const disc = box.querySelector(`[data-disc="${id}"]`);
  if (disc) {
    disc.innerHTML = kids.hidden ? "&#9656;" : "&#9662;";
    disc.setAttribute("aria-expanded", kids.hidden ? "false" : "true");
  }
}

// none / some / all. A checkbox that reads "on" while two of six children are
// showing is the same failure as a cluster popup inheriting one member's name:
// the control states something the map does not show. `indeterminate` is the
// only honest rendering of partial, so it is used rather than approximated.
function syncGroupBox(box, group) {
  for (const g of (group ? [group] : GROUPS)) {
    const parent = box.querySelector(`[data-group="${g.id}"]`);
    if (!parent) continue;
    const on = g.children.filter(
      (c) => (visibility.get(c.id) || "none") === "visible").length;
    parent.checked = on === g.children.length && on > 0;
    parent.indeterminate = on > 0 && on < g.children.length;
    const el = box.querySelector(`[data-state="${g.id}"]`);
    if (el) {
      el.textContent = on === 0
        ? `${g.children.length} archives, loaded on demand`
        : `${on} of ${g.children.length} showing`;
    }
  }
}

// Every group, in panel order. A child id is looked up across all of them, so
// adding a group needs no change to the toggle handler.
// The site's own maps, one layer each. Generated from
// pipeline/sitemaps/registry.json by patch_layers_0917.py; the places and
// popup text are read from each map by pipeline/sitemaps/extract.mjs.
const SITE_MAPS = {
  id: "site_maps",
  name: "Maps made for this site",
  group: true,
  ready: true,
  children: [
    { id: "site_animal_sacrifice", name: "Animal Sacrifice Map", unit: "sites", colour: "#7A4F4A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_animal_sacrifice.places.geojson",
      note: "From the Destruction page's animal sacrifice map." },
    { id: "site_animal_fighting", name: "Animal Fighting Locations Map", unit: "venues", colour: "#84594F", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_animal_fighting.places.geojson",
      note: "From the Destruction page's animal fighting map (maps repo)." },
    { id: "carbon_plumes", name: "Methane and carbon dioxide plumes (Carbon Mapper)", unit: "plumes", colour: "#6D6A5E", route: "carbonmapper", ready: true, lazy: true,
      attribution: '<a href="https://carbonmapper.org" target="_blank" rel="noopener">Carbon Mapper</a>',
      note: "Read live from Carbon Mapper's own data platform: the newest 10,000 plumes it publishes, each with the emission rate measured at that moment, and from zoom 10 each plume's own picture laid where Carbon Mapper say it belongs. The row says how many of the published total it is holding." },
    { id: "site_carbon_mapper_waste", name: "Methane plumes from waste sites \u2014 the set on our own page (Carbon Mapper)", unit: "plume sources", colour: "#6D6A5E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_carbon_mapper_waste.places.geojson",
      note: "From the Destruction page's Carbon Mapper waste-sector map: the hotspots written into that map, not Carbon Mapper's live feed." },
    { id: "site_forest500_soy", name: "Worst soy financial institutions, 2024 (Forest 500)", unit: "financial institutions", colour: "#6B5B4E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_forest500_soy.places.geojson",
      note: "From the Destruction page's Forest 500 map: institutions scoring 2 or less of 94 on soy policy, placed at their headquarters." },
    { id: "site_china_grain", name: "中国粮仓 China Grain Storage", unit: "depots", colour: "#76705C", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_china_grain.places.geojson",
      note: "From the Destruction page's China grain storage map. The page states 205 facilities; this layer carries the positions its map draws." },
    { id: "site_soybean_companies", name: "Soybean Companies", unit: "offices", colour: "#6F7560", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_soybean_companies.places.geojson",
      note: "From the Destruction page's soy companies map (maps repo)." },
    { id: "site_secret_societies", name: "International Military Secret Societies", unit: "organisations", colour: "#5E5A6E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_secret_societies.places.geojson",
      note: "From the On-Planet Invasion page's secret societies map." },
    { id: "site_ufo_pre1900", name: "Pre-1900", unit: "recorded sightings", colour: "#5F6B78", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_ufo_pre1900.places.geojson",
      note: "From the Off-Planet Invasion page's historical sightings archive." },
    { id: "site_central_banks", name: "Central Banks", unit: "banks", colour: "#5C6570", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_central_banks.places.geojson",
      note: "From the Suppression page's central banks map." },
    { id: "site_banking_dynasties", name: "Global Banking Dynasties", unit: "dynasty seats", colour: "#6A5D6B", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_banking_dynasties.places.geojson",
      note: "From the Suppression page's banking dynasties map." },
    { id: "site_export_credit", name: "Export Credit Agencies of the World", unit: "agencies", colour: "#5E6A63", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_export_credit.places.geojson",
      note: "From the Suppression page's export credit agencies map. Its country shading is not carried here, only the agencies." },
    { id: "site_wealth_atlas", name: "The World's Richest Dynasties & Individuals", unit: "families and individuals", colour: "#735E57", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_wealth_atlas.places.geojson",
      note: "From the Suppression page's wealth atlas." },
    { id: "site_food_system", name: "Who Owns the", unit: "companies", colour: "#6E6A55", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_food_system.places.geojson",
      note: "From the Suppression page's food system ownership map." },
    { id: "site_world_advertising", name: "World Advertising 2026 — Companies & Owners", unit: "companies", colour: "#6C5F66", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_world_advertising.places.geojson",
      note: "From the Suppression page's World Advertising 2026 map." },
    { id: "site_world_news", name: "World News 2026 — Outlets & Owners", unit: "outlets and owners", colour: "#626A6F", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_world_news.places.geojson",
      note: "From the Suppression page's World News 2026 map." },
    { id: "site_research_integrity", name: "World Research Integrity 2026 — Who's Breaking Science", unit: "institutions and publishers", colour: "#5F6E6A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_research_integrity.places.geojson",
      note: "From the Suppression page's research integrity map." },
    { id: "site_world_entertainment", name: "World Entertainment 2026 — Companies & Owners", unit: "companies", colour: "#6D5E5A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_world_entertainment.places.geojson",
      note: "From the Suppression page's World Entertainment 2026 map." },
    { id: "site_eyes_network", name: "The Network That Tried to Harness the Eyes to Harvest the World", unit: "places", colour: "#5B6360", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_eyes_network.places.geojson",
      note: "From the Suppression page's sports section network map." },
    { id: "site_animal_tourism", name: "Animal Tourism Atlas", unit: "locations", colour: "#7C6356", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_animal_tourism.places.geojson",
      note: "From the Suppression page's animal tourism atlas." },
    { id: "site_circus", name: "Global Circus & Animal Shows", unit: "venues", colour: "#7A5E61", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_circus.places.geojson",
      note: "From the Suppression page's circus map." },
    { id: "site_animal_racing", name: "Global Animal Racing & Sports", unit: "venues", colour: "#7B6452", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_animal_racing.places.geojson",
      note: "From the Suppression page's animal racing map (maps repo)." },
    { id: "site_rodeo", name: "Global Rodeo & Charreada Map", unit: "events and arenas", colour: "#80665A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_rodeo.places.geojson",
      note: "From the Suppression page's rodeo and charreada map." },
    { id: "site_enslaved_plants", typeRows: true, name: "The Unnecessary Enslavement of Plants 2026", unit: "companies", colour: "#62705A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_enslaved_plants.places.geojson",
      note: "From the Suppression page's plant enslavement map." },
    { id: "site_enslaved_microbes", typeRows: true, name: "The Unnecessary Enslavement of Microorganisms 2026", unit: "companies", colour: "#6A6E62", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_enslaved_microbes.places.geojson",
      note: "From the Suppression page's microorganism enslavement map." },
    { id: "site_insentient", typeRows: true, name: "The Insentient 2026", unit: "companies", colour: "#66625E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_insentient.places.geojson",
      note: "From the Suppression page's map of industries built on things called insentient." },
    { id: "site_subsistence_cultures", name: "Global Subsistence Cultures", unit: "peoples", colour: "#5F7166", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_subsistence_cultures.places.geojson",
      note: "From the Suppression page's subsistence cultures map." },
    { id: "site_self_sufficiency", name: "Why some famous programs aren’t on this map", unit: "programs", colour: "#5E6F5B", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_self_sufficiency.places.geojson",
      note: "From the Solution page's self-sufficiency programs map." },
    { id: "site_environment_law", name: "Environmental law instruments", unit: "legal instruments", colour: "#5A6B72", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_environment_law.pmtiles",
      note: "From the Destruction page's environmental law map (enviro-atlas repo)." },
    { id: "site_cartel_cells", name: "Cartel cells", unit: "cells and sites", colour: "#6A5A58", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_cartel_cells.places.geojson",
      note: "From the Suppression page's cartel cells map (maps repo), with its connecting lines." },
    { id: "site_indigenous_conflicts", name: "Indigenous Environmental Conflicts", unit: "conflicts", colour: "#6B5A4A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_indigenous_conflicts.places.geojson",
      note: "From local-map's Indigenous Environmental Conflicts map (EJAtlas cases, real coordinates)." },
    { id: "enviro_law_by_country", name: "Environmental law by country and region (enviro-atlas)", unit: "countries", colour: "#5A6B72", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/enviro_law_by_country.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "site_earmarked_funding", name: "Earmarked funding to international organisations", unit: "countries", colour: "#6A5E66", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/site_earmarked_funding.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "site_trade_profits", name: "Who captures the profits in global trade (OECD TiVA)", unit: "countries", colour: "#6E6358", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/site_trade_profits.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "site_settler_colonialism", name: "Settler colonialism and native displacement", unit: "territories", colour: "#6B5A52", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/site_settler_colonialism.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "site_social_spheres", name: "The Social Spheres", unit: "bodies and the people between them", colour: "#5E6068", route: "spheres", ready: true, lazy: true,
      page: "https://raw.githubusercontent.com/WelcomeToYourGalaxy/maps/main/social_spheres.html",
      note: "Read live from the map's own page in the maps repo; a click opens the map's own card, run by its own code." },
    { id: "site_environment_law_shapes", name: "Environmental law instruments — areas", unit: "areas", colour: "#5A6B72", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/site_environment_law_shapes.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "site_export_credit_shading", name: "Export credit agencies — country shading", unit: "countries", colour: "#5E6A63", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/site_export_credit_shading.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gov_official_map", name: "How to become a government official", unit: "countries and places", colour: "#5F6A66", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gov_official_map.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "capture_map", name: "Drug underworld and capture map", unit: "places and areas", colour: "#6A5A5E", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/capture_map.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
  ],
};

// The facility files of the five accountability maps, one group per map.
// Generated from pipeline/sitemaps/repo_layers.json by patch_repo_layers.py.
const EXEC_MAP = {
  id: "executive_map_layers",
  name: "Government offices and services",
  group: true,
  ready: true,
  children: [
    { id: "exec_police", name: "Police stations", unit: "stations", colour: "#5C6670", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/exec_police.pmtiles",
      note: "Every row of execmap_local_police.json in WelcomeToYourGalaxy/executive-map, as that map reads it: position, name and link." },
    { id: "exec_townhall", name: "Town halls", unit: "town halls", colour: "#65676A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/exec_townhall.pmtiles",
      note: "Every row of execmap_local_townhall.json in WelcomeToYourGalaxy/executive-map, as that map reads it: position, name and link." },
    { id: "exec_firestation", name: "Fire stations", unit: "stations", colour: "#6E605C", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/exec_firestation.pmtiles",
      note: "Every row of execmap_local_firestation.json in WelcomeToYourGalaxy/executive-map, as that map reads it: position, name and link." },
    { id: "exec_govoffice", name: "Government offices", unit: "offices", colour: "#5F6A66", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/exec_govoffice.pmtiles",
      note: "Every row of execmap_local_govoffice.json in WelcomeToYourGalaxy/executive-map, as that map reads it: position, name and link." },
    { id: "exec_ministry", name: "Ministries and agencies", unit: "offices", colour: "#5A6272", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/exec_ministry.pmtiles",
      note: "Every row of execmap_local_ministry.json in WelcomeToYourGalaxy/executive-map, as that map reads it: position, name and link." },
    { id: "exec_diplomatic", name: "Embassies and consulates", unit: "missions", colour: "#666070", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/exec_diplomatic.pmtiles",
      note: "Every row of execmap_local_diplomatic.json in WelcomeToYourGalaxy/executive-map, as that map reads it: position, name and link." },
    { id: "exec_border", name: "Border posts", unit: "posts", colour: "#60665E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/exec_border.pmtiles",
      note: "Every row of execmap_local_border.json in WelcomeToYourGalaxy/executive-map, as that map reads it: position, name and link." },
    { id: "exec_prison", name: "Prisons (executive map file)", unit: "prisons", colour: "#6A5E62", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/exec_prison.pmtiles",
      note: "Every row of execmap_local_prison.json in WelcomeToYourGalaxy/executive-map, as that map reads it: position, name and link." },
  ],
};

const MONEY_MAP = {
  id: "money_map_layers",
  name: "Banks, tax offices and financial services",
  group: true,
  ready: true,
  children: [
    { id: "fin_bank", name: "Banks", unit: "branches and offices", colour: "#6E5F52", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_bank.pmtiles",
      note: "Every row of moneymap_local_bank.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_taxoffice", name: "Tax offices", unit: "offices", colour: "#735F55", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_taxoffice.pmtiles",
      note: "Every row of moneymap_local_taxoffice.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_govfinance", name: "Government finance offices", unit: "offices", colour: "#6A5D58", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_govfinance.pmtiles",
      note: "Every row of moneymap_local_govfinance.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_financial", name: "Financial services", unit: "offices", colour: "#76655A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_financial.pmtiles",
      note: "Every row of moneymap_local_financial.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_exchange", name: "Currency exchanges", unit: "exchanges", colour: "#6F6358", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_exchange.pmtiles",
      note: "Every row of moneymap_local_exchange.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_insurance", name: "Insurance offices", unit: "offices", colour: "#6B6056", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_insurance.pmtiles",
      note: "Every row of moneymap_local_insurance.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_accountant", name: "Accountants", unit: "offices", colour: "#71645E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_accountant.pmtiles",
      note: "Every row of moneymap_local_accountant.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_remittance", name: "Money transfer offices", unit: "offices", colour: "#6D5C54", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_remittance.pmtiles",
      note: "Every row of moneymap_local_remittance.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_centralbank", name: "Central bank buildings", unit: "buildings", colour: "#665A55", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_centralbank.pmtiles",
      note: "Every row of moneymap_local_centralbank.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_stockexchange", name: "Stock exchanges", unit: "exchanges", colour: "#7A6558", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_stockexchange.pmtiles",
      note: "Every row of moneymap_local_stockexchange.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_auditoffice", name: "Audit offices (money map file)", unit: "offices", colour: "#6C625A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_auditoffice.pmtiles",
      note: "Every row of moneymap_local_auditoffice.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_devbank", name: "Development banks", unit: "offices", colour: "#735E5A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_devbank.pmtiles",
      note: "Every row of moneymap_local_devbank.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
    { id: "fin_mint", name: "Mints", unit: "mints", colour: "#7B6A5E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/fin_mint.pmtiles",
      note: "Every row of moneymap_local_mint.json in WelcomeToYourGalaxy/financial-map, as that map reads it: position, name and link." },
  ],
};

const LEGAL_MAP = {
  id: "legal_map_layers",
  name: "Legal defence and prisoner support",
  group: true,
  ready: true,
  children: [
    { id: "legal_prison", name: "Prisons", unit: "prisons", colour: "#6B5A66", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/legal_prison.pmtiles",
      note: "Every row of legalmap_local_prison.json in WelcomeToYourGalaxy/legal-map, as that map reads it: position, name and link." },
    { id: "legal_courthouse", name: "Courthouses", unit: "courts", colour: "#645C6E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/legal_courthouse.pmtiles",
      note: "Every row of legalmap_local_courthouse.json in WelcomeToYourGalaxy/legal-map, as that map reads it: position, name and link." },
    { id: "legal_publicdefender", name: "Public defenders and prosecutors", unit: "offices", colour: "#6E6070", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/legal_publicdefender.pmtiles",
      note: "Every row of legalmap_local_publicdefender.json in WelcomeToYourGalaxy/legal-map, as that map reads it: position, name and link." },
    { id: "legal_police", name: "Police stations (legal map file)", unit: "stations", colour: "#5E5A68", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/legal_police.pmtiles",
      note: "Every row of legalmap_local_police.json in WelcomeToYourGalaxy/legal-map, as that map reads it: position, name and link." },
    { id: "legal_immigration", name: "Immigration enforcement", unit: "sites", colour: "#705A62", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/legal_immigration.pmtiles",
      note: "Every row of legalmap_local_immigration.json in WelcomeToYourGalaxy/legal-map, as that map reads it: position, name and link." },
    { id: "legal_probation", name: "Probation offices", unit: "offices", colour: "#675E6A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/legal_probation.pmtiles",
      note: "Every row of legalmap_local_probation.json in WelcomeToYourGalaxy/legal-map, as that map reads it: position, name and link." },
    { id: "legal_juvenile", name: "Juvenile detention", unit: "sites", colour: "#72606A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/legal_juvenile.pmtiles",
      note: "Every row of legalmap_local_juvenile.json in WelcomeToYourGalaxy/legal-map, as that map reads it: position, name and link." },
    { id: "legal_by_state", name: "Legal defense resources by state and province", unit: "countries", colour: "#665C6E", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/shapes/legal_by_state.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
  ],
};

const LEG_MAP = {
  id: "legislative_map_layers",
  name: "Parliaments, councils and electoral offices",
  group: true,
  ready: true,
  children: [
    { id: "leg_parliament", name: "Parliaments and legislatures", unit: "buildings", colour: "#5E6B5E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/leg_parliament.pmtiles",
      note: "Every row of legmap_local_parliament.json in WelcomeToYourGalaxy/legislative-map, as that map reads it: position, name and link." },
    { id: "leg_townhall", name: "Town halls (legislative map file)", unit: "town halls", colour: "#626A5F", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/leg_townhall.pmtiles",
      note: "Every row of legmap_local_townhall.json in WelcomeToYourGalaxy/legislative-map, as that map reads it: position, name and link." },
    { id: "leg_audit", name: "Audit offices", unit: "offices", colour: "#5A665C", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/leg_audit.pmtiles",
      note: "Every row of legmap_local_audit.json in WelcomeToYourGalaxy/legislative-map, as that map reads it: position, name and link." },
    { id: "leg_electoral", name: "Electoral offices", unit: "offices", colour: "#65705F", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/leg_electoral.pmtiles",
      note: "Every row of legmap_local_electoral.json in WelcomeToYourGalaxy/legislative-map, as that map reads it: position, name and link." },
    { id: "leg_ombudsman", name: "Ombudsman offices", unit: "offices", colour: "#5F6E64", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/leg_ombudsman.pmtiles",
      note: "Every row of legmap_local_ombudsman.json in WelcomeToYourGalaxy/legislative-map, as that map reads it: position, name and link." },
    { id: "leg_council", name: "Councils", unit: "councils", colour: "#687060", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/leg_council.pmtiles",
      note: "Every row of legmap_local_council.json in WelcomeToYourGalaxy/legislative-map, as that map reads it: position, name and link." },
    { id: "leg_by_state", name: "Legislative resources by state and province", unit: "countries", colour: "#5E6B5E", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/shapes/leg_by_state.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "leg_subnational", name: "Regional governments", unit: "countries", colour: "#62705F", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/shapes/leg_subnational.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "leg_county", name: "County governments", unit: "countries", colour: "#5A665C", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/shapes/leg_county.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "leg_municipal", name: "Municipal governments", unit: "countries", colour: "#65705F", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/shapes/leg_municipal.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "leg_municipal_recover", name: "Municipal governments (recovered list)", unit: "countries", colour: "#687060", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/shapes/leg_municipal_recover.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "leg_laws", name: "Laws by country", unit: "countries", colour: "#5F6E64", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/shapes/leg_laws.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
  ],
};

const JUD_MAP = {
  id: "judicial_map_layers",
  name: "Courts and prisons",
  group: true,
  ready: true,
  children: [
    { id: "jud_courts", name: "Courts", unit: "courts", colour: "#5A6570", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/jud_courts.pmtiles",
      note: "Every row of judicial_facilities.json in WelcomeToYourGalaxy/judicial-map, as that map reads it: position, name and link." },
    { id: "jud_prisons", name: "Prisons and detention (judicial map file)", unit: "facilities", colour: "#655C66", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/tiles/jud_prisons.pmtiles",
      note: "Every row of judicial_facilities.json in WelcomeToYourGalaxy/judicial-map, as that map reads it: position, name and link." },
    { id: "judicial_by_state", name: "Judicial accountability resources by state and province", unit: "countries", colour: "#5E6470", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-gov/shapes/judicial_by_state.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
  ],
};

const MORE_MAPS = {
  id: "more_map_layers",
  name: "Further rows from the same records",
  group: true,
  ready: true,
  children: [
    { id: "slavery_facilities", name: "Courthouses, consulates and labour offices (anti-slavery map)", unit: "facilities", colour: "#6A5E66", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/slavery_facilities.pmtiles",
      note: "Every row of facilities.json in WelcomeToYourGalaxy/anti-slavery-map." },
    { id: "slavery_determinations", name: "Forced labour determinations (anti-slavery map)", unit: "determinations", colour: "#7A5E5E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/slavery_determinations.pmtiles",
      note: "Every row of projects.json in WelcomeToYourGalaxy/anti-slavery-map." },
    { id: "slavery_enforcement", name: "Enforcement outcomes and detections (anti-slavery map)", unit: "records", colour: "#725A60", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/slavery_enforcement.pmtiles",
      note: "Every row of bulk.json in WelcomeToYourGalaxy/anti-slavery-map." },
    { id: "activist_courts", name: "Courts (activist rights map)", unit: "courts", colour: "#5E6070", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/activist_courts.pmtiles",
      note: "Every row of facilities_courts.json in WelcomeToYourGalaxy/activist-rights-map." },
    { id: "activist_police", name: "Police stations (activist rights map)", unit: "stations", colour: "#5A5E68", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/activist_police.pmtiles",
      note: "Every row of facilities_police.json in WelcomeToYourGalaxy/activist-rights-map." },
    { id: "activist_prisons", name: "Prisons (activist rights map)", unit: "prisons", colour: "#665C68", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/activist_prisons.pmtiles",
      note: "Every row of facilities_prisons.json in WelcomeToYourGalaxy/activist-rights-map." },
    { id: "remains_findings", name: "Published aggregate findings (Unearthings)", unit: "findings", colour: "#6A6257", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/remains_findings.pmtiles",
      note: "Every row of findings.json in WelcomeToYourGalaxy/remains." },
    { id: "remains_cemeteries", name: "Cemeteries (Unearthings)", unit: "cemeteries", colour: "#6A6257", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/remains_cemeteries.pmtiles",
      note: "Every row of remains_local_cemetery_*.json.gz in WelcomeToYourGalaxy/remains." },
    { id: "slavery_prevalence", name: "Modern slavery prevalence estimates (anti-slavery map)", unit: "countries", colour: "#735C5E", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/slavery_prevalence.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "slavery_routes", name: "Trafficking routes, country to country (anti-slavery map)", unit: "routes", colour: "#7A6060", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/slavery_routes.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "slavery_trackers", name: "Anti-slavery trackers by country", unit: "countries", colour: "#6C6064", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/slavery_trackers.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "cultivated_meat_laws", name: "Restrictions on cultivated meat (abattoir atlas)", unit: "countries", colour: "#7A5E58", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/cultivated_meat_laws.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
  ],
};

const GMO_MAP = {
  id: "gmo_map_layers",
  name: "Genetic engineering registers",
  group: true,
  ready: true,
  children: [
    { id: "gmo_cultivation", name: "Genetic-engineering cultivation (Genetic engineering map)", unit: "countries and regions", colour: "#6F6A5A", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_cultivation.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gmo_gmofree", name: "GMO-free zones (Genetic engineering map)", unit: "zones", colour: "#5F6E5C", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_gmofree.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gmo_incidents", name: "Contamination incidents (Genetic engineering map)", unit: "countries", colour: "#7A5A55", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_incidents.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gmo_regime", name: "Regulatory regimes (Genetic engineering map)", unit: "regime areas", colour: "#5E6470", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_regime.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gmo_treaties", name: "Biosafety and seed treaties (Genetic engineering map)", unit: "countries", colour: "#665E6C", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_treaties.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gmo_trials", name: "Field trials (Genetic engineering map)", unit: "countries and regions", colour: "#6E6456", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_trials.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
  ],
};

const OTHER_MAPS = {
  id: "other_org_maps",
  name: "Maps made by others",
  group: true,
  ready: true,
  children: [
    { id: "palmwatch", name: "PalmWatch", unit: "palm oil mills", colour: "#87544A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/palmwatch.places.geojson",
      note: "PalmWatch (Inclusive Development International and the University of Chicago Data Science Institute), reread from PalmWatch every day. Each area is a mill's modelled sourcing area, not a property boundary; tree cover loss inside it is not measured as that mill's own clearing." },
    { id: "usda_soybean", name: "Soybean Map Explorer (USDA Foreign Agricultural Service)", unit: "soybean growing areas", colour: "#6F7560", route: "arcgis", ready: true, lazy: true,
      crop: "Soybean", service: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerSoybean/MapServer", attribution: "USDA Foreign Agricultural Service",
      note: "Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." },
    { id: "usda_corn", name: "Corn Map Explorer (USDA Foreign Agricultural Service)", unit: "corn growing areas", colour: "#76705C", route: "arcgis", ready: true, lazy: true,
      crop: "Corn", service: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerCorn/MapServer", attribution: "USDA Foreign Agricultural Service",
      note: "Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." },
    { id: "unep_coral", name: "Warm-water coral reefs (UNEP-WCMC)", unit: "reef areas", colour: "#B06F6A", route: "arcgis", ready: true, lazy: true,
      service: "https://data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/MapServer",
      attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC",
      note: "UNEP-WCMC's Global Distribution of Warm-water Coral Reefs, drawn live by its own map server at every zoom; a click asks it what is there." },
    { id: "mines_global", name: "Mines worldwide (Maus et al. 2022 and OpenStreetMap)", unit: "mine outlines", colour: "#6E5E52", route: "pmshapes", ready: true, lazy: true,
      archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/mining_polygons.pmtiles", polygonLayer: "mines", pointLayer: "mine_points",
      attribution: "Maus et al. 2022; OpenStreetMap contributors; merged by WU Vienna 2024 (ODbL)",
      note: "192,584 mine outlines: Maus et al.'s satellite-traced mining areas merged with OpenStreetMap's mines and quarries (Zenodo 7307210, ODbL), with the tree cover loss inside each from 2000 to 2019. Every mine as a point from the world view, merged where they crowd; outlines from zoom 7." },
    { id: "ejatlas", name: "Environmental justice conflicts (EJAtlas)", unit: "conflicts", colour: "#7A5A55", route: "ejatlas", ready: true, lazy: true,
      api: "https://ejatlas.org/api/v1/conflicts/",
      note: "Every conflict in the EJAtlas, read live from its own data address; each box links the conflict's page." },
    { id: "seas_of_plastic", name: "Seas of Plastic", unit: "stations, trips and ocean areas", colour: "#5E7377", route: "geojsonlive", ready: true, lazy: true,
      files: [{ label: "Stations", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/AllStations.geojson" },
              { label: "Trips", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/AllTrips.geojson" },
              { label: "Oceans", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/Oceans.geojson" }],
      note: "Seas of Plastic's own data files, read live: sampling stations, the trips that took them, and its ocean areas." },
    { id: "final_nail", name: "Fur Farms (Final Nail)", unit: "farms", colour: "#6B5A4A", route: "wpgmza", ready: true, lazy: true,
      api: "https://finalnail.com/wp-json/wpgmza/v1/features/",
      note: "Final Nail's map, read live from its own data address, as it publishes it (names and addresses included)." },
    { id: "nusantara", name: "Nusantara Atlas (TheTreeMap)", unit: "map layers", colour: "#6F7560", route: "wmsmenu", ready: true, lazy: true,
      wms: ["https://map.nusantara-atlas.org/geoserver/atlas-workspace-v3/wms", "https://map.nusantara-atlas.org/geoserver/atlas-workspace-v2/wms"],
      attribution: "Nusantara Atlas, TheTreeMap",
      note: "Every layer Nusantara Atlas's map server publishes, drawn live; its alerts and compliance lists need a login and are not included." },
    { id: "gfw_catalogue", name: "Global Forest Watch / Global Nature Watch: every dataset", unit: "datasets", colour: "#62755F", route: "gfwmenu", ready: true, lazy: true,
      api: "https://data-api.globalforestwatch.org",
      note: "Its whole data catalogue, read live; a dataset draws from its own published tiles when it has them." },
    { id: "coastal_cleanup", name: "Coastal Cleanup (Ocean Conservancy)", unit: "cleanup sites", colour: "#5F6B70", route: "geojsonlive", ready: true, lazy: true,
      files: [{ label: "Cleanups", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/coastal/cleanups.geojson" }],
      note: "Ocean Conservancy's cleanup sites, copied daily by culprits-tiles-more (its server lets only its own site read it)." },
    { id: "atlas_hotspots", name: "Hotspots (Atlas for the End of the World)", unit: "biodiversity hotspots", colour: "#6E5A55", route: "arcgisapp", ready: true, lazy: true,
      item: "ba55aa1bff5447e7b72559b8dc1a0e83", pdfBase: "https://atlas-for-the-end-of-the-world.com/hotspots/",
      // About a kilometre, in degrees: the outlines are tens of megabytes at
      // the survey's own precision and took most of a minute to arrive.
      coarse: 0.01,
      pdfs: [["atlantic_forests", "Atlantic Forest"], ["california_floristic_province", "California Floristic Province"], ["cape_floristic_region", "Cape Floristic Region"], ["caribbean_islands", "Caribbean Islands"], ["caucasus", "Caucasus"], ["cerrado", "Cerrado"], ["chilean_valdivian_forests", "Chilean Winter Rainfall Valdivian Forests"], ["coastal_forests_of_eastern_africa", "Coastal Forests of Eastern Africa"], ["east_melanesian_islands", "East Melanesian Islands"], ["eastern_afromontane", "Eastern Afromontane"], ["forests_of_east_australia", "Forests of Eastern Australia"], ["guinean_forests_of_west_africa", "Guinean Forests of West Africa"], ["himalaya", "Himalaya"], ["horn_of_africa", "Horn of Africa"], ["japan", "Japan"], ["madagascar", "Madagascar & The Indian Ocean Islands"], ["madrean_woodlands", "Madrean Pine-Oak Woodlands"], ["maputaland_pondoland_albany", "Maputaland Pondoland Albany"], ["mediterranean_basin", "Mediterranean Basin"], ["mesoamerica", "Mesoamerica"], ["mountains_of_central_asia", "Mountains of Central Asia"], ["mountains_of_southwest_china", "Mountains of Southwest China"], ["new_caledonia", "New Caledonia"], ["new_zealand", "New Zealand"], ["philippines", "Philippines"], ["north_american_coastal_plain", "North American Coastal Plain"], ["southwest_australia", "Southwest Australia"], ["succulent_karoo", "Succulent Karoo"], ["sundaland", "Sundaland"], ["tropical_andes", "Tropical Andes"], ["wallacea", "Wallacea"], ["western_ghats_sri_lanka", "Western Ghats & Sri Lanka"]],
      note: "The 36 biodiversity hotspots, outlined live from Conservation International's Biodiversity Hotspots 2016.1 (CC BY 3.0), the boundaries the Atlas maps; each box links the Atlas's own PDF for that hotspot. The outlines are asked for at about a kilometre's precision rather than the survey's own, which is what makes them arrive in seconds; every field comes across unchanged." },
    { id: "atlas_cities", name: "Hotspot Cities (Atlas for the End of the World)", unit: "cities", colour: "#5E6070", route: "atlascities", zoomTo: 9, ready: true, lazy: true,
      pageBase: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/", positions: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/atlas/cities.json",
      cities: [["antananarivo", "Antananarivo, Madagascar"], ["auckland", "Auckland, New Zealand"], ["baku", "Baku, Azerbaijan"], ["bogota", "Bogotá, Colombia"], ["brasilia", "Brasília, Brazil"], ["cape_town", "Cape Town, South Africa"], ["chengdu", "Chengdu, China"], ["colombo", "Colombo, Sri Lanka"], ["dar_es_salaam", "Dar es Salaam, Tanzania"], ["davao", "Davao, Philippines"], ["durban", "Durban, South Africa"], ["esfahan", "Esfahan, Iran"], ["guadalajara", "Guadalajara, Mexico"], ["guayaquil", "Guayaquil, Ecuador"], ["hongknog_shenzhen_quangzhou", "Hongkong-Shenzhen-Guangzhou, China"], ["honolulu", "Honolulu, United States"], ["houston", "Houston, United States"], ["jakarta", "Jakarta, Indonesia"], ["lagos", "Lagos, Nigeria"], ["los_angeles", "Los Angeles, United States"], ["makassar", "Makassar, Indonesia"], ["mecca", "Mecca, Saudi Arabia"], ["mexico_city", "Mexico City, Mexico"], ["nairobi", "Nairobi, Kenya"], ["osaka", "Osaka, Japan"], ["perth", "Perth, Australia"], ["port-au-prince", "Port-au-Prince, Haiti"], ["rawalpindi", "Rawalpindi, Pakistan"], ["santiago", "Santiago, Chile"], ["sao_paulo", "São Paulo, Brazil"], ["sydney", "Sydney, Australia"], ["tashkent", "Tashkent, Uzbekistan"], ["tel_aviv", "Tel Aviv, Israel"]],
      note: "The Atlas's 33 hotspot cities; each is placed from its name through a weekly OpenStreetMap lookup, and its box links the Atlas's own page." },
    { id: "building_types", name: "Buildings", unit: "places", colour: "#6A6258", route: "buildings", ready: true, lazy: true,
      // Their own repo and Pages site: a site is capped at 1 GB and these are
      // about 700 MB. See culprits-buildings.
      archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-buildings/tiles/building_types.pmtiles", summaryUrl: "https://welcometoyourgalaxy.github.io/culprits-buildings/tiles/building_types.json",
      note: "Every building in the executive, financial, legal, legislative, judicial, anti-slavery and activist-rights maps' files, one record per place: where two files describe the same place, the fuller record leads and every field the other adds is kept." },
    { id: "owid_interest", name: "Share of government spending going to interest payments (Our World in Data)", unit: "% of spending", colour: "#6E5F52", route: "owidgrapher", ready: true, lazy: true,
      slug: "share-of-government-expenditure-going-to-interest-payments",
      note: "Read live from Our World in Data each time it is ticked; the chart's own data, by country and year." },
    { id: "owid_corptax", name: "Statutory corporate income tax rate (Our World in Data)", unit: "% rate", colour: "#6E5F52", route: "owidgrapher", ready: true, lazy: true,
      slug: "statutory-corporate-income-tax-rate",
      note: "Read live from Our World in Data each time it is ticked; the chart's own data, by country and year." },
    { id: "owid_aid", name: "Foreign aid received as a share of national income (Our World in Data)", unit: "% of income", colour: "#6E5F52", route: "owidgrapher", ready: true, lazy: true,
      slug: "foreign-aid-received-as-a-share-of-national-income-net",
      note: "Read live from Our World in Data each time it is ticked; the chart's own data, by country and year." },
    { id: "ll2_pads", name: "Launch sites (Launch Library 2)", unit: "launch pads", colour: "#5E6070", route: "ll2", ready: true, lazy: true,
      what: "pads", copy: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ll2/pads.json",
      note: "Every launch pad in Launch Library 2, The Space Devs' open database, read live." },
    { id: "ll2_upcoming", name: "Upcoming launches (Launch Library 2)", unit: "launches", colour: "#6E5A6E", route: "ll2", ready: true, lazy: true,
      what: "upcoming", copy: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ll2/upcoming.json",
      note: "Every scheduled launch in Launch Library 2, placed at its pad, read live." },
    { id: "space_industry", name: "The space industry (openmaps.space)", unit: "places", colour: "#5E6070", route: "geojsonlive", ready: true, lazy: true,
      files: [{ label: "Places", url: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/openmaps/space_industry.geojson" }],
      note: "openmaps.space's space industry map: every place it lists, with the organisations there, copied daily from its own data file." },
    { id: "mymaps_supp_a", name: "Pet Food Companies (Google My Maps)", unit: "placemarks", colour: "#6A5E66", route: "kml", ready: true, lazy: true,
      kml: "https://www.google.com/maps/d/kml?mid=1vrnqSW4cWWdnjz6cJ-qFMmd0zbJzYd6V&forcekml=1",
      note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." },
    { id: "mymaps_supp_b", name: "Suppression page map (Google My Maps)", unit: "placemarks", colour: "#6A5E66", route: "kml", ready: true, lazy: true,
      kml: "https://www.google.com/maps/d/kml?mid=1seBCggQGg1tcRYpqpZ5ZKJaxHs4&forcekml=1",
      note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." },
    { id: "rte_trade", name: "Resource trade flows (resourcetrade.earth, Chatham House)", unit: "trade flows", colour: "#8A6356", route: "rte", ready: true, lazy: true,
      api: "https://api.resourcetrade.earth/api/rt/2.7", copy: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/rte",
      note: "The largest natural-resource trade flows between countries, read live from resourcetrade.earth (a daily copy stands in if it cannot be read)." },
    { id: "gsn", name: "Global Safety Net (One Earth)", unit: "layers", colour: "#406F2F", route: "gsn", ready: true, lazy: true,
      api: "https://api.gsn.naturedatalab.org/geo-analysis/layers",
      note: "Every layer the Global Safety Net viewer offers, drawn live from its own map service in its own colours." },
    { id: "ct_air", name: "Urban air-pollution sources and their plumes (Climate TRACE)", unit: "sources", colour: "#7A5A55", route: "ctair", ready: true, lazy: true,
      list: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/ct_air/sources.geojson",
      note: "The sources Climate TRACE's city air-pollution pages cover; a click draws the source's modelled plume and gives its figures for every pollutant, read live." },
    { id: "ct_pop", name: "Population density, 1 km (GHSL via Climate TRACE)", unit: "people per square km", colour: "#6A6258", route: "rasterlive", ready: true, lazy: true,
      attribution: "Climate TRACE; GHSL population", maxzoom: 12,
      choices: [{ label: "Population", tiles: "https://tiles.climatetrace.org/ghsl-pop-1km/all/{z}/{x}/{y}.png" }],
      note: "The population layer Climate TRACE's air-pollution pages draw underneath, read live." },
    { id: "gta_acts", name: "State acts by country (Global Trade Alert)", unit: "state acts", colour: "#8A6356", route: "gta", ready: true, lazy: true,
      data: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/gta/countries.json", shapes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/gta/world.geojson",
      note: "Every state act in Global Trade Alert's database, summed by the country that took it, from a daily copy." },
    { id: "cfr_tracker", name: "Global Monetary Policy Tracker (CFR)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://public.tableau.com/views/CFRGlobalMonetaryPolicyTrackerNEW/GlobalMonetaryPolicyTracker?:showVizHome=no&:embed=y",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "tableau_zsf", name: "Global Imbalances Tracker (CFR)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://public.tableau.com/shared/ZSF724HPQ?:showVizHome=no&:embed=y",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "troutwood", name: "Troutwood map", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://map.troutwood.com/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "ect_secrets", name: "Energy Charter Treaty's Dirty Secrets", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://energy-charter-dirty-secrets.org/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "isds_tracker", name: "Global ISDS Tracker", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://www.globalisdstracker.org/database/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "giga_schools", name: "Giga: school connectivity map", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://maps.giga.global/map",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "pirg_plastic", name: "Where is plastic produced? (PIRG)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://pirg.org/resources/where-is-plastic-produced/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "bffp_audit", name: "Break Free From Plastic brand audit 2023", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://brandaudit.breakfreefromplastic.org/brand-audit-2023/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "gpw_map", name: "Global Plastic Watch", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://globalplasticwatch.org/map",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "epa_widget", name: "Every US site EPA holds a record for, across all its programs (EPA Envirofacts)", unit: "facilities", colour: "#6A6258", route: "arcgisdyn", ready: true, lazy: true,
      service: "https://geopub.epa.gov/arcgis/rest/services/EMEF/efpoints/MapServer", minzoom: 6.5,
      // EPA's service draws nothing wider than about state level, so wider out
      // the row draws a weekly copy of every point (scripts/epa_efpoints.py in
      // culprits-tiles-more); each point's full record is fetched from EPA on click.
      points: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/epa_efpoints.pmtiles",
      attribution: "US EPA Envirofacts",
      note: "The facility points behind EPA's Envirofacts multisystem widget, drawn live from EPA's EnviroMapper service; EPA draws them from about state level in; wider out, a weekly copy of every point is drawn, merged into counted points where they crowd." },
    { id: "bocc", name: "Banking on Climate Chaos", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://www.bankingonclimatechaos.org/?bank=JPMorgan%20Chase#fulldata-panel",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "dff", name: "Deforestation Free Funds", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://deforestationfreefunds.org",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "fortune500", name: "Fortune Global 500, 2024", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://interactives.fortune.com/global_500_2024/dashboard/index.html",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "theyrule", name: "They Rule", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://theyrule.net/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "pe_bankrolling", name: "Bankrolling Extinction (Portfolio Earth)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://portfolio.earth/campaigns/bankrolling-extinction/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "pe_subsidising", name: "Subsidising Extinction (Portfolio Earth)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://portfolio.earth/campaigns/subsidising-extinction/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "powerbi_report", name: "Environmental Crime Tracker", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://app.powerbi.com/view?r=eyJrIjoiZGJmNGIwODgtMTgyMS00NmVlLWJmNWUtZTAzZDBlMmQ1ODI2IiwidCI6IjBiMzNkZjAwLTYzNGMtNDBlYy1iOGQ5LTZhMGI2MjYyNmU1ZCJ9",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "scribd_doc", name: "Destruction page document (Scribd)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://www.scribd.com/embeds/401203705/content?start_page=1&view_mode=scroll&access_key=key-9NzI5oK8PppZP3Bfluct",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "skytruth_monitor", name: "All incidents (SkyTruth Monitor)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://monitor.skytruth.org/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    // It said "last 30 days". It never was: SkyTruth's service does not apply the
    // days it is asked for, and the copy holds ships from 2019 and 2024.
    { id: "skytruth_voc", name: "Vessels of concern (SkyTruth Monitor)", unit: "alerts", colour: "#5E7377", route: "pmtiles", ready: true, lazy: true,
      archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_voc.pmtiles", boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/vessels_of_concern",
      note: "SkyTruth's own list of disabled and sunken ships that threaten a spill, every one it lists whatever its date, from a daily copy of its service." },
    // SkyTruth Monitor's alert feeds, one row each, from the same daily copy.
    { id: "skytruth_nrc", name: "Spills, releases and rail incidents reported to the US National Response Center (SkyTruth Monitor)", unit: "incident reports", colour: "#6A5A4E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_nrc.pmtiles",
      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_1",
      note: "Every alert SkyTruth's service will give, from a daily copy read square by square as tiles: the service hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. A click reads the alert's own text from the copy. Each report as the National Response Center took it down, with SkyTruth's own reading of it where it made one. Reports are what a caller said, not findings." },
    { id: "skytruth_posts", name: "Taylor Energy, derailments and refuge spills, written up by SkyTruth (SkyTruth Monitor)", unit: "write-ups", colour: "#5E6B70", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_posts.pmtiles",
      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_2",
      note: "Every alert SkyTruth's service will give, from a daily copy read square by square as tiles: the service hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. A click reads the alert's own text from the copy. SkyTruth's own posts about incidents it followed, placed where each happened." },
    { id: "skytruth_marine_incidents", name: "Sinkings, groundings and mystery slicks, as US responders wrote them up (SkyTruth Monitor)", unit: "incident reports", colour: "#5A6772", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_marine_incidents.pmtiles",
      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_3",
      note: "Every alert SkyTruth's service will give, from a daily copy read square by square as tiles: the service hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. A click reads the alert's own text from the copy. Incident reports in the words of the responders, NOAA's and the Coast Guard's among them." },
    { id: "skytruth_pa_permits", name: "Oil and gas drilling permits issued, Pennsylvania (SkyTruth Monitor)", unit: "permits", colour: "#6E6A55", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_pa_permits.pmtiles",
      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_4",
      note: "Every alert SkyTruth's service will give, from a daily copy read square by square as tiles: the service hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. A click reads the alert's own text from the copy. Each permit as Pennsylvania issued it: well type, operator, site, township." },
    { id: "skytruth_pa_spud", name: "Oil and gas wells where drilling has started, Pennsylvania (SkyTruth Monitor)", unit: "drilling starts", colour: "#73664F", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_pa_spud.pmtiles",
      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_5",
      note: "Every alert SkyTruth's service will give, from a daily copy read square by square as tiles: the service hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. A click reads the alert's own text from the copy. Operators' own reports that drilling began (SPUD reports)." },
    { id: "skytruth_pa_violations", name: "Violations issued to oil and gas operators, Pennsylvania (SkyTruth Monitor)", unit: "violations", colour: "#7A5B4E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_pa_violations.pmtiles",
      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_9",
      note: "Every alert SkyTruth's service will give, from a daily copy read square by square as tiles: the service hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. A click reads the alert's own text from the copy. Each violation as Pennsylvania's inspectors recorded it, with its code." },
    { id: "skytruth_well_permits", name: "Well plugging and other well permit activity, by county (SkyTruth Monitor)", unit: "permit reports", colour: "#6B6056", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_well_permits.pmtiles",
      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_8",
      note: "Every alert SkyTruth's service will give, from a daily copy read square by square as tiles: the service hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. A click reads the alert's own text from the copy. Permit activity as operators reported it. The feed does not say which state it covers; the newest report seen on 20 September 2026 was from December 2011." },
    { id: "skytruth_fracfocus", name: "Gas and oil wells fracked, United States \u2014 operators' FracFocus disclosures (SkyTruth Monitor)", unit: "disclosures", colour: "#6F5F58", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_fracfocus.pmtiles",
      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_10",
      note: "Every alert SkyTruth's service will give, from a daily copy read square by square as tiles: the service hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. A click reads the alert's own text from the copy. An alert for each disclosure SkyTruth found on FracFocus.org." },
    { id: "skytruth_tests", name: "Test entries left by SkyTruth Monitor's own developers (SkyTruth Monitor)", unit: "test entries", colour: "#6A6A66", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_tests.pmtiles",
      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_10101",
      note: "Every alert SkyTruth's service will give, from a daily copy read square by square as tiles: the service hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. A click reads the alert's own text from the copy. Feed 10101: entries its developers made while trying the service out (\"This is dan's house\"). Not environmental data; here because the service publishes it and nothing it publishes is left out." },
    { id: "skytruth_quakes", name: "Earthquakes, worldwide (SkyTruth Monitor)", unit: "earthquakes", colour: "#65676A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/skytruth_quakes.pmtiles",
      boxes: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/skytruth/feed_6",
      note: "Every alert SkyTruth's service will give, from a daily copy read square by square as tiles: the service hands out only the 100 newest for any area asked, so the copy asks area by area, smaller and smaller wherever 100 came back, keeps everything gathered on earlier days, and fetches the back history over several days. A click reads the alert's own text from the copy. The earthquakes SkyTruth's feed carries; the newest seen on 20 September 2026 was from July 2015." },
    { id: "slick_archive", name: "Oil slick archive, kept daily (Cerulean)", unit: "slicks by month", colour: "#5A5750", route: "slickarchive", ready: true, lazy: true,
      base: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/cerulean_archive",
      note: "Every Cerulean slick kept by month from a daily copy, so they stay on the map whatever happens to the live service." },
    { id: "wrf", name: "When Rockets Fly", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://whenrocketsfly.com/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "nsf_launches", name: "Next Spaceflight", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://nextspaceflight.com/launches/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "nsf_locations", name: "Next Spaceflight: launch sites", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://nextspaceflight.com/locations/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "esa_risk", name: "Near-Earth-object risk list (ESA)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://neo.ssa.esa.int/risk-list-plots",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "acgf", name: "ACGF", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://acgf.org/index.htm",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "gsn_rankings", name: "Country rankings (Global Safety Net)", unit: "opens the page itself in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://www.globalsafetynet.app/rankings/",
      note: "The page as the site shows it, whole, in the panel along the bottom; its data cannot be read directly to draw here." },
    { id: "giga_countries", name: "School mapping by country (Giga)", unit: "countries", colour: "#627A86", route: "giga", ready: true, lazy: true,
      data: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/giga/countries.json",
      note: "Giga's own figures for every country on its map, copied daily (its service does not let other sites read it)." },
    { id: "biosignature", name: "Biosignature Evidence Assessment", unit: "opens it in a panel", colour: "#5E6070", route: "companion", ready: true, lazy: true,
      page: "https://welcometoyourgalaxy.github.io/maps/off-planet-invasion_embed_13_large-script.html",
      note: "Your own assessment from the Off-Planet Invasion page, whole, in the panel along the bottom." },
    { id: "leverage_chart", name: "The Leverage Chart", unit: "opens it in a panel", colour: "#6A6258", route: "companion", ready: true, lazy: true,
      page: "https://welcometoyourgalaxy.github.io/maps/leverage-chart.html",
      note: "Your own chart from the Solution page, whole, in the panel along the bottom." },
    { id: "wreckers_umap", name: "Wreckers of the Earth (Corporate Watch)", unit: "companies and sites", colour: "#6E5A55", route: "umap", ready: true, lazy: true,
      umap: "https://umap.openstreetmap.fr/en", umapId: 409815,
      note: "Read live from Corporate Watch's uMap each time it is ticked, with its own layers, colours and popups." },
    { id: "mymaps_chlorine", name: "Plastics and chlorine (Google My Maps)", unit: "placemarks", colour: "#5F6B70", route: "kml", ready: true, lazy: true,
      kml: "https://www.google.com/maps/d/kml?mid=1PwPKisRf73FPC6hTtZDCv2s_B6_x0Pk7&forcekml=1",
      note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." },
    { id: "mymaps_trees", name: "Christmas Trees (Google My Maps)", unit: "placemarks", colour: "#5F6E5C", route: "kml", ready: true, lazy: true,
      kml: "https://www.google.com/maps/d/kml?mid=1c-vPoGf79mfQezTgcFoKb-xN4A4&forcekml=1",
      note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." },
    { id: "fractracker_refineries", name: "Oil refinery complexes, worldwide (FracTracker Alliance)", unit: "refineries", colour: "#6A5E58", route: "arcgisapp", ready: true, lazy: true,
      item: "8e72a974af4c4fe9ba6875cee03078ee",
      attribution: '<a href="https://www.fractracker.org" target="_blank" rel="noopener">FracTracker Alliance</a>',
      note: "FracTracker Alliance's own Global Oil Refinery Complexes map, read live from it: its layers, its fields and its popups, unchanged." },
    { id: "arcgis_ym8xk", name: "Vinyl chloride (ArcGIS)", unit: "places", colour: "#5E6070", route: "arcgisapp", ready: true, lazy: true,
      item: "b1b5b5e0d08c4024a50caa88e6442281",
      note: "Read live from the ArcGIS map linked on the Destruction page (arcg.is/ym8XK); the row takes its own title once it loads." },
    { id: "arcgis_materialresearch", name: "Materials research (ArcGIS)", unit: "places", colour: "#665E6C", route: "arcgisapp", ready: true, lazy: true,
      item: "3ff82579637f4c7a96bd62d039ac3e00",
      note: "Read live from the ArcGIS experience linked on the Destruction page (arcg.is/4q8m4); the row takes its own title once it loads." },
    { id: "glad_loss", name: "Tree cover loss (Global Forest Change, UMD GLAD)", unit: "loss since 2000, 30 m", colour: "#8A4F46", route: "rasterlive", ready: true, lazy: true,
      attribution: "Hansen/UMD/Google/USGS/NASA", maxzoom: 12,
      choices: [{ label: "Tree cover loss", tiles: "https://storage.googleapis.com/earthenginepartners-hansen/tiles/gfc_v1.12/loss_alpha/{z}/{x}/{y}.png" }],
      note: "The published Global Forest Change tiles, read live." },
    { id: "soilgrids", name: "Soil properties (SoilGrids, ISRIC)", unit: "soil properties, 250 m", colour: "#6B5A4A", route: "rasterlive", ready: true, lazy: true,
      attribution: "ISRIC SoilGrids (CC BY 4.0)", maxzoom: 14,
      choices: [
        { label: "Soil organic carbon, 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/soc.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=soc_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" },
        { label: "Organic carbon density, 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/ocd.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ocd_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" },
        { label: "Nitrogen, 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/nitrogen.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=nitrogen_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" },
        { label: "pH (water), 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/phh2o.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=phh2o_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" },
        { label: "Cation exchange capacity, 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/cec.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=cec_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" },
        { label: "Bulk density, 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/bdod.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=bdod_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" },
        { label: "Coarse fragments, 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/cfvo.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=cfvo_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" },
        { label: "Clay, 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/clay.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=clay_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" },
        { label: "Sand, 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/sand.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=sand_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" },
        { label: "Silt, 0\u20135 cm", tiles: "https://maps.isric.org/mapserv?map=/map/silt.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=silt_0-5cm_mean&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true" }
      ],
      note: "ISRIC's SoilGrids map server, read live. Each chip is one soil property at 0\u20135 cm depth, as SoilGrids publishes it." },
    { id: "wastewater", name: "Global Wastewater Model (Tuholske et al.)", unit: "nitrogen from human wastewater", colour: "#5E7377", route: "rasterlive", ready: true, lazy: true,
      attribution: "Tuholske et al. 2021, Global Wastewater Model", maxzoom: 10,
      choices: [
        { label: "Nitrogen in all wastewater", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_N_effluent.pmtiles" },
        { label: "From sewage treatment", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_N_effluent_treated.pmtiles" },
        { label: "From septic systems", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_N_effluent_septic.pmtiles" },
        { label: "Untreated (open defecation)", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_N_effluent_open.pmtiles" },
        { label: "Coastal nitrogen plumes", archive: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/wastewater_N_plumes.pmtiles" }
      ],
      note: "The model's own published pictures, from a GitHub copy (its server does not let other sites draw them). Each chip is one of the model's own layers." },
  ],
};


// Two rows that hold several layers each, so a reader meets one line where the
// subject is one subject. A group OWNS its children: they are defined here and
// nowhere else. Gathering them by reference from LAYERS was tried and was
// wrong - each child was rendered twice, once where it was defined and once
// inside the group, and the copy nobody had placed fell into "Not yet placed"
// at the foot of the box.
//
// The alerts are one row because a reader wants "what has been cleared lately"
// in one place, and three lines inside it because they detect different things
// by different instruments: whoever sees an alert can still tell which system
// saw it. All three come from Global Forest Watch's tile service. Global Nature
// Watch is the platform Global Forest Watch now sits inside, not the maker of
// these products, so the row names the service that serves them and each line
// names the system that made it.
const FOREST_ALERTS = {
  id: "forest_alerts",
  name: "Trees and plant cover lost, as it happens",
  group: true,
  ready: true,
  children: [
    { id:"gfw",                  name:"Trees cut, tropics only \u2014 seen by radar and optical satellites, last 30 days (GLAD-L, GLAD-S2, RADD)", unit:"alerts", colour:"#8A4F46", route:"tile", ready:true, off: true, lazy:true,
      bounds: [-180, -30, 180, 30],
      // Cut at 30° to the pixel, not just to the tile. See clipTileRows.
      clipToBounds: true,
      tileMaxZoom: 22, tileQuery: "kind=integrated&days=30", off: true,
      // GFW paint these tiles themselves, and no rotation of their palette read
      // as anything but glaring. Each alert pixel is given this layer's colour
      // instead, in the latclip protocol. See recolorAlerts.
      recolor: "#8A4F46",
      note: "Pan-tropical only. GLAD and RADD do not cover boreal or temperate forest — use the global layers for those.",
      attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
    { id:"gfw_dist",             name:"Any loss of plant cover, worldwide \u2014 cutting, fire, drought or harvest alike, last 30 days (DIST-ALERT)", unit:"alerts", colour:"#7A5B4E", route:"tile", ready:true, off: true, lazy:true,
      bounds: [-180, -30, 180, 30],
      tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=30", off: true,
      recolor: "#7A5B4E",
      note: "Global coverage, including boreal and temperate forest. Detects vegetation disturbance generally, so it catches fire and harvest as well as clearing.",
      attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
    { id:"gfw_dist_year",        name:"Any loss of plant cover, worldwide \u2014 the same, gathered over a year (DIST-ALERT)", unit:"alerts", colour:"#6E5E57", route:"tile", ready:true, off: true, lazy:true,
      bounds: [-180, -30, 180, 30],
      tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=365", off: true,
      recolor: "#6E5E57",
      note: "The same global product over a twelve-month window, for seeing a season's cumulative loss rather than this month's.",
      attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
  ],
};
const TRASE_DATA = {
  id: "trase_data",
  name: "Deforestation and supply chains",
  group: true,
  ready: true,
  children: [
      { id: "trase_measures", name: "Deforestation and supply-chain measures (Trase)", unit: "regions", catUnit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
        catalogue: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/catalogue.json", values: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/values",
        regions: "https://resources.trase.earth/data/trase-regions",
        attribution: "Trase (CC BY 4.0)",
        note: "Trase's own measures for every country, region level and year it publishes. Region shapes are read live from Trase; the values come from a copy reread weekly, because Trase does not let other sites read them." },
      { id: "trase_meat_brazil", name: "Slaughterhouses and animal-product plants, Brazil (Trase)", unit: "facilities", colour: "#8C5548", route: "trasefac", ready: true, lazy: true,
        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "brazil-facilities",
        file: "2026-05-07-br_beef_logistics_map_v6.geo.json",
        attribution: "Trase (CC BY 4.0)",
        note: "Trase's map of Brazilian slaughterhouses and other animal-product facilities. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
      { id: "trase_silos_brazil", name: "Soy silos and storage, Brazil (Trase)", unit: "silos and stores", colour: "#6E6A55", route: "trasefac", ready: true, lazy: true,
        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "brazil-silos",
        file: "silos_consolidated_capacity_website_brazil_2024_2_post.geo.json",
        attribution: "Trase (CC BY 4.0)",
        note: "About 9,300 Brazilian soy silos and processing sites with their owners. Trase identified them with an image-reading workflow it states is over 90% accurate, so this is not a register and a share of the rows is wrong. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
      { id: "trase_cocoa_ivory", name: "Cocoa cooperatives, C\u00f4te d'Ivoire (Trase)", unit: "cooperatives", colour: "#6B5B4E", route: "trasefac", ready: true, lazy: true,
        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "cote-d-ivoire-cocoa-cooperatives",
        file: "IC2B_coopyear_clean.geo.json",
        attribution: "Trase (CC BY 4.0)",
        note: "Trase's list of Ivorian cocoa cooperatives. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
      { id: "trase_palm_indonesia", name: "Palm oil mills, Indonesia (Trase)", unit: "mills", colour: "#62755F", route: "trasefac", ready: true, lazy: true,
        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-palm-oil-mills",
        file: "IDN_PO_mills_clean.geo.json",
        attribution: "Trase (CC BY 4.0)",
        note: "Trase's Indonesian palm oil mills, carrying the Universal Mill List id where it has one. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
      { id: "trase_pulp_indonesia", name: "Wood pulp mills, Indonesia (Trase)", unit: "mills", colour: "#5F6E6A", route: "trasefac", ready: true, lazy: true,
        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-mills",
        file: "id_wood_mills_facilities_v2026_02_10.geo.json",
        attribution: "Trase (CC BY 4.0)",
        note: "Trase's Indonesian wood pulp mills. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
      { id: "trase_pulp_concessions_2015", name: "Wood pulp concessions 2015–2019 (Trase)", unit: "concessions", colour: "#6F7560", route: "trasefac", ready: true, lazy: true,
        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-concessions-2015-2019",
        file: "indonesia_wood_pulp_concessions_2015_2019_v2026_02_20.geo.json",
        attribution: "Trase (CC BY 4.0)",
        note: "The areas Trase records as wood pulp concessions over 2015\u20132019, drawn as areas. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
      { id: "trase_pulp_concessions_2020", name: "Wood pulp concessions 2020–2022 (Trase)", unit: "concessions", colour: "#5E6A63", route: "trasefac", ready: true, lazy: true,
        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-concessions-2020-2022",
        file: "indonesia_wood_pulp_concessions_2020_2022_v2026_02_20.geo.json",
        attribution: "Trase (CC BY 4.0)",
        note: "The areas Trase records as wood pulp concessions over 2020\u20132022, drawn as areas. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
      { id: "trase_pulp_concessions_2023", name: "Wood pulp concessions 2023–2024 (Trase)", unit: "concessions", colour: "#59665C", route: "trasefac", ready: true, lazy: true,
        manifest: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/facilities.json", facilityType: "indonesia-wood-pulp-concessions-2023-2024",
        file: "indonesia_wood_pulp_concessions_2023_2024_v2026_02_20.geo.json",
        attribution: "Trase (CC BY 4.0)",
        note: "The areas Trase records as wood pulp concessions over 2023\u20132024, drawn as areas. Read live from Trase's own files each time the row is ticked (CC BY 4.0)." },
  ],
};

const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS, EXEC_MAP, MONEY_MAP, LEGAL_MAP, LEG_MAP, JUD_MAP, MORE_MAPS, GMO_MAP, OTHER_MAPS, FOREST_ALERTS, TRASE_DATA];
function childById(id) {
  for (const g of GROUPS) {
    const hit = g.children.find((c) => c.id === id);
    if (hit) return hit;
  }
  return null;
}

// Create a lazy layer once, on first tick. Repeat ticks are a no-op, and a
// failure marks the row rather than throwing into the change handler, where an
// unhandled rejection would leave the box ticked and nothing on the map.
const created = new Set();
// Layers are built a few at a time, not all at once.
//
// Ticking a heading turns on everything under it, which can be thirty layers.
// Fired together they open thirty archives and thirty live services in one
// breath: the browser holds most of them in a queue anyway, the map stalls
// while they arrive, and the slowest source delays every other. Three at a
// time keeps the map answering and lets the first layers draw while the rest
// wait their turn. The row says where it is in the queue, so a layer that has
// not drawn yet does not read as a layer that failed.
const QUEUE_AT_ONCE = 3;
let queueRunning = 0;
const queueWaiting = [];
function queueNext() {
  while (queueRunning < QUEUE_AT_ONCE && queueWaiting.length) {
    const next = queueWaiting.shift();
    queueRunning++;
    setLayerState(next.id, "loading\u2026");
    Promise.resolve().then(next.job).then(next.done, next.fail)
      .then(() => { queueRunning--; queueNext(); });
  }
  queueWaiting.forEach((w, i) => setLayerState(w.id, `waiting behind ${i + 1} other layer${i ? "s" : ""}\u2026`));
}
function queueBuild(id, job) {
  return new Promise((done, fail) => {
    queueWaiting.push({ id, job, done, fail });
    queueNext();
  });
}
function ensureLayer(cfg) {
  if (created.has(cfg.id)) return;
  created.add(cfg.id);
  setLayerState(cfg.id, "loading\u2026");
  // Dispatch by route, the same way the load handler does. Lazy children are
  // not all PMTiles — the livestock species are WMTS — and calling the archive
  // builder for a tile layer would fail on a URL that was never meant to be an
  // archive. addWmtsLayer is synchronous, so it is wrapped to keep one shape.
  queueBuild(cfg.id, () => {
    const build = cfg.route === "wmts"
    ? Promise.resolve().then(() => addWmtsLayer(cfg))
      : cfg.route === "shapes" ? addShapesLayer(cfg)
      : cfg.route === "sitemap" ? addSitemapLayer(cfg)
      : cfg.route === "arcgis" ? Promise.resolve().then(() => addArcgisLayer(cfg))
      : cfg.route === "umap" || cfg.route === "kml" || cfg.route === "arcgisapp" ? addLivePlacesLayer(cfg)
      : cfg.route === "rasterlive" ? Promise.resolve().then(() => addRasterChoiceLayer(cfg))
      : cfg.route === "trase" ? addTraseLayer(cfg)
      : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
      : cfg.route === "slickarchive" ? addSlickArchive(cfg)
      : cfg.route === "carbonmapper" ? addCarbonMapperLayer(cfg)
    : cfg.route === "cafo" ? Promise.resolve().then(() => addCafoLayer(cfg))
      : cfg.route === "glw" ? Promise.resolve().then(() => addGlwLayer(cfg))
      : cfg.route === "arcgisdyn" ? addArcgisDynLayer(cfg)
      : cfg.route === "giga" ? addGigaLayer(cfg)
      : cfg.route === "gta" ? addGtaLayer(cfg)
      : cfg.route === "ctair" ? addCtAirLayer(cfg)
      : cfg.route === "gsn" ? addGsnLayer(cfg)
      : cfg.route === "companion" ? Promise.resolve().then(() => addCompanion(cfg))
      : cfg.route === "rte" ? addRteLayer(cfg)
      : cfg.route === "ll2" ? addLivePlacesLayer(cfg)
      : cfg.route === "owidgrapher" ? addOwidGrapherLayer(cfg)
      : cfg.route === "buildings" ? addBuildingTypesLayer(cfg)
      : cfg.route === "spheres" ? addSpheresLayer(cfg)
      : ["ejatlas", "geojsonlive", "wpgmza", "atlascities", "trasefac"].includes(cfg.route) ? addLivePlacesLayer(cfg)
      : cfg.route === "wmsmenu" ? addWmsMenuLayer(cfg)
      : cfg.route === "gfwmenu" ? addGfwMenuLayer(cfg)
      : addPmtilesLayer(cfg);
    return build;
  })
    .then(() => {
      const box = document.getElementById("layers");
      if (cfg.facet) {
        const existing = box.querySelector(`.facet[data-for="${cfg.id}"]`);
        if (!existing && cfg.facet.values.length) {
          const row = box.querySelector(`[data-layer="${cfg.id}"]`).closest("label");
          row.after(facetRow(cfg));
        }
      }
      applyVisibility(cfg.id);
      buildLegend();
    })
    .catch((e) => {
      // Let it be retried: a year that failed once because R2 was slow should
      // not be permanently dead for the rest of the session.
      created.delete(cfg.id);
      setLayerState(cfg.id, `failed (${e.message})`);
    });
}

// Replace a facet row in place once its values are known. Built before the
// archive answers, so the first render can be empty and this fills it.
function refreshFacetRow(cfg) {
  const box = document.getElementById("layers");
  if (!box) return;
  const old = box.querySelector(`.facet[data-for="${cfg.id}"]`);
  const fresh = facetRow(cfg);
  if (old) old.replaceWith(fresh);
  else {
    const cb = box.querySelector(`[data-layer="${cfg.id}"]`);
    if (cb) cb.closest("label").after(fresh);
  }
}

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
  hydrowaste: ["insentient", "downstream"],
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
  abattoir_cafo: ["animal", "downstream"],
  abattoir_glw: ["animal", "downstream"],
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
  carbon_plumes: ["insentient", "downstream"],
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
  site_indigenous_conflicts: ["human", "downstream"],
  palmwatch: ["plant", "downstream"],
  usda_soybean: ["plant", "downstream"],
  usda_corn: ["plant", "downstream"],
  unep_coral: ["animal", "downstream"],
  trase_measures: ["plant", "downstream"],
  mines_global: ["insentient", "downstream"],
  slick_archive: ["animal", "downstream"],
  giga_countries: ["human", "upstream"],
  trase_meat_brazil: ["animal", "upstream"],
  biosignature: ["insentient", "downstream"],
  leverage_chart: ["human", "upstream"],
  cfr_tracker: ["human", "upstream"],
  tableau_zsf: ["human", "upstream"],
  troutwood: ["human", "upstream"],
  ect_secrets: ["human", "upstream"],
  isds_tracker: ["human", "upstream"],
  giga_schools: ["human", "upstream"],
  pirg_plastic: ["insentient", "upstream"],
  bffp_audit: ["insentient", "upstream"],
  gpw_map: ["insentient", "downstream"],
  epa_widget: ["insentient", "downstream"],
  bocc: ["human", "upstream"],
  dff: ["plant", "upstream"],
  fortune500: ["human", "upstream"],
  theyrule: ["human", "upstream"],
  pe_bankrolling: ["animal", "upstream"],
  pe_subsidising: ["animal", "upstream"],
  powerbi_report: ["human", "upstream"],
  scribd_doc: ["human", "upstream"],
  skytruth_monitor: ["animal", "downstream"],
  skytruth_voc: ["animal", "downstream"],
  skytruth_nrc: ["animal", "downstream"],
  skytruth_posts: ["animal", "downstream"],
  skytruth_marine_incidents: ["animal", "downstream"],
  skytruth_pa_permits: ["animal", "downstream"],
  skytruth_pa_spud: ["animal", "downstream"],
  skytruth_pa_violations: ["animal", "downstream"],
  skytruth_well_permits: ["animal", "downstream"],
  skytruth_fracfocus: ["animal", "downstream"],
  skytruth_quakes: ["insentient", "downstream"],
  skytruth_tests: ["insentient", "downstream"],
  wrf: ["insentient", "upstream"],
  nsf_launches: ["insentient", "upstream"],
  nsf_locations: ["insentient", "upstream"],
  esa_risk: ["insentient", "downstream"],
  acgf: ["human", "upstream"],
  gsn_rankings: ["plant", "downstream"],
  gta_acts: ["human", "upstream"],
  ct_air: ["human", "downstream"],
  ct_pop: ["human", "downstream"],
  gsn: ["plant", "downstream"],
  rte_trade: ["insentient", "upstream"],
  mymaps_supp_a: ["animal", "downstream"],
  mymaps_supp_b: ["animal", "downstream"],
  space_industry: ["insentient", "upstream"],
  ll2_pads: ["insentient", "upstream"],
  ll2_upcoming: ["insentient", "upstream"],
  owid_interest: ["human", "upstream"],
  owid_corptax: ["human", "upstream"],
  owid_aid: ["human", "upstream"],
  building_types: ["human", "upstream"],
  ejatlas: ["human", "downstream"],
  seas_of_plastic: ["animal", "downstream"],
  final_nail: ["animal", "downstream"],
  nusantara: ["plant", "downstream"],
  gfw_catalogue: ["plant", "downstream"],
  coastal_cleanup: ["insentient", "downstream"],
  atlas_hotspots: ["plant", "downstream"],
  atlas_cities: ["human", "downstream"],
  wreckers_umap: ["insentient", "upstream"],
  mymaps_chlorine: ["insentient", "upstream"],
  mymaps_trees: ["plant", "downstream"],
  fractracker_refineries: ["insentient", "upstream"],
  arcgis_ym8xk: ["insentient", "upstream"],
  arcgis_materialresearch: ["insentient", "upstream"],
  glad_loss: ["plant", "downstream"],
  soilgrids: ["microorganism", "downstream"],
  wastewater: ["insentient", "downstream"],
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
  // Trase's facilities rows are all plant commodities except the Brazilian
  // slaughterhouses, which are named above; the measures row is named above too.
  ["trase_", ["plant", "upstream"]],
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

function buildPanel() {
  const box = document.getElementById("layers");

  // Only built layers appear. Greyed-out placeholders for sources that have no
  // harvester yet read as breakage — three separate times they were reported as
  // "layers not working" — so unbuilt sources are named once at the bottom
  // instead of sitting in the list looking broken.
  LAYERS.filter((c) => c.ready).forEach((cfg) => {
    const row = document.createElement("label");
    row.className = "layer";
    row.innerHTML =
      // Layers marked off start unticked. The alert rasters are: a raster that
      // fails to render covers the whole viewport in a flat wash, which is what
      // hid every other layer. Off by default means one broken upstream layer
      // cannot take the map down with it.
      `<input type="checkbox"${cfg.off ? "" : " checked"} data-layer="${cfg.id}">` +
      `<span class="swatch" style="background:${cfg.colour}"></span>` +
      `<span class="body"><span class="nm">${cfg.name}${liveMark(cfg)}${siteLink(cfg.id)}${infoMark(cfg.note)}</span>` +
      `<span class="un" data-state="${cfg.id}">${cfg.unit}</span></span>`;
    box.appendChild(row);
    if (cfg.facet) box.appendChild(facetRow(cfg));
  });

  // The group renders only if it has children. With no year archives on R2 the
  // parent is absent entirely rather than an empty disclosure that opens onto
  // nothing.
  GROUPS.filter((g) => g.children.length)
        .forEach((g) => box.appendChild(groupRows(g)));

  applyKindFilter();


  box.addEventListener("click", (e) => {
    // Disclosure triangles first. A button emits click, not change, so this is
    // where group expansion belongs rather than in the checkbox handler.
    const disc = e.target.closest && e.target.closest("[data-disc]");
    if (disc) { toggleGroup(box, disc.dataset.disc); return; }

    const btn = e.target.closest(".chip");
    if (!btn) return;
    if (btn.dataset.rc) { rasterChoiceClicked(btn); return; }
    if (btn.dataset.smc) { sitemapColourClicked(btn); return; }
    if (btn.dataset.sm) { sitemapChipClicked(btn); return; }
    const cfg = LAYERS.find((l) => l.id === btn.dataset.facet) || childById(btn.dataset.facet);
    if (!cfg) return;
    const chosen = facetState.get(cfg.id) || new Set();
    if (btn.dataset.value === "") {
      chosen.clear();
    } else {
      chosen.has(btn.dataset.value)
        ? chosen.delete(btn.dataset.value)
        : chosen.add(btn.dataset.value);
    }
    facetState.set(cfg.id, chosen);
    btn.closest(".facet").querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("on", c.dataset.value !== "" && chosen.has(c.dataset.value));
    });
    applyFacet(cfg);
  });

  box.addEventListener("change", (e) => {
    // The group parent ticks and unticks every child, then falls through to
    // the per-child handling below by dispatching nothing — each child's state
    // is set directly here so one click does not fire six change events.
    if (e.target.dataset.group) {
      const group = GROUPS.find((g) => g.id === e.target.dataset.group);
      if (!group) return;
      const on = e.target.checked;
      group.children.forEach((child) => {
        const cb = box.querySelector(`[data-layer="${child.id}"]`);
        if (cb) cb.checked = on;
        visibility.set(child.id, on ? "visible" : "none");
        if (on) ensureLayer(child);
        applyVisibility(child.id);
        buildLegend();
      });
      syncGroupBox(box, group);
      return;
    }

    // A copy has no layer of its own: it ticks the row it copies, and
    // everything follows from there as if the row had been clicked.
    const copied = e.target.dataset && e.target.dataset.copy;
    if (copied) {
      const real = box.querySelector(`[data-layer="${copied}"]`);
      if (real && real.checked !== e.target.checked) {
        real.checked = e.target.checked;
        if (typeof real.dispatchEvent === "function" && typeof Event === "function") real.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }

    const id = e.target.dataset.layer;
    if (!id) return;
    syncCopies(box, id, e.target.checked);
    // Remembered, because layers load asynchronously: a toggle flipped before
    // its archive arrives would otherwise be lost and the layer would appear.
    visibility.set(id, e.target.checked ? "visible" : "none");
    // Lazy layers do not exist until now. Created on the first tick, so an
    // unopened year costs no header fetch, no index read and no tile request.
    if (e.target.checked) {
      const child = childById(id);
      if (child) ensureLayer(child);
    }
    applyVisibility(id);
    buildLegend();
    syncGroupBox(box);
  });

}

function updateZoomState() {
  const z = map.getZoom();
  // The live layers need z8+, and "zoom in" is ambiguous without a number —
  // z8 is closer in than it feels, roughly a large country filling the screen.
  // The line that said "Zoom 2.6 — wide view" is gone; this is kept for
  // anything that still puts the reading on the page.
  const el = document.getElementById("zoomstate");
  if (el) el.innerHTML = `Zoom <b>${z.toFixed(1)}</b> — ${z < CLUSTER_MAXZOOM ? "wide" : "detail"} view.`;
}

// Esri and CARTO are third-party tile hosts. If one stops answering, the
// console fills but the map keeps working — worth logging once so the cause is
// findable, rather than silently showing a darker map than intended.
const badTiles = new Set();
map.on("error", (e) => {
  const src = e && e.sourceId;
  if (src && ["base", "hillshade", "labels", "atlas-plate"].includes(src) && !badTiles.has(src)) {
    badTiles.add(src);
    console.warn(`[culprits] basemap source "${src}" is failing to load tiles ` +
                 `— the map still works, but it will look wrong.`);
  }
});

map.on("load", () => {
  // Its own try: a basemap that fails to add costs the painted look, and must
  // not cost every data layer added after it.
  try { addBasemapLayers(); } catch (e) { console.warn("[culprits] basemap layers:", e.message); }
  addLabelsOnTop();
  setBasemap(BASEMAP);
  buildBasemapPanel();
  watchForLeaving();
  watchSky();
  pullableBoxes();
  addColumnLayer();
  fitMode();
  for (const id of ["spaceBack", "spaceEarth"]) {
    const b = document.getElementById(id);
    if (b && b.addEventListener) b.addEventListener("click", backToMap);
  }
  watchSpaceEdge();
  // All on / All off: each row ticked or unticked as if clicked, so every
  // layer loads, or puts itself away, the ordinary way.
  const setAll = (on) => {
    const box = document.getElementById("layers");
    if (!box || !box.querySelectorAll) return;
    box.querySelectorAll("input[data-layer]").forEach((el) => {
      if (el.checked === on) return;
      el.checked = on;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    box.querySelectorAll("input[data-group]").forEach((el) => { el.checked = on; el.indeterminate = false; });
  };
  for (const [id, on] of [["layersAllOn", true], ["layersAllOff", false]]) {
    const b = document.getElementById(id);
    if (b && b.addEventListener) b.addEventListener("click", () => setAll(on));
  }
  const roll = document.getElementById("panelRoll");
  if (roll) roll.addEventListener("click", () => {
    const panel = document.querySelector(".panel");
    if (!panel || !panel.classList) return;
    const shut = panel.classList.contains("shut");
    panel.classList.toggle("shut", !shut);
    roll.textContent = shut ? "\u25BE" : "\u25B4";
    roll.setAttribute("aria-expanded", shut ? "true" : "false");
  });
  LAYERS.filter((c) => c.ready).forEach((cfg) => {
    try {
      if (cfg.route === "worker") addLiveLayer(cfg);
      else if (cfg.route === "tile") addTileLayer(cfg);
      else if (cfg.route === "wmts") addWmtsLayer(cfg);
      else if (cfg.route === "cerulean") addCeruleanLayer(cfg);
      else if (cfg.route === "coral") addCoralLayer(cfg);
      // Routes this loop does not know fall through to the archive builder,
      // which asks for map/tiles/<id>.pmtiles and fails on a layer that never
      // had one. That is what broke the two modelled meat rows when they were
      // split out: named here, and marked lazy so the first tick builds them.
      else if (cfg.route === "cafo") addCafoLayer(cfg);
      else if (cfg.route === "glw") addGlwLayer(cfg);
      else if (cfg.route === "carbonmapper") {
        addCarbonMapperLayer(cfg).catch((e) => setLayerState(cfg.id, `failed (${e.message})`));
      }
      else if (cfg.route === "country") {
        // Async: without a catch a failure here becomes an unhandled rejection
        // and the layer just silently never appears.
        addCountryLayer(cfg).catch((e) => setLayerState(cfg.id, `failed (${e.message})`));
      }
      else addPmtilesLayer(cfg).catch((e) => setLayerState(cfg.id, `failed (${e.message})`));
    } catch (e) {
      setLayerState(cfg.id, `failed (${e.message})`);
    }
  });
  buildPanel();
  columnEdge();
  updateZoomState();
  LAYERS.filter((c) => c.ready && c.route === "worker").forEach(refreshLiveLayer);
});

map.on("zoom", updateZoomState);
map.on("moveend", () => {
  afterMovement(() => {
    LAYERS.filter((c) => c.ready && c.route === "worker").forEach(refreshLiveLayer);
    LAYERS.filter((c) => c.ready && c.route === "cerulean").forEach((c) =>
      refreshCerulean(c).catch((e) => setLayerState(c.id, `unavailable (${e.message})`)));
  });
});

/* ---------- guerillamap companion ---------- */
/*
 * A second map in a frame under this one, driven from this one.
 *
 * A cross-origin iframe cannot be read: no DOM access, no pulling their layers
 * out. What it can be is DRIVEN — their app takes its whole state from the
 * query string. This is the same mechanism the conflict-feed map uses, which is
 * where the contract was read from rather than guessed.
 *
 * Rebuilding src reloads the frame and makes their app re-fetch, so the update
 * waits for the gesture to settle and is skipped when the view has not actually
 * changed. Follow can be switched off to pin their view while this one moves.
 *
 * THE OVERLAY IDS ARE THEIRS, AND VERIFIED
 * Taken from guerillamap.com/shortcuts, which publishes complete prefiltered
 * URLs. This set is their "Fossil Fuels Infrastructure" shortcut plus nuclear
 * facilities and NASA FIRMS active fires — the parts of their catalogue that
 * are about this subject. Their conflict overlays, which conflict-feed uses,
 * are deliberately not here.
 *
 * Some guerillamap layers sit behind a membership. If a layer renders empty in
 * the frame, check that before assuming the id is wrong.
 */
const GM_HOME = "https://guerillamap.com/";
const GM_GRID = "-0.35,0.5,10,10,null,null";
const GM_BASEMAP = "esri-aerial-layer";
const GM_OVERLAYS = [
  "feature_group_ppcoal", "feature_group_ppgas", "feature_group_ppoil",
  "feature_group_oilgaswells", "feature_group_refineries", "feature_group_pipelines",
  "feature_group_ppnuc", "feature_group_nuctests",
  "feature_group_FIRMS", "feature_group_borders",
].join(",");

// Their panel is wider and shorter than this map, so handing it the same centre
// puts the ground higher in their frame than in ours. Dropped south by a share
// of their own frame height — a proportion, not a fixed number of degrees, so it
// holds at every zoom. gmShift(0) turns it off.
let GM_SHIFT = 0.22;
let gmOpen = false, gmTimer = null, gmLast = "";

function gmUrl() {
  let lat = 20, lon = 10, z = 3;
  try {
    const c = map.getCenter();
    lat = c.lat; lon = c.lng;
    z = Math.max(2, Math.min(18, Math.round(map.getZoom())));
  } catch (e) { /* map not ready; the defaults stand */ }
  try {
    const f = document.getElementById("gmFrame");
    const hpx = (f && f.clientHeight) || 260;
    // Web Mercator: a pixel is (360 / 256·2^z) degrees of longitude, and that
    // many degrees of latitude narrowed by cos(lat).
    const degPerPx = (360 / (256 * Math.pow(2, z))) * Math.cos(lat * Math.PI / 180);
    lat = Math.max(-78, Math.min(82, lat - GM_SHIFT * hpx * degPerPx));
  } catch (e) { /* no frame yet; centre as-is */ }

  return GM_HOME + "?coords=" + encodeURIComponent(lat.toFixed(5) + "," + lon.toFixed(5)) +
         "&zoom=" + z +
         "&grid=" + encodeURIComponent(GM_GRID) +
         "&basemap=" + GM_BASEMAP +
         "&overlays=" + encodeURIComponent(GM_OVERLAYS);
}

window.gmShift = (v) => { if (v != null) GM_SHIFT = v; gmSync(true); return GM_SHIFT; };

function gmSync(force) {
  if (!gmOpen) return;
  const follow = document.getElementById("gmFollow");
  if (!force && !(follow && follow.checked)) return;
  const url = gmUrl();
  if (url === gmLast) return;          // same view: do not reload them for nothing
  gmLast = url;
  const f = document.getElementById("gmFrame");
  const out = document.getElementById("gmOut");
  const wait = document.getElementById("gmWait");
  if (out) out.href = url;
  if (!f) return;
  if (wait) wait.hidden = false;
  f.addEventListener("load", () => { if (wait) wait.hidden = true; }, { once: true });
  // Wait a frame: assigning src before the panel has been laid out leaves their
  // app measuring a zero-height box and drawing nothing into it.
  requestAnimationFrame(() => { f.src = url; });
}

function gmSetOpen(open) {
  const el = document.getElementById("gm");
  const canvas = document.getElementById("map");
  if (!el || !canvas) return;
  gmOpen = open;
  el.hidden = !open;
  // The container changed size, so MapLibre has to re-measure or the canvas
  // keeps the old dimensions and the mouse lands in the wrong place.
  if (typeof map.resize === "function") map.resize();
  if (open) gmSync(true);
}

function gmInit() {
  const close = document.getElementById("gmClose");
  if (close) close.addEventListener("click", () => {
    const cb = document.querySelector("[data-gm]");
    if (cb) cb.checked = false;
    gmSetOpen(false);
    if (typeof buildLegend === "function") buildLegend();
  });
  // The strip and the bar size the panel, as on the other outside pages.
  const panel = document.getElementById("gm"), frame = document.getElementById("gmFrame");
  let drag = null;
  const grabbers = panel ? [panel.querySelector(".gm-grab"), panel.querySelector(".gm-bar")].filter(Boolean) : [];
  grabbers.forEach((g) => {
    g.addEventListener("pointerdown", (e) => {
      if (e.target.closest && e.target.closest("button, a, input, label")) return;
      drag = { y: e.clientY, h: panel.getBoundingClientRect().height };
      if (frame) frame.style.pointerEvents = "none";
      if (g.setPointerCapture) g.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    g.addEventListener("pointermove", (e) => {
      if (!drag) return;
      panel.style.height = `${Math.round(Math.max(90, Math.min(window.innerHeight - 40, drag.h + (drag.y - e.clientY))))}px`;
    });
    const end = () => { if (drag) { drag = null; if (frame) frame.style.pointerEvents = ""; } };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", end);
  });
  const follow = document.getElementById("gmFollow");
  if (follow) follow.addEventListener("change", () => gmSync(true));

  // Opened from its own row in the panel rather than on by default: it is a
  // third-party frame that fetches on load, and one that fails should not be
  // the first thing a reader meets.
  const box = document.getElementById("layers");
  if (!box) return;
  const row = document.createElement("label");
  row.className = "layer";
  row.innerHTML =
    `<input type="checkbox" data-gm="1">` +
    `<span class="swatch" style="background:#6E7B84"></span>` +
    `<span class="body"><span class="nm">Guerillamap overlays</span>` +
    `<span class="un">fossil fuel and nuclear infrastructure, active fires — ` +
    `loads guerillamap.com in a frame</span></span>`;
  box.appendChild(row);
  box.addEventListener("change", (e) => {
    if (e.target && e.target.dataset && e.target.dataset.gm) gmSetOpen(e.target.checked);
  });
}

map.on("load", gmInit);
map.on("load", buildLegend);
map.on("load", () => setTimeout(abattoirPartsInit, 0));
map.on("load", () => setTimeout(mymapsTitles, 50));

// The site each row is read from, linked beside its title. A reader looking at
// a row should be one click from the people who published it - that is what
// makes a claim checkable rather than something this map asserts. Your own maps
// point at the repo or the page they are read from; everyone else's at their
// own site. A row missing from here shows no link rather than a guessed one.
const LAYER_SITE = {
  atlas_cities: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/",
  atlas_hotspots: "https://atlas-for-the-end-of-the-world.com/hotspots/",
  biosignature: "https://github.com/WelcomeToYourGalaxy/maps",
  building_types: "https://github.com/WelcomeToYourGalaxy",
  capture_map: "https://github.com/WelcomeToYourGalaxy/maps",
  dff: "https://deforestationfreefunds.org",
  esa_risk: "https://neo.ssa.esa.int/risk-list-plots",
  fertilizer_facilities: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/fertilizer_facilities.html",
  gfw_catalogue: "https://www.globalforestwatch.org",
  giga_countries: "https://giga.global",
  gpw_map: "https://globalplasticwatch.org/map",
  gta_acts: "https://globaltradealert.org",
  mymaps_supp_a: "https://www.google.com/maps/d/viewer?mid=1vrnqSW4cWWdnjz6cJ-qFMmd0zbJzYd6V",
  pe_bankrolling: "https://portfolio.earth/campaigns/bankrolling-extinction/",
  pe_subsidising: "https://portfolio.earth/campaigns/subsidising-extinction/",
  powerbi_report: "https://app.powerbi.com/view?r=eyJrIjoiZGJmNGIwODgtMTgyMS00NmVlLWJmNWUtZTAzZDBlMmQ1ODI2IiwidCI6IjBiMzNkZjAwLTYzNGMtNDBlYy1iOGQ5LTZhMGI2MjYyNmU1ZCJ9",
  seas_of_plastic: "https://app.dumpark.com/seas-of-plastic-2/",
  skytruth_monitor: "https://monitor.skytruth.org/",
  skytruth_voc: "https://monitor.skytruth.org/",
  skytruth_nrc: "https://monitor.skytruth.org/",
  skytruth_posts: "https://monitor.skytruth.org/",
  skytruth_marine_incidents: "https://monitor.skytruth.org/",
  skytruth_pa_permits: "https://monitor.skytruth.org/",
  skytruth_pa_spud: "https://monitor.skytruth.org/",
  skytruth_pa_violations: "https://monitor.skytruth.org/",
  skytruth_well_permits: "https://monitor.skytruth.org/",
  skytruth_fracfocus: "https://monitor.skytruth.org/",
  skytruth_quakes: "https://monitor.skytruth.org/",
  skytruth_tests: "https://monitor.skytruth.org/",
  soy_organizations: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/soy_organizations.html",
  tableau_zsf: "https://public.tableau.com/shared/ZSF724HPQ",
  theyrule: "https://theyrule.net/",
  troutwood: "https://map.troutwood.com/",
  abattoir_facilities: "https://raw.githubusercontent.com/WelcomeToYourGalaxy/abattoir-atlas/main/out/facilities.json.gz",
  allen_coral: "https://allencoralatlas.org",
  atlas_cities: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/",
  atlas_hotspots: "https://atlas-for-the-end-of-the-world.com/hotspots/",
  bocc: "https://www.bankingonclimatechaos.org/?bank=JPMorgan%20Chase#fulldata-panel",
  carbon_bombs: "https://github.com/dataforgoodfr/CarbonBombs",
  carbon_majors: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/destruction_embed_3_leaflet-map.html",
  carbon_plumes: "https://carbonmapper.org",
  cerulean_slicks: "https://cerulean.skytruth.org",
  cerulean_sources: "https://cerulean.skytruth.org",
  cfr_tracker: "https://public.tableau.com/views/CFRGlobalMonetaryPolicyTrackerNEW/GlobalMonetaryPolicyTracker?:showVizHome=no&:embed=y",
  ct_pop: "https://tiles.climatetrace.org/ghsl-pop-1km/all",
  dff: "https://deforestationfreefunds.org",
  ejatlas: "https://ejatlas.org/api/v1/conflicts/",
  epa_tri_sites: "https://data.epa.gov/efservice/tri_facility",
  epa_widget: "https://geopub.epa.gov/arcgis/rest/services/EMEF/efpoints/MapServer",
  esa_risk: "https://neo.ssa.esa.int/risk-list-plots",
  final_nail: "https://finalnail.com/wp-json/wpgmza/v1/features/",
  fishing: "https://globalfishingwatch.org",
  fortune500: "https://interactives.fortune.com/global_500_2024/dashboard/index.html",
  fractracker_refineries: "https://www.fractracker.org",
  gem_coal: "https://github.com/GreenInfo-Network/coal-tracker-client",
  gfw_catalogue: "https://data-api.globalforestwatch.org",
  glad_loss: "https://storage.googleapis.com/earthenginepartners-hansen/tiles/gfc_v1.12/loss_alpha",
  gmo_cultivation: "https://github.com/WelcomeToYourGalaxy/GMO-map",
  gmo_gmofree: "https://github.com/WelcomeToYourGalaxy/GMO-map",
  gmo_incidents: "https://github.com/WelcomeToYourGalaxy/GMO-map",
  gmo_regime: "https://github.com/WelcomeToYourGalaxy/GMO-map",
  gmo_treaties: "https://github.com/WelcomeToYourGalaxy/GMO-map",
  gmo_trials: "https://github.com/WelcomeToYourGalaxy/GMO-map",
  gpw_map: "https://globalplasticwatch.org/map",
  gsn: "https://api.gsn.naturedatalab.org/geo-analysis/layers",
  gsn_rankings: "https://www.globalsafetynet.app/rankings/",
  land_matrix: "https://landmatrix.org/api",
  local_projects: "https://github.com/WelcomeToYourGalaxy/local-map",
  mymaps_chlorine: "https://www.google.com/maps/d/kml?mid=1PwPKisRf73FPC6hTtZDCv2s_B6_x0Pk7&forcekml=1",
  mymaps_supp_a: "https://www.google.com/maps/d/kml?mid=1vrnqSW4cWWdnjz6cJ-qFMmd0zbJzYd6V&forcekml=1",
  mymaps_supp_b: "https://www.google.com/maps/d/kml?mid=1seBCggQGg1tcRYpqpZ5ZKJaxHs4&forcekml=1",
  mymaps_trees: "https://www.google.com/maps/d/kml?mid=1c-vPoGf79mfQezTgcFoKb-xN4A4&forcekml=1",
  nusantara: "https://map.nusantara-atlas.org/geoserver/atlas-workspace-v3/wms",
  owid_co2: "https://github.com/owid/co2-data",
  palmwatch: "https://palmwatch.inclusivedevelopment.net/",
  pe_bankrolling: "https://portfolio.earth/campaigns/bankrolling-extinction/",
  pe_subsidising: "https://portfolio.earth/campaigns/subsidising-extinction/",
  pirg_plastic: "https://pirg.org/resources/where-is-plastic-produced/",
  power_plants: "https://github.com/wri/global-power-plant-database",
  powerbi_report: "https://app.powerbi.com/view?r=eyJrIjoiZGJmNGIwODgtMTgyMS00NmVlLWJmNWUtZTAzZDBlMmQ1ODI2IiwidCI6IjBiMzNkZjAwLTYzNGMtNDBlYy1iOGQ5LTZhMGI2MjYyNmU1ZCJ9",
  remains_cemeteries: "https://github.com/WelcomeToYourGalaxy/remains",
  remains_findings: "https://github.com/WelcomeToYourGalaxy/remains",
  remains_records: "https://github.com/WelcomeToYourGalaxy/remains",
  rte_trade: "https://api.resourcetrade.earth/api/rt/2.7",
  scribd_doc: "https://www.scribd.com/embeds/401203705/content?start_page=1&view_mode=scroll&access_key=key-9NzI5oK8PppZP3Bfluct",
  seas_of_plastic: "https://app.dumpark.com/seas-of-plastic-2/app/data/AllStations.geojson",
  site_animal_fighting: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/destruction_embed_1_leaflet-map.html",
  site_animal_racing: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/racing-map-embed.html",
  site_animal_sacrifice: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/sacrifice_map.html",
  site_animal_tourism: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/suppression_embed_25_leaflet-map.html",
  site_banking_dynasties: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/suppression_embed_29_leaflet-map.html",
  site_central_banks: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/suppression_embed_18_leaflet-map.html",
  site_china_grain: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/destruction_embed_11_leaflet-map.html",
  site_circus: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/suppression_embed_26_leaflet-map.html",
  site_earmarked_funding: "https://github.com/WelcomeToYourGalaxy/maps",
  site_enslaved_microbes: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_enslaved_plants: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_export_credit: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_eyes_network: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_food_system: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_forest500_soy: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/destruction_embed_9_leaflet-map.html",
  site_indigenous_conflicts: "https://github.com/WelcomeToYourGalaxy/maps",
  site_insentient: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_research_integrity: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_rodeo: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_secret_societies: "https://www.welcometoyourgalaxy.com/on-planet-invasion.html",
  site_settler_colonialism: "https://github.com/WelcomeToYourGalaxy/maps",
  site_social_spheres: "https://github.com/WelcomeToYourGalaxy/maps",
  site_soybean_companies: "https://github.com/WelcomeToYourGalaxy/maps/blob/main/soybean_companies.html",
  site_trade_profits: "https://github.com/WelcomeToYourGalaxy/maps",
  site_wealth_atlas: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_world_advertising: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_world_entertainment: "https://www.welcometoyourgalaxy.com/suppression.html",
  site_world_news: "https://www.welcometoyourgalaxy.com/suppression.html",
  skytruth_monitor: "https://monitor.skytruth.org/",
  slavery_cases: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
  slavery_determinations: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
  slavery_enforcement: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
  slavery_fishing: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
  slavery_ports: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
  slavery_prevalence: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
  slavery_routes: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
  slavery_sites: "https://github.com/WelcomeToYourGalaxy/anti-slavery-map",
  soilgrids: "https://maps.isric.org/mapserv?map=/map",
  tableau_zsf: "https://public.tableau.com/shared/ZSF724HPQ?:showVizHome=no&:embed=y",
  theyrule: "https://theyrule.net/",
  trase_cocoa_ivory: "https://trase.earth/open-data",
  trase_measures: "https://resources.trase.earth/data/trase-regions",
  trase_meat_brazil: "https://trase.earth/open-data",
  trase_palm_indonesia: "https://trase.earth/open-data",
  trase_pulp_concessions_2015: "https://trase.earth/open-data",
  trase_pulp_concessions_2020: "https://trase.earth/open-data",
  trase_pulp_concessions_2023: "https://trase.earth/open-data",
  trase_pulp_indonesia: "https://trase.earth/open-data",
  trase_silos_brazil: "https://trase.earth/open-data",
  troutwood: "https://map.troutwood.com/",
  usda_corn: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerCorn/MapServer",
  usda_soybean: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerSoybean/MapServer",
  wreckers_umap: "https://umap.openstreetmap.fr/en",
};
function siteLink(id) {
  const u = LAYER_SITE[id];
  if (!u) return "";
  let host = u;
  try { host = new URL(u).hostname.replace(/^www\./, ""); } catch (e) { /* shown whole */ }
  return `<a class="src" href="${escapeHtml(u)}" target="_blank" rel="noopener" ` +
    `title="Open ${escapeHtml(host)}" aria-label="Open ${escapeHtml(host)}, the source of this layer">\u2197</a>`;
}

// Which rows read their source as you look at them, rather than a copy kept
// here. A reader cannot tell by looking, and the difference matters: a live row
// shows what the source says right now and goes dark when the source does; a
// copy is as old as its last build. Archives, sitemaps, shapes and country
// shadings are copies and carry no mark.
const LIVE_ROUTES = new Set([
  "worker", "tile", "wmts", "rasterlive", "cerulean", "coral", "carbonmapper",
  "arcgis", "arcgisdyn", "arcgisapp", "umap", "kml", "ll2", "ejatlas", "geojsonlive",
  "wpgmza", "atlascities", "trase", "trasefac", "wmsmenu", "gfwmenu", "giga", "gta",
  "rte", "owidgrapher", "spheres", "companion",
]);
// A row's longer description sits behind a small "i" beside its other marks.
// It used to be the whole row's hover text, which popped up over the list every
// time the pointer crossed it; an ordinary row's note was shown nowhere at all.
function infoMark(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return `<span class="info" tabindex="0" role="note" aria-label="About this layer" data-tip="${escapeHtml(t)}">i</span>`;
}
function wireInfoMarks() {
  const box = document.getElementById("layers");
  if (!box || !box.addEventListener || box.dataset.infoWired) return;
  box.dataset.infoWired = "1";
  const tip = document.createElement("div");
  tip.id = "row-tip";
  tip.hidden = true;
  document.body.appendChild(tip);
  const show = (el) => {
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const r = el.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 24);
    tip.style.width = w + "px";
    tip.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + "px";
    const below = r.bottom + 8, h = tip.getBoundingClientRect().height;
    tip.style.top = (below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 8) : below) + "px";
  };
  const over = (e) => { const el = e.target && e.target.closest ? e.target.closest(".info") : null; if (el) show(el); };
  const out = (e) => { if (e.target && e.target.closest && e.target.closest(".info")) tip.hidden = true; };
  box.addEventListener("mouseover", over);
  box.addEventListener("focusin", over);
  box.addEventListener("mouseout", out);
  box.addEventListener("focusout", out);
  // The mark sits inside the row's label: a click on it must not tick the row.
  box.addEventListener("click", (e) => { if (e.target && e.target.closest && e.target.closest(".info")) e.preventDefault(); });
}

function liveMark(cfg) {
  if (!cfg || !LIVE_ROUTES.has(cfg.route)) return "";
  return `<span class="live" title="Read from the source itself when this row is ticked, not from a copy kept here">LIVE</span>`;
}

/* ---------- the layers box, in the order and under the headings chosen ---------- */
// Strings are layer ids; "group:" a whole group; "gm" the guerillamap row.
// { h: level, t: text } is a heading. Anything not named here goes under
// "Not yet placed" at the end, so nothing disappears unseen; ids in
// PANEL_REMOVED are taken out of the box.
const PANEL_ORDER = [
  { h: 1, t: "On-planet invasion" },
  { h: 2, t: "Pre-birth frontlines" },
  { h: 3, t: "Genetic engineering" }, "gmo_env", "gmo_decisions", "gmo_ogtr", "gmo_cultivation", "gmo_gmofree", "gmo_incidents", "gmo_regime", "gmo_treaties", "gmo_trials",
  { h: 3, t: "Human reproduction and gene therapy" }, "gmo_therapy", "gmo_fertility",
  { h: 2, t: "Post-birth invasion" },
  { h: 3, t: "Invasion of nonhumans" },
  { h: 3, t: "Invasion of humans" }, "site_settler_colonialism", "site_indigenous_conflicts",
  { h: 3, t: "Of countries by countries" }, "site_secret_societies", "gm",
  { h: 2, t: "Post-life invasion" }, "remains_records", "remains_findings", "remains_cemeteries",

  { h: 1, t: "Destruction" },
  { h: 2, t: "Of the planet" },
  { h: 3, t: "General" }, "ejatlas", "wreckers_umap", "fortune500", "theyrule",
  // Climate is arranged by greenhouse gas, in the Destruction page's own order
  // (22 September): a row goes under the gas its sites mainly emit, and a row
  // whose sites emit more than one in earnest is under Infrastructure, or
  // copied under each gas. The Climate TRACE groups carry each site's CO2e
  // total, not a figure per gas, so they are placed by their sectors' main
  // gas; a true per-gas split waits on the per-gas columns the source
  // publishes (they now reach the pieces, not yet the tiles).
  { h: 3, t: "Climate" },
  // The Climate TRACE groups stay by sector until each site is split by the
  // gas it emits (22 September): filed under one gas each, the gases a
  // sector also emits were drowned out.
  { h: 4, t: "Emitting sites by sector, until split by gas" }, "group:climate_trace_sectors", "group:climate_trace_agriculture", "group:climate_trace_forestry", "group:ct_history",
  // Carbon bombs, the Carbon Majors and Banking on Climate Chaos under Carbon
  // dioxide, and nitrogen dioxide moved to Pollution (22 September, round 2).
  { h: 4, t: "Carbon dioxide" }, "owid_co2", "gem_coal", "power_plants", "fractracker_refineries", "carbon_plumes", "carbon_bombs", "carbon_majors", "bocc",
  { h: 4, t: "Methane" }, "carbon_plumes", "hydrowaste", "wastewater",
  { h: 4, t: "Nitrous oxide" }, "fertilizer_facilities",
  { h: 5, t: "Soy" }, "usda_soybean", "trase_silos_brazil",
  { h: 5, t: "Corn" }, "usda_corn",
  { h: 5, t: "Grain" }, "site_china_grain",
  { h: 4, t: "F-gases" },
  { h: 4, t: "Black carbon" }, "fractracker_refineries",
  // Oil and gas concessions (from the catalogues) are filed here as well as
  // under Oil and gas drilling: the wells emit carbon dioxide, methane and,
  // where gas is flared, black carbon.
  { h: 4, t: "Infrastructure emitting more than one gas" },
  { h: 3, t: "Overpopulation" }, "ct_pop",
  // Pollution by pollutant, as Climate is by gas (22 September, round 2).
  // Climate TRACE's air-pollution row covers every pollutant it reports and
  // sits under General until it is split into a row per pollutant.
  { h: 3, t: "Pollution" },
  { h: 4, t: "General and all pollutants" }, "ct_air", "epa_tri_sites", "epa_widget",
  { h: 4, t: "Nitrogen dioxide" },
  { h: 4, t: "Wastewater" }, "hydrowaste", "wastewater",
  { h: 4, t: "Plastics" },
  { h: 5, t: "Production" }, "pirg_plastic", "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch",
  { h: 5, t: "Waste and dumping" }, "gpw_map", "seas_of_plastic", "coastal_cleanup",
  { h: 4, t: "Oil spills and slicks" },
  { h: 5, t: "Terrestrial slicks" }, "skytruth_monitor", "skytruth_nrc", "skytruth_posts",
  { h: 5, t: "Marine slicks" }, "cerulean_slicks", "cerulean_sources", "slick_archive", "skytruth_voc", "skytruth_marine_incidents", "skytruth_posts",
  { h: 3, t: "Fire" },
  { h: 3, t: "Deforestation" },
  { h: 4, t: "Tree cover loss and alerts" }, "glad_loss", "group:forest_alerts",
  { h: 4, t: "Moratoriums" },
  { h: 4, t: "Wood pulp, Indonesia" }, "trase_pulp_indonesia", "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023",
  { h: 4, t: "Companies and financiers" }, "site_forest500_soy", "site_soybean_companies", "soy_organizations", "dff",
  { h: 3, t: "Biodiversity loss" }, "gsn", "gsn_rankings", "atlas_hotspots", "atlas_cities", "powerbi_report",
  { h: 4, t: "Fish" },
  { h: 4, t: "Companies and financiers" }, "pe_subsidising", "pe_bankrolling",
  { h: 3, t: "Spatial plans" },
  { h: 3, t: "Peatland" },
  { h: 3, t: "Surface water" },
  { h: 3, t: "Mining" }, "mines_global",
  { h: 3, t: "Oil and gas drilling" },
  { h: 4, t: "Pennsylvania" }, "skytruth_pa_permits", "skytruth_pa_spud", "skytruth_pa_violations", "skytruth_well_permits",
  { h: 4, t: "United States" }, "skytruth_fracfocus",
  { h: 3, t: "Meat and agriculture" }, "site_food_system",
  { h: 4, t: "Agriculture" },
  { h: 5, t: "Palm oil" }, "palmwatch", "trase_palm_indonesia",
  { h: 5, t: "Soy, corn and grain" }, "trase_silos_brazil", "usda_soybean", "usda_corn", "site_china_grain",
  { h: 5, t: "Cocoa and cotton" }, "trase_cocoa_ivory",
  { h: 5, t: "Farm inputs" }, "fertilizer_facilities",
  { h: 5, t: "Moratoriums" },
  { h: 5, t: "Detailed spatial plans, Badung" },
  { h: 4, t: "Meat" },
  { h: 5, t: "Facilities" }, "abattoir_facilities", "trase_meat_brazil", "abattoir_cafo",
  { h: 5, t: "Herds" }, "abattoir_glw",
  { h: 3, t: "Oceans" },
  { h: 4, t: "Reefs and mangroves" }, "allen_coral",
  { h: 4, t: "Fishing" }, "fishing",
  { h: 3, t: "Construction" }, "local_projects",
  { h: 3, t: "Other" },
  { h: 2, t: "Of groups" },
  { h: 3, t: "Of humans" },
  { h: 3, t: "Of animals" }, "final_nail",
  { h: 3, t: "Of plants" },
  { h: 3, t: "Of microorganisms" },
  { h: 3, t: "Of the “insentient”" },
  { h: 2, t: "Of individuals" },
  { h: 3, t: "Of humans" },
  { h: 3, t: "Of animals" }, "site_animal_sacrifice",
  { h: 3, t: "Of plants" },
  { h: 3, t: "Of microscopics" },

  { h: 1, t: "Suppression" },
  { h: 2, t: "Of humans" },
  { h: 3, t: "Land and territory" }, "land_matrix",
  { h: 3, t: "Physical suppression" },
  { h: 4, t: "Control of physical resources" },
  { h: 5, t: "Banks and monetary power" }, "site_central_banks", "site_banking_dynasties", "cfr_tracker", "tableau_zsf", "site_export_credit", "troutwood",
  { h: 5, t: "Trade" }, "site_trade_profits", "rte_trade", "gta_acts",
  { h: 5, t: "Funding of international bodies" }, "site_earmarked_funding",
  { h: 4, t: "Economic inequality within it" },
  { h: 5, t: "Wealth concentration" }, "site_wealth_atlas", "site_social_spheres",
  { h: 5, t: "Public finance and tax" }, "owid_interest", "owid_corptax", "owid_aid",
  { h: 5, t: "School" }, "giga_countries",
  { h: 4, t: "Law enforcement" },
  { h: 4, t: "Courts and corrections" },
  { h: 4, t: "Discrimination" },
  { h: 4, t: "Slavery" },
  { h: 5, t: "Prevalence" }, "slavery_prevalence",
  { h: 5, t: "Sites on land" }, "slavery_sites",
  { h: 5, t: "At sea" }, "slavery_ports", "slavery_fishing",
  { h: 5, t: "Routes, cases and enforcement" }, "slavery_routes", "slavery_cases", "slavery_determinations", "slavery_enforcement",
  { h: 3, t: "Suppression by “representation” within it" },
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
  { h: 4, t: "Metaphysical (Religion, spirituality, etc.)" }, "site_eyes_network",
  { h: 4, t: "Sports" },
  { h: 4, t: "Holidays" },
  { h: 4, t: "Sex" },
  { h: 4, t: "Drugs" }, "capture_map",
  { h: 2, t: "Of animals" },
  { h: 3, t: "Slavery" }, "gmo_animal_research", "gmo_animal_trade",
  { h: 3, t: "Spectacle and sport" }, "site_animal_fighting", "site_circus", "site_animal_racing", "site_rodeo", "site_animal_tourism",
  { h: 3, t: "Other" }, "mymaps_supp_b",
  { h: 3, t: "The pet industry" }, "mymaps_supp_a",
  { h: 2, t: "Of plants" }, "site_enslaved_plants", "mymaps_trees",
  { h: 2, t: "Of microscopics" }, "site_enslaved_microbes",
  { h: 2, t: "Of the “insentient”" }, "site_insentient",

  { h: 1, t: "Off-planet invasion" },
  { h: 2, t: "To Earth" },
  { h: 3, t: "Near-Earth object impacts" }, "esa_risk",
  { h: 3, t: "Unidentified aerial phenomena" },
  { h: 2, t: "From Earth" },
  { h: 3, t: "The space industry" }, "space_industry",
  { h: 3, t: "Space launches" }, "ll2_pads", "ll2_upcoming",
  { h: 3, t: "Protecting extraterrestrial life" }, "biosignature",

  { h: 1, t: "Base and reference" },
  { h: 2, t: "Boundaries and relief" },
  { h: 2, t: "Physical and human geography" }, "soilgrids", "skytruth_quakes",
  { h: 2, t: "Housekeeping" }, "skytruth_tests",

  { h: 1, t: "Buildings" }, "building_types",
];
const PANEL_REMOVED = new Set([
  "leverage_chart",
  "cultivated_meat_laws",          // taken out 22 September at the owner's request
  "scribd_doc",                    // the Destruction page document, taken out 22 September (round 2)
  // Taken out 19 Sept: near duplicates, a background map mistaken for data, rows
  // merged into another, and pages asked to be removed.
  "site_cartel_cells", "site_export_credit_shading", "giga_schools", "nsf_locations",
  "ect_secrets", "isds_tracker", "bffp_audit", "epa_tri", "unep_coral",
  // Split into its registers (gmo_env and the rows after it) on 20 September.
  "gmo_releases",
  // Removed at the owner's request, 20 September.
  "acgf",
  // Their layers are rows of the box now, filed by subject, so the row that
  // used to carry the menu would be an empty husk. It is kept out of sight
  // rather than deleted: its layers still read their visibility from it, and
  // ticking one of them still turns it on where nobody has to see it.
  "nusantara", "gfw_catalogue",
  // The same for Trase's measures: each is a row of its own now, one layer
  // across every country that publishes it, filed by what it measures.
  "trase_measures",
  // The same upcoming launches and the same pads as the two Launch Library 2
  // rows, but as framed pages rather than on the map.
  "wrf", "nsf_launches",
  // Replaced by carbon_plumes, which reads Carbon Mapper's own platform rather
  // than the handful of plumes listed on our page.
  "site_carbon_mapper_waste",
  // Its own map in a panel, replaced by the love_ rows under Construction,
  // which draw the same material on this map.
  "live_projects_app",
  "fin_bank", "fin_centralbank", "fin_taxoffice", "fin_govfinance", "fin_financial", "fin_exchange", "fin_insurance", "fin_accountant", "fin_remittance", "fin_stockexchange", "fin_auditoffice", "fin_devbank", "fin_mint", "legal_publicdefender", "legal_immigration", "legal_probation", "legal_juvenile", "leg_parliament", "leg_audit", "leg_electoral", "leg_ombudsman", "leg_council", "exec_firestation", "exec_townhall", "leg_townhall", "exec_govoffice", "exec_ministry", "exec_diplomatic", "exec_border", "jud_courts", "legal_courthouse", "slavery_facilities", "activist_courts", "exec_police", "legal_police", "activist_police", "exec_prison", "legal_prison", "jud_prisons", "activist_prisons",
  "site_ufo_pre1900", "site_subsistence_cultures", "site_self_sufficiency", "slavery_trackers",
  "site_environment_law", "enviro_law_by_country", "site_environment_law_shapes", "gov_official_map",
  "group:executive_map_layers", "group:money_map_layers", "group:legal_map_layers",
  "group:legislative_map_layers", "group:judicial_map_layers",
  "legal_by_state", "leg_by_state", "judicial_by_state", "leg_subnational", "leg_county",
  "leg_municipal", "leg_municipal_recover", "leg_laws",
]);

// A heading's tick reads its layers, never the other way round: all on, none
// on, or part-way, which is the only honest rendering of a heading holding
// some ticked rows.
function syncHeadingBoxes(box) {
  if (!box || !box.querySelectorAll) return;
  for (const sec of box.querySelectorAll(".toc-sec")) {
    const all = sec.querySelector(".toc-all");
    if (!all) continue;
    const boxes = [...sec.querySelectorAll("[data-layer]")];
    const on = boxes.filter((i) => i.checked).length;
    all.checked = boxes.length > 0 && on === boxes.length;
    all.indeterminate = on > 0 && on < boxes.length;
    all.disabled = boxes.length === 0;
  }
}

// A second home for a row already placed elsewhere. The copy is the row's own
// markup with its tick renamed, so it cannot be mistaken for the row itself by
// anything that reads [data-layer]; its chips and menus stay with the original,
// which is where a row's own controls belong.
function copyRow(lead, id) {
  if (!lead || typeof lead.cloneNode !== "function") return null;
  const first = lead.querySelector ? lead.querySelector("[data-layer]") : null;
  const copy = lead.cloneNode(true);
  copy.classList.add("layer-copy");
  const input = copy.querySelector("[data-layer]");
  if (input) {
    input.removeAttribute("data-layer");
    input.dataset.copy = id;
    input.checked = first.checked;
  }
  for (const tool of copy.querySelectorAll(".grip, .fold")) tool.remove();
  return copy;
}

// Every copy of a row reads what the row reads.
function syncCopies(box, id, on) {
  for (const i of box.querySelectorAll(`[data-copy="${id}"]`)) i.checked = on;
}

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


// ▲ ▼ and a transparency slider for every layer row, shown while it is ticked.
function rowLead(el) { return el && (el.tagName === "LABEL" && el.querySelector("[data-layer]") || (el.classList && el.classList.contains("group"))) ? el : null; }
function rowIdOf(lead) {
  const i = lead.querySelector("[data-layer]") || lead.querySelector("[data-group]");
  return i ? (i.dataset.layer || i.dataset.group) : null;
}
function rowNodes(lead) {
  const out = [lead];
  let n = lead.nextElementSibling;
  while (n && n.classList && n.classList.contains("facet")) { out.push(n); n = n.nextElementSibling; }
  return out;
}
function rowLayerIds(lead) {
  if (lead.classList && lead.classList.contains("group")) {
    return [...lead.querySelectorAll("[data-layer]")].flatMap((i) => layersOfRow(i.dataset.layer));
  }
  return layersOfRow(rowIdOf(lead));
}
// dir "up" puts the row above `target` (on the list and on the map), "down"
// below it. With no target, the neighbouring row is used.
function moveRow(lead, dir, target) {
  const parent = lead.parentElement;
  const leads = [...parent.children].filter(rowLead);
  const at = leads.indexOf(lead);
  const other = target || leads[dir === "up" ? at - 1 : at + 1];
  if (!other || other === lead) return;
  const mine = rowNodes(lead);
  if (dir === "up") mine.forEach((n) => parent.insertBefore(n, other));
  else { const theirs = rowNodes(other); const after = theirs[theirs.length - 1].nextSibling; mine.forEach((n) => parent.insertBefore(n, after)); }
  // On the map: above the other row's layers when moved up, below them when moved down.
  const own = rowLayerIds(lead), them = rowLayerIds(other);
  if (!own.length || !them.length || typeof map.moveLayer !== "function") return;
  const order = map.getStyle().layers.map((l) => l.id);
  if (dir === "up") {
    const top = Math.max(...them.map((id) => order.indexOf(id)));
    const before = order.slice(top + 1).find((id) => !own.includes(id));
    own.forEach((id) => map.moveLayer(id, before));
  } else {
    const bottom = Math.min(...them.map((id) => order.indexOf(id)));
    own.forEach((id) => map.moveLayer(id, order[bottom]));
  }
  if (typeof wireOnTop === "function") wireOnTop();
}
function addRowTools(box) {
  for (const input of box.querySelectorAll("label > [data-layer]")) {
    const lead = input.closest("label");
    if (!lead || lead.closest("[data-removed]") || (lead.nextElementSibling && lead.nextElementSibling.classList.contains("row-tools"))) continue;
    const id = input.dataset.layer;
    const tools = document.createElement("div");
    tools.className = "facet row-tools";
    tools.dataset.for = id;
    tools.hidden = !input.checked;
    tools.innerHTML = `<input type="range" min="10" max="100" value="100" title="Transparency" aria-label="Transparency" style="flex:1;min-width:60px;accent-color:#8A9DA6">` +
      `<span class="rt-v" style="font-size:11px;color:var(--dim);min-width:32px;text-align:right">100%</span>`;
    const slider = tools.querySelector("input");
    slider.addEventListener("input", () => {
      const f = Number(slider.value) / 100;
      tools.querySelector(".rt-v").textContent = `${slider.value}%`;
      opacityFactor.set(id, f);
      layersOfRow(id).forEach((l) => applyOpacity(l, f));
    });
    // Unticking a row takes everything under it away too - its filters, its
    // kind lists, its month pickers, this slider - rather than leaving a stack
    // of controls for a layer that is no longer drawn. Ticking it again brings
    // them back exactly as they were.
    input.addEventListener("change", () => {
      tools.hidden = !input.checked;
      rowNodes(lead).slice(1).forEach((n) => n.classList.toggle("fold-hide", !input.checked));
      const f = lead.querySelector(".fold");
      if (f) f.textContent = input.checked && !lead.classList.contains("folded") ? "\u25B4" : "\u25BE";
    });
    lead.after(tools);
  }
  // Each row carries a grip; the row is dragged above or below the others
  // under the same heading, and its layers are drawn in the new order.
  for (const lead of box.querySelectorAll("label.layer, .group > .layer.parent")) {
    if (lead.closest("[data-removed]") || lead.querySelector(".grip")) continue;
    if (!lead.querySelector("[data-layer], [data-group]")) continue;
    // One control on every row, ticked or not: it pulls that row's sublayers
    // up out of sight and back down. On an ordinary row those are the boxes
    // underneath it (its sources, kinds, transparency); on a group's parent
    // row they are the group's children, which the triangle on the left also
    // shows and hides - both now say the same thing, so the arrow at the end
    // of the row means the same wherever it is.
    if (!lead.querySelector(".fold")) {
      const group = lead.classList.contains("parent");
      const kids = group ? lead.parentElement.querySelector("[data-kids]") : null;
      const f = document.createElement("button");
      f.type = "button";
      f.className = "fold";
      f.title = "Pull this layer's sublayers up or down";
      f.setAttribute("aria-label", "Pull this layer's sublayers up or down");
      f.textContent = group && kids && kids.hidden ? "\u25BE" : "\u25B4";
      f.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        let folded;
        if (group && kids) {
          const id = lead.querySelector("[data-group]").dataset.group;
          toggleGroup(box, id);
          folded = kids.hidden;
        } else {
          folded = !lead.classList.contains("folded");
          lead.classList.toggle("folded", folded);
          rowNodes(lead).slice(1).forEach((n) => n.classList.toggle("fold-hide", folded));
        }
        f.textContent = folded ? "\u25BE" : "\u25B4";
        f.setAttribute("aria-expanded", String(!folded));
      });
      lead.appendChild(f);
    }
    const g = document.createElement("span");
    g.className = "grip";
    g.title = "Drag to move this layer above or below the others";
    g.setAttribute("aria-hidden", "true");
    g.textContent = "\u2807";
    lead.appendChild(g);
  }
  rowDragging(box);
}

function rowDragging(box) {
  if (!box.dataset || box.dataset.drag) return;
  box.dataset.drag = "1";
  let drag = null, swallowClick = false;
  const unitOf = (el) => {
    const lead = el && el.closest && el.closest("label.layer, .group > .layer.parent");
    if (!lead || lead.closest("[data-removed]")) return null;
    return lead.classList.contains("parent") ? lead.parentElement : lead;
  };
  const clearMarks = () => box.querySelectorAll(".drop-above, .drop-below").forEach((n) => n.classList.remove("drop-above", "drop-below"));
  box.addEventListener("pointerdown", (e) => {
    if (e.button && e.button !== 0) return;
    const onGrip = e.target.closest && e.target.closest(".grip");
    if (!onGrip && e.target.closest && e.target.closest("input, select, button, a, .chip, .facet")) return;
    // Touch scrolls the list, so on touch only the grip drags.
    if (e.pointerType === "touch" && !onGrip) return;
    const unit = unitOf(e.target);
    if (!unit) return;
    drag = { unit, y: e.clientY, on: false, target: null, where: null };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.on) {
      if (Math.abs(e.clientY - drag.y) < 6) return;
      drag.on = true;
      drag.unit.classList.add("dragging");
    }
    e.preventDefault();
    clearMarks();
    drag.target = null;
    const over = unitOf(document.elementFromPoint(e.clientX, e.clientY));
    if (!over || over === drag.unit || over.parentElement !== drag.unit.parentElement) return;
    const r = over.getBoundingClientRect();
    drag.where = e.clientY < r.top + r.height / 2 ? "up" : "down";
    drag.target = over;
    over.classList.add(drag.where === "up" ? "drop-above" : "drop-below");
  }, { passive: false });
  const end = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    clearMarks();
    d.unit.classList.remove("dragging");
    if (!d.on) return;
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    if (d.target) moveRow(d.unit, d.where, d.target);
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  // A drag ends in a click on the row; it must not tick or untick it.
  box.addEventListener("click", (e) => { if (swallowClick) { e.preventDefault(); e.stopPropagation(); swallowClick = false; } }, true);
}

// Buildings sits at the foot of the layers box, held there while the rest
// scrolls above it, rather than as the last of the sections. It stays inside
// the box, so its rows keep every tool the others have.
// Headings are shown in title case: every word capitalised except short
// joining words, and the first word always; hyphenated parts each capitalised.
const TITLE_SMALL = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "vs"]);
function titleCase(t) {
  let first = true;
  return String(t).split(/(\s+)/).map((w) => {
    if (/^\s+$/.test(w) || !w) return w;
    const lead = w.match(/^[^A-Za-z\u00C0-\u024F]*/)[0], core = w.slice(lead.length);
    const out = !first && TITLE_SMALL.has(core.toLowerCase()) ? core.toLowerCase()
      : core.split("-").map((p) => p ? p[0].toUpperCase() + p.slice(1) : p).join("-");
    first = false;
    return lead + out;
  }).join("");
}
function pinBuildings(box) {
  const sec = [...box.querySelectorAll(".toc-sec.toc-l1")].find((x) => {
    const t = x.querySelector(".toc-t");
    return t && t.textContent.trim() === "Buildings";
  });
  if (!sec) return;
  sec.classList.add("toc-pinned");
  const gone = box.querySelector("[data-removed]");
  if (gone && gone.after) gone.after(sec); else box.appendChild(sec);
}

function arrangePanel() {
  const box = document.getElementById("layers");
  if (!box || !box.querySelector || typeof document.createDocumentFragment !== "function" || !box.dataset || box.dataset.arranged) return;
  box.dataset.arranged = "1";
  const frag = document.createDocumentFragment();
  const placed = new Set();
  // The row itself, kept so a second naming can copy it: by then it has been
  // moved into the fragment being built and is no longer found in the box.
  const leads = new Map();
  // Each heading is a section that folds; the rows under it go in its body,
  // nested by level. Every section starts folded shut.
  const stack = [{ level: 0, body: frag }];
  const heading = (h, t) => {
    while (stack.length > 1 && stack[stack.length - 1].level >= h) stack.pop();
    const sec = document.createElement("div");
    sec.className = `toc-sec toc-l${h}`;
    const head = document.createElement("button");
    head.type = "button";
    head.className = `toc-head panel-h panel-h${h}`;
    head.setAttribute("aria-expanded", "false");
    head.innerHTML = `<span class="toc-arrow">\u25B8</span><span class="toc-t">${escapeHtml(titleCase(t))}</span><span class="toc-n"></span>`;
    const body = document.createElement("div");
    body.className = "toc-body";
    body.hidden = true;
    head.addEventListener("click", (e) => {
      e.preventDefault();
      body.hidden = !body.hidden;
      head.setAttribute("aria-expanded", String(!body.hidden));
    });
    const line = document.createElement("div");
    line.className = "toc-line";
    // Every heading takes its own tick, at the end of its line: it turns on
    // every layer under it, sub-headings included, and unticking it turns all
    // of them off again. It sits beside the heading rather than inside it, so
    // opening a heading and turning its layers on stay separate actions - the
    // same reason a group's arrow and its box are separate. A heading with
    // many layers under it loads all of them, which the build queue paces.
    const all = document.createElement("input");
    all.type = "checkbox";
    all.className = "toc-all";
    all.title = "Show or hide every layer under this heading";
    all.setAttribute("aria-label", `Show or hide every layer under ${titleCase(t)}`);
    all.addEventListener("click", (e) => e.stopPropagation());
    all.addEventListener("change", () => {
      const on = all.checked;
      for (const i of body.querySelectorAll("[data-layer], [data-copy]")) {
        if (i.checked === on) continue;
        i.checked = on;
        if (typeof i.dispatchEvent === "function" && typeof Event === "function") i.dispatchEvent(new Event("change", { bubbles: true }));
      }
      // A group's own box follows its children rather than being left ticked
      // over layers that are no longer drawn.
      for (const g of body.querySelectorAll("[data-group]")) {
        g.checked = on;
        g.indeterminate = false;
      }
      syncHeadingBoxes(document.getElementById("layers"));
    });
    line.appendChild(head);
    line.appendChild(all);
    sec.appendChild(line);
    sec.appendChild(body);
    stack[stack.length - 1].body.appendChild(sec);
    stack.push({ level: h, body });
    return sec;
  };
  const into = () => stack[stack.length - 1].body;
  for (const item of PANEL_ORDER) {
    if (typeof item === "object" && item.note) {
      const n = document.createElement("div");
      n.className = "toc-note";
      n.textContent = item.note;
      into().appendChild(n);
      continue;
    }
    if (typeof item === "object") { heading(item.h, item.t); continue; }
    // A layer that belongs to two subjects is named twice in the order. The
    // first naming moves the row itself; every later one gets a copy that
    // mirrors it - tick either and the layer is drawn once, and both read the
    // same. Copies carry data-copy rather than data-layer, so nothing that
    // counts or drives layers sees a row twice.
    if (placed.has(item)) {
      const copy = copyRow(leads.get(item), item);
      if (copy) into().appendChild(copy);
      continue;
    }
    const nodes = panelNodes(box, item);
    nodes.forEach((n) => into().appendChild(n));
    if (nodes.length) { placed.add(item); leads.set(item, nodes[0]); }
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
  if (rest.childNodes.length) {
    stack.length = 1;
    const sec = heading(1, "Not yet placed");
    box.appendChild(sec);
    sec.querySelector(".toc-body").appendChild(rest);
  }
  syncHeadingBoxes(box);
  box.addEventListener("change", (e) => {
    if (e && e.target && e.target.dataset && (e.target.dataset.layer || e.target.dataset.group)) syncHeadingBoxes(box);
  });
  countHeadings(box);
  tail.filter((el) => el.classList && el.classList.contains("pending-note")).forEach((el) => box.appendChild(el));
  box.appendChild(gone);
  wireInfoMarks();
  readCataloguesAtStart();
  readSiteTypeRowsAtStart();
  pinBuildings(box);
  addRowTools(box);
  if (!document.getElementById("panel-h-style")) {
    const st = document.createElement("style");
    st.id = "panel-h-style";
    st.textContent = ".toc-line{display:flex;align-items:center;gap:6px}" +
      ".toc-line .toc-head{flex:1;text-align:left}" +
      ".toc-all{flex:none;accent-color:#8A9DA6;cursor:pointer}" +
      ".toc-all:disabled{opacity:.3;cursor:default}" +
      ".panel-h{margin:10px 0 4px;color:var(--ink,#e8e2d6)}" +
      ".panel-h1{font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-top:1px solid rgba(255,255,255,.18);padding-top:8px;font-weight:700}" +
      ".panel-h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;padding-left:4px;font-weight:600}" +
      ".panel-h3{font-size:11px;opacity:.8;padding-left:10px;font-weight:600}" +
      ".panel-h4{font-size:10.5px;opacity:.7;padding-left:16px;font-style:italic}" +
      ".panel-h5{font-size:10.5px;opacity:.62;padding-left:22px}" +
      "#layers label.layer,#layers .group>.layer.parent{cursor:grab;user-select:none}" +
      "#layers .fold{display:none;margin-left:auto;padding:0 4px;border:0;background:none;color:var(--dim);cursor:pointer;font-size:11px;line-height:1}" +
      "#layers label.layer:has(+ .facet) .fold{display:inline-block}" +
      "#layers .layer.parent .fold{display:inline-block}" +
      "#layers label.layer:has(+ .facet) .grip{margin-left:0}" +
      "#layers .facet.fold-hide{display:none}" +
      "#layers .grip{margin-left:auto;padding:0 2px 0 6px;color:var(--dim);opacity:.55;cursor:grab;touch-action:none;font-size:13px;line-height:1}" +
      "#layers .dragging{opacity:.45}" +
      "#layers .ns-list{display:block;padding:2px 0 6px 22px;max-height:340px;overflow:auto}" +
      "#layers .ns-cat{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:6px 0 2px}" +
      "#layers .ns-cat span{opacity:.7}" +
      "#layers .ns-row{display:flex;align-items:flex-start;gap:6px;margin:2px 0 2px 10px;font-size:12px;line-height:1.3;cursor:pointer}" +
      "#layers .ns-row input{margin:1px 0 0}" +
      "#layers .ns-row em{color:var(--dim);font-style:normal;font-size:11px}" +
      "#layers .toc-pinned{position:sticky;bottom:14px;z-index:2;background:#1F1C15;box-shadow:0 -6px 8px -4px rgba(0,0,0,.5);max-height:45vh;overflow:auto;margin-top:6px}" +
      "#layers .bt-kinds{display:block;padding:2px 0 6px 22px}" +
      "#layers .bt-all{display:flex;gap:4px;margin:2px 0 4px}" +
      "#layers .bt-kind{display:flex;align-items:center;gap:6px;margin:2px 0;font-size:12px;line-height:1.3;cursor:pointer}" +
      "#layers .bt-kind input{margin:0}" +
      "#layers .bt-kind i{width:10px;height:10px;border-radius:2px;flex:none}" +
      "#layers .bt-kind em{margin-left:auto;font-style:normal;color:var(--dim);font-size:11px}" +
      "#layers .drop-above{box-shadow:0 -2px 0 0 #8A9DA6}#layers .drop-below{box-shadow:0 2px 0 0 #8A9DA6}";
    document.head.appendChild(st);
  }
}
// Beside each heading, how many rows are inside it. Counted again whenever rows
// arrive later - the catalogues' and the site maps' type rows are added after
// the box is arranged, and four headings that held only such rows (Land held
// under permit, Spatial plans, Peatland, Surface water) read "none yet" with
// dozens of layers under them.
const ROW_TICKS = "[data-layer], [data-copy], [data-gm], [data-cat], [data-cat-copy], [data-smtype]";
function countHeadings(box) {
  box = box || document.getElementById("layers");
  if (!box || !box.querySelectorAll) return;
  for (const sec of box.querySelectorAll(".toc-sec")) {
    const n = [...sec.querySelectorAll(ROW_TICKS)].filter((i) => !(i.closest && i.closest("[data-removed]"))).length;
    const el = sec.querySelector(".toc-n");
    if (el) el.textContent = n ? String(n) : "none yet";
  }
}

// The catalogues' own rows are out of sight (PANEL_REMOVED) and lazy, and a lazy
// row is only built when it is ticked - so nothing ever asked Nusantara, Global
// Forest Watch or Trase for their lists, and their hundreds of rows never
// reached the box unless "All on" happened to tick the hidden rows too. Their
// lists are read once the box is arranged. Reading a list draws nothing and
// ticks nothing: a catalogue draws only what is ticked under it.
const CATALOGUE_ROUTES = new Set(["wmsmenu", "gfwmenu", "trase"]);
function readCataloguesAtStart() {
  for (const g of GROUPS) for (const c of g.children) {
    if (c.ready && CATALOGUE_ROUTES.has(c.route) && PANEL_REMOVED.has(c.id)) ensureLayer(c);
  }
}
map.on("load", () => setTimeout(arrangePanel, 0));

// The layers box runs down to the "Showing" box; the news wires box starts
// under the view box. Both follow those boxes' heights as they change.
function trackBoxHeights() {
  const root = document.documentElement;
  const legend = document.getElementById("legend");
  const view = document.getElementById("basemaps");
  const col = document.querySelector(".right-col");
  if (!root || !root.style || typeof ResizeObserver === "undefined") return;
  const set = () => {
    const lh = legend && !legend.hidden ? legend.getBoundingClientRect().height : 0;
    root.style.setProperty("--legend-h", lh ? Math.round(lh + 8) + "px" : "0px");
    // Measured to the bottom of the whole column. It used to add up the view
    // box's height alone, so once the reload row joined the column above it,
    // the wires box started that much too high and sat over the last rows.
    const bottom = col ? col.getBoundingClientRect().bottom : (view ? 16 + view.getBoundingClientRect().height : 16);
    root.style.setProperty("--wire-top", Math.round(bottom + 8) + "px");
  };
  const ro = new ResizeObserver(set);
  if (legend) ro.observe(legend);
  if (view) ro.observe(view);
  if (col) ro.observe(col);
  if (legend && typeof MutationObserver !== "undefined") new MutationObserver(set).observe(legend, { attributes: true, attributeFilter: ["hidden"] });
  set();
}
map.on("load", () => setTimeout(trackBoxHeights, 0));

map.on("moveend", () => { clearTimeout(gmTimer); gmTimer = setTimeout(gmSync, 900); });

}  // end of the double-execution guard
