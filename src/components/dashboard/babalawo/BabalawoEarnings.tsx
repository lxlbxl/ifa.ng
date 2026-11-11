import React, { useState } from "react";
import { useBabalawoEarningsStats } from "@/hooks/useBabalawoEarningsStats";
import { Banknote } from "lucide-react";
import { Eyebrow, StatTile } from "@/components/brand";
import { EmptyState, Panel, PanelHeader } from "@/components/dashboard/shell/Panel";
import WithdrawalRequestModal from "./WithdrawalRequestModal";
import BankDetailsModal from "./BankDetailsModal";
import { Button } from "@/components/ui/button";

const BabalawoEarnings = () => {
  const { data, isLoading, isError } = useBabalawoEarningsStats();
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [bankDetailsModalOpen, setBankDetailsModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[120px] animate-pulse rounded-panel bg-paper" />)}
      </div>
    );
  }

  if (isError || !data) {
    return <EmptyState icon={<Banknote />} title="We couldn't load your earnings">Check your connection and open this page again.</EmptyState>;
  }

  const {
    allTimeEarnings = 0,
    availableBalance = 0,
    pendingPayouts = 0,
    withdrawalRequests = [],
    payoutHistory = [],
    commissionRates,
  } = data;
  const n = (v: number) => `₦${Number(v ?? 0).toLocaleString()}`;
  const STATUS: Record<string, string> = { pending: "bg-sun-200", approved: "bg-indigo-100", completed: "bg-leaf", paid: "bg-leaf", rejected: "bg-coral-100" };

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="grid gap-4 rounded-card bg-ink p-6 text-cloth sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Eyebrow className="text-sun">Ready to withdraw</Eyebrow>
          <p className="mt-2 font-display text-[clamp(44px,6vw,72px)] font-extrabold leading-none tracking-[-0.045em]">{n(availableBalance)}</p>
          <p className="mt-3 text-cloth/70">Withdrawals go to your bank account, usually within one working day.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="sun" size="lg" onClick={() => setWithdrawalModalOpen(true)}>Withdraw</Button>
          <Button variant="glass" size="lg" onClick={() => setBankDetailsModalOpen(true)}>Bank details</Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile tone="leaf" label="Earned, all time" value={n(allTimeEarnings)} />
        <StatTile tone="paper" label="Being paid out" value={n(pendingPayouts)} hint="Withdrawals in progress" />
        {commissionRates && (
          <StatTile tone="indigo" label="Your share" value={`${commissionRates.babalawoPercent}%`} hint={`Platform keeps ${commissionRates.platformPercent}% of consultations`} className="col-span-2 lg:col-span-1" />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Panel>
          <PanelHeader eyebrow="Requests" title="Withdrawals" />
          {withdrawalRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {withdrawalRequests.map((req: any) => (
                <li key={req.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-display text-lg font-extrabold tracking-[-0.02em]">{n(req.amount)}</p>
                    <p className="text-sm text-muted-foreground">{new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={`rounded-pill px-3 py-1 text-xs font-bold capitalize text-ink ${STATUS[req.status] ?? "bg-cloth"}`}>{req.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Paid to your bank" title="Payouts" />
          {payoutHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payouts yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {payoutHistory.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-extrabold tracking-[-0.02em]">{n(p.amount)}</p>
                    <p className="truncate text-sm text-muted-foreground">{[p.method, p.reference].filter(Boolean).join(" · ")}</p>
                  </div>
                  <p className="shrink-0 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <WithdrawalRequestModal
        open={withdrawalModalOpen}
        onOpenChange={setWithdrawalModalOpen}
        onSuccess={() => {
          // Optionally refetch data or show toast
        }}
      />
      <BankDetailsModal
        open={bankDetailsModalOpen}
        onOpenChange={setBankDetailsModalOpen}
        onSuccess={() => {
          // Optionally refetch data or show toast
        }}
      />
    </div>
  );
};

export default BabalawoEarnings;
