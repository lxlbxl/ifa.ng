
import React from 'react';
import { useAdminStats } from '@/hooks/useAdminStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Calendar, Loader2, LineChart } from 'lucide-react';
import RevenueChart from './RevenueChart';
import RecentSignups from './RecentSignups';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={Users} color="bg-indigo-500" />
        <StatCard title="Total Babalawos" value={stats?.totalBabalawos ?? 0} icon={UserCheck} color="bg-purple-500" />
        <StatCard title="Total Consultations" value={stats?.totalSessions ?? 0} icon={Calendar} color="bg-sky-500" />
        <StatCard title="Success Rate" value={`${stats?.sessionSuccessRate ?? 0}%`} icon={LineChart} color="bg-emerald-500" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RevenueChart />
          {/* Session counts by status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Upcoming"
              value={stats?.sessionCounts?.pending + stats?.sessionCounts?.confirmed || 0}
              icon={Calendar}
              color="bg-orange-400"
            />
            <StatCard
              title="Completed"
              value={stats?.sessionCounts?.completed || 0}
              icon={Calendar}
              color="bg-green-600"
            />
            <StatCard
              title="Cancelled"
              value={stats?.sessionCounts?.cancelled || 0}
              icon={Calendar}
              color="bg-gray-500"
            />
            {/* Add others as needed */}
          </div>
          {/* Top Babalawos */}
          <Card>
            <CardHeader>
              <CardTitle>Top Babalawos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.topBabalawos?.length > 0 ? stats.topBabalawos.map(baba => (
                  <div key={baba.id} className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={baba.avatar_url ?? ""} alt={baba.full_name ?? "Babalawo"} />
                      <AvatarFallback>{baba.full_name?.[0] ?? "B"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <span className="font-bold">{baba.full_name || "N/A"}</span>
                      <span className="block text-xs text-muted-foreground">{baba.specialties?.join(", ")}</span>
                    </div>
                    <span className="font-bold text-indigo-700">{baba.rating?.toFixed(2) ?? "0.00"}</span>
                    <span className="text-xs text-gray-400">{baba.total_sessions} sessions</span>
                  </div>
                )) : (
                  <span>No top babalawos yet.</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <RecentSignups />
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
