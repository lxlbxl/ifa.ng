import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useResolveDispute } from "@/hooks/useAdminActions";

type Row = {
  id: string; session_id: string; raised_by: string; reason: string; status: string;
  resolution_note: string | null; refund_requested: boolean; created_at: string; raisedByName: string;
};

const fetchDisputes = async (): Promise<Row[]> => {
  const { data, error } = await supabase.from("disputes").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((data ?? []).map((d) => d.raised_by)));
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  return (data ?? []).map((d) => {
    const p = profiles?.find((x) => x.id === d.raised_by);
    return { ...d, raisedByName: p?.full_name || p?.email || d.raised_by.slice(0, 8) };
  });
};

const color: Record<string, string> = {
  open: "bg-red-100 text-red-800", investigating: "bg-yellow-100 text-yellow-800",
  resolved_refund: "bg-green-100 text-green-800", resolved_dismissed: "bg-gray-200 text-gray-700",
};

const AdminDisputes: React.FC = () => {
  const { data, isLoading, error } = useQuery({ queryKey: ["adminDisputes"], queryFn: fetchDisputes });
  const resolve = useResolveDispute();
  const [active, setActive] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const rows = (data ?? []).filter((d) => showResolved || !d.status.startsWith("resolved"));
  const open = (d: Row) => { setActive(d); setNote(d.resolution_note ?? ""); setRefund(false); };
  const submit = (status: "investigating" | "resolved_refund" | "resolved_dismissed") => {
    if (!active) return;
    resolve.mutate({ disputeId: active.id, status, note: note.trim(), refund: status === "resolved_refund" && refund });
    setActive(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Disputes</CardTitle>
          <p className="text-sm text-gray-600">Raised by clients or Babalawos from a booking. Refund decisions are flagged for the payments flow.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? "Hide resolved" : "Show resolved"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="py-8 text-center">Loading disputes...</p>}
        {error && <p className="py-8 text-center text-red-500">{(error as Error).message}</p>}
        {rows.map((d) => (
          <div key={d.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Badge className={color[d.status]}>{d.status.replace("_", " ")}</Badge>
                {d.refund_requested && <Badge variant="outline">refund approved</Badge>}
                <span className="text-sm text-gray-600">{d.raisedByName} · {new Date(d.created_at).toLocaleString()}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => open(d)}>Review</Button>
            </div>
            <p className="text-sm">{d.reason}</p>
            <p className="text-xs text-gray-500">Session {d.session_id.slice(0, 8)}</p>
            {d.resolution_note && <p className="text-xs text-gray-600">Resolution: {d.resolution_note}</p>}
          </div>
        ))}
        {!isLoading && rows.length === 0 && <p className="py-8 text-center text-gray-500">No disputes to review.</p>}
      </CardContent>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review dispute</DialogTitle>
            <DialogDescription>{active?.reason}</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Resolution note (sent to the person who raised it)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex items-center gap-2">
            <Checkbox id="refund" checked={refund} onCheckedChange={(v) => setRefund(v === true)} />
            <Label htmlFor="refund">Approve a refund (flags it for the payments flow)</Label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => submit("investigating")}>Mark investigating</Button>
            <Button variant="outline" disabled={!note.trim()} onClick={() => submit("resolved_dismissed")}>Dismiss</Button>
            <Button disabled={!note.trim() || !refund} onClick={() => submit("resolved_refund")}>Resolve with refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminDisputes;
