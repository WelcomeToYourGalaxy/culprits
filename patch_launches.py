#!/usr/bin/env python3
"""
Off-planet invasion: launches and launch sites, live from Launch Library 2 (The
Space Devs' open database of every orbital launch and launch site).

  Launch sites     every pad it lists, with its location, its launch count, and links
  Upcoming launches  each scheduled launch at its pad: date, rocket, operator, mission,
                   target orbit, status

Read live each time they are ticked. Launch Library allows 15 requests an hour
per visitor; if that is used up, the rows read culprits-tiles-more's daily copy
instead and say so.

Run from the repo root:  python3 patch_launches.py
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs"
app, test = APP.read_text(encoding="utf-8"), TEST.read_text(encoding="utf-8")
if "async function readLaunchLibrary(" in app:
    sys.exit("Already applied - nothing to do.")


def once(old, new):
    global app
    if app.count(old) != 1:
        sys.exit(f"Could not find the expected text in map/app.js ({old.strip()[:70]!r}). Nothing was written.")
    app = app.replace(old, new)


HOME = "https://welcometoyourgalaxy.github.io/culprits-tiles-more"
ROWS = f'''    {{ id: "ll2_pads", name: "Launch sites (Launch Library 2)", unit: "launch pads", colour: "#5E6070", route: "ll2", ready: true, lazy: true,
      what: "pads", copy: "{HOME}/ll2/pads.json",
      note: "Every launch pad in Launch Library 2, The Space Devs' open database, read live." }},
    {{ id: "ll2_upcoming", name: "Upcoming launches (Launch Library 2)", unit: "launches", colour: "#6E5A6E", route: "ll2", ready: true, lazy: true,
      what: "upcoming", copy: "{HOME}/ll2/upcoming.json",
      note: "Every scheduled launch in Launch Library 2, placed at its pad, read live." }},
'''
once('''    { id: "wreckers_umap",''', ROWS + '''    { id: "wreckers_umap",''')
once('  mines_global: ["insentient", "downstream"],\n', '  mines_global: ["insentient", "downstream"],\n  ll2_pads: ["insentient", "upstream"],\n  ll2_upcoming: ["insentient", "upstream"],\n')
once('''  { note: "The space industry, launch sites and the other maps from the site's Off-Planet Invasion page come here." },''',
     '''  "ll2_pads", "ll2_upcoming",''')
once('''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))''',
     '''    : cfg.route === "pmshapes" ? Promise.resolve().then(() => addPmShapesLayer(cfg))
    : cfg.route === "ll2" ? addLivePlacesLayer(cfg)''')
once("""        : cfg.route === "kml" ? await readKml(cfg)""", """        : cfg.route === "kml" ? await readKml(cfg)
        : cfg.route === "ll2" ? await readLaunchLibrary(cfg)""")

JS = r'''/* ---------- Launch Library 2: launch sites and upcoming launches ---------- */
const LL2 = "https://ll.thespacedevs.com/2.3.0";
async function ll2All(path) {
  const out = [];
  let url = `${LL2}${path}${path.includes("?") ? "&" : "?"}limit=100&mode=detailed`;
  for (let i = 0; url && i < 6; i++) {
    const r = await fetch(url);
    if (r.status === 429) throw new Error("rate");
    if (!r.ok) throw new Error(`${r.status}`);
    const j = await r.json();
    out.push(...(j.results || []));
    url = j.next;
  }
  return out;
}
function ll2Img(x) { return x && (typeof x === "string" ? x : x.image_url || x.thumbnail_url) || ""; }
function ll2Pad(p, extra) {
  const lat = Number(p.latitude), lng = Number(p.longitude);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { type: "Point", coordinates: [lng, lat] };
}
async function readLaunchLibrary(cfg) {
  let rows, note = "";
  try { rows = await ll2All(cfg.what === "pads" ? "/pads/" : "/launches/upcoming/"); }
  catch (e) {
    rows = (await getJson(cfg.copy)).results || [];
    note = e.message === "rate" ? "Launch Library's hourly limit was reached; showing today's copy" : `Launch Library did not answer; showing today's copy`;
  }
  const items = [];
  for (const r of rows) {
    if (cfg.what === "pads") {
      const g = ll2Pad(r);
      if (!g) continue;
      const loc = r.location || {};
      const country = (loc.country && loc.country.name) || loc.country_code || r.country_code || "";
      items.push({ geometry: g, key: `p${r.id}`, name: r.name || "", group: country,
        h: boxOpen + `<h4 style="margin:0 0 6px">${escapeHtml(r.name || "")}</h4>` +
          `<div>${escapeHtml(loc.name || "")}${country ? " \u00b7 " + escapeHtml(country) : ""}</div>` +
          (r.total_launch_count != null ? `<div>${Number(r.total_launch_count).toLocaleString()} launches` +
            (r.orbital_launch_attempt_count != null ? `, ${Number(r.orbital_launch_attempt_count).toLocaleString()} orbital attempts` : "") + `</div>` : "") +
          (r.description ? `<p>${escapeHtml(r.description)}</p>` : "") +
          (r.wiki_url ? `<p><a href="${escapeHtml(r.wiki_url)}" target="_blank" rel="noopener">About this site</a></p>` : "") +
          (r.map_url ? `<p><a href="${escapeHtml(r.map_url)}" target="_blank" rel="noopener">On a map</a></p>` : "") +
          `<div style="font-size:11px">Launch Library 2, The Space Devs</div></div>` });
    } else {
      const pad = r.pad || {};
      const g = ll2Pad(pad);
      if (!g) continue;
      const lsp = (r.launch_service_provider && r.launch_service_provider.name) || "";
      const rocket = (r.rocket && r.rocket.configuration && (r.rocket.configuration.full_name || r.rocket.configuration.name)) || "";
      const m = r.mission || {};
      const when = r.net ? new Date(r.net) : null;
      items.push({ geometry: g, key: `l${r.id}`, name: r.name || "", group: (r.status && r.status.name) || "",
        h: boxOpen + (ll2Img(r.image) ? `<img src="${escapeHtml(ll2Img(r.image))}" style="max-width:100%;margin-bottom:6px">` : "") +
          `<h4 style="margin:0 0 6px">${escapeHtml(r.name || "")}</h4>` +
          `<div>${when ? escapeHtml(when.toUTCString().replace(" GMT", " UTC")) : ""}${r.status ? " \u00b7 " + escapeHtml(r.status.name) : ""}</div>` +
          `<div>${escapeHtml([rocket, lsp].filter(Boolean).join(" \u00b7 "))}</div>` +
          `<div>${escapeHtml(pad.name || "")}${pad.location ? ", " + escapeHtml(pad.location.name || "") : ""}</div>` +
          (m.name ? `<p><b>${escapeHtml(m.name)}</b>${m.orbit && m.orbit.name ? " \u2192 " + escapeHtml(m.orbit.name) : ""}<br>${escapeHtml(m.description || "")}</p>` : "") +
          `<div style="font-size:11px">Launch Library 2, The Space Devs</div></div>` });
    }
  }
  return { title: cfg.name, items, note };
}

/* ---------- the sky the map sits in ---------- */'''
once("/* ---------- the sky the map sits in ---------- */", JS)

TESTS = r'''
console.log("\nlaunch sites and upcoming launches");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  check("both are rows under Off-planet invasion", /id: "ll2_pads"/.test(src) && /id: "ll2_upcoming"/.test(src) && /"ll2_pads", "ll2_upcoming",/.test(src));
  check("read live from Launch Library 2, with the daily copy when its hourly limit is used", /ll\.thespacedevs\.com\/2\.3\.0/.test(src) && /hourly limit was reached/.test(src));
  const pad = new Function(src.slice(src.indexOf("function ll2Pad("), src.indexOf("async function readLaunchLibrary(")) + "; return ll2Pad;")();
  check("a pad's position is read", JSON.stringify(pad({ latitude: "28.56", longitude: "-80.57" }).coordinates) === "[-80.57,28.56]" && pad({}) === null);
}
'''
anchor_t = '\nconsole.log(`\\n${pass} passed'
if test.count(anchor_t) != 1:
    sys.exit("Could not find the end of map/test.mjs. Nothing was written.")
test = test.replace(anchor_t, TESTS + anchor_t)
APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
print("Launch sites and upcoming launches added. Test with: node map/test.mjs")
