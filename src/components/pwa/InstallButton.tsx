import React, { useState, useSyncExternalStore } from "react";
import { Download, Share, MoreVertical, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { getInstallSnapshot, isIos, isStandalone, subscribeInstall, triggerInstall } from "@/lib/pwa";

interface Props {
  variant?: "header" | "hero" | "block";
  className?: string;
  label?: string;
}

/** Always-visible install button. One click starts the install: the browser shows its own confirm, then the app is added to the device. */
const InstallButton: React.FC<Props> = ({ variant = "header", className = "", label = "Install App" }) => {
  const state = useSyncExternalStore(subscribeInstall, getInstallSnapshot);
  const [help, setHelp] = useState(false);
  if (state.installed || isStandalone()) return null;

  const click = async () => {
    const result = await triggerInstall();
    if (result === "accepted") toast({ title: "Installing IFA.ng", description: "It will appear on your home screen or app list in a moment." });
    else if (result === "manual") setHelp(true);
  };

  const size = variant === "hero" ? "lg" : variant === "block" ? "lg" : "sm";
  const extra = variant === "hero" ? "text-base px-6 shadow-lg" : variant === "block" ? "w-full" : "";
  return (
    <>
      <Button onClick={click} size={size as any} className={`gap-2 font-semibold ${extra} ${className}`} aria-label="Install the IFA.ng app">
        <Download className="h-4 w-4" />{label}
      </Button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add IFA.ng to your device</DialogTitle>
            <DialogDescription>Your browser needs one extra step to install the app.</DialogDescription>
          </DialogHeader>
          {isIos() ? (
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2 items-start"><Share className="h-5 w-5 shrink-0 text-primary" />Tap the <b>Share</b> button in Safari's toolbar.</li>
              <li className="flex gap-2 items-start"><PlusSquare className="h-5 w-5 shrink-0 text-primary" />Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</li>
              <li className="text-gray-500">Open this page in Safari if you're in another app's browser.</li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2 items-start"><MoreVertical className="h-5 w-5 shrink-0 text-primary" />Open your browser menu (⋮ or the install icon in the address bar).</li>
              <li className="flex gap-2 items-start"><Download className="h-5 w-5 shrink-0 text-primary" />Choose <b>Install app</b> or <b>Add to Home screen</b>.</li>
              <li className="text-gray-500">Already installed? Open IFA.ng from your apps. Use Chrome, Edge or Samsung Internet if you don't see the option.</li>
            </ol>
          )}
          <Button onClick={() => setHelp(false)}>Got it</Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallButton;
