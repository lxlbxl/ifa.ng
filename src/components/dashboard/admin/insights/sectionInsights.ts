import type { InsightTone } from '@/components/brand';
import type { AdminSection } from '../adminSections';

/** How a number from admin_insights is shown. */
export type InsightFormat = 'naira' | 'count' | 'percent' | 'rating' | 'hours' | 'days' | 'minutes' | 'text';

export interface InsightSpec {
  /** Key in admin_insights(...).metrics */
  key: string;
  label: string;
  format: InsightFormat;
  tone?: InsightTone;
  /** A fall is good news. */
  invert?: boolean;
  /** Fixed hint, e.g. "Right now". Period metrics get "vs previous N days" instead. */
  hint?: string;
  /** Hint shown when the value is empty or zero. */
  emptyHint?: string;
}

/** Sections that have insight cards here. Users has its own (Admin → Users thread); Settings has none. */
export type InsightSection = Exclude<AdminSection, 'users' | 'settings'>;

const NOW = 'Right now';

/**
 * The cards for each admin page, most useful first. The first card is the headline (sun),
 * cards that need attention use coral, the rest stay paper so the grid keeps one accent.
 */
export const SECTION_INSIGHTS: Record<InsightSection, InsightSpec[]> = {
  overview: [
    { key: 'gmv', label: 'Money in', format: 'naira', tone: 'sun' },
    { key: 'platform_revenue', label: 'Platform revenue', format: 'naira', tone: 'leaf' },
    { key: 'sessions_completed', label: 'Sessions completed', format: 'count' },
    { key: 'new_users', label: 'New sign-ups', format: 'count' },
    { key: 'babalawos_live', label: 'Babalawos live', format: 'count', hint: 'Approved and active' },
    { key: 'online_now', label: 'Online now', format: 'count', hint: NOW },
    { key: 'open_disputes', label: 'Open disputes', format: 'count', tone: 'coral', hint: 'Need a decision', emptyHint: 'All clear' },
    { key: 'pending_withdrawals', label: 'Payouts waiting', format: 'naira', hint: 'Pending or approved' },
  ],
  bookings: [
    { key: 'bookings', label: 'Bookings', format: 'count', tone: 'sun' },
    { key: 'completion_rate', label: 'Completed', format: 'percent', hint: 'Of sessions that were due' },
    { key: 'avg_value', label: 'Average booking', format: 'naira' },
    { key: 'upcoming', label: 'Upcoming', format: 'count', hint: 'Confirmed or awaiting' },
    { key: 'today', label: 'Today', format: 'count', hint: 'Sessions on today' },
    { key: 'instant_share', label: 'Consult Now share', format: 'percent' },
    { key: 'accept_minutes', label: 'Consult Now accept time', format: 'minutes', invert: true, emptyHint: 'No Consult Now yet' },
    { key: 'no_shows', label: 'Babalawo no-shows', format: 'count', tone: 'coral', invert: true },
  ],
  disputes: [
    { key: 'open_now', label: 'Open now', format: 'count', tone: 'coral', hint: 'Open or investigating', emptyHint: 'All clear' },
    { key: 'opened', label: 'Raised', format: 'count', invert: true },
    { key: 'oldest_open_days', label: 'Oldest open', format: 'days', hint: 'Waiting the longest', emptyHint: 'Nothing waiting' },
    { key: 'resolve_hours', label: 'Time to resolve', format: 'hours', invert: true, emptyHint: 'None resolved yet' },
    { key: 'refund_rate', label: 'Ended in refund', format: 'percent', invert: true },
    { key: 'dispute_rate', label: 'Dispute rate', format: 'percent', invert: true, hint: 'Per completed session' },
  ],
  ebo: [
    { key: 'value', label: 'Ebo paid', format: 'naira', tone: 'sun' },
    { key: 'platform_fees', label: 'Platform fees', format: 'naira', tone: 'leaf' },
    { key: 'sent', label: 'Quotes sent', format: 'count' },
    { key: 'paid_rate', label: 'Quotes paid', format: 'percent' },
    { key: 'awaiting', label: 'To perform', format: 'count', hint: 'Paid, not yet performed' },
    { key: 'awaiting_confirm', label: 'Awaiting client', format: 'count', hint: 'Performed, to confirm' },
    { key: 'days_to_perform', label: 'Paid to performed', format: 'days', invert: true, emptyHint: 'None performed yet' },
  ],
  reviews: [
    { key: 'avg_rating', label: 'Average rating', format: 'rating', tone: 'sun' },
    { key: 'reviews', label: 'New reviews', format: 'count' },
    { key: 'five_star', label: 'Five stars', format: 'percent' },
    { key: 'review_rate', label: 'Review rate', format: 'percent', hint: 'Reviews per completed session' },
    { key: 'flagged', label: 'Flagged', format: 'count', tone: 'coral', hint: 'To check', emptyHint: 'Nothing flagged' },
    { key: 'hidden', label: 'Hidden', format: 'count', hint: 'Not shown publicly' },
  ],
  babalawos: [
    { key: 'live', label: 'Live Babalawos', format: 'count', tone: 'sun', hint: 'Approved and active' },
    { key: 'online_now', label: 'Online now', format: 'count', tone: 'leaf', hint: NOW },
    { key: 'utilisation', label: 'Had a session', format: 'percent', hint: 'Live Babalawos with a completed session' },
    { key: 'earnings', label: 'Babalawo earnings', format: 'naira' },
    { key: 'joined', label: 'Joined', format: 'count' },
    { key: 'avg_rating', label: 'Average rating', format: 'rating', hint: 'Across live Babalawos' },
    { key: 'pending_review', label: 'Profiles to review', format: 'count', tone: 'coral', emptyHint: 'All reviewed' },
  ],
  applications: [
    { key: 'waiting', label: 'On the waitlist', format: 'count', tone: 'sun', hint: 'To review' },
    { key: 'received', label: 'Received', format: 'count' },
    { key: 'oldest_days', label: 'Oldest waiting', format: 'days', emptyHint: 'Nothing waiting' },
    { key: 'approval_rate', label: 'Approved', format: 'percent', hint: 'Of those reviewed' },
    { key: 'review_days', label: 'Time to review', format: 'days', invert: true, emptyHint: 'None reviewed yet' },
  ],
  finance: [
    { key: 'gmv', label: 'Money in', format: 'naira', tone: 'sun' },
    { key: 'platform_revenue', label: 'Platform revenue', format: 'naira', tone: 'leaf' },
    { key: 'take_rate', label: 'Take rate', format: 'percent' },
    { key: 'refunds', label: 'Refunds', format: 'naira', invert: true },
    { key: 'paid_out', label: 'Paid to Babalawos', format: 'naira' },
    { key: 'owed_babalawos', label: 'Owed to Babalawos', format: 'naira', hint: 'Available, pending and held' },
    { key: 'wallet_liability', label: 'Client wallets', format: 'naira', hint: 'Balances we hold' },
  ],
  transactions: [
    { key: 'payments', label: 'Payments', format: 'count', tone: 'sun' },
    { key: 'success_rate', label: 'Checkout success', format: 'percent' },
    { key: 'avg_ticket', label: 'Average payment', format: 'naira' },
    { key: 'failed', label: 'Failed or expired', format: 'count', invert: true },
    { key: 'needs_review', label: 'Needs review', format: 'count', tone: 'coral', hint: 'Paid but not matched', emptyHint: 'All matched' },
  ],
  'wallet-management': [
    { key: 'liability', label: 'Held in wallets', format: 'naira', tone: 'sun', hint: NOW },
    { key: 'top_ups', label: 'Top-ups', format: 'naira' },
    { key: 'spent', label: 'Spent from wallets', format: 'naira' },
    { key: 'funded_wallets', label: 'Wallets with money', format: 'count', hint: NOW },
    { key: 'avg_balance', label: 'Average balance', format: 'naira', hint: 'Of funded wallets' },
  ],
  'withdrawal-management': [
    { key: 'pending_amount', label: 'Waiting to pay', format: 'naira', tone: 'sun', hint: 'Pending or approved' },
    { key: 'pending_count', label: 'Requests waiting', format: 'count', tone: 'coral', emptyHint: 'Queue empty' },
    { key: 'oldest_hours', label: 'Oldest request', format: 'hours', emptyHint: 'Queue empty' },
    { key: 'paid_out', label: 'Paid out', format: 'naira' },
    { key: 'payout_hours', label: 'Time to pay', format: 'hours', invert: true, emptyHint: 'None paid yet' },
    { key: 'rejected', label: 'Rejected', format: 'count', invert: true },
    { key: 'available', label: 'Withdrawable', format: 'naira', hint: 'Babalawo balances ready' },
  ],
  privacy: [
    { key: 'open', label: 'Open requests', format: 'count', tone: 'sun' },
    { key: 'overdue', label: 'Overdue', format: 'count', tone: 'coral', hint: 'Past the legal deadline', emptyHint: 'None overdue' },
    { key: 'due_week', label: 'Due this week', format: 'count' },
    { key: 'received', label: 'Received', format: 'count' },
    { key: 'on_time', label: 'Closed on time', format: 'percent' },
    { key: 'days_to_close', label: 'Time to close', format: 'days', invert: true, emptyHint: 'None closed yet' },
    { key: 'open_breaches', label: 'Open breaches', format: 'count', hint: 'In the register', emptyHint: 'None open' },
    { key: 'consent_opt_ins', label: 'Consent given', format: 'percent', hint: 'Of choices recorded' },
  ],
  activity: [
    { key: 'actions', label: 'Admin actions', format: 'count', tone: 'sun' },
    { key: 'active_admins', label: 'Admins active', format: 'count' },
    { key: 'admins', label: 'Admins', format: 'count', hint: 'With admin access' },
    { key: 'top_action', label: 'Most common action', format: 'text', emptyHint: 'No actions yet' },
  ],
};

