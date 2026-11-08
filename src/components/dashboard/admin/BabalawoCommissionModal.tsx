import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface BabalawoCommissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babalawoId: string;
  babalawoName: string;
  onUpdate?: () => void;
}

const BabalawoCommissionModal: React.FC<BabalawoCommissionModalProps> = ({
  open,
  onOpenChange,
  babalawoId,
  babalawoName,
  onUpdate,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [platformPercent, setPlatformPercent] = useState<number>(20);
  const [babalawoPercent, setBabalawoPercent] = useState<number>(80);
  const [hourlyRate, setHourlyRate] = useState<number>(0);

  useEffect(() => {
    if (open && babalawoId) {
      fetchCommissionData();
    }
  }, [open, babalawoId]);

  const fetchCommissionData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("babalawos")
        .select("commission_platform_percent, commission_babalawo_percent, hourly_rate")
        .eq("user_id", babalawoId)
        .single();

      if (error) throw error;

      if (data) {
        setPlatformPercent(Number(data.commission_platform_percent) || 20);
        setBabalawoPercent(Number(data.commission_babalawo_percent) || 80);
        setHourlyRate(Number(data.hourly_rate) || 0);
      }
    } catch (error) {
      console.error("Error fetching commission data:", error);
      toast({ title: "Error loading commission data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformPercentChange = (value: number) => {
    if (value >= 0 && value <= 100) {
      setPlatformPercent(value);
      setBabalawoPercent(100 - value);
    }
  };

  const handleBabalawoPercentChange = (value: number) => {
    if (value >= 0 && value <= 100) {
      setBabalawoPercent(value);
      setPlatformPercent(100 - value);
    }
  };

  const handleSave = async () => {
    if (platformPercent + babalawoPercent !== 100) {
      toast({
        title: "Invalid commission split",
        description: "Commission percentages must add up to 100%",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("babalawos")
        .update({
          commission_platform_percent: platformPercent,
          commission_babalawo_percent: babalawoPercent,
        })
        .eq("user_id", babalawoId);

      if (error) throw error;

      toast({ title: "Commission rates updated successfully!" });
      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving commission rates:", error);
      toast({ title: "Error saving commission rates", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Commission Rates</DialogTitle>
          <DialogDescription>
            Update commission structure for {babalawoName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="text-sm font-medium mb-1">Current Hourly Rate</p>
              <p className="text-2xl font-bold text-blue-700">
                ₦{hourlyRate.toLocaleString()}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                (Set by babalawo in their rate settings)
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Platform Commission (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={platformPercent}
                  onChange={(e) => handlePlatformPercentChange(Number(e.target.value))}
                  placeholder="Enter platform commission"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Amount retained by the platform
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Babalawo Commission (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={babalawoPercent}
                  onChange={(e) => handleBabalawoPercentChange(Number(e.target.value))}
                  placeholder="Enter babalawo commission"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Amount paid to the babalawo
                </p>
              </div>

              {platformPercent + babalawoPercent !== 100 && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                  <p className="text-sm text-red-700">
                    ⚠️ Total must equal 100%. Current total: {platformPercent + babalawoPercent}%
                  </p>
                </div>
              )}

              {hourlyRate > 0 && platformPercent + babalawoPercent === 100 && (
                <div className="bg-green-50 p-4 rounded-md">
                  <h4 className="text-sm font-semibold mb-2">Commission Breakdown</h4>
                  <p className="text-sm mb-2">
                    For a ₦{hourlyRate.toLocaleString()} consultation:
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• Platform receives: ₦{((hourlyRate * platformPercent) / 100).toLocaleString()}</li>
                    <li>• Babalawo receives: ₦{((hourlyRate * babalawoPercent) / 100).toLocaleString()}</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || platformPercent + babalawoPercent !== 100}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BabalawoCommissionModal;
