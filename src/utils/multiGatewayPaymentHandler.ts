import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  getPaymentSettings,
  loadFlutterwaveScript,
  loadPaystackScript,
  generatePaymentRef,
  validateGatewaySettings,
  PaymentGateway
} from "./paymentGatewayUtils";
import { deductFromWallet, hasInsufficientBalance, rollbackWalletTransaction } from "./walletUtils";
import { generateSessionIdempotencyKey, generateIdempotencyKey } from "./webhookVerification";

export type PaymentMethod = 'wallet' | 'flutterwave' | 'paystack';

interface PaymentData {
  user: any;
  userProfile: any;
  babalawo: any;
  date: Date;
  selectedTime: string;
  amount: number;
  paymentMethod: PaymentMethod;
  walletBalance?: number;
  isInstant?: boolean; // Added this line
}

export const handlePaymentAndBooking = async (
  paymentData: PaymentData,
  onSuccess: (sessionId: string) => void, // Modified signature
  onError: (message: string) => void
) => {
  const { user, userProfile, babalawo, date, selectedTime, amount, paymentMethod, walletBalance, isInstant } = paymentData; // Updated this line

  try {
    console.log("🚀 Starting payment process with method:", paymentMethod);

    if (paymentMethod === 'wallet') {
      await handleWalletPayment(paymentData, onSuccess, onError);
    } else {
      await handleGatewayPayment(paymentData, onSuccess, onError);
    }
  } catch (err: any) {
    console.error("💥 Unexpected payment error:", err);
    onError("An unexpected error occurred: " + err.message);
  }
};

const handleWalletPayment = async (
  paymentData: PaymentData,
  onSuccess: (sessionId: string) => void,
  onError: (message: string) => void
) => {
  const { user, userProfile, babalawo, date, selectedTime, amount, walletBalance = 0, isInstant } = paymentData;

  if (hasInsufficientBalance(walletBalance, amount)) {
    onError("Insufficient wallet balance. Please add money to your wallet or use a different payment method.");
    return;
  }

  let transactionId: string | null = null;

  try {
    console.log("💰 Processing wallet payment for session...");

    // Generate idempotency key for this transaction
    const sessionDate = format(date, "yyyy-MM-dd");
    const walletIdempotencyKey = generateIdempotencyKey(
      user?.id,
      `wallet-${babalawo.id}-${sessionDate}-${selectedTime}`,
      Date.now()
    );

    // Deduct from wallet with idempotency key
    const deductResult = await deductFromWallet(
      user?.id,
      amount,
      undefined,
      "Consultation session payment",
      walletIdempotencyKey
    );

    if (!deductResult.success) {
      onError("Failed to process wallet payment. Please try again.");
      return;
    }

    transactionId = deductResult.transactionId || null;
    console.log(`✅ Wallet debited successfully. Transaction ID: ${transactionId}`);

    // Create session with rollback support
    await createSession(
      { ...paymentData, userProfile },
      "wallet",
      walletIdempotencyKey,
      onSuccess,
      onError,
      transactionId
    );

  } catch (error: any) {
    console.error("❌ Wallet payment error:", error);

    // Rollback wallet deduction if we have a transaction ID
    if (transactionId) {
      console.log(`🔄 Rolling back wallet transaction: ${transactionId}`);
      const rolledBack = await rollbackWalletTransaction(transactionId);

      if (rolledBack) {
        onError("Payment failed and has been refunded to your wallet. Please try again.");
      } else {
        onError("Payment failed. Please contact support with transaction ID: " + transactionId);
      }
    } else {
      onError("Failed to process wallet payment. Please try again.");
    }
  }
};

const handleGatewayPayment = async (
  paymentData: PaymentData,
  onSuccess: (sessionId: string) => void, // Modified signature
  onError: (message: string) => void
) => {
  const { paymentMethod } = paymentData;
  const gateway = paymentMethod as PaymentGateway;

  try {
    // Get payment settings
    const settings = await getPaymentSettings();
    
    if (!validateGatewaySettings(gateway, settings)) {
      onError(`${gateway} is not properly configured. Please contact administrator.`);
      return;
    }

    // Load appropriate script
    if (gateway === 'flutterwave') {
      await loadFlutterwaveScript();
      await initiateFlutterwavePayment(paymentData, settings, onSuccess, onError);
    } else if (gateway === 'paystack') {
      await loadPaystackScript();
      await initiatePaystackPayment(paymentData, settings, onSuccess, onError);
    }
  } catch (error: any) {
    console.error(`❌ ${gateway} payment error:`, error);
    onError(error.message || `Failed to initialize ${gateway} payment`);
  }
};

