
import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FlutterwaveSettings {
  environment: "test" | "live";
  fw_public_key: string;
  fw_secret_key: string;
  redirect_success: string;
  redirect_failure: string;
}

const FLUTTERWAVE_ENV_KEY = "flutterwave_environment";
const FLUTTERWAVE_PK_KEY = "flutterwave_public_key";
const FLUTTERWAVE_SK_KEY = "flutterwave_secret_key";
const FLUTTERWAVE_SUCCESS_URL_KEY = "flutterwave_redirect_success";
const FLUTTERWAVE_FAIL_URL_KEY = "flutterwave_redirect_failure";

// We'll use settings stored in admin_settings table
export default function AdminSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [fwPublicKey, setFwPublicKey] = useState("");
  const [fwSecretKey, setFwSecretKey] = useState("");
  const [redirectSuccess, setRedirectSuccess] = useState("");
  const [redirectFailure, setRedirectFailure] = useState("");
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_settings")
      .select("setting_key,setting_value")
      .in("setting_key", [
        FLUTTERWAVE_ENV_KEY,
        FLUTTERWAVE_PK_KEY,
        FLUTTERWAVE_SK_KEY,
        FLUTTERWAVE_SUCCESS_URL_KEY,
        FLUTTERWAVE_FAIL_URL_KEY,
      ]);
    if (error) {
      toast({ title: "Error fetching settings", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    let environment: "test" | "live" = "test";
    let fw_public_key = "";
    let fw_secret_key = "";
    let redirect_success = "";
    let redirect_failure = "";
    for (const row of data || []) {
      switch (row.setting_key) {
        case FLUTTERWAVE_ENV_KEY:
          environment = row.setting_value === "live" ? "live" : "test";
          break;
        case FLUTTERWAVE_PK_KEY:
          fw_public_key = row.setting_value ?? "";
          break;
        case FLUTTERWAVE_SK_KEY:
          fw_secret_key = row.setting_value ?? "";
          break;
        case FLUTTERWAVE_SUCCESS_URL_KEY:
          redirect_success = row.setting_value ?? "";
          break;
        case FLUTTERWAVE_FAIL_URL_KEY:
          redirect_failure = row.setting_value ?? "";
          break;
        default:
          break;
      }
    }
    setEnvironment(environment);
    setFwPublicKey(fw_public_key);
    setFwSecretKey(fw_secret_key);
    setRedirectSuccess(redirect_success);
    setRedirectFailure(redirect_failure);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Upsert each setting individually
    const updates = [
      { setting_key: FLUTTERWAVE_ENV_KEY, setting_value: environment },
      { setting_key: FLUTTERWAVE_PK_KEY, setting_value: fwPublicKey },
      { setting_key: FLUTTERWAVE_SK_KEY, setting_value: fwSecretKey, is_encrypted: true },
      { setting_key: FLUTTERWAVE_SUCCESS_URL_KEY, setting_value: redirectSuccess },
      { setting_key: FLUTTERWAVE_FAIL_URL_KEY, setting_value: redirectFailure },
    ];

    for (const update of updates) {
      const { error } = await supabase
        .from("admin_settings")
        .upsert([update], { onConflict: "setting_key" });
      if (error) {
        setSaving(false);
        toast({ title: "Error", description: `Failed to update ${update.setting_key}: ${error.message}`, variant: "destructive" });
        return;
      }
    }
    setSaving(false);
    toast({ title: "Settings Saved", description: "Your settings have been updated!" });
  };

  if (loading) {
    return <Card className="p-8">Loading settings...</Card>;
  }

  return (
    <Card className="max-w-xl mx-auto mt-6 p-8">
      <h2 className="font-bold text-lg mb-6">Flutterwave Payment Gateway Settings</h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="fw-environment">Mode</Label>
          <div className="flex items-center gap-4">
            <span className={environment === "test" ? "font-semibold" : ""}>Test</span>
            <Switch
              id="fw-environment"
              checked={environment === "live"}
              onCheckedChange={(v) => setEnvironment(v ? "live" : "test")}
            />
            <span className={environment === "live" ? "font-semibold" : ""}>Live</span>
          </div>
        </div>
        <div>
          <Label htmlFor="fw-public-key">Flutterwave Public Key</Label>
          <Input
            id="fw-public-key"
            value={fwPublicKey}
            onChange={(e) => setFwPublicKey(e.target.value)}
            placeholder="FLWPUBK-..."
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="fw-secret-key">Flutterwave Secret Key</Label>
          <Input
            id="fw-secret-key"
            value={fwSecretKey}
            onChange={(e) => setFwSecretKey(e.target.value)}
            placeholder="FLWSECK-..."
            autoComplete="off"
            type="password"
          />
        </div>
        <div>
          <Label htmlFor="fw-redirect-success">Redirect Success URL</Label>
          <Input
            id="fw-redirect-success"
            value={redirectSuccess}
            onChange={(e) => setRedirectSuccess(e.target.value)}
            placeholder="https://yourapp.com/success"
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="fw-redirect-failure">Redirect Failure URL</Label>
          <Input
            id="fw-redirect-failure"
            value={redirectFailure}
            onChange={(e) => setRedirectFailure(e.target.value)}
            placeholder="https://yourapp.com/failure"
            autoComplete="off"
          />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </Card>
  );
}
