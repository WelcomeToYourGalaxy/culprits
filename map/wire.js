/* The Culprits — news wire box.
 *
 * A box in the map's bottom-left corner that reads the site's live news wires.
 * You tick which subjects to read. Each ticked subject gets its own filters,
 * built from the fields that subject's wire file actually carries — the wires
 * are not one format, so a filter appears only where its data exists. Search
 * and the time window apply to every ticked subject at once.
 *
 * NOTHING IS DROPPED. A story with no language gets "Not stated"; a story with
 * no place gets "Not placed". Those are options in the filters like any other,
 * and every story in a file is counted in every filter.
 *
 * Kept out of app.js on purpose: parallel sessions edit that file. This one
 * adds its own element and its own styles. It sits in the bottom-right corner,
 * open, directly above the legend ("Showing"), and moves up with the legend as
 * it grows and above the Guerillamap strip when that opens.
 *
 * Loaded by one <script src="./wire.js"> tag (patch_wire_index.py adds it).
 * Under node it loads nothing and exports its reading and filtering functions
 * for map/wire.test.mjs.
 */
(function () {
'use strict';

// ---------------------------------------------------------------------------
// The 33 wires
// ---------------------------------------------------------------------------

const ORG = 'WelcomeToYourGalaxy';

// Topic feeds. All share field names (t, u, o, g, d, x …) but not all fields:
// environment names its sources by group rather than standing, space has no
// region tree, space-life has neither and is the one file not called
// wire_<subject>.json. kindLabel is the name each feed's own page gives its
// `kinds` row.
const FEEDS = [
  { id: 'abortion',       name: 'Abortion',                  repo: 'abortion-feed',       file: 'wire_abortion.json' },
  { id: 'advertising',    name: 'Advertising industries',    repo: 'advertising-feed',    file: 'wire_advertising.json' },
  { id: 'conflict',       name: 'Conflict',                  repo: 'conflict-feed',       file: 'wire_conflict.json', kindLabel: 'Direction' },
  { id: 'resource',       name: 'Control of resources',      repo: 'resource-feed',       file: 'wire_resource.json' },
  { id: 'discrimination', name: 'Discrimination',            repo: 'discrimination-feed', file: 'wire_discrimination.json' },
  { id: 'entertainment',  name: 'Entertainment industries',  repo: 'entertainment-feed',  file: 'wire_entertainment.json' },
  { id: 'environment',    name: 'Environmental destruction', repo: 'environment-feed',    file: 'wire_env.json' },
  { id: 'food',           name: 'Food and drink',            repo: 'food-feed',           file: 'wire_food.json' },
  { id: 'inequality',     name: 'Inequality',                repo: 'inequality-feed',     file: 'wire_inequality.json' },
  { id: 'indigenous',     name: 'Invasion of native peoples', repo: 'indigenous-feed',    file: 'wire_indigenous.json', kindLabel: 'Direction' },
  { id: 'invasion',       name: 'Invasion of non-humans',    repo: 'invasion-feed',       file: 'wire_invasion.json', kindLabel: 'Invasion' },
  { id: 'police',         name: 'Law enforcement',           repo: 'police-feed',         file: 'wire_police.json' },
  { id: 'spacelife',      name: 'Life beyond Earth',         repo: 'space-life-news',     file: 'wire.json' },
  { id: 'lobbying',       name: 'Lobbying',                  repo: 'lobbying-feed',       file: 'wire_lobbying.json' },
  { id: 'medical',        name: 'Medical industry',          repo: 'medical-feed',        file: 'wire_medical.json' },
  { id: 'neo',            name: 'Near-Earth objects',        repo: 'neo-feed',            file: 'wire_neo.json' },
  { id: 'news',           name: 'News industry',             repo: 'news-feed',           file: 'wire_news.json' },
  { id: 'school',         name: 'School',                    repo: 'school-feed',         file: 'wire_school.json' },
  { id: 'science',        name: 'Science',                   repo: 'science-feed',        file: 'wire_science.json' },
  { id: 'space',          name: 'Space',                     repo: 'space-feed',          file: 'wire_space.json' },
  { id: 'sports',         name: 'Sports industry',           repo: 'sports-feed',         file: 'wire_sports.json' },
  { id: 'uap',            name: 'UAP',                       repo: 'uap-feed',            file: 'wire_uap.json' },
  { id: 'voter',          name: 'Voter suppression',         repo: 'voter-feed',          file: 'wire_voter.json' }
];

// Wires inside map repos. Each is a plain list of stories with its own field
// names, so each carries a small description of which field is what.
//   facets: one filter each. `type` sets how values are labelled; `parent`
//           makes it a drill-down that appears once the parent is chosen.
//   weight: the field holding a numeric weight, if any.
//   place:  facet keys, most specific first, used for a story's place label.
// "Search feed" is the harvester's own query or edition name (a country
// edition, a topic search, a named front) — what the wire publishes as `name`
// in those files.
const MAPS = [
  { id: 'capture', name: 'Drug underworld and capture', repo: 'capture', file: 'wire.json', map: {
      outlet: 'source', snippet: 'snippet', weight: 'sig', place: ['country', 'within', 'region'],
      facets: [
        { key: 'why',     label: 'Why it was kept', field: 'why' },
        { key: 'region',  label: 'Region',          field: 'region',    none: 'Not placed' },
        { key: 'within',  label: 'Within',          field: 'subregion', none: 'Not placed', parent: 'region' },
        { key: 'country', label: 'Country',         field: 'iso',       none: 'Not placed', parent: 'within', type: 'country' },
        { key: 'who',     label: 'Who reports it',  field: 'source' },
        { key: 'lang',    label: 'Language',        field: 'lang', type: 'lang' }
      ] } },
  { id: 'gmo', name: 'Genetic engineering', repo: 'GMO-map', file: 'wire.json', map: {
      snippet: 'snippet', weight: 'sig', place: ['within', 'country'],
      facets: [
        { key: 'country', label: 'Country',     field: 'iso',    none: 'Not placed', type: 'country' },
        { key: 'within',  label: 'Within',      field: 'region', none: 'Not placed', parent: 'country' },
        { key: 'feed',    label: 'Search feed', field: 'name' },
        { key: 'lang',    label: 'Language',    field: 'lang', type: 'lang' }
      ] } },
  { id: 'local', name: 'Local projects', repo: 'local-map', file: 'wire.json', map: {
      snippet: 'snippet', weight: 'sig', place: ['within', 'country'],
      facets: [
        { key: 'country',  label: 'Country',           field: 'iso',      none: 'Not placed', type: 'country' },
        { key: 'within',   label: 'Within',            field: 'region',   none: 'Not placed', parent: 'country' },
        { key: 'feed',     label: 'Search feed',       field: 'name' },
        { key: 'widened',  label: 'Search widened to', field: 'widened',  type: 'days' },
        { key: 'lang',     label: 'Language',          field: 'lang', type: 'lang' }
      ] } },
  { id: 'slavery', name: 'Slavery', repo: 'anti-slavery-map', file: 'wire.json', map: {
      snippet: 'snippet', weight: 'sig', place: ['within', 'country'],
      facets: [
        { key: 'feed',    label: 'Search feed', field: 'name' },
        { key: 'country', label: 'Country',     field: 'iso',    none: 'Not placed', type: 'country' },
        { key: 'within',  label: 'Within',      field: 'region', none: 'Not placed', parent: 'country' },
        { key: 'lang',    label: 'Language',    field: 'lang', type: 'lang' }
      ] } },
  { id: 'remains', name: 'Unearthings', repo: 'remains', file: 'wire.json', map: {
      snippet: 'snippet', weight: 'sig', place: ['within', 'country'],
      facets: [
        { key: 'topic',   label: 'Topic',       field: 'topic' },
        { key: 'country', label: 'Country',     field: 'iso',    none: 'Not placed', type: 'country' },
        { key: 'within',  label: 'Within',      field: 'region', none: 'Not placed', parent: 'country' },
        { key: 'feed',    label: 'Search feed', field: 'name' },
        { key: 'lang',    label: 'Language',    field: 'lang', type: 'lang' }
      ] } },
  { id: 'financial', name: 'Money and finance', repo: 'financial-map', file: 'wire_archive.json', map: {
      outlet: 'name', weight: 'sig', place: [],
      facets: [
        { key: 'topic', label: 'Topic',          field: 'cat' },
        { key: 'who',   label: 'Who reports it', field: 'name' }
      ] } },
  { id: 'judicial', name: 'Judicial accountability', repo: 'judicial-map', file: 'wire_archive.json', map: {
      outlet: 'name', snippet: 'desc', weight: 'sig', place: [],
      facets: [ { key: 'who', label: 'Who reports it', field: 'name' } ] } },
  { id: 'legislative', name: 'Legislative accountability', repo: 'legislative-map', file: 'wire_archive.json', map: {
      outlet: 'name', weight: 'sig', place: [],
      facets: [ { key: 'who', label: 'Who reports it', field: 'name' } ] } },
  { id: 'executive', name: 'Executive accountability', repo: 'executive-map', file: 'wire_archive.json', map: {
      outlet: 'name', weight: 'sig', place: [],
      facets: [ { key: 'who', label: 'Who reports it', field: 'name' } ] } },
  { id: 'legal', name: 'Legal defense and prisoner support', repo: 'legal-map', file: 'wire_archive.json', map: {
      outlet: 'name', snippet: 'desc', weight: 'sig', place: [],
      facets: [ { key: 'who', label: 'Who reports it', field: 'name' } ] } }
];

const SUBJECTS = FEEDS.map((s) => Object.assign({ group: 'feed' }, s))
  .concat(MAPS.map((s) => Object.assign({ group: 'map' }, s)));
const BY_ID = {};
SUBJECTS.forEach((s) => { BY_ID[s.id] = s; });

const WINDOWS = [
  { id: 'd1',    label: 'Last 24 hours', ms: 864e5 },
  { id: 'd7',    label: 'Last 7 days',   ms: 7 * 864e5 },
  { id: 'd30',   label: 'Last 30 days',  ms: 30 * 864e5 },
  { id: 'older', label: 'Older than 30 days', ms: 30 * 864e5, older: true },
  { id: 'all',   label: 'Any time',      ms: null }
];

// Stands in for "this story carries no value here". Never a real value.
const NONE = '\u2205';

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

// ISO 3166 alpha-3 to alpha-2, so three-letter codes can be named by the
// browser's own country list (Intl.DisplayNames only takes two letters).
const A3 = (() => {
  const s = 'ABWAWAFGAFAGOAOAIAAIALAAXALBALANDADAREAEARGARARMAMASMASATAAQATFTFATGAGAUSAUAUTATAZEAZBDIBIBELBEBENBJBESBQBFABFBGDBDBGRBGBHRBHBHSBSBIHBABLMBLBLRBYBLZBZBMUBMBOLBOBRABRBRBBBBRNBNBTNBTBVTBVBWABWCAFCFCANCACCKCCCHECHCHLCLCHNCNCIVCICMRCMCODCDCOGCGCOKCKCOLCOCOMKMCPVCVCRICRCUBCUCUWCWCXRCXCYMKYCYPCYCZECZDEUDEDJIDJDMADMDNKDKDOMDODZADZECUECEGYEGERIERESHEHESPESESTEEETHETFINFIFJIFJFLKFKFRAFRFROFOFSMFMGABGAGBRGBGEOGEGGYGGGHAGHGIBGIGINGNGLPGPGMBGMGNBGWGNQGQGRCGRGRDGDGRLGLGTMGTGUFGFGUMGUGUYGYHKGHKHMDHMHNDHNHRVHRHTIHTHUNHUIDNIDIMNIMINDINIOTIOIRLIEIRNIRIRQIQISLISISRILITAITJAMJMJEYJEJORJOJPNJPKAZKZKENKEKGZKGKHMKHKIRKIKNAKNKORKRKWTKWLAOLALBNLBLBRLRLBYLYLCALCLIELILKALKLSOLSLTULTLUXLULVALVMACMOMAFMFMARMAMCOMCMDAMDMDGMGMDVMVMEXMXMHLMHMKDMKMLIMLMLTMTMMRMMMNEMEMNGMNMNPMPMOZMZMRTMRMSRMSMTQMQMUSMUMWIMWMYSMYMYTYTNAMNANCLNCNERNENFKNFNGANGNICNINIUNUNLDNLNORNONPLNPNRUNRNZLNZOMNOMPAKPKPANPAPCNPNPERPEPHLPHPLWPWPNGPGPOLPLPRIPRPRKKPPRTPTPRYPYPSEPSPYFPFQATQAREUREROURORUSRURWARWSAUSASDNSDSENSNSGPSGSGSGSSHNSHSJMSJSLBSBSLESLSLVSVSMRSMSOMSOSPMPMSRBRSSSDSSSTPSTSURSRSVKSKSVNSISWESESWZSZSXMSXSYCSCSYRSYTCATCTCDTDTGOTGTHATHTJKTJTKLTKTKMTMTLSTLTONTOTTOTTTUNTNTURTRTUVTVTWNTWTZATZUGAUGUKRUAUMIUMURYUYUSAUSUZBUZVATVAVCTVCVENVEVGBVGVIRVIVNMVNVUTVUWLFWFWSMWSYEMYEZAFZAZMBZMZWEZW';
  const m = { XKX: 'XK' };
  for (let i = 0; i + 5 <= s.length; i += 5) m[s.slice(i, i + 3)] = s.slice(i + 3, i + 5);
  return m;
})();

let REGION_NAMES = null, LANGUAGE_NAMES = null;
try { REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { /* old browser */ }
try { LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (e) { /* old browser */ }

function countryName(code) {
  const c = String(code).toUpperCase();
  const a2 = c.length === 3 ? A3[c] : c;
  if (a2 && REGION_NAMES) {
    try { const n = REGION_NAMES.of(a2); if (n && n !== a2) return n; } catch (e) { /* not a region code */ }
  }
  return c;   // unknown code: show it as published rather than guess
}

function languageName(code, published) {
  if (published && published[code]) return published[code];
  if (LANGUAGE_NAMES && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(code)) {
    try { const n = LANGUAGE_NAMES.of(code); if (n && n !== code) return n; } catch (e) { /* not a language code */ }
  }
  return code;   // local-map publishes names ("Spanish", "Unknown"); they pass through
}

// ---------------------------------------------------------------------------
// Reading a wire into one shape
// ---------------------------------------------------------------------------
//
// story: { i, title, url, outlet, lang, date, snippet, place, w, v: { key: [values] } }
// facet: { key, label, labels, none, parent, belongs, order, weight, distinct, mark, markName }

function toMs(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  const t = Date.parse(v);
  return isNaN(t) ? null : t;
}

function asList(v) {
  if (v == null || v === '') return [];
  return (Array.isArray(v) ? v : [v]).filter((x) => x != null && x !== '');
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function plainText(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[e.toLowerCase()] || m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function facet(key, label, extra) {
  return Object.assign({ key, label, labels: {}, none: 'Not stated', parent: null,
                         belongs: null, order: 'count', weight: false, distinct: 0 }, extra);
}

function labelsFrom(list) {
  const m = {};
  (Array.isArray(list) ? list : []).forEach((x) => { if (x && x.id != null) m[x.id] = x.label || x.id; });
  return m;
}

function put(story, key, values) {
  story.v[key] = values.length ? values.map(String) : [NONE];
}

function finish(facets, stories, generated) {
  // Source: the outlet each story names, more exact than who reports it.
  // Left out where another filter already says exactly this.
  stories.forEach((s) => put(s, 'outlet', s.outlet ? [s.outlet] : []));
  const same = facets.some((f) => !f.weight && stories.every((s) =>
    (s.v[f.key] || [NONE]).join('|') === s.v.outlet.join('|')));
  if (!same) {
    const src = facet('outlet', 'News source', { order: 'label', none: 'Not named' });
    stories.forEach((s) => s.v.outlet.forEach((x) => { if (x !== NONE) src.labels[x] = x; }));
    facets.push(src);
  }
  facets.forEach((f) => {
    if (f.weight) {
      f.values = Array.from(new Set(stories.map((s) => s.w).filter((w) => w != null))).sort((a, b) => a - b);
      f.distinct = f.values.length;
      return;
    }
    const seen = new Set();
    stories.forEach((s) => (s.v[f.key] || [NONE]).forEach((x) => seen.add(x)));
    f.distinct = seen.size;
  });
  // A filter whose every story has the same value would do nothing when set.
  // It is left out of the controls; no story is affected.
  return { stories, facets: facets.filter((f) => f.distinct > 1), generated: generated || null };
}

function readFeed(data) {
  const items = data && Array.isArray(data.items) ? data.items : [];
  const has = (k) => items.some((i) => i[k] != null && i[k] !== '');
  const facets = [];

  const topicLabels = labelsFrom(data.topics);
  facets.push(facet('topic', 'Topic', { labels: topicLabels, order: 'given',
    given: (data.topics || []).map((t) => t.id) }));

  const geo = Array.isArray(data.geo) ? data.geo : [];
  const hasTree = geo.length > 0 && items.some((i) => Array.isArray(i.w));
  const regionL = {}, subL = {}, placeL = {}, subOf = {}, placeOf = {};
  if (hasTree) {
    geo.forEach((r) => {
      regionL[r.id] = r.label;
      (r.subs || []).forEach((sb) => {
        subL[sb.id] = sb.label; subOf[sb.id] = r.id;
        (sb.places || []).forEach((p) => { placeL[p.id] = p.label; placeOf[p.id] = sb.id; });
      });
    });
    facets.push(facet('region', 'Region', { labels: regionL, none: 'Not placed', order: 'given', given: geo.map((r) => r.id) }));
    facets.push(facet('within', 'Within', { labels: subL, none: 'Not placed', parent: 'region', belongs: subOf, order: 'label' }));
    facets.push(facet('place',  'Place',  { labels: placeL, none: 'Not placed', parent: 'within', belongs: placeOf, order: 'label' }));
  } else if (has('pn')) {
    // No region tree (space, space-life): the only place these wires give is a
    // place name per story.
    facets.push(facet('place', 'Place', { none: 'Not placed', order: 'label' }));
  }

  const hasStanding = has('st');
  if (hasStanding) {
    facets.push(facet('who', 'Who reports it', { labels: labelsFrom(data.standings), order: 'given',
      given: (data.standings || []).map((s) => s.id) }));
  } else if (has('r')) {
    facets.push(facet('who', 'Who reports it', { order: 'given', given: Array.isArray(data.regions) ? data.regions : null }));
  }

  const kindsPublished = Array.isArray(data.kinds) && data.kinds.length;
  facets.push(facet('kind', kindsPublished ? null : 'Type', {
    labels: kindsPublished ? labelsFrom(data.kinds) : {}, order: kindsPublished ? 'given' : 'count',
    given: kindsPublished ? data.kinds.map((k) => k.id) : null }));

  facets.push(facet('lang', 'Language', { order: 'label' }));

  const markKey = ['notable_score', 'documented_score', 'big_picture_score'].find((k) => typeof data[k] === 'number');
  if (items.some((i) => typeof i.p === 'number')) {
    facets.push(facet('weight', 'Substance score', { weight: true,
      mark: markKey ? data[markKey] : null,
      markName: markKey ? markKey.replace(/_score$/, '').replace(/_/g, ' ') : null }));
  }

  const langs = data.languages || {};
  const stories = items.map((i, n) => {
    const s = { i: n, title: plainText(i.t), url: i.u || '', outlet: i.o || '', date: toMs(i.d),
                snippet: plainText(i.s), w: typeof i.p === 'number' ? i.p : null, v: {} };
    const unl = (x) => x !== 'unlocated';
    put(s, 'topic', asList(i.x));
    if (hasTree) {
      put(s, 'region', asList(i.w).filter(unl));
      put(s, 'within', asList(i.sr).filter(unl));
      put(s, 'place',  asList(i.pl).filter(unl));
      const pick = [['place', placeL], ['within', subL], ['region', regionL]]
        .map(([k, L]) => s.v[k].filter((x) => x !== NONE).map((x) => L[x] || x))
        .find((a) => a.length);
      s.place = pick ? pick.slice(0, 2).join(', ') : null;
    } else if (facets.some((f) => f.key === 'place')) {
      put(s, 'place', asList(i.pn));
      s.place = i.pn || null;
    }
    if (hasStanding) put(s, 'who', asList(i.st));
    else put(s, 'who', asList(i.r));
    put(s, 'kind', asList(i.k));
    put(s, 'lang', asList(i.g));
    s.lang = i.g ? languageName(i.g, langs) : null;
    return s;
  });

  // Where each story is, for the map: the feeds publish a table of place
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
  if (!kindsPublished) {
    stories.forEach((s) => s.v.kind.forEach((k) => { if (k !== NONE) kindF.labels[k] = k[0].toUpperCase() + k.slice(1); }));
  }
  const langF = facets.find((f) => f.key === 'lang');
  stories.forEach((s) => s.v.lang.forEach((c) => { if (c !== NONE) langF.labels[c] = languageName(c, langs); }));
  const placeF = facets.find((f) => f.key === 'place' && !f.belongs);
  if (placeF) stories.forEach((s) => s.v.place.forEach((p) => { if (p !== NONE) placeF.labels[p] = p; }));

  return finish(facets, stories, data.generated);
}

function readMapWire(cfg, data) {
  const items = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : []);
  const facets = cfg.facets.map((d) => facet(d.key, d.label, {
    none: d.none || 'Not stated', parent: d.parent || null,
    order: d.type === 'lang' || d.type === 'country' ? 'label' : d.type === 'days' ? 'numeric' : 'count',
    type: d.type || 'plain', field: d.field }));
  const weightOn = cfg.weight && items.some((i) => typeof i[cfg.weight] === 'number');
  if (weightOn) facets.push(facet('weight', 'Substance score', { weight: true, mark: null, markName: null }));

  const stories = items.map((i, n) => {
    const s = { i: n, title: plainText(i.title), url: i.link || '', outlet: cfg.outlet ? (i[cfg.outlet] || '') : '',
                date: toMs(i.date), snippet: cfg.snippet ? plainText(i[cfg.snippet]) : '',
                w: weightOn && typeof i[cfg.weight] === 'number' ? i[cfg.weight] : null, v: {} };
    facets.forEach((f) => {
      if (f.weight) return;
      let vals = asList(i[f.field]);
      if (f.type === 'country') vals = vals.map((x) => String(x).toUpperCase());
      put(s, f.key, vals);
      s.v[f.key].forEach((x) => {
        if (x === NONE || f.labels[x]) return;
        f.labels[x] = f.type === 'country' ? countryName(x)
                    : f.type === 'lang' ? languageName(x)
                    : f.type === 'days' ? x + ' days'
                    : x;
      });
    });
    const firstLang = s.v.lang && s.v.lang[0] !== NONE ? s.v.lang[0] : null;
    s.lang = firstLang ? languageName(firstLang) : null;
    const pl = cfg.place.map((k) => facets.find((f) => f.key === k))
      .filter(Boolean).map((f) => s.v[f.key].filter((x) => x !== NONE).map((x) => f.labels[x]))
      .find((a) => a.length);
    s.place = pl ? pl.join(', ') : null;
    // These wires give a country code rather than coordinates; the map places
    // them from its own boundary file.
    const isoF = facets.find((f) => f.type === 'country');
    const iso = isoF ? (s.v[isoF.key] || []).find((x) => x !== NONE) : null;
    s.iso = iso || null;
    s.at = null;
    return s;
  });
  return finish(facets, stories, null);
}

function readWire(subject, data) {
  const s = typeof subject === 'string' ? BY_ID[subject] : subject;
  const out = s.map ? readMapWire(s.map, data) : readFeed(data || {});
  out.facets.forEach((f) => { if (f.label == null) f.label = s.kindLabel || 'Kind'; });
  return out;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function inWindow(story, when, now) {
  const w = WINDOWS.find((x) => x.id === when);
  if (!w || !w.ms) return true;
  if (story.date == null) return false;
  const age = (now || Date.now()) - story.date;
  return w.older ? age > w.ms : age <= w.ms;
}

function sharedOk(story, shared) {
  if (shared.when && !inWindow(story, shared.when, shared.now)) return false;
  const q = (shared.q || '').trim().toLowerCase();
  if (q && (story.title + ' ' + story.snippet + ' ' + story.outlet).toLowerCase().indexOf(q) === -1) return false;
  return true;
}

// A story's values for a facet. For drill-downs built on a region tree a story
// can carry places in several regions, so only the ones inside the chosen
// parent count; a story with none of those is "not placed" within it.
function valuesOf(story, f, sel) {
  let vals = story.v[f.key] || [NONE];
  if (f.belongs && f.parent && sel[f.parent] != null) {
    const p = sel[f.parent];
    const inside = vals.filter((x) => x !== NONE && f.belongs[x] === p);
    vals = inside.length ? inside : [NONE];
  }
  return vals;
}

function descendants(facets, key) {
  const out = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    facets.forEach((f) => {
      if (f.parent && (f.parent === key || out.has(f.parent)) && !out.has(f.key)) { out.add(f.key); grew = true; }
    });
  }
  return out;
}

function matches(story, facets, sel, skip) {
  // A subject with no such field at all has nothing that fits a filter on it.
  if (sel && sel.__blocked && Object.keys(sel.__blocked).some((k) => !(skip && skip.has(k)))) return false;
  for (const f of facets) {
    if (skip && skip.has(f.key)) continue;
    const want = sel[f.key];
    if (want == null) continue;
    if (f.weight) { if (story.w == null || story.w < want) return false; continue; }
    if (valuesOf(story, f, sel).indexOf(want) === -1) return false;
  }
  return true;
}

function filterStories(wire, sel, shared) {
  return wire.stories.filter((s) => sharedOk(s, shared) && matches(s, wire.facets, sel || {}));
}

// Options for one filter, counted against every other filter already set.
// Returns null when the filter should not be shown (a drill-down whose parent
// is not chosen).
function optionsFor(wire, f, sel, shared) {
  sel = sel || {};
  if (f.parent && sel[f.parent] == null) return null;
  const skip = descendants(wire.facets, f.key);
  skip.add(f.key);
  const pool = wire.stories.filter((s) => sharedOk(s, shared) && matches(s, wire.facets, sel, skip));

  if (f.weight) {
    // Every value above the lowest, plus the wire's own mark even where no
    // story sits exactly on it.
    const steps = f.values.slice(1);
    if (f.mark != null && f.values.length && f.mark > f.values[0] && steps.indexOf(f.mark) === -1) {
      steps.push(f.mark);
      steps.sort((a, b) => a - b);
    }
    return steps.map((v) => ({
      value: v,
      label: 'At least ' + v + (v === 1 ? ' point' : ' points') + (f.mark === v ? ', the wire’s ' + f.markName + ' mark' : ''),
      count: pool.filter((s) => s.w != null && s.w >= v).length
    }));
  }

  const counts = new Map();
  pool.forEach((s) => valuesOf(s, f, sel).forEach((x) => counts.set(x, (counts.get(x) || 0) + 1)));
  if (sel[f.key] != null && !counts.has(sel[f.key])) counts.set(sel[f.key], 0);

  const label = (x) => (x === NONE ? f.none : (f.labels[x] || x));
  let keys = Array.from(counts.keys()).filter((x) => x !== NONE);
  if (f.order === 'given' && f.given) {
    const at = (x) => { const k = f.given.indexOf(x); return k === -1 ? 1e9 : k; };
    keys.sort((a, b) => at(a) - at(b) || label(a).localeCompare(label(b)));
  } else if (f.order === 'label') {
    keys.sort((a, b) => label(a).localeCompare(label(b)));
  } else if (f.order === 'numeric') {
    keys.sort((a, b) => Number(a) - Number(b));
  } else {
    keys.sort((a, b) => counts.get(b) - counts.get(a) || label(a).localeCompare(label(b)));
  }
  if (counts.has(NONE)) keys.push(NONE);
  return keys.map((x) => ({ value: x, label: label(x), count: counts.get(x) }));
}

function timeAgo(ms, now) {
  if (ms == null) return 'Undated';
  const m = Math.round(((now || Date.now()) - ms) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' h ago';
  const d = Math.round(h / 24);
  return d < 30 ? d + ' d ago' : new Date(ms).toISOString().slice(0, 10);
}

// A filter row is one choice for every ticked subject, kept by its label
// ("Africa", "English"): each subject is filtered to its own value with that
// label, and a subject without it shows nothing. Before, the choice reached
// only the subject its option came from, and every other subject's stories
// still showed, so the filters looked as if they did nothing.
const NO_MATCH = '\u0000no-match';
function labelOf(f, x) { return x === NONE ? f.none : (f.labels[x] || x); }
function valueForLabel(wire, f, label) {
  if (!f._byLabel) {
    const m = new Map();
    wire.stories.forEach((s) => (s.v[f.key] || [NONE]).forEach((x) => { const l = labelOf(f, x); if (!m.has(l)) m.set(l, x); }));
    f._byLabel = m;
  }
  return f._byLabel.has(label) ? f._byLabel.get(label) : undefined;
}
function selFromCross(wire, cross) {
  const sel = {};
  Object.keys(cross || {}).forEach((key) => {
    const label = cross[key];
    const f = wire.facets.find((x) => x.key === key);
    if (f) { const v = valueForLabel(wire, f, label); sel[key] = v === undefined ? NO_MATCH : v; return; }
    // Left out of the filters because every story shares one value: kept when
    // that one value is the one chosen.
    const one = wire.stories.length && wire.stories[0].v[key] ? wire.stories[0].v[key][0] : undefined;
    const names = one == null ? [] : [String(one), languageName(one), countryName(one)];
    if (names.indexOf(label) === -1) (sel.__blocked = sel.__blocked || {})[key] = true;
  });
  return sel;
}

const core = { ORG, FEEDS, MAPS, SUBJECTS, WINDOWS, NONE, NO_MATCH, readWire, filterStories, optionsFor, selFromCross,
               valuesOf, descendants, countryName, languageName, plainText, toMs, timeAgo };

if (typeof module === 'object' && module.exports) module.exports = core;
if (typeof window === 'undefined' || typeof document === 'undefined') return;
if (window.__culpritsWire) return;
window.__culpritsWire = core;

// ---------------------------------------------------------------------------
// The box
// ---------------------------------------------------------------------------

const STORE = 'culprits-wire-v1';
const PAGE = 60;
const REFRESH_MS = 30 * 60000;

const state = {
  open: true, picked: [], when: 'all', q: '', sel: {}, cross: {}, expanded: {},
  pickerOpen: false, shown: PAGE, wires: {}   // wires[id] = { status, error, loadedAt, wire }
};

try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved) {
    // Opens every visit: the box is part of the front page, not a drawer.
    state.picked = (saved.picked || []).filter((id) => BY_ID[id]);
    state.when = WINDOWS.some((w) => w.id === saved.when) ? saved.when : 'all';
    state.cross = saved.cross || {};
    state.expanded = saved.expanded || {};
  }
} catch (e) { /* storage blocked: start fresh */ }

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ open: state.open, picked: state.picked, when: state.when,
      cross: state.cross, expanded: state.expanded }));
  } catch (e) { /* storage blocked: nothing to keep */ }
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n).toLocaleString('en');

