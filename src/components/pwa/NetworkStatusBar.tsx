import React from "react";
import { WifiOff, AlertTriangle } from "lucide-react";
import { useNetworkQuality, NetworkLevel } from "@/hooks/useNetworkQuality";

const COLOR: Record<NetworkLevel, { bar: string; text: string; bg: string }> = {
  offline: { bar: "bg-red-500", text: "text-red-800", bg: "bg-red-50 border-red-200" },
  poor: { bar: "bg-red-500", text: "text-red-800", bg: "bg-red-50 border-red-200" },
  fair: { bar: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-50 border-amber-200" },
  good: { bar: "bg-green-500", text: "text-green-800", bg: "bg-green-50 border-green-200" },
  excellent: { bar: "bg-green-600", text: "text-green-800", bg: "bg-green-50 border-green-200" },
};

/** Signal bars (like a phone's), quality word and live numbers. Warns when video sessions would be at risk. */
const NetworkStatusBar: React.FC = () => {
  const n = useNetworkQuality();
  const c = COLOR[n.level];
  const detail = [
    n.latencyMs != null ? `${n.latencyMs} ms` : null,
    n.downlinkMbps != null ? `${n.downlinkMbps} Mbps` : null,
    n.effectiveType ? n.effectiveType.toUpperCase() : null,
  ].filter(Boolean).join(" · ");
  const warn = n.level === "offline" ? "You're offline. You can't join sessions or receive bookings." : n.level === "poor" ? "Weak connection. Video may drop. Move closer to your router or switch networks before a session." : null;

  return (
    <div role="status" aria-live="polite" className={`border-b px-4 py-1.5 text-sm ${c.bg}`}>
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          {n.level === "offline" ? <WifiOff className={`h-4 w-4 ${c.text}`} /> : (
            <span className="flex items-end gap-0.5 h-4" aria-hidden>
              {[1, 2, 3, 4].map(i => <span key={i} className={`w-1 rounded-sm ${i <= n.bars ? c.bar : "bg-gray-300"}`} style={{ height: `${25 + i * 18}%` }} />)}
            </span>)}
          <span className={`font-medium ${c.text}`}>Network: {n.label}</span>
          {detail && <span className="text-gray-500 hidden sm:inline">{detail}</span>}
        </div>
        {warn && <span className={`flex items-center gap-1 text-xs sm:text-sm ${c.text}`}><AlertTriangle className="h-4 w-4 shrink-0" />{warn}</span>}
      </div>
    </div>
  );
};

export default NetworkStatusBar;
