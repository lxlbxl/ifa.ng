
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
      <label className="block text-sm font-medium mb-2">Payment Method</label>
      
      <div className="space-y-3">
        {/* Wallet Option */}
        <Card 
          className={`cursor-pointer transition-all ${
            selectedMethod === 'wallet' 
              ? 'ring-2 ring-primary border-primary' 
              : 'hover:bg-gray-50'
          } ${hasInsufficientBalance ? 'opacity-50' : ''}`}
          onClick={() => !hasInsufficientBalance && onMethodChange('wallet')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Wallet className="h-6 w-6 text-green-600" />
                <div>
                  <div className="font-medium">Wallet Balance</div>
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
              ? 'ring-2 ring-primary border-primary' 
              : 'hover:bg-gray-50'
          }`}
          onClick={() => onMethodChange('flutterwave')}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CreditCard className="h-6 w-6 text-orange-600" />
              <div>
                <div className="font-medium">Flutterwave</div>
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
              ? 'ring-2 ring-primary border-primary' 
              : 'hover:bg-gray-50'
          }`}
          onClick={() => onMethodChange('paystack')}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CreditCard className="h-6 w-6 text-blue-600" />
              <div>
                <div className="font-medium">Paystack</div>
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
