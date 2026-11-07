
import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AvailabilitySlot, BabalawoSchedule, getBookableTimes, isDateUnavailable } from "@/utils/availabilityUtils";

interface DateTimeSelectorProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  selectedTime: string;
  setSelectedTime: (time: string) => void;
  availability: AvailabilitySlot[];
  schedule?: BabalawoSchedule | null;
}

const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  date,
  setDate,
  selectedTime,
  setSelectedTime,
  availability,
  schedule
}) => {
  const availableTimes = date ? getBookableTimes(date, availability, schedule) : [];

  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    setSelectedTime(""); // Reset selected time when date changes
  };

  return (
    <>
      <div>
        <label className="mb-2 block text-sm font-bold">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-12 w-full justify-start rounded-field border-[1.5px] border-input bg-paper text-left font-normal text-ink hover:bg-paper hover:text-ink",
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
              onSelect={handleDateSelect}
              disabled={(date) => isDateUnavailable(date, availability, schedule)}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
      
      <div>
        <label className="mb-2 block text-sm font-bold">Time</label>
        {date && availableTimes.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {availableTimes.map((time) => (
              <Button
                key={time}
                type="button"
                variant={selectedTime === time ? "default" : "secondary"}
                size="sm"
                onClick={() => setSelectedTime(time)}
                aria-pressed={selectedTime === time}
                className="text-xs"
              >
                {time}
              </Button>
            ))}
          </div>
        ) : date ? (
          <p className="text-sm text-muted-foreground">No free times on this day. Try another date.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Pick a date to see times.</p>
        )}
      </div>
    </>
  );
};

export default DateTimeSelector;
