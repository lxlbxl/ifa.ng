
import React from "react";
import { Calendar, Star, DollarSign, Bell } from "lucide-react";
import { useBabalawoDashboardStats } from "@/hooks/useBabalawoDashboardStats";
import { Button } from "@/components/ui/button";

const StatCard = ({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon: any;
  accent: string;
}) => (
  <div className={`flex-1 min-w-0 bg-white rounded-2xl shadow-lg px-7 py-6 flex items-center gap-5 relative overflow-hidden`} style={{background: accent}}>
    <div className="bg-white/90 rounded-xl p-2 shadow-sm">
      <Icon className="w-7 h-7 text-violet-600" />
    </div>
    <div>
      <div className="text-sm text-white/80 mb-0.5 font-medium">{label}</div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  </div>
);

const SummaryCard = ({
  balance,
  notifications,
}: {
  balance: number;
  notifications: { id: number | string; message: string }[] | undefined;
}) => (
  <div className="bg-gradient-to-br from-white to-[#d1ccfa] rounded-2xl shadow-lg px-7 py-7 flex flex-col relative min-h-[340px]">
    <div className="flex items-center gap-2">
      <DollarSign className="w-5 h-5 text-violet-700" />
      <span className="text-sm font-light text-gray-600">Main Balance</span>
    </div>
    <div className="text-4xl font-extrabold text-violet-700 my-2">
      ₦{balance}
    </div>
    <Button className="w-full mt-2 mb-6" variant="default" onClick={() => window.dispatchEvent(new CustomEvent('openWithdrawalModal'))}>
      Withdraw
    </Button>
    <div className="mt-4">
      <div className="font-semibold text-base mb-2 text-gray-900 flex items-center gap-2">
        <Bell className="w-4 h-4 text-blue-400" /> Notifications
      </div>
      <ul className="text-sm text-gray-700 list-disc ml-5">
        {(notifications && notifications.length > 0) ? (
          notifications.map((note) => (
            <li key={note.id} className="my-1">{note.message}</li>
          ))
        ) : (
          <li>No notifications</li>
        )}
      </ul>
    </div>
  </div>
);

const BabalawoDashboardOverview = () => {
  const { data: stats, isLoading } = useBabalawoDashboardStats();
  const [isActive, setIsActive] = React.useState(stats?.isActive ?? false);
  React.useEffect(() => {
    setIsActive(stats?.isActive ?? false);
  }, [stats?.isActive]);

  const handleToggle = () => setIsActive((prev) => !prev);

  // Stat card gradients
  const statGradients = [
    "linear-gradient(110deg, #7b61ff 30%, #7f53ac 100%)",
    "linear-gradient(110deg, #34b7a7 10%, #7ad7f1 100%)",
    "linear-gradient(110deg, #fbb034 0%, #ffdd00 100%)"
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full">
      {/* Main Content: Left */}
      <div className="flex-1 min-w-0 flex flex-col gap-8">
        {/* Stat Card Row */}
        <div className="flex flex-col md:flex-row gap-6 w-full">
          <StatCard
            label="Today's Consultations"
            value={stats?.todaysSessions?.length ?? 0}
            icon={Calendar}
            accent={statGradients[0]}
          />
          <StatCard
            label="This Month's Earnings"
            value={`₦${stats?.totalEarnings ?? 0}`}
            icon={DollarSign}
            accent={statGradients[1]}
          />
          <StatCard
            label="Average Rating"
            value={
              <span>
                {stats?.averageRating ?? 0}{" "}
                <Star className="inline ml-1 mb-1 h-5 w-5 text-yellow-300" /> ({stats?.totalReviews})
              </span>
            }
            icon={Star}
            accent={statGradients[2]}
          />
        </div>
        {/* Toggle Availability */}
        <div className="flex items-center gap-4">
          <Button
            variant={isActive ? "default" : "destructive"}
            onClick={handleToggle}
          >
            {isActive ? "Online" : "Offline"}
          </Button>
          <span className="text-muted-foreground">Toggle your availability status</span>
        </div>
        {/* Main Panel Row */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Upcoming Bookings */}
          <div className="bg-white rounded-2xl shadow-lg px-6 py-6">
            <div className="font-semibold text-xl mb-2 text-violet-700">Upcoming Bookings</div>
            <div>
              {stats?.upcomingBookings?.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {stats.upcomingBookings.map((session: any) => (
                    <li key={session.id} className="py-2 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
                      <span>
                        {session.session_date} — {session.start_time}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-500">No bookings.</div>
              )}
            </div>
          </div>
          {/* Next Session */}
          <div className="bg-white rounded-2xl shadow-lg px-6 py-6 flex flex-col">
            <div className="font-semibold text-xl text-violet-700 mb-2">Next Session</div>
            {stats?.nextSession ? (
              <span>
                <span className="block font-medium">
                  {stats.nextSession.session_date} — {stats.nextSession.start_time}
                </span>
                <div className="text-xs text-muted-foreground mt-2">
                  Live countdown: (Coming soon)
                </div>
              </span>
            ) : (
              <span className="text-gray-500">No session scheduled.</span>
            )}
          </div>
        </div>
      </div>
      {/* Summary Panel: Right */}
      <div className="w-full lg:w-96 shrink-0">
        <SummaryCard
          balance={stats?.totalEarnings ?? 0}
          notifications={stats?.notifications}
        />
      </div>
    </div>
  );
};

export default BabalawoDashboardOverview;
