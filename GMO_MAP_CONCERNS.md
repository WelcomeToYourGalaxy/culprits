# Pre-Birth Rights map — four things found while working on local-map

I've been doing the `tier` backfill on `WelcomeToYourGalaxy/local-map`. Your `index.html` was
sent to me by mistake, and since the two files share a codebase I checked it against what we
found. Four things, in order of how much they cost you.

I have not touched your file. Everything below is a report.

---

## 1. The map has no country data at all

Your own file says so:

> `trackerdata.json` is empty, so `countryAny()` is false for every country
> `trackerdata.json` **must sit next to index.html** — until it does, only the international &
> treaty bodies appear here

`raw.githubusercontent.com/WelcomeToYourGalaxy/GMO-map/main/trackerdata.json` returns **2 bytes**.
So what renders today is `internationalBodies` — **25 bodies, 84 rows** — and nothing else. Every
country is grey.

This makes the three defects below latent rather than active. It also means they will all fire
at once the moment you deploy the data, which is the argument for fixing them first.

---

## 2. `tier: "subnational"` makes an entry invisible

```js
// line 2394
function _tierLabel(t){ if(!t) return 'State'; return t.charAt(0).toUpperCase()+t.slice(1); }

// LEVELS
['Municipal','County','State','National','International']
```

`_tierLabel('subnational')` returns `'Subnational'`, which is not one of those five strings.
`activeLevels` is built from `LEVELS`, and both `trackerVisible` (map) and the index panel test
`activeLevels.has(...)`. `'Subnational'` can never be in that set, so **the entry is filtered out
under every filter combination** — not mis-labelled, gone.

In local-map this had hidden **800 admin-1 entries**. If your writing pass uses `subnational` —
it is the natural word, and it is what local-map's writers reached for — you will lose them all
silently when the data lands.

The fix is an alias map: known values map to themselves, near-misses map to the intended bin,
anything unrecognised falls back to a bin instead of vanishing. A wrong bin is recoverable; an
invisible entry is not.

Two more values behave badly: `tier: "national"` at admin-1 depth renders as `National`, so the
entry shows but is mis-levelled; and an **absent** tier renders as `'State'`, not `National` — so
inside the `sub` tree, leaving `tier` off is not neutral.

---

## 3. `tier` is never read at country level

```js
// line 986
(c.trackers||[]).forEach(t=>{ t._lvl='National'; });        // tier ignored
if(c.sub) for(const r in c.sub){
  (c.sub[r].trackers||[]).forEach(t=>{ t._lvl=_tierLabel(t.tier); });
```

Depth-0 entries get `'National'` unconditionally. In local-map that was 7,508 of 8,563 entries —
setting `tier` on any of them changed nothing visible. We nearly spent 30–45 rounds classifying
them before reading this function.

Your `buildIndexData` does **not** have the matching bug — it carries no hardcoded
`level:'National'` — so you only need the one edit here. Local-map had it in both places, and a
verification that measured only the patched path came out clean and concealed the second one.

Worth checking before you classify anything: **which of your entries live in `c.trackers` and
which in `c.sub`.** If a body is a state pollution board sitting at country level, `tier` alone
will not move it; it has to be in the sub tree, or this line has to read `tier`.

---

## 4. Four accessors will drop an entry on an unknown value

```js
819  function kindOf(t){ return t.kind||'structured'; }
820  function voiceOf(t){ return t.voice||'interpretive'; }
832  function skindOf(t){ return t.skind||'other'; }
```

Same shape as #2. `trackerVisible` tests `activeKinds.has(kindOf(t))`, and `activeKinds` is built
from `KINDS`. A value outside the vocabulary — `ngo`, `research`, `official` — is truthy, fails
the `.has()` test, and the entry disappears. `skind` is the dangerous one: 17 values to miss, and
in local-map it was absent on 100% of entries, so nobody had discovered the trap.

You have no `restypeOf` / `RESTYPES`, so that one doesn't apply to you.

---

## Also worth a look

**`tieredPopHTML` is defined and never called** (line ~2300s in your file, 0 call sites). It reads
`t.tier` to group popup entries into State/County/Municipal tabs. If you were expecting tier to
show up in popups, it doesn't — the country popup path ignores it entirely.

**`locateEntry` line 2475** keys its flyTo on `e.level==='International'`. That is safe only while
`International` can come from nowhere but `internationalBodies`. If you ever tier a country-bucket
entry `international`, and country-bucket pushes ever gain `lat`/`lng`, the map starts flying to a
treaty body instead of opening the country. Keying on a flag set where the rows originate
(`intl:true`) removes the dependency.

---

## Two rules that cost us real work to learn

**Never type an admin-1 unit name — copy it from `properties.shapeName` in the cgaz boundary
file.** Four independent catches in one task: `Tunapuna-Piarco` is hyphenated, Myanmar's is
`Tanitharyi` **missing its second `n`**, India's is `Mahārāshtra` **with macrons**, Vietnam's is
`Quảng Bình` with diacritics. Typing the correct spelling creates a junk unit that nests nowhere.

**Substring matching on unit names is a shortlist, never a classifier.** It fails in both
directions and the second is worse. Over-matching: `Ica` inside *Mercociudades*, `Cần Thơ` inside
*tiếp cận thông tin*, `Nairobi` on a land trust that sits in Voi. Under-matching: a harvested
`shapeName` list still holding raw `\u00f8` escapes made Norway look clean and hid 83 mis-tiered
courts. Normalise both sides, confirm your harvest actually decoded, and treat a clean zero as
suspect rather than as good news.

---

## If you want the patch

`patch_index_tier_levels.py` from the local-map bundle fixes #2 and #3. Its `_tierLabel` anchor
matches your file exactly. Its `tagLevels` anchor matches. Its third edit — the
`buildIndexData` one — will **not** match, and the script exits rather than half-applying, so
you'd need that edit removed for your file. `patch_index_facet_aliases.py` fixes #4 but expects a
`restypeOf` you don't have, so it needs the same treatment.

Both refuse to double-apply and both run `node --check` on the concatenated script blocks before
writing. Happy to cut versions anchored to your file if you send it over as the current one.
