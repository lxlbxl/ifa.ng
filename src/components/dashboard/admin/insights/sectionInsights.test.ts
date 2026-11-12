import { describe, expect, it } from 'vitest';
import { percentChange } from '@/components/brand/InsightCard';
import { SECTION_INSIGHTS, formatInsight, hasInsights } from './sectionInsights';

describe('admin insight cards', () => {
  it('formats naira, percentages, ratings and durations for a card', () => {
    expect(formatInsight(45000, 'naira')).toBe('₦45,000');
    expect(formatInsight(2_400_000, 'naira')).toBe('₦2.4M');
    expect(formatInsight(66.666, 'percent')).toBe('67%');
    expect(formatInsight(4.25, 'percent')).toBe('4.3%');
    expect(formatInsight(4.66, 'rating')).toBe('4.7★');
    expect(formatInsight(0.5, 'hours')).toBe('30 min');
    expect(formatInsight(72, 'hours')).toBe('3.0 days');
    expect(formatInsight(null, 'count')).toBe('—');
    expect(formatInsight('withdrawal_paid', 'text')).toBe('withdrawal paid');
  });

  it('compares with the previous period only when there is one', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(5, null)).toBeNull();
  });

  it('covers every major admin page except Users and Settings', () => {
    for (const s of ['overview', 'bookings', 'disputes', 'ebo', 'reviews', 'babalawos', 'applications', 'finance',
      'transactions', 'wallet-management', 'withdrawal-management', 'privacy', 'activity']) {
      expect(hasInsights(s)).toBe(true);
      expect(SECTION_INSIGHTS[s as keyof typeof SECTION_INSIGHTS].length).toBeGreaterThanOrEqual(4);
    }
    expect(hasInsights('users')).toBe(false);
    expect(hasInsights('settings')).toBe(false);
  });
});
