import React, { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { enablePush, pushSupported } from "@/lib/pwa";

const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const perm = typeof Notification !== "undefined" ? Notification.permission : "default";
  const go = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const r = await enablePush();
      toast(r === "enabled" ? { title: "Push notifications on" }
        : r === "denied" ? { title: "Notifications blocked", description: "Allow them in your browser or phone settings.", variant: "destructive" }
        : r === "not-configured" ? { title: "Notifications on", description: "Alerts play while the app is open. Alerts with the app closed start once push is set up on the server." }
        : { title: "Not supported here", description: "On iPhone, install the app to your Home Screen first.", variant: "destructive" });
    } catch (e: any) { toast({ title: "Could not enable", description: e.message, variant: "destructive" }); }
    setBusy(false);
  };
  return (
    <Card className="max-w-xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" />Push notifications</CardTitle><CardDescription>Session reminders, new bookings and notes, even when the app is closed.</CardDescription></CardHeader>
      <CardContent>{perm === "granted" ? <p className="text-sm text-green-700">Enabled on this device.</p> : <Button onClick={go} disabled={busy || !pushSupported()}>{pushSupported() ? "Enable on this device" : "Not supported on this browser"}</Button>}</CardContent></Card>
  );
};
export default NotificationSettings;
