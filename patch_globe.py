#!/usr/bin/env python3
"""
The globe, with NASA's Eyes on the Solar System behind it.

Three views, chosen in the panel under "View":
  globe           a globe at every zoom
  globe to flat   a globe from world view that flattens into the flat map as
                  you zoom in (MapLibre's own transition, zoom 10 to 12)
  flat            the flat map, as it has been

and, beside them, "Space behind the map": NASA's Eyes on the Solar System,
centred on Earth, running live behind the map, so its stars and the
spacecraft around Earth show wherever the map does not cover. It is on for the
two globe views and off for the flat map, and can be ticked either way. The
frame loads only the first time it is shown. It is a separate NASA app in a
frame: it does not turn when the globe turns, and it cannot be clicked through
the map.

What had to change for the globe:
- MapLibre 4.7.1 -> 5.24.0 (index.html). Version 5 is the first with a globe.
- The atlas's colour washes were one flat pass over the whole screen. On a
  globe that would tint space as well, so they are now drawn as a mesh over
  the world, placed by MapLibre's own projection code. On the flat map this
  also covers what the scissor rectangle did, so that is removed.
- An atmosphere at world view (the style's "sky"), fading out by zoom 7.
- On the flat map the dark background layer is hidden while space shows, so
  space is not painted over. On a globe it is drawn on the planet only, and
  stays.

Edits map/app.js, map/index.html and map/test.mjs, anchored on exact text; if
an anchor is missing nothing is written.

Run from the repo root:  python3 patch_globe.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs", ROOT / "map" / "index.html"
app, test, index = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX))

if "function setView(" in app:
    sys.exit("app.js already has the globe views — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- index.html

index = once(index, '<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">',
             '<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css">', "map/index.html")
index = once(index, '<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>',
             '<script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>', "map/index.html")
index = once(index, """<body>
<div id="map"></div>""", """<body>
<!-- Space behind the map: NASA's Eyes on the Solar System, loaded the first
     time it is shown (see setSpace in app.js). Behind #map, never clickable. -->
<iframe id="space" class="space" title="NASA's Eyes on the Solar System, behind the map"
        referrerpolicy="no-referrer" hidden tabindex="-1" aria-hidden="true"></iframe>
