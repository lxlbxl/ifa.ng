import { supabase } from "@/integrations/supabase/client";

export type PaymentGateway = 'flutterwave' | 'paystack';

declare global {
  interface Window {
    FlutterwaveCheckout: (config: any) => void;
    PaystackPop: {
      setup: (config: any) => { openIframe: () => void };
    };
  }
}

export const loadFlutterwaveScript = (): Promise<boolean> =>
  new Promise((resolve, reject) => {
    if (typeof window.FlutterwaveCheckout === 'function') return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Failed to load Flutterwave script"));
    document.head.appendChild(script);
  });

export const loadPaystackScript = (): Promise<boolean> =>
  new Promise((resolve, reject) => {
    if (typeof window.PaystackPop === 'object') return resolve(true);
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Failed to load Paystack script"));
    document.head.appendChild(script);
  });

export interface PaymentIntentInfo {
  reference: string;
  amount: number; // NGN, decided by the server
  currency: string;
  gateway: PaymentGateway;
  public_key: string;
  email: string;
  name: string | null;
}

export type SettleResult =
  | { status: 'settled' | 'already_settled'; kind: 'session' | 'wallet_topup'; session_id?: number | null }
  | { status: 'slot_taken_credited_to_wallet' }
  | { status: 'pending' | 'failed' | 'amount_mismatch' | 'unknown_reference'; reason?: string };

/** Ask the server to create a payment. The server picks the amount; we never send one for a session. */
export const createPaymentIntent = async (body: {
  kind: 'session' | 'wallet_topup';
  gateway: PaymentGateway;
  amount?: number; // only honoured for wallet top-ups
  babalawo_user_id?: string;
  session_date?: string;
  start_time?: string;
  is_instant?: boolean;
}): Promise<PaymentIntentInfo> => {
  const { data, error } = await supabase.functions.invoke('payment-init', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return data as PaymentIntentInfo;
};

/** Open the gateway popup. Resolves true when the popup reports success (still unverified!), false if closed/failed. */
export const openCheckout = async (intent: PaymentIntentInfo, description: string): Promise<boolean> => {
  if (intent.gateway === 'paystack') {
    await loadPaystackScript();
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: boolean) => { if (!done) { done = true; resolve(v); } };
      window.PaystackPop.setup({
        key: intent.public_key,
        email: intent.email,
        amount: Math.round(intent.amount * 100),
        currency: intent.currency,
        ref: intent.reference,
        callback: (r: any) => finish(r?.status === 'success'),
        onClose: () => finish(false),
      }).openIframe();
    });
  }
  await loadFlutterwaveScript();
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => { if (!done) { done = true; resolve(v); } };
    window.FlutterwaveCheckout({
      public_key: intent.public_key,
      tx_ref: intent.reference,
      amount: intent.amount,
      currency: intent.currency,
      payment_options: "card,account,banktransfer,ussd",
      customer: { email: intent.email, name: intent.name ?? "IFA.ng user" },
      callback: (r: any) => finish(r?.status === 'successful' || r?.status === 'completed'),
      onclose: () => finish(false),
      customizations: { title: "IFA.ng", description, logo: "/favicon.ico" },
    });
  });
};

/** Server-side verification + settlement. Polls briefly because bank transfers/USSD can confirm a moment later. */
export const verifyPayment = async (reference: string, attempts = 6, delayMs = 2000): Promise<SettleResult> => {
  let last: SettleResult = { status: 'pending' };
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase.functions.invoke('payment-verify', { body: { reference } });
    if (!error && data) {
      last = data as SettleResult;
      if (last.status !== 'pending') return last;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return last;
};
