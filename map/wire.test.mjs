// Tests for map/wire.js — the reading and filtering, not the drawing.
//
//   node map/wire.test.mjs              small built-in samples of each wire format
//   node map/wire.test.mjs --live       every one of the 33 wires, fetched from GitHub
//   node map/wire.test.mjs --dir PATH   the same, from files named <subject id>.json
//
// What is checked, for every wire: every story in the file is read (none
// dropped); every story has a value in every filter, "Not stated" or "Not
// placed" included; each option's count is exactly what choosing it shows;
// drill-downs only offer places inside their parent; weight counts only fall
// as the minimum rises; and the time windows plus undated stories add up to
// the whole file.

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const W = require(path.join(HERE, "wire.js"));

let failed = 0, passed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; return; }
  failed++;
  console.log("FAIL  " + name + (detail ? "\n      " + detail : ""));
}

const NOW = Date.parse("2026-09-17T00:00:00Z");
const ANY = { q: "", when: "all", now: NOW };

function itemsOf(data) {
  if (Array.isArray(data)) return data;
  return data && Array.isArray(data.items) ? data.items : [];
}

function exercise(id, data) {
  const subject = W.SUBJECTS.find((s) => s.id === id);
  const wire = W.readWire(subject, data);
  const total = itemsOf(data).length;
  const tag = `[${id}]`;

  check(`${tag} every story is read`, wire.stories.length === total, `${wire.stories.length} of ${total}`);
  check(`${tag} no filter hides stories when nothing is set`,
        W.filterStories(wire, {}, ANY).length === total);

  for (const f of wire.facets) {
    if (f.weight) {
      const opts = W.optionsFor(wire, f, {}, ANY);
      let prev = Infinity, fine = true;
      for (const o of opts) {
        if (o.count > prev) fine = false;
        prev = o.count;
        const shown = W.filterStories(wire, { [f.key]: o.value }, ANY).length;
        if (shown !== o.count) check(`${tag} weight ${o.value} count matches`, false, `${o.count} listed, ${shown} shown`);
      }
      check(`${tag} weight counts fall as the minimum rises`, fine);
      continue;
    }
    if (f.parent) continue;   // drill-downs are checked under their parent

    const opts = W.optionsFor(wire, f, {}, ANY);
    check(`${tag} ${f.key}: every story carries a value`,
          wire.stories.every((s) => (s.v[f.key] || []).length > 0));
    const sum = opts.reduce((a, o) => a + o.count, 0);
    check(`${tag} ${f.key}: options cover every story`, sum >= total, `${sum} across options, ${total} stories`);
    for (const o of opts) {
      const shown = W.filterStories(wire, { [f.key]: o.value }, ANY).length;
      if (shown !== o.count) {
        check(`${tag} ${f.key}=${o.label}: count matches what is shown`, false, `${o.count} listed, ${shown} shown`);
      }
    }

    // One level of drill-down under the first real option, and one under that.
    const child = wire.facets.find((c) => c.parent === f.key);
    const first = opts.find((o) => o.value !== W.NONE);
    if (child && first) {
      check(`${tag} ${child.key} hidden until ${f.key} is chosen`, W.optionsFor(wire, child, {}, ANY) === null);
      const sel = { [f.key]: first.value };
      const copts = W.optionsFor(wire, child, sel, ANY) || [];
      const parentCount = W.filterStories(wire, sel, ANY).length;
      const csum = copts.reduce((a, o) => a + o.count, 0);
      check(`${tag} ${child.key} under ${first.label} covers every story there`, csum >= parentCount,
            `${csum} across options, ${parentCount} stories`);
      if (child.belongs) {
        check(`${tag} ${child.key} under ${first.label} only offers places inside it`,
              copts.every((o) => o.value === W.NONE || child.belongs[o.value] === first.value));
      }
      for (const o of copts) {
        const shown = W.filterStories(wire, Object.assign({}, sel, { [child.key]: o.value }), ANY).length;
        if (shown !== o.count) {
          check(`${tag} ${child.key}=${o.label} count matches`, false, `${o.count} listed, ${shown} shown`);
        }
      }
    }
  }

  const recent = W.filterStories(wire, {}, { q: "", when: "d30", now: NOW }).length;
  const older = W.filterStories(wire, {}, { q: "", when: "older", now: NOW }).length;
  const undated = wire.stories.filter((s) => s.date == null).length;
  check(`${tag} time windows and undated stories add up to the file`, recent + older + undated === total,
        `${recent} + ${older} + ${undated} vs ${total}`);

  return { id, total, filters: wire.facets.map((f) => f.label + (f.parent ? " (under " + f.parent + ")" : "")),
           undated, generated: wire.generated };
}

// ---------------------------------------------------------------------------
// Built-in samples, one per format
// ---------------------------------------------------------------------------

