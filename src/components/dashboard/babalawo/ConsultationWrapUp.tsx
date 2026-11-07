import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const db = supabase as any;

const ODUS = ["Eji Ogbe", "Oyeku Meji", "Iwori Meji", "Odi Meji", "Irosun Meji", "Owonrin Meji", "Obara Meji", "Okanran Meji", "Ogunda Meji", "Osa Meji", "Ika Meji", "Oturupon Meji", "Otura Meji", "Irete Meji", "Ose Meji", "Ofun Meji"];

type ActionPoint = { text: string; owner: "client" | "babalawo"; due_date?: string | null };
interface Notes {
  status: "draft" | "approved" | "shared"; source: "ai" | "manual";
  summary: string; action_points: ActionPoint[]; primary_odu: string; other_odus: string[];
  ritual_recommendations: string; items_needed: string; warning: string;
  deadline: string; next_appointment: string; language: string | null; transcript_confidence: number | null;
}
const EMPTY: Notes = { status: "draft", source: "manual", summary: "", action_points: [], primary_odu: "", other_odus: [], ritual_recommendations: "", items_needed: "", warning: "", deadline: "", next_appointment: "", language: null, transcript_confidence: null };

export interface WrapUpSession { id: number; user_id: string; status?: string; clientName?: string }

const NotesTab: React.FC<{ session: WrapUpSession; onDone: () => void }> = ({ session, onDone }) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["consult-notes", session.id],
    queryFn: async () => (await db.from("consultation_notes").select("*").eq("session_id", session.id).maybeSingle()).data,
  }) as any;
  const [f, setF] = useState<Notes>(EMPTY);
  useEffect(() => {
    if (!data) return;
    setF({ ...EMPTY, ...data, summary: data.summary ?? "", primary_odu: data.primary_odu ?? "", other_odus: data.other_odus ?? [], ritual_recommendations: data.ritual_recommendations ?? "", items_needed: data.items_needed ?? "", warning: data.warning ?? "", deadline: data.deadline ?? "", next_appointment: data.next_appointment ? String(data.next_appointment).slice(0, 10) : "", action_points: data.action_points ?? [] });
  }, [data]);
  const set = <K extends keyof Notes>(k: K, v: Notes[K]) => setF(x => ({ ...x, [k]: v }));
  const locked = f.status !== "draft";
  const isAiDraft = data?.source === "ai" && data?.status === "draft";

  const save = useMutation({
    mutationFn: async (approve: boolean) => {
      if (approve && !f.primary_odu.trim() && !f.summary.trim()) throw new Error("Add a summary or the primary Odu before approving");
      const row = {
        session_id: session.id, status: approve ? "approved" : "draft",
        source: data?.source === "ai" && !approve && !data?.edited ? "ai" : "manual",
        summary: f.summary || null, action_points: f.action_points.filter(a => a.text.trim()),
        primary_odu: f.primary_odu || null, other_odus: f.other_odus,
        ritual_recommendations: f.ritual_recommendations || null, items_needed: f.items_needed || null, warning: f.warning || null,
        deadline: f.deadline || null, next_appointment: f.next_appointment || null,
        ...(approve ? { approved_by: user?.id, approved_at: new Date().toISOString() } : {}),
      };
      const { error } = await db.from("consultation_notes").upsert(row, { onConflict: "session_id" });
      if (error) throw error;
      if (approve && session.status !== "completed") await db.from("sessions").update({ status: "completed" }).eq("id", session.id);
    },
    onSuccess: (_d, approve) => {
      toast({ title: approve ? "Notes approved and shared with the client" : "Draft saved" });
      qc.invalidateQueries({ queryKey: ["consult-notes", session.id] }); qc.invalidateQueries({ queryKey: ["bab-sessions"] });
      if (approve) onDone();
    },
    onError: (e: any) => toast({ title: "Could not save notes", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;
  const lowConf = f.transcript_confidence != null && Number(f.transcript_confidence) < 0.8;
  return (
    <div className="space-y-4">
      {isAiDraft && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm flex gap-2">
          <Bot className="h-5 w-5 text-violet-600 shrink-0" />
          <div>
            <p className="font-medium text-violet-900">AI-drafted from the session transcript{f.language ? ` (${f.language === "yo" ? "Yoruba" : f.language === "mixed" ? "English and Yoruba" : "English"})` : ""}.</p>
            <p className="text-violet-800">Read it carefully, fix anything wrong, then approve. The client sees nothing until you approve.</p>
            {lowConf && <p className="text-amber-700 flex items-center gap-1 mt-1"><AlertTriangle className="h-4 w-4" />Transcription confidence is low ({Math.round(Number(f.transcript_confidence) * 100)}%). Check names, Odu and items carefully.</p>}
          </div>
        </div>
      )}
      {locked && <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Approved {data?.approved_at ? new Date(data.approved_at).toLocaleString() : ""}</Badge>}
      <fieldset disabled={locked} className="space-y-4">
        <div><Label>Summary</Label><Textarea rows={4} value={f.summary} onChange={e => set("summary", e.target.value)} placeholder="What was discussed and the guidance given" /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Primary Odu</Label><Input list="odu-list" value={f.primary_odu} onChange={e => set("primary_odu", e.target.value)} placeholder="e.g. Eji Ogbe" /><datalist id="odu-list">{ODUS.map(o => <option key={o} value={o} />)}</datalist></div>
          <div><Label>Supporting Odus (comma separated)</Label><Input value={f.other_odus.join(", ")} onChange={e => set("other_odus", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} /></div>
        </div>
        <div>
          <Label>Agreed action points</Label>
          {f.action_points.map((a, i) => (
            <div key={i} className="flex gap-2 mt-2 items-center">
              <Input value={a.text} onChange={e => set("action_points", f.action_points.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder="Action" />
              <select className="border rounded-md h-10 px-2 text-sm" value={a.owner} onChange={e => set("action_points", f.action_points.map((x, j) => j === i ? { ...x, owner: e.target.value as any } : x))}><option value="client">Client</option><option value="babalawo">Babalawo</option></select>
              <Button type="button" size="icon" variant="ghost" aria-label="Remove" onClick={() => set("action_points", f.action_points.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>))}
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => set("action_points", [...f.action_points, { text: "", owner: "client" }])}><Plus className="h-4 w-4 mr-1" />Add action</Button>
        </div>
        <div><Label>Ritual recommendations</Label><Textarea rows={3} value={f.ritual_recommendations} onChange={e => set("ritual_recommendations", e.target.value)} /></div>
        <div><Label>Items needed</Label><Textarea rows={2} value={f.items_needed} onChange={e => set("items_needed", e.target.value)} /></div>
        <div><Label>Warnings or taboos</Label><Textarea rows={2} value={f.warning} onChange={e => set("warning", e.target.value)} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Complete by</Label><Input type="date" value={f.deadline} onChange={e => set("deadline", e.target.value)} /></div>
          <div><Label>Suggested next session</Label><Input type="date" value={f.next_appointment} onChange={e => set("next_appointment", e.target.value)} /></div>
        </div>
      </fieldset>
      {!locked && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending}>Save draft</Button>
          <Button onClick={() => save.mutate(true)} disabled={save.isPending}>Approve & share with client</Button>
        </div>)}
    </div>
  );
};

const EboTab: React.FC<{ session: WrapUpSession }> = ({ session }) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: items = [] } = useQuery({
    queryKey: ["ebo", session.id],
    queryFn: async () => (await db.from("ebo_prescriptions").select("*").eq("session_id", session.id).order("created_at")).data ?? [],
  }) as any;
  const blank = { kind: "ebo", title: "", description: "", items: "", estimated_cost: "", due_date: "" };
  const [f, setF] = useState(blank);
  const add = async () => {
    if (!f.title.trim()) return toast({ title: "Give the Ebo a title", variant: "destructive" });
    const { error } = await db.from("ebo_prescriptions").insert({
      session_id: session.id, babalawo_id: user!.id, client_id: session.user_id, kind: f.kind, title: f.title.trim(),
      description: f.description || null, items: f.items || null, estimated_cost: f.estimated_cost === "" ? null : Number(f.estimated_cost), due_date: f.due_date || null,
    });
    if (error) return toast({ title: "Could not add", description: error.message, variant: "destructive" });
    setF(blank); qc.invalidateQueries({ queryKey: ["ebo", session.id] }); toast({ title: "Added. The client can see it now." });
  };
  const cancel = async (id: string) => { await db.from("ebo_prescriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id); qc.invalidateQueries({ queryKey: ["ebo", session.id] }); };
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Ebo and Etutu you prescribe appear in the client's account straight away, with their progress.</p>
      {items.map((e: any) => (
        <div key={e.id} className="border rounded-xl p-3 flex justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">{e.title} <Badge variant="outline" className="ml-1">{e.kind}</Badge> <Badge className={e.status === "completed" ? "bg-green-100 text-green-800" : e.status === "cancelled" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-800"}>{e.status.replace("_", " ")}</Badge></p>
            {e.description && <p className="text-gray-600">{e.description}</p>}
            {e.items && <p className="text-gray-600">Items: {e.items}</p>}
            <p className="text-gray-500">{e.estimated_cost != null ? `Est. ₦${Number(e.estimated_cost).toLocaleString()}` : ""}{e.due_date ? ` · due ${e.due_date}` : ""}</p>
          </div>
          {e.status !== "cancelled" && e.status !== "completed" && <Button size="sm" variant="ghost" onClick={() => cancel(e.id)}>Cancel</Button>}
        </div>))}
      <div className="border rounded-xl p-3 space-y-3 bg-gray-50">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2"><Label>Title</Label><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Ebo Riru at the crossroads" /></div>
          <div><Label>Type</Label><select className="w-full border rounded-md h-10 px-2" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}><option value="ebo">Ebo</option><option value="etutu">Etutu</option><option value="other">Other</option></select></div>
        </div>
        <div><Label>Instructions</Label><Textarea rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
        <div><Label>Items needed</Label><Textarea rows={2} value={f.items} onChange={e => setF({ ...f, items: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Estimated cost (₦)</Label><Input type="number" min={0} value={f.estimated_cost} onChange={e => setF({ ...f, estimated_cost: e.target.value })} /></div>
          <div><Label>Complete by</Label><Input type="date" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} /></div>
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Add to client</Button>
      </div>
    </div>
  );
};

const ConsultationWrapUp: React.FC<{ session: WrapUpSession | null; onClose: () => void; initialTab?: "notes" | "ebo" }> = ({ session, onClose, initialTab = "notes" }) => (
  <Dialog open={!!session} onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Wrap up{session?.clientName ? `: ${session.clientName}` : " consultation"}</DialogTitle></DialogHeader>
      {session && (
        <Tabs defaultValue={initialTab}>
          <TabsList className="grid grid-cols-2 w-full"><TabsTrigger value="notes">Notes</TabsTrigger><TabsTrigger value="ebo">Ebo & Etutu</TabsTrigger></TabsList>
          <TabsContent value="notes"><NotesTab session={session} onDone={onClose} /></TabsContent>
          <TabsContent value="ebo"><EboTab session={session} /></TabsContent>
        </Tabs>)}
    </DialogContent>
  </Dialog>
);

export default ConsultationWrapUp;
