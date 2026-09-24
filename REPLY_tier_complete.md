# Handover — `tier` backfill complete, plus three renderer fixes

The commissioned 2,164 are done, and so is the rest of the country level: **7,508 of 7,508**.
Everything merges in a defined order and is verified end to end below.

**Baseline note.** This was rebuilt against the `index.html` currently in the repo, which does
**not** carry the earlier tier fixes — no `_TIER_ALIAS`, no depth-0 `tier` read in either
`tagLevels` or `buildIndexData`. Those were applied to a working copy that never landed. All
three are included here as a script, so the merge starts from the deployed file.

---

## What to merge, in order

### Renderer — already applied to the `index.html` in this bundle

Nothing to run; the scripts are included so the change is reproducible and so they refuse to
double-apply.

**`patch_index_tier_levels.py`** — three defects in the level machinery:

1. `_tierLabel` blind-capitalised the stored value, so `subnational` became `'Subnational'`,
   which is not one of the five strings in `LEVELS`. `activeLevels` is built from `LEVELS`, so
   those entries failed `activeLevels.has()` and were **invisible under every filter
   combination** — 800 admin-1 entries in the live data. Replaced with an alias map; unknown
   values fall back to a bin rather than vanishing.
2. `tagLevels` hardcoded `t._lvl='National'` at depth 0, so `tier` was never read at country
   level — where 7,508 of the 8,563 entries live. Without this, the whole backfill is inert.
3. `buildIndexData` hardcoded `level:'National'` in the same place, for the side panel and the
   level-pill counts. Computed inline from `tr.tier`, not read from `_lvl`, because
   `levelCounts()` can call `buildIndexData()` before `tagLevels()` runs.

**`patch_index_facet_aliases.py`** — `kindOf` / `voiceOf` / `skindOf` / `restypeOf` passed the
stored string straight through, so any value outside the vocabulary failed `activeKinds.has()`
and took the entry off the map — defect 1 above, in four more places. Same alias treatment.
Verified against the data first: no stored value changes bin, and it refuses to write otherwise.

**`patch_index_intl_flag.py`** — `locateEntry` decided whether to fly the map by testing
`e.level==='International'`, which was safe only because `internationalBodies` is the one push
carrying `lat`. Now stamps `intl:true` at the origin and tests that, so the branch depends on
where a row came from rather than on a value the tier vocabulary also produces.

### Data — run these three, from the repo root

```bash
python3 scripts/apply_tier_patch.py  trackerdata.json patches/TIER_PATCH_ALL.json      index.html --write
python3 scripts/apply_tier_patch.py  trackerdata.json patches/TIER_AMENDMENT_01.json   index.html --write
python3 scripts/apply_skind_patch.py trackerdata.json patches/SKIND_PATCH_PARTIAL.json index.html --write
```

Drop `--write` for a dry run. All three are idempotent and match on `(country, url)`, so they
are safe to run after any other chat's patch has landed.

```
before        National 7508 · State  807 · County 183 · Municipal  65
tier patch    7508 applied      National 6505 · State 1216 · County 547 · Municipal 295
amendment       16 applied      National 6517 · State 1215 · County 547 · Municipal 284
skind patch   3167 applied      skind pills 1 → 12 of 17 · media pills 2 → 3 of 8
kind patch     747 applied      kind values in use 4 → 5 of 12 · trust unchanged
every step    mismatch 0 · outside activeLevels 0 · still untiered 0
```

`TIER_AMENDMENT_01` is 16 corrections found after the main patch was built. Kept separate so
`TIER_PATCH_ALL` keeps the provenance of a documented pass. Each row carries a `was` field
recording the superseded value; the applier ignores it.

---

## The international question — decided

**A country bucket means "resources reachable from this country."** So a cross-national body
filed in one is reachable at country level and is tiered `national`. `International` stays
reserved for the `internationalBodies` array.

