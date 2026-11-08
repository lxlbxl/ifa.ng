import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, apiFetch } from "@/integrations/api/config";
import { currentPushEndpoint, disablePush, ensureNotifications, notificationPermission } from "@/lib/pwa";
import { ring, unlockAudio } from "@/lib/alerts";
import { toast } from "@/hooks/use-toast";

export interface MyPresence {
  /** What clients see: busy while in a session, offline until the profile is approved. */
  status: "online" | "busy" | "offline";
  available_now: boolean;
  last_seen_at: string | null;
  /** Where the Babalawo's own switch is. */
  own_status: "online" | "busy" | "offline";
  /** Verified and active, so clients can find them. */
  listed: boolean;
  /** The server holds VAPID keys, so alerts reach the phone with the app closed. */
  push_configured: boolean;
}

export type PresenceProblem = { reason: "denied" | "unsupported" | "ios-install" | "error"; message: string };

const HEARTBEAT_MS = 2 * 60_000;

/**
 * The Babalawo's Online switch. Going Online always turns notifications on first
 * (asking the browser if needed); it refuses if they can't be turned on.
 */
export function useBabalawoPresence() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["my-presence", user?.id];
  const [phase, setPhase] = useState<"idle" | "notifications" | "saving">("idle");
  const [problem, setProblem] = useState<PresenceProblem | null>(null);
  const [permission, setPermission] = useState(notificationPermission());
  const [endpoint, setEndpoint] = useState<string | null>(null);

  // The query doubles as the heartbeat: it re-runs every 2 minutes while Online and the app is visible.
  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: () => apiFetch<MyPresence>("/v1/me/presence/heartbeat", { method: "POST" }),
    refetchInterval: (query) => (query.state.data?.own_status === "online" ? HEARTBEAT_MS : false),
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });

  const refreshDevice = useCallback(async () => {
    setPermission(notificationPermission());
    setEndpoint(await currentPushEndpoint().catch(() => null));
  }, []);
  useEffect(() => {
    refreshDevice();
    const on = () => document.visibilityState === "visible" && refreshDevice();
    document.addEventListener("visibilitychange", on);
    window.addEventListener("focus", on);
    return () => { document.removeEventListener("visibilitychange", on); window.removeEventListener("focus", on); };
  }, [refreshDevice]);

  const save = useCallback(async (status: "online" | "offline", extra: Record<string, unknown> = {}) => {
    const p = await apiFetch<MyPresence>("/v1/me/presence", { method: "POST", body: JSON.stringify({ status, ...extra }) });
    qc.setQueryData(key, p);
    return p;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, user?.id]);

  /** Call from a tap: permission prompts and sound unlock need one. */
  const goOnline = useCallback(async () => {
    setProblem(null);
    unlockAudio();
    setPhase("notifications");
    const n = await ensureNotifications();
    await refreshDevice();
    if (n.ok === false) { setProblem(n as PresenceProblem); setPhase("idle"); return false; }
    setPhase("saving");
    try {
      await save("online", { endpoint: n.endpoint, permission: n.permission });
      ring({ urgent: false });
      return true;
    } catch (e) {
      setProblem({ reason: "error", message: e instanceof ApiError ? e.message : "Could not go Online. Check your connection and try again." });
      return false;
    } finally {
      setPhase("idle");
    }
  }, [refreshDevice, save]);

  const goOffline = useCallback(async () => {
    setProblem(null);
    setPhase("saving");
    try { await save("offline"); return true; }
    catch (e) { setProblem({ reason: "error", message: (e as Error).message }); return false; }
    finally { setPhase("idle"); }
  }, [save]);

  /** Notifications are required while Online, so switching them off also goes Offline. */
  const turnOffNotifications = useCallback(async () => {
    await goOffline();
    await disablePush();
    await refreshDevice();
    qc.invalidateQueries({ queryKey: key });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goOffline, refreshDevice, qc, user?.id]);

  const sendTestAlert = useCallback(async () => {
    unlockAudio();
    const stop = ring({ urgent: true, maxMs: 5200 });
    if (q.data?.push_configured && endpoint) {
      await apiFetch("/v1/me/push-test", { method: "POST" }).catch((e) =>
        toast({ title: "Test push did not arrive", description: (e as Error).message, variant: "destructive" }));
    }
    return stop;
  }, [q.data?.push_configured, endpoint]);

  const own = q.data?.own_status ?? "offline";
  return {
    presence: q.data,
    loading: q.isLoading,
    online: own === "online" || own === "busy",
    busy: q.data?.status === "busy",
    phase,
    problem,
    clearProblem: () => setProblem(null),
    permission,
    endpoint,
    goOnline,
    goOffline,
    turnOffNotifications,
    sendTestAlert,
    refresh: () => qc.invalidateQueries({ queryKey: key }),
  };
}

/**
 * Mount once on the Babalawo dashboard: if notifications get blocked while Online,
 * go Offline straight away, because Consult Now requests would go unheard.
 */
export function usePresenceGuard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const p = qc.getQueryData<MyPresence>(["my-presence", user.id]);
      if (p?.own_status !== "online") return;
      if (notificationPermission() === "granted") return;
      try {
        const next = await apiFetch<MyPresence>("/v1/me/presence", { method: "POST", body: JSON.stringify({ status: "offline" }) });
        qc.setQueryData(["my-presence", user.id], next);
        toast({ title: "You are now Offline", description: "Notifications were turned off on this device. Switch Online again to turn them back on.", variant: "destructive" });
      } catch { /* try again on the next check */ }
    };
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(check, 60_000);
    let status: PermissionStatus | null = null;
    navigator.permissions?.query({ name: "notifications" as PermissionName }).then((s) => { status = s; s.onchange = check; }).catch(() => {});
    check();
    return () => { document.removeEventListener("visibilitychange", onVisible); clearInterval(id); if (status) status.onchange = null; };
  }, [user, qc]);
}
