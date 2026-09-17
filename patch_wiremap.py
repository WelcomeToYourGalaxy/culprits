#!/usr/bin/env python3
"""
The wires on the map, a smaller opening globe, and Eyes without the bar.

- Every wire story that names a place is drawn on the map, with a tick box in
  the news wires bar to show or hide them. The feeds publish a table of place
  coordinates in their own files (`coords`); the map-repo wires give a country
  code, and those are placed from this map's own boundary file. Stories at one
  place become one mark, and clicking it lists them.
- The marks are diamonds, hollow, in slate, drawn from their own image: nothing
  else on this map is a diamond, so they do not read as sites.
- The page itself no longer scrolls: the window held more than it showed, so
  the map could be scrolled off leaving stars.
- The globe opens at zoom 1 instead of 2.9, which gives it room on the screen,
  and the hand-over to Eyes is at 0.8 — the size Earth is in Eyes, as measured
  there. Zooming in from the opening view no longer crosses it.
- Eyes' address is the one from its own embed panel, updated.
- The bar across the top is gone. Coming back is a box in the top right corner,
  beside Eyes' own search, and Earth itself: a circle the size of the globe at
  the hand-over, in the middle of the screen.

Edits map/app.js, map/index.html, map/wire.js and map/test.mjs, anchored on
exact text.

Run from the repo root:  python3 patch_wiremap.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX, WIRE = (ROOT / "map" / n for n in ("app.js", "test.mjs", "index.html", "wire.js"))
app, test, index, wire = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX, WIRE))

if "culpritsWire" in app:
    sys.exit("app.js already draws the wires — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- the page stops scrolling

index = once(index, """  html,body{margin:0;height:100%;background:var(--peat);color:var(--bone);font-family:var(--sans)}""",
             """  html,body{margin:0;height:100%;overflow:hidden;background:var(--peat);color:var(--bone);font-family:var(--sans)}""",
             "map/index.html")

# ---------------------------------------------------------------- Eyes: no bar, two ways back

index = once(index, """<div class="space-bar" id="spaceBar" hidden>
  <span class="nm">NASA&#8217;s Eyes on the Solar System</span>
  <span class="un" id="spaceNote">Drag to look around. Click a spacecraft for its own panel.</span>
  <span class="sp"></span>
  <button id="spaceBack">&#8592; Back to the map</button>
</div>""", """<button class="space-back" id="spaceBack" hidden>&#8592; Back to the map</button>
<!-- Earth itself, at the size the globe had: clicking it comes back too. -->
<button class="space-earth" id="spaceEarth" hidden title="Back to the map"><span>Back to the map</span></button>""",
                  "map/index.html")

for old in ["""  .space-bar{position:fixed;left:0;right:0;top:0;z-index:60;display:flex;gap:10px;align-items:center;
             padding:7px 12px;background:rgba(11,16,23,.86);border-bottom:1px solid var(--rule);
             font-size:12.5px;color:var(--bone)}
  .space-bar[hidden]{display:none}
""", """  .space-bar .un{color:var(--dim)}
  .space-bar .sp{flex:1}
  .space-bar button{font:inherit;color:var(--bone);background:none;border:1px solid var(--rule);
                    border-radius:3px;padding:3px 9px;cursor:pointer}
  .space-bar button:hover{border-color:var(--bone)}
