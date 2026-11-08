import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const useOnline = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
};

/** Offline bar and update toast. Installing is done through the always-visible InstallButton. */
const PwaPrompts: React.FC = () => {
  const online = useOnline();
  const [updateReg, setUpdateReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const onUpdate = (e: Event) => setUpdateReg((e as CustomEvent).detail);
    window.addEventListener("pwa-update-ready", onUpdate);
    return () => window.removeEventListener("pwa-update-ready", onUpdate);
  }, []);

  return (
    <>
      {!online && (
        <div role="status" className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-white text-sm py-1.5 px-4 flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" /> You're offline. Showing saved data; changes need a connection.
        </div>
      )}
      {updateReg && (
        <div className="fixed bottom-28 md:bottom-12 inset-x-4 md:left-auto md:right-4 md:w-80 z-[60] bg-white border shadow-lg rounded-xl p-3 flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm flex-1">A new version is ready.</span>
          <Button size="sm" onClick={() => { updateReg.waiting?.postMessage("SKIP_WAITING"); window.location.reload(); }}>Update</Button>
        </div>
      )}
    </>
  );
};

export default PwaPrompts;
