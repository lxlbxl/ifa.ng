import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eyebrow, SoundWave } from "@/components/brand";
import { API_URL } from "@/integrations/api/config";
import { ring, unlockOnFirstGesture, VIBRATE_NORMAL, VIBRATE_URGENT } from "@/lib/alerts";
import { useAuth } from "@/hooks/useAuth";
import { usePresenceGuard, type MyPresence } from "@/hooks/useBabalawoPresence";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { acceptInstantSession } from "@/utils/sessionActions";

interface Alert { id: string; type: string; title: string; body: string; url: string; urgent: boolean; sessionId: string | null }

const ALERT_TYPES = new Set(["instant_session_request", "session_booked"]);

const sessionIdOf = (raw: Record<string, unknown>): string | null => {
  const data = raw.data as Record<string, unknown> | undefined;
  if (data && data.session_id != null) return String(data.session_id);
  for (const k of ["url", "action_url"]) {
    const m = typeof raw[k] === "string" ? (raw[k] as string).match(/\/session\/(\d+)/) : null;
    if (m) return m[1];
  }
  return null;
};

/** One shape for alerts from the live stream (notification rows) and from push (service worker). */
function normalise(raw: Record<string, unknown>, from: "stream" | "push"): Alert | null {
  const type = String(raw.type ?? "");
  if (!ALERT_TYPES.has(type) || !raw.id) return null;
  const urgent = type === "instant_session_request";
  return {
    id: String(raw.id),
    type,
    urgent,
    url: typeof raw.url === "string" ? raw.url : typeof raw.action_url === "string" ? raw.action_url : "/dashboard?tab=consultations",
    sessionId: sessionIdOf(raw),
    title: urgent ? "A client is waiting" : String(raw.title ?? "New booking"),
    body: urgent ? "A client has paid to consult you now. Accept within a few minutes, or they are refunded."
      : String((from === "push" ? raw.body : raw.message) ?? "A client has booked a consultation."),
  };
}

/**
 * Babalawo alerts while the app is open: a ringing chime and vibration for
 * Consult Now, a single chime for new bookings. With the app closed, the service
 * worker's push notification does the same job.
 */
const BabalawoLiveAlerts: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const seen = useRef(new Set<string>());
  const stopRef = useRef<(() => void) | null>(null);
  const [active, setActive] = useState<Alert | null>(null);
  const [accepting, setAccepting] = useState(false);
  usePresenceGuard();
  useEffect(() => unlockOnFirstGesture(), []);

  const dismiss = useCallback(() => { stopRef.current?.(); stopRef.current = null; setActive(null); }, []);

  const handle = useCallback(async (a: Alert | null) => {
    if (!a || seen.current.has(a.id)) return;
    seen.current.add(a.id);
    qc.invalidateQueries({ queryKey: ["my-presence"] });
    stopRef.current?.();
    stopRef.current = ring({ urgent: a.urgent });

    // In a background tab with no server push yet, raise a system notification ourselves.
    const presence = user ? qc.getQueryData<MyPresence>(["my-presence", user.id]) : undefined;
    if (document.visibilityState !== "visible" && !presence?.push_configured && typeof Notification !== "undefined"
        && Notification.permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      reg?.showNotification(a.urgent ? "Consult Now: a client is waiting" : a.title, {
        body: a.body, icon: "/brand/icon-192.png", badge: "/brand/icon-192.png", tag: `alert-${a.id}`,
        requireInteraction: a.urgent, vibrate: a.urgent ? VIBRATE_URGENT : VIBRATE_NORMAL, data: { url: a.url },
      } as NotificationOptions);
    }

    if (a.urgent) setActive(a);
    else toast({ title: a.title, description: a.body });
  }, [qc, user]);

  // Live stream from the API.
  useEffect(() => {
    if (!user) return;
    const stream = new EventSource(`${API_URL}/v1/notifications/stream`, { withCredentials: true });
    stream.addEventListener("notification", (e) => {
      try { handle(normalise(JSON.parse((e as MessageEvent).data), "stream")); } catch { /* ignore */ }
    });
    return () => stream.close();
  }, [user, handle]);

  // Push messages the service worker forwards while the app is in front.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const on = (e: MessageEvent) => {
      if (e.data?.type === "ifa-push" && e.data.payload) handle(normalise(e.data.payload, "push"));
    };
    navigator.serviceWorker.addEventListener("message", on);
    return () => navigator.serviceWorker.removeEventListener("message", on);
  }, [handle]);

  return (
    <Dialog open={!!active} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-sm text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf text-ink ring-8 ring-leaf/30 animate-pulse">
          <BellRing className="h-7 w-7" />
        </div>
        <Eyebrow className="text-camwood">Consult Now</Eyebrow>
        <DialogTitle className="font-display text-display-sm text-ink">{active?.title}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">{active?.body}</DialogDescription>
        <SoundWave className="mx-auto [&>i]:bg-green-700" />
        <div className="mt-2 flex flex-col gap-2">
          <Button variant="sun" size="lg" disabled={accepting} onClick={async () => {
            const a = active; if (!a) return;
            if (a.sessionId) {
              setAccepting(true);
              try { await acceptInstantSession(a.sessionId); }
              catch (e) { toast({ title: "Could not accept", description: (e as Error).message, variant: "destructive" }); setAccepting(false); dismiss(); return; }
              setAccepting(false);
            }
            dismiss();
            navigate(a.sessionId ? `/session/${a.sessionId}` : a.url);
          }}>
            {accepting ? "Accepting…" : "Accept and join"}
          </Button>
          <Button variant="outline" onClick={dismiss}>Silence</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BabalawoLiveAlerts;
