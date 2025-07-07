
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { fetchBabalawoAvailability, AvailabilitySlot } from "@/utils/availabilityUtils";
import { handlePaymentAndBooking, PaymentMethod } from "@/utils/multiGatewayPaymentHandler";
import { getUserWallet } from "@/utils/walletUtils";
import DateTimeSelector from "./DateTimeSelector";
import PaymentMethodSelector from "./PaymentMethodSelector";

interface BookSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babalawo: any;
}

const BookSessionModal: React.FC<BookSessionModalProps> = ({ open, onOpenChange, babalawo }) => {
  const { user, userProfile } = useAuth();
  const [date, setDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);

  // Fetch babalawo availability and user wallet
  useEffect(() => {
    if (open && babalawo?.id) {
      fetchBabalawoAvailability(babalawo.id).then(setAvailability);
    }
    if (open && user?.id) {
      getUserWallet(user.id).then(wallet => {
        setWalletBalance(wallet?.balance || 0);
      });
    }
  }, [open, babalawo?.id, user?.id]);

  if (!babalawo) return null;

  async function handleBookAndPay(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !selectedTime) {
      toast({ title: "Please select both date and time", variant: "destructive" });
      return;
    }
    
    if (!user?.id) {
      toast({ 
        title: "Authentication Error", 
        description: "Please sign in to continue.",
        variant: "destructive" 
      });
      return;
    }
    
    setIsLoading(true);

    // Extract amount from babalawo data more reliably
    let amount = 15000; // default fallback
    if (babalawo.hourly_rate) {
      amount = parseInt(babalawo.hourly_rate.toString()) || 15000;
    } else if (babalawo.price) {
      const priceMatch = babalawo.price.toString().match(/\d+/);
      amount = priceMatch ? parseInt(priceMatch[0]) : 15000;
      // If the matched price seems too low (like 15 instead of 15000), multiply by 1000
      if (amount < 1000) {
        amount = amount * 1000;
      }
    }

    await handlePaymentAndBooking(
      {
        user,
        userProfile,
        babalawo,
        date,
        selectedTime,
        amount,
        paymentMethod,
        walletBalance
      },
      () => {
        setIsLoading(false);
        onOpenChange(false);
        toast({ 
          title: "Booking Successful!", 
          description: "Your consultation session has been confirmed."
        });
      },
      (errorMessage) => {
        toast({ 
          title: "Payment Error", 
          description: errorMessage,
          variant: "destructive" 
        });
        setIsLoading(false);
      }
    );
  }

  // Extract amount for display
  let amount = 15000;
  if (babalawo.hourly_rate) {
    amount = parseInt(babalawo.hourly_rate.toString()) || 15000;
  } else if (babalawo.price) {
    const priceMatch = babalawo.price.toString().match(/\d+/);
    amount = priceMatch ? parseInt(priceMatch[0]) : 15000;
    // If the matched price seems too low, multiply by 1000
    if (amount < 1000) {
      amount = amount * 1000;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Book Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleBookAndPay} className="space-y-4">
          <div className="text-center sm:text-left">
            <div className="font-semibold text-base sm:text-lg">{babalawo.full_name || babalawo.name || "Babalawo"}</div>
            <div className="text-sm text-gray-500">{babalawo.title || "Ifa Priest & Spiritual Guide"}</div>
            <div className="mt-2">
              <span className="text-primary font-bold text-xl sm:text-2xl">
                ₦{amount.toLocaleString()}
              </span>
            </div>
          </div>
          
          <DateTimeSelector
            date={date}
            setDate={setDate}
            selectedTime={selectedTime}
            setSelectedTime={setSelectedTime}
            availability={availability}
          />

          <PaymentMethodSelector
            selectedMethod={paymentMethod}
            onMethodChange={setPaymentMethod}
            walletBalance={walletBalance}
            amount={amount}
          />
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" disabled={isLoading || !date || !selectedTime} className="w-full sm:w-auto">
              {isLoading ? "Processing..." : "Confirm & Pay"}
            </Button>
            <DialogClose asChild>
              <Button variant="secondary" type="button" disabled={isLoading} className="w-full sm:w-auto">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookSessionModal;
