
import React from "react";
import { Users, UserCheck, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAdminStats } from "@/hooks/useAdminStats";

const AdminSummaryCards: React.FC = () => {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className="flex flex-col items-start justify-between bg-gray-100 rounded-3xl px-6 py-5 border-0 animate-pulse"
            style={{ minHeight: 114 }}
          >
            <div className="rounded-full p-2 mb-3 bg-white/50 w-10 h-10"></div>
            <div>
              <div className="w-20 h-8 bg-gray-300 rounded mb-2"></div>
              <div className="w-16 h-4 bg-gray-300 rounded"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const summaryStats = [
    {
      icon: Users,
      label: "Total Users",
      value: stats?.totalUsers?.toLocaleString() || "0",
      color: "bg-[#ede6fa]",
      iconColor: "text-indigo-500",
      shadow: "shadow-[0_2px_16px_0_rgba(156,136,255,0.14)]",
    },
    {
      icon: CreditCard,
      label: "Total Revenue",
      value: `₦${stats?.revenue?.all?.toLocaleString() || "0"}`,
      color: "bg-[#e4f1fe]",
      iconColor: "text-blue-500",
      shadow: "shadow-[0_2px_16px_0_rgba(34,156,255,0.12)]",
    },
    {
      icon: UserCheck,
      label: "Babalawos",
      value: stats?.totalBabalawos?.toLocaleString() || "0",
      color: "bg-[#f6f7fb]",
      iconColor: "text-green-500",
      shadow: "shadow-[0_2px_16px_0_rgba(76,175,80,0.10)]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
      {summaryStats.map((stat) => (
        <Card
          key={stat.label}
          className={`flex flex-col items-start justify-between ${stat.color} ${stat.shadow} rounded-3xl px-6 py-5 border-0`}
          style={{ minHeight: 114 }}
        >
          <div className={`rounded-full p-2 mb-3 bg-white/50 ${stat.shadow}`}>
            <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 font-playfair">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1 font-medium tracking-tight">{stat.label}</div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default AdminSummaryCards;
