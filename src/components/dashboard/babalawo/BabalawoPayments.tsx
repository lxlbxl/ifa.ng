import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const db = supabase as any;
const naira = (n: any) => `₦${Number(n ?? 0).toLocaleString()}`;

/** Read-only money view. Balances and ledger come from server views owned by the payments work (RLS limits rows to the caller). */
const BabalawoPayments: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["bab-money", user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const [bal, ledger, wd] = await Promise.all([
        db.from("my_babalawo_earnings").select("*").maybeSingle(),
        db.from("babalawo_ledger").select("*").order("created_at", { ascending: false }).limit(100),
        db.from("withdrawal_requests").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      return { bal: bal.error ? null : bal.data, ledger: ledger.error ? [] : ledger.data ?? [], wd: wd.error ? [] : wd.data ?? [], viewsMissing: !!bal.error };
    },
  }) as any;
  if (isLoading) return <p className="text-gray-500">Loading payments...</p>;
  const b = data?.bal ?? {};
  const stat = (label: string, v: any, cls = "") => (<Card><CardContent className="p-4"><p className="text-xs uppercase text-gray-500">{label}</p><p className={`text-xl font-semibold ${cls}`}>{naira(v)}</p></CardContent></Card>);
  return (
    <div className="space-y-4">
      {data?.viewsMissing && <p className="text-sm rounded-lg bg-amber-50 border border-amber-200 p-3">Detailed balances are not available yet. Your earnings page still shows withdrawals and payouts.</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stat("Available", b.available_balance ?? b.available, "text-green-700")}
        {stat("Pending (held until session ends)", b.pending_balance ?? b.pending)}
        {stat("Being withdrawn", b.on_hold ?? b.withdrawing)}
        {stat("Lifetime earned", b.lifetime_earned ?? b.lifetime)}
      </div>
      <div className="flex gap-2">
        <button className="text-sm underline text-primary" onClick={() => window.dispatchEvent(new Event("openWithdrawalModal"))}>Request withdrawal</button>
        <span className="text-gray-300">|</span>
        <button className="text-sm underline text-primary" onClick={() => window.dispatchEvent(new Event("openBankDetailsModal"))}>Bank details</button>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Payment history</CardTitle></CardHeader><CardContent className="divide-y">
        {(data?.ledger ?? []).length === 0 && <p className="text-sm text-gray-500 py-4">No payments yet.</p>}
        {(data?.ledger ?? []).map((r: any) => (
          <div key={r.id} className="py-2 flex items-center justify-between text-sm gap-2">
            <div><p className="capitalize">{String(r.entry_type ?? r.type ?? "entry").replace(/_/g, " ")}{r.session_id ? ` · session #${r.session_id}` : ""}</p><p className="text-gray-500 text-xs">{new Date(r.created_at).toLocaleString()}</p></div>
            <span className={Number(r.amount) < 0 ? "text-red-600" : "text-green-700"}>{Number(r.amount) < 0 ? "-" : "+"}{naira(Math.abs(r.amount))}</span>
          </div>))}
      </CardContent></Card>
      {(data?.wd ?? []).length > 0 && <Card><CardHeader><CardTitle className="text-base">Withdrawals</CardTitle></CardHeader><CardContent className="divide-y">
        {data.wd.map((w: any) => (<div key={w.id} className="py-2 flex justify-between text-sm"><span>{new Date(w.created_at).toLocaleDateString()}</span><span>{naira(w.amount)} <Badge variant="outline" className="ml-1">{w.status}</Badge></span></div>))}
      </CardContent></Card>}
    </div>
  );
};

export default BabalawoPayments;
