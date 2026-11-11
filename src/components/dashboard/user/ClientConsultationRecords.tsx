import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EboClientList from "@/components/ebo/EboClientList";
import { eboApi, type Ebo } from "@/lib/ebo";

const db = supabase as any;

/** What the client receives after a consultation: approved notes, action points and Ebo to carry out. */
const ClientConsultationRecords: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-records", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // RLS only returns approved/shared notes to the client
      const [notes, ebo] = await Promise.all([
        db.from("consultation_notes").select("*, sessions!inner(session_date, start_time, babalawo_id)").order("approved_at", { ascending: false }),
        eboApi.listForClient(user!.id),
      ]);
      if (notes.error) throw notes.error;
      const ids = [...new Set<string>((notes.data ?? []).map((n: any) => n.sessions?.babalawo_id).concat(ebo.map((e) => e.babalawo_id)).filter(Boolean))];
      const names: Record<string, string> = {};
      if (ids.length) (await db.from("profiles").select("id, full_name").in("id", ids)).data?.forEach((p: any) => (names[p.id] = p.full_name));
      return { notes: notes.data ?? [], ebo, names };
    },
  }) as any;

  const refresh = () => qc.invalidateQueries({ queryKey: ["client-records", user?.id] });

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin" />;
  if (isError) return <p className="text-red-600">Could not load your records.</p>;
  const { notes, ebo, names } = data;
  const open = ebo.filter((e: Ebo) => !["completed", "declined", "expired", "refunded"].includes(e.status));
  // An Ebo waiting for the client opens on the Ebo tab.
  const needsMe = ebo.some((e: Ebo) => (e.status === "sent" && e.performed_by === "babalawo") || e.status === "performed");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><div className="p-3 bg-primary/10 rounded-xl"><BookOpen className="h-6 w-6 text-primary" /></div><h2 className="text-2xl font-semibold text-gray-800">My notes & Ebo</h2></div>
      <Tabs defaultValue={needsMe ? "ebo" : "notes"}>
        <TabsList><TabsTrigger value="notes">Consultation notes ({notes.length})</TabsTrigger><TabsTrigger value="ebo">Ebo & Etutu ({open.length} open)</TabsTrigger></TabsList>
        <TabsContent value="notes" className="space-y-3">
          {notes.length === 0 && <p className="text-gray-500 py-6 text-center">Notes appear here once your Babalawo has reviewed and shared them after your session.</p>}
          {notes.map((n: any) => (
            <Card key={n.id}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{names[n.sessions?.babalawo_id] || "Your Babalawo"} · {n.sessions?.session_date}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {n.primary_odu && <p><span className="font-medium">Odu:</span> {n.primary_odu}{n.other_odus?.length ? `, ${n.other_odus.join(", ")}` : ""}</p>}
                {n.summary && <p className="whitespace-pre-line">{n.summary}</p>}
                {n.action_points?.length > 0 && (<div><p className="font-medium mb-1">Agreed actions</p><ul className="list-disc pl-5 space-y-1">{n.action_points.map((a: any, i: number) => <li key={i}>{a.text} <span className="text-gray-400">({a.owner === "babalawo" ? "Babalawo" : "You"})</span></li>)}</ul></div>)}
                {n.ritual_recommendations && <p><span className="font-medium">Rituals:</span> {n.ritual_recommendations}</p>}
                {n.items_needed && <p><span className="font-medium">Items needed:</span> {n.items_needed}</p>}
                {n.warning && <p className="rounded-lg bg-amber-50 border border-amber-200 p-2"><span className="font-medium">Warning:</span> {n.warning}</p>}
                <p className="text-gray-500">{n.deadline ? `Complete by ${n.deadline}. ` : ""}{n.next_appointment ? `Suggested next session: ${String(n.next_appointment).slice(0, 10)}.` : ""}</p>
              </CardContent>
            </Card>))}
        </TabsContent>
        <TabsContent value="ebo" className="space-y-3">
          <EboClientList ebo={ebo} names={names} refresh={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientConsultationRecords;
