
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
  // A day early: the Babalawo's calendar may be behind the visitor's.
  const today = ymd(new Date(Date.now() - 864e5));
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

/** Wall-clock time in a time zone -> the real instant. */
export const zonedToUtc = (date: string, hhmm: string, tz: string): Date => {
  const asUtc = new Date(`${date}T${hhmm.slice(0, 5)}:00Z`);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(asUtc);
    const g = (t: string) => Number(parts.find(p => p.type === t)!.value);
    const shown = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
    return new Date(asUtc.getTime() - (shown - asUtc.getTime()));
  } catch {
    return asUtc;
  }
};

/** Today's date (yyyy-MM-dd) in a time zone. */
export const todayIn = (tz: string, now = new Date()): string => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); } catch { return ymd(now); }
};

const addDaysYmd = (d: string, n: number) => {
  const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** A time the client can book. `date`/`time` are the Babalawo's own wall clock (what the server checks); `at` is the real instant. */
export interface BookableSlot { date: string; time: string; at: Date }

export const babalawoTimeZone = (schedule?: BabalawoSchedule | null) => schedule?.settings?.timezone || 'Africa/Lagos';

/**
 * Bookable times for one of the Babalawo's own days, worked out in the Babalawo's time zone
 * (working hours, exceptions, time off, notice, advance window, step, buffer and existing bookings).
 */
export const getBookableSlotsForDay = (date: string, availability: AvailabilitySlot[], schedule?: BabalawoSchedule | null, now = new Date()): BookableSlot[] => {
  const s = schedule?.settings ?? null;
  const tz = babalawoTimeZone(schedule);
  if (s && !s.accepting_bookings) return [];
  if (schedule?.timeOff.some(t => date >= t.start_date && date <= t.end_date)) return [];
  const todays = (schedule?.exceptions ?? []).filter(e => e.exception_date === date);
  if (todays.some(e => e.kind === 'blocked' && (!e.start_time || !e.end_time))) return [];

  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const step = s?.slot_minutes ?? 60;
  const windows: [number, number][] = availability
    .filter(a => a.day_of_week === dow && a.is_available !== false)
    .map(a => [toMin(a.start_time), toMin(a.end_time)] as [number, number]);
  for (const e of todays) if (e.kind === 'extra' && e.start_time && e.end_time) windows.push([toMin(e.start_time), toMin(e.end_time)]);
  const blocked = todays.filter(e => e.kind === 'blocked' && e.start_time && e.end_time).map(e => [toMin(e.start_time!), toMin(e.end_time!)] as [number, number]);

  const earliest = now.getTime() + (s?.min_notice_hours ?? 0) * 3600e3;
  const latest = now.getTime() + (s?.max_advance_days ?? 365) * 864e5;
  const taken = (schedule?.bookedTimes[date] ?? []).map(toMin);
  const buffer = s?.buffer_minutes ?? 0;

  const out = new Map<string, BookableSlot>();
  for (const [from, to] of windows) {
    for (let t = from; t + step <= to; t += step) {
      const time = fromMin(t);
      const at = zonedToUtc(date, time, tz);
      if (at.getTime() < earliest || at.getTime() > latest) continue;
      if (blocked.some(([b0, b1]) => t < b1 && t + step > b0)) continue;
      if (taken.some(b => t < b + step + buffer && t + step + buffer > b)) continue;
      out.set(time, { date, time, at });
    }
  }
  return [...out.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
};

/** Every bookable slot over the next `days` of the Babalawo's calendar. */
export const getBookableSlots = (availability: AvailabilitySlot[], schedule: BabalawoSchedule | null | undefined, days: number, now = new Date()): BookableSlot[] => {
  const first = todayIn(babalawoTimeZone(schedule), now);
  const out: BookableSlot[] = [];
  for (let i = 0; i <= days; i++) out.push(...getBookableSlotsForDay(addDaysYmd(first, i), availability, schedule, now));
  return out;
};

/** Same as getAvailableTimesForDate but honours exceptions, time off, notice, advance window, step and existing bookings. */
export const getBookableTimes = (date: Date, availability: AvailabilitySlot[], schedule?: BabalawoSchedule | null): string[] => {
  if (!schedule) return getAvailableTimesForDate(date, availability);
  return getBookableSlotsForDay(ymd(date), availability, schedule).map(x => x.time);
};

export const isDateUnavailable = (date: Date, availability: AvailabilitySlot[], schedule?: BabalawoSchedule | null): boolean => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (date < today) return true;
  if (!schedule) return isDateDisabled(date, availability);
  return getBookableTimes(date, availability, schedule).length === 0;
};
