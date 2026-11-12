import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import AdminWalletManagement from "./AdminWalletManagement";
import AdminIntegrations from "./AdminIntegrations";
import { PLATFORM_RULES } from "./platformRules";

/**
 * Admin settings: platform rules (numbers and switches), provider keys (Integrations, managed
 * through the API, never stored in admin_settings) and wallets.
 */
function PlatformRules() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedCommission, setSavedCommission] = useState<{ platform: string; babalawo: string } | null>(null);
  const [applyCommissionToAll, setApplyCommissionToAll] = useState(false);
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
      setSavedCommission({ platform: m.platform_commission_percent, babalawo: m.babalawo_commission_percent });
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
    const platformCommission = Number(values.platform_commission_percent);
    const babalawoCommission = Number(values.babalawo_commission_percent);
    const commissionChanged = savedCommission !== null && (
      platformCommission !== Number(savedCommission.platform) || babalawoCommission !== Number(savedCommission.babalawo)
    );
    if (commissionChanged && platformCommission + babalawoCommission !== 100) {
      toast({ title: "Commission split must total 100%", description: "The platform and Babalawo shares must add up to 100.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("admin_settings").upsert(
      PLATFORM_RULES
        .filter((r) => !commissionChanged || (r.key !== "platform_commission_percent" && r.key !== "babalawo_commission_percent"))
        .map((r) => ({ setting_key: r.key, setting_value: String(values[r.key]), description: r.help, is_public: r.isPublic })),
      { onConflict: "setting_key" });
    if (!error && commissionChanged) {
      const { error: commissionError } = await supabase.rpc("admin_update_commission_split", {
        p_platform_percent: platformCommission,
        p_babalawo_percent: babalawoCommission,
        p_apply_to_all: applyCommissionToAll,
      });
      if (commissionError) {
        setSaving(false);
        toast({ title: "Other settings saved, but commission was not", description: commissionError.message, variant: "destructive" });
        return;
      }
      setSavedCommission({ platform: String(platformCommission), babalawo: String(babalawoCommission) });
      setApplyCommissionToAll(false);
    }
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
                  <Input type="number" inputMode="decimal" step="any" min={r.min} value={values[r.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))} />
                )}
                <span className="block text-xs text-muted-foreground mt-1">{r.help}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      ))}
      {savedCommission && (
        Number(values.platform_commission_percent) !== Number(savedCommission.platform) ||
        Number(values.babalawo_commission_percent) !== Number(savedCommission.babalawo)
      ) && (
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={applyCommissionToAll}
            onChange={(e) => setApplyCommissionToAll(e.target.checked)} />
          <span>
            <span className="font-semibold">Apply this split to all Babalawos</span>
            <span className="block text-xs text-muted-foreground mt-1">
              Updates each Babalawo’s individual commission to {values.platform_commission_percent}% / {values.babalawo_commission_percent}%. Leave unchecked to change only the overall defaults.
            </span>
          </span>
        </label>
      )}
      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
    </div>
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
    <TabsContent value="integrations"><AdminIntegrations /></TabsContent>
    <TabsContent value="wallet"><AdminWalletManagement /></TabsContent>
  </Tabs>
);

export default AdminSettingsPanel;
