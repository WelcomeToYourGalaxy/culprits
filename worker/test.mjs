/**
 * Worker tests.
 *
 * The Worker can't be exercised against the real upstreams from here — they
 * need keys and aren't reachable — but its request handling is the part most
 * likely to be wrong, and that is testable in isolation: bbox validation,
 * origin handling, cache keying, and how upstream failures surface.
 *
 * Run: node worker/test.mjs
 */

import worker from "./index.js";

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

// --- minimal Cloudflare runtime stubs -------------------------------------
const store = new Map();
globalThis.caches = {
  default: {
    async match(req) { return store.get(req.url) || undefined; },
    async put(req, res) { store.set(req.url, res); },
  },
};
const ctx = { waitUntil: (p) => p };
const env = { GFW_API_KEY: "k", GFW_FISHING_TOKEN: "t", LAND_MATRIX_KEY: "l" };

let lastUpstream = null;
let upstreamStatus = 200;
// Default stub returns a payload the shapers can read, so tests about routing
// and caching aren't tripped up by shaping. Shaping has its own section below.
const SHAPEABLE = { data: [{ id: 1, latitude: 1, longitude: 2, alert__count: 3 }] };

// Every gfw query is preceded by a catalogue lookup for the newest version.
// Stubs must answer it or the query never happens.
const CATALOGUE = "/dataset/gfw_integrated_alerts";
const catalogueReply = () => new Response(JSON.stringify({
  data: { versions: ["v20260101", "v20260906", "v20260905", "v20260401"] },
}), { status: 200, headers: { "Content-Type": "application/json" } });
const isCatalogue = (url) => String(url).endsWith(CATALOGUE);

