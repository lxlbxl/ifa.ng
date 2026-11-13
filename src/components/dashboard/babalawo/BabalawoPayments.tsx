import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/brand";

const db = supabase as any;
const naira = (n: any) => `₦${Number(n ?? 0).toLocaleString()}`;

/** A withdrawal's state in plain words, from its bank transfers when it is paid automatically. */
function withdrawalWords(w: any, transfers: { withdrawal_id: string; status: string }[]) {
  const mine = transfers.filter((t) => t.withdrawal_id === w.id).map((t) => t.status);
  if (w.status === "completed") return mine.includes("reversed") ? "Returned by your bank" : "Paid";
  if (w.status === "rejected") return "Not approved";
  if (w.status === "pending") return "Waiting for approval";
  if (w.status === "approved") {
    if (mine.some((s) => s === "sending" || s === "pending")) return "On its way to your bank";
    if (mine.includes("failed")) return "Approved, IFA.ng is sorting out the transfer";
    return "Approved, paying soon";
  }
  return w.status;
}

/** Read-only money view. Balances and ledger come from server views owned by the payments work (RLS limits rows to the caller). */
const BabalawoPayments: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["bab-money", user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const [bal, ledger, wd, tr] = await Promise.all([
        db.from("my_babalawo_earnings").select("*").maybeSingle(),
        db.from("babalawo_ledger").select("*").order("created_at", { ascending: false }).limit(100),
        db.from("withdrawal_requests").select("*").order("created_at", { ascending: false }).limit(20),
        db.from("payout_transfers").select("withdrawal_id, status").order("created_at", { ascending: false }).limit(100),
      ]);
      return { bal: bal.error ? null : bal.data, ledger: ledger.error ? [] : ledger.data ?? [], wd: wd.error ? [] : wd.data ?? [],
        transfers: tr.error ? [] : tr.data ?? [], viewsMissing: !!bal.error };
    },
  }) as any;
  if (isLoading) return <p className="text-muted-foreground">Loading payments...</p>;
  const b = data?.bal ?? {};
  const stat = (label: string, v: any, tone: "leaf" | "paper" | "indigo" | "coral" = "paper") => <StatTile tone={tone} label={label} value={naira(v)} />;
  return (
    <div className="space-y-6">
      {data?.viewsMissing && <p className="text-sm rounded-lg bg-amber-50 border border-amber-200 p-3">Detailed balances are not available yet. Your earnings page still shows withdrawals and payouts.</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stat("Available", b.available_balance ?? b.available, "leaf")}
        {stat("Held until done", b.pending_balance ?? b.pending, "indigo")}
        {stat("Being withdrawn", b.on_hold ?? b.withdrawing)}
        {stat("Lifetime earned", b.lifetime_earned ?? b.lifetime)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => window.dispatchEvent(new Event("openWithdrawalModal"))}>Request withdrawal</Button>
        <Button variant="outline" onClick={() => window.dispatchEvent(new Event("openBankDetailsModal"))}>Bank details</Button>
      </div>
      <Card><CardHeader><CardTitle className="text-xl">Payment history</CardTitle></CardHeader><CardContent className="divide-y">
        {(data?.ledger ?? []).length === 0 && <p className="text-sm text-muted-foreground py-4">No payments yet.</p>}
        {(data?.ledger ?? []).map((r: any) => (
          <div key={r.id} className="py-2 flex items-center justify-between text-sm gap-2">
            <div><p className="capitalize">{String(r.entry_type ?? r.type ?? "entry").replace(/_/g, " ")}{r.session_id ? ` · session #${r.session_id}` : ""}</p><p className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</p></div>
            <span className={Number(r.amount) < 0 ? "text-coral" : "text-green-700"}>{Number(r.amount) < 0 ? "-" : "+"}{naira(Math.abs(r.amount))}</span>
          </div>))}
      </CardContent></Card>
      {(data?.wd ?? []).length > 0 && <Card><CardHeader><CardTitle className="text-xl">Withdrawals</CardTitle></CardHeader><CardContent className="divide-y">
        {data.wd.map((w: any) => (<div key={w.id} className="py-2 flex justify-between text-sm"><span>{new Date(w.created_at).toLocaleDateString()}</span><span>{naira(w.amount)} <Badge variant="outline" className="ml-1">{withdrawalWords(w, data.transfers)}</Badge></span></div>))}
      </CardContent></Card>}
    </div>
  );
};

export default BabalawoPayments;
