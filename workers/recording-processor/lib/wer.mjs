// Word / character error rate for benchmarking STT providers against human transcripts.
const norm = (s) => s.normalize("NFC").toLowerCase().replace(/[.,!?;:"“”'’()\[\]-]/g, " ").replace(/\s+/g, " ").trim();
// Yoruba is tonal; report accuracy both with and without tone marks / underdots.
export const stripMarks = (s) => s.normalize("NFD").replace(/\p{M}/gu, "");

function edit(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
export function wer(reference, hypothesis) {
  const r = norm(reference).split(" ").filter(Boolean), h = norm(hypothesis).split(" ").filter(Boolean);
  return r.length ? edit(r, h) / r.length : (h.length ? 1 : 0);
}
export function cer(reference, hypothesis) {
  const r = [...norm(reference).replace(/ /g, "")], h = [...norm(hypothesis).replace(/ /g, "")];
  return r.length ? edit(r, h) / r.length : (h.length ? 1 : 0);
}
export const werNoTones = (ref, hyp) => wer(stripMarks(ref), stripMarks(hyp));
