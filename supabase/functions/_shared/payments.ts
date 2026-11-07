// Shared helpers for the payment edge functions. Everything here runs with the service role.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type Gateway = "paystack" | "flutterwave";

const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim());
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}
export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Secrets come from function env vars first; admin_settings is only a fallback for existing installs. */
export async function getSecret(db: SupabaseClient, envName: string, settingKey: string): Promise<string | null> {
  const fromEnv = Deno.env.get(envName);
  if (fromEnv) return fromEnv;
  const { data } = await db.from("admin_settings").select("setting_value").eq("setting_key", settingKey).maybeSingle();
  const v = data?.setting_value?.toString().trim();
  return v ? v : null;
}

export async function hmacSha512Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

export type Verified =
  | { state: "paid"; amount: number; currency: string; txId: string }
  | { state: "pending" }
  | { state: "failed"; reason: string };

/** Ask the provider (not the browser, not the webhook body) whether this reference was really paid, and for how much. */
export async function verifyWithProvider(db: SupabaseClient, gateway: Gateway, reference: string): Promise<Verified> {
  if (gateway === "paystack") {
    const secret = await getSecret(db, "PAYSTACK_SECRET_KEY", "paystack_secret_key");
    if (!secret) throw new Error("Paystack secret key not configured");
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (r.status === 404) return { state: "pending" };
    if (!r.ok) throw new Error(`Paystack verify HTTP ${r.status}`);
    const j = await r.json();
    const d = j?.data;
    if (!j?.status || !d) return { state: "pending" };
    if (d.status === "success") return { state: "paid", amount: Number(d.amount) / 100, currency: String(d.currency ?? "NGN"), txId: String(d.id) };
    if (d.status === "failed" || d.status === "reversed") return { state: "failed", reason: String(d.gateway_response ?? d.status) };
    return { state: "pending" };
  }
  const secret = await getSecret(db, "FLW_SECRET_KEY", "flutterwave_secret_key");
  if (!secret) throw new Error("Flutterwave secret key not configured");
  const r = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (r.status === 404) return { state: "pending" };
  if (!r.ok) throw new Error(`Flutterwave verify HTTP ${r.status}`);
  const j = await r.json();
  const d = j?.data;
  if (j?.status !== "success" || !d) return { state: "pending" };
  if (d.status === "successful") return { state: "paid", amount: Number(d.amount), currency: String(d.currency ?? "NGN"), txId: String(d.id) };
  if (d.status === "failed") return { state: "failed", reason: String(d.processor_response ?? "failed") };
  return { state: "pending" };
}

/** Verify with the provider, then settle in the database. Idempotent: safe to call from webhook AND client verify. */
export async function confirmAndSettle(db: SupabaseClient, reference: string) {
  const { data: intent, error } = await db.from("payment_intents").select("*").eq("reference", reference).maybeSingle();
  if (error) throw error;
  if (!intent) return { status: "unknown_reference" as const };
  if (intent.status === "succeeded") return { status: "already_settled" as const, kind: intent.kind, session_id: intent.session_id, user_id: intent.user_id };

  const v = await verifyWithProvider(db, intent.gateway, reference);
  if (v.state === "pending") return { status: "pending" as const };
  if (v.state === "failed") {
    await db.rpc("fail_payment_intent", { p_reference: reference, p_reason: v.reason });
    return { status: "failed" as const, reason: v.reason };
  }
  const { data, error: sErr } = await db.rpc("settle_payment_intent", {
    p_reference: reference, p_paid_amount: v.amount, p_currency: v.currency, p_gateway_tx: v.txId,
  });
  if (sErr) throw sErr;
  if (data?.status === "settled" && data.kind === "session" && data.session_id) await requestMeetLink(data.session_id);
  return data as { status: string; kind?: string; session_id?: number; user_id?: string };
}

/** Best effort: the video function itself refuses unless sessions.payment_status = 'paid'. */
export async function requestMeetLink(sessionId: number | string) {
  const fn = Deno.env.get("MEETING_CREATE_FUNCTION") ?? "create-meet-link";
  try {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!r.ok) console.warn(`meet link request for session ${sessionId} -> HTTP ${r.status}`);
  } catch (e) {
    console.warn("meet link request failed (client can retry from the session page):", (e as Error).message);
  }
}
