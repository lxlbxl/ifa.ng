import { useState } from 'react';
import { format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { errorService } from '@/services/errorService';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface BankSnapshot {
  bank_name?: string;
  account_name?: string;
  account_number?: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  reason: string | null;
  babalawo_id: string;
  bank_snapshot: BankSnapshot | null;
  babalawo_name: string;
}

type WithdrawalAction = 'approve' | 'reject' | 'mark_paid';
type WithdrawalDialog = { action: 'reject' | 'mark_paid'; request: WithdrawalRequest } | null;

const fetchWithdrawalRequests = async (status: string): Promise<WithdrawalRequest[]> => {
  let query = supabase.from('withdrawal_requests').select(
    'id, amount, status, created_at, reason, babalawo_id, bank_snapshot',
  ).order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw errorService.handleError(error, 'FETCH_WITHDRAWAL_REQUESTS');
  const rows = data ?? [];
  if (!rows.length) return [];

  const ids = [...new Set(rows.map((row) => row.babalawo_id))];
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    bank_snapshot: row.bank_snapshot as unknown as BankSnapshot | null,
    babalawo_name: names.get(row.babalawo_id) || row.babalawo_id,
  }));
};

const updateWithdrawal = async ({
  id,
  action,
  reference,
  note,
}: {
  id: string;
  action: WithdrawalAction;
  reference?: string;
  note?: string;
}) => {
  const { error } = await supabase.rpc('admin_process_withdrawal' as any, {
    p_id: id,
    p_action: action,
    p_reference: reference ?? null,
    p_note: note ?? null,
  });
  if (error) throw errorService.handleError(error, 'UPDATE_WITHDRAWAL_STATUS');
};

const AdminWithdrawalManagement = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('all');
  const [dialog, setDialog] = useState<WithdrawalDialog>(null);
  const [reference, setReference] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: requests = [], isLoading, isError, error } = useQuery<WithdrawalRequest[], Error>({
    queryKey: ['withdrawalRequests', status],
    queryFn: () => fetchWithdrawalRequests(status),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: updateWithdrawal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['withdrawalRequests'] });
      toast.success('Withdrawal updated.');
      setDialog(null);
      setReference('');
      setRejectionReason('');
    },
    onError: (err: unknown) => errorService.showErrorToast(err),
  });

  const closeDialog = () => {
    setDialog(null);
    setReference('');
    setRejectionReason('');
  };

  const approve = (id: string) => mutation.mutate({ id, action: 'approve' });

  const submitDialog = () => {
    if (!dialog) return;
    if (dialog.action === 'mark_paid') {
      const payoutReference = reference.trim();
      if (!payoutReference) {
        toast.error('Enter the bank transfer reference to complete this payout.');
        return;
      }
      mutation.mutate({ id: dialog.request.id, action: 'mark_paid', reference: payoutReference });
      return;
    }

    const note = rejectionReason.trim();
    if (!note) {
      toast.error('Enter a reason for rejecting this withdrawal.');
      return;
    }
    mutation.mutate({ id: dialog.request.id, action: 'reject', note });
  };

  if (isLoading) return <div className="py-8 text-center">Loading withdrawal requests…</div>;
  if (isError) return <div className="py-8 text-center text-destructive">Could not load withdrawals: {error.message}</div>;

  const bank = dialog?.request.bank_snapshot;
  const dialogOpen = dialog !== null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Withdrawal Management</CardTitle>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]" aria-label="Filter withdrawals by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Babalawo</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payout account</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No withdrawal requests found.</TableCell></TableRow>
            ) : requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div>{request.babalawo_name}</div>
                  {request.babalawo_name !== request.babalawo_id && <div className="text-xs text-muted-foreground">{request.babalawo_id}</div>}
                </TableCell>
                <TableCell className="whitespace-nowrap">₦{request.amount.toLocaleString()}</TableCell>
                <TableCell>
                  {request.bank_snapshot ? (
                    <div className="text-sm">
                      <div className="font-medium">{request.bank_snapshot.bank_name || 'Bank not recorded'}</div>
                      <div>{request.bank_snapshot.account_name}</div>
                      <div className="font-mono">{request.bank_snapshot.account_number}</div>
                    </div>
                  ) : <span className="text-muted-foreground">No account snapshot</span>}
                </TableCell>
                <TableCell>{request.reason || '—'}</TableCell>
                <TableCell><Badge variant={request.status === 'completed' ? 'success' : request.status === 'rejected' ? 'destructive' : request.status === 'approved' ? 'default' : 'secondary'}>{request.status}</Badge></TableCell>
                <TableCell className="whitespace-nowrap">{format(new Date(request.created_at), 'PPP')}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {request.status === 'pending' && (
                      <>
                        <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => approve(request.id)}>Approve</Button>
                        <Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => { setRejectionReason(''); setDialog({ action: 'reject', request }); }}>Reject</Button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <>
                        <Button size="sm" disabled={mutation.isPending} onClick={() => { setReference(''); setDialog({ action: 'mark_paid', request }); }}>Process payout</Button>
                        <Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => { setRejectionReason(''); setDialog({ action: 'reject', request }); }}>Reject</Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !mutation.isPending) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.action === 'mark_paid' ? 'Process withdrawal payout' : 'Reject withdrawal request'}</DialogTitle>
            <DialogDescription>
              {dialog?.action === 'mark_paid'
                ? 'Confirm the transfer to the account shown below, then enter its bank reference.'
                : 'The held funds will be returned to the Babalawo’s available balance.'}
            </DialogDescription>
          </DialogHeader>

          {dialog?.action === 'mark_paid' ? (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">{dialog.request.babalawo_name} · ₦{dialog.request.amount.toLocaleString()}</div>
                <div>{bank?.bank_name || 'Bank not recorded'} · {bank?.account_name || 'Account name not recorded'}</div>
                <div className="font-mono">{bank?.account_number || 'Account number not recorded'}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout-reference">Bank transfer reference</Label>
                <Input id="payout-reference" autoFocus maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Enter transfer reference" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Reason</Label>
              <Textarea id="rejection-reason" autoFocus maxLength={500} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Explain why this request is being rejected" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={mutation.isPending} onClick={closeDialog}>Cancel</Button>
            <Button disabled={mutation.isPending} onClick={submitDialog}>
              {mutation.isPending ? 'Saving…' : dialog?.action === 'mark_paid' ? 'Confirm payout' : 'Confirm rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminWithdrawalManagement;
