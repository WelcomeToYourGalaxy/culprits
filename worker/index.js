/**
 * Bounding-box proxy for the sources that need a key.
 *
 * Three of the live sources — Global Forest Watch, Global Fishing Watch and
 * Land Matrix — require credentials, and a static page cannot hold one without
 * publishing it. This Worker keeps the keys server-side and is the only thing
 * that ever sees them. It also supplies the CORS headers the upstream APIs
 * mostly don't send, which is the other reason a browser can't call them directly.
 *
 * Deploy free: 100,000 requests/day on Cloudflare's free plan.
 *
 *   wrangler secret put GFW_API_KEY
 *   wrangler secret put GFW_FISHING_TOKEN
 *   wrangler secret put LAND_MATRIX_KEY
 *
 * Request shape:
 *   /v1/<source>?bbox=minLon,minLat,maxLon,maxLat&z=<zoom>
 */

const ALLOWED_ORIGINS = [
  "https://welcometoyourgalaxy.github.io",
  "https://www.welcometoyourgalaxy.com",
  "http://localhost:8080",
];

// Cache upstream responses at the edge. Most panning revisits the same tiles,
// and these are the quota-limited sources, so this is what keeps the day's
// 100k requests from being spent on repeats.
const CACHE_SECONDS = 3600;

// Bump on any change to how responses are built. Without this the edge cache
// keeps serving bodies from the previous deploy for up to an hour — which is
// exactly what hid the EPA longitude fix.
const CACHE_VERSION = "v11";

// Reported by /v1/_diag so it is possible to tell, in one request, which build
// is actually live. Several fixes appeared not to work when the real problem
// was that the deploy had not happened.
const BUILD = "2026-09-05T03:00 three alert products, transparent-tile fallback";

// How far back deforestation alerts are fetched. Wider means more rows and a
// slower, heavier query; the API has no LIMIT to fall back on.
const ALERT_WINDOW_DAYS = 30;

// GFW publishes a new dataset version most days, and `/latest` is not a working
// alias here — asking for it returns "has no latest version". So the version is
// read from the catalogue rather than pinned in code, where it would rot within
// a day.
//
// But NEWEST IS NOT READY. A version appears in the list as soon as its build
// begins, hours before its assets finish. Querying one mid-build returns
// `500 {"message":null}` with no hint that the version is the problem — which
// is exactly what happened, including for GFW's own documented example, because
// that used the newest version too.
//
// So each candidate is checked and the newest FULLY BUILT one is used.
let gfwVersion = { value: null, at: 0 };
const GFW_VERSION_TTL = 6 * 3600 * 1000;
const GFW_BASE = "https://data-api.globalforestwatch.org";
const GFW_MAX_LOOKBACK = 6;

async function gfwLatestVersion(env) {
  if (gfwVersion.value && Date.now() - gfwVersion.at < GFW_VERSION_TTL) {
    return gfwVersion.value;
  }
  const head = { Accept: "application/json", "x-api-key": env.GFW_API_KEY || "" };

  const r = await fetch(`${GFW_BASE}/dataset/gfw_integrated_alerts`, { headers: head });
  if (!r.ok) throw new Error(`could not read GFW catalogue (${r.status})`);
  const versions = (await r.json())?.data?.versions;
  if (!Array.isArray(versions) || !versions.length) {
    throw new Error("GFW catalogue returned no versions");
  }

  // vYYYYMMDD sorts lexicographically, so newest first.
  const candidates = versions.slice().sort().reverse().slice(0, GFW_MAX_LOOKBACK);
  const rejected = [];
  for (const v of candidates) {
    try {
      const a = await fetch(`${GFW_BASE}/dataset/gfw_integrated_alerts/${v}/assets`,
                            { headers: head });
      if (!a.ok) { rejected.push(`${v}:${a.status}`); continue; }
      const assets = (await a.json())?.data || [];
      if (!assets.length) { rejected.push(`${v}:no assets`); continue; }
      const pending = assets.filter((x) => x.status !== "saved");
      if (pending.length) { rejected.push(`${v}:${pending.length} pending`); continue; }
      gfwVersion = { value: v, at: Date.now() };
      return v;
    } catch (e) {
      rejected.push(`${v}:${e.message}`);
    }
  }
  throw new Error(
    `no fully built GFW version in the last ${GFW_MAX_LOOKBACK} ` +
    `(${rejected.join(", ")})`
  );
}

/**
 * Convert an upstream payload into the atlas feature schema, so the map never
 * learns any source's private shape and a new upstream is one function here
 * rather than a branch in the map.
 *
 * The exact response shapes are NOT verified — these upstreams need keys and
 * were unreachable when this was written. Each shaper therefore tries the
 * plausible field names and, if it recognises nothing, returns null so the
 * caller can surface a clear error instead of an empty layer that looks like
 * "no data here".
 */
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const westward = (v) => (v === null || v === undefined ? null : (v > 0 ? -v : v));

// Rough bounding boxes per state, used only to pick which state to ask
// Envirofacts about. Deliberately generous: a state wrongly included costs one
// query, a state wrongly excluded loses facilities.
const STATE_BOXES = {
  AL:[-88.5,30.1,-84.8,35.1], AK:[-179,51,-129,72], AZ:[-115,31.3,-109,37.1],
  AR:[-94.7,33,-89.6,36.6], CA:[-124.5,32.5,-114,42.1], CO:[-109.1,36.9,-102,41.1],
  CT:[-73.8,40.9,-71.7,42.1], DE:[-75.8,38.4,-75,39.9], DC:[-77.2,38.7,-76.9,39.1],
  FL:[-87.7,24.4,-79.9,31.1], GA:[-85.7,30.3,-80.8,35.1], HI:[-160.3,18.8,-154.7,22.3],
  ID:[-117.3,41.9,-111,49.1], IL:[-91.6,36.9,-87.4,42.6], IN:[-88.1,37.7,-84.7,41.8],
  IA:[-96.7,40.3,-90.1,43.6], KS:[-102.1,36.9,-94.5,40.1], KY:[-89.6,36.4,-81.9,39.2],
  LA:[-94.1,28.9,-88.8,33.1], ME:[-71.1,42.9,-66.9,47.5], MD:[-79.5,37.8,-75,39.8],
  MA:[-73.6,41.2,-69.8,42.9], MI:[-90.5,41.6,-82.1,48.3], MN:[-97.3,43.4,-89.4,49.4],
  MS:[-91.7,30.1,-88,35.1], MO:[-95.8,35.9,-89.1,40.7], MT:[-116.1,44.3,-104,49.1],
  NE:[-104.1,39.9,-95.3,43.1], NV:[-120.1,35,-114,42.1], NH:[-72.6,42.6,-70.6,45.4],
  NJ:[-75.6,38.9,-73.8,41.4], NM:[-109.1,31.3,-103,37.1], NY:[-79.8,40.4,-71.8,45.1],
  NC:[-84.4,33.8,-75.4,36.6], ND:[-104.1,45.9,-96.5,49.1], OH:[-84.9,38.4,-80.5,42.4],
  OK:[-103.1,33.6,-94.4,37.1], OR:[-124.6,41.9,-116.4,46.3], PA:[-80.6,39.7,-74.6,42.3],
  RI:[-71.9,41.1,-71.1,42.1], SC:[-83.4,32,-78.5,35.3], SD:[-104.1,42.4,-96.4,46],
  TN:[-90.4,34.9,-81.6,36.7], TX:[-106.7,25.8,-93.5,36.6], UT:[-114.1,36.9,-109,42.1],
  VT:[-73.5,42.7,-71.5,45.1], VA:[-83.7,36.5,-75.2,39.5], WA:[-124.9,45.5,-116.9,49.1],
  WV:[-82.7,37.2,-77.7,40.7], WI:[-92.9,42.4,-86.8,47.1], WY:[-111.1,40.9,-104,45.1],
  PR:[-67.3,17.9,-65.2,18.6], VI:[-65.1,17.6,-64.5,18.5],
};

