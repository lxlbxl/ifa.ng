
import React from 'react';
import Sidebar from '@/components/dashboard/user/Sidebar';
import DashboardHeader from '@/components/dashboard/user/DashboardHeader';
import SummaryCards from '@/components/dashboard/user/SummaryCards';
import UpcomingSessions from '@/components/dashboard/user/UpcomingSessions';
import FeaturedBabalawos from '@/components/FeaturedBabalawos';

const UserDashboard = () => {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 font-poppins">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-grow p-6 md:p-8 lg:p-10 space-y-8 overflow-y-auto">
          <SummaryCards />
          <UpcomingSessions />
          <div className="bg-white/50 p-6 rounded-xl shadow-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Discover Babalawos</h2>
            <FeaturedBabalawos />
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserDashboard;
