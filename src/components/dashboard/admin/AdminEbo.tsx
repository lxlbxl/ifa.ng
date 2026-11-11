import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, Loader2, Plus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EboProofs from "@/components/ebo/EboProofs";
import { eboApi, KIND_LABEL, naira, statusLabel, STATUS_STYLE, when, type CatalogItem, type Ebo } from "@/lib/ebo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const fail = (e: unknown) => toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" });

type Row = Ebo & { flags?: { overdue: boolean; price_outliers: number } };
type Filter = "attention" | "active" | "awaiting" | "all";

const SETTINGS = [
  { key: "ebo_platform_fee_percent", label: "Platform fee (%)", hint: "Added on top of the Ebo total. Locked into each quote when it is sent." },
  { key: "ebo_quote_expiry_days", label: "Days to pay a quote", hint: "After this the quote expires and the Babalawo can renew it." },
  { key: "ebo_confirm_hours", label: "Hours to confirm after proof", hint: "Then the money is released automatically unless the client reports a problem." },
  { key: "ebo_max_total", label: "Largest Ebo (₦)", hint: "" },
];

const Detail: React.FC<{ e: Row; names: Record<string, string>; refresh: () => void }> = ({ e, names, refresh }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: events = [] } = useQuery({
    queryKey: ["ebo-events", e.id],
    queryFn: async () => (await db.from("ebo_events").select("*").eq("prescription_id", e.id).order("created_at")).data ?? [],
  });
  const resolve = async (action: "release" | "refund_full" | "refund_held") => {
    setBusy(true);
    try { await eboApi.adminResolve(e.id, action, note); toast({ title: "Done" }); refresh(); } catch (err) { fail(err); } finally { setBusy(false); }
  };
  const held = Math.max(0, Number(e.babalawo_amount ?? 0) - Number(e.items_released) - Number(e.refunded_amount));
  return (
    <div className="space-y-3 border-t pt-3 text-sm">
      <ul>{[...(e.ebo_items ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((i) => (
        <li key={i.id} className="flex justify-between"><span>{Number(i.quantity)} × {i.name}</span><span className="tabular-nums">{naira(i.unit_price)} each · {naira(i.line_total)}</span></li>))}</ul>
      <p className="text-gray-600">Owó Ifá {naira(e.owo_ifa)} · Babalawo {naira(e.total)} · fee {naira(e.platform_fee)} ({Number(e.platform_fee_percent)}%) · client pays {naira(e.amount_due)}</p>
      {e.paid_at && <p className="text-gray-600">Released for items {naira(e.items_released)} · still held {naira(held)}{Number(e.refunded_amount) ? ` · refunded ${naira(e.refunded_amount)}` : ""}</p>}
      <EboProofs eboId={e.id} />
      <ol className="text-xs text-gray-600 space-y-0.5 border-l pl-3">
        {events.map((ev: { id: string; event: string; created_at: string; data: Record<string, unknown> }) => (
          <li key={ev.id}><span className="text-gray-400">{when(ev.created_at)}</span> · {ev.event.replace(/_/g, " ")}
            {typeof ev.data?.reason === "string" && ev.data.reason ? `: ${ev.data.reason}` : ""}
            {typeof ev.data?.note === "string" && ev.data.note ? `: ${ev.data.note}` : ""}</li>))}
      </ol>
      {["paid", "in_progress", "performed", "disputed"].includes(e.status) && (
        <div className="space-y-2 rounded-lg bg-gray-50 p-3">
          <Label>Resolution note (required, kept in the log)</Label>
          <Input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="What you checked and why" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => resolve("release")}>Release to {names[e.babalawo_id] || "Babalawo"}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => resolve("refund_held")}>Refund what's held ({naira(held)})</Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => resolve("refund_full")}>Refund in full ({naira(Number(e.amount_due) - Number(e.refunded_amount))})</Button>
          </div>
          <p className="text-xs text-gray-500">A full refund takes back item money already released. It fails if the Babalawo has withdrawn it; refund what's held instead.</p>
        </div>)}
    </div>
  );
};

