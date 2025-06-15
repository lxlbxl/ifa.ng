
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

// Utility to load Flutterwave JS
let flutterwaveScriptLoaded = false;
function loadFlutterwaveJs() {
  return new Promise((resolve, reject) => {
    if (flutterwaveScriptLoaded) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.onload = () => {
      flutterwaveScriptLoaded = true;
      resolve(true);
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

// Helper for generating payment ref
const generatePaymentRef = () => "IFACONNECT-" + Math.random().toString(36).substr(2, 9).toUpperCase();

interface BookSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  babalawo: any; // Minimal: id, name, price, etc
}

const getFlutterwaveSettings = async () => {
  // Get Flutterwave config from admin_settings table
  const keys = [
    "flutterwave_environment",
    "flutterwave_public_key",
    "flutterwave_secret_key",
    "flutterwave_redirect_success",
    "flutterwave_redirect_failure"
  ];
  const { data, error } = await supabase
    .from("admin_settings")
    .select("setting_key,setting_value")
    .in("setting_key", keys);

  if (error) return null;
  const settings = Object.fromEntries((data || []).map((row:any) => [row.setting_key, row.setting_value]));
  return settings;
};

const BookSessionModal: React.FC<BookSessionModalProps> = ({ open, onOpenChange, babalawo }) => {
  const { user, userProfile } = useAuth();
  const [date, setDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  if (!babalawo) return null;

  // [Step 1] Booking UI
  async function handleBookAndPay(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !startTime) {
      toast({ title: "Select date and time", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    // 1. Create a session, status "pending"
    // 2. On pay success, update to "confirmed", create payment record

    try {
      const flutterSettings = await getFlutterwaveSettings();
      if (!flutterSettings || !flutterSettings.flutterwave_public_key) {
        toast({ title: "Payments temporarily unavailable. Try later.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      await loadFlutterwaveJs();
      const paymentRef = generatePaymentRef();

      // Do payment with Flutterwave
      // @ts-ignore
      window.FlutterwaveCheckout({
        public_key: flutterSettings.flutterwave_public_key,
        tx_ref: paymentRef,
        amount: Number(babalawo.price.replace(/\D/g,"")) || 100,
        currency: "NGN",
        payment_options: "card,account,banktransfer,ussd",
        redirect_url: undefined,
        customer: {
          email: userProfile?.email,
          name: userProfile?.full_name
        },
        callback: async function(response: any) {
          if (response.status === "successful") {
            // Save session (status=confirmed) & payment (status=success) to Supabase
            // 1. Insert session
            const { data: sessionData, error: sessionErr } = await supabase
              .from("sessions")
              .insert({
                user_id: user?.id,
                babalawo_id: babalawo.id,
                session_date: date,
                start_time: startTime,
                end_time: startTime, // for now, same as startTime
                status: "confirmed",
                amount: Number(babalawo.price.replace(/\D/g,"")) || 100,
                payment_status: "paid",
                payment_reference: paymentRef,
                notes: ""
              })
              .select()
              .maybeSingle();
            if (sessionErr || !sessionData) {
              toast({ title: "Booking failed after payment! Contact support.", variant: "destructive" });
              setIsLoading(false);
              return;
            }

            // 2. Insert payment
            await supabase.from("payments").insert({
              user_id: user?.id,
              babalawo_id: babalawo.id,
              session_id: sessionData.id,
              amount: sessionData.amount,
              payment_method: "flutterwave",
              status: "completed",
              flutterwave_reference: paymentRef,
              flutterwave_transaction_id: response.transaction_id
            });
            setIsLoading(false);
            onOpenChange(false);
            toast({ title: "Booking Successful! Your session is confirmed." });
          } else {
            toast({ title: "Payment cancelled or failed", variant: "destructive" });
            setIsLoading(false);
          }
        },
        customizations: {
          title: "IFA Connect",
          description: `Consultation with ${babalawo.name || "a Babalawo"}`,
          logo: "/favicon.ico"
        }
      });
    } catch (err) {
      toast({ title: "Payment error: " + (err as any).message, variant: "destructive" });
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Book Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleBookAndPay} className="space-y-4">
          <div>
            <div className="font-semibold">{babalawo.name}</div>
            <div className="text-sm text-gray-500">{babalawo.title}</div>
            <div className="mt-2">
              <span className="text-primary font-bold text-xl">{babalawo.price}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <Input type="date" value={date} min={format(new Date(), "yyyy-MM-dd")} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Time</label>
            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
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
