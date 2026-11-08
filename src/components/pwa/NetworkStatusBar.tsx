import React from "react";
import { WifiOff, AlertTriangle } from "lucide-react";
import { useNetworkQuality, NetworkLevel, NetworkQuality } from "@/hooks/useNetworkQuality";

type Audience = "babalawo" | "client";
type Variant = "bar" | "card";

// Brand colours: leaf = good, sun = fair, coral = poor/offline. Text on leaf and sun is ink (DESIGN_SYSTEM.md).
const TONE: Record<NetworkLevel, { bar: string; surface: string; text: string }> = {
  offline: { bar: "bg-coral", surface: "bg-coral-50 border-coral-200", text: "text-coral-800" },
  poor: { bar: "bg-coral", surface: "bg-coral-50 border-coral-200", text: "text-coral-800" },
  fair: { bar: "bg-sun", surface: "bg-sun-50 border-sun-200", text: "text-ink" },
  good: { bar: "bg-leaf", surface: "bg-leaf/20 border-leaf", text: "text-ink" },
  excellent: { bar: "bg-green-600", surface: "bg-leaf/20 border-leaf", text: "text-ink" },
};

/** Plain-language advice, different for the person receiving a booking and the person joining one. */
export function networkAdvice(level: NetworkLevel, audience: Audience, context: "idle" | "joining" = "idle"): string | null {
  if (level === "offline") {
    return audience === "babalawo"
      ? "You're offline. You can't join sessions or receive bookings."
      : context === "joining"
        ? "You're offline. Reconnect before you join your consultation."
        : "You're offline. You can't book or join a consultation until you reconnect.";
  }
  if (level === "poor") {
    return audience === "babalawo"
      ? "Weak connection. Video may drop. Move closer to your router or switch networks before a session."
      : context === "joining"
        ? "Weak connection. Video may drop. Move closer to your router, switch to Wi-Fi or mobile data, or join from a steadier spot."
        : "Weak connection. For a smooth consultation, move closer to your router or switch networks before your session.";
  }
  if (level === "fair" && context === "joining") return "Connection is fair. Video should work; close other apps that use data for a clearer call.";
  return null;
}

function Signal({ n }: { n: NetworkQuality }) {
  const c = TONE[n.level];
  return n.level === "offline" ? (
    <WifiOff className={`h-4 w-4 ${c.text}`} aria-hidden />
  ) : (
    <span className="flex items-end gap-0.5 h-4" aria-hidden>
      {[1, 2, 3, 4].map(i => (
        <span key={i} className={`w-1 rounded-sm ${i <= n.bars ? c.bar : "bg-line"}`} style={{ height: `${25 + i * 18}%` }} />
      ))}
    </span>
  );
}

/**
 * Signal bars (like a phone's), quality word and live numbers, with advice when video would be at risk.
 * `bar` is a full-width strip for the top of a dashboard; `card` is a rounded panel for inside a page
 * (for example before joining a session).
 */
const NetworkStatusBar: React.FC<{ audience?: Audience; variant?: Variant; context?: "idle" | "joining"; className?: string }> = ({
  audience = "babalawo", variant = "bar", context = "idle", className = "",
}) => {
  const n = useNetworkQuality();
  const c = TONE[n.level];
  const detail = [
    n.latencyMs != null ? `${n.latencyMs} ms` : null,
    n.downlinkMbps != null ? `${n.downlinkMbps} Mbps` : null,
    n.effectiveType ? n.effectiveType.toUpperCase() : null,
  ].filter(Boolean).join(" · ");
  const warn = networkAdvice(n.level, audience, context);
  const shell = variant === "bar" ? `border-b px-4 py-1.5 text-sm ${c.surface}` : `rounded-panel border px-4 py-3 text-sm ${c.surface}`;

  return (
    <div role="status" aria-live="polite" data-testid="network-status" data-level={n.level} className={`${shell} ${className}`}>
      <div className={`flex gap-x-3 gap-y-1 ${variant === "bar" ? "items-center justify-between max-w-7xl mx-auto flex-wrap" : "flex-col"}`}>
        <div className="flex items-center gap-2">
          <Signal n={n} />
          <span className={`font-semibold ${c.text}`}>Network: {n.label}</span>
          {detail && <span className="text-muted-foreground hidden sm:inline">{detail}</span>}
        </div>
        {warn && (
          <span className={`flex items-start gap-1 text-xs sm:text-sm ${c.text}`}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{warn}
          </span>
        )}
      </div>
    </div>
  );
};

export default NetworkStatusBar;
