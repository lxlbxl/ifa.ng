import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** The public platform rules (refund window, accept time, hold time...), with safe defaults. */
export function usePlatformRules() {
  const { data } = useQuery({
    queryKey: ['platform-rules'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any).from('admin_settings').select('setting_key, setting_value');
      return Object.fromEntries(((data ?? []) as { setting_key: string; setting_value: string }[]).map((r) => [r.setting_key, r.setting_value]));
    },
  });
  const n = (k: string, d: number) => { const v = Number(data?.[k]); return Number.isFinite(v) && data?.[k] !== undefined ? v : d; };
  return {
    freeCancelHours: n('cancellation_full_refund_hours', 24),
    acceptMinutes: n('instant_accept_minutes', 3),
    holdHours: n('earnings_hold_hours', 48),
    noShowRefund: (data?.babalawo_no_show_refund ?? 'true') !== 'false',
    commissionPercent: n('platform_commission_percent', 20),
    recordingDays: n('recording_retention_days', 90),
  };
}

export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || 'support@ifa.ng';
/** International format without "+", e.g. 2348012345678. Shown only when set. */
export const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) || '';
