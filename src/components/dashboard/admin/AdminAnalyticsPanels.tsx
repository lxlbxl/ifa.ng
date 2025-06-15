
import React from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Activity } from 'lucide-react';
import RevenueChart from '@/components/dashboard/admin/RevenueChart';
import RecentSignups from '@/components/dashboard/admin/RecentSignups';

const AdminAnalyticsPanels: React.FC = () => (
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
);

export default AdminAnalyticsPanels;
