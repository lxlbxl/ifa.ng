import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, CreditCard } from "lucide-react";
import { PaymentMethod } from "@/utils/multiGatewayPaymentHandler";
import { walletSplit } from "@/utils/walletSplit";

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  walletBalance: number;
  amount: number;
  /** When the wallet holds part of the price: use it first and charge only the rest by card. */
  useWallet?: boolean;
  onUseWalletChange?: (use: boolean) => void;
  minCard?: number;
}

const naira = (n: number) => `₦${n.toLocaleString()}`;

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onMethodChange,
  walletBalance,
  amount,
  useWallet = false,
  onUseWalletChange,
  minCard = 100,
}) => {
  const split = walletSplit(walletBalance, amount, minCard);
  const canSplit = !split.covered && split.wallet > 0 && !!onUseWalletChange;
  const splitting = canSplit && useWallet;

  const gatewayCard = (id: 'flutterwave' | 'paystack', label: string, help: string, iconClass: string) => (
    <Card
      className={`cursor-pointer transition-all ${
        selectedMethod === id ? 'border-2 border-ink bg-leaf/40' : 'border-2 border-line hover:border-ink/40'
      }`}
      onClick={() => onMethodChange(id)}
    >
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <CreditCard className={`h-6 w-6 ${iconClass}`} />
          <div>
            <div className="font-bold">{label}{splitting && <span className="font-normal text-muted-foreground"> · {naira(split.card)}</span>}</div>
            <div className="text-sm text-muted-foreground">{help}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <label className="mb-2 block text-sm font-bold">Pay with</label>

      <div className="space-y-3">
        {split.covered ? (
          <Card
            className={`cursor-pointer transition-all ${
              selectedMethod === 'wallet' ? 'border-2 border-ink bg-leaf/40' : 'border-2 border-line hover:border-ink/40'
            }`}
            onClick={() => onMethodChange('wallet')}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Wallet className="h-6 w-6 text-green-700" />
                <div>
                  <div className="font-bold">IFA.ng wallet</div>
                  <div className="text-sm text-muted-foreground">Available: {naira(walletBalance)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : canSplit ? (
          <label className={`flex cursor-pointer items-start gap-3 rounded-panel border-2 p-4 ${useWallet ? 'border-ink bg-leaf/40' : 'border-line'}`}
            data-testid="use-wallet">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-ink" checked={useWallet}
              onChange={(e) => onUseWalletChange!(e.target.checked)} />
            <span>
              <span className="flex items-center gap-2 font-bold"><Wallet className="h-5 w-5 text-green-700" /> Use my wallet balance ({naira(walletBalance)})</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {useWallet
                  ? `${naira(split.wallet)} comes from your wallet. Pay the remaining ${naira(split.card)} with Paystack or Flutterwave below.`
                  : `Tick to use your wallet first, so you only pay ${naira(split.card)} by card or transfer.`}
              </span>
            </span>
          </label>
        ) : (
          <Card className="border-2 border-line opacity-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Wallet className="h-6 w-6 text-green-700" />
                  <div>
                    <div className="font-bold">IFA.ng wallet</div>
                    <div className="text-sm text-muted-foreground">Available: {naira(walletBalance)}</div>
                  </div>
                </div>
                <div className="text-xs text-coral">Not enough for this</div>
              </div>
            </CardContent>
          </Card>
        )}

        {gatewayCard('flutterwave', 'Flutterwave', 'Pay with card, bank transfer, or USSD', 'text-camwood')}
        {gatewayCard('paystack', 'Paystack', 'Pay with card or bank transfer', 'text-indigo-700')}
      </div>
    </div>
  );
};

export default PaymentMethodSelector;
