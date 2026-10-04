# Culprits atlas — handoff

Paste this into a new chat. Attach the repo zip, or just the files the issue
touches.

---

## Round 156k (4 October)

Needs round 155k. No tiles patch. No app.js?v= bump. The seventh basemap redrawn again.

- Owner on 155k, with two scans of Earth First! artwork (a moonlit mountain,
  a wolf among conifers): too much of a black-and-white theme, not the Earth
  First! look; fewer squiggles and patterns, natural hand-crafted intricate
  shadows. Nothing from any picture is copied.
- inkDrawSquare redone in the manner of those drawings: shadow sides solid
  black with ragged, blotchy edges and a few fine white scratches; half-tones
  in fine, short, straight pen strokes down the fall line (directions in
  twelfths of a turn from heavily smoothed slopes, chosen patch by patch;
  strokes fixed in place and drawn whole, the tone deciding how many and how
  thick); light ground paper with sparse stipple; the sea white paper
  stippled with round, uneven dots, closer over the deeps, with bare paper
  and one ragged inked line along the shore. No wavy cuts, no wander.
  About 60-90 ms a square in Chromium.
- Close in: no drawn motifs. Forests dense stipple, wetlands and towns light
  stipple, sea (from zoom 7) and lakes medium stipple (256 px sheets of
  chance-placed dots), buildings solid black. Layer colours "suited to the
  basemap": deep (pale ground again). Menu name unchanged: Black and white.
- Checked in Chromium with sample heights (zooms 0-2); not seen against the
  live height tiles.

## Round 159b (4 October)

Needs round 158b. Carries round 147b, which failed: main had moved on by the time it was uploaded (its test block clashed). No tiles patch. No app.js?v= bump.

- Combine the ticked layers made quick (asked 3 October: "takes way too
  long"). The cause: points were cut with MapLibre's "within" filter against
  one shape made of every crossing square. Measured: about 2 ms a point with
  4,000 squares, for each of a point row's four layers (dot, haze, core, soft
  glow), redone for every map square and every change. In Chromium with 5,000
  points and 300 areas the map took about 61 s to settle (20,000 points: not
  done after 5 minutes); now about 3 s (20,000 points: about 4 s).
- Now every layer of a row taking part, points included, is drawn as a copy
  ("<layer>__cut", its glow "<layer>__cut-haze" etc.) on one source per row
  and source/source-layer ("<row>__<hash>__cut"), from the row's features in
  the crossings: a point by the square it lies in (comboKeepPoints, one
  look-up), lines and areas clipped as before but through a 5-degree index of
  the crossings (comboRectIndex), an area wholly inside one crossing kept
  whole. The original gets a filter that lets nothing through (COMBO_HIDE); a
  filter set on it later is kept (COMBO_OWN) and passed to the copy, and its
  visibility and paint changes follow. Clicks and hovers reach the copies
  (queryRenderedFeatures asked of a layer also asks its copy; checked in
  Chromium). Copies are added through the raw addLayer (hudRaw.addLayer), so
  colours are not mapped twice; the theme's own colours are carried over.
- Also: a GeoJSON row's features are read from the source as the map holds
  them (s._data.geojson), not asked of the worker every run; each row's grid
  is kept and reused while its features, figure and picture are unchanged
  (COMBO.calc); the run pauses between layers so the page stays usable; the
  top-fifth sort is a native number sort; tiled features are keyed briefly
  (comboFeatKey) instead of writing out their geometry; pictures are asked
  again only when the crossings change (combocut:// carries their number,
  COMBO.cutHash). The squares past 85 degrees were added back after being
  cleared; now cleared after.
- Not seen against the real layers in a browser (the sandbox cannot reach the
  data); tested with made-up rows. Check live with several rows ticked.

## Round 158b (4 October)

Needs round 157b. No tiles patch. No app.js?v= bump.

- Owner: at the closest zooms only, back to the normal satellite picture,
  keeping some of the woodland look without blurring the detail; all else
  good.
