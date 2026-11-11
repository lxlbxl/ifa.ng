import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getWalletTransactions } from "@/utils/walletUtils";
import { EmptyState, Panel, PanelHeader } from "@/components/dashboard/shell/Panel";
import WalletWidget from "./WalletWidget";

const label = (src?: string) => (src ? src.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Wallet");

/** Wallet balance with top-up, and every credit and debit on it. */
const TransactionHistory: React.FC = () => {
  const { user } = useAuth();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["wallet-transactions", user?.id],
    enabled: !!user?.id,
    queryFn: () => getWalletTransactions(user!.id),
  });
  const credits = rows.filter((r) => r.transaction_type === "credit").reduce((a, r) => a + Number(r.amount), 0);
  const debits = rows.filter((r) => r.transaction_type === "debit").reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8">
      <div className="space-y-4">
        <WalletWidget />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-panel border border-line bg-paper p-4">
            <p className="eyebrow text-muted-foreground">Money in</p>
            <p className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em]">₦{credits.toLocaleString()}</p>
          </div>
          <div className="rounded-panel border border-line bg-paper p-4">
            <p className="eyebrow text-muted-foreground">Spent</p>
            <p className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em]">₦{debits.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <Panel>
        <PanelHeader eyebrow="Latest first" title="Activity" />
        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-field bg-cloth" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Receipt />} title="No payments yet">Top-ups, consultations and Ebo you pay for will appear here.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t) => {
              const inflow = t.transaction_type === "credit";
              return (
                <li key={t.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${inflow ? "bg-leaf" : "bg-cloth"}`}>
                    {inflow ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.description || label(t.transaction_source)}</p>
                    <p className="text-sm text-muted-foreground">{format(new Date(t.created_at), "d MMM yyyy, h:mm a")}</p>
                  </div>
                  <p className={`shrink-0 font-display text-lg font-extrabold tracking-[-0.02em] ${inflow ? "text-green-700" : "text-ink"}`}>
                    {inflow ? "+" : "−"}₦{Number(t.amount).toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default TransactionHistory;
