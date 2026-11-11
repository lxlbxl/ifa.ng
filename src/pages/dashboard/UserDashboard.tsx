import React, { useState } from 'react';
import { Award, Bell, BookOpen, CalendarDays, History, Home, LifeBuoy, Search, Settings as SettingsIcon, Wallet } from 'lucide-react';
import NetworkStatusBar from "@/components/pwa/NetworkStatusBar";
import InstallButton from "@/components/pwa/InstallButton";
import DashboardShell, { type NavGroup } from '@/components/dashboard/shell/DashboardShell';
import ClientHome from '@/components/dashboard/user/ClientHome';
import MySessions from '@/components/dashboard/user/MySessions';
import SessionHistory from '@/components/dashboard/user/SessionHistory';
import FindBabalawo from '@/components/dashboard/user/FindBabalawo';
import Settings from '@/components/dashboard/user/Settings';
import TransactionHistory from '@/components/dashboard/user/TransactionHistory';
import ClientConsultationRecords from '@/components/dashboard/user/ClientConsultationRecords';
import Loyalty from '@/components/dashboard/user/Loyalty';
import Support from '@/components/dashboard/user/Support';
import NotificationSettings from '@/components/pwa/NotificationSettings';
import Notifications from '@/components/dashboard/user/Notifications';

const GROUPS: NavGroup[] = [
  { label: 'Consult', items: [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'my-sessions', label: 'My sessions', short: 'Sessions', icon: CalendarDays },
    { id: 'find-babalawo', label: 'Find a Babalawo', short: 'Find', icon: Search },
    { id: 'spiritual-journey', label: 'Notes & Ebo', short: 'Notes', icon: BookOpen },
    { id: 'session-history', label: 'Past sessions', icon: History },
  ] },
  { label: 'Money', items: [
    { id: 'transaction-history', label: 'Wallet & payments', short: 'Wallet', icon: Wallet },
    { id: 'loyalty', label: 'Rewards', icon: Award },
  ] },
  { label: 'You', items: [
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'support', label: 'Help & support', icon: LifeBuoy },
  ] },
];

const INTROS = {
  'my-sessions': { eyebrow: 'Your diary', title: 'My sessions', lede: 'Upcoming and live consultations, with their Meet links.' },
  'session-history': { eyebrow: 'Looking back', title: 'Past sessions', lede: 'Every consultation you have had, with its notes and your review.' },
  'spiritual-journey': { eyebrow: 'Every consultation, remembered', title: 'Notes & Ebo', lede: 'What Ifá said, and the Ebo or Etutu your Babalawo prescribed.' },
  'find-babalawo': { eyebrow: 'Verified Babalawos', title: 'Find a Babalawo', lede: 'Choose who you would like to sit with. Each one is verified before they take bookings.' },
  'transaction-history': { eyebrow: 'Money', title: 'Wallet & payments', lede: 'Your balance, top-ups and what you have paid for.' },
  'notifications': { eyebrow: 'Updates', title: 'Notifications' },
  'loyalty': { eyebrow: 'Thank you for showing up', title: 'Rewards', lede: 'Earn points for consultations, reviews and the friends you bring.' },
  'settings': { eyebrow: 'Your account', title: 'Settings' },
  'support': { eyebrow: 'We are here', title: 'Help & support', lede: 'Answers to common questions, or write to us.' },
};

const UserDashboard = () => {
  // Notifications link to /dashboard?tab=records for notes and Ebo.
  const [activeSection, setActiveSection] = useState(() =>
    new URLSearchParams(window.location.search).get('tab') === 'records' ? 'spiritual-journey' : 'dashboard');

  const sections: Record<string, React.ReactNode> = {
    'dashboard': <ClientHome onNavigate={setActiveSection} />,
    'my-sessions': <MySessions />,
    'session-history': <SessionHistory />,
    'spiritual-journey': <ClientConsultationRecords />,
    'find-babalawo': <FindBabalawo />,
    'transaction-history': <TransactionHistory />,
    'notifications': <Notifications />,
    'loyalty': <Loyalty />,
    'settings': <div className="space-y-6"><NotificationSettings /><Settings /></div>,
    'support': <Support />,
  };

  return (
    <DashboardShell
      audience="client"
      groups={GROUPS}
      mobile={['dashboard', 'my-sessions', 'find-babalawo', 'spiritual-journey', 'transaction-history']}
      active={activeSection}
      intros={INTROS}
      onNavigate={setActiveSection}
      topBar={<NetworkStatusBar audience="client" />}
      headerExtra={<span className="hidden md:inline-flex"><InstallButton label="Install app" /></span>}
    >
      {sections[activeSection] ?? sections.dashboard}
    </DashboardShell>
  );
};

export default UserDashboard;
