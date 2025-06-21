
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
import { deductFromWallet, hasInsufficientBalance } from "./walletUtils";

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
}

export const handlePaymentAndBooking = async (
  paymentData: PaymentData,
  onSuccess: () => void,
  onError: (message: string) => void
) => {
  const { user, userProfile, babalawo, date, selectedTime, amount, paymentMethod, walletBalance } = paymentData;

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
  onSuccess: () => void,
  onError: (message: string) => void
) => {
  const { user, babalawo, date, selectedTime, amount, walletBalance = 0 } = paymentData;

  if (hasInsufficientBalance(walletBalance, amount)) {
    onError("Insufficient wallet balance. Please add money to your wallet or use a different payment method.");
    return;
  }

  try {
    // Deduct from wallet
    const walletDeducted = await deductFromWallet(user?.id, amount, undefined, "Consultation session payment");
    
    if (!walletDeducted) {
      onError("Failed to process wallet payment. Please try again.");
      return;
    }

    // Create session
    await createSession(paymentData, "wallet", "", onSuccess, onError);
  } catch (error) {
    console.error("❌ Wallet payment error:", error);
    onError("Failed to process wallet payment. Please try again.");
  }
};

const handleGatewayPayment = async (
  paymentData: PaymentData,
  onSuccess: () => void,
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
  onSuccess: () => void,
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
  onSuccess: () => void,
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
  onSuccess: () => void,
  onError: (message: string) => void
) => {
  const { user, babalawo, date, selectedTime, amount } = paymentData;

  try {
    console.log("✅ Payment successful, creating session...");
    
    // Save session
    const { data: sessionData, error: sessionErr } = await supabase
      .from("sessions")
      .insert({
        user_id: user?.id,
        babalawo_id: babalawo.id,
        session_date: format(date, "yyyy-MM-dd"),
        start_time: selectedTime,
        end_time: selectedTime,
        status: "confirmed",
        amount: amount,
        payment_status: "paid",
        payment_reference: paymentRef,
        notes: ""
      })
      .select()
      .single();
      
    if (sessionErr) {
      console.error("❌ Session creation error:", sessionErr);
      onError("Payment successful but booking failed. Please contact support with reference: " + paymentRef);
      return;
    }

    console.log("✅ Session created successfully:", sessionData);

    // Save payment record
    const { error: paymentErr } = await supabase.from("payments").insert({
      user_id: user?.id,
      babalawo_id: babalawo.id,
      session_id: sessionData.id,
      amount: amount,
      payment_method: paymentMethod,
      selected_payment_method: paymentMethod,
      status: "completed",
      flutterwave_reference: paymentMethod === 'flutterwave' ? paymentRef : null,
      paystack_reference: paymentMethod === 'paystack' ? paymentRef : null,
    });
    
    if (paymentErr) {
      console.error("❌ Payment record error:", paymentErr);
    }
    
    onSuccess();
    
  } catch (error) {
    console.error("❌ Error creating session:", error);
    onError("Payment successful but booking processing failed. Please contact support.");
  }
};
