
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { fetchBabalawoAvailability, AvailabilitySlot } from "@/utils/availabilityUtils";
import { handlePaymentAndBooking, PaymentMethod } from "@/utils/multiGatewayPaymentHandler";
import { getUserWallet } from "@/utils/walletUtils";
import { parseBabalawoPrice, formatPrice } from "@/utils/priceUtils";
import { acquireSlotLock, releaseSlotLock, completeSlotLock } from "@/utils/slotLockUtils";
import { format } from "date-fns";
import DateTimeSelector from "./DateTimeSelector";
import PaymentMethodSelector from "./PaymentMethodSelector";
import FeeDisclosure from "./FeeDisclosure";

interface BookSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babalawo: any;
}

const BookSessionModal: React.FC<BookSessionModalProps> = ({ open, onOpenChange, babalawo }) => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [slotLockId, setSlotLockId] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);

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

  // Acquire slot lock when date and time are selected
  useEffect(() => {
    async function handleSlotLock() {
      // Release previous lock if exists
      if (slotLockId && user?.id) {
        await releaseSlotLock(slotLockId, user.id);
        setSlotLockId(null);
        setLockExpiresAt(null);
      }

      // Acquire new lock if date and time are selected
      if (date && selectedTime && babalawo?.id && user?.id) {
        const sessionDate = format(date, 'yyyy-MM-dd');
        const lockResult = await acquireSlotLock(
          babalawo.id,
          sessionDate,
          selectedTime,
          user.id
        );

        if (lockResult.success && lockResult.lockId) {
          setSlotLockId(lockResult.lockId);
          setLockExpiresAt(lockResult.expiresAt || null);
          console.log('✅ Slot locked successfully until', lockResult.expiresAt);
        } else if (lockResult.lockedByOther) {
          toast({
            title: "Slot Unavailable",
            description: "This time slot is currently being booked by another user. Please select a different time.",
            variant: "destructive"
          });
          setSelectedTime(""); // Clear the selection
        }
      }
    }

    handleSlotLock();
  }, [date, selectedTime, babalawo?.id, user?.id]);

  // Release lock when modal closes
  useEffect(() => {
    return () => {
      if (slotLockId && user?.id) {
        releaseSlotLock(slotLockId, user.id);
      }
    };
  }, [slotLockId, user?.id, open]);

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

    // Use centralized price parsing utility
    const amount = parseBabalawoPrice(babalawo);

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
      async (sessionId) => {
        // Complete the slot lock
        if (slotLockId && user?.id) {
          await completeSlotLock(slotLockId, user.id);
          setSlotLockId(null);
        }

        // Send booking confirmation via email and SMS
        try {
          const sessionDate = date ? format(date, 'MMM dd, yyyy') : '';

          // Send email confirmation
          import('@/services/emailService').then(({ sendBookingConfirmation }) => {
            sendBookingConfirmation({
              to: user.email || '',
              userName: userProfile?.full_name || user.email || '',
              babalawoName: babalawo.full_name || babalawo.name,
              sessionDate,
              sessionTime: selectedTime,
              amount
            });
          }).catch(console.error);

          // Send SMS confirmation if user has phone number
          if (userProfile?.phone_number) {
            import('@/services/smsService').then(({ sendBookingConfirmationSMS }) => {
              sendBookingConfirmationSMS({
                to: userProfile.phone_number,
                userName: userProfile.full_name || 'User',
                babalawoName: babalawo.full_name || babalawo.name,
                sessionDate,
                sessionTime: selectedTime,
                amount
              });
            }).catch(console.error);
          }
        } catch (error) {
          console.error('Error sending booking confirmations:', error);
          // Don't fail the flow if notifications fail
        }

        setIsLoading(false);
        onOpenChange(false);
        toast({
          title: "Booking Successful!",
          description: "Redirecting to your sessions..."
        });

        // Auto-redirect to My Sessions page after 1.5 seconds
        setTimeout(() => {
          navigate('/dashboard/user');
        }, 1500);
      },
      async (errorMessage) => {
        // Release the slot lock on error so it can be rebooked
        if (slotLockId && user?.id) {
          await releaseSlotLock(slotLockId, user.id);
          setSlotLockId(null);
        }

        toast({
          title: "Payment Error",
          description: errorMessage,
          variant: "destructive"
        });
        setIsLoading(false);
      }
    );
  }

  // Extract amount for display using centralized utility
  const amount = parseBabalawoPrice(babalawo);

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

          {slotLockId && lockExpiresAt && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-medium">Slot Reserved</span>
              </div>
              <p className="text-xs text-green-700 mt-1">
                This time slot is temporarily reserved for you. Complete payment within 5 minutes to confirm.
              </p>
            </div>
          )}

          <PaymentMethodSelector
            selectedMethod={paymentMethod}
            onMethodChange={setPaymentMethod}
            walletBalance={walletBalance}
            amount={amount}
          />

          <FeeDisclosure
            amount={amount}
            paymentMethod={paymentMethod}
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
