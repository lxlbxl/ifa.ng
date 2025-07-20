import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAdminStats = () => {
  const fetchAdminStats = async () => {
    // Total Users
    const { data: users } = await supabase
      .from('profiles')
      .select('id');

    const totalUsers = users?.length ?? 0;

    // Total Babalawos
    const { data: babalawos } = await supabase
      .from('babalawos')
      .select('id');

    const totalBabalawos = babalawos?.length ?? 0;

    // Consultations
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id,status');

    const upcoming = sessions?.filter(s => s.status === 'pending' || s.status === 'confirmed').length ?? 0;
    const completed = sessions?.filter(s => s.status === 'completed').length ?? 0;
    const cancelled = sessions?.filter(s => s.status === 'cancelled').length ?? 0;

    // Revenue calculations
    const todayStr = new Date().toISOString().substring(0, 10);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().substring(0, 10);

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().substring(0, 10);

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

    const { data: completedSessionsThisMonth } = await supabase
      .from('sessions')
      .select('amount, session_date, status')
      .eq('status', 'completed')
      .gte('session_date', monthAgoStr)
      .lte('session_date', todayStr);

    const { data: allCompletedSessions } = await supabase
      .from('sessions')
      .select('amount, status')
      .eq('status', 'completed');

    // Calculate revenues
    const todayRevenue = completedSessionsToday?.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;
    const weekRevenue = completedSessionsThisWeek?.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;
    const monthRevenue = completedSessionsThisMonth?.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;
    const allRevenue = allCompletedSessions?.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;

    // Commission and earnings (calculate from revenue for now)
    const totalCommission = allRevenue * 0.2; // 20% platform commission
    const totalBabalawoEarnings = allRevenue * 0.8; // 80% babalawo earnings

    // Session Success Rate
    const totalSessions = sessions?.length ?? 0;
    const sessionSuccessRate = totalSessions > 0 ? Math.round((completed / totalSessions) * 100) : 0;

    // Top Babalawos
    const { data: topBabalawoRows } = await supabase
      .from('babalawos')
      .select('user_id, rating, total_sessions')
      .order('rating', { ascending: false })
      .limit(5);

    // Recent User Signups
    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('id, full_name, created_at, avatar_url')
      .order('created_at', { ascending: false })
      .limit(5);

    // System Alerts - failed sessions count
    const failedSessionsCount = sessions?.filter(s => s.status === 'cancelled').length ?? 0;

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
        month: monthRevenue,
        all: allRevenue,
      },
      totalCommission,
      totalBabalawoEarnings,
      sessionSuccessRate,
      topBabalowos: topBabalawoRows ?? [],
      recentUsers: recentUsers ?? [],
      systemAlerts: {
        failedPayments: failedSessionsCount,
      },
    };
  };

  return useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
    staleTime: 60000,
  });
};