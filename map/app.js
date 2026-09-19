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
  name: "Climate TRACE — emitting assets",
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
  name: "Climate TRACE — agriculture",
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
  name: "Climate TRACE — forestry and land use",
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
  name: "Historical",
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
  { id:"owid_co2",             name:"National CO₂ emissions", unit:"Mt CO₂/yr", colour:"#8A5750", route:"country", ready:true, off:true },
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

  { id:"gem_coal",             name:"Coal plant units",        unit:"MW capacity", colour:"#7A5548", route:"pmtiles", ready:true, off: true,
    radiusScale: 0.55,
    facet: { property: "x_status", label: "status",
             values: ["operating","construction","permitted","pre-permit","announced",
                      "shelved","mothballed","retired","cancelled"] } },
  { id:"global_energy_monitor",name:"GEM's other trackers",     unit:"capacity",   colour:"#7A5548", route:"pmtiles", ready:false },
  { id:"carbon_bombs",         name:"Carbon bombs",            unit:"Gt CO₂ lifetime", colour:"#6E4A44", route:"pmtiles", ready:true },
  { id:"power_plants",         name:"Power plants",            unit:"MW capacity", colour:"#7E5A4E", route:"pmtiles", ready:true, off: true,
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
  { id:"land_matrix",          name:"Land deals",              unit:"hectares",   colour:"#6C7F63", route:"country", ready:true, off: true,  isolate:true },
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
  { id:"epa_tri_sites",        name:"US toxic release sites (all zooms)", unit:"TRI facilities", colour:"#5C6E77", route:"pmtiles", ready:true, off: true,
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
  { id:"gfw",                  name:"Deforestation alerts — tropics",  unit:"GLAD + RADD, last 30 days", colour:"#8A4F46", route:"tile", ready:true, off: true,
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
  { id:"gfw_dist",             name:"Disturbance alerts — global",     unit:"DIST-ALERT, last 30 days", colour:"#7A5B4E", route:"tile", ready:true, off: true,
    bounds: [-180, -30, 180, 30],
    tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=30", off: true,
    recolor: "#7A5B4E",
    note: "Global coverage, including boreal and temperate forest. Detects vegetation disturbance generally, so it catches fire and harvest as well as clearing.",
    attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
  { id:"gfw_dist_year",        name:"Disturbance alerts — past year",  unit:"DIST-ALERT, last 365 days", colour:"#6E5E57", route:"tile", ready:true, off: true,
    bounds: [-180, -30, 180, 30],
    tilePath: "gfw_tile", tileMaxZoom: 22, tileQuery: "kind=dist&days=365", off: true,
    recolor: "#6E5E57",
    note: "The same global product over a twelve-month window, for seeing a season's cumulative loss rather than this month's.",
    attribution: '<a href="https://www.globalforestwatch.org" target="_blank" rel="noopener">Global Forest Watch</a>' },
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
  { id:"fishing",              name:"Fishing effort",          unit:"apparent fishing hours, 12 months", colour:"#A8707E", route:"tile", ready:true, off: true,
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
  { id:"slavery_sites",        name:"Brick kilns and artisanal mining", unit:"sites", colour:"#8A6B62", route:"pmtiles", ready:true, off: true,
    note: "Sector infrastructure, not confirmed exploitation. These are sites in sectors where forced and child labour concentrate; where IPIS actually observed it, the site says so." },
  { id:"slavery_ports",        name:"Ports with high-risk vessel calls", unit:"ports", colour:"#5F7480", route:"pmtiles", ready:true, off: true,
    note: "Scored on the share of calling fishing vessels flagged high-risk by a published behavioural model. A property of the calls, not of the port." },
  { id:"slavery_fishing",      name:"Modelled at-risk fishing effort", unit:"model cells, 2.5°", colour:"#4E6A70", route:"pmtiles", ready:true, off: true,
    note: "Not vessels. The authors anonymised every hull, so each mark is a cell of ocean and identifies nobody." },
  { id:"remains_records",      name:"Unearthings and burial decisions", unit:"records", colour:"#6A6257", route:"pmtiles", ready:true, off: true,
    facet: { property: "x_posture", label: "direction",
             values: ["harm","watch","redress","unlawful"] },
    note: "This layer does not plot graves. Burial locations arrive blurred to about 5 km from the source and stay that way. Direction is separate from size: a large repatriation is a large event, not a bad one." },
  // From WelcomeToYourGalaxy/abattoir-atlas: its merged facility records, every
  // one, not the subset its own page draws. Share-alike (OSM rows and OSM-based
  // geocoding), so its archive is isolated, as local_projects is.
  { id:"abattoir_facilities",  name:"Slaughterhouses, farms and other animal-use sites", unit:"facilities", colour:"#80605A", route:"pmtiles", ready:true, off: true,
    isolate:true,
    facet: { property: "x_slaughter", label: "slaughter",
             values: ["yes","no","not stated"] },
    note: "Most of these are not slaughterhouses: farms, dairies, processors, transporters, hatcheries and zoos are registered animal-use sites too. Slaughter is marked yes or no only where a registry says; for most it says neither. Hollow points are placed at a town, not the site. Records with no position at all are not drawn." },
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
  { id:"allen_coral",          name:"Coral reef habitat",      unit:"benthic habitat zones", colour:"#5E7377", route:"coral", ready:true, off: true,
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
function recolorAlerts(px, rgb) {
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
    px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2];
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
    recolorAlerts(img.data, tint);
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
  // The same imagery, graded the same way: past the zoom where the plate has
  // faded, the atlas basemap is this, so the two read as one photograph.
  satellite: { "raster-brightness-min": ATLAS_TUNE.lift, "raster-brightness-max": 1,
               "raster-saturation": ATLAS_TUNE.sat, "raster-contrast": ATLAS_TUNE.con,
               "raster-hue-rotate": ATLAS_TUNE.hue },
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
    setLayerState(cfg.id, `archive missing (${e.message})`);
    console.error(`[culprits] ${cfg.id}: ${e.message}`);
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
  bindPopup(`${cfg.id}-agg`);
  bindPopup(`${cfg.id}-pt`);
  applyVisibility(cfg.id);
  buildLegend();
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
  if (typeof map.triggerRepaint === "function") map.triggerRepaint();
}

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

// The projection actually drawn. With 3D terrain on, the planet is MapLibre's
// "globe": round at world scale, flattening only close up (from about zoom
// 10), which is the one projection that carries terrain on a round Earth.
function drawnProjection(kind) {
  return TERRAIN_ON ? "globe" : VIEWS[kind || VIEW].projection;
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
                 (list.length > 1 ? wirePopFilters(list) : "") +
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
      const addr = kid("address").replace(/\s+/g, " ").trim();
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
async function arcgisQueryAll(url) {
  const feats = [];
  for (let offset = 0; offset < 100000; offset += 2000) {
    const q = `${url}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=2000`;
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
      try { feats = await arcgisQueryAll(l.url.replace(/\/$/, "")); } catch (e) { skipped++; continue; }
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
  map.addSource(src, { type: "raster", tileSize: 256, maxzoom: cfg.maxzoom || 12,
    attribution: cfg.attribution || "", tiles: [cfg.choices[cfg._pick].tiles] });
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
  if (s && s.setTiles) s.setTiles([cfg.choices[cfg._pick].tiles]);
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

async function addTraseLayer(cfg) {
  let cat, regions;
  try {
    [cat, regions] = await Promise.all([traseJson(cfg.catalogue), traseJson(`${cfg.regions}/metadata.json`)]);
  } catch (e) {
    setLayerState(cfg.id, `not built yet (${e.message})`);
    return;
  }
  cfg._cat = cat.countries || {};
  cfg._regions = regions;
  const countries = Object.keys(cfg._cat).sort();
  const pick = cfg._pick = cfg._pick || {};
  pick.country = pick.country && cfg._cat[pick.country] ? pick.country : (cfg._cat.brazil ? "brazil" : countries[0]);
  map.addSource(`${cfg.id}-shapes`, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: cfg.attribution });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-shapes`,
    paint: { "fill-color": ["coalesce", ["get", "_c"], "rgba(0,0,0,0)"], "fill-opacity": 0.72 } });
  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-shapes`,
    paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
  bindHtmlPopup(`${cfg.id}-fill`, (p) => traseBox(cfg, p));
  traseMenus(cfg);
  await traseDraw(cfg);
  applyVisibility(cfg.id);
  buildLegend();
}

function traseLevelOk(cfg) {
  const p = cfg._pick, levels = cfg._cat[p.country].levels;
  if (!levels[p.level]) p.level = levels.municipality ? "municipality" : Object.keys(levels)[0];
  const metrics = levels[p.level].metrics;
  if (!metrics[p.metric]) {
    p.metric = Object.keys(metrics).sort((a, b) => (Number(metrics[a].display_order) || 999) - (Number(metrics[b].display_order) || 999))[0];
  }
  const years = metrics[p.metric].years || [];
  if (!years.includes(p.year)) p.year = years[years.length - 1];
}

function traseMenus(cfg) {
  const box = document.getElementById("layers");
  const row = box && box.querySelector && box.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (!anchor || !document.createElement) return;
  let el = box.querySelector(`.facet[data-trase-for="${cfg.id}"]`);
  if (!el) {
    el = document.createElement("div");
    el.className = "facet trase-menus";
    el.dataset.traseFor = cfg.id;
    if (anchor.after) anchor.after(el);
  }
  traseLevelOk(cfg);
  const p = cfg._pick, c = cfg._cat[p.country], lv = c.levels[p.level], m = lv.metrics[p.metric];
  const opt = (v, label, on) => `<option value="${escapeHtml(v)}"${on ? " selected" : ""}>${escapeHtml(label)}</option>`;
  const byOrder = (ms) => Object.keys(ms).sort((a, b) => (Number(ms[a].display_order) || 999) - (Number(ms[b].display_order) || 999));
  el.innerHTML =
    `<select data-tr="country" aria-label="Country">${Object.keys(cfg._cat).sort().map((k) => opt(k, cfg._cat[k].name, k === p.country)).join("")}</select>` +
    `<select data-tr="level" aria-label="Region level">${Object.keys(c.levels).map((k) => opt(k, c.levels[k].name, k === p.level)).join("")}</select>` +
    `<select data-tr="metric" aria-label="Measure">${byOrder(lv.metrics).map((k) => opt(k, (lv.metrics[k].metric_group ? lv.metrics[k].metric_group + ": " : "") + (lv.metrics[k].display_name || k), k === p.metric)).join("")}</select>` +
    `<select data-tr="year" aria-label="Year">${(m.years || []).map((y) => opt(y, y, y === p.year)).join("")}</select>` +
    `<div class="sm-legend" data-trase-legend></div>`;
  for (const s of el.querySelectorAll ? el.querySelectorAll("select") : []) {
    s.addEventListener("change", () => {
      const k = s.dataset.tr;
      p[k] = k === "year" ? Number(s.value) : s.value;
      traseMenus(cfg);
      traseDraw(cfg).catch((e) => setLayerState(cfg.id, `could not draw (${e.message})`));
    });
  }
}

function traseRegionFile(cfg) {
  const p = cfg._pick, name = cfg._cat[p.country].name;
  const hits = (cfg._regions || []).filter((r) => traseSlug(r.country) === p.country && r.node_type_slug === p.level);
  const hit = hits.find((r) => p.year >= Number(r.year_start) && p.year <= Number(r.year_end)) || hits[0];
  return hit ? `${cfg.regions}/${hit.endpoint_geojson}` : null;
}

async function traseDraw(cfg) {
  const p = cfg._pick, m = cfg._cat[p.country].levels[p.level].metrics[p.metric];
  const file = traseRegionFile(cfg);
  if (!file) { setLayerState(cfg.id, "Trase publishes no shapes for this level"); return; }
  setLayerState(cfg.id, "loading from Trase\u2026");
  const [shapes, values] = await Promise.all([traseJson(file), traseJson(`${cfg.values}/${p.country}/${p.level}/${p.metric}.json`)]);
  const yr = values[String(p.year)] || {};
  const ids = new Set(Object.keys(yr));
  // Which field of the shapes holds Trase's region id: the one whose values are keys of the data.
  let idKey = null;
  for (const f of (shapes.features || []).slice(0, 50)) {
    idKey = Object.keys(f.properties || {}).find((k) => ids.has(String(f.properties[k])));
    if (idKey) break;
  }
  const ramp = TRASE_RAMPS[m.color_scheme] || TRASE_RAMPS.red;
  const breaks = traseBreaks(Object.values(yr));
  const colourOf = (v) => {
    if (typeof v !== "number") return null;
    let i = 0;
    while (i < breaks.length && v >= breaks[i]) i++;
    return ramp[Math.min(i + (ramp.length - 1 - breaks.length), ramp.length - 1)];
  };
  let shown = 0;
  const features = (shapes.features || []).map((f) => {
    const id = idKey ? String(f.properties[idKey]) : "";
    const v = yr[id];
    if (v !== undefined) shown++;
    return { type: "Feature", geometry: f.geometry,
      properties: Object.assign({}, f.properties, { _id: id, _v: v === undefined ? null : v, _c: colourOf(v) }) };
  });
  map.getSource(`${cfg.id}-shapes`).setData({ type: "FeatureCollection", features });
  const legend = document.querySelector(`[data-trase-for="${cfg.id}"] [data-trase-legend]`);
  if (legend) {
    const edges = [null, ...breaks];
    legend.innerHTML = edges.map((b, i) => `<span class="sm-key"><i style="background:${ramp[i + (ramp.length - 1 - breaks.length)]}"></i>` +
      `${b === null ? "below " + traseFormat(breaks[0] ?? 0) : "from " + traseFormat(b)}</span>`).join("") +
      ` <span class="sm-key">${escapeHtml(m.unit_abbreviation || m.unit || "")}</span>`;
  }
  setLayerState(cfg.id, `${shown.toLocaleString()} regions \u00b7 ${m.display_name || p.metric}, ${p.year}`);
}

function traseBox(cfg, props) {
  const p = cfg._pick, m = cfg._cat[p.country].levels[p.level].metrics[p.metric];
  const name = props.name || props.region || props.NAME || props.nome || props._id;
  const v = props._v;
  return `<b>${escapeHtml(name)}</b>` +
    `<div class="meta">${escapeHtml(m.display_name || p.metric)}, ${p.year}: ` +
    `${v === null || v === undefined || v === "null" ? "no value published" : escapeHtml(traseFormat(Number(v)))} ${escapeHtml(m.unit_abbreviation || "")}</div>` +
    (m.tooltip && m.tooltip !== "." ? `<div class="meta">${escapeHtml(m.tooltip)}</div>` : "") +
    (m.data_source ? `<div class="meta">Source: ${escapeHtml(m.data_source)}</div>` : "") +
    (m.citation ? `<div class="meta">${escapeHtml(m.citation)}</div>` : "") +
    `<div class="meta"><a href="https://trase.earth/explore/spatial-data/map?country=${encodeURIComponent(p.country)}" target="_blank" rel="noopener">Open on Trase</a></div>`;
}

/* ---------- outlines from a PMTiles archive (points wider out) ---------- */
function addPmShapesLayer(cfg) {
  const src = `${cfg.id}-pm`;
  map.addSource(src, { type: "vector", url: `pmtiles://${cfg.archiveUrl}`, attribution: cfg.attribution || "" });
  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: src, "source-layer": cfg.polygonLayer,
    paint: { "fill-color": cfg.colour, "fill-opacity": 0.55, "fill-outline-color": "#1D1B17" } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, "source-layer": cfg.pointLayer,
    paint: { "circle-color": cfg.colour, "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 1.4, 6, 3],
             "circle-stroke-color": "#17150F", "circle-stroke-width": 0.4, "circle-opacity": 0.85 } });
  const box = (p) => {
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
  setLayerState(cfg.id, "points wider out, outlines from zoom 7");
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- live places, batch 2 ---------- */
const boxOpen = `<div style="font:13px/1.4 system-ui,sans-serif;max-width:340px">`;
function fieldRows(p, skip = []) {
  return Object.keys(p).filter((k) => !skip.includes(k) && p[k] !== null && p[k] !== "" && typeof p[k] !== "object")
    .map((k) => `<tr><th style="text-align:left;padding-right:8px;vertical-align:top">${escapeHtml(k.replace(/_/g, " "))}</th><td>${escapeHtml(p[k])}</td></tr>`).join("");
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
async function readGeojsonFiles(cfg) {
  const items = [];
  for (const f of cfg.files) {
    const gj = await getJson(f.url, 60000);
    (gj.features || []).forEach((ft, i) => {
      const p = ft.properties || {};
      const name = p.name || p.Name || p.title || p.Source || (p.TripId != null ? `Trip ${p.TripId}` : "") || p.Ocean || f.label;
      items.push({ geometry: ft.geometry, key: `${f.label}:${i}`, name: String(name), group: f.label,
        h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(name)}</h4><table>${fieldRows(p)}</table></div>` });
    });
  }
  return { title: cfg.name, items };
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
        layers.push({ base, name: nm.textContent, title: (tt && tt.textContent) || nm.textContent, about: (ab && ab.textContent) || "" });
      }
    } catch (e) { console.warn(`[culprits] ${cfg.id}: ${base}: ${e.message}`); }
  }
  if (!layers.length) { setLayerState(cfg.id, "the map server did not list its layers"); return; }
  layers.sort((a, b) => a.title.localeCompare(b.title));
  cfg._layers = layers;
  cfg._pick = cfg._pick || 0;
  const src = `${cfg.id}-img`;
  const tilesFor = (l) => `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(l.name)}&STYLES=` +
    `&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`;
  map.addSource(src, { type: "raster", tileSize: 256, attribution: cfg.attribution || "", tiles: [tilesFor(layers[cfg._pick])] });
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: src, paint: { "raster-opacity": 0.85 } });
  const menu = document.createElement("div");
  menu.className = "facet";
  menu.innerHTML = `<select aria-label="Layer" style="max-width:100%">${layers.map((l, i) =>
    `<option value="${i}">${escapeHtml(l.title)}</option>`).join("")}</select>`;
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) anchor.after(menu);
  const sel = menu.querySelector("select");
  const show = () => {
    const l = layers[cfg._pick];
    setLayerState(cfg.id, `${l.title}${l.about ? " \u2014 " + l.about.slice(0, 120) : ""}`);
  };
  sel.addEventListener("change", () => {
    cfg._pick = Number(sel.value) || 0;
    const s = map.getSource(src);
    if (s && s.setTiles) s.setTiles([tilesFor(layers[cfg._pick])]);
    show();
  });
  map.on("click", async (e) => {
    if ((visibility.get(cfg.id) || "visible") !== "visible" || map.getLayoutProperty(`${cfg.id}-raster`, "visibility") === "none") return;
    const l = layers[cfg._pick], b = map.getBounds(), c = map.getCanvas();
    const w = c.clientWidth || 800, h = c.clientHeight || 600;
    const pt = map.project(e.lngLat);
    const q = `${l.base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${encodeURIComponent(l.name)}&QUERY_LAYERS=${encodeURIComponent(l.name)}` +
      `&STYLES=&SRS=EPSG:4326&BBOX=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&WIDTH=${w}&HEIGHT=${h}` +
      `&X=${Math.round(pt.x)}&Y=${Math.round(pt.y)}&INFO_FORMAT=application/json&FEATURE_COUNT=5`;
    try {
      const j = await getJson(q);
      const feats = j.features || [];
      if (!feats.length) return;
      new maplibregl.Popup({ closeButton: true, maxWidth: "340px" }).setLngLat(e.lngLat)
        .setHTML(`<b>${escapeHtml(l.title)}</b>` + feats.map((f) => `<table class="meta">${fieldRows(f.properties || {})}</table>`).join("<hr>")).addTo(map);
    } catch (err) { /* nothing there, or the server declined */ }
  });
  show();
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- Global Forest Watch's whole catalogue, as a menu ---------- */
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
  const items = all.map((d) => ({ id: d.dataset, title: (d.metadata && d.metadata.title) || d.dataset, meta: d.metadata || {} }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const menu = document.createElement("div");
  menu.className = "facet";
  menu.innerHTML = `<select aria-label="Dataset" style="max-width:100%"><option value="">Choose one of ${items.length} datasets\u2026</option>` +
    items.map((d, i) => `<option value="${i}">${escapeHtml(d.title)}</option>`).join("") + `</select>`;
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after) anchor.after(menu);
  setLayerState(cfg.id, `${items.length} datasets \u2014 choose one`);
  const clear = () => {
    for (const id of [...(cfg._layerIds || [])]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(`${cfg.id}-gfw`)) map.removeSource(`${cfg.id}-gfw`);
    cfg._layerIds = [];
  };
  menu.querySelector("select").addEventListener("change", async (ev) => {
    clear();
    const d = items[Number(ev.target.value)];
    if (!d) return;
    setLayerState(cfg.id, `${d.title}: finding its tiles\u2026`);
    try {
      const v = await getJson(`${cfg.api}/dataset/${d.id}/latest`);
      const version = (v.data && v.data.version) || "latest";
      const assets = (await getJson(`${cfg.api}/dataset/${d.id}/${version}/assets`)).data || [];
      const vec = assets.find((a) => /vector tile cache/i.test(a.asset_type || ""));
      const ras = assets.find((a) => /raster tile cache/i.test(a.asset_type || ""));
      const about = [d.meta.license ? `licence: ${d.meta.license}` : "", d.meta.source ? `source: ${String(d.meta.source).replace(/\[|\]\([^)]*\)/g, "")}` : ""].filter(Boolean).join("; ");
      if (vec) {
        const uri = vec.asset_uri;
        const buf = await (await fetch(uri.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0"))).arrayBuffer().catch(() => null);
        const names = buf ? readTileLayers(buf) : [];
        map.addSource(`${cfg.id}-gfw`, { type: "vector", tiles: [uri], minzoom: 0, maxzoom: 12 });
        for (const n of (names.length ? names : [d.id, "default"])) {
          const base = { source: `${cfg.id}-gfw`, "source-layer": n };
          map.addLayer({ id: `${cfg.id}-f-${n}`, type: "fill", ...base, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": cfg.colour, "fill-opacity": 0.45, "fill-outline-color": "#1D1B17" } });
          map.addLayer({ id: `${cfg.id}-l-${n}`, type: "line", ...base, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": cfg.colour, "line-width": 1.2 } });
          map.addLayer({ id: `${cfg.id}-p-${n}`, type: "circle", ...base, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": cfg.colour, "circle-radius": 3, "circle-stroke-width": 0.5, "circle-stroke-color": "#17150F" } });
          for (const id of [`${cfg.id}-f-${n}`, `${cfg.id}-l-${n}`, `${cfg.id}-p-${n}`]) {
            cfg._layerIds.push(id);
            bindHtmlPopup(id, (p) => `<b>${escapeHtml(d.title)}</b><table class="meta">${fieldRows(p)}</table>`);
          }
        }
        setLayerState(cfg.id, `${d.title} \u00b7 live${about ? " \u00b7 " + about : ""}`);
      } else if (ras) {
        map.addSource(`${cfg.id}-gfw`, { type: "raster", tileSize: 256, tiles: [ras.asset_uri], maxzoom: 12 });
        map.addLayer({ id: `${cfg.id}-r`, type: "raster", source: `${cfg.id}-gfw`, paint: { "raster-opacity": 0.8, "raster-saturation": -0.3 } });
        cfg._layerIds.push(`${cfg.id}-r`);
        setLayerState(cfg.id, `${d.title} \u00b7 live picture${about ? " \u00b7 " + about : ""}`);
      } else {
        setLayerState(cfg.id, `${d.title}: Global Forest Watch publishes no map tiles for this dataset (download only)`);
      }
      const vis = visibility.get(cfg.id) || "visible";
      for (const id of cfg._layerIds) map.setLayoutProperty(id, "visibility", vis);
    } catch (e) {
      setLayerState(cfg.id, `${d.title}: ${e.message}`);
    }
  });
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
function spheresOpen(id) {
  const w = spheresFrame && spheresFrame.contentWindow;
  if (!id || !w || !w.document || w.document.readyState !== "complete") return;
  try { w.eval(`openNode(${JSON.stringify(id)})`); } catch (e) { console.warn("[culprits] social spheres card:", e.message); }
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
    properties: { id: n.id, name: n.name, c: kinds[n.kind] || cfg.colour, linked: n.linked ? 1 : 0 } }));
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
  const colour = ["match", ["get", "type"]];
  for (const t of types) colour.push(t, colours[t]);
  colour.push(cfg.colour);
  const src = `${cfg.id}-pm`;
  map.addSource(src, { type: "vector", url: `pmtiles://${cfg.archiveUrl}` });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: src, "source-layer": "buildings",
    paint: { "circle-color": colour, "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.6, 10, 4, 15, 6],
             "circle-stroke-color": "#17150F", "circle-stroke-width": 0.5, "circle-opacity": 0.9 } });
  bindHtmlPopup(`${cfg.id}-pt`, (p) => {
    const skip = new Set(["type", "name", "sources", "merged"]);
    const rows = Object.keys(p).filter((k) => !skip.has(k) && p[k] !== "" && p[k] != null).map((k) => {
      const v = String(p[k]);
      return `${escapeHtml(k.replace(/_/g, " "))}: ` + (/^https?:\/\//.test(v)
        ? `<a href="${escapeHtml(v)}" target="_blank" rel="noopener">${escapeHtml(v.length > 60 ? v.slice(0, 57) + "\u2026" : v)}</a>` : escapeHtml(v));
    });
    return `<b>${escapeHtml(p.name || "Unnamed in the source")}</b><div class="meta">${escapeHtml(p.type)}</div>` +
      (rows.length ? `<div class="meta">${rows.join("<br>")}</div>` : "") +
      `<div class="meta">From: ${escapeHtml(p.sources || "")}${Number(p.merged) > 1 ? ` (${p.merged} files describe this place; merged)` : ""}</div>`;
  });
  // A chip per type, with its count; none picked means every type.
  const picked = new Set();
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (anchor && anchor.after && document.createElement) {
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<span class="chip reset" data-bt="">All types</span>` + types.map((t) =>
      `<button type="button" class="chip" data-bt="${escapeHtml(t)}"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;` +
      `background:${colours[t]};margin-right:4px"></i>${escapeHtml(t)} (${Number(summary.types[t]).toLocaleString()})</button>`).join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-bt]");
      if (!b) return;
      e.stopPropagation();
      const t = b.dataset.bt;
      if (!t) picked.clear(); else if (picked.has(t)) picked.delete(t); else picked.add(t);
      for (const c of el.querySelectorAll("[data-bt]")) c.classList.toggle("on", c.dataset.bt ? picked.has(c.dataset.bt) : picked.size === 0);
      map.setFilter(`${cfg.id}-pt`, picked.size ? ["in", ["get", "type"], ["literal", [...picked]]] : null);
    });
    anchor.after(el);
  }
  setLayerState(cfg.id, `${Number(summary.places).toLocaleString()} places in ${types.length} types (from ${Number(summary.rows).toLocaleString()} file rows)`);
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- your live monitors, each its own layer ---------- */
const monitorCache = new Map();
async function monitorPage(cfg) {
  if (!monitorCache.has(cfg.repo)) {
    const p = fetch(`https://raw.githubusercontent.com/${cfg.repo}/main/index.html`).then((r) => r.ok ? r.text() : "");
    monitorCache.set(cfg.repo, p);
  }
  return monitorCache.get(cfg.repo);
}
// The monitor's own topic colours, read from its page.
function monitorColours(html) {
  const m = /const TOPIC_COLOR = \{([\s\S]*?)\};/.exec(html || "");
  const out = {};
  if (m) for (const [, k, c] of m[1].matchAll(/([\w-]+)\s*:\s*'(#[0-9a-fA-F]{6})'/g)) out[k] = c;
  return out;
}
// Its popup styles, scoped to its boxes here.
function monitorPopupCss(html) {
  return (String(html || "").match(/\.nw-pop[^{]*\{[^}]*\}/g) || []).map((r) => ".monitor-pop " + r).join("\n") +
    "\n.monitor-pop{--flag:#e8e2d6;--ink-faint:#9a9384}.monitor-pop a{display:block;color:#F2EEE6;text-decoration:none;margin:4px 0}" +
    ".monitor-pop a:hover{text-decoration:underline}";
}
function monitorPlace(item, geo) {
  const ids = [...(item.pl || []), ...(item.sr || []), ...(item.w || [])].filter((p) => p && p !== "unlocated");
  for (const id of ids) for (const r of geo || []) {
    if (r.id === id) return r.label;
    for (const sb of r.subs || []) {
      if (sb.id === id) return sb.label;
      for (const pl of sb.places || []) if (pl.id === id) return pl.label;
    }
  }
  return "";
}
async function addMonitorLayer(cfg) {
  let data, html;
  try {
    [html, data] = await Promise.all([monitorPage(cfg),
      getJson(`https://raw.githubusercontent.com/${cfg.repo}/main/${cfg.wire}?t=${Date.now()}`, 60000)
        .catch(() => getJson(`https://cdn.jsdelivr.net/gh/${cfg.repo}@main/${cfg.wire}`, 60000))]);
  } catch (e) { setLayerState(cfg.id, `the monitor did not answer (${e.message})`); return; }
  const colours = monitorColours(html);
  if (!document.getElementById("monitor-pop-css") && document.createElement) {
    const st = document.createElement("style");
    st.id = "monitor-pop-css";
    st.textContent = monitorPopupCss(html);
    document.head.appendChild(st);
  }
  const notable = data.notable_score || 3;
  const feats = (data.items || []).filter((i) => Array.isArray(i.ll) && i.ll.length === 2).map((i) => ({ type: "Feature",
    geometry: { type: "Point", coordinates: [i.ll[1], i.ll[0]] },
    properties: { t: i.t || "", u: i.u || "", o: i.o || "", x: ((i.x || [])[0]) || "", c: colours[(i.x || [])[0]] || "#a49f98",
                  big: (i.p || 0) >= notable ? 1 : 0, pa: i.pa ? 1 : 0, place: monitorPlace(i, data.geo) } }));
  map.addSource(`${cfg.id}-src`, { type: "geojson", data: { type: "FeatureCollection", features: feats } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: `${cfg.id}-src`,
    paint: { "circle-color": ["get", "c"], "circle-stroke-color": "#131311", "circle-stroke-width": 0.8,
             "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["case", ["==", ["get", "big"], 1], 3.4, 2.6], 6, ["case", ["==", ["get", "big"], 1], 6.5, 5]],
             "circle-opacity": ["case", ["==", ["get", "pa"], 1], 0.7, 1] } });
  map.on("click", `${cfg.id}-pt`, (e) => {
    popupClaimedBy = e.originalEvent || e;
    const p = e.point;
    const group = map.queryRenderedFeatures([[p.x - 9, p.y - 9], [p.x + 9, p.y + 9]], { layers: [`${cfg.id}-pt`] });
    const seen = new Set(), items = [];
    for (const f of group) { if (!seen.has(f.properties.u)) { seen.add(f.properties.u); items.push(f.properties); } }
    const places = [...new Set(items.map((i) => i.place).filter(Boolean))];
    const head = `<div class="nw-pop-place">${escapeHtml(places.slice(0, 3).join(" \u00b7 "))}` +
      (items.length > 1 ? ` \u00b7 ${items.length} stories here` : "") + `</div>`;
    const rows = items.slice(0, 20).map((i, n) => `<a href="${escapeHtml(i.u)}" target="_blank" rel="noopener noreferrer"` +
      (n === 0 && items.length > 1 ? ` class="nw-pop-first"` : "") + `>${escapeHtml(i.t)}` +
      `<span class="nw-pop-src">${escapeHtml(i.o)}${places.length > 1 && i.place ? " \u00b7 " + escapeHtml(i.place) : ""}</span></a>`).join("");
    const more = items.length > 20 ? `<div class="nw-pop-place">and ${items.length - 20} more</div>` : "";
    new maplibregl.Popup({ maxWidth: "300px", className: "monitor-pop" }).setLngLat(e.lngLat).setHTML(head + rows + more).addTo(map);
  });
  map.on("mouseenter", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = ""; });
  // A chip per topic, in its own colour.
  const topics = (data.topics || []).filter((t) => feats.some((f) => f.properties.x === t.id));
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (topics.length > 1 && anchor && anchor.after) {
    const picked = new Set();
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<span class="chip reset" data-mt="">All topics</span>` + topics.map((t) =>
      `<button type="button" class="chip" data-mt="${escapeHtml(t.id)}"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;` +
      `background:${colours[t.id] || "#a49f98"};margin-right:4px"></i>${escapeHtml(t.label)}</button>`).join("");
    el.addEventListener("click", (ev) => {
      const b = ev.target.closest && ev.target.closest("[data-mt]");
      if (!b) return;
      ev.stopPropagation();
      const t = b.dataset.mt;
      if (!t) picked.clear(); else if (picked.has(t)) picked.delete(t); else picked.add(t);
      for (const c of el.querySelectorAll("[data-mt]")) c.classList.toggle("on", c.dataset.mt ? picked.has(c.dataset.mt) : picked.size === 0);
      map.setFilter(`${cfg.id}-pt`, picked.size ? ["in", ["get", "x"], ["literal", [...picked]]] : null);
    });
    anchor.after(el);
  }
  const unplaced = (data.items || []).length - feats.length;
  setLayerState(cfg.id, `${feats.length.toLocaleString()} stories placed` + (unplaced ? ` (${unplaced.toLocaleString()} have no place)` : "") +
    (data.generated ? ` \u00b7 updated ${String(data.generated).slice(0, 16).replace("T", " ")}` : ""));
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
  const move = (e) => {
    const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : from);
    el.style.maxHeight = "none";
    el.style.height = pullHeight(height, y - from, edge, PULL_MIN, ceiling()) + "px";
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
  grip.addEventListener("dblclick", () => { el.style.height = ""; el.style.maxHeight = ""; });
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

function setTerrain(on) {
  TERRAIN_ON = !!on;
  if (typeof map.setTerrain !== "function") return;
  // Terrain is drawn on a round Earth (see drawnProjection): the flat map
  // tilted at world scale stood on the screen like a slab.
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
  // Beside the zoom buttons: reload the whole map on the same view, for when it gets stuck.
  if (holder && holder.appendChild && document.createElement && !document.getElementById("reload-map")) {
    const b = document.createElement("button");
    b.id = "reload-map";
    b.type = "button";
    b.title = "Reload the map (if it gets stuck)";
    b.setAttribute("aria-label", "Reload the map");
    b.textContent = "\u21bb";
    b.style.cssText = "margin-left:6px;width:29px;height:29px;border-radius:4px;border:0;cursor:pointer;" +
      "background:#fff;color:#333;font:17px/29px system-ui,sans-serif;box-shadow:0 0 0 2px rgba(0,0,0,.1)";
    b.addEventListener("click", () => {
      try {
        const c = map.getCenter();
        const view = `${c.lng.toFixed(4)},${c.lat.toFixed(4)},${map.getZoom().toFixed(2)}`;
        sessionStorage.setItem("culprits-view", view);
      } catch (e) { /* the view is not kept; the page still reloads */ }
      location.reload();
    });
    holder.appendChild(b);
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
    ` title="Ground height under the imagery, on a round Earth that flattens close up.">` +
    `<span class="nm">3D terrain</span></label>` +
    `<div class="compass-holder" id="compass-holder" title="Click to stand the map upright, facing north">` +
    `<span class="compass-cap">Click: north up, level</span></div></div>` +
    `<div class="how-boxes">` +
    `<p class="how"><b>Mouse</b> Right-drag: tilt and turn. Ctrl + right-drag: roll.</p>` +
    `<p class="how"><b>Trackpad</b> Ctrl + drag: tilt and turn. Ctrl + two-finger click, then drag: roll.</p>` +
    `<p class="how">Same on Mac and Windows. Keys: Shift + arrows.</p>` +
    `</div></div></div></div>` +
    `<div class="sect" data-sect="basemap">` + sectHead("Basemap", "basemap") + `<div class="sect-body">`;
}

function buildBasemapPanel() {
  const box = document.getElementById("basemaps");
  if (!box) return;
  const opts = [["atlas", "Painted atlas"], ["satellite", "Satellite imagery"], ["outlines", "Country outlines"]];
  box.innerHTML = viewPanelHtml() + opts.map(([k, nm]) =>
    `<label class="layer"><input type="radio" name="basemap" value="${k}"` +
    `${k === BASEMAP ? " checked" : ""}><span class="nm">${nm}</span></label>`).join("") + `</div></div>`;
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

const CORAL_ATLAS_PICTURE_FROM = 6;
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
  map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: `${cfg.id}-wide`, maxzoom: cfg.drawFrom,
    minzoom: CORAL_ATLAS_PICTURE_FROM, layout: { visibility: "none" }, paint: { "raster-opacity": 0.9 } });
  // Wider still, the Atlas's server runs out of time drawing so much reef, so
  // UNEP-WCMC's reef map stands in, in the same colour, and the row says so.
  map.addSource(`${cfg.id}-globe`, { type: "raster", tileSize: 256,
    attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC",
    tiles: [`tint://${CORAL_CLASSES["Coral/Algae"].slice(1)}/data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/MapServer/export` +
            `?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`] });
  map.addLayer({ id: `${cfg.id}-world`, type: "raster", source: `${cfg.id}-globe`, maxzoom: CORAL_ATLAS_PICTURE_FROM,
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
        ? `UNEP-WCMC's reef map at this width (the Atlas cannot draw this much); the Atlas's own from zoom ${CORAL_ATLAS_PICTURE_FROM} — zoom in to ${cfg.drawFrom} for each habitat zone and its box`
        : `the Atlas's picture of the reefs — zoom in to ${cfg.drawFrom} for each habitat zone and its box`);
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
      .slice(0, 16).map(([k, v]) => `${shapeText(k.replace(/[_.]/g, " "))}: ${shapeText(v).slice(0, 400)}`);
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
  if (Array.isArray(data.filters) && data.filters.length) {
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
  if (Array.isArray(data.colourings) && data.colourings.length) {
    sitemapColourings.set(cfg.id, { list: data.colourings, pick: 0, year: {} });
    sitemapColourRow(cfg);
    applySitemapColouring(cfg.id);
  }
  for (const kind of ["fill", "line", "pt"]) {
    const id = `${cfg.id}-${kind}`;
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
  popupClaimedBy = claim;
  ensureBoxCss();
  if (hits.length === 1) { openSitemapBox(hits[0], placeOf(hits[0], e)); return; }
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

  const rows = shown.map((c) =>
    `<div class="lg-row"><span class="lg-sw" style="background:${c.colour}"></span>` +
    `<span class="lg-nm">${c.name}</span>` +
    `<span class="lg-un">${c.unit || ""}</span></div>`).join("");

  box.innerHTML =
    `<div class="lg-hd">Showing</div>${rows}` +
    `<div class="lg-rule"></div>` +
    `<div class="lg-row"><span class="lg-sw lg-hollow"></span>` +
    `<span class="lg-nm">hollow</span>` +
    `<span class="lg-un">no site coordinate published</span></div>`;
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
      .filter(([k, v]) => k.startsWith("x_") && v !== null && v !== "" &&
                          k !== "x_precision")
      .slice(0, 6)
      .map(([k, v]) => `${k.slice(2).replace(/_/g, " ")}: ${v}`)
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

    new maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
      .setLngLat(e.lngLat).setHTML(html).addTo(map);
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
const visibility = new Map(LAYERS.filter((c) => c.off).map((c) => [c.id, "none"]));

function applyVisibility(id) {
  const vis = visibility.get(id) || "visible";
  [`${id}-agg`, `${id}-pt`, `${id}-fill`, `${id}-line`, `${id}-raster`, `${id}-world`, `${id}-cap`].forEach((l) => {
    if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
  });
  const cfg = LAYERS.find((l) => l.id === id);
  if (/^climate_trace/.test(id)) scheduleColumns();
  // The points file is asked for the first time the layer is switched on.
  if (cfg && cfg.points && vis === "visible" && !cfg._pointsTried) {
    cfg._pointsTried = true;
    addPointOverview(cfg).catch((e) => console.warn(`[culprits] ${cfg.id} points: ${e.message}`));
  }
  const extra = (cfg || childById(id) || {})._layerIds;
  if (extra) for (const l of extra) if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
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
  box.innerHTML = cfg.facet.values
    .map((v) => `<button class="chip" data-facet="${cfg.id}" data-value="${v}">${v}</button>`)
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
  parent.innerHTML =
    `<button class="disc" data-disc="${group.id}" aria-expanded="false" ` +
    `title="show the layers in this group">&#9656;</button>` +
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
      `<span class="body"><span class="nm">${child.name}</span>` +
      `<span class="un" data-state="${child.id}">not loaded</span></span>`;
    kids.appendChild(row);
  });
  wrap.appendChild(kids);
  return wrap;
}

// Show or hide one group's children. Display only.
function toggleGroup(box, id) {
  const kids = box.querySelector(`[data-kids="${id}"]`);
  const disc = box.querySelector(`[data-disc="${id}"]`);
  if (!kids || !disc) return;
  const open = kids.hidden;
  kids.hidden = !open;
  disc.innerHTML = open ? "&#9662;" : "&#9656;";
  disc.setAttribute("aria-expanded", open ? "true" : "false");
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
  name: "The site's own maps",
  group: true,
  ready: true,
  children: [
    { id: "site_animal_sacrifice", name: "Animal Sacrifice Map", unit: "sites", colour: "#7A4F4A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_animal_sacrifice.places.geojson",
      note: "From the Destruction page's animal sacrifice map." },
    { id: "site_animal_fighting", name: "Animal Fighting Locations Map", unit: "venues", colour: "#84594F", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_animal_fighting.places.geojson",
      note: "From the Destruction page's animal fighting map (maps repo)." },
    { id: "site_carbon_mapper_waste", name: "Methane plumes from waste sites (Carbon Mapper)", unit: "plume sources", colour: "#6D6A5E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_carbon_mapper_waste.places.geojson",
      note: "From the Destruction page's Carbon Mapper waste-sector map: the hotspots written into that map, not Carbon Mapper's live feed." },
    { id: "site_forest500_soy", name: "Forest 500: Worst Soy Financial Institutions (2024)", unit: "financial institutions", colour: "#6B5B4E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_forest500_soy.places.geojson",
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
    { id: "site_export_credit", name: "Export Credit Agenciesof the World", unit: "agencies", colour: "#5E6A63", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_export_credit.places.geojson",
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
    { id: "site_enslaved_plants", name: "The Unnecessary Enslavement of Plants 2026", unit: "companies", colour: "#62705A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_enslaved_plants.places.geojson",
      note: "From the Suppression page's plant enslavement map." },
    { id: "site_enslaved_microbes", name: "The Unnecessary Enslavement of Microorganisms 2026", unit: "companies", colour: "#6A6E62", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_enslaved_microbes.places.geojson",
      note: "From the Suppression page's microorganism enslavement map." },
    { id: "site_insentient", name: "The Insentient 2026", unit: "companies", colour: "#66625E", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/site_insentient.places.geojson",
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
  name: "Executive accountability map",
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
  name: "Money and financial accountability map",
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
  name: "Legal defense and prisoner support map",
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
  name: "Legislative accountability map",
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
  name: "Judicial accountability map",
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
  name: "More from the map repos",
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
  name: "Genetic engineering map",
  group: true,
  ready: true,
  children: [
    { id: "gmo_cultivation", name: "Genetic-engineering cultivation", unit: "countries and regions", colour: "#6F6A5A", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_cultivation.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gmo_gmofree", name: "GMO-free zones", unit: "zones", colour: "#5F6E5C", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_gmofree.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gmo_incidents", name: "Contamination incidents", unit: "countries", colour: "#7A5A55", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_incidents.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gmo_regime", name: "Regulatory regimes", unit: "regime areas", colour: "#5E6470", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_regime.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gmo_treaties", name: "Biosafety and seed treaties", unit: "countries", colour: "#665E6C", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_treaties.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "gmo_trials", name: "Field trials", unit: "countries and regions", colour: "#6E6456", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/gmo_trials.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
  ],
};

const OTHER_MAPS = {
  id: "other_org_maps",
  name: "Other organisations' maps",
  group: true,
  ready: true,
  children: [
    { id: "palmwatch", name: "PalmWatch", unit: "palm oil mills", colour: "#87544A", route: "sitemap", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/sitemaps/palmwatch.places.geojson",
      note: "PalmWatch (Inclusive Development International and the University of Chicago Data Science Institute), reread from PalmWatch every day. Each area is a mill's modelled sourcing area, not a property boundary; tree cover loss inside it is not measured as that mill's own clearing." },
    { id: "usda_soybean", name: "Soybean Map Explorer", unit: "soybean growing areas", colour: "#6F7560", route: "arcgis", ready: true, lazy: true,
      crop: "Soybean", service: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerSoybean/MapServer", attribution: "USDA Foreign Agricultural Service",
      note: "Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." },
    { id: "usda_corn", name: "Corn Map Explorer", unit: "corn growing areas", colour: "#76705C", route: "arcgis", ready: true, lazy: true,
      crop: "Corn", service: "https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorerCorn/MapServer", attribution: "USDA Foreign Agricultural Service",
      note: "Drawn live by USDA's Commodity Explorer map server each time the map moves; a click asks USDA what is there." },
    { id: "trase_measures", name: "Trase: deforestation and supply-chain measures", unit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
      catalogue: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/catalogue.json", values: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/values",
      regions: "https://resources.trase.earth/data/trase-regions",
      attribution: "Trase (CC BY 4.0)",
      note: "Trase's own measures for every country, region level and year it publishes. Region shapes are read live from Trase; the values come from a copy reread weekly, because Trase does not let other sites read them." },
    { id: "unep_coral", name: "Warm-water coral reefs (UNEP-WCMC)", unit: "reef areas", colour: "#B06F6A", route: "arcgis", ready: true, lazy: true,
      service: "https://data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/MapServer",
      attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC",
      note: "UNEP-WCMC's Global Distribution of Warm-water Coral Reefs, drawn live by its own map server at every zoom; a click asks it what is there." },
    { id: "mines_global", name: "Mines worldwide (Maus et al. 2022 + OpenStreetMap)", unit: "mine outlines", colour: "#6E5E52", route: "pmshapes", ready: true, lazy: true,
      archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/mining_polygons.pmtiles", polygonLayer: "mines", pointLayer: "mine_points",
      attribution: "Maus et al. 2022; OpenStreetMap contributors; merged by WU Vienna 2024 (ODbL)",
      note: "192,584 mine outlines: Maus et al.'s satellite-traced mining areas merged with OpenStreetMap's mines and quarries (Zenodo 7307210, ODbL), with the tree cover loss inside each from 2000 to 2019. Points wider out, outlines from zoom 7." },
    { id: "ejatlas", name: "Environmental Justice Atlas (EJAtlas)", unit: "conflicts", colour: "#7A5A55", route: "ejatlas", ready: true, lazy: true,
      api: "https://ejatlas.org/api/v1/conflicts/",
      note: "Every conflict in the EJAtlas, read live from its own data address; each box links the conflict's page." },
    { id: "seas_of_plastic", name: "Seas of Plastic", unit: "stations, trips and ocean areas", colour: "#5E7377", route: "geojsonlive", ready: true, lazy: true,
      files: [{ label: "Stations", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/AllStations.geojson" },
              { label: "Trips", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/AllTrips.geojson" },
              { label: "Oceans", url: "https://app.dumpark.com/seas-of-plastic-2/app/data/Oceans.geojson" }],
      note: "Seas of Plastic's own data files, read live: sampling stations, the trips that took them, and its ocean areas." },
    { id: "final_nail", name: "Final Nail (fur farms)", unit: "farms", colour: "#6B5A4A", route: "wpgmza", ready: true, lazy: true,
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
    { id: "atlas_hotspots", name: "Atlas for the End of the World: Hotspots", unit: "biodiversity hotspots", colour: "#6E5A55", route: "arcgisapp", ready: true, lazy: true,
      item: "ba55aa1bff5447e7b72559b8dc1a0e83", pdfBase: "https://atlas-for-the-end-of-the-world.com/hotspots/",
      pdfs: [["atlantic_forests", "Atlantic Forest"], ["california_floristic_province", "California Floristic Province"], ["cape_floristic_region", "Cape Floristic Region"], ["caribbean_islands", "Caribbean Islands"], ["caucasus", "Caucasus"], ["cerrado", "Cerrado"], ["chilean_valdivian_forests", "Chilean Winter Rainfall Valdivian Forests"], ["coastal_forests_of_eastern_africa", "Coastal Forests of Eastern Africa"], ["east_melanesian_islands", "East Melanesian Islands"], ["eastern_afromontane", "Eastern Afromontane"], ["forests_of_east_australia", "Forests of Eastern Australia"], ["guinean_forests_of_west_africa", "Guinean Forests of West Africa"], ["himalaya", "Himalaya"], ["horn_of_africa", "Horn of Africa"], ["japan", "Japan"], ["madagascar", "Madagascar & The Indian Ocean Islands"], ["madrean_woodlands", "Madrean Pine-Oak Woodlands"], ["maputaland_pondoland_albany", "Maputaland Pondoland Albany"], ["mediterranean_basin", "Mediterranean Basin"], ["mesoamerica", "Mesoamerica"], ["mountains_of_central_asia", "Mountains of Central Asia"], ["mountains_of_southwest_china", "Mountains of Southwest China"], ["new_caledonia", "New Caledonia"], ["new_zealand", "New Zealand"], ["philippines", "Philippines"], ["north_american_coastal_plain", "North American Coastal Plain"], ["southwest_australia", "Southwest Australia"], ["succulent_karoo", "Succulent Karoo"], ["sundaland", "Sundaland"], ["tropical_andes", "Tropical Andes"], ["wallacea", "Wallacea"], ["western_ghats_sri_lanka", "Western Ghats & Sri Lanka"]],
      note: "The 36 biodiversity hotspots, outlined live from Conservation International's Biodiversity Hotspots 2016.1 (CC BY 3.0), the boundaries the Atlas maps; each box links the Atlas's own PDF for that hotspot." },
    { id: "atlas_cities", name: "Atlas for the End of the World: Hotspot Cities", unit: "cities", colour: "#5E6070", route: "atlascities", ready: true, lazy: true,
      pageBase: "https://atlas-for-the-end-of-the-world.com/hotspot_cities/", positions: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/atlas/cities.json",
      cities: [["antananarivo", "Antananarivo, Madagascar"], ["auckland", "Auckland, New Zealand"], ["baku", "Baku, Azerbaijan"], ["bogota", "Bogotá, Colombia"], ["brasilia", "Brasília, Brazil"], ["cape_town", "Cape Town, South Africa"], ["chengdu", "Chengdu, China"], ["colombo", "Colombo, Sri Lanka"], ["dar_es_salaam", "Dar es Salaam, Tanzania"], ["davao", "Davao, Philippines"], ["durban", "Durban, South Africa"], ["esfahan", "Esfahan, Iran"], ["guadalajara", "Guadalajara, Mexico"], ["guayaquil", "Guayaquil, Ecuador"], ["hongknog_shenzhen_quangzhou", "Hongkong-Shenzhen-Guangzhou, China"], ["honolulu", "Honolulu, United States"], ["houston", "Houston, United States"], ["jakarta", "Jakarta, Indonesia"], ["lagos", "Lagos, Nigeria"], ["los_angeles", "Los Angeles, United States"], ["makassar", "Makassar, Indonesia"], ["mecca", "Mecca, Saudi Arabia"], ["mexico_city", "Mexico City, Mexico"], ["nairobi", "Nairobi, Kenya"], ["osaka", "Osaka, Japan"], ["perth", "Perth, Australia"], ["port-au-prince", "Port-au-Prince, Haiti"], ["rawalpindi", "Rawalpindi, Pakistan"], ["santiago", "Santiago, Chile"], ["sao_paulo", "São Paulo, Brazil"], ["sydney", "Sydney, Australia"], ["tashkent", "Tashkent, Uzbekistan"], ["tel_aviv", "Tel Aviv, Israel"]],
      note: "The Atlas's 33 hotspot cities; each is placed from its name through a weekly OpenStreetMap lookup, and its box links the Atlas's own page." },
    { id: "building_types", name: "Building types", unit: "places", colour: "#6A6258", route: "buildings", ready: true, lazy: true,
      archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/building_types.pmtiles", summaryUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/building_types.json",
      note: "Every building in the executive, financial, legal, legislative, judicial, anti-slavery and activist-rights maps' files, one record per place: where two files describe the same place, the fuller record leads and every field the other adds is kept." },
    { id: "monitor_abortion", name: "Abortion — law, access and outcomes worldwide", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/abortion-feed", wire: "wire_abortion.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_invasion", name: "Invasion of Non-Humans — worldwide", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/invasion-feed", wire: "wire_invasion.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_indigenous", name: "Invasion of Native Peoples — worldwide", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/indigenous-feed", wire: "wire_indigenous.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_conflict", name: "The Conflict Wire — worldwide", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/conflict-feed", wire: "wire_conflict.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_space", name: "The Space Front — live monitor", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/space-feed", wire: "wire_space.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_neo", name: "Impact Watch — near-Earth objects, worldwide", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/neo-feed", wire: "wire_neo.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_uap", name: "The Unidentified — UAP, worldwide", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/uap-feed", wire: "wire_uap.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_environment", name: "The Frontline — environmental destruction, worldwide", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/environment-feed", wire: "wire_env.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_resource", name: "Control of Resources — money, debt, land and the routes between", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/resource-feed", wire: "wire_resource.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_inequality", name: "Inequality — who owns, who is priced out, and who carries the loss", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/inequality-feed", wire: "wire_inequality.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_school", name: "School — who owns it, who writes it, and what it is for", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/school-feed", wire: "wire_school.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_police", name: "Law enforcement — duty, force, surveillance and what you may refuse", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/police-feed", wire: "wire_police.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_discrimination", name: "Discrimination — who is treated unequally, and what is done about it", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/discrimination-feed", wire: "wire_discrimination.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_voter", name: "Voter suppression — who paid, who was kept out, and who counted", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/voter-feed", wire: "wire_voter.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_lobbying", name: "Lobbying — who paid whom to shape the law, and through what register", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/lobbying-feed", wire: "wire_lobbying.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_food", name: "Food and drink — who owns it, who funds what is said about it, and what the label certifies", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/food-feed", wire: "wire_food.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_medical", name: "The medical industry — who pays the prescriber, and what the safety data shows", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/medical-feed", wire: "wire_medical.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_advertising", name: "The advertising industries — how attention is taken, and under what rules", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/advertising-feed", wire: "wire_advertising.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_news", name: "The news industry — who owns it, what replaced the reporting, and who pays to pollute it", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/news-feed", wire: "wire_news.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_science", name: "Science — what is wrong with the published record, and what catches it", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/science-feed", wire: "wire_science.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_entertainment", name: "The entertainment industries — who controls the bottleneck, and how deep the measurement goes", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/entertainment-feed", wire: "wire_entertainment.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "monitor_sports", name: "The sports industry — who takes the money, who carries the cost, and who is governing it", unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/sports-feed", wire: "wire_sports.json",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." },
    { id: "owid_interest", name: "Share of government spending going to interest payments (Our World in Data)", unit: "% of spending", colour: "#6E5F52", route: "owidgrapher", ready: true, lazy: true,
      slug: "share-of-government-expenditure-going-to-interest-payments",
      note: "Read live from Our World in Data each time it is ticked; the chart's own data, by country and year." },
    { id: "owid_corptax", name: "Statutory corporate income tax rate (Our World in Data)", unit: "% rate", colour: "#6E5F52", route: "owidgrapher", ready: true, lazy: true,
      slug: "statutory-corporate-income-tax-rate",
      note: "Read live from Our World in Data each time it is ticked; the chart's own data, by country and year." },
    { id: "owid_aid", name: "Foreign aid received as a share of national income (Our World in Data)", unit: "% of income", colour: "#6E5F52", route: "owidgrapher", ready: true, lazy: true,
      slug: "foreign-aid-received-as-a-share-of-national-income-net",
      note: "Read live from Our World in Data each time it is ticked; the chart's own data, by country and year." },
    { id: "wreckers_umap", name: "Wreckers of the Earth (Corporate Watch)", unit: "companies and sites", colour: "#6E5A55", route: "umap", ready: true, lazy: true,
      umap: "https://umap.openstreetmap.fr/en", umapId: 409815,
      note: "Read live from Corporate Watch's uMap each time it is ticked, with its own layers, colours and popups." },
    { id: "mymaps_chlorine", name: "Google My Maps map (plastics and chlorine section)", unit: "placemarks", colour: "#5F6B70", route: "kml", ready: true, lazy: true,
      kml: "https://www.google.com/maps/d/kml?mid=1PwPKisRf73FPC6hTtZDCv2s_B6_x0Pk7&forcekml=1",
      note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." },
    { id: "mymaps_trees", name: "Google My Maps map (trees section)", unit: "placemarks", colour: "#5F6E5C", route: "kml", ready: true, lazy: true,
      kml: "https://www.google.com/maps/d/kml?mid=1c-vPoGf79mfQezTgcFoKb-xN4A4&forcekml=1",
      note: "Read live from the map's Google My Maps file; the row takes the map's own title once it loads." },
    { id: "fractracker_refineries", name: "Global Oil Refinery Complexes (FracTracker)", unit: "refineries", colour: "#6A5E58", route: "arcgisapp", ready: true, lazy: true,
      item: "8e72a974af4c4fe9ba6875cee03078ee",
      note: "Read live from FracTracker's ArcGIS map: its own layers, fields and popups." },
    { id: "arcgis_ym8xk", name: "ArcGIS map (vinyl chloride section)", unit: "places", colour: "#5E6070", route: "arcgisapp", ready: true, lazy: true,
      item: "b1b5b5e0d08c4024a50caa88e6442281",
      note: "Read live from the ArcGIS map linked on the Destruction page (arcg.is/ym8XK); the row takes its own title once it loads." },
    { id: "arcgis_materialresearch", name: "ArcGIS map (materialresearch)", unit: "places", colour: "#665E6C", route: "arcgisapp", ready: true, lazy: true,
      item: "3ff82579637f4c7a96bd62d039ac3e00",
      note: "Read live from the ArcGIS experience linked on the Destruction page (arcg.is/4q8m4); the row takes its own title once it loads." },
    { id: "glad_loss", name: "Global Forest Change: tree cover loss (UMD GLAD)", unit: "loss since 2000, 30 m", colour: "#8A4F46", route: "rasterlive", ready: true, lazy: true,
      attribution: "Hansen/UMD/Google/USGS/NASA", maxzoom: 12,
      choices: [{ label: "Tree cover loss", tiles: "https://storage.googleapis.com/earthenginepartners-hansen/tiles/gfc_v1.12/loss_alpha/{z}/{x}/{y}.png" }],
      note: "The published Global Forest Change tiles, read live." },
    { id: "soilgrids", name: "SoilGrids (ISRIC)", unit: "soil properties, 250 m", colour: "#6B5A4A", route: "rasterlive", ready: true, lazy: true,
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
        { label: "Nitrogen in all wastewater", tiles: "https://mazu.nceas.ucsb.edu/wastewater/N_effluent/{z}/{x}/{y}.png" },
        { label: "From sewage treatment", tiles: "https://mazu.nceas.ucsb.edu/wastewater/N_effluent_treated/{z}/{x}/{y}.png" },
        { label: "From septic systems", tiles: "https://mazu.nceas.ucsb.edu/wastewater/N_effluent_septic/{z}/{x}/{y}.png" },
        { label: "Untreated (open defecation)", tiles: "https://mazu.nceas.ucsb.edu/wastewater/N_effluent_open/{z}/{x}/{y}.png" },
        { label: "Coastal nitrogen plumes", tiles: "https://mazu.nceas.ucsb.edu/wastewater/N_plumes/{z}/{x}/{y}.png" }
      ],
      note: "The model's published tiles, read live. Each chip is one of the model's own layers." },
  ],
};

const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS, EXEC_MAP, MONEY_MAP, LEGAL_MAP, LEG_MAP, JUD_MAP, MORE_MAPS, GMO_MAP, OTHER_MAPS];
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
function ensureLayer(cfg) {
  if (created.has(cfg.id)) return;
  created.add(cfg.id);
  setLayerState(cfg.id, "loading\u2026");
  // Dispatch by route, the same way the load handler does. Lazy children are
  // not all PMTiles — the livestock species are WMTS — and calling the archive
  // builder for a tile layer would fail on a URL that was never meant to be an
  // archive. addWmtsLayer is synchronous, so it is wrapped to keep one shape.
  const build = cfg.route === "wmts"
    ? Promise.resolve().then(() => addWmtsLayer(cfg))
    : cfg.route === "shapes" ? addShapesLayer(cfg)
    : cfg.route === "sitemap" ? addSitemapLayer(cfg)
    : cfg.route === "arcgis" ? Promise.resolve().then(() => addArcgisLayer(cfg))
    : cfg.route === "umap" || cfg.route === "kml" || cfg.route === "arcgisapp" ? addLivePlacesLayer(cfg)
    : cfg.route === "rasterlive" ? Promise.resolve().then(() => addRasterChoiceLayer(cfg))
    : cfg.route === "trase" ? addTraseLayer(cfg)
    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "owidgrapher" ? addOwidGrapherLayer(cfg)
    : cfg.route === "monitor" ? addMonitorLayer(cfg)
    : cfg.route === "buildings" ? addBuildingTypesLayer(cfg)
    : cfg.route === "spheres" ? addSpheresLayer(cfg)
    : ["ejatlas", "geojsonlive", "wpgmza", "atlascities", "trasefac"].includes(cfg.route) ? addLivePlacesLayer(cfg)
    : cfg.route === "wmsmenu" ? addWmsMenuLayer(cfg)
    : cfg.route === "gfwmenu" ? addGfwMenuLayer(cfg)
    : addPmtilesLayer(cfg);
  build
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
  site_indigenous_conflicts: ["human", "downstream"],
  palmwatch: ["plant", "downstream"],
  usda_soybean: ["plant", "downstream"],
  usda_corn: ["plant", "downstream"],
  unep_coral: ["animal", "downstream"],
  trase_measures: ["plant", "downstream"],
  mines_global: ["insentient", "downstream"],
  owid_interest: ["human", "upstream"],
  owid_corptax: ["human", "upstream"],
  owid_aid: ["human", "upstream"],
  monitor_abortion: ["human", "downstream"],
  monitor_invasion: ["animal", "downstream"],
  monitor_indigenous: ["human", "downstream"],
  monitor_conflict: ["human", "downstream"],
  monitor_space: ["insentient", "upstream"],
  monitor_neo: ["insentient", "downstream"],
  monitor_uap: ["insentient", "downstream"],
  monitor_environment: ["plant", "downstream"],
  monitor_resource: ["human", "upstream"],
  monitor_inequality: ["human", "upstream"],
  monitor_school: ["human", "upstream"],
  monitor_police: ["human", "upstream"],
  monitor_discrimination: ["human", "downstream"],
  monitor_voter: ["human", "upstream"],
  monitor_lobbying: ["human", "upstream"],
  monitor_food: ["human", "upstream"],
  monitor_medical: ["human", "upstream"],
  monitor_advertising: ["human", "upstream"],
  monitor_news: ["human", "upstream"],
  monitor_science: ["human", "upstream"],
  monitor_entertainment: ["human", "upstream"],
  monitor_sports: ["human", "upstream"],
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
      `<span class="body"><span class="nm">${cfg.name}</span>` +
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

  const pending = LAYERS.filter((c) => !c.ready);
  if (pending.length) {
    const el = document.createElement("p");
    el.className = "pending-note";
    el.textContent = `${pending.length} more sources in progress: ` +
      pending.map((c) => c.name).join(", ") + ".";
    box.appendChild(el);
  }

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

    const id = e.target.dataset.layer;
    if (!id) return;
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

  document.getElementById("note").textContent =
    `Below zoom ${CLUSTER_MAXZOOM} every layer shows summed totals. Zoom past it and ` +
    `individual assets load for the visible area only. Units differ by layer and ` +
    `are never combined into a single figure.`;
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
  canvas.classList.toggle("gm-open", open);
  // The container changed size, so MapLibre has to re-measure or the canvas
  // keeps the old dimensions and the mouse lands in the wrong place.
  if (typeof map.resize === "function") map.resize();
  if (open) gmSync(true);
}

function gmInit() {
  const close = document.getElementById("gmClose");
  if (close) close.addEventListener("click", () => gmSetOpen(false));
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

/* ---------- the layers box, in the order and under the headings chosen ---------- */
// Strings are layer ids; "group:" a whole group; "gm" the guerillamap row.
// { h: level, t: text } is a heading. Anything not named here goes under
// "Not yet placed" at the end, so nothing disappears unseen; ids in
// PANEL_REMOVED are taken out of the box.
const PANEL_ORDER = [
  { h: 1, t: "On-planet invasion" },
  { h: 2, t: "Pre-birth frontlines" }, "monitor_abortion", "gmo_releases", "group:gmo_map_layers",
  { h: 2, t: "Post-birth invasion" },
  { h: 3, t: "Invasion of nonhumans" }, "monitor_invasion",
  { h: 3, t: "Invasion of humans" }, "monitor_indigenous", "site_settler_colonialism", "site_indigenous_conflicts",
  { h: 3, t: "Of countries by countries" }, "monitor_conflict", "site_secret_societies", "gm",
  { h: 2, t: "Post-life invasion" }, "remains_records", "remains_findings", "remains_cemeteries",

  { h: 1, t: "Off-planet invasion" },
  "monitor_space", "monitor_neo", "monitor_uap",

  { h: 1, t: "Destruction" },
  { h: 2, t: "Of the planet" }, "monitor_environment",
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
  { h: 2, t: "Of humans" },
  { h: 3, t: "Physical suppression" },
  { h: 4, t: "Control of physical resources" }, "monitor_resource", "site_central_banks", "site_banking_dynasties", "site_export_credit", "site_wealth_atlas",
    "site_export_credit_shading", "site_earmarked_funding", "site_trade_profits", "site_social_spheres",
    "owid_interest", "owid_corptax", "owid_aid",
  { h: 4, t: "Economic inequality within it" }, "monitor_inequality",
  { h: 5, t: "School" }, "monitor_school",
  { h: 4, t: "Law enforcement" }, "monitor_police",
  { h: 4, t: "Courts and corrections" },
  { h: 4, t: "Discrimination" }, "monitor_discrimination",
  { h: 4, t: "Slavery" }, "slavery_sites", "slavery_ports", "slavery_routes", "slavery_determinations", "slavery_enforcement",
  { h: 5, t: "National shading" }, "slavery_cases", "slavery_prevalence",
  { h: 3, t: "Suppression by \u201crepresentation\u201d within it" },
  { h: 4, t: "Politics as a front" },
  { h: 5, t: "Voter suppression" }, "monitor_voter",
  { h: 5, t: "Representation as presentation" },
  { h: 5, t: "For money-written-law" }, "monitor_lobbying",
  { h: 4, t: "The food and drink industries" }, "monitor_food",
  { h: 4, t: "The medical industry" }, "monitor_medical",
  { h: 3, t: "Suppression by information" },
  { h: 4, t: "The advertising industries" }, "monitor_advertising", "site_world_advertising",
  { h: 4, t: "The news industry" }, "monitor_news", "site_world_news",
  { h: 4, t: "The entertainment industries" }, "monitor_entertainment", "site_world_entertainment",
  { h: 4, t: "Science" }, "monitor_science", "site_research_integrity",
  { h: 3, t: "Suppression by social molds" },
  { h: 4, t: "Religion and spirituality" },
  { h: 4, t: "Sports" }, "monitor_sports", "site_eyes_network",
  { h: 4, t: "Holidays" },
  { h: 4, t: "Sex" },
  { h: 4, t: "Drugs" }, "capture_map", "site_cartel_cells",
  { h: 2, t: "Of animals" }, "site_animal_fighting", "site_animal_tourism", "site_circus", "site_animal_racing", "site_rodeo",
  { h: 2, t: "Of plants" }, "site_enslaved_plants",
  { h: 2, t: "Of microscopics" }, "site_enslaved_microbes",
  { h: 2, t: "Of the \u201cinsentient\u201d" }, "site_insentient",

  { h: 1, t: "Building types" }, "building_types",
];
const PANEL_REMOVED = new Set([
  "fin_bank", "fin_centralbank", "fin_taxoffice", "fin_govfinance", "fin_financial", "fin_exchange", "fin_insurance", "fin_accountant", "fin_remittance", "fin_stockexchange", "fin_auditoffice", "fin_devbank", "fin_mint", "legal_publicdefender", "legal_immigration", "legal_probation", "legal_juvenile", "leg_parliament", "leg_audit", "leg_electoral", "leg_ombudsman", "leg_council", "exec_firestation", "exec_townhall", "leg_townhall", "exec_govoffice", "exec_ministry", "exec_diplomatic", "exec_border", "jud_courts", "legal_courthouse", "slavery_facilities", "activist_courts", "exec_police", "legal_police", "activist_police", "exec_prison", "legal_prison", "jud_prisons", "activist_prisons",
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
    head.innerHTML = `<span class="toc-arrow">\u25B8</span><span class="toc-t">${escapeHtml(t)}</span><span class="toc-n"></span>`;
    const body = document.createElement("div");
    body.className = "toc-body";
    body.hidden = true;
    head.addEventListener("click", (e) => {
      e.preventDefault();
      body.hidden = !body.hidden;
      head.setAttribute("aria-expanded", String(!body.hidden));
    });
    sec.appendChild(head);
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
    const nodes = panelNodes(box, item);
    nodes.forEach((n) => into().appendChild(n));
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
  if (rest.childNodes.length) {
    stack.length = 1;
    const sec = heading(1, "Not yet placed");
    box.appendChild(sec);
    sec.querySelector(".toc-body").appendChild(rest);
  }
  // Beside each heading, how many layers are inside it.
  for (const sec of box.querySelectorAll(".toc-sec")) {
    const n = sec.querySelectorAll("[data-layer], [data-gm]").length;
    const el = sec.querySelector(".toc-n");
    if (el) el.textContent = n ? String(n) : "none yet";
  }
  tail.filter((el) => el.classList && el.classList.contains("pending-note")).forEach((el) => box.appendChild(el));
  box.appendChild(gone);
  if (!document.getElementById("panel-h-style")) {
    const st = document.createElement("style");
    st.id = "panel-h-style";
    st.textContent = ".panel-h{margin:10px 0 4px;color:var(--ink,#e8e2d6)}" +
      ".panel-h1{font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-top:1px solid rgba(255,255,255,.18);padding-top:8px;font-weight:700}" +
      ".panel-h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;padding-left:4px;font-weight:600}" +
      ".panel-h3{font-size:11px;opacity:.8;padding-left:10px;font-weight:600}" +
      ".panel-h4{font-size:10.5px;opacity:.7;padding-left:16px;font-style:italic}" +
      ".panel-h5{font-size:10.5px;opacity:.62;padding-left:22px}";
    document.head.appendChild(st);
  }
}
map.on("load", () => setTimeout(arrangePanel, 0));

// The layers box runs down to the "Showing" box; the news wires box starts
// under the view box. Both follow those boxes' heights as they change.
function trackBoxHeights() {
  const root = document.documentElement;
  const legend = document.getElementById("legend");
  const view = document.getElementById("basemaps");
  if (!root || !root.style || typeof ResizeObserver === "undefined") return;
  const set = () => {
    const lh = legend && !legend.hidden ? legend.getBoundingClientRect().height : 0;
    root.style.setProperty("--legend-h", lh ? Math.round(lh + 8) + "px" : "0px");
    const vh = view ? view.getBoundingClientRect().height : 0;
    root.style.setProperty("--wire-top", Math.round(16 + vh + 8) + "px");
  };
  const ro = new ResizeObserver(set);
  if (legend) ro.observe(legend);
  if (view) ro.observe(view);
  if (legend && typeof MutationObserver !== "undefined") new MutationObserver(set).observe(legend, { attributes: true, attributeFilter: ["hidden"] });
  set();
}
map.on("load", () => setTimeout(trackBoxHeights, 0));

map.on("moveend", () => { clearTimeout(gmTimer); gmTimer = setTimeout(gmSync, 900); });

}  // end of the double-execution guard
