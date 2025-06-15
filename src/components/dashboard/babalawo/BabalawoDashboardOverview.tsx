
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, Star, Bell } from "lucide-react";
import { useBabalawoDashboardStats } from "@/hooks/useBabalawoDashboardStats";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: React.ReactNode; icon: any; color: string; }) => (
  <Card className={`text-white ${color}`}>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-6 w-6 text-white/80" />
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const BabalawoDashboardOverview = () => {
  const { data: stats, isLoading } = useBabalawoDashboardStats();

  // Availability toggle (online/offline)
  const [isActive, setIsActive] = React.useState(stats?.isActive ?? false);

  React.useEffect(() => {
    setIsActive(stats?.isActive ?? false);
  }, [stats?.isActive]);

  // (Pseudo) Handler - in practice, you would patch the DB
  const handleToggle = () => {
    setIsActive(!isActive);
    // TODO: Patch is_active to DB (future update)
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <StatCard title="Today's Consultations" value={stats?.todaysSessions?.length ?? 0} icon={Calendar} color="bg-sky-600" />
        <StatCard title="This Month's Earnings" value={`₦${stats?.totalEarnings ?? 0}`} icon={Calendar} color="bg-emerald-600" />
        <StatCard 
          title="Average Rating"
          value={
            <span>
              {stats?.averageRating ?? 0} <Star className="inline ml-1 mb-1 h-5 w-5 text-yellow-300" /> ({stats?.totalReviews})
            </span>
          }
          icon={Star}
          color="bg-yellow-500"
        />
      </div>
      <div className="flex flex-wrap gap-4 items-center pt-2">
        <Button variant={isActive ? "success" : "destructive"} onClick={handleToggle}>
          {isActive ? "Online" : "Offline"}
        </Button>
        <span className="text-muted-foreground">Toggle your availability status</span>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.upcomingBookings?.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {stats.upcomingBookings.map(session => (
                  <li key={session.id} className="py-2 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
                    <span>
                      {session.session_date} — {session.start_time}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div>No bookings.</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Next Session Countdown</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.nextSession ? (
              <span>
                {stats.nextSession.session_date} — {stats.nextSession.start_time}
                <div className="text-xs text-muted-foreground mt-1">Live countdown: (Coming soon)</div>
              </span>
            ) : (
              <span>No session scheduled.</span>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center">
          <Bell className="mr-2 text-blue-500" />
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc ml-4">
            {stats?.notifications?.length > 0 ? (
              stats.notifications.map(note => (
                <li key={note.id}>{note.message}</li>
              ))
            ) : (
              <li>No notifications</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default BabalawoDashboardOverview;