const CSS = `
.wire{position:absolute;right:9px;top:var(--wire-top,16px);z-index:3;
  width:min(var(--box-w,290px),calc(100vw - 18px));display:flex;flex-direction:column;
  background:rgba(31,28,21,.95);border:1px solid var(--rule,#322E27);color:var(--bone,#DCD6C6);
  font:13px/1.45 var(--sans,system-ui,sans-serif);backdrop-filter:blur(6px)}
.wire.open{bottom:calc(26px + var(--wire-lift,0px))}
.wire button,.wire select,.wire input{font:inherit;color:inherit}
.wire :focus-visible{outline:2px solid var(--slate,#5C6E77);outline-offset:1px}
.wire-bar{display:flex;align-items:center;gap:4px 10px;padding:7px 10px 7px 8px;flex-wrap:wrap}
.wire.open .wire-bar{border-bottom:1px solid var(--rule,#322E27)}
.wire-toggle{background:none;border:0;padding:2px 4px;cursor:pointer;font-weight:600;font-size:13.5px;
  display:flex;align-items:center;gap:7px}
.wire-caret{display:inline-block;width:0;height:0;border-left:5px solid var(--dim,#948D7C);
  border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .12s}
.wire.open .wire-caret{transform:rotate(90deg)}
.wire-sum{display:none}
.wire-onmap{margin-left:auto}
.wire-onmap{display:flex;align-items:center;gap:5px;color:var(--dim,#948D7C);font-size:12px;
  white-space:nowrap;cursor:pointer}
.wire-onmap input{accent-color:var(--moss,#62755F)}
.wire-btn{background:none;border:1px solid var(--rule,#322E27);color:var(--dim,#948D7C);
  padding:1px 8px;cursor:pointer;border-radius:2px;font-size:12px;white-space:nowrap}
.wire-btn:hover{color:var(--bone,#DCD6C6);border-color:var(--dim,#948D7C)}
.wire-btn[aria-expanded="true"]{color:var(--peat,#17150F);background:var(--bone,#DCD6C6);border-color:var(--bone,#DCD6C6)}
.wire-body{display:flex;flex-direction:column;min-height:0;flex:1}
.wire-body[hidden]{display:none}
.wire-tools{display:flex;flex-direction:column;gap:6px;padding:8px 10px;align-items:stretch}
.wire-search{display:flex;gap:6px;align-items:center}
.wire-search input{flex:1}
.wire-subjrow{position:relative}
.wire-filter > span:first-child,.wire-filter > .wire-fl{flex:0 0 96px}
.wire-dd{flex:1;min-width:0;display:flex;align-items:center;gap:6px;text-align:left;cursor:pointer;
  background:var(--peat,#17150F);border:1px solid var(--rule,#322E27);border-radius:2px;padding:1px 6px;font-size:12px}
.wire-dd .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wire-dd .wire-caret{transform:rotate(90deg)}
.wire.picking .wire-dd .wire-caret{transform:rotate(-90deg)}
.wire.picking .wire-dd{border-color:var(--dim,#948D7C)}
.wire-pickbar{display:flex;gap:6px;padding:4px 10px 2px}
.wire-pickbar button{flex:1}
.wire-filter{display:flex;align-items:center;gap:7px;padding:3px 10px;color:var(--dim,#948D7C);font-size:12px}
.wire-filter select{flex:1;min-width:0}
.wire-unread{padding:3px 10px;color:#B98A80;font-size:11.5px}
.wire-hint{margin:0;padding:0 10px 4px;color:var(--dim,#948D7C);font-size:11px;line-height:1.35}
.wire-tools input{width:100%;min-width:0;background:var(--peat,#17150F);border:1px solid var(--rule,#322E27);
  padding:3px 7px;border-radius:2px;font-size:12.5px}
.wire-when{display:flex;align-items:center;gap:7px;padding:3px 10px 8px;color:var(--dim,#948D7C);font-size:12px}
.wire-when select{flex:1}
.wire-when label{flex:0 0 96px}
.wire select{background:var(--peat,#17150F);border:1px solid var(--rule,#322E27);border-radius:2px;
  padding:1px 3px;font-size:12px;max-width:100%}
.wire-picker{position:absolute;left:10px;right:10px;top:100%;z-index:5;max-height:55vh;overflow:auto;
  padding:2px 10px 8px;background:rgba(23,21,15,.99);border:1px solid var(--dim,#948D7C);border-top:0;
  box-shadow:0 8px 18px rgba(0,0,0,.45)}
.wire-picker[hidden]{display:none}
.wire-group{color:var(--dim,#948D7C);font-size:11.5px;margin:6px 0 2px}
.wire-pick{display:flex;align-items:baseline;gap:7px;padding:1px 0;cursor:pointer}
.wire-pick input{accent-color:var(--moss,#62755F);margin:0}
.wire-pick .n{color:var(--dim,#948D7C);font-size:11.5px;margin-left:auto}
.wire-filters{flex:none}
.wire-facets{max-height:34vh;overflow:auto}
.wire-subj{border-top:1px solid var(--rule,#322E27);padding:5px 10px}
.wire-subj:first-child{border-top:0}
.wire-subj-head{display:flex;align-items:baseline;gap:8px}
.wire-subj-name{background:none;border:0;padding:0;cursor:pointer;text-align:left;display:flex;align-items:center;gap:6px}
.wire-subj-name .wire-caret{border-left-width:4px;border-top-width:3px;border-bottom-width:3px}
.wire-subj.expanded .wire-subj-name .wire-caret{transform:rotate(90deg)}
.wire-subj-state{color:var(--dim,#948D7C);font-size:11.5px;flex:1;min-width:0}
.wire-subj-state.err{color:#B98A80}
.wire-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 8px;padding:6px 0 3px 12px}
.wire-grid[hidden]{display:none}
.wire-grid label{display:flex;flex-direction:column;gap:1px;color:var(--dim,#948D7C);font-size:11.5px;min-width:0}
.wire-grid select.set{border-color:var(--moss,#62755F);color:var(--bone,#DCD6C6)}
.wire-list{flex:1;overflow:auto;border-top:1px solid var(--rule,#322E27);min-height:60px}
.wire-list ol{list-style:none;margin:0;padding:0}
.wire-item{padding:7px 10px;border-top:1px solid rgba(50,46,39,.6)}
.wire-item:first-child{border-top:0}
.wire-item a{color:var(--bone,#DCD6C6);text-decoration:none}
.wire-item a:hover{text-decoration:underline;text-decoration-color:var(--dim,#948D7C)}
.wire-meta{display:flex;flex-wrap:wrap;gap:2px 10px;color:var(--dim,#948D7C);font-size:11.5px;margin-top:2px}
.wire-tag{color:#9FAE9B}
.wire-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wire-empty{padding:14px 10px;color:var(--dim,#948D7C)}
.wire-more{display:block;margin:8px auto 10px}
.wire-foot{padding:4px 10px;color:var(--dim,#948D7C);font-size:11px;border-top:1px solid var(--rule,#322E27)}
@media (max-width:560px){.wire.open{bottom:auto;height:min(52vh,520px,calc(100% - 96px - var(--wire-lift,0px)))}.wire-grid{grid-template-columns:minmax(0,1fr)}
  .wire-tools{flex-wrap:wrap}.wire-tools input{flex:1 0 100%;order:3}.wire-foot{display:none}}
@media (prefers-reduced-motion:reduce){.wire-caret{transition:none}}
`;

