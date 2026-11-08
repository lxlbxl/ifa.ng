import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/integrations/api/config';
import { supabase } from '@/integrations/supabase/client';

export interface Presence { availableNow: boolean; status: string; checked: boolean }

/** "Available now" from what the directory already says (used until the live check answers). */
export const isAvailableNow = (b: { current_status?: string | null; is_active?: boolean | null } | null | undefined) =>
  !!b && b.is_active !== false && (b.current_status === 'online' || b.current_status === 'available');

/**
 * Whether a Babalawo can take a Consult Now session right now. Asks the API's
 * presence endpoint (live status, no session in progress) and re-checks every
 * 30 seconds while `enabled`. Falls back to the directory's current_status
 * when that endpoint isn't deployed.
 */
export function useBabalawoAvailableNow(
  babalawoUserId: string | undefined,
  initial: { current_status?: string | null; is_active?: boolean | null } | null,
  enabled = true,
): Presence {
  const [p, setP] = useState<Presence>({
    availableNow: isAvailableNow(initial), status: initial?.current_status ?? 'offline', checked: false,
  });

  useEffect(() => {
    if (!babalawoUserId || !enabled) return;
    let live = true;
    const check = async () => {
      try {
        const r = await apiFetch<{ status: string; available_now: boolean }>(`/v1/babalawos/${babalawoUserId}/presence`);
        if (live) setP({ availableNow: !!r.available_now, status: r.status, checked: true });
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 404) { if (live) setP((x) => ({ ...x, checked: true })); return; }
        const { data } = await supabase.from('babalawos').select('current_status, is_active').eq('user_id', babalawoUserId).maybeSingle();
        if (live && data) setP({ availableNow: isAvailableNow(data), status: data.current_status ?? 'offline', checked: true });
      }
    };
    check();
    const t = setInterval(check, 30_000);
    return () => { live = false; clearInterval(t); };
  }, [babalawoUserId, enabled]);

  return p;
}
