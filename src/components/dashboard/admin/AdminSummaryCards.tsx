
import React from "react";
import { Users, UserCheck, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";

const summaryStats = [
  {
    icon: Users,
    label: "Total Users",
    value: "54,235",
    color: "bg-[#ede6fa]",
    iconColor: "text-indigo-500",
    shadow: "shadow-[0_2px_16px_0_rgba(156,136,255,0.14)]",
  },
  {
    icon: CreditCard,
    label: "Total Revenue",
    value: "$980,632",
    color: "bg-[#e4f1fe]",
    iconColor: "text-blue-500",
    shadow: "shadow-[0_2px_16px_0_rgba(34,156,255,0.12)]",
  },
  {
    icon: UserCheck,
    label: "Babalawos",
    value: "5,490",
    color: "bg-[#f6f7fb]",
    iconColor: "text-green-500",
    shadow: "shadow-[0_2px_16px_0_rgba(76,175,80,0.10)]",
  },
];

const AdminSummaryCards: React.FC = () => {
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
