import { format } from "date-fns";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateSessionStatus, useAdminRefundSession } from "@/hooks/useAdminActions";
import type { Database } from "@/integrations/supabase/types";
import { sessionStart } from "@/utils/sessionTime";

type SessionStatus = Database["public"]["Enums"]["session_status_enum"];
const STATUSES: SessionStatus[] = ["pending", "confirmed", "in_progress", "completed", "cancelled"];

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800", confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800", completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-200 text-gray-700",
};

const fetchSessions = async () => {
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, user_id, babalawo_id, session_date, start_time, end_time, starts_at, status, payment_status, amount")
    .order("session_date", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((sessions ?? []).flatMap((s) => [s.user_id, s.babalawo_id])));
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  const name = (id: string) => {
    const p = profiles?.find((x) => x.id === id);
    return p?.full_name || p?.email || id.slice(0, 8);
  };
  return (sessions ?? []).map((s) => ({ ...s, client: name(s.user_id), babalawo: name(s.babalawo_id) }));
};

const AdminBookings: React.FC = () => {
  const { data, isLoading, error } = useQuery({ queryKey: ["adminSessions"], queryFn: fetchSessions });
  const update = useUpdateSessionStatus();
  const refund = useAdminRefundSession();
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const rows = (data ?? []).filter(
    (s) => (filter === "all" || s.status === filter) &&
      (`${s.client} ${s.babalawo}`.toLowerCase().includes(q.toLowerCase())),
  );

  const change = (id: string, status: SessionStatus) => {
    if (status === "cancelled") {
      const reason = window.prompt("Reason for cancelling? Paid sessions are refunded to the client.");
      if (reason) refund.mutate({ sessionId: id, reason });
      return;
    }
    update.mutate({ sessionId: id, status });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bookings</CardTitle>
        <p className="text-sm text-gray-600">All consultations. Status changes by admins are recorded in the activity log.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input placeholder="Search by client or Babalawo..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isLoading && <p className="py-8 text-center">Loading bookings...</p>}
        {error && <p className="py-8 text-center text-red-500">{(error as Error).message}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="py-2 px-3">When</th><th className="py-2 px-3">Client</th><th className="py-2 px-3">Babalawo</th>
                <th className="py-2 px-3">Amount</th><th className="py-2 px-3">Payment</th><th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-right">Set status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 whitespace-nowrap">{format(sessionStart(s), "yyyy-MM-dd HH:mm")}</td>
                  <td className="py-2 px-3">{s.client}</td>
                  <td className="py-2 px-3">{s.babalawo}</td>
                  <td className="py-2 px-3">₦{Number(s.amount ?? 0).toLocaleString()}</td>
                  <td className="py-2 px-3"><Badge variant="outline">{s.payment_status ?? "—"}</Badge></td>
                  <td className="py-2 px-3"><Badge className={statusColor[s.status] ?? ""}>{s.status.replace("_", " ")}</Badge></td>
                  <td className="py-2 px-3 text-right">
                    <Select value={s.status} onValueChange={(v) => change(s.id, v as SessionStatus)} disabled={update.isPending || refund.isPending}>
                      <SelectTrigger className="w-36 ml-auto h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((x) => <SelectItem key={x} value={x}>{x.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && rows.length === 0 && <p className="py-8 text-center text-gray-500">No bookings match.</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminBookings;