"""]:
    index = once(index, old, "", "map/index.html")

index = once(index, """  .space-edge{position:fixed;inset:0;z-index:59;pointer-events:none}""",
"""  /* Beside Eyes' own search button, top right. */
  .space-back{position:fixed;right:14px;top:14px;z-index:60;font:inherit;font-size:14px;
    color:var(--bone);background:rgba(11,16,23,.86);border:1px solid var(--rule);border-radius:4px;
    padding:11px 16px;cursor:pointer}
  .space-back:hover{border-color:var(--bone)}
  .space-back[hidden]{display:none}
  .space-earth{position:fixed;left:50%;top:50%;z-index:60;transform:translate(-50%,-50%);
    border:1px solid transparent;border-radius:50%;background:none;color:var(--bone);
    font:inherit;font-size:12.5px;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center}
  .space-earth[hidden]{display:none}
  .space-earth span{opacity:0;padding:4px 8px;background:rgba(11,16,23,.7);border-radius:3px}
  .space-earth:hover{border-color:rgba(220,214,198,.45)}
  .space-earth:hover span{opacity:1}
  .space-edge{position:fixed;inset:0;z-index:59;pointer-events:none}""", "map/index.html")

# ---------------------------------------------------------------- the opening view and the fit

app = once(app, """  center: [12, 24],
  zoom: 2.9,""", """  center: [12, 24],
  zoom: 1,""", "map/app.js")

app = once(app, """const EYES_FIT = { zoom: 2, lon: 0, lat: 0, at: "2026-09-17T00:00:00Z", rate: "stars" };""",
           """const EYES_FIT = { zoom: 0.8, lon: 0, lat: 0, at: "2026-09-17T00:00:00Z", rate: "stars" };""", "map/app.js")

app = once(app, """const SPACE_URL = "https://eyes.nasa.gov/apps/solar-system/#/earth?featured=false&detailPanel=false" +
  "&logo=false&shareButton=false&collapseSettingsOptions=true&surfaceMapTiling=true&hd=true" +
  "&minorMoons=true&heliosphere=true&lighting=natural";""",
           """const SPACE_URL = "https://eyes.nasa.gov/apps/solar-system/#/earth?featured=false&logo=false" +
  "&shareButton=false&surfaceMapTiling=true&hd=true&minorMoons=true&heliosphere=true&lighting=natural";""",
           "map/app.js")

# The drop is now a tenth of a zoom below the hand-over, so the opening view at
# zoom 1 sits clear of it.
app = once(app, """  const edge = () => handoffZoom() - 0.15;""", """  const edge = () => handoffZoom() - 0.1;""", "map/app.js")
app = once(app, """  if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[kind].leave ? handoffZoom() - 0.15 : -1);""",
           """  if (typeof map.setMinZoom === "function") map.setMinZoom(VIEWS[kind].leave ? handoffZoom() - 0.1 : -1);""",
           "map/app.js")

# ---------------------------------------------------------------- the two ways back

app = once(app, """    const bar = document.getElementById("spaceBar");
    if (bar) bar.hidden = false;
    const edge = document.getElementById("spaceEdge");""", """    showBack(true);
    const edge = document.getElementById("spaceEdge");""", "map/app.js")
app = once(app, """  const bar = document.getElementById("spaceBar");
  if (bar) bar.hidden = true;
  const edge = document.getElementById("spaceEdge");""", """  showBack(false);
  const edge = document.getElementById("spaceEdge");""", "map/app.js")

app = once(app, """function spaceFrame() { return document.getElementById("space"); }""",
"""function spaceFrame() { return document.getElementById("space"); }

