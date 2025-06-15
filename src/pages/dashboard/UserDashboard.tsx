
import React, { useState } from 'react';
import Sidebar from '@/components/dashboard/user/Sidebar';
import DashboardHeader from '@/components/dashboard/user/DashboardHeader';
import SummaryCards from '@/components/dashboard/user/SummaryCards';
import UpcomingSessions from '@/components/dashboard/user/UpcomingSessions';
import MySessions from '@/components/dashboard/user/MySessions';
import SessionHistory from '@/components/dashboard/user/SessionHistory';
import FindBabalawo from '@/components/dashboard/user/FindBabalawo';
import Settings from '@/components/dashboard/user/Settings';
import FeaturedBabalawos from '@/components/FeaturedBabalawos';

// Updated section content for card-based, modern layout
const DashboardContent = () => (
  <div className="flex flex-col lg:flex-row gap-8 w-full">
    <div className="flex-1 min-w-0 flex flex-col gap-8">
      <div className="flex flex-col md:flex-row gap-6 w-full">
        <SummaryCards />
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-lg px-6 py-6">
          <UpcomingSessions />
        </div>
        <div className="bg-white/50 p-6 rounded-xl shadow-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Discover Babalawos</h2>
          <FeaturedBabalawos />
        </div>
      </div>
    </div>
    {/* Right-side summary panel for notifications or tips, as in modern dashboards */}
    <div className="w-full lg:w-96 shrink-0 flex flex-col gap-6">
      <div className="bg-gradient-to-br from-white to-orange-50 rounded-2xl shadow-lg px-7 py-7">
        <h3 className="font-bold text-lg mb-2 text-orange-500">Quick Actions</h3>
        <MySessions />
      </div>
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="font-semibold text-base mb-2 text-gray-700">Tips for a Great Session</h3>
        <ul className="list-disc pl-5 text-sm text-gray-600">
          <li>Be on time for your bookings</li>
          <li>Ask clear questions</li>
          <li>Prepare your space for spiritual clarity</li>
        </ul>
      </div>
    </div>
  </div>
);

const Support = () => (
  <div className="p-10 bg-white rounded-2xl shadow-lg">
    <h2 className="text-2xl font-bold mb-2 text-primary">Support</h2>
    <p>Get support. We are here to help!</p>
  </div>
);

const SECTION_MAP: { [key: string]: React.ReactNode } = {
  'dashboard': <DashboardContent />,
  'my-sessions': <MySessions />,
  'session-history': <SessionHistory />,
  'find-babalawo': <FindBabalawo />,
  'settings': <Settings />,
  'support': <Support />,
};

const UserDashboard = () => {
  const [activeSection, setActiveSection] = useState('dashboard');

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 font-poppins">
      {/* Always show sidebar on desktop, only in drawer on mobile */}
      <div className="hidden md:flex">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
      <div className="flex-1 flex flex-col">
        <DashboardHeader activeSection={activeSection} onSectionChange={setActiveSection} />
        <main className="flex-grow p-6 md:p-8 lg:p-10 space-y-8 overflow-y-auto">
          {SECTION_MAP[activeSection]}
        </main>
      </div>
    </div>
  );
};
export default UserDashboard;

