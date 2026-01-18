
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import AdminWalletManagement from "./AdminWalletManagement";
import AdminVideoSettings from "./AdminVideoSettings";
import AdminEmailSettings from "./AdminEmailSettings";

const AdminSettingsPanel = () => {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const paymentSettingsConfig = [
    { key: "flutterwave_public_key", label: "Flutterwave Public Key", type: "text", description: "Your Flutterwave public key" },
    { key: "flutterwave_secret_key", label: "Flutterwave Secret Key", type: "password", description: "Your Flutterwave secret key" },
    { key: "flutterwave_environment", label: "Flutterwave Environment", type: "select", options: ["sandbox", "live"], description: "Flutterwave environment" },
    { key: "paystack_public_key", label: "Paystack Public Key", type: "text", description: "Your Paystack public key" },
    { key: "paystack_secret_key", label: "Paystack Secret Key", type: "password", description: "Your Paystack secret key" },
    { key: "paystack_environment", label: "Paystack Environment", type: "select", options: ["test", "live"], description: "Paystack environment" },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("setting_key, setting_value")
        .in("setting_key", paymentSettingsConfig.map(c => c.key));

      if (error) throw error;

      const settingsMap = (data || []).reduce((acc: any, item: any) => {
        acc[item.setting_key] = item.setting_value;
        return acc;
      }, {});

      setSettings(settingsMap);
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({ title: "Error fetching settings", variant: "destructive" });
    }
    setLoading(false);
  };

  const savePaymentSettings = async () => {
    setSaving(true);
    try {
      // Upsert each setting
      for (const config of paymentSettingsConfig) {
        const value = settings[config.key] || "";
        await supabase
          .from("admin_settings")
          .upsert(
            {
              setting_key: config.key,
              setting_value: value,
              description: config.description,
            },
            { onConflict: "setting_key" }
          );
      }

      toast({ title: "Payment settings saved successfully!" });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "Error saving settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleInputChange = (key: string, value: string) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="agora" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agora">Video Settings</TabsTrigger>
          <TabsTrigger value="payments">Payment Gateways</TabsTrigger>
          <TabsTrigger value="email">Email Settings</TabsTrigger>
          <TabsTrigger value="wallet">Wallet Management</TabsTrigger>
        </TabsList>
        
        <TabsContent value="agora">
          <AdminVideoSettings />
        </TabsContent>
        
        <TabsContent value="payments">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Flutterwave Settings</CardTitle>
                <CardDescription>Configure Flutterwave payment integration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentSettingsConfig.filter(c => c.key.startsWith('flutterwave')).map((config) => (
                  <div key={config.key}>
                    <label className="block text-sm font-medium mb-2">{config.label}</label>
                    {config.type === "select" ? (
                      <select
                        value={settings[config.key] || ""}
                        onChange={(e) => handleInputChange(config.key, e.target.value)}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="">Select {config.label}</option>
                        {config.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={config.type}
                        value={settings[config.key] || ""}
                        onChange={(e) => handleInputChange(config.key, e.target.value)}
                        placeholder={`Enter ${config.label}`}
                      />
                    )}
                    <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Paystack Settings</CardTitle>
                <CardDescription>Configure Paystack payment integration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentSettingsConfig.filter(c => c.key.startsWith('paystack')).map((config) => (
                  <div key={config.key}>
                    <label className="block text-sm font-medium mb-2">{config.label}</label>
                    {config.type === "select" ? (
                      <select
                        value={settings[config.key] || ""}
                        onChange={(e) => handleInputChange(config.key, e.target.value)}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="">Select {config.label}</option>
                        {config.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={config.type}
                        value={settings[config.key] || ""}
                        onChange={(e) => handleInputChange(config.key, e.target.value)}
                        placeholder={`Enter ${config.label}`}
                      />
                    )}
                    <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
              
            <div className="pt-4">
              <Button onClick={savePaymentSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Payment Settings"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="email">
          <AdminEmailSettings />
        </TabsContent>

        <TabsContent value="wallet">
          <AdminWalletManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettingsPanel;
