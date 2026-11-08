// Pluggable speech-to-text. Providers return { language, text, segments[] }.
//  STT_PROVIDER=openai  (default)  STT_MODEL=whisper-1  (verbose_json -> logprob confidence)
//  STT_PROVIDER=http               POST multipart "file" to STT_HTTP_URL (Bearer STT_HTTP_TOKEN)
//                                  -> { text, language, segments:[{start,end,text,confidence?}] }
// Plug a Yoruba-specialised model (self-hosted, Google Chirp, Spitch, etc.) behind "http".
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const ODU_PROMPT = "Ifá, Babalawo, Odù, Ejiogbe, Oyeku Meji, Iwori Meji, Idi Meji, Irosun Meji, Owonrin Meji, Obara Meji, Okanran Meji, Ogunda Meji, Osa Meji, Ika Meji, Oturupon Meji, Otura Meji, Irete Meji, Ose Meji, Ofun Meji, ẹbọ, ẹtù, orí, ọ̀rúnmìlà, èṣù, ṣàngó, ọ̀ṣun, ògún.";

async function openai(file) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const form = new FormData();
  form.set("file", new Blob([await readFile(file)]), basename(file));
  form.set("model", process.env.STT_MODEL || "whisper-1");
  form.set("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.set("prompt", ODU_PROMPT); // biases spelling of Odù names and diacritics
  if (process.env.STT_LANGUAGE_HINT) form.set("language", process.env.STT_LANGUAGE_HINT);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`openai stt ${res.status}: ${body?.error?.message}`);
  return { language: body.language, text: body.text || "", segments: body.segments || [] };
}

async function http(file) {
  const url = process.env.STT_HTTP_URL;
  if (!url) throw new Error("STT_HTTP_URL is not set");
  const form = new FormData();
  form.set("file", new Blob([await readFile(file)]), basename(file));
  if (process.env.STT_LANGUAGE_HINT) form.set("language", process.env.STT_LANGUAGE_HINT);
  const res = await fetch(url, { method: "POST", headers: process.env.STT_HTTP_TOKEN ? { Authorization: `Bearer ${process.env.STT_HTTP_TOKEN}` } : {}, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`http stt ${res.status}`);
  return { language: body.language, text: body.text || "", segments: body.segments || [] };
}

export const providers = { openai, http };
export const providerName = () => process.env.STT_PROVIDER || "openai";
export async function transcribeChunk(file) {
  const p = providers[providerName()];
  if (!p) throw new Error(`Unknown STT_PROVIDER ${providerName()}`);
  return p(file);
}
