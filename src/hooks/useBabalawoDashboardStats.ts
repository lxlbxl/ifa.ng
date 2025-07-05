import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';


const fetchBabalawoDashboardStats = async (babalawoId: string) => {
  const today = new Date();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Scheduled sessions for today
  const { data: todaysSessions } = await supabase
    .from('sessions')
    .select('id, session_date, start_time, end_time, user_id, status')
    .eq('babalawo_id', babalawoId)
    .eq('session_date', today.toISOString().substring(0, 10))
    .in('status', ['pending', 'confirmed']);

  // This month's earnings: Sum of completed session amounts
  const { data: monthEarnings } = await supabase
    .from('sessions')
    .select('amount')
    .eq('babalawo_id', babalawoId)
    .eq('status', 'completed')
    .gte('session_date', thisMonthStart.toISOString().substring(0, 10))
    .lte('session_date', thisMonthEnd.toISOString().substring(0, 10));

  const totalEarnings = monthEarnings?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0;

  // Next session (today or future) without nested user details
  const { data: nextSession } = await supabase
    .from('sessions')
    .select('id, session_date, start_time, end_time, status, user_id')
    .eq('babalawo_id', babalawoId)
    .in('status', ['pending', 'confirmed'])
    .gte('session_date', today.toISOString().substring(0, 10))
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true })
    .maybeSingle();

  // Upcoming bookings (next 5) without nested user details
  const { data: upcomingBookings } = await supabase
    .from('sessions')
    .select('id, session_date, start_time, end_time, status, user_id')
    .eq('babalawo_id', babalawoId)
    .in('status', ['pending', 'confirmed'])
    .gte('session_date', today.toISOString().substring(0, 10))
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(5);

  // Get real ratings summary
  const { data: ratingStats } = await supabase
    .from('reviews')
    .select('rating')
    .eq('babalawo_id', babalawoId);

  const averageRating = ratingStats?.length
    ? parseFloat((ratingStats.reduce((s, r) => s + (r.rating || 0), 0) / ratingStats.length).toFixed(2))
    : 0;

  // Get real notifications from the database
  const { data: notificationsData, error: notificationsError } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', babalawoId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fallback notifications if there's an error or no notifications
  let notifications = notificationsData;
  if (notificationsError || !notifications || notifications.length === 0) {
    notifications = [
      { id: '1', type: "booking", message: "You have no new notifications.", action_label: "", action_url: "", created_at: "", read: false, timestamp: "", title: "", user_id: "" },
    ];
  }

  // Availability status - read from Babalawo row
  const { data: babaProfile } = await supabase
    .from('babalawos')
    .select('is_active')
    .eq('id', babalawoId)
    .single();

  return {
    todaysSessions: todaysSessions || [],
    totalEarnings,
    nextSession,
    upcomingBookings: upcomingBookings || [],
    averageRating,
    totalReviews: ratingStats?.length || 0,
    notifications,
    isActive: babaProfile?.is_active ?? false,
  };
};

export const useBabalawoDashboardStats = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['babalawoDashboardStats', user?.id],
    queryFn: () => user?.id ? fetchBabalawoDashboardStats(user.id) : null,
    enabled: !!user?.id,
    refetchInterval: 60000 // Refetch every minute to keep countdown accurate
  });
};
