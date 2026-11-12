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