export const hasInsights = (section: string): section is InsightSection => section in SECTION_INSIGHTS;

const compactNaira = new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 });

/** Formats a metric value for a card. Returns an em dash when there is no value. */
export function formatInsight(value: unknown, format: InsightFormat): string {
  if (value === null || value === undefined || value === '') return '—';
  if (format === 'text') return String(value).replace(/_/g, ' ');
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  switch (format) {
    case 'naira':
      return Math.abs(n) >= 100_000 ? `₦${compactNaira.format(n)}` : `₦${Math.round(n).toLocaleString('en-NG')}`;
    case 'percent':
      return `${n >= 10 || n === 0 ? Math.round(n) : n.toFixed(1)}%`;
    case 'rating':
      return n > 0 ? `${n.toFixed(1)}★` : '—';
    case 'minutes':
      return n < 1 ? `${Math.round(n * 60)}s` : `${n < 10 ? n.toFixed(1) : Math.round(n)} min`;
    case 'hours':
      return n < 1 ? `${Math.round(n * 60)} min` : n >= 48 ? `${(n / 24).toFixed(1)} days` : `${n < 10 ? n.toFixed(1) : Math.round(n)} h`;
    case 'days':
      return n < 1 ? `${Math.max(1, Math.round(n * 24))} h` : `${n < 10 ? n.toFixed(1) : Math.round(n)} days`;
    default:
      return Math.round(n).toLocaleString('en-NG');
  }
}
