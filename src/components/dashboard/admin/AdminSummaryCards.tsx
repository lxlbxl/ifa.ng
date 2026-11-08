import React from 'react';
import { CreditCard, UserCheck, Users } from 'lucide-react';
import { StatTile } from '@/components/brand';
import { useAdminStats } from '@/hooks/useAdminStats';

const AdminSummaryCards: React.FC = () => {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[132px] animate-pulse rounded-panel bg-line/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      <StatTile className="col-span-2 sm:col-span-1" tone="sun" label="Revenue" value={`₦${(stats?.revenue?.all ?? 0).toLocaleString()}`} icon={<CreditCard />} hint="All time" />
      <StatTile tone="leaf" label="Users" value={(stats?.totalUsers ?? 0).toLocaleString()} icon={<Users />} hint="Registered seekers" />
      <StatTile tone="indigo" label="Babalawos" value={(stats?.totalBabalawos ?? 0).toLocaleString()} icon={<UserCheck />} hint="On the platform" />
    </div>
  );
};

export default AdminSummaryCards;
