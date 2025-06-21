
import { supabase } from "@/integrations/supabase/client";

// Extend Window interface for Flutterwave
declare global {
  interface Window {
    FlutterwaveCheckout: (config: any) => void;
  }
}

// Utility to load Flutterwave JS
let flutterwaveScriptLoaded = false;

export function loadFlutterwaveJs(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (flutterwaveScriptLoaded) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.onload = () => {
      flutterwaveScriptLoaded = true;
      resolve(true);
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

// Helper for generating payment ref
export const generatePaymentRef = () => "IFANG-" + Math.random().toString(36).substr(2, 9).toUpperCase();

export const getFlutterwaveSettings = async () => {
  try {
    console.log("🔍 Fetching Flutterwave settings from admin_settings table...");
    
    // Default test keys to use if no settings are found or if settings are empty
    const defaultSettings: Record<string, string> = {
      flutterwave_public_key: "FLWPUBK_TEST-7d2b1d0e9b0d7a9f5f7b9f7b9f7b9f7b-X",
      flutterwave_secret_key: "FLWSECK_TEST-REDACTED",
      flutterwave_environment: "test"
    };
    
    const { data, error } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "flutterwave_environment",
        "flutterwave_public_key",
        "flutterwave_secret_key"
      ]);

    console.log("📊 Database query result:", { data, error, dataLength: data?.length });

    if (error) {
      console.error("❌ Database error:", error);
      console.log("⚠️ Using default test Flutterwave settings");
      return defaultSettings;
    }

    // Check if we got any data back
    if (!data || data.length === 0) {
      console.log("⚠️ No settings found in admin_settings table, using default test settings");
      return defaultSettings;
    }

    // Convert array to object with enhanced validation
    const settings: Record<string, string> = { ...defaultSettings };
    data.forEach((row: any) => {
      console.log("🔍 Processing setting row:", row);
      if (row.setting_key && row.setting_value !== null && row.setting_value !== undefined) {
        const trimmedValue = row.setting_value.toString().trim();
        if (trimmedValue !== '') {
          settings[row.setting_key] = trimmedValue;
          console.log(`✅ Added setting: ${row.setting_key} = ${trimmedValue.substring(0, 10)}...`);
        } else {
          console.log(`⚠️ Empty value for setting: ${row.setting_key}, using default`);
        }
      } else {
        console.log(`⚠️ Invalid setting row:`, row);
      }
    });
    
    console.log("🔧 Processed settings:", {
      keysFound: Object.keys(settings),
      hasPublicKey: !!settings.flutterwave_public_key,
      hasSecretKey: !!settings.flutterwave_secret_key,
      environment: settings.flutterwave_environment,
      totalSettings: Object.keys(settings).length
    });
    
    // Log the settings we're using
    console.log("🔧 Using Flutterwave settings:", {
      keysFound: Object.keys(settings),
      hasPublicKey: !!settings.flutterwave_public_key,
      hasSecretKey: !!settings.flutterwave_secret_key,
      environment: settings.flutterwave_environment,
      totalSettings: Object.keys(settings).length
    });
    
    console.log("✅ All Flutterwave settings validated successfully");
    return settings;
  } catch (error: any) {
    console.error("💥 Error in getFlutterwaveSettings:", error);
    throw error;
  }
};