let box, $sum, $body, $toggle, $pickBtn, $picker, $filters, $list, $q, $when, $refresh, $onMap;

function build() {
  const style = document.createElement('style');
  style.id = 'wire-style';
  style.textContent = CSS;
  document.head.appendChild(style);

  box = document.createElement('section');
  box.className = 'wire';
  box.id = 'wire';
  box.setAttribute('aria-label', 'News wires');
  box.innerHTML =
    '<div class="wire-bar">' +
      '<button type="button" class="wire-toggle" id="wireToggle" aria-expanded="false" aria-controls="wireBody">' +
        '<span class="wire-caret" aria-hidden="true"></span>News wires</button>' +
      '<span class="wire-sum" id="wireSum" aria-live="polite"></span>' +
      '<label class="wire-onmap" title="Draw the stories that name a place on the map">' +
        '<input type="checkbox" id="wireOnMap" checked> show them on the map</label>' +
    '</div>' +
    '<div class="wire-body" id="wireBody" hidden>' +
      '<div class="wire-tools"><div class="wire-search">' +
        '<input type="search" id="wireQ" placeholder="Search headlines" aria-label="Search headlines in the ticked subjects">' +
        '<button type="button" class="wire-btn" id="wireRefresh" hidden title="Fetch the wires again and clear every choice">Refresh</button>' +
      '</div></div>' +
      '<div class="wire-filters">' +
        '<div class="wire-filter wire-subjrow"><span>Subjects</span>' +
          '<button type="button" class="wire-dd wire-subjects" id="wirePickBtn" aria-haspopup="true" aria-expanded="false" aria-controls="wirePicker">' +
            '<span class="t" id="wirePickLabel">Choose</span><span class="wire-caret" aria-hidden="true"></span></button>' +
          '<div class="wire-picker" id="wirePicker" hidden></div>' +
        '</div>' +
        '<div class="wire-facets" id="wireFilters"></div>' +
      '</div>' +
      '<div class="wire-when"><label for="wireWhen">Time</label>' +
        '<select id="wireWhen" aria-label="Time window">' +
          WINDOWS.map((w) => '<option value="' + w.id + '">' + w.label + '</option>').join('') +
        '</select></div>' +
      '<div class="wire-list" id="wireList"></div>' +
    '</div>';
  document.body.appendChild(box);

  $sum = box.querySelector('#wireSum');
  $body = box.querySelector('#wireBody');
  $toggle = box.querySelector('#wireToggle');
  $pickBtn = box.querySelector('#wirePickBtn');
  $picker = box.querySelector('#wirePicker');
  $filters = box.querySelector('#wireFilters');
  $list = box.querySelector('#wireList');
  $q = box.querySelector('#wireQ');
  $when = box.querySelector('#wireWhen');
  $refresh = box.querySelector('#wireRefresh');
  $onMap = box.querySelector('#wireOnMap');
  $when.value = state.when;

  $toggle.addEventListener('click', () => setOpen(!state.open));
  if ($onMap) $onMap.addEventListener('change', () => { state.onMap = $onMap.checked; save(); renderList(); });
  $pickBtn.addEventListener('click', () => { state.pickerOpen = !state.pickerOpen; renderPicker(); layout(); });
  document.addEventListener('click', (e) => {
    if (!state.pickerOpen || !e.target || !e.target.closest || !document.contains(e.target)) return;
    if (e.target.closest('#wirePicker') || e.target.closest('#wirePickBtn')) return;
    state.pickerOpen = false;
    renderPicker();
  });
  $picker.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('button');
    if (!t || !t.dataset) return;
    if (t.dataset.all) { state.picked = SUBJECTS.map((s) => s.id); state.picked.forEach((id) => load(id, false)); }
    else if (t.dataset.none) { state.picked = []; }
    else return;
    state.shown = PAGE;
    save();
    renderData();
  });
  $refresh.addEventListener('click', () => {
    const had = state.picked.slice();
    state.sel = {};
    state.cross = {};
    state.picked = [];
    state.pickerOpen = true;
    state.when = 'all';
    state.q = '';
    $when.value = state.when;
    $q.value = '';
    state.shown = PAGE;
    save();
    had.forEach((id) => load(id, true));   // fresh copies wait for the next ticks
    renderData();
  });
  $when.addEventListener('change', () => { state.when = $when.value; state.shown = PAGE; save(); renderData(); });
  let qTimer = null;
  $q.addEventListener('input', () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = $q.value; state.shown = PAGE; renderData(); }, 180);
  });

  $picker.addEventListener('change', (e) => {
    const id = e.target && e.target.dataset && e.target.dataset.pick;
    if (!id) return;
    if (e.target.checked) {
      if (state.picked.indexOf(id) === -1) state.picked.push(id);
      load(id, false);
    } else {
      state.picked = state.picked.filter((x) => x !== id);
    }
    state.shown = PAGE;
    save();
    renderData();
  });

  $filters.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.dataset || !t.dataset.key) return;
    const key = t.dataset.key;
    // One choice for every ticked subject (see selFromCross). Choosing a
    // region clears the rows that drill down inside it.
    delete state.cross[key];
    state.picked.forEach((id) => {
      const entry = state.wires[id];
      if (entry && entry.wire) descendants(entry.wire.facets, key).forEach((k) => { delete state.cross[k]; });
    });
    if (t.value !== '') state.cross[key] = t.value;
    applyCross();
    state.shown = PAGE;
    save();
    renderData(t.id);
  });

  $filters.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('button');
    if (t && t.dataset && t.dataset.retry) load(t.dataset.retry, true);
  });

  $list.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('wire-more')) {
      state.shown += PAGE;
      renderList();
    }
  });

  // Sit above the legend, and above the Guerillamap strip when that is open.
  const gm = document.getElementById('gm');
  const legend = document.getElementById('legend');
  if (typeof MutationObserver === 'function') {
    if (gm) new MutationObserver(layout).observe(gm, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    if (legend) new MutationObserver(layout).observe(legend, { attributes: true, childList: true, subtree: true });
  }
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(layout).observe(box);
    if (legend) new ResizeObserver(layout).observe(legend);
    const zoom = document.getElementById('zoombox');
    if (zoom) new ResizeObserver(layout).observe(zoom);
  }
  window.addEventListener('resize', layout);

  setInterval(() => {
    if (state.open && !document.hidden) state.picked.forEach((id) => load(id, true));
  }, REFRESH_MS);
}

