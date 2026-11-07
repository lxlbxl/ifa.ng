import React, { useState, useEffect } from "react";
import { pickBlock } from '@/design/tokens';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { fetchBabalawoAvailability, fetchBabalawoSchedule, AvailabilitySlot, BabalawoSchedule } from "@/utils/availabilityUtils";
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
  const [schedule, setSchedule] = useState<BabalawoSchedule | null>(null);
  const [slotLockId, setSlotLockId] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);

  // Fetch babalawo availability and user wallet
  useEffect(() => {
    if (open && babalawo?.id) {
      fetchBabalawoAvailability(babalawo.id).then(setAvailability);
      fetchBabalawoSchedule(babalawo.id).then(setSchedule).catch(() => setSchedule(null));
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book a session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleBookAndPay} className="space-y-5">
          <div className="flex items-center gap-4 rounded-panel bg-cloth p-3">
            <span
              className="relative h-16 w-14 flex-none overflow-hidden rounded-[16px]"
              style={{ backgroundColor: pickBlock(babalawo.full_name || babalawo.name || 'Babalawo') }}
            >
              {babalawo.avatar_url && <img src={babalawo.avatar_url} alt="" className="h-full w-full object-cover" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-lg font-extrabold leading-tight">{babalawo.full_name || babalawo.name || "Babalawo"}</div>
              <div className="text-sm text-muted-foreground">One-to-one on Google Meet</div>
            </div>
            <span className="font-display text-2xl font-extrabold tracking-[-0.02em]">₦{amount.toLocaleString()}</span>
          </div>

          <DateTimeSelector
            date={date}
            setDate={setDate}
            selectedTime={selectedTime}
            setSelectedTime={setSelectedTime}
            availability={availability}
            schedule={schedule}
          />

          {slotLockId && lockExpiresAt && (
            <div className="rounded-field bg-leaf/50 p-3">
              <div className="flex items-center gap-2 text-sm text-ink">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-bold">Slot held for you</span>
              </div>
              <p className="text-xs text-ink/75 mt-1">
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

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row">
            <DialogClose asChild>
              <Button variant="outline" type="button" disabled={isLoading} className="w-full sm:w-auto">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="sun" size="lg" disabled={isLoading || !date || !selectedTime} className="w-full sm:flex-1">
              {isLoading ? "Processing…" : `Confirm and pay ₦${amount.toLocaleString()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookSessionModal;
