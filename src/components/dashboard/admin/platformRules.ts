/** Platform rules an admin can change in Settings. Ebo rules live on the Ebo screen. */
export interface PlatformRule {
  key: string;
  label: string;
  help: string;
  group: string;
  type: "number" | "choice";
  unit?: string;
  min?: number;
  fallback: string;
  options?: { value: string; label: string }[];
  /** Readable before sign-in (prices, refund window). Everything else is admin-only. */
  isPublic: boolean;
}

export const PLATFORM_RULES: PlatformRule[] = [
  { key: "platform_commission_percent", label: "Platform share of a consultation", unit: "%", group: "Money", type: "number", min: 0,
    fallback: "20", isPublic: true, help: "Taken from each paid consultation. The Babalawo gets the rest." },
  { key: "babalawo_commission_percent", label: "Babalawo share of a consultation", unit: "%", group: "Money", type: "number", min: 0,
    fallback: "80", isPublic: true, help: "Should add up to 100 with the platform share." },
  { key: "min_session_price", label: "Lowest consultation price", unit: "₦", group: "Money", type: "number", min: 0,
    fallback: "2000", isPublic: true, help: "Babalawos cannot set a price below this." },
  { key: "max_session_price", label: "Highest consultation price", unit: "₦", group: "Money", type: "number", min: 0,
    fallback: "500000", isPublic: true, help: "Babalawos cannot set a price above this." },
  { key: "min_wallet_topup", label: "Smallest wallet top-up", unit: "₦", group: "Money", type: "number", min: 0,
    fallback: "100", isPublic: true, help: "" },
  { key: "min_card_payment", label: "Smallest card part when the wallet pays the rest", unit: "₦", group: "Money", type: "number", min: 0,
    fallback: "100", isPublic: true, help: "When a client pays partly from their wallet, at least this much is charged by card." },
  { key: "usd_pricing_enabled", label: "Diaspora pays in US dollars", group: "Diaspora prices", type: "choice", fallback: "true", isPublic: true,
    options: [{ value: "true", label: "Yes: clients outside Nigeria pay in dollars" }, { value: "false", label: "No: everyone pays in naira" }],
    help: "Nigeria is decided by the visitor's internet location and phone number. Dollar payments go through Flutterwave only." },
  { key: "usd_ngn_rate", label: "Naira per US dollar", unit: "₦", group: "Diaspora prices", type: "number", min: 1,
    fallback: "1600", isPublic: true, help: "Used to work out dollar prices, and to record dollar payments in naira in the books." },
  { key: "usd_price_multiplier", label: "Diaspora price multiplier", unit: "× the naira price", group: "Diaspora prices", type: "number", min: 0,
    fallback: "1.5", isPublic: true, help: "Dollar price = naira price ÷ rate × this, for Babalawos without their own dollar price. The Babalawo's share is unchanged; the extra stays with IFA.ng." },
  { key: "usd_price_round_to", label: "Round dollar prices up to", unit: "$", group: "Diaspora prices", type: "number", min: 0,
    fallback: "5", isPublic: true, help: "For example 5 turns $37.50 into $40." },
  { key: "ebo_usd_multiplier", label: "Diaspora Ebo multiplier", unit: "× the naira amount", group: "Diaspora prices", type: "number", min: 0,
    fallback: "1", isPublic: true, help: "Ebo dollar price = naira amount due ÷ rate × this." },
  { key: "min_wallet_topup_usd", label: "Smallest dollar wallet top-up", unit: "$", group: "Diaspora prices", type: "number", min: 0,
    fallback: "5", isPublic: true, help: "" },
  { key: "min_card_payment_usd", label: "Smallest dollar card part when the wallet pays the rest", unit: "$", group: "Diaspora prices", type: "number", min: 0,
    fallback: "1", isPublic: true, help: "" },
  { key: "min_withdrawal_amount", label: "Smallest Babalawo withdrawal", unit: "₦", group: "Money", type: "number", min: 0,
    fallback: "5000", isPublic: true, help: "" },
  { key: "payouts_auto_enabled", label: "Pay approved withdrawals automatically", group: "Payouts", type: "choice", fallback: "false", isPublic: false,
    options: [{ value: "false", label: "No: admins pay by hand" }, { value: "true", label: "Yes: send by bank transfer through Paystack or Flutterwave" }],
    help: "Each part is paid through the provider that received that money. Switch on only after the provider setup in the deployment guide is done." },
  { key: "payouts_paystack_enabled", label: "Automated payouts through Paystack", group: "Payouts", type: "choice", fallback: "true", isPublic: false,
    options: [{ value: "true", label: "On" }, { value: "false", label: "Paused: Paystack parts wait" }], help: "" },
  { key: "payouts_flutterwave_enabled", label: "Automated payouts through Flutterwave", group: "Payouts", type: "choice", fallback: "true", isPublic: false,
    options: [{ value: "true", label: "On" }, { value: "false", label: "Paused: Flutterwave parts wait" }], help: "" },
  { key: "payout_single_max", label: "Largest automated transfer", unit: "₦", group: "Payouts", type: "number", min: 0,
    fallback: "500000", isPublic: false, help: "Larger transfers wait for an admin to pay by hand or raise this." },
  { key: "payout_daily_max", label: "Most paid out automatically per day", unit: "₦", group: "Payouts", type: "number", min: 0,
    fallback: "3000000", isPublic: false, help: "Lagos day. Transfers over the limit wait until tomorrow." },
  { key: "payout_account_cooldown_hours", label: "Wait after a payout account change", unit: "hours", group: "Payouts", type: "number", min: 0,
    fallback: "24", isPublic: false, help: "Withdrawals can't go to a changed account until this has passed. Protects against stolen logins." },
  { key: "payout_name_match_min", label: "Name match needed to verify an account", unit: "0 to 1", group: "Payouts", type: "number", min: 0,
    fallback: "0.6", isPublic: false, help: "Share of the Babalawo's name found on the bank account. Below this, an admin checks the account." },
  { key: "cancellation_full_refund_hours", label: "Free cancellation until", unit: "hours before start", group: "Bookings", type: "number", min: 0,
    fallback: "24", isPublic: true, help: "A client who cancels later than this gets no refund. Babalawo cancellations are always refunded." },
  { key: "instant_accept_minutes", label: "Consult Now: time to accept", unit: "minutes", group: "Bookings", type: "number", min: 1,
    fallback: "3", isPublic: true, help: "If the Babalawo doesn't accept in time, the client is refunded in full automatically." },
  { key: "babalawo_no_show_refund", label: "When a Babalawo never joins", group: "Bookings", type: "choice", fallback: "true", isPublic: true,
    options: [{ value: "true", label: "Refund the client automatically" }, { value: "false", label: "Leave it for an admin to decide" }],
    help: "Checked 2 hours after the session's end. A Babalawo who marked the session completed is not treated as a no-show." },
  { key: "earnings_hold_hours", label: "Hold earnings for", unit: "hours after the session", group: "Money", type: "number", min: 0,
    fallback: "48", isPublic: true, help: "Clients can dispute during this time. Earnings with an open dispute stay held." },
  { key: "whatsapp_notifications_enabled", label: "WhatsApp messages", group: "Messages", type: "choice", fallback: "true", isPublic: false,
    options: [{ value: "true", label: "On (SMS when WhatsApp fails)" }, { value: "false", label: "Off (SMS only)" }],
    help: "Booking confirmations and reminders." },
  { key: "meet_access_type", label: "Joining a Google Meet call", group: "Sessions", type: "choice", fallback: "OPEN", isPublic: false,
    options: [{ value: "OPEN", label: "Walk straight in with the link" }, { value: "TRUSTED", label: "Guests ask to join, the Babalawo admits them" }],
    help: "The link is only shown to the two people in the session. Most clients have no Google account, so asking to join means waiting for the Babalawo." },
  { key: "reviews_need_approval", label: "New client reviews", group: "Sessions", type: "choice", fallback: "false", isPublic: false,
    options: [{ value: "false", label: "Publish straight away" }, { value: "true", label: "Hold until an admin approves" }],
    help: "Either way, you can hide any review under Reviews." },
  { key: "recording_retention_days", label: "Keep recordings for", unit: "days", group: "Sessions", type: "number", min: 1,
    fallback: "90", isPublic: true, help: "Recordings and uploaded audio are deleted after this." },
];
