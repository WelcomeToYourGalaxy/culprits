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
const LAYERS = [
  { id:"owid_co2",             name:"National CO₂ emissions", unit:"Mt CO₂/yr", colour:"#8A5750", route:"country", ready:true },
  { id:"climate_trace",        name:"Emitting assets",         unit:"t CO₂e/yr (GWP-100)", colour:"#8F4E40", route:"pmtiles", ready:false },
  { id:"global_energy_monitor",name:"Oil, gas and coal assets",unit:"capacity",   colour:"#7A5548", route:"pmtiles", ready:false },
  { id:"carbon_bombs",         name:"Carbon bombs",            unit:"Gt CO₂ lifetime", colour:"#6E4A44", route:"pmtiles", ready:true },
  { id:"power_plants",         name:"Power plants",            unit:"MW capacity", colour:"#7E5A4E", route:"pmtiles", ready:true,
    // The source covers every fuel and nothing is filtered out of the data.
    // Filtering happens here instead, where it is visible and reversible.
    facet: { property: "x_fuel", label: "fuel",
             values: ["Coal","Gas","Oil","Petcoke","Nuclear","Hydro","Wind","Solar",
                      "Biomass","Waste","Geothermal","Storage","Cogeneration",
                      "Wave and Tidal","Other"] } },
  { id:"trase",                name:"Commodity supply chains", unit:"ha",         colour:"#62755F", route:"pmtiles", ready:false },
  { id:"land_matrix",          name:"Land deals",              unit:"hectares",   colour:"#6C7F63", route:"country", ready:true,  isolate:true },
  { id:"counterglow",          name:"Industrial animal farms", unit:"facilities", colour:"#7B7A5C", route:"pmtiles", ready:false },
  { id:"epa_tri",              name:"US toxic releases",       unit:"lb/yr",      colour:"#5C6E77", route:"worker",  ready:false },
  { id:"gfw",                  name:"Deforestation alerts",    unit:"alerts",     colour:"#55705E", route:"worker",  ready:false },
  { id:"fishing",              name:"Fishing effort",          unit:"hours",      colour:"#4F6773", route:"worker",  ready:false },
];

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  container: "map",
  center: [12, 24],
  zoom: 1.6,
  attributionControl: { compact: true },
  style: {
    version: 8,
    sources: {
      base: {
        type: "raster",
        tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap © CARTO",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#17150F" } },
      { id: "base", type: "raster", source: "base", paint: { "raster-opacity": .8 } },
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

async function addPmtilesLayer(cfg) {
  const url = `${TILE_BASE}/${cfg.id}.pmtiles`;
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) throw new Error(`${head.status} at ${url}`);
  } catch (e) {
    setLayerState(cfg.id, `archive missing (${e.message})`);
    console.error(`[culprits] ${cfg.id}: ${e.message}`);
    return;
  }

  const src = `${cfg.id}-src`;
  map.addSource(src, { type: "vector", url: `pmtiles://${url}` });

  // Aggregate view. tippecanoe summed `value` into the clustered features, so
  // radius can encode magnitude *within this layer* without claiming anything
  // about any other.
  map.addLayer({
    id: `${cfg.id}-agg`,
    type: "circle",
    source: src,
    "source-layer": cfg.id,
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
      "circle-radius": [
        "case",
        [">", ["coalesce", ["get", "_count"], 1], 1],
        ["interpolate", ["linear"], ["get", "_count"],
          1, 3, 10, 6, 100, 11, 1000, 18, 10000, 26],
        ["interpolate", ["linear"], ["sqrt", ["coalesce", ["get", "value"], 0]],
          0, 2.5, 1, 4, 3, 7, 6, 12],
      ],
    },
  });

  // Individual features, from the threshold up. Only the visible tiles are
  // fetched, by range request, so this costs what the viewport costs.
  map.addLayer({
    id: `${cfg.id}-pt`,
    type: "circle",
    source: src,
    "source-layer": cfg.id,
    minzoom: CLUSTER_MAXZOOM,
    paint: {
      "circle-color": cfg.colour,
      "circle-opacity": .75,
      "circle-stroke-color": "#17150F",
      "circle-stroke-width": .6,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 14, 7],
      // A country centroid is not a facility. Hollow it out so it never reads
      // as a located site, and let the popup say so.
      "circle-opacity": ["case", ["==", ["get", "x_precision"], "country"], 0, .75],
      "circle-stroke-color": ["case",
        ["==", ["get", "x_precision"], "country"], cfg.colour, "#17150F"],
      "circle-stroke-width": ["case",
        ["==", ["get", "x_precision"], "country"], 1.4, .6],
    },
  });

  // Both layers, not just the detail one: below the cluster threshold the
  // aggregate layer is the only thing on screen, and it was unclickable.
  bindPopup(`${cfg.id}-agg`);
  bindPopup(`${cfg.id}-pt`);
}

/* ---------- country aggregate layers (choropleth) ---------- */

// Some sources have no coordinates — only totals per country. Those draw
// against real national borders rather than centroids, because a centroid
// dressed as a point claims a location the source never gave.
let boundariesAdded = false;

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
  if (!boundariesAdded) {
    map.addSource("boundaries", { type: "geojson", data: `${DATA_BASE}/boundaries.geojson`,
                                  promoteId: "iso3" });
    boundariesAdded = true;
  }

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
}

