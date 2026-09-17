#!/usr/bin/env python3
"""
The wires box made plainer, and the map's own boxes out of Eyes' way.

- In Eyes, the map's three boxes on the left stayed on screen. They go now,
  with the legend and the wires box.
- The wires box:
    * Subjects is a drop-down with a caret, one list of all 33 wires rather
      than two groups, with "Select all" and "Clear all".
    * One drop-down per filter — Topic, Region, Who reports it, Type, Language
      — instead of a block of them per subject. When several subjects are
      ticked, each drop-down lists its options under the subject they belong
      to.
    * The per-subject line ("379 of 626 stories, harvested 2 h ago, 1 filter
      set") is gone. A subject that could not be read still says so.
    * Refresh clears the filters as well as re-reading the wires.
    * The tick box reads "show them on the map".
    * The box opens and closes on its caret; the drag grip is gone from it.
- The stories on the map are drawn as rings sized by how many are at that
  place, rather than icon diamonds, which did not always load.
- "Leave Earth" is a tall button beside the two view choices, not under them.

Edits map/app.js, map/index.html, map/wire.js and map/test.mjs.

Run from the repo root:  python3 patch_wirebox.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
APP, TEST, INDEX, WIRE = (ROOT / "map" / n for n in ("app.js", "test.mjs", "index.html", "wire.js"))
app, test, index, wire = (p.read_text(encoding="utf-8") for p in (APP, TEST, INDEX, WIRE))

if "wire-subjects" in wire:
    sys.exit("wire.js already has the plainer box — nothing to do.")


def once(text, old, new, where):
    if text.count(old) != 1:
        sys.exit(f"Could not find the expected text in {where} ({old.strip()[:70]!r}). Nothing was written.")
    return text.replace(old, new)


# ---------------------------------------------------------------- the map's boxes leave the screen

app = once(app, '  for (const sel of [".panel", "#legend", ".wire"]) {',
           '  for (const sel of [".left-col", "#legend", ".wire"]) {', "map/app.js")

# ---------------------------------------------------------------- Leave Earth, beside the views

app = once(app, """function viewPanelHtml() {
  return `<p class="bm-h">View</p>` + Object.entries(VIEWS).map(([k, v]) =>
    `<label class="layer"><input type="radio" name="view" value="${k}"${k === VIEW ? " checked" : ""}>` +
    `<span class="nm">${v.nm}</span></label>`).join("") +
    `<button type="button" id="leave-earth" class="leave" title="Hands the screen to NASA's Eyes on ` +
    `the Solar System. A bar at the top brings the map back.">Leave Earth &#8594;</button>` +
    `<p class="bm-h">Basemap</p>`;
}""", """function viewPanelHtml() {
  return `<p class="bm-h">View</p><div class="view-row"><div class="view-choices">` +
    Object.entries(VIEWS).map(([k, v]) =>
      `<label class="layer"><input type="radio" name="view" value="${k}"${k === VIEW ? " checked" : ""}>` +
      `<span class="nm">${v.nm}</span></label>`).join("") +
    `</div><button type="button" id="leave-earth" class="leave" title="Hands the screen to NASA's Eyes ` +
    `on the Solar System. A box in the corner brings the map back.">Leave<br>Earth &#8594;</button></div>` +
    `<p class="bm-h">Basemap</p>`;
}""", "map/app.js")

index = once(index, """  .ctrl-box .leave{margin:6px 0 2px;font:inherit;font-size:12.5px;color:var(--bone);background:none;
    border:1px solid var(--rule);border-radius:3px;padding:3px 9px;cursor:pointer}""",
             """  .view-row{display:flex;align-items:stretch;gap:9px}
  .view-choices{flex:1;min-width:0}
  .ctrl-box .leave{flex:0 0 auto;align-self:stretch;font:inherit;font-size:13px;line-height:1.25;
    color:var(--bone);background:none;border:1px solid var(--rule);border-radius:3px;
    padding:6px 12px;cursor:pointer}""", "map/index.html")

# ---------------------------------------------------------------- rings, not icons

app = once(app, """      id: "wire-news", type: "symbol", source: "wire-news",
      layout: { "icon-image": "wire-mark", "icon-allow-overlap": true,
                "icon-size": ["interpolate", ["linear"], ["get", "n"], 1, 1.05, 12, 1.9] },
    });""", """      id: "wire-news", type: "circle", source: "wire-news",
      paint: {
        // A ring, not a disc: nothing else on this map is hollow and pale, so
        // a story never reads as a site. It grows with how many are there.
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": WIRE_COLOUR,
        "circle-stroke-width": 1.4,
        "circle-radius": ["interpolate", ["linear"], ["zoom"],
          1, ["interpolate", ["linear"], ["get", "n"], 1, 4, 25, 9],
          8, ["interpolate", ["linear"], ["get", "n"], 1, 6, 25, 15]],
      },
    });""", "map/app.js")

app = once(app, """    const img = wireDiamond();
    if (img && map.addImage && !map.hasImage?.("wire-mark")) {
      try { map.addImage("wire-mark", img, { pixelRatio: 2 }); } catch (e) { /* already there */ }
    }