const geo = [
  { id: "africa", label: "Africa", subs: [
    { id: "africa-e", label: "East Africa", places: [{ id: "ke", label: "Kenya" }, { id: "zw", label: "Zimbabwe" }] }] },
  { id: "asia-e", label: "East Asia", subs: [
    { id: "ea-e", label: "China & neighbours", places: [{ id: "cn", label: "China" }] }] }
];

const SAMPLES = {
  conflict: {
    generated: "2026-09-16T23:00:00Z", notable_score: 3, languages: { en: "English", zh: "简体中文" },
    kinds: [{ id: "escalation", label: "Escalation" }, { id: "deescalation", label: "De-escalation" }],
    standings: [{ id: "official", label: "Bodies" }, { id: "press", label: "Press" }],
    topics: [{ id: "strikes", label: "Strikes" }, { id: "law", label: "Law" }], geo,
    items: [
      { t: "A", u: "https://a", o: "Sohu", g: "zh", r: "press", st: "press", k: ["deescalation"], d: NOW - 3600e3,
        w: ["asia-e"], sr: ["ea-e"], pl: ["unlocated"], x: ["law"], p: 1 },
      { t: "B", u: "https://b", o: "UN", g: "en", st: "official", k: ["escalation"], d: NOW - 40 * 864e5,
        w: ["africa", "asia-e"], sr: ["africa-e", "ea-e"], pl: ["ke"], x: ["strikes", "law"], p: 4 },
      { t: "C", u: "https://c", o: "X", st: "press", k: ["escalation"], d: null,
        w: ["unlocated"], sr: ["unlocated"], pl: ["unlocated"], x: [], p: 0 }
    ] },
  space: {
    generated: "2026-09-16T23:00:00Z", languages: { en: "English" },
    regions: ["Trade press", "East Asia"], topics: [{ id: "orbit", label: "Orbit" }, { id: "launch", label: "Launches" }],
    items: [
      { t: "S1", u: "https://s1", o: "o", g: "en", r: "Trade press", k: "news", d: NOW - 1e6, w: "Google News", pn: "United States", x: ["orbit"] },
      { t: "S2", u: "https://s2", o: "o", g: "ja", r: "East Asia", k: "watchdog", d: NOW - 2e6, w: "Google News", pn: null, x: ["launch"] }
    ] },
  capture: [
    { title: "T1", link: "https://1", date: "2026-09-16T16:26:39Z", source: "Infobae", iso: "MEX", country: "Mexico",
      region: "Americas", subregion: "Central America", subs: "Central America", snippet: "s", lang: "es", sig: 12, why: "capture", v: 2 },
    { title: "T2", link: "https://2", date: "2026-09-16T10:00:00Z", source: "OCCRP", iso: "ESP", country: "Spain",
      region: "Europe", subregion: "Southern Europe", subs: "Southern Europe", snippet: "", lang: "en", sig: 14, why: "role+outcome", v: 2 },
    { title: "T3", link: "https://3", date: "2026-09-15T10:00:00Z", source: "X", iso: "", country: "",
      region: "", subregion: "", subs: "", snippet: "", lang: "en", sig: 9, why: "capture", v: 2 }
  ],
  gmo: [
    { name: "한국", title: "G1", link: "https://g1", date: "2026-09-16T21:02:27+00:00", snippet: "<a href=\"x\">G1</a>&nbsp;<font>crisp</font>", iso: "", region: "", lang: "ko", sig: 0 },
    { name: "France", title: "G2", link: "https://g2", date: "2026-09-16T13:59:13+00:00", snippet: "", iso: "USA", region: "Massachusetts", lang: "fr", sig: 0 },
    { name: "France", title: "G3", link: "https://g3", date: "2026-09-10T13:59:13+00:00", snippet: "", iso: "USA", region: "", lang: "fr", sig: 0 }
  ],
  executive: [
    { name: "Rappler", title: "E1", link: "https://e1", date: NOW - 1e6, sig: 3 },
    { name: "Just Security", title: "E2", link: "https://e2", date: NOW - 2e6, sig: 7 }
  ],
  legal: []
};

