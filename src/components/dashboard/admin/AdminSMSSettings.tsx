import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { sendSMS, isValidNigerianPhone } from "@/services/smsService";

const AdminSMSSettings = () => {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingSMS, setTestingSMS] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");

  const smsSettingsConfig = [
    { key: "sms_notifications_enabled", label: "Enable SMS Notifications", type: "boolean", description: "Turn SMS notifications on/off globally" },
    { key: "termii_api_key", label: "Termii API Key", type: "password", description: "Your Termii API Key for sending SMS" },
    { key: "termii_sender_id", label: "Sender ID", type: "text", description: "Sender ID (max 11 characters, e.g., IFA Connect)" },
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
        .in("setting_key", smsSettingsConfig.map(c => c.key));

      if (error) throw error;

      const settingsMap = (data || []).reduce((acc: any, item: any) => {
        acc[item.setting_key] = item.setting_value;
        return acc;
      }, {});

      setSettings(settingsMap);
    } catch (error) {
      console.error("Error fetching SMS settings:", error);
      toast({ title: "Error fetching SMS settings", variant: "destructive" });
    }
    setLoading(false);
  };

  const saveSMSSettings = async () => {
    setSaving(true);
    try {
      for (const config of smsSettingsConfig) {
        let value = settings[config.key];

        // Default values
        if (config.key === "sms_notifications_enabled" && value === undefined) {
          value = "false";
        }
        if (config.key === "termii_sender_id" && !value) {
          value = "IFA Connect";
        }

        await supabase
          .from("admin_settings")
          .upsert(
            {
              setting_key: config.key,
              setting_value: String(value),
              description: config.description,
            },
            { onConflict: "setting_key" }
          );
      }

      // Clear cache by invalidating it
      await supabase
        .from("admin_settings")
        .select("setting_key")
        .eq("setting_key", "sms_notifications_enabled")
        .single();

      toast({ title: "SMS settings saved successfully!" });
    } catch (error) {
      console.error("Error saving SMS settings:", error);
      toast({ title: "Error saving SMS settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleInputChange = (key: string, value: string | boolean) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const sendTestSMS = async () => {
    if (!testPhoneNumber) {
      toast({ title: "Please enter a test phone number", variant: "destructive" });
      return;
    }

    if (!isValidNigerianPhone(testPhoneNumber)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid Nigerian phone number (e.g., 08012345678)",
        variant: "destructive"
      });
      return;
    }

    if (!settings.sms_notifications_enabled || settings.sms_notifications_enabled === 'false') {
      toast({ title: "SMS notifications are disabled. Please enable them first.", variant: "destructive" });
      return;
    }

    if (!settings.termii_api_key) {
      toast({ title: "Please configure Termii API key first", variant: "destructive" });
      return;
    }

    setTestingSMS(true);
    try {
      const result = await sendSMS({
        to: testPhoneNumber,
        message: `This is a test SMS from IFA Connect. Your SMS configuration is working correctly. Sent at ${new Date().toLocaleTimeString()}.`
      });

      if (result) {
        toast({
          title: "Test SMS sent successfully!",
          description: `Check ${testPhoneNumber} for the test message.`
        });
      } else {
        toast({
          title: "Failed to send test SMS",
          description: "Please check your configuration and try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Error sending test SMS:", error);
      toast({
        title: "Error sending test SMS",
        description: error.message || "Unknown error occurred",
        variant: "destructive"
      });
    }
    setTestingSMS(false);
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
      {/* SMS Provider Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Notification Settings
          </CardTitle>
          <CardDescription>
            Configure SMS notifications using Termii for booking confirmations, wallet updates, and session alerts.
            Perfect for the Nigerian market with reliable delivery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* SMS Notifications Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Enable SMS Notifications</label>
              <p className="text-xs text-gray-500">Turn SMS notifications on/off globally</p>
            </div>
            <Switch
              checked={settings.sms_notifications_enabled === 'true' || settings.sms_notifications_enabled === true}
              onCheckedChange={(checked) => handleInputChange('sms_notifications_enabled', checked)}
            />
          </div>

          {/* Termii Settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Termii API Key</label>
              <Input
                type="password"
                value={settings.termii_api_key || ""}
                onChange={(e) => handleInputChange("termii_api_key", e.target.value)}
                placeholder="Enter your Termii API Key"
              />
              <p className="text-xs text-gray-500 mt-1">Your Termii API Key for sending SMS</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Sender ID</label>
              <Input
                type="text"
                maxLength={11}
                value={settings.termii_sender_id || ""}
                onChange={(e) => handleInputChange("termii_sender_id", e.target.value)}
                placeholder="IFA Connect"
              />
              <p className="text-xs text-gray-500 mt-1">
                Sender ID (max 11 characters). Must be approved by Termii.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={saveSMSSettings} disabled={saving}>
              {saving ? "Saving..." : "Save SMS Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test SMS Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test SMS Configuration
          </CardTitle>
          <CardDescription>
            Send a test SMS to verify your configuration is working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Test Phone Number</label>
            <Input
              type="tel"
              value={testPhoneNumber}
              onChange={(e) => setTestPhoneNumber(e.target.value)}
              placeholder="08012345678"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter a Nigerian phone number (e.g., 08012345678 or +2348012345678)
            </p>
          </div>
          <Button
            onClick={sendTestSMS}
            disabled={testingSMS || !testPhoneNumber}
            variant="outline"
          >
            {testingSMS ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Test SMS...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test SMS
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Termii Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Termii Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-600">
            <h4 className="font-medium mb-2">Why Termii?</h4>
            <p className="mb-3">
              Termii is a leading SMS provider in Nigeria with excellent delivery rates,
              competitive pricing, and reliable service. Perfect for the Nigerian market.
            </p>

            <h4 className="font-medium mb-2">To set up Termii integration:</h4>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Create an account at{' '}
                <a
                  href="https://termii.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  termii.com
                </a>
              </li>
              <li>Go to your Termii dashboard and navigate to API Settings</li>
              <li>Copy your API Key</li>
              <li>Paste it in the field above and save</li>
              <li>
                (Optional) Register a custom Sender ID for better branding
                <ul className="list-disc list-inside ml-6 mt-1 text-xs">
                  <li>Go to Sender ID section in Termii dashboard</li>
                  <li>Request a Sender ID (e.g., "IFA Connect" or "IFACONNECT")</li>
                  <li>Wait for approval (usually 24-48 hours)</li>
                  <li>Once approved, update the Sender ID field above</li>
                </ul>
              </li>
            </ol>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <h5 className="font-medium text-blue-900 mb-1">Pricing Information</h5>
              <p className="text-xs text-blue-800">
                Termii charges approximately ₦2.50 - ₦4.00 per SMS depending on your volume.
                They offer bulk pricing and competitive rates for Nigerian businesses.
              </p>
            </div>

            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
              <h5 className="font-medium text-green-900 mb-1">SMS Use Cases in IFA Connect</h5>
              <ul className="text-xs text-green-800 space-y-1">
                <li>✅ Booking confirmations</li>
                <li>✅ Wallet top-up notifications</li>
                <li>✅ Instant session alerts to Babalawos</li>
                <li>✅ Session reminders (30 minutes before)</li>
                <li>✅ Payment confirmations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSMSSettings;
