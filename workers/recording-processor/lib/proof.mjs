// Ebo proof videos: compression settings and the "did we hear the client's name and the items" check.
// The check is a hint for the client and admins, never an automatic verdict: speech-to-text on
// Yorùbá prayers is imperfect, so a miss means "look closer", not "fake".

/** ffmpeg arguments: H.264 + AAC MP4, longest side at most 1280 px, at most 30 fps, ready to stream. */
export function compressArgs(src, out) {
  return [
    "-y", "-i", src,
    "-vf", "scale='if(gte(iw,ih),min(1280,iw),-2)':'if(gte(iw,ih),-2,min(1280,ih))',fps='min(30,source_fps)'",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-profile:v", "main", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-ac", "1",
    "-movflags", "+faststart", out,
  ];
}

/** Lower case, no tone marks or under-dots, letters and digits only. "Ẹyẹlé" -> "eyele". */
export function plain(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const STOP = new Set(["the", "and", "for", "with", "of", "a", "an", "white", "red", "big", "small"]);
const words = (s) => plain(s).split(" ").filter((w) => w.length >= 3 && !STOP.has(w));

/**
 * @param {string} transcript what the proof video's audio says
 * @param {string|null} clientName the client's full name
 * @param {{name: string, english_name?: string|null}[]} items the Ebo's item lines
 */
export function checkProof(transcript, clientName, items) {
  const heard = new Set(words(transcript));
  const nameParts = words(clientName);
  const name_heard = nameParts.length ? nameParts.some((w) => heard.has(w)) : null;
  const items_heard = [], items_missing = [];
  for (const it of items) {
    const ws = [...words(it.name), ...words(it.english_name)];
    (ws.some((w) => heard.has(w)) ? items_heard : items_missing).push(it.name);
  }
  const text = String(transcript || "").trim();
  return { name_heard, items_heard, items_missing, has_speech: text.length > 0, excerpt: text.slice(0, 400) };
}
