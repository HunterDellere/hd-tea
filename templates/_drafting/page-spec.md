# Page authoring spec

Source of truth is `content/<category>/<slug>.md`: YAML frontmatter + an HTML body. The build generates the hero, sidebar TOC, sources block, and chrome; the body you author starts at the first section.

## Frontmatter by page type

Common: `type`, `category`, `title`, `native` (CJK, optional), `reading` (romanization, optional), `desc` (<25 words), `metaDesc`, `tags`, `status`, `updated`, `content_review`, `content_sources`.

- **tea / tisane** add: `tea_type` (green|white|yellow|oolong|black|dark|tisane), `liquor` ("#hex" of the brewed mid-tone; drives the cup atom everywhere), `origin` (region slug), `cultivar`, `elevation_m`, `oxidation`, `roast`, `harvest_season`, `steeps` ({temp_c, grams, ml, vessel, rinse, times[], note}).
- **region** add: `country`, `elevation_range`, `known_for[]`, `map` ({center: [lon, lat], span_km, elevation_label, water_label, markers[{name, lon, lat, primary}], caption}). Coordinates are real: markers render at true positions on a Mercator window over vendored Natural Earth data, so a wrong lon/lat is a visible bug, not a style choice. Verify coordinates like any other fact.
- **hub** add: `hub_key` (library|origins|craft|table).

## Body conventions

Section pattern (the TOC is generated from these):

```html
<span class="section-anchor" id="terroir"></span>
<div class="section-head">
  <span class="sh-title">The cliffs</span>
  <span class="sh-native">正岩</span>
  <span class="sh-en">Terroir</span>
</div>
```

Markers the build replaces:

- `<!--STEEP_CURVE-->` → steep timeline from `steeps:` (teas/tisanes)
- `<!--TERROIR_MAP-->` → terroir map panel from `map:` (regions)
- `<!--HUB_MEMBERS-->` → member listing (hubs)

Components available (see style.css):

- `.note` with `note-label` and optional `data-mark="茶"` watermark: the close-reading box.
- `.meta-list` (`<dl>` of spec rows), `.cards`/`.card[data-category]`, `.chips`/`.chip`, `.table-wrap > table`, `.adj-wrap > .adj` related chips.

## Liquor hex guidance

Brew the tea in your head at standard parameters and pick the mid-tone in a white cup. Anchors: longjing #c9d38f, silver needle #e3d09a, high-mountain oolong #d3c878, roasted yancha #b3742a, dianhong #a04e1c, ripe puer #57290d, chamomile #dcb95e, hibiscus #a52a3c, rooibos #b05a30, peppermint #b9c98a.

## Workflow for a new page

1. Draft in `local/` or straight into `content/` with `status: stub`.
2. Write the body per this spec and VOICE.md. Run the humanizer pass (templates/_drafting/humanizer-SKILL.md) on every draft.
3. `npm run verify`. Fix every ERROR; take every WARN seriously.
4. Facts: work through factual-review.md, populate `content_sources`, flip `content_review` when earned.
5. `status: complete`, `updated: today`, rebuild.
