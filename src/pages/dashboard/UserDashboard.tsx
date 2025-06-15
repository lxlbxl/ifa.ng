
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

const UserDashboard = () => {
  const [activeSection, setActiveSection] = useState('dashboard');

  const renderContent = () => {
    switch (activeSection) {
      case 'my-sessions':
        return <MySessions />;
      case 'session-history':
        return <SessionHistory />;
      case 'find-babalawo':
        return <FindBabalawo />;
      case 'settings':
        return <Settings />;
      case 'dashboard':
      default:
        return (
          <>
            <SummaryCards />
            <UpcomingSessions />
            <div className="bg-white/50 p-6 rounded-xl shadow-md">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Discover Babalawos</h2>
              <FeaturedBabalawos />
            </div>
          </>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 font-poppins">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-grow p-6 md:p-8 lg:p-10 space-y-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default UserDashboard;
