#!/usr/bin/env python3
"""Round cap1w (19 October 2026): Planted, bought or captured keeps only
cases of capture; what is not moves to four views of its own.

The owner asked (19 October) whether the layer's entries were accurate,
giving XinMin International, Inc.: a registration under the US Foreign
Agents Registration Act for the Xinmin Evening News, not a case of anyone
planted, bought or captured. An audit found most of the layer's points were
like it: every FARA registration, the whole UK government sanctions list
(labelled as a development bank's debarments), the development banks'
debarments, and most of the Polish IPN entries (records of people the
security services watched, vetted, interned or meant to recruit, read as
collaborators because the records mention collaborators).

The tiles patch roundcap1w_tiles.py (culprits-tiles-more) sorts the files.
This patch, on the map:
  - four new views in the menu under the Planted, bought or captured row,
    each reading its own new file: FARA registrations, the UK sanctions list,
    development banks' debarments, and IPN entries without collaboration;
  - the case-by-case view's note says what it keeps and what moved;
  - the capture box shows how its record was sorted and, for IPN, the
    sentence of the record the reading rests on.

From the separate "w" chat. Each change is found by text that appears once,
so it applies before or after other chats' rounds. Stops cleanly, changing
nothing, if already applied or if a place it looks for is missing. Upload
the tiles patch first (or together): until it has run, the four new views
have no files to read.

Upload to WelcomeToYourGalaxy/culprits, folder patches/.
"""
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
ROOT = here.parent if here.name == "patches" else (here.parent.parent if here.name == "failed" else pathlib.Path.cwd())
APP, TEST, HANDOFF = ROOT / "map" / "app.js", ROOT / "map" / "test.mjs", ROOT / "HANDOFF.md"
for f in (APP, TEST, HANDOFF):
    if not f.exists():
        sys.exit(f"roundcap1w: {f} not found. Run this from the culprits folder.")
app, test, handoff = (f.read_text(encoding="utf-8") for f in (APP, TEST, HANDOFF))

if "## Round cap1w" in handoff:
    print("roundcap1w: already applied; nothing to do.")
    sys.exit(0)


def once(text, old, new, where):
    n = text.count(old)
    if n != 1:
        sys.exit(f"roundcap1w: {where}: expected the text once, found it {n} times. Nothing was changed.")
    return text.replace(old, new)


TILES = "https://welcometoyourgalaxy.github.io/culprits-tiles-more/capture/"

# ---- the switch row: four more views --------------------------------------
app = once(app, '''["capture_share", "Lawmakers found, per 100 seats in today's legislature"]],''',
           '''["capture_share", "Lawmakers found, per 100 seats in today's legislature"],
        ["capture_fara", "Not capture: registered US foreign agents (FARA)"], ["capture_uk_sanctions", "Not capture: the UK sanctions list"],
        ["capture_debarments", "Not capture: firms barred by development banks"], ["capture_ipn_watched", "Not capture: Polish office holders the secret police watched or meant to recruit (IPN)"]],''',
           "capture_all's parts")
app = once(app, '''note: "One row for the three views of the same cases (scripts/capture.py): each case at its place, the cases counted country by country, and the lawmakers found for every 100 seats in each legislature today. Pick one in the menu under the row." },''',
           '''note: "One row for the views of the same cases (scripts/capture.py): each case at its place, the cases counted country by country, and the lawmakers found for every 100 seats in each legislature today. Four more views hold records that are not cases of capture, moved off the layer after a check on 19 October 2026: registrations under the US Foreign Agents Registration Act, the UK government's sanctions list, development banks' debarments, and Polish office holders whose IPN records show them watched, vetted, interned or a candidate for recruitment, not registered as collaborators. Each box says how its record was sorted. Pick one in the menu under the row." },''',
           "capture_all's note")

# ---- the case-by-case view's note -----------------------------------------
app = once(app, '''development banks' lists of firms barred for fraud or corruption (World Bank and others, OpenSanctions copies, CC BY-NC 4.0), marked as the banks' own findings; every foreign principal registered under the US Foreign Agents Registration Act, at the principal's country's capital, marked as a registered tie, not a crime; Slovakia's''',
           '''Slovakia's''', "capture_cases note, FARA and debarments")