const EboList: React.FC = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("attention");
  const [open, setOpen] = useState<string | null>(null);
  const { data: summary } = useQuery({ queryKey: ["admin-ebo-summary"], queryFn: eboApi.adminSummary });
  const { data, isLoading } = useQuery({
    queryKey: ["admin-ebo"],
    queryFn: async () => {
      const [list, flags] = await Promise.all([
        db.from("ebo_prescriptions").select("*, ebo_items(*)").neq("status", "draft").order("updated_at", { ascending: false }).limit(300),
        db.from("ebo_flags").select("*"),
      ]);
      if (list.error) throw new Error(list.error.message);
      const f = new Map<string, Row["flags"]>((flags.data ?? []).map((x: { id: string; overdue: boolean; price_outliers: number }) => [x.id, x]));
      const rows: Row[] = (list.data ?? []).map((e: Ebo) => ({ ...e, flags: f.get(e.id) }));
      const ids = [...new Set(rows.flatMap((r) => [r.babalawo_id, r.client_id]))];
      const names: Record<string, string> = {};
      if (ids.length) (await db.from("profiles").select("id, full_name").in("id", ids)).data?.forEach((p: { id: string; full_name: string }) => (names[p.id] = p.full_name));
      return { rows, names };
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-ebo"] }); qc.invalidateQueries({ queryKey: ["admin-ebo-summary"] }); };
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => {
    if (filter === "attention") return r.status === "disputed" || r.flags?.overdue || ((r.flags?.price_outliers ?? 0) > 0 && !["cancelled", "declined", "expired"].includes(r.status));
    if (filter === "active") return ["paid", "in_progress", "performed"].includes(r.status);
    if (filter === "awaiting") return r.status === "sent" && r.performed_by === "babalawo";
    return true;
  }), [data, filter]);

  const tiles: [string, string][] = summary ? [
    ["Held for Babalawos", naira(summary.held_for_babalawos)],
    ["Platform fees earned", naira(summary.platform_fee_total)],
    ["Awaiting payment", `${summary.awaiting_payment} · ${naira(summary.awaiting_payment_value)}`],
    ["In progress", String(summary.in_flight)],
    ["Disputes", String(summary.disputed)],
    ["Overdue", String(summary.overdue)],
  ] : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {tiles.map(([k, v]) => <Card key={k}><CardContent className="p-3"><p className="text-xs text-gray-500">{k}</p><p className="text-lg font-semibold tabular-nums">{v}</p></CardContent></Card>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {([["attention", "Needs attention"], ["active", "Paid, not finished"], ["awaiting", "Awaiting payment"], ["all", "All"]] as [Filter, string][]).map(([k, label]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{label}</Button>))}
      </div>
      {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
      {!isLoading && rows.length === 0 && <p className="text-gray-500 py-6 text-center">Nothing here.</p>}
      {rows.map((e) => (
        <Card key={e.id}><CardContent className="p-3 space-y-2">
          <button className="w-full text-left" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium mr-1">{e.title}</span>
              <Badge variant="outline">{KIND_LABEL[e.kind]}</Badge>
              <Badge className={STATUS_STYLE[e.status]}>{statusLabel(e)}</Badge>
              {e.flags?.overdue && <Badge className="bg-red-100 text-red-800"><Clock className="h-3 w-3 mr-1" />Overdue</Badge>}
              {(e.flags?.price_outliers ?? 0) > 0 && <Badge className="bg-amber-100 text-amber-800"><AlertTriangle className="h-3 w-3 mr-1" />{e.flags!.price_outliers} price{e.flags!.price_outliers > 1 ? "s" : ""} outside the usual range</Badge>}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {data?.names[e.babalawo_id] || "Babalawo"} → {data?.names[e.client_id] || "Client"}
              {e.performed_by === "babalawo" ? ` · ${naira(e.amount_due)}` : " · client performs"}
              {e.ritual_at ? ` · ritual ${when(e.ritual_at)}${e.attendance ? ` (${e.attendance})` : ""}` : ""}
              {e.due_date ? ` · due ${e.due_date}` : ""}
            </p>
          </button>
          {open === e.id && <Detail e={e} names={data?.names ?? {}} refresh={refresh} />}
        </CardContent></Card>))}
    </div>
  );
};

const Catalogue: React.FC = () => {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["ebo-catalog-admin"], queryFn: () => eboApi.catalog(true) });
  const [edits, setEdits] = useState<Record<string, Partial<CatalogItem>>>({});
  const [draft, setDraft] = useState({ name: "", english_name: "", unit: "", min_price: "", max_price: "" });
  const num = (v: unknown) => (v === "" || v == null ? null : Number(v));
  const save = async (c: CatalogItem) => {
    const e = edits[c.id];
    if (!e) return;
    const { error } = await db.from("ebo_catalog_items").update({ ...e, min_price: num(e.min_price ?? c.min_price), max_price: num(e.max_price ?? c.max_price), updated_at: new Date().toISOString() }).eq("id", c.id);
    if (error) return fail(error);
    setEdits(({ [c.id]: _, ...rest }) => rest);
    qc.invalidateQueries({ queryKey: ["ebo-catalog-admin"] }); qc.invalidateQueries({ queryKey: ["ebo-catalog"] });
    toast({ title: "Saved" });
  };
  const add = async () => {
    if (!draft.name.trim()) return;
    const { error } = await db.from("ebo_catalog_items").insert({
      name: draft.name.trim(), english_name: draft.english_name || null, unit: draft.unit || null,
      min_price: num(draft.min_price), max_price: num(draft.max_price), position: 1000,
    });
    if (error) return fail(error);
    setDraft({ name: "", english_name: "", unit: "", min_price: "", max_price: "" });
    qc.invalidateQueries({ queryKey: ["ebo-catalog-admin"] }); qc.invalidateQueries({ queryKey: ["ebo-catalog"] });
  };
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">Babalawos pick from this list. Prices outside the usual range are flagged for you, never blocked.</p>
      <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-gray-500 px-1">
        <span className="col-span-3">Item</span><span className="col-span-3">English</span><span className="col-span-1">Unit</span>
        <span className="col-span-2">Usual from (₦)</span><span className="col-span-2">Usual to (₦)</span><span className="col-span-1">On</span>
      </div>
      {items.map((c) => {
        const e = { ...c, ...edits[c.id] };
        const set = (k: keyof CatalogItem, v: unknown) => setEdits((p) => ({ ...p, [c.id]: { ...p[c.id], [k]: v } }));
        return (
          <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
            <Input className="col-span-6 md:col-span-3" aria-label="Item" value={e.name} onChange={(v) => set("name", v.target.value)} />
            <Input className="col-span-6 md:col-span-3" aria-label="English" value={e.english_name ?? ""} onChange={(v) => set("english_name", v.target.value)} />
            <Input className="col-span-3 md:col-span-1" aria-label="Unit" value={e.unit ?? ""} onChange={(v) => set("unit", v.target.value)} />
            <Input className="col-span-3 md:col-span-2" aria-label="Usual from" type="number" min={0} value={e.min_price ?? ""} onChange={(v) => set("min_price", v.target.value)} />
            <Input className="col-span-3 md:col-span-2" aria-label="Usual to" type="number" min={0} value={e.max_price ?? ""} onChange={(v) => set("max_price", v.target.value)} />
            <div className="col-span-3 md:col-span-1 flex items-center gap-1">
              <input type="checkbox" aria-label="Active" checked={!!e.active} onChange={(v) => set("active", v.target.checked)} />
              {edits[c.id] && <Button size="icon" variant="ghost" aria-label="Save" onClick={() => save(c)}><Save className="h-4 w-4" /></Button>}
            </div>
          </div>);
      })}
      <div className="grid grid-cols-12 gap-2 items-center pt-2 border-t">
        <Input className="col-span-6 md:col-span-3" placeholder="New item" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v.target.value })} />
        <Input className="col-span-6 md:col-span-3" placeholder="English" value={draft.english_name} onChange={(v) => setDraft({ ...draft, english_name: v.target.value })} />
        <Input className="col-span-3 md:col-span-1" placeholder="Unit" value={draft.unit} onChange={(v) => setDraft({ ...draft, unit: v.target.value })} />
        <Input className="col-span-3 md:col-span-2" placeholder="From" type="number" value={draft.min_price} onChange={(v) => setDraft({ ...draft, min_price: v.target.value })} />
        <Input className="col-span-3 md:col-span-2" placeholder="To" type="number" value={draft.max_price} onChange={(v) => setDraft({ ...draft, max_price: v.target.value })} />
        <Button className="col-span-3 md:col-span-1" size="sm" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

