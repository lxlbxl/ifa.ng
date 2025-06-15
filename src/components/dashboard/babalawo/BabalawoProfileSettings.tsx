
import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

// Fetch Babalawo profile details
const fetchBabalawoProfile = async (id: string) => {
  const { data, error } = await supabase
    .from("babalawos")
    .select("hourly_rate, is_active")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
};

const fetchAvailability = async (id: string) => {
  const { data, error } = await supabase
    .from("availability")
    .select("*")
    .eq("babalawo_id", id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data;
};

const BabalawoProfileSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // PROFILE INFO (rate, status)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-babalawo-profile", user?.id],
    queryFn: () => user?.id ? fetchBabalawoProfile(user.id) : null,
    enabled: !!user?.id,
  });

  // RATE
  const [rate, setRate] = useState("");
  useEffect(() => {
    if (profile?.hourly_rate != null) setRate(profile.hourly_rate.toString());
  }, [profile?.hourly_rate]);

  // MUTATION for rate
  const rateMutation = useMutation({
    mutationFn: async (newRate: string) => {
      const { error } = await supabase
        .from("babalawos")
        .update({ hourly_rate: Number(newRate) })
        .eq("id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-babalawo-profile", user?.id] });
    },
  });

  // AVAILABILITY
  const { data: availability = [], isLoading: loadingAvail } = useQuery({
    queryKey: ["my-avail", user?.id],
    queryFn: () => user?.id ? fetchAvailability(user.id) : [],
    enabled: !!user?.id,
  });
  const [slots, setSlots] = useState<any[]>([]);
  useEffect(() => {
    setSlots(Array.isArray(availability) ? availability : []);
  }, [availability]);

  // Save updated slots
  const saveAvailMutation = useMutation({
    mutationFn: async (slots: any[]) => {
      await supabase.from("availability").delete().eq("babalawo_id", user?.id);
      if (slots.length > 0) {
        await supabase.from("availability").insert(
          slots.map(s => ({ ...s, babalawo_id: user?.id }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-avail", user?.id] });
    },
  });

  // Slot UI helpers
  const addSlot = () =>
    setSlots(s => [
      ...s,
      { day_of_week: 1, start_time: "09:00", end_time: "10:00", is_available: true },
    ]);
  const updateSlot = (i: number, key: string, value: any) =>
    setSlots(s => s.map((slot, idx) => (idx === i ? { ...slot, [key]: value } : slot)));
  const removeSlot = (idx: number) =>
    setSlots(s => s.filter((_, i) => i !== idx));

  // Render
  return (
    <Card className="my-8">
      <CardHeader>
        <CardTitle>My Rate & Availability Settings</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Rate */}
        <div className="mb-6">
          <div className="font-medium mb-2">Your Booking Rate (₦ per session)</div>
          {profileLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={100}
                step={100}
                className="w-32"
                value={rate}
                onChange={e => setRate(e.target.value)}
                disabled={rateMutation.isPending}
              />
              <Button
                size="sm"
                onClick={() => rateMutation.mutate(rate)}
                disabled={rateMutation.isPending}
              >
                {rateMutation.isPending ? "Saving..." : "Save Rate"}
              </Button>
            </div>
          )}
        </div>

        {/* Availability */}
        <div className="">
          <div className="font-medium mb-2">Weekly Availability</div>
          {loadingAvail ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Button variant="default" size="sm" onClick={addSlot}>
                + Add Slot
              </Button>
              <div className="space-y-2 mt-2">
                {slots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={slot.day_of_week}
                      onChange={e =>
                        updateSlot(i, "day_of_week", Number(e.target.value))
                      }
                      className="border rounded px-2 py-1"
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (d, idx) => (
                          <option key={idx} value={idx}>
                            {d}
                          </option>
                        )
                      )}
                    </select>
                    <Input
                      type="time"
                      value={slot.start_time}
                      onChange={e =>
                        updateSlot(i, "start_time", e.target.value)
                      }
                      className="w-28"
                    />
                    <span>-</span>
                    <Input
                      type="time"
                      value={slot.end_time}
                      onChange={e =>
                        updateSlot(i, "end_time", e.target.value)
                      }
                      className="w-28"
                    />
                    <label className="flex items-center text-xs">
                      <input
                        type="checkbox"
                        checked={slot.is_available}
                        onChange={e =>
                          updateSlot(i, "is_available", e.target.checked)
                        }
                        className="mr-1"
                      />
                      Available
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSlot(i)}
                    >
                      🗑️
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => saveAvailMutation.mutate(slots)}
                  disabled={saveAvailMutation.isPending}
                >
                  {saveAvailMutation.isPending ? "Saving..." : "Save Availability"}
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BabalawoProfileSettings;

