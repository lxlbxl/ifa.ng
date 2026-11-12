import React, { useState } from "react";
import { Compass, X, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getBrowserAdvice, isStandalone } from "@/lib/pwa";

const KEY = "ifa-browser-advice-dismissed-at";
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/** Small dismissible banner shown only on browsers that can't install or fully run the PWA. */
const BrowserAdviceBanner: React.FC = () => {
  const [advice] = useState(getBrowserAdvice);
  const [hidden, setHidden] = useState(() => isStandalone() || Date.now() - Number(safeGet(KEY) || 0) < 3 * 864e5);
  if (advice.compatible || hidden) return null;
  const { reason, recommend } = advice as Extract<typeof advice, { compatible: false }>;

  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.origin); toast({ title: "Link copied", description: `Paste it into ${recommend}.` }); }
    catch { toast({ title: "Copy failed", description: `Open ${window.location.host} in ${recommend}.`, variant: "destructive" }); }
  };

  return (
    <div role="note" className="fixed inset-x-0 bottom-16 md:bottom-0 z-[55] bg-indigo-900 text-white text-xs sm:text-sm px-3 py-2 flex items-center gap-2 justify-center">
      <Compass className="h-4 w-4 shrink-0" />
      <span className="flex-1 sm:flex-none">{reason} For the best experience, open IFA.ng in <b>{recommend}</b>.</span>
      <Button size="sm" variant="secondary" className="h-7 px-2 shrink-0" onClick={copy}><Copy className="h-3 w-3 mr-1" />Copy link</Button>
      <button aria-label="Dismiss" className="shrink-0 p-1" onClick={() => { safeSet(KEY, String(Date.now())); setHidden(true); }}><X className="h-4 w-4" /></button>
    </div>
  );
};

export default BrowserAdviceBanner;
