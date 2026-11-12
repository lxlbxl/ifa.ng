import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, ChevronDown, Copy, Eye, EyeOff, KeyRound, Loader2, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/integrations/api/config";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Admin → Settings → Integrations. Provider keys are typed here and sent once to the API, which
 * encrypts and stores them where the web app's database access can't reach. They never come
 * back: secret fields only show "Set, ends in ab12". A value saved here wins over the server's
 * .env; "Use server value" removes it. Every save and test is in the activity log.
 */

interface Field {
  env: string; label: string; secret: boolean; multiline: boolean; placeholder: string | null; help: string | null;
  source: "admin" | "server" | "unset"; value: string | null; masked: string | null; server_value_set: boolean;
  updated_at: string | null; updated_by: string | null; unreadable: boolean;
}
interface LastTest { ok: boolean; message: string; at: string; by: string | null; stale: boolean }
interface Integration {
  id: string; label: string; description: string; used_by: ("api" | "worker")[]; test_to: "phone" | "email" | null;
  webhook_url: string | null; configured: boolean; last_test: LastTest | null; fields: Field[];
}
interface ListResponse { encryption: { dedicated_key: boolean }; integrations: Integration[] }
interface TestResult { ok: boolean; message: string }

/** What the admin has typed: a string replaces, null removes the saved value. */
type Draft = Record<string, string | null>;

const when = (iso: string) => format(new Date(iso), "d MMM yyyy, HH:mm");

function status(i: Integration): { label: string; tone: "ok" | "bad" | "idle" | "off" } {
  if (!i.configured) return { label: "Not set up", tone: "off" };
  if (!i.last_test) return { label: "Not tested", tone: "idle" };
  if (i.last_test.stale) return { label: "Changed, not tested", tone: "idle" };
  return i.last_test.ok ? { label: "Working", tone: "ok" } : { label: "Test failed", tone: "bad" };
}

const TONES = {
  ok: "bg-leaf text-ink",
  bad: "bg-coral text-white",
  idle: "bg-sun-100 text-ink border border-sun-300",
  off: "bg-muted text-muted-foreground",
};

