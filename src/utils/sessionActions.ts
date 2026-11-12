import { supabase } from "@/integrations/supabase/client";

/**
 * Cancel a session. Refunds and earnings reversal are decided by the database:
 * - babalawo or admin cancels: full refund to the client's wallet
 * - client cancels at least `cancellation_full_refund_hours` before the start: full refund
 * - client cancels later: no refund
 */
export const cancelSession = async (sessionId: number | string, reason?: string) => {
  const { data, error } = await supabase.rpc('cancel_session' as any, {
    p_session_id: Number(sessionId),
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { cancelled: boolean; refunded: number; reason?: string };
};

/** Babalawo accepts a Consult Now request (within the accept window). */
export const acceptInstantSession = async (sessionId: number | string) => {
  const { error } = await supabase.rpc('accept_instant_session' as any, { p_session_id: Number(sessionId) });
  if (error) throw new Error(error.message);
};

/** Records that this person opened the call; a Babalawo who never joins is treated as a no-show. */
export const recordSessionJoin = async (sessionId: number | string) => {
  const { error } = await supabase.rpc('record_session_join' as any, { p_session_id: Number(sessionId) });
  if (error) console.warn('record_session_join', error.message);
};
