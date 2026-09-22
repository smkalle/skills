---
name: voiceprint
description: Build a measured profile of how the user actually writes, then rewrite AI drafts to match it and audit the result rule by rule — for long-form pieces or short social replies. Use when the user wants writing to sound like them, mentions their voice, style or tone, wants an AI draft de-slopped, or needs a reply drafted in their own voice.
---

# Voiceprint

Most "write in my voice" attempts fail because they hand the model adjectives. This one measures the user's actual habits, then checks the output against those numbers.

```text
3+ real samples  → voice-stats.mjs → VOICEPRINT.md          (calibrate: once)
draft + VOICEPRINT.md → rewrite → voice-stats.mjs → audit → revise   (apply: every time)
```

The script lives at `scripts/voice-stats.mjs` inside this skill. It needs Node 18+ and has no dependencies.

## The rule that makes this work

**Every rule must be countable or quotable.** A number from `voice-stats.mjs`, or a line the user actually wrote. "Conversational", "punchy", "dry" resolve differently for every model and every reader — they are not rules, they are vibes. If it can't be measured or quoted, it does not go in the voiceprint.

## Calibrate

1. Ask for **three or more samples in different formats** — an essay, a batch of messages, a talk transcript. Patterns that survive all three are voice. Patterns in only one are format.
2. Measure them together:
   ```bash
   node scripts/voice-stats.mjs sample1.md sample2.md sample3.md
   ```
   Read the `AGGREGATE` block for targets, and the per-file blocks for how much the user varies by format.
3. Read the samples yourself for what the script cannot count: how they open, how they hedge, how they concede a point, how they land an ending, what they never say.
4. Write `VOICEPRINT.md`. Ask once where to save it, then remember that path for the session.

Every rule gets a target from the aggregate, a tolerance, and one quoted line of the user's own writing as evidence. Format and full dimension list: [REFERENCE.md](REFERENCE.md).

## Apply

1. **Re-read `VOICEPRINT.md` from disk first.** The user edits it between sessions.
2. Rewrite the draft against the rules.
3. Measure the rewrite: `node scripts/voice-stats.mjs draft.md`.
4. Print the audit table — every rule, its target, what the draft actually measured, and a verdict:

   | Rule | Target | This draft | Verdict |
   |---|---|---|---|
   | Median sentence length | 14w (±3) | 21w | FAIL |
   | Sentences under 8 words | 22% (±8) | 4% | FAIL |
   | Burstiness | 0.45 (min 0.35) | 0.21 | FAIL |
   | Em-dashes / 100 words | 0.4 (±0.4) | 3.1 | FAIL |
   | Generic phrases | 0 | 2 (`delve`, `leverage`) | FAIL |
   | Opens on a short declarative | 60% (±15) | 20% | FAIL |

5. Revise **only the FAIL rows**, then re-measure. Passing rules are already right; rewriting them wholesale loses ground.
6. Stop when everything passes, or when the user says it's close enough.

Never report a PASS you have not measured. For rules the script can't check, mark the row `manual` and say what was checked by eye.

## Reply mode

Short-form is its own voice, not long-form compressed. If the user has short samples (comments, posts, replies), calibrate a separate `## Short form` section in the voiceprint.

Given a post to reply to:

1. Draft **2–3 candidates** under the platform limit, each on a different angle — name the one mechanism that is genuinely clever; ask the sharp question; report the lived experience.
2. Audit each against the short-form rules, same table.
3. Show all candidates with their audits. The user picks or hybridises — do not pick for them.

Keep the praise specific. "Clever approach" is a sentence anyone could write about anything; naming the mechanism is a sentence only someone who looked could write.

## Out of scope

- **AI detectors.** This does not score against GPTZero, Turnitin, Originality.ai, Copyleaks or any classifier, and makes no "undetectable" claim. Detector evasion pushes text toward generic-human statistics; a voiceprint pushes it toward one specific person. The two objectives conflict — see [ADR 0002](../../../docs/adr/0002-voiceprint-targets-the-author-not-the-detector.md).
- **Disguising authorship where disclosure is owed** — coursework, bylines, ghostwriting terms. Say so plainly and stop.
- **Inventing a voice from nothing.** No samples means no voiceprint. Ask for samples; do not guess from the user's chat messages alone and call it measured.
