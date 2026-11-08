
import { supabase } from "@/integrations/supabase/client";

export type PaymentGateway = 'flutterwave' | 'paystack';

export interface PaymentSettings {
  flutterwave_public_key?: string;
  flutterwave_secret_key?: string;
  flutterwave_environment?: string;
  paystack_public_key?: string;
  paystack_secret_key?: string;
  paystack_environment?: string;
}

declare global {
  interface Window {
    FlutterwaveCheckout: (config: any) => void;
    PaystackPop: {
      setup: (config: any) => { openIframe: () => void };
    };
  }
}

export const getPaymentSettings = async (): Promise<PaymentSettings> => {
  try {
    console.log("🔍 Fetching payment gateway settings...");
    
    // Default test keys to use if no settings are found or if settings are empty
    const defaultSettings: PaymentSettings = {
      flutterwave_public_key: "FLWPUBK_TEST-7d2b1d0e9b0d7a9f5f7b9f7b9f7b9f7b-X",
      flutterwave_secret_key: "FLWSECK_TEST-REDACTED",
      flutterwave_environment: "test",
      paystack_public_key: "pk_test_1234567890abcdef1234567890abcdef1234567",
      paystack_secret_key: "sk_test_1234567890abcdef1234567890abcdef1234567",
      paystack_environment: "test"
    };
    
    const { data, error } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "flutterwave_public_key",
        "flutterwave_secret_key", 
        "flutterwave_environment",
        "paystack_public_key",
        "paystack_secret_key",
        "paystack_environment"
      ]);

    if (error) {
      console.error("❌ Database error:", error);
      console.log("⚠️ Using default test payment settings");
      return defaultSettings;
    }

    if (!data || data.length === 0) {
      console.log("⚠️ No payment settings found, using default test settings");
      return defaultSettings;
    }

    const settings: PaymentSettings = { ...defaultSettings };
    data.forEach((row: any) => {
      if (row.setting_key && row.setting_value !== null && row.setting_value !== undefined) {
        const trimmedValue = row.setting_value.toString().trim();
        if (trimmedValue !== '') {
          settings[row.setting_key as keyof PaymentSettings] = trimmedValue;
        }
      }
    });
    
    console.log("✅ Payment settings retrieved successfully");
    return settings;
  } catch (error: any) {
    console.error("💥 Error getting payment settings:", error);
    throw error;
  }
};

export const loadFlutterwaveScript = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (typeof window.FlutterwaveCheckout === 'function') {
      return resolve(true);
    }
    
    const script = document.createElement("script");
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Failed to load Flutterwave script"));
    document.head.appendChild(script);
  });
};

export const loadPaystackScript = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (typeof window.PaystackPop === 'object') {
      return resolve(true);
    }
    
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Failed to load Paystack script"));
    document.head.appendChild(script);
  });
};

export const generatePaymentRef = (gateway: PaymentGateway) => {
  const prefix = gateway === 'flutterwave' ? 'FLW' : 'PSK';
  return `IFANG-${prefix}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

export const validateGatewaySettings = (gateway: PaymentGateway, settings: PaymentSettings): boolean => {
  if (gateway === 'flutterwave') {
    return !!(settings.flutterwave_public_key && settings.flutterwave_environment);
  } else if (gateway === 'paystack') {
    return !!(settings.paystack_public_key && settings.paystack_environment);
  }
  return false;
};
