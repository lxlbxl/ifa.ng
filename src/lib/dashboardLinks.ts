/**
 * One place that says where old and short dashboard links should land.
 *
 * Links in the wild use names like /dashboard/user?tab=sessions or
 * /dashboard?tab=wallet. Each dashboard has its own section ids, so every
 * dashboard resolves the name in the URL through one of these maps.
 */

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/** Client dashboard section ids (see UserDashboard GROUPS). */
export const CLIENT_TABS: Record<string, string> = {
  dashboard: 'dashboard', home: 'dashboard', overview: 'dashboard',
  'my-sessions': 'my-sessions', sessions: 'my-sessions', consultations: 'my-sessions', bookings: 'my-sessions',
  'session-history': 'session-history', history: 'session-history', past: 'session-history',
  'spiritual-journey': 'spiritual-journey', records: 'spiritual-journey', notes: 'spiritual-journey', ebo: 'spiritual-journey',
  'find-babalawo': 'find-babalawo', find: 'find-babalawo', babalawos: 'find-babalawo', search: 'find-babalawo',
  'transaction-history': 'transaction-history', wallet: 'transaction-history', payments: 'transaction-history', transactions: 'transaction-history', earnings: 'transaction-history',
  notifications: 'notifications', alerts: 'notifications',
  settings: 'settings', profile: 'settings', account: 'settings',
  support: 'support', help: 'support',
};

/** Babalawo dashboard section ids (see BabalawoDashboard SECTION_MAP). */
export const BABALAWO_TABS: Record<string, string> = {
  dashboard: 'dashboard', home: 'dashboard', overview: 'dashboard',
  consultations: 'consultations', sessions: 'consultations', 'my-sessions': 'consultations', bookings: 'consultations',
  availability: 'availability', hours: 'availability', schedule: 'availability',
  pricing: 'pricing', prices: 'pricing',
  payments: 'payments', wallet: 'payments',
  earnings: 'earnings', withdrawals: 'earnings',
  reviews: 'reviews',
  notifications: 'notifications', alerts: 'notifications',
  reminders: 'reminders',
  profile: 'profile',
  settings: 'settings',
  support: 'support', help: 'support',
};

/** Admin dashboard section ids (see adminSections). */
export const ADMIN_TABS: Record<string, string> = {
  overview: 'overview', dashboard: 'overview', analytics: 'overview', home: 'overview',
  users: 'users', babalawos: 'babalawos', applications: 'applications',
  bookings: 'bookings', sessions: 'bookings', disputes: 'disputes', ebo: 'ebo', reviews: 'reviews',
  finance: 'finance', payments: 'finance', transactions: 'transactions',
  'wallet-management': 'wallet-management', wallets: 'wallet-management', wallet: 'wallet-management',
  'withdrawal-management': 'withdrawal-management', withdrawals: 'withdrawal-management',
  privacy: 'privacy', 'data-requests': 'privacy', breaches: 'privacy',
  activity: 'activity', settings: 'settings',
};

/** The section a URL asks for, or `fallback` when the name is not known. */
export const resolveTab = (map: Record<string, string>, raw: string | null | undefined, fallback: string): string =>
  map[norm(raw)] ?? fallback;

/**
 * Old paths: /dashboard/user and /dashboard/admin (with ?tab=) were never
 * routes. They now redirect to /dashboard, keeping the requested section.
 */
export const legacyDashboardTarget = (search: string, extra?: string): string => {
  const p = new URLSearchParams(search);
  const tab = p.get('tab') ?? p.get('section') ?? extra ?? p.get('open');
  return tab ? `/dashboard?tab=${encodeURIComponent(norm(tab))}` : '/dashboard';
};