const EboSettings: React.FC = () => {
  const qc = useQueryClient();
  const { data = {} } = useQuery({
    queryKey: ["ebo-settings"],
    queryFn: async () => {
      const r = await db.from("admin_settings").select("setting_key, setting_value").in("setting_key", SETTINGS.map((s) => s.key));
      return Object.fromEntries((r.data ?? []).map((x: { setting_key: string; setting_value: string }) => [x.setting_key, x.setting_value])) as Record<string, string>;
    },
  });
  const [vals, setVals] = useState<Record<string, string>>({});
  const save = async (key: string) => {
    const v = vals[key];
    if (v == null || v === "" || Number.isNaN(Number(v)) || Number(v) < 0 || (key === "ebo_platform_fee_percent" && Number(v) > 100)) return fail(new Error("Enter a valid number"));
    const { error } = await db.from("admin_settings").update({ setting_value: String(Number(v)) }).eq("setting_key", key);
    if (error) return fail(error);
    toast({ title: "Saved. New quotes use it from now on." });
    qc.invalidateQueries({ queryKey: ["ebo-settings"] }); qc.invalidateQueries({ queryKey: ["ebo-fee"] });
  };
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {SETTINGS.map((s) => (
        <div key={s.key} className="space-y-1">
          <Label htmlFor={s.key}>{s.label}</Label>
          <div className="flex gap-2">
            <Input id={s.key} type="number" min={0} value={vals[s.key] ?? data[s.key] ?? ""} onChange={(e) => setVals({ ...vals, [s.key]: e.target.value })} />
            <Button variant="outline" disabled={vals[s.key] == null} onClick={() => save(s.key)}>Save</Button>
          </div>
          {s.hint && <p className="text-xs text-gray-500">{s.hint}</p>}
        </div>))}
    </div>
  );
};

/** Admin oversight of every Ebo: money held, disputes, overdue rituals, price outliers, catalogue and fee. */
const AdminEbo: React.FC = () => (
  <Tabs defaultValue="list" className="space-y-4">
    <TabsList><TabsTrigger value="list">Ebo</TabsTrigger><TabsTrigger value="catalogue">Item catalogue</TabsTrigger><TabsTrigger value="settings">Fee and timings</TabsTrigger></TabsList>
    <TabsContent value="list"><EboList /></TabsContent>
    <TabsContent value="catalogue"><Card><CardHeader><CardTitle className="text-base">Item catalogue</CardTitle></CardHeader><CardContent><Catalogue /></CardContent></Card></TabsContent>
    <TabsContent value="settings"><Card><CardHeader><CardTitle className="text-base">Fee and timings</CardTitle></CardHeader><CardContent><EboSettings /></CardContent></Card></TabsContent>
  </Tabs>
);

export default AdminEbo;