function statesForBbox(bbox) {
  const [w, s, e, n] = bbox.split(",").map(Number);
  const hits = [];
  for (const [abbr, [bw, bs, be, bn]] of Object.entries(STATE_BOXES)) {
    if (bw <= e && be >= w && bs <= n && bn >= s) hits.push(abbr);
  }
  return hits;
}

function rowsToGeoJSON(rows, source, unit, pick) {
  if (!Array.isArray(rows)) return null;
  const features = [];
  let i = 0;
  for (const row of rows) {
    const p = pick(row, i++);
    if (p.lon == null || p.lat == null || Number.isNaN(p.lon) || Number.isNaN(p.lat)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: {
        id: String(p.id ?? ""),
        source,
        name: p.name || "Unnamed",
        value: p.value ?? null,
        unit,
        year: p.year ?? null,
        licence: p.licence ?? "see source",
        url: p.url ?? null,
        // Namespaced exactly as normalize.py does, so a live feature and a
        // harvested one carry their source-specific detail the same way.
        ...Object.fromEntries(
          Object.entries(p.extra || {})
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => [`x_${k}`, v])
        ),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function firstArray(payload) {
  // Upstreams wrap their rows differently: data, results, entries, features.
  if (Array.isArray(payload)) return payload;
  for (const k of ["data", "results", "entries", "rows", "features"]) {
    if (Array.isArray(payload?.[k])) return payload[k];
  }
  return null;
}

function shape(sourceId, payload) {
  // Already GeoJSON? Pass it through untouched.
  if (payload?.type === "FeatureCollection" && Array.isArray(payload.features)) {
    return payload;
  }
  const rows = firstArray(payload);
  if (!rows) return null;

  if (sourceId === "gfw") {
    return rowsToGeoJSON(rows, "gfw", "alert intensity", (r, i) => ({
      id: `${r.longitude},${r.latitude},${r.gfw_integrated_alerts__date ?? i}`,
      name: r.gfw_integrated_alerts__date
        ? `Alert ${r.gfw_integrated_alerts__date}`
        : "Deforestation alert",
      lon: num(r.longitude ?? r.lon),
      lat: num(r.latitude ?? r.lat),
      // One row is one alert pixel, so the magnitude is a count of one. The
      // date and confidence are what actually distinguish them.
      value: num(r.gfw_integrated_alerts__intensity) ?? 1,
      year: r.gfw_integrated_alerts__date
        ? Number(String(r.gfw_integrated_alerts__date).slice(0, 4)) || null
        : null,
      licence: "Global Forest Watch — see their terms",
    }));
  }
  if (sourceId === "fishing") {
    return rowsToGeoJSON(rows, "fishing", "apparent fishing hours", (r) => ({
      id: r.id ?? `${r.lat},${r.lon}`,
      name: r.flag ?? r.vessel_id ?? "Fishing activity",
      lon: num(r.lon ?? r.longitude),
      lat: num(r.lat ?? r.latitude),
      value: num(r.hours ?? r.value ?? r.detections),
      licence: "Global Fishing Watch, non-commercial use only",
    }));
  }
  if (sourceId === "epa_tri") {
    return rowsToGeoJSON(rows, "epa_tri", "TRI facility", (r) => ({
      id: r.tri_facility_id ?? r.TRI_FACILITY_ID ?? r.frs_id,
      name: r.facility_name ?? r.FACILITY_NAME ?? "TRI facility",
      // The facility table carries no release quantities — those live in
      // separate reporting tables — so rather than leave the popup saying
      // nothing, it carries what this record does know: who owns it, where it
      // is, whether it has closed, and a link to EPA's own report.
      extra: {
        parent: r.parent_co_name || r.standardized_parent_company || null,
        city: r.city_name || null,
        county: r.county_name || null,
        state: r.state_abbr || null,
        address: r.street_address || null,
        closed: r.fac_closed_ind === "1" ? "reported closed" : null,
        contact: r.asgn_public_contact || null,
        registry_id: r.epa_registry_id || null,
      },
      url: r.epa_registry_id
        ? `https://echo.epa.gov/detailed-facility-report?fid=${r.epa_registry_id}`
        : null,
      // Sign restored here: every TRI facility is in the US or its territories,
      // all of which are west of the meridian, so a positive longitude is the
      // unsigned storage format rather than a real eastern location.
      lon: westward(num(r.pref_longitude ?? r.longitude ?? r.LONGITUDE)),
      lat: num(r.pref_latitude ?? r.latitude ?? r.LATITUDE),
      value: null,
      licence: "US Government work, public domain",
    }));
  }
  if (sourceId === "landmatrix") {
    return rowsToGeoJSON(rows, "landmatrix", "hectares", (r) => ({
      id: r.id ?? r.deal_id,
      name: r.target_country?.name ?? r.country ?? `Deal ${r.id ?? ""}`,
      lon: num(r.point_lon ?? r.lon ?? r.longitude),
      lat: num(r.point_lat ?? r.lat ?? r.latitude),
      value: num(r.deal_size ?? r.size ?? r.hectares),
      licence: "Land Matrix — licence disputed, see sources.json",
    }));
  }
  return null;
}

/* ---------- Global Fishing Watch: 4Wings tiles ---------- */

// Why this map stopped calling /v3/4wings/report.
//
// The 429 was never client-side pacing. GFW documents the report endpoint as
// permitting one report per USER ACCOUNT at a time — not per token, not per
// browser tab: "This endpoint only support one report by user at the same
// time. If you send more than 1 request at the same time, you will receive a
// 429 error." Reports also run asynchronously and the gateway gives up at 100
// seconds with a 524, after which the result has to be collected separately
// from /v3/4wings/last-report, which keeps exactly ONE result, for 30 minutes,
// with no per-request id.
//
// So an in-flight guard, a debounce and a backoff could not have fixed it. The
// quota is shared across every visitor to the published page: two readers
// opening the map at the same moment are already two concurrent reports, and
// nothing in one browser can serialise the other browser. The layer would have
// kept working alone and failing in public.
//
// The tile endpoint carries no report queue. It is an ordinary cacheable GET
// per z/x/y, and a z/x/y key repeats across visitors in a way a viewport bbox
// never does — so the edge cache in front of it actually earns its keep.
// Global FISHING Watch. Note the near-identical name of FOREST_TILES_BASE
// below: the two vendors are different organisations with different keys.
const FISHING_4WINGS_BASE = "https://gateway.api.globalfishingwatch.org/v3/4wings";

// GFW serves 4Wings tiles from z0 to z12 only.
const FISHING_TILE_MAXZOOM = 12;

// Tiles are cached far harder than the bbox routes. The date window below moves
// in whole days, so a tile's content is stable for a day, and every visitor
// requests the identical URL.
const TILE_CACHE_SECONDS = 86400;

// The fishing layer's colour from map/app.js. GFW builds a ramp as a single
// hue at nine alpha steps, so this one value is the entire palette.
const FISHING_RGB = [79, 103, 115];

// Whole days, so the URL is identical for everyone and the cache can hold it.
// The window ends four days back because the dataset itself stops 96 hours ago,
// and a range running to today would ask for days that do not exist yet.
function fishingDateRange(now = Date.now()) {
  const end = new Date(now - 4 * 86400_000);
  const start = new Date(end.getTime() - 365 * 86400_000);
  return `${start.toISOString().slice(0, 10)},${end.toISOString().slice(0, 10)}`;
}

// The `style` query parameter is not an opaque id handed out by the API. It is
// base64 of {"color":[r,g,b],"ramp":[...9 numbers]} — decode the style in GFW's
// own documented example URL and that is what comes out. So it can be built
// here, and the only thing actually needed from the API is the ramp: the nine
// values at which the alpha steps.
//
// Those come per zoom from /v3/4wings/bins/{z}, because a cell's fishing hours
// at z2 and at z10 differ by orders of magnitude. One shared ramp renders every
// close-in view as a flat wash.
const binsByZoom = new Map();          // z -> { value: number[], at: ms }
const BINS_TTL = 24 * 3600 * 1000;

// Used only when /bins cannot be reached. Wrong in its detail but right in
// shape, which beats a blank layer; /v1/_diag reports when it is in use.
const FALLBACK_RAMP = [0, 5, 20, 60, 150, 400, 1000, 2500, 6000];

async function fishingRamp(z, env) {
  const hit = binsByZoom.get(z);
  if (hit && Date.now() - hit.at < BINS_TTL) return hit.value;

  // datasets[0] keeps its brackets unencoded, as on every other 4Wings call —
  // GFW's examples pass curl --globoff precisely to stop them being escaped,
  // and an encoded key reads to the gateway as a missing parameter.
  const url = `${FISHING_4WINGS_BASE}/bins/${z}` +
    "?datasets[0]=public-global-fishing-effort%3Alatest" +
    `&date-range=${encodeURIComponent(fishingDateRange())}` +
    "&interval=DAY&temporal-aggregation=true&num-bins=9";

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${env.GFW_FISHING_TOKEN}`, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`bins ${r.status}`);

  // Documented shape is { entries: [ [n, n, ...] ] } — the bin edges arrive
  // wrapped one level deeper than the other endpoints' rows.
  const raw = (await r.json())?.entries?.[0];
  const ramp = Array.isArray(raw) ? raw.map(Number).filter((n) => Number.isFinite(n)) : [];
  if (ramp.length < 2) throw new Error("bins returned no usable edges");

  // The style wants exactly nine ascending steps. Pad by repeating the last
  // edge rather than inventing headroom that would wash the top of the ramp out.
  while (ramp.length < 9) ramp.push(ramp[ramp.length - 1]);
  const value = ramp.slice(0, 9);
  binsByZoom.set(z, { value, at: Date.now() });
  return value;
}

function fishingStyle(ramp) {
  // Percent-encoded, unlike the brackets above: this is a VALUE, and GFW's own
  // examples percent-encode values (%3A, %2C). The bracket quirk is in how
  // their parser reads parameter NAMES, which is a different thing.
  return encodeURIComponent(btoa(JSON.stringify({ color: FISHING_RGB, ramp })));
}

function fishingTileUrl(z, x, y, format, style) {
  // interval=DAY with temporal-aggregation=true over a 365-day window is the
  // combination GFW's own MVT example uses, and DAY's documented maximum span
  // is exactly one year. Aggregation collapses the frames to one value per
  // cell, which is what a single static heatmap needs.
  const q = [
    "datasets[0]=public-global-fishing-effort%3Alatest",
    `date-range=${encodeURIComponent(fishingDateRange())}`,
    `format=${format}`,
    "interval=DAY",
    "temporal-aggregation=true",
  ];
  if (style) q.push(`style=${style}`);
  return `${FISHING_4WINGS_BASE}/tile/heatmap/${z}/${x}/${y}?${q.join("&")}`;
}

/* ---------- a protobuf reader, only enough to describe an MVT ---------- */

// This exists so the vector-tile option can be taken on evidence rather than on
// a guessed source-layer name. /v1/_fishing_mvt/{z}/{x}/{y} fetches one real
// tile and reports the layer names and property keys actually inside it.
function pbSkip(b, p, wire) {
  if (wire === 0) { while (b[p.i++] & 0x80); }
  else if (wire === 1) p.i += 8;
  // Read the length into a local first. `p.i += pbVarint(b, p)` evaluates the
  // left-hand p.i BEFORE the call, so the cursor movement inside pbVarint gets
  // overwritten by the assignment and every length prefix is re-read as a tag.
  else if (wire === 2) { const len = pbVarint(b, p); p.i += len; }
  else if (wire === 5) p.i += 4;
  else throw new Error(`unknown wire type ${wire}`);
}

function pbVarint(b, p) {
  let out = 0, shift = 0, byte;
  do {
    byte = b[p.i++];
    out += (byte & 0x7f) * Math.pow(2, shift);
    shift += 7;
  } while (byte & 0x80);
  return out;
}

function pbString(b, p) {
  const len = pbVarint(b, p);
  const s = new TextDecoder().decode(b.subarray(p.i, p.i + len));
  p.i += len;
  return s;
}

function mvtValue(b) {
  const p = { i: 0 };
  while (p.i < b.length) {
    const key = pbVarint(b, p), field = key >> 3, wire = key & 7;
    if (field === 1 && wire === 2) return pbString(b, p);
    if (field === 2 && wire === 5) {
      const v = new DataView(b.buffer, b.byteOffset + p.i, 4).getFloat32(0, true);
      p.i += 4; return v;
    }
    if (field === 3 && wire === 1) {
      const v = new DataView(b.buffer, b.byteOffset + p.i, 8).getFloat64(0, true);
      p.i += 8; return v;
    }
    if ((field === 4 || field === 5) && wire === 0) return pbVarint(b, p);
    if (field === 6 && wire === 0) { const v = pbVarint(b, p); return (v >> 1) ^ -(v & 1); }
    if (field === 7 && wire === 0) return Boolean(pbVarint(b, p));
    pbSkip(b, p, wire);
  }
  return null;
}

function mvtLayer(b) {
  const p = { i: 0 };
  const out = { name: null, features: 0, keys: [], sample_values: [], extent: null, version: null };
  while (p.i < b.length) {
    const key = pbVarint(b, p), field = key >> 3, wire = key & 7;
    if (field === 1 && wire === 2) out.name = pbString(b, p);
    else if (field === 2 && wire === 2) {
      out.features++;
      const len = pbVarint(b, p);      // same ordering trap as in pbSkip
      p.i += len;
    }
    else if (field === 3 && wire === 2) out.keys.push(pbString(b, p));
    else if (field === 4 && wire === 2) {
      const len = pbVarint(b, p);
      if (out.sample_values.length < 8) {
        out.sample_values.push(mvtValue(b.subarray(p.i, p.i + len)));
      }
      p.i += len;
    }
    else if (field === 5 && wire === 0) out.extent = pbVarint(b, p);
    else if (field === 15 && wire === 0) out.version = pbVarint(b, p);
    else pbSkip(b, p, wire);
  }
  return out;
}

function mvtSummary(bytes) {
  const b = new Uint8Array(bytes);
  const p = { i: 0 };
  const layers = [];
  while (p.i < b.length) {
    const key = pbVarint(b, p), field = key >> 3, wire = key & 7;
    if (field === 3 && wire === 2) {
      const len = pbVarint(b, p);
      layers.push(mvtLayer(b.subarray(p.i, p.i + len)));
      p.i += len;
    } else pbSkip(b, p, wire);
  }
  return layers;
}

/* ---------- Global Forest Watch: alert tiles ---------- */

// Read out of wri/gfw-tile-cache's own source, not guessed and not from any
// documentation — its docs page is client-rendered and the route pattern is
// not written down anywhere I could find. The route is declared in
// app/routes/titiler/gfw_integrated_alerts.py:
//
//   GET /gfw_integrated_alerts/{version}/dynamic/{z}/{x}/{y}.png
//       ?start_date=YYYY-MM-DD &end_date=YYYY-MM-DD
//       &render_type=true_color|encoded
//       &alert_confidence=low|high|highest
//
// The handler takes no auth dependency, so this needs no API key. That is the
// same conclusion as the fishing layer reached from the other direction:
// /query/json is an ANALYSIS endpoint, meant for one AOI at a time, which is
// why it wants a tiny polygon and a date filter and still fails. The tile
// service is what GFW's own map renders from.
const FOREST_TILES_BASE = "https://tiles.globalforestwatch.org";

// A 1x1 fully transparent PNG, decoded once at module scope. Served in place
// of an upstream tile failure so one bad tile does not read as a broken layer.
const TRANSPARENT_PNG = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk" +
  "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

// The route validates 0 <= z <= 22.
const FOREST_TILE_MAXZOOM = 22;

// Three alert products, because ONE OF THEM IS TROPICS-ONLY and that is not
// obvious from the map.
//
// gfw_integrated_alerts combines GLAD-L (Landsat), GLAD-S2 (Sentinel-2) and
// RADD (Sentinel-1 radar). All three are pan-tropical by design: they cover
// the humid tropics and stop there. That is why the layer shows the Amazon,
// the Congo basin and Southeast Asia and nothing in British Columbia, Sweden
// or Siberia — not missing data, a stated extent.
//
// gfw_integrated_dist_alerts and umd_glad_dist_alerts are DIST-ALERT, a
// vegetation-disturbance product with GLOBAL coverage. Those are the layers
// that show boreal and temperate clearing.
//
// Keeping all three separate rather than merging them is the honest choice:
// they detect different things by different means, and a reader who sees an
// alert should be able to tell which instrument saw it.
const FOREST_ALERT_DATASETS = {
  integrated: "gfw_integrated_alerts",
  dist:       "gfw_integrated_dist_alerts",
  glad_dist:  "umd_glad_dist_alerts",
};

// `latest` is accepted directly here — the version is a plain path string, not
// the enum the /query routes use, so the version-resolution dance that
// gfwLatestVersion does for the Data API is not needed for tiles.
const FOREST_TILE_VERSION = "latest";

// Whole days, so every visitor requests the same URL and the cache can hold it.
function alertDateRange(days = ALERT_WINDOW_DAYS, now = Date.now()) {
  const end = new Date(now);
  const start = new Date(now - days * 86400_000);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function alertTileUrl(z, x, y, kind = "integrated", days = ALERT_WINDOW_DAYS) {
  const dataset = FOREST_ALERT_DATASETS[kind] || FOREST_ALERT_DATASETS.integrated;
  const [start, end] = alertDateRange(days);
  // alert_confidence=low means "at least low", i.e. every alert the source
  // publishes. Anything stricter would be filtering the data on the reader's
  // behalf, which belongs in the map panel, not in the fetch.
  return `${FOREST_TILES_BASE}/${dataset}/${FOREST_TILE_VERSION}` +
    `/dynamic/${z}/${x}/${y}.png` +
    `?start_date=${start}&end_date=${end}` +
    "&render_type=true_color&alert_confidence=low";
}

const UPSTREAM = {
  gfw: {
    requires: "GFW_API_KEY",
    // Integrated deforestation alerts. Three things this needs that a plain GET
    // cannot do, all learned the hard way from a 404:
    //   - the dataset is `gfw_integrated_alerts`, not a GADM-scoped name
    //   - the query endpoint is POST, not GET
    //   - it is a raster asset, so the area of interest is a GeoJSON polygon,
    //     not a bbox expressed in SQL
    method: "POST",
    url: async (bbox, zoom, env) =>
      "https://data-api.globalforestwatch.org/dataset/gfw_integrated_alerts/" +
      `${await gfwLatestVersion(env)}/query/json`,
    headers: (env) => ({
      "x-api-key": env.GFW_API_KEY,
      "Content-Type": "application/json",
    }),
    // Alerts are per 10m pixel, so an unbounded query over a degree of rainforest
    // asks for millions of rows and the API returns a 500 with a null message.
    // Two limits keep it answerable: a small area, and a recent date window.
    maxAreaDeg2: 0.5,
    body: (bbox) => {
      const [w, s, e, n] = bbox.split(",").map(Number);
      const since = new Date(Date.now() - ALERT_WINDOW_DAYS * 86400_000)
        .toISOString().slice(0, 10);
      return JSON.stringify({
        // LIMIT is not accepted here — the date filter is what bounds the result.
        sql: "SELECT longitude, latitude, gfw_integrated_alerts__date, " +
             "gfw_integrated_alerts__intensity, gfw_integrated_alerts__confidence " +
             `FROM results WHERE gfw_integrated_alerts__date >= '${since}'`,
        geometry: {
          type: "Polygon",
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
      });
    },
  },
  fishing: {
    requires: "GFW_FISHING_TOKEN",
    // The 4Wings report endpoint is POST, not GET, and the area of interest
    // travels as a GeoJSON polygon in the body. The query string carries the
    // dataset and the date range, with the brackets in datasets[0] left
    // UNENCODED — GFW's own examples pass curl --globoff specifically to stop
    // them being escaped, and an encoded key reads to the gateway as missing.
    method: "POST",
    maxAreaDeg2: 100,
    url: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 365 * 86400_000);
      const range = `${start.toISOString().slice(0, 10)},${end.toISOString().slice(0, 10)}`;
      return "https://gateway.api.globalfishingwatch.org/v3/4wings/report" +
        "?datasets[0]=public-global-fishing-effort:latest" +
        "&spatial-resolution=LOW&temporal-resolution=YEARLY&group-by=FLAG" +
        `&spatial-aggregation=false&format=JSON&date-range=${range}`;
    },
    headers: (env) => ({
      Authorization: `Bearer ${env.GFW_FISHING_TOKEN}`,
      "Content-Type": "application/json",
    }),
    body: (bbox) => {
      const [w, s, e, n] = bbox.split(",").map(Number);
      return JSON.stringify({
        geojson: {
          type: "Polygon",
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
      });
    },
  },
  epa_tri: {
    // Envirofacts silently ignores range filters on tri_facility: asking for
    // latitude between 33.9 and 34.1 returns Puerto Rico. Equality filters do
    // work, so the query is scoped by state and the bounding box is applied
    // here, after the rows come back.
    postFilter: true,
    // EPA Envirofacts is public and needs no key, but it does not send CORS
    // headers, so the browser still cannot call it directly. It is routed
    // through here for that reason alone.
    //
    // Envirofacts chains column filters as path segments. This pattern is
    // INFERRED and untested — if it is wrong the request returns a 502 naming
    // shape(), not an empty layer.
    // A viewport near a state line covers two or more states, and querying
    // only the first drew facilities on one side of the border and nothing on
    // the other. Every intersecting state is fetched and the results merged.
    multi: (bbox) => {
      const states = statesForBbox(bbox);
      if (!states.length) return [];
      // Bounded so a wide viewport cannot fan out into dozens of requests.
      return states.slice(0, 6).map(
        (abbr) =>
          `https://data.epa.gov/efservice/tri_facility/state_abbr/${abbr}` +
          "/rows/0:5000/JSON"
      );
    },
    headers: () => ({}),
  },
  landmatrix: {
    url: (bbox) => `https://landmatrix.org/api/deals/?bbox=${bbox}&limit=2000`,
    headers: (env) => (env.LAND_MATRIX_KEY ? { Authorization: `Token ${env.LAND_MATRIX_KEY}` } : {}),
  },
};

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors(origin))) headers.set(k, v);
  // Caching belongs at the edge, not in the browser. The stored copy carries a
  // max-age so Cloudflare can reuse it; the copy sent onward does not, because
  // a browser holding a response for an hour makes every fix invisible until
  // it expires — which hid two separate corrections here.
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers });
}

