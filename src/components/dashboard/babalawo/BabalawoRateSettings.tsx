import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const BabalawoRateSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [platformPercent, setPlatformPercent] = useState<number>(20);
  const [babalawoPercent, setBabalawoPercent] = useState<number>(80);
  const [babalawoId, setBabalawoId] = useState<number | null>(null);

  useEffect(() => {
    fetchBabalawoRates();
  }, []);

  const fetchBabalawoRates = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({ title: "Please log in", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase
        .from("babalawos")
        .select("id, hourly_rate, commission_platform_percent, commission_babalawo_percent")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching babalawo rates:", error);
        toast({ title: "Error loading rate settings", variant: "destructive" });
        return;
      }

      if (data) {
        setBabalawoId(data.id);
        setHourlyRate(Number(data.hourly_rate) || 0);
        setPlatformPercent(Number(data.commission_platform_percent) || 20);
        setBabalawoPercent(Number(data.commission_babalawo_percent) || 80);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error loading rate settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRate = async () => {
    if (!babalawoId) {
      toast({ title: "Babalawo profile not found", variant: "destructive" });
      return;
    }

    if (hourlyRate <= 0) {
      toast({ title: "Please enter a valid hourly rate", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("babalawos")
        .update({ hourly_rate: hourlyRate })
        .eq("id", babalawoId);

      if (error) throw error;

      toast({ title: "Hourly rate updated successfully!" });
    } catch (error) {
      console.error("Error saving rate:", error);
      toast({ title: "Error saving rate", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Rate Settings</CardTitle>
        <CardDescription>
          Manage your hourly consultation rate and view commission structure
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Hourly Rate (₦)
            </label>
            <Input
              type="number"
              min="0"
              step="100"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              placeholder="Enter hourly rate"
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The amount you charge per hour for consultations
            </p>
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Commission Structure (Read-only)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-cloth p-4 rounded-md">
                <label className="block text-sm font-medium mb-2">
                  Platform Commission
                </label>
                <div className="text-2xl font-bold text-green-700">
                  {platformPercent}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Commission retained by the platform
                </p>
              </div>

              <div className="bg-cloth p-4 rounded-md">
                <label className="block text-sm font-medium mb-2">
                  Your Earnings
                </label>
                <div className="text-2xl font-bold text-green-700">
                  {babalawoPercent}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Your share after platform commission
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Commission rates are set by the administrator. Contact support if you need adjustments.
            </p>
          </div>

          {hourlyRate > 0 && (
            <div className="bg-blue-50 p-4 rounded-md">
              <h4 className="text-sm font-semibold mb-2">Earnings Breakdown</h4>
              <p className="text-sm">
                For a ₦{hourlyRate.toLocaleString()} consultation:
              </p>
              <ul className="text-sm mt-2 space-y-1">
                <li>• Platform receives: ₦{((hourlyRate * platformPercent) / 100).toLocaleString()}</li>
                <li className="font-semibold text-green-700">
                  • You receive: ₦{((hourlyRate * babalawoPercent) / 100).toLocaleString()}
                </li>
              </ul>
            </div>
          )}

          <div className="pt-4">
            <Button
              onClick={handleSaveRate}
              disabled={saving || hourlyRate <= 0}
              className="w-full md:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Hourly Rate"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BabalawoRateSettings;