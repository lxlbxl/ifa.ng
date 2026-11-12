import { describe, expect, it } from 'vitest';
import { getBookableSlots, getBookableSlotsForDay, zonedToUtc, type BabalawoSchedule } from './availabilityUtils';
import { sessionEnd, sessionStart } from './sessionTime';

const schedule = (timezone: string, extra: Partial<BabalawoSchedule['settings']> = {}): BabalawoSchedule => ({
  exceptions: [], timeOff: [], bookedTimes: {},
  settings: { slot_minutes: 60, buffer_minutes: 0, min_notice_hours: 0, max_advance_days: 365, accepting_bookings: true, timezone, ...extra },
});
// Mondays 09:00-11:00 on the Babalawo's clock.
const hours = [{ day_of_week: 1, start_time: '09:00', end_time: '11:00', is_available: true }];
const now = new Date('2027-01-01T00:00:00Z');

describe('booking times across time zones', () => {
  it('turns a wall-clock time into the real instant, with summer time', () => {
    expect(zonedToUtc('2027-01-11', '09:00', 'Africa/Lagos').toISOString()).toBe('2027-01-11T08:00:00.000Z');
    expect(zonedToUtc('2027-07-12', '09:00', 'Europe/London').toISOString()).toBe('2027-07-12T08:00:00.000Z');
    expect(zonedToUtc('2027-01-11', '09:00', 'America/New_York').toISOString()).toBe('2027-01-11T14:00:00.000Z');
  });

  it("works out slots on the Babalawo's calendar and keeps their clock for the server", () => {
    const slots = getBookableSlotsForDay('2027-01-11', hours, schedule('Africa/Lagos'), now);
    expect(slots.map((s) => [s.date, s.time, s.at.toISOString()])).toEqual([
      ['2027-01-11', '09:00', '2027-01-11T08:00:00.000Z'],
      ['2027-01-11', '10:00', '2027-01-11T09:00:00.000Z'],
    ]);
  });

  it("uses the Babalawo's weekday, not the visitor's", () => {
    // A Babalawo in Auckland works Monday 09:00 there, which is Sunday evening in UTC.
    const slots = getBookableSlotsForDay('2027-01-11', hours, schedule('Pacific/Auckland'), now);
    expect(slots[0].at.toISOString()).toBe('2027-01-10T20:00:00.000Z');
    expect(getBookableSlotsForDay('2027-01-10', hours, schedule('Pacific/Auckland'), now)).toEqual([]);
  });

  it('respects notice against the real time', () => {
    const justBefore = new Date('2027-01-11T07:30:00Z'); // 08:30 in Lagos
    const slots = getBookableSlotsForDay('2027-01-11', hours, schedule('Africa/Lagos', { min_notice_hours: 1 }), justBefore);
    expect(slots.map((s) => s.time)).toEqual(['10:00']);
  });

  it('lists slots over the coming days', () => {
    expect(getBookableSlots(hours, schedule('Africa/Lagos'), 14, now).length).toBe(4);
  });

  it('reads stored instants first, then falls back to Lagos time', () => {
    expect(sessionStart({ starts_at: '2027-01-11T08:00:00Z', session_date: '2027-01-11', start_time: '23:00' }).toISOString())
      .toBe('2027-01-11T08:00:00.000Z');
    expect(sessionStart({ session_date: '2027-01-11', start_time: '09:00:00' }).toISOString()).toBe('2027-01-11T08:00:00.000Z');
    expect(sessionEnd({ session_date: '2027-01-11', start_time: '23:30', end_time: '00:30' }).toISOString()).toBe('2027-01-11T23:30:00.000Z');
  });
});
