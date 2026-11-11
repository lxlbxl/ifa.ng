import React, { useState } from 'react';
import NetworkStatusBar from "@/components/pwa/NetworkStatusBar";
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/dashboard/user/Sidebar';
import DashboardHeader from '@/components/dashboard/user/DashboardHeader';
import MobileBottomNav from '@/components/dashboard/user/MobileBottomNav';
import SummaryCards from '@/components/dashboard/user/SummaryCards';
import UpcomingSessions from '@/components/dashboard/user/UpcomingSessions';
import MySessions from '@/components/dashboard/user/MySessions';
import SessionHistory from '@/components/dashboard/user/SessionHistory';
import FindBabalawo from '@/components/dashboard/user/FindBabalawo';
import Settings from '@/components/dashboard/user/Settings';
import TransactionHistory from '@/components/dashboard/user/TransactionHistory';
import FeaturedBabalawos from '@/components/FeaturedBabalawos';
import WalletWidget from '@/components/dashboard/user/WalletWidget';
import ClientConsultationRecords from '@/components/dashboard/user/ClientConsultationRecords';
import Loyalty from '@/components/dashboard/user/Loyalty';
import Support from '@/components/dashboard/user/Support';
import NotificationSettings from '@/components/pwa/NotificationSettings';
import Notifications from '@/components/dashboard/user/Notifications';

// Updated section content for card-based, modern layout
const DashboardContent = () => (
  <div className="flex flex-col xl:flex-row gap-4 sm:gap-6 lg:gap-8 w-full animate-fade-in">
    <div className="flex-1 min-w-0 flex flex-col gap-4 sm:gap-6 lg:gap-8">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full">
        <SummaryCards />
      </div>
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <div className="bg-white rounded-2xl shadow-lg px-4 sm:px-6 py-4 sm:py-6 hover:shadow-xl transition-all duration-300 animate-fade-in-up">
          <UpcomingSessions />
        </div>
        <div className="bg-white/70 backdrop-blur-sm p-4 sm:p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 animate-fade-in-up" style={{animationDelay: '100ms'}}>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4">Discover Babalawos</h2>
          <FeaturedBabalawos />
        </div>
      </div>
    </div>
    {/* Right-side summary panel for notifications or tips, as in modern dashboards */}
    <div className="w-full xl:w-80 2xl:w-96 shrink-0 flex flex-col gap-4 sm:gap-6">
      <WalletWidget />
      <div className="bg-gradient-to-br from-white via-orange-50/50 to-pink-50/50 rounded-2xl shadow-lg px-4 sm:px-6 lg:px-7 py-4 sm:py-6 lg:py-7 hover:shadow-xl transition-all duration-300 border border-orange-100/50 animate-scale-in">
        <h3 className="font-bold text-base sm:text-lg mb-2 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">Quick Actions</h3>
        <MySessions />
      </div>
      <div className="bg-white rounded-2xl shadow-md p-4 sm:p-6 hover:shadow-lg transition-all duration-300 border border-gray-100 animate-scale-in" style={{animationDelay: '150ms'}}>
        <h3 className="font-semibold text-sm sm:text-base mb-3 text-gray-800 flex items-center gap-2">
          <span className="w-1 h-4 bg-gradient-to-b from-primary to-purple-600 rounded-full"></span>
          Tips for a Great Session
        </h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
            <span className="text-primary mt-0.5">•</span>
            <span>Be on time for your bookings</span>
          </li>
          <li className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
            <span className="text-primary mt-0.5">•</span>
            <span>Ask clear questions</span>
          </li>
          <li className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
            <span className="text-primary mt-0.5">•</span>
            <span>Prepare your space for spiritual clarity</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
);

const SECTION_MAP: { [key: string]: React.ReactNode } = {
  'dashboard': <DashboardContent />,
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

const UserDashboard = () => {
  // Notifications link to /dashboard?tab=records for notes and Ebo.
  const [activeSection, setActiveSection] = useState(() =>
    new URLSearchParams(window.location.search).get('tab') === 'records' ? 'spiritual-journey' : 'dashboard');

  // Page transition variants
  const pageVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 }
  };

  const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.3
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-orange-50 via-pink-50/30 to-purple-50/20 font-poppins">
      {/* Always show sidebar on desktop, only in drawer on mobile */}
      <div className="hidden lg:flex">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-40">
          <NetworkStatusBar audience="client" />
          <DashboardHeader activeSection={activeSection} onSectionChange={setActiveSection} />
        </div>
        <main className="flex-grow p-3 sm:p-6 lg:p-8 xl:p-10 space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto pb-20 lg:pb-8">
          <div className="w-full max-w-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={pageVariants}
                transition={pageTransition}
              >
                {SECTION_MAP[activeSection]}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        {/* Mobile Bottom Navigation */}
        <MobileBottomNav activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
    </div>
  );
};

export default UserDashboard;
