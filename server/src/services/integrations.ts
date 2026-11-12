import { createECDH, randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";
import nodemailer from "nodemailer";
import webpush from "web-push";
import agora from "agora-token";
import type { Config } from "../config.js";
import type { Caller, Database, DB } from "../db.js";
import { HttpError } from "./context.js";
import { envelope, parseDsn } from "./errors.js";
import { googleToken, SCOPES } from "./google.js";
import { open, seal, secretKey, type SecretKey } from "./secretBox.js";
import { fileStoreFor } from "./storage.js";

/**
 * Provider keys and settings an admin can manage from Admin -> Settings -> Integrations.
 *
 * - Only the names listed here can be set, never DATABASE_URL, AUTH_SECRET and the like.
 * - Values are encrypted (secretBox) and stored in private.integration_secrets, which PostgREST
 *   does not serve; only this API (and the recording worker) read them.
 * - Secret values never leave the server again: the admin screen gets "set, ends in ab12".
 * - A saved value takes priority over .env; removing it falls back to .env.
 * - Every change and every test is written to admin_audit_log (names only, never values).
 */

export type ManagedKey =
  | "PAYSTACK_SECRET_KEY" | "PAYSTACK_PUBLIC_KEY"
  | "FLW_SECRET_KEY" | "FLW_PUBLIC_KEY" | "FLW_SECRET_HASH"
  | "GOOGLE_SERVICE_ACCOUNT_JSON" | "GOOGLE_ORGANIZER_EMAIL"
  | "AGORA_APP_ID" | "AGORA_APP_CERTIFICATE"
  | "TERMII_API_KEY" | "TERMII_SENDER_ID" | "TERMII_BASE_URL"
  | "WHATSAPP_ACCESS_TOKEN" | "WHATSAPP_PHONE_NUMBER_ID"
  | "SMTP_URL" | "MAIL_FROM"
  | "VAPID_PUBLIC_KEY" | "VAPID_PRIVATE_KEY" | "VAPID_SUBJECT"
  | "S3_ENDPOINT" | "S3_BUCKET" | "S3_ACCESS_KEY_ID" | "S3_SECRET_ACCESS_KEY"
  | "OPENAI_API_KEY" | "STT_MODEL" | "ANTHROPIC_API_KEY" | "NOTES_LLM_MODEL"
  | "SENTRY_DSN";

type Values = Partial<Record<ManagedKey, string | undefined>>;

interface FieldDef {
  env: ManagedKey;
  label: string;
  secret: boolean;
  multiline?: boolean;
  placeholder?: string;
  help?: string;
  /** Returns a reason when the value is not acceptable. */
  check?: (v: string) => string | null;
}

export interface TestResult { ok: boolean; message: string }

interface TestCtx {
  cfg: Config;
  fetch: typeof fetch;
  /** Optional address for a real message (phone for SMS, email for mail). */
  to?: string;
}

interface IntegrationDef {
  id: string;
  label: string;
  description: string;
  usedBy: ("api" | "worker")[];
  fields: FieldDef[];
  /** Must all be set for the integration to work. */
  required: ManagedKey[];
  /** The Test can also send a real message to an address the admin types. */
  testTo?: "phone" | "email";
  webhookPath?: string;
  test: (ctx: TestCtx) => Promise<TestResult>;
}

// ---------------------------------------------------------------- checks

const httpsUrl = (v: string) => {
  try { return new URL(v).protocol === "https:" ? null : "Must start with https://"; } catch { return "Must be a full https:// address"; }
};
const anyUrl = (v: string) => {
  try { return ["https:", "http:"].includes(new URL(v).protocol) ? null : "Must start with https://"; } catch { return "Must be a full https:// address"; }
};
const email = (v: string) => (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? null : "Enter an email address");
const prefix = (re: RegExp, what: string) => (v: string) => (re.test(v) ? null : `This doesn't look like ${what}`);
const hex32 = (v: string) => (/^[0-9a-f]{32}$/i.test(v) ? null : "Agora values are 32 letters and numbers (0-9, a-f)");

export function parseServiceAccount(raw: string): { client_email: string; private_key: string } | null {
  try {
    const j = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
    return typeof j?.client_email === "string" && typeof j?.private_key === "string" ? j : null;
  } catch { return null; }
}

// ---------------------------------------------------------------- tests

const TIMEOUT = 15_000;

async function call(ctx: TestCtx, url: string, init: RequestInit = {}) {
  const res = await ctx.fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (await res.json().catch(() => ({}))) as any;
  return { res, body };
}

/** A provider's own words, short. Never includes what we sent. */
const said = (body: unknown, status: number) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = body as any;
  const m = b?.message ?? b?.error?.message ?? b?.error_description ?? b?.error ?? b?.detail;
  return `${typeof m === "string" ? m.slice(0, 160) : "no details"} (HTTP ${status})`;
};

