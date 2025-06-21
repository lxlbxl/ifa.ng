import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BankDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const BankDetailsModal: React.FC<BankDetailsModalProps> = ({ open, onOpenChange, onSuccess }) => {
  const { user } = useAuth();
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      // Load existing bank details if any
      (async () => {
        try {
          // Cast supabase to any to bypass missing table type error if needed
          const { data, error } = await (supabase as any)
            .from("babalawo_bank_details")
            .select("account_name, account_number, bank_name")
            .eq("babalawo_id", user.id)
            .single();
          if (error && error.code !== "PGRST116") { // Ignore no rows found error
            toast({ title: "Error loading bank details", description: error.message, variant: "destructive" });
          } else if (data) {
            setAccountName(data.account_name || "");
            setAccountNumber(data.account_number || "");
            setBankName(data.bank_name || "");
          }
        } catch (err: any) {
          toast({ title: "Error", description: err.message || "Failed to load bank details", variant: "destructive" });
        }
      })();
    }
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName || !accountNumber || !bankName) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      // Upsert bank details
      const { error } = await (supabase as any)
        .from("babalawo_bank_details")
        .upsert({
          babalawo_id: user?.id,
          account_name: accountName,
          account_number: accountNumber,
          bank_name: bankName,
        });
      if (error) {
        toast({ title: "Error saving bank details", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Bank details saved successfully" });
        onSuccess();
        onOpenChange(false);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save bank details", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set / Update Bank Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Account Name</label>
            <Input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Account holder's name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Account Number</label>
            <Input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Account number"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Bank Name</label>
            <Input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank name"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
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

export default BankDetailsModal;