function layout() {
  const gm = document.getElementById('gm');
  const legend = document.getElementById('legend');
  let lift = gm && !gm.hidden ? gm.getBoundingClientRect().height : 0;
  const zoom = document.getElementById('zoombox');
  const lh = legend && !legend.hidden ? legend.getBoundingClientRect().height : 0;
  const zh = zoom ? zoom.getBoundingClientRect().height : 0;
  // The legend now sits bottom left, under the layers box, so only the zoom box lifts the wires.
  if (zh) lift += zh + 8;
  document.documentElement.style.setProperty('--wire-lift', Math.round(lift) + 'px');
}

function setOpen(open) {
  state.open = open;
  box.classList.toggle('open', open);
  $body.hidden = !open;
  $refresh.hidden = !open || !state.picked.length;
  $toggle.setAttribute('aria-expanded', String(open));
  if (open) {
    if (!state.picked.length) state.pickerOpen = true;
    state.picked.forEach((id) => load(id, false));
  }
  save();
  render();
  layout();
}

async function load(id, force) {
  const s = BY_ID[id];
  const entry = state.wires[id] = state.wires[id] || { status: 'idle' };
  if (entry.status === 'loading') return;
  if (!force && (entry.status === 'ok' || entry.status === 'error')) return;
  entry.status = 'loading';
  entry.error = null;
  renderData();

  const urls = [
    'https://raw.githubusercontent.com/' + ORG + '/' + s.repo + '/main/' + s.file,
    'https://cdn.jsdelivr.net/gh/' + ORG + '/' + s.repo + '@main/' + s.file
  ];
  let data = null, err = null;
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) { err = 'HTTP ' + r.status; continue; }
      data = await r.json();
      break;
    } catch (e) {
      err = e && e.message ? e.message : 'network error';
    }
  }
  if (data == null) {
    entry.status = entry.wire ? 'ok' : 'error';   // keep the last good copy on a failed refresh
    entry.error = err || 'no answer';
    console.warn('[culprits] wire ' + id + ' could not be read:', entry.error);
  } else {
    try {
      entry.wire = readWire(s, data);
      entry.status = 'ok';
      entry.error = null;
      entry.loadedAt = Date.now();
    } catch (e) {
      entry.status = entry.wire ? 'ok' : 'error';
      entry.error = 'the file is not in a shape this box can read';
      console.warn('[culprits] wire ' + id + ' did not parse:', e);
    }
  }
  applyCross();
  renderData();
}

