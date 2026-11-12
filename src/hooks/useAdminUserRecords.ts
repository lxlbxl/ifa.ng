import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Admin → Users: the list, insights and one person's record. All reads and writes go through
 * admin-only SECURITY DEFINER functions (db/migrations/20261120000000_admin_user_insights.sql).
 * Opening a record is logged in admin_audit_log as personal-data access.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type UserTag = 'high_value' | 'frequent' | 'lapsed' | 'one_time' | 'never_booked' | 'new' | 'disputes';
export const TAG_LABEL: Record<UserTag, string> = {
  high_value: 'High value', frequent: 'Frequent', lapsed: 'Lapsed', one_time: 'Booked once',
  never_booked: 'Never booked', new: 'New', disputes: 'Open dispute',
};
export const TAG_STYLE: Record<UserTag, string> = {
  high_value: 'bg-sun text-ink', frequent: 'bg-leaf text-ink', lapsed: 'bg-[#f3b9a6] text-ink', one_time: 'bg-cloth text-ink border border-line',
  never_booked: 'bg-cloth text-muted-foreground border border-line', new: 'bg-[#b9c4f2] text-ink', disputes: 'bg-camwood text-white',
};

export interface DirectoryRow {
  id: string; full_name: string | null; email: string | null; phone: string | null; avatar_url: string | null; created_at: string | null;
  roles: string[]; is_suspended: boolean; suspended_reason: string | null; is_deleted: boolean; last_active_at: string | null;
  bookings_total: number; bookings_90d: number; last_booking_at: string | null; avg_days_between: number | null;
  lifetime_spend: number; spend_90d: number; wallet_balance: number; open_disputes: number;
  babalawo_sessions: number; babalawo_lifetime_earned: number; tags: UserTag[]; total_count: number;
}
export type SortKey = 'joined' | 'name' | 'spend' | 'spend_90d' | 'bookings' | 'bookings_90d' | 'last_active' | 'last_booking' | 'frequency' | 'wallet';
export interface DirectoryQuery { search: string; filter: string; sort: SortKey; desc: boolean; page: number; pageSize: number }

export const useUserDirectory = (q: DirectoryQuery) =>
  useQuery({
    queryKey: ['adminUsers', 'directory', q],
    queryFn: () => rpc<DirectoryRow[]>('admin_user_directory', {
      p_search: q.search.trim() || null, p_filter: q.filter === 'all' ? null : q.filter, p_sort: q.sort, p_desc: q.desc,
      p_limit: q.pageSize, p_offset: q.page * q.pageSize,
    }),
    placeholderData: keepPreviousData,
  });

export interface Insights {
  total: number; clients: number; babalawos: number; admins: number; suspended: number; new_30d: number; active_30d: number;
  payers: number; lifetime_spend: number; spend_90d: number; avg_spend_per_payer: number; repeat_rate: number;
  median_days_between: number | null; top_spend_share: number; tags: Partial<Record<UserTag, number>>;
  frequency: { none: number; once: number; two_to_three: number; four_to_nine: number; ten_plus: number };
  top_spenders: { id: string; full_name: string | null; avatar_url: string | null; lifetime_spend: number; bookings_total: number; last_booking_at: string | null }[];
  most_frequent: { id: string; full_name: string | null; avatar_url: string | null; bookings_90d: number; bookings_total: number; avg_days_between: number | null }[];
  signups_by_month: { month: string; n: number }[];
  thresholds: { high_value_naira: number; frequent_bookings_90d: number; lapsed_days: number; new_days: number };
}
export const useUserInsights = () =>
  useQuery({ queryKey: ['adminUsers', 'insights'], queryFn: () => rpc<Insights>('admin_user_insights') });

