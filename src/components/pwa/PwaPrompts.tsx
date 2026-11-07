import React, { useEffect, useState } from "react";
import { Download, WifiOff, RefreshCw, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIos, isStandalone } from "@/lib/pwa";

const DISMISS_KEY = "ifa-install-dismissed-at";
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export const useOnline = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
};

/** Install banner (Android/desktop via beforeinstallprompt, iOS via Share instructions), offline bar, update toast. */
const PwaPrompts: React.FC = () => {
  const online = useOnline();
  const [deferred, setDeferred] = useState<any>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [updateReg, setUpdateReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const dismissedAt = Number(safeGet(DISMISS_KEY) || 0);
    const recentlyDismissed = Date.now() - dismissedAt < 7 * 864e5;
    if (isStandalone() || recentlyDismissed) { setHidden(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIos()) setShowIos(true);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  useEffect(() => {
    const onUpdate = (e: Event) => setUpdateReg((e as CustomEvent).detail);
    window.addEventListener("pwa-update-ready", onUpdate);
    return () => window.removeEventListener("pwa-update-ready", onUpdate);
  }, []);

  const dismiss = () => { safeSet(DISMISS_KEY, String(Date.now())); setHidden(true); };
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setHidden(true);
  };

  return (
    <>
      {!online && (
        <div role="status" className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-white text-sm py-1.5 px-4 flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" /> You're offline. Showing saved data; changes need a connection.
        </div>
      )}
      {updateReg && (
        <div className="fixed bottom-20 md:bottom-4 inset-x-4 md:left-auto md:right-4 md:w-80 z-[60] bg-white border shadow-lg rounded-xl p-3 flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm flex-1">A new version is ready.</span>
          <Button size="sm" onClick={() => { updateReg.waiting?.postMessage("SKIP_WAITING"); window.location.reload(); }}>Update</Button>
        </div>
      )}
      {!hidden && (deferred || showIos) && (
        <div className="fixed bottom-20 md:bottom-4 inset-x-4 md:left-auto md:right-4 md:w-96 z-50 bg-white border shadow-xl rounded-2xl p-4">
          <button aria-label="Dismiss" onClick={dismiss} className="absolute top-2 right-2 text-gray-400"><X className="h-4 w-4" /></button>
          <div className="flex gap-3">
            <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Install IFA.ng</p>
              {deferred ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">Get one-tap access to sessions, reminders and notes.</p>
                  <Button size="sm" onClick={install}><Download className="h-4 w-4 mr-1" /> Install app</Button>
                </>
              ) : (
                <p className="text-sm text-gray-600">Tap <Share className="inline h-4 w-4" /> Share, then "Add to Home Screen".</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaPrompts;
