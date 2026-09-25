# Culprits atlas — handoff

Paste this into a new chat. Attach the repo zip, or just the files the issue
touches.

---

## Round 43 (24 September): controls moved; alerts and mosaic landscapes filed; internal layers out

- Zoom buttons right of the basemap choices (.bm-row); the north-up compass
  where they were, between the views and Snap back (.compass-holder.in-view).
- CATALOGUE_BY_TITLE: umd_glad_sentinel2_alerts(+_coverage) under Tree cover
  loss and alerts > Alerts; WRI trees in mosaic/complex landscapes (and
  coverage) under Deforestation > Trees in mosaic landscapes (new h4);
  planted-forest oil palm under Palm oil > Plantations; forest mills under
  Logging and timber concessions; taken out: umd_glad_dist_alerts_coverage,
  Chaco Chiquitano field boundaries, gadm_geotrellis_features,
  gfw_buffered_points, GFW Pro forest change regions.
- index.html asks for app.js?v=43.


## Round 42 (24 September): craft in space; one forest cover map; fresh code each round

- New heading From Earth > Craft in space with row eyes_craft: NASA's Eyes on
  the Solar System (spacecraft where they are now) in the bottom panel.
- Forest cover: only jrc_global_forest_cover stays, under Deforestation >
  Forest cover in 2020; wri_tropical_tree_cover_extent taken out too; the
  "forest" bundle is gone.
- map/index.html asks for app.js?v=42 and wire.js?v=42: browsers had kept old
  copies of app.js, so rounds 39 to 41 did not show (the launches' dates).
  Bump the number with each round that changes app.js or wire.js.


## Round 41 (24 September): forest management worldwide; three rows out

- New row forest_management (route rasterparts, addRasterPartsLayer) first
  under Deforestation: the Global Forest Management Type Map 2020 (VITO, IIASA,
  WRI; Zenodo 20396072, CC BY 4.0), 100 m, nine classes with the record's own
  names, drawn from culprits-tiles-more tiles/forest_management.pmtiles (runs
  of zooms listed in forest_management.build.json), key under the row.
- Taken out: the Housekeeping heading and skytruth_tests (kept as a layer,
  PANEL_REMOVED); ibge_bra_biomes; dtu_wb_wind_speed_potential_2001_2010.


## Round 40 (24 September): deforestation pared down, at the owner's word

- Taken out: arg_native_forest_land_plan (OTBN zoning); jrc_managed_land_can/usa
  (and the "managed" bundle); umd_tree_cover_density_2000/2010 and
  wri_tropical_tree_cover (the forest bundle keeps JRC forest cover 2020 and
  WRI tree cover extent).
- Forest emissions (Emissions from forests; forest GHG emissions and net flux)
  under Climate > Carbon dioxide only; the heading under Deforestation is gone.
- Zero-deforestation shares go with their commodity (ZDC placeholder in
  CATALOGUE_PLACES, routed in cataloguePlaces): beef to Meat > Cattle and
  pasture, soy to Agriculture > Soy, cocoa to Agriculture > Cocoa, palm to
  Palm oil, pulp to Wood pulp; the Zero-deforestation heading is gone.
- New Agriculture > Soy (site_forest500_soy, site_soybean_companies,
  soy_organizations) and Agriculture > Cocoa headings; dff stays under
  Deforestation > Companies and financiers.


## Round 39 (24 September): rings fit the screen; biosignatures round the globe; UAP and launches by time

- esa_risk ring: outer edge = min(1.95R, half the smaller screen side - 22);
  drawn once there is a 45 px band round the globe (it used to need the globe
  small enough for a 2R ring, so it came into view just before Eyes).
- biosignature: route worldsring (addWorldsRingLayer) reads WORLDS from the
  owner's page and draws the four worlds across the top of the globe, further
  out = further from Earth (logX), colour = probMid (WORLD_PROB, muted).
- ufo_sightings: "UAP sightings reported worldwide (UFOSINT)", route ufo
  (addUfoLayer) over the format-2 copy (one point per spot and year: y, n,
  ids); a year bar (timeBar) with an undated tick; a click lists every
  sighting at the spot, each opening to every field. No USO category: nothing
  UFOSINT publishes marks a sighting as underwater.
- ll2_upcoming: "Upcoming launches per site"; addLaunchSitesLayer draws one
  point per pad; its box lists the launches soonest first with the date beside
  each name, each opening to the full record; a date bar filters them.


## Round 38 (24 September): biodiversity loss pared down; Global Safety Net's layers each a row

- Intact and primary forests keeps only Biodiversity Intactness (forested
  biomes) and the Forest Landscape Integrity Index (catalogueRefine).
- Taken out: wdpa_protected_areas (public release, v202512; the licensed copy
  wdpa_licensed_protected_areas, to v202608, stays); tiger conservation
  landscapes; US conservation easements; Peru's, Cambodia's (khm) and ICMBio
  Brazil's protected areas; Leuser; Nusantara's Equatorial Asia protected-area
  rows other than plain protected areas (names, merged, outlines, v3p2 copy,
  hydrological/forest reserves, ecosystem restoration, conservation landscapes).
- Endemic Bird Areas under a new heading Biodiversity loss > Birds.
- Global Safety Net: route gsn is a catalogue (CATALOGUE_ROUTES, PANEL_REMOVED,
  LIVE_ROUTES); each layer is a row "<name> (Global Safety Net)" under Places
  that matter most for species.


## Round 37 (24 September): forest and land cover pared down, at the owner's word

- The forest cover row (2000, 2010, 2020; bundle "forest") is under Deforestation.
- Taken out (CATALOGUE_BY_TITLE): every "GNW" row (Global Nature Watch carbon
  model and forest age: nothing published that draws); Indonesia's natural
  forest; IDN_FC2020_KLHK; every tree height row; mapbiomas_bra_land_cover;
  icf_hnd_forest_type_2013; rspo_southeast_asia_land_cover_2010;
  umd_tree_cover_gain; the United States land cover.
- jrc_managed_land_can and _usa are one row with sublayers (bundle "managed")
  under Deforestation > Forest zoning and management plans. JRC is the EU's
  Joint Research Centre, not a mining company, so not under Mining.


## Round 36 (24 September): agriculture pared down, at the owner's word

- Soy, corn and grain are under Climate > Nitrous oxide only (catalogue rule
  and CATALOGUE_SUBS; the Agriculture sub-heading is gone). Their clearing,
  its emissions and zero-deforestation shares get no Nitrous oxide copy.
- Fertilizer plants only under Climate > Nitrous oxide; Farm inputs gone.
- Taken out: Badung's detailed spatial plans (and the heading); coffee, cocoa,
  cotton and sugarcane rows incl. Merauke's sugarcane concessions and
  trase_cocoa_ivory (clearing for cocoa, its emissions and ZDC share stay);
  Trase's seven corn rows.
- New heading Water scarcity (under Of the planet): Aqueduct's rows.
- Plantation rows for Indonesia and its neighbours are one row with sublayers
  (bundle idnplant) under Agriculture > Plantations; worldwide rows beside it.
- Titles: CAFO and livestock density say "a model's estimate, not registered
  sites / not a count of farms"; the registered row says "sites on official
  registers".


## Round 35 (24 September): Materials research from a weekly copy; cattle rows refiled; CAFO and livestock rows fixed

- arcgis_materialresearch (Material Research World Atlas, item
  3ff82579637f4c7a96bd62d039ac3e00) has copy + archive: addArcgisCopyLayer reads
  culprits-tiles-more arcgis/arcgis_materialresearch/manifest.json, draws
  tiles/arcgis_materialresearch.pmtiles (layer "places": k, i, n, c), a chip per
  ArcGIS layer, and a click reads every field from gzipped pieces with the app's
  own popup. No copy yet: read live as before. Made by scripts/arcgis_copy.py.
- CATALOGUE_BY_TITLE, at the owner's word: Trase's cattle and pasture
  deforestation under Deforestation > Tree cover loss and alerts > Clearing for
  cattle only; gross and net emissions from cattle/pasture deforestation under
  Climate > Carbon dioxide only; Trase's Pasture area and every Global Pasture
  Watch layer (gpw_grasslands_*, wri_globalpasturewatch_grasslands*) taken out.
- abattoir_cafo and abattoir_glw never showed when ticked: their layers
  (<id>-cafo, <id>-glw) were not names applyVisibility knows; now listed in
  cfg._layerIds.


## Round 34 (24 September): UFO and UAP sightings (UFOSINT)

Row ufo_sightings under Off-planet > To Earth > Unidentified aerial phenomena:
route pmtiles (fine dots) over culprits-tiles-more tiles/ufo_sightings.pmtiles
(one file per zoom 0-10 when one file would pass 95 MB, listed in
ufo_sightings.build.json), made by scripts/ufosint.py from UFOSINT's public
SQLite release. Every row kept, duplicates included; hollow = UFOSINT placed it
from the place name (location.geocode_src). A click reads every field from
ufosint/pieces/<hh>.json.gz (readPiece now unpacks gzipped pieces). Left out:
witness_names. UFOSINT holds no licence from NUFORC, MUFON, CUFOS and the rest;
the owner chose to use it until NUFORC or CUFOS answer.
Also fixed: a split archive's further files never got the detail layer (its
zooms were read after being narrowed to the first file's), and the first
file's glow went on drawing its coarse points at every zoom.


## Round 33 (24 September): ESA's asteroid risk list as a real layer

esa_risk no longer opens ESA's site in a box. Route "neoring" (addNeoRingLayer
in map/app.js) reads ESA's own list (neo.ssa.esa.int ... esa_risk_list), or the
daily copy culprits-tiles-more/neo/esa_risk_list.txt if ESA's server refuses
the page, and draws every object on a canvas round the globe at world view
(globe or vertical perspective, pitch 5 or less, globe fully on screen):
- angle round the globe = date of likeliest impact, from this year clockwise;
  whole-year guides every 25 years or more; the ring spans 100 years at least.
- distance from the globe = cumulative impact probability (closer = likelier).
- size = diameter; colour = Palermo rating (muted plum to bone, five bins).
- click a mark: every field ESA gives, under ESA's own headings.
Nothing filtered: every row on the list is drawn.


## Round 32 (24 September): Climate TRACE by gas, one subsector at a time

The ct_gases run of 24 September (co2, agriculture) timed out at 160 minutes:
harvest 54 min and normalise 40 min for 59.9 million rows, then two of nine
subsectors tiled before the third (cattle operations, 18.8 million) ran out
of time. Nothing was saved, because the pair copied its archives only at the
end. Now:
- pipeline/sources/climate_trace.py takes CT_SUBSECTORS; a CSV whose first
  row is another subsector is passed over whole.
- culprits-tiles-more scripts/ct_gases.py works in (gas, sector, subsector)
  units, the subsectors listed from Climate TRACE's own schema CSV; each unit's
  archives (and any zoom parts with their .build.json) go into tiles/ and the
  list as soon as they are made. Units are recorded under "units" in
  tiles/climate_trace_gases.json.


## Round 31 (24 September): EJAtlas placed again

EJAtlas's plain list (/api/v1/conflicts/) no longer carries positions. Its own
map reads /api/v1/conflicts/?format=geojson; readEjatlas now reads that first
(following any next page) and falls back to the plain list. Also in
culprits-tiles-more: scripts/coastal_cleanup.py reads every page over every
date (?page=N&start=1900-01-01&end=today&year=true, as the site's own map
asks) instead of the single request that stopped at 5,000 sites.


## Round 30 (24 September): what the live layer check found

Checked in the browser by the owner (layer_check.js). Fixed here:
- Foreign aid (`owid_aid`) drew 0 countries: Our World in Data's files now end
  with a text column (owid_region); owidParse took the last column as the
  value. It now takes the numeric column.
- Harvested layers with no other status line (Unearthings findings) said
  "loading…" for good after drawing; they now say they are drawn.
- Trase measures: resources.trase.earth now blocks the browser (CORS) for the
  region shapes. scripts/trase.py in culprits-tiles-more copies them to
  trase/regions/; the map reads the copy first (`regionsCopy`).
Found working: trade acts, buildings, space industry, launches (from the
copy), hotspot cities (33), slick archive, vessels of concern, Trase
facilities, coastal cleanups, Wreckers of the Earth.
Still open: EJAtlas's API no longer gives positions (fields id, slug, image,
headline, name); Coastal Cleanup gives exactly 5,000 sites (a cap);
materialresearch reads a US census-tract layer slowly; Global Safety Net's
sub-layers not yet checked one by one.


## Round 29 (24 September): every field, everywhere

- Boxes written from a source's own template (uMap, ArcGIS apps, My Maps,
  WP Go Maps, Launch Library pads and launches, Trase regions) keep their
  template and now end with a folded "Every field the source gives" list
  (`everyField` in app.js): nested records spelt out with dotted names.
- Country totals list every figure in their record; resource trade flows list
  every field of the flow.
- Worker (`worker/index.js`, CACHE_VERSION v13): live points (EPA TRI, Land
  Matrix, fishing, GFW alerts) carry every upstream field as `x_<name>`, not
  only the picked ones. Needs `cd worker && wrangler deploy`.
- Not done: clicking a Global Forest Watch picture layer (COG or picture
  tiles) still shows nothing; a point read would need GFW's query service.


## Round 28 (24 September): tree cover loss by dominant driver, coloured

- `tsc_tree_cover_loss_drivers` drew grey: its tiles hold numbers, not a
  picture. GFW's own layer for them (Resource Watch layer cc62ec7c) reads them
  with the decode `treeLossByDriver` (wri/gfw config.js): blue = year - 2000,
  green = driver code, red = amount. New protocol `gfwdecode://` does the same
  per pixel and paints the map's own muted colours. Names 1 Commodity driven
  deforestation, 2 Shifting agriculture, 3 Forestry, 4 Wildfire,
  5 Urbanization, from the band's values table; RW's legend gives the same
  names, and its colours are the decode's colours for the same codes.
- Tiles as GFW asks for them: 30% tree cover (`tcd_30`), zooms 2 to 4,
  enlarged closer in. If over 5% of a square's pixels do not read as a year and
  a code 1 to 5, the row says so. Checked in headless Chromium with a made-up
  square (2015, Forestry): painted exactly the key's colour.
- Open question on round 27: wri/gfw commit 689b83d (28 Aug 2026, "remove zoom
  threshold", PR #5260) swapped the colours of classes 9 and 10 in
  alertDriversEncoded and changed class 3 by one. Before it, 9 painted in the
  "Other natural disturbance" colour and 10 in the "Wildfire" colour (legend
  order); since, the reverse. The map follows the current code and legend
  (9 Wildfire). The PR's text may say why.


## Round 27 (24 September): the eleven driver classes named

- `wur_integration_alert_drivers_class` now shows names, not Class 1 to 11.
  Pairing: GFW's map legend (Global Nature Watch, layer
  `drivers-of-deforestation-alert`) gives each name a colour; GFW's map code
  (wri/gfw, providers/datasets-provider/config.js, `alertDriversEncoded`)
  paints each number in one of those colours. Ten match exactly; class 3 is
  (244,177,131) in the code, (244,176,131) in the legend. Result: 1 Small-scale
  agriculture, 2 the same with fire, 3 Large-scale agriculture, 4 the same with
  fire, 5 Road development, 6 Selective logging, 7 Mining, 8 Flooding,
  9 Wildfire, 10 Other natural disturbances, 11 Unlabeled. 9 and 10 are the
  reverse of the legend's order.
