import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { RtcTokenBuilder, RtcRole } from "agora-access-token";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { sessionId, userId } = req.body;

  try {
    const { data: settings, error } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["agora_app_id", "agora_app_certificate", "agora_token_expiry"]);

    if (error) {
      res.status(500).json({ error: "Failed to fetch Agora settings" });
      return;
    }

    const settingsMap: Record<string, string> = {};
    for (const setting of settings || []) {
      settingsMap[setting.setting_key] = setting.setting_value;
    }

    const appId = settingsMap["agora_app_id"];
    const appCertificate = settingsMap["agora_app_certificate"];
    const tokenExpiry = parseInt(settingsMap["agora_token_expiry"]) || 3600;

    if (!appId || !appCertificate) {
      res.status(500).json({ error: "Agora App ID or Certificate not configured" });
      return;
    }

    const channelName = sessionId;
    const uid = userId || 0;
    const role = RtcRole.PUBLISHER;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + tokenExpiry;

    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, role, privilegeExpiredTs);

    res.status(200).json({ token, appId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
