import test from "node:test";
import assert from "node:assert/strict";
import { assessTranscript, overallLanguage, repetitionScore, yorubaMarkRatio } from "../lib/quality.mjs";
import { wer, cer, werNoTones } from "../lib/wer.mjs";
import { parseNotesJson } from "../lib/notes.mjs";

test("wer/cer basics", () => {
  assert.equal(wer("a b c d", "a b c d"), 0);
  assert.equal(wer("a b c d", "a x c d"), 0.25);
  assert.ok(cer("ifa", "ifo") > 0);
  assert.equal(werNoTones("ọ̀rúnmìlà", "orunmila"), 0);
});

test("healthy english transcript passes", () => {
  const text = Array(200).fill("we discussed the family situation and the plan").join(" ") + " end.";
  const segs = [{ start: 0, end: 60, avg_logprob: -0.2 }, { start: 60, end: 120, avg_logprob: -0.3 }];
  const q = assessTranscript({ text: text.replace(/(\bplan\b)/g, (m, _, i) => m + (i % 7)), segments: segs, durationSeconds: 1000, language: "en" });
  assert.ok(q.confidence > 0.7);
  assert.equal(q.flags.includes("empty_transcript"), false);
});

test("empty and sparse transcripts are flagged for review", () => {
  assert.ok(assessTranscript({ text: "", durationSeconds: 600, language: "en" }).needs_review);
  const sparse = assessTranscript({ text: "hello there friend how are you today ok", durationSeconds: 1800, language: "en" });
  assert.ok(sparse.flags.includes("sparse_transcript"));
});

test("looping hallucination detected", () => {
  const text = Array(80).fill("thank you for watching").join(" ");
  assert.ok(repetitionScore(text) > 0.2);
  assert.ok(assessTranscript({ text, durationSeconds: 120, language: "en" }).flags.includes("possible_hallucination_loops"));
});

test("yoruba always requires review by default; missing tone marks flagged", () => {
  const text = Array(120).fill("bawo ni o se wa si ile wa").join(" ");
  const q = assessTranscript({ text, durationSeconds: 600, language: "yo" });
  assert.ok(q.needs_review);
  assert.ok(q.flags.includes("yoruba_missing_tone_marks"));
  assert.ok(yorubaMarkRatio("ẹ káàbọ̀ ọmọ mi") > 0.2);
});

test("language merging", () => {
  assert.equal(overallLanguage(["english", "english"], "hello"), "en");
  assert.equal(overallLanguage(["yoruba", "english"], "x"), "mixed");
});

test("notes JSON parsing is defensive", () => {
  const n = parseNotesJson('Here:\n{"summary":"ok","action_points":[{"text":"Bring items","owner":"client","due_date":"2026-12-01T00:00"},{"text":""}],"primary_odu":" Ogbe ","deadline":"bad","next_appointment":"2026-12-10T10:00:00Z","uncertain":["x",1]}');
  assert.equal(n.action_points.length, 1);
  assert.equal(n.action_points[0].due_date, "2026-12-01");
  assert.equal(n.primary_odu, "Ogbe");
  assert.equal(n.deadline, null);
  assert.equal(n.next_appointment, "2026-12-10T10:00:00.000Z");
  assert.throws(() => parseNotesJson("no json"));
});
