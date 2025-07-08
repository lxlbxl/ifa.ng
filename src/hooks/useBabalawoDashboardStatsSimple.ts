import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useBabalawoDashboardStats = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['babalawoDashboardStats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Get basic stats from existing tables
      const [sessionsResult, notificationsResult] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, status, amount')
          .eq('babalawo_id', user.id),
        supabase
          .from('notifications')
          .select('id, read')
          .eq('user_id', user.id)
      ]);
      
      const sessions = sessionsResult.data || [];
      const notifications = notificationsResult.data || [];
      
      // Calculate stats from sessions
      const totalSessions = sessions.length;
      const completedSessions = sessions.filter(s => s.status === 'completed').length;
      const totalEarnings = sessions
        .filter(s => s.status === 'completed')
        .reduce((sum, s) => sum + Number(s.amount), 0);
      
      // Calculate notification stats
      const unreadNotifications = notifications.filter(n => !n.read).length;
      
      return {
        totalSessions,
        completedSessions,
        totalEarnings,
        unreadNotifications,
        upcomingSessions: sessions.filter(s => s.status === 'confirmed').length
      };
    },
    enabled: !!user?.id,
  });
};