import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatMoney, type Currency } from "@/hooks/usePricing";

/**
 * Admin controls for price parity: which currency a person pays in (Nigeria: naira, everyone
 * else: US dollars, unless an admin overrides it) and a Babalawo's own dollar prices.
 */
export type PricingInfo = {
  currency: Currency;
  override: Currency | null;
  last_paid_currency: Currency | null;
  last_ip_country: string | null;
  wallet_currency: Currency | null;
  wallet_balance: number;
  usd_ngn_rate: number;
  babalawo: null | {
    session_price: number;
    instant_price: number;
    usd_session_price: number | null;
    usd_instant_price: number | null;
    usd_price: number;
    usd_instant_price_effective: number;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const usePricingInfo = (userId: string) =>
  useQuery({ queryKey: ["admin-pricing", userId], queryFn: () => rpc<PricingInfo>("admin_pricing_info", { p_user: userId }) });

function usePricingAction<V>(fn: (v: V) => Promise<unknown>, ok: string, userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast({ title: ok });
      qc.invalidateQueries({ queryKey: ["admin-pricing", userId] });
      qc.invalidateQueries({ queryKey: ["adminUsers"] });
    },
    onError: (e: Error) => toast({ title: "Not saved", description: e.message, variant: "destructive" }),
  });
}

const CURRENCY_NAME: Record<Currency, string> = { NGN: "Naira", USD: "US dollars" };

/** "Pays in" row for the person's Details panel, with a picker to override it. */
export function PaysInRow({ userId }: { userId: string }) {
  const { data } = usePricingInfo(userId);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<"auto" | Currency>("auto");
  const save = usePricingAction(
    (v: "auto" | Currency) => rpc("admin_set_pricing_currency", { p_user: userId, p_currency: v === "auto" ? null : v }),
    "Currency updated", userId);
  useEffect(() => { if (data) setPick(data.override ?? "auto"); }, [data]);
  if (!data) return null;
  const why = data.override ? "set by an admin"
    : data.wallet_balance > 0 && data.wallet_currency ? `their wallet holds ${data.wallet_currency}`
    : data.last_ip_country ? `last paid from ${data.last_ip_country}` : "from their phone number";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">Pays in</span>
      <span className="text-right font-medium">
        {CURRENCY_NAME[data.currency]} <span className="font-normal text-muted-foreground">({why})</span>{" "}
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setOpen(true)}>Change</Button>
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Which currency does this person pay in?</DialogTitle>
            <DialogDescription>
              Automatic: naira in Nigeria (by internet location and phone number), US dollars everywhere else.
              Dollar payments go through Flutterwave. A wallet that holds money keeps its currency until it is empty.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2" role="radiogroup">
            {(["auto", "NGN", "USD"] as const).map((v) => (
              <label key={v} className={`flex cursor-pointer items-center gap-3 rounded-field border-2 p-3 text-sm ${pick === v ? "border-ink bg-leaf/40" : "border-line"}`}>
                <input type="radio" className="accent-ink" checked={pick === v} onChange={() => setPick(v)} />
                <span className="font-semibold">{v === "auto" ? "Automatic" : CURRENCY_NAME[v]}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="sun" disabled={save.isPending} onClick={() => save.mutate(pick, { onSuccess: () => setOpen(false) })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** A Babalawo's diaspora prices: shown on their Practice tab, editable by an admin. */
export function UsdPricesButton({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><DollarSign /> Dollar prices</Button>
      {open && <UsdPricesDialog userId={userId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

export function UsdPriceKVs({ userId }: { userId: string }) {
  const { data } = usePricingInfo(userId);
  const b = data?.babalawo;
  if (!b) return null;
  const tag = (set: number | null) => (set != null ? "" : " (automatic)");
  return (
    <>
      <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2 text-sm">
        <span className="text-muted-foreground">Diaspora price</span>
        <span className="font-medium">{formatMoney(b.usd_price, "USD")}<span className="font-normal text-muted-foreground">{tag(b.usd_session_price)}</span></span>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2 text-sm">
        <span className="text-muted-foreground">Diaspora, Consult Now</span>
        <span className="font-medium">{formatMoney(b.usd_instant_price_effective, "USD")}<span className="font-normal text-muted-foreground">{tag(b.usd_instant_price ?? b.usd_session_price)}</span></span>
      </div>
    </>
  );
}

function UsdPricesDialog({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const { data } = usePricingInfo(userId);
  const [session, setSession] = useState("");
  const [instant, setInstant] = useState("");
  useEffect(() => {
    if (!data?.babalawo) return;
    setSession(data.babalawo.usd_session_price != null ? String(data.babalawo.usd_session_price) : "");
    setInstant(data.babalawo.usd_instant_price != null ? String(data.babalawo.usd_instant_price) : "");
  }, [data]);
  const save = usePricingAction(
    (v: { session: number | null; instant: number | null }) =>
      rpc("admin_set_usd_prices", { p_babalawo: userId, p_session: v.session, p_instant: v.instant }),
    "Dollar prices saved", userId);
  const b = data?.babalawo;
  const parse = (s: string) => (s.trim() === "" ? null : Number(s));
  const bad = [session, instant].some((s) => s.trim() !== "" && !(Number(s) > 0));
  // What the Babalawo earns is the same either way: their naira share of their own naira price.
  const naira = (usd: number | null) => (usd != null && data ? formatMoney(usd * data.usd_ngn_rate, "NGN") : null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dollar prices for {name}</DialogTitle>
          <DialogDescription>
            What clients outside Nigeria pay. Leave a box empty to use the automatic price from Settings.
            {name} earns the same naira share as from a Nigerian client; the difference stays with IFA.ng.
          </DialogDescription>
        </DialogHeader>
        {b && (
          <div className="grid gap-4">
            <p className="m-0 text-sm text-muted-foreground">
              Naira prices: {formatMoney(b.session_price, "NGN")} scheduled, {formatMoney(b.instant_price, "NGN")} Consult Now.
              Rate {formatMoney(data!.usd_ngn_rate, "NGN")} per dollar.
            </p>
            <div>
              <Label htmlFor="usd-session">Scheduled consultation ($)</Label>
              <Input id="usd-session" type="number" inputMode="decimal" step="any" min={0} value={session}
                placeholder={`Automatic: ${formatMoney(b.usd_price, "USD")}`} onChange={(e) => setSession(e.target.value)} />
              {parse(session) != null && <p className="mt-1 text-xs text-muted-foreground">About {naira(parse(session))} at today's rate.</p>}
            </div>
            <div>
              <Label htmlFor="usd-instant">Consult Now ($)</Label>
              <Input id="usd-instant" type="number" inputMode="decimal" step="any" min={0} value={instant}
                placeholder={session.trim() ? `Same as scheduled: $${session}` : `Automatic: ${formatMoney(b.usd_instant_price_effective, "USD")}`}
                onChange={(e) => setInstant(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="sun" disabled={!b || bad || save.isPending}
            onClick={() => save.mutate({ session: parse(session), instant: parse(instant) }, { onSuccess: onClose })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
