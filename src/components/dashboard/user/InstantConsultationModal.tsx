import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { handlePaymentAndBooking, PaymentMethod } from "@/utils/multiGatewayPaymentHandler";
import { getUserWallet } from "@/utils/walletUtils";
import PaymentMethodSelector from "./PaymentMethodSelector";
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
    setIsLoading(true);

    // Extract amount from babalawo data
    let amount = 15000; // default fallback
    if (babalawo.hourly_rate) {
      amount = parseInt(babalawo.hourly_rate.toString()) || 15000;
    } else if (babalawo.price) {
      const priceMatch = babalawo.price.toString().match(/\d+/);
      amount = priceMatch ? parseInt(priceMatch[0]) : 15000;
      if (amount < 1000) {
        amount = amount * 1000;
      }
    }

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
        walletBalance
      },
      async () => {
        try {
          // Create instant session with special flag
          const { data: sessionData, error: sessionErr } = await supabase
            .from("sessions")
            .insert({
              user_id: user?.id,
              babalawo_id: babalawo.id,
              session_date: now.toISOString().split('T')[0],
              start_time: currentTime,
              end_time: currentTime,
              status: "in_progress", // Special status for instant sessions
              amount: amount,
              payment_status: "paid",
              is_instant: true, // Flag for instant session
              notes: "Instant consultation"
            })
            .select()
            .single();

          if (sessionErr) throw sessionErr;

          setIsLoading(false);
          onOpenChange(false);
          
          toast({ 
            title: "Payment Successful!", 
            description: "Joining instant consultation session..."
          });

          // Navigate to the session room
          navigate(`/session/${sessionData.id}`);
        } catch (error) {
          console.error("Error creating instant session:", error);
          toast({ 
            title: "Session Error", 
            description: "Payment successful but couldn't start session. Please contact support.",
            variant: "destructive" 
          });
          setIsLoading(false);
        }
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
    if (amount < 1000) {
      amount = amount * 1000;
    }
  }

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

export default InstantConsultationModal;import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { handlePaymentAndBooking, PaymentMethod } from "@/utils/multiGatewayPaymentHandler";
import { getUserWallet } from "@/utils/walletUtils";
import PaymentMethodSelector from "./PaymentMethodSelector";
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
    setIsLoading(true);

    // Extract amount from babalawo data
    let amount = 15000; // default fallback
    if (babalawo.hourly_rate) {
      amount = parseInt(babalawo.hourly_rate.toString()) || 15000;
    } else if (babalawo.price) {
      const priceMatch = babalawo.price.toString().match(/\d+/);
      amount = priceMatch ? parseInt(priceMatch[0]) : 15000;
      if (amount < 1000) {
        amount = amount * 1000;
      }
    }

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
        walletBalance
      },
      async () => {
        try {
          // Create instant session with special flag
          const { data: sessionData, error: sessionErr } = await supabase
            .from("sessions")
            .insert({
              user_id: user?.id,
              babalawo_id: babalawo.id,
              session_date: now.toISOString().split('T')[0],
              start_time: currentTime,
              end_time: currentTime,
              status: "in_progress", // Special status for instant sessions
              amount: amount,
              payment_status: "paid",
              is_instant: true, // Flag for instant session
              notes: "Instant consultation"
            })
            .select()
            .single();

          if (sessionErr) throw sessionErr;

          setIsLoading(false);
          onOpenChange(false);
          
          toast({ 
            title: "Payment Successful!", 
            description: "Joining instant consultation session..."
          });

          // Navigate to the session room
          navigate(`/session/${sessionData.id}`);
        } catch (error) {
          console.error("Error creating instant session:", error);
          toast({ 
            title: "Session Error", 
            description: "Payment successful but couldn't start session. Please contact support.",
            variant: "destructive" 
          });
          setIsLoading(false);
        }
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
    if (amount < 1000) {
      amount = amount * 1000;
    }
  }

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