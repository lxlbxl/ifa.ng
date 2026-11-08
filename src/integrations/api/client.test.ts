import { beforeEach, describe, expect, it, vi } from "vitest";

/** The app's data client: login through our API, table reads through PostgREST with a short token. */

const USER = { id: "u-1", email: "ade@example.com", name: "Ade", emailVerified: true, createdAt: "2026-11-08T00:00:00Z" };
const tokenFor = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, "")}.s`;

type Call = { url: string; init: RequestInit };
let calls: Call[];
let signedIn: boolean;

beforeEach(async () => {
  vi.resetModules();
  calls = [];
  signedIn = false;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (url.endsWith("/api/auth/sign-in/email")) {
      const body = JSON.parse(String(init.body));
      if (body.password !== "right password") return json({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }, 401);
      signedIn = true;
      return json({ user: USER });
    }
    if (url.endsWith("/api/auth/sign-out")) { signedIn = false; return json({ success: true }); }
    if (url.endsWith("/api/auth/get-session")) return json(signedIn ? { user: USER, session: {} } : null);
    if (url.endsWith("/v1/data-token")) {
      return json(signedIn ? { token: tokenFor(USER.id), expires_at: Math.floor(Date.now() / 1000) + 600 } : { token: null, expires_at: null });
    }
    if (url.includes("/rest/v1/profiles")) return json([{ id: USER.id }]);
    return json({ error: "unexpected" }, 500);
  }));
});

describe("data client", () => {
  it("signs in with the login cookie and reports the session like before", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const bad = await supabase.auth.signInWithPassword({ email: "ade@example.com", password: "wrong" });
    expect(bad.error?.message).toBe("Invalid email or password");

    const events: string[] = [];
    supabase.auth.onAuthStateChange((e) => events.push(e));
    const ok = await supabase.auth.signInWithPassword({ email: "ade@example.com", password: "right password" });
    expect(ok.error).toBeNull();
    expect(ok.data.session?.user).toMatchObject({ id: USER.id, email: USER.email, user_metadata: { full_name: "Ade" } });
    expect(events).toContain("SIGNED_IN");
    expect(calls.find((c) => c.url.endsWith("/api/auth/sign-in/email"))?.init.credentials).toBe("include");
  });

  it("sends the short data token to PostgREST when signed in, and none when signed out", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.from("profiles").select("id");
    const anon = calls.find((c) => c.url.includes("/rest/v1/profiles"))!;
    expect(new Headers(anon.init.headers).get("Authorization")).toBeNull();

    await supabase.auth.signInWithPassword({ email: "ade@example.com", password: "right password" });
    calls = [];
    const { data } = await supabase.from("profiles").select("id");
    expect(data).toEqual([{ id: USER.id }]);
    const authed = calls.find((c) => c.url.includes("/rest/v1/profiles"))!;
    expect(new Headers(authed.init.headers).get("Authorization")).toBe(`Bearer ${tokenFor(USER.id)}`);

    await supabase.auth.signOut();
    calls = [];
    await supabase.from("profiles").select("id");
    const after = calls.find((c) => c.url.includes("/rest/v1/profiles"))!;
    expect(new Headers(after.init.headers).get("Authorization")).toBeNull();
  });
});
