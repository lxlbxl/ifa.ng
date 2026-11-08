import React from 'react';
import { Card } from '@/components/ui/card';
import RevenueChart from '@/components/dashboard/admin/RevenueChart';
import RecentSignups from '@/components/dashboard/admin/RecentSignups';

const AdminAnalyticsPanels: React.FC = () => (
  <div className="grid gap-4 md:grid-cols-2">
    <Card className="p-6">
      <h2 className="mb-4 font-display text-xl font-extrabold">Revenue, last 30 days</h2>
      <RevenueChart />
    </Card>
    <RecentSignups />
  </div>
);

export default AdminAnalyticsPanels;