/* ---------- live layers, via the Worker ---------- */

const liveCache = new Map();

async function refreshLiveLayer(cfg) {
  if (map.getZoom() < CLUSTER_MAXZOOM) return;   // aggregate view: don't query
  const b = map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
    .map((n) => n.toFixed(3)).join(",");
  if (liveCache.get(cfg.id) === bbox) return;    // same viewport, already have it
  liveCache.set(cfg.id, bbox);

  const src = map.getSource(`${cfg.id}-live`);
  if (!src) return;
  try {
    const r = await fetch(`${WORKER}/${cfg.id}?bbox=${bbox}&z=${Math.round(map.getZoom())}`);
    if (!r.ok) throw new Error(`${r.status}`);
    src.setData(await r.json());
  } catch (e) {
    // A live source failing is not a reason for the map to fail. The layer
    // stays empty and says so rather than throwing.
    setLayerState(cfg.id, `unavailable (${e.message})`);
  }
}

function addLiveLayer(cfg) {
  map.addSource(`${cfg.id}-live`, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: `${cfg.id}-pt`,
    type: "circle",
    source: `${cfg.id}-live`,
    minzoom: CLUSTER_MAXZOOM,
    paint: {
      "circle-color": cfg.colour,
      "circle-opacity": .75,
      "circle-stroke-color": "#17150F",
      "circle-stroke-width": .6,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 14, 7],
    },
  });
  bindPopup(`${cfg.id}-pt`);
}

/* ---------- shared ---------- */

function bindPopup(layerId) {
  map.on("click", layerId, (e) => {
    const p = e.features[0].properties;
    const count = Number(p._count || 1);
    const value = p.value != null && p.value !== ""
      ? `${Number(p.value).toLocaleString()} ${p.unit || ""}`
      : "no magnitude recorded";

    // A merged feature inherits ONE member's name, operator, country, status
    // and link. The summed value is real; those fields are not facts about the
    // cluster, so they are withheld rather than shown with a caveat.
    const html = count > 1
      ? `<b>${count.toLocaleString()} sites</b>${value}` +
        `<div class="meta">Combined total for this area. Zoom in to see the ` +
        `individual sites and their details.</div>` +
        `<div class="meta">${p.source}<br>${p.licence || ""}</div>`
      : `<b>${p.name || "Unnamed"}</b>${value}` +
        (p.x_precision === "country"
          ? `<div class="meta" style="color:#8F4E40">Plotted at the country ` +
            `centroid — the source has no site coordinate for this one.</div>`
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
const facetState = new Map();

function applyFacet(cfg) {
  const chosen = facetState.get(cfg.id);
  const filter = (!chosen || chosen.size === 0)
    ? null
    : ["in", ["get", cfg.facet.property], ["literal", [...chosen]]];
  [`${cfg.id}-agg`, `${cfg.id}-pt`].forEach((l) => {
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
  box.innerHTML = cfg.facet.values
    .map((v) => `<button class="chip" data-facet="${cfg.id}" data-value="${v}">${v}</button>`)
    .join("") + `<button class="chip reset" data-facet="${cfg.id}" data-value="">all</button>`;
  return box;
}

function buildPanel() {
  const box = document.getElementById("layers");
  LAYERS.forEach((cfg) => {
    const row = document.createElement("label");
    row.className = "layer" + (cfg.ready ? "" : " pending");
    row.innerHTML =
      `<input type="checkbox" ${cfg.ready ? "checked" : "disabled"} data-layer="${cfg.id}">` +
      `<span class="swatch" style="background:${cfg.colour}"></span>` +
      `<span class="body"><span class="nm">${cfg.name}</span>` +
      `<span class="un" data-state="${cfg.id}">${cfg.unit}</span></span>`;
    box.appendChild(row);
    if (cfg.ready && cfg.facet) box.appendChild(facetRow(cfg));
  });

  box.addEventListener("click", (e) => {
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
    const id = e.target.dataset.layer;
    if (!id) return;
    const vis = e.target.checked ? "visible" : "none";
    [`${id}-agg`, `${id}-pt`, `${id}-fill`, `${id}-line`].forEach((l) => {
      if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
    });
  });

  document.getElementById("note").textContent =
    `Below zoom ${CLUSTER_MAXZOOM} every layer shows summed totals. Zoom past it and ` +
    `individual assets load for the visible area only. Units differ by layer and ` +
    `are never combined into a single figure.`;
}

function updateZoomState() {
  const z = map.getZoom();
  document.getElementById("zoomstate").innerHTML = z < CLUSTER_MAXZOOM
    ? `Aggregate view — <b>totals per cluster</b>. Zoom in for individual sites.`
    : `Detail view — <b>individual sites</b>, loaded for this area only.`;
}

map.on("load", () => {
  LAYERS.filter((c) => c.ready).forEach((cfg) => {
    try {
      if (cfg.route === "worker") addLiveLayer(cfg);
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
});

map.on("zoom", updateZoomState);
map.on("moveend", () => {
  LAYERS.filter((c) => c.ready && c.route === "worker").forEach(refreshLiveLayer);
});
