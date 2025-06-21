import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WithdrawalRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const WithdrawalRequestModal: React.FC<WithdrawalRequestModalProps> = ({ open, onOpenChange, onSuccess }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      // Cast supabase to any to bypass missing table type error
      const { error } = await (supabase as any).from("withdrawal_requests").insert({
        babalawo_id: user?.id,
        amount: numAmount,
        reason,
        status: "pending",
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Withdrawal request submitted" });
        onSuccess();
        onOpenChange(false);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to submit request", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Amount (₦)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min="1"
              step="10"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Reason (optional)</label>
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for withdrawal"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading || !amount}>
              {isLoading ? "Submitting..." : "Submit Request"}
            </Button>
            <DialogClose asChild>
              <Button variant="secondary" type="button" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawalRequestModal;
