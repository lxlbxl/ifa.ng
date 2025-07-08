import { serve } from "std/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    const { sessionId } = await req.json();

    // Fetch Daily.co settings from admin_settings table
    const { data: settings, error } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["daily_api_key", "daily_room_expiry"]);

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to fetch Daily.co settings" }), { status: 500 });
    }

    // Map settings to key-value
    const settingsMap: Record<string, string> = {};
    for (const setting of settings || []) {
      settingsMap[setting.setting_key] = setting.setting_value;
    }

    const apiKey = settingsMap["daily_api_key"];
    const roomExpiry = parseInt(settingsMap["daily_room_expiry"]) || 3600;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Daily.co API Key not configured" }), { status: 500 });
    }

    // Check if session already has a room URL
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("room_url")
      .eq("id", sessionId)
      .single();

    if (sessionError) {
      return new Response(JSON.stringify({ error: "Failed to fetch session" }), { status: 500 });
    }

    // If session already has a room URL, return it
    if (session?.room_url) {
      return new Response(JSON.stringify({ url: session.room_url }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate expiry time
    const exp = Math.floor(Date.now() / 1000) + roomExpiry;

    // Create a new Daily.co room
    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        name: `session-${sessionId}`,
        properties: {
          enable_chat: true,
          enable_screenshare: true,
          start_audio_off: false,
          start_video_off: false,
          enable_knocking: false,
          enable_prejoin_ui: true,
          exp
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return new Response(JSON.stringify({ error: errorData.error || "Failed to create Daily.co room" }), { status: 500 });
    }

    const roomData = await response.json();
    
    // Update session with room URL
    await supabase
      .from("sessions")
      .update({ room_url: roomData.url })
      .eq("id", sessionId);

    return new Response(JSON.stringify({ url: roomData.url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});