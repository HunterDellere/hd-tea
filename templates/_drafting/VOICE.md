# Voice & copy principles

hd-tea is written as a working tea master's notebook for adult readers: a person who buys, brews, and sells tea for a living, talking plainly to a client who is interested but hasn't done the reading. Not a lifestyle blog, not a museum caption, not a wellness brand.

## Tone

- Confident and specific. Make assertions. Avoid hedging ("arguably", "perhaps", "in some sense").
- Concrete over abstract. Name the mountain, the cultivar, the year, the temperature, the source. A vague gesture is worse than a specific claim that might need correction (the review pipeline exists to correct it).
- One observation per sentence when the observation is interesting. Long sentences are fine when they earn their length.
- Real disagreement gets named, not flattened. Roast levels divide Wuyi producers; brewing parameters divide everyone. Say who holds which position and why, or commit to the house position.
- The palate is allowed to be personal. "The third steep is where this tea earns its price" is house voice. "This exquisite tea delights the senses" is banned slop.

## Patterns to avoid

These are the tells of LLM-generic writing. Strip them on sight.

- **Em-dashes are banned in prose. Zero, no exceptions.** They are the single clearest AI tell, and `build/validate-voice.mjs` enforces a budget of 0 as an ERROR; any em-dash blocks the build and the pre-push hook. Rewrite with a comma, semicolon, colon, parenthetical, or a sentence split. En-dashes stay legal only inside numeric ranges (551–479 BCE, 15–20%, 1,000–1,600 m).
- **"It's not X, it's Y" / "Not just X, but Y" parallelism.** Replace with the direct claim. The validator WARNs on this shape.
- **Throat-clearing openings.** Skip "It is worth noting that…", "One might argue…". Say the thing.
- **Tricolons of three short phrases** in every paragraph. Once in a while is fine; as a rhythm it reads as filler.
- **"In the end" / "ultimately" / "at its core".** Almost always cuttable.
- **Trailing summary sentences** that restate the paragraph.
- **Promotional register.** "Nestled", "renowned", "breathtaking", "exquisite", "time-honored", "hidden gem", "rich cultural heritage" are all validator WARNs. Tea marketing is drowning in this language; the site's credibility depends on never sounding like it.

## Patterns to keep

- Parenthetical native terms: 岩韵 (yán yùn, "rock rhyme"), 杀青 (shājīng, kill-green), chanoyu (茶の湯). Useful and distinctive; the CJK-capable font stack is loaded on every page.
- Numbers with units, precisely: 95°C, 5 g : 100 ml, 1,413 m, 15–20% oxidation. Mono type is reserved for exactly this data.
- Sensory description tied to cause. Don't just say "creamy": say the mist slows photosynthesis, amino acids accumulate, and the liquor thickens. The craft pages exist so tasting notes can point at mechanisms.
- Explicit cross-reference to other entries by name when directly relevant.
- Honest unknowns. Where the record is thin (most cultivar origin stories), say the record is thin. Never invent a legend and never launder one into fact; label legends as legends.

## Health claims (tisanes especially)

This site describes flavor, craft, and tradition. It does not make medical claims.

- **Hard claims are build ERRORs** on teas and tisanes: cure, treat, prevent, detox, "clinically proven".
- **Soft claims WARN**: antioxidant, anti-inflammatory, boosts immunity, aids digestion, wellness. Either cite a named institutional source (Commission E, EMA herbal monographs) as a statement about *traditional use status*, or cut the sentence.
- The safe register is attribution: "German pharmacopoeia tradition classifies chamomile as a digestive herb" is checkable; "chamomile aids digestion" is a claim we cannot stand behind.

## Lengths

- `desc`: one sentence, under 25 words. Renders on cards and hub rows; should make a curious reader click.
- `metaDesc`: one or two sentences, around 150–160 characters.
- Body paragraphs: 2–5 sentences typical.
- Tasting chips: 1–3 words each, lowercase, concrete nouns ("wet stone", not "minerality vibes").

## Topic page failure modes

Craft and region pages fail into survey-lecture register: facts arranged chronologically without an argument, every claim hedged, nothing at stake. Specific kills:

- **"Throughout history, tea has been…"** Find the dynasty, the ship manifest, the trade ledger.
- **"Many connoisseurs believe…"** The validator flags it. Pick the defensible reading and commit, or name the sides.
- **Chronological survey as structure.** Lead with what makes the region or process interesting now, then give the history that explains it.
- **The closing "significance" paragraph.** End on a concrete image, a number, a named tea, or an observation. Not a verdict about meaning.

## AI tells (humanizer ruleset)

The full ruleset is vendored verbatim at `templates/_drafting/humanizer-SKILL.md` (from github.com/blader/humanizer, which distills Wikipedia's "Signs of AI writing"). Machine-checkable patterns are enforced by `build/validate-voice.mjs`:

- **ERROR**: em-dashes, double-hyphen dashes, hard health claims.
- **WARN**: significance inflation (testament, tapestry, pivotal, showcase, vibrant, delve, deeply rooted), promotional language, copula avoidance (serves as / stands as), vague attribution, signposting, chatbot closers, negative parallelism, false ranges, slow openings, soft health claims.

Judgment-level tells the validator cannot catch (superficial -ing tails, elegant variation, staccato drama, aphorism formulas, speculative gap-filling): run the humanizer process on every draft before it lands. Draft, then ask "what makes this obviously AI generated?", then rewrite. Every page.

House deviations from the humanizer defaults:

- **Personality injection**: the humanizer's "add mess and first person" guidance applies to personal essays. This register is a practitioner's notebook: confident, concrete, third person with occasional first-person palate calls. De-AI by cutting tells, not by adding chattiness.
- **Boldface**: bolding native terms and key vocabulary in prose is house style; mechanical bold-header bullet lists are not.
- **Curly quotes**: fine.

## The tells the validator will not catch (enforce these by hand)

The machine gate passes prose that still reads as AI. These judgment-level patterns are the ones that slipped through on the first content pass and got flagged by the reader; treat them as a hard banlist and check every draft against them:

- **Manufactured punchlines.** Do not end paragraphs on an engineered closer ("leaving money in the pot," "come back in the autumn," "the fastest way to calibrate your own view"). End where the information ends. If the last sentence sounds quotable, it is probably a tell; make it plain or cut it.
- **The X-is-a-Y-before-it-is-a-Z / not-X-it-is-Y aphorism.** "A tea is a place before it is a flavor." "Wuyi's argument is not altitude, it is soil." Both banned. State the fact directly.
- **"The trick is," "the real question is," "what matters is."** Ceremony before an ordinary point. Delete the frame; keep the point.
- **Persona thickening.** Occasional first-person palate calls are house voice; a knowing coach voice laid on every paragraph ("wants boiling water and a fast hand") is a performance. Let most sentences be flat and factual.
- **Tricolon rhythm as default.** "Boiling water, a real five minutes, a lid on top." Once is fine; as a cadence it reads as filler.
- **The tidy summary closer** that restates the paragraph's point with a little flourish.

The test is not whether each sentence is well made. It is whether the paragraph sounds like a person telling you something because it is true and useful, or like a writer performing expertise. When several sentences in a row sound performed, rewrite the whole paragraph, not the words.

## When in doubt

Read the paragraph aloud. If it sounds like a person who has spent years at the tasting table talking to a client over an open gaiwan, keep it. If it sounds like a smooth stranger writing tea marketing, cut.
