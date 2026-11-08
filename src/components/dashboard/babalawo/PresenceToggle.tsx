import React from "react";
import { Bell, BellOff, BellRing, Loader2, Smartphone, Vibrate, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eyebrow, SoundWave } from "@/components/brand";
import { cn } from "@/lib/utils";
import { useBabalawoPresence, type PresenceProblem } from "@/hooks/useBabalawoPresence";
import { audioUnlocked, onAudioStateChange, soundSupported, vibrationSupported } from "@/lib/alerts";
import { isIos, isStandalone } from "@/lib/pwa";
import { toast } from "@/hooks/use-toast";

/** A large on/off switch. Tapping it is the user gesture that lets us ask for notifications. */
function BigSwitch({ on, busy, onToggle, size = "lg", label }: { on: boolean; busy?: boolean; onToggle: () => void; size?: "lg" | "sm"; label: string }) {
  const lg = size === "lg";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onToggle}
      className={cn(
        "relative shrink-0 rounded-pill border-2 border-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait",
        lg ? "h-12 w-[88px]" : "h-7 w-12",
        on ? "bg-leaf" : "bg-paper",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full bg-ink grid place-items-center transition-all",
          lg ? "h-9 w-9" : "h-5 w-5",
          on ? (lg ? "left-[44px]" : "left-[22px]") : "left-[3px]",
        )}
      >
        {busy && <Loader2 className={cn("animate-spin text-cloth", lg ? "h-4 w-4" : "h-3 w-3")} />}
      </span>
    </button>
  );
}

function Row({ icon, title, detail, right }: { icon: React.ReactNode; title: string; detail: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-t border-line first:border-t-0">
      <div className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-cloth grid place-items-center text-ink">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink text-sm">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
      </div>
      {right && <div className="shrink-0 self-center">{right}</div>}
    </div>
  );
}

/** Platform-specific steps to unblock notifications. */
function unblockSteps(): string {
  const ua = navigator.userAgent;
  if (isIos()) return isStandalone()
    ? "Open the iPhone Settings app, tap Notifications, find IFA.ng and turn on Allow Notifications, Sounds and Badges."
    : "Tap the Share button in Safari, choose Add to Home Screen, then open IFA.ng from your Home Screen and switch Online.";
  if (/android/i.test(ua)) return "Tap the icon to the left of the web address (or the app's ⋮ menu, then App info), open Permissions, then Notifications, and choose Allow. Make sure sound is on for IFA.ng notifications.";
  return "Click the icon to the left of the web address, find Notifications and choose Allow, then switch Online again.";
}

function ProblemPanel({ problem, onClose }: { problem: PresenceProblem; onClose: () => void }) {
  return (
    <div role="alert" className="rounded-field border-2 border-coral bg-coral-50 p-4 text-sm text-ink">
      <p className="font-semibold">You are still Offline</p>
      <p className="mt-1">{problem.message}</p>
      {problem.reason === "denied" && <p className="mt-2 text-muted-foreground">{unblockSteps()}</p>}
      <button type="button" onClick={onClose} className="mt-2 text-xs font-semibold underline underline-offset-2">Dismiss</button>
    </div>
  );
}

function useAudioReady() {
  const [ready, setReady] = React.useState(audioUnlocked());
  React.useEffect(() => onAudioStateChange(() => setReady(audioUnlocked())), []);
  return ready;
}

