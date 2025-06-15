
import React from 'react';
import { useAdminStats } from '@/hooks/useAdminStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Calendar, Loader2 } from 'lucide-react';
import RevenueChart from './RevenueChart';
import RecentSignups from './RecentSignups';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <Card className={`text-white ${color}`}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-6 w-6 text-white/80" />
    </CardHeader>
    <CardContent>
      <div className="text-4xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const DashboardOverview = () => {
  const { data: stats, isLoading, error } = useAdminStats();

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading dashboard stats: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={Users} color="bg-indigo-500" />
            <StatCard title="Total Babalawos" value={stats?.totalBabalawos ?? 0} icon={UserCheck} color="bg-purple-500" />
            <StatCard title="Total Consultations" value={stats?.totalSessions ?? 0} icon={Calendar} color="bg-sky-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <RevenueChart />
            </div>
            <div className="space-y-6">
                <RecentSignups />
            </div>
        </div>
    </div>
  );
};

export default DashboardOverview;
