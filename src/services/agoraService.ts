import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/integrations/api/config";

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
  let data: AgoraTokenResponse;
  try {
    data = await apiFetch<AgoraTokenResponse>(`/v1/sessions/${encodeURIComponent(String(sessionId))}/agora-token`, { method: "POST", body: "{}" });
  } catch (e) {
    throw new Error((e as Error).message || "Failed to get a video token");
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
