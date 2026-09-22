# `voiceprint` targets the author, not the detector

The `voiceprint` skill came out of looking at the AI humaniser category — tools like Waldo AI that take model output and rework it so it reads as human-written. Their loop is genuinely well designed: pick a mode, rewrite, then score the result with a built-in checker and iterate until the score is good. The feedback loop is the good idea, and we kept it.

What we did not keep is what the loop is scored against. Those tools score against AI detectors — Turnitin, GPTZero, Originality.ai, Copyleaks — and the headline claim is text that reads as undetectable. `voiceprint` scores against measurements of the user's own writing instead.

This is a technical decision before it is an ethical one. Detectors classify on perplexity (how predictable each token is) and burstiness (variance in sentence rhythm). Moving text away from a detector means moving it toward the *generic human* distribution: raise unpredictability, inject irregularity, break uniformity. Matching a voice means moving text toward *one specific person's* distribution, which is narrow and idiosyncratic. The two targets pull apart. Irregularity added to defeat a classifier is irregularity the author would not have written, so every point of detector score bought that way costs voice fidelity. A detector score is a proxy; distance from the author's measured habits is the thing we actually want.

The ethical consequence follows from the same split. A tool aimed at the author is used to sound like yourself; a tool aimed at the detector is used to conceal that a machine wrote it. The skill therefore states in scope that it does not score against classifiers and is not for passing off AI work where authorship disclosure is owed.

Two design rules fall out of this:

- **Every rule in a `VOICEPRINT.md` is countable or quotable.** Adjective-based style guides ("conversational", "dry") do not transfer, because each model resolves those words differently. A number from `voice-stats.mjs` or a line the author actually wrote does transfer.
- **Measurement is a script, not a judgement call.** `scripts/voice-stats.mjs` computes the statistics so the audit table reports facts rather than the model's impression of its own output. Burstiness is normalised (standard deviation ÷ mean) rather than raw, because raw standard deviation rises with sentence length and so fails to separate long-uniform prose from short-varied prose — verified against controls during development.
