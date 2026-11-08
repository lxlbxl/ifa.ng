// Run: deno test --no-lock -A supabase/functions/_shared/shared_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { googleToken, SCOPES, spaceConfig } from "./google.ts";
import { sessionWindow, SessionRow } from "./auth.ts";
import { toE164 } from "./notify.ts";

const b64urlToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

Deno.test("service-account JWT is a valid RS256 delegation assertion", async () => {
  const kp = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----\n`;
  Deno.env.set("GOOGLE_SERVICE_ACCOUNT_JSON", JSON.stringify({ client_email: "svc@x.iam.gserviceaccount.com", private_key: pem }));
  Deno.env.set("GOOGLE_ORGANIZER_EMAIL", "meet@ifa.ng");
  let assertion = "";
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((_u: unknown, init: RequestInit) => {
    assertion = (init.body as URLSearchParams).get("assertion")!;
    return Promise.resolve(new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }));
  }) as typeof fetch;
  try {
    assertEquals(await googleToken([SCOPES.meetCreate]), "tok");
  } finally { globalThis.fetch = realFetch; }
  const [h, c, s] = assertion.split(".");
  const claim = JSON.parse(new TextDecoder().decode(b64urlToBytes(c)));
  assertEquals(claim.sub, "meet@ifa.ng");
  assertEquals(claim.iss, "svc@x.iam.gserviceaccount.com");
  assertEquals(claim.scope, SCOPES.meetCreate);
  assert(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", kp.publicKey, b64urlToBytes(s), new TextEncoder().encode(`${h}.${c}`)));
});

Deno.test("space config: guests knock, recording on/off, no Meet transcription", () => {
  const on = spaceConfig("ON");
  assertEquals(on.accessType, "TRUSTED");
  assertEquals(on.artifactConfig.recordingConfig.autoRecordingGeneration, "ON");
  assertEquals(on.artifactConfig.transcriptionConfig.autoTranscriptionGeneration, "OFF");
  assertEquals(spaceConfig("OFF").artifactConfig.recordingConfig.autoRecordingGeneration, "OFF");
});

Deno.test("session window converts the booking timezone to UTC", () => {
  const s = { session_date: "2026-12-01", start_time: "14:00", end_time: "15:00", user_timezone: "Africa/Lagos" } as SessionRow;
  assertEquals(sessionWindow(s).start.toISOString(), "2026-12-01T13:00:00.000Z");
  const ny = { ...s, user_timezone: "America/New_York" } as SessionRow;
  assertEquals(sessionWindow(ny).start.toISOString(), "2026-12-01T19:00:00.000Z");
  const overnight = { ...s, start_time: "23:30", end_time: "00:30" } as SessionRow;
  assertEquals(sessionWindow(overnight).end.getTime() - sessionWindow(overnight).start.getTime(), 3600_000);
});

Deno.test("phone normalisation", () => {
  assertEquals(toE164("0803 123 4567"), "2348031234567");
  assertEquals(toE164("+234 803 123 4567"), "2348031234567");
  assertEquals(toE164("8031234567"), "2348031234567");
  assertEquals(toE164("123"), null);
  assertEquals(toE164(null), null);
});
