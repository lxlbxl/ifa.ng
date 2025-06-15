
import React, { useState } from 'react';
import AdminSidebar from '@/components/dashboard/admin/AdminSidebar';
import DashboardOverview from '@/components/dashboard/admin/DashboardOverview';
import UserManagement from '@/components/dashboard/admin/UserManagement';
import BabalawoManagement from '@/components/dashboard/admin/BabalawoManagement';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Users, Activity, UserCheck, CreditCard, BarChart } from 'lucide-react';
import RecentSignups from '@/components/dashboard/admin/RecentSignups';
import RevenueChart from '@/components/dashboard/admin/RevenueChart';

// Main section mapping (as cards/tabs)
const SECTION_MAP: { [key: string]: React.ReactNode } = {
  overview: <DashboardOverview />,
  users: <UserManagement />,
  babalawos: <BabalawoManagement />,
};

const statCards = [
  { icon: Users, label: 'Users', value: '0', section: 'users' },
  { icon: UserCheck, label: 'Babalawos', value: '0', section: 'babalawos' },
  { icon: CreditCard, label: 'Revenue', value: '$0', section: 'overview' },
];

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const { userProfile } = useAuth();

  // The following counts would be fetched via react-query hooks in full production
  // For now, showing demo values (replace with actual queries if needed)
  const summaryStats = [
    { icon: Users, label: 'Total Users', value: '512' },
    { icon: UserCheck, label: 'Total Babalawos', value: '34' },
    { icon: CreditCard, label: 'Total Revenue', value: '$9,825' }
  ];

  return (
    <div className="flex min-h-screen bg-[#f7f7fa] font-poppins">
      {/* Sidebar */}
      <div className="hidden md:flex">
        <AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
      {/* Main Area */}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-8 px-4 xl:px-8 py-6">
        {/* Main Content */}
        <section className="xl:col-span-2 flex flex-col">
          {/* Title Bar */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">Admin Dashboard</h1>
              <p className="text-sm text-gray-500">Welcome back, {userProfile?.full_name || "Admin"}</p>
            </div>
            <div className="flex items-center gap-2 bg-white shadow px-4 py-1 rounded-lg">
              <Avatar>
                <AvatarImage src={userProfile?.avatar_url || ''} />
                <AvatarFallback>{userProfile?.full_name?.[0] || 'A'}</AvatarFallback>
              </Avatar>
              <div className="ml-2">
                <p className="font-semibold text-xs">{userProfile?.full_name || 'Admin User'}</p>
                <span className="block text-[11px] text-gray-400 capitalize">{userProfile?.role || 'Admin'} Account</span>
              </div>
            </div>
          </div>

          {/* Grid of quick summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            {summaryStats.map(s => (
              <Card key={s.label} className="flex items-center gap-3 p-5 shadow group hover:shadow-lg transition-shadow">
                <div className="bg-violet-100 p-3 rounded-lg">
                  <s.icon className="text-violet-700" size={24} />
                </div>
                <div>
                  <span className="block text-base font-bold text-gray-700">{s.value}</span>
                  <span className="block text-xs text-gray-500">{s.label}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Analytics Chart and Recent Signups - side by side or stacked on mobile */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Revenue or usage analytics area */}
            <Card className="p-6 flex flex-col min-h-[220px]">
              <div className="mb-3 flex items-center gap-2">
                <BarChart className="text-indigo-600" size={18} />
                <span className="text-lg font-semibold text-gray-700">Revenue (Last 30 days)</span>
              </div>
              <RevenueChart />
            </Card>
            {/* Recent signups/users card */}
            <Card className="p-6 flex flex-col min-h-[220px]">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="text-green-600" size={18} />
                <span className="text-lg font-semibold text-gray-700">Recent Signups</span>
              </div>
              <RecentSignups />
            </Card>
          </div>

          {/* Management panels (tabbed section) */}
          <Card className="p-0 mb-8 overflow-hidden">
            <div className="flex space-x-1 border-b">
              <button
                className={`flex-1 py-3 transition-colors font-semibold text-sm
                  ${activeSection === 'overview'
                    ? 'border-b-2 border-violet-600 text-violet-700 bg-violet-50'
                    : 'text-gray-600 hover:bg-gray-100'}
                `}
                onClick={() => setActiveSection('overview')}
              >Overview</button>
              <button
                className={`flex-1 py-3 transition-colors font-semibold text-sm
                  ${activeSection === 'users'
                    ? 'border-b-2 border-violet-600 text-violet-700 bg-violet-50'
                    : 'text-gray-600 hover:bg-gray-100'}
                `}
                onClick={() => setActiveSection('users')}
              >Users</button>
              <button
                className={`flex-1 py-3 transition-colors font-semibold text-sm
                  ${activeSection === 'babalawos'
                    ? 'border-b-2 border-violet-600 text-violet-700 bg-violet-50'
                    : 'text-gray-600 hover:bg-gray-100'}
                `}
                onClick={() => setActiveSection('babalawos')}
              >Babalawos</button>
            </div>
            <div className="p-6">
              {SECTION_MAP[activeSection]}
            </div>
          </Card>
        </section>

        {/* Right Panel (may add more admin-only cards/widgets in future) */}
        <aside className="relative hidden xl:block">
          <div className="sticky top-8 xl:top-16 w-full xl:w-[320px] space-y-6">
            {/* Placeholder for additional admin quick links, tools, or info */}
            <Card className="p-6">
              <div className="text-lg font-semibold text-gray-700 mb-1">Quick Actions</div>
              <p className="text-sm text-gray-500 mb-4">
                Perform common tasks:
              </p>
              <div className="flex flex-col gap-2">
                <button
                  className="bg-violet-100 text-violet-800 px-4 py-2 rounded font-semibold hover:bg-violet-200 transition"
                  onClick={() => setActiveSection('users')}
                >Manage Users</button>
                <button
                  className="bg-green-100 text-green-700 px-4 py-2 rounded font-semibold hover:bg-green-200 transition"
                  onClick={() => setActiveSection('babalawos')}
                >Manage Babalawos</button>
              </div>
            </Card>
            <Card className="p-6">
              <div className="font-semibold text-base text-gray-700 mb-1">Admin Info</div>
              <div className="text-xs text-gray-500">
                Last login: 1 hour ago<br/>
                Platform status: <span className="text-green-600 font-bold">Operational</span>
              </div>
            </Card>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default AdminDashboard;
