// The app's data client. It no longer talks to Supabase.
//
// - Table reads/writes and RPCs go to PostgREST on our own server
//   (https://<api>/rest/v1), under the same row-level security rules as before.
//   Each request carries a short-lived token from our API that says who you are.
// - Login is our API's Better Auth (see ../api/auth.ts).
// - File storage and live updates return with phase 5; until then they report
//   "not available" instead of failing silently.
//
// The export keeps the name `supabase` so the screens that import it did not
// need to change. Import it like this:
//   import { supabase } from "@/integrations/supabase/client";
import { PostgrestClient } from "@supabase/postgrest-js";
import type { Database } from "./types";
import { API_URL } from "../api/config";
import { apiAuth, dataToken } from "../api/auth";

const dataFetch: typeof fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const token = await dataToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  return fetch(input, { ...init, headers });
};

const rest = new PostgrestClient<Database>(`${API_URL}/rest/v1`, { fetch: dataFetch });

const notYet = (what: string) => ({ message: `${what} is not available yet`, statusCode: "503" });

/** Placeholder until files move to our own storage (phase 5). */
const storage = {
  from(_bucket: string) {
    return {
      upload: async (..._a: unknown[]) => ({ data: null, error: notYet("File upload") }),
      remove: async (..._a: unknown[]) => ({ data: null, error: notYet("File removal") }),
      uploadToSignedUrl: async (..._a: unknown[]) => ({ data: null, error: notYet("File upload") }),
      createSignedUrl: async (..._a: unknown[]) => ({ data: null, error: notYet("File access") }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `${API_URL}/files/${path}` } }),
    };
  },
};

/** Placeholder until live updates move to our server (phase 5). Screens fall back to loading on open. */
function channel(_name: string) {
  const ch = {
    on: (..._a: unknown[]) => ch,
    subscribe: (cb?: (status: string) => void) => { cb?.("CLOSED"); return ch; },
    unsubscribe: async () => "ok",
  };
  return ch;
}

export const supabase = {
  from: rest.from.bind(rest),
  rpc: rest.rpc.bind(rest),
  auth: apiAuth,
  storage,
  channel,
  removeChannel: async (_c: unknown) => "ok",
};
