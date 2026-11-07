import { serve } from "std/server";
import { createClient } from "@supabase/supabase-js";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@2.0.7";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    const { sessionId, userId } = await req.json();

    // Fetch Agora settings from admin_settings table
    const { data: settings, error } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["agora_app_id", "agora_app_certificate", "agora_token_expiry"]);

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to fetch Agora settings" }), { status: 500 });
    }

    // Map settings to key-value
    const settingsMap: Record<string, string> = {};
    for (const setting of settings || []) {
      settingsMap[setting.setting_key] = setting.setting_value;
    }

    const appId = settingsMap["agora_app_id"];
    const appCertificate = settingsMap["agora_app_certificate"];
    const tokenExpiry = parseInt(settingsMap["agora_token_expiry"]) || 3600;

    if (!appId || !appCertificate) {
      return new Response(JSON.stringify({ error: "Agora App ID or Certificate not configured" }), { status: 500 });
    }

    // Use sessionId as channel name
    const channelName = sessionId;
    const uid = userId || 0;
    const role = RtcRole.PUBLISHER;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + tokenExpiry;

    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, role, privilegeExpiredTs);

    return new Response(JSON.stringify({ token, appId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