<div id="map"></div>""", "map/index.html")
index = once(index, """  #map{position:absolute;inset:0}""", """  #map{position:absolute;inset:0}
  .space{position:fixed;inset:0;width:100%;height:100%;border:0;pointer-events:none;background:#000}
  .space[hidden]{display:none}""", "map/index.html")

# ---------------------------------------------------------------- the washes, as a mesh over the world

start = app.index("// The screen rectangle the one world covers, in the GL canvas's own pixels,")
end = app.index("function hexRgb(h) {")
if start > end:
    sys.exit("The wash helpers are not where expected in map/app.js. Nothing was written.")
app = app[:start] + app[end:]

w0 = app.index("const atlasWashes = {")
w1 = app.index("\n};\n", w0) + len("\n};\n")
WASHES = r'''// The washes are drawn as a mesh over the world, not as one pass over the
// screen: on a globe a screen pass would tint space too. MapLibre hands a
// custom layer its own projection code (shaderData) and its uniforms
// (defaultProjectionData); with them one mesh in Web Mercator coordinates
// lands on the flat map and on the globe alike. The mesh is fine enough that
// its straight edges follow the curve of the globe.
const WASH_MESH = { cols: 96, rows: 64 };
function washMesh({ cols, rows }) {
  const v = [];
  for (let j = 0; j < rows; j++) {
    const y0 = j / rows, y1 = (j + 1) / rows;
    for (let i = 0; i < cols; i++) {
      const x0 = i / cols, x1 = (i + 1) / cols;
      v.push(x0, y0, x1, y0, x0, y1, x1, y0, x1, y1, x0, y1);
    }
  }
  return new Float32Array(v);
}
const atlasWashes = {
  id: "atlas-washes", type: "custom", renderingMode: "2d",
  onAdd(m, gl) {
    this.map = m;
    this.programs = new Map();        // one per projection variant MapLibre names
    try {
      this.mesh = washMesh(WASH_MESH);
      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, this.mesh, gl.STATIC_DRAW);
    } catch (e) {
      this.failed = true;
      console.warn("[culprits] atlas washes unavailable:", e.message || e);
    }
  },
  program(gl, shaderData) {
    const key = shaderData.variantName;
    if (this.programs.has(key)) return this.programs.get(key);
    const sh = (type, src) => {
      const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, `#version 300 es
${shaderData.vertexShaderPrelude}
${shaderData.define}
in vec2 a_pos;
void main() { gl_Position = projectTile(a_pos); }`));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float;
uniform vec3 c;
out vec4 colour;
void main() { colour = vec4(c, 1.0); }`));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = (n) => gl.getUniformLocation(p, n);
    const prog = { p, aPos: gl.getAttribLocation(p, "a_pos"), uCol: u("c"),
      uMatrix: u("u_projection_matrix"), uFallback: u("u_projection_fallback_matrix"),
      uTile: u("u_projection_tile_mercator_coords"), uClip: u("u_projection_clipping_plane"),
      uTransition: u("u_projection_transition") };
    this.programs.set(key, prog);
    return prog;
  },
  render(gl, options) {
    if (this.failed || BASEMAP !== "atlas" || !options || !options.shaderData) return;
    let prog;
    try { prog = this.program(gl, options.shaderData); }
    catch (e) {
      // A GPU that rejects the shader leaves the imagery ungraded by washes
      // rather than taking the map down. Everything else still draws.
      this.failed = true;
      console.warn("[culprits] atlas washes unavailable:", e.message || e);
      return;
    }
    // MapLibre binds its own vertex array objects. Drawing with one still bound
    // would rewrite MapLibre's attribute state; unbind first. MapLibre marks its
    // GL state dirty around a custom layer and restores the rest itself.
    if (gl.bindVertexArray) gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.CULL_FACE);
    gl.useProgram(prog.p);
    const d = options.defaultProjectionData;
    if (prog.uMatrix) gl.uniformMatrix4fv(prog.uMatrix, false, d.mainMatrix);
    if (prog.uFallback) gl.uniformMatrix4fv(prog.uFallback, false, d.fallbackMatrix);
    if (prog.uTile) gl.uniform4f(prog.uTile, ...d.tileMercatorCoords);
    if (prog.uClip) gl.uniform4f(prog.uClip, ...d.clippingPlane);
    if (prog.uTransition) gl.uniform1f(prog.uTransition, d.projectionTransition);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(prog.aPos);
    gl.vertexAttribPointer(prog.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    // Alpha is left as it was in every pass: these change colour, not coverage.
    const func = {
      screen:   [gl.ONE, gl.ONE_MINUS_SRC_COLOR],
      multiply: [gl.ZERO, gl.SRC_COLOR],
      gain:     [gl.DST_COLOR, gl.ONE],
    };
    const count = this.mesh.length / 2;
    for (const pass of atlasWashPasses(this.map.getZoom())) {
      const [src, dst] = func[pass.mode];
      gl.blendFuncSeparate(src, dst, gl.ZERO, gl.ONE);
      gl.uniform3f(prog.uCol, pass.rgb[0], pass.rgb[1], pass.rgb[2]);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }
  },
};
'''
app = app[:w0] + WASHES + app[w1:]

# ---------------------------------------------------------------- the style: projection and atmosphere

app = once(app, """  attributionControl: { compact: true },
  style: {
    version: 8,""", """  attributionControl: { compact: true },
  style: {
    version: 8,
    // The opening view: a globe that flattens as you zoom in. See VIEWS.
    projection: { type: "globe" },
    // The atmosphere, at world view only; gone by the time the map is flat.
    sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 0.8, 7, 0] },""", "map/app.js")

# ---------------------------------------------------------------- views, space, and the panel

VIEW_JS = r'''
/* ---------- views: globe, globe to flat, flat; and space behind ---------- */

// MapLibre's own projection names. "globe" is its globe that turns into the
// flat map between zoom 10 and 12; "vertical-perspective" stays a globe.
const VIEWS = {
  "globe":      { projection: "vertical-perspective", space: true,
                  nm: "Globe", un: "A globe at every zoom." },
  "globe-flat": { projection: "globe", space: true,
                  nm: "Globe to flat", un: "A globe at world view that flattens into the map as you zoom in." },
  "flat":       { projection: "mercator", space: false,
                  nm: "Flat map", un: "The flat map. Space stays off unless you tick it." },
};
let VIEW = "globe-flat";
let SPACE = VIEWS[VIEW].space;

// NASA's Eyes on the Solar System, centred on Earth, with its panels closed.
// Change "earth" to another Eyes target (for example sc_voyager_1) to centre
// the backdrop on something else.
const SPACE_URL = "https://eyes.nasa.gov/apps/solar-system/#/earth?embed=true&logo=false&menu=false&featured=false";

function setSpace(on) {
  SPACE = !!on;
  const frame = document.getElementById("space");
  if (frame) {
    // Loaded the first time it is shown, not with the page: it is a whole app.
    if (SPACE && !frame.src) frame.src = SPACE_URL;
    frame.hidden = !SPACE;
  }
  // On a globe the dark background is drawn on the planet only (it fills the
  // caps beyond 85°), so it stays. On the flat map it fills the whole screen
  // and would paint over space, so it goes while space shows.
  const flat = VIEWS[VIEW].projection === "mercator";
  if (map.getLayer("bg")) map.setLayoutProperty("bg", "visibility", SPACE && flat ? "none" : "visible");
  const box = document.getElementById("space-toggle");
  if (box) box.checked = SPACE;
}

function setView(kind) {
  if (!VIEWS[kind]) return;
  VIEW = kind;
  if (typeof map.setProjection === "function") map.setProjection({ type: VIEWS[kind].projection });
  setSpace(VIEWS[kind].space);
  if (typeof map.triggerRepaint === "function") map.triggerRepaint();
}

function viewPanelHtml() {
  return `<p class="bm-h">View</p>` + Object.entries(VIEWS).map(([k, v]) =>
    `<label class="layer"><input type="radio" name="view" value="${k}"${k === VIEW ? " checked" : ""}>` +
    `<span class="body"><span class="nm">${v.nm}</span><span class="un">${v.un}</span></span></label>`).join("") +
    `<label class="layer"><input type="checkbox" id="space-toggle"${SPACE ? " checked" : ""}>` +
    `<span class="body"><span class="nm">Space behind the map</span>` +
    `<span class="un">NASA's Eyes on the Solar System, centred on Earth: real stars and the spacecraft ` +
    `around Earth, live. A separate app: it does not turn with the globe.</span></span></label>` +
    `<p class="bm-h" style="margin-top:10px">Basemap</p>`;
}
'''
app = once(app, "\nfunction buildBasemapPanel() {", VIEW_JS + "\nfunction buildBasemapPanel() {", "map/app.js")
app = once(app, """  box.innerHTML = `<p class="bm-h">Basemap</p>` + opts.map(([k, nm, un]) =>""",
           """  box.innerHTML = viewPanelHtml() + opts.map(([k, nm, un]) =>""", "map/app.js")
app = once(app, """  box.addEventListener("change", (e) => {
    if (e.target && e.target.name === "basemap") setBasemap(e.target.value);
  });""", """  box.addEventListener("change", (e) => {
    if (e.target && e.target.name === "basemap") setBasemap(e.target.value);
    if (e.target && e.target.name === "view") setView(e.target.value);
    if (e.target && e.target.id === "space-toggle") setSpace(e.target.checked);
  });""", "map/app.js")
app = once(app, """  setBasemap(BASEMAP);
  buildBasemapPanel();""", """  setBasemap(BASEMAP);
  setSpace(SPACE);
  buildBasemapPanel();""", "map/app.js")

# ---------------------------------------------------------------- tests

old_world = re.search(r'\nconsole\.log\("\\none world"\);\n\{.*?\n\}\n', test, re.S)
if not old_world:
    sys.exit("Could not find the one-world tests in map/test.mjs. Nothing was written.")
test = test.replace(old_world.group(0), r'''
console.log("\none world, and the globe");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const opts = src.slice(src.indexOf("const map = new maplibregl.Map({"), src.indexOf("layers: [", src.indexOf("const map = new maplibregl.Map({")));
  check("the world is not repeated east and west", /renderWorldCopies:\s*false/.test(opts));
  check("the map opens as a globe that flattens as you zoom in", /projection:\s*\{\s*type:\s*"globe"\s*\}/.test(opts));
  check("an atmosphere at world view, gone by zoom 7", /"atmosphere-blend":\s*\["interpolate",\s*\["linear"\],\s*\["zoom"\]/.test(opts));
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("MapLibre 5, the first version with a globe", /maplibre-gl@5\.\d+\.\d+\/dist\/maplibre-gl\.js/.test(index) && !/maplibre-gl@4/.test(index));
  check("the space frame sits behind the map and cannot be clicked",
        index.indexOf('id="space"') < index.indexOf('id="map"') && /\.space\{[^}]*pointer-events:none/.test(index));
  const mesh = new Function(src.match(/const WASH_MESH[\s\S]*?\nfunction washMesh[\s\S]*?\n}\n/)[0] + "; return washMesh(WASH_MESH);")();
  check("the washes are a mesh over the whole world, in mercator 0..1",
        mesh.length === 96 * 64 * 12 && Math.min(...mesh) === 0 && Math.max(...mesh) === 1);
  check("the washes are placed by MapLibre's projection code, not a screen pass",
        /projectTile\(a_pos\)/.test(src) && /vertexShaderPrelude/.test(src) && !/gl_Position = vec4\(p, 0\.0, 1\.0\)/.test(src));
}
{
  const { map, els } = run();
  map.layers.push({ id: "bg", type: "background" });
  const projections = [];
  map.setProjection = (p) => projections.push(p.type);
  map.fire("load"); await new Promise((r) => setTimeout(r, 5));
  const panel = els.get("basemaps");
  check("the panel offers the three views and space", /value="globe"/.test(panel.innerHTML) && /value="globe-flat" checked/.test(panel.innerHTML) &&
        /value="flat"/.test(panel.innerHTML) && /id="space-toggle" checked/.test(panel.innerHTML));
  const frame = els.get("space");
  check("space shows with the opening globe, loaded from NASA's Eyes", frame.hidden === false && /^https:\/\/eyes\.nasa\.gov\/apps\/solar-system\/#\/earth\?embed=true/.test(frame.src));
  check("on the globe the background stays: it covers only the planet", (map.getLayer("bg").layout || {}).visibility === "visible");
  const change = (t) => panel.fire("change", { target: t });
  change({ name: "view", value: "flat" });
  check("the flat map is mercator, with space off", projections.at(-1) === "mercator" && frame.hidden === true);
  const bgVis = () => (map.getLayer("bg").layout || {}).visibility;
  check("the dark background returns without space", bgVis() === "visible");
  change({ id: "space-toggle", checked: true });
  check("space can be ticked on over the flat map, clearing the background there", frame.hidden === false && bgVis() === "none");
  change({ name: "view", value: "globe" });
  check("the globe view stays a globe at every zoom", projections.at(-1) === "vertical-perspective");
  change({ name: "view", value: "globe-flat" });
  check("globe to flat uses MapLibre's own transition", projections.at(-1) === "globe");
}
''')

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
print("Globe views and space behind the map added; MapLibre 5; tests updated.")
