
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
export const generatePaymentRef = () => "IFACONNECT-" + Math.random().toString(36).substr(2, 9).toUpperCase();

export const getFlutterwaveSettings = async () => {
  try {
    console.log("🔍 Fetching Flutterwave settings from admin_settings table...");
    
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
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Check if we got any data back
    if (!data || data.length === 0) {
      console.log("⚠️ No settings found in admin_settings table");
      throw new Error("No Flutterwave settings found in database. Please configure payment settings in admin panel.");
    }

    // Convert array to object with enhanced validation
    const settings: Record<string, string> = {};
    data.forEach((row: any) => {
      console.log("🔍 Processing setting row:", row);
      if (row.setting_key && row.setting_value !== null && row.setting_value !== undefined) {
        const trimmedValue = row.setting_value.toString().trim();
        if (trimmedValue !== '') {
          settings[row.setting_key] = trimmedValue;
          console.log(`✅ Added setting: ${row.setting_key} = ${trimmedValue.substring(0, 10)}...`);
        } else {
          console.log(`⚠️ Empty value for setting: ${row.setting_key}`);
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
    
    // Enhanced validation with better error messages
    const requiredKeys = ['flutterwave_public_key', 'flutterwave_environment'];
    const missingKeys: string[] = [];
    const invalidKeys: string[] = [];
    
    requiredKeys.forEach(key => {
      if (!settings[key]) {
        missingKeys.push(key);
      } else if (settings[key].trim() === '') {
        invalidKeys.push(key);
      }
    });
    
    if (missingKeys.length > 0 || invalidKeys.length > 0) {
      const errorParts = [];
      if (missingKeys.length > 0) {
        errorParts.push(`Missing: ${missingKeys.join(', ')}`);
      }
      if (invalidKeys.length > 0) {
        errorParts.push(`Empty values: ${invalidKeys.join(', ')}`);
      }
      
      const errorMessage = `Invalid Flutterwave settings - ${errorParts.join('; ')}. Please configure these properly in the admin panel.`;
      console.error("❌ Settings validation failed:", errorMessage);
      throw new Error(errorMessage);
    }
    
    // Additional validation for environment
    if (!['sandbox', 'live'].includes(settings.flutterwave_environment)) {
      console.error("❌ Invalid environment:", settings.flutterwave_environment);
      throw new Error(`Invalid Flutterwave environment: ${settings.flutterwave_environment}. Must be 'sandbox' or 'live'.`);
    }
    
    // Validate public key format
    if (!settings.flutterwave_public_key.startsWith('FLWPUBK_')) {
      console.error("❌ Invalid public key format");
      throw new Error("Invalid Flutterwave public key format. Key should start with 'FLWPUBK_'.");
    }
    
    console.log("✅ All Flutterwave settings validated successfully");
    return settings;
  } catch (error: any) {
    console.error("💥 Error in getFlutterwaveSettings:", error);
    throw error;
  }
};
