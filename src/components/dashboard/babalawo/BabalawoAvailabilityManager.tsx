import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, CalendarOff, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const db = supabase as any;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMEZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Johannesburg", "Europe/London", "Europe/Paris", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo", "Asia/Dubai", "UTC"];
const hhmm = (t: string) => (t ?? "").slice(0, 5);
const today = () => new Date().toISOString().slice(0, 10);

type Slot = { id?: string; day_of_week: number; start_time: string; end_time: string; is_available: boolean };

const WeeklyHours: React.FC<{ userId: string }> = ({ userId }) => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["bab-weekly", userId],
    queryFn: async () => {
      const { data, error } = await db.from("availability").select("*").eq("babalawo_id", userId).order("day_of_week").order("start_time");
      if (error) throw error;
      return data as Slot[];
    },
  });
  const [slots, setSlots] = useState<Slot[]>([]);
  useEffect(() => setSlots((data ?? []).map(s => ({ ...s, start_time: hhmm(s.start_time), end_time: hhmm(s.end_time) }))), [data]);

  const save = useMutation({
    mutationFn: async () => {
      for (const s of slots) {
        if (s.end_time <= s.start_time) throw new Error(`${DAYS[s.day_of_week]}: end time must be after start time`);
      }
      const byDay: Record<number, Slot[]> = {};
      for (const s of slots) (byDay[s.day_of_week] ||= []).push(s);
      for (const list of Object.values(byDay)) {
        const sorted = [...list].sort((a, b) => a.start_time.localeCompare(b.start_time));
        for (let i = 1; i < sorted.length; i++) if (sorted[i].start_time < sorted[i - 1].end_time)
          throw new Error(`${DAYS[sorted[i].day_of_week]} has overlapping hours`);
      }
      const { error: delErr } = await db.from("availability").delete().eq("babalawo_id", userId);
      if (delErr) throw delErr;
      if (slots.length) {
        const { error } = await db.from("availability").insert(slots.map(({ day_of_week, start_time, end_time, is_available }) => ({ babalawo_id: userId, day_of_week, start_time, end_time, is_available })));
        if (error) throw error;
      }
    },
    onSuccess: () => { toast({ title: "Weekly hours saved" }); qc.invalidateQueries({ queryKey: ["bab-weekly", userId] }); },
    onError: (e: any) => { toast({ title: "Could not save", description: e.message, variant: "destructive" }); qc.invalidateQueries({ queryKey: ["bab-weekly", userId] }); },
  });

  const upd = (i: number, patch: Partial<Slot>) => setSlots(s => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = (day: number) => setSlots(s => [...s, { day_of_week: day, start_time: "09:00", end_time: "12:00", is_available: true }]);
  const copyToWeekdays = (day: number) =>
    setSlots(s => {
      const src = s.filter(x => x.day_of_week === day);
      const rest = s.filter(x => ![1, 2, 3, 4, 5].includes(x.day_of_week) || x.day_of_week === day);
      return [...rest, ...[1, 2, 3, 4, 5].filter(d => d !== day).flatMap(d => src.map(x => ({ ...x, id: undefined, day_of_week: d })))];
    });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-4">
      {DAYS.map((name, day) => {
        const rows = slots.map((s, i) => ({ s, i })).filter(r => r.s.day_of_week === day);
        return (
          <div key={day} className="border rounded-field p-3 bg-paper">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{name}</span>
              <div className="flex gap-1">
                {rows.length > 0 && day >= 1 && day <= 5 && <Button size="sm" variant="ghost" onClick={() => copyToWeekdays(day)}>Copy to weekdays</Button>}
                <Button size="sm" variant="outline" onClick={() => add(day)}><Plus className="h-4 w-4 mr-1" />Add hours</Button>
              </div>
            </div>
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Not available</p>}
            {rows.map(({ s, i }) => (
              <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
                <Input type="time" aria-label="Start" value={s.start_time} onChange={e => upd(i, { start_time: e.target.value })} className="w-32" />
                <span>to</span>
                <Input type="time" aria-label="End" value={s.end_time} onChange={e => upd(i, { end_time: e.target.value })} className="w-32" />
                <Switch checked={s.is_available} onCheckedChange={v => upd(i, { is_available: v })} aria-label="Bookable" />
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setSlots(x => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        );
      })}
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full sm:w-auto">{save.isPending ? "Saving..." : "Save weekly hours"}</Button>
    </div>
  );
};

const Exceptions: React.FC<{ userId: string }> = ({ userId }) => {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["bab-exc", userId],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        db.from("availability_exceptions").select("*").eq("babalawo_id", userId).gte("exception_date", today()).order("exception_date"),
        db.from("babalawo_time_off").select("*").eq("babalawo_id", userId).gte("end_date", today()).order("start_date"),
      ]);
      if (a.error) throw a.error; if (b.error) throw b.error;
      return { exc: a.data as any[], off: b.data as any[] };
    },
  }) as any;
  const exc = data.exc ?? [], off = data.off ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["bab-exc", userId] });
  const [e, setE] = useState({ date: today(), kind: "blocked", whole: true, start: "09:00", end: "12:00", reason: "" });
  const [o, setO] = useState({ start: today(), end: today(), reason: "" });

  const addExc = async () => {
    const row: any = { babalawo_id: userId, exception_date: e.date, kind: e.kind, reason: e.reason || null };
    if (e.kind === "extra" || !e.whole) {
      if (e.end <= e.start) return toast({ title: "End time must be after start", variant: "destructive" });
      row.start_time = e.start; row.end_time = e.end;
    }
    const { error } = await db.from("availability_exceptions").insert(row);
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    toast({ title: e.kind === "blocked" ? "Date blocked" : "Extra hours added" }); refresh();
  };
  const addOff = async () => {
    if (o.end < o.start) return toast({ title: "End date must be on or after start", variant: "destructive" });
    const { error } = await db.from("babalawo_time_off").insert({ babalawo_id: userId, start_date: o.start, end_date: o.end, reason: o.reason || null });
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    toast({ title: "Time off added" }); refresh();
  };
  const del = async (table: string, id: string) => { await db.from(table).delete().eq("id", id); refresh(); };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarPlus className="h-4 w-4" />Date exceptions</CardTitle><CardDescription>Block part of a day, or open extra hours on a specific date.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Date</Label><Input type="date" min={today()} value={e.date} onChange={x => setE({ ...e, date: x.target.value })} /></div>
            <div><Label>Type</Label>
              <select className="w-full border rounded-md h-10 px-2" value={e.kind} onChange={x => setE({ ...e, kind: x.target.value })}>
                <option value="blocked">Block</option><option value="extra">Extra hours</option>
              </select></div>
          </div>
          {e.kind === "blocked" && <label className="flex items-center gap-2 text-sm"><Switch checked={e.whole} onCheckedChange={v => setE({ ...e, whole: v })} />Whole day</label>}
          {(e.kind === "extra" || !e.whole) && (
            <div className="flex items-center gap-2"><Input type="time" value={e.start} onChange={x => setE({ ...e, start: x.target.value })} /><span>to</span><Input type="time" value={e.end} onChange={x => setE({ ...e, end: x.target.value })} /></div>
          )}
          <Input placeholder="Reason (optional, private)" value={e.reason} onChange={x => setE({ ...e, reason: x.target.value })} />
          <Button onClick={addExc} className="w-full">Add</Button>
          <ul className="divide-y">
            {exc.map((x: any) => (
              <li key={x.id} className="py-2 flex items-center justify-between text-sm">
                <span>{x.exception_date} · {x.kind === "blocked" ? "Blocked" : "Extra"} {x.start_time ? `${hhmm(x.start_time)}-${hhmm(x.end_time)}` : "(all day)"}{x.reason ? ` · ${x.reason}` : ""}</span>
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => del("availability_exceptions", x.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarOff className="h-4 w-4" />Time off</CardTitle><CardDescription>Festivals, travel or rest. No bookings are offered in these ranges.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>From</Label><Input type="date" min={today()} value={o.start} onChange={x => setO({ ...o, start: x.target.value, end: o.end < x.target.value ? x.target.value : o.end })} /></div>
            <div><Label>To</Label><Input type="date" min={o.start} value={o.end} onChange={x => setO({ ...o, end: x.target.value })} /></div>
          </div>
          <Input placeholder="Reason (optional, private)" value={o.reason} onChange={x => setO({ ...o, reason: x.target.value })} />
          <Button onClick={addOff} className="w-full">Add time off</Button>
          <ul className="divide-y">
            {off.map((x: any) => (
              <li key={x.id} className="py-2 flex items-center justify-between text-sm">
                <span>{x.start_date} to {x.end_date}{x.reason ? ` · ${x.reason}` : ""}</span>
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => del("babalawo_time_off", x.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

const Preferences: React.FC<{ userId: string }> = ({ userId }) => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["bab-sched-settings", userId],
    queryFn: async () => (await db.from("babalawo_scheduling_settings").select("*").eq("babalawo_id", userId).maybeSingle()).data,
  }) as any;
  const [f, setF] = useState({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos", slot_minutes: 60, buffer_minutes: 0, min_notice_hours: 2, max_advance_days: 60, accepting_bookings: true });
  useEffect(() => { if (data) setF({ ...f, ...data }); /* eslint-disable-next-line */ }, [data]);
  const zones = TIMEZONES.includes(f.timezone) ? TIMEZONES : [f.timezone, ...TIMEZONES];
  const save = async () => {
    const { error } = await db.from("babalawo_scheduling_settings").upsert({ babalawo_id: userId, ...f, updated_at: new Date().toISOString() });
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    await db.from("babalawos").update({ timezone: f.timezone }).eq("user_id", userId); // best effort
    toast({ title: "Scheduling preferences saved" }); qc.invalidateQueries({ queryKey: ["bab-sched-settings", userId] });
  };
  const num = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(ev.target.value) });
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <Card><CardContent className="pt-6 space-y-4 max-w-xl">
      <label className="flex items-center justify-between border rounded-field p-3">
        <span><span className="font-medium block">Accepting new bookings</span><span className="text-sm text-muted-foreground">Turn off to pause all bookings without deleting your hours.</span></span>
        <Switch checked={f.accepting_bookings} onCheckedChange={v => setF({ ...f, accepting_bookings: v })} />
      </label>
      <div><Label>Timezone</Label>
        <select className="w-full border rounded-md h-10 px-2" value={f.timezone} onChange={e => setF({ ...f, timezone: e.target.value })}>{zones.map(z => <option key={z}>{z}</option>)}</select>
        <p className="text-xs text-muted-foreground mt-1">Your weekly hours are in this timezone. Clients see times in their own.</p></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Session length (min)</Label><Input type="number" min={15} max={240} step={15} value={f.slot_minutes} onChange={num("slot_minutes")} /></div>
        <div><Label>Buffer between (min)</Label><Input type="number" min={0} max={120} step={5} value={f.buffer_minutes} onChange={num("buffer_minutes")} /></div>
        <div><Label>Minimum notice (hours)</Label><Input type="number" min={0} max={168} value={f.min_notice_hours} onChange={num("min_notice_hours")} /></div>
        <div><Label>Book up to (days ahead)</Label><Input type="number" min={1} max={365} value={f.max_advance_days} onChange={num("max_advance_days")} /></div>
      </div>
      <Button onClick={save}>Save preferences</Button>
    </CardContent></Card>
  );
};

const BabalawoAvailabilityManager: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-4">
      <Tabs defaultValue="weekly">
        <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-grid">
          <TabsTrigger value="weekly">Weekly hours</TabsTrigger><TabsTrigger value="exceptions">Exceptions & time off</TabsTrigger><TabsTrigger value="prefs">Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="weekly"><WeeklyHours userId={user.id} /></TabsContent>
        <TabsContent value="exceptions"><Exceptions userId={user.id} /></TabsContent>
        <TabsContent value="prefs"><Preferences userId={user.id} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default BabalawoAvailabilityManager;