- Each name's hover text is GFW's own card description (Flourish 25392464,
  embedded in GFW's blog post on the dataset). Colours stay the map's own.


## Round 26 (24 September): names, hologram, flat-map drag with 3D

- Place names box now hides the basemap's names too. Those are one picture
  layer ("labels"), which the box never reached, so close in nothing changed.
  The hologram's own names follow the same box.
- Hologram close in: 3D terrain's stone buildings (`buildings-3d`) stood over
  the wireframe and hid it. They are now hidden while the hologram is on (its
  own glass buildings stand in their place) and put back after.
- Hologram options all start ticked except Basemap underneath, which is now a
  box beside "Hologram view" rather than one of its options. Saved choices use
  a new key (`culprits-holo-2`) so the old defaults (names off) do not carry.
- The "Hologram view · Natural Earth 1:50m · grid 15°" line at the bottom of
  the map is gone.
- Flat map with 3D terrain on could not be dragged past its edges after
  coming from the globe. With terrain on, MapLibre 5.24 moves the camera
  through a saved copy (`map._requestedCameraState`) and keeps it across a
  projection change, so the globe's copy, without the free drag, stayed in
  charge. setView() and leaveEarth() now drop that copy. Checked in headless
  Chromium: globe + 3D -> flat, drag right went 0° -> -352° (was stuck at 0°).


## Where things stand (24 September, after round 25): read this first

Every request the owner has made up to round 25 is done and on main (round 25
is 249ad38). Nothing is half-built. What is left falls in three groups. The
fuller notes are in "Could not get, could not add, or needs the owner" near
the end of this file.

**Waiting on the owner (nothing to do until they say)**

- **EIA Environmental Crime Tracker.** The owner has asked EIA for the full
  dataset (EIA's report says it is "available on request"). Until it comes,
  the map shows the report as the row `powerbi_report`. When the data
  arrives, draw it as points.
- **Aquaculture pond clusters: the licence.** The layer is built and on the
  map (`aquaculture_ponds`, 79 of 79 cluster files). The data is Zenodo record
  5643036, "Global Landside Clustering of Aquaculture Ponds Distribution
  Acquired from Dense Time-Series Sentinel-2 Images by Google Earth Engine"
  (https://zenodo.org/records/5643036). Its paper (Wang et al. 2022, Int. J.
  Applied Earth Observation and Geoinformation 115, 103100,
  https://doi.org/10.1016/j.jag.2022.103100) is open under CC BY 4.0, but that
  covers the article. The paper's own data statement says "Data will be made
  available on request", and the Zenodo record gives no licence, so the data's
  terms are not stated. The owner has been given the two corresponding
  authors to ask: X. Yang (yangxm@lreis.ac.cn) and Y. Zhang
  (yuanzhizhang@cuhk.edu.hk). Keeping the row or hiding it until they answer
  is the owner's call; whatever they decide, keep the credit and the Zenodo
  link on the row.
- **Wageningen driver classes.** The "Drivers of deforestation alerts" layer
  (`wur_integration_alert_drivers_class`) shows Class 1 to 11 with no names:
  no public source pairs the numbers with names. Pages given to the owner to
  check: GFW's blog
  https://globalnaturewatch.org/blog/data-and-tools/drivers-deforestation-alerts/,
  the Wageningen paper
  https://research.wur.nl/en/publications/monitoring-direct-drivers-of-small-scale-tropical-forest-disturba/
  (https://www.sciencedirect.com/science/article/pii/S0034425723002067), Land &
  Carbon Lab
  https://landcarbonlab.org/data/land-disturbance-alert-classification-system/,
  Mongabay
  https://news.mongabay.com/2025/12/real-time-deforestation-alerts-get-an-ai-boost-to-identify-the-causes/
  (it names small-scale agriculture, large-scale agriculture, road
  construction, mining and wildfires, without numbers). Put the names in only
  from a source that gives number and name together.
- **Wastewater watershed shapes** (103 MB): not built until the owner says so.

**Worth a look on the live map**

- **JRC surface water and GLC_FCS30D land cover** (round 23): not tried in a
  browser. Their servers may refuse to be read from another site (CORS). If
  either row says it could not be read, host a copy: JRC's tiles through
  culprits-tiles-more or R2; GLC_FCS30D cut to web tiles on R2 (the world
  file is tens of GB, too big for GitHub).
- **Global Forest Watch layers made on request** (1996 mangroves, reservoir
  anomalies, PANGAEA mines, the water-stress test copy): GFW builds each
  square when asked, so they fill in slowly, slowest at the world view. If
  that is too slow, build the 1996 mangroves as our own tiles from Global
  Mangrove Watch v3 on Zenodo.
- **Round 25's news-wire changes** were tried in headless Chromium, not on the
  live site: several topics ticked at once, grouped under each subject, and the
  popup labels on one line.

**Known limits (nothing to do unless the owner asks)**

- Ten Atlas for the End of the World plates could not be pinned (Cape
  Floristic Region, East Melanesian Islands, Madagascar, Mountains of
  Southwest China, New Caledonia, New Zealand, Philippines, Southwest
  Australia, Succulent Karoo, Wallacea); they zoom to their outline instead.
- Three Nusantara layers keep their server's own titles: nobody could vouch
  for what they show.
- Three older GFW driver layers stay grey: GFW draws them itself, and two have
  no finished tiles.
- Trase's burned peatland and burned area have no values for any year; those
  rows leave the list when ticked.
- No worldwide map separates plantations, mining, transmigration and fish
  ponds as Indonesia's ministry map does (that map is under Destruction > Of
  the planet > Forest and land cover, "Forest cover 2020, Indonesia's own").
  GLC_FCS30D is the finest worldwide land cover (35 classes at 30 m).
- cifor_peatlands and gfwpro_peatlands were taken out: GFW has nothing
  drawable for either.
- USDA retired its soybean and corn explorers; those rows were removed.
- Waste Atlas figures are as the site last published them (about 2016).
- Workflow files (`.github/workflows`) have to be edited on github.com: the
  owner's Mac token cannot push them.
- The satellite basemap and index.html are also edited in another chat, so
  pull before every patch. Changes to the basemap from here are kept to the
  lowland colour stops.

**How work reaches main.** This sandbox cannot push to either repo. Each round
is one Python patch script (a checked git diff, plus the HANDOFF text put in
under the first "---"). The owner runs it from `~/Desktop/culprits` and runs
`node map/test.mjs` and `node map/wire.test.mjs`, then commits the named files
and pushes. Terminal steps have no `#` comments (the owner's shell is zsh).

## Round of 24 September (25): several topics at once; the news popup's labels

**Topics, as many as wanted** (map/wire.js). The Topic row is no longer a
menu: `topicRow` draws a button ("All", the one topic, or "N topics ticked")
that opens a list of tick boxes with each topic's count, under a heading per
subject when more than one ticked subject has topics, and a "Clear the topics"
button. Choices are kept per subject in `state.topics` ({subject id: [label,
...]}, saved with the rest; the old single `cross.topic` is dropped on load).
`withTopics` turns them into each subject's choice: an array of values, which
`matches` keeps when a story carries any of them; once any topic is ticked, a
subject with none ticked under it shows nothing, as the other filters do.
`optionsFor` still offers every topic while some are ticked. The fold line
leads with "Topic: a, b". The row and its list span both columns of the
filters grid, and the grid gives up its height cap while the list is open
(`.wire-facets.topics-open`). Tried in headless Chromium on the live Abortion
and Conflict wires: two headings, two topics ticked, stories from both kept.

**News popup labels** (map/app.js, `wirePopFilters`). The words Subject,
Source, Place, Date, Headline and Order were bare text beside their menus, and
index.html's `.wire-pop-sort > :first-child{flex:0 0 62px}` fixed the width of
the menu instead, so the words were squeezed to a letter a line. Each is now a
`<span class="wf-l">` held to one line at 64px, with the menu taking the rest
(`WIRE_POP_LABEL_CSS`, added once through `addStyle`; index.html untouched).

## Round of 24 September: search in the layers box; the unplaced rows filed

**Search.** `layerSearch(box)` (called at the end of `arrangePanel`) puts a box
above the list. `applyLayerSearch` keeps a row when every typed word begins a
word (`searchWords`, `searchMatches`: lower case, accents stripped) of its
title (`rowTitle`: the name without the LIVE mark, refresh note or i) or of the
headings, layer with sublayers or group it sits under (`rowContext`), so
"mining" shows all of Mining. Matching rows' headings and groups are opened;
their earlier open or shut state is kept in `data-search-was` and put back when
the box is cleared (Escape clears it). A MutationObserver re-runs the search
when catalogue rows arrive. Tried in headless Chromium on a mock box.

**Unplaced rows filed** (`CATALOGUE_BY_TITLE`, by id): Indonesia's forest area
into the spatial plans row; Argentina's native forest plan and FAO's management
objectives under a new Deforestation > Forest zoning and management plans;
Argentina's forest monitoring and INPE's PRODES under Loss year by year; GFW's
emerging hot spots and places to watch under Where clearing is likely; the AZE
sites and endemic bird areas under Places that matter most for species; the
forest landscape integrity index under Intact and primary forests; Honduras
forest type, JRC managed land, RSPO's 2010 land cover, SBTN natural forest, tree
cover gain and height, trees in mosaic and complex landscapes under Forest and
land cover; UMD tree cover 2000 into the forest cover row (now 2000, 2010 and
2020); LandMark resource rights under Land and territory; Cameroon's
agro-industrial zones under Agriculture > Plantations; GFW's copy of the power
plant database under Carbon dioxide; wind speed potential and Brazil's biomes
under Base and reference > Physical and human geography.

## Round of 23 September (23): the owner's thirty notes on the layers box

Everything below is in `map/app.js` unless named; tests under "round of 23
September (23)" in `map/test.mjs`. Global Forest Watch's catalogue was read
item by item through a fetch tool this time (the sandbox shell still cannot
reach it), so the rules below name real ids.

**Layers with sublayers (bundles).** New in the box: a `PANEL_ORDER` entry
`{ h, bundle: "<key>" }` whose title is `BUNDLES[key]`. It is built as a
heading (`arrangePanel`'s `heading(h, t, item)`: it folds, it has a tick,
catalogue rows are filed into it by path) but drawn as a row: tick first, a
swatch, its own title (not title-cased), a count, the arrow at the end
(`.toc-bundle`, `.bundle-h`). Its tick also turns on catalogue rows
(`[data-cat]`), which a heading's tick still does not; `syncHeadingBoxes`
reads them for bundles, and `catalogueRows` calls it when rows arrive. A
catalogue row goes in with `IN(path, key)`. Six: mines (item 14), Clark Labs
ponds (4, 6), Global Mangrove Watch (8, 10), Global Water Watch (20), forest
cover (28), spatial plans (25).

**Sub-sub-headings (item 27).** `CATALOGUE_SUBS` sends a row filed under
Deforestation, Tree cover loss and alerts, Biodiversity loss, Agriculture,
Palm oil, Soy corn and grain, Cocoa and cotton or Meat into a sub-heading by
its words; each list ends in a catch-all, so nothing sits between a heading
and its sub-headings. `catalogueRefine` applies it to both the rules and the
by-name placements. `sectionBody` now prefers a heading directly under the
current one, since Agriculture's Plantations and Palm oil's Plantations share
a name. `.panel-h6` added. Zero-deforestation-commitment rows have their own
heading (they had all gone under Wood pulp, Indonesia, and under clearing).
Trase's herd and slaughter measures go under Meat > Cattle and pasture / Pigs
and chickens rather than Facilities.

**Taken out by name** (`CATALOGUE_BY_TITLE`, top): Trase's shrimp production;
Clark Labs' 1999-2014 and 2014-2018 change maps; Nusantara's Equatorial Asia
peatland; `cifor_peatlands` (its one tile set failed to build) and
`gfwpro_peatlands` (tile sets, no cache or GeoTIFF); Borneo land cover with
hillshade and rivers; both Rawa Singkil canal layers; Mapbox river basins;
Mexico land rights; Nusantara's worldwide water change and GFW's copy of the
JRC surface water map (both replaced by `jrc_water`); and the sixteen land and
forest cover layers of item 29.

**Oil and gas drilling retired (items 1, 2).** The oil-and-gas rule files under
Climate > Infrastructure emitting more than one gas, and no longer matches
"greenhouse gas" (which had put the forest net flux under drilling). The
fracking row and a Pennsylvania heading (h5) with its four rows are there.

**Titles.** `GFW_TITLES`: the three Clark Labs maps GFW all titles "(1999)"
are 1999, 2014 and 2018 (ids, files and band statistics differ; the owner
chose to keep all three plus the 1999-2018 change); mangroves by year; the two
Global Water Watch layers by what they hold (`global_water_watch_anomalies`:
a column per month of 2025, newest of 14 releases; `..._anomalies2`: one
reading per reservoir, one release); the forest cover maps; the water-stress
test copy. A title that says "worldwide" no longer gets " - Global" added.
Coral: "Coral reefs, warm-water only (Allen Coral Atlas and UNEP-WCMC)".
"Who Owns the" is "Who Owns the Food Industry".

**Things that did not draw.**
- GFW dynamic vector caches (1996 mangroves, water stress test copy, the
  reservoir anomalies, PANGAEA mines): the row waited for the world tile to
  read layer names, which on a dynamic cache is built from the database and can
  take minutes. Dynamic caches no longer wait; static ones wait at most 8 s.
- Aqueduct crop baseline: GFW marks no version latest, and `gfwAssetIndex`
  sorted versions as text, so v1.9 beat v1.12. `versionOrder` sorts by number.
- JPL mangrove biomass and UMD tree cover density 2010 are GeoTIFFs of numbers
  drawn grey and black; both have `GFW_KEYS` ranges now (zero left out).
- Trase peat rows: Trase's catalogue lists years its values do not hold
  (peatland area listed to 2024, published 2015-2023; burned peatland listed,
  published for no year). `traseYearWithValues` draws the latest year with
  values and says so on the row; a measure with values in no year anywhere
  leaves the list.
- Mine features at the world view: glow at full strength (`GLOW_FULL`), their
  box names their own source (`cfg.featureWord`, `cfg.attribution` in
  `addPmShapesLayer`). The build dropped most points at low zoom (tippecanoe's
  polygon-to-point conversion came after its tiny-polygon folding: 14,169 of
  74,548 in the world tile). culprits-tiles-more `scripts/mine_features.py` now
  writes its own points and stops if the world tile does not hold them all;
  it rebuilds once (`points_at_world_view`).
- Coral reefs outside the Caribbean: the world picture is pale bone and each
  reef pixel grown a pixel or two (`tint://RRGGBB+grow`, `growPixels`, the
  same growth `seen://` uses).

**New rows** (in `OTHER_MAPS`):
- `jrc_water` (item 23): the EC JRC's Global Surface Water 1984-2024 from the
  JRC's own tiles (`storage.googleapis.com/water-world/tiles2024/<layer>`), six
  chips, redrawn in the map's colours by `remap://` (`REMAP`: nearest class or
  point along a ramp). Whether that bucket sends CORS headers could not be
  checked from here; glad_loss reads a Google bucket the same way.
- `glc_fcs30d` (item 30): GLC_FCS30D, 30 m, 35 classes, 2000-2022, read square
  by square from OpenLandMap's Cloud Optimised GeoTIFFs by `cog4326://`
  (geotiff.js from jsDelivr, loaded on first use; `cogLevel` picks the
  overview; each pixel placed on the web mercator grid). OpenLandMap's CORS is
  unverified; the row says so if the file cannot be read.
- `osm_landuse` (item 30): OpenStreetMap land use and farmland by kind from
  OpenFreeMap (`addOsmLanduseLayer`, route `osmlanduse`).
- `aquaculture_ponds` (item 5): LCAP, Zenodo 5643036, built by the new
  culprits-tiles-more `scripts/aquaculture_ponds.py` (by hand, or the daily
  run); the row says "not built yet" until the archive exists.
## Atlas plates: the drawn hotspot only counts when it is its outline's size (24 September, later)

The first run with `place_by_outline` placed New Caledonia and Southwest
Australia although their drawn hotspots were 0.96 x 0.60 and 0.92 x 0.89 of
their outlines' size: the edge error was judged against the whole plate's
width, which is far larger than a small hotspot. Its checks on the town
placements showed when it can be trusted: where the drawn box matched the
outline box within 1.3% both ways (Caucasus, Madrean woodlands, Maputaland,
Central Asia, Southwest China) it put the page's middle 17 to 73 km from the
towns' placement; elsewhere the hotspot runs off the picture or is painted
over by protected areas (the Succulent Karoo's Namibian strip is under
protected-area green) and the distances ran to 1,098 km. So a placement or a
check by the drawn hotspot now needs both ratios within `OUTLINE_SIZE_TOLERANCE`
(3%). Of the pages with no two towns, only the Cape (1.005 x 0.994) passes.

## Atlas plates: country names by their type size; the drawn hotspot as a last way (24 September)

The lookup file showed why no country was ever set aside: Nominatim's
settlement search never answers with a country. For "Kenya" it gives villages
called Kenya in Kenya, for "Malawi" a village in Malawi, for "Philippines" a
town on Mindanao, and these can lie near where the country's name is printed,
so they counted as agreeing (Madagascar had been placed by Antananarivo, Kenya
and Malawi). The Atlas sets country names in 10-point type and towns in 7.5 or
5.5 point, so `label_candidates` now skips text of `COUNTRY_LABEL_SIZE` (9) or
more; `country_labels` lists what was skipped as `set_aside_as_countries`. The
rank rule (`COUNTRY_RANK`) is gone. The maps are one embedded picture per page
(`--show` lists them). `place_by_outline` finds the colour of the key's
"<name> Hotspot" swatch in that picture (`key_colour`, `drawn_hotspot_box`),
takes the box of those pixels, and lays it on the hotspot's outline box at the
scale bar's scale; kept when the two boxes' edges differ by no more than 3% of
the plate's width. It is used only where towns cannot place a page, and for
every plate that towns did place it prints how far the drawn hotspot would put
the middle (`outline_check_km`), a check on both ways. Tested on a made-up
page, not yet on the Atlas's own pictures, whose hotspot fill may be shaded
over by protected areas or see-through; `outline_fit` records the pixel count
and the width and height ratios so a bad match shows.

## No outside storage: oversized archives cut by zoom; every row's pieces kept (24 September)

The 24 September refresh built every source and then died uploading the
registered-facilities archive (101 MB) to R2, whose secrets are not set. The
owner chose no second account and no data lost. `build_tiles.sh` now calls
`pipeline/split_archive.py` on an archive over 100 MB: the mines' cut, by zoom
into `<id>.pmtiles`, `<id>_2.pmtiles`..., each under 95 MB, a single zoom too
big cut down a line of longitude, every tile counted before anything is kept,
and `<id>.build.json` listing the parts. `addPmtilesLayer` reads that list
(`pmShapeParts`) and gives each further file its own source and its own copies
of the -agg and -pt layers at that file's zooms only. `.needs-r2` is no longer
written, so the R2 step never runs. `PIECES_LIMIT` is 400 MB: the development
projects' 401,100 whole rows (119 MB) are kept. Tested on a made-up archive
cut into 13 files with all 17,635 tiles kept; the real 101 MB archive will cut
into two.

## Atlas plates: one scale and one turn, checked against the page's scale bar (23 September, latest)

Measured on the kept plates: the straight-line (affine) fit could skew and
mirror a page, and six kept plates were skewed 20 to 60 degrees or mirrored
(California, the Chilean forests, the East African coastal forests, the
Himalaya, the Philippines, the Caribbean). The fit is now a similarity in web
mercator (`fit_similarity`: one scale, one turn under `MAX_TURN`, a shift;
page y runs down). The Atlas's pages are web mercator and their scale bars are
true at the equator (Auckland to Christchurch 2.5% off, Cape Town to Port
Elizabeth under 1%, read as mercator metres; 25% and 35% off read as ground
distance), so `read_scale_bar` gives mercator metres per point and a fit more
than `SCALE_TOLERANCE` (20%) from it is not kept (`scale_vs_bar`). Where too
few names agree, `place_by_bar` takes the bar's scale, north up, and the shift
from at least two agreeing towns (`placed_by` says which). Each label is tried
at its middle and at each side (`label_boxes`, `near`), since one page sets
some labels left of their dots and some right. plates2's rank rule is undone:
it set aside Manila, Cebu and Chengdu, which come back as boundaries; only
countries (rank 4 or less, or address type country) are set aside now
(`set_aside_as_countries`). The cache keeps every raw answer with its rank and
type (`|v3` keys), so a change of rule needs no new requests. Rebuilt from the
real pages' text positions: New Zealand (Auckland, Christchurch, 83 km on
7,024 km), the Succulent Karoo (3 towns, 17 km) and Wallacea (Makassar, Palu,
18 km; the Brunei and Philippines labels land on those countries) place by
the bar; the Cape, Southwest Australia and Madagascar have one town each, and
East Melanesia and New Caledonia none, so they stay unplaced. `--show` also
lists the pictures on a page: the maps did not show up as drawn shapes, so they are most likely one picture; the next run will say.

## Catalogue rows refiled and taken out by name (23 September, round 20)

In `CATALOGUE_BY_TITLE` (`map/app.js`), at the owner's word. Taken out:
MapSPAM's rubber yield (no tiles published); Nusantara's `roadsegmentbuffer_spv`
and its v3p3 copy, `base_ikn`, `base_road`, `base_road_edited`, `base_roadRGB`,
`base_roadtrans`, `IDNMYSBorneo_Settlement_2017_GHS`,
`IDNMYSBorneo_Transmigration_2021` and its `_wms` twin; the Congo Basin forest
roads; INCRA's rural settlements in Brazil (its quilombola communities stay, under
Land and territory: round 21 narrowed a rule that had caught them). Placed: Liberia's mineral
exploration and development licences and its Mineral Development Agreements
under Mining; the resource rights (Cameroon, Equatorial Guinea, Liberia,
Namibia) under Land and territory (round 22); logging roads under
Deforestation only (no longer also Construction); the all-ecosystem
disturbance alerts (DIST-ALERT) copied under Fire and Mining as well. In
`CATALOGUE_PLACES`, rubber goes under Deforestation (the Destruction page
names rubber among the deforestation-risk commodities under "The Biggest
Deforesters"), and the heading "Other" under Of the planet is now "Other
concessions": concessions and permits that name no material or activity a
heading covers. The Global Forest Watch rules match words, not ids, because
their titles could not be read from the sandbox (the data API refused it); run
`node map/filing-report.mjs rubber liberia licen road settlement disturbance`
to see what each rule caught.

## Atlas plates: country names set aside (23 September, later)

The first run with look-ups inside each box placed four plates with 4 names,
and every one leaned on a country: Madagascar (Madagascar, Malawi, Zambia),
Wallacea (Brunei, Philippines), Mountains of Southwest China (Myanmar), and
Philippines had "Philippines" among its 13. Nominatim's settlement type lets
countries and states through. `geocode` now keeps only answers with
`place_rank` of at least `MIN_TOWN_RANK` (13: towns and cities, not counties,
states or countries); a name whose answers were all regions is listed on the
plate as `set_aside_as_regions`. The cache key gained `|towns`, so every name
is asked again once.

## Atlas hotspot plates: look-ups kept inside each hotspot (23 September, latest)

`pipeline/atlas_plates.py` now reads each hotspot's outline box from the same
ArcGIS item the map draws (`HOTSPOT_ITEM`, Conservation International's
Biodiversity Hotspots 2016.1; cached in `pipeline/.atlas-cache/hotspot_boxes.json`)
and asks Nominatim only inside that box, widened by `BOX_MARGIN` (a quarter
of its size, at least a degree). The Philippines plate had been pulled to
9,051 km by a town called China elsewhere. Boxes across the 180th meridian
(New Zealand, with the Chatham Islands) keep longitudes running past 180, are
asked for in two halves, and give corners past 180, which MapLibre draws in the
neighbouring world copy; `on_earth` allows that. A plate is also kept with 4
agreeing names when the error is under 1.5% (`MIN_AGREE_SMALL`,
`MAX_ERROR_SHARE_SMALL`; set the first to 5 to switch off). Each entry records
`looked_up_within`. `--show <slugs>` places nothing and writes
`pipeline/.atlas-cache/<slug>.page.txt`: every piece of text (kept or dropped,
and why) and the 25 largest shapes, for the next step on pages with too few
names (Cape, Southwest Australia, New Caledonia): the Atlas labels only cities
of 300,000 or more, so those pages will never have 5 names, and fitting the
hotspot outline drawn on the page is the lead. Look-ups made before this are
cached under the bare name and not reused; the new ones are keyed by name and
box. Tested offline on made-up ArcGIS and Nominatim answers and a made-up
page; not yet run against the real services.

## 3D buildings: the layer was never added (23 September, latest)

Found running the real page in headless Chromium: MapLibre refused
`buildings-3d` ("zoom expression may only be used as input to a top-level
step or interpolate") because `fill-extrusion-base` put ["zoom"] inside a
"case". The whole layer failed, so no building ever stood up with 3D terrain
on. The base is now an interpolate, like the height.

## Climate TRACE by gas (23 September, built; not yet run)

`pipeline/sources/climate_trace.py` reads the gas from `CT_GAS` (default
`co2e_100yr`), with the unit to match. `culprits-tiles-more/scripts/ct_gases.py`
clones the culprits pipeline, runs the harvest for co2, ch4 and n2o in turn
(own ETag state per gas in `climate_gases/`), normalises as
`climate_trace_<gas>`, and splits by **subsector** with `split_sectors.sh`
(`PREFIX=climate_trace_<gas>`) into `tiles/climate_trace_<gas>_<subsector>.pmtiles`;
an archive over 99 MB is not copied and is named in the log. It writes
`tiles/climate_trace_gases.json`. In the map, `ct_gases` (route `ctgases`,
hidden like the other catalogues) reads that list and makes one catalogue row
per gas and subsector (`ctGasRows`), each drawing its own archive through
`ctChild`, filed by the gas in its title. Run: `ct_gases` in the tiles-more
workflow box; three gases' packages, so hours. `normalize.py`'s PIECES_SKIP
matches `climate_trace_*` too.

## The Satellite sea drawn from depth tiles (23 September)

Why none of the Satellite rounds changed the sea on the live map: Mapterhorn
(outline-dem) is built from Copernicus GLO-30, land only, so the sea is 0 m
and the colour relief's navy deeps and shelves, and the calm-sea layer, never
drew; the owner saw Esri's own teal (#004658 measured). The sandbox previews
used ETOPO with depths, which hid this. Now `sea-dem` (TERRAIN_SOURCE, the
AWS/Mapzen terrarium tiles, which carry bathymetry) feeds `sat-relief-seabed`
(`SAT_RELIEF.seabed`, paleo's sea stops, clear from 0 m up) and
`sat-relief-sea`. Checked on the real page in headless Chromium with
land-only heights for Mapterhorn: before, the Atlantic was Esri-blue; after,
#0E1D34.

## The Satellite basemap back to patch paleo, held at every zoom (23 September)

At the owner's request, the even, ridge and jungle rounds are undone and patch
paleo's look (57d04a9) is back, with one change: nothing eases off with zoom.
`SAT_RELIEF.colourOpacity` 1, shade exaggeration 1 and depth 0.6 (paleo's
world-view values) at every zoom; the close-in multiply stays off
(`SAT_TINT.close` all 1); `sat-relief-ridge`/`ridge2` removed. Grade, palette,
sea stops, calm-sea layer and light colours are paleo's own.

## The Satellite basemap: darker jungle green, no grey (23 September)

On top of patch_0923_ridge. The owner found the world view bland beside the
End-Cretaceous plate (darker jungle greens, less or no grey, a little more
saturated). Grade: max 0.9, saturation +0.3, contrast +0.16. Lowland tint
#0E2A0A at 0.3 (a heavier green sheet greyed the deserts), high stops warm
brown in place of grey, every pale light a sage off-white (222,228,200; ridge
214,222,190). Preview (Blue Marble stand-in): Amazon median #223F11 against
the plate's jungle #2C4416; Sahara stays tan.

## The Satellite basemap: pronounced relief at world scale (23 September)

On top of patch_0923_even. The owner found the world view flat next to the
plates, whose relief is pronounced on purpose. Two new hillshades,
`sat-relief-ridge` and `sat-relief-ridge2` (same paint, `SAT_RELIEF.ridge`:
standard method, NW light at 30 degrees, shadow alpha 1 and pale light 0.34 at
zoom 3 easing to 0 by zoom 7, maxzoom 7), drawn twice because one hillshade
tops out at exaggeration 1. They sit directly on the imagery, under
`sat-relief-colour`: the see-through land palette lets the ranges show, and
the near-solid deep-sea navy hides them so the ocean floor stays calm. From
zoom 7 in the look is unchanged. Tried in preview: `combined` and `igor`
methods (weaker at world view than doubled `standard`).

## The Satellite basemap, the same at every zoom; the plates' blues (23 September)

On top of the paleo-map patch (57d04a9). The owner saw the look hand over to
plain imagery closer in and wants the same effects at all zooms: the tint's
opacity is a constant 1, the shade exaggeration 0.9 and the depth light 0.3
at every zoom, and the close-in multiply is off (`SAT_TINT.close` all 1,
`atlasWashPasses` returns nothing). The sea stops take the plates' sampled
colours: deeps about #0A112C-#121E3C at 0.86-0.92, shelves darker teal at
0.7-0.8, so the imagery's pale cyan shelves no longer come through as much.
Imagery saturation -0.06 (was +0.12). Still changing with zoom and not ours:
Esri's own photograph, which is a different picture at different zooms.

## The Satellite basemap after the paleo-map plates (23 September)

The owner sent five plates (a landforms illustration and four paleogeography
maps: Campanian North America, East Gondwana, Jurassic Europe, the
End-Cretaceous world) and asked for that look: Swiss-style shaded relief,
earth-tone terrain palette, realistic hypsometry, a slightly darker
prehistoric green, sunlit (not overcast), and close in no flat glossy sheet
over trees, rock and water. Replaces patch n's opaque forest-green relief.
- Imagery grade `BASE_GRADE.satellite`: max 0.92, min 0.02, saturation +0.12,
  contrast +0.06, so the photograph's forests, deserts and ice show.
- `sat-relief-colour`: see-through rgba palette (land alpha 0.24-0.32):
  green lowlands, olive, khaki, ochre-brown, sienna, grey-brown rock, no
  white; navy deeps, lighter blue-green shelves. Opacity 1 wide to 0.4 at z17.
- `sat-relief-sea` (new): a second color-relief drawn above the hillshades,
  navy over the deep sea only (clear from -80 m up), so the ocean floor is
  calm as on the plates.
- `sat-relief-shade`: multidirectional [315, 270, 0, 225], olive-black
  shadows (0.78 main), lights at most 0.1 (stronger lights read as sheen).
  `sat-relief-depth`: one NW light at the widest views, gone by zoom 7.
- `SAT_TINT`: close-in multiply [0.84, 0.94, 0.82], ramping in over zoom
  9-13 through `atlasWashPasses` (satellite only). A multiply keeps each
  pixel's texture, where the see-through tint flattened it.
Previewed in headless Chromium on ETOPO 10' with NASA Blue Marble (three.js
example texture) standing in for Esri's imagery; tilted 3D could not render
in the sandbox's software GPU in time.

## Patch n's look again, exactly, on Esri (23 September)

The owner asked for patch 0922n to work as it did. The old patch no longer
applies, so its values are set on today's code: SAT_RELIEF colour, colour
opacity and shade exactly as n had them, the depth light off, n's imagery
grade (max 0.82, saturation -0.1, contrast 0.1). The Satellite basemap draws
Esri's imagery at every zoom (SAT_CLOSE.s2 false), which is what n was made
on. Kept: Mapterhorn heights, the 3D lift, fog only at the horizon. Replaces
the plates look (12e356f, 5da7242, 7b7a332).

## The Satellite basemap after the owner's plates (23 September, latest)

Replaces patch p (7710435), which the owner found cartoonish and over-tinted.
Aimed at the owner's reference plates (shaded-relief maps of ancient
continents): land is the photograph's own colour with no tint by height
(`SAT_RELIEF.colour` is clear from 60 m below sea level up; deserts and dry
land stay as photographed, the owner's choice); deeper water only is darkened
toward navy (alpha 0.22 at -200 m to 0.62 at -8,000 m), so the photograph's
light shallows show against it; `colourOpacity` 1. Shading strong and matte:
shadows up to 0.75, pale grey-white lights up to 0.3 (the plates have them),
exaggeration 1 at zoom 2 to 0.45 at 16; the depth light 0.6 at 2, gone by 8.
Imagery max 1, saturation +0.15, contrast 0.08. The close-in multiply and the
drawn water layers (sat-water, sat-waterway) are gone; `atlasWashPasses`
returns nothing on Satellite. `OSM_SOURCE` stays for the outline map. Known
limit: land lower than 60 m below sea level (Dead Sea shores) takes some navy.
The owner's first picture (the labelled landforms illustration) is a made-up
illustration and cannot be reproduced from real imagery.

## The Satellite basemap as patch n, with the owner's edits (23 September, later)

Replaces o's look with edits (8a1e93a). `SAT_RELIEF.colour` is n's opaque
stops, each a little lighter and greener (sunlit, not overcast), the top
stops warmer (they read slate-grey). Edits: shadows at most 0.7 (grain);
lights faint and warm, at most 0.1 (sheen); main shading 1 at zoom 2 to 0.75
at 12 and 0.5 at 16 (rounded forms past the end of the heights); the depth
light a broad low light for wide views only, 0.5 at 2, gone by 8; tint opacity
0.9 at 2, 0.78 at 8, 0.6 at 11, 0.42 from 14 (never lower).
Close in the plastic look was the tint laid over the photograph as a
see-through sheet, which flattens its texture by the same share. So from zoom
10 to 14 the theme also comes from a multiply (`SAT_RELIEF.closeMultiply`,
[0.86, 0.93, 0.86], drawn by `atlasWashPasses` on Satellite), which keeps the
texture, and imagery contrast rises from 0.04 at 10 to 0.2 at 14
(`BASE_GRADE.satellite`, max 0.92, saturation 0). Water close in:
`sat-water` (OpenStreetMap water shapes, fill) and `sat-waterway` (river and
canal lines), #2B5E6C, from zoom 8, opacity up to 0.4, source `osm`
(`OSM_SOURCE`, shared with the outline map). Tilted distance: fog colour
rgba(52,74,92,0.25) (was grey at 0.6), horizon-fog-blend 0.1, horizon
#3E5566; fog-ground-blend stays 0.97. Kept: Esri at every zoom
(`SAT_CLOSE.s2` false), Mapterhorn heights, the zoom-scaled 3D lift, thin
atmosphere, no grain, grey labels. Painted atlas and Country outlines
unchanged. Checked in headless Chromium with the tile hosts blocked: on
Satellite `base`, the three relief layers and the two water layers show,
under `atlas-washes` and `labels`; back on the atlas they hide. Not seen
rendered with the real imagery or heights.
Limit: the map can only tint, shade and multiply what the photograph holds.
Tree crowns, rock texture and their shadows show close in only where Esri's
photograph has them; rapids, foam and waterfalls cannot be drawn from the
data here.

## Satellite back on Esri's imagery at every zoom (23 September)

The owner's chosen look (patch o's, with edits) was made on Esri's imagery;
since 5295b36 the Satellite basemap drew Sentinel-2 cloudless 2024 out to
zoom 12.5, which is darker, more saturated and orange in the deserts, so the
look came out different. `SAT_CLOSE.s2` is now false: the Satellite basemap
draws the `base` layer (Esri) at every zoom, graded by BASE_GRADE.satellite;
`base-s2` and `base-close` stay in the style, hidden. Esri's change of season
around zoom 12 is back. Set s2 to true to restore the Sentinel-2 wide views.

## The Satellite basemap as patch o, with the owner's edits (23 September)

Replaces patch n's look (af60123), which the owner found entirely different
from what they wanted. `SAT_RELIEF.colour` is patch o's, unchanged. Edits,
each for a complaint the owner made about o: the depth light lighter and gone
by zoom 11 (grain, rounded slopes); main shadows at most 0.8 (grain); warm
lights at most 0.12 (sheen); colour opacity 0.85 at zoom 2, 1 at 8, 0.95 at 12,
0.85 at 16 (o thinned to 0.55 at 14, which read as the plain photograph);
main shading 1 to 0.6 at 15; imagery max 0.95, saturation +0.12, contrast
0.12 (overcast, grain). Kept: Mapterhorn heights, the zoom-scaled 3D lift,
fog only at the horizon, thin atmosphere, no grain.

## The Satellite basemap back to patch n's look (23 September)

At the owner's request, patch 0922n's look (never applied; it no longer fit
the code) put onto the current code: `SAT_RELIEF.colour` opaque dark forest
green land (#27411F), olive then brown on high slopes, grey rock never white
(#827B71 at 5,500 m), slate-navy seas (#0C1724) with lighter shelves
(#244856); colour opacity 0.92 wide, 0.78 at zoom 8, 0.5 at 13; multidirectional
shading at full exaggeration with green-black shadows up to 0.9; imagery max
0.82, saturation -0.1, contrast 0.1. Replaces the fifth version (3ca3e57,
o's look with matte mountains). Kept from later rounds: Mapterhorn heights,
the zoom-scaled 3D lift, fog only at the horizon, thin atmosphere. The depth
layer stays in place with exaggeration 0 (n had no second light).

## What this is

`WelcomeToYourGalaxy/culprits` — a MapLibre map merging datasets on who is
driving environmental destruction. It replaces 55 third-party iframes that were
embedded in section (e) of my Destruction page.

Live at `welcometoyourgalaxy.github.io/culprits`.

Non-commercial civic education. Everything runs on free tiers: GitHub Actions +
Pages, Cloudflare Workers.

---

## Tang & Werner as a row; Forest and land cover back (22 September, after the refile)

`mine_features`, under Mining beside the mines, drawn by `pmshapes` from
`tiles/mine_features.pmtiles`: the owner chose to add it knowing the release
carries no commodity or impact field; the note says so. The Forest and land
cover heading and its catalogue rows are back where they were; the owner will
decide later. `LEFT_OUT` and its counting stay in the code, unused.

## My setup, so you know what I am typing into

macOS 12.6, Intel. zsh. **zsh does not treat `#` as a comment in an interactive
shell** — do not put trailing `# explanatory comments` on commands you give me,
they get read as filenames and produce confusing errors.

Two folders on the Desktop:

    ~/Desktop/culprits          the git clone — work here, this is what pushes
    ~/Desktop/culprits-local    the older unzipped-download folder, kept as backup

`culprits` was cloned fresh partway through the last session, because the
original folder was an unzipped download with no `.git` and nothing could be
pushed from it. If `git status` says "not a git repository", I am in the wrong
folder.

Python work needs the venv, which lives in the clone:

    cd ~/Desktop/culprits
    source .venv/bin/activate
    # if that fails:
    #   python3 -m venv .venv && source .venv/bin/activate
    #   pip install requests openpyxl

Node came from nodejs.org, not Homebrew — `brew install node` started building
LLVM from source and would have taken hours. Python is 3.9 locally, 3.12 in CI.

**Big files live on an external drive.** `data/` is a symlink:

    data -> /Volumes/<DRIVE>/culprits-data

and harvests need a temp dir there too, because each Climate TRACE sector zip is
up to 1.4 GB and would otherwise land on the system disk:

    export TMPDIR=/Volumes/<DRIVE>/culprits-tmp

That is per-terminal — set it before every harvest, or put it in `~/.zshrc`. The
repo itself stays on the Desktop; only `data/` was moved.

**`.venv/` is currently inside the repo and not gitignored.** Hundreds of MB.
Add `.venv/`, `.DS_Store` and `worker/.wrangler/` to `.gitignore` before the
next commit — `wrangler-account.json` is local Cloudflare state and this is a
public repo.

**Watch out when I download files from chat.** Both test files are named
`test.mjs`, and three times last session a download landed on the wrong one —
map tests ended up in `worker/` and vice versa. Symptom is `Cannot find module
.../map/index.js` or `.../worker/app.js`. Verify with `head -2 worker/test.mjs`
("Worker tests") and `head -2 map/test.mjs` ("Map logic tests"). Give me files
one at a time.

---

## Two separate deploys, easy to confuse

- `map/` is served from **GitHub Pages** — `git push` publishes it.
- `worker/` runs on **Cloudflare** — `cd worker && npx wrangler deploy`.

Pushing does not deploy the Worker. Deploying does not update the map. Several
"fixes that didn't work" were one without the other.

Worker: `https://culprits-proxy.welcometoyourgalaxy.workers.dev`

---

## Layers are built three at a time

Ticking a heading turns on everything under it, which can be thirty layers.
Fired together they open thirty archives and live services in one breath: the
browser queues most of them anyway, the map stalls while they arrive, and the
slowest source holds up every other. `queueBuild` in `ensureLayer` runs three
at a time and the rest say what they are waiting behind, so a layer that has
not drawn yet does not read as one that failed. Nothing changed about the
opening view: every layer still starts unticked, so a first load fetches the
basemap, the boundaries and nothing else.

A menu inside a row - Nusantara's layer list, the Global Forest Watch
catalogue - turns its row on when something in it is ticked (`showRowFor`). Its
ticks used to do nothing until the row itself was ticked, which reads as a
broken menu.

---

## Two things that broke, and why

**The two modelled meat rows.** The load handler dispatches by route with a
chain of `else if`s and everything it does not recognise falls through to the
archive builder, which asks for `map/tiles/<id>.pmtiles`. Splitting the abattoir
atlas's parts into rows gave them routes `cafo` and `glw`, which only
`ensureLayer` knew, so at load both asked for archives that never existed and
failed. Both dispatches now name them, and both rows are lazy.

**The reefs close in.** `${id}-raster`, the Atlas's own picture, carried
`maxzoom: cfg.drawFrom` - which is 12, the same as its `minzoom` - so it drew
at no zoom at all. From 12 in there was nothing but the Atlas's vector shapes,
and when those do not arrive the reefs vanished as you zoomed toward them. Both
pictures now run to the top: UNEP-WCMC's under everything, the Atlas's from 12
under its own shapes.

---

## Areas at the world view

A sitemap layer's areas get an edge as well as a fill, and a point at each
area's middle below zoom 7 (`areasFrom` to change it). PalmWatch's mill
concessions are tens of hectares, which is a fraction of a pixel at the world
view: the fill drew nothing and the layer read as broken. Nothing is added -
the edge is the area's own boundary, the point sits inside it, and both carry
that area's own record, so a click says the same wherever it lands.

---

## Two sources that need work, written down so they are not lost

**The Global Wastewater Model (Tuholske et al. 2021).** Its row reads copies in
culprits-tiles-more built by `scripts/wastewater.py` from
`mazu.nceas.ucsb.edu/wastewater`, and that server no longer answers, so the
archives were never built and the row draws nothing. The data itself is alive:
the paper's final rasters are on the Knowledge Network for Biocomplexity at
doi:10.5063/F76B09, with the code at OHI-Science/GlobalWasteWater. Rebuilding
means fetching those GeoTIFFs and tiling them rather than copying someone
else's picture squares.

**Carbon Mapper — done, but unconfirmed in a browser.** `route:"carbonmapper"`
reads `api.carbonmapper.org/api/v1/catalog/plumes/annotated`, ten pages of a
thousand, newest first, and says how many of `total_count` it is holding. Each
plume is a point sized by `emission_auto`; from zoom 10 the plume's own picture
(`plume_png`) is laid on the map at `plume_bounds`, forty at a time, only where
they are on screen. Built from the shape Carbon Mapper document in their
product guide, not from a live call: this sandbox cannot reach their API, so
the first real test is a browser. If the fields come back named differently the
row will say the platform did not answer, or draw points with thin boxes, and
the mapping in `addCarbonMapperLayer` is the place to fix it.

---

## A group owns its children

Gathering a group's children by reference from LAYERS was tried and was wrong:
each child was rendered twice, once where it was defined and once inside the
group, and the copy nobody had placed fell into "Not yet placed" at the foot of
the box. A group's children are defined inside the group and nowhere else. They
are lazy, so they build on the first tick, which is how every other group's
children already worked.

Group rows carry one control, the arrow at the end that every row now has. The
triangle that used to sit before the title is gone; `toggleGroup` still updates
one if a row has it.

---

## Heading ticks

Every heading and sub-heading carries a tick at the end of its line. It turns
on every layer under it, sub-headings included, and unticking it turns them all
off again and clears any group boxes inside it. `syncHeadingBoxes` keeps it
reading all, none or part-way from the layers themselves. Opening a heading and
turning its layers on are separate actions, so opening one loads nothing.

They were taken out once and put back: a heading with thirty layers under it
does load thirty layers, which is what the build queue below is for.

---

## The abattoir atlas's three rows

The abattoir atlas's three parts are three rows under Meat rather than chip
buttons inside one row: the registered facilities, Climate TRACE's modelled
confined animal feeding operations (`route:"cafo"`), and FAO's modelled
livestock density grid (`route:"glw"`). They answer different questions, and a
reader ticking slaughterhouses should not get a model's estimate with it.

---

## What the alert rows actually are

The three live-alert rows are Global Forest Watch products, served by GFW's own
tile service: integrated deforestation alerts for the tropics (GLAD-L, GLAD-S2
and RADD) and DIST-ALERT, the UMD and NASA vegetation-disturbance product that
covers the whole world, over 30 days and over a year. Global Nature Watch is
the WRI platform Global Forest Watch now sits inside, not the maker of any of
them, so the row that holds the three names the service and each line names the
system. They sit in a group whose children are the same objects as in LAYERS -
gathered by `rowsById`, not copied - so nothing about how they load changed.
Whether the same products also appear in the `gfw_catalogue` row's dataset list
is unchecked: that list comes from GFW's data API and was not readable from
here.

---

## The layers box, as it is asked to read

Headings carry the meaning, so they are changed rather than worked around:
Oceans holds Fishing (both fishing layers, whose titles say how they differ)
and Oil slicks, which holds Marine slicks (Cerulean's three rows and SkyTruth's
vessels of concern) and Terrestrial slicks (the SkyTruth Monitor row).
Biodiversity loss leads with the Global Safety Net and holds the reefs.
Agriculture is Meat and agriculture, holding Agriculture (the national shading)
and Meat (the slaughterhouse rows).

Every row has one fold control at its end, ticked or not, groups included: on a
group's parent row it works the disclosure triangle, so the arrow means the
same thing wherever it appears.

The Satellite view was toned down: no scan line sweeping the screen, halos held
steady instead of pulsing, the protected areas lifted once rather than
breathing, finer corner brackets, a quieter click ring. Its timer now only
notices rows being ticked.

---

## The slick archive reads tiles, not a 58 MB file

A busy month of Cerulean slicks is 58 MB of GeoJSON. Fetching it whole took a
minute when it worked at all, which is what "could not be read" was.
`scripts/cerulean_archive.py` in culprits-tiles-more now also tiles each month
it touches into `cerulean_archive/tiles/<month>.pmtiles` (layers `slicks` and
`slick_points`) and lists them in `cerulean_archive/tiles.json`. The map reads
that list: a month with an archive draws through a vector source, fetching only
the squares on screen; a month without one still reads the plain file exactly
as before, so nothing breaks while the tiling catches up.

---

## Fields lost on the way to the popup (item 9), first finding

`bindPopup` - the box of every harvested point layer - kept only the first six
`x_` fields of a record. The cut is gone: every published field is listed, the
values escaped, and the box scrolls (60vh). That alone restores, for the
registered facilities, the address, country, how the position was found and
the merge flag, which sat seventh and later.

The atlas now publishes what Trase gave for a site (`members[].published`,
`dedup.PUBLISH_RAW`); `pipeline/sources/abattoir_facilities.py` flattens it into
the record as `trase_*` (`_published`): inspection level and number, status,
capacity, export approvals, types, commodities, tax number. Checked against the
atlas's real output: 184,552 facilities drawn, 14,610 carrying Trase's fields.
They reach the map when this repo's refresh workflow next rebuilds the
facilities archive. The other registers' extra columns still stop at the atlas's
parsers; adding a register to `PUBLISH_RAW` there and `PUBLISHED_AS` here is all
it takes once its size has been looked at.

## Fields lost on the way to the popup (item 9), the harvested layers

Every harvester in `pipeline/sources/` chose a handful of columns for `extra`
and dropped the rest of the source row (gem_coal kept six of the tracker's
dozens; the EPA sites kept the address and the parent). `build_tiles.sh` also
excludes `x_country` and a few more from the tiles for size. Rather than load
every column into every tile, each harvester now hands the whole source row on
as `raw`; `normalize.py` keeps it out of the feature and writes it to
`map/data/pieces/<source>/<hh>.json` (256 pieces, keyed by the feature's id,
FNV-1a as SkyTruth's), which the refresh workflow already commits (`map/data`).
`bindPopup` reads the record's piece on a click and adds "Every field the
source publishes" under what the tiles carried; a source with no pieces is
asked once and left alone. Two limits: `PIECES_SKIP` (Climate TRACE, millions
of period rows) and `PIECES_LIMIT` (60 MB per source; over it, the log says so
and no pieces are written). The pieces appear when the refresh workflow next
rebuilds a source. `fieldRows` (the copied-file layers) also dropped every
nested value; it writes them out now.

## Two workflows that had been failing (22 September)

- **culprits, "Refresh atlas tiles"**: every run since the Global Forest Watch
  catalogue commit stopped at the first source with
  `FileNotFoundError: data/raw/climate_trace.json`. `harvest.py` has written
  `data/raw/<id>.jsonl.gz` since then; the build step still asked for
  `<id>.json`. The step now asks for `.jsonl.gz` (normalize.py reads gzip).
  No tiles had been rebuilt in that time, so the pieces and Trase's fields on
  the facilities all wait on the next run.
- **culprits-tiles-more, save.sh**: a file over 95 MB
  (`cerulean_archive/2026-09.geojson`) is left out of the commit but stays
  changed in the working tree, and `git pull --rebase` refuses to run over an
  unstaged change; every job's save failed eight times and nothing was kept.
  `--autostash` fixes it. That monthly slick file wants tiling like the earlier
  months (the map already reads a tiled month where one exists).

## Climate TRACE by gas: the plan

Climate TRACE's sector packages are per gas: `latest/sector_packages/<gas>/
<sector>.zip` for `co2`, `ch4`, `n2o`, `co2e_100yr`, `co2e_20yr`. The harvest
reads only `co2e_100yr` (`GAS` in `pipeline/sources/climate_trace.py`). The
split: read the `co2`, `ch4` and `n2o` packages as well, one feature per site,
period and gas with that gas's tonnes as `value` and `x_gas` set, into their
own archives (`climate_trace_<gas>_<sector>`), and the box gets each sector
group again under Carbon dioxide, Methane and Nitrous oxide, each drawing only
its gas's archive. Exact for those three gases; F-gases are not in the
inventory, and black carbon and NOx are in the air-pollution set (`ct_air`).
Cost: three more package downloads per sector per run (agriculture's co2e
package alone is 1.4 GB), so the per-gas harvest should run as its own job
with its own ETags rather than inside the existing one. Not written yet.

## The Satellite basemap close in: one season, and a multiply instead of a sheet (23 September)

Two things the owner saw on the Satellite basemap. Zooming in went green,
brown, green: Esri's World Imagery is a different photograph at different
zooms, and around zoom 12 it is often a leaf-off or dry-season one. And close
in the ground looked like plastic: the tint (`sat-relief-colour`) at 0.9
opacity with land alphas around 0.46 is one flat colour over roughly
two-fifths of the photograph, which cuts the contrast inside every tree crown,
rock face and river by that much; the shading over it comes from heights that
end at zoom 12 and are only enlarged past it, so it is smoother than the
photograph.

Now, on the Satellite basemap only (the atlas is unchanged):
- Imagery: `base` shows on the atlas only. The Satellite basemap uses two
  layers, `base-s2` (EOX Sentinel-2 cloudless 2024, source `s2`,
  https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg,
  maxzoom 14, layer maxzoom 13.25) and `base-close` (Esri, the `base`
  source, layer minzoom 12.5, fading in 12.5 to 13.25). `SAT_CLOSE.handover`.
  EOX's WMTS is free for non-commercial use with the attribution given in the
  source; commercial use needs their licence.
- Tint: `colourOpacity` 0.95 to zoom 11, then 0.4 at 14 and 0.3 at 16.
- Shading: main exaggeration 0.7 at 12, 0.35 at 14, 0.15 at 16.
- Theme close in: `atlasWashPasses` returns one multiply on Satellite,
  `SAT_CLOSE.multiply` [0.80, 0.93, 0.80], off to zoom 10, full from 14.
  Multiply scales each pixel, so texture keeps its contrast.
Not seen rendered from the sandbox (it cannot reach the tile hosts). If the
close-in green is too strong or too weak, `SAT_CLOSE.multiply` is the knob;
if EOX's squares fail, the console names source `s2`.

## The drawn relief from Mapterhorn; a lighter tint wide out (22 September, night, later)

While zooming the owner saw the tint and shading come and go, the plain
photograph or a patchwork between. A hillshade or colour-relief layer draws
nothing on a square until its heights arrive (no coarser stand-in, unlike the
imagery), and the AWS terrarium tiles are slow from a browser. `outline-dem`
(the Satellite relief and the outline map's shading) now reads
`RELIEF_SOURCE`: Mapterhorn, https://tiles.mapterhorn.com/{z}/{x}/{y}.webp,
terrarium, 512 px, keyless, maxzoom 12 (its global coverage; its TileJSON
gives no maxzoom, and above 12 most of the world has no squares). 3D terrain
still reads the AWS tiles (`TERRAIN_SOURCE`). Colour opacity now 0.5 at
zoom 2, 0.72 at 5, 0.95 from 8. Not tried against Mapterhorn from the
sandbox (it cannot reach the host); if its squares fail, the console shows
it and the source can go back to TERRAIN_SOURCE in the two addSource lines.

## The Satellite tint held at every zoom (22 September, night)

Close in, the owner saw the theme only on steep ground and the plain
photograph elsewhere. The tint had eased to 0.7 opacity with land alphas of
0.3 (about a fifth of the way), and the brighter imagery grade of the fourth
version pulled the rest back to the photograph. Now land tint alphas 0.38-0.46,
colour opacity 1 wide to 0.85 at zoom 16; imagery max 0.95, saturation
+0.12, contrast 0.14. The shading only shows where the ground slopes, so on
flat ground it is the tint that carries the look.

## The Satellite relief, fourth version (22 September, late)

The softened version dropped the tint and shading close in and lost the
look; the owner wants them kept at every zoom, minus the plastic sheen, and
a sunlit rather than overcast world view. Tint opacity 1 at zoom 2 easing to
0.6 at 16 (never 0); land tint a lusher green, sea a clearer deep blue.
Main shading exaggeration 1 at 2 to 0.55 at 15; lights faint and warm (at
most 0.14), shadows at most 0.8. The depth light, which smoothed the coarse
elevation into rounded sheets close in, is gone by zoom 11. Imagery: max 1,
saturation +0.2, contrast 0.1. Vignette halved (0.18). Fog stays at the
horizon only.

On the flat map not dragging past its edges: checked in headless Chromium on
the live code (6032c70), flat map, Satellite and Atlas, with and without 3D
terrain (terrain drawn from real elevation), by mouse drag - the map goes
past its edge into the stars in every case. Not reproduced; waiting on the
owner's steps.

## The Satellite relief, softened (22 September, evening)

The owner found the stacked shading rocky and grainy, the slopes sheened and
too rounded, the tilted distance foggy, and close in the drawn relief lay on
the photograph like a glossy plastic sheet. The photograph carries real
texture and real sun shadows, so the drawn relief now only works where the
photograph cannot, wide out, and gives way with the zoom: tint opacity 1 at
zoom 2 to 0 at 14; multidirectional shading exaggeration 0.9 at 2 to 0 at 14,
shadows at most 0.7, lights at most 0.08 (they read as sheen); the second
(depth) light 0.6 at 2, gone by 6. Imagery contrast down to 0.08 (it
sharpened grain). Defence sky: fog only in the last strip before the horizon
(`fog-ground-blend` 0.97, `horizon-fog-blend` 0.25). What the owner's
reference picture shows close in - fuzzy canopy, textured rock, rapids - is
illustration; the map shows the photograph's own texture untouched from
zoom 14, and the tree options (canopy or 3D models) are still to decide.

## The Satellite relief, fifth version: back to o, mountains matte, world view clearer (22 September, latest)

The owner went back to patch o's look as almost right, with two faults: the
mountains read sleek, flat and plastic, and the world view overcast. Built on
main, so the non-look fixes since o stay (Mapterhorn heights, Sentinel-2 out to
13.25, fog only at the horizon, USDA rows out, uMap copy). The look values in
`SAT_RELIEF` go back to o's, the close-in multiply (`SAT_CLOSE.multiply`) is
taken out, and then:
- Mountains: lights faint and warm (alpha 0.12 at most), shadows 0.8 at most;
  `sat-relief-depth` uses `"combined"` (slope shading) instead of the legacy
  `"standard"`, which rounds ranges into one smooth form; the tint thins from
  0.26 at 1,200 m to 0.08 at 5,500 m so rock and snow show; the 3D raise is
  4.5 at zoom 3 (was 7); shading eases past zoom 12 where the heights end.
- World view: sea veil lighter and bluer, tint opacity 0.8 at zoom 2, main
  shade 0.85 and depth 0.75 there, imagery max 0.93 and saturation +0.12,
  atmosphere 0.2 at zoom 0.
Not previewed: the sandbox cannot reach the elevation or imagery servers.

## The Satellite relief, third version: imagery forward, stacked shading, 3D lift (22 September, latest)

Replaces the earth-tone hypsometry of patch l (and the unapplied m and n).
The owner found the painted relief flat and 2D from the world view and asked
for something that pops, darker prehistoric green, no haze. The imagery now
carries the colour (grade: max 0.88, saturation +0.08, contrast +0.18), so
the ground's own forests, deserts and ice show. `sat-relief-colour` is a
see-through tint by height (rgba stops): land toward deep green at most a
third of the way, high ground toward grey-brown, sea darkened to slate-navy
with the shelves lighter; opacity 1 wide to 0.55 at zoom 14. Two hillshades:
`sat-relief-shade` (multidirectional, green-black shadows) and
`sat-relief-depth` (one low north-west light) stacked for roughly twice the
depth one allows. With 3D terrain on and this basemap, the exaggeration
follows the zoom (`SAT_RELIEF.lift`: 7 at zoom 3 down to 1.4 at 12), set
again at the end of a zoom only when the half-step changes (`liftTerrain`);
other basemaps keep 1.4. No grain on satellite; the defence atmosphere thin.
Previewed in headless Chromium on ETOPO 10' with NASA Blue Marble (three.js
example texture) standing in for the Esri imagery.

## The Satellite basemap as earth-tone shaded relief (22 September, later)

Supersedes the sensor grade below, which read dreary and uniform. The
imagery is only lightly muted now (saturation -0.3, max 0.92) and takes no
washes. Over it, from the terrarium elevation tiles (`outline-dem`, shared
with the outline map), `addSatelliteRelief()` adds `sat-relief-colour`, a
MapLibre `color-relief` layer with a terrain palette by height
(`SAT_RELIEF.colour`: slate sea, muted green, olive, khaki, ochre-brown,
sienna, slate-grey rock, off-white; opacity 0.62 at world view to 0.3 close
in), and `sat-relief-shade`, a `multidirectional` hillshade lit from four
directions weighted to the north-west, warm-slate shadows and off-white
lights. Esri's relief tiles now show on the atlas only. Grain 0.1 on
satellite; labels grey at 0.8; defence sky slate with an earth-grey horizon.
Previewed on made-up terrain in headless Chromium; real elevation and imagery
could not be fetched from the sandbox.

## The Satellite basemap regraded as sensor imagery (22 September)

Only the Satellite basemap; the atlas and the imagery under it are untouched.
`BASE_GRADE.satellite`: saturation -0.6, brightness max 0.74, contrast 0.2
(was +0.38, 1, 0.14). `atlasWashPasses` gives the satellite its own two
passes, `SAT_WASH`: a plum-grey multiply (#B4AEBA) and a dark screen floor
(#0D0B10), in place of the atlas's sea, green and warm washes. Labels grey
(saturation -1) at 0.62. The glow's grain covers the whole view on satellite
at `GLOW.grainSatellite` (0.2), rising to `GLOW.grain` where the glow is.
Defence view: slate-plum sky in place of teal, corner brackets removed,
vignette neutral, threat halos radius 2.5-8 at 0.16 (were 5-13 at 0.22),
click ring bone at low opacity. `atlasTune()` now tunes the atlas only; it
used to overwrite the satellite grade too. Esri imagery cannot be fetched
from the sandbox, so this was not rendered before shipping.

## The glow made finer (22 September, later)

The first glow read as smooth round blobs. Now, per point layer, `addHud`
adds three layers under the round one: `<id>-haze`, a faint wide heatmap
(opacity 0.3, ramp tops out at rose); `<id>-core`, a circle layer of specks
0.8-2.1 px times a small lift by amount, colour and opacity by amount, blur
0.6 - circles rather than a heatmap because MapLibre draws a flat-map
heatmap at a quarter of screen resolution, which would smear them; and
`<id>-soft`, the close-in surround (was `-halo`, renamed so planetary
defence, which hides every `-halo`, leaves it alone; defence also skips
`-haze|-core|-soft` when choosing what to pulse). Haze and cores full to
zoom 9, gone by 12. The round dots are unseen below 9 (still clickable),
rise to 0.9 by 12, blur 1. `glowGrain()` puts one 256 px noise image, from a
fixed seed, in a screen-fixed div over the map canvas (under controls and
popups), `mix-blend-mode: soft-light`, opacity `GLOW.grain` (0.3) fading
with the haze; off when no glow layer is showing. Rendered and checked in
headless Chromium on test points, not on the live tiles.

## The glow (22 September): symbols gone, emissions as a field of light

Every point layer's geometric symbol is gone. `addHud` (kept the name; the
wrappers under it too) now adds, under each round layer, a WebGL heatmap
`<id>-glow` and a blurred circle layer `<id>-halo`: the field draws full to
zoom 9 and is gone by 12, weighted by each source's `value` over the layer's
largest value (`glowMaxOf`, read from the archive's tippecanoe statistics in
`addPmtilesLayer`; a layer with no amounts weighs points, or merged counts,
alike), so one big emitter outglows ten small ones; the dots rise as the
field fades, soft-edged, sized by the layer's own area-by-amount rule, with a
halo. Colours plum (#6E4A6A), rose (#B07087), bone (#E8DFD0); `GLOW.ramp`.
Everything is drawn by MapLibre on its canvas; no DOM markers. Nothing
filtered or merged for looks. The wrappers carry visibility, filter, move,
remove, radius and opacity from the round layer to its two mates. The old
HUD constants and shape images remain in the file, unused, for now.

The Climate TRACE groups are back under one heading, "Emitting sites by
sector, until split by gas": placing each under a single gas drowned out the
others a sector emits. The per-gas split is a tiling change: Climate TRACE
publishes co2, ch4 and n2o per site (columns `co2`, `ch4`, `n2o` beside
`co2e_100yr`), for every sector, so a site can be tiled under each gas it
emits with that gas's tonnes - exact for those three gases; F-gases, black
carbon and NOx are not in that inventory (black carbon and NOx are in the
air-pollution set, the `ct_air` row).

## Climate TRACE air pollution: plumes as still hotspots, read through the Worker

The click box stayed at "Reading Climate TRACE..." and no plume ever drew:
api.c10e.org and plumes.climatetrace.org send no Access-Control-Allow-Origin.
The Worker now has `/v1/ct-asset?id=&gas=&years=` and `/v1/ct-plume?file=`
(passthroughs like Carbon Mapper's; BUILD says 2026-09-22, **redeploy the
Worker**: `cd worker && npx wrangler deploy`). The plume is drawn once, still,
as a hotspot rather than outlines: `ctPlumeShape` gives every feature a
`_strength` from whatever concentration figure the file carries (the strongest
part 1); polygons fill graded by it with no outline, points draw as a heatmap,
lines blurred. **The plume file's real fields have not been seen from the
sandbox**; if the fill draws flat, paste one plume file's first feature.
Also: population density under a new Overpopulation heading under Of the
planet; nitrogen dioxide rows under a Nitrogen dioxide heading under Climate
(air quality and PM2.5 stay under Pollution > Air).

## Climate arranged by greenhouse gas (22 September, later)

The Destruction page's climate section runs carbon dioxide, methane, nitrous
oxide, F-gases, black carbon; the Climate heading now does the same, each row
under the gas its sites mainly emit: coal plant units, power plants, national
CO2, the Climate TRACE sectors, forestry and history groups, the refineries
under Carbon dioxide; the wastewater rows, Carbon Mapper's plumes and the
Climate TRACE agriculture group under Methane; that group again, fertilizer
plants, the soybean, corn and grain rows under Nitrous oxide (copies, the
originals staying under Agriculture); the refineries copied under Black carbon
(where the page has them, among vehicle fuels); carbon bombs under
"Infrastructure emitting more than one gas"; F-gases empty. Catalogue rows: a
title naming methane or nitrous oxide goes under that gas, any other emission
under Carbon dioxide. **A true per-gas split of the Climate TRACE sites is not
possible yet**: the archives carry each site's CO2e total only; the source's
per-gas columns now reach the pieces and could be tiled next. The Nusantara
alert rows ("Trees cut ... every alert system") are under Deforestation.

## The box rearranged to the owner's list (22 September)

`PANEL_ORDER` was rewritten from the owner's `layers-reallocated.md`, heading
for heading; 151 rows placed, 129 headings, nesting to five levels. Rows are
named as the list names them (45 renamed: the source goes at the end in
parentheses, no code names - "Emitting sites by sector (Climate TRACE)").
`cultivated_meat_laws` is out of the box (`PANEL_REMOVED`). The concessions
rule of the same day is kept, with "Other" now the last heading under Of the
planet.

`CATALOGUE_PLACES` sends the catalogue rows to the new headings: alerts and
loss to Deforestation > Tree cover loss and alerts; Trase's pulp measures to
Deforestation > Wood pulp, Indonesia; palm and mills to Agriculture > Palm oil,
soy and corn to Soy, corn and grain, cocoa and cotton to their heading, other
crops to Agriculture itself; Trase's cattle measures to Meat > Facilities;
emissions to Climate > Emissions - Trase's by sector (its `fileBy` now ends in
"trase"), Global Forest Watch's by gas; air quality to Pollution > Air;
mangroves and reefs to Oceans > Reefs and mangroves; the moratorium (PIPPIB) to
Spatial plans and to Deforestation > Moratoriums; Badung's plans to
Agriculture > Detailed spatial plans, Badung; relief and boundaries to Base and
reference > Boundaries and relief. A rule whose path is `null` **leaves a
layer out**: the Forest and land cover heading and its rows were deleted at the
owner's request, so a land-cover layer that no other rule claims gets no row
and is counted in the console (`LEFT_OUT`). Agriculture > Moratoriums from the
list was not made: Nusantara has one moratorium layer and it is a forest one.

## Could not get, could not add, or needs the owner (kept current)

Kept as the rounds go; move a line out when it is settled.

- **Round 23, unverified in a browser**: the JRC surface water tiles
  (`water-world` bucket) and OpenLandMap's GLC_FCS30D GeoTIFFs may not let
  another site read them (CORS). If either row says it could not be read, the
  fix is a copy: JRC's tiles through culprits-tiles-more or R2, GLC_FCS30D cut
  to web tiles on R2 (the worldwide 2022 file is tens of GB, too big for
  GitHub).
- **Round 23, Global Forest Watch tiles made on request** (1996 mangroves, the
  reservoir anomalies, PANGAEA mines, the water-stress test copy): they no
  longer hold the row up, but GFW builds each square from its database when
  asked, so they fill in slowly, slowest at the world view. The 1996 mangroves
  could be built as our own tiles from Global Mangrove Watch v3 on Zenodo if
  that is too slow.
- **Round 23, no worldwide land use map with Indonesia's detail**: no map
  found separates plantations, mining, transmigration and fish ponds
  worldwide. GLC_FCS30D is the finest land cover by class (35 at 30 m);
  GLC_FCS10 (10 m, 30 classes, 2023) exists but only as a 128 GB download with
  no service; OpenStreetMap is the finest land use but volunteer-mapped.
- **Round 23, Trase**: burned peatland (and burned area) are in Trase's list
  with no values published for any year; those rows leave the list when
  ticked. Whether Trase's Indonesia region shapes load was not checkable here
  (their file server asks for approval from this sandbox).
- **Round 23, the aquaculture pond clusters' licence**: the paper is CC BY
  4.0, but its data statement says "available on request" and the Zenodo
  record gives no licence. The owner is asking the authors (see "Where things
  stand" at the top).
- **Round 23, cifor_peatlands and gfwpro_peatlands**: Global Forest Watch has
  nothing drawable for either; taken out. CIFOR's tropical wetlands map would
  need building from its own download.

- **Wageningen driver classes**: the alert-drivers layer is keyed Class 1 to
  11; Global Forest Watch publishes the numbers without names and no public
  list was found. Needs the class list from Wageningen or GFW.
- **Atlas for the End of the World plates not placed** (10): Cape Floristic
  Region, East Melanesian Islands, Madagascar, Mountains of Southwest China,
  New Caledonia, New Zealand, Philippines, Southwest Australia, Succulent
  Karoo, Wallacea: too few named towns agreed, or the fit was off by too much.
  They zoom to their outline instead.
- **USDA soybean and corn explorers**: USDA retired the site; rows removed.
- **Three Nusantara layers** keep the server's own titles: nobody could vouch
  for what they show.
- **Three older Global Forest Watch driver layers** stay grey: GFW paints them
  itself and two have no finished tiles.
- **Wastewater watershed shapes** (103 MB) not built: waiting on the owner.
- **Waste Atlas** is a 2016-era site: its figures are as it last published
  them; its https certificate has expired, hence the weekly copy.
- **Workflow files**: the owner's Mac token cannot push `.github/workflows`
  changes; those are edited on github.com.
- **Satellite basemap** is also worked on in another chat; changes here are
  kept to the lowland colour stops.
- **EIA Environmental Crime Tracker** (their item 6): a Power BI report; the
  full dataset is "available on request" from EIA's enquiry form, so it cannot
  be drawn as points until the owner asks for it. Until then it is the page row
  `powerbi_report`, now copied under Illegal logging and timber trafficking,
  F-gases and Of animals as well as Biodiversity loss.
- **Atlas hotspot-city maps** (their item 7): each city's map is a PNG, not a
  PDF, so its town names are pixels. culprits-tiles-more
  `scripts/atlas_city_plates.py` (by hand) reads them with Tesseract, looks
  each up on Nominatim within 1.5 degrees of the city, and places the picture
  where at least 4 names agree with a typical error under 3% of its width
  (`atlas/city_plates.json`, `atlas/city_plates/<slug>.webp`). The map lays a
  placed city's picture as it does a hotspot's; an unplaced city keeps its old
  behaviour. How many place depends on how legible the pictures are.

## Round of 23 September (12): the other chat's list taken over; F-gases; the slick archive

The other chat handed over its open items (HANDOFF_TO_OTHER_CHAT.md, 23
September). Done or already covered: the Global Wastewater Model (pour
points, countries, plumes), the outside-server checks for USDA, EJAtlas,
materialresearch and Wreckers of the Earth.

- **EDGAR F-gases** (`edgar_fgases`, rasterlive, Climate > F-gases): from
  culprits-tiles-more `scripts/edgar_fgases.py` (by hand). EDGAR's page folds
  its gridmap links, so the script reads the release's own file index on
  jeodpp, writes `edgar/listing.txt`, and takes the latest annual F-gas
  emissions gridmap it finds; if none, it stops and the listing says why.
- **Cerulean slick archive**: `scripts/cerulean_archive.py` keeps each month as
  `<month>.geojson.gz` (was plain GeoJSON; September's 85 MB file was about to
  pass the cut, and August and July had already been lost to it), tiles each
  changed month into `<month>.pmtiles` (layers `slicks` from zoom 7,
  `slick_points` to 6, which the map already reads), writes `tiles.json`, and
  reads again from Cerulean any month the index lists with no store.

## Round of 23 September (16): the first run of the new builds

Every job saved except the slick archive. EDGAR's first build took sulphur
hexafluoride only, from the first file in its zip, which is not necessarily
the latest year; `edgar_fgases.py` now builds one archive per gas group
(HFCs, PFCs, SF6, NF3, HCFCs) from the latest year in each zip, and the row has
a chip per gas. The slick archive's job was stopped while reading August again
in one piece; `cerulean_archive.py` now reads a lost month a day at a time,
saves after each day, stops at 100 minutes, and carries on next run
(`cerulean_archive/refill.json`). Mines' first file is 96.7 MB (92 MiB), under
the 95 MiB cut.

## Round of 24 September (2): ct_gases a sector at a time

The CO2 run harvested and normalised all 111,949,068 rows, then was stopped
by the 160-minute limit while splitting, and kept nothing. The harvester now
reads `CT_SECTORS` (comma list; unset means every sector, as before), and
culprits-tiles-more `scripts/ct_gases.py` builds one (gas, sector) pair at a
time, never-built first, starting a new pair only in the first 45 minutes and
recording each as it finishes (`tiles/climate_trace_gases.json`: per gas,
`sectors` and the `archives` the map reads). 24 pairs; run `ct_gases` until
the log says every pair is built.

## Round of 24 September: ct_gases past normalize

The first real `ct_gases` run (CO2) harvested 111,949,068 rows, then stopped in
`pipeline/normalize.py`: `climate_trace_co2` was not in sources.json. The
per-gas ids now take the `climate_trace` registry entry (normalize.py, after
SOURCES). Watch the next run's time: a row count that size may be near the
160-minute job limit.

## Round of 23 September (19): the slick archive, the saves, the city maps

The run of 23 September (logs_97274071361) showed:
- Slick archive: July and August were read back in full (48,546 and 49,107
  slicks), but a month gzipped was over 95 MB and a month's tiles with every
  field were 744 to 752 MB, and the save then stuck on a rebase clash over a
  Python cache file. `scripts/cerulean_archive.py` now keeps a day to a file
  (`cerulean_archive/<month>/<date>.geojson.gz`, older whole-month files
  split on the next run), tiles only each slick's `id` and `t` (time), goes
  from zoom 10 to 9, then splits a month by date into several files;
  `tiles.json` may list an array per month. The map draws each file through
  its own source and reads a slick's record from Cerulean by id on a click.
- `.github/save.sh`: drops Python cache files before committing, and undoes a
  rebase that stopped on a clash before trying again.
- City maps: 2 of 33 placed (Osaka, Tel Aviv); OCR read 1 to 10 words a
  picture. Now read at three times the size in grey at full contrast, in two
  modes, and a north-up, one-scale fit (two names fix it, a third checks it)
  is tried where the free fit finds too few.
- That run's EDGAR job checked out the code before the nested-zip fix; it
  needs running again.

## Round of 23 September (18): every field in the boxes that picked their own

Item 9 of the handed-over list (every field a source publishes reaches the
box), checked across all 29 popups. The ones that chose fields by hand now
show the rest too: Global Trade Alert (every type, not six), Giga (the whole
country record), Allen Coral (every field of the patch), the Climate TRACE
columns (every field, not five), the shape layers' own text and list (whole,
not 1,200 characters and 40 entries) and EPA's picture (every facility hit,
not eight). Long ones scroll. Site maps use their own boxes, and harvested
layers read their pieces, so both were already whole.

## Round of 23 September (16): owner's answers of 23 September

- EPA: every dot kept from the world view (the owner's choice), 17 MB first square.
- Wastewater watersheds: row `wastewater_watersheds` (route `pmtareas`, a new
  area route: fill in 7 plum-to-bone steps from `wastewater/watersheds.key.json`,
  records from `wastewater/pieces` by basin id). Built by culprits-tiles-more
  `scripts/wastewater_watersheds.py` (by hand).
- Forest and land cover stays as it is.
- Trase's "GDP per capita" (Colombia) measure is dropped (`TRASE_REMOVED`).
- Six more site maps split by their popup tag into a row per type
  (`types_from_popup_tag` in the registry, `typeRows: true` in app.js):
  world news, advertising, entertainment, research integrity, indigenous
  conflicts, self-sufficiency. The empty refresh rebuilds them; a map whose
  tags do not split cleanly keeps its one row.

## Round of 23 September (11): the modelled farms' squares made light

The unmerged CAFO archive's world square was 3.6 MB. `abattoir_cafo.py` now
tiles only `id` and `precise`, with every field in `cafo/pieces/<hh>.json`
(FNV-1a); the map reads the piece on a click (`CAFO_PIECES`), and an older
full-field square still shows as before. The mines' tile-join now keeps
squares over 500 kB (`--no-tile-size-limit`); the first unmerged build had
lost the world-view squares. Soy and maize are built (4 to 10 MB each).

## Round of 23 September (10): the wastewater plumes

`wastewater_plumes` (rasterlive, four chips) under Pollution > Wastewater, from
culprits-tiles-more `scripts/wastewater_plumes.py` (by hand): downloads the
plume zip, reads each 3 GB raster at a quarter resolution (average), draws it
with `food_crops.build_array` (which now skips any square whose parent held
nothing), into `tiles/wastewater_plume_<k>.pmtiles` and
`wastewater/plume_<k>.key.json`. A raster with no projection is not drawn.
The watershed shapes are not built.

## Round of 23 September (9): refresh notes, positions, place names, the green cast

- **Refresh notes**: `refreshNote(cfg)` adds a small note after every LIVE /
  NOT LIVE mark. Live rows: "read afresh each time it is ticked" (as the map
  moves for `worker` and `cerulean`). Copies: the rhythm read from the row's
  NOT_LIVE reason, note and name (hourly, daily, weekly, every four weeks,
  made once); where none is said, "copy; renewed when rebuilt, no set rhythm".
- **Positions**: every dot's box gets a "Position:" line (`positionText`),
  added by wrapping `maplibregl.Popup.prototype.setHTML/setDOMContent` with
  the point under the last click. Precision fields first (`x_precision`,
  `precise`), then `POSITION_BY_ROW` / `POSITION_BY_PREFIX`, else "The
  coordinates the source gives; it does not say how exact they are." A box
  that already says (`POSITION_SAID`) is left alone.
- **Place names** tick box beside 3D terrain: empties every symbol layer's
  `text-field` and restores it (kept in `namesField`); remembered in
  localStorage; applied again on `styledata` while off.
- **Satellite**: the lowland stops of `SAT_RELIEF.colour` (1, 400, 1000 m) are
  far less green at the same darkness and alpha; nothing else in the look
  changed. (The Satellite basemap is also being worked on in another chat.)

## Round of 23 September (7): the EPA copy, rebuilt in parts

The first unmerged EPA build was over 95 MB at every depth, and the old
script then deleted the last copy (commit aff4631 in culprits-tiles-more).
The owner restores it from ecef1f0. `scripts/epa_efpoints.py` now builds one
file per zoom 0 to 6 (`epa_efpoints_z<z>.pmtiles`, the map draws EPA's own
picture from 6.5), each point carrying only `_lid` and `_oid`, listed in
`epa_efpoints.build.json`; the files replace the old copy only if all fit; a
failed try writes `epa_efpoints.tried.json` with the sizes and keeps the copy.
Rebuilt every four weeks. The map reads the list (one file if there is none),
registers the layers in `cfg._layerIds` so unticking the row hides them, and
names a point from EPA's record on a click.

Waste Atlas rows (item 44): the copy holds 4,606 markers (2 with no position)
in seven categories: city 1,799, Sanitary Landfills 1,626, WtE 716, country
164, MBT 130, Dumpsites 93, Biological Treatment 78. One `geojsonlive` row
per category (`files[].only = [field, value]`), under Pollution > Solid waste;
dumpsites and landfills copied under Climate > Methane, WtE under Carbon
dioxide. Soy and maize (item 24): `food_soy`, `food_maize` (rasterlive, four
chips each) from culprits-tiles-more `scripts/food_crops.py` (by hand), which
reads eight rasters out of `crops_food_feed_raw.zip` by byte range and builds
`tiles/food_<crop>_<pressure>.pmtiles` and `food/<same>.key.json`.

Waste Atlas: its data is `http://www.atlas.d-waste.com/uploads/data.xml`
(https has an expired certificate); `scripts/wasteatlas.py` copies it weekly.
Soy and corn: `scripts/food_list.py` lists the package's zips.

## Round of 23 September (6): every point at every zoom (item 25); soy and corn (item 24)

- **No merged points.** The owner asked for every dot at every zoom. The
  archives that merged crowded points into counts are now built with none
  merged (`-r1 --no-feature-limit --no-tile-size-limit`, no `--cluster-*`):
  culprits-tiles-more `mines.py` (points), `mine_features.py` (points),
  `abattoir_cafo.py`, `epa_efpoints.py`, `skytruth_tiles.py`, and this repo's
  `pipeline/cerulean/harvest_points.py`. Each marks its build as unmerged, so
  the next run rebuilds once. CAFO and EPA lower their deepest zoom only if the
  file would pass 95 MB. The cost, said to the owner: at the world view each
  row fetches one heavier square before it draws.
- **Soy and corn emissions**: Halpern et al. 2022 (Nature Sustainability)
  maps greenhouse gases, water, disturbance and nutrients per food for 2017;
  its data is KNB doi:10.5063/F1V69H1B (Frazier et al., Global food system
  pressure data). `pipeline/knb_list.py` lists the package; the build is
  written from that list.

## Round of 23 September (5): the owner's notes on the map

- **No grain.** The fixed-noise overlay (`glowGrain`) textured the whole map
  whenever a point layer was on; `GLOW.grain` is 0 and the grain is never made.
- **Pulling the layers box up** did nothing: `.left-col .panel{flex:1 1 auto}`
  filled the column whatever height the pull set. A pulled box now gets
  `flex:0 0 auto`; a double-click on the bar puts it back.
- **The news wires' arrow** is at the right-hand end of its bar (`#wireEnd`);
  the title still opens and closes the box.
- **Atlas for the End of the World**: the panel holds only the see-through
  slider and a link to the Atlas's page. It closes, and the plate goes, when
  the row that opened it is unticked (`atlasOwner`, checked in
  `applyVisibility`). For detail close in, `atlas_plates.py` also draws each
  placed page at four times the size in a 4 x 4 grid, each square placed by
  the page's own fit (`plates.json` `detail`); the map adds the squares on
  screen once the view is closer than the whole plate. Re-run
  `pipeline/atlas_plates.py` to make them (the look-ups are cached).
- The HydroWASTE archive test accepts a sparse checkout, which leaves
  `map/tiles` out, so the suite passes on the owner's Mac and `&&` chains run.

## Round of 23 September (2): the Global Wastewater Model from its data package

`pipeline/wastewater_inspect.py` showed the N package holds pour points
(134,846; basin_id, open_N, septic_N, treated_N, tot_N and their shares),
watersheds (the same table, 103 MB of shapes), country totals (255 rows,
ISO3), and four global 3 GB GeoTIFFs of the coastal plumes (open, septic,
treated, total). No projection file is included.

- `pipeline/wastewater_build.py` (run on the Mac; pyshp and tippecanoe) makes
  `wastewater_n_{tot,treated,septic,open}.pmtiles` in culprits-tiles-more
  `tiles/` (every point, every zoom, `-r1 --no-feature-limit
  --no-tile-size-limit`; `value` = that measure; every field kept) and
  `map/data/wastewater_n_countries.countries.json`. It stops if the points are
  not in longitude and latitude, and works the unit out from the global total
  against the paper's 6.2 Mt N a year (stops if none fits), writing it on
  every point.
- Rows `wastewater_n_tot`, `_treated`, `_septic`, `_open` (pmtiles) and
  `wastewater_n_countries` (country) under Pollution > Wastewater. The old
  `wastewater` picture row is in `PANEL_REMOVED` (its server is gone) and no
  longer under Methane.
- Not built yet: the plume GeoTIFFs and the watershed shapes.
- **Projection** (the owner's first run stopped, as it should): the points are
  not in longitude and latitude, and there is no .prj. Their extent (x to
  +-17.9 million m, y -6.8 to 8.8 million m) is wider than Robinson, Eckert IV
  or Equal Earth allow and fits Mollweide (ESRI:54009, radius 6378137), the
  projection of the ocean-impact maps the model feeds. The build now tests it:
  every point must fall inside the Mollweide world ellipse, or it stops. The
  extent's corners come back at latitude 83.6 N and 59.5 S, coasts that exist.
- **First real run**: Mollweide confirmed (all 134,846 inside the ellipse,
  latitudes -59.5 to 83.6), the unit grams (6.19 Mt N a year in total). With
  every field in every tile to zoom 10 the archives were 85.5 and 99.2 MB,
  and the Mac's disk filled. The tiles now carry only `id` (basin_id) and
  `value`, to zoom 8 (enlarged beyond), and every field is in 256 pieces at
  culprits-tiles-more `wastewater/pieces/` (FNV-1a, the map's `pieceOf`), read
  on a click through `cfg.boxes`. Working files are deleted as it goes; a file
  over 95 MB stops the build.
- **Waste Atlas** (item 44): `pipeline/wasteatlas_probe.py` lists the page's
  scripts and the data addresses in them, for the reader to be written from.

## Round of 23 September: one row per air pollutant; the wastewater package found

- **Climate TRACE air pollution by pollutant** (item 39). Eight rows,
  `ct_air_pm2_5`, `_bc`, `_oc`, `_so2`, `_vocs`, `_co`, `_nh3`, `_nox`, route
  `ctairgas` (drawn by `addCtAirLayer`), each under its own heading in
  Pollution between General and Nitrogen dioxide; black carbon also under
  Climate > Black carbon. Every source in `ct_air/sources.geojson` is drawn,
  its `value` the pollutant's yearly amount from `ct_air/gases.json`, and the
  glow is weighed by it (`glowMaxOf`). The amounts come from
  culprits-tiles-more `scripts/ct_air_gases.py`: weekly (Mondays or by hand),
  `api.c10e.org/v7/app/asset/<id>?gas=<gas>&years=2024` -> `totals.value`, eight
  requests at a time, least recently read first, saved as it goes, stopping at
  130 minutes; a figure not answered keeps the last one. About 9,400 sources x
  8 pollutants, so the first copy may take two runs. The rows are NOT LIVE; a
  click still reads the plume and figures live through the Worker.
- **Wastewater**: KNB's index gives the three files' ids (N pour points and
  watersheds 403 MB, FIO 910 MB, N coastal plume GeoTIFFs 276 MB).
  `pipeline/wastewater_inspect.py` downloads the N and plume files and lists
  what is in them; the build is written from that listing.
- `check-sources.mjs` now asks for the soy silos where the map does (the copy).

## Round of 22 September (6): the second check

- **USDA's explorers are gone.** ipad.fas.usda.gov now answers 503 with a page
  titled "IPAD retired": per USDA guidance the site is no longer public, and
  gis.ipad.fas.usda.gov does not connect at all. `usda_soybean` and
  `usda_corn` are in `PANEL_REMOVED` (their configs kept, for the record).
  Soy and corn are still on the map through MapSPAM (GFW catalogue) and
  Trase's measures.
- **Wreckers of the Earth**: every layer comes back as text/html with no CORS
  header, at the map's own address and without the language part, though the
  body is the GeoJSON. culprits-tiles-more now has `scripts/umap_copy.py`
  (run daily by refresh.yml, which runs every script in scripts/), writing
  `umap/<map>/<layer>.geojson`; `readUmap` tries that copy first. The row is
  NOT LIVE.
- **GFW's tile service colours a GeoTIFF when given `colormap`** (a square over
  the Amazon came back 200, image/png), so the round 5 keys hold.
- **Wastewater (KNB)**: the package metadata names three zips but gives no
  addresses; the resource-map query found nothing. The check now asks the
  index by the package id itself.

## Round of 22 September (5): what check-sources.mjs found

Read from the owner's run of `map/check-sources.mjs`:

- **Drivers of tree cover loss (WRI and Google) in colour, with a key.** Its
  COG holds codes 1-7 (uint8, 0 = nothing); the Zenodo record (Sims et al.
  2025) gives the codes: permanent agriculture 1, hard commodities 2, shifting
  cultivation 3, logging 4, wildfire 5, settlements and infrastructure 6,
  other natural disturbances 7. `GFW_KEYS` gives each a colour; the COG tile
  URL carries `&colormap=` (titiler's form); the key shows under the row and,
  indented, in the Showing box (`CATALOGUE_KEYS`). `gfwPickAsset` now takes
  `default.tif`/`class.tif`, not an `intensity` COG.
- **DIST-ALERT** (int16, 20,759-32,083): coloured by its first digit, 2 low
  and 3 high confidence, as ranges.
- **WUR driver classes** (1-11): coloured, but keyed "Class 1" to "Class 11":
  GFW's record names no driver per number. Names wait on a source that gives
  the mapping.
- **Not yet coloured**: Curtis/TSC drivers (`tsc_tree_cover_loss_drivers`) are
  GFW's own raster tile caches per canopy threshold (tcd_10 ... tcd_75), whose
  colouring is GFW's; `tsc_drivers` has only a pending cache; `umd_drivers`
  lists no assets at all.
- **Trase facilities**: resources.trase.earth sends no CORS header, so the
  browser cannot read them (the soy silos row). culprits-tiles-more's
  `scripts/trase.py` now copies each file to `trase/facilities/` weekly and
  gives each type its own `base`; the map reads `hit.base`. The eight rows are
  NOT LIVE.
- **Materials research** is an Experience Builder app ("Web Experience");
  its maps are named in `dataSources` and are now read first
  (`arcgisExperienceIds`), with a larger allowance (40 items).
- **EJAtlas**: first page gives `count`; the rest are read four at a time.
- **Nusantara's fire alerts**: 2-12 s per picture on their server; squares are
  now 512 px (a quarter as many requests).
- **Seas of Plastic**: all three files answer with CORS; kept.
- **Wreckers of the Earth**: the map's GeoJSON answers, its layers do not (HTML,
  no CORS) at the `/en/` address; round 2 of the check tries the map's own
  address without the language part before a copy is made.
- **USDA explorers**: every request failed in about 0.3 s (the connection, not
  the service). Round 2 asks the USDA hosts that are still up.
- **Wastewater**: the archives are 404; the KNB package lists
  `N_PourPoint_And_Watershed.zip`, `FIO_PourPoint_And_Watershed.zip` and
  `Global_N_Coastal_Plumes_tifs.zip`; round 2 asks for their addresses.
- `node map/check-sources.mjs round2` runs without the long GFW and KNB parts.

## The Atlas for the End of the World's maps, on this map (22 September)

Asked for: opening a hotspot or a city zooms to it and shows the Atlas's own
map over this one, not a link out to the PDF.

- **`pipeline/atlas_plates.py`** places each hotspot PDF's first page. The
  towns on the page are text in the file, so each is read with where it sits,
  looked up on OpenStreetMap (Nominatim, settlements only, cached in
  `pipeline/.atlas-cache`), and a straight-line placement of the page is
  found that the most names agree on, trying 4,000 random sets of three so a
  wrongly matched name cannot drag it (RANSAC); five places on a label are
  tried as its dot (centre, each edge) and the best-fitting kept. The error -
  how far the agreeing towns still are from their places - is written with
  the plate. A plate is kept with at least 5 agreeing towns and an error under
  3% of its width; otherwise `plates.json` carries the reason. Output:
  `map/atlas/plates/<slug>.webp` (the page at 2,400 px) and
  `map/atlas/plates.json` (corners, error, towns used). Tested on a made-up
  PDF with a country label and a wrong look-up mixed in: both were set aside
  and the corners came back exact. **Not yet run on the real PDFs**; the owner
  runs it (about half an hour the first time, for the look-ups).
  First run stopped on a placement from three towns nearly in a line, which
  threw the page off the map's square (OverflowError); such placements are now
  refused (`on_earth`), and 300 random pages run through without error.
- **The map**: a hotspot's or city's box carries a button marked
  `data-atlas-auto`; opening the box runs it (`atlasFrom`). A hotspot with a
  kept plate gets an image source `atlas-plate` at the four corners, the view
  fits it, and a panel (`#atlas-panel`) says how many towns placed it and the
  error, with a slider between the two maps and the PDF's pages behind a
  "pages" button. Without a plate the view fits the hotspot's own outline and
  the panel says why. A city zooms (as before) and its Atlas page opens in the
  panel: the city maps carry no named places to fit them by, so they are not
  laid on the map. The page itself is on the plate, key and title included.

## Round of 22 September (4): same-name rows told apart, plumes unmerged, a source check

- **Four "Tree cover loss by dominant driver" rows and two worldwide protected
  area rows** are titled apart in `GFW_TITLES` (source at the end), and
  `GFW_ABOUT` puts what is known about how they differ first in each row's
  "i" box, ahead of GFW's own description. Where the records do not say how
  two differ, the box says that rather than guessing.
- **Carbon Mapper plumes are no longer merged** (item 25, map side): the
  source has no `cluster`, the counted `-cl` layer and `CARBON_CLUSTER_TO` are
  gone, and every plume is its own point at every zoom, with the glow under
  them showing where they crowd.
- **Still merged, in culprits-tiles-more**: mines points, mine feature points,
  CAFO, EPA facilities and the SkyTruth feeds (`--cluster-densest-as-needed`),
  and Cerulean's slick points in this repo (`pipeline/cerulean/harvest_points.py`).
  Unmerging them means lifting the tile-size cap they were merged to meet, so
  the world tiles grow; each needs its world-tile weight measured first.
- **`node map/check-sources.mjs`** asks every row reported as not drawing
  (USDA soybean and corn, Trase soy silos, EJAtlas, Wreckers of the Earth,
  Materials research, Seas of Plastic, the wastewater archives, Nusantara's
  fire alerts) what it answers, with timing and whether it sends a CORS
  header; reads the records, assets and COG pixel values of the GFW pictures
  that draw grey (the driver rows, WUR driver class, DIST-ALERT, burned areas,
  mining concessions) so their colours and keys can be built from what the
  pixels actually are; and lists the files in the wastewater package on KNB.

## Round of 22 September (3): what the filing report showed, live marks, legibility

Read from the owner's run of `map/filing-report.mjs`:

- **Word edges.** "drivers" matched `river` (Surface water) and "disturbance"
  matched `urban` (Construction); both rules now need a word start.
- **Rules by name see the id as well** (`title + " " + id`). Global Forest
  Watch's analysis tables - any id with `__`, the per-country, per-province,
  per-protected-area and per-shape alert counts - are taken out: they are
  tables and never draw. `wur_alert_drivers` is taken out (no tiles, item 10).
- **The dated Intact Forest Landscapes (2000, 2013, 2016, 2020) stay** under
  Biodiversity loss. Round 2's rule took out any title without "global"; the
  report showed those rows are years, not regions.
- **Titles from records** (`GFW_TITLES`, which now wins over GFW's own title):
  the WUR driver class and date rows, the coverage row (said to be one shape
  with no drivers in it), the 10 km soy buffer, IFL 2025, and the two worldwide
  protected-area sets told apart (public WDPA release, and the copy licensed to
  GFW). `GFW_WHERE` replaces a coverage record that is a sentence (major dams).
- **LIVE / NOT LIVE (item 43).** Every row carries one. `NOT_LIVE` lists rows
  whose route reads live but which draw a copy: Coastal Cleanup, space
  industry, Global Trade Alert, Giga, the wastewater model, Trase's measures
  (values weekly, shapes live), Atlas cities (places weekly). Catalogue rows
  take their catalogue's mark rather than a hard-coded LIVE.
- **Areas from Global Forest Watch get a light edge** (`-o-` line layer, bone,
  1.6 px at the world view) in place of a near-black outline, so mines and
  concessions show as specks from far out (item 37).
- **Vessels of concern glow at full strength** (`GLOW_FULL`): a few dozen
  points with no amounts were weighed at a tenth each and could not be found
  from the world view (item 41).

## Round of 22 September (2): the box refiled, rows taken out

The owner sent 44 items; this round is the filing and removal ones (1, 2, 3, 5,
6, 8, 9, 10, 11, 12, 13, 19, 20, 27, 28, 31, 33, 35, 38 and the headings of 39).

- **Catalogue rows are filed by title and id only.** `catalogueRows` used to
  add each row's long description to the words the rules read, and a passing
  word there filed rows under subjects they are not about: the drivers of tree
  cover loss under Fire (fire is one driver), dams and protected areas under
  Fire, oil and gas concessions and intact forest landscapes under Mining.
  Trase's rows still carry their own `fileBy`.
- **`CATALOGUE_BY_TITLE`**, read before `CATALOGUE_PLACES`, against the title:
  the first match decides and its paths are the row's only homes; `null`
  takes the row out (`(taken out)`, listed in the console). It holds the
  owner's placements by name. Titles are matched by words, not ids, because
  the ids could not be read from here; `node map/filing-report.mjs [words]`
  reads both catalogues live and prints what each rule caught and where every
  row lands. **Run it after any change to the rules.**
- Taken out by name: annual surface temperature anomalies; burned area in
  protected areas (WDPA); burned area in Indonesia / Equatorial Asia /
  Malaysia / Borneo; intact forest landscapes other than the worldwide one.
  Burned peatland and the peat-burning emissions are not taken out.
- **A Global Forest Watch row found to have nothing to draw leaves the box**
  (`catalogueRowGone`, 8 s after saying why). The asset list is meant to keep
  such rows out from the start; the owner seeing "has not finished making
  them" means the list was not read in their browser. Each kind is now read on
  its own, twice if the first try fails, with 60 s a page.
- `hotspot` in the Fire rule no longer catches biodiversity hotspots.
- Climate: carbon bombs, the Carbon Majors and Banking on Climate Chaos under
  Carbon dioxide ("Companies and financiers" under Climate is gone); Nitrous
  oxide holds Soy, Corn and Grain; Infrastructure emitting more than one gas
  now takes oil and gas concessions (also under Oil and gas drilling).
- Pollution by pollutant: General and all pollutants (Climate TRACE air
  pollution until it is split per pollutant, EPA toxic releases), Nitrogen
  dioxide (moved from Climate), Wastewater, Plastics, Oil spills and slicks.
- Biodiversity loss > Fish holds dams. Forest greenhouse gas emissions is
  under Deforestation only, as asked ("move"). The Scribd document is in
  `PANEL_REMOVED`.
- The drivers of disturbance alerts row now files under Deforestation > Tree
  cover loss and alerts by its title (it had been under Mining through its
  description).

Still to do from the list: legends and colour for the driver layers and
DIST-ALERT at the world view (21, 32, 34, 36), visibility of mining outlines
and vessels (37, 41), dots at every zoom (25), LIVE / NOT LIVE marks (43), the
Climate TRACE pollutants as rows (39), the layers that do not draw or are too
slow (4, 7, 14-18, 22, 23, 24, 26, 29, 30, 40, 42, seas of plastic), soy and
corn emissions (24) and D-Waste (44).

## Concessions filed by what they are for; "Land held under permit" retired

Asked for on 22 September. `CATALOGUE_PLACES` no longer has a generic permit
heading: a concession or permit goes under its material or activity - timber,
logging, pulpwood, forest utilisation (PBPH), forest clearance (FCA) under
Deforestation; mining (and coal, nickel, bauxite, gold) under Mining; oil and
gas and geothermal under the Oil and gas drilling heading; oil palm, sugarcane
and plantation land-use rights (HGU) under Agriculture. A new heading **Other**,
last under Of the planet, takes what no heading covers: rubber (asked for by
name, so it is taken out of Agriculture even though its rows say plantation),
"Concessions of other kinds", the Merauke National Strategic Project rows, and
any permit whose words name nothing (`cataloguePlaces`' last check). Trase's
pulp measures reach Deforestation through `\bpulp\b`.

## SkyTruth as tiles, and the copy in pieces (22 September)

After two runs the violations feed's single file was 86 MB, the spill reports
68 MB: near GitHub's limit, and a browser read all of it to draw a point. Two
changes in `culprits-tiles-more`:

- `scripts/skytruth.py` keeps each feed's copy in 256 pieces,
  `skytruth/<name>/<hh>.json` ({id: feature}), an alert filed by `shard(id)`
  (FNV-1a, two hex digits). An old single file is folded in and removed on the
  first run. The size pause is gone; history walks on. Biggest piece today:
  0.5 MB.
- `scripts/skytruth_tiles.py` (run after it: "skytruth skytruth_tiles" in the
  workflow's box) builds `tiles/<row id>.pmtiles` per feed: every placed alert
  at every zoom, merged into counted points where they crowd, nothing dropped;
  a point carries id, title, date. `tiles/<row id>.build.json` records the
  counts and what the tiles were built from, so unchanged feeds are not rebuilt.

In the map the eleven rows are `route: "pmtiles"` with `boxes:` naming the
copy's folder. `addPmtilesLayer` with `cfg.boxes` binds `pieceBox`: a merged
point says its count; a single one reads its piece (`readPiece`, cached) and
shows the record's own `_html` and then every other field. The row's line
comes from the build record: placed alerts, and how many in the copy have no
position. Built here on the real copies: spill reports 32,745 alerts, 15.9 MB of
tiles; every feed under 16 MB.

## Global Forest Watch: the asset list, COGs drawn, downloads-only rows gone

Continued the same day, from the owner's live look (404s, 422s, rows that
could only ever be downloads):

- `addGfwMenuLayer` reads GFW's asset list at the start, four requests
  (`/assets?asset_type=...`, one per drawable kind, paged), and `gfwAssetIndex`
  keeps each dataset's latest version's assets. Ticking a row no longer asks
  `/latest` (which was the 404 for datasets with no version marked latest); if
  the index cannot be read, the old per-tick path runs, now falling back to the
  dataset's version list when `/latest` is 404.
- **COGs draw**, through `tiles.globalforestwatch.org/cog/basic/tiles/
  WebMercatorQuad/{z}/{x}/{y}.png?url=s3://...` - the service GFW's own map
  uses, checked from outside (200, image/png). That is DIST-ALERT, the
  integrated alerts, WRI/Google drivers, the wur "class" layer. A picture, not
  clickable, in the service's own colouring.
- **Zooms come from the asset's record** (`creation_options`/`metadata`
  min_zoom, max_zoom; 0-12 if absent). Asking past them is what GFW answered
  with 422. A 422 that still arrives is said on the row; a 404 for a tile is
  an empty square and is ignored.
- **Datasets with nothing drawable** (only a GeoTIFF tile set, or nothing) get
  **no row**, at the owner's request. This is the one place the "nothing is
  left out" rule is set aside, by the owner: a row that can never draw. Their
  ids go to the console and their count to the catalogue's own row.

## Global Forest Watch datasets that drew nothing

Read from the asset lists the owner pulled (21 September):
- A dataset can list a tile cache that is still **pending** (`tsc_drivers`); it
  has no tiles. Only `saved` assets are drawn from now (`gfwPickAsset`).
- Where both exist, the **static** vector cache is used before the dynamic one,
  which is generated per request and slow (mining concessions). Where only a
  dynamic one exists (`pangaea_global_mining`) the row says it fills in slowly.
- Several have **no tile cache at all**, only GeoTIFFs and COGs on S3:
  DIST-ALERT (`umd_glad_dist_alerts`), the integrated disturbance alerts, the
  drivers of disturbance alerts (`wur_alert_drivers`), WRI/Google drivers of tree
  cover loss. Their rows now say so, and the two DIST ones point at the row that
  already draws those alerts through the Worker. Global Forest Watch's own map
  draws these from the COGs through a tile service; whether that service answers
  an outside page is being checked with one request before anything is built.
- A dataset with no title (`pangaea_global_mining`) is titled in `GFW_TITLES`
  where what it is can be shown; any other says it has no title.

## Tang & Werner 2023, built; what it carries

`tiles/mine_features.pmtiles` (62 MB, one file): 74,548 outlines, 74,547 with
their own outline at zoom 13. Its columns are OBJECTID, Name, Shape_Le_1 and
Shape_Area - **no commodity and no impact figure**. `Name` has 31 distinct
values over all 74,548 outlines, mostly digitising leftovers ("Placemark",
"polygon" in Chinese) with a handful of real hints (Au, Cu, Fe, diamond,
chromite, coal, tungsten, nitrate). The owner's condition for a map row was
that it carry commodities or impacts; it does not, so no row has been added.

## The wires: two place filters

Region and Country only, from the same day. Within (the feeds' sub-regions) is
in `HIDDEN_ROWS`: still read, still on each story's place line, still used to
read a country off a story with no place, but not a row.

## Round of 21 September: what the owner found on the live map

- **Four headings read "none yet" with dozens of rows under them.** The count
  looked only for ordinary rows and was taken once, before the catalogues
  answered. `countHeadings` counts catalogue rows, their copies and the site
  maps' type rows too (`ROW_TICKS`), leaves out the hidden holder, and runs
  again whenever such rows arrive.
- **A catalogue row that failed said nothing.** `put()` reported to the
  catalogue's own row, which is out of sight. `rowSay(key, text)` writes to the
  row (and its copies): finding its tiles, drawn from vector or picture tiles,
  no tiles published, could not be read, tiles not answering. Still to find out
  why four Global Forest Watch datasets draw nothing (the two DIST-ALERT ones,
  the PANGAEA mining one, WRI/Google drivers of tree cover loss): the owner was
  given a command that lists those datasets' assets.
- **A description behind an "i".** Catalogue rows carried their description as
  the whole row's hover text; ordinary rows' `note` was shown nowhere.
  `infoMark(text)` puts a small i beside the LIVE and source marks; hovering or
  focusing it shows one floating box (`#row-tip`, fixed, so the scrolling box
  does not clip it). A click on it does not tick the row.
- **Nusantara's layers, legible.** Every ticked layer shows the server's own
  key under its row (`GetLegendGraphic`; removed if the server has none). Its
  pictures pass through a new `seen://` protocol where the server lets a page
  read them (asked once per server): near-black pixels - the server's default
  outlines, invisible on the dark atlas - are redrawn in bone, and at zoom 7
  and wider every drawn pixel grows into the empty ones round it in its own
  colour, so scattered small areas show from the world view. A layer's own
  colours are never changed.
- **The wire box: one Country filter.** Feeds carried Region > Within > Place,
  and Place only opened after the other two were chosen; it never offered the
  United States or Canada, which the feeds file under Within and split into
  parts below. Map wires carried a separate Country. Now every subject carries
  one flat Country (`key: 'country'`): feeds derive it from their place ids
  ("ke", "us-sw" -> US) and, failing that, from a Within that holds one
  country's places; a country's parts stay as options beside it ("United
  States: Southwest"); a place that is no country ("Horn of Africa") keeps its
  name; space's free-text places are filed under the country they name or end
  in. Place is gone; Region and Within stay. Capture's Country no longer waits
  for a Within.

## Nusantara: two of the five unnamed layers named

From Nusantara Atlas's own menu, read off their site by the owner (21 September):
`concessionfca_spv` is "Forest Clearance Authority (FCA)" and covers Papua New
Guinea (a rule in `NUSANTARA_WHERE` says so); `millopbufferol50km_spv` is their
"Near palm oil mills" at 50 km. Still unnamed, because nothing confirms them:
`concessioncma_spv`, `millopbufferol_spv` (their menu has 10, 25 and 50 km and
this id carries no distance) and `millopbufferpolyloreal_spv` (the owner wonders
whether it is L'Oreal's supplier mills; unconfirmed).

## Three site maps split into a row per type

The plants, microorganisms and insentient maps have no control that sorts their
places; what kind of company a point is appears only in its popup, as
`<span class="tag">`. `build_boxes.py` (`popup_types`) reads that tag into the
places file as an ordinary filter marked `"rows": true` - for the maps the
registry flags `types_from_popup_tag`, and only where nearly every place has a
tag. Six more site maps tag their popups the same way (world news, advertising,
entertainment, research integrity, indigenous conflicts, self-sufficiency) and
would split as cleanly; they were not asked for, so they are not flagged.

In the box (`siteTypeRowsFor`, run by `readSiteTypeRowsAtStart`), a map with
`typeRows: true` gets a row per type in place of its one row, titled
"<type> - <map name>" with its count. Underneath it is still one layer: the
ticked types are that map's filter, no type ticked means the map is off, and
"All on"/"All off" tick the hidden row, which every type row follows. The
hidden row's transparency slider goes out of sight with it.

The places files are rebuilt by the `sitemaps` job of the refresh workflow in
`culprits-tiles-more`, which only runs when the box is left empty (or at 06:17
UTC). Until then the three maps keep their one row: the code falls back to it
when a places file has no `rows` filter. Checked in a headless browser against
the real rebuilt file for plants: 7 rows, ticking two draws those two, unticking
both turns the map off, All on ticks all seven.

## SkyTruth Monitor's alert feeds

The feeds are numbered. Asking the service for feeds 1 to 30 and 10095 to 10110
(20 September) found nine with alerts - 1, 2, 3, 4, 5, 6, 8, 9, 10 - plus 10101,
a developer's test entries ("This is dan's house"), left out, and 10102, Vessels
of concern. Each of the nine is a `geojsonlive` row reading
`culprits-tiles-more/skytruth/feed_<n>.geojson`, filed by subject: National
Response Center reports under Terrestrial slicks and Pollution; SkyTruth's own
write-ups under both slick headings; responders' marine reports under Marine
slicks; Pennsylvania permits, drilling starts and violations, the county well
permits and FracFocus under a new heading, **Oil and gas drilling**; earthquakes
under Base and reference.

Two things about the service, both found the hard way:

- It returns **the 100 newest alerts for the area asked, never more**, whatever
  `n` says. `scripts/skytruth.py` therefore asks area by area - the world, then
  the four quarters of any area that came back full, six levels down - and
  writes any square still full at the bottom into `skytruth/feeds.json`.
- It **does not apply `d` (days)**. The Vessels row said "last 30 days" and
  never was; it holds ships from 2019. The row now says what it is.

Each run adds to the file already there, matched on SkyTruth's own alert id, so
nothing gathered is lost when it drops out of the newest 100. An active feed's
file will grow (the National Response Center takes roughly 70 reports a day);
past about 20 MB it should move to tiles, as the slick archive did. Alert text
is SkyTruth's HTML and is cut down to plain formatting and http links before it
is kept (`clean_html`): feed 10101 shows anyone with an account can write one.

Several feeds look dormant - the newest seen were July 2015 (earthquakes),
December 2011 (county well permits), 2013-14 (SkyTruth's write-ups, marine
reports). `feeds.json` records each feed's oldest and newest after every run.

Test 1773 used to forbid naming a layer twice in `PANEL_ORDER`; the box has
made the second naming a copy for some time (`copyRow`), so the test now checks
that instead.

### Nothing excluded (asked for the same day)

The owner asked that nothing SkyTruth publishes be left out, all four things the
first version dropped:

1. **The back history.** No depth limit now: a full area is quartered until it
   is not full, down to a square the size of a building. A busy feed needs
   thousands of requests, so each run spends at most 600 per feed
   (`SKYTRUTH_REQUESTS` changes it): first what is new, stopping at any full
   area whose 100 alerts are all in the copy already; then history, from the
   areas left waiting in `feeds.json` (`todo`). `history_complete` says when a
   feed is done. On the 1st of each month the walk skips the shortcut, in case
   an alert was added late under an old date.
   **What still cannot be reached:** more than 100 alerts at the very same
   point (reports pinned to a town's centre). `feeds.json` lists them as
   `stacked`. Only a date option on the service would reach them; none found.
   **Size:** at 60 MB a feed's history pauses (new alerts still added) and the
   log says the feed needs tiles. Expect that for the National Response Center.
2. **Feed 10101**, the developers' test entries, is a row (`skytruth_tests`,
   under Base and reference), titled for what it is.
3. **Alerts with no position** stay in the file with no geometry;
   `readGeojsonFiles` counts them and the row says how many.
4. **Pictures** in an alert's text are shown, with only their address kept.
   The one thing still cut is `ga.php`, an invisible 1-pixel counter that
   reports each reader of the map to SkyTruth's analytics - not a picture and
   not data. The untouched text is in each alert's `content`.

## The catalogues were never being read

Nusantara's and Global Forest Watch's layers became rows of the box, and their
own two rows were put out of sight (`PANEL_REMOVED`). But both are `lazy`, and a
lazy row is built only when it is ticked - so nothing ever asked either source
for its list, and the several hundred rows never reached the box unless
**All on** happened to tick the hidden rows as well. `readCataloguesAtStart()`
now runs at the end of `arrangePanel` and builds every hidden catalogue row
(`CATALOGUE_ROUTES`: `wmsmenu`, `gfwmenu`, `trase`). Reading a list draws and
ticks nothing.

## Trase's measures: one row per measure, every country at once

Asked for on 20 September in place of one row with three menus. `traseMeasures`
turns Trase's catalogue into one entry per measure (86 today) across every
country that publishes it; each is a row of the box through `catalogueRows`,
titled "Deforestation (ha) - Argentina, Bolivia, Brazil, ... (Trase)" and filed
by Trase's own name, group and commodity for it (`fileBy`), not by its tooltip,
which mentions water and regions in passing and sent rows to the wrong headings.
"GDP per capita - Colombia" is the one measure no rule claims; it waits under
Not yet placed.

- A country is drawn at one region level at a time, or the same ground would be
  coloured twice: municipality where Trase publishes the measure at that level,
  otherwise the first level Trase lists. This is the default the single row
  already used. The row's **level** menu overrides it for every country.
- The **year** menu defaults to the latest year each country has, since they
  stop in different years (Brazil 2024, Paraguay 2019). Asking for one year
  leaves out, and names in the row's state, any country with nothing for it.
- One set of colour steps across every country drawn. A Brazilian municipality
  and an Argentine department are different sizes, so totals (hectares, tonnes)
  compare like with unlike across a border; that is Trase's data, not a fault.
- Two measures Trase gives the same name carry Trase's own id in brackets.

A trial run in node against the real values (stand-in shapes, since
resources.trase.earth is not reachable from the sandbox): Deforestation drew
6,698 regions in 8 countries. **Not yet seen on the real map.**

## The right-hand column: three things that went wrong together

The news wires box is pinned between the bottom of the right column and the
bottom of the screen, so it is often only 350 px tall. Three faults met there:

- `trackBoxHeights` placed the wires box by adding up the view box's height
  alone. Once the reload row joined the column above it, the wires box started
  that much too high and sat over the last rows of the column. It now measures
  to the bottom of `.right-col` and watches the column itself.
- Basemap was the last section of a box that stops at 48vh and scrolls, so its
  three choices were below the edge and the heading looked empty. Basemap now
  comes first (`basemapPanelHtml`), View under it.
- The filters could take 34vh and the stories were left 60 px. Every filter and
  the time window now sit behind one **Filters** row in `wire.js`, shut until
  asked for and remembered; the row says what is set ("Region: Africa - Last 7
  days"), so a choice put away is still in view. Open, the filters sit two to a
  row and scroll inside two fifths of what the fixed rows leave; the stories
  keep three fifths (`layout()` measures both). This is one fold for the lot,
  not the per-subject folds that were taken out earlier.

Checked in a headless browser against the live wires at 1440x800 and 1280x680:
before, the wires box overlapped the column by 42 px and the stories had 60 to
120 px; after, no overlap and 166 to 228 px with the fold shut.

## The mines are several archives, not one

GitHub refuses any file over 100 MB, and the mine outlines to zoom 13 weigh more
than that; the single archive had to stop at zoom 11. `scripts/mines.py` in
`culprits-tiles-more` now tiles the outlines once, to zoom 13, and cuts the
result into as many files as it takes: `tiles/mining_polygons.pmtiles` (the
points, and the first zooms of outlines), then `mining_polygons_2.pmtiles` and
so on. It cuts by zoom; a single zoom too big for one file is cut in two down a
line of longitude. It counts the tiles in the files against the tiles it made
and keeps nothing if they differ. `tiles/mining_polygons.build.json` lists the
files and the zooms each holds.

`addPmShapesLayer` reads that list (`pmShapeParts`) and gives each extra file
its own source and outline layer, drawn only at that file's zooms - otherwise
the file below stretches its last tiles over the finer ones and every outline
is painted twice. The extra layer ids go in `cfg._layerIds`, so the row's tick
switches them. If the list does not answer, the first archive draws alone, as
it always did, so the map and the tiles repo can be updated in either order.

## Live Projects to Resist, drawn here rather than opened beside

Its panel row is gone. Three rows under Construction carry what the panel
added: `love_wire` (its news wire, read live from the map's own
`wire_geo.json`), `love_trackers` and `love_guides` (country layers built daily
by `build_shapes.py`). Its project cards are the same records as
`local_projects`, so that row stands and nothing is drawn twice, and its Earth
First! archive is text with no positions, so nothing of it is placed.

Nothing of it is a row here any more. The wire belongs in the wires box, and
the tracker lists and the country guides were taken off at the owner's request;
its project cards were always the Development projects row. `love_trackers` and
`love_guides` are marked retired in the shapes registry and their published
files are removed by `scripts/retire.py`. The `country_docs` kind stays, unused
until something wants it.

`love_guides` uses the `country_docs` kind, which reads the ISO3 index inside
the map's own page (`LKA:{file:'srilanka.md',pdf:'...'}`) rather than GitHub's
tree API: unauthenticated tree calls are refused after sixty an hour on a
runner, which would empty the layer on a normal day.

The wire places a story by matching its words against place names, not from a
coordinate in the story. Weak matches happen (a story about Iowa sits near
Geelong), so every box shows what it matched on and its score.

---

## Where the archives live, and why they are spread across repos

A published Pages site is capped at 1 GB, so the archives sit in whichever repo
has room, each with its own Pages site:

- `culprits/map/tiles/` — the small ones and anything the map needs at once.
- `culprits-tiles-more` — most of the daily-rebuilt archives, shapes, sitemaps.
- `culprits-buildings` — the building archives (about 700 MB), one per kind.
  Rebuilt weekly there by `scripts/building_types.py`, which runs this repo's
  `pipeline/building_types.py`. Each save replaces that repo's history with one
  commit, so it stays the size of what it publishes.
- `culprits-tiles-ag` and `culprits-tiles-flu` — the Climate TRACE agriculture
  and forestry archives, too big for the first repo.
- `culprits-tiles-gov` — the government-building archives the separate rows
  read. Those rows are inside Buildings now, so most of it is unread; worth
  clearing when that repo starts to matter.

The map finds each kind of building beside its summary (`base` in
`addBuildingTypesLayer`), so moving the set again means changing `summaryUrl`
alone.

Layers taken off the panel are marked `"retired": true` in
`pipeline/shapes/registry.json`, so `build_shapes.py` stops rebuilding them,
and their published files are deleted by `scripts/retire.py` in
`culprits-tiles-more`. That freed about 483 MB of rows that had been merged
into Buildings or removed on request.

---

## How data reaches the map — five routes

Set per layer in `map/app.js` as `route:`.

**`pmtiles`** — a Python harvester pulls a source, `normalize.py` maps it to a
shared 8-field schema, tippecanoe tiles it into `map/tiles/<id>.pmtiles`.
Actions refreshes weekly. For located things: plants, mines, facilities.

**`country`** — a country-level choropleth from a small JSON in `map/data/`.

**`worker`** — the Worker proxies a keyed or CORS-less API per viewport and
returns GeoJSON in the shared schema. For live queries where a key cannot sit
in page source.

**`tile`** — the Worker proxies an upstream's own tile endpoint per z/x/y and
passes the bytes through. For a continuous field rather than located things,
and for upstreams whose per-request endpoint is quota'd beyond what a public
page can satisfy.

**`wmts`** — the map fetches raster tiles straight from the publisher, no
Worker. Only where there is no key to hide and the host sends CORS.

---

## Layers, and the state of each

**Working**

| Layer | Source | Route |
|---|---|---|
| National CO₂ emissions | Our World in Data | country |
| Land deals | Land Matrix | country |
| Carbon bombs | Data For Good / carbonbombs.org | pmtiles |
| US toxic release sites | EPA Envirofacts TRI | worker |
| Permitted animal feeding operations (US) | EPA Envirofacts CAFO | worker |
| Fishing effort | Global Fishing Watch 4Wings | tile |
| Deforestation alerts — tropics | GFW integrated (GLAD + RADD) | tile |
| Disturbance alerts — global, 30 day | GFW DIST-ALERT | tile |
| Disturbance alerts — global, 365 day | GFW DIST-ALERT | tile |
| Livestock density × 6 species | FAO GLW 4 | wmts |

**`ready:true` but archive missing** — `power_plants` and `gem_coal` have
harvesters and registry entries, but `map/tiles/` contains only
`carbon_bombs.pmtiles`. They show "archive missing" until the refresh workflow
runs and commits them.

**`ready:false`, no harvester, no data** — `carbon_majors`,
`fertilizer_facilities`, `soy_organizations`. These came from my separate maps
repo; neither the archives nor a way to rebuild them is in this repository. They
are marked unbuilt rather than left as rows that always fail. To restore them I
need to supply the `.pmtiles` files or the source data.

**`ready:false`, written, partially run** — `climate_trace`. See below.

---

## Worker routes

    /v1/gfw?bbox=&z=              deforestation via the Data API (unused — see below)
    /v1/fishing?bbox=&z=          4Wings report (kept for one-off analysis, not used by the map)
    /v1/epa_tri?bbox=&z=          EPA Envirofacts TRI
    /v1/epa_cafo?bbox=&z=         EPA Envirofacts V_ICIS_FACILITY_CAFO
    /v1/landmatrix?bbox=&z=
    /v1/fishing_tile/{z}/{x}/{y}  fishing heatmap; ?format=MVT available
    /v1/gfw_tile/{z}/{x}/{y}      alerts; ?kind=integrated|dist|glad_dist &days=N

Diagnostics, read-only, key never leaves the Worker:

    /v1/_diag                     build stamp, secrets visible, cache version
    /v1/_gfw?path=                GFW Data API passthrough
    /v1/_gfwexample               GFW's own documented example, verbatim
    /v1/_epa?path=                Envirofacts passthrough
    /v1/_fishing_mvt/{z}/{x}/{y}  decodes a real MVT tile: source-layer, property keys
    /v1/_fishing_report_status    what the GFW account's single report slot is doing
    /v1/_gfwtiles                 GFW tile-cache routes + whether alerts have a tile asset

`/v1/_diag`'s `routes` list shows only the four bbox routes — the tile routes
are handled earlier and don't appear. Small honesty gap; fold into the next
Worker change.

---

## How the recent layers were built, and the reasoning worth keeping

**Fishing effort — a quota can be account-wide, not connection-wide.** It used
to query `/v3/4wings/report` per viewport and 429'd on almost every pan. Not a
pacing bug: GFW allow one concurrent report *per user account* — not per token,
not per browser — shared across every visitor, with reports running
asynchronously up to 100 s. The in-flight guard, 600 ms debounce and 8 s backoff
were correct engineering aimed at the wrong layer; they'd have worked in solo
testing and failed the moment two people opened the page. Fixed by moving to
`/v3/4wings/tile/heatmap/{z}/{x}/{y}`, which has no report queue. **Before
building a queue, check whether the limit is even per-client.**

**Deforestation alerts — the analysis endpoint was never the render path.**
`POST /dataset/gfw_integrated_alerts/{version}/query/json` returned
`500 {"message":null}` for months, including for GFW's own documented example.
It computes over one area of interest — which is why it wants a tiny polygon and
a date filter and still falls over. WRI run a separate tile service,
`tiles.globalforestwatch.org` (`wri/gfw-tile-cache`), which is what GFW's own
map renders from. Its route is in no documentation and its docs page is
client-rendered, so it was read out of the repo's source:

    GET /gfw_integrated_alerts/{version}/dynamic/{z}/{x}/{y}.png
        ?start_date=&end_date=&render_type=true_color&alert_confidence=low

The handler takes no auth dependency — **no API key**. `version` accepts
`latest` directly. `render_type` defaults to `encoded`, which bit-packs date and
confidence into RGB for client-side decoding; omitting `true_color` renders as
noise.

**Three alert layers, because they do not cover the same planet.** Integrated
alerts combine GLAD-L, GLAD-S2 and RADD, all **pan-tropical by design**. That is
why the layer lights up the Amazon, the Congo and Southeast Asia and shows
nothing in British Columbia or Siberia — a stated extent, not missing data.
Without saying so, a reader would reasonably conclude the boreal forest is
untouched. The two DIST-ALERT layers are global and show temperate and boreal
clearing. Kept separate rather than merged because they detect different things
by different instruments.

**Tile failures are served as transparent PNGs.** The upstream 500s on
individual tiles (z6/11/22 among them) and MapLibre turns any non-200 raster
response into an `AJAXError` that reads as a broken map. The Worker returns a
1×1 transparent PNG with `X-Upstream-Status` and `X-Upstream-Note` headers, so
the failure stays visible to anyone checking without being visible to everyone.

**Alert and GLW rasters start unticked (`off: true`).** A raster that fails to
render covers the viewport in a flat wash — that is what hid every other layer
once. One broken upstream cannot take the map down with it.

**Climate TRACE is monthly, and that shapes everything about it.** Every row is
one month for one source, not one facility — 300,000 sampled rows of
`confined-animal-facility` held 4,546 distinct `source_id`s, 66 rows each. The
periods are 2021-01 to 2026-06, 66 exactly. Without a month facet the map stacks
66 coincident dots on every facility and the popup shows one arbitrary month
with no date on it.

Measured, not estimated: 12 months tiles to 1,132 MB with a 375 KB world tile —
past GitHub's 100 MB file cap, and a world tile every visitor downloads before
seeing anything. 112M features need ~10 GB of tippecanoe scratch, and tippecanoe
ignores `TMPDIR`; it needs `--temporary-directory` explicitly. Any 28 KB
`climate_trace.pmtiles` is a truncated husk — delete it, because
`addPmtilesLayer`'s HEAD check will accept it as real.

So: the current month ships in the repo at ~95 MB, and the past ships per year
on R2, off by default, through the layer group described below.

**Layer groups are built and tested, and dormant until R2 has archives.**
`CT_HISTORY_YEARS` in `map/app.js` is an empty array. Add `"2024"` when
`climate_trace_2024.pmtiles` is on R2 and the group appears; with no years the
parent row is not rendered at all. Per year rather than one history file because
PMTiles loads a header and index per archive, so one multi-gigabyte file makes
every reader pay for an index spanning all years, an unticked year costs nothing,
one year tiles successfully where all years exceed a runner's disk, and a
finished year never needs rebuilding.

Three things in it worth not undoing:

- **Lazy.** A year's source and layers are created on first tick, in
  `ensureLayer()`. Nothing is fetched for an unopened year. A failure clears the
  created flag so a slow R2 response does not kill the row for the session.
- **Tri-state parent.** `syncGroupBox()` sets `indeterminate` for partial
  selection. A parent reading "on" while two of six children show is the same
  failure as a cluster popup inheriting one member's name: the control states
  something the map does not show.
- **Facet values come from the archive, not from `CT_MONTHS`.**
  `learnFacetValues()` reads tippecanoe's recorded per-attribute values out of
  the tile metadata, so a year archive offers its own twelve months. This is the
  fix for both directions of the hardcoded-list problem: `CT_MONTHS` ends at
  2026-06 while `refresh.yml` runs weekly, so a new month would be harvested and
  never offered; and a 12-month build would make the constant offer 54 months
  that render nothing. Note the metadata path is UNVERIFIED — no archive exists
  to read yet. On failure it logs and the declared list stands.

**EPA CAFO — CLOSED, the table is gone.** The route was written against
`V_ICIS_FACILITY_CAFO`, a name taken from EPA's metadata pages because those
pages disallow automated access. It has now been tested against both live
services and both reject it:

    data.epa.gov/efservice/V_ICIS_FACILITY_CAFO/ROWS/0:10/JSON
      -> "The table is not available."
    enviro.epa.gov/enviro/efservice/V_ICIS_FACILITY_CAFO/zip/72655/rows/0:2/JSON
      -> "The table is not available."   (after following the 301)
    data.epa.gov/dmapservice/icis.v_icis_facility_cafo/1:10/json
      -> "The table, icis.v_icis_facility_cafo was not found."

EPA still documents the view and publishes a sample URL for it, so the name is
right and the view has been retired from the live services while its
documentation page stayed up. Two hosts agreeing is an answer; do not try more
spellings.

The replacement is already in the map and needs no EPA route at all:
`climate_trace_cafo` draws confined animal facilities from Climate TRACE's own
`confined-animal-facility` definition via `sourceOf`, reusing the
`climate_trace` archive. Global rather than US-only, and modelled rather than
permitted — which the layer note says. If a permit register is still wanted
later, ECHO's CWA REST services draw on the same ICIS-NPDES database and take a
bounding box natively, but whether they expose animal head counts is unverified,
and the layer's unit depends on that.

**FAO GLW — no pipeline at all.** FAO serve WMTS with open CORS and there is no
key, so the map fetches directly. CC BY 4.0. Two quirks recorded in the code:
the tile template puts `TileCol={y}` and `TileRow={x}`, reversed from the usual
convention (swapping them to "fix" it returns wrong tiles); and FAO's own caveat
that lat/long display over-represents density at high latitudes.

---

## Climate TRACE — written, not yet run to completion

Six embeds collapse into this one layer. It took most of a session. What was
wrong, in order:

1. **The download URL was invented.** The old harvester scraped
   `climatetrace.org/data` for `(\d{4}).*global.*\.zip`. No such file exists,
   and that page builds its download list in the browser, so the scrape would
   have found nothing anyway. The real path came from listing the S3 bucket and
   probing candidates:

       downloads.climatetrace.org/latest/sector_packages/<gas>/<sector>.zip

   **The gas segment comes BEFORE the sector.** In no documentation, and what
   every wrong guess got backwards. Verified live: `co2e_100yr/power.zip` → 206,
   `power/co2e_100yr.zip` → 404. The third-party downloader search turns up
   first (`liamlaverty/climate-trace-data-downloader`, last touched 2023) uses a
   path that is now dead.

2. **It read the wrong files.** Each package holds three kinds of CSV:
   asset-level emissions, asset-level *ownership*, and *country-level*
   emissions. The old code read all three as emissions. Now each CSV is
   classified by the columns it actually has — coordinates *and* a quantity —
   rather than by filename, which has shifted between releases.

3. **It ran out of memory.** Sized on `power.zip` at 26.5 MB; `agriculture.zip`
   is **1,424 MB**. It loaded whole archives with `.content` and held every
   parsed row. Killed nine minutes in, locally and on the runner. Now streams to
   a temp file and parses row by row.

4. **Most "sources" are not places.** A test run returned *"Vaca Diez
   Province"* — a whole province as one dot — and agriculture reports 59.8
   million "sources", which are model grid cells, not farms. A layer calling
   those "emitting assets" would state something false.

5. **So precision travels per feature**, read from Climate TRACE's own schema
   (`latest/about_the_data/detailed_data_schema.csv`), whose third column
   `2026_asset-definition` is the distinguishing field, keyed on
   `(sector, subsector)` — both present in the data rows:

       confined-animal-facility        → asset  (solid dot)
       pasture-land-gadm-0-1-2         → admin  (hollow, "not a facility")
       crop-residues-grid-9km-by-9km   → grid   (hollow, cell size in popup)

   Parsed positionally, because the header repeats `sector` and `subsector`
   later in the row and `DictReader` silently keeps the last of each.

6. **All caps removed.** An earlier version kept only the largest emitters until
   95% of each sector's total, under a 60,000-feature ceiling. Those interacted
   and produced a layer carrying **41.7%** of the emissions it claimed to show —
   a figure nobody chose. Removing the cut removed the sorting and the heap with
   it: `fetch()` is now a generator yielding every row, and `harvest.py` writes
   rows one at a time so a harvester may return a generator rather than a list.
   Only rows with no coordinate are dropped, and the count is printed.

7. **The pipeline is gzipped and streaming end to end**, because ~99 million
   features is roughly 30 GB per intermediate and there are two.
   `data/raw/<id>.jsonl.gz` and `data/normalized/<id>.geojsonl.gz`; tippecanoe
   reads gzipped GeoJSON natively. `normalize.py` streams line by line instead
   of `json.loads(read_text())`.

**Where it stands:** the harvest was running locally and its output size is the
open question. ~16 GB free here; a GitHub runner has ~14 GB. If
`data/raw/climate_trace.jsonl.gz` came out above about 5 GB, the answer is
per-sector archives — eight layers instead of one, peak disk becomes the largest
sector rather than the sum, and still nothing dropped.

Also unknown: final `.pmtiles` size. GitHub caps a file at 100 MB; the refresh
workflow already routes oversized archives to R2, whose free tier is 10 GB.

---

## Standards I hold to

**No fabrication.** Provenance for every layer is in `sources.json`, and
rendering must never manufacture a claim. Carbon Bombs has 92 country centroids
among 425 rows, so `precision` travels per feature and centroids render hollow
with a popup saying so. Clustering was removed because a merged feature
inherited one arbitrary member's name and owner — the global dot reported
1,182 Gt as a shelved Canadian coal mine. EPA stores longitude unsigned, so
every US facility plotted in Asia until that was caught.

**No editorial filtering in the pipeline.** Everything the source publishes is
harvested; filtering happens in the map panel where the reader can see and
change it. This is why the Climate TRACE caps came out.

**No pinned URLs.** Every harvester exposes `resolve()` and finds its current
download URL each run.

**Units are never combined.** Each feature carries its own unit.

**A degraded layer beats a blank one, if it says so.** The fishing colour ramp
comes from `/4wings/bins` per zoom; when that fails the Worker draws with a
fallback ramp and reports it in `X-Ramp-Source` rather than throwing. Wrong
thresholds are visible and fixable; a missing layer looks like the source is
down.

---

## Publish blockers (`sources.json`, `_publish_blockers`)

Neither blocks building; both block going public.

- **Carbon Bombs** — `dataforgoodfr/CarbonBombs` declares no licence, which
  defaults to all rights reserved. Underlying GEM trackers are CC BY 4.0 and the
  project list is from Kühne et al., *Energy Policy*. Contact
  hellodataforgood@gmail.com.
- **Land Matrix** — the mirror states two licences for the same data: README
  says CC BY-SA 4.0, its `datapackage.json` says CC BY-NC 4.0. Built against the
  stricter reading.

Climate TRACE's licence has been corrected in `sources.json` to **CC BY 4.0**,
terms at climatetrace.org/terms.

---

## Basemap

Esri World Imagery + Esri World Hillshade + CARTO voyager labels, three raster
sources, graded down so data reads on top. Relief eases in with zoom. Labels sit
above the data.

**Not a full port** of the Leaflet atlas in my other map. That one tints with
CSS blend modes on DOM panes — green wash in soft-light, warmth in overlay, sea
in screen. MapLibre draws raster in WebGL and exposes only opacity, saturation,
brightness, contrast and hue-rotate. **There is no blend mode.** So relief and
grading carry over and the tinting does not; the result reads as graded
satellite with relief rather than the peakery/overworld look I asked for.
Getting the rest means a custom WebGL layer.

An earlier satellite attempt appeared to break the map and was reverted — the
visible symptom was a flat blue wash over everything, which turned out to be a
failing alert raster, not the basemap. A broken raster looks like a broken
basemap.

---

## Still to add — the queue

Verify each endpoint and licence from the source or its capabilities document
BEFORE writing anything. This project has lost hours to inferred URLs; see the
lessons below.

**My own repos — DONE.** Seven harvesters written and run live against
raw.githubusercontent; `probe.py` passes 7/7. They are `ready:false` in
`map/app.js` because no `.pmtiles` exists yet, not because anything is missing —
flip each to true once its archive lands.

| id | rows observed | route |
|---|---|---|
| `local_projects` | 401,100 across 826 tiles | pmtiles, `isolate:true` |
| `gmo_releases` | 43,741 | pmtiles, facet on register |
| `slavery_sites` | 7,552 | pmtiles |
| `slavery_ports` | 3,424 | pmtiles |
| `slavery_fishing` | 2,316 | pmtiles |
| `remains_records` | 4,020 | pmtiles, facet on posture |
| `slavery_cases` | 71 countries | country |

Two bugs came out of running them rather than reading them, and both are the
kind that succeed silently:

- **`remains`' `geo` vocabulary is `exact` / `coarsened` / `area` / `admin`.**
  `coarsened` is the ~5 km blur that repo applies to anything that *is* a burial
  location — 2,580 of 4,020 records. The first mapping did not know the word, so
  all 2,580 fell through to no precision flag and would have drawn as solid,
  precisely located graves. `precision` now fails unknown values safe to
  `unknown`, a `blurred` value was added to the three hollow lists in `app.js`
  with its own popup, and `map/test.mjs` asserts every precision value a
  harvester emits appears in all three lists.
- **CTDC case rows overlap.** Each country carries a grand total *and* a
  type-by-period breakdown that partitions it exactly — the US is 116,418 either
  way. Summing both double-counted every such country and gave a global 418,750
  that no source states. Correct figure is 209,375.

**guerillamap — DONE, and the overlay ids are verified.** `guerillamap.com/shortcuts`
publishes complete prefiltered URLs; the set in `app.js` is their Fossil Fuels
Infrastructure shortcut plus nuclear facilities and NASA FIRMS fires. The driving
mechanism was read out of `conflict-feed/index.html`, which already does this: their
app takes full state from `?coords=&zoom=&grid=&basemap=&overlays=`, one-way, with a
900 ms settle and a proportional south shift for their shorter frame. The panel starts
closed and is toggled from its own row. Some guerillamap layers sit behind a
membership — if one renders empty, check that before blaming the id.

**Cerulean — contract verified, not yet written.** skytruth.org/cerulean-api
redirects to a Colab behind a Google sign-in; the same notebook is readable at
`notebooks/Cerulean API Guide.ipynb` in `SkyTruth/cerulean-cloud`. Both maps are
one collection each:

    /collections/public.slick_plus/items    oil slicks
    /collections/public.source_plus/items   vessels and infrastructure

    ?bbox=&datetime=<start>/<end>&limit=<=9999&offset=&sortby=&filter=<CQL-2>&f=geojson

Default limit is 10 if unspecified. `source_type` is VESSEL / INFRA / DARK /
NATURAL; `source_collated_score` runs -5 to +5 and SkyTruth recommend >0.
**Slick geometry is MultiPolygon**, so the worker route's circle layer would
render nothing — `app.js` needs a fill/line branch before this can ship. Their
own bbox examples read west,north,east,south; send standard OGC order and check
the returned extent on the first live call. Licence still unread.

**Allen Coral Atlas — blocker cleared.** Exactly two feature types, from the WFS
GetCapabilities:

    coral-atlas:benthic_data_verbose
    coral-atlas:geomorphic_data_verbose

`ows:AccessConstraints` reads CC BY 4.0, `ows:Fees` NONE, GetFeature offers
`application/json`, DefaultCRS EPSG:4326, CountDefault 1,000,000. **Declared
extent is -32 to +32 degrees**, not the 30N-30S recorded earlier.

**Trase — licence verified, and the wanted dataset is not the obvious one.**
CC BY 4.0 for charts, graphics, maps and other representations of the data;
commercial use needs info@trase.earth, which does not bind this atlas. 190
datasets. The `supply-chains-*` sets are trade flow between subnational regions,
companies and destinations — a graph, not places, and geocoding it would invent
locations. The mappable ones are the **facilities** datasets: Brazilian
slaughterhouses and meat processing, Indonesian palm mills with UML ids, Ivorian
cocoa cooperatives, and about 9,300 Brazilian soy silos and processing sites with
ownership. Caveat for the layer note: the soy set was identified by an AI vision
workflow Trase state is over 90% accurate, so it is not a register and a share of
it is wrong. `trase.earth/open-data` is server-rendered and paginated, so
`discover.page_link()` can find the current datasets — but **the per-dataset
download URL has not been read yet.**

**PalmWatch — endpoint still unresolved, and the catchments need care.** IDI with
UChicago DSI. Over 2,000 geolocated mills in 32 countries, each carrying which of
13-15 consumer brands source from it, who owns it, and its RSPO status — it names
buyers, which little else here does. Each mill also has a catchment polygon at
roughly 50 km adjusted by road network, with 20 years of UMD tree-cover loss
overlaid and deforestation scores derived from it. **The catchment is a modelled
sourcing area, not a property boundary**, and drawing it beside an owner's name
asserts something the method does not establish; recorded as a publish blocker.
The site is client-rendered, so the download path has to come from its runtime
requests or its source — it is described as open-source, so look for the repo
first. Do not guess a path.

**Still unresearched — endpoint, format and licence all unverified:**

Several of these are web applications that fetch from a backend at runtime, so
they may have usable endpoints; flagged `check_runtime_endpoint` in
`sources.json`. Others unchecked: HydroFATE, Global Wastewater Model, SoilGrids.

**Banking on Climate Chaos** (`bocc`) — harvester exists, discovery returns
nothing because the download page is client-rendered. Same failure mode as the
Climate TRACE page, which was solved by listing the storage bucket rather than
scraping. Also not geocoded; needs sourced bank HQ coordinates. Do NOT use the
Carbon Bombs company file for those — its addresses were generated by ChatGPT.

**Not deployed anywhere:** `the-culprits-atlas.html`, a finished 479 KB
single-file document carrying all 17 sectors of prose and all 63 original
interactives with load-failure fallbacks. Separate from the map.

## Things that wasted hours — don't repeat them

**Check documentation before theorising.** The GFW 500, the fishing 422 and the
fishing 429 each cost several rounds of plausible guesses that reading the docs
would have avoided. The 429 was one sentence in GFW's own reference page.

**When documentation doesn't exist, read the source.** The GFW tile route came
out of `wri/gfw-tile-cache` on GitHub. The Climate TRACE path came out of an S3
bucket listing plus probing. Both were faster than guessing, and neither
produced a wrong answer.

**Global FISHING Watch and Global FOREST Watch are different organisations**
with different keys and different APIs. Their constants collided in the Worker
namespace and wouldn't compile; now `FISHING_4WINGS_BASE` and
`FOREST_TILES_BASE`.

**Three caches sit between a fix and the browser** — the browser, Cloudflare's
edge, and the Worker's own `caches.default`. Bbox routes send `no-store`,
`CACHE_VERSION` is in the cache key, `?fresh=1` bypasses the stored copy. **Bump
`BUILD` and `CACHE_VERSION` on every Worker change** and check `/v1/_diag`
before diagnosing anything. *Exception:* tile routes deliberately send
`max-age`, because a browser refetching every tile on every pan burns the daily
allowance.

**EPA Envirofacts silently ignores range filters.** Asking `tri_facility` for
latitude 33.9–34.1 returns Puerto Rico. Equality filters work, so the Worker
scopes by state (every intersecting state, merged) and applies the bounding box
itself afterwards. The CAFO route does the same.

**Compound assignment reads the left side first.** `p.i += pbVarint(b, p)`
evaluates `p.i` *before* the call advances it, so the cursor movement is
overwritten. This broke the MVT probe's protobuf reader.

**Don't size a pipeline on one measurement.** `power.zip` is 26.5 MB and
`agriculture.zip` is 1,424 MB — fifty-fold. Assume the large case.

---

## Tests — keep them passing

    node worker/test.mjs      # 99 tests, no network
    node map/test.mjs         # 71 tests, no browser
    python3 pipeline/probe.py # can each harvester still find its data

`.github/workflows/check.yml` runs all three on push. The JS tests stub their
libraries strictly and have caught real bugs: a `beforeId` naming a layer that
may not exist, cached responses replayed with the wrong
`Access-Control-Allow-Origin`, `parseInt` producing `zoom=NaN`, `app.js`
executing twice when `index.html` still carried an inline copy, and the protobuf
cursor bug above.

The DOM stub in `map/test.mjs` records event listeners rather than discarding
them, so the layer toggles are testable. Before that, no test could reach a
checkbox.

---

## Immediate queue

1. **Re-run `climate_trace` with the corrected classifier.** This is the live
   correctness problem: the previous run put 51.6 million rows in the `asset`
   class, including rice paddies, fields, reservoirs, road segments and ships.
   The classifier is now written against the real 91 definitions and only 23 of
   them count as facilities. Run it and read the per-definition breakdown — that
   output is the check on the classifier, not my word for it.

       cd ~/Desktop/culprits && source .venv/bin/activate
       export TMPDIR=/Volumes/<DRIVE>/culprits-tmp
       python3 pipeline/harvest.py --only climate_trace --force

   Last full run: 111,949,068 features, 575 MB gzipped, ~40 minutes.

2. ~~Deploy v12~~ — **THERE IS NO v12.** This was wrong in an earlier handoff and
   cost a session to disprove. `grep -c epa_cafo worker/index.js` returns 0 in
   the clone, in `culprits-local`, and in every commit on the remote; the Worker
   has only ever been v11. The alert work that v12 was supposed to carry is
   already in v11 — `BUILD` reads "three alert products, transparent-tile
   fallback", `DIST` and `GLAD_DIST` are at lines 523-524, and `/v1/gfw_tile`
   answers. So `gfw_dist` and `gfw_dist_year` are correctly `ready:true`. The
   only thing v12 ever added was the EPA CAFO route, which is dead anyway.
   `/v1/_diag` reading `v11` with four routes was accurate throughout; the
   routes array lists the bbox routes only, which is a cosmetic gap and not a
   lie about what is deployed.

3. ~~`git push`~~ — done, at 61b4cc2. Note the token lacks `workflow` scope, so
   any commit touching `.github/workflows/` is rejected; either restore that
   file from `origin/main` before committing, upload it through the web
   interface, or add the scope.

4. ~~Pin the CAFO column names~~ — moot, see the EPA CAFO entry above.

5. Actions → Refresh atlas tiles → force, to build `power_plants` and
   `gem_coal`. Not before step 1 — it would pick up `climate_trace` too.

6. ~~`.gitignore`~~ — done. `.venv/`, `worker/.wrangler/` added; `.DS_Store`
   was already there.

7. Then the source queue above. Own repos and guerillamap are done. **The
   polygon branch in `app.js` is now written**, so Cerulean and Allen Coral need
   only their Worker routes — both are registered in `map/app.js` as
   `ready:false` with `geometry:"polygon"` and their caps and notes already
   settled, so writing the route and flipping the flag is the whole job. After
   those, Trase's facilities datasets, which need one thing found: the
   per-dataset download URL.

8. Add a LICENSE file to each of the five own repos. None of them has one, so
   each currently defaults to all rights reserved — moot for your own use, but
   two of them (`local_projects`, `remains_records`) carry OpenStreetMap rows,
   which are ODbL and share-alike. `local_projects` is marked `isolate:true`;
   `remains_records` is not, because its OSM share is not separable by its
   `register` field yet. Both are recorded in `_publish_blockers`.
