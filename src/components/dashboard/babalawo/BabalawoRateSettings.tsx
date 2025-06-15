
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
  initialRate: number | null | undefined;
  loading: boolean;
}

const BabalawoRateSettings: React.FC<Props> = ({ userId, initialRate, loading }) => {
  const [rate, setRate] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (initialRate != null) setRate(initialRate.toString());
  }, [initialRate]);

  const rateMutation = useMutation({
    mutationFn: async (newRate: string) => {
      const { error } = await supabase
        .from("babalawos")
        .update({ hourly_rate: Number(newRate) })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-babalawo-profile", userId] });
    },
  });

  return (
    <div className="mb-6">
      <div className="font-medium mb-2">Your Booking Rate (₦ per session)</div>
      {loading ? (
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
  );
};

export default BabalawoRateSettings;
