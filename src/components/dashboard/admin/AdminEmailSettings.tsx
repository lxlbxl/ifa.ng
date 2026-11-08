
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail, Send, Settings } from "lucide-react";

const AdminEmailSettings = () => {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");

  const emailProviderConfig = [
    { key: "email_provider", label: "Active Email Provider", type: "select", options: ["sendgrid", "resend", "smtp"], description: "Select which email provider to use for notifications" },
    { key: "email_notifications_enabled", label: "Enable Email Notifications", type: "boolean", description: "Turn email notifications on/off globally" },
  ];

  const sendgridSettingsConfig = [
    { key: "sendgrid_api_key", label: "SendGrid API Key", type: "password", description: "Your SendGrid API Key" },
  ];

  const resendSettingsConfig = [
    { key: "resend_api_key", label: "Resend API Key", type: "password", description: "Your Resend API Key" },
  ];

  const smtpSettingsConfig = [
    { key: "smtp_host", label: "SMTP Host", type: "text", description: "SMTP server hostname (e.g., smtp.gmail.com)" },
    { key: "smtp_port", label: "SMTP Port", type: "number", description: "SMTP server port (usually 587 for TLS)" },
    { key: "smtp_username", label: "SMTP Username", type: "text", description: "SMTP authentication username (usually your email)" },
    { key: "smtp_password", label: "SMTP Password", type: "password", description: "SMTP authentication password or app password" },
    { key: "smtp_from_email", label: "From Email Address", type: "email", description: "Email address to send from" },
    { key: "smtp_from_name", label: "From Name", type: "text", description: "Display name for sent emails (default: IFA Connect)" },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const allSettingsKeys = [
        ...emailProviderConfig.map(c => c.key),
        ...sendgridSettingsConfig.map(c => c.key),
        ...resendSettingsConfig.map(c => c.key),
        ...smtpSettingsConfig.map(c => c.key)
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
      console.error("Error fetching email settings:", error);
      toast({ title: "Error fetching email settings", variant: "destructive" });
    }
    setLoading(false);
  };

  const saveProviderSettings = async () => {
    setSaving(true);
    try {
      // Upsert provider settings
      for (const config of emailProviderConfig) {
        let value = settings[config.key];

        // Default values
        if (config.key === "email_provider" && !value) {
          value = "smtp";
        }
        if (config.key === "email_notifications_enabled" && value === undefined) {
          value = "true";
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

      toast({ title: "Email provider settings saved successfully!" });
    } catch (error) {
      console.error("Error saving email provider settings:", error);
      toast({ title: "Error saving email provider settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const saveSendGridSettings = async () => {
    setSaving(true);
    try {
      for (const config of sendgridSettingsConfig) {
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

      toast({ title: "SendGrid settings saved successfully!" });
    } catch (error) {
      console.error("Error saving SendGrid settings:", error);
      toast({ title: "Error saving SendGrid settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const saveResendSettings = async () => {
    setSaving(true);
    try {
      for (const config of resendSettingsConfig) {
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

      toast({ title: "Resend settings saved successfully!" });
    } catch (error) {
      console.error("Error saving Resend settings:", error);
      toast({ title: "Error saving Resend settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const saveSMTPSettings = async () => {
    setSaving(true);
    try {
      for (const config of smtpSettingsConfig) {
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

      toast({ title: "SMTP settings saved successfully!" });
    } catch (error) {
      console.error("Error saving SMTP settings:", error);
      toast({ title: "Error saving SMTP settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleInputChange = (key: string, value: string | boolean) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const sendTestEmail = async () => {
    if (!testEmailAddress) {
      toast({ title: "Please enter a test email address", variant: "destructive" });
      return;
    }

    if (!settings.email_notifications_enabled || settings.email_notifications_enabled === 'false') {
      toast({ title: "Email notifications are disabled. Please enable them first.", variant: "destructive" });
      return;
    }

    const provider = settings.email_provider || 'smtp';

    // Validate provider settings
    if (provider === 'sendgrid' && !settings.sendgrid_api_key) {
      toast({ title: "Please configure SendGrid API key first", variant: "destructive" });
      return;
    }
    if (provider === 'resend' && !settings.resend_api_key) {
      toast({ title: "Please configure Resend API key first", variant: "destructive" });
      return;
    }
    if (provider === 'smtp' && (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password)) {
      toast({ title: "Please configure SMTP settings first", variant: "destructive" });
      return;
    }

    setTestingEmail(true);
    try {
      // Import the email service
      const { sendEmail } = await import("@/services/emailService");

      const testEmailContent = {
        to: testEmailAddress,
        subject: "IFA Connect - Test Email",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Test Email Successful!</h1>
                </div>
                <div class="content">
                  <div class="success-icon">✅</div>
                  <p>Congratulations! Your email configuration is working correctly.</p>
                  <p><strong>Provider:</strong> ${provider.toUpperCase()}</p>
                  <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
                  <p>This is a test email sent from your IFA Connect admin panel to verify your email settings.</p>
                </div>
                <div class="footer">
                  <p>This email was sent by IFA Connect Email Service</p>
                  <p>© ${new Date().getFullYear()} IFA Connect. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `Test Email Successful!\n\nYour email configuration is working correctly.\n\nProvider: ${provider.toUpperCase()}\nSent at: ${new Date().toLocaleString()}\n\nThis is a test email from IFA Connect.`
      };

      const result = await sendEmail(testEmailContent);

      if (result) {
        toast({
          title: "Test email sent successfully!",
          description: `Check ${testEmailAddress} for the test email.`
        });
      } else {
        toast({
          title: "Failed to send test email",
          description: "Please check your configuration and try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast({
        title: "Error sending test email",
        description: error.message || "Unknown error occurred",
        variant: "destructive"
      });
    }
    setTestingEmail(false);
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
      {/* Email Provider Selection & Global Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notification Settings
          </CardTitle>
          <CardDescription>
            Configure email notifications for booking confirmations, wallet updates, and instant session alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email Notifications Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Enable Email Notifications</label>
              <p className="text-xs text-gray-500">Turn email notifications on/off globally</p>
            </div>
            <Switch
              checked={settings.email_notifications_enabled === 'true' || settings.email_notifications_enabled === true}
              onCheckedChange={(checked) => handleInputChange('email_notifications_enabled', checked)}
            />
          </div>

          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Email Provider</label>
            <Select
              value={settings.email_provider || "smtp"}
              onValueChange={(value) => handleInputChange("email_provider", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Email Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="smtp">SMTP</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Choose which email service to use for sending notifications
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={saveProviderSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Email Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test Email Configuration
          </CardTitle>
          <CardDescription>
            Send a test email to verify your configuration is working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Test Email Address</label>
            <Input
              type="email"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              placeholder="Enter email address to send test email"
            />
          </div>
          <Button
            onClick={sendTestEmail}
            disabled={testingEmail || !testEmailAddress}
            variant="outline"
          >
            {testingEmail ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Test Email...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test Email
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Provider-specific settings */}
      <Tabs defaultValue="sendgrid" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sendgrid">SendGrid</TabsTrigger>
          <TabsTrigger value="resend">Resend</TabsTrigger>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
        </TabsList>

        {/* SendGrid Settings */}
        <TabsContent value="sendgrid">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                SendGrid Integration Settings
              </CardTitle>
              <CardDescription>
                Configure SendGrid API credentials. SendGrid is a reliable cloud-based email delivery service.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sendgridSettingsConfig.map((config) => (
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
                <Button onClick={saveSendGridSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save SendGrid Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>SendGrid Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600">
                <h4 className="font-medium mb-2">To set up SendGrid integration:</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create an account at <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">sendgrid.com</a></li>
                  <li>Go to Settings → API Keys in your SendGrid dashboard</li>
                  <li>Click "Create API Key" and give it full access or mail send permissions</li>
                  <li>Copy the API key (you'll only see it once)</li>
                  <li>Paste it in the field above and save</li>
                  <li>Verify your sender email address in SendGrid to avoid delivery issues</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resend Settings */}
        <TabsContent value="resend">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Resend Integration Settings
              </CardTitle>
              <CardDescription>
                Configure Resend API credentials. Resend is a modern email API for developers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {resendSettingsConfig.map((config) => (
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
                <Button onClick={saveResendSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save Resend Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Resend Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600">
                <h4 className="font-medium mb-2">To set up Resend integration:</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create an account at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">resend.com</a></li>
                  <li>Go to API Keys in your Resend dashboard</li>
                  <li>Click "Create API Key" and give it a name</li>
                  <li>Copy the API key</li>
                  <li>Paste it in the field above and save</li>
                  <li>Add and verify your domain in Resend for better deliverability</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMTP Settings */}
        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                SMTP Integration Settings
              </CardTitle>
              <CardDescription>
                Configure custom SMTP server credentials. Works with any SMTP provider (Gmail, Outlook, custom servers).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {smtpSettingsConfig.map((config) => (
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
                <Button onClick={saveSMTPSettings} disabled={saving}>
                  {saving ? "Saving..." : "Save SMTP Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>SMTP Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600">
                <h4 className="font-medium mb-2">Common SMTP Configurations:</h4>

                <div className="space-y-3 mt-3">
                  <div className="border-l-4 border-blue-500 pl-3">
                    <h5 className="font-medium">Gmail SMTP:</h5>
                    <ul className="text-xs space-y-1 mt-1">
                      <li>Host: smtp.gmail.com</li>
                      <li>Port: 587</li>
                      <li>Username: your-email@gmail.com</li>
                      <li>Password: Use App Password (not your regular password)</li>
                      <li>Enable 2FA and create App Password at: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">myaccount.google.com/apppasswords</a></li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-green-500 pl-3">
                    <h5 className="font-medium">Outlook/Office 365 SMTP:</h5>
                    <ul className="text-xs space-y-1 mt-1">
                      <li>Host: smtp-mail.outlook.com</li>
                      <li>Port: 587</li>
                      <li>Username: your-email@outlook.com</li>
                      <li>Password: Your account password</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-3">
                    <h5 className="font-medium">Custom SMTP Server:</h5>
                    <ul className="text-xs space-y-1 mt-1">
                      <li>Contact your hosting provider or IT department</li>
                      <li>Get the SMTP host, port, and credentials</li>
                      <li>Most servers use port 587 (TLS) or 465 (SSL)</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs"><strong>Note:</strong> For Gmail, you must enable 2-Factor Authentication and create an App Password. Regular passwords will not work with SMTP.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminEmailSettings;
