#!/usr/bin/env node
// voice-stats.mjs — measure the countable habits of a piece of writing.
//
//   node voice-stats.mjs <file> [...more files]   # per-file, plus an aggregate if >1
//   cat draft.md | node voice-stats.mjs           # from stdin
//   node voice-stats.mjs --json <file>            # machine-readable
//
// Zero dependencies. Every number here is a fact about the text, not a judgement
// about it. Nothing in this file knows or cares what an AI detector thinks.

import { readFileSync } from "node:fs";

// ---------------------------------------------------------------- markdown

const FENCE = /^(```|~~~)/;
const BULLET = /^\s*([-*+]|\d+[.)])\s+/;

function cleanInline(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`[^`]*`/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*?/g, "")
    .replace(/(?<![A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])/g, "$1");
}

// Splits a markdown document into the parts we measure separately. Code blocks
// and tables are dropped outright — they are not prose and would wreck the
// sentence statistics.
function parseDocument(raw) {
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  const headings = [];
  const listItems = [];
  const proseLines = [];
  let codeBlocks = 0;
  let inFence = false;

  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (FENCE.test(t)) {
      if (!inFence) codeBlocks++;
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (/^#{1,6}\s/.test(t)) {
      headings.push(cleanInline(t.replace(/^#+\s*/, "")));
      proseLines.push("");
    } else if (BULLET.test(line)) {
      listItems.push(cleanInline(line.replace(BULLET, "")));
      proseLines.push("");
    } else if (/^\|/.test(t) || /^<!--/.test(t) || /^(---|===|\*\*\*)+$/.test(t)) {
      proseLines.push("");
    } else if (/^>\s?/.test(t)) {
      proseLines.push(t.replace(/^>\s?/, ""));
    } else {
      proseLines.push(line);
    }
  }

  const proseText = cleanInline(proseLines.join("\n"));
  const paragraphs = proseText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return { proseText, paragraphs, headings, listItems, codeBlocks };
}

// ---------------------------------------------------------------- sentences

const ABBREV = /\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|approx|fig|no|vol|e\.g|i\.e|u\.s|a\.m|p\.m)\.$/i;

const wordsOf = (s) => s.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || [];

function splitSentences(paragraph) {
  const parts = paragraph.split(/(?<=[.!?…]["'’)\]]?)\s+/);
  const out = [];
  for (const part of parts) {
    if (out.length && ABBREV.test(out[out.length - 1])) out[out.length - 1] += " " + part;
    else out.push(part);
  }
  return out.map((s) => s.trim()).filter((s) => wordsOf(s).length > 0);
}

// ---------------------------------------------------------------- numbers

const round = (n, d = 1) => (Number.isFinite(n) ? Number(n.toFixed(d)) : 0);

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function describe(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = n ? sorted.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n ? sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n : 0;
  const pct = (fn) => (n ? round((sorted.filter(fn).length / n) * 100) : 0);
  return {
    count: n,
    mean: round(mean),
    median: round(quantile(sorted, 0.5)),
    p25: round(quantile(sorted, 0.25)),
    p75: round(quantile(sorted, 0.75)),
    min: n ? sorted[0] : 0,
    max: n ? sorted[n - 1] : 0,
    stdev: round(Math.sqrt(variance)),
    // Burstiness has to be scale-free. Raw standard deviation rises with mean
    // sentence length, so long-and-uniform prose scores the same as
    // short-and-varied prose. Dividing by the mean separates them.
    burstiness: mean ? round(Math.sqrt(variance) / mean, 2) : 0,
    pctUnder5: pct((v) => v < 5),
    pctUnder8: pct((v) => v < 8),
    pctOver30: pct((v) => v > 30),
  };
}

// ---------------------------------------------------------------- lexicon

const STOP = new Set(
  ("a an the and or but so if then than that this these those of to in on at by for with from as is are was were be been being it its it's i you he she they we me my your our their his her them us do does did done have has had not no nor can could will would shall should may might must about into over under out up down just very more most some any all each other such own same too only own").split(
    " ",
  ),
);

// Phrases that show up far more in generic model output than in anyone's actual
// writing. A hit is not a verdict — it is a line to go and look at.
const TELLS = [
  ["delve", /\bdelv(e|es|ing|ed)\b/gi],
  ["leverage (verb)", /\bleverag(e|es|ing|ed)\b/gi],
  ["tapestry", /\btapestry\b/gi],
  ["realm / landscape", /\b(realm|landscape)s?\b/gi],
  ["navigate the", /\bnavigat(e|ing) the\b/gi],
  ["it's not just X, it's Y", /\b(it'?s|is) not (just|only|merely)\b/gi],
  ["not only ... but also", /\bnot only\b[^.!?]{0,80}\bbut also\b/gi],
  ["in today's ...", /\bin today'?s\b/gi],
  ["furthermore / moreover", /\b(furthermore|moreover|additionally)\b/gi],
  ["robust / seamless", /\b(robust|seamless|seamlessly)\b/gi],
  ["crucial / vital / pivotal", /\b(crucial|vital|pivotal)\b/gi],
  ["underscore / testament", /\b(underscor(e|es|ing|ed)|a testament to)\b/gi],
  ["dive into / unlock / elevate", /\b(dive into|unlock(s|ing)?|elevat(e|es|ing))\b/gi],
  ["game-changer", /\bgame[- ]chang(er|ing)\b/gi],
  ["at the end of the day", /\bat the end of the day\b/gi],
];

function ngrams(words, n, minCount) {
  const counts = new Map();
  for (let i = 0; i + n <= words.length; i++) {
    const gram = words.slice(i, i + n).join(" ");
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([gram, count]) => ({ gram, count }));
}

// ---------------------------------------------------------------- measure

function measure(raw) {
  const { proseText, paragraphs, headings, listItems, codeBlocks } = parseDocument(raw);

  const sentences = paragraphs.flatMap(splitSentences);
  const sentenceLengths = sentences.map((s) => wordsOf(s).length);
  const words = wordsOf(proseText);
  const per100 = (n) => (words.length ? round((n / words.length) * 100, 2) : 0);
  const hits = (re) => (proseText.match(re) || []).length;

  const openers = paragraphs.map((p) => splitSentences(p)[0]).filter(Boolean);
  const openerPct = (fn) =>
    openers.length ? round((openers.filter(fn).length / openers.length) * 100) : 0;

  const lower = words.map((w) => w.toLowerCase());
  const content = lower.filter((w) => !STOP.has(w) && w.length > 2);
  const freq = new Map();
  for (const w of content) freq.set(w, (freq.get(w) || 0) + 1);

  return {
    volume: {
      words: words.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      headings: headings.length,
      listItems: listItems.length,
      codeBlocks,
      listShare:
        paragraphs.length + listItems.length
          ? round((listItems.length / (paragraphs.length + listItems.length)) * 100)
          : 0,
    },
    sentenceLength: describe(sentenceLengths),
    paragraphLength: describe(paragraphs.map((p) => wordsOf(p).length)),
    sentencesPerParagraph: describe(paragraphs.map((p) => splitSentences(p).length)),
    punctuationPer100Words: {
      emDash: per100(hits(/—|--/g)),
      semicolon: per100(hits(/;/g)),
      colon: per100(hits(/:/g)),
      comma: per100(hits(/,/g)),
      parenthetical: per100(hits(/\(/g)),
      question: per100(hits(/\?/g)),
      exclamation: per100(hits(/!/g)),
      ellipsis: per100(hits(/…|\.\.\./g)),
    },
    openers: {
      pctConjunction: openerPct((s) => /^(but|and|so|yet|or|because|still|then)\b/i.test(s)),
      pctPronoun: openerPct((s) => /^(i|we|you|it|this|that|there|they|he|she)\b/i.test(s)),
      pctQuestion: openerPct((s) => s.trim().endsWith("?")),
      pctShortDeclarative: openerPct((s) => wordsOf(s).length < 10),
      firstWords: openers.slice(0, 12).map((s) => wordsOf(s).slice(0, 3).join(" ")),
    },
    lexicon: {
      topWords: [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word, count]) => ({ word, count })),
      repeatedBigrams: ngrams(content, 2, 2),
      repeatedTrigrams: ngrams(content, 3, 2),
    },
    genericPhrases: TELLS.map(([label, re]) => ({ label, count: hits(re) })).filter(
      (t) => t.count > 0,
    ),
  };
}

// ---------------------------------------------------------------- output

function renderTable(name, m) {
  const s = m.sentenceLength;
  const p = m.punctuationPer100Words;
  const lines = [
    `\n=== ${name} ===`,
    `  ${m.volume.words} words · ${m.volume.sentences} sentences · ${m.volume.paragraphs} paragraphs · ${m.volume.headings} headings · ${m.volume.listItems} list items`,
    ``,
    `  RHYTHM      median ${s.median}w   IQR ${s.p25}-${s.p75}w   range ${s.min}-${s.max}w   burstiness ${s.burstiness} (sd ${s.stdev})`,
    `              under 5w ${s.pctUnder5}%   under 8w ${s.pctUnder8}%   over 30w ${s.pctOver30}%`,
    `  PARAGRAPHS  median ${m.paragraphLength.median}w   median ${m.sentencesPerParagraph.median} sentences   list share ${m.volume.listShare}%`,
    `  PUNCTUATION per 100 words: em-dash ${p.emDash}  semicolon ${p.semicolon}  colon ${p.colon}  comma ${p.comma}  paren ${p.parenthetical}  ? ${p.question}  ! ${p.exclamation}`,
    `  OPENERS     conjunction ${m.openers.pctConjunction}%   pronoun ${m.openers.pctPronoun}%   question ${m.openers.pctQuestion}%   short (<10w) ${m.openers.pctShortDeclarative}%`,
  ];

  if (m.lexicon.topWords.length) {
    lines.push(
      `  TOP WORDS   ${m.lexicon.topWords.map((w) => `${w.word}(${w.count})`).join("  ")}`,
    );
  }
  if (m.lexicon.repeatedTrigrams.length) {
    lines.push(
      `  REPEATED    ${m.lexicon.repeatedTrigrams.map((g) => `"${g.gram}" x${g.count}`).join("  ")}`,
    );
  }
  if (m.genericPhrases.length) {
    lines.push(
      `  GENERIC     ${m.genericPhrases.map((t) => `${t.label} x${t.count}`).join("  ")}`,
    );
  } else {
    lines.push(`  GENERIC     none found`);
  }
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const files = args.filter((a) => a !== "--json");

  const sources = [];
  if (files.length) {
    for (const file of files) {
      try {
        sources.push({ name: file, raw: readFileSync(file, "utf8") });
      } catch (err) {
        console.error(`voice-stats: cannot read ${file}: ${err.message}`);
        process.exitCode = 1;
      }
    }
  } else {
    let raw = "";
    try {
      raw = readFileSync(0, "utf8");
    } catch {
      raw = "";
    }
    sources.push({ name: "stdin", raw });
  }

  if (!sources.length) return;

  const results = sources.map((s) => ({ name: s.name, metrics: measure(s.raw) }));
  if (sources.length > 1) {
    results.push({
      name: "AGGREGATE (all samples)",
      metrics: measure(sources.map((s) => s.raw).join("\n\n")),
    });
  }

  if (asJson) {
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
    return;
  }

  for (const r of results) {
    if (r.metrics.volume.words === 0) {
      console.log(`\n=== ${r.name} ===\n  no prose found (empty, or only code/tables/headings)`);
      continue;
    }
    console.log(renderTable(r.name, r.metrics));
  }
  console.log("");
}

main();
