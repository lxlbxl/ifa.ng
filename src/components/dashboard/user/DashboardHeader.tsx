
import React from 'react';
import AuthenticatedHeader from '@/components/AuthenticatedHeader';
import { useAuth } from '@/hooks/useAuth';
import { Menu } from 'lucide-react';

const DashboardHeader = () => {
  const { userProfile } = useAuth();
  
  return (
    <header className="bg-white/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center justify-between h-20 px-6 md:px-8 lg:px-10 border-b">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Welcome, {userProfile?.full_name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-gray-500">Here's your spiritual journey summary.</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="md:hidden p-2 rounded-full hover:bg-gray-200">
            <Menu className="h-6 w-6 text-gray-600" />
          </button>
          <AuthenticatedHeader />
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
