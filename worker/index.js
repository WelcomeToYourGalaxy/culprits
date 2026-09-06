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

function rowsToGeoJSON(rows, source, unit, pick) {
  if (!Array.isArray(rows)) return null;
  const features = [];
  for (const row of rows) {
    const p = pick(row);
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
    return rowsToGeoJSON(rows, "gfw", "alerts", (r) => ({
      id: r.gfw_id ?? r.id,
      name: r.adm2 ?? r.name ?? r.iso ?? "Alert cluster",
      lon: num(r.longitude ?? r.lon ?? r.long),
      lat: num(r.latitude ?? r.lat),
      value: num(r.alert__count ?? r.count ?? r.value),
      licence: "see Global Forest Watch terms",
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
      lon: num(r.pref_longitude ?? r.longitude ?? r.LONGITUDE),
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
    url: (bbox) =>
      `https://data-api.globalforestwatch.org/dataset/gadm__integrated_alerts__adm2/latest/query` +
      `?sql=${encodeURIComponent(`SELECT * FROM data WHERE bbox && '${bbox}' LIMIT 2000`)}`,
    headers: (env) => ({ "x-api-key": env.GFW_API_KEY }),
  },
  fishing: {
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
      const [w, s, e, n] = bbox.split(",");
      return "https://data.epa.gov/efservice/tri_facility" +
        `/latitude/>/${s}/latitude/</${n}` +
        `/longitude/>/${w}/longitude/</${e}` +
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
    const match = url.pathname.match(/^\/v1\/([a-z_]+)$/);
    if (!match) return bad("unknown route", 404, origin);

    const source = UPSTREAM[match[1]];
    if (!source) return bad(`no upstream configured for ${match[1]}`, 404, origin);

    const bbox = validBbox(url.searchParams.get("bbox"));
    if (!bbox) return bad("bbox missing, malformed, or too large", 400, origin);

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
    try {
      upstream = await fetch(source.url(bbox, zoom), {
        headers: { Accept: "application/json", ...source.headers(env) },
      });
    } catch (e) {
      return bad(`upstream unreachable: ${e.message}`, 502, origin);
    }

    if (!upstream.ok) {
      // Pass the real status through. A 401 here means the key expired, and
      // that should be visible rather than silently returning an empty layer.
      return bad(`upstream returned ${upstream.status}`, upstream.status, origin);
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
