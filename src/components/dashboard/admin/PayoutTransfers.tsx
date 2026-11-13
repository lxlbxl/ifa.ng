import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Automated payout transfers for a withdrawal (one per provider that holds the money).
 * Sending and checking happen on the server; an admin only steps in when one fails or waits:
 * send a failed one again, or record that it was paid by hand.
 */
export type PayoutTransfer = {
  id: string; withdrawal_id: string; provider: 'paystack' | 'flutterwave'; amount: number; reference: string;
  status: 'queued' | 'sending' | 'pending' | 'success' | 'failed' | 'reversed' | 'cancelled' | 'paid_manually';
  hold_reason: string | null; failure_reason: string | null; manual_reference: string | null; fee: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Transfers that are on their way or paid: the withdrawal can't be rejected or paid by hand as a whole. */
export const IN_FLIGHT: PayoutTransfer['status'][] = ['sending', 'pending', 'success', 'paid_manually'];

export function usePayoutTransfers(withdrawalIds: string[]) {
  return useQuery({
    queryKey: ['withdrawalRequests', 'transfers', withdrawalIds],
    enabled: withdrawalIds.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db.from('payout_transfers')
        .select('id, withdrawal_id, provider, amount, reference, status, hold_reason, failure_reason, manual_reference, fee')
        .in('withdrawal_id', withdrawalIds).order('created_at');
      if (error) throw new Error(error.message);
      const byWithdrawal = new Map<string, PayoutTransfer[]>();
      for (const t of (data ?? []) as PayoutTransfer[]) {
        byWithdrawal.set(t.withdrawal_id, [...(byWithdrawal.get(t.withdrawal_id) ?? []), { ...t, amount: Number(t.amount) }]);
      }
      return byWithdrawal;
    },
  });
}

const WORDS: Record<PayoutTransfer['status'], string> = {
  queued: 'Waiting to send', sending: 'Sending', pending: 'On its way', success: 'Paid', failed: 'Failed',
  reversed: 'Reversed by the bank', cancelled: 'Cancelled', paid_manually: 'Paid by hand',
};
const TONE: Record<PayoutTransfer['status'], 'success' | 'destructive' | 'secondary' | 'default' | 'outline'> = {
  queued: 'secondary', sending: 'default', pending: 'default', success: 'success', failed: 'destructive',
  reversed: 'destructive', cancelled: 'outline', paid_manually: 'success',
};
const PROVIDER = { paystack: 'Paystack', flutterwave: 'Flutterwave' } as const;

export function PayoutTransferList({ transfers }: { transfers: PayoutTransfer[] }) {
  const qc = useQueryClient();
  const [byHand, setByHand] = useState<PayoutTransfer | null>(null);
  const [reference, setReference] = useState('');
  const act = useMutation({
    mutationFn: async (v: { id: string; action: 'retry' | 'paid_manually'; reference?: string }) => {
      const { error } = await db.rpc('admin_payout_transfer_action', { p_id: v.id, p_action: v.action, p_reference: v.reference ?? null });
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_d, v) => {
      toast({ title: v.action === 'retry' ? 'Sending again within a minute' : 'Recorded as paid by hand' });
      setByHand(null);
      await qc.invalidateQueries({ queryKey: ['withdrawalRequests'] });
    },
    onError: (e: Error) => toast({ title: 'Not saved', description: e.message, variant: 'destructive' }),
  });

  const shown = transfers.filter((t) => t.status !== 'cancelled' || transfers.length === 1);
  if (shown.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5" data-testid="payout-transfers">
      {shown.map((t) => (
        <div key={t.id} className="rounded-field border border-line px-2 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{PROVIDER[t.provider]}</span>
            <span>₦{t.amount.toLocaleString()}</span>
            <Badge variant={TONE[t.status]}>{WORDS[t.status]}</Badge>
          </div>
          {(t.hold_reason || t.failure_reason) && (
            <p className="m-0 mt-1 text-muted-foreground">{t.status === 'failed' || t.status === 'reversed' ? t.failure_reason : t.hold_reason}</p>
          )}
          {t.manual_reference && <p className="m-0 mt-1 text-muted-foreground">Bank reference {t.manual_reference}</p>}
          {(t.status === 'failed' || t.status === 'queued') && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {t.status === 'failed' && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={act.isPending}
                  onClick={() => act.mutate({ id: t.id, action: 'retry' })}>Send again</Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={act.isPending}
                onClick={() => { setReference(''); setByHand(t); }}>Paid by hand</Button>
            </div>
          )}
        </div>
      ))}
      <Dialog open={!!byHand} onOpenChange={(o) => !o && !act.isPending && setByHand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment made by hand</DialogTitle>
            <DialogDescription>
              Only after you have sent ₦{byHand?.amount.toLocaleString()} yourself. This part will not be sent automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="manual-reference">Bank transfer reference</Label>
            <Input id="manual-reference" autoFocus maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={act.isPending} onClick={() => setByHand(null)}>Cancel</Button>
            <Button disabled={!reference.trim() || act.isPending}
              onClick={() => byHand && act.mutate({ id: byHand.id, action: 'paid_manually', reference: reference.trim() })}>Record payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
