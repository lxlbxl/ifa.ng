import { supabase } from "@/integrations/supabase/client";
import { formatMoney, type Currency } from "@/hooks/usePricing";

/**
 * Estimate of the fee Paystack or Flutterwave adds on top at checkout.
 * Both providers are set to "pass fees to customer", so the provider works out the real fee on
 * its own payment page and the server records what it reports. This is only a preview.
 */
export interface PaymentFeeSettings {
  flutterwave_fee_percent: number;
  flutterwave_fee_cap: number;
  flutterwave_usd_fee_percent: number;
  paystack_fee_percent: number;
  paystack_fee_cap: number;
  paystack_fee_flat: number;
  paystack_fee_flat_waived_below: number;
  show_payment_fees: boolean;
}

export interface FeeCalculation {
  amount: number;
  fee: number;
  total: number;
  feePercent: number;
  currency: Currency;
}

const DEFAULTS: PaymentFeeSettings = {
  flutterwave_fee_percent: 2,
  flutterwave_fee_cap: 2000,
  flutterwave_usd_fee_percent: 4.8,
  paystack_fee_percent: 1.5,
  paystack_fee_cap: 2000,
  paystack_fee_flat: 100,
  paystack_fee_flat_waived_below: 2500,
  show_payment_fees: true,
};

let cachedFeeSettings: PaymentFeeSettings | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export async function getPaymentFeeSettings(): Promise<PaymentFeeSettings> {
  const now = Date.now();
  if (cachedFeeSettings && now - cacheTimestamp < CACHE_DURATION) return cachedFeeSettings;
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [...Object.keys(DEFAULTS)]);
    if (error) throw error;
    const s = Object.fromEntries((data || []).map((r) => [r.setting_key, r.setting_value])) as Record<string, string | undefined>;
    const n = (k: keyof PaymentFeeSettings) => {
      const v = parseFloat(s[k] ?? '');
      return Number.isFinite(v) ? v : (DEFAULTS[k] as number);
    };
    cachedFeeSettings = {
      flutterwave_fee_percent: n('flutterwave_fee_percent'),
      flutterwave_fee_cap: n('flutterwave_fee_cap'),
      flutterwave_usd_fee_percent: n('flutterwave_usd_fee_percent'),
      paystack_fee_percent: n('paystack_fee_percent'),
      paystack_fee_cap: n('paystack_fee_cap'),
      paystack_fee_flat: n('paystack_fee_flat'),
      paystack_fee_flat_waived_below: n('paystack_fee_flat_waived_below'),
      show_payment_fees: s.show_payment_fees !== 'false',
    };
    cacheTimestamp = now;
    return cachedFeeSettings;
  } catch (error) {
    console.error('Error fetching payment fee settings:', error);
    return DEFAULTS;
  }
}

/** Pure fee estimate, for a payment of `amount` in `currency` through `gateway`. */
export function estimateFee(s: PaymentFeeSettings, gateway: 'flutterwave' | 'paystack', amount: number, currency: Currency = 'NGN'): FeeCalculation {
  let fee: number;
  let feePercent: number;
  if (currency === 'USD') {
    // Dollar payments only go through Flutterwave.
    feePercent = s.flutterwave_usd_fee_percent;
    fee = (amount * feePercent) / 100;
  } else if (gateway === 'paystack') {
    feePercent = s.paystack_fee_percent;
    fee = (amount * feePercent) / 100 + (amount >= s.paystack_fee_flat_waived_below ? s.paystack_fee_flat : 0);
    fee = Math.min(fee, s.paystack_fee_cap);
  } else {
    feePercent = s.flutterwave_fee_percent;
    fee = Math.min((amount * feePercent) / 100, s.flutterwave_fee_cap);
  }
  fee = Math.round(fee * 100) / 100;
  return { amount, fee, total: Math.round((amount + fee) * 100) / 100, feePercent, currency };
}

export async function calculatePaymentFee(gateway: 'flutterwave' | 'paystack', amount: number, currency: Currency = 'NGN'): Promise<FeeCalculation> {
  return estimateFee(await getPaymentFeeSettings(), gateway, amount, currency);
}

export async function shouldShowPaymentFees(): Promise<boolean> {
  return (await getPaymentFeeSettings()).show_payment_fees;
}

export function formatFeeInfo(f: FeeCalculation): string {
  return `${formatMoney(f.amount, f.currency)} + ${formatMoney(f.fee, f.currency)} fee = ${formatMoney(f.total, f.currency)}`;
}
