
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getFlutterwaveSettings, loadFlutterwaveJs, generatePaymentRef } from "./flutterwaveUtils";

interface PaymentData {
  user: any;
  userProfile: any;
  babalawo: any;
  date: Date;
  selectedTime: string;
  amount: number;
}

export const handlePaymentAndBooking = async (
  paymentData: PaymentData,
  onSuccess: () => void,
  onError: (message: string) => void
) => {
  const { user, userProfile, babalawo, date, selectedTime, amount } = paymentData;

  try {
    console.log("🚀 Starting payment process...");
    
    // Get Flutterwave settings with enhanced error handling
    let flutterSettings;
    try {
      flutterSettings = await getFlutterwaveSettings();
      console.log("✅ Successfully retrieved Flutterwave settings");
    } catch (settingsError: any) {
      console.error("❌ Failed to get Flutterwave settings:", settingsError);
      onError(settingsError.message || "Unable to load payment settings. Please contact administrator.");
      return;
    }

    // Load Flutterwave script
    try {
      await loadFlutterwaveJs();
      console.log("✅ Flutterwave script loaded successfully");
    } catch (scriptError) {
      console.error("❌ Failed to load Flutterwave script:", scriptError);
      onError("Failed to load payment system. Please check your internet connection and try again.");
      return;
    }

    // Check if FlutterwaveCheckout is available
    if (typeof window.FlutterwaveCheckout !== 'function') {
      console.error("❌ FlutterwaveCheckout not available on window object");
      onError("Payment system not properly initialized. Please refresh the page and try again.");
      return;
    }

    const paymentRef = generatePaymentRef();

    console.log("💳 Initializing Flutterwave payment:", {
      amount,
      currency: "NGN",
      paymentRef,
      publicKeyPrefix: flutterSettings.flutterwave_public_key.substring(0, 10) + "...",
      environment: flutterSettings.flutterwave_environment
    });

    // Initialize Flutterwave payment
    window.FlutterwaveCheckout({
      public_key: flutterSettings.flutterwave_public_key,
      tx_ref: paymentRef,
      amount: amount,
      currency: "NGN",
      payment_options: "card,account,banktransfer,ussd",
      redirect_url: undefined,
      customer: {
        email: userProfile?.email || user?.email || "user@example.com",
        name: userProfile?.full_name || "User"
      },
      callback: async function(response: any) {
        console.log("📞 Payment callback received:", response);
        if (response.status === "successful") {
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
              payment_method: "flutterwave",
              status: "completed",
              flutterwave_reference: paymentRef,
              flutterwave_transaction_id: response.transaction_id
            });
            
            if (paymentErr) {
              console.error("❌ Payment record error:", paymentErr);
              // Don't fail the entire process for this
            }
            
            onSuccess();
            
          } catch (error) {
            console.error("❌ Error processing successful payment:", error);
            onError("Payment successful but booking processing failed. Please contact support.");
          }
        } else {
          console.log("❌ Payment not successful:", response);
          onError("Payment was not completed successfully.");
        }
      },
      onclose: function() {
        console.log("🔒 Payment modal closed by user");
      },
      customizations: {
        title: "IFA.ng",
        description: `Consultation with ${babalawo.full_name || babalawo.name || "Babalawo"}`,
        logo: "/favicon.ico"
      }
    });
    
  } catch (err: any) {
    console.error("💥 Unexpected payment error:", err);
    onError("An unexpected error occurred: " + err.message);
  }
};
