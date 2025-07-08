import React, { useState, useEffect } from "react";
import { Calendar, Star, DollarSign, Bell, Clock, Video, User, CheckCircle, AlertCircle } from "lucide-react";
import { useBabalawoDashboardStats } from "@/hooks/useBabalawoDashboardStatsSimple";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, isAfter, subMinutes, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const StatCard = ({
  label,
  value,
  icon: Icon,
  description,
  trend,
  color = "blue"
}) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    purple: "bg-purple-50 text-purple-700",
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-500 text-sm">{label}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
          {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center">
          <span className={trend.positive ? "text-green-600" : "text-red-600"}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
          <span className="text-gray-500 text-sm ml-1">vs last month</span>
        </div>
      )}
    </div>
  );
};

const UpcomingSession = ({ session }) => {
  const [countdown, setCountdown] = useState("");
  const [canJoin, setCanJoin] = useState(false);
  
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const sessionDateTime = new Date(session.scheduled_at);
      
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
      } else {
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
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12 border border-gray-200">
          <AvatarImage src={session.client?.avatar_url} />
          <AvatarFallback>{session.client?.name?.charAt(0) || 'C'}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <h3 className="font-semibold">{session.client?.name || 'Client'}</h3>
          <p className="text-sm text-gray-500">{session.consultation_type}</p>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">{countdown}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {format(new Date(session.scheduled_at), 'MMM d, h:mm a')}
          </p>
        </div>
      </div>
      
      <div className="mt-4 flex justify-between items-center">
        <Badge variant={session.status === 'confirmed' ? 'outline' : 'secondary'}>
          {session.status === 'confirmed' ? 'Confirmed' : 'Pending'}
        </Badge>
        
        <Button 
          size="sm" 
          disabled={!canJoin}
          onClick={() => window.location.href = `/consultation/${session.id}`}
        >
          {canJoin ? 'Join Now' : 'View Details'}
        </Button>
      </div>
    </div>
  );
};

