
import React, { useState } from 'react';
import AdminSidebar from '@/components/dashboard/admin/AdminSidebar';
import DashboardOverview from '@/components/dashboard/admin/DashboardOverview';
import UserManagement from '@/components/dashboard/admin/UserManagement';
import BabalawoManagement from '@/components/dashboard/admin/BabalawoManagement';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Users, UserCheck, CreditCard, BarChart, Activity } from 'lucide-react';
import RecentSignups from '@/components/dashboard/admin/RecentSignups';
import RevenueChart from '@/components/dashboard/admin/RevenueChart';

// Overview section mapping
const SECTION_MAP: { [key: string]: React.ReactNode } = {
  overview: <DashboardOverview />,
  users: <UserManagement />,
  babalawos: <BabalawoManagement />,
};

const summaryStats = [
  {
    icon: Users,
    label: "Total Users",
    value: "512",
    color: "bg-indigo-100 text-indigo-600",
    iconBg: "bg-indigo-50",
  },
  {
    icon: UserCheck,
    label: "Total Babalawos",
    value: "34",
    color: "bg-green-100 text-green-700",
    iconBg: "bg-green-50",
  },
  {
    icon: CreditCard,
    label: "Total Revenue",
    value: "$9,825",
    color: "bg-yellow-100 text-yellow-700",
    iconBg: "bg-yellow-50",
  },
];

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const { userProfile } = useAuth();

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f7f7fa] to-[#e8ecfa] flex">
      {/* Sidebar */}
      <div className="hidden md:flex">
        <AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col px-3 sm:px-6 py-6 max-w-[1440px] mx-auto">
        {/* Header */}
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
        {/* Dashboard Overview Cards - Clean Card Design */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {summaryStats.map((stat) => (
            <Card
              key={stat.label}
              className="flex gap-4 items-center bg-white rounded-2xl shadow-card hover:shadow-xl transition-shadow duration-200 px-6 py-5 border-0"
              style={{ boxShadow: "0px 4px 28px 0px rgba(44,62,80,0.12)" }}
            >
              <div className={`flex items-center justify-center rounded-xl ${stat.iconBg} w-12 h-12 shadow-sm`}>
                <stat.icon className={`${stat.color} w-6 h-6`} />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1 font-medium tracking-tight">{stat.label}</div>
              </div>
            </Card>
          ))}
        </div>
        {/* Top Tabs for Overview/Users/Babalawos */}
        <div className="mb-8">
          <Card className="p-0 overflow-hidden border-0 bg-transparent shadow-none">
            <div className="flex space-x-1 border-b border-[#e7e7ef] bg-transparent">
              <button
                className={`flex-1 py-3 font-semibold text-sm transition-colors
                  ${activeSection === 'overview'
                    ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50'
                    : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setActiveSection('overview')}
              >Overview</button>
              <button
                className={`flex-1 py-3 font-semibold text-sm transition-colors
                  ${activeSection === 'users'
                    ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50'
                    : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setActiveSection('users')}
              >Users</button>
              <button
                className={`flex-1 py-3 font-semibold text-sm transition-colors
                  ${activeSection === 'babalawos'
                    ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50'
                    : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setActiveSection('babalawos')}
              >Babalawos</button>
            </div>
            <div className="p-0 pt-6">
              {SECTION_MAP[activeSection]}
            </div>
          </Card>
        </div>

        {/* Analytics Chart and Recent Signups - Stacked, consistent card design */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-card" style={{ boxShadow: "0px 4px 28px 0px rgba(44,62,80,0.08)" }}>
            <div className="mb-3 flex items-center gap-2">
              <BarChart className="text-indigo-600" size={20} />
              <span className="text-lg font-semibold text-gray-700">Revenue (Last 30 days)</span>
            </div>
            <RevenueChart />
          </Card>
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-card" style={{ boxShadow: "0px 4px 28px 0px rgba(44,62,80,0.08)" }}>
            <div className="mb-3 flex items-center gap-2">
              <Activity className="text-green-600" size={20} />
              <span className="text-lg font-semibold text-gray-700">Recent Signups</span>
            </div>
            <RecentSignups />
          </Card>
        </div>
      </main>
      {/* Optionally add right sidebar for quick actions in the future */}
    </div>
  );
};

export default AdminDashboard;

