
import { supabase } from "@/integrations/supabase/client";

export interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export const fetchBabalawoAvailability = async (babalawoId: string): Promise<AvailabilitySlot[]> => {
  try {
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('babalawo_id', babalawoId)
      .eq('is_available', true);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching availability:', error);
    return [];
  }
};

export const getAvailableTimesForDate = (date: Date, availability: AvailabilitySlot[]): string[] => {
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
  
  return times;
};

export const isDateDisabled = (date: Date, availability: AvailabilitySlot[]): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Disable past dates
  if (date < today) return true;
  
  // If no availability data, disable all dates
  if (availability.length === 0) return true;
  
  const dayOfWeek = date.getDay();
  return !availability.some(slot => slot.day_of_week === dayOfWeek);
};
