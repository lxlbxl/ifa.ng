import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

/**
 * Payout accounts whose bank name doesn't match the Babalawo's IFA.ng name. Withdrawals to them
 * are blocked until an admin approves (after checking with the Babalawo) or rejects with a reason.
 */
type Row = { babalawo_id: string; full_name: string | null; bank_name: string; account_last4: string; account_name: string;
  name_match: number | null; updated_at: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useBankAccountsToReview() {
  return useQuery({
    queryKey: ['bank-accounts-to-review'],
    queryFn: async () => {
      const { data, error } = await db.rpc('admin_bank_accounts_to_review');
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
  });
}

export function useReviewBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { babalawoId: string; approve: boolean; note?: string }) => {
      const { error } = await db.rpc('admin_review_bank_account', { p_babalawo: v.babalawoId, p_approve: v.approve, p_note: v.note ?? null });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => {
      toast({ title: v.approve ? 'Account approved' : 'Account rejected', description: 'The Babalawo has been told.' });
      qc.invalidateQueries({ queryKey: ['bank-accounts-to-review'] });
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (e: Error) => toast({ title: 'Not saved', description: e.message, variant: 'destructive' }),
  });
}

const BankAccountReviews = () => {
  const { data = [] } = useBankAccountsToReview();
  const review = useReviewBankAccount();
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [note, setNote] = useState('');
  if (data.length === 0) return null;
  return (
    <Card className="border-sun">
      <CardHeader>
        <CardTitle>Payout accounts to check ({data.length})</CardTitle>
        <p className="m-0 text-sm text-muted-foreground">
          The name the bank gave doesn't match the Babalawo's name. Call them before approving: a different name can mean someone else changed the account.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((r) => (
          <div key={r.babalawo_id} className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-line p-3 text-sm">
            <div>
              <p className="m-0 font-semibold">{r.full_name || 'Babalawo'}</p>
              <p className="m-0 text-muted-foreground">
                {r.bank_name} ••{r.account_last4} · bank name <strong className="text-ink">{r.account_name}</strong>
                {r.name_match != null && ` · ${Math.round(Number(r.name_match) * 100)}% of their name matches`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="sun" disabled={review.isPending} onClick={() => review.mutate({ babalawoId: r.babalawo_id, approve: true })}>
                <Check className="mr-1 h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setNote(''); setRejecting(r); }}><X className="mr-1 h-4 w-4" /> Reject</Button>
            </div>
          </div>
        ))}
      </CardContent>
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this account?</DialogTitle>
            <DialogDescription>The Babalawo sees your reason and is asked to add an account in their own name.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason" value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!note.trim() || review.isPending}
              onClick={() => rejecting && review.mutate({ babalawoId: rejecting.babalawo_id, approve: false, note: note.trim() },
                { onSuccess: () => setRejecting(null) })}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default BankAccountReviews;

const STATUS_WORDS: Record<string, string> = {
  verified: 'Verified', pending_review: 'Waiting for an admin', rejected: 'Rejected', unverified: 'Not checked by the bank',
};

/** The Babalawo's payout account on their admin record, with approve/reject when it waits for review. */
export function PayoutAccountRow({ babalawoId }: { babalawoId: string }) {
  const review = useReviewBankAccount();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['adminUsers', 'payout-account', babalawoId],
    queryFn: async () => {
      const { data, error } = await db.from('babalawo_bank_details')
        .select('bank_name, account_number, account_name, status, usable_from').eq('babalawo_id', babalawoId).maybeSingle();
      if (error) throw new Error(error.message);
      return data as { bank_name: string; account_number: string; account_name: string; status: string; usable_from: string | null } | null;
    },
  });
  const waiting = data?.usable_from && new Date(data.usable_from).getTime() > Date.now();
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/70 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">Payout account</span>
      <span className="text-right font-medium">
        {!data ? 'None yet' : <>
          {data.bank_name} ••{data.account_number.slice(-4)} · {data.account_name}
          <span className="block text-xs font-normal text-muted-foreground">
            {STATUS_WORDS[data.status] ?? data.status}{waiting ? ` · usable from ${new Date(data.usable_from!).toLocaleString()}` : ''}
          </span>
          {data.status === 'pending_review' && (
            <span className="mt-1 flex justify-end gap-1">
              <Button size="sm" variant="outline" disabled={review.isPending}
                onClick={() => review.mutate({ babalawoId, approve: true }, { onSuccess: () => qc.invalidateQueries({ queryKey: ['adminUsers'] }) })}>
                <Check className="mr-1 h-3.5 w-3.5" /> Approve
              </Button>
            </span>
          )}
        </>}
      </span>
    </div>
  );
}
