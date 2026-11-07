
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

// ---- Schedule extras: date exceptions, time off, scheduling settings ----
export interface AvailabilityException {
  exception_date: string; // yyyy-MM-dd
  kind: 'blocked' | 'extra';
  start_time: string | null;
  end_time: string | null;
}
export interface TimeOffRange { start_date: string; end_date: string }
export interface SchedulingSettings {
  slot_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  accepting_bookings: boolean;
  timezone: string;
}
export interface BabalawoSchedule {
  exceptions: AvailabilityException[];
  timeOff: TimeOffRange[];
  settings: SchedulingSettings | null;
  bookedTimes: Record<string, string[]>; // yyyy-MM-dd -> HH:mm starts already taken
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

export const fetchBabalawoSchedule = async (babalawoUserId: string): Promise<BabalawoSchedule> => {
  const db = supabase as any;
  const today = ymd(new Date());
  const [exc, off, set, booked] = await Promise.all([
    db.from('availability_exceptions').select('exception_date, kind, start_time, end_time').eq('babalawo_id', babalawoUserId).gte('exception_date', today),
    db.from('babalawo_time_off').select('start_date, end_date').eq('babalawo_id', babalawoUserId).gte('end_date', today),
    db.from('babalawo_scheduling_settings').select('*').eq('babalawo_id', babalawoUserId).maybeSingle(),
    db.from('sessions').select('session_date, start_time').eq('babalawo_id', babalawoUserId).gte('session_date', today).in('status', ['pending', 'confirmed', 'in_progress']),
  ]);
  const bookedTimes: Record<string, string[]> = {};
  for (const r of booked.data ?? []) (bookedTimes[r.session_date] ||= []).push(String(r.start_time).slice(0, 5));
  return { exceptions: exc.data ?? [], timeOff: off.data ?? [], settings: set.data ?? null, bookedTimes };
};

/** Same as getAvailableTimesForDate but honours exceptions, time off, notice, advance window, step and existing bookings. */
export const getBookableTimes = (date: Date, availability: AvailabilitySlot[], schedule?: BabalawoSchedule | null): string[] => {
  if (!schedule) return getAvailableTimesForDate(date, availability);
  const key = ymd(date);
  const s = schedule.settings;
  if (s && !s.accepting_bookings) return [];
  if (schedule.timeOff.some(t => key >= t.start_date && key <= t.end_date)) return [];
  const todays = schedule.exceptions.filter(e => e.exception_date === key);
  if (todays.some(e => e.kind === 'blocked' && (!e.start_time || !e.end_time) )) return [];

  const step = s?.slot_minutes ?? 60;
  const windows: [number, number][] = availability
    .filter(a => a.day_of_week === date.getDay() && a.is_available !== false)
    .map(a => [toMin(a.start_time), toMin(a.end_time)] as [number, number]);
  for (const e of todays) if (e.kind === 'extra' && e.start_time && e.end_time) windows.push([toMin(e.start_time), toMin(e.end_time)]);
  const blocked = todays.filter(e => e.kind === 'blocked' && e.start_time && e.end_time).map(e => [toMin(e.start_time!), toMin(e.end_time!)] as [number, number]);

  const now = new Date();
  const earliest = now.getTime() + (s?.min_notice_hours ?? 0) * 3600e3;
  const latest = now.getTime() + (s?.max_advance_days ?? 365) * 864e5;
  const taken = (schedule.bookedTimes[key] ?? []).map(toMin);
  const buffer = s?.buffer_minutes ?? 0;

  const out = new Set<string>();
  for (const [from, to] of windows) {
    for (let t = from; t + step <= to; t += step) {
      const startMs = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(t / 60), t % 60).getTime();
      if (startMs < earliest || startMs > latest) continue;
      if (blocked.some(([b0, b1]) => t < b1 && t + step > b0)) continue;
      if (taken.some(b => t < b + step + buffer && t + step + buffer > b)) continue;
      out.add(fromMin(t));
    }
  }
  return [...out].sort();
};

export const isDateUnavailable = (date: Date, availability: AvailabilitySlot[], schedule?: BabalawoSchedule | null): boolean => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (date < today) return true;
  if (!schedule) return isDateDisabled(date, availability);
  return getBookableTimes(date, availability, schedule).length === 0;
};
