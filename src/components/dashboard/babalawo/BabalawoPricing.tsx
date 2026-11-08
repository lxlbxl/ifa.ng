import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const db = supabase as any;

/** Price changes go through the set_my_session_price RPC (server enforces admin min/max). */
const BabalawoPricing: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["bab-price", user?.id], enabled: !!user?.id,
    queryFn: async () => (await db.from("babalawos").select("*").eq("user_id", user!.id).maybeSingle()).data,
  }) as any;
  const [price, setPrice] = useState(""); const [instant, setInstant] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    setPrice(String(data.session_price ?? data.hourly_rate ?? ""));
    setInstant(data.instant_session_price != null ? String(data.instant_session_price) : "");
  }, [data]);
  const commission = Number(data?.commission_babalawo_percent ?? 80);
  const p = Number(price);

  const save = async () => {
    if (!(p > 0)) return toast({ title: "Enter a price above zero", variant: "destructive" });
    setBusy(true);
    const { error } = await db.rpc("set_my_session_price", { p_price: p, p_instant_price: instant === "" ? null : Number(instant) });
    setBusy(false);
    if (error) return toast({ title: "Price not saved", description: error.message, variant: "destructive" });
    toast({ title: "Price updated", description: "New bookings use this price. Existing bookings keep theirs." });
    qc.invalidateQueries({ queryKey: ["bab-price", user?.id] });
  };

  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle>Session price</CardTitle><CardDescription>What a client pays to book you. The platform takes a commission; you receive the rest.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div><Label>Scheduled session (₦)</Label><Input type="number" inputMode="numeric" min={0} value={price} onChange={e => setPrice(e.target.value)} /></div>
        <div><Label>Instant consultation (₦, optional)</Label><Input type="number" inputMode="numeric" min={0} value={instant} onChange={e => setInstant(e.target.value)} placeholder="Same as scheduled" /></div>
        {p > 0 && <p className="text-sm rounded-lg bg-green-50 border border-green-200 p-3">You receive about <b>₦{Math.round(p * commission / 100).toLocaleString()}</b> per session ({commission}% after commission).</p>}
        <Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save price"}</Button>
      </CardContent>
    </Card>
  );
};

export default BabalawoPricing;
