import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { apiFetch } from '@/integrations/api/config';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatTile } from '@/components/brand';

/**
 * The payout money at a glance: per provider, what its balance was at the last check, what IFA.ng
 * owes on it (client wallets and Babalawo money not yet paid out), and what was paid out. Above it,
 * what needs an admin: withdrawals to approve, transfers held, failed or slow.
 */
type ProviderView = {
  owed: number; paid_today: number; paid_30d: number; fees_30d: number; on_the_way: number;
  last_check: { balance: number; owed: number; difference: number; short: boolean; checked_at: string } | null;
};
type Overview = {
  providers: Record<'paystack' | 'flutterwave', ProviderView>;
  auto_enabled: boolean; auto_approve_max: number; daily_max: number; sent_today: number;
  waiting_approval: { count: number; amount: number }; held: { count: number; amount: number };
  failed: { count: number; amount: number }; stuck: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const naira = (n: number | string | null | undefined) => `₦${Number(n ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const NAMES = { paystack: 'Paystack', flutterwave: 'Flutterwave' } as const;

export default function PayoutOverview() {
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const { data } = useQuery({
    queryKey: ['withdrawalRequests', 'payout-overview'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc('admin_payout_overview');
      if (error) throw new Error(error.message);
      return data as Overview;
    },
  });
  if (!data) return null;

  async function checkNow() {
    setChecking(true);
    try {
      const r = await apiFetch<{ checks: unknown[] }>('/v1/admin/payouts/check-balances', { method: 'POST' });
      toast({ title: r.checks.length ? 'Balances checked' : 'No provider keys set up yet' });
      await qc.invalidateQueries({ queryKey: ['withdrawalRequests', 'payout-overview'] });
    } catch (e) {
      toast({ title: 'Could not check balances', description: (e as Error).message, variant: 'destructive' });
    } finally { setChecking(false); }
  }

  const needs = [
    data.waiting_approval.count > 0 && `${data.waiting_approval.count} withdrawal${data.waiting_approval.count === 1 ? '' : 's'} to approve (${naira(data.waiting_approval.amount)})`,
    data.failed.count > 0 && `${data.failed.count} failed transfer${data.failed.count === 1 ? '' : 's'} (${naira(data.failed.amount)})`,
    data.held.count > 0 && `${data.held.count} transfer${data.held.count === 1 ? '' : 's'} held back (${naira(data.held.amount)})`,
    data.stuck > 0 && `${data.stuck} transfer${data.stuck === 1 ? '' : 's'} taking longer than usual`,
  ].filter(Boolean) as string[];

  return (
    <Card data-testid="payout-overview">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Payout money</CardTitle>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {data.auto_enabled
              ? `Automated payouts are on. ${naira(data.sent_today)} of ${naira(data.daily_max)} sent today.`
              : 'Automated payouts are off: approved withdrawals are paid by hand.'}
            {data.auto_approve_max > 0 ? ` Withdrawals up to ${naira(data.auto_approve_max)} are approved automatically.` : ''}
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={checking} onClick={checkNow}>
          <RefreshCw className={`mr-1 h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> Check balances now
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {needs.length > 0 && (
          <div className="rounded-field bg-sun/30 p-3 text-sm">
            <p className="m-0 font-semibold">Needs you</p>
            <ul className="m-0 mt-1 list-disc pl-5">{needs.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {(['paystack', 'flutterwave'] as const).map((p) => {
            const v = data.providers[p];
            const c = v.last_check;
            return (
              <div key={p} className="space-y-2 rounded-field border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 font-semibold">{NAMES[p]}</p>
                  <span className="text-xs text-muted-foreground">
                    {c ? `Balance checked ${new Date(c.checked_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' })}` : 'Balance not checked yet'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile tone={c?.short ? 'coral' : 'leaf'} label="Balance" value={c ? naira(c.balance) : '—'} />
                  <StatTile label="Owed to clients and Babalawos" value={naira(v.owed)} />
                  <StatTile tone="indigo" label="On its way" value={naira(v.on_the_way)} />
                  <StatTile label="Paid out in 30 days" value={naira(v.paid_30d)} hint={`Transfer fees ${naira(v.fees_30d)}`} />
                </div>
                {c?.short && (
                  <p className="m-0 flex items-start gap-1.5 text-sm text-coral">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    The balance was {naira(Math.abs(c.difference))} less than what is owed. Recent payments may not have settled yet; check settlements and refunds on {NAMES[p]}.
                  </p>
                )}
                {c && !c.short && (
                  <p className="m-0 text-xs text-muted-foreground">IFA.ng's own money on {NAMES[p]} at that check: about {naira(c.difference)}.</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
