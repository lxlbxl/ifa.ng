import { describe, expect, it } from 'vitest';
import { ADMIN_TABS, BABALAWO_TABS, CLIENT_TABS, legacyDashboardTarget, resolveTab } from './dashboardLinks';

describe('dashboard links', () => {
  it('maps short client names to section ids', () => {
    expect(resolveTab(CLIENT_TABS, 'sessions', 'dashboard')).toBe('my-sessions');
    expect(resolveTab(CLIENT_TABS, 'wallet', 'dashboard')).toBe('transaction-history');
    expect(resolveTab(CLIENT_TABS, 'profile', 'dashboard')).toBe('settings');
    expect(resolveTab(CLIENT_TABS, 'nonsense', 'dashboard')).toBe('dashboard');
  });
  it('maps admin and Babalawo names', () => {
    expect(resolveTab(ADMIN_TABS, 'analytics', 'overview')).toBe('overview');
    expect(resolveTab(ADMIN_TABS, 'users', 'overview')).toBe('users');
    expect(resolveTab(BABALAWO_TABS, 'wallet', 'dashboard')).toBe('payments');
  });
  it('turns legacy paths into /dashboard', () => {
    expect(legacyDashboardTarget('?tab=sessions')).toBe('/dashboard?tab=sessions');
    expect(legacyDashboardTarget('')).toBe('/dashboard');
    expect(legacyDashboardTarget('?open=wallet')).toBe('/dashboard?tab=wallet');
  });
});
