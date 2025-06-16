
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  babalawo: any;
}

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const getFlutterwaveSettings = async () => {
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
  const [date, setDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);

  // Fetch babalawo availability
  useEffect(() => {
    if (open && babalawo?.id) {
      fetchAvailability();
    }
  }, [open, babalawo?.id]);

  // Update available times when date changes
  useEffect(() => {
    if (date && availability.length > 0) {
      updateAvailableTimes();
    }
  }, [date, availability]);

  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('babalawo_id', babalawo.id)
        .eq('is_available', true);

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

  const updateAvailableTimes = () => {
    if (!date) return;
    
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daySlots = availability.filter(slot => slot.day_of_week === dayOfWeek);
    
    const times: string[] = [];
    daySlots.forEach(slot => {
      // Generate hourly slots between start_time and end_time
      const start = new Date(`2000-01-01T${slot.start_time}`);
      const end = new Date(`2000-01-01T${slot.end_time}`);
      
      while (start < end) {
        times.push(start.toTimeString().slice(0, 5));
        start.setHours(start.getHours() + 1);
      }
    });
    
    setAvailableTimes(times);
    setSelectedTime(""); // Reset selected time when date changes
  };

  // Check if a date should be disabled (no availability)
  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Disable past dates
    if (date < today) return true;
    
    // If no availability data, disable all dates
    if (availability.length === 0) return true;
    
    const dayOfWeek = date.getDay();
    return !availability.some(slot => slot.day_of_week === dayOfWeek);
  };

  if (!babalawo) return null;

  async function handleBookAndPay(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !selectedTime) {
      toast({ title: "Please select both date and time", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      const flutterSettings = await getFlutterwaveSettings();
      if (!flutterSettings || !flutterSettings.flutterwave_public_key) {
        toast({ 
          title: "Payment Setup Required", 
          description: "Payment system is not configured. Please contact administrator.",
          variant: "destructive" 
        });
        setIsLoading(false);
        return;
      }
      
      await loadFlutterwaveJs();
      const paymentRef = generatePaymentRef();

      // @ts-ignore
      window.FlutterwaveCheckout({
        public_key: flutterSettings.flutterwave_public_key,
        tx_ref: paymentRef,
        amount: Number(babalawo.price.replace(/\D/g,"")) || 100,
        currency: "NGN",
        payment_options: "card,account,banktransfer,ussd",
        redirect_url: undefined,
        customer: {
          email: userProfile?.email || user?.email,
          name: userProfile?.full_name || "User"
        },
        callback: async function(response: any) {
          if (response.status === "successful") {
            // Save session
            const { data: sessionData, error: sessionErr } = await supabase
              .from("sessions")
              .insert({
                user_id: user?.id,
                babalawo_id: babalawo.id,
                session_date: format(date, "yyyy-MM-dd"),
                start_time: selectedTime,
                end_time: selectedTime,
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

            // Save payment record
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
          description: `Consultation with ${babalawo.full_name || babalawo.name || "a Babalawo"}`,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleBookAndPay} className="space-y-4">
          <div>
            <div className="font-semibold">{babalawo.full_name || babalawo.name}</div>
            <div className="text-sm text-gray-500">{babalawo.title}</div>
            <div className="mt-2">
              <span className="text-primary font-bold text-xl">{babalawo.price}</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={isDateDisabled}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Available Times</label>
            {date && availableTimes.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {availableTimes.map((time) => (
                  <Button
                    key={time}
                    type="button"
                    variant={selectedTime === time ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTime(time)}
                    className="text-xs"
                  >
                    {time}
                  </Button>
                ))}
              </div>
            ) : date ? (
              <p className="text-sm text-gray-500">No available times for this date</p>
            ) : (
              <p className="text-sm text-gray-500">Please select a date first</p>
            )}
          </div>
          
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