function shared() { return { q: state.q, when: state.when, now: Date.now() }; }

// Each ticked subject's own filter values, from the one set of choices.
function applyCross() {
  state.cross = state.cross || {};
  Object.keys(state.wires).forEach((id) => {
    const e = state.wires[id];
    if (e && e.wire) state.sel[id] = selFromCross(e.wire, state.cross);
  });
}

function render() { renderPicker(); renderData(); }

function renderData(focusId) {
  renderSum();
  renderPicker();
  renderFilters(focusId);
  renderList();
  layout();
}

function renderSum() {
  $refresh.hidden = !state.open || !state.picked.length;
  if (!state.picked.length) { $sum.textContent = 'No subjects ticked'; return; }
  let n = 0, loading = 0;
  state.picked.forEach((id) => {
    const e = state.wires[id];
    if (!e || e.status === 'loading' || e.status === 'idle') loading++;
    if (e && e.wire) n += filterStories(e.wire, state.sel[id], shared()).length;
  });
  const subj = state.picked.length === 1 ? BY_ID[state.picked[0]].name : state.picked.length + ' subjects';
  $sum.textContent = subj + ', ' + num(n) + (n === 1 ? ' story' : ' stories') + (loading ? ', loading' : '');
}

function renderPicker() {
  const $lab = box.querySelector('#wirePickLabel');
  if ($lab) $lab.textContent = !state.picked.length ? 'None ticked — choose'
    : state.picked.length === 1 ? BY_ID[state.picked[0]].name
    : state.picked.length === SUBJECTS.length ? 'All ' + SUBJECTS.length
    : state.picked.length + ' of ' + SUBJECTS.length;
  $pickBtn.setAttribute('aria-expanded', String(state.pickerOpen));
  $picker.hidden = !state.pickerOpen;
  box.classList.toggle('picking', state.pickerOpen);   // the list waits while subjects are chosen
  if (!state.pickerOpen) return;
  const row = (s) => {
    const e = state.wires[s.id];
    const n = e && e.wire ? num(e.wire.stories.length) : e && e.status === 'error' ? 'unread' : '';
    return '<label class="wire-pick"><input type="checkbox" data-pick="' + s.id + '"' +
      (state.picked.indexOf(s.id) !== -1 ? ' checked' : '') + '>' +
      '<span>' + esc(s.name) + '</span><span class="n">' + n + '</span></label>';
  };
  const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pick : null;
  // One list, by name: which repository a wire lives in is not the reader's
  // business, and two headings made it look like two kinds of thing.
  const all = SUBJECTS.slice().sort((a, b) => a.name.localeCompare(b.name));
  $picker.innerHTML =
    '<div class="wire-pickbar">' +
      '<button type="button" class="wire-btn" data-all="1">Select all</button>' +
      '<button type="button" class="wire-btn" data-none="1">Clear all</button>' +
    '</div>' + all.map(row).join('');
  if (focused) { const el = $picker.querySelector('[data-pick="' + focused + '"]'); if (el) el.focus(); }
}

