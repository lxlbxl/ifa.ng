import { supabase } from "@/integrations/supabase/client";

export interface DailyRoomResponse {
  url: string;
  name: string;
  id: string;
  api_created: boolean;
  privacy: string;
  created_at: string;
  config: {
    start_audio_off: boolean;
    start_video_off: boolean;
    enable_chat: boolean;
    enable_knocking: boolean;
    enable_prejoin_ui: boolean;
    enable_screenshare: boolean;
    exp: number;
  };
}

export interface DailyTokenResponse {
  roomUrl: string;
  token?: string;
}

export interface DailyError {
  error: string;
}

/**
 * Creates a Daily.co room for a session
 * @param sessionId - The session ID to use as room name
 * @returns Promise with room URL or error
 */
export const createDailyRoom = async (
  _sessionId: string
): Promise<DailyTokenResponse> => {
  // Daily.co was retired: sessions use Google Meet, with Agora as the fallback.
  throw new Error("Daily.co video is no longer available. Please use the session's Meet or Agora room.");
};

/**
 * Validates if Daily.co settings are properly configured
 * @returns Promise<boolean>
 */
export const validateDailySettings = async (): Promise<boolean> => {
  try {
    const { data: settings, error } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["daily_api_key"]);

    if (error) {
      console.error("❌ Error fetching Daily.co settings:", error);
      return false;
    }

    const settingsMap: Record<string, string> = {};
    for (const setting of settings || []) {
      settingsMap[setting.setting_key] = setting.setting_value;
    }

    const hasApiKey = settingsMap["daily_api_key"] && settingsMap["daily_api_key"].trim() !== "";

    return hasApiKey;
  } catch (error) {
    console.error("💥 Error validating Daily.co settings:", error);
    return false;
  }
};

/**
 * Gets the active video provider from settings
 * @returns Promise with provider name ('agora' or 'daily')
 */
export const getActiveVideoProvider = async (): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "video_provider")
      .single();

    if (error) {
      console.error("❌ Error fetching video provider setting:", error);
      return 'agora'; // Default to Agora if error
    }

    return data?.setting_value || 'agora';
  } catch (error) {
    console.error("💥 Error getting active video provider:", error);
    return 'agora'; // Default to Agora if error
  }
};