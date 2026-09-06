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
    // EPA Envirofacts is public and needs no key, but it does not send CORS
    // headers, so the browser still cannot call it directly. It is routed
    // through here for that reason alone.
    //
    // Envirofacts chains column filters as path segments. This pattern is
    // INFERRED and untested — if it is wrong the request returns a 502 naming
    // shape(), not an empty layer.
    url: (bbox) => {
      const [w, s, e, n] = bbox.split(",").map(Number);
      // Envirofacts stores TRI longitude UNSIGNED — positive west. Facilities
      // in Puerto Rico come back as +67.185, not -67.185. So the filter is
      // built from absolute values, and the shaper puts the sign back.
      const lo = Math.min(Math.abs(w), Math.abs(e));
      const hi = Math.max(Math.abs(w), Math.abs(e));
      return "https://data.epa.gov/efservice/tri_facility" +
        `/latitude/>/${s}/latitude/</${n}` +
        `/longitude/>/${lo}/longitude/</${hi}` +
        "/rows/0:500/JSON";
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
    const cacheKey = new Request(`${url.origin}${url.pathname}?bbox=${bbox}&z=${zoom}`);
    const hit = await cache.match(cacheKey);
    if (hit) return withCors(hit, origin);

    let upstream;
    let target;   // hoisted: the error path below reports what was sent
    try {
      target = await source.url(bbox, zoom, env);
      upstream = await fetch(target, {
        method: source.method || "GET",
        headers: { Accept: "application/json", ...source.headers(env) },
        ...(source.body ? { body: source.body(bbox, zoom) } : {}),
      });
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

    const geo = shape(match[1], payload);
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
