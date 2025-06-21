

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminStats } from "@/hooks/useAdminStats";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, Star, User, TrendingUp, Clock, CheckCircle, Users, UserCheck, CreditCard, Activity, AlertCircle } from "lucide-react";

const DashboardOverview = () => {
  const { data, isLoading } = useAdminStats();

  const quickStats = [
    {
      title: "Total Users",
      value: data?.totalUsers ?? 0,
      icon: Users,
      color: "#3490dc",
    },
    {
      title: "Active Babalawos",
      value: data?.totalBabalawos ?? 0,
      icon: UserCheck,
      color: "#38c172",
    },
    {
      title: "Cancelled Consultations",
      value: data?.consultations?.cancelled ?? 0,
      icon: Calendar,
      color: "#e3342f",
    },
    {
      title: "Success Rate",
      value: `${data?.sessionSuccessRate ?? 0}%`,
      icon: TrendingUp,
      color: "#f6993f",
    },
  ];

  const revenueStats = [
    {
      title: "Today's Revenue",
      value: `₦${data?.revenue?.today ?? 0}`,
      icon: CreditCard,
      color: "#9b59b6",
    },
    {
      title: "This Week",
      value: `₦${data?.revenue?.week ?? 0}`,
      icon: CreditCard,
      color: "#8e44ad",
    },
    {
      title: "This Month",
      value: `₦${data?.revenue?.month ?? 0}`,
      icon: CreditCard,
      color: "#7d3c98",
    },
    {
      title: "All Time",
      value: `₦${data?.revenue?.all ?? 0}`,
      icon: CreditCard,
      color: "#6c3483",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => (
          <Card key={stat.title} className="shadow-lg border-l-4 bg-white" style={{ borderLeftColor: stat.color }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{stat.title}</CardTitle>
              <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-800">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {revenueStats.map((stat) => (
          <Card key={stat.title} className="shadow-lg border-l-4 bg-white" style={{ borderLeftColor: stat.color }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{stat.title}</CardTitle>
              <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-800">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-lg border-l-4 bg-white" style={{ borderLeftColor: "#3490dc" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Upcoming Consultations</CardTitle>
            <Calendar className="h-5 w-5" style={{ color: "#3490dc" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-800">{data?.consultations?.upcoming ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-l-4 bg-white" style={{ borderLeftColor: "#38c172" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completed Consultations</CardTitle>
            <CheckCircle className="h-5 w-5" style={{ color: "#38c172" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-800">{data?.consultations?.completed ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-l-4 bg-white" style={{ borderLeftColor: "#e3342f" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Cancelled Consultations</CardTitle>
            <Calendar className="h-5 w-5" style={{ color: "#e3342f" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-800">{data?.consultations?.cancelled ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* System Alerts */}
      <Card className="shadow-lg border-l-4 bg-white" style={{ borderLeftColor: "#e74c3c" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">System Alerts</CardTitle>
          <AlertCircle className="h-5 w-5" style={{ color: "#e74c3c" }} />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-800">{data?.systemAlerts?.failedPayments ?? 0} Failed Payments</div>
        </CardContent>
      </Card>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Babalawos */}
        <Card className="shadow-lg border-l-4 bg-white" style={{ borderLeftColor: "#f1c40f" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Star className="h-5 w-5" style={{ color: "#f1c40f" }} />
              Top Performing Babalawos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
          {(data?.topBabalowos ?? []).slice(0, 5).map((baba: any, index: number) => (
            <div key={baba.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium text-gray-900">Babalawo #{baba.id.slice(0, 6)}</div>
                  <div className="text-sm text-gray-500">{baba.total_sessions ?? 0} sessions</div>
                </div>
              </div>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                ★ {baba.rating ?? "N/A"}
              </Badge>
            </div>
          ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent User Signups */}
        <Card className="shadow-lg border-l-4 bg-white" style={{ borderLeftColor: "#9b59b6" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <User className="h-5 w-5" style={{ color: "#9b59b6" }} />
              Recent Signups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.recentUsers ?? []).slice(0, 5).map((user: any) => (
                <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback>{user.full_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{user.full_name || "Unnamed User"}</div>
                    <div className="text-sm text-gray-500">{user.created_at?.slice(0, 10)}</div>
                  </div>
                  <Badge variant="outline">New</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardOverview;