""", "", "map/app.js")

start = app.index("function wireDiamond() {")
end = app.index("async function countryCentres() {")
app = app[:start] + app[end:]

# ---------------------------------------------------------------- the wires box is not dragged

app = once(app, """  let tries = 0;
  const wireLater = () => {
    const w = document.getElementById("wire");
    if (w) { makePullable(w, "top"); return; }
    if (++tries < 25 && typeof setTimeout === "function") setTimeout(wireLater, 300);
  };
  wireLater();""", """  // The wires box is not dragged: it opens and closes on its own caret.""", "map/app.js")

# ---------------------------------------------------------------- wire.js

wire = once(wire, """        '<input type="checkbox" id="wireOnMap" checked> on the map</label>' +""",
            """        '<input type="checkbox" id="wireOnMap" checked> show them on the map</label>' +""", "map/wire.js")

wire = once(wire, """        '<button type="button" class="wire-btn" id="wirePickBtn" aria-expanded="false" aria-controls="wirePicker">Subjects</button>' +""",
            """        '<button type="button" class="wire-btn wire-subjects" id="wirePickBtn" aria-expanded="false" aria-controls="wirePicker">' +
          '<span class="wire-caret" aria-hidden="true"></span><span id="wirePickLabel">Subjects</span></button>' +""",
            "map/wire.js")

wire = once(wire, """.wire-tools #wirePickBtn{width:100%;text-align:center;font-size:13px;padding:4px 8px}""",
""".wire-tools #wirePickBtn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
  font-size:13px;padding:5px 8px}
.wire.picking .wire-subjects .wire-caret{transform:rotate(90deg)}
.wire-pickbar{display:flex;gap:6px;padding:4px 10px 2px}
.wire-pickbar button{flex:1}
.wire-filter{display:flex;align-items:center;gap:7px;padding:3px 10px;color:var(--dim,#948D7C);font-size:12px}
.wire-filter select{flex:1;min-width:0}
.wire-unread{padding:3px 10px;color:#B98A80;font-size:11.5px}""", "map/wire.js")

wire = once(wire, """  $picker.innerHTML =
    '<p class="wire-group">Topic feeds</p>' + FEEDS.map(row).join('') +
    '<p class="wire-group">Wires inside the maps</p>' + MAPS.map(row).join('');""",
"""  // One list, by name: which repository a wire lives in is not the reader's
  // business, and two headings made it look like two kinds of thing.
  const all = SUBJECTS.slice().sort((a, b) => a.name.localeCompare(b.name));
  $picker.innerHTML =
    '<div class="wire-pickbar">' +
      '<button type="button" class="wire-btn" data-all="1">Select all</button>' +
      '<button type="button" class="wire-btn" data-none="1">Clear all</button>' +
    '</div>' + all.map(row).join('');""", "map/wire.js")

wire = once(wire, """  $pickBtn.addEventListener('click', () => { state.pickerOpen = !state.pickerOpen; renderPicker(); layout(); });""",
"""  $pickBtn.addEventListener('click', () => { state.pickerOpen = !state.pickerOpen; renderPicker(); layout(); });
  $picker.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('button');
    if (!t || !t.dataset) return;
    if (t.dataset.all) { state.picked = SUBJECTS.map((s) => s.id); state.picked.forEach((id) => load(id, false)); }
    else if (t.dataset.none) { state.picked = []; }
    else return;
    state.shown = PAGE;
    save();
    renderData();
  });""", "map/wire.js")

