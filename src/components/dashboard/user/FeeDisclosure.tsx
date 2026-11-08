import React, { useState, useEffect } from "react";
import { Info, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculatePaymentFee, shouldShowPaymentFees, FeeCalculation } from "@/utils/paymentFeeUtils";
import { PaymentMethod } from "@/utils/multiGatewayPaymentHandler";

interface FeeDisclosureProps {
  amount: number;
  paymentMethod: PaymentMethod;
  className?: string;
}

const FeeDisclosure: React.FC<FeeDisclosureProps> = ({ amount, paymentMethod, className }) => {
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
        const calculation = await calculatePaymentFee(paymentMethod, amount);
        setFeeCalculation(calculation);
      } else {
        setFeeCalculation(null);
      }

      setLoading(false);
    }

    loadFeeInfo();
  }, [amount, paymentMethod]);

  // Don't show anything if fees are disabled or still loading
  if (!showFees || loading) {
    return null;
  }

  // Don't show for wallet payments
  if (paymentMethod === 'wallet') {
    return (
      <div className={className}>
        <Alert className="bg-green-50 border-green-200">
          <Info className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm text-green-800">
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
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            <div className="space-y-1">
              <div className="font-medium">Payment Fee Breakdown:</div>
              <div className="flex justify-between items-center">
                <span>Service Amount:</span>
                <span className="font-medium">₦{feeCalculation.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Transaction Fee ({feeCalculation.feePercent}%):</span>
                <span className="font-medium">₦{feeCalculation.fee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-blue-300">
                <span className="font-semibold">Total Amount:</span>
                <span className="font-bold text-base">₦{feeCalculation.total.toLocaleString()}</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
        <p className="text-xs text-gray-500 mt-2">
          Transaction fees are charged by {paymentMethod === 'flutterwave' ? 'Flutterwave' : 'Paystack'} payment gateway
        </p>
      </div>
    );
  }

  return null;
};

export default FeeDisclosure;
