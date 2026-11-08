import { apiFetch } from "@/integrations/api/config";

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

export const notificationPermission = (): NotificationPermission | "unsupported" =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

let pushKey: Promise<string | null> | null = null;
/** The server's VAPID public key (falls back to the build-time one). null until push is set up. */
export function getPushPublicKey(): Promise<string | null> {
  pushKey ??= apiFetch<{ publicKey: string | null }>("/v1/push/config")
    .then((r) => r.publicKey || (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || null)
    .catch(() => { pushKey = null; return (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || null; });
  return pushKey;
}

const swReady = (ms = 6000) => Promise.race([
  navigator.serviceWorker.ready,
  new Promise<null>((r) => setTimeout(() => r(null), ms)),
]);

/** This device's push endpoint, if it has one. */
export async function currentPushEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await swReady(1500);
  return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
}

export type NotificationsFailure = { ok: false; reason: "denied" | "unsupported" | "ios-install" | "error"; message: string };
export type NotificationsResult =
  | { ok: true; push: boolean; endpoint: string | null; permission: NotificationPermission }
  | { ok: false; reason: "denied" | "unsupported" | "ios-install" | "error"; message: string };

/**
 * Turns notifications on for this device: asks permission (call from a tap), then
 * subscribes to web push and registers the device with the API when push is set up.
 */
export async function ensureNotifications(): Promise<NotificationsResult> {
  const iosTab = isIos() && !isStandalone();
  if (typeof Notification === "undefined") {
    return iosTab
      ? { ok: false, reason: "ios-install", message: "On iPhone and iPad, add IFA.ng to your Home Screen first, then open it from there." }
      : { ok: false, reason: "unsupported", message: "This browser can't show notifications. Use Chrome, Edge or Safari." };
  }
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "denied", message: "Notifications are blocked for IFA.ng. Allow them in your browser or phone settings, then try again." };
  }
  const key = await getPushPublicKey();
  if (!key) return { ok: true, push: false, endpoint: null, permission }; // server push not set up yet: in-app alerts only
  if (!pushSupported()) {
    return iosTab
      ? { ok: false, reason: "ios-install", message: "On iPhone and iPad, add IFA.ng to your Home Screen first, then open it from there." }
      : { ok: false, reason: "unsupported", message: "This browser can't receive alerts while closed. Use Chrome, Edge or Safari." };
  }
  try {
    const reg = await swReady();
    if (!reg) return { ok: false, reason: "error", message: "The app is still loading. Try again in a moment." };
    const appKey = urlBase64ToUint8Array(key);
    let sub = await reg.pushManager.getSubscription();
    const sameKey = (s: PushSubscription) => {
      const k = s.options?.applicationServerKey;
      if (!k) return true;
      const a = new Uint8Array(k);
      return a.length === appKey.length && a.every((v, i) => v === appKey[i]);
    };
    if (sub && !sameKey(sub)) { await sub.unsubscribe(); sub = null; }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    await apiFetch("/v1/me/push-subscription", { method: "PUT", body: JSON.stringify(sub.toJSON()) });
    return { ok: true, push: true, endpoint: sub.endpoint, permission };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error)?.message || "Could not turn on notifications." };
  }
}

/** Removes this device's push subscription. The API takes a Babalawo Offline if no device is left. */
export async function disablePush(): Promise<{ went_offline?: boolean }> {
  if (!pushSupported()) return {};
  const reg = await swReady(1500);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return {};
  const r = await apiFetch<{ went_offline?: boolean }>("/v1/me/push-subscription", {
    method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => ({}));
  await sub.unsubscribe().catch(() => {});
  return r;
}

/** Kept for the Settings screen. */
export async function enablePush(): Promise<"enabled" | "denied" | "unsupported" | "not-configured"> {
  const r = await ensureNotifications();
  if (r.ok === true) return r.push ? "enabled" : "not-configured";
  const f = r as NotificationsFailure;
  if (f.reason === "denied") return "denied";
  if (f.reason === "error") throw new Error(f.message);
  return "unsupported";
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

// ---- Browser compatibility ----
export type BrowserAdvice = { compatible: true } | { compatible: false; reason: string; recommend: string; inApp: boolean };

/** Which browsers can truly install and run the PWA (installable app, service worker, push). */
export function getBrowserAdvice(): BrowserAdvice {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|; wv\)|GSA\//i.test(ua);
  const firefox = /firefox|fxios/i.test(ua);
  const chromiumFamily = /chrome|crios|edg|opr|samsungbrowser|brave/i.test(ua) && !firefox;
  const safari = /safari/i.test(ua) && !/chrome|crios|fxios|edg|opr|android/i.test(ua);
  const best = ios ? "Safari" : android ? "Chrome" : "Chrome or Edge";

  if (inApp) return { compatible: false, inApp: true, recommend: best, reason: "You're in an app's built-in browser, which can't install IFA.ng." };
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return { compatible: false, inApp: false, recommend: best, reason: "This browser can't run the IFA.ng app features." };
  if (ios) return safari ? { compatible: true } : { compatible: false, inApp: false, recommend: "Safari", reason: "On iPhone and iPad the app installs from Safari." };
  if (firefox) return { compatible: false, inApp: false, recommend: best, reason: "Firefox can't install IFA.ng as an app on most devices." };
  if (chromiumFamily || safari) return { compatible: true };
  return { compatible: false, inApp: false, recommend: best, reason: "This browser may not support installing the app." };
}
