// Supabase Edge Function for Paystack Webhook
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
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
    const signature = req.headers.get('x-paystack-signature');

    // Get raw body for signature verification
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    console.log('📥 Paystack webhook received:', {
      event: payload.event,
      reference: payload.data?.reference,
      status: payload.data?.status
    });

    // Get secret key from admin settings
    const { data: settings } = await supabaseClient
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'paystack_secret_key')
      .single();

    const secretKey = settings?.setting_value;

    if (!secretKey) {
      console.error('❌ Paystack secret key not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature using HMAC SHA512
    const hash = createHmac('sha512', secretKey)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error('❌ Invalid webhook signature');
      console.error('Expected:', hash);
      console.error('Received:', signature);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Webhook signature verified');

    // Process successful payment
    if (payload.event === 'charge.success' && payload.data.status === 'success') {
      const reference = payload.data.reference;
      const amount = payload.data.amount / 100; // Convert from kobo to naira
      const customerEmail = payload.data.customer?.email;

      console.log(`✅ Processing successful payment: ${reference}, Amount: ₦${amount}`);

      // Check if this is a wallet top-up or session payment
      if (reference.startsWith('PSK-WALLET-')) {
        // Wallet top-up
        await processWalletTopUp(supabaseClient, reference, amount, customerEmail);
      } else if (reference.startsWith('PSK-SESSION-')) {
        // Session payment
        await processSessionPayment(supabaseClient, reference, amount, payload.data);
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

async function processWalletTopUp(supabaseClient: any, reference: string, amount: number, email: string) {
  // Find the wallet transaction by payment reference
  const { data: transaction } = await supabaseClient
    .from('wallet_transactions')
    .select('*')
    .eq('payment_reference', reference)
    .single();

  if (!transaction) {
    console.warn(`⚠️ No wallet transaction found for reference: ${reference}`);
    return;
  }

  // Mark as webhook verified
  await supabaseClient
    .from('wallet_transactions')
    .update({ webhook_verified: true })
    .eq('id', transaction.id);

  console.log(`✅ Wallet transaction ${transaction.id} verified via webhook`);
}

async function processSessionPayment(supabaseClient: any, reference: string, amount: number, paymentData: any) {
  // Find the payment record by payment reference
  const { data: payment } = await supabaseClient
    .from('payments')
    .select('*')
    .eq('payment_reference', reference)
    .single();

  if (!payment) {
    console.warn(`⚠️ No payment found for reference: ${reference}`);
    return;
  }

  // Mark as webhook verified
  await supabaseClient
    .from('payments')
    .update({ webhook_verified: true })
    .eq('id', payment.id);

  console.log(`✅ Payment ${payment.id} verified via webhook`);
}
