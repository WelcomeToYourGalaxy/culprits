#!/usr/bin/env python3
"""
1. The Social Spheres, the rest of its own controls, under its row:
   - a chip for each kind of body (association, institute, club, school, bank,
     firm, order) in the map's own colours and names, to show only those;
   - "Find a person": type a name from its 969 and its own person card opens;
   - "Sector": pick a sector and its own sector card opens.
2. Live Projects to Resist, whole: a row that opens the Live Global Project Map
   itself in a panel along the bottom of the screen, following this map's view
   (like the Guerillamap panel), with everything it has: its country guides and
   how-to PDFs, its lenses and trackers, the drill-down into regions, its own
   project cards, overlays and history. Its project points stay a row of their
   own, as before.
3. The Global Wastewater Model now draws from its GitHub copy
   (culprits-tiles-more, built once by scripts/wastewater.py), since its own
   server does not let other sites draw its pictures.

Run from the repo root:  python3 patch_turn2.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "function spheresControls(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"

# --- 1. Social Spheres ------------------------------------------------------------------
once("""  wrap.hidden = false;
  wrap._pending = id;
  spheresOpen(id);
}
function spheresOpen(id) {
  const w = spheresFrame && spheresFrame.contentWindow;
  if (!id || !w || !w.document || w.document.readyState !== "complete") return;
  try { w.eval(`openNode(${JSON.stringify(id)})`); } catch (e) { console.warn("[culprits] social spheres card:", e.message); }
}""", """  wrap.hidden = false;
  wrap._pending = id;
  spheresOpen(id);
}
// What to open: a body's id, or { fn: "openPerson" | "openSector", arg } - the map's own functions.
function spheresOpen(what) {
  const w = spheresFrame && spheresFrame.contentWindow;
  if (!what || !w || !w.document || w.document.readyState !== "complete") return;
  const fn = typeof what === "string" ? "openNode" : what.fn;
  if (!["openNode", "openPerson", "openSector"].includes(fn)) return;
  const arg = typeof what === "string" ? what : what.arg;
  try { w.eval(`${fn}(${JSON.stringify(arg)})`); } catch (e) { console.warn("[culprits] social spheres card:", e.message); }
}
function spheresLabels(html) {
  const m = /const KINDLABEL=\\{([^;]*)\\};/.exec(html || "");
  const out = {};
  if (m) for (const [, k, v] of m[1].matchAll(/(\\w+):"([^"]*)"/g)) out[k] = v;
  return out;
}
function spheresControls(cfg, html, D, kinds) {
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (!anchor || !anchor.after || !document.createElement) return;
  const labels = spheresLabels(html);
  const used = [...new Set(D.nodes.map((n) => n.kind))];
  const picked = new Set();
  const el = document.createElement("div");
  el.className = "facet";
  const people = (D.people || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const sectors = (D.sectors || []).map((s) => s.name).sort();
  el.innerHTML = `<span class="chip reset" data-sk="">All kinds</span>` + used.map((k) =>
      `<button type="button" class="chip" data-sk="${escapeHtml(k)}"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;` +
      `background:${kinds[k] || cfg.colour};margin-right:4px"></i>${escapeHtml(labels[k] || k)}</button>`).join("") +
    `<input list="${cfg.id}-people" placeholder="Find a person" aria-label="Find a person" style="flex:1 1 100%;margin-top:4px;font:inherit;` +
      `color:var(--bone);background:var(--peat,#17150F);border:1px solid var(--rule);border-radius:2px;padding:2px 5px">` +
    `<datalist id="${cfg.id}-people">${people.map((p) => `<option value="${escapeHtml(p.name)}"></option>`).join("")}</datalist>` +
    (sectors.length ? `<select aria-label="Sector" style="flex:1 1 100%;margin-top:4px"><option value="">Sector\\u2026</option>` +
      sectors.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("") + `</select>` : "");
  el.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-sk]");
    if (!b) return;
    e.stopPropagation();
    const k = b.dataset.sk;
    if (!k) picked.clear(); else if (picked.has(k)) picked.delete(k); else picked.add(k);
    for (const c of el.querySelectorAll("[data-sk]")) c.classList.toggle("on", c.dataset.sk ? picked.has(c.dataset.sk) : picked.size === 0);
    map.setFilter(`${cfg.id}-pt`, picked.size ? ["in", ["get", "kind"], ["literal", [...picked]]] : null);
  });
  const find = el.querySelector("input");
  find.addEventListener("change", () => {
    const p = people.find((x) => x.name === find.value);
    if (p) spheresCard(cfg, html, { fn: "openPerson", arg: p.id });
  });
  const sec = el.querySelector("select");
  if (sec) sec.addEventListener("change", () => { if (sec.value) spheresCard(cfg, html, { fn: "openSector", arg: sec.value }); });
  anchor.after(el);
}""")
once("""    properties: { id: n.id, name: n.name, c: kinds[n.kind] || cfg.colour, linked: n.linked ? 1 : 0 } }));""",
     """    properties: { id: n.id, name: n.name, kind: n.kind, c: kinds[n.kind] || cfg.colour, linked: n.linked ? 1 : 0 } }));""")
once("""  setLayerState(cfg.id, `${D.nodes.length} bodies, ${(D.people || []).length.toLocaleString()} people, ${lines.length} links`);""",
     """  spheresControls(cfg, html, D, kinds);
  setLayerState(cfg.id, `${D.nodes.length} bodies, ${(D.people || []).length.toLocaleString()} people, ${lines.length} links`);""")

# --- 2. Live Projects to Resist, whole -------------------------------------------------------
once('''    { id: "wreckers_umap",''', '''    { id: "live_projects_app", name: "Live Projects to Resist (its whole map)", unit: "opens its own map in a panel", colour: "#6E7B84", route: "companion", ready: true, lazy: true,
      page: "https://welcometoyourgalaxy.github.io/local-map/",
      note: "The Live Global Project Map itself, in a panel along the bottom that follows this map's view: its country guides and how-to PDFs, lenses, trackers, regions, project cards, overlays and history." },
    { id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  live_projects_app: ["human", "downstream"],\n')
once('{ h: 3, t: "Construction" }, "local_projects",', '{ h: 3, t: "Construction" }, "local_projects", "live_projects_app",')
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "companion" ? Promise.resolve().then(() => addCompanion(cfg))''')

JS = r'''/* ---------- a whole map of the site's own, in a panel that follows this one ---------- */
// The page is on the same site, so this map can move it to the same place. Its
// Leaflet zoom is one more than this map's (512-pixel tiles here, 256 there).
const companions = new Map();
function companionSync(cfg) {
  const c = companions.get(cfg.id);
  if (!c || c.el.hidden || !c.follow.checked) return;
  try {
    const w = c.frame.contentWindow, ctr = map.getCenter();
    w.eval(`map.setView([${ctr.lat}, ${ctr.lng}], ${Math.round(map.getZoom() + 1)}, { animate: false })`);
  } catch (e) { /* the page is still loading */ }
}
function addCompanion(cfg) {
  let c = companions.get(cfg.id);
  if (!c) {
    const el = document.createElement("div");
    el.className = "companion";
    el.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:46vh;z-index:40;display:flex;flex-direction:column;" +
      "background:var(--peat,#17150F);border-top:1px solid var(--rule,#322E27)";
    el.innerHTML = `<div style="display:flex;align-items:center;gap:11px;padding:6px 12px;font-size:12.5px;color:var(--dim)">` +
      `<span style="color:var(--bone)">${escapeHtml(cfg.name)}</span>` +
      `<label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" checked> follow this map</label>` +
      `<a href="${escapeHtml(cfg.page)}" target="_blank" rel="noopener" style="color:var(--slate,#8A9DA6)">open \u2197</a>` +
      `<span style="margin-left:auto"></span><button type="button" style="font:inherit;background:none;color:var(--dim);border:1px solid var(--rule);` +
      `border-radius:2px;padding:1px 7px;cursor:pointer">close</button></div>` +
      `<iframe title="${escapeHtml(cfg.name)}" style="flex:1;width:100%;border:0"></iframe>`;
    document.body.appendChild(el);
    const frame = el.querySelector("iframe");
    c = { el, frame, follow: el.querySelector("input") };
    companions.set(cfg.id, c);
    el.querySelector("button").addEventListener("click", () => {
      const cb = document.querySelector(`[data-layer="${cfg.id}"]`);
      if (cb) { cb.checked = false; cb.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    frame.addEventListener("load", () => setTimeout(() => companionSync(cfg), 800));
    c.follow.addEventListener("change", () => companionSync(cfg));
    map.on("moveend", () => companionSync(cfg));
    frame.src = cfg.page;
  }
  setLayerState(cfg.id, "open along the bottom of the screen");
  applyVisibility(cfg.id);
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)
# The panel shows while its row is ticked.
once("""  const extra = (cfg || childById(id) || {})._layerIds;""", """  const comp = typeof companions !== "undefined" && companions.get(id);
  if (comp) { comp.el.hidden = vis !== "visible"; if (vis === "visible") companionSync(childById(id) || cfg); }
  const extra = (cfg || childById(id) || {})._layerIds;""")

# --- 3. Wastewater from the GitHub copy ----------------------------------------------------------
for layer in ["N_effluent", "N_effluent_treated", "N_effluent_septic", "N_effluent_open", "N_plumes"]:
    once(f'tiles: "https://mazu.nceas.ucsb.edu/wastewater/{layer}/{{z}}/{{x}}/{{y}}.png" }}',
         f'archive: "{HOME}/tiles/wastewater_{layer}.pmtiles" }}')
once('''      note: "The model's published tiles, read live. Each chip is one of the model's own layers." },''',
     '''      note: "The model's own published pictures, from a GitHub copy (its server does not let other sites draw them). Each chip is one of the model's own layers." },''')
once("""  map.addSource(src, { type: "raster", tileSize: 256, maxzoom: cfg.maxzoom || 12,
    attribution: cfg.attribution || "", tiles: [cfg.choices[cfg._pick].tiles] });""",
     """  map.addSource(src, rasterChoiceSource(cfg));""")
once("""function rasterChoiceRow(cfg) {""", """// A choice is live squares (tiles) or a PMTiles copy (archive).
function rasterChoiceSource(cfg) {
  const ch = cfg.choices[cfg._pick];
  return ch.archive
    ? { type: "raster", tileSize: 256, url: `pmtiles://${ch.archive}`, attribution: cfg.attribution || "" }
    : { type: "raster", tileSize: 256, maxzoom: cfg.maxzoom || 12, attribution: cfg.attribution || "", tiles: [ch.tiles] };
}
function rasterChoiceRow(cfg) {""")
once("""  const s = map.getSource(`${cfg.id}-img`);
  if (s && s.setTiles) s.setTiles([cfg.choices[cfg._pick].tiles]);""",
     """  const s = map.getSource(`${cfg.id}-img`);
  if (cfg.choices[cfg._pick].archive || !(s && s.setTiles)) {
    // A copy is its own archive: the source is replaced, in the same place in the drawing order.
    const order = map.getStyle().layers.map((l) => l.id);
    const at = order.indexOf(`${cfg.id}-raster`);
    const before = at >= 0 ? order[at + 1] : undefined;
    const paint = { "raster-opacity": map.getPaintProperty(`${cfg.id}-raster`, "raster-opacity") ?? 0.8, "raster-saturation": -0.35 };
    if (map.getLayer(`${cfg.id}-raster`)) map.removeLayer(`${cfg.id}-raster`);
    if (s) map.removeSource(`${cfg.id}-img`);
    map.addSource(`${cfg.id}-img`, rasterChoiceSource(cfg));
    map.addLayer({ id: `${cfg.id}-raster`, type: "raster", source: `${cfg.id}-img`, paint }, before && map.getLayer(before) ? before : undefined);
    applyVisibility(cfg.id);
  } else s.setTiles([cfg.choices[cfg._pick].tiles]);""")


def once_t(old, new):
    global test
    if test.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/test.mjs ({old.strip()[:70]!r}). Nothing was written.")
    test = test.replace(old, new)


once_t(r"""(src.match(/mazu\.nceas\.ucsb\.edu\/wastewater\//g) || []).length === 5""",
       r"""(src.match(/tiles\/wastewater_N_[a-z_]+\.pmtiles/g) || []).length === 5""")
once_t(r"""/openNode\(\$\{JSON\.stringify\(id\)\}\)/.test(src) && /srcdoc = html/.test(src)""",
       r"""/w\.eval\(`\$\{fn\}\(\$\{JSON\.stringify\(arg\)\}\)`\)/.test(src) && /srcdoc = html/.test(src)""")

TESTS = r'''
console.log("\nSocial Spheres controls; Live Projects to Resist whole; wastewater from its copy");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const lab = new Function(src.slice(src.indexOf("function spheresLabels("), src.indexOf("function spheresControls(")) + "; return spheresLabels;")();
  check("the Social Spheres' own kind names are read", lab('const KINDLABEL={assoc:"Association & commission",club:"Club"};').club === "Club");
  check("a person or sector opens through the map's own functions only", /\["openNode", "openPerson", "openSector"\]\.includes\(fn\)/.test(src));
  check("Live Projects to Resist opens whole, following this map", /id: "live_projects_app"/.test(src) && /map\.setView\(\[\$\{ctr\.lat\}/.test(src));
  check("the wastewater layers read the GitHub copy", (src.match(/tiles\/wastewater_N_[a-z_]+\.pmtiles/g) || []).length === 5 && !/mazu\.nceas\.ucsb\.edu/.test(src));
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Done. Test with: node map/test.mjs")
