
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AgoraTokenRequest {
  session_id: string;
  role: 'user' | 'babalawo';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { session_id, role }: AgoraTokenRequest = await req.json();

    if (!session_id || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id or role' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get Agora settings from admin_settings
    const { data: settings, error: settingsError } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['agora_app_id', 'agora_app_certificate', 'agora_token_expiry']);

    if (settingsError || !settings) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Agora settings' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const settingsMap = settings.reduce((acc: any, setting: any) => {
      acc[setting.setting_key] = setting.setting_value;
      return acc;
    }, {});

    const appId = settingsMap.agora_app_id;
    const appCertificate = settingsMap.agora_app_certificate;
    const tokenExpiry = parseInt(settingsMap.agora_token_expiry || '3600');

    if (!appId || !appCertificate) {
      return new Response(
        JSON.stringify({ error: 'Agora credentials not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Generate channel name and UID
    const channelName = `session-${session_id}`;
    const uid = role === 'user' ? 1 : 2; // Simple UID assignment
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + tokenExpiry;

    // For now, we'll return a simple token structure
    // In production, you'd use the actual Agora token generation SDK
    const token = `${appId}-${channelName}-${uid}-${privilegeExpiredTs}`;

    // Update session with Agora details
    const updateData: any = {
      agora_channel_name: channelName,
    };

    if (role === 'user') {
      updateData.agora_token_user = token;
    } else {
      updateData.agora_token_babalawo = token;
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', session_id);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update session' }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        channelName,
        token,
        uid,
        appId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-agora-token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