const BabalawoDashboardOverview = () => {
  const { data: stats, isLoading, error } = useBabalawoDashboardStats();
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  
  useEffect(() => {
    const fetchBabalawoStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: babalawoData, error } = await supabase
            .from('babalawos')
            .select('is_active')
            .eq('id', user.id)
            .single();
          
          if (error) throw error;
          
          setIsActive(babalawoData?.is_active || false);
        }
      } catch (error) {
        console.error('Error fetching babalawo status:', error);
      } finally {
        setLoadingStatus(false);
      }
    };
    
    const fetchUpcomingSessions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: babalawoData } = await supabase
            .from('babalawos')
            .select('id')
            .eq('id', user.id)
            .single();
          
          if (babalawoData) {
            const now = new Date().toISOString();
            
            const { data, error } = await supabase
              .from('sessions')
              .select(`
                id, 
                status, 
                scheduled_at, 
                consultation_type,
                client:client_id (
                  name:full_name, 
                  avatar_url
                )
              `)
              .eq('babalawo_id', babalawoData.id)
              .gte('scheduled_at', now)
              .in('status', ['confirmed', 'pending'])
              .order('scheduled_at', { ascending: true })
              .limit(3);
            
            if (error) throw error;
            
            setUpcomingSessions(data || []);
          }
        }
      } catch (error) {
        console.error('Error fetching upcoming sessions:', error);
      }
    };
    
    const fetchRecentReviews = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: babalawoData } = await supabase
            .from('babalawos')
            .select('id')
            .eq('id', user.id)
            .single();
          
          if (babalawoData) {
            const { data, error } = await supabase
              .from('reviews')
              .select(`
                id, 
                rating, 
                comment,
                created_at,
                client:client_id (
                  name:full_name, 
                  avatar_url
                )
              `)
              .eq('babalawo_id', babalawoData.id)
              .order('created_at', { ascending: false })
              .limit(3);
            
            if (error) throw error;
            
            setRecentReviews(data || []);
          }
        }
      } catch (error) {
        console.error('Error fetching recent reviews:', error);
      }
    };
    
    fetchBabalawoStatus();
    fetchUpcomingSessions();
    fetchRecentReviews();
  }, []);
  
  const toggleActiveStatus = async () => {
    try {
      setLoadingStatus(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase
          .from('babalawos')
          .update({ is_active: !isActive })
          .eq('id', user.id);
        
        if (error) throw error;
        
        setIsActive(!isActive);
        
        toast({
          title: isActive ? 'You are now offline' : 'You are now online',
          description: isActive 
            ? 'You will not receive new booking requests' 
            : 'You are now visible to clients and can receive bookings',
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error updating status',
        description: 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setLoadingStatus(false);
    }
  };
  
  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full">
      {/* Main Content: Left */}
      <div className="flex-1 min-w-0 flex flex-col gap-8">
        {/* Stat Card Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Earnings"
            value={`$${stats?.totalEarnings || 0}`}
            icon={DollarSign}
            color="green"
            description="From completed sessions"
            trend={{ positive: true, value: "12%" }}
          />
          <StatCard
            label="Consultations"
            value={stats?.totalSessions || 0}
            icon={Calendar}
            color="blue"
            description="Total sessions completed"
            trend={{ positive: true, value: "8%" }}
          />
          <StatCard
            label="Average Rating"
            value="4.8"
            icon={Star}
            color="yellow"
            description="From reviews"
            trend={{ positive: true, value: "0.2" }}
          />
          <StatCard
            label="Completion Rate"
            value={`${stats?.completedSessions ? Math.round((stats.completedSessions / stats.totalSessions) * 100) : 0}%`}
            icon={CheckCircle}
            color="purple"
            description={`${stats?.completedSessions || 0} completed`}
            trend={{ positive: true, value: "5%" }}
          />
        </div>
        
        {/* Status Toggle */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Your Status</h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Button 
              onClick={toggleActiveStatus}
              disabled={loadingStatus}
              variant={isActive ? "default" : "outline"}
              className={isActive ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {isActive ? "Online" : "Offline"}
            </Button>
            <span className="text-muted-foreground">
              {isActive 
                ? "You are visible to users and can receive bookings" 
                : "You are invisible to users and cannot receive new bookings"}
            </span>
          </div>
        </div>
        
        {/* Upcoming Sessions */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Upcoming Sessions</h2>
            <Button variant="outline" size="sm" asChild>
              <a href="/dashboard/consultations">View All</a>
            </Button>
          </div>
          
          {upcomingSessions.length > 0 ? (
            <div className="space-y-4">
              {upcomingSessions.map((session) => (
                <UpcomingSession key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No upcoming sessions</p>
              <p className="text-sm mt-1">Your schedule is clear for now</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Sidebar: Right */}
      <div className="lg:w-1/3 flex flex-col gap-8">
        {/* Recent Reviews */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Reviews</h2>
            <Button variant="outline" size="sm" asChild>
              <a href="/dashboard/reviews">View All</a>
            </Button>
          </div>
          
          {recentReviews.length > 0 ? (
            <div className="space-y-4">
              {recentReviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={review.client?.avatar_url} />
                      <AvatarFallback>{review.client?.name?.charAt(0) || 'C'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{review.client?.name || 'Client'}</p>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="text-xs text-gray-500 ml-2">
                          {format(new Date(review.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {review.comment && (
                    <p className="text-sm text-gray-600 mt-2">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Star className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No reviews yet</p>
              <p className="text-sm mt-1">Reviews will appear here once clients leave feedback</p>
            </div>
          )}
        </div>
        
        {/* Quick Tips */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Tips to Increase Bookings</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">Complete your profile with detailed information about your expertise and services</p>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">Respond quickly to consultation requests and messages</p>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">Ask satisfied clients to leave reviews after consultations</p>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">Offer a variety of consultation types and durations</p>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">Keep your availability calendar up to date</p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BabalawoDashboardOverview;