import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Circle, Loader2, UserCheck, UserX, Wallet, CreditCard } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import EboProofs from "./EboProofs";
import { eboApi, KIND_LABEL, naira, statusLabel, STATUS_STYLE, when, type Ebo } from "@/lib/ebo";
import type { PaymentGateway } from "@/utils/paymentGatewayUtils";

const fail = (e: unknown) => toast({ title: "Something went wrong", description: (e as Error).message, variant: "destructive" });

const Attendance: React.FC<{ value: "present" | "absent"; onChange: (v: "present" | "absent") => void; name: string }> = ({ value, onChange, name }) => (
  <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Will you join the ritual?">
    {(["present", "absent"] as const).map((v) => (
      <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
        className={`text-left rounded-field border-2 p-4 text-sm transition-colors ${value === v ? "border-ink bg-leaf" : "border-line bg-paper hover:border-ink"}`}>
        <span className="font-bold flex items-center gap-1.5">
          {v === "present" ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
          {v === "present" ? "I'll join live" : "I won't attend"}
        </span>
        <span className="text-ink/70 text-xs block mt-1">
          {v === "present" ? "A video call at the ritual time. No extra charge." : `${name} records a video showing the items and the prayers with your name.`}
        </span>
      </button>))}
  </div>
);

const Quote: React.FC<{ e: Ebo }> = ({ e }) => (
  <dl className="text-sm grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 rounded-field border border-dashed border-line bg-cloth p-4">
    {[...(e.ebo_items ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((i) => (
      <React.Fragment key={i.id}>
        <dt>{Number(i.quantity)} × {i.name}{i.unit ? ` (${i.unit})` : ""}</dt>
        <dd className="text-right tabular-nums">{e.performed_by === "babalawo" ? naira(i.line_total) : ""}</dd>
      </React.Fragment>))}
    {e.performed_by === "babalawo" && <>
      <dt>Owó Ifá</dt><dd className="text-right tabular-nums">{naira(e.owo_ifa)}</dd>
      <dt className="text-muted-foreground">Platform fee ({Number(e.platform_fee_percent)}%)</dt><dd className="text-right tabular-nums text-muted-foreground">{naira(e.platform_fee)}</dd>
      <dt className="mt-1 border-t border-dashed border-line pt-2 font-bold">Total</dt><dd className="mt-1 border-t border-dashed border-line pt-2 text-right font-display text-2xl font-extrabold tabular-nums tracking-[-0.02em]">{naira(e.amount_due)}</dd>
    </>}
  </dl>
);

const EboClientCard: React.FC<{ e: Ebo; babalawoName: string; refresh: () => void }> = ({ e, babalawoName, refresh }) => {
  const qc = useQueryClient();
  const [attendance, setAttendance] = useState<"present" | "absent">(e.attendance ?? "present");
  const [busy, setBusy] = useState<string | null>(null);
  const [gateway, setGateway] = useState<PaymentGateway>("paystack");
  const [mode, setMode] = useState<null | "time" | "decline" | "dispute">(null);
  const [text, setText] = useState("");
  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast({ title: ok }); setMode(null); setText(""); refresh(); qc.invalidateQueries({ queryKey: ["wallet"] }); }
    catch (err) { fail(err); } finally { setBusy(null); }
  };
  const afterPay = async () => {
    const fresh = (await eboApi.listForClient(e.client_id)).find((x) => x.id === e.id);
    if (fresh?.attendance === "present") await eboApi.ensureRitualLink(fresh.ritual_session_id);
  };
  const payWallet = () => act("wallet", async () => { await eboApi.payWithWallet(e.id, attendance); await afterPay(); }, "Paid. Your Babalawo has been told.");
  const payCard = () => act("card", async () => {
    const r = await eboApi.payWithGateway(e, attendance, gateway);
    if (r.status === "ebo_unavailable_credited_to_wallet") throw new Error("This Ebo was withdrawn while you paid. The money is in your IFA wallet.");
    if (r.status !== "settled" && r.status !== "already_settled") throw new Error(r.status === "pending" ? "Payment not confirmed yet. If you were charged it will show here shortly." : "Payment was not completed.");
    await afterPay();
  }, "Paid. Your Babalawo has been told.");

  const payable = e.performed_by === "babalawo" && e.status === "sent";
  const canChangeAttendance = (e.status === "paid" || e.status === "in_progress") && e.ritual_at && new Date(e.ritual_at).getTime() - Date.now() > 3600_000;

  return (
    <Card><CardContent className="p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="font-display text-xl font-extrabold tracking-[-0.02em] mr-1">{e.title}</p>
        <Badge variant="outline">{KIND_LABEL[e.kind]}</Badge>
        <Badge className={`border-transparent ${STATUS_STYLE[e.status]}`}>{statusLabel(e)}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">From {babalawoName}{e.due_date ? ` · complete by ${e.due_date}` : ""}</p>
      {e.description && <p className="text-sm">{e.description}</p>}
      <Quote e={e} />
      {e.ritual_at && (
        <p className="text-sm"><CalendarClock className="h-4 w-4 inline mr-1 -mt-0.5" />Ritual: <strong>{when(e.ritual_at)}</strong>
          {e.attendance && <span className="text-muted-foreground"> · {e.attendance === "present" ? "you're joining live" : "you won't attend"}</span>}</p>)}

      {payable && (
        <div className="space-y-3 border-t pt-3">
          {e.expires_at && <p className="text-xs text-muted-foreground">Pay by {when(e.expires_at)} to keep this time. The money is held by IFA until the ritual is done.</p>}
          <Attendance value={attendance} onChange={setAttendance} name={babalawoName} />
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="sun" size="lg" disabled={!!busy} onClick={payWallet}>{busy === "wallet" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wallet className="h-4 w-4 mr-1" />}Pay {naira(e.amount_due)} from wallet</Button>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <select aria-label="Payment provider" className="h-14 rounded-pill border-2 border-line bg-paper px-4 text-sm font-semibold" value={gateway} onChange={(ev) => setGateway(ev.target.value as PaymentGateway)}>
                <option value="paystack">Paystack</option><option value="flutterwave">Flutterwave</option>
              </select>
              <Button variant="outline" size="lg" disabled={!!busy} onClick={payCard}>{busy === "card" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CreditCard className="h-4 w-4 mr-1" />}Card or transfer</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode(mode === "time" ? null : "time")}>Ask for another time</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(mode === "decline" ? null : "decline")}>Decline</Button>
          </div>
        </div>)}
      {e.status === "expired" && <p className="text-sm text-muted-foreground">This quote has expired. Ask {babalawoName} to renew it.</p>}

      {mode && (
        <div className="space-y-2">
          {mode === "dispute"
            ? <Textarea rows={3} value={text} onChange={(ev) => setText(ev.target.value)} placeholder="What went wrong? IFA will review it and the money stays held meanwhile." />
            : <Input value={text} onChange={(ev) => setText(ev.target.value)} placeholder={mode === "time" ? "Which days and times suit you?" : "Reason (optional)"} />}
          <Button size="sm" disabled={!!busy} onClick={() =>
            mode === "time" ? act("time", () => eboApi.requestTime(e.id, text), "Sent. Your Babalawo will propose a new time.")
              : mode === "decline" ? act("decline", () => eboApi.decline(e.id, text), "Declined")
                : act("dispute", () => eboApi.dispute(e.id, text), "Reported. IFA will review it.")}>Send</Button>
        </div>)}

      {(e.status === "paid" || e.status === "in_progress") && (
        <div className="space-y-2 border-t pt-3 text-sm">
          <p>{e.attendance === "present" ? "The ritual is in My Sessions with a Join button." : `${babalawoName} will send a video of the ritual.`}</p>
          {canChangeAttendance && (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("att", async () => {
              const next = e.attendance === "present" ? "absent" : "present";
              await eboApi.setAttendance(e.id, next);
              if (next === "present") await afterPay();
            }, "Updated")}>{e.attendance === "present" ? "I can't attend after all" : "I'd like to join live"}</Button>)}
          <Button size="sm" variant="ghost" onClick={() => setMode(mode === "dispute" ? null : "dispute")}>Report a problem</Button>
        </div>)}

      {(e.status === "performed" || e.status === "completed" || e.status === "disputed") && e.performed_by === "babalawo" && (
        <div className="space-y-3 border-t pt-3">
          {e.performance_note && <p className="text-sm"><span className="font-medium">From {babalawoName}:</span> {e.performance_note}</p>}
          <EboProofs eboId={e.id} forClient />
          {e.status === "performed" && (
            <>
              <p className="text-xs text-muted-foreground">If you do nothing, the payment is released to {babalawoName} {when(e.confirm_by)}.</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!!busy} onClick={() => act("ok", () => eboApi.confirm(e.id), "Thank you. Confirmed.")}><CheckCircle2 className="h-4 w-4 mr-1" />Confirm it was done</Button>
                <Button variant="outline" onClick={() => setMode(mode === "dispute" ? null : "dispute")}>Report a problem</Button>
              </div>
            </>)}
          {e.status === "disputed" && <p className="text-sm text-muted-foreground">IFA is reviewing this. The money stays held until it is resolved.</p>}
        </div>)}
      {e.status === "refunded" && <p className="text-sm text-muted-foreground">{naira(e.refunded_amount)} was refunded to your IFA wallet.</p>}

      {e.performed_by === "client" && (e.status === "sent" || e.status === "in_progress") && (
        <div className="flex gap-2">
          {e.status === "sent" && <Button size="sm" variant="outline" onClick={() => act("s", () => eboApi.selfStatus(e.id, "in_progress"), "Updated")}><Circle className="h-3 w-3 mr-1" />Started</Button>}
          <Button size="sm" onClick={() => act("d", () => eboApi.selfStatus(e.id, "completed"), "Marked done")}>Mark done</Button>
        </div>)}
    </CardContent></Card>
  );
};

const EboClientList: React.FC<{ ebo: Ebo[]; names: Record<string, string>; refresh: () => void }> = ({ ebo, names, refresh }) => {
  if (!ebo.length) return <p className="text-muted-foreground py-6 text-center">No Ebo or Etutu prescribed yet.</p>;
  return <>{ebo.map((e) => <EboClientCard key={e.id} e={e} babalawoName={names[e.babalawo_id] || "your Babalawo"} refresh={refresh} />)}</>;
};

export default EboClientList;
