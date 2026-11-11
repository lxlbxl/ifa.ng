import { Flame, ClipboardList, LayoutGrid, Users, UserCheck, Wallet, Settings, CreditCard, History, Banknote, CalendarCheck, AlertTriangle, ScrollText } from 'lucide-react';

export type AdminSection =
  | 'overview' | 'users' | 'babalawos' | 'applications' | 'bookings' | 'disputes' | 'finance'
  | 'transactions' | 'wallet-management' | 'settings' | 'withdrawal-management' | 'activity' | 'ebo';

/** One list of admin sections for the sidebar, the mobile drawer and the tabs. */
export const adminSections: { section: AdminSection; label: string; short: string; icon: typeof LayoutGrid; group: string }[] = [
  { section: 'overview', label: 'Overview', short: 'Overview', icon: LayoutGrid, group: 'Run' },
  { section: 'bookings', label: 'Bookings', short: 'Bookings', icon: CalendarCheck, group: 'Run' },
  { section: 'disputes', label: 'Disputes', short: 'Disputes', icon: AlertTriangle, group: 'Run' },
  { section: 'ebo', label: 'Ebo & Etutu', short: 'Ebo', icon: Flame, group: 'Run' },
  { section: 'users', label: 'Users', short: 'Users', icon: Users, group: 'People' },
  { section: 'babalawos', label: 'Babalawos', short: 'Babalawos', icon: UserCheck, group: 'People' },
  { section: 'applications', label: 'Applications', short: 'Applications', icon: ClipboardList, group: 'People' },
  { section: 'finance', label: 'Finance', short: 'Finance', icon: Wallet, group: 'Money' },
  { section: 'transactions', label: 'Transactions', short: 'Transactions', icon: History, group: 'Money' },
  { section: 'wallet-management', label: 'Wallets', short: 'Wallets', icon: CreditCard, group: 'Money' },
  { section: 'withdrawal-management', label: 'Withdrawals', short: 'Withdrawals', icon: Banknote, group: 'Money' },
  { section: 'activity', label: 'Activity log', short: 'Activity', icon: ScrollText, group: 'System' },
  { section: 'settings', label: 'Settings', short: 'Settings', icon: Settings, group: 'System' },
];

export const adminGroups = ['Run', 'People', 'Money', 'System'] as const;
