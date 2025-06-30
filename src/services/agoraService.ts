import { supabase } from "@/integrations/supabase/client";

export interface AgoraTokenResponse {
  token: string;
  appId: string;
}

export interface AgoraTokenError {
  error: string;
}

/**
 * Generates an Agora RTC token for video sessions
 * @param sessionId - The session ID to use as channel name
 * @param userId - The user ID (optional, defaults to 0)
 * @returns Promise with token and appId or error
 */
export const generateAgoraToken = async (
  sessionId: string,
  userId?: string
): Promise<AgoraTokenResponse> => {
  try {
    console.log("🎥 Generating Agora token for session:", sessionId);
    
    const { data, error } = await supabase.functions.invoke('generate-agora-token', {
      body: {
        sessionId,
        userId: userId || 0
      }
    });

    if (error) {
      console.error("❌ Supabase function error:", error);
      throw new Error(error.message || "Failed to generate Agora token");
    }

    if (!data || !data.token || !data.appId) {
      console.error("❌ Invalid response from token service:", data);
      throw new Error("Invalid response from token service");
    }

    console.log("✅ Agora token generated successfully");
    return {
      token: data.token,
      appId: data.appId
    };
  } catch (error: any) {
    console.error("💥 Error generating Agora token:", error);
    throw new Error(error.message || "Failed to generate Agora token");
  }
};

/**
 * Validates if Agora settings are properly configured
 * @returns Promise<boolean>
 */
export const validateAgoraSettings = async (): Promise<boolean> => {
  try {
    const { data: settings, error } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["agora_app_id", "agora_app_certificate"]);

    if (error) {
      console.error("❌ Error fetching Agora settings:", error);
      return false;
    }

    const settingsMap: Record<string, string> = {};
    for (const setting of settings || []) {
      settingsMap[setting.setting_key] = setting.setting_value;
    }

    const hasAppId = settingsMap["agora_app_id"] && settingsMap["agora_app_id"].trim() !== "";
    const hasCertificate = settingsMap["agora_app_certificate"] && settingsMap["agora_app_certificate"].trim() !== "";

    return hasAppId && hasCertificate;
  } catch (error) {
    console.error("💥 Error validating Agora settings:", error);
    return false;
  }
};
