// Draft consultation notes from a transcript with Claude. The Babalawo always approves.

const SYSTEM = `You write DRAFT consultation notes for a Babalawo (Ifá priest) after a private session with a client.
The transcript is machine-generated, may be in English, Yorùbá or a mix, and may contain errors.
Rules:
- Use ONLY what was actually said. Never invent an Odù, ritual, item, price, date or warning. Use null when not stated.
- Keep Yorùbá terms (Odù names, ẹbọ, ẹtù) with their original diacritics when you are confident; otherwise copy the transcript spelling.
- Write the summary and action points in clear English (add the Yorùbá term in brackets when helpful).
- Action points are things AGREED in the session, each with an owner ("client" or "babalawo") and a due_date (YYYY-MM-DD) only if one was stated.
- List anything you are unsure about, or that looks like a transcription error, in "uncertain".
- Reply with a single JSON object and nothing else.`;

const SCHEMA = `{
 "summary": string,
 "action_points": [{"text": string, "owner": "client"|"babalawo", "due_date": string|null}],
 "primary_odu": string|null, "other_odus": string|null,
 "ritual_recommendations": string|null, "items_needed": string|null,
 "warning": string|null, "deadline": "YYYY-MM-DD"|null, "next_appointment": "ISO-8601"|null,
 "uncertain": [string]
}`;

export function parseNotesJson(raw) {
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in model reply");
  const j = JSON.parse(m[0]);
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const date = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
  return {
    summary: str(j.summary) || "",
    action_points: (Array.isArray(j.action_points) ? j.action_points : [])
      .filter((a) => a && str(a.text))
      .map((a) => ({ text: str(a.text), owner: a.owner === "babalawo" ? "babalawo" : "client", due_date: date(a.due_date) })),
    primary_odu: str(j.primary_odu), other_odus: str(j.other_odus),
    ritual_recommendations: str(j.ritual_recommendations), items_needed: str(j.items_needed),
    warning: str(j.warning), deadline: date(j.deadline),
    next_appointment: typeof j.next_appointment === "string" && !isNaN(Date.parse(j.next_appointment)) ? new Date(j.next_appointment).toISOString() : null,
    uncertain: (Array.isArray(j.uncertain) ? j.uncertain : []).map(str).filter(Boolean),
  };
}

export async function draftNotes({ transcript, language, sessionDate, quality }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.NOTES_LLM_MODEL || "claude-sonnet-5-5",
      max_tokens: 4000, system: SYSTEM,
      messages: [{ role: "user", content:
        `Session date: ${sessionDate}\nDetected language: ${language}\nTranscript quality flags: ${(quality?.flags || []).join(", ") || "none"}\n\nReturn JSON matching:\n${SCHEMA}\n\n<transcript>\n${transcript}\n</transcript>` }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${body?.error?.message}`);
  return parseNotesJson(body.content?.map((c) => c.text || "").join("") || "");
}
