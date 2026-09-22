/**
 * Asks each source that does not draw, or draws too slowly, what it answers
 * today, the way the map asks it from its own page. Changes nothing.
 *
 * For each: the status, how long it took, how much came back, and whether the
 * source lets the map's page read it (the CORS header). Then, for the Global
 * Forest Watch pictures that draw as grey, what their records and tile service
 * say about their pixel values. Then the files in the wastewater model's data
 * package.
 *
 * Run: node map/check-sources.mjs
 * Paste everything it prints back into the chat.
 */
const ORIGIN = "https://welcometoyourgalaxy.github.io";
const GFW = "https://data-api.globalforestwatch.org";
const COG = "https://tiles.globalforestwatch.org/cog/basic";

async function ask(label, url, opts = {}) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.ms || 60000);
  try {
    const r = await fetch(url, { method: opts.method || "GET", headers: { Origin: ORIGIN }, signal: ctrl.signal });
    const body = opts.method === "HEAD" ? "" : await r.text();
    const cors = r.headers.get("access-control-allow-origin");
    console.log(`${label}\n    ${r.status} in ${Date.now() - t0} ms, ${body.length.toLocaleString()} characters, ` +
      `type ${r.headers.get("content-type") || "-"}, readable by the map: ${cors ? `yes (${cors})` : "NO (no CORS header)"}`);
    if (opts.show) console.log("    " + body.slice(0, opts.show).replace(/\s+/g, " "));
    return { r, body };
  } catch (e) {
    console.log(`${label}\n    FAILED after ${Date.now() - t0} ms: ${ctrl.signal.aborted ? "no answer in time" : e.message}`);
    return null;
  } finally { clearTimeout(timer); }
}
const json = (x) => { try { return JSON.parse(x.body); } catch (e) { return null; } };

console.log("\n=== Rows that do not draw ===\n");
const bbox = "-6000000,-4000000,-4000000,-2000000";   // part of South America, in map metres
for (const crop of ["Soybean", "Corn"]) {
  const svc = `https://gis.ipad.fas.usda.gov/arcgis/rest/services/CommodityExplorer${crop}/MapServer`;
  await ask(`(22/23) USDA ${crop} explorer: the service`, `${svc}?f=json`, { show: 200 });
  await ask(`(22/23) USDA ${crop} explorer: one picture`, `${svc}/export?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`);
}
const man = await ask("(24) Trase facilities list (our copy)", `${ORIGIN}/culprits-tiles-more/trase/facilities.json`);
let silos = "silos_consolidated_capacity_website_brazil_2024_2_post.geo.json", base = "https://resources.trase.earth/data/facilities-data/";
const m = man && json(man);
if (m) { const hit = (m.types || []).find((t) => t.id === "brazil-silos"); if (hit && hit.file) { silos = hit.file; base = m.base || base; } }
await ask(`(24) Trase soy silos file: ${silos}`, base + silos, { ms: 120000 });
await ask("(29) EJAtlas, first page of 500", "https://ejatlas.org/api/v1/conflicts/?limit=500&offset=0", { ms: 120000 });
const um = await ask("(30) Wreckers of the Earth, the uMap map", "https://umap.openstreetmap.fr/en/map/409815/geojson/", { show: 300 });
const umj = um && json(um);
const layers = umj && ((umj.properties && umj.properties.datalayers) || []);
for (const l of (layers || []).slice(0, 5)) {
  const id = l.id || (l.properties && l.properties.id);
  await ask(`(30) Wreckers of the Earth, layer ${id}`, `https://umap.openstreetmap.fr/en/datalayer/409815/${id}/`);
}
await ask("(42) Materials research, the ArcGIS item", "https://www.arcgis.com/sharing/rest/content/items/3ff82579637f4c7a96bd62d039ac3e00?f=json", { show: 400 });
await ask("(42) Materials research, the item's data", "https://www.arcgis.com/sharing/rest/content/items/3ff82579637f4c7a96bd62d039ac3e00/data?f=json", { show: 600 });
for (const f of ["AllStations", "AllTrips", "Oceans"]) {
  await ask(`(43) Seas of Plastic, ${f}`, `https://app.dumpark.com/seas-of-plastic-2/app/data/${f}.geojson`, { show: 120 });
}
for (const f of ["wastewater_N_effluent", "wastewater_N_plumes"]) {
  await ask(`(26) Wastewater archive on our site: ${f}`, `${ORIGIN}/culprits-tiles-more/tiles/${f}.pmtiles`, { method: "HEAD" });
}
const nus = "https://map.nusantara-atlas.org/geoserver/atlas-workspace-v3/wms";
for (const layer of ["v3p3_alertfire_modis", "v3p3_alertfire_viirs", "v3p3_alertfire_combine"]) {
  await ask(`(14) Nusantara fire alerts, one picture: ${layer}`,
    `${nus}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&STYLES=&SRS=EPSG:3857&BBOX=10018754,-1252344,12523443,1252344&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`);
}

