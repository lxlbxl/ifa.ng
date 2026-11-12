import { API_URL, ApiError, apiFetch } from "./config";

/**
 * Login through our own API (Better Auth), shaped like the small part of the
 * old supabase.auth interface the app uses, so screens didn't need rewriting.
 *
 * The login itself is an httpOnly cookie the browser holds; JavaScript never
 * sees it. `access_token` here is the short-lived token for table reads and
 * writes through PostgREST (see dataToken below), not the login.
 */

export interface AppUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  user_metadata: { full_name?: string; avatar_url?: string | null };
  app_metadata: Record<string, unknown>;
  identities: unknown[];
  aud: "authenticated";
}

export interface AppSession {
  access_token: string;
  token_type: "bearer";
  expires_at: number;
  user: AppUser;
}

export type AuthEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "USER_UPDATED";

export type PhoneStartResult =
  | { next: "pin"; phone: string; name?: string | null }
  | { next: "otp"; phone: string; channel: "sms" | "whatsapp"; purpose: "login" | "reset_pin" | "admin_login"; isNew: boolean;
      resend_in: number; dev_code?: string };

export interface PhoneOtpResult {
  user: { id: string; name: string };
  is_new: boolean;
  has_pin: boolean;
  needs_name: boolean;
  /** Absent when skip_pin is true. */
  pin_ticket?: string;
  /** An admin signed in by code alone: no PIN step. */
  skip_pin?: boolean;
}
type Listener = (event: AuthEvent, session: AppSession | null) => void;

export interface AuthFailure { message: string; status: number; code?: string }

interface BetterAuthUser { id: string; email: string; name: string; image?: string | null; emailVerified: boolean; createdAt: string }

const toUser = (u: BetterAuthUser): AppUser => ({
  id: u.id,
  // Phone-only accounts carry a placeholder address the person never typed; don't show it.
  email: u.email?.endsWith("@phone.ifa.invalid") ? "" : u.email,
  email_confirmed_at: u.emailVerified ? u.createdAt : null,
  created_at: u.createdAt,
  user_metadata: { full_name: u.name || undefined, avatar_url: u.image ?? null },
  app_metadata: {},
  identities: [{ provider: "email" }],
  aud: "authenticated",
});

const failure = (e: unknown): AuthFailure =>
  e instanceof ApiError
    ? { message: e.message, status: e.status, code: (e.body as { code?: string } | null)?.code }
    : { message: (e as Error)?.message ?? "Network error", status: 0 };

// ---- the short-lived data token (for PostgREST)

let cached: { token: string; expiresAt: number; userId: string } | null = null;
let inflight: Promise<string | null> | null = null;

