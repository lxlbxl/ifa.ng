import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type pg from "pg";
import type { Config } from "../config.js";

/**
 * Phone + PIN login.
 *
 *   start(phone)            -> "pin" if the number has a PIN, otherwise an OTP is sent ("otp")
 *   verifyOtp(phone, code)  -> the person (created on first use) + a one-time ticket to set a PIN
 *   setPin(user, ticket)    -> stores the PIN (scrypt over an HMAC keyed by AUTH_SECRET)
 *   verifyPin(phone, pin)   -> the person, with lockouts after repeated wrong PINs
 *   confirmPin(user, pin)   -> a signed-in person proves it is them again (step-up), before a sensitive change
 *
 * Every table here lives in the auth schema and is reached only through the
 * service-role pool the login code uses.
 */

const scrypt = promisify(scryptCb) as (pw: Buffer, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export class PhoneAuthError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;
export const OTP_SENDS_PER_PHONE_PER_HOUR = 5;
export const OTP_SENDS_PER_IP_PER_HOUR = 20;
export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MINUTES = 15;
export const PIN_FAILURES_PER_IP_PER_HOUR = 30;
export const OTP_CHECKS_PER_IP_PER_HOUR = 30;
export const PIN_TICKET_TTL_SECONDS = 15 * 60;
export const STEP_UP_TTL_SECONDS = 10 * 60;
export const STEP_UP_PURPOSES = ["payout_account"] as const;
export type StepUpPurpose = (typeof STEP_UP_PURPOSES)[number];
/** Step-up tokens are random; only their hash is stored (auth.step_ups). */
export const stepUpHash = (token: string) => createHash("sha256").update(`step-up:${token}`).digest("hex");

const E164 = /^\+[1-9]\d{6,14}$/;
const PIN = /^\d{4}$/;

export type Channel = "sms" | "whatsapp";

export interface OtpSender {
  /** Sends `code` to `phone`. Returns the channel actually used. */
  send(phone: string, code: string, channel: Channel): Promise<Channel>;
}

export function normalizePhone(input: unknown): string {
  if (typeof input !== "string") throw new PhoneAuthError(400, "INVALID_PHONE", "Enter a valid phone number");
  const p = "+" + input.replace(/[^\d]/g, "");
  if (!E164.test(p)) throw new PhoneAuthError(400, "INVALID_PHONE", "Enter a valid phone number");
  return p;
}

/** Address used for the account's required email field. `.invalid` never receives mail (RFC 2606). */
export const placeholderEmail = (phone: string) => `${phone.slice(1)}@phone.ifa.invalid`;
export const isPlaceholderEmail = (email: string | null | undefined) => !!email && email.endsWith("@phone.ifa.invalid");

/** Sends OTPs through Termii (SMS or WhatsApp). */
export function termiiSender(config: Config, fetchImpl: typeof fetch): OtpSender {
  return {
    async send(phone, code, channel) {
      const key = config.TERMII_API_KEY;
      if (!key) throw new PhoneAuthError(503, "SMS_UNAVAILABLE", "We can't send codes right now. Please try again later.");
      const text = `Your IFA.ng code is ${code}. It expires in 10 minutes. Don't share it with anyone.`;
      const res = await fetchImpl(`${config.TERMII_BASE_URL.replace(/\/$/, "")}/api/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone.slice(1), from: config.TERMII_SENDER_ID, sms: text, type: "plain",
          // "dnd" reaches Nigerian numbers on the do-not-disturb list (transactional route).
          channel: channel === "whatsapp" ? "whatsapp" : "dnd", api_key: key,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { message_id?: string; code?: string };
      if (!res.ok || !(body.message_id || body.code === "ok")) {
        console.error("termii send failed", res.status, body);
        throw new PhoneAuthError(502, "SMS_FAILED", "We couldn't send the code. Please check the number and try again.");
      }
      return channel;
    },
  };
}

/** Development: no message is sent; the code is returned to the app and logged. */
export const devSender: OtpSender = {
  async send(phone, code, channel) {
    console.log(`[dev otp] ${phone} via ${channel}: ${code}`);
    return channel;
  },
};

export function otpDevMode(config: Config): boolean {
  if (config.OTP_DEV_MODE === "true") return config.NODE_ENV !== "production";
  if (config.OTP_DEV_MODE === "false") return false;
  return config.NODE_ENV !== "production" && !config.TERMII_API_KEY;
}

export function createPhoneAuth(deps: { pool: pg.Pool; secret: string; sender: OtpSender; devMode: boolean }) {
  const { pool, secret, sender, devMode } = deps;
  const hmac = (s: string) => createHmac("sha256", secret).update(s).digest("hex");

  async function hit(bucket: string, key: string) {
    await pool.query("insert into auth.rate_events(bucket, key) values ($1, $2)", [bucket, key]);
  }
  async function count(bucket: string, key: string, seconds: number): Promise<number> {
    const r = await pool.query<{ n: number }>(
      "select count(*)::int n from auth.rate_events where bucket = $1 and key = $2 and at > now() - make_interval(secs => $3)",
      [bucket, key, seconds]);
    return r.rows[0].n;
  }
  async function limit(bucket: string, key: string, max: number, seconds: number, message: string) {
    if ((await count(bucket, key, seconds)) >= max) throw new PhoneAuthError(429, "RATE_LIMITED", message);
  }

  async function findUser(phone: string) {
    const r = await pool.query<{ id: string; name: string; has_pin: boolean; locked_until: Date | null; suspended: boolean; admin: boolean }>(
      `select u.id, u.name, (p.user_id is not null) has_pin, p.locked_until,
              coalesce((select is_suspended from public.profiles where id = u.id), false) suspended,
              exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin') admin
         from auth.users u left join auth.phone_pins p on p.user_id = u.id
        where u.phone = $1`, [phone]);
    return r.rows[0];
  }

  async function hashPin(userId: string, pin: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(Buffer.from(hmac(`pin:${userId}:${pin}`)), salt, 32, { N: 16384, r: 8, p: 1 });
    return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
  }
  async function checkPin(userId: string, pin: string, stored: string): Promise<boolean> {
    const [, saltB64, keyB64] = stored.split("$");
    const expected = Buffer.from(keyB64, "base64");
    const got = await scrypt(Buffer.from(hmac(`pin:${userId}:${pin}`)), Buffer.from(saltB64, "base64"), expected.length,
      { N: 16384, r: 8, p: 1 });
    return timingSafeEqual(expected, got);
  }

  /** Step 1: phone number typed. */
  async function start(input: { phone?: unknown; channel?: unknown; forgotPin?: unknown }, ip: string) {
    const phone = normalizePhone(input.phone);
    const channel: Channel = input.channel === "whatsapp" ? "whatsapp" : "sms";
    const user = await findUser(phone);
    if (user?.suspended) throw new PhoneAuthError(403, "SUSPENDED", "This account is suspended. Please contact support.");
    // Admins always confirm with a fresh code (something they have), never a PIN alone.
    // The person's name is never returned here: anyone can type any number.
    if (user?.has_pin && input.forgotPin !== true && !user.admin) {
      return { next: "pin" as const, phone };
    }

    // Resend cooldown, then hourly caps per number and per network.
    const last = await pool.query<{ wait: number }>(
      `select ceil(extract(epoch from (created_at + make_interval(secs => $2)) - now()))::int wait
         from auth.phone_otps where phone = $1 order by created_at desc limit 1`, [phone, OTP_RESEND_SECONDS]);
    const wait = last.rows[0]?.wait ?? 0;
    if (wait > 0) {
      throw new PhoneAuthError(429, "RESEND_TOO_SOON", `Please wait ${wait} seconds before asking for another code.`,
        { retry_after: wait });
    }
    await limit("otp_send_phone", phone, OTP_SENDS_PER_PHONE_PER_HOUR, 3600,
      "Too many codes for this number. Please try again in an hour.");
    await limit("otp_send_ip", ip, OTP_SENDS_PER_IP_PER_HOUR, 3600, "Too many attempts. Please try again later.");

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const purpose = user?.admin && user.has_pin && input.forgotPin !== true ? "admin_login" : user?.has_pin ? "reset_pin" : "login";
    const used = await sender.send(phone, code, channel);
    // A new code replaces any earlier one.
    await pool.query("update auth.phone_otps set consumed_at = now() where phone = $1 and consumed_at is null", [phone]);
    await pool.query(
      `insert into auth.phone_otps(phone, code_hash, purpose, channel, expires_at, ip)
       values ($1, $2, $3, $4, now() + make_interval(secs => $5), $6)`,
      [phone, hmac(`otp:${phone}:${code}`), purpose, used, OTP_TTL_SECONDS, ip]);
    await hit("otp_send_phone", phone);
    await hit("otp_send_ip", ip);
    return {
      next: "otp" as const, phone, channel: used, purpose, isNew: !user, resend_in: OTP_RESEND_SECONDS,
      ...(devMode ? { dev_code: code } : {}),
    };
  }

  /** Step 2a: the code from the SMS/WhatsApp. Creates the account on first use. */
  async function verifyOtp(input: { phone?: unknown; code?: unknown }, ip: string) {
    const phone = normalizePhone(input.phone);
    const code = typeof input.code === "string" ? input.code.replace(/\s/g, "") : "";
    await limit("otp_check_ip", ip, OTP_CHECKS_PER_IP_PER_HOUR, 3600, "Too many attempts. Please try again later.");

    const r = await pool.query<{ id: string; code_hash: string; attempts: number; expired: boolean }>(
      `select id, code_hash, attempts, expires_at < now() expired from auth.phone_otps
        where phone = $1 and consumed_at is null order by created_at desc limit 1`, [phone]);
    const otp = r.rows[0];
    if (!otp || otp.expired || otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new PhoneAuthError(400, "OTP_EXPIRED", "That code has expired. Ask for a new one.");
    }
    const ok = /^\d{6}$/.test(code) &&
      timingSafeEqual(Buffer.from(otp.code_hash), Buffer.from(hmac(`otp:${phone}:${code}`)));
    if (!ok) {
      await hit("otp_check_ip", ip);
      const u = await pool.query<{ attempts: number }>(
        `update auth.phone_otps set attempts = attempts + 1,
                consumed_at = case when attempts + 1 >= $2 then now() else consumed_at end
          where id = $1 returning attempts`, [otp.id, OTP_MAX_ATTEMPTS]);
      const left = OTP_MAX_ATTEMPTS - u.rows[0].attempts;
      throw new PhoneAuthError(400, left > 0 ? "OTP_INVALID" : "OTP_EXPIRED",
        left > 0 ? `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Ask for a new one.",
        { attempts_left: left });
    }
    // Consume atomically so the same code can't be used twice in parallel.
    const consumed = await pool.query("update auth.phone_otps set consumed_at = now() where id = $1 and consumed_at is null", [otp.id]);
    if (consumed.rowCount !== 1) throw new PhoneAuthError(400, "OTP_EXPIRED", "That code has already been used.");

    let user = await findUser(phone);
    let isNew = false;
    if (!user) {
      const ins = await pool.query<{ id: string }>(
        `insert into auth.users(email, phone, phone_confirmed_at, name, email_verified)
         values ($1, $2, now(), '', false)
         on conflict (phone) do nothing returning id`, [placeholderEmail(phone), phone]);
      isNew = ins.rowCount === 1;
      user = await findUser(phone);
    } else {
      await pool.query("update auth.users set phone_confirmed_at = coalesce(phone_confirmed_at, now()) where id = $1", [user.id]);
    }
    if (!user) throw new PhoneAuthError(500, "INTERNAL", "Could not create the account");
    if (user.suspended) throw new PhoneAuthError(403, "SUSPENDED", "This account is suspended. Please contact support.");

    const ticket = randomBytes(24).toString("base64url");
    await pool.query(
      `insert into auth.pin_tickets(token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(secs => $3))`,
      [hmac(`ticket:${ticket}`), user.id, PIN_TICKET_TTL_SECONDS]);
    // An admin who already has a PIN is signed in by the code alone; others go on to choose a PIN.
    return { userId: user.id, isNew, hasPin: user.has_pin, needsName: !user.name, pinTicket: ticket, skipPin: user.admin && user.has_pin };
  }

  /** Step 2b: choose a PIN (after an OTP), or a new one after "forgot PIN". */
  async function setPin(userId: string, input: { pin?: unknown; ticket?: unknown }) {
    if (typeof input.pin !== "string" || !PIN.test(input.pin)) {
      throw new PhoneAuthError(400, "INVALID_PIN", "Your PIN must be 4 digits.");
    }
    if (/^(\d)\1{3}$/.test(input.pin) || ["1234", "4321", "0123", "9876"].includes(input.pin)) {
      throw new PhoneAuthError(400, "WEAK_PIN", "That PIN is too easy to guess. Please choose another.");
    }
    if (typeof input.ticket !== "string") throw new PhoneAuthError(403, "TICKET_INVALID", "Please verify your number again.");
    const t = await pool.query(
      `update auth.pin_tickets set used_at = now()
        where token_hash = $1 and user_id = $2 and used_at is null and expires_at > now()`,
      [hmac(`ticket:${input.ticket}`), userId]);
    if (t.rowCount !== 1) throw new PhoneAuthError(403, "TICKET_INVALID", "Please verify your number again.");
    const hash = await hashPin(userId, input.pin);
    await pool.query(
      `insert into auth.phone_pins(user_id, pin_hash) values ($1, $2)
       on conflict (user_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, lock_count = 0,
                                          locked_until = null, set_at = now()`, [userId, hash]);
    return { ok: true };
  }

  /** Returning person: phone + PIN. */
  async function verifyPin(input: { phone?: unknown; pin?: unknown }, ip: string) {
    const phone = normalizePhone(input.phone);
    await limit("pin_fail_ip", ip, PIN_FAILURES_PER_IP_PER_HOUR, 3600, "Too many attempts. Please try again later.");
    const r = await pool.query<{ user_id: string; pin_hash: string; failed_attempts: number; lock_count: number;
      locked_for: number | null; name: string; suspended: boolean; admin: boolean }>(
      `select p.user_id, p.pin_hash, p.failed_attempts, p.lock_count, u.name,
              case when p.locked_until > now() then ceil(extract(epoch from p.locked_until - now()) / 60)::int end locked_for,
              coalesce((select is_suspended from public.profiles where id = u.id), false) suspended,
              exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin') admin
         from auth.users u join auth.phone_pins p on p.user_id = u.id where u.phone = $1`, [phone]);
    const row = r.rows[0];
    if (!row) {
      await hit("pin_fail_ip", ip);
      throw new PhoneAuthError(400, "NO_PIN", "This number has no PIN yet. We'll send you a code instead.");
    }
    if (row.suspended) throw new PhoneAuthError(403, "SUSPENDED", "This account is suspended. Please contact support.");
    if (row.admin) throw new PhoneAuthError(400, "CODE_REQUIRED", "Admins sign in with a code. We'll send you one.");
    if (row.locked_for) {
      throw new PhoneAuthError(423, "PIN_LOCKED",
        `Too many wrong PINs. Try again in ${row.locked_for} minute${row.locked_for === 1 ? "" : "s"}, or reset your PIN with a code.`,
        { locked_minutes: row.locked_for });
    }
    const pin = typeof input.pin === "string" ? input.pin : "";
    if (PIN.test(pin) && (await checkPin(row.user_id, pin, row.pin_hash))) {
      await pool.query("update auth.phone_pins set failed_attempts = 0, lock_count = 0, locked_until = null where user_id = $1", [row.user_id]);
      return { userId: row.user_id, needsName: !row.name };
    }
    await hit("pin_fail_ip", ip);
    const failures = row.failed_attempts + 1;
    if (failures >= PIN_MAX_FAILURES) {
      // Each lock lasts twice as long as the last one, up to a day.
      const minutes = Math.min(PIN_LOCK_MINUTES * 2 ** row.lock_count, 24 * 60);
      await pool.query(
        `update auth.phone_pins set failed_attempts = 0, lock_count = lock_count + 1,
                locked_until = now() + make_interval(mins => $2) where user_id = $1`, [row.user_id, minutes]);
      throw new PhoneAuthError(423, "PIN_LOCKED",
        `Too many wrong PINs. Try again in ${minutes} minutes, or reset your PIN with a code.`, { locked_minutes: minutes });
    }
    await pool.query("update auth.phone_pins set failed_attempts = $2 where user_id = $1", [row.user_id, failures]);
    const left = PIN_MAX_FAILURES - failures;
    throw new PhoneAuthError(401, "PIN_INVALID", `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.`, { attempts_left: left });
  }

  /**
   * A signed-in person types their PIN again before a sensitive change (a new payout account).
   * Same lockouts as signing in. Returns a one-use token for that purpose, valid a few minutes.
   */
  async function confirmPin(userId: string, input: { pin?: unknown; purpose?: unknown }, ip: string) {
    const purpose = STEP_UP_PURPOSES.find((p) => p === input.purpose);
    if (!purpose) throw new PhoneAuthError(400, "BAD_PURPOSE", "Unknown action.");
    const u = await pool.query<{ phone: string | null; has_pin: boolean }>(
      `select u.phone, exists (select 1 from auth.phone_pins p where p.user_id = u.id) has_pin from auth.users u where u.id = $1`, [userId]);
    const row = u.rows[0];
    if (!row?.phone || !row.has_pin) {
      throw new PhoneAuthError(400, "NO_PIN", "Set up phone sign-in with a PIN first, then try again.");
    }
    const who = await verifyPin({ phone: row.phone, pin: input.pin }, ip);
    if (who.userId !== userId) throw new PhoneAuthError(403, "PIN_INVALID", "Wrong PIN.");
    const token = randomBytes(24).toString("base64url");
    await pool.query(
      `insert into auth.step_ups(token_hash, user_id, purpose, expires_at) values ($1, $2, $3, now() + make_interval(secs => $4))`,
      [stepUpHash(token), userId, purpose, STEP_UP_TTL_SECONDS]);
    return { step_up: token, expires_in: STEP_UP_TTL_SECONDS };
  }

  /** Housekeeping: drop old codes, tickets and counters. */
  async function cleanup() {
    await pool.query("delete from auth.phone_otps where created_at < now() - interval '1 day'");
    await pool.query("delete from auth.pin_tickets where expires_at < now() - interval '1 day'");
    await pool.query("delete from auth.step_ups where expires_at < now() - interval '1 day'");
    await pool.query("delete from auth.rate_events where at < now() - interval '1 day'");
  }

  return { start, verifyOtp, setPin, verifyPin, confirmPin, cleanup };
}

export type PhoneAuth = ReturnType<typeof createPhoneAuth>;
