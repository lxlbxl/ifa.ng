// The app's data client. It no longer talks to Supabase.
//
// - Table reads/writes and RPCs go to PostgREST on our own server
//   (https://<api>/rest/v1), under the same row-level security rules as before.
//   Each request carries a short-lived token from our API that says who you are.
// - Login is our API's Better Auth (see ../api/auth.ts).
// - Files (photos, session audio) and live notifications are API endpoints too
//   (/v1/me/avatar, /v1/sessions/:id/audio, /v1/notifications/stream).
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

export const supabase = {
  from: rest.from.bind(rest),
  rpc: rest.rpc.bind(rest),
  auth: apiAuth,
};