// Read by the box but not offered as filters: the score, the feeds' own
// bookkeeping (which search found a story, how far it was widened, why it
// was kept), and the escalation label. Time covers how recent a story is.
const HIDDEN_ROWS = new Set(['Substance score', 'Direction', 'Why it was kept', 'Search feed', 'Search widened to']);
const ROW_ORDER = ['Topic', 'Country', 'Region', 'Within', 'Place', 'Who reports it', 'News source', 'Language'];
function rowRank(label) { const i = ROW_ORDER.indexOf(label); return i === -1 ? ROW_ORDER.length : i; }

function renderFilters(focusId) {
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
      if (f.weight || HIDDEN_ROWS.has(f.label)) return;
      let k = kinds.find((x) => x.key === f.key);
      if (!k) kinds.push(k = { key: f.key, label: f.label, subs: [] });
      const opts = optionsFor(e.wire, f, sel, sh);
      if (opts && opts.length) k.subs.push({ id, f, opts, cur: sel[f.key] });
    });
  });

  const many = state.picked.length > 1;
  kinds.sort((a, b) => rowRank(a.label) - rowRank(b.label));
  const rows = kinds.filter((k) => k.subs.length).map((k) => {
    const fid = 'wf-' + k.key;
    // The same value from several subjects is one option, its counts added.
    const merged = new Map();
    k.subs.forEach(({ opts }) => opts.forEach((o) => merged.set(o.label, (merged.get(o.label) || 0) + o.count)));
    const cur = state.cross[k.key];
    if (cur != null && !merged.has(cur)) merged.set(cur, 0);
    const body = Array.from(merged.keys()).map((l) =>
      '<option value="' + esc(l) + '"' + (cur === l ? ' selected' : '') + '>' +
      esc(l) + ' (' + num(merged.get(l)) + ')</option>').join('');
    const set = cur != null;
    const hint = '';
    return '<label class="wire-filter" for="' + fid + '"><span>' + esc(k.label) + '</span>' +
      '<select id="' + fid + '" data-key="' + k.key + '"' + (set ? ' class="set"' : '') + '>' +
        '<option value="">All</option>' + body +
      '</select></label>' + hint;
  }).join('');

  $filters.innerHTML = rows + unread.map((u) =>
    '<p class="wire-unread">' + esc(BY_ID[u.id].name) + ' could not be read (' + esc(String(u.error)) + '). ' +
    '<button type="button" class="wire-btn" data-retry="' + u.id + '">Try again</button></p>').join('');
  if (active) { const el = document.getElementById(active); if (el && $filters.contains(el)) el.focus(); }
}

