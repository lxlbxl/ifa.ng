
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle, Wallet } from 'lucide-react';

const SummaryCards = () => {
  const summaryData = [
    { title: 'Upcoming Sessions', value: '2', icon: Calendar, color: '#9B59B6' },
    { title: 'Completed Sessions', value: '15', icon: CheckCircle, color: '#1ABC9C' },
    { title: 'Wallet Balance', value: '₦150.00', icon: Wallet, color: '#D4AC0D' },
  ];

  return (
    <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {summaryData.map(item => (
                <Card key={item.title} className="shadow-lg border-l-4 bg-white" style={{ borderLeftColor: item.color }}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">{item.title}</CardTitle>
                        <item.icon className="h-5 w-5" style={{ color: item.color }}/>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-800">{item.value}</div>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
};

export default SummaryCards;
