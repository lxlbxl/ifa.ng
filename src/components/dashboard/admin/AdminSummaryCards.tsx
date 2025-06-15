
import React from 'react';
import { Card } from '@/components/ui/card';
import { Users, UserCheck, CreditCard } from 'lucide-react';

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

const AdminSummaryCards: React.FC = () => {
  return (
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
  );
};

export default AdminSummaryCards;
