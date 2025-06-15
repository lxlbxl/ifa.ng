
import React, { useState } from 'react';
import AdminSidebar from '@/components/dashboard/admin/AdminSidebar';
import DashboardOverview from '@/components/dashboard/admin/DashboardOverview';
import { Search, Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const { userProfile } = useAuth();

  const renderContent = () => {
    switch (activeSection) {
      // TODO: Add cases for other sections
      // case 'users':
      //   return <UserManagement />;
      case 'overview':
      default:
        return <DashboardOverview />;
    }
  };

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
        <main className="flex-grow p-6 md:p-8 lg:p-10">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
