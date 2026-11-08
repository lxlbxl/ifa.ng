
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, CreditCard } from "lucide-react";
import { PaymentMethod } from "@/utils/multiGatewayPaymentHandler";

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  walletBalance: number;
  amount: number;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onMethodChange,
  walletBalance,
  amount
}) => {
  const hasInsufficientBalance = walletBalance < amount;

  return (
    <div className="space-y-4">
      <label className="mb-2 block text-sm font-bold">Pay with</label>
      
      <div className="space-y-3">
        {/* Wallet Option */}
        <Card 
          className={`cursor-pointer transition-all ${
            selectedMethod === 'wallet' 
              ? 'border-2 border-ink bg-leaf/40' 
              : 'border-2 border-line hover:border-ink/40'
          } ${hasInsufficientBalance ? 'opacity-50' : ''}`}
          onClick={() => !hasInsufficientBalance && onMethodChange('wallet')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Wallet className="h-6 w-6 text-green-600" />
                <div>
                  <div className="font-bold">IFA.ng wallet</div>
                  <div className="text-sm text-gray-500">
                    Available: ₦{walletBalance.toLocaleString()}
                  </div>
                </div>
              </div>
              {hasInsufficientBalance && (
                <div className="text-xs text-red-500">
                  Insufficient balance
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Flutterwave Option */}
        <Card 
          className={`cursor-pointer transition-all ${
            selectedMethod === 'flutterwave' 
              ? 'border-2 border-ink bg-leaf/40' 
              : 'border-2 border-line hover:border-ink/40'
          }`}
          onClick={() => onMethodChange('flutterwave')}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CreditCard className="h-6 w-6 text-camwood" />
              <div>
                <div className="font-bold">Flutterwave</div>
                <div className="text-sm text-gray-500">
                  Pay with card, bank transfer, or USSD
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paystack Option */}
        <Card 
          className={`cursor-pointer transition-all ${
            selectedMethod === 'paystack' 
              ? 'border-2 border-ink bg-leaf/40' 
              : 'border-2 border-line hover:border-ink/40'
          }`}
          onClick={() => onMethodChange('paystack')}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CreditCard className="h-6 w-6 text-indigo-700" />
              <div>
                <div className="font-bold">Paystack</div>
                <div className="text-sm text-gray-500">
                  Pay with card or bank transfer
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentMethodSelector;
