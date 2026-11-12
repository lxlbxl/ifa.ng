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

import { checkProof, compressArgs, plain } from "../lib/proof.mjs";

test("Ebo proof check hears the client's name and items, ignoring tone marks", () => {
  assert.equal(plain("Ẹyẹlé"), "eyele");
  const r = checkProof("Olodumare, a gbe ebo yi fun Adebayo Ogunleye: eyele meji, obi abata merin", "Adébáyọ̀ Ògúnlèyé",
    [{ name: "Ẹyẹlé" }, { name: "Obì àbàtà", english_name: "Kola nut" }, { name: "Àkùkọ adìyẹ", english_name: "Cockerel" }]);
  assert.equal(r.name_heard, true);
  assert.deepEqual(r.items_heard, ["Ẹyẹlé", "Obì àbàtà"]);
  assert.deepEqual(r.items_missing, ["Àkùkọ adìyẹ"]);
  const silent = checkProof("", "Tunde", [{ name: "Oyin" }]);
  assert.equal(silent.name_heard, false);
  assert.equal(silent.has_speech, false);
});

test("proof compression streams from the start", () => {
  const a = compressArgs("in.mov", "out.mp4");
  assert.ok(a.includes("+faststart"));
  assert.equal(a.at(-1), "out.mp4");
});

test("notes keep prescribed Ebo items but never invent prices", () => {
  const n = parseNotesJson(JSON.stringify({ summary: "s", ebo: [{ title: "Ebo for travel", kind: "ebo",
    items: [{ name: "Ẹyẹlé", quantity: 2, unit_price: null }, { name: "Oyin", quantity: "x", unit_price: 3000 }] }, { title: "" }] }));
  assert.equal(n.ebo.length, 1);
  assert.deepEqual(n.ebo[0].items.map((i) => [i.name, i.quantity, i.unit_price]), [["Ẹyẹlé", 2, null], ["Oyin", 1, 3000]]);
});

test("admin-saved settings decrypt with the shared key and stay bound to their name", async () => {
  const { createCipheriv, randomBytes } = await import("node:crypto");
  const { open, secretKey, createOverrides } = await import("../lib/secrets.mjs");
  const key = secretKey({ SETTINGS_ENCRYPTION_KEY: "k".repeat(40) });
  const seal = (name, value) => {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    c.setAAD(Buffer.from(name));
    const ct = Buffer.concat([c.update(value, "utf8"), c.final()]);
    return `v1:${Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url")}`;
  };
  const sealed = seal("OPENAI_API_KEY", "sk-test-123");
  assert.equal(open(key, "OPENAI_API_KEY", sealed), "sk-test-123");
  assert.equal(open(key, "ANTHROPIC_API_KEY", sealed), null);
  assert.equal(open(secretKey({ AUTH_SECRET: "x".repeat(40) }), "OPENAI_API_KEY", sealed), null);

  const env = { SETTINGS_ENCRYPTION_KEY: "k".repeat(40), OPENAI_API_KEY: "from-env", STT_MODEL: "whisper-1" };
  let rows = [{ env_key: "OPENAI_API_KEY", value_enc: sealed }];
  const refresh = createOverrides({ q: async () => rows }, env);
  assert.deepEqual(await refresh(), ["OPENAI_API_KEY"]);
  assert.equal(env.OPENAI_API_KEY, "sk-test-123");
  rows = [];
  assert.deepEqual(await refresh(), ["OPENAI_API_KEY"]);
  assert.equal(env.OPENAI_API_KEY, "from-env");
});