// The stories now showing, handed to the map. Off when the box is unticked.
function toTheMap(all) {
  const on = !$onMap || $onMap.checked;
  const list = on ? all.map(({ s, id }) => ({
    title: s.title, url: s.url, outlet: s.outlet, place: s.place, date: s.date,
    subject: BY_ID[id] ? BY_ID[id].name : id, at: s.at || null, iso: s.iso || null,
  })) : [];
  // If the map's script has not run yet, leave the list where it will look.
  if (window.culpritsWire) window.culpritsWire.show(list);
  else window.__wirePending = list;
}

function renderList() {
  if (!state.picked.length) {
    toTheMap([]);
    $list.innerHTML = '<p class="wire-empty">Tick one or more subjects to read their wires.</p>';
    return;
  }
  const sh = shared();
  const all = [];
  let undated = 0, anyLoaded = false;
  state.picked.forEach((id) => {
    const e = state.wires[id];
    if (!e || !e.wire) return;
    anyLoaded = true;
    const sel = state.sel[id] || {};
    e.wire.stories.forEach((s) => {
      if (!matches(s, e.wire.facets, sel)) return;
      if (!sharedOk(s, sh)) {
        if (s.date == null && state.when !== 'all' && sharedOk(s, { q: sh.q })) undated++;
        return;
      }
      all.push({ s, id });
    });
  });
  all.sort((a, b) => (b.s.date == null ? -Infinity : b.s.date) - (a.s.date == null ? -Infinity : a.s.date));
  toTheMap(all);

  if (!all.length) {
    $list.innerHTML = '<p class="wire-empty">' + (anyLoaded
      ? 'No stories match. Widen the time window, clear the search, or clear a subject’s filters.'
      : 'Loading the wires…') + (undated ? ' ' + num(undated) + ' undated ' + (undated === 1 ? 'story is' : 'stories are') + ' shown only under “Any time”.' : '') + '</p>';
    return;
  }
  const many = state.picked.length > 1;
  const rows = all.slice(0, state.shown).map(({ s, id }) => {
    const safe = /^https?:\/\//i.test(s.url);
    const title = esc(s.title || 'Untitled');
    const meta = [];
    if (many) meta.push('<span class="wire-tag">' + esc(BY_ID[id].name) + '</span>');
    if (s.outlet) meta.push('<span>' + esc(s.outlet) + '</span>');
    meta.push('<span>' + esc(s.place || 'Not placed') + '</span>');
    meta.push('<span>' + esc(s.lang || 'Language not stated') + '</span>');
    meta.push('<span>' + timeAgo(s.date, sh.now) + '</span>');
    const tip = s.snippet && s.snippet !== s.title ? ' title="' + esc(s.snippet.slice(0, 300)) + '"' : '';
    return '<li class="wire-item">' +
      (safe ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer"' + tip + '>' + title + '</a>'
            : '<span' + tip + '>' + title + '</span>') +
      '<div class="wire-meta">' + meta.join('<span class="wire-vh">, </span>') + '</div></li>';
  }).join('');
  const more = all.length > state.shown
    ? '<button type="button" class="wire-btn wire-more">Show more (' + num(all.length - state.shown) + ' left)</button>' : '';
  const note = undated ? '<p class="wire-empty">' + num(undated) + ' undated ' +
    (undated === 1 ? 'story is' : 'stories are') + ' shown only under “Any time”.</p>' : '';
  $list.innerHTML = '<ol>' + rows + '</ol>' + more + note;
}

function start() {
  build();
  box.classList.toggle('open', state.open);
  $body.hidden = !state.open;
  $toggle.setAttribute('aria-expanded', String(state.open));
  if (state.open) state.picked.forEach((id) => load(id, false));
  render();
  layout();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

})();
