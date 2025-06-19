
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Settings } from "lucide-react";

const AdminAgoraSettings = () => {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const agoraSettingsConfig = [
    { key: "agora_app_id", label: "Agora App ID", type: "text", description: "Your Agora App ID" },
    { key: "agora_app_certificate", label: "Agora App Certificate", type: "password", description: "Your Agora App Certificate" },
    { key: "agora_token_expiry", label: "Token Expiry (seconds)", type: "number", description: "Token expiry duration in seconds" },
    { key: "agora_mode", label: "Agora Mode", type: "select", options: ["test", "live"], description: "Agora environment mode" },
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
        .in("setting_key", agoraSettingsConfig.map(c => c.key));

      if (error) throw error;

      const settingsMap = (data || []).reduce((acc: any, item: any) => {
        acc[item.setting_key] = item.setting_value;
        return acc;
      }, {});

      setSettings(settingsMap);
    } catch (error) {
      console.error("Error fetching Agora settings:", error);
      toast({ title: "Error fetching Agora settings", variant: "destructive" });
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Upsert each setting
      for (const config of agoraSettingsConfig) {
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

      toast({ title: "Agora settings saved successfully!" });
    } catch (error) {
      console.error("Error saving Agora settings:", error);
      toast({ title: "Error saving Agora settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleInputChange = (key: string, value: string) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const testConnection = async () => {
    if (!settings.agora_app_id) {
      toast({ title: "Please enter App ID first", variant: "destructive" });
      return;
    }
    
    toast({ title: "Test connection feature coming soon!" });
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Agora Video Integration Settings
          </CardTitle>
          <CardDescription>
            Configure Agora credentials for video calling functionality. Make sure to keep your App Certificate secure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {agoraSettingsConfig.map((config) => (
            <div key={config.key}>
              <label className="block text-sm font-medium mb-2">{config.label}</label>
              {config.type === "select" ? (
                <Select
                  value={settings[config.key] || ""}
                  onValueChange={(value) => handleInputChange(config.key, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${config.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {config.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          
          <div className="flex gap-3 pt-4">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            <Button variant="outline" onClick={testConnection}>
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-600">
            <h4 className="font-medium mb-2">To set up Agora integration:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Create an account at <a href="https://agora.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">agora.io</a></li>
              <li>Create a new project in your Agora console</li>
              <li>Copy the App ID and App Certificate from your project</li>
              <li>Paste them in the fields above and save</li>
              <li>Set the mode to "test" for development or "live" for production</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAgoraSettings;
