import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/integrations/api/config";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import AdminWalletManagement from "./AdminWalletManagement";
import { PLATFORM_RULES } from "./platformRules";

/**
 * Admin settings: platform rules (numbers and switches) and a read-only view of which
 * providers the server is configured with. Provider keys are never entered here: they live
 * in the server's environment (deploy/.env), and the database refuses to store them.
 */
const INTEGRATIONS: { key: string; label: string; env: string }[] = [
  { key: "paystack", label: "Paystack", env: "PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY" },
  { key: "flutterwave", label: "Flutterwave", env: "FLW_SECRET_KEY, FLW_PUBLIC_KEY, FLW_SECRET_HASH" },
  { key: "google_meet", label: "Google Meet", env: "GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_ORGANIZER_EMAIL" },
  { key: "agora", label: "Agora (backup video)", env: "AGORA_APP_ID, AGORA_APP_CERTIFICATE" },
  { key: "termii", label: "Termii (login codes, SMS)", env: "TERMII_API_KEY" },
  { key: "whatsapp", label: "WhatsApp", env: "WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID" },
  { key: "email", label: "Email", env: "SMTP_URL" },
  { key: "web_push", label: "Push notifications", env: "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY" },
  { key: "file_storage", label: "File storage", env: "S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY" },
  { key: "error_tracking", label: "Error tracking (Sentry)", env: "SENTRY_DSN" },
];

function PlatformRules() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("admin_settings").select("setting_key, setting_value")
        .in("setting_key", PLATFORM_RULES.map((r) => r.key));
      if (error) toast({ title: "Could not load settings", variant: "destructive" });
      const m: Record<string, string> = {};
      for (const r of PLATFORM_RULES) m[r.key] = r.fallback;
      for (const row of data ?? []) m[row.setting_key] = row.setting_value ?? "";
      setValues(m);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    for (const r of PLATFORM_RULES) {
      const v = values[r.key];
      if (r.type === "number" && (v === "" || !Number.isFinite(Number(v)) || Number(v) < (r.min ?? 0))) {
        toast({ title: `${r.label}: enter a number${r.min !== undefined ? ` of at least ${r.min}` : ""}`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase.from("admin_settings").upsert(
      PLATFORM_RULES.map((r) => ({ setting_key: r.key, setting_value: String(values[r.key]), description: r.help, is_public: r.isPublic })),
      { onConflict: "setting_key" });
    setSaving(false);
    toast(error ? { title: "Could not save", description: error.message, variant: "destructive" } : { title: "Settings saved" });
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const groups = [...new Set(PLATFORM_RULES.map((r) => r.group))];
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <Card key={g}>
          <CardHeader><CardTitle>{g}</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {PLATFORM_RULES.filter((r) => r.group === g).map((r) => (
              <label key={r.key} className="block">
                <span className="block text-sm font-semibold mb-1.5">{r.label}{r.unit ? ` (${r.unit})` : ""}</span>
                {r.type === "choice" ? (
                  <select className="w-full h-10 rounded-md border bg-background px-3" value={values[r.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))}>
                    {r.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <Input type="number" inputMode="decimal" min={r.min} value={values[r.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))} />
                )}
                <span className="block text-xs text-muted-foreground mt-1">{r.help}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      ))}
      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
    </div>
  );
}

function Integrations() {
  const [state, setState] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<Record<string, boolean>>("/v1/admin/integrations").then(setState).catch((e) => setError(String(e?.message ?? e)));
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          Keys are set on the server in <code>deploy/.env</code>, never here, and the API restarts to pick them up.
          This list only shows whether each one is set.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? <p className="text-sm text-destructive">Could not check: {error}</p> : !state ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ul className="divide-y">
            {INTEGRATIONS.map((i) => (
              <li key={i.key} className="flex items-start gap-3 py-3">
                {state[i.key] ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                <div>
                  <div className="font-semibold">{i.label} {state[i.key] ? "is set up" : "is not set up"}</div>
                  <div className="text-xs text-muted-foreground">{i.env}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const AdminSettingsPanel = () => (
  <Tabs defaultValue="rules" className="w-full">
    <TabsList>
      <TabsTrigger value="rules">Platform rules</TabsTrigger>
      <TabsTrigger value="integrations">Integrations</TabsTrigger>
      <TabsTrigger value="wallet">Wallets</TabsTrigger>
    </TabsList>
    <TabsContent value="rules"><PlatformRules /></TabsContent>
    <TabsContent value="integrations"><Integrations /></TabsContent>
    <TabsContent value="wallet"><AdminWalletManagement /></TabsContent>
  </Tabs>
);

export default AdminSettingsPanel;
