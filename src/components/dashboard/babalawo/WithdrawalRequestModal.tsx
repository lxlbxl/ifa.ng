import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, DollarSign, CreditCard, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface WithdrawalRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const WithdrawalRequestModal: React.FC<WithdrawalRequestModalProps> = ({ 
  open, 
  onOpenChange, 
  onSuccess 
}) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [fetchingBalance, setFetchingBalance] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [babalawoId, setBabalawoId] = useState<string>("");

  useEffect(() => {
    if (open && user?.id) {
      fetchBabalawoData();
    }
  }, [open, user?.id]);

  const fetchBabalawoData = async () => {
    setFetchingBalance(true);
    setError(null);
    
    try {
      // First, get the babalawo_id for the current user
      const { data: babalawoData, error: babalawoError } = await supabase
        .from('babalawos')
        .select('id')
        .eq('id', user?.id)
        .single();
      
      if (babalawoError) throw babalawoError;
      
      if (!babalawoData?.id) {
        throw new Error('Babalawo profile not found');
      }
      
      setBabalawoId(babalawoData.id);
      
      // Get the babalawo's available balance
      const { data: walletData, error: walletError } = await supabase
        .from('babalawo_wallets')
        .select('available_balance')
        .eq('babalawo_id', babalawoData.id)
        .single();

      if (walletError && walletError.code !== 'PGRST116') throw walletError;
      
      setAvailableBalance(walletData?.available_balance || 0);
      
      // Get bank details
      const { data: bankData, error: bankError } = await supabase
        .from("babalawo_bank_details")
        .select("*")
        .eq("babalawo_id", babalawoData.id)
        .maybeSingle();

      if (bankError && bankError.code !== 'PGRST116') throw bankError;
      
      setBankDetails(bankData);
    } catch (err: any) {
      console.error('Error fetching babalawo data:', err);
      setError('Failed to fetch your account data. Please try again.');
    } finally {
      setFetchingBalance(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast({ 
        title: "Invalid amount", 
        description: "Please enter a valid amount",
        variant: "destructive" 
      });
      return;
    }

    if (numAmount > availableBalance) {
      setError(`Insufficient balance. Your available balance is ₦${availableBalance.toLocaleString()}`);
      return;
    }

    if (!bankDetails) {
      toast({ 
        title: "Bank details missing", 
        description: "Please add your bank details before requesting a withdrawal", 
        variant: "destructive" 
      });
      onOpenChange(false);
      // Trigger bank details modal
      window.dispatchEvent(new CustomEvent('openBankDetailsModal'));
      return;
    }

    setIsLoading(true);
    
    try {
      // Create withdrawal request
      const { error: insertError } = await supabase
        .from("withdrawal_requests")
        .insert({
          babalawo_id: babalawoId,
          amount: numAmount,
          reason: reason || "Regular withdrawal",
          status: "pending",
        });

      if (insertError) throw insertError;
      
      // Update babalawo wallet balance
      const { error: updateError } = await supabase
        .from('babalawo_wallets')
        .update({ 
          available_balance: availableBalance - numAmount
        })
        .eq('babalawo_id', babalawoId);
        
      if (updateError) throw updateError;
      
      toast({ 
        title: "Withdrawal request submitted", 
        description: "Your request has been submitted and is pending approval"
      });
      
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      setError(err.message || "Failed to submit withdrawal request. Please try again.");
      toast({ 
        title: "Error", 
        description: "Failed to submit withdrawal request", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
          <DialogDescription>
            Withdraw funds to your registered bank account
          </DialogDescription>
        </DialogHeader>
        
        {fetchingBalance ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="bg-gradient-to-r from-violet-100 to-indigo-100 p-4 rounded-lg mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-violet-500 text-white p-2 rounded-full">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Available Balance</p>
                  <p className="text-2xl font-bold text-gray-900">₦{availableBalance.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            {!bankDetails ? (
              <Alert className="mb-4 bg-amber-50 text-amber-800 border-amber-200">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  You need to add your bank details before you can withdraw funds.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="bg-gray-50 p-3 rounded-lg mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  <p className="text-sm font-medium text-gray-700">Bank Details</p>
                </div>
                <div className="text-sm text-gray-600">
                  <p>{bankDetails.bank_name}</p>
                  <p>{bankDetails.account_name}</p>
                  <p>•••• {bankDetails.account_number.slice(-4)}</p>
                </div>
              </div>
            )}
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount (₦)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount to withdraw"
                  min="1"
                  max={availableBalance}
                  step="100"
                  required
                  className="text-lg"
                />
                <p className="text-xs text-gray-500">
                  Minimum: ₦1,000 • Maximum: ₦{availableBalance.toLocaleString()}
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for withdrawal"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={
                  isLoading || 
                  !amount || 
                  parseFloat(amount) <= 0 || 
                  parseFloat(amount) > availableBalance || 
                  !bankDetails
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawalRequestModal;