const pass = (message: string): TestResult => ({ ok: true, message });
const fail = (message: string): TestResult => ({ ok: false, message });

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "paystack", label: "Paystack", usedBy: ["api"], webhookPath: "/webhooks/paystack",
    description: "Card, bank and USSD payments in naira.",
    fields: [
      { env: "PAYSTACK_SECRET_KEY", label: "Secret key", secret: true, placeholder: "sk_live_…", check: prefix(/^sk_(test|live)_/, "a Paystack secret key (sk_live_… or sk_test_…)") },
      { env: "PAYSTACK_PUBLIC_KEY", label: "Public key", secret: false, placeholder: "pk_live_…", check: prefix(/^pk_(test|live)_/, "a Paystack public key (pk_live_… or pk_test_…)") },
    ],
    required: ["PAYSTACK_SECRET_KEY", "PAYSTACK_PUBLIC_KEY"],
    async test(ctx) {
      const sk = ctx.cfg.PAYSTACK_SECRET_KEY!, pk = ctx.cfg.PAYSTACK_PUBLIC_KEY!;
      const mode = (k: string) => (/_live_/.test(k) ? "live" : "test");
      if (mode(sk) !== mode(pk)) return fail(`The secret key is a ${mode(sk)} key but the public key is a ${mode(pk)} key. Use a matching pair.`);
      const { res, body } = await call(ctx, "https://api.paystack.co/balance", { headers: { Authorization: `Bearer ${sk}` } });
      if (!res.ok || body?.status !== true) return fail(`Paystack refused the secret key: ${said(body, res.status)}`);
      const ngn = (body.data ?? []).find((b: { currency: string }) => b.currency === "NGN");
      return pass(`Connected to Paystack (${mode(sk)} mode)${ngn ? `. Balance ₦${(Number(ngn.balance) / 100).toLocaleString("en-NG")}` : ""}.`);
    },
  },
  {
    id: "flutterwave", label: "Flutterwave", usedBy: ["api"], webhookPath: "/webhooks/flutterwave",
    description: "Second payment gateway, also for cards from outside Nigeria.",
    fields: [
      { env: "FLW_SECRET_KEY", label: "Secret key", secret: true, placeholder: "FLWSECK-…" },
      { env: "FLW_PUBLIC_KEY", label: "Public key", secret: false, placeholder: "FLWPUBK-…" },
      { env: "FLW_SECRET_HASH", label: "Webhook secret hash", secret: true,
        help: "Make one up, then paste the same value under Settings → Webhooks in the Flutterwave dashboard." },
    ],
    required: ["FLW_SECRET_KEY", "FLW_PUBLIC_KEY", "FLW_SECRET_HASH"],
    async test(ctx) {
      const { res, body } = await call(ctx, "https://api.flutterwave.com/v3/balances/NGN",
        { headers: { Authorization: `Bearer ${ctx.cfg.FLW_SECRET_KEY}` } });
      if (!res.ok || body?.status !== "success") return fail(`Flutterwave refused the secret key: ${said(body, res.status)}`);
      const test = /TEST/i.test(ctx.cfg.FLW_SECRET_KEY!) ? "test" : "live";
      const bal = body?.data?.available_balance;
      return pass(`Connected to Flutterwave (${test} mode)${bal !== undefined ? `. Balance ₦${Number(bal).toLocaleString("en-NG")}` : ""}.`);
    },
  },
  {
    id: "google_meet", label: "Google Meet", usedBy: ["api", "worker"],
    description: "Creates the video link for each paid session and fetches recordings for notes.",
    fields: [
      { env: "GOOGLE_SERVICE_ACCOUNT_JSON", label: "Service account key (JSON)", secret: true, multiline: true,
        placeholder: '{ "type": "service_account", … }',
        help: "The whole JSON key file of a service account with domain-wide delegation.",
        check: (v) => (parseServiceAccount(v) ? null : "Paste the whole JSON key file (it has client_email and private_key)") },
      { env: "GOOGLE_ORGANIZER_EMAIL", label: "Organizer Workspace user", secret: false, placeholder: "meet@ifa.ng", check: email,
        help: "The IFA.ng Google Workspace user the meetings are created as." },
    ],
    required: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_ORGANIZER_EMAIL"],
    async test(ctx) {
      try {
        await googleToken({ config: ctx.cfg, fetch: ctx.fetch } as never, [SCOPES.meetCreate, SCOPES.meetSettings], { fresh: true });
      } catch (e) {
        return fail(`${(e as Error).message}. Check the key, that domain-wide delegation allows the Meet scopes, and the organizer address.`);
      }
      return pass(`Google accepted the key and can create meetings as ${ctx.cfg.GOOGLE_ORGANIZER_EMAIL}.`);
    },
  },
  {
    id: "agora", label: "Agora (backup video)", usedBy: ["api"],
    description: "In-app video used when Google Meet is not available.",
    fields: [
      { env: "AGORA_APP_ID", label: "App ID", secret: false, check: hex32 },
      { env: "AGORA_APP_CERTIFICATE", label: "App certificate", secret: true, check: hex32 },
    ],
    required: ["AGORA_APP_ID", "AGORA_APP_CERTIFICATE"],
    async test(ctx) {
      for (const k of ["AGORA_APP_ID", "AGORA_APP_CERTIFICATE"] as const) {
        const why = hex32(ctx.cfg[k] ?? "");
        if (why) return fail(why);
      }
      const t = agora.RtcTokenBuilder.buildTokenWithUserAccount(ctx.cfg.AGORA_APP_ID!, ctx.cfg.AGORA_APP_CERTIFICATE!,
        "admin-test", "admin", agora.RtcRole.PUBLISHER, 60, 60);
      if (!t) return fail("Could not make a call token with these values.");
      return pass("The values are in the right form and make call tokens. Agora itself only checks them when a call starts, so try a backup-video call to be sure.");
    },
  },
  {
    id: "termii", label: "Termii (login codes, SMS)", usedBy: ["api"], testTo: "phone",
    description: "Sends login codes and SMS reminders. Needed for anyone to sign in.",
    fields: [
      { env: "TERMII_API_KEY", label: "API key", secret: true },
      { env: "TERMII_SENDER_ID", label: "Sender ID", secret: false, placeholder: "IFA",
        check: (v) => (/^[A-Za-z0-9 ]{3,11}$/.test(v) ? null : "3 to 11 letters or numbers, approved in Termii") },
      { env: "TERMII_BASE_URL", label: "API address", secret: false, placeholder: "https://api.ng.termii.com", check: httpsUrl,
        help: "Shown in your Termii dashboard. Leave as it is unless Termii gave you another." },
    ],
    required: ["TERMII_API_KEY", "TERMII_SENDER_ID", "TERMII_BASE_URL"],
    async test(ctx) {
      const base = ctx.cfg.TERMII_BASE_URL.replace(/\/$/, "");
      const { res, body } = await call(ctx, `${base}/api/get-balance?api_key=${encodeURIComponent(ctx.cfg.TERMII_API_KEY!)}`);
      if (!res.ok || body?.balance === undefined) return fail(`Termii refused the API key: ${said(body, res.status)}`);
      const balance = `Balance ${body.currency ?? ""} ${body.balance}`.trim();
      if (!ctx.to) return pass(`Connected to Termii. ${balance}. Add a phone number to also send a test SMS.`);
      const sent = await call(ctx, `${base}/api/sms/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: ctx.to.replace(/^\+/, ""), from: ctx.cfg.TERMII_SENDER_ID, type: "plain", channel: "dnd",
          sms: "IFA.ng test message from Admin settings. Termii is working.", api_key: ctx.cfg.TERMII_API_KEY }),
      });
      if (!sent.res.ok || !(sent.body?.message_id || sent.body?.code === "ok")) return fail(`Connected (${balance}), but the test SMS failed: ${said(sent.body, sent.res.status)}`);
      return pass(`Connected to Termii. ${balance}. Test SMS sent to ${ctx.to}.`);
    },
  },
  {
    id: "whatsapp", label: "WhatsApp", usedBy: ["api"],
    description: "Session reminders on WhatsApp (Meta Cloud API). SMS is used when it is off.",
    fields: [
      { env: "WHATSAPP_ACCESS_TOKEN", label: "Access token", secret: true, help: "A permanent system-user token from Meta Business settings." },
      { env: "WHATSAPP_PHONE_NUMBER_ID", label: "Phone number ID", secret: false, check: prefix(/^\d{6,20}$/, "a phone number ID (digits only)") },
    ],
    required: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    async test(ctx) {
      const { res, body } = await call(ctx,
        `https://graph.facebook.com/v21.0/${encodeURIComponent(ctx.cfg.WHATSAPP_PHONE_NUMBER_ID!)}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${ctx.cfg.WHATSAPP_ACCESS_TOKEN}` } });
      if (!res.ok) return fail(`Meta refused the token or number ID: ${said(body, res.status)}`);
      return pass(`Connected to WhatsApp as ${body.verified_name ?? "your business"} (${body.display_phone_number ?? "number found"}). Reminders also need the ifa_ message templates approved in Meta.`);
    },
  },
  {
    id: "email", label: "Email", usedBy: ["api"], testTo: "email",
    description: "Outgoing email (receipts and account messages) through your SMTP provider.",
    fields: [
      { env: "SMTP_URL", label: "SMTP address", secret: true, placeholder: "smtps://user:password@smtp.example.com:465",
        help: "Includes the user name and password. Special characters in the password must be URL-encoded.",
        check: (v) => (/^smtps?:\/\/[^\s]+$/.test(v) ? null : "Must look like smtps://user:password@host:465") },
      { env: "MAIL_FROM", label: "From", secret: false, placeholder: "IFA.ng <no-reply@ifa.ng>",
        check: (v) => (/@/.test(v) ? null : "Include an email address, e.g. IFA.ng <no-reply@ifa.ng>") },
    ],
    required: ["SMTP_URL", "MAIL_FROM"],
    async test(ctx) {
      const t = nodemailer.createTransport(ctx.cfg.SMTP_URL!);
      const within = <T>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, rej) =>
        setTimeout(() => rej(Object.assign(new Error("timeout"), { name: "TimeoutError" })), TIMEOUT).unref())]);
      try {
        await within(t.verify());
        if (!ctx.to) return pass("Signed in to the mail server. Add an address to also send a test email.");
        await within(t.sendMail({ from: ctx.cfg.MAIL_FROM, to: ctx.to, subject: "IFA.ng test email",
          text: "This is a test from Admin → Settings → Integrations. Email is working." }));
        return pass(`Signed in to the mail server and sent a test email to ${ctx.to}.`);
      } catch (e) {
        if ((e as Error).name === "TimeoutError") throw e;
        return fail(`The mail server said: ${String((e as Error).message).slice(0, 200)}`);
      } finally { t.close(); }
    },
  },
  {
    id: "web_push", label: "Push notifications", usedBy: ["api"],
    description: "Phone and browser alerts, e.g. Consult Now requests for Babalawos.",
    fields: [
      { env: "VAPID_PUBLIC_KEY", label: "Public key", secret: false },
      { env: "VAPID_PRIVATE_KEY", label: "Private key", secret: true,
        help: "Make a pair once with npx web-push generate-vapid-keys. Changing the pair means every device has to turn alerts on again." },
      { env: "VAPID_SUBJECT", label: "Contact", secret: false, placeholder: "mailto:support@ifa.ng",
        check: (v) => (/^(mailto:|https:\/\/)/.test(v) ? null : "Start with mailto: or https://") },
    ],
    required: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"],
    async test(ctx) {
      try {
        webpush.getVapidHeaders("https://fcm.googleapis.com", ctx.cfg.VAPID_SUBJECT, ctx.cfg.VAPID_PUBLIC_KEY!, ctx.cfg.VAPID_PRIVATE_KEY!, "aes128gcm");
        const ecdh = createECDH("prime256v1");
        ecdh.setPrivateKey(Buffer.from(ctx.cfg.VAPID_PRIVATE_KEY!, "base64url"));
        if (ecdh.getPublicKey().toString("base64url") !== ctx.cfg.VAPID_PUBLIC_KEY!.replace(/=+$/, "")) {
          return fail("The public and private keys are not a pair.");
        }
      } catch (e) {
        return fail(`These keys can't sign alerts: ${(e as Error).message}`);
      }
      return pass("The keys are a valid pair. Use “Send test alert” on a Babalawo's phone to see one arrive.");
    },
  },
  {
    id: "file_storage", label: "File storage", usedBy: ["api", "worker"],
    description: "Private bucket for photos, recordings and Ebo videos (Cloudflare R2, MinIO or any S3).",
    fields: [
      { env: "S3_ENDPOINT", label: "Endpoint", secret: false, placeholder: "https://<account>.r2.cloudflarestorage.com", check: anyUrl },
      { env: "S3_BUCKET", label: "Bucket", secret: false, check: prefix(/^[a-z0-9][a-z0-9.-]{1,62}$/, "a bucket name") },
      { env: "S3_ACCESS_KEY_ID", label: "Access key ID", secret: false },
      { env: "S3_SECRET_ACCESS_KEY", label: "Secret access key", secret: true },
    ],
    required: ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    async test(ctx) {
      const store = fileStoreFor(ctx.cfg);
      const key = `healthchecks/admin-test-${randomUUID()}.txt`;
      try {
        await store.put(key, new TextEncoder().encode("ok"), "text/plain");
        const got = await store.get(key);
        await store.delete(key);
        if (!got || new TextDecoder().decode(got.body) !== "ok") return fail("Wrote a test file but could not read it back.");
      } catch (e) {
        return fail(`The bucket refused: ${String((e as Error).message).slice(0, 200)}`);
      }
      return pass(`Wrote, read and deleted a test file in “${ctx.cfg.S3_BUCKET}”. Files already saved elsewhere stay where they are.`);
    },
  },
  {
    id: "openai", label: "OpenAI (transcripts)", usedBy: ["worker"],
    description: "Speech-to-text for session recordings, before the notes are drafted.",
    fields: [
      { env: "OPENAI_API_KEY", label: "API key", secret: true, placeholder: "sk-…" },
      { env: "STT_MODEL", label: "Speech model", secret: false, placeholder: "whisper-1" },
    ],
    required: ["OPENAI_API_KEY"],
    async test(ctx) {
      const model = ctx.cfg.STT_MODEL || "whisper-1";
      const { res, body } = await call(ctx, `https://api.openai.com/v1/models/${encodeURIComponent(model)}`,
        { headers: { Authorization: `Bearer ${ctx.cfg.OPENAI_API_KEY}` } });
      if (res.status === 404) return fail(`The key works, but the model “${model}” was not found.`);
      if (!res.ok) return fail(`OpenAI refused the key: ${said(body, res.status)}`);
      return pass(`Connected to OpenAI; the model “${model}” is available.`);
    },
  },
  {
    id: "anthropic", label: "Anthropic (session notes)", usedBy: ["worker"],
    description: "Drafts the English and Yorùbá session notes the Babalawo approves.",
    fields: [
      { env: "ANTHROPIC_API_KEY", label: "API key", secret: true, placeholder: "sk-ant-…" },
      { env: "NOTES_LLM_MODEL", label: "Model", secret: false, placeholder: "claude-sonnet-5-5" },
    ],
    required: ["ANTHROPIC_API_KEY"],
    async test(ctx) {
      const model = ctx.cfg.NOTES_LLM_MODEL || "claude-sonnet-5-5";
      const { res, body } = await call(ctx, `https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`,
        { headers: { "x-api-key": ctx.cfg.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" } });
      if (res.status === 404) return fail(`The key works, but the model “${model}” was not found.`);
      if (!res.ok) return fail(`Anthropic refused the key: ${said(body, res.status)}`);
      return pass(`Connected to Anthropic; the model “${model}” is available.`);
    },
  },
  {
    id: "error_tracking", label: "Error tracking (Sentry)", usedBy: ["api"],
    description: "Sends unexpected server errors to Sentry.",
    fields: [
      { env: "SENTRY_DSN", label: "DSN", secret: true, placeholder: "https://…@o0.ingest.sentry.io/0",
        check: (v) => (parseDsn(v) ? null : "Paste the DSN from Sentry → Project settings → Client keys") },
    ],
    required: ["SENTRY_DSN"],
    async test(ctx) {
      const d = parseDsn(ctx.cfg.SENTRY_DSN)!;
      const res = await ctx.fetch(d.url, {
        method: "POST", signal: AbortSignal.timeout(TIMEOUT),
        headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${d.key}, sentry_client=ifa-api/1.0` },
        body: envelope(new Error("Test event from IFA.ng Admin settings"), { test: true }, ctx.cfg.NODE_ENV),
      });
      if (!res.ok) return fail(`Sentry refused the event (HTTP ${res.status}). Check the DSN.`);
      return pass("Sentry accepted a test event. Look for “Test event from IFA.ng Admin settings” in Sentry.");
    },
  },
];

export const MANAGED_KEYS: ManagedKey[] = INTEGRATIONS.flatMap((i) => i.fields.map((f) => f.env));
const FIELD = new Map(INTEGRATIONS.flatMap((i) => i.fields.map((f) => [f.env, f] as const)));

// ---------------------------------------------------------------- state

const BASES = new WeakMap<Config, Values>();

interface Saved { value: string | null; updated_at: string; updated_by: string | null }

export interface IntegrationSettings {
  /** Reads saved values and applies them over .env. Returns the names whose value changed. */
  refresh(): Promise<ManagedKey[]>;
  list(caller: Caller): Promise<unknown>;
  save(caller: Caller, id: string, values: unknown): Promise<unknown>;
  test(caller: Caller, id: string, draft: unknown, to: unknown): Promise<TestResult>;
  /** Hook for things that read a setting once (error reporting). */
  onChange(fn: (changed: ManagedKey[]) => void): void;
}

export function createIntegrationSettings(deps: { config: Config; database: Database; fetch?: typeof fetch }): IntegrationSettings {
  const { config, database } = deps;
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  let keyMemo: SecretKey | null = null;
  const key = () => (keyMemo ??= secretKey(config));
  // What .env (or the built-in default) says, before any admin value is applied. Kept per config
  // object, so a second instance on an already-updated config still knows the .env values.
  const base: Values = BASES.get(config) ?? Object.fromEntries(MANAGED_KEYS.map((k) => [k, config[k] as string | undefined]));
  BASES.set(config, base);
  let saved = new Map<ManagedKey, Saved>();
  const listeners: ((c: ManagedKey[]) => void)[] = [];
  const asService = <T>(fn: (trx: Transaction<DB>) => Promise<T>) => database.as({ kind: "service" }, fn);

  const effective = (k: ManagedKey) => {
    const s = saved.get(k);
    return s && s.value !== null ? s.value : base[k];
  };

  async function refresh(): Promise<ManagedKey[]> {
    const rows = (await asService((trx) =>
      sql<{ env_key: string; value_enc: string; updated_at: Date; updated_by: string | null }>`select s.env_key, s.value_enc, s.updated_at, u.name updated_by
            from private.integration_secrets s left join auth.users u on u.id = s.updated_by`.execute(trx))).rows;
    const next = new Map<ManagedKey, Saved>();
    for (const r of rows) {
      if (!FIELD.has(r.env_key as ManagedKey)) continue;
      const value = open(key(), r.env_key, r.value_enc);
      if (value === null) console.error(`integration setting ${r.env_key} can't be decrypted (was SETTINGS_ENCRYPTION_KEY or AUTH_SECRET changed?); using .env`);
      next.set(r.env_key as ManagedKey, { value, updated_at: new Date(r.updated_at).toISOString(), updated_by: r.updated_by });
    }
    saved = next;
    const changed: ManagedKey[] = [];
    const cfg = config as unknown as Record<string, string | undefined>;
    for (const k of MANAGED_KEYS) {
      const v = effective(k);
      if (cfg[k] !== v) { cfg[k] = v; changed.push(k); }
    }
    if (changed.length) for (const fn of listeners) { try { fn(changed); } catch (e) { console.error("integration settings listener", e); } }
    return changed;
  }

  const def = (id: string) => {
    const d = INTEGRATIONS.find((i) => i.id === id);
    if (!d) throw new HttpError(404, "Unknown integration");
    return d;
  };

  async function requireAdmin(caller: Caller): Promise<string> {
    if (caller.kind !== "user") throw new HttpError(caller.kind === "anon" ? 401 : 403, "Forbidden");
    const r = await asService((trx) =>
      sql<{ a: boolean }>`select public.has_role(${caller.userId}::uuid, 'admin') a`.execute(trx));
    if (r.rows[0]?.a !== true) throw new HttpError(403, "Forbidden");
    return caller.userId;
  }

  const audit = (adminId: string, action: string, id: string, details: Record<string, unknown>) =>
    asService((trx) => sql`insert into public.admin_audit_log(admin_id, action, target_type, target_id, details)
      values (${adminId}::uuid, ${action}, 'integration', ${id}, ${JSON.stringify(details)}::jsonb)`.execute(trx));

  const mask = (f: FieldDef, v: string) => {
    if (f.env === "GOOGLE_SERVICE_ACCOUNT_JSON") {
      const sa = parseServiceAccount(v);
      return sa ? `Key for ${sa.client_email}` : "Set";
    }
    return v.length >= 16 ? `Set, ends in ${v.slice(-4)}` : "Set";
  };

  async function describe(d: IntegrationDef, lastTests: Map<string, { ok: boolean; message: string; at: string; by: string | null }>) {
    const fields = d.fields.map((f) => {
      const s = saved.get(f.env);
      const v = effective(f.env);
      const source = s && s.value !== null ? "admin" : v ? "server" : "unset";
      return {
        env: f.env, label: f.label, secret: f.secret, multiline: !!f.multiline, placeholder: f.placeholder ?? null, help: f.help ?? null,
        source,
        // Never a secret's value: only that it is set and how to recognise it.
        value: f.secret ? null : v ?? null,
        masked: f.secret && v ? mask(f, v) : null,
        server_value_set: !!base[f.env],
        updated_at: s?.updated_at ?? null,
        updated_by: s?.updated_by ?? null,
        unreadable: !!s && s.value === null,
      };
    });
    const lastChange = fields.map((f) => f.updated_at).filter(Boolean).sort().pop() ?? null;
    const t = lastTests.get(d.id) ?? null;
    return {
      id: d.id, label: d.label, description: d.description, used_by: d.usedBy, test_to: d.testTo ?? null,
      webhook_url: d.webhookPath ? `${config.API_URL.replace(/\/$/, "")}${d.webhookPath}` : null,
      configured: d.required.every((k) => !!effective(k)),
      last_test: t ? { ...t, stale: !!lastChange && lastChange > t.at } : null,
      fields,
    };
  }

  async function lastTests() {
    const rows = (await asService((trx) => sql<{ target_id: string; details: { ok?: boolean; message?: string }; created_at: Date; by: string | null }>`
      select distinct on (a.target_id) a.target_id, a.details, a.created_at, u.name by
        from public.admin_audit_log a left join auth.users u on u.id = a.admin_id
       where a.action = 'integration.test' and a.target_type = 'integration'
       order by a.target_id, a.created_at desc`.execute(trx))).rows;
    return new Map(rows.map((r) => [r.target_id, { ok: r.details?.ok === true, message: String(r.details?.message ?? ""),
      at: new Date(r.created_at).toISOString(), by: r.by }]));
  }

  /** Validates what the admin sent for one integration: { NAME: "value" } sets, { NAME: null } removes. */
  function parseValues(d: IntegrationDef, raw: unknown): Map<ManagedKey, string | null> {
    const out = new Map<ManagedKey, string | null>();
    if (raw === undefined || raw === null) return out;
    if (typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "values must be an object");
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const f = d.fields.find((x) => x.env === k);
      if (!f) throw new HttpError(400, `${k} is not part of ${d.label}`);
      if (v === null) { out.set(f.env, null); continue; }
      if (typeof v !== "string") throw new HttpError(400, `${f.label}: expected text`);
      const value = v.trim();
      if (value === "") continue; // empty box = keep what is there
      if (value.length > 20_000) throw new HttpError(400, `${f.label} is too long`);
      // eslint-disable-next-line no-control-regex
      if ((f.multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/ : /[\u0000-\u001f]/).test(value)) {
        throw new HttpError(400, `${f.label}: remove line breaks and hidden characters`);
      }
      const why = f.check?.(value);
      if (why) throw new HttpError(400, `${d.label} ${f.label}: ${why}`);
      out.set(f.env, value);
    }
    return out;
  }

  return {
    refresh,
    onChange(fn) { listeners.push(fn); },

    async list(caller) {
      await requireAdmin(caller);
      await refresh();
      const tests = await lastTests();
      return {
        encryption: { dedicated_key: !!config.SETTINGS_ENCRYPTION_KEY?.trim() },
        integrations: await Promise.all(INTEGRATIONS.map((d) => describe(d, tests))),
      };
    },

    async save(caller, id, raw) {
      const adminId = await requireAdmin(caller);
      const d = def(id);
      const values = parseValues(d, raw);
      if (values.size === 0) throw new HttpError(400, "Nothing to save");
      await database.as({ kind: "service" }, async (trx) => {
        for (const [k, v] of values) {
          if (v === null) await sql`delete from private.integration_secrets where env_key = ${k}`.execute(trx);
          else await sql`insert into private.integration_secrets(env_key, value_enc, updated_at, updated_by)
                           values (${k}, ${seal(key(), k, v)}, now(), ${adminId}::uuid)
                         on conflict (env_key) do update set value_enc = excluded.value_enc, updated_at = now(), updated_by = excluded.updated_by`.execute(trx);
        }
        await sql`insert into public.admin_audit_log(admin_id, action, target_type, target_id, details)
          values (${adminId}::uuid, 'integration.update', 'integration', ${id},
                  ${JSON.stringify({ set: [...values].filter(([, v]) => v !== null).map(([k]) => k),
                                     cleared: [...values].filter(([, v]) => v === null).map(([k]) => k) })}::jsonb)`.execute(trx);
      });
      await refresh();
      return describe(d, await lastTests());
    },

    async test(caller, id, rawDraft, rawTo) {
      const adminId = await requireAdmin(caller);
      const d = def(id);
      const draft = parseValues(d, rawDraft);
      let to: string | undefined;
      if (typeof rawTo === "string" && rawTo.trim()) {
        to = rawTo.trim();
        if (d.testTo === "phone" && !/^\+?[1-9]\d{7,14}$/.test(to.replace(/[\s-]/g, ""))) throw new HttpError(400, "Enter the phone number with country code, e.g. +2348012345678");
        if (d.testTo === "phone") to = `+${to.replace(/[\s+-]/g, "")}`;
        if (d.testTo === "email" && email(to)) throw new HttpError(400, "Enter an email address");
        if (!d.testTo) to = undefined;
      }
      // What would be used: saved values, then .env, with anything typed but not yet saved on top.
      const cfg = { ...config } as Config;
      const c = cfg as unknown as Record<string, string | undefined>;
      for (const [k, v] of draft) c[k] = v === null ? base[k] : v;
      const missing = d.required.filter((k) => !c[k]);
      let result: TestResult;
      if (missing.length) {
        result = fail(`Fill in ${missing.map((k) => FIELD.get(k)!.label).join(", ")} first.`);
      } else {
        try { result = await d.test({ cfg, fetch: fetchImpl, to }); } catch (e) {
          const err = e as Error;
          result = fail(err.name === "TimeoutError" || err.name === "AbortError"
            ? "No answer within 15 seconds. Check the address and that the server can reach it."
            : `Could not reach the provider: ${String(err.message).slice(0, 160)}`);
        }
      }
      // Never let a value we were given come back in a message.
      for (const k of d.fields.map((f) => f.env)) {
        const v = c[k];
        if (v && v.length >= 6 && FIELD.get(k)!.secret) result.message = result.message.split(v).join("•••");
      }
      await audit(adminId, "integration.test", id, { ok: result.ok, message: result.message.slice(0, 300), unsaved: draft.size > 0 });
      return result;
    },
  };
}