That moved **1,817 rows**. They are listed in `patches/INTERNATIONAL_ROWS.json` so the decision
is reversible: applying that file through the same script restores the alternative reading,
where the tier describes the body's own jurisdiction rather than its reachability.

Worth knowing what those 1,817 are, because it is a fact about the directory rather than about
the tier: ICLEI sits in 33 country buckets, GEF Small Grants in 34, the ICCA Registry in 64.
139 distinct URLs appear in more than one bucket, covering 1,474 entries. Belize's 22 entries
include 20 that are not Belizean.

---

## Measured accuracy

Two blind re-reads of stratified 130-row samples, the second disjoint from the first:

```
sample 1   agree 127/130      sample 2   agree 128/130
combined   255/260 — 1.9% disagree
```

No tier is over- or under-used; agreement was 20/20 on `state` and on `county` in both samples.
That puts the residual at roughly 140 rows out of 7,508, and the second sample found no new
systematic class — the remaining errors are unrelated single judgements, not another sweepable
pattern.

**One finding in the corrections is worth more than the corrections.** Twelve of the sixteen
amendment rows are a single class: *a national association of local governments is national,
not the tier of its members*. Brazil's national confederation of municipalities was already
filed `national`; the identical body in eleven other countries was filed at member level.
Inter-municipal bodies — commonwealths, mancomunidades, consorcios, joint boards — are **not**
in that class and are unchanged, because their own jurisdiction really is the member territories.

---

## Two limits worth carrying forward

**`sub_unit` is mostly not recoverable, and that is correct.** Of 831 subnational rows without
one, **774 mention no admin-1 unit anywhere — not in the name, not in 1,500 characters of
description**. They describe a class of bodies, not one: "municipal environment councils",
"district land offices", "union village courts". A tier without a `sub_unit` is the normal
state of this data, not an incomplete record. 194 rows do carry one, every value copied
verbatim from `shapeName`.

**The remainder pass read names only.** 3,740 rows classified from the entry name, with
`national` as the default. Names like `Alte Hauptpost` carry nothing and defaulted. Weaker
evidence than the three region files, which had descriptions.

---

## For the standing brief

**Five values only, set explicitly, judged on the body's own remit.** A statute or nationwide
procedure is `national` even when a municipality administers it; a named institution whose own
jurisdiction is a sub-unit takes that level.

**Never type a unit name — copy it from `shapeName`.** Four independent catches:
`Tunapuna-Piarco` hyphenated, `Tanitharyi` missing its second `n`, `Mahārāshtra` with macrons,
`Quảng Bình` with diacritics.

**Substring matching on unit names is a shortlist, never a classifier.** It produced garbage in
both directions. Over-matching: `Ica` inside *Mercociudades*, `Cần Thơ` inside *tiếp cận thông
tin*, `Nairobi` on a land trust that sits in Voi. Under-matching: a harvested `shapeName` list
still holding raw `\u00f8` escapes made Norway look clean and hid 83 mis-tiered courts.
Normalise both sides, confirm the harvest decoded, and treat a clean zero as suspect.

**A keyword sweep and independent re-reading fail differently — run both.** Two of the sixteen
amendment rows sit in classes a sweep was built to catch and the sweep missed them; random
sampling found them.

**Enumerate a field's consumers before testing a change to it.** `tagLevels` and
`buildIndexData` both read `tier` and disagreed; a check that measured only the patched path
came out clean and concealed it.

**`kind`, `voice`, `skind` and `restype` failed the same way `tier` did** — the alias patch in
this bundle closes that. Set all four explicitly as you write; `skind` especially, since it is
absent on 63% of entries and drives both its own facet and the media facet.

---

## `skind` — 37% coverage, and how the rest was ruled out

3,167 of 8,563, in two parts. **1,449** from the name: `kind=='journalism'` → `media`, or the
name matched one unambiguous pattern. **1,718** derived from fields you already set —
`kind: institution` + `voice: interpretive` is a clean signal for an NGO, and sampling it gives
Nebraska Land Trust, Trustees for Alaska, Transparency International Italia, CAFO Mali.