console.log("\n=== Global Forest Watch pictures: what their pixels mean ===\n");
const GFW_IDS = ["tsc_tree_cover_loss_drivers", "wri_google_tree_cover_loss_drivers", "tsc_drivers", "umd_drivers",
  "wur_integration_alert_drivers_class", "umd_glad_dist_alerts", "umd_modis_burned_areas", "gfw_mining_concessions"];
for (const id of GFW_IDS) {
  const d = await ask(`${id}: its record`, `${GFW}/dataset/${id}`);
  const dj = d && json(d);
  const meta = (dj && dj.data && dj.data.metadata) || {};
  const versions = (dj && dj.data && dj.data.versions) || [];
  for (const k of ["title", "resolution", "content_date", "cautions", "key_restrictions", "legend", "scale"]) if (meta[k]) console.log(`    ${k}: ${String(meta[k]).replace(/\s+/g, " ").slice(0, 500)}`);
  const v = versions.slice().sort().pop();
  if (!v) continue;
  const a = await ask(`${id}: assets of ${v}`, `${GFW}/dataset/${id}/${v}/assets`);
  for (const as of ((a && json(a)) || {}).data || []) {
    console.log(`    ${as.asset_type} | ${as.status} | ${as.asset_uri}`);
    if (/^COG$/i.test(as.asset_type) && /^s3:/.test(as.asset_uri || "")) {
      const u = encodeURIComponent(as.asset_uri);
      await ask(`${id}: the tile service's reading of the COG`, `${COG}/info?url=${u}`, { show: 900 });
      await ask(`${id}: its pixel values`, `${COG}/statistics?url=${u}&categorical=true&max_size=512`, { show: 1500 });
    }
    if (/raster tile cache/i.test(as.asset_type)) {
      await ask(`${id}: raster tile cache record`, `${GFW}/asset/${as.asset_id}`, { show: 1200 });
    }
  }
}

console.log("\n=== The wastewater model's data package (KNB) ===\n");
const eml = await ask("Tuholske et al. 2021 package metadata", "https://knb.ecoinformatics.org/knb/d1/mn/v2/object/doi%3A10.5063%2FF76B09", { ms: 90000 });
if (eml && eml.body) {
  const names = [...eml.body.matchAll(/<entityName>([^<]+)<\/entityName>/g)].map((x) => x[1]);
  const urls = [...eml.body.matchAll(/<url[^>]*>([^<]+)<\/url>/g)].map((x) => x[1]);
  const sizes = [...eml.body.matchAll(/<size[^>]*>([^<]+)<\/size>/g)].map((x) => x[1]);
  names.forEach((n, i) => console.log(`    ${n} | ${sizes[i] || "?"} bytes | ${urls[i] || ""}`));
  if (!names.length) console.log("    " + eml.body.slice(0, 800).replace(/\s+/g, " "));
}
console.log("\nDone.");
