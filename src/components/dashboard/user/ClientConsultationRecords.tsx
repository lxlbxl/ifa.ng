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
        db.from("ebo_prescriptions").select("*").eq("client_id", user!.id).neq("status", "cancelled").order("created_at", { ascending: false }),
      ]);
      if (notes.error) throw notes.error;
      if (ebo.error) throw ebo.error;
      const ids = [...new Set<string>((notes.data ?? []).map((n: any) => n.sessions?.babalawo_id).concat((ebo.data ?? []).map((e: any) => e.babalawo_id)).filter(Boolean))];
      const names: Record<string, string> = {};
      if (ids.length) (await db.from("profiles").select("id, full_name").in("id", ids)).data?.forEach((p: any) => (names[p.id] = p.full_name));
      return { notes: notes.data ?? [], ebo: ebo.data ?? [], names };
    },
  }) as any;

  const setStatus = async (id: string, status: "in_progress" | "completed") => {
    const { error } = await db.rpc("set_ebo_status", { p_id: id, p_status: status });
    if (error) return toast({ title: "Could not update", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["client-records", user?.id] });
  };

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin" />;
  if (isError) return <p className="text-red-600">Could not load your records.</p>;
  const { notes, ebo, names } = data;
  const open = ebo.filter((e: any) => e.status !== "completed");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><div className="p-3 bg-primary/10 rounded-xl"><BookOpen className="h-6 w-6 text-primary" /></div><h2 className="text-2xl font-semibold text-gray-800">My notes & Ebo</h2></div>
      <Tabs defaultValue="notes">
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
          {ebo.length === 0 && <p className="text-gray-500 py-6 text-center">No Ebo or Etutu prescribed yet.</p>}
          {ebo.map((e: any) => (
            <Card key={e.id}><CardContent className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="text-sm space-y-1">
                <p className="font-medium text-base">{e.title} <Badge variant="outline">{e.kind}</Badge></p>
                <p className="text-gray-500">From {names[e.babalawo_id] || "your Babalawo"}{e.due_date ? ` · complete by ${e.due_date}` : ""}{e.estimated_cost != null ? ` · est. ₦${Number(e.estimated_cost).toLocaleString()}` : ""}</p>
                {e.description && <p>{e.description}</p>}
                {e.items && <p><span className="font-medium">Items:</span> {e.items}</p>}
              </div>
              {e.status === "completed"
                ? <Badge className="bg-green-100 text-green-800 self-start"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>
                : <div className="flex gap-2">
                    {e.status === "prescribed" && <Button size="sm" variant="outline" onClick={() => setStatus(e.id, "in_progress")}><Circle className="h-3 w-3 mr-1" />Started</Button>}
                    <Button size="sm" onClick={() => setStatus(e.id, "completed")}>Mark done</Button>
                  </div>}
            </CardContent></Card>))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientConsultationRecords;
