# Factual review checklist

Every complete page carries `content_review` frontmatter: `verified`, `pending`, or `unverified`. Complete pages default to `pending`. The status is internal only (it never renders on public pages), but nothing should be promoted on the homepage or linked in client-facing material until it is `verified`. The site's promise is zero hallucinated facts; this checklist is how a page earns that.

## What the build checks automatically

`npm run check` runs three gates:

1. **Schema** (`validate.mjs`): complete pages must carry `content_review` and `updated`; `verified` requires non-empty `content_sources`.
2. **Voice** (`validate-voice.mjs`): em-dash budget 0 (ERROR), AI-tell vocabulary (WARN), hard health claims (ERROR on teas/tisanes), soft health claims (WARN).
3. **Claims** (`validate-claims.mjs`):
   - `verified` pages must cite sources registered in `data/_reference/known-sources.json` (unknown labels WARN). Regions and tisanes need ≥2 sources.
   - Names in `data/_reference/canonical-claims.json` cited near a year must match the registry (ERROR; WARN when softened with "c.").
   - Any name cited with a year range must carry the same range on every page (cross-page consistency, ERROR).

## Before flipping `pending → verified`

1. **Every proper noun**: mountain, cultivar, village, dynasty, person, institution. Confirm spelling and romanization against a listed source. Pick one romanization per name and keep it site-wide.
2. **Every number**: elevations, temperatures, oxidation percentages, dates, altitudes, distances. Confirm against a source, not memory. Where sources disagree (elevations often do), cite the range and say sources vary.
3. **Cultivar and botanical claims**: variety names against Kew/TRES-grade sources. Camellia sinensis var. sinensis vs var. assamica attributions are a classic error site.
4. **Process claims**: oxidation chemistry, firing temperatures, withering times. Gebely and Gascoyne are the working references; disagreements between them get noted, not averaged.
5. **History and legend**: tea history is mostly legend laundered into fact (Shennong, Bodhidharma's eyelids, monkeys picking tea). Legends are welcome on the page *labeled as legends*. Dates and trade history come from Mair & Hoh or equivalent.
6. **Tisane safety and tradition**: traditional-use statements cite Commission E or EMA monographs as statements about *status*, never as endorsements. No dosage guidance, ever.
7. **Populate `content_sources`** with registered labels ("Gascoyne", "Mair & Hoh", "UNESCO", …). Add new sources to `known-sources.json` deliberately before citing them.
8. **Add shared facts to `canonical-claims.json`**: any fact that appears on two or more pages (a person's dates, an inscription year, a cultivar number) belongs in the registry so drift becomes a build error.
9. Flip `content_review: verified`, set `updated` to today, run `npm run verify`.

## Common error patterns

- Elevation inflation: marketing routinely rounds gardens up 200–400 m. Cite the range from a source, not a vendor page.
- "High mountain" (高山) used loosely: in Taiwan the trade convention is ≥1,000 m. Say the convention, then the garden's actual figure.
- Cultivar/varietal/type confusion: Tieguanyin is a cultivar *and* a tea; Da Hong Pao is a tea whose commercial form is mostly blends of Wuyi cultivars. Be precise about which sense a sentence uses.
- Age claims on trees and aged teas: almost never verifiable. Attribute ("the producer dates the trees to…") or bracket honestly.
- Yield/production statistics: only from FAO or ITC, with the year.
