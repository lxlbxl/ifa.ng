import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { handlePaymentAndBooking, PaymentMethod } from "@/utils/multiGatewayPaymentHandler";
import { getUserWallet } from "@/utils/walletUtils";
import { parseBabalawoPrice, formatPrice } from "@/utils/priceUtils";
import PaymentMethodSelector from "./PaymentMethodSelector";
import FeeDisclosure from "./FeeDisclosure";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface InstantConsultationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babalawo: any;
}

const InstantConsultationModal: React.FC<InstantConsultationModalProps> = ({ 
  open, 
  onOpenChange, 
  babalawo 
}) => {
  const { user, userProfile } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch user wallet when modal opens
  useEffect(() => {
    if (open && user?.id) {
      getUserWallet(user.id).then(wallet => {
        setWalletBalance(wallet?.balance || 0);
      });
    }
  }, [open, user?.id]);

  if (!babalawo) return null;

  async function handleInstantConsultation(e: React.FormEvent) {
    e.preventDefault();

    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    // Phase 2: Real-time status check before payment
    try {
      const { data: currentStatus, error: statusError } = await supabase
        .from('babalawos')
        .select('is_active, current_status')
        .eq('id', babalawo.id)
        .single();

      if (statusError) throw statusError;

      if (!currentStatus?.is_active || currentStatus?.current_status === 'busy') {
        toast({
          title: "Babalawo Unavailable",
          description: "This babalawo is no longer available for instant consultation. Please try again later.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Check for concurrent sessions
      const { data: activeSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id')
        .eq('babalawo_id', babalawo.id)
        .eq('status', 'in_progress');

      if (sessionsError) throw sessionsError;

      if (activeSessions && activeSessions.length >= 1) {
        toast({
          title: "Babalawo Busy",
          description: "This babalawo is currently in another session. Please wait a moment and try again.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error checking babalawo status:', error);
      toast({
        title: "Error",
        description: "Could not verify babalawo availability. Please try again.",
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }

    // Use centralized price parsing utility
    const amount = parseBabalawoPrice(babalawo);

    // Current date and time for instant session
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    await handlePaymentAndBooking(
      {
        user,
        userProfile,
        babalawo,
        date: now,
        selectedTime: currentTime,
        amount,
        paymentMethod,
        walletBalance,
        isInstant: true
      },
      async (sessionId) => {
        // Phase 2: Send notification to babalawo about instant session
        try {
          // Get babalawo user_id
          const { data: babalawoData } = await supabase
            .from('babalawos')
            .select('user_id, full_name, phone_number')
            .eq('id', babalawo.id)
            .single();

          if (babalawoData?.user_id) {
            // Create notification
            await supabase
              .from('notifications')
              .insert({
                user_id: babalawoData.user_id,
                type: 'instant_session_request',
                title: 'New Instant Session',
                message: `${userProfile?.full_name || user.email} has started an instant consultation and is waiting for you!`,
                data: { session_id: sessionId },
                priority: 'urgent'
              });

            // Send email notification (imported dynamically to avoid circular deps)
            import('@/services/emailService').then(({ sendInstantSessionAlert }) => {
              sendInstantSessionAlert({
                to: user.email || '',
                babalawoName: babalawoData.full_name,
                userName: userProfile?.full_name || user.email || 'A user'
              });
            }).catch(console.error);

            // Send SMS notification
            if (babalawoData.phone_number) {
              import('@/services/smsService').then(({ sendInstantSessionAlertSMS }) => {
                sendInstantSessionAlertSMS({
                  to: babalawoData.phone_number,
                  babalawoName: babalawoData.full_name,
                  userName: userProfile?.full_name || 'A user'
                });
              }).catch(console.error);
            }
          }
        } catch (error) {
          console.error('Error sending babalawo notification:', error);
          // Don't fail the whole flow if notification fails
        }

        setIsLoading(false);
        onOpenChange(false);

        toast({
          title: "Payment Successful!",
          description: "Joining instant consultation session..."
        });

        // Navigate to the session room
        navigate(`/session/${sessionId}`);
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

  // Extract amount for display using centralized utility
  const amount = parseBabalawoPrice(babalawo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Start Instant Consultation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleInstantConsultation} className="space-y-4">
          <div className="text-center sm:text-left">
            <div className="font-semibold text-base sm:text-lg">{babalawo.full_name || babalawo.name || "Babalawo"}</div>
            <div className="text-sm text-gray-500">{babalawo.title || "Ifa Priest & Spiritual Guide"}</div>
            <div className="mt-2">
              <span className="text-primary font-bold text-xl sm:text-2xl">
                ₦{amount.toLocaleString()}
              </span>
              <span className="text-sm text-gray-500 ml-1">per session</span>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-md">
            <h3 className="font-medium text-green-800 mb-1">Instant Consultation</h3>
            <p className="text-sm text-green-700">
              This Babalawo is currently online and available for an immediate consultation.
              You will be connected right after payment is confirmed.
            </p>
          </div>

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
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? "Processing..." : "Pay & Start Consultation"}
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

export default InstantConsultationModal;
