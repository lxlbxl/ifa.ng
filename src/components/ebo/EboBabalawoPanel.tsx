import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CalendarClock, Loader2, Plus, Trash2, Upload, Video, UserCheck, UserX } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import EboProofs from "./EboProofs";
import {
  eboApi, fromLocalInput, KIND_LABEL, naira, statusLabel, STATUS_STYLE, sumItems, toLocalInput, when,
  type CatalogItem, type Ebo, type EboItem,
} from "@/lib/ebo";

const fail = (e: unknown) => toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" });

interface FormState {
  kind: Ebo["kind"]; title: string; description: string; performedBy: Ebo["performed_by"];
  ritualAt: string; ritualMinutes: number; dueDate: string; owoIfa: string; items: EboItem[]; reason: string;
}
const blankItem = (): EboItem => ({ name: "", quantity: 1, unit: "", unit_price: 0, catalog_item_id: null });
const fromEbo = (e?: Ebo): FormState => ({
  kind: e?.kind ?? "ebo", title: e?.title ?? "", description: e?.description ?? "", performedBy: e?.performed_by ?? "babalawo",
  ritualAt: toLocalInput(e?.ritual_at), ritualMinutes: e?.ritual_minutes ?? 60, dueDate: e?.due_date ?? "",
  owoIfa: e && e.owo_ifa ? String(e.owo_ifa) : "", reason: "",
  items: e?.ebo_items?.length
    ? [...e.ebo_items].map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price) }))
    : [blankItem()],
});

