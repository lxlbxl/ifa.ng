import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const quality = vi.hoisted(() => ({ value: { level: "good", bars: 3, latencyMs: 120, downlinkMbps: 8, effectiveType: "4g", label: "Good" } as any }));
vi.mock("@/hooks/useNetworkQuality", () => ({ useNetworkQuality: () => quality.value }));

import NetworkStatusBar, { networkAdvice } from "./NetworkStatusBar";

describe("networkAdvice", () => {
  it("gives clients their own wording", () => {
    expect(networkAdvice("offline", "client")).toMatch(/can't book or join/);
    expect(networkAdvice("offline", "client", "joining")).toMatch(/Reconnect before you join/);
    expect(networkAdvice("offline", "babalawo")).toMatch(/receive bookings/);
    expect(networkAdvice("poor", "client", "joining")).toMatch(/Video may drop/);
  });
  it("stays quiet when the connection is fine", () => {
    expect(networkAdvice("good", "client", "joining")).toBeNull();
    expect(networkAdvice("excellent", "babalawo")).toBeNull();
  });
});

describe("<NetworkStatusBar audience=client>", () => {
  it("shows quality, numbers and no warning on a good connection", () => {
    quality.value = { level: "good", bars: 3, latencyMs: 120, downlinkMbps: 8, effectiveType: "4g", label: "Good" };
    render(<NetworkStatusBar audience="client" variant="card" context="joining" />);
    expect(screen.getByText("Network: Good")).toBeTruthy();
    expect(screen.queryByText(/Video may drop/)).toBeNull();
  });
  it("warns a client with a poor connection before joining", () => {
    quality.value = { level: "poor", bars: 1, latencyMs: 900, downlinkMbps: 0.3, effectiveType: "2g", label: "Poor" };
    render(<NetworkStatusBar audience="client" variant="card" context="joining" />);
    expect(screen.getByTestId("network-status").getAttribute("data-level")).toBe("poor");
    expect(screen.getByText(/Video may drop/)).toBeTruthy();
  });
});
