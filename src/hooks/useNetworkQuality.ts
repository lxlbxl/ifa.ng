import { useEffect, useRef, useState } from "react";

export type NetworkLevel = "offline" | "poor" | "fair" | "good" | "excellent";
export interface NetworkQuality {
  level: NetworkLevel;
  bars: 0 | 1 | 2 | 3 | 4;
  latencyMs: number | null;
  downlinkMbps: number | null;
  effectiveType: string | null;
  label: string;
}

const LABEL: Record<NetworkLevel, string> = { offline: "Offline", poor: "Poor", fair: "Fair", good: "Good", excellent: "Excellent" };
const BARS: Record<NetworkLevel, 0 | 1 | 2 | 3 | 4> = { offline: 0, poor: 1, fair: 2, good: 3, excellent: 4 };
const PROBE_URL = "/manifest.webmanifest";

function classify(online: boolean, latency: number | null, downlink: number | null, type: string | null, failures: number): NetworkLevel {
  if (!online || failures >= 2) return "offline";
  let level: NetworkLevel = "excellent";
  const drop = (to: NetworkLevel) => { const order: NetworkLevel[] = ["poor", "fair", "good", "excellent"]; if (order.indexOf(to) < order.indexOf(level)) level = to; };
  if (latency != null) { if (latency > 800) drop("poor"); else if (latency > 400) drop("fair"); else if (latency > 150) drop("good"); }
  if (downlink != null) { if (downlink < 0.5) drop("poor"); else if (downlink < 1.5) drop("fair"); else if (downlink < 5) drop("good"); }
  if (type === "slow-2g" || type === "2g") drop("poor"); else if (type === "3g") drop("fair");
  if (latency == null && downlink == null && type == null) return "good"; // online but nothing measured yet
  return level;
}

/** Live connection health: browser connection hints (where supported) plus a periodic latency probe to our own origin. */
export function useNetworkQuality(intervalMs = 10000): NetworkQuality {
  const [state, setState] = useState<NetworkQuality>({ level: navigator.onLine ? "good" : "offline", bars: navigator.onLine ? 3 : 0, latencyMs: null, downlinkMbps: null, effectiveType: null, label: navigator.onLine ? "Checking" : "Offline" });
  const samples = useRef<number[]>([]);
  const failures = useRef(0);

  useEffect(() => {
    let stop = false;
    const conn: any = (navigator as any).connection;

    const publish = () => {
      if (stop) return;
      const s = samples.current;
      const latency = s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
      const downlink = typeof conn?.downlink === "number" ? conn.downlink : null;
      const type = conn?.effectiveType ?? null;
      const level = classify(navigator.onLine, latency, downlink, type, failures.current);
      setState({ level, bars: BARS[level], latencyMs: latency, downlinkMbps: downlink, effectiveType: type, label: LABEL[level] });
    };

    const probe = async () => {
      if (!navigator.onLine) { failures.current = 2; return publish(); }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const start = performance.now();
      try {
        await fetch(`${PROBE_URL}?n=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: ctrl.signal });
        samples.current = [...samples.current.slice(-4), Math.round(performance.now() - start)];
        failures.current = 0;
      } catch {
        failures.current += 1;
        if (failures.current === 1) samples.current = [...samples.current.slice(-4), 5000];
      } finally { clearTimeout(t); publish(); }
    };

    const onOnline = () => { failures.current = 0; probe(); };
    const onOffline = () => { failures.current = 2; publish(); };
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    conn?.addEventListener?.("change", publish);
    const onVisible = () => { if (document.visibilityState === "visible") probe(); };
    document.addEventListener("visibilitychange", onVisible);
    probe();
    const id = setInterval(() => { if (document.visibilityState === "visible") probe(); }, intervalMs);
    return () => { stop = true; clearInterval(id); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); conn?.removeEventListener?.("change", publish); document.removeEventListener("visibilitychange", onVisible); };
  }, [intervalMs]);

  return state;
}