/** Build or change a quote. mode "revise" changes a sent quote and needs a reason the client sees. */
const EboForm: React.FC<{
  sessionId: number; ebo?: Ebo; mode: "draft" | "revise"; catalog: CatalogItem[]; feePct: number; onDone: () => void;
}> = ({ sessionId, ebo, mode, catalog, feePct, onDone }) => {
  const [f, setF] = useState<FormState>(() => fromEbo(ebo));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const setItem = (i: number, patch: Partial<EboItem>) => setF((p) => ({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const byName = useMemo(() => new Map(catalog.map((c) => [c.name.toLowerCase(), c])), [catalog]);
  const paidByClient = f.performedBy === "babalawo";
  const itemsTotal = sumItems(f.items);
  const owo = paidByClient ? Number(f.owoIfa) || 0 : 0;
  const total = itemsTotal + owo;
  const fee = Math.round(total * feePct) / 100;

  const save = useMutation({
    mutationFn: async (send: boolean) => {
      if (mode === "revise" && ebo) {
        await eboApi.revise(ebo.id, owo, f.items, f.dueDate || null, f.reason, fromLocalInput(f.ritualAt));
        return;
      }
      const id = await eboApi.saveDraft({
        id: ebo?.id, sessionId, kind: f.kind, title: f.title, description: f.description, performedBy: f.performedBy,
        dueDate: f.dueDate || null, owoIfa: owo, items: f.items, ritualAt: paidByClient ? fromLocalInput(f.ritualAt) : null,
        ritualMinutes: f.ritualMinutes,
      });
      if (send) await eboApi.send(id);
    },
    onSuccess: (_, send) => {
      toast({ title: mode === "revise" ? "Updated quote sent to the client" : send ? "Sent to the client" : "Draft saved" });
      onDone();
    },
    onError: fail,
  });

  const range = (it: EboItem) => {
    const c = it.catalog_item_id ? catalog.find((x) => x.id === it.catalog_item_id) : undefined;
    if (!c || (c.min_price == null && c.max_price == null)) return null;
    const out = (c.max_price != null && it.unit_price > c.max_price) || (c.min_price != null && it.unit_price > 0 && it.unit_price < c.min_price);
    return <span className={out ? "text-amber-700" : "text-gray-500"}>Usual {c.min_price != null ? naira(c.min_price) : "?"}–{c.max_price != null ? naira(c.max_price) : "?"}</span>;
  };

  return (
    <div className="border rounded-xl p-3 space-y-3 bg-gray-50">
      {mode === "draft" && (
        <>
          <div className="grid sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2"><Label htmlFor="ebo-title">Title</Label><Input id="ebo-title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Ebo for open roads" /></div>
            <div><Label htmlFor="ebo-kind">Type</Label>
              <select id="ebo-kind" className="w-full border rounded-md h-10 px-2 bg-white" value={f.kind} onChange={(e) => set("kind", e.target.value as Ebo["kind"])}>
                <option value="ebo">Ebo</option><option value="etutu">Etutu</option><option value="other">Other offering</option>
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Who performs it">
            {(["babalawo", "client"] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={f.performedBy === v} onClick={() => set("performedBy", v)}
                className={`text-left rounded-lg border p-2 text-sm ${f.performedBy === v ? "border-primary bg-white ring-1 ring-primary" : "bg-white"}`}>
                <span className="font-medium block">{v === "babalawo" ? "I perform it" : "Client does it"}</span>
                <span className="text-gray-500 text-xs">{v === "babalawo" ? "Client pays in the app" : "Guidance only, no payment"}</span>
              </button>))}
          </div>
          <div><Label htmlFor="ebo-desc">Instructions</Label><Textarea id="ebo-desc" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
        </>
      )}

      {paidByClient && (
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2"><Label htmlFor="ebo-ritual">Ritual date and time</Label>
            <Input id="ebo-ritual" type="datetime-local" value={f.ritualAt} onChange={(e) => set("ritualAt", e.target.value)} /></div>
          <div><Label htmlFor="ebo-len">Length</Label>
            <select id="ebo-len" className="w-full border rounded-md h-10 px-2 bg-white" value={f.ritualMinutes} disabled={mode === "revise"}
              onChange={(e) => set("ritualMinutes", Number(e.target.value))}>
              {[30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
            </select></div>
          <p className="sm:col-span-3 text-xs text-gray-500">The client accepts this time when they pay, and chooses to join live or not. Joining is free.</p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Items</Label>
        <p className="text-xs text-gray-500 -mt-1">Pick from the list or type your own, then the quantity and {paidByClient ? "the price for one" : "a rough cost for one"}.</p>
        <datalist id="ebo-catalog">{catalog.map((c) => <option key={c.id} value={c.name}>{c.english_name ?? ""}</option>)}</datalist>
        {f.items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-1.5 items-start">
            <div className="col-span-12 sm:col-span-5">
              <Input list="ebo-catalog" aria-label="Item" placeholder="Item" value={it.name} onChange={(e) => {
                const c = byName.get(e.target.value.toLowerCase());
                setItem(i, { name: e.target.value, catalog_item_id: c?.id ?? null, unit: c?.unit ?? it.unit });
              }} />
              <p className="text-xs mt-0.5">{range(it)}</p>
            </div>
            <Input className="col-span-3 sm:col-span-2" aria-label="Quantity" type="number" min={1} step="any" value={it.quantity}
              onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} />
            <Input className="col-span-4 sm:col-span-2" aria-label={paidByClient ? "Price each (₦)" : "Rough cost each (₦)"} type="number" min={0}
              placeholder="₦ each" value={it.unit_price || ""} onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })} />
            <p className="col-span-3 sm:col-span-2 text-sm text-right pt-2 tabular-nums">{naira((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}</p>
            <Button className="col-span-2 sm:col-span-1" size="icon" variant="ghost" aria-label="Remove item"
              onClick={() => setF((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></Button>
          </div>))}
        <Button size="sm" variant="outline" onClick={() => setF((p) => ({ ...p, items: [...p.items, blankItem()] }))}><Plus className="h-4 w-4 mr-1" />Add item</Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {paidByClient && <div><Label htmlFor="ebo-owo">Owó Ifá (₦)</Label><Input id="ebo-owo" type="number" min={0} value={f.owoIfa} onChange={(e) => set("owoIfa", e.target.value)} /></div>}
        <div><Label htmlFor="ebo-due">Complete by (optional)</Label><Input id="ebo-due" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
      </div>

      {paidByClient && (
        <dl className="text-sm bg-white rounded-lg border p-3 grid grid-cols-2 gap-y-1">
          <dt className="text-gray-600">Items</dt><dd className="text-right tabular-nums">{naira(itemsTotal)}</dd>
          <dt className="text-gray-600">Owó Ifá</dt><dd className="text-right tabular-nums">{naira(owo)}</dd>
          <dt className="font-medium">You receive</dt><dd className="text-right font-medium tabular-nums">{naira(total)}</dd>
          <dt className="text-gray-600">Platform fee ({feePct}%)</dt><dd className="text-right tabular-nums">{naira(fee)}</dd>
          <dt className="font-semibold">Client pays</dt><dd className="text-right font-semibold tabular-nums">{naira(total + fee)}</dd>
        </dl>
      )}

      {mode === "revise" && (
        <div><Label htmlFor="ebo-reason">Why is the quote changing? (the client sees this)</Label>
          <Input id="ebo-reason" value={f.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Moved to Saturday as you asked" /></div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Close</Button>
        {mode === "draft" && <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate(false)}>Save draft</Button>}
        <Button disabled={save.isPending} onClick={() => save.mutate(true)}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{mode === "revise" ? "Send updated quote" : "Send to client"}
        </Button>
      </div>
    </div>
  );
};

/** Actions on a paid Ebo: start (releases item money), move the time, add proof, mark performed. */
const PaidActions: React.FC<{ e: Ebo; clientName?: string; refresh: () => void }> = ({ e, clientName, refresh }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [moving, setMoving] = useState(false);
  const [newTime, setNewTime] = useState(toLocalInput(e.ritual_at));
  const [why, setWhy] = useState("");
  const qc = useQueryClient();
  const run = (p: Promise<unknown>, ok: string) => p.then(() => { toast({ title: ok }); refresh(); }).catch(fail);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      await eboApi.uploadProof(e.id, file);
      toast({ title: file.type.startsWith("video/") ? "Video uploaded. We are compressing it for the client." : "Photo added" });
      qc.invalidateQueries({ queryKey: ["ebo-proofs", e.id] });
    } catch (err) { fail(err); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const absent = e.attendance !== "present";
  return (
    <div className="space-y-3">
      <div className={`rounded-lg p-2 text-sm flex gap-2 ${absent ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
        {absent ? <UserX className="h-4 w-4 mt-0.5 shrink-0" /> : <UserCheck className="h-4 w-4 mt-0.5 shrink-0" />}
        <span>{absent
          ? <>The client will not attend. Record a video of the ritual: show every item and say the prayers using <strong>{clientName || "the client"}</strong>'s name.</>
          : <>The client will join live. The ritual is in your Sessions list with a Join button.</>}</span>
      </div>
      <EboProofs eboId={e.id} />
      <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={(ev) => upload(ev.target.files?.[0])} />
      <div className="flex flex-wrap gap-2">
        {e.status === "paid" && <Button size="sm" variant="outline" onClick={() => run(eboApi.start(e.id), `Started. ${naira(Math.min(e.items_total, e.babalawo_amount ?? 0))} for items is in your balance.`)}>Mark started</Button>}
        <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : absent ? <Video className="h-4 w-4 mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
          {uploading ? "Uploading… keep this open" : absent ? "Upload ritual video" : "Add photo or video"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMoving((m) => !m)}><CalendarClock className="h-4 w-4 mr-1" />Move time</Button>
      </div>
      {moving && (
        <div className="grid sm:grid-cols-3 gap-2 items-end">
          <div><Label htmlFor={`ebo-move-${e.id}`}>New time</Label><Input id={`ebo-move-${e.id}`} type="datetime-local" value={newTime} onChange={(ev) => setNewTime(ev.target.value)} /></div>
          <div><Label htmlFor={`ebo-why-${e.id}`}>Reason</Label><Input id={`ebo-why-${e.id}`} value={why} onChange={(ev) => setWhy(ev.target.value)} /></div>
          <Button size="sm" onClick={() => run(eboApi.reschedule(e.id, fromLocalInput(newTime)!, why), "Ritual moved. The client has been told.").then(() => setMoving(false))}>Save time</Button>
        </div>)}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Note for the client (optional)" />
        <Button size="sm" onClick={() => run(eboApi.performed(e.id, note), "Marked performed. The client will confirm.")}>Mark performed</Button>
      </div>
    </div>
  );
};

const EboCard: React.FC<{ e: Ebo; clientName?: string; catalog: CatalogItem[]; feePct: number; sessionId: number; refresh: () => void }> = ({ e, clientName, catalog, feePct, sessionId, refresh }) => {
  const [editing, setEditing] = useState<"draft" | "revise" | null>(null);
  const run = (p: Promise<unknown>, ok: string) => p.then(() => { toast({ title: ok }); refresh(); }).catch(fail);
  const askReason = (q: string) => window.prompt(q)?.trim();
  if (editing) return <EboForm sessionId={sessionId} ebo={e} mode={editing} catalog={catalog} feePct={feePct} onDone={() => { setEditing(null); refresh(); }} />;
  const paid = e.performed_by === "babalawo";
  return (
    <div className="border rounded-xl p-3 space-y-2 bg-white">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="font-medium mr-1">{e.title}</p>
        <Badge variant="outline">{KIND_LABEL[e.kind]}</Badge>
        <Badge className={STATUS_STYLE[e.status]}>{statusLabel(e)}</Badge>
        {e.ai_suggested && e.status === "draft" && <Badge className="bg-violet-100 text-violet-800"><Bot className="h-3 w-3 mr-1" />From the recording: check items, add prices</Badge>}
      </div>
      {e.ebo_items?.length ? (
        <ul className="text-sm text-gray-700">
          {[...e.ebo_items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((i) => (
            <li key={i.id} className="flex justify-between gap-2"><span>{Number(i.quantity)} × {i.name}{i.unit ? ` (${i.unit})` : ""}</span>{paid && <span className="tabular-nums">{naira(i.line_total)}</span>}</li>))}
        </ul>) : null}
      {paid && (
        <p className="text-sm text-gray-600">
          Owó Ifá {naira(e.owo_ifa)} · you receive <strong>{naira(e.total)}</strong> · client pays {naira(e.status === "draft" ? e.total * (1 + feePct / 100) : e.amount_due)}
        </p>)}
      {e.ritual_at && <p className="text-sm text-gray-600"><CalendarClock className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />Ritual {when(e.ritual_at)}{e.attendance ? ` · client ${e.attendance === "present" ? "joins live" : "absent"}` : ""}</p>}
      {e.status === "sent" && e.expires_at && paid && <p className="text-xs text-gray-500">Quote open until {when(e.expires_at)}</p>}
      {e.status === "performed" && e.confirm_by && <p className="text-xs text-gray-500">Released to you when the client confirms, or automatically {when(e.confirm_by)}.</p>}
      {e.status === "disputed" && <p className="text-sm text-red-700">The client reported a problem. The money is held while IFA reviews it.</p>}
      {e.status === "declined" && e.decline_reason && <p className="text-sm text-gray-600">Client said: {e.decline_reason}</p>}

      {(e.status === "paid" || e.status === "in_progress") && <PaidActions e={e} clientName={clientName} refresh={refresh} />}
      {(e.status === "performed" || e.status === "completed" || e.status === "disputed") && <EboProofs eboId={e.id} />}

      <div className="flex flex-wrap gap-2 pt-1">
        {e.status === "draft" && <>
          <Button size="sm" variant="outline" onClick={() => setEditing("draft")}>Edit</Button>
          <Button size="sm" onClick={() => run(eboApi.send(e.id), "Sent to the client")}>Send to client</Button>
          <Button size="sm" variant="ghost" onClick={() => run(eboApi.deleteDraft(e.id), "Draft deleted")}>Delete</Button>
        </>}
        {(e.status === "sent" || e.status === "expired") && <>
          {paid && <Button size="sm" variant="outline" onClick={() => setEditing("revise")}>{e.status === "expired" ? "Renew quote" : "Change quote"}</Button>}
          <Button size="sm" variant="ghost" onClick={() => { const r = askReason("Why are you withdrawing this Ebo?"); if (r !== undefined) run(eboApi.cancel(e.id, r), "Withdrawn"); }}>Withdraw</Button>
        </>}
        {e.status === "paid" && (
          <Button size="sm" variant="ghost" onClick={() => { const r = askReason("Cancel and refund the client in full. Reason?"); if (r) run(eboApi.cancel(e.id, r), "Cancelled. The client has been refunded."); }}>Cancel and refund</Button>)}
      </div>
    </div>
  );
};

/** The Babalawo's Ebo list for one consultation, during or after the session. */
const EboBabalawoPanel: React.FC<{ session: { id: number; clientName?: string } }> = ({ session }) => {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: list = [], isLoading } = useQuery({ queryKey: ["ebo", session.id], queryFn: () => eboApi.listForSession(session.id) });
  const { data: catalog = [] } = useQuery({ queryKey: ["ebo-catalog"], queryFn: () => eboApi.catalog(), staleTime: 600_000 });
  const { data: feePct = 10 } = useQuery({ queryKey: ["ebo-fee"], queryFn: eboApi.feePercent, staleTime: 600_000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ebo", session.id] }); qc.invalidateQueries({ queryKey: ["bab-sessions"] }); };
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">List the items and your Owó Ifá, and propose a date and time for the ritual. The client sees it when you send it, pays in the app, and the money is held until the ritual is done.</p>
      {list.map((e) => <EboCard key={e.id} e={e} clientName={session.clientName} catalog={catalog} feePct={feePct} sessionId={session.id} refresh={refresh} />)}
      {adding
        ? <EboForm sessionId={session.id} mode="draft" catalog={catalog} feePct={feePct} onDone={() => { setAdding(false); refresh(); }} />
        : <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />New Ebo</Button>}
    </div>
  );
};

export default EboBabalawoPanel;
