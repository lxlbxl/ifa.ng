
import React, { useState } from 'react';
import AdminSidebar from '@/components/dashboard/admin/AdminSidebar';
import DashboardOverview from '@/components/dashboard/admin/DashboardOverview';
import UserManagement from '@/components/dashboard/admin/UserManagement';
import BabalawoManagement from "@/components/dashboard/admin/BabalawoManagement";
import { Search, Bell, PlusCircle, CreditCard, TrendingUp, Users, CheckCircle, XCircle, LayoutGrid, Activity, Box } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';

// Right summary panel demo data
const accountSummary = {
  balance: 10632,
  positive: 3250.07,
  negative: 1062.9,
  activities: [
    { label: "Withdraw Earning", time: "12:40 am", amount: 4120, type: "plus" },
    { label: "Paying Website tax", time: "10:20 am", amount: -230, type: "minus" }
  ],
  categories: [
    { label: "Footwear", icon: Box, color: "bg-yellow-100 text-yellow-600", amount: 18941 },
    { label: "Accessories", icon: Activity, color: "bg-green-100 text-green-600", amount: 26061 }
  ]
};

// Main section mapping
const Payments = () => (
  <Card className="p-6"><div className="font-semibold text-indigo-600">Payments Panel</div></Card>
);
const Consultations = () => (
  <Card className="p-6"><div className="font-semibold text-indigo-600">Consultations Panel</div></Card>
);
const Analytics = () => (
  <Card className="p-6"><div className="font-semibold text-indigo-600">Analytics Panel</div></Card>
);
const Safety = () => (
  <Card className="p-6"><div className="font-semibold text-indigo-600">Trust &amp; Safety Panel</div></Card>
);
const Settings = () => (
  <Card className="p-6"><div className="font-semibold text-indigo-600">Settings Panel</div></Card>
);
const Support = () => (
  <Card className="p-6"><div className="font-semibold text-indigo-600">Support Panel</div></Card>
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

const SummaryCard = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) => (
  <div className="flex flex-col bg-violet-100 rounded-xl p-5 min-w-[180px] shadow group hover:scale-105 transition-transform">
    <div className="flex items-center gap-2">
      <div className="bg-violet-200 p-2 rounded-lg">
        <Icon className="text-violet-700" size={22} />
      </div>
      <span className="text-violet-800 font-semibold">{label}</span>
    </div>
    <span className="mt-3 text-2xl font-bold text-violet-900">{value}</span>
  </div>
);

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const { userProfile } = useAuth();

  // Fake summary stats for demo
  const stats = [
    { icon: Users, label: 'Customers', value: '54,235' },
    { icon: CreditCard, label: 'Income', value: '$980,632' },
    { icon: TrendingUp, label: 'Products Sold', value: '5,490' }
  ];

  return (
    <div className="flex min-h-screen bg-[#f7f7fa] font-poppins">
      {/* Sidebar */}
      <div className="hidden md:flex">
        <AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      </div>
      {/* Main central dashboard */}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-8 px-4 xl:px-8 py-6">
        {/* Main center content */}
        <section className="xl:col-span-2">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center mb-7 gap-2">
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Business Dashboard</h1>
            <div className="flex items-center gap-4">
              <button className="bg-white shadow rounded-lg p-2"><Search className="text-gray-500" size={20} /></button>
              <button className="bg-white shadow rounded-lg p-2"><Bell className="text-gray-500" size={20} /></button>
              <div className="flex items-center gap-2 bg-white shadow px-3 py-1 rounded-lg">
                <Avatar>
                  <AvatarImage src={userProfile?.avatar_url || ''} />
                  <AvatarFallback>
                    {userProfile?.full_name?.[0] || 'A'}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-1">
                  <p className="font-semibold text-xs">{userProfile?.full_name || 'Admin User'}</p>
                  <span className="block text-[10px] text-gray-500 capitalize">{userProfile?.role || 'Admin'} Account</span>
                </div>
              </div>
            </div>
          </div>
          {/* Summary cards */}
          <div className="flex flex-wrap gap-6 mb-8">
            {stats.map((s) => (
              <SummaryCard key={s.label} icon={s.icon} label={s.label} value={s.value} />
            ))}
          </div>
          {/* Marketplace panels grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Data Analytics Overview */}
            <Card className="col-span-2 p-6 flex flex-col justify-between min-h-[160px]">
              <div>
                <span className="font-bold text-lg text-gray-700 mb-1 inline-block">Data Analytics Overview</span>
                <p className="text-gray-500 text-sm mb-4">See how your account grow and how you can boost it.</p>
              </div>
              <button className="ml-auto bg-violet-50 text-violet-700 rounded-full border border-violet-200 px-6 py-1 font-semibold shadow hover:bg-violet-100 transition-all">START</button>
            </Card>
            {/* Upgrade Box */}
            <Card className="p-6 flex flex-col justify-between min-h-[160px] items-center text-center relative">
              <span className="text-xs text-gray-400 font-bold absolute top-4 right-5">UPGRADE TO PRO</span>
              <img alt="Upgrade" src="/lovable-uploads/92ba28f7-9f1c-4ace-a0db-f6a0a03d6697.png" className="w-16 mx-auto mb-2 rounded-full ring-2 ring-violet-200 bg-white object-contain" />
              <div className="font-semibold text-lg text-gray-700 mt-2 mb-1">$29 p/m</div>
              <div className="text-xs text-gray-500">100% insurance for your goods</div>
            </Card>
          </div>
          {/* Mini financial flow chart/fake */}
          <Card className="mb-8 p-6 flex flex-col">
            <span className="font-semibold text-lg text-gray-700 mb-2">Finance Flow</span>
            <div className="flex items-center gap-8">
              <div>
                <span className="text-2xl font-bold text-violet-800">$2,530</span>
                <div className="text-xs text-gray-400">September 2021</div>
              </div>
              {/* Placeholder graph */}
              <div className="flex-1 h-16 ml-4 flex items-end gap-1">
                {[10,22,8,30,26,12,17,27].map((h,idx)=>(
                  <div key={idx} className="w-6 rounded-t bg-violet-300" style={{height: `${h+12}px`}}></div>
                ))}
              </div>
            </div>
          </Card>
          {/* Recent Orders Table - demo ONLY */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-base text-gray-700">Recent Orders</span>
              <button className="text-violet-600 text-xs font-bold hover:underline">SEE ALL</button>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="min-w-[540px] w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs">
                    <th className="p-2 font-semibold">#</th>
                    <th className="p-2 font-semibold">Product</th>
                    <th className="p-2 font-semibold">Date</th>
                    <th className="p-2 font-semibold">Price</th>
                    <th className="p-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2">#1235465</td>
                    <td className="p-2">DJI Mavic Pro 2</td>
                    <td className="p-2">Sep 16, 2021</td>
                    <td className="p-2">$42.00</td>
                    <td className="p-2">
                      <span className="inline-block bg-green-100 text-green-700 px-3 py-0.5 rounded-full text-xs">Delivered</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2">#1235468</td>
                    <td className="p-2">iPad Pro 2017 Model</td>
                    <td className="p-2">Sep 15, 2021</td>
                    <td className="p-2">$932.00</td>
                    <td className="p-2">
                      <span className="inline-block bg-red-100 text-red-700 px-3 py-0.5 rounded-full text-xs">Canceled</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          {/* Dynamic Content Section */}
          <div className="mt-10">{SECTION_MAP[activeSection]}</div>
        </section>
        {/* Right panel - summary/activities */}
        <aside className="relative">
          <div className="sticky top-8 xl:top-16 w-full xl:w-[340px]">
            {/* Summary Card */}
            <Card className="mb-6 p-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-bold text-gray-700">Summary</span>
                <PlusCircle className="text-pink-400 h-7 w-7 bg-pink-100 rounded-full p-1.5" />
              </div>
              <div className="font-bold text-3xl text-gray-900 mb-2">${accountSummary.balance.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</div>
              <div className="flex gap-2 text-xs items-center">
                <span className="text-green-600 font-semibold">${accountSummary.positive.toLocaleString()}</span>
                <span className="text-red-500 font-semibold">- ${accountSummary.negative.toLocaleString()}</span>
              </div>
            </Card>
            {/* Activity */}
            <Card className="mb-6 p-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-base font-bold text-gray-700">Activity</span>
                <span className="text-xs text-indigo-500 font-bold cursor-pointer hover:underline">SEE ALL</span>
              </div>
              <ul>
                {accountSummary.activities.map((act,i)=>(
                  <li key={i} className="flex items-center justify-between mb-4 last:mb-0">
                    <div className={`flex items-center gap-2`}>
                      <div className={`rounded-lg p-2 bg-violet-200`}>
                        {act.type === "plus" ?
                          <CheckCircle className="text-violet-700" size={18} />
                          : <XCircle className="text-pink-500" size={18} />
                        }
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">{act.label}</span>
                        <div className="text-xs text-gray-400">{act.time}</div>
                      </div>
                    </div>
                    <span className={`${act.amount > 0 ? 'text-green-700' : 'text-red-500'} font-bold`}>
                      {act.amount > 0 ? "+" : ""}${Math.abs(act.amount).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            {/* Top Categories */}
            <Card className="p-6">
              <div className="font-bold text-base text-gray-700 mb-3">Top Categories</div>
              <p className="text-xs text-gray-500 mb-4">Explore your top categories and keep shopping with cashback</p>
              <div className="flex gap-2">
                {accountSummary.categories.map((cat, i) => (
                  <div key={i} className={`flex-1 flex flex-col items-center py-3 rounded-xl ${cat.color}`}>
                    <cat.icon className="mb-2" size={25} />
                    <div className="font-semibold text-sm">{cat.label}</div>
                    <div className="text-xs">{cat.amount.toLocaleString()} units</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default AdminDashboard;
