
import React, { useState, useEffect }, { useState, useEffect } from "react";
import { Calendar, Star, DollarSign, Bell, Clock, Video, User, CheckCircle, AlertCircle, Clock, Video, User, CheckCircle, AlertCircle } from "lucide-react";
import { useBabalawoDashboardStats } from "@/hooks/useBabalawoDashboardStats";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, isAfter, subMinutes, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, isAfter, subMinutes, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  notifications: { id: number | string; message: string; type?: string; type?: string }[] | undefined;
}) => (
  <div className="bg-gradient-to-br from-white to-[#d1ccfa] rounded-2xl shadow-lg px-7 py-7 flex flex-col relative min-h-[340px]">
    <div className="flex items-center gap-2">
      <DollarSign className="w-5 h-5 text-violet-700" />
      <span className="text-sm font-light text-gray-600">Availablelable Balance</span>
    </div>
    <div className="text-4xl font-extrabold text-violet-700 my-2 max-h-[200px] overflow-y-auto">
      ₦{balance.toLocaleString()}
    </div>
    <Button className="w-full mt-2 mb-6" variant="default" onClick={() => window.dispatchEvent(new CustomEvent('openWithdrawalModal'))}>
      Withdraw
    </Button>
    <div className="mt-4">
      <div className="font-semibold text-base mb-2 text-gray-900 flex items-center gap-2">
        <Bell className="w-4 h-4 text-blue-400" /> Notifications
      </div>
      <ul className="text-sm text-gray-700 list-disc ml-5 max-h-[200px] overflow-y-auto">
        {(notifications && notifications.length > 0) ? (
          notifications.map((note) => (
            <li key={note.id} className="my-1">
              {note.message}
              {note.type === 'reminder' && (
                <Badge className="ml-2 bg-orange-100 text-orange-800 text-xs">Reminder</Badge>
              )}
              {note.type === 'booking' && (
                <Badge className="ml-2 bg-green-100 text-green-800 text-xs">Booking</Badge>
              )}
            </li>
          ))
        ) : (
          <li>No notifications</li>
        )}
      </ul>
    </div>
  </div>
);

