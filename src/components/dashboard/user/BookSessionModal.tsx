
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { fetchBabalawoAvailability, AvailabilitySlot } from "@/utils/availabilityUtils";
import { handlePaymentAndBooking } from "@/utils/paymentHandler";
import DateTimeSelector from "./DateTimeSelector";

interface BookSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babalawo: any;
}

const BookSessionModal: React.FC<BookSessionModalProps> = ({ open, onOpenChange, babalawo }) => {
  const { user, userProfile } = useAuth();
  const [date, setDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);

  // Fetch babalawo availability
  useEffect(() => {
    if (open && babalawo?.id) {
      fetchBabalawoAvailability(babalawo.id).then(setAvailability);
    }
  }, [open, babalawo?.id]);

  if (!babalawo) return null;

  async function handleBookAndPay(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !selectedTime) {
      toast({ title: "Please select both date and time", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    // Extract amount from price string more reliably
    let amount = 5000; // default fallback
    if (babalawo.price) {
      const priceMatch = babalawo.price.toString().match(/\d+/);
      amount = priceMatch ? parseInt(priceMatch[0]) : 5000;
    } else if (babalawo.hourly_rate) {
      amount = parseInt(babalawo.hourly_rate.toString()) || 5000;
    }

    await handlePaymentAndBooking(
      {
        user,
        userProfile,
        babalawo,
        date,
        selectedTime,
        amount
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleBookAndPay} className="space-y-4">
          <div>
            <div className="font-semibold">{babalawo.full_name || babalawo.name}</div>
            <div className="text-sm text-gray-500">{babalawo.title}</div>
            <div className="mt-2">
              <span className="text-primary font-bold text-xl">
                {babalawo.price || `₦${babalawo.hourly_rate || 5000}/hr`}
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
          
          <DialogFooter>
            <Button type="submit" disabled={isLoading || !date || !selectedTime}>
              {isLoading ? "Processing..." : "Pay & Book"}
            </Button>
            <DialogClose asChild>
              <Button variant="secondary" type="button" disabled={isLoading}>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookSessionModal;
