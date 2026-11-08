
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
}

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

const BabalawoAvailabilitySettings: React.FC<Props> = ({ userId }) => {
  // Fetch
  const { data: availability = [], isLoading } = useQuery({
    queryKey: ["my-avail", userId],
    queryFn: () => fetchAvailability(userId),
    enabled: !!userId,
  });

  const [slots, setSlots] = useState<any[]>([]);
  useEffect(() => {
    setSlots(Array.isArray(availability) ? availability : []);
  }, [availability]);

  const queryClient = useQueryClient();

  const saveAvailMutation = useMutation({
    mutationFn: async (slots: any[]) => {
      await supabase.from("availability").delete().eq("babalawo_id", userId);
      if (slots.length > 0) {
        await supabase.from("availability").insert(
          slots.map(s => ({ ...s, babalawo_id: userId }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-avail", userId] });
    },
  });

  const addSlot = () =>
    setSlots(s => [
      ...s,
      { day_of_week: 1, start_time: "09:00", end_time: "10:00", is_available: true },
    ]);
  const updateSlot = (i: number, key: string, value: any) =>
    setSlots(s => s.map((slot, idx) => (idx === i ? { ...slot, [key]: value } : slot)));
  const removeSlot = (idx: number) =>
    setSlots(s => s.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="font-medium mb-2">Weekly Availability</div>
      {isLoading ? (
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
  );
};

export default BabalawoAvailabilitySettings;
