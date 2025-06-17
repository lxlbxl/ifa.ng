
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

// Extend Window interface for Flutterwave
declare global {
  interface Window {
    FlutterwaveCheckout: (config: any) => void;
  }
}

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
  try {
    console.log("🔍 Fetching Flutterwave settings from admin_settings table...");
    
    const { data, error } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "flutterwave_environment",
        "flutterwave_public_key",
        "flutterwave_secret_key"
      ]);

    console.log("📊 Database query result:", { data, error, dataLength: data?.length });

    if (error) {
      console.error("❌ Database error:", error);
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Check if we got any data back
    if (!data || data.length === 0) {
      console.log("⚠️ No settings found in admin_settings table");
      throw new Error("No Flutterwave settings found in database. Please configure payment settings in admin panel.");
    }

    // Convert array to object
    const settings: Record<string, string> = {};
    data.forEach((row: any) => {
      if (row.setting_value && row.setting_value.trim() !== '') {
        settings[row.setting_key] = row.setting_value;
      }
    });
    
    console.log("🔧 Processed settings:", {
      keysFound: Object.keys(settings),
      hasPublicKey: !!settings.flutterwave_public_key,
      hasSecretKey: !!settings.flutterwave_secret_key,
      environment: settings.flutterwave_environment
    });
    
    // Validate required settings exist and are not empty
    const requiredKeys = ['flutterwave_public_key', 'flutterwave_environment'];
    const missingKeys = requiredKeys.filter(key => !settings[key] || settings[key].trim() === '');
    
    if (missingKeys.length > 0) {
      console.error("❌ Missing required settings:", missingKeys);
      throw new Error(`Missing required Flutterwave settings: ${missingKeys.join(', ')}. Please configure these in the admin panel.`);
    }
    
    console.log("✅ All required Flutterwave settings validated successfully");
    return settings;
  } catch (error: any) {
    console.error("💥 Error in getFlutterwaveSettings:", error);
    throw error;
  }
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
      console.log("🚀 Starting payment process...");
      
      // Get Flutterwave settings with enhanced error handling
      let flutterSettings;
      try {
        flutterSettings = await getFlutterwaveSettings();
        console.log("✅ Successfully retrieved Flutterwave settings");
      } catch (settingsError: any) {
        console.error("❌ Failed to get Flutterwave settings:", settingsError);
        toast({ 
          title: "Payment Configuration Error", 
          description: settingsError.message || "Unable to load payment settings. Please contact administrator.",
          variant: "destructive" 
        });
        setIsLoading(false);
        return;
      }

      // Load Flutterwave script
      try {
        await loadFlutterwaveJs();
        console.log("✅ Flutterwave script loaded successfully");
      } catch (scriptError) {
        console.error("❌ Failed to load Flutterwave script:", scriptError);
        toast({ 
          title: "Payment System Error", 
          description: "Failed to load payment system. Please check your internet connection and try again.",
          variant: "destructive" 
        });
        setIsLoading(false);
        return;
      }

      // Check if FlutterwaveCheckout is available
      if (typeof window.FlutterwaveCheckout !== 'function') {
        console.error("❌ FlutterwaveCheckout not available on window object");
        toast({ 
          title: "Payment System Error", 
          description: "Payment system not properly initialized. Please refresh the page and try again.",
          variant: "destructive" 
        });
        setIsLoading(false);
        return;
      }

      const paymentRef = generatePaymentRef();

      // Extract amount from price string more reliably
      let amount = 5000; // default fallback
      if (babalawo.price) {
        const priceMatch = babalawo.price.toString().match(/\d+/);
        amount = priceMatch ? parseInt(priceMatch[0]) : 5000;
      } else if (babalawo.hourly_rate) {
        amount = parseInt(babalawo.hourly_rate.toString()) || 5000;
      }

      console.log("💳 Initializing Flutterwave payment:", {
        amount,
        currency: "NGN",
        paymentRef,
        publicKeyPrefix: flutterSettings.flutterwave_public_key.substring(0, 10) + "...",
        environment: flutterSettings.flutterwave_environment
      });

      // Initialize Flutterwave payment
      window.FlutterwaveCheckout({
        public_key: flutterSettings.flutterwave_public_key,
        tx_ref: paymentRef,
        amount: amount,
        currency: "NGN",
        payment_options: "card,account,banktransfer,ussd",
        redirect_url: undefined,
        customer: {
          email: userProfile?.email || user?.email || "user@example.com",
          name: userProfile?.full_name || "User"
        },
        callback: async function(response: any) {
          console.log("📞 Payment callback received:", response);
          if (response.status === "successful") {
            try {
              console.log("✅ Payment successful, creating session...");
              
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
                  amount: amount,
                  payment_status: "paid",
                  payment_reference: paymentRef,
                  notes: ""
                })
                .select()
                .single();
                
              if (sessionErr) {
                console.error("❌ Session creation error:", sessionErr);
                toast({ 
                  title: "Booking Error", 
                  description: "Payment successful but booking failed. Please contact support with reference: " + paymentRef,
                  variant: "destructive" 
                });
                setIsLoading(false);
                return;
              }

              console.log("✅ Session created successfully:", sessionData);

              // Save payment record
              const { error: paymentErr } = await supabase.from("payments").insert({
                user_id: user?.id,
                babalawo_id: babalawo.id,
                session_id: sessionData.id,
                amount: amount,
                payment_method: "flutterwave",
                status: "completed",
                flutterwave_reference: paymentRef,
                flutterwave_transaction_id: response.transaction_id
              });
              
              if (paymentErr) {
                console.error("❌ Payment record error:", paymentErr);
                // Don't fail the entire process for this
              }
              
              setIsLoading(false);
              onOpenChange(false);
              toast({ 
                title: "Booking Successful!", 
                description: "Your consultation session has been confirmed."
              });
              
            } catch (error) {
              console.error("❌ Error processing successful payment:", error);
              toast({ 
                title: "Processing Error", 
                description: "Payment successful but booking processing failed. Please contact support.",
                variant: "destructive" 
              });
              setIsLoading(false);
            }
          } else {
            console.log("❌ Payment not successful:", response);
            toast({ 
              title: "Payment Failed", 
              description: "Payment was not completed successfully.",
              variant: "destructive" 
            });
            setIsLoading(false);
          }
        },
        onclose: function() {
          console.log("🔒 Payment modal closed by user");
          setIsLoading(false);
        },
        customizations: {
          title: "IFA Connect",
          description: `Consultation with ${babalawo.full_name || babalawo.name || "Babalawo"}`,
          logo: "/favicon.ico"
        }
      });
      
    } catch (err: any) {
      console.error("💥 Unexpected payment error:", err);
      toast({ 
        title: "Payment Error", 
        description: "An unexpected error occurred: " + err.message,
        variant: "destructive" 
      });
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
              <span className="text-primary font-bold text-xl">
                {babalawo.price || `₦${babalawo.hourly_rate || 5000}/hr`}
              </span>
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
