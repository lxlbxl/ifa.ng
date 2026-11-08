// Pure functions: accuracy / sanity checks on a transcript. No network.

const LANG_NAMES = { yoruba: "yo", english: "en", yo: "yo", en: "en", "yo-ng": "yo", "en-ng": "en", "en-us": "en", "en-gb": "en" };
export const normalizeLanguage = (l) => LANG_NAMES[String(l || "").toLowerCase()] || (l ? String(l).toLowerCase().slice(0, 2) : null);

const YORUBA_MARKS = /[ẹọṣẸỌṢàáèéìíòóùúńǹÀÁÈÉÌÍÒÓÙÚŃǸ]/g;
const LETTERS = /\p{L}/gu;

export function yorubaMarkRatio(text) {
  const letters = (text.match(LETTERS) || []).length;
  if (!letters) return 0;
  return (text.match(YORUBA_MARKS) || []).length / letters;
}

/** Detects looping/hallucinated repetition: share of 4-grams that repeat >3 times. */
export function repetitionScore(text) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 40) return 0;
  const counts = new Map();
  for (let i = 0; i + 4 <= words.length; i++) {
    const g = words.slice(i, i + 4).join(" ");
    counts.set(g, (counts.get(g) || 0) + 1);
  }
  let repeated = 0, total = 0;
  for (const c of counts.values()) { total += c; if (c > 3) repeated += c; }
  return total ? repeated / total : 0;
}

/**
 * segments: [{start,end,text,avg_logprob?,no_speech_prob?,compression_ratio?,confidence?}]
 * Returns { score (0..1), confidence, flags[], needs_review, metrics }
 */
export function assessTranscript({ text, segments = [], durationSeconds = 0, language = null, opts = {} }) {
  const flags = [];
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(durationSeconds / 60, 0.01);
  const wpm = words / minutes;

  // Confidence from provider signals when present.
  const lp = segments.filter((s) => typeof s.avg_logprob === "number");
  let confidence = null;
  if (lp.length) {
    const w = lp.reduce((a, s) => a + Math.max(0.1, (s.end - s.start) || 1), 0);
    const mean = lp.reduce((a, s) => a + s.avg_logprob * Math.max(0.1, (s.end - s.start) || 1), 0) / w;
    confidence = Math.max(0, Math.min(1, Math.exp(mean)));
  } else {
    const cs = segments.filter((s) => typeof s.confidence === "number");
    if (cs.length) confidence = cs.reduce((a, s) => a + s.confidence, 0) / cs.length;
  }
  const lowConfFrac = lp.length ? lp.filter((s) => s.avg_logprob < -1.0).length / lp.length : 0;
  const noSpeechFrac = segments.length ? segments.filter((s) => (s.no_speech_prob ?? 0) > 0.6).length / segments.length : 0;
  const compressedFrac = segments.length ? segments.filter((s) => (s.compression_ratio ?? 0) > 2.4).length / segments.length : 0;
  const rep = repetitionScore(text);
  const marks = yorubaMarkRatio(text);

  let score = confidence ?? 0.7;
  if (!text.trim() || words < 5) { flags.push("empty_transcript"); score = 0; }
  if (durationSeconds > 120 && wpm < 15) { flags.push("sparse_transcript"); score = Math.min(score, 0.4); }
  if (wpm > 260) { flags.push("implausible_speech_rate"); score = Math.min(score, 0.4); }
  if (lowConfFrac > 0.35) { flags.push("many_low_confidence_segments"); score *= 0.8; }
  if (noSpeechFrac > 0.3) { flags.push("lots_of_non_speech"); score *= 0.85; }
  if (compressedFrac > 0.1 || rep > 0.2) { flags.push("possible_hallucination_loops"); score = Math.min(score, 0.45); }
  if ((language === "yo" || language === "mixed") && words > 80 && marks < 0.02) {
    flags.push("yoruba_missing_tone_marks"); score *= 0.8;
  }
  if (language === "en" && marks > 0.05) flags.push("english_with_yoruba_diacritics_language_check");

  const yorubaAlwaysReview = (opts.yorubaAlwaysReview ?? true) && (language === "yo" || language === "mixed");
  if (yorubaAlwaysReview) flags.push("yoruba_requires_babalawo_review");

  const hard = ["empty_transcript", "sparse_transcript", "possible_hallucination_loops", "implausible_speech_rate"];
  const needs_review = score < (opts.minScore ?? 0.6) || flags.some((f) => hard.includes(f)) || yorubaAlwaysReview;
  return {
    score: Number(score.toFixed(3)),
    confidence: confidence === null ? null : Number(confidence.toFixed(3)),
    flags, needs_review,
    metrics: { words, wpm: Number(wpm.toFixed(1)), lowConfFrac, noSpeechFrac, compressedFrac, repetition: Number(rep.toFixed(3)), yorubaMarkRatio: Number(marks.toFixed(3)) },
  };
}

/** Per-chunk languages -> 'en' | 'yo' | 'mixed'. */
export function overallLanguage(chunkLanguages, text) {
  const langs = [...new Set(chunkLanguages.map(normalizeLanguage).filter(Boolean))];
  if (langs.length > 1) return "mixed";
  if (langs[0] === "en" && yorubaMarkRatio(text) > 0.04) return "mixed";
  return langs[0] || null;
}
