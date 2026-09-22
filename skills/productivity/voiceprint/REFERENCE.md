# Voiceprint reference

## VOICEPRINT.md format

One file per author. Every rule carries a measured target, a tolerance, and evidence in the author's own words.

```markdown
# Voiceprint — <name>

Calibrated <date> from <n> samples: <list them>.
Re-run `voice-stats.mjs` on new samples every few months; voice drifts.

## Rhythm

- Median sentence length **14w** (±3). Observed 12–16 across samples.
- Sentences under 8 words: **22%** (±8). This is the load-bearing one — it is what
  makes the prose sound spoken.
- Burstiness **0.45**, never below 0.35.
- Sentences over 30 words: **under 5%**.
- Evidence: "This isn't new. It's the oldest problem in software, and the AI age
  just made it faster."

## Openers

- **60%** of paragraphs open with a declarative under 10 words.
- Opens on a conjunction (But/And/So) **15%** of the time. Not zero — it is a move,
  not a tic.
- Evidence: "The fix is a grilling session."

## Punctuation signature

- Em-dashes **0.4** per 100 words (±0.4). Low. Do not reach for them.
- Semicolons: **0**. Never uses them.
- Parentheticals **0.8** per 100 words.
- Questions **0.8** per 100 words — usually rhetorical, usually answered immediately.
- Evidence: "Does it work every time? No."

## Lexicon

- Reaches for: failure mode, actually, the fix, it turns out, ship
- Never uses: delve, leverage (as a verb), robust, seamless, crucial, utilise,
  "it's not just X, it's Y"
- Contractions always. "Do not" only for emphasis.

## Structure

- List share **20%** — prose carries the argument, lists carry parallel items only.
- Median paragraph **32w**, 2–3 sentences.
- Headings every 150–250 words in long-form.

## Stance moves          <!-- manual: the script cannot count these -->

- Concedes before pushing back: raises the strongest objection, then answers it.
- Ends on the smallest concrete claim, never a summary of what was just said.
- Never opens with throat-clearing about why the topic matters.

## Short form            <!-- calibrate separately if short samples exist -->

- Median 9w. Two sentences typical, four maximum.
- No em-dashes. No headings. One idea.
- Opens with the specific thing observed, not a compliment.
```

## Dimension catalogue

| Dimension | Source | Notes |
|---|---|---|
| Sentence length distribution | script | `sentenceLength.median`, `p25`, `p75`, `pctUnder8`, `pctOver30` |
| Burstiness | script | `sentenceLength.burstiness` — sd ÷ mean, so it is scale-free |
| Paragraph size | script | `paragraphLength`, `sentencesPerParagraph` |
| Punctuation signature | script | `punctuationPer100Words` |
| Opener shapes | script | `openers.*` plus `firstWords` to eyeball |
| List vs prose | script | `volume.listShare` |
| Lexicon — reaches for | script | `lexicon.topWords`, `repeatedBigrams`, `repeatedTrigrams` |
| Lexicon — never uses | script + read | `genericPhrases` gives the starting list; add what you notice |
| Stance moves | **manual** | Concession, hedging, how a piece lands |
| Register shifts | **manual** | Where they get formal, where they swear, where they joke |
| What they refuse to say | **manual** | Often the sharpest signal in the whole voiceprint |

Three samples in different formats is the minimum. With one sample you are measuring that format, not the person.

## Reading the script output

- `burstiness` — sd ÷ mean sentence length. Uniform prose sits near 0.2; varied prose sits near 0.45+. Raw `sd` is also printed but does not compare across texts, because it rises with sentence length.
- `pctUnder8` — the share of sentences under 8 words. The single best proxy for prose that sounds spoken. Generic model output routinely scores 0%.
- `genericPhrases` — hits from a fixed list of phrases that appear far more in model output than in real writing. A hit is a place to look, not a verdict. If the author genuinely says "crucial" twice a page, record that as *their* rule and stop flagging it.
- Code blocks and tables are excluded from all prose statistics. Headings and list items are counted but kept out of the sentence numbers.
- `AGGREGATE` appears only when more than one file is passed. Use it for targets; use the per-file blocks to see format variance.

Machine-readable output for scripting: `node scripts/voice-stats.mjs --json <file>`.

## Fixing a FAIL row

Rewriting the whole draft on any failure loses the parts that were already right. Match the fix to the row:

| Failing row | The actual fix |
|---|---|
| Median too high | Split the longest third of sentences. Most carry two claims — give each its own. |
| `pctUnder8` too low | Add short sentences between long ones. A three-word sentence after a thirty-word one does more than shortening both. |
| Burstiness too low | Do not shorten everything — that keeps it uniform. Deliberately vary: long, long, short. |
| Em-dashes too high | Most become a full stop or a comma. Keep the one doing real work. |
| Generic phrase hits | Replace with the plain word. `delve into` → `look at`. `leverage` → `use`. `robust` → say what it survives. |
| Openers too long | Cut the ramp-up clause. The second sentence is usually the real opening. |
| List share too high | Lists that aren't parallel items are prose in disguise. Convert them back. |
| Lexicon miss | Substitute the author's word. If they say "failure mode", never write "pain point". |

## Reply mode notes

- Measure short samples separately. Someone who writes 14-word sentences in essays often writes 7-word ones in replies.
- Platform limits worth knowing: X ~280 chars, LinkedIn comments ~1,250 chars, Hacker News effectively unlimited but terse by convention.
- The three angles that reliably work: **name the mechanism** (what specifically is clever, in one clause), **the sharp question** (what the post leaves unanswered), **the lived experience** (what happened when you tried the thing).
- Generic praise reads as generic regardless of how well it matches the voiceprint. A passing audit on an empty sentence is still an empty sentence.
