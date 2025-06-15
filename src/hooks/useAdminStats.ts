import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAdminStats = () => {
  // const [stats, setStats] = React.useState(null);
  // const [loading, setLoading] = React.useState(true);
  // const [error, setError] = React.useState(null);

  // Fix: Use enum values instead of string literals
  const statuses = ['pending', 'confirmed', 'completed', 'cancelled'] as const;

  const fetchAdminStats = async () => {
    // Total Users
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      // .eq('role', 'user'); // Filter for users

    const totalUsers = users?.length ?? 0;

    // Total Babalawos
    const { data: babalawos } = await supabase
      .from('babalawos')
      .select('id');

    const totalBabalawos = babalawos?.length ?? 0;

    // Consultations
    // For each consultation status, use type-correct filtering
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id,status');

    const upcoming = sessions?.filter(s => s.status === 'pending' || s.status === 'confirmed').length ?? 0;
    const completed = sessions?.filter(s => s.status === 'completed').length ?? 0;
    const cancelled = sessions?.filter(s => s.status === 'cancelled').length ?? 0;

    // Daily/Weekly/Monthly Revenue - sum by time
    const todayStr = new Date().toISOString().substring(0, 10);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().substring(0, 10);

    const { data: completedSessionsToday } = await supabase
      .from('sessions')
      .select('amount, session_date, status')
      .eq('status', 'completed')
      .eq('session_date', todayStr);

    const { data: completedSessionsThisWeek } = await supabase
      .from('sessions')
      .select('amount, session_date, status')
      .eq('status', 'completed')
      .gte('session_date', weekAgoStr)
      .lte('session_date', todayStr);

    const { data: allCompletedSessions } = await supabase
      .from('sessions')
      .select('amount, status')
      .eq('status', 'completed');

    const todayRevenue = completedSessionsToday?.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;
    const weekRevenue = completedSessionsThisWeek?.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;
    const allRevenue = allCompletedSessions?.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;

    // Session Success Rate
    const totalSessions = sessions?.length ?? 0;
    const sessionSuccessRate = totalSessions > 0 ? Math.round((completed / totalSessions) * 100) : 0;

    // Top Babalawos (by rating, fallback to bookings)
    // We try to get the most rated, sorted descending, then fallback by popular (by sessions)
    let topBabalawosData: any[] = [];
    const { data: topBabalawoRows } = await supabase
      .from('babalawos')
      .select('id, rating, total_sessions') // Only fetch what we have!
      .order('rating', { ascending: false })
      .limit(5);

    topBabalawosData = topBabalawoRows || [];

    // Recent User Signups
    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('id, full_name, created_at, avatar_url')
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      totalUsers,
      totalBabalawos,
      consultations: {
        upcoming,
        completed,
        cancelled,
      },
      revenue: {
        today: todayRevenue,
        week: weekRevenue,
        all: allRevenue,
      },
      sessionSuccessRate,
      topBabalawos: topBabalawosData,
      recentUsers: recentUsers ?? []
    };
  };

  // React.useEffect(() => {
  //   fetchAdminStats()
  //     .then(data => {
  //       setStats(data);
  //       setLoading(false);
  //     })
  //     .catch(err => {
  //       setError(err);
  //       setLoading(false);
  //     });
  // }, []);

  return {
    // stats,
    // loading,
    // error,
    ...useQuery({
      queryKey: ['adminStats'],
      queryFn: fetchAdminStats,
      staleTime: 60000,
    }),
  };
};