- New layer outline-wood-photo (woodphoto://, woodGradePixels): Esri World
  Imagery (as the Satellite basemap uses close in), each pixel moved 35% of
  the way to its woodland colour (WOOD.photoGrade), colour only: no blur, no
  strokes. Fades in from zoom 15.5 to 16.5 (WOOD.photoFrom / photoFull); the
  painting stops at 17. The light, mist and sea tint still lie over it.

## Round 157b (4 October)

Needs round 154b. No tiles patch. No app.js?v= bump.

- Rounds 155b and 156b in one patch: 155b was never applied on main, so 156b
  failed (patches/failed). Nothing new beyond them; their notes follow. Each
  note is added only if missing.

## Round 156b (4 October)

Needs round 155b. No tiles patch. No app.js?v= bump.

- Owner: the light colours (#B38C53 ochre-tan, #DCC08A warm sand, #A2A253
  golden green, #D6C67E pale golden light) were used in a way that made the
  close zooms look spotted. They came from single bright pixels in the
  picture. Now each pixel may be only a little lighter than the ground round
  it (WOOD.lift 0.1 over a 10 px blur, WOOD.lightReach, widened when the
  picture is enlarged), so the light colours fall only in wide light areas,
  as broad washes. Colours unchanged.

## Round 155b (4 October)

Needs round 154b. No tiles patch. No app.js?v= bump. Woodlands basemap in brushstrokes.

- Owner on 154b: too dark over the seas, a one-colour olive daze at world
  views (not Griffing's deep woodland glow), still spotted at the closest
  zooms; wants organic, hand-made, visible brushstrokes at every scale.
- Colours: cool blue-green shadows to golden-green lights, earths to warm
  sand; the glaze gone; sea painted from the picture in lighter teals
  (WOOD.waters), the depth layer only a 35% tint; the flat coast fill gone,
  lakes 35% (14 layers).
- woodStrokes: strokes over the underpainting, broad to fine (WOOD.brushes),
  coloured from where they lie, running along the land's lines (structure
  tensor) or at a hand's slant on even ground, finer strokes only where the
  land has detail; bristles, dry ends, raised paint. Seeded per world cell
  with a 32 px margin from the neighbouring picture squares (woodComposite),
  so no seams. Painted to zoom 18 from the picture's zoom 14, washes widened
  when enlarged (no spots). Two Web Workers paint (woodHelpers; main-thread
  fallback). About 250-500 ms a square in a helper. Checked on sample
  satellite pictures; not seen live.

## Round 155k (3 October)

Needs round 154k. No tiles patch. No app.js?v= bump. The seventh basemap redrawn.

- Owner on 154k: not an engraved pen-and-ink look, too programmatic; wants a
  natural, hand-crafted black and white Earth First! look. Redrawn as a
  hand-cut relief print and renamed "Black and white" in the menu (key still
  "ink"; layers still outline-ink-*). Nothing from any picture is copied.
- inkDrawSquare redone: sea solid black, a white cut hugging every shore, short
  wavering cuts out to sea, fewer over the deeps; land white, the side away
  from the light cut in black strokes that follow the lie of the land (along
  height lines, swelling into shadow, tapering into light), solid black where
  too steep to carve; slow wandering fields tied to the ground bend every
  line and break strokes off (nothing ruled); a print's texture (inkGrain).
  Heights softened first so the grid's steps don't show as zigzags. North
  cap black (Arctic sea), south cap white. About 0.25 s a square.
- Close in: forests a large sheet of scattered hand-drawn conifers, each
  different (inkPattern pines, 224 px); reed tufts and uneven town dots the
  same way; sea from zoom 8, lakes and buildings solid black. Layer colours
  "suited to the basemap": as drawn (black sea, white land).
- Checked in Chromium with sample heights (zooms 0-2); not seen against the
  live height tiles. Preview: black_and_white_preview.png in that chat.

## Round 154k (3 October)

Needs round 154b. No tiles patch. No app.js?v= bump. One new basemap, Pen and ink.
Made in a separate chat (letter "k") so it does not clash with the "b" rounds.

- Asked 3 October: a basemap in the look of the Earth First! artwork in Cal
  Poly Humboldt's Special Collections and a photocopied sabotage zine. Only the
  way they are drawn is taken (black pen on pale paper, hatching, stipple,
  ruled woodcut lines, photocopy grain); nothing from any picture is copied.
- Drawn square by square on the reader's computer from the AWS heights
  (inkdraw://, inkDrawSquare, about 0.2 s a square): the sea ruled across,
  hairlines over the shelves and heavier in the deeps, a paper margin and one
  firm line on every shore; land paper, slopes away from a north-west light
  hatched, cross-hatched where darker, stippled in the half-light; far out,
  high ground shaded by height; height lines from zoom 4. Seamless; the
  world's top and bottom rows left paper so the globe's poles are clean.
- Close in (OpenFreeMap): the sea ruled from zoom 7, forests as small pen
  conifers, wetlands as reed tufts, towns stippled, lakes ruled and inked,
  ice white, buildings hatched, main roads double-lined, railways with ties,
  borders dash-dot (patterns drawn as pixels, inkPattern). Names black/grey.
- Black ink and paper only (tested). Layers outline-ink-* (INK_IDS), one
  block ("Pen and ink, a seventh basemap" to "end of Pen and ink") after
  Woodlands; menu and switch by wrapping basemapPanelHtml and setBasemap;
  listed last in the menu. Layer colours "suited to the basemap": deep.
- Checked in Chromium with sample heights (zooms 0-2); not seen against the
  live height tiles.

## Round 154b (4 October)

Needs round 153b. No tiles patch. No app.js?v= bump. Woodlands basemap as a watercolour.

- Owner on 152b/153b: too many flat colours, programmatic not handmade
  watercolour; tans against greens spotty, not soft diffused golden light.
- woodPaintPixels redone: the Kuwahara flat strokes are gone. Plants and bare
  ground blend over several pixels (greenness blurred), colour bleeds softly
  (55% of a blur), a darker rim where a wash meets a lighter one, the paper's
  faint grain (woodGrain, by world pixel, seamless) with pigment settling
  more in the darks, the warm paper showing through lighter washes
  (WOOD.paper), a warm golden glaze (WOOD.glaze). Earth ramp moved toward
  olive-tan so tans and greens sit together; contrast gentler; hillshade
  shadow softer, light warmer. Checked on sample satellite pictures; not seen
  live.

## Round 153b (4 October)

Needs round 152b. No tiles patch. No app.js?v= bump. One-line fix.

- The Woodlands basemap showed as pale blue "snow": its painted picture
  source (outline-wood-paint) went through the map-wide layer colour mapping
  (gladpx), which turned its greens and browns teal-to-cobalt. gladSourceSpec
  now leaves every "outline-..." (basemap) source alone. Layer pictures are
  still mapped (tested).

## Round 152b (4 October)

Needs round 151b. No tiles patch. No app.js?v= bump. Woodlands basemap redone again.

- Owner on 151b: keep the mist, but deep earthy greens (not grey, not alien
  green), an organic oil-painting look with no pattern at world views, the
  sea and the mist over it wrong, too many greys; wants living earthy
  contrast in colour and light, like Griffing's woodlands.
- Land is now the cloud-free Sentinel-2 picture (EOX s2cloudless 2024,
  CC BY-NC-SA, credited) re-painted pixel by pixel (woodpaint://,
  woodPaintPixels): plants on a ramp from forest-shadow near-black through
  deep earthy green to sunlit olive; bare ground umber to ochre; snow ivory;
  an S-curve for contrast; then a soft Kuwahara (oil paint) filter. No
  made-up noise anywhere: every variation is the Earth's own.
- Warm golden light and deep olive-black shadow (Mapterhorn); mist on land
  only, gone by 1,000 m; sea deep dark earthy blue-green by depth, no mist.
  Ground and wet fills and the tone clouds gone (15 layers). Theme: bright.
  Checked on sample satellite pictures (the sandbox cannot reach EOX), about
  100 ms a square; not seen live.

## Round 151b (4 October)

Needs round 150b. No tiles patch. No app.js?v= bump. Woodlands basemap redone.

- The 150b basemap (Autumn woodlands) redone as Woodlands after the owner found
  its leaf dabs a pattern. Asked: Robert Griffing's tonalist green woodlands,
  not a pattern. Now one soft key: greyed sage and olive greens and warm
  greys; ground paler, greyer and bluer with height (atmospheric perspective);
  soft golden light from the south-west, gentle grey-green shadow; warm grey
  mist in valleys and over water; still grey-green water; hazy sky.
- woodbrush:// now paints smooth, blended clouds of darker and paler tone and
  level mist from each pixel's place in the world (no marks, no seams; about
  35 ms a square). Leaf dabs (woodMarks) gone. Greens and earth colours here
  only, at the owner's request; all greyed (tested, saturation under 0.4).
  Not seen against real tiles.

## Round 150b (4 October)

Needs round 149b. No tiles patch. No app.js?v= bump. One new basemap.

- Autumn woodlands, a sixth basemap (asked 4 October: as close as can be to a
  Robert Griffing painting, 18th-century Eastern Woodlands, fall warmth, soft
  hazy light). Nothing copied from any painting; the look only: hardwoods in
  fall painted as dappled leaf masses (russet, sienna, amber, ochre, deep
  crimson) with dark evergreen stands, each lit upper left by a low sun; warm
  cream light and violet-grey shadow from the south-west (Mapterhorn); warm
  mist lying level in the valleys and over water, far ridges fading to hazy
  blue-grey (AWS heights); still silvery water; a warm hazy sky on the globe.
- Leaves painted square by square on the reader's computer (woodbrush://,
  woodBrushPiece), only on land below about 2,600 m, read from the AWS height
  square (woodHeights); seamless across edges. About 140 ms a square in node.
- The no-orange/no-yellow rule is set aside for this basemap only (fall warmth
  asked for): muted earth colours, no green, nothing loud (tested). Layers
  outline-wood-* (WOOD_IDS), one block ("Autumn woodlands, a sixth basemap"
  to "end of Autumn woodlands"), after Hell. Not seen against real tiles.

## Round 149b (4 October)

Needs round 148b. No tiles patch. No app.js?v= bump.

- Taken out at the owner's word: the Indigenous basemap (147i) and the Oil
  painting basemap (148b). Their app.js blocks (INDIG, OIL, the oilbrush://
  protocol and their basemapPanelHtml / setBasemap wrappers) and their test
  blocks are gone. Hell and the other basemaps are unchanged.

## Round 148b (3 October)

Needs round 147i. No tiles patch. No app.js?v= bump. Oil painting basemap only.

- A sixth basemap, Oil painting (asked 3 October: like the paintings of JB
  Clemens and Robert Griffing combined, after the owner's two pictures of
  Clemens's work). Taken from them is the way they are painted, not anything
  in them: visible brush strokes, mist low in the valleys (Griffing), a low
  sun lighting the faces of slopes over deep shadow (Clemens). Their golds,
  oranges and greens are turned into the map's own colours: navy sea paler
  over the shelves; misty grey-teal lowlands deepening to slate and dusk
  cobalt, bone on the highest peaks (AWS terrain heights, sea-dem); bone
  light from a low western sun over navy shadow (Mapterhorn); a pale haze
  over ground below 1,500 m; forests a slate-teal wash; lakes and rivers
  slate blue; towns and roads cool grey (OpenFreeMap); names in grey ink.
- Brush strokes painted square by square on the reader's computer
  (oilbrush:// protocol, oilBrushPiece, rawPng): broad soft patches under
  flat-brush strokes whose slant follows a slow wave so neighbours lean
  alike, dry-brush streaks and ragged ends, small pale dabs like meadow
  flowers. Each square's strokes come from its own seed, and the eight
  squares round it are painted in where they reach, so no seams (also across
  the date line). About 70 ms a square in the sandbox.
- Layers outline-oil-* (OIL_IDS), one block of app.js ("Oil painting, a
  sixth basemap" to "end of Oil painting"), reached by wrapping
  basemapPanelHtml and setBasemap after Indigenous's wrappers. The wrapper
  also turns Hell's names light again when coming from Indigenous (they were
  left dark). Not seen against real tiles (the sandbox cannot reach them):
  check the look live.

## Round 147i (3 October)

Needs round 146h. No tiles patch. No app.js?v= bump. Indigenous basemap only.

- A fifth basemap, Indigenous (asked 3 October, after the owner's pictures: a
  hand-painted relief map of Canada's First Peoples and painted hunting
  scenes; "blend them all" into one). Built from what peoples on every
  continent share rather than any one nation's designs: the earth pigments
  (red ochre, white clay, charcoal, indigo) and the painted-relief look. No
  motifs that belong to particular peoples, no portraits. Indigo sea, darker
  in the deeps and paler on the shelves (AWS terrain heights, sea-dem); land
  from pale clay through red ochre and charcoal to white clay on the highest
  peaks; warm daylight relief over umber shadow (Mapterhorn); forests as a
  slate-teal wash, ice in white clay, wetlands in indigo, lakes and rivers
  indigo, towns clay grey, roads charcoal brown, borders a faint charcoal
  dash (OpenFreeMap, boundaries); place names in grey ink. No orange,
  yellow or green; a test checks the colours.
- Layers outline-indig-* (INDIG_IDS), one block of app.js ("Indigenous, a
  fifth basemap" to "end of Indigenous"), reached by wrapping
  basemapPanelHtml and setBasemap after Hell's wrappers. Not seen against
  real tiles (the sandbox cannot reach them): check the look live.

## Round 146h (3 October)

Needs round 145h. No tiles patch. No app.js?v= bump.

- CARTO's place names were stamped "API KEY REQUIRED" on every basemap and in
  the hologram (CARTO now asks for a free key: carto.com/basemaps/apikey). The
  owner's key is added as ?key= to the three CARTO addresses: the "labels"
  source in map/app.js (voyager_only_labels) and the hologram's names in
  map/index.html and index.html (dark_only_labels). The key is meant to be
  seen in the page; keys are managed at dashboard.basemaps.carto.com. Not
  checked from the sandbox (CARTO is blocked there). Browsers and CARTO's
  servers may hold stamped squares for a while: force-refresh.

## Round 145h (3 October)

Needs round 144h. No tiles patch. No app.js?v= bump. Hell basemap only.

- Hell's land no longer fades to grey on high ground (asked 3 October: it did
  not fit). HELL.ground above sea level now darkens from basalt black into
  scorched oxblood (#131215 to #3B171E); a test checks every step is red-led.
- Found while checking "place names show API key required": CARTO now stamps
  "API KEY REQUIRED" on its raster tiles when no key is sent (carto.com/
  basemaps/apikey). This hits the place names on every basemap (app.js
  "labels" source, voyager_only_labels) and the hologram's names
  (index.html, dark_only_labels). The key is free; waiting on the owner to
  request one, then append ?key= to both tile addresses.

## Round 145b (3 October)

Needs round 144h. Tiles patch round145b_tiles.py beside it. No app.js?v= bump.

This round carries the "b" chat's first round 144b, which never applied: the
other chat's 144b reached main first under the same name. Code comments say
Round 145b throughout.

Asked 2 October (the owner's long list; this round is the menu, the titles
and the colours; the rest is listed at the end).

- Agriculture: Plantations its own heading (PLANT_T "Plantations", PLANTS =
  Agriculture > Plantations), out of Cropland. Rows asked to lead their
  heading now lead it in a fixed order whichever catalogue answers first
  (CATALOGUE_LEAD, catalogueInsert, catalogueLead): the planted trees map
  first under Plantations; the plantations spreading into forest no longer
  lead Plantations (CATALOGUE_NOT_FIRST_IN), so every kind of plantation sits
  above them; "Plantations in 2000 (Global Forest Watch)"; sago titled as
  Maluku and Papua only (its map server's own extent).
- Palm oil: "Clearing and emissions, Indonesia" first; Global Forest Watch's
  two concession maps lead Concessions; land within 10 km of oil palm
  plantations leads Plantations. Nusantara's mill layers are one row with
  sublayers (bundle palmmills: the mills, 1 and 2 hours' drive, 50 km, company
  plantation land, L'Oreal's mills). Taken out, as their server draws nothing
  for them (probe/nusantara/health.json, blank at zooms 2 to 8): mills and
  oil palm concessions by lenders and by investors, the unstated-distance
  areas and the 10 km areas. "Who finances them" is gone with them.
- Trase: a measure of one country says the country first ("Indonesia: ...")
  and not again at the end; "less what ... takes back up" reads "after taking
  away the carbon ... absorbs".
- Soy: Culprits (soy traders' offices, Forest 500's soy financiers) and
  Deforestation promises (Trase's soy shares, also still under Deforestation
  > Deforestation promises) as headings under Soy. UMD's soy fields stay: they
  are not in SPAM (South America only, year by year, field by field).
- Peatland moved from Deforestation to Biodiversity loss > Land Use and
  Ecoregions > Peatland; Trase's peatland burned each year is back there
  (TRASE_REMOVED_METRICS keeps only the burned-peat emissions).
- Land Use and Ecoregions: Global Safety Net's land cover kinds, natural and
  semi-natural land under "Kinds of land cover"; human modification at 90 m
  under Disturbance; its cropland under Agriculture > Cropland; where forest
  could grow back under Deforestation only; the grasses inside the places
  most important for species under Places that matter most for species. Out:
  FAO forest area by country (GFW's build failed), SBTN natural lands (no
  tiles), UMD land cover (no tiles), WWF's 2001 ecoregions. The JRC forest
  cover 2020 also here. Ecoregion boxes are titled by ECO_NAME (pmchoose
  nameFrom).
- Land cover in 35 kinds: a palette of its own (each family its own hues, no
  green), kept out of the map-wide remap (keepColour), and a click box naming
  the kind, read from the GeoTIFF one pixel at full detail (cogValueAt,
  cogClickWire, cfg.cogClick).
- Biodiversity: the Intact Forest Landscapes also under Deforestation > Forest
  cover; Global Safety Net's marine critical habitat out (the map's own copy
  holds land and sea), its land one matched more loosely into crithab; the
  WDPA copy leads Protected areas; Alliance for Zero Extinction boxes titled
  by site and species (GFW_TITLE_FROM, gfwOwnTitle; the fields are found by
  name, not yet seen live).
- Alerts: the integrated alerts are titled as mostly tropical (GFW's newest
  copy holds only overlap.tif); the worldwide DIST-ALERT rows (gfw_dist,
  gfw_dist_year) also under Construction (copies; a grouped row's copy says
  "all gases as CO2e" only for Climate TRACE rows now).
- Money: the World Bank's most harmful projects under Of the planet > General
  and Construction; fossil fuel subsidies under Climate > Finances; the
  publicharm bundle and the Bankrolling Extinction page row (pe_bankrolling)
  gone; pe_banks' note names the campaign page, its fields in plain words
  (FIELD_WORDS: "Rank by finance linked to biodiversity loss (the report's
  Figure 1)" and the rest).
- One colour scale for every figure: AMOUNT_RAMP (colourBy) and PC_RAMP (the
  points' colour menu) are the same six steps, pale ice (least) to violet
  (most). AMOUNT_RAMP ran the other way (navy least), which is why the soil
  nematodes' key and dots disagreed.
- Added 3 October:
  - PalmWatch inside the mills row (bundle palmmills, retitled: two
    estimates, PalmWatch's and Nusantara Atlas's).
  - The plantation rows say why they do not line up (GFW_ABOUT for
    gfw_planted_forests and gfw_pre_2000_plantations; plantall titled as the
    tropics only, about 12S to 16N).
  - World Bank projects: placed where AidData geocoded them (tiles
    public_harm.py reads AidData-WM/public_datasets
    WorldBank_GeocodedResearchRelease_Level1_v1.4.2, ODC-By; precision 1 to
    4 only, the box says which; later projects at their country).
  - own_bii in the bii bundle: the NHM Biodiversity Intactness Index v2.1.1
    (CC BY-NC-SA) in ten steps (tiles bii_nhm.py, through data.nhm.ac.uk's
    CKAN API; stops and lists the resources if there is no GeoTIFF).
  - gem_coal_mines and gem_coal_boundaries under Methane > Culprits (tiles
    gem_coal.py reads whatever the owner uploads to gem/coal/download/: the
    Global Coal Mine Tracker with both supplemental files; every column; the
    ownership rows joined by GEM mine ID; GEM said 2 October the supplements
    come with the download; CC BY 4.0).
  - Fungi (soil_spun): togetherOf adds three choices drawing several of the
    build's pictures at once (rasterTogether: <row>-raster-t1 ...).
  - tiles gfw_trawling.py: a browser User-Agent (every box was 403 on 3
    October) and GFW's reply recorded; stops after three refusals running.

Not done (next): a colour changer for one row or a heading; the research
answers. Not checked in a browser.

## Round 144h (3 October)

Needs round 144b. No tiles patch. No app.js?v= bump. Made in a separate chat
("h" for Hell) while the "b" chat goes on with the layers; everything is in one
new block of app.js ("Hell, a fourth basemap" to "end of Hell") and one test
block before round 143b's, so it does not touch lines the other chat edits.

- A fourth basemap, Hell (asked 3 October, after the owner's pictures: a red
  sea round black land, a relief map cut by red rivers, hell's place names on
  black, graveyards glowing on black; "nothing cheesy"). The same Earth from
  the same open data in other colours: oxblood sea, darker in the deeps and
  lighter on the shelves (AWS terrain heights, sea-dem); basalt-black land,
  ash grey up the slopes (same tiles); cold blue-grey relief light over black
  shadow (Mapterhorn, outline-dem); lakes dark blood, rivers thin red veins
  with a faint glow, graveyards dull red from zoom 9, towns dark ash, roads
  dark maroon, borders faint dark red (OpenFreeMap, boundaries); the label set
  turned light on dark and grey (raster brightness min above max). No orange,
  yellow or green; a test checks the colours.
- Layers named outline-hell-* (HELL_IDS), added on first choice just above
  plate-base, so the colour mapping and themes leave them alone
  (GLAD_BASE_LAYERS and themeTouches already skip "outline-").
- Reached by wrapping, not editing: basemapPanelHtml adds the "Hell" choice;
  setBasemap adds and shows the layers and sets BASE_GRADE.hell = {} and
  THEME_BY_BASEMAP.hell = "bright"; the hologram's holo-on mark hides them
  unless the hologram keeps the basemap under it.
- Not seen against real tiles (the sandbox cannot reach them): check the look
  live.

## Round 144b (2 October)

Needs round 143b. No tiles patch. No app.js?v= bump.

- Combine the ticked layers: how much of each layer is crossed (asked 2
  October), in the combine box under its message (#combo-stats). For each
  layer taking part: the share of it crossed by any other group, or by one
  group picked in the menu (#combo-by), worldwide and in the part of the map
  in view (comboViewCells from map.getBounds, wrapping round 180 degrees).
  Places count one each; areas and pictures count the ground they cover
  (cover x cos latitude). "Crossed" is the outline's own test: a layer of
  that group present in the square (within about 50 km; in "highest values",
  in its own top fifth). comboBuild keeps each layer's squares sparsely
  (COMBO.stats); comboShares adds them up; the view share is redone on every
  map move. Worldwide is all the map has read of a layer, so tiled layers
  grow as the reader looks round (the box says so).

## Round 143b (2 October)

Needs round 142b. No tiles patch. No app.js?v= bump.

- Combine the ticked layers: groups (asked 2 October: with three ticked, two
  alike layers such as mine sites and mining features crossed each other and
  drowned out the crossings with the third, protected areas). Each layer
  taking part is in a group (A to H), and layers in one group count as one:
  a square counts the groups present (comboGroups; present per group, then
  summed), so only crossings between different groups show. Layers start in
  the group of their heading in the layers menu (comboHeadingOf: the nearest
  heading, not a bundle); the menu under each row (data-combo-weight, now
  "group A" to "group H" or "left out") moves any of them. If every layer is
  in one group the box says to split them. The brighter edge marks where the
  most groups cross.

## Round 142b (2 October)

Needs round 141b. No tiles patch. No app.js?v= bump.

- Combine the ticked layers (asked 2 October: the base map must show for
  context; a third layer ticked did not update it; lines ran round the
  southern hemisphere; too slow):
  - no veil over the map any more: what is not a crossing is taken off the
    layers themselves. Points by "within" as before; lines and areas drawn
    again from their own features clipped to the crossings (comboCopies,
    comboClip: layers <layer>__cut on source <row>__cut, the originals made
    clear and put back after); pictures clipped pixel by pixel through a new
    combocut:// protocol (setTiles, put back after). The base map shows
    everywhere.
  - every crossing of two or more layers is kept (was only where the most
    meet), so a third layer adds its crossings; the outline is drawn round
    the crossings only (comboEdges), pale ice, and brighter and thicker where
    the most cross. Menu choice renamed "Where they cross".
  - squares past 85 degrees take no part (pictures covering Antarctica made
    full-width squares there, drawn as lines round the world).
  - each run is numbered (COMBO.gen): an older run still reading when a newer
    one starts is dropped (it had overwritten the newer one: the third layer
    lost). A run that finds the same crossings from the same rows touches
    nothing on the map (COMBO.lastKey); first run 400 ms after a tick (was up
    to 1.8 s).
- Checked in Chromium (MapLibre 5.24, globe) on a test page with the code:
  an area cut to the crossing, a picture cleared outside it, the outline and
  the brighter inner outline drawn, everything put back when turned off. The
  whole map was not run in a browser.

## Round 141b (2 October)

Needs round 140b. No tiles patch. No app.js?v= bump.

- Combine the ticked layers, made easier to read (asked 2 October: the
  highlight and the fade were too alike):
  - the veil is nearly opaque (COMBO_VEIL 0.94, was 0.82) and lies above every
    layer of the rows taking part, points and lines included, so everything
    that is not a crossing is almost gone;
  - the crossings are edged in pale ice (#CFEAF4, layer combo-mask-edge) and
    faintly tinted (combo-mask-glow);
  - the combine has its own grid (comboGrid): smoothed once by one square, so
    a layer counts in a 0.25-degree square when it lies within about 50 km
    (was about 200 km, the density bands' smoothing): crossings are tighter.

## Round 140b (2 October)

Needs round 139b. No tiles patch. No app.js?v= bump.

- Combine the ticked layers (asked 2 October: it did not work on the map;
  only the overlapping parts should show, the rest deleted or faded out, and
  the choice should not depend on being made before or after the ticks):
  - every tick or untick re-runs it (hook at the end of applyVisibility), and
    when the map is idle comboSig compares the rows showing with what the
    combine was made from, so rows whose layers are made late (lazy rows)
    join too; rows with nothing read yet are tried again up to six times;
  - pictures (shaded maps) now take part, counted where they paint, read from
    their zoom-2 squares (comboPictureGrid, cached per picture address);
  - areas and pictures cannot be cut along an edge, so outside the meeting
    places they are faded by a dark veil (layer combo-mask, #050A12 at 0.82,
    kept out of the colour mapping), the world less the kept squares, laid
    just above the highest picture or area taking part (else just below the
    lowest row taking part); points and lines are still cut with "within";
  - rowFeatures reads a row's GeoJSON once per address (rowJson) and through
    the map's own protocols (fetch alone failed on own:// style addresses).
- Checked in Chromium (MapLibre 5.24, globe): the within cut keeps only the
  points inside, the veil covers the rest of an area. The whole map was not
  run in a browser.

## Round 139b (2 October)

Needs round 138b. Tiles patch round139b_tiles.py beside it. No app.js?v= bump.

- fao_capture and fao_aquaculture (route country): tonnes caught and farmed by
  each country in FAO's latest year, with ten years before, sea and inland
  (or fresh, brackish, sea), FAO's groups of animals, the top 15 species and
  animals FAO counts by head (whales, seals). Under Meat > Marine meats (Wild-
  caught fish; Fish and shrimp farms) and Oceans > Fishing. Tiles
  fao_fisheries.py reads the newest Capture_*.zip and Aquaculture_*.zip from
  FAO's own listing (fao.org/fishery/static/Data/, CC BY-NC-SA 3.0 IGO).
- Researched, not built: Sea Around Us (catch with unreported, illegal and
  discards; CC BY-NC) sits in an S3 bucket whose files are not documented;
  Global Fishing Watch's trawler effort needs a free API token (a repo secret).

## Round 138b (2 October)

Needs round 137b. Tiles patch round138b_tiles.py beside it. No app.js?v= bump.

- lpi_populations is map tiles with boxes (route pmtiles), not one file: the
  2024 public Living Planet Database (uploaded 2 October) is 35,996
  populations, 46 MB as one GeoJSON, too heavy for a browser. Tiles
  lpi_populations.py writes tiles/lpi_populations.pmtiles (class, system,
  name, change, last year counted) and each record whole to
  lpi/lpi_populations/<hh>.json.gz (env_enforcement.write_layer). It skips the
  Mac copies the zip carries (__MACOSX/._*.csv) and reads the BOM in the
  header. Coloured by system, change or class; key filters by kind of animal
  (LPI_CLASSES, plain words) and system.
- Key filters now draw for rows inside groups too (they were drawn only for
  the main list's rows).
- Tested on the real download: 35,996 populations, all with a position.

## Round 137b (2 October)

Needs round 136b. Tiles patch round137b_tiles.py beside it. No app.js?v= bump.

- Fish decline (asked 2 October), under Biodiversity loss > Fish and under
  Oceans > Every human impact together > Fish decline (tagged not counted):
  - fish_stocks (route country): each country shaded by the share of the
    stocks assessed in its waters whose latest B/Bmsy is under 1; every count
    and every stock in the box. Tiles fish_stocks.py reads the newest RAM
    Legacy Stock Assessment Database from Zenodo (CC BY 4.0). Stocks RAM gives
    to no single country are listed in fish/ram_build.json.
  - lpi_populations (geojsonlive): every population in ZSL and WWF's public
    Living Planet Database at its place, every field, its counts, first and
    last counted years and the change between them; coloured by system,
    filtered by class. Its download is behind an agreement form: the owner
    downloads it and uploads it to tiles lpi/download/; tiles
    lpi_populations.py builds from there.

## Round 136b (2 October)

Needs round 135b. Tiles patch round136b_tiles.py beside it. No app.js?v= bump.

- Six more ocean pressures, each its own row under Every human impact together
  (asked 2 October: yes to the ocean harms not yet on the map), from the same
  study (Halpern et al. 2019, KNB, CC0), 2013 and 2003, 0 to 1 as the authors
  rescaled them: ocean_slr (sea level rise), ocean_light (light at night),
  ocean_trawling (bottom trawling and dredging: demersal destructive fishing),
  ocean_bycatch (high and low bycatch, demersal and pelagic), ocean_coastal_people
  (direct human), ocean_runoff (fertiliser and pesticides; also under
  Pollution at sea). Tiles ocean_stressors.py finds the files through
  DataONE's search by name and writes every name it found and what it took to
  oceans/stressors.build.json: check it after the first run.
- offshore_platforms: every platform OpenStreetMap maps at sea (man_made =
  offshore_platform, seamark:type = platform), every tag, coloured by what its
  tags say (oil, gas, both, wind, not stated); under Oceans and under Oil
  spills and slicks at sea. Tiles offshore_platforms.py (Overpass, 30-degree
  slices). Not a register: coverage is as complete as the volunteers' mapping.
- Not done yet: noise, seagrass and salt marsh loss, sand dredging, ghost
  gear, shark finning and whaling (sources to be checked).

## Round 135b (2 October)

Needs round 134b. Tiles patch round135b_tiles.py beside it. No app.js?v= bump.

- Reefs (allen_coral): the world view no longer reads as white squares
  (asked 2 October). UNEP-WCMC's picture is asked at full size (256, was
  96 stretched with nearest-neighbour), drawn smoothed, in the map's light
  teal 6FC2DA (was bone E3D2CC), still grown a pixel or two so small reefs
  show.
- Who Owns the Food Industry: the row reads food/system.places.geojson (tiles
  food_system.py), the page's whole data: 48 companies (sector, revenue,
  share of the page's $12 trillion system, ownership, HQ, brands, regional
  sites), 8 asset managers and financiers, 5 lobby groups, 12 orbit bodies,
  and 191 tie lines (shareholdings, lobby membership, orbit ties); each
  company's box lists who holds it, its lobby groups and its orbit ties. The
  tiles patch carries a first build.

## Round 134b (2 October)

Needs round 133b. Tiles patch round134b_tiles.py beside it. No app.js?v= bump.

- Points: the glowing orbs again (asked 2 October): cores soft-edged
  (circle-blur 0.6, round 119b had 0.12) and the dots soft (0.8, was 0.15);
  the light rim close in (125b) stays.
- How many farm animals are kept: an All choice, first (every animal counted
  as one head or bird, the six FAO GLW4 grids added; tiles glw_relief.py
  writes glw_all). Until it is built the row opens on cattle as before.
- Registered animal-use facilities: the colour menu says each value in words
  (US FSIS sizes: large 500+ employees, small 10-499, very small under 10 or
  under $2.5 million in sales; "N / A" and "1.0" as the register gives them);
  a Size filter under the row (keys), with "no size given" as its own choice
  (missingLabel, __none__ in keyFilterExpr). Only the US register gives a
  size; Trase's capacities are in each box but in mixed units, so no filter.
- trase_meat_brazil out (PANEL_REMOVED): the abattoir atlas reads Trase's
  whole facilities file (15,119 rows) into abattoir_facilities, one point per
  site with SIF and the other registers, every Trase field in the box.
- GDACS alert levels in words and EONET were done in round 123b; EONET's file
  is built on tiles main.

## Round 133b (2 October)

Needs round 132b. No tiles patch. No app.js?v= bump.

- Combine the ticked layers now cuts the ticked layers to where they meet,
  instead of drawing one surface in their place (asked 2 October). "Where
  they overlap the most": only the squares (0.25 degrees, each layer present
  within about 200 km) where the most ticked layers meet, two at least.
  "Where their highest values overlap": only the squares where the most
  layers are each in the top fifth of their own values (COMBO_TOP).
- The cut is a MapLibre "within" filter added to each layer's own filter
  (COMBO_OWN; a setFilter wrapper keeps later filter changes, comboExpr turns
  old-style filters into expressions). Layers are never hidden, so tiled
  layers keep loading; what the map has seen of them is kept (COMBO.seen) and
  the cut is made again as the map moves. Areas (fill layers) count but show
  whole ("within" cannot cut them); pictures take no part; the box names both.
- The weights menu is now "takes part" / "left out". No 3D, no raised ground.
- Checked in Chromium (MapLibre 5.24): a within filter joined to a layer's own
  filter shows only the points inside. The whole map was not run in a browser.

## Round 132b (2 October)

Needs round 131b. Tiles patch round132b_tiles.py beside it. No app.js?v= bump.

- Cropland spread: potapov_cropland shows only net gain and net loss
  (choiceMatch, a new filter on rows that read a build's list of chips).
- Every SPAM 2020 crop is its own row (spam_<code>, 38 new) under its crop
  in By crop, alphabetical, the "other" groups last; crops_spam and
  crop_coffee (its files never existed in SPAM 2020) in PANEL_REMOVED.
  SPAM's COFF entry is titled as its general coffee entry, kinds unstated.
- Meat: Trase's chickens and pigs slaughtered and beef produced (Brazil) and
  Paraguay's cattle herd size taken out (CATALOGUE_BY_TITLE); Cattle and
  pasture and Pigs and chickens headings gone; Herds above Facilities; Marine
  meats (Wild-caught fish: fishing, iuu_vessels, iuu_positions; Fish and
  shrimp farms: aquaculture_ponds, ponds).
- Deforestation promises (h4 under Deforestation): every zero-deforestation
  share, beef, soy, cocoa and palm (corn stays out).
- Oceans: Every human impact together first; the kinds of harm under it as
  h5, each with a tag (new heading option `tag`) saying whether that layer
  counts it; Pollution at sea (wastewater plumes, slicks, sunken ships,
  plastic); a note pointing to Meat and Pollution. ocean_heat split: sea
  temperature only; ocean_bleaching (bleaching alert and degree heating
  weeks, same files) under Reefs and mangroves. Dead zones also under
  Biodiversity loss > Fish; deep-sea mining also under Mining.
- Tiles: oceans_more.py heat falls back to Coral Reef Watch's own server;
  acid looks through sub-folders and logs every file it finds; shipping is
  its own script, ocean_shipping.py, with a 120-minute budget per run.

## Round 131b (2 October)

Needs round 126b. Carries rounds 128b, 129b and 130b, which failed because 127b was never uploaded. 127b (the combine-the-ticked-layers fix) is not carried: it is redone with the new overlap modes in a later round. No tiles patch. No app.js?v= bump.

## Round 130b (2 October)

Needs round 129b. Tiles patch round130b_tiles.py beside it. No app.js?v= bump.

- open_payments (geojsonlive openpay/states.geojson) after medical_culprits
  under Suppression > The medical industry: each US state and year shaded by
  general payments to prescribers practising there, year bar, the 50 largest
  payers in the box and a link to every company (openpay/years/<year>.json).
- Tiles open_payments.py: CMS's DKAN data service is asked for sums grouped
  by recipient_state and paying company (expression sum/count, groupings),
  per "<year> General Payment Data" dataset found in its metastore, so the
  multi-GB files are never downloaded. State shapes from cgaz-boundaries USA,
  simplified with attacks_plain.rounded. Not verified: that this DKAN accepts
  groupings with expressions (the sandbox reaches only one plain query). If
  build.json lists every year under "refused", the next step is the yearly
  CSV, read in a stream.
- Research payments and ownership interests are not added (separate files).

## Round 129b (2 October)

Needs round 128b. Tiles patch round129b_tiles.py beside it. No app.js?v= bump.

- iuu_positions (geojsonlive iuu/positions.geojson) after iuu_vessels under
  Fishing and Environmental crime. The 2 October build read 212 vessels but
  placed none: positions are written as "Yantai, China / Bohai Sea". Tiles
  iuu_vessels.py now places them at the port, else the sea, by Nominatim
  (cached in iuu/places.json; box says so), and drops the history-table rows
  that were read as labels (779 fields down to 44).
- Tiles medical_culprits.py: the settlements table is read as a full grid
  with rowspan/colspan (grid()); the 123b left-shift guess took drug names
  ("Neurontin", "Claritin") as companies when a middle column spanned rows.
- Tiles nusantara_health.py: the 101b probe asked every layer for one square
  over Kalimantan, so layers elsewhere read as empty. Now also asks each
  layer where its own data is (first WFS feature, else its area's middle),
  with each listed style, and how many features it holds. Run by hand, then
  decide which of the 12 "draw nothing" layers are really empty.

## Round 128b (2 October)

Needs round 127b. Tiles patch round128b_tiles.py beside it. No app.js?v= bump.

- National environmental-crime registers, from what probe/enforcement shows
  they hold (tiles scripts/enforcement_registers.py, weekly; unbuilt ones
  daily), under Environmental crime after IBAMA, route pmtiles with boxes:
  - ea_enforcement: Environment Agency enforcement actions, England (8,288
    in the probe), placed at the postcode ending each address (postcodes.io;
    terminated postcodes by their last position). OGL v3.
  - canada_offenders: Environmental Offenders Registry export (~290), placed
    at the offence town by Nominatim, else the company's town (box says).
  - epa_cases: EPA ECHO case files (136,753 cases), one point per named
    facility at its ZIP code centre (Census gazetteer; ECHO gives no
    coordinates), with violations, laws, pollutants, defendants, programs.
  - Counts and what was not placed: enforcement/registers.json.
- Not mapped, and why: EA prosecutions ("All rights reserved", no licence:
  needs permission); Chile SMA (PDFs in Drive folders); NSW EPA (search page
  only); Colombia (no sanctions table found); PROFEPA, OEFA, Ireland EPA,
  SEPA (addresses refused or gone). IUU vessels already mapped.
- The script was tested on made-up rows only (the registers are blocked
  from the sandbox): read the refresh log and registers.json.

## Round 126b (2 October)

Needs round 125b. No tiles patch. No app.js?v= bump.

- Basemaps: the Satellite basemap's and the painted atlas's imagery and the
  hillshade are Esri's again, exactly as before round 123b (the owner tuned
  the looks on them). If Esri's "API key required" squares return close in,
  the fix that keeps the look is a free ArcGIS key on the same imagery.
- The live share moved to the top of the layer menu, above Combine the
  ticked layers: "N% of the map's layers are live layers".

## Round 125b (2 October)

Needs round 124b. Tiles patch round125b_tiles.py beside it. No app.js?v= bump.

- Points close in: past zoom 12 the glow is gone and the dot alone shows; it
  now gains a thin light rim (addHud), so dull-coloured rows (development
  projects) stay visible at city level. Asked 2 October.
- water_cases: named companies a government body found or ruled to have taken
  or depleted water (BlueTriton, Fondomonte/Almarai, Coca-Cola Plachimada),
  each with its source; tiles water_cases.py places them by Nominatim.

## Round 124b (2 October)

Needs round 123b. Tiles patch round124b_tiles.py beside it. No app.js?v= bump.

- GFW records that carry their own latitude and longitude (the VIIRS fires)
  show the country they fall in, from the map's own outlines (countryNameAt,
  COUNTRY_SHAPES), and a link to the spot on OpenStreetMap (recordWhere).
  NASA names no fires.
- tiles medical_culprits.py: the company is read from the settlements
  table's own Company column (it took drug names such as Neurontin and
  Zoladex as companies); rows under cells spanning several rows carry them down.

## Round 123b (2 October)

Needs round 122b. Tiles patch round123b_tiles.py beside it. No app.js?v= bump.

- Basemap: Esri's keyless imagery now answers "API key required" close in.
  With ESRI_TOKEN empty, the imagery is EOX Sentinel-2 cloudless 2024 at every
  zoom and the Esri hillshade an empty square (esri-hillshade-off://); a free
  ArcGIS key in ESRI_TOKEN brings Esri back through ibasemaps-api.
- Combine ticked layers: "Where they overlap the most" (overlap: layers
  present within ~200 km, counted, two or more) and "Where their highest
  values overlap" (peaks). LIFT_ON false by default; nothing turns on 3D.
- Hologram blue shading off by default (opt.shade123 resets a saved on).
- Natural disasters: kinds as h5 under Every kind together; plainer titles;
  berkeley_warming (tiles berkeley_warming.py) replaces GFW's undrawn copy.
- Environmental law: site_environment_law and enviro_law_by_country from
  envlaw/ (tiles envlaw.py); _shapes removed; isds_tracker and ect_secrets
  are country rows from UNCTAD's case list (tiles isds_unctad.py).
- Water scarcity: jrc_water first (dataOnly remap: non-palette and faint
  pixels left clear), aqueduct_proj, then Reservoirs, Water conflicts
  (ejatlas_water, onlyGroup), Who causes water scarcity (water_culprits, tiles
  water_culprits.py); aqueduct_crop removed; reservoirs with no usual area are
  "no reading".
- Mining: bundle split; pangaea_global_mining leads. Forest and land cover
  rows under Land Use and Ecoregions; ESA and Indonesia land cover pinned to
  finished tiles (GFW_FIXED); UMD land cover 2000-2020 out (no tiles).
- Fire: inpe_fire_2023, Trase BURNED_PEAT and EMISSION_BURNED_PEAT_CO2, MODIS
  active fires out; VIIRS bundle (3 months, with remains_fire inside); tree
  cover lost to fire coloured by year (remap tcl_fire).
- "% of the map is live" badge at the top (liveShareBadge).
- Not done: development projects vanishing (not reproduced); MODIS burned
  areas still on-request; named water culprits points.

## Round 122b (2 October)

Needs round 121b. Tiles patch round122b_tiles.py beside it. No app.js?v= bump.

- Every company and financial institution Forest 500 has assessed, 2014 to
  2025, from the owner's downloads and Forest 500's API: forest500_companies
  (882) and forest500_institutions (515), one point each at the capital of the
  headquarters country (spread), coloured by the last total score, filtered by
  commodity and role, every year's score in the box. Plus the 2022 country
  selection: forest500_producer_countries (deforested area as the sheet gives
  it; its heading says thousand hectares but the figures read as hectares) and
  forest500_trading_countries (total rank, reverse). All four under
  Deforestation > Companies and financiers, after dff. Built by
  culprits-tiles-more scripts/forest500_map.py.
- Forest 500's files hold no amounts of money, so forest500_soy_money (121b) is
  gone and site_forest500_soy is back in both soy lists.
- test.mjs: round 122b block; 121b block updated.

## Round 121b (1 October)

Needs round 120b. Tiles patch round121b_tiles.py beside it. No app.js?v= bump.

- Soy coloured by money (asked "colour soy by $ and influence", "yes to both"):
  soy_traders_money (the 24 trader offices, coloured by each trader's revenue
  from Wikidata, then by trader) and forest500_soy_money (the 70 banks and
  investors, coloured by the financing in Forest 500's own data download once
  the owner puts it in culprits-tiles-more forest500/download/, else by soy
  score). Both read files built by scripts/soy_money.py. They replace
  site_soybean_companies and site_forest500_soy in Nitrous oxide > Crops and
  Agriculture > Soy; the old rows are in PANEL_REMOVED.
- Not done yet: ESDAC Global Soil Biodiversity maps (permission granted with a
  citation; the files come only through ESDAC's form and may not be passed to
  third parties, so they will be drawn as pictures once the owner attaches them).
- test.mjs: round 121b block.

## Round 120b (1 October)

Needs round 119b. Tiles patch round120b_tiles.py beside it. No app.js?v= bump.

- News marks: the box is titled by the country of its stories
  (wireMarkTitle, Intl.DisplayNames from iso), else the place most name.
- No automatic tilt: reliefGround no longer eases to pitch 50 when a row
  holds the ground (the population density "scooted the map"), nor the
  Climate TRACE columns to COLUMN_TILT.
- NASA active fires: gibs:// protocol asks GIBS's EPSG:4326 WMS in latitude
  and longitude (SRS=EPSG:4326) and stretches each square into web Mercator
  row by row (gibsSquare); the 3857-in-4326 request drew nothing.
- Atlas regional maps: pic:// protocol cuts north-up pictures into map
  squares (addPictureSource, picPiece) for the plate, its detail squares and
  the conflicts page, so the raised globe draws them (image sources vanish
  with terrain, as the base plate did in 118b). A click on another region of
  the open layer opens that one (atlasOutsideClick skips clicks on the
  owner's own layers). The numbered cities' tips have a solid box.
- Combine ticked layers: moved to the top of the layers menu (comboBox,
  #combo-box); while on, the combined rows' own marks are hidden
  (comboHideRows) and come back when it is off; modes and weights explained.
- F-gases: edgar_fgases_all (route valrelief, addValRelief: height tiles
  coded as Mapbox terrain, stepped bands and raised, p5 to p99 log) first;
  tiles edgar_fgases.py adds every gas x IPCC AR5 GWP-100 into one CO2e grid
  (tiles/edgar_fgases_all.pmtiles and _relief.pmtiles); powerbi_report out of
  F-gases (it stays under Environmental crime and illegal logging).
- Methane: carbon_majors and carbon_bombs out; Infrastructure heading gone;
  Culprits: methane_imeo_plumes, methane_imeo_top50, methane_ct_owners (tiles
  methane_culprits.py: UNEP IMEO MARS plumes and top-50 sites, CC BY-NC-SA;
  Climate TRACE assets with owners, CH4), skytruth_fracfocus, bocc; catalogue
  oil and gas concessions and wells to Culprits.
- Nitrous oxide: Emissions, then Culprits with h6 headings by source (Tian et
  al. 2020): Synthetic fertiliser (fertilizer_facilities), Crops
  (n2o_crop_fertiliser, soybean companies, soy industry bodies, Forest 500
  soy), Manure and grazing livestock, Fossil fuels and industry, Burning,
  Waste and wastewater, Fish farming (empty for now). trase_silos_brazil and
  site_china_grain out (PANEL_REMOVED). n2o_crop_fertiliser: countrycat with
  categories "auto" (new), tiles fertiliser_by_crop.py (IFA / Ludemann et al.
  2022 on Dryad, through Dryad's API).
- Land of Resistance row titled as the Latin America killings layer.

## Round 119b (30 September)

Needs round 118b. Tiles patch round119b_tiles.py beside it. No app.js?v= bump.

- Attacks rows read attacks/plain/*.geojson (tiles attacks_plain.py) first,
  the originals until built (files[].fallback in readGeojsonFiles): labels in
  English from a table of the sources' terms, longer texts machine-translated
  with Argos Translate on the build machine (cached in
  attacks/plain/translations.json, a time budget per run, so CIMI's 9,202
  cases fill in over several days), Brazil's state codes as names, the Land
  of Resistance's record dates as dates ("added to the database on"), CIMI's
  cases by family of violence (report chapter), Front Line Defenders' tags
  in English. Areas in land conflict drawn as municipalities (cgaz-boundaries
  BRA2, state rows as BRA), one shape per municipality and year, year bar.
- filterBy (filterByTokens): chips by a row's own fields, list fields under
  each value; groupLabel names the kind chips (default "Kind", was "Layer").
  gw_killings coloured and filtered by who killed them; land_of_resistance,
  frontline (rights at stake, violations), cimi, CPT rows likewise.
- Bundles killing_indigenous, defenders, brazil_land, homicides under
  Destruction > Of individuals > Of humans and again under Invasion of humans
  > Conflicts and killings. Water conflicts under Water scarcity;
  overexploitation under Slavery's cases and enforcement.
- Homicides: homicide_rates (World Bank VC.IHR.PSRC.P5, UNODC), homicide_cases
  (mvtlive tiles/homicide_cases.pmtiles: Chicago, LA, NYC, Washington Post 50
  cities), homicide_colombia (towns), homicide_wikidata; tiles homicides.py.
- Wreckers: one layer (bundle wreckers), London uMap and worldwide; worldwide
  grouped by Corporate Watch's own directory sections (tiles
  troutwood_layers.py), tobacco, airlines and shipping out, arms makers kept
  as Corporate Watch lists them; the company box says why it is on the layer.
- They Rule's page replaced by boards_interlocks (tiles boards.py: Wikidata
  board members, chairs and chief executives of the 500 largest companies,
  lines between companies sharing a person). EJAtlas below it, its ten
  categories named (EJ_CATEGORIES) and coloured.
- AUTO_GROUP_COLOURS 24; kinds past the colours said in the key; years in
  colour keys without commas; "as the row draws them" now "its own colours".
- Raised rows' hillshade lighter and gone by zoom 7.5 (the dark grey
  shading); glow cores and dots sharp (blur 0.12/0.15, cores at least
  1.8 px).
- WJP: wjp_discrimination_2022 (score_2022, ranks per edition, tiles
  wjp_discrimination.py). Global Witness countries: totals without the
  chart's LAT/LON, columns named (global_witness.py).
- rte_trade reads every flow (rte/trades_all_<year>.json, tiles rte.py) and
  shows every flow by default; carbon plumes read every page; Launch Library
  up to 60 pages.

## Round 118b (30 September)

Needs round 117b. Tiles patch round118b_tiles.py beside it. No app.js?v= bump.
The Worker changed too (route /v1/adsbmil): redeploy it.

- Globe went dark with a layer raised as ground: the vertical-perspective view
  cannot carry terrain. drawnProjection() now gives "globe" while terrain or a
  raised row holds the ground, and reliefGround switches it. The painted plate
  is now raster tiles (plate:// protocol, source and layer "plate-base"), left
  out of the colour remapping (GLAD_SKIP_SOURCES). Fixes the richest
  dynasties' points darkened at world view and the black globe with banking
  dynasties ticked.
- gladValue maps a two-stop interpolate or step stop by stop: the wrap made
  MapLibre refuse the Social Spheres' lines ("Type string is not
  interpolatable").
- shapeLift no longer adds before `${id}-line` (that layer did not exist yet;
  it broke other_invaded, settler colonialism, gmo_regime, treaties, trials,
  mil_alliances, remains_units).
- Countries raised by their own score: shapeColouring returns lift heights;
  rowLift adds a fill-extrusion `${id}-lift`; addCountryCatLayer, sitemap
  colourings and the trackers use it; riseRow stands national rows (by kind
  or drawsCountries) as countries, never as smoothed continent ground, and
  skips rows with cfg.centroids (state and country middles, head offices).
- Combine ticked layers (View box, new section): off / by how densely places
  gather / by each place's own figure (rank within its row: largest 1,
  smallest 0.1, none 0.5); each row scaled to its own top first, then weighted
  0 to 3 by the menu under it (COMBO, comboBuild, comboDraw). Rows' own bands
  step aside while it shows. Country rows are not folded in.
- Capture: capture_all (route "switch", parts capture_cases,
  capture_countries, capture_share, a menu under the row) under Of countries
  by countries and Politics as a front; the parts are in PANEL_REMOVED.
- Invasion of humans in h4 subheadings (How each country is invaded; Where
  Indigenous peoples and local communities live; Indigenous and community
  rights; Quality of laws protecting their land; Conflicts and killings);
  CATALOGUE_BY_TITLE files the tenure indicators, LandMark's population and
  land-share rows and the ITTs under them.
- Settler colonialism drawn with other_invaded (alsoShows), its own row out.
- Military: eight rows by kind of place from all four sources
  (military/kinds/*.geojson, tiles military_kinds.py), nuclear under its own
  h5, every part of the old layers a row; no one-colour choice (noOneColour);
  UCDP coloured by kind of violence or deaths, no bands; ADS-B through the
  Worker (/v1/adsbmil: adsb.lol, airplanes.live, adsb.fi).
- GMO: organisations and escapes from the map's own page (tiles gmo_seed.py),
  field-trial boxes list each release authorisation (gmo/trials), bodies
  brighter, gmo_act out, centroid rows not raised.
- Unearthings: records spread in a small spiral, findings brighter,
  remains_units, remains_help and remains_wire out, remains_fire only under
  Fire; density bands gone by zoom 7.5.
- Rows of 25 points or fewer get a pale ring (fewBeacon).
- Stock exchanges: no figure = hollow ring. Who keeps the profits: dark =
  keeps them (reverse). resourcetrade.earth: hover a country, only its flows
  and partners stay lit (rteHover). Trade imbalances: surplus or deficit, one
  at a time. Banking dynasties: filter by any measure, bowed lines, button
  "Complete Visual" closes by button, click outside or Escape.
- LandMark and FUNAI boxes titled by the area's own name, working fields
  hidden (gfwRecordBox, FIELD_WORDS); lighter = less protection on the tenure
  rows.
- Lazy geojsonlive and switch rows of the main LAYERS list wait for their
  first tick (TOP_DEFERRED), instead of asking for a .pmtiles they never had.

## Round 117b (30 September)

Needs round 116b. Tiles patch round117b_tiles.py beside it. No app.js?v= bump.

- Raise figures as heights, made quick (owner: "too slow or broken"): in the
  browser each relief square took one to four seconds, nearly all of it the
  canvas compressing a PNG on the page's thread, three times per square
  (colours, heights, shading), and every move of a tiles row threw all the
  squares away. Now rawPng writes an uncompressed PNG by hand (about 4 ms),
  reliefValuesOnce works a square's figures out once for all three, and
  crowdBuild keeps every point a tiles row has shown (pr.seen) and is remade
  only when a fifth more have come (pr.changed). POINT_RELIEF_MIN 30 to 1
  (rows of a few points rise too); riseRow waits up to 30 s for a slow row.
  Shapes rows shaded by a figure (slavery prevalence, treaties counted,
  trade shares) stand as fill-extrusions by that figure (shapeLift), like the
  country rows; rows shaded by kind still rise by coverage.
- Colour menu under every row of points (POINT_COLOUR, pcSetup): pmtiles rows
  from their tilestats (numbers: six steps spread between min and max, log
  when max/min >= 50; a few whole numbers or years: one step each; kinds of
  2 to 12 values), geojsonlive rows from their records (quantile steps),
  named rows from cfg.colourChoices (colourAuto:false leaves out the rest,
  colourPick the start). Teal to cobalt PC_RAMP for figures, AUTO_GROUP_COLOURS
  for kinds, PC_NONE grey. Glow kept: cores and soft surround take the
  colours, cores at least 2 px wide out when coloured. Rows already coloured
  (group or amount) open as drawn; "one colour" gives any row its old look.
  Key in the menu and in Showing (legendKeyPairs reads data-for="pc:<id>").
- Slavery rows: slavery_sites (kind and what was seen, workers, kiln size,
  kiln kind, impact, mineral, armed group; note says kilns are found
  positions from satellite pictures, not estimates, and the dataset covers
  only the ground its pictures cover); slavery_ports (country high-risk
  share, harbour size, port of entry; impact and exposure are 4 and 1 for
  every port, said in the note and the box); slavery_fishing (share of
  effort = the source's status, at-risk kWh, rank = its impact); fieldBox
  boxes with the record's paragraph (fb.prose, bold kept) and plain labels.
  Ports, fishing, enforcement and determinations read tiles
  slavery_points_*.pmtiles (archiveBefore the old copies).
- slavery_enforcement: workers found, impact, inspection year, year added.
  attacks_slave_labour_states: by workers freed (the sheet's TOT 1995-2020),
  not region. attacks_cpt_slave_cases: kind of work (as drawn), workers in
  the complaint, workers freed, year, minors; year bar (yearFrom).
- slavery_determinations: the eight whole-country determinations
  (DETERMINATION_COUNTRYWIDE) left off the points and read in the country's
  box on slavery_prevalence (box "slaveryprev", slaveryFindings: every
  projects.json row for the country, DOL listed goods in one line).
- slavery_routes: ticks for routes out of and into the country chosen;
  clicking a country picks it; partner countries shaded by people
  (boundaries feature-state rt_<id>, layer <id>-cty); the route under the
  pointer alone (<id>-hover, others to 0.18); direction marks along each
  route (<id>-dir).
- slavery_cases: says it counts people in the country where they were
  exploited (countryNote, note, display name).
- Discrimination: wjp_discrimination (WJP Rule of Law Index sub-factor 4.1,
  latest score, darker = lower) and wjp_discrimination_change (since the 2015
  edition), route country with cfg.reverse (new: darker for lower). Tiles
  wjp_discrimination.py reads WJP's historical data file. The article's own
  picture was not read (the page could not be opened here); WJP's data terms
  not checked.
- addCountryLayer says "N countries" when drawn. Unearthings remains_records-cl
  radius had zoom inside "*" (MapLibre refused the layer): fixed.

## Round 116b (29 September)

Needs round 115b. Tiles patch round116b_tiles.py beside it. No app.js?v= bump.

- Points: the glow orbs are back (owner: "return back to the glow orb look"),
  undoing 112b's solid dots: addHud adds haze, core and soft layers to every
  point layer again, dots soft-edged and unseen wider out; legibleCircle's
  light rim (POINT_RIM rgba(242,238,230,0.85), width 1). POINT_ZOOM sizing
  kept. smallLayerDots (geojson rows of 500 points or fewer) also sets
  circle-opacity 0.9 on a glowing layer, so few-point rows stay findable wide
  out (the reason 112b gave for the solid dots).
- capture_map (Drug underworld): countries shaded teal to cobalt in five steps
  in place of the page's greys (cfg.colouringColours, cfg.colouringEdge
  #08203F; sitemapColourings keeps edge; applySitemapColouring uses it).
- bld_police (Law enforcement), bld_courts and bld_prisons (Courts and
  corrections): the Buildings row's own files for one kind each
  (cfg.onlyKinds in addBuildingTypesLayer: one colour, no list of kinds,
  counts in the state line). Buildings keeps every kind.
- gang_infiltration (Law enforcement): 24 documented cases in 15 countries
  (tiles lawenforcement/gang_infiltration.geojson, compiled by hand from the
  sources each box quotes; groupColours by "A crime group working through
  police or officials" / "Officers running a gang or crime ring of their own";
  status field says how far each was proven).
- Holidays: holidays/culprits.geojson on tiles main has the 12 corporatizers
  (no VFW) since 114b; the live copy still showed the 103b file, so the
  tiles Pages deploy had not caught up.
- Tiles fertility_policy.py: a failed build (found false) retries daily, not
  only Mondays. The fixed script had not run since 111b.

## Round 115b (29 September)

Needs round 114b. Tiles patch round115b_tiles.py beside it (it also carries
lib/wdtools.py, so it works whether or not 114b_tiles went first).

- medical_culprits (Suppression > The medical industry), from the owner's
  suppression.html medical section (first half: paid prescribing,
  overprescribing addictive drugs, marketing, Bayer and others' HIV-tainted
  clotting products). Tiles medical_culprits.py: every row of Wikipedia's List
  of largest pharmaceutical settlements (company linked article -> Wikidata
  HQ), plus a compiled list (opioid makers, distributors, pharmacies,
  Sacklers, McKinsey; Cutter/Bayer, Baxter, Alpha Therapeutic, Armour) kept
  only if the cited Wikipedia article names them (whole word) at build time;
  the box quotes those sentences; dropped names in medical/build.json.
- Schools: the page's list (school section) was already mapped in round
  105b; NWEA is inside the HMH entry. Not mapped: the "Global Education
  Forum" (unclear which body) and university fossil-fuel investments
  (mappingfossilties.org, not read yet).
- Tiles capture_stb.py (the other chat's): the office-holder query timed out
  (504); now asked per country, then per 25-year birth span, with retries.

## Round 114b (29 September)

Needs round 113b. Tiles patch round114b_tiles.py beside it. No app.js?v= bump.

- holiday_culprits: corporatizers only (owner: the made-to-replace holidays
  out; "sales events" entries looked like companies that sold a lot around
  holidays). Kept 12 whose own write-ups say they made the holiday a company
  custom or invented one (Coca-Cola, Macy's, Montgomery Ward, Alibaba,
  Amazon, NRF, Father's Day Council, Ishimuramanseido, Cleveland
  confectioners, NCA, Lotte, KFC Japan); out: the six governments/bodies,
  JD.com, Hallmark and American Greetings (card counts only). Tiles
  holidays/culprits.geojson rewritten. Research for more corporatizers was not
  possible (web lookups unanswered); add from sources next time.
- New rows (Suppression > Sports): sports_facilities (tiles
  sports_facilities.py: Overture latest release via DuckDB on the open bucket,
  places with sport categories + base land_use sport classes by name, logged
  in sports/build.json; squares z0-7, each place z8 in strips via
  lib/pointtiles.py; drawn by addMvtCopy, colour by group), sports_betting and
  sports_fixing (Wikidata via lib/wdtools.py: kinds resolved by exact English
  name with subclasses, numbers logged; placed by own coords, HQ, location,
  country; fixing has a year bar).
- Animal rows made worldwide: animal_breeding_osm (OSM animal_breeding=*),
  zoos_aquariums_osm (tourism=zoo|aquarium, grouped by zoo=* or aquarium) and
  a probe of the Zoos Google map for aquarium names (probe/zoos_kml.json),
  from tiles animal_places_osm.py; pet_food_world (Wikidata industry/product
  pet food, pet food brand/company kinds, owners named).
- addMvtCopy generalised (_count for squares; unit in boxes); a copy-only row
  says "not built yet" until its build.json exists; waiting texts on the
  Wikidata/OSM rows.
- The medical-industry layer waits for the owner's Suppression-page HTML
  (not attached yet).

## Round 113b (29 September)

Needs round 112b. No tiles patch. No app.js?v= bump.

- Crowded point rows (owner chose "tinted bands and raised"): a point row of
  DENSITY_MIN (300) points or more gets a density surface whenever shown:
  ${id}__crowd-tint, raster from relief://<rid>/col in RELIEF_BANDS with
  contour lines, raster-opacity by zoom DENSITY_FADE (0.8 wide out, gone by
  zoom 10), under the row's marks; the hillshade and raised ground follow
  "Raise figures as heights" as before (bands stay flat with it off).
  densityKey: a band strip under the row. reliefPoints weighs merged marks by
  _count, point_count, n, schools or count (numbers only) and counts a mark
  read twice once; vector rows recount on moveend while banded, and wait for
  their squares (map idle, up to 4 tries). pointReliefGrid smooths three
  passes of radius 2 (about 200 km, was two of radius 1).
- Site-map dots slimmer wide out: radius 0.42r at z1, 0.58r z4, 0.82r z7, r z10.
- Themes kind by kind (owner chose "preset themes + wheel"): THEME_KINDS
  points / shapes / highlights; themeKindOf (circle, symbol, heatmap = points;
  source boundaries or -lift = highlights; else shapes); themeStepsFor;
  themeWrap and themeApply use the kind's matrix. THEME_PRESETS (Deep ocean,
  Glacier, Cobalt, Slate and bone, Basalt, Dusk, Signal, Ink), each a wheel
  point per kind (kindTheme), in a ring round the wheel (.tw-ring, split
  swatches); chips All / Points / Shapes / Highlights pick what the wheel
  turns (THEME_TARGET, THEME_WHEEL, localStorage culprits-theme-kinds).
  themeKeys gives shape and national rows their own CSS filter (:has()).

## Round 112b (29 September)

Needs round 111b. Tiles patch round112b_tiles.py beside it. No app.js?v= bump
(the other chat's next bump covers it).

- Points: the glow is gone (owner: "a solid sleek professional looking dot").
  addHud adds nothing except for HOTSPOT rows (their heatmap stays); dots have
  circle-blur 0 and are seen at every zoom. legibleCircle: radius without zoom
  scaled by POINT_ZOOM (0.45 at z0 to 1 at z10), edge POINT_RIM
  rgba(8,14,24,0.6) width 0.7 (a ring in its own colour keeps it).
  smallLayerDots: a geojson layer of 500 points or fewer keeps a size floor
  (4 px at z0-2, 4.8 to z6, 5.5 beyond). This was also the "layers vanish when
  several are ticked" report: their dots were invisible below zoom 9.
- spreadStacked (addSitemapLayer): places at the identical position are set
  round it on a small spiral (0.018 deg x sqrt(i)); areas and lines untouched.
- sitemapAutoKey: a sitemap with 2+ colours and no key gets a key from the
  filter whose kinds line up with its dots' colours (animal rows, Eyes).
  Showing uses the row's drawn swatch (legendSwatch).
- UFO bar: years under 1000 read "AD 19" (UFOSINT's earliest dated year is 19).
- capture_cases: year bar (YEAR_FROM: year, years, date, filed or announced,
  FARA dates, offices held; first 4-digit year), sitemapTime in
  applySitemapFilters; records with no year behind their own tick.
- site_eyes_network: subtitle (a hypothesis, not an established fact), about
  (the interactive's framing, legend and Bernays quote) behind the i
  (infoMark now keeps paragraphs; #row-tip pre-line), and a button opening the
  15 entries with no place (sitemaps/site_eyes_network.unplaced.json;
  rich_maps.py now writes it).
- Advertising, news, entertainment: owners tabs added (tiles sitemaps files
  rebuilt from each page's DATA_CO and DATA_OWN with its own popups: 81+48,
  64+45, 61+35); titles plain ("The advertising industries" etc.), kinds
  alone, owners rows "Who owns them: ...". Note: pipeline build_boxes.py only
  reads the tab a page opens on; rebuilding these three from it would drop
  the owners again (gen script in this round's notes).
- site_food_system: straight under Meat and agriculture above land_matrix, and
  under Suppression > The food and drink industries; "The culprits" h5 gone.
- final_nail row out (PANEL_REMOVED); its farms are in fur_world.
- giga_school_points: copy (tiles scripts/giga_points.py, weekly): Giga's
  tiles read at zoom 7, squares 2/0.5/0.1/0.02 deg for z0-7, each school from
  z8, strips where over 90 MB; addMvtCopy draws it; live tiles until built.
- Hologram: floor grid only while zoom < 3 and pitch < 20; holo-relief off
  while 3D terrain is on (the "vertical lines" report).

## Round 111b (29 September)

Needs round 110b. Tiles patch round111b_tiles.py beside it. Made alongside the
other chat's 110c to 112c; touches none of their rows. Leaves app.js?v= as it
is, so the other chat's next bump is not in the way.

- ForestAtRisk (Cirad, EC JRC), probability of deforestation 2020: Cirad
  answered on 29 September that it is "in principle happy to support
  non-commercial educational use of the prob_2020 map". Row forestatrisk
  (route rasterparts) leads Deforestation > Tree cover loss and alerts > Where
  clearing is likely; ten equal steps of probability, teal to cobalt. Built by
  tiles scripts/forestatrisk.py from the three 30 m COGs on
  forestatrisk.cirad.fr/tropics/tif/ (prob_2020_{AME,AFR,ASI}_aea.tif, values
  1 + p x 65534), warped to zoom 9 (about 300 m; FAR_MAXZOOM=10 for 150 m).
  addRasterPartsLayer now takes cfg.stateSay.
- Refresh of 29 September, nine failures, fixed in tiles: aqueduct (crop table
  paged through GFW's query), atlas_insets (count vs list), fertility_policy
  (2019 fertility file; multi-row headings), fish_rivers ("Layer:" lines),
  ftw_overview (list-type=2; it looped on page one), ifl (authors'
  GeoPackages first; GFW "latest" is 404), inpe_fire (two builds joined, 84
  MB), public_harm (IMF unpack), slavery_world (UNODC's new portal; CBP 403
  no longer fails the run). Notes for inpe_fire_2023 and fertility_policy say
  what changed.
- Read after that refresh: fur/farms.geojson has 778 farms (Final Nail 270,
  Farm Transparency 335, OSM 265 less overlaps), Final Nail's own map fields
  kept as "Final Nail: ..."; spam/build.json has no licence text (readme {});
  probe/nusantara/health.json: 18 Nusantara layers draw nothing at zooms 2 to
  8 (finance, refineries, Papua, Merauke, Rawa Singkil, sago, 10 km buffer);
  probe/crime: ILAT is a Tableau view, TRAFFIC's portal a script page, no
  files; probe/enforcement not yet mapped.

## Round 113c (29 September)

Needs round 112c. Tiles patch round113c_tiles.py beside it (carries 111c and
112c's tiles files too).

- capture_cases box (CARDS.capture, cfg.card "capture"): a plain paragraph
  first (tiles writes it as "summary", one wording per part), then what proves
  it and the branch, where the point is and why, the source and links; every
  field in the fold.
- Truer places (owner: too many cases stacked on one point). tiles capture.py:
  refine_places moves anyone with a Wikidata record to the constituency they
  were elected for (P768 on P39), the subnational place their office covered,
  or where they worked; people with no office to where they worked, lived or
  were born; the capital stays only where nothing finer is recorded.
  place_addresses geocodes FARA principals (city, only if in the represented
  country) and development-bank debarred firms (address) with Nominatim,
  1,500 new lookups a run, cached in capture/geocache.json. Colombian members
  of Congress compiled by name are matched to Wikidata where exactly one
  Colombian citizen has that name.
- List items that are not people (Mitrokhin's operations sections linked
  HIV) are left out; Mitrokhin reads only its spies and accused sections.
- Script version app.js bumped.

## Round 112c (29 September)

Needs round 111c. Tiles patch round112c_tiles.py beside it (it carries 111c's
capture.py too).

- First capture run (29 Sep): 2,796 cases (936 Wikidata, 1,799 lists, 61
  compiled). Fixed in tiles from its log: Wikidata kinds found by name that are
  not spying (militsiya, open-source intelligence, a skin mole, a sauce,
  fictional ninjas, unnamed items) dropped and listed; query c (company people
  convicted) split, it timed out; es.wikipedia parapolitics headings are
  Firmantes (Ralito pact signers, ties) and Principales detenciones (alleged);
  Mitrokhin "Accused but unconfirmed" -> alleged; SEC 403 -> "name email"
  User-Agent with gzip; DOJ year pages taken from the index's links (1987 and
  2014 on had other addresses); IPN failed every page on its certificate chain
  -> certifi, then unchecked for its public pages, crawl restarted.
- New tiles scripts/capture_stb.py: Slovak UPN StB registration books searched
  for every Czech, Slovak and Czechoslovak office holder in Wikidata (born before
  1975), kept only where the record's birth date equals Wikidata's; agent,
  informer, resident, secret collaborator, confidant -> archive; candidates ->
  alleged; watched people (NO, PO) and file kinds not drawn. Merged as part stb.
- Probes now save the Czech ABS records search, protocols and help pages and a
  sample UPN result page, for the Czech register next.
- Script version app.js?v=1004.

## Round 111c (29 September)

Needs round 110c. Tiles patch round111c_tiles.py beside it.

- capture_countries and capture_share (route country, beside capture_cases in
  both places), read from tiles capture/by_country.json: cases per country by
  the Natural Earth 50m shape each point falls in, split by tier and branch;
  the legislature's seats today (Wikidata P194 -> P1342, or its chambers'
  sum); lawmakers found per 100 seats today. A case standing for many people
  ("people in this case": Colombia 86, Japan LDP 179) counts as that many when
  larger than the people found one by one.
- capture.py also reads: secret-police collaborator categories on the lt, lv,
  et, hu, sq, ru, uk, hr, sl, sr Wikipedias; development banks' debarment lists
  via OpenSanctions (index.json, datasets whose title/publisher name a bank and
  a debarment; tier inquiry, CC BY-NC 4.0); FARA foreign principals (DOJ bulk
  zip, tier ties, at the principal's country's capital).
- Still to do: Czech ABS and Slovak UPN StB registers (waiting on
  probe/capture/ from the first capture run).
- Script version app.js?v=1003.

## Round 110c (29 September)

Needs round 110b. Tiles patch round110c_tiles.py beside it. Takes the place of
this chat's rounds 109c and 109d (never uploaded; do not upload them now).

- capture_cases: "Planted, bought or captured", worldwide, every branch and
  companies, every tier of proof marked (owner: all tiers, ties and allegations
  included, each marked). Under Invasion of humans and Politics as a front.
  Coloured by tier (court, inquiry, archive, admitted, served a spy service,
  ties, settled with a regulator, alleged); the box gives the branch and who
  they worked for.
- Built by tiles scripts/capture.py (weekly): Wikidata office holders who
  served a spy service or secret police, office holders and company staff
  convicted of spying, treason, bribery and the like; Wikipedia's Venona list
  and Mitrokhin article; secret-police collaborator categories on the cs, sk,
  pl, de, ro and bg Wikipedias (placed via Wikidata citizenship); es.wikipedia
  parapolitics lists; every SEC FCPA case, one point per country named; every
  DOJ FCPA case since 1977 (chronological lists), at the court district's city;
  about 60 compiled cases with sources (Colombia by name, LDP and the
  Unification Church, Qatargate, NSICOP, US copy-paste bills, Stasi informers,
  Garcia Luna, Noriega, kids-for-cash judges, Odebrecht in 12 countries, Babis).
- Poland: tiles scripts/capture_ipn.py reads IPN's catalogue of people in
  public office (katalog.bip.ipn.gov.pl/informacje/<n>) a slice a day,
  resumable (capture/ipn_state.json); keeps TW/KO/agent registrations
  (archive), lustration rulings of untrue declarations (court) and candidates
  (alleged). capture.py merges capture/ipn.geojson.
- Probes (Czech ABS registers, Slovak UPN regpro, one IPN entry) saved to tiles
  probe/capture/ for a later round: match register entries to office holders by
  name and birth date.
- None of the tiles readers could be run from the sandbox: read
  capture/build.json and capture/ipn_build.json after the first runs.
- Script version app.js?v=1002.

## Round 110b (29 September)

Needs round 109b. Tiles patch round110b_tiles.py beside it, and a new
repository, culprits-tiles-gases, whose one file is .github/workflows/build.yml.

- culprits-tiles-more reached 11 GB and GitHub Pages stopped publishing it
  (limit 10 GB). The Climate TRACE by-gas archives (co2/ch4/n2o, 5.6 GB) move
  to culprits-tiles-gases: CT_GASES_BASE points there; NEO_COPY stays on
  culprits-tiles-more. That repo's workflow runs culprits-tiles-more's
  gases/run.sh: seed (copies the archives from tiles-more at 64ba5fd, once),
  then ct_gases, ct_gases_ch4, ct_gases_n2o daily.
- Script version app.js?v=1001.

## Round 109b (28 September)

Needs round 108b. No tiles patch.

- Of the insentient: heading without quotation marks.
- The Raise where the points crowd chip is gone. With Raise figures as heights on,
  riseRow() raises every row: pictures by coverage (rasterRiseSet), points, areas
  and lines by count/coverage on a 0.25 degree grid (pointReliefSet, shapeCover),
  read bilinearly; no tint layer, only height and shading. Tile-read rows are
  recounted on moveend while they hold the ground.
- Alert rows (gfw, gfw_dist, gfw_dist_year): recolorAlerts gives GFW's three
  confidence pinks (gfw-tile-cache alerts.py) three steps, ALERT_TONES; keepColour;
  key under the row.
- Layer colours: a colour wheel (THEME_CUSTOM, customTheme, themeWheelWire) with
  a brightness slider and As drawn / Suit basemap buttons; theme 'custom'.
- Atlas cities: a click opens only #atlas-city (no popup). #atlas-panel[hidden]
  and #atlas-city[hidden] now display:none (their inline display:flex had kept
  them showing). ac-grow button top left; atlasCityKey shows the conflicts-map
  key from atlas/legends.json, labelled as such.
- test.mjs: appVersion(html) >= N replaces the per-round version regexes.
- Script version app.js?v=1000.

## Round 108b (28 September)

Needs round 107b. No tiles patch.

- Carries the revised 107b, which could not apply over the first 107b: the
  threat index (threat_*), V-Dem (vdem_*) and AI (ai_threat_*) rows are out;
  the owner dropped those requests. The 107b note below describes the first 107b.
- The note on dragging rows (#layer-drag-hint) sits above the Selected Layers
  heading; Reset layers menu stays under the layers.
- Reliefs: RELIEF_BANDS, eight stepped tints teal to cobalt, no white, darker
  line where steps meet; RELIEF_SHADE (igor, no highlight) over the tints.
- Picture rows rise under Raise figures as heights (RASTER_RISE, rasterRiseSet):
  height is the share of ground the row's own picture paints, 16x16 blocks.
- remains_fire reads GIBS's epsg4326 WMS with SRS=EPSG:3857 (the 3857 WMS does
  not draw vector layers).
- Script version app.js?v=999.

## Round 107b (28 September)

Needs round 106b. Tiles patches round107b_tiles.py and round107c_tiles.py beside it.

- ai_threat_overall/destruction/suppression/crime: country rows under Where the
  threat is greatest, from tiles threat/ai.json (scripts/ai_threat.py, Google
  Gemini free tier, needs repo secret GEMINI_API_KEY passed as env in
  refresh.yml's Run step; picks 20 per category with reasons; numbers checked).
- Pastoral Land Commission tables: attacks_cpt_areas, attacks_cpt_land,
  attacks_cpt_water, attacks_cpt_overexploitation (Of individuals > Of humans),
  attacks_cpt_slave_cases (Slavery > Cases and enforcement).
- inpe_fire_2023 (pmtiles, fine) under Destruction > Fire, built by tiles
  scripts/inpe_fire.py from attacks/inpe_fire_foci_2023.geojson.gz.
- Land of Resistance keeps dates of birth and photo links (owner's word).
- Script version app.js?v=998.

## Round 106b (28 September)

Needs round 105b. Tiles patch round106b_tiles.py beside it (attacks/*.geojson).

- View box: Globe, Flat map, Layer colours (narrow, under Flat map), compass
  with Place names, Snap back and Leave Earth (the wide colour menu had pushed
  them out of the box). New box "3D terrain": the tick, the notes on moving in
  3D, then Raise figures as heights with a line saying what it does.
- Turn on every: under the layers (box.after); says "Turning off" when
  turning off; catalogue rows for boundaries or figures by country, province or
  district are national; a Shapes row that turns out to draw countries
  (drawsCountries: country codes or names) is untucked and filed national.
- lighterPointSources: a GeoJSON source of points only gets maxzoom 12, so
  zooming in no longer re-cuts hundreds of sources. mapBusyMark: "Loading..."
  at the top of the map while it reads; a notice on WebGL context loss.
- revealSubRows: ticking a row with sublayers (group kids, facets, type rows)
  opens them and scrolls the menu to show them (trusted events only).
- Attacks On Activists (owner's collection): attacks_gw_killings,
  attacks_land_resistance, attacks_frontline, attacks_cimi, attacks_caci,
  attacks_cpt_violence, attacks_cpt_threatened, attacks_cpt_massacres,
  attacks_public_agencies (Of individuals > Of humans),
  attacks_slave_labour_states (Slavery > Cases and enforcement),
  police_stations_latam (Law enforcement). autoGroups colours kinds by count.
  Land of Resistance dates of birth and photo links left off.
- Script version app.js?v=997.

## Round 105b (28 September)

Needs round 104b. Tiles patch round105b_tiles.py beside it.

- Where the threat is greatest (new h1 under Selected Layers): threat_overall,
  threat_destruction, threat_suppression, threat_crime (country rows, linear
  0 to 1) from tiles threat/index.json, written daily by threat_index.py:
  percentile ranks of the map's own country figures (GOC 2025, IMF subsidies,
  OWID CO2 and V-Dem, Global Witness, Walk Free), averaged per category and
  overall. Not an AI's opinion; the box lists each figure and rank.
- V-Dem: nine owidgrapher rows (vdem_*) under Politics as a front.
- troutwood_companies (colourBy market_cap) under The stock market and
  wreckers_world (groupColours by industry group) under Destruction > General,
  both from tiles troutwood_layers.py (reads troutwood/core.json). card:
  "company".
- PANEL_REMOVED: cfr_tracker, tableau_zsf (policy_rates and imbalances are the
  map's own), troutwood, site_banking_dynasties_charts.
- site_banking_dynasties: links (tiles banking/dynasty_links.geojson, 115
  lines from each family's origin to its cities, coloured by era, width by
  peak wealth; box with dates, wealth, contemporaries, shared cities) and a
  "Timeline and comparisons" button opening pages/banking_dynasties.html in a
  window (sitemapLinks, sitemapTimelineButton, openTimelineWindow).
- CARDS (bank, company) for geojsonlive rows with cfg.card: headline figure,
  rank, facts in words, links, every field folded. largest_banks and
  development_banks use card "bank"; development_banks now every development
  bank in Wikidata (tiles largest_banks.py).
- colourBy label; "Coloured by" line uses fieldLabel.
- getJsonOnce reads NaN/Infinity as null (policy_rates said "unexpected
  token"; tiles trackers.py no longer writes NaN).
- school_culprits: five new groups and colours for the 25 entries added from
  the Suppression page's list.
- Script version app.js?v=996.

## Round 104b (28 September)

Carries rounds 101b, 102b and 103b as well (their patches were not applied on
main: 101b was never uploaded, so 102b and 103b stopped in patches/failed/).
Needs round 100b. Tiles patch round104b_tiles.py beside it (it carries the
101b and 103b tiles files too).

- School moved under Suppression by "representation" within it: school_culprits
  (19 sourced entries, tiles schools/culprits.geojson), giga_school_points (new
  route mvtlive: Giga's own school tiles, /api/locations/schools/tiles/, address
  from tiles giga/schools_tiles.json written by giga_schools.py), giga_countries.
- Control of physical resources: Taxes (owid_corptax), Interest (owid_interest),
  Aid (owid_aid) as headings; Economic inequality keeps Wealth concentration and
  The stock market (stock_exchanges, tiles stock_exchanges.py from Wikipedia,
  colourBy market cap). Living off the land out (PANEL_REMOVED).
- Social spheres: line width, colour and opacity by shared people over the
  layer's own range (exponential), heavy on top, with a key.
- rte_trade: ends on a ring round each country facing the partner (rteEnd),
  exports and imports offset; line-gradient light blue (leaving) to red
  (arriving); largest 50 by default; a one-country menu.
- site_trade_profits shaded from "% foreign" in its details (SHAPE_COLOUR_BY),
  light for less, dark for more.
- GTA "in force" said as "Still in effect today (not yet ended or removed)".
- fieldRows labels through fieldLabel (FIELD_WORDS, FIELD_TOKENS); the
  source's own field name kept as the row's tooltip.
- Script version app.js?v=995.

## Round 103b (28 September)

Needs round 102b (runs after it by name). Tiles patch round103b_tiles.py beside it.

- capture_map: keepColour + recolour (keys without "#") by the page's kind
  colours into distinct reds, pinks, browns, bone, greys, blues and teals, with
  a key. sitemap recolour takes a colour alone or [colour, size].
- site_research_integrity: typeTitles (plain kind names), recolour, standout
  {keep:true} (ring in each place's own colour). research_makers (geojsonlive,
  tiles research_makers.py reads both tabs of the page) under Science.
- fertility_policy (countrycat, tiles fertility_policy.py, UN World
  Population Policies 2021 reproductive health module; column found by heading)
  under Suppression > Sex.
- holiday_culprits (geojsonlive, tiles holidays/culprits.geojson, 21 entries
  compiled 28 September from the Wikipedia articles cited in each) under
  Holidays.
- "N places here" lists one line each (flex, nowrap, ellipsis), 440 px wide,
  scrolling past 340 px.
- Headings draggable: grip-h on every heading line (mouse can drag the line);
  moveHeading inserts above/below another heading or row.
- Slavery: Routes and Cases and enforcement apart; slavery_convicted_world,
  slavery_detected_world (UNODC via tiles slavery_world.py) and
  slavery_cbp_world (US CBP WROs and Findings, country label points);
  slavery_enforcement retitled for what it is (Brazil's register).
- pipeline/shapes/registry.json: slavery_trackers no longer retired (it 404ed);
  the tiles patch also carries a fresh build of it.
- Script version app.js?v=994.

## Round 102b (28 September)

Needs round 101b (runs after it by name). Tiles patch round102b_tiles.py beside it.

- Destruction: Of groups keeps Of humans only (Of animals, Of plants, Of
  microorganisms, Of the insentient gone); Of individuals keeps Of humans and
  Of animals (Of plants, Of microscopics gone).
- site_insentient: cfg.dropTypes (sitemapDropTypes) takes out "Bottled &
  decorative water", "Collectibles & novelty", "Luxury & fast fashion" from its
  type rows and its places.
- Christmas trees: xmas_trees (geojsonlive, tiles christmas_trees.py: OSM tags
  and names in many languages, worldwide, merged with the Real Christmas Tree
  Locator My Maps file) in place of mymaps_trees (PANEL_REMOVED).
- esa_risk: drawn round the flat world too (ring from its corners), pullBack on
  turning on (globe or flat), FREE_FLAT shared by rows (freeFlatFor), and the
  see-through bar reaches canvas rows (ROW_OPACITY_HOOKS; worlds too).
- Launches retitled (The Space Devs); pads' "On a map" link gone.
- Eyes: warmSpace on pointerenter/focus of Leave Earth and below handoff+2;
  map hidden and stopped while away (pauseMapWhileAway).
- biosignature cards: a picture from the Wikipedia article on each world
  (REST summary; WORLD_ARTICLES for shared names; exoplanets said to be
  artists' impressions).
- CATALOGUE_FIRST also by item.name: Global_AllExpansionRGB_2000to2025 leads
  Plantations of no single crop.
- Script version app.js?v=993.

## Round 101b (28 September)

Needs round 100b (runs after it by name). Tiles patch round101b_tiles.py beside it.

- Agriculture reorganised: Cropland holds ftw_fields, potapov_cropland, the new
  crops_spam (every SPAM 2020 crop as a menu) and "Plantations of no single crop
  (single crops are under By crop)" (PLANTS) with bundles plantall and
  plantsmall (2024 + 2025 each) and idnplant. New h5 "By crop" (CROPS):
  Palm oil (h7 subs; bundle palmco = company oil palm 2024 + 2025), Soy, Cocoa,
  Coffee, Sugarcane, Maize (corn), Rice, Cotton, Coconut, Sago; each crop has
  its own SPAM row crop_<code> (tiles mapspam.py). CSS panel-h7, panel-h8.
- Taken out: wri_cmr_agro_industrial_zones, v3p3_concessioniop_spv (same
  layer as concessioniop_spv, as the concessionother pair is record for record
  in probe/concessions.json). powerbi_report out of Of animals.
- Timber: concessionitp_spv, socialforestryht_spv, HTI / timber / pulpwood
  plantation rows to Deforestation > Timber and rubber plantations
  (concessionitp also Wood pulp, Indonesia); reforestable carbon rows to
  Climate > Carbon dioxide > Carbon stored in nature; coconut and sago
  plantations to By crop. Soy fields also under By crop > Soy.
- Plain titles for every palm oil row (mill lists, buffers, refineries,
  finance, concessions), gfw_pre_2000_plantations, Forest 500 soy.
- site_forest500_soy: recolour (the page's four colours = its four score
  bands; red worst to blue), sizes, key (sitemap cfg.recolour).
- Layer colour themes: View box "Layer colours" (LAYER_THEME, localStorage
  culprits-theme): As drawn, Suited to the basemap (atlas/outlines bright,
  satellite reds), Brighter, Deeper, Reds and pinks. CSS-filter matrices on
  every non-base colour (themeValue/themeExpr), raster brightness/saturation/
  hue, keys by CSS filter (#theme-keys). Hooks in setPaintProperty, addLayer,
  removeLayer.
- Nusantara WMS: sources bounded by place (NUSANTARA_BOUNDS); seen:// clears
  pixels under alpha 24 and grows round, fading spots (growRound) in place of
  square blocks; the server key goes through gladpx so it matches the map.
  Trase regions under 1 degree drawn as dots below zoom 5 (_small).
- gfw_planted_forests drawn from its v20231128 raster tiles (GFW_FIXED): the
  newest version has only dynamic tiles.
- New: iuu_vessels (country, Combined IUU Vessel List by current flag; tiles
  iuu_vessels.py) under Fishing and Environmental crime.
- By hand in tiles: crime_probe.py (ILAT, TRAFFIC terms) and
  nusantara_health.py (why palm layers fail or draw only close in). Read
  probe/crime/*.json and probe/nusantara/health.json next round.
- Script version app.js?v=992.

## Round 100b (28 September)

Needs round 99b (runs after it by name). Tiles patch round100b_tiles.py beside it.

- Menu: Animal skin and fur farms is its own h3 (after Meat and agriculture);
  Meat ends with The culprits (site_food_system) and Meat grown from cells
  (cultivated_meat_laws, retitled "... as an alternative to slaughter ...").
- Biodiversity > Wildlife and timber crime: goc_flora, goc_fauna in place of
  the Power BI page. pe_subsidising (page) replaced by bundle publicharm:
  wb_harm_projects (World Bank Category A / High risk projects at their own
  locations, colourBy commitment) and imf_fossil_subsidies (IMF via Data360,
  country, % of GDP) from tiles public_harm.py.
- abattoir_facilities: zoos not marked as slaughtering filtered (where on
  x_activities); title without zoos.
- colourBy on bocc, largest_companies, largest_banks, development_banks,
  pe_banks, haz_ncei_quakes, haz_eruptions, haz_tsunamis; amountWords says
  billion/trillion and keeps a decimal under 100.
- Heights: RELIEF_BOOST 3 (world view, easing to the old lift by zoom 5);
  country rows get a fill-extrusion ${id}-lift by the same scale as their
  colour (LIFT_TOP 800 km at z0), "Raise figures as heights" in the View box
  (LIFT_ON, setLift); point rows (sitemap and geojsonlive, 30+ points) get a
  chip "Raise where the points crowd" (POINT_RELIEFS, 0.25 degree grid,
  smoothed, through the relief:// protocol).
- Fish: fish_rivers (Grill et al. 2019 free-flowing rivers, rasterlive from
  tiles fish_rivers.py) and fish_basins (Tedesco et al. 2017, pmchoose numbers
  native / introduced / endemic, tiles fish_basins.py).
- ftw_fields: overview raster wider out (tiles ftw_overview.py: fields per
  100 km2 per one-degree square from the download tiles' parquet footers).
- Hologram: "Blue shading" option (opt.shade, body.holo-noshade).
- Script version app.js?v=991 (older tests match a two-digit prefix).


## Round 99b (28 September)

Needs round 98b (runs after it by name). Tiles patch round99b_tiles.py beside it.

- Biodiversity loss in the owner's order: Land Use and Ecoregions; Places that
  matter most for species (Where species are threatened, Protected areas,
  Species richness, Wild and intact places, Where animals gather and migrate);
  Disturbance; Birds; Fish; Soil biodiversity; Wildlife and timber crime;
  Companies and financiers. Protected and conserved areas and Intact and
  primary forests headings gone (their rows moved in). BIO_* constants and the
  first block of CATALOGUE_BY_TITLE.
- Global Safety Net: ITTs under Invasion of humans; HM90 black (27, same asset
  and value as the white 40) and "Land" (42) out; climate stabilization areas
  under Climate > Carbon dioxide > Carbon stored in nature; constrained
  reforestation also under Deforestation > Forest cover; natural/barren,
  semi-natural and herbaceous land under Land Use and Ecoregions; the two BII
  halves one row (bundle bii); critical habitat land and sea one row (bundle
  crithab, with own_critical_habitat); conservation priorities grown and light
  (GSN_GROW 98).
- FAO ecological zones coloured by zone (GFW_COLOUR_BY gez_term); FAO zones and
  both SBTN Natural Lands rows under Land Use and Ecoregions only.
- Own copies (tiles): ecoregions_2017 (RESOLVE, pmchoose classes by BIOME_NUM;
  GSN's row 28 out) and ifl_2000 to ifl_2025 (pmvector own; GFW's year rows
  out) inside bundle ifl with GFW's all-years picture.
- WWF ecoregions retitled (2001 version, 867 regions).
- soil_nematodes coloured by Total_Number; soil_spun retitled.
- Kept, not deleted: Nusantara's protected areas (Equatorial Asia) and GFW's
  licensed WDPA: both carry each area's name and details, which Global Safety
  Net's pictures do not.


## Round 98b (28 September)

Needs round 96b (runs after it by name). Tiles patch round98b_tiles.py beside it.

- Atlas numbers: hovering a numbered city shows its own name and population
  (atlasNumberTip), and the hotspot's note is held back there.
- A click on the map that nothing else takes closes the open hotspot or city
  (atlasOutsideClick) and flies back to the view from before it was opened
  (atlasRemember / atlasClose). Clicks on boxes, numbers and panels are not
  counted.
- Five hotspot maps now placed, by their coasts laid on Natural Earth 1:10m
  land (pipeline/atlas_plates.py place_by_coast, the fallback when towns and
  the drawn outline fail): Madagascar, New Caledonia, Southwest Australia,
  Western Ghats & Sri Lanka (scale 0.65 of its bar, which the towns fit
  found too), East Melanesian Islands. Typical coast error 2 to 8 km. Checked
  on six town-placed pages: middles within 6 to 90 km of the towns fit.
- City maps: the pictures print no place names, so the method 2 placements
  were from misread words; only a method 3 placement is laid down. Otherwise
  the Atlas's picture opens in a panel (atlasCityShow), full size on click.
  The box button reads "The Atlas's map of this city".
- gsn_countries says "not built yet" instead of 404 until gsn_rankings runs.
- Tiles: atlas_insets.py found no conflicts page in 9 PDFs (case of
  "| Conflicts"); failed look-ups were cached as not found. Fixed, method 2,
  Natural Earth populated places as fallback. atlas_pdfs.py asks for PDFs of
  Indo-Burma, Polynesia-Micronesia, Irano-Anatolian, Tumbes-Choco-Magdalena
  (atlas/pdfs_looked_for.json).
- New Caledonia and East Melanesian Islands have a conflicts page but no
  numbered cities in the Atlas.


## Round 96b (28 September)

Needs round 95b (runs after it by name). No tiles patch.

- View box: 3D terrain under Globe / Flat map; Place names under North up,
  level; the 3D notes rewritten plainly under a heading ("Moving the map in
  3D"), the box's whole width. Zoom buttons 36 px, centred in the space right
  of the basemap choices.
- col_frontera_agricola under Deforestation > Forest zoning and management
  plans (not Plantations, not Where clearing is likely).


## Round 95b (28 September)

Needs round 94b (runs after it by name). Tiles patch round95b_tiles.py beside it.

- Back: Intact Forest Landscapes, every year (keepIntact), under Intact and
  primary forests; cultivated_meat_laws under Meat; site_ufo_pre1900 under UAP;
  slavery_trackers under Slavery (new h5); site_subsistence_cultures and
  site_self_sufficiency under Control of physical resources > Living off the
  land; new h3 Environmental law (site_environment_law, _shapes,
  enviro_law_by_country, ect_secrets, isds_tracker).
- Berkeley Earth's temperature anomaly under Natural disasters > Extreme heat.
- Out: LAPIG worn-out pasture. Paraguay's cattle herd size (CATTLE HEADS) under
  Meat > Herds. Colombia's frontier only under Where clearing is likely.
  Plantation and expansion titles lose "worldwide" (notWorldwide).
- PLAIN_NAMES: everyday names for ~55 static rows, applied at start
  (fixedName), Land Matrix explained.
- abattoir_glw: route glwrelief, raised by density per animal (tiles
  glw_relief.py, GLW4 2020 10 km), FAO's picture until built.
- New rows: plastic_polluters (tiles plastic_polluters.py: BFFP 2023 top ten,
  Wikidata HQs and subsidiaries, OSM plants and offices), skin_farms (tiles
  fur_farms.py), ocean_acid, ocean_heat (CRW SST anomaly, bleaching alert, DHW),
  ocean_shipping (World Bank), ocean_impacts (Halpern 2019) from tiles
  oceans_more.py.


## Round 94b (27 September)

Needs round 93b (runs after it by name). Tiles patch round94b_tiles.py beside it.

- Out: Liberia's three mining rows, Merauke's planned roads, Nusantara's copy
  of the Allen Coral Atlas (benthic_allencorral_global: broken, and the same
  warm-water reefs as allen_coral).
- Fur farms (h4) under Meat and agriculture: fur_world (tiles fur_farms.py:
  Farm Transparency Project, Final Nail, OpenStreetMap, antyfutro Poland;
  merged within 300 m), final_nail, fur_bans (route countrycat, OWID
  fur-farming-ban).
- Natural disasters: Every kind together (haz_gdacs, haz_eonet), Earthquakes
  (skytruth_quakes, usgs_quakes M5+ 1900 on, haz_ncei_quakes), Volcanoes
  (GVP Holocene, NCEI eruptions), Tsunamis (NCEI), Tropical cyclones (IBTrACS
  since 1980, pmchoose lines by Saffir-Simpson), Landslides (NASA GLC); tiles
  natural_hazards.py. Floods only inside GDACS/EONET (Dartmouth archive has no
  download link found).
- Timeline (addTimeline, timelineExpr, joined in applyFacet) on skytruth_quakes
  (2011-2015, month by month) and usgs_quakes.
- powerbi_report (Environmental Crime Tracker) also under Environmental crime.
- The 1996/2016/2020 mangroves bundle under Deforestation > Mangroves.
- Oceans: Dead zones (WRI eutrophication/hypoxia), Deep-sea mining (ISA
  contract, reserved and protected areas); tiles oceans.py.
- tiles concession_probe.py (by hand) counts Nusantara's "concessions of other
  kinds" by kind fields, for the mining vs clearing share asked.


## Round 93b (27 September)

Needs round 92b (runs after it by name). Tiles patch round93b_tiles.py beside it.

- Surface water's rows (jrc_water, the waterwatch bundle) under Water scarcity;
  every catalogue "> Surface water" path is "> Water scarcity". The Borneo
  surface water change (Nusantara) out.
- "Anywhere water was ever seen": the JRC has no extent tiles (404 in both
  buckets); drawn from the occurrence tiles in one colour.
- Reservoirs (Global Water Watch): red below usual, blue above (GFW_COLOUR_BY
  sign specs; waterSignExpr): anomalies2 by its anomaly; anomalies at the latest
  month with numbers, by that month's anomaly if its column holds negatives,
  else area against the _monthly area. WATER_* colours kept as written.
- nexgddp_change_dry_spells_2000_2080 drawn at 0.42 opacity (GFW_RASTER_PAINT).
- Aqueduct: aqueduct_proj (WRI projections file, menus measure/year/scenario/
  level-or-change, coloured by WRI's labels in the order of their values) and
  aqueduct_crop (GFW's data-lake copy, crop menu, five steps) as route
  pmchoose from tiles aqueduct.py; GFW's test_wat_006 and
  aqueduct_crop_baseline_2020 rows out. Scenario codes read as 24 optimistic
  (SSP2 RCP4.5), 28 business as usual (SSP2 RCP8.5), 38 pessimistic (SSP3 RCP8.5).


## Round 92b (27 September)

Needs round 91b (runs after it by name). No tiles patch.

- glc_fcs30d (land cover in 35 kinds) under Biodiversity loss > Land Use and
  Ecoregions; osm_landuse (land use plot by plot) under Buildings, after
  building_types; sbtn_natural_forests_map under Deforestation > Forest cover.
- Peatland is a sub-heading of Deforestation (after Mangroves); every
  "> Peatland" path is now "> Deforestation > Peatland"; gfw_peatlands leads
  it (CATALOGUE_FIRST). The Forest and land cover heading keeps only what the
  catalogue files there.


## Round 91b (27 September)

Needs round 90b (runs after it by name). Tiles patch round91b_tiles.py beside it.

- Correction to 90b: the owner asked only for Global Safety Net's country
  rankings (its page in a box) to go and be remade from real data, not for its
  layers to go. The gsn row, addGsnLayer and its filing are back.
- Its layers now carry plain titles with each abbreviation spelt out
  (GSN_PLAIN, shown as the row's label; the service's name still files it):
  OECMs, ITTs, documented CAs, AIBES, HM90, mammal assemblages, climate
  stabilization areas and the rest.
- Filing (first in CATALOGUE_BY_TITLE): the four tree layers under
  Deforestation > Forest cover, the mangroves under Deforestation > Mangroves;
  Inland Water, Water Bodies, Shrubs/Mosaic, Grassland, Herbaceous Wetland,
  Ice/Snow (and Cropland, Sparse Vegetation, Bare Areas if offered) and the
  Terrestrial Ecoregions under Biodiversity loss > Land Use and Ecoregions; the
  rest under Places that matter most for species.
- The mangroves are drawn light teal and grown wider out (grow:// protocol,
  GSN_GROW), so they show from the world view.
- Conservation Priorities (top 10%): the service gives only the Earth Engine
  asset's address, which answers a signed-in Google account alone, so it
  never drew; gsnShown leaves out any layer without a map address.
- The rankings: gsn_countries, a country shading of each country's protection
  level 0 to 10, read from the rankings' own spreadsheet by tiles
  gsn_rankings.py (every column in the box; US states listed apart).
- 90b's duplicates of Global Safety Net's layers taken out at the owner's
  word: the WDPA and OECM rows, the 14 land cover kinds, own_modification,
  own_wilderness, own_reforestation (and their tiles scripts). Kept:
  own_mangroves, own_critical_habitat, Fields of The World, Potapov cropland.


## Round 90b (27 September)

Needs round 89b (runs after it by name). Tiles patch round90b_tiles.py beside it.

- Atlas hotspots: clicking a hotspot opens no box; it lays the Atlas's map at
  once (openAtlasHotspot), and a click inside the hotspot already open does
  nothing. The survey's area and outer limit of one hotspot are one hit, not a
  "2 places here" list. The numbered cities are 26 px with a wider click ring;
  their click claims the event (popupClaimedBy) and any click within 18 px of a
  number is the number's (nearAtlasNumber).
- The keys printed on the hotspot PDFs are under the Atlas row in the layer
  menu: map/atlas/legends.json from pipeline/atlas_legends.py (page 1's key and
  the conflicts page's key, swatches cut from the page). Where a PDF's key is
  drawn as shapes, not text, another hotspot's key stands in with its name put
  as "The hotspot".
- Atlas cities: standout (larger, lighter, edged, soft ring). No city PDFs
  exist; the city maps are pictures. tiles atlas_city_plates.py (METHOD 3)
  reads each picture's printed scale bar (the earlier fits were mostly the
  wrong size) and places it north up at that scale where 3+ names agree.
- Global Safety Net deleted (gsn, gsn_rankings, addGsnLayer). In its place,
  from the original data: WDPA strict (Ia/Ib), other (II-VI), no category,
  and OECMs, drawn by UNEP-WCMC's own servers (wcmcExport, dynamicLayers) in
  this map's colours; 14 land cover kinds from GLC_FCS30D 2022 (LAND_KINDS,
  cog4326, small kinds grown wider out): the 4 forest kinds under
  Deforestation > Forest cover, the rest under Biodiversity loss > Land Use and
  Ecoregions (with the terrestrial ecoregions); own builds in the tiles repo:
  own_mangroves (GMW v4.0.19, any-mangrove-under-the-pixel so it shows from
  the world view), own_reforestation (Fesenmyer 2025), own_modification (HM v3
  2022, 300 m), own_wilderness (Mu et al. footprint, wilderness = under 1),
  own_critical_habitat (UNEP-WCMC v2.1). These say "not built yet" until the
  tiles refresh runs them.
- Not rebuildable from public data: mammal assemblages, climate stabilization
  areas, the rare-species composite, documented conservation areas, the AIBES
  composites, Gosling 2026 conservation priorities (site shapes unpublished).
  LandMark (the ITTs' source) is already on the map under Invasion of humans.
- Agriculture > Cropland: Fields of The World 2025 (route pmvector, read from
  source.coop) and Potapov et al. cropland 3 km (tiles cropland_expansion.py).


## Round 89b (27 September)

Needs round 88b (runs after it by name).

- Plain-English titles. Catalogue rows show plainTitle(item): item.label (Trase:
  TRASE_PLAIN by metric; Nusantara: CATALOGUE_PLAIN by layer name plus its
  region) or CATALOGUE_PLAIN by id (Global Forest Watch); the source's own
  title still files the row and is kept on it as data-orig (the cut reads it).
  Confusing static row names and four bundle titles rewritten.
- Deforestation reads: Forest cover; Forest zoning and management plans (the
  Indonesian plans bundle inside it); Tree cover loss and alerts; The Culprits
  (Logging and timber concessions, Timber and rubber plantations, Illegal
  logging and timber trafficking, Wood pulp, Indonesia); Companies and
  financiers; Mangroves.
- Trase CONCESSION_AREA out (every value equals concession_area_ha in the
  wood pulp concessions files, checked 2015 to 2024); DEFORESTATION_ON_PEAT
  under Peatland; sbtn_natural_lands(_classification) under Forest cover and
  Protected and conserved areas, with its explanation.
- Kind switches: label above, the three chips on one line at full size.


## Round 88b (27 September)

Needs round 87b (runs after it by name).

- Product headings under Tree cover loss and alerts renamed: Cattle, Soy and
  corn, Palm oil, Cocoa, Wood pulp (were "Clearing for ..."). CATALOGUE_SUBS
  sends a product's emissions to its product heading; only emissions of all
  clearing stay under Emissions from the clearing, where Trase's two measures
  of gross emissions from deforestation (CO2_GROSS_EMISSIONS_ and
  CO2_EMISSIONS_TERRITORIAL_DEFORESTATION) are one layer (BUNDLES.deforemis).
- TRASE_MERGE / traseMerge / traseView: Trase's three cattle deforestation
  measures are one row with menus for measure, country, level and year; each
  country's values are read with its own measure id.
- TRASE_TITLES: the five pulpwood clearing measures titled by what Trase's
  description says each counts.
- gfw_west_africa_cocoa_deforestation_risk under Cocoa; the loss due to fire
  under What drove the loss as well as Fire; gfw_integrated_dist_alerts
  retitled "Deforestation and loss of plant cover as it happens, worldwide"
  and first in Alerts and Disturbance (CATALOGUE_FIRST).


## Round 87b (27 September)

Needs round 86b (runs after it by name).

- Kind switches: label and the three chips in one no-wrap row (.ks-row), chips
  tighter, so National highlights sits right of Points and Shapes.
- glad_loss titled "each year 2001 to 2024 (v1.12)"; cfg.newer probes the
  v1.13 tiles (2001 to 2025) and switches to them and their title when they answer.
- Catalogue out: Nusantara AlertDFCOMBINERGB / AlertGLADRGB / AlertRADDRGB
  (Equatorial Asia), wur_radd_coverage and wur_africa_radd_coverage,
  wur_integration_alert_drivers_class/_date (the drivers bundle is retitled),
  Global_AllExpansionRGB_2000to2024 (inside 2000-2025) and
  Global_AllExpansion_2000to2025 (same data as its picture, no colours). The
  loss due to fire is kept out of Loss year by year and no longer titled 2000
  to 2012.
- gfwpro_negligible_risk_analysis coloured by negrisk (GFW_COLOUR_BY), titled
  and explained; col_frontera_agricola titled and explained (UPRA).


## Round 86b (27 September)

Needs round 85b (runs after it by name).

- Palette, at the owner's word ("barfy alien kid green, especially around the
  borders of highlights"): teal (172) to cobalt (227), no green, saturation
  0.5 to 0.85 (GLAD_LO/GLAD_SPAN/GLAD_SAT_*; national span 40; gladColour and
  gladSpread less vivid). Every edge is a darker shade of its fill: GFW areas
  (rim = gladHsl(hue, 0.78, 0.26), thinner), country outlines (darkerShade).
- Ramps without green: AMOUNT_RAMP, HOT_RAMP/HOT_KEY, NO2_RAMP, POP_RAMP, the
  glow palette, hillshade highlight. Hard-coded rows (plastics, forest
  management classes, IBAMA, RAISG, Trase pulp, GOC, agri_linked classes,
  military) moved into teal to blue, military told apart by hue and depth.
- test.mjs checks no bright green is left in app.js.
- tiles epa_density.py: its pictures rebuilt in teal to blue (PALETTE key).


## Round 85b (27 September)

Needs round 84b (runs after it by name).

- Military rows: each its own colour (keepColour), far apart and none orange
  or yellow. mil_russia_storage out (PANEL_REMOVED). fieldRows never shows a
  MISSILEMAP field; tiles nuclear_sites.py no longer writes it.
- mil_sites: cfg.leaveOut drops fire lookout towers and places that are only
  observation towers or belfries (Wikidata files them under fortifications);
  tiles military.py leaves them out of the copy too.
- Catalogue: umd_glad_dist_alerts and umd_glad_landsat_alerts out (the
  integrated rows hold them); wur_alert_drivers_coverage out;
  wri_agriculture_linked_deforestation out, replaced by agri_linked
  (pmtareas with classBy: colour by the crop or animal linked to most loss,
  strength by its share of the district; tiles agri_linked.py builds it from
  GFW's download).
- BUNDLES.drivers under What drove the loss: Curtis et al. first
  (CATALOGUE_FIRST), WRI/Google, UMD, TSC and Wageningen's drivers of each
  alert as its parts.
- CUT_BETWEEN now cuts through GLAD alerts: the forest_alerts group and every
  catalogue row under Alerts whose title comes up to "GLAD alerts" A to Z.
- GFW_MIN_ZOOM: umd_modis_burned_areas asked for from zoom 5 in (its tiles are
  made on request and fail wider out).
- goc_flora, goc_fauna, goc_resources (country rows, totalsFrom kind json with
  field) first under Environmental crime, from tiles goc_index.py (Global
  Organized Crime Index workbook). env_enforcement.py probes more registers
  (US ECHO cases, Chile SMA, Mexico PROFEPA, Colombia, Ireland, Scotland, NSW,
  IUU vessel list), reading only the first 2 MB of each.


## Round 84b (27 September)

Needs round 83b (runs after it by name).

- Lazy children with route "tile" or "worker" (the forest alerts bundle) fell
  through to addPmtilesLayer and said "archive missing"; ensureLayer now sends
  them to addTileLayer / addLiveLayer.
- CUT_BETWEEN: every row in the forest alerts heading from its first row down to
  the first "GLAD alerts" row is moved into [data-removed] and unticked (a
  MutationObserver repeats this as catalogue rows arrive).
- UMD/GLAD Sentinel-2 Amazonia alerts out (CATALOGUE_BY_TITLE null).
  Integrated deforestation alerts (GLAD-L + GLAD-S2 + RADD) and GLAD 30S-30N
  (GLAD-L alone) are different and both kept; global integrated disturbance
  alerts (DIST-ALERT + GLAD-L + GLAD-S2 + RADD) and all-ecosystem disturbance
  alerts (DIST-ALERT alone) are different and both kept. gfw_dist and
  gfw_dist_year lose the 30S-30N bounds (they are worldwide).
- mil_missile_ranges out (PANEL_REMOVED).
- Layer order: a row dragged above or below any other row, in any heading,
  moves there (moveRow into the other row's parent) and so draws above or below
  it on the map; a row dropped on a heading line goes into that heading. Homes
  are remembered (ROW_HOMES); layerMenuHelp adds "Reset layers menu" (resetRows)
  and a note on how dragging works.
- New rows, heading Environmental crime (before Natural disasters):
  ibama_embargos and ibama_infractions (pmtiles + boxes from tiles
  scripts/env_enforcement.py, IBAMA open data), raisg_illegal_mining
  (geojsonlive from tiles scripts/raisg.py; the owner uploads RAISG's zip to
  raisg/, free registration; also in the mines bundle). gw_defenders (route
  country, totals from global_witness/countries.json via tiles
  scripts/global_witness.py) under Invasion of humans and Of individuals > Of
  humans. countryTotalsFrom reads kind "json".
- Other countries' environmental-crime registers (Canada's Environmental
  Offenders Registry, England's Environment Agency prosecutions, US EPA ECHO
  criminal cases, Peru OEFA) are probed first into probe/enforcement/ by
  env_enforcement.py; mapped once their files are known.


## Round 83b (27 September)

Needs round 82b first (runs after it by name).

- Relief made general: RELIEFS, reliefTile, protocol relief://<row>/<col|dem>,
  reliefStack/reliefGround (the last relief row turned on holds the ground;
  with none, the map's own terrain setting returns), addReliefLayers. The
  nitrogen dioxide row uses it; its sources are now no2_tropomi-col/-dem/-shade.
- ct_pop (route poprelief, addPopRelief): GHSL 2020 people per square km from
  culprits-tiles-more tiles/ghsl_pop.pmtiles (scripts/ghsl_pop.py, zooms 0-6,
  Mapbox height code), raised by density on a log scale (50,000/km2 highest),
  neon colours (POP_RAMP); Climate TRACE's flat picture until the copy exists.
- Material Research atlas: its two school layers dropped too (dropLayers 1-13).
- Rubber rows: "worldwide"/"global" taken out of their titles (notWorldwide).
- nus_itp: Nusantara's industrial timber plantations 2024/2025 as one
  rasterlive row (WMS v3), the catalogue's two rows taken out.
- trase_pulp_concessions: the three periods as one trasefac row (cfg.periods,
  each a chip and a colour).
- Trase measures: regions edged in their own colour, and a dot at each
  region's middle below zoom 6 (<src>-mid).
- Catalogue: tree cover loss from fires under Fire only; planted area on
  peatland under Peatland; under Loss year by year only glad_loss and the
  global land area row (catalogueLastWord); that row titled "Tree cover loss,
  2000 to 2012" (titleFix).
- glad_loss drawn at full strength, lifted and sharpened.
- Tree cover loss and alerts moved right under Forest cover.


## Round 82b (27 September)

Needs round 81b first (runs after it by name).

- Colours: the owner prefers 80s neon greens and blues to the purple end.
  GLAD_LO/GLAD_SPAN 115/105 (neon green to electric blue, no violet),
  saturation held 0.7-0.97 (GLAD_SAT_LO/HI); gladColour (row swatches) the
  same; GLOW, HOT_RAMP, AMOUNT_RAMP and the plastics colours redone; rows
  coloured by their own figures keep them (cfg.keepColour set by
  colourByAmount/colourByGroup); keys of the map's own ramps go in GLAD_OUT.
  Unkeyed GFW pictures are no longer desaturated. Servers' near-white areas
  (gladPixels) take a light neon of the row's hue. GFW vector datasets each
  take their own neon fill and a lighter rim (was cfg.colour and #D6CCBC).
- no2_tropomi (route no2relief, addNo2Relief): GFW's TROPOMI monthly average
  tiles (tropomi_avg_nitrogen_dioxide_last_month), decoded along the Resource
  Watch key (NO2_KEY) into amounts; protocol no2:// makes a neon picture and a
  Mapbox-encoded height tile; while shown the terrain is no2-dem (height =
  amount, NO2_HEIGHT 150 km at 300+, scaled by zoom in no2Lift) with a neon
  hillshade; unticked, the map's own terrain setting returns (liftTerrain
  yields while no2Relief.on). Below zoom 3 tiles are built from children, max.
- remains_fire: GIBS publishes thermal anomalies as vector data, so the PNG
  WMTS address never answered. Now GIBS WMS (epsg3857), SNPP + NOAA-20 +
  NOAA-21 _All layers, today and yesterday (UTC) as chips.
- Catalogue: Nusantara's nine alertfire_* rows out (CATALOGUE_BY_TITLE);
  gfwTitle no longer appends "gives this dataset no title"; GFW_TITLES_BY and
  GFW_ABOUT_BY (gfwAbout) title and describe the trees in mosaic/complex
  landscapes and the Congo Basin logging roads; GFW datasets sharing a title
  make one row (the drawable one).
- Headings: "Forest cover" (was Forest cover in 2020) with the trees in mosaic
  and complex landscapes; "Mangroves" (was Forest carbon and biomass).
- Mangrove biomass ringed wider out than zoom 8 by Global Mangrove Watch's
  outlines (GFW_HALO).
- forest_management: classColours, applied pixel by pixel through
  GLAD_CLASS_PALETTE, key in the same colours.
- culprits-tiles-more: epa_density.py in neon (rebuilds once, PALETTE
  "neon-1"); catalogue_probe.py writes probe/catalogues/ (every GFW dataset
  with its assets, every Nusantara layer, a test tile of each fire, burn,
  concession, Peru and NO2 dataset) for the owner's open items.
- Open: "global burned areas failed to fetch" and the Peru concessions pair
  need the probe's lists to name the rows exactly.


## Round 81b (27 September)

Built beside the other chat's rounds; needs round 80 (runs after it by name).

- Pollution is split by where it goes: All-around pollution (EPA sites of every
  kind, the toxic plants atlas, Plastics), Air pollution (Climate TRACE's urban
  sources, then one heading per pollutant, Nitrogen dioxide last), Water
  pollution (Wastewater; Oil spills and slicks at sea; Plastic in the sea) and
  Land pollution (Solid waste; Oil and chemical spills on land; Where oil and
  gas is drilled). Catalogue paths follow (Air pollution > Nitrogen dioxide,
  Land pollution > Where oil and gas is drilled).
- Air pollutant columns: COLUMN_EXTRA gains ct_air (pm25_kg_hr x 8.76 t/yr)
  and ct_air_{pm2_5,oc,so2,vocs,co,nh3,nox} via ctAirColumn: each row on its
  own scale, the largest source as tall as a 10 Mt CO2e column
  (COLUMN_OWN_TOP); key under each row (rowKey). Black carbon keeps x900.
- Heading ticks (headingTicks/headingPump): rows whose points are in a shared
  file read it (POINT_BUNDLE_USE), eight rows per 150 ms, legend once.
- EPA sites (epa_widget): wider out than zoom 6 each EPA kind is a picture
  (culprits-tiles-more scripts/epa_density.py, tiles/epa_density_<lid>.pmtiles,
  about 1 MB in all instead of 16-25 MB per zoom); vector parts below zoom 6
  are no longer read once the pictures exist. The TRI copy (epa_tri_sites) is
  a chip of this row (triRow) and out of the box (PANEL_REMOVED).
- HydroWASTE: the repo copy was clustered (1,090 dots at z9 stood for about
  2,800 plants) and bindPopup read only x_ fields, so every box said
  "Unnamed". Now fieldBox (fieldBoxHtml) boxes it from its own columns, and the
  archive is rebuilt unclustered by tiles scripts/hydrowaste.py
  (archiveBefore = the old copy until then).
- Tuholske: the four outlet rows are one layer (BUNDLES.wwoutlets), retitled
  "entering the sea at each coastal outlet", their glow a hotspot spectrum
  (HOTSPOT, HOT_RAMP, HOT_KEY). The plumes row is retitled "spreading through
  coastal waters". Watersheds are shaded per square km (cfg.perArea, field
  per_km2) once tiles scripts/wastewater_watersheds.py has rebuilt with areas
  (it now runs on its own once when the key lacks perArea); until then the row
  keeps the totals and its old title (relabelRow).
- Waste Atlas: dumpsites, landfills, incinerators, MBT, biological treatment
  and cities coloured by their figure (colourBy, colourByAmount, AMOUNT_RAMP,
  six steps, key and chips). Dumpsites with no amount are estimated from their
  informal workers at the rate of the sites giving both, drawn as rings.
  Countries are eight national-highlight rows (BUNDLES.wastecountries,
  route country with totalsFrom, WASTEATLAS_ISO for World Bank names; shares
  on a linear 0-100 scale). wasteatlas_countries is gone.
- Plastics: pirg_plastic out; plastics_plants and vinyl_chloride_plants
  (geojsonlive, groupColours) from tiles scripts/plastics.py (US TRI NAICS
  325211 and CAS 75-01-4, EU E-PRTR 4(a)(viii) and vinyl chloride via
  DISCODATA, Climate TRACE steam crackers, OpenStreetMap, Wikidata).
- Material Research World Atlas: dropLayers 3-13 (CDC SVI and water bodies),
  plain chip names (layerTitles), retitled.
- Oil slicks: cerulean_slicks gets a timeline (ceruleanTimeline: from/to
  months, play, live service via datetime + datetime-column=slick_timestamp,
  or the copy kept daily = the old slick_archive, now PANEL_REMOVED). Set up
  the first time the row is shown. BUNDLES.oilslicks holds cerulean_slicks and
  SkyTruth's write-ups split at sea / on land (skytruth_posts_sea/_land from
  tiles scripts/skytruth_water.py, Natural Earth 10m land). skytruth_posts out.
- Vessels of concern: cfg.standout (bigger, rimmed dots, a soft ring layer).
- Not done: making the nitrogen dioxide layer a relief of its intensities
  waits on the owner naming which row it is (none of the map's own rows is
  NO2; it arrives from a catalogue).


## Round 80 (27 September)

- GDELT's GEO 2.0 API answers 404. military.py news() now reads GDELT 2.0's
  15-minute event files (CAMEO roots 18, 19, 20; ActionGeo place; SOURCEURL),
  catching up from military/news/cursor.json (at most two days), into the
  monthly archive and a seven-day news.geojson. mil_news reads that copy
  (route gdeltarchive with copyUrl); the box counts events and days.
- Overpass: overpass-api.de answered 406; requests now send Accept and
  Content-Type, four servers are tried, and a kind no server answers keeps its
  places from the last copy.
- MIRTA: catalog.data.gov's API answers 404; read from ArcGIS items
  8acd7277c2d04bc294c927fc7149c626 (points) then fc0f38c5a19a46dbacd92f2fb823ef8c.
- invaded_countries.py: GFW LandMark tiles are gzipped; gunzipped before decoding.
- mil_missile_ranges: MISSILEMAP (Alex Wellerstein) in the companion panel,
  opened at the map's centre (cfg.pageAt); each nuclear storage site links it
  with the site as launch point (nuclear_sites.py).


## Round 79 (27 September)

- mil_nuclear_storage (geojsonlive, military/nuclear_sites.geojson from
  culprits-tiles-more scripts/nuclear_sites.py): the storage sites the Nuclear
  Notebook names, with its words and estimates (Europe: "The changing nuclear
  landscape in Europe", Dec 2025; US: "United States nuclear weapons, 2026").
  Stated coordinates where given, else Wikidata's by name (linked).
- mil_russia_storage: russianforces.org's 12th GUMO map in the companion
  panel (CC BY-NC-ND 4.0: not copied).
- mil_usni_fleet (route usnifleet, readUsniFleet): USNI News Fleet and Marine
  Tracker, weekly, headings placed at area centres (scripts/usni_fleet.py
  AREAS table), paragraphs quoted; unplaced headings listed on the row.
- Probe (scripts/site_probe.py, run by hand): what theyrule.net and
  unroca.org load (requests, data starts, They Rule's source-map data files),
  written to probe/sites/ for the next round.
- Not built: missile ranges (CSIS Missile Threat is all rights reserved and
  its missile pages could not be read; ranges wait on the owner).


## Round 78 (27 September)

- mil_news_archive (route gdeltarchive, readGdeltArchive): the daily GDELT
  copy kept a month to a file by culprits-tiles-more (military.py
  news_archive: military/news/<YYYY-MM>.geojson + index.json), each place with
  the days named and every article link; months as chips.
- mil_osm: OpenStreetMap military=airfield, base, naval_base, barracks, range,
  training_area, nuclear_explosion_site (and was:/disused:), from
  military/osm_military.geojson.
- mil_mirta: US DoD MIRTA, found on catalog.data.gov at each run
  (military/mirta.geojson; the dataset's date and file are in the copy).
- round78_tiles replaces scripts/military.py with these three parts added.


## Round 77 (27 September)

- Invasion of the after-life completed from the Unearthings map
  (WelcomeToYourGalaxy/remains), read from its own site
  (REMAINS_BASE, remainsJson handles its gzipped files):
  - remains_records: route "remains" (was pmtiles): every record, marks by
    precision (solid, ringed, hollow, halo for blurred), the map's own box
    (remainsRecordHtml: glossary defined in place, geo notes) plus "what to
    do here" for the country it sits in; filters row (register, direction,
    kind, trigger, scale, how recent, undated, words).
  - remains_findings: route "remainsfind" (findings.json, the map's box).
  - remains_crematoria, remains_mortuaries, remains_museums: route
    "remainsfac" (remains_local_<type>.json.gz, the map's facility box).
  - remains_units: countries from culprits-tiles-more
    shapes/remains_units.geojson (round77_tiles scripts/remains_units.py),
    shaded by records inside; box = the map's unitHTML with its guides and
    resources for the country and its units.
  - remains_fire: NASA VIIRS thermal anomalies (GIBS), also under Fire.
  - remains_help (lenses, link status, guides by place) and remains_wire
    (news with topics, places, dates, sorting): route "remainspanel".
  - Thaw and erosion: a note (no global feed, as the map says).
- Yellow and orange in the map's own colours replaced with muted ones.


## Round 76 (27 September)

- The Genetic engineering map's remaining parts, copied daily by
  culprits-tiles-more scripts/gmo_boxes.py (round76_tiles), which opens the
  map in a headless browser and keeps what the map itself builds:
  gmo/countries/<ISO3>.json (its _regimeBox write-up and pjCountryResources
  "What you can do" list), gmo/panel.json (open consultations, the four guide
  PDFs), gmo/bodies.places.geojson + .boxes.json (25 international bodies, 84
  registers and trackers).
- A country clicked on gmo_regime, gmo_treaties, gmo_incidents,
  gmo_cultivation or gmo_gmofree opens with the write-up and the list
  (GMO_COUNTRY_LAYERS, gmoCountryHtml; bindHtmlPopup takes popup options);
  window._bchFilter ports the decisions list's three menus.
- New rows: gmo_bodies (sitemap), gmo_act (route gmopanel: a bottom panel).
- Key filters (cfg.keys, keysRow, keyOff, keyFilterExpr, ANDed in applyFacet):
  gmo_env and gmo_ogtr by status, decade, consent phase, release scale;
  gmo_decisions and gmo_escapes by decade; gmo_industry by kind of body,
  subjects, organisms. Fields added in pipeline/sources/gmo_releases.py
  (x_lapsed, x_decade, x_phase, x_scale, x_otype, x_subjects, x_organisms);
  they reach the tiles at the next weekly build.
- round76_tiles also removes scripts/coverage_check.py (round 75), at the
  owner's word: none of those layers is deleted.


## Round 75 (27 September)

- Climate rebuilt in the Destruction page's order: General (the three Climate
  TRACE groups, past years, and the WRI land greenhouse gas layer), Carbon
  dioxide, Methane, Nitrous oxide, F-gases, Black carbon. Each gas has
  Emissions / Culprits / (Infrastructure) / Priority emitters. Climate TRACE
  subsectors are named under their main gas as copies of their group rows
  (arrangePanel copies a row found inside an already placed group, titled
  "<Subsector> — <group>, all gases as CO₂e"). Catalogue rows go to Emissions
  (CATALOGUE_SUBS), oil and gas to Methane > Infrastructure and Pollution >
  Oil spills and slicks > Where oil and gas is drilled; silos to N2O
  Infrastructure. "Infrastructure emitting more than one gas" and Pennsylvania
  (skytruth_pa_*, skytruth_well_permits → PANEL_REMOVED) are gone.
- Moves: largest_companies → Wealth concentration; wasteatlas_wte only under
  Solid waste; refineries out of Black carbon; mangrove biomass (JPL) →
  Deforestation > Forest carbon and biomass; INCRA quilombola taken out.
- Carbon Mapper split: carbon_plumes (CH4, gasOnly) and carbon_plumes_co2.
  Columns (COLUMN_EXTRA) for both and for ct_air_bc, heights in t CO2e/yr
  (plume kg/h × 8.76, CH4 × 29.8, BC × 900); Climate TRACE per-gas rows get
  columns too (CT_GAS_CFGS, CT_GWP).
- Climate TRACE per gas: map reads climate_trace_gases.json, _ch4.json and
  _n2o.json; the tiles repo builds CH4 and N2O in jobs of their own
  (round75_tiles: ct_gases_ch4.py, ct_gases_n2o.py; ct_gases.py is CO2 only).
- Fixes: relabelRow no longer wipes the LIVE/NOT LIVE mark (EJAtlas);
  applyVisibility also hides -edge and -areapt (FracTracker basins stayed);
  traseBreaks gives zero its own step (RTRS one colour); GFW forest carbon
  flux datasets drawn from GFW's dynamic coloured tiles (GFW_DYNAMIC).
- Carbon Majors row renamed to say who they are.
- Coverage check (round75_tiles: scripts/coverage_check.py → coverage/report.json,
  run the refresh by hand): WRI plants, Waste Atlas WtE, FracTracker refineries
  and Carbon Mapper plumes against Climate TRACE sites. No layer is deleted
  until it reports.


## Round 74 (27 September)

- The Guerillamap row is out (gmInit returns before building it; GM_ROW = false
  brings it back). In its place, group MILITARY and bundle "military" ("Wars,
  militaries and weapons, past and current") under On-planet invasion > Of
  countries by countries, with bundle "milcompare" inside it.
- Live: mil_aircraft (route adsbmil: https://api.adsb.lol/v2/mil, then
  api.airplanes.live/v2/mil, re-read every 60 s, arrows by track); mil_news
  (route gdeltgeo: GDELT GEO 2.0 PointData GeoJSON over 7 days for a fighting
  query, links rebuilt from its html; falls back to the daily copy
  military/news.geojson); seven owidgrapher rows (SIPRI spending % GDP, % of
  government spending, US$; armed forces personnel; FAS warheads; nuclear tests
  per year; position on nuclear weapons).
- Daily copies from culprits-tiles-more scripts/military.py (round74_tiles):
  UCDP GED + candidate events as tiles/mil_conflicts.pmtiles with gzipped
  pieces military/ucdp (every field; facet x_kind); Wikidata military
  installations, units at headquarters, nuclear test sites, terrorist attacks
  (classes found by English label, then every subclass); OpenStreetMap
  minefields (Overpass); alliances as shapes/mil_alliances.geojson with its own
  menu (addShapesLayer now takes data.menu when SHAPE_COLOUR_BY has none).
- Could not be built from open data: air and naval base activity; military
  vessels' positions (no open AIS); nuclear missile ranges and nuclear weapons
  storage sites (no open dataset of deployed sites); equipment counts and the
  Firepower Index (Global Firepower, no licence; owner to ask). Uyghur
  detention sites (ASPI Xinjiang Data Project): terms not found; owner to ask.


## Round 73 (27 September)

- New row other_invaded (shapes route, box: "invaded"), under Invasion of
  humans after site_settler_colonialism: every country the settler layer does
  not draw whole, from culprits-tiles-more shapes/other_invaded.geojson, shaded
  by a menu (SHAPE_COLOUR_BY.other_invaded: LandMark land and population
  shares, ILO 169, colonial status, Land Matrix hectares, World Bank external
  debt % GNI, COW conquests made and suffered). Its box (invadedBoxHtml) is
  built from invaded/countries.json: Indigenous peoples (LandMark, ILO 169,
  the 2007 UNDRIP vote, IWGIA link where its country page answers), colonial
  rule (UN NSGT list, Wikidata dependent territories, territories held),
  economic invasion (Land Matrix, World Bank DT.DOD.DECT.GN.ZS), past conquest
  (COW Territorial Change v6, procedure 1 conquest and 2 annexation; a whole
  unit is followed to its next change of hands, a piece cannot be).
- The settler colonialism boxes add the same facts for the countries each
  entry lies in (props iso3, written by build_shapes.py real_boundaries),
  headed "Also, from other sources" and said of the whole country.
- culprits-tiles-more round73_tiles.py adds scripts/invaded_countries.py (runs
  daily). Owner asked 27 September; they chose all four kinds and to add them
  to the settler descriptions.


## Round 72 (27 September)

- Live marks: category headings carry none now (headingLiveMark returns and
  removes any for toc-l* sections); a layer with sublayers (toc-bundle) keeps
  its LIVE / NOT LIVE marks.
- A bundle's tick counts [data-smtype] rows too (syncHeadingBoxes): the
  Indigenous Environmental Conflicts layer is made only of site-map kind rows,
  and its tick was disabled.
- Site map boxes: LEAFLET_CSS_LAST lists the pages that load Leaflet's CSS after
  their own styles (found by scanning WelcomeToYourGalaxy/maps); for those,
  injectSitemapStyles adds LEAFLET_BOX_CSS again after the map's css, scoped to
  that map, so Leaflet's popup margins win as on the page (the secret societies
  map's `* {margin:0;padding:0}` had put its text against the box border). The
  Position line goes inside a site map's box (before the tip container).
- GFW vector rows coloured by their own field (GFW_COLOUR_BY, gfwColourBy): the
  kinds are read from the loaded tiles (querySourceFeatures on sourcedata),
  ordered where the field is a measure (tenure indicators by the mean of
  current_avg_scr; LandMark shares by the first number in the category), put
  through gladPaint, and shown as a key with catalogueKeyShow. "not stated" is
  grey and last. LandMark lands by identity + form_rec; natural resource rights
  by nat_resrc; gfw_resource_rights by legal_term.
- BUNDLES.landmark renamed "... (LandMark, with Brazil's FUNAI and INCRA)";
  funai_bra_indigenous_territories and incra_bra_quilombola_communities filed
  into it. New bundle resrights holds landmark_natural_resource_rights and
  gfw_resource_rights (owner, 27 September).
- Settler colonialism on real boundaries: pipeline/shapes/jurisdictions/
  site_settler_colonialism.json names each of the 90 entries' units (adm0 from
  map/data/boundaries.geojson; adm1/2/4 from cgaz-boundaries by exact
  shapeName) with a `basis` sentence; build_shapes.py real_boundaries() merges
  them with shapely (installed if missing), simplifies at 0.01 degrees, rounds
  to 4 places and writes the basis as `drawn_as`. Checked here: all 90 found,
  1.4 MB. culprits-tiles-more's daily site_shapes run rebuilds the file.
- Still to come (owner's order): round 73, a layer for every country the
  settler layer leaves out (Indigenous peoples' situation, colonial rule still
  in place, economic invasion, past conquest still standing), and the same
  facts added to the settler descriptions; round 74, the live conflict and
  military map in place of Guerillamap.


## Round 71 (27 September)

- Satellite basemap: sat-relief-seabed and sat-relief-sea are in
  GLAD_BASE_LAYERS now, so they keep SAT_RELIEF's own muted navies. The owner
  asked for "the neon over the water" to go; since round 59 those two had kept
  the GLAD-mapped blues.
- Hologram view (map/index.html, holo-script) is a radio, not a checkbox.
  Picking it clears the basemap radios unless Basemap underneath is ticked
  (showBaseTick; lastBase remembers the one it came from). Picking a basemap
  while it is on turns the hologram off, unless Basemap underneath is ticked,
  when that basemap is the one shown under it.
- Buildings (building_types) is back: `{ h: 1, t: "Buildings" }` last in
  PANEL_ORDER (pinBuildings holds it at the foot), out of PANEL_REMOVED.
- Genetic engineering registers (gmo_releases and its rows):
  - The harvester (pipeline/sources/gmo_releases.py) gave every record the id
    of its register ("bch:decision" for all 3,028 decisions), so the pieces
    kept one record per register and a click showed another record's
    description. Ids are now a hash per record. The register travels as
    x_src and the place as x_at ("lon,lat" to 5 places).
  - sources.json `pieces_by: "at"`: normalize.write files the pieces by x_at,
    each key a list of every record there with its id as `_id`.
  - The harvester also reads PJ_SEED from GMO-map's index.html (995 records
    the map writes into its own page: 969 organisations, 26 escapes) and adds
    those projects.json does not hold, keyed url|name as the map does.
  - Rows filter on ["coalesce", ["get","x_src"], ["get","id"]], so they draw
    from the old archive and the new. New rows gmo_industry (facet on x_src by
    the map's lenses) and gmo_escapes, under Genetic engineering.
  - bindGmoPopup (in place of bindPopup for gmo_releases owners): reads the
    place's piece; one record opens gmoRecordHtml (the map's pjPopupHtml: address
    grade, deadline, label, type, date and age, description with the [CBI] note,
    scale and the APHIS note, source, same owner from GMO-map's
    harvest/ownership.json, Dig deeper links); several open #gmo-reclist, the
    map's #recList: place and tally, the place note, search, kind and date
    pills, categories and organisms folding, newest first, each record opening
    its box. Only records in ticked rows (and their chosen lenses) are listed.
    Before the refresh, with no x_at, it lists the features under the click
    from what the tiles carry.
  - Needs one run of "Refresh atlas tiles" (or Monday's) to rebuild
    gmo_releases.pmtiles and map/data/pieces/gmo_releases (about 47 MB, 256 files).
- Still to bring over from the GMO map: the country write-up on clicking a
  shaded country (_regimeBox: law regime and carve-out, every decision filed,
  GMO-free declarations, cultivation, trials, incidents, treaties); the
  "What you can do" country panel (harvest/resources.json, 196 countries);
  the open consultations panel (harvest/consultations.json); the 25
  international bodies with their 84 resources (internationalBodies); the four
  how-to guides (guides/*.pdf); and the key box filters (still in date,
  decade granted, consent phase, release scale, subjects, entity and
  organism types).


## Round 70 (26 September)

- Owner, 26 September: they already have a central banks layer, so the
  largest banks row is corporate banks only, and development banks go in a
  row of their own. culprits-tiles-more scripts/largest_banks.py (round 70
  tiles patch) now sorts every item with total assets by Wikidata class,
  found by English name at build time ("central bank", "development bank",
  "multilateral development bank"; the build stops if one is missing):
  central banks are left out (listed in banks/largest.build.json),
  development banks all go to banks/development.geojson, and the 250 largest
  other banks to banks/largest.geojson.
- Rows: largest_banks renamed "The 250 largest corporate banks by total
  assets"; new development_banks ("Development banks by total assets, national
  and multilateral"), filed beside it under Banks and monetary power.


## Round 69 (26 September)

- largest_banks (asked 26 September: the owner's own layer of the world's
  largest banks): route geojsonlive reading culprits-tiles-more
  banks/largest.geojson, built weekly by scripts/largest_banks.py (round 69
  tiles patch) the way largest_companies.py builds the companies: Wikidata
  total assets (P2403), latest year per item, in dollars at the year's ECB or
  World Bank rate, the 250 largest that are a kind of bank (Q22687). Central
  and development banks are kept, with Wikidata's kinds on each; items that
  are not banks are listed in banks/largest.build.json. Filed first under
  Suppression > ... > Banks and monetary power. NOT LIVE (weekly copy).
- Checked in a browser with a test file: the row draws and its box shows
  every field. The real file appears after the tiles repo's refresh runs
  largest_banks (nightly, or by hand).


## Round 68 (26 September)

- Wastewater watersheds (owner's go-ahead, 26 September): the shapes were
  already built and published (culprits-tiles-more
  tiles/wastewater_watersheds.pmtiles, 79 MB, zoom 9, 134,846 watersheds;
  wastewater/watersheds.key.json), and the row draws them; the "not built"
  lines in the older notes are out of date.
- Its shading: the key's steps were cut at equal counts of watersheds. Half
  carry no nitrogen and most very little, so the top step began at 18 t a year
  and held 9,648 watersheds with 98% of all the nitrogen, and all of Europe
  came out one shade. The row now gives logSteps (1e5 to 1e10 g: 0.1, 1, 10,
  100, 1,000 and 10,000 tonnes a year) and addPmtAreasLayer uses them before
  the key's; it also writes the steps as the row's key (rowKey), so they show
  under the row and in the Showing box. Nothing is filtered.
- Wreckers of the Earth: the layer copies are in culprits-tiles-more umap/,
  but umap/409815/map.json (added to umap_copy.py in round 61) is not there
  yet, so the row still draws nothing until the nightly refresh runs, or
  refresh is run by hand with umap_copy.


## Round 67 (26 September)

- Hologram view: the switch is put in the basemap list (.bm-choices) as its
  fourth line, in the same type as the three above, with no rule over it;
  Basemap underneath sits indented under it.
- News wires, Subjects list: a "Done: show the news" button at the top of the
  list (always in view; the list can run past the box's foot). Esc closes the
  list too, as a click outside it already did.
- News wires, Filters: the Time row is moved into the filters' two-column grid
  after the last filter (held by reference as $whenRow, since the grid is
  rewritten on every change), so it takes the cell beside Language, under News
  source, instead of a full-width row under them all.
- A news mark's box: stories sent to the map carry their language
  (toTheMap), and the box has a Language menu whenever it lists more than one
  story, with "Language not stated" where some have none; each story's line
  names its language.
- UAP heading: "Unidentified anomalous phenomena", the term the US government
  (FY2023 NDAA, AARO) and NASA have used since December 2022, matching the row.
- Browser check: basemap list, subject list with Done, Time in the grid (read
  from the capture wire), and a mark's box with the Language menu.


## Round 66 (26 September)

- Layers box: as tall as its list and no taller (.left-col .panel is flex
  0 1 auto, was 1 1 auto, so it filled the column with empty box under the
  last heading and its grip sat mid-box after the list). The grip is sticky
  on the box's bottom edge. A pull now sets max-height rather than height and
  no longer fixes flex at 0 0 auto, so a box pulled right down still gives
  way when the Showing box comes up under it instead of being covered. The
  empty #note paragraph is hidden (.note:empty).
- Country outlines basemap: its outline-* layers join GLAD_BASE_LAYERS. The
  GLAD mapping (round 46) had been turning its land purple and its roads
  violet; it now draws in the colours written in addOutlineLayers and
  OUTLINE_DETAIL again.
- Titles: the heading "Protecting extraterrestrial life" is "Extraterrestrial
  life"; eyes_craft is "Spacecraft in space, going galactic (NASA's Eyes on
  the Solar System)"; ufo_sightings is "Unidentified anomalous phenomena (UAP)
  sightings reported worldwide (UFOSINT)". The two space launch rows keep
  "(Launch Library 2)": it is their data source (The Space Devs' API).
- Biosignature row checked in a browser with a copy of the maps page: it is
  read from off-planet-invasion_embed_13_large-script.html each time it is
  ticked, and its 4 worlds draw round the globe.


## Round 65 (26 September)

- Banking dynasties: the 11 family-city pairs the section lists without a
  coordinate (so its own map never plots them) are added hollow at the city
  by culprits-tiles-more scripts/dynasty_cities.py (round 65 tiles patch):
  OpenStreetMap's position for the city and its country, the family's colour
  as the ring, and a box saying it is placed at the city. Runs with the
  refresh; a pair already added is left alone.
- legendKeyPairs joins a key's parts with a space (the building kinds read
  "Banks382,338").
- Browser check with the latest culprits-tiles-more files: Global Trade Alert,
  Buildings, space industry, upcoming launches, published aggregate findings,
  Hotspot Cities (33 placed), oil slick archive, vessels of concern, Trase
  measures and facilities, materials research, Coastal Cleanup, Waste Atlas
  cities and the soybean companies all draw. Wreckers of the Earth waits for
  umap_copy's first nightly run.


## Round 64 (26 September)

- Rounds 61 to 63 had been moved to patches/failed: each needs the round
  before it, and round 60 was never uploaded. This one patch carries rounds
  60 to 64 together, from round 59; the failed files can be deleted.
- The Showing box now reads every colour key under a row: a site map's
  "Colour by" key (data-colour-for: capture map, PalmWatch), the building
  types' kinds (data-kinds) and the social spheres' kinds.

## Round 63 (26 September)

- Every row carries LIVE or NOT LIVE: a site map's kind rows take the map's
  mark (liveMark), Guerillamap's row says LIVE, and headingLiveMark puts a
  mark beside each layer with sublayers and each heading of level 3 or more
  (LIVE, NOT LIVE, or both with how many of each), recounted with the
  headings' row counts. The banking dynasties' charts (a copy) say NOT LIVE;
  the biosignature worlds (read from their page each time, route worldsring)
  say LIVE.
- Biosignature worlds on the flat map: while the row is on in the flat view,
  flatConstrain (the map's transformConstrain) lets the map pull back into
  space (FREE_FLAT); otherwise MapLibre's own rule, which holds the flat map
  to the screen's height, applies as before. The map eases to the whole
  world, centred, and each world is placed out from the flat world's edge,
  fanned across the top, further out the further from Earth (logX), with a
  dotted line back to the edge. Changing view with the row on pulls back for
  the view now drawn. The row keeps its own colours (keepColour).
- policy_rates and imbalances (route tracker, addTrackerLayer), in place of
  CFR's trackers, whose Terms of Use forbid reproducing their content for a
  public purpose: the BIS central bank policy rates (every monthly value; the
  euro area's rate given to each member from the month it took the euro) and
  the IMF's current account balances (% of GDP and US$ billions, World
  Economic Outlook, forecasts marked), from culprits-tiles-more
  scripts/trackers.py (round 63 tiles patch; run it once by hand). A menu
  picks the measure, a slider the month or year, a button plays through.
  Fixed steps in blues and teals (keepColour; the legend's key rows now
  carry data-key-for so a kept row's key is not remapped). The CFR rows stay,
  opening CFR's own pages.
- Giga school points wait on a Giga API key (gigamaps@unicef.org; keys are
  requested on maps.giga.global's API page). The key goes in as a repository
  secret and refresh.yml must pass it to the scripts.

## Round 62 (26 September)

- Of animals: every layer straight under it, no sub-headings (Zoos, Pet Food
  Companies, the fighting, circus, racing, rodeo and tourism maps). Names:
  "Zoos", "Pet Food Companies". resourcetrade.earth first under Trade.
- infoMark draws no bubble for a note that only says which page's map a layer
  came from.
- Country colours further apart: GLAD_NATIONAL_SPAN 55, ordered steps from
  lightness 0.88 to 0.35 at saturation 0.78. A match of country names to the
  steps of OWID_RAMP or SHAPE_STEPS (GLAD_RAMP_STEPS) is now spread as a
  ranking, lightest to darkest; before, it was spread as unordered classes,
  so neighbouring ranks could look alike or out of order.
- Keys under shaded rows, read by the Showing box: SHAPE_COLOUR_BY for
  site_earmarked_funding (donated / received, parsed from the map's own
  "$23M donated" text, log scale), site_trade_profits (foreign value added,
  read from the maps repo's embed 20 table D, OECD TiVA 2020, joined on
  ISO_A3, the embed's own steps), slavery_routes, gmo_cultivation and
  gmo_incidents (one-colour keys). Shapes with a per-country "entries" count
  (the government maps) are shaded by it; shapes all one colour get a
  one-colour key. Giga, Global Trade Alert and resourcetrade.earth write
  keys too (rankPairs leaves out empty steps).
- Global Trade Alert: ratings in the GTA handbook's words (harmful, almost
  certainly / likely, discriminating against foreign commercial interests;
  liberalising), what a state act is, dots in blues; steps read from the
  countries on the map only (blocs and pairs with one act had pushed every
  country into the top step); "implementers", not "countries".
- resourcetrade.earth: five tiers by value, each with its own width and
  depth, largest on top, wider when zoomed in; a menu keeps the largest 25,
  50 or 100.
- Trafficking routes (cfg.routes): curves, width by people, largest on top;
  menus for the least people on a route (opens at 100 or more) and one
  country's routes. Lines between countries, and GTA, keep to cyan and blue.
- Export credit agencies (cfg.pointsOnly): the 80 agencies only. The source
  map's countries were its plain background (one fill for all), not data.
  Key: OECD Arrangement participant / not / placed at its city only.
- Social spheres: a link's box names the people in both.
- Banking dynasties: all 126 places the source map plots are on the map (11
  more cities in its list have no coordinates in the page and are not
  plotted there either). New row site_banking_dynasties_charts opens the
  section's own page (timeline 1250 to 2025, charts) in the bottom panel,
  from culprits-tiles-more pages/banking_dynasties.html (round 62 tiles
  patch, cut from the Suppression page's srcdoc unchanged).

## Round 61 (26 September)

- Build queue (queueNext): a layer still building after QUEUE_SLOT_MS (15 s)
  gives up its place and finishes in its own time. In a browser test (local
  harness serving both repos) the three largest Climate TRACE archives held
  all three places for good and every layer behind them read "waiting behind
  N other layers…" - the likely cause of most rows the owner listed as not
  working. getJson now retries once with twice the time on a timeout.
- readUmap reads the map's settings from culprits-tiles-more
  umap/<id>/map.json (umap_copy.py now saves it) before uMap itself.
- pe_banks (geojsonlive, pe/banks.geojson from culprits-tiles-more
  scripts/pe_banks.py): Bankrolling Extinction's 50 banks at their GLEIF
  headquarters, Table 2 as printed, Figure 1's bars measured (the owner chose
  "measured, marked approximate"); checked against the report's 52 billion
  average and "more than 210 billion" largest; shares of assets agree within
  0.2 points of amount / assets. Four banks at the smallest bar length get no
  amount.
- Atlas conflicts pages (culprits-tiles-more scripts/atlas_insets.py ->
  atlas/insets.json): the "| CONFLICTS" page's map placed by its numbered
  cities (Nominatim, north-up one-scale fit, outliers dropped, kept under 2%
  error) and each city's round inset cut from its page. atlasInsets(slug) lays
  the map over page 1 (atlas-plate-conflicts; page-1 detail and vector layers
  go under it) and a numbered marker per city opening its inset, title and
  2015/2030 populations. Tested on Mesoamerica with rough coordinates: fits.
- defor_funds.py (culprits-tiles-more, step one, nothing on the map yet):
  Forest 500 rankings from api.forestiq.org (every row) and the latest SEC
  N-PORT quarter (User-Agent with welcometoyourgalaxy@gmail.com, as the owner
  gave), matched by exact ticker, then the issuer LEI those holdings agree on;
  defor_funds/report.json lists every unmatched company and why;
  probe/nport/tickers_sample.json shows how funds write tickers.
- live_sources_probe.py (by hand): status, time and CORS header of each live
  source behind the rows the owner listed (OWID, EJAtlas, GSN, USDA, GFW,
  Trase, uMap, Launch Library, Carbon Mapper, Nusantara, the wastewater
  model). The wastewater copies (tiles/wastewater_N_*.pmtiles) do not exist:
  scripts/wastewater.py gets nothing back from mazu.nceas.ucsb.edu.
- Names: kinds under the enslavement maps and The Insentient read as the kind
  alone (siteTypeTitle); Animal Fighting Locations, Animal Tourism, Global
  Rodeo & Charreada; mymaps_supp_b is "Zoos and Aquariums" (fixedName, not
  renamed by its source) under Spectacle and sport; the empty Other heading
  there is gone. index.html v=61.
- EU animal-health establishments (abattoir-atlas raw/eu_traces_animal_health,
  29,340 rows, 14 TRACES sections) compiled for the owner as one CSV with the
  atlas's positions (sent in chat, not in the repo). No semen collection
  centres are among them.

## Round 60 (26 September)

- Selected Layers is one row with sublayers (BUNDLES.selected, a bundle at
  level 1) at the very top of the box, above On-planet invasion; it stays empty
  until the owner names its layers.
- "Post-birth invasion" is "Invasion of the living"; "Post-life invasion" is
  "Invasion of the after-life". Catalogue paths into Invasion of humans follow.
- land_matrix sits directly under Meat and agriculture (it was under its
  Agriculture sub-heading in round 59).
- Row tools: the arrow (.fold) shows only on rows with something under them
  beyond the transparency bar (CSS :has(+ .facet:not(.row-tools)) or
  :has(+ .row-tools + .facet)); folding never hides the transparency bar. The
  dotted grip is hidden where the pointer is a mouse (the row itself drags);
  kept on touch screens.
- refreshNote says nothing where a copy's rhythm is not stated (was "copy;
  renewed when rebuilt, no set rhythm"). index.html v=60.


## Round 59 (26 September)

- Asteroid ring (addNeoRingLayer): a lens (LENS_R 90 px, x4) shows marks that
  bunch within CROWD_PX of the pointer; a click on a crowded spot pins it, a
  click on a mark in it opens that object, a click outside or any map move
  closes it.
- UAP sightings: culprits-tiles-more scripts/ufosint.py format 3 draws zooms
  0-5 as sightings summed by square and year (BANDS: 2 degrees to z1, 0.5 to
  z3, 0.1 to z5; each square at the mean of its sightings, property sq), and
  every spot with its ids from zoom 6 (detail_from); the world tile no longer
  holds 227,000 spots. The map accepts format >= 2; a click on a square says
  how many and offers to zoom in. Run ufosint by hand once.
- Leaving for Eyes (watchForLeaving): no longer on reaching the edge. At the
  edge, one separate scroll outward shows "Scroll out once more…"
  (#leave-hint); a second separate scroll within 4 s leaves. The glide of the
  scroll that reached the edge is ignored; the map's own moves never leave.
- pmtiles aggregate dots never under 2 px (2.5 at zoom 6): the nine
  Unearthings findings (remains_findings) drew as half-pixel dots at world view
  and looked unloaded; they also glow in full (GLOW_FULL).
- Satellite basemap: sat-relief-colour (the land tint) is left out of the GLAD
  mapping (GLAD_BASE_LAYERS), so the land keeps its earth tones; the sea
  layers keep the mapped blues.
- Indigenous Environmental Conflicts is a bundle (BUNDLES.indigenous_conflicts)
  holding its kind-of-conflict rows; a bundle's tick now includes
  [data-smtype] rows.
- Suppression > Of humans > Land and territory is gone: its rows, the LandMark
  bundle and every catalogue path now go to On-planet invasion > Post-birth
  invasion > Invasion of humans; land_matrix is under Meat and agriculture >
  Agriculture. index.html v=59.
- Waiting: the owner's message ended at "change post birth invasion to" - the
  new name was not given.


## Round 58 (26 September)

- Kind switches: the word rules of round 57 are narrowed to buffers ("buffer",
  or "near …, N km") so concessions, areas and basins no longer turn point rows
  into shapes by their words; drawnKind now returns "both" for rows drawing
  marks and areas, and sortOut moves a row either way (a Points-ticked row that
  drew only areas to shapes; a Shapes- or National-ticked row that drew only
  marks to points), kept in KIND_SEEN.
- Field names in boxes: th min-width 6em (index.html) — with
  overflow-wrap:anywhere a long value squeezed the name column to a letter.
- Shapes coloured by their own figures (SHAPE_COLOUR_BY, shapeValues,
  shapeColouring, shapeKey): slavery_prevalence by people per 1,000 read from
  each country's write-up (details.json), log scale; gmo_trials by count, log;
  gmo_regime by regime (the GMO map's REGIMES words; carve-out labelled
  "Technique-based, with a carve-out" as that map draws it); gmo_treaties per
  treaty (TREATY_DEFS words) or how many of the five, picked in a menu in the
  key; cultivated_meat_laws and site_settler_colonialism by class. Countries
  with no figure are clear. gmo_regime and settler colonialism join
  GLAD_NATIONAL (no violet). In the country span, unordered classes take three
  depths (gladSpread).
- slavery_sites reads culprits-tiles-more tiles/slavery_sites.pmtiles (scripts/
  slavery_sites.py: each SentinelKilnDB kiln at its box centre in its 128 px,
  10 m/px picture named after its centre, per the dataset's tile_processing.py;
  overlaps under 40 m joined; IPIS mining rows from points.json as they are),
  falling back to map/tiles/slavery_sites.pmtiles (archiveBefore) until built.
  The script saves probe/kilns/sample.json showing the dataset's rows; check it
  after the first run.
- Biosignature worlds: on the flat map, a rail across the top between the
  layers box and the right column; turning the row on pulls the map back to
  where the worlds show (pullBack).
- Shared point files: culprits-tiles-more scripts/point_bundles.py joins the
  archives in bundles/members.json (73 rows; split, over 40 MB, raster or
  missing ones left out) with tile-join by max zoom into
  tiles/points_bundle_N.pmtiles, listed in bundles/points.json. The Points
  switch reads that list (readPointBundles) and rows it turns on in a bundle
  draw from source points-bundle-N (POINT_BUNDLE_USE); glow statistics per
  row (glowKey); .build.json read from the row's own archive (ownUrl). A row
  ticked by hand reads its own archive. index.html v=58.


## Round 57 (26 September)

- Kind switches: FracTracker's map (fractracker_refineries) draws the world's
  oil and gas basins and US shale basins, both areas, so it is a shape
  (KIND_OVERRIDE). Units and catalogue titles with basins, buffers, "near",
  "within", "N km", concessions or areas are shapes (AREA_WORDS). After a
  Points switch finishes, any row it ticked that drew only fills/lines/rasters
  (drawnKind) is unticked and remembered as a shape in this browser
  (KIND_SEEN, localStorage "culprits-kind-seen").
- Bulk ticking shows a spinner and "Turning on N of M layers…", then
  "Drawing…" until the map is idle (at most a minute). The legend is held
  while rows are ticked in bulk and built once at the end (legendHold).
- Climate TRACE columns: height is written for zoom 0 (property hz) and scaled
  by the map at every zoom (COLUMN_HEIGHT, exponential 0.5); while zooming the
  footprints are redrawn from the rows already read every 120 ms
  (columnsOnZoom); tiles arriving mid-move wait for moveend.
- Country layers (routes giga/country/owidgrapher/trase, or units naming
  countries: GLAD_NATIONAL) keep to cyan-blue, hue 185-227
  (GLAD_NATIONAL_SPAN 42), no violet. Hologram layers (holo-*) are left out of
  the GLAD mapping, which had turned their blues indigo and violet; fringe
  #6fb0bd, background #081729, ground #0f2440. index.html v=57.


## Round 56 (26 September)

- "Selected Layers" h1 above Off-planet invasion, empty until the owner names
  its layers. Base and reference and Buildings headings taken out;
  building_types in PANEL_REMOVED.
- Kind switches under the layer search ("Turn on every": Points, Shapes,
  National highlights; any together): layerKind(cfg) from route and unit,
  catalogueKind(cfg, item) for catalogue rows (data-kind on their inputs; GFW
  from its asset). Catalogue rows included at the owner's word; ticked 8 at a
  time every 150 ms.
- GFW's download/gpkg answers 403 without an API key, so gfw_copies.py is
  deleted from culprits-tiles-more (round 56 tiles patch) and the three copy_*
  rows are gone; GFW's own rows for those datasets stay.


## Round 55 (26 September)

- soil_earthworms (round 53) taken out at the owner's word: they wanted soil
  biodiversity as a whole. Permission requests drafted for the owner to send:
  JRC ESDAC (Global Soil Biodiversity Atlas index) and the sWorm authors.


## Round 54 (26 September): Atlas hotspot plates sharp at any zoom

- atlasVector / atlasPageClip: once the view is closer than the plate's fit
  zoom + 1, the part of the hotspot PDF's first page in view is drawn by
  pdf.js 3.11.174 (cdnjs, loaded on first use) at screen resolution and laid
  as image source "atlas-plate-vector" (blob URL, updateImage) over the
  pictures; the detail squares are hidden while it shows. Falls back to the
  pictures if the PDF or pdf.js cannot be read.
- PDFs copied by culprits-tiles-more scripts/atlas_pdfs.py to atlas/pdfs/
  (the Atlas's server gives no CORS). index.html v=54.


## Round 53 (26 September)

- soil_earthworms (Soil biodiversity): GBIF occurrence density tiles, live,
  order Crassiclitellata (backbone key 5958860; Lumbricidae 6103 sits in it),
  choices "Each record" (classic.point) and "Records per hexagon" (hex, 30 per
  tile). Chosen because sWorm / Phillips 2019 state no licence.
- culprits-tiles-more round 53: scripts/atlas_pages_probe.py (by hand) saves
  every hotspot PDF's pages 2+ as text/pictures/rectangles JSON and pages 8-12
  as 1200 px pictures to probe/atlas_pages/, to write the placement of the
  Atlas's detailed city inset maps (owner, 26 September: pages 8-12 hold more
  detailed maps to integrate). Global Safety Net rankings: not wanted (owner).
- Needs rounds 50 and 52 first.


## Round 52 (26 September)

- Taken out at the owner's word: GFW's ci_biodiversity_hotspots (duplicate of
  atlas_hotspots). Aquaculture ponds kept (owner, 26 September).
- Needs round 50 applied first (patches apply in name order).
- culprits-tiles-more round 52: scripts/defor_funds_probe.py reads the latest
  SEC N-PORT quarter (tables, columns, samples) and Forest 500's data links
  into probe/nport/ and probe/forest500/, for the deforestation-funds builder.


## Round 50 (25 September): unstarted map work, first part

- WRI land GHG monitoring system: GFW_COG_SPLIT / gfwCogParts make one row per
  saved GeoTIFF (cropland emissions, livestock emissions, livestock emissions
  per hectare), titled from the file name, together as BUNDLES.landghg under
  Destruction > Of the planet > Climate (CO2 equivalent, all gases). Each part
  draws its own COG (d.cog) stretched by gfwCogScale.
- soil_nematodes (Soil biodiversity): van den Hoogen et al. 2020 Sci Data,
  figshare collection 4718003, CC0; samples and 1 km pooled files, every
  column. Built by culprits-tiles-more scripts/soil_nematodes.py.
- Copies of slow GFW datasets (culprits-tiles-more scripts/gfw_copies.py,
  latest version as GeoPackage via the data API's download/gpkg, every
  feature and field, 5 decimals): copy_endemic_bird_areas (Birds),
  copy_per_forest_concessions and copy_osinfor_per_forest_concessions
  (Logging and timber concessions). The GFW catalogue rows stay until the
  copies are seen working; then take them out.
- culprits-tiles-more scripts/pe_probe.py saves Portfolio Earth's report text
  to probe/pe/ for the next round's builder (banks at headquarters).
- Not done, and why: GSN country rankings (the site's terms forbid automated
  copying; the xlsx comes from the site); earthworms (sWorm, iDiv 1880: no
  licence stated). Deforestation-funds: workable from SEC N-PORT holdings
  (public) x Forest 500 companies (CC BY-NC 4.0); not built yet.


## Round 49 (25 September): Land and territory pared down, LandMark one row

At the owner's word, from the filing report of 25 September:
- Taken out: FAO Forestry Employment; Nusantara's social forestry rows
  (socialforestryhk/hadat/wiladat/hd_spv). FUNAI, INCRA quilombola and the two
  LandMark tenure indicator rows stay.
- LandMark: landmark_ip_lc_and_indicative_poly and _points are one row with two
  sublayers (BUNDLES.landmark, under Land and territory; titles in GFW_TITLES).
  Older copies taken out: landmark_icls, landmark_indigenous_and_community_lands
  (+ _points), landmark_indicative_lands (+ _points),
  landmark_ip_lc_and_indicative_poly_preprocessed,
  gfw_indigenous_community_and_indicative_lands. Country figures stay.
- GFW working files taken out: gfw_planted_forests_whitelist (SDPT whitelist),
  gfw_pixel_area, umd_area_2013, to_delete (round 48's rule looked for
  "todelete" and missed GFW's "to_delete").


## Round 48 (25 September): owner's list of 25 September

- Refiled (CATALOGUE_BY_TITLE, top): WWF terrestrial ecoregions and SBTN natural
  lands -> Biodiversity loss; projected change in dry spells -> Water scarcity;
  negligible risk -> Deforestation > Tree cover loss and alerts > Where clearing
  is likely; Nusantara palm oil mill sourcing areas (millopbuffer*) -> Palm oil >
  Mills and refineries. Taken out: WRI cities socioeconomic vulnerability, UMD
  net tree cover change, TODELETE, test dataset 001, SFB BRA SICAR, Peru
  permanent production forests. Fur Farms (Final Nail) -> Destruction > Of the
  planet > Fur farms (own heading).
- Colour scales: gladSpread spreads a data-driven step/interpolate (and match,
  numbered = ordered) over the whole cyan-violet span and over lightness, in
  order; keys look up GLAD_SPREAD so they show the same steps. Country layers
  (addCountryLayer) now colour + depth on the log scale, key under the row.
  Sitemap colourings' no-data colour is near-white (#EAE6DF), not a grey that
  mapped to violet.
- boundaries.geojson: France and Norway had iso3 "-99" (source quirk), so every
  country layer left them blank; now FRA/NOR (build_boundaries.py too).
- Row swatches of sitemap rows (and their type rows) show the colours their
  places are drawn in (sitemapDrawnColours/swatchFill/setRowSwatch).
- WRI land GHG monitoring system (GFW COG, no colour scale) drew as one grey
  sheet: GFW_COG_MEASURED -> gfwCogScale asks the tile service's statistics and
  adds rescale p2-p98, viridis, nodata=0. Not testable from the sandbox; check
  on the live map. Only the cropland emissions file of the dataset is drawn
  (gfwPickAsset's first COG); livestock files exist too.
- Drug underworld and capture map and the Eyes network now read from their
  pages' own data: pipeline/sitemaps/rich_maps.py (registry "rich": "capture" /
  "eyes"; build_boxes.py hands those over). capture_map is route "sitemap"
  (noAreaDots) with filters Show / Group type / Office / Company sector and six
  colourings (GI-TOC lenses). Eyes: places with full write-ups, 105 links
  (documented / inferred / convergence), Period filter from the diagram's bands.
  Built files are in culprits-tiles-more sitemaps/ (tiles round 48 patch) and
  rebuilt daily by the sitemaps job.


## Round 47 (25 September): Eyes leaves Earth; natural disasters; soil biodiversity; keys under Showing; columns stand up; Banking on Climate Chaos mapped

- eyes_craft is route "leave": ticked, it calls leaveEarth() (the Leave Earth
  button's hand-over to NASA's Eyes); backToMap() unticks it.
- The GLAD-L coverage row is taken out (catalogueRefine), so nothing is left
  under Base and reference > Boundaries and relief.
- skytruth_quakes moved to Destruction > Of the planet > Natural disasters.
- Biodiversity loss > Soil biodiversity: soil_spun (SPUN Underground Atlas,
  mycorrhizal richness and endemism, 1 km, CC BY 4.0; choices read from
  culprits-tiles-more soil/spun_choices.json, built by
  scripts/soil_biodiversity.py) and soilgrids (moved from Base and reference).
- The Showing box lists each layer's colour key under it (legendKeyPairs reads
  the key the layers box shows for that row; rebuilt when keys appear).
- Climate TRACE columns: every column at least three footprints tall, and the
  map tilts to 50 degrees once when columns first appear.
- bocc is now route geojsonlive on culprits-tiles-more bocc/banks.geojson
  (scripts/bocc.py: the report's two league tables, GLEIF headquarters,
  OpenStreetMap positions). app.js?v=47.


## Round 46 (24 September): every layer drawn in the GLAD-S2 colours

Round 44 recoloured the list's swatches only; most layers still drew in their
sources' colours (colours in the records, palettes here, servers' pictures).
Now one mapping (gladRgb / gladCss / gladValue in app.js) is applied to every
colour on the way to the screen: map.addLayer and setPaintProperty map every
*-color paint (literals and match/case outputs in place, zoom ramps stop by
stop, colours read from records by an expression), map.addSource sends raster
tiles through gladpx://<row>/<tile address> (pixel by pixel), and raster PMTiles
archives are mapped as they come out of the pmtiles protocol. Hue 0-360 goes
to 185-295 in order; greys get one hue per row; near-white, near-black and
transparency stay. Basemaps (base, s2, hillshade, labels), atlas plates and
image sources are not touched; a row with keepColour is left alone. Keys in
the panels follow through a MutationObserver. app.js?v=46.


## Round 45 (24 September): the 500 largest companies, compiled from Wikidata

Fortune's terms forbid copying its Global 500, so its companion row is gone.
In its place (General, same spot) the row largest_companies reads
culprits-tiles-more companies/largest.geojson, built weekly by
scripts/largest_companies.py: Wikidata revenue (P2139), latest year per
company, in dollars at the year's ECB or World Bank rate, top 500 that
Wikidata says are businesses, placed at headquarters. Every field in the box.
index.html now asks for app.js?v=45.


## Round 44 (24 September): every row in the GLAD-S2 style; Boundaries and relief pared down

- Colours: gladColour() gives every row (LAYERS and group children) a colour
  from cyan through blue and indigo to violet (hue 185-295, bright and
  saturated), keeping each row's place by its old hue; old greys spread by id.
  GLOW (haze, cores), NEO_PS and WORLD_PROB moved to the same blues. A row
  with keepColour: true keeps its own. Palettes of many classes (forest
  management, OSM land use, Trase ramps, wastewater steps) not yet changed.
- Boundaries and relief keeps only the GLAD-L coverage (catalogueRefine):
  Nusantara's boundaries, imagery, relief, towns, photos and news and GFW's
  GADM and test boundaries are taken out.
- index.html asks for app.js?v=44.


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
