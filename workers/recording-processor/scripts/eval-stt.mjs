// Offline accuracy benchmark for the pilot (run on ~5 real or rehearsed sessions BEFORE launch).
//   node scripts/eval-stt.mjs path/to/dir   where dir contains  name.mp3  +  name.txt (human transcript)
// Prints WER/CER (with and without Yoruba tone marks) per file and overall, per provider in STT_PROVIDER.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { transcribeChunk, providerName } from "../lib/stt.mjs";
import { wer, cer, werNoTones } from "../lib/wer.mjs";

const dir = process.argv[2];
if (!dir) { console.error("usage: eval-stt.mjs <dir>"); process.exit(1); }
const files = (await readdir(dir)).filter((f) => /\.(mp3|wav|m4a|webm)$/.test(f));
const rows = [];
for (const f of files) {
  const ref = await readFile(join(dir, f.replace(/\.[^.]+$/, ".txt")), "utf8");
  const hyp = (await transcribeChunk(join(dir, f))).text;
  rows.push({ file: f, wer: wer(ref, hyp), werNoTones: werNoTones(ref, hyp), cer: cer(ref, hyp) });
}
const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / (rows.length || 1);
console.table(rows.map((r) => ({ ...r, wer: r.wer.toFixed(3), werNoTones: r.werNoTones.toFixed(3), cer: r.cer.toFixed(3) })));
console.log(`provider=${providerName()} files=${rows.length} meanWER=${avg("wer").toFixed(3)} meanWER(no tones)=${avg("werNoTones").toFixed(3)} meanCER=${avg("cer").toFixed(3)}`);
console.log("Guideline: WER <= 0.25 usable as a draft; 0.25-0.40 needs heavy Babalawo editing; > 0.40 switch provider.");