app = once(app, '''and Poland's IPN catalogue of people in public office, read a slice a day, keeping every entry whose records show registration as a collaborator or contact, a lustration court ruling, or registration as a candidate (marked as not proven).''',
           '''and Poland's IPN catalogue of people in public office, read a slice a day, keeping the entries whose own records say the person was registered, recruited or signed on as a secret collaborator or contact, list a collaborator's file in their name, or give a lustration court's ruling that their declaration was untrue (read in Polish, sentence by sentence: a recruitment that was only tried, planned or refused, or that was of someone else, does not count). Checked on 19 October 2026: registrations under the US Foreign Agents Registration Act, the UK government's sanctions list, development banks' debarments, and IPN entries of people the security services watched, vetted, interned or meant to recruit are not cases of capture, so they are views of their own in the menu under the row; each box says how its record was sorted.''',
           "capture_cases note, IPN")

# ---- the four new views ---------------------------------------------------
ROWS = '''
    // Round cap1w: records that are not cases of capture, moved off the layer (19 October 2026).
    { id: "capture_fara", name: "Foreign governments, parties and companies paying someone in the US to lobby, advise or publicise for them (FARA registrations)", unit: "registrations", colour: "#6A7F9A", route: "geojsonlive", ready: true, lazy: true, buildScript: "capture", card: "capture",
      files: [{ label: "FARA registrations", url: "''' + TILES + '''fara.geojson" }], nameFrom: ["name"],
      note: "Every foreign principal registered under the US Foreign Agents Registration Act since 1942 (US Justice Department bulk data, public domain), at the capital of the country the register gives, with who represents it in the US and when. A registration is legal and public: it records that a person or firm in the US is paid to lobby, advise or do public relations for a foreign government, party or company. It is not a finding that anyone was planted, bought or captured, so it is not on the case-by-case view. Moved off it on 19 October 2026." },
    { id: "capture_uk_sanctions", name: "People, companies and others on the UK government's sanctions list (OpenSanctions copy)", unit: "entries", colour: "#7D6A8A", route: "geojsonlive", ready: true, lazy: true, buildScript: "capture", card: "capture",
      files: [{ label: "UK sanctions list", url: "''' + TILES + '''uk_sanctions.geojson" }], nameFrom: ["name"],
      note: "Every entry of the UK Foreign, Commonwealth and Development Office's sanctions list, as OpenSanctions copies it (CC BY-NC 4.0), at the capital of the country the list gives, each box giving the reason the list gives. It came into the capture layer with the development banks' debarment lists, because the office's name has Development in it, and was labelled as fraud found by an official inquiry; it is neither. A sanctions designation is a UK government decision under its sanctions regimes (Russia, Belarus, Iran, North Korea, terrorism and others), not a court ruling and not a finding that anyone was captured. Moved off the case-by-case view on 19 October 2026." },
    { id: "capture_debarments", name: "Firms barred by the World Bank, African Development Bank and EBRD for fraud, corruption, collusion or coercion in projects they financed", unit: "firms and people", colour: "#8A6A72", route: "geojsonlive", ready: true, lazy: true, buildScript: "capture", card: "capture",
      files: [{ label: "Development bank debarments", url: "''' + TILES + '''debarments.geojson" }], nameFrom: ["name"],
      note: "Every firm and person these development banks barred for fraud or corruption (or collusion, coercion and the like) from the projects they finance, as OpenSanctions copies them (CC BY-NC 4.0), at the capital of the country the list gives, each with the bank's grounds and dates. These are the banks' own findings against firms that broke their rules on a project, not officials working for someone else, so they are not on the case-by-case view. Moved off it on 19 October 2026." },
    { id: "capture_ipn_watched", name: "Polish office holders the communist secret police watched, interned, prosecuted or meant to recruit (IPN catalogue)", unit: "people", colour: "#6A8A86", route: "geojsonlive", ready: true, lazy: true, buildScript: "capture", card: "capture",
      files: [{ label: "IPN entries without collaboration", url: "''' + TILES + '''ipn_watched.geojson" }], nameFrom: ["name"],
      note: "Entries of the Institute of National Remembrance's catalogue of people holding public office whose own records show surveillance, internment, prosecution, warning talks, vetting, or registration as a candidate the secret police meant to recruit (many refused or were dropped), and none showing that they were registered or recruited as collaborators. They were on the case-by-case view because their records mention collaborators, mostly ones who informed on them. Each box gives how the record was sorted and the sentence of the record the reading rests on, in Polish. Moved off the case-by-case view on 19 October 2026." },'''
