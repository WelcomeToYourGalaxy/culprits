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
function ctChild(id, label, base) {
  return {
    id,
    name: label,
    unit: "t CO\u2082e/yr (GWP-100)",
    colour: "#8F4E40",
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
  { id:"owid_co2",             name:"National CO₂ emissions", unit:"Mt CO₂/yr", colour:"#8A5750", route:"country", ready:true },
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
  { id:"slavery_cases",        name:"Identified trafficking cases", unit:"identified cases", colour:"#7A6A72", route:"country", ready:true,
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
    collection: "public.slick_plus", drawFrom: 7,
    // Every field the collection publishes except centerlines — a skeleton of
    // each slick nested inside it, which the map cannot draw and which was
    // most of every tile's weight. Geometry columns are never sent as fields.
    // Read from /queryables, not from documentation. If SkyTruth add a field it
    // will not appear until it is added here.
    properties: ["id", "slick_timestamp", "machine_confidence", "slick_confidence", "length", "area", "perimeter", "polsby_popper", "fill_factor", "aspect_ratio_factor", "cls", "orchestrator_run", "linearity", "s1_scene_id", "hitl_cls", "hitl_cls_name", "aoi_type_1_ids", "aoi_type_2_ids", "aoi_type_3_ids", "source_type_1_ids", "source_type_2_ids", "source_type_3_ids", "max_source_collated_score", "slick_url"],
    note: "Potential slicks. SkyTruth state that oil cannot be definitively identified from radar alone, so every shape here is a detection awaiting review. Coverage is EEZs rather than the high seas. Every detection since January 2023, live. Wide out the panel gives the total number of detections; shapes draw from zoom 7, where a slick is large enough to see. From there, a square marked with a dashed edge holds more slicks than one tile can carry, and shows only some of them until you zoom in.",
    attribution: '<a href="https://cerulean.skytruth.org" target="_blank" rel="noopener">SkyTruth Cerulean</a>' },
  { id:"cerulean_sources",     name:"Slick sources (Cerulean)", unit:"candidate vessels and platforms", colour:"#6B5F58", route:"worker", ready:true, off: true,
    geometry:"polygon", maxAreaDeg2: 120,
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
    note: "Mapped between 32°N and 32°S only, which is the product's stated extent and not an absence of reefs elsewhere. Benthic zones to 10 m depth. The Atlas draws its shapes only for small areas, so they appear from zoom 12; wider out this layer is empty by necessity, not because there are no reefs.",
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
// 3,421 at zoom 7, 376 at zoom 9. That is why shapes draw from zoom 7 — the
// first measured zoom under the cap. Denser seas may still exceed it at 7,
// which is what the marking is for.
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
const BASE_GRADE = {
  atlas: { "raster-brightness-min": ATLAS_TUNE.lift, "raster-brightness-max": 1,
           "raster-saturation": ATLAS_TUNE.sat, "raster-contrast": ATLAS_TUNE.con,
           "raster-hue-rotate": ATLAS_TUNE.hue },
  // Unchanged from before the atlas existed.
  satellite: { "raster-brightness-min": 0, "raster-brightness-max": .74,
               "raster-saturation": -.22, "raster-contrast": .10,
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
const atlasWashes = {
  id: "atlas-washes", type: "custom", renderingMode: "2d",
  onAdd(m, gl) {
    try {
      const sh = (type, src) => {
        const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
        return o;
      };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER,
        "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }"));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER,
        "precision mediump float; uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }"));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      this.prog = p;
      this.aPos = gl.getAttribLocation(p, "p");
      this.uCol = gl.getUniformLocation(p, "c");
      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.map = m;
    } catch (e) {
      // A GPU that rejects the shader leaves the imagery ungraded by washes
      // rather than taking the map down. Everything else still draws.
      this.failed = true;
      console.warn("[culprits] atlas washes unavailable:", e.message || e);
    }
  },
  render(gl) {
    if (this.failed || BASEMAP !== "atlas") return;
    // MapLibre binds its own vertex array objects. Drawing with one still bound
    // would rewrite MapLibre's attribute state; unbind first. MapLibre marks its
    // GL state dirty around a custom layer and restores the rest itself.
    if (gl.bindVertexArray) gl.bindVertexArray(null);
    else { const x = gl.getExtension("OES_vertex_array_object"); if (x) x.bindVertexArrayOES(null); }
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    // Alpha is left as it was in every pass: these change colour, not coverage.
    const func = {
      screen:   [gl.ONE, gl.ONE_MINUS_SRC_COLOR],
      multiply: [gl.ZERO, gl.SRC_COLOR],
      gain:     [gl.DST_COLOR, gl.ONE],
    };
    for (const pass of atlasWashPasses(this.map.getZoom())) {
      const [src, dst] = func[pass.mode];
      gl.blendFuncSeparate(src, dst, gl.ZERO, gl.ONE);
      gl.uniform3f(this.uCol, pass.rgb[0], pass.rgb[1], pass.rgb[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  },
};

// Colour is a judgement and judgements want a knob, not a redeploy:
//   atlasTune({ green: .4, warm: .3, sat: .25 })     atlasTune() prints them
window.atlasTune = (next) => {
  if (!next) { console.log("[culprits] atlas tune", JSON.stringify(ATLAS_TUNE)); return ATLAS_TUNE; }
  for (const k of Object.keys(next)) if (k in ATLAS_TUNE) ATLAS_TUNE[k] = next[k];
  Object.assign(BASE_GRADE.atlas, {
    "raster-brightness-min": ATLAS_TUNE.lift, "raster-saturation": ATLAS_TUNE.sat,
    "raster-contrast": ATLAS_TUNE.con, "raster-hue-rotate": ATLAS_TUNE.hue });
  setBasemap(BASEMAP);
  return ATLAS_TUNE;
};

const map = new maplibregl.Map({
  container: "map",
  center: [12, 24],
  zoom: 1.6,
  attributionControl: { compact: true },
  style: {
    version: 8,
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

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-right");

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
  map.addLayer({
    id: `${cfg.id}-agg`,
    type: "circle",
    source: src,
    "source-layer": owner,
    ...(cfg.where ? { filter: cfg.where } : {}),
    maxzoom: CLUSTER_MAXZOOM,
    paint: {
      "circle-color": cfg.colour,
      "circle-opacity": .55,
      "circle-stroke-color": cfg.colour,
      "circle-stroke-width": 1,
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
        0,  ["*", 0.26 * scale, MAGNITUDE_RADIUS],
        3,  ["*", 0.38 * scale, MAGNITUDE_RADIUS],
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
function addOutlineLayers() {
  if (map.getLayer("outline-land")) return;
  ensureBoundaries();
  map.addLayer({ id: "outline-land", type: "fill", source: "boundaries",
                 paint: { "fill-color": "#202825" } }, "atlas-washes");
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
  show("hillshade", imagery);
  show("atlas-plate", kind === "atlas");
  show("outline-land", !imagery);
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

function buildBasemapPanel() {
  const box = document.getElementById("basemaps");
  if (!box) return;
  const opts = [
    ["atlas", "Painted atlas",
     "A painted world chart at world view, fading into satellite imagery between " +
     "zoom 3 and 5. The imagery is recoloured, not redrawn: every coastline is " +
     "still Esri's photograph."],
    ["satellite", "Satellite imagery",
     "Esri World Imagery with relief, darkened so the layers read on top."],
    ["outlines", "Country outlines",
     "Country shapes from this map's own boundary file. No imagery."],
  ];
  box.innerHTML = `<p class="bm-h">Basemap</p>` + opts.map(([k, nm, un]) =>
    `<label class="layer"><input type="radio" name="basemap" value="${k}"` +
    `${k === BASEMAP ? " checked" : ""}><span class="body"><span class="nm">${nm}</span>` +
    `<span class="un">${un}</span></span></label>`).join("");
  box.addEventListener("change", (e) => {
    if (e.target && e.target.name === "basemap") setBasemap(e.target.value);
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

function addCoralLayer(cfg) {
  map.addSource(`${cfg.id}-tiles`, {
    type: "vector",
    tiles: [cfg.tiles.replace(/^https:\/\//, "coral://")],
    // No tileSize: MapLibre only accepts 512 for vector tiles and throws on
    // anything else, which silently left this layer unbuilt. A vector tile is
    // not a picture of a fixed size, so the Atlas's grid is read correctly.
    minzoom: cfg.drawFrom, maxzoom: 16,
    attribution: cfg.attribution || "",
  });
  addCoralShapes(cfg, false);
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
      setLayerState(cfg.id, `zoom in to ${cfg.drawFrom} — the Atlas cannot draw reefs over a wider area`);
      return;
    }
    if ((visibility.get(cfg.id) || "visible") !== "visible") return;
    const failed = coralFailures.get(cfg.id) || 0;
    const loaded = typeof map.querySourceFeatures === "function"
      ? map.querySourceFeatures(`${cfg.id}-tiles`, { sourceLayer: cfg.sourceLayer }).length : 0;
    const loading = typeof map.isSourceLoaded === "function" && !map.isSourceLoaded(`${cfg.id}-tiles`);
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
    new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
      .setLngLat(e.lngLat).setHTML(html(e.features[0].properties)).addTo(map);
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

  // Wide out, no squares. At world view four squares covered the planet, each
  // shaded near full by tens of thousands of slicks — a grey wash with a cross
  // where their edges met — and each waited on Cerulean's slowest query. One
  // total says what is true at that scale without drawing anything misleading.
  if (map.getZoom() < cfg.drawFrom) {
    const empty = { type: "FeatureCollection", features: [] };
    counts.setData(empty);
    caps.setData(empty);
    const total = ceruleanTotals.get(cfg.id);
    if (typeof total === "number") {
      setLayerState(cfg.id, `${total.toLocaleString()} potential slicks since January 2023 — ` +
                            `zoom in to ${cfg.drawFrom} to draw them`);
    } else {
      setLayerState(cfg.id, `zoom in to ${cfg.drawFrom} to draw slicks`);
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
  const z = Math.max(1, Math.min(12, Math.floor(map.getZoom())));
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
  const popup = (p) => {
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
  bindHtmlPopup(`${cfg.id}-fill`, popup);
  bindHtmlPopup(`${cfg.id}-line`, popup);
  bindHtmlPopup(`${cfg.id}-pt`, popup);
  setLayerState(cfg.id, `${data.features.length.toLocaleString()} ${cfg.unit}`);
  applyVisibility(cfg.id);
  buildLegend();
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
  [`${id}-agg`, `${id}-pt`, `${id}-fill`, `${id}-line`, `${id}-raster`, `${id}-cap`].forEach((l) => {
    if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
  });
  const cfg = LAYERS.find((l) => l.id === id);
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
  name: "The site's other maps",
  group: true,
  ready: true,
  children: [
    { id: "site_animal_sacrifice", name: "Animal sacrifice sites", unit: "sites", colour: "#7A4F4A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_animal_sacrifice.pmtiles",
      note: "From the Destruction page's animal sacrifice map." },
    { id: "site_animal_fighting", name: "Animal fighting venues", unit: "venues", colour: "#84594F", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_animal_fighting.pmtiles",
      note: "From the Destruction page's animal fighting map (maps repo)." },
    { id: "site_carbon_mapper_waste", name: "Methane plumes from waste sites (Carbon Mapper)", unit: "plume sources", colour: "#6D6A5E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_carbon_mapper_waste.pmtiles",
      note: "From the Destruction page's Carbon Mapper waste-sector map: the hotspots written into that map, not Carbon Mapper's live feed." },
    { id: "site_forest500_soy", name: "Worst soy financiers (Forest 500)", unit: "financial institutions", colour: "#6B5B4E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_forest500_soy.pmtiles",
      note: "From the Destruction page's Forest 500 map: institutions scoring 2 or less of 94 on soy policy, placed at their headquarters." },
    { id: "site_china_grain", name: "China grain storage (Sinograin)", unit: "depots", colour: "#76705C", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_china_grain.pmtiles",
      note: "From the Destruction page's China grain storage map. The page states 205 facilities; this layer carries the positions its map draws." },
    { id: "site_soybean_companies", name: "Soy trading companies", unit: "offices", colour: "#6F7560", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_soybean_companies.pmtiles",
      note: "From the Destruction page's soy companies map (maps repo)." },
    { id: "site_secret_societies", name: "International military secret societies", unit: "organisations", colour: "#5E5A6E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_secret_societies.pmtiles",
      note: "From the On-Planet Invasion page's secret societies map." },
    { id: "site_ufo_pre1900", name: "Pre-1900 UFO and USO sightings", unit: "recorded sightings", colour: "#5F6B78", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_ufo_pre1900.pmtiles",
      note: "From the Off-Planet Invasion page's historical sightings archive." },
    { id: "site_central_banks", name: "Central banks", unit: "banks", colour: "#5C6570", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_central_banks.pmtiles",
      note: "From the Suppression page's central banks map." },
    { id: "site_banking_dynasties", name: "Banking dynasties", unit: "dynasty seats", colour: "#6A5D6B", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_banking_dynasties.pmtiles",
      note: "From the Suppression page's banking dynasties map." },
    { id: "site_export_credit", name: "Export credit agencies", unit: "agencies", colour: "#5E6A63", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_export_credit.pmtiles",
      note: "From the Suppression page's export credit agencies map. Its country shading is not carried here, only the agencies." },
    { id: "site_wealth_atlas", name: "Richest dynasties and individuals", unit: "families and individuals", colour: "#735E57", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_wealth_atlas.pmtiles",
      note: "From the Suppression page's wealth atlas." },
    { id: "site_food_system", name: "Who owns the food system", unit: "companies", colour: "#6E6A55", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_food_system.pmtiles",
      note: "From the Suppression page's food system ownership map." },
    { id: "site_world_advertising", name: "Advertising companies and owners", unit: "companies", colour: "#6C5F66", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_world_advertising.pmtiles",
      note: "From the Suppression page's World Advertising 2026 map." },
    { id: "site_world_news", name: "News outlets and owners", unit: "outlets and owners", colour: "#626A6F", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_world_news.pmtiles",
      note: "From the Suppression page's World News 2026 map." },
    { id: "site_research_integrity", name: "Research integrity breaches", unit: "institutions and publishers", colour: "#5F6E6A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_research_integrity.pmtiles",
      note: "From the Suppression page's research integrity map." },
    { id: "site_world_entertainment", name: "Entertainment companies and owners", unit: "companies", colour: "#6D5E5A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_world_entertainment.pmtiles",
      note: "From the Suppression page's World Entertainment 2026 map." },
    { id: "site_eyes_network", name: "The network that tried to harness the eyes", unit: "places", colour: "#5B6360", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_eyes_network.pmtiles",
      note: "From the Suppression page's sports section network map." },
    { id: "site_animal_tourism", name: "Animal tourism sites", unit: "locations", colour: "#7C6356", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_animal_tourism.pmtiles",
      note: "From the Suppression page's animal tourism atlas." },
    { id: "site_circus", name: "Circuses and animal shows", unit: "venues", colour: "#7A5E61", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_circus.pmtiles",
      note: "From the Suppression page's circus map." },
    { id: "site_animal_racing", name: "Animal racing and sports venues", unit: "venues", colour: "#7B6452", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_animal_racing.pmtiles",
      note: "From the Suppression page's animal racing map (maps repo)." },
    { id: "site_rodeo", name: "Rodeos and charreadas", unit: "events and arenas", colour: "#80665A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_rodeo.pmtiles",
      note: "From the Suppression page's rodeo and charreada map." },
    { id: "site_enslaved_plants", name: "Unnecessary enslavement of plants", unit: "companies", colour: "#62705A", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_enslaved_plants.pmtiles",
      note: "From the Suppression page's plant enslavement map." },
    { id: "site_enslaved_microbes", name: "Unnecessary enslavement of microorganisms", unit: "companies", colour: "#6A6E62", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_enslaved_microbes.pmtiles",
      note: "From the Suppression page's microorganism enslavement map." },
    { id: "site_insentient", name: "The insentient", unit: "companies", colour: "#66625E", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_insentient.pmtiles",
      note: "From the Suppression page's map of industries built on things called insentient." },
    { id: "site_subsistence_cultures", name: "Subsistence cultures", unit: "peoples", colour: "#5F7166", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_subsistence_cultures.pmtiles",
      note: "From the Suppression page's subsistence cultures map." },
    { id: "site_self_sufficiency", name: "Citizen and local self-sufficiency programs", unit: "programs", colour: "#5E6F5B", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_self_sufficiency.pmtiles",
      note: "From the Solution page's self-sufficiency programs map." },
    { id: "site_environment_law", name: "Environmental law instruments", unit: "legal instruments", colour: "#5A6B72", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_environment_law.pmtiles",
      note: "From the Destruction page's environmental law map (enviro-atlas repo)." },
    { id: "site_cartel_cells", name: "Cartel cells", unit: "cells and sites", colour: "#6A5A58", route: "pmtiles", ready: true, lazy: true, archiveUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/tiles/site_cartel_cells.pmtiles",
      note: "From the Suppression page's cartel cells map (maps repo). Its 238 connecting lines are not drawn in this layer, only the places." },
    { id: "enviro_law_by_country", name: "Environmental law by country and region (enviro-atlas)", unit: "countries", colour: "#5A6B72", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/enviro_law_by_country.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "site_earmarked_funding", name: "Earmarked funding to international organisations", unit: "countries", colour: "#6A5E66", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/site_earmarked_funding.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "site_trade_profits", name: "Who captures the profits in global trade (OECD TiVA)", unit: "countries", colour: "#6E6358", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/site_trade_profits.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "site_settler_colonialism", name: "Settler colonialism and native displacement", unit: "territories", colour: "#6B5A52", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/site_settler_colonialism.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "site_social_spheres", name: "The social spheres (board and membership links)", unit: "links", colour: "#5E6068", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/site_social_spheres.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
    { id: "site_cartel_lines", name: "Cartel cells — connecting lines", unit: "links", colour: "#6A5A58", route: "shapes", ready: true, lazy: true, dataUrl: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/shapes/site_cartel_lines.geojson",
      note: "Areas, lines and per-country lists from the map, drawn as the map draws them." },
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

const GROUPS = [CT_SECTORS, CT_AGRICULTURE, CT_FORESTRY, CT_HISTORY, SITE_MAPS, EXEC_MAP, MONEY_MAP, LEGAL_MAP, LEG_MAP, JUD_MAP, MORE_MAPS, GMO_MAP];
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
    const cfg = LAYERS.find((l) => l.id === btn.dataset.facet);
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
  document.getElementById("zoomstate").innerHTML = z < CLUSTER_MAXZOOM
    ? `Zoom <b>${z.toFixed(1)}</b> — wide view.`
    : `Zoom <b>${z.toFixed(1)}</b> — detail view.`;
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
map.on("moveend", () => { clearTimeout(gmTimer); gmTimer = setTimeout(gmSync, 900); });

}  // end of the double-execution guard
