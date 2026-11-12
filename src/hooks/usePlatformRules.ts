import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function usePublicSettings() {
  return useQuery({
    queryKey: ['platform-rules'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any).from('admin_settings').select('setting_key, setting_value');
      return Object.fromEntries(((data ?? []) as { setting_key: string; setting_value: string }[]).map((r) => [r.setting_key, r.setting_value])) as Record<string, string>;
    },
  });
}

/** The public platform rules (refund window, accept time, hold time...), with safe defaults. */
export function usePlatformRules() {
  const { data } = usePublicSettings();
  const n = (k: string, d: number) => { const v = Number(data?.[k]); return Number.isFinite(v) && data?.[k] !== undefined ? v : d; };
  return {
    freeCancelHours: n('cancellation_full_refund_hours', 24),
    acceptMinutes: n('instant_accept_minutes', 3),
    holdHours: n('earnings_hold_hours', 48),
    noShowRefund: (data?.babalawo_no_show_refund ?? 'true') !== 'false',
    commissionPercent: n('platform_commission_percent', 20),
    recordingDays: n('recording_retention_days', 90),
    minCardPayment: n('min_card_payment', 100),
    retention: {
      notificationsDays: n('retention_notifications_days', 365),
      messageLogDays: n('retention_message_log_days', 90),
      securityLogDays: n('retention_security_log_days', 90),
      sessionLogDays: n('retention_session_log_days', 730),
      eboProofDays: n('retention_ebo_proof_days', 365),
      applicationsDays: n('retention_applications_days', 365),
      financialYears: n('retention_financial_years', 6),
      auditYears: n('retention_audit_years', 6),
      requestsYears: n('retention_privacy_requests_years', 3),
    },
    dsarDays: n('dsar_response_days', 30),
  };
}

/** Who runs IFA.ng and how to reach the Data Protection Officer (Admin -> Settings -> Privacy). */
export function usePrivacyContacts() {
  const { data } = usePublicSettings();
  const v = (k: string) => (data?.[k] ?? '').trim();
  return {
    controllerName: v('privacy_controller_name') || 'IFA.ng',
    controllerAddress: v('privacy_controller_address'),
    rcNumber: v('privacy_controller_rc_number'),
    dpoName: v('privacy_dpo_name'),
    dpoEmail: v('privacy_dpo_email') || 'privacy@ifa.ng',
    euRepresentative: v('privacy_eu_representative'),
    ukRepresentative: v('privacy_uk_representative'),
    ndpcRegistration: v('privacy_ndpc_registration'),
    noticeVersion: v('privacy_notice_version'),
    minAge: Number(v('privacy_min_age')) || 18,
  };
}

export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || 'support@ifa.ng';
/** International format without "+", e.g. 2348012345678. Shown only when set. */
export const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) || '';
