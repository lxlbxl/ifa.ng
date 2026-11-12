import React, { useState, useEffect } from "react";
import { Info, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculatePaymentFee, shouldShowPaymentFees, FeeCalculation } from "@/utils/paymentFeeUtils";
import { PaymentMethod } from "@/utils/multiGatewayPaymentHandler";
import { formatMoney, type Currency } from "@/hooks/usePricing";

interface FeeDisclosureProps {
  amount: number;
  paymentMethod: PaymentMethod;
  currency?: Currency;
  className?: string;
}

const FeeDisclosure: React.FC<FeeDisclosureProps> = ({ amount, paymentMethod, currency = "NGN", className }) => {
  const [feeCalculation, setFeeCalculation] = useState<FeeCalculation | null>(null);
  const [showFees, setShowFees] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadFeeInfo() {
      setLoading(true);

      // Check if fees should be shown
      const shouldShow = await shouldShowPaymentFees();
      setShowFees(shouldShow);

      // Calculate fees for gateway payments only
      if (paymentMethod === 'flutterwave' || paymentMethod === 'paystack') {
        const calculation = await calculatePaymentFee(paymentMethod, amount, currency);
        setFeeCalculation(calculation);
      } else {
        setFeeCalculation(null);
      }

      setLoading(false);
    }

    loadFeeInfo();
  }, [amount, paymentMethod, currency]);

  // Don't show anything if fees are disabled or still loading
  if (!showFees || loading) {
    return null;
  }

  // Don't show for wallet payments
  if (paymentMethod === 'wallet') {
    return (
      <div className={className}>
        <Alert className="bg-leaf/30 border-leaf-600/30 rounded-field">
          <Info className="h-4 w-4 text-green-700" />
          <AlertDescription className="text-sm text-ink">
            No transaction fees when paying with wallet balance
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show fee breakdown for gateway payments
  if (feeCalculation) {
    return (
      <div className={className}>
        <Alert className="bg-cloth border-line rounded-field">
          <AlertCircle className="h-4 w-4 text-camwood" />
          <AlertDescription className="text-sm text-ink">
            <div className="space-y-1">
              <div className="font-medium">What you pay</div>
              <div className="flex justify-between items-center">
                <span>Service Amount:</span>
                <span className="font-medium">{formatMoney(feeCalculation.amount, currency)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Provider fee, about:</span>
                <span className="font-medium">{formatMoney(feeCalculation.fee, currency)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-blue-300">
                <span className="font-semibold">Total, about:</span>
                <span className="font-bold text-base">{formatMoney(feeCalculation.total, currency)}</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground mt-2">
          {paymentMethod === 'flutterwave' ? 'Flutterwave' : 'Paystack'} adds its fee on its own payment page, where you see the exact total before you pay.
        </p>
      </div>
    );
  }

  return null;
};

export default FeeDisclosure;
