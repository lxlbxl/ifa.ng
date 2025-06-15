
import React, { useState } from 'react';
import AdminSidebar from '@/components/dashboard/admin/AdminSidebar';
import DashboardOverview from '@/components/dashboard/admin/DashboardOverview';
import { Search, Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import UserManagement from '@/components/dashboard/admin/UserManagement';
import BabalawoManagement from "@/components/dashboard/admin/BabalawoManagement";

// Section content mapping for modern section switching
const Payments = () => (
  <div className="p-10 bg-white rounded-2xl shadow-lg">
    <h2 className="text-2xl font-bold mb-2 text-indigo-600">Payments</h2>
    <p>Monitor payments and transactions.</p>
  </div>
);
const Consultations = () => (
  <div className="p-10 bg-white rounded-2xl shadow-lg">
    <h2 className="text-2xl font-bold mb-2 text-indigo-600">Consultations</h2>
    <p>View and manage all consultations.</p>
  </div>
);

const Analytics = () => (
  <div className="p-10 bg-white rounded-2xl shadow-lg">
    <h2 className="text-2xl font-bold mb-2 text-indigo-600">Analytics</h2>
    <p>Advanced platform performance overview.</p>
  </div>
);
const Safety = () => (
  <div className="p-10 bg-white rounded-2xl shadow-lg">
    <h2 className="text-2xl font-bold mb-2 text-indigo-600">Trust & Safety</h2>
    <p>Monitor trust and safety policies.</p>
  </div>
);
const Settings = () => (
  <div className="p-10 bg-white rounded-2xl shadow-lg">
    <h2 className="text-2xl font-bold mb-2 text-indigo-600">Settings</h2>
    <p>Update admin settings and profile.</p>
  </div>
);
const Support = () => (
  <div className="p-10 bg-white rounded-2xl shadow-lg">
    <h2 className="text-2xl font-bold mb-2 text-indigo-600">Support</h2>
    <p>Get support. We are here to help!</p>
  </div>
);

const SECTION_MAP: { [key: string]: React.ReactNode } = {
  overview: <DashboardOverview />,
  users: <UserManagement />,
  babalawos: <BabalawoManagement />,
  consultations: <Consultations />,
  payments: <Payments />,
  analytics: <Analytics />,
  safety: <Safety />,
  settings: <Settings />,
  support: <Support />,
};

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const { userProfile } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            Business Dashboard
          </h1>
          <div className="flex items-center space-x-6">
            <Search className="h-5 w-5 text-gray-500 cursor-pointer hover:text-gray-800" />
            <Bell className="h-5 w-5 text-gray-500 cursor-pointer hover:text-gray-800" />
            <div className="flex items-center space-x-2">
              <Avatar>
                <AvatarImage src={userProfile?.avatar_url || ''} />
                <AvatarFallback>{userProfile?.full_name?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{userProfile?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{userProfile?.role} Account</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-grow p-6 md:p-8 lg:p-10 space-y-8 overflow-y-auto">
          {SECTION_MAP[activeSection]}
        </main>
      </div>
    </div>
  );
};
export default AdminDashboard;
