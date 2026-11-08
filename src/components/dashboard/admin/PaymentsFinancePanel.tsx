import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Summary = {
  gross_paid: number; refunded: number; platform_commission: number; wallet_liability: number;
  babalawo_pending: number; babalawo_available: number; withdrawals_pending: number; paid_out: number;
  intents_needing_review: number;
};
type Tx = {
  kind: string; id: string; created_at: string; user_id: string | null; amount: number;
  status: string; reference: string | null; detail: string | null;
};

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`;
const KINDS = ["", "payment", "wallet", "withdrawal", "refund", "intent"];
const PAGE = 50;

const PaymentsFinancePanel: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Tx[]>([]);
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refundSession, setRefundSession] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    const [s, t] = await Promise.all([
      db.rpc("admin_finance_summary"),
      db.rpc("admin_transactions", { p_kind: kind || null, p_status: null, p_search: search || null, p_limit: PAGE, p_offset: page * PAGE }),
    ]);
    if (s.error || t.error) toast({ title: "Could not load finance data", description: (s.error || t.error).message, variant: "destructive" });
    setSummary(s.data ?? null);
    setRows(t.data ?? []);
    setLoading(false);
  }, [kind, search, page]);

  useEffect(() => { load(); }, [load]);

  const doRefund = async () => {
    const id = Number(refundSession);
    if (!id || refundReason.trim().length < 3) {
      toast({ title: "Enter a session number and a reason", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Refund session #${id} to the client's wallet and reverse the babalawo's earnings?`)) return;
    const { data, error } = await (supabase as any).rpc("admin_refund_session", { p_session_id: id, p_reason: refundReason });
    if (error) { toast({ title: "Refund failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Refunded", description: `${naira(data)} returned to the client's wallet.` });
    setRefundSession(""); setRefundReason(""); load();
  };

  const tiles: [string, number | undefined][] = [
    ["Gross paid", summary?.gross_paid], ["Platform commission", summary?.platform_commission],
    ["Refunded", summary?.refunded], ["Client wallets (owed)", summary?.wallet_liability],
    ["Babalawo earnings held", summary?.babalawo_pending], ["Babalawo available", summary?.babalawo_available],
    ["Withdrawals waiting", summary?.withdrawals_pending], ["Paid out", summary?.paid_out],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Payments & Finance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tiles.map(([label, value]) => (
              <div key={label} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-lg font-semibold">{naira(value ?? 0)}</div>
              </div>
            ))}
          </div>
          {!!summary?.intents_needing_review && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              {summary.intents_needing_review} payment(s) were charged for a different amount than expected and need a manual check
              (filter "intent", status "needs_review").
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Refund a session</CardTitle></CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-2">
          <Input placeholder="Session #" value={refundSession} onChange={(e) => setRefundSession(e.target.value)} className="md:w-32" inputMode="numeric" />
          <Input placeholder="Reason (kept in the audit trail)" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          <Button onClick={doRefund} variant="destructive">Refund to wallet</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <select className="border rounded-md px-2 h-10 text-sm bg-background" value={kind} onChange={(e) => { setPage(0); setKind(e.target.value); }}>
              {KINDS.map((k) => <option key={k} value={k}>{k || "All types"}</option>)}
            </select>
            <Input placeholder="Search reference, user id or note" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-3">When</th><th className="pr-3">Type</th><th className="pr-3">Amount</th>
                <th className="pr-3">Status</th><th className="pr-3">Reference</th><th>Details</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.kind}-${r.id}`} className="border-b align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="pr-3"><Badge variant="outline">{r.kind}</Badge></td>
                    <td className="pr-3 whitespace-nowrap">{naira(r.amount)}</td>
                    <td className="pr-3">{r.status}</td>
                    <td className="pr-3 font-mono text-xs break-all">{r.reference}</td>
                    <td className="text-xs text-muted-foreground">{r.detail}</td>
                  </tr>
                ))}
                {!rows.length && !loading && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No transactions match.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={rows.length < PAGE || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsFinancePanel;