// Tiles take the opposite caching decision to the bbox routes. There, a browser
// holding a response for an hour made fixes invisible, so responses go out
// no-store. Here the browser cache is the point: a raster layer re-requests the
// same z/x/y on every pan back, and each miss is a request against both the
// Cloudflare free-plan allowance and GFW's daily cap. ?fresh=1 still bypasses
// the edge copy when a change needs verifying.
function withTileCors(response, origin) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors(origin))) headers.set(k, v);
  headers.set("Cache-Control", `public, max-age=${TILE_CACHE_SECONDS}`);
  return new Response(response.body, { status: response.status, headers });
}

function bad(message, status, origin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

function validBbox(raw) {
  if (!raw) return null;
  const p = raw.split(",").map(Number);
  if (p.length !== 4 || p.some(Number.isNaN)) return null;
  const [minLon, minLat, maxLon, maxLat] = p;
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) return null;
  if (minLon >= maxLon || minLat >= maxLat) return null;
  // Refuse whole-world requests: at that zoom the map should be reading the
  // pre-tiled aggregate, not asking a rate-limited API for everything.
  if ((maxLon - minLon) * (maxLat - minLat) > 2000) return null;
  return p.join(",");
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const url = new URL(request.url);

    // Hoisted: the tile route below caches too, and it runs before the
    // bbox routes reach their own lookup.
    const cache = caches.default;

    // Names only, never values. Answers "does the running Worker actually see
    // the secrets?" — which `wrangler secret list` cannot, since that reports
    // what is stored, not what this deployment reads.
    if (url.pathname === "/v1/_diag") {
      const expected = ["GFW_API_KEY", "GFW_FISHING_TOKEN", "LAND_MATRIX_KEY"];
      return new Response(JSON.stringify({
        routes: Object.keys(UPSTREAM),
        secrets_visible: Object.fromEntries(
          expected.map((k) => [k, Boolean(env[k]) && String(env[k]).length > 0])
        ),
        all_binding_names: Object.keys(env).sort(),
        gfw_version_cached: gfwVersion.value,
        build: BUILD,
        cache_version: CACHE_VERSION,
        // The fishing layer no longer uses the bbox route below. /report is
        // limited to one concurrent report per GFW ACCOUNT, so it could never
        // serve a page with more than one reader; these are what replaced it.
        fishing_tile_example: fishingTileUrl(3, 4, 3, "PNG", "<style>"),
        fishing_date_window: fishingDateRange(),
        fishing_ramp_cached_zooms: [...binsByZoom.keys()].sort((a, b) => a - b),
        probes: [
          "/v1/_fishing_mvt/{z}/{x}/{y} — names the MVT source-layer and its keys",
          "/v1/_fishing_report_status — what the account's single report slot is doing",
          "/v1/_gfwtiles — GFW tile-cache routes + whether alerts have a tile asset",
        ],
        epa_query_for_los_angeles: (UPSTREAM.epa_tri.multi
          ? UPSTREAM.epa_tri.multi("-118.4,33.9,-118.1,34.1")
          : UPSTREAM.epa_tri.url("-118.4,33.9,-118.1,34.1")),
        fishing_query: UPSTREAM.fishing.url("-10,50,-9,51", 9),
      }, null, 2), {
        headers: { "Content-Type": "application/json", ...cors(origin) },
      });
    }

    // Read-only passthrough to the GFW Data API, for working out what a
    // dataset actually offers instead of guessing at it. GET only, GFW only,
    // and the key never leaves the Worker.
    //   /v1/_gfw?path=/dataset/gfw_integrated_alerts
    //   /v1/_gfw?path=/dataset/gfw_integrated_alerts/latest/fields
    if (url.pathname === "/v1/_gfw") {
      const rel = url.searchParams.get("path") || "";
      if (!rel.startsWith("/")) return bad("path must start with /", 400, origin);
      const target = "https://data-api.globalforestwatch.org" + rel;
      const up = await fetch(target, {
        headers: { Accept: "application/json", "x-api-key": env.GFW_API_KEY || "" },
      });
      const text = await up.text();
      return new Response(text, {
        status: up.status,
        headers: { "Content-Type": "application/json", ...cors(origin) },
      });
    }

    // Runs the example straight out of GFW's documentation, with a fixed tiny
    // polygon in Sumatra and their exact SQL. If this works, the problem is in
    // how the gfw route builds its query. If it fails too, the problem is the
    // account, the key, or the endpoint itself.
    if (url.pathname === "/v1/_gfwexample") {
      const version = url.searchParams.get("version") || await gfwLatestVersion(env);
      const target =
        `https://data-api.globalforestwatch.org/dataset/gfw_integrated_alerts/${version}/query/json`;
      const body = {
        sql: "SELECT longitude, latitude, gfw_integrated_alerts__date, " +
             "gfw_integrated_alerts__intensity, gfw_integrated_alerts__confidence " +
             "FROM results WHERE gfw_integrated_alerts__date >= '2025-06-04'",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [103.19732666015625, 0.5537709801264608],
            [103.24882507324219, 0.5647567848663363],
            [103.21277618408203, 0.5932511181408705],
            [103.19732666015625, 0.5537709801264608],
          ]],
        },
      };
      const up = await fetch(target, {
        method: "POST",
        headers: {
          "x-api-key": env.GFW_API_KEY || "",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await up.text();
      return new Response(JSON.stringify({
        version_used: version,
        upstream_status: up.status,
        upstream_body: text.slice(0, 1500),
      }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors(origin) },
      });
    }

    // Read-only passthrough to EPA Envirofacts, for working out its filter
    // syntax by trying it rather than guessing. No key involved; it exists
    // because Envirofacts sends no CORS headers.
    //   /v1/_epa?path=/tri_facility/latitude/>/33.9/latitude/</34.1/rows/0:5/JSON
    if (url.pathname === "/v1/_epa") {
      const rel = url.searchParams.get("path") || "";
      if (!rel.startsWith("/")) return bad("path must start with /", 400, origin);
      const up = await fetch("https://data.epa.gov/efservice" + rel,
                             { headers: { Accept: "application/json" } });
      const text = await up.text();
      return new Response(text.slice(0, 4000), {
        status: up.status,
        headers: { "Content-Type": "application/json", ...cors(origin) },
      });
    }

    // Asks GFW what the account's single report slot is currently doing. The
    // 429 from /report names the report occupying the slot but not how long it
    // has left; this returns {"status":"running"} while one is still going,
    // 404 once nothing is held (results are kept 30 minutes), or the finished
    // report itself. Useful for confirming a stuck report has cleared.
    // Discovers how to reach deforestation alerts as tiles instead of as a
    // query. WRI runs a separate public tile service, tiles.globalforestwatch.org
    // (wri/gfw-tile-cache), described as "raster and vector tile API for
    // datasets in the GFW Data API" — the same architecture that fixed fishing.
    //
    // Its route pattern is not in any documentation I could find, and its docs
    // page is client-rendered, so this reads the OpenAPI spec directly and
    // reports every path that takes z/x/y, plus whether this dataset actually
    // has a tile asset. Guessing the URL is what this route exists to avoid.
    if (url.pathname === "/v1/_gfwtiles") {
      const out = { tile_routes: [], alert_assets: [], errors: [] };

      try {
        const spec = await fetch("https://tiles.globalforestwatch.org/openapi.json",
                                 { headers: { Accept: "application/json" } });
        if (!spec.ok) throw new Error(`openapi ${spec.status}`);
        const paths = Object.keys((await spec.json())?.paths || {});
        out.tile_routes = paths.filter((p) => p.includes("{z}"));
        out.other_routes = paths.filter((p) => !p.includes("{z}")).slice(0, 40);
      } catch (e) {
        out.errors.push(`tile spec: ${e.message}`);
      }

      // A tile route is only usable if this dataset has been tiled. The assets
      // endpoint says so, and it is the same call gfwLatestVersion already makes.
      try {
        const v = await gfwLatestVersion(env);
        out.version = v;
        const a = await fetch(
          `${GFW_BASE}/dataset/gfw_integrated_alerts/${v}/assets`,
          { headers: { "x-api-key": env.GFW_API_KEY, Accept: "application/json" } });
        if (!a.ok) throw new Error(`assets ${a.status}`);
        out.alert_assets = ((await a.json())?.data || []).map((d) => ({
          type: d.asset_type, status: d.status, uri: d.asset_uri,
        }));
      } catch (e) {
        out.errors.push(`assets: ${e.message}`);
      }

      return new Response(JSON.stringify(out, null, 2), {
        headers: { "Content-Type": "application/json", ...cors(origin) },
      });
    }

    if (url.pathname === "/v1/_fishing_report_status") {
      if (!env.GFW_FISHING_TOKEN) {
        return bad("GFW_FISHING_TOKEN is not set on this Worker", 503, origin);
      }
      const up = await fetch(`${FISHING_4WINGS_BASE}/last-report`, {
        headers: { Authorization: `Bearer ${env.GFW_FISHING_TOKEN}`, Accept: "application/json" },
      });
      return new Response((await up.text()).slice(0, 4000), {
        status: up.status,
        headers: { "Content-Type": "application/json", ...cors(origin) },
      });
    }

    // Fetches one real MVT tile and reports what is inside it: layer names,
    // property keys, feature count, extent. The vector-tile option needs a
    // `source-layer` name, and that name is not in GFW's documentation — this
    // reads it off an actual tile instead of guessing at it.
    //   /v1/_fishing_mvt/3/4/3
    {
      const m = url.pathname.match(/^\/v1\/_fishing_mvt\/(\d+)\/(\d+)\/(\d+)$/);
      if (m) {
        if (!env.GFW_FISHING_TOKEN) {
          return bad("GFW_FISHING_TOKEN is not set on this Worker", 503, origin);
        }
        const [z, x, y] = m.slice(1).map(Number);
        const target = fishingTileUrl(z, x, y, "MVT", null);
        const up = await fetch(target, {
          headers: { Authorization: `Bearer ${env.GFW_FISHING_TOKEN}` },
        });
        if (!up.ok) {
          return new Response(JSON.stringify({
            requested: target,
            upstream_status: up.status,
            upstream_body: (await up.text()).slice(0, 800),
          }, null, 2), {
            status: up.status,
            headers: { "Content-Type": "application/json", ...cors(origin) },
          });
        }
        const buf = await up.arrayBuffer();
        let layers, error = null;
        try { layers = mvtSummary(buf); }
        catch (e) { error = e.message; layers = []; }
        return new Response(JSON.stringify({
          requested: target,
          bytes: buf.byteLength,
          // These are the two values map/app.js would need: `source-layer` is
          // layers[].name, and the property to style on is one of keys[].
          layers,
          decode_error: error,
        }, null, 2), {
          headers: { "Content-Type": "application/json", ...cors(origin) },
        });
      }
    }

    // The fishing effort heatmap, one tile at a time.
    //   /v1/fishing_tile/{z}/{x}/{y}          -> PNG, styled
    //   /v1/fishing_tile/{z}/{x}/{y}?format=MVT -> vector, unstyled
    //
    // Deliberately not routed through the UPSTREAM table below: that path is
    // built around a bbox, a JSON body and a GeoJSON shaper, none of which
    // apply to an image.
    {
      const m = url.pathname.match(/^\/v1\/fishing_tile\/(\d+)\/(\d+)\/(\d+)$/);
      if (m) {
        if (!env.GFW_FISHING_TOKEN) {
          return bad(
            "GFW_FISHING_TOKEN is not set on this Worker — run: wrangler secret put GFW_FISHING_TOKEN",
            503, origin
          );
        }
        const [z, x, y] = m.slice(1).map(Number);
        const span = Math.pow(2, z);
        if (z > FISHING_TILE_MAXZOOM || x < 0 || y < 0 || x >= span || y >= span) {
          return bad(`tile ${z}/${x}/${y} is outside the served range (z0–z${FISHING_TILE_MAXZOOM})`,
                     400, origin);
        }
        const format = url.searchParams.get("format") === "MVT" ? "MVT" : "PNG";

        const cacheKey = new Request(
          `${url.origin}/v1/fishing_tile/${z}/${x}/${y}?format=${format}&_c=${CACHE_VERSION}`);
        const fresh = url.searchParams.get("fresh") === "1";
        const hit = fresh ? null : await cache.match(cacheKey);
        if (hit) return withTileCors(hit, origin);

        // A ramp failure must not cost the layer. Falling back draws the data
        // with the wrong thresholds, which is visible and fixable; throwing
        // draws nothing and looks like the source is down.
        let style = null, rampSource = "none (MVT)";
        if (format === "PNG") {
          try {
            style = fishingStyle(await fishingRamp(z, env));
            rampSource = "bins";
          } catch (e) {
            style = fishingStyle(FALLBACK_RAMP);
            rampSource = `fallback (${e.message})`;
          }
        }

        const target = fishingTileUrl(z, x, y, format, style);
        let up;
        try {
          up = await fetch(target, { headers: { Authorization: `Bearer ${env.GFW_FISHING_TOKEN}` } });
        } catch (e) {
          return bad(`upstream unreachable: ${e.message}`, 502, origin);
        }
        if (!up.ok) {
          return new Response(JSON.stringify({
            error: `upstream returned ${up.status}: ${(await up.text()).slice(0, 400)}`,
            sent: { url: target, ramp_source: rampSource },
          }, null, 2), {
            status: up.status,
            headers: { "Content-Type": "application/json", ...cors(origin) },
          });
        }

        const body = await up.arrayBuffer();
        const cacheable = new Response(body, {
          status: 200,
          headers: {
            "Content-Type": format === "PNG" ? "image/png" : "application/x-protobuf",
            "Cache-Control": `public, max-age=${TILE_CACHE_SECONDS}`,
            "X-Ramp-Source": rampSource,
          },
        });
        ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
        return withTileCors(cacheable, origin);
      }
    }

    // Deforestation alert tiles. No key: the upstream route takes no auth
    // dependency, so this proxy exists only for the edge cache and for one
    // consistent origin. If /v1/_gfwtiles shows the upstream sends its own CORS
    // headers, the map could point straight at it and spend no Worker requests
    // at all.
    {
      const m = url.pathname.match(/^\/v1\/gfw_tile\/(\d+)\/(\d+)\/(\d+)$/);
      if (m) {
        const [z, x, y] = m.slice(1).map(Number);
        const span = Math.pow(2, z);
        if (z > FOREST_TILE_MAXZOOM || x < 0 || y < 0 || x >= span || y >= span) {
          return bad(`tile ${z}/${x}/${y} is outside the served range (z0–z${FOREST_TILE_MAXZOOM})`,
                     400, origin);
        }

        const kind = FOREST_ALERT_DATASETS[url.searchParams.get("kind")]
          ? url.searchParams.get("kind") : "integrated";
        const days = Math.min(365, Math.max(1,
          parseInt(url.searchParams.get("days"), 10) || ALERT_WINDOW_DAYS));

        const cacheKey = new Request(
          `${url.origin}/v1/gfw_tile/${z}/${x}/${y}` +
          `?kind=${kind}&days=${days}&_c=${CACHE_VERSION}`);
        const fresh = url.searchParams.get("fresh") === "1";
        const hit = fresh ? null : await cache.match(cacheKey);
        if (hit) return withTileCors(hit, origin);

        const target = alertTileUrl(z, x, y, kind, days);
        let up;
        try {
          up = await fetch(target);
        } catch (e) {
          return bad(`upstream unreachable: ${e.message}`, 502, origin);
        }
        // A failing tile is served as a transparent one rather than as an
        // error. The upstream returns 500 on individual tiles — z6/11/22 among
        // them — and MapLibre turns any non-200 raster response into an
        // AJAXError that surfaces to the reader as a broken map, when what has
        // actually happened is that one tile out of dozens did not render.
        // The status is kept in a header so the failure is still visible to
        // anyone looking, without being visible to everyone else.
        if (!up.ok) {
          const why = (await up.text()).slice(0, 200);
          return withTileCors(new Response(TRANSPARENT_PNG, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=300",
              "X-Upstream-Status": String(up.status),
              "X-Upstream-Note": why.replace(/[^\x20-\x7e]/g, "").slice(0, 120),
            },
          }), origin);
        }

        const body = await up.arrayBuffer();
        const cacheable = new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": `public, max-age=${TILE_CACHE_SECONDS}`,
            "X-Alert-Dataset": FOREST_ALERT_DATASETS[kind],
          },
        });
        ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
        return withTileCors(cacheable, origin);
      }
    }

    const match = url.pathname.match(/^\/v1\/([a-z_]+)$/);
    if (!match) return bad("unknown route", 404, origin);

    const source = UPSTREAM[match[1]];
    if (!source) return bad(`no upstream configured for ${match[1]}`, 404, origin);

    if (source.requires && !env[source.requires]) {
      return bad(
        `${source.requires} is not set on this Worker — run: wrangler secret put ${source.requires}`,
        503, origin
      );
    }

    const bbox = validBbox(url.searchParams.get("bbox"));
    if (!bbox) return bad("bbox missing, malformed, or too large", 400, origin);

    // Some upstreams are far denser than others and need a tighter area.
    if (source.maxAreaDeg2) {
      const [w, s2, e, n] = bbox.split(",").map(Number);
      const area = (e - w) * (n - s2);
      if (area > source.maxAreaDeg2) {
        return bad(
          `area too large for ${match[1]} (${area.toFixed(2)} deg², max ` +
          `${source.maxAreaDeg2}) — zoom in further`,
          400, origin
        );
      }
    }

    // parseInt("abc") is NaN, and Math.min/Math.max propagate NaN rather than
    // clamping it, so a junk z would reach the upstream as zoom=NaN.
    const rawZoom = parseInt(url.searchParams.get("z") ?? "", 10);
    const zoom = Number.isNaN(rawZoom) ? 8 : Math.min(Math.max(rawZoom, 0), 14);

    // Keyed on the query alone, deliberately not on the request: the cached
    // entry must be origin-agnostic so it can be replayed to any allowed
    // origin with that origin's own CORS headers attached below.
    const cacheKey = new Request(
      `${url.origin}${url.pathname}?bbox=${bbox}&z=${zoom}&_c=${CACHE_VERSION}`);
    // ?fresh=1 skips the stored copy. The cache key ignores unknown query
    // parameters by design, so adding junk to the URL does NOT bypass it —
    // which made several deployed fixes look like they had not shipped.
    const fresh = url.searchParams.get("fresh") === "1";
    const hit = fresh ? null : await cache.match(cacheKey);
    if (hit) return withCors(hit, origin);

    let upstream;
    let target;   // hoisted: the error path below reports what was sent
    try {
      if (source.multi) {
        const urls = source.multi(bbox, zoom, env);
        target = urls.join(" + ") || "(no states intersect this viewport)";
        if (!urls.length) {
          return withCors(new Response(
            JSON.stringify({ type: "FeatureCollection", features: [] }),
            { headers: { "Content-Type": "application/json" } }), origin);
        }
        const parts = await Promise.all(urls.map((u) =>
          fetch(u, { headers: { Accept: "application/json", ...source.headers(env) } })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        ));
        const merged = parts.flat();
        upstream = new Response(JSON.stringify(merged),
                                { status: 200, headers: { "Content-Type": "application/json" } });
      } else {
      target = await source.url(bbox, zoom, env);
      upstream = await fetch(target, {
        method: source.method || "GET",
        headers: { Accept: "application/json", ...source.headers(env) },
        ...(source.body ? { body: source.body(bbox, zoom) } : {}),
      });
      }
    } catch (e) {
      return bad(`upstream unreachable: ${e.message}`, 502, origin);
    }

    if (!upstream.ok) {
      // Pass the real status AND the upstream's own explanation through. A bare
      // "401" says the request was rejected but not why — expired key, wrong
      // header, domain restriction and missing secret all look identical, and
      // they need different fixes.
      let detail = "";
      try {
        detail = (await upstream.text()).slice(0, 400);
      } catch (_) {}
      return new Response(JSON.stringify({
        error: `upstream returned ${upstream.status}${detail ? ": " + detail : ""}`,
        sent: {
          url: target,
          method: source.method || "GET",
          body: source.body ? JSON.parse(source.body(bbox, zoom)) : null,
        },
      }, null, 2), {
        status: upstream.status,
        headers: { "Content-Type": "application/json", ...cors(origin) },
      });
    }

    let payload;
    try {
      payload = await upstream.json();
    } catch (e) {
      return bad("upstream returned something that isn't JSON", 502, origin);
    }

    let geo = shape(match[1], payload);
    if (geo && source.postFilter) {
      const [w, s2, e, n] = bbox.split(",").map(Number);
      geo = {
        type: "FeatureCollection",
        features: geo.features.filter((f) => {
          const [lon, lat] = f.geometry.coordinates;
          return lon >= w && lon <= e && lat >= s2 && lat <= n;
        }),
      };
    }
    if (!geo) {
      // Better a loud error than an empty layer: "nothing here" and "I did not
      // understand the response" look identical on a map otherwise.
      return bad(
        `could not read ${match[1]} response — its shape has changed; update shape() in worker/index.js`,
        502, origin
      );
    }

    // Stored without CORS headers; they are added per request on the way out.
    const cacheable = new Response(JSON.stringify(geo), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
      },
    });

    ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
    return withCors(cacheable, origin);
  },
};
