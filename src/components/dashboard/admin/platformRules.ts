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
  { key: "min_withdrawal_amount", label: "Smallest Babalawo withdrawal", unit: "₦", group: "Money", type: "number", min: 0,
    fallback: "5000", isPublic: true, help: "" },
  { key: "cancellation_full_refund_hours", label: "Free cancellation until", unit: "hours before start", group: "Bookings", type: "number", min: 0,
    fallback: "24", isPublic: true, help: "A client who cancels later than this gets no refund. Babalawo cancellations are always refunded." },
  { key: "whatsapp_notifications_enabled", label: "WhatsApp messages", group: "Messages", type: "choice", fallback: "true", isPublic: false,
    options: [{ value: "true", label: "On (SMS when WhatsApp fails)" }, { value: "false", label: "Off (SMS only)" }],
    help: "Booking confirmations and reminders." },
  { key: "recording_retention_days", label: "Keep recordings for", unit: "days", group: "Sessions", type: "number", min: 1,
    fallback: "90", isPublic: true, help: "Recordings and uploaded audio are deleted after this." },
];
