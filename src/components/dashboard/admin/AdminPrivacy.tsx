import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadJson, requestLabel, STATUS_LABEL, type RequestStatus } from "@/lib/privacy";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const when = (d?: string | null) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const hoursLeft = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
const fail = (e: unknown) => toast({ title: "That didn’t work", description: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e), variant: "destructive" });
const rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
};

// ------------------------------------------------------------------ overview
type Overview = {
  open_requests: number; overdue_requests: number; open_breaches: number; files_waiting: number; files_failing: number;
  last_retention_run: { at: string; removed: Record<string, number> } | null;
  consents: Record<string, { granted: number; withdrawn: number }>; notice_version: string;
};

function OverviewCards({ o }: { o?: Overview }) {
  const tiles: [string, React.ReactNode, boolean][] = [
    ["Open requests", o?.open_requests ?? "…", false],
    ["Overdue requests", o?.overdue_requests ?? "…", !!o?.overdue_requests],
    ["Open breaches", o?.open_breaches ?? "…", !!o?.open_breaches],
    ["Files waiting to be deleted", o ? `${o.files_waiting}${o.files_failing ? ` (${o.files_failing} failing)` : ""}` : "…", !!o?.files_failing],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(([label, v, bad]) => (
        <div key={label} className={cn("rounded-panel border bg-paper p-4", bad ? "border-camwood" : "border-line")}>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
          <div className={cn("mt-1 font-display text-3xl font-extrabold", bad && "text-camwood")}>{v}</div>
        </div>
      ))}
      <div className="col-span-2 rounded-panel border border-line bg-paper p-4 text-sm lg:col-span-4">
        <b>Retention schedule</b>: last ran {o?.last_retention_run ? when(o.last_retention_run.at) : "not yet (it runs every hour)"}.
        {o?.last_retention_run && (
          <span className="text-muted-foreground"> Removed: {Object.entries(o.last_retention_run.removed).filter(([, n]) => n).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`).join(", ") || "nothing due"}.</span>
        )}
        {o && <span className="block text-muted-foreground">Privacy notice version {o.notice_version}. Consents in force: {Object.entries(o.consents).map(([k, v]) => `${k.replace(/_/g, " ")} ${v.granted}${v.withdrawn ? ` (withdrawn ${v.withdrawn})` : ""}`).join(" · ") || "none yet"}.</span>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ requests
type Req = {
  id: number; user_id: string | null; request_type: string; status: RequestStatus; source: string; requester_name: string | null;
  requester_email: string | null; requester_phone: string | null; details: string | null; received_at: string; due_at: string;
  extended_reason: string | null; identity_verified_at: string | null; response: string | null; completed_at: string | null;
  history: { at: string; status: string; note?: string | null; extended_days?: number | null }[];
};
const statusColor: Record<RequestStatus, string> = {
  received: "bg-sun/60 text-ink", verifying: "bg-sun/60 text-ink", in_progress: "bg-blue-100 text-blue-900", extended: "bg-orange-100 text-orange-900",
  completed: "bg-green-100 text-green-900", rejected: "bg-gray-200 text-gray-700",
};

function RequestDialog({ r, onClose }: { r: Req; onClose: () => void }) {
  const qc = useQueryClient();
  const [response, setResponse] = useState(r.response ?? "");
  const [note, setNote] = useState("");
  const [extend, setExtend] = useState("");
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<{ id: string; full_name: string | null } | null>(null);
  const [forfeit, setForfeit] = useState(false);
  const userId = r.user_id ?? account?.id ?? null;

  // Public requests: find the account by the phone number they gave.
  useEffect(() => {
    if (r.user_id || !r.requester_phone) return;
    db.from("profiles").select("id, full_name").eq("phone", r.requester_phone).maybeSingle()
      .then(({ data }: { data: { id: string; full_name: string | null } | null }) => setAccount(data));
  }, [r.user_id, r.requester_phone]);

  const act = async (fn: () => Promise<unknown>, done: string, close = true) => {
    setBusy(true);
    try {
      await fn();
      toast({ title: done });
      qc.invalidateQueries({ queryKey: ["admin-privacy"] });
      if (close) onClose();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const update = (status: RequestStatus, extra: Record<string, unknown> = {}) => rpc("admin_update_data_request", {
    p_id: r.id, p_status: status, p_note: note.trim() || null, p_response: response.trim() || null, p_extend_days: null, p_identity_verified: null, ...extra,
  });
  const overdue = !["completed", "rejected"].includes(r.status) && new Date(r.due_at) < new Date();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>#{r.id} · {requestLabel(r.request_type)}</DialogTitle>
          <DialogDescription>
            Received {when(r.received_at)} ({r.source.replace("_", " ")}). Due <b className={cn(overdue && "text-camwood")}>{day(r.due_at)}</b>
            {r.extended_reason ? `, extended: ${r.extended_reason}` : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded-field bg-cloth p-3">
            <div><b>{r.requester_name || "No name"}</b> {r.requester_phone && `· ${r.requester_phone}`} {r.requester_email && `· ${r.requester_email}`}</div>
            <div className="text-muted-foreground">
              {r.user_id ? "Signed in when they asked" : account ? `Matches account: ${account.full_name ?? account.id.slice(0, 8)}` : "No matching account found"}
              {" · "}{r.identity_verified_at ? `Identity checked ${day(r.identity_verified_at)}` : "Identity not checked yet"}
            </div>
            {r.details && <p className="mt-2 whitespace-pre-wrap">{r.details}</p>}
          </div>

          {!r.identity_verified_at && (
            <div className="rounded-field border border-line p-3">
              <p className="m-0">
                Before releasing or deleting anything, confirm it's them: send a code to the phone on the account, or call that number. Never
                trust an email address alone.
              </p>
              <Button size="sm" variant="outline" className="mt-2" disabled={busy}
                onClick={() => act(() => update(r.status === "verifying" ? "in_progress" : r.status, { p_identity_verified: true, p_note: note.trim() || "Identity checked" }), "Identity marked as checked", false)}>
                <ShieldCheck /> I checked it's them
              </Button>
            </div>
          )}

          {userId && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy || !r.identity_verified_at}
                onClick={() => act(async () => downloadJson(await rpc("admin_export_user_data", { p_user_id: userId, p_request_id: r.id }), `ifa-ng-data-request-${r.id}.json`), "Export downloaded. Send it to them securely.", false)}>
                <Download /> Export their data
              </Button>
              {r.request_type === "erasure" && r.status !== "completed" && (
                <>
                  <Button size="sm" variant="destructive" disabled={busy || !r.identity_verified_at}
                    onClick={() => { if (window.confirm("Erase this account? This can't be undone.")) act(() => rpc("admin_erase_user", { p_user_id: userId, p_request_id: r.id, p_forfeit_wallet: forfeit }), "Account erased"); }}>
                    <Trash2 /> Erase account
                  </Button>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={forfeit} onCheckedChange={setForfeit} /> They gave up their wallet balance</label>
                </>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="dsr-response">Answer the person will see</Label>
            <Textarea id="dsr-response" rows={3} value={response} onChange={(e) => setResponse(e.target.value)}
              placeholder="What you did, or why you can't (with the legal reason), and how to complain to the NDPC." />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div>
              <Label htmlFor="dsr-note">Internal note</Label>
              <Input id="dsr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For the record (also the reason for an extension)" />
            </div>
            <div>
              <Label htmlFor="dsr-extend">Extend by days</Label>
              <Input id="dsr-extend" type="number" min={1} max={60} value={extend} onChange={(e) => setExtend(e.target.value)} />
            </div>
          </div>
          {!!r.history?.length && (
            <ol className="space-y-1 border-l-2 border-line pl-3 text-xs text-muted-foreground">
              {r.history.map((h, i) => <li key={i}>{when(h.at)} · {STATUS_LABEL[h.status as RequestStatus] ?? h.status}{h.extended_days ? ` · +${h.extended_days} days` : ""}{h.note ? ` · ${h.note}` : ""}</li>)}
            </ol>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {extend && <Button variant="outline" disabled={busy} onClick={() => act(() => update(r.status === "completed" ? "in_progress" : r.status, { p_extend_days: Number(extend) }), "Deadline extended")}>Extend</Button>}
          <Button variant="outline" disabled={busy} onClick={() => act(() => update("in_progress"), "Marked in progress")}>In progress</Button>
          <Button variant="outline" disabled={busy || !response.trim()} onClick={() => act(() => update("rejected"), "Request declined")}>Decline</Button>
          <Button disabled={busy || !response.trim()} onClick={() => act(() => update("completed"), "Request done")}>{busy ? <Loader2 className="animate-spin" /> : "Mark done"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Requests() {
  const [showClosed, setShowClosed] = useState(false);
  const [active, setActive] = useState<Req | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-privacy", "requests", showClosed],
    queryFn: async () => {
      let q = db.from("data_subject_requests").select("*").order("due_at", { ascending: true }).limit(200);
      if (!showClosed) q = q.not("status", "in", "(completed,rejected)");
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data as Req[];
    },
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Privacy requests</CardTitle>
        <label className="flex items-center gap-2 text-sm"><Switch checked={showClosed} onCheckedChange={setShowClosed} /> Show closed</label>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Answer within 30 days (NDPA, GDPR). Self-service downloads, consent withdrawals and account deletions are logged here as done.
        </p>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !data?.length ? <p className="text-sm">Nothing waiting.</p> : (
          <ul className="divide-y divide-line">
            {data.map((r) => {
              const open = !["completed", "rejected"].includes(r.status);
              const h = hoursLeft(r.due_at);
              return (
                <li key={r.id}>
                  <button className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left hover:bg-cloth/60" onClick={() => setActive(r)}>
                    <span>
                      <span className="font-semibold">#{r.id} {requestLabel(r.request_type)}</span>
                      <span className="block text-sm text-muted-foreground">{r.requester_name || "—"} · {r.source.replace("_", " ")} · received {day(r.received_at)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {open && <span className={cn("text-xs font-semibold", h < 0 ? "text-camwood" : h < 72 ? "text-orange-700" : "text-muted-foreground")}>
                        {h < 0 ? `${Math.ceil(-h / 24)} days overdue` : `due in ${Math.ceil(h / 24)} days`}</span>}
                      <Badge className={statusColor[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {active && <RequestDialog r={active} onClose={() => setActive(null)} />}
    </Card>
  );
}

// ------------------------------------------------------------------ breaches
type Breach = {
  id: number; title: string; description: string | null; detected_at: string; data_categories: string[]; special_category: boolean;
  people_affected: number | null; countries: string[]; risk: string; containment: string | null; ndpc_notified_at: string | null;
  ico_notified_at: string | null; eu_authority_notified_at: string | null; people_notified_at: string | null; not_reported_reason: string | null;
  status: string;
};
const emptyBreach = { title: "", description: "", risk: "unknown", people_affected: "", data_categories: "", countries: "NG", special_category: false };

function Breaches() {
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof emptyBreach | null>(null);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["admin-privacy", "breaches"],
    queryFn: async () => {
      const { data, error } = await db.from("data_breaches").select("*").order("detected_at", { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      return data as Breach[];
    },
  });
  const save = async (fn: () => Promise<{ error: { message: string } | null }>, done: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return fail(error);
    toast({ title: done });
    qc.invalidateQueries({ queryKey: ["admin-privacy"] });
  };
  const patch = (b: Breach, p: Partial<Breach>, done: string) => save(() => db.from("data_breaches").update(p).eq("id", b.id), done);
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Breach register</CardTitle>
        <Button size="sm" variant="destructive" onClick={() => setForm({ ...emptyBreach })}><AlertTriangle /> Record a breach</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Record every personal data breach, even small ones. If it could put people at risk, tell the NDPC within 72 hours of finding out
          (and the ICO or EU authority if people there are affected). Tell the people affected without delay if the risk is high.
          Follow docs/privacy/BREACH_RESPONSE.md.
        </p>
        {!data?.length && <p className="text-sm">No breaches recorded.</p>}
        {data?.map((b) => {
          const left = hoursLeft(new Date(new Date(b.detected_at).getTime() + 72 * 3_600_000).toISOString());
          const needsNdpc = !b.ndpc_notified_at && !b.not_reported_reason && b.status !== "closed";
          return (
            <div key={b.id} className={cn("rounded-panel border p-4", needsNdpc ? "border-camwood" : "border-line")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-display text-lg font-bold">{b.title}</div>
                  <div className="text-sm text-muted-foreground">
                    Found {when(b.detected_at)} · risk {b.risk}{b.people_affected != null ? ` · ${b.people_affected} ${b.people_affected === 1 ? "person" : "people"}` : ""}
                    {b.special_category ? " · includes sensitive data" : ""}{b.countries?.length ? ` · ${b.countries.join(", ")}` : ""}
                  </div>
                </div>
                <Badge variant={b.status === "closed" ? "secondary" : "destructive"}>{b.status}</Badge>
              </div>
              {needsNdpc && (
                <p className="mt-2 text-sm font-semibold text-camwood">
                  {left > 0 ? `${left} hours left to tell the NDPC (72-hour deadline).` : `The 72-hour deadline passed ${-left} hours ago. Notify now and explain the delay.`}
                </p>
              )}
              {b.description && <p className="mt-2 whitespace-pre-wrap text-sm">{b.description}</p>}
              <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                <span>NDPC told: {when(b.ndpc_notified_at)}</span>
                <span>People told: {when(b.people_notified_at)}</span>
                <span>ICO (UK) told: {when(b.ico_notified_at)}</span>
                <span>EU authority told: {when(b.eu_authority_notified_at)}</span>
                {b.not_reported_reason && <span className="sm:col-span-2">Not reported because: {b.not_reported_reason}</span>}
              </div>
              {b.status !== "closed" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {!b.ndpc_notified_at && <Button size="sm" variant="outline" disabled={busy} onClick={() => patch(b, { ndpc_notified_at: new Date().toISOString() }, "NDPC notification recorded")}>NDPC told now</Button>}
                  {!b.people_notified_at && <Button size="sm" variant="outline" disabled={busy} onClick={() => patch(b, { people_notified_at: new Date().toISOString() }, "Recorded")}>People told now</Button>}
                  {!b.ico_notified_at && <Button size="sm" variant="outline" disabled={busy} onClick={() => patch(b, { ico_notified_at: new Date().toISOString() }, "Recorded")}>ICO told now</Button>}
                  {!b.eu_authority_notified_at && <Button size="sm" variant="outline" disabled={busy} onClick={() => patch(b, { eu_authority_notified_at: new Date().toISOString() }, "Recorded")}>EU authority told now</Button>}
                  {b.status === "open" && <Button size="sm" variant="outline" disabled={busy} onClick={() => patch(b, { status: "contained", containment: window.prompt("How was it contained?") ?? b.containment }, "Marked contained")}>Contained</Button>}
                  <Button size="sm" disabled={busy} onClick={() => {
                    const reason = !b.ndpc_notified_at ? window.prompt("The NDPC was not told. Why? (e.g. no risk to people: data was encrypted)") : null;
                    if (!b.ndpc_notified_at && !reason) return;
                    patch(b, { status: "closed", ...(reason ? { not_reported_reason: reason } : {}) }, "Breach closed");
                  }}>Close</Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Record a breach</DialogTitle>
            <DialogDescription>The 72-hour clock starts from when IFA.ng became aware. Record what you know now and update it later.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div><Label>What happened, in a line</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Details</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="How it was found, what data, who could see it, what you've done" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Risk to people</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3" value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value })}>
                    {["unknown", "low", "medium", "high"].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div><Label>People affected (estimate)</Label><Input type="number" min={0} value={form.people_affected} onChange={(e) => setForm({ ...form, people_affected: e.target.value })} /></div>
                <div><Label>Data involved (comma separated)</Label><Input value={form.data_categories} onChange={(e) => setForm({ ...form, data_categories: e.target.value })} placeholder="phone numbers, consultation notes" /></div>
                <div><Label>Countries (comma separated)</Label><Input value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} placeholder="NG, GB, US" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.special_category} onCheckedChange={(v) => setForm({ ...form, special_category: v })} /> Includes consultation content, recordings or health data</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy || !form?.title.trim()} onClick={() => form && save(() => db.from("data_breaches").insert({
              title: form.title.trim(), description: form.description.trim() || null, risk: form.risk,
              people_affected: form.people_affected ? Number(form.people_affected) : null, data_categories: list(form.data_categories),
              countries: list(form.countries).map((c) => c.toUpperCase()), special_category: form.special_category,
            }), "Breach recorded").then(() => setForm(null))}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ------------------------------------------------------------------ settings
const SETTINGS: { key: string; label: string; help: string; type: "text" | "number"; isPublic: boolean }[] = [
  { key: "privacy_controller_name", label: "Company name (data controller)", help: "The legal name of the company that runs IFA.ng.", type: "text", isPublic: true },
  { key: "privacy_controller_rc_number", label: "CAC RC number", help: "", type: "text", isPublic: true },
  { key: "privacy_controller_address", label: "Registered address", help: "", type: "text", isPublic: true },
  { key: "privacy_dpo_name", label: "Data Protection Officer", help: "Name of the DPO (or the company acting as DPO).", type: "text", isPublic: true },
  { key: "privacy_dpo_email", label: "Privacy email", help: "Shown in the privacy policy and on every privacy screen.", type: "text", isPublic: true },
  { key: "privacy_ndpc_registration", label: "NDPC registration number", help: "Once registered as a data controller of major importance.", type: "text", isPublic: true },
  { key: "privacy_eu_representative", label: "EU representative (GDPR Art. 27)", help: "Name and address, once appointed.", type: "text", isPublic: true },
  { key: "privacy_uk_representative", label: "UK representative (UK GDPR Art. 27)", help: "Name and address, once appointed.", type: "text", isPublic: true },
  { key: "dsar_response_days", label: "Days to answer a request", help: "30 meets both the NDPA and the GDPR.", type: "number", isPublic: true },
  { key: "retention_notifications_days", label: "Keep in-app notifications (days)", help: "", type: "number", isPublic: true },
  { key: "retention_message_log_days", label: "Keep WhatsApp/SMS delivery logs (days)", help: "", type: "number", isPublic: true },
  { key: "retention_security_log_days", label: "Keep sign-in records and IP addresses (days)", help: "", type: "number", isPublic: true },
  { key: "retention_session_log_days", label: "Keep session join/leave logs (days)", help: "", type: "number", isPublic: true },
  { key: "retention_ebo_proof_days", label: "Keep Ebo proof videos after closing (days)", help: "", type: "number", isPublic: true },
  { key: "retention_applications_days", label: "Keep declined applications (days)", help: "", type: "number", isPublic: true },
  { key: "retention_financial_years", label: "Keep payment records (years)", help: "Tax and company law: at least 6.", type: "number", isPublic: true },
  { key: "retention_audit_years", label: "Keep audit logs (years)", help: "", type: "number", isPublic: true },
  { key: "retention_privacy_requests_years", label: "Keep closed requests and breach records (years)", help: "", type: "number", isPublic: true },
];

function Settings({ version }: { version?: string }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    db.from("admin_settings").select("setting_key, setting_value").in("setting_key", SETTINGS.map((s) => s.key))
      .then(({ data }: { data: { setting_key: string; setting_value: string }[] | null }) =>
        setValues(Object.fromEntries((data ?? []).map((r) => [r.setting_key, r.setting_value]))));
  }, []);
  const upsert = async (rows: { setting_key: string; setting_value: string; is_public: boolean }[], done: string) => {
    setBusy(true);
    const { error } = await db.from("admin_settings").upsert(rows, { onConflict: "setting_key" });
    setBusy(false);
    if (error) return fail(error);
    toast({ title: done });
    qc.invalidateQueries();
  };
  if (!values) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <Card>
      <CardHeader><CardTitle>Privacy settings</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {SETTINGS.map((s) => (
            <label key={s.key} className="block">
              <span className="mb-1.5 block text-sm font-semibold">{s.label}</span>
              <Input type={s.type} min={s.type === "number" ? 1 : undefined} value={values[s.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v!, [s.key]: e.target.value }))} />
              {s.help && <span className="mt-1 block text-xs text-muted-foreground">{s.help}</span>}
            </label>
          ))}
        </div>
        <Button disabled={busy} onClick={() => {
          const bad = SETTINGS.find((s) => s.type === "number" && !(Number(values[s.key]) >= 1));
          if (bad) return fail(new Error(`${bad.label}: enter a number of at least 1`));
          upsert(SETTINGS.map((s) => ({ setting_key: s.key, setting_value: (values[s.key] ?? "").trim(), is_public: s.isPublic })), "Privacy settings saved");
        }}>Save settings</Button>

        <div className="rounded-panel border border-line p-4">
          <b>Privacy notice version: {version ?? "…"}</b>
          <p className="mt-1 text-sm text-muted-foreground">
            After a meaningful change to the Privacy policy or Terms (in the code), publish a new version. Everyone will be asked to
            read and agree again the next time they open IFA.ng.
          </p>
          <Button className="mt-2" variant="outline" disabled={busy} onClick={() => {
            const v = new Date().toISOString().slice(0, 10);
            if (window.confirm(`Publish version ${v}? Everyone will be asked to agree again.`))
              upsert([{ setting_key: "privacy_notice_version", setting_value: v, is_public: true }], `Version ${v} published`);
          }}>Publish a new version</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ page
const AdminPrivacy: React.FC = () => {
  const { data: overview } = useQuery({
    queryKey: ["admin-privacy", "overview"],
    queryFn: () => rpc<Overview>("admin_privacy_overview", {}),
    refetchInterval: 60_000,
  });
  const tab = useMemo(() => (overview?.open_breaches ? "breaches" : "requests"), [overview?.open_breaches]);
  return (
    <div className="space-y-6">
      <OverviewCards o={overview} />
      <Tabs key={tab} defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="breaches">Breaches</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="requests"><Requests /></TabsContent>
        <TabsContent value="breaches"><Breaches /></TabsContent>
        <TabsContent value="settings"><Settings version={overview?.notice_version} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPrivacy;
