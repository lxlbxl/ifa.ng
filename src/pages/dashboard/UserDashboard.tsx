import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/dashboard/user/Sidebar';
import MobileBottomNav from '@/components/dashboard/user/MobileBottomNav';
import DashboardHeader from '@/components/dashboard/user/DashboardHeader';
import SummaryCards from '@/components/dashboard/user/SummaryCards';
import UpcomingSessions from '@/components/dashboard/user/UpcomingSessions';
import MySessions from '@/components/dashboard/user/MySessions';
import SessionHistory from '@/components/dashboard/user/SessionHistory';
import FindBabalawo from '@/components/dashboard/user/FindBabalawo';
import Settings from '@/components/dashboard/user/Settings';
import TransactionHistory from '@/components/dashboard/user/TransactionHistory';
import FeaturedBabalawos from '@/components/FeaturedBabalawos';
import WalletWidget from '@/components/dashboard/user/WalletWidget';
import SpiritualJourney from '@/components/dashboard/user/SpiritualJourney';
import Loyalty from '@/components/dashboard/user/Loyalty';
import Support from '@/components/dashboard/user/Support';

// Updated section content for card-based, modern layout
const DashboardContent = () => (
  <div className="flex flex-col xl:flex-row gap-4 sm:gap-6 lg:gap-8 w-full">
    <div className="flex-1 min-w-0 flex flex-col gap-4 sm:gap-6 lg:gap-8">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full">
        <SummaryCards />
      </div>
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <div className="bg-white rounded-2xl shadow-lg px-4 sm:px-6 py-4 sm:py-6">
          <UpcomingSessions />
        </div>
        <div className="bg-white/50 p-4 sm:p-6 rounded-xl shadow-md">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4">Discover Babalawos</h2>
          <FeaturedBabalawos />
        </div>
      </div>
    </div>
    {/* Right-side summary panel for notifications or tips, as in modern dashboards */}
    <div className="w-full xl:w-80 2xl:w-96 shrink-0 flex flex-col gap-4 sm:gap-6">
      <WalletWidget />
      <div className="bg-gradient-to-br from-white to-orange-50 rounded-2xl shadow-lg px-4 sm:px-6 lg:px-7 py-4 sm:py-6 lg:py-7">
        <h3 className="font-bold text-base sm:text-lg mb-2 text-orange-500">Quick Actions</h3>
        <MySessions />
      </div>
      <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
        <h3 className="font-semibold text-sm sm:text-base mb-2 text-gray-700">Tips for a Great Session</h3>
        <ul className="list-disc pl-5 text-xs sm:text-sm text-gray-600 space-y-1">
          <li>Be on time for your bookings</li>
          <li>Ask clear questions</li>
          <li>Prepare your space for spiritual clarity</li>
        </ul>
      </div>
    </div>
  </div>
);

const SECTION_MAP: { [key: string]: React.ReactNode } = {
  'dashboard': <DashboardContent />,
  'my-sessions': <MySessions />,
  'session-history': <SessionHistory />,
  'spiritual-journey': <SpiritualJourney />,
  'find-babalawo': <FindBabalawo />,
  'transaction-history': <TransactionHistory />,
  'loyalty': <Loyalty />,
  'settings': <Settings />,
  'support': <Support />,
};

const UserDashboard = () => {
  const [activeSection, setActiveSection] = useState('dashboard');

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 font-poppins">
      {/* Always show sidebar on desktop, only in drawer on mobile */}
      <div className="hidden lg:flex">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader activeSection={activeSection} onSectionChange={setActiveSection} />
        <main className="flex-grow p-3 sm:p-6 lg:p-8 xl:p-10 pb-20 lg:pb-8 space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              className="w-full max-w-none"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                duration: 0.3,
                ease: [0.25, 0.1, 0.25, 1]
              }}
            >
              {SECTION_MAP[activeSection]}
            </motion.div>
          </AnimatePresence>
        </main>
        {/* Mobile Bottom Navigation */}
        <MobileBottomNav activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
    </div>
  );
};

export default UserDashboard;
