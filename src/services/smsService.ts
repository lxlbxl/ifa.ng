import { supabase } from "@/integrations/supabase/client";

export interface SMSSettings {
  sms_provider: string;
  termii_api_key: string;
  termii_sender_id: string;
  sms_notifications_enabled: boolean;
}

interface SendSMSOptions {
  to: string;
  message: string;
}

let cachedSMSSettings: SMSSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch SMS settings from admin_settings
 */
async function getSMSSettings(): Promise<SMSSettings | null> {
  // Return cached settings if still valid
  const now = Date.now();
  if (cachedSMSSettings && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedSMSSettings;
  }

  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'sms_provider',
        'termii_api_key',
        'termii_sender_id',
        'sms_notifications_enabled'
      ]);

    if (error) throw error;

    const settings = (data || []).reduce((acc: any, item) => {
      acc[item.setting_key] = item.setting_value;
      return acc;
    }, {});

    // Check if SMS is enabled
    if (settings.sms_notifications_enabled === 'false' || !settings.sms_notifications_enabled) {
      return null;
    }

    cachedSMSSettings = {
      sms_provider: settings.sms_provider || 'termii',
      termii_api_key: settings.termii_api_key || '',
      termii_sender_id: settings.termii_sender_id || 'IFA Connect',
      sms_notifications_enabled: settings.sms_notifications_enabled !== 'false'
    };

    cacheTimestamp = now;
    return cachedSMSSettings;
  } catch (error) {
    console.error('Error fetching SMS settings:', error);
    return null;
  }
}

/**
 * Send SMS via Termii API
 * Documentation: https://developers.termii.com/messaging
 */
async function sendViaTermii(options: SendSMSOptions, settings: SMSSettings): Promise<boolean> {
  const { to, message } = options;
  const { termii_api_key, termii_sender_id } = settings;

  if (!termii_api_key) {
    console.error('Termii API key not configured');
    return false;
  }

  try {
    // Format phone number for Nigerian context
    let phoneNumber = to.replace(/\s+/g, '');

    // Convert to international format if needed
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '234' + phoneNumber.substring(1);
    } else if (!phoneNumber.startsWith('234') && !phoneNumber.startsWith('+234')) {
      phoneNumber = '234' + phoneNumber;
    }

    phoneNumber = phoneNumber.replace('+', '');

    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phoneNumber,
        from: termii_sender_id,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: termii_api_key
      })
    });

    const result = await response.json();

    if (response.ok && result.message_id) {
      console.log('✅ SMS sent successfully via Termii:', result.message_id);
      return true;
    } else {
      console.error('❌ Termii SMS failed:', result);
      return false;
    }
  } catch (error) {
    console.error('Error sending SMS via Termii:', error);
    return false;
  }
}

/**
 * Send SMS notification
 */
export async function sendSMS(options: SendSMSOptions): Promise<boolean> {
  const settings = await getSMSSettings();

  if (!settings) {
    console.log('SMS notifications are disabled or not configured');
    return false;
  }

  // Currently only Termii is supported
  if (settings.sms_provider === 'termii') {
    return await sendViaTermii(options, settings);
  }

  console.error('Unsupported SMS provider:', settings.sms_provider);
  return false;
}

/**
 * Send booking confirmation SMS
 */
export async function sendBookingConfirmationSMS(data: {
  to: string;
  userName: string;
  babalawoName: string;
  sessionDate: string;
  sessionTime: string;
  amount: number;
}): Promise<boolean> {
  const message = `Hello ${data.userName}, your session with ${data.babalawoName} is confirmed for ${data.sessionDate} at ${data.sessionTime}. Amount: ₦${data.amount.toLocaleString()}. Thank you for using IFA Connect.`;

  return await sendSMS({
    to: data.to,
    message
  });
}

/**
 * Send wallet top-up confirmation SMS
 */
export async function sendWalletTopUpSMS(data: {
  to: string;
  userName: string;
  amount: number;
  newBalance: number;
}): Promise<boolean> {
  const message = `Hello ${data.userName}, your wallet has been credited with ₦${data.amount.toLocaleString()}. New balance: ₦${data.newBalance.toLocaleString()}. - IFA Connect`;

  return await sendSMS({
    to: data.to,
    message
  });
}

/**
 * Send instant session alert SMS to Babalawo
 */
export async function sendInstantSessionAlertSMS(data: {
  to: string;
  babalawoName: string;
  userName: string;
}): Promise<boolean> {
  const message = `Hello ${data.babalawoName}, ${data.userName} is requesting an instant consultation and is waiting for you now. Please check your dashboard. - IFA Connect`;

  return await sendSMS({
    to: data.to,
    message
  });
}

/**
 * Send session reminder SMS
 */
export async function sendSessionReminderSMS(data: {
  to: string;
  userName: string;
  babalawoName: string;
  sessionTime: string;
}): Promise<boolean> {
  const message = `Reminder: Your session with ${data.babalawoName} starts in 30 minutes at ${data.sessionTime}. Please be ready. - IFA Connect`;

  return await sendSMS({
    to: data.to,
    message
  });
}

/**
 * Check if a phone number is valid for SMS
 */
export function isValidNigerianPhone(phone: string): boolean {
  // Remove spaces and special characters
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Check if it matches Nigerian phone number patterns
  // 070XXXXXXXX, 080XXXXXXXX, 090XXXXXXXX, 081XXXXXXXX, etc.
  // Or international format: +234XXXXXXXXXX or 234XXXXXXXXXX
  const patterns = [
    /^0[7-9][0-1]\d{8}$/, // Nigerian local format
    /^\+?234[7-9][0-1]\d{8}$/ // International format
  ];

  return patterns.some(pattern => pattern.test(cleaned));
}