# Refresh re-reads the wires and clears what was filtered.
wire = once(wire, """  $refresh.addEventListener('click', () => state.picked.forEach((id) => load(id, true)));""",
"""  $refresh.addEventListener('click', () => {
    state.sel = {};
    state.shown = PAGE;
    save();
    state.picked.forEach((id) => load(id, true));
    renderData();
  });""", "map/wire.js")

# One drop-down per filter, options grouped by subject. Replaces the per-subject blocks.
s0 = wire.index("function subjectState(id) {")
s1 = wire.index("// The stories now showing, handed to the map.")
wire = wire[:s0] + """function renderFilters(focusId) {
  const active = focusId || (document.activeElement && box.contains(document.activeElement) ? document.activeElement.id : null);
  if (!state.picked.length) { $filters.innerHTML = ''; return; }
  const sh = shared();

  // One row per kind of filter across every ticked subject. A subject that
  // does not publish that field simply has no options under it.
  const kinds = [];
  const unread = [];
  state.picked.forEach((id) => {
    const e = state.wires[id];
    if (!e || !e.wire) {
      if (e && e.status === 'error') unread.push({ id, error: e.error });
      return;
    }
    const sel = state.sel[id] || {};
    e.wire.facets.forEach((f) => {
      let k = kinds.find((x) => x.key === f.key);
      if (!k) kinds.push(k = { key: f.key, label: f.label, subs: [] });
      const opts = optionsFor(e.wire, f, sel, sh);
      if (opts && opts.length) k.subs.push({ id, f, opts, cur: sel[f.key] });
    });
  });

  const many = state.picked.length > 1;
  const rows = kinds.filter((k) => k.subs.length).map((k) => {
    const fid = 'wf-' + k.key;
    const body = k.subs.map(({ id, f, opts, cur }) => {
      const options = opts.map((o) =>
        '<option value="' + esc(id + '|' + o.value) + '"' +
        (cur != null && String(cur) === String(o.value) ? ' selected' : '') + '>' +
        esc(o.label) + ' (' + num(o.count) + ')</option>').join('');
      return many ? '<optgroup label="' + esc(BY_ID[id].name) + '">' + options + '</optgroup>' : options;
    }).join('');
    const set = k.subs.some((s) => s.cur != null);
    return '<label class="wire-filter" for="' + fid + '">' + esc(k.label) +
      '<select id="' + fid + '" data-key="' + k.key + '"' + (set ? ' class="set"' : '') + '>' +
        '<option value="">All</option>' + body +
      '</select></label>';
  }).join('');

  $filters.innerHTML = rows + unread.map((u) =>
    '<p class="wire-unread">' + esc(BY_ID[u.id].name) + ' could not be read (' + esc(String(u.error)) + '). ' +
    '<button type="button" class="wire-btn" data-retry="' + u.id + '">Try again</button></p>').join('');
  if (active) { const el = document.getElementById(active); if (el && $filters.contains(el)) el.focus(); }
}

""" + wire[s1:]

wire = once(wire, """  $filters.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.dataset || !t.dataset.sid) return;
    const id = t.dataset.sid, key = t.dataset.key;
    const entry = state.wires[id];
    if (!entry || !entry.wire) return;
    const f = entry.wire.facets.find((x) => x.key === key);
    const sel = state.sel[id] = state.sel[id] || {};
    if (t.value === '') delete sel[key];
    else sel[key] = f && f.weight ? Number(t.value) : t.value;
    descendants(entry.wire.facets, key).forEach((k) => { delete sel[k]; });
    state.shown = PAGE;
    save();
    renderData(t.id);
  });""", """  $filters.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.dataset || !t.dataset.key) return;
    const key = t.dataset.key;
    // One drop-down stands for every ticked subject: choosing an option sets it
    // for the subject it came from and clears that filter on the others, so a
    // row always says one thing.
    state.picked.forEach((id) => {
      const entry = state.wires[id];
      if (!entry || !entry.wire) return;
      const sel = state.sel[id] = state.sel[id] || {};
      delete sel[key];
      descendants(entry.wire.facets, key).forEach((k) => { delete sel[k]; });
    });
    if (t.value !== '') {
      const cut = t.value.indexOf('|');
      const id = t.value.slice(0, cut), value = t.value.slice(cut + 1);
      const entry = state.wires[id];
      if (entry && entry.wire) {
        const f = entry.wire.facets.find((x) => x.key === key);
        const sel = state.sel[id] = state.sel[id] || {};
        sel[key] = f && f.weight ? Number(value) : value;
      }
    }
    state.shown = PAGE;
    save();
    renderData(t.id);
  });""", "map/wire.js")

