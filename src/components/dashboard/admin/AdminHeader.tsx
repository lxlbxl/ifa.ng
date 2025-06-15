
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const AdminHeader: React.FC = () => {
  const { userProfile } = useAuth();
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">Welcome back, {userProfile?.full_name || "Admin"}</p>
      </div>
      <div className="flex items-center gap-2 bg-white shadow-sm px-4 py-1 rounded-lg">
        <Avatar>
          <AvatarImage src={userProfile?.avatar_url || ""} />
          <AvatarFallback>{userProfile?.full_name?.[0]?.toUpperCase() || "A"}</AvatarFallback>
        </Avatar>
        <div className="ml-2">
          <p className="font-semibold text-xs">{userProfile?.full_name || "Admin User"}</p>
          <span className="block text-[11px] text-gray-400 capitalize">{userProfile?.role || "Admin"} Account</span>
        </div>
      </div>
    </div>
  );
};

export default AdminHeader;
