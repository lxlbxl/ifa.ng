import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SessionOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onSuccess?: () => void;
}

// Common Odu names for quick selection
const COMMON_ODUS = [
  "Eji Ogbe", "Oyeku Meji", "Iwori Meji", "Odi Meji", "Irosun Meji",
  "Owonrin Meji", "Obara Meji", "Okanran Meji", "Ogunda Meji", "Osa Meji",
  "Ika Meji", "Oturupon Meji", "Otura Meji", "Irete Meji", "Ose Meji", "Ofun Meji"
];

const SessionOutcomeModal: React.FC<SessionOutcomeModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  onSuccess
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    primary_odu: "",
    other_odus: [] as string[],
    ritual_recommendations: "",
    items_needed: "",
    deadline: "",
    next_appointment: "",
    warnings: "",
    notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Update session with consultation outcome
      const { error: sessionError } = await supabase
        .from("sessions")
        .update({
          primary_odu: formData.primary_odu || null,
          other_odus: formData.other_odus.length > 0 ? formData.other_odus : null,
          ritual_recommendations: formData.ritual_recommendations || null,
          items_needed: formData.items_needed || null,
          deadline: formData.deadline || null,
          next_appointment: formData.next_appointment || null,
          warnings: formData.warnings || null,
          notes: formData.notes || null,
          status: "completed",
          session_ended_at: new Date().toISOString()
        })
        .eq("id", sessionId);

      if (sessionError) {
        throw sessionError;
      }

      toast({
        title: "Session outcome recorded",
        description: "The consultation results have been saved successfully.",
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error recording session outcome:", error);
      toast({
        title: "Error",
        description: "Failed to record session outcome. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addOtherOdu = (odu: string) => {
    if (odu && !formData.other_odus.includes(odu)) {
      setFormData(prev => ({
        ...prev,
        other_odus: [...prev.other_odus, odu]
      }));
    }
  };

  const removeOtherOdu = (odu: string) => {
    setFormData(prev => ({
      ...prev,
      other_odus: prev.other_odus.filter(o => o !== odu)
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Consultation Outcome</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Primary Odu */}
          <div className="space-y-2">
            <Label htmlFor="primary_odu">Primary Odu *</Label>
            <Select
              value={formData.primary_odu}
              onValueChange={(value) => handleInputChange("primary_odu", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select the primary Odu" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_ODUS.map((odu) => (
                  <SelectItem key={odu} value={odu}>
                    {odu}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Or enter custom Odu name"
              value={formData.primary_odu}
              onChange={(e) => handleInputChange("primary_odu", e.target.value)}
            />
          </div>

          {/* Other Odus */}
          <div className="space-y-2">
            <Label>Other Odus (Supporting/Secondary)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.other_odus.map((odu) => (
                <Badge key={odu} variant="secondary" className="flex items-center gap-1">
                  {odu}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeOtherOdu(odu)}
                  />
                </Badge>
              ))}
            </div>
            <Select onValueChange={addOtherOdu}>
              <SelectTrigger>
                <SelectValue placeholder="Add supporting Odu" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_ODUS.filter(odu => 
                  odu !== formData.primary_odu && !formData.other_odus.includes(odu)
                ).map((odu) => (
                  <SelectItem key={odu} value={odu}>
                    {odu}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ritual Recommendations */}
          <div className="space-y-2">
            <Label htmlFor="ritual_recommendations">Ritual Recommendations</Label>
            <Textarea
              id="ritual_recommendations"
              placeholder="Describe recommended rituals, offerings, or spiritual practices..."
              value={formData.ritual_recommendations}
              onChange={(e) => handleInputChange("ritual_recommendations", e.target.value)}
              rows={3}
            />
          </div>

          {/* Items Needed */}
          <div className="space-y-2">
            <Label htmlFor="items_needed">Items Needed for Rituals</Label>
            <Textarea
              id="items_needed"
              placeholder="List specific items, materials, or ingredients needed..."
              value={formData.items_needed}
              onChange={(e) => handleInputChange("items_needed", e.target.value)}
              rows={2}
            />
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline for Rituals</Label>
            <Input
              id="deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => handleInputChange("deadline", e.target.value)}
            />
          </div>

          {/* Next Appointment */}
          <div className="space-y-2">
            <Label htmlFor="next_appointment">Recommended Next Appointment</Label>
            <Input
              id="next_appointment"
              type="date"
              value={formData.next_appointment}
              onChange={(e) => handleInputChange("next_appointment", e.target.value)}
            />
          </div>

          {/* Warnings */}
          <div className="space-y-2">
            <Label htmlFor="warnings">Warnings or Precautions</Label>
            <Textarea
              id="warnings"
              placeholder="Any important warnings, taboos, or precautions to observe..."
              value={formData.warnings}
              onChange={(e) => handleInputChange("warnings", e.target.value)}
              rows={2}
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional observations, insights, or guidance..."
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.primary_odu}>
              {isLoading ? "Recording..." : "Record Outcome"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SessionOutcomeModal;