type Stats = Omit<DirectoryRow, 'total_count'> & {
  suspended_at: string | null; last_sign_in_at: string | null; bookings_completed: number; bookings_cancelled: number;
  first_booking_at: string | null; session_spend: number; ebo_spend: number; refunded: number; babalawo_review_status: string | null;
  spend_rank: number;
};
export interface UserDetail {
  stats: Stats;
  account: { created_at: string; last_sign_in_at: string | null; phone_confirmed_at: string | null; deleted_at: string | null;
    signup_role: string | null; timezone: string | null; whatsapp_opt_in: boolean | null; sms_opt_in: boolean | null } | null;
  roles: { role: string; granted_at: string | null; granted_by: string | null }[];
  babalawo: null | {
    review_status: string | null; review_notes: string | null; reviewed_at: string | null; is_active: boolean; is_verified: boolean;
    current_status: string | null; last_seen_at: string | null; rating: number | null; city: string | null; country: string | null;
    session_price: number | null; instant_price: number | null; commission_babalawo_percent: number | null;
    wallet: { available: number; pending: number; held: number; lifetime_earned: number; lifetime_paid_out: number } | null;
    withdrawals: { id: string; amount: number; status: string; created_at: string }[];
  };
  practice: {
    sessions_total: number; completed: number; cancelled: number; upcoming: number; no_shows: number; sessions_90d: number;
    instant_offered: number; instant_accepted: number; unique_clients: number; repeat_clients: number; gross_90d: number;
    reviews_count: number; rating_avg: number | null; online_hours_30d: number; online_days_30d: number;
    presence: { status: string; started_at: string; ended_at: string | null }[];
    profile: { bio: string | null; specialties: string[] | null; languages: string[] | null; experience_years: number | null;
      is_featured: boolean | null; reviewed_by: string | null; google_email: string | null } | null;
    application: null | { id: number; status: string; created_at: string; reviewed_at: string | null; reviewed_by_name: string | null;
      review_notes: string | null; ile_name: string | null; years_practising: number | null; city: string | null; country: string | null;
      referral: string | null; consults_online: string | null; specialties: string[] | null; languages: string[] | null; bio: string | null };
  };
  sessions: { id: number; created_at: string; starts_at: string | null; session_date: string | null; start_time: string | null; status: string;
    payment_status: string | null; amount: number | null; is_instant: boolean | null; session_type: string | null; video_provider: string | null;
    no_show: string | null; as_role: 'client' | 'babalawo'; other_id: string; other_name: string | null }[];
  payments: { id: string; created_at: string; amount: number; refunded_amount: number | null; status: string; payment_gateway: string | null;
    payment_reference: string | null; session_id: number | null; ebo_id: string | null; commission_amount: number | null }[];
  wallet: { balance: number; transactions: { id: string; created_at: string; amount: number; transaction_type: 'credit' | 'debit';
    transaction_source: string; description: string | null; status: string | null; balance_after: number | null; payment_reference: string | null }[] };
  ebo: { id: string; created_at: string; kind: string; title: string | null; status: string; amount_due: number | null; total: number | null;
    paid_at: string | null; session_id: number | null; as_role: 'client' | 'babalawo'; other_name: string | null }[];
  disputes: { id: string; created_at: string; session_id: number | null; ebo_id: string | null; status: string; reason: string;
    resolution_note: string | null; resolved_at: string | null; raised_by_them: boolean }[];
  reviews: { id: number; created_at: string; rating: number; comment: string | null; flagged: boolean | null; is_approved: boolean | null;
    session_id: number | null; direction: 'wrote' | 'received'; other_name: string | null }[];
  consents: { purpose: string; granted: boolean; notice_version: string | null; source: string | null; created_at: string }[];
  privacy_requests: { id: number; request_type: string; status: string; source: string; received_at: string; due_at: string; completed_at: string | null }[];
  sign_ins: { created_at: string; updated_at: string | null; expires_at: string; ip_address: string | null; user_agent: string | null }[];
  notes: { id: number; body: string; pinned: boolean; created_at: string; author_id: string | null; author_name: string | null }[];
  audit: { id: string; created_at: string; action: string; target_type: string; details: Record<string, unknown>; admin_name: string | null }[];
}
export const useUserDetail = (userId: string | null) =>
  useQuery({
    queryKey: ['adminUsers', 'detail', userId],
    queryFn: () => rpc<UserDetail>('admin_user_detail', { p_user_id: userId }),
    enabled: !!userId,
  });

function useAdminUserAction<V>(run: (v: V) => Promise<unknown>, success: string | ((v: V) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
      qc.invalidateQueries({ queryKey: ['adminAuditLog'] });
      toast({ title: typeof success === 'function' ? success(v) : success });
    },
    onError: (e: Error) => toast({ title: 'That didn’t work', description: e.message, variant: 'destructive' }),
  });
}

export const useAddUserNote = () =>
  useAdminUserAction((v: { userId: string; body: string; pinned?: boolean }) =>
    rpc('admin_add_user_note', { p_user_id: v.userId, p_body: v.body, p_pinned: v.pinned ?? false }), 'Note saved');
export const useUpdateUserNote = () =>
  useAdminUserAction((v: { noteId: number; pinned?: boolean; remove?: boolean }) =>
    rpc('admin_update_user_note', { p_note_id: v.noteId, p_pinned: v.pinned ?? null, p_delete: v.remove ?? false }),
    (v) => (v.remove ? 'Note deleted' : v.pinned ? 'Note pinned' : 'Note unpinned'));
export const useMessageUser = () =>
  useAdminUserAction((v: { userId: string; title: string; message: string }) =>
    rpc('admin_message_user', { p_user_id: v.userId, p_title: v.title, p_message: v.message }), 'Message sent');
export const useSignOutUser = () =>
  useAdminUserAction((v: { userId: string }) => rpc<number>('admin_sign_out_user', { p_user_id: v.userId }), 'Signed out of every device');
/** Which provider's balance holds the money. Credits must say, so the Babalawo payout rules hold. */
export type Provider = 'paystack' | 'flutterwave';
export const useAdjustUserWallet = () =>
  useAdminUserAction((v: { userId: string; amount: number; type: 'credit' | 'debit'; reason: string; provider?: Provider }) =>
    rpc('admin_adjust_wallet', { p_user_id: v.userId, p_amount: v.amount, p_type: v.type, p_description: v.reason,
      p_provider: v.type === 'credit' ? v.provider ?? null : null }),
    (v) => (v.type === 'credit' ? 'Wallet credited' : 'Wallet debited'));
export const exportUserData = (userId: string) => rpc<unknown>('admin_export_user_data', { p_user_id: userId, p_request_id: null });
export const useSetBabalawoListing = () =>
  useAdminUserAction((v: { userId: string; featured?: boolean; takeOffline?: boolean }) =>
    rpc('admin_set_babalawo_listing', { p_user_id: v.userId, p_featured: v.featured ?? null, p_take_offline: v.takeOffline ?? false }),
    (v) => (v.takeOffline ? 'Set to offline' : v.featured ? 'Featured on the homepage' : 'No longer featured'));
