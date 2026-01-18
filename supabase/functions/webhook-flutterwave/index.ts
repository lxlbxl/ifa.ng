// Supabase Edge Function for Flutterwave Webhook
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get webhook signature from header
    const signature = req.headers.get('verif-hash');

    // Parse request body
    const payload = await req.json();

    console.log('📥 Flutterwave webhook received:', {
      event: payload.event,
      txRef: payload.data?.tx_ref,
      status: payload.data?.status
    });

    // Get secret hash from admin settings
    const { data: settings } = await supabaseClient
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'flutterwave_secret_hash')
      .single();

    const secretHash = settings?.setting_value;

    if (!secretHash) {
      console.error('❌ Flutterwave secret hash not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature
    if (signature !== secretHash) {
      console.error('❌ Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process successful payment
    if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
      const txRef = payload.data.tx_ref;
      const amount = payload.data.amount;
      const customerEmail = payload.data.customer?.email;

      console.log(`✅ Processing successful payment: ${txRef}, Amount: ₦${amount}`);

      // Check if this is a wallet top-up or session payment
      if (txRef.startsWith('FLW-WALLET-')) {
        // Wallet top-up
        await processWalletTopUp(supabaseClient, txRef, amount, customerEmail);
      } else if (txRef.startsWith('FLW-SESSION-')) {
        // Session payment
        await processSessionPayment(supabaseClient, txRef, amount, payload.data);
      }

      // Log payment audit
      await supabaseClient.rpc('log_payment_audit', {
        p_payment_id: null, // Will be found by reference
        p_event_type: 'webhook_received',
        p_event_data: payload
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processWalletTopUp(supabaseClient: any, txRef: string, amount: number, email: string) {
  // Find the wallet transaction by payment reference
  const { data: transaction } = await supabaseClient
    .from('wallet_transactions')
    .select('*')
    .eq('payment_reference', txRef)
    .single();

  if (!transaction) {
    console.warn(`⚠️ No wallet transaction found for reference: ${txRef}`);
    return;
  }

  // Mark as webhook verified
  await supabaseClient
    .from('wallet_transactions')
    .update({ webhook_verified: true })
    .eq('id', transaction.id);

  console.log(`✅ Wallet transaction ${transaction.id} verified via webhook`);
}

async function processSessionPayment(supabaseClient: any, txRef: string, amount: number, paymentData: any) {
  // Find the payment record by payment reference
  const { data: payment } = await supabaseClient
    .from('payments')
    .select('*')
    .eq('payment_reference', txRef)
    .single();

  if (!payment) {
    console.warn(`⚠️ No payment found for reference: ${txRef}`);
    return;
  }

  // Mark as webhook verified
  await supabaseClient
    .from('payments')
    .update({ webhook_verified: true })
    .eq('id', payment.id);

  console.log(`✅ Payment ${payment.id} verified via webhook`);
}