// Two ways back: a box in the top right corner, beside Eyes' own search, and
// Earth itself — a circle the size the globe had when it handed over.
function showBack(on) {
  const back = document.getElementById("spaceBack");
  if (back) back.hidden = !on;
  const earth = document.getElementById("spaceEarth");
  if (!earth) return;
  if (on && earth.style) {
    const d = Math.round(2 * globeRadiusPx(handoffZoom(), EYES_FIT.lat));
    earth.style.width = d + "px";
    earth.style.height = d + "px";
  }
  earth.hidden = !on;
}""", "map/app.js")

app = once(app, """  const back = document.getElementById("spaceBack");
  if (back) back.addEventListener("click", backToMap);""", """  for (const id of ["spaceBack", "spaceEarth"]) {
    const b = document.getElementById(id);
    if (b && b.addEventListener) b.addEventListener("click", backToMap);
  }""", "map/app.js")

# ---------------------------------------------------------------- the wires, drawn on the map

WIREMAP = r'''
/* ---------- the news wires, on the map ---------- */

// wire.js hands over the stories it is showing that name a place. The feeds
// publish their own table of place coordinates; the map repos' wires give a
// country code, placed here from this map's own boundary file. Stories at one
// place become one mark, and clicking it lists them.
const WIRE_COLOUR = "#9FAEB6";
let wireAt = new Map();          // "lng,lat" -> the stories there
let countryPoints = null;        // ISO -> [lng, lat], read once from the boundaries

function wireDiamond() {
  const s = 26, c = s / 2, r = 10;
  if (typeof document.createElement !== "function") return null;
  const cv = document.createElement("canvas");
  if (!cv.getContext) return null;
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(c, c - r); ctx.lineTo(c + r, c); ctx.lineTo(c, c + r); ctx.lineTo(c - r, c); ctx.closePath();
  ctx.fillStyle = "rgba(20,26,30,.72)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = WIRE_COLOUR;
  ctx.stroke();
  return ctx.getImageData(0, 0, s, s);
}

async function countryCentres() {
  if (countryPoints) return countryPoints;
  countryPoints = new Map();
  try {
    const r = await fetch(BOUNDARIES_URL);
    const data = await r.json();
    for (const f of data.features || []) {
      const iso = (f.properties && (f.properties.iso_a2 || f.properties.ISO_A2 || f.properties.iso2 || f.properties.id)) || "";
      if (!iso || iso.length !== 2) continue;
      let minX = 180, maxX = -180, minY = 90, maxY = -90;
      const walk = (co) => {
        if (typeof co[0] === "number") {
          minX = Math.min(minX, co[0]); maxX = Math.max(maxX, co[0]);
          minY = Math.min(minY, co[1]); maxY = Math.max(maxY, co[1]);
        } else co.forEach(walk);
      };
      walk(f.geometry.coordinates);
      countryPoints.set(iso.toUpperCase(), [(minX + maxX) / 2, (minY + maxY) / 2]);
    }
  } catch (e) {
    console.warn("[culprits] country places for the wires could not be read:", e.message || e);
  }
  return countryPoints;
}

function wireSource() {
  if (!map.getSource("wire-news")) {
    map.addSource("wire-news", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    const img = wireDiamond();
    if (img && map.addImage && !map.hasImage?.("wire-mark")) {
      try { map.addImage("wire-mark", img, { pixelRatio: 2 }); } catch (e) { /* already there */ }
    }
    map.addLayer({
      id: "wire-news", type: "symbol", source: "wire-news",
      layout: { "icon-image": "wire-mark", "icon-allow-overlap": true,
                "icon-size": ["interpolate", ["linear"], ["get", "n"], 1, 1.05, 12, 1.9] },
    });
    map.on("click", "wire-news", (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      popupClaimedBy = e.originalEvent || e;
      const list = wireAt.get(f.properties.k) || [];
      const rows = list.slice(0, 8).map((s) =>
        `<div class="meta" style="margin:5px 0 0">` +
        (s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a>`
               : escapeHtml(s.title)) +
        `<br>${escapeHtml([s.subject, s.outlet].filter(Boolean).join(" · "))}</div>`).join("");
      new maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(f.geometry.coordinates)
        .setHTML(`<b>${escapeHtml(f.properties.place || "News wire")}</b>` +
                 `<div class="meta">${list.length} ${list.length === 1 ? "story" : "stories"}</div>${rows}` +
                 (list.length > 8 ? `<div class="meta">…and ${list.length - 8} more in the wires box.</div>` : ""))
        .addTo(map);
    });
    map.on("mouseenter", "wire-news", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "wire-news", () => { map.getCanvas().style.cursor = ""; });
  }
  return map.getSource("wire-news");
}

async function showWireStories(stories) {
  const src = wireSource();
  if (!src) return;
  const needsCountries = stories.some((s) => !s.at && s.iso);
  const centres = needsCountries ? await countryCentres() : null;
  wireAt = new Map();
  for (const s of stories) {
    const at = s.at || (centres && s.iso ? centres.get(String(s.iso).toUpperCase()) : null);
    if (!at) continue;
    const k = at[0].toFixed(3) + "," + at[1].toFixed(3);
    if (!wireAt.has(k)) wireAt.set(k, []);
    wireAt.get(k).push(Object.assign({ place: s.place }, s, { at }));
  }
  const features = [];
  for (const [k, list] of wireAt) {
    const [lng, lat] = k.split(",").map(Number);
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] },
                    properties: { k, n: list.length, place: list[0].place || "" } });
  }
  src.setData({ type: "FeatureCollection", features });
}

// wire.js calls this whenever what it shows changes, or the tick box moves.
window.culpritsWire = {
  show(stories) {
    try { showWireStories(Array.isArray(stories) ? stories : []); }
    catch (e) { console.warn("[culprits] wires on the map:", e.message || e); }
  },
};
'''
app = once(app, "\n/* ---------- the sky the map sits in ---------- */", WIREMAP + "\n/* ---------- the sky the map sits in ---------- */", "map/app.js")

# The boundary file's address, already used for the country layers, named once.
app = once(app, """function ensureBoundaries() {""", """const BOUNDARIES_URL = `${DATA_BASE}/boundaries.geojson`;

function ensureBoundaries() {""", "map/app.js")


# ---------------------------------------------------------------- wire.js: places, and the tick box

wire = once(wire, """  const kindF = facets.find((f) => f.key === 'kind');
  if (!kindsPublished) {""", """  // Where each story is, for the map: the feeds publish a table of place
  // coordinates, and the most exact place a story names is used.
  const coords = (data && data.coords) || {};
  const findAt = (ids) => {
    for (const id of ids) {
      const c = coords[id];
      if (Array.isArray(c) && c.length === 2) return [c[1], c[0]];   // the files give lat, lon
    }
    return null;
  };
  stories.forEach((s, n) => {
    const i = items[n] || {};
    s.at = findAt([].concat(asList(i.pl), asList(i.sr), asList(i.w), asList(i.pn)).filter((x) => x && x !== 'unlocated'));
  });

  const kindF = facets.find((f) => f.key === 'kind');
  if (!kindsPublished) {""", "map/wire.js")

wire = once(wire, """    s.place = pl ? pl.join(', ') : null;
    return s;
  });
  return finish(facets, stories, null);""", """    s.place = pl ? pl.join(', ') : null;
    // These wires give a country code rather than coordinates; the map places
    // them from its own boundary file.
    const isoF = facets.find((f) => f.type === 'country');
    const iso = isoF ? (s.v[isoF.key] || []).find((x) => x !== NONE) : null;
    s.iso = iso || null;
    s.at = null;
    return s;
  });
  return finish(facets, stories, null);""", "map/wire.js")

wire = once(wire, """      '<button type="button" class="wire-btn" id="wireRefresh" hidden>Refresh</button>' +
    '</div>' +""", """      '<label class="wire-onmap" title="Draw the stories that name a place on the map">' +
        '<input type="checkbox" id="wireOnMap" checked> on the map</label>' +
      '<button type="button" class="wire-btn" id="wireRefresh" hidden>Refresh</button>' +
    '</div>' +""", "map/wire.js")

wire = once(wire, """.wire-btn{background:none;border:1px solid var(--rule,#322E27);color:var(--dim,#948D7C);""",
            """.wire-onmap{display:flex;align-items:center;gap:5px;color:var(--dim,#948D7C);font-size:12px;
  white-space:nowrap;cursor:pointer}
.wire-onmap input{accent-color:var(--moss,#62755F)}
.wire-btn{background:none;border:1px solid var(--rule,#322E27);color:var(--dim,#948D7C);""", "map/wire.js")

wire = once(wire, """  $refresh = box.querySelector('#wireRefresh');""",
            """  $refresh = box.querySelector('#wireRefresh');
  $onMap = box.querySelector('#wireOnMap');""", "map/wire.js")
wire = once(wire, """  $toggle.addEventListener('click', () => setOpen(!state.open));""",
            """  $toggle.addEventListener('click', () => setOpen(!state.open));
  if ($onMap) $onMap.addEventListener('change', () => { state.onMap = $onMap.checked; save(); renderList(); });""",
            "map/wire.js")

wire = once(wire, """  all.sort((a, b) => (b.s.date == null ? -Infinity : b.s.date) - (a.s.date == null ? -Infinity : a.s.date));""",
"""  all.sort((a, b) => (b.s.date == null ? -Infinity : b.s.date) - (a.s.date == null ? -Infinity : a.s.date));
  toTheMap(all);""", "map/wire.js")

wire = once(wire, """function renderList() {
  if (!state.picked.length) {
    $list.innerHTML = '<p class="wire-empty">Tick one or more subjects to read their wires.</p>';
    return;
  }""", """// The stories now showing, handed to the map. Off when the box is unticked.
function toTheMap(all) {
  if (!window.culpritsWire) return;
  const on = !$onMap || $onMap.checked;
  window.culpritsWire.show(on ? all.map(({ s, id }) => ({
    title: s.title, url: s.url, outlet: s.outlet, place: s.place, date: s.date,
    subject: BY_ID[id] ? BY_ID[id].name : id, at: s.at || null, iso: s.iso || null,
  })) : []);
}

function renderList() {
  if (!state.picked.length) {
    toTheMap([]);
    $list.innerHTML = '<p class="wire-empty">Tick one or more subjects to read their wires.</p>';
    return;
  }""", "map/wire.js")

wire = once(wire, """let box, $sum, $body, $toggle, $pickBtn, $picker, $filters, $list, $q, $when, $refresh;""",
            """let box, $sum, $body, $toggle, $pickBtn, $picker, $filters, $list, $q, $when, $refresh, $onMap;""",
            "map/wire.js")

# ---------------------------------------------------------------- tests

TESTS = r'''
console.log("\nthe wires on the map");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the wires box has a tick box for the map", /id="wireOnMap" checked/.test(wireSrc) &&
        /\$onMap\.addEventListener\('change'/.test(wireSrc));
  check("a story keeps where it is: coordinates from the feeds, a country code from the map wires",
        /s\.at = findAt\(/.test(wireSrc) && /s\.iso = iso \|\| null/.test(wireSrc));
  check("what the box shows is what the map draws", /toTheMap\(all\)/.test(wireSrc) && /toTheMap\(\[\]\)/.test(wireSrc) &&
        /window\.culpritsWire\.show\(/.test(wireSrc));
  check("the marks are diamonds of their own, not another dot",
        /function wireDiamond/.test(src) && /"icon-image": "wire-mark"/.test(src) && /type: "symbol"/.test(src));
  check("stories at one place become one mark that lists them",
        /wireAt\.get\(f\.properties\.k\)/.test(src) && /\["get", "n"\]/.test(src));
  check("the page itself does not scroll", /html,body\{margin:0;height:100%;overflow:hidden/.test(index));
  check("the globe opens with room around it, clear of the hand-over",
        /zoom: 1,/.test(src) && /EYES_FIT = \{ zoom: 0\.8/.test(src));
  check("Eyes opens on the address from its own embed panel",
        /surfaceMapTiling=true/.test(src) && !/detailPanel/.test(src) && !/collapseSettingsOptions/.test(src));
  check("the bar is gone; the way back is a box and Earth itself",
        !/space-bar/.test(index) && /id="spaceBack"/.test(index) && /id="spaceEarth"/.test(index) &&
        /function showBack/.test(src) && /globeRadiusPx\(handoffZoom\(\)/.test(src));
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

# The older checks carry the new numbers: the hand-over is at zoom 0.8, the
# drop a tenth below it, and the address no longer names the detail panel.
for a, b in [
    ('fit.EYES_FIT.zoom === 2 && fit.handoffZoom() === 2', 'fit.EYES_FIT.zoom === 0.8 && fit.handoffZoom() === 0.8'),
    ('measured at zoom 2"', '"'),
    ('/handoffZoom\\(\\) - 0\\.15/.test(src)', '/handoffZoom\\(\\) - 0\\.1/.test(src)'),
    ('/detailPanel=false/.test(src) && /featured=false/.test(src)', '/featured=false/.test(src) && /logo=false/.test(src)'),
    ('map.setZoom(4); map.fire("zoom");\n  map.setZoom(2.4);', 'map.setZoom(4); map.fire("zoom");\n  map.setZoom(1.5);'),
    ('eased.length === 1 && eased[0].zoom === 2 &&', 'eased.length === 1 && eased[0].zoom === 0.8 &&'),
    ('map.setZoom(4.5); map.fire("zoom");\n  map.setZoom(1.5);', 'map.setZoom(4.5); map.fire("zoom");\n  map.setZoom(0.4);'),
    ('eased.length === 1 && eased[0].zoom === 2)', 'eased.length === 1 && eased[0].zoom === 0.8)'),
    ('eased[1].zoom >= 2.6', 'eased[1].zoom >= 1.4'),
    ('projections.includes("vertical-perspective") && eased[0].zoom === 2)', 'projections.includes("vertical-perspective") && eased[0].zoom === 0.8)'),
]:
    test = test.replace(a, b)
# The bar's element is now a button, and the opening zoom moved.
test = test.replace('els.get("spaceBar")', 'els.get("spaceBack")').replace('el("spaceBar")', 'el("spaceBack")')

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
WIRE.write_text(wire, encoding="utf-8")
print("Wires drawn on the map with their own tick box; globe opens at zoom 1; Eyes without the bar.")
