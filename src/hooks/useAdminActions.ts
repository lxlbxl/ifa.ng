import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['user_role'];
type SessionStatus = Database['public']['Enums']['session_status_enum'];

/** Thin wrappers over the audited SECURITY DEFINER admin_* RPCs. */
function useAdminRpc<TVars>(
  run: (v: TVars) => PromiseLike<{ error: { message: string } | null }>,
  invalidate: string[],
  successMessage: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const { error } = await run(vars);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast({ title: successMessage });
    },
    onError: (e: Error) =>
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' }),
  });
}

export const useSetUserRole = () =>
  useAdminRpc(
    (v: { userId: string; role: AppRole; grant: boolean }) =>
      supabase.rpc('admin_set_user_role', { _user_id: v.userId, _role: v.role, _grant: v.grant }),
    ['adminUsers', 'adminBabalawos', 'adminAuditLog'],
    'Role updated',
  );

export const useSetUserSuspended = () =>
  useAdminRpc(
    (v: { userId: string; suspended: boolean; reason?: string }) =>
      supabase.rpc('admin_set_user_suspended', {
        _user_id: v.userId, _suspended: v.suspended, _reason: v.reason,
      }),
    ['adminUsers', 'adminBabalawos', 'adminAuditLog'],
    'User updated',
  );

export const useReviewBabalawo = () =>
  useAdminRpc(
    (v: { userId: string; status: 'approved' | 'rejected' | 'pending' | 'suspended'; notes?: string }) =>
      supabase.rpc('admin_review_babalawo', { _user_id: v.userId, _status: v.status, _notes: v.notes }),
    ['adminBabalawos', 'adminUsers', 'adminAuditLog'],
    'Babalawo review saved',
  );

export const useUpdateSessionStatus = () =>
  useAdminRpc(
    (v: { sessionId: string | number; status: SessionStatus; reason?: string }) =>
      supabase.rpc('admin_update_session_status', {
        _session_id: Number(v.sessionId), _status: v.status, _reason: v.reason,
      }),
    ['adminSessions', 'adminAuditLog'],
    'Booking updated',
  );

export const useResolveDispute = () =>
  useAdminRpc(
    (v: { disputeId: string; status: 'investigating' | 'resolved_refund' | 'resolved_dismissed'; note: string; refund?: boolean }) =>
      supabase.rpc('admin_resolve_dispute', {
        _dispute_id: v.disputeId, _status: v.status, _note: v.note, _refund: v.refund ?? false,
      }),
    ['adminDisputes', 'adminAuditLog'],
    'Dispute updated',
  );

/** Cancel a session and refund it via the payments flow (admin_refund_session). */
export const useAdminRefundSession = () =>
  useAdminRpc(
    (v: { sessionId: string | number; reason: string }) =>
      supabase.rpc('admin_refund_session', { p_session_id: Number(v.sessionId), p_reason: v.reason }),
    ['adminSessions', 'adminDisputes', 'adminAuditLog'],
    'Session cancelled and refunded',
  );
