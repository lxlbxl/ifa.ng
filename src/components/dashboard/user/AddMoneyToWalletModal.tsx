
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { createPaymentIntent, openCheckout, verifyPayment, PaymentGateway } from "@/utils/paymentGatewayUtils";
import { getSuggestedAmounts } from "@/utils/priceUtils";
import FeeDisclosure from "./FeeDisclosure";
import { formatMoney, usePricing } from "@/hooks/usePricing";

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
  const pricing = usePricing();
  const usd = pricing.isUsd;
  const money = (n: number) => formatMoney(n, pricing.currency);
  const minTopup = pricing.min_wallet_topup || (usd ? 5 : 100);
  const maxTopup = usd ? 5000 : 1000000;
  const gateway: PaymentGateway = usd ? 'flutterwave' : selectedGateway;

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < minTopup || numAmount > maxTopup) {
      toast({ title: `Enter an amount between ${money(minTopup)} and ${money(maxTopup)}`, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // The server creates the payment, the provider is asked whether it really succeeded,
      // and only the server can credit the wallet.
      const intent = await createPaymentIntent({ kind: 'wallet_topup', gateway, amount: numAmount });
      const popupSaidPaid = await openCheckout(intent, "Top up your IFA.ng wallet");
      const result = await verifyPayment(intent.reference, popupSaidPaid ? 6 : 1, popupSaidPaid ? 2000 : 0);

      if (result.status === 'settled' || result.status === 'already_settled') {
        toast({ title: "Money added successfully!" });
        onSuccess();
        onOpenChange(false);
      } else if (!popupSaidPaid) {
        toast({ title: "Payment cancelled", description: "No money was taken." });
      } else if (result.status === 'pending') {
        toast({ title: "Waiting for confirmation", description: `If you were charged your wallet will update shortly. Reference: ${intent.reference}` });
        onOpenChange(false);
      } else {
        toast({ title: "Payment could not be verified", description: `Contact support with reference ${intent.reference} if you were charged.`, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to start payment", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedAmounts = usd ? [10, 25, 50, 100, 200, 500] : getSuggestedAmounts(0);

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
                  {money(suggested)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Custom Amount ({usd ? "$" : "₦"})</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Enter amount (minimum ${money(minTopup)})`}
              min={minTopup}
              step={usd ? "1" : "10"}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Minimum: {money(minTopup)} | Maximum: {money(maxTopup)}
            </p>
          </div>

          {usd ? (
            <p className="text-sm text-muted-foreground">You pay in US dollars by card through Flutterwave.</p>
          ) : <div>
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
          </div>}

          <FeeDisclosure
            amount={parseFloat(amount) || 0}
            paymentMethod={gateway}
            currency={pricing.currency}
          />

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
