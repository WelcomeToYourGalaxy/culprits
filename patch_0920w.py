#!/usr/bin/env python3
"""
patch_0920w.py - Trase's measures as one row each; the catalogues are read at the start.

  - Each measure Trase publishes is its own row, drawn across every country
    that publishes it at once (86 rows), filed by what it measures. The row
    with three menus is gone from the box.
  - Nusantara's, Global Forest Watch's and Trase's lists are read as soon as
    the layers box is arranged. Their own rows are hidden and were only ever
    built when ticked, so their layers never reached the box.

Needs patch_0920v.py applied and committed first.
Run from the repo folder:  python3 patch_0920w.py
"""
import pathlib, subprocess, sys

DIFF = r"""diff --git a/HANDOFF.md b/HANDOFF.md
index 0262762..358f513 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -242,6 +242,44 @@ as before, so nothing breaks while the tiling catches up.
 
 ---
 
+## The catalogues were never being read
+
+Nusantara's and Global Forest Watch's layers became rows of the box, and their
+own two rows were put out of sight (`PANEL_REMOVED`). But both are `lazy`, and a
+lazy row is built only when it is ticked - so nothing ever asked either source
+for its list, and the several hundred rows never reached the box unless
+**All on** happened to tick the hidden rows as well. `readCataloguesAtStart()`
+now runs at the end of `arrangePanel` and builds every hidden catalogue row
+(`CATALOGUE_ROUTES`: `wmsmenu`, `gfwmenu`, `trase`). Reading a list draws and
+ticks nothing.
+
+## Trase's measures: one row per measure, every country at once
+
+Asked for on 20 September in place of one row with three menus. `traseMeasures`
+turns Trase's catalogue into one entry per measure (86 today) across every
+country that publishes it; each is a row of the box through `catalogueRows`,
+titled "Deforestation (ha) - Argentina, Bolivia, Brazil, ... (Trase)" and filed
+by Trase's own name, group and commodity for it (`fileBy`), not by its tooltip,
+which mentions water and regions in passing and sent rows to the wrong headings.
+"GDP per capita - Colombia" is the one measure no rule claims; it waits under
+Not yet placed.
+
+- A country is drawn at one region level at a time, or the same ground would be
+  coloured twice: municipality where Trase publishes the measure at that level,
+  otherwise the first level Trase lists. This is the default the single row
+  already used. The row's **level** menu overrides it for every country.
+- The **year** menu defaults to the latest year each country has, since they
+  stop in different years (Brazil 2024, Paraguay 2019). Asking for one year
+  leaves out, and names in the row's state, any country with nothing for it.
+- One set of colour steps across every country drawn. A Brazilian municipality
+  and an Argentine department are different sizes, so totals (hectares, tonnes)
+  compare like with unlike across a border; that is Trase's data, not a fault.
+- Two measures Trase gives the same name carry Trase's own id in brackets.
+
+A trial run in node against the real values (stand-in shapes, since
+resources.trase.earth is not reachable from the sandbox): Deforestation drew
+6,698 regions in 8 countries. **Not yet seen on the real map.**
+
 ## The right-hand column: three things that went wrong together
 
 The news wires box is pinned between the bottom of the right column and the
diff --git a/map/app.js b/map/app.js
index d91ad1f..736b6e9 100644
--- a/map/app.js
+++ b/map/app.js
@@ -2888,6 +2888,68 @@ function traseFormat(x) {
   return Math.abs(x) >= 100 ? Math.round(x).toLocaleString() : x.toLocaleString(undefined, { maximumFractionDigits: 2 });
 }
 
+// Every measure Trase publishes, each as one entry across all the countries that
+// publish it. Trase's own map shows one country at a time; here "Deforestation"
+// is one layer drawn over Argentina, Bolivia, Brazil and the rest together.
+// A country is drawn at one region level at a time (its municipalities or its
+// states, never both, or the same ground would be coloured twice): by default
+// the municipality level where Trase publishes the measure there, otherwise
+// the first level Trase lists for it - the same default the single row used.
+function traseMeasures(cat) {
+  const byId = new Map();
+  for (const ck of Object.keys(cat || {}).sort()) {
+    const c = cat[ck];
+    for (const lk of Object.keys(c.levels || {})) {
+      const metrics = c.levels[lk].metrics || {};
+      for (const mk of Object.keys(metrics)) {
+        const m = metrics[mk];
+        let e = byId.get(mk);
+        if (!e) byId.set(mk, e = { metric: mk, said: {}, countries: {} });
+        const nm = m.display_name || mk;
+        e.said[nm] = (e.said[nm] || 0) + 1;
+        const cc = e.countries[ck] = e.countries[ck] || { name: c.name, levels: {} };
+        cc.levels[lk] = { name: c.levels[lk].name, years: (m.years || []).slice(), meta: m };
+      }
+    }
+  }
+  const list = [...byId.values()];
+  for (const e of list) {
+    // Trase words the same measure slightly differently from country to country; the commonest wording is used.
+    e.name = Object.keys(e.said).sort((a, b) => e.said[b] - e.said[a] || a.localeCompare(b))[0];
+    for (const cc of Object.values(e.countries)) cc.own = cc.levels.municipality ? "municipality" : Object.keys(cc.levels)[0];
+    e.meta = Object.values(e.countries)[0].levels[Object.values(e.countries)[0].own].meta;
+  }
+  // Two different measures Trase gives the same name are told apart by Trase's
+  // own id for each, since nothing else Trase publishes says how they differ.
+  const count = {};
+  list.forEach((e) => { count[e.name] = (count[e.name] || 0) + 1; });
+  for (const e of list) {
+    const where = Object.values(e.countries).map((c) => traseCountryName(c.name)).sort().join(", ");
+    const unit = e.meta.unit_abbreviation ? ` (${e.meta.unit_abbreviation})` : "";
+    e.title = `${e.name}${count[e.name] > 1 ? ` [${e.metric}]` : ""}${unit} \u2014 ${where} (Trase)`;
+  }
+  return list.sort((a, b) => a.title.localeCompare(b.title));
+}
+function traseCountryName(n) {
+  return String(n || "").toLowerCase().replace(/-/g, " ").replace(/\b([a-z])/g, (x) => x.toUpperCase()).replace(/\bD Ivoire\b/i, "d'Ivoire");
+}
+// Which level and year each country is drawn at, for what the row's menus say.
+// level "" is each country's own default; year "" the latest each publishes.
+// A country with nothing at the chosen level or year is left out and named.
+function trasePlan(entry, level, year) {
+  const draw = [], left = [];
+  for (const ck of Object.keys(entry.countries).sort()) {
+    const cc = entry.countries[ck];
+    const lk = level || cc.own;
+    const lv = cc.levels[lk];
+    if (!lv) { left.push(`${traseCountryName(cc.name)} (no ${level} level)`); continue; }
+    const yr = year ? (lv.years.includes(Number(year)) ? Number(year) : null) : lv.years[lv.years.length - 1];
+    if (yr == null) { left.push(`${traseCountryName(cc.name)} (nothing for ${year})`); continue; }
+    draw.push({ country: ck, name: traseCountryName(cc.name), level: lk, levelName: lv.name, year: yr, meta: lv.meta });
+  }
+  return { draw, left };
+}
+
 async function addTraseLayer(cfg) {
   let cat, regions;
   try {
@@ -2896,80 +2958,106 @@ async function addTraseLayer(cfg) {
     setLayerState(cfg.id, `not built yet (${e.message})`);
     return;
   }
-  cfg._cat = cat.countries || {};
   cfg._regions = regions;
-  const countries = Object.keys(cfg._cat).sort();
-  const pick = cfg._pick = cfg._pick || {};
-  pick.country = pick.country && cfg._cat[pick.country] ? pick.country : (cfg._cat.brazil ? "brazil" : countries[0]);
-  map.addSource(`${cfg.id}-shapes`, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: cfg.attribution });
-  map.addLayer({ id: `${cfg.id}-fill`, type: "fill", source: `${cfg.id}-shapes`,
-    paint: { "fill-color": ["coalesce", ["get", "_c"], "rgba(0,0,0,0)"], "fill-opacity": 0.72 } });
-  map.addLayer({ id: `${cfg.id}-line`, type: "line", source: `${cfg.id}-shapes`,
-    paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
-  bindHtmlPopup(`${cfg.id}-fill`, (p) => traseBox(cfg, p));
-  traseMenus(cfg);
-  await traseDraw(cfg);
-  applyVisibility(cfg.id);
-  buildLegend();
+  const entries = traseMeasures(cat.countries || {});
+  const drawn = new Map();          // measure id -> the layer ids it drew
+  const safe = (x) => String(x).replace(/[^a-z0-9_]/gi, "_");
+  cfg._layerIds = [];
+  cfg.afterVisibility = (vis) => {
+    for (const ids of drawn.values()) for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
+  };
+  const said = () => setLayerState(cfg.id, drawn.size ? `${drawn.size} of ${entries.length} measures drawn` : `${entries.length} measures, each a row`);
+  const take = (e) => {
+    for (const id of drawn.get(e.metric) || []) if (map.getLayer(id)) map.removeLayer(id);
+    if (map.getSource(`${cfg.id}-${safe(e.metric)}`)) map.removeSource(`${cfg.id}-${safe(e.metric)}`);
+    drawn.delete(e.metric);
+    cfg._layerIds = [].concat(...drawn.values());
+    const menus = document.querySelector(`.facet[data-trase-for="${e.key}"]`);
+    if (menus && menus.remove) menus.remove();
+    said();
+  };
+  const put = async (e) => {
+    showRowFor(cfg.id);
+    const src = `${cfg.id}-${safe(e.metric)}`;
+    if (!map.getSource(src)) {
+      map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: cfg.attribution });
+      map.addLayer({ id: `${src}-fill`, type: "fill", source: src,
+        paint: { "fill-color": ["coalesce", ["get", "_c"], "rgba(0,0,0,0)"], "fill-opacity": 0.72 } });
+      map.addLayer({ id: `${src}-line`, type: "line", source: src,
+        paint: { "line-color": "#1D1B17", "line-width": 0.3, "line-opacity": 0.5 } });
+      bindHtmlPopup(`${src}-fill`, (p) => traseBox(e, p));
+      drawn.set(e.metric, [`${src}-fill`, `${src}-line`]);
+      cfg._layerIds = [].concat(...drawn.values());
+    }
+    e.pick = e.pick || { level: "", year: "" };
+    traseMenus(cfg, e);
+    await traseDraw(cfg, e);
+    cfg.afterVisibility(visibility.get(cfg.id) || "visible");
+    said();
+  };
+  const rows = entries.map((e) => ({
+    name: e.metric, title: e.title,
+    // Filed by what Trase itself calls it: its name, its group and its commodity.
+    fileBy: `${e.name} ${e.meta.metric_group || ""} ${e.meta.commodity || ""} ${e.metric.replace(/_/g, " ")}`,
+    about: `${e.meta.metric_group || ""} ${e.meta.tooltip && e.meta.tooltip !== "." ? e.meta.tooltip : ""}`.trim(),
+    show: (want) => { if (want) put(e).catch((err) => traseSay(e, `could not draw (${err.message})`)); else take(e); },
+  }));
+  catalogueRows(cfg, rows);
+  rows.forEach((r, i) => { entries[i].key = r.key; CATALOGUE_ITEMS.set(r.key, r); });
+  said();
 }
 
-function traseLevelOk(cfg) {
-  const p = cfg._pick, levels = cfg._cat[p.country].levels;
-  if (!levels[p.level]) p.level = levels.municipality ? "municipality" : Object.keys(levels)[0];
-  const metrics = levels[p.level].metrics;
-  if (!metrics[p.metric]) {
-    p.metric = Object.keys(metrics).sort((a, b) => (Number(metrics[a].display_order) || 999) - (Number(metrics[b].display_order) || 999))[0];
-  }
-  const years = metrics[p.metric].years || [];
-  if (!years.includes(p.year)) p.year = years[years.length - 1];
+function traseSay(e, text) {
+  const el = typeof document !== "undefined" && document.querySelector ? document.querySelector(`[data-state="${e.key}"]`) : null;
+  if (el) el.textContent = text;
 }
 
-function traseMenus(cfg) {
+// Under a ticked measure: which region level, which year, and the key.
+function traseMenus(cfg, e) {
   const box = document.getElementById("layers");
-  const row = box && box.querySelector && box.querySelector(`[data-layer="${cfg.id}"]`);
-  const anchor = row && row.closest ? row.closest("label") : null;
+  const tick = box && box.querySelector && box.querySelector(`[data-cat="${e.key}"]`);
+  const anchor = tick && tick.closest ? tick.closest("label") : null;
   if (!anchor || !document.createElement) return;
-  let el = box.querySelector(`.facet[data-trase-for="${cfg.id}"]`);
+  let el = box.querySelector(`.facet[data-trase-for="${e.key}"]`);
   if (!el) {
     el = document.createElement("div");
     el.className = "facet trase-menus";
-    el.dataset.traseFor = cfg.id;
+    el.dataset.traseFor = e.key;
     if (anchor.after) anchor.after(el);
   }
-  traseLevelOk(cfg);
-  const p = cfg._pick, c = cfg._cat[p.country], lv = c.levels[p.level], m = lv.metrics[p.metric];
+  const levels = {}, years = new Set();
+  for (const cc of Object.values(e.countries)) {
+    for (const [lk, lv] of Object.entries(cc.levels)) {
+      levels[lk] = lv.name;
+      if (!e.pick.level || e.pick.level === lk) lv.years.forEach((y) => years.add(y));
+    }
+  }
   const opt = (v, label, on) => `<option value="${escapeHtml(v)}"${on ? " selected" : ""}>${escapeHtml(label)}</option>`;
-  const byOrder = (ms) => Object.keys(ms).sort((a, b) => (Number(ms[a].display_order) || 999) - (Number(ms[b].display_order) || 999));
   el.innerHTML =
-    `<select data-tr="country" aria-label="Country">${Object.keys(cfg._cat).sort().map((k) => opt(k, cfg._cat[k].name, k === p.country)).join("")}</select>` +
-    `<select data-tr="level" aria-label="Region level">${Object.keys(c.levels).map((k) => opt(k, c.levels[k].name, k === p.level)).join("")}</select>` +
-    `<select data-tr="metric" aria-label="Measure">${byOrder(lv.metrics).map((k) => opt(k, (lv.metrics[k].metric_group ? lv.metrics[k].metric_group + ": " : "") + (lv.metrics[k].display_name || k), k === p.metric)).join("")}</select>` +
-    `<select data-tr="year" aria-label="Year">${(m.years || []).map((y) => opt(y, y, y === p.year)).join("")}</select>` +
+    `<select data-tr="level" aria-label="Region level">${opt("", "Each country at its own level", !e.pick.level)}` +
+      Object.keys(levels).sort().map((k) => opt(k, levels[k], k === e.pick.level)).join("") + `</select>` +
+    `<select data-tr="year" aria-label="Year">${opt("", "Latest year each country has", !e.pick.year)}` +
+      [...years].sort((a, b) => b - a).map((y) => opt(y, y, String(y) === String(e.pick.year))).join("") + `</select>` +
     `<div class="sm-legend" data-trase-legend></div>`;
   for (const s of el.querySelectorAll ? el.querySelectorAll("select") : []) {
     s.addEventListener("change", () => {
-      const k = s.dataset.tr;
-      p[k] = k === "year" ? Number(s.value) : s.value;
-      traseMenus(cfg);
-      traseDraw(cfg).catch((e) => setLayerState(cfg.id, `could not draw (${e.message})`));
+      e.pick[s.dataset.tr] = s.value;
+      if (s.dataset.tr === "level") e.pick.year = "";
+      traseMenus(cfg, e);
+      traseDraw(cfg, e).catch((err) => traseSay(e, `could not draw (${err.message})`));
     });
   }
 }
 
-function traseRegionFile(cfg) {
-  const p = cfg._pick, name = cfg._cat[p.country].name;
-  const hits = (cfg._regions || []).filter((r) => traseSlug(r.country) === p.country && r.node_type_slug === p.level);
-  const hit = hits.find((r) => p.year >= Number(r.year_start) && p.year <= Number(r.year_end)) || hits[0];
+function traseRegionFile(cfg, part) {
+  const hits = (cfg._regions || []).filter((r) => traseSlug(r.country) === part.country && r.node_type_slug === part.level);
+  const hit = hits.find((r) => part.year >= Number(r.year_start) && part.year <= Number(r.year_end)) || hits[0];
   return hit ? `${cfg.regions}/${hit.endpoint_geojson}` : null;
 }
 
-async function traseDraw(cfg) {
-  const p = cfg._pick, m = cfg._cat[p.country].levels[p.level].metrics[p.metric];
-  const file = traseRegionFile(cfg);
-  if (!file) { setLayerState(cfg.id, "Trase publishes no shapes for this level"); return; }
-  setLayerState(cfg.id, "loading from Trase\u2026");
-  const [shapes, values] = await Promise.all([traseJson(file), traseJson(`${cfg.values}/${p.country}/${p.level}/${p.metric}.json`)]);
-  const yr = values[String(p.year)] || {};
+// One country's regions with this measure's value on each. Pure, so it is tested.
+function traseJoin(part, shapes, values) {
+  const yr = (values || {})[String(part.year)] || {};
   const ids = new Set(Object.keys(yr));
   // Which field of the shapes holds Trase's region id: the one whose values are keys of the data.
   let idKey = null;
@@ -2977,44 +3065,72 @@ async function traseDraw(cfg) {
     idKey = Object.keys(f.properties || {}).find((k) => ids.has(String(f.properties[k])));
     if (idKey) break;
   }
-  const ramp = TRASE_RAMPS[m.color_scheme] || TRASE_RAMPS.red;
-  const breaks = traseBreaks(Object.values(yr));
-  const colourOf = (v) => {
-    if (typeof v !== "number") return null;
-    let i = 0;
-    while (i < breaks.length && v >= breaks[i]) i++;
-    return ramp[Math.min(i + (ramp.length - 1 - breaks.length), ramp.length - 1)];
-  };
-  let shown = 0;
-  const features = (shapes.features || []).map((f) => {
+  return (shapes.features || []).map((f) => {
     const id = idKey ? String(f.properties[idKey]) : "";
     const v = yr[id];
-    if (v !== undefined) shown++;
     return { type: "Feature", geometry: f.geometry,
-      properties: Object.assign({}, f.properties, { _id: id, _v: v === undefined ? null : v, _c: colourOf(v) }) };
+      properties: Object.assign({}, f.properties, { _id: id, _v: v === undefined ? null : v,
+        _country: part.name, _slug: part.country, _level: part.levelName, _year: part.year }) };
   });
-  map.getSource(`${cfg.id}-shapes`).setData({ type: "FeatureCollection", features });
-  const legend = document.querySelector(`[data-trase-for="${cfg.id}"] [data-trase-legend]`);
+}
+
+async function traseDraw(cfg, e) {
+  const src = map.getSource(`${cfg.id}-${String(e.metric).replace(/[^a-z0-9_]/gi, "_")}`);
+  if (!src) return;
+  const plan = trasePlan(e, e.pick.level, e.pick.year);
+  traseSay(e, "loading from Trase\u2026");
+  const left = plan.left.slice();
+  const got = await Promise.all(plan.draw.map(async (part) => {
+    const file = traseRegionFile(cfg, part);
+    if (!file) { left.push(`${part.name} (Trase publishes no shapes for its ${part.levelName.toLowerCase()} level)`); return []; }
+    try {
+      const [shapes, values] = await Promise.all([traseJson(file), traseJson(`${cfg.values}/${part.country}/${part.level}/${e.metric}.json`)]);
+      return traseJoin(part, shapes, values);
+    } catch (err) {
+      left.push(`${part.name} (${err.message})`);
+      return [];
+    }
+  }));
+  const features = [].concat(...got);
+  // One set of steps across every country drawn, so a colour means the same
+  // amount on both sides of a border.
+  const ramp = TRASE_RAMPS[e.meta.color_scheme] || TRASE_RAMPS.red;
+  const breaks = traseBreaks(features.map((f) => f.properties._v));
+  let shown = 0;
+  for (const f of features) {
+    const v = f.properties._v;
+    if (typeof v !== "number") { f.properties._c = null; continue; }
+    shown++;
+    let i = 0;
+    while (i < breaks.length && v >= breaks[i]) i++;
+    f.properties._c = ramp[Math.min(i + (ramp.length - 1 - breaks.length), ramp.length - 1)];
+  }
+  src.setData({ type: "FeatureCollection", features });
+  const legend = document.querySelector(`[data-trase-for="${e.key}"] [data-trase-legend]`);
   if (legend) {
     const edges = [null, ...breaks];
     legend.innerHTML = edges.map((b, i) => `<span class="sm-key"><i style="background:${ramp[i + (ramp.length - 1 - breaks.length)]}"></i>` +
       `${b === null ? "below " + traseFormat(breaks[0] ?? 0) : "from " + traseFormat(b)}</span>`).join("") +
-      ` <span class="sm-key">${escapeHtml(m.unit_abbreviation || m.unit || "")}</span>`;
+      ` <span class="sm-key">${escapeHtml(e.meta.unit_abbreviation || e.meta.unit || "")}</span>`;
   }
-  setLayerState(cfg.id, `${shown.toLocaleString()} regions \u00b7 ${m.display_name || p.metric}, ${p.year}`);
+  const countries = new Set(features.filter((f) => typeof f.properties._v === "number").map((f) => f.properties._country)).size;
+  traseSay(e, `${shown.toLocaleString()} regions in ${countries} ${countries === 1 ? "country" : "countries"}` +
+    (left.length ? ` \u00b7 not drawn: ${left.join("; ")}` : ""));
 }
 
-function traseBox(cfg, props) {
-  const p = cfg._pick, m = cfg._cat[p.country].levels[p.level].metrics[p.metric];
+function traseBox(e, props) {
+  const cc = e.countries[props._slug];
+  const lv = cc && Object.values(cc.levels).find((l) => l.name === props._level);
+  const m = (lv && lv.meta) || e.meta;
   const name = props.name || props.region || props.NAME || props.nome || props._id;
   const v = props._v;
-  return `<b>${escapeHtml(name)}</b>` +
-    `<div class="meta">${escapeHtml(m.display_name || p.metric)}, ${p.year}: ` +
+  return `<b>${escapeHtml(name)}</b><div class="meta">${escapeHtml(props._country || "")}${props._level ? " \u00b7 " + escapeHtml(props._level) : ""}</div>` +
+    `<div class="meta">${escapeHtml(m.display_name || e.name)}, ${escapeHtml(props._year)}: ` +
     `${v === null || v === undefined || v === "null" ? "no value published" : escapeHtml(traseFormat(Number(v)))} ${escapeHtml(m.unit_abbreviation || "")}</div>` +
     (m.tooltip && m.tooltip !== "." ? `<div class="meta">${escapeHtml(m.tooltip)}</div>` : "") +
     (m.data_source ? `<div class="meta">Source: ${escapeHtml(m.data_source)}</div>` : "") +
     (m.citation ? `<div class="meta">${escapeHtml(m.citation)}</div>` : "") +
-    `<div class="meta"><a href="https://trase.earth/explore/spatial-data/map?country=${encodeURIComponent(p.country)}" target="_blank" rel="noopener">Open on Trase</a></div>`;
+    `<div class="meta"><a href="https://trase.earth/explore/spatial-data/map?country=${encodeURIComponent(props._slug || "")}" target="_blank" rel="noopener">Open on Trase</a></div>`;
 }
 
 /* ---------- outlines from a PMTiles archive (points wider out) ---------- */
@@ -3800,7 +3916,10 @@ const CATALOGUE_PLACES = [
   [/mining|\bmines?\b|quarr/i, "Destruction > Of the planet > Mining"],
   [/plantation|palm|coconut|rubber|sugarcane|sago|\bmills?\b|refiner|soy|cocoa|coffee|crop|agricultur|pasture|livestock|cattle|yield|mapspam/i,
    "Destruction > Of the planet > Meat and agriculture > Agriculture"],
-  [/aquaculture|fisher|fishing/i, "Destruction > Of the planet > Oceans > Fishing"],
+  [/\bbeef\b|cattle|slaughter|\bpigs?\b|chickens?|livestock|pasture/i, "Destruction > Of the planet > Meat and agriculture > Meat"],
+  [/\bcorn\b|maize|cotton/i, "Destruction > Of the planet > Meat and agriculture > Agriculture"],
+  [/pulpwood|\bzdc\b|zero.deforestation/i, "Destruction > Of the planet > Deforestation"],
+  [/aquaculture|fisher|fishing|shrimp/i, "Destruction > Of the planet > Oceans > Fishing"],
   [/concession|\bhgu\b|\bpbph\b|logging|wood fiber|permit|management objective/i,
    "Destruction > Of the planet > Land held under permit"],
   [/carbon|emission|biomass|climate|\bco2\b|flux|removals|temperature|precipitation/i,
@@ -3876,7 +3995,9 @@ function catalogueRows(cfg, items) {
   const spare = sectionBody(box, "Not yet placed") || box;
   items.forEach((item, i) => {
     const key = `${cfg.id}|${i}`;
-    const paths = cataloguePlaces(`${item.title} ${item.name} ${item.about || ""}`);
+    // A row may say what it is to be filed by, where its long description would
+    // mislead: a Trase tooltip that mentions water in passing is not a water layer.
+    const paths = cataloguePlaces(item.fileBy || `${item.title} ${item.name} ${item.about || ""}`);
     paths.forEach((path, n) => {
       const row = document.createElement("label");
       row.className = "layer layer-cat" + (n ? " layer-copy" : "");
@@ -7708,7 +7829,7 @@ const TRASE_DATA = {
   group: true,
   ready: true,
   children: [
-      { id: "trase_measures", name: "Deforestation and supply-chain measures (Trase)", unit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
+      { id: "trase_measures", name: "Deforestation and supply-chain measures (Trase)", unit: "regions", catUnit: "regions", colour: "#8C5548", route: "trase", ready: true, lazy: true,
         catalogue: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/catalogue.json", values: "https://welcometoyourgalaxy.github.io/culprits-tiles-more/trase/values",
         regions: "https://resources.trase.earth/data/trase-regions",
         attribution: "Trase (CC BY 4.0)",
@@ -8660,7 +8781,7 @@ const PANEL_ORDER = [
   { h: 4, t: "Plastics" }, "mymaps_chlorine", "arcgis_ym8xk", "arcgis_materialresearch", "pirg_plastic", "gpw_map", "seas_of_plastic", "coastal_cleanup",
   { h: 3, t: "Fire" },
   { h: 3, t: "Forest and land cover" },
-  { h: 3, t: "Deforestation" }, "soilgrids", "trase_measures", "trase_pulp_indonesia",
+  { h: 3, t: "Deforestation" }, "soilgrids", "trase_pulp_indonesia",
   { h: 4, t: "Wood pulp concessions, Indonesia" },
     "trase_pulp_concessions_2015", "trase_pulp_concessions_2020", "trase_pulp_concessions_2023",
   // No heading carries an organisation's name any more: these are rows about
@@ -8763,6 +8884,9 @@ const PANEL_REMOVED = new Set([
   // rather than deleted: its layers still read their visibility from it, and
   // ticking one of them still turns it on where nobody has to see it.
   "nusantara", "gfw_catalogue",
+  // The same for Trase's measures: each is a row of its own now, one layer
+  // across every country that publishes it, filed by what it measures.
+  "trase_measures",
   // The same upcoming launches and the same pads as the two Launch Library 2
   // rows, but as framed pages rather than on the map.
   "wrf", "nsf_launches",
@@ -9162,6 +9286,7 @@ function arrangePanel() {
   }
   tail.filter((el) => el.classList && el.classList.contains("pending-note")).forEach((el) => box.appendChild(el));
   box.appendChild(gone);
+  readCataloguesAtStart();
   pinBuildings(box);
   addRowTools(box);
   if (!document.getElementById("panel-h-style")) {
@@ -9202,6 +9327,18 @@ function arrangePanel() {
     document.head.appendChild(st);
   }
 }
+// The catalogues' own rows are out of sight (PANEL_REMOVED) and lazy, and a lazy
+// row is only built when it is ticked - so nothing ever asked Nusantara, Global
+// Forest Watch or Trase for their lists, and their hundreds of rows never
+// reached the box unless "All on" happened to tick the hidden rows too. Their
+// lists are read once the box is arranged. Reading a list draws nothing and
+// ticks nothing: a catalogue draws only what is ticked under it.
+const CATALOGUE_ROUTES = new Set(["wmsmenu", "gfwmenu", "trase"]);
+function readCataloguesAtStart() {
+  for (const g of GROUPS) for (const c of g.children) {
+    if (c.ready && CATALOGUE_ROUTES.has(c.route) && PANEL_REMOVED.has(c.id)) ensureLayer(c);
+  }
+}
 map.on("load", () => setTimeout(arrangePanel, 0));
 
 // The layers box runs down to the "Showing" box; the news wires box starts
diff --git a/map/test.mjs b/map/test.mjs
index d7f56c3..5a02dfd 100644
--- a/map/test.mjs
+++ b/map/test.mjs
@@ -1706,7 +1706,45 @@ console.log("\ncoral at every zoom");
 console.log("\nTrase, and coral at world zoom");
 {
   const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
-  check("Trase is one row with its own menus", /id: "trase_measures"[^\n]*route: "trase"/.test(src) && /data-tr="metric"/.test(src) && /data-tr="year"/.test(src));
+  // Superseded on 20 September: one row with three menus (country, level,
+  // measure) became one row per measure, drawn across every country at once.
+  check("Trase's measures are rows of the box, not menus in one row", /id: "trase_measures"[^\n]*route: "trase"/.test(src) &&
+        !/data-tr="metric"/.test(src) && !/data-tr="country"/.test(src) && /data-tr="year"/.test(src) && /data-tr="level"/.test(src));
+  {
+    const pick = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
+    const T = new Function(pick("function traseMeasures(", "async function addTraseLayer(") + pick("function traseJoin(", "async function traseDraw(") +
+      "; return { traseMeasures, trasePlan, traseJoin };")();
+    const m = (name, years) => ({ display_name: name, unit_abbreviation: "ha", years });
+    const cat = {
+      brazil: { name: "BRAZIL", levels: { state: { name: "State", metrics: { DEF: m("Deforestation", [2020, 2022]), SOY: m("Soy area", [2022]) } },
+                                          municipality: { name: "Municipality", metrics: { DEF: m("Deforestation", [2020, 2022]) } } } },
+      paraguay: { name: "PARAGUAY", levels: { department: { name: "Department", metrics: { DEF: m("Deforestation", [2019]), SOY2: m("Soy area", [2019]) } } } },
+    };
+    const list = T.traseMeasures(cat);
+    const def = list.find((e) => e.metric === "DEF");
+    check("\u2026one entry per measure, naming every country that publishes it", list.length === 3 &&
+          def.title === "Deforestation (ha) \u2014 Brazil, Paraguay (Trase)");
+    check("\u2026two measures Trase gives one name are told apart by Trase's own ids",
+          list.filter((e) => /^Soy area \[SOY2?\]/.test(e.title)).length === 2);
+    const own = T.trasePlan(def, "", "");
+    check("\u2026each country is drawn at one level only, and by default at its own latest year",
+          own.draw.length === 2 && own.draw[0].level === "municipality" && own.draw[0].year === 2022 &&
+          own.draw[1].level === "department" && own.draw[1].year === 2019 && own.left.length === 0);
+    const asked = T.trasePlan(def, "", "2020");
+    check("\u2026a country with nothing for the chosen year is left out and named, not drawn from another year",
+          asked.draw.length === 1 && asked.draw[0].country === "brazil" && /Paraguay/.test(asked.left[0]));
+    const soy = T.trasePlan(list.find((e) => e.metric === "SOY"), "", "");
+    check("\u2026a measure Trase publishes only by state is drawn by state", soy.draw[0].level === "state");
+    const joined = T.traseJoin({ name: "Brazil", country: "brazil", levelName: "State", year: 2022 },
+      { features: [{ geometry: null, properties: { code: "BR-1", name: "Acre" } }, { geometry: null, properties: { code: "BR-2", name: "Bahia" } }] },
+      { 2022: { "BR-1": 5 } });
+    check("\u2026values are joined to Trase's shapes by its region id, and a region with none says so",
+          joined[0].properties._v === 5 && joined[1].properties._v === null && joined[0].properties._country === "Brazil");
+    check("\u2026the colours use one set of steps across every country drawn", /traseBreaks\(features\.map\(\(f\) => f\.properties\._v\)\)/.test(src));
+  }
+  check("the catalogues' lists are read once the box is arranged, since their own rows are hidden and never ticked",
+        /const CATALOGUE_ROUTES = new Set\(\["wmsmenu", "gfwmenu", "trase"\]\)/.test(src) &&
+        /box\.appendChild\(gone\);\n  readCataloguesAtStart\(\);/.test(src) && /PANEL_REMOVED\.has\(c\.id\)\) ensureLayer\(c\)/.test(src));
   check("its shapes are read live from Trase", /regions: "https:\/\/resources\.trase\.earth\/data\/trase-regions"/.test(src));
   check("its values come from the weekly GitHub copy", /catalogue: "https:\/\/welcometoyourgalaxy\.github\.io\/culprits-tiles-more\/trase\/catalogue\.json"/.test(src));
   const slug = new Function(src.slice(src.indexOf("function traseSlug("), src.indexOf("// Five steps from the values")) + "; return traseSlug;")();
@@ -2020,7 +2058,7 @@ console.log("\nwhat was still open");
   check("Giga by country, Trase's facilities rows, and two of your own are rows", ["giga_countries", "trase_meat_brazil", "trase_palm_indonesia", "biosignature", "leverage_chart"].every((i) => new RegExp(`id: "${i}"`).test(src)));
   const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
   const order = new Function(body + "; return PANEL_ORDER;")();
-  check("the waiting rows are placed", ["ejatlas", "trase_measures", "gsn", "seas_of_plastic", "coastal_cleanup", "mines_global", "atlas_hotspots", "final_nail", "group:ct_history"].every((i) => order.includes(i)));
+  check("the waiting rows are placed", ["ejatlas", "gsn", "seas_of_plastic", "coastal_cleanup", "mines_global", "atlas_hotspots", "final_nail", "group:ct_history"].every((i) => order.includes(i)));
 }
 
 console.log("\nvessels of concern drawn; the oil-slick archive");
@@ -2106,7 +2144,7 @@ console.log("\nNusantara Atlas and Global Forest Watch, by category");
   // Superseded with Nusantara's: the catalogue's datasets are rows of the box
   // now, filed by what each shows, and several can be drawn at once.
   check("Global Forest Watch's datasets are rows of the box", !/categoryMenu\(menu, /.test(src) &&
-        (src.match(/^  catalogueRows\(cfg, /gm) || []).length === 2);
+        (src.match(/^  catalogueRows\(cfg, /gm) || []).length === 3);   // Nusantara, Global Forest Watch, Trase
   // Superseded: Nusantara's layers are rows of the box itself now, filed by
   // what they show, not a list inside one row.
   check("Nusantara's layers are rows of the box, filed by subject", /catalogueRows\(cfg, items\);/.test(src) && !/menu\.className = "facet ns-list"/.test(src));
@@ -2281,7 +2319,7 @@ console.log("\nrows gathered, moved and renamed");
           .every(([i, n]) => src.includes(`id: "${i}", name: "${n}"`)) &&
         !/name: "Trase: /.test(src) && !/trasefacmenu/.test(src));
   check("each Trase row sits under the map's own heading, not a Trase one",
-        ["trase_measures", "trase_pulp_indonesia"].every((i) => order.indexOf(i) > at("Deforestation")) &&
+        ["trase_pulp_indonesia"].every((i) => order.indexOf(i) > at("Deforestation")) && !order.includes("trase_measures") &&
         ["trase_palm_indonesia", "trase_silos_brazil", "trase_cocoa_ivory"]
           .every((i) => order.indexOf(i) > at("Agriculture") && order.indexOf(i) < at("Meat")) &&
         order.indexOf("trase_meat_brazil") > at("Meat") && order.indexOf("trase_meat_brazil") < at("Oceans") &&
"""


def run(cmd, text=None):
    return subprocess.run(cmd, input=text, text=True, capture_output=True)


def main():
    if not pathlib.Path("map/app.js").exists():
        sys.exit("Run this from the culprits folder (cd ~/Desktop/culprits).")
    app = pathlib.Path("map/app.js").read_text(encoding="utf-8")
    if "function basemapPanelHtml" not in app:
        sys.exit("patch_0920v.py has to be applied and committed first.")
    if run(["git", "apply", "--check", "--reverse", "-"], DIFF).returncode == 0:
        print("Already applied - nothing to do.")
        return
    check = run(["git", "apply", "--check", "-"], DIFF)
    if check.returncode != 0:
        print(check.stderr.strip())
        sys.exit("Does not apply cleanly.")
    out = run(["git", "apply", "-"], DIFF)
    if out.returncode != 0:
        print(out.stderr.strip())
        sys.exit("git apply failed.")
    print("Applied. Changed: map/app.js, map/test.mjs, HANDOFF.md")
    print("Now run both suites:")
    print("    cd map && node test.mjs && node wire.test.mjs")


if __name__ == "__main__":
    main()
