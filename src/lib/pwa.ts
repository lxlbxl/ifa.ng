import { supabase } from "@/integrations/supabase/client";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent("pwa-update-ready", { detail: reg }));
          }
        });
      });
    }).catch((e) => console.warn("[pwa] service worker registration failed", e));
  });
}

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const urlBase64ToUint8Array = (b64: string) => {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Asks permission and stores the subscription. Sending pushes needs a server job holding the VAPID private key. */
export async function enablePush(userId: string): Promise<"enabled" | "denied" | "unsupported" | "not-configured"> {
  if (!pushSupported()) return "unsupported";
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!key) return "not-configured";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  const json = sub.toJSON();
  const { error } = await (supabase as any).from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, user_agent: navigator.userAgent },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
  return "enabled";
}

// ---- Install button support ----
// beforeinstallprompt can fire before React mounts, so capture it at module load.
type InstallState = { event: any | null; installed: boolean };
const installState: InstallState = { event: null, installed: false };
const installListeners = new Set<() => void>();
const emitInstall = () => installListeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installState.event = e;
    emitInstall();
  });
  window.addEventListener("appinstalled", () => {
    installState.installed = true;
    installState.event = null;
    emitInstall();
  });
}

export const subscribeInstall = (l: () => void) => { installListeners.add(l); return () => { installListeners.delete(l); }; };
export const getInstallSnapshot = () => installState;

/** Triggers the browser's one-tap install. Returns "manual" when the browser needs manual steps (iOS, Firefox, etc). */
export async function triggerInstall(): Promise<"accepted" | "dismissed" | "manual"> {
  const ev = installState.event;
  if (!ev) return "manual";
  ev.prompt();
  const { outcome } = await ev.userChoice;
  installState.event = null; // a prompt event can only be used once
  emitInstall();
  return outcome === "accepted" ? "accepted" : "dismissed";
}