/** Full card for the dashboard overview. */
export function PresenceCard({ className }: { className?: string }) {
  const p = useBabalawoPresence();
  const audioReady = useAudioReady();
  const [testing, setTesting] = React.useState(false);
  const pushOn = !!p.endpoint && p.permission === "granted";
  const statusLabel = p.busy ? "In a session" : p.online ? "Online" : "Offline";

  const toggle = () => (p.online ? p.goOffline() : p.goOnline());
  const working = p.phase !== "idle";

  const notifChip = p.permission === "granted"
    ? <Badge variant="success">On</Badge>
    : p.permission === "denied" ? <Badge variant="destructive">Blocked</Badge>
    : p.permission === "unsupported" ? <Badge variant="outline">Not available</Badge>
    : <Badge variant="outline">Off</Badge>;

  return (
    <section className={cn("rounded-panel border border-line bg-paper p-5 sm:p-6", className)} aria-labelledby="presence-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow className="text-camwood">Your status</Eyebrow>
          <h2 id="presence-heading" className="mt-1 font-display text-display-sm text-ink flex items-center gap-3">
            <span className={cn("inline-block h-3.5 w-3.5 rounded-full", p.busy ? "bg-sun" : p.online ? "bg-leaf ring-4 ring-leaf/30 animate-pulse" : "bg-neutral-400")} />
            {p.loading ? "…" : statusLabel}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            {p.phase === "notifications" ? "Turning on notifications…"
              : p.phase === "saving" ? "Saving…"
              : p.online ? "Clients can tap Consult Now. You'll hear and feel every request."
              : "Switch Online to take Consult Now requests. Notifications turn on automatically."}
          </p>
        </div>
        <BigSwitch on={p.online} busy={working} onToggle={toggle} label="Online for Consult Now" />
      </div>

      {p.online && p.busy && (
        <p className="mt-4 rounded-field bg-sun-100 px-4 py-3 text-sm text-ink">You're in a session, so Consult Now is paused until it ends.</p>
      )}
      {p.online && p.presence && !p.presence.listed && (
        <p className="mt-4 rounded-field bg-indigo-50 px-4 py-3 text-sm text-ink">Clients will see you once your profile is approved.</p>
      )}
      {p.problem && <div className="mt-4"><ProblemPanel problem={p.problem} onClose={p.clearProblem} /></div>}

      <div className="mt-4">
        <Row
          icon={p.permission === "granted" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          title="Notifications"
          detail="Required to be Online. Switching Online turns them on for this device."
          right={notifChip}
        />
        <Row
          icon={<Smartphone className="h-4 w-4" />}
          title="Alerts with the app closed"
          detail={!p.presence?.push_configured
            ? "Coming soon. For now, keep IFA.ng open while you're Online."
            : pushOn ? "This phone gets requests even when IFA.ng is closed."
            : isIos() && !isStandalone() ? "On iPhone, add IFA.ng to your Home Screen first."
            : "Switch Online to turn these on."}
          right={p.presence?.push_configured ? (pushOn ? <Badge variant="success">On</Badge> : <Badge variant="outline">Off</Badge>) : <Badge variant="outline">Soon</Badge>}
        />
        <Row
          icon={<Volume2 className="h-4 w-4" />}
          title="Sound and vibration"
          detail={
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1"><Volume2 className="h-3 w-3" />{!soundSupported() ? "No sound here" : audioReady ? "Sound on" : "Tap anywhere to allow sound"}</span>
              <span className="inline-flex items-center gap-1"><Vibrate className="h-3 w-3" />{vibrationSupported() ? "Vibration on" : "This device can't vibrate from the web"}</span>
            </span>
          }
          right={
            <Button size="sm" variant="outline" disabled={testing} onClick={async () => {
              setTesting(true);
              await p.sendTestAlert();
              setTimeout(() => setTesting(false), 5200);
            }}>
              {testing ? <SoundWave className="h-4 [&>i]:bg-ink" /> : <><BellRing className="h-4 w-4" />Test</>}
            </Button>
          }
        />
      </div>

      {p.permission === "granted" && !p.online && pushOn && (
        <button type="button" className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
          onClick={async () => { await p.turnOffNotifications(); toast({ title: "Notifications off on this device" }); }}>
          Turn off notifications on this device
        </button>
      )}
    </section>
  );
}

/** Compact switch for the dashboard header, so Online is one tap from anywhere. */
export function PresencePill() {
  const p = useBabalawoPresence();
  const working = p.phase !== "idle";
  React.useEffect(() => {
    if (p.problem) toast({ title: "You are still Offline", description: p.problem.message, variant: "destructive" });
  }, [p.problem]);
  return (
    <div className={cn("flex items-center gap-2 rounded-pill border px-2.5 py-1", p.online ? "border-ink bg-leaf" : "border-line bg-paper")}>
      <span className={cn("h-2 w-2 rounded-full", p.busy ? "bg-sun" : p.online ? "bg-green-700" : "bg-neutral-400")} />
      <span className="text-xs font-bold uppercase tracking-wide text-ink">{p.busy ? "Busy" : p.online ? "Online" : "Offline"}</span>
      <BigSwitch size="sm" on={p.online} busy={working} onToggle={() => (p.online ? p.goOffline() : p.goOnline())} label="Online for Consult Now" />
    </div>
  );
}