// The newest version is mid-build, exactly as the real API showed it.
const isAssets = (url) => /\/v\d+\/assets$/.test(String(url));
const assetsReply = (url) => {
  const built = !String(url).includes("v20260906");
  return new Response(JSON.stringify({
    data: [
      { asset_type: "Raster tile set", status: "saved" },
      { asset_type: "COG", status: built ? "saved" : "pending" },
    ],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};
globalThis.fetch = async (url, init) => {
  if (isCatalogue(url)) return catalogueReply();
  if (isAssets(url)) return assetsReply(url);
  lastUpstream = { url, init };
  return new Response(JSON.stringify(SHAPEABLE), {
    status: upstreamStatus,
    headers: { "Content-Type": "application/json" },
  });
};
const defaultFetch = globalThis.fetch;

const ORIGIN = "https://welcometoyourgalaxy.github.io";
const call = (path, origin = ORIGIN, method = "GET") =>
  worker.fetch(
    new Request(`https://proxy.example${path}`, { method, headers: { Origin: origin } }),
    env, ctx
  );

console.log("\nworker request handling");

// --- CORS preflight --------------------------------------------------------
{
  const r = await call("/v1/gfw?bbox=0.0,0.0,0.3,0.3", ORIGIN, "OPTIONS");
  check("preflight returns 204", r.status === 204);
  check("preflight sends allow-origin",
        r.headers.get("Access-Control-Allow-Origin") === ORIGIN);
}

// --- bbox validation -------------------------------------------------------
{
  const cases = [
    ["missing bbox", "/v1/gfw", 400],
    ["malformed bbox", "/v1/gfw?bbox=a,b,c,d", 400],
    ["too few values", "/v1/gfw?bbox=0,0,1", 400],
    ["inverted bbox", "/v1/gfw?bbox=10,10,0,0", 400],
    ["out of range lat", "/v1/gfw?bbox=0,-100,1,1", 400],
    ["whole world", "/v1/gfw?bbox=-180,-90,180,90", 400],
    ["valid bbox", "/v1/gfw?bbox=0.0,0.0,0.3,0.3", 200],
  ];
  for (const [name, path, want] of cases) {
    const r = await call(path);
    check(name, r.status === want, `got ${r.status}, wanted ${want}`);
  }
}

// --- routing ---------------------------------------------------------------
{
  check("unknown route 404", (await call("/v1/nope?bbox=0,0,1,1")).status === 404);
  check("bad path 404", (await call("/nope")).status === 404);

  await call("/v1/fishing?bbox=0,0,1,1&z=9");
  check("fishing sends bearer token",
        lastUpstream.init.headers.Authorization === "Bearer t");
  await call("/v1/gfw?bbox=2.0,2.0,2.3,2.3");
  check("gfw sends api key header", lastUpstream.init.headers["x-api-key"] === "k");
}

// --- zoom clamping ---------------------------------------------------------
{
  // Zoom is no longer part of any upstream URL, but it still must never reach
  // one as NaN or as an unclamped value.
  await call("/v1/fishing?bbox=0,0,1,1&z=99");
  check("an absurd zoom produces no malformed upstream URL",
        !/zoom=(NaN|99)/.test(lastUpstream.url), lastUpstream.url);
  await call("/v1/fishing?bbox=0,0,1,1&z=notanumber");
  check("non-numeric zoom falls back", !lastUpstream.url.includes("zoom=NaN"));
}

// --- upstream failures surface, not swallowed ------------------------------
{
  upstreamStatus = 401;
  const r = await call("/v1/gfw?bbox=5.0,5.0,5.3,5.3");
  check("401 passes through", r.status === 401);
  const body = await r.json();
  check("401 explains itself", /401/.test(body.error || ""));
  upstreamStatus = 200;
}

// --- caching ---------------------------------------------------------------
{
  store.clear();
  lastUpstream = null;
  await call("/v1/gfw?bbox=7.0,7.0,7.3,7.3");
  const first = lastUpstream;
  lastUpstream = null;
  await call("/v1/gfw?bbox=7.0,7.0,7.3,7.3");
  check("second identical request served from cache", lastUpstream === null,
        "upstream was called again");

  // Different viewport must not reuse the cached body.
  lastUpstream = null;
  await call("/v1/gfw?bbox=9.0,9.0,9.3,9.3");
  check("different bbox bypasses cache", lastUpstream !== null);
  check("first call did reach upstream", first !== null);
}

// --- the cross-origin cache poisoning case ---------------------------------
{
  store.clear();
  const a = "https://welcometoyourgalaxy.github.io";
  const b = "https://www.welcometoyourgalaxy.com";
  await call("/v1/gfw?bbox=20.0,20.0,20.3,20.3", a);
  const second = await call("/v1/gfw?bbox=20.0,20.0,20.3,20.3", b);
  check("cached response is not returned with the wrong allow-origin",
        second.headers.get("Access-Control-Allow-Origin") === b,
        `got ${second.headers.get("Access-Control-Allow-Origin")}, wanted ${b}`);
}

// --- response shaping ------------------------------------------------------
{
  const shaped = [];
  globalThis.fetch = async (u) => isCatalogue(u) ? catalogueReply() : isAssets(u) ? assetsReply(u) : new Response(JSON.stringify({
    data: [
      { id: 1, latitude: 10, longitude: 20, alert__count: 5, adm2: "Somewhere" },
      { id: 2, latitude: null, longitude: 20, alert__count: 1 },
    ],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  store.clear();
  const r = await call("/v1/gfw?bbox=30.0,30.0,30.3,30.3");
  const g = await r.json();
  check("shapes rows into a FeatureCollection", g.type === "FeatureCollection");
  check("drops rows with no coordinates", g.features.length === 1,
        `got ${g.features?.length}`);
  check("carries the atlas schema",
        g.features[0].properties.unit === "alert intensity",
        g.features[0].properties.unit);
  check("coordinates are [lon,lat]",
        JSON.stringify(g.features[0].geometry.coordinates) === "[20,10]");

  // Already-GeoJSON passes through untouched.
  globalThis.fetch = async (u) => isCatalogue(u) ? catalogueReply() : isAssets(u) ? assetsReply(u) : new Response(JSON.stringify({
    type: "FeatureCollection", features: [{ type: "Feature", geometry: null, properties: {} }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  store.clear();
  const g2 = await (await call("/v1/gfw?bbox=40.0,40.0,40.3,40.3")).json();
  check("passes GeoJSON through", g2.features.length === 1);

  // An unrecognised shape must fail loudly, not return an empty layer.
  globalThis.fetch = async (u) => isCatalogue(u) ? catalogueReply() : isAssets(u) ? assetsReply(u) : new Response(JSON.stringify({ surprise: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
  store.clear();
  const r3 = await call("/v1/gfw?bbox=50.0,50.0,50.3,50.3");
  check("unrecognised shape is a loud 502", r3.status === 502);
  check("error names the fix", /shape\(\)/.test((await r3.json()).error || ""));

  // Non-JSON upstream.
  globalThis.fetch = async (u) => isCatalogue(u) ? catalogueReply() : isAssets(u) ? assetsReply(u) : new Response("<html>nope</html>", { status: 200 });
  store.clear();
  check("non-JSON upstream is 502", (await call("/v1/gfw?bbox=60.0,60.0,60.3,60.3")).status === 502);

  globalThis.fetch = defaultFetch;
}

// --- EPA route needs no credentials ---------------------------------------
{
  store.clear();
  globalThis.fetch = defaultFetch;
  const r = await call("/v1/epa_tri?bbox=-118.4,33.9,-118.1,34.1");
  check("epa_tri route exists", r.status === 200, `got ${r.status}`);
  check("epa_tri sends no auth header",
        !lastUpstream.init.headers.Authorization && !lastUpstream.init.headers["x-api-key"]);
  check("epa_tri scopes the query to a state it can actually filter on",
        /state_abbr\/[A-Z]{2}\//.test(lastUpstream.url), lastUpstream.url);
}

// --- a missing secret must say so, not become "Bearer undefined" ----------
{
  store.clear();
  globalThis.fetch = defaultFetch;
  const r = await worker.fetch(
    new Request("https://proxy.example/v1/fishing?bbox=0,0,1,1", { headers: { Origin: ORIGIN } }),
    { GFW_API_KEY: "k" }, ctx);          // no GFW_FISHING_TOKEN
  check("missing secret returns 503, not a confusing 401", r.status === 503,
        `got ${r.status}`);
  check("missing secret names the command that fixes it",
        /wrangler secret put GFW_FISHING_TOKEN/.test((await r.json()).error));
}

// --- upstream errors carry the upstream's own words -----------------------
{
  store.clear();
  globalThis.fetch = async (u) => isCatalogue(u) ? catalogueReply() : isAssets(u) ? assetsReply(u) : new Response("Invalid API key for domain", { status: 401 });
  const r = await call("/v1/gfw?bbox=70.0,70.0,70.3,70.3");
  const msg = (await r.json()).error;
  check("401 passes through", r.status === 401);
  check("401 includes the upstream's explanation", /Invalid API key/.test(msg), msg);
  globalThis.fetch = defaultFetch;
}

// --- gfw must POST a polygon, not GET a bbox ------------------------------
{
  store.clear();
  globalThis.fetch = async (url, init) => {
    if (isCatalogue(url)) return catalogueReply();
    if (isAssets(url)) return assetsReply(url);
    lastUpstream = { url, init };
    return new Response(JSON.stringify({ data: [
      { longitude: -59.5, latitude: -4.5, gfw_integrated_alerts__date: "2026-08-01",
        gfw_integrated_alerts__confidence: "high", gfw_integrated_alerts__intensity: 55 },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const r = await call("/v1/gfw?bbox=-59.5,-4.5,-59.2,-4.2");
  check("gfw uses POST", lastUpstream.init.method === "POST");
  check("gfw skips the version that is still building",
        !/v20260906/.test(lastUpstream.url), lastUpstream.url);
  check("gfw uses the newest FULLY BUILT version",
        /gfw_integrated_alerts\/v20260905\/query\/json/.test(lastUpstream.url), lastUpstream.url);
  check("gfw never asks for /latest", !/\/latest\//.test(lastUpstream.url));
  const body = JSON.parse(lastUpstream.init.body);
  check("gfw sends a closed polygon",
        body.geometry.type === "Polygon" &&
        body.geometry.coordinates[0].length === 5 &&
        JSON.stringify(body.geometry.coordinates[0][0]) ===
          JSON.stringify(body.geometry.coordinates[0][4]));
  const g = await r.json();
  check("gfw alert rows become features", g.features.length === 1);
  check("gfw alert carries its date",
        /2026-08-01/.test(g.features[0].properties.name), g.features[0].properties.name);
  check("gfw filters to a recent date window, since the API takes no LIMIT",
        /WHERE gfw_integrated_alerts__date >= '\d{4}-\d{2}-\d{2}'/.test(body.sql), body.sql);
  check("gfw sends no LIMIT clause", !/LIMIT/i.test(body.sql), body.sql);

  const tooBig = await call("/v1/gfw?bbox=-60,-5,-58.5,-3.5");
  check("an area too dense for gfw is refused with advice", tooBig.status === 400);
  check("that refusal says to zoom in",
        /zoom in further/.test((await tooBig.json()).error));
  globalThis.fetch = defaultFetch;
}

// --- EPA longitude is stored unsigned ------------------------------------
{
  store.clear();
  globalThis.fetch = async (u) => {
    if (isCatalogue(u)) return catalogueReply();
    lastUpstream = { url: u };
    return new Response(JSON.stringify([
      { tri_facility_id: "X1", facility_name: "SOMEWHERE PR",
        latitude: 18.48, longitude: 67.185 },     // note: positive
    ]), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const g = await (await call("/v1/epa_tri?bbox=-67.3,18.4,-67.1,18.5")).json();
  check("positive longitude is flipped west",
        g.features[0].geometry.coordinates[0] === -67.185,
        JSON.stringify(g.features[0].geometry.coordinates));
  check("the query is scoped to the right state",
        /state_abbr\/PR\//.test(lastUpstream.url), lastUpstream.url);
  check("the bbox is applied after the response, not by Envirofacts",
        g.features.length === 1, `${g.features.length} features`);
  globalThis.fetch = defaultFetch;
}

// --- Envirofacts ignores range filters, so the bbox is applied here -------
{
  store.clear();
  globalThis.fetch = async (u) => {
    if (isCatalogue(u)) return catalogueReply();
    if (isAssets(u)) return assetsReply(u);
    lastUpstream = { url: u };
    return new Response(JSON.stringify([
      { tri_facility_id: "IN", facility_name: "INSIDE",
        latitude: 34.0, longitude: 118.2 },        // inside the bbox
      { tri_facility_id: "OUT", facility_name: "OUTSIDE",
        latitude: 40.0, longitude: 120.0 },        // same state query, wrong place
    ]), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const g = await (await call("/v1/epa_tri?bbox=-118.4,33.9,-118.1,34.1")).json();
  check("out-of-bbox rows are dropped by the Worker",
        g.features.length === 1 && g.features[0].properties.name === "INSIDE",
        JSON.stringify(g.features.map((f) => f.properties.name)));
  check("California is the state queried, not the first in the table",
        /state_abbr\/CA\//.test(lastUpstream.url), lastUpstream.url);
  globalThis.fetch = defaultFetch;
}

// --- the browser must not cache; the edge still should --------------------
{
  store.clear();
  globalThis.fetch = defaultFetch;
  const r = await call("/v1/gfw?bbox=1,1,1.3,1.3");
  check("responses are sent with no-store",
        r.headers.get("Cache-Control") === "no-store",
        r.headers.get("Cache-Control"));

  lastUpstream = null;
  await call("/v1/gfw?bbox=1,1,1.3,1.3");
  check("the edge cache still works despite no-store",
        lastUpstream === null, "upstream was called again");
}

// --- a viewport spanning a state line queries both states -----------------
{
  store.clear();
  const asked = [];
  globalThis.fetch = async (u) => {
    if (isCatalogue(u)) return catalogueReply();
    if (isAssets(u)) return assetsReply(u);
    asked.push(String(u));
    const st = String(u).match(/state_abbr\/([A-Z]{2})/)?.[1];
    return new Response(JSON.stringify([
      { tri_facility_id: st, facility_name: `PLANT IN ${st}`,
        latitude: 39.0, longitude: 75.0, state_abbr: st,
        parent_co_name: "SOME PARENT", city_name: "TOWN",
        epa_registry_id: "110000000001" },
    ]), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  // A box on the Delaware / New Jersey / Maryland margin.
  const g = await (await call("/v1/epa_tri?bbox=-75.4,38.8,-74.9,39.2")).json();
  const states = asked.map((u) => u.match(/state_abbr\/([A-Z]{2})/)?.[1]).filter(Boolean);
  check("more than one state is queried", new Set(states).size > 1,
        JSON.stringify(states));
  check("results from every state are merged", g.features.length > 1,
        `${g.features.length} features`);
  check("popups carry the parent company",
        g.features[0].properties.x_parent === "SOME PARENT");
  check("popups link to EPA's own facility report",
        /echo\.epa\.gov/.test(g.features[0].properties.url || ""),
        g.features[0].properties.url);
  globalThis.fetch = defaultFetch;
}

// --- fishing: POST, geojson body, unencoded datasets bracket --------------
{
  store.clear();
  globalThis.fetch = async (u, init) => {
    if (isCatalogue(u)) return catalogueReply();
    if (isAssets(u)) return assetsReply(u);
    lastUpstream = { url: String(u), init };
    return new Response(JSON.stringify({ entries: [
      { lat: 50.5, lon: -9.5, hours: 12.5, flag: "ESP" },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const r = await call("/v1/fishing?bbox=-10,50,-9,51");
  check("fishing uses POST", lastUpstream.init.method === "POST",
        lastUpstream.init.method);
  check("datasets bracket is NOT percent-encoded",
        /datasets\[0\]=public-global-fishing-effort:latest/.test(lastUpstream.url),
        lastUpstream.url);
  const body = JSON.parse(lastUpstream.init.body);
  check("area travels as a geojson polygon in the body",
        body.geojson && body.geojson.type === "Polygon");
  check("a date range is supplied", /date-range=\d{4}-\d{2}-\d{2},/.test(lastUpstream.url));
  globalThis.fetch = defaultFetch;
}

// --- fishing tiles: the route that replaced /report ------------------------
//
// /report is capped at one concurrent report per GFW ACCOUNT, so it could never
// serve a page with two readers. These cover the tile route that took over.
{
  const BINS = { entries: [[0, 1, 2, 3, 4, 5, 6, 7, 8]] };
  const isBins = (u) => String(u).includes("/4wings/bins/");
  const tileStub = (binsOk = true) => async (u, init) => {
    lastUpstream = { url: String(u), init };
    if (isBins(u)) {
      return binsOk
        ? new Response(JSON.stringify(BINS), { status: 200 })
        : new Response("nope", { status: 500 });
    }
    return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  };

  store.clear();
  globalThis.fetch = tileStub();
  const r = await call("/v1/fishing_tile/3/4/3");
  check("tile route returns 200", r.status === 200, `got ${r.status}`);
  check("tile route serves image bytes", r.headers.get("Content-Type") === "image/png",
        r.headers.get("Content-Type"));
  check("tile route sends the bearer token",
        lastUpstream.init.headers.Authorization === "Bearer t");
  check("tile route calls tile/heatmap, not /report",
        /\/4wings\/tile\/heatmap\/3\/4\/3/.test(lastUpstream.url) &&
        !/\/report/.test(lastUpstream.url), lastUpstream.url);
  check("tile route is a GET",
        !lastUpstream.init.method || lastUpstream.init.method === "GET");
  check("datasets bracket stays unencoded on tiles",
        /datasets\[0\]=public-global-fishing-effort%3Alatest/.test(lastUpstream.url),
        lastUpstream.url);
  check("PNG tiles carry a style", /[?&]style=/.test(lastUpstream.url), lastUpstream.url);
  check("tiles aggregate time into one frame",
        /temporal-aggregation=true/.test(lastUpstream.url), lastUpstream.url);

  // The style is base64 of {"color":[r,g,b],"ramp":[...]} — decodable, not an
  // opaque id, which is why no round trip to /generate-png is needed.
  const styled = decodeURIComponent(lastUpstream.url.match(/[?&]style=([^&]+)/)[1]);
  const decoded = JSON.parse(Buffer.from(styled, "base64").toString("utf8"));
  check("style decodes to colour and ramp",
        Array.isArray(decoded.color) && decoded.ramp.length === 9,
        JSON.stringify(decoded));
  check("style uses the ramp /bins returned",
        decoded.ramp[8] === 8, JSON.stringify(decoded.ramp));
  check("style carries no orange or yellow",
        decoded.color[2] >= decoded.color[0], JSON.stringify(decoded.color));

  // Unlike the bbox routes, tiles MUST stay cacheable in the browser: every
  // miss costs one request against both free-plan allowances.
  check("tiles are browser-cacheable", /max-age/.test(r.headers.get("Cache-Control") || ""),
        r.headers.get("Cache-Control"));

  lastUpstream = null;
  await call("/v1/fishing_tile/3/4/3");
  check("a repeated tile is served from the edge cache", lastUpstream === null,
        "upstream was called again");

  const mvt = await call("/v1/fishing_tile/3/4/3?format=MVT");
  check("MVT tiles are passed through as protobuf",
        mvt.headers.get("Content-Type") === "application/x-protobuf",
        mvt.headers.get("Content-Type"));
  check("MVT tiles carry no PNG style", !/[?&]style=/.test(lastUpstream.url),
        lastUpstream.url);

  // Out-of-range coordinates must be refused here rather than spending a GFW
  // request to be told the same thing.
  check("z beyond 12 is refused", (await call("/v1/fishing_tile/13/0/0")).status === 400);
  check("x outside the zoom's grid is refused",
        (await call("/v1/fishing_tile/1/9/0")).status === 400);

  // A ramp failure must cost the thresholds, not the layer.
  store.clear();
  globalThis.fetch = tileStub(false);
  const fb = await call("/v1/fishing_tile/5/1/1");
  check("a /bins failure still returns a tile", fb.status === 200, `got ${fb.status}`);
  check("the fallback ramp is reported, not hidden",
        /fallback/.test(fb.headers.get("X-Ramp-Source") || ""),
        fb.headers.get("X-Ramp-Source"));

  // A missing secret must say so rather than becoming "Bearer undefined".
  const noSecret = await worker.fetch(
    new Request("https://proxy.example/v1/fishing_tile/3/4/3", { headers: { Origin: ORIGIN } }),
    { GFW_API_KEY: "k" }, ctx);
  check("a tile with no token returns 503", noSecret.status === 503, `got ${noSecret.status}`);

  globalThis.fetch = defaultFetch;
}

// --- the MVT probe reports real names, so the vector option isn't a guess ---
{
  const varint = (n) => {
    const out = [];
    do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n);
    return out;
  };
  const tg = (f, w) => varint((f << 3) | w);
  const str = (f, s) => {
    const b = [...Buffer.from(s, "utf8")];
    return [...tg(f, 2), ...varint(b.length), ...b];
  };
  const msg = (f, body) => [...tg(f, 2), ...varint(body.length), ...body];
  const feature = msg(2, [...tg(1, 0), ...varint(1), ...tg(3, 0), ...varint(1)]);
  const tile = Uint8Array.from(msg(3, [
    ...tg(15, 0), ...varint(2),
    ...str(1, "main"),
    ...feature, ...feature,
    ...str(3, "count"),
    ...tg(5, 0), ...varint(4096),
  ]));

  store.clear();
  globalThis.fetch = async () => new Response(tile, { status: 200 });
  const g = await (await call("/v1/_fishing_mvt/3/4/3")).json();
  check("the probe decodes the tile", g.decode_error === null, g.decode_error);
  check("the probe names the source-layer", g.layers[0].name === "main",
        JSON.stringify(g.layers));
  check("the probe lists the property keys",
        JSON.stringify(g.layers[0].keys) === '["count"]', JSON.stringify(g.layers[0].keys));
  check("the probe counts features", g.layers[0].features === 2, g.layers[0].features);
  globalThis.fetch = defaultFetch;
}

// --- the report route is untouched and still works -------------------------
{
  store.clear();
  globalThis.fetch = async (u, init) => {
    if (isCatalogue(u)) return catalogueReply();
    if (isAssets(u)) return assetsReply(u);
    lastUpstream = { url: String(u), init };
    return new Response(JSON.stringify({ entries: [{ lat: 1, lon: 2, hours: 3 }] }),
                        { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const r = await call("/v1/fishing?bbox=-10,50,-9,51");
  check("the /report route still answers", r.status === 200);
  check("the /report route still POSTs", lastUpstream.init.method === "POST");
  globalThis.fetch = defaultFetch;
}

// --- deforestation alerts: tile route, no key ------------------------------
//
// The route pattern is read from wri/gfw-tile-cache source, not documentation.
// These pin the parts that would silently break if it drifted.
{
  store.clear();
  globalThis.fetch = async (u, init) => {
    lastUpstream = { url: String(u), init };
    return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  };

  const r = await call("/v1/gfw_tile/3/4/3");
  check("alerts tile route returns 200", r.status === 200, `got ${r.status}`);
  check("alerts tiles are PNG", r.headers.get("Content-Type") === "image/png",
        r.headers.get("Content-Type"));
  check("alerts use the tile cache, not the Data API query endpoint",
        /tiles\.globalforestwatch\.org/.test(lastUpstream.url) &&
        !/query\/json/.test(lastUpstream.url), lastUpstream.url);
  check("alerts hit the documented dynamic route",
        /\/gfw_integrated_alerts\/latest\/dynamic\/3\/4\/3\.png/.test(lastUpstream.url),
        lastUpstream.url);
  check("alerts render as colour, not GFW's encoded bit-packing",
        /render_type=true_color/.test(lastUpstream.url), lastUpstream.url);
  // No editorial filtering: "low" means at least low, i.e. everything published.
  check("every confidence level is requested",
        /alert_confidence=low/.test(lastUpstream.url), lastUpstream.url);
  check("a date window is sent", /start_date=\d{4}-\d{2}-\d{2}/.test(lastUpstream.url) &&
        /end_date=\d{4}-\d{2}-\d{2}/.test(lastUpstream.url), lastUpstream.url);
  // The upstream route takes no auth dependency; sending a key would be noise.
  check("no API key is sent to the tile cache",
        !/x-api-key/i.test(JSON.stringify(lastUpstream.init || {})),
        JSON.stringify(lastUpstream.init));
  check("alerts tiles are browser-cacheable",
        /max-age/.test(r.headers.get("Cache-Control") || ""),
        r.headers.get("Cache-Control"));

  lastUpstream = null;
  await call("/v1/gfw_tile/3/4/3");
  check("a repeated alerts tile comes from the edge cache", lastUpstream === null,
        "upstream was called again");

  check("alerts z beyond 22 is refused",
        (await call("/v1/gfw_tile/23/0/0")).status === 400);

  globalThis.fetch = defaultFetch;
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
