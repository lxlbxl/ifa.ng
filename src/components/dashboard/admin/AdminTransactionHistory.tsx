import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Tx { kind: string; id: string; created_at: string; user_id: string | null; amount: number; status: string; reference: string | null; detail: string | null }

const KINDS = [
  { value: "all", label: "Everything" },
  { value: "payment", label: "Payments" },
  { value: "wallet", label: "Wallet movements" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "refund", label: "Refunds" },
  { value: "intent", label: "Checkout attempts" },
];
const PAGE = 50;

/** Every money movement on the platform, newest first (admin_transactions on the server). */
const AdminTransactionHistory: React.FC = () => {
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-transactions", kind, q, page],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_transactions", {
        p_kind: kind === "all" ? null : kind, p_status: null, p_search: q || null, p_limit: PAGE, p_offset: page * PAGE,
      });
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });
  const ids = Array.from(new Set((data ?? []).map((t) => t.user_id).filter(Boolean))) as string[];
  const { data: names } = useQuery({
    queryKey: ["admin-tx-names", ids.join(",")], enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
      return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name || p.phone || p.id.slice(0, 8)]));
    },
  });

  return (
    <Card className="w-full">
      <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); setQ(search.trim()); }}>
          <Select value={kind} onValueChange={(v) => { setKind(v); setPage(0); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="max-w-xs" placeholder="Reference, user id or note" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="outline">Search</Button>
        </form>
        {error ? <p className="text-destructive">{(error as Error).message}</p>
          : isLoading ? <p className="text-muted-foreground">Loading…</p>
          : !data?.length ? <p className="py-8 text-center text-muted-foreground">No transactions match.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2 pr-3">When</th><th className="pr-3">Type</th><th className="pr-3">Who</th><th className="pr-3 text-right">Amount</th><th className="pr-3">Status</th><th className="pr-3">Reference</th><th>Detail</th></tr>
                </thead>
                <tbody>
                  {data.map((t) => (
                    <tr key={`${t.kind}-${t.id}`} className="border-t border-line align-top">
                      <td className="whitespace-nowrap py-2 pr-3">{format(new Date(t.created_at), "d MMM yyyy HH:mm")}</td>
                      <td className="pr-3"><Badge variant="outline">{t.kind}</Badge></td>
                      <td className="pr-3">{t.user_id ? names?.[t.user_id] ?? t.user_id.slice(0, 8) : "–"}</td>
                      <td className="whitespace-nowrap pr-3 text-right font-semibold">₦{Number(t.amount).toLocaleString()}</td>
                      <td className="pr-3">{t.status}</td>
                      <td className="max-w-[180px] truncate pr-3 font-mono text-xs" title={t.reference ?? ""}>{t.reference ?? "–"}</td>
                      <td className="max-w-[280px] truncate" title={t.detail ?? ""}>{t.detail ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <div className="flex justify-between">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Newer</Button>
          <Button variant="outline" size="sm" disabled={(data?.length ?? 0) < PAGE} onClick={() => setPage((p) => p + 1)}>Older</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminTransactionHistory;