const SessionCard = ({ session, isNext = false }: { session: any; isNext?: boolean }) => {
  const [countdown, setCountdown] = useState<string>('');
  const [canJoin, setCanJoin] = useState<boolean>(false);
  
  useEffect(() => {
    const updateCountdown = () => {
      const sessionDateTime = new Date(`${session.session_date}T${session.start_time}`);
      const now = new Date();
      const diffMinutes = differenceInMinutes(sessionDateTime, now);
      const diffHours = differenceInHours(sessionDateTime, now);
      const diffDays = differenceInDays(sessionDateTime, now);
      
      let countdownText = '';
      
      if (diffDays > 0) {
        countdownText = `${diffDays}d ${diffHours % 24}h`;
      } else if (diffHours > 0) {
        countdownText = `${diffHours}h ${diffMinutes % 60}m`;
      } else if (diffMinutes > 0) {
        countdownText = `${diffMinutes}m`;
      }            className={isActive ? "bg-green-600 hover:bg-green-700" : ""}
 else {
        countdownText = 'Now';
      }
      
      setCountdown(countdownText);
      
      // Allow joining 10 minutes before the session
      const joinTime = subMinutes(sessionDateTime, 10);
      setCanJoin(isAfter(now, joinTime));
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [session]);

  const handleToggleStatus = async () => {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: session.status === 'pending' ? 'confirmed' : 'pending' })
        .eq('id', session.id);
      
      if (error) throw error;
      
      toast({ 
        title: "Status updated", 
        description: `Session is now ${session.status === 'pending' ? 'confirmed' : 'pending'}` 
      });
    } catch (err) {
      console.error('Error updating session status:', err);
      toast({ 
        title: "Error updating status", 
        variant: "destructive" 
      });
    }
  };

  const userName = session.users?.profile?.full_name || 'User';
  const userAvatar = session.users?.profile?.avatar_url;
  const formattedDate = format(new Date(session.session_date), 'EEE, MMM d, yyyy');
  const formattedTime = format(new Date(`2000-01-01T${session.start_time}`), 'h:mm a');
  
  return (
    <div className={`bg-white rounded-xl shadow-md p-4 ${isNext ? 'border-l-4 border-violet-500' : ''}`}>
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-10 w-10 border border-gray-200">
          <AvatarImage src={userAvatar} />
          <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-medium text-gray-900">{userName}</h3>
          <Badge className={session.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
            {session.status === 'confirmed' ? 'Confirmed' : 'Pending'}
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-gray-500 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Date
          </span>
          <span className="font-medium">{formattedDate}</span>
        </div>
        <div>
          <span className="text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Time
          </span>
          <span className="font-medium">{formattedTime}</span>
        </div>
        {isNext && (
          <div className="col-span-2">
            <span className="text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Countdown
            </span>
            <span className="font-medium text-violet-600">{countdown}</span>
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
        {session.status === 'pending' ? (
          <Button size="sm" variant="outline" onClick={handleToggleStatus}>
            <CheckCircle className="h-4 w-4 mr-1" /> Confirm
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={handleToggleStatus}>
            <AlertCircle className="h-4 w-4 mr-1" /> Mark Pending
          </Button>
        )}
        
        <Button 
          size="sm" 
          disabled={!canJoin || session.status !== 'confirmed'}
          onClick={() => window.open(`/session/${session.id}`, "_blank")}
        >
          <Video className="h-4 w-4 mr-1" /> 
          {canJoin && session.status === 'confirmed' ? 'Join Session' : 'Available 10 min before'}
        </Button>
      </div>
    </div>
  );
};

const BabalawoDashboardOverview = () => {
  const { data: stats, isLoading } = useBabalawoDashboardStats();
  const [isActive, setIsActive] = useState(stats?.isActive ?? false);
  
  useEffect(() => {
    setIsActive(stats?.isActive ?? false);
  }, [stats?.isActive]);

  const handleToggle = async () => {
    try {
      const newStatus = !isActive;
      setIsActive(newStatus);
      
      const { error } = await supabase
        .from('babalawos')
        .update({ is_active: newStatus })
        .eq('id', stats?.babalawoId);
      
      if (error) throw error;
      
      toast({ 
        title: `Status updated`, 
        description: `You are now ${newStatus ? 'online' : 'offline'}` 
      });
    } catch (err) {
      console.error('Error updating status:', err);
      setIsActive(!newStatus); // Revert on error
      toast({ 
        title: "Error updating status", 
        variant: "destructive" 
      });
    }
  };

  // Stat card gradients
  const statGradients = [
    "linear-gradient(110deg, #7b61ff 30%, #7f53ac 100%)",
    "linear-gradient(110deg, #34b7a7 10%, #7ad7f1 100%)",
    "linear-gradient(110deg, #fbb034 0%, #ffdd00 100%)"
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }

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
            value={`₦${stats?.totalEarnings?.toLocaleString() ?? 0}`}
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
            className={isActive ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isActive ? "Online" : "Offline"}
          </Button>
          <span className="text-muted-foreground">
            {isActive 
              ? "You are visible to users and can receive bookings justify-center py-8 text-gray-500">
        : "You are invisible to users and cannot receive new bookings"}
          </span>
        </div>
        
 ) : (
        {/* Main Panel Row */}
        <div className="grid md:grid-cols-2 gap-8"> mb-4">Next Session</div>
            {stats?.nextSession ? (
              <SessionCard session={stats.nextSession} isNext={true} />
          {/* Next Session */}
          <div className="bg-white rounded-2xl shadow-lg px-6 py-6">
            <div className="font-semibold text-xl mb-4 text-violet-700 mb-4">Next Session</div>
            {stats?.nextSession={session} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 text-gray-300 mb-2" />
                  <span>No upcoming bookings</span>
                </div>
              )} ? (
              <SessionCard session={stats.nextSession} isNext={true} />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 text-gray-300 mb-2" />
                <span>No upcoming sessions scheduled</span>
              </div>
            </div>
          </div>
      
          
          {/* Upcoming Bookings */}
          <div className="bg-white rounded-2xl shadow-lg px-6 py-6">
            <div className="font-semibold text-xl mb-4 text-violet-700">Upcoming Bookings</div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {stats?.upcomingBookings?.length > 0 ? (
                stats.upcomingBookings.map((session: any) => (
                  <SessionCard key={session.id} session={session} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 text-gray-300 mb-2" />
                  <span>No upcoming bookings</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Summary Panel: Right */}
      <div className="w-full lg:w-96 shrink-0">
        <SummaryCard
          balance={stats?.availableBalance ?? 0}
          notifications={stats?.notifications}
        />
      </div>
    </div>
  );
};

export default BabalawoDashboardOverview;
