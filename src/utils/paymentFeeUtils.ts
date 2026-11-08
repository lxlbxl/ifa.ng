import { supabase } from "@/integrations/supabase/client";

export interface PaymentFeeSettings {
  flutterwave_fee_percent: number;
  flutterwave_fee_cap: number;
  paystack_fee_percent: number;
  paystack_fee_cap: number;
  show_payment_fees: boolean;
}

export interface FeeCalculation {
  amount: number;
  fee: number;
  total: number;
  feePercent: number;
}

let cachedFeeSettings: PaymentFeeSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch payment fee settings from admin_settings
 */
export async function getPaymentFeeSettings(): Promise<PaymentFeeSettings> {
  // Return cached settings if still valid
  const now = Date.now();
  if (cachedFeeSettings && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedFeeSettings;
  }

  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'flutterwave_fee_percent',
        'flutterwave_fee_cap',
        'paystack_fee_percent',
        'paystack_fee_cap',
        'show_payment_fees'
      ]);

    if (error) throw error;

    const settings = (data || []).reduce((acc: any, item) => {
      acc[item.setting_key] = item.setting_value;
      return acc;
    }, {});

    cachedFeeSettings = {
      flutterwave_fee_percent: parseFloat(settings.flutterwave_fee_percent || '1.4'),
      flutterwave_fee_cap: parseFloat(settings.flutterwave_fee_cap || '2000'),
      paystack_fee_percent: parseFloat(settings.paystack_fee_percent || '1.5'),
      paystack_fee_cap: parseFloat(settings.paystack_fee_cap || '2000'),
      show_payment_fees: settings.show_payment_fees !== 'false'
    };

    cacheTimestamp = now;
    return cachedFeeSettings;
  } catch (error) {
    console.error('Error fetching payment fee settings:', error);

    // Return default settings if fetch fails
    return {
      flutterwave_fee_percent: 1.4,
      flutterwave_fee_cap: 2000,
      paystack_fee_percent: 1.5,
      paystack_fee_cap: 2000,
      show_payment_fees: true
    };
  }
}

/**
 * Calculate payment fee for a given gateway and amount
 *
 * @param gateway - Payment gateway (flutterwave or paystack)
 * @param amount - Transaction amount in Naira
 * @returns Fee calculation breakdown
 */
export async function calculatePaymentFee(
  gateway: 'flutterwave' | 'paystack',
  amount: number
): Promise<FeeCalculation> {
  const settings = await getPaymentFeeSettings();

  let feePercent = 0;
  let feeCap = 0;

  if (gateway === 'flutterwave') {
    feePercent = settings.flutterwave_fee_percent;
    feeCap = settings.flutterwave_fee_cap;
  } else if (gateway === 'paystack') {
    feePercent = settings.paystack_fee_percent;
    feeCap = settings.paystack_fee_cap;
  }

  // Calculate percentage-based fee
  let fee = (amount * feePercent) / 100;

  // Apply cap if fee exceeds it
  if (fee > feeCap) {
    fee = feeCap;
  }

  // Round to 2 decimal places
  fee = Math.round(fee * 100) / 100;

  return {
    amount,
    fee,
    total: amount + fee,
    feePercent
  };
}

/**
 * Check if payment fees should be shown to users
 */
export async function shouldShowPaymentFees(): Promise<boolean> {
  const settings = await getPaymentFeeSettings();
  return settings.show_payment_fees;
}

/**
 * Format fee information as a readable string
 */
export function formatFeeInfo(feeCalculation: FeeCalculation): string {
  return `₦${feeCalculation.amount.toLocaleString()} + ₦${feeCalculation.fee.toLocaleString()} fee = ₦${feeCalculation.total.toLocaleString()}`;
}

/**
 * Get fee description for a payment gateway
 */
export function getFeeDescription(gateway: 'flutterwave' | 'paystack', feePercent: number, feeCap: number): string {
  return `${feePercent}% transaction fee (capped at ₦${feeCap.toLocaleString()})`;
}