Four larger derivations were built and then **dropped after sampling**, which is the point:

- `institution + official → court` (3,570 rows) — the pairing does not mean "government body".
  It contains GEF small grants, COICA and agricultural insurance funds.
- `structured + official → database` (1,013) — about 75%; Lands Tribunal for Scotland is a
  court, Mapeo is a toolset.
- `analyst → research` (125) — plainly wrong; those entries are guides and mechanisms.
- `index`, `prison`, `conduct`, `bar`-by-keyword, `research`-by-keyword — all failed on reading.

`ngo` and `council` beyond this need a judgement per row; nothing in a name or in the existing
fields tells a watchdog NGO from a commission.

The applier reports `3167 rows · 3288 applied`. The extra 121 are entries whose URL appears
both at country level and inside a sub-unit. Setting both is right — a source type does not
change with depth — but the mismatch in the two numbers is real.

## `kind` — a `government` value added, and populated conservatively

`KINDS` is a source-type taxonomy inherited from the judicial map: *Records & data*,
*Investigative journalism*, *Video/YouTube*, *Podcast*, *Blog*, *Newsletter*,
*Advocacy/opinion*, *Aggregator*, *Low-trust/SEO*. This directory is bodies and mechanisms, not
sources. The seven unused values are unused because the directory contains almost no podcasts,
blogs or SEO farms — correct, not a gap. `trust` reading 8,427 `high` is right for the same
reason: ministries, registries, courts and established NGOs are high-trust.

There was one real contradiction, and it is now fixed. **4,227 entries were `institution` +
`official`** — a kind labelled *"Established NGOs, watchdogs, bar associations and research
institutes"* paired with a voice meaning *"published by the government or the body itself."*
Neither existing value fits a ministry.

`patch_index_kind_government.py` adds `['government','Government body', ...]` to `KINDS`, maps it
to `high` in `KIND2TIER` and routes `gov`/`ministry`/`agency`/`authority` to it in `_KIND_ALIAS`.
Three additive edits; no existing value moves and no entry changes trust. `SKINDS` already
carried the concept — `court` is labelled *Government portal* — so this is the matching kind.

**Populating it: 747 rows, not 4,227.** The blanket rule `institution + official → government`
was built and rejected. Sampling it returned GEF small grants, COICA, a Malian farmers'
confederation and a Qatari university centre alongside the ministries — the pairing does not mean
government body. The shipped rule instead requires the name to lead with a public-body word
within its first 45 characters, carry no NGO or IGO marker, and not read as a statute or a
how-to. Sampling 28 of the 747 gave 27 clean and one miss (a ministry's grant call). Under-filling
is the right error here: a value that is present is trusted.

## Open, not touched here

- **`status`** is absent on all 8,563, so `syncHistToggle` hides the historical toggle entirely
  and the dormant/defunct badge code never fires. Filling it means checking whether each body
  still exists, one URL at a time.
- **~140 scattered tier residuals.** Three targeted sweeps have now come back empty: descriptions
  of `national` rows naming one admin-1 unit three or more times gave 28 candidates and zero real
  misses, all capital-city and country-name collisions (`Tobago` inside *Trinidad & Tobago*); and
  110 read from the 1,304 short-named rows where `national` was a default gave zero misses — that
  block is supreme audit institutions, statistical offices and company registries, where a short
  name is a well-known acronym rather than thin evidence. The residual is genuinely scattered.
  Reading all 7,508 with descriptions would find it; nothing cheaper will.
- **The GMO-map repo (`<title>Pre-Birth Rights</title>`) has all three tier defects unfixed.**
  Its `trackerdata.json` is empty, so nothing is hidden there yet — the bugs are latent.
  `patch_index_tier_levels.py` anchors match that file too.
