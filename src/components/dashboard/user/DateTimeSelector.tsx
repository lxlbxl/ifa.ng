
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
              onSelect={handleDateSelect}
              disabled={(date) => isDateUnavailable(date, availability, schedule)}
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
    </>
  );
};

export default DateTimeSelector;
