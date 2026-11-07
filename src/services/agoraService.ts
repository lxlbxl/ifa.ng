import { supabase } from "@/integrations/supabase/client";

export interface AgoraTokenResponse {
  token: string;
  appId: string;
  channel: string;
  /** String account the token is bound to. The client MUST join with this value. */
  account: string;
}

/**
 * Fetches an Agora RTC token. The server verifies the caller is a participant of a
 * paid session within the join window; nothing about identity is trusted from the client.
 */
export const generateAgoraToken = async (sessionId: string | number): Promise<AgoraTokenResponse> => {
  const { data, error } = await supabase.functions.invoke("generate-agora-token", {
    body: { session_id: Number(sessionId) },
  });
  if (error) {
    // supabase-js hides the JSON body on non-2xx; surface it when present.
    let msg = error.message;
    try { msg = (await (error as any).context?.json?.())?.error ?? msg; } catch { /* keep default */ }
    throw new Error(msg || "Failed to get a video token");
  }
  if (!data?.token || !data?.appId) throw new Error("Invalid response from token service");
  return data as AgoraTokenResponse;
};

export const validateAgoraSettings = async (): Promise<boolean> => {
  const { data, error } = await supabase
    .from("admin_settings").select("setting_key, setting_value")
    .in("setting_key", ["agora_app_id", "agora_app_certificate"]);
  if (error) return false;
  const m = Object.fromEntries((data ?? []).map((r) => [r.setting_key, r.setting_value]));
  return !!m.agora_app_id?.trim() && !!m.agora_app_certificate?.trim();
};
