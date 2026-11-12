import { supabase } from "@/integrations/supabase/client";
import { createPaymentIntent, openCheckout, verifyPayment, PaymentGateway } from "./paymentGatewayUtils";

export type PaymentMethod = 'wallet' | 'flutterwave' | 'paystack';

interface PaymentData {
  user: any;
  userProfile: any;
  babalawo: any;          // babalawo.id is the babalawo's auth user id
  date: string;           // "yyyy-MM-dd" on the Babalawo's calendar
  selectedTime: string;   // "HH:mm" on the Babalawo's clock
  amount: number;         // display only: the server recomputes the price and ignores this
  paymentMethod: PaymentMethod;
  walletBalance?: number;
  isInstant?: boolean;
}

const friendly = (msg: string) => {
  if (/Insufficient wallet balance/i.test(msg)) return "Insufficient wallet balance. Please add money or use another payment method.";
  if (/already booked|duplicate key|unique/i.test(msg)) return "That time slot was just taken. Please choose another time.";
  return msg;
};

/**
 * Pays for and books a session. All money rules live on the server:
 *  - wallet: one database transaction (debit + session + escrow), price computed there
 *  - gateway: server creates the intent, provider is asked (server-side) whether it was really paid,
 *    and only then is the session created and paid
 */
export const handlePaymentAndBooking = async (
  paymentData: PaymentData,
  onSuccess: (sessionId: string) => void,
  onError: (message: string) => void
) => {
  const { user, babalawo, date, selectedTime, paymentMethod, isInstant } = paymentData;
  const sessionDate = date;

  try {
    if (!user?.id) { onError("Please sign in to continue."); return; }

    if (paymentMethod === 'wallet') {
      const { data, error } = await supabase.rpc('book_session_with_wallet' as any, {
        p_babalawo_user_id: String(babalawo.id),
        p_session_date: sessionDate,
        p_start_time: selectedTime,
        p_is_instant: !!isInstant,
        p_idempotency_key: generateSessionIdempotencyKey(user.id, babalawo.id, sessionDate, selectedTime),
      });
      if (error) { onError(friendly(error.message)); return; }
      onSuccess(String(data));
      return;
    }

    const gateway = paymentMethod as PaymentGateway;
    const intent = await createPaymentIntent({
      kind: 'session', gateway,
      babalawo_user_id: String(babalawo.id),
      session_date: sessionDate, start_time: selectedTime, is_instant: !!isInstant,
    });
    const popupSaidPaid = await openCheckout(intent, `Consultation with ${babalawo.full_name || babalawo.name || "Babalawo"}`);
    if (!popupSaidPaid) {
      // The user may still have paid (e.g. closed the popup after a bank transfer): ask the server once.
      const probe = await verifyPayment(intent.reference, 1, 0);
      if (probe.status === 'settled' || probe.status === 'already_settled') {
        if ('session_id' in probe && probe.session_id) { onSuccess(String(probe.session_id)); return; }
      }
      onError("Payment was not completed.");
      return;
    }

    const result = await verifyPayment(intent.reference);
    if ((result.status === 'settled' || result.status === 'already_settled') && 'session_id' in result && result.session_id) {
      onSuccess(String(result.session_id));
    } else if (result.status === 'slot_taken_credited_to_wallet') {
      onError("That time was taken while you were paying. Your money is safe in your wallet, so please pick another time.");
    } else if (result.status === 'pending') {
      onError(`We have not received confirmation yet. If you were charged, your booking will appear shortly. Reference: ${intent.reference}`);
    } else if (result.status === 'amount_mismatch') {
      onError(`Your payment needs a manual check. Please contact support with reference ${intent.reference}.`);
    } else {
      onError("Payment could not be verified. You have not been charged for a booking.");
    }
  } catch (err: any) {
    console.error("Payment error:", err);
    onError(friendly(err?.message || "An unexpected error occurred"));
  }
};

/** Same booking, same key: a double tap cannot create two bookings. */
export const generateSessionIdempotencyKey = (userId: string, babalawoId: string | number, date: string, time: string): string =>
  `${userId}-${babalawoId}-${date}-${time}`;
