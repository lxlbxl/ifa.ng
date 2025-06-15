import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminStats } from "@/hooks/useAdminStats";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Star, User } from "lucide-react";

const DashboardOverview = () => {
  const { data, isLoading } = useAdminStats();

  // if (isLoading) {
  //   return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  // }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalUsers ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Babalawos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalBabalawos ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Consultations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.consultations?.upcoming ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completed Consultations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.consultations?.completed ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Today's Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{data?.revenue?.today ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>This Week's Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{data?.revenue?.week ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>All-Time Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{data?.revenue?.all ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.sessionSuccessRate ?? 0}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Babalawos (by Rating)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {(data?.topBabalawos ?? []).map((baba: any) => (
                <li key={baba.id} className="flex items-center gap-2 mb-2">
                  <span className="font-semibold">Babalawo #{baba.id.slice(0, 6)}</span>
                  <span className="ml-2">★ {baba.rating ?? "?"}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    Sessions: {baba.total_sessions ?? "?"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent User Signups</CardTitle>
        </CardHeader>
        <CardContent>
          <ul>
            {(data?.recentUsers ?? []).map((user: any) => (
              <li key={user.id} className="mb-1 flex items-center gap-2">
                {user.avatar_url && (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="rounded-full w-6 h-6 object-cover"
                  />
                )}
                <span className="font-semibold">{user.full_name || "Unnamed User"}</span>
                <span className="ml-2 text-xs text-gray-500">{user.created_at?.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardOverview;
