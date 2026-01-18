
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  getPaymentSettings,
  loadFlutterwaveScript,
  loadPaystackScript,
  generatePaymentRef,
  validateGatewaySettings,
  PaymentGateway
} from "@/utils/paymentGatewayUtils";
import { addMoneyToWallet } from "@/utils/walletUtils";
import { getSuggestedAmounts } from "@/utils/priceUtils";
import { generateIdempotencyKey } from "@/utils/webhookVerification";

interface AddMoneyToWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const AddMoneyToWalletModal: React.FC<AddMoneyToWalletModalProps> = ({ 
  open, 
  onOpenChange, 
  onSuccess 
}) => {
  const { user, userProfile } = useAuth();
  const [amount, setAmount] = useState<string>("");
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('flutterwave');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) {
      toast({ title: "Please enter a valid amount (minimum ₦100)", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const settings = await getPaymentSettings();
      
      if (!validateGatewaySettings(selectedGateway, settings)) {
        toast({ 
          title: "Payment Gateway Error", 
          description: `${selectedGateway} is not properly configured.`,
          variant: "destructive" 
        });
        setIsLoading(false);
        return;
      }

      const paymentRef = generatePaymentRef(selectedGateway);

      if (selectedGateway === 'flutterwave') {
        await loadFlutterwaveScript();
        
        window.FlutterwaveCheckout({
          public_key: settings.flutterwave_public_key,
          tx_ref: paymentRef,
          amount: numAmount,
          currency: "NGN",
          payment_options: "card,account,banktransfer,ussd",
          customer: {
            email: userProfile?.email || user?.email || "user@example.com",
            name: userProfile?.full_name || "User"
          },
          callback: async function(response: any) {
            if (response.status === "successful") {
              // Generate idempotency key for this transaction
              const idempotencyKey = generateIdempotencyKey(
                user?.id || '',
                paymentRef,
                Date.now()
              );

              const result = await addMoneyToWallet(
                user?.id,
                numAmount,
                'flutterwave',
                paymentRef,
                `Added ₦${numAmount} to wallet via Flutterwave`,
                idempotencyKey
              );

              if (result.success) {
                toast({ title: "Money added successfully!" });
                onSuccess();
                onOpenChange(false);
              } else {
                toast({ title: "Failed to update wallet", variant: "destructive" });
              }
            } else {
              toast({ title: "Payment failed", variant: "destructive" });
            }
            setIsLoading(false);
          },
          onclose: function() {
            setIsLoading(false);
          },
          customizations: {
            title: "Add Money to Wallet",
            description: "Top up your IFA.ng wallet",
            logo: "/favicon.ico"
          }
        });
      } else {
        await loadPaystackScript();
        
        const handler = window.PaystackPop.setup({
          key: settings.paystack_public_key,
          email: userProfile?.email || user?.email || "user@example.com",
          amount: numAmount * 100, // Paystack expects kobo
          currency: 'NGN',
          ref: paymentRef,
          callback: async function(response: any) {
            if (response.status === "success") {
              // Generate idempotency key for this transaction
              const idempotencyKey = generateIdempotencyKey(
                user?.id || '',
                paymentRef,
                Date.now()
              );

              const result = await addMoneyToWallet(
                user?.id,
                numAmount,
                'paystack',
                paymentRef,
                `Added ₦${numAmount} to wallet via Paystack`,
                idempotencyKey
              );

              if (result.success) {
                toast({ title: "Money added successfully!" });
                onSuccess();
                onOpenChange(false);
              } else {
                toast({ title: "Failed to update wallet", variant: "destructive" });
              }
            } else {
              toast({ title: "Payment failed", variant: "destructive" });
            }
            setIsLoading(false);
          },
          onClose: function() {
            setIsLoading(false);
          }
        });

        handler.openIframe();
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to initialize payment",
        variant: "destructive" 
      });
      setIsLoading(false);
    }
  };

  const suggestedAmounts = getSuggestedAmounts(0); // Can pass current balance if needed

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Money to Wallet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAddMoney} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Quick Select</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {suggestedAmounts.map((suggested) => (
                <Button
                  key={suggested}
                  type="button"
                  variant={amount === suggested.toString() ? "default" : "outline"}
                  onClick={() => setAmount(suggested.toString())}
                  className="h-12 text-sm"
                >
                  ₦{suggested.toLocaleString()}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Custom Amount (₦)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount (minimum ₦100)"
              min="100"
              step="10"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum: ₦100 | Maximum: ₦1,000,000
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Payment Gateway</label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="flutterwave"
                  checked={selectedGateway === 'flutterwave'}
                  onChange={(e) => setSelectedGateway(e.target.value as PaymentGateway)}
                />
                <span>Flutterwave</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="paystack"
                  checked={selectedGateway === 'paystack'}
                  onChange={(e) => setSelectedGateway(e.target.value as PaymentGateway)}
                />
                <span>Paystack</span>
              </label>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="submit" disabled={isLoading || !amount}>
              {isLoading ? "Processing..." : "Add Money"}
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

export default AddMoneyToWalletModal;