const initiateFlutterwavePayment = async (
  paymentData: PaymentData,
  settings: any,
  onSuccess: (sessionId: string) => void, // Modified signature
  onError: (message: string) => void
) => {
  const { user, userProfile, babalawo, amount } = paymentData;
  const paymentRef = generatePaymentRef('flutterwave');

  window.FlutterwaveCheckout({
    public_key: settings.flutterwave_public_key,
    tx_ref: paymentRef,
    amount: amount,
    currency: "NGN",
    payment_options: "card,account,banktransfer,ussd",
    customer: {
      email: userProfile?.email || user?.email || "user@example.com",
      name: userProfile?.full_name || "User"
    },
    callback: async function(response: any) {
      if (response.status === "successful") {
        await createSession(paymentData, "flutterwave", paymentRef, onSuccess, onError);
      } else {
        onError("Payment was not completed successfully.");
      }
    },
    onclose: function() {
      console.log("🔒 Flutterwave payment modal closed");
    },
    customizations: {
      title: "IFA.ng",
      description: `Consultation with ${babalawo.full_name || babalawo.name || "Babalawo"}`,
      logo: "/favicon.ico"
    }
  });
};

const initiatePaystackPayment = async (
  paymentData: PaymentData,
  settings: any,
  onSuccess: (sessionId: string) => void, // Modified signature
  onError: (message: string) => void
) => {
  const { user, userProfile, babalawo, amount } = paymentData;
  const paymentRef = generatePaymentRef('paystack');

  const handler = window.PaystackPop.setup({
    key: settings.paystack_public_key,
    email: userProfile?.email || user?.email || "user@example.com",
    amount: amount * 100, // Paystack expects amount in kobo
    currency: 'NGN',
    ref: paymentRef,
    callback: async function(response: any) {
      if (response.status === "success") {
        await createSession(paymentData, "paystack", paymentRef, onSuccess, onError);
      } else {
        onError("Payment was not completed successfully.");
      }
    },
    onClose: function() {
      console.log("🔒 Paystack payment modal closed");
    }
  });

  handler.openIframe();
};

