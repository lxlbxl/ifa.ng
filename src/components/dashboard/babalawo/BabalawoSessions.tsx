import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Video, FileText, Clock, Bot, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConsultationWrapUp, { WrapUpSession } from "./ConsultationWrapUp";

const db = supabase as any;
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", confirmed: "bg-blue-100 text-blue-800", in_progress: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700", cancelled: "bg-red-100 text-red-700",
};
const startOf = (s: any) => new Date(`${s.session_date}T${String(s.start_time).slice(0, 8)}`);

const BabalawoSessions: React.FC = () => {
  const { user } = useAuth();
  const [wrap, setWrap] = useState<{ s: WrapUpSession; tab: "notes" | "ebo" } | null>(null);
  const [q, setQ] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["bab-sessions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: sessions, error } = await db.from("sessions").select("*").eq("babalawo_id", user!.id).order("session_date", { ascending: false }).order("start_time", { ascending: false }).limit(300);
      if (error) throw error;
      const ids = [...new Set<string>(sessions.map((s: any) => s.user_id))];
      const sids = sessions.map((s: any) => s.id);
      const [profiles, notes, ebo] = await Promise.all([
        ids.length ? db.from("profiles").select("id, full_name, avatar_url").in("id", ids) : { data: [] },
        sids.length ? db.from("consultation_notes").select("session_id, status, source").in("session_id", sids) : { data: [] },
        db.from("ebo_prescriptions").select("id, session_id, title, status, ritual_at, attendance, client_id")
          .eq("babalawo_id", user!.id).in("status", ["draft", "sent", "paid", "in_progress", "performed", "disputed"]),
      ]);
      const names: Record<string, string> = {}; (profiles.data ?? []).forEach((p: any) => (names[p.id] = p.full_name));
      const noteBy: Record<number, any> = {}; (notes.data ?? []).forEach((n: any) => (noteBy[n.session_id] = n));
      const eboBy: Record<string, any> = {}; (ebo.data ?? []).forEach((e: any) => (eboBy[e.id] = e));
      const rows = sessions.map((s: any) => ({ ...s, clientName: names[s.user_id] || "Client", note: noteBy[s.id], ebo: s.ebo_id ? eboBy[s.ebo_id] : undefined }));
      const byId: Record<number, any> = {}; rows.forEach((s: any) => (byId[s.id] = s));
      // Paid Ebo waiting for the Babalawo to perform, with the consultation they came from.
      const eboTodo = (ebo.data ?? []).filter((e: any) => e.status === "paid" || e.status === "in_progress")
        .map((e: any) => ({ ...e, parent: byId[e.session_id], clientName: names[e.client_id] || "Client" }))
        .sort((a: any, b: any) => String(a.ritual_at).localeCompare(String(b.ritual_at)));
      return { rows, eboTodo };
    },
  }) as any;

  const eboTodo: any[] = data?.eboTodo ?? [];
  const all: any[] = (data?.rows ?? []).filter((s: any) => !q || s.clientName.toLowerCase().includes(q.toLowerCase()));
  const now = Date.now();
  const upcoming = all.filter(s => ["pending", "confirmed", "in_progress"].includes(s.status) && startOf(s).getTime() + 3 * 3600e3 > now).sort((a, b) => startOf(a).getTime() - startOf(b).getTime());
  const past = all.filter(s => !upcoming.includes(s));
  const needNotes = past.filter(s => s.status === "completed" || s.status === "in_progress").filter(s => !s.note || s.note.status === "draft").length;

  const Card1 = ({ s, isUpcoming }: { s: any; isUpcoming: boolean }) => {
    const d = startOf(s);
    const joinHref = s.meet_uri || `/session/${s.id}`;
    const canJoin = isUpcoming && s.payment_status !== "pending" && s.status !== "pending";
    return (
      <Card><CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="font-medium">{s.clientName} {s.is_instant && <Badge variant="outline" className="ml-1">Instant</Badge>}</p>
          <p className="text-sm text-gray-600 flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · {String(s.start_time).slice(0, 5)}-{String(s.end_time).slice(0, 5)}{s.user_timezone ? ` · client in ${s.user_timezone}` : ""}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge className={STATUS_STYLE[s.status]}>{String(s.status).replace("_", " ")}</Badge>
            {s.amount != null && <Badge variant="outline">₦{Number(s.amount).toLocaleString()} · {s.payment_status ?? "n/a"}</Badge>}
            {s.session_type === "ebo_ritual" && <Badge className="bg-orange-100 text-orange-800">Ebo ritual{s.ebo?.title ? `: ${s.ebo.title}` : ""}</Badge>}
            {s.note?.status === "draft" && s.note.source === "ai" && <Badge className="bg-violet-100 text-violet-800"><Bot className="h-3 w-3 mr-1" />AI notes need review</Badge>}
            {s.note && s.note.status !== "draft" && <Badge className="bg-green-100 text-green-800">Notes shared</Badge>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isUpcoming && (canJoin
            ? (s.meet_uri ? <Button asChild><a href={joinHref} target="_blank" rel="noopener noreferrer"><Video className="h-4 w-4 mr-1" />Join</a></Button>
                          : <Button asChild><Link to={joinHref}><Video className="h-4 w-4 mr-1" />Join</Link></Button>)
            : <Button disabled variant="outline">{s.payment_status === "pending" ? "Awaiting payment" : "Awaiting confirmation"}</Button>)}
          {s.session_type === "ebo_ritual" && s.ebo && (
            <Button variant="outline" onClick={() => {
              const parent = (data?.rows ?? []).find((x: any) => x.id === s.ebo.session_id) ?? s;
              setWrap({ s: { ...parent, clientName: s.clientName }, tab: "ebo" });
            }}>Ebo</Button>)}
          {s.session_type !== "ebo_ritual" && (s.status === "completed" || s.status === "in_progress" || (isUpcoming && s.status === "confirmed")) && (
            <>
              <Button variant="outline" onClick={() => setWrap({ s, tab: "notes" })}><FileText className="h-4 w-4 mr-1" />Notes</Button>
              <Button variant="outline" onClick={() => setWrap({ s, tab: "ebo" })}>Ebo</Button>
            </>)}
        </div>
      </CardContent></Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold text-gray-800">Sessions</h2>
        <div className="relative sm:w-64"><Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" /><Input className="pl-9" placeholder="Search by client" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      {needNotes > 0 && <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 text-sm text-violet-900">{needNotes} completed session{needNotes > 1 ? "s" : ""} still need notes approved so clients can see them.</div>}
      {eboTodo.length > 0 && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 space-y-2">
          <p className="text-sm font-medium text-orange-900">{eboTodo.length} paid Ebo to perform</p>
          {eboTodo.map((e: any) => (
            <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
              <span>{e.title} · {e.clientName}{e.ritual_at ? ` · ${new Date(e.ritual_at).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}
                {e.attendance === "absent" ? " · video needed" : e.attendance === "present" ? " · client joins live" : ""}</span>
              {e.parent && <Button size="sm" variant="outline" onClick={() => setWrap({ s: e.parent, tab: "ebo" })}>Open</Button>}
            </div>))}
        </div>)}
      {isLoading && <p className="text-gray-500">Loading sessions...</p>}
      {isError && <p className="text-red-600">Could not load sessions. Pull to refresh or try again.</p>}
      <Tabs defaultValue="upcoming">
        <TabsList><TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger><TabsTrigger value="past">Past ({past.length})</TabsTrigger></TabsList>
        <TabsContent value="upcoming" className="space-y-3">{upcoming.length ? upcoming.map(s => <Card1 key={s.id} s={s} isUpcoming />) : <p className="text-gray-500 py-6 text-center">No upcoming sessions.</p>}</TabsContent>
        <TabsContent value="past" className="space-y-3">{past.length ? past.map(s => <Card1 key={s.id} s={s} isUpcoming={false} />) : <p className="text-gray-500 py-6 text-center">No past sessions yet.</p>}</TabsContent>
      </Tabs>
      <ConsultationWrapUp session={wrap?.s ?? null} initialTab={wrap?.tab} onClose={() => setWrap(null)} />
    </div>
  );
};

export default BabalawoSessions;
