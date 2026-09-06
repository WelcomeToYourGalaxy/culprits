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
const CACHE_VERSION = "v5";

// Reported by /v1/_diag so it is possible to tell, in one request, which build
// is actually live. Several fixes appeared not to work when the real problem
// was that the deploy had not happened.
const BUILD = "2026-09-06T05:10 epa-multistate+detail, fishing-datasets";

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
    url: (bbox, z) =>
      `https://gateway.api.globalfishingwatch.org/v3/4wings/report` +
      `?spatial-resolution=LOW&temporal-resolution=YEARLY&format=JSON&bbox=${bbox}&zoom=${z}`,
    headers: (env) => ({ Authorization: `Bearer ${env.GFW_FISHING_TOKEN}` }),
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
        epa_query_for_los_angeles: UPSTREAM.epa_tri.url("-118.4,33.9,-118.1,34.1"),
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

    const cache = caches.default;
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
