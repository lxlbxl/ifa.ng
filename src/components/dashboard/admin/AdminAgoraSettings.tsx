
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Settings, Video } from "lucide-react";

const AdminVideoSettings = () => {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const videoProviderConfig = [
    { key: "video_provider", label: "Active Video Provider", type: "select", options: ["agora", "daily"], description: "Select which video provider to use for consultations" },
  ];

  const agoraSettingsConfig = [
    { key: "agora_app_id", label: "Agora App ID", type: "text", description: "Your Agora App ID" },
    { key: "agora_app_certificate", label: "Agora App Certificate", type: "password", description: "Your Agora App Certificate" },
    { key: "agora_token_expiry", label: "Token Expiry (seconds)", type: "number", description: "Token expiry duration in seconds" },
    { key: "agora_mode", label: "Agora Mode", type: "select", options: ["test", "live"], description: "Agora environment mode" },
  ];

  const dailySettingsConfig = [
    { key: "daily_api_key", label: "Daily.co API Key", type: "password", description: "Your Daily.co API Key" },
    { key: "daily_room_expiry", label: "Room Expiry (seconds)", type: "number", description: "Room expiry duration in seconds" },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const allSettingsKeys = [
        ...videoProviderConfig.map(c => c.key),
        ...agoraSettingsConfig.map(c => c.key),
        ...dailySettingsConfig.map(c => c.key)
      ];

      const { data, error } = await supabase
        .from("admin_settings")
        .select("setting_key, setting_value")
        .in("setting_key", allSettingsKeys);

      if (error) throw error;

      const settingsMap = (data || []).reduce((acc: any, item: any) => {
        acc[item.setting_key] = item.setting_value;
        return acc;
      }, {});

      setSettings(settingsMap);
    } catch (error) {
      console.error("Error fetching video settings:", error);
      toast({ title: "Error fetching video settings", variant: "destructive" });
    }
    setLoading(false);
  };

  const saveProviderSettings = async () => {
    setSaving(true);
    try {
      // Upsert provider setting
      for (const config of videoProviderConfig) {
        const value = settings[config.key] || "agora"; // Default to Agora
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

      toast({ title: "Video provider setting saved successfully!" });
    } catch (error) {
      console.error("Error saving video provider setting:", error);
      toast({ title: "Error saving video provider setting", variant: "destructive" });
    }
    setSaving(false);
  };

  const saveAgoraSettings = async () => {
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

  const saveDailySettings = async () => {
    setSaving(true);
    try {
      // Upsert each setting
      for (const config of dailySettingsConfig) {
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

      toast({ title: "Daily.co settings saved successfully!" });
    } catch (error) {
      console.error("Error saving Daily.co settings:", error);
      toast({ title: "Error saving Daily.co settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleInputChange = (key: string, value: string) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const testAgoraConnection = async () => {
    if (!settings.agora_app_id) {
      toast({ title: "Please enter Agora App ID first", variant: "destructive" });
      return;
    }
    
    toast({ title: "Test connection feature coming soon!" });
  };

  const testDailyConnection = async () => {
    if (!settings.daily_api_key) {
      toast({ title: "Please enter Daily.co API Key first", variant: "destructive" });
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
      {/* Video Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video Provider Selection
          </CardTitle>
          <CardDescription>
            Choose which video provider to use for consultation sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {videoProviderConfig.map((config) => (
            <div key={config.key}>
              <label className="block text-sm font-medium mb-2">{config.label}</label>
              <Select
                value={settings[config.key] || "agora"}
                onValueChange={(value) => handleInputChange(config.key, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${config.label}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agora">Agora</SelectItem>
                  <SelectItem value="daily">Daily.co</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">{config.description}</p>
            </div>
          ))}
          
          <div className="flex gap-3 pt-4">
            <Button onClick={saveProviderSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Provider Setting"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Provider-specific settings */}
      <Tabs defaultValue="agora" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agora">Agora Settings</TabsTrigger>
          <TabsTrigger value="daily">Daily.co Settings</TabsTrigger>
        </TabsList>
        
        {/* Agora Settings */}
        <TabsContent value="agora">
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
                <Button onClick={saveAgoraSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save Agora Settings"}
                </Button>
                <Button variant="outline" onClick={testAgoraConnection}>
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Agora Setup Instructions</CardTitle>
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
        </TabsContent>
        
        {/* Daily.co Settings */}
        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Daily.co Video Integration Settings
              </CardTitle>
              <CardDescription>
                Configure Daily.co credentials for video calling functionality. Make sure to keep your API Key secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dailySettingsConfig.map((config) => (
                <div key={config.key}>
                  <label className="block text-sm font-medium mb-2">{config.label}</label>
                  <Input
                    type={config.type}
                    value={settings[config.key] || ""}
                    onChange={(e) => handleInputChange(config.key, e.target.value)}
                    placeholder={`Enter ${config.label}`}
                  />
                  <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                </div>
              ))}
              
              <div className="flex gap-3 pt-4">
                <Button onClick={saveDailySettings} disabled={saving}>
                  {saving ? "Saving..." : "Save Daily.co Settings"}
                </Button>
                <Button variant="outline" onClick={testDailyConnection}>
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Daily.co Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600">
                <h4 className="font-medium mb-2">To set up Daily.co integration:</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create an account at <a href="https://daily.co" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">daily.co</a></li>
                  <li>Go to your Daily.co dashboard</li>
                  <li>Create an API key from the Developers section</li>
                  <li>Copy the API key and paste it in the field above</li>
                  <li>Set the room expiry time (default is 3600 seconds / 1 hour)</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminVideoSettings;