/** Token for /rest/v1 requests, or null when signed out. Renewed a minute before it expires. */
export async function dataToken(): Promise<string | null> {
  if (cached && cached.expiresAt - 60 > Date.now() / 1000) return cached.token;
  inflight ??= apiFetch<{ token: string | null; expires_at: number | null }>("/v1/data-token")
    .then((r) => {
      if (!r.token || !r.expires_at) { cached = null; return null; }
      const sub = JSON.parse(atob(r.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub as string;
      cached = { token: r.token, expiresAt: r.expires_at, userId: sub };
      return r.token;
    })
    .catch(() => { cached = null; return null; })
    .finally(() => { inflight = null; });
  return inflight;
}

// ---- session state

let current: AppSession | null = null;
const listeners = new Set<Listener>();
const emit = (event: AuthEvent) => listeners.forEach((l) => { try { l(event, current); } catch (e) { console.error(e); } });

async function loadSession(): Promise<AppSession | null> {
  const r = await apiFetch<{ user: BetterAuthUser } | null>("/api/auth/get-session");
  if (!r?.user) { current = null; cached = null; return null; }
  if (cached && cached.userId !== r.user.id) cached = null;
  const token = await dataToken();
  current = token ? { access_token: token, token_type: "bearer", expires_at: cached!.expiresAt, user: toUser(r.user) } : null;
  return current;
}

export const apiAuth = {
  async getSession(): Promise<{ data: { session: AppSession | null }; error: AuthFailure | null }> {
    try { return { data: { session: await loadSession() }, error: null }; }
    catch (e) { return { data: { session: null }, error: failure(e) }; }
  },

  async getUser(): Promise<{ data: { user: AppUser | null }; error: AuthFailure | null }> {
    const { data, error } = await apiAuth.getSession();
    return { data: { user: data.session?.user ?? null }, error };
  },

  async refreshSession() {
    cached = null;
    const r = await apiAuth.getSession();
    if (r.data.session) emit("TOKEN_REFRESHED");
    return r;
  },

  onAuthStateChange(cb: Listener) {
    listeners.add(cb);
    queueMicrotask(() => cb("INITIAL_SESSION", current));
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },

  async signUp(args: { email: string; password: string; options?: { data?: { full_name?: string; role?: string }; emailRedirectTo?: string } }) {
    try {
      await apiFetch("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          email: args.email,
          password: args.password,
          name: args.options?.data?.full_name ?? "",
          // The database accepts only 'user' or 'babalawo' here; admin is never granted at signup.
          signupRole: args.options?.data?.role,
          callbackURL: args.options?.emailRedirectTo,
        }),
      });
      const session = await loadSession();
      if (session) emit("SIGNED_IN");
      return { data: { user: session?.user ?? null, session }, error: null };
    } catch (e) {
      return { data: { user: null, session: null }, error: failure(e) };
    }
  },

  async signInWithPassword(args: { email: string; password: string }) {
    try {
      await apiFetch("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify(args) });
      const session = await loadSession();
      emit("SIGNED_IN");
      return { data: { user: session?.user ?? null, session }, error: null };
    } catch (e) {
      return { data: { user: null, session: null }, error: failure(e) };
    }
  },

  async signOut() {
    try {
      await apiFetch("/api/auth/sign-out", { method: "POST", body: "{}" });
      return { error: null };
    } catch (e) {
      return { error: failure(e) };
    } finally {
      current = null;
      cached = null;
      emit("SIGNED_OUT");
    }
  },

  // ---- phone + PIN login (see server/src/services/phoneAuth.ts)

  /** Step 1. "pin" when the number already has a PIN; otherwise a code is sent ("otp"). */
  async phoneStart(phone: string, opts: { channel?: "sms" | "whatsapp"; forgotPin?: boolean } = {}) {
    return apiFetch<PhoneStartResult>("/api/auth/phone/start", {
      method: "POST", body: JSON.stringify({ phone, channel: opts.channel, forgotPin: opts.forgotPin }),
    });
  },

  /** Step 2a. Signs the person in (creating the account on first use) and returns a ticket to set a PIN. */
  async phoneVerifyOtp(phone: string, code: string) {
    const r = await apiFetch<PhoneOtpResult>("/api/auth/phone/verify-otp", { method: "POST", body: JSON.stringify({ phone, code }) });
    await loadSession();
    emit("SIGNED_IN");
    return r;
  },

  async phoneSetPin(pin: string, ticket: string) {
    return apiFetch<{ ok: true }>("/api/auth/phone/set-pin", { method: "POST", body: JSON.stringify({ pin, ticket }) });
  },

  /** Returning person: phone + PIN. */
  async phoneSignInPin(phone: string, pin: string) {
    const r = await apiFetch<{ user: { id: string; name: string }; needs_name: boolean }>("/api/auth/phone/sign-in-pin", {
      method: "POST", body: JSON.stringify({ phone, pin }),
    });
    await loadSession();
    emit("SIGNED_IN");
    return r;
  },

  /** Sets the account's display name (first name); the profile follows. */
  async updateName(name: string) {
    await apiFetch("/api/auth/update-user", { method: "POST", body: JSON.stringify({ name }) });
    await loadSession();
    emit("USER_UPDATED");
  },

  /** Sends the reset email; the link opens `redirectTo` with ?token=... */
  async resetPasswordForEmail(email: string, opts?: { redirectTo?: string }) {
    try {
      await apiFetch("/api/auth/request-password-reset", { method: "POST", body: JSON.stringify({ email, redirectTo: opts?.redirectTo }) });
      return { data: {}, error: null };
    } catch (e) {
      return { data: null, error: failure(e) };
    }
  },

  /** Sets a new password using the token from the reset email link. */
  async resetPassword(newPassword: string, token: string) {
    try {
      await apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ newPassword, token }) });
      return { error: null };
    } catch (e) {
      return { error: failure(e) };
    }
  },
};

export { API_URL };