i = app.find('{ id: "capture_share",')
if i < 0 or app.count('{ id: "capture_share",') != 1:
    sys.exit("roundcap1w: the capture_share row not found once. Nothing was changed.")
j = app.find('" },\n', app.find('\n      note: "', i))
if j < 0:
    sys.exit("roundcap1w: the end of the capture_share row not found. Nothing was changed.")
app = app[:j + 4] + ROWS.lstrip("\n") + "\n" + app[j + 4:]

# ---- hidden from the panel as views of capture_all, and tagged like them --
app = once(app, '''  "capture_cases", "capture_countries", "capture_share",
''', '''  "capture_cases", "capture_countries", "capture_share",
  // Round cap1w: the four views of records that are not cases of capture.
  "capture_fara", "capture_uk_sanctions", "capture_debarments", "capture_ipn_watched",
''', "the views of capture_all hidden from the panel")
app = once(app, '''  capture_countries: ["human", "upstream"], capture_share: ["human", "upstream"],
''', '''  capture_countries: ["human", "upstream"], capture_share: ["human", "upstream"],
  capture_fara: ["human", "upstream"], capture_uk_sanctions: ["human", "upstream"], capture_debarments: ["human", "upstream"], capture_ipn_watched: ["human", "upstream"],
''', "the capture rows' tags")

# ---- the box: how the record was sorted -----------------------------------
app = once(app, '''      (p.summary ? `<p style="margin:6px 0">${escapeHtml(p.summary)}</p>` : "") +
      (p["placed at"] ? `<div class="meta">Placed at ${escapeHtml(p["placed at"])}.</div>` : "") +''',
           '''      (p.summary ? `<p style="margin:6px 0">${escapeHtml(p.summary)}</p>` : "") +
      // Round cap1w: how the record was sorted, and the words of an IPN record it rests on.
      (p["how it was sorted"] ? `<p class="meta" style="margin:4px 0 6px">${escapeHtml(p["how it was sorted"])}` +
        `${p["the words it rests on (IPN)"] ? ` The record says: \\u201c${escapeHtml(p["the words it rests on (IPN)"])}\\u201d` : ""}</p>` : "") +
      (p["placed at"] ? `<div class="meta">Placed at ${escapeHtml(p["placed at"])}.</div>` : "") +''', "the capture card")
app = once(app, '''      everyField(p, ["summary", "name", "part"]) + `</div>`;
  },
  bank(p, name, cfg) {''', '''      everyField(p, ["summary", "name", "part", "how it was sorted", "the words it rests on (IPN)"]) + `</div>`;
  },
  bank(p, name, cfg) {''', "the capture card's fields")