const createSession = async (
  paymentData: PaymentData,
  paymentMethod: string,
  paymentRef: string,
  onSuccess: (sessionId: string) => void,
  onError: (message: string) => void,
  walletTransactionId?: string | null
) => {
  const { user, userProfile, babalawo, date, selectedTime, amount, isInstant } = paymentData;

  try {
    console.log("✅ Payment successful, creating session...");

    const sessionDate = format(date, "yyyy-MM-dd");

    // Generate idempotency key for session
    const sessionIdempotencyKey = generateSessionIdempotencyKey(
      user.id,
      babalawo.id,
      sessionDate,
      selectedTime
    );

    // Check for duplicate session
    const { data: duplicateCheck } = await supabase.rpc('check_duplicate_session', {
      p_user_id: user.id,
      p_babalawo_id: babalawo.id,
      p_session_date: sessionDate,
      p_start_time: selectedTime,
      p_idempotency_key: sessionIdempotencyKey
    });

    if (duplicateCheck) {
      console.log(`⚠️ Duplicate session detected: ${duplicateCheck}`);
      onSuccess(String(duplicateCheck));
      return;
    }

    // For instant sessions, check babalawo concurrent session limit
    if (isInstant) {
      const { data: canAcceptSession } = await supabase.rpc('check_babalawo_concurrent_sessions', {
        p_babalawo_id: babalawo.id,
        p_max_concurrent: 1
      });

      if (!canAcceptSession) {
        // Rollback wallet transaction if applicable
        if (walletTransactionId) {
          await rollbackWalletTransaction(walletTransactionId);
        }
        onError("This babalawo is currently in another session. Please try again later.");
        return;
      }

      // Re-check babalawo online status
      const { data: babalawoStatus } = await supabase
        .from('babalawos')
        .select('is_active, current_status')
        .eq('id', babalawo.id)
        .single();

      if (!babalawoStatus?.is_active || babalawoStatus?.current_status !== 'online') {
        // Rollback wallet transaction if applicable
        if (walletTransactionId) {
          await rollbackWalletTransaction(walletTransactionId);
        }
        onError("This babalawo is no longer available for instant consultation.");
        return;
      }
    }

    // Fetch babalawo's commission rates
    const { data: babalawoData, error: babalawoErr } = await supabase
      .from("babalawos")
      .select("commission_platform_percent, commission_babalawo_percent, user_id")
      .eq("id", babalawo.id)
      .single();

    if (babalawoErr) {
      console.error("❌ Error fetching babalawo data:", babalawoErr);
      throw babalawoErr;
    }

    // Calculate commission split (default to 20/80 if not set)
    const platformPercent = babalawoData?.commission_platform_percent || 20;
    const babalawoPercent = babalawoData?.commission_babalawo_percent || 80;

    const commissionAmount = (amount * platformPercent) / 100;
    const babalawoAmount = (amount * babalawoPercent) / 100;

    console.log(`💰 Commission split: Platform ${platformPercent}% (₦${commissionAmount.toFixed(2)}), Babalawo ${babalawoPercent}% (₦${babalawoAmount.toFixed(2)})`);

    // Determine session status based on isInstant flag
    const sessionStatus = isInstant ? "in_progress" : "confirmed";

    // Save session
    const { data: sessionData, error: sessionErr } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        babalawo_id: babalawo.id,
        session_date: sessionDate,
        start_time: selectedTime,
        end_time: selectedTime,
        status: sessionStatus,
        amount: amount,
        payment_status: "paid",
        payment_reference: paymentRef,
        notes: isInstant ? "Instant consultation" : "",
        is_instant: isInstant || false,
        user_timezone: userProfile?.timezone || 'UTC',
        idempotency_key: sessionIdempotencyKey,
        duplicate_check_key: `${user.id}-${babalawo.id}-${sessionDate}-${selectedTime}`
      })
      .select()
      .single();

    if (sessionErr) {
      console.error("❌ Session creation error:", sessionErr);

      // Rollback wallet transaction if applicable
      if (walletTransactionId) {
        console.log("🔄 Rolling back wallet transaction due to session creation failure");
        await rollbackWalletTransaction(walletTransactionId);
        onError("Booking failed and payment has been refunded. Please try again.");
      } else {
        onError("Payment successful but booking failed. Please contact support with reference: " + paymentRef);
      }
      return;
    }

    console.log("✅ Session created successfully:", sessionData);

    // Generate payment idempotency key
    const paymentIdempotencyKey = generateIdempotencyKey(
      user.id,
      paymentRef,
      Date.now()
    );

    // Save payment record with commission split
    const { error: paymentErr } = await supabase.from("payments").insert({
      user_id: user.id,
      babalawo_id: babalawo.id, // FIXED: Added babalawo_id
      session_id: sessionData.id,
      amount: amount,
      commission_amount: commissionAmount,
      babalawo_amount: babalawoAmount,
      payment_gateway: paymentMethod,
      payment_reference: paymentRef,
      status: "completed",
      idempotency_key: paymentIdempotencyKey,
      webhook_verified: paymentMethod === 'wallet' // Wallet payments don't need webhook
    });

    if (paymentErr) {
      console.error("❌ Payment record error:", paymentErr);
      // Don't fail the session if payment record fails, but log it
    }

    // For instant sessions, create notification for babalawo
    if (isInstant && babalawoData?.user_id) {
      await supabase.rpc('create_notification', {
        p_user_id: babalawoData.user_id,
        p_type: 'instant_session_request',
        p_title: 'New Instant Session',
        p_message: `${userProfile?.full_name || 'A user'} has started an instant consultation`,
        p_data: { session_id: sessionData.id },
        p_priority: 'high'
      });

      console.log("🔔 Notification sent to babalawo for instant session");
    }

    onSuccess(String(sessionData.id));

  } catch (error: any) {
    console.error("❌ Error creating session:", error);

    // Rollback wallet transaction if applicable
    if (walletTransactionId) {
      console.log("🔄 Rolling back wallet transaction due to error");
      await rollbackWalletTransaction(walletTransactionId);
      onError("Booking failed and payment has been refunded. Please try again.");
    } else {
      onError("Payment successful but booking processing failed. Please contact support.");
    }
  }
};