wire = once(wire, """  $filters.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('button');
    if (!t) return;
    if (t.dataset.expand) {
      state.expanded[t.dataset.expand] = state.expanded[t.dataset.expand] === false;
      save();
      renderFilters(t.id);
      layout();
    } else if (t.dataset.clear) {
      delete state.sel[t.dataset.clear];
      state.shown = PAGE;
      save();
      renderData();
    } else if (t.dataset.retry) {
      load(t.dataset.retry, true);
    }
  });""", """  $filters.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('button');
    if (t && t.dataset && t.dataset.retry) load(t.dataset.retry, true);
  });""", "map/wire.js")

# ---------------------------------------------------------------- tests

TESTS = r'''
console.log("\nthe wires box, plainer");
{
  const wireSrc = fs.readFileSync(path.join(HERE, "wire.js"), "utf8");
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const index = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  check("the map's boxes leave the screen in Eyes", /\[".left-col", "#legend", ".wire"\]/.test(src));
  check("Leave Earth stands beside the two views", /<div class="view-row"><div class="view-choices">/.test(src) &&
        /\.view-row\{display:flex/.test(index));
  check("one list of subjects, with select all and clear all",
        /SUBJECTS\.slice\(\)\.sort/.test(wireSrc) && !/Topic feeds<\/p>/.test(wireSrc) &&
        /data-all="1">Select all/.test(wireSrc) && /data-none="1">Clear all/.test(wireSrc));
  check("the Subjects button reads as a drop-down", /wire-subjects/.test(wireSrc) &&
        /wire\.picking \.wire-subjects \.wire-caret\{transform:rotate\(90deg\)\}/.test(wireSrc));
  check("one drop-down per filter, options under the subject they came from",
        /const kinds = \[\]/.test(wireSrc) && /<optgroup label="/.test(wireSrc) &&
        /esc\(id \+ '\|' \+ o\.value\)/.test(wireSrc));
  check("the per-subject line of numbers is gone",
        !/filters set/.test(wireSrc) && !/function subjectState/.test(wireSrc) && !/harvested /.test(wireSrc));
  check("refresh clears the filters too", /\$refresh\.addEventListener\('click', \(\) => \{[\s\S]{0,120}state\.sel = \{\}/.test(wireSrc));
  check("the tick box says what it does", /show them on the map</.test(wireSrc));
  check("the wires box is not dragged", !/makePullable\(w, "top"\)/.test(src) && /makePullable\(document\.getElementById\("legend"\), "top"\)/.test(src));
  check("stories are rings, sized by how many are there",
        /id: "wire-news", type: "circle"/.test(src) && /"circle-stroke-color": WIRE_COLOUR/.test(src) &&
        !/wireDiamond/.test(src));
}
'''
test = once(test, 'console.log("\\nlegibility");', TESTS + '\nconsole.log("\\nlegibility");', "map/test.mjs")

# The older checks name the diamonds and the icon layer.
test = test.replace('''  check("the marks are diamonds of their own, not another dot",
        /function wireDiamond/.test(src) && /"icon-image": "wire-mark"/.test(src) && /type: "symbol"/.test(src));''',
'''  check("the marks are rings of their own, not another dot",
        /"circle-stroke-color": WIRE_COLOUR/.test(src) && /"circle-color": "rgba\\(0,0,0,0\\)"/.test(src));''')


# Two older checks describe the box as it was.
test = test.replace('/getElementById\\("wire"\\)/.test(src) &&\n        /\\.pull-grip\\{[^}]*cursor:ns-resize/.test(index));',
                    '/\\.pull-grip\\{[^}]*cursor:ns-resize/.test(index));')
test = test.replace('check("every box gets a grip"', 'check("the panel and the legend get a grip"')
test = test.replace("""  check("each subject's filters open by default", /state\\.expanded\\[id\\] !== false/.test(wireSrc) &&
        /state\\.expanded\\[t\\.dataset\\.expand\\] === false/.test(wireSrc));""",
"""  check("the filters are not folded away at all any more",
        !/state\\.expanded\\[/.test(wireSrc) && /class="wire-filter"/.test(wireSrc));""")

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
WIRE.write_text(wire, encoding="utf-8")
print("Wires box plainer: one subject list, one drop-down per filter; boxes leave the screen in Eyes.")
