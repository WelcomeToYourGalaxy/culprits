#!/usr/bin/env python3
"""
Your 22 live monitors, each as its own row, read live from its own repo: its
stories placed where the monitor places them, in the monitor's own topic
colours (read from its page), sized as it sizes them (larger for notable
stories), with a chip per topic under the row. A click opens the monitor's own
box: the place, how many stories are there, and each story with its source.

Rows sit where they belong in the layers box:
  Abortion (Pre-birth frontlines), Invasion of Non-Humans, Invasion of Native
  Peoples, The Conflict Wire (Of countries by countries); The Space Front,
  Impact Watch, The Unidentified (Off-planet invasion); The Frontline (Of the
  planet); Control of Resources, Inequality, School, Law enforcement,
  Discrimination, Voter suppression, Lobbying (For money-written-law), Food and
  drink, The medical industry, Advertising, News, Science, Entertainment, Sports.

Run from the repo root:  python3 patch_monitors.py
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function addMonitorLayer(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


# id, repo, wire file, name, heading it goes under, kinds
M = [
    ("monitor_abortion", "abortion-feed", "wire_abortion.json", "Abortion — law, access and outcomes worldwide", 't: "Pre-birth frontlines" },', ("human", "downstream")),
    ("monitor_invasion", "invasion-feed", "wire_invasion.json", "Invasion of Non-Humans — worldwide", 't: "Invasion of nonhumans" },', ("animal", "downstream")),
    ("monitor_indigenous", "indigenous-feed", "wire_indigenous.json", "Invasion of Native Peoples — worldwide", 't: "Invasion of humans" },', ("human", "downstream")),
    ("monitor_conflict", "conflict-feed", "wire_conflict.json", "The Conflict Wire — worldwide", 't: "Of countries by countries" },', ("human", "downstream")),
    ("monitor_space", "space-feed", "wire_space.json", "The Space Front — live monitor", None, ("insentient", "upstream")),
    ("monitor_neo", "neo-feed", "wire_neo.json", "Impact Watch — near-Earth objects, worldwide", None, ("insentient", "downstream")),
    ("monitor_uap", "uap-feed", "wire_uap.json", "The Unidentified — UAP, worldwide", None, ("insentient", "downstream")),
    ("monitor_environment", "environment-feed", "wire_env.json", "The Frontline — environmental destruction, worldwide", 't: "Of the planet" },', ("plant", "downstream")),
    ("monitor_resource", "resource-feed", "wire_resource.json", "Control of Resources — money, debt, land and the routes between", 't: "Control of physical resources" },', ("human", "upstream")),
    ("monitor_inequality", "inequality-feed", "wire_inequality.json", "Inequality — who owns, who is priced out, and who carries the loss", 't: "Economic inequality within it" },', ("human", "upstream")),
    ("monitor_school", "school-feed", "wire_school.json", "School — who owns it, who writes it, and what it is for", 't: "School" },', ("human", "upstream")),
    ("monitor_police", "police-feed", "wire_police.json", "Law enforcement — duty, force, surveillance and what you may refuse", 't: "Law enforcement" },', ("human", "upstream")),
    ("monitor_discrimination", "discrimination-feed", "wire_discrimination.json", "Discrimination — who is treated unequally, and what is done about it", 't: "Discrimination" },', ("human", "downstream")),
    ("monitor_voter", "voter-feed", "wire_voter.json", "Voter suppression — who paid, who was kept out, and who counted", 't: "Voter suppression" },', ("human", "upstream")),
    ("monitor_lobbying", "lobbying-feed", "wire_lobbying.json", "Lobbying — who paid whom to shape the law, and through what register", 't: "For money-written-law" },', ("human", "upstream")),
    ("monitor_food", "food-feed", "wire_food.json", "Food and drink — who owns it, who funds what is said about it, and what the label certifies", 't: "The food and drink industries" },', ("human", "upstream")),
    ("monitor_medical", "medical-feed", "wire_medical.json", "The medical industry — who pays the prescriber, and what the safety data shows", 't: "The medical industry" },', ("human", "upstream")),
    ("monitor_advertising", "advertising-feed", "wire_advertising.json", "The advertising industries — how attention is taken, and under what rules", 't: "The advertising industries" },', ("human", "upstream")),
    ("monitor_news", "news-feed", "wire_news.json", "The news industry — who owns it, what replaced the reporting, and who pays to pollute it", 't: "The news industry" },', ("human", "upstream")),
    ("monitor_science", "science-feed", "wire_science.json", "Science — what is wrong with the published record, and what catches it", 't: "Science" },', ("human", "upstream")),
    ("monitor_entertainment", "entertainment-feed", "wire_entertainment.json", "The entertainment industries — who controls the bottleneck, and how deep the measurement goes", 't: "The entertainment industries" },', ("human", "upstream")),
    ("monitor_sports", "sports-feed", "wire_sports.json", "The sports industry — who takes the money, who carries the cost, and who is governing it", 't: "Sports" },', ("human", "upstream")),
]

rows = "".join(
    f'''    {{ id: "{i}", name: {json.dumps(n, ensure_ascii=False)}, unit: "stories", colour: "#8A857B", route: "monitor", ready: true, lazy: true,
      repo: "WelcomeToYourGalaxy/{r}", wire: "{w}",
      note: "Your live monitor, read from its own repo each time it is ticked: its stories where it places them, in its own topic colours, with its own box." }},
''' for i, r, w, n, _, _k in M)
once('''    { id: "wreckers_umap",''', rows + '''    { id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n' +
     "".join(f'  {i}: ["{a}", "{b}"],\n' for i, *_, (a, b) in M))
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "monitor" ? addMonitorLayer(cfg)''')

# Place each row under its heading.
for i, _r, _w, _n, head, _k in M:
    if head:
        once(head, head + f' "{i}",')
once('''  { note: "The space industry, launch sites and the other maps from the site's Off-Planet Invasion page come here." },''',
     '''  "monitor_space", "monitor_neo", "monitor_uap",''')

JS = r'''/* ---------- your live monitors, each its own layer ---------- */
const monitorCache = new Map();
async function monitorPage(cfg) {
  if (!monitorCache.has(cfg.repo)) {
    const p = fetch(`https://raw.githubusercontent.com/${cfg.repo}/main/index.html`).then((r) => r.ok ? r.text() : "");
    monitorCache.set(cfg.repo, p);
  }
  return monitorCache.get(cfg.repo);
}
// The monitor's own topic colours, read from its page.
function monitorColours(html) {
  const m = /const TOPIC_COLOR = \{([\s\S]*?)\};/.exec(html || "");
  const out = {};
  if (m) for (const [, k, c] of m[1].matchAll(/([\w-]+)\s*:\s*'(#[0-9a-fA-F]{6})'/g)) out[k] = c;
  return out;
}
// Its popup styles, scoped to its boxes here.
function monitorPopupCss(html) {
  return (String(html || "").match(/\.nw-pop[^{]*\{[^}]*\}/g) || []).map((r) => ".monitor-pop " + r).join("\n") +
    "\n.monitor-pop{--flag:#e8e2d6;--ink-faint:#9a9384}.monitor-pop a{display:block;color:#F2EEE6;text-decoration:none;margin:4px 0}" +
    ".monitor-pop a:hover{text-decoration:underline}";
}
function monitorPlace(item, geo) {
  const ids = [...(item.pl || []), ...(item.sr || []), ...(item.w || [])].filter((p) => p && p !== "unlocated");
  for (const id of ids) for (const r of geo || []) {
    if (r.id === id) return r.label;
    for (const sb of r.subs || []) {
      if (sb.id === id) return sb.label;
      for (const pl of sb.places || []) if (pl.id === id) return pl.label;
    }
  }
  return "";
}
async function addMonitorLayer(cfg) {
  let data, html;
  try {
    [html, data] = await Promise.all([monitorPage(cfg),
      getJson(`https://raw.githubusercontent.com/${cfg.repo}/main/${cfg.wire}?t=${Date.now()}`, 60000)
        .catch(() => getJson(`https://cdn.jsdelivr.net/gh/${cfg.repo}@main/${cfg.wire}`, 60000))]);
  } catch (e) { setLayerState(cfg.id, `the monitor did not answer (${e.message})`); return; }
  const colours = monitorColours(html);
  if (!document.getElementById("monitor-pop-css") && document.createElement) {
    const st = document.createElement("style");
    st.id = "monitor-pop-css";
    st.textContent = monitorPopupCss(html);
    document.head.appendChild(st);
  }
  const notable = data.notable_score || 3;
  const feats = (data.items || []).filter((i) => Array.isArray(i.ll) && i.ll.length === 2).map((i) => ({ type: "Feature",
    geometry: { type: "Point", coordinates: [i.ll[1], i.ll[0]] },
    properties: { t: i.t || "", u: i.u || "", o: i.o || "", x: ((i.x || [])[0]) || "", c: colours[(i.x || [])[0]] || "#a49f98",
                  big: (i.p || 0) >= notable ? 1 : 0, pa: i.pa ? 1 : 0, place: monitorPlace(i, data.geo) } }));
  map.addSource(`${cfg.id}-src`, { type: "geojson", data: { type: "FeatureCollection", features: feats } });
  map.addLayer({ id: `${cfg.id}-pt`, type: "circle", source: `${cfg.id}-src`,
    paint: { "circle-color": ["get", "c"], "circle-stroke-color": "#131311", "circle-stroke-width": 0.8,
             "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["case", ["==", ["get", "big"], 1], 3.4, 2.6], 6, ["case", ["==", ["get", "big"], 1], 6.5, 5]],
             "circle-opacity": ["case", ["==", ["get", "pa"], 1], 0.7, 1] } });
  map.on("click", `${cfg.id}-pt`, (e) => {
    popupClaimedBy = e.originalEvent || e;
    const p = e.point;
    const group = map.queryRenderedFeatures([[p.x - 9, p.y - 9], [p.x + 9, p.y + 9]], { layers: [`${cfg.id}-pt`] });
    const seen = new Set(), items = [];
    for (const f of group) { if (!seen.has(f.properties.u)) { seen.add(f.properties.u); items.push(f.properties); } }
    const places = [...new Set(items.map((i) => i.place).filter(Boolean))];
    const head = `<div class="nw-pop-place">${escapeHtml(places.slice(0, 3).join(" \u00b7 "))}` +
      (items.length > 1 ? ` \u00b7 ${items.length} stories here` : "") + `</div>`;
    const rows = items.slice(0, 20).map((i, n) => `<a href="${escapeHtml(i.u)}" target="_blank" rel="noopener noreferrer"` +
      (n === 0 && items.length > 1 ? ` class="nw-pop-first"` : "") + `>${escapeHtml(i.t)}` +
      `<span class="nw-pop-src">${escapeHtml(i.o)}${places.length > 1 && i.place ? " \u00b7 " + escapeHtml(i.place) : ""}</span></a>`).join("");
    const more = items.length > 20 ? `<div class="nw-pop-place">and ${items.length - 20} more</div>` : "";
    new maplibregl.Popup({ maxWidth: "300px", className: "monitor-pop" }).setLngLat(e.lngLat).setHTML(head + rows + more).addTo(map);
  });
  map.on("mouseenter", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", `${cfg.id}-pt`, () => { map.getCanvas().style.cursor = ""; });
  // A chip per topic, in its own colour.
  const topics = (data.topics || []).filter((t) => feats.some((f) => f.properties.x === t.id));
  const row = document.querySelector(`[data-layer="${cfg.id}"]`);
  const anchor = row && row.closest ? row.closest("label") : null;
  if (topics.length > 1 && anchor && anchor.after) {
    const picked = new Set();
    const el = document.createElement("div");
    el.className = "facet";
    el.innerHTML = `<span class="chip reset" data-mt="">All topics</span>` + topics.map((t) =>
      `<button type="button" class="chip" data-mt="${escapeHtml(t.id)}"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;` +
      `background:${colours[t.id] || "#a49f98"};margin-right:4px"></i>${escapeHtml(t.label)}</button>`).join("");
    el.addEventListener("click", (ev) => {
      const b = ev.target.closest && ev.target.closest("[data-mt]");
      if (!b) return;
      ev.stopPropagation();
      const t = b.dataset.mt;
      if (!t) picked.clear(); else if (picked.has(t)) picked.delete(t); else picked.add(t);
      for (const c of el.querySelectorAll("[data-mt]")) c.classList.toggle("on", c.dataset.mt ? picked.has(c.dataset.mt) : picked.size === 0);
      map.setFilter(`${cfg.id}-pt`, picked.size ? ["in", ["get", "x"], ["literal", [...picked]]] : null);
    });
    anchor.after(el);
  }
  const unplaced = (data.items || []).length - feats.length;
  setLayerState(cfg.id, `${feats.length.toLocaleString()} stories placed` + (unplaced ? ` (${unplaced.toLocaleString()} have no place)` : "") +
    (data.generated ? ` \u00b7 updated ${String(data.generated).slice(0, 16).replace("T", " ")}` : ""));
  applyVisibility(cfg.id);
  buildLegend();
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nyour 22 live monitors");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("all 22 monitors are rows", (src.match(/route: "monitor"/g) || []).length === 22);
  check("each reads its own repo's wire, live", /raw\.githubusercontent\.com\/\$\{cfg\.repo\}\/main\/\$\{cfg\.wire\}/.test(src));
  const body = src.slice(src.indexOf("const PANEL_ORDER = ["), src.indexOf("function panelNodes("));
  const order = new Function(body + "; return PANEL_ORDER;")();
  const after = (t, id) => order.indexOf(id) === order.findIndex((x) => x && x.t === t) + 1;
  check("each monitor sits under its heading", after("Law enforcement", "monitor_police") && after("Sports", "monitor_sports") &&
        after("Pre-birth frontlines", "monitor_abortion") && order.includes("monitor_space"));
  const cols = new Function(src.slice(src.indexOf("function monitorColours("), src.indexOf("// Its popup styles")) + "; return monitorColours;")();
  check("a monitor's own topic colours are read from its page", cols("const TOPIC_COLOR = {\n  ownership: '#b3877e', // clay\n  jobs: '#bf8b87'\n};").jobs === "#bf8b87");
  const place = new Function(src.slice(src.indexOf("function monitorPlace("), src.indexOf("async function addMonitorLayer(")) + "; return monitorPlace;")();
  const geo = [{ id: "africa", label: "Africa", subs: [{ id: "africa-e", label: "East Africa", places: [{ id: "ke", label: "Kenya" }] }] }];
  check("a story is named by the most specific place it has", place({ pl: ["ke"], sr: ["africa-e"], w: ["africa"] }, geo) === "Kenya" &&
        place({ pl: ["unlocated"], sr: ["africa-e"] }, geo) === "East Africa");
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("22 monitors added. Test with: node map/test.mjs")