# ---- tests -----------------------------------------------------------------
TESTS = r'''console.log("\nround cap1w (19 October): Planted, bought or captured keeps only cases of capture");
{
  const src = fs.readFileSync(path.join(HERE, "app.js"), "utf8");
  const ids = ["capture_fara", "capture_uk_sanctions", "capture_debarments", "capture_ipn_watched"];
  const files = { capture_fara: "fara", capture_uk_sanctions: "uk_sanctions", capture_debarments: "debarments", capture_ipn_watched: "ipn_watched" };
  const parts = (src.match(/\{ id: "capture_all",[\s\S]*?parts: \[([\s\S]*?)\]\],\n/) || [])[1] || "";
  check("the four new views are parts of the Planted, bought or captured row", ids.every((id) => parts.includes(`["${id}", "Not capture: `)));
  check("each reads its own file from the capture folder with the capture box",
    ids.every((id) => new RegExp(`\\{ id: "${id}", [^\\n]*route: "geojsonlive"[^\\n]*card: "capture",\\n\\s*files: \\[\\{ label: "[^"]+", url: "https://welcometoyourgalaxy\\.github\\.io/culprits-tiles-more/capture/${files[id]}\\.geojson" \\}\\]`).test(src)));
  check("each is hidden from the panel as a view, once", ids.every((id) => (src.match(new RegExp(`"${id}"`, "g")) || []).length === 3));
  const note = (src.match(/\{ id: "capture_cases",[\s\S]*?note: "([^"]*)" \}/) || [])[1] || "";
  check("the case-by-case note no longer says FARA registrations and debarments are drawn there, or that IPN candidates are kept",
    !/every foreign principal registered under the US Foreign Agents Registration Act, at the principal/.test(note) && !/or registration as a candidate \(marked as not proven\)/.test(note) &&
    /are not cases of capture, so they are views of their own in the menu under the row/.test(note));
  check("the box shows how a record was sorted and the IPN words it rests on", /p\["how it was sorted"\] \? `<p class="meta"/.test(src) && /The record says: \\u201c\$\{escapeHtml\(p\["the words it rests on \(IPN\)"\]\)\}/.test(src));
}

'''
# round 113c's test names the box's field list as it was; it now also leaves out the two sorting fields shown above them
OLDT = r'/everyField\(p, \["summary", "name", "part"\]\)/.test(src)'
NEWT = r'/everyField\(p, \["summary", "name", "part"(, "how it was sorted", "the words it rests on \(IPN\)")?\]\)/.test(src)'
test = once(test, OLDT, NEWT, "round 113c's test of the capture box")
anchor = 'console.log("\\nround 225r (19 October): Reproduction capture in the Biodiversity Intactness colours");\n'
if test.count(anchor) == 1:
    test = test.replace(anchor, TESTS + anchor)
else:
    k = test.find('console.log("\\nround ')
    if k < 0:
        sys.exit("roundcap1w: no round test block found in map/test.mjs. Nothing was changed.")
    test = test[:k] + TESTS + test[k:]

NOTE = '''## Round cap1w (19 October)

From the separate "w" chat (the Wars, militaries and weapons standalone
map). Needs nothing else. Tiles patch roundcap1w_tiles.py beside it. No
app.js?v= bump.

- Owner, 19 October: asked whether the Planted, bought or captured entries
  were accurate (XinMin International, Inc. is a FARA registration, not
  capture), and to check, confirm and fix. Audit (project doc
  claude/capture-layer-audit-2026-10-19.md): of 34,900 points, 17,769 were
  FARA registrations, 6,954 the UK sanctions list (filed with the
  development banks' debarments because "Foreign, Commonwealth & Development
  Office" has Development in it), 3,980 development bank debarments, and
  2,907 of 3,358 IPN entries showed people watched, vetted, interned or
  meant to recruit, not collaborators.
- Tiles: scripts/capture.py sorts each build (sort_cases, ipn_reading): the
  moved records go to capture/fara.geojson, uk_sanctions.geojson,
  debarments.geojson and ipn_watched.geojson, each with "how it was
  sorted" (and, for IPN, "the words it rests on (IPN)"); cases.geojson keeps
  the rest (3,714) and by_country.json is counted from them.
- Map: four "Not capture:" views in capture_all's menu (capture_fara,
  capture_uk_sanctions, capture_debarments, capture_ipn_watched), hidden
  from the panel like the other views; the case-by-case note rewritten; the
  capture card shows how a record was sorted.

'''
k = handoff.find("\n## Round ")
if k < 0:
    sys.exit("roundcap1w: no round heading found in HANDOFF.md. Nothing was changed.")
handoff = handoff[:k + 1] + NOTE + handoff[k + 1:]

APP.write_text(app, encoding="utf-8")
TEST.write_text(test, encoding="utf-8")
HANDOFF.write_text(handoff, encoding="utf-8")
print("roundcap1w: applied: four views of records that are not capture, the case-by-case note, and the capture box.")