function Chip({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", TONES[tone])}>{children}</span>;
}

function sourceLine(f: Field) {
  if (f.unreadable) return "Saved here, but it can't be read any more. Enter it again.";
  if (f.source === "admin") return `Saved here${f.updated_at ? ` on ${when(f.updated_at)}` : ""}${f.updated_by ? ` by ${f.updated_by}` : ""}`;
  if (f.source === "server") return "From the server's settings (.env)";
  return "Not set";
}

function FieldEditor({ f, draft, setDraft }: { f: Field; draft: Draft; setDraft: (d: Draft) => void }) {
  const [show, setShow] = useState(false);
  const typed = draft[f.env];
  const removing = typed === null;
  const shown = typeof typed === "string" ? typed : f.secret ? "" : f.value ?? "";
  const change = (v: string) => setDraft({ ...draft, [f.env]: v });
  const id = `f-${f.env}`;
  const placeholder = f.secret
    ? f.masked ? "Type a new value to replace it" : f.placeholder ?? "Paste the value"
    : f.placeholder ?? "";

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-semibold">{f.label}</label>
        <span className={cn("text-xs", f.unreadable ? "text-coral font-semibold" : "text-muted-foreground")}>{sourceLine(f)}</span>
      </div>
      {f.secret && f.masked && !removing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" /> <span className="font-mono">{f.masked}</span>
        </div>
      )}
      {removing ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-line bg-cloth px-3 py-2 text-sm">
          <span>{f.server_value_set ? "On save, goes back to the server's own value." : "On save, this is removed."}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => { const d = { ...draft }; delete d[f.env]; setDraft(d); }}>Undo</Button>
        </div>
      ) : f.multiline ? (
        <Textarea id={id} rows={4} spellCheck={false} autoComplete="off" className="font-mono text-xs"
          placeholder={placeholder} value={shown} onChange={(e) => change(e.target.value)} />
      ) : (
        <div className="relative">
          <Input id={id} type={f.secret && !show ? "password" : "text"} spellCheck={false}
            autoComplete={f.secret ? "new-password" : "off"} placeholder={placeholder} value={shown}
            className={cn(f.secret && "pr-10 font-mono")} onChange={(e) => change(e.target.value)} />
          {f.secret && (
            <button type="button" aria-label={show ? "Hide" : "Show what I typed"} onClick={() => setShow(!show)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-2">
        {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : <span />}
        {f.source === "admin" && !removing && (
          <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline"
            onClick={() => setDraft({ ...draft, [f.env]: null })}>
            <RotateCcw className="h-3 w-3" /> {f.server_value_set ? "Use server value" : "Remove"}
          </button>
        )}
      </div>
    </div>
  );
}

/** The values to send: only what the admin actually changed. */
function changes(i: Integration, draft: Draft): Draft {
  const out: Draft = {};
  for (const f of i.fields) {
    if (!(f.env in draft)) continue;
    const v = draft[f.env];
    if (v === null) { out[f.env] = null; continue; }
    const t = v.trim();
    if (f.secret) { if (t) out[f.env] = t; continue; }
    if (t === (f.value ?? "")) continue;
    if (t) out[f.env] = t;
    else if (f.source === "admin") out[f.env] = null;
  }
  return out;
}

function IntegrationCard({ i, onSaved }: { i: Integration; onSaved: (next: Integration) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const st = status(i);
  const pending = changes(i, draft);
  const dirty = Object.keys(pending).length > 0;

  const runTest = async (values: Draft) => {
    const r = await apiFetch<TestResult>(`/v1/admin/integrations/${i.id}/test`, {
      method: "POST", body: JSON.stringify({ values, to: to.trim() || undefined }),
    });
    setResult(r);
    return r;
  };

  const test = async () => {
    setBusy("test"); setResult(null);
    try { await runTest(pending); }
    catch (e) { setResult({ ok: false, message: (e as Error).message }); }
    finally { setBusy(null); }
    // Refresh "last tested" without losing what is typed.
    apiFetch<ListResponse>("/v1/admin/integrations").then((l) => { const n = l.integrations.find((x) => x.id === i.id); if (n) onSaved(n); }).catch(() => {});
  };

  const save = async () => {
    setBusy("save"); setResult(null);
    try {
      const next = await apiFetch<Integration>(`/v1/admin/integrations/${i.id}`, { method: "PUT", body: JSON.stringify({ values: pending }) });
      setDraft({});
      onSaved(next);
      toast({ title: `${i.label} saved`, description: "It's in use now. Testing it…" });
      if (next.configured) {
        await runTest({});
        const l = await apiFetch<ListResponse>("/v1/admin/integrations");
        const n = l.integrations.find((x) => x.id === i.id);
        if (n) onSaved(n);
      }
    } catch (e) {
      toast({ title: "Not saved", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast({ title: "Copied" }));

  return (
    <li className="rounded-2xl border border-line bg-paper">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left sm:items-center sm:p-5">
        {st.tone === "ok" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700 sm:mt-0" />
          : st.tone === "bad" ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-coral sm:mt-0" />
          : <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full sm:mt-0 sm:mx-[5px]", st.tone === "off" ? "bg-line" : "bg-sun")} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold leading-tight">{i.label}</span>
            <Chip tone={st.tone}>{st.label}</Chip>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{i.description}</p>
        </div>
        <span className="hidden text-sm font-semibold sm:inline">{open ? "Close" : "Manage"}</span>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 transition-transform sm:mt-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-line p-4 sm:p-5">
          <div className="grid gap-5 md:grid-cols-2">
            {i.fields.map((f) => (
              <div key={f.env} className={cn(f.multiline && "md:col-span-2")}>
                <FieldEditor f={f} draft={draft} setDraft={setDraft} />
              </div>
            ))}
          </div>

          {i.webhook_url && (
            <div className="rounded-xl bg-cloth p-3 text-sm">
              <div className="font-semibold">Webhook address</div>
              <p className="text-xs text-muted-foreground">Paste this in the {i.label} dashboard so payments are confirmed even if a customer closes the page.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-paper px-2 py-1 text-xs">{i.webhook_url}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(i.webhook_url!)}><Copy /> Copy</Button>
              </div>
            </div>
          )}

          {i.used_by.includes("worker") && (
            <p className="text-xs text-muted-foreground">
              {i.used_by.includes("api") ? "Also used by" : "Used by"} the recording worker, which picks up changes within a minute.
            </p>
          )}

          {i.test_to && (
            <label className="block max-w-sm">
              <span className="mb-1.5 block text-sm font-semibold">{i.test_to === "phone" ? "Also send a test SMS to (optional)" : "Also send a test email to (optional)"}</span>
              <Input value={to} onChange={(e) => setTo(e.target.value)} inputMode={i.test_to === "phone" ? "tel" : "email"}
                placeholder={i.test_to === "phone" ? "+2348012345678" : "you@example.com"} />
            </label>
          )}

          {result && (
            <div role="status" className={cn("flex items-start gap-2 rounded-xl p-3 text-sm",
              result.ok ? "bg-leaf-100 text-ink" : "bg-coral-50 text-coral-800 border border-coral-200")}>
              {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}
          {!result && i.last_test && (
            <p className="text-xs text-muted-foreground">
              Last tested {when(i.last_test.at)}{i.last_test.by ? ` by ${i.last_test.by}` : ""}: {i.last_test.message}
              {i.last_test.stale ? " (settings changed since)" : ""}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={save} disabled={!dirty || !!busy}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : null} Save and test
            </Button>
            <Button type="button" variant="outline" onClick={test} disabled={!!busy}>
              {busy === "test" ? <Loader2 className="animate-spin" /> : null} {dirty ? "Test before saving" : "Test"}
            </Button>
            {dirty && (
              <Button type="button" variant="ghost" onClick={() => { setDraft({}); setResult(null); }} disabled={!!busy}>Discard changes</Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function AdminIntegrations() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<ListResponse>("/v1/admin/integrations").then(setData).catch((e) => setError(String(e?.message ?? e)));
  }, []);
  useEffect(load, [load]);

  const replace = (next: Integration) =>
    setData((d) => d && { ...d, integrations: d.integrations.map((x) => (x.id === next.id ? next : x)) });

  if (error) {
    return (
      <Card><CardContent className="p-6 text-sm">
        <p className="text-coral font-semibold">Could not load integrations: {error}</p>
        <Button className="mt-3" variant="outline" onClick={() => { setError(null); load(); }}>Try again</Button>
      </CardContent></Card>
    );
  }
  if (!data) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const setUp = data.integrations.filter((i) => i.configured).length;
  const working = data.integrations.filter((i) => status(i).tone === "ok").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Enter or replace each provider's keys, then test them. A value saved here is used instead of the
            server's <code>.env</code> straight away, with no restart.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <span><span className="font-display text-2xl font-bold">{setUp}</span> <span className="text-muted-foreground">of {data.integrations.length} set up</span></span>
          <span><span className="font-display text-2xl font-bold">{working}</span> <span className="text-muted-foreground">passed their last test</span></span>
          <span className="flex basis-full items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-green-700" />
            <span>
              Keys are encrypted before they are stored and are never shown again, only their last 4 characters.
              Every change and test is in the activity log.
              {!data.encryption.dedicated_key && " The encryption key comes from AUTH_SECRET; set SETTINGS_ENCRYPTION_KEY on the server to keep them separate."}
            </span>
          </span>
        </CardContent>
      </Card>
      <ul className="space-y-3">
        {data.integrations.map((i) => <IntegrationCard key={i.id} i={i} onSaved={replace} />)}
      </ul>
    </div>
  );
}
