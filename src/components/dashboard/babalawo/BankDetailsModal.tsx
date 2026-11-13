import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Clock, Loader2, Lock, Search, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { apiFetch } from '@/integrations/api/config';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * The Babalawo's payout account. The bank tells us the name on the account (it can't be typed),
 * the PIN is confirmed again before saving, and a changed account waits a day before withdrawals
 * can go to it. All checks are on the server (server/src/services/payoutAccounts.ts).
 */
interface BankDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Bank = { id: number; name: string };
export type PayoutAccount = {
  bank_name: string; account_number: string; account_name: string;
  status: 'unverified' | 'verified' | 'pending_review' | 'rejected';
  usable_from: string | null; review_note: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function usePayoutAccount(userId?: string) {
  return useQuery({
    queryKey: ['payout-account', userId], enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db.from('babalawo_bank_details')
        .select('bank_name, account_number, account_name, status, usable_from, review_note')
        .eq('babalawo_id', userId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as PayoutAccount | null;
    },
  });
}

const lagos = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** One line on the account's state, for this modal and the Earnings page. */
export function PayoutAccountStatus({ account }: { account: PayoutAccount }) {
  const waiting = account.usable_from && new Date(account.usable_from).getTime() > Date.now();
  const tone = account.status === 'verified' && !waiting ? 'bg-leaf/50' : account.status === 'rejected' ? 'bg-coral/20' : 'bg-sun/30';
  return (
    <div className={cn('rounded-field p-3 text-sm', tone)} data-testid="payout-account-status">
      <p className="m-0 font-semibold">{account.bank_name} ••{account.account_number.slice(-4)} · {account.account_name}</p>
      <p className="m-0 mt-1 flex items-center gap-1.5">
        {account.status === 'verified' && !waiting && <><BadgeCheck className="h-4 w-4" /> Verified. Withdrawals go here.</>}
        {account.status === 'verified' && waiting && <><Clock className="h-4 w-4" /> Verified. For your safety, withdrawals can go here from {lagos(account.usable_from!)}.</>}
        {account.status === 'pending_review' && <><Clock className="h-4 w-4" /> The name on this account is different from your IFA.ng name, so IFA.ng is checking it. Usually within a day.</>}
        {account.status === 'rejected' && <><ShieldAlert className="h-4 w-4" /> Not accepted{account.review_note ? `: ${account.review_note}` : ''}. Please add an account in your own name.</>}
        {account.status === 'unverified' && <><ShieldAlert className="h-4 w-4" /> Not checked yet. Please add it again below so the bank can confirm the name.</>}
      </p>
    </div>
  );
}

const BankDetailsModal: React.FC<BankDetailsModalProps> = ({ open, onOpenChange, onSuccess }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: current, isLoading } = usePayoutAccount(open ? user?.id : undefined);
  const { data: banks = [] } = useQuery({
    queryKey: ['payout-banks'], enabled: open, staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await db.from('payout_banks').select('id, name').eq('active', true).order('name');
      if (error) throw error;
      return data as Bank[];
    },
  });
  const [search, setSearch] = useState('');
  const [bank, setBank] = useState<Bank | null>(null);
  const [account, setAccount] = useState('');
  const [name, setName] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState<null | 'check' | 'save'>(null);

  useEffect(() => {
    if (!open) { setSearch(''); setBank(null); setAccount(''); setName(null); setPin(''); }
  }, [open]);
  useEffect(() => { setName(null); }, [bank?.id, account]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? banks.filter((b) => b.name.toLowerCase().includes(q)) : banks;
  }, [banks, search]);

  const fail = (e: unknown) => toast({ title: 'Not saved', description: (e as Error).message, variant: 'destructive' });

  async function check() {
    if (!bank || !/^\d{10}$/.test(account)) return;
    setBusy('check');
    try {
      const r = await apiFetch<{ account_name: string }>('/v1/payout-account/resolve', {
        method: 'POST', body: JSON.stringify({ bank_id: bank.id, account_number: account }) });
      setName(r.account_name);
    } catch (e) { fail(e); } finally { setBusy(null); }
  }

  async function save() {
    if (!bank || !name || !/^\d{4}$/.test(pin)) return;
    setBusy('save');
    try {
      const { step_up } = await apiFetch<{ step_up: string }>('/api/auth/phone/confirm-pin', {
        method: 'POST', body: JSON.stringify({ pin, purpose: 'payout_account' }) });
      const r = await apiFetch<{ status: string; usable_from: string }>('/v1/payout-account', {
        method: 'PUT', body: JSON.stringify({ bank_id: bank.id, account_number: account, step_up }) });
      const later = new Date(r.usable_from).getTime() > Date.now() + 60_000;
      toast({
        title: r.status === 'verified' ? 'Payout account saved' : 'Saved. IFA.ng will check the name',
        description: r.status !== 'verified' ? 'The name on the account is different from your IFA.ng name. We will confirm it with you.'
          : later ? `For your safety, withdrawals can go to it from ${lagos(r.usable_from)}.` : 'Withdrawals will go to this account.',
      });
      await qc.invalidateQueries({ queryKey: ['payout-account'] });
      onSuccess?.();
      onOpenChange(false);
    } catch (e) { setPin(''); fail(e); } finally { setBusy(null); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Payout account</DialogTitle>
          <DialogDescription>Where your withdrawals are paid. Use an account in your own name.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="grid gap-4">
            {current && <PayoutAccountStatus account={current} />}
            {current && <p className="m-0 text-sm font-semibold">Change account</p>}

            <div className="grid gap-2">
              <Label htmlFor="bank_search">Bank</Label>
              {bank ? (
                <div className="flex items-center justify-between gap-2 rounded-field border-2 border-ink px-3 py-2">
                  <span className="font-semibold">{bank.name}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setBank(null)}>Change</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="bank_search" className="pl-9" placeholder="Search for your bank" value={search}
                      onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
                  </div>
                  <ul className="m-0 max-h-48 list-none overflow-y-auto rounded-field border border-line p-1" role="listbox" aria-label="Banks">
                    {shown.map((b) => (
                      <li key={b.id}>
                        <button type="button" role="option" aria-selected={false}
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-leaf/40" onClick={() => setBank(b)}>{b.name}</button>
                      </li>
                    ))}
                    {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No bank by that name.</li>}
                  </ul>
                </>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="account_number">Account number</Label>
              <Input id="account_number" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="10 digits"
                value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            </div>

            {!name ? (
              <Button type="button" variant="outline" disabled={!bank || account.length !== 10 || busy === 'check'} onClick={check}>
                {busy === 'check' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Check account
              </Button>
            ) : (
              <>
                <div className="rounded-field bg-leaf/40 p-3 text-sm" data-testid="resolved-name">
                  <span className="text-muted-foreground">The bank says this account belongs to</span>
                  <p className="m-0 mt-1 text-base font-bold">{name}</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm_pin">Your 4-digit PIN, to confirm it's you</Label>
                  <Input id="confirm_pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={4}
                    value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {name && (
            <Button type="button" variant="sun" disabled={pin.length !== 4 || busy === 'save'} onClick={save}>
              {busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />} Save this account
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BankDetailsModal;