async function fetchWire(s) {
  const url = `https://raw.githubusercontent.com/${W.ORG}/${s.repo}/main/${s.file}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

const args = process.argv.slice(2);
const dirAt = args.indexOf("--dir");
const report = [];

if (args.includes("--live") || dirAt !== -1) {
  for (const s of W.SUBJECTS) {
    let data;
    try {
      data = dirAt !== -1 ? JSON.parse(fs.readFileSync(path.join(args[dirAt + 1], s.id + ".json"), "utf8"))
                          : await fetchWire(s);
    } catch (e) {
      check(`[${s.id}] wire can be read`, false, e.message);
      continue;
    }
    report.push(exercise(s.id, data));
  }
  console.log("\nsubject          stories  undated  filters");
  for (const r of report) {
    console.log(r.id.padEnd(16) + String(r.total).padStart(8) + String(r.undated).padStart(9) + "  " + r.filters.join(", "));
  }
} else {
  for (const [id, data] of Object.entries(SAMPLES)) report.push(exercise(id, data));

  // Specific behaviour on the samples.
  const c = W.readWire("conflict", SAMPLES.conflict);
  const lang = c.facets.find((f) => f.key === "lang");
  const langOpts = W.optionsFor(c, lang, {}, ANY);
  check("a story with no language is offered as Not stated",
        langOpts.some((o) => o.value === W.NONE && o.label === "Not stated" && o.count === 1));
  check("languages use the wire's own names", langOpts.some((o) => o.label === "简体中文"));
  const kind = c.facets.find((f) => f.key === "kind");
  check("conflict's kinds row is called Direction, as on its own page", kind && kind.label === "Direction");
  const within = c.facets.find((f) => f.key === "within");
  const inAfrica = W.optionsFor(c, within, { region: "africa" }, ANY);
  check("a story in two regions only counts its East Africa place under Africa",
        inAfrica.length === 1 && inAfrica[0].value === "africa-e" && inAfrica[0].count === 1);
  const weight = c.facets.find((f) => f.key === "weight");
  check("the wire's notable mark is named on its option",
        W.optionsFor(c, weight, {}, ANY).some((o) => /notable mark/.test(o.label) && o.value === 3));
  check("the score is named for what it counts", weight.label === "Substance score" &&
        W.optionsFor(c, weight, {}, ANY).some((o) => /^At least \d+ points?\b/.test(o.label)));
  check("unplaced stories read as Not placed", c.stories[2].place === null &&
        W.optionsFor(c, c.facets.find((f) => f.key === "region"), {}, ANY).some((o) => o.label === "Not placed"));
  check("search runs over title and outlet", W.filterStories(c, {}, { q: "sohu", when: "all", now: NOW }).length === 1);

  {
    // The feeds file the United States under Within and split it into parts below
    // that, so the old Place filter never offered it. Country does.
    const us = W.readWire("conflict", { generated: "2026-09-21T00:00:00Z",
      geo: [{ id: "americas-n", label: "North America", subs: [{ id: "na-us", label: "United States", places: [{ id: "us-sw", label: "Southwest" }, { id: "us-ak", label: "Alaska" }] }] },
            { id: "africa", label: "Africa", subs: [{ id: "africa-e", label: "East Africa", places: [{ id: "ke", label: "Kenya" }, { id: "horn", label: "Horn of Africa" }] }] }],
      items: [{ t: "a", u: "u1", w: ["americas-n"], sr: ["na-us"], pl: ["us-sw"] }, { t: "b", u: "u2", w: ["americas-n"], sr: ["na-us"], pl: [] },
              { t: "c", u: "u3", w: ["africa"], sr: ["africa-e"], pl: ["ke", "horn"] }, { t: "d", u: "u4", w: [], sr: [], pl: [] }] });
    const cf = us.facets.find((f) => f.key === "country");
    const labels = W.optionsFor(us, cf, {}, ANY).map((o) => `${o.label}=${o.count}`);
    check("feeds carry one flat Country filter and no Place", !!cf && !cf.parent && !us.facets.some((f) => f.key === "place"));
    check("\u2026the United States is in it, counting a story tagged only at the Within level", labels.includes("United States=2"), labels.join(" | "));
    check("\u2026a part of a country is its own option beside it, and a place that is no country keeps its own name",
          labels.includes("United States: Southwest=1") && labels.includes("Kenya=1") && labels.includes("Horn of Africa=1") && labels.includes("Not placed=1"), labels.join(" | "));
  }
  const sp = W.readWire("space", SAMPLES.space);
  // Superseded on 21 September: Place is gone; every subject carries one flat Country filter.
  check("space has no region tree; its place names are filed under Country",
        sp.facets.some((f) => f.key === "country" && !f.parent) && !sp.facets.some((f) => f.key === "place") && !sp.facets.some((f) => f.key === "region"));
  check("space's news/watchdog split appears as Type", sp.facets.some((f) => f.key === "kind" && f.label === "Type"));

  const cap = W.readWire("capture", SAMPLES.capture);
  const country = cap.facets.find((f) => f.key === "country");
  check("capture's Country is offered at once, not only after a Region and a Within are chosen",
        !country.parent && cap.facets.find((f) => f.key === "within").parent === "region" &&
        W.optionsFor(cap, country, {}, ANY).some((o) => o.label === "Mexico"));
  const capC = W.optionsFor(cap, country, { region: "Americas", within: "Central America" }, ANY);
  check("three-letter country codes are named", capC.length === 1 && capC[0].label === "Mexico");

  const g = W.readWire("gmo", SAMPLES.gmo);
  check("HTML in snippets is reduced to text", g.stories[0].snippet === "G1 crisp");
  check("a filter where every story is the same is not offered (all weights are 0)",
        !g.facets.some((f) => f.weight));
  check("an empty country code is Not placed",
        W.optionsFor(g, g.facets.find((f) => f.key === "country"), {}, ANY).some((o) => o.value === W.NONE && o.count === 1));

  const legal = W.readWire("legal", SAMPLES.legal);
  check("an empty wire reads as empty, not as an error", legal.stories.length === 0);

  check("33 subjects, 23 feeds and 10 map wires",
        W.SUBJECTS.length === 33 && W.FEEDS.length === 23 && W.MAPS.length === 10);
  check("subject ids are unique", new Set(W.SUBJECTS.map((s) => s.id)).size === 33);
}

{
  const src = fs.readFileSync(new URL('./wire.js', import.meta.url), 'utf8');
  check("the score and the feeds' bookkeeping are not offered as filters",
        /const HIDDEN_ROWS = new Set\(\['Substance score', 'Direction', 'Why it was kept', 'Search feed', 'Search widened to', 'Within'\]\)/.test(src));
  // Two place filters, Region and Country; Within is kept for the place lines but is no row (21 September).
  check("Region then Country, and no other place row", /ROW_ORDER = \['Topic', 'Region', 'Country', 'Who reports it'/.test(src));
  check("a Source filter names each story's outlet", /facet\('outlet', 'News source'/.test(src));
  check("the line beside the title is gone", /\.wire-sum\{display:none\}/.test(src));
}

{
  // A filter row is one choice across every ticked subject, kept by its label.
  const fs2 = (key, labels) => ({ key, label: key, labels, none: "Not placed" });
  const food = { facets: [fs2("region", { af: "Africa", eu: "Europe" })],
    stories: [{ v: { region: ["af"] } }, { v: { region: ["eu"] } }] };
  const police = { facets: [fs2("region", { AFR: "Africa" })], stories: [{ v: { region: ["AFR"] } }, { v: { region: ["__none__"] } }] };
  const space = { facets: [], stories: [{ v: {} }] };
  const cross = { region: "Africa" };
  const a = W.selFromCross(food, cross), b = W.selFromCross(police, cross), c = W.selFromCross(space, cross);
  check("choosing Africa filters each subject to its own value labelled Africa", a.region === "af" && b.region === "AFR");
  check("a subject with no region at all shows nothing under a region filter", !!(c.__blocked && c.__blocked.region));
  const euOnly = { facets: [fs2("region", { eu: "Europe" })], stories: [{ v: { region: ["eu"] } }] };
  check("a subject without that value shows nothing", W.selFromCross(euOnly, cross).region === W.NO_MATCH);
  const allEnglish = { facets: [], stories: [{ v: { lang: ["en"] } }] };
  check("a subject whose every story is in the chosen language is kept", !W.selFromCross(allEnglish, { lang: W.languageName("en") }).__blocked);
}

{
  // Topics: as many as wanted, chosen per subject (24 September).
  const tf = (labels) => ({ key: "topic", label: "Topic", labels, none: "Not stated" });
  const food = { facets: [tf({ fi: "Fishing", fo: "Forests", mi: "Mining" })],
    stories: [{ v: { topic: ["fi"] } }, { v: { topic: ["fo"] } }, { v: { topic: ["mi"] } }, { v: { topic: ["fi", "mi"] } }] };
  const police = { facets: [tf({ ar: "Arrests" })], stories: [{ v: { topic: ["ar"] } }] };
  check("no topic ticked leaves the choice as it was", W.withTopics(food, {}, "food", {}).topic === undefined);
  const two = W.withTopics(food, {}, "food", { food: ["Fishing", "Mining"] });
  check("two topics ticked keep a story carrying either", W.filterStories(food, two, {}).length === 3);
  check("a topic list of one still filters", W.filterStories(food, W.withTopics(food, {}, "food", { food: ["Forests"] }), {}).length === 1);
  const other = W.withTopics(police, {}, "police", { food: ["Fishing"] });
  check("a subject with no topic ticked under it shows nothing once any is ticked", W.filterStories(police, other, {}).length === 0);
  const opts = W.optionsFor(food, food.facets[0], two, {});
  check("every topic is still offered, with its count, while some are ticked",
        opts && opts.length === 3 && opts.find((o) => o.label === "Forests").count === 1, JSON.stringify(opts));
}
{
  const src = fs.readFileSync(new URL('./wire.js', import.meta.url), 'utf8');
  check("the topic row is a list to tick, under a heading per subject when there are several",
        /function topicRow\(k, many\)/.test(src) && /const grouped = k\.subs\.length > 1/.test(src) && /wire-topic-subj/.test(src));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
